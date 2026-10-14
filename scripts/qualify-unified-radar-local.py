"""Reproducible local qualification. Creates only purpose-named disposable localhost databases."""
import argparse, atexit, hashlib, json, os, platform, shutil, subprocess, time, uuid
from urllib.parse import urlparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--node-bin', help='Directory containing the qualified Node/npm executables')
args = parser.parse_args()
root = Path.cwd()
out = root / os.environ.get('RADAR_QUALIFICATION_OUTPUT_DIR', 'output/ci-system')
logs = root / os.environ.get('RADAR_QUALIFICATION_LOG_DIR', 'output/radar-r2/r2-1/final-logs')
out.mkdir(parents=True, exist_ok=True)
logs.mkdir(parents=True, exist_ok=True)
env = dict(os.environ)
for key in list(env):
    if any(term in key for term in ['TOKEN', 'PRIVATE_KEY', 'API_KEY', 'DATABASE_URL', 'TEST_URL', 'JUDGMENT_ISSUER', 'IPX_LAUNCH']):
        env.pop(key, None)
# The harness must not inherit capability activation or authority URLs from a developer shell.
# Individual tests supply synthetic fixtures explicitly; nothing here grants live authority.
for key in ['JUDGMENT_FACILITATOR_URL', 'JUDGMENT_PAY_TO', 'JUDGMENT_RESOURCE_URL', 'JUDGMENT_RH_RPC_URL',
            'EXECUTION_PROOF_BASE_RPC_URL', 'ECONOMIC_ENGINE_FACILITATOR_URL', 'EXECUTION_AUTHORIZATION_KEYS_JSON',
            'EVALUATION_REVIEWER_TRUST_JSON', 'RH_4663_ANCHOR_RPC_URL', 'RH_4663_ANCHOR_CONTRACT']:
    env.pop(key, None)
for key in ['JUDGMENT_PAYMENT_ENABLED', 'MACHINE_EXECUTION_ENABLED', 'MACHINE_DEMO_SEED',
            'ECONOMIC_ENGINE_ENABLED', 'ECONOMIC_ENGINE_AUTHORIZATION_ENABLED', 'ECONOMIC_ENGINE_JEV_ENABLED',
            'MONITOR_ENABLED', 'MONITOR_ALLOW_PAID_ENDPOINTS', 'EVALUATION_REPUTATION_PROJECTION_ENABLED',
            'OPENAI_DECISIONS_SHADOW_ENABLED', 'IPX_PLTR_SHADOW_OBSERVATION_ENABLED', 'IPX_PLTR_SHADOW_CAPACITY_SWEEP_ENABLED',
            'RH_CHAIN_AUTOMATION_ENABLED', 'RH_4663_PHASE2_ENABLED', 'RH_4663_PHASE3_ENABLED',
            'RH_4663_PHASE3_PUBLICATION_ENABLED', 'RH_4663_AUTO_PUBLICATION_ENABLED', 'RH_4663_EXTERNAL_DISTRIBUTION_ENABLED',
            'RH_4663_CAMPAIGN_REHEARSAL_ENABLED']:
    env[key] = 'false'
env['MONITOR_MODE'] = 'disabled'
if os.environ.get('RADAR_QUALIFICATION_DATABASE_URL'):
    env['RADAR_QUALIFICATION_DATABASE_URL'] = os.environ['RADAR_QUALIFICATION_DATABASE_URL']
if args.node_bin:
    env['PATH'] = args.node_bin + os.pathsep + env['PATH']
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
expected_revision = os.environ.get('RADAR_CANDIDATE_SHA')
if not expected_revision or revision != expected_revision:
    raise RuntimeError('qualification_source_sha_mismatch')
if env.get('RADAR_QUALIFICATION_ALLOW_DISPOSABLE_POSTGRES') != 'true':
    raise RuntimeError('explicit_disposable_postgres_authorization_required')
if env.get('PGHOST', 'localhost') not in ['localhost', '127.0.0.1', '::1']:
    raise RuntimeError('qualification_postgres_must_be_localhost')
base_url = urlparse(env.get('RADAR_QUALIFICATION_DATABASE_URL', 'postgresql://localhost'))
if base_url.scheme not in ['postgres', 'postgresql'] or base_url.hostname not in ['localhost', '127.0.0.1', '::1'] or base_url.path not in ['', '/'] or base_url.query or base_url.fragment:
    raise RuntimeError('qualification_database_base_must_be_localhost_without_database')
