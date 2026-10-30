import pg from 'pg';
import { runPostgresMigrations } from '../services/postgresMigrationRunner';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stdout.write(`${JSON.stringify({ valid: false, database: 'unreachable', mode: process.argv.includes('--validate') ? 'validate' : 'apply', applied: [], pending: [], failures: ['database_url_required'], repository_errors: [], history: [] }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }
  const baselineIndex = process.argv.indexOf('--adopt-baseline');
  const baseline = baselineIndex >= 0 ? process.argv[baselineIndex + 1] : undefined;
  if (baselineIndex >= 0 && !baseline) throw new Error('--adopt-baseline requires a sequence such as 017');
  const pool = new pg.Pool({ connectionString: url, max: 1, application_name: 'infopunks-track-a-migration-runner' });
  try {
    const report = await runPostgresMigrations(pool, { mode: process.argv.includes('--validate') ? 'validate' : 'apply', adoptBaseline: baseline });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.valid || report.pending.length || report.failures.length) process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ valid: false, failures: [error instanceof Error ? error.message : 'migration_runner_failed'] }, null, 2)}\n`);
    process.exitCode = 1;
  } finally { await pool.end(); }
}
void main();
