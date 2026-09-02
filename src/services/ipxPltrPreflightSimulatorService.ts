import { createHash } from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import { PLTR_CONCENTRATION_SCENARIO_BANDS, type PltrPreflightState, type PltrSession } from './rhChainPltrPreflightService';
import { reconstructPositionPrincipal, sqrtRatioAtTick } from './rhChainReflexiveRadarService';

/**
 * IPX / PLTR Preflight Lab v0.5.0 is a pure, read-only model. It has no wallet,
 * signer, RPC, contract address, router, approval, or transaction dependency.
 */
export const IPX_PLTR_SIMULATOR_VERSION = 'ipx-pltr-preflight-simulator-v0.5.0';
export const DRAFT_IPX_PLTR_POLICY_VERSION = 'DRAFT_IPX_PLTR_PREFLIGHT_POLICY_V0';
export const PLTR_PREFLIGHT_DEMO_OBSERVATION_ID = 'pltr-preflight-52406504-20260902074509000';
export const SYNTHETIC_IPX_ASSET = { asset_type: 'SYNTHETIC_SIMULATION_ASSET', symbol: 'IPX', contract_address: null, deployable: false } as const;
export const IPX_ARCHITECTURE_TEMPLATES = {
  PLTR_NATIVE: { canonical_identity_market: 'IPX/PLTR', capital_anchor: 'PLTR', execution_rails: ['PLTR'], reserve_required: false },
  PLTR_ANCHOR: { canonical_identity_market: 'IPX/PLTR', capital_anchor: 'PLTR', execution_rails: ['PLTR', 'USDG', 'WETH'], reserve_required: false },
  PLTR_RESERVE_ANCHOR: { canonical_identity_market: 'IPX/PLTR', capital_anchor: 'PLTR_LP_PLUS_SEPARATE_RESERVE', execution_rails: ['USDG', 'WETH'], reserve_required: true }
} as const;

const decimal = z.union([z.string(), z.number()]).transform((value) => String(value)).pipe(z.string().regex(/^\d+(?:\.\d+)?$/));
const percent = decimal.refine((value) => Number(value) >= 0 && Number(value) <= 100, 'percentage_out_of_range');
const positionSchema = z.object({
  position_id: z.string().trim().min(1).max(80),
  tick_lower: z.number().int().min(-887272).max(887272),
  tick_upper: z.number().int().min(-887272).max(887272),
  pltr_principal: decimal,
  ipx_principal: decimal
}).strict().refine((value) => value.tick_lower < value.tick_upper, 'invalid_tick_range');

export const HypotheticalIpxConfigurationSchema = z.object({
  simulation_name: z.string().trim().min(1).max(120),
  architecture: z.enum(['PLTR_NATIVE', 'PLTR_ANCHOR', 'PLTR_RESERVE_ANCHOR', 'CUSTOM']),
  asset_owner: z.literal('INFOPUNKS'),
  first_party_asset: z.literal(true),
  ipx_decimals: z.number().int().min(0).max(30),
  hypothetical_total_supply: decimal,
  hypothetical_circulating_supply_at_launch: decimal,
  initial_price_pltr_per_ipx: decimal.refine((value) => Number(value) > 0, 'price_must_be_positive'),
  pltr_allocated_to_ipx_pltr_liquidity: decimal,
  ipx_allocated_to_ipx_pltr_liquidity: decimal,
  pltr_allocated_to_first_party_reserve: decimal,
  other_first_party_ipx_linked_pltr_holdings: z.array(z.object({ descriptor: z.string().trim().min(1).max(200), pltr_units: decimal }).strict()).max(20).default([]),
  v4_fee: z.number().int().min(0).max(1_000_000),
  tick_spacing: z.number().int().min(1).max(32767),
  hook_configuration: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ZERO_HOOK') }).strict(),
    z.object({ kind: z.literal('FUTURE_SAFE'), descriptor: z.string().trim().min(1).max(240), hook_address: z.null() }).strict()
  ]),
  liquidity_positions: z.array(positionSchema).min(1).max(24),
  hypothetical_usdg_execution_market_exists: z.boolean(),
  hypothetical_weth_execution_market_exists: z.boolean(),
  hypothetical_capital_allocation_pct: z.object({ pltr: percent, usdg: percent, weth: percent }).strict(),
  reserve_policy_metadata: z.object({
    withdrawal_policy_descriptor: z.string().trim().min(1).max(240),
    custody_descriptor: z.string().trim().min(1).max(240),
    acquisition_policy_descriptor: z.string().trim().min(1).max(240)
  }).strict(),
  reference_trade_notionals_usd: z.array(decimal.refine((value) => Number(value) > 0)).min(1).max(20).default(['1000', '5000', '10000', '25000', '50000', '100000'])
}).strict().superRefine((value, context) => {
  const scale = (input: string, decimals: number) => parseUnits(input, decimals);
  if (scale(value.hypothetical_circulating_supply_at_launch, value.ipx_decimals) > scale(value.hypothetical_total_supply, value.ipx_decimals)) context.addIssue({ code: 'custom', message: 'circulating_supply_exceeds_total_supply' });
  if (value.v4_fee >= 1_000_000) context.addIssue({ code: 'custom', message: 'fee_consumes_entire_input' });
  for (const position of value.liquidity_positions) if (position.tick_lower % value.tick_spacing !== 0 || position.tick_upper % value.tick_spacing !== 0) context.addIssue({ code: 'custom', message: `position_ticks_not_aligned:${position.position_id}` });
  const pltrPositions = value.liquidity_positions.reduce((sum, item) => sum + parseUnits(item.pltr_principal, 18), 0n);
  const ipxPositions = value.liquidity_positions.reduce((sum, item) => sum + parseUnits(item.ipx_principal, value.ipx_decimals), 0n);
  if (pltrPositions !== parseUnits(value.pltr_allocated_to_ipx_pltr_liquidity, 18)) context.addIssue({ code: 'custom', message: 'pltr_position_principal_mismatch' });
  if (ipxPositions !== parseUnits(value.ipx_allocated_to_ipx_pltr_liquidity, value.ipx_decimals)) context.addIssue({ code: 'custom', message: 'ipx_position_principal_mismatch' });
  const capital = ['pltr', 'usdg', 'weth'].reduce((sum, key) => sum + parseUnits(value.hypothetical_capital_allocation_pct[key as 'pltr' | 'usdg' | 'weth'], 6), 0n);
  if (capital !== parseUnits('100', 6)) context.addIssue({ code: 'custom', message: 'capital_allocation_must_equal_100_percent' });
  if (!value.hypothetical_usdg_execution_market_exists && Number(value.hypothetical_capital_allocation_pct.usdg) > 0) context.addIssue({ code: 'custom', message: 'usdg_capital_requires_execution_market' });
  if (!value.hypothetical_weth_execution_market_exists && Number(value.hypothetical_capital_allocation_pct.weth) > 0) context.addIssue({ code: 'custom', message: 'weth_capital_requires_execution_market' });
  if (value.architecture === 'PLTR_RESERVE_ANCHOR' && parseUnits(value.pltr_allocated_to_first_party_reserve, 18) === 0n) context.addIssue({ code: 'custom', message: 'reserve_anchor_requires_nonzero_separate_reserve' });
});

