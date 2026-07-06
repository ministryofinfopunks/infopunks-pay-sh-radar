import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listUnicornRadarCandidates } from '../src/data/unicornRadar';
import {
  buildUnicornRadarCandidateList,
  buildUnicornRadarRevenueReceipts,
  buildUnicornRadarSummary,
  createUnicornRadarSubmission,
  requestUnicornRadarEvaluation,
  resolveEnrichedUnicornRadarCandidate
} from '../src/services/unicornRadarService';

const VERIFIED_TOKEN = '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump';

function liveDexPair(baseTokenAddress = VERIFIED_TOKEN) {
  return [{
    chainId: 'solana',
    dexId: 'raydium',
    url: 'https://dexscreener.com/solana/arcpair111111111111111111111111111111111111',
    pairAddress: 'ArcPair111111111111111111111111111111111111',
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

describe('unicorn radar service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/tokens/v1/')) {
        if (url.includes('61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('BcHEaaTCvycPwwsJ9yQTXdHP9X2gCLkznDbZ8VySpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('BcHEaaTCvycPwwsJ9yQTXdHP9X2gCLkznDbZ8VySpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('8wxkvAfEns76yBzu4MnbV7VnXWjg3iDPA9uwAQ6cpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('8wxkvAfEns76yBzu4MnbV7VnXWjg3iDPA9uwAQ6cpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/token-pairs/v1/')) {
        if (url.includes('61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('BcHEaaTCvycPwwsJ9yQTXdHP9X2gCLkznDbZ8VySpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('BcHEaaTCvycPwwsJ9yQTXdHP9X2gCLkznDbZ8VySpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('8wxkvAfEns76yBzu4MnbV7VnXWjg3iDPA9uwAQ6cpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('8wxkvAfEns76yBzu4MnbV7VnXWjg3iDPA9uwAQ6cpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.includes('J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump')) return Promise.resolve(new Response(JSON.stringify(liveDexPair('J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump')), { status: 200, headers: { 'Content-Type': 'application/json' } }));
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

  it('returns the verified production candidate set', async () => {
    const list = await buildUnicornRadarCandidateList();

    expect(list.count).toBe(9);
    expect(list.candidates.map((candidate) => candidate.id)).toEqual([
      'ur_ai_rig_complex',
      'ur_troll_attention_asset',
      'ur_black_bull_ansem',
      'ur_kintara_kins',
      'ur_jotchua_money_dog',
      'ur_solangeles',
      'ur_useless_consensus',
      'ur_triplet_sahur',
      'ur_manifest_ambiguity'
    ]);
    expect(new Set(list.candidates.map((candidate) => candidate.sector))).toEqual(new Set([
      'AI / Agent Rails',
      'Social / Attention Markets',
      'Gaming / Consumer'
    ]));
  });

  it('enforces production candidate trust rules', () => {
    const candidates = listUnicornRadarCandidates().filter((candidate) => candidate.productionReady);

    for (const candidate of candidates) {
      expect(candidate.productionReady).toBe(true);
      expect(candidate.id).not.toMatch(/mock/i);
      expect(candidate.project).not.toMatch(/mock/i);
      expect(candidate.ticker).not.toMatch(/mock/i);
      expect(candidate.pairAddress ?? '').not.toMatch(/mock/i);
      expect(candidate.dexScreenerUrl ?? '').not.toMatch(/mock/i);
      expect(candidate.tokenAddressSourceUrl ?? '').not.toMatch(/mock/i);
      expect(JSON.stringify(candidate.receipts)).not.toMatch(/mock/i);
      expect(JSON.stringify(candidate.risk_flags)).not.toMatch(/mock/i);
      expect(JSON.stringify(candidate.verificationNotes ?? [])).not.toMatch(/mock/i);
    }
  });

  it('requires production-ready tokenized candidates to be verified live markets', () => {
    const candidates = listUnicornRadarCandidates().filter((candidate) => candidate.productionReady && candidate.tokenAddress);

    for (const candidate of candidates) {
      expect(candidate.chainId).toBeTruthy();
      expect(candidate.tokenAddress).toBeTruthy();
      expect(candidate.verificationStatus).toBe('verified_live_market');
      expect(candidate.verifiedAt).toBeTruthy();
      expect(candidate.tokenAddressSource || candidate.tokenAddressSourceUrl).toBeTruthy();
    }
  });

  it('keeps statuses, verdicts, and score ranges production-shaped', async () => {
    const summary = await buildUnicornRadarSummary();

    expect(summary.counts.total).toBe(9);
    expect(summary.counts.by_status.high_signal_lowcap).toBe(2);
    expect(summary.counts.by_status.watchlist).toBe(4);
    expect(summary.counts.by_status.do_not_touch_yet).toBe(1);
    expect(summary.counts.by_status.consensus_forming).toBe(2);
    expect(summary.counts.by_sector['AI / Agent Rails']).toBe(1);
    expect(summary.counts.by_sector['Social / Attention Markets']).toBe(7);
    expect(summary.counts.by_sector['Gaming / Consumer']).toBe(1);

    for (const candidate of summary.candidates) {
      for (const score of Object.values(candidate.scores)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
      expect(candidate.receipts.length).toBeGreaterThan(0);
    }
  });

  it('resolves verified candidate detail and uses empty revenue receipts', async () => {
    const candidate = await resolveEnrichedUnicornRadarCandidate('ur_ai_rig_complex');
    expect(candidate).toEqual(expect.objectContaining({
      project: 'AI Rig Complex',
      status: 'watchlist',
      verdict: 'real_product_weak_attention',
      verificationStatus: 'verified_live_market',
      productionReady: true
    }));

    expect(await resolveEnrichedUnicornRadarCandidate('missing')).toBeNull();
    expect(buildUnicornRadarRevenueReceipts()).toEqual([]);
  });

  it('promotes KINS to High-Signal Lowcap with token review receipts', async () => {
    const candidate = await resolveEnrichedUnicornRadarCandidate('ur_kintara_kins');
    expect(candidate).toEqual(expect.objectContaining({
      id: 'ur_kintara_kins',
      status: 'high_signal_lowcap',
      productionReady: true,
      verificationStatus: 'verified_live_market',
      verdict: 'high_signal_early',
      thesis: expect.stringContaining('crossed the first High-Signal Lowcap threshold'),
      proof_of_shipping: expect.stringContaining('token distribution receipt, liquidity receipt, supply receipt, launch receipt, and economy/marketplace receipt'),
      why_now: expect.stringContaining('this is not certainty'),
      tags: expect.arrayContaining([
        'HIGH_SIGNAL_LOWCAP',
        'TOKEN_REVIEW_PASSED',
        'RETENTION_MONITORING',
        'GAMEFI',
        'LIVE_GAME_ROUTE',
        'GUILD_ACTIVITY',
        'COMMUNITY_WIKI',
        'SERVER_QUEUE_SIGNAL',
        'PLAYER_CLUSTER',
        'MARKETPLACE_ECONOMY',
        'HOLDER_DISTRIBUTION_HEALTHY',
        'LIQUIDITY_DEPTH_REVIEWED',
        'FAIR_LAUNCH_RECEIPT'
      ]),
      receipts: expect.arrayContaining([
        expect.objectContaining({
          label: 'Kintara live game route',
          type: 'LIVE_GAME_ROUTE',
          url: 'https://kintara.com/play?spectate=1',
          note: expect.stringContaining('playable/spectate game route')
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
    expect(candidate?.tags ?? []).not.toContain('TOKEN_REVIEW_NEEDED');
  });

  it('adds the CT survivability batch with explicit risk framing', async () => {
    const jotchua = await resolveEnrichedUnicornRadarCandidate('ur_jotchua_money_dog');
    expect(jotchua).toEqual(expect.objectContaining({
      project: 'Jotchua',
      status: 'high_signal_lowcap',
      displayVerdict: 'High-Signal Meme Lowcap, Culture Retention Monitored',
      verificationStatus: 'verified_live_market',
      productionReady: true,
      proof_of_shipping: expect.stringContaining('11k+ holder receipt'),
      token_survivability_note: expect.stringContaining('liquidity depth'),
      thesis: expect.stringContaining('clean pump.fun fair launch'),
      risk_flags: expect.arrayContaining(['Pure meme with no product utility'])
    }));

    const solangeles = await resolveEnrichedUnicornRadarCandidate('ur_solangeles');
    expect(solangeles).toEqual(expect.objectContaining({
      project: 'SolAngeles',
      status: 'watchlist',
      displayVerdict: 'Real Content Moat, Distribution Still Monitored',
      verificationStatus: 'verified_live_market',
      productionReady: true,
      thesis: expect.stringContaining('content moat is real'),
      risk_flags: expect.arrayContaining(['Adult/NSFW content creates platform and brand risk'])
    }));

    const useless = await resolveEnrichedUnicornRadarCandidate('ur_useless_consensus');
    expect(useless).toEqual(expect.objectContaining({
      project: 'USELESS',
      status: 'consensus_forming',
      displayVerdict: 'Battle-Tested Meme Benchmark',
      verificationStatus: 'verified_live_market',
      productionReady: true,
      thesis: expect.stringContaining('survivability benchmark'),
      token_survivability_note: expect.stringContaining('lower lowcap upside')
    }));

    const triplet = await resolveEnrichedUnicornRadarCandidate('ur_triplet_sahur');
    expect(triplet).toEqual(expect.objectContaining({
      project: 'TripleT',
      status: 'watchlist',
      displayVerdict: 'Viral Meme Candidate, Longevity Unproven',
      verificationStatus: 'verified_live_market',
      productionReady: true,
      thesis: expect.stringContaining('strong viral meme roots'),
      risk_flags: expect.arrayContaining(['Hype-cycle dependent'])
    }));
  });

  it('fails open when DexScreener is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('dex down'))));
    const summary = await buildUnicornRadarSummary();
    expect(summary.candidates).toHaveLength(9);
    expect(summary.candidates.every((candidate) => candidate.productionReady)).toBe(true);
  });

  it('keeps MANIFEST out of DexScreener enrichment until canonical token verification', async () => {
    const candidate = await resolveEnrichedUnicornRadarCandidate('ur_manifest_ambiguity');
    expect(candidate).toEqual(expect.objectContaining({
      project: 'MANIFEST / Manifesting',
      verificationStatus: 'pending_manual_review',
      status: 'do_not_touch_yet',
      verdict: 'do_not_touch_yet'
    }));
    expect(candidate).not.toHaveProperty('tokenAddress');
    expect(candidate).not.toHaveProperty('dexScreenerData');
  });

  it('creates submit and paid evaluation request receipts', () => {
    const submission = createUnicornRadarSubmission({
      project: 'Example Lowcap',
      ticker: 'LOW',
      sector: 'AI',
      thesis: 'Ships before consensus.'
    });
    expect(submission).toEqual(expect.objectContaining({
      status: 'staged_for_review',
      candidate_preview: expect.objectContaining({ project: 'Example Lowcap', sector: 'AI' })
    }));

    const evaluation = requestUnicornRadarEvaluation({
      project: 'Example Lowcap',
      contact: 'founder@example.com'
    });
    expect(evaluation).toEqual(expect.objectContaining({
      status: 'evaluation_requested',
      doctrine: 'Projects can buy evaluation, not conviction.'
    }));
  });
});
