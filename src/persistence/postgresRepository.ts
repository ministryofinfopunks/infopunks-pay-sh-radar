import { randomUUID } from 'node:crypto';
import { classifyPostgresFailure } from './postgresErrors';
import pg from 'pg';
import { IntelligenceRepository, IntelligenceSnapshot, mergeMonitorDeltas } from './repository';
import type { LoadedSnapshotState, MonitorDelta, MonitorStateDelta } from './repository';
import { InfopunksEvent, MonitorRun } from '../schemas/entities';
import { IngestionRun } from '../schemas/entities';
import { safeJsonbParam } from './jsonb';
import { getDatabaseCircuitDiagnostics, getDatabasePool, parseDatabasePoolMax } from './databasePool';

type JsonContext = {
  operation: string;
  table: string;
  column: string;
  value: unknown;
};

const SNAPSHOT_WRITE_LOCK_KEY = '7261935087441';

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
    return (await this.loadSnapshotState()).snapshot;
  }

  async loadSnapshotState(): Promise<LoadedSnapshotState> {
    let client: pg.PoolClient | null = null;
    try {
      await this.ensureSchema();
      client = await this.pool.connect();
      await client.query('begin isolation level repeatable read read only');
      const result = await client.query('select id, snapshot from intelligence_snapshots order by id desc limit 1');
      const snapshotId = result.rows[0]?.id ?? null;
      const monitorDeltas = await this.readMonitorDeltas(client, snapshotId);
      await client.query('commit');
      this.markDbStatus('ok', 'load_snapshot');
      return { snapshot: result.rows[0]?.snapshot ?? null, monitorDeltas };
    } catch (error) {
      if (client) {
        try { await client.query('rollback'); } catch { /* Preserve the original read error. */ }
      }
      this.markDbStatus(connectionErrorStatus(error), 'load_snapshot', error);
      throw error;
    } finally {
      client?.release();
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
      await client.query('select pg_advisory_xact_lock($1::bigint)', [SNAPSHOT_WRITE_LOCK_KEY]);
      const latestSnapshot = await client.query('select id from intelligence_snapshots order by id desc limit 1');
      const checkpointId = latestSnapshot.rows[0]?.id ?? null;
      const pendingDeltas = await this.readMonitorDeltas(client, checkpointId);
      const persistedSnapshot = mergeMonitorDeltas(snapshot, pendingDeltas);
      if (persistedSnapshot.events.length) {
        const contexts: JsonContext[] = [];
        const params = persistedSnapshot.events.flatMap((event) => {
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
            persistedSnapshot.events.map((_, index) => `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7}::jsonb)`).join(',') +
            ' on conflict (id) do nothing', params);
        } catch (error) {
          this.log22p02(error, contexts);
          throw error;
        }
      }
      for (const run of persistedSnapshot.ingestionRuns ?? []) {
        await client.query(
          `insert into ingestion_runs (id, started_at, finished_at, source, status, discovered_count, changed_count, error_count, error)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (id) do update set finished_at = excluded.finished_at, status = excluded.status, discovered_count = excluded.discovered_count, changed_count = excluded.changed_count, error_count = excluded.error_count, error = excluded.error`,
          [run.id, run.startedAt, run.finishedAt, run.source, run.status, run.discoveredCount, run.changedCount, run.errorCount, run.error]
        );
      }
      for (const run of persistedSnapshot.monitorRuns ?? []) {
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
      const snapshotContext: JsonContext = { operation: 'insert', table: 'intelligence_snapshots', column: 'snapshot', value: persistedSnapshot };
      try {
        const parameter = safeJsonbParam(persistedSnapshot, { operation: 'insert', table: 'intelligence_snapshots', column: 'snapshot' });
        recordBytes(Buffer.byteLength(parameter, 'utf8'));
        const inserted = await client.query<{ id: string }>('insert into intelligence_snapshots (snapshot) values ($1::jsonb) returning id', [parameter]);
        const foldedLatestRun = pendingDeltas[pendingDeltas.length - 1]?.run;
        if (foldedLatestRun) {
          await client.query('update monitor_runs set snapshot_id = $1 where id = $2', [inserted.rows[0]?.id ?? null, foldedLatestRun.id]);
        }
      } catch (error) {
        this.log22p02(error, [snapshotContext]);
        throw error;
      }
      await client.query('commit');
      Object.assign(snapshot, persistedSnapshot);
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

  async saveMonitorDelta(delta: MonitorDelta): Promise<void> {
    const started = Date.now();
    const operationId = randomUUID();
    let outcome: 'success' | 'failure' = 'failure';
    let bytes: number | null = null;
    let client: pg.PoolClient | null = null;
    try {
      await this.ensureSchema();
      client = await this.pool.connect();
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock($1::bigint)', [SNAPSHOT_WRITE_LOCK_KEY]);
      const checkpoint = await client.query('select id from intelligence_snapshots order by id desc limit 1');
      const snapshotId = checkpoint.rows[0]?.id ?? null;
      bytes = Buffer.byteLength(JSON.stringify(delta), 'utf8');
      if (delta.events.length) {
        const params = delta.events.flatMap((event, index) => [event.id, event.type, event.source, event.entityType, event.entityId, event.observedAt,
          safeJsonbParam(event.payload, { operation: 'insert', table: 'infopunks_events', column: 'payload' }), delta.run.id, index]);
        await client.query(`insert into infopunks_events (id, type, source, entity_type, entity_id, observed_at, payload, monitor_run_id, monitor_event_order) values ` +
          delta.events.map((_, index) => `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${index * 9 + 4}, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}::jsonb, $${index * 9 + 8}, $${index * 9 + 9})`).join(',') +
          ' on conflict (id) do nothing', params);
      }
      const run = delta.run;
      const state = safeJsonbParam(delta.state, { operation: 'upsert', table: 'monitor_runs', column: 'state_delta' });
      await client.query(`insert into monitor_runs (id, started_at, finished_at, source, status, checked_count, success_count,
        failed_count, skipped_count, error_count, error, mode, reachable_count, degraded_count, skipped_reasons, snapshot_id, state_delta)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17::jsonb)
        on conflict (id) do update set finished_at = excluded.finished_at, status = excluded.status, checked_count = excluded.checked_count,
        success_count = excluded.success_count, failed_count = excluded.failed_count, skipped_count = excluded.skipped_count,
        error_count = excluded.error_count, error = excluded.error, mode = excluded.mode, reachable_count = excluded.reachable_count,
        degraded_count = excluded.degraded_count, skipped_reasons = excluded.skipped_reasons, snapshot_id = excluded.snapshot_id,
        state_delta = excluded.state_delta`, [run.id, run.startedAt, run.finishedAt, run.source, run.status, run.checkedCount, run.successCount,
        run.failedCount, run.skippedCount, run.errorCount, run.error, run.mode ?? null, run.reachableCount ?? null,
        run.degradedCount ?? null, safeJsonbParam(run.skippedReasons ?? [], { operation: 'upsert', table: 'monitor_runs', column: 'skipped_reasons' }),
        snapshotId, state]);
      await client.query('commit');
      this.markDbStatus('ok', 'save_monitor_delta:commit');
      outcome = 'success';
    } catch (error) {
      this.markDbStatus(connectionErrorStatus(error), 'save_monitor_delta', error);
      if (client) {
        try { await client.query('rollback'); } catch (rollbackError) {
          console.log(JSON.stringify({ event: 'postgres_rollback_failed', code: pgErrorCode(rollbackError), failure_category: classifyPostgresFailure(rollbackError) }));
        }
      }
      throw error;
    } finally {
      client?.release();
      console.log(JSON.stringify({ event: 'monitor_delta_persistence', operation_id: operationId, run_id: delta.run.id, parameter_bytes: bytes, elapsed_ms: Date.now() - started, outcome }));
    }
  }

  private async readMonitorDeltas(client: pg.PoolClient, snapshotId: string | number | null): Promise<MonitorDelta[]> {
    const runs = await client.query(`select id, started_at, finished_at, source, status, checked_count, success_count,
      failed_count, skipped_count, error_count, error, mode, reachable_count, degraded_count, skipped_reasons, state_delta
      from monitor_runs where snapshot_id is not distinct from $1::bigint and state_delta is not null order by started_at asc, id asc`, [snapshotId]);
    const runIds = runs.rows.map((row) => String(row.id));
    const eventsResult = runIds.length
      ? await client.query(`select id, type, source, entity_type, entity_id, observed_at, payload, monitor_run_id
        from infopunks_events where monitor_run_id = any($1::text[])
        order by monitor_run_id, monitor_event_order asc nulls last, observed_at asc, id asc`, [runIds])
      : { rows: [] };
    const eventsByRun = new Map<string, InfopunksEvent[]>();
    for (const row of eventsResult.rows) {
      const runId = String(row.monitor_run_id ?? '');
      eventsByRun.set(runId, [...(eventsByRun.get(runId) ?? []), mapEventRow(row)]);
    }
    return runs.rows.map((row): MonitorDelta => {
      const run = mapMonitorRunRow(row);
      return {
        run,
        events: eventsByRun.get(run.id) ?? [],
        state: (row.state_delta ?? { providerEvidence: [], endpointUpdates: [] }) as MonitorStateDelta
      };
    });
  }

  // Read-only compatibility probe for the existing bootstrap schema.
  async checkReadiness(): Promise<boolean> {
    try {
      await this.pool.query(`select e.payload, e.monitor_run_id, e.monitor_event_order, s.snapshot, i.error_count, m.skipped_reasons, m.snapshot_id, m.state_delta
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
        payload jsonb not null,
        monitor_run_id text,
        monitor_event_order integer
      );
      alter table infopunks_events add column if not exists monitor_run_id text;
      alter table infopunks_events add column if not exists monitor_event_order integer;
      create index if not exists infopunks_events_entity_idx on infopunks_events (entity_type, entity_id);
      create index if not exists infopunks_events_monitor_run_idx on infopunks_events (monitor_run_id, monitor_event_order, observed_at, id) where monitor_run_id is not null;
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
        error text,
        snapshot_id bigint,
        state_delta jsonb
      );
      alter table monitor_runs add column if not exists snapshot_id bigint;
      alter table monitor_runs add column if not exists state_delta jsonb;
      create index if not exists monitor_runs_snapshot_started_idx on monitor_runs (snapshot_id, started_at, id);
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

function mapEventRow(row: Record<string, unknown>): InfopunksEvent {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const observedAt = toIsoString(row.observed_at as string | Date);
  const event: InfopunksEvent = {
    id: String(row.id),
    type: row.type as InfopunksEvent['type'],
    source: String(row.source),
    entityType: row.entity_type as InfopunksEvent['entityType'],
    entityId: String(row.entity_id),
    observedAt,
    payload
  };
  if (typeof payload.severity === 'string') event.severity = payload.severity as InfopunksEvent['severity'];
  if (typeof payload.severity_reason === 'string') event.severity_reason = payload.severity_reason;
  if (typeof payload.severity_score === 'number') event.severity_score = payload.severity_score;
  if (typeof payload.severity_window === 'string') event.severity_window = payload.severity_window;
  return event;
}

function mapMonitorRunRow(row: Record<string, unknown>): MonitorRun {
  return {
    id: String(row.id),
    startedAt: toIsoString(row.started_at as string | Date),
    finishedAt: row.finished_at === null ? null : toIsoString(row.finished_at as string | Date),
    source: String(row.source),
    status: row.status as MonitorRun['status'],
    checkedCount: Number(row.checked_count),
    successCount: Number(row.success_count),
    failedCount: Number(row.failed_count),
    skippedCount: Number(row.skipped_count),
    errorCount: Number(row.error_count),
    error: row.error === null ? null : String(row.error),
    mode: row.mode as MonitorRun['mode'],
    reachableCount: row.reachable_count === null ? undefined : Number(row.reachable_count),
    degradedCount: row.degraded_count === null ? undefined : Number(row.degraded_count),
    skippedReasons: (row.skipped_reasons ?? []) as MonitorRun['skippedReasons']
  };
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
