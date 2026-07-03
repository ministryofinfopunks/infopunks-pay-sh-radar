import { hermesDeskGeneratedAt } from '../data/hermesDesk';
import type {
  HermesSpendPolicyCheckResult,
  HermesSpendPolicyDecision,
  HermesSpendPolicyReference,
  HermesSpendPolicyViolation
} from './hermesSpendPolicy';

export type HermesPolicyReceiptRiskSummary = {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  violation_count: number;
  warning_count: number;
  critical_count: number;
  high_count: number;
  summary: string;
};

export type HermesPolicyAuditTrailEvent = {
  id: string;
  at: string;
  label: string;
  state:
    | 'policy_loaded'
    | 'spend_intent_received'
    | 'pre_spend_decision_checked'
    | 'rules_evaluated'
    | 'policy_decision_made'
    | 'receipt_created';
  summary: string;
};

export type HermesPolicyAuditTrail = {
  id: string;
  source_check_id: string;
  events: HermesPolicyAuditTrailEvent[];
};

export type HermesPolicyDecisionReceipt = {
  id: string;
  source: 'spend_policy_check';
  source_check_id: string;
  source_policy_id: string;
  title: string;
  summary: string;
  receipt_kind: 'spend_policy_decision_receipt';
  policy_decision: HermesSpendPolicyDecision;
  allowed: boolean;
  required_action: string;
  reason: string;
  input: {
    route_id?: string;
    provider_id?: string;
    service_id?: string;
    amount_usd?: number;
    payment_rail?: string;
    chain?: string;
    agent_type?: string;
    objective?: string;
    policy_id?: string;
  };
  policy_snapshot: {
    id: string;
    title: string;
    max_amount_usd: number;
    allowed_chains: string[];
    allowed_payment_rails: string[];
    blocked_providers: string[];
    require_test_spend_for_watchlist: boolean;
    manual_review_threshold_usd: number;
    do_not_spend_on_disputed: boolean;
  };
  violations: Array<any>;
  warnings: Array<any>;
  pre_spend_decision_id?: string;
  references: Array<any>;
  audit_trail: HermesPolicyAuditTrail;
  risk_summary: HermesPolicyReceiptRiskSummary;
  created_at: string;
};

export type HermesPolicyDecisionReceiptConversion = {
  check_id: string;
  receipt: HermesPolicyDecisionReceipt;
  conversion: {
    status: 'converted' | 'already_converted' | 'failed';
    notes: string[];
  };
};

const fallbackCreatedAt = hermesDeskGeneratedAt;

function slugifyId(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'unknown_check';
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function copyViolations(items: HermesSpendPolicyViolation[] | undefined): HermesSpendPolicyViolation[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({ ...item }));
}

function copyReferences(items: HermesSpendPolicyReference[] | undefined): HermesSpendPolicyReference[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({ ...item }));
}

function summaryForDecision(decision: HermesSpendPolicyDecision): string {
  if (decision === 'allow') return 'Policy allowed spend with low risk.';
  if (decision === 'allow_with_test_spend') {
    return 'Policy allowed only with a test spend because watchlist evidence is present.';
  }
  if (decision === 'require_manual_review') return 'Policy requires manual review before spend.';
  return 'Policy blocked spend and retained the decision as audit evidence.';
}

function buildRiskSummary(check: HermesSpendPolicyCheckResult): HermesPolicyReceiptRiskSummary {
  const violations = copyViolations(check.violations);
  const warnings = copyViolations(check.warnings);
  const criticalCount = violations.filter((item) => item.severity === 'critical').length;
  const highCount = violations.filter((item) => item.severity === 'high').length;

  let riskLevel: HermesPolicyReceiptRiskSummary['risk_level'] = 'low';
  if (criticalCount > 0 || check.decision === 'block') {
    riskLevel = 'critical';
  } else if (highCount > 0 || check.decision === 'require_manual_review') {
    riskLevel = 'high';
  } else if (warnings.length > 0 || check.decision === 'allow_with_test_spend') {
    riskLevel = 'medium';
  } else if (check.decision === 'allow' && violations.length === 0) {
    riskLevel = 'low';
  }

  return {
    risk_level: riskLevel,
    violation_count: violations.length,
    warning_count: warnings.length,
    critical_count: criticalCount,
    high_count: highCount,
    summary: summaryForDecision(check.decision)
  };
}

