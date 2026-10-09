import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../../src/services/postgresMigrationRunner';
import { inspectMigrationDirectory } from '../../src/services/migrationInventory';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
async function isolatedSchema() {
  const schema = 'migration_runner_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url, max: 2 });
  await admin.query(`create schema ${schema}`);
  const pool = new pg.Pool({ connectionString: url, max: 2, options: `-c search_path=${schema}` });
  return { schema, pool, close: async () => { await pool.end(); await admin.query(`drop schema ${schema} cascade`); await admin.end(); } };
}

describe.skipIf(!url)('PostgreSQL migration runner', () => {
  it('applies a clean install once and repeat boot is idempotent', async () => {
    const db = await isolatedSchema();
    try {
      const first = await runPostgresMigrations(db.pool);
      expect(first.valid).toBe(true); expect(first.applied).toHaveLength(21); expect(first.pending).toEqual([]);
      const second = await runPostgresMigrations(db.pool);
      expect(second.valid).toBe(true); expect(second.applied).toHaveLength(21); expect(second.history).toHaveLength(21);
      await expect(db.pool.query('update infopunks_schema_migrations set checksum=checksum')).rejects.toMatchObject({ code: '55000' });
      await expect(db.pool.query('truncate infopunks_schema_migrations')).rejects.toMatchObject({ code: '55000' });
    } finally { await db.close(); }
  }, 30_000);

  it('serializes concurrent runners and records each migration exactly once', async () => {
    const db = await isolatedSchema();
    try {
      const outcomes = await Promise.all([runPostgresMigrations(db.pool), runPostgresMigrations(db.pool)]);
      expect(outcomes.every((result) => result.valid && !result.pending.length)).toBe(true);
      const rows = await db.pool.query('select count(*)::int as count from infopunks_schema_migrations');
      const runs = await db.pool.query("select count(*)::int as count from infopunks_schema_migration_history where outcome='applied'");
      expect(rows.rows[0].count).toBe(21); expect(runs.rows[0].count).toBe(21);
    } finally { await db.close(); }
  }, 30_000);

  it('refuses implicit adoption and performs a pinned, verified 017 historical upgrade', async () => {
    const db = await isolatedSchema();
    try {
      const client = await db.pool.connect();
      try { for (let n=1;n<=17;n++) { const entry = inspectMigrationDirectory().entries[n-1]; await client.query(readFileSync(join(process.cwd(),'migrations',entry.file),'utf8')); } }
      finally { client.release(); }
      const refused = await runPostgresMigrations(db.pool);
      expect(refused.valid).toBe(false); expect(refused.failures).toContain('unledgered_existing_database_refused');
      const upgraded = await runPostgresMigrations(db.pool, { adoptBaseline: '017' });
      expect(upgraded.valid, JSON.stringify(upgraded)).toBe(true); expect(upgraded.baseline_adopted).toBe('017'); expect(upgraded.applied).toHaveLength(21); expect(upgraded.pending).toEqual([]);
      expect(upgraded.history.filter((row) => row.outcome === 'adopted')).toHaveLength(17);
      expect(upgraded.history.filter((row) => row.outcome === 'applied')).toHaveLength(4);
    } finally { await db.close(); }
  }, 30_000);

  it('supports the verified 020 baseline and applies only migration 021', async () => {
    const db = await isolatedSchema();
    try {
      const client = await db.pool.connect();
      try { for (const entry of inspectMigrationDirectory().entries.slice(0,20)) await client.query(readFileSync(join(process.cwd(),'migrations',entry.file),'utf8')); }
      finally { client.release(); }
      const result = await runPostgresMigrations(db.pool, { adoptBaseline: '020' });
      expect(result.valid).toBe(true); expect(result.baseline_adopted).toBe('020'); expect(result.applied).toHaveLength(21);
      expect(result.history.filter((row) => row.outcome === 'adopted')).toHaveLength(20);
      expect(result.history.filter((row) => row.outcome === 'applied').map((row) => row.migration_id)).toEqual(['20261008_021']);
    } finally { await db.close(); }
  }, 30_000);

  it('records failure, leaves failed DDL unapplied, and retries from the failed migration', async () => {
    const db = await isolatedSchema(); const directory = mkdtempSync(join(tmpdir(), 'radar-migration-partial-'));
    try {
      cpSync(join(process.cwd(),'migrations'), directory, { recursive: true });
      writeFileSync(join(directory,'20260719_002_rh_chain_reviewed_classifications.up.sql'), 'begin; select * from table_that_does_not_exist; commit;');
      const failed = await runPostgresMigrations(db.pool, { directory });
      expect(failed.valid).toBe(false); expect(failed.applied).toEqual(['20260719_001']); expect(failed.pending[0]).toBe('20260719_002');
      expect(failed.history.at(-1)?.outcome).toBe('failed');
      const retry = await runPostgresMigrations(db.pool);
      expect(retry.valid).toBe(true); expect(retry.pending).toEqual([]); expect(retry.applied).toHaveLength(21);
    } finally { rmSync(directory, { recursive: true, force: true }); await db.close(); }
  }, 30_000);

  it('rejects checksum drift and modified historical baselines', async () => {
    const db = await isolatedSchema(); const directory = mkdtempSync(join(tmpdir(), 'radar-migration-drift-'));
    try {
      expect((await runPostgresMigrations(db.pool)).valid).toBe(true);
      cpSync(join(process.cwd(),'migrations'), directory, { recursive: true });
      writeFileSync(join(directory,'20260719_001_rh_chain_market_snapshot_memory.up.sql'), 'begin; select 1; commit;');
      const drift = await runPostgresMigrations(db.pool, { mode: 'validate', directory });
      expect(drift.valid).toBe(false); expect(drift.failures).toContain('applied_migration_checksum_drift:20260719_001');
    } finally { rmSync(directory, { recursive: true, force: true }); await db.close(); }
  }, 30_000);

  it('fails closed on unknown or reordered applied ledger identities', async () => {
    const unknown = await isolatedSchema();
    try {
      await runPostgresMigrations(unknown.pool);
      await unknown.pool.query("insert into infopunks_schema_migration_history(migration_id,migration_file,checksum,outcome,started_at,finished_at,duration_ms) values('20261009_022','20261009_022_unknown.up.sql',$1,'adopted',now(),now(),0)", ['a'.repeat(64)]);
      await unknown.pool.query("insert into infopunks_schema_migrations(migration_id,migration_file,checksum,applied_at,outcome,history_run_id) select migration_id,migration_file,checksum,finished_at,outcome,run_id from infopunks_schema_migration_history where migration_id='20261009_022'");
      const result = await runPostgresMigrations(unknown.pool, { mode: 'validate' });
      expect(result.valid).toBe(false); expect(result.failures).toContain('unknown_applied_migration:20261009_022');
    } finally { await unknown.close(); }

    const reordered = await isolatedSchema();
    try {
      await runPostgresMigrations(reordered.pool, { mode: 'validate' });
      const second = inspectMigrationDirectory().entries[1];
      await reordered.pool.query('insert into infopunks_schema_migration_history(migration_id,migration_file,checksum,outcome,started_at,finished_at,duration_ms) values($1,$2,$3,$4,now(),now(),0)', [second.file.slice(0,12),second.file,second.sha256,'adopted']);
      await reordered.pool.query('insert into infopunks_schema_migrations(migration_id,migration_file,checksum,applied_at,outcome,history_run_id) select migration_id,migration_file,checksum,finished_at,outcome,run_id from infopunks_schema_migration_history');
      const result = await runPostgresMigrations(reordered.pool, { mode: 'validate' });
      expect(result.valid).toBe(false); expect(result.failures).toContain('migration_history_gap_or_reorder');
    } finally { await reordered.close(); }
  }, 30_000);
});
