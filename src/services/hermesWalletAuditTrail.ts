import { hermesDeskGeneratedAt } from '../data/hermesDesk';
import {
  createHermesDecisionReceipt,
  recordHermesDecisionOutcome,
  type HermesDecisionFeedbackResult
} from './hermesDecisionFeedback';
import {
  previewHermesPolicyReconciliation,
  type HermesPolicyComplianceState,
  type HermesPolicyOutcomeState,
  type HermesPolicyReconciliationResult
} from './hermesPolicyReconciliation';
import { createHermesPolicyDecisionReceipt } from './hermesPolicyReceipt';
import {
  getHermesSpendPolicyExampleCheck,
  type HermesSpendPolicyCheckResult,
  type HermesSpendPolicyDecision
} from './hermesSpendPolicy';

export type HermesWalletAuditEventKind =
  | 'spend_intent'
  | 'pre_spend_decision'
  | 'decision_receipt'
  | 'policy_check'
  | 'policy_receipt'
  | 'wallet_outcome'
  | 'reconciliation'
  | 'feedback';

export type HermesWalletAuditEventState =
  | 'recorded'
  | 'allowed'
  | 'test_required'
  | 'manual_review_required'
  | 'blocked'
  | 'compliant'
  | 'partially_compliant'
  | 'non_compliant'
  | 'needs_review'
  | 'unknown';

export type HermesWalletAuditReference = {
  kind:
    | 'decision'
    | 'decision_receipt'
    | 'policy_check'
    | 'policy_receipt'
    | 'outcome'
    | 'reconciliation'
    | 'reputation'
    | 'receipt'
    | 'claim'
    | 'run';
  id: string;
  summary: string;
};

export type HermesWalletAuditEvent = {
  id: string;
  at: string;
  kind: HermesWalletAuditEventKind;
  state: HermesWalletAuditEventState;
  title: string;
  summary: string;
  actor: 'agent' | 'infopunks' | 'policy_engine' | 'wallet' | 'reconciliation_engine';
  source_id?: string;
  decision?: string;
  required_action?: string;
  compliance_state?: string;
  amount_usd?: number;
  chain?: string;
  payment_rail?: string;
  provider_id?: string;
  route_id?: string;
  service_id?: string;
  references: HermesWalletAuditReference[];
  metadata?: Record<string, unknown>;
};

export type HermesWalletAuditSignal = {
  id: string;
  label: string;
  value: string | number | boolean;
  summary: string;
};

export type HermesWalletAuditRiskPosture = {
  level: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  reasons: string[];
};

export type HermesWalletAuditTrail = {
  id: string;
  title: string;
  generated_at: string;
  thesis: string;
  source_check_id: string;
  source_decision_id: string;
  events: HermesWalletAuditEvent[];
  signals: HermesWalletAuditSignal[];
  risk_posture: HermesWalletAuditRiskPosture;
  summary: {
    event_count: number;
    recorded_count: number;
    allowed_count: number;
    blocked_count: number;
    compliant_count: number;
    non_compliant_count: number;
    needs_review_count: number;
    final_compliance_state?: string;
    final_feedback_direction?: string;
    next_policy_action?: string;
  };
};

export type HermesWalletAuditSummary = {
  generated_at: string;
  trail_count: number;
  trails: HermesWalletAuditTrail[];
};

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function decisionState(decision: HermesDecisionFeedbackResult['receipt']['decision']): HermesWalletAuditEventState {
  if (decision === 'proceed') return 'allowed';
  if (decision === 'proceed_with_caution' || decision === 'test_spend_first') return 'test_required';
  if (decision === 'do_not_spend') return 'blocked';
  return 'manual_review_required';
}

function policyState(decision: HermesSpendPolicyDecision): HermesWalletAuditEventState {
  if (decision === 'allow') return 'allowed';
  if (decision === 'allow_with_test_spend') return 'test_required';
  if (decision === 'require_manual_review') return 'manual_review_required';
  return 'blocked';
}

function walletOutcomeState(outcomeState: HermesPolicyOutcomeState): HermesWalletAuditEventState {
  if (outcomeState === 'spent' || outcomeState === 'test_spend_completed') return 'recorded';
  if (outcomeState === 'blocked_as_required' || outcomeState === 'manual_review_completed' || outcomeState === 'spend_attempt_blocked') return 'compliant';
  if (outcomeState === 'spent_despite_block') return 'non_compliant';
  if (outcomeState === 'manual_review_missing' || outcomeState === 'failed') return 'needs_review';
  return 'unknown';
}

