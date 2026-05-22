import {
  MACHINE_MARKET_PHASE_SCOPE,
  MachineMarketCategory,
  MachineMarketChain,
  MachineMarketEvidenceStage,
  MachineMarketService,
  MachineMarketSource,
  listMachineMarketServices
} from './machineMarketService';
import {
  MachinePolicy,
  MachinePolicyCheck,
  MachinePolicyEvaluation,
  MachinePolicyRiskTolerance,
  compareEvidenceStage,
  evaluateMachinePolicy,
  getMachinePolicyTemplateById
} from './machinePolicyService';
import { evidenceStageRank } from './machineEvidenceService';

export type MachinePreflightDecision = 'allow' | 'deny' | 'review';

export type MachinePreflightRequest = {
  machine_id: string;
  intent: string;
  category: string;
  max_cost_usd?: number;
  allowed_markets?: MachineMarketSource[];
  allowed_chains?: MachineMarketChain[];
  risk_tolerance?: MachinePolicyRiskTolerance;
  requires_receipt?: boolean;
  policy_id?: string;
  minimum_evidence_stage?: MachineMarketEvidenceStage;
};

export type MachinePreflightServiceSummary = {
  id: string;
  name: string;
  provider: string;
  category: MachineMarketCategory;
  source_market: MachineMarketSource;
  chain: MachineMarketChain;
  status: string;
  price_display: string;
  evidence_stage: string;
  evidence_health: string;
  policy_risk: string;
};

export type MachinePreflightReceipt = {
  receipt_id: string;
  receipt_type: 'machine_preflight';
  demo_mode: boolean;
  execution_occurred: false;
  payment_occurred: false;
  machine_id: string;
  policy_id: string | null;
  intent: string;
  requested_category: string;
  selected_service_id: string | null;
  selected_service_name: string | null;
  source_market: MachineMarketSource | null;
  chain: MachineMarketChain | null;
  decision: MachinePreflightDecision;
  reason: string;
  policy_checks: MachinePolicyCheck[];
  violations: string[];
  review_reasons: string[];
  caveats: string[];
  max_cost_usd: number | null;
  evidence_stage: string | null;
  evidence_health: string | null;
  phase_scope: typeof MACHINE_MARKET_PHASE_SCOPE;
  created_at: string;
};

export type MachinePreflightResponse = {
  decision: MachinePreflightDecision;
  recommended_service: MachinePreflightServiceSummary | null;
  source_market: MachineMarketSource | null;
  chain: MachineMarketChain | null;
  reason: string;
  policy_checks: MachinePolicyCheck[];
  violations: string[];
  review_reasons: string[];
  caveats: string[];
  evidence_stage: string | null;
  evidence_health: string | null;
  receipt_id: string;
  receipt_required: boolean;
  phase_scope: typeof MACHINE_MARKET_PHASE_SCOPE;
};

export type MachinePreflightReceiptFilters = {
  decision?: MachinePreflightDecision;
  machine_id?: string;
  service_id?: string;
  source_market?: MachineMarketSource;
  chain?: MachineMarketChain;
  limit?: number;
};

export type MachinePreflightReceiptDetail = MachinePreflightReceipt & {
  selected_service: MachinePreflightServiceSummary | null;
  policy_summary: Pick<MachinePolicy, 'id' | 'name' | 'description' | 'risk_tolerance' | 'receipt_required' | 'minimum_evidence_stage' | 'status'> | null;
};

export type MachineDossier = {
  machine_id: string;
  phase_scope: typeof MACHINE_MARKET_PHASE_SCOPE;
  status: 'observed' | 'no_activity';
  suggested_next_action: string | null;
  summary: {
    total_receipts: number;
    allow_count: number;
    deny_count: number;
    review_count: number;
    unique_services: number;
    unique_categories: number;
    unique_source_markets: number;
    latest_activity_at: string | null;
  };
  policy_profile: {
    active_policy_id: string | null;
    policy_name: string | null;
    risk_tolerance: string | null;
    daily_budget_usd: number | null;
    per_call_budget_usd: number | null;
    allowed_categories: string[];
    allowed_source_markets: string[];
    allowed_chains: string[];
  };
  service_usage: { service_id: string; service_name: string; count: number }[];
  category_usage: { category: string; count: number }[];
  market_usage: { source_market: string; count: number }[];
  chain_usage: { chain: string; count: number }[];
  recent_receipts: MachinePreflightReceipt[];
  caveats: string[];
  evidence_summary: {
    highest_stage_seen: string;
    stage_counts: Record<string, number>;
  };
};

