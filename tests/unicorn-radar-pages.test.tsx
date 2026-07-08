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
  thesis: 'TROLL has matured from raw attention asset into a consensus-forming IP-backed meme survivor. The survivability case is built on elite holder breadth, deep liquidity, improving top-holder distribution, one-year survivorship, multiple revival cycles, official Trollface IP/license narrative, and strong on-chain activity. It remains a pure meme/IP play, so upside depends on sustained meme culture momentum and community engagement rather than product utility.',
  displayVerdict: 'Mature IP-Backed Meme Survivor',
  what_it_actually_does: 'Functions as a live Trollface IP-backed meme and attention-market asset built on internet-native cultural persistence rather than conventional product utility.',
  proof_of_shipping: 'Verified live Solana market, 64k+ holder survivability receipt, ~$3M liquidity-depth receipt, one-year age receipt, improving top-holder distribution receipt, fully circulating supply receipt, official Trollface IP/license narrative, merch/community surface, and multiple-cycle revival history.',
  token_survivability_note: 'Submitted survivability receipts cite elite holder breadth, deep liquidity, improving top-holder concentration, one-year survivorship, multiple revival cycles, fully circulating supply, and strong on-chain activity. The pure meme/IP risk remains live because the token has no utility moat beyond Trollface branding.',
  risk_flags: [
    'Pure meme/IP play with no utility moat beyond Trollface branding',
    'Large prior pumps and corrections create volatility risk',
    'Upside depends on sustained meme culture momentum',
    'At roughly $60M market cap, it has less lowcap asymmetry than newer candidates',
    'Community engagement and top-holder trends need monitoring'
  ],
  tags: ['CONSENSUS_FORMING', 'MATURE_MEME_SURVIVOR', 'IP_BACKED_MEME', 'HOLDER_DISTRIBUTION_HEALTHY', 'DEEP_LIQUIDITY', 'MULTI_CYCLE_SURVIVOR', 'CULTURE_RETENTION_MONITORING', 'PURE_MEME_RISK'],
  receipts: [
    ...baseCandidate.receipts,
    { id: 'urr_troll_receipt_002', label: 'Holder distribution receipt', type: 'token', source: 'CT survivability intake', note: 'TROLL shows 64k+ holders, an elite distribution profile for a Solana meme at this market cap.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_troll_receipt_003', label: 'Top-holder concentration receipt', type: 'token', source: 'CT survivability intake', note: 'Top 10 wallets are reported around 18-22% depending on excluded pool/exchange wallets, with concentration trending downward over recent months.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_troll_receipt_004', label: 'Liquidity depth receipt', type: 'market', source: 'CT survivability intake', note: 'Main PumpSwap liquidity is reported around $3M, roughly 5% of market cap, supporting deeper trading than typical lowcap memes.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_troll_receipt_005', label: 'Age/survivorship receipt', type: 'market', source: 'CT survivability intake', note: 'TROLL is around 1 year old and has survived multiple major pump/correction/revival cycles.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_troll_receipt_006', label: 'IP narrative receipt', type: 'attention', source: 'CT survivability intake', note: 'Official project positioning centers on Trollface IP/license ownership, memes/gifs, community channels, and merch/shop surface.', observed_at: '2026-07-06T08:30:00.000Z' }
  ],
  tokenAddress: '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2',
  pairAddress: 'TrollPair1111111111111111111111111111111111',
  dexScreenerUrl: 'https://dexscreener.com/solana/trollpair1111111111111111111111111111111111',
  hunter_credit: { handle: 'CT survivability intake', attribution: 'CT survivability intake submitted the TROLL survivability report. Infopunks upgraded the record to Consensus Forming while keeping pure meme/IP risk visible.', submitted_at: '2026-07-06T08:30:00.000Z', source: 'community' },
  paid_evaluation_disclosure: { is_paid: false, label: 'Not paid.', note: 'Not paid.', paid_at: null, receipt_id: null },
  status: 'consensus_forming',
  verdict: 'consensus_already_forming'
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
  thesis: 'Kintara has crossed the first High-Signal Lowcap threshold: playable browser MMO surface, live game route, guild/activity receipts, community wiki, full-server screenshots, verified Solana market, broad holder distribution, meaningful liquidity, fair pump.fun launch, and active in-game economy claims. Retention, marketplace depth, and execution remain the key risks.',
  what_it_actually_does: 'Kintara presents itself as an isometric MMO where players can play to earn, buy and sell with KINS, explore quests, and adventure with friends.',
  proof_of_shipping: 'Official product surface, verified live Solana market, live spectate/play route, guild leaderboard, player-cluster screenshots, wiki activity, server-full screenshots, token distribution receipt, liquidity receipt, supply receipt, launch receipt, and economy/marketplace receipt.',
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
    },
    {
      id: 'urr_kins_receipt_009',
      label: 'Holder distribution receipt',
      type: 'token',
      source: 'infopunks desk review',
      note: 'Solana Compass snapshot shows roughly 24k holders, top 10 holders around 14.84%, and top 25 around 28.74%.',
      observed_at: '2026-07-06T08:30:00.000Z'
    },
    {
      id: 'urr_kins_receipt_010',
      label: 'Liquidity depth receipt',
      type: 'market',
      source: 'infopunks desk review',
      note: 'DexScreener/Solana Compass snapshots show roughly $480K-$650K liquidity and active volume on KINS markets.',
      observed_at: '2026-07-06T08:30:00.000Z'
    },
    {
      id: 'urr_kins_receipt_011',
      label: 'Supply receipt',
      type: 'token',
      source: 'infopunks desk review',
      note: 'CoinGecko shows roughly 993.4M circulating KINS against a 1B max/FDV assumption.',
      observed_at: '2026-07-06T08:30:00.000Z'
    },
    {
      id: 'urr_kins_receipt_012',
      label: 'Launch receipt',
      type: 'market',
      source: 'infopunks desk review',
      note: 'KINS launched through pump.fun/PumpSwap with a live KINS/SOL market and pair age around 1 month.',
      observed_at: '2026-07-06T08:30:00.000Z'
    },
    {
      id: 'urr_kins_receipt_013',
      label: 'Economy receipt',
      type: 'shipping',
      source: 'infopunks desk review',
      note: 'Kintara public coverage describes a playable MMO economy with resources, trading, PvP wager, marketplace activity, and KINS-based activity.',
      observed_at: '2026-07-06T08:30:00.000Z'
    }
  ],
  tokenAddress: 'Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump',
  tokenAddressSource: 'Solscan via DexScreener',
  tokenAddressSourceUrl: 'https://solscan.io/token/Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump',
  dexScreenerUrl: 'https://dexscreener.com/solana/f42tznkpavq1vucrl6ymhc6yqvpt84fwwgzbntv2wb3w',
  status: 'high_signal_lowcap',
  verdict: 'high_signal_early',
  risk_flags: [
    'Very new project',
    'Retention still needs monitoring',
    'GameFi tokens remain volatile',
    'Anonymous or limited public team profile',
    'Marketplace and economy activity must stay active',
    'Market cap may already price part of the gaming narrative'
  ],
  tags: ['HIGH_SIGNAL_LOWCAP', 'TOKEN_REVIEW_PASSED', 'RETENTION_MONITORING', 'GAMEFI', 'LIVE_GAME_ROUTE', 'SPECTATE_MODE', 'PRODUCT_SURFACE_CONFIRMED', 'GAMEPLAY_RECEIPT', 'GUILD_ACTIVITY', 'COMMUNITY_WIKI', 'SERVER_QUEUE_SIGNAL', 'PLAYER_CLUSTER', 'MARKETPLACE_ECONOMY', 'HOLDER_DISTRIBUTION_HEALTHY', 'LIQUIDITY_DEPTH_REVIEWED', 'FAIR_LAUNCH_RECEIPT'],
  why_now: 'High-Signal Lowcap. KINS has crossed the first threshold, but this is not certainty: retention, marketplace depth, and execution remain monitored before conviction can rise again.'
};

