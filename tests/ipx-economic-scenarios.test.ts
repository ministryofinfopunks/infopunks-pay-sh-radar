import { describe, expect, it } from 'vitest';
import { D2_SCENARIOS, modelAExactInput, modelAExactOutput, modelBContribution, proveSourceConservation, simulateScenario, type ModelAPolicy } from '../src/services/ipxEconomicScenarioService';

const policy: ModelAPolicy = { buyLevyBps: 3333, sellLevyBps: 3333, reserveShareBps: 5000, burnShareBps: 3333, lockShareBps: 3333 };
const costs = { infra: '1', data: '0', facilitator: '0', refunds: '0' };

describe('D2 review-only economics', () => {
  it('floors fees in each asset and assigns every remainder', () => {
    const result = modelAExactInput('101', '101', policy);
    expect(result.buyPltr).toEqual({ gross: '101', fee: '33', swapInput: '68', reserveCredit: '16', otherFeeCredit: '17' });
    expect(result.sellIpx).toEqual({ gross: '101', fee: '33', swapInput: '68', burned: '10', locked: '10', otherFeeCredit: '13' });
  });

  it('checks conservation over varied atomic inputs and fee variables', () => {
    for (let i = 0; i < 500; i++) {
      const gross = String(i * i + 3);
      const result = modelAExactInput(gross, gross, { ...policy, buyLevyBps: i * 19 % 10001, sellLevyBps: i * 13 % 10001 });
      const buy = result.buyPltr;
      const sell = result.sellIpx;
      expect(BigInt(buy.swapInput) + BigInt(buy.reserveCredit) + BigInt(buy.otherFeeCredit)).toBe(BigInt(gross));
      expect(BigInt(sell.swapInput) + BigInt(sell.burned) + BigInt(sell.locked) + BigInt(sell.otherFeeCredit)).toBe(BigInt(gross));
    }
  });

  it('rejects unsupported output trades and invalid inputs', () => {
    expect(() => modelAExactOutput()).toThrow('exact_output_requires_reviewed_inversion');
    expect(() => modelAExactInput('01', '1', policy)).toThrow('invalid_atomic_units');
    expect(() => modelAExactInput('1', '1', { ...policy, burnShareBps: 8000, lockShareBps: 8000 })).toThrow('invalid_sell_split');
    expect(() => modelAExactInput('1', '1', { ...policy, sellLevyBps: 10001 })).toThrow('invalid_bps');
  });

  it('blocks unknown costs and never allocates a loss', () => {
    expect(modelBContribution('100', null, 5000)).toEqual({ state: 'BLOCKED_UNKNOWN_COSTS', net: null, budget: '0' });
    expect(modelBContribution('0', { ...costs, refunds: '100' }, 5000)).toMatchObject({ net: '-101', budget: '0' });
    expect(modelBContribution('101', costs, 3333)).toMatchObject({ net: '100', budget: '33' });
  });

  it('rejects duplicate attribution, unfunded obligations and nonfinal credits', () => {
    const base = { asset: 'USDG' as const, sourceId: 'tx:log:0', funded: '100', reserved: '30', liabilities: '70', settledCredit: '0', state: 'RESERVED' as const };
    expect(proveSourceConservation([base])).toEqual({ sourceCount: 1, status: 'CONSERVED' });
    expect(() => proveSourceConservation([base, { ...base, asset: 'PLTR' }])).toThrow('duplicate_source');
    expect(() => proveSourceConservation([{ ...base, liabilities: '71' }])).toThrow('unfunded_obligation');
    expect(() => proveSourceConservation([{ ...base, settledCredit: '1' }])).toThrow('unfunded_obligation');
    expect(() => proveSourceConservation([{ ...base, reserved: '0', liabilities: '0', settledCredit: '1', state: 'PENDING' }])).toThrow('unsettled_credit');
    expect(() => proveSourceConservation([{ ...base, state: 'FAILED' }])).toThrow('failed_reservation');
  });

  it('marks all required scenarios hypothetical and never credits unverified execution', () => {
    expect(D2_SCENARIOS).toHaveLength(16);
    for (const scenario of D2_SCENARIOS) {
      const result = simulateScenario({ scenario, executable: false, finalityVerified: false, grossBuyPltr: '100', grossSellIpx: '100', grossUsdG: '100', costs, policyA: policy, contributionBps: 5000 });
      expect(result).toMatchObject({ evidenceClass: 'HYPOTHETICAL_SCENARIO', disposition: 'BLOCKED_EXECUTION', verifiedReserveCredit: '0', verifiedSupplyBurn: '0' });
    }
  });
});
