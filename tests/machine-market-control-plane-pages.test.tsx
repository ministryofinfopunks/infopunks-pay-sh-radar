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
    provider: name === 'NAVER Maps' ? 'NAVER' : name === 'Cloud Translation' || name === 'BigQuery' ? 'Google' : name,
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
    source_attribution: {
      source: 'robotic.sh',
      scope: 'static Phase 2 robotic.sh-visible service mirror',
      observed_at: '2026-05-22T00:00:00.000Z',
      caveat: 'Public/catalog context only. Radar evidence changes only when a service-specific receipt is recorded.'
    },
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
    access_rail: 'peaqos_market_provider_account',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 4,
    credential_requirement: 'Naver Cloud provider credentials required',
    first_safe_route: 'geocode lookup',
    rail_caveat: 'catalog route surface only; Radar has not executed routes'
  }),
  service('BigQuery', {
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 2,
    rail_status: 'plan_eligible',
    first_safe_route: 'bounded query result lookup',
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
    if (path === '/v1/machine-market/services') return json({ count: services.length, services });
    if (path === '/v1/machine-preflight/receipts/recent') return json({ count: 0, receipts: [] });
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
  });
  return root;
}

describe('machine market control plane pages', () => {
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

  it('renders execution blockers without turning blockers into execution claims', async () => {
    root = await renderPath(container, '/machine-execution-blockers');

    expect(container.textContent).toContain('Execution Blockers');
    expect(container.textContent).toContain('Radar does not just find what can run. Radar explains why most things should not run yet.');
    expect(container.textContent).toContain('Machines should not spend blind');
    expect(container.querySelector('[aria-label="Machine execution blocker table"]')?.textContent).toContain('No service-specific execution receipt recorded.');
    expect(container.querySelector('[aria-label="Machine execution blocker table"]')?.textContent).toContain('Naver Cloud provider credentials required');
    expect(container.textContent).toContain('Payment remains unconfirmed unless payment evidence exists.');
    expect(container.textContent).toContain('no benchmark artifact');
    expect(container.textContent).toContain('no winner criteria');
    expect(container.textContent).not.toMatch(/execution succeeded|payment succeeded|benchmark winner|best provider/i);
  });

  it('renders the changelog with claim boundaries and source attribution', async () => {
    root = await renderPath(container, '/machine-market-changelog');

    expect(container.textContent).toContain('Machine Market Changelog');
    expect(container.textContent).toContain('Radar remembers when the machine market changes.');
    expect(container.textContent).toContain('claim boundary');
    expect(container.textContent).toContain('source type');
    expect(container.textContent).toContain('public_context');
    expect(container.textContent).toContain('Execution receipt ingest surface is available for service-specific machine execution evidence.');
    expect(container.textContent).toContain('Listed does not mean callable or executed.');
    expect(container.textContent).toContain('Public demo context is not Radar evidence; NAVER Maps has not been executed by Radar.');
    expect(container.textContent).toContain('New pages add interpretation and policy memory, not new live Pay.sh, robotic.sh, or peaqOS data.');
  });

  it('adds BigQuery changelog entry when a BigQuery receipt exists', async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/machine-market/services') return json({ count: services.length, services });
      if (path === '/v1/machine-preflight/receipts/recent') return json({
        count: 1,
        receipts: [{
          receipt_id: 'mrx_exec_bigquery_fixture_0001',
          receipt_type: 'machine_execution',
          demo_mode: false,
          execution_occurred: true,
          payment_occurred: false,
          execution_status: 'succeeded',
          execution_service_id: 'bigquery',
          execution_provider: 'Google Cloud',
          execution_started_at: '2026-05-23T00:00:00.000Z',
          execution_completed_at: '2026-05-23T00:00:01.000Z',
          execution_latency_ms: 1000,
          execution_request_summary: '{"fixture":"bigquery_bounded_query"}',
          execution_response_summary: '{"query_label":"fixture.synthetic_row_count_check","row_count":1,"result_preview":[{"value":1}],"dataset_classification":"synthetic","bounded_query_confirmed":true}',
          execution_error: null,
          payment_evidence: null,
          preflight_receipt_id: null,
          execution_run_id: 'mxr_bigquery_fixture_0001',
          machine_id: 'did:peaq:bigquery-fixture-bot-01',
          policy_id: null,
          intent: 'external machine execution artifact ingest (bigquery)',
          requested_category: 'web',
          selected_service_id: 'bigquery',
          selected_service_name: 'BigQuery',
          source_market: 'robotic.sh',
          chain: 'unknown',
          decision: 'allow',
          reason: 'BigQuery external execution artifact indicates successful execution.',
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

    root = await renderPath(container, '/machine-market-changelog');
    const text = container.textContent ?? '';
    expect(text).toContain('BigQuery bounded query fixture receipt recorded');
    expect(text).toContain('Radar fixture ingest (replaceable by Harness output)');
    expect(text).toContain('Bounded public/synthetic query only.');
  });

  it('renders the standalone no-claim ledger with critical no-claim copy', async () => {
    root = await renderPath(container, '/machine-no-claim-ledger');

    expect(container.textContent).toContain('Machine No-Claim Ledger');
    expect(container.textContent).toContain('Radar records restraint');
    expect(container.textContent).toContain('Proof before trust');
    expect(container.textContent).toContain('Market-wide execution claim: 0');
    expect(container.textContent).toContain('Payment success claim: 0');
    expect(container.textContent).toContain('Benchmark claim: 0');
    expect(container.textContent).toContain('Winner claim: 0');
    expect(container.textContent).toContain('NAVER Maps execution claim: 0');
    expect(container.textContent).toContain('Service-specific execution receipt: 0');
    expect(container.textContent).toContain('Repeatability receipt: 0');
  });
});
