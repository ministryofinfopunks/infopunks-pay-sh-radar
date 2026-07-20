import pg from 'pg';
import { inspectRhChainMigrationLedger } from '../src/services/rhChainProductionReadiness';

const requireReady = process.argv.includes('--require-ready');
const environment = process.argv.find((value) => value.startsWith('--environment='))?.slice('--environment='.length) ?? process.env.NODE_ENV ?? 'development';
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, max: 1 }) : null;

async function main() {
  try {
    const ledger = await inspectRhChainMigrationLedger(pool);
    process.stdout.write(`${JSON.stringify({ environment, ...ledger }, null, 2)}\n`);
    if (requireReady && (!ledger.database_reachable || ledger.pending_migrations.length)) process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write('rh_chain_migration_status_failed\n');
  process.exitCode = 1;
});
