// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const candidate = {
  id: 'ur_agent_escrow_rails',
  project: 'Agent Escrow Rails',
  ticker: 'RAILS',
  sector: 'Agent Rails',
  market_cap_range: '$8M-$18M',
  thesis: 'Escrow and policy rails for autonomous agent payments are early enough to be asymmetric if execution receipts become standard.',
  what_it_actually_does: 'Provides scoped escrow, spend limits, and agent action receipts for Solana-native service calls.',
  proof_of_shipping: 'Sample CLI, escrow contract, and receipt conversion examples exist.',
  attention_quality_note: 'Attention quality is high because agent-wallet builders understand the failure mode.',
  token_survivability_note: 'Token survivability improves if fees, staking, or dispute bonds are tied to real escrow volume.',
  risk_flags: ['sample_record', 'security_review_needed'],
  why_now: 'Agents are moving from demos to spend flows.',
  receipts: [
    { id: 'urr_rails_contract_001', label: 'Escrow contract sample', type: 'shipping', source: 'desk review', note: 'Scoped escrow implementation.', observed_at: '2026-07-06T08:30:00.000Z' }
  ],
  linked_narratives: [{ label: 'Hermes spend policy', href: '/hermes/spend-policy' }],
  linked_graph_node: { id: 'agentic_payments', label: 'Agentic Payments', href: '/graph' },
  hunter_credit: { handle: '@agentrails', attribution: 'Desk seeded agent-rails candidate.', submitted_at: '2026-07-06T08:30:00.000Z', source: 'desk_seeded_sample' },
  paid_evaluation_disclosure: { is_paid: false, label: 'Desk-seeded sample', note: 'No project payment recorded.', paid_at: null, receipt_id: null },
  status: 'high_signal_lowcap',
  verdict: 'high_signal_early',
  scores: {
    shipping_proof: 79,
    attention_quality: 78,
    token_survivability: 69,
    category_timing: 91,
    asymmetry_potential: 88,
    overall_signal_score: 83,
    risk_score: 60
  },
  updated_at: '2026-07-06T08:30:00.000Z',
  sample_disclosure: 'Desk-seeded sample record for product demonstration.'
};

const summary = {
  generated_at: '2026-07-06T08:30:00.000Z',
  title: 'Infopunks Unicorn Radar',
  tagline: 'Finding serious low-cap Solana projects before consensus does.',
  subline: 'Retail doesn’t need less risk. Retail needs better signal before taking risk.',
  trust_line: 'Projects can buy evaluation, not conviction.',
  doctrine_line: 'Influencers sell certainty. Infopunks sells legible uncertainty.',
  counts: {
    total: 1,
    by_status: {
      unseen_signal: 0,
      watchlist: 0,
      high_signal_lowcap: 1,
      consensus_forming: 0,
      do_not_touch_yet: 0,
      infopunks_missed_it: 0,
      paid_evaluation: 0
    },
    by_verdict: {
      high_signal_early: 1,
      interesting_needs_receipts: 0,
      real_product_weak_attention: 0,
      strong_attention_weak_proof: 0,
      do_not_touch_yet: 0,
      consensus_already_forming: 0,
      missed_by_infopunks: 0
    },
    by_sector: {
      AI: 0,
      RWA: 0,
      DeFi: 0,
      DePIN: 0,
      Consumer: 0,
      'Agent Rails': 1,
      'Payment Infrastructure': 0,
      'Social / Attention Markets': 0,
      'Tokenized Apps': 0
    }
  },
  candidates: [candidate],
  revenue_receipts: [
    { id: 'urr_revenue_attn_001', candidate_id: null, project: 'Public desk seed', amount_usd: 0, service: 'sponsored_receipt_review', disclosure: 'Comped sample receipt.', status: 'comped', paid_at: '2026-07-06T08:30:00.000Z' }
  ]
};

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function mockFetch() {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const path = pathOf(input);
    if (path === '/v1/unicorn-radar') return Promise.resolve(new Response(JSON.stringify({ data: summary }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (path === '/v1/unicorn-radar/candidates/ur_agent_escrow_rails') return Promise.resolve(new Response(JSON.stringify({ data: candidate }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    return Promise.resolve(new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
  }));
}

describe('unicorn radar pages', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockFetch();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('renders /unicorn-radar with hero, filters, sections, receipts, and CTAs', async () => {
    window.history.pushState({}, '', '/unicorn-radar');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Unicorn Radar');
    expect(container.textContent).toContain('Finding serious low-cap Solana projects before consensus does.');
    expect(container.textContent).toContain('High-Signal Lowcaps');
    expect(container.textContent).toContain('Watchlist');
    expect(container.textContent).toContain('Do Not Touch Yet');
    expect(container.textContent).toContain('Consensus Forming');
    expect(container.textContent).toContain('Revenue Receipts');
    expect(container.textContent).toContain('Submit Candidate');
    expect(container.textContent).toContain('Request Paid Evaluation');
    expect(container.textContent).toContain('Agent Escrow Rails');
  });

  it('renders /unicorn-radar/:candidateId detail', async () => {
    window.history.pushState({}, '', '/unicorn-radar/ur_agent_escrow_rails');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Agent Escrow Rails');
    expect(container.textContent).toContain('What it actually does');
    expect(container.textContent).toContain('Proof of shipping');
    expect(container.textContent).toContain('Risk Flags');
    expect(container.textContent).toContain('Hunter attribution');
    expect(container.textContent).toContain('Final Infopunks verdict');
  });
});
