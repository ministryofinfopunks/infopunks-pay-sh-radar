import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';
import {
  RH_PULSE_GATE_DATABASE_URL,
  assertSafeGateDatabaseUrl
} from './lib/rh-pulse-postgres-gate-env.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');

export async function applyGateMigrations(databaseUrl = RH_PULSE_GATE_DATABASE_URL) {
  assertSafeGateDatabaseUrl(databaseUrl);
  const client = new pg.Client({ connectionString: databaseUrl });
  const applied = [];
  await client.connect();
  try {
    await client.query(`
      create table if not exists infopunks_schema_migrations (
        migration_id text primary key,
        filename text not null unique,
        sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
        duration_ms integer not null check (duration_ms >= 0),
        applied_at timestamptz not null default clock_timestamp()
      )
    `);
    await client.query("select pg_advisory_lock(hashtext('infopunks_schema_migrations'))");
    const migrationDir = join(repositoryRoot, 'migrations');
    const filenames = (await readdir(migrationDir))
      .filter((name) => name.endsWith('.up.sql'))
      .sort();
    for (const filename of filenames) {
      const migrationId = filename.split('_').slice(0, 2).join('_').replace('.up.sql', '');
      const sql = await readFile(join(migrationDir, filename), 'utf8');
      const hash = createHash('sha256').update(sql, 'utf8').digest('hex');
      const prior = await client.query(
        'select sha256 from infopunks_schema_migrations where migration_id=$1',
        [migrationId]
      );
      if (prior.rows[0]) {
        if (prior.rows[0].sha256 !== hash) {
          throw new Error(`Migration hash drift detected for ${filename}`);
        }
        applied.push({ migrationId, filename, state: 'already_applied', durationMs: 0, sha256: hash });
        continue;
      }
      const started = performance.now();
      await client.query(sql);
      const durationMs = Math.max(0, Math.round(performance.now() - started));
      await client.query(
        `insert into infopunks_schema_migrations
          (migration_id, filename, sha256, duration_ms)
         values ($1,$2,$3,$4)`,
        [migrationId, filename, hash, durationMs]
      );
      applied.push({ migrationId, filename, state: 'applied', durationMs, sha256: hash });
    }
    return applied;
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('infopunks_schema_migrations'))").catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  applyGateMigrations()
    .then((migrations) => {
      process.stdout.write(`${JSON.stringify({
        databaseUrl: RH_PULSE_GATE_DATABASE_URL,
        migrations
      }, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'rh_pulse_postgres_migration_failed'}\n`);
      process.exitCode = 1;
    });
}

