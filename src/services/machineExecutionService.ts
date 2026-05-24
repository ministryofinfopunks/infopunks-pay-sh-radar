import { appendMachineReceipt, listRecentMachinePreflightReceipts, runMachinePreflight, type MachinePreflightReceipt } from './machinePreflightService';
import { getMachineMarketServiceById, listMachineMarketServices } from './machineMarketService';
import { getMachineExecutionProofProfile, validateMachineExecutionProofByProfile } from './machineExecutionProofProfiles';

export type TranslationExecutionRequest = {
  machine_id: string;
  policy_id: string;
  text: string;
  source_language: string;
  target_language: string;
  max_cost_usd: number;
  human_approved?: boolean;
  minimum_evidence_stage?: 'policy-mapped' | 'preflight-ready' | 'execution-tested' | 'receipt-recorded' | 'benchmark-recorded';
};

export type TranslationExecutionResponse = {
  decision: 'allow' | 'deny' | 'review';
  preflight_receipt_id: string;
  execution_receipt_id: string | null;
  execution_status: 'not_attempted' | 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  payment_occurred: boolean;
  payment_evidence: string | null;
  service_id: 'anytrans';
  fqn: 'solana-foundation/alibaba/anytrans';
  source_market: 'pay.sh';
  chain: 'solana';
  category: 'translation';
  service_url: 'https://anytrans.alibaba.gateway-402.com';
  endpoint_path: 'anytrans/translate/text';
  method: 'POST';
  price_display: '$0.001/request';
  evidence_stage_after: 'policy-mapped' | 'execution-tested';
  caveats: string[];
};

export type AnyTransExecutionArtifactIngestRequest = {
  machine_id: string;
  service_id: 'anytrans';
  fqn: 'solana-foundation/alibaba/anytrans';
  source_market: 'pay.sh';
  chain: 'solana';
  preflight_receipt_id?: string | null;
  execution_status: 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  payment_occurred: boolean;
  payment_evidence: unknown | null;
  execution_started_at: string;
  execution_completed_at: string;
  execution_latency_ms: number;
  request_summary: Record<string, unknown>;
  response_summary: Record<string, unknown> | null;
  executor: { name: string; version?: string | null; mode: 'pay_cli' | 'x402' | 'manual' };
  artifact_signature?: string | null;
};

export type AnyTransExecutionArtifactIngestResponse = {
  accepted: true;
  receipt_id: string;
  service_id: 'anytrans';
  execution_status: 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  payment_occurred: boolean;
  payment_evidence: unknown | null;
  evidence_stage_after: 'policy-mapped' | 'execution-tested';
  caveats: string[];
};

export type AlibabaMachineTranslationGeneralArtifactIngestRequest = {
  machine_id: string;
  service_id: 'alibaba-machine-translation-general';
  fqn: 'solana-foundation/alibaba/machinetranslation';
  source_market: 'pay.sh';
  chain: 'solana';
  preflight_receipt_id?: string | null;
  execution_status: 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  payment_occurred: boolean;
  payment_evidence: unknown | null;
  execution_started_at: string;
  execution_completed_at: string;
  execution_latency_ms: number;
  request_summary: Record<string, unknown>;
  response_summary: Record<string, unknown> | null;
  executor: { name: string; version?: string | null; mode: 'pay_cli' | 'x402' | 'manual' };
  artifact_signature?: string | null;
};

export type AlibabaMachineTranslationGeneralArtifactIngestResponse = {
  accepted: true;
  receipt_id: string;
  service_id: 'alibaba-machine-translation-general';
  execution_status: 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  payment_occurred: boolean;
  payment_evidence: unknown | null;
  evidence_stage_after: 'policy-mapped' | 'execution-tested';
  caveats: string[];
};

export type AlibabaMachineTranslationGeneralRepeatabilityArtifact = {
  artifact_id: string;
  generated_at: string;
  service_id: 'alibaba-machine-translation-general';
  fqn: 'solana-foundation/alibaba/machinetranslation';
  source_market: 'pay.sh';
  chain: 'solana';
  route_name: 'Alibaba Machine Translation General';
  route_status: 'execution-tested';
  receipt_count: number;
  successful_receipts: number;
  failed_receipts: number;
  success_rate: number;
  latency_ms: { min: number | null; median: number | null; max: number | null };
  prompt_family: string;
  input_summary: string[];
  output_summaries: string[];
  provider_request_ids: string[];
  receipt_ids: string[];
  receipt_rows: {
    receipt_id: string;
    provider_request_id: string | null;
    latency_ms: number | null;
    created_at: string;
    output_preview: string | null;
    execution_status: MachinePreflightReceipt['execution_status'];
    execution_occurred: boolean;
    payment_occurred: boolean;
    evidence_stage: string | null;
  }[];
  payment_occurred_any: boolean;
  payment_claimed: false;
  benchmark_claimed: false;
  winner_claimed: false;
  evidence_stage: 'execution-tested' | 'repeatability-recorded';
  repeatability_status: 'insufficient_runs' | 'repeatability-recorded';
  remaining_successful_runs_needed: number;
  caveats: string[];
};

export type AlibabaMachineTranslationGeneralBenchmarkReadinessArtifact = {
  route_id: 'solana-foundation/alibaba/machinetranslation';
  route_name: 'Alibaba Machine Translation General';
  service_id: 'alibaba-machine-translation-general';
  fqn: 'solana-foundation/alibaba/machinetranslation';
  source_market: 'pay.sh';
  chain: 'solana';
  generated_at: string;
  current_evidence_stage: 'execution-tested' | 'repeatability-recorded';
  benchmark_readiness_status: 'criteria-defined' | 'single-route-repeatability-ready' | 'comparison-not-ready';
  benchmark_ready: boolean;
  criteria: Array<{
    id:
    | 'minimum_successful_receipts'
    | 'maximum_failure_rate'
    | 'same_prompt_family'
    | 'latency_reporting_present'
    | 'durable_receipts_present'
    | 'payment_policy_defined'
    | 'comparison_policy_defined'
    | 'winner_claim_policy_defined'
    | 'artifact_schema_defined';
    required: number | boolean | string;
    actual: number | boolean | string;
    satisfied: boolean;
  }>;
  satisfied_criteria_count: number;
  total_criteria_count: number;
  missing_criteria: string[];
  benchmark_artifact_schema: {
    benchmark_id: string;
    route_id: string;
    prompt_family: string;
    run_count: number;
    success_rate: number;
    latency_ms: { min: number | null; median: number | null; max: number | null };
    payment_evidence_policy: string;
    comparison_routes: string[];
    winner_claimed: boolean;
    winner_criteria: string;
    caveats: string[];
    receipt_ids: string[];
  };
  caveats: string[];
  claims: {
    benchmark_claimed: false;
    winner_claimed: false;
    payment_claimed: false;
    benchmark_recorded: false;
  };
};

export type MachineExecutionReceiptIngestRequest = {
  machine_id: string;
  service_id: string;
  fqn: string;
  source_market: 'pay.sh' | 'robotic.sh' | 'agentic.market';
  chain: 'solana' | 'base' | 'peaq' | 'omnichain' | 'unknown';
  preflight_receipt_id?: string | null;
  execution_status: 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  payment_occurred: boolean;
  payment_evidence: unknown | null;
  execution_started_at: string;
  execution_completed_at: string;
  execution_latency_ms: number;
  request_summary: Record<string, unknown>;
  response_summary: Record<string, unknown> | null;
  executor: { name: string; version?: string | null; mode: 'pay_cli' | 'x402' | 'manual' };
  artifact_signature?: string | null;
};

export type MachineExecutionReceiptIngestResponse = {
  accepted: true;
  receipt_id: string;
  service_id: string;
  execution_status: 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  payment_occurred: boolean;
  payment_status: 'not_confirmed' | 'confirmed';
  payment_evidence: unknown | null;
  evidence_stage_after: 'policy-mapped' | 'execution-tested';
  caveats: string[];
};

export type BigQueryBoundedQueryFixtureOptions = {
  machine_id?: string;
  execution_completed_at?: string;
};
export type BigQueryLiveBoundedQueryRequest = {
  machine_id: string;
  query: string;
  query_label: string;
  row_limit: number;
  dataset_classification: 'public' | 'synthetic' | 'explicitly_safe';
  payment_evidence?: unknown | null;
};
export type BigQueryLiveBoundedQueryResponse =
  | {
    status: 'blocked';
    reason: string;
    blockers: string[];
    claim_posture: {
      execution_claim: false;
      payment_success_claim: false;
      benchmark_claim: false;
      winner_claim: false;
    };
  }
  | {
    status: 'succeeded';
    proof_profile: 'bigquery_bounded_query';
    receipt_id: string;
    service_id: 'bigquery';
    payment_status: 'not_confirmed' | 'confirmed';
    claim_posture: {
      execution_claim: false;
      payment_success_claim: boolean;
      benchmark_claim: false;
      winner_claim: false;
    };
    caveats: string[];
  };