function buildAuditTrailEvents(check: HermesSpendPolicyCheckResult, createdAt: string): HermesPolicyAuditTrailEvent[] {
  const checkIdSlug = slugifyId(check.id);
  const baseAt = safeString(check.generated_at, fallbackCreatedAt);
  const states: Array<{
    state: HermesPolicyAuditTrailEvent['state'];
    label: string;
    summary: string;
    at: string;
  }> = [
    {
      state: 'policy_loaded',
      label: 'Policy Loaded',
      summary: `Loaded policy ${safeString(check.policy?.id, 'unknown_policy')} for deterministic evaluation.`,
      at: baseAt
    },
    {
      state: 'spend_intent_received',
      label: 'Spend Intent Received',
      summary: `Received spend intent for route ${safeString(check.input?.route_id, 'unknown_route')} and provider ${safeString(check.input?.provider_id, 'unknown_provider')}.`,
      at: baseAt
    },
    {
      state: 'pre_spend_decision_checked',
      label: 'Pre-Spend Decision Checked',
      summary: `Consumed pre-spend decision ${safeString(check.pre_spend_decision?.id, 'unknown_pre_spend_decision')} before policy gating.`,
      at: safeString(check.pre_spend_decision?.generated_at, baseAt)
    },
    {
      state: 'rules_evaluated',
      label: 'Rules Evaluated',
      summary: `Evaluated policy rules against ${copyViolations(check.violations).length} violation(s) and ${copyViolations(check.warnings).length} warning(s).`,
      at: baseAt
    },
    {
      state: 'policy_decision_made',
      label: 'Policy Decision Made',
      summary: `Policy decision ${check.decision} requires action ${check.required_action}.`,
      at: baseAt
    },
    {
      state: 'receipt_created',
      label: 'Receipt Created',
      summary: 'Converted the stateless policy check into an audit receipt-shaped object.',
      at: createdAt
    }
  ];

  return states.map((item) => ({
    id: `audit_event_${checkIdSlug}_${item.state}`,
    at: item.at,
    label: item.label,
    state: item.state,
    summary: item.summary
  }));
}

function buildAuditTrail(check: HermesSpendPolicyCheckResult, createdAt: string): HermesPolicyAuditTrail {
  const checkIdSlug = slugifyId(check.id);
  return {
    id: `audit_trail_hermes_policy_${checkIdSlug}`,
    source_check_id: check.id,
    events: buildAuditTrailEvents(check, createdAt)
  };
}

export function createHermesPolicyDecisionReceipt(
  check: HermesSpendPolicyCheckResult
): HermesPolicyDecisionReceiptConversion {
  const checkId = safeString(check?.id, 'unknown_check');
  const checkIdSlug = slugifyId(checkId);
  const createdAt = safeString(check?.generated_at, fallbackCreatedAt);
  const notes: string[] = [];

  const violations = copyViolations(check?.violations);
  const warnings = copyViolations(check?.warnings);

  if (violations.length === 0 && warnings.length === 0) {
    notes.push('Policy check passed without violations.');
  }
  if (check?.decision === 'block') {
    notes.push('Blocked policy decisions are retained as audit evidence.');
  }

  const receipt: HermesPolicyDecisionReceipt = {
    id: `receipt_hermes_policy_${checkIdSlug}`,
    source: 'spend_policy_check',
    source_check_id: checkId,
    source_policy_id: safeString(check?.policy?.id, 'unknown_policy'),
    title: `Policy Decision Receipt: ${safeString(check?.decision, 'unknown')}`,
    summary: `Decision=${safeString(check?.decision, 'unknown')}; allowed=${Boolean(check?.allowed)}; required_action=${safeString(check?.required_action, 'none')}; reason=${safeString(check?.reason, 'No policy reason supplied.')}`,
    receipt_kind: 'spend_policy_decision_receipt',
    policy_decision: check?.decision ?? 'block',
    allowed: Boolean(check?.allowed),
    required_action: safeString(check?.required_action, 'none'),
    reason: safeString(check?.reason, 'No policy reason supplied.'),
    input: {
      route_id: check?.input?.route_id,
      provider_id: check?.input?.provider_id,
      service_id: check?.input?.service_id,
      amount_usd: typeof check?.input?.amount_usd === 'number' ? check.input.amount_usd : undefined,
      payment_rail: check?.input?.payment_rail,
      chain: check?.input?.chain,
      agent_type: check?.input?.agent_type,
      objective: check?.input?.objective,
      policy_id: check?.input?.policy_id ?? check?.policy?.id
    },
    policy_snapshot: {
      id: safeString(check?.policy?.id, 'unknown_policy'),
      title: safeString(check?.policy?.title, 'Unknown policy'),
      max_amount_usd: typeof check?.policy?.max_amount_usd === 'number' ? check.policy.max_amount_usd : 0,
      allowed_chains: Array.isArray(check?.policy?.allowed_chains) ? [...check.policy.allowed_chains] : [],
      allowed_payment_rails: Array.isArray(check?.policy?.allowed_payment_rails) ? [...check.policy.allowed_payment_rails] : [],
      blocked_providers: Array.isArray(check?.policy?.blocked_providers) ? [...check.policy.blocked_providers] : [],
      require_test_spend_for_watchlist: Boolean(check?.policy?.require_test_spend_for_watchlist),
      manual_review_threshold_usd: typeof check?.policy?.manual_review_threshold_usd === 'number' ? check.policy.manual_review_threshold_usd : 0,
      do_not_spend_on_disputed: Boolean(check?.policy?.do_not_spend_on_disputed)
    },
    violations,
    warnings,
    pre_spend_decision_id: check?.pre_spend_decision?.id,
    references: copyReferences(check?.references),
    audit_trail: buildAuditTrail(check, createdAt),
    risk_summary: buildRiskSummary(check),
    created_at: createdAt
  };

  return {
    check_id: checkId,
    receipt,
    conversion: {
      status: 'converted',
      notes
    }
  };
}