# createdb/pg_dump use PG* bindings: they must reach the same disposable server as tests.
if base_url.port is not None and str(base_url.port) != env.get('PGPORT', '5432'):
    raise RuntimeError('qualification_postgres_port_mismatch')
node_version = subprocess.check_output(['node', '--version'], env=env, text=True).strip()
if node_version != 'v24.21.0':
    raise RuntimeError('qualification_requires_node_24_21_0')
server_version = subprocess.check_output(['psql', '-d', 'postgres', '-Atc', 'show server_version_num'], env=env, text=True).strip()
if not server_version.isdigit() or not 160000 <= int(server_version) < 170000:
    raise RuntimeError('qualification_requires_postgres_16')
for tool in ['psql', 'pg_dump', 'pg_restore']:
    if '(PostgreSQL) 16.' not in subprocess.check_output([tool, '--version'], env=env, text=True):
        raise RuntimeError('qualification_requires_postgres_16_client:' + tool)
if subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], text=True).strip():
    raise RuntimeError('qualification_requires_committed_clean_source')
name = 'unified_radar_' + uuid.uuid4().hex[:12]
database_url_base = env.get('RADAR_QUALIFICATION_DATABASE_URL', 'postgresql://localhost')
def database_url(database):
    return database_url_base.rstrip('/') + '/' + database
databases = [name, name + '_resilience', name + '_migration', name + '_restore']
created_databases = []
def cleanup_databases():
    for database in reversed(created_databases):
        # Only databases successfully created by this invocation are eligible for cleanup.
        subprocess.run(['dropdb', '--if-exists', database], env=env, check=False)
atexit.register(cleanup_databases)
for database in databases:
    subprocess.run(['createdb', database], env=env, check=True)
    created_databases.append(database)
env.update(NODE_ENV='test', RADAR_QUERY_TIMING_ENABLED='true', CANONICAL_RECEIPT_TEST_URL=database_url(name),
           ECONOMIC_ENGINE_TEST_URL=database_url(name),
           POSTGRES_RESILIENCE_TEST_URL=database_url(name + '_resilience'))
results = []

def run(label, command, scoped_env=None, tolerated=False):
    started = time.monotonic()
    with (logs / (label + '.log')).open('w') as log:
        status = subprocess.run(command, env=scoped_env or env, stdout=log, stderr=subprocess.STDOUT).returncode
    results.append({'name': label, 'command': command, 'exit_code': status,
                    'elapsed_seconds': round(time.monotonic() - started, 3), 'raw_log': str((logs / (label + '.log')).resolve())})
    (out / 'check-results.json').write_text(json.dumps({'source_sha': revision, 'platform': platform.platform(), 'databases': databases, 'scope': 'disposable localhost only; no external payment or production data', 'checks': results}, indent=2) + '\n')
    print(label, status, flush=True)
    if status and not tolerated:
        raise RuntimeError(label + ' failed; see local raw log')
    return logs / (label + '.log')

