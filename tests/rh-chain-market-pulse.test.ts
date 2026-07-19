import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { RhChainBoostObservation, RhChainDexScreenerIngestionSource, RhChainMarketSnapshot } from '../src/providers/dexscreenerProvider';
import { RhChainMarketDataService } from '../src/services/rhChainMarketDataService';
import { RhChainMarketStructureService, type RhChainLayerClassification } from '../src/services/rhChainMarketStructureService';
import type { RhChainMarketSnapshot as StoredSnapshot } from '../src/services/rhChainMarketSnapshotService';

const MEME = '0x1111111111111111111111111111111111111111';
const RWA = '0x2222222222222222222222222222222222222222';
const NOW = new Date('2026-07-19T12:00:00.000Z');

function pair(contract: string, volume: number, liquidity: number, buys: number, sells: number, createdAt = '2026-07-01T00:00:00.000Z'): RhChainMarketSnapshot {
  return { provider: 'dexscreener', chainId: 'robinhood', capturedAt: NOW.toISOString(), tokenAddress: contract, pairAddress: `pair-${contract}`, dexId: contract === MEME ? 'uniswap' : 'other-dex', priceUsd: 1, liquidityUsd: liquidity, marketCap: null, fdv: null, volume: { h24: volume }, txns: { h24: { buys, sells } }, priceChange: { h1: null, h6: null, h24: null }, pairCreatedAt: createdAt, activeBoosts: 0, paidOrders: [], freshness: 'fresh', rawDataVersion: 'dexscreener-v1', dataMode: 'live_cached', sourceUrl: null };
}
function provider(overrides: Partial<RhChainDexScreenerIngestionSource> = {}): RhChainDexScreenerIngestionSource {
  const pairs = { [MEME]: [pair(MEME, 100, 500, 8, 2)], [RWA]: [pair(RWA, 50, 700, 3, 2, '2026-07-19T01:00:00.000Z')] };
  const boosts: RhChainBoostObservation[] = [{ tokenAddress: MEME, chainId: 'robinhood', amount: 8, totalAmount: 8, observed_at: NOW.toISOString(), sourceUrl: null }];
  return {
    getLatestTokenProfiles: async () => [], getLatestCommunityTakeovers: async () => [], getLatestAds: async () => [],
    getLatestBoosts: async () => boosts, getTopBoosts: async () => boosts, getPaidOrders: async () => [],
    getTokenPairs: async (contract) => pairs[contract.toLowerCase() as keyof typeof pairs] ?? [],
    getTokenBatch: async (contracts) => Object.fromEntries(contracts.map((contract) => [contract.toLowerCase(), pairs[contract.toLowerCase() as keyof typeof pairs] ?? []])),
    getPair: async () => null,
    ...overrides
  };
}
function classification(contract: string, layer: 'meme' | 'rwa'): RhChainLayerClassification {
  return { contract, ticker: layer === 'meme' ? 'MEME' : 'RWA', display_name: layer === 'meme' ? 'Meme asset' : 'RWA asset', dexscreener_pair: null, primary_layer: layer, secondary_layers: layer === 'rwa' ? ['defi'] : [], cross_layer_category: layer === 'rwa' ? 'defi_x_rwa' : null, classification_reason: 'Reviewed test classification.', classification_source: 'manual_review', classification_confidence: 'high', evidence_state: 'reviewed', missing_evidence: [], caveat: null, reviewed_at: '2026-07-18T00:00:00.000Z', observed_at: NOW.toISOString(), data_mode: 'manual' };
}
function history(contract: string, volume: number, liquidity: number, boosts = 0): StoredSnapshot {
  return { snapshot_id: `snapshot-${contract}`, captured_at: '2026-07-18T00:00:00.000Z', provider: 'dexscreener', chain_id: 'robinhood', token_address: contract, ticker: null, pair_address: `pair-${contract}`, dex_id: 'uniswap', price_usd: 1, liquidity_usd: liquidity, market_cap: null, fdv: null, volume_h24: volume, volume_h6: null, volume_h1: null, txns_h24_buys: 4, txns_h24_sells: 2, txns_h6_buys: null, txns_h6_sells: null, price_change_h24: null, pair_created_at: null, active_boosts: boosts, paid_order_types: boosts ? ['tokenProfile'] : [], paid_order_statuses: [], data_mode: 'live_cached', source_url: null };
}
function service(source = provider(), histories: Record<string, StoredSnapshot[]> = { [MEME]: [history(MEME, 80, 550, 4)], [RWA]: [history(RWA, 40, 500)] }) {
  const marketData = new RhChainMarketDataService({ enabled: true, provider: source, knownTokenAddresses: () => [MEME, RWA], now: () => NOW });
  return new RhChainMarketStructureService({ marketData, classifications: [classification(MEME, 'meme'), classification(RWA, 'rwa')], snapshotHistoryForContracts: async () => histories, now: () => NOW });
}

