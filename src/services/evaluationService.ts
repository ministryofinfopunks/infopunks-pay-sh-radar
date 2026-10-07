import { CANONICAL_RECEIPT_SCHEMA_VERSION, type EvaluationReceipt, type ExecutionReceipt } from '../schemas/receipts';
import { sealReceipt } from './receiptIntegrityService';
import { assertReceiptAuthority, ReceiptAuthorityError, type ReceiptAppendStore } from './receiptAuthorityService';
import { canonicalEvaluationScorePolicy, type ScorePolicy } from './evaluationScorePolicy';

export type EvaluationInput = Omit<EvaluationReceipt, 'schema_version' | 'policy_version' | 'score_delta' | 'parent_hash' | 'receipt_hash'>;

export class EvaluationServiceError extends ReceiptAuthorityError {}

export function createEvaluationService(store: ReceiptAppendStore, threshold = 80, scorePolicy: ScorePolicy = canonicalEvaluationScorePolicy) {
  return {
    async createEvaluation(input: EvaluationInput): Promise<EvaluationReceipt> {
      const parent = await store.get('execution', input.execution_id) as ExecutionReceipt | null;
      if (!parent) throw new EvaluationServiceError('execution_not_found');
      await assertReceiptAuthority('execution', parent, store, threshold);
      const receipt = sealReceipt('evaluation', {
        ...input,
        schema_version: CANONICAL_RECEIPT_SCHEMA_VERSION,
        policy_version: scorePolicy.version,
        score_delta: scorePolicy.scoreDeltaForOutcome(input.outcome),
        parent_hash: parent.receipt_hash
      });
      return store.append('evaluation', receipt) as Promise<EvaluationReceipt>;
    }
  };
}
