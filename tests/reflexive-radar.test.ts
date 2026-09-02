import { describe, expect, it } from 'vitest';
import { InMemoryReflexiveStore, PairV5DiscoveryAdapter, ReflexiveRadarService, aggregateTrackedPairInventory, archiveCapabilityStatus, derivePositionInventoryDelta, deriveUniswapV4PoolId, formatTokenUnits, isCanonicalStockContract, missionAlpha, missionPerStockFromSqrtPrice, normalizePoolKey, normalizeShareEquivalent, positionTokenIdSalt, quoteInventory, reconcilePositionLiquidity, reconstructPositionPrincipal, sqrtRatioAtTick, stockTokenBasis, type CanonicalStockAsset, type ReflexiveProvider } from '../src/services/rhChainReflexiveRadarService';
import { renderCapitalVsFlowCardSvg, renderMissionFootprintCardSvg, renderReflexiveInventoryCardSvg, renderReflexiveStockMoneyCardSvg } from '../src/shared/rhChainReflexiveShare';
import { classifyQuoteContract, quoteMarketFromRaw, quotePersistence, quoteRegime, resolveQuoteLifecycle } from '../src/services/rhChainQuotePersistenceService';
import { missionFootprintMultiple, missionStockFootprint, reconcileSupplyDelta, unavailableAiVault, verifyCommunityVaultCandidate } from '../src/services/rhChainReflexiveRadarService';
import { buildPltrPreflightState, classifyPltrRelationship, PLTR_CONCENTRATION_SCENARIO_BANDS, proposedFirstPartyPltrFootprintSchema } from '../src/services/rhChainPltrPreflightService';

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
  it('classifies quote families with exact addresses, not ticker strings', () => {
    const taxonomy = { canonical_stock_contracts: [CONTRACT], weth_contracts: ['0x4444444444444444444444444444444444444444'], stablecoin_contracts: ['0x5555555555555555555555555555555555555555'], mission_contracts: [MISSION], derivative_equity_contracts: ['0x6666666666666666666666666666666666666666'] };
    expect(classifyQuoteContract(CONTRACT, taxonomy)).toBe('CANONICAL_STOCK_TOKEN'); expect(classifyQuoteContract('0x4444444444444444444444444444444444444444', taxonomy)).toBe('WETH'); expect(classifyQuoteContract('0x5555555555555555555555555555555555555555', taxonomy)).toBe('STABLECOIN'); expect(classifyQuoteContract(MISSION, taxonomy)).toBe('MISSION_TOKEN'); expect(classifyQuoteContract('0x6666666666666666666666666666666666666666', taxonomy)).toBe('DERIVATIVE_EQUITY_TOKEN'); expect(classifyQuoteContract('0x7777777777777777777777777777777777777777', taxonomy)).toBe('OTHER_CRYPTO');
  });
  it('deduplicates by deterministic pool identity and excludes dust without deleting discovery', () => {
    const raw = (pool: string, quote: string, liquidity: number | null, volume: number | null) => quoteMarketFromRaw({ pool_id: pool, protocol: 'v4', dex: 'uniswap', mission_contract: MISSION, mission_symbol: 'AI', base_contract: MISSION, quote_contract: quote, quote_symbol: 'Q', liquidity_usd: liquidity, volume_24h_usd: volume, transaction_count: 3, observed_at: '2026-09-01T00:00:00.000Z', source_url: null, freshness: 'fresh' }, { canonical_stock_contracts: [CONTRACT], weth_contracts: ['0x4444444444444444444444444444444444444444'], stablecoin_contracts: [] });
    const dust = raw('0xabc', CONTRACT, 100, 100); expect(dust.eligible).toBe(false); expect(dust.exclusion_reasons).toContain('INSUFFICIENT_LIQUIDITY'); const first = raw('0xdef', CONTRACT, 20_000, 50_000); const duplicate = raw('0xdef', CONTRACT, 20_000, 50_000); expect(first.pool_identity).toBe(duplicate.pool_identity);
  });
  it('requires aligned rolling windows before calculating capital-versus-flow shares', () => {
    const raw = (pool: string, quote: string, liquidity: number, volume: number, observedAt = '2026-09-01T00:00:00.000Z') => quoteMarketFromRaw({ pool_id: pool, protocol: 'v4', dex: 'uniswap', mission_contract: MISSION, mission_symbol: 'AI', base_contract: MISSION, quote_contract: quote, quote_symbol: 'Q', liquidity_usd: liquidity, volume_24h_usd: volume, transaction_count: 3, observed_at: observedAt, source_url: null, freshness: 'fresh' }, { canonical_stock_contracts: [CONTRACT], weth_contracts: ['0x4444444444444444444444444444444444444444'], stablecoin_contracts: [] });
    const aligned = quotePersistence([raw('0x1', CONTRACT, 80_000, 20_000), raw('0x2', '0x4444444444444444444444444444444444444444', 20_000, 80_000)])!; expect(aligned.stock_quote_liquidity_share).toBe(.8); expect(aligned.stock_quote_volume_share).toBe(.2); expect(aligned.capital_flow_divergence).toBeCloseTo(.6); expect(aligned.quote_regime).toBe('STOCK_CAPITAL_ANCHOR_FLOW_MIGRATED');
    const mismatch = quotePersistence([raw('0x3', CONTRACT, 80_000, 20_000), raw('0x4', '0x4444444444444444444444444444444444444444', 20_000, 80_000, '2026-09-01T00:10:00.000Z')])!; expect(mismatch.source_alignment).toBe('UNAVAILABLE'); expect(mismatch.stock_quote_volume_share).toBeNull();
  });
  it('uses deterministic regime boundaries and prospective quote lifecycle checkpoints', () => {
    expect(quoteRegime(.6, .4)).toBe('STOCK_CAPITAL_ANCHOR_FLOW_MIGRATED'); expect(quoteRegime(.59, .59)).toBe('BALANCED_QUOTE_ECONOMY'); expect(quoteRegime(null, .8)).toBe('INSUFFICIENT_DATA'); const lifecycle = resolveQuoteLifecycle('2026-09-01T00:00:00.000Z', MISSION, [], [], '2026-09-02T00:00:00.000Z'); expect(lifecycle.find((item) => item.checkpoint === 'D1')?.state).toBe('PROSPECTIVE_ONLY'); expect(lifecycle.find((item) => item.checkpoint === 'D3')?.state).toBe('PENDING');
  });
  it('keeps an unresolved community vault out of the verified mission footprint', () => {
    const vault = unavailableAiVault(asset(), '2026-09-01T00:00:00.000Z'); const audit = { inventory_status: 'AVAILABLE', stock_principal_raw: '200', stock_principal_units: '200', stock_total_supply_raw: '1000', stock_total_supply_units: '1000', observed_block: 100 } as any; const footprint = missionStockFootprint(audit, vault, asset()); expect(vault.status).toBe('UNAVAILABLE'); expect(verifyCommunityVaultCandidate('0x3333333333333333333333333333333333333333', CONTRACT)).toBe('UNAVAILABLE'); expect(footprint).toMatchObject({ status: 'PARTIAL', lp_launch_position_raw: '200', vault_raw: null, combined_raw: '200', scoped_footprint_pct: '20', external_liquidity_included: 'NO' }); expect(JSON.stringify(footprint)).not.toContain('backing');
  });
  it('renders immutable cards with source scope and without backing language', () => {
    const quote = { observation_id: 'quote-1', mission_symbol: 'AI', stock_quote_liquidity_share: .8, stock_quote_volume_share: .2, quote_regime: 'STOCK_CAPITAL_ANCHOR_FLOW_MIGRATED', methodology_version: 'rmm-v0.4.2-quote-persistence-v1', observed_at: '2026-09-01T00:00:00.000Z' } as any; const capital = renderCapitalVsFlowCardSvg(quote); expect(capital).toContain('NVDA HOLDS THE CAPITAL.'); expect(capital).toContain('PROVIDER-INDEXED ROLLING 24H'); const footprint = renderMissionFootprintCardSvg({ combined_units: '200', lp_launch_position_units: '200', vault_units: null, scoped_footprint_pct: '20', external_liquidity_included: 'NO', observation_block: 100 } as any); expect(footprint).toContain('NOT BACKING'); expect(footprint.toLowerCase()).not.toContain('backed');
  });
  it('reconciles canonical mint/burn candidates to observed totalSupply change without causal language', () => {
    const history = [{ observed_block: 10, stock_total_supply_raw: '100', observed_at: '2026-09-01T00:00:00.000Z' }, { observed_block: 20, stock_total_supply_raw: '130', observed_at: '2026-09-01T01:00:00.000Z' }] as any; const event = { event_id: 'mint', asset_id: 'asset-nvda', event_type: 'mint', raw_token_amount: '30', block: 15 } as any; const result = reconcileSupplyDelta(history, [event], 'asset-nvda'); expect(result).toMatchObject({ status: 'RECONCILED', observed_total_supply_delta_raw: '30', scanned_mint_burn_net_raw: '30' }); expect(JSON.stringify(result)).not.toContain('caused');
  });
  it('prepares a footprint multiple only with synchronized descriptive inputs', () => {
    expect(missionFootprintMultiple(1_000_000, 100_000, '2026-09-01T00:00:00.000Z', '2026-09-01T00:01:00.000Z')).toBe(10); expect(missionFootprintMultiple(1_000_000, 100_000, '2026-09-01T00:00:00.000Z', '2026-09-01T00:04:01.000Z')).toBeNull();
  });
  it('classifies PLTR topology only when direction and exact contracts support it', () => {
    expect(classifyPltrRelationship({ pltr_contract: CONTRACT, base_contract: MISSION, quote_contract: CONTRACT, mission_provenance_verified: true })).toBe('MISSION_QUOTE');
    expect(classifyPltrRelationship({ pltr_contract: CONTRACT, base_contract: CONTRACT, quote_contract: '0x4444444444444444444444444444444444444444', base_is_canonical_stock: true })).toBe('STOCK_STOCK');
    expect(classifyPltrRelationship({ pltr_contract: CONTRACT, base_contract: CONTRACT, quote_contract: '0x5555555555555555555555555555555555555555' })).toBe('DIRECT_PRICE_DISCOVERY');
  });
  it('constructs a scoped PLTR_PREFLIGHT_STATE and never invents first-party values', () => {
    const pltr = { ...asset(), asset_id: 'asset-pltr', ticker: 'PLTR', canonical_contract: CONTRACT, current_multiplier: '1' }; const pair = { pair_id: 'pair-pltr', stock_asset_id: 'asset-pltr', canonicality: 'verified', verification: { verification_status: 'VERIFIED' }, mission_symbol: 'MISSION', venue: 'PAIR', pool_id: 'pool', } as any;
    const state = buildPltrPreflightState({ asset: pltr, supply: { total_supply_raw: '1000', total_supply_units: '1000', share_equivalent_supply: '1000', observed_block: 100, observed_at: '2026-09-01T00:00:00.000Z', source: 'test', freshness: 'fresh' }, pairs: [pair], inventory: [inventory({ mission_pair_id: 'pair-pltr', stock_asset_id: 'asset-pltr', stock_symbol: 'PLTR', observed_block: 100, stock_principal_raw: '200', stock_principal_units: '200', stock_decimals: 0 })], events: [], markets: [{ relationship: 'DIRECT_PRICE_DISCOVERY', freshness: 'fresh', pool_id: 'direct', pool_address: null, venue: 'V4', dex_version: 'V4', base_contract: CONTRACT, quote_contract: '0x4444444444444444444444444444444444444444', base_symbol: 'PLTR', quote_symbol: 'USDG', quote_direction_verified: false, verification_state: 'DISCOVERED_UNVERIFIED', liquidity_usd: 10, volume_24h_usd: 20, transaction_count: 1, observed_at: '2026-09-01T00:00:00.000Z', source: 'test', pool_state: null, depth_primitive: null }], basis: { value: 0, dex_source: 'test', reference_source: 'test', dex_observed_at: '2026-09-01T00:00:00.000Z', reference_observed_at: '2026-09-01T00:00:00.000Z', status: 'AVAILABLE' }, now: new Date('2026-09-01T01:00:00.000Z') })!;
    expect(state).toMatchObject({ state_type: 'PLTR_PREFLIGHT_STATE', tracked_mission_inventory: { absorption_pct: '20' }, inventory_coverage: { unclassified_raw: '800' }, readiness: { status: 'READY_FOR_SIMULATION' } }); expect(state.first_party_footprint.values_populated).toBe(false); expect(PLTR_CONCENTRATION_SCENARIO_BANDS).toEqual([1, 3, 5, 10, 15, 25]); expect(proposedFirstPartyPltrFootprintSchema().denominator).toBe('CANONICAL_PLTR_TOTAL_SUPPLY_SAME_BLOCK');
  });
});
