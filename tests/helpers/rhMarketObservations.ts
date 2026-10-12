import type { RhChainDexScreenerIngestionSource, RhChainMarketSnapshot as DexSnapshot } from '../../src/providers/dexscreenerProvider';
import type { RhChainMarketSnapshot } from '../../src/services/rhChainMarketSnapshotService';

export const marketContract = '0x1111111111111111111111111111111111111111';
export const marketTime = '2026-10-12T00:05:00.000Z';
export function marketPair(overrides: Partial<DexSnapshot> = {}): DexSnapshot {
  return {
    provider: 'dexscreener', chainId: 'robinhood', capturedAt: marketTime, tokenAddress: marketContract,
    baseToken: { address: marketContract, name: 'Shared symbol', symbol: 'SAME', decimals: 18 },
    pairAddress: '0x' + 'a'.repeat(40), dexId: 'uniswap', priceUsd: 1, liquidityUsd: 1000, marketCap: null, fdv: null,
    volume: { h24: 300, h6: 90, h1: 10 }, txns: { h24: { buys: 5, sells: 2 } },
    priceChange: { h1: null, h6: null, h24: 5 }, pairCreatedAt: null, activeBoosts: 0, paidOrders: [],
    dataMode: 'live_cached', freshness: 'fresh', sourceUrl: 'https://dexscreener.com/robinhood/example',
    ...overrides
  };
}
export function marketProvider(overrides: Partial<RhChainDexScreenerIngestionSource> = {}): RhChainDexScreenerIngestionSource {
  return {
    getLatestTokenProfiles: async () => [], getLatestCommunityTakeovers: async () => [], getLatestAds: async () => [],
    getLatestBoosts: async () => [], getTopBoosts: async () => [], getPaidOrders: async () => [],
    getTokenPairs: async () => [marketPair()], getPair: async () => marketPair(),
    getTokenBatch: async (contracts) => Object.fromEntries(contracts.map((address) => [address, [marketPair({ tokenAddress: address, baseToken: { address, name: 'Shared symbol', symbol: 'SAME', decimals: 18 } })]])),
    ...overrides
  };
}
export function marketSample(id: string, captured_at = marketTime, overrides: Partial<RhChainMarketSnapshot> = {}): RhChainMarketSnapshot {
  return {
    snapshot_id: id, captured_at, provider: 'dexscreener', chain_id: 'robinhood', token_address: marketContract,
    ticker: null, pair_address: '0x' + 'a'.repeat(40), dex_id: 'uniswap',
    price_usd: 1, liquidity_usd: 1000, market_cap: null, fdv: null, volume_h24: 300, volume_h6: 90, volume_h1: 10,
    txns_h24_buys: 5, txns_h24_sells: 2, txns_h6_buys: null, txns_h6_sells: null,
    price_change_h24: 5, pair_created_at: null, active_boosts: 0, paid_order_types: [], paid_order_statuses: [],
    data_mode: 'live_cached', source_url: 'https://dexscreener.com/robinhood/example', provider_timestamp: null, ...overrides
  };
}
