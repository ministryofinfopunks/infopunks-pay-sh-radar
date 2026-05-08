import { describe, expect, it } from 'vitest';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { InfopunksEvent } from '../src/schemas/entities';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { analyzePropagation } from '../src/services/propagationService';

const observedAt = '2026-01-01T00:00:00.000Z';
const generatedAt = '2026-01-01T01:00:00.000Z';

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
    dataSource: {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/catalog',
      generated_at: observedAt,
      provider_count: null,
      last_ingested_at: observedAt,
      used_fixture: false,
      error: null
    }
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
    endpointDetails: [{
      name: 'Run',
      path: '/run',
      method: 'POST',
      category,
      description: `${slug} endpoint.`,
      price: '$0.01',
      status: 'available',
      schema: { response: { type: 'object' } }
    }]
  };
}

function storeFor(items: PayShCatalogItem[], events: InfopunksEvent[]) {
  const ingested = applyPayShCatalogIngestion(emptySnapshot(), items, { observedAt, source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.dataSource = {
    mode: 'live_pay_sh_catalog',
    url: 'https://pay.sh/catalog',
    generated_at: observedAt,
    provider_count: items.length,
    last_ingested_at: observedAt,
    used_fixture: false,
    error: null
  };
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

describe('propagation analysis', () => {
  it('classifies one degraded provider as isolated', () => {
    const store = storeFor([provider('image-one', 'Image', ['image'])], [degraded('image-one')]);

    const analysis = analyzePropagation(store, generatedAt);

    expect(analysis.propagation_state).toBe('isolated');
    expect(analysis.severity).toBe('low');
    expect(analysis.affected_providers).toHaveLength(1);
  });

  it('classifies three image/media providers degraded in one window as clustered', () => {
    const items = [
      provider('image-one', 'Media', ['image', 'media']),
      provider('image-two', 'Media', ['image', 'media']),
      provider('image-three', 'Media', ['image', 'media'])
    ];
    const store = storeFor(items, items.map((item, index) => degraded(item.slug, index)));

    const analysis = analyzePropagation(store, generatedAt);

    expect(analysis.propagation_state).toBe('clustered');
    expect(analysis.severity).toBe('medium');
    expect(analysis.affected_categories).toEqual(['Media']);
  });

  it('classifies five related providers across image video and OCR as spreading', () => {
    const items = [
      provider('image-one', 'Image', ['vision']),
      provider('image-two', 'Image', ['vision']),
      provider('video-one', 'Video', ['vision']),
      provider('video-two', 'Video', ['vision']),
      provider('ocr-one', 'OCR', ['vision'])
    ];
    const store = storeFor(items, items.map((item, index) => degraded(item.slug, index)));

    const analysis = analyzePropagation(store, generatedAt);

    expect(analysis.propagation_state).toBe('spreading');
    expect(analysis.severity).toBe('high');
    expect(analysis.affected_categories).toEqual(['Image', 'OCR', 'Video']);
  });

  it('classifies broad unrelated failures across categories as systemic', () => {
    const items = [
      provider('alpha-data', 'Data', ['lookup']),
      provider('beta-media', 'Media', ['render']),
      provider('gamma-payments', 'Payments', ['receipt']),
      provider('delta-voice', 'Voice', ['transcribe']),
      provider('epsilon-auth', 'Auth', ['identity'])
    ];
    const store = storeFor(items, items.map((item, index) => failed(item.slug, index)));

    const analysis = analyzePropagation(store, generatedAt);

    expect(analysis.propagation_state).toBe('systemic');
    expect(analysis.severity).toBe('critical');
    expect(analysis.affected_categories).toHaveLength(5);
  });

  it('classifies insufficient data as unknown', () => {
    const store = storeFor([provider('quiet-one', 'Data', ['lookup'])], []);

    const analysis = analyzePropagation(store, generatedAt);

    expect(analysis.propagation_state).toBe('unknown');
    expect(analysis.severity).toBe('unknown');
    expect(analysis.supporting_event_ids).toEqual([]);
  });
});
