import type { EvaluationReceipt } from '../schemas/receipts';

export interface ScorePolicy {
  readonly version: string;
  scoreDeltaForOutcome(outcome: EvaluationReceipt['outcome']): number;
}
/** V1 weights are application policy, not universal economic truth. */
export const SCORE_POLICY_V1: ScorePolicy = Object.freeze({
  version: 'score-policy.v1',
  scoreDeltaForOutcome(outcome: EvaluationReceipt['outcome']) {
    return { confirmed: 5, weakened: -2, contradicted: -15 }[outcome];
  }
});
export const EVALUATION_POLICY_VERSION = SCORE_POLICY_V1.version;
export const canonicalEvaluationScorePolicy = SCORE_POLICY_V1;
/** Replay only: preserve receipts issued before Phase 4 without rewriting history. */
const historicalPolicy: ScorePolicy = {
  version: 'receipt-authority.v1',
  scoreDeltaForOutcome: outcome => ({ confirmed: 5, weakened: -2, contradicted: -5 }[outcome])
};
export function evaluationReceiptMatchesScorePolicy(receipt: EvaluationReceipt) {
  const policy = receipt.policy_version === SCORE_POLICY_V1.version ? SCORE_POLICY_V1 : historicalPolicy;
  return receipt.policy_version === policy.version && receipt.score_delta === policy.scoreDeltaForOutcome(receipt.outcome);
}
