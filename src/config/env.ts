import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RuntimeConfig = {
  env: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string | null;
  databasePoolMax: number;
  adminToken: string | null;
  payShCatalogUrl: string | null;
  payShCatalogSource: 'live' | 'fixture';
  ingestionEnabled: boolean;
  allowFixtureFallback: boolean;
  payShIngestIntervalMs: number | null;
  monitorEnabled: boolean;
  monitorMode: 'disabled' | 'safe_metadata' | 'endpoint_health' | 'paid_execution_probe';
  monitorIntervalMs: number | null;
  monitorTimeoutMs: number | null;
  monitorMaxProviders: number | null;
  featuredProviderRotationMs: number;
  machineDemoSeed: boolean;
  rhChainLiveSnapshotsEnabled: boolean;
  rhChainProviderTimeoutMs: number;
  rhChainLiveTokenRouteTimeoutMs: number;
  rhChainCacheTtlSeconds: number | null;
  dexScreenerEnabled: boolean;
  dexScreenerBaseUrl: string;
  dexScreenerRhChainId: 'robinhood';
  dexScreenerTimeoutMs: number;
  dexScreenerCacheTtlSeconds: number;
  dexScreenerStaleWhileRevalidateSeconds: number;
  dexScreenerStaleIfErrorSeconds: number;
  dexScreenerMaxStaleSeconds: number;
  dexScreenerMaxBatchSize: number;
  dexScreenerMaxRetries: number;
  dexScreenerRetryBaseMs: number;
  dexScreenerMaxConcurrency: number;
  dexScreenerRateLimitPerSecond: number;
  blockscoutEnabled: boolean;
  blockscoutBaseUrl: string;
  blockscoutTimeoutMs: number;
  blockscoutCacheTtlSeconds: number;
  blockscoutMaxPageSize: number;
  rhChainBlockscoutUrl: string | null;
  rhChainReviewConsoleEnabled: boolean;
  rhChainReviewAdminToken: string | null;
  rhChainReviewedClassificationsEnabled: boolean;
  rhChainAttentionQualityV2Enabled: boolean;
  rhChainProjectClaimsEnabled: boolean;
  rhChainIntelligenceReceiptsEnabled: boolean;
  rhChainProjectDirectoryEnabled: boolean;
  rhChainAutomationEnabled: boolean;
  rhChainMarketIngestionEnabled: boolean;
  rhChainMarketHistoryEnabled: boolean;
  rhChainAutomationInstanceId: string;
  rhChainJobLockTtlMs: number;
  rhChainChainPulseIntervalMs: number;
  rhChainMemePulseIntervalMs: number;
  rhChainLaunchpadIntervalMs: number;
  rhChainReceiptDraftCron: string | null;
  rhChainPublicRateLimitEnabled: boolean;
  rhChainPublicRateLimitWindowMs: number;
  rhChainPublicRateLimitMax: number;
  rhChainDuplicateWindowMs: number;
  rh4663Phase2Enabled: boolean;
  rh4663ResolutionSigningConfigured: boolean;
  rh4663Phase3Enabled: boolean;
  rh4663Phase3IngestionEnabled: boolean;
  rh4663Phase3CandidateGenerationEnabled: boolean;
  rh4663Phase3PublicationEnabled: boolean;
  rh4663Phase3AutoPublicationEnabled: boolean;
  rh4663Phase3ExternalDistributionEnabled: boolean;
  rh4663Phase3ShadowMode: boolean;
  rh4663Phase3IntervalMs: number;
  rh4663Phase2ProductionProofVerified: boolean;
  frontendOrigin: string | null;
  version: string;
  /** Features requested by configuration but deliberately unavailable at runtime. */
  disabledFeatures: Record<string, string>;
};

