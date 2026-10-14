/**
 * D2 review-only economic arithmetic.  This module accepts atomic integer
 * amounts and unapproved variables; it never constructs a transaction or
 * represents a launch configuration.
 */
export const ECONOMIC_BPS_DENOMINATOR = 10_000n;

export type ScenarioLabel =
  | 'SHALLOW_LIQUIDITY' | 'DEEP_LIQUIDITY' | 'NORMAL_ACTIVITY' | 'LOW_ACTIVITY'
  | 'ONE_WAY_FLOW' | 'REPEATED_ROUND_TRIP' | 'ALTERNATE_POOL_BYPASS'
  | 'MEV_OR_SANDWICH' | 'STALE_QUOTE' | 'ASSET_FREEZE_OR_RESTRICTION'
  | 'USDG_INTERRUPTION' | 'GAS_SPIKE' | 'ACCOUNTING_LOSS_OR_LATE_REFUND'
  | 'LP_WITHDRAWAL' | 'ACCOUNTANT_OR_SIGNER_OUTAGE' | 'ROUTER_FAILURE';

/** Required D2 matrix. These are scenarios, not measured market observations. */
export const D2_SCENARIO_MATRIX: ReadonlyArray<{ label: ScenarioLabel; observation: 'SCENARIO_ONLY' }> = [
  'SHALLOW_LIQUIDITY', 'DEEP_LIQUIDITY', 'NORMAL_ACTIVITY', 'LOW_ACTIVITY', 'ONE_WAY_FLOW', 'REPEATED_ROUND_TRIP',
  'ALTERNATE_POOL_BYPASS', 'MEV_OR_SANDWICH', 'STALE_QUOTE', 'ASSET_FREEZE_OR_RESTRICTION', 'USDG_INTERRUPTION',
  'GAS_SPIKE', 'ACCOUNTING_LOSS_OR_LATE_REFUND', 'LP_WITHDRAWAL', 'ACCOUNTANT_OR_SIGNER_OUTAGE', 'ROUTER_FAILURE'
].map(label => ({ label: label as ScenarioLabel, observation: 'SCENARIO_ONLY' }));

export class EconomicScenarioError extends Error {
  constructor(readonly code: 'invalid_atomic_amount' | 'invalid_bps' | 'invalid_sell_split' | 'unsupported_exact_output' | 'duplicate_source' | 'unfunded_liabilities') { super(code); }
}

function amount(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new EconomicScenarioError('invalid_atomic_amount');
  return BigInt(value);
}
function bps(value: number): bigint {
  if (!Number.isInteger(value) || value < 0 || value > Number(ECONOMIC_BPS_DENOMINATOR)) throw new EconomicScenarioError('invalid_bps');
  return BigInt(value);
}

export type ModelAExactInput = {
  gross_buy_pltr_atomic: string; gross_sell_ipx_atomic: string;
  buy_levy_bps: number; sell_levy_bps: number; reserve_share_bps: number;
  sell_burn_share_bps: number; sell_lock_share_bps: number;
};

/** Implements only the exact-input equations in the economic specification. */
export function modelAExactInput(input: ModelAExactInput) {
  const grossBuy = amount(input.gross_buy_pltr_atomic), grossSell = amount(input.gross_sell_ipx_atomic);
  const buyLevy = bps(input.buy_levy_bps), sellLevy = bps(input.sell_levy_bps);
  const reserveShare = bps(input.reserve_share_bps), burnShare = bps(input.sell_burn_share_bps), lockShare = bps(input.sell_lock_share_bps);
  if (burnShare + lockShare > ECONOMIC_BPS_DENOMINATOR) throw new EconomicScenarioError('invalid_sell_split');
  const buy_fee_pltr = grossBuy * buyLevy / ECONOMIC_BPS_DENOMINATOR;
  const reserve_credit = buy_fee_pltr * reserveShare / ECONOMIC_BPS_DENOMINATOR;
  const sell_fee_ipx = grossSell * sellLevy / ECONOMIC_BPS_DENOMINATOR;
  const ipx_burn = sell_fee_ipx * burnShare / ECONOMIC_BPS_DENOMINATOR;
  const ipx_lock = sell_fee_ipx * lockShare / ECONOMIC_BPS_DENOMINATOR;
  return {
    model: 'A' as const, execution_type: 'EXACT_INPUT' as const,
    buy: { gross_pltr_atomic: grossBuy.toString(), buy_fee_pltr_atomic: buy_fee_pltr.toString(), pltr_swap_input_atomic: (grossBuy - buy_fee_pltr).toString(), reserve_credit_pltr_atomic: reserve_credit.toString(), other_fee_credit_pltr_atomic: (buy_fee_pltr - reserve_credit).toString() },
    sell: { gross_ipx_atomic: grossSell.toString(), sell_fee_ipx_atomic: sell_fee_ipx.toString(), ipx_swap_input_atomic: (grossSell - sell_fee_ipx).toString(), ipx_burn_atomic: ipx_burn.toString(), ipx_lock_atomic: ipx_lock.toString(), ipx_other_atomic: (sell_fee_ipx - ipx_burn - ipx_lock).toString() }
  };
}

/** Exact-output fee inversion and ceiling behavior need an audited venue design. */
export function rejectModelAExactOutput(): never { throw new EconomicScenarioError('unsupported_exact_output'); }

export type ModelBCosts = { infra_atomic: string; data_atomic: string; facilitator_atomic: string; refunds_atomic: string };
export function modelBContribution(gross_usdg_atomic: string, costs: ModelBCosts | null, contribution_bps: number) {
  const gross = amount(gross_usdg_atomic), ratio = bps(contribution_bps);
  if (costs === null) return { model: 'B' as const, allocation_state: 'BLOCKED_UNKNOWN_COSTS' as const, gross_usdg_atomic: gross.toString(), net_usdg_atomic: null, purchase_budget_usdg_atomic: '0' };
  const total = amount(costs.infra_atomic) + amount(costs.data_atomic) + amount(costs.facilitator_atomic) + amount(costs.refunds_atomic);
  const net = gross - total;
  return { model: 'B' as const, allocation_state: net > 0n ? 'ELIGIBLE_PENDING_APPROVAL' as const : 'NO_POSITIVE_CONTRIBUTION' as const, gross_usdg_atomic: gross.toString(), costs_usdg_atomic: total.toString(), net_usdg_atomic: net.toString(), purchase_budget_usdg_atomic: (net > 0n ? net * ratio / ECONOMIC_BPS_DENOMINATOR : 0n).toString() };
}

export type SourceAllocation = { source_id: string; funded_atomic: string; reserved_atomic: string; liabilities_atomic: string; execution_state: 'RESERVED' | 'SETTLED' | 'FAILED' | 'PENDING' };
/** Checks per-asset units; callers must never combine USDG, PLTR, and IPX. */
export function proveSourceConservation(allocations: SourceAllocation[]) {
  const seen = new Set<string>();
  for (const entry of allocations) {
    if (seen.has(entry.source_id)) throw new EconomicScenarioError('duplicate_source');
    seen.add(entry.source_id);
    const funded = amount(entry.funded_atomic), reserved = amount(entry.reserved_atomic), liabilities = amount(entry.liabilities_atomic);
    if (reserved + liabilities > funded) throw new EconomicScenarioError('unfunded_liabilities');
    if (entry.execution_state === 'FAILED' && reserved !== 0n) throw new EconomicScenarioError('unfunded_liabilities');
  }
  return { proof: 'PER_SOURCE_ATOMIC_CONSERVATION' as const, source_count: allocations.length, duplicate_sources: false, failed_execution_credit: '0' };
}
