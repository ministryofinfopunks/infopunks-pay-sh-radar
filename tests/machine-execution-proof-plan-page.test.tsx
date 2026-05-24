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
    provider: name === 'Cloud Translation' ? 'Google' : name === 'NAVER Maps' ? 'NAVER' : name,
    category: name === 'Cloud Translation' ? 'translation' : name === 'NAVER Maps' ? 'navigation' : 'web',
    market_type: name === 'NAVER Maps' ? 'physical' : 'digital',
    source_market: name === 'NAVER Maps' ? 'robotic.sh' : 'pay.sh',
    chain: name === 'NAVER Maps' ? 'unknown' : 'solana',
    status: 'ready',
    price_display: name === 'NAVER Maps' ? 'not recorded' : 'Per endpoint',
    description: `${name} service metadata.`,
    machine_use_case: `${name} machine use case.`,
    evidence_health: 'scaffold',
    evidence_stage: 'policy-mapped',
    policy_risk: name === 'NAVER Maps'
      ? 'High machine relevance: routing outputs can influence physical-world movement. Execution requires bounded test scenarios, source validation, and clear non-operational constraints.'
      : `${name} requires spend policy.`,
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
  service('Cloud Translation', {
    source_market: 'pay.sh',
    chain: 'solana',
    access_rail: 'pay_sh_solana',
    rail_status: 'proof_plan_selected',
    route_surface_status: 'no_callable_endpoints',
    endpoint_count: 0,
    pricing_model: 'per endpoint',
    rail_caveat: 'selected proof plan, not execution-tested by Radar'
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
  service('Stableupload', {
    category: 'storage',
    source_market: 'pay.sh',
    chain: 'solana',
    provider: 'Stableupload',
    access_rail: 'pay_sh_solana',
    rail_status: 'review_required',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 3,
    pricing_model: '$0.02',
    first_safe_route: 'tiny non-sensitive fixture upload',
    rail_caveat: 'catalog route surface only; storage policy review remains required before execution claims'
  }),
  service('QVAC', { id: 'qvac', source_market: 'robotic.sh', chain: 'peaq', status: 'setup', category: 'compute' }),
  service('NAVER Maps', {
    access_rail: 'peaqos_market_provider_account',
    rail_status: 'review_required',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 4,
    machine_use_case: 'Autonomous robots can request routing, geocoding, and navigation context before moving or rerouting.',
    route_count: 4,
    pricing_model: 'Naver Cloud account pricing',
    credential_requirement: 'Naver Cloud provider credentials required',
    first_safe_route: 'geocode lookup',
    rail_caveat: 'catalog route surface only; Radar has not executed routes',
    catalog_routes: [
      { method: 'GET', path: '/map-geocode/v2/geocode', label: 'Geocode', risk: 'low_to_medium' },
      { method: 'GET', path: '/map-reversegeocode/v2/gc', label: 'Reverse geocode', risk: 'low_to_medium' },
      { method: 'GET', path: '/map-direction/v1/driving', label: 'Driving directions', risk: 'high' },
      { method: 'GET', path: '/map-static/v2/raster', label: 'Static map', risk: 'low_to_medium' }
    ],
    caveats: ['Public demo context observed: peaq showcased NAVER Maps in a simulated Serve Robotics workflow with USDT settlement on Solana. Radar has not executed this service.']
  })
];

const receipts = [{
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
}, {
  receipt_id: 'mrx_naver_maps_001',
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
  machine_id: 'did:peaq:delivery-bot-nav-01',
  policy_id: 'delivery-robot',
  intent: 'lookup safe navigation context',
  requested_category: 'navigation',
  selected_service_id: 'naver-maps',
  selected_service_name: 'NAVER Maps',
  source_market: 'robotic.sh',
  chain: 'unknown',
  decision: 'review',
  reason: 'navigation task requires review before spend',
  policy_checks: [],
  violations: [],
  review_reasons: ['risk_tolerance_compatible'],
  caveats: ['Public demo context observed: peaq showcased NAVER Maps in a simulated Serve Robotics workflow with USDT settlement on Solana. Radar has not executed this service.'],
  max_cost_usd: 0.05,
  evidence_stage: 'policy-mapped',
  evidence_health: 'scaffold',
  phase_scope: 'phase_2_pay_sh_robotic_sh',
  created_at: '2026-05-22T00:00:00.000Z'
}];

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
    if (path === '/v1/machine-market/services') return json({ count: services.length, services });
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
          services_total: 3,
          preflight_evaluated: 3,
          receipts_recorded: 3,
          allow_count: 1,
          review_count: 2,
          deny_count: 0,
          execution_occurred: false,
          payment_occurred: false,
          phase_scope: 'phase_2_pay_sh_robotic_sh',
          storage: { adapter: 'memory', mode: 'test', durable: false },
          caveats: ['Coverage run records decision receipts only.'],
          service_results: [
            { service_id: 'cloud-translation', service_name: 'Cloud Translation', decision: 'allow', receipt_id: 'mrx_cloud_translation_001', execution_occurred: false, payment_occurred: false },
            { service_id: 'naver-maps', service_name: 'NAVER Maps', decision: 'review', receipt_id: 'mrx_naver_maps_001', execution_occurred: false, payment_occurred: false }
          ]
        }]
      });
    }
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