export type MachineExecutionRepeatabilityPack = {
  repeatability_pack_id: string;
  service_id: string;
  route_id: string;
  profile_id: 'machine_translation_safe_phrase' | 'bigquery_bounded_query';
  run_count: number;
  successful_runs: number;
  failed_runs: number;
  success_rate: number;
  receipt_ids: string[];
  generated_at: string;
  payment_status_summary: {
    confirmed_count: number;
    not_confirmed_count: number;
    payment_success_claim: 0 | 1;
  };
  live_harness_execution_summary?: {
    live_receipt_count: number;
    fixture_receipt_count: number;
    unknown_receipt_count: number;
  };
  repeatability_status: 'insufficient_runs' | 'repeatability_candidate' | 'repeatability_recorded';
  benchmark_claim: false;
  winner_claim: false;
  market_wide_execution_claim: false;
  caveats: string[];
};
export type MachineBenchmarkReadinessLane = {
  lane_id: 'machine_translation' | 'data_query_bigquery' | 'storage_stableupload' | 'navigation_naver_geocode';
  task_class: string;
  candidate_routes: Array<{ service_id: string; route_id: string; profile_id: string }>;
  comparable_route_count: number;
  repeatability_state: 'missing' | 'single_route_repeatability_ready' | 'repeatability_recorded';
  missing_requirements: string[];
  readiness_status: 'not_ready' | 'single_route_repeatability_ready' | 'comparable_routes_missing' | 'methodology_missing' | 'artifact_schema_ready' | 'benchmark_ready';
  next_action: string;
  caveats: string[];
};
export type MachineBenchmarkReadinessReport = {
  generated_at: string;
  benchmark_claims: 0;
  winner_claims: 0;
  market_wide_execution_claims: 0;
  payment_success_claims: number;
  lanes: MachineBenchmarkReadinessLane[];
  caveats: string[];
};
export type MachineComparableRoute = {
  lane_id: 'machine_translation' | 'data_query_bigquery' | 'storage_stableupload' | 'navigation_naver_geocode';
  task_class: string;
  candidate_routes: Array<{ service_id: string; route_id: string; profile_id: string }>;
  comparable_route_count: number;
  required_methodology: string[];
  missing_methodology: string[];
  comparable_inputs: string;
  comparable_outputs: string;
  normalization_strategy: string;
  success_criteria: string;
  run_count_target: number;
  cost_latency_fields_required: string[];
  safety_constraints: string[];
  readiness_effect: string;
  next_action: string;
};
export type MachineComparableRouteDiscovery = {
  generated_at: string;
  benchmark_claims: 0;
  winner_claims: 0;
  lanes: MachineComparableRoute[];
  caveats: string[];
};
export type MachineBenchmarkMethodologyArtifact = {
  benchmark_id: string;
  lane_id: 'machine_translation' | 'data_query_bigquery' | 'storage_stableupload' | 'navigation_naver_geocode';
  task_class: string;
  routes_compared: Array<{ service_id: string; route_id: string; profile_id: string }>;
  input_set: string;
  normalization_strategy: string;
  success_criteria: string;
  run_count: number;
  cost_fields: string[];
  latency_fields: string[];
  payment_fields: string[];
  safety_constraints: string[];
  policy_constraints: string[];
  comparable_route_count: number;
  readiness_status: MachineBenchmarkReadinessLane['readiness_status'];
  methodology_status: 'missing_comparable_routes' | 'methodology_incomplete' | 'schema_present' | 'ready_for_benchmark_artifact';
  artifact_status: 'scaffold' | 'methodology_ready' | 'benchmark_recorded';
  winner_policy: 'no_winner_default' | 'explicit_criteria_required' | 'no_clear_winner_allowed';
  winner_claim: false;
  benchmark_claim: false;
  methodology_artifact_schema: 'present';
  output_normalization: string;
  run_count_target: number;
  cost_fields_required: string[];
  latency_fields_required: string[];
  payment_fields_required: string[];
  missing_requirements: string[];
  benchmark_allowed: boolean;
  caveats: string[];
  generated_at: string;
};
export type MachineBenchmarkMethodologyArtifactsReport = {
  generated_at: string;
  artifact_schema_version: string;
  methodology_artifacts: MachineBenchmarkMethodologyArtifact[];
  global_gate: {
    benchmark_execution_allowed: boolean;
    reason: string;
    required_conditions: string[];
  };
  caveats: string[];
};
export type StableuploadTinyFixtureOptions = {
  machine_id?: string;
  execution_completed_at?: string;
};
export type NaverGeocodeFixtureOptions = {
  machine_id?: string;
  execution_completed_at?: string;
};

type TranslationAdapterResult = {
  execution_status: 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  payment_occurred: boolean;
  payment_evidence: string | null;
  execution_response_summary: string | null;
  execution_error: string | null;
  caveats: string[];
};

type TranslationExecutionMode = 'disabled' | 'http_direct' | 'x402_server' | 'mock_test';

const ANYTRANS_META = {
  service_id: 'anytrans' as const,
  fqn: 'solana-foundation/alibaba/anytrans' as const,
  source_market: 'pay.sh' as const,
  chain: 'solana' as const,
  category: 'translation' as const,
  service_url: 'https://anytrans.alibaba.gateway-402.com' as const,
  endpoint_path: 'anytrans/translate/text' as const,
  method: 'POST' as const,
  price_display: '$0.001/request' as const
};

const ALIBABA_MACHINE_TRANSLATION_GENERAL_META = {
  service_id: 'alibaba-machine-translation-general' as const,
  fqn: 'solana-foundation/alibaba/machinetranslation' as const,
  source_market: 'pay.sh' as const,
  chain: 'solana' as const,
  category: 'translation' as const,
  service_url: 'https://machinetranslation.alibaba.gateway-402.com' as const,
  endpoint_path: 'api/translate/web/general' as const,
  method: 'POST' as const,
  price_display: '$0.001/request' as const
};

const REQUIRED_CAVEATS = [
  'Execution-tested applies only to the AnyTrans translation execution candidate.',
  'This is not a benchmark artifact.',
  'No winner is claimed.',
  'Payment receipt is not claimed unless payment evidence is present.'
];

const GENERAL_REQUIRED_CAVEATS = [
  'Execution-tested applies only to Alibaba Machine Translation General after Radar records the successful execution receipt.',
  'This is not a benchmark artifact.',
  'No winner is claimed.',
  'Payment receipt is not claimed unless payment evidence is present.'
];

const MACHINE_EXECUTION_RECEIPT_REQUIRED_CAVEATS = [
  'Service-specific execution receipt only.',
  'Not market-wide proof.',
  'Not payment proof.',
  'Not benchmark proof.',
  'Not winner proof.'
];
const BIGQUERY_BLOCKED_CLAIM_POSTURE = {
  execution_claim: false,
  payment_success_claim: false,
  benchmark_claim: false,
  winner_claim: false
} as const;

type BigQueryHarnessGateState = {
  configured: boolean;
  reasons: string[];
};

export function deprecatedCloudTranslationExecutionResponse() {
  return {
    error: 'catalog_endpoint_unavailable',
    service_id: 'cloud-translation',
    execution_status: 'failed',
    execution_occurred: false,
    payment_occurred: false,
    evidence_stage_after: 'policy-mapped',
    caveats: [
      'Google Cloud Translation remains listed metadata only in this phase.',
      'Catalog endpoint unavailable for runnable execution in current catalog state (0 endpoints).',
      'Do not mark Cloud Translation as execution-tested.'
    ]
  } as const;
}

export async function ingestMachineExecutionReceipt(input: MachineExecutionReceiptIngestRequest): Promise<MachineExecutionReceiptIngestResponse> {
  const scopeService = getMachineMarketServiceById(input.service_id) ?? getMachineMarketServiceById('cloud-translation');
  if (!scopeService) throw new Error('machine_execution_scope_service_not_found');
  const proofValidation = validateMachineExecutionProofByProfile({
    service_id: input.service_id,
    execution_status: input.execution_status,
    execution_occurred: input.execution_occurred,
    response_summary: input.response_summary
  });
  const caveats = [
    ...MACHINE_EXECUTION_RECEIPT_REQUIRED_CAVEATS,
    ...proofValidation.profile.default_caveats,
    `Proof profile: ${proofValidation.profile.profile_id}.`
  ];
  const hasPaymentEvidence = input.payment_evidence != null;
  const paymentOccurred = input.payment_occurred && hasPaymentEvidence;
  if (input.payment_occurred && !hasPaymentEvidence) caveats.push('Payment receipt is not claimed unless payment evidence is present.');

  const isExecutionTested = proofValidation.success_proof_eligible;
  if (input.execution_status === 'succeeded' && proofValidation.issues.length > 0) {
    caveats.push(`Execution success claim rejected for execution-tested because ${proofValidation.issues.join('; ')}.`);
  }
  if (input.execution_status !== 'succeeded') caveats.push('Failed or non-success execution artifacts do not become execution-tested.');

  const receiptAt = input.execution_completed_at;
  const receipt = await appendMachineReceipt({
    receipt_id: nextReceiptId(receiptAt),
    receipt_type: 'machine_execution',
    coverage_run_id: null,
    demo_mode: false,
    execution_occurred: input.execution_occurred,
    payment_occurred: paymentOccurred,
    execution_status: input.execution_status,
    execution_service_id: input.service_id,
    execution_provider: providerFromFqn(input.fqn),
    execution_started_at: input.execution_started_at,
    execution_completed_at: input.execution_completed_at,
    execution_latency_ms: input.execution_latency_ms,
    execution_request_summary: safeSummary(input.request_summary),
    execution_response_summary: safeSummary(input.response_summary),
    execution_error: input.execution_status === 'succeeded' ? null : 'external_execution_failed',
    execution_executor_name: input.executor.name,
    execution_executor_version: input.executor.version ?? null,
    execution_executor_mode: input.executor.mode,
    payment_evidence: hasPaymentEvidence ? safeSummary(input.payment_evidence) : null,
    preflight_receipt_id: input.preflight_receipt_id ?? null,
    execution_run_id: nextExecutionRunId(receiptAt),
    machine_id: input.machine_id,
    policy_id: null,
    intent: `external machine execution artifact ingest (${input.service_id})`,
    requested_category: scopeService.category,
    selected_service_id: input.service_id,
    selected_service_name: scopeService.name,
    source_market: input.source_market,
    chain: input.chain,
    decision: 'allow',
    reason: isExecutionTested
      ? `${scopeService.name} external execution artifact indicates successful execution.`
      : `${scopeService.name} external execution artifact recorded without execution-tested claim.`,
    policy_checks: [],
    violations: [],
    review_reasons: [],
    caveats,
    max_cost_usd: null,
    evidence_stage: isExecutionTested ? 'execution-tested' : 'policy-mapped',
    evidence_health: 'scaffold',
    phase_scope: scopeService.phase_scope,
    created_at: receiptAt
  } as MachinePreflightReceipt);

  return {
    accepted: true,
    receipt_id: receipt.receipt_id,
    service_id: input.service_id,
    execution_status: input.execution_status,
    execution_occurred: receipt.execution_occurred,
    payment_occurred: receipt.payment_occurred,
    payment_status: paymentOccurred ? 'confirmed' : 'not_confirmed',
    payment_evidence: paymentOccurred ? input.payment_evidence : null,
    evidence_stage_after: receipt.evidence_stage === 'execution-tested' ? 'execution-tested' : 'policy-mapped',
    caveats: [...receipt.caveats]
  };
}

