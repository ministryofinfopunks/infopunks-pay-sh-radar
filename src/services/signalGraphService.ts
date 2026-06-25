import { createHash } from 'node:crypto';
import {
  SignalEdgeType,
  SignalGraphCheckInput,
  SignalGraphCheckInputSchema,
  SignalGraphCheckResponse,
  SignalGraphCheckResponseSchema,
  SignalGraphCluster,
  SignalGraphClusterDetail,
  SignalGraphClusterDetailSchema,
  SignalGraphClusterSchema,
  SignalGraphEdge,
  SignalGraphEdgeSchema,
  SignalGraphEntityLookupResponse,
  SignalGraphEntityLookupResponseSchema,
  SignalGraphEntityType,
  SignalGraphEntityTypeSchema,
  SignalGraphNode,
  SignalGraphNodeDetail,
  SignalGraphNodeDetailSchema,
  SignalGraphNodeSchema,
  SignalGraphProofState,
  SignalGraphResponse,
  SignalGraphResponseSchema,
  SignalGraphRipple,
  SignalGraphRippleSchema,
  SignalGraphStats,
  SignalGraphStatsSchema,
  SignalNodeType
} from '../schemas/entities';

const TAGLINE = 'Stop scrolling the feed. Read the graph.';
const NOW = '2026-06-25T09:00:00.000Z';
const DAY_AGO = '2026-06-24T11:30:00.000Z';
const HALF_DAY_AGO = '2026-06-24T20:45:00.000Z';

