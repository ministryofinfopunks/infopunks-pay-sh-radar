// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

const baseCandidate = {
  id: 'ur_ai_rig_complex',
  project: 'AI Rig Complex',
  ticker: 'ARC',
  sector: 'AI / Agent Rails',
  market_cap_range: 'Live market, verify current range from DexScreener',
  thesis: 'Agent infrastructure candidate with a real AI/agent framework thesis, but needs fresh Infopunks receipts before stronger conviction.',
  what_it_actually_does: 'Builds agent framework infrastructure that builders can use to compose and operate AI-native workflows on Solana.',
  proof_of_shipping: 'Framework surface is live, but the desk still needs fresh independent receipts on present usage, integration depth, and developer retention.',
  attention_quality_note: 'Builder recognition exists, but attention has cooled from earlier peaks and needs current, non-reflexive validation.',
  token_survivability_note: 'The token case depends on whether framework usage remains durable enough to justify long-run market attention beyond the headline thesis.',
  risk_flags: ['execution risk', 'attention cooldown'],
  why_now: 'Agent infrastructure still matters, but conviction should come from new receipts rather than stale narrative memory.',
  receipts: [
    { id: 'urr_arc_receipt_001', label: 'Token address verified', type: 'market', source: 'infopunks desk review', note: 'Desk verified the live Solana token address before enabling market enrichment.', observed_at: '2026-07-06T08:30:00.000Z' }
  ],
  linked_narratives: [{ label: 'Hermes Desk', href: '/hermes' }],
  linked_graph_node: { id: 'agentic_payments', label: 'Agentic Payments', href: '/graph' },
  chainId: 'solana',
  tokenAddress: '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump',
  verificationStatus: 'verified_live_market',
  tokenAddressSource: 'Infopunks manual verification against the live DexScreener API and desk coverage.',
  verifiedAt: '2026-07-06T08:30:00.000Z',
  verificationNotes: ['Live market token address verified before production launch.'],
  productionReady: true,
  pairAddress: 'ArcPair111111111111111111111111111111111111',
  dexScreenerUrl: 'https://dexscreener.com/solana/arcpair111111111111111111111111111111111111',
  marketDataSource: 'dexscreener_official_api',
  marketDataUpdatedAt: '2026-07-06T09:00:00.000Z',
  dexScreenerData: {
    marketCap: 17500000,
    fdv: 21000000,
    liquidityUsd: 654321.12,
    volume24h: 123456.78,
    txns24hBuys: 80,
    txns24hSells: 45,
    priceChange1h: 2.5,
    priceChange6h: 8.25,
    priceChange24h: 18.5,
    pairCreatedAt: '2024-03-09T16:00:00.000Z',
    dexId: 'raydium',
    boosts: 0,
    paidOrders: 0,
    rawUrl: 'https://dexscreener.com/solana/arcpair111111111111111111111111111111111111'
  },
  hunter_credit: { handle: '@infopunks_desk', attribution: 'Infopunks desk verified ARC as a live market candidate before production launch.', submitted_at: '2026-07-06T08:30:00.000Z', source: 'infopunks_desk' },
  paid_evaluation_disclosure: { is_paid: false, label: 'No paid evaluation disclosed', note: 'No project payment recorded. Coverage is independent desk research.', paid_at: null, receipt_id: null },
  status: 'watchlist',
  verdict: 'real_product_weak_attention',
  scores: {
    shipping_proof: 70,
    attention_quality: 55,
    token_survivability: 58,
    category_timing: 69,
    asymmetry_potential: 60,
    overall_signal_score: 61,
    risk_score: 63
  },
  updated_at: '2026-07-06T08:30:00.000Z',
  sample_disclosure: 'Verified live market candidate. Infopunks coverage remains receipt-driven and can change as evidence improves or degrades.'
};

const trollCandidate = {
  ...baseCandidate,
  id: 'ur_troll_attention_asset',
  project: 'TROLL',
  ticker: 'TROLL',
  sector: 'Social / Attention Markets',
  tokenAddress: '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2',
  pairAddress: 'TrollPair1111111111111111111111111111111111',
  dexScreenerUrl: 'https://dexscreener.com/solana/trollpair1111111111111111111111111111111111',
  status: 'watchlist',
  verdict: 'strong_attention_weak_proof'
};

