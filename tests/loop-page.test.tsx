// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

const seededLoop = {
  id: 'loop_pre_spend_route',
  name: 'Pre-Spend API Route Loop',
  objective: 'Keep pre-spend route decisions tied to receipt-backed evidence before autonomous spend.',
  hypothesis: 'If every pre-spend route decision is checked against receipts, agents avoid silent bad spend.',
  action_taken: 'Ran deterministic route checks, linked route evidence, and generated a public proof receipt.',
  evidence_artifacts: ['artifact://loops/pre-spend-route-ledger'],
  score: 88,
  failure_reason: null,
  proof_state: 'verified',
  decision_state: 'trust',
  linked_check_id: 'check_route_pay_sh_seed',
  runs: [{
    run_id: 'loop_run_pre_spend_route_001',
    started_at: '2026-06-20T10:00:00.000Z',
    completed_at: '2026-06-20T10:04:00.000Z',
    hypothesis: 'Receipt-backed route checks improve first-pass routing discipline.',
    action_taken: 'Compared pre-spend route receipts against current route narrative and linked the strongest proof receipt.',
    evidence_artifacts: ['artifact://loops/pre-spend-route-ledger'],
    score: 88,
    failure_reason: null,
    proof_state: 'verified',
    decision_state: 'trust',
    linked_check_id: 'check_route_pay_sh_seed'
  }]
};

const seededCheck = {
  check_id: 'check_route_pay_sh_seed',
  created_at: '2026-06-19T13:10:00.000Z',
  submitted_by: 'seed:infopunks',
  source_url: 'https://example.com/pay-sh-route-demo',
  input: 'Pay.sh market intelligence route claims production repeatability for pre-spend checks.',
  claim: 'Pay.sh route claims repeatable market intelligence performance.',
  claim_type: 'route_performance',
  claim_summary: 'Route has real receipts, but the repeatability claim still needs more validation.',
  subject_label: 'Pay.sh market intelligence route',
  receipts_found: ['2 bounded route-run receipts'],
  evidence_artifacts: ['artifact://proof-check/pay-sh-route-pack'],
  evidence_strength: 'medium',
  receipt_strength: 'partial_receipts',
  validation_status: 'community_pending',
  risk_flags: ['route_not_repeatable'],
  decision_state: 'caution',
  share_url: '/check/check_route_pay_sh_seed',
  share_text: 'INFOPUNKS RECEIPT CHECK',
  evidence_summary: 'Deterministic seeded receipts show the route can work.',
  validation_summary: 'Community review is pending.',
  decision_summary: 'Use caution because repeatability is not fully closed.',
  headline: 'INFOPUNKS RECEIPT CHECK',
  public_cta: 'Before an agent pays, it checks Infopunks.'
};

describe('loop pages', () => {
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

  it('renders /loops with loop cards and nav', async () => {
    window.history.pushState({}, '', '/loops');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/loops') return json({ loops: [seededLoop] });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Autonomous loops need proof receipts.');
    expect(container.querySelector('a[href="/loops"]')?.textContent).toContain('Loops');
    expect(container.textContent).toContain('Pre-Spend API Route Loop');
  });

  it('renders /loops/:loopId with linked proof receipt', async () => {
    window.history.pushState({}, '', '/loops/loop_pre_spend_route');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/loops/loop_pre_spend_route') return json(seededLoop);
      if (path === '/v1/checks/check_route_pay_sh_seed') return json(seededCheck);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Loop Objective');
    expect(container.textContent).toContain('Hypothesis');
    expect(container.textContent).toContain('INFOPUNKS RECEIPT CHECK');
    expect(container.textContent).toContain('No receipt, no trust.');
  });
});
