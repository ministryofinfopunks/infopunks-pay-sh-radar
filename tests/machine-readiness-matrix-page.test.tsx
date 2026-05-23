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
    if (path === '/v1/machine-preflight/receipts/recent') return json({
      count: 0,
      receipts: []
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

describe('machine readiness matrix page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-readiness-matrix');
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

  it('renders the readiness matrix with all 13 services', async () => {
    root = await renderPage(container);

    expect(container.textContent).toContain('Machine Readiness Matrix');
    expect(container.textContent).toContain('13 services mapped. 0 robotic.sh execution claims. 1 proof plan selected.');
    expect(container.querySelector('[aria-label="Readiness Matrix Brief"]')?.textContent).toContain('Readiness Matrix Brief');
    expect(container.querySelector('[aria-label="Readiness Matrix Brief"]')?.textContent).toContain('13 robotic.sh services mapped across the readiness ladder.');
    expect(container.querySelector('[aria-label="Readiness Matrix Brief"]')?.textContent).toContain('1 proof plan selected.');
    expect(container.querySelector('[aria-label="Readiness Matrix Brief"]')?.textContent).toContain('0 execution receipts.');
    expect(container.querySelector('[aria-label="Readiness Matrix Brief"]')?.textContent).toContain('0 repeatability receipts.');
    expect(container.querySelector('[aria-label="Readiness Matrix Brief"] button')?.textContent).toContain('Copy brief');
    expect(container.querySelector('a[href="/machine-market-map"]')?.textContent).toContain('View market map');
    expect(container.querySelector('a[href="/machine-economy-snapshot"]')?.textContent).toContain('View public snapshot');
    expect(container.querySelector('a[href="/machine-rail-coverage"]')?.textContent).toContain('View rail coverage');
    expect(container.querySelector('[aria-label="Evidence methodology drawer"]')?.textContent).toContain('execution_receipt');
    expect(container.querySelector('[aria-label="Evidence methodology drawer"]')?.textContent).toContain('repeatability_receipt');
    for (const name of serviceNames) expect(container.textContent).toContain(name);
  });

  it('marks proof_plan_selected complete only for Cloud Translation and keeps execution receipts missing without service-specific receipts', async () => {
    root = await renderPage(container);

    const matrix = container.querySelector('[aria-label="Machine readiness matrix"]');
    expect(matrix?.textContent).toContain('Cloud Translation');

    const rowTexts = Array.from(container.querySelectorAll('.machine-readiness-row')).map((row) => row.textContent ?? '');
    const cloudTranslationRow = rowTexts.find((text) => text.includes('Cloud Translation'));
    const qvacRow = rowTexts.find((text) => text.includes('QVAC'));
    const naverMapsRow = rowTexts.find((text) => text.includes('NAVER Maps'));

    expect(cloudTranslationRow).toContain('complete');
    expect(cloudTranslationRow).toContain('missingmissing');
    expect(qvacRow).not.toContain('proof plan selectedcomplete');
    expect(naverMapsRow).toContain('review');
    expect(naverMapsRow).toContain('missing');

    const matrixText = matrix?.textContent ?? '';
    expect(matrixText).toContain('execution_receipt');
    expect(matrixText).toContain('repeatability_receipt');
    expect(matrixText).not.toContain('benchmark');
    expect(matrixText).not.toContain('winner');
    expect(matrixText).not.toContain('execution success');
  });
});
