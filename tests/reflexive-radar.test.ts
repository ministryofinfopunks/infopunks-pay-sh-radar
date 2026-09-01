import { describe, expect, it } from 'vitest';
import { InMemoryReflexiveStore, PairV5DiscoveryAdapter, ReflexiveRadarService, aggregateTrackedPairInventory, archiveCapabilityStatus, derivePositionInventoryDelta, deriveUniswapV4PoolId, formatTokenUnits, isCanonicalStockContract, missionAlpha, missionPerStockFromSqrtPrice, normalizePoolKey, normalizeShareEquivalent, positionTokenIdSalt, quoteInventory, reconcilePositionLiquidity, reconstructPositionPrincipal, sqrtRatioAtTick, stockTokenBasis, type CanonicalStockAsset, type ReflexiveProvider } from '../src/services/rhChainReflexiveRadarService';
import { renderReflexiveInventoryCardSvg, renderReflexiveStockMoneyCardSvg } from '../src/shared/rhChainReflexiveShare';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const MISSION = '0x2222222222222222222222222222222222222222';
const asset = (): CanonicalStockAsset => ({ asset_id: 'asset-nvda', ticker: 'NVDA', name: 'NVIDIA', chain_id: 4663, canonical_contract: CONTRACT, status: 'ASSET_STATUS_ACTIVE', current_multiplier: '4', pending_multiplier: null, pending_multiplier_effective_at: null, trading_capabilities: null, logo: null, observed_at: '2026-09-01T00:00:00.000Z', fetched_at: '2026-09-01T00:00:00.000Z', provenance: 'test', first_party_asset: false });
const inventory = (overrides: Record<string, unknown> = {}) => ({ observation_id: 'ob-1', mission_pair_id: 'pair-1', position_identity_id: 'identity-1', position_state_proof_id: 'proof-1', status: 'AVAILABLE', accounting_classification: 'VERIFIED_POSITION_ACCOUNTING', reason: null, scope: 'CANONICAL_LOCKED_POSITION', method: 'VERIFIED_LOCKED_POSITION_RECONSTRUCTION_V1', token_id: '1', position_manager: CONTRACT, stock_asset_id: 'asset-nvda', stock_symbol: 'NVDA', stock_contract: CONTRACT, stock_decimals: 0, mission_principal_raw: '0', mission_principal_units: '0', stock_principal_raw: '20', stock_principal_units: '20', stock_share_equivalent_units: '80', amount0_raw: '20', amount1_raw: '0', stock_total_supply_raw: '1000', stock_total_supply_units: '1000', stock_total_supply_share_equivalent_units: '4000', absorption_pct: '2', range_state: 'IN_RANGE', tick_lower: -10, tick_upper: 10, current_tick: 0, sqrt_price_x96: String(2n ** 96n), position_liquidity_raw: '10', core_position_liquidity_raw: '10', multiplier: '4', pending_multiplier: null, pending_multiplier_effective_at: null, observed_block: 100, observed_at: '2026-09-01T00:00:00.000Z', rpc_provider: 'test', evidence: [], methodology_version: 'rmm-v0.3.1', immutable: true, ...overrides }) as any;

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
    const verified = { verification_status: 'VERIFIED' as const, failure_reasons: [], verified_at: '2026-09-01T00:00:00.000Z', verification_block: 10, observed_block: 7, confirmed_block: 10, launch_provenance_method: 'launchpad_registry_and_receipt' as const, launch_implementation_observed: null, pool_key: { currency0: CONTRACT, currency1: MISSION, fee: 10_000, tick_spacing: 200, hooks: CONTRACT }, state_view_address: CONTRACT, state_observed_block: 10, state_observed_at: '2026-09-01T00:00:00.000Z', rpc_provider: 'test', sqrt_price_x96: '1', tick: 0, active_liquidity: '1', position_token_id: null, position_verification_status: 'NOT_ATTEMPTED' as const };
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
  it('reconstructs concentrated-liquidity principal with bigint arithmetic and range semantics', () => {
    expect(sqrtRatioAtTick(0)).toBe(2n ** 96n); expect(sqrtRatioAtTick(-887272)).toBe(4295128739n);
    const lower = sqrtRatioAtTick(-100); const upper = sqrtRatioAtTick(100); const below = reconstructPositionPrincipal(1_000_000n, -100, 100, lower - 1n); const inside = reconstructPositionPrincipal(1_000_000n, -100, 100, 2n ** 96n); const above = reconstructPositionPrincipal(1_000_000n, -100, 100, upper + 1n);
    expect(below).toMatchObject({ amount1: 0n, range_state: 'BELOW_RANGE' }); expect(inside.amount0).toBeGreaterThan(0n); expect(inside.amount1).toBeGreaterThan(0n); expect(inside.range_state).toBe('IN_RANGE'); expect(above).toMatchObject({ amount0: 0n, range_state: 'ABOVE_RANGE' });
  });
  it('keeps raw amounts exact and never passes pool active liquidity into principal accounting', () => {
    expect(formatTokenUnits(18333825370768304861n, 18)).toBe('18.333825370768304861'); expect(() => reconstructPositionPrincipal(0n, 10, 10, 2n ** 96n)).toThrow('invalid_position_state');
  });
  it('keeps inventory share-card language scoped to Robinhood onchain token supply', () => {
    const card = renderReflexiveInventoryCardSvg({ mission_symbol: 'PEAR' } as any, { stock_symbol: 'AAPL', stock_principal_units: '18.33', absorption_pct: '0.1694', observed_block: 51_765_748 } as any);
    expect(card).toContain('ROBINHOOD ONCHAIN AAPL TOKEN SUPPLY'); expect(card).toContain('CANONICAL LOCKED POSITION');
  });
  it('encodes the PositionManager NFT id as the exact bytes32 core-position salt', () => {
    expect(positionTokenIdSalt('948804')).toBe('0x00000000000000000000000000000000000000000000000000000000000e7a44');
  });
  it('requires an exact PositionManager/core liquidity match and fails closed otherwise', () => {
    expect(reconcilePositionLiquidity('34040728973133066586329', '34040728973133066586329').match_status).toBe('POSITIONMANAGER_CORE_MATCH');
    expect(reconcilePositionLiquidity(11n, 10n).match_status).toBe('POSITION_STATE_MISMATCH');
    expect(reconcilePositionLiquidity(11n, null).match_status).toBe('CORE_POSITION_UNAVAILABLE');
  });
  it('aggregates only same-block verified positions for the same canonical Stock Token', () => {
    const aggregate = aggregateTrackedPairInventory(asset(), [inventory(), inventory({ observation_id: 'ob-2', mission_pair_id: 'pair-2', token_id: '2', stock_principal_raw: '30', stock_principal_units: '30' })]);
    expect(aggregate).toMatchObject({ status: 'ALIGNED', raw_stock_token_units: '50', tracked_pair_locked_absorption_pct: '5', position_count: 2, mission_pair_count: 2, aggregation_scope: 'TRACKED_PAIR_CANONICAL_LOCKED_POSITIONS' });
  });
  it('rejects mismatched blocks and duplicate token ids from a public category aggregate', () => {
    const mismatch = aggregateTrackedPairInventory(asset(), [inventory(), inventory({ observation_id: 'ob-2', mission_pair_id: 'pair-2', token_id: '2', observed_block: 101 })]);
    expect(mismatch.status).toBe('INCOMPLETE'); expect(mismatch.raw_stock_token_units).toBeNull(); expect(mismatch.excluded_observations.some((item) => item.reason === 'MISMATCHED_BLOCK')).toBe(true);
    const duplicate = aggregateTrackedPairInventory(asset(), [inventory(), inventory({ observation_id: 'ob-older', observed_at: '2026-08-31T00:00:00.000Z' })]);
    expect(duplicate).toMatchObject({ status: 'ALIGNED', position_count: 1 }); expect(duplicate.excluded_observations.some((item) => item.reason === 'DUPLICATE_TOKEN_ID')).toBe(true);
  });
  it('keeps inventory change neutral and includes range state rather than inferring demand', () => {
    const delta = derivePositionInventoryDelta(inventory(), inventory({ observation_id: 'ob-2', stock_principal_raw: '15', stock_principal_units: '15', observed_at: '2026-09-01T00:05:00.000Z', range_state: 'ABOVE_RANGE' }));
    expect(delta).toMatchObject({ delta_raw: '-5', delta_pct: '-25', label: 'POSITION INVENTORY CHANGED', previous_range_state: 'IN_RANGE', current_range_state: 'ABOVE_RANGE' });
    expect(JSON.stringify(delta)).not.toContain('demand');
  });
  it('renders an immutable aligned stock-money share card with tracked scope', () => {
    const aggregate = aggregateTrackedPairInventory(asset(), [inventory()]); const card = renderReflexiveStockMoneyCardSvg(aggregate);
    expect(card).toContain('TRACKED CANONICAL LOCKED POSITIONS'); expect(card).toContain('ROBINHOOD ONCHAIN NVDA TOKEN SUPPLY');
  });
  it('keeps lifecycle accounting prospective when archive eth_call is unavailable', () => {
    expect(archiveCapabilityStatus(false)).toBe('PROSPECTIVE_ONLY'); expect(archiveCapabilityStatus(true)).toBe('ARCHIVE_CAPABLE');
  });
});
