import pg from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { PostgresRepository } from '../src/persistence/postgresRepository';
import { emptyIntelligenceStore, createIntelligenceStore, recomputeAssessments, runPayShIngestionWithOptions } from '../src/services/intelligenceStore';

const databaseUrl = process.env.RADAR_TEST_DATABASE_URL;
const describeWithLocalPostgres = databaseUrl && isLoopbackDatabase(databaseUrl) ? describe : describe.skip;

describeWithLocalPostgres('isolated PostgreSQL catalog persistence', () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const repository = new PostgresRepository(pool);

  afterAll(async () => { await pool.end(); });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects stale and invalid bootstrap data without snapshot writes, then restores accepted state and diagnostics', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAY_SH_CATALOG_URL', 'https://pay.sh/api/catalog');
    vi.stubEnv('PAYSH_CATALOG_SOURCE', 'live');
    vi.stubEnv('PAYSH_ALLOW_FIXTURE_FALLBACK', 'false');
    vi.stubEnv('INGESTION_ENABLED', 'false');
    vi.stubEnv('MONITOR_ENABLED', 'false');

    const accepted = applyPayShCatalogIngestion(emptyIntelligenceStore(), [catalogItem('Accepted Alpha')], {
      source: 'pay.sh:live-catalog:https://pay.sh/api/catalog',
      observedAt: '2026-01-01T00:05:00.000Z',
      dataSource: {
        mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog',
        generated_at: '2026-01-01T00:00:00.000Z', provider_count: 1,
        last_ingested_at: '2026-01-01T00:05:00.000Z', used_fixture: false, error: null
      }
    }).snapshot;
    await repository.saveSnapshot(recomputeAssessments(accepted));
    let store = await createIntelligenceStore(repository);

    const beforeSnapshotCount = await countRows(pool, 'intelligence_snapshots');
    const beforeRunCount = await countRows(pool, 'ingestion_runs');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      generated_at: '2020-01-01T00:00:00.000Z',
      providers: [{ fqn: 'rejected/stale', title: 'Stale', category: 'Data' }]
    })));
    const stale = await runPayShIngestionWithOptions(store, repository, { catalogSource: 'live', allowFixtureFallback: false });
    expect(stale).toMatchObject({ liveFetchFailed: true, usedFixture: false });
    expect(await countRows(pool, 'intelligence_snapshots')).toBe(beforeSnapshotCount);
    expect(await countRows(pool, 'ingestion_runs')).toBe(beforeRunCount + 1);
    expect(store.providers.map((provider) => provider.name)).toContain('Accepted Alpha');
    expect(store.dataSource?.last_ingested_at).toBe('2026-01-01T00:05:00.000Z');

    const staleRestore = await createIntelligenceStore(repository);
    expect(staleRestore.providers.map((provider) => provider.name)).toContain('Accepted Alpha');
    expect(staleRestore.dataSource).toMatchObject({ last_ingested_at: '2026-01-01T00:05:00.000Z', error: 'live_catalog_stale' });
    expect(staleRestore.ingestionRuns[0]).toMatchObject({ status: 'failed', error: 'live_catalog_stale' });

    store = staleRestore;
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ generated_at: new Date().toISOString(), providers: 'invalid' })));
    const invalid = await runPayShIngestionWithOptions(store, repository, { catalogSource: 'live', allowFixtureFallback: false });
    expect(invalid).toMatchObject({ liveFetchFailed: true, usedFixture: false });
    expect(await countRows(pool, 'intelligence_snapshots')).toBe(beforeSnapshotCount);
    expect(await countRows(pool, 'ingestion_runs')).toBe(beforeRunCount + 2);
    const invalidRestore = await createIntelligenceStore(repository);
    expect(invalidRestore.providers.map((provider) => provider.name)).toContain('Accepted Alpha');
    expect(invalidRestore.dataSource).toMatchObject({ last_ingested_at: '2026-01-01T00:05:00.000Z', error: 'live_catalog_empty_provider_array' });
    expect(invalidRestore.ingestionRuns.slice(0, 2).map((run) => run.error)).toEqual(['live_catalog_empty_provider_array', 'live_catalog_stale']);

  });

  it('runs the application bootstrap caller against PostgreSQL and records only a failed-attempt diagnostic', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('PAYSH_BOOTSTRAP_ENABLED', 'true');
    vi.stubEnv('PAYSH_CATALOG_SOURCE', 'live');
    vi.stubEnv('PAYSH_ALLOW_FIXTURE_FALLBACK', 'false');
    vi.stubEnv('PAY_SH_CATALOG_URL', 'https://pay.sh/api/catalog');
    vi.stubEnv('INGESTION_ENABLED', 'false');
    vi.stubEnv('MONITOR_ENABLED', 'false');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ generated_at: new Date().toISOString(), providers: 'invalid' })));

    const beforeSnapshots = await countRows(pool, 'intelligence_snapshots');
    const beforeRuns = await countRows(pool, 'ingestion_runs');
    const app = await createApp(emptyIntelligenceStore(), repository);
    try {
      await app.inject({ method: 'GET', url: '/v1/pulse' });
    } finally {
      await app.close();
    }
    expect(await countRows(pool, 'intelligence_snapshots')).toBe(beforeSnapshots);
    expect(await countRows(pool, 'ingestion_runs')).toBe(beforeRuns + 1);
    expect(await repository.loadIngestionRuns()).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'failed', error: 'live_catalog_empty_provider_array' })]));
  });

  it('persists and restores a valid update after failure, with a later success taking precedence', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PAYSH_CATALOG_SOURCE', 'live');
    vi.stubEnv('PAYSH_ALLOW_FIXTURE_FALLBACK', 'false');
    let store = await createIntelligenceStore(repository);
    const beforeSnapshots = await countRows(pool, 'intelligence_snapshots');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      generated_at: new Date().toISOString(), provider_count: 1,
      providers: [{ fqn: 'alpha', title: 'Accepted Alpha Updated', category: 'Data', description: 'Accepted update' }]
    })));

    const result = await runPayShIngestionWithOptions(store, repository, { catalogSource: 'live', allowFixtureFallback: false });
    expect(result).toMatchObject({ liveFetchFailed: false, run: { status: 'succeeded' } });
    expect(await countRows(pool, 'intelligence_snapshots')).toBe(beforeSnapshots + 1);
    store = await createIntelligenceStore(repository);
    expect(store.providers.map((provider) => provider.name)).toContain('Accepted Alpha Updated');
    expect(store.dataSource?.error).toBeNull();
    expect(store.ingestionRuns[0]?.status).toBe('succeeded');
  });

  it('surfaces diagnostic and snapshot persistence failures without hiding them', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAY_SH_CATALOG_URL', 'https://pay.sh/api/catalog');
    vi.stubEnv('PAYSH_CATALOG_SOURCE', 'live');
    vi.stubEnv('PAYSH_ALLOW_FIXTURE_FALLBACK', 'false');
    const store = await createIntelligenceStore(repository);
    const persistenceLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ generated_at: '2020-01-01T00:00:00.000Z', providers: [{ fqn: 'stale/failure', title: 'Stale', category: 'Data' }] })));
    const diagnosticFailure = new Error('injected ingestion_runs write failure');
    const diagnosticRepository = wrapRepository(repository, {
      queryFailure: (sql) => sql.toLowerCase().includes('insert into ingestion_runs') ? diagnosticFailure : null
    });
    await expect(runPayShIngestionWithOptions(store, diagnosticRepository, { catalogSource: 'live', allowFixtureFallback: false })).rejects.toThrow(diagnosticFailure.message);
    expect(persistenceLog.mock.calls.some(([value]) => String(value).includes('"event":"ingestion_run_persistence"') && String(value).includes('"outcome":"failure"'))).toBe(true);

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      generated_at: new Date().toISOString(), providers: [{ fqn: 'alpha', title: 'Snapshot Failure Alpha', category: 'Data' }]
    })));
    const snapshotFailure = new Error('injected intelligence_snapshots write failure');
    const snapshotRepository = wrapRepository(repository, {
      queryFailure: (sql) => sql.toLowerCase().includes('insert into intelligence_snapshots') ? snapshotFailure : null
    });
    const snapshotsBefore = await countRows(pool, 'intelligence_snapshots');
    await expect(runPayShIngestionWithOptions(store, snapshotRepository, { catalogSource: 'live', allowFixtureFallback: false })).rejects.toThrow(snapshotFailure.message);
    expect(await countRows(pool, 'intelligence_snapshots')).toBe(snapshotsBefore);
    expect(persistenceLog.mock.calls.some(([value]) => String(value).includes('"event":"snapshot_persistence"') && String(value).includes('"outcome":"failure"'))).toBe(true);
    persistenceLog.mockRestore();
  });

  it('records the isolated database server version', async () => {
    const orderBase = '2000-01-01T00:00:00.000Z';
    await repository.saveIngestionRun({ id: 'order-older', startedAt: orderBase, finishedAt: '2000-01-01T00:00:01.000Z', source: 'synthetic', status: 'failed', discoveredCount: 0, changedCount: 0, errorCount: 1, error: 'older_failure' });
    await repository.saveIngestionRun({ id: 'order-newer', startedAt: '2000-01-01T00:00:02.000Z', finishedAt: '2000-01-01T00:00:03.000Z', source: 'synthetic', status: 'succeeded', discoveredCount: 1, changedCount: 1, errorCount: 0, error: null });
    const orderedRuns = await repository.loadIngestionRuns();
    const newerIndex = orderedRuns.findIndex((run) => run.id === 'order-newer');
    const olderIndex = orderedRuns.findIndex((run) => run.id === 'order-older');
    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(olderIndex).toBeGreaterThan(newerIndex);
    const result = await pool.query<{ version: string; version_num: string }>(`select current_setting('server_version') as version, current_setting('server_version_num') as version_num`);
    expect(Number(result.rows[0]?.version_num)).toBeGreaterThanOrEqual(180000);
    console.log(`RADAR_ISOLATED_POSTGRES_VERSION=${result.rows[0]?.version}`);
  });
});

