import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { MemoryRepository, IntelligenceSnapshot } from '../src/persistence/repository';
import { InfopunksEvent } from '../src/schemas/entities';
import { runEndpointMonitor, runMonitor } from '../src/services/endpointMonitorService';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { pulseSummary } from '../src/services/pulseService';

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
  service_url: 'https://monitor.test',
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
  delete process.env.MONITOR_MODE;
  delete process.env.MONITOR_INTERVAL_MS;
  delete process.env.MONITOR_TIMEOUT_MS;
  delete process.env.MONITOR_MAX_PROVIDERS;
});

function monitorStore() {
  return recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot, catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot);
}

function providerEvent(type: InfopunksEvent['type'], payload: InfopunksEvent['payload'], observedAt = '2026-01-02T00:00:00.000Z'): InfopunksEvent {
  return {
    id: `${type}-${observedAt}`,
    type,
    source: 'infopunks:safe-metadata-monitor',
    entityType: 'provider',
    entityId: 'monitor',
    observedAt,
    payload: { providerId: 'monitor', checked_at: observedAt, monitor_mode: 'safe_metadata', check_type: 'service_url_reachability', safe_mode: true, ...payload }
  };
}

class StrictJsonRepository extends MemoryRepository {
  public serializedSkippedReasons: string[] = [];
  public serializedEventPayloads: string[] = [];
  public serializedSnapshots: string[] = [];

  async saveSnapshot(snapshot: IntelligenceSnapshot) {
    const snapshotSerialized = JSON.stringify(snapshot, (_key, value) => (value === undefined ? null : value));
    if (snapshotSerialized === undefined) throw new Error('json_serialization_failed_snapshot');
    JSON.parse(snapshotSerialized);
    this.serializedSnapshots.push(snapshotSerialized);
    for (const event of snapshot.events) {
      const serialized = JSON.stringify(event.payload, (_key, value) => (value === undefined ? null : value));
      if (serialized === undefined) throw new Error('json_serialization_failed_event_payload');
      JSON.parse(serialized);
      this.serializedEventPayloads.push(serialized);
    }
    for (const run of snapshot.monitorRuns ?? []) {
      const serialized = JSON.stringify(run.skippedReasons ?? [], (_key, value) => (value === undefined ? null : value));
      if (serialized === undefined) throw new Error('json_serialization_failed');
      JSON.parse(serialized);
      this.serializedSkippedReasons.push(serialized);
    }
    await super.saveSnapshot(snapshot);
  }
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
    process.env.MONITOR_ENABLED = 'true';
    process.env.MONITOR_INTERVAL_MS = '10';
    process.env.MONITOR_TIMEOUT_MS = '500';
    const store = monitorStore();
    store.providers[0].serviceUrl = 'http://127.0.0.1:8787/health';
    const app = await createApp(store, new MemoryRepository());

    await vi.waitFor(() => expect(store.monitorRuns.length).toBeGreaterThan(0), { timeout: 500 });

    expect(store.monitorRuns[0]).toMatchObject({ mode: 'safe_metadata', checkedCount: 0, skippedCount: 1 });
    await app.close();
  });
});

