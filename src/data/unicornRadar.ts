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

function survivabilityReceipt(id: string, label: string, type: UnicornRadarCandidate['receipts'][number]['type'], note: string, url?: string): UnicornRadarCandidate['receipts'][number] {
  return {
    id,
    label,
    type,
    source: 'CT survivability intake',
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
    thesis: 'Kintara has crossed the first High-Signal Lowcap threshold: playable browser MMO surface, live game route, guild/activity receipts, community wiki, full-server screenshots, verified Solana market, broad holder distribution, meaningful liquidity, fair pump.fun launch, and active in-game economy claims. Retention, marketplace depth, and execution remain the key risks.',
    what_it_actually_does: 'Kintara presents itself as an isometric MMO where players can play to earn, buy and sell with KINS, explore quests, and adventure with friends.',
    proof_of_shipping: 'Official product surface, verified live Solana market, live spectate/play route, guild leaderboard, player-cluster screenshots, wiki activity, server-full screenshots, token distribution receipt, liquidity receipt, supply receipt, launch receipt, and economy/marketplace receipt.',
    attention_quality_note: 'CT intake created a useful lead, but attention quality still needs user/player evidence rather than price-led claims.',
    token_survivability_note: 'The token has passed the first survivability review on holder distribution, liquidity depth, supply, and launch receipts, but retention and real in-game economic depth still need active monitoring.',
    risk_flags: [
      'Very new project',
      'Retention still needs monitoring',
      'GameFi tokens remain volatile',
      'Anonymous or limited public team profile',
      'Marketplace and economy activity must stay active',
      'Market cap may already price part of the gaming narrative'
    ],
    tags: [
      'HIGH_SIGNAL_LOWCAP',
      'TOKEN_REVIEW_PASSED',
      'RETENTION_MONITORING',
      'GAMEFI',
      'LIVE_GAME_ROUTE',
      'SPECTATE_MODE',
      'PRODUCT_SURFACE_CONFIRMED',
      'GAMEPLAY_RECEIPT',
      'GUILD_ACTIVITY',
      'COMMUNITY_WIKI',
      'SERVER_QUEUE_SIGNAL',
      'PLAYER_CLUSTER',
      'MARKETPLACE_ECONOMY',
      'HOLDER_DISTRIBUTION_HEALTHY',
      'LIQUIDITY_DEPTH_REVIEWED',
      'FAIR_LAUNCH_RECEIPT'
    ],
    why_now: 'High-Signal Lowcap. KINS has crossed the first threshold, but this is not certainty: retention, marketplace depth, and execution remain monitored before conviction can rise again.',
    receipts: [
      receipt('urr_kins_receipt_001', 'Token address verified', 'market', 'Solana token address recorded from Solscan via DexScreener before enabling live market enrichment.', 'https://solscan.io/token/Tqj8yFmagrg7oorpQkVGYR52r96RFTamvWfth9bpump'),
      receipt('urr_kins_receipt_002', 'Live DexScreener pair identified', 'market', 'Live KINS market pair recorded for enrichment, with verdict kept independent from market data.', 'https://dexscreener.com/solana/f42tznkpavq1vucrl6ymhc6yqvpt84fwwgzbntv2wb3w'),
      receipt('urr_kins_receipt_003', 'Drop #001 CT intake note', 'note', 'Community intake is treated as a lead. KINS now has enough product/activity and token-survivability receipts to cross the first High-Signal Lowcap threshold.'),
      receipt('urr_kins_receipt_004', 'Kintara live game route', 'LIVE_GAME_ROUTE', 'Kintara exposes a playable/spectate game route showing a KINTARA loading shell, game code loading state, and gameplay UI tip. This strengthens product-surface confidence but does not alone prove sustained player retention or token survivability.', 'https://kintara.com/play?spectate=1'),
      receipt('urr_kins_receipt_005', 'Guild leaderboard receipt', 'note', 'In-game guild leaderboard shows organized guilds, member counts, mob kills, PvP, bosses, and gold stats.'),
      receipt('urr_kins_receipt_006', 'Community wiki receipt', 'note', 'Kintara Wiki screenshot shows 201 articles, 221 files, 1,598 edits, and 8 active users.'),
      receipt('urr_kins_receipt_007', 'Player cluster receipt', 'note', 'In-game screenshot shows a crowded player gathering with visible levels, names, and guild tags.'),
      receipt('urr_kins_receipt_008', 'Server queue receipt', 'note', 'Server selection screenshot shows multiple servers marked full, with queues on some servers.'),
      receipt('urr_kins_receipt_009', 'Holder distribution receipt', 'token', 'Solana Compass snapshot shows roughly 24k holders, top 10 holders around 14.84%, and top 25 around 28.74%.'),
      receipt('urr_kins_receipt_010', 'Liquidity depth receipt', 'market', 'DexScreener/Solana Compass snapshots show roughly $480K-$650K liquidity and active volume on KINS markets.', 'https://dexscreener.com/solana/f42tznkpavq1vucrl6ymhc6yqvpt84fwwgzbntv2wb3w'),
      receipt('urr_kins_receipt_011', 'Supply receipt', 'token', 'CoinGecko shows roughly 993.4M circulating KINS against a 1B max/FDV assumption.'),
      receipt('urr_kins_receipt_012', 'Launch receipt', 'market', 'KINS launched through pump.fun/PumpSwap with a live KINS/SOL market and pair age around 1 month.'),
      receipt('urr_kins_receipt_013', 'Economy receipt', 'shipping', 'Kintara public coverage describes a playable MMO economy with resources, trading, PvP wager, marketplace activity, and KINS-based activity.')
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
      'KINS has crossed the first High-Signal Lowcap threshold, but this is not certainty.',
      'Retention, marketplace depth, and execution remain monitored.'
    ],
    productionReady: true,
    hunter_credit: communityHunter('CT community intake', 'CT community intake surfaced KINS for Drop #001 review. Infopunks added only framed, receipt-limited coverage.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'high_signal_lowcap',
    verdict: 'high_signal_early',
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
    id: 'ur_jotchua_money_dog',
    project: 'Jotchua',
    ticker: 'JOTCHUA',
    sector: 'Social / Attention Markets',
    market_cap_range: 'Live market, verify current range from DexScreener',
    thesis: 'Jotchua has a strong lowcap meme survivability profile: broad holder base, healthy liquidity relative to market cap, clean pump.fun fair launch, revoked mint authority, high trading activity, and viral Money Dog cultural surface. It remains a pure narrative play, so retention and whale/influencer profit-taking must be monitored.',
    displayVerdict: 'High-Signal Meme Lowcap, Culture Retention Monitored',
    what_it_actually_does: 'Jotchua is a Money Dog attention-market meme on Solana with no product utility claim attached to the current Radar record.',
    proof_of_shipping: 'Verified live Solana market, 11k+ holder receipt, liquidity-depth receipt, clean launch receipt, fully circulating supply receipt, and active volume/community receipt.',
    attention_quality_note: 'Viral Money Dog culture gives Jotchua a visible attention surface, but the desk is treating that as culture retention to monitor rather than product evidence.',
    token_survivability_note: 'Submitted survivability receipts cite broad holders, liquidity depth, clean launch structure, revoked mint authority, and fully circulating supply. The pure meme risk remains live if culture momentum or volume reverses.',
    risk_flags: [
      'Pure meme with no product utility',
      'Meme longevity depends on sustained culture momentum',
      'Whale or influencer profit-taking may create volatility',
      'High 24h volume can reverse quickly'
    ],
    tags: [
      'HIGH_SIGNAL_LOWCAP',
      'MEME_SURVIVABILITY',
      'FAIR_LAUNCH_RECEIPT',
      'HOLDER_DISTRIBUTION_HEALTHY',
      'LIQUIDITY_DEPTH_REVIEWED',
      'CULTURE_RETENTION_MONITORING',
      'PURE_MEME_RISK'
    ],
    why_now: 'High-Signal Lowcap from CT survivability receipts, with pure meme risk left explicit until retention and holder behavior stay durable across more cycles.',
    receipts: [
      survivabilityReceipt('urr_jotchua_receipt_001', 'Live market receipt', 'market', 'Verified live Solana market and DexScreener pair recorded for enrichment.', 'https://dexscreener.com/solana/akqyqgeifbbhqmanukzrrurgokskkbv8nvdccc87frr8'),
      survivabilityReceipt('urr_jotchua_receipt_002', 'Holder base receipt', 'token', 'Submitted receipt cites an 11k+ holder base, supporting healthier distribution for a lowcap meme candidate.'),
      survivabilityReceipt('urr_jotchua_receipt_003', 'Liquidity depth receipt', 'market', 'Submitted liquidity-depth receipt frames liquidity as healthy relative to market cap, but volatility remains monitored.'),
      survivabilityReceipt('urr_jotchua_receipt_004', 'Clean launch receipt', 'market', 'Submitted launch receipt cites a clean pump.fun fair launch and revoked mint authority.'),
      survivabilityReceipt('urr_jotchua_receipt_005', 'Culture and activity receipt', 'attention', 'Money Dog cultural surface, high trading activity, and community activity are live, but pure meme retention is not guaranteed.')
    ],
    linked_narratives: [
      { label: 'Attention Market Watch', href: '/narratives/attention-market-watch' },
      { label: 'Signal Hunt', href: '/signal-hunt' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    chainId: 'solana',
    tokenAddress: 'BcHEaaTCvycPwwsJ9yQTXdHP9X2gCLkznDbZ8VySpump',
    verificationStatus: 'verified_live_market',
    tokenAddressSource: 'CT survivability intake submitted token address and live DexScreener pair; Infopunks keeps source framing and risk notes visible.',
    dexScreenerUrl: 'https://dexscreener.com/solana/akqyqgeifbbhqmanukzrrurgokskkbv8nvdccc87frr8',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Live Solana market recorded from submitted survivability receipts.',
      'High-Signal Lowcap status reflects token survivability receipts, not product utility.',
      'Pure meme risk and culture retention remain monitored.'
    ],
    productionReady: true,
    hunter_credit: communityHunter('CT survivability intake', 'CT survivability intake submitted Jotchua receipts. Infopunks added a source-framed High-Signal Lowcap record without erasing pure meme risk.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'high_signal_lowcap',
    verdict: 'high_signal_early',
    scores: {
      shipping_proof: 18,
      attention_quality: 78,
      token_survivability: 74,
      category_timing: 72,
      asymmetry_potential: 76,
      overall_signal_score: 69,
      risk_score: 81
    },
    updated_at: UPDATED_AT,
    sample_disclosure: LIVE_DISCLOSURE
  },
  {
    id: 'ur_solangeles',
    project: 'SolAngeles',
    ticker: 'SolAngeles',
    sector: 'Social / Attention Markets',
    market_cap_range: 'Live market, verify current range from DexScreener',
    thesis: 'SolAngeles has one of the strongest product/activity surfaces in the batch: cartoon universe, characters, episodes, website, rewards/airdrop tracker, and community takeover dynamics. It enters Watchlist because the content moat is real, but adult/NSFW brand risk and execution consistency need monitoring.',
    displayVerdict: 'Real Content Moat, Distribution Still Monitored',
    what_it_actually_does: 'SolAngeles is a cartoon/content attention-market project with characters, episodes, a website, rewards/airdrop tracking, and community takeover coordination.',
    proof_of_shipping: 'Verified live market, community takeover receipt, cartoon/content product surface, episode/content activity, rewards/airdrop tracker, and liquidity-depth receipt.',
    attention_quality_note: 'The content moat is stronger than a pure ticker meme, but distribution quality still depends on consistent episode output and community execution.',
    token_survivability_note: 'Submitted receipts show a live market and liquidity-depth review, but token survival still depends on whether content activity and rewards loops produce durable participation.',
    risk_flags: [
      'Adult/NSFW content creates platform and brand risk',
      'Community takeover execution risk',
      'Smaller scale than established meme peers',
      'Growth depends on consistent episode/content output'
    ],
    tags: [
      'WATCHLIST',
      'CONTENT_MOAT',
      'COMMUNITY_TAKEOVER',
      'REWARDS_ECONOMY',
      'NSFW_BRAND_RISK',
      'LIQUIDITY_DEPTH_REVIEWED'
    ],
    why_now: 'Watchlist. The content moat is real enough to track, but NSFW brand risk, community takeover execution, and output cadence keep conviction capped.',
    receipts: [
      survivabilityReceipt('urr_solangeles_receipt_001', 'Live market receipt', 'market', 'Verified live Solana market and DexScreener pair recorded for enrichment.', 'https://dexscreener.com/solana/ak7hdcxdsocd2zgjbca1zwlcudqz5f6n747a7rqtpxe3'),
      survivabilityReceipt('urr_solangeles_receipt_002', 'Community takeover receipt', 'attention', 'Submitted receipts frame SolAngeles as a community takeover with active coordination risk and upside.'),
      survivabilityReceipt('urr_solangeles_receipt_003', 'Cartoon content surface receipt', 'shipping', 'Cartoon universe, characters, episodes, and website surface are treated as real content/product evidence.'),
      survivabilityReceipt('urr_solangeles_receipt_004', 'Rewards tracker receipt', 'token', 'Rewards/airdrop tracker supports an active rewards-economy surface, but retention still needs monitoring.'),
      survivabilityReceipt('urr_solangeles_receipt_005', 'Liquidity depth receipt', 'market', 'Submitted liquidity-depth receipt supports Watchlist inclusion while execution consistency remains open.')
    ],
    linked_narratives: [
      { label: 'Attention Market Watch', href: '/narratives/attention-market-watch' },
      { label: 'Signal Hunt', href: '/signal-hunt' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    chainId: 'solana',
    tokenAddress: '8wxkvAfEns76yBzu4MnbV7VnXWjg3iDPA9uwAQ6cpump',
    verificationStatus: 'verified_live_market',
    tokenAddressSource: 'CT survivability intake submitted token address and live DexScreener pair; Infopunks keeps source framing and NSFW brand risk visible.',
    dexScreenerUrl: 'https://dexscreener.com/solana/ak7hdcxdsocd2zgjbca1zwlcudqz5f6n747a7rqtpxe3',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Live Solana market recorded from submitted survivability receipts.',
      'Content moat is tracked separately from token conviction.',
      'Adult/NSFW brand risk remains part of the public record.'
    ],
    productionReady: true,
    hunter_credit: communityHunter('CT survivability intake', 'CT survivability intake submitted SolAngeles receipts. Infopunks added a Watchlist record with content moat and NSFW brand risk both visible.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'watchlist',
    verdict: 'real_product_weak_attention',
    scores: {
      shipping_proof: 62,
      attention_quality: 61,
      token_survivability: 55,
      category_timing: 66,
      asymmetry_potential: 59,
      overall_signal_score: 60,
      risk_score: 70
    },
    updated_at: UPDATED_AT,
    sample_disclosure: LIVE_DISCLOSURE
  },
  {
    id: 'ur_useless_consensus',
    project: 'USELESS',
    ticker: 'USELESS',
    sector: 'Social / Attention Markets',
    market_cap_range: 'Live market, verify current range from DexScreener',
    thesis: 'USELESS is a mature satirical Solana meme with established liquidity, long holder history, and sustained community activity. It is not an early lowcap candidate anymore, but it belongs as a consensus-forming survivability benchmark.',
    displayVerdict: 'Battle-Tested Meme Benchmark',
    what_it_actually_does: 'USELESS is a satirical Solana meme and attention-market benchmark rather than a product-utility candidate.',
    proof_of_shipping: 'Verified live market, mature age receipt, deep liquidity/high-volume receipt, fully circulating supply receipt, and established community presence.',
    attention_quality_note: 'Sustained community activity and mature market history make USELESS useful as a survivability benchmark, not a fresh undiscovered signal.',
    token_survivability_note: 'Long holder history, deep liquidity, and mature age improve survivability confidence, while higher market cap creates lower lowcap upside than early candidates.',
    risk_flags: [
      'High market cap reduces asymmetric lowcap upside',
      'Pure meme with no product moat beyond narrative',
      'Satirical branding may cap mainstream crossover'
    ],
    tags: [
      'CONSENSUS_FORMING',
      'BATTLE_TESTED_MEME',
      'SURVIVABILITY_BENCHMARK',
      'DEEP_LIQUIDITY',
      'PURE_MEME_RISK'
    ],
    why_now: 'Consensus Forming. USELESS belongs as a battle-tested meme survivability benchmark, but lower lowcap upside keeps it out of High-Signal Lowcap.',
    receipts: [
      survivabilityReceipt('urr_useless_receipt_001', 'Live market receipt', 'market', 'Verified live Solana market and DexScreener pair recorded for enrichment.', 'https://dexscreener.com/solana/q2sphpduwfmg7m7wwrqklrn619caucfrsmhvjffodsp'),
      survivabilityReceipt('urr_useless_receipt_002', 'Mature age receipt', 'market', 'Submitted receipt frames USELESS as a mature meme with a longer holder and market history.'),
      survivabilityReceipt('urr_useless_receipt_003', 'Deep liquidity receipt', 'market', 'Submitted deep liquidity/high-volume receipt supports benchmark status rather than early lowcap status.'),
      survivabilityReceipt('urr_useless_receipt_004', 'Supply receipt', 'token', 'Submitted receipt cites fully circulating supply.'),
      survivabilityReceipt('urr_useless_receipt_005', 'Community presence receipt', 'attention', 'Established community presence supports survivability benchmark framing.')
    ],
    linked_narratives: [
      { label: 'Attention Market Watch', href: '/narratives/attention-market-watch' },
      { label: 'Signal Hunt', href: '/signal-hunt' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    chainId: 'solana',
    tokenAddress: 'Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk',
    verificationStatus: 'verified_live_market',
    tokenAddressSource: 'CT survivability intake submitted token address and live DexScreener pair; Infopunks keeps benchmark framing distinct from early lowcap promotion.',
    dexScreenerUrl: 'https://dexscreener.com/solana/q2sphpduwfmg7m7wwrqklrn619caucfrsmhvjffodsp',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Live Solana market recorded from submitted survivability receipts.',
      'Consensus-forming benchmark, not a fresh early lowcap call.',
      'Pure meme risk remains visible despite mature survivability receipts.'
    ],
    productionReady: true,
    hunter_credit: communityHunter('CT survivability intake', 'CT survivability intake submitted USELESS receipts. Infopunks added a consensus-forming benchmark record instead of early-lowcap promotion.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'consensus_forming',
    verdict: 'consensus_already_forming',
    scores: {
      shipping_proof: 12,
      attention_quality: 82,
      token_survivability: 82,
      category_timing: 48,
      asymmetry_potential: 34,
      overall_signal_score: 58,
      risk_score: 66
    },
    updated_at: UPDATED_AT,
    sample_disclosure: LIVE_DISCLOSURE
  },
  {
    id: 'ur_triplet_sahur',
    project: 'TripleT',
    ticker: 'TRIPLET',
    sector: 'Social / Attention Markets',
    market_cap_range: 'Live market, verify current range from DexScreener',
    thesis: 'TripleT has strong viral meme roots, fair launch structure, meaningful liquidity, and active trading. It enters Watchlist rather than High-Signal because the project is pure meme, newer than more battle-tested peers, and still dependent on sustained brainrot/TikTok cultural momentum.',
    displayVerdict: 'Viral Meme Candidate, Longevity Unproven',
    what_it_actually_does: 'TripleT is a viral meme attention-market asset with no current product utility claim attached to the Radar record.',
    proof_of_shipping: 'Verified live market, fair launch receipt, liquidity-depth receipt, viral cultural origin receipt, and active trading/community receipt.',
    attention_quality_note: 'Viral meme origin gives TripleT strong attention, but attention quality remains hype-cycle dependent until culture retention is proven beyond the current cycle.',
    token_survivability_note: 'Fair launch, liquidity depth, and active trading support Watchlist inclusion, but newer pure memes can lose survivability quickly when cultural momentum breaks.',
    risk_flags: [
      'Pure meme with no product utility',
      'Hype-cycle dependent',
      'Regional/niche meme concentration risk',
      'Less battle-tested than older meme peers'
    ],
    tags: [
      'WATCHLIST',
      'VIRAL_MEME',
      'FAIR_LAUNCH_RECEIPT',
      'LIQUIDITY_DEPTH_REVIEWED',
      'CULTURE_RETENTION_MONITORING',
      'PURE_MEME_RISK'
    ],
    why_now: 'Watchlist. TripleT has viral meme traction and token survivability receipts, but hype-cycle risk and limited battle-testing block High-Signal promotion.',
    receipts: [
      survivabilityReceipt('urr_triplet_receipt_001', 'Live market receipt', 'market', 'Verified live Solana market and DexScreener pair recorded for enrichment.', 'https://dexscreener.com/solana/3kfcgj5r3zshw8htdbzjsrrksrymkvsmfhc4vo4iddxd'),
      survivabilityReceipt('urr_triplet_receipt_002', 'Fair launch receipt', 'market', 'Submitted receipt cites fair launch structure.'),
      survivabilityReceipt('urr_triplet_receipt_003', 'Liquidity depth receipt', 'market', 'Submitted liquidity-depth receipt supports Watchlist inclusion.'),
      survivabilityReceipt('urr_triplet_receipt_004', 'Viral cultural origin receipt', 'attention', 'Submitted receipt ties TripleT to viral meme roots and brainrot/TikTok cultural momentum.'),
      survivabilityReceipt('urr_triplet_receipt_005', 'Active trading/community receipt', 'attention', 'Submitted active trading/community receipt is monitored for retention rather than treated as durable product evidence.')
    ],
    linked_narratives: [
      { label: 'Attention Market Watch', href: '/narratives/attention-market-watch' },
      { label: 'Signal Hunt', href: '/signal-hunt' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    chainId: 'solana',
    tokenAddress: 'J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump',
    verificationStatus: 'verified_live_market',
    tokenAddressSource: 'CT survivability intake submitted token address and live DexScreener pair; Infopunks keeps viral meme and hype-cycle risk visible.',
    dexScreenerUrl: 'https://dexscreener.com/solana/3kfcgj5r3zshw8htdbzjsrrksrymkvsmfhc4vo4iddxd',
    verifiedAt: UPDATED_AT,
    verificationNotes: [
      'Live Solana market recorded from submitted survivability receipts.',
      'Watchlist status reflects viral meme survivability receipts, not product proof.',
      'Hype-cycle and culture-retention risk remain monitored.'
    ],
    productionReady: true,
    hunter_credit: communityHunter('CT survivability intake', 'CT survivability intake submitted TripleT receipts. Infopunks added a Watchlist record with viral meme and hype-cycle risks explicit.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'watchlist',
    verdict: 'strong_attention_weak_proof',
    scores: {
      shipping_proof: 10,
      attention_quality: 74,
      token_survivability: 60,
      category_timing: 70,
      asymmetry_potential: 62,
      overall_signal_score: 57,
      risk_score: 84
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
