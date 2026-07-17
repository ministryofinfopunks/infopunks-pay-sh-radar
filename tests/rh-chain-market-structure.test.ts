import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import type { RhChainBoostObservation, RhChainDexScreenerIngestionSource, RhChainMarketSnapshot } from '../src/providers/dexscreenerProvider';
import { RhChainMarketDataService } from '../src/services/rhChainMarketDataService';
import { RhChainMarketStructureService, type RhChainLayerClassification } from '../src/services/rhChainMarketStructureService';
import { rhChainReviewedLayerClassifications } from '../src/data/rhChainMarketStructure';

const contract = '0x1111111111111111111111111111111111111111';
function pair(pairAddress: string, liquidity: number, volume: number): RhChainMarketSnapshot {
  return { provider: 'dexscreener', chainId: 'robinhood', capturedAt: '2026-07-17T00:00:00.000Z', tokenAddress: contract, quoteTokenSymbol: 'USDC', pairAddress, dexId: 'dex', priceUsd: 1, liquidityUsd: liquidity, marketCap: null, fdv: null, volume: { h24: volume }, txns: { h24: { buys: 3, sells: 2 } }, priceChange: { h1: null, h6: null, h24: null }, pairCreatedAt: '2026-07-01T00:00:00.000Z', activeBoosts: 0, paidOrders: [], dataMode: 'live_cached', sourceUrl: null };
}
function source(boosts: RhChainBoostObservation[] = []): RhChainDexScreenerIngestionSource {
  return { getLatestTokenProfiles: async () => [], getLatestCommunityTakeovers: async () => [], getLatestAds: async () => [], getLatestBoosts: async () => boosts, getTopBoosts: async () => boosts, getPaidOrders: async () => [], getTokenPairs: async () => [pair('secondary', 80, 1_000), pair('canonical', 100, 100)], getTokenBatch: async () => ({ [contract]: [pair('secondary', 80, 1_000), pair('canonical', 100, 100)] }), getPair: async () => pair('canonical', 100, 100) };
}
const reviewed: RhChainLayerClassification = { contract, ticker: 'COLLIDES', display_name: 'Collision test', dexscreener_pair: null, primary_layer: 'meme', secondary_layers: ['rwa'], cross_layer_category: null, classification_reason: 'Exact-contract manual review.', classification_source: 'manual_review', classification_confidence: 'high', evidence_state: 'reviewed', missing_evidence: [], caveat: null, reviewed_at: '2026-07-16T00:00:00.000Z', observed_at: '2026-07-17T00:00:00.000Z', data_mode: 'manual' };

