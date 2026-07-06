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
