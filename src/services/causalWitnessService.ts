import type { JudgmentIssuer } from '../security/judgmentIssuer';
import type { DecisionContext } from '../schemas/decisionContext';
import type { EvaluationReceipt, ExecutionReceipt, JudgmentReceipt, ObservationReceipt } from '../schemas/receipts';
import { assessFrozenDecision, verifyDecisionContext } from './decisionContextService';
import { hashCanonical } from './receiptIntegrityService';
import { verifyReceiptChain, type ReceiptAppendStore } from './receiptAuthorityService';

export class CausalWitnessError extends Error { constructor(readonly code: string) { super(code); } }
export function createCausalWitnessService(store: ReceiptAppendStore, issuer?: JudgmentIssuer | null) {
  async function build(j1Id: string, evaluationId: string, j2Id: string) {
    const j1 = await store.get('judgment', j1Id) as JudgmentReceipt | null;
    const j2 = await store.get('judgment', j2Id) as JudgmentReceipt | null;
    const evaluation = await store.get('evaluation', evaluationId) as EvaluationReceipt | null;
    const execution = evaluation ? await store.get('execution', evaluation.execution_id) as ExecutionReceipt | null : null;
    const context1 = j1 ? await store.getDecisionContext?.(j1Id) : null;
    const context2 = j2 ? await store.getDecisionContext?.(j2Id) : null;
    if (!j1 || !j2 || !execution || !evaluation || !context1 || !context2) throw new CausalWitnessError('witness_ancestry_missing');
    if (context1.evaluation_refs.length !== 0 || context2.evaluation_refs.length !== 1)
      throw new CausalWitnessError('witness_scope_requires_single_evaluation');
    if (execution.judgment_id !== j1Id || !context2.evaluation_refs.some(ref => ref.evaluation_id === evaluationId && ref.receipt_hash === evaluation.receipt_hash)
      || !evaluation.classification || execution.score_eligibility?.state !== 'qualifying') throw new CausalWitnessError('witness_causal_edge_unqualified');
    if (!await verifyReceiptChain('evaluation', evaluation, store) || !await verifyDecisionContext(context1, j1, store)
      || !await verifyDecisionContext(context2, j2, store)) throw new CausalWitnessError('witness_replay_invalid');
    const evaluationAcceptance = await store.getAcceptance?.('evaluation', evaluationId);
    if (!evaluationAcceptance) throw new CausalWitnessError('witness_acceptance_missing');
    const observations: ObservationReceipt[] = [];
    const observationRefs = [...context1.observation_refs, ...context2.observation_refs];
    for (const ref of observationRefs) {
      const o = await store.get('observation', ref.observation_id) as ObservationReceipt | null;
      if (!o || o.receipt_hash !== ref.receipt_hash) throw new CausalWitnessError('witness_observation_missing');
      if (!observations.some(existing => existing.observation_id === o.observation_id)) observations.push(o);
    }
    const j2Observations = context2.observation_refs.map(ref => observations.find(o => o.observation_id === ref.observation_id)!);
    const projection = context2.score_projection;
    const counterfactualProjection = { ...projection,
      score: projection.score - evaluation.score_delta, evaluation_count: projection.evaluation_count - 1,
      contributing_evaluation_ids: projection.contributing_evaluation_ids.filter(id => id !== evaluationId),
      outcome_counts: { ...projection.outcome_counts, [evaluation.outcome]: projection.outcome_counts[evaluation.outcome] - 1 },
      projection_hash: hashCanonical({ counterfactual: context2.context_hash, minus: evaluation.receipt_hash }) };
    if (counterfactualProjection.evaluation_count < 0 || counterfactualProjection.outcome_counts[evaluation.outcome] < 0)
      throw new CausalWitnessError('witness_projection_invalid');
    const counterfactualOutput = assessFrozenDecision(context2.request, context2.legacy, j2Observations,
      counterfactualProjection, new Date(context2.assessed_at), context2.policy);
    const counterfactual = { version: 'same-input-minus-evaluation.v1', designated_evaluation_id: evaluationId,
      projection: counterfactualProjection, output: counterfactualOutput, category_changed: counterfactualOutput.decision !== context2.output.decision };
    const body = { version: 'ipx-causal-witness.v1', j1, execution, evaluation, j2, context1, context2,
      observations, evaluation_acceptance: evaluationAcceptance, counterfactual, real_route_verified: false, improvement_measured: false };
    const witnessHash = hashCanonical(body);
    const signedAt = new Date().toISOString();
    return { ...body, witness_hash: witnessHash, signed_at: issuer?.signWitness ? signedAt : null,
      signature: issuer?.signWitness ? issuer.signWitness(witnessHash, signedAt) : null,
      signer_registry: issuer?.publicKeys() ?? null };
  }
  async function verify(witness: Awaited<ReturnType<typeof build>>) {
    const { witness_hash, signed_at, signature, signer_registry, ...body } = witness;
    if (hashCanonical(body) !== witness_hash || !signed_at || !signature || !signer_registry ||
      !issuer?.verifyWitness?.(witness_hash, signed_at, signature)) return false;
    try {
      const replay = await build(witness.j1.judgment_id, witness.evaluation.evaluation_id, witness.j2.judgment_id);
      return replay.witness_hash === witness_hash && witness.counterfactual.category_changed;
    } catch { return false; }
  }
  return { build, verify };
}
