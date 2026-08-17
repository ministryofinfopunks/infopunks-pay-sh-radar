import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { closeDatabasePool, getDatabaseCircuitDiagnostics, getDatabasePool, PersistenceUnavailableError, probeDatabaseRecovery, resetDatabasePoolForTests } from '../src/persistence/databasePool';
import { PostgresRepository } from '../src/persistence/postgresRepository';
import { IntelligenceRepository, IntelligenceSnapshot } from '../src/persistence/repository';

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

class FailingRepository implements IntelligenceRepository {
  async loadSnapshot(): Promise<IntelligenceSnapshot | null> {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:5432') as Error & { code?: string };
    error.code = 'ECONNREFUSED';
    throw error;
  }

  async saveSnapshot(): Promise<void> {
    const error = new Error('Connection terminated unexpectedly');
    throw error;
  }
}

class UndefinedDiagnosticsRepository implements IntelligenceRepository {
  async loadSnapshot(): Promise<IntelligenceSnapshot | null> {
    return emptySnapshot();
  }

  async saveSnapshot(): Promise<void> {
    return;
  }

  getDbStatus(): 'ok' | 'degraded' | 'unavailable' {
    throw new Error('db diagnostics missing');
  }
}

class BoundDiagnosticsRepository implements IntelligenceRepository {
  private readonly status = 'ok' as const;
  async loadSnapshot(): Promise<IntelligenceSnapshot | null> { return emptySnapshot(); }
  async saveSnapshot(): Promise<void> { return; }
  getDbStatus() { return this.status; }
}

afterEach(async () => {
  await resetDatabasePoolForTests();
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_POOL_MAX;
  delete process.env.INGESTION_ENABLED;
  delete process.env.PAY_SH_INGEST_INTERVAL_MS;
  delete process.env.PAYSH_BOOTSTRAP_ENABLED;
});

