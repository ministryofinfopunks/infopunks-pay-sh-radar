import {
  RadarBundle,
  RadarBundleList,
  RadarBundleStepEvidenceHealth,
  RadarBundleExecutionBoundary,
  RadarBundlePlanBlockedReason,
  RadarBundlePlanConstraints,
  RadarBundlePlanRequest,
  RadarBundlePlanResponse,
  RadarBundlePlanStepStatus
} from '../schemas/entities';
import { buildRadarEvidenceLedger } from './radarBenchmarkService';

type EvidenceLaneStatus = 'recorded' | 'scaffold' | 'unknown';

type BundleStepSeed = {
  step_id: string;
  label: string;
  intent: string;
  candidate_routes: string[];
  evidence_dependencies: string[];
  known_caveats: string[];
  execution_boundary: RadarBundleExecutionBoundary;
};

type BundleSeed = {
  bundle_id: 'morning-briefing' | 'market-research' | 'talent-market-scanner';
  label: string;
  status: RadarBundle['status'];
  summary: string;
  input_schema: Record<string, unknown>;
  output_shape: Record<string, unknown>;
  steps: BundleStepSeed[];
  estimated_cost_usd: string;
  known_caveats: string[];
  evidence_dependencies: string[];
  recommended_agent_action: string;
};

const SOURCE = 'infopunks-pay-sh-radar';

function buildEvidenceIndex() {
  const ledger = buildRadarEvidenceLedger();
  const statusByBenchmarkId = new Map<string, EvidenceLaneStatus>();

  for (const lane of ledger.recorded_lanes) statusByBenchmarkId.set(lane.benchmark_id, 'recorded');
  for (const lane of ledger.scaffold_lanes) statusByBenchmarkId.set(lane.benchmark_id, 'scaffold');

  return statusByBenchmarkId;
}

function evidenceHealthForStep(dependencies: string[], evidenceIndex: Map<string, EvidenceLaneStatus>): RadarBundleStepEvidenceHealth {
  if (dependencies.length === 0) return 'scaffold';
  const statuses = dependencies.map((dependency) => evidenceIndex.get(dependency) ?? 'unknown');
  if (statuses.some((status) => status === 'recorded')) return 'recorded';
  if (statuses.some((status) => status === 'scaffold')) return 'caveated';
  return 'scaffold';
}

