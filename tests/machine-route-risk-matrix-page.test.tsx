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
    price_display: '$0.02',
    provider: 'Stableupload',
    access_rail: 'pay_sh_solana',
    rail_status: 'review_required',
    route_surface_status: 'callable_routes_listed',
    endpoint_count: 3,
    pricing_model: '$0.02',
    first_safe_route: 'tiny non-sensitive fixture upload',
    rail_caveat: 'catalog route surface only; storage policy review remains required before execution claims'
  }),
  service('NAVER Maps', {
    category: 'navigation',
    market_type: 'physical',
    source_market: 'robotic.sh',
    chain: 'unknown',
    price_display: 'not recorded',
    provider: 'NAVER',
    machine_use_case: 'Autonomous robots can request routing, geocoding, and navigation context before moving or rerouting.',
    policy_risk: 'High machine relevance: routing outputs can influence physical-world movement. Execution requires bounded test scenarios, source validation, and clear non-operational constraints.',
    access_rail: 'peaqos_market_provider_account',
    rail_status: 'review_required',
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

describe('machine route risk matrix page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-route-risk-matrix');
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

  it('renders the route matrix with route-level guidance and receipt-driven interpretation', async () => {
    root = await renderPage(container);

    expect(container.textContent).toContain('Route-Level Risk Matrix');
    expect(container.textContent).toContain('Agents do not execute services in the abstract. They hit routes. Radar separates services from rails, rails from routes, routes from receipts.');
    expect(container.querySelector('[aria-label="Machine route risk hero chips"]')?.textContent).toContain('route surfaces mapped');
    expect(container.querySelector('[aria-label="Machine route risk hero chips"]')?.textContent).toContain('first-safe routes identified');
    expect(container.querySelector('[aria-label="Machine route risk hero chips"]')?.textContent).toContain('avoid-first routes flagged');
    expect(container.querySelector('[aria-label="Machine route risk hero chips"]')?.textContent).toContain('0 robotic.sh market-wide execution claims');
    expect(container.querySelector('[aria-label="Machine route risk summary"]')?.textContent).toContain('Route rows tracked6');
    expect(container.querySelector('[aria-label="Machine route risk summary"]')?.textContent).toContain('First-safe candidates5');
    expect(container.querySelector('[aria-label="Machine route risk summary"]')?.textContent).toContain('Avoid-first routes1');
    expect(container.querySelector('[aria-label="Machine route risk summary"]')?.textContent).toContain('High-risk routes1');
    expect(container.querySelector('[aria-label="Machine route risk summary"]')?.textContent).toContain('Service-specific executed routes0');
    expect(container.querySelector('[aria-label="Machine route risk summary"]')?.textContent).toContain('Payment-confirmed routes0');
    expect(container.querySelector('[aria-label="Machine route interpretation strip"]')?.textContent).toContain('listed ≠ callable');
    expect(container.querySelector('[aria-label="Machine route interpretation strip"]')?.textContent).toContain('callable ≠ executed');
    expect(container.querySelector('[aria-label="Machine route interpretation strip"]')?.textContent).toContain('credentials ≠ payment proof');
    expect(container.querySelector('[aria-label="Machine route interpretation strip"]')?.textContent).toContain('route surface ≠ receipt');
    expect(container.querySelector('[aria-label="Machine route guidance"]')?.textContent).toContain('BigQuery should begin with bounded public/synthetic queries.');
    expect(container.querySelector('[aria-label="Machine route guidance"]')?.textContent).toContain('Stableupload should begin with tiny non-sensitive fixtures.');
    expect(container.querySelector('[aria-label="Machine route guidance"]')?.textContent).toContain('Execution status remains not_attempted.');
    expect(container.querySelector('[aria-label="Machine route risk methodology"]')?.textContent).toContain('route_risk');
    expect(container.querySelector('[aria-label="Machine route risk methodology"]')?.textContent).toContain('proof_condition');
    expect(container.querySelector('[aria-label="Machine route risk methodology"]')?.textContent).toContain('execution_status');
    expect(container.querySelector('.machine-market-caveat a[href="/machine-first-safe-routes"]')?.textContent).toContain('View first safe route queue');
  });

  it('renders NAVER Maps, BigQuery, and Stableupload route rows without execution or benchmark claims', async () => {
    root = await renderPage(container);

    const table = container.querySelector('[aria-label="Machine route risk matrix table"]');
    const text = table?.textContent ?? '';

    expect(text).toContain('NAVER Maps');
    expect(text).toContain('Geocode');
    expect(text).toContain('GET');
    expect(text).toContain('/map-geocode/v2/geocode');
    expect(text).toContain('Driving directions');
    expect(text).toContain('/map-direction/v1/driving');
    expect(text).toContain('physical-world routing risk');
    expect(text).toContain('route guidance / driving directions');
    expect(text).toContain('geocode result / coordinates / address match');
    expect(text).toContain('bounded public landmark or generic address lookup, non-operational, no robot command');
    expect(text).toContain('BigQuery');
    expect(text).toContain('Bounded query result lookup');
    expect(text).toContain('tabular query result / schema / bounded rows');
    expect(text).toContain('query limited; synthetic/public dataset; parseable result; durable receipt required');
    expect(text).toContain('Stableupload');
    expect(text).toContain('Tiny non-sensitive fixture upload');
    expect(text).toContain('upload receipt / storage reference / file metadata');
    expect(text).toContain('harmless fixture; bounded file size; no sensitive data; durable receipt required');
    expect(text).toContain('not attempted');

    const rowTexts = Array.from(container.querySelectorAll('.machine-route-risk-row')).map((row) => row.textContent ?? '');
    const geocodeRow = rowTexts.find((row) => row.includes('Geocode')) ?? '';
    const directionsRow = rowTexts.find((row) => row.includes('Driving directions')) ?? '';

    expect(geocodeRow).toContain('low to medium');
    expect(geocodeRow).toContain('yes');
    expect(directionsRow).toContain('high');
    expect(directionsRow).toContain('yes');
    expect(directionsRow).toContain('physical-world routing risk');
    expect(container.textContent).toContain('Market-wide execution claims: 0. Payment success claims: 0. Benchmark claims: 0. Winner claims: 0.');
    expect(container.textContent).toContain('Route metadata does not imply execution.');
    expect(container.textContent).toContain('Credential requirement does not imply payment proof.');
    expect(container.textContent).toContain('Payment is not confirmed unless payment evidence exists.');
    expect(container.textContent).toContain('Route-level risk is planning metadata. It does not imply execution, payment success, benchmark superiority, or provider quality.');
    const attribution = container.querySelector('[aria-label="Route-risk attribution"]')?.textContent ?? '';
    expect(attribution).toContain('manual scaffold');
    expect(attribution).toContain('Planning metadata only; route risk is not execution evidence.');
    expect(container.textContent).not.toMatch(/payment succeeded|execution succeeded|winner:|benchmark winner|best provider|top provider|provider quality is|payment confirmed/i);
  });

  it('links route rows to machine execution proof plans', async () => {
    root = await renderPage(container);

    const naverLinks = container.querySelectorAll('a[href="/machine-execution-plan/naver-maps"]');
    expect(naverLinks.length).toBeGreaterThan(0);
    expect(container.querySelector('a[href="/machine-execution-plan/bigquery"]')?.textContent).toContain('View rail-aware proof plan');
    expect(container.querySelector('a[href="/machine-execution-plan/stableupload"]')?.textContent).toContain('View rail-aware proof plan');
  });
});
