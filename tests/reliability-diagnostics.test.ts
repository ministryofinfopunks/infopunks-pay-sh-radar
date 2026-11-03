import { afterEach, describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { PostgresRepository } from '../src/persistence/postgresRepository';
import { loadPayShCatalog } from '../src/ingestion/payShCatalogAdapter';

const snapshot = { events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [], secret: 'sensitive-snapshot-value' };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('bounded operational diagnostics', () => {
  it('records the actual serialized parameter size and success without snapshot contents', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const query = vi.fn(async () => ({ rows: [] }));
    const pool = { on: vi.fn(), query, connect: vi.fn(async () => ({ query, release: vi.fn() })) } as unknown as pg.Pool;
    await new PostgresRepository(pool).saveSnapshot(snapshot);
    const entry = log.mock.calls.map(([v]) => { try { return JSON.parse(String(v)); } catch { return null; } }).find((v) => v?.event === 'snapshot_persistence');
    expect(entry).toMatchObject({ outcome: 'success', parameter_bytes: Buffer.byteLength(JSON.stringify(snapshot)), failure_category: null });
    expect(entry.operation_id).toMatch(/^[0-9a-f-]{36}$/); expect(entry.elapsed_ms).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive-snapshot-value');
  });

  it('records snapshot failure as a bounded category without error or payload contents', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const query = vi.fn(async (sql: string) => { if (sql.startsWith('insert into intelligence_snapshots')) throw new Error('connection terminated unexpectedly password=secret'); return { rows: [] }; });
    const pool = { on: vi.fn(), query: vi.fn(async () => ({ rows: [] })), connect: vi.fn(async () => ({ query, release: vi.fn() })) } as unknown as pg.Pool;
    await expect(new PostgresRepository(pool).saveSnapshot(snapshot)).rejects.toThrow();
    const entries = log.mock.calls.map(([v]) => { try { return JSON.parse(String(v)); } catch { return null; } });
    expect(entries.find((v) => v?.event === 'snapshot_persistence')).toMatchObject({ outcome: 'failure', failure_category: 'connectivity', parameter_bytes: Buffer.byteLength(JSON.stringify(snapshot)) });
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive-snapshot-value');
    expect(JSON.stringify(log.mock.calls)).not.toContain('password=secret');
  });

  it('records HTTP status and timeout stage without response bodies or URL', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new DOMException('secret provider response', 'AbortError'); } }));
    await loadPayShCatalog('https://example.test/private-token', { catalogSource: 'live', allowFixtureFallback: false });
    await loadPayShCatalog('https://example.test/private-token', { catalogSource: 'live', allowFixtureFallback: false });
    const entries = log.mock.calls.map(([v]) => { try { return JSON.parse(String(v)); } catch { return null; } }).filter((v) => v?.event === 'catalog_fetch_failure');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ upstream_status: 503, failure_category: 'live_catalog_fetch_failed', timeout_stage: null });
    expect(entries[1]).toMatchObject({ upstream_status: 200, failure_category: 'live_catalog_timeout', timeout_stage: 'body' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-token');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret provider response');
  });
});
