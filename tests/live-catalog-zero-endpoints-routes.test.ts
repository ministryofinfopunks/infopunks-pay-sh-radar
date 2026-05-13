import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { applyPayShCatalogIngestion, type PayShIngestionResult } from '../src/ingestion/payShCatalogAdapter';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { type IntelligenceSnapshot } from '../src/persistence/repository';

type MinimalCatalogItem = {
  name: string;
  namespace: string;
  slug: string;
  fqn: string;
  category: string;
  endpoints: number;
  endpoint_count: number;
  price: string;
  status: 'free tier' | 'metered' | 'free' | 'unknown';
  description?: string;
  tags: string[];
  endpointMetadataPartial: boolean;
  has_metering: boolean;
  has_free_tier: boolean;
  min_price_usd: number;
  max_price_usd: number;
  sha: string;
  catalog_generated_at: string;
  manifest: Record<string, unknown>;
};

function makeStoreWith72ProvidersNoEndpoints(): IntelligenceSnapshot {
  const observedAt = '2026-05-08T00:00:00.000Z';
  const generatedAt = '2026-05-08T00:00:00.000Z';
  const items: MinimalCatalogItem[] = Array.from({ length: 72 }, (_, index) => {
    const n = index + 1;
    const category = n % 2 === 0 ? 'messaging' : 'data';
    return {
      name: `Provider ${n}`,
      namespace: `vendor-${n}/api`,
      slug: `vendor-${n}-api`,
      fqn: `vendor-${n}/api`,
      category,
      endpoints: 0,
      endpoint_count: 0,
      price: '$0 - $1',
      status: n % 3 === 0 ? 'free tier' : 'metered',
      description: n % 5 === 0 ? undefined : `Synthetic provider ${n}`,
      tags: n % 4 === 0 ? [] : [category],
      endpointMetadataPartial: true,
      has_metering: true,
      has_free_tier: true,
      min_price_usd: 0,
      max_price_usd: 1,
      sha: `sha-${n}`,
      catalog_generated_at: generatedAt,
      manifest: {
        fqn: `vendor-${n}/api`,
        title: `Provider ${n}`,
        category,
        endpoint_count: 0
      }
    };
  });

  const base: IntelligenceSnapshot = {
    events: [],
    providers: [],
    endpoints: [],
    trustAssessments: [],
    signalAssessments: [],
    narratives: [],
    ingestionRuns: [],
    monitorRuns: []
  };

  const ingested = applyPayShCatalogIngestion(base, items as never[], {
    observedAt,
    source: 'pay.sh:live-catalog:https://pay.sh/api/catalog',
    dataSource: {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      generated_at: generatedAt,
      provider_count: 72,
      last_ingested_at: observedAt,
      used_fixture: false,
      error: null
    }
  }) as PayShIngestionResult;

  const recomputed = recomputeAssessments(ingested.snapshot);
  recomputed.providers.forEach((provider, index) => {
    if (index % 6 === 0) (provider as { description: string | null }).description = null;
    if (index % 7 === 0) (provider as { tags: string[] }).tags = [];
  });
  return recomputed;
}

describe('live catalog zero-endpoint route behavior', () => {
  it('returns fast lightweight payloads for /status, /v1/pulse, and /v1/providers', async () => {
    const store = makeStoreWith72ProvidersNoEndpoints();
    const app = await createApp(store);

    const statusStart = Date.now();
    const status = await app.inject({ method: 'GET', url: '/status' });
    const statusMs = Date.now() - statusStart;

    const pulseStart = Date.now();
    const pulse = await app.inject({ method: 'GET', url: '/v1/pulse' });
    const pulseMs = Date.now() - pulseStart;

    const providersStart = Date.now();
    const providers = await app.inject({ method: 'GET', url: '/v1/providers' });
    const providersMs = Date.now() - providersStart;

    expect(status.statusCode).toBe(200);
    expect(pulse.statusCode).toBe(200);
    expect(providers.statusCode).toBe(200);

    expect(statusMs).toBeLessThan(5000);
    expect(pulseMs).toBeLessThan(5000);
    expect(providersMs).toBeLessThan(5000);

    const statusBody = status.json();
    expect(statusBody.ok).toBe(true);
    expect(statusBody.catalogSource).toMatch(/^(live|fixture)$/);
    expect(statusBody.providerCount).toBe(72);
    expect(statusBody.endpointCount).toBe(0);
    expect(statusBody.catalog_status).toBe('live_ok');
    expect(statusBody.dataSource).toBeUndefined();

    const pulseBody = pulse.json().data;
    expect(pulseBody.providerCount).toBe(72);
    expect(pulseBody.endpointCount).toBe(0);
    expect(pulseBody.endpoint_metadata).toMatchObject({
      available: false,
      mode: 'provider_level_counts_only',
      reason: 'live_pay_sh_catalog_does_not_include_endpoint_detail'
    });
    expect(Array.isArray(pulseBody.topTrust)).toBe(true);
    expect(Array.isArray(pulseBody.topSignal)).toBe(true);

    const providerBody = providers.json().data;
    expect(Array.isArray(providerBody)).toBe(true);
    expect(providerBody.length).toBe(72);
    expect(providerBody[0]).toHaveProperty('id');
    expect(providerBody[0]).toHaveProperty('fqn');
    expect(providerBody[0]).toHaveProperty('name');
    expect(providerBody[0]).toHaveProperty('category');
    expect(providerBody[0]).toHaveProperty('trust');
    expect(providerBody[0]).toHaveProperty('signal');
    expect(providerBody[0]).toHaveProperty('severity');
    expect(providerBody[0]).toHaveProperty('risk');
    expect(providerBody[0]).toHaveProperty('endpointCount', 0);
    expect(providerBody[0]).not.toHaveProperty('endpoints');
    expect(providerBody[0]).not.toHaveProperty('evidence');

    await app.close();
  });

  it('caps /v1/providers at 100 rows', async () => {
    const store = makeStoreWith72ProvidersNoEndpoints();
    const more = makeStoreWith72ProvidersNoEndpoints();
    store.providers = [...store.providers, ...more.providers.map((provider, index) => ({ ...provider, id: `${provider.id}-extra-${index}`, slug: `${provider.slug}-extra-${index}` }))];
    const app = await createApp(store);

    const response = await app.inject({ method: 'GET', url: '/v1/providers' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.length).toBe(100);

    await app.close();
  });
});
