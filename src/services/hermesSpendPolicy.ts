import { hermesDeskGeneratedAt } from '../data/hermesDesk';
import {
  createHermesPreSpendDecision,
  type HermesPreSpendDecision,
  type HermesPreSpendDecisionInput
} from './hermesPreSpendDecision';

export type HermesSpendPolicyDecision =
  | 'allow'
  | 'allow_with_test_spend'
  | 'require_manual_review'
  | 'block';

export type HermesSpendPolicyCheckInput = HermesPreSpendDecisionInput & {
  policy_id?: string;
};

export type HermesSpendPolicy = {
  id: string;
  title: string;
  summary: string;
  max_amount_usd: number;
  allowed_chains: string[];
  allowed_payment_rails: string[];
  blocked_providers: string[];
  require_test_spend_for_watchlist: boolean;
  manual_review_threshold_usd: number;
  do_not_spend_on_disputed: boolean;
  created_at: string;
};

export type HermesSpendPolicyRule = {
  id: string;
  label: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
};

export type HermesSpendPolicyViolation = {
  id: string;
  rule_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  detail: string;
  outcome: 'warn' | 'test_spend_required' | 'manual_review_required' | 'blocked';
};

export type HermesSpendPolicyReference = {
  kind: 'pre_spend_decision' | 'reputation_entry' | 'policy' | 'receipt' | 'claim' | 'run';
  id: string;
  summary: string;
};

export type HermesSpendPolicyCheckResult = {
  id: string;
  policy: HermesSpendPolicy;
  input: HermesSpendPolicyCheckInput;
  decision: HermesSpendPolicyDecision;
  allowed: boolean;
  reason: string;
  required_action:
    | 'none'
    | 'run_small_test_spend'
    | 'manual_review_required'
    | 'use_fallback_route'
    | 'do_not_spend';
  violations: HermesSpendPolicyViolation[];
  warnings: HermesSpendPolicyViolation[];
  pre_spend_decision: HermesPreSpendDecision;
  references: HermesSpendPolicyReference[];
  generated_at: string;
};

const HERMES_SPEND_POLICY_CREATED_AT = hermesDeskGeneratedAt;

export const HERMES_SPEND_POLICY_EXAMPLE_INPUT: HermesSpendPolicyCheckInput = {
  route_id: 'route_pay_sh_market_research_01',
  provider_id: 'provider_pay_sh_lattice',
  service_id: 'service_market_research',
  amount_usd: 25,
  payment_rail: 'x402',
  chain: 'base'
};

const seededPolicies: HermesSpendPolicy[] = [
  {
    id: 'policy_infopunks_default_agent_spend',
    title: 'Infopunks Default Agent Spend Policy',
    summary: 'A conservative policy for autonomous wallets using pre-spend intelligence.',
    max_amount_usd: 250,
    allowed_chains: ['base', 'solana'],
    allowed_payment_rails: ['x402', 'pay.sh', 'agentic.market'],
    blocked_providers: [],
    require_test_spend_for_watchlist: true,
    manual_review_threshold_usd: 1000,
    do_not_spend_on_disputed: true,
    created_at: HERMES_SPEND_POLICY_CREATED_AT
  },
  {
    id: 'policy_infopunks_strict_agent_spend',
    title: 'Infopunks Strict Agent Spend Policy',
    summary: 'A narrow policy for autonomous wallets operating under tighter spend caps.',
    max_amount_usd: 50,
    allowed_chains: ['base', 'solana'],
    allowed_payment_rails: ['x402', 'pay.sh', 'agentic.market'],
    blocked_providers: ['provider_pay_sh_blackhole'],
    require_test_spend_for_watchlist: true,
    manual_review_threshold_usd: 250,
    do_not_spend_on_disputed: true,
    created_at: HERMES_SPEND_POLICY_CREATED_AT
  }
];

