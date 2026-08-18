import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import {
  getDatabaseCircuitDiagnostics,
  getDatabasePool,
  installDatabasePoolForTests,
  PersistenceUnavailableError,
  probeDatabaseRecovery,
  resetDatabasePoolForTests
} from '../src/persistence/databasePool';
import type { IntelligenceRepository, IntelligenceSnapshot } from '../src/persistence/repository';
import type { RhChainAutomationJobName, RhChainAutomationRun, RhChainAutomationStore } from '../src/services/rhChainAutomationService';

const TEST_URL = 'postgres://radar:test@resilience.invalid:5432/radar';

function emptySnapshot(): IntelligenceSnapshot {
  return {
    events: [],
    providers: [],
    endpoints: [],
    trustAssessments: [],
    signalAssessments: [],
    narratives: [],
    ingestionRuns: [],
    monitorRuns: []
  };
}

class MatrixClient extends EventEmitter {
  readonly id: number;
  release!: (error?: Error | boolean) => void;
  releaseCalls = 0;

  constructor(private readonly pool: MatrixPool, id: number) {
    super();
    this.id = id;
  }

  prepareForCheckout() {
    this.release = (error?: Error | boolean) => {
      this.releaseCalls += 1;
      this.pool.releaseClient(this, error);
    };
  }

  async query(_sql?: string, _values?: unknown[]) {
    this.pool.queryCount += 1;
    if (this.pool.queryDelayMs) await new Promise((resolve) => setTimeout(resolve, this.pool.queryDelayMs));
    if (this.pool.queryError) throw this.pool.queryError;
    return { rows: [{ ok: 1 }], rowCount: 1 };
  }
}

class MatrixPool extends EventEmitter {
  connectCount = 0;
  queryCount = 0;
  releaseCount = 0;
  discardedCount = 0;
  endCount = 0;
  queryDelayMs = 0;
  connectError: unknown = null;
  queryError: unknown = null;
  readonly clients: MatrixClient[] = [];
  readonly idleClients: MatrixClient[] = [];
  readonly checkedOutClients = new Set<MatrixClient>();

  async query(sql: string, values?: unknown[]) {
    const client = await this.connect();
    try {
      return await client.query(sql, values);
    } finally {
      client.release();
    }
  }

  async connect() {
    this.connectCount += 1;
    if (this.connectError) throw this.connectError;
    const client = this.idleClients.shift() ?? new MatrixClient(this, this.clients.length + 1);
    if (!this.clients.includes(client)) this.clients.push(client);
    client.prepareForCheckout();
    this.checkedOutClients.add(client);
    return client;
  }

  releaseClient(client: MatrixClient, error?: Error | boolean) {
    this.releaseCount += 1;
    this.checkedOutClients.delete(client);
    if (error) {
      this.discardedCount += 1;
      return;
    }
    this.idleClients.push(client);
  }

  async end() {
    this.endCount += 1;
  }
}

class PersistentlyFailingRepository implements IntelligenceRepository {
  async loadSnapshot(): Promise<IntelligenceSnapshot | null> {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:5432') as Error & { code?: string };
    error.code = 'ECONNREFUSED';
    throw error;
  }
  async saveSnapshot() {
    throw new PersistenceUnavailableError();
  }
}

class FailingAutomationStore implements RhChainAutomationStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  readonly runs: RhChainAutomationRun[] = [];
  async tryAcquireLock(): Promise<boolean> {
    throw new PersistenceUnavailableError();
  }
  async releaseLock() {}
  async saveRun(run: RhChainAutomationRun) {
    this.runs.push(structuredClone(run));
  }
  async listRuns() {
    return this.runs.map((run) => structuredClone(run));
  }
  async saveDraft() {
    throw new PersistenceUnavailableError();
  }
}