const jotchuaCandidate = {
  ...baseCandidate,
  id: 'ur_jotchua_money_dog',
  project: 'Jotchua',
  ticker: 'JOTCHUA',
  sector: 'Social / Attention Markets',
  thesis: 'Jotchua has a strong lowcap meme survivability profile: broad holder base, healthy liquidity relative to market cap, clean pump.fun fair launch, revoked mint authority, high trading activity, and viral Money Dog cultural surface. It remains a pure narrative play, so retention and whale/influencer profit-taking must be monitored.',
  displayVerdict: 'High-Signal Meme Lowcap, Culture Retention Monitored',
  proof_of_shipping: 'Verified live Solana market, 11k+ holder receipt, liquidity-depth receipt, clean launch receipt, fully circulating supply receipt, and active volume/community receipt.',
  token_survivability_note: 'Submitted survivability receipts cite broad holders, liquidity depth, clean launch structure, revoked mint authority, and fully circulating supply. The pure meme risk remains live if culture momentum or volume reverses.',
  risk_flags: ['Pure meme with no product utility', 'Meme longevity depends on sustained culture momentum', 'Whale or influencer profit-taking may create volatility', 'High 24h volume can reverse quickly'],
  tags: ['HIGH_SIGNAL_LOWCAP', 'MEME_SURVIVABILITY', 'FAIR_LAUNCH_RECEIPT', 'HOLDER_DISTRIBUTION_HEALTHY', 'LIQUIDITY_DEPTH_REVIEWED', 'CULTURE_RETENTION_MONITORING', 'PURE_MEME_RISK'],
  tokenAddress: 'BcHEaaTCvycPwwsJ9yQTXdHP9X2gCLkznDbZ8VySpump',
  dexScreenerUrl: 'https://dexscreener.com/solana/akqyqgeifbbhqmanukzrrurgokskkbv8nvdccc87frr8',
  status: 'high_signal_lowcap',
  verdict: 'high_signal_early',
  why_now: 'High-Signal Lowcap from CT survivability receipts, with pure meme risk left explicit until retention and holder behavior stay durable across more cycles.'
};

