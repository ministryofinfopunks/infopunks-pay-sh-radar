"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRuntimeConfig = loadRuntimeConfig;
exports.deploymentSummary = deploymentSummary;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function loadRuntimeConfig(env = process.env) {
    const nodeEnv = env.NODE_ENV ?? 'development';
    const isProduction = nodeEnv === 'production';
    const port = readPort(env.PORT, isProduction);
    const config = {
        env: nodeEnv,
        isProduction,
        port,
        databaseUrl: optionalString(env.DATABASE_URL),
        adminToken: optionalString(env.INFOPUNKS_ADMIN_TOKEN),
        payShCatalogUrl: readOptionalUrl('PAY_SH_CATALOG_URL', env.PAY_SH_CATALOG_URL),
        payShIngestIntervalMs: readOptionalPositiveInteger('PAY_SH_INGEST_INTERVAL_MS', env.PAY_SH_INGEST_INTERVAL_MS),
        monitorEnabled: readBoolean('MONITOR_ENABLED', env.MONITOR_ENABLED, false),
        monitorIntervalMs: readOptionalPositiveInteger('MONITOR_INTERVAL_MS', env.MONITOR_INTERVAL_MS),
        monitorTimeoutMs: readOptionalPositiveInteger('MONITOR_TIMEOUT_MS', env.MONITOR_TIMEOUT_MS),
        frontendOrigin: readOptionalUrl('FRONTEND_ORIGIN', env.FRONTEND_ORIGIN),
        version: env.APP_VERSION ?? packageVersion()
    };
    if (isProduction && !config.adminToken) {
        throw new Error('INFOPUNKS_ADMIN_TOKEN is required when NODE_ENV=production');
    }
    return config;
}
function deploymentSummary(config) {
    return {
        service: 'infopunks-pay-sh-radar',
        version: config.version,
        env: config.env,
        apiPort: config.port,
        monitorEnabled: config.monitorEnabled,
        ingestionEnabled: Boolean(config.payShIngestIntervalMs && config.payShIngestIntervalMs > 0),
        dbMode: config.databaseUrl ? 'postgres' : 'memory',
        catalogSource: config.payShCatalogUrl ? 'live' : 'fixture',
        corsOrigin: config.frontendOrigin ?? 'development-open'
    };
}
function readPort(value, requireExplicit) {
    if (!value) {
        if (requireExplicit)
            throw new Error('PORT is required when NODE_ENV=production');
        return 8787;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
        throw new Error('PORT must be an integer from 1 to 65535');
    }
    return parsed;
}
function readBoolean(name, value, defaultValue) {
    if (value === undefined || value === '')
        return defaultValue;
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    throw new Error(`${name} must be "true" or "false"`);
}
function readOptionalPositiveInteger(name, value) {
    if (!value)
        return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}
function readOptionalUrl(name, value) {
    const trimmed = optionalString(value);
    if (!trimmed)
        return null;
    try {
        return new URL(trimmed).origin === trimmed ? trimmed : new URL(trimmed).toString();
    }
    catch {
        throw new Error(`${name} must be a valid URL`);
    }
}
function optionalString(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
function packageVersion() {
    try {
        const packageJson = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(process.cwd(), 'package.json'), 'utf8'));
        return packageJson.version ?? '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
