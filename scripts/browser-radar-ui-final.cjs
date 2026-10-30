// Repeats the local fixture browser checks and binds all evidence to exact source bytes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const root = path.resolve(process.env.RADAR_UI_EVIDENCE_DIR || 'docs/ui-unification/evidence/cyan-baseline');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sourcePaths = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '--', 'src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts']).split('\n').filter(Boolean))].sort();
const sourceHashes = () => Object.fromEntries(sourcePaths.map(file => [file, hash(fs.readFileSync(file))]));
const scriptPaths = fs.readdirSync('scripts').filter(file => /^browser-radar-ui-.*\.cjs$/.test(file)).map(file => 'scripts/' + file).sort();
const scriptHashes = Object.fromEntries(scriptPaths.map(file => [file, hash(fs.readFileSync(file))]));
const initialSource = sourceHashes();
const startedAt = new Date().toISOString();
const checks = [];
fs.mkdirSync(root, { recursive: true });
const env = { ...process.env, RADAR_UI_EVIDENCE_DIR: root };

for (const [name, script, extraEnv] of [
  ['screenshots-and-24-widths', 'evidence', {}],
  ['20-interactions-and-6-reflow-checks', 'interactions', {}],
  ['12-accessibility-audits', 'accessibility', {}],
  ['6-native-browser-zoom-checks', 'zoom', {}],
  ['lower-fold-and-wrapping', 'sections', {}],
  ['unchanged-homepage', 'homepage-control', {}],
  ['unchanged-narrative', 'homepage-control', { RADAR_VISUAL_CONTROL_NAME: 'robinhood-narrative', RADAR_VISUAL_CONTROL_ROUTE: '/narratives/robinhood-chain' }],
  ['preservation-comparison', 'compare', {}]
]) {
  const began = new Date().toISOString();
  const command = ['scripts/browser-radar-ui-' + script + '.cjs', 'after'];
  const result = spawnSync(process.execPath, command, { env: { ...env, ...extraEnv }, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
  const log = 'final-' + name + '.log';
  fs.writeFileSync(path.join(root, log), (result.stdout || '') + (result.stderr || ''));
  checks.push({ name, command: [process.execPath, ...command], environmentOverrides: extraEnv, startedAt: began, completedAt: new Date().toISOString(), exitCode: result.status, error: result.error?.message, log });
  console.log(name + ': ' + result.status);
}

const finalSource = sourceHashes();
const sourceUnchanged = JSON.stringify(initialSource) === JSON.stringify(finalSource);
const files = fs.readdirSync(root).filter(file => /^(after-|homepage-control-|robinhood-narrative-control-|comparison-results|final-)/.test(file) && file !== 'final-browser-provenance.json').sort();
const artifacts = Object.fromEntries(files.map(file => [file, { sha256: hash(fs.readFileSync(path.join(root, file))), modifiedAt: fs.statSync(path.join(root, file)).mtime.toISOString() }]));
const report = {
  startedAt, completedAt: new Date().toISOString(), sourceCommitAtCapture: git(['rev-parse', 'HEAD']), sourceBranch: git(['branch', '--show-current']),
  baselineCommit: 'd3d0a445ec20e8c55170c2fc1f52aff220b2a851', nodeVersion: process.version,
  playwrightVersion: require('playwright/package.json').version, axeVersion: require('axe-core/package.json').version,
  sourceManifestSha256: hash(JSON.stringify(initialSource)), sourceUnchangedDuringChecks: sourceUnchanged, sourceFiles: initialSource, scriptFiles: scriptHashes,
  candidateUrl: env.RADAR_UI_BASE_URL || 'http://127.0.0.1:5173', baselineUrl: env.RADAR_BASELINE_URL || 'http://127.0.0.1:5174', checks, artifacts,
  limitations: ['Local fixture-backed UI qualification; live data, payments, authority and production were not exercised.', 'Automated axe and native browser zoom do not constitute manual screen-reader, physical-device or human visual approval.']
};
fs.writeFileSync(path.join(root, 'final-browser-provenance.json'), JSON.stringify(report, null, 2) + '\n');
if (!sourceUnchanged || checks.some(check => check.exitCode !== 0)) process.exitCode = 1;
