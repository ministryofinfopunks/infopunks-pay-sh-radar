import { describe, expect, it } from 'vitest';
import {
  DRAFT_IPX_PLTR_POLICY_VERSION,
  HypotheticalIpxConfigurationSchema,
  InMemoryIpxPltrSimulationStore,
  IPX_ARCHITECTURE_TEMPLATES,
  IPX_PLTR_SIMULATOR_VERSION,
  IpxPltrPreflightSimulatorService,
  IpxPltrSimulationError,
  PLTR_PREFLIGHT_DEMO_FIXTURE,
  PLTR_PREFLIGHT_DEMO_OBSERVATION_ID,
  simulateIpxPltr
} from '../src/services/ipxPltrPreflightSimulatorService';

function config(overrides: Record<string, unknown> = {}) {
  const pltr = String(overrides.pltr_allocated_to_ipx_pltr_liquidity ?? '100');
  const ipx = String(overrides.ipx_allocated_to_ipx_pltr_liquidity ?? '10000');
  return {
    simulation_name: 'conservative illustrative fixture', architecture: 'PLTR_ANCHOR', asset_owner: 'INFOPUNKS', first_party_asset: true,
    ipx_decimals: 18, hypothetical_total_supply: '100000000', hypothetical_circulating_supply_at_launch: '10000000', initial_price_pltr_per_ipx: '0.01',
    pltr_allocated_to_ipx_pltr_liquidity: pltr, ipx_allocated_to_ipx_pltr_liquidity: ipx, pltr_allocated_to_first_party_reserve: '0', other_first_party_ipx_linked_pltr_holdings: [],
    v4_fee: 3000, tick_spacing: 200, hook_configuration: { kind: 'ZERO_HOOK' },
    liquidity_positions: [{ position_id: 'position-1', tick_lower: -60000, tick_upper: -30000, pltr_principal: pltr, ipx_principal: ipx }],
    hypothetical_usdg_execution_market_exists: true, hypothetical_weth_execution_market_exists: true,
    hypothetical_capital_allocation_pct: { pltr: '50', usdg: '30', weth: '20' },
    reserve_policy_metadata: { withdrawal_policy_descriptor: 'hypothetical disclosed reserve policy', custody_descriptor: 'hypothetical custody only', acquisition_policy_descriptor: 'no purchases simulated' },
    reference_trade_notionals_usd: ['1000'], ...overrides
  };
}
function readyOpenSnapshot() { const snapshot = structuredClone(PLTR_PREFLIGHT_DEMO_FIXTURE); snapshot.underlying_session = 'OPEN'; snapshot.basis.session = 'OPEN'; snapshot.underlying_reference!.session = 'OPEN'; snapshot.mission_inventory_coverage = 'VERIFIED'; snapshot.tracked_mission_inventory.status = 'ALIGNED'; snapshot.tracked_mission_inventory.raw_pltr_units = '1'; return snapshot; }

