import { marketSample, marketContract } from './rhMarketObservations';
import type { RhChainMarketSnapshot } from '../../src/services/rhChainMarketSnapshotService';
export const moverNow = '2026-10-13T15:00:00.000Z';
export const moverContract = marketContract;
export const moverPair = '0x' + 'a'.repeat(64);
export function moverSamples(contract = moverContract, pair = moverPair): RhChainMarketSnapshot[] {
  return Array.from({ length: 13 }, (_, i) => marketSample(`${contract}:${pair}:${i}`, new Date(Date.parse(moverNow) - (12 - i) * 5 * 60000).toISOString(), {
    token_address: contract, pair_address: pair, ticker: 'SAME', base_token: { address: contract, symbol: 'SAME', name: 'Fixture asset', decimals: 18 },
    quote_token: { address: '0x' + '9'.repeat(40), symbol: 'USD', name: 'Fixture quote', decimals: 6 },
    source_url: `https://dexscreener.com/robinhood/${pair}`, price_usd: 2 + i / 60, liquidity_usd: 10000 + i * 1000,
    volume_h1: 100 + i * 25, volume_h24: 20000 + i * 1000, txns_h24_buys: 10 + i, txns_h24_sells: 10 + i
  }));
}
