import type { UnicornRadarCandidate, UnicornRadarRevenueReceipt } from '../schemas/entities';

const UPDATED_AT = '2026-07-06T08:30:00.000Z';
const LIVE_DISCLOSURE = 'Verified live market candidate. Infopunks coverage remains receipt-driven and can change as evidence improves or degrades.';

function receipt(id: string, label: string, type: UnicornRadarCandidate['receipts'][number]['type'], note: string, url?: string): UnicornRadarCandidate['receipts'][number] {
  return {
    id,
    label,
    type,
    source: 'infopunks desk review',
    url,
    note,
    observed_at: UPDATED_AT
  };
}

function hunter(handle: string, attribution: string): UnicornRadarCandidate['hunter_credit'] {
  return {
    handle,
    attribution,
    submitted_at: UPDATED_AT,
    source: 'infopunks_desk'
  };
}

function communityHunter(handle: string, attribution: string): UnicornRadarCandidate['hunter_credit'] {
  return {
    handle,
    attribution,
    submitted_at: UPDATED_AT,
    source: 'community'
  };
}

function unpaidDisclosure(): UnicornRadarCandidate['paid_evaluation_disclosure'] {
  return {
    is_paid: false,
    label: 'No paid evaluation disclosed',
    note: 'No project payment recorded. Coverage is independent desk research.',
    paid_at: null,
    receipt_id: null
  };
}