const seededNodes = SignalGraphNodeSchema.array().parse([
  {
    id: 'project_pay_sh',
    type: 'project',
    label: 'Pay.sh',
    summary: 'Settlement rail and provider surface that turns routes into machine-readable spend options.',
    cluster_id: 'agentic_payments',
    proof_state: 'validated',
    confidence_score: 93,
    velocity_score: 82,
    source_urls: ['https://pay.sh'],
    linked_receipt_ids: ['receipt_005', 'receipt_010'],
    linked_claim_ids: ['claim_001'],
    linked_loop_ids: ['loop_pre_spend_route'],
    created_at: '2026-06-12T09:00:00.000Z',
    updated_at: NOW
  },
  {
    id: 'project_agentic_market',
    type: 'project',
    label: 'agentic.market',
    summary: 'Market surface where autonomous buyers and sellers converge, but proof discipline still varies by route.',
    cluster_id: 'agentic_payments',
    proof_state: 'compounding',
    confidence_score: 78,
    velocity_score: 86,
    source_urls: ['https://agentic.market'],
    linked_claim_ids: ['claim_001'],
    created_at: '2026-06-14T08:20:00.000Z',
    updated_at: HALF_DAY_AGO
  },
  {
    id: 'project_x402',
    type: 'project',
    label: 'x402',
    summary: 'Payment handshake narrative around agent-native API commerce and route metering.',
    cluster_id: 'agentic_payments',
    proof_state: 'compounding',
    confidence_score: 71,
    velocity_score: 88,
    source_urls: ['https://x402.org'],
    created_at: '2026-06-15T10:10:00.000Z',
    updated_at: HALF_DAY_AGO
  },
  {
    id: 'project_solana_payments',
    type: 'project',
    label: 'Solana payments',
    summary: 'Fast stablecoin settlement lane for route-level machine spend and receipt capture.',
    cluster_id: 'agentic_payments',
    proof_state: 'validated',
    confidence_score: 89,
    velocity_score: 76,
    linked_receipt_ids: ['receipt_005'],
    created_at: '2026-06-10T07:10:00.000Z',
    updated_at: NOW
  },
  {
    id: 'project_base_payments',
    type: 'project',
    label: 'Base payments',
    summary: 'Growing route narrative for agent payments, with more narrative than receipt density in this seed window.',
    cluster_id: 'agentic_payments',
    proof_state: 'unproven',
    confidence_score: 56,
    velocity_score: 74,
    created_at: '2026-06-11T11:00:00.000Z',
    updated_at: DAY_AGO
  },
  {
    id: 'agent_agent_wallets',
    type: 'agent',
    label: 'Agent wallets',
    summary: 'Wallet-bearing machine actors that need route memory, receipt memory, and spend boundaries.',
    cluster_id: 'agentic_payments',
    proof_state: 'validated',
    confidence_score: 86,
    velocity_score: 79,
    linked_receipt_ids: ['receipt_005', 'receipt_010'],
    linked_loop_ids: ['loop_pre_spend_route'],
    created_at: '2026-06-13T09:30:00.000Z',
    updated_at: NOW
  },
  {
    id: 'claim_m2m_payments',
    type: 'claim',
    label: 'Machine-to-machine payments',
    summary: 'Claim that autonomous services will settle with each other directly once route proof becomes dense enough.',
    cluster_id: 'machine_markets',
    proof_state: 'compounding',
    confidence_score: 74,
    velocity_score: 91,
    linked_claim_ids: ['claim_001'],
    linked_loop_ids: ['loop_machine_service_route'],
    created_at: '2026-06-16T10:00:00.000Z',
    updated_at: HALF_DAY_AGO
  },
  {
    id: 'project_depin',
    type: 'project',
    label: 'DePIN',
    summary: 'Distributed physical infrastructure narrative that turns hardware and compute into machine markets.',
    cluster_id: 'machine_markets',
    proof_state: 'compounding',
    confidence_score: 76,
    velocity_score: 84,
    linked_loop_ids: ['loop_machine_service_route'],
    created_at: '2026-06-12T06:40:00.000Z',
    updated_at: HALF_DAY_AGO
  },
  {
    id: 'project_machine_markets',
    type: 'project',
    label: 'Machine markets',
    summary: 'Service catalogs where machines buy translation, navigation, storage, and compute from other machines.',
    cluster_id: 'machine_markets',
    proof_state: 'validated',
    confidence_score: 82,
    velocity_score: 80,
    linked_claim_ids: ['claim_001'],
    linked_loop_ids: ['loop_machine_service_route'],
    created_at: '2026-06-15T07:45:00.000Z',
    updated_at: NOW
  },
  {
    id: 'route_cloud_translation',
    type: 'route',
    label: 'Cloud Translation first-safe route',
    summary: 'A bounded translation route used as a machine-economy proof plan example.',
    cluster_id: 'machine_markets',
    proof_state: 'validated',
    confidence_score: 84,
    velocity_score: 68,
    linked_receipt_ids: ['receipt_005'],
    linked_loop_ids: ['loop_machine_service_route'],
    created_at: '2026-06-18T08:15:00.000Z',
    updated_at: NOW
  },
  {
    id: 'route_naver_geocode',
    type: 'route',
    label: 'NAVER geocode proof path',
    summary: 'Navigation-adjacent route that remains bounded to lookup and review rather than operational routing.',
    cluster_id: 'machine_markets',
    proof_state: 'validated',
    confidence_score: 79,
    velocity_score: 63,
    linked_loop_ids: ['loop_machine_service_route'],
    created_at: '2026-06-18T09:10:00.000Z',
    updated_at: DAY_AGO
  },
  {
    id: 'post_depin_thread',
    type: 'post',
    label: 'DePIN thread about machine buyers',
    summary: 'Feed-native narrative cluster amplifying machine spend as a coming default.',
    cluster_id: 'machine_markets',
    proof_state: 'unproven',
    confidence_score: 48,
    velocity_score: 87,
    source_urls: ['https://example.com/depin-thread'],
    created_at: '2026-06-24T01:15:00.000Z',
    updated_at: HALF_DAY_AGO
  },
  {
    id: 'project_pre_spend_intelligence',
    type: 'project',
    label: 'Pre-Spend Intelligence',
    summary: 'The route-selection memory layer that asks whether an agent should spend before it spends.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 95,
    velocity_score: 77,
    linked_receipt_ids: ['receipt_001', 'receipt_005'],
    linked_claim_ids: ['claim_001'],
    linked_loop_ids: ['loop_pre_spend_route', 'loop_provider_trust'],
    created_at: '2026-06-10T08:00:00.000Z',
    updated_at: NOW
  },
  {
    id: 'claim_route_memory',
    type: 'claim',
    label: 'Route memory',
    summary: 'Claim that route-level receipts should become reusable memory for future machine spend.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 90,
    velocity_score: 72,
    linked_claim_ids: ['claim_001'],
    linked_receipt_ids: ['receipt_001', 'receipt_005'],
    linked_loop_ids: ['loop_pre_spend_route'],
    created_at: '2026-06-13T07:50:00.000Z',
    updated_at: NOW
  },
  {
    id: 'claim_provider_reputation',
    type: 'claim',
    label: 'Provider reputation',
    summary: 'Reputation should be downstream of receipts, challenges, and validation rather than narrative volume.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 88,
    velocity_score: 67,
    linked_claim_ids: ['claim_001'],
    linked_loop_ids: ['loop_provider_trust'],
    created_at: '2026-06-13T08:10:00.000Z',
    updated_at: NOW
  },
  {
    id: 'receipt_route_001',
    type: 'receipt',
    label: 'receipt_001',
    summary: 'Seeded market research receipt backing route memory and spend discipline.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 86,
    velocity_score: 58,
    linked_receipt_ids: ['receipt_001'],
    linked_claim_ids: ['claim_001'],
    linked_loop_ids: ['loop_pre_spend_route'],
    created_at: '2026-06-14T09:40:00.000Z',
    updated_at: NOW
  },
  {
    id: 'receipt_quote_005',
    type: 'receipt',
    label: 'receipt_005',
    summary: 'Token quote receipt showing a low-cost repeatable route in the current seed window.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 92,
    velocity_score: 60,
    linked_receipt_ids: ['receipt_005'],
    linked_loop_ids: ['loop_pre_spend_route'],
    created_at: '2026-06-16T03:58:00.000Z',
    updated_at: NOW
  },
  {
    id: 'proof_check_feed',
    type: 'proof_check',
    label: 'Proof Feed',
    summary: 'Public proof-check layer where claims get inspected before market narratives harden.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 87,
    velocity_score: 71,
    linked_claim_ids: ['claim_001'],
    created_at: '2026-06-18T16:45:00.000Z',
    updated_at: NOW
  },
  {
    id: 'project_receipt_graph',
    type: 'project',
    label: 'Receipt graph',
    summary: 'The receipt-linked memory layer that turns economic traces into graph-readable evidence.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 91,
    velocity_score: 69,
    linked_receipt_ids: ['receipt_001', 'receipt_005'],
    linked_claim_ids: ['claim_001'],
    linked_loop_ids: ['loop_pre_spend_route'],
    created_at: '2026-06-18T09:00:00.000Z',
    updated_at: NOW
  },
  {
    id: 'loop_lab',
    type: 'loop_run',
    label: 'LoopLab',
    summary: 'Loop memory surface that turns successful or failed autonomous work into reusable public memory.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 85,
    velocity_score: 73,
    linked_loop_ids: ['loop_pre_spend_route', 'loop_provider_trust', 'loop_failure_memory'],
    created_at: '2026-06-19T16:10:00.000Z',
    updated_at: NOW
  },
  {
    id: 'claim_no_receipt_no_trust',
    type: 'claim',
    label: 'No receipt, no trust',
    summary: 'Core Infopunks doctrine: no agent should inherit confidence from a feed without inspectable receipts.',
    cluster_id: 'pre_spend_intelligence',
    proof_state: 'validated',
    confidence_score: 97,
    velocity_score: 83,
    linked_claim_ids: ['claim_001'],
    linked_receipt_ids: ['receipt_001', 'receipt_005'],
    linked_loop_ids: ['loop_failure_memory'],
    created_at: '2026-06-11T09:00:00.000Z',
    updated_at: NOW
  },
  {
    id: 'claim_carbon_credits_sensitive',
    type: 'claim',
    label: 'Carbon credits are claims-sensitive instruments',
    summary: 'Carbon markets compress legal, narrative, and methodological claims into tradeable artifacts.',
    cluster_id: 'carbon_finance_2_0',
    proof_state: 'disputed',
    confidence_score: 69,
    velocity_score: 78,
    linked_loop_ids: ['loop_carbon_claim_integrity'],
    created_at: '2026-06-16T07:30:00.000Z',
    updated_at: DAY_AGO
  },
  {
    id: 'project_carbon_finance',
    type: 'project',
    label: 'Carbon finance 2.0',
    summary: 'A narrative layer trying to turn carbon accounting, verification, and claims into programmable flows.',
    cluster_id: 'carbon_finance_2_0',
    proof_state: 'compounding',
    confidence_score: 63,
    velocity_score: 75,
    created_at: '2026-06-17T08:00:00.000Z',
    updated_at: DAY_AGO
  },
  {
    id: 'token_carbon_credit',
    type: 'token',
    label: 'Tokenized carbon credit',
    summary: 'A tokenized claim on environmental integrity whose value depends on proof quality and challenge handling.',
    cluster_id: 'carbon_finance_2_0',
    proof_state: 'unproven',
    confidence_score: 51,
    velocity_score: 70,
    created_at: '2026-06-17T09:00:00.000Z',
    updated_at: DAY_AGO
  },
  {
    id: 'meme_green_alpha',
    type: 'meme',
    label: 'Green alpha',
    summary: 'A meme that markets carbon narratives as investable inevitability before receipt density catches up.',
    cluster_id: 'carbon_finance_2_0',
    proof_state: 'corrupted',
    confidence_score: 33,
    velocity_score: 81,
    created_at: '2026-06-18T10:15:00.000Z',
    updated_at: HALF_DAY_AGO
  },
  {
    id: 'post_integrity_receipts',
    type: 'post',
    label: 'Integrity receipts thread',
    summary: 'Counter-narrative thread arguing that carbon claims need receipt discipline similar to machine markets.',
    cluster_id: 'carbon_finance_2_0',
    proof_state: 'validated',
    confidence_score: 72,
    velocity_score: 64,
    source_urls: ['https://example.com/integrity-receipts'],
    linked_loop_ids: ['loop_carbon_claim_integrity'],
    created_at: '2026-06-24T05:00:00.000Z',
    updated_at: HALF_DAY_AGO
  },
  {
    id: 'meme_stop_scrolling',
    type: 'meme',
    label: 'Stop scrolling the feed. Read the graph.',
    summary: 'The Signal Graph slogan reframing feeds as input noise and graphs as inspectable memory.',
    cluster_id: 'ct_subcultures',
    proof_state: 'compounding',
    confidence_score: 85,
    velocity_score: 94,
    created_at: '2026-06-20T08:40:00.000Z',
    updated_at: NOW
  },
  {
    id: 'post_ct_thread',
    type: 'post',
    label: 'CT subculture thread',
    summary: 'A feed-native cluster where memes, claims, and screenshots spread faster than proof.',
    cluster_id: 'ct_subcultures',
    proof_state: 'unproven',
    confidence_score: 44,
    velocity_score: 90,
    source_urls: ['https://example.com/ct-thread'],
    created_at: '2026-06-24T02:30:00.000Z',
    updated_at: HALF_DAY_AGO
  },
  {
    id: 'meme_claim_markets',
    type: 'meme',
    label: 'Claim markets',
    summary: 'A subculture meme that every claim should have a price, a challenge path, and a proof trail.',
    cluster_id: 'ct_subcultures',
    proof_state: 'compounding',
    confidence_score: 67,
    velocity_score: 88,
    created_at: '2026-06-21T07:20:00.000Z',
    updated_at: NOW
  },
  {
    id: 'proof_check_disputed_claim',
    type: 'proof_check',
    label: 'Disputed proof check',
    summary: 'A public proof-check state used when screenshots, claims, and stale notes conflict.',
    cluster_id: 'ct_subcultures',
    proof_state: 'disputed',
    confidence_score: 73,
    velocity_score: 62,
    created_at: '2026-06-15T07:55:00.000Z',
    updated_at: DAY_AGO
  }
]);

