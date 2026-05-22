// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const baseReceipt = {
  receipt_id: 'mrx_202605220001_0001',
  receipt_type: 'machine_preflight',
  demo_mode: false,
  execution_occurred: false,
  payment_occurred: false,
  machine_id: 'did:peaq:delivery-bot-01',
  policy_id: 'template_delivery_robot',
  intent: 'parse invoice image',
  requested_category: 'vision',
  selected_service_id: 'document-ai',
  selected_service_name: 'Document AI',
  source_market: 'pay.sh',
  chain: 'solana',
  decision: 'allow',
  reason: 'Document AI is allowed for this preflight.',
  policy_checks: [{ id: 'chain_allowed', label: 'chain allowed', status: 'pass', detail: 'solana allowed' }],
  violations: [],
  review_reasons: [],
  caveats: ['Machine preflight only. No service was executed.'],
  max_cost_usd: 0.05,
  evidence_stage: 'policy-mapped',
  evidence_health: 'scaffold',
  phase_scope: 'phase_2_pay_sh_robotic_sh',
  created_at: '2026-05-22T00:01:00.000Z'
};
const demoReceipt = {
  ...baseReceipt,
  receipt_id: 'mrx_demo_did_peaq_delivery_bot_01',
  demo_mode: true,
  machine_id: 'did:peaq:delivery-bot-01',
  intent: 'parse invoice image into structured fields',
  reason: 'vision task matched a Pay.sh service within bounded authority',
  created_at: '2026-05-22T00:04:00.000Z'
};

const denyReceipt = {
  ...baseReceipt,
  receipt_id: 'mrx_202605220002_0002',
  machine_id: 'did:peaq:delivery-bot-02',
  selected_service_id: 'document-ai',
  selected_service_name: 'Document AI',
  decision: 'deny',
  reason: 'Blocked chain denies this preflight.',
  policy_checks: [{ id: 'chain_allowed', label: 'chain allowed', status: 'fail', detail: 'base is not allowed' }],
  violations: ['chain_allowed'],
  created_at: '2026-05-22T00:02:00.000Z'
};

const reviewReceipt = {
  ...baseReceipt,
  receipt_id: 'mrx_202605220003_0003',
  machine_id: 'did:peaq:research-agent-01',
  intent: 'solve captcha challenge',
  selected_service_id: '2captcha',
  selected_service_name: '2Captcha',
  source_market: 'agentic.market',
  chain: 'base',
  decision: 'review',
  reason: 'Human review required before spend.',
  policy_checks: [{ id: 'risk_tolerance_compatible', label: 'risk tolerance compatible', status: 'review', detail: 'captcha requires review' }],
  review_reasons: ['risk_tolerance_compatible'],
  created_at: '2026-05-22T00:03:00.000Z'
};

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathAndSearch(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, 'http://localhost');
  return { path: url.pathname, search: url.searchParams };
}

function installFetch(receipts: any[]) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const { path, search } = pathAndSearch(input);
    if (path === '/v1/machine-preflight/receipts/recent') {
      let rows = [...receipts];
      const decision = search.get('decision');
      if (decision) rows = rows.filter((receipt) => receipt.decision === decision);
      const chain = search.get('chain');
      if (chain) rows = rows.filter((receipt) => receipt.chain === chain);
      rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      return json({
        count: rows.length,
        storage: { mode: 'durable', adapter: 'jsonl', durable: true, demo_seed_enabled: true },
        receipts: rows
      });
    }
    const detailId = path.match(/^\/v1\/machine-preflight\/receipts\/([^/]+)$/)?.[1];
    if (detailId) {
      const receipt = receipts.find((item) => item.receipt_id === decodeURIComponent(detailId));
      return receipt ? json({ receipt: { ...receipt, selected_service: { id: receipt.selected_service_id, name: receipt.selected_service_name }, policy_summary: { id: 'delivery-robot', name: 'Delivery Robot' } } }) : json({}, 404);
    }
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

