// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const serviceNames = [
  'QVAC',
  'Generative Language',
  'BigQuery',
  'Document AI',
  'Stableupload',
  'Cloud Translation',
  'Claude',
  'ChatGPT',
  '2Captcha',
  'Firecrawl',
  'Wolfram Alpha',
  'Exa',
  'NAVER Maps'
];

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
    access_rail: 'not_recorded',
    rail_status: 'not_recorded',
    route_surface_status: 'not_recorded',
    endpoint_count: null,
    pricing_model: 'not recorded',
    credential_requirement: 'not recorded',
    first_safe_route: 'not recorded',
    rail_caveat: 'rail surface not recorded in the current registry',
    observed_source: 'robotic.sh',
    observed_at: '2026-05-22T00:00:00.000Z',
    phase_scope: 'phase_2_pay_sh_robotic_sh',
    ...overrides
  };
}

const services = [
  service('QVAC', {
    category: 'compute',
    market_type: 'all-compatible',
    source_market: 'robotic.sh',
    chain: 'peaq',
    status: 'setup',
    price_display: '$0.01 / sec',
    access_rail: 'peaqos_market_operator_defined',
    rail_status: 'review_required',
    route_surface_status: 'operator_runtime_required',
    endpoint_count: 2,
    pricing_model: 'operator-defined',
    credential_requirement: 'runtime endpoint registration required',
    first_safe_route: 'non-operational runtime registration review',
    rail_caveat: 'setup required before autonomous calls'
  }),
  service('Generative Language', {
    category: 'inference',
    source_market: 'pay.sh',
    chain: 'solana',
    price_display: 'Per endpoint',
    provider: 'Google',
    access_rail: 'pay_sh_solana',
    rail_status: 'review_required',
    route_surface_status: 'no_callable_endpoints',
    endpoint_count: 0,
    pricing_model: 'per endpoint',
    rail_caveat: 'pay.sh lists provider but current registry exposes no callable endpoints'
  }),
  service('BigQuery', {
    source_market: 'pay.sh',
    chain: 'solana',
    provider: 'Google',
    access_rail: 'pay_sh_solana',
    rail_status: 'plan_eligible',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 2,
    pricing_model: '$0.001',
    first_safe_route: 'bounded query result lookup',
    rail_caveat: 'catalog route surface only; Radar has not executed routes'
  }),
  service('Document AI', {
    category: 'vision',
    source_market: 'pay.sh',
    chain: 'solana',
    price_display: 'Per endpoint',
    provider: 'Google',
    access_rail: 'pay_sh_solana',
    rail_status: 'review_required',
    route_surface_status: 'no_callable_endpoints',
    endpoint_count: 0,
    pricing_model: 'per endpoint',
    rail_caveat: 'pay.sh lists provider but current registry exposes no callable endpoints'
  }),
  service('Stableupload', {
    category: 'storage',
    source_market: 'pay.sh',
    chain: 'solana',
    price_display: '$0.02',
    provider: 'Stableupload',
    access_rail: 'pay_sh_solana',
    rail_status: 'review_required',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 3,
    pricing_model: '$0.02',
    first_safe_route: 'tiny non-sensitive fixture upload'
  }),
  service('Cloud Translation', {
    category: 'translation',
    source_market: 'pay.sh',
    chain: 'solana',
    price_display: 'Per endpoint',
    provider: 'Google',
    access_rail: 'pay_sh_solana',
    rail_status: 'proof_plan_selected',
    route_surface_status: 'no_callable_endpoints',
    endpoint_count: 0,
    pricing_model: 'per endpoint',
    rail_caveat: 'selected proof plan, not execution-tested by Radar'
  }),
  service('Claude', { category: 'inference', provider: 'Anthropic' }),
  service('ChatGPT', { category: 'inference', provider: 'OpenAI' }),
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
    caveats: ['Public demo context observed: peaq showcased NAVER Maps in a simulated Serve Robotics workflow with USDT settlement on Solana. Radar has not executed this service.'],
    access_rail: 'peaqos_market_provider_account',
    rail_status: 'review_required',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 4,
    pricing_model: 'Naver Cloud account pricing',
    credential_requirement: 'Naver Cloud provider credentials required',
    first_safe_route: 'geocode lookup',
    rail_caveat: 'catalog route surface only; Radar has not executed routes'
  })
];

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
    if (path === '/v1/machine-preflight/receipts/recent') return json({
      count: 1,
      receipts: [{
        receipt_id: 'mrx_exec_20260522000000000_0002',
        receipt_type: 'machine_execution',
        demo_mode: false,
        execution_occurred: true,
        payment_occurred: false,
        execution_status: 'succeeded',
        execution_service_id: 'alibaba-machine-translation-general',
        execution_provider: 'Alibaba Cloud',
        execution_started_at: '2026-05-22T00:00:00.000Z',
        execution_completed_at: '2026-05-22T00:00:01.000Z',
        execution_latency_ms: 1000,
        execution_request_summary: '{}',
        execution_response_summary: '{}',
        execution_error: null,
        payment_evidence: null,
        preflight_receipt_id: 'mrx_preflight',
        execution_run_id: 'mxr_1',
        machine_id: 'did:peaq:anytrans-prod-smoke',
        policy_id: 'field-maintenance-bot',
        intent: 'external execution artifact ingest',
        requested_category: 'translation',
        selected_service_id: 'alibaba-machine-translation-general',
        selected_service_name: 'Alibaba Machine Translation General',
        source_market: 'pay.sh',
        chain: 'solana',
        decision: 'allow',
        reason: 'external execution artifact',
        policy_checks: [],
        violations: [],
        review_reasons: [],
        caveats: [],
        max_cost_usd: null,
        evidence_stage: 'execution-tested',
        evidence_health: 'scaffold',
        phase_scope: 'phase_2_pay_sh_robotic_sh',
        created_at: '2026-05-22T00:00:01.000Z'
      }]
    });
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