const seededEdges = SignalGraphEdgeSchema.array().parse([
  edge('edge_pay_sh_solana', 'project_pay_sh', 'project_solana_payments', 'receipt', 91, 'Pay.sh is currently best evidenced on the Solana payment rail.'),
  edge('edge_pay_sh_agent_wallets', 'project_pay_sh', 'agent_agent_wallets', 'shared_wallet', 88, 'Agent wallets depend on Pay.sh-compatible rails for bounded spend.'),
  edge('edge_pay_sh_pre_spend', 'project_pay_sh', 'project_pre_spend_intelligence', 'proof_link', 90, 'Pre-Spend Intelligence evaluates whether Pay.sh routes are ready before spend.'),
  edge('edge_pay_sh_x402', 'project_pay_sh', 'project_x402', 'semantic_similarity', 72, 'Both map agent-native payment flows, but their proof surfaces differ.'),
  edge('edge_x402_agentic_market', 'project_x402', 'project_agentic_market', 'amplification', 79, 'x402-style payment narratives amplify agentic.market distribution narratives.'),
  edge('edge_base_x402', 'project_base_payments', 'project_x402', 'semantic_similarity', 58, 'Base payment discussions increasingly route through x402 framing.'),
  edge('edge_solana_base', 'project_solana_payments', 'project_base_payments', 'contradiction', 49, 'Competing payment rail narratives are not equally evidenced in the current seed set.'),
  edge('edge_agent_wallets_m2m', 'agent_agent_wallets', 'claim_m2m_payments', 'amplification', 82, 'Machine wallet narratives intensify the claim that machines will pay machines.'),
  edge('edge_agentic_market_m2m', 'project_agentic_market', 'claim_m2m_payments', 'citation', 76, 'agentic.market is cited as a venue for machine-to-machine commerce claims.'),
  edge('edge_machine_markets_m2m', 'project_machine_markets', 'claim_m2m_payments', 'proof_link', 81, 'Machine market receipts are the proof path for machine-to-machine payment claims.'),
  edge('edge_machine_markets_depin', 'project_machine_markets', 'project_depin', 'semantic_similarity', 84, 'DePIN and machine markets overlap as programmable supply surfaces.'),
  edge('edge_machine_markets_translation', 'project_machine_markets', 'route_cloud_translation', 'receipt', 74, 'Translation is one of the safer machine-market routes in the current seed window.'),
  edge('edge_machine_markets_naver', 'project_machine_markets', 'route_naver_geocode', 'receipt', 68, 'NAVER geocode is tracked as a bounded proof path inside machine markets.'),
  edge('edge_depin_thread', 'project_depin', 'post_depin_thread', 'amplification', 87, 'Feed narratives are actively amplifying DePIN-as-market-memory.'),
  edge('edge_depin_agentic_market', 'project_depin', 'project_agentic_market', 'semantic_similarity', 67, 'Both clusters imagine distributed service markets, but one is more feed-led.'),
  edge('edge_translation_prespent', 'route_cloud_translation', 'project_pre_spend_intelligence', 'proof_link', 66, 'First-safe machine routes borrow pre-spend proof discipline.'),
  edge('edge_naver_loops', 'route_naver_geocode', 'loop_lab', 'proof_link', 61, 'Bounded navigation proof paths are tracked through loop memory.'),
  edge('edge_prespent_route_memory', 'project_pre_spend_intelligence', 'claim_route_memory', 'proof_link', 95, 'Route memory is a core claim of the Pre-Spend Intelligence product surface.'),
  edge('edge_prespent_provider_rep', 'project_pre_spend_intelligence', 'claim_provider_reputation', 'proof_link', 91, 'Provider reputation is treated as a downstream effect of receipt memory.'),
  edge('edge_route_memory_receipt1', 'claim_route_memory', 'receipt_route_001', 'receipt', 92, 'receipt_001 is a canonical seed artifact for route memory.'),
  edge('edge_route_memory_receipt5', 'claim_route_memory', 'receipt_quote_005', 'receipt', 89, 'receipt_005 strengthens the claim that some routes are repeatable.'),
  edge('edge_provider_rep_proof_feed', 'claim_provider_reputation', 'proof_check_feed', 'citation', 76, 'Proof Feed turns provider reliability claims into inspectable public checks.'),
  edge('edge_receipt_graph_receipt1', 'project_receipt_graph', 'receipt_route_001', 'receipt_link', 93, 'The receipt graph is anchored by inspectable route receipts.'),
  edge('edge_receipt_graph_proof_feed', 'project_receipt_graph', 'proof_check_feed', 'proof_link', 82, 'Proof Feed uses receipt graph context to evaluate public claims.'),
  edge('edge_proof_feed_loop_lab', 'proof_check_feed', 'loop_lab', 'proof_link', 83, 'Loops frequently link back to proof checks as public memory anchors.'),
  edge('edge_loop_lab_no_receipt', 'loop_lab', 'claim_no_receipt_no_trust', 'citation', 94, 'LoopLab operationalizes the doctrine that failure memory should constrain spend.'),
  edge('edge_no_receipt_proof_feed', 'claim_no_receipt_no_trust', 'proof_check_feed', 'proof_link', 96, 'No receipt, no trust is the public reason the Proof Feed exists.'),
  edge('edge_no_receipt_route_memory', 'claim_no_receipt_no_trust', 'claim_route_memory', 'semantic_similarity', 93, 'Route memory is the structural form of the no-receipt-no-trust doctrine.'),
  edge('edge_no_receipt_stop_scrolling', 'claim_no_receipt_no_trust', 'meme_stop_scrolling', 'amplification', 78, 'The slogan packages proof discipline as a cultural meme.'),
  edge('edge_stop_scrolling_ct', 'meme_stop_scrolling', 'post_ct_thread', 'amplification', 85, 'The graph slogan spreads through CT subculture threads.'),
  edge('edge_claim_markets_ct', 'meme_claim_markets', 'post_ct_thread', 'repeated_narrative', 81, 'Claim-markets rhetoric repeats across CT threads.'),
  edge('edge_claim_markets_proof_feed', 'meme_claim_markets', 'proof_check_feed', 'semantic_similarity', 69, 'Claim markets and proof checks both route claims through explicit evaluation.'),
  edge('edge_disputed_check_ct', 'proof_check_disputed_claim', 'post_ct_thread', 'citation', 73, 'Disputed proof states often emerge from screenshot-heavy feed narratives.'),
  edge('edge_disputed_check_carbon', 'proof_check_disputed_claim', 'claim_carbon_credits_sensitive', 'contradiction', 62, 'Carbon-claim narratives often degrade into disputed proof states.'),
  edge('edge_carbon_project_claim', 'project_carbon_finance', 'claim_carbon_credits_sensitive', 'amplification', 74, 'Carbon finance 2.0 amplifies claims-sensitive environmental assets.'),
  edge('edge_carbon_claim_token', 'claim_carbon_credits_sensitive', 'token_carbon_credit', 'citation', 88, 'Tokenized carbon credits inherit the integrity burden of carbon claims.'),
  edge('edge_green_alpha_token', 'meme_green_alpha', 'token_carbon_credit', 'amplification', 79, 'Green alpha memes inflate the attention paid to tokenized carbon narratives.'),
  edge('edge_integrity_receipts_carbon', 'post_integrity_receipts', 'claim_carbon_credits_sensitive', 'proof_link', 84, 'Integrity receipts frame carbon credits as proof-sensitive instruments.'),
  edge('edge_integrity_receipts_no_receipt', 'post_integrity_receipts', 'claim_no_receipt_no_trust', 'semantic_similarity', 86, 'Carbon integrity critics converge on the same no-receipt-no-trust discipline.'),
  edge('edge_stop_scrolling_integrity', 'meme_stop_scrolling', 'post_integrity_receipts', 'citation', 57, 'The graph-reading slogan is cited by integrity threads as an antidote to feed noise.')
]);

