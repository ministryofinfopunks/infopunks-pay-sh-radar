import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { buildEndpointRiskAssessment, buildEcosystemRiskSummary, buildProviderRiskAssessment } from '../src/services/radarRiskService';
import { InfopunksEvent } from '../src/schemas/entities';

const T0 = '2026-05-01T00:00:00.000Z';
const T1 = '2026-05-01T12:00:00.000Z';
const T2 = '2026-05-02T00:00:00.000Z';
const T3 = '2026-05-02T12:00:00.000Z';

function baseStore() {
  const empty: IntelligenceSnapshot = {
    events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: []
  };
  const catalog: PayShCatalogItem[] = [
    { name: 'Alpha Finance', namespace: 'finance/alpha', slug: 'alpha', category: 'finance', endpoints: 1, price: '$0.001', status: 'metered', description: 'alpha', tags: ['finance'] },
    { name: 'Beta Finance', namespace: 'finance/beta', slug: 'beta', category: 'finance', endpoints: 1, price: '$0.002', status: 'metered', description: 'beta', tags: ['finance'] }
  ];
  const ingested = applyPayShCatalogIngestion(empty, catalog, { observedAt: T0, source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.endpoints = store.endpoints.map((endpoint) => ({
    ...endpoint,
    id: endpoint.providerId === 'alpha' ? 'alpha-endpoint-1' : 'beta-endpoint-1',
    method: 'GET',
    path: endpoint.providerId === 'alpha' ? '/alpha' : '/beta',
    status: 'available',
    pricing: { ...endpoint.pricing, min: endpoint.providerId === 'alpha' ? 0.001 : 0.002, max: endpoint.providerId === 'alpha' ? 0.001 : 0.002, raw: endpoint.providerId === 'alpha' ? '$0.001' : '$0.002' }
  }));
  store.trustAssessments = store.trustAssessments.map((item) => ({
    ...item,
    score: item.entityId === 'alpha' ? 92 : 88,
    grade: 'A',
    components: {
      ...item.components,
      metadataQuality: item.entityId === 'alpha' ? 90 : 87,
      pricingClarity: 95,
      freshness: 96
    }
  }));
  store.signalAssessments = store.signalAssessments.map((item) => ({
    ...item,
    score: item.entityId === 'alpha' ? 70 : 65
  }));
  store.dataSource = {
    mode: 'live_pay_sh_catalog',
    url: 'https://pay.sh/api/catalog',
    generated_at: T0,
    provider_count: 2,
    last_ingested_at: T0,
    used_fixture: false,
    error: null
  };
  return store;
}

function scoreEvent(id: string, providerId: string, kind: 'trust_assessment' | 'signal_assessment', score: number, observedAt: string): InfopunksEvent {
  return {
    id,
    type: 'score_assessment_created',
    source: 'infopunks:test',
    entityType: kind,
    entityId: providerId,
    provider_id: providerId,
    observedAt,
    observed_at: observedAt,
    confidence: 1,
    payload: { providerId, entityId: providerId, score, components: { metadataQuality: score - 5, pricingClarity: score - 3 } }
  };
}

function providerEvent(id: string, providerId: string, type: 'provider.reachable' | 'provider.degraded' | 'provider.failed' | 'provider.checked', observedAt: string, success = true): InfopunksEvent {
  return {
    id,
    type,
    source: 'infopunks:safe-metadata-monitor',
    entityType: 'provider',
    entityId: providerId,
    provider_id: providerId,
    observedAt,
    observed_at: observedAt,
    confidence: 1,
    payload: { providerId, success, response_time_ms: success ? 120 : 800 }
  };
}

function endpointEvent(id: string, providerId: string, endpointId: string, type: 'endpoint.recovered' | 'endpoint.degraded' | 'endpoint.failed' | 'endpoint.checked' | 'endpoint.updated', observedAt: string, success = true): InfopunksEvent {
  return {
    id,
    type,
    source: 'infopunks:test',
    entityType: 'endpoint',
    entityId: endpointId,
    provider_id: providerId,
    endpoint_id: endpointId,
    observedAt,
    observed_at: observedAt,
    confidence: 1,
    payload: { providerId, endpointId, method: 'GET', path: endpointId.includes('alpha') ? '/alpha' : '/beta', pricing: { min: 0.001, max: 0.001, raw: '$0.001' }, success, response_time_ms: success ? 150 : 900 }
  };
}

describe('radar predictive risk', () => {
  it('returns unknown risk when history is insufficient', () => {
    const store = baseStore();
    const risk = buildProviderRiskAssessment(store, 'alpha');
    expect(risk?.predictive_risk_level).toBe('unknown');
    expect(risk?.recommended_action).toBe('insufficient history');
    expect(risk?.warnings).toContain('insufficient_history');
  });

  it('returns critical risk when current state is critical', () => {
    const store = baseStore();
    store.events.push(providerEvent('alpha-failed', 'alpha', 'provider.failed', T2, false));
    const risk = buildProviderRiskAssessment(store, 'alpha');
    expect(risk?.predictive_risk_level).toBe('critical');
    expect(risk?.recommended_action).toBe('not recommended for routing');
    expect(risk?.anomalies.some((item) => item.anomaly_type === 'critical_current_state')).toBe(true);
  });

  it('detects sudden trust drop anomaly', () => {
    const store = baseStore();
    store.events.push(
      scoreEvent('trust-a-1', 'alpha', 'trust_assessment', 91, T0),
      scoreEvent('trust-a-2', 'alpha', 'trust_assessment', 68, T2),
      providerEvent('alpha-ok', 'alpha', 'provider.reachable', T2)
    );
    const risk = buildProviderRiskAssessment(store, 'alpha');
    expect(risk?.anomalies.some((item) => item.anomaly_type === 'sudden_trust_drop')).toBe(true);
  });

  it('detects repeated degradation anomaly', () => {
    const store = baseStore();
    store.events.push(
      providerEvent('alpha-deg-1', 'alpha', 'provider.degraded', T1, false),
      providerEvent('alpha-deg-2', 'alpha', 'provider.degraded', T2, false),
      providerEvent('alpha-deg-3', 'alpha', 'provider.failed', T3, false)
    );
    const risk = buildProviderRiskAssessment(store, 'alpha');
    expect(risk?.anomalies.some((item) => item.anomaly_type === 'repeated_degradation')).toBe(true);
  });

  it('detects endpoint route eligibility flip anomaly', () => {
    const store = baseStore();
    store.events.push(
      endpointEvent('ep-ok', 'alpha', 'alpha-endpoint-1', 'endpoint.recovered', T1, true),
      endpointEvent('ep-bad', 'alpha', 'alpha-endpoint-1', 'endpoint.degraded', T2, false)
    );
    const risk = buildEndpointRiskAssessment(store, 'alpha-endpoint-1');
    expect(risk?.anomalies.some((item) => item.anomaly_type === 'route_eligibility_flip')).toBe(true);
  });

  it('detects stale catalog source anomaly', () => {
    const store = baseStore();
    store.dataSource = {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      generated_at: '2026-04-20T00:00:00.000Z',
      provider_count: 2,
      last_ingested_at: '2026-04-20T00:00:00.000Z',
      used_fixture: false,
      error: null
    };
    store.events.push(
      scoreEvent('trust-a-1', 'alpha', 'trust_assessment', 90, T0),
      scoreEvent('trust-a-2', 'alpha', 'trust_assessment', 89, T3),
      providerEvent('alpha-late', 'alpha', 'provider.reachable', T3)
    );
    const risk = buildProviderRiskAssessment(store, 'alpha');
    expect(risk?.anomalies.some((item) => item.anomaly_type === 'stale_catalog_source')).toBe(true);
  });

  it('exposes risk API routes and ecosystem summary shape', async () => {
    const store = baseStore();
    store.events.push(
      scoreEvent('trust-a-1', 'alpha', 'trust_assessment', 91, T0),
      scoreEvent('trust-a-2', 'alpha', 'trust_assessment', 65, T2),
      providerEvent('alpha-deg', 'alpha', 'provider.degraded', T2, false),
      providerEvent('beta-ok', 'beta', 'provider.reachable', T2, true),
      endpointEvent('beta-endpoint-ok', 'beta', 'beta-endpoint-1', 'endpoint.recovered', T2, true)
    );
    const app = await createApp(store);

    const providerRisk = await app.inject({ method: 'GET', url: '/v1/radar/risk/providers/alpha' });
    const endpointRisk = await app.inject({ method: 'GET', url: '/v1/radar/risk/endpoints/alpha-endpoint-1' });
    const ecosystemRisk = await app.inject({ method: 'GET', url: '/v1/radar/risk/ecosystem' });

    expect(providerRisk.statusCode).toBe(200);
    expect(providerRisk.json().data).toMatchObject({
      subject_type: 'provider',
      subject_id: 'alpha',
      risk_score: expect.any(Number),
      risk_level: expect.any(String),
      anomalies: expect.any(Array),
      recommended_action: expect.any(String)
    });
    expect(endpointRisk.statusCode).toBe(200);
    expect(endpointRisk.json().data.subject_type).toBe('endpoint');
    expect(ecosystemRisk.statusCode).toBe(200);
    expect(ecosystemRisk.json().data.summary).toMatchObject({
      providers_by_risk_level: expect.any(Object),
      top_anomalies: expect.any(Array),
      categories_most_affected: expect.any(Array),
      recent_critical_events: expect.any(Array),
      anomaly_watch: expect.any(Array)
    });

    await app.close();
  });

  it('includes predictive risk context in radar preflight and compare responses', async () => {
    const store = baseStore();
    store.events.push(
      scoreEvent('trust-a-1', 'alpha', 'trust_assessment', 91, T0),
      scoreEvent('trust-a-2', 'alpha', 'trust_assessment', 88, T1),
      providerEvent('alpha-ok', 'alpha', 'provider.reachable', T1, true),
      providerEvent('beta-ok', 'beta', 'provider.reachable', T1, true),
      endpointEvent('alpha-endpoint-ok', 'alpha', 'alpha-endpoint-1', 'endpoint.recovered', T1, true),
      endpointEvent('beta-endpoint-ok', 'beta', 'beta-endpoint-1', 'endpoint.recovered', T1, true)
    );

    const app = await createApp(store);
    const preflight = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: { intent: 'get SOL price', category: 'finance', constraints: { min_trust: 70 } } });
    expect(preflight.statusCode).toBe(200);
    expect(preflight.json().data.accepted_candidates[0]).toHaveProperty('predictive_risk');

    const compare = await app.inject({ method: 'POST', url: '/v1/radar/compare', payload: { mode: 'provider', ids: ['alpha', 'beta'] } });
    expect(compare.statusCode).toBe(200);
    expect(compare.json().data.rows[0]).toMatchObject({
      predictive_risk_level: expect.any(String),
      recommended_action: expect.any(String)
    });

    await app.close();
  });

  it('rejects critical predictive risk route unless allow_risky_routes is true', async () => {
    const store = baseStore();
    store.events.push(
      scoreEvent('trust-a-1', 'alpha', 'trust_assessment', 91, T0),
      scoreEvent('trust-a-2', 'alpha', 'trust_assessment', 87, T1),
      providerEvent('alpha-failed', 'alpha', 'provider.failed', T2, false),
      providerEvent('beta-ok', 'beta', 'provider.reachable', T2, true),
      endpointEvent('alpha-endpoint-bad', 'alpha', 'alpha-endpoint-1', 'endpoint.failed', T2, false)
    );

    const app = await createApp(store);
    const rejected = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: { intent: 'route finance query', category: 'finance', constraints: { min_trust: 70 } } });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.rejected_candidates.some((item: any) => item.rejection_reasons.includes('critical_predictive_risk_not_recommended_for_routing'))).toBe(true);

    const allowed = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: { intent: 'route finance query', category: 'finance', constraints: { min_trust: 70, allow_risky_routes: true } } });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().data.warnings).toContain('critical_predictive_risk_allowed_by_override');

    await app.close();
  });

  it('does not automatically reject unknown predictive risk', async () => {
    const store = baseStore();
    store.events.push(providerEvent('alpha-ok', 'alpha', 'provider.reachable', T1, true));
    const app = await createApp(store);

    const response = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: { intent: 'route finance query', category: 'finance', constraints: { min_trust: 70 } } });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.warnings).toContain('unknown_predictive_risk_insufficient_history');
    expect(body.accepted_candidates.length).toBeGreaterThan(0);

    await app.close();
  });

  it('builds ecosystem summary counts from provider risks', () => {
    const store = baseStore();
    store.events.push(
      scoreEvent('trust-a-1', 'alpha', 'trust_assessment', 90, T0),
      scoreEvent('trust-a-2', 'alpha', 'trust_assessment', 60, T2),
      providerEvent('alpha-degraded', 'alpha', 'provider.degraded', T2, false),
      providerEvent('beta-ok', 'beta', 'provider.reachable', T2, true)
    );

    const summary = buildEcosystemRiskSummary(store);
    expect(summary.summary.providers_by_risk_level.critical + summary.summary.providers_by_risk_level.elevated + summary.summary.providers_by_risk_level.watch + summary.summary.providers_by_risk_level.low + summary.summary.providers_by_risk_level.unknown).toBe(2);
    expect(summary.summary.top_anomalies).toEqual(expect.any(Array));
  });
});
