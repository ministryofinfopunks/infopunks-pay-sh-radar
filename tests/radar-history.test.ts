import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { buildEndpointHistory, buildProviderHistory, providerTrendDeltas } from '../src/services/radarHistoryService';
import { InfopunksEvent } from '../src/schemas/entities';

const T0 = '2026-05-01T00:00:00.000Z';
const T1 = '2026-05-01T12:00:00.000Z';
const T2 = '2026-05-02T00:00:00.000Z';

function baseStore() {
  const empty: IntelligenceSnapshot = { events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [] };
  const catalog: PayShCatalogItem[] = [{ name: 'Alpha Finance', namespace: 'finance/alpha', slug: 'alpha', category: 'finance', endpoints: 1, price: '$0.001', status: 'metered', description: 'finance data', tags: ['finance'] }];
  const ingested = applyPayShCatalogIngestion(empty, catalog, { observedAt: T0, source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.endpoints = store.endpoints.map((endpoint) => ({ ...endpoint, id: 'alpha-endpoint-1', method: 'GET', path: '/price', status: 'available' }));
  return store;
}

function scoreEvent(id: string, kind: 'trust_assessment' | 'signal_assessment', score: number, observedAt: string): InfopunksEvent {
  return {
    id,
    type: 'score_assessment_created',
    source: 'infopunks:test',
    entityType: kind,
    entityId: 'alpha',
    provider_id: 'alpha',
    observedAt,
    observed_at: observedAt,
    confidence: 1,
    payload: { providerId: 'alpha', entityId: 'alpha', score, components: { metadataQuality: score - 5, pricingClarity: score - 3 } }
  };
}

function providerEvent(id: string, type: 'provider.reachable' | 'provider.degraded' | 'provider.failed', observedAt: string, latency = 120): InfopunksEvent {
  return {
    id,
    type,
    source: 'infopunks:safe-metadata-monitor',
    entityType: 'provider',
    entityId: 'alpha',
    provider_id: 'alpha',
    observedAt,
    observed_at: observedAt,
    confidence: 1,
    payload: { providerId: 'alpha', response_time_ms: latency, monitor_mode: 'safe_metadata', safe_mode: true }
  };
}

function endpointEvent(id: string, type: 'endpoint.recovered' | 'endpoint.degraded' | 'endpoint.failed' | 'endpoint.updated', observedAt: string): InfopunksEvent {
  return {
    id,
    type,
    source: 'infopunks:test',
    entityType: 'endpoint',
    entityId: 'alpha-endpoint-1',
    provider_id: 'alpha',
    endpoint_id: 'alpha-endpoint-1',
    observedAt,
    observed_at: observedAt,
    confidence: 1,
    payload: { providerId: 'alpha', endpointId: 'alpha-endpoint-1', method: 'GET', path: '/price', pricing: { min: 0.001, max: 0.001, raw: '$0.001' } }
  };
}

function storeWithHistory() {
  const store = baseStore();
  store.events.push(
    scoreEvent('trust-1', 'trust_assessment', 80, T0),
    scoreEvent('trust-2', 'trust_assessment', 74, T2),
    scoreEvent('signal-1', 'signal_assessment', 60, T0),
    scoreEvent('signal-2', 'signal_assessment', 66, T2),
    providerEvent('provider-ok', 'provider.reachable', T0, 100),
    providerEvent('provider-degraded', 'provider.degraded', T2, 480),
    endpointEvent('endpoint-ok', 'endpoint.recovered', T0),
    endpointEvent('endpoint-degraded', 'endpoint.degraded', T2)
  );
  return store;
}

describe('radar history service', () => {
  it('derives provider history when sufficient score and monitor samples exist', () => {
    const history = buildProviderHistory(storeWithHistory(), 'alpha', '48h');

    expect(history?.history_available).toBe(true);
    expect(history?.series.trust_score).toHaveLength(2);
    expect(history?.deltas.trust_delta_24h).toBe(-6);
    expect(history?.deltas.signal_delta_24h).toBe(6);
    expect(history?.last_known_good?.last_seen_healthy_at).toBe(T0);
    expect(history?.last_known_good?.last_degraded_at).toBe(T2);
  });

  it('degrades gracefully when no historical samples exist', () => {
    const history = buildProviderHistory(baseStore(), 'alpha', '24h');

    expect(history?.history_available).toBe(false);
    expect(history?.reason).toBe('No historical snapshots available yet');
    expect(history?.warnings).toContain('history warming up');
  });

  it('calculates trend deltas without inventing missing values', () => {
    const deltas = providerTrendDeltas(storeWithHistory(), 'alpha', Date.parse(T2));

    expect(deltas.trust_delta_24h).toBe(-6);
    expect(deltas.signal_delta_24h).toBe(6);
    expect(deltas.degradation_delta_24h).toBe(2);
    expect(deltas.trend_direction).toBe('degrading');
  });

  it('derives endpoint route eligibility and last known good state', () => {
    const history = buildEndpointHistory(storeWithHistory(), 'alpha-endpoint-1', '48h');

    expect(history?.history_available).toBe(true);
    expect(history?.deltas.route_eligibility_changed).toBe(true);
    expect(history?.last_known_good?.last_seen_healthy_at).toBe(T0);
    expect(history?.last_known_good?.last_degraded_at).toBe(T2);
  });

  it('exposes public radar history route response shape', async () => {
    const app = await createApp(storeWithHistory());

    const provider = await app.inject({ method: 'GET', url: '/v1/radar/history/providers/alpha?window=48h' });
    const endpoint = await app.inject({ method: 'GET', url: '/v1/radar/history/endpoints/alpha-endpoint-1?window=48h' });
    const ecosystem = await app.inject({ method: 'GET', url: '/v1/radar/history/ecosystem?window=48h' });

    expect(provider.statusCode).toBe(200);
    expect(provider.json().data).toMatchObject({ window: '48h', history_available: true, sample_count: expect.any(Number), series: expect.any(Object), deltas: expect.any(Object), warnings: expect.any(Array) });
    expect(endpoint.json().data.series).toHaveProperty('route_eligibility');
    expect(ecosystem.json().data.series).toHaveProperty('average_trust');
    await app.close();
  });
});
