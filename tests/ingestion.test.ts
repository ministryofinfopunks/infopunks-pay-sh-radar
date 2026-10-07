import { runPreflight } from '../src/services/preflightService';
import { createIntelligenceStore, emptyIntelligenceStore, runPayShIngestionWithOptions } from '../src/services/intelligenceStore';
import { MemoryRepository } from '../src/persistence/repository';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPayShCatalogIngestion, ingestPayShCatalog, loadPayShCatalog, normalizePayShCatalog, parseCatalogPrice } from '../src/ingestion/payShCatalogAdapter';
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
    expect(result.dataSource.mode).toBe('fixture_fallback');
    expect(result.dataSource.error).toBeTruthy();
    expect(result.items.length).toBeGreaterThan(5);
  });

  it('parses live Pay.sh catalog providers without fabricating endpoint URLs', () => {
    const normalized = normalizePayShCatalog({
      version: 2,
      generated_at: '2026-05-07T01:23:54Z',
      base_url: 'https://storage.googleapis.com/pay-skills/v1',
      provider_count: 1,
      affiliate_count: 0,
      aggregator_count: 0,
      providers: [{
        fqn: 'agentmail/email',
        title: 'AgentMail',
        description: 'Create and operate dedicated email inboxes for AI agents.',
        use_case: 'Use for agent email workflows.',
        category: 'messaging',
        service_url: 'https://x402.api.agentmail.to',
        endpoint_count: 83,
        has_metering: true,
        has_free_tier: true,
        min_price_usd: 0,
        max_price_usd: 10,
        sha: 'c39acd601c54f2ae'
      }]
    });
    const ingested = applyPayShCatalogIngestion(emptySnapshot, normalized.items, {
      observedAt: '2026-05-07T02:00:00.000Z',
      source: 'pay.sh:live-catalog:https://pay.sh/api/catalog',
      dataSource: {
        mode: 'live_pay_sh_catalog',
        url: 'https://pay.sh/api/catalog',
        generated_at: normalized.generatedAt,
        provider_count: normalized.providerCount,
        last_ingested_at: null,
        used_fixture: false,
        error: null
      }
    });

    expect(normalized.providerCount).toBe(1);
    expect(ingested.snapshot.providers[0]).toMatchObject({
      id: 'agentmail-email',
      fqn: 'agentmail/email',
      name: 'AgentMail',
      endpointCount: 83,
      endpointMetadataPartial: true,
      hasMetering: true,
      hasFreeTier: true,
      sourceSha: 'c39acd601c54f2ae',
      catalogGeneratedAt: '2026-05-07T01:23:54Z'
    });
    expect(ingested.snapshot.providers[0].pricing).toMatchObject({ min: 0, max: 10 });
    expect(ingested.snapshot.endpoints).toHaveLength(0);
    expect(ingested.snapshot.dataSource?.mode).toBe('live_pay_sh_catalog');
    expect(ingested.events.map((event) => event.type)).toContain('catalog.ingested');
    expect(ingested.events.map((event) => event.type)).toContain('provider.discovered');
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

  it('emits provider, price, category, and endpoint count diff events for live providers', () => {
    const firstCatalog: PayShCatalogItem[] = [{
      name: 'AgentMail',
      title: 'AgentMail',
      namespace: 'agentmail/email',
      slug: 'agentmail-email',
      fqn: 'agentmail/email',
      category: 'messaging',
      endpoints: 83,
      price: '$0 - $10',
      status: 'free tier',
      description: 'Dedicated email inboxes for AI agents.',
      tags: ['messaging'],
      endpointMetadataPartial: true,
      has_metering: true,
      has_free_tier: true,
      min_price_usd: 0,
      max_price_usd: 10,
      sha: 'sha-a',
      catalog_generated_at: '2026-05-07T01:23:54Z'
    }];
    const secondCatalog: PayShCatalogItem[] = [{
      ...firstCatalog[0],
      category: 'communications',
      endpoints: 84,
      price: '$0 - $12',
      max_price_usd: 12,
      sha: 'sha-b'
    }];
    const first = applyPayShCatalogIngestion(emptySnapshot, firstCatalog, { observedAt: '2026-05-07T02:00:00.000Z', source: 'pay.sh:live-catalog:https://pay.sh/api/catalog' });
    const second = applyPayShCatalogIngestion(first.snapshot, secondCatalog, { observedAt: '2026-05-07T03:00:00.000Z', source: 'pay.sh:live-catalog:https://pay.sh/api/catalog' });
    const types = second.events.map((event) => event.type);

    expect(types).toContain('provider.updated');
    expect(types).toContain('metadata.changed');
    expect(types).toContain('price.changed');
    expect(types).toContain('category.changed');
    expect(types).toContain('endpoint_count.changed');
  });
});


