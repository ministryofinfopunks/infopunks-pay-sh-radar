import type pg from 'pg';
import type { RuntimeConfig } from '../config/env';

export type RhChainMigrationRequirement = { id: string; file: string; tables: string[]; indexes: string[] };
export const RH_CHAIN_REQUIRED_MIGRATIONS: readonly RhChainMigrationRequirement[] = [
  { id: '20260719_001', file: '20260719_001_rh_chain_market_snapshot_memory.up.sql', tables: ['rh_chain_market_snapshots'], indexes: ['rh_chain_market_snapshots_token_captured_idx', 'rh_chain_market_snapshots_pair_captured_idx', 'rh_chain_market_snapshots_provider_captured_idx', 'rh_chain_market_snapshots_captured_at_idx'] },
  { id: '20260719_002', file: '20260719_002_rh_chain_reviewed_classifications.up.sql', tables: ['rh_chain_reviewed_classifications', 'rh_chain_reviewed_classification_audit'], indexes: ['rh_chain_reviewed_classifications_status_updated_idx', 'rh_chain_reviewed_classifications_approved_effective_idx', 'rh_chain_reviewed_classification_audit_contract_time_idx'] },
  { id: '20260719_003', file: '20260719_003_rh_chain_classification_layer_vocabulary.up.sql', tables: ['rh_chain_reviewed_classifications'], indexes: [] },
  { id: '20260719_004', file: '20260719_004_rh_chain_attention_quality_receipts.up.sql', tables: ['rh_chain_attention_receipts'], indexes: ['rh_chain_attention_receipts_contract_created_idx', 'rh_chain_attention_receipts_status_idx'] },
  { id: '20260719_005', file: '20260719_005_rh_chain_project_claims.up.sql', tables: ['rh_chain_projects', 'rh_chain_project_claims', 'rh_chain_project_evidence', 'rh_chain_project_observations', 'rh_chain_project_verdicts', 'rh_chain_intelligence_receipts', 'rh_chain_project_audit'], indexes: ['rh_chain_projects_slug_idx', 'rh_chain_projects_review_idx', 'rh_chain_project_claims_project_idx', 'rh_chain_project_evidence_project_idx', 'rh_chain_project_observations_project_idx', 'rh_chain_project_verdicts_project_idx', 'rh_chain_intelligence_receipts_project_idx', 'rh_chain_intelligence_receipts_integrity_hash_idx', 'rh_chain_project_audit_project_idx'] },
  { id: '20260720_006', file: '20260720_006_rh_chain_reviewer_workflow.up.sql', tables: ['rh_chain_project_contract_relationships'], indexes: ['rh_chain_project_contract_relationships_project_idx', 'rh_chain_project_contract_relationships_contract_idx', 'rh_chain_project_contract_relationships_active_contract_idx', 'rh_chain_project_contract_relationships_active_primary_idx'] }
] as const;

export type RhChainMigrationStatus = { id: string; file: string; state: 'applied' | 'pending'; missing_tables: string[]; missing_indexes: string[]; missing_checks: string[] };
export type RhChainMigrationLedger = { database_reachable: boolean; migration_runner: 'external_only'; migrations: RhChainMigrationStatus[]; pending_migrations: string[]; required_tables: string[]; required_indexes: string[]; error_code: string | null };
type Queryable = Pick<pg.Pool, 'query'>;

