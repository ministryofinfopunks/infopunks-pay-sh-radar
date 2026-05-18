import {
  BenchmarkHistoryEntry,
  RadarBenchmarkDetail,
  RadarBenchmarkHistory,
  RadarBenchmarkHistoryAggregate,
  RadarBenchmarkHistoryV2Aggregate,
  RadarBenchmarkHistoryV2Detail,
  RadarBenchmarkHistoryV2Row,
  RadarBenchmarkList,
  RadarBenchmarkRouteMetric,
  RadarBenchmarkSummary
} from '../schemas/entities';
import { listRouteMappings } from './providerEndpointMap';
import { getBenchmarkArtifactById, getLatestBenchmarkArtifact, listBenchmarkArtifacts } from '../data/benchmarkArtifacts';

const SOL_PRICE_BENCHMARK_ID = 'finance-data-sol-price';
const SOL_PRICE_CATEGORY = 'finance/data';
const SOL_PRICE_INTENT = 'get sol price';
const TOKEN_SEARCH_BENCHMARK_ID = 'finance-data-token-search';
const TOKEN_SEARCH_CATEGORY = 'finance/data';
const TOKEN_SEARCH_INTENT = 'token search';
const TOKEN_METADATA_BENCHMARK_ID = 'finance-data-token-metadata';
const TOKEN_METADATA_CATEGORY = 'finance/data';
const TOKEN_METADATA_INTENT = 'token metadata';
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
    benchmarks: [buildSolPriceBenchmark(), buildTokenSearchBenchmark(), buildTokenMetadataBenchmark()]
  };
}

export function buildRadarBenchmarkSummary(): RadarBenchmarkSummary {
  const registry = buildRadarBenchmarks();
  const totalBenchmarks = Number.isFinite(registry.benchmarks.length) ? registry.benchmarks.length : 0;
  const recordedBenchmarkEntries = registry.benchmarks.flatMap((benchmark) => {
    const latestArtifact = getLatestBenchmarkArtifact(benchmark.benchmark_id);
    const benchmarkRecorded = benchmark.benchmark_recorded && latestArtifact?.aggregate_metrics?.benchmark_recorded === true;
    if (!benchmarkRecorded) return [];
    return {
      summary: {
        benchmark_id: benchmark.benchmark_id,
        label: benchmarkSummaryLabel(benchmark.benchmark_intent),
        status: 'recorded' as const,
        winner_status: latestArtifact.winner_status,
        winner_claimed: latestArtifact.winner_claimed === true,
        routes_count: latestArtifact.routes.length,
        recorded_runs: latestArtifact.total_runs
      },
      proven_routes_count: latestArtifact.routes.filter((route) => route.execution_status === 'proven' || route.paid_execution_proven).length,
    };
  });
  const benchmarks = recordedBenchmarkEntries.map((entry) => entry.summary);

  return {
    generated_at: registry.generated_at,
    source: registry.source,
    recorded_benchmarks: benchmarks.length,
    total_benchmarks: totalBenchmarks,
    winner_claimed: benchmarks.some((benchmark) => benchmark.winner_claimed),
    total_recorded_runs: benchmarks.reduce((total, benchmark) => total + benchmark.recorded_runs, 0),
    proven_routes: recordedBenchmarkEntries.reduce((total, entry) => total + entry.proven_routes_count, 0),
    benchmarks,
    agent_guidance: [
      'winner_claimed=false means no route winner should be inferred.',
      'winner_status=no_clear_winner means evidence exists but scoring thresholds do not crown a route.',
      'Use full benchmark endpoints for route-level metrics.'
    ]
  };
}