let receiptSequence = 0;
// Development ledger: machine preflight receipts are intentionally process-local
// until the project adds a storage adapter for durable machine decision receipts.
const receipts: MachinePreflightReceipt[] = [];
let demoSeedEnabled = process.env.MACHINE_DEMO_SEED === 'true';
let demoSeeded = false;

type MachineDemoSeedInput = {
  machine_id: string;
  intent: string;
  category: MachineMarketCategory;
  selected_service_id: string;
  selected_service_name: string;
  source_market: MachineMarketSource;
  chain: MachineMarketChain;
  decision: MachinePreflightDecision;
  reason: string;
};

const demoSeedInputs: MachineDemoSeedInput[] = [
  {
    machine_id: 'did:peaq:delivery-bot-01',
    intent: 'parse invoice image into structured fields',
    category: 'vision',
    selected_service_id: 'document-ai',
    selected_service_name: 'Document AI',
    source_market: 'pay.sh',
    chain: 'solana',
    decision: 'allow',
    reason: 'vision task matched a Pay.sh service within bounded authority'
  },
  {
    machine_id: 'did:peaq:field-bot-07',
    intent: 'translate customer delivery note',
    category: 'translation',
    selected_service_id: 'cloud-translation',
    selected_service_name: 'Cloud Translation',
    source_market: 'pay.sh',
    chain: 'solana',
    decision: 'allow',
    reason: 'translation task matched an allowed Pay.sh route'
  },
  {
    machine_id: 'did:peaq:warehouse-camera-03',
    intent: 'upload inspection image',
    category: 'storage',
    selected_service_id: 'stableupload',
    selected_service_name: 'Stableupload',
    source_market: 'pay.sh',
    chain: 'solana',
    decision: 'review',
    reason: 'cost or evidence policy requires review before spend'
  },
  {
    machine_id: 'did:peaq:research-agent-02',
    intent: 'solve captcha challenge',
    category: 'web',
    selected_service_id: '2captcha',
    selected_service_name: '2Captcha',
    source_market: 'agentic.market',
    chain: 'base',
    decision: 'review',
    reason: 'high policy risk requires human review'
  },
  {
    machine_id: 'did:peaq:depin-sensor-09',
    intent: 'run verifiable compute job',
    category: 'compute',
    selected_service_id: 'qvac',
    selected_service_name: 'QVAC',
    source_market: 'robotic.sh',
    chain: 'peaq',
    decision: 'review',
    reason: 'setup-stage service requires review before execution'
  }
];

export function runMachinePreflight(request: MachinePreflightRequest): MachinePreflightResponse {
  ensureMachineDemoReceiptsSeeded();
  const createdAt = new Date().toISOString();
  const policy = buildPolicyForRequest(request, createdAt);
  const requestedCost = request.max_cost_usd ?? policy.per_call_budget_usd;
  const candidates = listMachineMarketServices()
    .filter((service) => service.category === request.category)
    .sort((left, right) => compareCandidate(left, right, request));

  if (candidates.length === 0) {
    return responseFromReceipt(recordReceipt({
      request,
      policy,
      service: null,
      evaluation: null,
      decision: 'deny',
      reason: `No robotic.sh service is listed for requested category ${request.category}.`,
      createdAt
    }));
  }

  const evaluated = candidates.map((service) => ({
    service,
    evaluation: evaluateMachinePolicy(service, policy, {
      machine_id: request.machine_id,
      requested_cost_usd: requestedCost,
      receipt_required: request.requires_receipt ?? true,
      purpose: request.intent
    })
  }));
  const selected = evaluated[0];
  const decision = selected.evaluation.status === 'pass' ? 'allow' : selected.evaluation.status === 'review' ? 'review' : 'deny';

  return responseFromReceipt(recordReceipt({
    request,
    policy,
    service: selected.service,
    evaluation: selected.evaluation,
    decision,
    reason: machinePreflightReason(decision, selected.service, selected.evaluation),
    createdAt
  }));
}

