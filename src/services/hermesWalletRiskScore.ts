import { hermesDeskGeneratedAt } from '../data/hermesDesk';
import {
  buildHermesWalletAuditTrail,
  buildHermesWalletAuditTrailSummary,
  resolveHermesWalletAuditTrailById,
  type HermesWalletAuditTrail
} from './hermesWalletAuditTrail';

export type HermesWalletSafetyRating =
  | 'safe'
  | 'watch'
  | 'risky'
  | 'blocked'
  | 'unknown';

export type HermesWalletRequiredNextAction =
  | 'none'
  | 'run_test_spend'
  | 'manual_review_required'
  | 'tighten_policy'
  | 'block_provider'
  | 'request_more_evidence'
  | 'pause_wallet';

export type HermesWalletRiskFactor = {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  detail: string;
  source:
    | 'audit_trail'
    | 'policy'
    | 'reconciliation'
    | 'pre_spend_decision'
    | 'reputation'
    | 'outcome'
    | 'unknown';
};

export type HermesWalletPositiveControl = {
  id: string;
  label: string;
  detail: string;
  source:
    | 'audit_trail'
    | 'policy'
    | 'reconciliation'
    | 'pre_spend_decision'
    | 'reputation'
    | 'outcome';
};

export type HermesWalletRiskScoreInput = {
  trail_id?: string;
};

export type HermesWalletRiskScore = {
  id: string;
  source_trail_id: string;
  generated_at: string;
  risk_score: number;
  safety_rating: HermesWalletSafetyRating;
  required_next_action: HermesWalletRequiredNextAction;
  summary: string;
  top_risks: HermesWalletRiskFactor[];
  positive_controls: HermesWalletPositiveControl[];
  score_breakdown: {
    base_score: number;
    audit_posture_adjustment: number;
    compliance_adjustment: number;
    policy_adjustment: number;
    outcome_adjustment: number;
    feedback_adjustment: number;
    evidence_adjustment: number;
    final_score: number;
  };
  inputs: {
    trail_id: string;
    event_count: number;
    risk_posture_level?: string;
    policy_decision?: string;
    compliance_state?: string;
    next_policy_action?: string;
    feedback_direction?: string;
  };
};

export type HermesWalletRiskScoreSummary = {
  generated_at: string;
  score_count: number;
  scores: HermesWalletRiskScore[];
};

