import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
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
  name: 'Alpha API',
  namespace: 'pay/alpha',
  slug: 'alpha',
  category: 'Data',
  endpoints: 1,
  price: '$0.01',
  status: 'metered',
  description: 'Alpha provider for provider intelligence API tests with enough metadata to produce deterministic scoring.',
  tags: ['alpha', 'lookup'],
  endpointDetails: [{
    name: 'Lookup',
    path: '/lookup',
    method: 'GET',
    category: 'Data',
    description: 'Lookup endpoint.',
    price: '$0.01',
    status: 'available',
    schema: { response: { type: 'object', properties: { ok: { type: 'boolean' } } } }
  }]
}];

const changedCatalog: PayShCatalogItem[] = [{
  ...catalog[0],
  description: 'Alpha provider changed metadata for provider intelligence API tests.',
  price: '$0.02',
  endpointDetails: [{
    ...catalog[0].endpointDetails![0],
    path: '/lookup-v2',
    price: '$0.02',
    schema: { response: { type: 'object', properties: { ok: { type: 'boolean' }, version: { type: 'string' } } } }
  }]
}];

const rotationCatalog: PayShCatalogItem[] = [
  { ...catalog[0], name: 'Beta API', namespace: 'pay/beta', slug: 'beta', tags: ['beta', 'lookup'] },
  { ...catalog[0], name: 'Alpha API', namespace: 'pay/alpha', slug: 'alpha', tags: ['alpha', 'lookup'] },
  { ...catalog[0], name: 'Gamma API', namespace: 'pay/gamma', slug: 'gamma', tags: ['gamma', 'lookup'] }
];

