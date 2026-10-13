import { describe, expect, it, vi, afterEach } from 'vitest';
import { Rh4663FrontdoorService, type Rh4663FrontdoorDependencies } from '../src/services/rh4663FrontdoorService';
import { RhChainCategoryIntelligenceService } from '../src/services/rhChainCategoryIntelligenceService';
import { deriveRhChainMarketMovers } from '../src/services/rhChainMarketMoversService';
import { moverSamples, moverContract as contract, moverNow } from './helpers/rhMoverObservations';
import { createApp } from '../src/api/app';
import { InMemoryRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { InMemoryReflexiveStore } from '../src/services/rhChainReflexiveRadarService';

afterEach(() => vi.restoreAllMocks());
const pulse = { window: { window_id: 'closed-fixture', opens_at: '2026-10-12T00:00:00Z', closes_at: '2026-10-13T00:00:00Z' }, consensus: { state: 'open', leading_rotation: null, total_calls: 0 } };
function dependencies(now: () => Date, market: Rh4663FrontdoorDependencies['market_categories']): Rh4663FrontdoorDependencies {
  return { now, ttl_ms: 0, census: async () => null, watch: async () => ({ generated_at: moverNow, cases: [], feed: [], falsification_queue: [] }),
    preflight: async () => null, pulse: async () => pulse, signals: async () => [], market_categories: market, ignore_personal_pulse_changes: true };
}
describe('stored category intelligence in the shared frontdoor', () => {
  it('updates NOW, WATCH, LOOPS and semantic versions from evidence changes, without changing CALL or proof', async () => {
    let now = new Date(moverNow), samples = moverSamples();
    const categories = new RhChainCategoryIntelligenceService({ movers: async () => deriveRhChainMarketMovers({ [contract]: samples }, now),
      identities: async () => [{ contract, category: 'stock_tokens', source_id: 'official-fixture', href: `/v1/4663/stock-tokens/${contract}/evidence`, observed_at: moverNow }],
      snapshots: async () => ({ [contract]: samples }), stockEvidence: async () => null, now: () => now });
    const service = new Rh4663FrontdoorService(dependencies(() => now, () => categories.read()));
    const first = await service.read(); expect(first.now_cards[0].evidence_state).toBe('OBSERVED');
    expect(first.now_cards[0].source_ref.source_id).toBe(samples.at(-1)!.snapshot_id); expect(first.watch_cards[0].headline).toContain('evidence gaps');
    expect(first.open_loops[0].state).toBe('BLOCKED_BY_DATA'); expect(first.freshness).toEqual({ state: 'OBSERVED', source_observed_at: moverNow });
    now = new Date(now.getTime() + 30_000); const same = await service.read(); expect(same.frontdoor_version.version).toBe(first.frontdoor_version.version);
    samples = samples.map((s, i) => i === samples.length - 1 ? { ...s, liquidity_usd: s.liquidity_usd! + 1000 } : s);
    const changed = await service.read(); expect(changed.frontdoor_version.changed).toContain('MARKET_OBSERVATIONS');
    expect(changed.current_call).toEqual(first.current_call); expect(changed.proof_summary).toEqual(first.proof_summary);
    expect(changed.change_events.find(e => e.source_type === 'market_observation')?.change_type).toBe('UPDATED');
    now = new Date(now.getTime() + 16 * 60_000); const expired = await service.read();
    expect(expired.now_cards.filter(c => c.source_type === 'market_observation')).toEqual([]); expect(expired.market_source_health?.health_state).toBe('STALE');
  });
  it('isolates failed market reads and never exposes dependency errors', async () => {
    const result = await new Rh4663FrontdoorService(dependencies(() => new Date(moverNow), async () => { throw new Error('private-key-secret'); })).read();
    expect(result.market_categories).toBeNull(); expect(result.market_source_health?.health_state).toBe('UNAVAILABLE');
    expect(result.current_call.window_id).toBe('closed-fixture'); expect(JSON.stringify(result)).not.toContain('private-key-secret');
  });
  it('serves identical anonymous category evidence and frontdoor state despite caller wallet headers, with no collection', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore(); for (const sample of moverSamples()) await store.save(sample);
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('collection-not-authorized'));
    const app = await createApp(undefined, undefined, { rhChainMarketSnapshotStore: store, reflexiveStore: new InMemoryReflexiveStore(),
      rhChainMarketSnapshotOptions: { enabled: false, storageEnabled: true, now: () => new Date(moverNow) } });
    try {
      const route = '/v1/4663/market/categories';
      const a = await app.inject({ method: 'GET', url: route }), b = await app.inject({ method: 'GET', url: route, headers: { authorization: 'Bearer wallet-secret', cookie: 'wallet=private-state', 'x-wallet': contract } });
      expect(a.statusCode).toBe(200); expect(a.json()).toEqual(b.json()); expect(a.headers['cache-control']).toBe('no-store');
      const fd = await app.inject({ method: 'GET', url: '/v1/4663/frontdoor' });
      expect(fd.statusCode).toBe(200); expect(fd.json().data.now_cards.some((c: { source_type: string }) => c.source_type === 'market_observation')).toBe(true);
      expect(fd.json().data.market_categories.market_projection_id).toBe(a.json().data.market_projection_id);
      const cached = await app.inject({ method: 'GET', url: '/v1/4663/frontdoor', headers: { 'if-none-match': fd.headers.etag!, authorization: 'Bearer different-wallet' } });
      expect(cached.statusCode).toBe(304); expect(JSON.stringify(a.json())).not.toContain('wallet-secret'); expect(network).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
