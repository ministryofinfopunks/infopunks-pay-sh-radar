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
  rhChainCacheTtlSeconds: number | null;
  dexScreenerEnabled: boolean;
  dexScreenerBaseUrl: string;
  dexScreenerRhChainId: 'robinhood';
  dexScreenerTimeoutMs: number;
  dexScreenerCacheTtlSeconds: number;
  dexScreenerMaxBatchSize: number;
  rhChainBlockscoutUrl: string | null;
  rhChainReviewConsoleEnabled: boolean;
  rhChainReviewAdminToken: string | null;
  rhChainAutomationEnabled: boolean;
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
    rhChainCacheTtlSeconds: readOptionalPositiveInteger('RH_CHAIN_CACHE_TTL_SECONDS', env.RH_CHAIN_CACHE_TTL_SECONDS),
    dexScreenerEnabled: readBoolean('DEXSCREENER_ENABLED', env.DEXSCREENER_ENABLED, false),
    dexScreenerBaseUrl: readRequiredUrl('DEXSCREENER_BASE_URL', env.DEXSCREENER_BASE_URL, 'https://api.dexscreener.com'),
    dexScreenerRhChainId: readDexScreenerChainId(env.DEXSCREENER_RH_CHAIN_ID),
    dexScreenerTimeoutMs: readPositiveInteger('DEXSCREENER_TIMEOUT_MS', env.DEXSCREENER_TIMEOUT_MS, 2_500),
    dexScreenerCacheTtlSeconds: readPositiveInteger('DEXSCREENER_CACHE_TTL_SECONDS', env.DEXSCREENER_CACHE_TTL_SECONDS, 120),
    dexScreenerMaxBatchSize: readBoundedPositiveInteger('DEXSCREENER_MAX_BATCH_SIZE', env.DEXSCREENER_MAX_BATCH_SIZE, 30, 30),
    rhChainBlockscoutUrl: readOptionalUrl('RH_CHAIN_BLOCKSCOUT_URL', env.RH_CHAIN_BLOCKSCOUT_URL),
    rhChainReviewConsoleEnabled: readBoolean('RH_CHAIN_REVIEW_CONSOLE_ENABLED', env.RH_CHAIN_REVIEW_CONSOLE_ENABLED, false),
    rhChainReviewAdminToken: optionalString(env.RH_CHAIN_REVIEW_ADMIN_TOKEN),
    rhChainAutomationEnabled: readBoolean('RH_CHAIN_AUTOMATION_ENABLED', env.RH_CHAIN_AUTOMATION_ENABLED, false),
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
    frontendOrigin: readOptionalUrl('FRONTEND_ORIGIN', env.FRONTEND_ORIGIN),
    version: env.APP_VERSION ?? packageVersion()
  };

  if (isProduction && !config.adminToken) {
    throw new Error('INFOPUNKS_ADMIN_TOKEN is required when NODE_ENV=production');
  }
  if (isProduction && config.rhChainAutomationEnabled && !config.databaseUrl) {
    throw new Error('DATABASE_URL is required for RH Chain automation when NODE_ENV=production');
  }
  if (isProduction && config.rhChainReviewConsoleEnabled && !config.rhChainReviewAdminToken) {
    throw new Error('RH_CHAIN_REVIEW_ADMIN_TOKEN is required when RH_CHAIN_REVIEW_CONSOLE_ENABLED=true in production');
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
    rhChainReviewConsoleEnabled: config.rhChainReviewConsoleEnabled,
    rhChainAutomationEnabled: config.rhChainAutomationEnabled,
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
