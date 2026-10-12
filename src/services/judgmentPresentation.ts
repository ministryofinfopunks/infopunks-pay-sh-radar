import type { CanonicalJudgmentResponse } from '../schemas/preSpend';
export function judgmentPresentation(result: CanonicalJudgmentResponse) {
  const next = { insufficient_evidence: 'collect_evidence', do_not_spend: 'choose_another_route', test_spend_first: 'review_bounded_test', proceed: 'inspect_receipt' } as const;
  return { version: 'judgment-presentation.v1', authoritative: false,
    summary: result.decision === 'insufficient_evidence' ? 'Evidence is insufficient to approve this spend.' : `Radar decided: ${result.decision.replaceAll('_', ' ')}.`,
    next_action: result.payment_required && !result.receipt ? 'authorize_judgment_payment' : next[result.decision],
    blocking_reasons: result.decision === 'proceed' ? [] : result.reasons,
    payment_required: result.payment_required, execution_occurred: false, outcome_verified: false };
}