describe('machine execution proof plan page', () => {
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

  it('renders proof plan for known service with candidate score/tier/recommendation', async () => {
    installFetch();
    root = await renderPath(container, '/machine-execution-plan/cloud-translation');

    const text = container.textContent ?? '';
    expect(text).toContain('Candidate Execution Proof Plan');
    expect(text).toContain('Cloud Translation');
    expect(text).toContain('overall_candidate_score');
    expect(text).toContain('candidate_tier');
    expect(text).toContain('recommendation');
    expect(text).toContain('latest policy decision');
  });

  it('shows checklist, translation safe input, and success/failure criteria', async () => {
    installFetch();
    root = await renderPath(container, '/machine-execution-plan/cloud-translation');

    const checklist = container.querySelector('[aria-label="Pre-execution checklist"]')?.textContent ?? '';
    const safeInput = container.querySelector('[aria-label="Safe test input"]')?.textContent ?? '';
    const criteria = container.querySelector('[aria-label="Success and failure criteria"]')?.textContent ?? '';
    const railPlan = container.querySelector('[aria-label="Rail-aware proof planning"]')?.textContent ?? '';
    const railGate = container.querySelector('[aria-label="Rail execution gate"]')?.textContent ?? '';
    const evidence = container.querySelector('[aria-label="Evidence to collect"]')?.textContent ?? '';

    expect(checklist).toContain('catalog identity verified');
    expect(checklist).toContain('latest preflight receipt available');
    expect(safeInput).toContain('hello machine market');
    expect(safeInput).toContain('Spanish');
    expect(railPlan).toContain('Rail-aware proof planning');
    expect(railPlan).toContain('access rail');
    expect(railPlan).toContain('route surface status');
    expect(railPlan).toContain('credential requirement');
    expect(railPlan).toContain('first safe route');
    expect(railPlan).toContain('rail caveat');
    expect(railPlan).toContain('No callable endpoint surface is currently recorded. Proof planning should not advance to execution.');
    expect(railPlan).toContain('selected proof plan does not imply execution-tested');
    expect(railGate).toContain('gate status');
    expect(evidence).toContain('access_rail');
    expect(evidence).toContain('selected_route');
    expect(evidence).toContain('credential_status');
    expect(evidence).toContain('rail_caveats');
    expect(criteria).toContain('Success criteria');
    expect(criteria).toContain('Failure criteria');
    expect(criteria).toContain('receipt is recorded');
    expect(criteria).toContain('no durable receipt');
  });

  it('does not claim execution success', async () => {
    installFetch();
    root = await renderPath(container, '/machine-execution-plan/cloud-translation');

    const text = container.textContent ?? '';
    expect(text).toContain('Planning only: no service execution is performed from this page, and no execution claim is made.');
    expect(container.querySelector('[aria-label="Evidence methodology drawer"]')?.textContent).toContain('proof_plan_selected');
    expect(container.querySelector('[aria-label="Evidence methodology drawer"]')?.textContent).toContain('This is not an execution claim.');
    expect(text).toContain('Cloud Translation remains the selected controlled proof-plan action. This does not imply execution-tested status.');
    expect(text).toContain('View rail coverage');
    expect(text).not.toContain('execution succeeded');
    expect(text).not.toContain('benchmark winner');
    expect(text).not.toMatch(/NAVER Maps executed|NAVER execution proven|robotic\.sh market execution proven|payment success proven|best route|best provider|market-wide execution proven/i);
  });

  it('renders proof source attribution without introducing execution claims', async () => {
    installFetch();
    root = await renderPath(container, '/machine-execution-plan/naver-maps');
    const text = container.querySelector('[aria-label="Proof source attribution"]')?.textContent ?? '';
    expect(text).toContain('robotic.sh service page');
    expect(text).toContain('public demo context');
    expect(text).toContain('manual scaffold');
    expect(text).toContain('route surface');
    expect(text).toContain('Public context only; not Radar execution evidence, not payment proof.');
    expect(text).toContain('Radar receipt ledger');
    expect(text).toContain('No service-specific execution receipt recorded.');
  });

  it('renders NAVER Maps proof path with review state, non-operational test, and context-only demo note', async () => {
    installFetch();
    root = await renderPath(container, '/machine-execution-plan/naver-maps');

    const text = container.textContent ?? '';
    const safeInput = container.querySelector('[aria-label="Safe test input"]')?.textContent ?? '';
    const routeSurface = container.querySelector('[aria-label="Candidate route surface"]')?.textContent ?? '';
    const criteria = container.querySelector('[aria-label="Success and failure criteria"]')?.textContent ?? '';
    const evidence = container.querySelector('[aria-label="Evidence to collect"]')?.textContent ?? '';
    const risk = container.querySelector('[aria-label="Physical-world routing risk"]')?.textContent ?? '';
    const context = container.querySelector('[aria-label="Public demo context"]')?.textContent ?? '';
    const railPlan = container.querySelector('[aria-label="Rail-aware proof planning"]')?.textContent ?? '';
    const railGate = container.querySelector('[aria-label="Rail execution gate"]')?.textContent ?? '';

    expect(text).toContain('NAVER Maps');
    expect(text).toContain('latest policy decisionreview');
    expect(text).toContain('evidence_healthscaffold');
    expect(text).toContain('execution_statusnot_attempted');
    expect(railPlan).toContain('peaqOS / provider account');
    expect(railPlan).toContain('callable routes listed');
    expect(railPlan).toContain('4');
    expect(railPlan).toContain('Naver Cloud account pricing');
    expect(railPlan).toContain('Naver Cloud provider credentials required');
    expect(railPlan).toContain('geocode lookup');
    expect(railPlan).toContain('catalog route surface only; Radar has not executed routes');
    expect(railPlan).toContain('Preferred first route');
    expect(railPlan).toContain('Geocode lookup');
    expect(railPlan).toContain('Avoid first');
    expect(railPlan).toContain('Driving directions');
    expect(railPlan).toContain('Driving directions can influence physical-world routing. Start with bounded geocode/static-map style checks before route guidance.');
    expect(railGate).toContain('review_required');
    expect(safeInput).toContain('Geocode lookup for a public landmark or generic address');
    expect(safeInput).toContain('Static map retrieval before any driving directions route');
    expect(safeInput).toContain('no robot command, no dispatch, no live navigation, no physical movement');
    expect(routeSurface).toContain('Candidate Route Surface');
    expect(routeSurface).toContain('Driving directions has higher physical-world risk because route output can influence robot movement.');
    expect(routeSurface).toContain('Initial proof planning should prefer geocode or static map before driving directions.');
    expect(routeSurface).toContain('/map-geocode/v2/geocode');
    expect(routeSurface).toContain('/map-reversegeocode/v2/gc');
    expect(routeSurface).toContain('/map-direction/v1/driving');
    expect(routeSurface).toContain('/map-static/v2/raster');
    expect(routeSurface).toContain('not execution receipts');
    expect(risk).toContain('Routing outputs can influence physical-world movement. NAVER Maps requires review, bounded test inputs, and non-operational constraints before any execution attempt.');
    expect(criteria).toContain('no robot command is issued');
    expect(criteria).toContain('no physical movement is triggered');
    expect(criteria).toContain('unsafe or ambiguous route output');
    expect(criteria).toContain('physical-world action is implied without guardrails');
    expect(evidence).toContain('service_id: naver-maps');
    expect(evidence).toContain('access_rail');
    expect(evidence).toContain('route_surface_status');
    expect(evidence).toContain('selected_route');
    expect(evidence).toContain('credential_status');
    expect(evidence).toContain('pricing_model');
    expect(evidence).toContain('payment/auth status');
    expect(evidence).toContain('rail_caveats');
    expect(evidence).toContain('non-operational test flag');
    expect(evidence).toContain('normalized route/geocode output summary');
    expect(context).toContain('Observed demo context only');
    expect(context).toContain('Radar has not executed this service.');
    expect(context).toContain('not counted as Radar execution evidence');
    expect(context).toContain('Public context is not Radar execution evidence.');
    expect(text).not.toContain('execution succeeded');
    expect(text).not.toContain('benchmark winner');
    expect(text).not.toContain('winner claimed');
    expect(text).not.toMatch(/NAVER Maps executed|NAVER execution proven|robotic\.sh market execution proven|payment success proven|best route|best provider|market-wide execution proven/i);
  });

  it('shows unknown service state with backlink', async () => {
    installFetch();
    root = await renderPath(container, '/machine-execution-plan/not-in-mirror');

    expect(container.textContent).toContain('Execution proof plan not found.');
    const shortlistLinks = [...container.querySelectorAll('a[href="/machine-execution-shortlist"]')];
    expect(shortlistLinks.some((link) => (link.textContent ?? '').includes('Back to execution shortlist'))).toBe(true);
  });

  it('does not crash when preflight/coverage data is missing', async () => {
    installFetch({ missingEvidence: true });
    root = await renderPath(container, '/machine-execution-plan/cloud-translation');

    const text = container.textContent ?? '';
    expect(text).toContain('Candidate Execution Proof Plan');
    expect(text).toContain('not recorded');
  });

  it('renders BigQuery rail-aware guidance for bounded queries', async () => {
    installFetch();
    root = await renderPath(container, '/machine-execution-plan/bigquery');

    const railPlan = container.querySelector('[aria-label="Rail-aware proof planning"]')?.textContent ?? '';

    expect(railPlan).toContain('bounded query result lookup');
    expect(railPlan).toContain('Use a bounded public or synthetic dataset query. Do not query sensitive business data in the first proof attempt.');
    expect(railPlan).toContain('$0.001');
    expect(railPlan).toContain('2');
  });

  it('renders Stableupload rail-aware guidance for harmless fixture uploads', async () => {
    installFetch();
    root = await renderPath(container, '/machine-execution-plan/stableupload');

    const railPlan = container.querySelector('[aria-label="Rail-aware proof planning"]')?.textContent ?? '';

    expect(railPlan).toContain('tiny non-sensitive fixture upload');
    expect(railPlan).toContain('Use a small harmless test fixture. Do not upload private, regulated, or production data in the first proof attempt.');
  });
});
