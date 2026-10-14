import { describe, expect, it } from 'vitest';
import { D2_SCENARIO_MATRIX, EconomicScenarioError, modelAExactInput, modelBContribution, proveSourceConservation, rejectModelAExactOutput } from '../src/services/ipxEconomicScenarioService';

describe('D2 economic scenarios and conservation proofs', () => {
  it('covers the required scenario matrix and labels every row as a scenario', () => {
    expect(D2_SCENARIO_MATRIX).toHaveLength(16);
    expect(D2_SCENARIO_MATRIX.every(row => row.observation === 'SCENARIO_ONLY')).toBe(true);
  });
  it('uses integer floor rounding and conserves each Model A fee unit', () => {
    const result = modelAExactInput({ gross_buy_pltr_atomic: '101', gross_sell_ipx_atomic: '101', buy_levy_bps: 3333, sell_levy_bps: 3333, reserve_share_bps: 5000, sell_burn_share_bps: 3333, sell_lock_share_bps: 3333 });
    expect(result.buy).toEqual({ gross_pltr_atomic: '101', buy_fee_pltr_atomic: '33', pltr_swap_input_atomic: '68', reserve_credit_pltr_atomic: '16', other_fee_credit_pltr_atomic: '17' });
    expect(result.sell).toEqual({ gross_ipx_atomic: '101', sell_fee_ipx_atomic: '33', ipx_swap_input_atomic: '68', ipx_burn_atomic: '10', ipx_lock_atomic: '10', ipx_other_atomic: '13' });
  });
  it('rejects invalid allocation splits and unsupported exact-output trades', () => {
    expect(() => modelAExactInput({ gross_buy_pltr_atomic: '1', gross_sell_ipx_atomic: '1', buy_levy_bps: 0, sell_levy_bps: 0, reserve_share_bps: 0, sell_burn_share_bps: 5001, sell_lock_share_bps: 5000 })).toThrow('invalid_sell_split');
    expect(() => rejectModelAExactOutput()).toThrow('unsupported_exact_output');
  });
  it('blocks unknown B costs and clips negative contribution to a zero budget', () => {
    expect(modelBContribution('100', null, 5000)).toMatchObject({ allocation_state: 'BLOCKED_UNKNOWN_COSTS', purchase_budget_usdg_atomic: '0' });
    expect(modelBContribution('100', { infra_atomic: '101', data_atomic: '0', facilitator_atomic: '0', refunds_atomic: '0' }, 5000)).toMatchObject({ allocation_state: 'NO_POSITIVE_CONTRIBUTION', net_usdg_atomic: '-1', purchase_budget_usdg_atomic: '0' });
    expect(modelBContribution('101', { infra_atomic: '1', data_atomic: '0', facilitator_atomic: '0', refunds_atomic: '0' }, 3333)).toMatchObject({ purchase_budget_usdg_atomic: '33' });
  });
  it('proves each source only once, rejects over-allocation, and leaves failed swaps with zero credit', () => {
    expect(proveSourceConservation([{ source_id: 'a', funded_atomic: '100', reserved_atomic: '20', liabilities_atomic: '80', execution_state: 'PENDING' }, { source_id: 'b', funded_atomic: '50', reserved_atomic: '0', liabilities_atomic: '0', execution_state: 'FAILED' }])).toMatchObject({ duplicate_sources: false, failed_execution_credit: '0' });
    expect(() => proveSourceConservation([{ source_id: 'a', funded_atomic: '1', reserved_atomic: '0', liabilities_atomic: '0', execution_state: 'RESERVED' }, { source_id: 'a', funded_atomic: '1', reserved_atomic: '0', liabilities_atomic: '0', execution_state: 'RESERVED' }])).toThrow(EconomicScenarioError);
    expect(() => proveSourceConservation([{ source_id: 'a', funded_atomic: '10', reserved_atomic: '8', liabilities_atomic: '3', execution_state: 'RESERVED' }])).toThrow('unfunded_liabilities');
    expect(() => proveSourceConservation([{ source_id: 'a', funded_atomic: '10', reserved_atomic: '1', liabilities_atomic: '0', execution_state: 'FAILED' }])).toThrow('unfunded_liabilities');
  });
});
