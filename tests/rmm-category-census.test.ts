import { describe, expect, it } from 'vitest';
import { activeCanonicalStockTokens, buildRmmCategoryCensus, InMemoryRmmCategoryCensusStore, RmmCategoryCensusService } from '../src/services/rmmCategoryCensusService';
import { InMemoryReflexiveStore, type CanonicalStockAsset, type ReflexiveSnapshot } from '../src/services/rhChainReflexiveRadarService';
import { createApp } from '../src/api/app';
import { createOpenApiSpec } from '../src/api/openapi';

const at = '2026-09-10T00:00:00.000Z';
const asset = (asset_id: string, ticker: string, contract: string, name = ticker): CanonicalStockAsset => ({ asset_id, ticker, name, chain_id: 4663, canonical_contract: contract, status: 'ASSET_STATUS_ACTIVE', current_multiplier: '1', pending_multiplier: null, pending_multiplier_effective_at: null, trading_capabilities: null, logo: null, observed_at: at, fetched_at: at, provenance: 'test', first_party_asset: true });
const nvda = asset('nvda', 'NVDA', '0x0000000000000000000000000000000000000001');
const qubt = asset('qubt', 'QUBT', '0x0000000000000000000000000000000000000002');
const mu = asset('mu', 'MU', '0x0000000000000000000000000000000000000005');
const pair = (id: string, mission: string, stock: CanonicalStockAsset, launched_at = '2026-09-01T00:00:00.000Z') => ({ pair_id: id, mission_symbol: mission, mission_contract: `0x${id.padEnd(40, '0')}`.slice(0, 42), stock_asset_id: stock.asset_id, quote_contract: stock.canonical_contract, pool_id: `pool-${id}`, pool_address: null, canonicality: 'verified', venue: 'PAIR', launched_at, verification: { verification_status: 'VERIFIED' }, evidence: [{ source: 'test', href: '', observed_at: at, fetched_at: at, note: 'exact canonical quote contract and pool identity', quality: 'onchain' }] }) as any;

function snapshot(overrides: Partial<ReflexiveSnapshot> = {}): ReflexiveSnapshot {
  const ai = pair('ai', 'AI', nvda); const qc = pair('qc', 'QC', qubt); const qcat = pair('qcat', 'QCAT', qubt);
  return { assets: [nvda, qubt, mu], pairs: [ai, qc, qcat], births: [], lifecycle: [{ checkpoint_id: 'd7-ai', pair_id: ai.pair_id, checkpoint: 'D7', state: 'OBSERVED' }], observations: [{ pair_id: ai.pair_id, observed_at: at, fresh: true, liquidity_usd: 100, volume_24h_usd: 10 }, { pair_id: qc.pair_id, observed_at: at, fresh: true, liquidity_usd: 20, volume_24h_usd: 0 }, { pair_id: qcat.pair_id, observed_at: at, fresh: true, liquidity_usd: 0, volume_24h_usd: 0 }], position_identities: [], position_state_proofs: [], inventory_observations: [{ mission_pair_id: ai.pair_id, status: 'AVAILABLE' }], inventory_aggregates: [], inventory_deltas: [], inventory_baselines: [], supply_events: [], quote_markets: [], quote_persistence: [], quote_lifecycle: [], long_inventory_history: [], vault_observations: [], mission_stock_footprints: [], pltr_preflight_states: [], external_research_claims: [], events: [], thesis: [], refreshed_at: at, cursor: null, ...overrides } as ReflexiveSnapshot;
}