def postgres_tool(tool, arguments):
    image = env.get('RADAR_PG_CLIENT_CONTAINER')
    if not image:
        return [tool, *arguments]
    command = ['docker', 'run', '--rm', '-v', str(root) + ':/workspace', '-v', str(logs.resolve()) + ':/radar-evidence', '-e', 'PGHOST=host.docker.internal', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGPASSWORD']
    if platform.system() == 'Linux':
        command.extend(['--add-host=host.docker.internal:host-gateway'])
    command.extend([image, tool])
    for argument in arguments:
        if argument.startswith('--file='):
            argument = '--file=/radar-evidence/' + str(Path(argument[7:]).resolve().relative_to(logs.resolve()))
        elif argument.startswith('--dbname=') and '://' in argument:
            raise RuntimeError('postgres_tool_command_must_not_embed_database_credentials')
        elif argument.startswith('/'):
            argument = '/radar-evidence/' + str(Path(argument).resolve().relative_to(logs.resolve()))
        command.append(argument)
    return command

run('runtime', ['node', '--version'])
run('typecheck', ['npm', 'run', 'typecheck'])
run('lint', ['npm', 'run', 'lint'])
run('build', ['npm', 'run', 'build'], dict(env, NODE_ENV='production'))
run('migration-inventory', ['npm', 'run', 'migrations:validate'])
report = logs / 'full-tests.json'
run('full-tests', ['npm', 'test', '--', '--maxWorkers=1', '--testTimeout=30000', '--reporter=default', '--reporter=json', '--outputFile=' + str(report)])
full = json.loads(report.read_text())
summary = {key: full[key] for key in ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'success']}
summary['skipped_tests'] = [{'file': str(Path(item['name']).relative_to(root)), 'name': assertion['fullName'], 'status': assertion['status']} for item in full['testResults'] for assertion in item['assertionResults'] if assertion['status'] in ['pending', 'skipped', 'todo']]
summary['files'] = [{'name': str(Path(item['name']).relative_to(root)), 'status': item['status'], 'tests': len(item['assertionResults'])} for item in full['testResults']]
(out / 'full-test-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
for label, command in [('audit-production', ['npm', 'audit', '--omit=dev', '--json']), ('audit-all', ['npm', 'audit', '--json'])]:
    log = run(label, command, tolerated=(label == 'audit-all'))
    shutil.copyfile(log, out / (label + '.json'))
# Apply/check/repeat the whole inventory to a separate fresh database.
migration_env = dict(env, DATABASE_URL=database_url(name + '_migration'))
run('runtime-config', ['npm', 'run', 'verify:runtime-config'], dict(migration_env, NODE_ENV='production', PORT='10000',
    RADAR_CONTROLLED_STAGING='true', PAYSH_CATALOG_SOURCE='live', PAY_SH_CATALOG_URL='https://catalog.invalid/providers',
    PAYSH_ALLOW_FIXTURE_FALLBACK='false', PAYSH_BOOTSTRAP_ENABLED='false', INGESTION_ENABLED='false',
    JUDGMENT_PAYMENT_ENABLED='false', MACHINE_EXECUTION_ENABLED='false', MONITOR_ENABLED='false', MONITOR_MODE='disabled'))
for label, extra in [('migration-first', []), ('migration-check', ['--validate']), ('migration-repeat', [])]:
    log = run(label, ['node', 'dist/server/cli/runPostgresMigrations.js'] + extra, migration_env)
    shutil.copyfile(log, out / (label + '.json'))
recovery_env = dict(env, CANONICAL_RECEIPT_TEST_URL=migration_env['DATABASE_URL'])
run('recovery-seed', ['node', '--import', 'tsx', 'scripts/qualify-unified-radar-recovery.mjs', 'seed'], recovery_env)
# pg_dump and pg_restore never see an existing database or production connection string.
backup = logs / 'local-recovery.dump'
run('backup', postgres_tool('pg_dump', ['--format=custom', '--no-owner', '--file=' + str(backup), name + '_migration']))
run('restore', postgres_tool('pg_restore', ['--no-owner', '--dbname=' + name + '_restore', str(backup)]))
run('recovery-verify', ['node', '--import', 'tsx', 'scripts/qualify-unified-radar-recovery.mjs', 'verify'], dict(recovery_env, CANONICAL_RECEIPT_TEST_URL=database_url(name + '_restore')))
for filename in ['phase2-judgment-performance.json', 'phase2-judgment-postgres-performance.json']:
    if (root / 'output' / filename).exists():
        shutil.copyfile(root / 'output' / filename, out / filename)
run('diff-check', ['git', 'diff', '--check'])
# The names and artifacts remain reviewable; remove only DBs created by this invocation.
cleanup_databases()
created_databases.clear()
artifacts = []
for directory in [out, logs]:
    for artifact in sorted(directory.rglob('*')):
        if artifact.is_file() and artifact.name != 'artifact-manifest.json':
            artifacts.append({'path': str(artifact.resolve()), 'sha256': hashlib.sha256(artifact.read_bytes()).hexdigest(), 'bytes': artifact.stat().st_size})
(out / 'artifact-manifest.json').write_text(json.dumps({'source_sha': revision, 'node_version': node_version, 'postgres_version_num': server_version, 'artifacts': artifacts}, indent=2) + '\n')
print('Qualification complete for', revision, flush=True)
