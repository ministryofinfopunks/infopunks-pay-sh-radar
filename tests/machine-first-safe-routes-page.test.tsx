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
    provider: name === 'QVAC' ? 'Tether' : name === 'Cloud Translation' || name === 'BigQuery' ? 'Google' : name === 'NAVER Maps' ? 'NAVER' : name,
    category: 'web',
    market_type: 'digital',
    source_market: 'pay.sh',
    chain: 'solana',
    status: 'ready',
    price_display: '$0.001',
    description: `${name} service metadata.`,
    machine_use_case: `${name} machine use case.`,
    evidence_health: 'scaffold',
    evidence_stage: 'policy-mapped',
    policy_risk: `${name} requires spend policy.`,
    caveats: ['Static robotic.sh service mirror for Phase 2 only.'],
    access_rail: 'pay_sh_solana',
    rail_status: 'review_required',
    route_surface_status: 'no_callable_endpoints',
    endpoint_count: 0,
    pricing_model: 'not recorded',
    credential_requirement: 'not recorded',
    first_safe_route: 'not recorded',
    rail_caveat: 'rail caveat not recorded',
    observed_source: 'robotic.sh',
    observed_at: '2026-05-22T00:00:00.000Z',
    phase_scope: 'phase_2_pay_sh_robotic_sh',
    ...overrides
  };
}