describe('machine receipts page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-receipts');
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders empty state', async () => {
    installFetch([]);
    root = await renderPage(container);

    expect(container.textContent).toContain('Machine Receipts');
    expect(container.textContent).toContain('No machine receipts yet.');
    expect(container.textContent).toContain('Run a preflight decision to create the first receipt.');
    expect(container.querySelector('a[href="/machine-preflight"]')).not.toBeNull();
  });

  it('renders seeded receipts after preflight', async () => {
    installFetch([baseReceipt, denyReceipt, reviewReceipt]);
    root = await renderPage(container);

    expect(container.textContent).toContain('Machines with wallets need witnesses.');
    expect(container.textContent).toContain('Document AI');
    expect(container.textContent).toContain('2Captcha');
    expect(container.textContent).toContain('Denied');
    expect(container.textContent).toContain('Storage: Durable JSONL.');
    expect(container.textContent).toContain('Decision receipts, not payment receipts.');
  });

  it('filters work', async () => {
    installFetch([baseReceipt, denyReceipt, reviewReceipt]);
    root = await renderPage(container);
    const decision = container.querySelector('select[aria-label="decision"]') as HTMLSelectElement;

    await act(async () => {
      decision.value = 'deny';
      decision.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Receipts timeline"]')?.textContent).toContain('deny');
    expect(container.querySelector('[aria-label="Machine receipt timeline table"]')?.textContent).not.toContain('review');
  });

  it('detail drawer shows policy checks and caveats', async () => {
    installFetch([baseReceipt, denyReceipt]);
    root = await renderPage(container);
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'View details') as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Receipt detail drawer"]')?.textContent).toContain('Show policy checks');
    expect(container.querySelector('[aria-label="Receipt detail drawer"]')?.textContent).toContain('Machine preflight only. No service was executed.');
  });

  it('receipt detail collapses policy checks behind a summary by default', async () => {
    installFetch([baseReceipt, denyReceipt]);
    root = await renderPage(container);
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'View details') as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const drawer = container.querySelector('[aria-label="Receipt detail drawer"]') as HTMLElement;
    expect(drawer.textContent).toContain('0 checks passed');
    expect(drawer.textContent).toContain('1 violations');
    expect(drawer.textContent).toContain('0 review reasons');
    expect(drawer.textContent).toContain('1 caveats');
    expect(drawer.textContent).toContain('Show policy checks');
    expect((drawer.querySelector('details') as HTMLDetailsElement).open).toBe(false);
  });

  it('policy checks can be expanded', async () => {
    installFetch([baseReceipt, denyReceipt]);
    root = await renderPage(container);
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'View details') as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const disclosure = container.querySelector('[aria-label="Receipt detail drawer"] details') as HTMLDetailsElement;

    await act(async () => {
      disclosure.open = true;
      disclosure.dispatchEvent(new Event('toggle', { bubbles: true }));
    });

    expect(disclosure.open).toBe(true);
    expect(container.querySelector('[aria-label="Receipt detail drawer"]')?.textContent).toContain('chain allowed: base is not allowed');
  });

  it('timestamp formatting renders cleanly', async () => {
    installFetch([baseReceipt]);
    root = await renderPage(container);

    expect(container.textContent).toContain('May 22, 2026');
    expect(container.textContent).toMatch(/5:31 AM|12:01 AM/);
  });

  it('methodology link appears', async () => {
    installFetch([baseReceipt]);
    root = await renderPage(container);

    const link = container.querySelector('a[href="/#methodology"]');
    expect(link?.textContent).toBe('Methodology: Machine Economy evidence ladder');
  });

  it('denied receipts are visible and not treated as failures', async () => {
    installFetch([denyReceipt]);
    root = await renderPage(container);

    expect(container.textContent).toContain('Denied attempts matter. They prove autonomy is bounded.');
    expect(container.textContent).toContain('Denied and review receipts are successful governance records.');
    expect(container.textContent).not.toContain('error');
  });

  it('machine_id links to dossier page', async () => {
    installFetch([baseReceipt]);
    root = await renderPage(container);

    const link = container.querySelector(`a[href="/machine-dossier/${encodeURIComponent(baseReceipt.machine_id)}"]`);
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe(baseReceipt.machine_id);
  });

  it('does not overclaim benchmark or winner status in receipt detail for policy-mapped stage', async () => {
    installFetch([baseReceipt]);
    root = await renderPage(container);
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'View details') as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const detailText = container.querySelector('[aria-label="Receipt detail drawer"]')?.textContent ?? '';
    expect(detailText).toContain('benchmark-recorded claim: not yet');
    expect(detailText).toContain('execution-tested claim: not yet');
    expect(detailText).not.toContain('winner');
    expect(detailText).not.toContain('proven');
  });

  it('shows demo disclaimer and demo count for demo receipts', async () => {
    installFetch([demoReceipt, baseReceipt]);
    root = await renderPage(container);

    expect(container.textContent).toContain('Demo receipts');
    expect(container.textContent).toContain('Demo preflight receipt. No service execution occurred.');

    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'View details') as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      const toggle = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Show raw JSON') as HTMLButtonElement;
      toggle.click();
    });

    const detailText = container.querySelector('[aria-label="Receipt detail drawer"]')?.textContent ?? '';
    expect(detailText).toContain('demo_modetrue');
    expect(detailText).toContain('execution_occurredfalse');
    expect(detailText).toContain('payment_occurredfalse');
  });
});