const solangelesCandidate = {
  ...baseCandidate,
  id: 'ur_solangeles',
  project: 'SolAngeles',
  ticker: 'SolAngeles',
  sector: 'Social / Attention Markets',
  thesis: 'SolAngeles has one of the strongest product/activity surfaces in the batch: cartoon universe, characters, episodes, website, rewards/airdrop tracker, and community takeover dynamics. It enters Watchlist because the content moat is real, but adult/NSFW brand risk and execution consistency need monitoring.',
  displayVerdict: 'Real Content Moat, Distribution Still Monitored',
  proof_of_shipping: 'Verified live market, community takeover receipt, cartoon/content product surface, episode/content activity, rewards/airdrop tracker, and liquidity-depth receipt.',
  risk_flags: ['Adult/NSFW content creates platform and brand risk', 'Community takeover execution risk', 'Smaller scale than established meme peers', 'Growth depends on consistent episode/content output'],
  tags: ['WATCHLIST', 'CONTENT_MOAT', 'COMMUNITY_TAKEOVER', 'REWARDS_ECONOMY', 'NSFW_BRAND_RISK', 'LIQUIDITY_DEPTH_REVIEWED'],
  tokenAddress: '8wxkvAfEns76yBzu4MnbV7VnXWjg3iDPA9uwAQ6cpump',
  dexScreenerUrl: 'https://dexscreener.com/solana/ak7hdcxdsocd2zgjbca1zwlcudqz5f6n747a7rqtpxe3',
  status: 'watchlist',
  verdict: 'real_product_weak_attention',
  why_now: 'Watchlist. The content moat is real enough to track, but NSFW brand risk, community takeover execution, and output cadence keep conviction capped.'
};

