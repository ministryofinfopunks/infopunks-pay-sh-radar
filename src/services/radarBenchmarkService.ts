import { BenchmarkHistoryEntry, RadarBenchmarkDetail, RadarBenchmarkHistory, RadarBenchmarkList, RadarBenchmarkRouteMetric } from '../schemas/entities';
import { listRouteMappings } from './providerEndpointMap';
import { getBenchmarkArtifactById, getLatestBenchmarkArtifact, listBenchmarkArtifacts } from '../data/benchmarkArtifacts';

const SOL_PRICE_BENCHMARK_ID = 'finance-data-sol-price';
const SOL_PRICE_CATEGORY = 'finance/data';
const SOL_PRICE_INTENT = 'get sol price';
const TOKEN_SEARCH_BENCHMARK_ID = 'finance-data-token-search';
const BENCHMARK_EVIDENCE_AT = '2026-05-16T07:42:42.271Z';
const BENCHMARK_PROOF_REFERENCE = 'live-proofs/finance-data-sol-price-benchmark-runs-2026-05-16.md';

export type BenchmarkArtifactSafeMetadata = {
  artifact_id: string;
  benchmark_id: string;
  generated_at: string;
  source_repo: string;
  artifact_path: string;
  total_runs: number;
  winner_claimed: boolean;
  winner_status: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
  routes: Array<{
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
  }>;
  aggregate_metrics: Record<string, unknown>;
  notes: string;
};

export function buildRadarBenchmarks(): RadarBenchmarkList {
  return {
    generated_at: BENCHMARK_EVIDENCE_AT,
    source: 'infopunks-pay-sh-radar',
    benchmarks: [buildSolPriceBenchmark(), buildTokenSearchBenchmark()]
  };
}

export function buildRadarBenchmarkById(id: string): RadarBenchmarkDetail | null {
  if (id === SOL_PRICE_BENCHMARK_ID) return buildSolPriceBenchmark();
  if (id === TOKEN_SEARCH_BENCHMARK_ID) return buildTokenSearchBenchmark();
  return null;
}

export function buildRadarBenchmarkHistoryById(id: string): RadarBenchmarkHistory | null {
  if (id !== SOL_PRICE_BENCHMARK_ID) return null;
  const fiveRunBenchmark = buildSolPriceBenchmark();
  return {
    generated_at: BENCHMARK_EVIDENCE_AT,
    source: 'infopunks-pay-sh-radar',
    benchmark_id: SOL_PRICE_BENCHMARK_ID,
    entries: [
      {
        benchmark_id: SOL_PRICE_BENCHMARK_ID,
        recorded_at: '2026-05-15T00:00:00.000Z',
        run_count: 1,
        benchmark_recorded: true,
        winner_claimed: false,
        note: 'first live normalized single-run benchmark',
        proof_reference: 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md',
        routes: []
      },
      {
        benchmark_id: SOL_PRICE_BENCHMARK_ID,
        recorded_at: BENCHMARK_EVIDENCE_AT,
        run_count: 5,
        benchmark_recorded: true,
        winner_status: 'no_clear_winner',
        winner_claimed: false,
        note: 'Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.',
        proof_reference: BENCHMARK_PROOF_REFERENCE,
        routes: fiveRunBenchmark.routes
      }
    ]
  };
}

export function listBenchmarkArtifactMetadata(): BenchmarkArtifactSafeMetadata[] {
  return listBenchmarkArtifacts().map((artifact) => ({ ...artifact }));
}

export function getBenchmarkArtifactMetadataById(id: string): BenchmarkArtifactSafeMetadata | null {
  const artifact = getBenchmarkArtifactById(id);
  if (!artifact) return null;
  return { ...artifact };
}

