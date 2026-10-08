import type { PreSpendCheckRequest, PreSpendCheckResponse } from './preSpendDecisionService';
import type { DecisionState } from './preSpendDecisionService';
import type { ObservationReceipt, EvaluationReceipt, JudgmentReceipt } from '../schemas/receipts';
import type { ScoreProjection } from '../schemas/scoreProjection';
import { DecisionContextSchema, type DecisionContext } from '../schemas/decisionContext';
import { JudgmentFactsSchema, type CanonicalDecision } from '../schemas/preSpend';
import { canonicalSerialize, hashCanonical, verifyReceiptIntegrity } from './receiptIntegrityService';
import { createDerivedScoreService } from './derivedScoreService';
import type { ReceiptReader, ReceiptAppendStore } from './receiptAuthorityService';

export type DecisionPolicy = DecisionContext['policy'];
export type DecisionOutput = DecisionContext['output'];

/** Unknown or ambiguous legacy states never imply approval. */
export function adaptDecision(state: string, bounded: boolean, veto = false): CanonicalDecision {
  if (veto) return 'do_not_spend';
  const mapping: Record<DecisionState, CanonicalDecision> = {
    approved: 'proceed', approved_with_warning: bounded ? 'test_spend_first' : 'insufficient_evidence',
    use_with_caution: bounded ? 'test_spend_first' : 'insufficient_evidence',
    requires_human_approval: 'insufficient_evidence', do_not_use: 'do_not_spend'
  };
  return mapping[state as DecisionState] ?? 'insufficient_evidence';
}

/** This pure rule is shared by issuance and offline replay of the frozen inputs. */
export function assessFrozenDecision(input: PreSpendCheckRequest, legacy: PreSpendCheckResponse,
  observations: ObservationReceipt[], history: ScoreProjection | null, at: Date, policy: DecisionPolicy): DecisionOutput {
  const subject = input.subject_id ?? legacy.recommended_route ?? '';
  const intentHash = hashCanonical(input);
  const facts = observations.map(o => JudgmentFactsSchema.safeParse(o.payload));
  const sufficient = observations.length > 0 && observations.every((o, i) =>
    verifyReceiptIntegrity('observation', o) && o.subject_id === subject && o.intent_hash === intentHash &&
    o.subject_type === observations[0].subject_type && o.evidence_state === 'sufficient' && o.evidence_refs.length > 0 &&
    o.source_type === 'reviewed_judgment_facts' && o.provenance.catalog_source === 'live' &&
    o.provenance.fixture !== true && Date.parse(o.ingested_at) <= at.getTime() &&
    o.freshness_expires_at !== null && Date.parse(o.freshness_expires_at) > at.getTime() && facts[i].success &&
    facts[i].data!.settlement === input.preferred_settlement && facts[i].data!.max_cost <= input.budget &&
    facts[i].data!.route_id === legacy.recommended_route);
  const policies = facts.flatMap(f => f.success ? [f.data] : []);
  const confidence = sufficient ? Math.min(...policies.map(f => f.confidence)) : 0;
  const veto = policies.some(f => f.deterministic_veto || f.decision_state === 'do_not_use');
  const bounded = sufficient && policies.every(f => f.bounded_test_allowed) && !legacy.requires_human_approval && legacy.known_blockers.length === 0;
  const reviewedState = policies.length && policies.every(f => f.decision_state === policies[0].decision_state) ? policies[0].decision_state : 'unknown';
  const state = legacy.decision === 'use_with_caution' || legacy.decision === 'approved' ? reviewedState : legacy.decision;
  let decision: CanonicalDecision = sufficient && (reviewedState !== 'unknown' || veto) ? adaptDecision(state, bounded, veto) : 'insufficient_evidence';
  if (legacy.decision === 'do_not_use' && reviewedState !== 'do_not_use' && !veto) decision = 'insufficient_evidence';
  if (decision === 'proceed' && (confidence < Math.max(policy.threshold, input.required_confidence) || legacy.requires_human_approval || legacy.known_blockers.length > 0)) decision = 'insufficient_evidence';
  const historyReasons: string[] = [];
  if (sufficient && history && history.score <= policy.veto_threshold && decision !== 'insufficient_evidence') {
    decision = 'do_not_spend';
    historyReasons.push('historical_execution_performance_degraded', 'derived_score_below_policy_threshold');
    if (history.outcome_counts.contradicted > 0) historyReasons.push('contradicted_evaluation_in_history');
  }
  const valid = new Date(Math.min(at.getTime() + policy.ttl_ms, ...observations.filter(o => o.freshness_expires_at).map(o => Date.parse(o.freshness_expires_at!))));
  return { decision, confidence,
    reasons: sufficient ? [...policies.flatMap(f => f.reasons), ...historyReasons] : ['Required fresh, scoped, live evidence is missing.'],
    valid_until: valid.getTime() > at.getTime() ? valid.toISOString() : at.toISOString() };
}

