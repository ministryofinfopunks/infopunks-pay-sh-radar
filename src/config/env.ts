import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RuntimeConfig = {
  env: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string | null;
  adminToken: string | null;
  payShCatalogUrl: string | null;
  payShIngestIntervalMs: number | null;
  monitorEnabled: boolean;
  monitorMode: 'disabled' | 'safe_metadata' | 'endpoint_health' | 'paid_execution_probe';
  monitorIntervalMs: number | null;
  monitorTimeoutMs: number | null;
  monitorMaxProviders: number | null;
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
    adminToken: optionalString(env.INFOPUNKS_ADMIN_TOKEN),
    payShCatalogUrl: readOptionalUrl('PAY_SH_CATALOG_URL', env.PAY_SH_CATALOG_URL),
    payShIngestIntervalMs: readOptionalPositiveInteger('PAY_SH_INGEST_INTERVAL_MS', env.PAY_SH_INGEST_INTERVAL_MS),
    monitorEnabled: readBoolean('MONITOR_ENABLED', env.MONITOR_ENABLED, false),
    monitorMode: readMonitorMode(env.MONITOR_MODE, env.MONITOR_ENABLED),
    monitorIntervalMs: readOptionalPositiveInteger('MONITOR_INTERVAL_MS', env.MONITOR_INTERVAL_MS),
    monitorTimeoutMs: readOptionalPositiveInteger('MONITOR_TIMEOUT_MS', env.MONITOR_TIMEOUT_MS),
    monitorMaxProviders: readOptionalPositiveInteger('MONITOR_MAX_PROVIDERS', env.MONITOR_MAX_PROVIDERS),
    frontendOrigin: readOptionalUrl('FRONTEND_ORIGIN', env.FRONTEND_ORIGIN),
    version: env.APP_VERSION ?? packageVersion()
  };

  if (isProduction && !config.adminToken) {
    throw new Error('INFOPUNKS_ADMIN_TOKEN is required when NODE_ENV=production');
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
    ingestionEnabled: Boolean(config.payShIngestIntervalMs && config.payShIngestIntervalMs > 0),
    dbMode: config.databaseUrl ? 'postgres' : 'memory',
    catalogSource: config.payShCatalogUrl ? 'live' : 'fixture',
    corsOrigin: config.frontendOrigin ?? 'development-open'
  };
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
