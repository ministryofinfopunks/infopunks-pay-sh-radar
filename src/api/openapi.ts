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
    responses: envelopedResponses('RouteRecommendationResponse', { bestProvider: { id: 'alpha' }, reasoning: ['trust-prioritized'] })
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
  }), { count: 4, mappings: [{ provider_name: 'StableCrypto', benchmark_intent: 'token search', mapping_status: 'verified', execution_evidence_status: 'proven' }, { provider_name: 'CoinGecko Onchain DEX API', benchmark_intent: 'token search', mapping_status: 'verified', execution_evidence_status: 'proven' }] }));
  add('get', '/v1/radar/mapping-targets', radarGet('Radar', 'Get mapping targets quest board', 'Returns read-only planning targets for future mapping coverage. Targets are planning prompts and not verified routes.', objectSchema({
    generated_at: stringSchema(),
    source: stringSchema(),
    count: integerSchema(),
    targets: arrayOf(freeformObject())
  }), { count: 11, targets: [{ category: 'solana-infra', benchmark_intent: 'account balance', current_state: 'needs_two_comparable_mappings' }, { category: 'audio-ai', benchmark_intent: 'audio speech transcription', current_state: 'needs_two_comparable_mappings' }] }));
  add('get', '/v1/machine-market/services', radarGet('Machine Economy', 'List machine-market services', 'A new Radar module for machine-economy intelligence. Returns the Phase 2 robotic.sh service mirror for Pay.sh and robotic.sh scope. Same terminal. New species of spender.', { $ref: '#/components/schemas/MachineMarketServiceListResponse' }, { count: 12, services: [{ id: 'qvac', name: 'QVAC', source_market: 'robotic.sh', chain: 'peaq', evidence_stage: 'policy-mapped' }] }));
  add('get', '/v1/machine-market/summary', radarGet('Machine Economy', 'Get machine-market summary', 'Radar is the intelligence layer for autonomous spend across agents and machines. Machines should not spend blind.', { $ref: '#/components/schemas/MachineMarketSummaryResponse' }, { total_services: 12, ready_count: 11, setup_count: 1, phase_scope: 'phase_2_pay_sh_robotic_sh' }));
  add('get', '/v1/machine-policies/templates', radarGet('Machine Economy', 'List machine policy templates', 'Bounded authority needs receipts. Returns static machine-spend policy templates; this is not live wallet delegation.', { $ref: '#/components/schemas/MachinePolicyTemplateListResponse' }, { count: 5, templates: [{ id: 'delivery-robot', name: 'Delivery Robot', risk_tolerance: 'low', receipt_required: true }] }));
  add('get', '/v1/machine-policies/{policy_id}', {
    tags: ['Machine Economy'],
    summary: 'Get machine policy template',
    description: `${SAFE_METADATA_NOTE} peaqOS gives machines identity and wallets. Infopunks defines the boundary of machine spend. Returns one static policy template by id.`,
    parameters: [pathParam('policy_id', 'Machine policy template identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/MachinePolicyTemplateResponse' }, { policy: { id: 'delivery-robot', name: 'Delivery Robot', status: 'active' } }, 'machine_policy_not_found')
  });
  add('post', '/v1/machine-preflight', {
    tags: ['Machine Economy'],
    summary: 'Run machine spend preflight',
    description: `${SAFE_METADATA_NOTE} Core decision endpoint for delegated machine spending. It does not execute services, call Pay.sh, or claim payment occurred.`,
    requestBody: jsonRequest({ $ref: '#/components/schemas/MachinePreflightRequest' }, { machine_id: 'did:peaq:delivery-bot-01', intent: 'parse an invoice image into structured fields', category: 'vision', max_cost_usd: 0.05, allowed_markets: ['pay.sh'], allowed_chains: ['solana'], risk_tolerance: 'low', requires_receipt: true, policy_id: 'template_delivery_robot' }),
    responses: envelopedResponses({ $ref: '#/components/schemas/MachinePreflightResponse' }, { decision: 'allow', recommended_service: { id: 'document-ai', name: 'Document AI' }, receipt_id: 'mrx_20260522000000000_0001' })
  });
  add('get', '/v1/machine-preflight/receipts/recent', radarGet('Machine Economy', 'List recent machine preflight receipts', 'Returns newest machine preflight decision receipts first. Receipts are decision records only; no payment or provider execution is implied.', { $ref: '#/components/schemas/MachinePreflightReceiptListResponse' }, { count: 1, receipts: [{ receipt_id: 'mrx_20260522000000000_0001', decision: 'allow', receipt_type: 'machine_preflight' }] }));

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
  add('get', '/v1/radar/superiority-readiness', radarGet('Radar Readiness', 'Get comparison readiness', 'Returns whether Radar has enough registry-backed proven evidence to compare recorded metrics. This indicates readiness to compare, not a route winner claim.', { $ref: '#/components/schemas/SuperiorityReadinessResponse' }, { executable_provider_mappings_count: 0, providers_with_proven_paid_execution: [], winner_claimed: false }));
  add('get', '/v1/radar/benchmark-readiness', radarGet('Radar Readiness', 'Get benchmark readiness', 'Returns category-level benchmark readiness and superiority readiness splits.', { $ref: '#/components/schemas/BenchmarkReadinessResponse' }, { benchmark_ready_categories: [], superiority_ready_categories: [] }));
  add('get', '/v1/radar/benchmark-summary', radarGet(
    'Radar Readiness',
    'Get compact agent benchmark summary',
    'Returns lightweight agent-readable benchmark state without route-level metrics. Agents can use this endpoint for basic benchmark discovery, winner-claim interpretation, and artifact IDs before deciding whether to fetch full benchmark details. winner_claimed=false means no route winner should be inferred; winner_status=no_clear_winner means evidence exists but scoring thresholds do not crown a route.',
    { $ref: '#/components/schemas/BenchmarkSummaryResponse' },
    {
      generated_at: '2026-05-19T10:00:00.000Z',
      source: 'infopunks-pay-sh-radar',
      latest_recorded_at: '2026-05-19T09:30:00.000Z',
      total_artifacts: 6,
      recorded_benchmarks: 5,
      total_benchmarks: 10,
      winner_claimed: false,
      total_recorded_runs: 40,
      proven_routes: 10,
      benchmarks: [
        {
          benchmark_id: 'finance-data-sol-price',
          label: 'SOL price',
          status: 'recorded',
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          routes_count: 2,
          recorded_runs: 5
        },
        {
          benchmark_id: 'finance-data-token-search',
          label: 'Token search',
          status: 'recorded',
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          routes_count: 2,
          recorded_runs: 5
        },
        {
          benchmark_id: 'finance-data-token-metadata',
          label: 'Token metadata',
          status: 'recorded',
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          routes_count: 2,
          recorded_runs: 5
        },
        {
          benchmark_id: 'data-web-search-results',
          label: 'Web Search Results',
          description: 'Search the web for the same query and return normalized search results.',
          status: 'recorded',
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          routes_count: 2,
          recorded_runs: 10
        },
        {
          benchmark_id: 'document-ocr-text-extraction',
          label: 'Document OCR Text Extraction',
          description: 'Extract text from the same simple document/image fixture.',
          status: 'recorded',
          winner_status: 'no_clear_winner',
          winner_claimed: false,
          routes_count: 2,
          recorded_runs: 10
        }
      ],
      agent_guidance: [
        'winner_claimed=false means no route winner should be inferred.',
        'winner_status=no_clear_winner means evidence exists but scoring thresholds do not crown a route.',
        'Use full benchmark endpoints for route-level metrics.'
      ]
    }
  ));
  add('get', '/v1/radar/evidence-ledger', radarGet(
    'Radar Readiness',
    'Get agent-readable evidence ledger',
    'Returns the compact evidence-ledger state agents can inspect before spending through Pay.sh. Includes recorded lanes, scaffold lanes, artifacts, route timeline entrypoints, caveat summaries, and no-winner guidance.',
    { $ref: '#/components/schemas/EvidenceLedgerResponse' },
    {
      generated_at: '2026-05-19T10:00:00.000Z',
      source: 'infopunks-pay-sh-radar',
      ledger_state: {
        recorded_benchmarks: 5,
        total_benchmarks: 10,
        total_artifacts: 6,
        total_recorded_runs: 40,
        proven_routes: 10,
        winner_claimed: false,
        latest_recorded_at: '2026-05-19T09:30:00.000Z'
      }
    }
  ));
  add('get', '/v1/radar/evidence-ledger/brief', radarGet(
    'Radar Readiness',
    'Get compact evidence ledger brief',
    'Returns a compact agent-readable brief derived from the evidence ledger. Includes lane counts and lane-level summaries only; full route timelines and raw artifact bodies are excluded.',
    { $ref: '#/components/schemas/EvidenceLedgerBriefResponse' },
    {
      ledger_state: {
        recorded_benchmarks: 1,
        total_benchmarks: 2,
        total_artifacts: 1,
        total_recorded_runs: 10,
        proven_routes: 2,
        scaffold_lanes: 1,
        winner_claimed: false,
        latest_recorded_at: '2026-05-19T09:30:00.000Z'
      },
      recorded_lanes: [{ benchmark_id: 'document-ocr-text-extraction', label: 'Document OCR Text Extraction', latest_artifact_id: 'document-ocr-text-extraction-benchmark-runs-example', latest_artifact_recorded_runs: 10, total_recorded_runs: 10, recorded_runs: 10, routes_count: 1, winner_claimed: false, winner_status: 'no_clear_winner' }],
      scaffold_lanes: [{ benchmark_id: 'audio-speech-transcription', label: 'Audio Speech Transcription', reason: 'Comparable paid evidence is not yet sufficient for a recorded lane.', next_step: 'record comparable paid-proven evidence before relying on the lane' }],
      recommended_agent_action: 'Inspect the relevant benchmark history and route timeline before spend.',
      agent_guidance: ['Recorded lanes contain artifact-backed route evidence.', 'Scaffold lanes preserve blocked or insufficient comparable paid evidence.'],
      winner_claimed: false
    }
  ));
  add('get', '/v1/radar/bundles', radarGet(
    'Radar Agent',
    'List read-only bundle registry',
    'Returns read-only bundle recipes for agent planning. Radar does not execute paid APIs from this endpoint. winner_claimed=false for every bundle and execution boundaries are advisory only.',
    { $ref: '#/components/schemas/BundleRegistryResponse' },
    {
      generated_at: '2026-05-21T00:00:00.000Z',
      source: 'infopunks-pay-sh-radar',
      count: 3,
      bundles: [
        { bundle_id: 'morning-briefing', label: 'Morning Briefing', status: 'recipe_scaffold', winner_claimed: false },
        { bundle_id: 'market-research', label: 'Market Research', status: 'research_only_pending_billing_review', winner_claimed: false },
        { bundle_id: 'talent-market-scanner', label: 'Talent Market Scanner', status: 'recipe_scaffold', winner_claimed: false }
      ]
    }
  ));
  add('get', '/v1/radar/bundles/{bundle_id}', {
    tags: ['Radar Agent'],
    summary: 'Get bundle by id',
    description: 'Returns one read-only bundle registry record with execution boundaries and evidence references. This route never executes paid APIs.',
    parameters: [pathParam('bundle_id', 'Bundle identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/BundleResponse' }, { bundle_id: 'morning-briefing', status: 'recipe_scaffold', winner_claimed: false }, 'bundle_not_found')
  });
  add('get', '/v1/radar/bundles/{bundle_id}/runs', {
    tags: ['Radar Agent'],
    summary: 'List bundle run ledger records',
    description: 'Returns read-only controlled live run ledger summaries for curated Harness proof records. Radar does not execute paid APIs and does not execute Harness from this route.',
    parameters: [pathParam('bundle_id', 'Bundle identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/BundleRunListResponse' }, { bundle_id: 'morning-briefing', count: 1, winner_claimed: false, runs: [{ run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli', status: 'controlled_live_run', evidence_health: 'caveated' }] }, 'bundle_not_found')
  });
  add('get', '/v1/radar/bundles/{bundle_id}/runs/{run_id}', {
    tags: ['Radar Agent'],
    summary: 'Get bundle run ledger record by id',
    description: 'Returns one full read-only controlled live run detail from curated Harness proof metadata. Includes caveated execution detail and skipped review-required steps.',
    parameters: [pathParam('bundle_id', 'Bundle identifier.'), pathParam('run_id', 'Bundle run identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/BundleRunDetail' }, { run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli', bundle_id: 'morning-briefing', status: 'controlled_live_run', evidence_health: 'caveated', winner_claimed: false }, 'bundle_run_not_found')
  });
  add('post', '/v1/radar/bundles/{bundle_id}/plan', {
    tags: ['Radar Agent'],
    summary: 'Build non-executing bundle route plan',
    description: 'Derives an evidence-aware route plan from read-only bundle registry and evidence metadata before spend. This route does not execute routes and does not execute paid APIs.',
    parameters: [pathParam('bundle_id', 'Bundle identifier.')],
    requestBody: jsonRequest({ $ref: '#/components/schemas/BundlePlanRequest' }, { topic: 'AI, crypto, world news', constraints: { max_cost_usd: 0.05, allow_billing_unclear: false, allow_scaffold_routes: false } }),
    responses: envelopedResponses({ $ref: '#/components/schemas/BundlePlanResponse' }, { bundle_id: 'morning-briefing', status: 'recipe_scaffold', topic: 'AI, crypto, world news', winner_claimed: false }, 'bundle_not_found')
  });
  add('get', '/v1/radar/benchmarks', radarGet('Radar Readiness', 'Get head-to-head benchmark registry', 'Returns recorded head-to-head benchmark scaffolds. A benchmark row can be metrics-pending and never implies a winner claim.', { $ref: '#/components/schemas/BenchmarkRegistryResponse' }, { benchmarks: [] }));
  add('get', '/v1/radar/benchmarks/finance-data-sol-price', radarGet('Radar Readiness', 'Get SOL price benchmark scaffold', 'Returns the finance/data get SOL price head-to-head benchmark scaffold with recorded normalized evidence. benchmark_recorded=true means normalized evidence has been recorded, not that a winner is claimed. winner_status=no_clear_winner means run criteria were met but no route winner is claimed. status_code may be null in pay_cli mode and status_evidence explains proof basis.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'finance-data-sol-price', winner_claimed: false, benchmark_recorded: true, winner_status: 'no_clear_winner' }));
  add('get', '/v1/radar/benchmarks/finance-data-token-search', radarGet('Radar Readiness', 'Get token-search benchmark scaffold', 'Returns the finance/data token-search benchmark with recorded normalized evidence. winner_status=no_clear_winner means no route winner is claimed.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'finance-data-token-search', winner_claimed: false, benchmark_recorded: true, winner_status: 'no_clear_winner' }));
  add('get', '/v1/radar/benchmarks/finance-data-token-metadata', radarGet('Radar Readiness', 'Get token-metadata benchmark scaffold', 'Returns the finance/data token-metadata benchmark with recorded normalized evidence. winner_status=no_clear_winner means no route winner is claimed.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'finance-data-token-metadata', winner_claimed: false, benchmark_recorded: true, winner_status: 'no_clear_winner' }));
  add('get', '/v1/radar/benchmarks/communications-email-delivery', radarGet('Radar Readiness', 'Get communications email-delivery benchmark scaffold', 'Returns the communications email-delivery Benchmark Scaffold. benchmark_recorded=false means no five-run artifact is recorded and no route winner can be inferred.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'communications-email-delivery', winner_claimed: false, benchmark_recorded: false, winner_status: 'not_evaluated', routes: [] }));
  add('get', '/v1/radar/benchmarks/solana-infra-account-balance', radarGet('Radar Readiness', 'Get Solana account balance benchmark scaffold', 'Returns the solana-infra account-balance Benchmark Scaffold. benchmark_recorded=false means no five-run artifact is recorded and no route winner can be inferred.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'solana-infra-account-balance', category: 'solana-infra', benchmark_intent: 'fetch native SOL balance for the same public Solana address', winner_claimed: false, benchmark_recorded: false, winner_status: 'not_evaluated', routes: [] }));
  add('get', '/v1/radar/benchmarks/social-data-reddit-post-search', radarGet('Radar Readiness', 'Get social-data Reddit post search benchmark scaffold', 'Returns the social-data Reddit post search Benchmark Scaffold. benchmark_recorded=false means no five-run artifact is recorded and no route winner can be inferred.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'social-data-reddit-post-search', category: 'social-data', benchmark_intent: 'search Reddit posts for the same keyword query', winner_claimed: false, benchmark_recorded: false, winner_status: 'not_evaluated', routes: [] }));
  add('get', '/v1/radar/benchmarks/maps-place-search-results', radarGet('Radar Readiness', 'Get maps place-search results benchmark scaffold', 'Returns the maps place-search results Benchmark Scaffold. benchmark_recorded=false means no five-run artifact is recorded and no route winner can be inferred.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'maps-place-search-results', category: 'maps', benchmark_intent: 'search for the same local/place query and return normalized place candidates', winner_claimed: false, benchmark_recorded: false, winner_status: 'not_evaluated', next_step: 'find another comparable place-search provider route, or revisit Google Places only if provider schema/output changes; then record one five-run benchmark artifact after two comparable paid-proven routes exist on canonical input {"query":"coffee near Union Square San Francisco","location":"Union Square, San Francisco, CA","limit":5}', readiness_note: 'Benchmark Scaffold. StableEnrich paid-executed recognizable place candidates but degraded evidence; Google Places paid-executed and one paid diagnostic retry (includedType=cafe) still returned zero recognizable place candidates. No second paid-proven comparable route and no benchmark artifact yet.', routes: [] }));
  add('get', '/v1/radar/benchmarks/audio-speech-transcription', radarGet('Radar Readiness', 'Get audio speech transcription benchmark scaffold', 'Returns the audio-ai speech-transcription Benchmark Scaffold. benchmark_recorded=false means no five-run artifact is recorded and no route winner can be inferred.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'audio-speech-transcription', category: 'audio-ai', benchmark_intent: 'transcribe the same short audio fixture into normalized text', winner_claimed: false, benchmark_recorded: false, winner_status: 'not_evaluated', next_step: 'park lane until route schema/output changes allow transcript semantics proof, or a different comparable transcription provider appears; then record one five-run benchmark artifact after two comparable paid-proven routes exist', readiness_note: 'Benchmark Scaffold. Canonical fixture: https://radar.infopunks.fun/fixtures/audio-benchmark-001.wav (HTTP 200, content-type audio/x-wav, WAV PCM 16-bit mono 22050 Hz, size 224258 bytes). Canonical phrase: INFOPUNKS RADAR / EVIDENCE BEFORE SPEND / AUDIO BENCHMARK 001. Google Speech paid execution succeeded and received one shape diagnostic paid retry, but transcript semantics were still not proven; route_state remains candidate/unproven with evidence_health=degraded. Alibaba Speech paid execution succeeded and received one shape diagnostic paid retry, but transcript semantics were still not proven; route_state remains candidate/unproven with evidence_health=degraded. No benchmark artifact exists and winner_claimed remains false.', routes: [] }));
  add('get', '/v1/radar/benchmarks/document-ocr-text-extraction', radarGet('Radar Readiness', 'Get document OCR text extraction benchmark detail', 'Returns the document-ai OCR benchmark with recorded evidence. winner_status=no_clear_winner means no route winner is claimed.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'document-ocr-text-extraction', category: 'document-ai', benchmark_intent: 'extract text from the same simple document/image fixture', winner_claimed: false, benchmark_recorded: true, winner_status: 'no_clear_winner' }));
  add('get', '/v1/radar/benchmarks/data-web-search-results', radarGet('Radar Readiness', 'Get web-search results benchmark', 'Returns the web-search results benchmark with recorded normalized evidence. winner_status=no_clear_winner means no route winner is claimed.', { $ref: '#/components/schemas/BenchmarkDetailResponse' }, { benchmark_id: 'data-web-search-results', category: 'web-search', benchmark_intent: 'search the web for the same query and return normalized search results', winner_claimed: false, benchmark_recorded: true, winner_status: 'no_clear_winner' }));
  add('get', '/v1/radar/benchmarks/finance-data-sol-price/history', radarGet('Radar Readiness', 'Get SOL price benchmark history timeline', 'Returns additive read-only benchmark timeline entries derived from known benchmark artifacts. Entries are evidence snapshots and do not imply a winner claim.', { $ref: '#/components/schemas/BenchmarkHistoryResponse' }, { benchmark_id: 'finance-data-sol-price', artifact_count: 1, latest_artifact_id: 'finance-data-sol-price-benchmark-runs-2026-05-16', winner_claimed: false, entries: [{ run_count: 5, benchmark_recorded: true, winner_status: 'no_clear_winner', winner_claimed: false }] }));
  add('get', '/v1/radar/benchmark-history', radarGet('Radar Readiness', 'Get aggregate benchmark history', 'Returns compact artifact-backed benchmark history rollups for recorded benchmarks. No raw proof contents are exposed and no winner claim is implied.', { $ref: '#/components/schemas/BenchmarkHistoryV2AggregateResponse' }, { history_count: 5, total_artifacts: 6, total_recorded_runs: 40, winner_claimed: false, benchmarks: [{ benchmark_id: 'finance-data-sol-price', winner_claimed: false }] }));
  add('get', '/v1/radar/benchmark-history/{benchmark_id}', {
    tags: ['Radar Readiness'],
    summary: 'Get benchmark history by benchmark id',
    description: `${SAFE_METADATA_NOTE} Returns compact metadata-only benchmark history for one benchmark id. Artifacts are evidence records only; raw proof contents are not exposed.`,
    parameters: [pathParam('benchmark_id', 'Benchmark identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/BenchmarkHistoryV2DetailResponse' }, { benchmark_id: 'finance-data-sol-price', label: 'SOL price', status: 'recorded', artifact_count: 1, total_recorded_runs: 5, winner_claimed: false }, 'benchmark_not_found')
  });
  add('get', '/v1/radar/benchmark-history/{benchmark_id}/routes', {
    tags: ['Radar Readiness'],
    summary: 'Get benchmark route history aggregate',
    description: `${SAFE_METADATA_NOTE} Returns route-level artifact timelines for one benchmark without exposing raw proofs. Evidence is grouped by route and winner_claimed remains false unless explicitly present in artifact data.`,
    parameters: [pathParam('benchmark_id', 'Benchmark identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/BenchmarkRouteHistoryAggregateResponse' }, { benchmark_id: 'finance-data-token-metadata', route_count: 2, artifact_count: 2, winner_claimed: false, routes: [{ route_id: 'paysponge-coingecko:GET:/x402/onchain/networks/solana/tokens/So11111111111111111111111111111111111111112', provider_id: 'paysponge-coingecko', artifact_count: 2, latest_detection_rate: 1, winner_status: 'no_clear_winner', winner_claimed: false, evidence_health: 'recorded', caveats: [], caveat_objects: [{ code: 'pay_cli_status_hidden', severity: 'info', message: 'HTTP status is unavailable in pay_cli evidence mode; inspect status_evidence for proof context.', evidence_field: 'status_code', value: null }] }] }, 'benchmark_not_found')
  });
  add('get', '/v1/radar/benchmark-history/{benchmark_id}/routes/{route_id}', {
    tags: ['Radar Readiness'],
    summary: 'Get benchmark route history timeline',
    description: `${SAFE_METADATA_NOTE} Returns the artifact-backed evidence timeline for one benchmark route. Raw proof contents are not exposed and Radar does not infer route winners.`,
    parameters: [pathParam('benchmark_id', 'Benchmark identifier.'), pathParam('route_id', 'Route identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/BenchmarkRouteHistoryDetailResponse' }, { benchmark_id: 'finance-data-token-metadata', route_id: 'paysponge-coingecko:GET:/x402/onchain/networks/solana/tokens/So11111111111111111111111111111111111111112', artifact_count: 2, winner_claimed: false, evidence_health: 'recorded', timeline: [{ artifact_id: 'finance-data-token-metadata-benchmark-runs-2026-05-19', success_count: 5, failure_count: 0, median_latency_ms: 5430, p95_latency_ms: 5730, status_code: null, winner_status: 'no_clear_winner', winner_claimed: false, evidence_health: 'recorded', metrics: { canonical_network_match_rate: 1 }, caveats: [], caveat_objects: [{ code: 'pay_cli_status_hidden', severity: 'info', message: 'HTTP status is unavailable in pay_cli evidence mode; inspect status_evidence for proof context.', evidence_field: 'status_code', value: null }] }] }, 'route_not_found')
  });
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
      { name: 'Machine Economy' },
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
      dbStatus: enumSchema(['ok', 'degraded', 'unavailable']),
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
    BenchmarkRouteSummary: objectSchema({
      provider_id: stringSchema(),
      route_id: stringSchema(),
      latency_summary: objectSchema({
        latest_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
        median_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
        p95_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] }
      }),
      reliability_summary: objectSchema({
        success_rate: { oneOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] },
        completed_runs: { oneOf: [integerSchema(), { type: 'null' }] },
        failed_runs: { oneOf: [integerSchema(), { type: 'null' }] }
      })
    }),
    BenchmarkHistoryResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      benchmark_id: stringSchema(),
      entries: arrayOf({ $ref: '#/components/schemas/BenchmarkHistoryEntry' }),
      first_recorded_at: dateTimeSchema(),
      latest_recorded_at: dateTimeSchema(),
      artifact_count: integerSchema(),
      latest_artifact_id: stringSchema(),
      total_recorded_runs: integerSchema(),
      routes_count: integerSchema(),
      winner_status: benchmarkWinnerStatus,
      winner_claimed: booleanSchema(),
      route_summaries: arrayOf({ $ref: '#/components/schemas/BenchmarkRouteSummary' })
    }),
    BenchmarkHistoryAggregateResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      benchmarks: arrayOf(objectSchema({
        benchmark_id: stringSchema(),
        first_recorded_at: dateTimeSchema(),
        latest_recorded_at: dateTimeSchema(),
        artifact_count: integerSchema(),
        latest_artifact_id: stringSchema(),
        total_recorded_runs: integerSchema(),
        routes_count: integerSchema(),
        winner_status: benchmarkWinnerStatus,
        winner_claimed: booleanSchema(),
        route_summaries: arrayOf({ $ref: '#/components/schemas/BenchmarkRouteSummary' })
      }))
    }),
    BenchmarkHistoryV2Artifact: objectSchema({
      artifact_id: stringSchema(),
      recorded_at: dateTimeSchema(),
      recorded_runs: integerSchema(),
      routes_count: integerSchema(),
      winner_status: benchmarkWinnerStatus,
      winner_claimed: booleanSchema()
    }),
    BenchmarkHistoryV2Row: objectSchema({
      benchmark_id: stringSchema(),
      label: stringSchema(),
      status: enumSchema(['recorded', 'planned']),
      first_recorded_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      latest_recorded_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      artifact_count: integerSchema(),
      latest_artifact_id: { oneOf: [stringSchema(), { type: 'null' }] },
      total_recorded_runs: integerSchema(),
      routes_count: integerSchema(),
      winner_status: benchmarkWinnerStatus,
      winner_claimed: booleanSchema()
    }),
    BenchmarkHistoryV2AggregateResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      history_count: integerSchema(),
      total_artifacts: integerSchema(),
      total_recorded_runs: integerSchema(),
      winner_claimed: booleanSchema(),
      benchmarks: arrayOf({ $ref: '#/components/schemas/BenchmarkHistoryV2Row' })
    }),
    BenchmarkHistoryV2DetailResponse: objectSchema({
      benchmark_id: stringSchema(),
      label: stringSchema(),
      status: enumSchema(['recorded', 'planned']),
      first_recorded_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      latest_recorded_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      artifact_count: integerSchema(),
      artifacts: arrayOf({ $ref: '#/components/schemas/BenchmarkHistoryV2Artifact' }),
      total_recorded_runs: integerSchema(),
      routes_count: integerSchema(),
      winner_status: benchmarkWinnerStatus,
      winner_claimed: booleanSchema()
    }),
    EvidenceCaveat: objectSchema({
      code: enumSchema([
        'status_code_unavailable',
        'pay_cli_status_hidden',
        'canonical_network_mismatch',
        'canonical_address_mismatch',
        'canonical_decimals_mismatch',
        'metadata_semantics_partial',
        'non_metadata_payload',
        'price_only_response',
        'pool_only_response',
        'search_only_response',
        'balance_only_response',
        'allowance_only_response',
        'route_not_found',
        'payment_required_confirmed_only',
        'paid_payload_unobserved'
      ]),
      severity: enumSchema(['info', 'warning', 'critical']),
      message: stringSchema(),
      evidence_field: { oneOf: [stringSchema(), { type: 'null' }] },
      value: { oneOf: [stringSchema(), { type: 'number' }, booleanSchema(), { type: 'null' }] }
    }),
    EvidenceHealth: enumSchema([
      'recorded',
      'caveated',
      'stale',
      'degraded',
      'unverified',
      'scaffold'
    ]),
    BenchmarkRouteHistorySummary: objectSchema({
      route_id: stringSchema(),
      provider_id: stringSchema(),
      label: stringSchema(),
      artifact_count: integerSchema(),
      first_recorded_at: dateTimeSchema(),
      latest_recorded_at: dateTimeSchema(),
      latest_artifact_id: stringSchema(),
      latest_success_count: { oneOf: [integerSchema(), { type: 'null' }] },
      latest_failure_count: { oneOf: [integerSchema(), { type: 'null' }] },
      latest_median_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      latest_p95_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      latest_detection_rate: { oneOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] },
      winner_status: benchmarkWinnerStatus,
      winner_claimed: booleanSchema(),
      evidence_health: { $ref: '#/components/schemas/EvidenceHealth' },
      caveats: arrayOf(stringSchema()),
      caveat_objects: arrayOf({ $ref: '#/components/schemas/EvidenceCaveat' })
    }),
    BenchmarkRouteHistoryAggregateResponse: objectSchema({
      benchmark_id: stringSchema(),
      label: stringSchema(),
      route_count: integerSchema(),
      artifact_count: integerSchema(),
      winner_claimed: booleanSchema(),
      routes: arrayOf({ $ref: '#/components/schemas/BenchmarkRouteHistorySummary' })
    }),
    BenchmarkRouteHistoryTimelineEntry: objectSchema({
      artifact_id: stringSchema(),
      recorded_at: dateTimeSchema(),
      success_count: { oneOf: [integerSchema(), { type: 'null' }] },
      failure_count: { oneOf: [integerSchema(), { type: 'null' }] },
      median_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      p95_latency_ms: { oneOf: [integerSchema(), { type: 'null' }] },
      status_code: { oneOf: [integerSchema(), { type: 'null' }] },
      status_evidence: stringSchema(),
      winner_status: benchmarkWinnerStatus,
      winner_claimed: booleanSchema(),
      evidence_health: { $ref: '#/components/schemas/EvidenceHealth' },
      metrics: { type: 'object', additionalProperties: { oneOf: [{ type: 'number' }, { type: 'null' }] } },
      caveats: arrayOf(stringSchema()),
      caveat_objects: arrayOf({ $ref: '#/components/schemas/EvidenceCaveat' })
    }),
    BenchmarkRouteHistoryDetailResponse: objectSchema({
      benchmark_id: stringSchema(),
      route_id: stringSchema(),
      provider_id: stringSchema(),
      label: stringSchema(),
      artifact_count: integerSchema(),
      winner_claimed: booleanSchema(),
      evidence_health: { $ref: '#/components/schemas/EvidenceHealth' },
      timeline: arrayOf({ $ref: '#/components/schemas/BenchmarkRouteHistoryTimelineEntry' })
    }),
    BenchmarkRegistryResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      benchmarks: arrayOf({ $ref: '#/components/schemas/BenchmarkDetailResponse' })
    }),
    BenchmarkSummaryRow: objectSchema({
      benchmark_id: stringSchema(),
      label: stringSchema(),
      description: stringSchema(),
      status: { const: 'recorded' },
      winner_status: benchmarkWinnerStatus,
      winner_claimed: booleanSchema(),
      routes_count: integerSchema(),
      recorded_runs: integerSchema()
    }),
    BenchmarkSummaryResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      latest_recorded_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      total_artifacts: integerSchema(),
      recorded_benchmarks: integerSchema(),
      total_benchmarks: integerSchema(),
      winner_claimed: booleanSchema(),
      total_recorded_runs: integerSchema(),
      proven_routes: integerSchema(),
      benchmarks: arrayOf({ $ref: '#/components/schemas/BenchmarkSummaryRow' }),
      agent_guidance: arrayOf(stringSchema())
    }),
    EvidenceLedgerRecordedLane: objectSchema({
      benchmark_id: stringSchema(),
      label: stringSchema(),
      description: stringSchema(),
      status: { const: 'recorded' },
      artifact_count: integerSchema(),
      recorded_runs: integerSchema(),
      routes_count: integerSchema(),
      proven_routes_count: integerSchema(),
      winner_status: benchmarkWinnerStatus,
      winner_claimed: booleanSchema(),
      latest_artifact_id: { oneOf: [stringSchema(), { type: 'null' }] },
      latest_recorded_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      evidence_health_summary: objectSchema({
        recorded: integerSchema(),
        caveated: integerSchema(),
        stale: integerSchema(),
        degraded: integerSchema(),
        unverified: integerSchema(),
        scaffold: integerSchema()
      }),
      routes_endpoint: stringSchema()
    }),
    EvidenceLedgerScaffoldLane: objectSchema({
      benchmark_id: stringSchema(),
      label: stringSchema(),
      status: { const: 'scaffold' },
      promotion_status: enumSchema(['blocked', 'pending']),
      why_not_promoted: arrayOf(stringSchema()),
      missing_requirements: arrayOf(stringSchema()),
      known_evidence: arrayOf(stringSchema())
    }),
    EvidenceLedgerBriefRecordedLane: objectSchema({
      benchmark_id: stringSchema(),
      label: stringSchema(),
      latest_artifact_id: { oneOf: [stringSchema(), { type: 'null' }] },
      latest_artifact_recorded_runs: integerSchema(),
      total_recorded_runs: integerSchema(),
      recorded_runs: integerSchema(),
      routes_count: integerSchema(),
      winner_claimed: booleanSchema(),
      winner_status: benchmarkWinnerStatus
    }),
    EvidenceLedgerBriefScaffoldLane: objectSchema({
      benchmark_id: stringSchema(),
      label: stringSchema(),
      reason: stringSchema(),
      next_step: stringSchema()
    }),
    EvidenceLedgerLatestArtifact: objectSchema({
      artifact_id: stringSchema(),
      benchmark_id: stringSchema(),
      label: stringSchema(),
      recorded_at: dateTimeSchema(),
      recorded_runs: integerSchema(),
      routes_count: integerSchema(),
      winner_claimed: booleanSchema(),
      winner_status: benchmarkWinnerStatus
    }),
    EvidenceLedgerRouteEntrypoint: objectSchema({
      benchmark_id: stringSchema(),
      routes_endpoint: stringSchema(),
      route_detail_note: stringSchema()
    }),
    EvidenceLedgerResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      ledger_state: objectSchema({
        recorded_benchmarks: integerSchema(),
        total_benchmarks: integerSchema(),
        total_artifacts: integerSchema(),
        total_recorded_runs: integerSchema(),
        proven_routes: integerSchema(),
        winner_claimed: booleanSchema(),
        latest_recorded_at: { oneOf: [dateTimeSchema(), { type: 'null' }] }
      }),
      doctrine: objectSchema({
        spend_rail: { const: 'Pay.sh' },
        evidence_ledger: { const: 'Radar' },
        proof_adapter: { const: 'Agent Harness' },
        summary: stringSchema()
      }),
      agent_guidance: arrayOf(stringSchema()),
      recorded_lanes: arrayOf({ $ref: '#/components/schemas/EvidenceLedgerRecordedLane' }),
      scaffold_lanes: arrayOf({ $ref: '#/components/schemas/EvidenceLedgerScaffoldLane' }),
      latest_artifacts: arrayOf({ $ref: '#/components/schemas/EvidenceLedgerLatestArtifact' }),
      route_timeline_entrypoints: arrayOf({ $ref: '#/components/schemas/EvidenceLedgerRouteEntrypoint' }),
      caveat_summary: objectSchema({
        policy: stringSchema(),
        common_codes: arrayOf(stringSchema())
      })
    }),
    EvidenceLedgerBriefResponse: objectSchema({
      ledger_state: objectSchema({
        recorded_benchmarks: integerSchema(),
        total_benchmarks: integerSchema(),
        total_artifacts: integerSchema(),
        total_recorded_runs: integerSchema(),
        proven_routes: integerSchema(),
        scaffold_lanes: integerSchema(),
        winner_claimed: booleanSchema(),
        latest_recorded_at: { oneOf: [dateTimeSchema(), { type: 'null' }] }
      }),
      recorded_lanes: arrayOf({ $ref: '#/components/schemas/EvidenceLedgerBriefRecordedLane' }),
      scaffold_lanes: arrayOf({ $ref: '#/components/schemas/EvidenceLedgerBriefScaffoldLane' }),
      recommended_agent_action: stringSchema(),
      agent_guidance: arrayOf(stringSchema()),
      winner_claimed: booleanSchema()
    }),
    BundleStatus: { type: 'string', enum: ['recipe_scaffold', 'partially_supported', 'research_only_pending_billing_review', 'execution_ready', 'recorded'] },
    BundleExecutionBoundary: { type: 'string', enum: ['clean_402', 'paid_proven', 'billing_unclear', 'billable_probe_observed', 'blocked'] },
    BundleStepEvidenceHealth: { type: 'string', enum: ['recorded', 'caveated', 'scaffold'] },
    BundleStep: objectSchema({
      step_id: stringSchema(),
      label: stringSchema(),
      intent: stringSchema(),
      candidate_routes: arrayOf(stringSchema()),
      evidence_dependencies: arrayOf(stringSchema()),
      evidence_health: { $ref: '#/components/schemas/BundleStepEvidenceHealth' },
      execution_boundary: { $ref: '#/components/schemas/BundleExecutionBoundary' },
      known_caveats: arrayOf(stringSchema())
    }),
    BundleEvidenceReference: objectSchema({
      benchmark_id: stringSchema(),
      lane_status: { type: 'string', enum: ['recorded', 'scaffold', 'unknown'] }
    }),
    BundleResponse: objectSchema({
      bundle_id: stringSchema(),
      label: stringSchema(),
      status: { $ref: '#/components/schemas/BundleStatus' },
      summary: stringSchema(),
      input_schema: freeformObject(),
      output_shape: freeformObject(),
      steps: arrayOf({ $ref: '#/components/schemas/BundleStep' }),
      evidence_dependencies: arrayOf(stringSchema()),
      evidence_references: arrayOf({ $ref: '#/components/schemas/BundleEvidenceReference' }),
      estimated_cost_usd: stringSchema(),
      known_caveats: arrayOf(stringSchema()),
      winner_claimed: booleanSchema(),
      recommended_agent_action: stringSchema()
    }),
    BundleRegistryResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      count: integerSchema(),
      bundles: arrayOf({ $ref: '#/components/schemas/BundleResponse' })
    }),
    BundlePlanConstraints: objectSchema({
      max_cost_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      allow_billing_unclear: booleanSchema(),
      allow_billable_probe_observed: booleanSchema(),
      allow_scaffold_routes: booleanSchema(),
      require_recorded_evidence: booleanSchema()
    }),
    BundlePlanRequest: objectSchema({
      topic: stringSchema(),
      focus: nullableString(),
      region: nullableString(),
      language: nullableString(),
      constraints: { $ref: '#/components/schemas/BundlePlanConstraints' }
    }, ['topic']),
    BundlePlanStepStatus: enumSchema(['included', 'blocked', 'review_required']),
    BundlePlanBlockedReason: enumSchema([
      'billing_unclear_not_allowed',
      'scaffold_not_allowed',
      'billable_probe_observed_not_allowed',
      'missing_recorded_evidence'
    ]),
    BundlePlanStep: objectSchema({
      step_id: stringSchema(),
      label: stringSchema(),
      intent: stringSchema(),
      plan_status: { $ref: '#/components/schemas/BundlePlanStepStatus' },
      evidence_dependencies: arrayOf(stringSchema()),
      evidence_health: { $ref: '#/components/schemas/BundleStepEvidenceHealth' },
      execution_boundary: { $ref: '#/components/schemas/BundleExecutionBoundary' },
      reason: stringSchema(),
      next_action: stringSchema()
    }),
    BundlePlanBlockedStep: objectSchema({
      step_id: stringSchema(),
      reason: { $ref: '#/components/schemas/BundlePlanBlockedReason' }
    }),
    BundlePlanResponse: objectSchema({
      bundle_id: stringSchema(),
      label: stringSchema(),
      status: { $ref: '#/components/schemas/BundleStatus' },
      topic: stringSchema(),
      focus: nullableString(),
      region: nullableString(),
      language: nullableString(),
      constraints: { $ref: '#/components/schemas/BundlePlanConstraints' },
      route_plan: arrayOf({ $ref: '#/components/schemas/BundlePlanStep' }),
      blocked_steps: arrayOf({ $ref: '#/components/schemas/BundlePlanBlockedStep' }),
      execution_boundary_summary: objectSchema({
        clean_402: integerSchema(),
        paid_proven: integerSchema(),
        billing_unclear: integerSchema(),
        billable_probe_observed: integerSchema(),
        blocked: integerSchema()
      }),
      evidence_summary: objectSchema({
        recorded: integerSchema(),
        caveated: integerSchema(),
        scaffold: integerSchema(),
        unknown: integerSchema()
      }),
      estimated_cost_usd: stringSchema(),
      recommended_agent_action: stringSchema(),
      winner_claimed: { const: false }
    }),
    BundleRunStatus: enumSchema(['controlled_live_run']),
    BundleRunExecutionMode: enumSchema(['pay_cli']),
    BundleRunFinalState: enumSchema(['executed_with_review_required_skipped']),
    BundleRunStepExecution: objectSchema({
      step_id: stringSchema(),
      execution_boundary: { $ref: '#/components/schemas/BundleExecutionBoundary' },
      success: booleanSchema(),
      status_code: { oneOf: [integerSchema(), { type: 'null' }] },
      status_evidence: stringSchema(),
      observed_cost_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      normalized_output_preview: freeformObject(),
      source_count: integerSchema()
    }),
    BundleRunSkippedStep: objectSchema({
      step_id: stringSchema(),
      plan_status: { const: 'review_required' },
      execution_boundary: { $ref: '#/components/schemas/BundleExecutionBoundary' },
      reason: stringSchema()
    }),
    BundleRunBlockedStep: objectSchema({
      step_id: stringSchema(),
      plan_status: { oneOf: [{ const: 'blocked' }, { type: 'null' }] },
      execution_boundary: { oneOf: [{ $ref: '#/components/schemas/BundleExecutionBoundary' }, { type: 'null' }] },
      reason: stringSchema()
    }),
    BundleRunSourceMapItem: objectSchema({
      label: stringSchema(),
      url: stringSchema()
    }),
    BundleRunCaveatObject: objectSchema({
      code: enumSchema(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty']),
      severity: { const: 'warning' },
      affects_core_semantics: booleanSchema(),
      detail: stringSchema()
    }),
    BundleRunSummary: objectSchema({
      run_id: stringSchema(),
      status: { $ref: '#/components/schemas/BundleRunStatus' },
      evidence_health: { const: 'caveated' },
      generated_at: dateTimeSchema(),
      execution_mode: { $ref: '#/components/schemas/BundleRunExecutionMode' },
      final_bundle_state: { $ref: '#/components/schemas/BundleRunFinalState' },
      estimated_cost_usd: stringSchema(),
      observed_cost_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      executed_step_count: integerSchema(),
      skipped_step_count: integerSchema(),
      blocked_step_count: integerSchema(),
      source_count: integerSchema(),
      winner_claimed: { const: false }
    }),
    BundleRunDetail: objectSchema({
      run_id: stringSchema(),
      bundle_id: { const: 'morning-briefing' },
      status: { $ref: '#/components/schemas/BundleRunStatus' },
      evidence_health: { const: 'caveated' },
      winner_claimed: { const: false },
      generated_at: dateTimeSchema(),
      execution_mode: { $ref: '#/components/schemas/BundleRunExecutionMode' },
      live_execution_enabled: { const: true },
      final_bundle_state: { $ref: '#/components/schemas/BundleRunFinalState' },
      estimated_cost_usd: stringSchema(),
      observed_cost_usd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      radar_plan_endpoint: stringSchema(),
      canonical_request: freeformObject(),
      route_plan_summary: freeformObject(),
      executed_steps: arrayOf({ $ref: '#/components/schemas/BundleRunStepExecution' }),
      skipped_steps: arrayOf({ $ref: '#/components/schemas/BundleRunSkippedStep' }),
      blocked_steps: arrayOf({ $ref: '#/components/schemas/BundleRunBlockedStep' }),
      source_map: arrayOf({ $ref: '#/components/schemas/BundleRunSourceMapItem' }),
      caveat_objects: arrayOf({ $ref: '#/components/schemas/BundleRunCaveatObject' }),
      recommended_next_action: stringSchema()
    }),
    BundleRunListResponse: objectSchema({
      bundle_id: { const: 'morning-briefing' },
      count: integerSchema(),
      runs: arrayOf({ $ref: '#/components/schemas/BundleRunSummary' }),
      winner_claimed: { const: false },
      agent_guidance: arrayOf(stringSchema())
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
    RouteCandidatesExportResponse: freeformObject(),
    MachineMarketService: objectSchema({
      id: stringSchema(),
      name: stringSchema(),
      provider: stringSchema(),
      category: enumSchema(['compute', 'inference', 'web', 'vision', 'storage', 'translation']),
      market_type: enumSchema(['digital', 'physical', 'all-compatible']),
      source_market: enumSchema(['robotic.sh', 'pay.sh', 'agentic.market']),
      chain: enumSchema(['solana', 'base', 'peaq', 'omnichain']),
      status: enumSchema(['ready', 'setup']),
      price_display: stringSchema(),
      description: stringSchema(),
      machine_use_case: stringSchema(),
      evidence_health: enumSchema(['scaffold', 'listed']),
      evidence_stage: enumSchema(['listed', 'classified', 'policy-mapped', 'preflight-ready', 'execution-tested', 'receipt-recorded', 'benchmark-recorded']),
      policy_risk: stringSchema(),
      caveats: arrayOf(stringSchema()),
      observed_source: { const: 'robotic.sh' },
      observed_at: dateTimeSchema(),
      phase_scope: { const: 'phase_2_pay_sh_robotic_sh' }
    }),
    MachineMarketServiceListResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      module: { const: 'machine-economy' },
      count: integerSchema(),
      services: arrayOf({ $ref: '#/components/schemas/MachineMarketService' })
    }),
    MachineMarketSummaryResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      module: { const: 'machine-economy' },
      total_services: integerSchema(),
      categories: freeformObject(),
      source_markets: freeformObject(),
      chains: freeformObject(),
      ready_count: integerSchema(),
      setup_count: integerSchema(),
      evidence_stage_counts: freeformObject(),
      phase_scope: { const: 'phase_2_pay_sh_robotic_sh' },
      positioning: objectSchema({
        module: stringSchema(),
        terminal: stringSchema(),
        market_policy: stringSchema(),
        spend_policy: stringSchema(),
        radar_role: stringSchema()
      })
    }),
    MachinePolicy: objectSchema({
      id: stringSchema(),
      name: stringSchema(),
      description: stringSchema(),
      machine_id: stringSchema(),
      owner_label: stringSchema(),
      daily_budget_usd: { type: 'number', minimum: 0 },
      per_call_budget_usd: { type: 'number', minimum: 0 },
      allowed_categories: arrayOf(enumSchema(['compute', 'inference', 'web', 'vision', 'storage', 'translation'])),
      blocked_categories: arrayOf(enumSchema(['compute', 'inference', 'web', 'vision', 'storage', 'translation'])),
      allowed_source_markets: arrayOf(enumSchema(['robotic.sh', 'pay.sh', 'agentic.market'])),
      blocked_source_markets: arrayOf(enumSchema(['robotic.sh', 'pay.sh', 'agentic.market'])),
      allowed_chains: arrayOf(enumSchema(['solana', 'base', 'peaq', 'omnichain'])),
      blocked_chains: arrayOf(enumSchema(['solana', 'base', 'peaq', 'omnichain'])),
      allowed_services: arrayOf(stringSchema()),
      blocked_services: arrayOf(stringSchema()),
      approval_required_above_usd: { type: 'number', minimum: 0 },
      minimum_evidence_stage: enumSchema(['listed', 'classified', 'policy-mapped', 'preflight-ready', 'execution-tested', 'receipt-recorded', 'benchmark-recorded']),
      minimum_evidence_health: enumSchema(['scaffold', 'listed']),
      risk_tolerance: enumSchema(['low', 'medium', 'high']),
      receipt_required: booleanSchema(),
      human_review_required_for: arrayOf(stringSchema()),
      created_at: dateTimeSchema(),
      updated_at: dateTimeSchema(),
      status: enumSchema(['active', 'draft', 'paused'])
    }),
    MachinePolicyTemplateListResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      module: { const: 'machine-economy' },
      positioning: objectSchema({ authority: stringSchema(), boundary: stringSchema() }),
      count: integerSchema(),
      templates: arrayOf({ $ref: '#/components/schemas/MachinePolicy' })
    }),
    MachinePolicyTemplateResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      module: { const: 'machine-economy' },
      policy: { $ref: '#/components/schemas/MachinePolicy' }
    }),
    MachinePolicyCheck: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      status: enumSchema(['pass', 'fail', 'review']),
      detail: stringSchema()
    }),
    MachinePreflightRequest: objectSchema({
      machine_id: stringSchema(),
      intent: stringSchema(),
      category: stringSchema(),
      max_cost_usd: { type: 'number', minimum: 0 },
      allowed_markets: arrayOf(enumSchema(['robotic.sh', 'pay.sh', 'agentic.market'])),
      allowed_chains: arrayOf(enumSchema(['solana', 'base', 'peaq', 'omnichain'])),
      risk_tolerance: enumSchema(['low', 'medium', 'high']),
      requires_receipt: booleanSchema(),
      policy_id: stringSchema(),
      minimum_evidence_stage: enumSchema(['listed', 'classified', 'policy-mapped', 'preflight-ready', 'execution-tested', 'receipt-recorded', 'benchmark-recorded'])
    }, ['machine_id', 'intent', 'category']),
    MachinePreflightServiceSummary: objectSchema({
      id: stringSchema(),
      name: stringSchema(),
      provider: stringSchema(),
      category: enumSchema(['compute', 'inference', 'web', 'vision', 'storage', 'translation']),
      source_market: enumSchema(['robotic.sh', 'pay.sh', 'agentic.market']),
      chain: enumSchema(['solana', 'base', 'peaq', 'omnichain']),
      status: stringSchema(),
      price_display: stringSchema(),
      evidence_stage: stringSchema(),
      evidence_health: stringSchema(),
      policy_risk: stringSchema()
    }),
    MachinePreflightResponse: objectSchema({
      decision: enumSchema(['allow', 'deny', 'review']),
      recommended_service: { oneOf: [{ $ref: '#/components/schemas/MachinePreflightServiceSummary' }, { type: 'null' }] },
      source_market: { type: ['string', 'null'], enum: ['robotic.sh', 'pay.sh', 'agentic.market', null] },
      chain: { type: ['string', 'null'], enum: ['solana', 'base', 'peaq', 'omnichain', null] },
      reason: stringSchema(),
      policy_checks: arrayOf({ $ref: '#/components/schemas/MachinePolicyCheck' }),
      violations: arrayOf(stringSchema()),
      review_reasons: arrayOf(stringSchema()),
      caveats: arrayOf(stringSchema()),
      evidence_stage: nullableString(),
      evidence_health: nullableString(),
      receipt_id: stringSchema(),
      receipt_required: booleanSchema(),
      phase_scope: { const: 'phase_2_pay_sh_robotic_sh' }
    }),
    MachinePreflightReceipt: objectSchema({
      receipt_id: stringSchema(),
      receipt_type: { const: 'machine_preflight' },
      machine_id: stringSchema(),
      policy_id: nullableString(),
      intent: stringSchema(),
      requested_category: stringSchema(),
      selected_service_id: nullableString(),
      selected_service_name: nullableString(),
      source_market: nullableString(),
      chain: nullableString(),
      decision: enumSchema(['allow', 'deny', 'review']),
      reason: stringSchema(),
      policy_checks: arrayOf({ $ref: '#/components/schemas/MachinePolicyCheck' }),
      violations: arrayOf(stringSchema()),
      review_reasons: arrayOf(stringSchema()),
      caveats: arrayOf(stringSchema()),
      max_cost_usd: { type: ['number', 'null'], minimum: 0 },
      evidence_stage: nullableString(),
      evidence_health: nullableString(),
      phase_scope: { const: 'phase_2_pay_sh_robotic_sh' },
      created_at: dateTimeSchema()
    }),
    MachinePreflightReceiptListResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      module: { const: 'machine-economy' },
      count: integerSchema(),
      receipts: arrayOf({ $ref: '#/components/schemas/MachinePreflightReceipt' })
    })
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