/** Reads schema signatures only. It intentionally never creates a table or applies DDL. */
export async function inspectRhChainMigrationLedger(pool: Queryable | null): Promise<RhChainMigrationLedger> {
  const requiredTables = [...new Set(RH_CHAIN_REQUIRED_MIGRATIONS.flatMap((migration) => migration.tables))];
  const requiredIndexes = [...new Set(RH_CHAIN_REQUIRED_MIGRATIONS.flatMap((migration) => migration.indexes))];
  if (!pool) return ledger(false, requiredTables, requiredIndexes, requiredTables, requiredIndexes, false, 'database_not_configured');
  try {
    const [tables, indexes, vocabulary] = await Promise.all([
      pool.query<{ name: string }>('select value as name from unnest($1::text[]) value where to_regclass(value) is null order by value', [requiredTables]),
      pool.query<{ name: string }>('select value as name from unnest($1::text[]) value where not exists (select 1 from pg_indexes where schemaname = current_schema() and indexname = value) order by value', [requiredIndexes]),
      pool.query<{ definition: string }>("select pg_get_constraintdef(oid) as definition from pg_constraint where conname='rh_chain_reviewed_classifications_primary_layer_check' limit 1")
    ]);
    return ledger(true, requiredTables, requiredIndexes, tables.rows.map((row) => row.name), indexes.rows.map((row) => row.name), vocabulary.rows.some((row) => row.definition.includes("'consumer'")), null);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'database_query_failed';
    return ledger(false, requiredTables, requiredIndexes, requiredTables, requiredIndexes, false, code);
  }
}

export type RhChainOperationalReadiness = {
  generated_at: string;
  database: { reachable: boolean; required_tables_present: boolean; required_indexes_present: boolean };
  migrations: RhChainMigrationLedger;
  market_memory: { snapshot_ingestion_enabled: boolean; snapshot_history_enabled: boolean; latest_snapshot_at: string | null; freshness: 'fresh' | 'stale' | 'unavailable' };
  reviewed_classifications: { enabled: boolean; approved_count: number; conflict_count: number | null };
  attention_quality_v2: { enabled: boolean; storage_ready: boolean };
  project_claims: { enabled: boolean; storage_ready: boolean };
  intelligence_receipts: { enabled: boolean; storage_ready: boolean; publication_capable: boolean };
  project_directory: { enabled: boolean; storage_ready: boolean };
  review_console: { enabled: boolean; authentication_configured: boolean };
  stale_data_state: 'fresh' | 'stale' | 'unavailable';
  critical_incident_state: 'clear' | 'blocked';
  blockers: string[];
  provider_requests_in_path: 0;
};

export async function inspectRhChainOperationalReadiness(input: { pool: Queryable | null; config: RuntimeConfig; approvedClassificationCount: () => Promise<number>; classificationConflictCount: () => Promise<number> }): Promise<RhChainOperationalReadiness> {
  const [migrations, databaseFacts] = await Promise.all([inspectRhChainMigrationLedger(input.pool), inspectDatabaseFacts(input.pool)]);
  const flags = input.config;
  const projectStorageReady = migrationReady(migrations, ['20260719_005', '20260720_006']);
  const receiptStorageReady = projectStorageReady;
  const attentionStorageReady = migrationReady(migrations, ['20260719_001', '20260719_004']);
  const classificationStorageReady = migrationReady(migrations, ['20260719_002', '20260719_003']);
  const snapshotStorageReady = migrationReady(migrations, ['20260719_001']);
  const latestSnapshotAt = databaseFacts.latest_snapshot_at;
  const freshness = snapshotFreshness(latestSnapshotAt, flags.dexScreenerMaxStaleSeconds);
  const [approvedCount, conflictCount] = await Promise.all([
    classificationStorageReady ? safeCount(input.approvedClassificationCount) : Promise.resolve(0),
    classificationStorageReady ? safeCount(input.classificationConflictCount) : Promise.resolve(null)
  ]);
  const publicationCapable = flags.rhChainIntelligenceReceiptsEnabled && flags.rhChainReviewConsoleEnabled && Boolean(flags.rhChainReviewAdminToken) && receiptStorageReady;
  const blockers = [
    ...migrations.pending_migrations.map((id) => `pending_migration:${id}`),
    ...(flags.rhChainReviewedClassificationsEnabled && !classificationStorageReady ? ['reviewed_classifications_storage_not_ready'] : []),
    ...(flags.rhChainAttentionQualityV2Enabled && !attentionStorageReady ? ['attention_quality_storage_not_ready'] : []),
    ...(flags.rhChainProjectClaimsEnabled && !projectStorageReady ? ['project_claims_storage_not_ready'] : []),
    ...(flags.rhChainIntelligenceReceiptsEnabled && !publicationCapable ? ['intelligence_receipt_publication_not_ready'] : []),
    ...(flags.rhChainProjectDirectoryEnabled && !flags.rhChainProjectClaimsEnabled ? ['project_directory_requires_project_claims'] : []),
    ...(flags.rhChainReviewConsoleEnabled && !flags.rhChainReviewAdminToken ? ['review_console_auth_not_configured'] : [])
  ];
  const staleDataState = flags.rhChainMarketHistoryEnabled ? freshness : 'unavailable';
  return { generated_at: new Date().toISOString(), database: { reachable: migrations.database_reachable, required_tables_present: !migrations.migrations.some((migration) => migration.missing_tables.length), required_indexes_present: !migrations.migrations.some((migration) => migration.missing_indexes.length) }, migrations, market_memory: { snapshot_ingestion_enabled: flags.rhChainMarketIngestionEnabled || flags.rhChainAutomationEnabled, snapshot_history_enabled: flags.rhChainMarketHistoryEnabled || flags.rhChainAutomationEnabled, latest_snapshot_at: latestSnapshotAt, freshness }, reviewed_classifications: { enabled: flags.rhChainReviewedClassificationsEnabled, approved_count: approvedCount ?? 0, conflict_count: conflictCount }, attention_quality_v2: { enabled: flags.rhChainAttentionQualityV2Enabled, storage_ready: attentionStorageReady }, project_claims: { enabled: flags.rhChainProjectClaimsEnabled, storage_ready: projectStorageReady }, intelligence_receipts: { enabled: flags.rhChainIntelligenceReceiptsEnabled, storage_ready: receiptStorageReady, publication_capable: publicationCapable }, project_directory: { enabled: flags.rhChainProjectDirectoryEnabled, storage_ready: projectStorageReady }, review_console: { enabled: flags.rhChainReviewConsoleEnabled, authentication_configured: Boolean(flags.rhChainReviewAdminToken) }, stale_data_state: staleDataState, critical_incident_state: blockers.length ? 'blocked' : 'clear', blockers, provider_requests_in_path: 0 };
}