export function listRecentMachinePreflightReceipts(filters: MachinePreflightReceiptFilters = {}): MachinePreflightReceipt[] {
  ensureMachineDemoReceiptsSeeded();
  const limit = Math.max(1, Math.min(filters.limit ?? 25, 100));
  return [...receipts]
    .filter((receipt) => !filters.decision || receipt.decision === filters.decision)
    .filter((receipt) => !filters.machine_id || receipt.machine_id === filters.machine_id)
    .filter((receipt) => !filters.service_id || receipt.selected_service_id === filters.service_id)
    .filter((receipt) => !filters.source_market || receipt.source_market === filters.source_market)
    .filter((receipt) => !filters.chain || receipt.chain === filters.chain)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at) || right.receipt_id.localeCompare(left.receipt_id))
    .slice(0, limit)
    .map(copyReceipt);
}

export function getMachinePreflightReceiptById(receiptId: string): MachinePreflightReceiptDetail | null {
  ensureMachineDemoReceiptsSeeded();
  const receipt = receipts.find((item) => item.receipt_id === receiptId);
  if (!receipt) return null;
  const service = receipt.selected_service_id ? serviceById(receipt.selected_service_id) : null;
  const policy = receipt.policy_id ? getMachinePolicyTemplateById(receipt.policy_id) : null;
  return {
    ...copyReceipt(receipt),
    selected_service: service ? summarizeService(service) : null,
    policy_summary: policy ? {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      risk_tolerance: policy.risk_tolerance,
      receipt_required: policy.receipt_required,
      minimum_evidence_stage: policy.minimum_evidence_stage,
      status: policy.status
    } : null
  };
}

export function buildMachineDossier(machineId: string): MachineDossier {
  ensureMachineDemoReceiptsSeeded();
  const machineReceipts = listRecentMachinePreflightReceipts({ machine_id: machineId, limit: 100 });
  const latest = machineReceipts[0] ?? null;
  const policy = latest?.policy_id ? getMachinePolicyTemplateById(latest.policy_id) : null;
  const stages = machineReceipts.map((receipt) => receipt.evidence_stage).filter((stage): stage is string => Boolean(stage));
  const highestStage = stages.sort((left, right) => evidenceStageRank(right) - evidenceStageRank(left))[0] ?? 'none';
  return {
    machine_id: machineId,
    phase_scope: MACHINE_MARKET_PHASE_SCOPE,
    status: machineReceipts.length ? 'observed' : 'no_activity',
    suggested_next_action: machineReceipts.length ? null : 'Run machine preflight to create the first Radar-observed receipt.',
    summary: {
      total_receipts: machineReceipts.length,
      allow_count: machineReceipts.filter((receipt) => receipt.decision === 'allow').length,
      deny_count: machineReceipts.filter((receipt) => receipt.decision === 'deny').length,
      review_count: machineReceipts.filter((receipt) => receipt.decision === 'review').length,
      unique_services: new Set(machineReceipts.map((receipt) => receipt.selected_service_id).filter(Boolean)).size,
      unique_categories: new Set(machineReceipts.map((receipt) => receipt.requested_category).filter(Boolean)).size,
      unique_source_markets: new Set(machineReceipts.map((receipt) => receipt.source_market).filter(Boolean)).size,
      latest_activity_at: latest?.created_at ?? null
    },
    policy_profile: {
      active_policy_id: policy?.id ?? latest?.policy_id ?? null,
      policy_name: policy?.name ?? null,
      risk_tolerance: policy?.risk_tolerance ?? null,
      daily_budget_usd: policy?.daily_budget_usd ?? null,
      per_call_budget_usd: policy?.per_call_budget_usd ?? null,
      allowed_categories: policy?.allowed_categories ?? [],
      allowed_source_markets: policy?.allowed_source_markets ?? [],
      allowed_chains: policy?.allowed_chains ?? []
    },
    service_usage: countUsage(machineReceipts, (receipt) => receipt.selected_service_id, (receipt) => receipt.selected_service_name ?? receipt.selected_service_id ?? 'unknown', 'service_id', 'service_name'),
    category_usage: countSimpleUsage(machineReceipts, (receipt) => receipt.requested_category, 'category'),
    market_usage: countSimpleUsage(machineReceipts, (receipt) => receipt.source_market, 'source_market'),
    chain_usage: countSimpleUsage(machineReceipts, (receipt) => receipt.chain, 'chain'),
    recent_receipts: machineReceipts.slice(0, 20),
    caveats: [
      'This dossier represents Radar-observed machine preflight decisions only.',
      'It does not verify live peaqOS identity, wallet ownership, payment execution, or physical-world robot activity.',
      'Receipts record whether a machine should spend before any service call occurs.',
      ...(machineReceipts.some((receipt) => receipt.demo_mode) ? ['This dossier includes demo preflight receipts. It does not verify physical-world machine activity.'] : [])
    ],
    evidence_summary: {
      highest_stage_seen: highestStage,
      stage_counts: stages.reduce<Record<string, number>>((counts, stage) => {
        counts[stage] = (counts[stage] ?? 0) + 1;
        return counts;
      }, {})
    }
  };
}