describe('RMM Category Census v0.1', () => {
  it('deduplicates the active canonical denominator and rejects deprecated, leveraged and non-4663 assets', () => {
    const duplicate = asset('duplicate', 'NVDA2', nvda.canonical_contract);
    const leveraged = asset('leveraged', 'NVDA3L', '0x0000000000000000000000000000000000000003', '3x NVIDIA');
    const deprecated = { ...asset('old', 'OLD', '0x0000000000000000000000000000000000000004'), status: 'DEPRECATED' };
    expect(activeCanonicalStockTokens([nvda, duplicate, leveraged, deprecated, { ...qubt, chain_id: 1 }])).toEqual([nvda]);
  });

  it('preserves the Watch count mismatch, verifies only deterministic direct quotes, and counts tickers once for penetration', () => {
    const census = buildRmmCategoryCensus(snapshot(), new Date(at));
    expect(census.source_claims).toMatchObject({ claimed_pair_count: 27, claimed_distinct_stock_tickers: 22, parsed_pair_count: 25, parsed_distinct_stock_tickers: 21, count_reconciliation_state: 'SOURCE_COUNT_MISMATCH' });
    expect(census.verified_pair_count).toBe(3);
    expect(census.distinct_verified_stock_tickers).toBe(2);
    expect(census.rmm_penetration).toMatchObject({ numerator: 2, denominator: 3 });
    expect(census.rmm_penetration.percentage).toBeCloseTo(66.666, 2);
    expect(census.rmm_pair_density.value).toBe(1.5);
    expect(census.pairs.find((item) => item.claimed_mission_symbol === 'AI')).toMatchObject({ verification_state: 'VERIFIED_DIRECT_STOCK_QUOTE', quote_direction: 'MISSION_QUOTED_IN_CANONICAL_STOCK', current_activity_state: 'ACTIVE' });
    expect(census.pairs.find((item) => item.claimed_mission_symbol === 'MOO')).toMatchObject({ verification_state: 'MISSION_TOKEN_UNRESOLVED', quote_direction: 'UNRESOLVED' });
    expect(census.category_evidence.ra1_impact).toBe('BREADTH_SUPPORT_ONLY_NOT_CONFIRMED');
  });

  it('keeps activity, persistence coverage, immutable observations, and census refresh separate from deep audit work', async () => {
    const state = snapshot(); const source = new InMemoryReflexiveStore(); await source.save(state); const service = new RmmCategoryCensusService(() => source.load(), new InMemoryRmmCategoryCensusStore(), () => new Date(at));
    const first = await service.refresh(); const second = await service.refresh();
    expect(first.immutable).toBe(true); expect(second.census_id).not.toBe(first.census_id);
    expect(first.pairs.find((item) => item.claimed_mission_symbol === 'QC')?.current_activity_state).toBe('LOW_ACTIVITY');
    expect(first.pairs.find((item) => item.claimed_mission_symbol === 'QCAT')?.current_activity_state).toBe('INACTIVE');
    expect(first.persistent_rmm_penetration).toMatchObject({ status: 'PARTIAL', numerator: 1, persistence_coverage: { eligible_for_d7: 3, evaluated: 1 } });
    expect((await source.load()).pairs).toHaveLength(3);
  });

  it('exposes read-only census APIs and documents the reviewer-only refresh without trading endpoints', async () => {
    const app = await createApp();
    try {
      expect((await app.inject('/v1/4663/reflexive/census')).statusCode).toBe(409);
      expect((await app.inject('/v1/4663/reflexive/census/pairs')).statusCode).toBe(200);
      expect((await app.inject('/v1/4663/reflexive/census/stocks/NVDA')).statusCode).toBe(409);
      expect((await app.inject({ method: 'POST', url: '/internal/4663/reflexive/census/refresh' })).statusCode).toBe(401);
      const paths = (createOpenApiSpec() as any).paths;
      for (const path of ['/v1/4663/reflexive/census', '/v1/4663/reflexive/census/pairs', '/v1/4663/reflexive/census/stocks/{symbol}', '/internal/4663/reflexive/census/refresh']) expect(paths[path]).toBeDefined();
      expect(Object.keys(paths).filter((path) => path.includes('/reflexive/census')).join(' ')).not.toMatch(/trade|swap|transaction/i);
    } finally { await app.close(); }
  });
});
