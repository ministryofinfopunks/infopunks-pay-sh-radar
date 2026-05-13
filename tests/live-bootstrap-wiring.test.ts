import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import * as intelligenceStoreModule from '../src/services/intelligenceStore';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';

const observedAt = '2026-05-13T00:00:00.000Z';

function emptyStore(): IntelligenceSnapshot {
  return {
    events: [],
    providers: [],
    endpoints: [],
    trustAssessments: [],
    signalAssessments: [],
    narratives: [],
    ingestionRuns: [],
    monitorRuns: []
  };
}

function liveItems(count = 2): PayShCatalogItem[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Provider ${index + 1}`,
    title: `Provider ${index + 1}`,
    namespace: `provider-${index + 1}/api`,
    slug: `provider-${index + 1}-api`,
    fqn: `provider-${index + 1}/api`,
    category: 'data',
    endpoints: 1,
    endpoint_count: 1,
    price: '$0.01',
    status: 'metered',
    description: 'Live bootstrap provider',
    tags: ['data'],
    endpointMetadataPartial: true,
    has_metering: true,
    has_free_tier: false,
    min_price_usd: 0.01,
    max_price_usd: 0.01,
    sha: `sha-${index + 1}`,
    catalog_generated_at: observedAt
  }));
}

function hydrateLiveIntoStore(store: IntelligenceSnapshot, count = 2) {
  const ingested = applyPayShCatalogIngestion(store, liveItems(count), {
    observedAt,
    source: 'pay.sh:live-catalog:https://pay.sh/api/catalog',
    dataSource: {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      generated_at: observedAt,
      provider_count: count,
      last_ingested_at: observedAt,
      used_fixture: false,
      error: null
    }
  });
  store.events = ingested.snapshot.events;
  store.providers = ingested.snapshot.providers;
  store.endpoints = ingested.snapshot.endpoints;
  store.trustAssessments = ingested.snapshot.trustAssessments;
  store.signalAssessments = ingested.snapshot.signalAssessments;
  store.narratives = ingested.snapshot.narratives;
  store.ingestionRuns = ingested.snapshot.ingestionRuns;
  store.monitorRuns = ingested.snapshot.monitorRuns;
  store.dataSource = ingested.snapshot.dataSource;
  return {
    run: ingested.run,
    events: ingested.events,
    usedFixture: false,
    liveFetchFailed: false
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PAYSH_BOOTSTRAP_ENABLED;
});

beforeEach(() => {
  process.env.PAYSH_BOOTSTRAP_ENABLED = 'true';
});

describe('live bootstrap wiring', () => {
  it('bootstraps live catalog on app startup', async () => {
    vi.spyOn(intelligenceStoreModule, 'createIntelligenceStore').mockResolvedValue(emptyStore());
    const ingestionSpy = vi.spyOn(intelligenceStoreModule, 'runPayShIngestionWithOptions').mockImplementation(async (store) => hydrateLiveIntoStore(store));

    const app = await createApp();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const providers = await app.inject({ method: 'GET', url: '/v1/providers' });
    expect(providers.statusCode).toBe(200);
    expect(providers.json().data.length).toBeGreaterThan(0);
    expect(ingestionSpy).toHaveBeenCalled();

    await app.close();
  });

  it('lazily bootstraps on first /v1/providers when store is empty', async () => {
    const store = emptyStore();
    const ingestionSpy = vi.spyOn(intelligenceStoreModule, 'runPayShIngestionWithOptions').mockImplementation(async (targetStore) => hydrateLiveIntoStore(targetStore));
    const app = await createApp(store);

    const response = await app.inject({ method: 'GET', url: '/v1/providers' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.length).toBeGreaterThan(0);
    expect(ingestionSpy).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('lazily bootstraps on first /v1/pulse when store is empty', async () => {
    const store = emptyStore();
    const ingestionSpy = vi.spyOn(intelligenceStoreModule, 'runPayShIngestionWithOptions').mockImplementation(async (targetStore) => hydrateLiveIntoStore(targetStore));
    const app = await createApp(store);

    const response = await app.inject({ method: 'GET', url: '/v1/pulse' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.providerCount).toBeGreaterThan(0);
    expect(response.json().data.data_source.mode).toBe('live_pay_sh_catalog');
    expect(response.json().data.data_source.used_fixture).toBe(false);
    expect(ingestionSpy).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('lazily bootstraps on first /v1/radar/endpoints when store is empty', async () => {
    const store = emptyStore();
    const ingestionSpy = vi.spyOn(intelligenceStoreModule, 'runPayShIngestionWithOptions').mockImplementation(async (targetStore) => hydrateLiveIntoStore(targetStore));
    const app = await createApp(store);

    const response = await app.inject({ method: 'GET', url: '/v1/radar/endpoints' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.endpoint_metadata).toMatchObject({
      available: false,
      mode: 'provider_level_counts_only',
      reason: 'live_pay_sh_catalog_does_not_include_endpoint_detail'
    });
    expect(ingestionSpy).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('shares one bootstrap call for concurrent first requests', async () => {
    const store = emptyStore();
    let releaseGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseGate = () => resolve();
    });
    const ingestionSpy = vi.spyOn(intelligenceStoreModule, 'runPayShIngestionWithOptions').mockImplementation(async (targetStore) => {
      await gate;
      return hydrateLiveIntoStore(targetStore);
    });
    const app = await createApp(store);

    const one = app.inject({ method: 'GET', url: '/v1/providers' });
    const two = app.inject({ method: 'GET', url: '/v1/pulse' });
    const three = app.inject({ method: 'GET', url: '/v1/radar/endpoints' });
    releaseGate();
    const [providers, pulse, endpoints] = await Promise.all([one, two, three]);

    expect(providers.statusCode).toBe(200);
    expect(pulse.statusCode).toBe(200);
    expect(endpoints.statusCode).toBe(200);
    expect(ingestionSpy).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('does not return bootstrap_not_called before bootstrap attempt', async () => {
    const store = emptyStore();
    const ingestionSpy = vi.spyOn(intelligenceStoreModule, 'runPayShIngestionWithOptions').mockResolvedValue({
      run: null,
      events: [],
      usedFixture: false,
      liveFetchFailed: true
    });
    const app = await createApp(store);

    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse' });
    expect(ingestionSpy).toHaveBeenCalledTimes(1);
    expect(pulse.statusCode).toBe(200);
    expect(pulse.json().data.data_source.error).not.toBe('bootstrap_not_called');

    await app.close();
  });
});
