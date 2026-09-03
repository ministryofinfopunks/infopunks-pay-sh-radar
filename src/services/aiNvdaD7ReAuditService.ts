import { QUOTE_PERSISTENCE_ELIGIBILITY, type QuoteMarket, type QuotePersistenceObservation } from './rhChainQuotePersistenceService';
import { formatTokenUnits, stableId, type CommunityVaultObservation, type ReflexiveSnapshot, type StockSupplyEvent } from './rhChainReflexiveRadarService';
import type { DopplerLaunchPosition, DopplerLongAudit } from './rhChainCrossVenueAuditService';

export const AI_NVDA_D7_RE_AUDIT_METHOD_VERSION = 'ai-nvda-d7-re-audit-v0.1';
export const H2B_D7_PRECOMMIT_POLICY_VERSION = 'H2B_D7_PRECOMMIT_V1';

export type AiNvdaD7Verdict = 'SUPPORTING_EVIDENCE' | 'FALSIFYING_EVIDENCE' | 'OBSERVING';
export type CapitalFlowRegime = 'STOCK_ANCHORED' | 'STOCK_CAPITAL_MULTIRAIL_FLOW' | 'MULTIRAIL_CAPITAL_MULTIRAIL_FLOW' | 'STOCK_RELATIONSHIP_DECAYING' | 'INSUFFICIENT_DATA';
export type CapitalRegime = 'STOCK_CAPITAL_PERSISTS' | 'STOCK_CAPITAL_UNWINDING' | 'MULTIRAIL_CAPITAL' | 'INSUFFICIENT_DATA';
export type FlowRegime = 'STOCK_FLOW_DOMINANT' | 'MULTIRAIL_FLOW' | 'BALANCED_FLOW' | 'INSUFFICIENT_DATA';

export type AiNvdaCheckpoint = {
  checkpoint: 'BASELINE' | 'D7';
  block: number | null;
  timestamp: string | null;
  canonical_nvda_supply: string | null;
  verified_long_launch_position_nvda: string | null;
  verified_long_launch_position_raw: string | null;
  scoped_absorption_pct: string | null;
  position_range_liquidity_state: Array<{ position_index: number; nvda_principal: string | null; range_state: DopplerLaunchPosition['range_state']; liquidity_state: DopplerLaunchPosition['core_status']; launch_state: DopplerLaunchPosition['launch_state'] }>;
  ai_nvda_quote_liquidity_usd: number | null;
  quote_volume_share_by_class: Partial<Record<QuoteMarket['quote_class'], number>>;
  stock_quote_liquidity_share: number | null;
  stock_quote_volume_share: number | null;
  quote_observation_id: string | null;
  quote_alignment: 'ALIGNED' | 'UNAVAILABLE';
  basis_session_context: { stock_token_basis: 'UNAVAILABLE'; underlying_session: 'OPEN' | 'CLOSED' | 'WEEKEND' | 'UNKNOWN'; reason: string };
  vault_status: CommunityVaultObservation['status'] | 'UNAVAILABLE';
};

export type AiNvdaD7ReAudit = {
  object_type: 'AI_NVDA_D7_RE_AUDIT';
  audit_id: string;
  case_id: 'AI_NVDA_CAPITAL_VS_FLOW';
  question: 'Did NVDA remain productive capital after AI trading flow became multi-rail?';
  checkpoint: 'D7';
  status: 'OBSERVED' | 'PENDING' | 'UNAVAILABLE';
  target_at: string | null;
  baseline: AiNvdaCheckpoint | null;
  d7: AiNvdaCheckpoint | null;
  change: {
    nvda_principal_retention_pct: string | null;
    absorption_change_percentage_points: string | null;
    liquidity_share_change_percentage_points: string | null;
    volume_share_change_percentage_points: string | null;
    nvda_supply_change: string | null;
    mint_burn_events: StockSupplyEvent[];
    external_liquidity_reconciliation_gap: { status: 'OPEN' | 'UNAVAILABLE'; radar_scope: 'CANONICAL_LAUNCH_POSITION_PRINCIPAL'; external_scope: 'PROVIDER_INDEXED_LIQUIDITY_CONTEXT'; difference: null; note: string };
  };
  capital_regime: CapitalRegime;
  flow_regime: FlowRegime;
  capital_vs_flow_regime: CapitalFlowRegime;
  h2b_verdict: AiNvdaD7Verdict;
  h2b_policy: {
    policy_version: typeof H2B_D7_PRECOMMIT_POLICY_VERSION;
    frozen_before_d7_fetch: true;
    supporting_evidence_if: string[];
    falsifying_evidence_if: string[];
    observing_if: string[];
  };
  methodology_version: typeof AI_NVDA_D7_RE_AUDIT_METHOD_VERSION;
  immutable: true;
};