function bundleSeeds(): BundleSeed[] {
  return [
    {
      bundle_id: 'morning-briefing',
      label: 'Morning Briefing',
      status: 'recipe_scaffold',
      summary: 'Run a low-cost agent briefing across world news, AI, crypto, and one top-story deep dive.',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string' },
          language: { type: 'string' },
          max_headlines: { type: 'number' }
        }
      },
      output_shape: {
        type: 'object',
        fields: ['headline_digest', 'ai_updates', 'crypto_snapshot', 'deep_dive_summary']
      },
      steps: [
        {
          step_id: 'world_news_search',
          label: 'World News Search',
          intent: 'Search and summarize current world news.',
          candidate_routes: [],
          evidence_dependencies: ['data-web-search-results'],
          known_caveats: [],
          execution_boundary: 'clean_402'
        },
        {
          step_id: 'ai_news_search',
          label: 'AI News Search',
          intent: 'Search and summarize current AI news.',
          candidate_routes: [],
          evidence_dependencies: ['data-web-search-results'],
          known_caveats: [],
          execution_boundary: 'clean_402'
        },
        {
          step_id: 'crypto_market_scan',
          label: 'Crypto Market Scan',
          intent: 'Pull token discovery, metadata, and SOL price context for briefing.',
          candidate_routes: [],
          evidence_dependencies: ['finance-data-sol-price', 'finance-data-token-search', 'finance-data-token-metadata'],
          known_caveats: [],
          execution_boundary: 'clean_402'
        },
        {
          step_id: 'top_story_selection',
          label: 'Top Story Selection',
          intent: 'Select one top story for deeper analysis using prior evidence.',
          candidate_routes: [],
          evidence_dependencies: ['data-web-search-results'],
          known_caveats: ['News-specific route and synthesis benchmark lanes are not yet separately recorded.'],
          execution_boundary: 'billing_unclear'
        },
        {
          step_id: 'deep_dive_synthesis',
          label: 'Deep Dive Synthesis',
          intent: 'Synthesize briefing findings into an agent-ready deep dive.',
          candidate_routes: [],
          evidence_dependencies: ['data-web-search-results'],
          known_caveats: ['News-specific route and synthesis benchmark lanes are not yet separately recorded.'],
          execution_boundary: 'billing_unclear'
        }
      ],
      estimated_cost_usd: '0.02-0.05',
      evidence_dependencies: ['data-web-search-results', 'finance-data-sol-price', 'finance-data-token-search', 'finance-data-token-metadata'],
      known_caveats: ['News-specific routes and synthesis routes are not yet separately recorded benchmarks.'],
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.'
    },
    {
      bundle_id: 'market-research',
      label: 'Market Research',
      status: 'research_only_pending_billing_review',
      summary: 'Research a company, protocol, token, startup, product, or topic using Pay.sh route evidence.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          focus: { type: 'string' },
          depth: { type: 'string' }
        },
        required: ['query']
      },
      output_shape: {
        type: 'object',
        fields: ['entity_profile', 'source_set', 'financial_snapshot', 'competitive_landscape', 'final_synthesis']
      },
      steps: [
        {
          step_id: 'web_research',
          label: 'Web Research',
          intent: 'Collect and normalize public web research results for the topic.',
          candidate_routes: [],
          evidence_dependencies: ['data-web-search-results'],
          known_caveats: [],
          execution_boundary: 'billable_probe_observed'
        },
        {
          step_id: 'entity_enrichment',
          label: 'Entity Enrichment',
          intent: 'Resolve entity metadata and identity context where available.',
          candidate_routes: [],
          evidence_dependencies: ['finance-data-token-search', 'finance-data-token-metadata'],
          known_caveats: [],
          execution_boundary: 'billing_unclear'
        },
        {
          step_id: 'source_extraction',
          label: 'Source Extraction',
          intent: 'Extract attributable claims and supporting sources for downstream synthesis.',
          candidate_routes: [],
          evidence_dependencies: ['data-web-search-results'],
          known_caveats: [],
          execution_boundary: 'billing_unclear'
        },
        {
          step_id: 'financial_or_crypto_snapshot',
          label: 'Financial or Crypto Snapshot',
          intent: 'Attach financial or token market context for the subject.',
          candidate_routes: [],
          evidence_dependencies: ['finance-data-sol-price', 'finance-data-token-search', 'finance-data-token-metadata'],
          known_caveats: [],
          execution_boundary: 'billing_unclear'
        },
        {
          step_id: 'competitive_landscape',
          label: 'Competitive Landscape',
          intent: 'Map adjacent entities and comparison factors from evidence-backed sources.',
          candidate_routes: [],
          evidence_dependencies: ['data-web-search-results'],
          known_caveats: [],
          execution_boundary: 'billable_probe_observed'
        },
        {
          step_id: 'synthesis',
          label: 'Synthesis',
          intent: 'Assemble a research report with caveats and traceable source support.',
          candidate_routes: [],
          evidence_dependencies: ['data-web-search-results'],
          known_caveats: ['Synthesis-specific primitive route evidence is still pending billing review.'],
          execution_boundary: 'billing_unclear'
        }
      ],
      estimated_cost_usd: '0.05-0.20',
      evidence_dependencies: ['data-web-search-results', 'finance-data-token-search', 'finance-data-token-metadata', 'finance-data-sol-price'],
      known_caveats: ['Market Intel primitive research found billing-boundary ambiguity. Some probes returned full data or usage-cost metadata without visible 402 challenge. Treat affected routes as billing_unclear or billable_probe_observed until reviewed.'],
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.'
    },
    {
      bundle_id: 'talent-market-scanner',
      label: 'Talent Market Scanner',
      status: 'recipe_scaffold',
      summary: 'Scan hiring demand, role requirements, salary/context signals, and company hiring surfaces.',
      input_schema: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          location: { type: 'string' },
          seniority: { type: 'string' }
        },
        required: ['role']
      },
      output_shape: {
        type: 'object',
        fields: ['role_demand_snapshot', 'company_targets', 'compensation_context', 'hiring_signal_summary']
      },
      steps: [
        {
          step_id: 'role_search',
          label: 'Role Search',
          intent: 'Search role demand signals across public hiring sources.',
          candidate_routes: [],
          evidence_dependencies: [],
          known_caveats: ['Job and hiring-data routes are not yet recorded primitives.'],
          execution_boundary: 'blocked'
        },
        {
          step_id: 'company_enrichment',
          label: 'Company Enrichment',
          intent: 'Enrich target companies with publicly visible hiring context.',
          candidate_routes: [],
          evidence_dependencies: [],
          known_caveats: ['Hiring enrichment routes are not yet recorded primitives.'],
          execution_boundary: 'blocked'
        },
        {
          step_id: 'public_job_scan',
          label: 'Public Job Scan',
          intent: 'Scan public job surfaces for current openings and trend changes.',
          candidate_routes: [],
          evidence_dependencies: [],
          known_caveats: ['Public job scan routes are not yet recorded primitives.'],
          execution_boundary: 'blocked'
        },
        {
          step_id: 'compensation_context',
          label: 'Compensation Context',
          intent: 'Collect salary and compensation context signals where legally/publicly available.',
          candidate_routes: [],
          evidence_dependencies: [],
          known_caveats: ['Compensation routes are not yet recorded primitives.'],
          execution_boundary: 'blocked'
        },
        {
          step_id: 'hiring_signal_summary',
          label: 'Hiring Signal Summary',
          intent: 'Summarize hiring activity and role-skill demand signals.',
          candidate_routes: [],
          evidence_dependencies: [],
          known_caveats: ['Hiring signal synthesis routes are not yet recorded primitives.'],
          execution_boundary: 'blocked'
        }
      ],
      estimated_cost_usd: '0.03-0.12',
      evidence_dependencies: [],
      known_caveats: ['Job, salary, and hiring-data routes are not yet recorded primitives.'],
      recommended_agent_action: 'Inspect route plan, execution boundaries, and evidence dependencies before spend.'
    }
  ];
}

