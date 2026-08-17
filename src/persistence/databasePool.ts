import pg from 'pg';
import { classifyPostgresFailure, postgresErrorCode, safeOperationalErrorMessage } from './postgresErrors';

export type DatabaseCircuitState = 'healthy' | 'degraded' | 'circuit_open' | 'recovering';

export type DatabaseCircuitDiagnostics = {
  dbMode: 'postgres' | 'memory';
  dbStatus: 'ok' | 'degraded' | 'unavailable';
  dbCircuitState: DatabaseCircuitState;
  dbLastSuccessAt: string | null;
  dbLastFailureAt: string | null;
  consecutiveFailures: number;
  nextProbeAt: string | null;
  lastErrorCode: string | null;
  databasePoolMax: number | null;
};

export class PersistenceUnavailableError extends Error {
  readonly code = 'PERSISTENCE_UNAVAILABLE';
  readonly statusCode = 503;
  constructor(message = 'persistence_unavailable') {
    super(message);
    this.name = 'PersistenceUnavailableError';
  }
}

type PoolOptions = {
  connectionString: string;
  max: number;
};

type SharedPoolState = {
  pool: pg.Pool;
  connectionString: string;
  max: number;
  closePromise: Promise<void> | null;
};

const CONNECTION_TIMEOUT_MS = 2_500;
const IDLE_TIMEOUT_MS = 10_000;
const CIRCUIT_OPEN_FAILURES = 3;
const BASE_PROBE_DELAY_MS = 1_000;
const MAX_PROBE_DELAY_MS = 30_000;
const JITTER_MS = 250;

let sharedPool: SharedPoolState | null = null;
const rawPoolQueries = new WeakMap<pg.Pool, pg.Pool['query']>();
const rawPoolConnects = new WeakMap<pg.Pool, pg.Pool['connect']>();

class DatabaseCircuit {
  state: DatabaseCircuitState = 'degraded';
  lastSuccessAt: string | null = null;
  lastFailureAt: string | null = null;
  consecutiveFailures = 0;
  nextProbeAt: string | null = null;
  lastErrorCode: string | null = null;

  beforeOperation(operation: string) {
    if (this.state !== 'circuit_open') return;
    const nextProbeMs = this.nextProbeAt ? Date.parse(this.nextProbeAt) : 0;
    if (operation === 'recovery_probe' && Date.now() >= nextProbeMs) {
      this.state = 'recovering';
      logDatabaseEvent('database_recovery_probe_started', {
        circuit_state: this.state,
        consecutive_failures: this.consecutiveFailures,
        error_code: this.lastErrorCode
      });
      return;
    }
    throw new PersistenceUnavailableError();
  }

  recordSuccess(operation: string, elapsedMs: number) {
    const previousState = this.state;
    this.state = 'healthy';
    this.lastSuccessAt = new Date().toISOString();
    this.consecutiveFailures = 0;
    this.nextProbeAt = null;
    this.lastErrorCode = null;
    if (operation === 'recovery_probe') {
      logDatabaseEvent('database_recovery_probe_succeeded', { circuit_state: this.state, elapsed_ms: elapsedMs });
    }
    if (previousState !== 'healthy') {
      logDatabaseEvent('database_recovered', { previous_state: previousState, circuit_state: this.state, elapsed_ms: elapsedMs });
    }
  }

  recordFailure(error: unknown, operation: string, elapsedMs?: number) {
    this.lastFailureAt = new Date().toISOString();
    this.consecutiveFailures += 1;
    this.lastErrorCode = postgresErrorCode(error);
    const previousState = this.state;
    if (this.consecutiveFailures >= CIRCUIT_OPEN_FAILURES || this.state === 'recovering') {
      this.state = 'circuit_open';
      this.nextProbeAt = new Date(Date.now() + this.nextProbeDelayMs()).toISOString();
    } else {
      this.state = 'degraded';
    }
    logDatabaseEvent(operation === 'recovery_probe' ? 'database_recovery_probe_failed' : 'database_operation_failed', {
      operation,
      failure_kind: classifyPostgresFailure(error),
      error_code: this.lastErrorCode,
      error: safeOperationalErrorMessage(error),
      circuit_state: this.state,
      consecutive_failures: this.consecutiveFailures,
      elapsed_ms: elapsedMs
    });
    if (this.state === 'circuit_open' && previousState !== 'circuit_open') {
      logDatabaseEvent('database_circuit_opened', {
        error_code: this.lastErrorCode,
        circuit_state: this.state,
        consecutive_failures: this.consecutiveFailures,
        next_probe_at: this.nextProbeAt
      });
    }
  }