const seededRipples = SignalGraphRippleSchema.array().parse([
  {
    id: 'ripple_agentic_payments_24h',
    cluster_id: 'agentic_payments',
    title: 'Payment rail narrative is consolidating around wallet-aware routes',
    summary: 'Agent wallets, Pay.sh, and x402 are being discussed as one stack, but Base evidence still lags Solana receipts.',
    proof_state: 'compounding',
    impact_score: 82,
    changed_at: HALF_DAY_AGO,
    linked_node_ids: ['project_pay_sh', 'project_x402', 'project_solana_payments', 'project_base_payments', 'agent_agent_wallets']
  },
  {
    id: 'ripple_machine_markets_24h',
    cluster_id: 'machine_markets',
    title: 'Machine buyers are moving from demo copy to bounded route plans',
    summary: 'Cloud translation and NAVER geocode remain bounded proof paths while DePIN threads amplify the broader machine-market thesis.',
    proof_state: 'validated',
    impact_score: 76,
    changed_at: HALF_DAY_AGO,
    linked_node_ids: ['project_machine_markets', 'route_cloud_translation', 'route_naver_geocode', 'project_depin', 'post_depin_thread']
  },
  {
    id: 'ripple_pre_spend_24h',
    cluster_id: 'pre_spend_intelligence',
    title: 'Receipt doctrine is hardening into product memory',
    summary: 'Routes, receipts, Proof Feed, and LoopLab are converging on one message: route memory should outlive the feed.',
    proof_state: 'validated',
    impact_score: 91,
    changed_at: NOW,
    linked_node_ids: ['project_pre_spend_intelligence', 'claim_route_memory', 'proof_check_feed', 'loop_lab', 'claim_no_receipt_no_trust']
  },
  {
    id: 'ripple_carbon_24h',
    cluster_id: 'carbon_finance_2_0',
    title: 'Carbon narratives are being challenged as proof-sensitive claims',
    summary: 'Integrity threads are pressuring tokenized carbon stories to surface receipts instead of relying on green alpha rhetoric.',
    proof_state: 'disputed',
    impact_score: 74,
    changed_at: HALF_DAY_AGO,
    linked_node_ids: ['claim_carbon_credits_sensitive', 'token_carbon_credit', 'meme_green_alpha', 'post_integrity_receipts']
  },
  {
    id: 'ripple_ct_24h',
    cluster_id: 'ct_subcultures',
    title: 'CT is memeing the graph as an antidote to screenshot markets',
    summary: 'Claim-market memes and graph-reading memes are spreading together as culture adapts to proof-aware information flows.',
    proof_state: 'compounding',
    impact_score: 80,
    changed_at: NOW,
    linked_node_ids: ['meme_stop_scrolling', 'post_ct_thread', 'meme_claim_markets', 'proof_check_disputed_claim']
  }
]);

