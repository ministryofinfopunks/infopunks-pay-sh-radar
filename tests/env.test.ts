import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { loadRuntimeConfig } from '../src/config/env';

describe('runtime environment config', () => {
  it('keeps local development defaults lightweight', () => {
    const config = loadRuntimeConfig({});
    expect(config.port).toBe(8787);
    expect(config.monitorEnabled).toBe(false);
    expect(config.databaseUrl).toBeNull();
  });

  it('requires production port and admin token', () => {
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787' })).toThrow('INFOPUNKS_ADMIN_TOKEN');
    expect(() => loadRuntimeConfig({ NODE_ENV: 'production', INFOPUNKS_ADMIN_TOKEN: 'secret' })).toThrow('PORT');
    expect(loadRuntimeConfig({ NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'secret' }).isProduction).toBe(true);
  });

  it('rejects malformed production env values', () => {
    expect(() => loadRuntimeConfig({ PORT: 'abc' })).toThrow('PORT');
    expect(() => loadRuntimeConfig({ MONITOR_ENABLED: 'yes' })).toThrow('MONITOR_ENABLED');
    expect(() => loadRuntimeConfig({ PAY_SH_INGEST_INTERVAL_MS: '0' })).toThrow('PAY_SH_INGEST_INTERVAL_MS');
    expect(() => loadRuntimeConfig({ FRONTEND_ORIGIN: 'not-a-url' })).toThrow('FRONTEND_ORIGIN');
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