export type HypotheticalIpxConfiguration = z.infer<typeof HypotheticalIpxConfigurationSchema>;
export type RiskStatus = 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE';
export type DraftVerdict = 'ALLOW' | 'DEGRADE' | 'BLOCK';
export type TradeImpactResult = {
  direction: 'BUY_IPX_WITH_PLTR' | 'SELL_IPX_FOR_PLTR'; notional_usd: string; starting_price_pltr_per_ipx: string; ending_price_pltr_per_ipx: string;
  price_impact_pct: string; ticks_crossed: number; range_exhausted: boolean; pltr_principal_change: string; ipx_principal_change: string;
  remaining_active_liquidity: string; exceeds_modeled_market_support: boolean; unprocessed_input: string;
};
export type RiskDimension = { dimension: 'PLTR_CONCENTRATION' | 'MARKET_IMPACT' | 'RANGE_FRAGILITY' | 'BASIS_EXPOSURE' | 'SESSION_RISK' | 'REFERENCE_FRESHNESS' | 'QUOTE_TOPOLOGY_DEPENDENCE' | 'SUPPLY_ELASTICITY_SENSITIVITY' | 'FIRST_PARTY_CONFLICT' | 'MISSION_INVENTORY_UNCERTAINTY'; status: RiskStatus; evidence: string };

export type PreflightSimulationRecord = {
  record_type: 'PREFLIGHT_SIMULATION_RECORD'; simulation_id: string; state_snapshot_id: string; configuration_hash: string;
  simulator_version: typeof IPX_PLTR_SIMULATOR_VERSION; draft_policy_version: typeof DRAFT_IPX_PLTR_POLICY_VERSION; created_at: string; immutable: true;
  configuration: HypotheticalIpxConfiguration;
  result: {
    methodology_version: typeof IPX_PLTR_SIMULATOR_VERSION; state_snapshot: { observation_id: string; block: number; observed_at: string; canonical_pltr_contract: string; canonical_pltr_total_supply: string; share_equivalent_supply: string; multiplier: string; direct_pltr_usdg_price: string; underlying_midpoint_usd: string; basis_bps: string; session: PltrSession; mission_market_accounting: string; verified_mission_inventory: string | null; unclassified_pltr: string | null; immutable: true; live_values_used: false };
    synthetic_ipx_asset: typeof SYNTHETIC_IPX_ASSET & { decimals: number };
    market: { token_ordering: ['IPX', 'PLTR']; synthetic_pool_key: { currency0: 'SYNTHETIC:IPX'; currency1: string; fee: number; tick_spacing: number; hooks: string }; starting_tick: number; starting_sqrt_price_x96: string; active_liquidity: string; positions: PositionModel[]; transaction_capability: 'NONE_SIMULATION_ONLY' };
    first_party_pltr_footprint: { lp_pltr_units: string; reserve_pltr_units: string; other_pltr_units: string; total_pltr_units: string; share_equivalent_units: string; usd_reference_value: string; canonical_supply_pct: string; reference_band: string; unclassified_pltr_counted_as_availability: false };
    trade_impact: { buys: TradeImpactResult[]; sells: TradeImpactResult[]; higher_impact_is_risk: true };
    supply_stress: SupplyStress[]; price_stress: PriceStress[]; basis_stress: BasisStress[]; session_stress: SessionStress[]; capital_vs_flow: CapitalFlowStress[]; route_migration: RouteMigrationStress[]; range_stress: RangeStress[];
    reserve: { modeled_separately_from_lp: true; pltr_units: string; usd_reference_value: string; canonical_supply_pct: string; withdrawal_policy_descriptor: string; custody_descriptor: string; acquisition_policy_descriptor: string; purchases_simulated: false };
    exposure_truth: Record<string, string>;
    risk_dimensions: RiskDimension[];
    draft_simulation_verdict: { label: 'DRAFT_SIMULATION_VERDICT'; verdict: DraftVerdict; triggered_rules: string[]; inputs: { state_snapshot_id: string; configuration_hash: string }; methodology_version: typeof IPX_PLTR_SIMULATOR_VERSION; policy_version: typeof DRAFT_IPX_PLTR_POLICY_VERSION; manual_override: 'NOT_AVAILABLE'; launch_authorization: false };
  };
};
export type PreflightSimulationComparison = { record_type: 'PREFLIGHT_SIMULATION_COMPARISON'; comparison_id: string; state_snapshot_id: string; simulator_version: typeof IPX_PLTR_SIMULATOR_VERSION; draft_policy_version: typeof DRAFT_IPX_PLTR_POLICY_VERSION; immutable: true; simulations: PreflightSimulationRecord[]; comparison_matrix: Array<{ architecture: HypotheticalIpxConfiguration['architecture']; simulation_id: string; first_party_pltr_footprint: string; first_party_concentration_pct: string; maximum_absolute_market_impact_pct: string; basis_sensitivity: string; range_fragility: RiskStatus; route_resilience: string; execution_topology: string; reserve_dependence: string; draft_verdict: DraftVerdict }>; most_robust_under_draft_policy: HypotheticalIpxConfiguration['architecture'] | null; not_a_launch_architecture_selection: true };

type PositionModel = { position_id: string; tick_lower: number; tick_upper: number; liquidity: string; proposed_pltr_principal: string; proposed_ipx_principal: string; modeled_pltr_principal: string; modeled_ipx_principal: string; pltr_principal_utilization_pct: string; ipx_principal_utilization_pct: string; range_state: 'BELOW_RANGE' | 'IN_RANGE' | 'ABOVE_RANGE' };
type SupplyStress = { scenario: 'CURRENT_SUPPLY' | '+10%' | '+25%' | '+50%' | '+100%'; canonical_supply: string; first_party_pltr_footprint: string; first_party_concentration_pct: string; tracked_ipx_pltr_market_concentration_pct: string; lp_or_reserve_change_assumed: false };
type PriceStress = { scenario: '-30%' | '-15%' | '-5%' | 'CURRENT' | '+10%' | '+25%' | '+50%'; hypothetical_pltr_usd: string; ipx_implied_usd: string; pltr_reserve_usd: string; pltr_lp_usd: string; ipx_pltr_relative_price_unchanged: true; mission_alpha_decomposition: { status: 'NOT_CALCULATED'; reason: string } };
type BasisStress = { scenario_bps: number; hypothetical_stock_token_usd: string; underlying_reference_usd: string; ipx_implied_usd: string; reserve_nav_context_usd: string; interpretation: string };
type SessionStress = { session: Exclude<PltrSession, 'UNKNOWN'>; reference_freshness_expectation: string; basis_risk_warning: string | null; simulation_confidence: 'HIGH' | 'MEDIUM' | 'LOW'; underlying_price_move_assumed: false };
type CapitalFlowStress = { scenario: 'PLTR_CAPITAL_PLTR_FLOW' | 'PLTR_CAPITAL_CRYPTO_FLOW' | 'PLTR_MINORITY_CRYPTO_FLOW' | 'BALANCED_TOPOLOGY'; pltr_capital_share_pct: number; pltr_flow_share_pct: number; assessment: string; capital_is_flow: false };
type RouteMigrationStress = { pltr_flow_share_pct: 80 | 50 | 25 | 10; canonical_identity_market_preserved: boolean; pltr_footprint_preserved: true; capital_anchor_preserved: boolean; usable_execution_routes: string[]; fatal_assumed: false };
type RangeStress = { scenario: 'CURRENT_PRICE_CENTERED' | 'APPROACHING_LOWER_BOUND' | 'APPROACHING_UPPER_BOUND' | 'BELOW_RANGE' | 'ABOVE_RANGE'; positions: Array<{ position_id: string; range_state: 'BELOW_RANGE' | 'IN_RANGE' | 'ABOVE_RANGE'; pltr_principal: string; ipx_principal: string; active_liquidity: string }>; total_pltr_principal: string; total_ipx_principal: string; active_liquidity: string };