const AI_MISSION = '0x2e8c31162b855a2ffa90f6f8634643ad6f111e18';
const DAY_MS = 24 * 60 * 60_000;
const STOCK_DOMINANT = .6;
const STOCK_WEAK = .4;
const PRINCIPAL_PERSISTENT = .9;
const PRINCIPAL_UNWOUND = .5;

export function buildAiNvdaD7ReAudit(snapshot: ReflexiveSnapshot, now = new Date()): AiNvdaD7ReAudit {
  const nvda = snapshot.assets.find((asset) => asset.ticker === 'NVDA');
  const history = snapshot.long_inventory_history.filter((item) => item.market_id === 'long-ai-nvda' && item.inventory_status === 'AVAILABLE' && item.stock_principal_raw && item.stock_total_supply_raw && item.observed_block !== null).sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  const baseline = history[0] ?? null;
  const targetAt = baseline ? new Date(Date.parse(baseline.observed_at) + 7 * DAY_MS).toISOString() : null;
  const d7Audit = baseline && targetAt ? history.filter((item) => Date.parse(item.observed_at) >= Date.parse(targetAt)).sort((a, b) => Math.abs(Date.parse(a.observed_at) - Date.parse(targetAt)) - Math.abs(Date.parse(b.observed_at) - Date.parse(targetAt)))[0] ?? null : null;
  const baseQuote = baseline ? alignedQuote(baseline, snapshot.quote_persistence) : null;
  const d7Quote = d7Audit ? alignedQuote(d7Audit, snapshot.quote_persistence) : null;
  const baselinePoint = baseline ? checkpoint('BASELINE', baseline, baseQuote, snapshot.quote_markets, vaultAt(snapshot.vault_observations, baseline.observed_at)) : null;
  const d7Point = d7Audit ? checkpoint('D7', d7Audit, d7Quote, snapshot.quote_markets, vaultAt(snapshot.vault_observations, d7Audit.observed_at)) : null;
  const mintBurnEvents = nvda && baseline && d7Audit ? snapshot.supply_events.filter((event) => event.asset_id === nvda.asset_id && event.block !== null && event.block > baseline.observed_block! && event.block <= d7Audit.observed_block!) : [];
  const retention = baseline?.stock_principal_raw && d7Audit?.stock_principal_raw ? ratioPct(BigInt(d7Audit.stock_principal_raw), BigInt(baseline.stock_principal_raw)) : null;
  const absorptionChange = diffPct(d7Point?.scoped_absorption_pct ?? null, baselinePoint?.scoped_absorption_pct ?? null);
  const liquidityChange = diffShare(d7Point?.stock_quote_liquidity_share ?? null, baselinePoint?.stock_quote_liquidity_share ?? null);
  const volumeChange = diffShare(d7Point?.stock_quote_volume_share ?? null, baselinePoint?.stock_quote_volume_share ?? null);
  const supplyChange = baseline?.stock_total_supply_raw && d7Audit?.stock_total_supply_raw ? formatRawDelta(BigInt(d7Audit.stock_total_supply_raw) - BigInt(baseline.stock_total_supply_raw), 18) : null;
  const capitalRegime = classifyCapitalRegime(retention, d7Point?.stock_quote_liquidity_share ?? null);
  const flowRegime = classifyFlowRegime(d7Point?.stock_quote_volume_share ?? null);
  const capitalVsFlow = classifyCapitalVsFlow(capitalRegime, flowRegime, d7Point?.stock_quote_liquidity_share ?? null, d7Point?.stock_quote_volume_share ?? null);
  const status: AiNvdaD7ReAudit['status'] = !baseline ? 'UNAVAILABLE' : d7Point ? 'OBSERVED' : targetAt && now.getTime() < Date.parse(targetAt) ? 'PENDING' : 'UNAVAILABLE';
  const h2b = verdict(status, retention, d7Point, capitalVsFlow);
  return freeze({ object_type: 'AI_NVDA_D7_RE_AUDIT', audit_id: stableId('ai-nvda-d7-re-audit', targetAt ?? 'unavailable', d7Audit?.observed_block === null || d7Audit?.observed_block === undefined ? 'pending' : String(d7Audit.observed_block)), case_id: 'AI_NVDA_CAPITAL_VS_FLOW', question: 'Did NVDA remain productive capital after AI trading flow became multi-rail?', checkpoint: 'D7', status, target_at: targetAt, baseline: baselinePoint, d7: d7Point, change: { nvda_principal_retention_pct: retention, absorption_change_percentage_points: absorptionChange, liquidity_share_change_percentage_points: liquidityChange, volume_share_change_percentage_points: volumeChange, nvda_supply_change: supplyChange, mint_burn_events: mintBurnEvents, external_liquidity_reconciliation_gap: { status: d7Point ? 'OPEN' : 'UNAVAILABLE', radar_scope: 'CANONICAL_LAUNCH_POSITION_PRINCIPAL', external_scope: 'PROVIDER_INDEXED_LIQUIDITY_CONTEXT', difference: null, note: 'Provider and third-party liquidity context is reconciliation evidence only. It is not imported into verified LONG launch-position principal.' } }, capital_regime: capitalRegime, flow_regime: flowRegime, capital_vs_flow_regime: capitalVsFlow, h2b_verdict: h2b, h2b_policy: policy(), methodology_version: AI_NVDA_D7_RE_AUDIT_METHOD_VERSION, immutable: true });
}

