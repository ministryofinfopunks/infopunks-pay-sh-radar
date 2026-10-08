import { ECONOMIC_RAILS } from '../security/economicRails';
import type { JudgmentIssuer, JudgmentIssuerTrust } from '../security/judgmentIssuer';
import { CANONICAL_RECEIPT_SCHEMA_VERSION, type ObservationReceipt, type JudgmentReceipt, type ExecutionReceipt, type EvaluationReceipt, type ReceiptKind } from '../schemas/receipts';
import { hashCanonical, sealReceipt, verifyReceiptIntegrity } from './receiptIntegrityService';
import { createDerivedScoreService } from './derivedScoreService';
import type { DecisionContext } from '../schemas/decisionContext';
import { verifyDecisionContext } from './decisionContextService';

export const RECEIPT_POLICY_VERSION = 'receipt-authority.v1';
export const RECEIPT_POLICY_VERSION_V2 = 'receipt-authority.v2';
export class ReceiptAuthorityError extends Error {
  readonly statusCode: number = 400;
  constructor(readonly code: string) { super(code); this.name = 'ReceiptAuthorityError'; }
}
export type ReceiptRecord = ObservationReceipt | JudgmentReceipt | ExecutionReceipt | EvaluationReceipt;
export interface ReceiptReader {
  readonly judgmentTrust?: JudgmentIssuerTrust;
  get(kind: ReceiptKind, id: string): Promise<ReceiptRecord | null>;
  getDecisionContext?(assessmentId: string): Promise<DecisionContext | null>;
}
const requireAuthority = (condition: unknown, code: string): void => { if (!condition) throw new ReceiptAuthorityError(code); };

/** Replays the entire ancestry and validates policy at historical issuance time. */
export async function verifyReceiptChain(kind: ReceiptKind, receipt: ReceiptRecord, reader: ReceiptReader, threshold = 80): Promise<boolean> {
  try { await assertReceiptAuthority(kind, receipt, reader, threshold); return true; } catch { return false; }
}
export async function assertReceiptAuthority(kind: ReceiptKind, receipt: ReceiptRecord, reader: ReceiptReader, threshold = 80): Promise<void> {
  requireAuthority(verifyReceiptIntegrity(kind, receipt), 'receipt_integrity_invalid');
  if (kind === 'observation') return;
  if (kind === 'judgment') {
    const judgment = receipt as JudgmentReceipt;
    if (judgment.issuer_signature) requireAuthority(reader.judgmentTrust?.verify(judgment), 'judgment_issuer_signature_invalid');
    requireAuthority(judgment.policy_version === (judgment.schema_version === 'canonical-receipts.v2' ? RECEIPT_POLICY_VERSION_V2 : RECEIPT_POLICY_VERSION), 'unsupported_receipt_policy');
    if (judgment.schema_version === 'canonical-receipts.v2') {
      const context = await reader.getDecisionContext?.(judgment.judgment_id);
      requireAuthority(context && await verifyDecisionContext(context, judgment, reader), 'decision_context_invalid');
    }
    for (const [index, id] of judgment.cited_observation_ids.entries()) {
      const observation = await reader.get('observation', id) as ObservationReceipt | null;
      requireAuthority(observation, 'observation_not_found');
      if (!observation) return;
      await assertReceiptAuthority('observation', observation, reader, threshold);
      requireAuthority(judgment.parent_hashes[index] === observation.receipt_hash, 'parent_hash_mismatch');
      requireAuthority(observation.subject_id === judgment.subject_id && observation.subject_type === judgment.subject_type && observation.intent_hash === judgment.intent_hash, 'observation_scope_mismatch');
      requireAuthority(Date.parse(observation.ingested_at) <= Date.parse(judgment.issued_at), 'observation_after_judgment');
      if (observation.evidence_state === 'insufficient') requireAuthority(judgment.decision === 'insufficient_evidence', 'insufficient_evidence_decision_required');
      if (judgment.decision === 'proceed') {
        requireAuthority(observation.evidence_state === 'sufficient' && observation.evidence_refs.length > 0, 'sufficient_evidence_required');
        requireAuthority(observation.freshness_expires_at && Date.parse(observation.freshness_expires_at) >= Date.parse(judgment.valid_until), 'fresh_evidence_required');
        requireAuthority(judgment.confidence >= judgment.proceed_confidence_threshold, 'confidence_threshold_not_met');
      }
    }
    return;
  }
  if (kind === 'execution') {
    const execution = receipt as ExecutionReceipt;
    if (execution.verification) {
      const rail = ECONOMIC_RAILS[execution.verification.settlement.network];
      requireAuthority(execution.verification.profile === rail.profile && execution.verification.settlement.provenance === rail.provenance && execution.settlement_rail === rail.rail && execution.cost_asset === rail.asset && execution.settlement_ref.toLowerCase() === execution.verification.settlement.transaction_hash.toLowerCase(), 'execution_settlement_identity_mismatch');
    }
    const judgment = await reader.get('judgment', execution.judgment_id) as JudgmentReceipt | null;
    requireAuthority(judgment, 'judgment_not_found');
    if (!judgment) return;
    await assertReceiptAuthority('judgment', judgment, reader, threshold);
    requireAuthority(execution.parent_hash === judgment.receipt_hash, 'parent_hash_mismatch');
    requireAuthority(judgment.decision === 'proceed' || judgment.decision === 'test_spend_first', 'judgment_blocks_execution');
    requireAuthority(Date.parse(execution.executed_at) >= Date.parse(judgment.issued_at) && Date.parse(execution.executed_at) < Date.parse(judgment.valid_until), 'execution_outside_judgment_window');
    return;
  }
  const evaluation = receipt as EvaluationReceipt;
  // EvaluationService also depends on this authority; load its validator lazily.
  const { assertEvaluationPolicy } = await import('./evaluationService.js');
  assertEvaluationPolicy(evaluation);
  const execution = await reader.get('execution', evaluation.execution_id) as ExecutionReceipt | null;
  requireAuthority(execution, 'execution_not_found');
  if (!execution) return;
  await assertReceiptAuthority('execution', execution, reader, threshold);
  requireAuthority(evaluation.parent_hash === execution.receipt_hash, 'parent_hash_mismatch');
  requireAuthority(Date.parse(evaluation.evaluated_at) >= Date.parse(execution.executed_at), 'evaluation_before_execution');
}