export type RuntimeConfigurationVerification = {
  event: 'runtime_configuration_verification';
  status: 'valid' | 'degraded' | 'invalid';
  environment: string;
  requirements: Array<{ name: string; state: 'configured' | 'missing' | 'defaulted' | 'invalid' }>;
  disabled_features: Array<{ feature: string; reason: string }>;
  errors: string[];
};

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const port = readPort(env.PORT, isProduction);
  const config: RuntimeConfig = {
    env: nodeEnv,
    isProduction,
    port,
    databaseUrl: optionalString(env.DATABASE_URL),
    databasePoolMax: readPositiveInteger('DATABASE_POOL_MAX', env.DATABASE_POOL_MAX, 10),
    adminToken: optionalString(env.INFOPUNKS_ADMIN_TOKEN),
    payShCatalogUrl: readOptionalUrl('PAY_SH_CATALOG_URL', env.PAY_SH_CATALOG_URL),
    payShCatalogSource: readCatalogSource(env.PAYSH_CATALOG_SOURCE),
    ingestionEnabled: readBoolean('INGESTION_ENABLED', env.INGESTION_ENABLED, true),
    allowFixtureFallback: readBoolean('PAYSH_ALLOW_FIXTURE_FALLBACK', env.PAYSH_ALLOW_FIXTURE_FALLBACK, !isProduction),
    payShIngestIntervalMs: readOptionalPositiveInteger('PAY_SH_INGEST_INTERVAL_MS', env.PAY_SH_INGEST_INTERVAL_MS),
    monitorEnabled: readBoolean('MONITOR_ENABLED', env.MONITOR_ENABLED, false),
    monitorMode: readMonitorMode(env.MONITOR_MODE, env.MONITOR_ENABLED),
    monitorIntervalMs: readOptionalPositiveInteger('MONITOR_INTERVAL_MS', env.MONITOR_INTERVAL_MS),
    monitorTimeoutMs: readOptionalPositiveInteger('MONITOR_TIMEOUT_MS', env.MONITOR_TIMEOUT_MS),
    monitorMaxProviders: readOptionalPositiveInteger('MONITOR_MAX_PROVIDERS', env.MONITOR_MAX_PROVIDERS),
    featuredProviderRotationMs: readPositiveInteger('FEATURED_PROVIDER_ROTATION_MS', env.FEATURED_PROVIDER_ROTATION_MS, 10 * 60 * 1000),
    machineDemoSeed: readBoolean('MACHINE_DEMO_SEED', env.MACHINE_DEMO_SEED, nodeEnv === 'development'),
    rhChainLiveSnapshotsEnabled: readBoolean('RH_CHAIN_LIVE_SNAPSHOTS_ENABLED', env.RH_CHAIN_LIVE_SNAPSHOTS_ENABLED, false),
    rhChainProviderTimeoutMs: readPositiveInteger('RH_CHAIN_PROVIDER_TIMEOUT_MS', env.RH_CHAIN_PROVIDER_TIMEOUT_MS, 2_500),
    // Kept below the production smoke client's 5s deadline to reserve proxy and serialization time.
    rhChainLiveTokenRouteTimeoutMs: readBoundedPositiveInteger('RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS', env.RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS, 3_800, 4_000),
    rhChainCacheTtlSeconds: readOptionalPositiveInteger('RH_CHAIN_CACHE_TTL_SECONDS', env.RH_CHAIN_CACHE_TTL_SECONDS),
    dexScreenerEnabled: readBoolean('DEXSCREENER_ENABLED', env.DEXSCREENER_ENABLED, false),
    dexScreenerBaseUrl: readRequiredUrl('DEXSCREENER_BASE_URL', env.DEXSCREENER_BASE_URL, 'https://api.dexscreener.com'),
    dexScreenerRhChainId: readDexScreenerChainId(env.DEXSCREENER_RH_CHAIN_ID),
    dexScreenerTimeoutMs: readPositiveInteger('DEXSCREENER_TIMEOUT_MS', env.DEXSCREENER_TIMEOUT_MS, 2_500),
    dexScreenerCacheTtlSeconds: readPositiveInteger('DEXSCREENER_CACHE_TTL_SECONDS', env.DEXSCREENER_CACHE_TTL_SECONDS, 120),
    dexScreenerStaleWhileRevalidateSeconds: readPositiveInteger('DEXSCREENER_STALE_WHILE_REVALIDATE_SECONDS', env.DEXSCREENER_STALE_WHILE_REVALIDATE_SECONDS, 30),
    dexScreenerStaleIfErrorSeconds: readPositiveInteger('DEXSCREENER_STALE_IF_ERROR_SECONDS', env.DEXSCREENER_STALE_IF_ERROR_SECONDS, 300),
    dexScreenerMaxStaleSeconds: readPositiveInteger('DEXSCREENER_MAX_STALE_SECONDS', env.DEXSCREENER_MAX_STALE_SECONDS, 900),
    dexScreenerMaxBatchSize: readBoundedPositiveInteger('DEXSCREENER_MAX_BATCH_SIZE', env.DEXSCREENER_MAX_BATCH_SIZE, 30, 30),
    dexScreenerMaxRetries: readBoundedNonNegativeInteger('DEXSCREENER_MAX_RETRIES', env.DEXSCREENER_MAX_RETRIES, 2, 5),
    dexScreenerRetryBaseMs: readPositiveInteger('DEXSCREENER_RETRY_BASE_MS', env.DEXSCREENER_RETRY_BASE_MS, 100),
    dexScreenerMaxConcurrency: readBoundedPositiveInteger('DEXSCREENER_MAX_CONCURRENCY', env.DEXSCREENER_MAX_CONCURRENCY, 4, 20),
    dexScreenerRateLimitPerSecond: readBoundedPositiveInteger('DEXSCREENER_RATE_LIMIT_PER_SECOND', env.DEXSCREENER_RATE_LIMIT_PER_SECOND, 20, 100),
    blockscoutEnabled: readBoolean('BLOCKSCOUT_ENABLED', env.BLOCKSCOUT_ENABLED, false),
    blockscoutBaseUrl: readRequiredUrl('BLOCKSCOUT_BASE_URL', env.BLOCKSCOUT_BASE_URL, 'https://robinhoodchain.blockscout.com'),
    blockscoutTimeoutMs: readPositiveInteger('BLOCKSCOUT_TIMEOUT_MS', env.BLOCKSCOUT_TIMEOUT_MS, 2_500),
    blockscoutCacheTtlSeconds: readPositiveInteger('BLOCKSCOUT_CACHE_TTL_SECONDS', env.BLOCKSCOUT_CACHE_TTL_SECONDS, 120),
    blockscoutMaxPageSize: readBoundedPositiveInteger('BLOCKSCOUT_MAX_PAGE_SIZE', env.BLOCKSCOUT_MAX_PAGE_SIZE, 50, 50),
    rhChainBlockscoutUrl: readOptionalUrl('RH_CHAIN_BLOCKSCOUT_URL', env.RH_CHAIN_BLOCKSCOUT_URL),
    rhChainReviewConsoleEnabled: readBoolean('RH_CHAIN_REVIEW_CONSOLE_ENABLED', env.RH_CHAIN_REVIEW_CONSOLE_ENABLED, false),
    rhChainReviewAdminToken: optionalString(env.RH_CHAIN_REVIEW_ADMIN_TOKEN),
    rhChainReviewedClassificationsEnabled: readBoolean('RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED', env.RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED, false),
    rhChainAttentionQualityV2Enabled: readBoolean('RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED', env.RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED, false),
    rhChainProjectClaimsEnabled: readBoolean('RH_CHAIN_PROJECT_CLAIMS_ENABLED', env.RH_CHAIN_PROJECT_CLAIMS_ENABLED, false),
    rhChainIntelligenceReceiptsEnabled: readBoolean('RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED', env.RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED, false),
    rhChainProjectDirectoryEnabled: readBoolean('RH_CHAIN_PROJECT_DIRECTORY_ENABLED', env.RH_CHAIN_PROJECT_DIRECTORY_ENABLED, false),
    rhChainAutomationEnabled: readBoolean('RH_CHAIN_AUTOMATION_ENABLED', env.RH_CHAIN_AUTOMATION_ENABLED, false),
    rhChainMarketIngestionEnabled: readBoolean('RH_CHAIN_MARKET_INGESTION_ENABLED', env.RH_CHAIN_MARKET_INGESTION_ENABLED, false),
    rhChainMarketHistoryEnabled: readBoolean('RH_CHAIN_MARKET_HISTORY_ENABLED', env.RH_CHAIN_MARKET_HISTORY_ENABLED, false),
    rhChainAutomationInstanceId: optionalString(env.RH_CHAIN_AUTOMATION_INSTANCE_ID) ?? `local-${process.pid}`,
    rhChainJobLockTtlMs: readPositiveInteger('RH_CHAIN_JOB_LOCK_TTL_MS', env.RH_CHAIN_JOB_LOCK_TTL_MS, 5 * 60 * 1000),
    rhChainChainPulseIntervalMs: readPositiveInteger('RH_CHAIN_CHAIN_PULSE_INTERVAL_MS', env.RH_CHAIN_CHAIN_PULSE_INTERVAL_MS, 5 * 60 * 1000),
    rhChainMemePulseIntervalMs: readPositiveInteger('RH_CHAIN_MEME_PULSE_INTERVAL_MS', env.RH_CHAIN_MEME_PULSE_INTERVAL_MS, 10 * 60 * 1000),
    rhChainLaunchpadIntervalMs: readPositiveInteger('RH_CHAIN_LAUNCHPAD_INTERVAL_MS', env.RH_CHAIN_LAUNCHPAD_INTERVAL_MS, 15 * 60 * 1000),
    rhChainReceiptDraftCron: readOptionalCron('RH_CHAIN_RECEIPT_DRAFT_CRON', env.RH_CHAIN_RECEIPT_DRAFT_CRON),
    rhChainPublicRateLimitEnabled: readBoolean('RH_CHAIN_PUBLIC_RATE_LIMIT_ENABLED', env.RH_CHAIN_PUBLIC_RATE_LIMIT_ENABLED, true),
    rhChainPublicRateLimitWindowMs: readPositiveInteger('RH_CHAIN_PUBLIC_RATE_LIMIT_WINDOW_MS', env.RH_CHAIN_PUBLIC_RATE_LIMIT_WINDOW_MS, 60_000),
    rhChainPublicRateLimitMax: readPositiveInteger('RH_CHAIN_PUBLIC_RATE_LIMIT_MAX', env.RH_CHAIN_PUBLIC_RATE_LIMIT_MAX, 30),
    rhChainDuplicateWindowMs: readPositiveInteger('RH_CHAIN_DUPLICATE_WINDOW_MS', env.RH_CHAIN_DUPLICATE_WINDOW_MS, 15 * 60_000),
    rh4663Phase2Enabled: readBoolean('RH_4663_PHASE2_ENABLED', env.RH_4663_PHASE2_ENABLED, !isProduction),
    rh4663ResolutionSigningConfigured: Boolean(optionalString(env.RH_4663_RESOLUTION_PRIVATE_KEY)),
    rh4663Phase3Enabled: readBoolean('RH_4663_PHASE3_ENABLED', env.RH_4663_PHASE3_ENABLED, false),
    rh4663Phase3IngestionEnabled: readBoolean('RH_4663_PHASE3_INGESTION_ENABLED', env.RH_4663_PHASE3_INGESTION_ENABLED, false),
    rh4663Phase3CandidateGenerationEnabled: readBoolean('RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED', env.RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED, false),
    rh4663Phase3PublicationEnabled: readBoolean('RH_4663_PHASE3_PUBLICATION_ENABLED', env.RH_4663_PHASE3_PUBLICATION_ENABLED, false),
    rh4663Phase3AutoPublicationEnabled: readBoolean('RH_4663_AUTO_PUBLICATION_ENABLED', env.RH_4663_AUTO_PUBLICATION_ENABLED, false),
    rh4663Phase3ExternalDistributionEnabled: readBoolean('RH_4663_EXTERNAL_DISTRIBUTION_ENABLED', env.RH_4663_EXTERNAL_DISTRIBUTION_ENABLED, false),
    rh4663Phase3ShadowMode: readBoolean('RH_4663_PHASE3_SHADOW_MODE', env.RH_4663_PHASE3_SHADOW_MODE, true),
    rh4663Phase3IntervalMs: readPositiveInteger('RH_4663_PHASE3_INTERVAL_MS', env.RH_4663_PHASE3_INTERVAL_MS, 10 * 60_000),
    rh4663Phase2ProductionProofVerified: readBoolean('RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED', env.RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED, false),
    frontendOrigin: readOptionalUrl('FRONTEND_ORIGIN', env.FRONTEND_ORIGIN),
    version: env.APP_VERSION ?? packageVersion(),
    disabledFeatures: {}
  };

  // Optional production capabilities fail closed, rather than taking down the
  // public terminal. Their routes report 503 (where public) or remain hidden
  // (where reviewer/admin-only); no secret is ever substituted or bypassed.
  if (isProduction) resolveOptionalProductionFeatures(config);

  return config;
}