export function clearMachinePreflightReceiptsForTests() {
  receipts.splice(0, receipts.length);
  receiptSequence = 0;
  demoSeeded = false;
  demoSeedEnabled = false;
}

export function setMachineDemoSeedEnabledForTests(enabled: boolean) {
  demoSeedEnabled = enabled;
  demoSeeded = false;
}

export function configureMachineDemoSeed(enabled: boolean) {
  demoSeedEnabled = enabled;
  if (!enabled) demoSeeded = false;
}

function buildPolicyForRequest(request: MachinePreflightRequest, timestamp: string): MachinePolicy {
  const template = request.policy_id ? getMachinePolicyTemplateById(request.policy_id) : null;
  const base: MachinePolicy = template ?? {
    id: `ephemeral:${request.machine_id}`,
    name: 'Ephemeral Machine Preflight Policy',
    description: 'Ephemeral policy derived from machine preflight request constraints.',
    machine_id: request.machine_id,
    owner_label: 'Machine Preflight Request',
    daily_budget_usd: request.max_cost_usd ?? 0,
    per_call_budget_usd: request.max_cost_usd ?? Number.MAX_SAFE_INTEGER,
    allowed_categories: isMachineMarketCategory(request.category) ? [request.category] : [],
    blocked_categories: [],
    allowed_source_markets: [],
    blocked_source_markets: [],
    allowed_chains: [],
    blocked_chains: [],
    allowed_services: [],
    blocked_services: [],
    approval_required_above_usd: request.max_cost_usd ?? Number.MAX_SAFE_INTEGER,
    minimum_evidence_stage: request.minimum_evidence_stage ?? 'policy-mapped',
    minimum_evidence_health: 'scaffold',
    risk_tolerance: request.risk_tolerance ?? 'medium',
    receipt_required: request.requires_receipt ?? true,
    human_review_required_for: ['approval_threshold', 'high_policy_risk', 'evidence_gap'],
    created_at: timestamp,
    updated_at: timestamp,
    status: 'draft'
  };

  return {
    ...base,
    machine_id: request.machine_id,
    allowed_categories: isMachineMarketCategory(request.category) ? mergeAllowed(base.allowed_categories, [request.category]) : [...base.allowed_categories],
    allowed_source_markets: request.allowed_markets?.length ? mergeAllowed(base.allowed_source_markets, request.allowed_markets) : [...base.allowed_source_markets],
    allowed_chains: request.allowed_chains?.length ? mergeAllowed(base.allowed_chains, request.allowed_chains) : [...base.allowed_chains],
    per_call_budget_usd: request.max_cost_usd ?? base.per_call_budget_usd,
    approval_required_above_usd: request.max_cost_usd ?? base.approval_required_above_usd,
    minimum_evidence_stage: request.minimum_evidence_stage ?? base.minimum_evidence_stage,
    risk_tolerance: request.risk_tolerance ?? base.risk_tolerance,
    receipt_required: request.requires_receipt ?? base.receipt_required
  };
}

function mergeAllowed<T>(policyValues: T[], requestValues: T[]) {
  if (policyValues.length === 0) return [...requestValues];
  const requestSet = new Set(requestValues);
  return policyValues.filter((value) => requestSet.has(value));
}

