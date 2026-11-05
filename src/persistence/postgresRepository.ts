import { randomUUID } from 'node:crypto';
import { classifyPostgresFailure } from './postgresErrors';
import pg from 'pg';
import { IntelligenceRepository, IntelligenceSnapshot } from './repository';
import { IngestionRun } from '../schemas/entities';
import { safeJsonbParam } from './jsonb';
import { getDatabaseCircuitDiagnostics, getDatabasePool, parseDatabasePoolMax } from './databasePool';

type JsonContext = {
  operation: string;
  table: string;
  column: string;
  value: unknown;
};

export class PostgresRepository implements IntelligenceRepository {
  private pool: pg.Pool;
  // A configured URL is not proof of a usable persistence layer. Readiness
  // becomes healthy only after the first successful database operation.
  private dbStatus: 'ok' | 'degraded' | 'unavailable' = 'degraded';

  constructor(source: string | pg.Pool) {
    this.pool = typeof source === 'string'
      ? getDatabasePool({ connectionString: source, max: parseDatabasePoolMax(process.env.DATABASE_POOL_MAX, 10) })
      : source;
    this.pool.on('error', (error) => {
      this.markDbStatus(connectionErrorStatus(error), 'pool_error', error);
      console.log(JSON.stringify({
        event: 'db_connection_error',
        status: this.dbStatus,
        code: pgErrorCode(error),
        message: classifyPostgresFailure(error)
      }));
    });
  }

  async loadSnapshot(): Promise<IntelligenceSnapshot | null> {
    try {
      await this.ensureSchema();
      const result = await this.pool.query('select snapshot from intelligence_snapshots order by created_at desc limit 1');
      this.markDbStatus('ok', 'load_snapshot');
      return result.rows[0]?.snapshot ?? null;
    } catch (error) {
      this.markDbStatus(connectionErrorStatus(error), 'load_snapshot', error);
      throw error;
    }
  }

  async loadIngestionRuns(): Promise<IngestionRun[]> {
    try {
      await this.ensureSchema();
      const result = await this.pool.query(`select id, started_at, finished_at, source, status,
        discovered_count, changed_count, error_count, error
        from ingestion_runs order by started_at desc limit 100`);
      this.markDbStatus('ok', 'load_ingestion_runs');
      return result.rows.map((row): IngestionRun => ({
        id: row.id,
        startedAt: toIsoString(row.started_at),
        finishedAt: row.finished_at === null ? null : toIsoString(row.finished_at),
        source: row.source,
        status: row.status,
        discoveredCount: row.discovered_count,
        changedCount: row.changed_count,
        errorCount: row.error_count,
        error: row.error
      }));
    } catch (error) {
      this.markDbStatus(connectionErrorStatus(error), 'load_ingestion_runs', error);
      throw error;
    }
  }

  async saveIngestionRun(run: IngestionRun): Promise<void> {
    const started = Date.now();
    let outcome: 'success' | 'failure' = 'failure';
    try {
      await this.ensureSchema();
      await this.pool.query(
        `insert into ingestion_runs (id, started_at, finished_at, source, status, discovered_count, changed_count, error_count, error)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set finished_at = excluded.finished_at, status = excluded.status,
         discovered_count = excluded.discovered_count, changed_count = excluded.changed_count,
         error_count = excluded.error_count, error = excluded.error`,
        [run.id, run.startedAt, run.finishedAt, run.source, run.status, run.discoveredCount, run.changedCount, run.errorCount, run.error]
      );
      this.markDbStatus('ok', 'save_ingestion_run');
      outcome = 'success';
    } catch (error) {
      this.markDbStatus(connectionErrorStatus(error), 'save_ingestion_run', error);
      throw error;
    } finally {
      console.log(JSON.stringify({ event: 'ingestion_run_persistence', run_id: run.id, elapsed_ms: Date.now() - started, outcome }));
    }
  }

  async saveSnapshot(snapshot: IntelligenceSnapshot): Promise<void> {
    const operationId = randomUUID();
    const started = Date.now();
    let bytes: number | null = null;
    let outcome: 'success' | 'failure' = 'failure';
    let failureCategory: string | null = null;
    try {
      await this.saveSnapshotInner(snapshot, (size) => { bytes = size; });
      outcome = 'success';
    } catch (error) {
      failureCategory = classifyPostgresFailure(error);
      throw error;
    } finally {
      console.log(JSON.stringify({ event: 'snapshot_persistence', operation_id: operationId, parameter_bytes: bytes, elapsed_ms: Date.now() - started, outcome, failure_category: failureCategory }));
    }
  }