function edge(
  id: string,
  source_node_id: string,
  target_node_id: string,
  type: SignalEdgeType,
  strength: number,
  explanation: string
): SignalGraphEdge {
  return { id, source_node_id, target_node_id, type, strength, explanation };
}

function computeClusters(nodes: SignalGraphNode[], edges: SignalGraphEdge[], ripples: SignalGraphRipple[]): SignalGraphCluster[] {
  const clusterSeeds = [
    {
      id: 'agentic_payments',
      label: 'Agentic Payments',
      summary: 'Wallet-aware agent payment rails, settlement narratives, and interoperable spend surfaces.',
      proof_state: 'compounding' as SignalGraphProofState
    },
    {
      id: 'machine_markets',
      label: 'Machine Markets',
      summary: 'Machine buyers, service routes, and DePIN-linked payment narratives for autonomous services.',
      proof_state: 'validated' as SignalGraphProofState
    },
    {
      id: 'pre_spend_intelligence',
      label: 'Pre-Spend Intelligence',
      summary: 'Receipt-backed route memory, provider reputation, and public proof checks before spend.',
      proof_state: 'validated' as SignalGraphProofState
    },
    {
      id: 'carbon_finance_2_0',
      label: 'Carbon Finance 2.0',
      summary: 'Claims-sensitive environmental markets where proof quality directly changes asset credibility.',
      proof_state: 'disputed' as SignalGraphProofState
    },
    {
      id: 'ct_subcultures',
      label: 'CT Subcultures',
      summary: 'Feed-native memes and threads where claims, screenshots, and proof language compete for attention.',
      proof_state: 'compounding' as SignalGraphProofState
    }
  ];

  return SignalGraphClusterSchema.array().parse(clusterSeeds.map((cluster) => {
    const clusterNodes = nodes.filter((node) => node.cluster_id === cluster.id);
    const nodeIds = new Set(clusterNodes.map((node) => node.id));
    const clusterEdges = edges.filter((item) => nodeIds.has(item.source_node_id) || nodeIds.has(item.target_node_id));
    const latestRipple = ripples.find((ripple) => ripple.cluster_id === cluster.id);
    const updatedAt = clusterNodes.map((node) => node.updated_at).sort().reverse()[0] ?? NOW;
    return {
      ...cluster,
      ripple_summary: latestRipple?.summary ?? 'No 24h ripple recorded.',
      node_count: clusterNodes.length,
      edge_count: clusterEdges.length,
      updated_at: updatedAt
    };
  }));
}

