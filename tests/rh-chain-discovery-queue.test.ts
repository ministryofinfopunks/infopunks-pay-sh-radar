import { describe, expect, it } from 'vitest';
import { RhChainDiscoveryQueueService } from '../src/services/rhChainDiscoveryQueueService';
import { RhChainMarketDataService } from '../src/services/rhChainMarketDataService';
import type { RhChainDexScreenerIngestionSource, RhChainMarketSnapshot } from '../src/providers/dexscreenerProvider';

const ALPHA = '0x1111111111111111111111111111111111111111';
const BETA = '0x2222222222222222222222222222222222222222';
const GAMMA = '0x3333333333333333333333333333333333333333';
function pair(tokenAddress: string, pairAddress: string, liquidity: number, volume: number, createdAt: string): RhChainMarketSnapshot {
  return { provider: 'dexscreener', chainId: 'robinhood', capturedAt: '2026-07-17T00:00:00.000Z', tokenAddress, pairAddress, dexId: 'dex', priceUsd: 1, liquidityUsd: liquidity, marketCap: 10, fdv: 11, volume: { h24: volume }, txns: { h24: { buys: 3, sells: 2 } }, priceChange: { h1: null, h6: null, h24: null }, pairCreatedAt: createdAt, activeBoosts: 0, paidOrders: [], dataMode: 'live_cached', sourceUrl: `https://dexscreener.example/${pairAddress}` };
}
function provider(): RhChainDexScreenerIngestionSource {
  const pairs = { [ALPHA.toLowerCase()]: [pair(ALPHA, 'secondary', 100, 900, '2026-07-01T00:00:00.000Z'), pair(ALPHA, 'canonical', 200, 10, '2026-07-02T00:00:00.000Z')], [BETA.toLowerCase()]: [pair(BETA, 'beta', 20, 30, '2026-07-03T00:00:00.000Z')], [GAMMA.toLowerCase()]: [pair(GAMMA, 'gamma', 5, 3, '2026-07-04T00:00:00.000Z')] };
  return { getLatestTokenProfiles: async () => [{ tokenAddress: ALPHA, name: 'Grok signal', symbol: 'DUPE' }, { tokenAddress: BETA, name: 'Energy RWA', symbol: 'DUPE' }, { tokenAddress: GAMMA, name: 'Oracle data', symbol: 'ORC' }], getLatestCommunityTakeovers: async () => [], getLatestAds: async () => [], getLatestBoosts: async () => [{ tokenAddress: ALPHA.toLowerCase(), chainId: 'robinhood', amount: 7, totalAmount: 7, observed_at: '2026-07-17T00:00:00.000Z', sourceUrl: null }], getTopBoosts: async () => [{ tokenAddress: ALPHA.toLowerCase(), chainId: 'robinhood', amount: 5, totalAmount: 12, observed_at: '2026-07-17T00:00:00.000Z', sourceUrl: null }], getPaidOrders: async (contract) => contract.toLowerCase() === ALPHA.toLowerCase() ? [{ type: 'tokenProfile', status: 'approved', paymentTimestamp: null, observed_at: '2026-07-17T00:00:00.000Z', source: 'dexscreener_paid_attention' }] : [], getTokenPairs: async (contract) => pairs[contract.toLowerCase() as keyof typeof pairs] ?? [], getTokenBatch: async (contracts) => Object.fromEntries(contracts.map((contract) => [contract.toLowerCase(), pairs[contract.toLowerCase() as keyof typeof pairs] ?? []])), getPair: async () => null };
}
function queue() {
  const source = provider();
  const marketData = new RhChainMarketDataService({ enabled: true, provider: source });
  const tokenRegistry = { listObservedTokens: async () => ({ tokens: [], next_page_params: null, status: {}, caveats: [] }) };
  return new RhChainDiscoveryQueueService({ provider: source, marketData, tokenRegistry: tokenRegistry as never, now: () => new Date('2026-07-17T00:00:00.000Z') });
}

describe('RH Chain Auto Discovery Queue', () => {
  it('groups DEX pairs by exact contract and selects the canonical pair by liquidity', async () => {
    const payload = await queue().refresh();
    const alpha = payload.items.find((item) => item.contract === ALPHA.toLowerCase())!;
    expect(alpha.canonical_pair).toEqual(expect.objectContaining({ pair_address: 'canonical', liquidity_usd: 200 }));
    expect(alpha.secondary_pairs).toEqual([expect.objectContaining({ pair_address: 'secondary' })]);
    expect(alpha.active_boosts).toBe(12);
    expect(alpha.review_state).not.toBe('approved_signal');
  });

  it('does not merge duplicate ticker contracts and keeps paid attention as context', async () => {
    const payload = await queue().refresh();
    const alpha = payload.items.find((item) => item.contract === ALPHA.toLowerCase())!;
    const beta = payload.items.find((item) => item.contract === BETA.toLowerCase())!;
    expect(alpha.duplicate_ticker_contracts).toContain(BETA.toLowerCase());
    expect(beta.duplicate_ticker_contracts).toContain(ALPHA.toLowerCase());
    expect(alpha.paid_orders).toHaveLength(1);
    expect(alpha.review_state).toBe('duplicate_ticker_warning');
  });

  it('keeps narrative suggestions non-authoritative and supports watch, promotion, and ignore', async () => {
    const service = queue(); await service.refresh();
    const alpha = service.watch(ALPHA);
    expect(alpha).toMatchObject({ review_state: 'watch_only', suggested_layers: ['ai_narrative'] });
    expect(service.watchedContracts()).toContain(ALPHA.toLowerCase());
    const beta = service.promote(BETA, 'market_structure');
    expect(beta).toMatchObject({ review_state: 'promoted_to_market_structure' });
    expect(service.marketStructureCandidates()).toEqual(expect.arrayContaining([expect.objectContaining({ contract: BETA.toLowerCase(), evidence_state: 'source_required_for_claims' })]));
    service.ignore(GAMMA);
    expect(service.list().items.some((item) => item.contract === GAMMA.toLowerCase())).toBe(false);
  });

  it('keeps existing 100 Receipts memory ahead of auto-discovery state', async () => {
    const payload = await queue().refresh();
    const cashcat = payload.items.find((item) => item.symbol === 'CASHCAT')!;
    expect(cashcat.discovered_from).toContain('100_receipts');
    expect(cashcat.review_state).not.toBe('auto_discovered');
    expect(cashcat.caveats.join(' ')).toContain('reviewed memory');
  });
});
