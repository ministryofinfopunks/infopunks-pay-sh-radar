// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function service(name: string, overrides: Record<string, unknown> = {}) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id,
    name,
    provider: name === 'QVAC' ? 'Tether' : name === 'ChatGPT' ? 'OpenAI' : name === 'Claude' ? 'Anthropic' : name,
    category: 'web',
    market_type: 'digital',
    source_market: 'agentic.market',
    chain: 'base',
    status: 'ready',
    price_display: '$0.001',
    description: `${name} service metadata.`,
    machine_use_case: `${name} machine use case.`,
    evidence_health: 'scaffold',
    evidence_stage: 'policy-mapped',
    policy_risk: `${name} requires spend policy.`,
    caveats: ['Static robotic.sh service mirror for Phase 2 only.'],
    observed_source: 'robotic.sh',
    observed_at: '2026-05-22T00:00:00.000Z',
    phase_scope: 'phase_2_pay_sh_robotic_sh',
    ...overrides
  };
}

const services = [
  service('QVAC', { category: 'compute', market_type: 'all-compatible', source_market: 'robotic.sh', chain: 'peaq', status: 'setup', price_display: '$0.01 / sec' }),
  service('Generative Language', { category: 'inference', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('BigQuery', { source_market: 'pay.sh', chain: 'solana', price_display: '$0.001', provider: 'Google' }),
  service('Document AI', { category: 'vision', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('Stableupload', { category: 'storage', source_market: 'pay.sh', chain: 'solana', price_display: '$0.02', provider: 'Stableupload' }),
  service('Cloud Translation', { category: 'translation', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('Claude', { category: 'inference' }),
  service('ChatGPT', { category: 'inference' }),
  service('2Captcha'),
  service('Firecrawl'),
  service('Wolfram Alpha', { category: 'inference', provider: 'Wolfram Research' }),
  service('Exa'),
  service('NAVER Maps', {
    category: 'navigation',
    market_type: 'physical',
    source_market: 'robotic.sh',
    chain: 'unknown',
    price_display: 'not recorded',
    provider: 'NAVER',
    machine_use_case: 'Autonomous robots can request routing, geocoding, and navigation context before moving or rerouting.',
    policy_risk: 'High machine relevance: routing outputs can influence physical-world movement. Execution requires bounded test scenarios, source validation, and clear non-operational constraints.',
    caveats: ['Public demo context observed: peaq showcased NAVER Maps in a simulated Serve Robotics workflow with USDT settlement on Solana. Radar has not executed this service.']
  })
];

const cloudTranslationReceipt = {
  receipt_id: 'mrx_cloud_translation_001',
  receipt_type: 'machine_preflight',
  coverage_run_id: 'mcr_coverage_001',
  demo_mode: false,
  execution_occurred: false,
  payment_occurred: false,
  execution_status: 'not_attempted',
  execution_service_id: null,
  execution_provider: null,
  execution_started_at: null,
  execution_completed_at: null,
  execution_latency_ms: null,
  execution_request_summary: null,
  execution_response_summary: null,
  execution_error: null,
  payment_evidence: null,
  preflight_receipt_id: null,
  execution_run_id: null,
  machine_id: 'did:peaq:field-bot-07',
  policy_id: 'field-maintenance-bot',
  intent: 'translate customer delivery note',
  requested_category: 'translation',
  selected_service_id: 'cloud-translation',
  selected_service_name: 'Cloud Translation',
  source_market: 'pay.sh',
  chain: 'solana',
  decision: 'allow',
  reason: 'translation task matched an allowed Pay.sh route',
  policy_checks: [],
  violations: [],
  review_reasons: [],
  caveats: ['Coverage run records decision receipts only.'],
  max_cost_usd: 0.05,
  evidence_stage: 'policy-mapped',
  evidence_health: 'scaffold',
  phase_scope: 'phase_2_pay_sh_robotic_sh',
  created_at: '2026-05-22T00:00:00.000Z'
};

const alibabaExecutionReceipt = {
  ...cloudTranslationReceipt,
  receipt_id: 'mrx_exec_alibaba_001',
  receipt_type: 'machine_execution',
  execution_occurred: true,
  execution_status: 'succeeded',
  execution_service_id: 'alibaba-machine-translation-general',
  selected_service_id: 'alibaba-machine-translation-general',
  selected_service_name: 'Alibaba Machine Translation General',
  evidence_stage: 'execution-tested'
};

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function installFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/machine-market/services') return json({ count: 13, services });
    if (path === '/v1/machine-preflight/receipts/recent') return json({ count: 2, receipts: [cloudTranslationReceipt, alibabaExecutionReceipt] });
    if (path === '/v1/machine-preflight/coverage-runs/recent') return json({
      count: 1,
      runs: [{
        run_id: 'mcr_coverage_001',
        generated_at: '2026-05-22T00:10:00.000Z',
        services_total: 13,
        preflight_evaluated: 13,
        receipts_recorded: 13,
        allow_count: 6,
        review_count: 4,
        deny_count: 2,
        execution_occurred: false,
        payment_occurred: false,
        phase_scope: 'phase_2_pay_sh_robotic_sh',
        storage: { adapter: 'memory', mode: 'test', durable: false },
        caveats: ['Coverage run records decision receipts only.'],
        service_results: [{ service_id: 'cloud-translation', service_name: 'Cloud Translation', decision: 'allow', receipt_id: 'mrx_cloud_translation_001', execution_occurred: false, payment_occurred: false }]
      }]
    });
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function renderPath(container: HTMLDivElement, path: string) {
  window.history.pushState({}, '', path);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

describe('machine service dossier page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    installFetch();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders a known robotic.sh visible service dossier with catalog fields', async () => {
    root = await renderPath(container, '/machine-service/cloud-translation');

    const text = container.textContent ?? '';
    expect(text).toContain('Machine Service Dossier');
    expect(text).toContain('Cloud Translation');
    expect(text).toContain('service_idcloud-translation');
    expect(text).toContain('providerGoogle');
    expect(text).toContain('categorytranslation');
    expect(text).toContain('source_marketpay.sh');
    expect(text).toContain('chainsolana');
    expect(text).toContain('statusready');
    expect(text).toContain('evidence_stagepolicy-mapped');
    expect(text).toContain('evidence_healthscaffold');
    expect(text).toContain('policy_riskCloud Translation requires spend policy.');
  });

  it('shows latest coverage and preflight decisions without implying execution', async () => {
    root = await renderPath(container, '/machine-service/cloud-translation');

    const policy = container.querySelector('[aria-label="Policy and readiness"]')?.textContent ?? '';
    const execution = container.querySelector('[aria-label="Execution status"]')?.textContent ?? '';

    expect(policy).toContain('latest coverage decisionallow');
    expect(policy).toContain('latest preflight receipt idmrx_cloud_translation_001');
    expect(policy).toContain('latest decisionallow');
    expect(execution).toContain('not_attempted');
    expect(execution).toContain('No execution receipt recorded for this robotic.sh-listed service yet.');
    expect(execution).not.toContain('latest execution receipt id');
  });

  it('includes Pay.sh separation note', async () => {
    root = await renderPath(container, '/machine-service/cloud-translation');

    expect(container.textContent).toContain('Pay.sh execution candidates are tracked separately from the robotic.sh visible service mirror.');
    expect(container.textContent).toContain('Alibaba Machine Translation General is the first execution-tested Pay.sh route; it is not counted as one of the 13 visible robotic.sh services unless robotic.sh lists it.');
    expect(container.querySelector('a[href="/machine-execution-shortlist"]')).not.toBeNull();
    expect(container.querySelector('a[href="/machine-execution-plan/cloud-translation"]')?.textContent).toContain('View execution proof plan');
  });

  it('shows NAVER-specific proof-path link from the dossier', async () => {
    root = await renderPath(container, '/machine-service/naver-maps');

    expect(container.textContent).toContain('NAVER Maps');
    expect(container.querySelector('a[href="/machine-execution-plan/naver-maps"]')?.textContent).toContain('View NAVER Maps proof path');
  });

  it('shows unknown service not-found state', async () => {
    root = await renderPath(container, '/machine-service/not-in-mirror');

    expect(container.textContent).toContain('Machine service not found.');
    expect(container.textContent).toContain('This service is not in the current robotic.sh visible service mirror.');
    expect(container.querySelector('.machine-receipts-empty a[href="/machine-market"]')?.textContent).toContain('Back to Machine Market');
  });
});