export function sealDecisionContext(input: Omit<DecisionContext, 'context_hash'>): DecisionContext {
  const body = DecisionContextSchema.omit({ context_hash: true }).parse(input);
  const context = { ...body, context_hash: hashCanonical(body) };
  return DecisionContextSchema.parse(context);
}

/** Resolves exact committed dependencies. Later evaluations are deliberately outside this replay. */
export async function verifyDecisionContext(context: DecisionContext, judgment: JudgmentReceipt, store: ReceiptReader): Promise<boolean> {
  try {
    const parsed = DecisionContextSchema.parse(context);
    const { context_hash, ...body } = parsed;
    if (hashCanonical(body) !== context_hash || judgment.schema_version !== 'canonical-receipts.v2' ||
      judgment.decision_context_hash !== context_hash || judgment.judgment_id !== parsed.assessment_id ||
      judgment.intent_hash !== parsed.intent_hash || judgment.subject_type !== parsed.subject_type ||
      judgment.subject_id !== parsed.subject_id || judgment.issued_at !== parsed.assessed_at ||
      hashCanonical(parsed.request) !== parsed.request_hash || parsed.intent_hash !== parsed.request_hash ||
      hashCanonical(parsed.legacy) !== parsed.legacy_hash || hashCanonical(parsed.policy) !== parsed.policy_hash ||
      parsed.projection_boundary.quote_assessed_at !== parsed.assessed_at ||
      hashCanonical(parsed.evaluation_refs) !== parsed.projection_boundary.evaluation_refs_hash ||
      parsed.policy.engine_version !== 'pre-spend-decision.v2' || parsed.policy.veto_threshold !== -10 ||
      judgment.proceed_confidence_threshold !== parsed.policy.threshold ||
      judgment.charge !== parsed.policy.amount || (judgment.payment && judgment.payment.asset !== parsed.policy.asset) ||
      judgment.cited_observation_ids.length !== parsed.observation_refs.length) return false;
    const observations: ObservationReceipt[] = [];
    for (const [index, ref] of parsed.observation_refs.entries()) {
      const observation = await store.get('observation', ref.observation_id) as ObservationReceipt | null;
      if (!observation || observation.receipt_hash !== ref.receipt_hash || !verifyReceiptIntegrity('observation', observation) ||
        judgment.cited_observation_ids[index] !== ref.observation_id || judgment.parent_hashes[index] !== ref.receipt_hash) return false;
      observations.push(observation);
    }
    const evaluations: EvaluationReceipt[] = [];
    for (const ref of parsed.evaluation_refs) {
      const evaluation = await store.get('evaluation', ref.evaluation_id) as EvaluationReceipt | null;
      if (!evaluation || evaluation.receipt_hash !== ref.receipt_hash || evaluation.score_delta !== ref.score_delta) return false;
      evaluations.push(evaluation);
    }
    const frozen = {
      judgmentTrust: store.judgmentTrust,
      getDecisionContext: store.getDecisionContext?.bind(store),
      get: store.get.bind(store),
      list: async (kind: 'observation' | 'judgment' | 'execution' | 'evaluation') => kind === 'evaluation' ? evaluations : []
    } as ReceiptAppendStore;
    const projection = await createDerivedScoreService(frozen, parsed.policy.threshold).project(parsed.subject_type, parsed.subject_id);
    if (canonicalSerialize(projection) !== canonicalSerialize(parsed.score_projection)) return false;
    const expected = assessFrozenDecision(parsed.request, parsed.legacy, observations, projection, new Date(parsed.assessed_at), parsed.policy);
    return canonicalSerialize(expected) === canonicalSerialize(parsed.output) &&
      judgment.decision === expected.decision && judgment.confidence === expected.confidence &&
      canonicalSerialize(judgment.reasons) === canonicalSerialize(expected.reasons) && judgment.valid_until === expected.valid_until;
  } catch { return false; }
}