function computeStats(nodes: SignalGraphNode[], edges: SignalGraphEdge[], clusters: SignalGraphCluster[]): SignalGraphStats {
  const lastUpdatedAt = nodes.map((node) => node.updated_at).sort().reverse()[0] ?? NOW;
  return SignalGraphStatsSchema.parse({
    node_count: nodes.length,
    edge_count: edges.length,
    cluster_count: clusters.length,
    validated_count: nodes.filter((node) => node.proof_state === 'validated').length,
    disputed_count: nodes.filter((node) => node.proof_state === 'disputed').length,
    compounding_count: nodes.filter((node) => node.proof_state === 'compounding').length,
    last_updated_at: lastUpdatedAt
  });
}

const clusters = computeClusters(seededNodes, seededEdges, seededRipples);
const stats = computeStats(seededNodes, seededEdges, clusters);
const fullGraph = SignalGraphResponseSchema.parse({
  tagline: TAGLINE,
  clusters,
  nodes: seededNodes,
  edges: seededEdges,
  ripples: seededRipples,
  stats
});

function getClusterOrThrow(clusterId: string) {
  const cluster = clusters.find((item) => item.id === clusterId);
  if (!cluster) return null;
  return cluster;
}

function clusterEdges(clusterId: string) {
  const nodeIds = new Set(seededNodes.filter((node) => node.cluster_id === clusterId).map((node) => node.id));
  return seededEdges.filter((item) => nodeIds.has(item.source_node_id) || nodeIds.has(item.target_node_id));
}

