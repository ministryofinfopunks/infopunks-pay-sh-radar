import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('complete Radar read-only mode', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps safe reads available and rejects every mutation method before route handlers', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RADAR_READ_ONLY_MODE', 'true');
    const store = emptyIntelligenceStore();
    const app = await createApp(store);
    try {
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/v1/providers' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'OPTIONS', url: '/v1/ingest/pay-sh' })).statusCode).not.toBe(503);
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
        const response = await app.inject({ method, url: '/v1/ingest/pay-sh', payload: {} });
        expect(response.statusCode).toBe(503);
        expect(response.json()).toEqual({ error: 'radar_read_only_mode' });
      }
      expect(store.ingestionRuns).toHaveLength(0);
      expect(store.providers).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('does not schedule ingestion, monitoring, RH/4663 or shadow jobs when configured on', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RADAR_READ_ONLY_MODE', 'true');
    vi.stubEnv('INGESTION_ENABLED', 'true');
    vi.stubEnv('PAY_SH_INGEST_INTERVAL_MS', '1');
    vi.stubEnv('MONITOR_ENABLED', 'true');
    vi.stubEnv('MONITOR_INTERVAL_MS', '1');
    vi.stubEnv('RH_CHAIN_AUTOMATION_ENABLED', 'true');
    vi.stubEnv('RH_4663_PHASE3_ENABLED', 'true');
    vi.stubEnv('RH_4663_PHASE3_INGESTION_ENABLED', 'true');
    vi.stubEnv('RH_4663_PHASE3_INTERVAL_MS', '1');
    vi.stubEnv('IPX_PLTR_SHADOW_OBSERVATION_ENABLED', 'true');
    vi.stubEnv('IPX_PLTR_SHADOW_OBSERVATION_INTERVAL_MS', '1');
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const app = await createApp(emptyIntelligenceStore());
    try {
      expect(setIntervalSpy).not.toHaveBeenCalled();
    } finally {
      await app.close();
      setIntervalSpy.mockRestore();
    }
  });

  it('drains an already in-flight read request before shutdown completes', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RADAR_READ_ONLY_MODE', 'true');
    const app = await createApp(emptyIntelligenceStore());
    let closed = false;
    let requestFinished = false;
    app.get('/__read_only_drain_fixture', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      requestFinished = true;
      return { ok: true };
    });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const request = fetch(address + '/__read_only_drain_fixture', { headers: { connection: 'close' } });
      await new Promise((resolve) => setTimeout(resolve, 10));
      let closeFinished = false;
      const closing = app.close().then(() => { closeFinished = true; closed = true; });
      const response = await request;
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      await closing;
      expect(requestFinished).toBe(true);
      expect(closeFinished).toBe(true);
    } finally {
      if (!closed && app.server.listening) await app.close();
    }
  });

  it('waits for an already-running ingestion job after clearing its timer', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RADAR_READ_ONLY_MODE', 'false');
    vi.stubEnv('INGESTION_ENABLED', 'true');
    vi.stubEnv('PAYSH_CATALOG_SOURCE', 'live');
    vi.stubEnv('PAYSH_ALLOW_FIXTURE_FALLBACK', 'false');
    vi.stubEnv('PAY_SH_INGEST_INTERVAL_MS', '1');
    let jobStarted = () => {};
    let jobFinished = false;
    const started = new Promise<void>((resolve) => { jobStarted = resolve; });
    const catalog = createServer((_req, res) => {
      jobStarted();
      setTimeout(() => {
        jobFinished = true;
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"providers":[]}');
      }, 150);
    });
    await new Promise<void>((resolve) => catalog.listen(0, '127.0.0.1', resolve));
    const address = catalog.address();
    if (!address || typeof address === 'string') throw new Error('local_catalog_server_address_unavailable');
    vi.stubEnv('PAY_SH_CATALOG_URL', `http://127.0.0.1:${address.port}/catalog`);
    const app = await createApp(emptyIntelligenceStore());
    try {
      await started;
      let closed = false;
      const closing = app.close().then(() => { closed = true; });
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(closed).toBe(false);
      await closing;
      expect(jobFinished).toBe(true);
    } finally {
      if (app.server.listening) await app.close();
      await new Promise<void>((resolve, reject) => catalog.close((error) => error ? reject(error) : resolve()));
    }
  }, 10_000);
});
