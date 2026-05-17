type JsonSchema = Record<string, unknown>;
type OpenApiSpec = Record<string, unknown>;

const SAFE_METADATA_NOTE = 'Safe metadata only: Radar uses catalog-derived intelligence and metadata reachability signals. It does not execute paid Pay.sh provider APIs and does not expose secrets.';

export function createOpenApiSpec(version = '0.1.0'): OpenApiSpec {
  const paths: Record<string, unknown> = {};

  const add = (method: 'get' | 'post', path: string, operation: Record<string, unknown>) => {
    paths[path] = {
      ...(paths[path] as Record<string, unknown> | undefined),
      [method]: operation
    };
  };

  add('get', '/health', {
    tags: ['System'],
    summary: 'Health check',
    description: 'Returns service health, persistence mode, catalog source, and current provider/endpoint counts.',
    responses: jsonResponses({ $ref: '#/components/schemas/HealthResponse' }, { ok: true, service: 'infopunks-pay-sh-radar', providerCount: 12, endpointCount: 28 })
  });

  add('get', '/status', {
    tags: ['System'],
    summary: 'Runtime status',
    description: 'Returns current catalog and database mode status. This route is read-only and safe for agent discovery.',
    responses: jsonResponses({ $ref: '#/components/schemas/StatusResponse' }, { ok: true, catalog_status: 'ready', providerCount: 12 })
  });

  add('get', '/version', {
    tags: ['System'],
    summary: 'Service version',
    description: 'Returns the Radar service name and configured version.',
    responses: jsonResponses(objectSchema({ service: stringSchema(), version: stringSchema() }), { service: 'infopunks-pay-sh-radar', version })
  });

  add('get', '/v1/pulse', {
    tags: ['Ecosystem'],
    summary: 'Get live pulse dashboard',
    description: `${SAFE_METADATA_NOTE} Returns compact ecosystem pulse metrics for the UI and agents.`,
    responses: envelopedResponses('PulseResponse', { providerCount: 12, endpointCount: 28, averageTrust: 82 })
  });
  add('get', '/v1/pulse/summary', {
    tags: ['Ecosystem'],
    summary: 'Get pulse summary',
    description: `${SAFE_METADATA_NOTE} Returns current event spine summaries, timing, recent degradations, and interpretation summaries.`,
    responses: envelopedResponses('PulseSummaryResponse', { generatedAt: '2026-05-13T00:00:00.000Z', counters: { providers: 12, endpoints: 28 } })
  });
  add('get', '/v1/propagation', {
    tags: ['Ecosystem'],
    summary: 'Get propagation summary',
    description: 'Returns compact propagation analysis from catalog and safe metadata events.',
    responses: envelopedResponses('PropagationResponse', { propagation_state: 'isolated', severity: 'low' })
  });
  add('get', '/v1/propagation/{cluster_id}', {
    tags: ['Ecosystem'],
    summary: 'Get propagation incident',
    description: 'Returns a public propagation incident dossier for an existing cluster.',
    parameters: [pathParam('cluster_id', 'Propagation cluster identifier.')],
    responses: envelopedResponses('PropagationIncidentResponse', { cluster_id: 'cluster-payments', current_status: 'monitoring' }, 'propagation_cluster_not_found')
  });
  add('get', '/v1/events/{id}', {
    tags: ['Events'],
    summary: 'Get event receipt',
    description: 'Returns a deterministic event record with severity classification.',
    parameters: [pathParam('id', 'Event identifier.')],
    responses: envelopedResponses('EventResponse', { id: 'evt-1', type: 'provider.updated' }, 'event_not_found')
  });
  add('get', '/v1/events/recent', {
    tags: ['Events'],
    summary: 'List recent events',
    description: 'Returns the latest event spine records, newest first.',
    responses: envelopedResponses(arrayOf(freeformObject()), [{ id: 'evt-1', type: 'provider.updated' }])
  });
  add('get', '/v1/receipts/{event_id}', {
    tags: ['Events'],
    summary: 'Get structured public receipt',
    description: 'Returns a public, structured receipt for an event id.',
    parameters: [pathParam('event_id', 'Receipt event identifier.')],
    responses: envelopedResponses('ReceiptResponse', { event_id: 'evt-1', event_type: 'provider.updated' }, 'receipt_not_found')
  });

  add('get', '/v1/providers', {
    tags: ['Providers'],
    summary: 'List providers',
    description: 'Returns lightweight provider records for directory and agent discovery.',
    responses: envelopedResponses(arrayOf({ $ref: '#/components/schemas/ProviderSummary' }), [{ id: 'alpha', name: 'Alpha API', category: 'payments' }])
  });
  add('get', '/v1/providers/featured', {
    tags: ['Providers'],
    summary: 'Get featured provider',
    description: 'Returns the current time-window featured provider rotation state.',
    responses: envelopedResponses('FeaturedProviderResponse', { providerId: 'alpha', providerName: 'Alpha API', strategy: 'time_window_round_robin' })
  });
  add('get', '/v1/providers/{id}', {
    tags: ['Providers'],
    summary: 'Get provider detail',
    description: 'Returns provider metadata, endpoints, and current trust/signal assessments.',
    parameters: [pathParam('id', 'Provider identifier.')],
    responses: envelopedResponses('ProviderDetailResponse', { provider: { id: 'alpha', name: 'Alpha API' }, endpoints: [] }, 'provider_not_found')
  });
  add('get', '/v1/providers/{id}/history', {
    tags: ['Providers'],
    summary: 'Get provider event history',
    description: 'Returns legacy provider history records for the selected provider.',
    parameters: [pathParam('id', 'Provider identifier.')],
    responses: envelopedResponses(arrayOf(freeformObject()), [], 'provider_not_found')
  });
  add('get', '/v1/providers/{id}/intelligence', {
    tags: ['Providers'],
    summary: 'Get provider intelligence dossier',
    description: `${SAFE_METADATA_NOTE} Returns provider trust, signal, monitor, endpoint health, recent changes, and propagation context.`,
    parameters: [pathParam('id', 'Provider identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/ProviderIntelligence' }, { provider: { id: 'alpha' }, latest_trust_score: 92 }, 'provider_not_found')
  });

  add('get', '/v1/endpoints', {
    tags: ['Endpoints'],
    summary: 'List raw endpoints',
    description: 'Returns endpoint records currently known to Radar.',
    responses: envelopedResponses(arrayOf(freeformObject()), [{ id: 'ep-alpha', providerId: 'alpha' }])
  });
  add('get', '/v1/endpoints/{id}/history', {
    tags: ['Endpoints'],
    summary: 'Get endpoint event history',
    description: 'Returns legacy endpoint history records for the selected endpoint.',
    parameters: [pathParam('id', 'Endpoint identifier.')],
    responses: envelopedResponses(arrayOf(freeformObject()), [], 'endpoint_not_found')
  });
  add('get', '/v1/endpoints/{id}/monitor', {
    tags: ['Endpoints'],
    summary: 'Get endpoint monitor summary',
    description: `${SAFE_METADATA_NOTE} Returns safe monitor evidence for one endpoint when available.`,
    parameters: [pathParam('id', 'Endpoint identifier.')],
    responses: envelopedResponses('EndpointMonitorResponse', { health: 'healthy', recentFailures: [] }, 'endpoint_not_found')
  });

  add('get', '/v1/monitor/runs/recent', {
    tags: ['Monitoring'],
    summary: 'List recent monitor runs',
    description: `${SAFE_METADATA_NOTE} Returns recent safe metadata monitor run summaries. This does not trigger monitoring.`,
    responses: envelopedResponses(arrayOf(freeformObject()), [])
  });

  add('get', '/v1/trust/{entity_id}', {
    tags: ['Intelligence'],
    summary: 'Get trust assessment',
    description: 'Returns current trust assessment for a provider or entity.',
    parameters: [pathParam('entity_id', 'Provider or entity identifier.')],
    responses: envelopedResponses('TrustAssessmentResponse', { entityId: 'alpha', score: 92, grade: 'A' }, 'trust_assessment_not_found')
  });
  add('get', '/v1/signal/{entity_id}', {
    tags: ['Intelligence'],
    summary: 'Get signal assessment',
    description: 'Returns current signal assessment for a provider or entity.',
    parameters: [pathParam('entity_id', 'Provider or entity identifier.')],
    responses: envelopedResponses('SignalAssessmentResponse', { entityId: 'alpha', score: 88, narratives: [] }, 'signal_assessment_not_found')
  });
  add('get', '/v1/narratives', {
    tags: ['Intelligence'],
    summary: 'List narratives',
    description: 'Returns catalog-derived ecosystem narratives.',
    responses: envelopedResponses(arrayOf(freeformObject()), [])
  });
  add('post', '/v1/search', {
    tags: ['Intelligence'],
    summary: 'Semantic search',
    description: 'Searches provider metadata, trust/signal context, endpoints, and receipts.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/SearchRequest' }, { query: 'route eligible finance endpoints', limit: 6 }),
    responses: jsonResponses(objectSchema({ data: arrayOf(freeformObject()), degraded: booleanSchema(), reason: stringSchema() }), { data: [] })
  });
  add('post', '/v1/recommend-route', {
    tags: ['Routing'],
    summary: 'Recommend route',
    description: `${SAFE_METADATA_NOTE} Legacy route recommendation based on trust, signal, category, price, and preference inputs.`,
    requestBody: jsonRequest({ $ref: '#/components/schemas/RouteRecommendationRequest' }, { task: 'find a high trust payments provider', preference: 'balanced', trustThreshold: 80 }),
    responses: envelopedResponses('RouteRecommendationResponse', { bestProvider: { id: 'alpha' }, reasoning: ['highest trust'] })
  });
  add('post', '/v1/preflight', {
    tags: ['Routing'],
    summary: 'Legacy preflight',
    description: `${SAFE_METADATA_NOTE} Runs the legacy agent preflight contract.`,
    requestBody: jsonRequest(freeformObject(), { intent: 'prepay route selection for settlement', category: 'Payments' }),
    responses: envelopedResponses(freeformObject(), { decision: 'route_approved' })
  });
  add('get', '/v1/preflight/schema', {
    tags: ['Routing'],
    summary: 'Get legacy preflight schema',
    description: 'Returns JSON schemas and an example for the legacy preflight route.',
    responses: envelopedResponses('PreflightSchemaResponse', { request: {}, response: {}, example: {} })
  });

  add('get', '/v1/radar/scored-catalog', radarGet('Radar', 'Get scored catalog export', 'Returns providers and normalized endpoints in one safe JSON export.', 'ScoredCatalogResponse', { counts: { providers: 12, endpoints: 28 }, providers: [], endpoints: [] }));
  add('get', '/v1/radar/providers', radarGet('Radar', 'Get provider intelligence export', 'Returns safe provider-level intelligence records.', 'ProviderIntelligenceExportResponse', { count: 12, providers: [] }));
  add('get', '/v1/radar/endpoints', radarGet('Radar', 'Get endpoint intelligence export', 'Returns normalized endpoint-level intelligence records.', 'EndpointIntelligenceExportResponse', { count: 28, endpoints: [] }));
  add('get', '/v1/radar/routes/candidates', radarGet('Radar', 'Get route candidate export', 'Returns route-eligible endpoint/provider candidates grouped by category and provider.', 'RouteCandidatesExportResponse', { count: 8, total_endpoints: 28, grouped_by_category: {}, grouped_by_provider: {} }));
  add('get', '/v1/radar/mappings', radarGet('Radar', 'Get route mapping registry', 'Returns read-only route mapping registry rows with mapping/execution proof state.', objectSchema({
    generated_at: stringSchema(),
    source: stringSchema(),
    count: integerSchema(),
    mappings: arrayOf(freeformObject())
  }), { count: 3, mappings: [{ provider_name: 'StableCrypto', mapping_status: 'verified', execution_evidence_status: 'proven' }, { provider_name: 'CoinGecko Onchain DEX API', benchmark_intent: 'token search', mapping_status: 'candidate', execution_evidence_status: 'unproven' }] }));
  add('get', '/v1/radar/mapping-targets', radarGet('Radar', 'Get mapping targets quest board', 'Returns read-only planning targets for future mapping coverage. Targets are planning prompts and not verified routes.', objectSchema({
    generated_at: stringSchema(),
    source: stringSchema(),
    count: integerSchema(),
    targets: arrayOf(freeformObject())
  }), { count: 5, targets: [{ category: 'finance/data', benchmark_intent: 'token metadata', current_state: 'needs_candidate' }] }));

  add('post', '/v1/radar/preflight', {
    tags: ['Radar Agent'],
    summary: 'Run agent preflight',
    description: `${SAFE_METADATA_NOTE} Evaluates route candidates before spend using only Radar metadata, trust, signal, risk, cost, and history context.`,
    requestBody: jsonRequest({ $ref: '#/components/schemas/PreflightRequest' }, { intent: 'get SOL price', category: 'finance', constraints: { min_trust: 80, prefer_reachable: true, require_pricing: true, max_price_usd: 0.01 } }),
    responses: envelopedResponses({ $ref: '#/components/schemas/PreflightResponse' }, { generated_at: '2026-05-13T00:00:00.000Z', source: 'infopunks-pay-sh-radar', recommended_route: null, accepted_candidates: [], rejected_candidates: [], warnings: [], superiority_evidence_available: false })
  });
  add('post', '/v1/radar/preflight/batch', {
    tags: ['Radar Agent'],
    summary: 'Run batch agent preflight',
    description: `${SAFE_METADATA_NOTE} Runs up to 25 independent preflight checks with per-query success/error results.`,
    requestBody: jsonRequest({ $ref: '#/components/schemas/BatchPreflightRequest' }, { queries: [{ id: 'sol-price', intent: 'get SOL price', category: 'finance', constraints: { min_trust: 80, prefer_reachable: true } }] }),
    responses: envelopedResponses({ $ref: '#/components/schemas/BatchPreflightResponse' }, { generated_at: '2026-05-13T00:00:00.000Z', source: 'infopunks-pay-sh-radar', count: 1, results: [], warnings: [] })
  });
  add('post', '/v1/radar/compare', {
    tags: ['Radar Agent'],
    summary: 'Compare providers or endpoints',
    description: `${SAFE_METADATA_NOTE} Compares 2-3 providers or endpoints across route-readiness, trust, signal, risk, metadata, pricing, and degradation fields.`,
    requestBody: jsonRequest({ $ref: '#/components/schemas/ComparisonRequest' }, { mode: 'provider', ids: ['alpha', 'beta'] }),
    responses: envelopedResponses({ $ref: '#/components/schemas/ComparisonResponse' }, { generated_at: '2026-05-13T00:00:00.000Z', mode: 'provider', rows: [] })
  });
  add('get', '/v1/radar/superiority-readiness', radarGet('Radar Readiness', 'Get superiority proof readiness', 'Returns whether Radar has enough registry-backed proven evidence to start superiority benchmarking. This indicates readiness to compare, not a superiority winner claim.', { $ref: '#/components/schemas/SuperiorityReadinessResponse' }, { executable_provider_mappings_count: 0, providers_with_proven_paid_execution: [], winner_claimed: false }));
  add('get', '/v1/radar/benchmark-readiness', radarGet('Radar Readiness', 'Get benchmark readiness', 'Returns category-level benchmark readiness and superiority readiness splits.', { $ref: '#/components/schemas/BenchmarkReadinessResponse' }, { benchmark_ready_categories: [], superiority_ready_categories: [] }));
  add('get', '/v1/radar/benchmarks', radarGet('Radar Readiness', 'Get head-to-head benchmark registry', 'Returns recorded head-to-head benchmark scaffolds. A benchmark row can be metrics-pending and never implies a winner claim.', { $ref: '#/components/schemas/BenchmarkRegistryResponse' }, { benchmarks: [] }));
  add('get', '/v1/radar/benchmarks/finance-data-sol-price', radarGet('Radar Readiness', 'Get SOL price benchmark scaffold', 'Returns the finance/data get SOL price head-to-head benchmark scaffold with recorded normalized evidence. benchmark_recorded=true means normalized evidence has been recorded, not that a winner is claimed. winner_status=no_clear_winner means run criteria were met but no route winner is claimed. status_code may be null in pay_cli mode and status_evidence explains proof basis.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'finance-data-sol-price', winner_claimed: false, benchmark_recorded: true, winner_status: 'no_clear_winner' }));
  add('get', '/v1/radar/benchmarks/finance-data-token-search', radarGet('Radar Readiness', 'Get token-search benchmark scaffold', 'Returns the finance/data token-search planning scaffold. benchmark_recorded=false means no normalized benchmark evidence exists yet. winner_status=not_evaluated means agents must not use it as routing proof. routes=[] means no comparable proven routes are recorded, even when candidate mappings are tracked separately.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'finance-data-token-search', winner_claimed: false, benchmark_recorded: false, winner_status: 'not_evaluated', routes: [] }));
  add('get', '/v1/radar/benchmarks/finance-data-sol-price/history', radarGet('Radar Readiness', 'Get SOL price benchmark history timeline', 'Returns additive read-only benchmark timeline entries derived from known benchmark artifacts. Entries are evidence snapshots and do not imply a winner claim.', { $ref: '#/components/schemas/BenchmarkHistoryResponse' }, { benchmark_id: 'finance-data-sol-price', entries: [{ run_count: 1, benchmark_recorded: true, winner_claimed: false }, { run_count: 5, benchmark_recorded: true, winner_status: 'no_clear_winner', winner_claimed: false }] }));
  add('get', '/v1/radar/benchmark-artifacts', radarGet('Radar Readiness', 'List benchmark artifacts', 'Returns curated/imported benchmark evidence records used to build benchmark summaries. Raw proof files are not served, and Radar does not execute paid APIs from this route.', { $ref: '#/components/schemas/BenchmarkArtifactRegistryResponse' }, { artifacts: [] }));
  add('get', '/v1/radar/benchmark-artifacts/{artifact_id}', {
    tags: ['Radar Readiness'],
    summary: 'Get benchmark artifact metadata',
    description: `${SAFE_METADATA_NOTE} Returns safe benchmark artifact metadata for one artifact. Raw proof contents are not exposed. Artifacts are curated/imported evidence records and this route does not execute paid APIs.`,
    parameters: [pathParam('artifact_id', 'Benchmark artifact identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/BenchmarkArtifactResponse' }, { artifact_id: 'finance-data-sol-price-benchmark-runs-2026-05-16', benchmark_id: 'finance-data-sol-price' }, 'benchmark_artifact_not_found')
  });

  add('get', '/v1/radar/history/providers/{provider_id}', radarHistoryPath('provider_id', 'Provider history'));
  add('get', '/v1/radar/history/endpoints/{endpoint_id}', radarHistoryPath('endpoint_id', 'Endpoint history'));
  add('get', '/v1/radar/history/ecosystem', {
    tags: ['Radar History'],
    summary: 'Get ecosystem history',
    description: `${SAFE_METADATA_NOTE} Returns historical ecosystem trend series for a normalized time window.`,
    parameters: [windowParam()],
    responses: envelopedResponses({ $ref: '#/components/schemas/HistoryResponse' }, { window: '24h', history_available: true, sample_count: 4, series: {}, deltas: {}, warnings: [] })
  });

  add('get', '/v1/radar/risk/providers/{provider_id}', radarRiskPath('provider_id', 'Provider risk'));
  add('get', '/v1/radar/risk/endpoints/{endpoint_id}', radarRiskPath('endpoint_id', 'Endpoint risk'));
  add('get', '/v1/radar/risk/ecosystem', {
    tags: ['Radar Risk'],
    summary: 'Get ecosystem risk',
    description: `${SAFE_METADATA_NOTE} Returns ecosystem risk summary, top anomalies, affected categories, recent critical events, and anomaly watch rows.`,
    responses: envelopedResponses({ allOf: [{ $ref: '#/components/schemas/RiskResponse' }, objectSchema({ summary: freeformObject() })] }, { subject_type: 'ecosystem', risk_level: 'watch', summary: { anomaly_watch: [] } })
  });

  addCsv(paths, '/v1/radar/export/providers.csv', 'Export providers CSV', 'Provider CSV export with safe normalized fields only.');
  addCsv(paths, '/v1/radar/export/endpoints.csv', 'Export endpoints CSV', 'Endpoint CSV export with safe normalized fields only.');
  addCsv(paths, '/v1/radar/export/route-candidates.csv', 'Export route candidates CSV', 'Route candidate CSV export with safe normalized fields only.');
  addCsv(paths, '/v1/radar/export/degradations.csv', 'Export degradations CSV', 'Safe metadata degradation CSV export.');

  return {
    openapi: '3.1.0',
    info: {
      title: 'Infopunks Pay.sh Radar API',
      version,
      summary: 'Machine-discoverable safe metadata intelligence for Pay.sh routing agents.',
      description: SAFE_METADATA_NOTE
    },
    servers: [{ url: '/', description: 'Current Radar origin' }],
    tags: [
      { name: 'System' },
      { name: 'Ecosystem' },
      { name: 'Events' },
      { name: 'Providers' },
      { name: 'Endpoints' },
      { name: 'Monitoring' },
      { name: 'Intelligence' },
      { name: 'Routing' },
      { name: 'Radar' },
      { name: 'Radar Agent' },
      { name: 'Radar History' },
      { name: 'Radar Risk' },
      { name: 'Radar Readiness' },
      { name: 'Radar CSV Exports' }
    ],
    paths,
    components: { schemas: componentSchemas() }
  };
}

function componentSchemas(): Record<string, JsonSchema> {
  const score = { type: ['number', 'null'], minimum: 0, maximum: 100 };
  const riskLevel = enumSchema(['low', 'watch', 'elevated', 'critical', 'unknown']);
  const recommendedAction = enumSchema(['route normally', 'route with caution', 'required fallback route', 'not recommended for routing', 'insufficient history']);
  const riskAnomaly = objectSchema({
    anomaly_type: stringSchema(),
    severity: enumSchema(['low', 'medium', 'high', 'critical']),
    confidence: enumSchema(['low', 'medium', 'high']),
    explanation: stringSchema(),
    evidence: arrayOf(stringSchema()),
    detected_at: dateTimeSchema()
  });
  const routeCandidate = objectSchema({
    provider_id: stringSchema(),
    provider_name: nullableString(),
    endpoint_id: stringSchema(),
    endpoint_name: nullableString(),
    trust_score: score,
    signal_score: score,
    route_eligibility: booleanSchema(),
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    reasons: arrayOf(stringSchema()),
    rejection_reasons: arrayOf(stringSchema()),
    mapping_status: enumSchema(['complete', 'missing']),
    reachability_status: enumSchema(['reachable', 'degraded', 'failed', 'unknown']),
    pricing_status: enumSchema(['clear', 'missing']),
    last_seen_healthy: { type: ['string', 'null'], format: 'date-time' },
    predictive_risk: objectSchema({
      predictive_risk_score: { type: 'number', minimum: 0, maximum: 100 },
      predictive_risk_level: riskLevel,
      history_available: booleanSchema(),
      sample_count: integerSchema(),
      explanation: stringSchema(),
      evidence: arrayOf(stringSchema()),
      warnings: arrayOf(stringSchema()),
      recommended_action: recommendedAction,
      top_anomaly: { oneOf: [riskAnomaly, { type: 'null' }] }
    }),
    trend_context: freeformObject()
  });
  const costPerformanceFields = objectSchema({
    pricing_known: booleanSchema(),
    estimated_min_price: { type: ['number', 'null'] },
    estimated_max_price: { type: ['number', 'null'] },
    pricing_unit: nullableString(),
    pricing_source: nullableString(),
    pricing_confidence: enumSchema(['unknown', 'low', 'medium', 'high']),
    price_description: nullableString(),
    trust_per_estimated_dollar: { type: ['number', 'null'] },
    signal_per_estimated_dollar: { type: ['number', 'null'] },
    route_value_score: { type: ['number', 'null'] },
    value_score_reason: nullableString()
  });
  const endpointIntelligence = {
    allOf: [
      objectSchema({
        endpoint_id: stringSchema(),
        endpoint_name: nullableString(),
        provider_id: stringSchema(),
        provider_name: nullableString(),
        category: nullableString(),
        method: nullableString(),
        path: nullableString(),
        url: nullableString(),
        description: nullableString(),
        pricing: freeformObject(),
        input_schema: true,
        output_schema: true,
        catalog_observed_at: nullableString(),
        catalog_generated_at: nullableString(),
        provider_trust_score: score,
        provider_signal_score: score,
        provider_grade: nullableString(),
        reachability_status: enumSchema(['reachable', 'degraded', 'failed', 'unknown']),
        degradation_status: enumSchema(['degraded', 'healthy', 'unknown']),
        route_eligibility: { type: ['boolean', 'null'] },
        route_rejection_reasons: arrayOf(stringSchema()),
        metadata_quality_score: score,
        pricing_clarity_score: score,
        source: nullableString()
      }),
      { $ref: '#/components/schemas/CostPerformanceFields' }
    ]
  };
  const historyResponse = objectSchema({
    generated_at: dateTimeSchema(),
    window: enumSchema(['24h', '48h', '7d']),
    sample_count: integerSchema(),
    history_available: booleanSchema(),
    reason: nullableString(),
    series: freeformObject(),
    deltas: freeformObject(),
    last_known_good: freeformObject(),
    warnings: arrayOf(stringSchema())
  });
  const benchmarkCategory = objectSchema({
    category: stringSchema(),
    benchmark_intent: stringSchema(),
    executable_mapping_count: integerSchema(),
    candidate_mapping_count: integerSchema(),
    proven_execution_count: integerSchema(),
    benchmark_ready: booleanSchema(),
    superiority_ready: booleanSchema(),
    missing_requirements: arrayOf(stringSchema()),
    recommended_next_mapping: stringSchema(),
    mapping_ladder: arrayOf(stringSchema()),
    metadata_only_warning: nullableString()
  });
  const benchmarkWinnerStatus = enumSchema([
    'not_evaluated',
    'insufficient_runs',
    'no_clear_winner',
    'provisional_winner',
    'winner_claimed'
  ]);
  const benchmarkWinnerPolicy = objectSchema({
    policy_id: stringSchema(),
    policy_version: stringSchema(),
    required_successful_runs_per_route: integerSchema(),
    minimum_success_rate: { type: 'number', minimum: 0, maximum: 1 },
    allowed_price_variance_percent: { type: 'number', minimum: 0 },
    latency_metric: enumSchema(['median']),
    required_confidence: arrayOf(enumSchema(['high', 'medium'])),
    scoring_weights: objectSchema({
      reliability: { type: 'number', minimum: 0, maximum: 1 },
      latency: { type: 'number', minimum: 0, maximum: 1 },
      normalization_confidence: { type: 'number', minimum: 0, maximum: 1 },
      price_consistency: { type: 'number', minimum: 0, maximum: 1 },
      cost_clarity: { type: 'number', minimum: 0, maximum: 1 },
      freshness: { type: 'number', minimum: 0, maximum: 1 }
    }),
    winner_status: benchmarkWinnerStatus,
    winner_claimed: booleanSchema(),
    winner_rationale: stringSchema(),
    completed_runs: integerSchema(),
    required_runs: integerSchema(),
    next_step: stringSchema()
  });

  return {
    ErrorEnvelope: objectSchema({
      error: stringSchema(),
      message: stringSchema(),
      details: freeformObject()
    }),
    HealthResponse: objectSchema({
      ok: booleanSchema(),
      service: stringSchema(),
      role: stringSchema(),
      persistence: stringSchema(),
      catalogSource: stringSchema(),
      ingestionEnabled: booleanSchema(),
      lastIngestedAt: nullableString(),
      providerCount: integerSchema(),
      endpointCount: integerSchema()
    }),
    StatusResponse: freeformObject(),
    ProviderSummary: objectSchema({
      id: stringSchema(),
      name: stringSchema(),
      namespace: stringSchema(),
      fqn: nullableString(),
      category: stringSchema(),
      description: nullableString(),
      endpointCount: integerSchema(),
      pricing: freeformObject(),
      tags: arrayOf(stringSchema()),
      status: stringSchema(),
      latestTrustScore: score,
      latestSignalScore: score
    }),
    ProviderIntelligence: objectSchema({
      provider: freeformObject(),
      latest_trust_score: score,
      latest_signal_score: score,
      risk_level: stringSchema(),
      coordination_eligible: { type: ['boolean', 'null'] },
      unknown_telemetry: arrayOf(stringSchema()),
      recent_changes: arrayOf(freeformObject()),
      endpoint_count: integerSchema(),
      endpoint_health: freeformObject(),
      service_monitor: freeformObject(),
      propagation_context: freeformObject(),
      category_tags: arrayOf(stringSchema()),
      last_seen_at: nullableString(),
      endpoints: arrayOf(freeformObject())
    }),
    EndpointIntelligence: endpointIntelligence,
    RouteCandidate: routeCandidate,
    PreflightRequest: objectSchema({
      id: stringSchema(),
      intent: stringSchema(),
      category: stringSchema(),
      constraints: objectSchema({
        min_trust: { type: 'number', minimum: 0, maximum: 100 },
        prefer_reachable: booleanSchema(),
        require_pricing: booleanSchema(),
        max_price_usd: { type: 'number', minimum: 0 },
        allow_failed: booleanSchema(),
        allow_risky_routes: booleanSchema()
      })
    }, ['intent']),
    PreflightResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      input: { $ref: '#/components/schemas/PreflightRequest' },
      recommended_route: { oneOf: [{ $ref: '#/components/schemas/RouteCandidate' }, { type: 'null' }] },
      accepted_candidates: arrayOf({ $ref: '#/components/schemas/RouteCandidate' }),
      rejected_candidates: arrayOf({ $ref: '#/components/schemas/RouteCandidate' }),
      warnings: arrayOf(stringSchema()),
      superiority_evidence_available: booleanSchema()
    }),
    BatchPreflightRequest: objectSchema({
      queries: { type: 'array', minItems: 1, maxItems: 25, items: { $ref: '#/components/schemas/PreflightRequest' } }
    }, ['queries']),
    BatchPreflightResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      count: integerSchema(),
      results: arrayOf(objectSchema({
        id: stringSchema(),
        ok: booleanSchema(),
        recommended_route: { oneOf: [{ $ref: '#/components/schemas/RouteCandidate' }, { type: 'null' }] },
        accepted_candidates: arrayOf({ $ref: '#/components/schemas/RouteCandidate' }),
        rejected_candidates: arrayOf({ $ref: '#/components/schemas/RouteCandidate' }),
        warnings: arrayOf(stringSchema()),
        error: stringSchema()
      })),
      warnings: arrayOf(stringSchema())
    }),
    ComparisonRequest: objectSchema({
      mode: enumSchema(['provider', 'endpoint']),
      ids: { type: 'array', minItems: 2, maxItems: 3, items: stringSchema() }
    }, ['ids']),
    ComparisonResponse: objectSchema({
      generated_at: dateTimeSchema(),
      mode: enumSchema(['provider', 'endpoint']),
      rows: arrayOf(objectSchema({
        id: stringSchema(),
        type: enumSchema(['provider', 'endpoint']),
        name: stringSchema(),
        trust_score: score,
        signal_score: score,
        endpoint_count: integerSchema(),
        mapped_endpoint_count: integerSchema(),
        route_eligible_endpoint_count: integerSchema(),
        degradation_count: integerSchema(),
        pricing_clarity: score,
        metadata_quality: score,
        reachability: enumSchema(['reachable', 'degraded', 'failed', 'unknown']),
        last_observed: nullableString(),
        last_seen_healthy: nullableString(),
        predictive_risk_level: riskLevel,
        predictive_risk_score: score,
        recommended_action: recommendedAction,
        top_anomaly: { oneOf: [riskAnomaly, { type: 'null' }] },
        route_recommendation: enumSchema(['route_eligible', 'not_recommended']),
        rejection_reasons: arrayOf(stringSchema())
      }))
    }),
    RiskResponse: objectSchema({
      generated_at: dateTimeSchema(),
      subject_type: enumSchema(['provider', 'endpoint', 'ecosystem']),
      subject_id: stringSchema(),
      risk_score: { type: 'number', minimum: 0, maximum: 100 },
      risk_level: riskLevel,
      history_available: booleanSchema(),
      sample_count: integerSchema(),
      explanation: stringSchema(),
      anomalies: arrayOf(riskAnomaly),
      evidence: arrayOf(stringSchema()),
      warnings: arrayOf(stringSchema()),
      recommended_action: recommendedAction
    }),
    HistoryResponse: historyResponse,
    BenchmarkReadinessResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      categories: arrayOf(benchmarkCategory),
      benchmark_ready_categories: arrayOf(stringSchema()),
      superiority_ready_categories: arrayOf(stringSchema()),
      not_ready_categories: arrayOf(stringSchema()),
      missing_requirements: arrayOf(stringSchema()),
      recommended_next_mappings: arrayOf(stringSchema()),
      metadata_only_warning: stringSchema()
    }),
    BenchmarkRouteMetric: objectSchema({
      provider_id: stringSchema(),
      route_id: stringSchema(),
      execution_status: enumSchema(['verified', 'proven']),
      success: booleanSchema(),
      latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      paid_execution_proven: booleanSchema(),
      proof_reference: stringSchema(),
      normalized_output_available: booleanSchema(),
      extracted_price_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      extraction_path: { oneOf: [stringSchema(), { type: 'null' }] },
      success_rate: { oneOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] },
      median_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      p95_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      average_price_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      min_price_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      max_price_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      price_variance_percent: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      completed_runs: { oneOf: [integerSchema(), { type: 'null' }] },
      failed_runs: { oneOf: [integerSchema(), { type: 'null' }] },
      execution_transport: stringSchema(),
      cli_exit_code: { oneOf: [integerSchema(), { type: 'null' }] },
      status_code: { oneOf: [integerSchema(), { type: 'null' }] },
      status_evidence: stringSchema(),
      output_shape: { oneOf: [freeformObject(), { type: 'null' }] },
      normalization_confidence: enumSchema(['unknown', 'low', 'medium', 'high']),
      freshness_timestamp: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      comparison_notes: stringSchema()
    }),
    BenchmarkDetailResponse: objectSchema({
      benchmark_id: stringSchema(),
      category: stringSchema(),
      benchmark_intent: stringSchema(),
      benchmark_recorded: booleanSchema(),
      winner_claimed: booleanSchema(),
      winner_status: benchmarkWinnerStatus,
      winner_policy: benchmarkWinnerPolicy,
      next_step: stringSchema(),
      readiness_note: stringSchema(),
      routes: arrayOf({ $ref: '#/components/schemas/BenchmarkRouteMetric' })
    }),
    BenchmarkHistoryEntry: objectSchema({
      benchmark_id: stringSchema(),
      recorded_at: dateTimeSchema(),
      run_count: integerSchema(),
      benchmark_recorded: booleanSchema(),
      winner_claimed: booleanSchema(),
      winner_status: benchmarkWinnerStatus,
      note: stringSchema(),
      proof_reference: stringSchema(),
      routes: arrayOf({ $ref: '#/components/schemas/BenchmarkRouteMetric' })
    }),
    BenchmarkHistoryResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      benchmark_id: stringSchema(),
      entries: arrayOf({ $ref: '#/components/schemas/BenchmarkHistoryEntry' })
    }),
    BenchmarkRegistryResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      benchmarks: arrayOf({ $ref: '#/components/schemas/BenchmarkDetailResponse' })
    }),
    BenchmarkArtifactRoute: objectSchema({
      provider_id: stringSchema(),
      route_id: stringSchema(),
      execution_status: enumSchema(['verified', 'proven']),
      success: booleanSchema(),
      latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      paid_execution_proven: booleanSchema(),
      proof_reference: stringSchema(),
      normalized_output_available: booleanSchema(),
      extracted_price_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      extraction_path: { oneOf: [stringSchema(), { type: 'null' }] },
      success_rate: { oneOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] },
      median_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      p95_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      average_price_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      min_price_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      max_price_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      price_variance_percent: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      completed_runs: { oneOf: [integerSchema(), { type: 'null' }] },
      failed_runs: { oneOf: [integerSchema(), { type: 'null' }] },
      execution_transport: { const: 'pay_cli' },
      cli_exit_code: { oneOf: [integerSchema(), { type: 'null' }] },
      status_code: { oneOf: [integerSchema(), { type: 'null' }] },
      status_evidence: stringSchema(),
      normalization_confidence: enumSchema(['unknown', 'low', 'medium', 'high']),
      freshness_timestamp: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      comparison_notes: stringSchema()
    }),
    BenchmarkArtifactResponse: objectSchema({
      artifact_id: stringSchema(),
      benchmark_id: stringSchema(),
      generated_at: dateTimeSchema(),
      source_repo: stringSchema(),
      artifact_path: stringSchema(),
      total_runs: integerSchema(),
      winner_claimed: booleanSchema(),
      winner_status: benchmarkWinnerStatus,
      routes: arrayOf({ $ref: '#/components/schemas/BenchmarkArtifactRoute' }),
      aggregate_metrics: freeformObject(),
      notes: stringSchema()
    }),
    BenchmarkArtifactRegistryResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      artifacts: arrayOf({ $ref: '#/components/schemas/BenchmarkArtifactResponse' })
    }),
    SuperiorityReadinessResponse: objectSchema({
      generated_at: dateTimeSchema(),
      executable_provider_mappings_count: integerSchema(),
      categories_with_at_least_two_executable_mappings: arrayOf(stringSchema()),
      categories_not_ready_for_comparison: arrayOf(stringSchema()),
      providers_with_proven_paid_execution: arrayOf(stringSchema()),
      providers_with_only_catalog_metadata: arrayOf(stringSchema()),
      next_mappings_needed: arrayOf(stringSchema()),
      winner_claimed: booleanSchema(),
      next_step: stringSchema(),
      readiness_note: stringSchema()
    }),
    CostPerformanceFields: costPerformanceFields,
    CsvExportDescription: objectSchema({
      content_type: { const: 'text/csv; charset=utf-8' },
      safe_metadata_only: { const: true },
      paid_api_execution: { const: false }
    }),
    PulseResponse: freeformObject(),
    PulseSummaryResponse: freeformObject(),
    PropagationResponse: freeformObject(),
    PropagationIncidentResponse: freeformObject(),
    EventResponse: freeformObject(),
    ReceiptResponse: freeformObject(),
    FeaturedProviderResponse: freeformObject(),
    ProviderDetailResponse: freeformObject(),
    EndpointMonitorResponse: freeformObject(),
    TrustAssessmentResponse: freeformObject(),
    SignalAssessmentResponse: freeformObject(),
    SearchRequest: objectSchema({ query: stringSchema(), limit: integerSchema() }, ['query']),
    RouteRecommendationRequest: freeformObject(),
    RouteRecommendationResponse: freeformObject(),
    PreflightSchemaResponse: freeformObject(),
    ScoredCatalogResponse: freeformObject(),
    ProviderIntelligenceExportResponse: objectSchema({ generated_at: dateTimeSchema(), source: freeformObject(), count: integerSchema(), providers: arrayOf({ $ref: '#/components/schemas/ProviderIntelligence' }) }),
    EndpointIntelligenceExportResponse: objectSchema({ generated_at: dateTimeSchema(), source: freeformObject(), count: integerSchema(), endpoints: arrayOf({ $ref: '#/components/schemas/EndpointIntelligence' }) }),
    RouteCandidatesExportResponse: freeformObject()
  }
}

