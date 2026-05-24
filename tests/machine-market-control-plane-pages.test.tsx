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

    expect(container.textContent).toContain('Machine Execution Blockers');
    expect(container.textContent).toContain('Governance before autonomy.');
    expect(container.textContent).toContain('Machines should not spend blind');
    expect(container.querySelector('[aria-label="Machine execution blocker table"]')?.textContent).toContain('No service-specific execution receipt recorded.');
    expect(container.querySelector('[aria-label="Machine execution blocker table"]')?.textContent).toContain('Naver Cloud provider credentials required');
    expect(container.textContent).toContain('Credentials, account pricing, or public settlement context are not payment proof.');
    expect(container.textContent).not.toMatch(/execution succeeded|payment succeeded|benchmark winner|best provider/i);
  });

  it('renders the changelog with claim boundaries and source attribution', async () => {
    root = await renderPath(container, '/machine-market-changelog');

    expect(container.textContent).toContain('Machine Market Changelog');
    expect(container.textContent).toContain('claim boundary');
    expect(container.textContent).toContain('Listed does not mean callable or executed.');
    expect(container.textContent).toContain('Public demo context is not Radar evidence; NAVER Maps has not been executed by Radar.');
    expect(container.textContent).toContain('New pages add interpretation and policy memory, not new live Pay.sh, robotic.sh, or peaqOS data.');
  });

  it('renders the standalone no-claim ledger with critical no-claim copy', async () => {
    root = await renderPath(container, '/machine-no-claim-ledger');

    expect(container.textContent).toContain('Machine No-Claim Ledger');
    expect(container.textContent).toContain('Radar records restraint');
    expect(container.textContent).toContain('Proof before trust');
    expect(container.textContent).toContain('0 robotic.sh execution receipts recorded by Radar.');
    expect(container.textContent).toContain('0 repeatability receipts recorded by Radar.');
    expect(container.textContent).toContain('0 payment success claims recorded for robotic.sh routes.');
    expect(container.textContent).toContain('No winner, provider-quality, or benchmark superiority claim is made.');
    expect(container.textContent).toContain('NAVER Maps is navigation / review / not_attempted.');
  });
});
