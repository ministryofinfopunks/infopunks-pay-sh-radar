import { CANONICAL_RECEIPT_SCHEMA_VERSION, type EvaluationReceipt, type ExecutionReceipt } from '../schemas/receipts';
import { EvaluateRequestSchema, hasAuthoredScore } from '../schemas/evaluate';
import { hashCanonical, receiptSchemas, sealReceipt } from './receiptIntegrityService';
import { assertReceiptAuthority, ReceiptAuthorityError, type ReceiptAppendStore } from './receiptAuthorityService';
import { canonicalEvaluationScorePolicy, evaluationReceiptMatchesScorePolicy } from './evaluationScorePolicy';

export type EvaluationInput = Omit<EvaluationReceipt, 'schema_version' | 'policy_version' | 'score_delta' | 'parent_hash' | 'receipt_hash' | 'evaluator' | 'request_hash'>;
export class EvaluationServiceError extends ReceiptAuthorityError {
  override readonly statusCode: number;
  constructor(code: string, statusCode = 400) { super(code); this.statusCode = statusCode; }
}
/** Validation delegates to the sole evaluation authority; it never computes a new delta. */
export function assertEvaluationPolicy(receipt: EvaluationReceipt) {
  if (!evaluationReceiptMatchesScorePolicy(receipt)) throw new EvaluationServiceError('evaluation_policy_delta_invalid');
  if (receipt.policy_version === canonicalEvaluationScorePolicy.version &&
      (!receipt.evaluator || receipt.evaluator.verification !== 'internal' || receipt.evaluator.type !== 'internal' ||
       !['canonical-admin', 'evaluation-service'].includes(receipt.evaluator.id))) {
    throw new EvaluationServiceError('evaluator_provenance_required');
  }
}

export function createEvaluationService(store: ReceiptAppendStore, threshold = 80, now = () => new Date()) {
  const inputSchema = receiptSchemas.evaluation.omit({ schema_version: true, policy_version: true, score_delta: true, parent_hash: true, receipt_hash: true, evaluator: true, request_hash: true });
  async function write(input: EvaluationInput, evaluator: NonNullable<EvaluationReceipt['evaluator']>, requestHash?: string): Promise<EvaluationReceipt> {
    const parent = await store.get('execution', input.execution_id) as ExecutionReceipt | null;
    if (!parent) throw new EvaluationServiceError('execution_not_found');
    await assertReceiptAuthority('execution', parent, store, threshold);
    const receipt = sealReceipt('evaluation', {
      ...input, evaluator, ...(requestHash ? { request_hash: requestHash } : {}),
      schema_version: CANONICAL_RECEIPT_SCHEMA_VERSION,
      policy_version: canonicalEvaluationScorePolicy.version,
      score_delta: canonicalEvaluationScorePolicy.scoreDeltaForOutcome(input.outcome), parent_hash: parent.receipt_hash
    });
    return store.append('evaluation', receipt) as Promise<EvaluationReceipt>;
  }
  async function existing(id: string, requestHash: string) {
    const receipt = await store.get('evaluation', id) as EvaluationReceipt | null;
    if (!receipt) return null;
    if (receipt.request_hash !== requestHash) throw new EvaluationServiceError('idempotency_conflict', 409);
    await assertReceiptAuthority('evaluation', receipt, store, threshold);
    return receipt;
  }
  return {
    /** In-process reviewed authority. HTTP callers cannot supply provenance or deltas. */
    async createEvaluation(raw: EvaluationInput): Promise<EvaluationReceipt> {
      if (hasAuthoredScore(raw)) throw new EvaluationServiceError('score_delta_authoring_forbidden');
      return write(inputSchema.parse(raw), { type: 'internal', id: 'evaluation-service', verification: 'internal' });
    },
    async submit(raw: unknown, authenticatedPrincipal?: 'canonical-admin'): Promise<EvaluationReceipt> {
      if (hasAuthoredScore(raw)) throw new EvaluationServiceError('score_delta_authoring_forbidden');
      const parsed = EvaluateRequestSchema.safeParse(raw);
      if (!parsed.success) throw new EvaluationServiceError('invalid_evaluation_request');
      const input = parsed.data;
      // No external signature verifier is configured. A claimed identity or signature is not verification.
      if (!authenticatedPrincipal || input.evaluator.type !== 'internal' || input.evaluator.id !== authenticatedPrincipal || input.evaluator.signature) {
        throw new EvaluationServiceError('evaluator_provenance_required', 403);
      }
      const { idempotency_key: key, ...content } = input;
      const requestHash = hashCanonical(content);
      const id = 'evaluation_' + hashCanonical({ principal: authenticatedPrincipal, key }).slice(7);
      const prior = await existing(id, requestHash);
      if (prior) return prior;
      const parent = await store.get('execution', input.execution_receipt_id) as ExecutionReceipt | null;
      if (!parent) throw new EvaluationServiceError('execution_not_found');
      const evidence = input.evidence_refs ?? parent.artifact_refs;
      if (!evidence.length) throw new EvaluationServiceError('evaluation_evidence_required');
      try {
        return await write({ evaluation_id: id, execution_id: parent.execution_id, evaluated_at: now().toISOString(), outcome: input.outcome,
          reasons: input.reasons ?? ['execution_outcome_' + input.outcome], evidence_refs: evidence,
          outcome_labels: input.outcome_labels ?? [] }, { type: 'internal', id: authenticatedPrincipal, verification: 'internal' }, requestHash);
      } catch (error) {
        if (error instanceof ReceiptAuthorityError && ['receipt_id_conflict', 'execution_already_evaluated'].includes(error.code)) {
          const winner = await existing(id, requestHash);
          if (winner) return winner;
          throw new EvaluationServiceError(error.code, 409);
        }
        throw error;
      }
    }
  };
}
