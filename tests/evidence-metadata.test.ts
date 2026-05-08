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
  name: 'Receipt API',
  title: 'Receipt API',
  namespace: 'pay/receipt',
  slug: 'receipt',
  fqn: 'pay/receipt',
  category: 'Data',
  endpoints: 2,
  endpoint_count: 2,
  endpointMetadataPartial: true,
  price: '$0.01',
  status: 'metered',
  description: 'Receipt provider with partial endpoint metadata for audit evidence tests.',
  tags: ['receipt', 'audit'],
  catalog_generated_at: '2026-01-01T00:00:00.000Z',
  sha: 'abc123'
}];

function store() {
  const ingested = applyPayShCatalogIngestion(emptySnapshot, catalog, {
    observedAt: '2026-01-01T00:05:00.000Z',
    source: 'pay.sh:test',
    dataSource: {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      generated_at: '2026-01-01T00:00:00.000Z',
      provider_count: 1,
      last_ingested_at: null,
      used_fixture: false,
      error: null
    }
  });
  return recomputeAssessments(ingested.snapshot);
}

describe('evidence audit metadata', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes additive evidence fields on provider, score, pulse, and graph API payloads', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T12:00:00.000Z') });
    const app = await createApp(store());

    const providers = await app.inject({ method: 'GET', url: '/v1/providers' });
    const provider = providers.json().data[0];
    expect(provider).toMatchObject({
      id: 'receipt',
      provider_id: 'receipt',
      observed_at: '2026-01-01T00:05:00.000Z',
      ingested_at: '2026-01-01T00:05:00.000Z',
      catalog_generated_at: '2026-01-01T00:00:00.000Z'
    });
    expect(provider.evidence[0]).toMatchObject({
      event_id: expect.any(String),
      provider_id: 'receipt',
      endpoint_id: null,
      observed_at: '2026-01-01T00:05:00.000Z',
      ingested_at: '2026-01-01T00:05:00.000Z',
      source: 'pay.sh:test',
      derivation_reason: expect.any(String),
      confidence: 1
    });
    expect(provider.pricing).toMatchObject({
      provider_id: 'receipt',
      endpoint_id: null,
      observed_at: '2026-01-01T00:05:00.000Z',
      source: 'pay.sh:test',
      derivation_reason: expect.any(String),
      confidence: 1
    });

    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse/summary' });
    const summary = pulse.json().data;
    const providerTimelineEvent = summary.timeline.find((event: { provider_id: string | null }) => event.provider_id === 'receipt');
    expect(providerTimelineEvent).toMatchObject({
      event_id: expect.any(String),
      provider_id: 'receipt',
      observed_at: '2026-01-01T00:05:00.000Z',
      ingested_at: '2026-01-01T00:05:00.000Z',
      source: 'pay.sh:test',
      derivation_reason: expect.any(String),
      confidence: 1
    });
    expect(providerTimelineEvent.observed_at).toBe('2026-01-01T00:05:00.000Z');
    expect(providerTimelineEvent.catalog_generated_at).toBeNull();
    expect(providerTimelineEvent.ingested_at).toBe('2026-01-01T00:05:00.000Z');
    expect(providerTimelineEvent.ingested_at).toBe(providerTimelineEvent.observed_at);
    expect(summary.trustDeltas[0]).toMatchObject({
      event_id: expect.any(String),
      provider_id: 'receipt',
      endpoint_id: null,
      observed_at: '2026-01-01T00:05:00.000Z',
      source: 'infopunks:deterministic-scoring',
      derivation_reason: expect.any(String),
      confidence: expect.any(Number)
    });
    expect(summary.providerActivity['24h'][0]).toMatchObject({
      provider_id: 'receipt',
      observed_at: '2026-01-01T00:05:00.000Z',
      source: expect.any(String),
      derivation_reason: expect.any(String),
      confidence: 1
    });

    const detail = await app.inject({ method: 'GET', url: '/v1/providers/receipt' });
    expect(detail.json().data.trustAssessment).toMatchObject({
      provider_id: 'receipt',
      endpoint_id: null,
      observed_at: '2026-01-01T00:05:00.000Z',
      source: 'infopunks:deterministic-scoring',
      derivation_reason: expect.any(String),
      confidence: expect.any(Number)
    });

    const graph = await app.inject({ method: 'GET', url: '/v1/graph' });
    expect(graph.json().data.evidence).toMatchObject({
      event_id: expect.any(String),
      provider_id: null,
      endpoint_id: null,
      catalog_generated_at: '2026-01-01T00:00:00.000Z',
      ingested_at: '2026-01-01T00:05:00.000Z',
      derivation_reason: expect.any(String),
      confidence: 1
    });

    await app.close();
  });
});