  diagnostics(poolMax: number | null): DatabaseCircuitDiagnostics {
    return {
      dbMode: poolMax === null ? 'memory' : 'postgres',
      dbStatus: poolMax === null ? 'degraded' : this.state === 'healthy' ? 'ok' : this.state === 'circuit_open' ? 'unavailable' : 'degraded',
      dbCircuitState: poolMax === null ? 'degraded' : this.state,
      dbLastSuccessAt: this.lastSuccessAt,
      dbLastFailureAt: this.lastFailureAt,
      consecutiveFailures: this.consecutiveFailures,
      nextProbeAt: this.nextProbeAt,
      lastErrorCode: this.lastErrorCode,
      databasePoolMax: poolMax
    };
  }

  private nextProbeDelayMs() {
    const exponential = BASE_PROBE_DELAY_MS * (2 ** Math.min(8, Math.max(0, this.consecutiveFailures - CIRCUIT_OPEN_FAILURES)));
    return Math.min(MAX_PROBE_DELAY_MS, exponential) + Math.floor(Math.random() * JITTER_MS);
  }
}

const circuit = new DatabaseCircuit();

export function parseDatabasePoolMax(value: string | undefined, defaultValue = 10) {
  const parsed = value === undefined || value.trim() === '' ? defaultValue : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) throw new Error('DATABASE_POOL_MAX must be an integer from 1 to 20');
  return parsed;
}

export function getDatabasePool(options: PoolOptions): pg.Pool {
  if (sharedPool) {
    if (sharedPool.connectionString !== options.connectionString) throw new Error('database_pool_already_initialized_for_different_database');
    return sharedPool.pool;
  }
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    allowExitOnIdle: false
  });
  instrumentPool(pool);
  sharedPool = { pool, connectionString: options.connectionString, max: options.max, closePromise: null };
  logDatabaseEvent('database_pool_created', {
    database_pool_max: options.max,
    connection_timeout_ms: CONNECTION_TIMEOUT_MS,
    idle_timeout_ms: IDLE_TIMEOUT_MS
  });
  return pool;
}

export async function closeDatabasePool() {
  if (!sharedPool) return;
  if (!sharedPool.closePromise) {
    const pool = sharedPool.pool;
    sharedPool.closePromise = pool.end().then(() => {
      logDatabaseEvent('database_pool_closed', {
        database_pool_max: sharedPool?.max ?? null,
        circuit_state: circuit.state
      });
      sharedPool = null;
    });
  }
  await sharedPool.closePromise;
}

export async function resetDatabasePoolForTests() {
  await closeDatabasePool();
  circuit.state = 'degraded';
  circuit.lastSuccessAt = null;
  circuit.lastFailureAt = null;
  circuit.consecutiveFailures = 0;
  circuit.nextProbeAt = null;
  circuit.lastErrorCode = null;
}

export async function installDatabasePoolForTests(pool: pg.Pool, options: PoolOptions) {
  if (process.env.NODE_ENV !== 'test') throw new Error('installDatabasePoolForTests is only available when NODE_ENV=test');
  await closeDatabasePool();
  instrumentPool(pool);
  sharedPool = { pool, connectionString: options.connectionString, max: options.max, closePromise: null };
  circuit.state = 'degraded';
  circuit.lastSuccessAt = null;
  circuit.lastFailureAt = null;
  circuit.consecutiveFailures = 0;
  circuit.nextProbeAt = null;
  circuit.lastErrorCode = null;
}

export function getDatabaseCircuitDiagnostics(): DatabaseCircuitDiagnostics {
  return circuit.diagnostics(sharedPool?.max ?? null);
}

