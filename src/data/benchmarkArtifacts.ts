export type BenchmarkArtifactRoute = {
  provider_id: string;
  route_id: string;
  execution_status: 'verified' | 'proven';
  success: boolean;
  latency_ms: number | null;
  paid_execution_proven: boolean;
  proof_reference: string;
  normalized_output_available: boolean;
  extracted_price_usd: number | null;
  extraction_path: string | null;
  success_rate: number | null;
  median_latency_ms: number | null;
  p95_latency_ms: number | null;
  average_price_usd: number | null;
  min_price_usd: number | null;
  max_price_usd: number | null;
  price_variance_percent: number | null;
  completed_runs: number | null;
  failed_runs: number | null;
  execution_transport: 'pay_cli';
  cli_exit_code: number | null;
  status_code: number | null;
  status_evidence: string;
  normalization_confidence: 'unknown' | 'low' | 'medium' | 'high';
  freshness_timestamp: string | null;
  comparison_notes: string;
};

export type BenchmarkArtifactRecord = {
  artifact_id: string;
  benchmark_id: string;
  generated_at: string;
  source_repo: string;
  artifact_path: string;
  total_runs: number;
  winner_claimed: boolean;
  winner_status: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
  routes: BenchmarkArtifactRoute[];
  aggregate_metrics: Record<string, unknown>;
  notes: string;
};

const SOL_FIVE_RUN_ARTIFACT: BenchmarkArtifactRecord = {
  artifact_id: 'finance-data-sol-price-benchmark-runs-2026-05-16',
  benchmark_id: 'finance-data-sol-price',
  generated_at: '2026-05-16T07:42:42.271Z',
  source_repo: 'https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness',
  artifact_path: 'live-proofs/finance-data-sol-price-benchmark-runs-2026-05-16.md',
  total_runs: 5,
  winner_claimed: false,
  winner_status: 'no_clear_winner',
  routes: [
    {
      provider_id: 'merit-systems-stablecrypto-market-data',
      route_id: 'merit-systems-stablecrypto-market-data:POST:https://stablecrypto.dev/api/coingecko/price',
      execution_status: 'proven',
      success: true,
      latency_ms: 5691,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/stablecrypto-harness-pay-cli-2026-05-12.md',
      normalized_output_available: true,
      extracted_price_usd: 87.57,
      extraction_path: 'solana.usd',
      success_rate: 1,
      median_latency_ms: 5691,
      p95_latency_ms: 6469,
      average_price_usd: 87.57,
      min_price_usd: 87.57,
      max_price_usd: 87.57,
      price_variance_percent: 0,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-16T07:42:42.271Z',
      comparison_notes: 'Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.'
    },
    {
      provider_id: 'paysponge-coingecko',
      route_id: 'paysponge-coingecko:GET:https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
      execution_status: 'proven',
      success: true,
      latency_ms: 7761,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md',
      normalized_output_available: true,
      extracted_price_usd: 87.50392093173244,
      extraction_path: 'data[sol_usdc].attributes.base_token_price_usd',
      success_rate: 1,
      median_latency_ms: 7761,
      p95_latency_ms: 7946,
      average_price_usd: 87.50392093173244,
      min_price_usd: 87.50332626375734,
      max_price_usd: 87.50629960363277,
      price_variance_percent: 0.0033979504504081403,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-16T07:42:42.271Z',
      comparison_notes: 'Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.'
    }
  ],
  aggregate_metrics: {
    benchmark_recorded: true,
    required_runs: 5,
    completed_runs: 5,
    winner_policy: 'sol-price-v0.1'
  },
  notes: 'Curated/imported benchmark evidence record. Raw proof content is not served by Radar APIs.'
};

