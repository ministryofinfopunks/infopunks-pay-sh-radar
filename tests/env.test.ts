import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { loadRuntimeConfig } from '../src/config/env';

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
    expect(config.pulsePublicHost).toBe('pulse.infopunks.fun');
    expect(config.rhPulseCallsEnabled).toBe(false);
    expect(config.rhPulseChallengeTtlSeconds).toBe(300);
    expect(config.rhPulseInternalToken).toBeNull();
  });

  it('supports explicit safe metadata monitor mode and legacy enabled compatibility', () => {
    expect(loadRuntimeConfig({ MONITOR_MODE: 'safe_metadata' }).monitorMode).toBe('safe_metadata');
    expect(loadRuntimeConfig({ MONITOR_ENABLED: 'true' }).monitorMode).toBe('safe_metadata');
    expect(loadRuntimeConfig({ MONITOR_MAX_PROVIDERS: '10' }).monitorMaxProviders).toBe(10);
    expect(loadRuntimeConfig({ FEATURED_PROVIDER_ROTATION_MS: '30000' }).featuredProviderRotationMs).toBe(30000);
  });

  it('requires production port and admin token', () => {
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787' })).toThrow('INFOPUNKS_ADMIN_TOKEN');
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', INFOPUNKS_ADMIN_TOKEN: 'secret' })).toThrow('PORT');
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret' }).isProduction).toBe(true);
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret' }).machineDemoSeed).toBe(false);
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret' }).rhChainLiveSnapshotsEnabled).toBe(false);
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_LIVE_SNAPSHOTS_ENABLED: 'true', RH_CHAIN_PROVIDER_TIMEOUT_MS: '1200' }).rhChainLiveSnapshotsEnabled).toBe(true);
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_AUTOMATION_ENABLED: 'true' })).toThrow('DATABASE_URL');
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_MARKET_HISTORY_ENABLED: 'true' })).toThrow('DATABASE_URL');
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED: 'true' })).toThrow('DATABASE_URL');
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret', RH_CHAIN_REVIEW_CONSOLE_ENABLED: 'true' })).toThrow('RH_CHAIN_REVIEW_ADMIN_TOKEN');
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
    expect(loadRuntimeConfig({ PULSE_PUBLIC_HOST: 'preview-pulse.example.com', RH_PULSE_CALLS_ENABLED: 'true' })).toMatchObject({
      pulsePublicHost: 'preview-pulse.example.com',
      rhPulseCallsEnabled: true
    });
    expect(loadRuntimeConfig({ RH_PULSE_CHALLENGE_TTL_SECONDS: '120', RH_PULSE_INTERNAL_TOKEN: 'pilot-secret' })).toMatchObject({
      rhPulseChallengeTtlSeconds: 120,
      rhPulseInternalToken: 'pilot-secret'
    });
    expect(() => loadRuntimeConfig({ RH_PULSE_CHALLENGE_TTL_SECONDS: '901' })).toThrow('RH_PULSE_CHALLENGE_TTL_SECONDS');
    expect(() => loadRuntimeConfig({ PULSE_PUBLIC_HOST: 'https://pulse.infopunks.fun/' })).toThrow('PULSE_PUBLIC_HOST');
    expect(() => loadRuntimeConfig({ PULSE_PUBLIC_HOST: 'pulse.infopunks.fun,attacker.example' })).toThrow('PULSE_PUBLIC_HOST');
  });

  it('requires durable storage and an internal pilot token when production calls are enabled', () => {
    const base = {
      NODE_ENV: 'production',
      PORT: '8787',
      INFOPUNKS_ADMIN_TOKEN: 'admin',
      RH_PULSE_CALLS_ENABLED: 'true'
    };
    expect(() => loadRuntimeConfig(base)).toThrow('DATABASE_URL');
    expect(() => loadRuntimeConfig({ ...base, DATABASE_URL: 'postgres://localhost/radar' })).toThrow('RH_PULSE_INTERNAL_TOKEN');
    expect(loadRuntimeConfig({
      ...base,
      DATABASE_URL: 'postgres://localhost/radar',
      RH_PULSE_INTERNAL_TOKEN: 'pilot-secret'
    }).rhPulseCallsEnabled).toBe(true);
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
