// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathAndSearch(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, 'http://localhost');
  return { path: url.pathname, search: url.searchParams };
}

function installFetch(receipts: any[], repeatability: any = null) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const { path } = pathAndSearch(input);
    if (path === '/v1/machine-preflight/receipts/recent') {
      return json({ count: receipts.length, receipts });
    }
    if (path === '/v1/machine-execution/alibaba-machine-translation-general/repeatability') {
      return json(repeatability ?? {
        artifact_id: 'mrx_repeatability_alibaba_machine_translation_general_20260522',
        repeatability_status: 'insufficient_runs',
        failed_receipts: 0,
        successful_receipts: 0,
        payment_claimed: false,
        benchmark_claimed: false,
        winner_claimed: false,
        input_summary: ['Machines should not spend blind.'],
        output_summaries: ['Las máquinas no deberían gastar a ciegas.'],
        success_rate: 0,
        latency_ms: { min: null, median: null, max: null },
        receipt_ids: [],
        provider_request_ids: [],
        caveats: []
      });
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function renderPage(container: HTMLDivElement) {
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

describe('machine execution detail page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-execution/alibaba-machine-translation-general');
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders latest execution-tested receipt detail with summary fields', async () => {
    installFetch([{
      receipt_id: 'mrx_exec_20260522183100415_0001',
      receipt_type: 'machine_execution',
      demo_mode: false,
      execution_occurred: true,
      payment_occurred: false,
      execution_status: 'succeeded',
      execution_service_id: 'alibaba-machine-translation-general',
      execution_provider: 'Alibaba Cloud',
      execution_started_at: '2026-05-22T18:31:00.415Z',
      execution_completed_at: '2026-05-22T18:31:01.415Z',
      execution_latency_ms: 1000,
      execution_request_summary: '{"text":"Machines should not spend blind."}',
      execution_response_summary: '{"translated_text_preview":"Las máquinas no deberían gastar a ciegas.","provider_request_id":"630BC2E5-AA27-5E84-ABB2-0BFE100BBD9F","word_count":32}',
      execution_error: null,
      execution_executor_name: 'infopunks-pay-sh-agent-harness',
      execution_executor_version: '1.0.0',
      execution_executor_mode: 'pay_cli',
      payment_evidence: null,
      preflight_receipt_id: 'mrx_202605220001_0001',
      execution_run_id: 'mxr_202605220001_0001',
      machine_id: 'did:peaq:machine-translation-prod-smoke',
      policy_id: 'field-maintenance-bot',
      intent: 'external alibaba machine translation general execution artifact ingest',
      requested_category: 'translation',
      selected_service_id: 'alibaba-machine-translation-general',
      selected_service_name: 'Alibaba Machine Translation General',
      source_market: 'pay.sh',
      chain: 'solana',
      decision: 'allow',
      reason: 'Alibaba Machine Translation General external execution artifact indicates successful execution.',
      policy_checks: [],
      violations: [],
      review_reasons: [],
      caveats: [],
      max_cost_usd: null,
      evidence_stage: 'execution-tested',
      evidence_health: 'scaffold',
      phase_scope: 'phase_2_pay_sh_robotic_sh',
      created_at: '2026-05-22T18:31:01.415Z'
    }], {
      artifact_id: 'mrx_repeatability_alibaba_machine_translation_general_20260522',
      repeatability_status: 'insufficient_runs',
      successful_receipts: 1,
      failed_receipts: 0,
      payment_claimed: false,
      benchmark_claimed: false,
      winner_claimed: false,
      input_summary: ['Machines should not spend blind.'],
      output_summaries: ['Las máquinas no deberían gastar a ciegas.'],
      remaining_successful_runs_needed: 2,
      success_rate: 1,
      latency_ms: { min: 1000, median: 1000, max: 1000 },
      receipt_ids: ['mrx_exec_20260522183100415_0001'],
      provider_request_ids: ['630BC2E5-AA27-5E84-ABB2-0BFE100BBD9F'],
      caveats: ['This is a repeatability artifact, not a benchmark.']
    });
    root = await renderPage(container);

    const text = container.textContent ?? '';
    expect(text).toContain('Alibaba Machine Translation General');
    expect(text).toContain('First execution-tested Machine Radar route.');
    expect(text).toContain('mrx_exec_20260522183100415_0001');
    expect(text).toContain('Las máquinas no deberían gastar a ciegas.');
    expect(text).toContain('630BC2E5-AA27-5E84-ABB2-0BFE100BBD9F');
    expect(text).toContain('infopunks-pay-sh-agent-harness');
    expect(text).toContain('pay_cli');
    expect(text).toContain('payment_occurred=false');
    expect(text).toContain('Payment is not claimed because no explicit payment evidence was recorded.');
    expect(text).toContain('Machine Execution Repeatability Artifact');
    expect(text).toContain('artifact: mrx_repeatability_alibaba_machine_translation_general_20260522');
    expect(text).toContain('No winner is claimed.');
    expect(text).toContain('This is a repeatability artifact, not a benchmark.');
    expect(text).toContain('Payment is not claimed without explicit payment evidence.');
    expect(text).toContain('Repeatability applies only to Alibaba Machine Translation General.');
    expect(text).toContain('This does not imply the full robotic.sh market is execution-tested.');
    expect(text).toContain('AnyTrans remains attempted-recorded and blocked by provider workspace authorization.');
    expect(text).toContain('status: insufficient_runs');
    expect(text).toContain('successful executions1');
    expect(text).toContain('failed executions0');
    expect(text).toContain('success rate100%');
    expect(text).toContain('latency range1.00s–1.00s');
    expect(text).toContain('median latency1.00s');
    expect(text).toContain('payment claimedfalse');
    expect(text).toContain('benchmark claimedfalse');
    expect(text).toContain('winner claimedfalse');
    expect(text).toContain('Coverage → Execution-tested → Repeatability-recorded → Benchmark-ready, inactive → Benchmark-recorded, inactive');
    expect(text).toContain('Output summaries are safe excerpts from durable execution receipts.');
    expect(text).toContain('Progress: 1 / 3 successful receipts. Run 2 more successful executions with the same prompt family.');
  });

  it('renders empty state when no receipt exists', async () => {
    installFetch([]);
    root = await renderPage(container);

    expect(container.textContent).toContain('No execution receipt yet.');
    expect(container.textContent).toContain('No execution-tested receipt exists for Alibaba Machine Translation General yet.');
  });

  it('shows repeatability recorded state', async () => {
    installFetch([{
      receipt_id: 'mrx_exec_20260522183100415_0003',
      receipt_type: 'machine_execution',
      demo_mode: false,
      execution_occurred: true,
      payment_occurred: false,
      execution_status: 'succeeded',
      execution_service_id: 'alibaba-machine-translation-general',
      execution_provider: 'Alibaba Cloud',
      execution_started_at: '2026-05-22T18:31:00.415Z',
      execution_completed_at: '2026-05-22T18:31:01.415Z',
      execution_latency_ms: 1200,
      execution_request_summary: '{"text":"Machines should not spend blind."}',
      execution_response_summary: '{"translated_text_preview":"Las máquinas no deberían gastar a ciegas.","provider_request_id":"RID-3","word_count":32}',
      execution_error: null,
      execution_executor_name: 'infopunks-pay-sh-agent-harness',
      execution_executor_version: '1.0.0',
      execution_executor_mode: 'pay_cli',
      payment_evidence: null,
      preflight_receipt_id: 'mrx_202605220001_0001',
      execution_run_id: 'mxr_202605220001_0003',
      machine_id: 'did:peaq:machine-translation-prod-smoke',
      policy_id: 'field-maintenance-bot',
      intent: 'external alibaba machine translation general execution artifact ingest',
      requested_category: 'translation',
      selected_service_id: 'alibaba-machine-translation-general',
      selected_service_name: 'Alibaba Machine Translation General',
      source_market: 'pay.sh',
      chain: 'solana',
      decision: 'allow',
      reason: 'ok',
      policy_checks: [],
      violations: [],
      review_reasons: [],
      caveats: [],
      max_cost_usd: null,
      evidence_stage: 'execution-tested',
      evidence_health: 'scaffold',
      phase_scope: 'phase_2_pay_sh_robotic_sh',
      created_at: '2026-05-22T18:31:01.415Z'
    }], {
      artifact_id: 'mrx_repeatability_alibaba_machine_translation_general_20260522',
      repeatability_status: 'repeatability-recorded',
      successful_receipts: 3,
      failed_receipts: 0,
      payment_claimed: false,
      benchmark_claimed: false,
      winner_claimed: false,
      input_summary: ['Machines should not spend blind.'],
      output_summaries: ['Las máquinas no deberían gastar a ciegas.'],
      remaining_successful_runs_needed: 0,
      success_rate: 0.75,
      latency_ms: { min: 1000, median: 1200, max: 2000 },
      receipt_ids: ['mrx_exec_1', 'mrx_exec_2', 'mrx_exec_3'],
      provider_request_ids: ['RID-1', 'RID-2', 'RID-3'],
      caveats: ['This is a repeatability artifact, not a benchmark.']
    });
    root = await renderPage(container);
    expect(container.textContent).toContain('Repeatability recorded across 3 successful executions.');
    expect(container.textContent).toContain('status: repeatability-recorded');
  });
});