function checkpoint(kind: AiNvdaCheckpoint['checkpoint'], audit: DopplerLongAudit, quote: QuotePersistenceObservation | null, markets: QuoteMarket[], vault: CommunityVaultObservation | null): AiNvdaCheckpoint {
  const quoteMarkets = quote ? markets.filter((market) => quote.eligible_market_ids.includes(market.market_id)) : [];
  return { checkpoint: kind, block: audit.observed_block, timestamp: audit.observed_at, canonical_nvda_supply: audit.stock_total_supply_units, verified_long_launch_position_nvda: audit.stock_principal_units, verified_long_launch_position_raw: audit.stock_principal_raw, scoped_absorption_pct: audit.scoped_absorption_pct, position_range_liquidity_state: audit.positions.map((position, index) => ({ position_index: index + 1, nvda_principal: position.stock_principal_raw ? formatTokenUnits(BigInt(position.stock_principal_raw), 18) : null, range_state: position.range_state, liquidity_state: position.core_status, launch_state: position.launch_state })), ai_nvda_quote_liquidity_usd: quote?.stock_quote_liquidity_usd ?? null, quote_volume_share_by_class: quoteVolumeShareByClass(quoteMarkets), stock_quote_liquidity_share: quote?.stock_quote_liquidity_share ?? null, stock_quote_volume_share: quote?.stock_quote_volume_share ?? null, quote_observation_id: quote?.observation_id ?? null, quote_alignment: quote?.source_alignment === 'ALIGNED' ? 'ALIGNED' : 'UNAVAILABLE', basis_session_context: { stock_token_basis: 'UNAVAILABLE', underlying_session: underlyingSession(new Date(audit.observed_at)), reason: 'Synchronized AI/NVDA Stock Token, underlying NVDA reference and session-aligned quote basis is not independently proven.' }, vault_status: vault?.status ?? 'UNAVAILABLE' };
}

