/** D2 arithmetic only. Inputs are hypothetical atomic units and unapproved policy variables. */
const DENOMINATOR = 10_000n;

export type Atomic = string;
export type ModelAPolicy = {
  buyLevyBps: number;
  sellLevyBps: number;
  reserveShareBps: number;
  burnShareBps: number;
  lockShareBps: number;
};

function units(value: Atomic): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('invalid_atomic_units');
  return BigInt(value);
}

function bps(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) throw new Error('invalid_bps');
  return BigInt(value);
}

/** Each output remains in the input asset's atomic units; no cross-asset valuation is implied. */
export function modelAExactInput(grossBuyPltr: Atomic, grossSellIpx: Atomic, policy: ModelAPolicy) {
  const buy = units(grossBuyPltr);
  const sell = units(grossSellIpx);
  const buyLevy = bps(policy.buyLevyBps);
  const sellLevy = bps(policy.sellLevyBps);
  const reserveShare = bps(policy.reserveShareBps);
  const burnShare = bps(policy.burnShareBps);
  const lockShare = bps(policy.lockShareBps);
  if (burnShare + lockShare > DENOMINATOR) throw new Error('invalid_sell_split');
  const buyFee = buy * buyLevy / DENOMINATOR;
  const reserve = buyFee * reserveShare / DENOMINATOR;
  const sellFee = sell * sellLevy / DENOMINATOR;
  const burn = sellFee * burnShare / DENOMINATOR;
  const lock = sellFee * lockShare / DENOMINATOR;
  return {
    inputType: 'EXACT_INPUT' as const,
    buyPltr: { gross: buy.toString(), fee: buyFee.toString(), swapInput: (buy - buyFee).toString(), reserveCredit: reserve.toString(), otherFeeCredit: (buyFee - reserve).toString() },
    sellIpx: { gross: sell.toString(), fee: sellFee.toString(), swapInput: (sell - sellFee).toString(), burned: burn.toString(), locked: lock.toString(), otherFeeCredit: (sellFee - burn - lock).toString() }
  };
}

export function modelAExactOutput(): never {
  throw new Error('exact_output_requires_reviewed_inversion');
}

export type ModelBCosts = { infra: Atomic; data: Atomic; facilitator: Atomic; refunds: Atomic };
/** Missing costs block allocation. A zero cost is a supplied claim, not proof of its completeness. */
export function modelBContribution(grossUsdG: Atomic, costs: ModelBCosts | null, contributionBps: number) {
  const gross = units(grossUsdG);
  const share = bps(contributionBps);
  if (costs === null) return { state: 'BLOCKED_UNKNOWN_COSTS' as const, net: null, budget: '0' };
  const totalCosts = units(costs.infra) + units(costs.data) + units(costs.facilitator) + units(costs.refunds);
  const net = gross - totalCosts;
  return {
    state: net > 0n ? 'CALCULATED_UNAPPROVED' as const : 'NO_POSITIVE_CONTRIBUTION' as const,
    gross: gross.toString(), costs: totalCosts.toString(), net: net.toString(),
    budget: (net > 0n ? net * share / DENOMINATOR : 0n).toString()
  };
}

export type SourcePosition = {
  asset: 'USDG' | 'PLTR' | 'IPX';
  sourceId: string;
  funded: Atomic;
  reserved: Atomic;
  liabilities: Atomic;
  settledCredit: Atomic;
  state: 'PENDING' | 'RESERVED' | 'SETTLED' | 'FAILED';
};

/** Rejects duplicate attribution, unfunded obligations and credits from failed/pending execution. */
export function proveSourceConservation(positions: readonly SourcePosition[]) {
  const sources = new Set<string>();
  for (const position of positions) {
    // A source cannot be reused under a different asset label or model.
    if (sources.has(position.sourceId)) throw new Error('duplicate_source');
    sources.add(position.sourceId);
    const funded = units(position.funded);
    const reserved = units(position.reserved);
    const liabilities = units(position.liabilities);
    const credit = units(position.settledCredit);
    if (reserved + liabilities + credit > funded) throw new Error('unfunded_obligation');
    if (position.state !== 'SETTLED' && credit !== 0n) throw new Error('unsettled_credit');
    if (position.state === 'FAILED' && reserved !== 0n) throw new Error('failed_reservation');
  }
  return { sourceCount: sources.size, status: 'CONSERVED' as const };
}

export const D2_SCENARIOS = [
  'shallow_liquidity', 'deep_liquidity', 'normal_activity', 'low_activity', 'one_way_flow',
  'repeated_round_trips', 'alternate_pool_bypass', 'mev_or_sandwich', 'stale_quote',
  'asset_freeze', 'usdg_interruption', 'gas_spike', 'loss_or_late_refund',
  'lp_withdrawal', 'accountant_or_signer_outage', 'router_failure'
] as const;

export type Scenario = typeof D2_SCENARIOS[number];
export type ScenarioInput = {
  scenario: Scenario;
  executable: boolean;
  finalityVerified: boolean;
  grossBuyPltr: Atomic;
  grossSellIpx: Atomic;
  grossUsdG: Atomic;
  costs: ModelBCosts | null;
  policyA: ModelAPolicy;
  contributionBps: number;
};

/** Scenario output never asserts an observed venue quote, custody credit or canonical burn. */
export function simulateScenario(input: ScenarioInput) {
  const arithmeticA = modelAExactInput(input.grossBuyPltr, input.grossSellIpx, input.policyA);
  const arithmeticB = modelBContribution(input.grossUsdG, input.costs, input.contributionBps);
  const disposition = !input.executable ? 'BLOCKED_EXECUTION' : !input.finalityVerified ? 'PENDING_FINALITY' : 'ARITHMETIC_ONLY';
  return {
    scenario: input.scenario,
    evidenceClass: 'HYPOTHETICAL_SCENARIO' as const,
    disposition,
    modelA: arithmeticA,
    modelB: arithmeticB,
    verifiedReserveCredit: '0',
    verifiedSupplyBurn: '0'
  };
}
