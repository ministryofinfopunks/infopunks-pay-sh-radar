import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { inspectMigrationDirectory, type MigrationFileEntry, validateMigrationEntries } from './migrationInventory';
import { inspectRhChainMigrationLedger } from './rhChainProductionReadiness';

const LOCK_NAME = 'infopunks.track-a.schema-migrations.v1';
const HISTORY_TABLE = 'infopunks_schema_migration_history';
const APPLIED_TABLE = 'infopunks_schema_migrations';
export type MigrationRunOutcome = 'applied' | 'failed' | 'adopted';
export type MigrationRunRecord = { sequence: number; migration_id: string; migration_file: string; checksum: string; outcome: MigrationRunOutcome; started_at: string; finished_at: string; duration_ms: number; error_code: string | null };
export type MigrationRunReport = { valid: boolean; database: 'reachable' | 'unreachable'; mode: 'validate' | 'apply'; baseline_adopted: string | null; applied: string[]; pending: string[]; failures: string[]; repository_errors: string[]; history: MigrationRunRecord[] };
export class MigrationRunnerError extends Error { constructor(readonly code: string) { super(code); } }

/** Explicit operator-approved historical baselines. Schema signatures are verified before adoption. */
export const SUPPORTED_BASELINES = ['017', '020'] as const;
const SUPPORTED_BASELINE_MANIFESTS: Record<typeof SUPPORTED_BASELINES[number], string> = {
  '017': '5840825ab569df2b434cbd834b55709b349449de05af8bcea6bf994613e81634',
  '020': '876d2ddffe5a8a62abb9f140a9da7de0f2fd98c4d83292ffc3cea9ea123579f1'
};

function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function migrationId(entry: MigrationFileEntry) { return entry.file.match(/^\d{8}_\d{3}/)?.[0] ?? ''; }
function sequence(entry: MigrationFileEntry) { return Number(entry.id); }
function stripTransaction(sql: string) {
  const hasBegin = /\bbegin\s*;/i.test(sql);
  const hasCommit = /\bcommit\s*;\s*$/i.test(sql);
  if (hasBegin !== hasCommit) throw new MigrationRunnerError('migration_transaction_wrapper_invalid');
  return hasBegin ? sql.replace(/\bbegin\s*;/i, '').replace(/\bcommit\s*;\s*$/i, '') : sql;
}
function reportBase(mode: MigrationRunReport['mode'], errors: string[]): MigrationRunReport {
  return { valid: errors.length === 0, database: 'unreachable', mode, baseline_adopted: null, applied: [], pending: [], failures: [], repository_errors: errors, history: [] };
}

async function ensureLedger(client: PoolClient) {
  await client.query(`create table if not exists ${HISTORY_TABLE} (
    run_id bigserial primary key,
    migration_id text not null,
    migration_file text not null,
    checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
    outcome text not null check (outcome in ('applied','failed','adopted')),
    started_at timestamptz not null,
    finished_at timestamptz not null,
    duration_ms integer not null check (duration_ms >= 0),
    error_code text,
    check ((outcome='failed') or error_code is null)
  )`);
  await client.query(`create index if not exists ${HISTORY_TABLE}_migration_run_idx on ${HISTORY_TABLE}(migration_id,run_id)`);
  await client.query(`create table if not exists ${APPLIED_TABLE} (
    migration_id text primary key,
    migration_file text not null unique,
    checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
    applied_at timestamptz not null,
    outcome text not null check (outcome in ('applied','adopted')),
    history_run_id bigint not null unique references ${HISTORY_TABLE}(run_id)
  )`);
  await client.query(`create or replace function infopunks_migration_ledger_immutable() returns trigger language plpgsql as $$ begin raise exception 'migration_ledger_immutable' using errcode='55000'; end; $$`);
  await client.query(`drop trigger if exists ${HISTORY_TABLE}_immutable on ${HISTORY_TABLE}`);
  await client.query(`create trigger ${HISTORY_TABLE}_immutable before update or delete on ${HISTORY_TABLE} for each row execute function infopunks_migration_ledger_immutable()`);
  await client.query(`drop trigger if exists ${HISTORY_TABLE}_no_truncate on ${HISTORY_TABLE}`);
  await client.query(`create trigger ${HISTORY_TABLE}_no_truncate before truncate on ${HISTORY_TABLE} for each statement execute function infopunks_migration_ledger_immutable()`);
  await client.query(`drop trigger if exists ${APPLIED_TABLE}_immutable on ${APPLIED_TABLE}`);
  await client.query(`create trigger ${APPLIED_TABLE}_immutable before update or delete on ${APPLIED_TABLE} for each row execute function infopunks_migration_ledger_immutable()`);
  await client.query(`drop trigger if exists ${APPLIED_TABLE}_no_truncate on ${APPLIED_TABLE}`);
  await client.query(`create trigger ${APPLIED_TABLE}_no_truncate before truncate on ${APPLIED_TABLE} for each statement execute function infopunks_migration_ledger_immutable()`);
}