/**
 * A deterministic, non-secret diagnostic suitable for CI and Render's shell.
 * It intentionally reports only variable names and state, never values.
 */
export function verifyRuntimeConfiguration(env: NodeJS.ProcessEnv = process.env): RuntimeConfigurationVerification {
  const environment = env.NODE_ENV ?? 'development';
  const requirements = RUNTIME_ENVIRONMENT_DEPENDENCIES.map(({ name, hasDefault }) => ({
    name,
    state: optionalString(env[name]) ? 'configured' as const : hasDefault ? 'defaulted' as const : 'missing' as const
  }));
  try {
    const config = loadRuntimeConfig(env);
    const disabledFeatures = Object.entries(config.disabledFeatures)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([feature, reason]) => ({ feature, reason }));
    return {
      event: 'runtime_configuration_verification',
      status: disabledFeatures.length ? 'degraded' : 'valid',
      environment: config.env,
      requirements,
      disabled_features: disabledFeatures,
      errors: []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const invalidName = RUNTIME_ENVIRONMENT_DEPENDENCIES.find(({ name }) => message.startsWith(name))?.name;
    return {
      event: 'runtime_configuration_verification',
      status: 'invalid',
      environment,
      requirements: requirements.map((requirement) => requirement.name === invalidName ? { ...requirement, state: 'invalid' as const } : requirement),
      disabled_features: [],
      errors: [message]
    };
  }
}

