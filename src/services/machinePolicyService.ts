import {
  MachineMarketCategory,
  MachineMarketChain,
  MachineMarketEvidenceHealth,
  MachineMarketEvidenceStage,
  MachineMarketService,
  MachineMarketSource
} from './machineMarketService';
import { compareEvidenceStages, MACHINE_EVIDENCE_STAGES } from './machineEvidenceService';

export type MachinePolicyRiskTolerance = 'low' | 'medium' | 'high';
export type MachinePolicyStatus = 'active' | 'draft' | 'paused';
export type MachinePolicyEvaluationStatus = 'pass' | 'fail' | 'review';

export type MachinePolicy = {
  id: string;
  name: string;
  description: string;
  machine_id: string;
  owner_label: string;
  daily_budget_usd: number;
  per_call_budget_usd: number;
  allowed_categories: MachineMarketCategory[];
  blocked_categories: MachineMarketCategory[];
  allowed_source_markets: MachineMarketSource[];
  blocked_source_markets: MachineMarketSource[];
  allowed_chains: MachineMarketChain[];
  blocked_chains: MachineMarketChain[];
  allowed_services: string[];
  blocked_services: string[];
  approval_required_above_usd: number;
  minimum_evidence_stage: MachineMarketEvidenceStage;
  minimum_evidence_health: MachineMarketEvidenceHealth;
  risk_tolerance: MachinePolicyRiskTolerance;
  receipt_required: boolean;
  human_review_required_for: string[];
  created_at: string;
  updated_at: string;
  status: MachinePolicyStatus;
};

export type MachinePolicyPreflightRequest = {
  machine_id?: string;
  requested_cost_usd: number;
  receipt_required?: boolean;
  purpose?: string;
  human_approved?: boolean;
};

export type MachinePolicyCheck = {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'review';
  detail: string;
};

export type MachinePolicyEvaluation = {
  status: MachinePolicyEvaluationStatus;
  checks: MachinePolicyCheck[];
  violations: string[];
  review_reasons: string[];
  explanation: string;
};

const POLICY_TIMESTAMP = '2026-05-22T00:00:00.000Z';

export const MACHINE_EVIDENCE_STAGE_ORDER: MachineMarketEvidenceStage[] = [...MACHINE_EVIDENCE_STAGES];

export const MACHINE_EVIDENCE_HEALTH_ORDER: MachineMarketEvidenceHealth[] = ['scaffold', 'listed'];

const policyTemplates: MachinePolicy[] = [
  policy({
    id: 'delivery-robot',
    name: 'Delivery Robot',
    description: 'Low-risk field delivery policy for translation, document vision, and limited web evidence lookups.',
    machine_id: 'template:delivery-robot',
    owner_label: 'Operations',
    daily_budget_usd: 3,
    per_call_budget_usd: 0.05,
    allowed_categories: ['vision', 'translation', 'web'],
    blocked_services: ['2captcha'],
    approval_required_above_usd: 0.05,
    minimum_evidence_stage: 'policy-mapped',
    risk_tolerance: 'low',
    receipt_required: true,
    human_review_required_for: ['approval_threshold', 'high_policy_risk', 'missing_receipt_requirement']
  }),
  policy({
    id: 'warehouse-camera',
    name: 'Warehouse Camera',
    description: 'Camera-bound policy for structured visual parsing and storage with tight budgets.',
    machine_id: 'template:warehouse-camera',
    owner_label: 'Warehouse Operations',
    daily_budget_usd: 5,
    per_call_budget_usd: 0.1,
    allowed_categories: ['vision', 'storage'],
    approval_required_above_usd: 0.1,
    minimum_evidence_stage: 'policy-mapped',
    risk_tolerance: 'low',
    receipt_required: true,
    human_review_required_for: ['approval_threshold', 'high_policy_risk']
  }),
  policy({
    id: 'autonomous-research-agent',
    name: 'Autonomous Research Agent',
    description: 'Research policy for inference, web, and translation services with medium risk tolerance.',
    machine_id: 'template:autonomous-research-agent',
    owner_label: 'Research',
    daily_budget_usd: 10,
    per_call_budget_usd: 0.25,
    allowed_categories: ['inference', 'web', 'translation'],
    allowed_source_markets: ['pay.sh', 'agentic.market'],
    allowed_chains: ['solana', 'base'],
    approval_required_above_usd: 0.25,
    minimum_evidence_stage: 'policy-mapped',
    risk_tolerance: 'medium',
    receipt_required: true,
    human_review_required_for: ['approval_threshold', 'blocked_or_sensitive_web_use']
  }),
  policy({
    id: 'depin-sensor',
    name: 'DePIN Sensor',
    description: 'Sensor policy for storage and attestable compute across Solana and peaq metadata routes.',
    machine_id: 'template:depin-sensor',
    owner_label: 'DePIN Operations',
    daily_budget_usd: 2,
    per_call_budget_usd: 0.03,
    allowed_categories: ['storage', 'compute'],
    allowed_chains: ['solana', 'peaq'],
    approval_required_above_usd: 0.03,
    minimum_evidence_stage: 'policy-mapped',
    risk_tolerance: 'low',
    receipt_required: true,
    human_review_required_for: ['approval_threshold', 'setup_status']
  }),
  policy({
    id: 'field-maintenance-bot',
    name: 'Field Maintenance Bot',
    description: 'Field maintenance policy for visual inspection, translation, web lookup, and limited inference.',
    machine_id: 'template:field-maintenance-bot',
    owner_label: 'Field Operations',
    daily_budget_usd: 8,
    per_call_budget_usd: 0.2,
    allowed_categories: ['vision', 'translation', 'web', 'inference'],
    approval_required_above_usd: 0.2,
    minimum_evidence_stage: 'policy-mapped',
    risk_tolerance: 'medium',
    receipt_required: true,
    human_review_required_for: ['approval_threshold', 'high_policy_risk']
  })
];