function feedbackState(result: HermesPolicyReconciliationResult): HermesWalletAuditEventState {
  if (result.feedback.next_policy_action === 'block_provider') return 'blocked';
  if (result.feedback.next_policy_action === 'loosen_policy') return 'allowed';
  if (result.feedback.next_policy_action === 'require_manual_review') return 'manual_review_required';
  if (result.feedback.next_policy_action === 'request_more_evidence') return 'needs_review';
  if (result.impact.direction === 'watch') return 'needs_review';
  if (result.compliance_state === 'non_compliant') return 'non_compliant';
  if (result.compliance_state === 'partially_compliant') return 'partially_compliant';
  if (result.compliance_state === 'compliant') return 'compliant';
  return 'recorded';
}

function summaryReference(kind: HermesWalletAuditReference['kind'], id: string, summary: string): HermesWalletAuditReference {
  return { kind, id, summary };
}

function mapDecisionReferences(check: HermesSpendPolicyCheckResult): HermesWalletAuditReference[] {
  const references: HermesWalletAuditReference[] = [];

  for (const item of check.pre_spend_decision.reputation_inputs) {
    references.push(summaryReference('reputation', item.id, item.summary));
  }
  for (const item of check.pre_spend_decision.receipt_inputs) {
    references.push(summaryReference('receipt', item.id, item.summary));
  }
  for (const item of check.pre_spend_decision.claim_inputs) {
    references.push(summaryReference('claim', item.id, item.summary));
  }
  for (const item of check.pre_spend_decision.run_inputs) {
    references.push(summaryReference('run', item.id, item.summary));
  }

  return references;
}

