import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { InfopunksEvent } from '../src/schemas/entities';
import { recomputeAssessments } from '../src/services/intelligenceStore';
import { isPerplexityProvider } from '../src/services/preflightService';

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

const catalog: PayShCatalogItem[] = [
  {
    name: 'Alpha API',
    namespace: 'pay/alpha',
    slug: 'alpha',
    category: 'Payments',
    endpoints: 1,
    price: '$0.01',
    status: 'metered',
    description: 'Alpha settlement and payout provider for payment routing.',
    tags: ['alpha', 'payments', 'settlement', 'payout']
  },
  {
    name: 'Beta API',
    namespace: 'pay/beta',
    slug: 'beta',
    category: 'Payments',
    endpoints: 1,
    price: '$0.08',
    status: 'metered',
    description: 'Beta settlement provider.',
    tags: ['beta', 'payments', 'settlement']
  },
  {
    name: 'StableCrypto',
    namespace: 'finance/stablecrypto',
    slug: 'stablecrypto',
    category: 'Payments',
    endpoints: 2,
    price: '$0.001',
    status: 'metered',
    description: 'Crypto market data and token pricing quotes for trading pairs.',
    tags: ['market', 'token', 'coingecko', 'pricing']
  },
  {
    name: 'OCR Vision API',
    namespace: 'vision/ocr',
    slug: 'ocr',
    category: 'OCR',
    endpoints: 1,
    price: '$0.001',
    status: 'metered',
    description: 'OCR test provider.',
    tags: ['ocr', 'image']
  },
  {
    name: 'PaySponge Perplexity',
    namespace: 'paysponge/perplexity',
    slug: 'paysponge-perplexity',
    category: 'AI/ML',
    endpoints: 1,
    price: '$0.01',
    status: 'metered',
    description: 'Live web research answers with citations for latest events and market shifts.',
    tags: ['research', 'web_search', 'search', 'citations', 'cited_answer', 'answer', 'live_research', 'grounded_answer', 'ai_ml']
  },
  {
    name: 'Google Places API',
    namespace: 'solana-foundation/google-places',
    slug: 'solana-foundation-google-places',
    category: 'Data',
    endpoints: 1,
    price: '$0.005',
    status: 'metered',
    description: 'Search places and nearby points of interest with geocoded results.',
    tags: ['places', 'location', 'maps', 'search']
  },
  {
    name: 'Cloud Vision API',
    namespace: 'solana-foundation/google/vision',
    slug: 'solana-foundation-google-vision',
    category: 'AI/ML',
    endpoints: 1,
    price: '$0.004',
    status: 'metered',
    description: 'Image analysis API for labels, OCR text detection, safe-search, logos, and landmarks.',
    tags: ['vision', 'image_labels', 'image_analysis', 'ocr', 'text_detection', 'safe_search', 'logo_detection', 'landmark_detection', 'ai_ml']
  },
  {
    name: 'Alibaba Embeddings',
    namespace: 'solana-foundation/alibaba/embeddings',
    slug: 'solana-foundation-alibaba-embeddings',
    category: 'AI/ML',
    endpoints: 1,
    price: '$0.003',
    status: 'metered',
    description: 'Embedding and vector similarity endpoints for semantic retrieval.',
    tags: ['embeddings', 'vector', 'search', 'ai_inference', 'ai_ml']
  }
];