export interface ReceiptAppendStore extends ReceiptReader {
  append(kind: ReceiptKind, receipt: ReceiptRecord): Promise<ReceiptRecord>;
  appendDecisionContext?(context: DecisionContext): Promise<DecisionContext>;
  list(kind: ReceiptKind): Promise<ReceiptRecord[]>;
  evaluationHistory?(subjectType: string, subjectId: string): Promise<ReceiptRecord[]>;
}
export function createReceiptAuthorityService(store: ReceiptAppendStore, threshold = 80, issuer?: JudgmentIssuer | null) {
  return {
    async appendObservation(input: Omit<ObservationReceipt, 'schema_version' | 'payload_hash' | 'receipt_hash'>) {
      const receipt = sealReceipt('observation', { ...input, schema_version: CANONICAL_RECEIPT_SCHEMA_VERSION, payload_hash: hashCanonical(input.payload) });
      return store.append('observation', receipt) as Promise<ObservationReceipt>;
    },
    async appendJudgment(input: Omit<JudgmentReceipt, 'schema_version' | 'policy_version' | 'proceed_confidence_threshold' | 'parent_hashes' | 'receipt_hash' | 'issuer_signature'>) {
      const parents = await Promise.all(input.cited_observation_ids.map((id) => store.get('observation', id)));
      requireAuthority(parents.every(Boolean), 'observation_not_found');
      const receipt = sealReceipt('judgment', { ...input,
        schema_version: input.decision_context_hash ? 'canonical-receipts.v2' : CANONICAL_RECEIPT_SCHEMA_VERSION,
        policy_version: input.decision_context_hash ? RECEIPT_POLICY_VERSION_V2 : RECEIPT_POLICY_VERSION,
        proceed_confidence_threshold: threshold, parent_hashes: parents.map((parent) => parent!.receipt_hash) }) as JudgmentReceipt;
      const existing = await store.get('judgment', input.judgment_id) as JudgmentReceipt | null;
      if (existing) {
        requireAuthority(existing.receipt_hash === receipt.receipt_hash, 'receipt_id_conflict');
        await assertReceiptAuthority('judgment', existing, store, threshold);
        return existing; // Rotation/restart retries retain the original issuer signature.
      }
      requireAuthority(issuer || !store.judgmentTrust?.requireSigned, 'judgment_signing_unavailable');
      return store.append('judgment', issuer ? issuer.sign(receipt) : receipt) as Promise<JudgmentReceipt>;
    },
    async appendExecution(input: Omit<ExecutionReceipt, 'schema_version' | 'parent_hash' | 'receipt_hash'>) {
      const parent = await store.get('judgment', input.judgment_id);
      requireAuthority(parent, 'judgment_not_found');
      return store.append('execution', sealReceipt('execution', { ...input, schema_version: CANONICAL_RECEIPT_SCHEMA_VERSION, parent_hash: parent!.receipt_hash })) as Promise<ExecutionReceipt>;
    },
    async projectScore(subjectType: string, subjectId: string) {
      const projection = await createDerivedScoreService(store, threshold).project(subjectType, subjectId);
      return { subject_type: subjectType, subject_id: subjectId, score: projection.score, authority: 'EvaluationReceipt' as const };
    },
    async replayEvaluation(id: string) {
      const evaluation = await store.get('evaluation', id);
      return Boolean(evaluation && await verifyReceiptChain('evaluation', evaluation, store, threshold));
    }
  };
}
