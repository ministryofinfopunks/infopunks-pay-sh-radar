import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { recomputeAssessments } from '../src/services/intelligenceStore';

function storeWithProviders() {
  const empty: IntelligenceSnapshot = { events: [], providers: [], endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [] };
  const catalog: PayShCatalogItem[] = [
    { name: 'Alpha Finance', namespace: 'finance/alpha', slug: 'alpha', category: 'finance', endpoints: 2, price: '$0.001', status: 'metered', description: 'finance data', tags: ['finance', 'price'] },
    { name: 'Beta Finance', namespace: 'finance/beta', slug: 'beta', category: 'finance', endpoints: 1, price: '$0.02', status: 'metered', description: 'finance data', tags: ['finance'] }
  ];
  const ingested = applyPayShCatalogIngestion(empty, catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.endpoints = store.endpoints.map((endpoint, index) => ({
    ...endpoint,
    method: 'GET',
    path: index === 0 ? '/price/sol' : '/price/token',
    status: 'available',
    pricing: {
      ...endpoint.pricing,
      min: index === 0 ? 0.001 : 0.02,
      max: index === 0 ? 0.001 : 0.02,
      raw: index === 0 ? '$0.001' : '$0.02'
    }
  }));
  store.trustAssessments = store.trustAssessments.map((item) => item.entityId === 'alpha' ? { ...item, score: 92 } : { ...item, score: 60 });
  store.signalAssessments = store.signalAssessments.map((item) => item.entityId === 'alpha' ? { ...item, score: 88 } : { ...item, score: 65 });
  store.events.push(
    { id: 'alpha-reachable', type: 'provider.reachable', source: 'monitor', entityType: 'provider', entityId: 'alpha', provider_id: 'alpha', observedAt: '2026-01-02T00:00:00.000Z', payload: { providerId: 'alpha' } },
    { id: 'beta-failed', type: 'provider.failed', source: 'monitor', entityType: 'provider', entityId: 'beta', provider_id: 'beta', observedAt: '2026-01-02T00:00:00.000Z', payload: { providerId: 'beta' } }
  );
  return store;
}

describe('radar phase3 routes', () => {
  it('preflight accepts eligible route', async () => {
    const app = await createApp(storeWithProviders());
    const response = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: { intent: 'get SOL price', category: 'finance', constraints: { min_trust: 80, prefer_reachable: true, require_pricing: true, max_price_usd: 0.01 } } });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.accepted_candidates.length).toBeGreaterThan(0);
    expect(body.recommended_route).not.toBeNull();
    await app.close();
  });

  it('preflight rejects degraded route', async () => {
    const app = await createApp(storeWithProviders());
    const response = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: { intent: 'get SOL price', category: 'finance', constraints: { min_trust: 0, prefer_reachable: true } } });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.rejected_candidates.some((item: any) => item.rejection_reasons.join(',').includes('not_recommended_for_routing'))).toBe(true);
    await app.close();
  });

  it('preflight handles missing category', async () => {
    const app = await createApp(storeWithProviders());
    const response = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: { intent: 'get SOL price', constraints: { min_trust: 80 } } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.warnings).toContain('missing_category');
    await app.close();
  });

  it('preflight handles malformed JSON', async () => {
    const app = await createApp(storeWithProviders());
    const response = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: '{bad-json', headers: { 'content-type': 'application/json' } });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns no superiority when only one executable mapping exists', async () => {
    const app = await createApp(storeWithProviders());
    const response = await app.inject({ method: 'POST', url: '/v1/radar/preflight', payload: { intent: 'get SOL price', category: 'finance', constraints: { min_trust: 80 } } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.superiority_evidence_available).toBe(false);
    await app.close();
  });

  it('comparison engine with two providers', async () => {
    const app = await createApp(storeWithProviders());
    const response = await app.inject({ method: 'POST', url: '/v1/radar/compare', payload: { mode: 'provider', ids: ['alpha', 'beta'] } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.rows).toHaveLength(2);
    await app.close();
  });

  it('comparison engine with missing endpoint data', async () => {
    const app = await createApp(storeWithProviders());
    const response = await app.inject({ method: 'POST', url: '/v1/radar/compare', payload: { mode: 'endpoint', ids: ['missing-1', 'missing-2'] } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.rows).toHaveLength(0);
    await app.close();
  });
});