function resolveOptionalProductionFeatures(config: RuntimeConfig) {
  const disable = (feature: string, reason: string, setDisabled: () => void) => {
    setDisabled();
    config.disabledFeatures[feature] = reason;
  };
  if (!config.adminToken) config.disabledFeatures.admin_routes = 'INFOPUNKS_ADMIN_TOKEN is missing; admin routes remain closed';
  if (config.rhChainReviewConsoleEnabled && !config.rhChainReviewAdminToken) {
    disable('rh_chain_review_console', 'RH_CHAIN_REVIEW_ADMIN_TOKEN is missing; reviewer routes remain hidden', () => { config.rhChainReviewConsoleEnabled = false; });
  }
  if (config.rhChainAutomationEnabled && !config.databaseUrl) {
    disable('rh_chain_automation', 'DATABASE_URL is missing', () => { config.rhChainAutomationEnabled = false; });
  }
  if (config.rhChainMarketHistoryEnabled && !config.databaseUrl) {
    disable('rh_chain_market_history', 'DATABASE_URL is missing', () => { config.rhChainMarketHistoryEnabled = false; });
  }
  if (config.rhChainReviewedClassificationsEnabled && !config.databaseUrl) {
    disable('rh_chain_reviewed_classifications', 'DATABASE_URL is missing', () => { config.rhChainReviewedClassificationsEnabled = false; });
  }
  if (config.rhChainAttentionQualityV2Enabled && (!config.databaseUrl || !config.rhChainMarketHistoryEnabled)) {
    disable('rh_chain_attention_quality_v2', !config.databaseUrl ? 'DATABASE_URL is missing' : 'RH_CHAIN_MARKET_HISTORY_ENABLED is required', () => { config.rhChainAttentionQualityV2Enabled = false; });
  }
  if (config.rhChainProjectClaimsEnabled && (!config.databaseUrl || !config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken)) {
    disable('rh_chain_project_claims', !config.databaseUrl ? 'DATABASE_URL is missing' : 'authenticated RH Chain review console is required', () => { config.rhChainProjectClaimsEnabled = false; });
  }
  if (config.rhChainIntelligenceReceiptsEnabled && !config.rhChainProjectClaimsEnabled) {
    disable('rh_chain_intelligence_receipts', 'RH_CHAIN_PROJECT_CLAIMS_ENABLED with authenticated review is required', () => { config.rhChainIntelligenceReceiptsEnabled = false; });
  }
  if (config.rhChainProjectDirectoryEnabled && !config.rhChainProjectClaimsEnabled) {
    disable('rh_chain_project_directory', 'RH_CHAIN_PROJECT_CLAIMS_ENABLED with authenticated review is required', () => { config.rhChainProjectDirectoryEnabled = false; });
  }
  if (config.rh4663Phase2Enabled && (!config.databaseUrl || !config.rhChainReviewAdminToken || !config.rh4663ResolutionSigningConfigured)) {
    disable('infopunks_4663_phase2', !config.databaseUrl ? 'DATABASE_URL is missing' : !config.rhChainReviewAdminToken ? 'authenticated RH Chain reviewer infrastructure is required' : 'RH_4663_RESOLUTION_PRIVATE_KEY is missing', () => { config.rh4663Phase2Enabled = false; });
  }
  if (config.rh4663Phase3Enabled && !config.databaseUrl) {
    disable('infopunks_4663_phase3', 'DATABASE_URL is missing; Phase 3 remains off', () => {
      config.rh4663Phase3Enabled = false; config.rh4663Phase3IngestionEnabled = false; config.rh4663Phase3CandidateGenerationEnabled = false;
      config.rh4663Phase3PublicationEnabled = false; config.rh4663Phase3AutoPublicationEnabled = false; config.rh4663Phase3ExternalDistributionEnabled = false;
    });
  }
  if (config.rh4663Phase3PublicationEnabled && (!config.rh4663Phase2ProductionProofVerified || !config.rhChainReviewAdminToken || !config.rh4663Phase2Enabled)) {
    disable('infopunks_4663_phase3_publication', !config.rh4663Phase2ProductionProofVerified ? 'Phase 2 production proof chain is not explicitly verified' : !config.rhChainReviewAdminToken ? 'authenticated RH Chain reviewer infrastructure is required' : 'Phase 2 must remain enabled', () => { config.rh4663Phase3PublicationEnabled = false; config.rh4663Phase3AutoPublicationEnabled = false; config.rh4663Phase3ExternalDistributionEnabled = false; });
  }
  if (config.rh4663Phase3AutoPublicationEnabled && !config.rh4663Phase3PublicationEnabled) {
    disable('infopunks_4663_phase3_auto_publication', 'RH_4663_PHASE3_PUBLICATION_ENABLED is required', () => { config.rh4663Phase3AutoPublicationEnabled = false; });
  }
  if (config.rh4663Phase3ExternalDistributionEnabled && !config.rh4663Phase3PublicationEnabled) {
    disable('infopunks_4663_external_distribution', 'public Signal publication is required; external distribution remains off', () => { config.rh4663Phase3ExternalDistributionEnabled = false; });
  }
}