const TOKEN_SEARCH_FIVE_RUN_ARTIFACT: BenchmarkArtifactRecord = {
  artifact_id: 'finance-data-token-search-benchmark-runs-2026-05-17',
  benchmark_id: 'finance-data-token-search',
  generated_at: '2026-05-17T02:39:22.786Z',
  source_repo: 'https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness',
  artifact_path: 'live-proofs/finance-data-token-search-benchmark-runs-2026-05-17.md',
  total_runs: 5,
  winner_claimed: false,
  winner_status: 'no_clear_winner',
  routes: [
    {
      provider_id: 'merit-systems-stablecrypto-market-data',
      route_id: 'merit-systems-stablecrypto-market-data:POST:https://stablecrypto.dev/api/coingecko/onchain/search',
      execution_status: 'proven',
      success: true,
      latency_ms: 7048,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/stablecrypto-token-search-paid-execution-2026-05-17.md',
      normalized_output_available: true,
      extracted_price_usd: null,
      extraction_path: 'data[].attributes',
      success_rate: 1,
      median_latency_ms: 7048,
      p95_latency_ms: 9946,
      average_price_usd: null,
      min_price_usd: null,
      max_price_usd: null,
      price_variance_percent: null,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-17T02:39:22.786Z',
      comparison_notes: 'Token-search benchmark recorded. No route winner is claimed. Scoring thresholds are not finalized.'
    },
    {
      provider_id: 'paysponge-coingecko',
      route_id: 'paysponge-coingecko:GET:https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
      execution_status: 'proven',
      success: true,
      latency_ms: 8533,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/paysponge-coingecko-token-search-paid-execution-2026-05-17.md',
      normalized_output_available: true,
      extracted_price_usd: null,
      extraction_path: 'data[].attributes',
      success_rate: 1,
      median_latency_ms: 8533,
      p95_latency_ms: 10545,
      average_price_usd: null,
      min_price_usd: null,
      max_price_usd: null,
      price_variance_percent: null,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-17T02:39:22.786Z',
      comparison_notes: 'Token-search benchmark recorded. No route winner is claimed. Scoring thresholds are not finalized.'
    }
  ],
  aggregate_metrics: {
    benchmark_recorded: true,
    required_runs: 5,
    completed_runs: 5,
    canonical_query: 'SOL',
    token_search_detection_rate: 1,
    dominant_response_shape: 'pool_search_results'
  },
  notes: 'Curated/imported benchmark evidence record. Raw proof content is not served by Radar APIs.'
};

const TOKEN_METADATA_FIVE_RUN_ARTIFACT: BenchmarkArtifactRecord = {
  artifact_id: 'finance-data-token-metadata-benchmark-runs-2026-05-18',
  benchmark_id: 'finance-data-token-metadata',
  generated_at: '2026-05-18T07:18:00.000Z',
  source_repo: 'https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness',
  artifact_path: 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-18.md',
  total_runs: 5,
  winner_claimed: false,
  winner_status: 'no_clear_winner',
  routes: [
    {
      provider_id: 'paysponge-coingecko',
      route_id: 'paysponge-coingecko:GET:/x402/onchain/networks/solana/tokens/So11111111111111111111111111111111111111112',
      execution_status: 'proven',
      success: true,
      latency_ms: 5827,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-18.md',
      normalized_output_available: true,
      extracted_price_usd: null,
      extraction_path: null,
      success_rate: 1,
      median_latency_ms: 5827,
      p95_latency_ms: 10307,
      average_price_usd: null,
      min_price_usd: null,
      max_price_usd: null,
      price_variance_percent: null,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body; canonical_network_match_rate=0.0',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-18T07:18:00.000Z',
      comparison_notes: 'Token-metadata benchmark recorded. Caveat: canonical_network_match_rate remained 0.0 for PaySponge.'
    },
    {
      provider_id: 'merit-systems-stablecrypto-market-data',
      route_id: 'merit-systems-stablecrypto-market-data:POST:/api/coingecko/coin',
      execution_status: 'proven',
      success: true,
      latency_ms: 4982,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-18.md',
      normalized_output_available: true,
      extracted_price_usd: null,
      extraction_path: null,
      success_rate: 1,
      median_latency_ms: 4982,
      p95_latency_ms: 5107,
      average_price_usd: null,
      min_price_usd: null,
      max_price_usd: null,
      price_variance_percent: null,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-18T07:18:00.000Z',
      comparison_notes: 'Token-metadata benchmark recorded. No route winner is claimed.'
    }
  ],
  aggregate_metrics: {
    benchmark_recorded: true,
    required_runs: 5,
    completed_runs: 5,
    route_inputs: {
      paysponge_coingecko: 'GET /x402/onchain/networks/solana/tokens/So11111111111111111111111111111111111111112',
      merit_systems_stablecrypto_market_data: 'POST /api/coingecko/coin {"id":"wrapped-solana"}'
    },
    normalized_metadata_detection_rate: 1,
    canonical_address_match_rate: 1,
    canonical_network_match_rate: {
      paysponge_coingecko: 0,
      merit_systems_stablecrypto_market_data: 1
    },
    canonical_decimals_match_rate: 1
  },
  notes: 'Curated/imported benchmark evidence record. Raw proof content is not served by Radar APIs.'
};

