import { describe, expect, it } from 'vitest';
import { DexScreenerProvider } from '../src/providers/dexscreenerProvider';

const pair = (chainId: string, tokenAddress: string, symbol = 'SAME') => ({
  chainId, pairAddress: `pair-${tokenAddress}`, dexId: 'dex', url: `https://dex.example/${tokenAddress}`,
  baseToken: { address: tokenAddress, symbol }, liquidity: { usd: 100 }, volume: { h24: 20 }, txns: { h24: { buys: 2, sells: 1 } }, priceChange: { h24: 1 }
});

describe('RH Chain DEX Screener provider', () => {
  it('filters provider pairs to the robinhood chain id', async () => {
    const provider = new DexScreenerProvider({ enabled: true, fetchImpl: async () => new Response(JSON.stringify([pair('ethereum', '0xabc'), pair('robinhood', '0xabc')])) });
    const result = await provider.getTokenPairs('0xabc');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ chainId: 'robinhood', tokenAddress: '0xabc' });
  });

  it('uses exact contracts so ticker collisions cannot merge assets', async () => {
    const provider = new DexScreenerProvider({ enabled: true, fetchImpl: async () => new Response(JSON.stringify([pair('robinhood', '0xaaa', 'DUP'), pair('robinhood', '0xbbb', 'DUP')])) });
    const result = await provider.getTokenBatch(['0xaaa']);
    expect(Object.keys(result)).toEqual(['0xaaa']);
    expect(result['0xaaa']).toHaveLength(1);
    expect(result['0xaaa'][0].tokenAddress).toBe('0xaaa');
  });

  it('caps token batches at 30 addresses', async () => {
    const requests: string[] = [];
    const provider = new DexScreenerProvider({ enabled: true, fetchImpl: async (url) => { requests.push(String(url)); return new Response('[]'); } });
    await provider.getTokenBatch(Array.from({ length: 31 }, (_, index) => `0x${index}`));
    expect(requests).toHaveLength(2);
    expect(requests.every((url) => (url.split('/').at(-1)?.split(',').length ?? 0) <= 30)).toBe(true);
  });
});
