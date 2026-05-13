import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion, loadPayShCatalog } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { dataSourceState } from '../src/services/pulseService';
import { recomputeAssessments } from '../src/services/intelligenceStore';

const EMPTY_SNAPSHOT: IntelligenceSnapshot = {
  events: [],
  providers: [],
  endpoints: [],
  trustAssessments: [],
  signalAssessments: [],
  narratives: [],
  ingestionRuns: [],
  monitorRuns: []
};

function makeLiveCatalog(count = 72): PayShCatalogItem[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const category = n % 2 === 0 ? 'messaging' : 'data';
    return {
      name: `Provider ${n}`,
      title: `Provider ${n}`,
      namespace: `vendor-${n}/api`,
      slug: `vendor-${n}-api`,
      fqn: `vendor-${n}/api`,
      category,
      endpoints: (n % 4) + 1,
      endpoint_count: (n % 4) + 1,
      price: '$0 - $1',
      status: n % 3 === 0 ? 'free tier' : 'metered',
      description: `Synthetic live provider ${n}`,
      tags: [category],
      endpointMetadataPartial: true,
      has_metering: true,
      has_free_tier: true,
      min_price_usd: 0,
      max_price_usd: 1,
      sha: `sha-${n}`,
      catalog_generated_at: '2026-05-08T00:00:00.000Z',
      manifest: {
        fqn: `vendor-${n}/api`,
        title: `Provider ${n}`,
        category,
        endpoint_count: (n % 4) + 1
      }
    };
  });
}

function makeLiveStore(count = 72): IntelligenceSnapshot {
  const observedAt = '2026-05-08T00:00:00.000Z';
  const generatedAt = '2026-05-08T00:00:00.000Z';
  const ingested = applyPayShCatalogIngestion(EMPTY_SNAPSHOT, makeLiveCatalog(count), {
    observedAt,
    source: 'pay.sh:live-catalog:https://pay.sh/api/catalog',
    dataSource: {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      generated_at: generatedAt,
      provider_count: count,
      last_ingested_at: observedAt,
      used_fixture: false,
      error: null
    }
  });
  return recomputeAssessments(ingested.snapshot);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pulse and radar live catalog state wiring', () => {
  it('keeps providers and pulse in the same live catalog state for 72-style provider input', async () => {
    const store = makeLiveStore(72);
    const expectedEndpointCount = store.providers.reduce((sum, provider) => sum + provider.endpointCount, 0);
    const app = await createApp(store);

    const providers = await app.inject({ method: 'GET', url: '/v1/providers' });
    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse' });

    expect(providers.statusCode).toBe(200);
    expect(providers.json().data).toHaveLength(72);

    expect(pulse.statusCode).toBe(200);
    expect(pulse.json().data.providerCount).toBe(72);
    expect(pulse.json().data.endpointCount).toBe(expectedEndpointCount);
    expect(pulse.json().data.bootstrapped).toBe(true);
    expect(pulse.json().data.catalog_status).toMatch(/^(live|ready)$/);
    expect(pulse.json().data.catalog_error).toBeNull();
    expect(pulse.json().data.data_source).toMatchObject({
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      provider_count: 72,
      used_fixture: false,
      error: null
    });
    expect(pulse.json().data.endpoint_metadata).toMatchObject({
      available: false,
      mode: 'provider_level_counts_only',
      reason: 'live_pay_sh_catalog_does_not_include_endpoint_detail'
    });

    await app.close();
  });

  it('returns provider-level endpoint metadata when live catalog has counts but no endpoint rows', async () => {
    const app = await createApp(makeLiveStore(72));
    const response = await app.inject({ method: 'GET', url: '/v1/radar/endpoints' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.endpoint_metadata).toMatchObject({
      available: false,
      mode: 'provider_level_counts_only',
      reason: 'live_pay_sh_catalog_does_not_include_endpoint_detail'
    });
    expect(response.json().data.endpoints).toEqual([]);

    await app.close();
  });

  it('prevents providers-live and pulse-fallback split-brain when persisted dataSource is stale fixture state', async () => {
    const store = makeLiveStore(72);
    store.dataSource = {
      mode: 'fixture_fallback',
      url: null,
      generated_at: null,
      provider_count: 0,
      last_ingested_at: null,
      used_fixture: true,
      error: null
    };
    const app = await createApp(store);

    const providers = await app.inject({ method: 'GET', url: '/v1/providers' });
    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse' });

    expect(providers.json().data).toHaveLength(72);
    expect(pulse.json().data.data_source).toMatchObject({
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      provider_count: 72,
      used_fixture: false,
      error: null
    });
    expect(pulse.json().data.catalog_status).toMatch(/^(live|ready)$/);

    await app.close();
  });

  it('ensures fixture fallback always carries non-null error diagnostics', async () => {
    const emptyState = dataSourceState({ ...EMPTY_SNAPSHOT });
    expect(emptyState.used_fixture).toBe(true);
    expect(emptyState.error).toBeTruthy();

    const app = await createApp({ ...EMPTY_SNAPSHOT });
    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse' });
    expect(pulse.json().data.data_source.used_fixture).toBe(true);
    expect(pulse.json().data.data_source.error).toBeTruthy();
    await app.close();
  });

  it('returns explicit fixture fallback error codes for live catalog failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    }) as unknown as Response));
    const fetchFailed = await loadPayShCatalog('https://pay.sh/api/catalog', { catalogSource: 'live', allowFixtureFallback: true });
    expect(fetchFailed.usedFixture).toBe(true);
    expect(fetchFailed.dataSource.error).toBe('live_catalog_fetch_failed');

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ version: 2, providers: [] })
    }) as unknown as Response));
    const emptyProviders = await loadPayShCatalog('https://pay.sh/api/catalog', { catalogSource: 'live', allowFixtureFallback: true });
    expect(emptyProviders.usedFixture).toBe(true);
    expect(emptyProviders.dataSource.error).toBe('live_catalog_empty_provider_array');

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ([{ bad: true }])
    }) as unknown as Response));
    const parseFailed = await loadPayShCatalog('https://pay.sh/api/catalog', { catalogSource: 'live', allowFixtureFallback: true });
    expect(parseFailed.usedFixture).toBe(true);
    expect(parseFailed.dataSource.error).toBe('live_catalog_parse_failed');
  });
});
