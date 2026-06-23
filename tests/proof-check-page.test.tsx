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

const seededCheck = {
  check_id: 'check_agent_autonomy_seed',
  created_at: '2026-06-20T09:30:00.000Z',
  submitted_by: 'seed:infopunks',
  source_url: 'https://example.com/agent-autonomy-demo',
  input: 'Autonomous checkout agent claims full autonomy for vendor routing and settlement.',
  claim: 'Agent claims autonomous routing and settlement readiness.',
  claim_type: 'agent_autonomy',
  claim_summary: 'Autonomy narrative is ahead of the recorded execution receipts.',
  subject_label: 'Autonomous checkout agent',
  receipts_found: ['operator demo clip'],
  evidence_artifacts: ['artifact://proof-check/agent-autonomy-brief'],
  evidence_strength: 'weak',
  receipt_strength: 'weak_receipts',
  validation_status: 'unvalidated',
  risk_flags: ['autonomy_unproven', 'no_human_validation'],
  decision_state: 'do_not_use_yet',
  share_url: '/check/check_agent_autonomy_seed',
  share_text: 'INFOPUNKS RECEIPT CHECK',
  evidence_summary: 'Only narrative-level receipts were matched.',
  validation_summary: 'No human validator has closed this claim yet.',
  decision_summary: 'Do not use yet because autonomy is still asserted more loudly than it is evidenced.',
  headline: 'INFOPUNKS RECEIPT CHECK',
  public_cta: 'No receipt, no trust.'
};

describe('proof check pages', () => {
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

  it('renders the /check page, nav, and seeded proof checks', async () => {
    window.history.pushState({}, '', '/check');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/checks') return json({ checks: [seededCheck] });
      if (path === '/v1/check') return json(seededCheck);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Check the receipts before the market believes the claim.');
    expect(container.textContent).toContain('Check receipts');
    expect(container.querySelector('a[href="/check"]')?.textContent).toContain('Check');
    expect(container.textContent).toContain('INFOPUNKS RECEIPT CHECK');
  });

  it('renders the /check/:checkId page with seeded result content', async () => {
    window.history.pushState({}, '', '/check/check_agent_autonomy_seed');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/checks/check_agent_autonomy_seed') return json(seededCheck);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('DO NOT USE YET');
    expect(container.textContent).toContain('No receipt, no trust.');
    expect(container.textContent).toContain('Evidence Summary');
    expect(container.textContent).toContain('Risk Flags');
  });
});
