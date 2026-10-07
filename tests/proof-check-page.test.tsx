// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/radarApp';

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

const monitorCheck = {
  check_id: 'check_monitor',
  created_at: '2026-06-20T09:30:00.000Z',
  submitted_by: 'seed:infopunks',
  source_url: 'https://www.monitorsituation.xyz/',
  input: '$MONITOR is a live global-situation intelligence product paired with tokenized PLTR',
  claim: '$MONITOR is a live global-situation intelligence product paired with tokenized PLTR',
  claim_type: 'market_narrative',
  claim_summary: 'Public existence receipts are present, but the evidence ledger does not establish spend suitability.',
  subject_label: 'MONITOR / The Situation',
  subject_id: 'subject_monitor',
  subject: {
    subject_id: 'subject_monitor',
    ticker: 'MONITOR',
    name: 'The Situation',
    chain: 'robinhood',
    contract: '0x1a911bb954dAA9CB38513423075bE74450351e18',
    pair: '0xcfa7bb34e23a7022c3de3e1618e1ff29cde8f16a76c341eca19d16f928968a3d',
    site: 'https://www.monitorsituation.xyz/',
    x: 'https://x.com/monitoringmeme'
  },
  receipts_found: ['onchain_pair', 'public_site', 'social'],
  missing_receipts: ['audit', 'team_dox', 'utility_commitment', 'paid_route_benchmark'],
  evidence_artifacts: ['artifact://proof-feed/check_monitor'],
  evidence_strength: 'weak',
  receipt_strength: 'partial_receipts',
  validation_status: 'unvalidated',
  risk_flags: ['unaudited_target', 'utility_unsubstantiated', 'paid_route_unbenchmarked'],
  decision_state: 'caution',
  share_url: '/check/monitor',
  share_text: 'INFOPUNKS RECEIPT CHECK',
  evidence_summary: 'The public site, public X account, and onchain pair establish existence only.',
  validation_summary: 'No human validator has closed this claim yet.',
  decision_summary: 'Use with caution because critical evidence remains missing.',
  headline: 'INFOPUNKS RECEIPT CHECK',
  public_cta: 'No receipt, no trust.'
};

const monitorPreSpend = {
  subject: 'monitor',
  intent: 'allocate_to_pltr_paired_narrative_token',
  preferred_settlement: 'tokenized_pltr',
  required_confidence: 75,
  decision: 'use_with_caution',
  confidence_score: 69,
  known_blockers: ['Unaudited target.', 'No Pay.sh paid route benchmark.', 'Utility is explicitly disclaimed.', 'Treat liquidity as thin or volatile until evidenced.'],
  requires_human_approval: true,
  linked_check_id: 'check_monitor',
  proof_check_reference: '/check/monitor',
  judgment: {
    receipt_id: 'judgment_monitor_allocate_to_pltr_paired_narrative_token_check_monitor',
    subject: 'monitor',
    decision: 'DEGRADE',
    primary_reason: 'The target is unaudited; no audit receipt is attached.',
    reasons: ['The target is unaudited; no audit receipt is attached.'],
    confidence: 69,
    evidence_references: ['check_monitor', '/check/monitor'],
    outcome_status: 'NOT_VERIFIED'
  }
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

  it('aliases /check/monitor to the stable MONITOR check id', async () => {
    window.history.pushState({}, '', '/check/monitor');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/checks/check_monitor') return json(seededCheck);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/v1/checks/check_monitor'), expect.anything());
    expect(container.textContent).toContain('INFOPUNKS RECEIPT CHECK');
  });

  it('renders the MONITOR launch surface as a linked caution decision', async () => {
    window.history.pushState({}, '', '/check/monitor');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/checks/check_monitor') return json(monitorCheck);
      if (path === '/v1/pre-spend/check') return json(monitorPreSpend);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('MONITOR / The Situation');
    expect(container.textContent).toContain('CAUTION');
    expect(container.textContent).toContain('pair');
    expect(container.textContent).toContain('paid route');
    expect(container.textContent).toContain('USE WITH CAUTION');
    expect(container.textContent).toContain('69 / 75');
    expect(container.textContent).toContain('DEGRADE');
    expect(container.textContent).toContain('NOT VERIFIED');
    expect(container.textContent).toContain('judgment_monitor_allocate_to_pltr_paired_narrative_token_check_monitor');
    expect(container.textContent).toContain('check_monitor');
    expect(container.textContent).toContain('Pay.sh spends. Radar decides.');
    expect(Array.from(container.querySelectorAll('a')).some((link) => link.getAttribute('href') === '/spend-terminal?intent=allocate_to_pltr_paired_narrative_token&subject=monitor')).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/v1/pre-spend/check'), expect.objectContaining({ method: 'POST' }));
  });
});
