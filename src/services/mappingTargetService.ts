export type MappingTargetState =
  | 'needs_candidate'
  | 'needs_verified_route'
  | 'candidate_mapping_found'
  | 'verified_mapping_found'
  | 'second_verified_mapping_found'
  | 'one_proven_mapping_found'
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
    category: 'finance/data',
    benchmark_intent: 'token metadata',
    current_state: 'needs_candidate',
    needed_next_step: 'Add at least one candidate route mapping row for token metadata retrieval.',
    suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'],
    why_it_matters: 'Token metadata is needed to normalize symbols/contracts before cross-provider benchmark comparisons.',
    readiness_blocker: 'No candidate mapping exists yet for this benchmark intent.'
  },
  {
    category: 'finance/data',
    benchmark_intent: 'token search',
    current_state: 'second_verified_mapping_found',
    needed_next_step: 'Run paid execution for StableCrypto token-search route.',
    suggested_provider_candidates: ['CoinGecko Onchain DEX API', 'StableCrypto'],
    why_it_matters: 'Search intent is a common pre-route step for symbol resolution and benchmark input shaping.',
    readiness_blocker: 'PaySponge has proven execution, but StableCrypto is verified/unproven. Benchmark readiness requires two comparable proven routes.'
  },
  {
    category: 'ai_ml/data',
    benchmark_intent: 'OCR comparison',
    current_state: 'needs_two_comparable_mappings',
    needed_next_step: 'Record two comparable verified mappings for OCR extraction with matching benchmark intent.',
    suggested_provider_candidates: [],
    why_it_matters: 'OCR benchmarking requires comparable extraction tasks to score quality and latency fairly.',
    readiness_blocker: 'Fewer than two comparable mappings are available for this category/intent.'
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
  }
];

export function listMappingTargets() {
  return [...mappingTargets];
}
