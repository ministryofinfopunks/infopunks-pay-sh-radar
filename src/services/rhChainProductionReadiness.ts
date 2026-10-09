import type pg from 'pg';
import type { RuntimeConfig } from '../config/env';

export type RhChainMigrationRequirement = { id: string; file: string; tables: string[]; indexes: string[]; checks?: string[] };
export const RH_CHAIN_REQUIRED_MIGRATIONS: readonly RhChainMigrationRequirement[] = [
  { id: '20260719_001', file: '20260719_001_rh_chain_market_snapshot_memory.up.sql', tables: ['rh_chain_market_snapshots'], indexes: ['rh_chain_market_snapshots_token_captured_idx', 'rh_chain_market_snapshots_pair_captured_idx', 'rh_chain_market_snapshots_provider_captured_idx', 'rh_chain_market_snapshots_captured_at_idx'] },
  { id: '20260719_002', file: '20260719_002_rh_chain_reviewed_classifications.up.sql', tables: ['rh_chain_reviewed_classifications', 'rh_chain_reviewed_classification_audit'], indexes: ['rh_chain_reviewed_classifications_status_updated_idx', 'rh_chain_reviewed_classifications_approved_effective_idx', 'rh_chain_reviewed_classification_audit_contract_time_idx'], checks: ['rh_chain_reviewed_classifications_chain_check', 'rh_chain_reviewed_classifications_contract_check', 'rh_chain_reviewed_classifications_primary_layer_check', 'rh_chain_reviewed_classifications_status_check', 'rh_chain_reviewed_classifications_version_check', 'rh_chain_reviewed_classifications_payload_check', 'rh_chain_reviewed_classifications_timestamps_check', 'rh_chain_reviewed_classifications_approved_check', 'rh_chain_reviewed_classifications_approved_active_check', 'rh_chain_reviewed_classifications_superseded_check', 'rh_chain_reviewed_classification_audit_chain_check', 'rh_chain_reviewed_classification_audit_contract_check', 'rh_chain_reviewed_classification_audit_version_check', 'rh_chain_reviewed_classification_audit_action_check', 'rh_chain_reviewed_classification_audit_reviewer_check', 'rh_chain_reviewed_classification_audit_payload_check'] },
  { id: '20260719_003', file: '20260719_003_rh_chain_classification_layer_vocabulary.up.sql', tables: ['rh_chain_reviewed_classifications'], indexes: [] },
  { id: '20260719_004', file: '20260719_004_rh_chain_attention_quality_receipts.up.sql', tables: ['rh_chain_attention_receipts'], indexes: ['rh_chain_attention_receipts_contract_created_idx', 'rh_chain_attention_receipts_status_idx'] },
  { id: '20260719_005', file: '20260719_005_rh_chain_project_claims.up.sql', tables: ['rh_chain_projects', 'rh_chain_project_claims', 'rh_chain_project_evidence', 'rh_chain_project_observations', 'rh_chain_project_verdicts', 'rh_chain_intelligence_receipts', 'rh_chain_project_audit'], indexes: ['rh_chain_projects_slug_idx', 'rh_chain_projects_review_idx', 'rh_chain_project_claims_project_idx', 'rh_chain_project_evidence_project_idx', 'rh_chain_project_observations_project_idx', 'rh_chain_project_verdicts_project_idx', 'rh_chain_intelligence_receipts_project_idx', 'rh_chain_intelligence_receipts_integrity_hash_idx', 'rh_chain_project_audit_project_idx'] },
  { id: '20260720_006', file: '20260720_006_rh_chain_reviewer_workflow.up.sql', tables: ['rh_chain_project_contract_relationships'], indexes: ['rh_chain_project_contract_relationships_project_idx', 'rh_chain_project_contract_relationships_contract_idx', 'rh_chain_project_contract_relationships_active_contract_idx', 'rh_chain_project_contract_relationships_active_primary_idx'] },
  { id: '20260813_007', file: '20260813_007_infopunks_4663_phase1.up.sql', tables: ['rh_4663_genesis_wallets', 'rh_4663_pulse_calls', 'rh_4663_events', 'rh_4663_today_editions', 'rh_4663_signals'], indexes: ['rh_4663_pulse_calls_window_idx', 'rh_4663_events_detected_idx', 'rh_4663_signals_updated_idx'] },
  { id: '20260813_008', file: '20260813_008_infopunks_4663_close_the_loop.up.sql', tables: ['rh_4663_pulse_window_resolutions', 'rh_4663_resolution_receipts', 'rh_4663_window_anchors'], indexes: ['rh_4663_resolution_receipts_wallet_idx'], checks: ['rh_4663_resolution_receipts_immutable', 'rh_4663_published_resolution_immutable', 'rh_4663_confirmed_anchor_immutable'] },
  { id: '20260814_009', file: '20260814_009_infopunks_4663_make_the_chain_speak.up.sql', tables: ['rh_4663_observations', 'rh_4663_signal_candidates', 'rh_4663_signal_publications', 'rh_4663_signal_distribution', 'rh_4663_signal_corrections', 'rh_4663_provider_health'], indexes: ['rh_4663_observations_subject_metric_idx', 'rh_4663_observations_observed_idx', 'rh_4663_signal_candidates_state_idx', 'rh_4663_signal_publications_archive_idx', 'rh_4663_signal_distribution_state_idx', 'rh_4663_signal_corrections_signal_idx'], checks: ['rh_4663_signal_publications_immutable', 'rh_4663_signal_corrections_immutable'] },
  { id: '20260908_010', file: '20260908_010_rh4663_product_intelligence.up.sql', tables: ['rh4663_product_intelligence_events'], indexes: ['rh4663_product_intelligence_events_window_idx', 'rh4663_product_intelligence_events_campaign_window_idx', 'rh4663_product_intelligence_events_call_idx'] },
  { id: '20261007_011', file: '20261007_011_canonical_receipt_spine.up.sql', tables: ['observation_receipts', 'judgment_receipts', 'execution_receipts', 'evaluation_receipts', 'judgment_observations'], indexes: ['observation_receipts_subject_idx', 'judgment_receipts_subject_idx', 'execution_receipts_judgment_idx', 'evaluation_receipts_execution_idx', 'judgment_observations_observation_idx'], checks: [...['observation_receipts', 'judgment_receipts', 'execution_receipts', 'evaluation_receipts', 'judgment_observations'].flatMap((table) => [table + '_immutable', table + '_no_truncate']), 'canonical_judgment_links', 'canonical_join_links'] },
  { id: '20261007_012', file: '20261007_012_judgment_requests.up.sql', tables: ['judgment_requests'], indexes: ['observation_receipts_judgment_scope_idx'] },
  { id: '20261007_013', file: '20261007_013_execution_proof_uniqueness.up.sql', tables: [], indexes: ['execution_proof_one_authorization_idx', 'execution_proof_one_settlement_idx'] },
  { id: '20261007_014', file: '20261007_014_derived_score_projection.up.sql', tables: [], indexes: [], checks: ['evaluation_score_policy_valid'] },
  { id: '20261007_015', file: '20261007_015_economic_judgment_engine.up.sql', tables: ['economic_engine_records'], indexes: ['economic_engine_principal_idx', 'economic_engine_nonce_idx', 'economic_engine_settlement_idx'], checks: ['economic_engine_memory_guard'] },
  { id: '20261008_016', file: '20261008_016_rh_usdg_accounting.up.sql', tables: ['settled_judgment_revenue', 'recorded_protocol_costs'], indexes: ['execution_proof_one_authorization_idx', 'execution_proof_one_settlement_idx'], checks: ['settled_judgment_revenue_immutable', 'settled_judgment_revenue_no_truncate', 'recorded_protocol_costs_immutable', 'recorded_protocol_costs_no_truncate'] },
  { id: '20261008_017', file: '20261008_017_ipx_launch.up.sql', tables: ['ipx_genesis_calls_v2', 'ipx_launch_policies', 'ipx_identity_mappings', 'ipx_solana_observations', 'ipx_solana_cursors', 'ipx_economic_receipts'], indexes: [], checks: ['ipx_policy_immutable', 'ipx_genesis_immutable', 'ipx_identity_immutable', 'ipx_solana_immutable', 'ipx_economic_immutable'] },
  { id: '20261008_018', file: '20261008_018_decision_context.up.sql', tables: ['decision_contexts'], indexes: [], checks: ['decision_contexts_immutable', 'decision_contexts_no_truncate', 'canonical_judgment_context', 'judgment_receipt_version_context_check'] },
  { id: '20261008_019', file: '20261008_019_execution_score_eligibility.up.sql', tables: [], indexes: ['execution_qualifying_settlement_once_idx', 'execution_qualifying_judgment_once_idx'] },
  { id: '20261008_020', file: '20261008_020_receipt_acceptance.up.sql', tables: ['canonical_receipt_acceptances', 'canonical_receipt_quarantine'], indexes: ['canonical_receipt_acceptances_kind_sequence'], checks: ['canonical_receipt_acceptances_immutable', 'canonical_receipt_acceptances_no_truncate', 'canonical_receipt_quarantine_immutable', 'canonical_receipt_quarantine_no_truncate', 'decision_contexts_version_check'] },
  { id: '20261008_021', file: '20261008_021_free_assessment_attempts.up.sql', tables: ['free_assessment_attempts'], indexes: [], checks: ['free_assessment_attempts_immutable', 'free_assessment_attempts_no_truncate'] }
] as const;