const Q96 = 2n ** 96n;
const FEE_DENOMINATOR = 1_000_000n;
const ONE_18 = 10n ** 18n;

function parseUnits(value: string, decimals: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new RangeError(`too_many_decimal_places:${value}`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
}
function formatUnits(value: bigint, decimals: number, precision = Math.min(decimals, 8)): string {
  const sign = value < 0n ? '-' : ''; const absolute = value < 0n ? -value : value; const base = 10n ** BigInt(decimals);
  const whole = absolute / base; const fraction = (absolute % base).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}
function mulDiv(a: bigint, b: bigint, denominator: bigint) { return denominator === 0n ? 0n : a * b / denominator; }
function ratioPct(part: bigint, whole: bigint) { return whole === 0n ? '0' : formatUnits(part * 100n * ONE_18 / whole, 18, 6); }
function integerSqrt(value: bigint): bigint { if (value < 0n) throw new RangeError('negative_sqrt'); if (value < 2n) return value; let x = 1n << BigInt((value.toString(2).length + 1) >> 1); let y = (x + value / x) >> 1n; while (y < x) { x = y; y = (x + value / x) >> 1n; } return x; }
function sqrtPriceFromHumanPrice(price: string, ipxDecimals: number): bigint {
  const price18 = parseUnits(price, 18); const numerator = price18 * 10n ** 18n * Q96 * Q96; const denominator = 10n ** BigInt(ipxDecimals) * ONE_18; return integerSqrt(numerator / denominator);
}
function tickAtSqrtRatio(sqrt: bigint): number { let low = -887272; let high = 887272; while (low < high) { const mid = Math.ceil((low + high) / 2); if (sqrtRatioAtTick(mid) <= sqrt) low = mid; else high = mid - 1; } return low; }
function priceAtSqrt(sqrt: bigint, ipxDecimals: number): string {
  const rawRatio18 = sqrt * sqrt * ONE_18 / (Q96 * Q96); const human18 = rawRatio18 * 10n ** BigInt(ipxDecimals) / 10n ** 18n; return formatUnits(human18, 18, 12);
}
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`; if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`; return JSON.stringify(value); }
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function clone<T>(value: T): T { return structuredClone(value); }
function sumDecimal(values: string[], decimals: number) { return formatUnits(values.reduce((sum, value) => sum + parseUnits(value, decimals), 0n), decimals); }

function positionLiquidity(position: HypotheticalIpxConfiguration['liquidity_positions'][number], sqrt: bigint, ipxDecimals: number) {
  const lower = sqrtRatioAtTick(position.tick_lower); const upper = sqrtRatioAtTick(position.tick_upper); const amount0 = parseUnits(position.ipx_principal, ipxDecimals); const amount1 = parseUnits(position.pltr_principal, 18);
  let from0 = 2n ** 255n; let from1 = 2n ** 255n;
  if (sqrt < upper) { const start = sqrt <= lower ? lower : sqrt; from0 = amount0 * start * upper / Q96 / (upper - start); }
  if (sqrt > lower) { const end = sqrt >= upper ? upper : sqrt; from1 = amount1 * Q96 / (end - lower); }
  const liquidity = from0 < from1 ? from0 : from1;
  return liquidity === 2n ** 255n ? 0n : liquidity;
}
function positionModels(configuration: HypotheticalIpxConfiguration, sqrt: bigint): PositionModel[] {
  return configuration.liquidity_positions.map((position) => {
    const liquidity = positionLiquidity(position, sqrt, configuration.ipx_decimals); const principal = reconstructPositionPrincipal(liquidity, position.tick_lower, position.tick_upper, sqrt);
    const proposedPltr = parseUnits(position.pltr_principal, 18); const proposedIpx = parseUnits(position.ipx_principal, configuration.ipx_decimals);
    return { position_id: position.position_id, tick_lower: position.tick_lower, tick_upper: position.tick_upper, liquidity: String(liquidity), proposed_pltr_principal: position.pltr_principal, proposed_ipx_principal: position.ipx_principal, modeled_pltr_principal: formatUnits(principal.amount1, 18), modeled_ipx_principal: formatUnits(principal.amount0, configuration.ipx_decimals), pltr_principal_utilization_pct: ratioPct(principal.amount1, proposedPltr), ipx_principal_utilization_pct: ratioPct(principal.amount0, proposedIpx), range_state: principal.range_state };
  });
}
function activeLiquidity(positions: PositionModel[], tick: number) { return positions.filter((position) => tick >= position.tick_lower && tick < position.tick_upper).reduce((sum, position) => sum + BigInt(position.liquidity), 0n); }

function simulateTrade(direction: TradeImpactResult['direction'], notionalUsd: string, configuration: HypotheticalIpxConfiguration, positions: PositionModel[], startSqrt: bigint, pltrUsd18: bigint): TradeImpactResult {
  const startTick = tickAtSqrtRatio(startSqrt); const inputRaw = direction === 'BUY_IPX_WITH_PLTR'
    ? parseUnits(notionalUsd, 18) * ONE_18 / pltrUsd18
    : parseUnits(notionalUsd, 18) * 10n ** BigInt(configuration.ipx_decimals) * ONE_18 / (pltrUsd18 * parseUnits(configuration.initial_price_pltr_per_ipx, 18));
  let remainingGross = inputRaw; let sqrt = startSqrt; let output = 0n; let consumedGross = 0n;
  const feeMultiplier = FEE_DENOMINATOR - BigInt(configuration.v4_fee);
  for (let guard = 0; guard < configuration.liquidity_positions.length + 2 && remainingGross > 0n; guard += 1) {
    const tick = tickAtSqrtRatio(sqrt); const liquidity = activeLiquidity(positions, tick); if (liquidity === 0n) break;
    if (direction === 'BUY_IPX_WITH_PLTR') {
      const bounds = positions.filter((position) => tick >= position.tick_lower && tick < position.tick_upper).map((position) => position.tick_upper); const targetTick = Math.min(...bounds); const target = sqrtRatioAtTick(targetTick);
      const requiredNet = liquidity * (target - sqrt) / Q96 + 1n; const availableNet = remainingGross * feeMultiplier / FEE_DENOMINATOR;
      if (availableNet >= requiredNet) { const gross = (requiredNet * FEE_DENOMINATOR + feeMultiplier - 1n) / feeMultiplier; output += liquidity * (target - sqrt) * Q96 / target / sqrt; remainingGross -= gross; consumedGross += gross; sqrt = target; }
      else { const next = sqrt + availableNet * Q96 / liquidity; output += liquidity * (next - sqrt) * Q96 / next / sqrt; consumedGross += remainingGross; remainingGross = 0n; sqrt = next; }
    } else {
      const bounds = positions.filter((position) => tick >= position.tick_lower && tick < position.tick_upper).map((position) => position.tick_lower); const targetTick = Math.max(...bounds); const target = sqrtRatioAtTick(targetTick);
      const requiredNet = liquidity * (sqrt - target) * Q96 / sqrt / target + 1n; const availableNet = remainingGross * feeMultiplier / FEE_DENOMINATOR;
      if (availableNet >= requiredNet) { const gross = (requiredNet * FEE_DENOMINATOR + feeMultiplier - 1n) / feeMultiplier; output += liquidity * (sqrt - target) / Q96; remainingGross -= gross; consumedGross += gross; sqrt = target === sqrtRatioAtTick(-887272) ? target : target - 1n; }
      else { const denominator = liquidity * Q96 + availableNet * sqrt; const next = liquidity * Q96 * sqrt / denominator; output += liquidity * (sqrt - next) / Q96; consumedGross += remainingGross; remainingGross = 0n; sqrt = next; }
    }
  }
  const endTick = tickAtSqrtRatio(sqrt); const startPrice18 = parseUnits(configuration.initial_price_pltr_per_ipx, 18); const endPrice18 = parseUnits(priceAtSqrt(sqrt, configuration.ipx_decimals), 18); const signedImpact = (endPrice18 - startPrice18) * 100n * ONE_18 / startPrice18;
  return { direction, notional_usd: notionalUsd, starting_price_pltr_per_ipx: configuration.initial_price_pltr_per_ipx, ending_price_pltr_per_ipx: formatUnits(endPrice18, 18, 10), price_impact_pct: formatUnits(signedImpact, 18, 6), ticks_crossed: Math.abs(endTick - startTick), range_exhausted: activeLiquidity(positions, endTick) === 0n, pltr_principal_change: direction === 'BUY_IPX_WITH_PLTR' ? formatUnits(consumedGross, 18) : formatUnits(-output, 18), ipx_principal_change: direction === 'BUY_IPX_WITH_PLTR' ? formatUnits(-output, configuration.ipx_decimals) : formatUnits(consumedGross, configuration.ipx_decimals), remaining_active_liquidity: String(activeLiquidity(positions, endTick)), exceeds_modeled_market_support: remainingGross > 0n, unprocessed_input: formatUnits(remainingGross, direction === 'BUY_IPX_WITH_PLTR' ? 18 : configuration.ipx_decimals) };
}