const RUNTIME_ENVIRONMENT_DEPENDENCIES: Array<{ name: string; hasDefault: boolean }> = [
  'NODE_ENV', 'PORT', 'INFOPUNKS_ADMIN_TOKEN', 'DATABASE_URL', 'DATABASE_POOL_MAX', 'PAY_SH_CATALOG_URL', 'PAYSH_CATALOG_SOURCE', 'PAYSH_ALLOW_FIXTURE_FALLBACK', 'PAYSH_BOOTSTRAP_ENABLED', 'PAY_SH_INGEST_INTERVAL_MS', 'INGESTION_ENABLED', 'MONITOR_ENABLED', 'MONITOR_MODE', 'MONITOR_INTERVAL_MS', 'MONITOR_TIMEOUT_MS', 'MONITOR_MAX_PROVIDERS', 'MONITOR_ALLOW_PAID_ENDPOINTS', 'FEATURED_PROVIDER_ROTATION_MS', 'MACHINE_DEMO_SEED', 'MACHINE_RECEIPTS_JSONL_PATH', 'INFOPUNKS_BIGQUERY_LIVE_CREDENTIALS_CONFIGURED', 'INFOPUNKS_BIGQUERY_LIVE_HARNESS_ENABLED', 'INFOPUNKS_BIGQUERY_LIVE_HARNESS_MODE', 'INFOPUNKS_BIGQUERY_LIVE_HARNESS_VERSION', 'INFOPUNKS_BIGQUERY_LIVE_RAIL_CONFIGURED', 'RH_CHAIN_LIVE_SNAPSHOTS_ENABLED', 'RH_CHAIN_PROVIDER_TIMEOUT_MS', 'RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS', 'RH_CHAIN_CACHE_TTL_SECONDS', 'RH_CHAIN_BLOCKSCOUT_URL', 'DEXSCREENER_ENABLED', 'DEXSCREENER_BASE_URL', 'DEXSCREENER_RH_CHAIN_ID', 'DEXSCREENER_TIMEOUT_MS', 'DEXSCREENER_CACHE_TTL_SECONDS', 'DEXSCREENER_STALE_WHILE_REVALIDATE_SECONDS', 'DEXSCREENER_STALE_IF_ERROR_SECONDS', 'DEXSCREENER_MAX_STALE_SECONDS', 'DEXSCREENER_MAX_BATCH_SIZE', 'DEXSCREENER_MAX_RETRIES', 'DEXSCREENER_RETRY_BASE_MS', 'DEXSCREENER_MAX_CONCURRENCY', 'DEXSCREENER_RATE_LIMIT_PER_SECOND', 'BLOCKSCOUT_ENABLED', 'BLOCKSCOUT_BASE_URL', 'BLOCKSCOUT_TIMEOUT_MS', 'BLOCKSCOUT_CACHE_TTL_SECONDS', 'BLOCKSCOUT_MAX_PAGE_SIZE', 'RH_CHAIN_REVIEW_CONSOLE_ENABLED', 'RH_CHAIN_REVIEW_ADMIN_TOKEN', 'RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED', 'RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED', 'RH_CHAIN_PROJECT_CLAIMS_ENABLED', 'RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED', 'RH_CHAIN_PROJECT_DIRECTORY_ENABLED', 'RH_CHAIN_AUTOMATION_ENABLED', 'RH_CHAIN_MARKET_INGESTION_ENABLED', 'RH_CHAIN_MARKET_HISTORY_ENABLED', 'RH_CHAIN_AUTOMATION_INSTANCE_ID', 'RH_CHAIN_JOB_LOCK_TTL_MS', 'RH_CHAIN_CHAIN_PULSE_INTERVAL_MS', 'RH_CHAIN_MEME_PULSE_INTERVAL_MS', 'RH_CHAIN_LAUNCHPAD_INTERVAL_MS', 'RH_CHAIN_RECEIPT_DRAFT_CRON', 'RH_CHAIN_PUBLIC_RATE_LIMIT_ENABLED', 'RH_CHAIN_PUBLIC_RATE_LIMIT_WINDOW_MS', 'RH_CHAIN_PUBLIC_RATE_LIMIT_MAX', 'RH_CHAIN_DUPLICATE_WINDOW_MS', 'RH_4663_PHASE2_ENABLED', 'RH_4663_RESOLUTION_PRIVATE_KEY', 'RH_4663_RESOLUTION_KEY_ID', 'RH_4663_ANCHOR_RPC_URL', 'RH_4663_ANCHOR_CONTRACT', 'RH_4663_ANCHOR_PRIVATE_KEY', 'RH_4663_ANCHOR_CONFIRMATIONS', 'RH_4663_PHASE3_ENABLED', 'RH_4663_PHASE3_INGESTION_ENABLED', 'RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED', 'RH_4663_PHASE3_PUBLICATION_ENABLED', 'RH_4663_AUTO_PUBLICATION_ENABLED', 'RH_4663_EXTERNAL_DISTRIBUTION_ENABLED', 'RH_4663_PHASE3_SHADOW_MODE', 'RH_4663_PHASE3_INTERVAL_MS', 'RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED', 'FRONTEND_ORIGIN', 'EVALUATION_REQUEST_WEBHOOK_URL', 'MACHINE_EXECUTION_ENABLED', 'PAY_SH_TRANSLATION_URL', 'PAY_SH_TRANSLATION_AUTH_MODE', 'PAY_SH_TRANSLATION_AUTH_HEADER', 'PAY_SH_TRANSLATION_AUTH_TOKEN', 'PAY_SH_TRANSLATION_PAYMENT_HEADER', 'PAY_SH_TRANSLATION_PAYMENT_VALUE', 'PAY_SH_TRANSLATION_TIMEOUT_MS', 'HERMES_ENABLED', 'HERMES_BASE_URL', 'HERMES_API_KEY', 'HERMES_MODE', 'APP_VERSION'
].sort().map((name) => ({ name, hasDefault: !['PORT', 'INFOPUNKS_ADMIN_TOKEN', 'DATABASE_URL', 'RH_CHAIN_REVIEW_ADMIN_TOKEN'].includes(name) }));

