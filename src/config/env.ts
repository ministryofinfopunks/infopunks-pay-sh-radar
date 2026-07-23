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
  pulsePublicHost: string;
  rhPulseCallsEnabled: boolean;
  rhPulseChallengeTtlSeconds: number;
  rhPulseInternalToken: string | null;
  frontendOrigin: string | null;
  version: string;
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
    pulsePublicHost: readHostname('PULSE_PUBLIC_HOST', env.PULSE_PUBLIC_HOST, 'pulse.infopunks.fun'),
    rhPulseCallsEnabled: readBoolean('RH_PULSE_CALLS_ENABLED', env.RH_PULSE_CALLS_ENABLED, false),
    rhPulseChallengeTtlSeconds: readBoundedPositiveInteger('RH_PULSE_CHALLENGE_TTL_SECONDS', env.RH_PULSE_CHALLENGE_TTL_SECONDS, 300, 900),
    rhPulseInternalToken: optionalString(env.RH_PULSE_INTERNAL_TOKEN),
    frontendOrigin: readOptionalUrl('FRONTEND_ORIGIN', env.FRONTEND_ORIGIN),
    version: env.APP_VERSION ?? packageVersion()
  };

  if (isProduction && !config.adminToken) {
    throw new Error('INFOPUNKS_ADMIN_TOKEN is required when NODE_ENV=production');
  }
  if (isProduction && config.rhChainAutomationEnabled && !config.databaseUrl) {
    throw new Error('DATABASE_URL is required for RH Chain automation when NODE_ENV=production');
  }
  if (isProduction && config.rhChainMarketHistoryEnabled && !config.databaseUrl) {
    throw new Error('DATABASE_URL is required for RH Chain market history when NODE_ENV=production');
  }
  if (isProduction && config.rhChainReviewConsoleEnabled && !config.rhChainReviewAdminToken) {
    throw new Error('RH_CHAIN_REVIEW_ADMIN_TOKEN is required when RH_CHAIN_REVIEW_CONSOLE_ENABLED=true in production');
  }
  if (isProduction && config.rhChainReviewedClassificationsEnabled && !config.databaseUrl) {
    throw new Error('DATABASE_URL is required when RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED=true in production');
  }
  if (isProduction && config.rhChainAttentionQualityV2Enabled && !config.databaseUrl) {
    throw new Error('DATABASE_URL is required when RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED=true in production');
  }
  if (isProduction && (config.rhChainProjectClaimsEnabled || config.rhChainIntelligenceReceiptsEnabled || config.rhChainProjectDirectoryEnabled) && !config.databaseUrl) {
    throw new Error('DATABASE_URL is required when RH Chain project claims or Intelligence Receipts are enabled in production');
  }
  if (isProduction && config.rhChainAttentionQualityV2Enabled && !config.rhChainMarketHistoryEnabled) {
    throw new Error('RH_CHAIN_MARKET_HISTORY_ENABLED=true is required when RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED=true in production');
  }
  if (isProduction && config.rhChainProjectClaimsEnabled && (!config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken)) {
    throw new Error('RH_CHAIN_REVIEW_CONSOLE_ENABLED=true and RH_CHAIN_REVIEW_ADMIN_TOKEN are required when RH_CHAIN_PROJECT_CLAIMS_ENABLED=true in production');
  }
  if (isProduction && config.rhChainIntelligenceReceiptsEnabled && (!config.rhChainProjectClaimsEnabled || !config.rhChainReviewConsoleEnabled || !config.rhChainReviewAdminToken)) {
    throw new Error('Project Claims and authenticated Review Console are required when RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED=true in production');
  }
  if (isProduction && config.rhChainProjectDirectoryEnabled && !config.rhChainProjectClaimsEnabled) {
    throw new Error('RH_CHAIN_PROJECT_CLAIMS_ENABLED=true is required when RH_CHAIN_PROJECT_DIRECTORY_ENABLED=true in production');
  }
  if (isProduction && config.rhPulseCallsEnabled && !config.databaseUrl) {
    throw new Error('DATABASE_URL is required when RH_PULSE_CALLS_ENABLED=true in production');
  }
  if (isProduction && config.rhPulseCallsEnabled && !config.rhPulseInternalToken) {
    throw new Error('RH_PULSE_INTERNAL_TOKEN is required when RH_PULSE_CALLS_ENABLED=true in production');
  }

  return config;
}

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
    pulsePublicHost: config.pulsePublicHost,
    rhPulseCallsEnabled: config.rhPulseCallsEnabled,
    rhPulseChallengeTtlSeconds: config.rhPulseChallengeTtlSeconds,
    ingestionEnabled: config.ingestionEnabled,
    dbMode: config.databaseUrl ? 'postgres' : 'memory',
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

function readHostname(name: string, value: string | undefined, defaultValue: string) {
  const candidate = optionalString(value) ?? defaultValue;
  if (candidate.includes('/') || candidate.includes('@') || candidate.includes(',')) {
    throw new Error(`${name} must be a hostname without a scheme or path`);
  }
  try {
    const parsed = new URL(`https://${candidate}`);
    if (parsed.hostname !== candidate.toLowerCase() || parsed.port || parsed.pathname !== '/') {
      throw new Error('invalid_hostname');
    }
    return parsed.hostname;
  } catch {
    throw new Error(`${name} must be a valid hostname without a scheme or path`);
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
