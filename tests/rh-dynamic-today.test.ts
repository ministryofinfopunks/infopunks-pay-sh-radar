import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { deriveRhChainMarketMovers } from '../src/services/rhChainMarketMoversService';
import { assembleRhChainTodayOn4663 } from '../src/services/rhChainTodayOn4663Service';
import { getRhChain4663Index, getRhChainDailyReceipts } from '../src/data/rhChain';
import { InMemoryRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { InMemoryReflexiveStore } from '../src/services/rhChainReflexiveRadarService';
import { STOCK_REGISTRY_PROVENANCE } from '../src/services/rhChainStockEvidenceService';
import { selectTodayOn4663 } from '../src/web/rhChainSignalDeskSelectors';
import { moverSamples, moverContract as contract, moverNow } from './helpers/rhMoverObservations';

const now = new Date(moverNow);
afterEach(() => vi.unstubAllGlobals());
describe('current Today and historical editorial memory', () => {
  it('makes every active card traceable to stored observation identities, source time and coverage', () => {
    const memory = structuredClone({ index: getRhChain4663Index(), daily: getRhChainDailyReceipts() });
    const movers = deriveRhChainMarketMovers({ [contract]: moverSamples() }, now, [contract]);
    const today = assembleRhChainTodayOn4663({ marketMovers: movers, now });
    const cards = today.cards.filter((card) => card.record_scope === 'current_observation');
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(card).toMatchObject({ observation_id: movers.assets[0].observation_id, observed_at: moverNow, time_basis: 'provider_fetch',
      freshness_state: 'fresh', coverage_state: 'complete', evidence_references: movers.assets[0].observation_ids, source: movers.assets[0].source,
      href: movers.assets[0].investigation_href, judgment_state: 'observed_fact' });
    expect(today.cards[0].title).toBe('Stock Token observation'); expect(today.market_projection_id).toBe(movers.projection_id);
    expect(today.editorial_memory).toMatchObject({ scope: 'HISTORICAL_REVIEWED_MEMORY', campaign_href: '/rh-chain-signal-desk/100-receipts' });
    expect(today.editorial_memory?.cards.every((card) => card.record_scope === 'historical_reviewed_memory')).toBe(true);
    expect(today.latest_receipt.receipt_id).toBe('rh_daily_006'); expect(today.cards[3].record_scope).toBe('historical_reviewed_memory');
    expect({ index: getRhChain4663Index(), daily: getRhChainDailyReceipts() }).toEqual(memory);
  });
  it('does not replace absent or stale active observations with a fixed campaign asset', () => {
    for (const movers of [deriveRhChainMarketMovers({}, now), deriveRhChainMarketMovers({ [contract]: moverSamples() }, new Date(now.getTime() + 16 * 60000))]) {
      const today = assembleRhChainTodayOn4663({ marketMovers: movers });
      expect(today.cards.filter((card) => card.record_scope === 'current_observation')).toEqual([]);
      expect(today.cards.filter((card) => card.record_scope === 'availability_notice').every((card) => card.observation_id === null && card.observed_at === null)).toBe(true);
      expect(today.cards.slice(0, 3).map((card) => card.verdict).join(' ')).not.toContain('CASHCAT');
      expect(today.editorial_memory?.cards[0].verdict).toContain('CASHCAT');
      expect(today.latest_receipt.receipt_id).toBe('rh_daily_006');
    }
  });
  it('selects observed-fact titles and expires browser evidence state independently of editorial labels', () => {
    const today = assembleRhChainTodayOn4663({ marketMovers: deriveRhChainMarketMovers({ [contract]: moverSamples() }, now) });
    const current = selectTodayOn4663(today, now);
    expect(current[0]).toMatchObject({ title: 'Market observation', classification: 'observed fact', observationId: today.cards[0].observation_id, coverageState: 'complete' });
    expect(selectTodayOn4663(today, new Date(now.getTime() + 16 * 60000))[0].evidenceState).toBe('stale');
    expect(selectTodayOn4663(assembleRhChainTodayOn4663({ marketMovers: deriveRhChainMarketMovers({}, now) }), now)[0]).toMatchObject({ classification: 'unavailable', observedAt: null });
  });
  it('keeps healthy market observations active when editorial receipt storage is unavailable', () => {
    const today = assembleRhChainTodayOn4663({ marketMovers: deriveRhChainMarketMovers({ [contract]: moverSamples() }, now), storage_status: 'unavailable' });
    expect(today.cards[0].record_scope).toBe('current_observation'); expect(today.storage_status).toBe('available');
    expect(today.editorial_memory?.storage_status).toBe('unavailable');
  });
});

describe('integrated public Movers and Today API', () => {
  it('shares one storage-derived market projection, updates on persisted changes, and never collects or personalizes', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore(); for (const sample of moverSamples()) await store.save(sample);
    const registry = new InMemoryReflexiveStore(); const snapshot = await registry.load(); snapshot.assets = [{ asset_id: 'fixture-stock', ticker: 'SAME', name: 'Fixture stock', chain_id: 4663,
      canonical_contract: contract, status: 'ASSET_STATUS_ACTIVE', current_multiplier: '1', pending_multiplier: null, pending_multiplier_effective_at: null,
      trading_capabilities: { private_wallet: 'wallet-secret' }, logo: null, observed_at: moverNow, fetched_at: moverNow, provenance: STOCK_REGISTRY_PROVENANCE, first_party_asset: false }]; await registry.save(snapshot);
    const network = vi.fn(async () => { throw new Error('public-read-network'); }); vi.stubGlobal('fetch', network);
    const app = await createApp(emptyIntelligenceStore(), undefined, { reflexiveStore: registry, rhChainMarketSnapshotStore: store, rhChainMarketSnapshotOptions: { now: () => now, enabled: false } });
    try {
      const direct = await app.inject('/v1/rh-chain/market/movers'); const alias = await app.inject('/v1/4663/market/movers');
      const index = await app.inject('/v1/rh-chain/4663-index'); const today = await app.inject('/v1/rh-chain/today-on-4663');
      expect(direct.statusCode).toBe(200); expect(alias.json().data).toEqual(direct.json().data);
      expect(index.json().data).toMatchObject({ active_ranking: 'market_movers.assets', legacy_fields_scope: 'HISTORICAL_EDITORIAL_MEMORY', market_movers: direct.json().data });
      expect(today.json().data.market_projection_id).toBe(direct.json().data.projection_id); expect(today.json().data.cards[0].title).toBe('Stock Token observation');
      const privateCaller = await app.inject({ url: '/v1/rh-chain/market/movers', headers: { authorization: 'Bearer private-tenant', cookie: 'wallet=wallet-secret', 'x-wallet-address': '0x' + '5'.repeat(40) } });
      expect(privateCaller.json()).toEqual(direct.json()); expect(privateCaller.headers['cache-control']).toBe('no-store');
      expect(JSON.stringify([index.json(), today.json(), direct.json()])).not.toMatch(/wallet-secret|private-tenant|private_wallet/);
      const second = '0x' + '2'.repeat(40); for (const sample of moverSamples(second, '0x' + 'b'.repeat(64))) await store.save(sample);
      const next = (await app.inject('/v1/rh-chain/market/movers')).json().data;
      expect(next.assets).toHaveLength(2); expect(next.projection_id).not.toBe(direct.json().data.projection_id);
      expect((await app.inject('/v1/rh-chain/4663-index/memory')).json().data.assets).toEqual(getRhChain4663Index().assets);
      expect(network).not.toHaveBeenCalled(); expect(await registry.load()).toEqual(snapshot);
    } finally { await app.close(); }
  });
  it('fails soft with no active ranking when market storage fails, while preserving reviewed memory', async () => {
    const store = { adapter: 'memory' as const, durable: false, listObservedContracts: async () => { throw new Error('tenant-password'); }, list: async () => [], save: async () => {} };
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainMarketSnapshotStore: store, rhChainMarketSnapshotOptions: { now: () => now, enabled: false } });
    try { const movers = (await app.inject('/v1/rh-chain/market/movers')).json().data; expect(movers).toMatchObject({ assets: [], storage_status: 'unavailable' });
      const today = (await app.inject('/v1/rh-chain/today-on-4663')).json().data;
      expect(today.cards.filter((card: { record_scope: string }) => card.record_scope === 'current_observation')).toEqual([]);
      expect(today.latest_receipt.receipt_id).toBe('rh_daily_006'); expect(JSON.stringify(today)).not.toContain('tenant-password'); }
    finally { await app.close(); }
  });
});