export function deploymentSummary(config: RuntimeConfig) {
  return {
    service: 'infopunks-pay-sh-radar',
    version: config.version,
    env: config.env,
    apiPort: config.port,
    monitorEnabled: config.monitorEnabled,
    monitorMode: config.monitorMode,
    machineDemoSeed: config.machineDemoSeed,
    rhChainLiveSnapshotsEnabled: config.rhChainLiveSnapshotsEnabled,
    rhChainLiveTokenRouteTimeoutMs: config.rhChainLiveTokenRouteTimeoutMs,
    rhChainReviewConsoleEnabled: config.rhChainReviewConsoleEnabled,
    rhChainReviewedClassificationsEnabled: config.rhChainReviewedClassificationsEnabled,
    rhChainAttentionQualityV2Enabled: config.rhChainAttentionQualityV2Enabled,
    rhChainProjectClaimsEnabled: config.rhChainProjectClaimsEnabled,
    rhChainIntelligenceReceiptsEnabled: config.rhChainIntelligenceReceiptsEnabled,
    rhChainProjectDirectoryEnabled: config.rhChainProjectDirectoryEnabled,
    rhChainAutomationEnabled: config.rhChainAutomationEnabled,
    rhChainMarketIngestionEnabled: config.rhChainMarketIngestionEnabled,
    rhChainMarketHistoryEnabled: config.rhChainMarketHistoryEnabled,
    rh4663Phase2Enabled: config.rh4663Phase2Enabled,
    rh4663Phase3: {
      enabled: config.rh4663Phase3Enabled,
      ingestionEnabled: config.rh4663Phase3IngestionEnabled,
      candidateGenerationEnabled: config.rh4663Phase3CandidateGenerationEnabled,
      publicationEnabled: config.rh4663Phase3PublicationEnabled,
      autoPublicationEnabled: config.rh4663Phase3AutoPublicationEnabled,
      externalDistributionEnabled: config.rh4663Phase3ExternalDistributionEnabled,
      shadowMode: config.rh4663Phase3ShadowMode,
      phase2ProductionProofVerified: config.rh4663Phase2ProductionProofVerified
    },
    ingestionEnabled: config.ingestionEnabled,
    dbMode: config.databaseUrl ? 'postgres' : 'memory',
    disabledFeatures: Object.keys(config.disabledFeatures).sort(),
    databasePoolMax: config.databasePoolMax,
    catalogSource: config.payShCatalogSource,
    corsOrigin: config.frontendOrigin ?? 'development-open'
  };
}