describe('IPX / PLTR Preflight Lab v0.5.0', () => {
  it('requires an explicit immutable snapshot id and rejects latest without resolving state', async () => {
    let resolutions = 0; const service = new IpxPltrPreflightSimulatorService(async () => { resolutions += 1; return PLTR_PREFLIGHT_DEMO_FIXTURE; }, new InMemoryIpxPltrSimulationStore());
    await expect(service.simulate({ hypothetical_configuration: config() })).rejects.toMatchObject({ code: 'EXPLICIT_SNAPSHOT_REQUIRED' });
    await expect(service.simulate({ state_snapshot_id: 'latest', hypothetical_configuration: config() })).rejects.toMatchObject({ code: 'LATEST_NOT_ALLOWED' });
    expect(resolutions).toBe(0);
  });

  it('rejects PARTIAL state with STATE_NOT_READY and accepts READY state', async () => {
    const partial = structuredClone(PLTR_PREFLIGHT_DEMO_FIXTURE); partial.readiness.status = 'PARTIAL'; const store = new InMemoryIpxPltrSimulationStore();
    const rejected = new IpxPltrPreflightSimulatorService(async () => partial, store);
    await expect(rejected.simulate({ state_snapshot_id: partial.observation_id, hypothetical_configuration: config() })).rejects.toMatchObject({ code: 'STATE_NOT_READY' });
    const accepted = new IpxPltrPreflightSimulatorService(async () => PLTR_PREFLIGHT_DEMO_FIXTURE, store);
    await expect(accepted.simulate({ state_snapshot_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, hypothetical_configuration: config() })).resolves.toMatchObject({ record_type: 'PREFLIGHT_SIMULATION_RECORD', state_snapshot_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID });
  });

  it('consumes one immutable state and never resolves individual or newer live fields', async () => {
    const calls: string[] = []; const service = new IpxPltrPreflightSimulatorService(async (id) => { calls.push(id); return structuredClone(PLTR_PREFLIGHT_DEMO_FIXTURE); }, new InMemoryIpxPltrSimulationStore());
    const record = await service.simulate({ pltr_preflight_state_observation_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, hypothetical_ipx_configuration: config() });
    expect(calls).toEqual([PLTR_PREFLIGHT_DEMO_OBSERVATION_ID]); expect(record.result.state_snapshot).toMatchObject({ observation_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, block: 52406504, live_values_used: false, immutable: true });
  });

  it('provides three amount-free architecture structures and a synthetic IPX with no contract', () => {
    expect(Object.keys(IPX_ARCHITECTURE_TEMPLATES)).toEqual(['PLTR_NATIVE', 'PLTR_ANCHOR', 'PLTR_RESERVE_ANCHOR']);
    expect(IPX_ARCHITECTURE_TEMPLATES.PLTR_NATIVE.execution_rails).toEqual(['PLTR']); expect(IPX_ARCHITECTURE_TEMPLATES.PLTR_ANCHOR.execution_rails).toContain('WETH'); expect(IPX_ARCHITECTURE_TEMPLATES.PLTR_RESERVE_ANCHOR.reserve_required).toBe(true);
    const record = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config()); expect(record.result.synthetic_ipx_asset).toMatchObject({ asset_type: 'SYNTHETIC_SIMULATION_ASSET', contract_address: null, deployable: false }); expect(record.result.market.transaction_capability).toBe('NONE_SIMULATION_ONLY');
  });

  it('calculates first-party PLTR footprint, concentration, share-equivalent and reference value from frozen supply', () => {
    const record = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config({ pltr_allocated_to_ipx_pltr_liquidity: '200', ipx_allocated_to_ipx_pltr_liquidity: '20000', pltr_allocated_to_first_party_reserve: '100', other_first_party_ipx_linked_pltr_holdings: [{ descriptor: 'other disclosed holding', pltr_units: '10' }] }));
    expect(record.result.first_party_pltr_footprint).toMatchObject({ lp_pltr_units: '200', reserve_pltr_units: '100', other_pltr_units: '10', total_pltr_units: '310', share_equivalent_units: '310', unclassified_pltr_counted_as_availability: false });
    expect(Number(record.result.first_party_pltr_footprint.canonical_supply_pct)).toBeCloseTo(310 / 7344.12 * 100, 5); expect(record.result.first_party_pltr_footprint.usd_reference_value).toBe('55795.36');
  });

  it('replays +10% and +100% supply without adding PLTR to LP or reserve', () => {
    const record = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config()); const ten = record.result.supply_stress.find((row) => row.scenario === '+10%')!; const double = record.result.supply_stress.find((row) => row.scenario === '+100%')!;
    expect(Number(ten.canonical_supply)).toBeCloseTo(8078.532); expect(Number(double.canonical_supply)).toBeCloseTo(14688.24); expect(ten.first_party_pltr_footprint).toBe('100'); expect(double.lp_or_reserve_change_assumed).toBe(false); expect(Number(double.first_party_concentration_pct)).toBeCloseTo(Number(record.result.first_party_pltr_footprint.canonical_supply_pct) / 2, 5);
  });

  it('separates PLTR price and basis stress from IPX/PLTR relative price', () => {
    const record = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config({ pltr_allocated_to_first_party_reserve: '50' })); const down = record.result.price_stress.find((row) => row.scenario === '-30%')!; const up = record.result.price_stress.find((row) => row.scenario === '+50%')!;
    expect(down.ipx_pltr_relative_price_unchanged).toBe(true); expect(Number(down.ipx_implied_usd)).toBeCloseTo(179.98506427968954066 * .7 * .01, 6); expect(Number(up.ipx_implied_usd)).toBeCloseTo(179.98506427968954066 * 1.5 * .01, 6);
    const plus = record.result.basis_stress.find((row) => row.scenario_bps === 500)!; const minus = record.result.basis_stress.find((row) => row.scenario_bps === -500)!; expect(Number(plus.hypothetical_stock_token_usd)).toBeCloseTo(179.09 * 1.05, 5); expect(Number(minus.hypothetical_stock_token_usd)).toBeCloseTo(179.09 * .95, 5); expect(plus.interpretation).toContain('held constant');
  });

  it('models OPEN, CLOSED, WEEKEND and HOLIDAY without inventing price moves', () => {
    const rows = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config()).result.session_stress; expect(rows.map((row) => row.session)).toEqual(['OPEN', 'CLOSED', 'WEEKEND', 'HOLIDAY']); expect(rows.every((row) => row.underlying_price_move_assumed === false)).toBe(true); expect(rows.find((row) => row.session === 'OPEN')?.simulation_confidence).toBe('HIGH'); expect(rows.find((row) => row.session === 'WEEKEND')?.simulation_confidence).toBe('LOW');
  });

  it('runs symmetric buy and sell stress with exact range crossing and exhaustion evidence', () => {
    const record = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config({ reference_trade_notionals_usd: ['1000', '100000'] })); const buy = record.result.trade_impact.buys[0]; const sell = record.result.trade_impact.sells[0]; const largeSell = record.result.trade_impact.sells[1];
    expect(Number(buy.price_impact_pct)).toBeGreaterThan(0); expect(Number(sell.price_impact_pct)).toBeLessThan(0); expect(buy.ticks_crossed).toBeGreaterThan(0); expect(sell.pltr_principal_change.startsWith('-')).toBe(true); expect(largeSell).toMatchObject({ range_exhausted: true, exceeds_modeled_market_support: true, remaining_active_liquidity: '0' });
  });

  it('reports centered, lower, upper, below and above concentrated-range composition', () => {
    const ranges = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config()).result.range_stress; expect(ranges.map((row) => row.scenario)).toEqual(['CURRENT_PRICE_CENTERED', 'APPROACHING_LOWER_BOUND', 'APPROACHING_UPPER_BOUND', 'BELOW_RANGE', 'ABOVE_RANGE']); expect(ranges.find((row) => row.scenario === 'BELOW_RANGE')?.positions[0]).toMatchObject({ range_state: 'BELOW_RANGE', pltr_principal: '0', active_liquidity: '0' }); expect(ranges.find((row) => row.scenario === 'ABOVE_RANGE')?.positions[0]).toMatchObject({ range_state: 'ABOVE_RANGE', ipx_principal: '0', active_liquidity: '0' });
  });

  it('keeps capital separate from flow, permits route migration, and models reserve separately from LP', () => {
    const record = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config({ pltr_allocated_to_first_party_reserve: '75' })); const migrated = record.result.capital_vs_flow.find((row) => row.scenario === 'PLTR_CAPITAL_CRYPTO_FLOW')!; expect(migrated).toMatchObject({ pltr_capital_share_pct: 80, pltr_flow_share_pct: 25, capital_is_flow: false }); expect(migrated.assessment).toContain('capital anchor'); expect(record.result.route_migration).toHaveLength(4); expect(record.result.route_migration.at(-1)).toMatchObject({ pltr_flow_share_pct: 10, fatal_assumed: false }); expect(record.result.reserve).toMatchObject({ modeled_separately_from_lp: true, pltr_units: '75', purchases_simulated: false });
  });

  it('compares all three architectures in one deterministic request without selecting a launch design', async () => {
    const native = config({ architecture: 'PLTR_NATIVE', hypothetical_usdg_execution_market_exists: false, hypothetical_weth_execution_market_exists: false, hypothetical_capital_allocation_pct: { pltr: '100', usdg: '0', weth: '0' } });
    const anchor = config({ architecture: 'PLTR_ANCHOR' }); const reserve = config({ architecture: 'PLTR_RESERVE_ANCHOR', pltr_allocated_to_first_party_reserve: '50' });
    const service = new IpxPltrPreflightSimulatorService(async () => PLTR_PREFLIGHT_DEMO_FIXTURE, new InMemoryIpxPltrSimulationStore()); const result = await service.compare({ state_snapshot_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, hypothetical_configurations: [native, anchor, reserve] });
    expect(result.record_type).toBe('PREFLIGHT_SIMULATION_COMPARISON'); expect(result.comparison_id).toMatch(/^ipxsimcmp-/); expect(result.comparison_matrix.map((row) => row.architecture)).toEqual(['PLTR_NATIVE', 'PLTR_ANCHOR', 'PLTR_RESERVE_ANCHOR']); expect(result.comparison_matrix[0]).toEqual(expect.objectContaining({ first_party_pltr_footprint: expect.any(String), maximum_absolute_market_impact_pct: expect.any(String), basis_sensitivity: expect.any(String), range_fragility: expect.any(String), route_resilience: expect.any(String), execution_topology: expect.any(String), reserve_dependence: expect.any(String), draft_verdict: expect.any(String) })); expect(result.not_a_launch_architecture_selection).toBe(true);
  });

  it('preserves unclassified PLTR and mission coverage uncertainty as unavailable, not liquidity', () => {
    const record = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config()); expect(record.result.state_snapshot).toMatchObject({ mission_market_accounting: 'PARTIAL', verified_mission_inventory: null, unclassified_pltr: '7344.12' }); expect(record.result.first_party_pltr_footprint.unclassified_pltr_counted_as_availability).toBe(false); expect(record.result.risk_dimensions.find((row) => row.dimension === 'MISSION_INVENTORY_UNCERTAINTY')?.status).toBe('UNAVAILABLE');
  });

  it('emits explicit risk dimensions and deterministic draft ALLOW, DEGRADE, and BLOCK mechanics', () => {
    const allow = simulateIpxPltr(readyOpenSnapshot(), config()); expect(allow.result.risk_dimensions).toHaveLength(10); expect(allow.result.draft_simulation_verdict).toMatchObject({ label: 'DRAFT_SIMULATION_VERDICT', verdict: 'ALLOW', policy_version: DRAFT_IPX_PLTR_POLICY_VERSION, manual_override: 'NOT_AVAILABLE', launch_authorization: false });
    const degrade = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config()); expect(degrade.result.draft_simulation_verdict.verdict).toBe('DEGRADE');
    const block = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config({ pltr_allocated_to_ipx_pltr_liquidity: '2000', ipx_allocated_to_ipx_pltr_liquidity: '200000', pltr_allocated_to_first_party_reserve: '100', reference_trade_notionals_usd: ['1000'] })); expect(block.result.draft_simulation_verdict.verdict).toBe('BLOCK'); expect(block.result.draft_simulation_verdict.triggered_rules.join(' ')).toContain('PLTR_CONCENTRATION');
    const stale = readyOpenSnapshot(); stale.observation!.freshness = 'stale'; const staleResult = simulateIpxPltr(stale, config()); expect(staleResult.result.risk_dimensions.find((row) => row.dimension === 'REFERENCE_FRESHNESS')?.status).toBe('FAIL'); expect(staleResult.result.draft_simulation_verdict.verdict).toBe('BLOCK');
  });

  it('never lets first-party ownership improve or override a BLOCK verdict', () => {
    expect(() => HypotheticalIpxConfigurationSchema.parse({ ...config(), first_party_asset: false })).toThrow(); const record = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config({ pltr_allocated_to_ipx_pltr_liquidity: '2000', ipx_allocated_to_ipx_pltr_liquidity: '200000' })); expect(record.result.exposure_truth.FIRST_PARTY_CONFLICT).toBe('DISCLOSED'); expect(record.result.risk_dimensions.find((row) => row.dimension === 'FIRST_PARTY_CONFLICT')?.evidence).toContain('no score'); expect(record.result.draft_simulation_verdict.verdict).toBe('BLOCK');
  });

  it('is deterministic and persists an idempotent immutable non-protocol record', async () => {
    const first = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config()); const second = simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config()); expect(second).toEqual(first); expect(first.simulation_id).toMatch(/^ipxsim-[a-f0-9]{64}$/); expect(first.configuration_hash).toMatch(/^sha256:/); expect(first.simulator_version).toBe(IPX_PLTR_SIMULATOR_VERSION); expect(first.created_at).toBe(PLTR_PREFLIGHT_DEMO_FIXTURE.observation!.observed_at); expect(first.simulation_id).not.toMatch(/^IP-(?:CALL|RES|GEN)/); expect(first.record_type).toBe('PREFLIGHT_SIMULATION_RECORD');
    const store = new InMemoryIpxPltrSimulationStore(); await expect(store.create(first)).resolves.toEqual(first); await expect(store.create(second)).resolves.toEqual(first); const loaded = await store.get(first.simulation_id); expect(loaded).toEqual(first); (loaded as any).result.exposure_truth.IPX_REDEEMABLE_FOR_PLTR = 'YES'; expect((await store.get(first.simulation_id))!.result.exposure_truth.IPX_REDEEMABLE_FOR_PLTR).toBe('NO');
  });

  it('rejects invalid reserve/template, tick and principal assumptions before simulation', () => {
    expect(() => simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config({ architecture: 'PLTR_RESERVE_ANCHOR' }))).toThrow(IpxPltrSimulationError);
    expect(() => simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, config({ tick_spacing: 700 }))).toThrow(IpxPltrSimulationError);
    const mismatched = { ...config(), liquidity_positions: [{ position_id: 'position-1', tick_lower: -60000, tick_upper: -30000, pltr_principal: '99', ipx_principal: '10000' }] }; expect(() => simulateIpxPltr(PLTR_PREFLIGHT_DEMO_FIXTURE, mismatched)).toThrow(IpxPltrSimulationError);
  });
});
