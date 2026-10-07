import * as databasePool from '../src/persistence/databasePool';
import type pg from 'pg';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import type { IntelligenceRepository } from '../src/persistence/repository';

const repositoryWithStatus = (status: 'ok' | 'degraded' | 'unavailable'): IntelligenceRepository => ({
  loadSnapshot: async () => null,
  saveSnapshot: async () => undefined,
  getDbStatus: () => status
} as IntelligenceRepository);

describe('deployment health endpoints', () => {
  it('returns liveness without requiring persistence or providers', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, status: 'live' });
    await app.close();
  });

  it('reports healthy, degraded and unavailable readiness states', async () => {
    const healthy = await createApp(emptyIntelligenceStore(), repositoryWithStatus('ok'));
    expect((await healthy.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ ok: true, status: 'healthy' });
    await healthy.close();

    const degraded = await createApp(emptyIntelligenceStore(), repositoryWithStatus('degraded'));
    expect((await degraded.inject({ method: 'GET', url: '/readyz' })).json()).toMatchObject({ ok: true, status: 'degraded' });
    await degraded.close();

    const unavailable = await createApp(emptyIntelligenceStore(), repositoryWithStatus('unavailable'));
    const response = await unavailable.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ ok: false, status: 'unavailable', reasons: [{ code: 'database_unavailable' }] });
    expect((await unavailable.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    await unavailable.close();
  });
});


describe('production readiness gates', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  function setup() {
    for (const [name, value] of Object.entries({ NODE_ENV: 'production', PORT: '8787', DATABASE_URL: 'postgres://user:secret@localhost/radar', ADMIN_TOKEN: 'secret', PAYSH_CATALOG_SOURCE: 'live', PAY_SH_CATALOG_URL: 'https://pay.sh/api/catalog', PAYSH_ALLOW_FIXTURE_FALLBACK: 'false', PAYSH_BOOTSTRAP_ENABLED: 'false' })) vi.stubEnv(name, value);
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('pg_constraint') ? [{ definition: "'consumer'" }] : [] }));
    const pool = { query, on: vi.fn(), end: vi.fn() } as unknown as pg.Pool;
    vi.spyOn(databasePool, 'getDatabasePool').mockReturnValue(pool);
    const now = new Date().toISOString();
    const store = applyPayShCatalogIngestion(emptyIntelligenceStore(), [{ name: 'Live', namespace: 'live', slug: 'live', category: 'Data', endpoints: 0, price: 'unknown', status: 'unknown', description: '', tags: [] }], {
      source: 'pay.sh:live-catalog', dataSource: { mode: 'live_pay_sh_catalog', used_fixture: false, url: 'https://pay.sh/api/catalog', provider_count: 1, generated_at: now, last_ingested_at: now, error: null }
    }).snapshot;
    return { store, query };
  }
  it('is ready only with reachable PostgreSQL, current migrations and live catalog', async () => {
    const { store } = setup();
    const app = await createApp(store);
    try {
      const response = await app.inject('/readyz');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ ok: true, reasons: [] });
      expect(JSON.stringify(response.json())).not.toContain('secret');
    } finally { await app.close(); }
  });
  it.each(['database', 'migrations', 'catalog', 'stale', 'generation', 'fixture', 'configuration', 'dependencies'])('keeps liveness healthy while %s blocks readiness', async (failure) => {
    const { store, query } = setup();
    if (failure === 'database') query.mockRejectedValue(new Error('database unavailable'));
    if (failure === 'migrations') query.mockImplementation(async (sql: string) => ({ rows: sql.includes('to_regclass') ? [{ name: 'rh_4663_events' }] : sql.includes('pg_constraint') ? [{ definition: "'consumer'" }] : [] }) as never);
    if (failure === 'catalog') store.dataSource!.error = 'live_catalog_fetch_failed';
    if (failure === 'stale') store.dataSource!.last_ingested_at = '2020-01-01T00:00:00Z';
    if (failure === 'generation') store.dataSource!.generated_at = '2020-01-01T00:00:00Z';
    if (failure === 'dependencies') { vi.stubEnv('ADMIN_TOKEN', ''); vi.stubEnv('INFOPUNKS_ADMIN_TOKEN', ''); }
    if (failure === 'fixture') store.dataSource!.used_fixture = true;
    const app = await createApp(store);
    if (failure === 'configuration') vi.stubEnv('PAYSH_CATALOG_SOURCE', 'fixture');
    try {
      const health = await app.inject('/healthz');
      expect(health.statusCode).toBe(200);
      expect(health.json()).not.toHaveProperty('db_status');
      const response = await app.inject('/readyz');
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ ok: false, status: 'unavailable' });
      expect(response.json().reasons.length).toBeGreaterThan(0);
      expect(JSON.stringify(response.json())).not.toContain('secret');
    } finally { await app.close(); }
  });
});
