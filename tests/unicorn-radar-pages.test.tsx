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

const kinsCandidate = {
  ...baseCandidate,
  id: 'ur_kintara_kins',
  project: 'Kintara',
  ticker: 'KINS',
  sector: 'Gaming / Consumer',
  thesis: 'Kintara now has stronger product/activity receipts: guild systems, player clustering, community wiki activity, full-server screenshots, and a live game route. This strengthens the High-Signal candidate case, but token survivability and sustained gameplay activity still need review before stronger conviction.',
  what_it_actually_does: 'Kintara presents itself as an isometric MMO where players can play to earn, buy and sell with KINS, explore quests, and adventure with friends.',
  proof_of_shipping: 'Official product surface, verified live Solana market, live spectate/play route, guild leaderboard, player-cluster screenshots, wiki activity, and server-full screenshots. Needs independent token distribution, marketplace/economy, and sustained retention receipts.',
  receipts: [
    ...baseCandidate.receipts,
    {
      id: 'urr_kins_receipt_004',
      label: 'Kintara live game route',
      type: 'LIVE_GAME_ROUTE',
      source: 'infopunks desk review',
      url: 'https://kintara.com/play?spectate=1',
      note: 'Kintara exposes a playable/spectate game route showing a KINTARA loading shell, game code loading state, and gameplay UI tip. This strengthens product-surface confidence but does not alone prove sustained player retention or token survivability.',
      observed_at: '2026-07-06T08:30:00.000Z'
    },
    {
      id: 'urr_kins_receipt_005',
      label: 'Guild leaderboard receipt',
      type: 'note',
      source: 'infopunks desk review',
      note: 'In-game guild leaderboard shows organized guilds, member counts, mob kills, PvP, bosses, and gold stats.',
      observed_at: '2026-07-06T08:30:00.000Z'
    },
    {
      id: 'urr_kins_receipt_006',
      label: 'Community wiki receipt',
      type: 'note',
      source: 'infopunks desk review',
      note: 'Kintara Wiki screenshot shows 201 articles, 221 files, 1,598 edits, and 8 active users.',
      observed_at: '2026-07-06T08:30:00.000Z'
    },
    {
      id: 'urr_kins_receipt_007',
      label: 'Player cluster receipt',
      type: 'note',
      source: 'infopunks desk review',
      note: 'In-game screenshot shows a crowded player gathering with visible levels, names, and guild tags.',
      observed_at: '2026-07-06T08:30:00.000Z'
    },
    {
      id: 'urr_kins_receipt_008',
      label: 'Server queue receipt',
      type: 'note',
      source: 'infopunks desk review',
      note: 'Server selection screenshot shows multiple servers marked full, with queues on some servers.',
      observed_at: '2026-07-06T08:30:00.000Z'
    }
  ],
  tokenAddress: 'Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump',
  tokenAddressSource: 'Solscan via DexScreener',
  tokenAddressSourceUrl: 'https://solscan.io/token/Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump',
  dexScreenerUrl: 'https://dexscreener.com/solana/f42tznkpavq1vucrl6ymhc6yqvpt84fwwgzbntv2wb3w',
  status: 'watchlist',
  verdict: 'interesting_needs_receipts',
  risk_flags: [
    'Token distribution still needs review',
    'Server fullness may be event-driven',
    'Need sustained active-user receipts',
    'Need marketplace/economy activity proof',
    'Market cap may already price part of the gaming narrative'
  ],
  tags: ['LIVE_GAME_ROUTE', 'SPECTATE_MODE', 'PRODUCT_SURFACE_CONFIRMED', 'GAMEPLAY_RECEIPT', 'GUILD_ACTIVITY', 'COMMUNITY_WIKI', 'SERVER_QUEUE_SIGNAL', 'PLAYER_CLUSTER', 'TOKEN_REVIEW_NEEDED'],
  why_now: 'High-Signal Candidate Pending Token Review. KINS has stronger product/activity receipts now, but the desk is keeping it watchlist-only until token survivability and sustained gameplay evidence improve.'
};

const manifestCandidate = {
  ...baseCandidate,
  id: 'ur_manifest_ambiguity',
  project: 'MANIFEST / Manifesting',
  ticker: 'MANIFEST',
  sector: 'Social / Attention Markets',
  market_cap_range: 'No canonical market attached',
  thesis: 'Narrative has cultural stickiness, but token identity and market ambiguity are not clean enough for positive Radar treatment yet.',
  what_it_actually_does: 'Multiple Manifest/Manifesting token markets appear to exist, and the meme narrative overlaps with other projects using similar naming.',
  proof_of_shipping: 'Not enough verified proof for a positive verdict.',
  verificationStatus: 'pending_manual_review',
  verificationNotes: [
    'Pending manual review due to ticker, token, and market ambiguity.',
    'No token address is attached, by design.',
    'Do not DexScreener-enrich MANIFEST until a canonical token address is verified.'
  ],
  tokenAddress: undefined,
  pairAddress: undefined,
  dexScreenerUrl: undefined,
  dexScreenerData: undefined,
  marketDataSource: undefined,
  marketDataUpdatedAt: undefined,
  status: 'do_not_touch_yet',
  verdict: 'do_not_touch_yet',
  risk_flags: [
    'Ticker ambiguity',
    'Multiple token markets',
    'Low/unclear liquidity on some pairs',
    'Narrative can be easily spoofed',
    'Needs canonical token confirmation'
  ],
  sample_disclosure: 'Pending manual review. Do not touch yet: token identity and market ambiguity must be resolved before any positive Radar treatment.'
};

