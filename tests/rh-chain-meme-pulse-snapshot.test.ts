import { describe, expect, it } from 'vitest';
import { InMemoryRhChainMemePulseSnapshotStore, RhChainMemePulseSnapshotService } from '../src/services/rhChainMemePulseSnapshotService';
import { RhChainLiveSnapshotService } from '../src/services/rhChainLiveSnapshotService';

describe('RH Meme Pulse snapshots', () => {
  it('uses CoinGecko and DexScreener data as contextual auto-observed entries', async () => {
    const live = new RhChainLiveSnapshotService({
      enabled: true, timeoutMs: 10,
      providers: {
        chainMetrics: async () => ({ tvl_usd: 1, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: '2026-07-15T10:00:00.000Z' }),
        memeCategory: async () => ({ market_cap_usd: 10, volume_24h_usd: 5, top_assets: [{ name: 'Context Cat', symbol: 'CAT', market_cap_usd: 10, volume_24h_usd: 5 }], source_timestamp: '2026-07-15T10:00:00.000Z' }),
        memePairs: async () => [{ contract: '0xcontextcat', chain_id: 'robinhood', ticker: 'CAT', name: 'Context Cat', pair_address: 'pair-1', liquidity_usd: 20, volume_24h_usd: 5, source_timestamp: '2026-07-15T10:00:00.000Z' }]
      }
    });
    const snapshot = await new RhChainMemePulseSnapshotService(new InMemoryRhChainMemePulseSnapshotStore(), live).refresh();
    const providerEntries = snapshot.pulse.top_attention_assets.filter((asset) => asset.context_origin === 'auto_observed');
    expect(providerEntries).toEqual(expect.arrayContaining([expect.objectContaining({ ticker: 'CAT', risk_state: 'source_required', receipt_state: 'source_required' })]));
    expect(providerEntries.some((asset) => asset.contract === '0xcontextcat')).toBe(true);
    expect(providerEntries.every((asset) => asset.infopunks_verdict.includes('context'))).toBe(true);
  });

  it('keeps reviewed memory ahead of provider-only entries', async () => {
    const live = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, providers: {
      chainMetrics: async () => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null }),
      memeCategory: async () => ({ market_cap_usd: 10, volume_24h_usd: 5, top_assets: [{ name: 'Provider only', symbol: 'NEW', market_cap_usd: 10, volume_24h_usd: 5 }], source_timestamp: '2026-07-15T10:00:00.000Z' }),
      memePairs: async () => []
    } });
    const snapshot = await new RhChainMemePulseSnapshotService(new InMemoryRhChainMemePulseSnapshotStore(), live).refresh();
    const firstProvider = snapshot.pulse.top_attention_assets.findIndex((asset) => asset.context_origin === 'auto_observed');
    const lastReviewed = snapshot.pulse.top_attention_assets.map((asset) => asset.context_origin).lastIndexOf('reviewed_memory');
    expect(firstProvider).toBeGreaterThan(lastReviewed);
  });

  it('keeps automated context free of buy or sell language', async () => {
    const live = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, providers: {
      chainMetrics: async () => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null }),
      memeCategory: async () => ({ market_cap_usd: 1, volume_24h_usd: 1, top_assets: [{ name: 'Neutral', symbol: 'NEUTRAL', market_cap_usd: 1, volume_24h_usd: 1 }], source_timestamp: null }),
      memePairs: async () => []
    } });
    const snapshot = await new RhChainMemePulseSnapshotService(new InMemoryRhChainMemePulseSnapshotStore(), live).refresh();
    const automatedCopy = snapshot.pulse.top_attention_assets.filter((asset) => asset.context_origin === 'auto_observed').map((asset) => `${asset.infopunks_verdict} ${asset.source.note ?? ''}`).join(' ');
    expect(automatedCopy).not.toMatch(/\b(buy|sell)\b/i);
  });

  it('marks provider context stale when cached providers can no longer refresh', async () => {
    let available = true;
    const live = new RhChainLiveSnapshotService({ enabled: true, timeoutMs: 10, ttlSeconds: 0, providers: {
      chainMetrics: async () => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null }),
      memeCategory: async () => { if (!available) throw new Error('provider_timeout'); return { market_cap_usd: 1, volume_24h_usd: 1, top_assets: [], source_timestamp: null }; },
      memePairs: async () => { if (!available) throw new Error('provider_timeout'); return []; }
    } });
    const service = new RhChainMemePulseSnapshotService(new InMemoryRhChainMemePulseSnapshotStore(), live);
    await service.refresh();
    available = false;
    const stale = await service.refresh();
    expect(stale.freshness_state).toBe('stale');
  });
});