function footprintBand(percentValue: string) { const value = Number(percentValue); const lower = [...PLTR_CONCENTRATION_SCENARIO_BANDS].reverse().find((band) => value >= band); const upper = PLTR_CONCENTRATION_SCENARIO_BANDS.find((band) => value < band); return `${lower === undefined ? '<1%' : `>${lower}%`}${upper === undefined ? '' : ` / <${upper}%`}`; }
function stressedValue(value: bigint, percentDelta: number) { return value * BigInt(100 + percentDelta) / 100n; }
function buildSupplyStress(supply: bigint, footprint: bigint, lp: bigint): SupplyStress[] { return ([['CURRENT_SUPPLY', 0], ['+10%', 10], ['+25%', 25], ['+50%', 50], ['+100%', 100]] as const).map(([scenario, change]) => { const denominator = stressedValue(supply, change); return { scenario, canonical_supply: formatUnits(denominator, 18), first_party_pltr_footprint: formatUnits(footprint, 18), first_party_concentration_pct: ratioPct(footprint, denominator), tracked_ipx_pltr_market_concentration_pct: ratioPct(lp, denominator), lp_or_reserve_change_assumed: false }; }); }
function buildPriceStress(pltrUsd: bigint, relative: bigint, reserve: bigint, lp: bigint): PriceStress[] { return ([['-30%', -30], ['-15%', -15], ['-5%', -5], ['CURRENT', 0], ['+10%', 10], ['+25%', 25], ['+50%', 50]] as const).map(([scenario, change]) => { const price = stressedValue(pltrUsd, change); return { scenario, hypothetical_pltr_usd: formatUnits(price, 18, 6), ipx_implied_usd: formatUnits(mulDiv(price, relative, ONE_18), 18, 8), pltr_reserve_usd: formatUnits(mulDiv(reserve, price, ONE_18), 18, 2), pltr_lp_usd: formatUnits(mulDiv(lp, price, ONE_18), 18, 2), ipx_pltr_relative_price_unchanged: true, mission_alpha_decomposition: { status: 'NOT_CALCULATED', reason: 'No time-series IPX observation exists; relative-price and PLTR/USD legs remain explicitly separate.' } }; }); }
function buildBasisStress(underlying: bigint, relative: bigint, reserve: bigint): BasisStress[] { return [-1000, -500, -200, 0, 200, 500, 1000].map((scenario_bps) => { const price = underlying * BigInt(10_000 + scenario_bps) / 10_000n; return { scenario_bps, hypothetical_stock_token_usd: formatUnits(price, 18, 6), underlying_reference_usd: formatUnits(underlying, 18, 6), ipx_implied_usd: formatUnits(mulDiv(price, relative, ONE_18), 18, 8), reserve_nav_context_usd: formatUnits(mulDiv(reserve, price, ONE_18), 18, 2), interpretation: scenario_bps === 0 ? 'Stock Token and underlying references are aligned in this stress state.' : 'A hypothetical Stock Token basis changes USD context while IPX/PLTR relative price is held constant.' }; }); }
function buildSessionStress(): SessionStress[] { return [
  { session: 'OPEN', reference_freshness_expectation: 'Synchronized intraday Stock Token and underlying references required.', basis_risk_warning: null, simulation_confidence: 'HIGH', underlying_price_move_assumed: false },
  { session: 'CLOSED', reference_freshness_expectation: 'Last aligned close-session reference is frozen; no refresh is inferred.', basis_risk_warning: 'Underlying reference may not continuously update while crypto execution remains available.', simulation_confidence: 'MEDIUM', underlying_price_move_assumed: false },
  { session: 'WEEKEND', reference_freshness_expectation: 'Underlying market is unavailable for contemporaneous alignment.', basis_risk_warning: 'Stock Token execution can diverge from a stale underlying reference.', simulation_confidence: 'LOW', underlying_price_move_assumed: false },
  { session: 'HOLIDAY', reference_freshness_expectation: 'Holiday calendar must be known; the last aligned reference remains frozen.', basis_risk_warning: 'Extended reference closure increases basis interpretation risk.', simulation_confidence: 'LOW', underlying_price_move_assumed: false }
]; }
function buildCapitalFlowStress(): CapitalFlowStress[] { return [
  { scenario: 'PLTR_CAPITAL_PLTR_FLOW', pltr_capital_share_pct: 80, pltr_flow_share_pct: 80, assessment: 'PLTR is both the capital anchor and dominant execution route.', capital_is_flow: false },
  { scenario: 'PLTR_CAPITAL_CRYPTO_FLOW', pltr_capital_share_pct: 80, pltr_flow_share_pct: 25, assessment: 'Execution migrates while PLTR remains the economic capital anchor.', capital_is_flow: false },
  { scenario: 'PLTR_MINORITY_CRYPTO_FLOW', pltr_capital_share_pct: 25, pltr_flow_share_pct: 10, assessment: 'PLTR identity depends on a minority capital allocation and thin flow.', capital_is_flow: false },
  { scenario: 'BALANCED_TOPOLOGY', pltr_capital_share_pct: 50, pltr_flow_share_pct: 50, assessment: 'Capital and execution are distributed without equating the two measures.', capital_is_flow: false }
]; }
function buildRouteMigration(configuration: HypotheticalIpxConfiguration): RouteMigrationStress[] { if (configuration.architecture === 'PLTR_NATIVE' || configuration.architecture === 'CUSTOM') return []; const routes = ['IPX/PLTR', ...(configuration.hypothetical_usdg_execution_market_exists ? ['IPX/USDG'] : []), ...(configuration.hypothetical_weth_execution_market_exists ? ['IPX/WETH'] : [])]; const pltrCapital = Number(configuration.hypothetical_capital_allocation_pct.pltr); return ([80, 50, 25, 10] as const).map((flow) => ({ pltr_flow_share_pct: flow, canonical_identity_market_preserved: parseUnits(configuration.pltr_allocated_to_ipx_pltr_liquidity, 18) > 0n, pltr_footprint_preserved: true, capital_anchor_preserved: pltrCapital >= 50 || configuration.architecture === 'PLTR_RESERVE_ANCHOR', usable_execution_routes: routes, fatal_assumed: false })); }
function buildRangeStress(configuration: HypotheticalIpxConfiguration, startSqrt: bigint): RangeStress[] {
  const cases = ['CURRENT_PRICE_CENTERED', 'APPROACHING_LOWER_BOUND', 'APPROACHING_UPPER_BOUND', 'BELOW_RANGE', 'ABOVE_RANGE'] as const;
  return cases.map((scenario) => { const positions = configuration.liquidity_positions.map((position) => { const liquidity = positionLiquidity(position, startSqrt, configuration.ipx_decimals); const tick = scenario === 'CURRENT_PRICE_CENTERED' ? tickAtSqrtRatio(startSqrt) : scenario === 'APPROACHING_LOWER_BOUND' ? position.tick_lower + configuration.tick_spacing : scenario === 'APPROACHING_UPPER_BOUND' ? position.tick_upper - configuration.tick_spacing : scenario === 'BELOW_RANGE' ? Math.max(-887272, position.tick_lower - configuration.tick_spacing) : Math.min(887272, position.tick_upper + configuration.tick_spacing); const principal = reconstructPositionPrincipal(liquidity, position.tick_lower, position.tick_upper, sqrtRatioAtTick(tick)); return { position_id: position.position_id, range_state: principal.range_state, pltr_principal: formatUnits(principal.amount1, 18), ipx_principal: formatUnits(principal.amount0, configuration.ipx_decimals), active_liquidity: principal.range_state === 'IN_RANGE' ? String(liquidity) : '0' }; }); return { scenario, positions, total_pltr_principal: sumDecimal(positions.map((item) => item.pltr_principal), 18), total_ipx_principal: sumDecimal(positions.map((item) => item.ipx_principal), configuration.ipx_decimals), active_liquidity: String(positions.reduce((sum, item) => sum + BigInt(item.active_liquidity), 0n)) }; });
}

