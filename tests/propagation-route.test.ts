import { describe, expect, it } from 'vitest';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot, MemoryRepository } from '../src/persistence/repository';
import { InfopunksEvent } from '../src/schemas/entities';
import { createApp } from '../src/api/app';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { analyzePropagation } from '../src/services/propagationService';

const observedAt = new Date(Date.now() - 60_000).toISOString();
const generatedAt = new Date().toISOString();

function emptySnapshot(): IntelligenceSnapshot {
  return {
    events: [],
    providers: [],
    endpoints: [],
    trustAssessments: [],
    signalAssessments: [],
    narratives: [],
    ingestionRuns: [],
    monitorRuns: [],
    dataSource: { mode: 'live_pay_sh_catalog', url: 'https://pay.sh/catalog', generated_at: observedAt, provider_count: null, last_ingested_at: observedAt, used_fixture: false, error: null }
  };
}

function provider(slug: string, category: string, tags: string[]): PayShCatalogItem {
  return {
    name: `${slug} API`,
    namespace: `pay/${slug}`,
    slug,
    category,
    endpoints: 1,
    price: '$0.01',
    status: 'metered',
    description: `${slug} ${category} provider for deterministic propagation tests.`,
    tags,
    endpointDetails: [{ name: 'Run', path: '/run', method: 'POST', category, description: `${slug} endpoint.`, price: '$0.01', status: 'available', schema: { response: { type: 'object' } } }]
  };
}

function storeFor(items: PayShCatalogItem[], events: InfopunksEvent[]) {
  const ingested = applyPayShCatalogIngestion(emptySnapshot(), items, { observedAt, source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.events.push(...events);
  return store;
}

function degraded(providerId: string, index = 0): InfopunksEvent {
  return event('provider.degraded', providerId, index, { providerId, success: true, status: 'degraded', response_time_ms: 1500 });
}

function failed(providerId: string, index = 0): InfopunksEvent {
  return event('provider.failed', providerId, index, { providerId, success: false, error: 'unreachable' });
}

function event(type: InfopunksEvent['type'], providerId: string, index: number, payload: Record<string, unknown>): InfopunksEvent {
  return {
    id: `${type}-${providerId}-${index}`,
    event_id: `${type}-${providerId}-${index}`,
    type,
    source: 'infopunks:test-monitor',
    entityType: 'provider',
    entityId: providerId,
    provider_id: providerId,
    endpoint_id: null,
    observedAt: new Date(Date.parse(observedAt) + index * 1000).toISOString(),
    observed_at: new Date(Date.parse(observedAt) + index * 1000).toISOString(),
    catalog_generated_at: observedAt,
    ingested_at: observedAt,
    derivation_reason: 'Synthetic monitor event for propagation test.',
    confidence: 1,
    payload
  };
}

describe('propagation incident route', () => {
  it('uses deterministic cluster ids', () => {
    const store = storeFor([provider('image-one', 'Image', ['image'])], [degraded('image-one')]);
    const first = analyzePropagation(store, generatedAt);
    const second = analyzePropagation(store, generatedAt);
    expect(first.cluster_id).toBe(second.cluster_id);
    expect(first.cluster_id).toMatch(/^prop-[a-f0-9]{16}$/);
  });

  it('returns isolated incident', async () => {
    const store = storeFor([provider('image-one', 'Image', ['image'])], [degraded('image-one')]);
    const app = await createApp(store, new MemoryRepository());
    const listResponse = await app.inject({ method: 'GET', url: '/v1/propagation' });
    const clusterId = listResponse.json().data.cluster_id as string;
    const response = await app.inject({ method: 'GET', url: `/v1/propagation/${clusterId}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.propagation_state).toBe(listResponse.json().data.propagation_state);
    expect(listResponse.json().data.supporting_event_ids.length).toBeLessThanOrEqual(10);
    expect(listResponse.json().data.supporting_event_count).toBeGreaterThanOrEqual(listResponse.json().data.supporting_event_ids.length);
    expect(listResponse.json().data.remaining_event_count).toBe(listResponse.json().data.supporting_event_count - listResponse.json().data.supporting_event_ids.length);
    expect(listResponse.json().data.view_full_receipts_url).toBe(`/propagation/${clusterId}`);
    await app.close();
  });

  it('returns spreading incident with receipt and provider links', async () => {
    const items = [
      provider('image-one', 'Image', ['vision']),
      provider('image-two', 'Image', ['vision']),
      provider('video-one', 'Video', ['vision']),
      provider('video-two', 'Video', ['vision']),
      provider('ocr-one', 'OCR', ['vision'])
    ];
    const store = storeFor(items, items.map((item, index) => degraded(item.slug, index)));
    const app = await createApp(store, new MemoryRepository());
    const listResponse = await app.inject({ method: 'GET', url: '/v1/propagation' });
    const clusterId = listResponse.json().data.cluster_id as string;
    const response = await app.inject({ method: 'GET', url: `/v1/propagation/${clusterId}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.propagation_state).toBeTypeOf('string');
    expect(response.json().data.supporting_receipt_links[0].href).toMatch(/^\/v1\/events\//);
    expect(response.json().data.related_provider_links[0].href).toMatch(/^\/v1\/providers\//);
    await app.close();
  });

  it('returns systemic incident', async () => {
    const items = [
      provider('alpha-data', 'Data', ['lookup']),
      provider('beta-media', 'Media', ['render']),
      provider('gamma-payments', 'Payments', ['receipt']),
      provider('delta-voice', 'Voice', ['transcribe']),
      provider('epsilon-auth', 'Auth', ['identity'])
    ];
    const store = storeFor(items, items.map((item, index) => failed(item.slug, index)));
    const app = await createApp(store, new MemoryRepository());
    const listResponse = await app.inject({ method: 'GET', url: '/v1/propagation' });
    const clusterId = listResponse.json().data.cluster_id as string;
    const response = await app.inject({ method: 'GET', url: `/v1/propagation/${clusterId}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.propagation_state).toBe(listResponse.json().data.propagation_state);
    await app.close();
  });

  it('returns 404 for missing cluster', async () => {
    const store = storeFor([provider('quiet-one', 'Data', ['lookup'])], []);
    const app = await createApp(store, new MemoryRepository());
    const response = await app.inject({ method: 'GET', url: '/v1/propagation/prop-missing' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('propagation_cluster_not_found');
    await app.close();
  });
});