const services = [
  service('Cloud Translation', {
    category: 'translation',
    rail_status: 'proof_plan_selected',
    rail_caveat: 'selected proof plan, not execution-tested by Radar'
  }),
  service('NAVER Maps', {
    category: 'navigation',
    market_type: 'physical',
    source_market: 'robotic.sh',
    chain: 'unknown',
    price_display: 'not recorded',
    access_rail: 'peaqos_market_provider_account',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 4,
    pricing_model: 'Naver Cloud account pricing',
    credential_requirement: 'Naver Cloud provider credentials required',
    first_safe_route: 'geocode lookup',
    rail_caveat: 'catalog route surface only; Radar has not executed routes',
    catalog_routes: [
      { method: 'GET', path: '/map-geocode/v2/geocode', label: 'Geocode', risk: 'low_to_medium' },
      { method: 'GET', path: '/map-reversegeocode/v2/gc', label: 'Reverse geocode', risk: 'low_to_medium' },
      { method: 'GET', path: '/map-direction/v1/driving', label: 'Driving directions', risk: 'high' },
      { method: 'GET', path: '/map-static/v2/raster', label: 'Static map', risk: 'low_to_medium' }
    ]
  }),
  service('BigQuery', {
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 2,
    first_safe_route: 'bounded query result lookup',
    rail_caveat: 'catalog route surface only; Radar has not executed routes'
  }),
  service('Stableupload', {
    category: 'storage',
    provider: 'Stableupload',
    price_display: '$0.02',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 3,
    first_safe_route: 'tiny non-sensitive fixture upload',
    rail_caveat: 'catalog route surface only; storage policy review remains required before execution claims'
  }),
  service('QVAC', {
    category: 'compute',
    market_type: 'all-compatible',
    source_market: 'robotic.sh',
    chain: 'peaq',
    status: 'setup',
    access_rail: 'peaqos_market_operator_defined',
    route_surface_status: 'operator_runtime_required',
    endpoint_count: 2,
    pricing_model: 'operator-defined',
    credential_requirement: 'runtime endpoint registration required',
    first_safe_route: 'non-operational runtime registration review',
    rail_caveat: 'setup required before autonomous calls'
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
    if (path === '/v1/machine-market/services') return json({ count: services.length, services });
    if (path === '/v1/machine-preflight/receipts/recent') return json({ count: 0, receipts: [] });
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

describe('machine first safe route queue page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-first-safe-routes');
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

  it('renders the first safe route queue with interpretation strip, summary, and zero-receipt caveats', async () => {
    root = await renderPage(container);

    expect(container.textContent).toContain('Machine First Safe Route Queue');
    expect(container.textContent).toContain('Radar does not ask which service is most exciting. It asks which route is safest to prove first.');
    expect(container.querySelector('[aria-label="Machine first safe route hero chips"]')?.textContent).toContain('route-aware queue');
    expect(container.querySelector('[aria-label="Machine first safe route hero chips"]')?.textContent).toContain('first-safe candidates');
    expect(container.querySelector('[aria-label="Machine first safe route hero chips"]')?.textContent).toContain('planning only');
    expect(container.querySelector('[aria-label="Machine first safe route hero chips"]')?.textContent).toContain('0 robotic.sh market-wide execution claims');
    expect(container.querySelector('[aria-label="Machine first safe route queue summary"]')?.textContent).toContain('Queue entries5');
    expect(container.querySelector('[aria-label="Machine first safe route queue summary"]')?.textContent).toContain('First-safe candidates5');
    expect(container.querySelector('[aria-label="Machine first safe route queue summary"]')?.textContent).toContain('Service-specific execution receipts0');
    expect(container.querySelector('[aria-label="Machine first safe route queue summary"]')?.textContent).toContain('Payment success claims0');
    expect(container.querySelector('[aria-label="Machine first safe route queue summary"]')?.textContent).toContain('Benchmark claims0');
    expect(container.querySelector('[aria-label="Machine first safe route interpretation strip"]')?.textContent).toContain('First-safe ≠ executed');
    expect(container.querySelector('[aria-label="Machine first safe route interpretation strip"]')?.textContent).toContain('Ranked ≠ winner');
    expect(container.querySelector('[aria-label="Machine first safe route interpretation strip"]')?.textContent).toContain('Blocked ≠ abandoned');
    expect(container.querySelector('[aria-label="Machine first safe route interpretation strip"]')?.textContent).toContain('Proof plan ≠ receipt');
    expect(container.textContent).toContain('0 robotic.sh market-wide execution claims. 0 service-specific execution receipts recorded.');
    expect(container.textContent).toContain('0 payment success claims. 0 benchmark claims. 0 winner claims. No provider quality claim.');
    expect(container.textContent).toContain('First-safe route ranking is planning metadata. It does not imply execution, payment success, benchmark superiority, provider quality, or winner status.');
    expect(container.textContent).not.toMatch(/payment succeeded|execution succeeded|benchmark winner|winner claim:|best provider|provider quality is/i);
  });

  it('renders the five queue rows with route-specific warnings and proof-plan links', async () => {
    root = await renderPage(container);

    const table = container.querySelector('[aria-label="Machine first safe route queue table"]');
    const text = table?.textContent ?? '';

    expect(text).toContain('Cloud Translation');
    expect(text).toContain('safe translation phrase');
    expect(text).toContain('Selected proof plan does not imply execution-tested status.');
    expect(text).toContain('NAVER Maps');
    expect(text).toContain('geocode lookup');
    expect(text).toContain('/map-geocode/v2/geocode');
    expect(text).toContain('Driving directions is avoid-first because route guidance can influence physical-world movement.');
    expect(text).toContain('BigQuery');
    expect(text).toContain('bounded public/synthetic query');
    expect(text).toContain('Do not query sensitive business or production data in the first proof attempt.');
    expect(text).toContain('Stableupload');
    expect(text).toContain('tiny non-sensitive fixture upload');
    expect(text).toContain('Do not upload private, regulated, or production data in the first proof attempt.');
    expect(text).toContain('QVAC');
    expect(text).toContain('runtime registration review, no execution');
    expect(text).toContain('Runtime registration review comes before autonomous execution.');
    expect(text).toContain('payment_unconfirmed');
    expect(text).toContain('benchmark_not_recorded');
    expect(text).toContain('not_attempted');
    expect(container.querySelector('a[href="/machine-execution-plan/cloud-translation"]')?.textContent).toContain('View proof plan');
    expect(container.querySelector('a[href="/machine-execution-plan/naver-maps"]')?.textContent).toContain('View proof plan');
    expect(container.querySelector('a[href="/machine-execution-plan/bigquery"]')?.textContent).toContain('View proof plan');
    expect(container.querySelector('a[href="/machine-execution-plan/stableupload"]')?.textContent).toContain('View proof plan');
    expect(container.querySelector('a[href="/machine-execution-plan/qvac"]')?.textContent).toContain('View proof plan');
  });

  it('shows the copyable public brief and methodology definitions', async () => {
    root = await renderPage(container);

    expect(container.querySelector('[aria-label="Machine first safe route brief"]')?.textContent).toContain('Radar has identified a first-safe route queue for the robotic.sh machine market.');
    expect(container.querySelector('[aria-label="Machine first safe route brief"] button')?.textContent).toContain('Copy queue brief');
    expect(container.querySelector('[aria-label="Machine first safe route methodology"]')?.textContent).toContain('first safe route');
    expect(container.querySelector('[aria-label="Machine first safe route methodology"]')?.textContent).toContain('blocked by');
    expect(container.querySelector('[aria-label="Machine first safe route methodology"]')?.textContent).toContain('required evidence');
    expect(container.querySelector('[aria-label="Machine first safe route methodology"]')?.textContent).toContain('planning rank');
    expect(container.querySelector('[aria-label="Machine first safe route methodology"]')?.textContent).toContain('execution status');
  });

  it('shows Stableupload progression when a service receipt exists', async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/machine-market/services') return json({ count: services.length, services });
      if (path === '/v1/machine-preflight/receipts/recent') return json({
        count: 1,
        receipts: [{
          receipt_id: 'mrx_exec_stableupload_fixture_0001',
          receipt_type: 'machine_execution',
          demo_mode: false,
          execution_occurred: true,
          payment_occurred: false,
          execution_status: 'succeeded',
          execution_service_id: 'stableupload',
          execution_provider: 'Stableupload',
          execution_started_at: '2026-05-23T00:00:00.000Z',
          execution_completed_at: '2026-05-23T00:00:01.000Z',
          execution_latency_ms: 640,
          execution_request_summary: '{"fixture":"stableupload_tiny_fixture"}',
          execution_response_summary: '{"file_size_bytes":128,"file_hash":"sha256:stableupload-tiny-fixture-v1","upload_reference":"stableupload_fixture_ref_001","sensitive_data_flag":false}',
          execution_error: null,
          payment_evidence: null,
          preflight_receipt_id: null,
          execution_run_id: 'mxr_stableupload_fixture_0001',
          machine_id: 'did:peaq:stableupload-fixture-bot-01',
          policy_id: null,
          intent: 'external machine execution artifact ingest (stableupload)',
          requested_category: 'storage',
          selected_service_id: 'stableupload',
          selected_service_name: 'Stableupload',
          source_market: 'pay.sh',
          chain: 'solana',
          decision: 'allow',
          reason: 'Stableupload external execution artifact indicates successful execution.',
          policy_checks: [],
          violations: [],
          review_reasons: [],
          caveats: ['Service-specific execution receipt only.', 'Not market-wide proof.', 'Not payment proof.', 'Not benchmark proof.', 'Not winner proof.'],
          max_cost_usd: null,
          evidence_stage: 'execution-tested',
          evidence_health: 'scaffold',
          phase_scope: 'phase_2_pay_sh_robotic_sh',
          created_at: '2026-05-23T00:00:01.000Z'
        }]
      });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    root = await renderPage(container);
    const text = container.querySelector('[aria-label="Machine first safe route queue table"]')?.textContent ?? '';
    expect(text).toContain('Stableupload');
    expect(text).toContain('execution_receipt_recorded');
    expect(text).toContain('View receipt detail');
  });
});