export async function probeDatabaseRecovery(pool = sharedPool?.pool): Promise<boolean> {
  if (!pool) return false;
  const state = getDatabaseCircuitDiagnostics();
  if (state.dbCircuitState !== 'circuit_open' && state.dbCircuitState !== 'degraded') return state.dbCircuitState === 'healthy';
  try {
    await queryWithCircuit(pool, 'select 1', [], 'recovery_probe');
    return true;
  } catch {
    return false;
  }
}

export function recordDatabasePoolError(error: unknown) {
  circuit.recordFailure(error, 'idle_pool_client');
  logDatabaseEvent('database_pool_error', {
    failure_kind: classifyPostgresFailure(error),
    error_code: postgresErrorCode(error),
    error: safeOperationalErrorMessage(error),
    circuit_state: circuit.state,
    consecutive_failures: circuit.consecutiveFailures
  });
}

export function isPersistenceUnavailable(error: unknown) {
  return error instanceof PersistenceUnavailableError
    || Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'PERSISTENCE_UNAVAILABLE');
}

function instrumentPool(pool: pg.Pool) {
  const rawQuery = pool.query.bind(pool) as pg.Pool['query'];
  const rawConnect = pool.connect.bind(pool);
  rawPoolQueries.set(pool, rawQuery);
  rawPoolConnects.set(pool, rawConnect);
  pool.query = ((...args: Parameters<pg.Pool['query']>) => queryWithCircuit(pool, args[0], args[1], 'query', args)) as pg.Pool['query'];
  pool.connect = (async () => {
    circuit.beforeOperation('connect');
    const startedAt = Date.now();
    try {
      const client = await rawConnect();
      instrumentClient(client);
      circuit.recordSuccess('connect', Date.now() - startedAt);
      return client;
    } catch (error) {
      circuit.recordFailure(error, 'connect', Date.now() - startedAt);
      throw error;
    }
  }) as pg.Pool['connect'];
  pool.on('error', (error) => {
    try {
      recordDatabasePoolError(error);
    } catch (listenerError) {
      logDatabaseEvent('database_pool_error', { error: safeOperationalErrorMessage(listenerError) });
    }
  });
}

async function queryWithCircuit(
  pool: pg.Pool,
  queryText: unknown,
  values: unknown,
  operation: string,
  rawArgs?: Parameters<pg.Pool['query']>
) {
  circuit.beforeOperation(operation);
  const startedAt = Date.now();
  const rawConnect = rawPoolConnects.get(pool);
  let client: pg.PoolClient | null = null;
  try {
    let result: unknown;
    if (rawConnect) {
      client = await rawConnect();
      result = rawArgs ? await client.query(...rawArgs) : await client.query(queryText as string, values as unknown[]);
    } else {
      const query = rawPoolQueries.get(pool) ?? (pool.query.bind(pool) as pg.Pool['query']);
      result = rawArgs ? await query(...rawArgs) : await query(queryText as string, values as unknown[]);
    }
    circuit.recordSuccess(operation, Date.now() - startedAt);
    return result;
  } catch (error) {
    circuit.recordFailure(error, operation, Date.now() - startedAt);
    throw error;
  } finally {
    client?.release();
  }
}

function instrumentClient(client: pg.PoolClient) {
  const marker = '__infopunksInstrumentedClient';
  if ((client as unknown as Record<string, boolean>)[marker]) return;
  (client as unknown as Record<string, boolean>)[marker] = true;
  const rawQuery = client.query.bind(client) as pg.PoolClient['query'];
  client.query = (async (...args: Parameters<pg.PoolClient['query']>) => {
    circuit.beforeOperation('client_query');
    const startedAt = Date.now();
    try {
      const result = await rawQuery(...args);
      circuit.recordSuccess('client_query', Date.now() - startedAt);
      return result;
    } catch (error) {
      circuit.recordFailure(error, 'client_query', Date.now() - startedAt);
      throw error;
    }
  }) as pg.PoolClient['query'];
}

function logDatabaseEvent(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...fields }));
}
