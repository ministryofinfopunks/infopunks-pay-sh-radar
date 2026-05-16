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
  artifact_id: 'finance-data-sol-price-runs-2026-05-16',
  benchmark_id: 'finance-data-sol-price',
  generated_at: '2026-05-16T07:42:42.271Z',
  source_repo: 'https://github.com/infopunks/infopunks-pay-sh-intelligence-terminal',
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
      route_id: 'paysponge-coingecko:POST:https://api.coingecko.com/api/v3/onchain/simple/networks/solana/token_price/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
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

const REGISTRY: BenchmarkArtifactRecord[] = [SOL_FIVE_RUN_ARTIFACT];

export function listBenchmarkArtifacts(): BenchmarkArtifactRecord[] {
  return REGISTRY;
}

export function getBenchmarkArtifactById(artifactId: string): BenchmarkArtifactRecord | null {
  return REGISTRY.find((artifact) => artifact.artifact_id === artifactId) ?? null;
}

export function getLatestBenchmarkArtifact(benchmarkId: string): BenchmarkArtifactRecord | null {
  const matches = REGISTRY.filter((artifact) => artifact.benchmark_id === benchmarkId);
  if (!matches.length) return null;
  return [...matches].sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at))[0];
}