function preflightStore() {
  const ingested = applyPayShCatalogIngestion(emptySnapshot, catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.dataSource = {
    mode: 'live_pay_sh_catalog',
    url: 'https://pay.sh/api/catalog',
    generated_at: '2026-01-01T00:00:00.000Z',
    provider_count: 8,
    last_ingested_at: '2026-01-01T00:00:00.000Z',
    used_fixture: false,
    error: null
  };
  store.trustAssessments = store.trustAssessments.map((item) =>
    item.entityId === 'alpha'
      ? { ...item, score: 92 }
      : item.entityId === 'stablecrypto'
        ? { ...item, score: 99 }
        : item.entityId === 'ocr'
          ? { ...item, score: 99 }
          : item.entityId === 'paysponge-perplexity'
            ? { ...item, score: 93 }
            : item.entityId === 'solana-foundation-google-places'
              ? { ...item, score: 94 }
              : item.entityId === 'solana-foundation-google-vision'
                ? { ...item, score: 96 }
              : item.entityId === 'solana-foundation-alibaba-embeddings'
                ? { ...item, score: 99 }
          : { ...item, score: 65 });
  store.signalAssessments = store.signalAssessments.map((item) =>
    item.entityId === 'alpha'
      ? { ...item, score: 88 }
      : item.entityId === 'stablecrypto'
        ? { ...item, score: 100 }
        : item.entityId === 'ocr'
          ? { ...item, score: 100 }
          : item.entityId === 'paysponge-perplexity'
            ? { ...item, score: 97 }
            : item.entityId === 'solana-foundation-google-places'
              ? { ...item, score: 95 }
              : item.entityId === 'solana-foundation-google-vision'
                ? { ...item, score: 96 }
              : item.entityId === 'solana-foundation-alibaba-embeddings'
                ? { ...item, score: 99 }
          : { ...item, score: 91 });
  const providerEvents: InfopunksEvent[] = [
    {
      id: 'alpha-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'alpha',
      observedAt: '2026-01-02T00:00:00.000Z',
      payload: { providerId: 'alpha', response_time_ms: 150, success: true }
    },
    {
      id: 'alpha-recovered',
      type: 'provider.recovered',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'alpha',
      observedAt: '2026-01-02T00:01:00.000Z',
      payload: { providerId: 'alpha', response_time_ms: 150, success: true }
    },
    {
      id: 'beta-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'beta',
      observedAt: '2026-01-02T00:00:00.000Z',
      payload: { providerId: 'beta', response_time_ms: 700, success: true }
    },
    {
      id: 'beta-degraded',
      type: 'provider.degraded',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'beta',
      observedAt: '2026-01-02T00:02:00.000Z',
      payload: { providerId: 'beta', response_time_ms: 700, success: false }
    },
    {
      id: 'stablecrypto-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'stablecrypto',
      observedAt: '2026-01-02T00:02:30.000Z',
      payload: { providerId: 'stablecrypto', response_time_ms: 180, success: true }
    },
    {
      id: 'ocr-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'ocr',
      observedAt: '2026-01-02T00:03:00.000Z',
      payload: { providerId: 'ocr', response_time_ms: 90, success: true }
    },
    {
      id: 'perplexity-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'paysponge-perplexity',
      observedAt: '2026-01-02T00:03:30.000Z',
      payload: { providerId: 'paysponge-perplexity', response_time_ms: 240, success: true }
    },
    {
      id: 'places-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'solana-foundation-google-places',
      observedAt: '2026-01-02T00:04:00.000Z',
      payload: { providerId: 'solana-foundation-google-places', response_time_ms: 180, success: true }
    },
    {
      id: 'alibaba-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'solana-foundation-alibaba-embeddings',
      observedAt: '2026-01-02T00:04:15.000Z',
      payload: { providerId: 'solana-foundation-alibaba-embeddings', response_time_ms: 110, success: true }
    },
    {
      id: 'vision-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'solana-foundation-google-vision',
      observedAt: '2026-01-02T00:04:30.000Z',
      payload: { providerId: 'solana-foundation-google-vision', response_time_ms: 130, success: true }
    }
  ];
  store.events.push(...providerEvents);
  return store;
}

function preflightStoreWithDexPoolsProvider() {
  const base = preflightStore();
  const dexCatalog: PayShCatalogItem[] = [
    {
      name: 'PaySponge CoinGecko',
      namespace: 'finance/paysponge-coingecko',
      slug: 'paysponge-coingecko',
      category: 'Finance',
      endpoints: 1,
      price: '$0.002',
      status: 'metered',
      description: 'CoinGecko onchain DEX pools and GeckoTerminal trending pools for Solana.',
      tags: ['coingecko', 'onchain', 'dex', 'pool', 'pools', 'trending', 'geckoterminal', 'market data']
    }
  ];
  const ingested = applyPayShCatalogIngestion(base, dexCatalog, { observedAt: '2026-01-03T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.dataSource = {
    mode: 'live_pay_sh_catalog',
    url: 'https://pay.sh/api/catalog',
    generated_at: '2026-01-03T00:00:00.000Z',
    provider_count: 6,
    last_ingested_at: '2026-01-03T00:00:00.000Z',
    used_fixture: false,
    error: null
  };
  store.trustAssessments = store.trustAssessments.map((item) =>
    item.entityId === 'paysponge-coingecko'
      ? { ...item, score: 95 }
      : item.entityId === 'stablecrypto'
        ? { ...item, score: 99 }
        : item
  );
  store.signalAssessments = store.signalAssessments.map((item) =>
    item.entityId === 'paysponge-coingecko'
      ? { ...item, score: 85 }
      : item.entityId === 'stablecrypto'
        ? { ...item, score: 100 }
        : item
  );
  return store;
}

function preflightStoreWithQuicknodeRpcProvider() {
  const base = preflightStore();
  const rpcCatalog: PayShCatalogItem[] = [
    {
      name: 'QuickNode RPC',
      namespace: 'quicknode/rpc',
      slug: 'quicknode-rpc',
      category: 'Compute',
      endpoints: 1,
      price: '$0.001',
      status: 'metered',
      description: 'QuickNode JSON-RPC blockchain node for solana-mainnet and ethereum-mainnet on-chain state.',
      tags: ['quicknode', 'rpc', 'json-rpc', 'solana-mainnet', 'ethereum-mainnet', 'blockchain', 'node']
    }
  ];
  const ingested = applyPayShCatalogIngestion(base, rpcCatalog, { observedAt: '2026-01-04T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.dataSource = {
    mode: 'live_pay_sh_catalog',
    url: 'https://pay.sh/api/catalog',
    generated_at: '2026-01-04T00:00:00.000Z',
    provider_count: 6,
    last_ingested_at: '2026-01-04T00:00:00.000Z',
    used_fixture: false,
    error: null
  };
  store.trustAssessments = store.trustAssessments.map((item) =>
    item.entityId === 'quicknode-rpc'
      ? { ...item, score: 97 }
      : item
  );
  store.signalAssessments = store.signalAssessments.map((item) =>
    item.entityId === 'quicknode-rpc'
      ? { ...item, score: 96 }
      : item
  );
  return store;
}

describe('preflight API', () => {
  it('isPerplexityProvider detects providerId paysponge-perplexity', () => {
    expect(isPerplexityProvider({ id: 'paysponge-perplexity', slug: 'paysponge-perplexity', name: 'Any', namespace: 'x', fqn: 'x', serviceUrl: null } as any)).toBe(true);
  });

  it('isPerplexityProvider detects providerId paysponge/perplexity', () => {
    expect(isPerplexityProvider({ id: 'paysponge/perplexity', slug: 'paysponge-perplexity', name: 'Any', namespace: 'x', fqn: 'x', serviceUrl: null } as any)).toBe(true);
  });

  it('isPerplexityProvider detects name Perplexity AI API', () => {
    expect(isPerplexityProvider({ id: 'provider-x', slug: 'provider-x', name: 'Perplexity AI API', namespace: 'x', fqn: 'x', serviceUrl: null } as any)).toBe(true);
  });

  it('isPerplexityProvider detects serviceUrl pplx.x402.paysponge.com', () => {
    expect(isPerplexityProvider({ id: 'provider-x', slug: 'provider-x', name: 'Any', namespace: 'x', fqn: 'x', serviceUrl: 'https://pplx.x402.paysponge.com' } as any)).toBe(true);
  });

  it('returns route_approved when at least one candidate passes policy', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement', category: 'Payments', constraints: { minTrustScore: 80, maxLatencyMs: 300, maxCostUsd: 0.05 } }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      decision: 'route_approved',
      blockReason: null,
      selectedProvider: 'alpha',
      selectedProviderDetails: {
        providerId: 'alpha',
        category: 'Payments'
      },
      categoryMatch: true,
      fallbackCategoryUsed: false,
      candidateCount: 8,
      consideredProviderCount: 3,
      dataMode: 'live'
    });
    await app.close();
  });

  it('returns route_blocked when all providers are rejected', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement', constraints: { minTrustScore: 95, maxCostUsd: 0 } }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.decision).toBe('route_blocked');
    expect(response.json().data.blockReason).toBe('all_candidates_rejected_by_policy');
    expect(response.json().data.selectedProvider).toBeNull();
    expect(response.json().data.rejectedProviders.length).toBe(8);
    await app.close();
  });

  it('filters candidate providers when candidateProviders is supplied', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement', candidateProviders: ['beta'], constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.candidateCount).toBe(1);
    expect(body.consideredProviderCount).toBe(1);
    expect(body.decision).toBe('route_blocked');
    expect(body.blockReason).toBe('all_candidates_rejected_by_policy');
    expect(body.rejectedProviders[0].providerId).toBe('beta');
    await app.close();
  });

  it('uses default constraints when constraints are missing', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement' }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.blockReason).toBeNull();
    expect(body.routingPolicy.constraints.minTrustScore).toBe(70);
    expect(body.routingPolicy.constraints.maxLatencyMs).toBeNull();
    expect(body.routingPolicy.constraints.maxCostUsd).toBeNull();
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('alpha');
    await app.close();
  });

  it('payout request does not select market_data providers when payment capabilities exist', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'select provider for a payout request', category: 'payments', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('alpha');
    expect(body.requiredCapabilities).toEqual(['payment', 'settlement']);
    expect(body.capabilityInferenceReason).toBe('payment_intent_from_execute_payment');
    expect(body.rejectedProviders).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerId: 'stablecrypto', reasons: expect.arrayContaining(['capability_mismatch:market_data!=payment']) })
    ]));
    await app.close();
  });

  it('market data intent with payment-decision context may select StableCrypto', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'get crypto market data before a payment decision', category: 'payments', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('stablecrypto');
    expect(body.capabilityMatch).toBe(true);
    expect(body.requiredCapabilities).toEqual(['market_data', 'pricing']);
    expect(body.capabilityInferenceReason).toBe('market_data_intent_from_get_market_data');
    await app.close();
  });

  it('trending Solana DEX pools prefers paysponge-coingecko over generic market_data provider', async () => {
    const app = await createApp(preflightStoreWithDexPoolsProvider());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'get trending Solana DEX pools',
        category: 'finance',
        constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 },
        debug: true
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('paysponge-coingecko');
    expect(body.requiredCapabilities).toEqual(['dex_pools', 'trending', 'market_data']);
    expect(body.capabilityInferenceReason).toBe('dex_pools_intent_from_trending_pools');
    expect(body.selectedProviderDetails).toMatchObject({
      providerId: 'paysponge-coingecko',
      capabilities: expect.arrayContaining(['market_data', 'pricing', 'dex_pools', 'trending']),
      capabilityMatchScore: 3,
      policyNotes: expect.arrayContaining(['latency_unknown_allowed_for_specific_capability_match'])
    });
    expect(body.consideredProvidersRejected).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerId: 'stablecrypto',
        reasons: expect.arrayContaining(['lower_capability_match_score:1<3'])
      })
    ]));
    await app.close();
  });

  it('unknown latency generic market_data provider is rejected for market-data intent without dex/trending exception', async () => {
    const app = await createApp(preflightStoreWithDexPoolsProvider());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'get crypto market data',
        category: 'finance',
        candidateProviders: ['paysponge-coingecko'],
        constraints: { minTrustScore: 0, maxLatencyMs: 3000, maxCostUsd: 0.05 },
        debug: true
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_blocked');
    expect(body.blockReason).toBe('all_candidates_rejected_by_policy');
    expect(body.rejectedProviders).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerId: 'paysponge-coingecko',
        reasons: expect.arrayContaining(['latency_exceeds_max:unknown>3000'])
      })
    ]));
    await app.close();
  });

  it('get crypto market data may still select StableCrypto when dex pools provider exists', async () => {
    const app = await createApp(preflightStoreWithDexPoolsProvider());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'get crypto market data', category: 'finance', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('stablecrypto');
    await app.close();
  });

  it('get token price may select simple market_data provider over dex pools provider', async () => {
    const app = await createApp(preflightStoreWithDexPoolsProvider());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'get token price', category: 'finance', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('stablecrypto');
    await app.close();
  });

  it('get token price selects market_data/pricing provider', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'get token price', category: 'payments', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('stablecrypto');
    expect(body.requiredCapabilities).toEqual(['market_data', 'pricing']);
    expect(body.capabilityInferenceReason).toBe('market_data_intent_from_get_market_data');
    await app.close();
  });

  it('market data intent accepts category=finance and still selects market data provider', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'get crypto market data',
        category: 'finance',
        constraints: { minTrustScore: 70, maxLatencyMs: 1000, maxCostUsd: 0.01 }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('stablecrypto');
    expect(body.requiredCapabilities).toEqual(['market_data', 'pricing']);
    await app.close();
  });

  it('market data intent accepts category=data and still selects market data provider', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'get crypto market data',
        category: 'data',
        constraints: { minTrustScore: 70, maxLatencyMs: 1000, maxCostUsd: 0.01 }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('stablecrypto');
    expect(body.requiredCapabilities).toEqual(['market_data', 'pricing']);
    await app.close();
  });

  it('select provider for a payout request blocks when no payment providers are in candidate set', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'select provider for a payout request',
        category: 'payments',
        candidateProviders: ['stablecrypto'],
        constraints: { minTrustScore: 0 }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_blocked');
    expect(body.blockReason).toBe('no_capability_match');
    expect(body.requiredCapabilities).toEqual(['payment', 'settlement']);
    expect(body.capabilityInferenceReason).toBe('payment_intent_from_execute_payment');
    expect(body.consideredProvidersRejected).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerId: 'stablecrypto',
        category: 'Payments',
        reasons: expect.arrayContaining(['capability_mismatch:market_data!=payment'])
      })
    ]));
    expect(body.rejectionSummary).toMatchObject({
      totalRejectedCount: 1,
      categoryMismatchCount: 0,
      capabilityMismatchCount: 1,
      policyRejectedCount: 0
    });
    await app.close();
  });

  it('execute token payment requires payment/settlement', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'execute token payment', category: 'payments', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.requiredCapabilities).toEqual(['payment', 'settlement']);
    expect(body.capabilityInferenceReason).toBe('payment_intent_from_execute_payment');
    await app.close();
  });

  it('returns route_blocked with no_capability_match when category matches but capabilities do not', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'send email receipt', category: 'payments', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_blocked');
    expect(body.blockReason).toBe('no_capability_match');
    expect(body.capabilityMatch).toBe(false);
    expect(body.requiredCapabilities).toEqual(['messaging']);
    expect(body.capabilityInferenceReason).toBe('messaging_intent_from_send_email');
    expect(body.consideredProvidersRejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerId: 'alpha', category: 'Payments' }),
      expect.objectContaining({ providerId: 'beta', category: 'Payments' }),
      expect.objectContaining({ providerId: 'stablecrypto', category: 'Payments' })
    ]));
    expect(body.consideredProvidersRejected).toHaveLength(3);
    expect(body.rejectionSummary).toMatchObject({
      totalRejectedCount: 8,
      categoryMismatchCount: 5,
      capabilityMismatchCount: 3,
      policyRejectedCount: 0
    });
    expect(body.rejectedProviders).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerId: 'alpha', reasons: expect.arrayContaining(['capability_mismatch:payment!=messaging']) })
    ]));
    await app.close();
  });

  it('category filtering keeps only matching or aliased providers', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement', category: 'finance', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.categoryMatch).toBe(true);
    expect(body.selectedProvider).toBe('alpha');
    expect(body.rejectedProviders).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerId: 'ocr', reasons: expect.arrayContaining(['category_mismatch:ocr!=finance']) })
    ]));
    await app.close();
  });

  it('returns route_blocked when no providers match requested category', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'voice assistant prompt', category: 'speech', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_blocked');
    expect(body.blockReason).toBe('no_category_match');
    expect(body.selectedProvider).toBeNull();
    expect(body.categoryMatch).toBe(false);
    expect(body.fallbackCategoryUsed).toBe(false);
    expect(body.rejectedProviders).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerId: 'alpha', reasons: expect.arrayContaining(['category_mismatch:payments!=speech']) }),
      expect.objectContaining({ providerId: 'beta', reasons: expect.arrayContaining(['category_mismatch:payments!=speech']) }),
      expect.objectContaining({ providerId: 'stablecrypto', reasons: expect.arrayContaining(['category_mismatch:payments!=speech']) }),
      expect.objectContaining({ providerId: 'ocr', reasons: expect.arrayContaining(['category_mismatch:ocr!=speech']) })
    ]));
    await app.close();
  });

  it('returns blockReason=no_category_match when category filter excludes all providers', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'voice assistant prompt', category: 'speech', constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_blocked');
    expect(body.blockReason).toBe('no_category_match');
    await app.close();
  });

  it('returns route_blocked with explicit no_candidates reason instead of unexplained empty rejection set', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'checkout settlement', candidateProviders: ['does-not-exist-1', 'does-not-exist-2'], constraints: { minTrustScore: 0 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_blocked');
    expect(body.blockReason).toBe('no_candidates');
    expect(body.candidateCount).toBe(0);
    expect(body.consideredProviderCount).toBe(0);
    expect(body.selectedProvider).toBeNull();
    expect(body.rejectedProviders).toEqual([]);
    await app.close();
  });

  it('truncates rejectedProviders to 25 and exposes counts when many providers are rejected', async () => {
    const manyCatalog: PayShCatalogItem[] = Array.from({ length: 30 }, (_, n) => ({
      name: `Bulk Pay ${n + 1}`,
      namespace: `pay/bulk-${n + 1}`,
      slug: `bulk-${n + 1}`,
      category: 'Payments',
      endpoints: 1,
      price: '$0.01',
      status: 'metered',
      description: `Bulk provider ${n + 1}.`,
      tags: ['payments']
    }));
    const ingested = applyPayShCatalogIngestion(emptySnapshot, manyCatalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
    const store = recomputeAssessments(ingested);
    store.trustAssessments = store.trustAssessments.map((item) => ({ ...item, score: 10 }));
    store.signalAssessments = store.signalAssessments.map((item) => ({ ...item, score: 50 }));
    store.dataSource = {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      generated_at: '2026-01-01T00:00:00.000Z',
      provider_count: 30,
      last_ingested_at: '2026-01-01T00:00:00.000Z',
      used_fixture: false,
      error: null
    };

    const app = await createApp(store);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'provider selection benchmark', category: 'payments', constraints: { minTrustScore: 95 } }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_blocked');
    expect(body.blockReason).toBe('all_candidates_rejected_by_policy');
    expect(body.rejectedProviderCount).toBe(30);
    expect(body.rejectedProvidersTruncated).toBe(true);
    expect(body.rejectedProviders).toHaveLength(25);
    expect(body.consideredProviderCount).toBe(30);
    await app.close();
  });

  it('returns full rejectedProviders list when debug=true', async () => {
    const manyCatalog: PayShCatalogItem[] = Array.from({ length: 30 }, (_, n) => ({
      name: `Bulk Pay ${n + 1}`,
      namespace: `pay/bulk-${n + 1}`,
      slug: `bulk-${n + 1}`,
      category: 'Payments',
      endpoints: 1,
      price: '$0.01',
      status: 'metered',
      description: `Bulk provider ${n + 1}.`,
      tags: ['payments']
    }));
    const ingested = applyPayShCatalogIngestion(emptySnapshot, manyCatalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
    const store = recomputeAssessments(ingested);
    store.trustAssessments = store.trustAssessments.map((item) => ({ ...item, score: 10 }));
    store.dataSource = {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      generated_at: '2026-01-01T00:00:00.000Z',
      provider_count: 30,
      last_ingested_at: '2026-01-01T00:00:00.000Z',
      used_fixture: false,
      error: null
    };
    const app = await createApp(store);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: { intent: 'provider selection benchmark', category: 'payments', constraints: { minTrustScore: 95 }, debug: true }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.rejectedProviderCount).toBe(30);
    expect(body.rejectedProvidersTruncated).toBe(false);
    expect(body.rejectedProviders).toHaveLength(30);
    await app.close();
  });

  it('exposes preflight schema endpoint', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({ method: 'GET', url: '/v1/preflight/schema' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.request).toBeTruthy();
    expect(response.json().data.response).toBeTruthy();
    await app.close();
  });

  it('check Solana mainnet RPC health prefers quicknode-rpc when available', async () => {
    const app = await createApp(preflightStoreWithQuicknodeRpcProvider());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'check Solana mainnet RPC health',
        category: 'compute',
        constraints: { minTrustScore: 70, maxLatencyMs: 5000, maxCostUsd: 0.05 },
        debug: true
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('quicknode-rpc');
    expect(body.requiredCapabilities).toEqual(['rpc', 'blockchain', 'solana', 'onchain', 'compute']);
    expect(body.capabilityInferenceReason).toBe('rpc_intent_from_blockchain_rpc');
    expect(body.selectedProviderDetails).toMatchObject({
      providerId: 'quicknode-rpc',
      capabilities: expect.arrayContaining(['rpc', 'blockchain', 'solana', 'onchain', 'compute']),
      capabilityMatchScore: 5,
      policyNotes: expect.arrayContaining(['latency_unknown_allowed_for_specific_capability_match'])
    });
    await app.close();
  });

  it('generic compute intent does not automatically select QuickNode unless capability fit is strongest', async () => {
    const app = await createApp(preflightStoreWithQuicknodeRpcProvider());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'run compute job',
        constraints: { minTrustScore: 0, maxLatencyMs: 5000, maxCostUsd: 0.05 }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).not.toBe('quicknode-rpc');
    expect(body.requiredCapabilities).toEqual([]);
    expect(body.capabilityInferenceReason).toBeNull();
    await app.close();
  });

  it('simple market-data intent does not select QuickNode', async () => {
    const app = await createApp(preflightStoreWithQuicknodeRpcProvider());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'get crypto market data',
        category: 'finance',
        constraints: { minTrustScore: 0, maxLatencyMs: 5000, maxCostUsd: 0.05 }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('stablecrypto');
    expect(body.requiredCapabilities).toEqual(['market_data', 'pricing']);
    await app.close();
  });

  it('research latest Solana agent payments routes to PaySponge Perplexity with research_answer capabilities', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'research latest Solana agent payments',
        category: 'ai_ml',
        constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 },
        debug: true
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('paysponge-perplexity');
    expect(body.blockReason).toBeNull();
    expect(body.requiredCapabilities).toEqual(['research_answer', 'cited_answer', 'grounded_answer', 'web_search', 'citations', 'live_research']);
    expect(body.selectedProviderDetails).toMatchObject({
      providerId: 'paysponge-perplexity',
      capabilities: expect.arrayContaining(['research', 'web_search', 'search', 'citations', 'cited_answer', 'answer', 'live_research', 'grounded_answer', 'ai_ml', 'research_answer'])
    });
    expect(body.selectedProvider).not.toBe('solana-foundation-google-vision');
    expect(body.selectedProvider).not.toBe('solana-foundation-alibaba-embeddings');
    await app.close();
  });

  it('Perplexity enriched capabilities include full research-answer set for serviceUrl-only detection', async () => {
    const serviceUrlCatalog: PayShCatalogItem[] = [{
      name: 'Perplexity AI API',
      namespace: 'research/pplx-provider',
      slug: 'research-pplx-provider',
      category: 'AI/ML',
      endpoints: 1,
      price: '$0.01',
      status: 'metered',
      description: 'General AI provider.',
      tags: ['ai_ml'],
      service_url: 'https://pplx.x402.paysponge.com'
    }];
    const ingested = applyPayShCatalogIngestion(emptySnapshot, serviceUrlCatalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
    const store = recomputeAssessments(ingested);
    store.dataSource = {
      mode: 'live_pay_sh_catalog',
      url: 'https://pay.sh/api/catalog',
      generated_at: '2026-01-01T00:00:00.000Z',
      provider_count: 1,
      last_ingested_at: '2026-01-01T00:00:00.000Z',
      used_fixture: false,
      error: null
    };
    store.trustAssessments = store.trustAssessments.map((item) => ({ ...item, score: 90 }));
    store.signalAssessments = store.signalAssessments.map((item) => ({ ...item, score: 90 }));
    store.events.push({
      id: 'pplx-checked',
      type: 'provider.checked',
      source: 'infopunks:safe-metadata-monitor',
      entityType: 'provider',
      entityId: 'research-pplx-provider',
      observedAt: '2026-01-02T00:00:00.000Z',
      payload: { providerId: 'research-pplx-provider', response_time_ms: 200, success: true }
    });

    const app = await createApp(store);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'research latest Solana agent payments',
        category: 'ai_ml',
        constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 },
        debug: true
      }
    });
    expect(response.statusCode).toBe(200);
    const capabilities = response.json().data.selectedProviderDetails.capabilities as string[];
    expect(capabilities).toEqual(expect.arrayContaining(['research_answer', 'cited_answer', 'grounded_answer', 'web_search', 'citations', 'live_research', 'search', 'answer', 'ai_ml', 'research']));
    await app.close();
  });

  it('Cloud Vision capability enrichment excludes research-answer capabilities', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'image labels and logo detection',
        category: 'ai_ml',
        candidateProviders: ['solana-foundation-google-vision'],
        constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 },
        debug: true
      }
    });
    expect(response.statusCode).toBe(200);
    const capabilities = response.json().data.selectedProviderDetails.capabilities as string[];
    expect(capabilities).toEqual(expect.arrayContaining(['vision', 'image_labels', 'image_analysis', 'ocr', 'text_detection', 'safe_search', 'logo_detection', 'landmark_detection', 'ai_ml']));
    expect(capabilities).not.toEqual(expect.arrayContaining(['citations', 'web_search', 'research_answer', 'grounded_answer', 'cited_answer', 'live_research']));
    await app.close();
  });

  it('image label intent routes to Google Vision', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'run image labels and text detection',
        category: 'ai_ml',
        constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 },
        debug: true
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('solana-foundation-google-vision');
    expect(body.requiredCapabilities).toEqual(['vision', 'image_labels', 'image_analysis']);
    await app.close();
  });

  it('embeddings provider is ranked below or rejected for research_answer intent', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'research latest Solana agent payments',
        category: 'ai_ml',
        constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 },
        debug: true
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    const rejectedAlibaba = body.consideredProvidersRejected.find((item: any) => item.providerId === 'solana-foundation-alibaba-embeddings');
    expect(body.selectedProvider).toBe('paysponge-perplexity');
    expect(rejectedAlibaba).toBeTruthy();
    expect(rejectedAlibaba.reasons.join(',')).toMatch(/embedding_provider_without_research_answer|lower_capability_match_score/);
    await app.close();
  });

  it('candidateProviders normalization matches Perplexity aliases and avoids no_candidates for research_answer', async () => {
    const app = await createApp(preflightStore());
    const aliases = ['paysponge/perplexity', 'paysponge-perplexity', 'PaySponge Perplexity'];
    for (const candidateProvider of aliases) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/preflight',
        payload: {
          intent: 'research latest Solana agent payments',
          category: 'ai_ml',
          candidateProviders: [candidateProvider],
          constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 }
        }
      });
      expect(response.statusCode).toBe(200);
      const body = response.json().data;
      expect(body.blockReason).not.toBe('no_candidates');
      expect(body.decision).toBe('route_approved');
      expect(body.selectedProvider).toBe('paysponge-perplexity');
    }
    await app.close();
  });

  it('places search routes to Google Places provider', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'places search near me',
        category: 'data',
        constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.decision).toBe('route_approved');
    expect(body.selectedProvider).toBe('solana-foundation-google-places');
    await app.close();
  });

  it('generic search intent can still route to non-research search providers', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preflight',
      payload: {
        intent: 'search embeddings index',
        category: 'ai_ml',
        constraints: { minTrustScore: 70, maxLatencyMs: 3000, maxCostUsd: 0.05 }
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.requiredCapabilities).toEqual(['search', 'ai_inference']);
    expect(body.decision).toBe('route_approved');
    expect(['paysponge-perplexity', 'solana-foundation-alibaba-embeddings']).toContain(body.selectedProvider);
    await app.close();
  });

  it('supports radar batch preflight success and partial failures', async () => {
    const app = await createApp(preflightStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/preflight/batch',
      payload: {
        queries: [
          { id: 'sol-price', intent: 'get SOL price', category: 'finance', constraints: { min_trust: 80, prefer_reachable: true } },
          { id: 'bad', category: 'finance' }
        ]
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.count).toBe(2);
    expect(body.results.find((item: any) => item.id === 'sol-price')?.ok).toBe(true);
    expect(body.results.find((item: any) => item.id === 'bad')?.ok).toBe(false);
    await app.close();
  });

  it('enforces radar batch preflight size limit', async () => {
    const app = await createApp(preflightStore());
    const queries = Array.from({ length: 26 }, (_, i) => ({ id: `q-${i + 1}`, intent: 'get SOL price', category: 'finance' }));
    const response = await app.inject({
      method: 'POST',
      url: '/v1/radar/preflight/batch',
      payload: { queries }
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
