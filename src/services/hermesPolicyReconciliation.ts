import { hermesDeskGeneratedAt } from '../data/hermesDesk';
import { createHermesPolicyDecisionReceipt } from './hermesPolicyReceipt';
import type { HermesSpendPolicyCheckResult, HermesSpendPolicyDecision } from './hermesSpendPolicy';

export type HermesPolicyOutcomeState =
  | 'spent'
  | 'test_spend_completed'
  | 'blocked_as_required'
  | 'manual_review_completed'
  | 'manual_review_missing'
  | 'spend_attempt_blocked'
  | 'spent_despite_block'
  | 'failed'
  | 'unknown';

export type HermesPolicyComplianceState =
  | 'compliant'
  | 'partially_compliant'
  | 'non_compliant'
  | 'needs_review'
  | 'unknown';

export type HermesPolicyOutcome = {
  id: string;
  source_check_id: string;
  source_policy_receipt_id: string;
  outcome_state: HermesPolicyOutcomeState;
  outcome_summary: string;
  spend_happened: boolean;
  amount_usd?: number;
  chain?: string;
  payment_rail?: string;
  provider_id?: string;
  route_id?: string;
  service_id?: string;
  observed_latency_ms?: number;
  error_code?: string;
  evidence_artifacts: Array<{
    id: string;
    label: string;
    kind: 'url' | 'api_response' | 'log' | 'screenshot' | 'note' | 'receipt';
    uri: string;
    summary: string;
  }>;
  created_at: string;
};

export type HermesPolicyReconciliationFinding = {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  detail: string;
  expected: string;
  observed: string;
};

export type HermesPolicyReconciliationImpact = {
  target_type: 'provider' | 'route' | 'service' | 'policy' | 'unknown';
  target_id?: string;
  direction: 'positive' | 'negative' | 'neutral' | 'watch';
  magnitude: number;
  summary: string;
  reputation_notes: string[];
};

export type HermesPolicyReconciliationFeedback = {
  status: 'recorded' | 'preview' | 'failed';
  notes: string[];
  next_policy_action:
    | 'none'
    | 'tighten_policy'
    | 'loosen_policy'
    | 'require_manual_review'
    | 'block_provider'
    | 'request_more_evidence';
};

export type HermesPolicyReconciliationResult = {
  check_id: string;
  policy_receipt_id: string;
  outcome: HermesPolicyOutcome;
  compliance_state: HermesPolicyComplianceState;
  findings: HermesPolicyReconciliationFinding[];
  feedback: HermesPolicyReconciliationFeedback;
  impact: HermesPolicyReconciliationImpact;
  summary: string;
  generated_at: string;
};

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Number(value.toFixed(2));
}

function normalizeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.trunc(value));
}

