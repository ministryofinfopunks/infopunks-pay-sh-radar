import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enrichUnicornCandidate,
  fetchDexScreenerTokenBatch,
  fetchDexScreenerTokenPairs,
  searchDexScreenerPairs
} from '../src/services/dexScreenerService';

const tokenPairsPayload = [
  {
    chainId: 'solana',
    dexId: 'raydium',
    url: 'https://dexscreener.com/solana/pair-one',
    pairAddress: 'pair-one',
    baseToken: { address: 'TokenOne', name: 'Token One', symbol: 'ONE' },
    quoteToken: { address: 'USDC', name: 'USD Coin', symbol: 'USDC' },
    priceUsd: '0.42',
    txns: { h24: { buys: 80, sells: 45 } },
    volume: { h24: 123456.78 },
    priceChange: { h1: 2.5, h6: 8.25, h24: 18.5 },
    liquidity: { usd: 654321.12 },
    fdv: 21000000,
    marketCap: 17500000,
    pairCreatedAt: 1710000000000
  }
];

const searchPayload = {
  schemaVersion: '1.0.0',
  pairs: tokenPairsPayload
};

const ordersPayload = {
  orders: [{ id: 'order-1' }],
  boosts: [{ id: 'boost-1' }, { id: 'boost-2' }]
};

const candidate = {
  id: 'ur_test',
  project: 'Test Project',
  ticker: 'TEST',
  sector: 'AI' as const,
  market_cap_range: '$1M-$3M',
  thesis: 'Testing enrichment.',
  what_it_actually_does: 'Ships tests.',
  proof_of_shipping: 'Repo is live.',
  attention_quality_note: 'Builder-led.',
  token_survivability_note: 'Utility unclear.',
  risk_flags: ['sample_record'],
  why_now: 'Needed for tests.',
  receipts: [{ id: 'r1', label: 'Receipt', type: 'shipping' as const, source: 'test', note: 'Receipt note', observed_at: '2026-07-06T08:30:00.000Z' }],
  linked_narratives: [{ label: 'Narrative', href: '/narratives' }],
  linked_graph_node: { id: 'graph', label: 'Graph', href: '/graph' },
  chainId: 'solana',
  tokenAddress: 'TokenOne',
  verificationStatus: 'verified_live_market' as const,
  tokenAddressSource: 'Manual verification',
  verifiedAt: '2026-07-06T08:30:00.000Z',
  productionReady: false,
  hunter_credit: { handle: '@tester', attribution: 'Test fixture', submitted_at: '2026-07-06T08:30:00.000Z', source: 'desk_seeded_sample' as const },
  paid_evaluation_disclosure: { is_paid: false, label: 'Desk-seeded sample', note: 'No payment.', paid_at: null, receipt_id: null },
  status: 'watchlist' as const,
  verdict: 'interesting_needs_receipts' as const,
  scores: {
    shipping_proof: 70,
    attention_quality: 65,
    token_survivability: 50,
    category_timing: 72,
    asymmetry_potential: 68,
    overall_signal_score: 66,
    risk_score: 58
  },
  updated_at: '2026-07-06T08:30:00.000Z',
  sample_disclosure: 'Desk-seeded sample record.'
};

function jsonResponse(payload: unknown) {
  return Promise.resolve(new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }));
}

describe('dex screener service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/token-pairs/v1/')) return jsonResponse(tokenPairsPayload);
      if (url.includes('/tokens/v1/')) return jsonResponse(tokenPairsPayload);
      if (url.includes('/latest/dex/search')) return jsonResponse(searchPayload);
      if (url.includes('/orders/v1/')) return jsonResponse(ordersPayload);
      return Promise.resolve(new Response('{}', { status: 404 }));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses token pairs payloads', async () => {
    const pairs = await fetchDexScreenerTokenPairs('solana', 'TokenOne');
    expect(pairs).toEqual([
      expect.objectContaining({
        chainId: 'solana',
        pairAddress: 'pair-one',
        dexId: 'raydium',
        priceUsd: 0.42,
        marketCap: 17500000,
        liquidityUsd: 654321.12,
        volume24h: 123456.78,
        txns24hBuys: 80,
        txns24hSells: 45,
        priceChange24h: 18.5
      })
    ]);
  });

  it('parses batch token payloads', async () => {
    const batch = await fetchDexScreenerTokenBatch('solana', ['TokenOne']);
    expect(batch.tokenone).toEqual([
      expect.objectContaining({
        pairAddress: 'pair-one',
        liquidityUsd: 654321.12
      })
    ]);
  });

  it('parses search payloads', async () => {
    const pairs = await searchDexScreenerPairs('TEST');
    expect(pairs[0]).toEqual(expect.objectContaining({
      dexId: 'raydium',
      pairAddress: 'pair-one',
      volume24h: 123456.78
    }));
  });

  it('fails open when enrichment fetches fail', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('dex down'))));
    await expect(enrichUnicornCandidate({ ...candidate, tokenAddress: 'TokenFail' })).resolves.toEqual({ ...candidate, tokenAddress: 'TokenFail' });
  });

  it('does not enrich candidates without verified live market status', async () => {
    const enriched = await enrichUnicornCandidate({ ...candidate, verificationStatus: 'pending_manual_review' as const });
    expect(enriched).toEqual({ ...candidate, verificationStatus: 'pending_manual_review' as const });
  });

  it('enriches unicorn candidates with market data', async () => {
    const enriched = await enrichUnicornCandidate(candidate);
    expect(enriched).toEqual(expect.objectContaining({
      pairAddress: 'pair-one',
      dexScreenerUrl: 'https://dexscreener.com/solana/pair-one',
      marketDataSource: 'dexscreener_official_api',
      dexScreenerData: expect.objectContaining({
        marketCap: 17500000,
        liquidityUsd: 654321.12,
        volume24h: 123456.78,
        txns24hBuys: 80,
        txns24hSells: 45,
        priceChange1h: 2.5,
        priceChange6h: 8.25,
        priceChange24h: 18.5,
        boosts: 2,
        paidOrders: 1
      })
    }));
  });
});