function radarGet(tag: string, summary: string, description: string, schema: string | JsonSchema, example: unknown) {
  return {
    tags: [tag],
    summary,
    description: `${SAFE_METADATA_NOTE} ${description}`,
    responses: envelopedResponses(typeof schema === 'string' ? { $ref: `#/components/schemas/${schema}` } : schema, example)
  };
}

function radarHistoryPath(paramName: string, summary: string) {
  return {
    tags: ['Radar History'],
    summary,
    description: `${SAFE_METADATA_NOTE} Returns normalized history series, deltas, last-known-good context, and warnings for a selected subject.`,
    parameters: [pathParam(paramName, `${paramName.replace('_', ' ')}.`), windowParam()],
    responses: envelopedResponses({ $ref: '#/components/schemas/HistoryResponse' }, { window: '24h', history_available: true, sample_count: 4, series: {}, deltas: {}, warnings: [] }, paramName.startsWith('provider') ? 'provider_not_found' : 'endpoint_not_found')
  };
}

function radarRiskPath(paramName: string, summary: string) {
  return {
    tags: ['Radar Risk'],
    summary,
    description: `${SAFE_METADATA_NOTE} Returns advisory predictive risk, explainable anomalies, evidence, warnings, and route action guidance.`,
    parameters: [pathParam(paramName, `${paramName.replace('_', ' ')}.`)],
    responses: envelopedResponses({ $ref: '#/components/schemas/RiskResponse' }, { subject_type: paramName.startsWith('provider') ? 'provider' : 'endpoint', subject_id: 'alpha', risk_score: 42, risk_level: 'watch', anomalies: [] }, paramName.startsWith('provider') ? 'provider_not_found' : 'endpoint_not_found')
  };
}

