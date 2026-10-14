import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { inspectPostgresMigrationHistory } from '../../src/services/postgresMigrationPreflight';
import { runPostgresMigrations } from '../../src/services/postgresMigrationRunner';
import { inspectMigrationDirectory } from '../../src/services/migrationInventory';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
async function isolated() {
  const schema = 'preflight_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({ connectionString: url });
  await admin.query(`create schema ${schema}`);
  const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
  return { pool, close: async () => { await pool.end(); await admin.query(`drop schema ${schema} cascade`); await admin.end(); } };
}
async function catalog(pool: pg.Pool) {
  return (await pool.query(`select c.oid,c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=current_schema() order by c.relname`)).rows;
}

describe.skipIf(!url)('read-only migration authority preflight', () => {
  it('upgrades the recorded Track A 021 ledger without replacing its applied identities or checksums', async () => {
    const db = await isolated();
    try {
      // Establish only the ledger, then reproduce the operator-recorded 001–021 history.
      expect((await runPostgresMigrations(db.pool,{mode:'validate'})).valid).toBe(true);
      const recorded: Array<{migration_id:string;migration_file:string;checksum:string}> = JSON.parse(readFileSync('tests/fixtures/historical-track-a-021-ledger.json','utf8'));
      for (const row of recorded) {
        await db.pool.query(readFileSync(join('migrations',row.migration_file),'utf8'));
        const history = await db.pool.query('insert into infopunks_schema_migration_history(migration_id,migration_file,checksum,outcome,started_at,finished_at,duration_ms) values($1,$2,$3,\'applied\',now(),now(),0) returning run_id',[row.migration_id,row.migration_file,row.checksum]);
        await db.pool.query('insert into infopunks_schema_migrations(migration_id,migration_file,checksum,applied_at,outcome,history_run_id) values($1,$2,$3,now(),\'applied\',$4)',[row.migration_id,row.migration_file,row.checksum,history.rows[0].run_id]);
      }
      const before = (await db.pool.query('select * from infopunks_schema_migrations order by migration_id')).rows;
      expect(await inspectPostgresMigrationHistory(db.pool)).toMatchObject({valid:true,classification:'canonical-ledger',applied:recorded});
      const upgraded = await runPostgresMigrations(db.pool);
      expect(upgraded.valid).toBe(true);
      expect(upgraded.applied).toHaveLength(22);
      expect((await db.pool.query('select * from infopunks_schema_migrations order by migration_id')).rows.slice(0,21)).toEqual(before);
      expect(upgraded.history.at(-1)?.migration_id).toBe('20261008_022');
    } finally { await db.close(); }
  },30_000);

  it('inspects a fresh database in a read-only transaction without creating a ledger', async () => {
    const db = await isolated(); const client = await db.pool.connect();
    try {
      await client.query('begin read only');
      expect(await inspectPostgresMigrationHistory(client)).toMatchObject({ valid: true, classification: 'fresh', applied: [] });
      await client.query('commit');
      expect(await catalog(db.pool)).toEqual([]);
    } finally { await client.query('rollback'); client.release(); await db.close(); }
  });

  it('rejects the exact competing canonical-access 022 before any ledger or schema mutation', async () => {
    const db = await isolated();
    try {
      for (const entry of inspectMigrationDirectory().entries.slice(0,21)) await db.pool.query(readFileSync(join('migrations',entry.file),'utf8'));
      // Preserved bytes of the uncommitted UI-SEC2 proposal, never a runnable canonical migration.
      await db.pool.query(readFileSync('tests/fixtures/historical-022-canonical-access.up.sql','utf8'));
      const before = await catalog(db.pool);
      expect(await inspectPostgresMigrationHistory(db.pool)).toMatchObject({ valid: false, classification: 'ambiguous', failures: ['unqualified_canonical_access_history'] });
      expect(await runPostgresMigrations(db.pool)).toMatchObject({ valid: false, failures: ['unqualified_canonical_access_history'] });
      expect(await catalog(db.pool)).toEqual(before);
      expect(before.some(row => row.relname === 'infopunks_schema_migrations')).toBe(false);
    } finally { await db.close(); }
  },30_000);

  it('rejects canonical checksum drift before recreating ledger triggers or functions', async () => {
    const db = await isolated(); const directory = mkdtempSync(join(tmpdir(),'radar-preflight-drift-'));
    try {
      expect((await runPostgresMigrations(db.pool)).valid).toBe(true);
      cpSync('migrations',directory,{recursive:true});
      writeFileSync(join(directory,'20260719_001_rh_chain_market_snapshot_memory.up.sql'),'begin; select 1; commit;');
      const before = (await db.pool.query('select oid,tgname from pg_trigger where tgrelid=\'infopunks_schema_migrations\'::regclass order by tgname')).rows;
      const result = await runPostgresMigrations(db.pool,{directory});
      expect(result.valid).toBe(false);
      expect(result.failures).toContain('applied_migration_checksum_drift:20260719_001');
      expect((await db.pool.query('select oid,tgname from pg_trigger where tgrelid=\'infopunks_schema_migrations\'::regclass order by tgname')).rows).toEqual(before);
    } finally { rmSync(directory,{recursive:true,force:true}); await db.close(); }
  },30_000);

  it('leaves an unledgered or mismatched historical schema untouched when refusing adoption', async () => {
    const db = await isolated();
    try {
      await db.pool.query('create table unknown_history(id integer)');
      const before = await catalog(db.pool);
      expect(await runPostgresMigrations(db.pool)).toMatchObject({valid:false,failures:['unledgered_existing_database_refused']});
      expect(await runPostgresMigrations(db.pool,{adoptBaseline:'017'})).toMatchObject({valid:false,failures:['historical_baseline_schema_mismatch']});
      expect(await catalog(db.pool)).toEqual(before);
    } finally { await db.close(); }
  });
});