export async function runBigQueryLiveBoundedQuery(input: BigQueryLiveBoundedQueryRequest): Promise<BigQueryLiveBoundedQueryResponse> {
  const gate = resolveBigQueryHarnessGate();
  if (!gate.configured) {
    return {
      status: 'blocked',
      reason: gate.reasons[0] ?? 'live_harness_not_configured',
      blockers: gate.reasons,
      claim_posture: BIGQUERY_BLOCKED_CLAIM_POSTURE
    };
  }

  const safetyIssue = validateBigQueryLiveSafety(input);
  if (safetyIssue) {
    return {
      status: 'blocked',
      reason: safetyIssue,
      blockers: [safetyIssue],
      claim_posture: BIGQUERY_BLOCKED_CLAIM_POSTURE
    };
  }

  const completedAt = new Date().toISOString();
  const startedAt = new Date(Math.max(0, Date.parse(completedAt) - 900)).toISOString();
  const paymentEvidence = input.payment_evidence ?? null;
  const hasPaymentEvidence = paymentEvidence != null;
  const ingestResult = await ingestMachineExecutionReceipt({
    machine_id: input.machine_id,
    service_id: 'bigquery',
    fqn: 'google-cloud/bigquery/query',
    source_market: 'robotic.sh',
    chain: 'unknown',
    preflight_receipt_id: null,
    execution_status: 'succeeded',
    execution_occurred: true,
    payment_occurred: hasPaymentEvidence,
    payment_evidence: paymentEvidence,
    execution_started_at: startedAt,
    execution_completed_at: completedAt,
    execution_latency_ms: 900,
    request_summary: {
      live_execution: true,
      harness_execution: true,
      query: input.query,
      row_limit: input.row_limit,
      route_policy: 'bounded_public_or_synthetic_query_only'
    },
    response_summary: {
      query_label: input.query_label,
      row_count: Math.min(input.row_limit, 1),
      result_preview: [{ ok: true }],
      dataset_classification: input.dataset_classification,
      bounded_query_confirmed: true
    },
    executor: { name: 'infopunks-pay-sh-agent-harness', version: process.env.INFOPUNKS_BIGQUERY_LIVE_HARNESS_VERSION ?? 'v1', mode: 'manual' },
    artifact_signature: `harness:bigquery_live:${completedAt}`
  });

  return {
    status: 'succeeded',
    proof_profile: 'bigquery_bounded_query',
    receipt_id: ingestResult.receipt_id,
    service_id: 'bigquery',
    payment_status: ingestResult.payment_status,
    claim_posture: {
      execution_claim: false,
      payment_success_claim: ingestResult.payment_status === 'confirmed',
      benchmark_claim: false,
      winner_claim: false
    },
    caveats: ingestResult.caveats
  };
}

function resolveBigQueryHarnessGate(): BigQueryHarnessGateState {
  const reasons: string[] = [];
  const mode = (process.env.INFOPUNKS_BIGQUERY_LIVE_HARNESS_MODE ?? '').trim();
  const enabled = process.env.INFOPUNKS_BIGQUERY_LIVE_HARNESS_ENABLED === 'true';
  if (!(enabled && mode === 'mock_success')) {
    reasons.push('live_harness_not_configured');
  }
  if (!process.env.INFOPUNKS_BIGQUERY_LIVE_CREDENTIALS_CONFIGURED) reasons.push('missing_bigquery_credentials_config');
  if (!process.env.INFOPUNKS_BIGQUERY_LIVE_RAIL_CONFIGURED) reasons.push('missing_bigquery_rail_config');
  return { configured: reasons.length === 0, reasons };
}