const bullCandidate = {
  ...baseCandidate,
  id: 'ur_black_bull_ansem',
  project: 'The Black Bull',
  ticker: 'ANSEM',
  sector: 'Social / Attention Markets',
  tokenAddress: '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump',
  pairAddress: 'BullPair11111111111111111111111111111111111',
  dexScreenerUrl: 'https://dexscreener.com/solana/bullpair11111111111111111111111111111111111',
  status: 'consensus_forming',
  verdict: 'consensus_already_forming'
};

const summary = {
  generated_at: '2026-07-06T08:30:00.000Z',
  title: 'Infopunks Unicorn Radar',
  tagline: 'Finding serious low-cap Solana projects before consensus does.',
  subline: 'Retail doesn’t need less risk. Retail needs better signal before taking risk.',
  trust_line: 'Projects can buy evaluation, not conviction.',
  doctrine_line: 'Influencers sell certainty. Infopunks sells legible uncertainty.',
  counts: {
    total: 3,
    by_status: {
      unseen_signal: 0,
      watchlist: 2,
      high_signal_lowcap: 0,
      consensus_forming: 1,
      do_not_touch_yet: 0,
      infopunks_missed_it: 0,
      paid_evaluation: 0
    },
    by_verdict: {
      high_signal_early: 0,
      interesting_needs_receipts: 0,
      real_product_weak_attention: 1,
      strong_attention_weak_proof: 1,
      do_not_touch_yet: 0,
      consensus_already_forming: 1,
      missed_by_infopunks: 0
    },
    by_sector: {
      AI: 0,
      'AI / Agent Rails': 1,
      RWA: 0,
      DeFi: 0,
      DePIN: 0,
      Consumer: 0,
      'Agent Rails': 0,
      'Payment Infrastructure': 0,
      'Social / Attention Markets': 2,
      'Tokenized Apps': 0
    }
  },
  candidates: [baseCandidate, trollCandidate, bullCandidate],
  revenue_receipts: []
};

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function mockFetch(candidateDetail = baseCandidate, listSummary = summary) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const path = pathOf(input);
    if (path === '/v1/unicorn-radar') return Promise.resolve(new Response(JSON.stringify({ data: listSummary }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (path === `/v1/unicorn-radar/candidates/${candidateDetail.id}`) return Promise.resolve(new Response(JSON.stringify({ data: candidateDetail }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
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

  it('renders /unicorn-radar with only the three production candidates and sector empty states', async () => {
    window.history.pushState({}, '', '/unicorn-radar');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Unicorn Radar');
    expect(container.textContent).toContain('AI Rig Complex');
    expect(container.textContent).toContain('TROLL');
    expect(container.textContent).toContain('The Black Bull');
    expect(container.textContent).toContain('Sector Coverage');
    expect(container.textContent).toContain('No verified candidates yet. Submit a candidate with receipts.');
  });

  it('renders verified badges on candidate detail pages', async () => {
    window.history.pushState({}, '', '/unicorn-radar/ur_ai_rig_complex');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('AI Rig Complex');
    expect(container.textContent).toContain('Verified live market');
    expect(container.textContent).toContain('Verification');
    expect(container.textContent).toContain('Open DexScreener');
  });

  it('fails open when market data is unavailable and still renders the page', async () => {
    const candidateWithoutMarketData = {
      ...baseCandidate,
      pairAddress: undefined,
      dexScreenerUrl: undefined,
      marketDataSource: undefined,
      marketDataUpdatedAt: undefined,
      dexScreenerData: undefined
    };
    mockFetch(candidateWithoutMarketData, { ...summary, candidates: [candidateWithoutMarketData, trollCandidate, bullCandidate] });
    window.history.pushState({}, '', '/unicorn-radar/ur_ai_rig_complex');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('AI Rig Complex');
    expect(container.textContent).toContain('No DexScreener market data is attached to this candidate yet.');
  });
});