function inferProofState(label: string, summary?: string): SignalGraphProofState {
  const text = `${label} ${summary ?? ''}`.toLowerCase();
  if (/(dispute|contradict|conflict|fake)/.test(text)) return 'disputed';
  if (/(receipt|validated|proof|repeatable|verified)/.test(text)) return 'validated';
  if (/(meme|thread|hype|feed|narrative)/.test(text)) return 'compounding';
  if (/(corrupt|spam|wash|sybil)/.test(text)) return 'corrupted';
  return 'unproven';
}

function inferNodeType(label: string, summary?: string): SignalNodeType {
  const text = `${label} ${summary ?? ''}`.toLowerCase();
  if (/(receipt_|\breceipt\b)/.test(text)) return 'receipt';
  if (/(proof|check)/.test(text)) return 'proof_check';
  if (/(loop|looplab)/.test(text)) return 'loop_run';
  if (/(agent|wallet)/.test(text)) return 'agent';
  if (/(token)/.test(text)) return 'token';
  if (/(route|path)/.test(text)) return 'route';
  if (/(meme|slogan)/.test(text)) return 'meme';
  if (/(thread|post|feed)/.test(text)) return 'post';
  if (/(claim)/.test(text)) return 'claim';
  return 'project';
}

function inferConfidence(proofState: SignalGraphProofState, label: string) {
  const base = proofState === 'validated' ? 84 : proofState === 'compounding' ? 68 : proofState === 'disputed' ? 52 : proofState === 'corrupted' ? 28 : 46;
  const bump = /receipt|proof|loop|route/.test(label.toLowerCase()) ? 6 : 0;
  return Math.min(100, base + bump);
}

function inferVelocity(label: string, summary?: string) {
  const text = `${label} ${summary ?? ''}`.toLowerCase();
  if (/(feed|meme|thread|ct)/.test(text)) return 89;
  if (/(machine|agent|market|x402)/.test(text)) return 78;
  if (/(carbon|route|receipt|proof)/.test(text)) return 66;
  return 58;
}

function suggestEdges(label: string, summary?: string, clusterId?: string) {
  const text = `${label} ${summary ?? ''}`.toLowerCase();
  const suggestions: Array<{ target_node_id: string; type: SignalEdgeType; strength: number; explanation: string }> = [];

  const push = (target_node_id: string, type: SignalEdgeType, strength: number, explanation: string) => {
    if (suggestions.some((item) => item.target_node_id === target_node_id)) return;
    suggestions.push({ target_node_id, type, strength, explanation });
  };

  if (clusterId) {
    const anchor = seededNodes.find((node) => node.cluster_id === clusterId);
    if (anchor) push(anchor.id, 'semantic_similarity', 64, `Cluster hint suggests adjacency to ${anchor.label}.`);
  }
  if (/(receipt|proof)/.test(text)) push('claim_no_receipt_no_trust', 'proof_link', 92, 'Proof-oriented inputs converge on the no-receipt-no-trust doctrine.');
  if (/(agent|wallet|pay\.sh|x402|solana|base)/.test(text)) push('project_pay_sh', 'semantic_similarity', 74, 'Payment-oriented input clusters near Pay.sh.');
  if (/(machine|depin|market|translation|naver)/.test(text)) push('project_machine_markets', 'semantic_similarity', 72, 'Machine-market terms cluster around machine-market memory.');
  if (/(carbon|credit|integrity)/.test(text)) push('claim_carbon_credits_sensitive', 'citation', 71, 'Carbon integrity inputs connect to the claims-sensitive carbon node.');
  if (/(feed|scroll|meme|ct|thread)/.test(text)) push('meme_stop_scrolling', 'amplification', 77, 'Feed-native language aligns with the graph-reading meme.');

  return suggestions.slice(0, 3);
}

export function getSignalGraph(): SignalGraphResponse {
  return fullGraph;
}

export function getSignalGraphClusters(): SignalGraphCluster[] {
  return clusters;
}

export function getSignalGraphCluster(clusterId: string): SignalGraphClusterDetail | undefined {
  const cluster = getClusterOrThrow(clusterId);
  if (!cluster) return undefined;
  return SignalGraphClusterDetailSchema.parse({
    cluster,
    nodes: seededNodes.filter((node) => node.cluster_id === clusterId),
    edges: clusterEdges(clusterId),
    ripples: seededRipples.filter((ripple) => ripple.cluster_id === clusterId)
  });
}

