import { RadarBenchmarkDetail, RadarBenchmarkList } from '../schemas/entities';
import { listRouteMappings } from './providerEndpointMap';

const SOL_PRICE_BENCHMARK_ID = 'finance-data-sol-price';
const SOL_PRICE_CATEGORY = 'finance/data';
const SOL_PRICE_INTENT = 'get sol price';
const PENDING_NOTE = 'Metrics pending. Normalized head-to-head extraction has not been recorded yet.';

export function buildRadarBenchmarks(): RadarBenchmarkList {
  const benchmark = buildSolPriceBenchmark();
  return {
    generated_at: new Date().toISOString(),
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
    .map((entry) => ({
      provider_id: entry.provider_id,
      route_id: `${entry.provider_id}:${entry.method ?? 'UNKNOWN'}:${entry.endpoint_url}`,
      execution_status: (entry.execution_evidence_status === 'proven' ? 'proven' : 'verified') as 'verified' | 'proven',
      latency_ms: null,
      paid_execution_proven: entry.execution_evidence_status === 'proven',
      proof_reference: entry.proof_reference ?? entry.proof_source,
      normalized_output_available: false,
      extracted_price_usd: null,
      output_shape: entry.response_shape_example ?? null,
      normalization_confidence: 'unknown' as const,
      freshness_timestamp: toIsoTimestamp(entry.verified_at),
      comparison_notes: PENDING_NOTE
    }));

  return {
    benchmark_id: SOL_PRICE_BENCHMARK_ID,
    category: SOL_PRICE_CATEGORY,
    benchmark_intent: 'get SOL price',
    benchmark_recorded: false,
    winner_claimed: false,
    next_step: 'run normalized head-to-head metric extraction',
    readiness_note: 'Two proven routes exist. This is readiness for comparison, not a superiority winner.',
    routes
  };
}

function toIsoTimestamp(value: string | undefined) {
  if (!value) return null;
  const timestamp = value.includes('T') ? value : `${value}T00:00:00.000Z`;
  return Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
}
