import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { PayShCatalogItem } from '../src/data/payShCatalogFixture';
import { applyPayShCatalogIngestion } from '../src/ingestion/payShCatalogAdapter';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { InfopunksEvent } from '../src/schemas/entities';
import { recomputeAssessments } from '../src/services/intelligenceStore';

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
  }
];

function preflightStore() {
  const ingested = applyPayShCatalogIngestion(emptySnapshot, catalog, { observedAt: '2026-01-01T00:00:00.000Z', source: 'pay.sh:test' }).snapshot;
  const store = recomputeAssessments(ingested);
  store.dataSource = {
    mode: 'live_pay_sh_catalog',
    url: 'https://pay.sh/api/catalog',
    generated_at: '2026-01-01T00:00:00.000Z',
    provider_count: 4,
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
          : { ...item, score: 65 });
  store.signalAssessments = store.signalAssessments.map((item) =>
    item.entityId === 'alpha'
      ? { ...item, score: 88 }
      : item.entityId === 'stablecrypto'
        ? { ...item, score: 100 }
        : item.entityId === 'ocr'
          ? { ...item, score: 100 }
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
    }
  ];
  store.events.push(...providerEvents);
  return store;
}

describe('preflight API', () => {
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
      candidateCount: 4,
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
    expect(response.json().data.rejectedProviders.length).toBe(4);
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
      totalRejectedCount: 4,
      categoryMismatchCount: 1,
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
});
