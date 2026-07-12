import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { isExactRhChainContractMatch, RhChainLiveSnapshotService, validateRhChainSourceTimestamp } from '../src/services/rhChainLiveSnapshotService';

const metrics = { tvl_usd: 1000, dex_volume_24h_usd: 200, stablecoin_market_cap_usd: 300, protocol_count: 4, source_timestamp: '2026-07-11T00:00:00.000Z' };
const category = { market_cap_usd: 900, volume_24h_usd: 80, top_assets: [{ name: 'Example', symbol: 'EX', market_cap_usd: 900, volume_24h_usd: 80 }], source_timestamp: '2026-07-11T00:00:00.000Z' };

describe('RH Chain Live Snapshot Layer', () => {
  it('returns disabled provider statuses without calling providers', async () => {
    const chainMetrics = vi.fn(async () => metrics);
    const service = new RhChainLiveSnapshotService({ enabled: false, timeoutMs: 10, providers: { chainMetrics } });
    const snapshot = await service.getLiveSnapshot();
    expect(snapshot.cache_status).toBe('disabled');
    expect(snapshot.provider_statuses.every((provider) => provider.status === 'disabled')).toBe(true);
    expect(chainMetrics).not.toHaveBeenCalled();
  });

  it('caches provider responses and serves a cache hit', async () => {
    const chainMetrics = vi.fn(async () => metrics);
    const memeCategory = vi.fn(async () => category);
    const service = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, providers: { chainMetrics, memeCategory } });
    await service.getLiveSnapshot();
    const second = await service.getLiveSnapshot();
    expect(chainMetrics).toHaveBeenCalledTimes(1);
    expect(memeCategory).toHaveBeenCalledTimes(1);
    expect(second.chain_metrics.tvl_usd).toBe(1000);
    expect(second.provider_statuses.find((provider) => provider.provider_name === 'DefiLlama')?.status).toBe('fresh');
  });

  it('isolates provider failures and preserves a usable provider snapshot', async () => {
    const service = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, providers: { chainMetrics: async () => metrics, memeCategory: async () => { throw new Error('timeout'); } } });
    const snapshot = await service.getLiveSnapshot();
    expect(snapshot.chain_metrics.tvl_usd).toBe(1000);
    expect(snapshot.provider_statuses.find((provider) => provider.provider_name === 'CoinGecko')).toEqual(expect.objectContaining({ status: 'unavailable', error_summary: 'timeout' }));
  });

  it('renders unavailable provider results as typed, non-decision context', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainLiveSnapshotOptions: { enabled: true, timeoutMs: 10, providers: {
      chainMetrics: async () => { throw new Error('provider_http_503'); }, memeCategory: async () => { throw new Error('timeout'); },
      tokenPair: async () => { throw new Error('token_pair_not_found'); }, explorer: async () => { throw new Error('blockscout_endpoint_not_configured'); }
    } } });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/live-snapshot/token/0xmissing' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({ token_pair: null, explorer: null, cache_status: 'unavailable', provider_statuses: expect.arrayContaining([expect.objectContaining({ provider_name: 'DexScreener', status: 'unavailable', error: expect.objectContaining({ code: 'provider_contract_mismatch' }) })]) }));
    } finally { await app.close(); }
  });

  it('requires exact contract equality and drops invalid source timestamps', () => {
    expect(isExactRhChainContractMatch('0xAbC', '0xabc')).toBe(true);
    expect(isExactRhChainContractMatch('0xAbC', '0xdef')).toBe(false);
    expect(validateRhChainSourceTimestamp('not-a-date')).toBeNull();
    expect(validateRhChainSourceTimestamp('2999-01-01T00:00:00.000Z')).toBeNull();
  });

  it('returns live snapshot and token lookup API envelopes through injected providers', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainLiveSnapshotOptions: { enabled: true, timeoutMs: 10, providers: {
      chainMetrics: async () => metrics, memeCategory: async () => category,
      tokenPair: async () => ({ pair_address: 'pair-1', dex_url: 'https://dexscreener.com/pair-1', liquidity_usd: 44, volume_24h_usd: 22, fdv_usd: 99, market_cap_usd: 88, pair_created_at: '2026-07-11T00:00:00.000Z', source_timestamp: '2026-07-11T00:00:00.000Z' }),
      explorer: async () => ({ explorer_url: 'https://explorer.example/address/0xabc', contract_verified: null, deployer_address: null, source_timestamp: '2026-07-11T00:00:00.000Z' })
    } } });
    try {
      const summary = await app.inject({ method: 'GET', url: '/v1/rh-chain/live-snapshot' });
      const token = await app.inject({ method: 'GET', url: '/v1/rh-chain/live-snapshot/token/0xabc' });
      expect(summary.statusCode).toBe(200);
      expect(summary.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ title: 'RH Chain Live Snapshot', chain_metrics: expect.objectContaining({ tvl_usd: 1000 }) }), data_mode: 'live_cached', disclaimer: expect.any(String) }));
      expect(summary.json().data.judgment_policy).toContain('Live data never overrides human-reviewed receipts');
      expect(summary.json().data).not.toHaveProperty('review_state');
      expect(token.json().data.token_pair).toEqual(expect.objectContaining({ pair_address: 'pair-1', liquidity_usd: 44 }));
      expect(token.json().data.explorer).toEqual(expect.objectContaining({ explorer_url: expect.stringContaining('explorer.example') }));
    } finally { await app.close(); }
  });
});