export type RhChainMigrationStatus = { id: string; file: string; state: 'applied' | 'pending'; missing_tables: string[]; missing_indexes: string[]; missing_checks: string[] };
export type RhChainMigrationLedger = { database_reachable: boolean; migration_runner: 'external_only'; migrations: RhChainMigrationStatus[]; pending_migrations: string[]; required_tables: string[]; required_indexes: string[]; error_code: string | null };
type Queryable = Pick<pg.Pool, 'query'>;

const ALL_REQUIRED_CHECKS = [...new Set(RH_CHAIN_REQUIRED_MIGRATIONS.flatMap((migration) => migration.checks ?? []))];

/** Reads schema signatures only. It intentionally never creates a table or applies DDL. */
export async function inspectRhChainMigrationLedger(pool: Queryable | null): Promise<RhChainMigrationLedger> {
  const requiredTables = [...new Set(RH_CHAIN_REQUIRED_MIGRATIONS.flatMap((migration) => migration.tables))];
  const requiredIndexes = [...new Set(RH_CHAIN_REQUIRED_MIGRATIONS.flatMap((migration) => migration.indexes))];
  if (!pool) return ledger(false, requiredTables, requiredIndexes, requiredTables, requiredIndexes, false, 'database_not_configured');
  try {
    const [tables, indexes, vocabulary, missingChecks] = await Promise.all([
      pool.query<{ name: string }>('select value as name from unnest($1::text[]) value where to_regclass(value) is null order by value', [requiredTables]),
      pool.query<{ name: string }>('select value as name from unnest($1::text[]) value where not exists (select 1 from pg_indexes where schemaname = current_schema() and indexname = value) order by value', [requiredIndexes]),
      pool.query<{ definition: string }>("select pg_get_constraintdef(oid) as definition from pg_constraint where conname='rh_chain_reviewed_classifications_primary_layer_check' limit 1"),
      pool.query<{ name: string }>("select value as name from unnest($1::text[]) value where not exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where t.tgname=value and n.nspname=current_schema() and t.tgenabled in ('O','A')) and not exists (select 1 from pg_constraint c join pg_namespace n on n.oid=c.connamespace where c.conname=value and n.nspname=current_schema()) order by value", [ALL_REQUIRED_CHECKS])
    ]);
    const missing = missingChecks.rows.map((row) => row.name);
    if (!vocabulary.rows.some((row) => row.definition.includes("'consumer'"))) missing.push('consumer_primary_layer_vocabulary');
    return ledger(true, requiredTables, requiredIndexes, tables.rows.map((row) => row.name), indexes.rows.map((row) => row.name), true, null, missing);
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
function ledger(databaseReachable: boolean, requiredTables: string[], requiredIndexes: string[], missingTables: string[], missingIndexes: string[], _vocabularyApplied: boolean, errorCode: string | null, missingChecks: string[] = ALL_REQUIRED_CHECKS): RhChainMigrationLedger {
  const migrations = RH_CHAIN_REQUIRED_MIGRATIONS.map((migration) => { const tables = migration.tables.filter((table) => missingTables.includes(table)); const indexes = migration.indexes.filter((index) => missingIndexes.includes(index)); const checks = (migration.checks ?? []).filter((check) => missingChecks.includes(check)); if (migration.id === '20260719_003' && missingChecks.includes('consumer_primary_layer_vocabulary')) checks.push('consumer_primary_layer_vocabulary'); return { id: migration.id, file: migration.file, state: tables.length || indexes.length || checks.length ? 'pending' as const : 'applied' as const, missing_tables: tables, missing_indexes: indexes, missing_checks: checks }; });
  return { database_reachable: databaseReachable, migration_runner: 'external_only', migrations, pending_migrations: migrations.filter((migration) => migration.state === 'pending').map((migration) => migration.id), required_tables: requiredTables, required_indexes: requiredIndexes, error_code: errorCode };
}
function migrationReady(ledger: RhChainMigrationLedger, ids: string[]) { return ids.every((id) => ledger.migrations.find((migration) => migration.id === id)?.state === 'applied'); }
function snapshotFreshness(value: string | null, maxStaleSeconds: number) { if (!value || Number.isNaN(Date.parse(value))) return 'unavailable' as const; return Date.now() - Date.parse(value) <= maxStaleSeconds * 1000 ? 'fresh' as const : 'stale' as const; }
async function safeCount(action: () => Promise<number>) { try { return await action(); } catch { return null; } }
