import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { getRhChain4663Index, getRhChainDailyReceipts, getRhChainReviewQueue } from '../src/data/rhChain';
import { InMemoryRhChainMetricsSnapshotStore, RhChainChainPulseService } from '../src/services/rhChainChainPulseService';
import type { RhChainLiveSnapshot } from '../src/services/rhChainLiveSnapshotService';

const providerStatus = (status: 'fresh' | 'stale' | 'unavailable' | 'disabled') => [
  { provider_name: 'DefiLlama' as const, status, fetched_at: '2026-07-15T10:00:00.000Z', expires_at: '2026-07-15T10:05:00.000Z' },
  { provider_name: 'CoinGecko' as const, status: 'unavailable' as const, fetched_at: null, expires_at: null },
  { provider_name: 'DexScreener' as const, status: 'unavailable' as const, fetched_at: null, expires_at: null },
  { provider_name: 'Blockscout' as const, status: 'unavailable' as const, fetched_at: null, expires_at: null }
];

function live(status: 'fresh' | 'unavailable'): RhChainLiveSnapshot {
  return {
    title: 'RH Chain Live Snapshot', generated_at: '2026-07-15T10:00:00.000Z', live_snapshots_enabled: true, judgment_policy: 'Context only.', disclaimer: 'Context only.', cache_status: status,
    chain_metrics: status === 'fresh'
      ? { tvl_usd: 1_000_000, dex_volume_24h_usd: 250_000, stablecoin_market_cap_usd: 800_000, fees_24h_usd: 1_200, top_protocols: [{ name: 'Example protocol', category: 'dex', tvl_usd: 250_000, value: 250_000, scope: 'rh_chain', metric_scope: 'rh_chain', display_note: 'Provider explicitly scoped this protocol TVL to Robinhood Chain.' }], protocol_count: 1, source_timestamp: '2026-07-15T09:58:00.000Z', freshness: 'live_cached' }
      : { tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, fees_24h_usd: null, top_protocols: [], protocol_count: null, source_timestamp: null, freshness: 'unavailable' },
    meme_category: { market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null, freshness: 'unavailable' },
    provider_statuses: providerStatus(status)
  };
}

describe('RH Chain Pulse snapshots', () => {
  it('stores normalized DefiLlama chain context on provider success', async () => {
    const store = new InMemoryRhChainMetricsSnapshotStore();
    const pulse = new RhChainChainPulseService(store, () => new Date('2026-07-15T10:00:00.000Z'));
    const snapshot = await pulse.refresh(live('fresh'));
    expect(snapshot).toMatchObject({ tvl: 1_000_000, dex_volume_24h: 250_000, stablecoin_market_cap: 800_000, fees_24h: 1_200, freshness_state: 'fresh', observed_at: '2026-07-15T09:58:00.000Z', data_mode: 'cached' });
    expect(snapshot.top_protocols).toEqual([expect.objectContaining({ name: 'Example protocol', value: 250_000, scope: 'rh_chain', metric_scope: 'rh_chain' })]);
    expect(await store.latest()).toEqual(snapshot);
  });

  it('keeps the last provider snapshot as visibly stale when the provider is unavailable', async () => {
    const store = new InMemoryRhChainMetricsSnapshotStore();
    const pulse = new RhChainChainPulseService(store, () => new Date('2026-07-15T10:05:00.000Z'));
    await pulse.refresh(live('fresh'));
    const stale = await pulse.refresh(live('unavailable'));
    expect(stale).toMatchObject({ tvl: 1_000_000, freshness_state: 'stale', confidence_level: 'low' });
    expect(stale.source_notes.at(-1)).toContain('unavailable');
  });

  it('renders source-stamped pulse metrics through the primary RH Chain API', async () => {
    const store = new InMemoryRhChainMetricsSnapshotStore();
    const pulse = new RhChainChainPulseService(store, () => new Date('2026-07-15T10:00:00.000Z'));
    await pulse.refresh(live('fresh'));
    const app = await createApp(undefined, undefined, { rhChainMetricsSnapshotStore: store });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.chain_pulse).toEqual(expect.objectContaining({ observed_at: '2026-07-15T09:58:00.000Z', fetched_at: '2026-07-15T10:00:00.000Z', freshness_state: 'fresh' }));
      expect(response.json().data.chain_pulse.metrics).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'tvl', value: '$1,000,000', metric_scope: 'rh_chain', source: expect.objectContaining({ observed_at: '2026-07-15T09:58:00.000Z' }) }),
        expect.objectContaining({ id: 'fees_24h', value: '$1,200', metric_scope: 'rh_chain' })
      ]));
    } finally { await app.close(); }
  });

  it('never promotes global protocol TVL to RH Chain protocol TVL', async () => {
    const unsafe = live('fresh');
    unsafe.chain_metrics.top_protocols = [{ name: 'Global giant', category: 'dex', tvl_usd: 9_000_000, value: 9_000_000, scope: 'global_or_unknown', metric_scope: 'global_context', display_note: 'Global TVL.' }];
    const store = new InMemoryRhChainMetricsSnapshotStore();
    const pulse = new RhChainChainPulseService(store, () => new Date('2026-07-15T10:00:00.000Z'));
    const snapshot = await pulse.refresh(unsafe);
    expect(snapshot.top_protocols[0]).toEqual(expect.objectContaining({ tvl: null, value: 'source_required', scope: 'global_or_unknown', metric_scope: 'source_required', display_note: 'Chain-specific protocol TVL not verified.' }));

    const app = await createApp(undefined, undefined, { rhChainMetricsSnapshotStore: store });
    try {
      const protocol = (await app.inject({ method: 'GET', url: '/v1/rh-chain' })).json().data.chain_pulse.top_protocols[0];
      expect(protocol).toEqual(expect.objectContaining({ value: 'source_required', scope: 'global_or_unknown', metric_scope: 'source_required' }));
      expect(protocol.note).not.toContain('$9,000,000');
    } finally { await app.close(); }
  });

  it('downgrades unknown and legacy cached protocol scope to source_required', async () => {
    const store = new InMemoryRhChainMetricsSnapshotStore();
    const unsafe = live('fresh');
    unsafe.chain_metrics.top_protocols = [{ name: 'Legacy protocol', category: 'lending', tvl_usd: 4_000_000 } as never];
    const normalized = await new RhChainChainPulseService(new InMemoryRhChainMetricsSnapshotStore(), () => new Date('2026-07-15T10:00:00.000Z')).refresh(unsafe);
    expect(normalized.top_protocols[0]).toEqual(expect.objectContaining({ value: 'source_required', scope: 'global_or_unknown' }));
    await store.save({ ...normalized, top_protocols: [{ name: 'Legacy protocol', category: 'lending', tvl: 4_000_000 } as never] });
    const cached = await new RhChainChainPulseService(store).getLatest();
    expect(cached?.top_protocols[0]).toEqual(expect.objectContaining({ tvl: null, value: 'source_required', scope: 'global_or_unknown', metric_scope: 'source_required' }));
  });

  it('does not mutate review, index, or receipt memory when provider data is unavailable', async () => {
    const before = structuredClone({ review: getRhChainReviewQueue(), index: getRhChain4663Index(), receipts: getRhChainDailyReceipts() });
    const pulse = new RhChainChainPulseService(new InMemoryRhChainMetricsSnapshotStore());
    await pulse.refresh(live('unavailable'));
    expect({ review: getRhChainReviewQueue(), index: getRhChain4663Index(), receipts: getRhChainDailyReceipts() }).toEqual(before);
  });
});
