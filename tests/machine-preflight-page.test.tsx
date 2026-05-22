// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const templates = [
  {
    id: 'delivery-robot',
    name: 'Delivery Robot',
    description: 'Low-risk field delivery policy.',
    machine_id: 'template:delivery-robot',
    owner_label: 'Operations',
    daily_budget_usd: 3,
    per_call_budget_usd: 0.05,
    allowed_categories: ['vision', 'translation', 'web'],
    blocked_categories: [],
    allowed_source_markets: [],
    blocked_source_markets: [],
    allowed_chains: [],
    blocked_chains: [],
    allowed_services: [],
    blocked_services: ['2captcha'],
    approval_required_above_usd: 0.05,
    minimum_evidence_stage: 'policy-mapped',
    minimum_evidence_health: 'scaffold',
    risk_tolerance: 'low',
    receipt_required: true,
    human_review_required_for: ['approval_threshold'],
    created_at: '2026-05-22T00:00:00.000Z',
    updated_at: '2026-05-22T00:00:00.000Z',
    status: 'active'
  },
  {
    id: 'warehouse-camera',
    name: 'Warehouse Camera',
    description: 'Camera-bound policy.',
    machine_id: 'template:warehouse-camera',
    owner_label: 'Warehouse Operations',
    daily_budget_usd: 5,
    per_call_budget_usd: 0.1,
    allowed_categories: ['vision', 'storage'],
    blocked_categories: [],
    allowed_source_markets: [],
    blocked_source_markets: [],
    allowed_chains: [],
    blocked_chains: [],
    allowed_services: [],
    blocked_services: [],
    approval_required_above_usd: 0.1,
    minimum_evidence_stage: 'policy-mapped',
    minimum_evidence_health: 'scaffold',
    risk_tolerance: 'low',
    receipt_required: true,
    human_review_required_for: [],
    created_at: '2026-05-22T00:00:00.000Z',
    updated_at: '2026-05-22T00:00:00.000Z',
    status: 'active'
  },
  {
    id: 'autonomous-research-agent',
    name: 'Autonomous Research Agent',
    description: 'Research policy.',
    machine_id: 'template:autonomous-research-agent',
    owner_label: 'Research',
    daily_budget_usd: 10,
    per_call_budget_usd: 0.25,
    allowed_categories: ['inference', 'web', 'translation'],
    blocked_categories: [],
    allowed_source_markets: ['pay.sh', 'agentic.market'],
    blocked_source_markets: [],
    allowed_chains: ['solana', 'base'],
    blocked_chains: [],
    allowed_services: [],
    blocked_services: [],
    approval_required_above_usd: 0.25,
    minimum_evidence_stage: 'policy-mapped',
    minimum_evidence_health: 'scaffold',
    risk_tolerance: 'medium',
    receipt_required: true,
    human_review_required_for: [],
    created_at: '2026-05-22T00:00:00.000Z',
    updated_at: '2026-05-22T00:00:00.000Z',
    status: 'active'
  },
  {
    id: 'depin-sensor',
    name: 'DePIN Sensor',
    description: 'Sensor policy.',
    machine_id: 'template:depin-sensor',
    owner_label: 'DePIN Operations',
    daily_budget_usd: 2,
    per_call_budget_usd: 0.03,
    allowed_categories: ['storage', 'compute'],
    blocked_categories: [],
    allowed_source_markets: [],
    blocked_source_markets: [],
    allowed_chains: ['solana', 'peaq'],
    blocked_chains: [],
    allowed_services: [],
    blocked_services: [],
    approval_required_above_usd: 0.03,
    minimum_evidence_stage: 'policy-mapped',
    minimum_evidence_health: 'scaffold',
    risk_tolerance: 'low',
    receipt_required: true,
    human_review_required_for: [],
    created_at: '2026-05-22T00:00:00.000Z',
    updated_at: '2026-05-22T00:00:00.000Z',
    status: 'active'
  },
  {
    id: 'field-maintenance-bot',
    name: 'Field Maintenance Bot',
    description: 'Field policy.',
    machine_id: 'template:field-maintenance-bot',
    owner_label: 'Field Operations',
    daily_budget_usd: 8,
    per_call_budget_usd: 0.2,
    allowed_categories: ['vision', 'translation', 'web', 'inference'],
    blocked_categories: [],
    allowed_source_markets: [],
    blocked_source_markets: [],
    allowed_chains: [],
    blocked_chains: [],
    allowed_services: [],
    blocked_services: [],
    approval_required_above_usd: 0.2,
    minimum_evidence_stage: 'policy-mapped',
    minimum_evidence_health: 'scaffold',
    risk_tolerance: 'medium',
    receipt_required: true,
    human_review_required_for: [],
    created_at: '2026-05-22T00:00:00.000Z',
    updated_at: '2026-05-22T00:00:00.000Z',
    status: 'active'
  }
];

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function preflightResponse(decision: 'allow' | 'deny' | 'review') {
  return {
    decision,
    recommended_service: decision === 'deny' ? null : {
      id: decision === 'review' ? '2captcha' : 'document-ai',
      name: decision === 'review' ? '2Captcha' : 'Document AI',
      provider: decision === 'review' ? '2Captcha' : 'Google',
      category: 'vision',
      source_market: decision === 'review' ? 'agentic.market' : 'pay.sh',
      chain: decision === 'review' ? 'base' : 'solana',
      status: 'ready',
      price_display: 'Per endpoint',
      evidence_stage: 'policy-mapped',
      evidence_health: 'scaffold',
      policy_risk: 'Policy risk text.'
    },
    source_market: decision === 'deny' ? null : decision === 'review' ? 'agentic.market' : 'pay.sh',
    chain: decision === 'deny' ? null : decision === 'review' ? 'base' : 'solana',
    reason: decision === 'allow' ? 'Document AI is allowed for this preflight.' : decision === 'deny' ? 'Blocked chain denies this preflight.' : 'Human review required before spend.',
    policy_checks: [{ id: 'chain_allowed', label: 'chain allowed', status: decision === 'deny' ? 'fail' : 'pass', detail: 'chain check detail' }],
    violations: decision === 'deny' ? ['chain_allowed'] : [],
    review_reasons: decision === 'review' ? ['risk_tolerance_compatible'] : [],
    caveats: ['Machine preflight only. No service was executed.'],
    evidence_stage: decision === 'deny' ? null : 'policy-mapped',
    evidence_health: decision === 'deny' ? null : 'scaffold',
    receipt_id: `mrx_test_${decision}`,
    receipt_required: true,
    phase_scope: 'phase_2_pay_sh_robotic_sh'
  };
}