function riskDimensions(input: { snapshot: PltrPreflightState; concentration: string; trades: TradeImpactResult[]; positions: PositionModel[]; supply: SupplyStress[]; configuration: HypotheticalIpxConfiguration }): RiskDimension[] {
  const maxImpact = Math.max(...input.trades.map((trade) => Math.abs(Number(trade.price_impact_pct)))); const unsupported = input.trades.some((trade) => trade.exceeds_modeled_market_support); const concentration = Number(input.concentration); const pltrCapital = Number(input.configuration.hypothetical_capital_allocation_pct.pltr); const referencesFresh = input.snapshot.observation?.freshness === 'fresh' && input.snapshot.basis.freshness === 'fresh' && input.snapshot.underlying_reference?.freshness === 'fresh' && input.snapshot.direct_markets.some((market) => market.verification_state === 'VERIFIED' && market.freshness === 'fresh');
  return [
    { dimension: 'PLTR_CONCENTRATION', status: concentration > 25 ? 'FAIL' : concentration > 5 ? 'WARN' : 'PASS', evidence: `${input.concentration}% of frozen canonical supply; 1/3/5/10/15/25% are draft reference bands, not approved safety thresholds.` },
    { dimension: 'MARKET_IMPACT', status: unsupported || maxImpact > 50 ? 'FAIL' : maxImpact > 10 ? 'WARN' : 'PASS', evidence: unsupported ? 'At least one standardized stress exceeds modeled IPX/PLTR support.' : `Maximum standardized absolute modeled impact is ${maxImpact.toFixed(4)}%; the draft shadow rule warns above 10% and blocks above 50%. These are not final policy thresholds.` },
    { dimension: 'RANGE_FRAGILITY', status: input.positions.some((position) => position.range_state !== 'IN_RANGE') ? 'FAIL' : input.positions.some((position) => Number(position.pltr_principal_utilization_pct) < 90 || Number(position.ipx_principal_utilization_pct) < 90) ? 'WARN' : 'PASS', evidence: 'Exact bigint position reconstruction checks active range and whether proposed two-sided principal is represented by modeled liquidity.' },
    { dimension: 'BASIS_EXPOSURE', status: input.snapshot.basis.status === 'AVAILABLE' ? 'PASS' : 'UNAVAILABLE', evidence: input.snapshot.basis.status === 'AVAILABLE' ? `Frozen basis is ${input.snapshot.basis.basis_bps} bps and explicit ±200/500/1000 bps stresses are available; this does not remove basis risk.` : 'Aligned Stock Token and underlying references are unavailable.' },
    { dimension: 'SESSION_RISK', status: input.snapshot.underlying_session === 'OPEN' ? 'PASS' : input.snapshot.underlying_session === 'CLOSED' ? 'WARN' : 'FAIL', evidence: `Frozen underlying session is ${input.snapshot.underlying_session}; session scenarios invent no price movement.` },
    { dimension: 'REFERENCE_FRESHNESS', status: input.snapshot.immutable && input.snapshot.readiness.status === 'READY_FOR_SIMULATION' && referencesFresh ? 'PASS' : 'FAIL', evidence: `Explicit immutable observation ${input.snapshot.observation_id}; supply, direct market, basis, and underlying freshness are checked without independently refreshing fields.` },
    { dimension: 'QUOTE_TOPOLOGY_DEPENDENCE', status: pltrCapital >= 75 && !input.configuration.hypothetical_usdg_execution_market_exists && !input.configuration.hypothetical_weth_execution_market_exists ? 'WARN' : 'PASS', evidence: `Hypothetical PLTR capital share ${pltrCapital}%; crypto execution routes are assessed separately from capital anchoring.` },
    { dimension: 'SUPPLY_ELASTICITY_SENSITIVITY', status: Number(input.supply.at(-1)!.first_party_concentration_pct) < concentration ? 'PASS' : 'WARN', evidence: '+100% supply changes concentration denominators only; no new PLTR is assumed to enter LP or reserve.' },
    { dimension: 'FIRST_PARTY_CONFLICT', status: 'PASS', evidence: 'INFOPUNKS ownership is explicitly disclosed and receives no score, threshold, or verdict benefit.' },
    { dimension: 'MISSION_INVENTORY_UNCERTAINTY', status: input.snapshot.mission_inventory_coverage === 'VERIFIED' ? 'PASS' : 'UNAVAILABLE', evidence: input.snapshot.mission_inventory_coverage === 'VERIFIED' ? 'Mission inventory is verified in the frozen state.' : `Mission-market accounting is ${input.snapshot.mission_inventory_coverage} and verified mission inventory is UNAVAILABLE; unclassified PLTR is not liquidity.` }
  ];
}
function draftVerdict(dimensions: RiskDimension[]) { const hard = dimensions.filter((item) => item.status === 'FAIL').map((item) => `${item.dimension}:${item.evidence}`); if (hard.length) return { verdict: 'BLOCK' as const, rules: hard }; const material = dimensions.filter((item) => item.status === 'WARN' || item.status === 'UNAVAILABLE').map((item) => `${item.dimension}:${item.evidence}`); return material.length ? { verdict: 'DEGRADE' as const, rules: material } : { verdict: 'ALLOW' as const, rules: ['DRAFT_ALL_HARD_CONDITIONS_PASS'] }; }

