import { describe, expect, it } from 'vitest';
import { InMemoryIpxPltrSimulationStore, PLTR_PREFLIGHT_DEMO_FIXTURE, PLTR_PREFLIGHT_DEMO_OBSERVATION_ID } from '../src/services/ipxPltrPreflightSimulatorService';
import { InMemoryIpxPltrShadowLabStore, IpxPltrShadowLabService, PINNED_CANDIDATE_CONFIGURATIONS, basisRegime } from '../src/services/ipxPltrShadowLabService';

function snapshot(id = PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, updates: Partial<typeof PLTR_PREFLIGHT_DEMO_FIXTURE> = {}) {
  const state = structuredClone(PLTR_PREFLIGHT_DEMO_FIXTURE); state.observation_id = id; state.observation!.observed_at = id === PLTR_PREFLIGHT_DEMO_OBSERVATION_ID ? state.observation!.observed_at : '2026-09-03T07:45:09.000Z'; Object.assign(state, updates); return state;
}

describe('IPX / PLTR Shadow Preflight + Market Capacity Curves v0.5.1', () => {
  it('pins the three v0.5.0 configurations as immutable SHADOW_ONLY records', async () => {
    const service = new IpxPltrShadowLabService(async () => snapshot(), new InMemoryIpxPltrSimulationStore(), new InMemoryIpxPltrShadowLabStore()); const first = await service.pinCandidates(); const second = await service.pinCandidates();
    expect(first.map((item) => item.candidate_id)).toEqual(['CANDIDATE_ANCHOR_V1', 'CANDIDATE_NATIVE_V1', 'CANDIDATE_RESERVE_ANCHOR_V1']); expect(first.every((item) => item.status === 'SHADOW_ONLY' && item.immutable && item.configuration_hash.startsWith('sha256:'))).toBe(true); expect(second).toEqual(first); expect(first.find((item) => item.candidate_id === 'CANDIDATE_NATIVE_V1')?.market_parameters.pltr_allocated_to_ipx_pltr_liquidity).toBe('400'); expect(PINNED_CANDIDATE_CONFIGURATIONS.CANDIDATE_ANCHOR_V1.pltr_allocated_to_ipx_pltr_liquidity).toBe('250');
  });

  it('replays only an explicit READY snapshot, remains deterministic, and rejects PARTIAL', async () => {
    const ready = snapshot(); const partial = snapshot('partial'); partial.readiness.status = 'PARTIAL'; const states = new Map([[ready.observation_id, ready], [partial.observation_id, partial]]); const service = new IpxPltrShadowLabService(async (id) => states.get(id) ?? null, new InMemoryIpxPltrSimulationStore(), new InMemoryIpxPltrShadowLabStore());
    await expect(service.replay('latest')).rejects.toMatchObject({ code: 'LATEST_NOT_ALLOWED' }); await expect(service.replay('partial')).rejects.toMatchObject({ code: 'STATE_NOT_READY' }); const first = await service.replay(ready.observation_id); const second = await service.replay(ready.observation_id); expect(first).toEqual(second); expect(first).toHaveLength(3); expect(first.every((run) => run.record_type === 'SHADOW_PREFLIGHT_RUN' && run.transaction_capability === 'NONE_SIMULATION_ONLY')).toBe(true);
  });

  it('builds a longitudinal series, non-causal associated-input deltas, and an insufficient evidence window without inventing observations', async () => {
    const first = snapshot(); const next = snapshot('pltr-preflight-52406505-20260903074509000'); next.observation!.total_supply_units = '8000'; next.basis.basis_bps = 250; next.basis.session = 'OPEN'; next.underlying_session = 'OPEN'; next.underlying_reference!.session = 'OPEN'; const states = new Map([[first.observation_id, first], [next.observation_id, next]]); const service = new IpxPltrShadowLabService(async (id) => states.get(id) ?? null, new InMemoryIpxPltrSimulationStore(), new InMemoryIpxPltrShadowLabStore()); await service.replay(first.observation_id); await service.replay(next.observation_id); const candidate = (await service.candidates())[0]; const series = await service.series(candidate.configuration_hash); const transitions = await service.transitions(candidate.configuration_hash); const summary = await service.summary(candidate.configuration_hash);
    expect(series).toHaveLength(2); expect(series[1].basis_regime).toBe('MATERIAL_PREMIUM'); expect(transitions[1]).toMatchObject({ transition: `${series[0].draft_verdict}_TO_${series[1].draft_verdict}`, causal_interpretation: 'NOT_ASSERTED' }); expect(transitions[1].associated_input_changes).toEqual(expect.arrayContaining(['PLTR_SUPPLY', 'BASIS', 'SESSION'])); expect(summary.evidence_window.status).toBe('SHADOW_WINDOW_INSUFFICIENT'); expect(summary.profitability_statistics).toBe('NOT_OUTPUT'); expect(summary.launch_authorization).toBe(false);
  });

  it('runs a separated research sweep with buy/sell curves, supply denominator replay, reserve separation, and no execution authority', async () => {
    const service = new IpxPltrShadowLabService(async () => snapshot(), new InMemoryIpxPltrSimulationStore(), new InMemoryIpxPltrShadowLabStore()); const sweep = await service.capacitySweep(PLTR_PREFLIGHT_DEMO_OBSERVATION_ID);
    expect(sweep).toMatchObject({ record_type: 'MARKET_CAPACITY_SWEEP', research_only: true, not_an_optimizer: true, no_launch_authorization: true }); expect(sweep.scenarios).toHaveLength(560); const wide = sweep.scenarios.find((row) => row.pltr_lp_principal === '100' && row.range_family === 'WIDE' && row.supply_growth === '+100%' && row.direct_market_depth_growth === 'CONSTANT')!; expect(wide.buy_impact_curve.length).toBeGreaterThan(0); expect(wide.sell_impact_curve.length).toBeGreaterThan(0); expect(wide.frontier.record_type).toBe('CAPACITY_FRONTIER_OBSERVATION'); expect(wide.capital_anchor_flow_test.map((row) => row.pltr_flow_share_pct)).toEqual([100, 75, 50, 25, 10]); const reserve = sweep.scenarios.find((row) => row.pltr_lp_principal === '100' && row.range_family === 'WIDE' && row.supply_growth === 'CURRENT' && row.direct_market_depth_growth === 'CONSTANT')!; expect(reserve.principal_requirements.pltr).toBe('100'); expect(reserve.first_party_concentration_pct).not.toBe('0');
  }, 30_000);

  it('keeps basis bands transparent and uses no causal or profitability signal', () => {
    expect(basisRegime(0)).toBe('NEAR_PAR'); expect(basisRegime(50)).toBe('MODERATE_PREMIUM'); expect(basisRegime(-200)).toBe('MATERIAL_DISCOUNT');
  });
});
