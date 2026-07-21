import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, liveTokenRouteBudgets } from '../src/api/app';
import { BlockscoutProvider } from '../src/providers/blockscoutProvider';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { RhChainLiveSnapshotService, type RhChainCacheEntry, type RhChainLiveProviderClient } from '../src/services/rhChainLiveSnapshotService';
import { InMemoryRhChainSnapshotCache } from '../src/services/rhChainSnapshotCache';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const NOW = '2026-07-21T08:00:00.000Z';
const pair = {
  observed_contract: CONTRACT,
  observed_chain_id: 'robinhood',
  pair_address: '0xpair',
  dex_url: 'https://dexscreener.example/pair',
  liquidity_usd: 44,
  volume_24h_usd: 22,
  fdv_usd: null,
  market_cap_usd: null,
  pair_created_at: null,
  source_timestamp: NOW
};
const explorer = {
  observed_contract: CONTRACT,
  explorer_url: `https://explorer.example/address/${CONTRACT}`,
  contract_exists: true,
  contract_verified: false,
  deployer_address: null,
  contract_type: 'contract',
  source_timestamp: NOW
};
type TokenPairResult = Awaited<ReturnType<RhChainLiveProviderClient['tokenPair']>>;
type ExplorerResult = Awaited<ReturnType<RhChainLiveProviderClient['explorer']>>;

function aborted<T>(context?: { signal?: AbortSignal }): Promise<T> {
  return new Promise((_resolve, reject) => {
    if (context?.signal?.aborted) return reject(context.signal.reason);
    context?.signal?.addEventListener('abort', () => reject(context.signal?.reason), { once: true });
  });
}

function service(options: { cache?: InMemoryRhChainSnapshotCache; tokenPair?: RhChainLiveProviderClient['tokenPair']; explorer?: RhChainLiveProviderClient['explorer']; timeoutMs?: number } = {}) {
  return new RhChainLiveSnapshotService({
    enabled: true,
    timeoutMs: options.timeoutMs ?? 40,
    cache: options.cache,
    providers: {
      tokenPair: options.tokenPair ?? (async () => pair),
      explorer: options.explorer ?? (async () => explorer)
    }
  });
}

async function advance<T>(promise: Promise<T>, milliseconds: number) {
  await vi.advanceTimersByTimeAsync(milliseconds);
  return promise;
}