export class IpxPltrSimulationError extends Error { constructor(readonly code: 'EXPLICIT_SNAPSHOT_REQUIRED' | 'LATEST_NOT_ALLOWED' | 'STATE_SNAPSHOT_NOT_FOUND' | 'STATE_NOT_READY' | 'INVALID_CONFIGURATION' | 'SIMULATION_RECORD_CONFLICT', message: string = code) { super(message); } }

export function simulateIpxPltr(snapshot: PltrPreflightState, rawConfiguration: unknown): PreflightSimulationRecord {
  if (!snapshot.immutable || snapshot.readiness.status !== 'READY_FOR_SIMULATION' || !snapshot.observation) throw new IpxPltrSimulationError('STATE_NOT_READY');
  const parsed = HypotheticalIpxConfigurationSchema.safeParse(rawConfiguration); if (!parsed.success) throw new IpxPltrSimulationError('INVALID_CONFIGURATION', parsed.error.issues.map((issue) => issue.message).join(';'));
  const configuration = parsed.data; const configCanonical = canonicalJson(configuration); const configurationHash = `sha256:${sha256(configCanonical)}`; const simulationId = `ipxsim-${sha256(`${IPX_PLTR_SIMULATOR_VERSION}|${snapshot.observation_id}|${configCanonical}`)}`;
  const supply = parseUnits(snapshot.observation.total_supply_units, 18); const lp = parseUnits(configuration.pltr_allocated_to_ipx_pltr_liquidity, 18); const reserve = parseUnits(configuration.pltr_allocated_to_first_party_reserve, 18); const other = configuration.other_first_party_ipx_linked_pltr_holdings.reduce((sum, item) => sum + parseUnits(item.pltr_units, 18), 0n); const footprint = lp + reserve + other;
  const directPrice = snapshot.direct_markets.find((market) => market.relationship === 'DIRECT_PRICE_DISCOVERY' && market.verification_state === 'VERIFIED')?.price_usd; if (!directPrice || !snapshot.underlying_reference || snapshot.basis.status !== 'AVAILABLE') throw new IpxPltrSimulationError('STATE_NOT_READY');
  const pltrUsd = parseUnits(directPrice, 18); const underlying = parseUnits(String(snapshot.underlying_reference.midpoint), 18); const relative = parseUnits(configuration.initial_price_pltr_per_ipx, 18); const sqrt = sqrtPriceFromHumanPrice(configuration.initial_price_pltr_per_ipx, configuration.ipx_decimals); const positions = positionModels(configuration, sqrt); const startTick = tickAtSqrtRatio(sqrt);
  const buys = configuration.reference_trade_notionals_usd.map((notional) => simulateTrade('BUY_IPX_WITH_PLTR', notional, configuration, positions, sqrt, pltrUsd)); const sells = configuration.reference_trade_notionals_usd.map((notional) => simulateTrade('SELL_IPX_FOR_PLTR', notional, configuration, positions, sqrt, pltrUsd)); const supplyStress = buildSupplyStress(supply, footprint, lp); const concentration = ratioPct(footprint, supply);
  const dimensions = riskDimensions({ snapshot, concentration, trades: [...buys, ...sells], positions, supply: supplyStress, configuration }); const verdict = draftVerdict(dimensions);
  const record: PreflightSimulationRecord = { record_type: 'PREFLIGHT_SIMULATION_RECORD', simulation_id: simulationId, state_snapshot_id: snapshot.observation_id, configuration_hash: configurationHash, simulator_version: IPX_PLTR_SIMULATOR_VERSION, draft_policy_version: DRAFT_IPX_PLTR_POLICY_VERSION, created_at: snapshot.observation.observed_at, immutable: true, configuration, result: {
    methodology_version: IPX_PLTR_SIMULATOR_VERSION,
    state_snapshot: { observation_id: snapshot.observation_id, block: snapshot.observation.observed_block, observed_at: snapshot.observation.observed_at, canonical_pltr_contract: snapshot.canonical_identity.canonical_contract, canonical_pltr_total_supply: snapshot.observation.total_supply_units, share_equivalent_supply: snapshot.observation.share_equivalent_supply, multiplier: snapshot.canonical_identity.current_multiplier, direct_pltr_usdg_price: directPrice, underlying_midpoint_usd: String(snapshot.underlying_reference.midpoint), basis_bps: String(snapshot.basis.basis_bps), session: snapshot.underlying_session, mission_market_accounting: snapshot.mission_inventory_coverage, verified_mission_inventory: snapshot.tracked_mission_inventory.raw_pltr_units, unclassified_pltr: snapshot.inventory_coverage.unclassified_raw, immutable: true, live_values_used: false },
    synthetic_ipx_asset: { ...SYNTHETIC_IPX_ASSET, decimals: configuration.ipx_decimals },
    market: { token_ordering: ['IPX', 'PLTR'], synthetic_pool_key: { currency0: 'SYNTHETIC:IPX', currency1: snapshot.canonical_identity.canonical_contract, fee: configuration.v4_fee, tick_spacing: configuration.tick_spacing, hooks: configuration.hook_configuration.kind === 'ZERO_HOOK' ? 'ZERO_HOOK' : `FUTURE_SAFE:${configuration.hook_configuration.descriptor}` }, starting_tick: startTick, starting_sqrt_price_x96: String(sqrt), active_liquidity: String(activeLiquidity(positions, startTick)), positions, transaction_capability: 'NONE_SIMULATION_ONLY' },
    first_party_pltr_footprint: { lp_pltr_units: formatUnits(lp, 18), reserve_pltr_units: formatUnits(reserve, 18), other_pltr_units: formatUnits(other, 18), total_pltr_units: formatUnits(footprint, 18), share_equivalent_units: formatUnits(mulDiv(footprint, parseUnits(snapshot.canonical_identity.current_multiplier, 18), ONE_18), 18), usd_reference_value: formatUnits(mulDiv(footprint, pltrUsd, ONE_18), 18, 2), canonical_supply_pct: concentration, reference_band: footprintBand(concentration), unclassified_pltr_counted_as_availability: false },
    trade_impact: { buys, sells, higher_impact_is_risk: true }, supply_stress: supplyStress, price_stress: buildPriceStress(pltrUsd, relative, reserve, lp), basis_stress: buildBasisStress(underlying, relative, reserve), session_stress: buildSessionStress(), capital_vs_flow: buildCapitalFlowStress(), route_migration: buildRouteMigration(configuration), range_stress: buildRangeStress(configuration, sqrt),
    reserve: { modeled_separately_from_lp: true, pltr_units: formatUnits(reserve, 18), usd_reference_value: formatUnits(mulDiv(reserve, pltrUsd, ONE_18), 18, 2), canonical_supply_pct: ratioPct(reserve, supply), ...configuration.reserve_policy_metadata, purchases_simulated: false },
    exposure_truth: { IPX_QUOTED_IN_PLTR: lp > 0n ? 'YES' : 'NO', PLTR_IN_IPX_LIQUIDITY: formatUnits(lp, 18), PLTR_IN_HYPOTHETICAL_RESERVE: formatUnits(reserve, 18), VERIFIED_PROPOSED_FIRST_PARTY_PLTR_FOOTPRINT: formatUnits(footprint, 18), IPX_REDEEMABLE_FOR_PLTR: 'NO', PALANTIR_SHAREHOLDER_RIGHTS: 'NO', PALANTIR_AFFILIATION: 'NO', PLTR_STOCK_TOKEN_IS_LEGAL_BENEFICIAL_PALANTIR_SHARE_OWNERSHIP: 'NO', FIRST_PARTY_CONFLICT: 'DISCLOSED', ASSET_OWNER: 'INFOPUNKS' },
    risk_dimensions: dimensions,
    draft_simulation_verdict: { label: 'DRAFT_SIMULATION_VERDICT', verdict: verdict.verdict, triggered_rules: verdict.rules, inputs: { state_snapshot_id: snapshot.observation_id, configuration_hash: configurationHash }, methodology_version: IPX_PLTR_SIMULATOR_VERSION, policy_version: DRAFT_IPX_PLTR_POLICY_VERSION, manual_override: 'NOT_AVAILABLE', launch_authorization: false }
  } };
  return record;
}