export function listMachinePolicyTemplates(): MachinePolicy[] {
  return policyTemplates.map(copyPolicy);
}

export function getMachinePolicyTemplateById(policyId: string): MachinePolicy | null {
  const normalizedPolicyId = normalizePolicyId(policyId);
  const policy = policyTemplates.find((item) => item.id === normalizedPolicyId);
  return policy ? copyPolicy(policy) : null;
}

export function compareEvidenceStage(left: MachineMarketEvidenceStage, right: MachineMarketEvidenceStage): number {
  return compareEvidenceStages(left, right);
}

export function evidenceStageMeetsMinimum(stage: MachineMarketEvidenceStage, minimum: MachineMarketEvidenceStage): boolean {
  return compareEvidenceStage(stage, minimum) >= 0;
}

export function evaluateMachinePolicy(service: MachineMarketService, policy: MachinePolicy, request: MachinePolicyPreflightRequest): MachinePolicyEvaluation {
  const checks: MachinePolicyCheck[] = [];
  const violations: string[] = [];
  const reviewReasons: string[] = [];

  const addCheck = (id: string, label: string, status: MachinePolicyCheck['status'], detail: string) => {
    checks.push({ id, label, status, detail });
    if (status === 'fail') violations.push(id);
    if (status === 'review') reviewReasons.push(id);
  };

  addCheck(
    'category_allowed',
    'category allowed',
    policy.allowed_categories.length === 0 || policy.allowed_categories.includes(service.category) ? 'pass' : 'fail',
    `${service.category} ${policy.allowed_categories.length === 0 ? 'has no allow-list restriction' : `must be one of ${policy.allowed_categories.join(', ')}`}`
  );
  addCheck(
    'category_not_blocked',
    'category not blocked',
    policy.blocked_categories.includes(service.category) ? 'fail' : 'pass',
    `${service.category} is ${policy.blocked_categories.includes(service.category) ? '' : 'not '}blocked`
  );
  addCheck(
    'source_market_allowed',
    'source market allowed',
    policy.allowed_source_markets.length === 0 || policy.allowed_source_markets.includes(service.source_market) ? 'pass' : 'fail',
    `${service.source_market} ${policy.allowed_source_markets.length === 0 ? 'has no allow-list restriction' : `must be one of ${policy.allowed_source_markets.join(', ')}`}`
  );
  addCheck(
    'source_market_not_blocked',
    'source market not blocked',
    policy.blocked_source_markets.includes(service.source_market) ? 'fail' : 'pass',
    `${service.source_market} is ${policy.blocked_source_markets.includes(service.source_market) ? '' : 'not '}blocked`
  );
  addCheck(
    'chain_allowed',
    'chain allowed',
    policy.allowed_chains.length === 0 || policy.allowed_chains.includes(service.chain) ? 'pass' : 'fail',
    `${service.chain} ${policy.allowed_chains.length === 0 ? 'has no allow-list restriction' : `must be one of ${policy.allowed_chains.join(', ')}`}`
  );
  addCheck(
    'chain_not_blocked',
    'chain not blocked',
    policy.blocked_chains.includes(service.chain) ? 'fail' : 'pass',
    `${service.chain} is ${policy.blocked_chains.includes(service.chain) ? '' : 'not '}blocked`
  );
  addCheck(
    'service_not_blocked',
    'service not blocked',
    policy.blocked_services.includes(service.id) ? 'fail' : 'pass',
    `${service.id} is ${policy.blocked_services.includes(service.id) ? '' : 'not '}blocked`
  );
  addCheck(
    'service_allowed',
    'service allowed',
    policy.allowed_services.length === 0 || policy.allowed_services.includes(service.id) ? 'pass' : 'fail',
    `${service.id} ${policy.allowed_services.length === 0 ? 'has no service allow-list restriction' : `must be one of ${policy.allowed_services.join(', ')}`}`
  );
  addCheck(
    'per_call_budget_respected',
    'per-call budget respected',
    request.requested_cost_usd <= policy.per_call_budget_usd ? 'pass' : 'fail',
    `$${request.requested_cost_usd.toFixed(4)} requested against $${policy.per_call_budget_usd.toFixed(4)} per-call budget`
  );

  const stageGap = MACHINE_EVIDENCE_STAGES.indexOf(policy.minimum_evidence_stage) - MACHINE_EVIDENCE_STAGES.indexOf(service.evidence_stage);
  addCheck(
    'evidence_stage_meets_minimum',
    'evidence stage meets minimum',
    stageGap <= 0 ? 'pass' : stageGap > 1 ? 'fail' : 'review',
    `${service.evidence_stage} compared with minimum ${policy.minimum_evidence_stage}`
  );
  addCheck(
    'evidence_health_meets_minimum',
    'evidence health meets minimum',
    MACHINE_EVIDENCE_HEALTH_ORDER.indexOf(service.evidence_health) >= MACHINE_EVIDENCE_HEALTH_ORDER.indexOf(policy.minimum_evidence_health) ? 'pass' : 'review',
    `${service.evidence_health} compared with minimum ${policy.minimum_evidence_health}`
  );

  addCheck(
    'risk_tolerance_compatible',
    'risk tolerance compatible',
    isHighPolicyRisk(service) && policy.risk_tolerance === 'low' ? 'review' : 'pass',
    `${policy.risk_tolerance} tolerance for policy risk: ${service.policy_risk}`
  );
  addCheck(
    'setup_stage_requires_review',
    'setup stage requires review',
    service.status === 'setup' && request.human_approved !== true ? 'review' : 'pass',
    service.status === 'setup'
      ? request.human_approved === true
        ? 'setup-stage service has explicit human approval override'
        : 'setup-stage service requires review before execution'
      : 'service status is ready'
  );
  addCheck(
    'approval_threshold_respected',
    'approval threshold respected',
    request.requested_cost_usd > policy.approval_required_above_usd ? 'review' : 'pass',
    `$${request.requested_cost_usd.toFixed(4)} requested; review above $${policy.approval_required_above_usd.toFixed(4)}`
  );
  addCheck(
    'receipt_requirement_respected',
    'receipt requirement respected',
    policy.receipt_required && request.receipt_required !== true ? 'review' : 'pass',
    policy.receipt_required ? 'policy requires receipt-backed spend intent' : 'policy does not require receipts'
  );

  const status: MachinePolicyEvaluationStatus = violations.length > 0 ? 'fail' : reviewReasons.length > 0 ? 'review' : 'pass';
  return {
    status,
    checks,
    violations,
    review_reasons: reviewReasons,
    explanation: explainEvaluation(status, service, policy, violations, reviewReasons)
  };
}