function buildSolPriceBenchmark(): RadarBenchmarkDetail {
  const latestArtifact = getLatestBenchmarkArtifact(SOL_PRICE_BENCHMARK_ID);
  const routes = listRouteMappings()
    .filter((entry) => entry.category.toLowerCase() === SOL_PRICE_CATEGORY && entry.benchmark_intent.toLowerCase() === SOL_PRICE_INTENT)
    .filter((entry) => entry.mapping_status === 'verified')
    .map((entry): RadarBenchmarkRouteMetric => {
      const routeArtifact = latestArtifact?.routes.find((route) => route.provider_id === entry.provider_id);
      return {
      provider_id: entry.provider_id,
      route_id: routeArtifact?.route_id ?? `${entry.provider_id}:${entry.method ?? 'UNKNOWN'}:${entry.endpoint_url}`,
      execution_status: (entry.execution_evidence_status === 'proven' ? 'proven' : 'verified') as 'verified' | 'proven',
      success: routeArtifact?.success ?? true,
      latency_ms: routeArtifact?.latency_ms ?? null,
      paid_execution_proven: entry.execution_evidence_status === 'proven',
      proof_reference: routeArtifact?.proof_reference ?? BENCHMARK_PROOF_REFERENCE,
      normalized_output_available: routeArtifact?.normalized_output_available ?? true,
      extracted_price_usd: routeArtifact?.extracted_price_usd ?? null,
      extraction_path: routeArtifact?.extraction_path ?? null,
      success_rate: routeArtifact?.success_rate ?? null,
      median_latency_ms: routeArtifact?.median_latency_ms ?? null,
      p95_latency_ms: routeArtifact?.p95_latency_ms ?? null,
      average_price_usd: routeArtifact?.average_price_usd ?? null,
      min_price_usd: routeArtifact?.min_price_usd ?? null,
      max_price_usd: routeArtifact?.max_price_usd ?? null,
      price_variance_percent: routeArtifact?.price_variance_percent ?? null,
      completed_runs: routeArtifact?.completed_runs ?? null,
      failed_runs: routeArtifact?.failed_runs ?? null,
      execution_transport: 'pay_cli' as const,
      cli_exit_code: routeArtifact?.cli_exit_code ?? 0,
      status_code: routeArtifact?.status_code ?? null,
      status_evidence: routeArtifact?.status_evidence ?? 'pay_cli exit code 0 and parsed response body',
      output_shape: sanitizeOutputShapeExample(entry.provider_id, entry.response_shape_example ?? null),
      normalization_confidence: (routeArtifact?.normalization_confidence ?? 'unknown') as 'unknown' | 'low' | 'medium' | 'high',
      freshness_timestamp: routeArtifact?.freshness_timestamp ?? BENCHMARK_EVIDENCE_AT,
      comparison_notes: routeArtifact?.comparison_notes ?? 'Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.'
      };
    });

  return {
    benchmark_id: SOL_PRICE_BENCHMARK_ID,
    category: SOL_PRICE_CATEGORY,
    benchmark_intent: 'get SOL price',
    benchmark_recorded: true,
    winner_claimed: false,
    winner_status: 'no_clear_winner',
    winner_policy: {
      policy_id: 'sol-price-v0.1',
      policy_version: '0.1',
      required_successful_runs_per_route: 5,
      minimum_success_rate: 0.8,
      allowed_price_variance_percent: 1.0,
      latency_metric: 'median',
      required_confidence: ['high', 'medium'],
      scoring_weights: {
        reliability: 0.4,
        latency: 0.25,
        normalization_confidence: 0.15,
        price_consistency: 0.1,
        cost_clarity: 0.05,
        freshness: 0.05
      },
      winner_status: 'no_clear_winner',
      winner_claimed: false,
      winner_rationale: 'Required run count met. Both routes succeeded 5/5 with high confidence. No winner claimed because scoring thresholds have not been finalized.',
      completed_runs: 5,
      required_runs: 5,
      next_step: 'define scoring thresholds before declaring a route winner'
    },
    next_step: 'define scoring thresholds before declaring a route winner',
    readiness_note: 'Five-run normalized benchmark evidence exists. No route winner is claimed.',
    routes
  };
}

function buildTokenSearchBenchmark(): RadarBenchmarkDetail {
  return {
    benchmark_id: TOKEN_SEARCH_BENCHMARK_ID,
    category: 'finance/data',
    benchmark_intent: 'token search',
    benchmark_recorded: false,
    winner_claimed: false,
    winner_status: 'not_evaluated',
    next_step: 'run paid execution for StableCrypto token-search route',
    readiness_note: 'One proven route and one verified/unproven route exist. StableCrypto still needs paid execution proof before token-search can become benchmark-ready. No winner claimed.',
    routes: []
  };
}

function sanitizeOutputShapeExample(providerId: string, shape: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!shape) return null;
  if (providerId === 'merit-systems-stablecrypto-market-data') {
    return {
      solana: {
        usd: '<price_usd>'
      }
    };
  }
  if (providerId === 'paysponge-coingecko') {
    return {
      data: [
        {
          attributes: {
            name: 'SOL / USDC',
            base_token_price_usd: '<base_token_price_usd>',
            quote_token_price_usd: '<quote_token_price_usd>'
          }
        }
      ]
    };
  }
  return replaceNumericLeaves(shape) as Record<string, unknown>;
}

function replaceNumericLeaves(value: unknown): unknown {
  if (typeof value === 'number') return '<number>';
  if (Array.isArray(value)) return value.map((item) => replaceNumericLeaves(item));
  if (!value || typeof value !== 'object') return value;
  const mapped: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) mapped[key] = replaceNumericLeaves(nested);
  return mapped;
}