function dedupeReferences(references: HermesWalletAuditReference[]): HermesWalletAuditReference[] {
  const seen = new Set<string>();
  const output: HermesWalletAuditReference[] = [];

  for (const reference of references) {
    const key = `${reference.kind}:${reference.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(reference);
  }

  return output;
}

function withSpendContext(event: HermesWalletAuditEvent, check: HermesSpendPolicyCheckResult): HermesWalletAuditEvent {
  return {
    ...event,
    amount_usd: check.input.amount_usd,
    chain: check.input.chain,
    payment_rail: check.input.payment_rail,
    provider_id: check.input.provider_id,
    route_id: check.input.route_id,
    service_id: check.input.service_id
  };
}

function eventId(trailId: string, index: number, kind: HermesWalletAuditEventKind): string {
  return `${trailId}_event_${index + 1}_${kind}`;
}

function buildRiskPosture(
  check: HermesSpendPolicyCheckResult,
  reconciliation: HermesPolicyReconciliationResult
): HermesWalletAuditRiskPosture {
  const reasons: string[] = [];
  const criticalFindings = reconciliation.findings.filter((item) => item.severity === 'critical');
  const highFindings = reconciliation.findings.filter((item) => item.severity === 'high');

  if (
    reconciliation.compliance_state === 'non_compliant'
    || (check.decision === 'block' && reconciliation.outcome.outcome_state === 'spent_despite_block')
  ) {
    reasons.push('Non-compliant reconciliation or spend despite block requires immediate wallet review.');
    return {
      level: 'critical',
      summary: 'Critical wallet safety posture: policy was bypassed or compliance failed.',
      reasons
    };
  }

  if (
    check.decision === 'require_manual_review'
    || reconciliation.outcome.outcome_state === 'failed'
    || criticalFindings.length > 0
    || highFindings.length > 0
  ) {
    reasons.push('Manual review, failed execution, or high-severity findings elevate the audit posture.');
    if (check.decision === 'require_manual_review') reasons.push('Policy required manual review before wallet execution.');
    if (reconciliation.outcome.outcome_state === 'failed') reasons.push('Observed wallet outcome failed and needs evidence review.');
    return {
      level: 'high',
      summary: 'High wallet safety posture: the trail contains elevated review pressure.',
      reasons
    };
  }

  if (
    check.decision === 'allow_with_test_spend'
    || reconciliation.impact.direction === 'watch'
    || reconciliation.compliance_state === 'partially_compliant'
    || check.warnings.length > 0
  ) {
    reasons.push('Watch-state feedback, warnings, or test-spend requirements keep the trail under active inspection.');
    return {
      level: 'medium',
      summary: 'Medium wallet safety posture: behavior is compliant but still worth watching.',
      reasons
    };
  }

  reasons.push('The deterministic trail stayed compliant without major findings.');
  return {
    level: 'low',
    summary: 'Low wallet safety posture: the wallet behavior matched policy intent.',
    reasons
  };
}

function buildSignals(
  check: HermesSpendPolicyCheckResult,
  policyReceiptId: string,
  reconciliation: HermesPolicyReconciliationResult,
  riskPosture: HermesWalletAuditRiskPosture
): HermesWalletAuditSignal[] {
  return [
    {
      id: 'spend_amount',
      label: 'Spend amount',
      value: check.input.amount_usd ?? 0,
      summary: 'Requested autonomous spend amount in USD.'
    },
    {
      id: 'chain',
      label: 'Chain',
      value: check.input.chain ?? 'unknown',
      summary: 'Deterministic chain context used for the wallet safety check.'
    },
    {
      id: 'payment_rail',
      label: 'Payment rail',
      value: check.input.payment_rail ?? 'unknown',
      summary: 'Payment rail evaluated by the pre-spend and policy layers.'
    },
    {
      id: 'pre_spend_decision',
      label: 'Pre-spend decision',
      value: check.pre_spend_decision.decision,
      summary: 'Recommendation produced before policy gating.'
    },
    {
      id: 'policy_decision',
      label: 'Policy decision',
      value: check.decision,
      summary: 'Wallet gate result produced by the spend policy layer.'
    },
    {
      id: 'policy_receipt_id',
      label: 'Policy receipt id',
      value: policyReceiptId,
      summary: 'Receipt handle for the policy decision evidence.'
    },
    {
      id: 'outcome_state',
      label: 'Outcome state',
      value: reconciliation.outcome.outcome_state,
      summary: 'Observed wallet outcome stitched into the audit trail.'
    },
    {
      id: 'compliance_state',
      label: 'Compliance state',
      value: reconciliation.compliance_state,
      summary: 'Reconciliation verdict comparing policy expectation to wallet behavior.'
    },
    {
      id: 'feedback_direction',
      label: 'Feedback direction',
      value: reconciliation.impact.direction,
      summary: 'Direction of the deterministic feedback signal for future wallet decisions.'
    },
    {
      id: 'next_policy_action',
      label: 'Next policy action',
      value: reconciliation.feedback.next_policy_action,
      summary: 'Next policy action suggested by reconciliation feedback.'
    },
    {
      id: 'risk_posture',
      label: 'Risk posture',
      value: riskPosture.level,
      summary: riskPosture.summary
    }
  ];
}

function countState(events: HermesWalletAuditEvent[], state: HermesWalletAuditEventState): number {
  return events.filter((event) => event.state === state).length;
}

function buildTrailFromCheck(check: HermesSpendPolicyCheckResult): HermesWalletAuditTrail {
  const trailId = `hermes_wallet_audit_trail_${slugify(check.id)}`;
  const decisionReceipt = createHermesDecisionReceipt(check.pre_spend_decision);
  const decisionFeedback = recordHermesDecisionOutcome(check.pre_spend_decision);
  const policyReceipt = createHermesPolicyDecisionReceipt(check);
  const reconciliation = previewHermesPolicyReconciliation(check);
  const baseReferences = mapDecisionReferences(check);
  const generatedAt = reconciliation.generated_at ?? check.generated_at ?? hermesDeskGeneratedAt;

  const events: HermesWalletAuditEvent[] = [
    withSpendContext({
      id: eventId(trailId, 0, 'spend_intent'),
      at: check.generated_at,
      kind: 'spend_intent',
      state: 'recorded',
      title: 'Spend Intent',
      summary: `Wallet requested ${typeof check.input.amount_usd === 'number' ? `$${check.input.amount_usd.toFixed(2)}` : 'an unspecified amount'} for ${check.input.route_id ?? 'an unspecified route'} on ${check.input.chain ?? 'an unspecified chain'} via ${check.input.payment_rail ?? 'an unspecified rail'}.`,
      actor: 'agent',
      source_id: check.id,
      references: dedupeReferences(baseReferences)
    }, check),
    withSpendContext({
      id: eventId(trailId, 1, 'pre_spend_decision'),
      at: check.pre_spend_decision.generated_at,
      kind: 'pre_spend_decision',
      state: decisionState(check.pre_spend_decision.decision),
      title: 'Pre-Spend Decision',
      summary: check.pre_spend_decision.reason,
      actor: 'infopunks',
      source_id: check.pre_spend_decision.id,
      decision: check.pre_spend_decision.decision,
      required_action: check.pre_spend_decision.required_action,
      references: dedupeReferences([
        summaryReference('decision', check.pre_spend_decision.id, 'Deterministic pre-spend decision seeded from the wallet spend intent.'),
        ...baseReferences
      ])
    }, check),
    withSpendContext({
      id: eventId(trailId, 2, 'decision_receipt'),
      at: decisionReceipt.receipt.created_at,
      kind: 'decision_receipt',
      state: 'recorded',
      title: 'Decision Receipt',
      summary: decisionReceipt.receipt.summary,
      actor: 'infopunks',
      source_id: decisionReceipt.receipt.id,
      decision: decisionReceipt.receipt.decision,
      required_action: decisionReceipt.receipt.required_action,
      references: dedupeReferences([
        summaryReference('decision', check.pre_spend_decision.id, 'Source decision preserved by the receipt conversion.'),
        summaryReference('decision_receipt', decisionReceipt.receipt.id, 'Receipt that preserves why the pre-spend recommendation was made.')
      ])
    }, check),
    withSpendContext({
      id: eventId(trailId, 3, 'policy_check'),
      at: check.generated_at,
      kind: 'policy_check',
      state: policyState(check.decision),
      title: 'Policy Check',
      summary: check.reason,
      actor: 'policy_engine',
      source_id: check.id,
      decision: check.decision,
      required_action: check.required_action,
      references: dedupeReferences([
        summaryReference('decision', check.pre_spend_decision.id, 'Pre-spend decision consumed by policy gating.'),
        summaryReference('policy_check', check.id, 'Deterministic policy check for the canonical spend intent.')
      ])
    }, check),
    withSpendContext({
      id: eventId(trailId, 4, 'policy_receipt'),
      at: policyReceipt.receipt.created_at,
      kind: 'policy_receipt',
      state: 'recorded',
      title: 'Policy Receipt',
      summary: policyReceipt.receipt.summary,
      actor: 'policy_engine',
      source_id: policyReceipt.receipt.id,
      decision: policyReceipt.receipt.policy_decision,
      required_action: policyReceipt.receipt.required_action,
      references: dedupeReferences([
        summaryReference('policy_check', check.id, 'Policy check converted into a receipt-shaped audit record.'),
        summaryReference('policy_receipt', policyReceipt.receipt.id, 'Receipt that preserves the wallet gate decision and rule context.')
      ])
    }, check),
    {
      id: eventId(trailId, 5, 'wallet_outcome'),
      at: reconciliation.outcome.created_at,
      kind: 'wallet_outcome',
      state: walletOutcomeState(reconciliation.outcome.outcome_state),
      title: 'Wallet Outcome',
      summary: reconciliation.outcome.outcome_summary,
      actor: 'wallet',
      source_id: reconciliation.outcome.id,
      compliance_state: reconciliation.compliance_state,
      amount_usd: reconciliation.outcome.amount_usd,
      chain: reconciliation.outcome.chain,
      payment_rail: reconciliation.outcome.payment_rail,
      provider_id: reconciliation.outcome.provider_id,
      route_id: reconciliation.outcome.route_id,
      service_id: reconciliation.outcome.service_id,
      metadata: {
        spend_happened: reconciliation.outcome.spend_happened,
        decision_feedback_outcome_state: decisionFeedback.outcome.outcome_state
      },
      references: dedupeReferences([
        summaryReference('policy_receipt', policyReceipt.receipt.id, 'Policy receipt that defined the expected wallet behavior.'),
        summaryReference('outcome', reconciliation.outcome.id, 'Observed wallet outcome generated for deterministic reconciliation.')
      ])
    },
    {
      id: eventId(trailId, 6, 'reconciliation'),
      at: reconciliation.generated_at,
      kind: 'reconciliation',
      state: reconciliation.compliance_state as HermesWalletAuditEventState,
      title: 'Reconciliation',
      summary: reconciliation.summary,
      actor: 'reconciliation_engine',
      source_id: reconciliation.check_id,
      decision: check.decision,
      compliance_state: reconciliation.compliance_state,
      amount_usd: reconciliation.outcome.amount_usd,
      chain: reconciliation.outcome.chain,
      payment_rail: reconciliation.outcome.payment_rail,
      provider_id: reconciliation.outcome.provider_id,
      route_id: reconciliation.outcome.route_id,
      service_id: reconciliation.outcome.service_id,
      metadata: {
        finding_count: reconciliation.findings.length,
        finding_labels: reconciliation.findings.map((finding) => finding.label)
      },
      references: dedupeReferences([
        summaryReference('policy_receipt', policyReceipt.receipt.id, 'Receipt compared against the observed wallet outcome.'),
        summaryReference('outcome', reconciliation.outcome.id, 'Wallet outcome used for compliance comparison.'),
        summaryReference('reconciliation', reconciliation.check_id, 'Deterministic reconciliation result for this wallet sequence.')
      ])
    },
    {
      id: eventId(trailId, 7, 'feedback'),
      at: reconciliation.generated_at,
      kind: 'feedback',
      state: feedbackState(reconciliation),
      title: 'Feedback',
      summary: `${reconciliation.impact.summary} Next policy action: ${reconciliation.feedback.next_policy_action}.`,
      actor: 'reconciliation_engine',
      source_id: `${reconciliation.check_id}_feedback`,
      decision: reconciliation.impact.direction,
      compliance_state: reconciliation.compliance_state,
      metadata: {
        feedback_status: reconciliation.feedback.status,
        feedback_direction: reconciliation.impact.direction,
        next_policy_action: reconciliation.feedback.next_policy_action
      },
      references: dedupeReferences([
        summaryReference('reconciliation', reconciliation.check_id, 'Reconciliation output that generated the feedback direction.'),
        summaryReference('policy_receipt', policyReceipt.receipt.id, 'Policy receipt retained as the feedback anchor.')
      ])
    }
  ];

  const riskPosture = buildRiskPosture(check, reconciliation);
  const signals = buildSignals(check, policyReceipt.receipt.id, reconciliation, riskPosture);

  return {
    id: trailId,
    title: 'Autonomous Wallet Audit Trail',
    generated_at: generatedAt,
    thesis: 'Autonomous wallets need more than logs. They need audit trails with judgment.',
    source_check_id: check.id,
    source_decision_id: check.pre_spend_decision.id,
    events,
    signals,
    risk_posture: riskPosture,
    summary: {
      event_count: events.length,
      recorded_count: countState(events, 'recorded'),
      allowed_count: countState(events, 'allowed'),
      blocked_count: countState(events, 'blocked'),
      compliant_count: countState(events, 'compliant'),
      non_compliant_count: countState(events, 'non_compliant'),
      needs_review_count: countState(events, 'needs_review'),
      final_compliance_state: reconciliation.compliance_state,
      final_feedback_direction: reconciliation.impact.direction,
      next_policy_action: reconciliation.feedback.next_policy_action
    }
  };
}

export function buildHermesWalletAuditTrail(): HermesWalletAuditTrail {
  return buildTrailFromCheck(getHermesSpendPolicyExampleCheck());
}

export function buildHermesWalletAuditTrailSummary(): HermesWalletAuditSummary {
  const trail = buildHermesWalletAuditTrail();
  return {
    generated_at: trail.generated_at,
    trail_count: 1,
    trails: [trail]
  };
}

export function resolveHermesWalletAuditTrailById(trailId: string): HermesWalletAuditTrail | undefined {
  const trail = buildHermesWalletAuditTrail();
  return trail.id === trailId ? trail : undefined;
}

export function isHermesWalletAuditComplianceState(value: string | undefined): value is HermesPolicyComplianceState {
  return value === 'compliant'
    || value === 'partially_compliant'
    || value === 'non_compliant'
    || value === 'needs_review'
    || value === 'unknown';
}