export interface IpxPltrSimulationStore { readonly adapter: 'memory' | 'postgres'; readonly durable: boolean; create(record: PreflightSimulationRecord): Promise<PreflightSimulationRecord>; get(id: string): Promise<PreflightSimulationRecord | null>; }
export class InMemoryIpxPltrSimulationStore implements IpxPltrSimulationStore { readonly adapter = 'memory' as const; readonly durable = false; private records = new Map<string, PreflightSimulationRecord>(); async create(record: PreflightSimulationRecord) { const existing = this.records.get(record.simulation_id); if (existing && canonicalJson(existing) !== canonicalJson(record)) throw new IpxPltrSimulationError('SIMULATION_RECORD_CONFLICT'); if (!existing) this.records.set(record.simulation_id, clone(record)); return clone(existing ?? record); } async get(id: string) { const record = this.records.get(id); return record ? clone(record) : null; } }
export class PostgresIpxPltrSimulationStore implements IpxPltrSimulationStore { readonly adapter = 'postgres' as const; readonly durable = true; private readonly pool: pg.Pool; private readonly ownsPool: boolean; private readonly schema = new RetryablePostgresSchema('ipx_pltr_preflight_simulations'); constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; } private ensure() { return this.schema.ensure(this.pool, "create table if not exists ipx_pltr_preflight_simulations (simulation_id text primary key, state_snapshot_id text not null, configuration_hash text not null, simulator_version text not null, draft_policy_version text not null, created_at timestamptz not null, payload jsonb not null); create index if not exists ipx_pltr_preflight_simulations_state_idx on ipx_pltr_preflight_simulations (state_snapshot_id, created_at desc);"); } async create(record: PreflightSimulationRecord) { await this.ensure(); await this.pool.query('insert into ipx_pltr_preflight_simulations (simulation_id,state_snapshot_id,configuration_hash,simulator_version,draft_policy_version,created_at,payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb) on conflict (simulation_id) do nothing', [record.simulation_id, record.state_snapshot_id, record.configuration_hash, record.simulator_version, record.draft_policy_version, record.created_at, JSON.stringify(record)]); const persisted = await this.get(record.simulation_id); if (!persisted || canonicalJson(persisted) !== canonicalJson(record)) throw new IpxPltrSimulationError('SIMULATION_RECORD_CONFLICT'); return persisted; } async get(id: string) { await this.ensure(); const result = await this.pool.query<{ payload: PreflightSimulationRecord }>('select payload from ipx_pltr_preflight_simulations where simulation_id=$1', [id]); return result.rows[0]?.payload ?? null; } async close() { if (this.ownsPool) await this.pool.end(); } }

export class IpxPltrPreflightSimulatorService {
  constructor(private readonly snapshotById: (id: string) => Promise<PltrPreflightState | null>, private readonly store: IpxPltrSimulationStore) {}
  async simulate(input: { pltr_preflight_state_observation_id?: string; state_snapshot_id?: string; hypothetical_ipx_configuration?: unknown; hypothetical_configuration?: unknown }) { const id = input.pltr_preflight_state_observation_id ?? input.state_snapshot_id; if (!id) throw new IpxPltrSimulationError('EXPLICIT_SNAPSHOT_REQUIRED'); if (id.toLowerCase() === 'latest') throw new IpxPltrSimulationError('LATEST_NOT_ALLOWED'); const snapshot = await this.snapshotById(id); if (!snapshot) throw new IpxPltrSimulationError('STATE_SNAPSHOT_NOT_FOUND'); if (snapshot.observation_id !== id || !snapshot.immutable || snapshot.readiness.status !== 'READY_FOR_SIMULATION') throw new IpxPltrSimulationError('STATE_NOT_READY'); return this.store.create(simulateIpxPltr(clone(snapshot), input.hypothetical_ipx_configuration ?? input.hypothetical_configuration)); }
  async compare(input: { pltr_preflight_state_observation_id?: string; state_snapshot_id?: string; hypothetical_configurations?: unknown[] }): Promise<PreflightSimulationComparison> {
    const id = input.pltr_preflight_state_observation_id ?? input.state_snapshot_id; if (!id) throw new IpxPltrSimulationError('EXPLICIT_SNAPSHOT_REQUIRED'); if (id.toLowerCase() === 'latest') throw new IpxPltrSimulationError('LATEST_NOT_ALLOWED'); if (!Array.isArray(input.hypothetical_configurations) || input.hypothetical_configurations.length < 2 || input.hypothetical_configurations.length > 4) throw new IpxPltrSimulationError('INVALID_CONFIGURATION', 'comparison_requires_two_to_four_configurations');
    const snapshot = await this.snapshotById(id); if (!snapshot) throw new IpxPltrSimulationError('STATE_SNAPSHOT_NOT_FOUND'); if (snapshot.observation_id !== id || !snapshot.immutable || snapshot.readiness.status !== 'READY_FOR_SIMULATION') throw new IpxPltrSimulationError('STATE_NOT_READY');
    const simulations = await Promise.all(input.hypothetical_configurations.map((configuration) => this.store.create(simulateIpxPltr(clone(snapshot), configuration))));
    const comparison_matrix = simulations.map((record) => { const impact = Math.max(...[...record.result.trade_impact.buys, ...record.result.trade_impact.sells].map((trade) => Math.abs(Number(trade.price_impact_pct)))); const range = record.result.risk_dimensions.find((item) => item.dimension === 'RANGE_FRAGILITY')!; const routeCount = new Set(record.result.route_migration.flatMap((row) => row.usable_execution_routes)).size || 1; return { architecture: record.configuration.architecture, simulation_id: record.simulation_id, first_party_pltr_footprint: record.result.first_party_pltr_footprint.total_pltr_units, first_party_concentration_pct: record.result.first_party_pltr_footprint.canonical_supply_pct, maximum_absolute_market_impact_pct: String(impact), basis_sensitivity: 'IPX implied USD is stressed at 0/±200/±500/±1000 bps with IPX/PLTR held constant.', range_fragility: range.status, route_resilience: `${routeCount} modeled route${routeCount === 1 ? '' : 's'}; PLTR capital and flow assessed separately.`, execution_topology: `${record.configuration.hypothetical_capital_allocation_pct.pltr}% PLTR / ${record.configuration.hypothetical_capital_allocation_pct.usdg}% USDG / ${record.configuration.hypothetical_capital_allocation_pct.weth}% WETH capital`, reserve_dependence: parseUnits(record.configuration.pltr_allocated_to_first_party_reserve, 18) > 0n ? `${record.configuration.pltr_allocated_to_first_party_reserve} PLTR separate reserve` : 'NO SEPARATE RESERVE', draft_verdict: record.result.draft_simulation_verdict.verdict }; });
    const verdictRank: Record<DraftVerdict, number> = { ALLOW: 0, DEGRADE: 1, BLOCK: 2 }; const ordered = [...comparison_matrix].sort((a, b) => verdictRank[a.draft_verdict] - verdictRank[b.draft_verdict] || Number(a.maximum_absolute_market_impact_pct) - Number(b.maximum_absolute_market_impact_pct) || Number(a.first_party_concentration_pct) - Number(b.first_party_concentration_pct)); const mostRobust = ordered.length > 1 && verdictRank[ordered[0].draft_verdict] < verdictRank[ordered[1].draft_verdict] ? ordered[0].architecture : null;
    return { record_type: 'PREFLIGHT_SIMULATION_COMPARISON', comparison_id: `ipxsimcmp-${sha256(`${IPX_PLTR_SIMULATOR_VERSION}|${id}|${simulations.map((record) => record.simulation_id).join('|')}`)}`, state_snapshot_id: id, simulator_version: IPX_PLTR_SIMULATOR_VERSION, draft_policy_version: DRAFT_IPX_PLTR_POLICY_VERSION, immutable: true, simulations, comparison_matrix, most_robust_under_draft_policy: mostRobust, not_a_launch_architecture_selection: true };
  }
  get(id: string) { return this.store.get(id); }
}