const TOKEN_METADATA_FIVE_RUN_ARTIFACT_2026_05_19: BenchmarkArtifactRecord = {
  artifact_id: 'finance-data-token-metadata-benchmark-runs-2026-05-19',
  benchmark_id: 'finance-data-token-metadata',
  generated_at: '2026-05-19T07:18:00.000Z',
  source_repo: 'https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness',
  artifact_path: 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-19.md',
  total_runs: 5,
  winner_claimed: false,
  winner_status: 'no_clear_winner',
  routes: [
    {
      provider_id: 'paysponge-coingecko',
      route_id: 'paysponge-coingecko:GET:/x402/onchain/networks/solana/tokens/So11111111111111111111111111111111111111112',
      execution_status: 'proven',
      success: true,
      latency_ms: 5430,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-19.md',
      normalized_output_available: true,
      extracted_price_usd: null,
      extraction_path: null,
      success_rate: 1,
      median_latency_ms: 5430,
      p95_latency_ms: 5730,
      average_price_usd: null,
      min_price_usd: null,
      max_price_usd: null,
      price_variance_percent: null,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-19T07:18:00.000Z',
      comparison_notes: 'Token-metadata benchmark recorded. route_context_inferred_network.'
    },
    {
      provider_id: 'merit-systems-stablecrypto-market-data',
      route_id: 'merit-systems-stablecrypto-market-data:POST:/api/coingecko/coin',
      execution_status: 'proven',
      success: true,
      latency_ms: 4760,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-19.md',
      normalized_output_available: true,
      extracted_price_usd: null,
      extraction_path: null,
      success_rate: 1,
      median_latency_ms: 4760,
      p95_latency_ms: 5360,
      average_price_usd: null,
      min_price_usd: null,
      max_price_usd: null,
      price_variance_percent: null,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-19T07:18:00.000Z',
      comparison_notes: 'Token-metadata benchmark recorded. No route winner is claimed.'
    }
  ],
  aggregate_metrics: {
    benchmark_recorded: true,
    required_runs: 5,
    completed_runs: 5,
    route_inputs: {
      paysponge_coingecko: 'GET /x402/onchain/networks/solana/tokens/So11111111111111111111111111111111111111112',
      merit_systems_stablecrypto_market_data: 'POST /api/coingecko/coin {"id":"wrapped-solana"}'
    },
    normalized_metadata_detection_rate: 1,
    canonical_address_match_rate: 1,
    canonical_network_match_rate: {
      paysponge_coingecko: 1,
      merit_systems_stablecrypto_market_data: 1
    },
    canonical_decimals_match_rate: 1,
    network_source: {
      paysponge_coingecko: 'route_context',
      merit_systems_stablecrypto_market_data: 'payload'
    },
    network_source_distribution: {
      paysponge_coingecko: { route_context: 5 },
      merit_systems_stablecrypto_market_data: { payload: 5 }
    }
  },
  notes: 'Curated/imported benchmark evidence record. Raw proof content is not served by Radar APIs. route_context_inferred_network'
};