describe('safe metadata monitor', () => {
  it('checks provider service_url only and never appends endpoint paths or sends payment/auth headers', async () => {
    const store = monitorStore();
    const requests: { url: string; init?: RequestInit }[] = [];
    const result = await runMonitor(store, new MemoryRepository(), {
      mode: 'safe_metadata',
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(null, { status: 204 });
      }
    });

    expect(result.run).toMatchObject({ mode: 'safe_metadata', checkedCount: 1, successCount: 1, reachableCount: 1 });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://monitor.test/');
    expect(requests[0].url).not.toContain('/paid-lookup');
    expect(requests[0].init?.method).toBe('HEAD');
    const headers = requests[0].init?.headers as Record<string, string>;
    expect(headers['user-agent']).toBe('InfopunksPayShRadar/0.1');
    expect(headers.authorization).toBeUndefined();
    expect(headers['x-payment']).toBeUndefined();
    expect(result.events.map((event) => event.type)).toEqual(expect.arrayContaining(['provider.checked', 'provider.reachable']));
    expect(result.events[0].payload).toMatchObject({
      provider_id: 'monitor',
      service_url: 'https://monitor.test/',
      monitor_mode: 'safe_metadata',
      check_type: 'service_url_reachability',
      safe_mode: true
    });
  });

  it('falls back from unsupported HEAD to safe GET without a request body', async () => {
    const store = monitorStore();
    const requests: RequestInit[] = [];
    await runMonitor(store, new MemoryRepository(), {
      mode: 'safe_metadata',
      fetchImpl: async (_url, init) => {
        requests.push(init ?? {});
        return init?.method === 'HEAD' ? new Response(null, { status: 405 }) : new Response('ok', { status: 200 });
      }
    });

    expect(requests.map((request) => request.method)).toEqual(['HEAD', 'GET']);
    expect(requests[1].body).toBeUndefined();
  });

  it('records degraded service reachability without marking it as endpoint execution evidence', async () => {
    const store = monitorStore();
    await runMonitor(store, new MemoryRepository(), {
      mode: 'safe_metadata',
      fetchImpl: async () => new Response('rate limited', { status: 429 })
    });

    expect(store.events.map((event) => event.type)).toEqual(expect.arrayContaining(['provider.checked', 'provider.degraded']));
    expect(store.events.map((event) => event.type)).not.toContain('endpoint.checked');
    expect(store.trustAssessments[0].components.uptime).toBe(65);
    expect(store.trustAssessments[0].components.latency).toBeTypeOf('number');
    expect(store.trustAssessments[0].components.responseValidity).toBeNull();
    expect(store.trustAssessments[0].components.receiptReliability).toBeNull();
  });

  it('separates network reachability from degraded root health for reachable HTTP 404 providers', async () => {
    const store = monitorStore();
    await runMonitor(store, new MemoryRepository(), {
      mode: 'safe_metadata',
      fetchImpl: async () => new Response('not found', { status: 404 })
    });

    const summary = pulseSummary(store);
    expect(summary.timeline.find((event) => event.type === 'provider.checked')?.summary).toMatch(/^Network reachable in \d+ms\.$/);
    expect(summary.recentDegradations.find((event) => event.type === 'provider.degraded')?.summary).toBe('Root health check returned HTTP 404; classified as degraded.');

    const app = await createApp(store);
    const history = (await app.inject({ method: 'GET', url: '/v1/providers/monitor/history' })).json().data;
    expect(history.find((event: { type: string }) => event.type === 'provider.degraded')?.summary).toBe('Root health check returned HTTP 404; classified as degraded.');
    expect(store.providers[0].evidence.map((item) => item.summary)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Network reachable in \d+ms\.$/),
      'Root health check returned HTTP 404; classified as degraded.'
    ]));
    await app.close();
  });

  it('records failed service reachability on timeout or fetch failure', async () => {
    const store = monitorStore();
    const result = await runMonitor(store, new MemoryRepository(), {
      mode: 'safe_metadata',
      fetchImpl: async () => {
        throw new Error('timeout');
      }
    });

    expect(result.run).toMatchObject({ checkedCount: 1, failedCount: 1 });
    expect(result.events.map((event) => event.type)).toEqual(expect.arrayContaining(['provider.checked', 'provider.failed']));
    expect(result.events.find((event) => event.type === 'provider.failed')?.payload.error_message).toBe('timeout');

    const summary = pulseSummary(store);
    expect(summary.timeline.find((event) => event.type === 'provider.checked')?.summary).toMatch(/^Network unreachable after \d+ms: timeout\.$/);
    expect(summary.recentDegradations.find((event) => event.type === 'provider.failed')?.summary).toMatch(/^Network unreachable after \d+ms: timeout\.$/);
  });

  it('summarizes healthy provider monitor events as reachable network plus healthy root health', async () => {
    const store = monitorStore();
    await runMonitor(store, new MemoryRepository(), {
      mode: 'safe_metadata',
      fetchImpl: async () => new Response(null, { status: 204 })
    });

    const summary = pulseSummary(store);
    expect(summary.timeline.find((event) => event.type === 'provider.checked')?.summary).toMatch(/^Network reachable in \d+ms\.$/);
    expect(summary.timeline.find((event) => event.type === 'provider.reachable')?.summary).toBe('Root health check returned HTTP 204; classified as healthy.');
  });

  it('summarizes unknown provider health state without success true wording', () => {
    const store = monitorStore();
    store.events = [
      providerEvent('provider.checked', { response_time_ms: undefined, success: undefined, status_code: undefined }),
      providerEvent('provider.degraded', { response_time_ms: undefined, success: true, status_code: undefined }, '2026-01-02T00:00:01.000Z')
    ];

    const summary = pulseSummary(store);
    expect(summary.timeline.find((event) => event.type === 'provider.checked')?.summary).toBe('Network reachability unknown after unknown latency.');
    expect(summary.recentDegradations[0].summary).toBe('Root health check returned unknown status; classified as degraded.');
  });

  it('skips invalid, non-http, private, and operation-like service URLs with reasons', async () => {
    const store = monitorStore();
    store.providers = [
      { ...store.providers[0], id: 'invalid', serviceUrl: 'not a url' },
      { ...store.providers[0], id: 'ftp', serviceUrl: 'ftp://monitor.test' },
      { ...store.providers[0], id: 'private', serviceUrl: 'http://127.0.0.1:8787' },
      { ...store.providers[0], id: 'operation', serviceUrl: 'https://monitor.test/v1/paid-lookup' }
    ];
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const result = await runMonitor(store, new MemoryRepository(), { mode: 'safe_metadata', fetchImpl });

    expect(result.run.checkedCount).toBe(0);
    expect(result.run.skippedCount).toBe(4);
    expect(result.run.skippedReasons?.map((item) => item.reason).sort()).toEqual([
      'invalid_url',
      'looks_like_paid_operation_path',
      'private_or_local_url',
      'unsupported_protocol'
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces safe provider degradations in pulse recent degradations', async () => {
    const store = monitorStore();
    await runMonitor(store, new MemoryRepository(), {
      mode: 'safe_metadata',
      fetchImpl: async () => new Response('down', { status: 503 })
    });

    const summary = pulseSummary(store);
    expect(summary.eventGroups.monitoring.count).toBeGreaterThan(0);
    expect(summary.recentDegradations[0]).toMatchObject({ type: 'provider.failed', summary: expect.stringContaining('Network unreachable') });
  });

  it('protects manual safe monitor runs with Bearer-only admin auth', async () => {
    process.env.INFOPUNKS_ADMIN_TOKEN = 'local-admin';
    process.env.MONITOR_MODE = 'safe_metadata';
    const store = monitorStore();
    store.providers[0].serviceUrl = null;
    const app = await createApp(store, new MemoryRepository());

    const rejected = await app.inject({ method: 'POST', url: '/v1/monitor/run' });
    const rejectedLegacyHeader = await app.inject({ method: 'POST', url: '/v1/monitor/run', headers: { 'x-infopunks-admin-token': 'local-admin' } });
    const accepted = await app.inject({ method: 'POST', url: '/v1/monitor/run', headers: { authorization: 'Bearer local-admin' } });

    expect(rejected.statusCode).toBe(401);
    expect(rejectedLegacyHeader.statusCode).toBe(401);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data.run).toMatchObject({ mode: 'safe_metadata', checkedCount: 0, skippedCount: 1 });
    await app.close();
  });

  it('allows manual POST /v1/monitor/run with strict JSON serialization repository behavior', async () => {
    process.env.INFOPUNKS_ADMIN_TOKEN = 'local-admin';
    process.env.MONITOR_MODE = 'safe_metadata';
    const store = monitorStore();
    const repository = new StrictJsonRepository();
    const app = await createApp(store, repository);

    const response = await app.inject({ method: 'POST', url: '/v1/monitor/run', headers: { authorization: 'Bearer local-admin' } });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.run).toMatchObject({ mode: 'safe_metadata', status: 'succeeded' });
    expect(repository.serializedSnapshots.length).toBeGreaterThan(0);
    expect(repository.serializedEventPayloads.length).toBeGreaterThan(0);
    await app.close();
  });

  it('persists production-like manual monitor payload shapes as valid JSON strings', async () => {
    process.env.INFOPUNKS_ADMIN_TOKEN = 'local-admin';
    process.env.MONITOR_MODE = 'safe_metadata';
    const store = monitorStore();
    const repository = new StrictJsonRepository();
    const app = await createApp(store, repository);

    const customDate = new Date('2026-03-01T10:20:30.000Z');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/monitor/run',
      headers: { authorization: 'Bearer local-admin' },
      payload: {}
    });

    let call = 0;
    await runMonitor(store, repository, {
      mode: 'safe_metadata',
      fetchImpl: async () => {
        call += 1;
        if (call === 1) {
          return new Response(null, { status: 204 });
        }
        if (call === 2) {
          return new Response('not found', { status: 404 });
        }
        throw new Error('provider_unreachable');
      }
    });

    store.events.push({
      id: 'manual-shape-event',
      type: 'provider.checked',
      source: 'test',
      entityType: 'provider',
      entityId: store.providers[0].id,
      observedAt: new Date().toISOString(),
      payload: {
        provider_reachable: { status_code: 204, checked_at: customDate, details: ['ok', undefined, null] },
        provider_degraded: { status_code: 404, nested: [[{ keep: true }, undefined]], reason: 'status_code_404' },
        provider_failed: { error_obj: new Error('boom'), error_string: 'boom-string' },
        skippedReasons: [{ providerId: 'x', serviceUrl: null, reason: 'missing_service_url' }],
        run_summary: { optionalUndefined: undefined, optionalNull: null, alreadyString: 'already-string' },
        nested_arrays: [[1, undefined, 3], [{ when: customDate }]]
      } as unknown as Record<string, unknown>
    });
    await repository.saveSnapshot(store);

    expect(response.statusCode).toBe(200);
    for (const value of repository.serializedEventPayloads) {
      expect(() => JSON.parse(value)).not.toThrow();
    }
    for (const value of repository.serializedSkippedReasons) {
      expect(() => JSON.parse(value)).not.toThrow();
    }
    for (const value of repository.serializedSnapshots) {
      expect(() => JSON.parse(value)).not.toThrow();
    }
    await app.close();
  });

  it('serializes skippedReasons as valid JSON', async () => {
    const store = monitorStore();
    store.providers[0].serviceUrl = null;
    const repository = new StrictJsonRepository();

    await runMonitor(store, repository, { mode: 'safe_metadata' });

    expect(repository.serializedSkippedReasons.length).toBeGreaterThan(0);
    const latest = JSON.parse(repository.serializedSkippedReasons[repository.serializedSkippedReasons.length - 1]);
    expect(latest).toEqual([{ providerId: 'monitor', serviceUrl: null, reason: 'missing_service_url' }]);
  });

  it('returns snake_case recent run summary fields', async () => {
    const store = monitorStore();
    await runMonitor(store, new MemoryRepository(), {
      mode: 'safe_metadata',
      fetchImpl: async () => new Response(null, { status: 204 })
    });
    const app = await createApp(store, new MemoryRepository());
    const response = await app.inject({ method: 'GET', url: '/v1/monitor/runs/recent' });

    expect(response.json().data[0]).toMatchObject({
      mode: 'safe_metadata',
      checked_count: 1,
      reachable_count: 1,
      degraded_count: 0,
      failed_count: 0,
      skipped_count: 0,
      started_at: expect.any(String),
      finished_at: expect.any(String)
    });
    await app.close();
  });
});
