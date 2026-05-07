import { describe, expect, it } from 'vitest';
import { applyPayShCatalogIngestion, ingestPayShCatalog, loadPayShCatalog, parseCatalogPrice } from '../src/ingestion/payShCatalogAdapter';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { IntelligenceSnapshot } from '../src/persistence/repository';

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

const baseCatalog: PayShCatalogItem[] = [{
  name: 'Alpha API',
  namespace: 'pay/alpha',
  slug: 'alpha',
  category: 'Data',
  endpoints: 1,
  price: '$0.01',
  status: 'metered',
  description: 'Alpha provider for deterministic ingestion tests.',
  tags: ['alpha'],
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

describe('Pay.sh catalog ingestion', () => {
  it('creates canonical events plus providers and endpoints', () => {
    const { events, providers, endpoints } = ingestPayShCatalog();
    expect(events.length).toBeGreaterThan(providers.length);
    expect(providers.length).toBeGreaterThan(5);
    expect(endpoints.length).toBeGreaterThan(providers.length);
    expect(providers[0]).toMatchObject({ source: 'pay.sh', category: 'Data' });
    expect(providers[0].evidence.length).toBeGreaterThan(0);
  });

  it('parses free, fixed, and range pricing models', () => {
    expect(parseCatalogPrice('free').clarity).toBe('free');
    expect(parseCatalogPrice('$0.01').max).toBe(0.01);
    expect(parseCatalogPrice('$0.002 - $0.44')).toMatchObject({ min: 0.002, max: 0.44, clarity: 'range' });
  });

  it('falls back to the fixture when live catalog loading is unavailable', async () => {
    const result = await loadPayShCatalog('http://127.0.0.1:1/catalog');
    expect(result.usedFixture).toBe(true);
    expect(result.items.length).toBeGreaterThan(5);
  });

  it('uses idempotent event upserts for repeated catalog runs', () => {
    const first = applyPayShCatalogIngestion(emptySnapshot, baseCatalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' });
    const second = applyPayShCatalogIngestion(first.snapshot, baseCatalog, { observedAt: '2026-01-02T00:00:00.000Z', source: 'pay.sh:test' });

    expect(first.events.length).toBeGreaterThan(0);
    expect(second.events).toHaveLength(0);
    expect(second.run.discoveredCount).toBe(0);
    expect(second.run.changedCount).toBe(0);
    expect(second.snapshot.events).toHaveLength(first.snapshot.events.length);
  });

  it('emits durable discovery events for providers, endpoints, manifests, prices, and schemas', () => {
    const result = applyPayShCatalogIngestion(emptySnapshot, baseCatalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' });
    const types = result.events.map((event) => event.type);

    expect(types).toContain('pay_sh_catalog_provider_seen');
    expect(types).toContain('pay_sh_catalog_endpoint_seen');
    expect(types).toContain('pay_sh_catalog_manifest_seen');
    expect(types).toContain('pricing_observed');
    expect(types).toContain('pay_sh_catalog_schema_seen');
    expect(result.run.discoveredCount).toBe(2);
  });

  it('detects metadata, endpoint, price, and schema changes', () => {
    const first = applyPayShCatalogIngestion(emptySnapshot, baseCatalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' });
    const changedCatalog: PayShCatalogItem[] = [{
      ...baseCatalog[0],
      description: 'Alpha provider with changed metadata.',
      price: '$0.02',
      endpointDetails: [{
        ...baseCatalog[0].endpointDetails![0],
        path: '/lookup-v2',
        price: '$0.02',
        schema: { response: { type: 'object', properties: { ok: { type: 'boolean' }, version: { type: 'string' } } } }
      }]
    }];
    const changed = applyPayShCatalogIngestion(first.snapshot, changedCatalog, { observedAt: '2026-01-02T00:00:00.000Z', source: 'pay.sh:test' });
    const types = changed.events.map((event) => event.type);

    expect(types).toContain('manifest.updated');
    expect(types).toContain('endpoint.updated');
    expect(types.filter((type) => type === 'price.changed')).toHaveLength(2);
    expect(types).toContain('schema.changed');
    expect(changed.run.changedCount).toBeGreaterThanOrEqual(5);
  });
});
