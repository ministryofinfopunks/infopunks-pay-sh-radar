import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const dir = 'output/phase5'; mkdirSync(dir, { recursive: true });
const url = process.env.CANONICAL_RECEIPT_TEST_URL;
if (!url || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('local_disposable_database_required');
const env = { ...process.env, CANONICAL_RECEIPT_TEST_URL: url, ECONOMIC_ENGINE_TEST_URL: url, POSTGRES_RESILIENCE_TEST_URL: url };
const fingerprint = () => {
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n').filter(f => /^(src|scripts|tests|migrations)\/|^(package.*json|tsconfig.*json|vite.config.ts)$/.test(f)).sort();
  return createHash('sha256').update(files.map(f => f + '\0' + readFileSync(f).toString()).join('\0')).digest('hex');
};
const before = fingerprint();
const results = [];
const tasks = [
  ['typecheck', 'npm', ['run', 'typecheck']], ['lint', 'npm', ['run', 'lint']],
  ['full-tests', 'npx', ['vitest', 'run', '--maxWorkers=2', '--reporter=default', '--reporter=json', '--outputFile=' + dir + '/full-tests.json']],
  ['protocol-tests', 'npx', ['vitest', 'run', 'tests/integration', 'tests/receipt-spine.test.ts', 'tests/receipt-integrity.test.ts', 'tests/security', 'tests/unit/x402-judgment.test.ts', 'tests/unit/execution-proof-service.test.ts', 'tests/unit/evaluation-service.test.ts', 'tests/unit/evaluation-score-policy.test.ts', 'tests/unit/derived-score-service.test.ts', 'tests/receipt-chain-inspector.test.ts', 'tests/receipt-chain-inspector-page.test.tsx', '--maxWorkers=2', '--reporter=default', '--reporter=json', '--outputFile=' + dir + '/protocol-tests.json']],
  ['build', 'npm', ['run', 'build']], ['diff-check', 'git', ['diff', '--check']],
  ['authority-audit', 'node', ['scripts/audit-phase4-score-authority.mjs']], ['scenario', 'npm', ['run', 'proof:phase5']]
] as const;
for (const [name, command, args] of tasks) {
  console.log('Starting ' + name); const started = Date.now();
  const result = spawnSync(command, [...args], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(`${dir}/${name}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
  results.push({ name, command: [command, ...args].join(' '), exit_code: result.status, signal: result.signal, duration_ms: Date.now() - started });
  console.log(JSON.stringify(results.at(-1)));
  writeFileSync(dir + '/validation.json', JSON.stringify({ source_fingerprint_before: before, source_fingerprint_after: fingerprint(), results }, null, 2) + '\n');
}
if (results.some(r => r.exit_code !== 0) || fingerprint() !== before) process.exitCode = 1;
