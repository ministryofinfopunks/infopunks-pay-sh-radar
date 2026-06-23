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

const seededLoops = [
  {
    id: 'loop_pre_spend_route',
    name: 'Pre-Spend API Route Loop',
    objective: 'Keep pre-spend route decisions tied to receipt-backed evidence before autonomous spend.',
    hypothesis: 'If every pre-spend route decision is checked against receipts, agents avoid silent bad spend.',
    action_taken: 'Ran deterministic route checks, linked route evidence, and generated a public proof receipt.',
    evidence_artifacts: ['artifact://loops/pre-spend-route-ledger', 'artifact://loops/pre-spend-route-memory'],
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
  },
  {
    id: 'loop_failure_memory',
    name: 'Failure Memory Loop',
    objective: 'Record failures so agents stop repeating bad paths.',
    hypothesis: 'If failure reasons are written into public memory, loop quality improves even before perfect receipts exist.',
    action_taken: 'Captured weak autonomy evidence, attached failure notes, and routed the claim into public caution memory.',
    evidence_artifacts: ['artifact://loops/failure-memory-journal'],
    score: 41,
    failure_reason: 'Autonomy claim is still louder than the recorded evidence.',
    proof_state: 'failure_recorded',
    decision_state: 'do_not_use_yet',
    linked_check_id: 'check_agent_autonomy_seed',
    runs: [{
      run_id: 'loop_run_failure_memory_001',
      started_at: '2026-06-18T08:00:00.000Z',
      completed_at: '2026-06-18T08:06:00.000Z',
      hypothesis: 'Failure memory should become public before the same loop is retried.',
      action_taken: 'Stored the failure reason, linked the autonomy proof receipt, and kept the decision at do not use yet.',
      evidence_artifacts: ['artifact://loops/failure-memory-journal'],
      score: 41,
      failure_reason: 'Autonomy claim is still louder than the recorded evidence.',
      proof_state: 'failure_recorded',
      decision_state: 'do_not_use_yet',
      linked_check_id: 'check_agent_autonomy_seed'
    }]
  }
];

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

describe('loop lab pages', () => {
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

  it('renders the LoopLab hero and how-it-works section', async () => {
    window.history.pushState({}, '', '/loops');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/loops') return json({ loops: seededLoops });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks LoopLab');
    expect(container.textContent).toContain('Where autonomous work becomes collective memory.');
    expect(container.textContent).toContain('AI is moving from prompts to loops.');
    expect(container.textContent).toContain('How The Loop Works');
    expect(container.textContent).toContain('Proof Receipt');
    expect(Array.from(container.querySelectorAll('a[href="/check"]')).some((node) => node.textContent?.includes('Open Proof Feed'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/loops/loop_pre_spend_route"]')).some((node) => node.textContent?.includes('Inspect first loop'))).toBe(true);
  });

  it('renders deterministic collective memory counters', async () => {
    window.history.pushState({}, '', '/loops');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/loops') return json({ loops: seededLoops });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const counters = container.querySelector('[aria-label="Collective memory counters"]')?.textContent ?? '';
    expect(counters).toContain('total loops2');
    expect(counters).toContain('proof checks linked2');
    expect(counters).toContain('evidence artifacts3');
    expect(counters).toContain('failure reasons logged1');
    expect(counters).toContain('decision states issued2');
  });

  it('renders the Failure Wall with expected seeded states', async () => {
    window.history.pushState({}, '', '/loops');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/loops') return json({ loops: seededLoops });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const failureWall = container.querySelector('[aria-label="Failure Wall"]')?.textContent ?? '';
    expect(failureWall).toContain('Every failed loop is memory for the next agent.');
    expect(failureWall).toContain('Failure Memory Loop');
    expect(failureWall).toContain('DO NOT USE YET');
    expect(failureWall).toContain('failure recorded');
  });

  it('renders loop receipt cards with key fields', async () => {
    window.history.pushState({}, '', '/loops');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/loops') return json({ loops: seededLoops });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const cards = Array.from(container.querySelectorAll('[aria-label="Loop Receipt Card"]'));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]?.textContent).toContain('INFOPUNKS LOOP RECEIPT');
    expect(cards[0]?.textContent).toContain('Pre-Spend API Route Loop');
    expect(cards[0]?.textContent).toContain('check_route_pay_sh_seed');
    expect(cards[0]?.textContent).toContain('No receipt, no trust.');
  });

  it('renders loop detail page with both LoopReceiptCard and linked ProofReceiptCard', async () => {
    window.history.pushState({}, '', '/loops/loop_pre_spend_route');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/loops/loop_pre_spend_route') return json(seededLoops[0]);
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

    const loopCards = container.querySelectorAll('[aria-label="Loop Receipt Card"]');
    const proofCards = container.querySelectorAll('[aria-label="Infopunks Receipt Check"]');
    expect(loopCards.length).toBeGreaterThan(0);
    expect(proofCards.length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Collective Memory');
    expect(container.textContent).toContain('Memory Chain');
    expect(container.textContent).toContain('INFOPUNKS RECEIPT CHECK');
  });
});