const cupseyCandidate = {
  ...baseCandidate,
  id: 'ur_cupsey_plushie',
  project: 'CUPSEY',
  ticker: 'CUPSEY',
  sector: 'Consumer / Social / Attention Markets',
  thesis: 'CUPSEY stands out as a real-world meme product candidate: official Pump.fun plushie mascot, active e-commerce surface, plushies/apparel/accessories, charity donation loop, strong holder count for its tier, clean pump.fun launch, and healthy liquidity ratio. It remains a volatile micro/lowcap meme, and plushie revenue should not be treated as token revenue without direct proof, but the brand/product surface gives it more survivability than a pure digital meme.',
  displayVerdict: 'Real-World Meme Product, Brand Execution Monitored',
  what_it_actually_does: 'CUPSEY is a Solana meme/attention-market candidate tied to a physical Cupsey product surface: plushies, apparel, accessories, backpacks, keychains, wholesale/shipping claims, and a charity/donation narrative around plush distribution.',
  proof_of_shipping: 'Verified live Solana market, pump.fun origin, clean launch/authority receipt, ~10.8K holder receipt, healthy liquidity-ratio receipt, official cupseyshop.com product surface, plushie/apparel/accessory catalog, worldwide shipping/wholesale surface, and charity/donation narrative.',
  attention_quality_note: 'CUPSEY combines meme energy with a tangible brand surface. The official Pump.fun plushie mascot association and physical merchandise may broaden culture beyond crypto-native feeds, but brand execution and product momentum need monitoring.',
  token_survivability_note: 'The survivability case is stronger than a pure digital meme because holders, liquidity ratio, clean launch receipts, and real-world product/brand activity all exist. Product sales and brand awareness may support culture, but they are not automatically token revenue or guaranteed token demand without direct proof.',
  risk_flags: [
    'Extremely volatile micro/lowcap MCAP range',
    'Top-holder concentration needs stronger direct proof',
    'Plushie revenue is not automatically token revenue',
    'Brand execution and product momentum must continue',
    'Meme-sector volatility remains high',
    'Liquidity is healthy for the tier but still small in absolute terms',
    'Product narrative may fade if sales/community activity slows'
  ],
  tags: ['HIGH_SIGNAL_LOWCAP', 'REAL_WORLD_PRODUCT', 'MEME_WITH_PRODUCT', 'CONSUMER_BRAND', 'PHYSICAL_MERCH_RECEIPT', 'CHARITY_NARRATIVE', 'HOLDER_BASE_RECEIPT', 'LIQUIDITY_RATIO_HEALTHY', 'CLEAN_LAUNCH', 'BRAND_EXECUTION_MONITORING', 'TOKEN_REVENUE_NOT_PROVEN', 'MICROCAP_VOLATILITY'],
  receipts: [
    ...baseCandidate.receipts,
    { id: 'urr_cupsey_receipt_001', label: 'Holder receipt', type: 'token', source: 'CT survivability intake', note: 'CUPSEY report shows roughly 10,850 holders, a strong holder base for its micro/lowcap tier.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_cupsey_receipt_002', label: 'Liquidity receipt', type: 'market', source: 'CT survivability intake', note: 'Liquidity is reported around $59K-$200K+ across pools, often a strong ratio relative to its volatile MCAP range.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_cupsey_receipt_003', label: 'Launch receipt', type: 'market', source: 'CT survivability intake', note: 'CUPSEY originated through pump.fun with clean migration to Raydium/PumpSwap-style pools and no major authority red flags reported.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_cupsey_receipt_004', label: 'Product receipt', type: 'shipping', source: 'CT survivability intake', url: 'https://cupseyshop.com', note: 'cupseyshop.com sells physical Cupsey products including weighted anxiety plushies, jumbo sizes, apparel, accessories, backpacks, and keychains.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_cupsey_receipt_005', label: 'Charity receipt', type: 'attention', source: 'CT survivability intake', note: 'The report says every purchase donates one plush to someone in need, creating a positive real-world impact narrative.', observed_at: '2026-07-06T08:30:00.000Z' },
    { id: 'urr_cupsey_receipt_006', label: 'Risk receipt', type: 'risk', source: 'CT survivability intake', note: 'Product sales and brand awareness may support culture, but they are not automatically token revenue or guaranteed token demand.', observed_at: '2026-07-06T08:30:00.000Z' }
  ],
  tokenAddress: '6NwarBvDkXhByqVp2Qkq5i9XbtA2B3Bwe8SWGu9vpump',
  tokenAddressSource: 'CT survivability intake submitted token address only; Infopunks relies on DexScreener token-address enrichment for canonical pair resolution and does not hardcode an unverified pair URL.',
  tokenAddressSourceUrl: 'https://solscan.io/token/6NwarBvDkXhByqVp2Qkq5i9XbtA2B3Bwe8SWGu9vpump',
  dexScreenerUrl: 'https://dexscreener.com/solana/cupseypair111111111111111111111111111111111',
  status: 'high_signal_lowcap',
  verdict: 'high_signal_early',
  paid_evaluation_disclosure: { is_paid: false, label: 'Not paid.', note: 'Not paid.', paid_at: null, receipt_id: null },
  hunter_credit: { handle: 'CT survivability intake', attribution: 'CT survivability intake submitted CUPSEY as a real-world meme product candidate. Infopunks added High-Signal Lowcap coverage while keeping token-revenue-not-proven risk explicit.', submitted_at: '2026-07-06T08:30:00.000Z', source: 'community' },
  why_now: 'High-Signal Lowcap. CUPSEY has enough holder, liquidity, clean-launch, and physical product/brand receipts to track as a real-world meme product candidate, while token-revenue-not-proven and microcap volatility remain explicit.'
};

