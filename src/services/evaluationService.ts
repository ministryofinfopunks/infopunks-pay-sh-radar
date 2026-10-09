import { CANONICAL_RECEIPT_SCHEMA_VERSION, type EvaluationReceipt, type ExecutionReceipt } from '../schemas/receipts';
import { EvaluateRequestSchema, hasAuthoredScore } from '../schemas/evaluate';
import { hashCanonical, receiptSchemas, sealReceipt } from './receiptIntegrityService';
import { assertReceiptAuthority, ReceiptAuthorityError, type ReceiptAppendStore } from './receiptAuthorityService';
import { canonicalEvaluationScorePolicy, evaluationReceiptMatchesScorePolicy } from './evaluationScorePolicy';
import { REVIEW_ATTESTED_EVALUATION_POLICY } from './evaluationScorePolicy';
import { VerifiedEvaluationSubmissionSchema } from '../schemas/evaluationReviewAttestation';
import { evaluationAttestationDigest, evaluationOutcomeEvidenceDigest, type EvaluationReviewerTrust } from '../security/evaluationReviewerTrust';

export type EvaluationInput = Omit<EvaluationReceipt, 'schema_version' | 'policy_version' | 'score_delta' | 'parent_hash' | 'receipt_hash' | 'evaluator' | 'request_hash'>;
export class EvaluationServiceError extends ReceiptAuthorityError {
  override readonly statusCode: number;
  constructor(code: string, statusCode = 400) { super(code); this.statusCode = statusCode; }
}
/** Validation delegates to the sole evaluation authority; it never computes a new delta. */
export function assertEvaluationPolicy(receipt: EvaluationReceipt) {
  if (!evaluationReceiptMatchesScorePolicy(receipt)) throw new EvaluationServiceError('evaluation_policy_delta_invalid');
  if (receipt.policy_version === canonicalEvaluationScorePolicy.version) {
    if (!receipt.evaluator || receipt.evaluator.verification !== 'internal' || receipt.evaluator.type !== 'internal' ||
        !['canonical-admin', 'evaluation-service'].includes(receipt.evaluator.id)) throw new EvaluationServiceError('evaluator_provenance_required');
  }
  if (receipt.policy_version === REVIEW_ATTESTED_EVALUATION_POLICY.version &&
      (!receipt.evaluator || receipt.evaluator.verification !== 'verified' || receipt.evaluator.type !== 'independent_reviewer' || !receipt.evaluator.signature_ref)) {
    throw new EvaluationServiceError('reviewer_attestation_required', 403);
  }
}

export function createEvaluationService(store: ReceiptAppendStore, threshold = 80, now = () => new Date(), reviewerTrust?: EvaluationReviewerTrust | null) {
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
    /** Only an operator-authenticated call plus a trusted reviewer signature can create a new verified Evaluation. */
    async acceptReviewed(raw: unknown, authenticatedPrincipal?: 'canonical-admin'): Promise<EvaluationReceipt> {
      if (hasAuthoredScore(raw)) throw new EvaluationServiceError('score_delta_authoring_forbidden');
      if (authenticatedPrincipal !== 'canonical-admin') throw new EvaluationServiceError('evaluator_provenance_required', 403);
      if (!reviewerTrust) throw new EvaluationServiceError('evaluation_reviewer_authority_unavailable', 503);
      const parsed = VerifiedEvaluationSubmissionSchema.safeParse(raw);
      if (!parsed.success) throw new EvaluationServiceError('invalid_evaluation_reviewer_attestation');
      const attestation = parsed.data.attestation;
      if (!reviewerTrust.verify(attestation)) throw new EvaluationServiceError('evaluation_reviewer_signature_invalid', 403);
      if (!store.appendEvaluationReviewerAttestation) throw new EvaluationServiceError('evaluation_attestation_store_unavailable', 503);
      const execution = await store.get('execution', attestation.execution_receipt_id) as ExecutionReceipt | null;
      if (!execution) throw new EvaluationServiceError('execution_not_found');
      await assertReceiptAuthority('execution', execution, store, threshold);
      const attestedAt = Date.parse(attestation.attested_at);
      if (attestedAt < Date.parse(execution.executed_at) || attestedAt > now().getTime()) throw new EvaluationServiceError('evaluation_reviewer_attestation_time_invalid');
      const evidenceRefs = [...attestation.evidence_refs].sort();
      const expectedEvidenceDigest = evaluationOutcomeEvidenceDigest({ execution_receipt_id: execution.execution_id,
        rubric_sha256: attestation.rubric_sha256, evidence_refs: evidenceRefs });
      if (expectedEvidenceDigest !== attestation.outcome_evidence_sha256) throw new EvaluationServiceError('evaluation_outcome_evidence_digest_invalid');
      if (!reviewerTrust.acceptsRubric(attestation.rubric_sha256)) throw new EvaluationServiceError('evaluation_rubric_not_authorized', 403);

      const attestationHash = evaluationAttestationDigest(attestation);
      const evaluation: EvaluationReceipt = {
        evaluation_id: 'evaluation_' + attestationHash.slice('sha256:'.length),
        execution_id: execution.execution_id,
        evaluated_at: attestation.attested_at,
        outcome: attestation.verdict,
        reasons: ['independently_reviewed_outcome'],
        evidence_refs: evidenceRefs,
        policy_version: REVIEW_ATTESTED_EVALUATION_POLICY.version,
        evaluator: { type: 'independent_reviewer', id: attestation.reviewer_id, verification: 'verified', signature_ref: attestationHash },
        outcome_labels: ['review-attested.v1'],
        score_delta: REVIEW_ATTESTED_EVALUATION_POLICY.scoreDeltaForOutcome(attestation.verdict),
        parent_hash: execution.receipt_hash,
        schema_version: CANONICAL_RECEIPT_SCHEMA_VERSION,
        receipt_hash: ''
      };
      const sealed = sealReceipt('evaluation', evaluation) as EvaluationReceipt;
      const priorForExecution = (await store.list('evaluation')).find((candidate) =>
        'evaluation_id' in candidate && candidate.execution_id === execution.execution_id) as EvaluationReceipt | undefined;
      if (priorForExecution) {
        if (priorForExecution.evaluator?.signature_ref === attestationHash) {
          await assertReceiptAuthority('evaluation', priorForExecution, store, threshold);
          return priorForExecution;
        }
        throw new EvaluationServiceError('execution_already_evaluated', 409);
      }
      try {
        await store.appendEvaluationReviewerAttestation(attestation);
        return await store.append('evaluation', sealed) as EvaluationReceipt;
      } catch (error) {
        if (error instanceof ReceiptAuthorityError) {
          const conflict = ['evaluation_reviewer_nonce_replayed', 'evaluation_reviewer_attestation_conflict',
            'execution_already_evaluated', 'receipt_id_conflict', 'receipt_unique_conflict'].includes(error.code);
          throw new EvaluationServiceError(error.code, conflict ? 409 : error.statusCode);
        }
        throw error;
      }
    },
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