const DATA_WEB_SEARCH_RESULTS_FIVE_RUN_ARTIFACT_2026_05_19: BenchmarkArtifactRecord = {
  artifact_id: 'data-web-search-results-benchmark-runs-2026-05-19',
  benchmark_id: 'data-web-search-results',
  generated_at: '2026-05-19T09:30:00.000Z',
  source_repo: 'https://github.com/ministryofinfopunks/infopunks-pay-sh-agent-harness',
  artifact_path: 'live-proofs/data-web-search-results-benchmark-runs-2026-05-19.md',
  total_runs: 10,
  winner_claimed: false,
  winner_status: 'no_clear_winner',
  routes: [
    {
      provider_id: 'stableenrich-exa-search',
      route_id: 'stableenrich-exa-search:POST:/api/exa/search',
      execution_status: 'proven',
      success: true,
      latency_ms: 4962,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/data-web-search-results-paid-routes-2026-05-19.md',
      normalized_output_available: true,
      extracted_price_usd: null,
      extraction_path: null,
      success_rate: 1,
      median_latency_ms: 4962,
      p95_latency_ms: 5411,
      average_price_usd: null,
      min_price_usd: null,
      max_price_usd: null,
      price_variance_percent: null,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-19T09:30:00.000Z',
      comparison_notes: 'Web-search results benchmark recorded. No route winner is claimed.'
    },
    {
      provider_id: 'perplexity-search',
      route_id: 'perplexity-search:POST:/api/search',
      execution_status: 'proven',
      success: true,
      latency_ms: 5229,
      paid_execution_proven: true,
      proof_reference: 'live-proofs/data-web-search-results-paid-routes-2026-05-19.md',
      normalized_output_available: true,
      extracted_price_usd: null,
      extraction_path: null,
      success_rate: 1,
      median_latency_ms: 5229,
      p95_latency_ms: 5988,
      average_price_usd: null,
      min_price_usd: null,
      max_price_usd: null,
      price_variance_percent: null,
      completed_runs: 5,
      failed_runs: 0,
      execution_transport: 'pay_cli',
      cli_exit_code: 0,
      status_code: null,
      status_evidence: 'pay_cli exit code 0 and parsed response body',
      normalization_confidence: 'high',
      freshness_timestamp: '2026-05-19T09:30:00.000Z',
      comparison_notes: 'Web-search results benchmark recorded. No route winner is claimed.'
    }
  ],
  aggregate_metrics: {
    benchmark_recorded: true,
    required_runs: 5,
    completed_runs: 5,
    canonical_input: {
      query: 'x402 agent payments',
      limit: 5
    },
    normalized_result_count_rate: 1,
    canonical_query_match_rate: 1
  },
  notes: 'Curated/imported benchmark evidence record. Raw proof content is not served by Radar APIs.'
};

const REGISTRY: BenchmarkArtifactRecord[] = [
  SOL_FIVE_RUN_ARTIFACT,
  TOKEN_SEARCH_FIVE_RUN_ARTIFACT,
  TOKEN_METADATA_FIVE_RUN_ARTIFACT,
  TOKEN_METADATA_FIVE_RUN_ARTIFACT_2026_05_19,
  DATA_WEB_SEARCH_RESULTS_FIVE_RUN_ARTIFACT_2026_05_19
];
const LEGACY_ARTIFACT_ID_ALIASES: Record<string, string> = {
  'finance-data-sol-price-runs-2026-05-16': 'finance-data-sol-price-benchmark-runs-2026-05-16'
};

export function listBenchmarkArtifacts(): BenchmarkArtifactRecord[] {
  return REGISTRY;
}

export function getBenchmarkArtifactById(artifactId: string): BenchmarkArtifactRecord | null {
  const canonicalId = LEGACY_ARTIFACT_ID_ALIASES[artifactId] ?? artifactId;
  return REGISTRY.find((artifact) => artifact.artifact_id === canonicalId) ?? null;
}

export function getLatestBenchmarkArtifact(benchmarkId: string): BenchmarkArtifactRecord | null {
  const matches = REGISTRY.filter((artifact) => artifact.benchmark_id === benchmarkId);
  if (!matches.length) return null;
  return [...matches].sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at))[0];
}