function changedStore() {
  const first = applyPayShCatalogIngestion(emptySnapshot, catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' });
  const second = applyPayShCatalogIngestion(first.snapshot, changedCatalog, { observedAt: '2026-01-02T00:00:00.000Z', source: 'pay.sh:test' });
  return recomputeAssessments(second.snapshot);
}

function rotationStore() {
  return recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot, rotationCatalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('provider intelligence API', () => {
  it('returns provider history ordered newest first', async () => {
    const app = await createApp(changedStore());
    const response = await app.inject({ method: 'GET', url: '/v1/providers/alpha/history' });
    const history = response.json().data;

    expect(response.statusCode).toBe(200);
    expect(history.length).toBeGreaterThan(0);
    expect(history.map((item: { observedAt: string }) => item.observedAt)).toEqual([...history].map((item: { observedAt: string }) => item.observedAt).sort().reverse());
    expect(history[0].observedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(history.some((item: { type: string }) => item.type === 'manifest.updated')).toBe(true);
    await app.close();
  });

  it('returns endpoint history ordered newest first', async () => {
    const app = await createApp(changedStore());
    const response = await app.inject({ method: 'GET', url: '/v1/endpoints/alpha-endpoint-1/history' });
    const history = response.json().data;

    expect(response.statusCode).toBe(200);
    expect(history[0].observedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(history.some((item: { type: string }) => item.type === 'endpoint.updated')).toBe(true);
    expect(history.some((item: { type: string }) => item.type === 'schema.changed')).toBe(true);
    await app.close();
  });

  it('summarizes provider intelligence from assessments, events, and endpoints', async () => {
    const app = await createApp(changedStore());
    const response = await app.inject({ method: 'GET', url: '/v1/providers/alpha/intelligence' });
    const summary = response.json().data;

    expect(response.statusCode).toBe(200);
    expect(summary.latest_trust_score).toBeTypeOf('number');
    expect(summary.latest_signal_score).toBeTypeOf('number');
    expect(summary.risk_level).toMatch(/^(low|medium|high)$/);
    expect(summary.coordination_eligible).toBeTypeOf('boolean');
    expect(summary.endpoint_count).toBe(1);
    expect(summary.category_tags).toContain('Data');
    expect(summary.category_tags).toContain('alpha');
    expect(summary.last_seen_at).toBe('2026-01-02T00:00:00.000Z');
    expect(summary.unknown_telemetry).toContain('uptime');
    expect(summary.recent_changes.map((item: { type: string }) => item.type)).toEqual(expect.arrayContaining(['manifest.updated', 'price.changed']));
    await app.close();
  });

  it('returns empty histories and null summary fields when no event or assessment history exists', async () => {
    const store = recomputeAssessments(applyPayShCatalogIngestion(emptySnapshot, catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot);
    store.events = [];
    store.trustAssessments = [];
    store.signalAssessments = [];
    const app = await createApp(store);

    const history = await app.inject({ method: 'GET', url: '/v1/providers/alpha/history' });
    const endpoint = await app.inject({ method: 'GET', url: '/v1/endpoints/alpha-endpoint-1/history' });
    const intelligence = await app.inject({ method: 'GET', url: '/v1/providers/alpha/intelligence' });

    expect(history.statusCode).toBe(200);
    expect(history.json().data).toEqual([]);
    expect(endpoint.statusCode).toBe(200);
    expect(endpoint.json().data).toEqual([]);
    expect(intelligence.json().data).toMatchObject({
      latest_trust_score: null,
      latest_signal_score: null,
      risk_level: 'unknown',
      coordination_eligible: null,
      recent_changes: []
    });
    await app.close();
  });

  it('returns the same featured provider inside the same rotation window', async () => {
    vi.useFakeTimers({ now: new Date('1970-01-01T00:00:01.000Z') });
    const app = await createApp(rotationStore());

    const first = await app.inject({ method: 'GET', url: '/v1/providers/featured' });
    vi.setSystemTime(new Date('1970-01-01T00:09:59.000Z'));
    const second = await app.inject({ method: 'GET', url: '/v1/providers/featured' });

    expect(first.statusCode).toBe(200);
    expect(first.json().data.providerId).toBe('alpha');
    expect(second.json().data.providerId).toBe('alpha');
    expect(second.json().data.providerCount).toBe(3);
    await app.close();
  });

  it('returns the next featured provider in the next rotation window', async () => {
    vi.useFakeTimers({ now: new Date('1970-01-01T00:00:00.000Z') });
    const app = await createApp(rotationStore());

    const first = await app.inject({ method: 'GET', url: '/v1/providers/featured' });
    vi.setSystemTime(new Date('1970-01-01T00:10:00.000Z'));
    const second = await app.inject({ method: 'GET', url: '/v1/providers/featured' });

    expect(first.json().data).toMatchObject({ providerId: 'alpha', index: 0, providerCount: 3, rotationWindowMs: 600000, strategy: 'time_window_round_robin' });
    expect(second.json().data).toMatchObject({ providerId: 'beta', index: 1, providerCount: 3, rotationWindowMs: 600000, strategy: 'time_window_round_robin' });
    await app.close();
  });

  it('keeps featured provider stable across repeated refreshes in one window', async () => {
    vi.useFakeTimers({ now: new Date('1970-01-01T00:12:00.000Z') });
    const app = await createApp(rotationStore());

    const refreshOne = await app.inject({ method: 'GET', url: '/v1/providers/featured' });
    const refreshTwo = await app.inject({ method: 'GET', url: '/v1/providers/featured' });

    expect(refreshOne.json().data.providerId).toBe('beta');
    expect(refreshTwo.json().data.providerId).toBe('beta');
    expect(refreshTwo.json().data.nextRotationAt).toBe('1970-01-01T00:20:00.000Z');
    await app.close();
  });

  it('handles an empty provider list safely for featured rotation', async () => {
    vi.useFakeTimers({ now: new Date('1970-01-01T00:00:00.000Z') });
    const app = await createApp(recomputeAssessments(emptySnapshot));

    const response = await app.inject({ method: 'GET', url: '/v1/providers/featured' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      providerId: null,
      providerName: null,
      category: null,
      index: null,
      providerCount: 0,
      rotationWindowMs: 600000,
      strategy: 'time_window_round_robin'
    });
    await app.close();
  });
});