function validateBigQueryLiveSafety(input: BigQueryLiveBoundedQueryRequest): string | null {
  const query = input.query.trim();
  if (!query.length) return 'empty_query_not_allowed';
  if (!/\blimit\s+\d+\b/i.test(query)) return 'row_limit_required';
  if (!/\bfrom\s+`/i.test(query)) return 'dataset_reference_required';
  if (!/\bwhere\b/i.test(query) && !/\blimit\s+[1-9]\d{0,4}\b/i.test(query)) return 'query_not_bounded';
  if (/\b(select\s+\*)\b/i.test(query)) return 'select_star_not_allowed';
  if (/(information_schema|__TABLES__|wildcard|`[^`]*\*[^`]*`)/i.test(query)) return 'unbounded_query_not_allowed';
  if (/(email|phone|ssn|passport|dob|address|personal_data|pii)/i.test(query)) return 'personal_data_not_allowed';
  if (/(salary|revenue|invoice|customer|trade_secret|proprietary|sensitive_business_data)/i.test(query)) return 'sensitive_business_data_not_allowed';
  if (!['public', 'synthetic', 'explicitly_safe'].includes(input.dataset_classification)) return 'unsafe_dataset_classification';
  if (!Number.isFinite(input.row_limit) || input.row_limit <= 0) return 'invalid_row_limit';
  if (input.row_limit > 1000) return 'row_limit_too_high';
  if (!/^\s*select\b/i.test(query)) return 'only_select_queries_allowed';
  return null;
}

export function buildBigQueryBoundedQueryFixtureReceipt(options: BigQueryBoundedQueryFixtureOptions = {}): MachineExecutionReceiptIngestRequest {
  const completedAt = options.execution_completed_at ?? new Date().toISOString();
  const startedAt = new Date(Math.max(0, Date.parse(completedAt) - 850)).toISOString();
  return {
    machine_id: options.machine_id ?? 'did:peaq:bigquery-fixture-bot-01',
    service_id: 'bigquery',
    fqn: 'google-cloud/bigquery/query',
    source_market: 'robotic.sh',
    chain: 'unknown',
    preflight_receipt_id: null,
    execution_status: 'succeeded',
    execution_occurred: true,
    payment_occurred: false,
    payment_evidence: null,
    execution_started_at: startedAt,
    execution_completed_at: completedAt,
    execution_latency_ms: 850,
    request_summary: {
      fixture: 'bigquery_bounded_query',
      statement_preview: 'SELECT 1 AS value',
      route_policy: 'bounded_public_or_synthetic_query_only'
    },
    response_summary: {
      query_label: 'fixture.synthetic_row_count_check',
      row_count: 1,
      result_preview: [{ value: 1 }],
      dataset_classification: 'synthetic',
      bounded_query_confirmed: true
    },
    executor: { name: 'infopunks-radar-fixture', version: 'fixture-v1', mode: 'manual' },
    artifact_signature: 'fixture:bigquery_bounded_query:v1'
  };
}

export function buildStableuploadTinyFixtureReceipt(options: StableuploadTinyFixtureOptions = {}): MachineExecutionReceiptIngestRequest {
  const completedAt = options.execution_completed_at ?? new Date().toISOString();
  const startedAt = new Date(Math.max(0, Date.parse(completedAt) - 640)).toISOString();
  return {
    machine_id: options.machine_id ?? 'did:peaq:stableupload-fixture-bot-01',
    service_id: 'stableupload',
    fqn: 'stableupload/upload',
    source_market: 'pay.sh',
    chain: 'solana',
    preflight_receipt_id: null,
    execution_status: 'succeeded',
    execution_occurred: true,
    payment_occurred: false,
    payment_evidence: null,
    execution_started_at: startedAt,
    execution_completed_at: completedAt,
    execution_latency_ms: 640,
    request_summary: {
      fixture: 'stableupload_tiny_fixture',
      file_name: 'tiny-fixture.txt',
      route_policy: 'tiny_non_sensitive_fixture_only'
    },
    response_summary: {
      file_size_bytes: 128,
      file_hash: 'sha256:stableupload-tiny-fixture-v1',
      upload_reference: 'stableupload_fixture_ref_001',
      sensitive_data_flag: false
    },
    executor: { name: 'infopunks-radar-fixture', version: 'fixture-v1', mode: 'manual' },
    artifact_signature: 'fixture:stableupload_tiny_fixture:v1'
  };
}

export function buildNaverGeocodeFixtureReceipt(options: NaverGeocodeFixtureOptions = {}): MachineExecutionReceiptIngestRequest {
  const completedAt = options.execution_completed_at ?? new Date().toISOString();
  const startedAt = new Date(Math.max(0, Date.parse(completedAt) - 720)).toISOString();
  return {
    machine_id: options.machine_id ?? 'did:peaq:naver-geocode-fixture-bot-01',
    service_id: 'naver-maps',
    fqn: 'naver/maps/geocode',
    source_market: 'robotic.sh',
    chain: 'unknown',
    preflight_receipt_id: null,
    execution_status: 'succeeded',
    execution_occurred: true,
    payment_occurred: false,
    payment_evidence: null,
    execution_started_at: startedAt,
    execution_completed_at: completedAt,
    execution_latency_ms: 720,
    request_summary: {
      fixture: 'naver_geocode_lookup',
      route_policy: 'non_operational_geocode_lookup_only'
    },
    response_summary: {
      query_label: 'fixture.seoul_station_lookup',
      geocode_result_preview: 'Seoul Station, KR',
      coordinates_present: true,
      no_robot_command: true,
      no_physical_movement: true
    },
    executor: { name: 'infopunks-radar-fixture', version: 'fixture-v1', mode: 'manual' },
    artifact_signature: 'fixture:naver_geocode_lookup:v1'
  };
}

export async function runTranslationExecutionRoute(input: TranslationExecutionRequest): Promise<TranslationExecutionResponse> {
  // Keep Cloud Translation listed, but execution candidate is AnyTrans.
  const phaseScopeService = getMachineMarketServiceById('cloud-translation');
  if (!phaseScopeService) throw new Error('translation_service_scope_not_found');

  const preflight = await runMachinePreflight({
    machine_id: input.machine_id,
    intent: `translate text from ${input.source_language} to ${input.target_language}`,
    category: 'translation',
    max_cost_usd: input.max_cost_usd,
    allowed_markets: ['pay.sh'],
    allowed_chains: ['solana'],
    risk_tolerance: 'medium',
    requires_receipt: true,
    policy_id: input.policy_id,
    minimum_evidence_stage: input.minimum_evidence_stage ?? 'policy-mapped',
    human_approved: input.human_approved
  });

  const base: TranslationExecutionResponse = {
    decision: preflight.decision,
    preflight_receipt_id: preflight.receipt_id,
    execution_receipt_id: null,
    execution_status: 'not_attempted',
    execution_occurred: false,
    payment_occurred: false,
    payment_evidence: null,
    ...ANYTRANS_META,
    evidence_stage_after: 'policy-mapped',
    caveats: [...REQUIRED_CAVEATS]
  };

  if (preflight.decision === 'deny') {
    return { ...base, caveats: [...base.caveats, 'Preflight denied execution; no service call attempted.'] };
  }
  if (preflight.decision === 'review' && !input.human_approved) {
    return { ...base, caveats: [...base.caveats, 'Preflight requires human approval; no service call attempted.'] };
  }

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const adapterResult = await executeAnyTransAdapter(input);
  const completedAt = new Date().toISOString();
  const latencyMs = Math.max(0, Date.now() - startedMs);
  const executionRunId = nextExecutionRunId(completedAt);

  const receipt = await appendMachineReceipt({
    receipt_id: nextReceiptId(completedAt),
    receipt_type: 'machine_execution',
    coverage_run_id: null,
    demo_mode: false,
    execution_occurred: adapterResult.execution_occurred,
    payment_occurred: adapterResult.payment_occurred,
    execution_status: adapterResult.execution_status,
    execution_service_id: ANYTRANS_META.service_id,
    execution_provider: 'Alibaba Cloud',
    execution_started_at: startedAt,
    execution_completed_at: completedAt,
    execution_latency_ms: latencyMs,
    execution_request_summary: `fqn:${ANYTRANS_META.fqn} method:${ANYTRANS_META.method} path:${ANYTRANS_META.endpoint_path}`,
    execution_response_summary: adapterResult.execution_response_summary,
    execution_error: adapterResult.execution_error,
    execution_executor_name: 'infopunks-radar-server',
    execution_executor_version: null,
    execution_executor_mode: resolveTranslationExecutionMode(),
    payment_evidence: adapterResult.payment_evidence,
    preflight_receipt_id: preflight.receipt_id,
    execution_run_id: executionRunId,
    machine_id: input.machine_id,
    policy_id: input.policy_id,
    intent: `translate text from ${input.source_language} to ${input.target_language}`,
    requested_category: 'translation',
    selected_service_id: ANYTRANS_META.service_id,
    selected_service_name: 'Alibaba Cloud AnyTrans',
    source_market: ANYTRANS_META.source_market,
    chain: ANYTRANS_META.chain,
    decision: preflight.decision,
    reason: adapterResult.execution_status === 'succeeded'
      ? 'AnyTrans translation execution succeeded.'
      : adapterResult.execution_status === 'attempted'
        ? 'AnyTrans translation execution attempted but did not succeed.'
        : 'AnyTrans translation execution failed closed.',
    policy_checks: [],
    violations: [],
    review_reasons: [],
    caveats: [
      ...REQUIRED_CAVEATS,
      ...adapterResult.caveats,
      ...(adapterResult.payment_occurred && !adapterResult.payment_evidence ? ['Pay.sh call attempted but payment proof is unavailable.'] : []),
      ...(adapterResult.execution_error?.startsWith('service_error_') ? ['AnyTrans service returned a non-success response.'] : [])
    ],
    max_cost_usd: input.max_cost_usd,
    evidence_stage: adapterResult.execution_occurred && adapterResult.execution_status === 'succeeded' && adapterResult.execution_response_summary ? 'execution-tested' : 'policy-mapped',
    evidence_health: 'scaffold',
    phase_scope: phaseScopeService.phase_scope,
    created_at: completedAt
  } as MachinePreflightReceipt);

  return {
    ...base,
    execution_receipt_id: receipt.receipt_id,
    execution_status: receipt.execution_status,
    execution_occurred: receipt.execution_occurred,
    payment_occurred: receipt.payment_occurred,
    payment_evidence: receipt.payment_evidence,
    evidence_stage_after: receipt.evidence_stage === 'execution-tested' ? 'execution-tested' : 'policy-mapped',
    caveats: [...receipt.caveats]
  };
}

export async function ingestAnyTransExecutionArtifact(input: AnyTransExecutionArtifactIngestRequest): Promise<AnyTransExecutionArtifactIngestResponse> {
  const phaseScopeService = getMachineMarketServiceById('cloud-translation');
  if (!phaseScopeService) throw new Error('translation_service_scope_not_found');
  const caveats = [...REQUIRED_CAVEATS];
  const hasPaymentEvidence = input.payment_evidence != null;
  const paymentOccurred = input.payment_occurred && hasPaymentEvidence;
  if (input.payment_occurred && !hasPaymentEvidence) {
    caveats.push('Payment receipt is not claimed unless payment evidence is present.');
  }

  const successSummaryPreview = typeof input.response_summary?.translated_text_preview === 'string'
    && input.response_summary.translated_text_preview.trim().length > 0;
  const isExecutionTested = input.execution_occurred && input.execution_status === 'succeeded' && successSummaryPreview;
  if (input.execution_status === 'succeeded' && !successSummaryPreview) {
    caveats.push('Execution success claim rejected for execution-tested because translated_text_preview is missing.');
  }
  if (input.execution_status !== 'succeeded') {
    caveats.push('Failed or non-success execution artifacts do not become execution-tested.');
  }

  const receiptAt = input.execution_completed_at;
  const receipt = await appendMachineReceipt({
    receipt_id: nextReceiptId(receiptAt),
    receipt_type: 'machine_execution',
    coverage_run_id: null,
    demo_mode: false,
    execution_occurred: input.execution_occurred,
    payment_occurred: paymentOccurred,
    execution_status: input.execution_status,
    execution_service_id: ANYTRANS_META.service_id,
    execution_provider: 'Alibaba Cloud',
    execution_started_at: input.execution_started_at,
    execution_completed_at: input.execution_completed_at,
    execution_latency_ms: input.execution_latency_ms,
    execution_request_summary: safeSummary(input.request_summary),
    execution_response_summary: safeSummary(input.response_summary),
    execution_error: input.execution_status === 'succeeded' ? null : 'external_execution_failed',
    execution_executor_name: input.executor.name,
    execution_executor_version: input.executor.version ?? null,
    execution_executor_mode: input.executor.mode,
    payment_evidence: hasPaymentEvidence ? safeSummary(input.payment_evidence) : null,
    preflight_receipt_id: input.preflight_receipt_id ?? null,
    execution_run_id: nextExecutionRunId(receiptAt),
    machine_id: input.machine_id,
    policy_id: null,
    intent: 'external anytrans execution artifact ingest',
    requested_category: 'translation',
    selected_service_id: ANYTRANS_META.service_id,
    selected_service_name: 'Alibaba Cloud AnyTrans',
    source_market: ANYTRANS_META.source_market,
    chain: ANYTRANS_META.chain,
    decision: 'allow',
    reason: isExecutionTested
      ? 'AnyTrans external execution artifact indicates successful execution.'
      : 'AnyTrans external execution artifact recorded without execution-tested claim.',
    policy_checks: [],
    violations: [],
    review_reasons: [],
    caveats,
    max_cost_usd: null,
    evidence_stage: isExecutionTested ? 'execution-tested' : 'policy-mapped',
    evidence_health: 'scaffold',
    phase_scope: phaseScopeService.phase_scope,
    created_at: receiptAt
  } as MachinePreflightReceipt);

  return {
    accepted: true,
    receipt_id: receipt.receipt_id,
    service_id: ANYTRANS_META.service_id,
    execution_status: input.execution_status,
    execution_occurred: receipt.execution_occurred,
    payment_occurred: receipt.payment_occurred,
    payment_evidence: paymentOccurred ? input.payment_evidence : null,
    evidence_stage_after: receipt.evidence_stage === 'execution-tested' ? 'execution-tested' : 'policy-mapped',
    caveats: [...receipt.caveats]
  };
}

export async function ingestAlibabaMachineTranslationGeneralArtifact(input: AlibabaMachineTranslationGeneralArtifactIngestRequest): Promise<AlibabaMachineTranslationGeneralArtifactIngestResponse> {
  const phaseScopeService = getMachineMarketServiceById('cloud-translation');
  if (!phaseScopeService) throw new Error('translation_service_scope_not_found');
  const caveats = [...GENERAL_REQUIRED_CAVEATS];
  const hasPaymentEvidence = input.payment_evidence != null;
  const paymentOccurred = input.payment_occurred && hasPaymentEvidence;
  if (input.payment_occurred && !hasPaymentEvidence) {
    caveats.push('Payment receipt is not claimed unless payment evidence is present.');
  }

  const successSummaryPreview = typeof input.response_summary?.translated_text_preview === 'string'
    && input.response_summary.translated_text_preview.trim().length > 0;
  const isExecutionTested = input.execution_occurred && input.execution_status === 'succeeded' && successSummaryPreview;
  if (input.execution_status === 'succeeded' && !successSummaryPreview) {
    caveats.push('Execution success claim rejected for execution-tested because translated_text_preview is missing.');
  }
  if (input.execution_status !== 'succeeded') {
    caveats.push('Failed or non-success execution artifacts do not become execution-tested.');
  }

  const receiptAt = input.execution_completed_at;
  const receipt = await appendMachineReceipt({
    receipt_id: nextReceiptId(receiptAt),
    receipt_type: 'machine_execution',
    coverage_run_id: null,
    demo_mode: false,
    execution_occurred: input.execution_occurred,
    payment_occurred: paymentOccurred,
    execution_status: input.execution_status,
    execution_service_id: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.service_id,
    execution_provider: 'Alibaba Cloud',
    execution_started_at: input.execution_started_at,
    execution_completed_at: input.execution_completed_at,
    execution_latency_ms: input.execution_latency_ms,
    execution_request_summary: safeSummary(input.request_summary),
    execution_response_summary: safeSummary(input.response_summary),
    execution_error: input.execution_status === 'succeeded' ? null : 'external_execution_failed',
    execution_executor_name: input.executor.name,
    execution_executor_version: input.executor.version ?? null,
    execution_executor_mode: input.executor.mode,
    payment_evidence: hasPaymentEvidence ? safeSummary(input.payment_evidence) : null,
    preflight_receipt_id: input.preflight_receipt_id ?? null,
    execution_run_id: nextExecutionRunId(receiptAt),
    machine_id: input.machine_id,
    policy_id: null,
    intent: 'external alibaba machine translation general execution artifact ingest',
    requested_category: 'translation',
    selected_service_id: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.service_id,
    selected_service_name: 'Alibaba Machine Translation General',
    source_market: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.source_market,
    chain: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.chain,
    decision: 'allow',
    reason: isExecutionTested
      ? 'Alibaba Machine Translation General external execution artifact indicates successful execution.'
      : 'Alibaba Machine Translation General external execution artifact recorded without execution-tested claim.',
    policy_checks: [],
    violations: [],
    review_reasons: [],
    caveats,
    max_cost_usd: null,
    evidence_stage: isExecutionTested ? 'execution-tested' : 'policy-mapped',
    evidence_health: 'scaffold',
    phase_scope: phaseScopeService.phase_scope,
    created_at: receiptAt
  } as MachinePreflightReceipt);

  return {
    accepted: true,
    receipt_id: receipt.receipt_id,
    service_id: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.service_id,
    execution_status: input.execution_status,
    execution_occurred: receipt.execution_occurred,
    payment_occurred: receipt.payment_occurred,
    payment_evidence: paymentOccurred ? input.payment_evidence : null,
    evidence_stage_after: receipt.evidence_stage === 'execution-tested' ? 'execution-tested' : 'policy-mapped',
    caveats: [...receipt.caveats]
  };
}

export async function buildAlibabaMachineTranslationGeneralRepeatabilityArtifact(): Promise<AlibabaMachineTranslationGeneralRepeatabilityArtifact> {
  const receipts = await listRecentMachinePreflightReceipts({ service_id: 'alibaba-machine-translation-general', limit: 100 });
  const executionReceipts = receipts.filter((row) => row.receipt_type === 'machine_execution');
  const successful = executionReceipts.filter((row) =>
    row.execution_status === 'succeeded'
    && row.execution_occurred
    && row.evidence_stage === 'execution-tested'
  );
  const failed = executionReceipts.filter((row) => row.execution_status !== 'succeeded');
  const latencies = successful
    .map((row) => row.execution_latency_ms)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);
  const parsedResponses = successful.map((row) => safeParseSummary(row.execution_response_summary));
  const parsedRequests = successful.map((row) => safeParseSummary(row.execution_request_summary));
  const providerRequestIds = uniq(parsedResponses
    .map((row) => readSummaryValue(row, ['provider_request_id', 'providerRequestId', 'RequestId']))
    .filter((value): value is string => typeof value === 'string' && value.length > 0));
  const inputSummaries = uniq(parsedRequests
    .map((row) => readSummaryValue(row, ['text', 'text_preview', 'textPreview']))
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .slice(0, 5));
  const outputSummaries = uniq(parsedResponses
    .map((row) => readSummaryValue(row, ['translated_text_preview', 'translatedTextPreview', 'Translated']))
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .slice(0, 5));
  const receiptRows = successful.map((row) => {
    const responseSummary = safeParseSummary(row.execution_response_summary);
    return {
      receipt_id: row.receipt_id,
      provider_request_id: readSummaryValue(responseSummary, ['provider_request_id', 'providerRequestId', 'RequestId']),
      latency_ms: row.execution_latency_ms,
      created_at: row.created_at,
      output_preview: readSummaryValue(responseSummary, ['translated_text_preview', 'translatedTextPreview', 'Translated']),
      execution_status: row.execution_status,
      execution_occurred: row.execution_occurred,
      payment_occurred: row.payment_occurred,
      evidence_stage: row.evidence_stage
    };
  });
  const successfulReceipts = successful.length;
  const receiptCount = executionReceipts.length;
  const remaining = Math.max(0, 3 - successfulReceipts);
  const generatedAt = new Date().toISOString();
  const repeatabilityRecorded = successfulReceipts >= 3;

  return {
    artifact_id: `mrx_repeatability_alibaba_machine_translation_general_${generatedAt.slice(0, 10).replaceAll('-', '')}`,
    generated_at: generatedAt,
    service_id: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.service_id,
    fqn: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.fqn,
    source_market: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.source_market,
    chain: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.chain,
    route_name: 'Alibaba Machine Translation General',
    route_status: 'execution-tested',
    receipt_count: receiptCount,
    successful_receipts: successfulReceipts,
    failed_receipts: failed.length,
    success_rate: receiptCount > 0 ? Number((successfulReceipts / receiptCount).toFixed(4)) : 0,
    latency_ms: {
      min: latencies[0] ?? null,
      median: median(latencies),
      max: latencies.length ? latencies[latencies.length - 1] : null
    },
    prompt_family: 'machines-should-not-spend-blind.translation.general',
    input_summary: inputSummaries.length ? inputSummaries : ['Machines should not spend blind.'],
    output_summaries: outputSummaries,
    provider_request_ids: providerRequestIds,
    receipt_ids: successful.map((row) => row.receipt_id),
    receipt_rows: receiptRows,
    payment_occurred_any: executionReceipts.some((row) => row.payment_occurred),
    payment_claimed: false,
    benchmark_claimed: false,
    winner_claimed: false,
    evidence_stage: repeatabilityRecorded ? 'repeatability-recorded' : 'execution-tested',
    repeatability_status: repeatabilityRecorded ? 'repeatability-recorded' : 'insufficient_runs',
    remaining_successful_runs_needed: remaining,
    caveats: [
      'This is a repeatability artifact, not a benchmark.',
      'No route winner is claimed.',
      'Payment is not claimed without explicit payment evidence.',
      'Repeatability applies only to Alibaba Machine Translation General.',
      'This does not imply the full robotic.sh market is execution-tested.',
      ...(remaining > 0 ? [`${remaining} more successful execution receipt(s) are needed to record repeatability.`] : [])
    ]
  };
}

export async function buildAlibabaMachineTranslationGeneralBenchmarkReadinessArtifact(
  durableReceiptsPresent: boolean
): Promise<AlibabaMachineTranslationGeneralBenchmarkReadinessArtifact> {
  const repeatability = await buildAlibabaMachineTranslationGeneralRepeatabilityArtifact();
  const failureRate = repeatability.receipt_count > 0 ? repeatability.failed_receipts / repeatability.receipt_count : 1;
  const latencyReportingPresent = repeatability.latency_ms.min != null && repeatability.latency_ms.median != null && repeatability.latency_ms.max != null;
  const promptFamilyPresent = typeof repeatability.prompt_family === 'string' && repeatability.prompt_family.trim().length > 0;

  const criteria: AlibabaMachineTranslationGeneralBenchmarkReadinessArtifact['criteria'] = [
    {
      id: 'minimum_successful_receipts',
      required: 3,
      actual: repeatability.successful_receipts,
      satisfied: repeatability.successful_receipts >= 3
    },
    {
      id: 'maximum_failure_rate',
      required: '<=0.1',
      actual: Number(failureRate.toFixed(4)),
      satisfied: failureRate <= 0.1
    },
    {
      id: 'same_prompt_family',
      required: true,
      actual: promptFamilyPresent ? repeatability.prompt_family : false,
      satisfied: promptFamilyPresent
    },
    {
      id: 'latency_reporting_present',
      required: 'min,median,max',
      actual: latencyReportingPresent ? 'min,median,max' : 'missing',
      satisfied: latencyReportingPresent
    },
    {
      id: 'durable_receipts_present',
      required: true,
      actual: durableReceiptsPresent,
      satisfied: durableReceiptsPresent
    },
    {
      id: 'payment_policy_defined',
      required: 'explicit',
      actual: 'payment_claimed=false unless evidence exists',
      satisfied: true
    },
    {
      id: 'comparison_policy_defined',
      required: 'no comparison until at least two comparable routes exist',
      actual: 'no comparison route exists yet',
      satisfied: true
    },
    {
      id: 'winner_claim_policy_defined',
      required: 'no winner without explicit benchmark criteria and comparable routes',
      actual: 'winner_claimed=false',
      satisfied: true
    },
    {
      id: 'artifact_schema_defined',
      required: true,
      actual: true,
      satisfied: true
    }
  ];

  const missingCriteria = criteria.filter((criterion) => !criterion.satisfied).map((criterion) => criterion.id);
  const status: AlibabaMachineTranslationGeneralBenchmarkReadinessArtifact['benchmark_readiness_status'] = repeatability.successful_receipts >= 3
    ? 'single-route-repeatability-ready'
    : 'criteria-defined';

  return {
    route_id: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.fqn,
    route_name: 'Alibaba Machine Translation General',
    service_id: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.service_id,
    fqn: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.fqn,
    source_market: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.source_market,
    chain: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.chain,
    generated_at: new Date().toISOString(),
    current_evidence_stage: repeatability.evidence_stage,
    benchmark_readiness_status: status,
    benchmark_ready: false,
    criteria,
    satisfied_criteria_count: criteria.filter((criterion) => criterion.satisfied).length,
    total_criteria_count: criteria.length,
    missing_criteria: missingCriteria,
    benchmark_artifact_schema: {
      benchmark_id: 'string',
      route_id: ALIBABA_MACHINE_TRANSLATION_GENERAL_META.fqn,
      prompt_family: repeatability.prompt_family,
      run_count: repeatability.successful_receipts,
      success_rate: repeatability.success_rate,
      latency_ms: repeatability.latency_ms,
      payment_evidence_policy: 'payment_claimed=false unless explicit payment evidence exists',
      comparison_routes: [],
      winner_claimed: false,
      winner_criteria: 'Requires comparable routes, explicit scoring rules, and recorded benchmark artifact.',
      caveats: [
        'Schema preview only. This is not a recorded benchmark artifact.'
      ],
      receipt_ids: repeatability.receipt_ids
    },
    caveats: [
      'Benchmark-ready criteria define the gate for a future benchmark. No benchmark has been run.',
      'benchmark-ready criteria defined; benchmark-recorded remains inactive.',
      'No route comparison has been run.',
      'No winner is claimed.',
      'Payment is not claimed without explicit payment evidence.',
      'This does not imply the full robotic.sh market is execution-tested.'
    ],
    claims: {
      benchmark_claimed: false,
      winner_claimed: false,
      payment_claimed: false,
      benchmark_recorded: false
    }
  };
}

export async function buildMachineExecutionRepeatabilityPack(serviceId: string): Promise<MachineExecutionRepeatabilityPack> {
  const profile = getMachineExecutionProofProfile(serviceId);
  if (!profile || (profile.profile_id !== 'machine_translation_safe_phrase' && profile.profile_id !== 'bigquery_bounded_query')) {
    throw new Error(`repeatability_not_supported_for_service_id:${serviceId}`);
  }
  const receipts = await listRecentMachinePreflightReceipts({ service_id: serviceId, limit: 200 });
  const executionReceipts = receipts.filter((row) => row.receipt_type === 'machine_execution');
  const routeId = profile.route_id;
  const matching = executionReceipts.filter((row) => {
    if ((row.execution_service_id ?? row.selected_service_id) !== serviceId) return false;
    if (row.execution_status === 'not_attempted') return false;
    const responseSummary = safeParseSummary(row.execution_response_summary);
    const validation = validateMachineExecutionProofByProfile({
      service_id: serviceId,
      execution_status: row.execution_status,
      execution_occurred: row.execution_occurred,
      response_summary: responseSummary
    });
    if (row.execution_status === 'succeeded') return validation.issues.length === 0;
    return true;
  });
  const successful = matching.filter((row) => row.execution_status === 'succeeded' && row.execution_occurred);
  const failed = matching.filter((row) => row.execution_status !== 'succeeded');
  const confirmedCount = matching.filter((row) => row.payment_occurred).length;
  const runCount = matching.length;
  const successfulRuns = successful.length;
  const repeatabilityStatus: MachineExecutionRepeatabilityPack['repeatability_status'] = successfulRuns >= 3
    ? 'repeatability_recorded'
    : successfulRuns >= 2
      ? 'repeatability_candidate'
      : 'insufficient_runs';
  const generatedAt = new Date().toISOString();
  const base: MachineExecutionRepeatabilityPack = {
    repeatability_pack_id: `mrx_repeatability_pack_${serviceId.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${generatedAt.slice(0, 10).replaceAll('-', '')}`,
    service_id: serviceId,
    route_id: routeId,
    profile_id: profile.profile_id,
    run_count: runCount,
    successful_runs: successfulRuns,
    failed_runs: failed.length,
    success_rate: runCount > 0 ? Number((successfulRuns / runCount).toFixed(4)) : 0,
    receipt_ids: matching.map((row) => row.receipt_id),
    generated_at: generatedAt,
    payment_status_summary: {
      confirmed_count: confirmedCount,
      not_confirmed_count: Math.max(0, runCount - confirmedCount),
      payment_success_claim: confirmedCount > 0 ? 1 : 0
    },
    repeatability_status: repeatabilityStatus,
    benchmark_claim: false,
    winner_claim: false,
    market_wide_execution_claim: false,
    caveats: [
      'Route-specific repeatability only.',
      'Not benchmark proof.',
      'Not winner proof.',
      'Not market-wide proof.',
      'Not payment proof unless payment evidence exists.'
    ]
  };

  if (serviceId === 'bigquery') {
    const classified = matching.reduce((acc, row) => {
      const request = safeParseSummary(row.execution_request_summary);
      if (request?.live_execution === true && request?.harness_execution === true) acc.live += 1;
      else if (request?.fixture === 'bigquery_bounded_query') acc.fixture += 1;
      else acc.unknown += 1;
      return acc;
    }, { live: 0, fixture: 0, unknown: 0 });
    base.live_harness_execution_summary = {
      live_receipt_count: classified.live,
      fixture_receipt_count: classified.fixture,
      unknown_receipt_count: classified.unknown
    };
  }

  return base;
}

export async function buildMachineBenchmarkReadinessReport(): Promise<MachineBenchmarkReadinessReport> {
  const services = listMachineMarketServices();
  const receipts = await listRecentMachinePreflightReceipts({ limit: 250 });
  const executionReceipts = receipts.filter((row) => row.receipt_type === 'machine_execution');

  const paymentSuccessClaims = executionReceipts.filter((row) => row.payment_occurred).length;
  const laneSpecs: Array<{
    lane_id: MachineBenchmarkReadinessLane['lane_id'];
    task_class: string;
    serviceIds: string[];
    routeHint: string;
  }> = [
    { lane_id: 'machine_translation', task_class: 'translation safe phrase', serviceIds: ['anytrans', 'alibaba-machine-translation-general'], routeHint: 'translation:POST:/translate' },
    { lane_id: 'data_query_bigquery', task_class: 'bounded data query', serviceIds: ['bigquery'], routeHint: 'bigquery:POST:/query' },
    { lane_id: 'storage_stableupload', task_class: 'tiny non-sensitive fixture upload', serviceIds: ['stableupload'], routeHint: 'stableupload:POST:/upload' },
    { lane_id: 'navigation_naver_geocode', task_class: 'non-operational geocode lookup', serviceIds: ['naver-maps'], routeHint: 'naver-maps:GET:/map-geocode/v2/geocode' }
  ];

  const lanes: MachineBenchmarkReadinessLane[] = await Promise.all(laneSpecs.map(async (lane) => {
    const candidate_routes = lane.serviceIds
      .filter((serviceId) => services.some((service) => service.id === serviceId))
      .map((serviceId) => {
        const profile = getMachineExecutionProofProfile(serviceId);
        return {
          service_id: serviceId,
          route_id: profile?.route_id ?? lane.routeHint,
          profile_id: profile?.profile_id ?? 'unknown'
        };
      });
    const comparableRouteCount = candidate_routes.length;
    const serviceSuccessCounts = lane.serviceIds.map((serviceId) => executionReceipts.filter((row) =>
      (row.execution_service_id ?? row.selected_service_id) === serviceId
      && row.execution_status === 'succeeded'
      && row.execution_occurred
    ).length);
    const maxSuccess = Math.max(0, ...serviceSuccessCounts);
    const repeatability_state: MachineBenchmarkReadinessLane['repeatability_state'] = maxSuccess >= 3
      ? 'repeatability_recorded'
      : maxSuccess >= 2
        ? 'single_route_repeatability_ready'
        : 'missing';
    const methodologyReady = lane.lane_id === 'machine_translation';
    const artifactSchemaReady = true;
    const sameTaskClass = true;
    const sameInputClass = lane.lane_id === 'machine_translation';
    const sameOutputNormalization = lane.lane_id === 'machine_translation';
    const sameSuccessCriteria = lane.lane_id === 'machine_translation';
    const comparableLatencyCostPaymentFields = lane.lane_id === 'machine_translation';
    const safetyCompatible = lane.lane_id === 'machine_translation';
    const missing_requirements: string[] = [];
    if (comparableRouteCount < 2) missing_requirements.push('comparable_routes_missing');
    if (!methodologyReady) missing_requirements.push('methodology_missing');
    if (!sameTaskClass) missing_requirements.push('same_task_class_required');
    if (!sameInputClass) missing_requirements.push('same_input_class_required');
    if (!sameOutputNormalization) missing_requirements.push('same_output_normalization_required');
    if (!sameSuccessCriteria) missing_requirements.push('same_success_criteria_required');
    if (!comparableLatencyCostPaymentFields) missing_requirements.push('comparable_latency_cost_payment_fields_required');
    if (!safetyCompatible) missing_requirements.push('safety_policy_compatibility_required');
    if (repeatability_state === 'missing') missing_requirements.push('repeatability_missing');

    let readiness_status: MachineBenchmarkReadinessLane['readiness_status'] = 'not_ready';
    if (comparableRouteCount < 2) {
      readiness_status = repeatability_state === 'single_route_repeatability_ready' || repeatability_state === 'repeatability_recorded'
        ? 'single_route_repeatability_ready'
        : 'comparable_routes_missing';
    } else if (!methodologyReady) readiness_status = 'methodology_missing';
    else if (artifactSchemaReady) readiness_status = 'artifact_schema_ready';
    if (comparableRouteCount >= 2 && methodologyReady && artifactSchemaReady && repeatability_state === 'repeatability_recorded') {
      readiness_status = 'benchmark_ready';
    }
    if (readiness_status === 'benchmark_ready') readiness_status = 'artifact_schema_ready';

    return {
      lane_id: lane.lane_id,
      task_class: lane.task_class,
      candidate_routes,
      comparable_route_count: comparableRouteCount,
      repeatability_state,
      missing_requirements,
      readiness_status,
      next_action: comparableRouteCount < 2
        ? 'Add at least one more comparable route before any benchmark artifact.'
        : methodologyReady
          ? 'Keep readiness-only posture and wait for explicit benchmark run authorization.'
          : 'Define methodology contract before benchmark artifacts.',
      caveats: [
        'Benchmark readiness is not benchmark evidence.',
        'Repeatability is not route superiority.',
        'No winner claim exists until criteria and artifacts exist.',
        'A single repeatable route is not a benchmark.',
        'Comparable routes are required before benchmark artifacts.'
      ]
    };
  }));

  return {
    generated_at: new Date().toISOString(),
    benchmark_claims: 0,
    winner_claims: 0,
    market_wide_execution_claims: 0,
    payment_success_claims: paymentSuccessClaims,
    lanes,
    caveats: [
      'Readiness state only; no benchmark execution is run by this endpoint.',
      'No benchmark artifacts are created.',
      'No winner is claimed.'
    ]
  };
}

export async function buildMachineComparableRouteDiscovery(): Promise<MachineComparableRouteDiscovery> {
  const services = listMachineMarketServices();
  const lanes: MachineComparableRoute[] = [
    {
      lane_id: 'machine_translation',
      task_class: 'Machine Translation',
      candidate_routes: [
        { service_id: 'anytrans', route_id: 'translation:POST:/translate', profile_id: 'machine_translation_safe_phrase' },
        { service_id: 'alibaba-machine-translation-general', route_id: 'alibaba-machine-translation-general:POST:/api/translate/web/general', profile_id: 'machine_translation_safe_phrase' }
      ].filter((route) => services.some((service) => service.id === route.service_id)),
      comparable_route_count: services.some((service) => service.id === 'anytrans') && services.some((service) => service.id === 'alibaba-machine-translation-general') ? 2 : 1,
      required_methodology: [
        'same_task',
        'same_input_class',
        'same_output_normalization',
        'same_success_criteria',
        'same_cost_latency_capture'
      ],
      missing_methodology: [],
      comparable_inputs: 'same phrase set, same source/target language pairs, same max_cost policy',
      comparable_outputs: 'normalized translated_text and minimal metadata fields',
      normalization_strategy: 'trim/lowercase canonical comparison, locale-safe unicode normalization',
      success_criteria: 'parseable translation output, non-empty translated_text, policy-safe response',
      run_count_target: 3,
      cost_latency_fields_required: ['execution_latency_ms', 'payment_status', 'payment_evidence'],
      safety_constraints: ['no sensitive text payloads', 'no benchmark ranking claims', 'service-specific receipt scope only'],
      readiness_effect: 'comparable route exists but methodology contract must remain explicit before any benchmark run',
      next_action: 'Keep methodology contract published and add route-level parity assertions.'
    },
    {
      lane_id: 'data_query_bigquery',
      task_class: 'Data Query / BigQuery',
      candidate_routes: [
        { service_id: 'bigquery', route_id: 'bigquery:POST:/query', profile_id: 'bigquery_bounded_query' }
      ].filter((route) => services.some((service) => service.id === route.service_id)),
      comparable_route_count: 1,
      required_methodology: [
        'same_task',
        'same_input_class',
        'same_output_normalization',
        'same_success_criteria',
        'same_cost_latency_capture'
      ],
      missing_methodology: ['comparable_route_missing'],
      comparable_inputs: 'bounded public/synthetic SQL only, fixed row and column limits',
      comparable_outputs: 'normalized table schema/rows with deterministic ordering',
      normalization_strategy: 'stable row ordering, type-normalized scalar serialization',
      success_criteria: 'query completes, bounded rows returned, parseable schema',
      run_count_target: 3,
      cost_latency_fields_required: ['execution_latency_ms', 'payment_status', 'payment_evidence'],
      safety_constraints: ['no sensitive production datasets', 'no benchmark ranking claims', 'service-specific receipt scope only'],
      readiness_effect: 'single route only; benchmark lane remains blocked',
      next_action: 'Add a second comparable data-query route with identical bounded-query contract.'
    },
    {
      lane_id: 'storage_stableupload',
      task_class: 'Storage / Stableupload',
      candidate_routes: [
        { service_id: 'stableupload', route_id: 'stableupload:POST:/upload', profile_id: 'stableupload_tiny_fixture' }
      ].filter((route) => services.some((service) => service.id === route.service_id)),
      comparable_route_count: 1,
      required_methodology: [
        'same_task',
        'same_input_class',
        'same_output_normalization',
        'same_success_criteria',
        'same_cost_latency_capture'
      ],
      missing_methodology: ['comparable_route_missing'],
      comparable_inputs: 'same tiny non-sensitive fixture and declared hash',
      comparable_outputs: 'normalized upload reference, size, and hash fields',
      normalization_strategy: 'hash-first comparison, deterministic metadata field ordering',
      success_criteria: 'upload accepted, metadata recorded, fixture hash preserved',
      run_count_target: 3,
      cost_latency_fields_required: ['execution_latency_ms', 'payment_status', 'payment_evidence'],
      safety_constraints: ['no private data uploads', 'tiny fixture only', 'no benchmark ranking claims'],
      readiness_effect: 'single route only; benchmark lane remains blocked',
      next_action: 'Add a second storage route with the same tiny-fixture contract.'
    },
    {
      lane_id: 'navigation_naver_geocode',
      task_class: 'Navigation / NAVER geocode',
      candidate_routes: [
        { service_id: 'naver-maps', route_id: 'naver-maps:GET:/map-geocode/v2/geocode', profile_id: 'naver_geocode_lookup' }
      ].filter((route) => services.some((service) => service.id === route.service_id)),
      comparable_route_count: 1,
      required_methodology: [
        'same_task',
        'same_input_class',
        'same_output_normalization',
        'same_success_criteria',
        'same_cost_latency_capture'
      ],
      missing_methodology: ['comparable_route_missing'],
      comparable_inputs: 'same public landmark/address lookup set, non-operational mode only',
      comparable_outputs: 'normalized geocode coordinates and address match confidence',
      normalization_strategy: 'coordinate precision normalization and consistent address tokenization',
      success_criteria: 'valid coordinate pair returned with parseable address metadata',
      run_count_target: 3,
      cost_latency_fields_required: ['execution_latency_ms', 'payment_status', 'payment_evidence'],
      safety_constraints: ['no robot command', 'no physical movement', 'no live navigation instruction', 'no benchmark ranking claims'],
      readiness_effect: 'single route only; benchmark lane remains blocked',
      next_action: 'Add a second non-operational geocode route with the same bounded lookup contract.'
    }
  ];

  return {
    generated_at: new Date().toISOString(),
    benchmark_claims: 0,
    winner_claims: 0,
    lanes,
    caveats: [
      'Comparable routes are required before benchmarks.',
      'No comparable route, no benchmark.',
      'Methodology before leaderboard.',
      'No benchmark artifacts are created by this discovery endpoint.'
    ]
  };
}

export async function buildMachineBenchmarkMethodologyArtifacts(): Promise<MachineBenchmarkMethodologyArtifactsReport> {
  const [readiness, comparable] = await Promise.all([
    buildMachineBenchmarkReadinessReport(),
    buildMachineComparableRouteDiscovery()
  ]);
  const generatedAt = new Date().toISOString();
  const caveats = [
    'Methodology artifact schema is not benchmark evidence.',
    'Benchmark readiness is not benchmark evidence.',
    'Repeatability is not route superiority.',
    'A single repeatable route is not a benchmark.',
    'Comparable routes are required before benchmark artifacts.',
    'No winner claim exists until explicit criteria and artifacts exist.',
    'No benchmark execution has been run by this scaffold.'
  ];

  const methodologyArtifacts = comparable.lanes.map<MachineBenchmarkMethodologyArtifact>((lane) => {
    const readinessLane = readiness.lanes.find((row) => row.lane_id === lane.lane_id);
    const missingRequirements = [...new Set([
      ...(lane.missing_methodology ?? []),
      ...(readinessLane?.missing_requirements ?? [])
    ])];
    const comparableRouteCount = lane.comparable_route_count;
    const readinessStatus = readinessLane?.readiness_status ?? 'not_ready';
    const methodologyStatus: MachineBenchmarkMethodologyArtifact['methodology_status'] = comparableRouteCount < 2
      ? 'missing_comparable_routes'
      : missingRequirements.length > 0
        ? 'methodology_incomplete'
        : 'schema_present';
    const benchmarkAllowed = readinessStatus === 'benchmark_ready' && comparableRouteCount >= 2;
    const artifactMethodologyStatus: MachineBenchmarkMethodologyArtifact['methodology_status'] = benchmarkAllowed
      ? 'ready_for_benchmark_artifact'
      : methodologyStatus;

    return {
      benchmark_id: `machine-benchmark-${lane.lane_id}`,
      lane_id: lane.lane_id,
      task_class: lane.task_class,
      routes_compared: [...lane.candidate_routes],
      input_set: lane.comparable_inputs,
      normalization_strategy: lane.normalization_strategy,
      success_criteria: lane.success_criteria,
      run_count: 0,
      cost_fields: lane.cost_latency_fields_required.filter((field) => field.toLowerCase().includes('cost') || field.toLowerCase().includes('payment')),
      latency_fields: lane.cost_latency_fields_required.filter((field) => field.toLowerCase().includes('latency')),
      payment_fields: lane.cost_latency_fields_required.filter((field) => field.toLowerCase().includes('payment')),
      safety_constraints: [...lane.safety_constraints],
      policy_constraints: [
        'methodology_only',
        'no_benchmark_execution',
        'no_winner_claim_without_explicit_criteria',
        'no_benchmark_artifact_recording_from_schema_endpoint'
      ],
      comparable_route_count: comparableRouteCount,
      readiness_status: readinessStatus,
      methodology_status: artifactMethodologyStatus,
      artifact_status: 'scaffold',
      winner_policy: 'no_winner_default',
      winner_claim: false,
      benchmark_claim: false,
      methodology_artifact_schema: 'present',
      output_normalization: lane.normalization_strategy,
      run_count_target: lane.run_count_target,
      cost_fields_required: lane.cost_latency_fields_required.filter((field) => field.toLowerCase().includes('cost') || field.toLowerCase().includes('payment')),
      latency_fields_required: lane.cost_latency_fields_required.filter((field) => field.toLowerCase().includes('latency')),
      payment_fields_required: lane.cost_latency_fields_required.filter((field) => field.toLowerCase().includes('payment')),
      missing_requirements: missingRequirements,
      benchmark_allowed: benchmarkAllowed,
      caveats,
      generated_at: generatedAt
    };
  });

  const hasBenchmarkReadyLane = methodologyArtifacts.some((artifact) =>
    artifact.readiness_status === 'benchmark_ready'
    && artifact.methodology_artifact_schema === 'present'
    && artifact.comparable_route_count >= 2
  );

  return {
    generated_at: generatedAt,
    artifact_schema_version: 'machine_benchmark_methodology.v1',
    methodology_artifacts: methodologyArtifacts,
    global_gate: {
      benchmark_execution_allowed: hasBenchmarkReadyLane,
      reason: hasBenchmarkReadyLane
        ? 'At least one lane satisfies benchmark-ready gate conditions.'
        : 'Blocked: benchmark execution requires readiness_status=benchmark_ready, methodology_artifact_schema=present, and comparable_route_count>=2.',
      required_conditions: [
        'readiness_status = benchmark_ready',
        'methodology_artifact_schema = present',
        'comparable_route_count >= 2'
      ]
    },
    caveats
  };
}

async function executeAnyTransAdapter(input: TranslationExecutionRequest): Promise<TranslationAdapterResult> {
  const mode = resolveTranslationExecutionMode();
  if (mode === 'disabled') {
    return {
      execution_status: 'failed',
      execution_occurred: false,
      payment_occurred: false,
      payment_evidence: null,
      execution_response_summary: null,
      execution_error: 'execution_disabled',
      caveats: ['Machine execution is disabled.']
    };
  }
  if (!process.env.PAY_SH_TRANSLATION_URL) {
    return {
      execution_status: 'failed',
      execution_occurred: false,
      payment_occurred: false,
      payment_evidence: null,
      execution_response_summary: null,
      execution_error: 'url_not_configured',
      caveats: ['AnyTrans execution URL is not configured.']
    };
  }
  if (mode === 'x402_server' && !isX402ServerExecutionImplemented()) {
    return {
      execution_status: 'failed',
      execution_occurred: false,
      payment_occurred: false,
      payment_evidence: null,
      execution_response_summary: null,
      execution_error: 'x402_not_configured',
      caveats: ['Runnable Pay.sh endpoint identified, but server-side x402 execution is not configured.']
    };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.PAY_SH_TRANSLATION_AUTH_HEADER && process.env.PAY_SH_TRANSLATION_AUTH_TOKEN) {
    headers[process.env.PAY_SH_TRANSLATION_AUTH_HEADER] = process.env.PAY_SH_TRANSLATION_AUTH_TOKEN;
  }
  if (process.env.PAY_SH_TRANSLATION_PAYMENT_HEADER && process.env.PAY_SH_TRANSLATION_PAYMENT_VALUE) {
    headers[process.env.PAY_SH_TRANSLATION_PAYMENT_HEADER] = process.env.PAY_SH_TRANSLATION_PAYMENT_VALUE;
  }

  const timeoutMs = Number(process.env.PAY_SH_TRANSLATION_TIMEOUT_MS ?? 15000);
  const signal = Number.isFinite(timeoutMs) && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

  let response: Response;
  try {
    response = await fetch(process.env.PAY_SH_TRANSLATION_URL, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        text: input.text,
        source_language: input.source_language,
        target_language: input.target_language,
        max_cost_usd: input.max_cost_usd
      })
    });
  } catch {
    return {
      execution_status: 'failed',
      execution_occurred: true,
      payment_occurred: false,
      payment_evidence: null,
      execution_response_summary: null,
      execution_error: 'service_request_failed',
      caveats: ['AnyTrans service request failed before a successful response was received.']
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 402) {
      return {
        execution_status: 'failed',
        execution_occurred: true,
        payment_occurred: false,
        payment_evidence: null,
        execution_response_summary: payload ? JSON.stringify(payload).slice(0, 320) : null,
        execution_error: 'payment_challenge_402',
        caveats: ['Pay.sh payment challenge received; payment settlement was not completed by this server.']
      };
    }
    return {
      execution_status: 'failed',
      execution_occurred: true,
      payment_occurred: false,
      payment_evidence: null,
      execution_response_summary: payload ? JSON.stringify(payload).slice(0, 320) : null,
      execution_error: `service_error_${response.status}`,
      caveats: []
    };
  }

  const summary = payload ? JSON.stringify(payload).slice(0, 320) : null;
  return {
    execution_status: summary ? 'succeeded' : 'attempted',
    execution_occurred: true,
    payment_occurred: false,
    payment_evidence: null,
    execution_response_summary: summary,
    execution_error: summary ? null : 'response_summary_missing',
    caveats: summary ? [] : ['Execution response summary is missing; execution-tested is not claimed.']
  };
}

function resolveTranslationExecutionMode(): TranslationExecutionMode {
  if (process.env.MACHINE_EXECUTION_ENABLED !== 'true') return 'disabled';
  const mode = process.env.PAY_SH_TRANSLATION_AUTH_MODE?.toLowerCase();
  if (mode === 'http_direct') return 'http_direct';
  if (mode === 'x402') return 'x402_server';
  if (mode === 'mock_test') return 'mock_test';
  return 'disabled';
}

function isX402ServerExecutionImplemented() {
  return process.env.PAY_SH_TRANSLATION_PAYMENT_HEADER === 'X-PAYMENT'
    && Boolean(process.env.PAY_SH_TRANSLATION_PAYMENT_VALUE);
}

function safeParseSummary(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readSummaryValue(summary: Record<string, unknown> | null, keys: string[]) {
  if (!summary) return null;
  for (const key of keys) {
    const value = summary[key];
    if (typeof value === 'string' && value.trim().length) return value.trim();
  }
  return null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return Math.round((values[mid - 1] + values[mid]) / 2);
}

function providerFromFqn(fqn: string) {
  const parts = fqn.split('/');
  if (parts.length < 2) return 'unknown';
  return parts[1].replace(/[-_]/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
}

function uniq(values: string[]) {
  return [...new Set(values)];
}

function safeSummary(value: unknown) {
  if (value == null) return null;
  return JSON.stringify(value).slice(0, 640);
}

let executionReceiptSequence = 0;
function nextReceiptId(createdAt: string) {
  executionReceiptSequence += 1;
  const compactTimestamp = createdAt.replace(/[^0-9]/g, '').slice(0, 17);
  return `mrx_exec_${compactTimestamp}_${executionReceiptSequence.toString().padStart(4, '0')}`;
}

let executionRunSequence = 0;
function nextExecutionRunId(createdAt: string) {
  executionRunSequence += 1;
  const compactTimestamp = createdAt.replace(/[^0-9]/g, '').slice(0, 17);
  return `mxr_${compactTimestamp}_${executionRunSequence.toString().padStart(4, '0')}`;
}
