import { CANONICAL_RECEIPT_SCHEMA_VERSION, type ObservationReceipt, type JudgmentReceipt, type ExecutionReceipt, type EvaluationReceipt, type ReceiptKind } from '../schemas/receipts';
import { hashCanonical, sealReceipt, verifyReceiptIntegrity } from './receiptIntegrityService';
import { EVALUATION_POLICY_VERSION, evaluationReceiptMatchesScorePolicy } from './evaluationScorePolicy';

export const RECEIPT_POLICY_VERSION = 'receipt-authority.v1';
export class ReceiptAuthorityError extends Error {
  readonly statusCode = 400;
  constructor(readonly code: string) { super(code); this.name = 'ReceiptAuthorityError'; }
}
export type ReceiptRecord = ObservationReceipt | JudgmentReceipt | ExecutionReceipt | EvaluationReceipt;
export interface ReceiptReader {
  get(kind: ReceiptKind, id: string): Promise<ReceiptRecord | null>;
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
    requireAuthority(judgment.policy_version === RECEIPT_POLICY_VERSION, 'unsupported_receipt_policy');
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
  requireAuthority(evaluation.policy_version === EVALUATION_POLICY_VERSION && evaluationReceiptMatchesScorePolicy(evaluation), 'evaluation_policy_delta_invalid');
  const execution = await reader.get('execution', evaluation.execution_id) as ExecutionReceipt | null;
  requireAuthority(execution, 'execution_not_found');
  if (!execution) return;
  await assertReceiptAuthority('execution', execution, reader, threshold);
  requireAuthority(evaluation.parent_hash === execution.receipt_hash, 'parent_hash_mismatch');
  requireAuthority(Date.parse(evaluation.evaluated_at) >= Date.parse(execution.executed_at), 'evaluation_before_execution');
}

export interface ReceiptAppendStore extends ReceiptReader {
  append(kind: ReceiptKind, receipt: ReceiptRecord): Promise<ReceiptRecord>;
  list(kind: ReceiptKind): Promise<ReceiptRecord[]>;
}
export function createReceiptAuthorityService(store: ReceiptAppendStore, threshold = 80) {
  return {
    async appendObservation(input: Omit<ObservationReceipt, 'schema_version' | 'payload_hash' | 'receipt_hash'>) {
      const receipt = sealReceipt('observation', { ...input, schema_version: CANONICAL_RECEIPT_SCHEMA_VERSION, payload_hash: hashCanonical(input.payload) });
      return store.append('observation', receipt) as Promise<ObservationReceipt>;
    },
    async appendJudgment(input: Omit<JudgmentReceipt, 'schema_version' | 'policy_version' | 'proceed_confidence_threshold' | 'parent_hashes' | 'receipt_hash'>) {
      const parents = await Promise.all(input.cited_observation_ids.map((id) => store.get('observation', id)));
      requireAuthority(parents.every(Boolean), 'observation_not_found');
      return store.append('judgment', sealReceipt('judgment', { ...input, schema_version: CANONICAL_RECEIPT_SCHEMA_VERSION, policy_version: RECEIPT_POLICY_VERSION, proceed_confidence_threshold: threshold, parent_hashes: parents.map((parent) => parent!.receipt_hash) })) as Promise<JudgmentReceipt>;
    },
    async appendExecution(input: Omit<ExecutionReceipt, 'schema_version' | 'parent_hash' | 'receipt_hash'>) {
      const parent = await store.get('judgment', input.judgment_id);
      requireAuthority(parent, 'judgment_not_found');
      return store.append('execution', sealReceipt('execution', { ...input, schema_version: CANONICAL_RECEIPT_SCHEMA_VERSION, parent_hash: parent!.receipt_hash })) as Promise<ExecutionReceipt>;
    },
    async projectScore(subjectType: string, subjectId: string) {
      let score = 0;
      const seenExecutions = new Set<string>();
      for (const raw of await store.list('evaluation')) {
        const evaluation = raw as EvaluationReceipt;
        await assertReceiptAuthority('evaluation', evaluation, store, threshold);
        requireAuthority(!seenExecutions.has(evaluation.execution_id), 'duplicate_execution_evaluation');
        seenExecutions.add(evaluation.execution_id);
        const execution = await store.get('execution', evaluation.execution_id) as ExecutionReceipt;
        const judgment = await store.get('judgment', execution.judgment_id) as JudgmentReceipt;
        if (judgment.subject_type === subjectType && judgment.subject_id === subjectId) score += evaluation.score_delta;
      }
      return { subject_type: subjectType, subject_id: subjectId, score, authority: 'EvaluationReceipt' as const };
    },
    async replayEvaluation(id: string) {
      const evaluation = await store.get('evaluation', id);
      return Boolean(evaluation && await verifyReceiptChain('evaluation', evaluation, store, threshold));
    }
  };
}