function readCatalogSource(value: string | undefined): RuntimeConfig['payShCatalogSource'] {
  if (!value) return 'fixture';
  if (value === 'live' || value === 'fixture') return value;
  throw new Error('PAYSH_CATALOG_SOURCE must be "live" or "fixture"');
}

function readMonitorMode(value: string | undefined, monitorEnabled: string | undefined): RuntimeConfig['monitorMode'] {
  if (!value) return monitorEnabled === 'true' ? 'safe_metadata' : 'disabled';
  if (value === 'disabled' || value === 'safe_metadata' || value === 'endpoint_health' || value === 'paid_execution_probe') return value;
  throw new Error('MONITOR_MODE must be one of "disabled", "safe_metadata", "endpoint_health", or "paid_execution_probe"');
}

function readPort(value: string | undefined, requireExplicit: boolean) {
  if (!value) {
    if (requireExplicit) throw new Error('PORT is required when NODE_ENV=production');
    return 8787;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  return parsed;
}

function readBoolean(name: string, value: string | undefined, defaultValue: boolean) {
  if (value === undefined || value === '') return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false"`);
}

function readOptionalPositiveInteger(name: string, value: string | undefined) {
  if (!value) return null;
  return readPositiveInteger(name, value);
}

function readPositiveInteger(name: string, value: string | undefined, defaultValue?: number) {
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function readOptionalUrl(name: string, value: string | undefined) {
  const trimmed = optionalString(value);
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin === trimmed ? trimmed : new URL(trimmed).toString();
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function readRequiredUrl(name: string, value: string | undefined, defaultValue: string) {
  return readOptionalUrl(name, value ?? defaultValue) ?? defaultValue;
}

function readDexScreenerChainId(value: string | undefined): 'robinhood' {
  if (!value || value === 'robinhood') return 'robinhood';
  throw new Error('DEXSCREENER_RH_CHAIN_ID must be "robinhood"');
}

function readBoundedPositiveInteger(name: string, value: string | undefined, defaultValue: number, maximum: number) {
  const parsed = readPositiveInteger(name, value, defaultValue);
  if (parsed > maximum) throw new Error(`${name} must be at most ${maximum}`);
  return parsed;
}

function readBoundedNonNegativeInteger(name: string, value: string | undefined, defaultValue: number, maximum: number) {
  const parsed = value === undefined || value === '' ? defaultValue : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) throw new Error(`${name} must be an integer from 0 to ${maximum}`);
  return parsed;
}

function readOptionalCron(name: string, value: string | undefined) {
  const trimmed = optionalString(value);
  if (!trimmed) return null;
  // The scheduler supports conventional five-field minute cron expressions.
  if (trimmed.split(/\s+/).length !== 5) throw new Error(`${name} must be a five-field cron expression`);
  return trimmed;
}

function optionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function packageVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version?: string };
    return packageJson.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
