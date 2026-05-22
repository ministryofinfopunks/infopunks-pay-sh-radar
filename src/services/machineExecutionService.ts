import { appendMachineReceipt, listRecentMachinePreflightReceipts, runMachinePreflight, type MachinePreflightReceipt } from './machinePreflightService';
import { getMachineMarketServiceById } from './machineMarketService';

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
