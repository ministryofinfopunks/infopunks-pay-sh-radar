import pg from 'pg';
import { IntelligenceRepository, IntelligenceSnapshot } from './repository';
import { logPostgres22P02, safeJsonbParam } from './jsonb';

const { Pool } = pg;

type JsonContext = {
  operation: string;
  table: string;
  column: string;
  value: unknown;
};

export class PostgresRepository implements IntelligenceRepository {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async loadSnapshot(): Promise<IntelligenceSnapshot | null> {
    await this.ensureSchema();
    const result = await this.pool.query('select snapshot from intelligence_snapshots order by created_at desc limit 1');
    return result.rows[0]?.snapshot ?? null;
  }

  async saveSnapshot(snapshot: IntelligenceSnapshot): Promise<void> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (snapshot.events.length) {
        const contexts: JsonContext[] = [];
        const params = snapshot.events.flatMap((event) => {
          contexts.push({ operation: 'insert', table: 'infopunks_events', column: 'payload', value: event.payload });
          return [
            event.id,
            event.type,
            event.source,
            event.entityType,
            event.entityId,
            event.observedAt,
            safeJsonbParam(event.payload, { operation: 'insert', table: 'infopunks_events', column: 'payload' })
          ];
        });
        try {
          await client.query('insert into infopunks_events (id, type, source, entity_type, entity_id, observed_at, payload) values ' +
            snapshot.events.map((_, index) => `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7}::jsonb)`).join(',') +
            ' on conflict (id) do nothing', params);
        } catch (error) {
          this.log22p02(error, contexts);
          throw error;
        }
      }
      for (const run of snapshot.ingestionRuns ?? []) {
        await client.query(
          `insert into ingestion_runs (id, started_at, finished_at, source, status, discovered_count, changed_count, error_count, error)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (id) do update set finished_at = excluded.finished_at, status = excluded.status, discovered_count = excluded.discovered_count, changed_count = excluded.changed_count, error_count = excluded.error_count, error = excluded.error`,
          [run.id, run.startedAt, run.finishedAt, run.source, run.status, run.discoveredCount, run.changedCount, run.errorCount, run.error]
        );
      }
      for (const run of snapshot.monitorRuns ?? []) {
        const context: JsonContext = { operation: 'upsert', table: 'monitor_runs', column: 'skipped_reasons', value: run.skippedReasons ?? [] };
        try {
          await client.query(
            `insert into monitor_runs (id, started_at, finished_at, source, status, checked_count, success_count, failed_count, skipped_count, error_count, error, mode, reachable_count, degraded_count, skipped_reasons)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
             on conflict (id) do update set finished_at = excluded.finished_at, status = excluded.status, checked_count = excluded.checked_count, success_count = excluded.success_count, failed_count = excluded.failed_count, skipped_count = excluded.skipped_count, error_count = excluded.error_count, error = excluded.error, mode = excluded.mode, reachable_count = excluded.reachable_count, degraded_count = excluded.degraded_count, skipped_reasons = excluded.skipped_reasons`,
            [
              run.id,
              run.startedAt,
              run.finishedAt,
              run.source,
              run.status,
              run.checkedCount,
              run.successCount,
              run.failedCount,
              run.skippedCount,
              run.errorCount,
              run.error,
              run.mode ?? null,
              run.reachableCount ?? null,
              run.degradedCount ?? null,
              safeJsonbParam(run.skippedReasons ?? [], { operation: 'upsert', table: 'monitor_runs', column: 'skipped_reasons' })
            ]
          );
        } catch (error) {
          this.log22p02(error, [context]);
          throw error;
        }
      }
      const snapshotContext: JsonContext = { operation: 'insert', table: 'intelligence_snapshots', column: 'snapshot', value: snapshot };
      try {
        await client.query('insert into intelligence_snapshots (snapshot) values ($1::jsonb)', [safeJsonbParam(snapshot, { operation: 'insert', table: 'intelligence_snapshots', column: 'snapshot' })]);
      } catch (error) {
        this.log22p02(error, [snapshotContext]);
        throw error;
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private log22p02(error: unknown, contexts: JsonContext[]) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    if (code !== '22P02') return;
    for (const context of contexts) {
      logPostgres22P02({ operation: context.operation, table: context.table, column: context.column }, context.value);
    }
  }

  private async ensureSchema() {
    await this.pool.query(`
      create table if not exists infopunks_events (
        id text primary key,
        type text not null,
        source text not null,
        entity_type text not null,
        entity_id text not null,
        observed_at timestamptz not null,
        payload jsonb not null
      );
      create index if not exists infopunks_events_entity_idx on infopunks_events (entity_type, entity_id);
      create table if not exists ingestion_runs (
        id text primary key,
        started_at timestamptz not null,
        finished_at timestamptz,
        source text not null,
        status text not null,
        discovered_count integer not null,
        changed_count integer not null,
        error_count integer not null,
        error text,
        mode text,
        reachable_count integer,
        degraded_count integer,
        skipped_reasons jsonb not null default '[]'::jsonb
      );
      alter table monitor_runs add column if not exists mode text;
      alter table monitor_runs add column if not exists reachable_count integer;
      alter table monitor_runs add column if not exists degraded_count integer;
      alter table monitor_runs add column if not exists skipped_reasons jsonb not null default '[]'::jsonb;
      create table if not exists monitor_runs (
        id text primary key,
        started_at timestamptz not null,
        finished_at timestamptz,
        source text not null,
        status text not null,
        checked_count integer not null,
        success_count integer not null,
        failed_count integer not null,
        skipped_count integer not null,
        error_count integer not null,
        error text
      );
      create table if not exists intelligence_snapshots (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        snapshot jsonb not null
      );
    `);
  }
}
