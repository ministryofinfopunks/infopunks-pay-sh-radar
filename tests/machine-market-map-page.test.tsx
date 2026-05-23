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
  'Exa'
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
  service('Exa')
];

const serviceResults = services.map((item) => ({
  service_id: item.id,
  service_name: item.name,
  decision: item.id === 'qvac' ? 'review' : item.id === '2captcha' ? 'deny' : 'allow',
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
    if (path === '/v1/machine-market/services') return json({ count: 12, services });
    if (path === '/v1/machine-preflight/coverage-runs/recent') return json({
      count: 1,
      runs: [{
        run_id: 'mcr_20260522000000000_0001',
        generated_at: '2026-05-22T00:10:00.000Z',
        services_total: 12,
        preflight_evaluated: 12,
        receipts_recorded: 12,
        allow_count: 10,
        review_count: 1,
        deny_count: 1,
        execution_occurred: false,
        payment_occurred: false,
        storage: { adapter: 'memory', mode: 'test', durable: false },
        caveats: [
          'Coverage run records decision receipts only.',
          'No service execution occurred.',
          'No Pay.sh, robotic.sh, or Agentic.Market call was made.',
          'No payment occurred.',
          'This is not a benchmark artifact.'
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

describe('machine market map page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-market-map');
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

  it('renders the market map route and represents all 12 services exactly once in the category map', async () => {
    root = await renderPage(container);

    expect(container.textContent).toContain('Machine Market Map');
    expect(container.textContent).toContain('12 robotic.sh services mapped.');
    expect(container.textContent).toContain('0 robotic.sh execution claims');
    expect(container.textContent).toContain('Planning only.');

    const serviceChips = Array.from(container.querySelectorAll('.machine-market-map-services .machine-badge')).map((item) => item.textContent?.trim());
    expect(serviceChips).toHaveLength(12);
    expect(new Set(serviceChips).size).toBe(12);
    for (const name of serviceNames) expect(serviceChips).toContain(name);
  });

  it('renders normalized categories and category summaries without execution, winner, or benchmark claims', async () => {
    root = await renderPage(container);

    const map = container.querySelector('[aria-label="Category map"]');
    expect(map?.textContent).toContain('AI / inference');
    expect(map?.textContent).toContain('data / query');
    expect(map?.textContent).toContain('translation');
    expect(map?.textContent).toContain('web / retrieval');
    expect(map?.textContent).toContain('storage');
    expect(map?.textContent).toContain('verification');
    expect(map?.textContent).toContain('compute');
    expect(map?.textContent).toContain('allow / review / deny');
    expect(map?.textContent).toContain('readiness tier distribution');
    expect(map?.textContent).toContain('execution status summary');
    expect(map?.textContent).toContain('evidence health summary');

    expect(container.textContent).toContain('No execution claim. No benchmark claim. No winner claim. Pay.sh routes tracked separately.');
    expect(container.textContent).toContain('Execution requires service-specific receipts before any robotic.sh success claim can be made.');
    expect(container.textContent).toContain('Every category remains receipt-dependent. No robotic.sh-visible category is execution-proven on this page.');
    expect(container.textContent).not.toContain('execution success');
  });
});
