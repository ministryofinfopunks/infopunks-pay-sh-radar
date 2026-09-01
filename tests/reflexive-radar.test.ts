import { describe, expect, it } from 'vitest';
import { InMemoryReflexiveStore, PairV5DiscoveryAdapter, ReflexiveRadarService, isCanonicalStockContract, missionAlpha, normalizeShareEquivalent, quoteInventory, stockTokenBasis, type CanonicalStockAsset, type ReflexiveProvider } from '../src/services/rhChainReflexiveRadarService';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const MISSION = '0x2222222222222222222222222222222222222222';
const asset = (): CanonicalStockAsset => ({ asset_id: 'asset-nvda', ticker: 'NVDA', name: 'NVIDIA', chain_id: 4663, canonical_contract: CONTRACT, status: 'ASSET_STATUS_ACTIVE', current_multiplier: '4', pending_multiplier: null, pending_multiplier_effective_at: null, trading_capabilities: null, logo: null, observed_at: '2026-09-01T00:00:00.000Z', fetched_at: '2026-09-01T00:00:00.000Z', provenance: 'test', first_party_asset: false });

describe('Reflexive Radar maths and identity guards', () => {
  it('rejects a fake same-ticker contract while accepting the exact canonical deployment', () => {
    expect(isCanonicalStockContract([asset()], CONTRACT)).toBe(true);
    expect(isCanonicalStockContract([asset()], '0x3333333333333333333333333333333333333333')).toBe(false);
  });
  it('keeps raw token and share-equivalent units explicit across multiplier changes', () => {
    expect(normalizeShareEquivalent('2.5', '4')).toBe('10');
    expect(quoteInventory('2.5', '4', 'event_derived_position_accounting')).toMatchObject({ raw: '2.5', share_equivalent: '10' });
  });
  it('never permits a V4 PoolManager balance as pair inventory', () => {
    expect(quoteInventory('9999', '1', 'unavailable')).toEqual({ raw: null, share_equivalent: null, method: 'unavailable' });
  });
  it('calculates Mission Alpha as realized relative return', () => {
    expect(missionAlpha(100, 140, 100, 120)).toBeCloseTo(0.1666667);
    expect(missionAlpha(0, 140, 100, 120)).toBeNull();
  });
  it('normalizes basis with multiplier semantics and refuses misaligned timestamps', () => {
    expect(stockTokenBasis(30, 120, '4', '2026-09-01T00:00:00.000Z', '2026-09-01T00:01:00.000Z')).toBeCloseTo(0);
    expect(stockTokenBasis(30, 120, '4', '2026-09-01T00:00:00.000Z', '2026-09-01T00:04:01.000Z')).toBeNull();
  });
  it('discovers a canonical pair deterministically and rejects a ticker-only candidate', async () => {
    const provider: ReflexiveProvider = { assets: async () => ({ assets: [{ id: 'asset-nvda', tokenSymbol: 'NVDA', tokenName: 'NVIDIA', deployments: [{ chainId: 4663, contractAddress: CONTRACT }], currentMultiplier: '1', status: 'ASSET_STATUS_ACTIVE' }] }), discover: async () => [{ protocol: 'pair-v5', venue: 'PAIR', pool_id: 'pool-a', mission_contract: MISSION, mission_symbol: 'AI', quote_contract: CONTRACT, launched_at: '2026-09-01T00:00:00.000Z', evidence: [] }, { protocol: 'pair-v5', venue: 'PAIR', pool_id: 'pool-b', mission_contract: MISSION, mission_symbol: 'FAKE', quote_contract: '0x3333333333333333333333333333333333333333', launched_at: '2026-09-01T00:00:00.000Z', evidence: [] }] };
    const service = new ReflexiveRadarService(new InMemoryReflexiveStore(), provider, () => new Date('2026-09-01T01:00:00.000Z'));
    const snapshot = await service.refresh();
    expect(snapshot.pairs).toHaveLength(1); expect(snapshot.pairs[0]).toMatchObject({ mission_symbol: 'AI', canonicality: 'verified' });
  });
  it('keeps each PAIR V5 multipool quote market independent and requires verifier approval', async () => {
    const adapter = new PairV5DiscoveryAdapter({ verifyPool: async ({ pool_id }) => pool_id === 'pool-nvda', fetchImpl: async () => new Response(JSON.stringify({ items: [{ address: MISSION, symbol: 'AI', launchedAt: 1_788_242_000, launchTxHash: '0xabc', pairs: [{ ammVersion: 'V4_MULTI', poolId: 'pool-nvda', quoteToken: { address: CONTRACT } }, { ammVersion: 'V4_MULTI', poolId: 'pool-unverified', quoteToken: { address: CONTRACT } }] }] })) });
    const pairs = await adapter.discover([asset()]);
    expect(pairs).toHaveLength(1); expect(pairs[0]).toMatchObject({ venue: 'PAIR', pool_id: 'pool-nvda', quote_contract: CONTRACT });
  });
});