export const unicornRadarCandidates: UnicornRadarCandidate[] = [
  {
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
    risk_flags: [
      'execution risk',
      'attention cooldown',
      'needs independent receipt review',
      'market cap may already price part of the thesis'
    ],
    why_now: 'Agent infrastructure still matters, but conviction should come from new receipts rather than stale narrative memory.',
    receipts: [
      receipt('urr_arc_receipt_001', 'Token address verified', 'market', 'Desk verified the live Solana token address before enabling market enrichment.'),
      receipt('urr_arc_receipt_002', 'Framework thesis remains legible', 'shipping', 'ARC remains a live agent-infrastructure candidate, but the desk still needs fresh product-level verification.')
    ],
    linked_narratives: [
      { label: 'Hermes Desk', href: '/hermes' },
      { label: 'Signal Graph', href: '/graph' }
    ],
    linked_graph_node: { id: 'agentic_payments', label: 'Agentic Payments', href: '/graph' },
    chainId: 'solana',
    tokenAddress: '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump',
    verificationStatus: 'verified_live_market',
    tokenAddressSource: 'Infopunks manual verification against the live DexScreener API and desk coverage.',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Live market token address verified before production launch.',
      'Candidate remains watchlist-only until fresh independent product receipts are reviewed.'
    ],
    productionReady: true,
    hunter_credit: hunter('@infopunks_desk', 'Infopunks desk verified ARC as a live market candidate before production launch.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
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
    updated_at: UPDATED_AT,
    sample_disclosure: LIVE_DISCLOSURE
  },
  {
    id: 'ur_troll_attention_asset',
    project: 'TROLL',
    ticker: 'TROLL',
    sector: 'Social / Attention Markets',
    market_cap_range: 'Live market, verify current range from DexScreener',
    thesis: 'Internet-native attention asset with strong cultural surface area, but weak product receipts.',
    what_it_actually_does: 'Functions as a live attention-market asset built on internet-native cultural persistence rather than a conventional product surface.',
    proof_of_shipping: 'Cultural longevity and market survival are visible, but the desk does not yet have strong product receipts to justify higher conviction.',
    attention_quality_note: 'Attention is real and persistent, but reflexive attention markets can confuse cultural durability with durable utility.',
    token_survivability_note: 'The token has cultural persistence, but intrinsic utility remains unclear and can disappear if attention breaks.',
    risk_flags: [
      'meme reflexivity',
      'promotion risk',
      'no clear intrinsic utility',
      'attention can evaporate fast'
    ],
    why_now: 'TROLL is a useful live case for distinguishing durable culture from durable product receipts.',
    receipts: [
      receipt('urr_troll_receipt_001', 'Token address verified', 'market', 'Desk verified the live Solana token address before enabling market enrichment.'),
      receipt('urr_troll_receipt_002', 'Attention thesis remains live', 'attention', 'TROLL continues to matter as a culture-layer attention asset, but the desk does not yet treat that as product proof.')
    ],
    linked_narratives: [
      { label: 'TROLL Signal Report', href: '/signals/troll' },
      { label: 'Attention Market Watch', href: '/narratives/attention-market-watch' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    chainId: 'solana',
    tokenAddress: '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2',
    verificationStatus: 'verified_live_market',
    tokenAddressSource: 'Infopunks manual verification against the live DexScreener API and TROLL narrative coverage.',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Live market token address verified before production launch.',
      'Strong attention does not substitute for product receipts.'
    ],
    productionReady: true,
    hunter_credit: hunter('@infopunks_desk', 'Infopunks desk verified TROLL as a live attention-market candidate with independent market checks.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'watchlist',
    verdict: 'strong_attention_weak_proof',
    scores: {
      shipping_proof: 34,
      attention_quality: 85,
      token_survivability: 44,
      category_timing: 82,
      asymmetry_potential: 57,
      overall_signal_score: 59,
      risk_score: 80
    },
    updated_at: UPDATED_AT,
    sample_disclosure: LIVE_DISCLOSURE
  },
  {
    id: 'ur_black_bull_ansem',
    project: 'The Black Bull',
    ticker: 'ANSEM',
    sector: 'Social / Attention Markets',
    market_cap_range: 'Live market, verify current range from DexScreener',
    thesis: 'A live case study in persona-linked attention markets and community coordination, but no longer an unseen low-cap.',
    what_it_actually_does: 'Represents a persona-linked attention market where community coordination and social identity drive the trade more than product utility.',
    proof_of_shipping: 'The live signal is community coordination and attention behavior, not product shipping, so the desk treats it as a consensus-forming market case study rather than a fresh hidden gem.',
    attention_quality_note: 'Attention is large, legible, and extremely reflexive, with concentration around persona-linked coordination.',
    token_survivability_note: 'Token survival depends on continued community energy and social identity loops more than product-level value accrual.',
    risk_flags: [
      'persona dependency',
      'reflexive volatility',
      'post-run downside risk',
      'social hype concentration'
    ],
    why_now: 'The Black Bull is now more useful as a public record of consensus formation than as a hidden low-cap discovery.',
    receipts: [
      receipt('urr_black_bull_receipt_001', 'Token address verified', 'market', 'Desk verified the live Solana token address before enabling market enrichment.'),
      receipt('urr_black_bull_receipt_002', 'Consensus status recorded', 'attention', 'The candidate remains important as a live attention-market case study even though the early edge is largely gone.')
    ],
    linked_narratives: [
      { label: 'Black Bull Signal Report', href: '/signals/black-bull' },
      { label: 'Attention Market Watch', href: '/narratives/attention-market-watch' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    chainId: 'solana',
    tokenAddress: '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump',
    verificationStatus: 'verified_live_market',
    tokenAddressSource: 'Infopunks manual verification against the live DexScreener API and Black Bull narrative coverage.',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Live market token address verified before production launch.',
      'Candidate retained as a consensus-forming attention-market case, not a hidden low-cap.'
    ],
    productionReady: true,
    hunter_credit: hunter('@infopunks_desk', 'Infopunks desk verified The Black Bull as a live persona-linked attention market candidate.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'consensus_forming',
    verdict: 'consensus_already_forming',
    scores: {
      shipping_proof: 28,
      attention_quality: 88,
      token_survivability: 46,
      category_timing: 54,
      asymmetry_potential: 31,
      overall_signal_score: 56,
      risk_score: 83
    },
    updated_at: UPDATED_AT,
    sample_disclosure: LIVE_DISCLOSURE
  },
  {
    id: 'ur_kintara_kins',
    project: 'Kintara',
    ticker: 'KINS',
    sector: 'Gaming / Consumer',
    market_cap_range: 'Live market, verify current range from DexScreener',
    thesis: 'Playable gaming/consumer candidate with a real MMO surface and active token market. Potential High-Signal Lowcap, but needs Infopunks receipts before stronger conviction.',
    what_it_actually_does: 'Kintara presents itself as an isometric MMO where players can play to earn, buy and sell with KINS, explore quests, and adventure with friends.',
    proof_of_shipping: 'Official product surface, verified live Solana market, live spectate/play route, guild leaderboard, player-cluster screenshots, wiki activity, and server-full screenshots. Needs independent token distribution, marketplace/economy, and sustained retention receipts.',
    attention_quality_note: 'CT intake created a useful lead, but attention quality still needs user/player evidence rather than price-led claims.',
    token_survivability_note: 'The token has a live market and visible game-facing role, but survivability depends on distribution, liquidity, and whether players use KINS beyond narrative cycles.',
    risk_flags: [
      'Token distribution still needs review',
      'Need sustained active-user receipts',
      'Need marketplace/economy activity proof',
      'Server fullness may be event-driven',
      'Market cap may already price part of the gaming narrative'
    ],
    tags: [
      'LIVE_GAME_ROUTE',
      'SPECTATE_MODE',
      'PRODUCT_SURFACE_CONFIRMED',
      'TOKEN_REVIEW_NEEDED'
    ],
    why_now: 'Drop #001 surfaced KINS as a High-Signal Lowcap Candidate Pending Receipts, but the desk is keeping it watchlist-only until Infopunks receipts improve.',
    receipts: [
      receipt('urr_kins_receipt_001', 'Token address verified', 'market', 'Solana token address recorded from Solscan via DexScreener before enabling live market enrichment.', 'https://solscan.io/token/Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump'),
      receipt('urr_kins_receipt_002', 'Live DexScreener pair identified', 'market', 'Live KINS market pair recorded for enrichment, with verdict kept independent from market data.', 'https://dexscreener.com/solana/f42tznkpavq1vucrl6ymhc6yqvpt84fwwgzbntv2wb3w'),
      receipt('urr_kins_receipt_003', 'Drop #001 CT intake note', 'note', 'Community intake is treated as a lead only. KINS needs gameplay/user receipts before higher conviction.'),
      receipt('urr_kins_receipt_004', 'Kintara live game route', 'LIVE_GAME_ROUTE', 'Kintara exposes a playable/spectate game route showing a KINTARA loading shell, game code loading state, and gameplay UI tip. This strengthens product-surface confidence but does not alone prove sustained player retention or token survivability.', 'https://kintara.com/play?spectate=1')
    ],
    linked_narratives: [
      { label: 'Signal Hunt', href: '/signal-hunt' },
      { label: 'Narrative Intel', href: '/narratives' }
    ],
    linked_graph_node: { id: 'consumer_crypto', label: 'Consumer Crypto', href: '/graph' },
    chainId: 'solana',
    tokenAddress: 'Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump',
    verificationStatus: 'verified_live_market',
    tokenAddressSource: 'Solscan via DexScreener',
    tokenAddressSourceUrl: 'https://solscan.io/token/Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump',
    dexScreenerUrl: 'https://dexscreener.com/solana/f42tznkpavq1vucrl6ymhc6yqvpt84fwwgzbntv2wb3w',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Live Solana market identified before production publication.',
      'High-Signal Lowcap Candidate Pending Receipts language is watchlist framing, not conviction.',
      'Needs independent gameplay, user, and token-distribution receipts.'
    ],
    productionReady: true,
    hunter_credit: communityHunter('CT community intake', 'CT community intake surfaced KINS for Drop #001 review. Infopunks added only framed, receipt-limited coverage.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'watchlist',
    verdict: 'interesting_needs_receipts',
    scores: {
      shipping_proof: 54,
      attention_quality: 48,
      token_survivability: 47,
      category_timing: 64,
      asymmetry_potential: 62,
      overall_signal_score: 55,
      risk_score: 72
    },
    updated_at: UPDATED_AT,
    sample_disclosure: LIVE_DISCLOSURE
  },
  {
    id: 'ur_manifest_ambiguity',
    project: 'MANIFEST / Manifesting',
    ticker: 'MANIFEST',
    sector: 'Social / Attention Markets',
    market_cap_range: 'No canonical market attached',
    thesis: 'Narrative has cultural stickiness, but token identity and market ambiguity are not clean enough for positive Radar treatment yet.',
    what_it_actually_does: 'Multiple Manifest/Manifesting token markets appear to exist, and the meme narrative overlaps with other projects using similar naming.',
    proof_of_shipping: 'Not enough verified proof for a positive verdict.',
    attention_quality_note: 'The narrative is culturally legible, but identity ambiguity makes attention easy to spoof and hard to attribute to one canonical market.',
    token_survivability_note: 'No survivability read until the canonical token address, ticker identity, liquidity, and market lineage are confirmed.',
    risk_flags: [
      'Ticker ambiguity',
      'Multiple token markets',
      'Low/unclear liquidity on some pairs',
      'Narrative can be easily spoofed',
      'Needs canonical token confirmation'
    ],
    why_now: 'Drop #001 intake is preserved as a Do Not Touch Yet record so the desk does not accidentally promote an ambiguous token market.',
    receipts: [
      receipt('urr_manifest_receipt_001', 'Drop #001 ambiguity note', 'risk', 'Community intake flagged MANIFEST, but no canonical token address has been verified. Do not DexScreener-enrich until identity is clean.'),
      receipt('urr_manifest_receipt_002', 'Manual review required', 'note', 'Ticker, token, and market ambiguity block positive Radar treatment.')
    ],
    linked_narratives: [
      { label: 'Attention Market Watch', href: '/narratives/attention-market-watch' },
      { label: 'Signal Hunt', href: '/signal-hunt' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    verificationStatus: 'pending_manual_review',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Pending manual review due to ticker, token, and market ambiguity.',
      'No token address is attached, by design.',
      'Do not DexScreener-enrich MANIFEST until a canonical token address is verified.'
    ],
    productionReady: true,
    hunter_credit: communityHunter('CT community intake', 'CT community intake surfaced MANIFEST for Drop #001 review. Infopunks retained only a negative ambiguity record.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'do_not_touch_yet',
    verdict: 'do_not_touch_yet',
    scores: {
      shipping_proof: 8,
      attention_quality: 36,
      token_survivability: 5,
      category_timing: 42,
      asymmetry_potential: 12,
      overall_signal_score: 14,
      risk_score: 94
    },
    updated_at: UPDATED_AT,
    sample_disclosure: 'Pending manual review. Do not touch yet: token identity and market ambiguity must be resolved before any positive Radar treatment.'
  }
];

export const unicornRadarRevenueReceipts: UnicornRadarRevenueReceipt[] = [];

export function listUnicornRadarCandidates(): UnicornRadarCandidate[] {
  return unicornRadarCandidates;
}

export function getUnicornRadarCandidate(candidateId: string): UnicornRadarCandidate | undefined {
  return unicornRadarCandidates.find((candidate) => candidate.id === candidateId);
}

export function listUnicornRadarRevenueReceipts(): UnicornRadarRevenueReceipt[] {
  return unicornRadarRevenueReceipts;
}