async function history(client: PoolClient): Promise<MigrationRunRecord[]> {
  const result = await client.query(`select run_id as sequence,migration_id,migration_file,checksum,outcome,started_at,finished_at,duration_ms,error_code from ${HISTORY_TABLE} order by run_id`);
  return result.rows.map((row) => ({ ...row, sequence: Number(row.sequence), started_at: new Date(row.started_at).toISOString(), finished_at: new Date(row.finished_at).toISOString(), duration_ms: Number(row.duration_ms) }));
}

async function insertHistory(client: PoolClient, entry: MigrationFileEntry, outcome: MigrationRunOutcome, started: Date, errorCode: string | null) {
  const done = new Date();
  const result = await client.query<{ run_id: string }>(`insert into ${HISTORY_TABLE}(migration_id,migration_file,checksum,outcome,started_at,finished_at,duration_ms,error_code) values($1,$2,$3,$4,$5,$6,$7,$8) returning run_id`,
    [migrationId(entry), entry.file, entry.sha256, outcome, started, done, Math.max(0, done.getTime() - started.getTime()), errorCode]);
  return { id: result.rows[0].run_id, finished: done };
}

async function schemaMatchesBaseline(client: PoolClient, baseline: string) {
  const status = await inspectRhChainMigrationLedger(client);
  if (!status.database_reachable) return false;
  for (const item of status.migrations) {
    const id = item.file.match(/_(\d{3})_/)?.[1];
    if (!id) return false;
    if (Number(id) <= Number(baseline) && item.state !== 'applied') return false;
    if (Number(id) > Number(baseline) && item.state === 'applied') return false;
  }
  return true;
}

