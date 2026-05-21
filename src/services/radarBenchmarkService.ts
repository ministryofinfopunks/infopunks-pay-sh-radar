import {
  BenchmarkHistoryEntry,
  RadarBenchmarkDetail,
  RadarBenchmarkHistory,
  RadarBenchmarkHistoryAggregate,
  RadarBenchmarkHistoryV2Aggregate,
  RadarBenchmarkHistoryV2Detail,
  RadarBenchmarkHistoryV2Row,
  RadarEvidenceCaveat,
  RadarBenchmarkRouteHistoryAggregate,
  RadarBenchmarkRouteHistoryDetail,
  RadarBenchmarkList,
  RadarBenchmarkRouteMetric,
  RadarBenchmarkSummary,
  RadarEvidenceLedger,
  RadarEvidenceLedgerBrief
} from '../schemas/entities';
import { listRouteMappings } from './providerEndpointMap';
import { BenchmarkArtifactRecord, BenchmarkArtifactRoute, getBenchmarkArtifactById, getLatestBenchmarkArtifact, listBenchmarkArtifacts } from '../data/benchmarkArtifacts';

const SOL_PRICE_BENCHMARK_ID = 'finance-data-sol-price';
const SOL_PRICE_CATEGORY = 'finance/data';
const SOL_PRICE_INTENT = 'get sol price';
const TOKEN_SEARCH_BENCHMARK_ID = 'finance-data-token-search';
const TOKEN_SEARCH_CATEGORY = 'finance/data';
const TOKEN_SEARCH_INTENT = 'token search';
const TOKEN_METADATA_BENCHMARK_ID = 'finance-data-token-metadata';
const TOKEN_METADATA_CATEGORY = 'finance/data';
const TOKEN_METADATA_INTENT = 'token metadata';
const COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID = 'communications-email-delivery';
const COMMUNICATIONS_EMAIL_DELIVERY_CATEGORY = 'communications';
const COMMUNICATIONS_EMAIL_DELIVERY_INTENT = 'send or queue canonical plain-text email';
const SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID = 'solana-infra-account-balance';
const SOLANA_INFRA_ACCOUNT_BALANCE_CATEGORY = 'solana-infra';
const SOLANA_INFRA_ACCOUNT_BALANCE_INTENT = 'fetch native SOL balance for the same public Solana address';
const SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID = 'social-data-reddit-post-search';
const SOCIAL_DATA_REDDIT_POST_SEARCH_CATEGORY = 'social-data';
const SOCIAL_DATA_REDDIT_POST_SEARCH_INTENT = 'search Reddit posts for the same keyword query';
const DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID = 'document-ocr-text-extraction';
const DOCUMENT_OCR_TEXT_EXTRACTION_CATEGORY = 'document-ai';
const DOCUMENT_OCR_TEXT_EXTRACTION_INTENT = 'extract text from the same simple document/image fixture';
const DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID = 'data-web-search-results';
const DATA_WEB_SEARCH_RESULTS_CATEGORY = 'web-search';
const DATA_WEB_SEARCH_RESULTS_INTENT = 'search the web for the same query and return normalized search results';
const MAPS_PLACE_SEARCH_RESULTS_BENCHMARK_ID = 'maps-place-search-results';
const MAPS_PLACE_SEARCH_RESULTS_CATEGORY = 'maps';
const MAPS_PLACE_SEARCH_RESULTS_INTENT = 'search for the same local/place query and return normalized place candidates';
const AUDIO_SPEECH_TRANSCRIPTION_BENCHMARK_ID = 'audio-speech-transcription';
const AUDIO_SPEECH_TRANSCRIPTION_CATEGORY = 'audio-ai';
const AUDIO_SPEECH_TRANSCRIPTION_INTENT = 'transcribe the same short audio fixture into normalized text';
const BENCHMARK_EVIDENCE_AT = '2026-05-16T07:42:42.271Z';
const BENCHMARK_PROOF_REFERENCE = 'live-proofs/finance-data-sol-price-benchmark-runs-2026-05-16.md';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
type EvidenceHealth = 'recorded' | 'caveated' | 'stale' | 'degraded' | 'unverified' | 'scaffold';

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
    benchmarks: [
      buildSolPriceBenchmark(),
      buildTokenSearchBenchmark(),
      buildTokenMetadataBenchmark(),
      buildCommunicationsEmailDeliveryBenchmark(),
      buildSolanaInfraAccountBalanceBenchmark(),
      buildSocialDataRedditPostSearchBenchmark(),
      buildDocumentOcrTextExtractionBenchmark(),
      buildDataWebSearchResultsBenchmark(),
      buildMapsPlaceSearchResultsBenchmark(),
      buildAudioSpeechTranscriptionBenchmark()
    ]
  };
}

