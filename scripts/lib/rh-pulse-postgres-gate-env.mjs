import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

export const RH_PULSE_GATE_POSTGRES_MAJOR = 14;
export const RH_PULSE_GATE_DATABASE = 'rh_pulse_gate';
export const RH_PULSE_GATE_PORT = 55_463;
export const RH_PULSE_GATE_USER = 'postgres';

const uid = typeof process.getuid === 'function' ? process.getuid() : 0;
export const RH_PULSE_GATE_BASE_DIR = join(
  tmpdir(),
  `infopunks-rh-pulse-postgres-${RH_PULSE_GATE_POSTGRES_MAJOR}-${uid}`
);
export const RH_PULSE_GATE_DATA_DIR = join(RH_PULSE_GATE_BASE_DIR, 'data');
export const RH_PULSE_GATE_SOCKET_DIR = join('/tmp', `rhp-pg${RH_PULSE_GATE_POSTGRES_MAJOR}-${uid}`);
export const RH_PULSE_GATE_LOG = join(RH_PULSE_GATE_BASE_DIR, 'postgres.log');
export const RH_PULSE_GATE_DATABASE_URL = (
  `postgresql://${RH_PULSE_GATE_USER}@127.0.0.1:${RH_PULSE_GATE_PORT}/${RH_PULSE_GATE_DATABASE}`
);
export const RH_PULSE_GATE_ADMIN_URL = (
  `postgresql://${RH_PULSE_GATE_USER}@127.0.0.1:${RH_PULSE_GATE_PORT}/postgres`
);

export function assertSafeGateDatabaseUrl(value) {
  const parsed = new URL(value);
  const safe = parsed.protocol === 'postgresql:'
    && parsed.hostname === '127.0.0.1'
    && parsed.port === String(RH_PULSE_GATE_PORT)
    && parsed.username === RH_PULSE_GATE_USER
    && parsed.password === ''
    && parsed.pathname === `/${RH_PULSE_GATE_DATABASE}`
    && parsed.search === ''
    && parsed.hash === '';
  if (!safe) {
    throw new Error(
      `Refusing ambiguous RH Pulse gate database URL. Expected exactly ${RH_PULSE_GATE_DATABASE_URL}`
    );
  }
  return value;
}

export function assertPinnedPostgres() {
  const output = runCapture('postgres', ['--version']);
  const match = output.match(/PostgreSQL\)\s+(\d+)\./i) ?? output.match(/PostgreSQL\s+(\d+)\./i);
  const major = Number(match?.[1]);
  if (major !== RH_PULSE_GATE_POSTGRES_MAJOR) {
    throw new Error(
      `RH Pulse gate requires PostgreSQL ${RH_PULSE_GATE_POSTGRES_MAJOR}.x; detected ${output.trim()}`
    );
  }
  return output.trim();
}

export function gateClusterStatus() {
  if (!existsSync(join(RH_PULSE_GATE_DATA_DIR, 'PG_VERSION'))) return 'absent';
  try {
    execFileSync('pg_ctl', ['-D', RH_PULSE_GATE_DATA_DIR, 'status'], { stdio: 'ignore' });
    return 'running';
  } catch {
    return 'stopped';
  }
}