const seededRules: HermesSpendPolicyRule[] = [
  {
    id: 'policy_rule_max_amount',
    label: 'Maximum autonomous spend',
    description: 'Escalate or block spends that exceed the wallet policy amount cap.',
    severity: 'high'
  },
  {
    id: 'policy_rule_manual_review_threshold',
    label: 'Manual review threshold',
    description: 'Escalate larger spends to manual review before the wallet can sign.',
    severity: 'high'
  },
  {
    id: 'policy_rule_allowed_chain',
    label: 'Allowed chains only',
    description: 'Block spends on chains that are outside the approved wallet boundary.',
    severity: 'critical'
  },
  {
    id: 'policy_rule_allowed_payment_rail',
    label: 'Allowed payment rails only',
    description: 'Block spends on unsupported payment rails.',
    severity: 'critical'
  },
  {
    id: 'policy_rule_blocked_provider',
    label: 'Blocked providers',
    description: 'Block providers that the policy explicitly disallows.',
    severity: 'critical'
  },
  {
    id: 'policy_rule_pre_spend_block',
    label: 'Respect pre-spend stop decisions',
    description: 'If the decision engine says do not spend, policy must block.',
    severity: 'critical'
  },
  {
    id: 'policy_rule_insufficient_evidence',
    label: 'Escalate insufficient evidence',
    description: 'If the decision engine lacks enough evidence, policy requires manual review.',
    severity: 'high'
  },
  {
    id: 'policy_rule_disputed_memory',
    label: 'Block disputed memory',
    description: 'Disputed provider, route, or service memory cannot be spent against automatically.',
    severity: 'critical'
  },
  {
    id: 'policy_rule_watchlist_test_spend',
    label: 'Watchlist requires test spend',
    description: 'Watchlist targets can be used only with a small test spend first.',
    severity: 'medium'
  },
  {
    id: 'policy_rule_cautious_decision',
    label: 'Cautious decision handling',
    description: 'Mixed evidence can require either a test spend or manual review based on amount sensitivity.',
    severity: 'medium'
  }
];

type DecisionDraft = {
  decision: HermesSpendPolicyDecision;
  reason: string;
  required_action: HermesSpendPolicyCheckResult['required_action'];
};

function normalizeString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeInput(input: HermesSpendPolicyCheckInput): HermesSpendPolicyCheckInput {
  return {
    route_id: normalizeString(input.route_id),
    provider_id: normalizeString(input.provider_id),
    service_id: normalizeString(input.service_id),
    amount_usd: typeof input.amount_usd === 'number' && Number.isFinite(input.amount_usd) ? Number(input.amount_usd.toFixed(2)) : undefined,
    payment_rail: normalizeString(input.payment_rail),
    chain: normalizeString(input.chain),
    agent_type: normalizeString(input.agent_type),
    objective: normalizeString(input.objective),
    policy_id: normalizeString(input.policy_id)
  };
}

