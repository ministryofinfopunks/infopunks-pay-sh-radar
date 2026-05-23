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
    policy_risk: 'High machine relevance: routing outputs can influence physical-world movement. Execution requires bounded test scenarios, source validation, and clear non-operational constraints.'
  })
];

const serviceResults = services.map((item) => ({
  service_id: item.id,
  service_name: item.name,
  decision: item.id === 'qvac' || item.id === 'naver-maps' ? 'review' : item.id === '2captcha' ? 'deny' : 'allow',
  receipt_id: `mrx_${item.id}_001`,
  execution_occurred: false,
  payment_occurred: false
}));

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
    if (path === '/v1/machine-preflight/coverage-runs/recent') return json({
      count: 1,
      runs: [{
        run_id: 'mcr_20260522000000000_0001',
        generated_at: '2026-05-22T00:10:00.000Z',
        services_total: 13,
        preflight_evaluated: 13,
        receipts_recorded: 13,
        allow_count: 10,
        review_count: 2,
        deny_count: 1,
        execution_occurred: false,
        payment_occurred: false,
        storage: { adapter: 'memory', mode: 'test', durable: false },
        caveats: [
          'Coverage run records decision receipts only.',
          'No service execution occurred.',
          'No payment occurred.'
        ],
        service_results: serviceResults
      }]
    });
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

describe('machine economy snapshot page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-economy-snapshot');
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

  it('renders the snapshot route with computed headline values and current caveats', async () => {
    root = await renderPage(container);

    const text = container.textContent ?? '';
    const stats = container.querySelector('[aria-label="Machine economy snapshot stat grid"]')?.textContent ?? '';
    expect(text).toContain('Machine Economy Public Snapshot');
    expect(text).toContain('13 robotic.sh services mapped into policy, evidence, readiness, and proof-path state.');
    expect(text).toContain('13 services mapped');
    expect(text).toContain('8 machine-function categories');
    expect(text).toContain('10 allow / 2 review / 1 deny');
    expect(stats).toContain('Proof plans selected1');
    expect(text).toContain('0 execution claims');
    expect(stats).toContain('Execution receipts0');
    expect(stats).toContain('Repeatability receipts0');
    expect(stats).toContain('Strongest readiness categorydata / query');
    expect(stats).toContain('Riskiest categoryverification');
    expect(stats).toContain('Next controlled actionCloud Translation proof plan');
    expect(text).toContain('Coverage, preflight, and proof planning do not imply execution.');
    expect(text).toContain('No execution claim. No benchmark claim. No winner claim.');
    expect(text).toContain('Pay.sh execution routes tracked separately. Execution requires service-specific receipts.');
    expect(text).toContain('Repeatability requires repeated service-specific receipts.');
    expect(text).not.toContain('execution success');
  });

  it('renders all 13 services, category summary, public brief, copy button, and methodology drawer', async () => {
    root = await renderPage(container);

    const cohort = container.querySelector('[aria-label="Machine economy cohort band"]');
    const cohortNames = Array.from(container.querySelectorAll('.machine-snapshot-cohort-row strong')).map((item) => item.textContent?.trim());
    expect(cohort).not.toBeNull();
    expect(cohortNames).toHaveLength(13);
    expect(new Set(cohortNames).size).toBe(13);
    for (const name of serviceNames) expect(cohortNames).toContain(name);

    const categories = container.querySelector('[aria-label="Machine economy category summary"]');
    expect(categories?.textContent).toContain('AI / inference');
    expect(categories?.textContent).toContain('data / query');
    expect(categories?.textContent).toContain('translation');
    expect(categories?.textContent).toContain('maps / navigation');
    expect(categories?.textContent).toContain('web / retrieval');
    expect(categories?.textContent).toContain('storage');
    expect(categories?.textContent).toContain('verification');
    expect(categories?.textContent).toContain('compute');

    const brief = container.querySelector('[aria-label="Machine economy public brief"]');
    expect(brief?.textContent).toContain('13 robotic.sh services mapped across 8 machine-function categories.');
    expect(brief?.textContent).toContain('Policy state: 10 allow / 2 review / 1 deny.');
    expect(brief?.textContent).toContain('Radar selected 1 controlled proof-plan action: Cloud Translation.');
    expect(brief?.querySelector('button')?.textContent).toContain('Copy snapshot brief');
    expect(container.querySelector('a[href="/machine-rail-coverage"]')?.textContent).toContain('View rail coverage');

    const methodology = container.querySelector('[aria-label="Evidence methodology drawer"]');
    expect(methodology?.textContent).toContain('listed');
    expect(methodology?.textContent).toContain('classified');
    expect(methodology?.textContent).toContain('policy_mapped');
    expect(methodology?.textContent).toContain('preflight_recorded');
    expect(methodology?.textContent).toContain('proof_path');
    expect(methodology?.textContent).toContain('proof_plan_selected');
    expect(methodology?.textContent).toContain('execution_receipt');
    expect(methodology?.textContent).toContain('repeatability_receipt');
  });
});