function addCsv(paths: Record<string, unknown>, path: string, summary: string, description: string) {
  paths[path] = {
    get: {
      tags: ['Radar CSV Exports'],
      summary,
      description: `${SAFE_METADATA_NOTE} ${description}`,
      responses: {
        '200': {
          description: 'CSV export.',
          content: {
            'text/csv; charset=utf-8': {
              schema: { type: 'string' },
              examples: { csv: { value: 'provider_id,provider_name,category\\nalpha,Alpha API,payments\\n' } }
            }
          }
        },
        default: errorResponse()
      }
    }
  };
}

function envelopedResponses(schema: string | JsonSchema, example: unknown, notFoundError?: string) {
  const dataSchema = typeof schema === 'string' ? { $ref: `#/components/schemas/${schema}` } : schema;
  return {
    '200': {
      description: 'Successful response.',
      content: {
        'application/json': {
          schema: objectSchema({ data: dataSchema }),
          examples: { success: { value: { data: example } } }
        }
      }
    },
    ...(notFoundError ? {
      '404': errorResponse(notFoundError)
    } : {}),
    default: errorResponse()
  };
}

function jsonResponses(schema: JsonSchema, example: unknown) {
  return {
    '200': {
      description: 'Successful response.',
      content: {
        'application/json': {
          schema,
          examples: { success: { value: example } }
        }
      }
    },
    default: errorResponse()
  };
}

