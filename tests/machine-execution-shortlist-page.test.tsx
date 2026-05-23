// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const serviceNames = ['QVAC', 'Generative Language', 'BigQuery', 'Document AI', 'Stableupload', 'Cloud Translation', 'Claude', 'ChatGPT', '2Captcha', 'Firecrawl', 'Wolfram Alpha', 'Exa', 'NAVER Maps'];

function service(name: string, overrides: Record<string, unknown> = {}) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id,
    name,
    provider: name === 'QVAC' ? 'Tether' : name === 'ChatGPT' ? 'OpenAI' : name === 'Claude' ? 'Anthropic' : name === 'Wolfram Alpha' ? 'Wolfram Research' : name,
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
  service('QVAC', { category: 'compute', market_type: 'all-compatible', source_market: 'robotic.sh', chain: 'peaq', status: 'setup', price_display: '$0.01 / sec', policy_risk: 'Requires setup and attestation review before execution.' }),
  service('Generative Language', { category: 'inference', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('BigQuery', { source_market: 'pay.sh', chain: 'solana', price_display: '$0.001', provider: 'Google' }),
  service('Document AI', { category: 'vision', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('Stableupload', { category: 'storage', source_market: 'pay.sh', chain: 'solana', price_display: '$0.02', provider: 'Stableupload' }),
  service('Cloud Translation', { category: 'translation', source_market: 'pay.sh', chain: 'solana', price_display: 'Per endpoint', provider: 'Google' }),
  service('Claude', { category: 'inference' }),
  service('ChatGPT', { category: 'inference' }),
  service('2Captcha', { policy_risk: 'Captcha solving can violate site terms or anti-abuse controls; default policy should block unless explicitly approved.' }),
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
    policy_risk: 'High machine relevance: routing outputs can influence physical-world movement. Execution requires bounded test scenarios, source validation, and clear non-operational constraints.'
  })
];

const receipts = [
  receipt('cloud-translation', 'Cloud Translation', 'allow', 'mrx_cloud_translation_001'),
  receipt('qvac', 'QVAC', 'review', 'mrx_qvac_001'),
  receipt('2captcha', '2Captcha', 'deny', 'mrx_2captcha_001'),
  receipt('naver-maps', 'NAVER Maps', 'review', 'mrx_naver_maps_001')
];

function receipt(serviceId: string, serviceName: string, decision: 'allow' | 'review' | 'deny', receiptId: string) {
  return {
    receipt_id: receiptId,
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
    machine_id: 'did:peaq:test-bot',
    policy_id: 'field-maintenance-bot',
    intent: `preflight ${serviceName}`,
    requested_category: 'translation',
    selected_service_id: serviceId,
    selected_service_name: serviceName,
    source_market: serviceId === 'qvac' ? 'robotic.sh' : 'pay.sh',
    chain: serviceId === 'qvac' ? 'peaq' : 'solana',
    decision,
    reason: `${decision} policy decision`,
    policy_checks: [],
    violations: decision === 'deny' ? ['service_not_blocked'] : [],
    review_reasons: decision === 'review' ? ['setup_status'] : [],
    caveats: ['Coverage run records decision receipts only.'],
    max_cost_usd: 0.05,
    evidence_stage: 'policy-mapped',
    evidence_health: 'scaffold',
    phase_scope: 'phase_2_pay_sh_robotic_sh',
    created_at: '2026-05-22T00:00:00.000Z'
  };
}

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function installFetch(options: { missingEvidence?: boolean } = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = pathOf(input);
    if (path === '/v1/machine-market/services') return json({ count: 13, services });
    if (path === '/v1/machine-preflight/receipts/recent') {
      if (options.missingEvidence) return Promise.resolve(new Response('{}', { status: 404 }));
      return json({ count: receipts.length, receipts });
    }
    if (path === '/v1/machine-preflight/coverage-runs/recent') {
      if (options.missingEvidence) return Promise.resolve(new Response('{}', { status: 404 }));
      return json({
        count: 1,
        runs: [{
          run_id: 'mcr_coverage_001',
          generated_at: '2026-05-22T00:10:00.000Z',
          services_total: 13,
          preflight_evaluated: 13,
          receipts_recorded: 13,
          allow_count: 1,
          review_count: 1,
          deny_count: 1,
          execution_occurred: false,
          payment_occurred: false,
          phase_scope: 'phase_2_pay_sh_robotic_sh',
          storage: { adapter: 'memory', mode: 'test', durable: false },
          caveats: ['Coverage run records decision receipts only.'],
          service_results: receipts.map((item) => ({
            service_id: item.selected_service_id,
            service_name: item.selected_service_name,
            decision: item.decision,
            receipt_id: item.receipt_id,
            execution_occurred: false,
            payment_occurred: false
          }))
        }]
      });
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function renderPage(container: HTMLDivElement) {
  window.history.pushState({}, '', '/machine-execution-shortlist');
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

describe('machine execution shortlist page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders shortlist with all 13 robotic.sh-visible services', async () => {
    installFetch();
    root = await renderPage(container);

    expect(container.textContent).toContain('Robotic.sh Execution Candidate Shortlist');
    for (const name of serviceNames) expect(container.textContent).toContain(name);
  });

  it('shows candidate score, tier, recommendation, top panel, and methodology', async () => {
    installFetch();
    root = await renderPage(container);

    const text = container.textContent ?? '';
    expect(text).toContain('Cloud Translation');
    expect(text).toContain('overall candidate score');
    expect(text).toContain('candidate tier');
    expect(text).toContain('next_execution_candidate');
    expect(container.querySelector('a[href="/machine-execution-plan/cloud-translation"]')?.textContent).toContain('View proof plan');
    expect(text).toContain('Radar recommends this as the clearest next execution candidate among the 13 robotic.sh-visible services. This is not an execution claim.');
    expect(container.querySelector('[aria-label="Evidence methodology drawer"]')?.textContent).toContain('Evidence methodology');
    expect(container.querySelector('[aria-label="Evidence methodology drawer"]')?.textContent).toContain('proof_plan_selected');
    expect(container.querySelector('[aria-label="Shortlist methodology"]')?.textContent).toContain('Shortlist ranking evaluates readiness for future execution.');
    expect(container.querySelector('[aria-label="Robotic.sh execution candidate table"]')?.textContent).toContain('View service dossier');
  });

  it('does not mark robotic.sh-visible rows execution-tested without service execution receipts', async () => {
    installFetch();
    root = await renderPage(container);

    const tableText = container.querySelector('[aria-label="Robotic.sh execution candidate table"]')?.textContent ?? '';
    expect(tableText).toContain('not_attempted');
    expect(tableText).not.toContain('execution-tested');
    expect(tableText).not.toContain('winner');
    expect(tableText).not.toContain('best provider');
  });

  it('preserves Pay.sh separation language', async () => {
    installFetch();
    root = await renderPage(container);

    expect(container.textContent).toContain('Pay.sh execution candidates are tracked separately from the robotic.sh visible service mirror.');
  });

  it('renders catalog services when preflight and coverage data are missing', async () => {
    installFetch({ missingEvidence: true });
    root = await renderPage(container);

    expect(container.textContent).toContain('13 robotic.sh-visible services');
    expect(container.textContent).toContain('not recorded');
    expect(container.textContent).toContain('No preflight/coverage decision recorded.');
  });
});
