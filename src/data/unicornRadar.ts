import type { UnicornRadarCandidate, UnicornRadarRevenueReceipt } from '../schemas/entities';

const UPDATED_AT = '2026-07-06T08:30:00.000Z';
const SAMPLE_DISCLOSURE = 'Desk-seeded sample record for product demonstration. Treat as structure and methodology, not a live investment recommendation.';

function receipt(id: string, label: string, type: UnicornRadarCandidate['receipts'][number]['type'], note: string, source = 'desk review'): UnicornRadarCandidate['receipts'][number] {
  return {
    id,
    label,
    type,
    source,
    note,
    observed_at: UPDATED_AT
  };
}

function hunter(handle: string, attribution: string): UnicornRadarCandidate['hunter_credit'] {
  return {
    handle,
    attribution,
    submitted_at: UPDATED_AT,
    source: 'desk_seeded_sample'
  };
}

function unpaidDisclosure(): UnicornRadarCandidate['paid_evaluation_disclosure'] {
  return {
    is_paid: false,
    label: 'Desk-seeded sample',
    note: 'No project payment recorded. Evaluation is sample desk research only.',
    paid_at: null,
    receipt_id: null
  };
}

export const unicornRadarCandidates: UnicornRadarCandidate[] = [
  {
    id: 'ur_agent_memory_mesh',
    project: 'Agent Memory Mesh',
    ticker: 'MEMESH',
    sector: 'AI',
    market_cap_range: '$5M-$15M',
    thesis: 'A low-cap AI memory project with real shipping traces can become important if Solana agent workflows need portable reputation and task memory.',
    what_it_actually_does: 'Builds wallet-bound memory objects for autonomous agents, including task receipts, source references, and reusable action context.',
    proof_of_shipping: 'Demo app, SDK examples, and receipt-like memory exports are visible in the sample dossier.',
    attention_quality_note: 'Attention is builder-heavy and low hype; discussion clusters around agent reliability rather than price.',
    token_survivability_note: 'Token utility is plausible only if memory writes become frequent and priced; otherwise the token remains optional.',
    risk_flags: ['sample_record', 'thin_liquidity', 'needs_live_sdk_usage', 'token_utility_unproven'],
    why_now: 'Agent rails are moving from chat demos toward stateful workflows that need memory and accountability.',
    receipts: [
      receipt('urr_memesh_shipping_001', 'SDK and demo shipped', 'shipping', 'Sample dossier records a working SDK path and demo surface.'),
      receipt('urr_memesh_attention_001', 'Builder-led attention', 'attention', 'Discussion quality is technical, not influencer-led.')
    ],
    linked_narratives: [
      { label: 'Machine markets', href: '/machine-market' },
      { label: 'Hermes memory loop', href: '/hermes/memory-loop' }
    ],
    linked_graph_node: { id: 'agentic_payments', label: 'Agentic Payments', href: '/graph' },
    hunter_credit: hunter('@infopunks_desk', 'Desk seeded this sample to show AI candidate evaluation shape.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'high_signal_lowcap',
    verdict: 'high_signal_early',
    scores: {
      shipping_proof: 82,
      attention_quality: 74,
      token_survivability: 67,
      category_timing: 88,
      asymmetry_potential: 84,
      overall_signal_score: 81,
      risk_score: 58
    },
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  },
  {
    id: 'ur_tbill_stream',
    project: 'T-Bill Stream',
    ticker: 'TBILL',
    sector: 'RWA',
    market_cap_range: '$10M-$25M',
    thesis: 'Tokenized cashflow primitives can win if receipts prove the asset backing and Solana distribution remains credible.',
    what_it_actually_does: 'Packages short-duration yield exposure into tokenized vault shares with public attestations and transfer controls.',
    proof_of_shipping: 'Sample vault UI, attestation page, and redemption flow are documented, but third-party verification is incomplete.',
    attention_quality_note: 'Attention is calm and institutionally framed; retail has not fully discovered the category on Solana.',
    token_survivability_note: 'Survivability depends on disclosure quality, reserve proof, and whether the token avoids becoming a passive wrapper with no network effects.',
    risk_flags: ['sample_record', 'regulatory_surface', 'custody_dependency', 'attestation_gap'],
    why_now: 'RWA appetite is rotating from generic tokenization claims toward cashflow, proof, and redemption UX.',
    receipts: [
      receipt('urr_tbill_shipping_001', 'Vault flow exists', 'shipping', 'Sample review found a structured vault and redemption path.'),
      receipt('urr_tbill_risk_001', 'Attestation gap remains', 'risk', 'Backing proof needs stronger third-party validation.')
    ],
    linked_narratives: [
      { label: 'Proof Feed', href: '/check' },
      { label: 'Signal Graph', href: '/graph' }
    ],
    linked_graph_node: { id: 'carbon_finance_2_0', label: 'Asset-backed finance proof cluster', href: '/graph' },
    hunter_credit: hunter('@rwa_watch', 'Desk-seeded RWA placeholder used to test receipt-heavy scoring.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'watchlist',
    verdict: 'interesting_needs_receipts',
    scores: {
      shipping_proof: 68,
      attention_quality: 62,
      token_survivability: 60,
      category_timing: 81,
      asymmetry_potential: 72,
      overall_signal_score: 69,
      risk_score: 71
    },
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  },
  {
    id: 'ur_liquidity_sentinel',
    project: 'Liquidity Sentinel',
    ticker: 'SENT',
    sector: 'DeFi',
    market_cap_range: '$3M-$8M',
    thesis: 'Risk-aware DeFi automation can matter if it ships useful monitoring before becoming another yield box.',
    what_it_actually_does: 'Monitors Solana pool conditions, concentration, stale oracle exposure, and routing fragility before LPs deploy capital.',
    proof_of_shipping: 'A public dashboard, alert bot, and pool-risk examples are present in the sample evidence set.',
    attention_quality_note: 'Attention is niche but high quality; operators and LPs understand the pain quickly.',
    token_survivability_note: 'Token value capture is not obvious unless alerts, routing, or insurance hooks become paid surfaces.',
    risk_flags: ['sample_record', 'revenue_capture_unclear', 'oracle_dependency', 'operator_niche'],
    why_now: 'Solana DeFi needs better risk tooling as liquidity gets fragmented across faster pools and experimental assets.',
    receipts: [
      receipt('urr_sent_dashboard_001', 'Risk dashboard shipped', 'shipping', 'Sample dashboard includes pool-risk flags and explainers.'),
      receipt('urr_sent_token_001', 'Token capture unresolved', 'token', 'Utility path still needs proof beyond governance.')
    ],
    linked_narratives: [
      { label: 'Pre-Spend Terminal', href: '/spend-terminal' },
      { label: 'Radar risk matrix', href: '/machine-route-risk-matrix' }
    ],
    linked_graph_node: { id: 'pre_spend_intelligence', label: 'Pre-Spend Intelligence', href: '/graph' },
    hunter_credit: hunter('@defi_receipts', 'Desk seeded this DeFi monitoring candidate to test risk-flag display.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'high_signal_lowcap',
    verdict: 'real_product_weak_attention',
    scores: {
      shipping_proof: 86,
      attention_quality: 55,
      token_survivability: 51,
      category_timing: 78,
      asymmetry_potential: 76,
      overall_signal_score: 73,
      risk_score: 64
    },
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  },
  {
    id: 'ur_sensor_union',
    project: 'Sensor Union',
    ticker: 'SENS',
    sector: 'DePIN',
    market_cap_range: '$15M-$35M',
    thesis: 'A DePIN candidate with field receipts and low retail awareness can re-rate if hardware deployment evidence becomes impossible to ignore.',
    what_it_actually_does: 'Coordinates sensor contributors that publish environmental data streams into Solana-indexed reward accounts.',
    proof_of_shipping: 'Sample maps, device onboarding flow, and contributor receipts exist, but device counts are not independently confirmed.',
    attention_quality_note: 'Attention is quiet and operator-led, with limited broad CT recognition.',
    token_survivability_note: 'Survivability improves if rewards are tied to useful data buyers rather than emissions-only growth.',
    risk_flags: ['sample_record', 'hardware_count_unverified', 'demand_side_unproven', 'emissions_dependency'],
    why_now: 'DePIN markets are separating projects with field activity from projects with only maps and emissions.',
    receipts: [
      receipt('urr_sens_map_001', 'Device map visible', 'shipping', 'Sample map suggests field activity but needs independent verification.'),
      receipt('urr_sens_demand_001', 'Demand side not proven', 'risk', 'Data buyer receipts are still thin.')
    ],
    linked_narratives: [
      { label: 'Machine economy snapshot', href: '/machine-economy-snapshot' },
      { label: 'Signal Hunt', href: '/signal-hunt' }
    ],
    linked_graph_node: { id: 'machine_markets', label: 'Machine Markets', href: '/graph' },
    hunter_credit: hunter('@depin_mapper', 'Desk seeded DePIN candidate with field-receipt emphasis.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'watchlist',
    verdict: 'interesting_needs_receipts',
    scores: {
      shipping_proof: 70,
      attention_quality: 57,
      token_survivability: 63,
      category_timing: 76,
      asymmetry_potential: 79,
      overall_signal_score: 70,
      risk_score: 68
    },
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  },
  {
    id: 'ur_pocket_arcade',
    project: 'Pocket Arcade',
    ticker: 'PLAY',
    sector: 'Consumer',
    market_cap_range: '$2M-$6M',
    thesis: 'A consumer Solana app can break out if usage is real, lightweight, and social before token chatter dominates.',
    what_it_actually_does: 'Lets users play short mobile games where achievements, wagers, and collectibles settle through Solana accounts.',
    proof_of_shipping: 'Playable mobile build and seasonal quest receipts are visible in the sample record.',
    attention_quality_note: 'Attention is strong in small communities but vulnerable to mercenary farming.',
    token_survivability_note: 'Token survives only if gameplay retention beats reward extraction.',
    risk_flags: ['sample_record', 'farmable_rewards', 'retention_unknown', 'consumer_churn'],
    why_now: 'Consumer crypto is shifting toward apps that hide chain complexity and create repeatable use loops.',
    receipts: [
      receipt('urr_play_game_001', 'Playable client', 'shipping', 'Sample review records a working game loop.'),
      receipt('urr_play_attention_001', 'Quest attention is mixed', 'attention', 'Community activity may include reward farmers.')
    ],
    linked_narratives: [
      { label: 'Signal Hunt', href: '/signal-hunt' },
      { label: 'Attention Markets', href: '/narratives/attention-markets' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    hunter_credit: hunter('@consumer_coinwatch', 'Desk seeded consumer-app candidate for retention-risk scoring.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'do_not_touch_yet',
    verdict: 'do_not_touch_yet',
    scores: {
      shipping_proof: 72,
      attention_quality: 48,
      token_survivability: 39,
      category_timing: 67,
      asymmetry_potential: 70,
      overall_signal_score: 59,
      risk_score: 82
    },
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  },
  {
    id: 'ur_agent_escrow_rails',
    project: 'Agent Escrow Rails',
    ticker: 'RAILS',
    sector: 'Agent Rails',
    market_cap_range: '$8M-$18M',
    thesis: 'Escrow and policy rails for autonomous agent payments are early enough to be asymmetric if execution receipts become standard.',
    what_it_actually_does: 'Provides scoped escrow, spend limits, and agent action receipts for Solana-native service calls.',
    proof_of_shipping: 'Sample CLI, escrow contract, and receipt conversion examples exist.',
    attention_quality_note: 'Attention quality is high because agent-wallet builders immediately understand the failure mode.',
    token_survivability_note: 'Token survivability improves if fees, staking, or dispute bonds are tied to real escrow volume.',
    risk_flags: ['sample_record', 'security_review_needed', 'agent_market_still_early', 'fee_capture_unproven'],
    why_now: 'Agents are moving from demos to spend flows, and spend flows need boundaries before they scale.',
    receipts: [
      receipt('urr_rails_contract_001', 'Escrow contract sample', 'shipping', 'Sample review records a scoped escrow implementation.'),
      receipt('urr_rails_hermes_001', 'Policy alignment', 'market', 'Maps cleanly to Hermes spend policy and pre-spend decision concepts.')
    ],
    linked_narratives: [
      { label: 'Hermes spend policy', href: '/hermes/spend-policy' },
      { label: 'Pre-Spend Decision Engine', href: '/hermes/pre-spend-decision' }
    ],
    linked_graph_node: { id: 'agentic_payments', label: 'Agentic Payments', href: '/graph' },
    hunter_credit: hunter('@agentrails', 'Desk seeded agent-rails candidate for commercial wedge testing.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
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
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  },
  {
    id: 'ur_checkout_mesh',
    project: 'Checkout Mesh',
    ticker: 'MESH',
    sector: 'Payment Infrastructure',
    market_cap_range: '$20M-$50M',
    thesis: 'Payment infrastructure gets consensus quickly once integrations become visible, so the edge is in catching receipts before the market notices.',
    what_it_actually_does: 'Routes stablecoin checkout, refunds, and merchant settlement across Solana wallets and API-first storefronts.',
    proof_of_shipping: 'Sample docs, merchant sandbox, and webhook receipt examples are visible.',
    attention_quality_note: 'Attention is beginning to broaden from builders to payment narrative accounts.',
    token_survivability_note: 'Token value capture is plausible only if settlement, routing, or merchant incentives require the token.',
    risk_flags: ['sample_record', 'crowded_category', 'merchant_adoption_unverified', 'consensus_risk'],
    why_now: 'Stablecoin payments are moving from thesis to integrations, and infrastructure narratives can harden fast.',
    receipts: [
      receipt('urr_mesh_docs_001', 'Merchant sandbox', 'shipping', 'Sample sandbox and webhook examples are visible.'),
      receipt('urr_mesh_attention_001', 'Consensus starting', 'attention', 'Payment narrative accounts are starting to notice the category.')
    ],
    linked_narratives: [
      { label: 'Pre-Spend Terminal', href: '/spend-terminal' },
      { label: 'Routes', href: '/routes' }
    ],
    linked_graph_node: { id: 'agentic_payments', label: 'Agentic Payments', href: '/graph' },
    hunter_credit: hunter('@paymentscout', 'Desk seeded payment infrastructure candidate to test consensus-forming state.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'consensus_forming',
    verdict: 'consensus_already_forming',
    scores: {
      shipping_proof: 77,
      attention_quality: 80,
      token_survivability: 61,
      category_timing: 86,
      asymmetry_potential: 58,
      overall_signal_score: 73,
      risk_score: 57
    },
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  },
  {
    id: 'ur_attention_clearinghouse',
    project: 'Attention Clearinghouse',
    ticker: 'ATTN',
    sector: 'Social / Attention Markets',
    market_cap_range: '$1M-$4M',
    thesis: 'A social attention market can go viral before it deserves trust; Infopunks should separate coordination signal from extraction risk early.',
    what_it_actually_does: 'Creates paid attention bounties where communities fund specific posts, replies, and creator campaigns.',
    proof_of_shipping: 'Campaign creation and leaderboard surfaces exist in the sample record, but settlement receipts are thin.',
    attention_quality_note: 'Attention is loud, reflexive, and influencer-adjacent; signal quality is mixed.',
    token_survivability_note: 'Token is fragile if attention farming dominates advertiser demand.',
    risk_flags: ['sample_record', 'high_reflexivity', 'influencer_dependency', 'settlement_receipts_thin'],
    why_now: 'Attention markets are becoming explicit, but the difference between coordination and extraction is still mispriced.',
    receipts: [
      receipt('urr_attn_campaign_001', 'Campaign surface', 'shipping', 'Sample campaign flow is visible.'),
      receipt('urr_attn_risk_001', 'Influencer dependency', 'risk', 'Attention quality depends on a small amplifier cluster.')
    ],
    linked_narratives: [
      { label: 'Attention Markets Thesis', href: '/narratives/attention-markets' },
      { label: 'Attention Market Watch', href: '/narratives/attention-market-watch' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    hunter_credit: hunter('@attentiondesk', 'Desk seeded attention-market candidate connected to existing narrative concepts.'),
    paid_evaluation_disclosure: {
      is_paid: true,
      label: 'Paid evaluation disclosed',
      note: 'Sample paid evaluation record. Projects can buy evaluation, not conviction.',
      paid_at: UPDATED_AT,
      receipt_id: 'urr_revenue_attn_001'
    },
    status: 'paid_evaluation',
    verdict: 'strong_attention_weak_proof',
    scores: {
      shipping_proof: 54,
      attention_quality: 83,
      token_survivability: 42,
      category_timing: 84,
      asymmetry_potential: 71,
      overall_signal_score: 67,
      risk_score: 86
    },
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  },
  {
    id: 'ur_app_equity_terminal',
    project: 'App Equity Terminal',
    ticker: 'APPEQ',
    sector: 'Tokenized Apps',
    market_cap_range: '$30M-$75M',
    thesis: 'Infopunks missed the clean early window on this tokenized-app primitive; it now belongs in the record as a learning artifact.',
    what_it_actually_does: 'Lets app teams issue revenue-linked participation tokens with public KPI dashboards and holder update receipts.',
    proof_of_shipping: 'Dashboard, issuer docs, and sample KPI updates are already visible.',
    attention_quality_note: 'Attention is improving and more consensus-coded than early-discovery-coded.',
    token_survivability_note: 'Survivability depends on issuer quality, disclosure discipline, and whether holders receive credible app-level value.',
    risk_flags: ['sample_record', 'late_to_consensus', 'issuer_quality_variance', 'disclosure_risk'],
    why_now: 'Tokenized apps are moving from abstract thesis to concrete issuer experiments.',
    receipts: [
      receipt('urr_appeq_docs_001', 'Issuer docs shipped', 'shipping', 'Sample issuer documentation and KPI update shape are visible.'),
      receipt('urr_appeq_missed_001', 'Missed early window', 'market', 'Desk labels this as a missed early signal rather than forcing a chase verdict.')
    ],
    linked_narratives: [
      { label: 'Narrative Asset Intelligence', href: '/narratives' },
      { label: 'Signal Graph', href: '/graph' }
    ],
    linked_graph_node: { id: 'ct_subcultures', label: 'CT Subcultures', href: '/graph' },
    hunter_credit: hunter('@infopunks_desk', 'Desk seeded missed-it candidate to make failure memory explicit.'),
    paid_evaluation_disclosure: unpaidDisclosure(),
    status: 'infopunks_missed_it',
    verdict: 'missed_by_infopunks',
    scores: {
      shipping_proof: 84,
      attention_quality: 79,
      token_survivability: 73,
      category_timing: 63,
      asymmetry_potential: 44,
      overall_signal_score: 69,
      risk_score: 52
    },
    updated_at: UPDATED_AT,
    sample_disclosure: SAMPLE_DISCLOSURE
  }
];

export const unicornRadarRevenueReceipts: UnicornRadarRevenueReceipt[] = [
  {
    id: 'urr_revenue_attn_001',
    candidate_id: 'ur_attention_clearinghouse',
    project: 'Attention Clearinghouse',
    amount_usd: 750,
    service: 'paid_evaluation',
    disclosure: 'Sample paid evaluation receipt. Payment bought review time, not conviction or positive verdict.',
    status: 'paid',
    paid_at: UPDATED_AT
  },
  {
    id: 'urr_revenue_public_001',
    candidate_id: null,
    project: 'Public desk seed',
    amount_usd: 0,
    service: 'sponsored_receipt_review',
    disclosure: 'Comped sample receipt showing how unpaid desk-seeded research is disclosed.',
    status: 'comped',
    paid_at: UPDATED_AT
  }
];

export function listUnicornRadarCandidates(): UnicornRadarCandidate[] {
  return unicornRadarCandidates;
}

export function getUnicornRadarCandidate(candidateId: string): UnicornRadarCandidate | undefined {
  return unicornRadarCandidates.find((candidate) => candidate.id === candidateId);
}

export function listUnicornRadarRevenueReceipts(): UnicornRadarRevenueReceipt[] {
  return unicornRadarRevenueReceipts;
}