function isLoopbackDatabase(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  } catch {
    return false;
  }
}

function catalogItem(name: string) {
  return { name, namespace: 'pay/alpha', slug: 'alpha', category: 'Data', endpoints: 1, price: '$0.01', status: 'metered' as const, description: 'Synthetic integration provider.', tags: ['synthetic'], endpointDetails: [] };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function countRows(pool: pg.Pool, table: 'intelligence_snapshots' | 'ingestion_runs') {
  const result = await pool.query<{ count: string }>(`select count(*)::text as count from ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

function wrapRepository(base: PostgresRepository, options: { queryFailure: (sql: string) => Error | null }) {
  const wrapped = Object.create(base) as PostgresRepository;
  const pool = (base as unknown as { pool: pg.Pool }).pool;
  const guardedPool = Object.create(pool) as pg.Pool;
  guardedPool.query = ((sql: string, values?: unknown[]) => {
    const failure = options.queryFailure(sql);
    if (failure) return Promise.reject(failure);
    return pool.query(sql, values);
  }) as unknown as pg.Pool['query'];
  guardedPool.connect = (async () => {
    const client = await pool.connect();
    const guardedClient = Object.create(client) as pg.PoolClient;
    guardedClient.query = ((sql: string, values?: unknown[]) => {
      const failure = options.queryFailure(sql);
      if (failure) return Promise.reject(failure);
      return client.query(sql, values);
    }) as unknown as pg.PoolClient['query'];
    guardedClient.release = client.release.bind(client);
    return guardedClient;
  }) as pg.Pool['connect'];
  guardedPool.on = pool.on.bind(pool);
  (wrapped as unknown as { pool: pg.Pool }).pool = guardedPool;
  return wrapped;
}