export function startGateCluster() {
  const version = assertPinnedPostgres();
  assertSafeGatePath(RH_PULSE_GATE_BASE_DIR);
  mkdirSync(RH_PULSE_GATE_BASE_DIR, { recursive: true });
  mkdirSync(RH_PULSE_GATE_SOCKET_DIR, { recursive: true });
  if (!existsSync(join(RH_PULSE_GATE_DATA_DIR, 'PG_VERSION'))) {
    run('initdb', [
      '-D', RH_PULSE_GATE_DATA_DIR,
      '--auth-local=trust',
      '--auth-host=trust',
      '--encoding=UTF8',
      '--locale=C',
      `--username=${RH_PULSE_GATE_USER}`
    ]);
  }
  const initializedMajor = Number(readFileSync(join(RH_PULSE_GATE_DATA_DIR, 'PG_VERSION'), 'utf8').trim());
  if (initializedMajor !== RH_PULSE_GATE_POSTGRES_MAJOR) {
    throw new Error(`Refusing PostgreSQL data directory with major version ${initializedMajor}`);
  }
  if (gateClusterStatus() !== 'running') {
    run('pg_ctl', [
      '-D', RH_PULSE_GATE_DATA_DIR,
      '-l', RH_PULSE_GATE_LOG,
      '-o', [
        `-p ${RH_PULSE_GATE_PORT}`,
        '-h 127.0.0.1',
        `-k ${RH_PULSE_GATE_SOCKET_DIR}`,
        '-c fsync=off',
        '-c synchronous_commit=off',
        '-c full_page_writes=off',
        '-c max_connections=200'
      ].join(' '),
      '-w',
      'start'
    ]);
  }
  ensureGateDatabase();
  return { version, databaseUrl: RH_PULSE_GATE_DATABASE_URL, dataDir: RH_PULSE_GATE_DATA_DIR };
}

export function resetGateDatabase() {
  requireRunning();
  assertSafeGateDatabaseUrl(RH_PULSE_GATE_DATABASE_URL);
  run('psql', [
    RH_PULSE_GATE_ADMIN_URL,
    '-v', 'ON_ERROR_STOP=1',
    '-c', `select pg_terminate_backend(pid) from pg_stat_activity where datname='${RH_PULSE_GATE_DATABASE}' and pid <> pg_backend_pid()`,
    '-c', `drop database if exists ${RH_PULSE_GATE_DATABASE}`,
    '-c', `create database ${RH_PULSE_GATE_DATABASE}`
  ]);
}

export function stopGateCluster({ destroy = false } = {}) {
  assertSafeGatePath(RH_PULSE_GATE_BASE_DIR);
  if (gateClusterStatus() === 'running') {
    run('pg_ctl', ['-D', RH_PULSE_GATE_DATA_DIR, '-m', 'fast', '-w', 'stop']);
  }
  if (destroy && existsSync(RH_PULSE_GATE_BASE_DIR)) {
    rmSync(RH_PULSE_GATE_BASE_DIR, { recursive: true, force: true });
  }
  if (destroy && existsSync(RH_PULSE_GATE_SOCKET_DIR)) {
    const expectedSocketDir = `/tmp/rhp-pg${RH_PULSE_GATE_POSTGRES_MAJOR}-${uid}`;
    if (RH_PULSE_GATE_SOCKET_DIR !== expectedSocketDir) {
      throw new Error(`Refusing unsafe RH Pulse socket path: ${RH_PULSE_GATE_SOCKET_DIR}`);
    }
    rmSync(RH_PULSE_GATE_SOCKET_DIR, { recursive: true, force: true });
  }
}

function ensureGateDatabase() {
  const exists = runCapture('psql', [
    RH_PULSE_GATE_ADMIN_URL,
    '-v', 'ON_ERROR_STOP=1',
    '-tAc', `select 1 from pg_database where datname='${RH_PULSE_GATE_DATABASE}'`
  ]).trim() === '1';
  if (!exists) run('createdb', ['--maintenance-db', RH_PULSE_GATE_ADMIN_URL, RH_PULSE_GATE_DATABASE]);
}

function requireRunning() {
  if (gateClusterStatus() !== 'running') {
    throw new Error('RH Pulse gate PostgreSQL cluster is not running');
  }
}

function assertSafeGatePath(value) {
  const absolute = resolve(value);
  const expected = resolve(RH_PULSE_GATE_BASE_DIR);
  const safePrefix = `infopunks-rh-pulse-postgres-${RH_PULSE_GATE_POSTGRES_MAJOR}-`;
  if (absolute !== expected || !absolute.startsWith(resolve(tmpdir())) || !basename(absolute).startsWith(safePrefix)) {
    throw new Error(`Refusing unsafe RH Pulse gate path: ${absolute}`);
  }
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function runCapture(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
