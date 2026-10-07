import type { EvaluationReceipt } from '../schemas/receipts';

export const EVALUATION_POLICY_VERSION = 'receipt-authority.v1';

export interface ScorePolicy {
  readonly version: string;
  scoreDeltaForOutcome(outcome: EvaluationReceipt['outcome']): number;
}

export const canonicalEvaluationScorePolicy: ScorePolicy = {
  version: EVALUATION_POLICY_VERSION,
  scoreDeltaForOutcome(outcome) {
    if (outcome === 'confirmed') return 5;
    if (outcome === 'weakened') return -2;
    return -5;
  }
};

export function evaluationReceiptMatchesScorePolicy(receipt: EvaluationReceipt, policy: ScorePolicy = canonicalEvaluationScorePolicy) {
  return receipt.policy_version === policy.version && receipt.score_delta === policy.scoreDeltaForOutcome(receipt.outcome);
}