describe('RH Chain 4663 Market Structure', () => {
  it('uses exact-contract reviewed layers and one canonical pair for volume estimates', async () => {
    const marketData = new RhChainMarketDataService({ enabled: true, provider: source(), knownTokenAddresses: () => [contract], classificationFor: () => ({ primary_layer: 'unclassified', secondary_layers: [], confidence: null, source: 'review_required' }) });
    const service = new RhChainMarketStructureService({ marketData, classifications: [reviewed] });
    const result = await service.marketStructure();
    expect(result.layer_leaders.find((item) => item.layer === 'meme')?.assets[0]).toMatchObject({ contract, canonical_pair: { pair_address: 'canonical', quote_token: 'USDC', volume_24h: 100 } });
    expect(result.market_pulse.layer_volume_estimates.find((item) => item.layer === 'meme')).toMatchObject({ label: 'classifier_estimate', caveat: 'not complete chain accounting', volume_24h: 100 });
  });

  it('does not merge a ticker collision into a reviewed contract', async () => {
    const marketData = new RhChainMarketDataService({ enabled: true, provider: source(), knownTokenAddresses: () => [contract] });
    const service = new RhChainMarketStructureService({ marketData, classifications: [{ ...reviewed, contract: '0xother' }] });
    const result = await service.marketStructure();
    expect(result.observed_coverage.classified_exact_contracts).toBe(1);
    expect(result.layer_leaders.find((item) => item.layer === 'meme')?.assets.some((asset) => asset.contract === contract)).toBe(false);
  });

  it('keeps boosted assets source_required until sufficient history exists', async () => {
    const boosts = [{ tokenAddress: contract, chainId: 'robinhood' as const, amount: 10, totalAmount: 50, observed_at: '2026-07-17T00:00:00.000Z', sourceUrl: null }];
    const marketData = new RhChainMarketDataService({ enabled: true, provider: source(boosts), knownTokenAddresses: () => [contract] });
    const result = await new RhChainMarketStructureService({ marketData, classifications: [reviewed] }).attentionQuality();
    expect(result.attention_quality[0]).toMatchObject({ state: 'source_required', score: null });
    expect(result.caveats.join(' ')).toMatch(/not misconduct|not organic conviction/i);
  });

  it('returns fallback market structure when a public provider is unavailable', async () => {
    const broken = source(); broken.getTokenBatch = async () => { throw new Error('down'); };
    const marketData = new RhChainMarketDataService({ enabled: true, provider: broken, knownTokenAddresses: () => [contract] });
    const result = await new RhChainMarketStructureService({ marketData, classifications: [reviewed] }).marketStructure();
    expect(result.data_mode).toBe('unavailable');
    expect(result.observed_coverage.tracked_exact_contracts).toBe(1);
    expect(result.layer_leaders.find((item) => item.layer === 'meme')?.assets[0]).toMatchObject({ contract, classification_source: 'manual_review' });
  });

  it('reuses reviewed campaign contracts without ticker inference or source-required downgrade', async () => {
    const marketData = new RhChainMarketDataService({ enabled: false, provider: source() });
    const result = await new RhChainMarketStructureService({ marketData, classifications: rhChainReviewedLayerClassifications }).marketStructure();
    const byTicker = new Map(result.layer_leaders.flatMap((group) => group.assets).map((asset) => [asset.ticker, asset]));
    expect(byTicker.get('CASHCAT')).toMatchObject({ primary_layer: 'meme', secondary_layers: ['distribution'], classification_source: 'manual_review', evidence_state: 'approved_signal' });
    expect(byTicker.get('PONS')).toMatchObject({ primary_layer: 'infrastructure', secondary_layers: ['launchpad', 'meme_distribution'], evidence_state: 'under_receipt_check' });
    expect(byTicker.get('ARROW')).toMatchObject({ primary_layer: 'defi', secondary_layers: ['utility_claim_under_review'], evidence_state: 'source_required' });
    expect(rhChainReviewedLayerClassifications.map((asset) => asset.contract)).toEqual(expect.arrayContaining([
      '0x020bfC650A365f8BB26819deAAbF3E21291018b4', '0x45242320DBB855EeA8Fd36804C6487E10E97FCF9', '0x39dBED3a2bd333467115dE45665cC57F813C4571', '0x8e62F281f282686fCa6dCB39288069a93fC23F1c', '0xf2915d1e3C1B0c769d0c756Ec43F1c1f6c99cD03'
    ]));
  });

  it('keeps reviewed-intake contracts and claim caveats separate from approval', async () => {
    const byContract = new Map(rhChainReviewedLayerClassifications.map((asset) => [asset.contract.toLowerCase(), asset]));
    const index = byContract.get('0x56910d4409f3a0c78c64dd8d0545ff0705389870');
    const ebess = byContract.get('0xca0da673a451c84917d7dd0362109efff0f8825a');
    const oracle = byContract.get('0x4b518240a5e520fc08916f0335460e0dd4057417');
    const grokius = byContract.get('0x0f2c5b7a7625c7b097759dd7165177d63fbb8b03');
    expect(index).toMatchObject({ display_name: 'The Index', primary_layer: 'rwa', secondary_layers: ['defi', 'speculative_distribution', 'tokenized_equities'], cross_layer_category: 'defi_x_rwa', evidence_state: 'under_receipt_check', classification_source: 'manual_review' });
    expect(index?.dexscreener_pair).toContain('/robinhood/');
    for (const asset of [ebess, oracle, grokius]) {
      expect(asset).toMatchObject({ classification_source: 'manual_review', evidence_state: 'source_required_for_claims' });
      expect(asset?.dexscreener_pair).toContain('/robinhood/');
      expect(asset?.missing_evidence.length).toBeGreaterThan(0);
      expect(asset?.caveat).toBeTruthy();
    }
    expect(grokius).toMatchObject({ primary_layer: 'meme', secondary_layers: ['ai_narrative'], cross_layer_category: 'meme_x_ai_narrative' });
  });

  it('places The Index in DeFi × RWA while labeling GROKIUS as AI narrative only', async () => {
    const marketData = new RhChainMarketDataService({ enabled: false, provider: source() });
    const entries = (await new RhChainMarketStructureService({ marketData, classifications: rhChainReviewedLayerClassifications }).crossLayer()).entries;
    expect(entries.find((entry) => entry.display_name === 'The Index')).toMatchObject({ category: 'defi_x_rwa', evidence_state: 'under_receipt_check' });
    expect(entries.find((entry) => entry.display_name === 'GROKIUS')).toMatchObject({ category: 'meme_x_ai_narrative', primary_layer: 'meme', caveat: expect.stringMatching(/does not prove agent activity/i) });
    expect(entries.some((entry) => entry.display_name === 'GROKIUS' && entry.category === 'agent_x_meme')).toBe(false);
    expect(rhChainReviewedLayerClassifications.some((asset) => asset.display_name === 'Benjamin’s Bread')).toBe(false);
  });

  it('exposes the three public, non-trading endpoints', async () => {
    const app = await createApp();
    try {
      for (const path of ['/v1/rh-chain/market-structure', '/v1/rh-chain/market-structure/cross-layer', '/v1/rh-chain/market-structure/attention-quality']) {
        const response = await app.inject({ method: 'GET', url: path });
        expect(response.statusCode).toBe(200);
        expect(JSON.stringify(response.json())).not.toMatch(/buy now|sell now|guaranteed return/i);
      }
    } finally { await app.close(); }
  });
});