describe('production catalog isolation', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  function production() {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYSH_CATALOG_SOURCE', 'live');
    vi.stubEnv('PAY_SH_CATALOG_URL', 'https://pay.sh/api/catalog');
    vi.stubEnv('PAYSH_ALLOW_FIXTURE_FALLBACK', 'false');
  }
  it.each(['offline', 'invalid', 'empty', 'stale'])('never substitutes fixtures for %s live evidence', async (failure) => {
    production();
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (failure === 'offline') throw new Error('offline');
      return new Response(JSON.stringify(failure === 'invalid' ? { providers: [{}] }
        : failure === 'empty' ? { providers: [] }
        : { generated_at: '2020-01-01T00:00:00Z', providers: [{ fqn: 'live/api', title: 'Live', category: 'Data' }] }), { status: 200 });
    }));
    const loaded = await loadPayShCatalog();
    expect(loaded.items).toEqual([]);
    expect(loaded.usedFixture).toBe(false);
    expect(loaded.liveFetchFailed).toBe(true);
    const repository = new MemoryRepository();
    const store = await createIntelligenceStore(repository);
    expect(store.providers).toEqual([]);
    expect(store.dataSource).toMatchObject({ used_fixture: false, mode: 'live_pay_sh_catalog' });
    await runPayShIngestionWithOptions(store, repository);
    expect(store.providers).toEqual([]);
    expect(store.events.some((event) => event.source.includes('fixture'))).toBe(false);
    expect(runPreflight({ intent: 'market data', category: 'Data', constraints: {} }, store).decision).toBe('route_blocked');
  });
  it('uses live data when it succeeds', async () => {
    production();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ generated_at: new Date().toISOString(), providers: [{ fqn: 'live/api', title: 'Live', category: 'Data' }] }))));
    const store = await createIntelligenceStore(new MemoryRepository());
    expect(store.providers.map((provider) => provider.id)).toEqual(['live-api']);
    expect(store.dataSource?.used_fixture).toBe(false);
  });
  it('rejects explicit fixture overrides and direct fixture ingestion in production', async () => {
    production();
    await expect(loadPayShCatalog(undefined, { catalogSource: 'fixture' })).rejects.toMatchObject({ code: 'INVALID_RUNTIME_CONFIGURATION' });
    await expect(loadPayShCatalog(undefined, { allowFixtureFallback: true })).rejects.toMatchObject({ code: 'INVALID_RUNTIME_CONFIGURATION' });
    expect(() => ingestPayShCatalog()).toThrow('production_fixture_catalog_forbidden');
  });
  it('does not reuse a persisted fixture snapshot in production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const repository = new MemoryRepository();
    await createIntelligenceStore(repository);
    production();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const store = await createIntelligenceStore(repository);
    expect(store.providers).toEqual([]);
    expect(store.dataSource?.used_fixture).toBe(false);
  });
  it('keeps explicit test fixtures available', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const result = await loadPayShCatalog(undefined, { catalogSource: 'fixture' });
    expect(result.usedFixture).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });
});
