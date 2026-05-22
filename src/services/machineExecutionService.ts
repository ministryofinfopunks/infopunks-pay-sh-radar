import { appendMachineReceipt, runMachinePreflight, type MachinePreflightReceipt } from './machinePreflightService';
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

const REQUIRED_CAVEATS = [
  'Execution-tested applies only to the AnyTrans translation execution candidate.',
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
