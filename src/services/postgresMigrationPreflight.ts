import type { PoolClient } from 'pg';
import { inspectMigrationDirectory } from './migrationInventory';

export type MigrationPreflightReport = {
  valid: boolean;
  classification: 'fresh' | 'canonical-ledger' | 'unledgered-history' | 'ambiguous';
  schema: string | null;
  applied: Array<{ migration_id: string; migration_file: string; checksum: string }>;
  failures: string[];
};

/** SELECT-only inspection. Never creates, adopts, repairs or renumbers migration history. */
export async function inspectPostgresMigrationHistory(client: Pick<PoolClient, 'query'>, directory?: string): Promise<MigrationPreflightReport> {
  const report: MigrationPreflightReport = { valid: false, classification: 'ambiguous', schema: null, applied: [], failures: [] };
  const inventory = inspectMigrationDirectory(directory);
  if (!inventory.valid) { report.failures.push(...inventory.errors); return report; }
  try {
    const objects = await client.query<{ schema: string; name: string }>(`select current_schema() as schema, c.relname as name
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname=current_schema() and c.relkind in ('r','p') order by c.relname`);
    const schema = await client.query<{ schema: string }>('select current_schema() as schema');
    report.schema = schema.rows[0]?.schema ?? null;
    const names = new Set(objects.rows.map(row => row.name));
    // These identify the competing, unqualified canonical-access schema history.
    // Do not infer that it is interchangeable with publication_boundaries 022.
    const foreign = ['canonical_receipt_ownership', 'canonical_public_proofs', 'canonical_public_proof_events', 'canonical_public_rate_limits'].filter(name => names.has(name));
    if (foreign.length) { report.failures.push('unqualified_canonical_access_history'); return report; }
    const appliedExists = names.has('infopunks_schema_migrations');
    const historyExists = names.has('infopunks_schema_migration_history');
    if (appliedExists !== historyExists) { report.failures.push('partial_migration_ledger'); return report; }
    if (!appliedExists) {
      report.classification = names.size ? 'unledgered-history' : 'fresh';
      report.valid = true;
      return report;
    }
    const rows = await client.query<{ migration_id: string; migration_file: string; checksum: string }>('select migration_id,migration_file,checksum from infopunks_schema_migrations order by migration_id');
    report.applied = rows.rows;
    const expected = new Map(inventory.entries.map(entry => [entry.file.slice(0, 12), entry]));
    for (const row of rows.rows) {
      const entry = expected.get(row.migration_id);
      if (!entry) report.failures.push('unknown_applied_migration:' + row.migration_id);
      else if (row.migration_file !== entry.file || row.checksum !== entry.sha256) report.failures.push('applied_migration_checksum_drift:' + row.migration_id);
    }
    const sequences = rows.rows.map(row => Number(row.migration_id.match(/_(\d{3})$/)?.[1])).sort((a,b) => a-b);
    if (sequences.some((value,index) => value !== index+1)) report.failures.push('migration_history_gap_or_reorder');
    const detached = await client.query<{ invalid: boolean }>(`select exists(select 1 from infopunks_schema_migrations a
      left join infopunks_schema_migration_history h on h.run_id=a.history_run_id
      where h.run_id is null or h.migration_id<>a.migration_id or h.migration_file<>a.migration_file
        or h.checksum<>a.checksum or h.outcome<>a.outcome) as invalid`);
    if (detached.rows[0]?.invalid) report.failures.push('applied_migration_history_mismatch');
    report.valid = report.failures.length === 0;
    report.classification = report.valid ? 'canonical-ledger' : 'ambiguous';
    return report;
  } catch {
    report.failures.push('migration_preflight_failed');
    return report;
  }
}
