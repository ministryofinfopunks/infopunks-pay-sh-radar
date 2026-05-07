import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { MemoryRepository, IntelligenceSnapshot } from '../src/persistence/repository';
import { runEndpointMonitor } from '../src/services/endpointMonitorService';
import { recomputeAssessments } from '../src/services/intelligenceStore';

const emptySnapshot: IntelligenceSnapshot = {
  events: [],
  providers: [],
  endpoints: [],
  trustAssessments: [],
  signalAssessments: [],
  narratives: [],
  ingestionRuns: [],
  monitorRuns: []
};

const catalog: PayShCatalogItem[] = [{
  name: 'Monitor API',
  namespace: 'pay/monitor',
  slug: 'monitor',
  category: 'Data',
  endpoints: 1,
  price: '$0.01',
  status: 'metered',
  description: 'Monitor provider with enough metadata to produce deterministic trust scoring.',
  tags: ['monitor', 'health'],
  endpointDetails: [{
    name: 'Health',
    path: '/paid-lookup',
    method: 'GET',
    category: 'Data',
    description: 'Health endpoint.',
    price: '$0.01',
    status: 'available',
    schema: {
      monitorUrl: 'https://monitor.test/health',
      response: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } }
    }
  }]
}];

afterEach(() => {
  delete process.env.INFOPUNKS_ADMIN_TOKEN;
  delete process.env.MONITOR_ENABLED;
  delete process.env.MONITOR_INTERVAL_MS;
  delete process.env.MONITOR_TIMEOUT_MS;
});

function monitorStore() {
  return recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot, catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot);
}

describe('endpoint monitor', () => {
  it('records a successful endpoint check with latency evidence', async () => {
    const store = monitorStore();
    const repository = new MemoryRepository();
    const result = await runEndpointMonitor(store, repository, {
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    });

    expect(result.run).toMatchObject({ status: 'succeeded', checkedCount: 1, successCount: 1, failedCount: 0 });
    expect(result.events.map((event) => event.type)).toContain('endpoint.checked');
    expect(result.events[0].payload).toMatchObject({ status_code: 200, success: true, schema_validity: true });
    expect(typeof result.events[0].payload.response_time_ms).toBe('number');
    expect(store.endpoints[0].latencyMsP50).toBeTypeOf('number');
  });

  it('records a failed endpoint check with the error evidence fields', async () => {
    const store = monitorStore();
    const repository = new MemoryRepository();
    const result = await runEndpointMonitor(store, repository, {
      fetchImpl: async () => new Response('down', { status: 503 })
    });

    expect(result.run).toMatchObject({ checkedCount: 1, successCount: 0, failedCount: 1 });
    expect(result.events.map((event) => event.type)).toEqual(expect.arrayContaining(['endpoint.checked', 'endpoint.failed']));
    const failed = result.events.find((event) => event.type === 'endpoint.failed')!;
    expect(failed.payload).toMatchObject({ status_code: 503, success: false, schema_validity: false });
    expect(failed.payload.checked_at).toBeTypeOf('string');
  });

  it('updates trust score components from monitor evidence', async () => {
    const store = monitorStore();
    expect(store.trustAssessments[0].components.uptime).toBeNull();
    expect(store.trustAssessments[0].components.latency).toBeNull();
    expect(store.trustAssessments[0].components.responseValidity).toBeNull();

    await runEndpointMonitor(store, new MemoryRepository(), {
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    });

    expect(store.trustAssessments[0].components.uptime).toBe(100);
    expect(store.trustAssessments[0].components.responseValidity).toBe(100);
    expect(store.trustAssessments[0].components.latency).toBeTypeOf('number');
    expect(store.trustAssessments[0].unknowns).not.toContain('uptime');
  });

  it('keeps telemetry unknown before monitoring', () => {
    const store = monitorStore();
    expect(store.monitorRuns).toEqual([]);
    expect(store.trustAssessments[0].components.uptime).toBeNull();
    expect(store.trustAssessments[0].components.latency).toBeNull();
    expect(store.trustAssessments[0].components.responseValidity).toBeNull();
  });

  it('protects manual monitor runs with the admin token', async () => {
    process.env.INFOPUNKS_ADMIN_TOKEN = 'local-admin';
    const store = monitorStore();
    store.endpoints[0].schema = null;
    const app = await createApp(store, new MemoryRepository());

    const rejected = await app.inject({ method: 'POST', url: '/v1/monitor/run' });
    const accepted = await app.inject({ method: 'POST', url: '/v1/monitor/run', headers: { authorization: 'Bearer local-admin' } });

    expect(rejected.statusCode).toBe(401);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data.run.status).toBe('succeeded');
    await app.close();
  });

  it('does not schedule monitor runs unless MONITOR_ENABLED=true', async () => {
    process.env.MONITOR_ENABLED = 'false';
    process.env.MONITOR_INTERVAL_MS = '10';
    const store = monitorStore();
    const app = await createApp(store, new MemoryRepository());

    await new Promise((resolve) => setTimeout(resolve, 35));

    expect(store.monitorRuns).toHaveLength(0);
    await app.close();
  });

  it('schedules monitor runs when enabled', async () => {
    const health = Fastify({ logger: false });
    health.get('/health', async () => ({ ok: true }));
    await health.listen({ port: 0, host: '127.0.0.1' });
    const address = health.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    process.env.MONITOR_ENABLED = 'true';
    process.env.MONITOR_INTERVAL_MS = '10';
    process.env.MONITOR_TIMEOUT_MS = '500';
    const store = monitorStore();
    store.endpoints[0].schema = {
      monitorUrl: `http://127.0.0.1:${port}/health`,
      response: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } }
    };
    const app = await createApp(store, new MemoryRepository());

    await vi.waitFor(() => expect(store.monitorRuns.length).toBeGreaterThan(0), { timeout: 500 });

    expect(store.monitorRuns[0].checkedCount).toBe(1);
    await app.close();
    await health.close();
  });
});
