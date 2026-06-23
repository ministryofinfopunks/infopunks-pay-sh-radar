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
    summary: 'Get structured receipt detail',
    description: 'Returns either a public event receipt or a pre-spend receipt detail with linked route, provider, service, and evidence impact.',
    parameters: [pathParam('event_id', 'Receipt event identifier.')],
    responses: envelopedResponses({
      oneOf: [
        { $ref: '#/components/schemas/ReceiptResponse' },
        { $ref: '#/components/schemas/PreSpendReceiptDetailResponse' }
      ]
    }, { receipt_id: 'receipt_003', route_id: 'route_pay_sh_market_research_03', impact: { freshness: 'fresh', human_validated: true } }, 'receipt_not_found')
  });
  add('get', '/v1/receipts', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'List pre-spend receipts',
    description: 'Returns recent route-run receipts and validation state.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      metrics: { $ref: '#/components/schemas/PreSpendMetrics' },
      receipts: arrayOf({ $ref: '#/components/schemas/PreSpendReceipt' })
    }), { receipts: [{ receipt_id: 'receipt_001', route_id: 'route_pay_sh_market_research_01' }] })
  });
  add('post', '/v1/receipts', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'Create pre-spend receipt',
    description: 'Creates a new in-memory receipt object for route-run evidence.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/PreSpendReceiptCreateRequest' }, {
      agent_id: 'agent_077',
      route_id: 'route_pay_sh_token_quote_01',
      provider_id: 'provider_pay_sh_quartz',
      service_id: 'service_token_pricing',
      task_type: 'price_token_quote',
      cost: '0.07 USDC',
      payment_method: 'stablecoin',
      latency_ms: 260,
      input_summary: 'SOL/USDC quote request',
      output_summary: 'bounded quote JSON',
      status: 'succeeded',
      failure_reason: null,
      validation_state: 'machine_checked',
      human_notes: [],
      confidence_delta: 3,
      evidence_artifact: 'artifact_token_quote_run_004'
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/PreSpendReceipt' }, { receipt_id: 'receipt_012', route_id: 'route_pay_sh_token_quote_01' })
  });
  add('post', '/v1/validation/submit', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'Submit human validation annotation',
    description: 'Accepts validation notes, quality notes, disputes, blocker notes, and confidence adjustments for routes, providers, services, or receipts.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/HumanValidationSubmission' }, {
      target_type: 'receipt',
      target_id: 'receipt_003',
      validator_id: 'validator_001',
      validation_state: 'human_validated',
      output_quality_note: 'structured and directly usable',
      blocker_note: null,
      dispute_note: null,
      confidence_adjustment: 6,
      human_notes: 'Verified pre-spend decision quality.'
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/HumanValidationSubmission' }, { target_type: 'receipt', target_id: 'receipt_003', validation_state: 'human_validated' })
  });
  add('post', '/v1/check', {
    tags: ['Proof Feed'],
    summary: 'Create proof check',
    description: 'Creates a deterministic Infopunks Receipt Check from pasted claim, route, provider, wallet, project, or link input. No external scraping is performed in this MVP.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/ProofCheckInput' }, {
      input: 'Pay.sh route claims repeatable market intelligence performance.',
      sourceUrl: 'https://example.com/pay-sh-route-demo',
      submittedBy: 'builder_ui'
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/ProofCheckResult' }, {
      check_id: 'check_route_pay_sh_seed',
      claim: 'Pay.sh route claims repeatable market intelligence performance.',
      decision_state: 'caution'
    })
  });
  add('get', '/v1/checks', {
    tags: ['Proof Feed'],
    summary: 'List proof checks',
    description: 'Returns seeded and newly created public proof checks for the Receipt Check feed.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      checks: arrayOf({ $ref: '#/components/schemas/ProofCheckResult' })
    }), { checks: [{ check_id: 'check_route_pay_sh_seed', decision_state: 'caution' }] })
  });
  add('get', '/v1/checks/{check_id}', {
    tags: ['Proof Feed'],
    summary: 'Get proof check detail',
    description: 'Returns one Infopunks Receipt Check for a public share page.',
    parameters: [pathParam('check_id', 'Proof check identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/ProofCheckResult' }, {
      check_id: 'check_provider_reliability_seed',
      decision_state: 'trust',
      public_cta: 'Agents can spend. Infopunks helps them judge.'
    }, 'proof_check_not_found')
  });
  add('get', '/v1/claims', {
    tags: ['Claims'],
    summary: 'List claims',
    description: 'Returns structured claim objects backed by receipts and validation context. Claims are reusable signal, not token votes or payment execution.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      metrics: { $ref: '#/components/schemas/PreSpendMetrics' },
      claims: arrayOf({ $ref: '#/components/schemas/Claim' })
    }), { claims: [{ claim_id: 'claim_001', claim_type: 'reliability', target_type: 'route', target_id: 'route_pay_sh_token_quote_01' }] })
  });
  add('get', '/v1/claims/{claim_id}', {
    tags: ['Claims'],
    summary: 'Get claim detail',
    description: 'Returns one claim with linked challenges and receipt-backed evidence references.',
    parameters: [pathParam('claim_id', 'Claim identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/ClaimDetail' }, {
      claim_id: 'claim_001',
      claim_type: 'reliability',
      target_type: 'route',
      target_id: 'route_pay_sh_token_quote_01',
      statement: 'Quartz token quote route remains the safest first attempt for stablecoin quote checks under current receipt evidence.',
      challenges: []
    }, 'claim_not_found')
  });
  add('post', '/v1/claims', {
    tags: ['Claims'],
    summary: 'Submit claim',
    description: 'Submits a structured claim tied to a route, provider, service, receipt, counterparty, or prior claim. No claim without evidence.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/ClaimCreateRequest' }, {
      submitted_by: 'agent_ops_001',
      claim_type: 'blocker',
      target_type: 'service',
      target_id: 'service_receipt_parsing',
      statement: 'Layout-heavy PDF parsing should require human approval until newer receipts replace the stale evidence window.',
      evidence_receipt_ids: ['receipt_008', 'receipt_009'],
      evidence_artifact_uris: ['artifact://artifact_receipt_parse_run_001'],
      confidence_score: 64,
      validation_state: 'machine_checked',
      human_notes: ['Known blockers still active.']
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/Claim' }, { claim_id: 'claim_003', status: 'submitted', target_type: 'service', target_id: 'service_receipt_parsing' })
  });
  add('get', '/v1/claims/{claim_id}/challenges', {
    tags: ['Claims'],
    summary: 'List claim challenges',
    description: 'Returns challenges recorded against a claim. Challenge flow is a placeholder for future validation markets.',
    parameters: [pathParam('claim_id', 'Claim identifier.')],
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      claim_id: stringSchema(),
      challenges: arrayOf({ $ref: '#/components/schemas/ClaimChallenge' })
    }), { claim_id: 'claim_002', challenges: [{ challenge_id: 'challenge_001', claim_id: 'claim_002', status: 'submitted' }] }, 'claim_not_found')
  });
  add('post', '/v1/claims/{claim_id}/challenges', {
    tags: ['Claims'],
    summary: 'Submit claim challenge',
    description: 'Submits a challenge placeholder for a claim with receipt evidence, artifact evidence, and human notes. Claims are not token markets yet.',
    parameters: [pathParam('claim_id', 'Claim identifier.')],
    requestBody: jsonRequest({ $ref: '#/components/schemas/ClaimChallengeCreateRequest' }, {
      challenged_by: 'validator_004',
      reason: 'One failing receipt is not enough to generalize across all invoice layouts without fresh replacement evidence.',
      evidence_receipt_ids: ['receipt_009'],
      evidence_artifact_uris: ['artifact://artifact_receipt_parse_run_002'],
      human_notes: ['Challenge placeholder only.']
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/ClaimChallenge' }, { challenge_id: 'challenge_002', claim_id: 'claim_002', status: 'submitted' }, 'claim_not_found')
  });

  add('get', '/v1/providers', {
    tags: ['Providers'],
    summary: 'List providers',
    description: 'Returns lightweight provider records for the legacy Radar provider directory and agent discovery. Pass `scope=pre-spend` for the canonical pre-spend builder provider intelligence payload.',
    parameters: [{
      name: 'scope',
      in: 'query',
      required: false,
      description: 'Optional compatibility flag. Use `pre-spend` to return the canonical pre-spend provider intelligence payload instead of the legacy provider directory.',
      schema: enumSchema(['pre-spend'])
    }],
    responses: envelopedResponses({
      oneOf: [
        arrayOf({ $ref: '#/components/schemas/ProviderSummary' }),
        { $ref: '#/components/schemas/PreSpendProviderListResponse' }
      ]
    }, [{ id: 'alpha', name: 'Alpha API', category: 'payments' }])
  });
  add('get', '/v1/routes', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'List route intelligence',
    description: 'Returns receipt-backed route intelligence for the Pre-Spend Intelligence Terminal.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      metrics: { $ref: '#/components/schemas/PreSpendMetrics' },
      routes: arrayOf({ $ref: '#/components/schemas/RouteIntelligence' })
    }), { routes: [{ route_id: 'route_pay_sh_token_quote_01', provider_id: 'provider_pay_sh_quartz' }] })
  });
  add('get', '/v1/routes/{route_id}', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'Get route intelligence detail',
    description: 'Returns route intelligence with linked provider, service, receipt evidence, validation state, decision implications, and route trust summary.',
    parameters: [pathParam('route_id', 'Pre-spend route identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/PreSpendRouteDetailResponse' }, {
      route: { route_id: 'route_pay_sh_token_quote_01' },
      validation_state: 'human_validated',
      trust_summary: { successful_receipt_count: 3, blocker_severity: 'none' }
    }, 'route_not_found')
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
    description: 'Returns either a legacy provider dossier or a pre-spend provider detail with linked routes, receipts, warnings, and provider trust profile.',
    parameters: [pathParam('id', 'Provider identifier.')],
    responses: envelopedResponses({
      oneOf: [
        { $ref: '#/components/schemas/ProviderDetailResponse' },
        { $ref: '#/components/schemas/PreSpendProviderDetailResponse' }
      ]
    }, { provider: { provider_id: 'provider_pay_sh_quartz', name: 'Quartz Route Index' }, trust_profile: { safe_for_first_attempt: true, not_recommended: false } }, 'provider_not_found')
  });
  add('get', '/v1/pre-spend/providers', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'List canonical pre-spend providers',
    description: 'Returns only deterministic pre-spend builder provider intelligence from the in-memory pre-spend intelligence service. This endpoint is canonical for agent-callable pre-spend provider discovery and is distinct from the legacy Radar provider directory.',
    responses: envelopedResponses({ $ref: '#/components/schemas/PreSpendProviderListResponse' }, {
      generated_at: '2026-06-16T04:00:00.000Z',
      source: 'infopunks-pay-sh-radar',
      providers: [{
        provider_id: 'provider_pay_sh_quartz',
        name: 'Quartz Route Index',
        service_categories: ['token_pricing'],
        reliability_score: 96,
        pricing_consistency: 'highly consistent',
        output_quality_notes: ['precise output shape'],
        uptime_notes: ['healthy current run cadence'],
        dispute_history: [],
        human_validation_status: 'human_validated',
        known_risks: [],
        agent_compatibility: ['trading_agents', 'autonomous_wallets'],
        route_coverage: 1,
        recent_receipt_count: 3,
        linked_routes: ['route_pay_sh_token_quote_01'],
        linked_receipts: ['receipt_005', 'receipt_006', 'receipt_007'],
        trust_profile: { safe_for_first_attempt: true, better_for_repeatable_routes: true, requires_human_approval: false, not_recommended: false, summary: 'Safe for first attempts under current observed conditions and suitable for repeatable receipt-backed routing.' }
      }]
    })
  });
  add('get', '/v1/pre-spend/providers/{provider_id}', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'Get canonical pre-spend provider detail',
    description: 'Returns the enriched pre-spend provider detail payload used by provider detail pages for `provider_*` identifiers. This endpoint is distinct from the legacy Radar provider directory detail route.',
    parameters: [pathParam('provider_id', 'Pre-spend provider identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/PreSpendProviderDetailResponse' }, {
      provider: { provider_id: 'provider_pay_sh_quartz', name: 'Quartz Route Index' },
      routes: [{ route_id: 'route_pay_sh_token_quote_01', provider_id: 'provider_pay_sh_quartz' }],
      receipts: [{ receipt_id: 'receipt_005', provider_id: 'provider_pay_sh_quartz' }],
      trust_profile: { safe_for_first_attempt: true, better_for_repeatable_routes: true, requires_human_approval: false, not_recommended: false, summary: 'Safe for first attempts under current observed conditions and suitable for repeatable receipt-backed routing.' }
    }, 'provider_not_found')
  });
  add('get', '/v1/services', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'List service dossiers',
    description: 'Returns service dossiers for paid API and service routes.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      metrics: { $ref: '#/components/schemas/PreSpendMetrics' },
      services: arrayOf({ $ref: '#/components/schemas/ServiceDossier' })
    }), { services: [{ service_id: 'service_market_research', category: 'market_research' }] })
  });
  add('get', '/v1/services/{service_id}', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'Get service dossier detail',
    description: 'Returns a service dossier, linked routes and receipts, and the best route decision map for pre-spend selection.',
    parameters: [pathParam('service_id', 'Service dossier identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/PreSpendServiceDetailResponse' }, {
      service: { service_id: 'service_market_research' },
      best_route_decision_map: { best_observed_route: 'route_pay_sh_market_research_03', cheapest_route: 'route_pay_sh_market_research_01' }
    }, 'service_not_found')
  });
  add('post', '/v1/pre-spend/check', {
    tags: ['Pre-Spend Intelligence'],
    summary: 'Run pre-spend decision check',
    description: 'Core decision endpoint for agents. Returns a receipt-backed recommendation about whether an agent should spend on a route now.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/PreSpendCheckRequest' }, {
      agent_id: 'agent_001',
      intent: 'buy_market_research',
      budget: 25,
      risk_tolerance: 'low',
      preferred_settlement: 'stablecoin',
      required_confidence: 75
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/PreSpendCheckResponse' }, {
      intent: 'buy_market_research',
      decision: 'approved_with_warning',
      recommended_route: 'route_pay_sh_market_research_01',
      confidence_score: 82,
      risk_level: 'medium',
      estimated_cost: '0.25 USDC',
      last_successful_run: '2026-06-14T09:40:00.000Z',
      known_blockers: ['occasional timeout under high load', 'output quality varies by prompt specificity'],
      requires_human_approval: false,
      receipt_references: ['receipt_001', 'receipt_002'],
      safer_alternatives: ['route_pay_sh_market_research_03'],
      do_not_use: [{ provider: 'provider_x', reason: 'no recent successful receipt' }],
      rationale: ['Confidence meets required threshold.', 'Recent successful receipts exist.', 'Known blockers are present, so the route is approved with warning.']
    })
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
  add('get', '/v1/machine-market/services', radarGet('Machine Economy', 'List machine-market services', 'A new Radar module for machine-economy intelligence. Returns the Phase 2 robotic.sh service mirror for Pay.sh and robotic.sh scope. Same terminal. New species of spender.', { $ref: '#/components/schemas/MachineMarketServiceListResponse' }, { count: 13, services: [{ id: 'qvac', name: 'QVAC', source_market: 'robotic.sh', chain: 'peaq', evidence_stage: 'policy-mapped' }, { id: 'naver-maps', name: 'NAVER Maps', source_market: 'robotic.sh', chain: 'unknown', evidence_stage: 'policy-mapped' }] }));
  add('get', '/v1/machine-market/summary', radarGet('Machine Economy', 'Get machine-market summary', 'Radar is the intelligence layer for autonomous spend across agents and machines. Machines should not spend blind.', { $ref: '#/components/schemas/MachineMarketSummaryResponse' }, { total_services: 13, ready_count: 12, setup_count: 1, phase_scope: 'phase_2_pay_sh_robotic_sh' }));
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
  add('post', '/v1/machine-execution/receipts/ingest', {
    tags: ['Machine Economy'],
    summary: 'Ingest service-specific machine execution receipt',
    description: `${SAFE_METADATA_NOTE} Admin token required (Authorization: Bearer <token>). Ingests a service-specific execution receipt validated by proof profile. Claim discipline: service-specific execution receipt only; not market-wide proof; not payment proof unless payment evidence exists; not benchmark proof; not winner proof.`,
    security: [{ bearerAuth: [] }],
    requestBody: jsonRequest(
      { $ref: '#/components/schemas/MachineExecutionReceiptIngestRequest' },
      {
        machine_id: 'did:peaq:bigquery-fixture-bot-01',
        service_id: 'bigquery',
        fqn: 'google-cloud/bigquery/query',
        source_market: 'robotic.sh',
        chain: 'unknown',
        execution_status: 'succeeded',
        execution_occurred: true,
        payment_occurred: false,
        payment_evidence: null,
        execution_started_at: '2026-05-23T00:00:00.000Z',
        execution_completed_at: '2026-05-23T00:00:01.000Z',
        execution_latency_ms: 1000,
        request_summary: { fixture: 'bigquery_bounded_query' },
        response_summary: {
          query_label: 'fixture.synthetic_row_count_check',
          row_count: 1,
          result_preview: [{ value: 1 }],
          dataset_classification: 'synthetic',
          bounded_query_confirmed: true
        },
        executor: { name: 'infopunks-radar-fixture', version: 'fixture-v1', mode: 'manual' }
      }
    ),
    responses: {
      ...envelopedResponses(
        { $ref: '#/components/schemas/MachineExecutionReceiptIngestResponse' },
        {
          accepted: true,
          receipt_id: 'mrx_exec_20260523000001000_0001',
          service_id: 'bigquery',
          execution_status: 'succeeded',
          execution_occurred: true,
          payment_occurred: false,
          payment_status: 'not_confirmed',
          payment_evidence: null,
          evidence_stage_after: 'execution-tested',
          caveats: [
            'Service-specific execution receipt only.',
            'Not market-wide proof.',
            'Not payment proof.',
            'Not benchmark proof.',
            'Not winner proof.'
          ]
        }
      ),
      '401': errorResponse('admin_token_required'),
      '400': errorResponse('invalid_machine_execution_receipt_ingest')
    }
  });
  add('get', '/v1/machine-execution/bigquery/fixtures/bounded-query', {
    tags: ['Machine Economy'],
    summary: 'Get BigQuery bounded-query fixture payload',
    description: `${SAFE_METADATA_NOTE} Fixture-only route. Returns a replaceable sample payload for proof profile bigquery_bounded_query. This endpoint does not execute live BigQuery. Shape is bounded public/synthetic query evidence and does not require translated_text_preview. payment_status remains not_confirmed unless payment evidence exists.`,
    responses: envelopedResponses(
      { $ref: '#/components/schemas/BigQueryBoundedQueryFixtureSampleResponse' },
      {
        fixture_label: 'BigQuery bounded public/synthetic query fixture',
        proof_profile: 'bigquery_bounded_query',
        replace_with: 'Harness-generated receipt payload',
        payload: {
          machine_id: 'did:peaq:bigquery-fixture-bot-01',
          service_id: 'bigquery',
          fqn: 'google-cloud/bigquery/query',
          source_market: 'robotic.sh',
          chain: 'unknown',
          execution_status: 'succeeded',
          execution_occurred: true,
          payment_occurred: false,
          payment_evidence: null,
          execution_started_at: '2026-05-23T00:00:00.000Z',
          execution_completed_at: '2026-05-23T00:00:01.000Z',
          execution_latency_ms: 1000,
          request_summary: { fixture: 'bigquery_bounded_query' },
          response_summary: {
            query_label: 'fixture.synthetic_row_count_check',
            row_count: 1,
            result_preview: [{ value: 1 }],
            dataset_classification: 'synthetic',
            bounded_query_confirmed: true
          },
          executor: { name: 'infopunks-radar-fixture', version: 'fixture-v1', mode: 'manual' }
        }
      }
    )
  });
  add('post', '/v1/machine-execution/bigquery/fixtures/ingest', {
    tags: ['Machine Economy'],
    summary: 'Ingest BigQuery bounded-query fixture receipt',
    description: `${SAFE_METADATA_NOTE} Admin token required (Authorization: Bearer <token>). Fixture-only ingest path for BigQuery bounded public/synthetic query proof shape. Does not execute live BigQuery. Claim discipline: service-specific execution receipt only; not market-wide proof; not payment proof unless payment evidence exists; not benchmark proof; not winner proof.`,
    security: [{ bearerAuth: [] }],
    requestBody: jsonRequest(
      { $ref: '#/components/schemas/BigQueryBoundedQueryFixtureIngestRequest' },
      { machine_id: 'did:peaq:bigquery-fixture-bot-01' }
    ),
    responses: {
      ...envelopedResponses(
        { $ref: '#/components/schemas/BigQueryBoundedQueryFixtureIngestResponse' },
        {
          fixture_ingested: true,
          fixture_label: 'BigQuery bounded public/synthetic query fixture',
          proof_profile: 'bigquery_bounded_query',
          payload: {
            service_id: 'bigquery',
            response_summary: {
              query_label: 'fixture.synthetic_row_count_check',
              row_count: 1,
              result_preview: [{ value: 1 }],
              dataset_classification: 'synthetic',
              bounded_query_confirmed: true
            }
          },
          accepted: true,
          receipt_id: 'mrx_exec_20260523000001000_0001',
          service_id: 'bigquery',
          execution_status: 'succeeded',
          execution_occurred: true,
          payment_occurred: false,
          payment_status: 'not_confirmed',
          payment_evidence: null,
          evidence_stage_after: 'execution-tested',
          caveats: [
            'Service-specific execution receipt only.',
            'Not market-wide proof.',
            'Not payment proof.',
            'Not benchmark proof.',
            'Not winner proof.'
          ]
        }
      ),
      '401': errorResponse('admin_token_required'),
      '400': errorResponse('invalid_bigquery_fixture_ingest')
    }
  });
  add('post', '/v1/machine-execution/bigquery/run-bounded-query', {
    tags: ['Machine Economy'],
    summary: 'Run guarded BigQuery bounded query via live Harness',
    description: `${SAFE_METADATA_NOTE} Admin bearer auth required. Executes only through configured live Harness and never falls back to fixture routes. If Harness, credentials, or rail are missing, response is blocked with explicit reasons. Claim discipline: no market-wide execution claim, no payment success claim without payment evidence, no benchmark claim, no winner claim.`,
    security: [{ bearerAuth: [] }],
    requestBody: jsonRequest(
      objectSchema({
        machine_id: stringSchema(),
        query: stringSchema(),
        query_label: stringSchema(),
        row_limit: integerSchema(),
        dataset_classification: enumSchema(['public', 'synthetic', 'explicitly_safe']),
        payment_evidence: { oneOf: [freeformObject(), { type: 'null' }] }
      }, ['machine_id', 'query', 'query_label', 'row_limit', 'dataset_classification']),
      {
        machine_id: 'did:peaq:bigquery-live-bot-01',
        query: 'SELECT value FROM `bigquery-public-data.samples.synthetic_table` WHERE value IS NOT NULL LIMIT 5',
        query_label: 'public.synthetic.smoke_check',
        row_limit: 5,
        dataset_classification: 'public',
        payment_evidence: null
      }
    ),
    responses: {
      ...envelopedResponses(
        freeformObject(),
        {
          status: 'succeeded',
          proof_profile: 'bigquery_bounded_query',
          receipt_id: 'mrx_exec_20260524000001000_0001',
          service_id: 'bigquery',
          payment_status: 'not_confirmed',
          claim_posture: {
            execution_claim: false,
            payment_success_claim: false,
            benchmark_claim: false,
            winner_claim: false
          },
          caveats: [
            'Service-specific execution receipt only.',
            'Not market-wide proof.',
            'Not payment proof.',
            'Not benchmark proof.',
            'Not winner proof.'
          ]
        }
      ),
      '401': errorResponse('admin_token_required'),
      '400': errorResponse('invalid_bigquery_live_run_request'),
      '409': {
        description: 'Live Harness blocked/not configured.',
        content: {
          'application/json': {
            schema: objectSchema({
              data: freeformObject()
            }, ['data']),
            example: {
              data: {
                status: 'blocked',
                reason: 'live_harness_not_configured',
                blockers: ['live_harness_not_configured', 'missing_bigquery_credentials_config', 'missing_bigquery_rail_config'],
                claim_posture: {
                  execution_claim: false,
                  payment_success_claim: false,
                  benchmark_claim: false,
                  winner_claim: false
                }
              }
            }
          }
        }
      }
    }
  });
  add('get', '/v1/machine-execution/repeatability/{service_id}', {
    tags: ['Machine Economy'],
    summary: 'Get service repeatability pack',
    description: `${SAFE_METADATA_NOTE} Computes repeatability from recorded service-specific execution receipts only. Route-specific repeatability only; not benchmark proof; not winner proof; not market-wide proof; not payment proof unless payment evidence exists.`,
    parameters: [pathParam('service_id', 'Service identifier. Supported: anytrans, bigquery, machine-translation-safe-phrase(alias of anytrans).')],
    responses: {
      ...envelopedResponses(
        freeformObject(),
        {
          repeatability_pack_id: 'mrx_repeatability_pack_anytrans_20260524',
          service_id: 'anytrans',
          route_id: 'translation:POST:/translate',
          profile_id: 'machine_translation_safe_phrase',
          run_count: 3,
          successful_runs: 2,
          failed_runs: 1,
          success_rate: 0.6667,
          receipt_ids: ['mrx_exec_a', 'mrx_exec_b', 'mrx_exec_c'],
          generated_at: '2026-05-24T00:00:00.000Z',
          payment_status_summary: {
            confirmed_count: 0,
            not_confirmed_count: 3,
            payment_success_claim: 0
          },
          repeatability_status: 'repeatability_candidate',
          benchmark_claim: false,
          winner_claim: false,
          market_wide_execution_claim: false,
          caveats: [
            'Route-specific repeatability only.',
            'Not benchmark proof.',
            'Not winner proof.',
            'Not market-wide proof.',
            'Not payment proof unless payment evidence exists.'
          ]
        }
      ),
      '404': errorResponse('repeatability_service_not_supported')
    }
  });
  add('get', '/v1/machine-execution/benchmark-readiness', {
    tags: ['Machine Economy'],
    summary: 'Get machine benchmark readiness state',
    description: `${SAFE_METADATA_NOTE} Returns benchmark readiness state only. Does not run benchmarks, create benchmark artifacts, compare best/worst routes, or claim winners.`,
    responses: envelopedResponses(
      freeformObject(),
      {
        generated_at: '2026-05-24T00:00:00.000Z',
        benchmark_claims: 0,
        winner_claims: 0,
        market_wide_execution_claims: 0,
        payment_success_claims: 0,
        lanes: [
          {
            lane_id: 'machine_translation',
            task_class: 'translation safe phrase',
            candidate_routes: [{ service_id: 'anytrans', route_id: 'translation:POST:/translate', profile_id: 'machine_translation_safe_phrase' }],
            comparable_route_count: 1,
            repeatability_state: 'single_route_repeatability_ready',
            missing_requirements: ['comparable_routes_missing'],
            readiness_status: 'single_route_repeatability_ready',
            next_action: 'Add at least one more comparable route before any benchmark artifact.',
            caveats: ['Benchmark readiness is not benchmark evidence.']
          }
        ],
        caveats: ['Readiness state only; no benchmark execution is run by this endpoint.']
      }
    )
  });
  add('get', '/v1/machine-execution/comparable-routes', {
    tags: ['Machine Economy'],
    summary: 'Get machine comparable-route discovery state',
    description: `${SAFE_METADATA_NOTE} Returns comparable-route discovery and methodology contracts only. Does not run benchmarks, create benchmark artifacts, or claim winners/best routes/providers.`,
    responses: envelopedResponses(
      freeformObject(),
      {
        generated_at: '2026-05-24T00:00:00.000Z',
        benchmark_claims: 0,
        winner_claims: 0,
        lanes: [
          {
            lane_id: 'machine_translation',
            task_class: 'Machine Translation',
            candidate_routes: [
              { service_id: 'anytrans', route_id: 'translation:POST:/translate', profile_id: 'machine_translation_safe_phrase' },
              { service_id: 'alibaba-machine-translation-general', route_id: 'alibaba-machine-translation-general:POST:/api/translate/web/general', profile_id: 'machine_translation_safe_phrase' }
            ],
            comparable_route_count: 2,
            required_methodology: ['same_task', 'same_input_class', 'same_output_normalization', 'same_success_criteria', 'same_cost_latency_capture'],
            missing_methodology: [],
            comparable_inputs: 'same phrase set, same source/target language pairs, same max_cost policy',
            comparable_outputs: 'normalized translated_text and minimal metadata fields',
            normalization_strategy: 'trim/lowercase canonical comparison, locale-safe unicode normalization',
            success_criteria: 'parseable translation output, non-empty translated_text, policy-safe response',
            run_count_target: 3,
            cost_latency_fields_required: ['execution_latency_ms', 'payment_status', 'payment_evidence'],
            safety_constraints: ['no sensitive text payloads', 'no benchmark ranking claims', 'service-specific receipt scope only'],
            readiness_effect: 'comparable route exists but methodology contract must remain explicit before any benchmark run',
            next_action: 'Keep methodology contract published and add route-level parity assertions.'
          }
        ],
        caveats: ['Comparable routes are required before benchmarks.', 'No comparable route, no benchmark.', 'Methodology before leaderboard.']
      }
    )
  });
  add('get', '/v1/machine-execution/benchmark-methodology', {
    tags: ['Machine Economy'],
    summary: 'Get machine benchmark methodology artifact scaffolds',
    description: `${SAFE_METADATA_NOTE} Returns methodology schema artifacts only for future machine benchmarks. This endpoint is not benchmark execution, not benchmark evidence, does not record benchmark artifacts, and does not claim winners.`,
    responses: envelopedResponses(
      freeformObject(),
      {
        generated_at: '2026-05-24T00:00:00.000Z',
        artifact_schema_version: 'machine_benchmark_methodology.v1',
        methodology_artifacts: [
          {
            benchmark_id: 'machine-benchmark-machine_translation',
            lane_id: 'machine_translation',
            task_class: 'Machine Translation',
            routes_compared: [{ service_id: 'anytrans', route_id: 'translation:POST:/translate', profile_id: 'machine_translation_safe_phrase' }],
            input_set: 'same phrase set',
            normalization_strategy: 'trim/lowercase canonical comparison',
            success_criteria: 'parseable translation output',
            run_count: 0,
            cost_fields: ['payment_status', 'payment_evidence'],
            latency_fields: ['execution_latency_ms'],
            payment_fields: ['payment_status', 'payment_evidence'],
            safety_constraints: ['no benchmark ranking claims'],
            policy_constraints: ['methodology_only', 'no_benchmark_execution'],
            comparable_route_count: 1,
            readiness_status: 'single_route_repeatability_ready',
            methodology_status: 'missing_comparable_routes',
            artifact_status: 'scaffold',
            winner_policy: 'no_winner_default',
            winner_claim: false,
            benchmark_claim: false,
            methodology_artifact_schema: 'present',
            output_normalization: 'trim/lowercase canonical comparison',
            run_count_target: 3,
            cost_fields_required: ['payment_status', 'payment_evidence'],
            latency_fields_required: ['execution_latency_ms'],
            payment_fields_required: ['payment_status', 'payment_evidence'],
            missing_requirements: ['comparable_routes_missing'],
            benchmark_allowed: false,
            caveats: ['Methodology artifact schema is not benchmark evidence.'],
            generated_at: '2026-05-24T00:00:00.000Z'
          }
        ],
        global_gate: {
          benchmark_execution_allowed: false,
          reason: 'Blocked: benchmark execution requires readiness_status=benchmark_ready, methodology_artifact_schema=present, and comparable_route_count>=2.',
          required_conditions: [
            'readiness_status = benchmark_ready',
            'methodology_artifact_schema = present',
            'comparable_route_count >= 2'
          ]
        },
        caveats: [
          'Methodology artifact schema is not benchmark evidence.',
          'No benchmark execution has been run by this scaffold.'
        ]
      }
    )
  });
  add('get', '/v1/machine-execution/benchmark-gate', {
    tags: ['Machine Economy'],
    summary: 'Get machine benchmark execution gate check',
    description: `${SAFE_METADATA_NOTE} Returns benchmark gate-check state only. This endpoint does not run benchmarks, does not create benchmark artifacts, does not claim benchmark execution, and does not claim winners.`,
    responses: envelopedResponses(
      freeformObject(),
      {
        benchmark_execution_allowed: false,
        allowed_lanes: [],
        blocked_lanes: ['machine_translation', 'data_query_bigquery', 'storage_stableupload', 'navigation_naver_geocode'],
        blocking_reasons: ['comparable_routes_missing', 'methodology_incomplete', 'readiness_not_benchmark_ready', 'repeatability_missing', 'safety_policy_blocked', 'artifact_schema_missing'],
        required_conditions: [
          'readiness_status = benchmark_ready',
          'methodology_artifact_schema = present',
          'comparable_route_count >= 2'
        ],
        generated_at: '2026-05-24T00:00:00.000Z'
      }
    )
  });
  add('get', '/v1/machine-execution/stableupload/fixtures/tiny-fixture', {
    tags: ['Machine Economy'],
    summary: 'Get Stableupload tiny-fixture payload',
    description: `${SAFE_METADATA_NOTE} Fixture-only route. Returns a replaceable sample payload for proof profile stableupload_tiny_fixture. This endpoint does not execute live Stableupload. Shape is tiny non-sensitive upload evidence. payment_status remains not_confirmed unless payment evidence exists.`,
    responses: envelopedResponses(
      { $ref: '#/components/schemas/StableuploadTinyFixtureSampleResponse' },
      {
        fixture_label: 'Stableupload tiny non-sensitive fixture',
        proof_profile: 'stableupload_tiny_fixture',
        replace_with: 'Harness-generated receipt payload',
        payload: {
          machine_id: 'did:peaq:stableupload-fixture-bot-01',
          service_id: 'stableupload',
          fqn: 'stableupload/upload',
          source_market: 'pay.sh',
          chain: 'solana',
          execution_status: 'succeeded',
          execution_occurred: true,
          payment_occurred: false,
          payment_evidence: null,
          execution_started_at: '2026-05-23T00:00:00.000Z',
          execution_completed_at: '2026-05-23T00:00:01.000Z',
          execution_latency_ms: 640,
          request_summary: { fixture: 'stableupload_tiny_fixture' },
          response_summary: {
            file_size_bytes: 128,
            file_hash: 'sha256:stableupload-tiny-fixture-v1',
            upload_reference: 'stableupload_fixture_ref_001',
            sensitive_data_flag: false
          },
          executor: { name: 'infopunks-radar-fixture', version: 'fixture-v1', mode: 'manual' }
        }
      }
    )
  });
  add('post', '/v1/machine-execution/stableupload/fixtures/ingest', {
    tags: ['Machine Economy'],
    summary: 'Ingest Stableupload tiny-fixture receipt',
    description: `${SAFE_METADATA_NOTE} Admin token required (Authorization: Bearer <token>). Fixture-only ingest path for Stableupload tiny non-sensitive fixture proof shape. Does not execute live Stableupload. Claim discipline: service-specific execution receipt only; not market-wide proof; not payment proof unless payment evidence exists; not benchmark proof; not winner proof.`,
    security: [{ bearerAuth: [] }],
    requestBody: jsonRequest(
      { $ref: '#/components/schemas/StableuploadTinyFixtureIngestRequest' },
      { machine_id: 'did:peaq:stableupload-fixture-bot-01' }
    ),
    responses: {
      ...envelopedResponses(
        { $ref: '#/components/schemas/StableuploadTinyFixtureIngestResponse' },
        {
          fixture_ingested: true,
          fixture_label: 'Stableupload tiny non-sensitive fixture',
          proof_profile: 'stableupload_tiny_fixture',
          payload: {
            service_id: 'stableupload',
            response_summary: {
              file_size_bytes: 128,
              file_hash: 'sha256:stableupload-tiny-fixture-v1',
              upload_reference: 'stableupload_fixture_ref_001',
              sensitive_data_flag: false
            }
          },
          accepted: true,
          receipt_id: 'mrx_exec_20260523000001000_0001',
          service_id: 'stableupload',
          execution_status: 'succeeded',
          execution_occurred: true,
          payment_occurred: false,
          payment_status: 'not_confirmed',
          payment_evidence: null,
          evidence_stage_after: 'execution-tested',
          caveats: [
            'Service-specific execution receipt only.',
            'Not market-wide proof.',
            'Not payment proof.',
            'Not benchmark proof.',
            'Not winner proof.'
          ]
        }
      ),
      '401': errorResponse('admin_token_required'),
      '400': errorResponse('invalid_stableupload_fixture_ingest')
    }
  });
  add('get', '/v1/machine-execution/naver/fixtures/geocode', {
    tags: ['Machine Economy'],
    summary: 'Get NAVER Maps geocode fixture payload',
    description: `${SAFE_METADATA_NOTE} Fixture-only route. Returns a replaceable sample payload for proof profile naver_geocode_lookup. This endpoint does not execute live NAVER Maps. Shape is non-operational geocode lookup evidence. No robot command, no physical movement, no route guidance for real-world movement. payment_status remains not_confirmed unless payment evidence exists.`,
    responses: envelopedResponses(
      { $ref: '#/components/schemas/NaverGeocodeFixtureSampleResponse' },
      {
        fixture_label: 'NAVER Maps non-operational geocode fixture',
        proof_profile: 'naver_geocode_lookup',
        replace_with: 'Harness-generated receipt payload',
        payload: {
          machine_id: 'did:peaq:naver-geocode-fixture-bot-01',
          service_id: 'naver-maps',
          fqn: 'naver/maps/geocode',
          source_market: 'robotic.sh',
          chain: 'unknown',
          execution_status: 'succeeded',
          execution_occurred: true,
          payment_occurred: false,
          payment_evidence: null,
          execution_started_at: '2026-05-23T00:00:00.000Z',
          execution_completed_at: '2026-05-23T00:00:01.000Z',
          execution_latency_ms: 720,
          request_summary: { fixture: 'naver_geocode_lookup' },
          response_summary: {
            query_label: 'fixture.seoul_station_lookup',
            geocode_result_preview: 'Seoul Station, KR',
            coordinates_present: true,
            no_robot_command: true,
            no_physical_movement: true
          },
          executor: { name: 'infopunks-radar-fixture', version: 'fixture-v1', mode: 'manual' }
        }
      }
    )
  });
  add('post', '/v1/machine-execution/naver/fixtures/geocode/ingest', {
    tags: ['Machine Economy'],
    summary: 'Ingest NAVER Maps geocode fixture receipt',
    description: `${SAFE_METADATA_NOTE} Admin token required (Authorization: Bearer <token>). Fixture-only ingest path for NAVER Maps non-operational geocode proof shape. Does not execute live NAVER Maps. Claim discipline: non-operational geocode lookup only; no robot command; no physical movement; service-specific execution receipt only; not market-wide proof; not payment proof unless payment evidence exists; not benchmark proof; not winner proof.`,
    security: [{ bearerAuth: [] }],
    requestBody: jsonRequest(
      { $ref: '#/components/schemas/NaverGeocodeFixtureIngestRequest' },
      { machine_id: 'did:peaq:naver-geocode-fixture-bot-01' }
    ),
    responses: {
      ...envelopedResponses(
        { $ref: '#/components/schemas/NaverGeocodeFixtureIngestResponse' },
        {
          fixture_ingested: true,
          fixture_label: 'NAVER Maps non-operational geocode fixture',
          proof_profile: 'naver_geocode_lookup',
          payload: {
            service_id: 'naver-maps',
            response_summary: {
              query_label: 'fixture.seoul_station_lookup',
              geocode_result_preview: 'Seoul Station, KR',
              coordinates_present: true,
              no_robot_command: true,
              no_physical_movement: true
            }
          },
          accepted: true,
          receipt_id: 'mrx_exec_20260523000001000_0001',
          service_id: 'naver-maps',
          execution_status: 'succeeded',
          execution_occurred: true,
          payment_occurred: false,
          payment_status: 'not_confirmed',
          payment_evidence: null,
          evidence_stage_after: 'execution-tested',
          caveats: [
            'Service-specific execution receipt only.',
            'Not market-wide proof.',
            'Not payment proof.',
            'Not benchmark proof.',
            'Not winner proof.'
          ]
        }
      ),
      '401': errorResponse('admin_token_required'),
      '400': errorResponse('invalid_naver_geocode_fixture_ingest')
    }
  });
  add('get', '/v1/machine-execution/cloud-translation/fixtures/safe-phrase', {
    tags: ['Machine Economy'],
    summary: 'Get Cloud Translation safe-phrase fixture payload',
    description: `${SAFE_METADATA_NOTE} Fixture-only route. Returns a replaceable sample payload for proof profile machine_translation_safe_phrase. This endpoint does not execute live Cloud Translation. Shape is safe phrase translation evidence. payment_status remains not_confirmed unless payment evidence exists.`,
    responses: envelopedResponses(
      freeformObject(),
      {
        fixture_label: 'Cloud Translation safe phrase fixture',
        proof_profile: 'machine_translation_safe_phrase',
        replace_with: 'Harness-generated service-specific receipt payload',
        payload: {
          machine_id: 'did:peaq:cloud-translation-fixture-bot-01',
          service_id: 'cloud-translation',
          fqn: 'solana-foundation/google/cloudtranslation',
          source_market: 'pay.sh',
          chain: 'solana',
          execution_status: 'failed',
          execution_occurred: true,
          payment_occurred: false,
          payment_evidence: null,
          request_summary: { fixture: 'machine_translation_safe_phrase' },
          response_summary: {
            translated_text_preview: 'Las máquinas no deberían gastar a ciegas.',
            source_language: 'en',
            target_language: 'es',
            semantic_translation_observed: true
          }
        }
      }
    )
  });
  add('post', '/v1/machine-execution/cloud-translation/fixtures/safe-phrase/ingest', {
    tags: ['Machine Economy'],
    summary: 'Ingest Cloud Translation safe-phrase fixture receipt',
    description: `${SAFE_METADATA_NOTE} Admin token required (Authorization: Bearer <token>). Fixture-only ingest path for Cloud Translation safe phrase proof shape unless a live success receipt already exists. Does not execute live Cloud Translation. Claim discipline: service-specific execution receipt only; not market-wide proof; not payment proof unless payment evidence exists; not benchmark proof; not winner proof.`,
    security: [{ bearerAuth: [] }],
    requestBody: jsonRequest(
      { $ref: '#/components/schemas/BigQueryFixtureIngestRequest' },
      { machine_id: 'did:peaq:cloud-translation-fixture-bot-01' }
    ),
    responses: {
      ...envelopedResponses(
        freeformObject(),
        {
          fixture_ingested: true,
          fixture_label: 'Cloud Translation safe phrase fixture',
          proof_profile: 'machine_translation_safe_phrase',
          accepted: true,
          service_id: 'cloud-translation',
          execution_status: 'failed',
          execution_occurred: true,
          payment_occurred: false,
          payment_status: 'not_confirmed',
          evidence_stage_after: 'policy-mapped'
        }
      ),
      '401': errorResponse('admin_token_required'),
      '400': errorResponse('invalid_cloud_translation_fixture_ingest'),
      '409': errorResponse('cloud_translation_live_receipt_already_exists')
    }
  });
  add('post', '/v1/machine-preflight/coverage-run', {
    tags: ['Machine Economy'],
    summary: 'Run machine preflight coverage',
    description: `${SAFE_METADATA_NOTE} Evaluates all listed robotic.sh services through the internal machine preflight path and records decision receipts only.`,
    responses: envelopedResponses({ $ref: '#/components/schemas/MachinePreflightCoverageRun' }, { run_id: 'mcr_20260522000000000_0001', services_total: 13, receipts_recorded: 13, execution_occurred: false, payment_occurred: false })
  });
  add('get', '/v1/machine-preflight/coverage-runs/recent', radarGet('Machine Economy', 'List recent machine preflight coverage runs', 'Returns recent machine preflight coverage runs. Coverage runs record decision receipts only.', { $ref: '#/components/schemas/MachinePreflightCoverageRunListResponse' }, { count: 1, runs: [{ run_id: 'mcr_20260522000000000_0001', services_total: 13, receipts_recorded: 13 }] }));
  add('get', '/v1/machine-preflight/coverage-runs/{run_id}', {
    tags: ['Machine Economy'],
    summary: 'Get machine preflight coverage run detail',
    description: `${SAFE_METADATA_NOTE} Returns one coverage run detail by run_id.`,
    parameters: [pathParam('run_id', 'Machine preflight coverage run identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/MachinePreflightCoverageRun' }, { run_id: 'mcr_20260522000000000_0001', services_total: 13, receipts_recorded: 13 }, 'machine_preflight_coverage_run_not_found')
  });

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
  add('get', '/v1/radar/agent-readiness', radarGet(
    'Radar Readiness',
    'List Agent Spend Readiness Cards',
    'Returns provider-level proof-state diagnostics for builders. Cards derive from existing Radar catalog, benchmark history, route timelines, scaffold lanes, bundle registry, and bundle run ledger data. They are not rankings and do not claim winners.',
    { $ref: '#/components/schemas/AgentReadinessListResponse' },
    {
      count: 2,
      generated_at: '2026-05-27T00:00:00.000Z',
      cards: [
        {
          provider_id: 'paysponge-coingecko',
          provider_label: 'CoinGecko Onchain DEX API',
          readiness_state: 'recorded_evidence',
          agent_spend_readiness: 'ready_for_inspection',
          evidence_summary: { recorded_benchmarks: 3, proven_routes: 3, controlled_bundle_runs: 2, scaffold_lanes: 0, caveat_count: 0, latest_artifact_id: 'finance-data-token-metadata-benchmark-runs-2026-05-19', latest_observed_at: '2026-05-19T00:00:00.000Z' },
          proof_links: { benchmark_history: ['/v1/radar/benchmark-history/finance-data-token-metadata'], route_timelines: ['/v1/radar/benchmark-history/finance-data-token-metadata/routes/paysponge-coingecko%3AGET%3A%2Fx402%2Fonchain%2Ftokens'], bundle_runs: ['/v1/radar/bundles/morning-briefing/runs/morning-briefing-run-2026-05-21-084556-pay-cli'] },
          builder_next_step: 'Inspect latest route timeline and caveats before routing agents.',
          agent_guidance: 'Artifact-backed route evidence exists; inspect latest route timelines and caveats before spend.',
          what_this_means: 'Artifact-backed route evidence exists. Agents should still inspect caveats before spend.',
          winner_claimed: false,
          agent_readiness_summary: {
            ready_for_agent_review: true,
            requires_rerun_before_spend: false,
            requires_human_or_policy_approval: true,
            observed_cost_available: false,
            winner_claimed: false,
            decision_state: 'review_ready_caveated',
            blocking_reasons: [],
            review_reasons: ['billing_unclear_steps_skipped', 'observed_cost_unavailable', 'status_code_unavailable'],
            recommended_agent_action: 'Inspect latest run detail, skipped review-required steps, and caveats before spend.'
          },
          share_copy: 'Radar card: CoinGecko Onchain DEX API is recorded_evidence. Proof exists: 3 recorded benchmarks, 3 proven routes, winner_claimed=false. Agents should inspect caveats before spend.'
        }
      ],
      winner_claimed: false,
      agent_guidance: [
        'Readiness cards are proof-state diagnostics, not rankings.',
        'Agents should inspect route timelines, caveats, and latest artifacts before spend.',
        'winner_claimed=false means no provider winner should be inferred.'
      ]
    }
  ));
  add('get', '/v1/radar/agent-readiness/{provider_id}', {
    tags: ['Radar Readiness'],
    summary: 'Get Agent Spend Readiness Card',
    description: 'Returns one provider proof-state diagnostic card. This endpoint is read-only, does not execute paid APIs, is not a ranking, and does not claim a winner.',
    parameters: [pathParam('provider_id', 'Provider identifier.')],
    responses: envelopedResponses(
      { $ref: '#/components/schemas/AgentReadinessCard' },
      {
        provider_id: 'paysponge-coingecko',
        provider_label: 'CoinGecko Onchain DEX API',
        readiness_state: 'recorded_evidence',
        agent_spend_readiness: 'ready_for_inspection',
        evidence_summary: { recorded_benchmarks: 3, proven_routes: 3, controlled_bundle_runs: 2, scaffold_lanes: 0, caveat_count: 0, latest_artifact_id: 'finance-data-token-metadata-benchmark-runs-2026-05-19', latest_observed_at: '2026-05-19T00:00:00.000Z' },
        proof_links: { benchmark_history: ['/v1/radar/benchmark-history/finance-data-token-metadata'], route_timelines: [], bundle_runs: ['/v1/radar/bundles/morning-briefing/runs/morning-briefing-run-2026-05-21-084556-pay-cli'] },
        builder_next_step: 'Inspect latest route timeline and caveats before routing agents.',
        agent_guidance: 'Artifact-backed route evidence exists; inspect latest route timelines and caveats before spend.',
        what_this_means: 'Artifact-backed route evidence exists. Agents should still inspect caveats before spend.',
        winner_claimed: false,
        agent_readiness_summary: {
          ready_for_agent_review: true,
          requires_rerun_before_spend: false,
          requires_human_or_policy_approval: true,
          observed_cost_available: false,
          winner_claimed: false,
          decision_state: 'review_ready_caveated',
          blocking_reasons: [],
          review_reasons: ['billing_unclear_steps_skipped', 'observed_cost_unavailable', 'status_code_unavailable'],
          recommended_agent_action: 'Inspect latest run detail, skipped review-required steps, and caveats before spend.'
        },
        share_copy: 'Radar card: CoinGecko Onchain DEX API is recorded_evidence. Proof exists: 3 recorded benchmarks, 3 proven routes, winner_claimed=false. Agents should inspect caveats before spend.'
      },
      'provider_readiness_not_found'
    )
  });
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
    responses: envelopedResponses({ $ref: '#/components/schemas/BundleRunListResponse' }, {
      bundle_id: 'morning-briefing',
      count: 2,
      latest_run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli',
      latest_generated_at: '2026-05-21T08:45:56.919Z',
      runs: [
        { run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli', status: 'controlled_live_run', evidence_health: 'caveated' },
        { run_id: 'morning-briefing-run-2026-05-21-075521-pay-cli', status: 'controlled_live_run', evidence_health: 'caveated' }
      ],
      history_summary: {
        history_count: 2,
        latest_run_id: 'morning-briefing-run-2026-05-21-084556-pay-cli',
        previous_run_id: 'morning-briefing-run-2026-05-21-075521-pay-cli',
        source_count_delta: 1,
        latest_source_count: 10,
        previous_source_count: 9,
        observed_cost_available: false,
        observed_cost_state: 'unavailable',
        skipped_review_required_steps_stable: true,
        latest_skipped_step_count: 2,
        previous_skipped_step_count: 2,
        caveat_codes_latest: ['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'],
        caveat_codes_previous: ['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'],
        caveat_delta: { added: [], removed: [] },
        winner_claimed: false
      },
      freshness: {
        last_controlled_run_at: '2026-05-21T08:45:56.919Z',
        latest_run_age_hours: 12.4,
        freshness_state: 'fresh',
        freshness_thresholds_hours: {
          fresh_until: 24,
          aging_until: 72
        },
        recommended_agent_action: 'Inspect latest run detail before spend.'
      },
      winner_claimed: false,
      agent_readiness_summary: {
        ready_for_agent_review: true,
        requires_rerun_before_spend: false,
        requires_human_or_policy_approval: true,
        observed_cost_available: false,
        winner_claimed: false,
        decision_state: 'review_ready_caveated',
        blocking_reasons: [],
        review_reasons: ['billing_unclear_steps_skipped', 'observed_cost_unavailable', 'status_code_unavailable', 'source_map_empty'],
        recommended_agent_action: 'Inspect latest run detail, skipped review-required steps, and caveats before spend.'
      }
    }, 'bundle_not_found')
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
      { name: 'Proof Feed' },
      { name: 'Machine Economy' },
      { name: 'Radar CSV Exports' }
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: componentSchemas()
    }
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
    PreSpendMetrics: objectSchema({
      verified_pre_spend_decisions: integerSchema(),
      routes_indexed: integerSchema(),
      providers_scored: integerSchema(),
      receipts_generated: integerSchema(),
      pre_spend_checks_completed: integerSchema(),
      human_validations_submitted: integerSchema(),
      failed_routes_avoided: integerSchema(),
      claims_challenged: integerSchema(),
      repeatable_routes_discovered: integerSchema(),
      agent_builders_using_the_api: integerSchema(),
      amount_of_spend_protected_or_intelligently_routed: stringSchema()
    }),
    BuilderProviderIntelligence: objectSchema({
      provider_id: stringSchema(),
      name: stringSchema(),
      service_categories: arrayOf(stringSchema()),
      reliability_score: { type: 'number', minimum: 0, maximum: 100 },
      pricing_consistency: stringSchema(),
      output_quality_notes: arrayOf(stringSchema()),
      uptime_notes: arrayOf(stringSchema()),
      dispute_history: arrayOf(stringSchema()),
      human_validation_status: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      known_risks: arrayOf(stringSchema()),
      agent_compatibility: arrayOf(stringSchema()),
      route_coverage: integerSchema(),
      recent_receipt_count: integerSchema()
    }),
    RouteIntelligence: objectSchema({
      route_id: stringSchema(),
      provider_id: stringSchema(),
      service_id: stringSchema(),
      endpoint: stringSchema(),
      payment_method: stringSchema(),
      estimated_cost: stringSchema(),
      latency_ms_p50: integerSchema(),
      latency_ms_p95: integerSchema(),
      success_rate: { type: 'number', minimum: 0, maximum: 1 },
      last_tested_at: dateTimeSchema(),
      last_successful_run: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      last_failed_run: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      confidence_score: { type: 'number', minimum: 0, maximum: 100 },
      risk_level: enumSchema(['low', 'medium', 'high', 'critical']),
      known_blockers: arrayOf(stringSchema()),
      receipt_references: arrayOf(stringSchema()),
      recommended_use_case: stringSchema(),
      avoid_conditions: arrayOf(stringSchema())
    }),
    ServiceDossier: objectSchema({
      service_id: stringSchema(),
      category: stringSchema(),
      available_routes: arrayOf(stringSchema()),
      supported_inputs: arrayOf(stringSchema()),
      observed_cost_range: objectSchema({ min: stringSchema(), max: stringSchema() }),
      observed_latency_range: objectSchema({ min_ms: integerSchema(), max_ms: integerSchema() }),
      best_observed_route: { oneOf: [stringSchema(), { type: 'null' }] },
      cheapest_observed_route: { oneOf: [stringSchema(), { type: 'null' }] },
      safest_first_attempt: { oneOf: [stringSchema(), { type: 'null' }] },
      fastest_repeatable_route: { oneOf: [stringSchema(), { type: 'null' }] },
      known_blockers: arrayOf(stringSchema()),
      evidence_artifacts: arrayOf(stringSchema()),
      benchmark_readiness: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      pre_spend_recommendation: stringSchema()
    }),
    PreSpendReceipt: objectSchema({
      receipt_id: stringSchema(),
      timestamp: dateTimeSchema(),
      agent_id: stringSchema(),
      route_id: stringSchema(),
      provider_id: stringSchema(),
      service_id: stringSchema(),
      task_type: stringSchema(),
      cost: stringSchema(),
      payment_method: stringSchema(),
      latency_ms: integerSchema(),
      input_summary: stringSchema(),
      output_summary: stringSchema(),
      status: enumSchema(['succeeded', 'failed', 'timed_out', 'partial']),
      failure_reason: { oneOf: [stringSchema(), { type: 'null' }] },
      validation_state: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      human_notes: arrayOf(stringSchema()),
      confidence_delta: { type: 'number', minimum: -100, maximum: 100 },
      evidence_artifact: stringSchema()
    }),
    PreSpendReceiptCreateRequest: objectSchema({
      agent_id: stringSchema(),
      route_id: stringSchema(),
      provider_id: stringSchema(),
      service_id: stringSchema(),
      task_type: stringSchema(),
      cost: stringSchema(),
      payment_method: stringSchema(),
      latency_ms: integerSchema(),
      input_summary: stringSchema(),
      output_summary: stringSchema(),
      status: enumSchema(['succeeded', 'failed', 'timed_out', 'partial']),
      failure_reason: { oneOf: [stringSchema(), { type: 'null' }] },
      validation_state: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      human_notes: arrayOf(stringSchema()),
      confidence_delta: { type: 'number', minimum: -100, maximum: 100 },
      evidence_artifact: stringSchema()
    }),
    PreSpendCheckRequest: objectSchema({
      agent_id: stringSchema(),
      intent: stringSchema(),
      budget: { type: 'number', minimum: 0 },
      risk_tolerance: enumSchema(['low', 'medium', 'high', 'critical']),
      preferred_settlement: stringSchema(),
      required_confidence: { type: 'number', minimum: 0, maximum: 100 }
    }),
    PreSpendCheckResponse: objectSchema({
      intent: stringSchema(),
      decision: enumSchema(['approved', 'approved_with_warning', 'use_with_caution', 'requires_human_approval', 'do_not_use']),
      recommended_route: { oneOf: [stringSchema(), { type: 'null' }] },
      confidence_score: { type: 'number', minimum: 0, maximum: 100 },
      risk_level: enumSchema(['low', 'medium', 'high', 'critical']),
      estimated_cost: { oneOf: [stringSchema(), { type: 'null' }] },
      last_successful_run: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      known_blockers: arrayOf(stringSchema()),
      requires_human_approval: booleanSchema(),
      receipt_references: arrayOf(stringSchema()),
      safer_alternatives: arrayOf(stringSchema()),
      do_not_use: arrayOf(objectSchema({ provider: stringSchema(), reason: stringSchema() })),
      rationale: arrayOf(stringSchema())
    }),
    RouteTrustSummary: objectSchema({
      receipt_freshness: stringSchema(),
      successful_receipt_count: integerSchema(),
      failure_patterns: arrayOf(stringSchema()),
      blocker_severity: enumSchema(['none', 'low', 'medium', 'high']),
      provider_reliability: stringSchema(),
      human_validation: stringSchema(),
      summary: stringSchema()
    }),
    ProviderTrustProfile: objectSchema({
      safe_for_first_attempt: booleanSchema(),
      better_for_repeatable_routes: booleanSchema(),
      requires_human_approval: booleanSchema(),
      not_recommended: booleanSchema(),
      summary: stringSchema()
    }),
    ServiceDecisionMap: objectSchema({
      best_observed_route: { oneOf: [stringSchema(), { type: 'null' }] },
      cheapest_route: { oneOf: [stringSchema(), { type: 'null' }] },
      safest_first_attempt: { oneOf: [stringSchema(), { type: 'null' }] },
      fastest_repeatable_route: { oneOf: [stringSchema(), { type: 'null' }] },
      summary: stringSchema()
    }),
    ReceiptImpact: objectSchema({
      improves_route_confidence: booleanSchema(),
      reduces_route_confidence: booleanSchema(),
      freshness: enumSchema(['fresh', 'stale']),
      human_validated: booleanSchema(),
      should_affect_future_pre_spend_decisions: booleanSchema(),
      summary: stringSchema()
    }),
    PreSpendRouteDetailResponse: objectSchema({
      route: { $ref: '#/components/schemas/RouteIntelligence' },
      provider: { oneOf: [{ $ref: '#/components/schemas/BuilderProviderIntelligence' }, { type: 'null' }] },
      service: { oneOf: [{ $ref: '#/components/schemas/ServiceDossier' }, { type: 'null' }] },
      receipts: arrayOf({ $ref: '#/components/schemas/PreSpendReceipt' }),
      metrics: { $ref: '#/components/schemas/PreSpendMetrics' },
      validation_state: { oneOf: [enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']), { type: 'null' }] },
      decision_implications: arrayOf(stringSchema()),
      trust_summary: { oneOf: [{ $ref: '#/components/schemas/RouteTrustSummary' }, { type: 'null' }] }
    }),
    PreSpendProviderDetailResponse: objectSchema({
      provider: { $ref: '#/components/schemas/BuilderProviderIntelligence' },
      routes: arrayOf({ $ref: '#/components/schemas/RouteIntelligence' }),
      services: arrayOf({ $ref: '#/components/schemas/ServiceDossier' }),
      receipts: arrayOf({ $ref: '#/components/schemas/PreSpendReceipt' }),
      metrics: { $ref: '#/components/schemas/PreSpendMetrics' },
      provider_level_warnings: arrayOf(stringSchema()),
      trust_profile: { $ref: '#/components/schemas/ProviderTrustProfile' }
    }),
    PreSpendProviderSummary: objectSchema({
      provider_id: stringSchema(),
      name: stringSchema(),
      service_categories: arrayOf(stringSchema()),
      reliability_score: { type: 'number', minimum: 0, maximum: 100 },
      pricing_consistency: stringSchema(),
      output_quality_notes: arrayOf(stringSchema()),
      uptime_notes: arrayOf(stringSchema()),
      dispute_history: arrayOf(stringSchema()),
      human_validation_status: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      known_risks: arrayOf(stringSchema()),
      agent_compatibility: arrayOf(stringSchema()),
      route_coverage: integerSchema(),
      recent_receipt_count: integerSchema(),
      linked_routes: arrayOf(stringSchema()),
      linked_receipts: arrayOf(stringSchema()),
      trust_profile: { $ref: '#/components/schemas/ProviderTrustProfile' }
    }),
    PreSpendProviderListResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      metrics: { $ref: '#/components/schemas/PreSpendMetrics' },
      providers: arrayOf({ $ref: '#/components/schemas/PreSpendProviderSummary' })
    }),
    PreSpendServiceDetailResponse: objectSchema({
      service: { $ref: '#/components/schemas/ServiceDossier' },
      routes: arrayOf({ $ref: '#/components/schemas/RouteIntelligence' }),
      receipts: arrayOf({ $ref: '#/components/schemas/PreSpendReceipt' }),
      metrics: { $ref: '#/components/schemas/PreSpendMetrics' },
      best_route_decision_map: { $ref: '#/components/schemas/ServiceDecisionMap' }
    }),
    PreSpendReceiptDetailResponse: objectSchema({
      receipt_id: stringSchema(),
      timestamp: dateTimeSchema(),
      agent_id: stringSchema(),
      route_id: stringSchema(),
      provider_id: stringSchema(),
      service_id: stringSchema(),
      task_type: stringSchema(),
      cost: stringSchema(),
      payment_method: stringSchema(),
      latency_ms: integerSchema(),
      input_summary: stringSchema(),
      output_summary: stringSchema(),
      status: enumSchema(['succeeded', 'failed', 'timed_out', 'partial']),
      failure_reason: { oneOf: [stringSchema(), { type: 'null' }] },
      validation_state: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      human_notes: arrayOf(stringSchema()),
      confidence_delta: { type: 'number', minimum: -100, maximum: 100 },
      evidence_artifact: stringSchema(),
      route: { oneOf: [{ $ref: '#/components/schemas/RouteIntelligence' }, { type: 'null' }] },
      provider: { oneOf: [{ $ref: '#/components/schemas/BuilderProviderIntelligence' }, { type: 'null' }] },
      service: { oneOf: [{ $ref: '#/components/schemas/ServiceDossier' }, { type: 'null' }] },
      impact: { $ref: '#/components/schemas/ReceiptImpact' }
    }),
    HumanValidationSubmission: objectSchema({
      target_type: enumSchema(['route', 'provider', 'service', 'receipt']),
      target_id: stringSchema(),
      validator_id: stringSchema(),
      validation_state: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      output_quality_note: { oneOf: [stringSchema(), { type: 'null' }] },
      blocker_note: { oneOf: [stringSchema(), { type: 'null' }] },
      dispute_note: { oneOf: [stringSchema(), { type: 'null' }] },
      confidence_adjustment: { type: 'number', minimum: -30, maximum: 30 },
      human_notes: { oneOf: [stringSchema(), { type: 'null' }] }
    }),
    Claim: objectSchema({
      claim_id: stringSchema(),
      created_at: dateTimeSchema(),
      submitted_by: stringSchema(),
      claim_type: enumSchema(['reliability', 'cost', 'latency', 'output_quality', 'safety', 'dispute', 'blocker', 'benchmark', 'counterparty_risk']),
      target_type: enumSchema(['route', 'provider', 'service', 'receipt', 'counterparty', 'claim']),
      target_id: stringSchema(),
      statement: stringSchema(),
      evidence_receipt_ids: arrayOf(stringSchema()),
      evidence_artifact_uris: arrayOf(stringSchema()),
      status: enumSchema(['submitted', 'under_review', 'supported', 'challenged', 'rejected', 'resolved', 'stale']),
      confidence_score: { type: 'number', minimum: 0, maximum: 100 },
      validation_state: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      challenge_count: integerSchema(),
      support_count: integerSchema(),
      human_notes: arrayOf(stringSchema())
    }),
    ClaimCreateRequest: objectSchema({
      submitted_by: stringSchema(),
      claim_type: enumSchema(['reliability', 'cost', 'latency', 'output_quality', 'safety', 'dispute', 'blocker', 'benchmark', 'counterparty_risk']),
      target_type: enumSchema(['route', 'provider', 'service', 'receipt', 'counterparty', 'claim']),
      target_id: stringSchema(),
      statement: stringSchema(),
      evidence_receipt_ids: arrayOf(stringSchema()),
      evidence_artifact_uris: arrayOf(stringSchema()),
      status: enumSchema(['submitted', 'under_review', 'supported', 'challenged', 'rejected', 'resolved', 'stale']),
      confidence_score: { type: 'number', minimum: 0, maximum: 100 },
      validation_state: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      support_count: integerSchema(),
      human_notes: arrayOf(stringSchema())
    }),
    ClaimChallenge: objectSchema({
      challenge_id: stringSchema(),
      claim_id: stringSchema(),
      created_at: dateTimeSchema(),
      challenged_by: stringSchema(),
      reason: stringSchema(),
      evidence_receipt_ids: arrayOf(stringSchema()),
      evidence_artifact_uris: arrayOf(stringSchema()),
      status: enumSchema(['submitted', 'under_review', 'resolved', 'rejected']),
      human_notes: arrayOf(stringSchema())
    }),
    ClaimChallengeCreateRequest: objectSchema({
      challenged_by: stringSchema(),
      reason: stringSchema(),
      evidence_receipt_ids: arrayOf(stringSchema()),
      evidence_artifact_uris: arrayOf(stringSchema()),
      status: enumSchema(['submitted', 'under_review', 'resolved', 'rejected']),
      human_notes: arrayOf(stringSchema())
    }),
    ClaimDetail: objectSchema({
      claim_id: stringSchema(),
      created_at: dateTimeSchema(),
      submitted_by: stringSchema(),
      claim_type: enumSchema(['reliability', 'cost', 'latency', 'output_quality', 'safety', 'dispute', 'blocker', 'benchmark', 'counterparty_risk']),
      target_type: enumSchema(['route', 'provider', 'service', 'receipt', 'counterparty', 'claim']),
      target_id: stringSchema(),
      statement: stringSchema(),
      evidence_receipt_ids: arrayOf(stringSchema()),
      evidence_artifact_uris: arrayOf(stringSchema()),
      status: enumSchema(['submitted', 'under_review', 'supported', 'challenged', 'rejected', 'resolved', 'stale']),
      confidence_score: { type: 'number', minimum: 0, maximum: 100 },
      validation_state: enumSchema(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']),
      challenge_count: integerSchema(),
      support_count: integerSchema(),
      human_notes: arrayOf(stringSchema()),
      challenges: arrayOf({ $ref: '#/components/schemas/ClaimChallenge' })
    }),
    ProofCheckInput: objectSchema({
      input: stringSchema(),
      sourceUrl: { oneOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
      submittedBy: { oneOf: [stringSchema(), { type: 'null' }] }
    }),
    ProofCheck: objectSchema({
      check_id: stringSchema(),
      created_at: dateTimeSchema(),
      submitted_by: { oneOf: [stringSchema(), { type: 'null' }] },
      source_url: { oneOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
      input: stringSchema(),
      claim: stringSchema(),
      claim_type: enumSchema(['agent_autonomy', 'route_performance', 'provider_reliability', 'market_claim', 'token_claim', 'partnership_claim', 'revenue_claim', 'generic_claim']),
      claim_summary: stringSchema(),
      subject_label: stringSchema(),
      receipts_found: arrayOf(stringSchema()),
      evidence_artifacts: arrayOf(stringSchema()),
      evidence_strength: enumSchema(['strong', 'medium', 'weak', 'missing']),
      receipt_strength: enumSchema(['verified_receipts', 'partial_receipts', 'weak_receipts', 'no_receipts']),
      validation_status: enumSchema(['human_validated', 'community_pending', 'disputed', 'unvalidated']),
      risk_flags: arrayOf(enumSchema(['hype_without_receipts', 'autonomy_unproven', 'weak_onchain_evidence', 'no_human_validation', 'unclear_provider_history', 'narrative_over_evidence', 'route_not_repeatable', 'disputed_claim', 'missing_source'])),
      decision_state: enumSchema(['trust', 'caution', 'do_not_use_yet', 'unproven', 'disputed']),
      share_url: stringSchema(),
      share_text: stringSchema(),
      evidence_summary: stringSchema(),
      validation_summary: stringSchema(),
      decision_summary: stringSchema()
    }),
    ProofCheckResult: objectSchema({
      check_id: stringSchema(),
      created_at: dateTimeSchema(),
      submitted_by: { oneOf: [stringSchema(), { type: 'null' }] },
      source_url: { oneOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
      input: stringSchema(),
      claim: stringSchema(),
      claim_type: enumSchema(['agent_autonomy', 'route_performance', 'provider_reliability', 'market_claim', 'token_claim', 'partnership_claim', 'revenue_claim', 'generic_claim']),
      claim_summary: stringSchema(),
      subject_label: stringSchema(),
      receipts_found: arrayOf(stringSchema()),
      evidence_artifacts: arrayOf(stringSchema()),
      evidence_strength: enumSchema(['strong', 'medium', 'weak', 'missing']),
      receipt_strength: enumSchema(['verified_receipts', 'partial_receipts', 'weak_receipts', 'no_receipts']),
      validation_status: enumSchema(['human_validated', 'community_pending', 'disputed', 'unvalidated']),
      risk_flags: arrayOf(enumSchema(['hype_without_receipts', 'autonomy_unproven', 'weak_onchain_evidence', 'no_human_validation', 'unclear_provider_history', 'narrative_over_evidence', 'route_not_repeatable', 'disputed_claim', 'missing_source'])),
      decision_state: enumSchema(['trust', 'caution', 'do_not_use_yet', 'unproven', 'disputed']),
      share_url: stringSchema(),
      share_text: stringSchema(),
      evidence_summary: stringSchema(),
      validation_summary: stringSchema(),
      decision_summary: stringSchema(),
      headline: stringSchema(),
      public_cta: stringSchema()
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
    AgentReadinessState: { type: 'string', enum: ['recorded_evidence', 'caveated_evidence', 'controlled_run_observed', 'scaffold_only', 'catalog_only', 'blocked_or_unclear'] },
    AgentSpendReadiness: { type: 'string', enum: ['ready_for_inspection', 'needs_review', 'not_ready'] },
    AgentReadinessEvidenceSummary: objectSchema({
      recorded_benchmarks: integerSchema(),
      proven_routes: integerSchema(),
      controlled_bundle_runs: integerSchema(),
      scaffold_lanes: integerSchema(),
      caveat_count: integerSchema(),
      latest_artifact_id: { oneOf: [stringSchema(), { type: 'null' }] },
      latest_observed_at: { oneOf: [dateTimeSchema(), { type: 'null' }] }
    }),
    AgentReadinessProofLinks: objectSchema({
      benchmark_history: arrayOf(stringSchema()),
      route_timelines: arrayOf(stringSchema()),
      bundle_runs: arrayOf(stringSchema())
    }),
    AgentReadinessCard: objectSchema({
      provider_id: stringSchema(),
      provider_label: stringSchema(),
      readiness_state: { $ref: '#/components/schemas/AgentReadinessState' },
      agent_spend_readiness: { $ref: '#/components/schemas/AgentSpendReadiness' },
      evidence_summary: { $ref: '#/components/schemas/AgentReadinessEvidenceSummary' },
      proof_links: { $ref: '#/components/schemas/AgentReadinessProofLinks' },
      builder_next_step: stringSchema(),
      agent_guidance: stringSchema(),
      what_this_means: stringSchema(),
      winner_claimed: { const: false },
      agent_readiness_summary: { $ref: '#/components/schemas/BundleRunAgentReadinessSummary' },
      share_copy: stringSchema()
    }),
    AgentReadinessListResponse: objectSchema({
      count: integerSchema(),
      generated_at: dateTimeSchema(),
      cards: arrayOf({ $ref: '#/components/schemas/AgentReadinessCard' }),
      winner_claimed: { const: false },
      agent_guidance: arrayOf(stringSchema())
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
    BundleRunHistorySummary: objectSchema({
      history_count: integerSchema(),
      latest_run_id: { oneOf: [stringSchema(), { type: 'null' }] },
      previous_run_id: { oneOf: [stringSchema(), { type: 'null' }] },
      source_count_delta: integerSchema(),
      latest_source_count: integerSchema(),
      previous_source_count: integerSchema(),
      observed_cost_available: booleanSchema(),
      observed_cost_state: enumSchema(['available', 'unavailable']),
      skipped_review_required_steps_stable: booleanSchema(),
      latest_skipped_step_count: integerSchema(),
      previous_skipped_step_count: integerSchema(),
      caveat_codes_latest: arrayOf(enumSchema(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'])),
      caveat_codes_previous: arrayOf(enumSchema(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'])),
      caveat_delta: objectSchema({
        added: arrayOf(enumSchema(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'])),
        removed: arrayOf(enumSchema(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty']))
      }),
      winner_claimed: { const: false }
    }),
    BundleRunFreshness: {
      oneOf: [
        objectSchema({
          last_controlled_run_at: dateTimeSchema(),
          latest_run_age_hours: { type: 'number', minimum: 0 },
          freshness_state: enumSchema(['fresh', 'aging', 'stale']),
          freshness_thresholds_hours: objectSchema({
            fresh_until: { const: 24 },
            aging_until: { const: 72 }
          }),
          recommended_agent_action: stringSchema()
        }),
        { type: 'null' }
      ]
    },
    BundleRunAgentReadinessSummary: objectSchema({
      ready_for_agent_review: booleanSchema(),
      requires_rerun_before_spend: booleanSchema(),
      requires_human_or_policy_approval: booleanSchema(),
      observed_cost_available: booleanSchema(),
      winner_claimed: { const: false },
      decision_state: enumSchema(['ready_for_review', 'review_ready_caveated', 'rerun_required', 'not_ready']),
      blocking_reasons: arrayOf(enumSchema(['freshness_stale', 'winner_claimed_true'])),
      review_reasons: arrayOf(enumSchema(['billing_unclear_steps_skipped', 'observed_cost_unavailable', 'status_code_unavailable', 'source_map_empty'])),
      recommended_agent_action: stringSchema()
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
      latest_run_id: { oneOf: [stringSchema(), { type: 'null' }] },
      latest_generated_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      runs: arrayOf({ $ref: '#/components/schemas/BundleRunSummary' }),
      history_summary: { $ref: '#/components/schemas/BundleRunHistorySummary' },
      freshness: { $ref: '#/components/schemas/BundleRunFreshness' },
      winner_claimed: { const: false },
      agent_readiness_summary: { $ref: '#/components/schemas/BundleRunAgentReadinessSummary' },
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
      category: enumSchema(['compute', 'inference', 'web', 'vision', 'storage', 'translation', 'navigation']),
      market_type: enumSchema(['digital', 'physical', 'all-compatible']),
      source_market: enumSchema(['robotic.sh', 'pay.sh', 'agentic.market']),
      chain: enumSchema(['solana', 'base', 'peaq', 'omnichain', 'unknown']),
      status: enumSchema(['ready', 'setup']),
      price_display: stringSchema(),
      description: stringSchema(),
      machine_use_case: stringSchema(),
      evidence_health: enumSchema(['scaffold', 'listed']),
      evidence_stage: enumSchema(['listed', 'classified', 'policy-mapped', 'preflight-ready', 'execution-tested', 'receipt-recorded', 'benchmark-recorded']),
      policy_risk: stringSchema(),
      caveats: arrayOf(stringSchema()),
      access_rail: enumSchema(['pay_sh_solana', 'peaqos_market_provider_account', 'peaqos_market_operator_defined', 'not_recorded']),
      rail_status: enumSchema(['plan_eligible', 'review_required', 'proof_plan_selected', 'not_recorded']),
      route_surface_status: enumSchema(['callable_routes_listed', 'operator_runtime_required', 'provider_setup_only', 'no_callable_endpoints', 'not_recorded']),
      endpoint_count: { type: ['integer', 'null'], minimum: 0 },
      route_count: { type: 'integer', minimum: 0 },
      pricing_model: stringSchema(),
      credential_requirement: stringSchema(),
      first_safe_route: stringSchema(),
      rail_caveat: stringSchema(),
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
      allowed_categories: arrayOf(enumSchema(['compute', 'inference', 'web', 'vision', 'storage', 'translation', 'navigation'])),
      blocked_categories: arrayOf(enumSchema(['compute', 'inference', 'web', 'vision', 'storage', 'translation', 'navigation'])),
      allowed_source_markets: arrayOf(enumSchema(['robotic.sh', 'pay.sh', 'agentic.market'])),
      blocked_source_markets: arrayOf(enumSchema(['robotic.sh', 'pay.sh', 'agentic.market'])),
      allowed_chains: arrayOf(enumSchema(['solana', 'base', 'peaq', 'omnichain', 'unknown'])),
      blocked_chains: arrayOf(enumSchema(['solana', 'base', 'peaq', 'omnichain', 'unknown'])),
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
      allowed_chains: arrayOf(enumSchema(['solana', 'base', 'peaq', 'omnichain', 'unknown'])),
      risk_tolerance: enumSchema(['low', 'medium', 'high']),
      requires_receipt: booleanSchema(),
      human_approved: booleanSchema(),
      policy_id: stringSchema(),
      minimum_evidence_stage: enumSchema(['listed', 'classified', 'policy-mapped', 'preflight-ready', 'execution-tested', 'receipt-recorded', 'benchmark-recorded'])
    }, ['machine_id', 'intent', 'category']),
    MachinePreflightServiceSummary: objectSchema({
      id: stringSchema(),
      name: stringSchema(),
      provider: stringSchema(),
      category: enumSchema(['compute', 'inference', 'web', 'vision', 'storage', 'translation', 'navigation']),
      source_market: enumSchema(['robotic.sh', 'pay.sh', 'agentic.market']),
      chain: enumSchema(['solana', 'base', 'peaq', 'omnichain', 'unknown']),
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
      chain: { type: ['string', 'null'], enum: ['solana', 'base', 'peaq', 'omnichain', 'unknown', null] },
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
      coverage_run_id: nullableString(),
      demo_mode: booleanSchema(),
      execution_occurred: { const: false },
      payment_occurred: { const: false },
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
    }),
    MachinePreflightCoverageServiceResult: objectSchema({
      service_id: stringSchema(),
      service_name: stringSchema(),
      decision: enumSchema(['allow', 'deny', 'review']),
      receipt_id: stringSchema(),
      execution_occurred: { const: false },
      payment_occurred: { const: false }
    }),
    MachinePreflightCoverageRun: objectSchema({
      run_id: stringSchema(),
      generated_at: dateTimeSchema(),
      services_total: integerSchema(),
      preflight_evaluated: integerSchema(),
      receipts_recorded: integerSchema(),
      allow_count: integerSchema(),
      review_count: integerSchema(),
      deny_count: integerSchema(),
      execution_occurred: { const: false },
      payment_occurred: { const: false },
      phase_scope: { const: 'phase_2_pay_sh_robotic_sh' },
      storage: freeformObject(),
      caveats: arrayOf(stringSchema()),
      service_results: arrayOf({ $ref: '#/components/schemas/MachinePreflightCoverageServiceResult' })
    }),
    MachinePreflightCoverageRunListResponse: objectSchema({
      generated_at: dateTimeSchema(),
      source: { const: 'infopunks-pay-sh-radar' },
      module: { const: 'machine-economy' },
      count: integerSchema(),
      runs: arrayOf({ $ref: '#/components/schemas/MachinePreflightCoverageRun' })
    }),
    MachineExecutionReceiptIngestRequest: objectSchema({
      machine_id: stringSchema(),
      service_id: stringSchema(),
      fqn: stringSchema(),
      source_market: enumSchema(['robotic.sh', 'pay.sh', 'agentic.market']),
      chain: enumSchema(['solana', 'base', 'peaq', 'omnichain', 'unknown']),
      preflight_receipt_id: nullableString(),
      execution_status: enumSchema(['attempted', 'succeeded', 'failed']),
      execution_occurred: booleanSchema(),
      payment_occurred: booleanSchema(),
      payment_evidence: { oneOf: [freeformObject(), { type: 'null' }, stringSchema(), integerSchema(), booleanSchema(), { type: 'array', items: {} }] },
      execution_started_at: dateTimeSchema(),
      execution_completed_at: dateTimeSchema(),
      execution_latency_ms: integerSchema(),
      request_summary: freeformObject(),
      response_summary: { oneOf: [freeformObject(), { type: 'null' }] },
      executor: objectSchema({
        name: stringSchema(),
        version: nullableString(),
        mode: enumSchema(['pay_cli', 'x402', 'manual'])
      }, ['name', 'mode']),
      artifact_signature: nullableString()
    }, [
      'machine_id',
      'service_id',
      'fqn',
      'source_market',
      'chain',
      'execution_status',
      'execution_occurred',
      'payment_occurred',
      'payment_evidence',
      'execution_started_at',
      'execution_completed_at',
      'execution_latency_ms',
      'request_summary',
      'response_summary',
      'executor'
    ]),
    MachineExecutionReceiptIngestResponse: objectSchema({
      accepted: { const: true },
      receipt_id: stringSchema(),
      service_id: stringSchema(),
      execution_status: enumSchema(['attempted', 'succeeded', 'failed']),
      execution_occurred: booleanSchema(),
      payment_occurred: booleanSchema(),
      payment_status: enumSchema(['not_confirmed', 'confirmed']),
      payment_evidence: { oneOf: [freeformObject(), { type: 'null' }, stringSchema(), integerSchema(), booleanSchema(), { type: 'array', items: {} }] },
      evidence_stage_after: enumSchema(['policy-mapped', 'execution-tested']),
      caveats: arrayOf(stringSchema())
    }, [
      'accepted',
      'receipt_id',
      'service_id',
      'execution_status',
      'execution_occurred',
      'payment_occurred',
      'payment_status',
      'payment_evidence',
      'evidence_stage_after',
      'caveats'
    ]),
    BigQueryBoundedQueryFixtureIngestRequest: objectSchema({
      machine_id: stringSchema(),
      execution_completed_at: dateTimeSchema()
    }),
    BigQueryBoundedQueryFixtureSampleResponse: objectSchema({
      fixture_label: stringSchema(),
      proof_profile: { const: 'bigquery_bounded_query' },
      replace_with: stringSchema(),
      payload: { $ref: '#/components/schemas/MachineExecutionReceiptIngestRequest' }
    }, ['fixture_label', 'proof_profile', 'replace_with', 'payload']),
    BigQueryBoundedQueryFixtureIngestResponse: objectSchema({
      fixture_ingested: { const: true },
      fixture_label: stringSchema(),
      proof_profile: { const: 'bigquery_bounded_query' },
      payload: { $ref: '#/components/schemas/MachineExecutionReceiptIngestRequest' },
      accepted: { const: true },
      receipt_id: stringSchema(),
      service_id: { const: 'bigquery' },
      execution_status: enumSchema(['attempted', 'succeeded', 'failed']),
      execution_occurred: booleanSchema(),
      payment_occurred: booleanSchema(),
      payment_status: enumSchema(['not_confirmed', 'confirmed']),
      payment_evidence: { oneOf: [freeformObject(), { type: 'null' }, stringSchema(), integerSchema(), booleanSchema(), { type: 'array', items: {} }] },
      evidence_stage_after: enumSchema(['policy-mapped', 'execution-tested']),
      caveats: arrayOf(stringSchema())
    }, [
      'fixture_ingested',
      'fixture_label',
      'proof_profile',
      'payload',
      'accepted',
      'receipt_id',
      'service_id',
      'execution_status',
      'execution_occurred',
      'payment_occurred',
      'payment_status',
      'payment_evidence',
      'evidence_stage_after',
      'caveats'
    ]),
    StableuploadTinyFixtureIngestRequest: objectSchema({
      machine_id: stringSchema(),
      execution_completed_at: dateTimeSchema()
    }),
    StableuploadTinyFixtureSampleResponse: objectSchema({
      fixture_label: stringSchema(),
      proof_profile: { const: 'stableupload_tiny_fixture' },
      replace_with: stringSchema(),
      payload: { $ref: '#/components/schemas/MachineExecutionReceiptIngestRequest' }
    }, ['fixture_label', 'proof_profile', 'replace_with', 'payload']),
    StableuploadTinyFixtureIngestResponse: objectSchema({
      fixture_ingested: { const: true },
      fixture_label: stringSchema(),
      proof_profile: { const: 'stableupload_tiny_fixture' },
      payload: { $ref: '#/components/schemas/MachineExecutionReceiptIngestRequest' },
      accepted: { const: true },
      receipt_id: stringSchema(),
      service_id: { const: 'stableupload' },
      execution_status: enumSchema(['attempted', 'succeeded', 'failed']),
      execution_occurred: booleanSchema(),
      payment_occurred: booleanSchema(),
      payment_status: enumSchema(['not_confirmed', 'confirmed']),
      payment_evidence: { oneOf: [freeformObject(), { type: 'null' }, stringSchema(), integerSchema(), booleanSchema(), { type: 'array', items: {} }] },
      evidence_stage_after: enumSchema(['policy-mapped', 'execution-tested']),
      caveats: arrayOf(stringSchema())
    }, [
      'fixture_ingested',
      'fixture_label',
      'proof_profile',
      'payload',
      'accepted',
      'receipt_id',
      'service_id',
      'execution_status',
      'execution_occurred',
      'payment_occurred',
      'payment_status',
      'payment_evidence',
      'evidence_stage_after',
      'caveats'
    ]),
    NaverGeocodeFixtureIngestRequest: objectSchema({
      machine_id: stringSchema(),
      execution_completed_at: dateTimeSchema()
    }),
    NaverGeocodeFixtureSampleResponse: objectSchema({
      fixture_label: stringSchema(),
      proof_profile: { const: 'naver_geocode_lookup' },
      replace_with: stringSchema(),
      payload: { $ref: '#/components/schemas/MachineExecutionReceiptIngestRequest' }
    }, ['fixture_label', 'proof_profile', 'replace_with', 'payload']),
    NaverGeocodeFixtureIngestResponse: objectSchema({
      fixture_ingested: { const: true },
      fixture_label: stringSchema(),
      proof_profile: { const: 'naver_geocode_lookup' },
      payload: { $ref: '#/components/schemas/MachineExecutionReceiptIngestRequest' },
      accepted: { const: true },
      receipt_id: stringSchema(),
      service_id: { const: 'naver-maps' },
      execution_status: enumSchema(['attempted', 'succeeded', 'failed']),
      execution_occurred: booleanSchema(),
      payment_occurred: booleanSchema(),
      payment_status: enumSchema(['not_confirmed', 'confirmed']),
      payment_evidence: { oneOf: [freeformObject(), { type: 'null' }, stringSchema(), integerSchema(), booleanSchema(), { type: 'array', items: {} }] },
      evidence_stage_after: enumSchema(['policy-mapped', 'execution-tested']),
      caveats: arrayOf(stringSchema())
    }, [
      'fixture_ingested',
      'fixture_label',
      'proof_profile',
      'payload',
      'accepted',
      'receipt_id',
      'service_id',
      'execution_status',
      'execution_occurred',
      'payment_occurred',
      'payment_status',
      'payment_evidence',
      'evidence_stage_after',
      'caveats'
    ])
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
