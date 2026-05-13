import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { emptyIntelligenceStore, recomputeAssessments } from '../src/services/intelligenceStore';
import {
  normalizeEndpointRecord,
  normalizePricing,
  normalizeSchema,
  safeJsonExport
} from '../src/services/radarExportService';

const completeCatalog: PayShCatalogItem[] = [{
  name: 'Alpha API',
  namespace: 'pay/alpha',
  slug: 'alpha',
  category: 'Data',
  endpoints: 1,
  price: '$0.01',
  status: 'metered',
  description: 'Alpha provider for export tests.',
  tags: ['alpha'],
  service_url: 'https://alpha.test',
  endpointDetails: [{
    name: 'Lookup',
    path: '/lookup',
    method: 'GET',
    category: 'Data',
    description: 'Lookup endpoint.',
    price: '$0.01',
    status: 'available',
    schema: { input: { type: 'object' }, output: { type: 'object' } }
  }]
}];

function storeFromCatalog(catalog: PayShCatalogItem[]) {
  const ingested = applyPayShCatalogIngestion(emptyIntelligenceStore(), catalog, {
    observedAt: '2026-01-01T00:00:00.000Z',
    source: 'pay.sh:test'
  });
  return recomputeAssessments(ingested.snapshot);
}

describe('radar exports', () => {
  it('normalizes endpoint with complete data', () => {
    const store = storeFromCatalog(completeCatalog);
    const endpoint = store.endpoints[0];
    const provider = store.providers[0];
    const trust = store.trustAssessments.find((item) => item.entityId === provider.id) ?? null;
    const signal = store.signalAssessments.find((item) => item.entityId === provider.id) ?? null;

    const normalized = normalizeEndpointRecord(endpoint, provider, trust, signal, store);
    expect(normalized).toMatchObject({
      endpoint_id: endpoint.id,
      provider_id: 'alpha',
      provider_name: 'Alpha API',
      method: 'GET',
      path: '/lookup',
      url: 'https://alpha.test/lookup',
      route_eligibility: expect.any(Boolean)
    });
  });

  it('normalizes endpoint with missing data using null-safe fallbacks', () => {
    const store = emptyIntelligenceStore();
    const normalized = normalizeEndpointRecord({
      id: 'ep-1',
      providerId: 'missing',
      name: 'Unknown endpoint',
      path: null,
      method: null,
      category: 'Other',
      description: null,
      pricing: {} as any,
      status: 'unknown',
      schema: null,
      latencyMsP50: null,
      firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
      evidence: []
    } as any, null, null, null, store);

    expect(normalized.url).toBeNull();
    expect(normalized.provider_name).toBeNull();
    expect(normalized.method).toBeNull();
    expect(normalized.path).toBeNull();
    expect(normalized.route_eligibility).toBe(false);
    expect(normalized.route_rejection_reasons).toContain('endpoint_method_unknown');
  });

  it('handles malformed pricing payload safely', () => {
    const pricing = normalizePricing({ min: 'NaN', max: Infinity, raw: 55 });
    expect(pricing).toEqual({
      min: null,
      max: null,
      currency: null,
      unit: null,
      clarity: null,
      raw: null,
      source: null
    });
  });

  it('handles malformed schema payload safely', () => {
    const schema = normalizeSchema({ self: undefined, child: { value: 1, deeper: new Error('boom') } });
    expect(schema).toMatchObject({ self: null, child: { value: 1, deeper: { name: 'Error', message: 'boom' } } });
  });

  it('marks degraded providers as route-ineligible', () => {
    const store = storeFromCatalog(completeCatalog);
    store.events.push({
      id: 'evt-1',
      type: 'provider.failed',
      source: 'safe_metadata',
      entityType: 'provider',
      entityId: 'alpha',
      provider_id: 'alpha',
      endpoint_id: null,
      observedAt: '2026-01-02T00:00:00.000Z',
      observed_at: '2026-01-02T00:00:00.000Z',
      catalog_generated_at: null,
      ingested_at: '2026-01-02T00:00:00.000Z',
      payload: { providerId: 'alpha', monitor_mode: 'safe_metadata' }
    } as any);

    const endpoint = store.endpoints[0];
    const provider = store.providers[0];
    const trust = store.trustAssessments.find((item) => item.entityId === provider.id) ?? null;
    const signal = store.signalAssessments.find((item) => item.entityId === provider.id) ?? null;
    const normalized = normalizeEndpointRecord(endpoint, provider, trust, signal, store);

    expect(normalized.route_eligibility).toBe(false);
    expect(normalized.route_rejection_reasons).toContain('provider_unreachable');
  });

  it('safe JSON export handles circulars, dates, errors, undefined values', () => {
    const circular: any = { at: new Date('2026-01-01T00:00:00.000Z'), err: new Error('boom'), missing: undefined };
    circular.self = circular;
    const exported = safeJsonExport(circular) as any;

    expect(exported.at).toBe('2026-01-01T00:00:00.000Z');
    expect(exported.err.message).toBe('boom');
    expect(exported.missing).toBeNull();
    expect(exported.self).toBe('[Circular]');
  });

  it('serves radar export route shapes', async () => {
    const app = await createApp(storeFromCatalog(completeCatalog));

    const scored = await app.inject({ method: 'GET', url: '/v1/radar/scored-catalog' });
    const providers = await app.inject({ method: 'GET', url: '/v1/radar/providers' });
    const endpoints = await app.inject({ method: 'GET', url: '/v1/radar/endpoints' });
    const routes = await app.inject({ method: 'GET', url: '/v1/radar/routes/candidates' });

    expect(scored.statusCode).toBe(200);
    expect(scored.headers['content-type']).toContain('application/json');
    expect(scored.json().data).toMatchObject({ generated_at: expect.any(String), source: expect.any(Object), counts: expect.any(Object), providers: expect.any(Array), endpoints: expect.any(Array) });

    expect(providers.statusCode).toBe(200);
    expect(providers.json().data).toMatchObject({ generated_at: expect.any(String), source: expect.any(Object), count: expect.any(Number), providers: expect.any(Array) });

    expect(endpoints.statusCode).toBe(200);
    expect(endpoints.json().data).toMatchObject({ generated_at: expect.any(String), source: expect.any(Object), count: expect.any(Number), endpoints: expect.any(Array) });

    expect(routes.statusCode).toBe(200);
    expect(routes.json().data).toMatchObject({ generated_at: expect.any(String), source: expect.any(Object), count: expect.any(Number), total_endpoints: expect.any(Number), grouped_by_category: expect.any(Object), grouped_by_provider: expect.any(Object) });

    await app.close();
  });

  it('serves providers and endpoints CSV exports with csv content type', async () => {
    const app = await createApp(storeFromCatalog(completeCatalog));
    const providersCsv = await app.inject({ method: 'GET', url: '/v1/radar/export/providers.csv' });
    const endpointsCsv = await app.inject({ method: 'GET', url: '/v1/radar/export/endpoints.csv' });
    expect(providersCsv.statusCode).toBe(200);
    expect(providersCsv.headers['content-type']).toContain('text/csv');
    expect(providersCsv.body).toContain('provider_id');
    expect(endpointsCsv.statusCode).toBe(200);
    expect(endpointsCsv.headers['content-type']).toContain('text/csv');
    expect(endpointsCsv.body).toContain('endpoint_id');
    await app.close();
  });

  it('escapes commas quotes and newlines in CSV rows', async () => {
    const store = storeFromCatalog(completeCatalog);
    store.providers[0].name = 'Alpha, "API"\nLine';
    const app = await createApp(store);
    const response = await app.inject({ method: 'GET', url: '/v1/radar/export/providers.csv' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"Alpha, ""API""\nLine"');
    await app.close();
  });

  it('includes route candidates and degradations CSV exports', async () => {
    const store = storeFromCatalog(completeCatalog);
    store.events.push({
      id: 'evt-degraded',
      type: 'provider.degraded',
      source: 'safe_metadata',
      entityType: 'provider',
      entityId: 'alpha',
      provider_id: 'alpha',
      endpoint_id: null,
      observedAt: '2026-01-02T00:00:00.000Z',
      observed_at: '2026-01-02T00:00:00.000Z',
      catalog_generated_at: null,
      ingested_at: '2026-01-02T00:00:00.000Z',
      payload: { providerId: 'alpha', summary: null }
    } as any);
    const app = await createApp(store);
    const routes = await app.inject({ method: 'GET', url: '/v1/radar/export/route-candidates.csv' });
    const degradations = await app.inject({ method: 'GET', url: '/v1/radar/export/degradations.csv' });
    expect(routes.statusCode).toBe(200);
    expect(routes.body).toContain('route_value_score');
    expect(degradations.statusCode).toBe(200);
    expect(degradations.body).toContain('evt-degraded');
    await app.close();
  });
});
