import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

/** Every caller owns a schema, checked-out migration client, and explicit teardown. */
export async function createCanonicalTestDatabase(connectionString: string, prefix: string, migrations: string[]) {
  const schema = prefix + '_' + randomUUID().replaceAll('-', '');
  if (!/^[a-z0-9_]+$/.test(schema)) throw new Error('invalid_test_schema');
  const pool = new pg.Pool({ connectionString, application_name: 'canonical_test_' + schema, options: `-c search_path=${schema}` });
  const close = async () => {
    try {
      if (pool.waitingCount !== 0 || pool.totalCount !== pool.idleCount) throw new Error('test_postgres_client_not_released');
      await pool.query(`drop schema if exists ${schema} cascade`);
    } finally { await pool.end(); }
  };
  const client = await pool.connect().catch(async error => { await pool.end(); throw error; });
  try {
    await client.query(`create schema ${schema}`);
    for (const migration of migrations) await client.query(readFileSync('migrations/' + migration + '.up.sql', 'utf8'));
  } catch (error) {
    await client.query('rollback'); client.release(); await close(); throw error;
  }
  client.release();
  return { pool, schema, close };
}

/** Failed rollback migrations must not leave an aborted transaction in a pooled connection. */
export async function expectRollbackMigrationFailure(pool: pg.Pool, migration: string, message?: string) {
  const client = await pool.connect();
  try {
    let failure: unknown;
    try { await client.query(readFileSync('migrations/' + migration + '.down.sql', 'utf8')); }
    catch (error) { failure = error; }
    if (!failure || (message && (!(failure instanceof Error) || !failure.message.includes(message)))) throw new Error('expected_rollback_migration_failure');
  } finally { await client.query('rollback'); client.release(); }
}