const envKeys = [
  'DATABASE_URL',
  'DATABASE_POOL_MAX',
  'PAYSH_BOOTSTRAP_ENABLED',
  'INGESTION_ENABLED',
  'PAY_SH_INGEST_INTERVAL_MS',
  'MONITOR_ENABLED',
  'MONITOR_INTERVAL_MS',
  'MONITOR_TIMEOUT_MS',
  'MONITOR_MAX_PROVIDERS',
  'RH_CHAIN_AUTOMATION_ENABLED',
  'RH_CHAIN_CHAIN_PULSE_INTERVAL_MS',
  'RH_CHAIN_MEME_PULSE_INTERVAL_MS',
  'RH_CHAIN_LAUNCHPAD_INTERVAL_MS',
  'RH_4663_PHASE2_ENABLED',
  'RH_4663_PHASE3_ENABLED',
  'RH_4663_PHASE3_INGESTION_ENABLED',
  'RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED',
  'RH_4663_PHASE3_PUBLICATION_ENABLED',
  'RH_4663_AUTO_PUBLICATION_ENABLED',
  'RH_4663_EXTERNAL_DISTRIBUTION_ENABLED',
  'RH_4663_PHASE3_INTERVAL_MS'
] as const;
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

afterEach(async () => {
  await resetDatabasePoolForTests();
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const key of envKeys) {
    const original = originalEnv.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

async function createPoolBackedApp(pool: MatrixPool) {
  process.env.DATABASE_URL = TEST_URL;
  process.env.DATABASE_POOL_MAX = '2';
  process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';
  await installDatabasePoolForTests(pool as unknown as import('pg').Pool, { connectionString: TEST_URL, max: 2 });
  return createApp(emptySnapshot());
}

function operationalError(message: string, code?: string) {
  const error = new Error(message) as Error & { code?: string };
  if (code) error.code = code;
  return error;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('PostgreSQL resilience failure matrix', () => {
  it('covers startup modes: no DATABASE_URL, invalid URL, unreachable host, and healthy DB', async () => {
    delete process.env.DATABASE_URL;
    let app = await createApp(emptySnapshot());
    expect((await app.inject({ method: 'GET', url: '/healthz' })).json()).toMatchObject({ status: 'live' });
    expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'degraded', dbMode: 'memory' });
    await app.close();

    process.env.DATABASE_URL = 'not-a-postgres-url';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';
    app = await createApp(emptySnapshot());
    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'degraded', dbMode: 'postgres' });
    await app.close();
    await resetDatabasePoolForTests();

    process.env.DATABASE_URL = 'postgres://radar:test@127.0.0.1:1/radar';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';
    app = await createApp(emptySnapshot());
    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'degraded', dbMode: 'postgres' });
    await app.close();
    await resetDatabasePoolForTests();

    const pool = new MatrixPool();
    app = await createPoolBackedApp(pool);
    await vi.waitFor(() => expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy'));
    expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'healthy', db_status: 'ok', dbCircuitState: 'healthy' });
    expect(pool.connectCount).toBeGreaterThan(0);
    expect(pool.releaseCount).toBe(pool.connectCount);
    await app.close();
  });

  it('reproduces the historical idle pool termination without process death', async () => {
    const pool = new MatrixPool();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const uncaughtSpy = vi.fn();
    process.on('uncaughtException', uncaughtSpy);
    const app = await createPoolBackedApp(pool);
    try {
      await vi.waitFor(() => expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy'));
      pool.emit('error', new Error('Connection terminated unexpectedly'));
      expect(getDatabaseCircuitDiagnostics()).toMatchObject({ dbCircuitState: 'degraded', dbStatus: 'degraded' });
      expect(exitSpy).not.toHaveBeenCalled();
      expect(uncaughtSpy).not.toHaveBeenCalled();
      expect((await app.inject({ method: 'GET', url: '/healthz' })).json()).toMatchObject({ status: 'live' });
      expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'degraded', dbMode: 'postgres' });
      expect((await app.inject({ method: 'GET', url: '/v1/pulse' })).statusCode).toBe(200);
    } finally {
      process.off('uncaughtException', uncaughtSpy);
      await app.close();
    }
  });

  it('contains a checked-out client error event, discards that client, and recovers without a restart', async () => {
    const pool = new MatrixPool();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const processEmitSpy = vi.spyOn(process, 'emit');
    const app = await createPoolBackedApp(pool);
    try {
      await vi.waitFor(() => expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy'));
      const client = await getDatabasePool({ connectionString: TEST_URL, max: 2 }).connect() as unknown as MatrixClient;
      const checkoutListenerCount = client.listenerCount('error');
      const releasesBeforeFailure = client.releaseCalls;
      expect(pool.checkedOutClients).toContain(client);

      expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
      expect(getDatabaseCircuitDiagnostics()).toMatchObject({ dbCircuitState: 'degraded', dbLastFailureAt: expect.any(String) });
      await expect(client.query('select must_not_succeed_after_checked_out_client_error')).rejects.toThrow('Connection terminated unexpectedly');
      expect(exitSpy).not.toHaveBeenCalled();
      expect(processEmitSpy.mock.calls.some(([event]) => event === 'uncaughtException')).toBe(false);
      expect(processEmitSpy.mock.calls.some(([event]) => event === 'unhandledRejection')).toBe(false);
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'degraded', dbMode: 'postgres' });
      expect(client.listenerCount('error')).toBe(checkoutListenerCount);

      client.release();
      expect(client.releaseCalls).toBe(releasesBeforeFailure + 1);
      expect(client.listenerCount('error')).toBe(0);
      expect(pool.discardedCount).toBe(1);
      expect(pool.idleClients).not.toContain(client);
      expect(pool.checkedOutClients).toHaveLength(0);

      await expect(probeDatabaseRecovery(pool as unknown as import('pg').Pool)).resolves.toBe(true);
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select 1')).resolves.toMatchObject({ rowCount: 1 });
      expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy');
    } finally {
      await app.close();
    }
  });

  it('does not double-count an async client error racing a rejected query, and transaction cleanup remains safe', async () => {
    const pool = new MatrixPool();
    const app = await createPoolBackedApp(pool);
    try {
      await vi.waitFor(() => expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy'));
      const client = await getDatabasePool({ connectionString: TEST_URL, max: 2 }).connect() as unknown as MatrixClient;
      await client.query('begin');
      const failuresBeforeRace = getDatabaseCircuitDiagnostics().consecutiveFailures;
      pool.queryDelayMs = 5;
      pool.queryError = operationalError('Connection terminated unexpectedly');
      const activeQuery = client.query('insert into transaction_test values (1)');
      await Promise.resolve();
      expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
      await expect(activeQuery).rejects.toThrow('Connection terminated unexpectedly');
      expect(getDatabaseCircuitDiagnostics().consecutiveFailures).toBe(failuresBeforeRace + 1);

      await expect(client.query('rollback')).rejects.toThrow('Connection terminated unexpectedly');
      client.release();
      expect(pool.discardedCount).toBe(1);
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);

      pool.queryDelayMs = 0;
      pool.queryError = null;
      await expect(probeDatabaseRecovery(pool as unknown as import('pg').Pool)).resolves.toBe(true);
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select after_transaction')).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      await app.close();
    }
  });

  it('rejects active work and discards the connection when an async client error arrives during or after a query', async () => {
    const pool = new MatrixPool();
    const app = await createPoolBackedApp(pool);
    try {
      await vi.waitFor(() => expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy'));
      const duringQuery = await getDatabasePool({ connectionString: TEST_URL, max: 2 }).connect() as unknown as MatrixClient;
      pool.queryDelayMs = 5;
      const activeQuery = duringQuery.query('select active_query');
      await Promise.resolve();
      expect(() => duringQuery.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
      await expect(activeQuery).rejects.toThrow('Connection terminated unexpectedly');
      duringQuery.release();
      expect(pool.discardedCount).toBe(1);

      pool.queryDelayMs = 0;
      await expect(probeDatabaseRecovery(pool as unknown as import('pg').Pool)).resolves.toBe(true);
      const afterQuery = await getDatabasePool({ connectionString: TEST_URL, max: 2 }).connect() as unknown as MatrixClient;
      await expect(afterQuery.query('select completed_query')).resolves.toMatchObject({ rowCount: 1 });
      expect(() => afterQuery.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
      afterQuery.release();
      expect(pool.discardedCount).toBe(2);
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);

      await expect(probeDatabaseRecovery(pool as unknown as import('pg').Pool)).resolves.toBe(true);
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select recovered_again')).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      await app.close();
    }
  });

  it('cleans listeners across healthy and broken checkout cycles without recycling broken clients', async () => {
    const pool = new MatrixPool();
    await installDatabasePoolForTests(pool as unknown as import('pg').Pool, { connectionString: TEST_URL, max: 2 });

    const healthyClient = await getDatabasePool({ connectionString: TEST_URL, max: 2 }).connect() as unknown as MatrixClient;
    expect(healthyClient.listenerCount('error')).toBe(1);
    await expect(healthyClient.query('select healthy')).resolves.toMatchObject({ rowCount: 1 });
    healthyClient.release();
    expect(healthyClient.listenerCount('error')).toBe(0);
    expect(pool.idleClients).toContain(healthyClient);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const client = await getDatabasePool({ connectionString: TEST_URL, max: 2 }).connect() as unknown as MatrixClient;
      const releasesBefore = client.releaseCalls;
      expect(client.listenerCount('error')).toBe(1);
      expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
      expect(() => client.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
      client.release();
      client.release();
      expect(client.releaseCalls).toBe(releasesBefore + 1);
      expect(client.listenerCount('error')).toBe(0);
      expect(pool.idleClients).not.toContain(client);
      await expect(probeDatabaseRecovery(pool as unknown as import('pg').Pool)).resolves.toBe(true);
    }

    expect(pool.discardedCount).toBe(3);
    await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select final_healthy_operation')).resolves.toMatchObject({ rowCount: 1 });
    await resetDatabasePoolForTests();
    expect(pool.endCount).toBe(1);
  });

  it('contains checked-out termination, reset, connection timeout, and query timeout failures', async () => {
    const pool = new MatrixPool();
    const app = await createPoolBackedApp(pool);
    try {
      await vi.waitFor(() => expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy'));

      pool.queryError = operationalError('Connection terminated unexpectedly');
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).connect().then((client) => client.query('select 1').finally(() => client.release()))).rejects.toThrow('Connection terminated unexpectedly');
      expect(pool.releaseCount).toBe(pool.connectCount);
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      pool.queryError = null;
      await expect(probeDatabaseRecovery(pool as unknown as import('pg').Pool)).resolves.toBe(true);
      expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy');

      pool.queryError = operationalError('read ECONNRESET', 'ECONNRESET');
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select 1')).rejects.toThrow('read ECONNRESET');

      const discardedBeforeStatementTimeout = pool.discardedCount;
      pool.queryError = operationalError('canceling statement due to statement timeout', '57014');
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select pg_sleep(10)')).rejects.toThrow('statement timeout');
      expect(pool.discardedCount).toBe(discardedBeforeStatementTimeout);

      pool.connectError = operationalError('connection timeout', 'ETIMEDOUT');
      pool.queryError = null;
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select 1')).rejects.toThrow('connection timeout');
      expect((await app.inject({ method: 'GET', url: '/readyz' })).json().status).toBe('degraded');
    } finally {
      await app.close();
    }
  });

  it('opens the circuit, fails fast while open, limits probes under concurrency, recovers, then degrades again', async () => {
    vi.useFakeTimers();
    const pool = new MatrixPool();
    const app = await createPoolBackedApp(pool);
    try {
      await vi.waitFor(() => expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy'));
      const initialQueries = pool.queryCount;

      pool.emit('error', operationalError('Connection terminated unexpectedly'));
      pool.emit('error', operationalError('read ECONNRESET', 'ECONNRESET'));
      pool.emit('error', operationalError('terminating connection due to administrator command', '57P01'));
      expect(getDatabaseCircuitDiagnostics()).toMatchObject({ dbCircuitState: 'circuit_open', dbStatus: 'unavailable' });

      const openStartedAt = Date.now();
      const blocked = await Promise.allSettled(Array.from({ length: 50 }, () => getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select heavy')));
      expect(blocked.every((result) => result.status === 'rejected' && (result.reason as { code?: string }).code === 'PERSISTENCE_UNAVAILABLE')).toBe(true);
      expect(Date.now() - openStartedAt).toBeLessThan(100);
      expect(pool.queryCount).toBe(initialQueries);
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'degraded', dbCircuitState: 'circuit_open' });

      pool.queryDelayMs = 25;
      vi.advanceTimersByTime(31_000);
      const probeResultsPromise = Promise.all(Array.from({ length: 50 }, () => probeDatabaseRecovery(pool as unknown as import('pg').Pool)));
      await vi.advanceTimersByTimeAsync(25);
      const probeResults = await probeResultsPromise;
      expect(probeResults.filter(Boolean)).toHaveLength(1);
      expect(pool.queryCount).toBe(initialQueries + 1);
      expect(getDatabaseCircuitDiagnostics()).toMatchObject({ dbCircuitState: 'healthy', dbStatus: 'ok', consecutiveFailures: 0 });
      expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'healthy', dbCircuitState: 'healthy' });

      pool.queryDelayMs = 0;
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select next_operation')).resolves.toMatchObject({ rowCount: 1 });
      expect(pool.releaseCount).toBe(pool.connectCount);

      pool.emit('error', operationalError('Connection terminated unexpectedly'));
      pool.emit('error', operationalError('read ECONNRESET', 'ECONNRESET'));
      pool.emit('error', operationalError('connection timeout', 'ETIMEDOUT'));
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ status: 'degraded', dbCircuitState: 'circuit_open' });
    } finally {
      await app.close();
    }
  }, 10_000);

  it('soaks fail/recover/fail/recover without duplicate pools, probes, listeners, or leaked clients', async () => {
    vi.useFakeTimers();
    const pool = new MatrixPool();
    await installDatabasePoolForTests(pool as unknown as import('pg').Pool, { connectionString: TEST_URL, max: 2 });
    expect(getDatabasePool({ connectionString: TEST_URL, max: 2 })).toBe(pool);
    expect(pool.listenerCount('error')).toBe(1);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      pool.emit('error', operationalError('Connection terminated unexpectedly'));
      pool.emit('error', operationalError('read ECONNRESET', 'ECONNRESET'));
      pool.emit('error', operationalError('connection timeout', 'ETIMEDOUT'));
      expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('circuit_open');
      const beforeProbe = pool.queryCount;
      vi.advanceTimersByTime(31_000);
      await expect(probeDatabaseRecovery(pool as unknown as import('pg').Pool)).resolves.toBe(true);
      expect(pool.queryCount).toBe(beforeProbe + 1);
      await expect(getDatabasePool({ connectionString: TEST_URL, max: 2 }).query('select 1')).resolves.toMatchObject({ rowCount: 1 });
      expect(pool.releaseCount).toBe(pool.connectCount);
    }

    await resetDatabasePoolForTests();
    expect(pool.endCount).toBe(1);
  });

  it('returns controlled failure for durability-required writes when persistence is unavailable', async () => {
    const app = await createApp(emptySnapshot());
    app.post('/test/durable-write', async () => {
      throw new PersistenceUnavailableError();
    });
    try {
      const response = await app.inject({ method: 'POST', url: '/test/durable-write' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: 'persistence_unavailable', code: 'persistence_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('shuts down cleanly while the database circuit is degraded', async () => {
    const pool = new MatrixPool();
    const app = await createPoolBackedApp(pool);
    await vi.waitFor(() => expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy'));
    pool.emit('error', operationalError('Connection terminated unexpectedly'));
    pool.emit('error', operationalError('read ECONNRESET', 'ECONNRESET'));
    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    await expect(app.close()).resolves.toBeUndefined();
    expect(pool.endCount).toBe(1);
  });
});

describe('PostgreSQL failures in background schedulers', () => {
  it('isolates ingestion and monitor persistence failures without unhandled rejection', async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      process.env.INGESTION_ENABLED = 'true';
      process.env.PAY_SH_INGEST_INTERVAL_MS = '5';
      process.env.MONITOR_ENABLED = 'true';
      process.env.MONITOR_INTERVAL_MS = '5';
      process.env.MONITOR_TIMEOUT_MS = '100';
      process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';
      const app = await createApp(emptySnapshot(), new PersistentlyFailingRepository());
      vi.advanceTimersByTime(25);
      await flush();

      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      const logs = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logs).toContain('"event":"ingestion_db_write_failed"');
      expect(logs).toContain('"event":"monitor_job_failed"');
      expect(unhandled).toEqual([]);
      await app.close();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('isolates RH Chain automation and Phase 3 scheduler persistence failures', async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    try {
      const rhStore = new FailingAutomationStore();
      process.env.RH_CHAIN_AUTOMATION_ENABLED = 'true';
      process.env.RH_CHAIN_CHAIN_PULSE_INTERVAL_MS = '5';
      process.env.RH_CHAIN_MEME_PULSE_INTERVAL_MS = '5';
      process.env.RH_CHAIN_LAUNCHPAD_INTERVAL_MS = '5';
      process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';
      let app = await createApp(emptySnapshot(), undefined, { rhChainAutomationStore: rhStore });
      vi.advanceTimersByTime(20);
      await flush();
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect(rhStore.runs.some((run) => run.status === 'failed' && run.error_summary === 'persistence_unavailable')).toBe(true);
      expect(unhandled).toEqual([]);
      await app.close();

      const phase3Store = new FailingAutomationStore();
      process.env.RH_CHAIN_AUTOMATION_ENABLED = 'false';
      process.env.RH_4663_PHASE3_ENABLED = 'true';
      process.env.RH_4663_PHASE3_INGESTION_ENABLED = 'true';
      process.env.RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED = 'false';
      process.env.RH_4663_PHASE3_PUBLICATION_ENABLED = 'false';
      process.env.RH_4663_AUTO_PUBLICATION_ENABLED = 'false';
      process.env.RH_4663_EXTERNAL_DISTRIBUTION_ENABLED = 'false';
      process.env.RH_4663_PHASE3_INTERVAL_MS = '5';
      app = await createApp(emptySnapshot(), undefined, { rhChainAutomationStore: phase3Store });
      vi.advanceTimersByTime(20);
      await flush();
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect(phase3Store.runs.some((run) => run.job_name === 'rh_4663_intelligence_refresh' && run.status === 'failed')).toBe(true);
      expect(unhandled).toEqual([]);
      await app.close();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('process fatal boundary', () => {
  it('proves an actual pg.Client error is fatal when unguarded but safe after shared-pool checkout guarding', async () => {
    const unguarded = await runChildProgram(`
      import pg from 'pg';
      const client = new pg.Client();
      setImmediate(() => client.emit('error', new Error('Connection terminated unexpectedly')));
      setTimeout(() => console.log('UNGUARDED_CLIENT_UNEXPECTEDLY_SURVIVED'), 50);
    `);
    expect(unguarded).toMatchObject({ code: 1, signal: null });
    expect(unguarded.output).toContain('Connection terminated unexpectedly');
    expect(unguarded.output).not.toContain('UNGUARDED_CLIENT_UNEXPECTEDLY_SURVIVED');

    const databasePoolModule = join(process.cwd(), 'src', 'persistence', 'databasePool.ts');
    const guarded = await runChildProgram(`
      import { EventEmitter } from 'node:events';
      import pg from 'pg';
      import { getDatabasePool, installDatabasePoolForTests } from ${JSON.stringify(databasePoolModule)};

      class SingleClientPool extends EventEmitter {
        constructor() { super(); this.client = new pg.Client(); this.releaseCount = 0; this.destroyed = false; }
        async connect() {
          this.client.release = (error) => { this.releaseCount += 1; this.destroyed = Boolean(error); };
          return this.client;
        }
        async query() { return { rows: [], rowCount: 0 }; }
        async end() {}
      }

      void (async () => {
        const pool = new SingleClientPool();
        await installDatabasePoolForTests(pool, { connectionString: 'postgres://radar:test@resilience.invalid:5432/radar', max: 2 });
        const client = await getDatabasePool({ connectionString: 'postgres://radar:test@resilience.invalid:5432/radar', max: 2 }).connect();
        if (client.listenerCount('error') !== 1) throw new Error('checkout_error_listener_missing');
        setImmediate(() => client.emit('error', new Error('Connection terminated unexpectedly')));
        setTimeout(() => {
          client.release();
          if (pool.releaseCount !== 1 || !pool.destroyed || client.listenerCount('error') !== 0) throw new Error('guarded_client_cleanup_failed');
          console.log('GUARDED_CHECKED_OUT_PG_CLIENT_SURVIVED');
        }, 25);
      })().catch((error) => { console.error(error); process.exitCode = 1; });
    `);
    expect(guarded).toMatchObject({ code: 0, signal: null });
    expect(guarded.output).toContain('GUARDED_CHECKED_OUT_PG_CLIENT_SURVIVED');
    expect(guarded.output).toContain('database_checked_out_client_error');
  }, 10_000);

  it('keeps unrelated uncaught exceptions fatal in the real server entrypoint', async () => {
    const port = await freePort();
    const child = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['-e', `
      import './src/server.ts';
      setTimeout(() => { throw new Error('fatal_probe_unknown_runtime_error'); }, 300);
      setTimeout(() => {}, 5000);
    `], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(port),
        PAYSH_BOOTSTRAP_ENABLED: 'false',
        INGESTION_ENABLED: 'false',
        MONITOR_ENABLED: 'false',
        RH_CHAIN_AUTOMATION_ENABLED: 'false'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const output: string[] = [];
    child.stdout.on('data', (chunk) => output.push(String(chunk)));
    child.stderr.on('data', (chunk) => output.push(String(chunk)));
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.on('exit', (code, signal) => resolve({ code, signal }));
    });

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(output.join('')).toContain('"event":"uncaught_exception"');
    expect(output.join('')).toContain('fatal_probe_unknown_runtime_error');
  }, 10_000);
});

describe('optional real PostgreSQL checked-out-client termination', () => {
  it('contains a real node-postgres backend termination only when a safe test URL is explicitly supplied', async (context) => {
    const connectionString = process.env.POSTGRES_RESILIENCE_TEST_URL;
    if (!connectionString) {
      context.skip('POSTGRES_RESILIENCE_TEST_URL is not configured; real PostgreSQL termination harness is unsupported');
      return;
    }
    assertSafePostgresResilienceTestUrl(connectionString);

    const pool = getDatabasePool({ connectionString, max: 2 });
    const checkedOutClient = await pool.connect();
    const terminator = new pg.Client({ connectionString });
    let observedError: Error | null = null;
    const observeError = (error: Error) => { observedError = error; };
    checkedOutClient.once('error', observeError);
    try {
      expect(checkedOutClient.listenerCount('error')).toBeGreaterThanOrEqual(2);
      const pidResult = await checkedOutClient.query<{ pid: number }>('select pg_backend_pid() as pid');
      const pid = pidResult.rows[0]?.pid;
      if (!pid) throw new Error('postgres_test_backend_pid_missing');

      await terminator.connect();
      let terminated = false;
      try {
        const result = await terminator.query<{ terminated: boolean }>('select pg_terminate_backend($1) as terminated', [pid]);
        terminated = result.rows[0]?.terminated === true;
      } catch {
        context.skip('PostgreSQL test role cannot terminate a separate backend; real termination harness is unsupported');
      }
      if (!terminated) context.skip('PostgreSQL declined backend termination; real termination harness is unsupported');

      await vi.waitFor(() => expect(observedError).toBeInstanceOf(Error), { timeout: 5_000 });
      expect(getDatabaseCircuitDiagnostics()).toMatchObject({ dbCircuitState: 'degraded', dbLastFailureAt: expect.any(String) });
    } finally {
      checkedOutClient.removeListener('error', observeError);
      checkedOutClient.release();
      await terminator.end().catch(() => undefined);
    }

    expect(checkedOutClient.listenerCount('error')).toBe(0);
    await expect(probeDatabaseRecovery(pool)).resolves.toBe(true);
    await expect(pool.query('select 1')).resolves.toMatchObject({ rowCount: 1 });
    expect(getDatabaseCircuitDiagnostics().dbCircuitState).toBe('healthy');
  }, 15_000);
});

async function runChildProgram(source: string) {
  const child = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['-e', source], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output: string[] = [];
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
  return { ...result, output: output.join('') };
}

function assertSafePostgresResilienceTestUrl(connectionString: string) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('POSTGRES_RESILIENCE_TEST_URL must be a PostgreSQL URL');
  const host = url.hostname.toLowerCase();
  const isObviousRenderHost = host.includes('render.com') || host.includes('oregon-postgres');
  if (isObviousRenderHost && process.env.POSTGRES_RESILIENCE_TEST_ALLOW_UNSAFE_HOST !== 'true') {
    throw new Error('POSTGRES_RESILIENCE_TEST_URL refuses obvious Render PostgreSQL hosts without POSTGRES_RESILIENCE_TEST_ALLOW_UNSAFE_HOST=true');
  }
}

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('free_port_unavailable')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}