const uselessCandidate = {
  ...baseCandidate,
  id: 'ur_useless_consensus',
  project: 'USELESS',
  ticker: 'USELESS',
  sector: 'Social / Attention Markets',
  thesis: 'USELESS is a mature satirical Solana meme with established liquidity, long holder history, and sustained community activity. It is not an early lowcap candidate anymore, but it belongs as a consensus-forming survivability benchmark.',
  displayVerdict: 'Battle-Tested Meme Benchmark',
  token_survivability_note: 'Long holder history, deep liquidity, and mature age improve survivability confidence, while higher market cap creates lower lowcap upside than early candidates.',
  risk_flags: ['High market cap reduces asymmetric lowcap upside', 'Pure meme with no product moat beyond narrative', 'Satirical branding may cap mainstream crossover'],
  tags: ['CONSENSUS_FORMING', 'BATTLE_TESTED_MEME', 'SURVIVABILITY_BENCHMARK', 'DEEP_LIQUIDITY', 'PURE_MEME_RISK'],
  tokenAddress: 'Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk',
  dexScreenerUrl: 'https://dexscreener.com/solana/q2sphpduwfmg7m7wwrqklrn619caucfrsmhvjffodsp',
  status: 'consensus_forming',
  verdict: 'consensus_already_forming',
  why_now: 'Consensus Forming. USELESS belongs as a battle-tested meme survivability benchmark, but lower lowcap upside keeps it out of High-Signal Lowcap.'
};