const REQUIRED_EVENT_KINDS = [
  'spend_intent',
  'pre_spend_decision',
  'decision_receipt',
  'policy_check',
  'policy_receipt',
  'wallet_outcome',
  'reconciliation',
  'feedback'
] as const;

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityWeight(severity: HermesWalletRiskFactor['severity']): number {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function uniqueReferences(trail: HermesWalletAuditTrail | null): Set<string> {
  return new Set((trail?.events ?? []).flatMap((event) => event.references.map((reference) => `${reference.kind}:${reference.id}`)));
}

function signalValue(trail: HermesWalletAuditTrail | null, id: string): string | number | boolean | undefined {
  return trail?.signals.find((signal) => signal.id === id)?.value;
}

function eventByKind(trail: HermesWalletAuditTrail | null, kind: typeof REQUIRED_EVENT_KINDS[number]) {
  return trail?.events.find((event) => event.kind === kind);
}

function hasRequiredEvents(trail: HermesWalletAuditTrail | null): boolean {
  return REQUIRED_EVENT_KINDS.every((kind) => trail?.events.some((event) => event.kind === kind));
}

function evidenceAdjustment(trail: HermesWalletAuditTrail | null): number {
  if (!trail) return -10;

  const references = uniqueReferences(trail);
  const hasCoreReferences = ['decision_receipt', 'policy_receipt', 'reconciliation'].every((kind) =>
    trail.events.some((event) => event.references.some((reference) => reference.kind === kind))
  );

  if (hasRequiredEvents(trail) && trail.events.length === REQUIRED_EVENT_KINDS.length && references.size >= 8 && hasCoreReferences) {
    return 5;
  }
  if (trail.events.length < REQUIRED_EVENT_KINDS.length || references.size < 5 || !hasCoreReferences) {
    return -10;
  }
  return -5;
}

function riskPostureAdjustment(level: string | undefined): number {
  if (level === 'low') return 25;
  if (level === 'medium') return 5;
  if (level === 'high') return -20;
  if (level === 'critical') return -45;
  return -10;
}

function complianceAdjustment(state: string | undefined): number {
  if (state === 'compliant') return 20;
  if (state === 'partially_compliant') return -5;
  if (state === 'needs_review') return -15;
  if (state === 'non_compliant') return -40;
  return -10;
}

function policyAdjustment(decision: string | undefined): number {
  if (decision === 'allow') return 10;
  if (decision === 'allow_with_test_spend') return 2;
  if (decision === 'require_manual_review') return -10;
  if (decision === 'block') return -25;
  return 0;
}

function outcomeAdjustment(outcomeState: string | undefined, complianceState: string | undefined): number {
  if ((outcomeState === 'spent' || outcomeState === 'test_spend_completed') && complianceState === 'compliant') return 10;
  if (outcomeState === 'blocked_as_required') return 15;
  if (outcomeState === 'manual_review_completed') return 10;
  if (outcomeState === 'manual_review_missing') return -25;
  if (outcomeState === 'spent_despite_block') return -50;
  if (outcomeState === 'failed') return -25;
  return -10;
}

function feedbackAdjustment(nextPolicyAction: string | undefined): number {
  if (nextPolicyAction === 'none') return 5;
  if (nextPolicyAction === 'request_more_evidence') return -5;
  if (nextPolicyAction === 'require_manual_review') return -10;
  if (nextPolicyAction === 'tighten_policy') return -15;
  if (nextPolicyAction === 'block_provider') return -30;
  return 0;
}

function safetyRating(score: number, trail: HermesWalletAuditTrail | null): HermesWalletSafetyRating {
  if (!trail) return 'unknown';
  if (score >= 80) return 'safe';
  if (score >= 55) return 'watch';
  if (score >= 30) return 'risky';
  return 'blocked';
}

function positiveControl(id: string, label: string, detail: string, source: HermesWalletPositiveControl['source']): HermesWalletPositiveControl {
  return { id, label, detail, source };
}

function riskFactor(
  id: string,
  severity: HermesWalletRiskFactor['severity'],
  label: string,
  detail: string,
  source: HermesWalletRiskFactor['source']
): HermesWalletRiskFactor {
  return { id, severity, label, detail, source };
}

function topRisks(
  trail: HermesWalletAuditTrail | null,
  policyDecision: string | undefined,
  complianceState: string | undefined,
  nextPolicyAction: string | undefined,
  outcomeState: string | undefined
): HermesWalletRiskFactor[] {
  if (!trail) {
    return [riskFactor(
      'wallet_risk_missing_trail',
      'medium',
      'Audit trail missing',
      'No deterministic wallet audit trail was available for scoring.',
      'unknown'
    )];
  }

  const risks: HermesWalletRiskFactor[] = [];
  const references = uniqueReferences(trail);
  const preSpendDecision = eventByKind(trail, 'pre_spend_decision')?.decision;

  if (trail.risk_posture.level === 'critical' || trail.risk_posture.level === 'high') {
    risks.push(riskFactor(
      `wallet_risk_posture_${trail.risk_posture.level}`,
      trail.risk_posture.level === 'critical' ? 'critical' : 'high',
      'Elevated audit posture',
      trail.risk_posture.summary,
      'audit_trail'
    ));
  }
  if (complianceState === 'non_compliant') {
    risks.push(riskFactor(
      'wallet_risk_non_compliant',
      'critical',
      'Non-compliant reconciliation',
      'Reconciliation determined that wallet behavior did not obey policy.',
      'reconciliation'
    ));
  }
  if (complianceState === 'needs_review') {
    risks.push(riskFactor(
      'wallet_risk_needs_review',
      'high',
      'Compliance needs review',
      'Wallet behavior needs additional review before the next action.',
      'reconciliation'
    ));
  }
  if (policyDecision === 'block') {
    risks.push(riskFactor(
      'wallet_risk_policy_block',
      'high',
      'Policy blocked the spend',
      'The wallet safety gate returned a block decision for the canonical spend intent.',
      'policy'
    ));
  }
  if (outcomeState === 'manual_review_missing') {
    risks.push(riskFactor(
      'wallet_risk_manual_review_missing',
      'high',
      'Manual review missing',
      'Manual review was required but no review evidence was present in the wallet outcome.',
      'outcome'
    ));
  }
  if (outcomeState === 'spent_despite_block') {
    risks.push(riskFactor(
      'wallet_risk_spent_despite_block',
      'critical',
      'Spent despite block',
      'The wallet spent even though policy required the spend to stay blocked.',
      'outcome'
    ));
  }
  if (outcomeState === 'failed') {
    risks.push(riskFactor(
      'wallet_risk_failed_outcome',
      'high',
      'Wallet outcome failed',
      'The wallet outcome failed and requires evidence review before another spend.',
      'outcome'
    ));
  }
  if (preSpendDecision === 'insufficient_evidence') {
    risks.push(riskFactor(
      'wallet_risk_insufficient_evidence',
      'medium',
      'Insufficient evidence',
      'The pre-spend decision engine did not have enough evidence for a confident recommendation.',
      'pre_spend_decision'
    ));
  }
  if (!hasRequiredEvents(trail) || references.size < 8) {
    risks.push(riskFactor(
      'wallet_risk_missing_references',
      'medium',
      'Evidence completeness gap',
      'The audit trail is missing required events or enough references for strong wallet scoring.',
      'audit_trail'
    ));
  }
  if (nextPolicyAction === 'tighten_policy' || nextPolicyAction === 'block_provider' || nextPolicyAction === 'request_more_evidence') {
    risks.push(riskFactor(
      `wallet_risk_next_action_${nextPolicyAction}`,
      nextPolicyAction === 'block_provider' ? 'critical' : nextPolicyAction === 'tighten_policy' ? 'high' : 'medium',
      'Feedback requires follow-up',
      `The reconciliation feedback recommended ${nextPolicyAction} before the next wallet action.`,
      'reconciliation'
    ));
  }

  return risks
    .sort((left, right) => {
      const severityDelta = severityWeight(right.severity) - severityWeight(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return left.id.localeCompare(right.id);
    })
    .slice(0, 4);
}

function positiveControls(
  trail: HermesWalletAuditTrail | null,
  policyDecision: string | undefined,
  complianceState: string | undefined,
  outcomeState: string | undefined
): HermesWalletPositiveControl[] {
  if (!trail) return [];

  const controls: HermesWalletPositiveControl[] = [];
  const references = uniqueReferences(trail);

  if (hasRequiredEvents(trail) && trail.events.length === REQUIRED_EVENT_KINDS.length) {
    controls.push(positiveControl(
      'wallet_control_complete_audit_trail',
      'Complete audit trail',
      'All eight deterministic wallet safety events were present in order.',
      'audit_trail'
    ));
  }
  if (eventByKind(trail, 'decision_receipt')) {
    controls.push(positiveControl(
      'wallet_control_decision_receipt',
      'Decision receipt exists',
      'The pre-spend recommendation was preserved as receipt-shaped evidence.',
      'pre_spend_decision'
    ));
  }
  if (eventByKind(trail, 'policy_receipt')) {
    controls.push(positiveControl(
      'wallet_control_policy_receipt',
      'Policy receipt exists',
      'The policy gate decision was preserved as wallet evidence.',
      'policy'
    ));
  }
  if (eventByKind(trail, 'reconciliation')) {
    controls.push(positiveControl(
      'wallet_control_reconciliation',
      'Reconciliation exists',
      'The audit trail compared expected policy behavior with observed wallet behavior.',
      'reconciliation'
    ));
  }
  if (complianceState === 'compliant') {
    controls.push(positiveControl(
      'wallet_control_compliant_outcome',
      'Compliant outcome',
      'The reconciliation reported compliant wallet behavior.',
      'outcome'
    ));
  }
  if (policyDecision === 'block' && outcomeState === 'blocked_as_required') {
    controls.push(positiveControl(
      'wallet_control_block_respected',
      'Blocked as required',
      'The wallet respected the block decision instead of forcing execution.',
      'reconciliation'
    ));
  }
  if (policyDecision === 'allow_with_test_spend' && outcomeState === 'test_spend_completed') {
    controls.push(positiveControl(
      'wallet_control_test_spend_completed',
      'Test spend completed',
      'The wallet completed the required test spend before broader execution.',
      'outcome'
    ));
  }
  if (references.size > 0 && trail.events.some((event) => event.references.some((reference) => reference.kind === 'policy_receipt'))) {
    controls.push(positiveControl(
      'wallet_control_policy_references',
      'Policy references preserved',
      'Policy receipt references remained attached to the audit chain.',
      'policy'
    ));
  }

  return controls;
}

function requiredNextAction(
  rating: HermesWalletSafetyRating,
  risks: HermesWalletRiskFactor[]
): HermesWalletRequiredNextAction {
  if (rating === 'safe') return 'none';
  if (rating === 'unknown') return 'request_more_evidence';
  if (rating === 'watch') {
    return risks.some((risk) => risk.id.includes('evidence') || risk.id.includes('missing_references'))
      ? 'request_more_evidence'
      : 'run_test_spend';
  }
  if (rating === 'risky') {
    return risks.some((risk) => risk.id.includes('policy_block') || risk.id.includes('next_action_tighten_policy'))
      ? 'tighten_policy'
      : 'manual_review_required';
  }
  return risks.some((risk) => risk.id.includes('block_provider') || risk.id.includes('spent_despite_block'))
    ? 'block_provider'
    : 'pause_wallet';
}

function summaryText(
  rating: HermesWalletSafetyRating,
  score: number,
  action: HermesWalletRequiredNextAction,
  topRisk: HermesWalletRiskFactor | undefined
): string {
  if (rating === 'unknown') {
    return `Wallet risk score is unknown at ${score}/100 because the audit trail could not be resolved. Next action: ${action}.`;
  }
  return `Wallet safety rating is ${rating} at ${score}/100. ${topRisk ? `Top risk: ${topRisk.label}. ` : ''}Next action: ${action}.`;
}

function resolveTrail(input?: HermesWalletRiskScoreInput): HermesWalletAuditTrail | null {
  if (input?.trail_id) return resolveHermesWalletAuditTrailById(input.trail_id) ?? null;
  return buildHermesWalletAuditTrail();
}

function scoreId(trailId: string): string {
  return `hermes_wallet_risk_score_${slugify(trailId)}`;
}

function buildUnknownScore(input?: HermesWalletRiskScoreInput): HermesWalletRiskScore {
  const trailId = input?.trail_id?.trim() || 'unknown_wallet_audit_trail';
  const baseScore = 50;
  const auditAdjustment = -10;
  const compliance = -10;
  const outcome = -10;
  const evidence = -10;
  const feedback = -5;
  const finalScore = clampScore(baseScore + auditAdjustment + compliance + outcome + feedback + evidence);
  const rating = safetyRating(finalScore, null);
  const risks = topRisks(null, undefined, undefined, undefined, undefined);
  const action = requiredNextAction(rating, risks);

  return {
    id: scoreId(trailId),
    source_trail_id: trailId,
    generated_at: hermesDeskGeneratedAt,
    risk_score: finalScore,
    safety_rating: rating,
    required_next_action: action,
    summary: summaryText(rating, finalScore, action, risks[0]),
    top_risks: risks,
    positive_controls: [],
    score_breakdown: {
      base_score: baseScore,
      audit_posture_adjustment: auditAdjustment,
      compliance_adjustment: compliance,
      policy_adjustment: 0,
      outcome_adjustment: outcome,
      feedback_adjustment: feedback,
      evidence_adjustment: evidence,
      final_score: finalScore
    },
    inputs: {
      trail_id: trailId,
      event_count: 0,
      risk_posture_level: 'unknown',
      compliance_state: 'unknown'
    }
  };
}

export function buildHermesWalletRiskScore(input?: HermesWalletRiskScoreInput): HermesWalletRiskScore {
  const trail = resolveTrail(input);
  if (!trail) return buildUnknownScore(input);

  const policyDecision = eventByKind(trail, 'policy_check')?.decision;
  const complianceState = trail.summary.final_compliance_state;
  const nextPolicyAction = trail.summary.next_policy_action;
  const feedbackDirection = trail.summary.final_feedback_direction;
  const outcomeState = String(signalValue(trail, 'outcome_state') ?? 'unknown');
  const baseScore = 50;
  const auditPosture = riskPostureAdjustment(trail.risk_posture.level);
  const compliance = complianceAdjustment(complianceState);
  const policy = policyAdjustment(policyDecision);
  const outcome = outcomeAdjustment(outcomeState, complianceState);
  const feedback = feedbackAdjustment(nextPolicyAction);
  const evidence = evidenceAdjustment(trail);
  const finalScore = clampScore(baseScore + auditPosture + compliance + policy + outcome + feedback + evidence);
  const rating = safetyRating(finalScore, trail);
  const risks = topRisks(trail, policyDecision, complianceState, nextPolicyAction, outcomeState);
  const controls = positiveControls(trail, policyDecision, complianceState, outcomeState);
  const action = requiredNextAction(rating, risks);

  return {
    id: scoreId(trail.id),
    source_trail_id: trail.id,
    generated_at: trail.generated_at,
    risk_score: finalScore,
    safety_rating: rating,
    required_next_action: action,
    summary: summaryText(rating, finalScore, action, risks[0]),
    top_risks: risks,
    positive_controls: controls,
    score_breakdown: {
      base_score: baseScore,
      audit_posture_adjustment: auditPosture,
      compliance_adjustment: compliance,
      policy_adjustment: policy,
      outcome_adjustment: outcome,
      feedback_adjustment: feedback,
      evidence_adjustment: evidence,
      final_score: finalScore
    },
    inputs: {
      trail_id: trail.id,
      event_count: trail.events.length,
      risk_posture_level: trail.risk_posture.level,
      policy_decision: policyDecision,
      compliance_state: complianceState,
      next_policy_action: nextPolicyAction,
      feedback_direction: feedbackDirection
    }
  };
}

export function buildHermesWalletRiskScoreSummary(): HermesWalletRiskScoreSummary {
  const scores = buildHermesWalletAuditTrailSummary().trails.map((trail) => buildHermesWalletRiskScore({ trail_id: trail.id }));
  return {
    generated_at: scores[0]?.generated_at ?? hermesDeskGeneratedAt,
    score_count: scores.length,
    scores
  };
}

export function resolveHermesWalletRiskScoreById(scoreIdValue: string): HermesWalletRiskScore | undefined {
  const score = buildHermesWalletRiskScore();
  return score.id === scoreIdValue ? score : undefined;
}
