import { describe, expect, it } from 'vitest';
import { DexScreenerProvider, DexScreenerProviderError } from '../src/providers/dexscreenerProvider';

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

  it('validates and normalizes pair metadata with cache provenance', async () => {
    const provider = new DexScreenerProvider({ enabled: true, fetchImpl: async () => new Response(JSON.stringify([{
      ...pair('robinhood', '0xabc', 'BASE'), labels: ['v3'], quoteToken: { address: '0xquote', name: 'Quote', symbol: 'USD', decimals: 6 },
      baseToken: { address: '0xabc', name: 'Base', symbol: 'BASE', decimals: '18' }, priceUsd: '1.25', fdv: 500,
      marketCap: '400', pairCreatedAt: 1_700_000_000_000, updatedAt: '2026-07-19T01:00:00.000Z',
      info: { websites: [{ label: 'Site', url: 'https://example.com' }], socials: [{ type: 'twitter', url: 'https://x.com/example' }] }
    }])) });
    const [result] = await provider.getTokenPairs('0xabc');
    expect(result).toMatchObject({
      baseToken: { address: '0xabc', name: 'Base', symbol: 'BASE', decimals: 18 }, quoteToken: { address: '0xquote', symbol: 'USD' },
      pairLabels: ['v3'], priceUsd: 1.25, fdv: 500, marketCap: 400, providerTimestamp: '2026-07-19T01:00:00.000Z',
      freshness: 'fresh', rawDataVersion: 'dexscreener-v1', cache: { status: 'miss', provenance: 'dexscreener-memory-cache' },
      websites: [{ label: 'Site', url: 'https://example.com' }], socials: [{ type: 'twitter', url: 'https://x.com/example' }]
    });
  });

  it('aborts timed-out requests and returns a structured safe error', async () => {
    const provider = new DexScreenerProvider({ enabled: true, timeoutMs: 5, maxRetries: 0, rateLimitPerSecond: 100, fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }) });
    const error = await provider.getLatestBoosts().catch((value) => value);
    expect(error).toBeInstanceOf(DexScreenerProviderError);
    expect(error).toMatchObject({ code: 'timeout', retryable: true, message: 'dexscreener_timeout' });
  });

  it('retries bounded 5xx failures and succeeds without exposing response bodies', async () => {
    let calls = 0;
    const provider = new DexScreenerProvider({ enabled: true, maxRetries: 2, retryBaseMs: 1, rateLimitPerSecond: 100, sleep: async () => undefined, random: () => 0, fetchImpl: async () => {
      calls += 1;
      return calls < 3 ? new Response('private upstream detail', { status: 503 }) : new Response('[]');
    } });
    await expect(provider.getLatestBoosts()).resolves.toEqual([]);
    expect(calls).toBe(3);
    expect(provider.getHealth()).toMatchObject({ healthy: true, rollingFailureCount: 0 });
  });

  it('honors 429 retryability but never retries permanent 4xx failures', async () => {
    let rateLimitedCalls = 0;
    const rateLimited = new DexScreenerProvider({ enabled: true, maxRetries: 1, retryBaseMs: 1, rateLimitPerSecond: 100, sleep: async () => undefined, fetchImpl: async () => {
      rateLimitedCalls += 1;
      return rateLimitedCalls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '0' } }) : new Response('[]');
    } });
    await expect(rateLimited.getLatestBoosts()).resolves.toEqual([]);
    expect(rateLimitedCalls).toBe(2);

    let permanentCalls = 0;
    const permanent = new DexScreenerProvider({ enabled: true, maxRetries: 2, rateLimitPerSecond: 100, sleep: async () => undefined, fetchImpl: async () => { permanentCalls += 1; return new Response('', { status: 404 }); } });
    await expect(permanent.getLatestBoosts()).rejects.toMatchObject({ code: 'invalid_request', retryable: false, statusCode: 404 });
    expect(permanentCalls).toBe(1);
  });

  it('rejects malformed external payloads at the provider boundary', async () => {
    const provider = new DexScreenerProvider({ enabled: true, maxRetries: 0, fetchImpl: async () => new Response(JSON.stringify([{ chainId: 'robinhood', pairAddress: 42 }])) });
    await expect(provider.getTokenPairs('0xabc')).rejects.toMatchObject({ code: 'invalid_payload', retryable: false });
  });

  it('serves bounded stale provider data after an upstream error and marks health degraded', async () => {
    let calls = 0;
    const provider = new DexScreenerProvider({ enabled: true, cacheTtlSeconds: 0.001, staleWhileRevalidateSeconds: 0, staleIfErrorSeconds: 1, maxStaleSeconds: 1, maxRetries: 0, rateLimitPerSecond: 100, fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? new Response(JSON.stringify([pair('robinhood', '0xabc')])) : new Response('', { status: 503 });
    } });
    await provider.getTokenPairs('0xabc');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const [stale] = await provider.getTokenPairs('0xabc');
    expect(stale).toMatchObject({ freshness: 'stale', cache: { status: 'stale_if_error' } });
    expect(provider.getHealth()).toMatchObject({ degraded: true, rollingFailureCount: 1, activeCacheStatus: 'stale_if_error', currentFreshness: 'stale' });
  });

  it('bounds upstream concurrency across provider capabilities', async () => {
    let active = 0;
    let maximum = 0;
    const provider = new DexScreenerProvider({ enabled: true, maxConcurrency: 2, rateLimitPerSecond: 100, sleep: async () => undefined, fetchImpl: async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response('[]');
    } });
    await Promise.all([provider.getLatestBoosts(), provider.getTopBoosts(), provider.getLatestTokenProfiles(), provider.getLatestCommunityTakeovers()]);
    expect(maximum).toBe(2);
  });
});