describe('RH Chain Market Pulse', () => {
  it('aggregates tracked market state without double counting secondary pairs', async () => {
    const pulse = await service().marketPulse();
    expect(pulse.metrics.tracked_volume_24h).toMatchObject({ value: 150, previous_value: 120, absolute_change: 30, percentage_change: 25, unit: 'usd', freshness: 'fresh', confidence: 'medium' });
    expect(pulse.metrics.tracked_liquidity.value).toBe(1_200);
    expect(pulse.metrics.tracked_transactions_24h.value).toBe(15);
    expect(pulse.metrics.active_tracked_tokens.value).toBe(2);
    expect(pulse.metrics.newly_discovered_tokens.value).toBe(1);
    expect(pulse.layer_composition.find((layer) => layer.layer === 'meme')?.volume_share.value).toBe(66.67);
    expect(pulse.concentration.top_three_volume_share.value).toBe(100);
    expect(pulse.concentration.leading_dex?.dex_id).toBe('uniswap');
  });

  it('generates deterministic interpretation and momentum from measured deltas', async () => {
    const pulse = await service().marketPulse();
    expect(pulse.interpretation).toMatchObject({ headline: 'Memes attention leads, while RWAs liquidity is gaining.', method: 'deterministic_rules_v1' });
    expect(pulse.interpretation.supporting).toContain('Volume is rising faster than durable liquidity in the tracked set.');
    expect(pulse.interpretation.rules).toEqual(expect.arrayContaining(['dominant_layer_by_tracked_volume', 'volume_outpaces_liquidity']));
    expect(pulse.momentum.fastest_growing_layer?.subject).toBe('Memes');
    expect(pulse.momentum.largest_liquidity_increase?.subject).toBe('RWA asset');
    expect(pulse.momentum.strongest_post_boost_retention?.subject).toBe('Meme asset');
    expect(pulse.momentum.most_important_cross_layer_development?.subject).toBe('RWA asset');
    expect(JSON.stringify(pulse)).not.toMatch(/buy now|sell now|guaranteed return|100x/i);
  });

  it('keeps missing comparison data null and warns instead of inventing momentum', async () => {
    const pulse = await service(provider(), {}).marketPulse();
    expect(pulse.metrics.tracked_volume_24h.previous_value).toBeNull();
    expect(pulse.momentum.fastest_growing_layer).toBeNull();
    expect(pulse.momentum.largest_volume_acceleration).toBeNull();
    expect(pulse.interpretation.rules).toContain('insufficient_comparison_history');
    expect(pulse.warnings.join(' ')).toMatch(/comparable previous-window snapshot/i);
  });

  it('returns a calm unavailable state when the provider cannot supply current pairs', async () => {
    const pulse = await service(provider({ getTokenBatch: async () => { throw new Error('provider-down'); } })).marketPulse();
    expect(pulse).toMatchObject({ freshness: 'unavailable', confidence: 'low', data_mode: 'unavailable' });
    expect(pulse.metrics.tracked_volume_24h.value).toBeNull();
    expect(pulse.metrics.tracked_liquidity.value).toBeNull();
    expect(pulse.metrics.tracked_transactions_24h.value).toBeNull();
    expect(pulse.metrics.active_tracked_tokens.value).toBe(0);
    expect(pulse.interpretation.headline).toBe('Market structure is waiting for fresh pair evidence.');
    expect(pulse.warnings.join(' ')).toMatch(/No current exact-contract pair observations/i);
  });

  it('serves the public API through the established RH Chain envelope', async () => {
    const app = await createApp(undefined, undefined, {
      rhChainMarketDataOptions: { enabled: true, provider: provider(), knownTokenAddresses: () => [MEME, RWA], now: () => NOW },
      rhChainMarketStructureOptions: { classifications: [classification(MEME, 'meme'), classification(RWA, 'rwa')], snapshotHistoryForContracts: async () => ({ [MEME]: [history(MEME, 80, 550)], [RWA]: [history(RWA, 40, 500)] }), now: () => NOW }
    });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/market' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ title: 'Robinhood Chain Market Pulse', observation_window: expect.any(Object), provider_provenance: expect.any(Object), confidence: 'medium' }), meta: expect.any(Object), sources: expect.any(Array) }));
      const socialCard = await app.inject({ method: 'GET', url: '/og/rh-chain/market.png' });
      expect(socialCard.statusCode).toBe(200);
      expect(socialCard.headers['content-type']).toContain('image/png');
      expect(socialCard.headers['cache-control']).toContain('public');
      expect(socialCard.rawPayload.byteLength).toBeGreaterThan(1_000);
    } finally { await app.close(); }
  });
});