function installFetch(payloads: any[] = []) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = pathOf(input);
    if (path === '/v1/machine-policies/templates') return json({ templates });
    if (path === '/v1/machine-preflight') {
      const payload = JSON.parse(String(init?.body ?? '{}'));
      payloads.push(payload);
      if (payload.allowed_chains?.includes('base') && payload.category === 'vision') return json(preflightResponse('deny'));
      if (payload.intent?.toLowerCase().includes('captcha')) return json(preflightResponse('review'));
      return json(preflightResponse('allow'));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

function setFieldValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
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

describe('machine preflight page', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    window.history.pushState({}, '', '/machine-preflight');
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

  it('renders and loads templates', async () => {
    root = await renderPage(container);

    expect(container.textContent).toContain('Machine Preflight');
    expect(container.textContent).toContain('Before a machine spends, Radar checks policy, route fit, evidence, and caveats.');
    expect(container.textContent).toContain('Delivery Robot');
    expect(container.textContent).toContain('Autonomous Research Agent');
  });

  it('selecting Delivery Robot fills policy summary', async () => {
    root = await renderPage(container);
    const select = container.querySelector('select[aria-label="policy template"]') as HTMLSelectElement;

    await act(async () => {
      select.value = 'warehouse-camera';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      select.value = 'delivery-robot';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.querySelector('[aria-label="Policy summary"]')?.textContent).toContain('Delivery Robot');
    expect(container.querySelector('[aria-label="Policy summary"]')?.textContent).toContain('daily_budget_usd');
    expect((container.querySelector('select[aria-label="category"]') as HTMLSelectElement).value).toBe('vision');
  });

  it('quick example keeps dropdown, summary, and submitted policy_id consistent', async () => {
    const payloads: any[] = [];
    vi.restoreAllMocks();
    installFetch(payloads);
    root = await renderPage(container);

    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Delivery bot parses invoice') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });

    expect((container.querySelector('select[aria-label="policy template"]') as HTMLSelectElement).value).toBe('delivery-robot');
    expect(container.querySelector('[aria-label="Policy summary"]')?.textContent).toContain('Delivery Robot');

    await act(async () => {
      (container.querySelector('form[aria-label="Machine preflight form"]') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(payloads.at(-1)?.policy_id).toBe('delivery-robot');
  });

  it('submitting invoice vision request renders Document AI allow and receipt id', async () => {
    root = await renderPage(container);

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Machine preflight result"]')?.textContent).toContain('Decision: allow');
    expect(container.textContent).toContain('Document AI');
    expect(container.textContent).toContain('mrx_test_allow');
  });

  it('deny result renders violations', async () => {
    root = await renderPage(container);
    const chainBase = Array.from(container.querySelectorAll('fieldset[aria-label="allowed_chains"] input'))[1] as HTMLInputElement;

    await act(async () => {
      chainBase.click();
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Machine preflight result"]')?.textContent).toContain('Decision: deny');
    expect(container.textContent).toContain('Violations');
    expect(container.textContent).toContain('chain_allowed');
  });

  it('review result renders review reasons', async () => {
    root = await renderPage(container);
    const intent = container.querySelector('textarea[aria-label="intent"]') as HTMLTextAreaElement;

    await act(async () => {
      setFieldValue(intent, 'solve captcha challenge');
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Machine preflight result"]')?.textContent).toContain('Decision: review');
    expect(container.textContent).toContain('Review reasons');
    expect(container.textContent).toContain('risk_tolerance_compatible');
    expect(container.textContent).toContain('mrx_test_review');
  });

  it('methodology link appears', async () => {
    root = await renderPage(container);

    const link = container.querySelector('a[href="/#methodology"]');
    expect(link?.textContent).toBe('Methodology: Machine Economy evidence ladder');
  });

  it('does not overclaim execution or benchmark evidence for policy-mapped preflight result', async () => {
    root = await renderPage(container);

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const resultText = container.querySelector('[aria-label="Machine preflight result"]')?.textContent ?? '';
    expect(resultText).toContain('execution-tested claim: not yet');
    expect(resultText).toContain('benchmark-recorded claim: not yet');
    expect(resultText).not.toContain('winner');
    expect(resultText).not.toContain('proven');
  });
});