export const PLTR_PREFLIGHT_DEMO_FIXTURE: PltrPreflightState = {
  state_type: 'PLTR_PREFLIGHT_STATE', observation_id: PLTR_PREFLIGHT_DEMO_OBSERVATION_ID, immutable: true, methodology_version: 'rmm-v0.4.5-pltr-evidence-closure-v1',
  canonical_identity: { asset_id: 'rhj-pltr', ticker: 'PLTR', canonical_contract: '0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a', current_multiplier: '1', pending_multiplier: null, pending_multiplier_effective_at: null, observed_at: '2026-09-02T07:45:09.000Z', fetched_at: '2026-09-02T07:45:09.000Z', provenance: 'Robinhood RHJ canonical asset registry + chain 4663 evidence snapshot' },
  observation: { total_supply_raw: '7344120000000000000000', total_supply_units: '7344.12', share_equivalent_supply: '7344.12', observed_block: 52406504, observed_at: '2026-09-02T07:45:09.000Z', source: 'canonical PLTR totalSupply at pinned block', freshness: 'fresh' },
  underlying_reference: { symbol: 'PLTR', bid: 179.06, ask: 179.12, midpoint: 179.09, generated_at: '2026-09-02T07:44:55.700Z', fetched_at: '2026-09-02T07:45:09.000Z', freshness: 'fresh', session: 'CLOSED', source: 'RHJ_PRICES', methodology: 'RHJ_RAW_UNDERLYING_MIDPOINT_V1' }, reference_value_usd: 179.09,
  basis: { value: 0.004998, basis_bps: 49.98, dex_source: 'verified_direct_pltr_usd', reference_source: 'aligned_underlying_reference', dex_observed_at: '2026-09-02T07:45:09.000Z', reference_observed_at: '2026-09-02T07:44:55.700Z', session: 'CLOSED', freshness: 'fresh', alignment_ms: 13300, methodology: 'NORMALIZED_STOCK_TOKEN_BASIS_V1', status: 'AVAILABLE' }, underlying_session: 'CLOSED',
  direct_markets: [{ pool_id: '0xee430ee1003e1985e1828a01b9a20dad67ad4302994fe2abb4a173de4ac54623', pool_address: null, venue: 'Uniswap', dex_version: 'V4', base_contract: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', quote_contract: '0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a', base_symbol: 'USDG', quote_symbol: 'PLTR', relationship: 'DIRECT_PRICE_DISCOVERY', quote_direction_verified: true, verification_state: 'VERIFIED', liquidity_usd: null, volume_24h_usd: null, transaction_count: null, observed_at: '2026-09-02T07:45:09.000Z', source: 'Canonical Uniswap V4 Initialize event + StateView', freshness: 'fresh', pool_state: null, depth_primitive: { pool_key: { currency0: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', currency1: '0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a', fee: 10000, tick_spacing: 200, hooks: '0x0000000000000000000000000000000000000000' }, pool_id: '0xee430ee1003e1985e1828a01b9a20dad67ad4302994fe2abb4a173de4ac54623', sqrt_price_x96: '1', tick: 0, active_liquidity: '1', fee: 10000, tick_spacing: 200, hooks: '0x0000000000000000000000000000000000000000', currency0: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', currency1: '0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a', observed_block: 52406504, observed_at: '2026-09-02T07:45:09.000Z', state_view: '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b', initialized: true, methodology: 'V4_STATEVIEW_DEPTH_PRIMITIVE_V1' }, pool_key: { currency0: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', currency1: '0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a', fee: 10000, tick_spacing: 200, hooks: '0x0000000000000000000000000000000000000000' }, pool_id_derived: '0xee430ee1003e1985e1828a01b9a20dad67ad4302994fe2abb4a173de4ac54623', price_usd: '179.98506427968954066', price_source: 'VERIFIED_DIRECT_PLTR_PRICE_V1' }],
  stock_stock_markets: [], discovered_unverified_markets: [], verified_mission_markets: [], mission_inventory_coverage: 'PARTIAL', tracked_mission_inventory: { status: 'INCOMPLETE', raw_pltr_units: null, share_equivalent_units: null, absorption_pct: null, included_market_ids: [], excluded: [] }, inventory_coverage: { tracked_mission_markets_raw: null, direct_market_accounting_raw: null, radar_inventory_coverage_pct: null, unclassified_raw: '7344.12', scope: 'VERIFIED_CLASSIFIED_PLTR_INVENTORY_ONLY' }, mission_market_concentration: { largest_market_raw: null, largest_market_share_pct: null, top_3_raw: null, verified_market_count: 0 }, supply_history: { events: [], windows: { '1H': '0', '6H': '0', '24H': '0', D3: '0', D7: '0' }, largest_recent_mint: null, mint_frequency: 0, time_since_last_mint_ms: null, time_since_last_burn_ms: null }, market_context_liquidity_usd: null, market_context_volume_24h_usd: null, first_party_footprint: { schema: 'PROPOSED_FIRST_PARTY_PLTR_FOOTPRINT_V1', proposed_ipx_pltr_positions: null, proposed_infopunks_reserve: null, other_first_party_controlled_positions: null, denominator: 'CANONICAL_PLTR_TOTAL_SUPPLY_SAME_BLOCK', methodology: 'Simulation parameters are not observations.', values_populated: false }, concentration_scenario_bands: PLTR_CONCENTRATION_SCENARIO_BANDS, readiness: { status: 'READY_FOR_SIMULATION', missing_prerequisites: [] }, data_gaps: ['verified PLTR mission-market accounting is unavailable or explicitly empty']
};