export async function runPostgresMigrations(pool: Pool, options: { mode?: 'validate' | 'apply'; directory?: string; adoptBaseline?: string } = {}): Promise<MigrationRunReport> {
  const mode = options.mode ?? 'apply';
  const inventory = inspectMigrationDirectory(options.directory);
  const report = reportBase(mode, inventory.errors);
  if (!inventory.valid) return report;
  if (options.adoptBaseline && !SUPPORTED_BASELINES.includes(options.adoptBaseline as typeof SUPPORTED_BASELINES[number])) {
    report.repository_errors.push('unsupported_baseline:' + options.adoptBaseline); report.valid = false; return report;
  }
  const client = await pool.connect().catch(() => null);
  if (!client) { report.failures.push('database_unreachable'); report.valid = false; return report; }
  let locked = false;
  try {
    await client.query('select pg_advisory_lock(hashtextextended($1,0))', [LOCK_NAME]); locked = true;
    await ensureLedger(client);
    report.database = 'reachable';
    const rows = await client.query<{ migration_id: string; migration_file: string; checksum: string; outcome: string }>(`select migration_id,migration_file,checksum,outcome from ${APPLIED_TABLE} order by migration_id`);
    const entriesById = new Map(inventory.entries.map((entry) => [migrationId(entry), entry]));
    const applied = new Map(rows.rows.map((row) => [row.migration_id, row]));
    for (const row of rows.rows) {
      const entry = entriesById.get(row.migration_id);
      if (!entry) throw new MigrationRunnerError('unknown_applied_migration:' + row.migration_id);
      if (row.migration_file !== entry.file || row.checksum !== entry.sha256) throw new MigrationRunnerError('applied_migration_checksum_drift:' + row.migration_id);
    }
    const appliedSeq = [...applied.keys()].map((id) => Number(id.match(/_(\d{3})$/)?.[1])).sort((a,b)=>a-b);
    for (let i=0;i<appliedSeq.length;i++) if (appliedSeq[i] !== i+1) throw new MigrationRunnerError('migration_history_gap_or_reorder');

    if (applied.size === 0) {
      const schemaState = await inspectRhChainMigrationLedger(client);
      const existingObjects = await client.query<{ exists: boolean }>(`select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=current_schema() and c.relkind in ('r','p') and c.relname not in ($1,$2)) as exists`, [HISTORY_TABLE, APPLIED_TABLE]);
      const hasExistingSchema = schemaState.migrations.some((migration) => migration.state === 'applied') || existingObjects.rows[0]?.exists === true;
      if (hasExistingSchema && !options.adoptBaseline) throw new MigrationRunnerError('unledgered_existing_database_refused');
      if (options.adoptBaseline) {
        const baselineEntries = inventory.entries.filter((entry) => sequence(entry) <= Number(options.adoptBaseline));
        if (migrationManifestChecksum(baselineEntries) !== SUPPORTED_BASELINE_MANIFESTS[options.adoptBaseline as typeof SUPPORTED_BASELINES[number]]) throw new MigrationRunnerError('historical_baseline_manifest_drift');
        if (!await schemaMatchesBaseline(client, options.adoptBaseline)) throw new MigrationRunnerError('historical_baseline_schema_mismatch');
        for (const entry of baselineEntries) {
          const started = new Date();
          await client.query('begin');
          try {
            const inserted = await insertHistory(client, entry, 'adopted', started, null);
            await client.query(`insert into ${APPLIED_TABLE}(migration_id,migration_file,checksum,applied_at,outcome,history_run_id) values($1,$2,$3,$4,'adopted',$5)`, [migrationId(entry),entry.file,entry.sha256,inserted.finished,inserted.id]);
            await client.query('commit');
          } catch (error) { await client.query('rollback'); throw error; }
        }
        report.baseline_adopted = options.adoptBaseline;
      }
    }

    const ledgerRows = await client.query<{ migration_id: string; migration_file: string; checksum: string }>(`select migration_id,migration_file,checksum from ${APPLIED_TABLE} order by migration_id`);
    const done = new Set(ledgerRows.rows.map((row) => row.migration_id));
    const pending = inventory.entries.filter((entry) => !done.has(migrationId(entry)));
    report.applied = [...done].sort(); report.pending = pending.map(migrationId);
    if (mode === 'apply') {
      for (let index = 0; index < pending.length; index += 1) {
        const entry = pending[index];
        const started = new Date();
        await client.query('begin');
        try {
          const sql = readFileSync(join(options.directory ?? join(process.cwd(),'migrations'), entry.file), 'utf8');
          await client.query(stripTransaction(sql));
          const inserted = await insertHistory(client, entry, 'applied', started, null);
          await client.query(`insert into ${APPLIED_TABLE}(migration_id,migration_file,checksum,applied_at,outcome,history_run_id) values($1,$2,$3,$4,'applied',$5)`, [migrationId(entry),entry.file,entry.sha256,inserted.finished,inserted.id]);
          await client.query('commit');
          report.applied.push(migrationId(entry));
          report.pending = pending.slice(index + 1).map(migrationId);
        } catch (error) {
          await client.query('rollback').catch(() => undefined);
          const errorCode = error instanceof Error ? error.message.slice(0,180) : 'migration_execution_failed';
          report.failures.push(migrationId(entry) + ':' + errorCode);
          report.pending = pending.slice(index).map(migrationId);
          await client.query('begin');
          try { await insertHistory(client, entry, 'failed', started, errorCode); await client.query('commit'); } catch { await client.query('rollback').catch(() => undefined); }
          throw new MigrationRunnerError('migration_failed:' + migrationId(entry));
        }
      }
      report.pending = [];
    }
    report.history = await history(client);
    report.valid = report.failures.length === 0;
    return report;
  } catch (error) {
    report.failures.push(error instanceof MigrationRunnerError ? error.code : 'migration_runner_failed');
    report.valid = false;
    if (report.database === 'reachable') report.history = await history(client).catch(() => []);
    return report;
  } finally {
    if (locked) await client.query('select pg_advisory_unlock(hashtextextended($1,0))', [LOCK_NAME]).catch(() => undefined);
    client.release();
  }
}

export function migrationManifestChecksum(entries: MigrationFileEntry[]) {
  if (!entries.length || entries.some((entry, index) => !entry.sha256 || !entry.down_file || Number(entry.id) !== index + 1)) throw new MigrationRunnerError('migration_manifest_invalid');
  return sha256(entries.map((entry) => `${migrationId(entry)}:${entry.sha256}`).join('\n'));
}