function clampUnit(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function slugifyId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function isOutcomeState(value: unknown): value is HermesPolicyOutcomeState {
  return value === 'spent'
    || value === 'test_spend_completed'
    || value === 'blocked_as_required'
    || value === 'manual_review_completed'
    || value === 'manual_review_missing'
    || value === 'spend_attempt_blocked'
    || value === 'spent_despite_block'
    || value === 'failed'
    || value === 'unknown';
}

function defaultOutcomeState(decision: HermesSpendPolicyDecision): HermesPolicyOutcomeState {
  if (decision === 'allow') return 'spent';
  if (decision === 'allow_with_test_spend') return 'test_spend_completed';
  if (decision === 'require_manual_review') return 'manual_review_completed';
  return 'blocked_as_required';
}

function defaultSpendHappenedForState(state: HermesPolicyOutcomeState): boolean {
  if (state === 'spent' || state === 'test_spend_completed' || state === 'spent_despite_block') return true;
  return false;
}

function canSafelyOverrideSpendHappened(state: HermesPolicyOutcomeState, value: boolean): boolean {
  if (state === 'spent' || state === 'test_spend_completed' || state === 'spent_despite_block') return value === true;
  if (state === 'blocked_as_required' || state === 'spend_attempt_blocked' || state === 'manual_review_missing' || state === 'unknown') return value === false;
  return true;
}

function intendedTestAmountUsd(check: HermesSpendPolicyCheckResult): number | undefined {
  const amount = normalizeNumber(check.input.amount_usd);
  if (typeof amount !== 'number') return undefined;
  return Number(Math.min(amount, 25).toFixed(2));
}

function normalizeArtifacts(
  check: HermesSpendPolicyCheckResult,
  artifacts: HermesPolicyOutcome['evidence_artifacts'] | Array<Partial<HermesPolicyOutcome['evidence_artifacts'][number]>> | undefined
): HermesPolicyOutcome['evidence_artifacts'] {
  if (Array.isArray(artifacts) && artifacts.length > 0) {
    return artifacts.map((artifact, index) => ({
      id: normalizeString(artifact.id) ?? `artifact_${slugifyId(check.id)}_${index + 1}`,
      label: normalizeString(artifact.label) ?? `Outcome artifact ${index + 1}`,
      kind: artifact.kind ?? 'note',
      uri: normalizeString(artifact.uri) ?? `/v1/hermes/spend-policy/check/${encodeURIComponent(check.id)}/outcome`,
      summary: normalizeString(artifact.summary) ?? 'Observed wallet outcome artifact.'
    }));
  }

  return [{
    id: `artifact_${slugifyId(check.id)}_policy_reconciliation_note`,
    label: 'Mock reconciliation note',
    kind: 'note',
    uri: `/v1/hermes/spend-policy/check/${encodeURIComponent(check.id)}/outcome`,
    summary: 'Deterministic mock outcome artifact generated because no external wallet evidence artifact was supplied.'
  }];
}

function defaultOutcomeSummary(decision: HermesSpendPolicyDecision, outcomeState: HermesPolicyOutcomeState): string {
  if (outcomeState === 'spent') return `Wallet spent within the ${decision} policy result.`;
  if (outcomeState === 'test_spend_completed') return 'Wallet completed the required test spend and provider returned the expected result.';
  if (outcomeState === 'blocked_as_required') return 'Wallet stayed blocked after policy denied autonomous spend.';
  if (outcomeState === 'manual_review_completed') return 'Manual review completed before wallet execution continued.';
  if (outcomeState === 'manual_review_missing') return 'Manual review was required but no review evidence was observed.';
  if (outcomeState === 'spend_attempt_blocked') return 'Wallet attempted execution but the policy gate blocked the spend.';
  if (outcomeState === 'spent_despite_block') return 'Wallet spent even though the policy gate required a block.';
  if (outcomeState === 'failed') return 'Wallet outcome failed and requires deterministic review before feedback changes future spend.';
  return `Wallet outcome for policy decision ${decision} remains unknown.`;
}

function buildOutcome(
  check: HermesSpendPolicyCheckResult,
  requested: Partial<HermesPolicyOutcome> | undefined
): HermesPolicyOutcome {
  const receipt = createHermesPolicyDecisionReceipt(check).receipt;
  const outcomeState = isOutcomeState(requested?.outcome_state)
    ? requested.outcome_state
    : defaultOutcomeState(check.decision);
  const defaultSpendHappened = defaultSpendHappenedForState(outcomeState);
  const requestedSpendHappened = typeof requested?.spend_happened === 'boolean' ? requested.spend_happened : undefined;
  const spendHappened = typeof requestedSpendHappened === 'boolean' && canSafelyOverrideSpendHappened(outcomeState, requestedSpendHappened)
    ? requestedSpendHappened
    : defaultSpendHappened;

  return {
    id: normalizeString(requested?.id) ?? `policy_outcome_${slugifyId(check.id)}`,
    source_check_id: check.id,
    source_policy_receipt_id: receipt.id,
    outcome_state: outcomeState,
    outcome_summary: normalizeString(requested?.outcome_summary) ?? defaultOutcomeSummary(check.decision, outcomeState),
    spend_happened: spendHappened,
    amount_usd: normalizeNumber(requested?.amount_usd) ?? normalizeNumber(check.input.amount_usd),
    chain: normalizeString(requested?.chain) ?? check.input.chain,
    payment_rail: normalizeString(requested?.payment_rail) ?? check.input.payment_rail,
    provider_id: normalizeString(requested?.provider_id) ?? check.input.provider_id,
    route_id: normalizeString(requested?.route_id) ?? check.input.route_id,
    service_id: normalizeString(requested?.service_id) ?? check.input.service_id,
    observed_latency_ms: normalizeInteger(requested?.observed_latency_ms),
    error_code: normalizeString(requested?.error_code),
    evidence_artifacts: normalizeArtifacts(check, requested?.evidence_artifacts),
    created_at: normalizeString(requested?.created_at) ?? check.generated_at ?? hermesDeskGeneratedAt
  };
}

function createFinding(
  check: HermesSpendPolicyCheckResult,
  suffix: string,
  severity: HermesPolicyReconciliationFinding['severity'],
  label: string,
  detail: string,
  expected: string,
  observed: string
): HermesPolicyReconciliationFinding {
  return {
    id: `policy_reconciliation_finding_${slugifyId(check.id)}_${suffix}`,
    severity,
    label,
    detail,
    expected,
    observed
  };
}

function buildFindings(check: HermesSpendPolicyCheckResult, outcome: HermesPolicyOutcome): HermesPolicyReconciliationFinding[] {
  const findings: HermesPolicyReconciliationFinding[] = [];
  const intendedTestAmount = intendedTestAmountUsd(check);

  if (check.decision === 'block' && outcome.outcome_state === 'spent_despite_block') {
    findings.push(createFinding(
      check,
      'spent_despite_block',
      'critical',
      'Spent despite block',
      'Observed wallet execution violated a block decision.',
      'Wallet must not spend when policy decision is block.',
      `Wallet spent with outcome_state=${outcome.outcome_state}.`
    ));
  }

  if (check.decision === 'require_manual_review' && outcome.outcome_state === 'manual_review_missing') {
    findings.push(createFinding(
      check,
      'manual_review_missing',
      'high',
      'Missing manual review',
      'No evidence showed that required manual review completed before execution.',
      'Wallet should provide manual review evidence before spend progression.',
      `Outcome state ${outcome.outcome_state} was recorded.`
    ));
  }

  if (
    check.decision === 'allow_with_test_spend'
    && outcome.spend_happened
    && typeof intendedTestAmount === 'number'
    && typeof outcome.amount_usd === 'number'
    && outcome.amount_usd > intendedTestAmount
  ) {
    findings.push(createFinding(
      check,
      'full_spend_when_test_required',
      outcome.outcome_state === 'spent_despite_block' ? 'critical' : 'high',
      'Full spend happened when test spend was required',
      'Observed amount exceeded the deterministic intended test-spend amount.',
      `Wallet should limit execution to test amount <= $${intendedTestAmount.toFixed(2)}.`,
      `Observed amount was $${outcome.amount_usd.toFixed(2)} with outcome_state=${outcome.outcome_state}.`
    ));
  }

  if (outcome.chain && !check.policy.allowed_chains.includes(outcome.chain)) {
    findings.push(createFinding(
      check,
      'unsupported_chain',
      'high',
      'Unsupported chain observed',
      'Observed wallet outcome used a chain outside the approved policy boundary.',
      `Allowed chains: ${check.policy.allowed_chains.join(', ') || 'none'}.`,
      `Observed chain: ${outcome.chain}.`
    ));
  }

  if (outcome.payment_rail && !check.policy.allowed_payment_rails.includes(outcome.payment_rail)) {
    findings.push(createFinding(
      check,
      'unsupported_payment_rail',
      'high',
      'Unsupported payment rail observed',
      'Observed wallet outcome used a payment rail outside the approved policy boundary.',
      `Allowed rails: ${check.policy.allowed_payment_rails.join(', ') || 'none'}.`,
      `Observed rail: ${outcome.payment_rail}.`
    ));
  }

  if (typeof outcome.amount_usd === 'number' && outcome.amount_usd > check.policy.max_amount_usd) {
    findings.push(createFinding(
      check,
      'amount_above_policy_max',
      'high',
      'Amount greater than policy max',
      'Observed amount exceeded the deterministic policy max.',
      `Amount must stay <= $${check.policy.max_amount_usd.toFixed(2)}.`,
      `Observed amount was $${outcome.amount_usd.toFixed(2)}.`
    ));
  }

  if (outcome.outcome_state === 'unknown') {
    findings.push(createFinding(
      check,
      'outcome_unknown',
      'medium',
      'Outcome unknown',
      'Observed wallet outcome is too incomplete to prove compliance.',
      'Wallet outcome should map to an explicit execution or block state.',
      'Outcome state remained unknown.'
    ));
  }

  if (outcome.outcome_state === 'failed') {
    findings.push(createFinding(
      check,
      'failed_outcome',
      'medium',
      'Failed spend',
      'Observed wallet attempt failed and needs additional evidence before deterministic trust movement.',
      'Outcome should either complete, stay blocked, or produce enough evidence for review.',
      `Outcome failed with spend_happened=${String(outcome.spend_happened)}${outcome.error_code ? ` and error_code=${outcome.error_code}` : ''}.`
    ));
  }

  if (check.decision === 'block' && outcome.outcome_state === 'blocked_as_required') {
    findings.push(createFinding(
      check,
      'compliant_block',
      'low',
      'Compliant block',
      'Observed wallet respected the block decision.',
      'Wallet should not spend after a block decision.',
      'Wallet stayed blocked as required.'
    ));
  }

  if (check.decision === 'allow_with_test_spend' && outcome.outcome_state === 'test_spend_completed') {
    findings.push(createFinding(
      check,
      'compliant_test_spend',
      'low',
      'Compliant test spend',
      'Observed wallet completed the required deterministic test spend.',
      'Wallet should complete a limited test spend before broader execution.',
      typeof outcome.amount_usd === 'number'
        ? `Observed test-spend amount was $${outcome.amount_usd.toFixed(2)}.`
        : 'Observed test-spend evidence was recorded.'
    ));
  }

  return findings;
}

function complianceForOutcome(
  check: HermesSpendPolicyCheckResult,
  outcome: HermesPolicyOutcome
): HermesPolicyComplianceState {
  const intendedTestAmount = intendedTestAmountUsd(check);

  if (outcome.outcome_state === 'unknown') return 'unknown';

  if (check.decision === 'allow') {
    if (outcome.outcome_state === 'spent') return 'compliant';
    if (outcome.outcome_state === 'failed') return 'partially_compliant';
    if (outcome.outcome_state === 'spent_despite_block') return 'non_compliant';
    return outcome.spend_happened ? 'partially_compliant' : 'needs_review';
  }

  if (check.decision === 'allow_with_test_spend') {
    if (outcome.outcome_state === 'test_spend_completed') return 'compliant';
    if (
      outcome.spend_happened
      && typeof outcome.amount_usd === 'number'
      && typeof intendedTestAmount === 'number'
      && outcome.amount_usd > intendedTestAmount
    ) {
      return outcome.amount_usd > check.policy.max_amount_usd ? 'non_compliant' : 'partially_compliant';
    }
    if (outcome.outcome_state === 'failed') return 'needs_review';
    return outcome.spend_happened ? 'partially_compliant' : 'needs_review';
  }

  if (check.decision === 'require_manual_review') {
    if (outcome.outcome_state === 'manual_review_completed') return 'compliant';
    if (outcome.outcome_state === 'manual_review_missing') return 'non_compliant';
    if (outcome.outcome_state === 'failed') return 'needs_review';
    return outcome.spend_happened ? 'partially_compliant' : 'needs_review';
  }

  if (outcome.outcome_state === 'blocked_as_required' || outcome.outcome_state === 'spend_attempt_blocked') return 'compliant';
  if (outcome.outcome_state === 'spent_despite_block') return 'non_compliant';
  if (outcome.outcome_state === 'failed' && !outcome.spend_happened) return 'compliant';
  return outcome.spend_happened ? 'non_compliant' : 'needs_review';
}

function targetForImpact(outcome: HermesPolicyOutcome, policyId: string): Pick<HermesPolicyReconciliationImpact, 'target_type' | 'target_id'> {
  if (outcome.provider_id) return { target_type: 'provider', target_id: outcome.provider_id };
  if (outcome.route_id) return { target_type: 'route', target_id: outcome.route_id };
  if (outcome.service_id) return { target_type: 'service', target_id: outcome.service_id };
  if (policyId) return { target_type: 'policy', target_id: policyId };
  return { target_type: 'unknown' };
}

function severityWeight(decision: HermesSpendPolicyDecision): number {
  if (decision === 'block') return 0.85;
  if (decision === 'require_manual_review') return 0.65;
  if (decision === 'allow_with_test_spend') return 0.45;
  return 0.25;
}

function amountSensitivity(amountUsd: number | undefined): number {
  if (typeof amountUsd !== 'number') return 0;
  if (amountUsd >= 1000) return 0.25;
  if (amountUsd >= 250) return 0.15;
  if (amountUsd >= 50) return 0.08;
  return 0.03;
}

function buildImpact(
  check: HermesSpendPolicyCheckResult,
  outcome: HermesPolicyOutcome,
  complianceState: HermesPolicyComplianceState,
  findings: HermesPolicyReconciliationFinding[]
): HermesPolicyReconciliationImpact {
  const target = targetForImpact(outcome, check.policy.id);
  const criticalFinding = findings.some((finding) => finding.severity === 'critical');
  const negativeFinding = findings.some((finding) => finding.severity === 'high' || finding.severity === 'critical');

  let direction: HermesPolicyReconciliationImpact['direction'] = 'neutral';
  if (complianceState === 'compliant') {
    if (check.decision === 'block' && outcome.outcome_state === 'blocked_as_required' && target.target_type !== 'policy') {
      direction = 'watch';
    } else {
      direction = 'positive';
    }
  } else if (complianceState === 'partially_compliant') {
    direction = negativeFinding ? 'negative' : 'watch';
  } else if (complianceState === 'non_compliant') {
    direction = 'negative';
  } else if (complianceState === 'needs_review') {
    direction = outcome.outcome_state === 'failed' ? 'watch' : 'neutral';
  } else {
    direction = 'watch';
  }

  let magnitude = (check.pre_spend_decision.confidence * 0.55) + (severityWeight(check.decision) * 0.3) + amountSensitivity(outcome.amount_usd);
  if (complianceState === 'non_compliant') magnitude += 0.12;
  if (complianceState === 'partially_compliant') magnitude += 0.06;
  if (complianceState === 'needs_review' || complianceState === 'unknown') magnitude -= 0.1;
  if (criticalFinding) magnitude += 0.08;
  if (direction === 'positive' && check.decision === 'allow') magnitude -= 0.08;
  magnitude = clampUnit(magnitude);

  const targetLabel = target.target_id ? `${target.target_type}:${target.target_id}` : target.target_type;
  const summary = direction === 'positive'
    ? `Observed outcome supports future confidence for ${targetLabel}.`
    : direction === 'negative'
      ? `Observed outcome should reduce trust in ${targetLabel} and tighten future wallet gating.`
      : direction === 'watch'
        ? `Observed outcome keeps ${targetLabel} on watch while policy safety remains under review.`
        : `Observed outcome adds neutral policy memory for ${targetLabel}.`;

  return {
    ...target,
    direction,
    magnitude,
    summary,
    reputation_notes: [
      `policy_decision=${check.decision}`,
      `required_action=${check.required_action}`,
      `compliance_state=${complianceState}`,
      `outcome_state=${outcome.outcome_state}`,
      `spend_happened=${String(outcome.spend_happened)}`,
      `pre_spend_confidence=${check.pre_spend_decision.confidence}`,
      findings.length > 0
        ? `finding_count=${findings.length}`
        : 'finding_count=0'
    ]
  };
}

function buildFeedback(
  check: HermesSpendPolicyCheckResult,
  outcome: HermesPolicyOutcome,
  findings: HermesPolicyReconciliationFinding[],
  status: HermesPolicyReconciliationFeedback['status']
): HermesPolicyReconciliationFeedback {
  const notes = [
    `policy_decision=${check.decision}`,
    `outcome_state=${outcome.outcome_state}`,
    `spend_happened=${String(outcome.spend_happened)}`,
    status === 'preview'
      ? 'Preview only. No persistence was performed.'
      : 'Stateless reconciliation generated. No persistence was performed.'
  ];

  const spentDespiteBlock = findings.some((finding) => finding.label === 'Spent despite block');
  const missingManualReview = findings.some((finding) => finding.label === 'Missing manual review');
  const fullSpendAfterTest = findings.some((finding) => finding.label === 'Full spend happened when test spend was required');

  let nextPolicyAction: HermesPolicyReconciliationFeedback['next_policy_action'] = 'none';
  if (spentDespiteBlock) {
    nextPolicyAction = outcome.provider_id ? 'block_provider' : 'tighten_policy';
  } else if (missingManualReview) {
    nextPolicyAction = 'require_manual_review';
  } else if (fullSpendAfterTest) {
    nextPolicyAction = 'tighten_policy';
  } else if (outcome.outcome_state === 'failed' || outcome.outcome_state === 'unknown') {
    nextPolicyAction = 'request_more_evidence';
  }

  return {
    status,
    notes,
    next_policy_action: nextPolicyAction
  };
}

function summaryForResult(
  check: HermesSpendPolicyCheckResult,
  outcome: HermesPolicyOutcome,
  complianceState: HermesPolicyComplianceState,
  feedback: HermesPolicyReconciliationFeedback
): string {
  return `Policy ${check.decision} reconciled with wallet outcome ${outcome.outcome_state}: ${complianceState}. Next action=${feedback.next_policy_action}.`;
}

function reconcile(
  check: HermesSpendPolicyCheckResult,
  outcomeInput: Partial<HermesPolicyOutcome> | undefined,
  feedbackStatus: HermesPolicyReconciliationFeedback['status']
): HermesPolicyReconciliationResult {
  const receipt = createHermesPolicyDecisionReceipt(check).receipt;
  const outcome = buildOutcome(check, outcomeInput);
  const findings = buildFindings(check, outcome);
  const complianceState = complianceForOutcome(check, outcome);
  const impact = buildImpact(check, outcome, complianceState, findings);
  const feedback = buildFeedback(check, outcome, findings, feedbackStatus);

  return {
    check_id: check.id,
    policy_receipt_id: receipt.id,
    outcome,
    compliance_state: complianceState,
    findings,
    feedback,
    impact,
    summary: summaryForResult(check, outcome, complianceState, feedback),
    generated_at: check.generated_at ?? hermesDeskGeneratedAt
  };
}

export function reconcileHermesPolicyOutcome(
  check: HermesSpendPolicyCheckResult,
  outcomeInput?: Partial<HermesPolicyOutcome>
): HermesPolicyReconciliationResult {
  return reconcile(check, outcomeInput, 'recorded');
}

export function previewHermesPolicyReconciliation(
  check: HermesSpendPolicyCheckResult
): HermesPolicyReconciliationResult {
  return reconcile(check, undefined, 'preview');
}
