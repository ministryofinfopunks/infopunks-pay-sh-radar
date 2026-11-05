import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { PostgresRepository } from '../src/persistence/postgresRepository';
import type { IngestionRun } from '../src/schemas/entities';

describe('ingestion attempt persistence', () => {
  it('writes and reloads a failed run through the small ingestion_runs row only', async () => {
    const run: IngestionRun = {
      id: 'attempt-1',
      startedAt: '2026-11-05T06:42:00.000Z',
      finishedAt: '2026-11-05T06:42:02.000Z',
      source: 'pay.sh:live-catalog:https://pay.sh/api/catalog',
      status: 'failed',
      discoveredCount: 0,
      changedCount: 0,
      errorCount: 1,
      error: 'live_catalog_stale'
    };
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (sql.includes('from ingestion_runs order by started_at desc')) {
        return { rows: [{
          id: run.id,
          started_at: run.startedAt,
          finished_at: run.finishedAt,
          source: run.source,
          status: run.status,
          discovered_count: run.discoveredCount,
          changed_count: run.changedCount,
          error_count: run.errorCount,
          error: run.error
        }] };
      }
      return { rows: [] };
    });
    const pool = { query, on: vi.fn() } as unknown as pg.Pool;
    const repository = new PostgresRepository(pool);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await repository.saveIngestionRun(run);
    const restored = await repository.loadIngestionRuns();

    const writes = queries.filter(({ sql }) => /insert into/i.test(sql));
    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toMatch(/insert into ingestion_runs/i);
    expect(writes[0].sql).not.toMatch(/intelligence_snapshots/i);
    expect(writes[0].values).toHaveLength(9);
    expect(restored).toEqual([run]);
    expect(log.mock.calls.some(([value]) => String(value).includes('"event":"ingestion_run_persistence"'))).toBe(true);

    log.mockRestore();
  });
});