function benchmarkSummaryLabel(benchmarkIntent: string): string {
  const label = benchmarkIntent.replace(/^get\s+/i, '');
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

export function buildRadarBenchmarkById(id: string): RadarBenchmarkDetail | null {
  if (id === SOL_PRICE_BENCHMARK_ID) return buildSolPriceBenchmark();
  if (id === TOKEN_SEARCH_BENCHMARK_ID) return buildTokenSearchBenchmark();
  if (id === TOKEN_METADATA_BENCHMARK_ID) return buildTokenMetadataBenchmark();
  return null;
}

export function buildRadarBenchmarkHistoryById(id: string): RadarBenchmarkHistory | null {
  const benchmark = buildRadarBenchmarkById(id);
  if (!benchmark) return null;
  const artifacts = listBenchmarkArtifacts()
    .filter((artifact) => artifact.benchmark_id === id)
    .sort((a, b) => Date.parse(a.generated_at) - Date.parse(b.generated_at));
  if (!artifacts.length) {
    return {
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      benchmark_id: id,
      entries: []
    };
  }
  const latestArtifact = artifacts[artifacts.length - 1];
  const entries: BenchmarkHistoryEntry[] = artifacts.map((artifact) => ({
    benchmark_id: artifact.benchmark_id,
    recorded_at: artifact.generated_at,
    run_count: artifact.total_runs,
    benchmark_recorded: artifact.aggregate_metrics?.benchmark_recorded === true,
    winner_claimed: artifact.winner_claimed,
    winner_status: artifact.winner_status,
    note: artifact.notes,
    proof_reference: artifact.artifact_path,
    routes: artifact.routes.map((route) => ({
      provider_id: route.provider_id,
      route_id: route.route_id,
      execution_status: route.execution_status,
      success: route.success,
      latency_ms: route.latency_ms,
      paid_execution_proven: route.paid_execution_proven,
      proof_reference: route.proof_reference,
      normalized_output_available: route.normalized_output_available,
      extracted_price_usd: route.extracted_price_usd,
      extraction_path: route.extraction_path,
      success_rate: route.success_rate,
      median_latency_ms: route.median_latency_ms,
      p95_latency_ms: route.p95_latency_ms,
      average_price_usd: route.average_price_usd,
      min_price_usd: route.min_price_usd,
      max_price_usd: route.max_price_usd,
      price_variance_percent: route.price_variance_percent,
      completed_runs: route.completed_runs,
      failed_runs: route.failed_runs,
      execution_transport: route.execution_transport,
      cli_exit_code: route.cli_exit_code,
      status_code: route.status_code,
      status_evidence: route.status_evidence,
      output_shape: null,
      normalization_confidence: route.normalization_confidence,
      freshness_timestamp: route.freshness_timestamp,
      comparison_notes: route.comparison_notes
    }))
  }));

  return {
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    benchmark_id: id,
    entries,
    first_recorded_at: artifacts[0].generated_at,
    latest_recorded_at: latestArtifact.generated_at,
    artifact_count: artifacts.length,
    latest_artifact_id: latestArtifact.artifact_id,
    total_recorded_runs: artifacts.reduce((sum, artifact) => sum + artifact.total_runs, 0),
    routes_count: latestArtifact.routes.length,
    winner_status: latestArtifact.winner_status,
    winner_claimed: latestArtifact.winner_claimed,
    route_summaries: latestArtifact.routes.map((route) => ({
      provider_id: route.provider_id,
      route_id: route.route_id,
      latency_summary: {
        latest_latency_ms: route.latency_ms,
        median_latency_ms: route.median_latency_ms,
        p95_latency_ms: route.p95_latency_ms
      },
      reliability_summary: {
        success_rate: route.success_rate,
        completed_runs: route.completed_runs,
        failed_runs: route.failed_runs
      }
    }))
  };
}

export function buildRadarBenchmarkHistoryAggregate(): RadarBenchmarkHistoryAggregate {
  const benchmarkIds = buildRadarBenchmarks().benchmarks.map((row) => row.benchmark_id);
  const benchmarks = benchmarkIds
    .map((benchmarkId) => buildRadarBenchmarkHistoryById(benchmarkId))
    .filter((item): item is RadarBenchmarkHistory => !!item && !!item.first_recorded_at && !!item.latest_recorded_at && !!item.latest_artifact_id)
    .map((item) => ({
      benchmark_id: item.benchmark_id,
      first_recorded_at: item.first_recorded_at as string,
      latest_recorded_at: item.latest_recorded_at as string,
      artifact_count: item.artifact_count ?? 0,
      latest_artifact_id: item.latest_artifact_id as string,
      total_recorded_runs: item.total_recorded_runs ?? 0,
      routes_count: item.routes_count ?? 0,
      winner_status: item.winner_status ?? 'not_evaluated',
      winner_claimed: item.winner_claimed ?? false,
      route_summaries: item.route_summaries ?? []
    }));

  return {
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    benchmarks
  };
}

function benchmarkHistoryV2Label(benchmark: RadarBenchmarkDetail): string {
  return benchmarkSummaryLabel(benchmark.benchmark_intent);
}

export function buildRadarBenchmarkHistoryV2ById(id: string): RadarBenchmarkHistoryV2Detail | null {
  const benchmark = buildRadarBenchmarkById(id);
  if (!benchmark) return null;
  const artifacts = listBenchmarkArtifacts()
    .filter((artifact) => artifact.benchmark_id === id)
    .sort((a, b) => Date.parse(a.generated_at) - Date.parse(b.generated_at));
  const latestArtifact = artifacts[artifacts.length - 1] ?? null;
  const artifactRows = artifacts.map((artifact) => ({
    artifact_id: artifact.artifact_id,
    recorded_at: artifact.generated_at,
    recorded_runs: artifact.total_runs,
    routes_count: artifact.routes.length,
    winner_status: artifact.winner_status,
    winner_claimed: artifact.winner_claimed
  }));
  return {
    benchmark_id: id,
    label: benchmarkHistoryV2Label(benchmark),
    status: artifacts.length > 0 ? 'recorded' : 'planned',
    first_recorded_at: artifacts[0]?.generated_at ?? null,
    latest_recorded_at: latestArtifact?.generated_at ?? null,
    artifact_count: artifacts.length,
    artifacts: artifactRows,
    total_recorded_runs: artifacts.reduce((sum, artifact) => sum + artifact.total_runs, 0),
    routes_count: latestArtifact?.routes.length ?? 0,
    winner_status: latestArtifact?.winner_status ?? benchmark.winner_status ?? 'not_evaluated',
    winner_claimed: latestArtifact?.winner_claimed ?? benchmark.winner_claimed ?? false
  };
}

export function buildRadarBenchmarkHistoryV2Aggregate(): RadarBenchmarkHistoryV2Aggregate {
  const rows: RadarBenchmarkHistoryV2Row[] = buildRadarBenchmarks().benchmarks
    .map((benchmark) => buildRadarBenchmarkHistoryV2ById(benchmark.benchmark_id))
    .filter((row): row is RadarBenchmarkHistoryV2Detail => !!row)
    .filter((row) => row.artifact_count > 0)
    .map((row) => ({
      benchmark_id: row.benchmark_id,
      label: row.label,
      status: row.status,
      first_recorded_at: row.first_recorded_at,
      latest_recorded_at: row.latest_recorded_at,
      artifact_count: row.artifact_count,
      latest_artifact_id: row.artifacts[row.artifacts.length - 1]?.artifact_id ?? null,
      total_recorded_runs: row.total_recorded_runs,
      routes_count: row.routes_count,
      winner_status: row.winner_status,
      winner_claimed: row.winner_claimed
    }));
  return {
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    history_count: rows.length,
    total_artifacts: rows.reduce((sum, row) => sum + row.artifact_count, 0),
    total_recorded_runs: rows.reduce((sum, row) => sum + row.total_recorded_runs, 0),
    winner_claimed: rows.some((row) => row.winner_claimed),
    benchmarks: rows
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
  const latestArtifact = getLatestBenchmarkArtifact(TOKEN_SEARCH_BENCHMARK_ID);
  const benchmarkRecorded = latestArtifact?.aggregate_metrics?.benchmark_recorded === true;
  const routes = listRouteMappings()
    .filter((entry) => entry.category.toLowerCase() === TOKEN_SEARCH_CATEGORY && entry.benchmark_intent.toLowerCase() === TOKEN_SEARCH_INTENT)
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
        proof_reference: routeArtifact?.proof_reference ?? 'live-proofs/stablecrypto-token-search-paid-execution-2026-05-17.md',
        normalized_output_available: routeArtifact?.normalized_output_available ?? benchmarkRecorded,
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
        freshness_timestamp: routeArtifact?.freshness_timestamp ?? latestArtifact?.generated_at ?? null,
        comparison_notes: routeArtifact?.comparison_notes ?? 'Token-search benchmark recorded. No route winner is claimed. Scoring thresholds are not finalized.'
      };
    });

  return {
    benchmark_id: TOKEN_SEARCH_BENCHMARK_ID,
    category: TOKEN_SEARCH_CATEGORY,
    benchmark_intent: TOKEN_SEARCH_INTENT,
    benchmark_recorded: benchmarkRecorded,
    winner_claimed: false,
    winner_status: latestArtifact?.winner_status ?? 'not_evaluated',
    next_step: benchmarkRecorded ? 'define scoring thresholds before declaring a route winner' : 'run normalized token-search benchmark',
    readiness_note: benchmarkRecorded
      ? 'Five-run normalized benchmark evidence exists. No route winner is claimed.'
      : 'Two proven token-search routes exist. Token-search is ready for a normalized benchmark run. No winner claimed.',
    routes: benchmarkRecorded ? routes : []
  };
}

function buildTokenMetadataBenchmark(): RadarBenchmarkDetail {
  return {
    benchmark_id: TOKEN_METADATA_BENCHMARK_ID,
    category: TOKEN_METADATA_CATEGORY,
    benchmark_intent: TOKEN_METADATA_INTENT,
    benchmark_recorded: false,
    winner_claimed: false,
    winner_status: 'not_evaluated',
    next_step: 'verify endpoint/method/request shape for token metadata candidates',
    readiness_note: 'Candidate token metadata mappings exist, but endpoint/method/request-shape verification is not recorded yet. Not benchmark-ready. No winner claimed.',
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
