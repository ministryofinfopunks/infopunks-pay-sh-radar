export type MappingTargetState =
  | 'needs_candidate'
  | 'needs_verified_route'
  | 'candidate_mapping_found'
  | 'verified_mapping_found'
  | 'second_verified_mapping_found'
  | 'one_proven_mapping_found'
  | 'benchmark_ready'
  | 'needs_two_comparable_mappings';

export type MappingTarget = {
  category: string;
  benchmark_intent: string;
  current_state: MappingTargetState;
  needed_next_step: string;
  suggested_provider_candidates?: string[];
  why_it_matters: string;
  readiness_blocker: string;
};

const mappingTargets: MappingTarget[] = [
  {
    category: 'solana-infra',
    benchmark_intent: 'account balance',
    current_state: 'needs_two_comparable_mappings',
    needed_next_step: 'Benchmark Scaffold: re-run QuickNode paid verifier in a compatible runtime and secure a second comparable paid-proven route that returns native SOL balance/account lamports for the same canonical address, then record one five-run benchmark artifact.',
    suggested_provider_candidates: ['QuickNode Solana Mainnet JSON-RPC'],
    why_it_matters: 'Infrastructure-grade account-balance retrieval is a core Solana primitive and validates non-finance route reliability.',
    readiness_blocker: 'QuickNode is the strongest candidate and unpaid probes confirmed HTTP 402 for getBalance/getAccountInfo, with normalizer/caveats/evidence-health derivation and paid verifier implemented in Harness, but the current paid execution failed so QuickNode remains unproven (evidence_health=unverified). No comparable second native SOL balance/lamports route is available in the current Pay catalog snapshot; stablecrypto.dev/api/alchemy/node/rpc was rejected as comparable because its published contract is Ethereum-oriented and Solana lamports semantics were not proven.'
  },
  {
    category: 'communications',
    benchmark_intent: 'email delivery',
    current_state: 'candidate_mapping_found',
    needed_next_step: 'Keep scaffold lane: preserve StableEmail as paid-executed verified/proven with caveated evidence, then prove a second comparable paid route and record a five-run benchmark artifact.',
    suggested_provider_candidates: ['AgentMail', 'StableEmail'],
    why_it_matters: 'Email delivery routes provide a high-value communications fallback for agent notifications and operational workflows.',
    readiness_blocker: 'StableEmail is paid-proven with caveated evidence; AgentMail verifier is ready but blocked by AGENTMAIL_INBOX_ID/inbox ownership configuration, no alternate comparable outbound provider is currently found, and no five-run artifact is recorded.'
  },
  {
    category: 'finance/data',
    benchmark_intent: 'token metadata',
    current_state: 'candidate_mapping_found',
    needed_next_step: 'verify endpoint/method/request shape for token metadata candidates',
    suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'],
    why_it_matters: 'Token metadata is needed to normalize symbols/contracts before cross-provider benchmark comparisons.',
    readiness_blocker: 'candidate mappings exist, but no verified/proven token metadata route evidence is recorded'
  },
  {
    category: 'finance/data',
    benchmark_intent: 'token search',
    current_state: 'benchmark_ready',
    needed_next_step: 'Run normalized token-search benchmark.',
    suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'],
    why_it_matters: 'Search intent is a common pre-route step for symbol resolution and benchmark input shaping.',
    readiness_blocker: 'None; two comparable proven routes exist, but benchmark has not been recorded yet.'
  },
  {
    category: 'social-data',
    benchmark_intent: 'reddit post search',
    current_state: 'needs_two_comparable_mappings',
    needed_next_step: 'Benchmark Scaffold: keep StableEnrich locked as paid-proven (verified/proven, evidence_health=caveated), establish recognizable Reddit post semantics for StableSocial through comparable paid execution on canonical input {"query":"x402","limit":5}, then record one five-run benchmark artifact.',
    suggested_provider_candidates: ['StableEnrich Reddit Search', 'StableSocial Reddit Search'],
    why_it_matters: 'Reddit post search expands social-data coverage for trend and community-signal workflows.',
    readiness_blocker: 'Only one comparable paid-proven route exists today: StableEnrich is paid-proven and returns recognizable Reddit posts, while StableSocial remains candidate/unproven despite POST confirmation, unpaid 402 behavior (variants A-F), and one successful paid diagnostic retry (variant A) because recognizable Reddit post semantics were not established. No five-run artifact exists.'
  },
  {
    category: 'document-ai',
    benchmark_intent: 'document OCR text extraction',
    current_state: 'benchmark_ready',
    needed_next_step: 'Recorded benchmark is available. Keep winner_claimed=false and winner_status=no_clear_winner until scoring thresholds are explicitly defined.',
    suggested_provider_candidates: ['PaySponge Reducto /parse', 'Google Vision /v1/images:annotate'],
    why_it_matters: 'Document OCR benchmarks validate extraction fidelity and latency for fixture-based document intelligence workflows.',
    readiness_blocker: 'None; two comparable paid-proven OCR routes are recorded with a five-run benchmark artifact. No winner is claimed.'
  },
  {
    category: 'messaging',
    benchmark_intent: 'SMS/send message',
    current_state: 'needs_candidate',
    needed_next_step: 'Add initial candidate mapping(s) for SMS send-message workflow.',
    suggested_provider_candidates: [],
    why_it_matters: 'Messaging routes are high-impact for agent notifications and recovery loops.',
    readiness_blocker: 'No candidate mapping rows are currently tracked for messaging send intent.'
  },
  {
    category: 'search',
    benchmark_intent: 'knowledge/search answer',
    current_state: 'needs_candidate',
    needed_next_step: 'Add first candidate mapping for answer-oriented search response.',
    suggested_provider_candidates: [],
    why_it_matters: 'Search answer benchmarks improve route quality for research and decision-support tasks.',
    readiness_blocker: 'No candidate mapping exists for this search benchmark intent.'
  },
  {
    category: 'web-search',
    benchmark_intent: 'web search results',
    current_state: 'benchmark_ready',
    needed_next_step: 'Recorded benchmark is available. Keep winner_claimed=false and define scoring thresholds before any winner policy is enabled.',
    suggested_provider_candidates: ['StableEnrich Exa Search', 'Perplexity Search'],
    why_it_matters: 'Normalized web-search result benchmarking improves route quality for broad discovery and retrieval workflows.',
    readiness_blocker: 'None; two comparable paid-proven routes are recorded with a five-run benchmark artifact. No winner is claimed.'
  },
  {
    category: 'maps',
    benchmark_intent: 'place search results',
    current_state: 'needs_two_comparable_mappings',
    needed_next_step: 'Benchmark Scaffold: finalize lane-specific normalizer/caveats/evidence_health, then paid-prove solana-foundation/google/places and merit-systems/stableenrich/enrichment on canonical input {"query":"coffee near Union Square San Francisco","location":"Union Square, San Francisco, CA","limit":5}, then record one five-run benchmark artifact.',
    suggested_provider_candidates: ['solana-foundation/google/places', 'merit-systems/stableenrich/enrichment'],
    why_it_matters: 'Maps place-search benchmarking improves local discovery route quality for geospatial agent workflows.',
    readiness_blocker: 'Scaffold only: comparable candidates are identified from Harness readiness research, but lane-specific normalizer/caveats/evidence_health are not finalized, no two comparable paid-proven routes are recorded on the same canonical input, and no five-run benchmark artifact exists.'
  }
];

export function listMappingTargets() {
  return [...mappingTargets];
}
