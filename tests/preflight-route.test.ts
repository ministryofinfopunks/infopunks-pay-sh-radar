import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { InfopunksEvent } from '../src/schemas/entities';
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

const catalog: PayShCatalogItem[] = [
  {
    name: 'Alpha API',
    namespace: 'pay/alpha',
    slug: 'alpha',
    category: 'Payments',
    endpoints: 1,
    price: '$0.01',
    status: 'metered',
    description: 'Alpha test provider.',
    tags: ['alpha', 'payments']
  },
  {
    name: 'Beta API',
    namespace: 'pay/beta',
    slug: 'beta',
    category: 'Payments',
    endpoints: 1,
    price: '$0.08',
    status: 'metered',
    description: 'Beta test provider.',
    tags: ['beta', 'payments']
  }
];

function preflightStore() {
  const ingested = applyPayShCatalogIngestion(emptySnapshot, catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.dataSource = {
    mode: 'live_pay_sh_catalog',
    url: 'https://pay.sh/api/catalog',
    generated_at: '2026-01-01T00:00:00.000Z',
    provider_count: 2,
    last_ingested_at: '2026-01-01T00:00:00.000Z',
    used_fixture: false,
    error: null
  };
  store.trustAssessments = store.trustAssessments.map((item) =>
    item.entityId === 'alpha' ? { ...item, score: 92 } : { ...item, score: 65 });
  store.signalAssessments = store.signalAssessments.map((item) =>
    item.entityId === 'alpha' ? { ...item, score: 88 } : { ...item, score: 91 });
  const providerEvents: InfopunksEvent[] = [
    {
      id: 'alpha-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'alpha',
      observedAt: '2026-01-02T00:00:00.000Z',
      payload: { providerId: 'alpha', response_time_ms: 150, success: true }
    },
    {
      id: 'alpha-recovered',
      type: 'provider.recovered',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'alpha',
      observedAt: '2026-01-02T00:01:00.000Z',
      payload: { providerId: 'alpha', response_time_ms: 150, success: true }
    },
    {
      id: 'beta-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'beta',
      observedAt: '2026-01-02T00:00:00.000Z',
      payload: { providerId: 'beta', response_time_ms: 700, success: true }
    },
    {
      id: 'beta-degraded',
      type: 'provider.degraded',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'beta',
      observedAt: '2026-01-02T00:02:00.000Z',
      payload: { providerId: 'beta', response_time_ms: 700, success: false }
    }
  ];
  store.events.push(...providerEvents);
  return store;
}

describe('preflight API', () => {
  it('returns route_approved when at least one candidate passes policy', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement', category: 'Payments', constraints: { minTrustScore: 80, maxLatencyMs: 300, maxCostUsd: 0.05 } }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      decision: 'route_approved',
      selectedProvider: 'alpha',
      candidateCount: 2,
      dataMode: 'live'
    });
    await app.close();
  });

  it('returns route_blocked when all providers are rejected', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement', constraints: { minTrustScore: 95 } }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.decision).toBe('route_blocked');
    expect(response.json().data.selectedProvider).toBeNull();
    expect(response.json().data.rejectedProviders.length).toBe(2);
    await app.close();
  });

  it('filters candidate providers when candidateProviders is supplied', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement', candidateProviders: ['beta'], constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.candidateCount).toBe(1);
    expect(body.decision).toBe('route_blocked');
    expect(body.rejectedProviders[0].providerId).toBe('beta');
    await app.close();
  });

  it('uses default constraints when constraints are missing', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement' }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.routingPolicy.constraints.minTrustScore).toBe(70);
    expect(body.routingPolicy.constraints.maxLatencyMs).toBeNull();
    expect(body.routingPolicy.constraints.maxCostUsd).toBeNull();
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('alpha');
    await app.close();
  });

  it('exposes preflight schema endpoint', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({ method: 'GET', url: '/v1/preflight/schema' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.request).toBeTruthy();
    expect(response.json().data.response).toBeTruthy();
    await app.close();
  });
});
