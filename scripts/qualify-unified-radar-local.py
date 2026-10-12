"""Reproducible local qualification. Creates only purpose-named disposable localhost databases."""
import argparse, json, os, platform, shutil, subprocess, time, uuid
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--node-bin', help='Directory containing the qualified Node/npm executables')
args = parser.parse_args()
root = Path.cwd()
out = root / 'docs/evidence/unified-radar/system'
logs = root / 'output/unified-radar/final-logs'
out.mkdir(parents=True, exist_ok=True)
logs.mkdir(parents=True, exist_ok=True)
env = dict(os.environ)
for key in list(env):
    if any(term in key for term in ['TOKEN', 'PRIVATE_KEY', 'API_KEY', 'DATABASE_URL', 'TEST_URL', 'JUDGMENT_ISSUER', 'IPX_LAUNCH']):
        env.pop(key, None)
if args.node_bin:
    env['PATH'] = args.node_bin + os.pathsep + env['PATH']
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
if subprocess.check_output(['git', 'diff', 'HEAD', '--', 'src', 'tests', 'migrations', 'package.json', 'package-lock.json', 'scripts'], text=True).strip():
    raise RuntimeError('Commit source/tests/qualification scripts before freezing evidence')
name = 'unified_radar_' + uuid.uuid4().hex[:12]
databases = [name, name + '_resilience', name + '_migration', name + '_restore']
for database in databases:
    subprocess.run(['createdb', database], check=True)
env.update(NODE_ENV='test', CANONICAL_RECEIPT_TEST_URL='postgresql://localhost/' + name,
           ECONOMIC_ENGINE_TEST_URL='postgresql://localhost/' + name,
           POSTGRES_RESILIENCE_TEST_URL='postgresql://localhost/' + name + '_resilience')
results = []

def run(label, command, scoped_env=None, tolerated=False):
    started = time.monotonic()
    with (logs / (label + '.log')).open('w') as log:
        status = subprocess.run(command, env=scoped_env or env, stdout=log, stderr=subprocess.STDOUT).returncode
    results.append({'name': label, 'command': command, 'exit_code': status,
                    'elapsed_seconds': round(time.monotonic() - started, 3), 'raw_log': str((logs / (label + '.log')).relative_to(root))})
    (out / 'check-results.json').write_text(json.dumps({'source_sha': revision, 'platform': platform.platform(), 'databases': databases, 'scope': 'disposable localhost only; no external payment or production data', 'checks': results}, indent=2) + '\n')
    print(label, status, flush=True)
    if status and not tolerated:
        raise RuntimeError(label + ' failed; see local raw log')
    return logs / (label + '.log')

run('runtime', ['node', '--version'])
run('typecheck', ['npm', 'run', 'typecheck'])
run('lint', ['npm', 'run', 'lint'])
run('build', ['npm', 'run', 'build'], dict(env, NODE_ENV='production'))
run('migration-inventory', ['npm', 'run', 'migrations:validate'])
report = logs / 'full-tests.json'
run('full-tests', ['npm', 'test', '--', '--maxWorkers=1', '--testTimeout=30000', '--reporter=default', '--reporter=json', '--outputFile=' + str(report)])
full = json.loads(report.read_text())
summary = {key: full[key] for key in ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'success']}
summary['files'] = [{'name': str(Path(item['name']).relative_to(root)), 'status': item['status'], 'tests': len(item['assertionResults'])} for item in full['testResults']]
(out / 'full-test-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
for label, command in [('audit-production', ['npm', 'audit', '--omit=dev', '--json']), ('audit-all', ['npm', 'audit', '--json'])]:
    log = run(label, command, tolerated=(label == 'audit-all'))
    shutil.copyfile(log, out / (label + '.json'))
# Apply/check/repeat the whole inventory to a separate fresh database.
migration_env = dict(env, DATABASE_URL='postgresql://localhost/' + name + '_migration')
for label, extra in [('migration-first', []), ('migration-check', ['--validate']), ('migration-repeat', [])]:
    log = run(label, ['node', 'dist/server/cli/runPostgresMigrations.js'] + extra, migration_env)
    shutil.copyfile(log, out / (label + '.json'))
recovery_env = dict(env, CANONICAL_RECEIPT_TEST_URL= migration_env['DATABASE_URL'])
run('recovery-seed', ['node', '--import', 'tsx', 'scripts/qualify-unified-radar-recovery.mjs', 'seed'], recovery_env)
# pg_dump and pg_restore never see an existing database or production connection string.
backup = logs / 'local-recovery.dump'
run('backup', ['pg_dump', '--format=custom', '--no-owner', '--file=' + str(backup), name + '_migration'])
run('restore', ['pg_restore', '--no-owner', '--dbname=' + name + '_restore', str(backup)])
run('recovery-verify', ['node', '--import', 'tsx', 'scripts/qualify-unified-radar-recovery.mjs', 'verify'], dict(recovery_env, CANONICAL_RECEIPT_TEST_URL='postgresql://localhost/' + name + '_restore'))
for filename in ['phase2-judgment-performance.json', 'phase2-judgment-postgres-performance.json']:
    if (root / 'output' / filename).exists():
        shutil.copyfile(root / 'output' / filename, out / filename)
run('diff-check', ['git', 'diff', '--check'])
# The names and artifacts remain reviewable; remove only DBs created by this invocation.
for database in databases:
    subprocess.run(['dropdb', database], check=True)
print('Qualification complete for', revision, flush=True)