describe('RH Chain Live Snapshot token request deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the internal route budget below the production smoke deadline', () => {
    expect(liveTokenRouteBudgets(3_800, 9_000)).toEqual({ totalMs: 3_800, providerMs: 2_800, contextReadMs: 800, cacheReadMs: 300 });
  });

  it('returns complete fast-provider data with provenance and freshness intact', async () => {
    const snapshot = await service().getTokenSnapshot(CONTRACT);
    expect(snapshot).toEqual(expect.objectContaining({ response_status: 'complete', cache_status: 'fresh', warnings: [] }));
    expect(snapshot.token_pair).toEqual(expect.objectContaining({ liquidity_usd: 44, freshness: 'live_cached', exact_contract_match: true }));
    expect(snapshot.explorer).toEqual(expect.objectContaining({ contract_verified: false, freshness: 'live_cached', exact_contract_match: true }));
    expect(snapshot.provider_statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider_name: 'DexScreener', status: 'fresh', fetched_at: NOW }),
      expect.objectContaining({ provider_name: 'Blockscout', status: 'fresh', fetched_at: NOW })
    ]));
  });

  it('returns completed provider data when one provider is slow', async () => {
    const explorerCall = vi.fn<RhChainLiveProviderClient['explorer']>((_contract, context) => aborted<ExplorerResult>(context));
    const pending = service({ explorer: explorerCall }).getTokenSnapshot(CONTRACT, { providerTimeoutMs: 25 });
    const snapshot = await advance(pending, 26);
    expect(snapshot.response_status).toBe('partial');
    expect(snapshot.token_pair).toEqual(expect.objectContaining({ liquidity_usd: 44 }));
    expect(snapshot.explorer).toBeNull();
    expect(snapshot.provider_statuses.find((item) => item.provider_name === 'Blockscout')).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: 'provider_timeout' }) }));
    expect(explorerCall).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable rather than zero when multiple providers are slow', async () => {
    const tokenPair = vi.fn<RhChainLiveProviderClient['tokenPair']>((_contract, context) => aborted<TokenPairResult>(context));
    const slowExplorer = vi.fn<RhChainLiveProviderClient['explorer']>((_contract, context) => aborted<ExplorerResult>(context));
    const pending = service({ tokenPair, explorer: slowExplorer }).getTokenSnapshot(CONTRACT, { providerTimeoutMs: 30 });
    const snapshot = await advance(pending, 31);
    expect(snapshot.response_status).toBe('unavailable');
    expect(snapshot.token_pair).toBeNull();
    expect(snapshot.explorer).toBeNull();
    expect(snapshot.cache_status).toBe('unavailable');
    expect(JSON.stringify(snapshot)).not.toContain('liquidity_usd":0');
  });

  it('aborts provider work and never retries after the provider budget expires', async () => {
    let observedSignal: AbortSignal | undefined;
    const tokenPair = vi.fn<RhChainLiveProviderClient['tokenPair']>((_contract, context) => {
      observedSignal = context?.signal;
      return aborted<TokenPairResult>(context);
    });
    const pending = service({ tokenPair }).getTokenSnapshot(CONTRACT, { providerTimeoutMs: 20 });
    await advance(pending, 21);
    expect(observedSignal?.aborted).toBe(true);
    expect(tokenPair).toHaveBeenCalledTimes(1);
  });

  it('returns deterministic no-data and uses only a short negative cache', async () => {
    const tokenPair = vi.fn(async () => { throw new Error('provider_contract_mismatch'); });
    const get = service({ tokenPair, explorer: async () => { throw new Error('provider_http_404'); } });
    const first = await get.getTokenSnapshot(CONTRACT);
    const second = await get.getTokenSnapshot(CONTRACT);
    expect(first.response_status).toBe('unavailable');
    expect(second.response_status).toBe('unavailable');
    expect(tokenPair).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_001);
    await get.getTokenSnapshot(CONTRACT);
    expect(tokenPair).toHaveBeenCalledTimes(2);
  });

  it('treats a provider pairs:null payload as deterministic no-data', async () => {
    const providerFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ pairs: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const get = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 40 });
    expect((await get.getTokenSnapshot(CONTRACT)).token_pair).toBeNull();
    expect((await get.getTokenSnapshot(CONTRACT)).token_pair).toBeNull();
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh cache without calling providers', async () => {
    const cache = new InMemoryRhChainSnapshotCache();
    await cache.set(`dexscreener:token:${CONTRACT}`, entry('DexScreener', pair, 60_000), 60_000);
    await cache.set(`blockscout:token:${CONTRACT}`, entry('Blockscout', explorer, 60_000), 60_000);
    const tokenPair = vi.fn(async () => pair);
    const explorerCall = vi.fn(async () => explorer);
    const snapshot = await service({ cache, tokenPair, explorer: explorerCall }).getTokenSnapshot(CONTRACT);
    expect(snapshot.response_status).toBe('complete');
    expect(tokenPair).not.toHaveBeenCalled();
    expect(explorerCall).not.toHaveBeenCalled();
  });

  it('serves stale cache immediately and bounds refresh work in the background', async () => {
    const cache = new InMemoryRhChainSnapshotCache();
    await cache.set(`dexscreener:token:${CONTRACT}`, entry('DexScreener', pair, -1_000), 60_000);
    await cache.set(`blockscout:token:${CONTRACT}`, entry('Blockscout', explorer, -1_000), 60_000);
    const tokenPair = vi.fn<RhChainLiveProviderClient['tokenPair']>((_contract, context) => aborted<TokenPairResult>(context));
    const explorerCall = vi.fn<RhChainLiveProviderClient['explorer']>((_contract, context) => aborted<ExplorerResult>(context));
    const snapshot = await service({ cache, tokenPair, explorer: explorerCall, timeoutMs: 25 }).getTokenSnapshot(CONTRACT);
    expect(snapshot.cache_status).toBe('stale');
    expect(snapshot.token_pair).toEqual(expect.objectContaining({ liquidity_usd: 44, freshness: 'stale' }));
    expect((snapshot.warnings ?? []).join(' ')).toContain('stale cache');
    await vi.advanceTimersByTimeAsync(26);
    expect(tokenPair).toHaveBeenCalledTimes(1);
    expect(explorerCall).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests for the same contract', async () => {
    const tokenPair = vi.fn(() => new Promise<typeof pair>((resolve) => setTimeout(() => resolve(pair), 15)));
    const get = service({ tokenPair, timeoutMs: 100 });
    const first = get.getTokenSnapshot(CONTRACT);
    const second = get.getTokenSnapshot(CONTRACT);
    await vi.advanceTimersByTimeAsync(16);
    await Promise.all([first, second]);
    expect(tokenPair).toHaveBeenCalledTimes(1);
  });

  it('does not cache malformed provider payloads', async () => {
    const tokenPair = vi.fn(async () => null as never);
    const get = service({ tokenPair });
    expect((await get.getTokenSnapshot(CONTRACT)).token_pair).toBeNull();
    expect((await get.getTokenSnapshot(CONTRACT)).token_pair).toBeNull();
    expect(tokenPair).toHaveBeenCalledTimes(2);
  });

  it('observes late provider rejection without an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const tokenPair = vi.fn(() => new Promise<typeof pair>((_resolve, reject) => setTimeout(() => reject(new Error('late_failure')), 50)));
      const pending = service({ tokenPair }).getTokenSnapshot(CONTRACT, { providerTimeoutMs: 10 });
      await vi.advanceTimersByTimeAsync(11);
      await pending;
      await vi.advanceTimersByTimeAsync(50);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('preserves the response envelope while the route returns a bounded partial response', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, {
      rhChainLiveTokenRouteTimeoutMs: 60,
      rhChainLiveSnapshotOptions: {
        enabled: true,
        timeoutMs: 40,
        providers: {
          tokenPair: async () => pair,
          explorer: (_contract, context) => aborted<ExplorerResult>(context)
        }
      }
    });
    try {
      const pending = app.inject({ method: 'GET', url: `/v1/rh-chain/live-snapshot/token/${CONTRACT}` });
      await vi.advanceTimersByTimeAsync(45);
      const response = await pending;
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({
        data: expect.objectContaining({ contract: CONTRACT, response_status: 'partial', token_pair: expect.objectContaining({ liquidity_usd: 44 }), explorer: null }),
        data_mode: 'live_cached',
        disclaimer: expect.any(String)
      }));
    } finally {
      await app.close();
    }
  });

  it('bounds optional Blockscout dossier enrichment with the shared route budget', async () => {
    const blockscout = new BlockscoutProvider({
      enabled: true,
      timeoutMs: 10_000,
      fetchImpl: (_input, init) => aborted<Response>({ signal: init?.signal ?? undefined })
    });
    const app = await createApp(emptyIntelligenceStore(), undefined, {
      rhChainLiveTokenRouteTimeoutMs: 60,
      rhChainLiveSnapshotOptions: {
        enabled: true,
        timeoutMs: 40,
        providers: {
          chainMetrics: async () => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null }),
          memeCategory: async () => ({ market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null }),
          tokenPair: async () => pair,
          explorer: async () => explorer
        }
      },
      rhChainTokenRegistryOptions: { enabled: true, provider: blockscout }
    });
    try {
      const pending = app.inject({ method: 'GET', url: `/v1/rh-chain/tokens/${CONTRACT}/dossier` });
      await vi.advanceTimersByTimeAsync(61);
      const response = await pending;
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({
        data: expect.objectContaining({
          contract: CONTRACT,
          response_status: 'partial',
          warnings: ['Blockscout token enrichment exceeded its bounded provider budget.'],
          external_context: expect.objectContaining({ token_pair: expect.objectContaining({ liquidity_usd: 44 }) })
        })
      }));
    } finally {
      await app.close();
    }
  });
});

function entry<T>(provider_name: 'DexScreener' | 'Blockscout', value: T, expiresInMs: number): RhChainCacheEntry<T> {
  return {
    cache_key: `${provider_name}:${CONTRACT}`,
    value,
    fetched_at: new Date(Date.parse(NOW) - 10_000).toISOString(),
    expires_at: new Date(Date.parse(NOW) + expiresInMs).toISOString(),
    provider_name,
    status: 'fresh'
  };
}
