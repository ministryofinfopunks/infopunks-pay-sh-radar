import { RadarBenchmarkDetail, RadarBenchmarkList } from '../schemas/entities';
import { listRouteMappings } from './providerEndpointMap';

const SOL_PRICE_BENCHMARK_ID = 'finance-data-sol-price';
const SOL_PRICE_CATEGORY = 'finance/data';
const SOL_PRICE_INTENT = 'get sol price';
const BENCHMARK_EVIDENCE_AT = '2026-05-16T07:42:42.271Z';
const BENCHMARK_PROOF_REFERENCE = 'live-proofs/finance-data-sol-price-benchmark-runs-2026-05-16.md';
const PAY_CLI_STATUS_EVIDENCE = 'pay_cli exit code 0 and parsed response body';

export function buildRadarBenchmarks(): RadarBenchmarkList {
  const benchmark = buildSolPriceBenchmark();
  return {
    generated_at: BENCHMARK_EVIDENCE_AT,
    source: 'infopunks-pay-sh-radar',
    benchmarks: [benchmark]
  };
}

export function buildRadarBenchmarkById(id: string): RadarBenchmarkDetail | null {
  if (id !== SOL_PRICE_BENCHMARK_ID) return null;
  return buildSolPriceBenchmark();
}

function buildSolPriceBenchmark(): RadarBenchmarkDetail {
  const routes = listRouteMappings()
    .filter((entry) => entry.category.toLowerCase() === SOL_PRICE_CATEGORY && entry.benchmark_intent.toLowerCase() === SOL_PRICE_INTENT)
    .filter((entry) => entry.mapping_status === 'verified')
    .map((entry) => {
      const isStable = entry.provider_id === 'merit-systems-stablecrypto-market-data';
      const isPaySponge = entry.provider_id === 'paysponge-coingecko';
      return {
      provider_id: entry.provider_id,
      route_id: `${entry.provider_id}:${entry.method ?? 'UNKNOWN'}:${entry.endpoint_url}`,
      execution_status: (entry.execution_evidence_status === 'proven' ? 'proven' : 'verified') as 'verified' | 'proven',
      success: true,
      latency_ms: isStable ? 5691 : isPaySponge ? 7761 : null,
      paid_execution_proven: entry.execution_evidence_status === 'proven',
      proof_reference: isStable
        ? 'live-proofs/stablecrypto-harness-pay-cli-2026-05-12.md'
        : isPaySponge
          ? 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md'
          : BENCHMARK_PROOF_REFERENCE,
      normalized_output_available: true,
      extracted_price_usd: isStable ? 87.57 : isPaySponge ? 87.50392093173244 : null,
      extraction_path: isStable ? 'solana.usd' : isPaySponge ? 'data[sol_usdc].attributes.base_token_price_usd' : null,
      success_rate: isStable || isPaySponge ? 1 : null,
      median_latency_ms: isStable ? 5691 : isPaySponge ? 7761 : null,
      p95_latency_ms: isStable ? 6469 : isPaySponge ? 7946 : null,
      average_price_usd: isStable ? 87.57 : isPaySponge ? 87.50392093173244 : null,
      min_price_usd: isStable ? 87.57 : isPaySponge ? 87.50332626375734 : null,
      max_price_usd: isStable ? 87.57 : isPaySponge ? 87.50629960363277 : null,
      price_variance_percent: isStable ? 0 : isPaySponge ? 0.0033979504504081403 : null,
      completed_runs: isStable || isPaySponge ? 5 : null,
      failed_runs: isStable || isPaySponge ? 0 : null,
      execution_transport: 'pay_cli' as const,
      cli_exit_code: 0,
      status_code: null,
      status_evidence: PAY_CLI_STATUS_EVIDENCE,
      output_shape: sanitizeOutputShapeExample(entry.provider_id, entry.response_shape_example ?? null),
      normalization_confidence: (isStable || isPaySponge ? 'high' : 'unknown') as 'unknown' | 'low' | 'medium' | 'high',
      freshness_timestamp: BENCHMARK_EVIDENCE_AT,
      comparison_notes: 'Five-run benchmark recorded. Both routes succeeded. No winner is claimed until scoring thresholds are finalized.'
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