describe('machine rail coverage page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-rail-coverage');
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

  it('renders machine rail coverage with all 13 services and summary cards', async () => {
    root = await renderPage(container);

    expect(container.textContent).toContain('Machine Execution Rail Coverage');
    expect(container.textContent).toContain('Radar separates robotic.sh catalog presence from access rail readiness, callable route surfaces, credentials, pricing, and receipt-bound execution evidence.');
    expect(container.textContent).toContain('which rail, which route, under which proof conditions');
    expect(container.querySelector('[aria-label="Machine rail coverage hero chips"]')?.textContent).toContain('13 services mapped');
    expect(container.querySelector('[aria-label="Machine rail coverage hero chips"]')?.textContent).toContain('access rails classified');
    expect(container.querySelector('[aria-label="Machine rail coverage hero chips"]')?.textContent).toContain('route surfaces separated');
    expect(container.querySelector('[aria-label="Machine rail coverage hero chips"]')?.textContent).toContain('0 execution receipts');
    expect(container.querySelector('[aria-label="Machine rail coverage summary"]')?.textContent).toContain('Services mapped13');
    expect(container.querySelector('[aria-label="Machine rail coverage summary"]')?.textContent).toContain('Pay.sh / Solana rails5');
    expect(container.querySelector('[aria-label="Machine rail coverage summary"]')?.textContent).toContain('peaqOS / provider-account rails1');
    expect(container.querySelector('[aria-label="Machine rail coverage summary"]')?.textContent).toContain('Callable route surfaces3');
    expect(container.querySelector('[aria-label="Machine rail coverage summary"]')?.textContent).toContain('Provider/operator setup required1');
    expect(container.querySelector('[aria-label="Machine rail coverage summary"]')?.textContent).toContain('No callable endpoint recorded3');
    expect(container.querySelector('[aria-label="Machine rail coverage summary"]')?.textContent).toContain('Execution receipts0');
    expect(container.querySelector('[aria-label="Machine rail coverage summary"]')?.textContent).toContain('Repeatability receipts0');
    expect(container.querySelector('[aria-label="Machine rail interpretation strip"]')?.textContent).toContain('Listed ≠ callable');
    expect(container.querySelector('[aria-label="Machine rail interpretation strip"]')?.textContent).toContain('Callable ≠ executed');
    expect(container.querySelector('[aria-label="Machine rail interpretation strip"]')?.textContent).toContain('Credentials ≠ payment proof');
    expect(container.querySelector('[aria-label="Machine rail interpretation strip"]')?.textContent).toContain('Route surface ≠ receipt');
    expect(container.querySelector('[aria-label="Machine rail methodology"]')?.textContent).toContain('access_rail');
    expect(container.querySelector('[aria-label="Machine rail methodology"]')?.textContent).toContain('execution_receipt');
    for (const name of serviceNames) expect(container.textContent).toContain(name);
  });

  it('renders service-specific rail metadata without introducing execution, payment, benchmark, or winner claims', async () => {
    root = await renderPage(container);

    const table = container.querySelector('[aria-label="Machine rail coverage table"]');
    const text = table?.textContent ?? '';

    expect(text).toContain('NAVER Maps');
    expect(text).toContain('Pay.sh / Solana');
    expect(text).toContain('Naver Cloud account pricing');
    expect(text).toContain('Naver Cloud provider credentials required');
    expect(text).toContain('review_required');
    expect(text).toContain('operator-defined');
    expect(text).toContain('runtime endpoint registration required');
    expect(text).toContain('$0.001');
    expect(text).toContain('$0.02');
    expect(text).toContain('proof_plan_selected');
    expect(text).toContain('not execution-tested');
    expect(text).toContain('callable_routes_listed');
    expect(text).toContain('operator_runtime_required');
    expect(text).toContain('no_callable_endpoints');

    const rowTexts = Array.from(container.querySelectorAll('.machine-rail-row')).map((row) => row.textContent ?? '');
    const naverRow = rowTexts.find((row) => row.includes('NAVER Maps')) ?? '';
    const qvacRow = rowTexts.find((row) => row.includes('QVAC')) ?? '';
    const bigQueryRow = rowTexts.find((row) => row.includes('BigQuery')) ?? '';
    const stableuploadRow = rowTexts.find((row) => row.includes('Stableupload')) ?? '';
    const cloudTranslationRow = rowTexts.find((row) => row.includes('Cloud Translation')) ?? '';
    const generativeLanguageRow = rowTexts.find((row) => row.includes('Generative Language')) ?? '';

    expect(naverRow).toContain('peaqOS / provider account');
    expect(naverRow).toContain('4');
    expect(naverRow).toContain('review_required');
    expect(naverRow).toContain('View rail-aware proof plan');
    expect(qvacRow).toContain('peaqOS / operator-defined');
    expect(qvacRow).toContain('operator_runtime_required');
    expect(qvacRow).toContain('runtime endpoint registration required');
    expect(bigQueryRow).toContain('Pay.sh / Solana');
    expect(bigQueryRow).toContain('$0.001');
    expect(bigQueryRow).toContain('2');
    expect(bigQueryRow).toContain('bounded query result lookup');
    expect(stableuploadRow).toContain('Pay.sh / Solana');
    expect(stableuploadRow).toContain('$0.02');
    expect(stableuploadRow).toContain('3');
    expect(stableuploadRow).toContain('tiny non-sensitive fixture upload');
    expect(cloudTranslationRow).toContain('proof_plan_selected');
    expect(cloudTranslationRow).toContain('not execution-tested');
    expect(generativeLanguageRow).toContain('no_callable_endpoints');
    expect(generativeLanguageRow).toContain('not execution-tested');

    expect(container.textContent).toContain('No execution claim. No benchmark claim. No winner claim. No payment success claim.');
    expect(container.textContent).toContain('Pay.sh availability does not imply Radar execution.');
    expect(container.textContent).toContain('robotic.sh listing does not imply callable route readiness.');
    expect(container.textContent).toContain('Callable routes do not imply executed routes.');
    expect(container.textContent).toContain('Credentials do not imply payment proof.');
    expect(container.textContent).toContain('Execution requires service-specific receipts.');
    expect(container.querySelector('.machine-market-caveat a[href="/machine-route-risk-matrix"]')?.textContent).toContain('View route risk matrix');
    expect(container.querySelector('.machine-market-caveat a[href="/machine-first-safe-routes"]')?.textContent).toContain('View first safe route queue');
    expect(container.textContent).not.toMatch(/payment succeeded|execution succeeded|winner:|benchmark winner|payment confirmed|payment was successful|execution was successful/i);
  });

  it('links rail coverage rows to rail-aware proof plans', async () => {
    root = await renderPage(container);

    const naverLink = container.querySelector('a[href="/machine-execution-plan/naver-maps"]');
    const bigQueryLink = container.querySelector('a[href="/machine-execution-plan/bigquery"]');

    expect(naverLink?.textContent).toContain('View rail-aware proof plan');
    expect(bigQueryLink?.textContent).toContain('View rail-aware proof plan');
  });
});