export function getSignalGraphNode(nodeId: string): SignalGraphNodeDetail | undefined {
  const node = seededNodes.find((item) => item.id === nodeId);
  if (!node) return undefined;
  const cluster = getClusterOrThrow(node.cluster_id);
  if (!cluster) return undefined;
  const connectedEdges = seededEdges.filter((item) => item.source_node_id === nodeId || item.target_node_id === nodeId);
  const relatedNodeIds = new Set(connectedEdges.flatMap((item) => [item.source_node_id, item.target_node_id]).filter((id) => id !== nodeId));
  return SignalGraphNodeDetailSchema.parse({
    node,
    cluster,
    connected_edges: connectedEdges,
    related_nodes: seededNodes.filter((item) => relatedNodeIds.has(item.id)),
    ripples: seededRipples.filter((ripple) => ripple.linked_node_ids.includes(nodeId))
  });
}

export function getSignalGraphRipples(): SignalGraphRipple[] {
  return seededRipples;
}

const signalGraphEntityLinkFieldMap: Record<SignalGraphEntityType, keyof SignalGraphNode> = {
  receipt: 'linked_receipt_ids',
  claim: 'linked_claim_ids',
  loop: 'linked_loop_ids',
  route: 'linked_route_ids',
  provider: 'linked_provider_ids',
  service: 'linked_service_ids'
};

export function isSignalGraphEntityType(value: string): value is SignalGraphEntityType {
  return SignalGraphEntityTypeSchema.safeParse(value).success;
}

export function findSignalGraphNodesForEntity(entityType: SignalGraphEntityType, entityId: string): SignalGraphEntityLookupResponse {
  const parsedType = SignalGraphEntityTypeSchema.parse(entityType);
  const linkField = signalGraphEntityLinkFieldMap[parsedType];
  const nodes = seededNodes
    .filter((node) => Array.isArray(node[linkField]) && node[linkField]?.includes(entityId))
    .sort((left, right) => {
      if (right.confidence_score !== left.confidence_score) return right.confidence_score - left.confidence_score;
      if (right.velocity_score !== left.velocity_score) return right.velocity_score - left.velocity_score;
      return left.label.localeCompare(right.label);
    });

  return SignalGraphEntityLookupResponseSchema.parse({
    entity_type: parsedType,
    entity_id: entityId,
    nodes
  });
}

export function checkSignalGraph(input: SignalGraphCheckInput): SignalGraphCheckResponse {
  const parsed = SignalGraphCheckInputSchema.parse(input);
  const proofState = inferProofState(parsed.label, parsed.summary);
  const previewId = `preview_${createHash('sha1').update(`${parsed.label}|${parsed.summary ?? ''}|${parsed.source_url ?? ''}|${parsed.cluster_id ?? ''}`).digest('hex').slice(0, 10)}`;
  const previewClusterId = parsed.cluster_id && clusters.some((cluster) => cluster.id === parsed.cluster_id)
    ? parsed.cluster_id
    : suggestEdges(parsed.label, parsed.summary, parsed.cluster_id)[0]?.target_node_id
      ? seededNodes.find((node) => node.id === suggestEdges(parsed.label, parsed.summary, parsed.cluster_id)[0]?.target_node_id)?.cluster_id ?? 'ct_subcultures'
      : 'ct_subcultures';
  const suggested = suggestEdges(parsed.label, parsed.summary, parsed.cluster_id);
  const preview = SignalGraphNodeSchema.parse({
    id: previewId,
    type: inferNodeType(parsed.label, parsed.summary),
    label: parsed.label,
    summary: parsed.summary ?? 'Signal Graph preview node generated from deterministic v0 check input.',
    cluster_id: previewClusterId,
    proof_state: proofState,
    confidence_score: inferConfidence(proofState, parsed.label),
    velocity_score: inferVelocity(parsed.label, parsed.summary),
    source_urls: parsed.source_url ? [parsed.source_url] : undefined,
    linked_receipt_ids: proofState === 'validated' ? ['receipt_001'] : undefined,
    linked_claim_ids: /claim|carbon|route|reputation/.test(parsed.label.toLowerCase()) ? ['claim_001'] : undefined,
    linked_loop_ids: /loop|agent|machine/.test(parsed.label.toLowerCase()) ? ['loop_pre_spend_route'] : undefined,
    created_at: NOW,
    updated_at: NOW
  });

  return SignalGraphCheckResponseSchema.parse({
    generated_node_preview: preview,
    suggested_proof_state: proofState,
    confidence_score: preview.confidence_score,
    suggested_edges: suggested,
    explanation: proofState === 'validated'
      ? 'Deterministic v0 assessment suggests the input already speaks in receipt, route, or proof language and should connect into the graph as validated memory.'
      : proofState === 'disputed'
        ? 'Deterministic v0 assessment found dispute-oriented language, so the node is suggested as contested memory until receipts close it.'
        : proofState === 'compounding'
          ? 'Deterministic v0 assessment reads this as a fast-moving narrative or meme that is compounding socially faster than it is closing with proof.'
          : proofState === 'corrupted'
            ? 'Deterministic v0 assessment reads corruption or spam language, so the graph should treat it as potentially polluted memory.'
            : 'Deterministic v0 assessment could not find enough receipt-like language, so the node remains unproven until stronger proof links appear.'
  });
}
