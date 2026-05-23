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
    observed_source: 'robotic.sh',
    observed_at: '2026-05-22T00:00:00.000Z',
    phase_scope: 'phase_2_pay_sh_robotic_sh',
    ...overrides
  };
}

const services = [
  service('Cloud Translation'),
  service('QVAC', { id: 'qvac', source_market: 'robotic.sh', chain: 'peaq', status: 'setup', category: 'compute' }),
  service('NAVER Maps', {
    machine_use_case: 'Autonomous robots can request routing, geocoding, and navigation context before moving or rerouting.',
    route_count: 4,
    pricing_model: 'Naver Cloud account pricing',
    credential_requirement: 'Naver Cloud provider credentials required',
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

    expect(checklist).toContain('catalog identity verified');
    expect(checklist).toContain('latest preflight receipt available');
    expect(safeInput).toContain('hello machine market');
    expect(safeInput).toContain('Spanish');
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
    expect(text).not.toContain('execution succeeded');
    expect(text).not.toContain('benchmark winner');
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

    expect(text).toContain('NAVER Maps');
    expect(text).toContain('latest policy decisionreview');
    expect(text).toContain('evidence_healthscaffold');
    expect(text).toContain('execution_statusnot_attempted');
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
    expect(evidence).toContain('non-operational test flag');
    expect(evidence).toContain('normalized route/geocode output summary');
    expect(context).toContain('Observed demo context only');
    expect(context).toContain('Radar has not executed this service.');
    expect(context).toContain('not counted as Radar execution evidence');
    expect(text).not.toContain('execution succeeded');
    expect(text).not.toContain('benchmark winner');
    expect(text).not.toContain('winner claimed');
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
});
