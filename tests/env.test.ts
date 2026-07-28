import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { loadRuntimeConfig, verifyRuntimeConfiguration } from '../src/config/env';

describe('runtime environment config', () => {
  it('keeps local development defaults lightweight', () => {
    const config = loadRuntimeConfig({});
    expect(config.port).toBe(8787);
    expect(config.monitorEnabled).toBe(false);
    expect(config.monitorMode).toBe('disabled');
    expect(config.databaseUrl).toBeNull();
    expect(config.databasePoolMax).toBe(10);
    expect(config.featuredProviderRotationMs).toBe(600000);
    expect(config.machineDemoSeed).toBe(true);
    expect(config.rhChainAutomationEnabled).toBe(false);
    expect(config.rhChainMarketIngestionEnabled).toBe(false);
    expect(config.rhChainMarketHistoryEnabled).toBe(false);
    expect(config.rhChainReviewedClassificationsEnabled).toBe(false);
    expect(config.dexScreenerMaxRetries).toBe(2);
    expect(config.dexScreenerMaxConcurrency).toBe(4);
    expect(config.rhChainLiveTokenRouteTimeoutMs).toBe(3_800);
  });

  it('supports explicit safe metadata monitor mode and legacy enabled compatibility', () => {
    expect(loadRuntimeConfig({ MONITOR_MODE: 'safe_metadata' }).monitorMode).toBe('safe_metadata');
    expect(loadRuntimeConfig({ MONITOR_ENABLED: 'true' }).monitorMode).toBe('safe_metadata');
    expect(loadRuntimeConfig({ MONITOR_MAX_PROVIDERS: '10' }).monitorMaxProviders).toBe(10);
    expect(loadRuntimeConfig({ FEATURED_PROVIDER_ROTATION_MS: '30000' }).featuredProviderRotationMs).toBe(30000);
  });

  it('keeps production public when optional admin and RH Chain dependencies are absent', () => {
    const publicOnly = loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787' });
    expect(publicOnly.disabledFeatures.admin_routes).toContain('INFOPUNKS_ADMIN_TOKEN');
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', INFOPUNKS_ADMIN_TOKEN: 'secret' })).toThrow('PORT');
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret' }).isProduction).toBe(true);
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret' }).machineDemoSeed).toBe(false);
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret' }).rhChainLiveSnapshotsEnabled).toBe(false);
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_LIVE_SNAPSHOTS_ENABLED: 'true', RH_CHAIN_PROVIDER_TIMEOUT_MS: '1200' }).rhChainLiveSnapshotsEnabled).toBe(true);
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_AUTOMATION_ENABLED: 'true' }).disabledFeatures.rh_chain_automation).toContain('DATABASE_URL');
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_MARKET_HISTORY_ENABLED: 'true' }).disabledFeatures.rh_chain_market_history).toContain('DATABASE_URL');
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED: 'true' }).disabledFeatures.rh_chain_reviewed_classifications).toContain('DATABASE_URL');
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_REVIEW_CONSOLE_ENABLED: 'true' }).disabledFeatures.rh_chain_review_console).toContain('RH_CHAIN_REVIEW_ADMIN_TOKEN');
    expect(loadRuntimeConfig({ RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED: 'true' }).rhChainReviewedClassificationsEnabled).toBe(true);
  });

  it('allows explicit machine demo seed toggle', () => {
    expect(loadRuntimeConfig({ NODE_ENV: 'test' }).machineDemoSeed).toBe(false);
    expect(loadRuntimeConfig({ NODE_ENV: 'test', MACHINE_DEMO_SEED: 'true' }).machineDemoSeed).toBe(true);
  });

  it('configures safe RH Chain public intake defaults', () => {
    const config = loadRuntimeConfig({ NODE_ENV: 'test' });
    expect(config.rhChainPublicRateLimitEnabled).toBe(true);
    expect(config.rhChainPublicRateLimitWindowMs).toBe(60_000);
    expect(config.rhChainPublicRateLimitMax).toBe(30);
    expect(() => loadRuntimeConfig({ RH_CHAIN_PUBLIC_RATE_LIMIT_MAX: '0' })).toThrow('RH_CHAIN_PUBLIC_RATE_LIMIT_MAX');
  });

  it('rejects malformed production env values', () => {
    expect(() => loadRuntimeConfig({ PORT: 'abc' })).toThrow('PORT');
    expect(() => loadRuntimeConfig({ MONITOR_ENABLED: 'yes' })).toThrow('MONITOR_ENABLED');
    expect(() => loadRuntimeConfig({ MONITOR_MODE: 'endpoint' })).toThrow('MONITOR_MODE');
    expect(() => loadRuntimeConfig({ MONITOR_MAX_PROVIDERS: '0' })).toThrow('MONITOR_MAX_PROVIDERS');
    expect(() => loadRuntimeConfig({ PAY_SH_INGEST_INTERVAL_MS: '0' })).toThrow('PAY_SH_INGEST_INTERVAL_MS');
    expect(() => loadRuntimeConfig({ FEATURED_PROVIDER_ROTATION_MS: '0' })).toThrow('FEATURED_PROVIDER_ROTATION_MS');
    expect(() => loadRuntimeConfig({ DATABASE_POOL_MAX: '0' })).toThrow('DATABASE_POOL_MAX');
    expect(loadRuntimeConfig({ DATABASE_POOL_MAX: '4' }).databasePoolMax).toBe(4);
    expect(() => loadRuntimeConfig({ FRONTEND_ORIGIN: 'not-a-url' })).toThrow('FRONTEND_ORIGIN');
    expect(() => loadRuntimeConfig({ RH_CHAIN_RECEIPT_DRAFT_CRON: 'every hour' })).toThrow('RH_CHAIN_RECEIPT_DRAFT_CRON');
    expect(() => loadRuntimeConfig({ DEXSCREENER_MAX_RETRIES: '6' })).toThrow('DEXSCREENER_MAX_RETRIES');
    expect(() => loadRuntimeConfig({ DEXSCREENER_MAX_CONCURRENCY: '21' })).toThrow('DEXSCREENER_MAX_CONCURRENCY');
    expect(loadRuntimeConfig({ RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS: '3500' }).rhChainLiveTokenRouteTimeoutMs).toBe(3_500);
    expect(() => loadRuntimeConfig({ RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS: '4001' })).toThrow('RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS');
  });

  it('emits deterministic non-secret production configuration verification', () => {
    const invalid = verifyRuntimeConfiguration({ NODE_ENV: 'production', PORT: '10000', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_AUTOMATION_ENABLED: 'sometimes' });
    expect(invalid.status).toBe('invalid');
    expect(JSON.stringify(invalid)).not.toContain('secret');

    const degraded = verifyRuntimeConfiguration({ NODE_ENV: 'production', PORT: '10000', RH_CHAIN_AUTOMATION_ENABLED: 'true' });
    expect(degraded.status).toBe('degraded');
    expect(degraded.disabled_features).toEqual(expect.arrayContaining([
      expect.objectContaining({ feature: 'admin_routes' }),
      expect.objectContaining({ feature: 'rh_chain_automation' })
    ]));
  });

  it('resolves RH Chain dependency ordering without starting a crash loop', () => {
    const base = { NODE_ENV: 'production', PORT: '10000', INFOPUNKS_ADMIN_TOKEN: 'admin' };
    expect(loadRuntimeConfig({ ...base, RH_CHAIN_REVIEW_CONSOLE_ENABLED: 'true' }).disabledFeatures.rh_chain_review_console).toContain('RH_CHAIN_REVIEW_ADMIN_TOKEN');
    const missingDb = loadRuntimeConfig({ ...base, RH_CHAIN_PROJECT_CLAIMS_ENABLED: 'true', RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED: 'true', RH_CHAIN_REVIEW_CONSOLE_ENABLED: 'true', RH_CHAIN_REVIEW_ADMIN_TOKEN: 'review' });
    expect(missingDb.disabledFeatures.rh_chain_project_claims).toContain('DATABASE_URL');
    expect(missingDb.disabledFeatures.rh_chain_intelligence_receipts).toContain('RH_CHAIN_PROJECT_CLAIMS_ENABLED');
    const full = loadRuntimeConfig({ ...base, DATABASE_URL: 'postgres://user:password@localhost:5432/radar', RH_CHAIN_REVIEW_CONSOLE_ENABLED: 'true', RH_CHAIN_REVIEW_ADMIN_TOKEN: 'review', RH_CHAIN_MARKET_HISTORY_ENABLED: 'true', RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED: 'true', RH_CHAIN_PROJECT_CLAIMS_ENABLED: 'true', RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED: 'true', RH_CHAIN_PROJECT_DIRECTORY_ENABLED: 'true', RH_CHAIN_AUTOMATION_ENABLED: 'true' });
    expect(full.disabledFeatures).toEqual({});
  });

  it('restricts CORS when FRONTEND_ORIGIN is configured', async () => {
    const previous = process.env.FRONTEND_ORIGIN;
    process.env.FRONTEND_ORIGIN = 'https://radar.example.com';
    const app = await createApp();

    const accepted = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://radar.example.com' } });
    const rejected = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://other.example.com' } });

    expect(accepted.headers['access-control-allow-origin']).toBe('https://radar.example.com');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();

    await app.close();
    if (previous === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = previous;
  });
});