describe('postgres resilience', () => {
  it('boots in memory mode with live liveness and degraded readiness', async () => {
    delete process.env.DATABASE_URL;
    const app = await createApp();
    try {
      const healthz = await app.inject({ method: 'GET', url: '/healthz' });
      expect(healthz.statusCode).toBe(200);
      expect(healthz.json()).toMatchObject({ ok: true, status: 'live' });

      const readyz = await app.inject({ method: 'GET', url: '/readyz' });
      expect(readyz.statusCode).toBe(200);
      expect(readyz.json()).toMatchObject({
        ok: true,
        status: 'degraded',
        persistence: 'memory',
        dbMode: 'memory',
        dbCircuitState: 'degraded'
      });
    } finally { await app.close(); }
  });

  it('initializes one shared pool and honors DATABASE_POOL_MAX', async () => {
    process.env.DATABASE_POOL_MAX = '2';
    const first = getDatabasePool({ connectionString: 'postgres://example:test@localhost:5432/test', max: 2 });
    const second = getDatabasePool({ connectionString: 'postgres://example:test@localhost:5432/test', max: 2 });
    expect(second).toBe(first);
    expect(getDatabaseCircuitDiagnostics()).toMatchObject({ dbMode: 'postgres', databasePoolMax: 2 });
  });

  it('preserves repository method binding when reading health diagnostics', async () => {
    process.env.DATABASE_URL = 'postgres://example:test@localhost:5432/test';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';
    const app = await createApp(emptySnapshot(), new BoundDiagnosticsRepository());
    try {
      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json().db_status).toBe('ok');
    } finally { await app.close(); }
  });

  it('handles pool error events without throwing', () => {
    const repo = new PostgresRepository('postgres://example:test@localhost:5432/test');
    const pool = (repo as unknown as { pool: { emit: (event: string, error: Error) => boolean } }).pool;
    const emitted = pool.emit('error', new Error('Connection terminated unexpectedly'));
    expect(emitted).toBe(true);
    expect(repo.getDbStatus()).toBe('degraded');
  });

  it('contains idle-client pool failures without invoking the process fatal path', async () => {
    process.env.DATABASE_URL = 'postgres://example:test@localhost:5432/test';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const app = await createApp(emptySnapshot());
    try {
      const pool = getDatabasePool({ connectionString: process.env.DATABASE_URL, max: 10 });
      const error = new Error('Connection terminated unexpectedly') as Error & { code?: string };
      error.code = 'ECONNRESET';
      expect(pool.emit('error', error)).toBe(true);

      const healthz = await app.inject({ method: 'GET', url: '/healthz' });
      const readyz = await app.inject({ method: 'GET', url: '/readyz' });
      expect(healthz.statusCode).toBe(200);
      expect(readyz.statusCode).toBe(200);
      expect(readyz.json().dbCircuitState).not.toBe('healthy');
      expect(exitSpy).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('does not crash startup and keeps /health and /v1/pulse available when db is unavailable', async () => {
    process.env.DATABASE_URL = 'postgres://example:test@localhost:5432/test';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'true';
    const app = await createApp(undefined, new FailingRepository());

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().ok).toBe(true);

    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse' });
    expect(pulse.statusCode).toBe(200);
    expect(pulse.json().data).toBeTruthy();
    expect(health.json().db_status === 'degraded' || health.json().db_status === 'unavailable').toBe(true);
    expect(health.json().persistence_mode).toBe('postgres');

    const benchmarks = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks' });
    expect(benchmarks.statusCode).toBe(200);
    expect(Array.isArray(benchmarks.json().data.benchmarks)).toBe(true);

    const summary = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-summary' });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().data).toBeTruthy();

    const artifacts = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-artifacts' });
    expect(artifacts.statusCode).toBe(200);
    expect(Array.isArray(artifacts.json().data.artifacts)).toBe(true);

    const mappings = await app.inject({ method: 'GET', url: '/v1/radar/mappings' });
    expect(mappings.statusCode).toBe(200);
    expect(Array.isArray(mappings.json().data.mappings)).toBe(true);

    await app.close();
  });

  it('starts with DATABASE_URL configured when Postgres is unreachable and reports degraded readiness', async () => {
    process.env.DATABASE_URL = 'postgres://example:test@127.0.0.1:1/test';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'true';
    const app = await createApp();
    try {
      const healthz = await app.inject({ method: 'GET', url: '/healthz' });
      expect(healthz.statusCode).toBe(200);
      expect(healthz.json()).toMatchObject({ ok: true, status: 'live' });
      const readyz = await app.inject({ method: 'GET', url: '/readyz' });
      expect(readyz.statusCode).toBe(200);
      expect(readyz.json()).toMatchObject({ ok: true, status: 'degraded', persistence: 'postgres', dbMode: 'postgres' });
    } finally { await app.close(); }
  });

  it('releases checked-out clients and rolls back when the owning operation fails', async () => {
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql === 'begin') return { rows: [] };
      if (sql === 'rollback') return { rows: [] };
      if (sql.startsWith('insert into intelligence_snapshots')) {
        const error = new Error('Connection terminated unexpectedly') as Error & { code?: string };
        error.code = 'ECONNRESET';
        throw error;
      }
      return { rows: [] };
    });
    const pool = {
      on: vi.fn(),
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => ({ query, release }))
    };
    const repo = new PostgresRepository(pool as unknown as import('pg').Pool);
    await expect(repo.saveSnapshot(emptySnapshot())).rejects.toThrow('Connection terminated unexpectedly');
    expect(query).toHaveBeenCalledWith('rollback');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('opens the circuit after repeated database failures and fails fast without hammering Postgres', async () => {
    const pool = getDatabasePool({ connectionString: 'postgres://example:test@127.0.0.1:1/test', max: 2 });
    const error = new Error('Connection terminated unexpectedly') as Error & { code?: string };
    error.code = 'ECONNRESET';
    pool.emit('error', error);
    pool.emit('error', error);
    pool.emit('error', error);
    expect(getDatabaseCircuitDiagnostics()).toMatchObject({ dbCircuitState: 'circuit_open', consecutiveFailures: 3 });

    const startedAt = Date.now();
    await expect(pool.query('select 1')).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
    expect(Date.now() - startedAt).toBeLessThan(100);
  });

  it('returns a controlled 503 body for persistence-required operations while unavailable', async () => {
    const app = await createApp(emptySnapshot());
    app.get('/test/persistence-required', async () => {
      throw new PersistenceUnavailableError();
    });
    try {
      const response = await app.inject({ method: 'GET', url: '/test/persistence-required' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: 'persistence_unavailable', code: 'persistence_unavailable' });
    } finally { await app.close(); }
  });

  it('recovers through a bounded SELECT 1 probe', async () => {
    vi.useFakeTimers();
    getDatabasePool({ connectionString: 'postgres://example:test@127.0.0.1:1/test', max: 2 });
    const error = new Error('terminating connection due to administrator command') as Error & { code?: string };
    error.code = '57P01';
    const pool = getDatabasePool({ connectionString: 'postgres://example:test@127.0.0.1:1/test', max: 2 });
    pool.emit('error', error);
    pool.emit('error', error);
    pool.emit('error', error);
    vi.advanceTimersByTime(31_000);

    const probePool = { query: vi.fn(async () => ({ rows: [{ '?column?': 1 }] })) };
    await expect(probeDatabaseRecovery(probePool as unknown as import('pg').Pool)).resolves.toBe(true);
    expect(probePool.query).toHaveBeenCalledWith('select 1', []);
    expect(getDatabaseCircuitDiagnostics()).toMatchObject({ dbCircuitState: 'healthy', dbStatus: 'ok' });
  });

  it('keeps ingestion scheduler alive when repository writes fail', async () => {
    vi.useFakeTimers();
    process.env.INGESTION_ENABLED = 'true';
    process.env.PAY_SH_INGEST_INTERVAL_MS = '5';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = await createApp(emptySnapshot(), new FailingRepository());
    vi.advanceTimersByTime(20);
    await Promise.resolve();
    await Promise.resolve();

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().ok).toBe(true);
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('"event":"ingestion_db_write_failed"'))).toBe(true);

    await app.close();
  });

  it('closes the shared pool exactly once during shutdown', async () => {
    const pool = getDatabasePool({ connectionString: 'postgres://example:test@localhost:5432/test', max: 2 });
    const endSpy = vi.spyOn(pool, 'end').mockResolvedValue(undefined);
    await closeDatabasePool();
    await closeDatabasePool();
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps /health 200 with safe db fallbacks when diagnostics are undefined and benchmark routes still respond', async () => {
    process.env.DATABASE_URL = 'postgres://example:test@localhost:5432/test';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';
    const app = await createApp(emptySnapshot(), new UndefinedDiagnosticsRepository() as unknown as IntelligenceRepository);

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().ok).toBe(true);
    expect(['degraded', 'unavailable', 'ok']).toContain(health.json().db_status);
    expect(['degraded', 'unavailable', 'ok']).toContain(health.json().dbStatus);
    expect(health.json().persistence_mode).toBe('postgres');
    expect(health.json().persistence).toBe('postgres');

    const benchmarks = await app.inject({ method: 'GET', url: '/v1/radar/benchmarks' });
    expect(benchmarks.statusCode).toBe(200);
    const benchmarkSummary = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-summary' });
    expect(benchmarkSummary.statusCode).toBe(200);
    const benchmarkHistory = await app.inject({ method: 'GET', url: '/v1/radar/benchmark-history' });
    expect(benchmarkHistory.statusCode).toBe(200);

    await app.close();
  });
});