function compareCandidate(left: MachineMarketService, right: MachineMarketService, request: MachinePreflightRequest) {
  return candidateScore(right, request) - candidateScore(left, request);
}

function candidateScore(service: MachineMarketService, request: MachinePreflightRequest) {
  const marketAllowed = !request.allowed_markets?.length || request.allowed_markets.includes(service.source_market);
  const chainAllowed = !request.allowed_chains?.length || request.allowed_chains.includes(service.chain);
  const marketScore = marketAllowed ? 100 : 0;
  const chainScore = chainAllowed ? 100 : 0;
  const phase2Score = service.source_market === 'pay.sh' ? 40 : service.source_market === 'robotic.sh' ? 20 : 0;
  const intentScore = intentRelevance(service, request.intent) * 25;
  const riskScore = (3 - policyRiskRank(service)) * 8;
  const evidenceScore = Math.max(0, compareEvidenceStage(service.evidence_stage, 'listed')) * 3;
  return marketScore + chainScore + phase2Score + intentScore + riskScore + evidenceScore;
}

function intentRelevance(service: MachineMarketService, intent: string) {
  const haystack = `${service.name} ${service.provider} ${service.category} ${service.description} ${service.machine_use_case} ${service.policy_risk}`.toLowerCase();
  const terms = intent.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function policyRiskRank(service: MachineMarketService) {
  if (/\bhigh\b|violate|anti-abuse|captcha/i.test(service.policy_risk)) return 2;
  if (/review|approval|leak|alter|persist|retention|provenance/i.test(service.policy_risk)) return 1;
  return 0;
}

function machinePreflightReason(decision: MachinePreflightDecision, service: MachineMarketService, evaluation: MachinePolicyEvaluation) {
  if (decision === 'allow') return `${service.name} is the recommended preflight route. ${evaluation.explanation}`;
  if (decision === 'review') return `${service.name} requires human review before machine spend. ${evaluation.explanation}`;
  return `${service.name} is denied for this machine preflight. ${evaluation.explanation}`;
}

function recordReceipt(input: {
  request: MachinePreflightRequest;
  policy: MachinePolicy;
  service: MachineMarketService | null;
  evaluation: MachinePolicyEvaluation | null;
  decision: MachinePreflightDecision;
  reason: string;
  createdAt: string;
}) {
  const receipt: MachinePreflightReceipt = {
    receipt_id: nextReceiptId(input.createdAt),
    receipt_type: 'machine_preflight',
    demo_mode: false,
    execution_occurred: false,
    payment_occurred: false,
    machine_id: input.request.machine_id,
    policy_id: input.request.policy_id ?? input.policy.id,
    intent: input.request.intent,
    requested_category: input.request.category,
    selected_service_id: input.service?.id ?? null,
    selected_service_name: input.service?.name ?? null,
    source_market: input.service?.source_market ?? null,
    chain: input.service?.chain ?? null,
    decision: input.decision,
    reason: input.reason,
    policy_checks: input.evaluation?.checks ?? [],
    violations: input.evaluation?.violations ?? [],
    review_reasons: input.evaluation?.review_reasons ?? [],
    caveats: [
      'Machine preflight only. No service was executed.',
      'No Pay.sh call was made and no payment occurred.',
      ...(input.service?.caveats ?? [])
    ],
    max_cost_usd: input.request.max_cost_usd ?? null,
    evidence_stage: input.service?.evidence_stage ?? null,
    evidence_health: input.service?.evidence_health ?? null,
    phase_scope: MACHINE_MARKET_PHASE_SCOPE,
    created_at: input.createdAt
  };
  receipts.push(receipt);
  return copyReceipt(receipt);
}

function responseFromReceipt(receipt: MachinePreflightReceipt): MachinePreflightResponse {
  const service = receipt.selected_service_id ? serviceById(receipt.selected_service_id) : null;
  return {
    decision: receipt.decision,
    recommended_service: service ? summarizeService(service) : null,
    source_market: receipt.source_market,
    chain: receipt.chain,
    reason: receipt.reason,
    policy_checks: receipt.policy_checks,
    violations: receipt.violations,
    review_reasons: receipt.review_reasons,
    caveats: receipt.caveats,
    evidence_stage: receipt.evidence_stage,
    evidence_health: receipt.evidence_health,
    receipt_id: receipt.receipt_id,
    receipt_required: true,
    phase_scope: receipt.phase_scope
  };
}

function serviceById(serviceId: string) {
  return listMachineMarketServices().find((service) => service.id === serviceId) ?? null;
}

function summarizeService(service: MachineMarketService): MachinePreflightServiceSummary {
  return {
    id: service.id,
    name: service.name,
    provider: service.provider,
    category: service.category,
    source_market: service.source_market,
    chain: service.chain,
    status: service.status,
    price_display: service.price_display,
    evidence_stage: service.evidence_stage,
    evidence_health: service.evidence_health,
    policy_risk: service.policy_risk
  };
}

function isMachineMarketCategory(category: string): category is MachineMarketCategory {
  return ['compute', 'inference', 'web', 'vision', 'storage', 'translation'].includes(category);
}

function nextReceiptId(createdAt: string) {
  receiptSequence += 1;
  const compactTimestamp = createdAt.replace(/[^0-9]/g, '').slice(0, 17);
  return `mrx_${compactTimestamp}_${receiptSequence.toString().padStart(4, '0')}`;
}

function copyReceipt(receipt: MachinePreflightReceipt): MachinePreflightReceipt {
  return {
    ...receipt,
    policy_checks: receipt.policy_checks.map((check) => ({ ...check })),
    violations: [...receipt.violations],
    review_reasons: [...receipt.review_reasons],
    caveats: [...receipt.caveats]
  };
}

function ensureMachineDemoReceiptsSeeded() {
  if (!demoSeedEnabled || demoSeeded) return;
  const seen = new Set(receipts.map((receipt) => receipt.receipt_id));
  const baseMs = Date.parse('2026-05-22T00:00:00.000Z');
  for (let i = 0; i < demoSeedInputs.length; i += 1) {
    const seed = demoSeedInputs[i];
    const receiptId = `mrx_demo_${seed.machine_id.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
    if (seen.has(receiptId) || receipts.some((receipt) => receipt.machine_id === seed.machine_id && receipt.intent === seed.intent && receipt.demo_mode)) continue;
    const service = serviceById(seed.selected_service_id);
    const createdAt = new Date(baseMs + i * 60_000).toISOString();
    receipts.push({
      receipt_id: receiptId,
      receipt_type: 'machine_preflight',
      demo_mode: true,
      execution_occurred: false,
      payment_occurred: false,
      machine_id: seed.machine_id,
      policy_id: null,
      intent: seed.intent,
      requested_category: seed.category,
      selected_service_id: seed.selected_service_id,
      selected_service_name: seed.selected_service_name,
      source_market: seed.source_market,
      chain: seed.chain,
      decision: seed.decision,
      reason: seed.reason,
      policy_checks: [],
      violations: [],
      review_reasons: seed.decision === 'review' ? ['demo_review_required'] : [],
      caveats: [
        'Demo preflight receipt. No service execution occurred.',
        'No Pay.sh call was made and no payment occurred.',
        'This is demo-mode data for local explainability only.',
        ...(service?.caveats ?? [])
      ],
      max_cost_usd: null,
      evidence_stage: service?.evidence_stage ?? null,
      evidence_health: service?.evidence_health ?? null,
      phase_scope: MACHINE_MARKET_PHASE_SCOPE,
      created_at: createdAt
    });
    seen.add(receiptId);
  }
  demoSeeded = true;
}

function countSimpleUsage<T, K extends string>(items: T[], getKey: (item: T) => string | null, keyName: K): Array<Record<K, string> & { count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ [keyName]: key, count }) as Record<K, string> & { count: number });
}

function countUsage<T, IK extends string, LK extends string>(items: T[], getId: (item: T) => string | null, getLabel: (item: T) => string, idName: IK, labelName: LK): Array<Record<IK | LK, string> & { count: number }> {
  const counts = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    const id = getId(item);
    if (!id) continue;
    const current = counts.get(id) ?? { label: getLabel(item), count: 0 };
    current.count += 1;
    counts.set(id, current);
  }
  return [...counts.entries()].sort((a, b) => b[1].count - a[1].count).map(([id, value]) => ({ [idName]: id, [labelName]: value.label, count: value.count }) as Record<IK | LK, string> & { count: number });
}