function buildBundle(seed: BundleSeed, evidenceIndex: Map<string, EvidenceLaneStatus>): RadarBundle {
  const stepItems = seed.steps.map((step) => ({
    ...step,
    evidence_health: evidenceHealthForStep(step.evidence_dependencies, evidenceIndex)
  }));
  const bundleEvidenceReferences = seed.evidence_dependencies.map((benchmark_id) => ({
    benchmark_id,
    lane_status: evidenceIndex.get(benchmark_id) ?? 'unknown'
  }));

  return {
    bundle_id: seed.bundle_id,
    label: seed.label,
    status: seed.status,
    summary: seed.summary,
    input_schema: seed.input_schema,
    output_shape: seed.output_shape,
    steps: stepItems,
    evidence_dependencies: seed.evidence_dependencies,
    evidence_references: bundleEvidenceReferences,
    estimated_cost_usd: seed.estimated_cost_usd,
    known_caveats: seed.known_caveats,
    winner_claimed: false,
    recommended_agent_action: seed.recommended_agent_action
  };
}

export function listRadarBundles(): RadarBundleList {
  const evidenceIndex = buildEvidenceIndex();
  const bundles = bundleSeeds().map((bundle) => buildBundle(bundle, evidenceIndex));

  return {
    generated_at: new Date().toISOString(),
    source: SOURCE,
    count: bundles.length,
    bundles
  };
}

export function getRadarBundleById(bundleId: string): RadarBundle | null {
  const registry = listRadarBundles();
  return registry.bundles.find((bundle) => bundle.bundle_id === bundleId) ?? null;
}

const DEFAULT_PLAN_CONSTRAINTS: Required<Omit<RadarBundlePlanConstraints, 'max_cost_usd'>> & { max_cost_usd: number | null } = {
  max_cost_usd: null,
  allow_billing_unclear: false,
  allow_billable_probe_observed: false,
  allow_scaffold_routes: false,
  require_recorded_evidence: false
};