const tripletCandidate = {
  ...baseCandidate,
  id: 'ur_triplet_sahur',
  project: 'TripleT',
  ticker: 'TRIPLET',
  sector: 'Social / Attention Markets',
  thesis: 'TripleT has strong viral meme roots, fair launch structure, meaningful liquidity, and active trading. It enters Watchlist rather than High-Signal because the project is pure meme, newer than more battle-tested peers, and still dependent on sustained brainrot/TikTok cultural momentum.',
  displayVerdict: 'Viral Meme Candidate, Longevity Unproven',
  attention_quality_note: 'Viral meme origin gives TripleT strong attention, but attention quality remains hype-cycle dependent until culture retention is proven beyond the current cycle.',
  risk_flags: ['Pure meme with no product utility', 'Hype-cycle dependent', 'Regional/niche meme concentration risk', 'Less battle-tested than older meme peers'],
  tags: ['WATCHLIST', 'VIRAL_MEME', 'FAIR_LAUNCH_RECEIPT', 'LIQUIDITY_DEPTH_REVIEWED', 'CULTURE_RETENTION_MONITORING', 'PURE_MEME_RISK'],
  tokenAddress: 'J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump',
  dexScreenerUrl: 'https://dexscreener.com/solana/3kfcgj5r3zshw8htdbzjsrrksrymkvsmfhc4vo4iddxd',
  status: 'watchlist',
  verdict: 'strong_attention_weak_proof',
  why_now: 'Watchlist. TripleT has viral meme traction and token survivability receipts, but hype-cycle risk and limited battle-testing block High-Signal promotion.'
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
    total: 10,
    by_status: {
      unseen_signal: 0,
      watchlist: 3,
      high_signal_lowcap: 3,
      consensus_forming: 3,
      do_not_touch_yet: 1,
      infopunks_missed_it: 0,
      paid_evaluation: 0
    },
    by_verdict: {
      high_signal_early: 3,
      interesting_needs_receipts: 0,
      real_product_weak_attention: 2,
      strong_attention_weak_proof: 1,
      do_not_touch_yet: 1,
      consensus_already_forming: 3,
      missed_by_infopunks: 0
    },
    by_sector: {
      AI: 0,
      'AI / Agent Rails': 1,
      RWA: 0,
      DeFi: 0,
      DePIN: 0,
      Consumer: 0,
      'Consumer / Social / Attention Markets': 1,
      'Gaming / Consumer': 1,
      'Agent Rails': 0,
      'Payment Infrastructure': 0,
      'Social / Attention Markets': 7,
      'Tokenized Apps': 0
    }
  },
  candidates: [baseCandidate, trollCandidate, bullCandidate, kinsCandidate, jotchuaCandidate, solangelesCandidate, cupseyCandidate, uselessCandidate, tripletCandidate, manifestCandidate],
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

  it('renders /unicorn-radar with the premium snapshot, featured calls, filters, and candidate sections', async () => {
    window.history.pushState({}, '', '/unicorn-radar');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Infopunks Unicorn Radar');
    expect(container.textContent).toContain('COMMERCIAL SIGNAL DESK');
    expect(container.textContent).toContain('Finding serious low-cap Solana projects before consensus does.');

    const snapshot = container.querySelector('[aria-label="Radar Snapshot Panel"]');
    expect(snapshot?.textContent).toContain('Candidates');
    expect(snapshot?.textContent).toContain('High-Signal');
    expect(snapshot?.textContent).toContain('Watchlist');
    expect(snapshot?.textContent).toContain('Do Not Touch');
    expect(snapshot?.textContent).toContain('Consensus');
    expect(snapshot?.textContent).toContain('Last Updated');
    const snapshotRows = Array.from(snapshot?.querySelectorAll('.radar-snapshot-counts p') ?? []).map((node) => node.textContent);
    expect(snapshotRows).toEqual(expect.arrayContaining(['Candidates10', 'High-Signal3', 'Watchlist3', 'Do Not Touch1', 'Consensus3']));

    const featured = container.querySelector('section[aria-label="Featured Radar Calls"]');
    expect(featured?.textContent).toContain('Featured Radar Calls');
    expect(featured?.textContent).toContain('KINS');
    expect(featured?.textContent).toContain('MANIFEST');
    expect(featured?.textContent).toContain('TROLL');
    expect(featured?.querySelector('a[href="/unicorn-radar/ur_kintara_kins"]')).toBeTruthy();
    expect(featured?.querySelector('a[href="/og/unicorn-radar/ur_kintara_kins.png"]')).toBeTruthy();

    const dropSummary = container.querySelector('section[aria-label="Drop #001 summary"]');
    expect(dropSummary?.textContent).toContain('Drop #001 remains receipt-framed.');
    expect(dropSummary?.textContent).toContain('High-Signal');
    expect(dropSummary?.textContent).toContain('KINS');
    expect(dropSummary?.textContent).toContain('Jotchua');
    expect(dropSummary?.textContent).toContain('CUPSEY');
    expect(dropSummary?.textContent).toContain('Do Not Touch Yet');
    expect(dropSummary?.textContent).toContain('MANIFEST');
    expect(dropSummary?.textContent).toContain('Consensus');
    expect(dropSummary?.textContent).toContain('TROLL');
    expect(dropSummary?.textContent).toContain('CUPSEY: High-Signal Lowcap, real-world meme product, brand execution monitored.');

    const filters = container.querySelector('section[aria-label="Candidate filters"]');
    expect(filters?.textContent).toContain('All');
    expect(filters?.textContent).toContain('High-Signal Lowcap');
    expect(filters?.textContent).toContain('Share Mode');
    expect(filters?.querySelector('input[placeholder="Project, ticker, tag"]')).toBeTruthy();

    const highSignal = container.querySelector('section[aria-label="High-Signal Lowcaps"]');
    const doNotTouch = container.querySelector('section[aria-label="Do Not Touch Yet"]');
    const consensus = container.querySelector('section[aria-label="Consensus Forming"]');
    expect(highSignal?.textContent).toContain('Kintara');
    expect(highSignal?.textContent).toContain('KINS');
    expect(highSignal?.textContent).toContain('Jotchua');
    expect(highSignal?.textContent).toContain('CUPSEY');
    expect(highSignal?.textContent).toContain('Real-World Meme Product, Brand Execution Monitored');
    expect(doNotTouch?.textContent).toContain('MANIFEST / Manifesting');
    expect(doNotTouch?.textContent).toContain('MANIFEST');
    expect(consensus?.textContent).toContain('TROLL');
    expect(consensus?.textContent).toContain('The Black Bull');
    expect(container.querySelector('a[href="/unicorn-radar/ur_manifest_ambiguity"]')).toBeTruthy();
    expect(container.querySelector('a[href="/og/unicorn-radar/ur_manifest_ambiguity.png"]')).toBeTruthy();

    expect(container.textContent).toContain('Revenue Receipts');
    expect(container.textContent).toContain('Evaluation Request');
    expect(container.textContent).toContain('Submit Candidate');
    expect(container.querySelector('a[href="/revenue-receipts"]')).toBeTruthy();
    expect(container.querySelector('a[href="/evaluation-request"]')).toBeTruthy();
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

  it('renders KINS as High-Signal Lowcap with live game route and token review tags', async () => {
    mockFetch(kinsCandidate, summary);
    window.history.pushState({}, '', '/unicorn-radar/ur_kintara_kins');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Kintara');
    expect(container.textContent).toContain('High Signal Lowcap');
    expect(container.textContent).toContain('High-Signal, Retention Still Monitored');
    expect(container.textContent).toContain('live spectate/play route');
    expect(container.textContent).toContain('token distribution receipt');
    expect(container.textContent).toContain('liquidity receipt');
    expect(container.textContent).toContain('supply receipt');
    expect(container.textContent).toContain('launch receipt');
    expect(container.textContent).toContain('economy/marketplace receipt');
    expect(container.textContent).toContain('Kintara live game route');
    expect(container.textContent).toContain('playable/spectate game route');
    expect(container.textContent).toContain('Guild leaderboard receipt');
    expect(container.textContent).toContain('Community wiki receipt');
    expect(container.textContent).toContain('Player cluster receipt');
    expect(container.textContent).toContain('Server queue receipt');
    expect(container.textContent).toContain('Holder distribution receipt');
    expect(container.textContent).toContain('Liquidity depth receipt');
    expect(container.textContent).toContain('Supply receipt');
    expect(container.textContent).toContain('Launch receipt');
    expect(container.textContent).toContain('Economy receipt');
    expect(container.textContent).toContain('member counts, mob kills, PvP, bosses, and gold stats');
    expect(container.textContent).toContain('201 articles, 221 files, 1,598 edits, and 8 active users');
    expect(container.textContent).toContain('crowded player gathering with visible levels, names, and guild tags');
    expect(container.textContent).toContain('multiple servers marked full, with queues on some servers');
    expect(container.textContent).toContain('roughly 24k holders');
    expect(container.textContent).toContain('$480K-$650K liquidity');
    expect(container.textContent).toContain('993.4M circulating KINS');
    expect(container.textContent).toContain('pump.fun/PumpSwap');
    expect(container.textContent).toContain('playable MMO economy');
    expect(container.textContent).toContain('TOKEN_REVIEW_PASSED');
    expect(container.textContent).toContain('RETENTION_MONITORING');
    expect(container.textContent).not.toContain('TOKEN_REVIEW_NEEDED');
    expect(container.textContent).toContain('LIVE_GAME_ROUTE');
    expect(container.textContent).toContain('this is not certainty');
  });

  it('renders CT survivability batch detail pages with source-framed statuses and risks', async () => {
    mockFetch(trollCandidate, summary);
    window.history.pushState({}, '', '/unicorn-radar/ur_troll_attention_asset');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('TROLL');
    expect(container.textContent).toContain('Consensus Forming');
    expect(container.textContent).toContain('Mature IP-Backed Meme Survivor');
    expect(container.textContent).toContain('64k+ holder survivability receipt');
    expect(container.textContent).toContain('Top-holder concentration receipt');
    expect(container.textContent).toContain('Liquidity depth receipt');
    expect(container.textContent).toContain('around 1 year old');
    expect(container.textContent).toContain('Trollface IP/license ownership');
    expect(container.textContent).toContain('Pure meme/IP play with no utility moat beyond Trollface branding');
    expect(container.textContent).toContain('MATURE_MEME_SURVIVOR');
    expect(container.textContent).toContain('IP_BACKED_MEME');
    expect(container.textContent).not.toContain('TOKEN_REVIEW_NEEDED');

    act(() => root.unmount());
    root = createRoot(container);
    mockFetch(jotchuaCandidate, summary);
    window.history.pushState({}, '', '/unicorn-radar/ur_jotchua_money_dog');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Jotchua');
    expect(container.textContent).toContain('High Signal Lowcap');
    expect(container.textContent).toContain('High-Signal Meme Lowcap, Culture Retention Monitored');
    expect(container.textContent).toContain('11k+ holder receipt');
    expect(container.textContent).toContain('liquidity-depth receipt');
    expect(container.textContent).toContain('clean launch receipt');
    expect(container.textContent).toContain('Pure meme with no product utility');

    act(() => root.unmount());
    root = createRoot(container);
    mockFetch(solangelesCandidate, summary);
    window.history.pushState({}, '', '/unicorn-radar/ur_solangeles');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('SolAngeles');
    expect(container.textContent).toContain('Watchlist');
    expect(container.textContent).toContain('Real Content Moat, Distribution Still Monitored');
    expect(container.textContent).toContain('content moat is real');
    expect(container.textContent).toContain('Adult/NSFW content creates platform and brand risk');

    act(() => root.unmount());
    root = createRoot(container);
    mockFetch(uselessCandidate, summary);
    window.history.pushState({}, '', '/unicorn-radar/ur_useless_consensus');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('USELESS');
    expect(container.textContent).toContain('Consensus Forming');
    expect(container.textContent).toContain('Battle-Tested Meme Benchmark');
    expect(container.textContent).toContain('survivability benchmark');
    expect(container.textContent).toContain('lower lowcap upside');

    act(() => root.unmount());
    root = createRoot(container);
    mockFetch(tripletCandidate, summary);
    window.history.pushState({}, '', '/unicorn-radar/ur_triplet_sahur');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('TripleT');
    expect(container.textContent).toContain('Watchlist');
    expect(container.textContent).toContain('Viral Meme Candidate, Longevity Unproven');
    expect(container.textContent).toContain('strong viral meme roots');
    expect(container.textContent).toContain('Hype-cycle dependent');

    act(() => root.unmount());
    root = createRoot(container);
    mockFetch(cupseyCandidate, summary);
    window.history.pushState({}, '', '/unicorn-radar/ur_cupsey_plushie');

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('CUPSEY');
    expect(container.textContent).toContain('High Signal Lowcap');
    expect(container.textContent).toContain('Real-World Meme Product, Brand Execution Monitored');
    expect(container.textContent).toContain('cupseyshop.com product surface');
    expect(container.textContent).toContain('weighted anxiety plushies');
    expect(container.textContent).toContain('apparel, accessories');
    expect(container.textContent).toContain('donates one plush');
    expect(container.textContent).toContain('10,850 holders');
    expect(container.textContent).toContain('$59K-$200K+');
    expect(container.textContent).toContain('not automatically token revenue');
    expect(container.textContent).toContain('REAL_WORLD_PRODUCT');
    expect(container.textContent).toContain('PHYSICAL_MERCH_RECEIPT');
    expect(container.textContent).toContain('CHARITY_NARRATIVE');
    expect(container.textContent).toContain('TOKEN_REVENUE_NOT_PROVEN');
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
