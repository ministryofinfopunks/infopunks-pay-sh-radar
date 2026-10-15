// Read-only preservation check against the user-selected cyan baseline.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const postcss = require('postcss');
const baseline = 'd3d0a445ec20e8c55170c2fc1f52aff220b2a851';
const output = path.resolve(process.env.RADAR_UI_BOUNDARY_OUTPUT || 'docs/ui-unification/validation/source-boundary.json');
const changedSource = new Set(['src/web/radarApp.tsx', 'src/web/radarNetworks.tsx', 'src/web/rhChainSignalDeskPages.tsx', 'src/web/rhChainSignalDeskV2.tsx', 'src/web/styles.css']);
const intentionalTestChanges = new Set(['tests/radar-endpoint-intelligence.test.tsx']);
const before = file => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8', maxBuffer: 12_000_000 });
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const files = JSON.parse(fs.readFileSync('docs/ui-unification/baseline/source-hashes.json', 'utf8'));
const protectedDifferences = Object.entries(files).filter(([file, sha]) => !changedSource.has(file) && !intentionalTestChanges.has(file) && (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== sha)).map(([file]) => file);

function bindings(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = { interactions: [], navigation: [], stateAndRequests: [] };
  function visit(node) {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(ast);
      if (/^on[A-Z]/.test(name)) result.interactions.push(node.getText(ast));
      if (['href', 'action', 'method', 'target'].includes(name)) result.navigation.push(node.getText(ast));
    }
    if (ts.isCallExpression(node) && /^(useState|useRef|useMemo|useEffect|useCallback|fetch|fetchRhChain|api)$/.test(node.expression.getText(ast))) result.stateAndRequests.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return result;
}
const comparisons = [...changedSource].filter(file => file.endsWith('.tsx')).map(file => {
  const a = bindings(before(file), file), b = bindings(fs.readFileSync(file, 'utf8'), file);
  return { file, groups: Object.keys(a).map(group => ({ group, count: a[group].length, unchanged: JSON.stringify(a[group]) === JSON.stringify(b[group]) })) };
});

function legacyRules(css, stripScope) {
  const a = css.indexOf('/* RH Chain Signal Desk 2.0');
  const b = css.indexOf('/* Radar design foundations:', a);
  if (a < 0 || b < 0) throw new Error('Legacy V2 style boundaries missing');
  const rules = [];
  postcss.parse(css.slice(a, b)).walkRules(rule => rules.push({
    selectors: rule.selectors.map(selector => stripScope ? selector.replace(/^:where\(\.rh-chain-shell:not\(\.radar-terminal-page\)\)\s+/, '') : selector),
    declarations: rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value, Boolean(node.important)])
  }));
  return rules;
}
const legacyBefore = legacyRules(before('src/web/styles.css'), false);
const legacyAfter = legacyRules(fs.readFileSync('src/web/styles.css', 'utf8'), true);
const legacyUnchanged = JSON.stringify(legacyBefore) === JSON.stringify(legacyAfter);
const passed = !protectedDifferences.length && comparisons.every(item => item.groups.every(group => group.unchanged)) && legacyUnchanged;
const report = { baseline, candidateCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), candidateIsWorkingTree: true, intentionalTestChanges: [...intentionalTestChanges], protectedFilesChecked: Object.keys(files).length - changedSource.size - intentionalTestChanges.size, protectedDifferences, comparisons, legacyStyleRules: legacyBefore.length, legacyDeclarationsAndSpecificityPreservedOnOtherRoutes: legacyUnchanged, passed, limitation: 'Static evidence complements actual browser and domain tests; it does not prove visual or interaction qualification.' };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed, protectedFilesChecked: report.protectedFilesChecked, protectedDifferences, comparisons, legacyStyleRules: legacyBefore.length, legacyUnchanged }, null, 2));
process.exitCode = passed ? 0 : 1;