function normalizePlanConstraints(constraints: RadarBundlePlanRequest['constraints']) {
  return {
    max_cost_usd: constraints?.max_cost_usd ?? DEFAULT_PLAN_CONSTRAINTS.max_cost_usd,
    allow_billing_unclear: constraints?.allow_billing_unclear ?? DEFAULT_PLAN_CONSTRAINTS.allow_billing_unclear,
    allow_billable_probe_observed: constraints?.allow_billable_probe_observed ?? DEFAULT_PLAN_CONSTRAINTS.allow_billable_probe_observed,
    allow_scaffold_routes: constraints?.allow_scaffold_routes ?? DEFAULT_PLAN_CONSTRAINTS.allow_scaffold_routes,
    require_recorded_evidence: constraints?.require_recorded_evidence ?? DEFAULT_PLAN_CONSTRAINTS.require_recorded_evidence
  };
}

export function buildRadarBundlePlan(bundleId: string, input: RadarBundlePlanRequest): RadarBundlePlanResponse | null {
  const bundle = getRadarBundleById(bundleId);
  if (!bundle) return null;

  const constraints = normalizePlanConstraints(input.constraints);
  const blocked_steps: RadarBundlePlanResponse['blocked_steps'] = [];

  const route_plan = bundle.steps.map((step) => {
    const blockedReasons: RadarBundlePlanBlockedReason[] = [];
    let plan_status: RadarBundlePlanStepStatus = 'included';
    let reason = 'Step passes supplied constraints with recorded bundle metadata.';

    if (step.execution_boundary === 'billable_probe_observed' && !constraints.allow_billable_probe_observed) {
      blockedReasons.push('billable_probe_observed_not_allowed');
    }
    if (step.evidence_health === 'scaffold' && !constraints.allow_scaffold_routes) {
      blockedReasons.push('scaffold_not_allowed');
    }
    if (constraints.require_recorded_evidence && step.evidence_health !== 'recorded') {
      blockedReasons.push('missing_recorded_evidence');
    }
    if (step.execution_boundary === 'billing_unclear' && !constraints.allow_billing_unclear) {
      plan_status = 'review_required';
      reason = 'Step requires billing-boundary review before execution under current constraints.';
    }
    if (step.execution_boundary === 'blocked' && !constraints.allow_scaffold_routes) {
      blockedReasons.push('scaffold_not_allowed');
    }

    if (blockedReasons.length > 0) {
      plan_status = 'blocked';
      reason = `Step blocked by constraints: ${blockedReasons.join(', ')}`;
      for (const blockedReason of blockedReasons) blocked_steps.push({ step_id: step.step_id, reason: blockedReason });
    }

    return {
      step_id: step.step_id,
      label: step.label,
      intent: step.intent,
      plan_status,
      evidence_dependencies: step.evidence_dependencies,
      evidence_health: step.evidence_health,
      execution_boundary: step.execution_boundary,
      reason,
      next_action: 'inspect benchmark history before execution'
    };
  });

  const execution_boundary_summary = {
    clean_402: route_plan.filter((step) => step.execution_boundary === 'clean_402').length,
    paid_proven: route_plan.filter((step) => step.execution_boundary === 'paid_proven').length,
    billing_unclear: route_plan.filter((step) => step.execution_boundary === 'billing_unclear').length,
    billable_probe_observed: route_plan.filter((step) => step.execution_boundary === 'billable_probe_observed').length,
    blocked: route_plan.filter((step) => step.plan_status === 'blocked').length
  };
  const evidence_summary = {
    recorded: route_plan.filter((step) => step.evidence_health === 'recorded').length,
    caveated: route_plan.filter((step) => step.evidence_health === 'caveated').length,
    scaffold: route_plan.filter((step) => step.evidence_health === 'scaffold').length,
    unknown: 0
  };

  return {
    bundle_id: bundle.bundle_id,
    label: bundle.label,
    status: bundle.status,
    topic: input.topic,
    focus: input.focus ?? null,
    region: input.region ?? null,
    language: input.language ?? null,
    constraints,
    route_plan,
    blocked_steps,
    execution_boundary_summary,
    evidence_summary,
    estimated_cost_usd: bundle.estimated_cost_usd,
    recommended_agent_action: bundle.recommended_agent_action,
    winner_claimed: false
  };
}
