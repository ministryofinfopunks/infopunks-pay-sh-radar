import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';

// This runner always creates its own cluster. It cannot use an operator DB URL.
const output = resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) ?? 'docs/evidence/e1-a/qualification');
const baseline = process.argv.includes('--baseline');
const focused = process.argv.includes('--focused');
mkdirSync(output, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'infopunks-e1-a-'));
const cluster = join(temporary, 'cluster');
const password = randomBytes(32).toString('hex');
const appPassword = randomBytes(32).toString('hex');
const runtimePassword = randomBytes(32).toString('hex');
const passwordFile = join(temporary, 'initdb-password');
writeFileSync(passwordFile, password, { mode: 0o600 });
const safeEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'USER', 'SHELL'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
const binary = name => process.env.E1_A_PG_BIN_DIR ? join(process.env.E1_A_PG_BIN_DIR, name) : name;
const report = { schema_version: 'e1-a-qualification-run.v1', started_at: new Date().toISOString(), baseline: 'b9597fc0388d5f08ea1a611b50e12fcab7102fd9', evidence_class: 'disposable PostgreSQL with synthetic test receipts; no external execution evidence', steps: [], migrations: [], cleanup: false };
const digest = text => 'sha256:' + createHash('sha256').update(text).digest('hex');
const sourceFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n')
  .filter(file => /^(src|scripts|tests|migrations)\//.test(file) || ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.server.json', 'vite.config.ts'].includes(file)).sort();
const sourceManifest = sourceFiles.map(file => ({ file, sha256: digest(readFileSync(file)) }));
writeFileSync(join(output, 'source-manifest.json'), JSON.stringify(sourceManifest, null, 2) + '\n');
report.tested_source_sha256 = digest(JSON.stringify(sourceManifest));
report.source_commit_before_qualification = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const redact = text => text.replaceAll(password, '[REDACTED]').replaceAll(appPassword, '[REDACTED]').replaceAll(runtimePassword, '[REDACTED]').replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[REDACTED_TEST_DATABASE_URL]');
async function command(name, executable, args, env = safeEnv, input) {
  const started = performance.now();
  const result = await new Promise((done, reject) => {
    let text = '';
    const child = spawn(executable, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { text += data.toString(); });
    child.stderr.on('data', data => { text += data.toString(); });
    child.on('error', reject);
    child.on('close', code => done({ code, text: redact(text) }));
    child.stdin.end(input);
  });
  const filename = name + '.txt';
  writeFileSync(join(output, filename), result.text);
  report.steps.push({ name, exit_code: result.code, elapsed_ms: Math.round(performance.now() - started), log: filename, log_sha256: digest(result.text) });
  console.log(name + ': ' + (result.code === 0 ? 'PASS' : 'FAIL'));
  return result;
}
async function required(...args) { const result = await command(...args); if (result.code !== 0) throw new Error('qualification_step_failed:' + args[0]); return result; }
let running = false;
try {
  await required('postgres-version', binary('postgres'), ['--version']);
  await required('initdb', binary('initdb'), ['-D', cluster, '-U', 'e1a_cluster', '--pwfile', passwordFile, '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', '--encoding=UTF8', '--no-locale']);
  const port = await new Promise((done, reject) => { const socket = createServer(); socket.on('error', reject); socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => done(port)); }); });
  await required('start-postgres', binary('pg_ctl'), ['-D', cluster, '-l', join(temporary, 'postgres.txt'), '-o', `-h 127.0.0.1 -p ${port} -k ${temporary}`, '-w', 'start']);
  running = true;
  const adminEnv = { ...safeEnv, PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'e1a_cluster', PGPASSWORD: password, PGDATABASE: 'postgres' };
  await required('create-test-role', binary('psql'), ['-v', 'ON_ERROR_STOP=1', '-X'], adminEnv,
    `create role e1a_app login nosuperuser nocreatedb nocreaterole password '${appPassword}';\ncreate role e1a_runtime login nosuperuser nocreatedb nocreaterole password '${runtimePassword}';\ncreate database e1a_qualification owner e1a_app;\n`);
  const appEnv = { ...adminEnv, PGUSER: 'e1a_app', PGPASSWORD: appPassword, PGDATABASE: 'e1a_qualification' };
  await required('isolation', binary('psql'), ['-v', 'ON_ERROR_STOP=1', '-X', '-c', "select current_database(), current_user, rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname=current_user; create schema branch_migration_path;"], appEnv);
  await required('runtime-permissions', binary('psql'), ['-v', 'ON_ERROR_STOP=1', '-X', '-c', 'alter default privileges grant select, insert on tables to e1a_runtime; alter default privileges grant usage, select on sequences to e1a_runtime;'], appEnv);
  const migrationEnv = { ...appEnv, PGOPTIONS: '-c search_path=branch_migration_path' };
  for (const filename of readdirSync('migrations').filter(file => file.endsWith('.up.sql')).sort()) {
    const sql = readFileSync(join('migrations', filename), 'utf8');
    const result = await required('migration-' + filename.slice(0, -7), binary('psql'), ['-v', 'ON_ERROR_STOP=1', '-X'], migrationEnv, sql);
    report.migrations.push({ file: filename, sha256: digest(sql), applied: result.code === 0 });
  }
  await required('schema-after-migrations', binary('psql'), ['-X', '-c', "select table_name from information_schema.tables where table_schema='branch_migration_path' order by table_name;"], appEnv);
  await required('restart-postgres', binary('pg_ctl'), ['-D', cluster, '-l', join(temporary, 'postgres.txt'), '-m', 'fast', '-w', 'restart']);
  await required('schema-after-restart', binary('psql'), ['-X', '-c', "select table_name from information_schema.tables where table_schema='branch_migration_path' order by table_name;"], appEnv);
  if (!baseline && !focused) {
    await required('create-rollback-schema', binary('psql'), ['-v', 'ON_ERROR_STOP=1', '-X', '-c', 'create schema rollback_validation;'], appEnv);
    const rollbackEnv = { ...appEnv, PGOPTIONS: '-c search_path=rollback_validation' };
    for (const filename of readdirSync('migrations').filter(file => file.endsWith('.up.sql')).sort()) {
      await required('rollback-setup-' + filename.slice(0, -7), binary('psql'), ['-v', 'ON_ERROR_STOP=1', '-X'], rollbackEnv, readFileSync(join('migrations', filename), 'utf8'));
    }
    const reversed = [];
    for (const filename of readdirSync('migrations').filter(file => file.endsWith('.down.sql')).sort().reverse()) {
      const result = await command('rollback-' + filename.slice(0, -9), binary('psql'), ['-v', 'ON_ERROR_STOP=1', '-X'], rollbackEnv, readFileSync(join('migrations', filename), 'utf8'));
      if (result.code !== 0) {
        if (filename === '20261008_016_rh_usdg_accounting.down.sql' && result.text.includes('accounting rollback requires code/traffic rollback')) {
          report.steps.at(-1).expected_failure = true;
          report.rollback_boundary = { migration: filename, status: 'intentionally_irreversible', immutable_accounting_preserved: true };
          break;
        }
        throw new Error('unexpected_migration_rollback_failure:' + filename);
      }
      reversed.push(filename.replace('.down.sql', '.up.sql'));
    }
    for (const filename of reversed.reverse()) {
      await required('reapply-' + filename.slice(0, -7), binary('psql'), ['-v', 'ON_ERROR_STOP=1', '-X'], rollbackEnv, readFileSync(join('migrations', filename), 'utf8'));
    }
    await required('rollback-restored-schema', binary('psql'), ['-X', '-c', "select table_name from information_schema.tables where table_schema='rollback_validation' order by table_name;"], appEnv);
  }
  const connectionString = `postgresql://e1a_app:${appPassword}@127.0.0.1:${port}/e1a_qualification`;
  const testEnv = { ...safeEnv, NODE_ENV: 'test', CANONICAL_RECEIPT_TEST_URL: connectionString,
    CANONICAL_RECEIPT_TEST_ADMIN_URL: `postgresql://e1a_cluster:${password}@127.0.0.1:${port}/e1a_qualification`,
    E1_A_RUNTIME_TEST_URL: `postgresql://e1a_runtime:${runtimePassword}@127.0.0.1:${port}/e1a_qualification`,
    ECONOMIC_ENGINE_TEST_URL: connectionString, POSTGRES_RESILIENCE_TEST_URL: connectionString,
    E1_A_ARTIFACT_DIR: output, E1_A_DISPOSABLE_CLUSTER: 'true' };
  const checks = baseline ? [['baseline-tests', ['test', '--', 'tests/integration/evaluation-review-postgres.test.ts', 'tests/unit/evaluation-review-authority.test.ts']]]
    : focused ? [['focused-tests', ['test', '--', 'tests/integration/e1-a-qualification.test.ts', '--reporter=json', '--outputFile=' + join(output, 'vitest.json')]]]
    : [['typecheck', ['run', 'typecheck']], ['lint', ['run', 'lint']], ['build', ['run', 'build']],
       ['regression-tests', ['test', '--', '--maxWorkers=2', '--reporter=json', '--outputFile=' + join(output, 'vitest.json')]]];
  if (!baseline && !focused) await command('migration-inventory', process.execPath, ['scripts/check-e1-a-migrations.mjs', '--output=' + output], testEnv);
  for (const [name, args] of checks) await command(name, 'npm', args, testEnv);
  if (!baseline && existsSync(join(output, 'synthetic-durability-bundle.json'))) {
    await required('restart-after-receipt-persistence', binary('pg_ctl'), ['-D', cluster, '-l', join(temporary, 'postgres.txt'), '-m', 'fast', '-w', 'restart']);
    await required('post-restart-receipt-replay', 'npm', ['exec', '--', 'tsx', 'scripts/replay-e1-a-bundle.ts'], testEnv);
  }
  if (existsSync(join(output, 'vitest.json'))) {
    const tests = JSON.parse(readFileSync(join(output, 'vitest.json'), 'utf8'));
    report.tests = { total: tests.numTotalTests, passed: tests.numPassedTests, failed: tests.numFailedTests, pending: tests.numPendingTests,
      qualification_cases: tests.testResults.flatMap(result => result.assertionResults ?? []).filter(test => test.fullName.startsWith('E1-A disposable PostgreSQL authority qualification')).map(test => ({ name: test.fullName, status: test.status })) };
    writeFileSync(join(output, 'vitest.json'), redact(JSON.stringify(tests, null, 2)) + '\n');
  }
  report.checks_passed = report.steps.every(step => step.exit_code === 0 || step.expected_failure === true);
} catch (error) {
  report.error = redact(String(error));
  report.checks_passed = false;
} finally {
  if (running) {
    const stopped = await command('stop-postgres', binary('pg_ctl'), ['-D', cluster, '-m', 'fast', '-w', 'stop']);
    report.cleanup = stopped.code === 0;
  }
  if (report.cleanup || !running) rmSync(temporary, { recursive: true, force: true });
  report.finished_at = new Date().toISOString();
  writeFileSync(join(output, 'run.json'), JSON.stringify(report, null, 2) + '\n');
  process.exitCode = report.checks_passed && report.cleanup ? 0 : 1;
}
