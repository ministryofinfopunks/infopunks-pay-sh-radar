import { describe, expect, it } from 'vitest';
import { InMemoryReflexiveStore, PairV5DiscoveryAdapter, ReflexiveRadarService, deriveUniswapV4PoolId, isCanonicalStockContract, missionAlpha, missionPerStockFromSqrtPrice, normalizePoolKey, normalizeShareEquivalent, quoteInventory, stockTokenBasis, type CanonicalStockAsset, type ReflexiveProvider } from '../src/services/rhChainReflexiveRadarService';

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
    const verified = { verification_status: 'VERIFIED' as const, failure_reasons: [], verified_at: '2026-09-01T00:00:00.000Z', verification_block: 10, observed_block: 7, confirmed_block: 10, launch_provenance_method: 'launchpad_registry_and_receipt' as const, launch_implementation_observed: null, pool_key: { currency0: CONTRACT, currency1: MISSION, fee: 10_000, tick_spacing: 200, hooks: CONTRACT }, state_view_address: CONTRACT, state_observed_block: 10, state_observed_at: '2026-09-01T00:00:00.000Z', rpc_provider: 'test', sqrt_price_x96: '1', tick: 0, active_liquidity: '1', position_verification_status: 'NOT_ATTEMPTED' as const };
    const provider: ReflexiveProvider = { assets: async () => ({ assets: [{ id: 'asset-nvda', tokenSymbol: 'NVDA', tokenName: 'NVIDIA', deployments: [{ chainId: 4663, contractAddress: CONTRACT }], currentMultiplier: '1', status: 'ASSET_STATUS_ACTIVE' }] }), discover: async () => [{ protocol: 'pair-v5', venue: 'PAIR', pool_id: 'pool-a', mission_contract: MISSION, mission_symbol: 'AI', quote_contract: CONTRACT, launched_at: '2026-09-01T00:00:00.000Z', evidence: [], onchain: verified }, { protocol: 'pair-v5', venue: 'PAIR', pool_id: 'pool-b', mission_contract: MISSION, mission_symbol: 'FAKE', quote_contract: '0x3333333333333333333333333333333333333333', launched_at: '2026-09-01T00:00:00.000Z', evidence: [], onchain: verified }] };
    const service = new ReflexiveRadarService(new InMemoryReflexiveStore(), provider, () => new Date('2026-09-01T01:00:00.000Z'));
    const snapshot = await service.refresh();
    expect(snapshot.pairs).toHaveLength(1); expect(snapshot.pairs[0]).toMatchObject({ mission_symbol: 'AI', canonicality: 'verified' });
    expect(snapshot.births).toHaveLength(1); expect(snapshot.lifecycle.find((item) => item.checkpoint === 'T10M')?.state).toBe('MISSED'); expect(snapshot.lifecycle.find((item) => item.checkpoint === 'T1H')?.state).toBe('PENDING');
  });
  it('keeps each PAIR V5 multipool quote market independent and requires verifier approval', async () => {
    const adapter = new PairV5DiscoveryAdapter({ verifyPool: async ({ pool_id }) => pool_id === 'pool-nvda', fetchImpl: async () => new Response(JSON.stringify({ items: [{ address: MISSION, symbol: 'AI', launchedAt: 1_788_242_000, launchTxHash: '0xabc', pairs: [{ ammVersion: 'V4_MULTI', poolId: 'pool-nvda', quoteToken: { address: CONTRACT } }, { ammVersion: 'V4_MULTI', poolId: 'pool-unverified', quoteToken: { address: CONTRACT } }] }] })) });
    const pairs = await adapter.discover([asset()]);
    expect(pairs).toHaveLength(1); expect(pairs[0]).toMatchObject({ venue: 'PAIR', pool_id: 'pool-nvda', quote_contract: CONTRACT });
  });
  it('derives the documented live PEAR/AAPL V4 PoolId from its complete PoolKey', async () => {
    const key = normalizePoolKey('0x3567c5d0ae5c5933920bbd6db982aa463a203bb2', '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9', 10_000, 200, '0x16D1560630Ce74af4478d9b8AD46548A092A2000');
    await expect(deriveUniswapV4PoolId(key)).resolves.toBe('0x665a2925562f36ffeed88822d6d59859a18451635818daae3e4e415a3f6efe8d');
  });
  it('converts sqrtPrice with ordering and decimals rather than inverting the market', () => {
    const q96 = 2n ** 96n;
    expect(missionPerStockFromSqrtPrice(q96, true, 18, 18)).toBe('1');
    expect(missionPerStockFromSqrtPrice(q96 * 2n, true, 18, 18)).toBe('4');
    expect(missionPerStockFromSqrtPrice(q96 * 2n, false, 18, 18)).toBe('0.25');
    expect(missionPerStockFromSqrtPrice(q96, true, 6, 18)).toBe('1e-12');
  });
});