function alignedQuote(audit: DopplerLongAudit, quotes: QuotePersistenceObservation[]) {
  return quotes.filter((quote) => quote.mission_contract === AI_MISSION && quote.source_alignment === 'ALIGNED').map((quote) => ({ quote, distance: Math.abs(Date.parse(quote.observed_at) - Date.parse(audit.observed_at)) })).filter((item) => item.distance <= QUOTE_PERSISTENCE_ELIGIBILITY.maximum_observation_skew_ms).sort((a, b) => a.distance - b.distance)[0]?.quote ?? null;
}
function vaultAt(vaults: CommunityVaultObservation[], observedAt: string) { return vaults.map((vault) => ({ vault, distance: Math.abs(Date.parse(vault.observed_at) - Date.parse(observedAt)) })).filter((item) => item.distance <= QUOTE_PERSISTENCE_ELIGIBILITY.maximum_observation_skew_ms).sort((a, b) => a.distance - b.distance)[0]?.vault ?? null; }
function quoteVolumeShareByClass(markets: QuoteMarket[]) {
  const total = markets.reduce((sum, market) => sum + (market.volume_usd ?? 0), 0);
  if (total <= 0) return {};
  return markets.reduce<Partial<Record<QuoteMarket['quote_class'], number>>>((acc, market) => ({ ...acc, [market.quote_class]: (acc[market.quote_class] ?? 0) + (market.volume_usd ?? 0) / total }), {});
}
function ratioPct(n: bigint, d: bigint) { return d > 0n ? formatTokenUnits(n * 100n * 10n ** 6n / d, 6) : null; }
function diffPct(next: string | null, prev: string | null) { return next === null || prev === null ? null : formatDecimal(Number(next) - Number(prev)); }
function diffShare(next: number | null, prev: number | null) { return next === null || prev === null ? null : formatDecimal((next - prev) * 100); }
function formatRawDelta(value: bigint, decimals: number) { const sign = value < 0n ? '-' : ''; const abs = value < 0n ? -value : value; return `${sign}${formatTokenUnits(abs, decimals)}`; }
function formatDecimal(value: number) { return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : null; }
function classifyCapitalRegime(retentionPct: string | null, liquidityShare: number | null): CapitalRegime {
  const retention = retentionPct === null ? null : Number(retentionPct) / 100;
  if (retention === null) return 'INSUFFICIENT_DATA';
  if (retention >= PRINCIPAL_PERSISTENT) return 'STOCK_CAPITAL_PERSISTS';
  if (retention <= PRINCIPAL_UNWOUND && (liquidityShare === null || liquidityShare <= STOCK_WEAK)) return 'STOCK_CAPITAL_UNWINDING';
  return 'MULTIRAIL_CAPITAL';
}
function classifyFlowRegime(volumeShare: number | null): FlowRegime {
  if (volumeShare === null) return 'INSUFFICIENT_DATA';
  if (volumeShare >= STOCK_DOMINANT) return 'STOCK_FLOW_DOMINANT';
  if (volumeShare <= STOCK_WEAK) return 'MULTIRAIL_FLOW';
  return 'BALANCED_FLOW';
}
function classifyCapitalVsFlow(capital: CapitalRegime, flow: FlowRegime, liquidityShare: number | null, volumeShare: number | null): CapitalFlowRegime {
  if (capital === 'INSUFFICIENT_DATA' || flow === 'INSUFFICIENT_DATA' || liquidityShare === null || volumeShare === null) return 'INSUFFICIENT_DATA';
  if (capital === 'STOCK_CAPITAL_UNWINDING' && liquidityShare <= STOCK_WEAK && volumeShare <= STOCK_WEAK) return 'STOCK_RELATIONSHIP_DECAYING';
  if (liquidityShare >= STOCK_DOMINANT && volumeShare >= STOCK_DOMINANT) return 'STOCK_ANCHORED';
  if (capital === 'STOCK_CAPITAL_PERSISTS' && volumeShare <= STOCK_WEAK) return 'STOCK_CAPITAL_MULTIRAIL_FLOW';
  return 'MULTIRAIL_CAPITAL_MULTIRAIL_FLOW';
}
function verdict(status: AiNvdaD7ReAudit['status'], retentionPct: string | null, d7: AiNvdaCheckpoint | null, regime: CapitalFlowRegime): AiNvdaD7Verdict {
  const retention = retentionPct === null ? null : Number(retentionPct) / 100;
  if (status !== 'OBSERVED' || !d7 || d7.quote_alignment !== 'ALIGNED' || retention === null) return 'OBSERVING';
  if (retention >= PRINCIPAL_PERSISTENT && regime !== 'STOCK_RELATIONSHIP_DECAYING' && regime !== 'INSUFFICIENT_DATA') return 'SUPPORTING_EVIDENCE';
  if (retention <= PRINCIPAL_UNWOUND && regime === 'STOCK_RELATIONSHIP_DECAYING') return 'FALSIFYING_EVIDENCE';
  return 'OBSERVING';
}
function policy(): AiNvdaD7ReAudit['h2b_policy'] {
  return { policy_version: H2B_D7_PRECOMMIT_POLICY_VERSION, frozen_before_d7_fetch: true, supporting_evidence_if: ['D7 LONG launch-position principal is aligned with canonical NVDA totalSupply and stock quote market context.', 'NVDA principal retention is >= 90%.', 'Capital/flow regime is not STOCK_RELATIONSHIP_DECAYING.'], falsifying_evidence_if: ['D7 evidence is aligned.', 'NVDA principal retention is <= 50%.', 'Stock quote liquidity share and stock quote volume share are both <= 40%, producing STOCK_RELATIONSHIP_DECAYING.'], observing_if: ['D7 is pending or unavailable.', 'Launch-position inventory, canonical totalSupply or quote context is not aligned.', 'Retention and capital/flow movement fall between the precommitted support and falsification bands.'] };
}
function underlyingSession(now: Date): AiNvdaCheckpoint['basis_session_context']['underlying_session'] { const day = now.getUTCDay(); if (day === 0 || day === 6) return 'WEEKEND'; const minutes = now.getUTCHours() * 60 + now.getUTCMinutes(); return minutes >= 13 * 60 + 30 && minutes < 20 * 60 ? 'OPEN' : 'CLOSED'; }
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.freeze(value); for (const nested of Object.values(value as Record<string, unknown>)) if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) freeze(nested); } return value; }