export function buildRadarBenchmarkSummary(): RadarBenchmarkSummary {
  const registry = buildRadarBenchmarks();
  const generatedAt = new Date().toISOString();
  const totalBenchmarks = Number.isFinite(registry.benchmarks.length) ? registry.benchmarks.length : 0;
  const recordedBenchmarkEntries = registry.benchmarks.flatMap((benchmark) => {
    const latestArtifact = getLatestBenchmarkArtifact(benchmark.benchmark_id);
    const benchmarkRecorded = benchmark.benchmark_recorded && latestArtifact?.aggregate_metrics?.benchmark_recorded === true;
    if (!benchmarkRecorded) return [];
    return {
      summary: {
        benchmark_id: benchmark.benchmark_id,
        label: benchmarkSummaryLabel(benchmark.benchmark_id, benchmark.benchmark_intent),
        description: benchmarkSummaryDescription(benchmark.benchmark_id),
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
  const recordedBenchmarkIds = new Set(benchmarks.map((benchmark) => benchmark.benchmark_id));
  const recordedArtifacts = listBenchmarkArtifacts().filter((artifact) => recordedBenchmarkIds.has(artifact.benchmark_id));
  const totalRecordedRuns = recordedArtifacts
    .reduce((total, artifact) => total + artifact.total_runs, 0);
  const latestRecordedAt = recordedArtifacts.length
    ? recordedArtifacts.reduce((latest, artifact) => (
      Date.parse(artifact.generated_at) > Date.parse(latest) ? artifact.generated_at : latest
    ), recordedArtifacts[0].generated_at)
    : null;

  return {
    generated_at: generatedAt,
    source: registry.source,
    latest_recorded_at: latestRecordedAt,
    total_artifacts: recordedArtifacts.length,
    recorded_benchmarks: benchmarks.length,
    total_benchmarks: totalBenchmarks,
    winner_claimed: benchmarks.some((benchmark) => benchmark.winner_claimed),
    total_recorded_runs: totalRecordedRuns,
    proven_routes: recordedBenchmarkEntries.reduce((total, entry) => total + entry.proven_routes_count, 0),
    benchmarks,
    agent_guidance: [
      'winner_claimed=false means no route winner should be inferred.',
      'winner_status=no_clear_winner means evidence exists but scoring thresholds do not crown a route.',
      'Use full benchmark endpoints for route-level metrics.'
    ]
  };
}

export function buildRadarEvidenceLedger(): RadarEvidenceLedger {
  const summary = buildRadarBenchmarkSummary();
  const history = buildRadarBenchmarkHistoryV2Aggregate();
  const caveatTotals = {
    recorded: 0,
    caveated: 0,
    stale: 0,
    degraded: 0,
    unverified: 0,
    scaffold: 0
  };

  const recordedLanes = summary.benchmarks.map((row) => {
    const detail = buildRadarBenchmarkHistoryV2ById(row.benchmark_id);
    const routeAggregate = buildRadarBenchmarkRouteHistoryByBenchmarkId(row.benchmark_id);
    const latestArtifact = getLatestBenchmarkArtifact(row.benchmark_id);
    const evidenceHealth = {
      recorded: 0,
      caveated: 0,
      stale: 0,
      degraded: 0,
      unverified: 0,
      scaffold: 0
    };
    for (const route of routeAggregate?.routes ?? []) {
      evidenceHealth[route.evidence_health] += 1;
      caveatTotals[route.evidence_health] += 1;
    }
    return {
      benchmark_id: row.benchmark_id,
      label: row.label,
      ...(row.description ? { description: row.description } : {}),
      status: 'recorded' as const,
      artifact_count: detail?.artifact_count ?? 0,
      recorded_runs: detail?.total_recorded_runs ?? row.recorded_runs,
      routes_count: detail?.routes_count ?? row.routes_count,
      proven_routes_count: latestArtifact?.routes.filter((route) => route.execution_status === 'proven' || route.paid_execution_proven === true).length ?? 0,
      winner_status: row.winner_status,
      winner_claimed: row.winner_claimed,
      latest_artifact_id: detail?.artifacts[detail.artifacts.length - 1]?.artifact_id ?? null,
      latest_recorded_at: detail?.latest_recorded_at ?? null,
      evidence_health_summary: evidenceHealth,
      routes_endpoint: `/v1/radar/benchmark-history/${row.benchmark_id}/routes`
    };
  });

  const scaffoldLanes = [
    {
      benchmark_id: 'communications-email-delivery',
      label: 'Communications Email Delivery',
      status: 'scaffold' as const,
      promotion_status: 'blocked' as const,
      why_not_promoted: [
        'StableEmail paid-executed and caveated.',
        'AgentMail blocked / no second comparable route.',
        'No benchmark artifact exists.'
      ],
      missing_requirements: ['second comparable paid-proven route', '5-run benchmark artifact'],
      known_evidence: [
        'StableEmail verified/proven with caveats preserved.',
        'AgentMail path blocked during comparable proof phase.'
      ]
    },
    {
      benchmark_id: 'solana-infra-account-balance',
      label: 'Solana Infra Account Balance',
      status: 'scaffold' as const,
      promotion_status: 'blocked' as const,
      why_not_promoted: [
        'QuickNode unpaid 402 confirmed.',
        'QuickNode paid run failed.',
        'No second comparable route.',
        'No benchmark artifact exists.'
      ],
      missing_requirements: ['second comparable paid-proven route', '5-run benchmark artifact'],
      known_evidence: [
        'QuickNode unpaid behavior confirmed with 402.',
        'Paid proof did not complete benchmark-grade execution.'
      ]
    },
    {
      benchmark_id: 'social-data-reddit-post-search',
      label: 'Social Data Reddit Post Search',
      status: 'scaffold' as const,
      promotion_status: 'blocked' as const,
      why_not_promoted: [
        'StableEnrich paid-proven but caveated.',
        'StableSocial paid-compatible but semantic proof failed.',
        'No second paid-proven comparable route.',
        'No benchmark artifact exists.'
      ],
      missing_requirements: ['second comparable paid-proven route', '5-run benchmark artifact'],
      known_evidence: [
        'StableEnrich paid path preserved with caveats.',
        'StableSocial semantic proof did not satisfy comparable benchmark bar.'
      ]
    },
    {
      benchmark_id: 'maps-place-search-results',
      label: 'Maps Place Search Results',
      status: 'scaffold' as const,
      promotion_status: 'blocked' as const,
      why_not_promoted: [
        'StableEnrich paid-executed and paid-proven recognizable place-search candidates, but evidence is degraded: names/addresses/coordinates missing and location not confirmed.',
        'Google Places paid-executed and later received one paid diagnostic retry with includedType=cafe, but still returned zero recognizable place candidates.',
        'No second paid-proven comparable place-search route yet.',
        'No benchmark artifact exists.'
      ],
      missing_requirements: ['second comparable paid-proven route', '5-run benchmark artifact'],
      known_evidence: [
        'StableEnrich Google Maps Text Search paid execution succeeded with result_count=5 and recognizable place-search semantics, but evidence_health is degraded (missing place names/addresses/coordinates and location confirmation failed).',
        'Google Places SearchText paid execution succeeded; a paid diagnostic retry (selected_paid_retry_variant=textQuery+maxResultCount+includedType, includedType=cafe, paid_retry_count=1) also succeeded, but both returned result_count=0 with no recognizable place candidates.',
        'Canonical input: {"query":"coffee near Union Square San Francisco","location":"Union Square, San Francisco, CA","limit":5}.'
      ]
    },
    {
      benchmark_id: AUDIO_SPEECH_TRANSCRIPTION_BENCHMARK_ID,
      label: 'Audio Speech Transcription',
      status: 'scaffold' as const,
      promotion_status: 'blocked' as const,
      why_not_promoted: [
        'Google Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven.',
        'Alibaba Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven.',
        'Both routes remain candidate/unproven with degraded evidence.',
        'No benchmark artifact exists.'
      ],
      missing_requirements: [
        'route schema/output change or different comparable transcription provider',
        'two comparable paid-proven routes with transcript semantics proven on canonical fixture',
        '5-run benchmark artifact'
      ],
      known_evidence: [
        'Canonical fixture observed live (HTTP 200, content-type audio/x-wav, WAV PCM 16-bit mono 22050 Hz, 224258 bytes).',
        'Google Speech and Alibaba Speech paid execution both succeeded on 2026-05-21 and each received one shape diagnostic paid retry, but transcript semantics were still not proven for canonical phrase.',
        'Canonical phrase: INFOPUNKS RADAR / EVIDENCE BEFORE SPEND / AUDIO BENCHMARK 001.'
      ]
    }
  ];

  const latestArtifacts = [...history.benchmarks]
    .sort((a, b) => Date.parse(b.latest_recorded_at ?? '') - Date.parse(a.latest_recorded_at ?? ''))
    .map((row) => {
      const latestArtifact = row.latest_artifact_id ? getBenchmarkArtifactById(row.latest_artifact_id) : getLatestBenchmarkArtifact(row.benchmark_id);
      return {
        artifact_id: latestArtifact?.artifact_id ?? row.latest_artifact_id ?? '',
        benchmark_id: row.benchmark_id,
        label: row.label,
        recorded_at: latestArtifact?.generated_at ?? row.latest_recorded_at ?? new Date(0).toISOString(),
        recorded_runs: latestArtifact?.total_runs ?? 0,
        routes_count: latestArtifact?.routes.length ?? row.routes_count,
        winner_claimed: latestArtifact?.winner_claimed ?? row.winner_claimed,
        winner_status: latestArtifact?.winner_status ?? row.winner_status
      };
    })
    .filter((row) => row.artifact_id && row.recorded_at !== new Date(0).toISOString());

  return {
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    ledger_state: {
      recorded_benchmarks: summary.recorded_benchmarks,
      total_benchmarks: summary.total_benchmarks,
      total_artifacts: summary.total_artifacts,
      total_recorded_runs: summary.total_recorded_runs,
      proven_routes: summary.proven_routes,
      winner_claimed: summary.winner_claimed,
      latest_recorded_at: summary.latest_recorded_at
    },
    doctrine: {
      spend_rail: 'Pay.sh',
      evidence_ledger: 'Radar',
      proof_adapter: 'Agent Harness',
      summary: 'Radar records evidence before agents spend. It preserves caveats, route timelines, artifacts, and no-winner benchmark state.'
    },
    agent_guidance: [
      'winner_claimed=false means no route winner should be inferred.',
      'Recorded benchmarks mean paid route evidence exists.',
      'Scaffold lanes were explored but did not meet the hard bar for benchmark recording.',
      'Recorded lanes contain artifact-backed evidence. Scaffold lanes preserve blocked or insufficient evidence.',
      'Use route timelines and caveat_objects before selecting a route.',
      'Radar does not execute paid APIs. The Agent Harness generates paid proof artifacts.'
    ],
    recorded_lanes: recordedLanes,
    scaffold_lanes: scaffoldLanes,
    latest_artifacts: latestArtifacts,
    route_timeline_entrypoints: summary.benchmarks.map((row) => ({
      benchmark_id: row.benchmark_id,
      routes_endpoint: `/v1/radar/benchmark-history/${row.benchmark_id}/routes`,
      route_detail_note: 'URL-encode route_id when calling route detail endpoints.'
    })),
    caveat_summary: {
      policy: 'Caveats are preserved and should be inspected before route selection.',
      common_codes: [
        'pay_cli_status_hidden',
        'canonical_network_mismatch',
        'metadata_semantics_partial',
        'no_posts_returned',
        'reddit_search_semantics_partial',
        'native_balance_missing'
      ]
    }
  };
}

export function buildRadarEvidenceLedgerBrief(): RadarEvidenceLedgerBrief {
  const ledger = buildRadarEvidenceLedger();
  const latestArtifactRunsByBenchmarkId = new Map(
    ledger.latest_artifacts.map((artifact) => [artifact.benchmark_id, artifact.recorded_runs])
  );

  return {
    ledger_state: {
      ...ledger.ledger_state,
      scaffold_lanes: ledger.scaffold_lanes.length
    },
    recorded_lanes: ledger.recorded_lanes.map((lane) => {
      const latestArtifactRecordedRuns = latestArtifactRunsByBenchmarkId.get(lane.benchmark_id) ?? lane.recorded_runs;
      return {
        benchmark_id: lane.benchmark_id,
        label: lane.label,
        latest_artifact_id: lane.latest_artifact_id,
        latest_artifact_recorded_runs: latestArtifactRecordedRuns,
        total_recorded_runs: lane.recorded_runs,
        recorded_runs: latestArtifactRecordedRuns,
        routes_count: lane.routes_count,
        winner_claimed: lane.winner_claimed,
        winner_status: lane.winner_status
      };
    }),
    scaffold_lanes: ledger.scaffold_lanes.map((lane) => ({
      benchmark_id: lane.benchmark_id,
      label: lane.label,
      reason: lane.why_not_promoted[0] ?? 'Benchmark lane is not recorded.',
      next_step: lane.missing_requirements[0] ?? 'Inspect benchmark details before spend.'
    })),
    recommended_agent_action: 'Inspect the relevant benchmark history and route timeline before spend.',
    agent_guidance: [
      'Recorded lanes contain artifact-backed route evidence.',
      'Scaffold lanes preserve blocked or insufficient comparable paid evidence.',
      'winner_claimed=false means no route winner should be inferred.',
      'Agents should inspect route-level caveats before spending.'
    ],
    winner_claimed: ledger.ledger_state.winner_claimed
  };
}

function benchmarkSummaryLabel(benchmarkId: string, benchmarkIntent: string): string {
  if (benchmarkId === DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID) return 'Web Search Results';
  if (benchmarkId === DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID) return 'Document OCR Text Extraction';
  const label = benchmarkIntent.replace(/^get\s+/i, '');
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function benchmarkSummaryDescription(benchmarkId: string): string | undefined {
  if (benchmarkId === DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID) {
    return 'Search the web for the same query and return normalized search results.';
  }
  if (benchmarkId === DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID) {
    return 'Extract text from the same simple document/image fixture.';
  }
  if (benchmarkId === AUDIO_SPEECH_TRANSCRIPTION_BENCHMARK_ID) {
    return 'Transcribe the same short audio fixture into normalized text.';
  }
  return undefined;
}

export function buildRadarBenchmarkById(id: string): RadarBenchmarkDetail | null {
  if (id === SOL_PRICE_BENCHMARK_ID) return buildSolPriceBenchmark();
  if (id === TOKEN_SEARCH_BENCHMARK_ID) return buildTokenSearchBenchmark();
  if (id === TOKEN_METADATA_BENCHMARK_ID) return buildTokenMetadataBenchmark();
  if (id === COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID) return buildCommunicationsEmailDeliveryBenchmark();
  if (id === SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID) return buildSolanaInfraAccountBalanceBenchmark();
  if (id === SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID) return buildSocialDataRedditPostSearchBenchmark();
  if (id === DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID) return buildDocumentOcrTextExtractionBenchmark();
  if (id === DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID) return buildDataWebSearchResultsBenchmark();
  if (id === MAPS_PLACE_SEARCH_RESULTS_BENCHMARK_ID) return buildMapsPlaceSearchResultsBenchmark();
  if (id === AUDIO_SPEECH_TRANSCRIPTION_BENCHMARK_ID) return buildAudioSpeechTranscriptionBenchmark();
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
  return benchmarkSummaryLabel(benchmark.benchmark_id, benchmark.benchmark_intent);
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

export function buildRadarBenchmarkRouteHistoryByBenchmarkId(id: string): RadarBenchmarkRouteHistoryAggregate | null {
  const benchmark = buildRadarBenchmarkById(id);
  if (!benchmark) return null;
  const artifacts = benchmarkArtifactsByRecordedAt(id);
  const routeIds = [...new Set(artifacts.flatMap((artifact) => artifact.routes.map((route) => route.route_id)))];
  const routes = routeIds.map((routeId) => {
    const routeTimeline = routeTimelineForRoute(artifacts, routeId);
    const latest = routeTimeline[routeTimeline.length - 1];
    const caveatObjects = routeCaveatObjects(latest.artifact, latest.route);
    return {
      route_id: routeId,
      provider_id: latest.route.provider_id,
      label: routeHistoryLabel(latest.route),
      artifact_count: routeTimeline.length,
      first_recorded_at: routeTimeline[0].artifact.generated_at,
      latest_recorded_at: latest.artifact.generated_at,
      latest_artifact_id: latest.artifact.artifact_id,
      latest_success_count: latest.route.completed_runs,
      latest_failure_count: latest.route.failed_runs,
      latest_median_latency_ms: latest.route.median_latency_ms,
      latest_p95_latency_ms: latest.route.p95_latency_ms,
      latest_detection_rate: routeDetectionRate(latest.artifact, latest.route),
      winner_status: latest.artifact.winner_status,
      winner_claimed: latest.artifact.winner_claimed === true,
      evidence_health: resolveEvidenceHealth({
        benchmarkId: id,
        artifact: latest.artifact,
        route: latest.route,
        latestRecordedAt: latest.artifact.generated_at,
        caveatObjects
      }),
      caveats: routeCaveats(latest.artifact, latest.route),
      caveat_objects: caveatObjects
    };
  });
  return {
    benchmark_id: id,
    label: benchmarkHistoryV2Label(benchmark),
    route_count: routes.length,
    artifact_count: artifacts.length,
    winner_claimed: artifacts.some((artifact) => artifact.winner_claimed === true),
    routes
  };
}

export function buildRadarBenchmarkRouteHistoryDetail(id: string, routeId: string): RadarBenchmarkRouteHistoryDetail | null {
  const aggregate = buildRadarBenchmarkRouteHistoryByBenchmarkId(id);
  if (!aggregate) return null;
  const artifacts = benchmarkArtifactsByRecordedAt(id);
  const routeTimeline = routeTimelineForRoute(artifacts, routeId);
  if (!routeTimeline.length) return null;
  const firstRoute = routeTimeline[0].route;
  const latestTimeline = routeTimeline[routeTimeline.length - 1];
  const latestCaveatObjects = routeCaveatObjects(latestTimeline.artifact, latestTimeline.route);
  return {
    benchmark_id: id,
    route_id: routeId,
    provider_id: firstRoute.provider_id,
    label: routeHistoryLabel(firstRoute),
    artifact_count: routeTimeline.length,
    winner_claimed: routeTimeline.some(({ artifact }) => artifact.winner_claimed === true),
    evidence_health: resolveEvidenceHealth({
      benchmarkId: id,
      artifact: latestTimeline.artifact,
      route: latestTimeline.route,
      latestRecordedAt: latestTimeline.artifact.generated_at,
      caveatObjects: latestCaveatObjects
    }),
    timeline: routeTimeline.map(({ artifact, route }) => {
      const caveatObjects = routeCaveatObjects(artifact, route);
      return {
        artifact_id: artifact.artifact_id,
        recorded_at: artifact.generated_at,
        success_count: route.completed_runs,
        failure_count: route.failed_runs,
        median_latency_ms: route.median_latency_ms,
        p95_latency_ms: route.p95_latency_ms,
        status_code: route.status_code,
        status_evidence: route.status_evidence,
        winner_status: artifact.winner_status,
        winner_claimed: artifact.winner_claimed === true,
        evidence_health: resolveEvidenceHealth({
          benchmarkId: id,
          artifact,
          route,
          latestRecordedAt: artifact.generated_at,
          caveatObjects
        }),
        metrics: routeHistoryMetrics(artifact, route),
        caveats: routeCaveats(artifact, route),
        caveat_objects: caveatObjects
      };
    })
  };
}

function benchmarkArtifactsByRecordedAt(benchmarkId: string): BenchmarkArtifactRecord[] {
  return listBenchmarkArtifacts()
    .filter((artifact) => artifact.benchmark_id === benchmarkId)
    .sort((a, b) => Date.parse(a.generated_at) - Date.parse(b.generated_at));
}

function routeTimelineForRoute(artifacts: BenchmarkArtifactRecord[], routeId: string) {
  return artifacts.flatMap((artifact) => {
    const route = artifact.routes.find((item) => item.route_id === routeId);
    return route ? [{ artifact, route }] : [];
  });
}

function routeHistoryLabel(route: BenchmarkArtifactRoute): string {
  if (route.route_id === 'stableenrich-exa-search:POST:/api/exa/search') return 'StableEnrich Exa Search';
  if (route.route_id === 'perplexity-search:POST:/api/search') return 'Perplexity Search';
  if (route.route_id === 'paysponge-reducto:POST:/parse') return 'PaySponge Reducto';
  if (route.route_id === 'google-vision:POST:/v1/images:annotate') return 'Google Vision OCR';
  return route.provider_id.replaceAll('-', ' ');
}

function routeDetectionRate(artifact: BenchmarkArtifactRecord, route: BenchmarkArtifactRoute): number | null {
  const metrics = routeHistoryMetrics(artifact, route);
  return metrics.normalized_metadata_detection_rate ?? metrics.token_search_detection_rate ?? route.success_rate;
}

function routeHistoryMetrics(artifact: BenchmarkArtifactRecord, route: BenchmarkArtifactRoute): Record<string, number | null> {
  const metricNames = [
    'normalized_metadata_detection_rate',
    'token_search_detection_rate',
    'ocr_success_rate',
    'expected_fragment_match_rate_avg',
    'canonical_address_match_rate',
    'canonical_network_match_rate',
    'canonical_decimals_match_rate'
  ];
  return Object.fromEntries(metricNames.flatMap((metricName) => {
    const value = resolveRouteMetric(artifact.aggregate_metrics[metricName], route.provider_id);
    return value === undefined ? [] : [[metricName, value]];
  }));
}

function resolveRouteMetric(value: unknown, providerId: string): number | null | undefined {
  if (typeof value === 'number') return value;
  if (value === null) return null;
  if (!value || typeof value !== 'object') return undefined;
  const providerMetric = (value as Record<string, unknown>)[providerMetricKey(providerId)];
  if (typeof providerMetric === 'number') return providerMetric;
  return providerMetric === null ? null : undefined;
}

function providerMetricKey(providerId: string): string {
  return providerId.replaceAll('-', '_');
}

function routeCaveats(artifact: BenchmarkArtifactRecord, route: BenchmarkArtifactRoute): string[] {
  const caveats: string[] = [];
  const canonicalNetworkMatchRate = resolveRouteMetric(artifact.aggregate_metrics.canonical_network_match_rate, route.provider_id);
  if (canonicalNetworkMatchRate === 0) caveats.push('canonical_network_match_rate=0.0 preserved from benchmark artifact');
  if (artifact.benchmark_id === DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID && route.status_code === null) {
    caveats.push('status_code_unavailable');
  }
  return caveats;
}

function routeCaveatObjects(artifact: BenchmarkArtifactRecord, route: BenchmarkArtifactRoute): RadarEvidenceCaveat[] {
  const caveatObjects: RadarEvidenceCaveat[] = [];
  const canonicalNetworkMatchRate = resolveRouteMetric(artifact.aggregate_metrics.canonical_network_match_rate, route.provider_id);
  if (canonicalNetworkMatchRate === 0) {
    caveatObjects.push({
      code: 'canonical_network_mismatch',
      severity: 'warning',
      message: 'canonical_network_match_rate remained 0.0 in benchmark artifact metrics.',
      evidence_field: 'metrics.canonical_network_match_rate',
      value: 0
    });
  }
  const statusEvidenceReferencesPayCli = route.status_evidence.toLowerCase().includes('pay_cli');
  if (route.status_code === null && statusEvidenceReferencesPayCli) {
    caveatObjects.push({
      code: 'pay_cli_status_hidden',
      severity: 'info',
      message: 'HTTP status is unavailable in pay_cli evidence mode; inspect status_evidence for proof context.',
      evidence_field: 'status_code',
      value: null
    });
  }
  if (artifact.benchmark_id === DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID && route.status_code === null) {
    caveatObjects.push({
      code: 'status_code_unavailable',
      severity: 'warning',
      message: 'status_code is unavailable for this OCR benchmark run in pay_cli hidden status mode.',
      evidence_field: 'status_code',
      value: null
    });
  }
  return caveatObjects;
}

function resolveEvidenceHealth(params: {
  benchmarkId: string;
  artifact: BenchmarkArtifactRecord | null;
  route: BenchmarkArtifactRoute | null;
  latestRecordedAt: string | null;
  caveatObjects: RadarEvidenceCaveat[];
}): EvidenceHealth {
  const { benchmarkId, artifact, route, latestRecordedAt, caveatObjects } = params;
  const benchmark = buildRadarBenchmarkById(benchmarkId);

  if (!benchmark || benchmark.benchmark_recorded !== true || !artifact || !latestRecordedAt) return 'scaffold';
  if (!route || (route.execution_status !== 'proven' && route.paid_execution_proven !== true)) return 'unverified';

  const hasCriticalCaveat = caveatObjects.some((row) => row.severity === 'critical');
  const latestFailureCount = route.failed_runs;
  const latestSuccessCount = route.completed_runs;
  if (hasCriticalCaveat || (typeof latestFailureCount === 'number' && latestFailureCount > 0) || latestSuccessCount === 0) return 'degraded';

  const hasWarningCaveat = caveatObjects.some((row) => row.severity === 'warning');
  if (hasWarningCaveat) return 'caveated';

  const recordedAtMs = Date.parse(latestRecordedAt);
  if (Number.isFinite(recordedAtMs) && (Date.now() - recordedAtMs) > THIRTY_DAYS_MS) return 'stale';

  return 'recorded';
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
  const latestArtifact = getLatestBenchmarkArtifact(TOKEN_METADATA_BENCHMARK_ID);
  const benchmarkRecorded = latestArtifact?.aggregate_metrics?.benchmark_recorded === true;
  const mappedRoutes = listRouteMappings()
    .filter((entry) => entry.category.toLowerCase() === TOKEN_METADATA_CATEGORY && entry.benchmark_intent.toLowerCase() === TOKEN_METADATA_INTENT)
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
        proof_reference: routeArtifact?.proof_reference ?? 'live-proofs/finance-data-token-metadata-benchmark-runs-2026-05-18.md',
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
        comparison_notes: routeArtifact?.comparison_notes ?? 'Token-metadata benchmark recorded. No route winner is claimed.'
      };
    });
  const artifactRoutes: RadarBenchmarkRouteMetric[] = (latestArtifact?.routes ?? []).map((route) => ({
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
  }));

  return {
    benchmark_id: TOKEN_METADATA_BENCHMARK_ID,
    category: TOKEN_METADATA_CATEGORY,
    benchmark_intent: TOKEN_METADATA_INTENT,
    benchmark_recorded: benchmarkRecorded,
    winner_claimed: false,
    winner_status: latestArtifact?.winner_status ?? 'not_evaluated',
    next_step: benchmarkRecorded ? 'define scoring thresholds before declaring a route winner' : 'run normalized token-metadata benchmark',
    readiness_note: benchmarkRecorded
      ? 'Five-run normalized benchmark evidence exists. No route winner is claimed.'
      : 'Candidate token metadata mappings exist, but endpoint/method/request-shape verification is not recorded yet. Not benchmark-ready. No winner claimed.',
    routes: benchmarkRecorded ? (artifactRoutes.length ? artifactRoutes : mappedRoutes) : []
  };
}

function buildCommunicationsEmailDeliveryBenchmark(): RadarBenchmarkDetail {
  return {
    benchmark_id: COMMUNICATIONS_EMAIL_DELIVERY_BENCHMARK_ID,
    category: COMMUNICATIONS_EMAIL_DELIVERY_CATEGORY,
    benchmark_intent: COMMUNICATIONS_EMAIL_DELIVERY_INTENT,
    benchmark_recorded: false,
    winner_claimed: false,
    winner_status: 'not_evaluated',
    next_step: 'pay-prove two comparable communications send routes, then record a five-run benchmark artifact',
    readiness_note: 'Benchmark Scaffold. StableEmail paid execution succeeded with accepted send semantics (route_state=verified/proven, evidence_health=caveated). AgentMail verifier is implemented/tested but second route remains blocked until AGENTMAIL_INBOX_ID and inbox ownership are configured for a real paid run. Second-route catalog search found no alternate comparable outbound provider. Promotion is blocked until a second comparable paid-proven route and one five-run artifact exist.',
    routes: []
  };
}

function buildSolanaInfraAccountBalanceBenchmark(): RadarBenchmarkDetail {
  return {
    benchmark_id: SOLANA_INFRA_ACCOUNT_BALANCE_BENCHMARK_ID,
    category: SOLANA_INFRA_ACCOUNT_BALANCE_CATEGORY,
    benchmark_intent: SOLANA_INFRA_ACCOUNT_BALANCE_INTENT,
    benchmark_recorded: false,
    winner_claimed: false,
    winner_status: 'not_evaluated',
    next_step: 're-run QuickNode paid verifier in a compatible runtime and find a second comparable paid-proven native SOL balance/lamports route for the same canonical address, then record a five-run benchmark artifact',
    readiness_note: 'Benchmark Scaffold. Canonical input: {"network":"solana","address":"known public Solana wallet address"}. Harness evidence identifies QuickNode Solana Mainnet JSON-RPC as the strongest candidate; unpaid probes confirmed HTTP 402 payment-challenge behavior for getBalance/getAccountInfo. Normalizer, structured caveats, and evidence_health derivation are implemented in Harness, and a QuickNode paid verifier exists, but paid execution failed in the current runtime so QuickNode remains candidate/unproven with evidence_health=unverified. Second-route search found no comparable native SOL balance/lamports route in the current Pay catalog snapshot. stablecrypto.dev/api/alchemy/node/rpc was evaluated and rejected as comparable because its published contract is Ethereum-oriented and Solana lamports semantics were not proven. Promotion remains blocked until two comparable paid-proven routes return native SOL balance/account lamports for the same canonical address and a five-run artifact exists.',
    routes: []
  };
}

function buildSocialDataRedditPostSearchBenchmark(): RadarBenchmarkDetail {
  return {
    benchmark_id: SOCIAL_DATA_REDDIT_POST_SEARCH_BENCHMARK_ID,
    category: SOCIAL_DATA_REDDIT_POST_SEARCH_CATEGORY,
    benchmark_intent: SOCIAL_DATA_REDDIT_POST_SEARCH_INTENT,
    benchmark_recorded: false,
    winner_claimed: false,
    winner_status: 'not_evaluated',
    next_step: 'keep StableEnrich as paid-proven (verified/proven, evidence_health=caveated), establish recognizable Reddit post semantics for StableSocial via paid execution, then record one five-run artifact after two comparable paid-proven routes exist',
    readiness_note: 'Benchmark Scaffold. Canonical input: {"query":"x402","limit":5}. StableEnrich Reddit Search paid execution succeeded and is route_state=verified/proven with evidence_health=caveated; recognizable Reddit posts were returned for query "x402". StableSocial Reddit Search method is confirmed POST; unpaid variants A-F returned HTTP 402 payment-required, and paid diagnostic retry variant A executed successfully, but route_state remains candidate/unproven because recognizable Reddit post semantics were not established. The lane currently has only one paid-proven route and no five-run benchmark artifact. Promotion remains blocked until two comparable paid-proven routes exist for the canonical query and one five-run artifact is recorded.',
    routes: []
  };
}

function buildDocumentOcrTextExtractionBenchmark(): RadarBenchmarkDetail {
  const latestArtifact = getLatestBenchmarkArtifact(DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID);
  const benchmarkRecorded = latestArtifact?.aggregate_metrics?.benchmark_recorded === true;
  const routes: RadarBenchmarkRouteMetric[] = (latestArtifact?.routes ?? []).map((route) => ({
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
  }));
  return {
    benchmark_id: DOCUMENT_OCR_TEXT_EXTRACTION_BENCHMARK_ID,
    category: DOCUMENT_OCR_TEXT_EXTRACTION_CATEGORY,
    benchmark_intent: DOCUMENT_OCR_TEXT_EXTRACTION_INTENT,
    benchmark_recorded: benchmarkRecorded,
    winner_claimed: false,
    winner_status: latestArtifact?.winner_status ?? 'not_evaluated',
    next_step: benchmarkRecorded ? 'define scoring thresholds before declaring a route winner' : 'host a stable public OCR fixture, then paid-prove Reducto and Google Vision image OCR against the same fixture before recording one five-run benchmark artifact',
    readiness_note: benchmarkRecorded
      ? 'Five-run normalized benchmark evidence exists. No route winner is claimed.'
      : 'Benchmark Scaffold. Canonical expected text: "INFOPUNKS RADAR", "EVIDENCE BEFORE SPEND", "OCR BENCHMARK 001". Candidate routes: PaySponge Reducto OCR/document parsing and Google Cloud Vision image text detection. Unpaid probes confirmed 402 payment-challenge behavior on both candidate routes. Google Vision file OCR (/v1/files:annotate) is stricter and not the primary comparable path because non-GCS URLs returned INVALID_ARGUMENT. Promotion remains blocked until a stable public OCR fixture exists, both routes are paid-proven against the same fixture, normalizer/caveats/evidence_health are present, and one five-run benchmark artifact is recorded.',
    routes
  };
}

function buildDataWebSearchResultsBenchmark(): RadarBenchmarkDetail {
  const latestArtifact = getLatestBenchmarkArtifact(DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID);
  const benchmarkRecorded = latestArtifact?.aggregate_metrics?.benchmark_recorded === true;
  const routes: RadarBenchmarkRouteMetric[] = (latestArtifact?.routes ?? []).map((route) => ({
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
  }));
  return {
    benchmark_id: DATA_WEB_SEARCH_RESULTS_BENCHMARK_ID,
    category: DATA_WEB_SEARCH_RESULTS_CATEGORY,
    benchmark_intent: DATA_WEB_SEARCH_RESULTS_INTENT,
    benchmark_recorded: benchmarkRecorded,
    winner_claimed: false,
    winner_status: latestArtifact?.winner_status ?? 'not_evaluated',
    next_step: benchmarkRecorded ? 'define scoring thresholds before declaring a route winner' : 'pay-prove at least two comparable web-search routes on canonical input {"query":"x402 agent payments","limit":5}, then record one five-run benchmark artifact',
    readiness_note: benchmarkRecorded
      ? 'Five-run normalized benchmark evidence exists. No route winner is claimed.'
      : 'Benchmark Scaffold. Canonical input: {"query":"x402 agent payments","limit":5}. Candidate routes: StableEnrich Exa Search, StableEnrich Firecrawl Search, and Perplexity Search. Unpaid probes confirmed HTTP 402 payment-challenge behavior and method-correct POST request shape for all three routes. Promotion remains blocked until at least two comparable routes are paid-proven on the same canonical query and one five-run artifact exists.',
    routes
  };
}

function buildMapsPlaceSearchResultsBenchmark(): RadarBenchmarkDetail {
  return {
    benchmark_id: MAPS_PLACE_SEARCH_RESULTS_BENCHMARK_ID,
    category: MAPS_PLACE_SEARCH_RESULTS_CATEGORY,
    benchmark_intent: MAPS_PLACE_SEARCH_RESULTS_INTENT,
    benchmark_recorded: false,
    winner_claimed: false,
    winner_status: 'not_evaluated',
    next_step: 'find another comparable place-search provider route, or revisit Google Places only if provider schema/output changes; then record one five-run benchmark artifact after two comparable paid-proven routes exist on canonical input {"query":"coffee near Union Square San Francisco","location":"Union Square, San Francisco, CA","limit":5}',
    readiness_note: 'Benchmark Scaffold. Canonical input: {"query":"coffee near Union Square San Francisco","location":"Union Square, San Francisco, CA","limit":5}. StableEnrich Google Maps Text Search paid execution succeeded and returned recognizable place candidates, but evidence_health is degraded because place names/addresses/coordinates are missing and location confirmation failed. Google Places SearchText paid execution succeeded and later received one paid diagnostic retry with includedType=cafe, but still returned zero recognizable place candidates. Only one comparable route is paid-proven for recognizable place-search semantics, no second paid-proven comparable route exists yet, and no five-run benchmark artifact exists.',
    routes: []
  };
}

function buildAudioSpeechTranscriptionBenchmark(): RadarBenchmarkDetail {
  return {
    benchmark_id: AUDIO_SPEECH_TRANSCRIPTION_BENCHMARK_ID,
    category: AUDIO_SPEECH_TRANSCRIPTION_CATEGORY,
    benchmark_intent: AUDIO_SPEECH_TRANSCRIPTION_INTENT,
    benchmark_recorded: false,
    winner_claimed: false,
    winner_status: 'not_evaluated',
    next_step: 'park lane until route schema/output changes allow transcript semantics proof, or a different comparable transcription provider appears; then record one five-run benchmark artifact after two comparable paid-proven routes exist',
    readiness_note: 'Benchmark Scaffold. Canonical fixture: https://radar.infopunks.fun/fixtures/audio-benchmark-001.wav (HTTP 200, content-type audio/x-wav, WAV PCM 16-bit mono 22050 Hz, size 224258 bytes). Canonical phrase: "INFOPUNKS RADAR", "EVIDENCE BEFORE SPEND", "AUDIO BENCHMARK 001". Google Speech paid execution succeeded and received one shape diagnostic paid retry, but transcript semantics were still not proven; route_state remains candidate/unproven with evidence_health=degraded. Alibaba Speech paid execution succeeded and received one shape diagnostic paid retry, but transcript semantics were still not proven; route_state remains candidate/unproven with evidence_health=degraded. No benchmark artifact exists and winner_claimed remains false.',
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