function stableResultId(policy: HermesSpendPolicy, input: HermesSpendPolicyCheckInput): string {
  const parts = [
    policy.id,
    input.route_id ?? 'no_route',
    input.provider_id ?? 'no_provider',
    input.service_id ?? 'no_service',
    typeof input.amount_usd === 'number' ? input.amount_usd.toFixed(2) : 'no_amount',
    input.payment_rail ?? 'no_rail',
    input.chain ?? 'no_chain',
    input.agent_type ?? 'no_agent',
    input.objective ?? 'no_objective'
  ];
  return `hermes_spend_policy_check_${parts.join('_').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

function decisionPriority(decision: HermesSpendPolicyDecision): number {
  if (decision === 'block') return 4;
  if (decision === 'require_manual_review') return 3;
  if (decision === 'allow_with_test_spend') return 2;
  return 1;
}

function higherDecision(left: DecisionDraft, right: DecisionDraft): DecisionDraft {
  return decisionPriority(right.decision) > decisionPriority(left.decision) ? right : left;
}

function createViolation(
  id: string,
  ruleId: string,
  severity: HermesSpendPolicyViolation['severity'],
  label: string,
  detail: string,
  outcome: HermesSpendPolicyViolation['outcome']
): HermesSpendPolicyViolation {
  return { id, rule_id: ruleId, severity, label, detail, outcome };
}

function isWatchlistDecision(decision: HermesPreSpendDecision): boolean {
  return decision.decision === 'test_spend_first'
    || decision.risk_factors.some((risk) => risk.id.endsWith('_watchlist'))
    || decision.ledger_state.provider_state === 'watchlist'
    || decision.ledger_state.route_state === 'watchlist'
    || decision.ledger_state.service_state === 'watchlist';
}

function hasDisputedLedgerState(decision: HermesPreSpendDecision): boolean {
  return [
    decision.ledger_state.provider_state,
    decision.ledger_state.route_state,
    decision.ledger_state.service_state
  ].includes('disputed');
}

function dedupeReferences(items: HermesSpendPolicyReference[]): HermesSpendPolicyReference[] {
  const seen = new Set<string>();
  const output: HermesSpendPolicyReference[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function referencesFromDecision(policy: HermesSpendPolicy, decision: HermesPreSpendDecision): HermesSpendPolicyReference[] {
  return dedupeReferences([
    {
      kind: 'policy',
      id: policy.id,
      summary: `${policy.title}: ${policy.summary}`
    },
    {
      kind: 'pre_spend_decision',
      id: decision.id,
      summary: `${decision.decision} with required_action=${decision.required_action}. ${decision.reason}`
    },
    ...decision.reputation_inputs.map((item) => ({
      kind: 'reputation_entry' as const,
      id: item.id,
      summary: item.summary
    })),
    ...decision.receipt_inputs.map((item) => ({
      kind: 'receipt' as const,
      id: item.id,
      summary: item.summary
    })),
    ...decision.claim_inputs.map((item) => ({
      kind: 'claim' as const,
      id: item.id,
      summary: item.summary
    })),
    ...decision.run_inputs.map((item) => ({
      kind: 'run' as const,
      id: item.id,
      summary: item.summary
    }))
  ]);
}

function reasonFromDecision(decision: DecisionDraft): string {
  return decision.reason;
}

export function getDefaultHermesSpendPolicy(): HermesSpendPolicy {
  return seededPolicies[0];
}

export function listHermesSpendPolicies(): HermesSpendPolicy[] {
  return seededPolicies.map((policy) => ({ ...policy }));
}

export function listHermesSpendPolicyRules(): HermesSpendPolicyRule[] {
  return seededRules.map((rule) => ({ ...rule }));
}

export function getHermesSpendPolicyById(policyId?: string): HermesSpendPolicy {
  if (!policyId) return getDefaultHermesSpendPolicy();
  return seededPolicies.find((policy) => policy.id === policyId) ?? getDefaultHermesSpendPolicy();
}

export function checkHermesSpendPolicy(input: HermesSpendPolicyCheckInput): HermesSpendPolicyCheckResult {
  const normalizedInput = normalizeInput(input);
  const policy = getHermesSpendPolicyById(normalizedInput.policy_id);
  const preSpendDecision = createHermesPreSpendDecision(normalizedInput);
  const violations: HermesSpendPolicyViolation[] = [];
  const warnings: HermesSpendPolicyViolation[] = [];

  let draft: DecisionDraft = {
    decision: 'allow',
    reason: 'Spend intent stays within policy boundaries and the pre-spend engine does not require extra gating.',
    required_action: 'none'
  };

  if (typeof normalizedInput.amount_usd === 'number' && normalizedInput.amount_usd > policy.max_amount_usd) {
    const amountViolation = createViolation(
      `policy_violation_amount_cap_${normalizedInput.amount_usd.toFixed(2)}`,
      'policy_rule_max_amount',
      'high',
      'Amount exceeds autonomous spend cap',
      `Requested spend of $${normalizedInput.amount_usd.toFixed(2)} is above policy max_amount_usd=$${policy.max_amount_usd.toFixed(2)}.`,
      'manual_review_required'
    );
    violations.push(amountViolation);
    draft = higherDecision(draft, {
      decision: 'require_manual_review',
      reason: `Amount exceeds policy max_amount_usd of $${policy.max_amount_usd.toFixed(2)}.`,
      required_action: 'manual_review_required'
    });
  }

  if (typeof normalizedInput.amount_usd === 'number' && normalizedInput.amount_usd >= policy.manual_review_threshold_usd) {
    const thresholdViolation = createViolation(
      `policy_violation_manual_review_threshold_${normalizedInput.amount_usd.toFixed(2)}`,
      'policy_rule_manual_review_threshold',
      'high',
      'Amount requires manual review',
      `Requested spend of $${normalizedInput.amount_usd.toFixed(2)} meets or exceeds manual_review_threshold_usd=$${policy.manual_review_threshold_usd.toFixed(2)}.`,
      'manual_review_required'
    );
    violations.push(thresholdViolation);
    draft = higherDecision(draft, {
      decision: 'require_manual_review',
      reason: `Amount meets the manual review threshold of $${policy.manual_review_threshold_usd.toFixed(2)}.`,
      required_action: 'manual_review_required'
    });
  }

  if (normalizedInput.chain && !policy.allowed_chains.includes(normalizedInput.chain)) {
    violations.push(createViolation(
      `policy_violation_chain_${normalizedInput.chain}`,
      'policy_rule_allowed_chain',
      'critical',
      'Unsupported chain',
      `Chain ${normalizedInput.chain} is not allowed by policy.`,
      'blocked'
    ));
    draft = higherDecision(draft, {
      decision: 'block',
      reason: `Chain ${normalizedInput.chain} is outside allowed policy chains.`,
      required_action: 'do_not_spend'
    });
  }

  if (normalizedInput.payment_rail && !policy.allowed_payment_rails.includes(normalizedInput.payment_rail)) {
    violations.push(createViolation(
      `policy_violation_payment_rail_${normalizedInput.payment_rail}`,
      'policy_rule_allowed_payment_rail',
      'critical',
      'Unsupported payment rail',
      `Payment rail ${normalizedInput.payment_rail} is not allowed by policy.`,
      'blocked'
    ));
    draft = higherDecision(draft, {
      decision: 'block',
      reason: `Payment rail ${normalizedInput.payment_rail} is outside allowed policy rails.`,
      required_action: 'do_not_spend'
    });
  }

  if (normalizedInput.provider_id && policy.blocked_providers.includes(normalizedInput.provider_id)) {
    violations.push(createViolation(
      `policy_violation_provider_${normalizedInput.provider_id}`,
      'policy_rule_blocked_provider',
      'critical',
      'Blocked provider',
      `Provider ${normalizedInput.provider_id} is explicitly blocked by policy.`,
      'blocked'
    ));
    draft = higherDecision(draft, {
      decision: 'block',
      reason: `Provider ${normalizedInput.provider_id} is blocked by policy.`,
      required_action: 'do_not_spend'
    });
  }

  if (preSpendDecision.decision === 'do_not_spend') {
    violations.push(createViolation(
      'policy_violation_pre_spend_do_not_spend',
      'policy_rule_pre_spend_block',
      'critical',
      'Pre-spend engine blocked the spend',
      `Pre-spend decision returned do_not_spend with required_action=${preSpendDecision.required_action}.`,
      'blocked'
    ));
    draft = higherDecision(draft, {
      decision: 'block',
      reason: `Pre-spend decision returned do_not_spend: ${preSpendDecision.reason}`,
      required_action: preSpendDecision.required_action === 'use_fallback_route' ? 'use_fallback_route' : 'do_not_spend'
    });
  }

  if (preSpendDecision.decision === 'insufficient_evidence') {
    violations.push(createViolation(
      'policy_violation_insufficient_evidence',
      'policy_rule_insufficient_evidence',
      'high',
      'Insufficient evidence',
      'Pre-spend decision returned insufficient_evidence, so wallet action must escalate to manual review.',
      'manual_review_required'
    ));
    draft = higherDecision(draft, {
      decision: 'require_manual_review',
      reason: `Pre-spend decision returned insufficient_evidence: ${preSpendDecision.reason}`,
      required_action: 'manual_review_required'
    });
  }

  if (policy.do_not_spend_on_disputed && hasDisputedLedgerState(preSpendDecision)) {
    violations.push(createViolation(
      'policy_violation_disputed_memory',
      'policy_rule_disputed_memory',
      'critical',
      'Disputed ledger state',
      'At least one matching provider, route, or service is disputed in the ledger.',
      'blocked'
    ));
    draft = higherDecision(draft, {
      decision: 'block',
      reason: 'Matching ledger memory is disputed and policy forbids automatic spend against disputed targets.',
      required_action: 'do_not_spend'
    });
  }

  if (policy.require_test_spend_for_watchlist && isWatchlistDecision(preSpendDecision)) {
    const watchlistWarning = createViolation(
      'policy_warning_watchlist_test_spend',
      'policy_rule_watchlist_test_spend',
      'medium',
      'Watchlist requires test spend',
      'Matched provider, route, or service memory is on watchlist or the decision engine already recommends a test spend first.',
      'test_spend_required'
    );
    warnings.push(watchlistWarning);
    draft = higherDecision(draft, {
      decision: 'allow_with_test_spend',
      reason: 'Watchlist memory requires a small test spend before broader spend is allowed.',
      required_action: 'run_small_test_spend'
    });
  }

  if (preSpendDecision.decision === 'test_spend_first') {
    warnings.push(createViolation(
      'policy_warning_pre_spend_test_first',
      'policy_rule_watchlist_test_spend',
      'medium',
      'Pre-spend engine requires a test spend',
      'Pre-spend decision returned test_spend_first.',
      'test_spend_required'
    ));
    draft = higherDecision(draft, {
      decision: 'allow_with_test_spend',
      reason: `Pre-spend decision returned test_spend_first: ${preSpendDecision.reason}`,
      required_action: 'run_small_test_spend'
    });
  }

  if (preSpendDecision.decision === 'proceed_with_caution') {
    const cautiousWarning = createViolation(
      'policy_warning_proceed_with_caution',
      'policy_rule_cautious_decision',
      'medium',
      'Proceed with caution',
      'Pre-spend decision returned proceed_with_caution, so policy keeps a tighter gate on this spend.',
      typeof normalizedInput.amount_usd === 'number' && normalizedInput.amount_usd > policy.max_amount_usd
        ? 'manual_review_required'
        : 'test_spend_required'
    );
    warnings.push(cautiousWarning);
    draft = higherDecision(draft, typeof normalizedInput.amount_usd === 'number' && normalizedInput.amount_usd > policy.max_amount_usd
      ? {
          decision: 'require_manual_review',
          reason: `Pre-spend decision returned proceed_with_caution and the amount exceeds policy max_amount_usd of $${policy.max_amount_usd.toFixed(2)}.`,
          required_action: 'manual_review_required'
        }
      : {
          decision: 'allow_with_test_spend',
          reason: `Pre-spend decision returned proceed_with_caution: ${preSpendDecision.reason}`,
          required_action: 'run_small_test_spend'
        });
  }

  if (preSpendDecision.decision === 'proceed' && draft.decision === 'allow') {
    draft = {
      decision: 'allow',
      reason: `Pre-spend decision returned proceed and policy boundaries were satisfied. ${preSpendDecision.reason}`,
      required_action: 'none'
    };
  }

  const result: HermesSpendPolicyCheckResult = {
    id: stableResultId(policy, normalizedInput),
    policy,
    input: normalizedInput,
    decision: draft.decision,
    allowed: draft.decision === 'allow' || draft.decision === 'allow_with_test_spend',
    reason: reasonFromDecision(draft),
    required_action: draft.required_action,
    violations,
    warnings,
    pre_spend_decision: preSpendDecision,
    references: referencesFromDecision(policy, preSpendDecision),
    generated_at: preSpendDecision.generated_at || hermesDeskGeneratedAt
  };

  return result;
}

export function createHermesSpendPolicyExample(): HermesSpendPolicyCheckResult {
  return checkHermesSpendPolicy(HERMES_SPEND_POLICY_EXAMPLE_INPUT);
}