  private async saveSnapshotInner(snapshot: IntelligenceSnapshot, recordBytes: (size: number) => void): Promise<void> {
    try {
      await this.ensureSchema();
    } catch (error) {
      this.markDbStatus(connectionErrorStatus(error), 'save_snapshot:ensure_schema', error);
      throw error;
    }

    let client: pg.PoolClient | null = null;
    try {
      client = await this.pool.connect();
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
        const parameter = safeJsonbParam(snapshot, { operation: 'insert', table: 'intelligence_snapshots', column: 'snapshot' });
        recordBytes(Buffer.byteLength(parameter, 'utf8'));
        await client.query('insert into intelligence_snapshots (snapshot) values ($1::jsonb)', [parameter]);
      } catch (error) {
        this.log22p02(error, [snapshotContext]);
        throw error;
      }
      await client.query('commit');
      this.markDbStatus('ok', 'save_snapshot:commit');
    } catch (error) {
      this.markDbStatus(connectionErrorStatus(error), 'save_snapshot', error);
      if (client) {
        try {
          await client.query('rollback');
        } catch (rollbackError) {
          console.log(JSON.stringify({
            event: 'postgres_rollback_failed',
            code: pgErrorCode(rollbackError),
            failure_category: classifyPostgresFailure(rollbackError)
          }));
        }
      }
      throw error;
    } finally {
      client?.release();
    }
  }

  // Read-only compatibility probe for the existing bootstrap schema.
  async checkReadiness(): Promise<boolean> {
    try {
      await this.pool.query(`select e.payload, s.snapshot, i.error_count, m.skipped_reasons
        from infopunks_events e, intelligence_snapshots s, ingestion_runs i, monitor_runs m limit 0`);
      this.markDbStatus('ok', 'readiness');
      return true;
    } catch (error) {
      this.markDbStatus(connectionErrorStatus(error), 'readiness', error);
      return false;
    }
  }

  getDbStatus(): 'ok' | 'degraded' | 'unavailable' {
    const circuit = getDatabaseCircuitDiagnostics();
    if (circuit.dbMode === 'postgres') return circuit.dbStatus;
    return this.dbStatus;
  }

  private log22p02(error: unknown, contexts: JsonContext[]) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    if (code !== '22P02') return;
    const seen = new Set<string>();
    for (const context of contexts) {
      const key = `${context.operation}:${context.table}:${context.column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.error('[jsonb-22P02]', { operation: context.operation, table: context.table, column: context.column });
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
      alter table monitor_runs add column if not exists mode text;
      alter table monitor_runs add column if not exists reachable_count integer;
      alter table monitor_runs add column if not exists degraded_count integer;
      alter table monitor_runs add column if not exists skipped_reasons jsonb not null default '[]'::jsonb;
      create table if not exists intelligence_snapshots (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        snapshot jsonb not null
      );
    `);
  }

  private markDbStatus(nextStatus: 'ok' | 'degraded' | 'unavailable', stage: string, error?: unknown) {
    const previousStatus = this.dbStatus;
    this.dbStatus = nextStatus;
    if (nextStatus === 'ok' && previousStatus !== 'ok') {
      console.log(JSON.stringify({
        event: 'db_recovered',
        stage,
        previous_status: previousStatus,
        status: nextStatus
      }));
      return;
    }
    if (nextStatus !== 'ok' && previousStatus !== nextStatus) {
      console.log(JSON.stringify({
        event: 'db_degraded',
        stage,
        reason: classifyDbReason(error),
        previous_status: previousStatus,
        status: nextStatus,
        code: pgErrorCode(error),
        message: stage.startsWith('save_snapshot') ? classifyPostgresFailure(error) : pgErrorMessage(error)
      }));
    }
  }
}

function connectionErrorStatus(error: unknown): 'degraded' | 'unavailable' {
  const code = pgErrorCode(error);
  if (code === 'ECONNREFUSED' || code === '57P01') return 'unavailable';
  const message = pgErrorMessage(error).toLowerCase();
  if (message.includes('connection terminated unexpectedly') || message.includes('timeout') || message.includes('pool') || message.includes('closed')) return 'unavailable';
  return 'degraded';
}

function pgErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function pgErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return String(error ?? '');
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : String(message ?? '');
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function classifyDbReason(error: unknown): string {
  const code = pgErrorCode(error);
  if (code === 'ECONNREFUSED') return 'db_connection_refused';
  if (code === '57P01') return 'db_terminated';
  const message = pgErrorMessage(error).toLowerCase();
  if (message.includes('connection terminated unexpectedly')) return 'db_connection_terminated';
  if (message.includes('timeout')) return 'db_timeout';
  if (message.includes('pool') || message.includes('closed')) return 'db_pool_closed';
  return 'db_unavailable';
}
