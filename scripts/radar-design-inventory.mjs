import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
const sources = readdirSync('src/web').filter(name => name.endsWith('.tsx')).map(name => `src/web/${name}`);
export function discoverRoutePatterns() {
 const patterns = new Map();
 for (const file of sources) {
  const source = ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit = node => {
   if (ts.isRegularExpressionLiteral(node) && node.text.startsWith('/^\\/')) {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    if (!patterns.has(node.text)) patterns.set(node.text,{pattern:node.text,file,line});
   }
   ts.forEachChild(node,visit);
  }; visit(source);
 }
 return [...patterns.values()].sort((a,b)=>a.pattern.localeCompare(b.pattern));
}
const patterns = discoverRoutePatterns();
if(process.argv.includes('--check')) {
 const prior = JSON.parse(readFileSync('docs/design-system/route-patterns.json','utf8'));
 if(JSON.stringify(prior.map(x=>x.pattern))!==JSON.stringify(patterns.map(x=>x.pattern))) throw Error('Route patterns changed. Regenerate design inventory and extend mobile coverage.');
 for(const file of readdirSync('src/web').filter(name=>name.endsWith('.css') && name !== 'radarTokens.css')) {
  const content=readFileSync(`src/web/${file}`,'utf8');
  if([...content.matchAll(/:root\s*\{([^{}]*)\}/g)].some(match=>/--[\w-]+\s*:/.test(match[1]))) throw Error(`Global tokens must be defined in radarTokens.css: ${file}`);
 }
 const css = readFileSync('src/web/styles.css','utf8');
 if(/:root\s*\{/.test(css)) throw Error('Global tokens belong in radarTokens.css.');
 const tokens = readFileSync('src/web/radarTokens.css','utf8');
 for (const required of ['--signal-action: #00eee4;', '--bg: #050b0c;', '--text: #f1f0e5;', '--signal-judgment: #dc91ff;', '--green: var(--signal-action);']) {
  if (!tokens.includes(required)) throw Error(`Canonical palette changed without reference review: ${required}`);
 }
 const main = readFileSync('src/web/main.tsx','utf8');
 if (!main.includes('<RadarAppShell>')) throw Error('Every entry must inherit RadarAppShell.');
 const home = readFileSync('src/web/homepage.tsx','utf8');
 if (!home.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').includes('Before your agent spends, check the evidence.') || /After attention|radar-category-sequence/.test(home)) throw Error('Retired editorial homepage reintroduced.');
 if (/<ProductHeader|<footer/.test(home)) throw Error('Homepage must inherit shared header/footer.');
 for (const required of ['NO CHECK RUN','AWAITING EVIDENCE','NOT CHECKED','NOT ISSUED']) if (!home.includes(required)) throw Error(`Missing truthful preview: ${required}`);
 console.log(`Design drift check passed: ${patterns.length} router patterns; no workflow root tokens.`);
} else {
 writeFileSync('docs/design-system/route-patterns.json',JSON.stringify(patterns,null,2)+'\n');
 writeFileSync('docs/design-system/route-inventory.md',`# Radar route coverage matrix\n\nDiscovered from the actual TSX dispatchers using TypeScript AST (not an assumed route list). ${patterns.length} distinct anchored patterns include aliases, detail identifiers, subviews and the internal review console. The shell is attached above dispatch in main.tsx; every UI match inherits it. Machine JSON/API/health paths are excluded. Pattern source references are recorded in route-patterns.json.\n\nShared shell/token migration is implemented for every pattern below. Route-specific successful/empty/failure/permission and mobile qualification are reported separately in qualification.md; inherited framing alone does not qualify a workflow. Unknown URLs retain the baseline dispatcher fallback.\n\n| Actual router pattern | Dispatcher | Shell / tokens | Mobile qualification |\n| --- | --- | --- | --- |\n`+patterns.map(x=>`| \`${x.pattern.replaceAll('|','&#124;')}\` | ${x.file}:${x.line} | Implemented | See browser results and limitations |`).join('\n')+'\n');
 console.log(`Inventoried ${patterns.length} route patterns.`);
}