function jsonRequest(schema: JsonSchema, example: unknown) {
  return {
    required: true,
    content: {
      'application/json': {
        schema,
        examples: { request: { value: example } }
      }
    }
  };
}

function errorResponse(exampleError = 'bad_request') {
  return {
    description: 'Error response.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        examples: { error: { value: { error: exampleError } } }
      }
    }
  };
}

function pathParam(name: string, description: string) {
  return { name, in: 'path', required: true, description, schema: stringSchema() };
}

function windowParam() {
  return { name: 'window', in: 'query', required: false, description: 'History window. Unsupported values normalize to the service default.', schema: enumSchema(['24h', '48h', '7d']) };
}

function objectSchema(properties: Record<string, unknown>, required: string[] = []): JsonSchema {
  return { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: true };
}

function freeformObject(): JsonSchema {
  return { type: 'object', additionalProperties: true };
}

function arrayOf(items: JsonSchema): JsonSchema {
  return { type: 'array', items };
}

function stringSchema(): JsonSchema {
  return { type: 'string' };
}

function nullableString(): JsonSchema {
  return { type: ['string', 'null'] };
}

function booleanSchema(): JsonSchema {
  return { type: 'boolean' };
}

function integerSchema(): JsonSchema {
  return { type: 'integer', minimum: 0 };
}

function dateTimeSchema(): JsonSchema {
  return { type: 'string', format: 'date-time' };
}

function enumSchema(values: string[]): JsonSchema {
  return { type: 'string', enum: values };
}
