import type { PreSpendCheckRequest, PreSpendCheckResponse } from './preSpendDecisionService';
import type { ObservationReceipt } from '../schemas/receipts';
import type { JudgmentDomainContext } from '../schemas/judgmentDomain';
import type { PltrPreflightState } from './rhChainPltrPreflightService';

export type DomainEvidence = {
  domain: 'service_delivery' | 'market_structure';
  subject: JudgmentDomainContext['subject'];
  policy: JudgmentDomainContext['policy'];
  observations: ObservationReceipt[];
  blockers: string[];
  execution_authorized: false;
};
export interface JudgmentEvidenceAdapter {
  resolve(input: PreSpendCheckRequest, observations: ObservationReceipt[], at: Date): DomainEvidence;
}

/** Sources are resolved by server authority, never by following client URLs. */
export const serviceEvidenceAdapter: JudgmentEvidenceAdapter = {
  resolve(input, observations, at) {
    const context = input.judgment_context!;
    const blockers: string[] = [];
    if (context.subject.type !== 'service_route') blockers.push('subject_policy_not_qualified');
    if (context.policy.id !== 'solana.service-spend' || context.subject.network !== 'solana:mainnet') blockers.push('subject_policy_mismatch');
    if (input.subject_id !== context.subject.id) blockers.push('subject_identity_mismatch');
    if (!context.evidence_refs.length || new Set(context.evidence_refs).size !== context.evidence_refs.length) blockers.push('scoped_evidence_required');
    if (observations.length !== context.evidence_refs.length || observations.some(o =>
      !context.evidence_refs.includes(o.observation_id) || o.subject_type !== context.subject.type || o.subject_id !== context.subject.id ||
      o.provenance.subject_network !== context.subject.network || o.provenance.policy_id !== context.policy.id ||
      o.provenance.policy_version !== context.policy.version)) blockers.push('evidence_policy_binding_missing');
    if (Date.parse(context.expires_at) <= at.getTime()) blockers.push('requested_judgment_expired');
    return { domain: 'service_delivery', subject: context.subject, policy: context.policy, observations, blockers, execution_authorized: false };
  }
};

/** Market existence/quote/depth are preserved as context, never rewritten as service delivery facts. */
export function normalizeRhMarketEvidence(context: JudgmentDomainContext, state: PltrPreflightState | null, at: Date) {
  const id = context.subject.id.slice(`${context.subject.network}:${context.subject.type}:`.length).toLowerCase();
  const market = state?.direct_markets.find(m => m.pool_id.toLowerCase() === id || m.pool_address?.toLowerCase() === id);
  const blockers = ['rh_execution_policy_unqualified', 'independent_market_evaluation_unavailable'];
  if (!state) blockers.push('market_evidence_unavailable');
  if (!market || market.verification_state !== 'VERIFIED') blockers.push('canonical_pool_verification_required');
  if (market && (market.freshness !== 'fresh' || !Number.isFinite(Date.parse(market.observed_at)) ||
    Date.parse(market.observed_at) > at.getTime() || at.getTime() - Date.parse(market.observed_at) > 120_000)) blockers.push('market_evidence_stale');
  if (!market?.quote_direction_verified) blockers.push('quote_provenance_unverified');
  if (!market?.depth_primitive) blockers.push('verified_depth_required');
  if (state?.basis.status !== 'AVAILABLE' || state.basis.freshness !== 'fresh') blockers.push('aligned_stock_token_reference_required');
  return {
    domain: 'market_structure' as const, subject: context.subject, policy: context.policy,
    canonical_identity: state?.canonical_identity ?? null,
    market: market ?? null, basis: state?.basis ?? null, data_gaps: state?.data_gaps ?? ['market_evidence_unavailable'],
    blockers, execution_authorized: false as const
  };
}
export const rhMarketEvidenceAdapter: JudgmentEvidenceAdapter = {
  resolve(input, _observations, at) {
    const context = input.judgment_context!;
    const market = normalizeRhMarketEvidence(context, null, at);
    return { domain: market.domain, subject: context.subject, policy: context.policy, observations: [], blockers: market.blockers, execution_authorized: false };
  }
};

/** Domain policy admission runs before deterministic evidence gates in the one authority. */
export function domainPolicyBlockers(input: PreSpendCheckRequest, legacy: PreSpendCheckResponse, observations: ObservationReceipt[], at: Date) {
  const context = input.judgment_context;
  if (!context) return [];
  const adapter = context.policy.id === 'solana.service-spend' ? serviceEvidenceAdapter : rhMarketEvidenceAdapter;
  const evidence = adapter.resolve(input, observations, at);
  const blockers = [...evidence.blockers];
  if (context.policy.id === 'solana.service-spend' && context.subject.id !== `solana:mainnet:service_route:${legacy.recommended_route}`) blockers.push('route_identity_mismatch');
  return blockers;
}

/** Map only the reviewed service-route namespace into the legacy diagnostic catalog.
 * Canonical hashes and receipt subjects still use the original complete request. */
export function serviceDiagnosticRequest(input: PreSpendCheckRequest): PreSpendCheckRequest {
  const context = input.judgment_context;
  if (context?.subject.network !== 'solana:mainnet' || context.subject.type !== 'service_route') return input;
  return { ...input, subject_id: context.subject.id.slice('solana:mainnet:service_route:'.length) };
}