type MachinePolicyInput = Omit<
  MachinePolicy,
  | 'allowed_source_markets'
  | 'blocked_categories'
  | 'blocked_source_markets'
  | 'allowed_chains'
  | 'blocked_chains'
  | 'allowed_services'
  | 'blocked_services'
  | 'minimum_evidence_health'
  | 'created_at'
  | 'updated_at'
  | 'status'
> & Partial<Pick<
  MachinePolicy,
  | 'allowed_source_markets'
  | 'blocked_categories'
  | 'blocked_source_markets'
  | 'allowed_chains'
  | 'blocked_chains'
  | 'allowed_services'
  | 'blocked_services'
  | 'minimum_evidence_health'
  | 'status'
>>;

function policy(input: MachinePolicyInput): MachinePolicy {
  return {
    allowed_source_markets: [],
    blocked_categories: [],
    blocked_source_markets: [],
    allowed_chains: [],
    blocked_chains: [],
    allowed_services: [],
    blocked_services: [],
    minimum_evidence_health: 'scaffold',
    created_at: POLICY_TIMESTAMP,
    updated_at: POLICY_TIMESTAMP,
    status: 'active',
    ...input
  };
}

function copyPolicy(policy: MachinePolicy): MachinePolicy {
  return {
    ...policy,
    allowed_categories: [...policy.allowed_categories],
    blocked_categories: [...policy.blocked_categories],
    allowed_source_markets: [...policy.allowed_source_markets],
    blocked_source_markets: [...policy.blocked_source_markets],
    allowed_chains: [...policy.allowed_chains],
    blocked_chains: [...policy.blocked_chains],
    allowed_services: [...policy.allowed_services],
    blocked_services: [...policy.blocked_services],
    human_review_required_for: [...policy.human_review_required_for]
  };
}

function isHighPolicyRisk(service: MachineMarketService): boolean {
  return /\bhigh\b|violate|anti-abuse|captcha/i.test(service.policy_risk);
}

function explainEvaluation(status: MachinePolicyEvaluationStatus, service: MachineMarketService, policy: MachinePolicy, violations: string[], reviewReasons: string[]) {
  if (status === 'fail') return `${policy.name} denies ${service.name}: ${violations.join(', ')}.`;
  if (status === 'review') return `${policy.name} requires review before ${service.name} spend: ${reviewReasons.join(', ')}.`;
  return `${policy.name} allows ${service.name} within the configured bounded authority policy.`;
}

function normalizePolicyId(policyId: string) {
  return policyId.replace(/^template[_:-]/, '').replaceAll('_', '-');
}
