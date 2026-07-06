import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function expectPng(payload: Buffer) {
  expect(payload.length).toBeGreaterThan(24);
  expect(payload.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(payload.readUInt32BE(16)).toBe(1200);
  expect(payload.readUInt32BE(20)).toBe(630);
}

function liveDexPair(baseTokenAddress: string, pairAddress: string, url: string) {
  return [{
    chainId: 'solana',
    dexId: 'raydium',
    url,
    pairAddress,
    baseToken: { address: baseTokenAddress },
    quoteToken: { address: 'So11111111111111111111111111111111111111112' },
    priceUsd: '0.42',
    txns: { h24: { buys: 80, sells: 45 } },
    volume: { h24: 123456.78 },
    priceChange: { h1: 2.5, h6: 8.25, h24: 18.5 },
    liquidity: { usd: 654321.12 },
    fdv: 21000000,
    marketCap: 17500000,
    pairCreatedAt: 1710000000000
  }];
}

describe('unicorn radar api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump')) {
        return Promise.resolve(new Response(JSON.stringify(liveDexPair(
          '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump',
          'ArcPair111111111111111111111111111111111111',
          'https://dexscreener.com/solana/arcpair111111111111111111111111111111111111'
        )), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2')) {
        return Promise.resolve(new Response(JSON.stringify(liveDexPair(
          '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2',
          'TrollPair1111111111111111111111111111111111',
          'https://dexscreener.com/solana/trollpair1111111111111111111111111111111111'
        )), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump')) {
        return Promise.resolve(new Response(JSON.stringify(liveDexPair(
          '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump',
          'BullPair11111111111111111111111111111111111',
          'https://dexscreener.com/solana/bullpair11111111111111111111111111111111111'
        )), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump')) {
        return Promise.resolve(new Response(JSON.stringify(liveDexPair(
          'Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump',
          'f42TZnKpavq1VUcrL6yMhc6yQvpt84FwwgzBnTv2wb3w',
          'https://dexscreener.com/solana/f42tznkpavq1vucrl6ymhc6yqvpt84fwwgzbntv2wb3w'
        )), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/orders/v1/')) {
        return Promise.resolve(new Response(JSON.stringify({ orders: [], boosts: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the verified five-candidate production surface', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const summary = await app.inject({ method: 'GET', url: '/v1/unicorn-radar' });
      expect(summary.statusCode).toBe(200);
      expect(summary.json().data).toEqual(expect.objectContaining({
        counts: expect.objectContaining({
          total: 5,
          by_status: expect.objectContaining({
            high_signal_lowcap: 1,
            watchlist: 2,
            do_not_touch_yet: 1,
            consensus_forming: 1
          })
        }),
        candidates: expect.arrayContaining([
          expect.objectContaining({
            id: 'ur_ai_rig_complex',
            sector: 'AI / Agent Rails',
            verificationStatus: 'verified_live_market',
            productionReady: true
          }),
          expect.objectContaining({
            id: 'ur_troll_attention_asset',
            ticker: 'TROLL',
            status: 'watchlist',
            verificationStatus: 'verified_live_market'
          }),
          expect.objectContaining({
            id: 'ur_black_bull_ansem',
            ticker: 'ANSEM',
            status: 'consensus_forming'
          }),
          expect.objectContaining({
            id: 'ur_kintara_kins',
            ticker: 'KINS',
            status: 'high_signal_lowcap',
            verdict: 'high_signal_early',
            sector: 'Gaming / Consumer',
            verificationStatus: 'verified_live_market'
          }),
          expect.objectContaining({
            id: 'ur_manifest_ambiguity',
            ticker: 'MANIFEST',
            status: 'do_not_touch_yet',
            verdict: 'do_not_touch_yet',
            verificationStatus: 'pending_manual_review'
          })
        ]),
      }));

      const list = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/candidates' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data.count).toBe(5);
      expect(list.json().data.candidates.every((candidate: { productionReady?: boolean }) => candidate.productionReady)).toBe(true);

      const detail = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/candidates/ur_ai_rig_complex' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        id: 'ur_ai_rig_complex',
        marketDataSource: 'dexscreener_official_api',
        verificationStatus: 'verified_live_market',
        dexScreenerData: expect.objectContaining({
          marketCap: 17500000,
          liquidityUsd: 654321.12,
          txns24hBuys: 80,
          txns24hSells: 45
        })
      }));

      const kinsDetail = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/candidates/ur_kintara_kins' });
      expect(kinsDetail.statusCode).toBe(200);
      expect(kinsDetail.json().data).toEqual(expect.objectContaining({
        id: 'ur_kintara_kins',
        status: 'high_signal_lowcap',
        verdict: 'high_signal_early',
        dexScreenerUrl: 'https://dexscreener.com/solana/f42tznkpavq1vucrl6ymhc6yqvpt84fwwgzbntv2wb3w',
        marketDataSource: 'dexscreener_official_api',
        verificationStatus: 'verified_live_market',
        proof_of_shipping: expect.stringContaining('token distribution receipt, liquidity receipt, supply receipt, launch receipt, and economy/marketplace receipt'),
        thesis: expect.stringContaining('crossed the first High-Signal Lowcap threshold'),
        tags: expect.arrayContaining(['HIGH_SIGNAL_LOWCAP', 'TOKEN_REVIEW_PASSED', 'RETENTION_MONITORING', 'LIVE_GAME_ROUTE', 'GUILD_ACTIVITY', 'COMMUNITY_WIKI', 'SERVER_QUEUE_SIGNAL', 'PLAYER_CLUSTER']),
        receipts: expect.arrayContaining([
          expect.objectContaining({
            label: 'Kintara live game route',
            type: 'LIVE_GAME_ROUTE',
            url: 'https://kintara.com/play?spectate=1'
          }),
          expect.objectContaining({
            label: 'Guild leaderboard receipt',
            note: expect.stringContaining('member counts, mob kills, PvP, bosses, and gold stats')
          }),
          expect.objectContaining({
            label: 'Community wiki receipt',
            note: expect.stringContaining('201 articles, 221 files, 1,598 edits, and 8 active users')
          }),
          expect.objectContaining({
            label: 'Player cluster receipt',
            note: expect.stringContaining('visible levels, names, and guild tags')
          }),
          expect.objectContaining({
            label: 'Server queue receipt',
            note: expect.stringContaining('multiple servers marked full, with queues on some servers')
          }),
          expect.objectContaining({
            label: 'Holder distribution receipt',
            note: expect.stringContaining('top 10 holders around 14.84%')
          }),
          expect.objectContaining({
            label: 'Liquidity depth receipt',
            note: expect.stringContaining('$480K-$650K liquidity')
          }),
          expect.objectContaining({
            label: 'Supply receipt',
            note: expect.stringContaining('993.4M circulating KINS')
          }),
          expect.objectContaining({
            label: 'Launch receipt',
            note: expect.stringContaining('pump.fun/PumpSwap')
          }),
          expect.objectContaining({
            label: 'Economy receipt',
            note: expect.stringContaining('playable MMO economy')
          })
        ])
      }));
      expect(kinsDetail.json().data.tags).not.toContain('TOKEN_REVIEW_NEEDED');

      const manifestDetail = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/candidates/ur_manifest_ambiguity' });
      expect(manifestDetail.statusCode).toBe(200);
      expect(manifestDetail.json().data).toEqual(expect.objectContaining({
        id: 'ur_manifest_ambiguity',
        verificationStatus: 'pending_manual_review',
        status: 'do_not_touch_yet',
        verdict: 'do_not_touch_yet'
      }));
      expect(manifestDetail.json().data).not.toHaveProperty('tokenAddress');
      expect(manifestDetail.json().data).not.toHaveProperty('dexScreenerData');

      const receipts = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/revenue-receipts' });
      expect(receipts.statusCode).toBe(200);
      expect(receipts.json().data).toEqual(expect.objectContaining({
        deprecated: true,
        canonical: '/v1/revenue-receipts',
        message: 'Revenue Receipts now live at the canonical public ledger endpoint.',
        count: 3,
        receipts: expect.arrayContaining([
          expect.objectContaining({ id: 'rr_open_evaluation_slot' }),
          expect.objectContaining({ id: 'rr_template_001' }),
          expect.objectContaining({ id: 'rr_unicorn_radar_build' })
        ])
      }));
    } finally {
      await app.close();
    }
  });

  it('creates submissions and paid evaluation requests', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const submit = await app.inject({
        method: 'POST',
        url: '/v1/unicorn-radar/submit',
        payload: {
          project: 'Example Lowcap',
          ticker: 'LOW',
          sector: 'AI',
          market_cap_range: '$1M-$3M',
          thesis: 'Shipping before consensus.',
          proof_links: ['https://example.com/demo'],
          submitter_handle: '@hunter'
        }
      });
      expect(submit.statusCode).toBe(200);

      const evaluation = await app.inject({
        method: 'POST',
        url: '/v1/unicorn-radar/request-evaluation',
        payload: {
          project: 'Example Lowcap',
          ticker: 'LOW',
          sector: 'AI',
          contact: 'founder@example.com'
        }
      });
      expect(evaluation.statusCode).toBe(200);
      expect(evaluation.json().data).toEqual(expect.objectContaining({
        status: 'evaluation_requested',
        doctrine: 'Projects can buy evaluation, not conviction.'
      }));
    } finally {
      await app.close();
    }
  });

  it('validates payloads and returns not found for unknown candidates', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const missing = await app.inject({ method: 'GET', url: '/v1/unicorn-radar/candidates/not-real' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: 'unicorn_radar_candidate_not_found' });

      const invalid = await app.inject({
        method: 'POST',
        url: '/v1/unicorn-radar/submit',
        payload: { project: '', sector: 'not-real', thesis: '' }
      });
      expect(invalid.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('serves Unicorn Radar candidate OG image routes for all verified candidates', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      for (const candidateId of ['ur_ai_rig_complex', 'ur_troll_attention_asset', 'ur_black_bull_ansem', 'ur_kintara_kins', 'ur_manifest_ambiguity']) {
        const response = await app.inject({ method: 'GET', url: `/og/unicorn-radar/${candidateId}.png` });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('image/png');
        expectPng(response.rawPayload);
      }
    } finally {
      await app.close();
    }
  }, 20000);

  it('returns 404 for unknown Unicorn Radar OG image routes', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/unicorn-radar/not-real.png' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'og_image_not_found' });
    } finally {
      await app.close();
    }
  });
});