const summary = {
  generated_at: '2026-07-06T08:30:00.000Z',
  title: 'Infopunks Unicorn Radar',
  tagline: 'Finding serious low-cap Solana projects before consensus does.',
  subline: 'Retail doesn’t need less risk. Retail needs better signal before taking risk.',
  trust_line: 'Projects can buy evaluation, not conviction.',
  doctrine_line: 'Influencers sell certainty. Infopunks sells legible uncertainty.',
  counts: {
    total: 5,
    by_status: {
      unseen_signal: 0,
      watchlist: 3,
      high_signal_lowcap: 0,
      consensus_forming: 1,
      do_not_touch_yet: 1,
      infopunks_missed_it: 0,
      paid_evaluation: 0
    },
    by_verdict: {
      high_signal_early: 0,
      interesting_needs_receipts: 1,
      real_product_weak_attention: 1,
      strong_attention_weak_proof: 1,
      do_not_touch_yet: 1,
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
      'Gaming / Consumer': 1,
      'Agent Rails': 0,
      'Payment Infrastructure': 0,
      'Social / Attention Markets': 3,
      'Tokenized Apps': 0
    }
  },
  candidates: [baseCandidate, trollCandidate, bullCandidate, kinsCandidate, manifestCandidate],
  revenue_receipts: [
    { id: 'rr_open_evaluation_slot', candidate_id: null, project: 'Open', amount_usd: 100, service: 'paid_evaluation', disclosure: 'Projects can buy evaluation, not conviction.', status: 'paid', paid_at: '2026-07-06T10:00:00.000Z' },
    { id: 'rr_template_001', candidate_id: null, project: 'Example', amount_usd: 0, service: 'paid_evaluation', disclosure: 'Template receipt for the public ledger.', status: 'pending', paid_at: '2026-07-06T10:00:00.000Z' },
    { id: 'rr_unicorn_radar_build', candidate_id: null, project: 'Infopunks', amount_usd: 0, service: 'research_retainer', disclosure: 'Internal build receipt.', status: 'comped', paid_at: '2026-07-06T10:00:00.000Z' }
  ]
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

  it('renders /unicorn-radar with only the five production candidates and sector empty states', async () => {
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
    expect(container.textContent).toContain('Kintara');
    expect(container.textContent).toContain('MANIFEST / Manifesting');
    expect(container.textContent).toContain('Drop #001 candidate queue');
    expect(container.textContent).toContain('KINS is watchlist-only pending gameplay and user receipts.');
    expect(container.textContent).toContain('Sector Coverage');
    expect(container.textContent).toContain('Revenue Receipts: see how paid evaluations are disclosed.');
    const sectorSection = container.querySelector('section[aria-label="Sector coverage"]');
    const sectorHeadings = Array.from(sectorSection?.querySelectorAll('h3') ?? []).map((node) => node.textContent);
    expect(sectorHeadings).toEqual(['AI / Agent Rails', 'Gaming / Consumer', 'Social / Attention Markets']);
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

  it('renders KINS as watchlist with live game route and token review tags', async () => {
    mockFetch(kinsCandidate, summary);
    window.history.pushState({}, '', '/unicorn-radar/ur_kintara_kins');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Kintara');
    expect(container.textContent).toContain('Watchlist');
    expect(container.textContent).toContain('live spectate/play route');
    expect(container.textContent).toContain('Kintara live game route');
    expect(container.textContent).toContain('playable/spectate game route');
    expect(container.textContent).toContain('Guild leaderboard receipt');
    expect(container.textContent).toContain('Community wiki receipt');
    expect(container.textContent).toContain('Player cluster receipt');
    expect(container.textContent).toContain('Server queue receipt');
    expect(container.textContent).toContain('member counts, mob kills, PvP, bosses, and gold stats');
    expect(container.textContent).toContain('201 articles, 221 files, 1,598 edits, and 8 active users');
    expect(container.textContent).toContain('crowded player gathering with visible levels, names, and guild tags');
    expect(container.textContent).toContain('multiple servers marked full, with queues on some servers');
    expect(container.textContent).toContain('TOKEN_REVIEW_NEEDED');
    expect(container.textContent).toContain('LIVE_GAME_ROUTE');
    expect(container.textContent).toContain('High-Signal Candidate Pending Token Review');
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

  it('renders MANIFEST as pending manual review without a DexScreener market panel', async () => {
    mockFetch(manifestCandidate, { ...summary, candidates: [baseCandidate, trollCandidate, bullCandidate, kinsCandidate, manifestCandidate] });
    window.history.pushState({}, '', '/unicorn-radar/ur_manifest_ambiguity');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('MANIFEST / Manifesting');
    expect(container.textContent).toContain('Pending manual review');
    expect(container.textContent).toContain('Do not touch yet');
    expect(container.textContent).toContain('Do not DexScreener-enrich MANIFEST until a canonical token address is verified.');
    expect(container.textContent).not.toContain('Open DexScreener');
    expect(container.querySelector('section[aria-label="Market data"]')).toBeNull();
  });
});
