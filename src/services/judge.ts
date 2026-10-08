import { EconomicEvidenceFactsSchema, EconomicJobSchema, JevWitnessSchema, type EconomicJob, type DecisionEnvelope,
  type JevWitness, type EconomicCandidate } from '../schemas/economicEngine';
import type { ObservationReceipt } from '../schemas/receipts';
import { hashCanonical, verifyReceiptIntegrity } from './receiptIntegrityService';

export type JudgeVerdict = 'ALLOW' | 'DEGRADE' | 'BLOCK' | 'UNPROVEN';
export type JudgeResult = { verdict: JudgeVerdict; decision: 'proceed' | 'test_spend_first' | 'do_not_spend' | 'insufficient_evidence';
  candidate: EconomicCandidate | null; rules: string[]; confidence: number; evidence_ids: string[]; dissent: boolean };
const decisions = { ALLOW: 'proceed', DEGRADE: 'test_spend_first', BLOCK: 'do_not_spend', UNPROVEN: 'insufficient_evidence' } as const;
/** Pure deterministic policy core. Semantic confidence never establishes source truth. */
export function judgeEconomicDecision(input: { job: EconomicJob; envelope: DecisionEnvelope; witness: JevWitness;
  observations: ObservationReceipt[]; authenticatedPrincipal: string; enabledProfiles: string[]; now: Date }): JudgeResult {
  const { job, envelope, observations, now } = input;
  let candidate: EconomicCandidate | null = null;
  const result = (verdict: JudgeVerdict, rule: string, confidence = 0, ids: string[] = []): JudgeResult => ({
    verdict, decision: decisions[verdict], candidate, rules: [rule], confidence, evidence_ids: ids,
    dissent: input.witness.answer.kind === 'choice' && verdict !== 'ALLOW' });
  if (!EconomicJobSchema.safeParse(job).success || !JevWitnessSchema.safeParse(input.witness).success) return result('UNPROVEN', 'invalid_decision_contract');
  const witness = input.witness, policy = job.policy;
  if (policy.evidence_threshold < 1 || !Number.isFinite(now.getTime())) return result('UNPROVEN', 'invalid_policy_or_time');
  if (input.authenticatedPrincipal !== job.principal_id || policy.principal_id !== job.principal_id) return result('BLOCK', 'principal_scope_denied');
  if (envelope.state_hash !== hashCanonical(job.state) || envelope.menu_hash !== hashCanonical(job.candidates)
    || envelope.policy_hash !== hashCanonical(policy) || envelope.rubric_hash !== hashCanonical(job.question)
    || envelope.intent_hash !== job.intent_hash || envelope.principal_id !== job.principal_id || envelope.request_id !== job.request_id
    || envelope.model_id !== job.model_id || envelope.role !== job.role || hashCanonical(envelope.evidence_ids) !== hashCanonical(job.evidence_ids)
    || hashCanonical(envelope.candidates) !== hashCanonical(job.candidates) || witness.envelope_hash !== hashCanonical(envelope)
    || (witness.source === 'jev' && witness.returned_model_id !== job.model_id)
    || (witness.answer.kind === 'deterministic' && witness.source !== 'deterministic')
    || (witness.source === 'deterministic' && witness.answer.kind !== 'deterministic')
    || hashCanonical(witness.evidence_ids) !== hashCanonical(job.evidence_ids)) return result('UNPROVEN', 'decision_binding_changed');
  if (Date.parse(envelope.expires_at) <= now.getTime() || Date.parse(witness.received_at) > now.getTime()) return result('UNPROVEN', 'decision_expired');
  if (!policy.enabled) return result('BLOCK', 'policy_disabled');
  if (witness.answer.kind === 'choice' || witness.answer.kind === 'deterministic') { const selectedId = witness.answer.candidate_id; candidate = job.candidates.find(c => c.id === selectedId) ?? null; }
  // Verified host policy vetoes apply even when inference abstains.
  if (candidate && policy.revoked_candidate_ids.includes(candidate.id)) return result('BLOCK', 'candidate_revoked');
  const relevant = observations.filter(o => job.evidence_ids.includes(o.observation_id));
  const qualified = relevant.filter(o => verifyReceiptIntegrity('observation', o) && o.subject_id === job.subject_id
    && o.subject_type === job.subject_type && o.intent_hash === job.intent_hash && o.source_type === 'reviewed_economic_facts'
    && o.provenance.catalog_source === 'live' && o.provenance.fixture !== true && o.evidence_state === 'sufficient'
    && o.evidence_refs.length > 0 && Date.parse(o.ingested_at) <= now.getTime() && Date.parse(o.observed_at) <= now.getTime()
    && o.freshness_expires_at !== null && Date.parse(o.freshness_expires_at) > now.getTime()
    && EconomicEvidenceFactsSchema.safeParse(o.payload).success);
  const facts = qualified.map(o => ({ observation: o, facts: EconomicEvidenceFactsSchema.parse(o.payload) }));
  if (facts.some(({ facts: f }) => f.policy_hash === envelope.policy_hash && f.deterministic_veto
    && (!candidate || f.candidate_hash === hashCanonical(candidate)))) return result('BLOCK', 'verified_evidence_veto', 0, qualified.map(o => o.observation_id));
  if (!['choice', 'deterministic'].includes(witness.answer.kind) || !candidate) return result('UNPROVEN', witness.answer.kind === 'abstain' ? witness.answer.reason_code : 'selection_required');
  if (witness.answer.kind === 'choice') {
    if (witness.provider_response_hash === null) return result('UNPROVEN', 'provider_response_required');
    const p = witness.answer.probabilities, keys = [...job.candidates.map(c => c.id), 'abstain'];
    if (Object.keys(p).sort().join('\0') !== keys.sort().join('\0') || Math.abs(Object.values(p).reduce((a, b) => a + b, 0) - 1) > 0.000001
      || p[candidate.id] < Math.max(...Object.values(p))) return result('UNPROVEN', 'invalid_choice_distribution');
  }
  if (!policy.allowed_handlers.includes(candidate.handler_id)) return result('BLOCK', 'handler_denied');
  if (!candidate.evidence_ids.length || candidate.evidence_ids.some(id => !job.evidence_ids.includes(id))) return result('UNPROVEN', 'candidate_evidence_missing');
  const bound = facts.filter(({ observation }) => candidate!.evidence_ids.includes(observation.observation_id));
  // A newer snapshot from the same source supersedes an older cited approval,
  // including snapshots that are stale, disputed, incomplete, or negative.
  if (bound.some(({ observation: cited }) => observations.some(o => o.source_id === cited.source_id
    && o.subject_type === cited.subject_type && o.subject_id === cited.subject_id && o.intent_hash === cited.intent_hash
    && (Date.parse(o.observed_at) > Date.parse(cited.observed_at)
      || (o.observed_at === cited.observed_at && o.observation_id.localeCompare(cited.observation_id) > 0))))) return result('UNPROVEN', 'evidence_superseded');
  if (bound.length !== candidate.evidence_ids.length || bound.some(({ facts: f }) => f.candidate_hash !== hashCanonical(candidate!)
    || f.policy_hash !== envelope.policy_hash)) return result('UNPROVEN', 'evidence_binding_invalid');
  const evidenceConfidence = Math.min(...bound.map(({ facts: f }) => f.confidence));
  if (evidenceConfidence < policy.evidence_threshold) return result('UNPROVEN', 'evidence_threshold_not_met');
  if (witness.answer.kind === 'choice' && (witness.answer.confidence < policy.choice_confidence_threshold
    || witness.answer.probabilities[candidate.id] < policy.choice_probability_threshold)) return result('UNPROVEN', 'semantic_threshold_not_met');
  if (policy.manual_review_required) return result('UNPROVEN', 'manual_review_required');
  const op = candidate.operation;
  if (candidate.action === 'execute_route' && !op) return result('UNPROVEN', 'execution_operation_missing');
  if (op) {
    if (!policy.allowed_profiles.includes(op.profile_id) || !input.enabledProfiles.includes(op.profile_id)) return result('UNPROVEN', 'execution_profile_unsupported');
    if (!policy.allowed_chains.includes(op.chain_id) || !policy.allowed_assets.includes(op.asset_id) || !policy.allowed_payers.includes(op.payer)
      || !policy.allowed_recipients.includes(op.recipient) || !policy.allowed_routers.includes(op.router)) return result('BLOCK', 'execution_scope_denied');
    if (policy.asset_decimals[op.asset_id] !== op.decimals) return result('UNPROVEN', 'asset_units_unqualified');
    if (BigInt(op.amount_atomic) > BigInt(policy.max_amount_atomic) || BigInt(op.max_fee_atomic) > BigInt(policy.max_fee_atomic)
      || op.max_slippage_bps > policy.max_slippage_bps) return result('BLOCK', 'execution_cap_exceeded');
  }
  const ids = bound.map(({ observation }) => observation.observation_id);
  if (bound.some(({ facts: f }) => f.bounded_test_required)) {
    if (!op || policy.bounded_test_amount_atomic === null || BigInt(op.amount_atomic) > BigInt(policy.bounded_test_amount_atomic)) return result('UNPROVEN', 'bounded_test_operation_required');
    return result('DEGRADE', 'bounded_test_only', evidenceConfidence, ids);
  }
  return result('ALLOW', 'all_deterministic_gates_passed', evidenceConfidence, ids);
}