async function inspectDatabaseFacts(pool: Queryable | null) {
  if (!pool) return { latest_snapshot_at: null as string | null };
  try { const result = await pool.query<{ latest_snapshot_at: string | null }>('select max(captured_at)::text as latest_snapshot_at from rh_chain_market_snapshots'); return { latest_snapshot_at: result.rows[0]?.latest_snapshot_at ?? null }; } catch { return { latest_snapshot_at: null }; }
}
function ledger(databaseReachable: boolean, requiredTables: string[], requiredIndexes: string[], missingTables: string[], missingIndexes: string[], vocabularyApplied: boolean, errorCode: string | null): RhChainMigrationLedger {
  const migrations = RH_CHAIN_REQUIRED_MIGRATIONS.map((migration) => { const tables = migration.tables.filter((table) => missingTables.includes(table)); const indexes = migration.indexes.filter((index) => missingIndexes.includes(index)); const checks = migration.id === '20260719_003' && !vocabularyApplied ? ['consumer_primary_layer_vocabulary'] : []; return { id: migration.id, file: migration.file, state: tables.length || indexes.length || checks.length ? 'pending' as const : 'applied' as const, missing_tables: tables, missing_indexes: indexes, missing_checks: checks }; });
  return { database_reachable: databaseReachable, migration_runner: 'external_only', migrations, pending_migrations: migrations.filter((migration) => migration.state === 'pending').map((migration) => migration.id), required_tables: requiredTables, required_indexes: requiredIndexes, error_code: errorCode };
}
function migrationReady(ledger: RhChainMigrationLedger, ids: string[]) { return ids.every((id) => ledger.migrations.find((migration) => migration.id === id)?.state === 'applied'); }
function snapshotFreshness(value: string | null, maxStaleSeconds: number) { if (!value || Number.isNaN(Date.parse(value))) return 'unavailable' as const; return Date.now() - Date.parse(value) <= maxStaleSeconds * 1000 ? 'fresh' as const : 'stale' as const; }
async function safeCount(action: () => Promise<number>) { try { return await action(); } catch { return null; } }
