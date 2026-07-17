import { describe, expect, it } from 'vitest';
import { createOpenApiSpec } from '../src/api/openapi';
import type { RhChainBoostObservation, RhChainDexScreenerIngestionSource, RhChainMarketSnapshot, RhChainPaidOrder } from '../src/providers/dexscreenerProvider';
import { RhChainAttentionService } from '../src/services/rhChainAttentionService';
import { RhChainMarketDataService } from '../src/services/rhChainMarketDataService';
import { getRhChainDailyReceipts } from '../src/data/rhChain';
import { createApp } from '../src/api/app';

function snapshot(pairAddress: string, liquidity = 100, volume = 100): RhChainMarketSnapshot {
  return { provider: 'dexscreener', chainId: 'robinhood', capturedAt: '2026-07-17T00:00:00.000Z', tokenAddress: '0xabc', pairAddress, dexId: 'dex', priceUsd: 1, liquidityUsd: liquidity, marketCap: null, fdv: null, volume: { h24: volume }, txns: { h24: { buys: 1, sells: 1 } }, priceChange: { h1: null, h6: null, h24: null }, pairCreatedAt: pairAddress === 'old' ? '2024-01-01T00:00:00.000Z' : '2025-01-01T00:00:00.000Z', activeBoosts: 0, paidOrders: [], dataMode: 'live_cached', sourceUrl: null };
}

function provider(overrides: Partial<RhChainDexScreenerIngestionSource> = {}): RhChainDexScreenerIngestionSource {
  const boosts: RhChainBoostObservation[] = [];
  const orders: RhChainPaidOrder[] = [{ type: 'tokenProfile', status: 'approved', paymentTimestamp: '2026-07-17T00:00:00.000Z', observed_at: '2026-07-17T00:00:00.000Z', source: 'dexscreener_paid_attention' }];
  return {
    getLatestTokenProfiles: async () => [], getLatestCommunityTakeovers: async () => [], getLatestAds: async () => [],
    getLatestBoosts: async () => boosts, getTopBoosts: async () => boosts, getPaidOrders: async () => orders,
    getTokenPairs: async () => [snapshot('low', 50, 20), snapshot('old', 100, 10), snapshot('new', 100, 200)],
    getTokenBatch: async () => ({ '0xabc': [snapshot('old', 100, 10), snapshot('new', 100, 200)] }), getPair: async () => snapshot('old'), ...overrides
  };
}

describe('RH Chain market data layer', () => {
  it('selects one canonical pool without double counting and preserves secondary pools', async () => {
    const service = new RhChainMarketDataService({ enabled: true, provider: provider() });
    const result = await service.getToken('0xabc');
    expect(result.market_snapshot?.pairAddress).toBe('new');
    expect(result.secondary_pairs.map((item) => item.pairAddress)).toEqual(['old', 'low']);
    expect(result.liquidity_fragmented).toBe(true);
  });

  it('keeps paid orders as context only and never upgrades reviewed classification', async () => {
    const service = new RhChainMarketDataService({ enabled: true, provider: provider(), classificationFor: () => ({ primary_layer: 'unknown', secondary_layers: [], confidence: null, source: 'review_required' }) });
    const result = await service.getToken('0xabc');
    expect(result.attention.paid_orders).toHaveLength(1);
    expect(result.classification).toEqual(expect.objectContaining({ source: 'review_required' }));
    expect(result.caveats.join(' ')).toMatch(/cannot create identity, classification, a receipt/i);
  });

  it('does not call a boosted token organic without history', async () => {
    const boosts = [{ tokenAddress: '0xabc', chainId: 'robinhood' as const, amount: 5, totalAmount: 5, observed_at: '2026-07-17T00:00:00.000Z', sourceUrl: null }];
    const service = new RhChainMarketDataService({ enabled: true, provider: provider({ getLatestBoosts: async () => boosts }) });
    expect((await service.getToken('0xabc')).attention.attention_state).toBe('source_required');
  });

  it('returns source_required until before/during/after snapshots exist', () => {
    const attention = new RhChainAttentionService(() => new Date('2026-07-17T00:00:00.000Z'));
    expect(attention.assess(snapshot('one')).attention_state).toBe('source_required');
    expect(attention.assess(snapshot('two')).attention_state).toBe('source_required');
    expect(attention.assess(snapshot('three')).attention_state).toBe('organic_persistence');
  });

  it('fails soft when the provider is down without mutating reviewed receipts', async () => {
    const before = structuredClone(getRhChainDailyReceipts());
    const service = new RhChainMarketDataService({ enabled: true, provider: provider({ getTokenPairs: async () => { throw new Error('down'); } }) });
    const result = await service.getToken('0xabc');
    expect(result.market_snapshot).toBeNull();
    expect(result.caveats.join(' ')).toMatch(/Reviewed receipts.*authoritative/i);
    expect(getRhChainDailyReceipts()).toEqual(before);
  });

  it('exposes context, analysis, reviewed classification, provenance, and caveats separately', async () => {
    const app = await createApp(undefined, undefined, { rhChainMarketDataOptions: { enabled: true, provider: provider() } });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/market/tokens/0xabc' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        raw_provider_observation: expect.any(Object), infopunks_analysis: expect.any(Object), classification: expect.any(Object), provenance: expect.any(Object), caveats: expect.any(Array)
      }));
    } finally { await app.close(); }
  });

  it('documents market endpoints as context-only and avoids trading or endorsement language', () => {
    const paths = (createOpenApiSpec() as { paths: Record<string, unknown> }).paths;
    for (const path of ['/v1/rh-chain/market/provider-status', '/v1/rh-chain/market/tokens', '/v1/rh-chain/market/tokens/{contract}', '/v1/rh-chain/market/boosts', '/v1/rh-chain/market/attention']) expect(paths[path]).toBeDefined();
    const docs = JSON.stringify(paths['/v1/rh-chain/market/tokens/{contract}']);
    expect(docs).toMatch(/context/i);
    expect(docs).not.toMatch(/buy|sell|ape|guaranteed return/i);
  });
});
