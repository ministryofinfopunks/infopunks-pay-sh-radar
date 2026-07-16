type JsonSchema = Record<string, unknown>;
type OpenApiSpec = Record<string, unknown>;

const SAFE_METADATA_NOTE = 'Safe metadata only: Radar uses catalog-derived intelligence and metadata reachability signals. It does not execute paid Pay.sh provider APIs and does not expose secrets.';

export function createOpenApiSpec(version = '0.1.0'): OpenApiSpec {
  const paths: Record<string, unknown> = {};

  const add = (method: 'get' | 'post' | 'patch', path: string, operation: Record<string, unknown>) => {
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
  add('get', '/v1/loops', {
    tags: ['Loops'],
    summary: 'List loop checks',
    description: 'Returns seeded autonomous loops with proof states, decision states, linked proof checks, and public memory fields.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      loops: arrayOf({ $ref: '#/components/schemas/LoopDetail' })
    }), { loops: [{ id: 'loop_pre_spend_route', decision_state: 'trust', linked_check_id: 'check_route_pay_sh_seed' }] })
  });
  add('get', '/v1/loops/{loop_id}', {
    tags: ['Loops'],
    summary: 'Get loop detail',
    description: 'Returns one autonomous loop with latest run memory and the linked proof receipt reference.',
    parameters: [pathParam('loop_id', 'Loop identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/LoopDetail' }, {
      id: 'loop_provider_trust',
      proof_state: 'verified',
      linked_check_id: 'check_provider_reliability_seed'
    }, 'loop_not_found')
  });
  add('post', '/v1/loops/check', {
    tags: ['Loops'],
    summary: 'Create loop check',
    description: 'Creates a deterministic loop check record and links it to an existing or inferred proof receipt.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/LoopCheckInput' }, {
      input: 'Provider trust loop for receipt parsing reliability.',
      linked_check_id: 'check_provider_reliability_seed'
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/LoopDetail' }, {
      id: 'loop_123abc',
      name: 'Generated Provider Trust Loop',
      linked_check_id: 'check_provider_reliability_seed'
    })
  });
  add('get', '/v1/graph', {
    tags: ['Signal Graph'],
    summary: 'Get expanded graph',
    description: 'Returns the existing graph layer in a backwards-compatible shape with additive Signal Graph fields: tagline, clusters, ripples, and stats. Existing nodes, edges, and evidence remain present.',
    responses: envelopedResponses({ $ref: '#/components/schemas/SignalGraphResponse' }, {
      tagline: 'Stop scrolling the feed. Read the graph.',
      clusters: [{ id: 'pre_spend_intelligence', label: 'Pre-Spend Intelligence', proof_state: 'validated' }],
      nodes: [{ id: 'claim_no_receipt_no_trust', type: 'claim', label: 'No receipt, no trust' }],
      edges: [{ id: 'edge_no_receipt_proof_feed', source_node_id: 'claim_no_receipt_no_trust', target_node_id: 'proof_check_feed', type: 'proof_link' }],
      ripples: [{ id: 'ripple_pre_spend_24h', cluster_id: 'pre_spend_intelligence', proof_state: 'validated' }],
      stats: { node_count: 28, edge_count: 38, cluster_count: 5, validated_count: 11, disputed_count: 2, compounding_count: 8, last_updated_at: '2026-06-25T09:00:00.000Z' },
      evidence: { source: 'fixture_fallback', confidence: 0.5 }
    })
  });
  add('get', '/v1/graph/clusters', {
    tags: ['Signal Graph'],
    summary: 'List Signal Graph clusters',
    description: 'Returns the seeded Signal Graph cluster registry with proof states and 24h ripple summaries.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      clusters: arrayOf({ $ref: '#/components/schemas/SignalGraphCluster' })
    }), { clusters: [{ id: 'agentic_payments', label: 'Agentic Payments', proof_state: 'compounding' }] })
  });
  add('get', '/v1/graph/clusters/{cluster_id}', {
    tags: ['Signal Graph'],
    summary: 'Get Signal Graph cluster detail',
    description: 'Returns one Signal Graph cluster with its local nodes, touching edges, and current ripples.',
    parameters: [pathParam('cluster_id', 'Signal Graph cluster identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/SignalGraphClusterDetail' }, {
      cluster: { id: 'machine_markets', label: 'Machine Markets', proof_state: 'validated' },
      nodes: [{ id: 'project_machine_markets', type: 'project', label: 'Machine markets' }],
      edges: [{ id: 'edge_machine_markets_m2m', source_node_id: 'project_machine_markets', target_node_id: 'claim_m2m_payments', type: 'proof_link' }],
      ripples: [{ id: 'ripple_machine_markets_24h', cluster_id: 'machine_markets', title: 'Machine buyers are moving from demo copy to bounded route plans' }]
    }, 'signal_graph_cluster_not_found')
  });
  add('get', '/v1/graph/nodes/{node_id}', {
    tags: ['Signal Graph'],
    summary: 'Get Signal Graph node detail',
    description: 'Returns one Signal Graph node, its cluster, connected edges, related nodes, and active ripples.',
    parameters: [pathParam('node_id', 'Signal Graph node identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/SignalGraphNodeDetail' }, {
      node: { id: 'project_pay_sh', type: 'project', label: 'Pay.sh', proof_state: 'validated' },
      cluster: { id: 'agentic_payments', label: 'Agentic Payments', proof_state: 'compounding' },
      connected_edges: [{ id: 'edge_pay_sh_pre_spend', source_node_id: 'project_pay_sh', target_node_id: 'project_pre_spend_intelligence', type: 'proof_link' }],
      related_nodes: [{ id: 'project_pre_spend_intelligence', type: 'project', label: 'Pre-Spend Intelligence', proof_state: 'validated' }],
      ripples: [{ id: 'ripple_agentic_payments_24h', cluster_id: 'agentic_payments', title: 'Payment rail narrative is consolidating around wallet-aware routes' }]
    }, 'signal_graph_node_not_found')
  });
  add('get', '/v1/graph/entities/{entity_type}/{entity_id}', {
    tags: ['Signal Graph'],
    summary: 'Lookup Signal Graph nodes by linked entity',
    description: 'Returns Signal Graph nodes that explicitly link to the requested receipt, claim, loop, route, provider, or service ID. No label heuristics are used.',
    parameters: [
      { name: 'entity_type', in: 'path', required: true, description: 'Stable linked entity type.', schema: { $ref: '#/components/schemas/SignalGraphEntityType' } },
      pathParam('entity_id', 'Stable entity identifier.')
    ],
    responses: envelopedResponses({ $ref: '#/components/schemas/SignalGraphEntityLookupResponse' }, {
      entity_type: 'claim',
      entity_id: 'claim_001',
      nodes: [{ id: 'claim_route_memory', type: 'claim', label: 'Route memory', cluster_id: 'pre_spend_intelligence', proof_state: 'validated' }]
    }, 'unsupported_signal_graph_entity_type')
  });
  add('get', '/v1/graph/ripples', {
    tags: ['Signal Graph'],
    summary: 'List Signal Graph ripples',
    description: 'Returns the 24h change layer for the seeded Signal Graph.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      ripples: arrayOf({ $ref: '#/components/schemas/SignalGraphRipple' })
    }), { ripples: [{ id: 'ripple_ct_24h', cluster_id: 'ct_subcultures', proof_state: 'compounding' }] })
  });
  add('post', '/v1/graph/check', {
    tags: ['Signal Graph'],
    summary: 'Check Signal Graph input',
    description: 'Runs a deterministic v0 Signal Graph assessment over a lightweight claim, meme, or project input and suggests how it should connect into graph memory.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/SignalGraphCheckInput' }, {
      label: 'Agent wallets need route memory before autonomous spend.',
      summary: 'Wallet-aware agents should inherit confidence from receipts, not from feed consensus.',
      source_url: 'https://example.com/agent-wallets-route-memory',
      cluster_id: 'pre_spend_intelligence'
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/SignalGraphCheckResponse' }, {
      generated_node_preview: { id: 'preview_abc123', type: 'agent', label: 'Agent wallets need route memory before autonomous spend.', cluster_id: 'pre_spend_intelligence', proof_state: 'validated' },
      suggested_proof_state: 'validated',
      confidence_score: 90,
      suggested_edges: [{ target_node_id: 'claim_no_receipt_no_trust', type: 'proof_link', strength: 92 }],
      explanation: 'Deterministic v0 assessment suggests the input already speaks in receipt, route, or proof language and should connect into the graph as validated memory.'
    })
  });
  add('get', '/v1/hermes', {
    tags: ['Hermes'],
    summary: 'Get Hermes Desk summary',
    description: 'Returns the deploy-safe Hermes Desk surface. Hermes Agent is represented as an optional sidecar runtime; this endpoint works in mock mode without live sidecar calls.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesDeskSummary' }, {
      title: 'Hermes Desk',
      route: '/hermes',
      explanation: 'Hermes runs the loop. Infopunks keeps the receipts.',
      counts: { runs: 3, active_runs: 1, completed_runs: 2 },
      sidecar: { enabled: false, mode: 'mock', live_http_allowed: false, status: 'disabled' }
    })
  });
  add('get', '/v1/hermes/skill-pack', {
    tags: ['Hermes'],
    summary: 'Get Infopunks Hermes Skill Pack',
    description: 'Returns the deterministic Infopunks Pre-Spend Skill Pack manifest that teaches Hermes how to investigate before money moves.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesSkillPack' }, {
      id: 'infopunks-pre-spend-skill-pack',
      title: 'Infopunks Pre-Spend Skill Pack',
      tagline: 'Hermes runs the investigation. Infopunks keeps the receipts.'
    })
  });
  add('get', '/v1/hermes/spend-policy', {
    tags: ['Hermes'],
    summary: 'List seeded Hermes spend policies',
    description: 'Returns deterministic seeded spend policies and their rule map. This route is stateless, deploy-safe, and does not require a live Hermes sidecar.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      count: integerSchema(),
      policies: arrayOf({ $ref: '#/components/schemas/HermesSpendPolicy' }),
      rules: arrayOf({ $ref: '#/components/schemas/HermesSpendPolicyRule' })
    }), {
      generated_at: '2026-07-03T00:00:00.000Z',
      count: 2,
      policies: [{ id: 'policy_infopunks_default_agent_spend', title: 'Infopunks Default Agent Spend Policy', max_amount_usd: 250 }],
      rules: [{ id: 'policy_rule_max_amount', label: 'Maximum autonomous spend', severity: 'high' }]
    })
  });
  add('get', '/v1/hermes/spend-policy/example', {
    tags: ['Hermes'],
    summary: 'Get Hermes spend policy example',
    description: 'Returns one deterministic example spend policy check using seeded route, provider, service, amount, chain, and payment rail inputs.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesSpendPolicyCheckResult' }, {
      id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      decision: 'block',
      allowed: false,
      required_action: 'do_not_spend',
      reason: 'Pre-spend decision returned do_not_spend: Provider reputation is degraded in the ledger.'
    })
  });
  add('post', '/v1/hermes/spend-policy/check', {
    tags: ['Hermes'],
    summary: 'Check Hermes spend policy',
    description: 'Converts a spend intent plus pre-spend decision memory into an allow, test, review, or block decision. This route is deterministic, stateless, mock-safe, and never requires a live Hermes sidecar.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/HermesSpendPolicyCheckInput' }, {
      route_id: 'route_pay_sh_market_research_01',
      provider_id: 'provider_pay_sh_lattice',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'x402',
      chain: 'base'
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesSpendPolicyCheckResult' }, {
      id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      policy: {
        id: 'policy_infopunks_default_agent_spend',
        title: 'Infopunks Default Agent Spend Policy',
        summary: 'A conservative policy for autonomous wallets using pre-spend intelligence.',
        max_amount_usd: 250,
        allowed_chains: ['base', 'solana'],
        allowed_payment_rails: ['x402', 'pay.sh', 'agentic.market'],
        blocked_providers: [],
        require_test_spend_for_watchlist: true,
        manual_review_threshold_usd: 1000,
        do_not_spend_on_disputed: true,
        created_at: '2026-07-03T00:00:00.000Z'
      },
      input: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        amount_usd: 25,
        payment_rail: 'x402',
        chain: 'base'
      },
      decision: 'block',
      allowed: false,
      reason: 'Pre-spend decision returned do_not_spend: Provider reputation is degraded in the ledger.',
      required_action: 'do_not_spend',
      violations: [{ id: 'policy_violation_pre_spend_do_not_spend', rule_id: 'policy_rule_pre_spend_block', severity: 'critical', label: 'Pre-spend engine blocked the spend', detail: 'Pre-spend decision returned do_not_spend with required_action=do_not_use_provider.', outcome: 'blocked' }],
      warnings: [{ id: 'policy_warning_watchlist_test_spend', rule_id: 'policy_rule_watchlist_test_spend', severity: 'medium', label: 'Watchlist requires test spend', detail: 'Matched provider, route, or service memory is on watchlist or the decision engine already recommends a test spend first.', outcome: 'test_spend_required' }],
      pre_spend_decision: {
        id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        input: {
          route_id: 'route_pay_sh_market_research_01',
          provider_id: 'provider_pay_sh_lattice',
          service_id: 'service_market_research',
          amount_usd: 25,
          payment_rail: 'x402',
          chain: 'base'
        },
        decision: 'do_not_spend',
        confidence: 0.46,
        reason: 'Provider reputation is degraded in the ledger.',
        required_action: 'do_not_use_provider',
        risk_factors: [{ id: 'provider_degraded', severity: 'high', label: 'provider degraded', detail: 'Lattice Research Relay is degraded with trust score 13.', source: 'provider_reputation' }],
        reputation_inputs: [{ kind: 'reputation_entry', id: 'provider:provider_pay_sh_lattice', target_type: 'provider', target_id: 'provider_pay_sh_lattice', summary: 'Lattice Research Relay is degraded with trust score 13.' }],
        receipt_inputs: [],
        claim_inputs: [],
        run_inputs: [],
        ledger_state: { provider_state: 'degraded', route_state: 'watchlist', service_state: 'watchlist', provider_score: 13, route_score: 38, service_score: 41 },
        generated_at: '2026-07-03T00:00:00.000Z'
      },
      references: [
        { kind: 'policy', id: 'policy_infopunks_default_agent_spend', summary: 'Infopunks Default Agent Spend Policy: A conservative policy for autonomous wallets using pre-spend intelligence.' },
        { kind: 'pre_spend_decision', id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective', summary: 'do_not_spend with required_action=do_not_use_provider. Provider reputation is degraded in the ledger.' }
      ],
      generated_at: '2026-07-03T00:00:00.000Z'
    })
  });
  add('get', '/v1/hermes/spend-policy/check/{check_id}/receipt-preview', {
    tags: ['Hermes'],
    summary: 'Preview Hermes policy decision receipt',
    description: 'Converts a deterministic Hermes spend policy check into a stateless audit receipt preview. No persistence is performed.',
    parameters: [pathParam('check_id', 'Hermes spend policy check identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesPolicyDecisionReceiptConversion' }, {
      check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      receipt: {
        id: 'receipt_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source: 'spend_policy_check',
        source_check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_policy_id: 'policy_infopunks_default_agent_spend',
        title: 'Policy Decision Receipt: block',
        summary: 'Decision=block; allowed=false; required_action=do_not_spend; reason=Pre-spend decision returned do_not_spend: Provider reputation is degraded in the ledger.',
        receipt_kind: 'spend_policy_decision_receipt',
        policy_decision: 'block',
        allowed: false,
        required_action: 'do_not_spend',
        reason: 'Pre-spend decision returned do_not_spend: Provider reputation is degraded in the ledger.',
        input: {
          route_id: 'route_pay_sh_market_research_01',
          provider_id: 'provider_pay_sh_lattice',
          service_id: 'service_market_research',
          amount_usd: 25,
          payment_rail: 'x402',
          chain: 'base',
          policy_id: 'policy_infopunks_default_agent_spend'
        },
        policy_snapshot: {
          id: 'policy_infopunks_default_agent_spend',
          title: 'Infopunks Default Agent Spend Policy',
          max_amount_usd: 250,
          allowed_chains: ['base', 'solana'],
          allowed_payment_rails: ['x402', 'pay.sh', 'agentic.market'],
          blocked_providers: [],
          require_test_spend_for_watchlist: true,
          manual_review_threshold_usd: 1000,
          do_not_spend_on_disputed: true
        },
        violations: [{ id: 'policy_violation_pre_spend_do_not_spend', rule_id: 'policy_rule_pre_spend_block', severity: 'critical', label: 'Pre-spend engine blocked the spend', detail: 'Pre-spend decision returned do_not_spend with required_action=do_not_use_provider.', outcome: 'blocked' }],
        warnings: [{ id: 'policy_warning_watchlist_test_spend', rule_id: 'policy_rule_watchlist_test_spend', severity: 'medium', label: 'Watchlist requires test spend', detail: 'Matched provider, route, or service memory is on watchlist or the decision engine already recommends a test spend first.', outcome: 'test_spend_required' }],
        pre_spend_decision_id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        references: [{ kind: 'policy', id: 'policy_infopunks_default_agent_spend', summary: 'Infopunks Default Agent Spend Policy: A conservative policy for autonomous wallets using pre-spend intelligence.' }],
        audit_trail: {
          id: 'audit_trail_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
          source_check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
          events: [{ id: 'audit_event_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_policy_loaded', at: '2026-07-03T00:00:00.000Z', label: 'Policy Loaded', state: 'policy_loaded', summary: 'Loaded policy policy_infopunks_default_agent_spend for deterministic evaluation.' }]
        },
        risk_summary: {
          risk_level: 'critical',
          violation_count: 1,
          warning_count: 1,
          critical_count: 1,
          high_count: 0,
          summary: 'Policy blocked spend and retained the decision as audit evidence.'
        },
        created_at: '2026-07-03T00:00:00.000Z'
      },
      conversion: {
        status: 'converted',
        notes: ['Blocked policy decisions are retained as audit evidence.']
      }
    }, 'hermes_spend_policy_check_not_found')
  });
  add('post', '/v1/hermes/spend-policy/check/{check_id}/receipt', {
    tags: ['Hermes'],
    summary: 'Create Hermes policy decision receipt',
    description: 'Statelessly converts a deterministic Hermes spend policy check into an audit receipt object. No persistence is performed.',
    parameters: [pathParam('check_id', 'Hermes spend policy check identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesPolicyDecisionReceiptConversion' }, {
      check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      receipt: {
        id: 'receipt_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source: 'spend_policy_check',
        source_check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_policy_id: 'policy_infopunks_default_agent_spend',
        title: 'Policy Decision Receipt: block',
        summary: 'Decision=block; allowed=false; required_action=do_not_spend; reason=Pre-spend decision returned do_not_spend: Provider reputation is degraded in the ledger.',
        receipt_kind: 'spend_policy_decision_receipt',
        policy_decision: 'block',
        allowed: false,
        required_action: 'do_not_spend',
        reason: 'Pre-spend decision returned do_not_spend: Provider reputation is degraded in the ledger.',
        input: {
          route_id: 'route_pay_sh_market_research_01',
          provider_id: 'provider_pay_sh_lattice',
          service_id: 'service_market_research',
          amount_usd: 25,
          payment_rail: 'x402',
          chain: 'base',
          policy_id: 'policy_infopunks_default_agent_spend'
        },
        policy_snapshot: {
          id: 'policy_infopunks_default_agent_spend',
          title: 'Infopunks Default Agent Spend Policy',
          max_amount_usd: 250,
          allowed_chains: ['base', 'solana'],
          allowed_payment_rails: ['x402', 'pay.sh', 'agentic.market'],
          blocked_providers: [],
          require_test_spend_for_watchlist: true,
          manual_review_threshold_usd: 1000,
          do_not_spend_on_disputed: true
        },
        violations: [{ id: 'policy_violation_pre_spend_do_not_spend', rule_id: 'policy_rule_pre_spend_block', severity: 'critical', label: 'Pre-spend engine blocked the spend', detail: 'Pre-spend decision returned do_not_spend with required_action=do_not_use_provider.', outcome: 'blocked' }],
        warnings: [{ id: 'policy_warning_watchlist_test_spend', rule_id: 'policy_rule_watchlist_test_spend', severity: 'medium', label: 'Watchlist requires test spend', detail: 'Matched provider, route, or service memory is on watchlist or the decision engine already recommends a test spend first.', outcome: 'test_spend_required' }],
        pre_spend_decision_id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        references: [{ kind: 'policy', id: 'policy_infopunks_default_agent_spend', summary: 'Infopunks Default Agent Spend Policy: A conservative policy for autonomous wallets using pre-spend intelligence.' }],
        audit_trail: {
          id: 'audit_trail_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
          source_check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
          events: [{ id: 'audit_event_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_policy_loaded', at: '2026-07-03T00:00:00.000Z', label: 'Policy Loaded', state: 'policy_loaded', summary: 'Loaded policy policy_infopunks_default_agent_spend for deterministic evaluation.' }]
        },
        risk_summary: {
          risk_level: 'critical',
          violation_count: 1,
          warning_count: 1,
          critical_count: 1,
          high_count: 0,
          summary: 'Policy blocked spend and retained the decision as audit evidence.'
        },
        created_at: '2026-07-03T00:00:00.000Z'
      },
      conversion: {
        status: 'converted',
        notes: ['Blocked policy decisions are retained as audit evidence.']
      }
    }, 'hermes_spend_policy_check_not_found')
  });
  add('get', '/v1/hermes/spend-policy/check/{check_id}/reconciliation-preview', {
    tags: ['Hermes'],
    summary: 'Preview Hermes policy outcome reconciliation',
    description: 'Builds a deterministic preview reconciliation by comparing a policy decision receipt against a default wallet outcome. No persistence is performed and no live Hermes sidecar is required.',
    parameters: [pathParam('check_id', 'Hermes spend policy check identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesPolicyReconciliationResult' }, {
      check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      policy_receipt_id: 'receipt_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      outcome: {
        id: 'policy_outcome_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_policy_receipt_id: 'receipt_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        outcome_state: 'blocked_as_required',
        outcome_summary: 'Wallet stayed blocked after policy denied autonomous spend.',
        spend_happened: false,
        amount_usd: 25,
        chain: 'base',
        payment_rail: 'x402',
        provider_id: 'provider_pay_sh_lattice',
        route_id: 'route_pay_sh_market_research_01',
        service_id: 'service_market_research',
        evidence_artifacts: [{ id: 'artifact_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_policy_reconciliation_note', label: 'Mock reconciliation note', kind: 'note', uri: '/v1/hermes/spend-policy/check/hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective/outcome', summary: 'Deterministic mock outcome artifact generated because no external wallet evidence artifact was supplied.' }],
        created_at: '2026-07-03T00:00:00.000Z'
      },
      compliance_state: 'compliant',
      findings: [{ id: 'policy_reconciliation_finding_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_compliant_block', severity: 'low', label: 'Compliant block', detail: 'Observed wallet respected the block decision.', expected: 'Wallet should not spend after a block decision.', observed: 'Wallet stayed blocked as required.' }],
      feedback: {
        status: 'preview',
        notes: ['policy_decision=block', 'outcome_state=blocked_as_required', 'spend_happened=false', 'Preview only. No persistence was performed.'],
        next_policy_action: 'none'
      },
      impact: {
        target_type: 'provider',
        target_id: 'provider_pay_sh_lattice',
        direction: 'watch',
        magnitude: 0.6,
        summary: 'Observed outcome keeps provider:provider_pay_sh_lattice on watch while policy safety remains under review.',
        reputation_notes: ['policy_decision=block', 'required_action=do_not_spend', 'compliance_state=compliant', 'outcome_state=blocked_as_required', 'spend_happened=false', 'pre_spend_confidence=0.46', 'finding_count=1']
      },
      summary: 'Policy block reconciled with wallet outcome blocked_as_required: compliant. Next action=none.',
      generated_at: '2026-07-03T00:00:00.000Z'
    }, 'hermes_spend_policy_check_not_found')
  });
  add('post', '/v1/hermes/spend-policy/check/{check_id}/outcome', {
    tags: ['Hermes'],
    summary: 'Reconcile Hermes policy outcome',
    description: 'Compares a policy decision receipt against an observed wallet outcome and returns a deterministic reconciliation result that proves whether the wallet obeyed the safety gate. The endpoint is stateless, mock-safe, deploy-safe, and does not mutate receipts, claims, reputation, decisions, outcomes, policies, policy checks, or policy receipts persistently.',
    parameters: [pathParam('check_id', 'Hermes spend policy check identifier.')],
    requestBody: jsonRequest(objectSchema({
      outcome_state: { $ref: '#/components/schemas/HermesPolicyOutcomeState' },
      outcome_summary: stringSchema(),
      spend_happened: booleanSchema(),
      amount_usd: { type: 'number', minimum: 0 },
      chain: stringSchema(),
      payment_rail: stringSchema(),
      provider_id: stringSchema(),
      route_id: stringSchema(),
      service_id: stringSchema(),
      observed_latency_ms: integerSchema(),
      error_code: stringSchema(),
      evidence_artifacts: arrayOf(objectSchema({
        id: stringSchema(),
        label: stringSchema(),
        kind: enumSchema(['url', 'api_response', 'log', 'screenshot', 'note', 'receipt']),
        uri: stringSchema(),
        summary: stringSchema()
      }))
    }), {
      outcome_state: 'test_spend_completed',
      outcome_summary: 'Wallet completed the required test spend and provider returned expected result.',
      spend_happened: true,
      amount_usd: 25,
      observed_latency_ms: 1800,
      evidence_artifacts: []
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesPolicyReconciliationResult' }, {
      check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      policy_receipt_id: 'receipt_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      outcome: {
        id: 'policy_outcome_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_policy_receipt_id: 'receipt_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        outcome_state: 'spent_despite_block',
        outcome_summary: 'Wallet spent even though the policy gate required a block.',
        spend_happened: true,
        amount_usd: 25,
        chain: 'base',
        payment_rail: 'x402',
        provider_id: 'provider_pay_sh_lattice',
        route_id: 'route_pay_sh_market_research_01',
        service_id: 'service_market_research',
        observed_latency_ms: 1800,
        evidence_artifacts: [{ id: 'artifact_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_policy_reconciliation_note', label: 'Mock reconciliation note', kind: 'note', uri: '/v1/hermes/spend-policy/check/hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective/outcome', summary: 'Deterministic mock outcome artifact generated because no external wallet evidence artifact was supplied.' }],
        created_at: '2026-07-03T00:00:00.000Z'
      },
      compliance_state: 'non_compliant',
      findings: [{ id: 'policy_reconciliation_finding_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_spent_despite_block', severity: 'critical', label: 'Spent despite block', detail: 'Observed wallet execution violated a block decision.', expected: 'Wallet must not spend when policy decision is block.', observed: 'Wallet spent with outcome_state=spent_despite_block.' }],
      feedback: {
        status: 'recorded',
        notes: ['policy_decision=block', 'outcome_state=spent_despite_block', 'spend_happened=true', 'Stateless reconciliation generated. No persistence was performed.'],
        next_policy_action: 'block_provider'
      },
      impact: {
        target_type: 'provider',
        target_id: 'provider_pay_sh_lattice',
        direction: 'negative',
        magnitude: 0.8,
        summary: 'Observed outcome should reduce trust in provider:provider_pay_sh_lattice and tighten future wallet gating.',
        reputation_notes: ['policy_decision=block', 'required_action=do_not_spend', 'compliance_state=non_compliant', 'outcome_state=spent_despite_block', 'spend_happened=true', 'pre_spend_confidence=0.46', 'finding_count=1']
      },
      summary: 'Policy block reconciled with wallet outcome spent_despite_block: non_compliant. Next action=block_provider.',
      generated_at: '2026-07-03T00:00:00.000Z'
    }, 'hermes_spend_policy_check_not_found')
  });
  add('get', '/v1/hermes/memory-loop', {
    tags: ['Hermes'],
    summary: 'Get Hermes Agent Memory Loop',
    description: 'Returns one deterministic, stateless Agent Memory Loop stitched from seeded Hermes run evidence, receipt conversion, claim review, reputation ledger, pre-spend decision, decision receipt, outcome, and feedback. This endpoint does not require a live Hermes sidecar and does not mutate persistent memory.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesMemoryLoopSummary' }, {
      generated_at: '2026-07-03T00:00:00.000Z',
      loop_count: 1,
      loops: [{
        id: 'hermes_memory_loop_hermes_pay_sh_route_pre_spend_check',
        title: 'Agent Memory Loop',
        source_run_id: 'hermes_pay_sh_route_pre_spend_check',
        stages: [{ id: 'memory_stage_run', label: 'Run', primitive: 'hermes_run', state: 'watch' }],
        summary: { stage_count: 8, current_decision: 'do_not_spend', current_required_action: 'do_not_use_provider' }
      }]
    })
  });
  add('get', '/v1/hermes/memory-loop/{loop_id}', {
    tags: ['Hermes'],
    summary: 'Get Hermes Agent Memory Loop by id',
    description: 'Returns the deterministic Agent Memory Loop by id. Unknown loop ids return hermes_memory_loop_not_found.',
    parameters: [pathParam('loop_id', 'Hermes memory loop identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesMemoryLoop' }, {
      id: 'hermes_memory_loop_hermes_pay_sh_route_pre_spend_check',
      title: 'Agent Memory Loop',
      source_run_id: 'hermes_pay_sh_route_pre_spend_check',
      stages: [{ id: 'memory_stage_run', label: 'Run', primitive: 'hermes_run', state: 'watch' }],
      summary: { stage_count: 8, current_decision: 'do_not_spend', current_required_action: 'do_not_use_provider' }
    }, 'hermes_memory_loop_not_found')
  });
  add('get', '/v1/hermes/wallet-audit-trail', {
    tags: ['Hermes'],
    summary: 'Get Autonomous Wallet Audit Trail',
    description: 'Returns a deterministic, stateless wallet audit summary that stitches spend intent, pre-spend decision, receipts, policy check, wallet outcome, reconciliation, and feedback into one timeline. No live Hermes sidecar or persistence is required.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesWalletAuditSummary' }, {
      generated_at: '2026-07-03T00:00:00.000Z',
      trail_count: 1,
      trails: [{
        id: 'hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        title: 'Autonomous Wallet Audit Trail',
        generated_at: '2026-07-03T00:00:00.000Z',
        thesis: 'Autonomous wallets need more than logs. They need audit trails with judgment.',
        source_check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_decision_id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        events: [{
          id: 'hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_event_1_spend_intent',
          at: '2026-07-03T00:00:00.000Z',
          kind: 'spend_intent',
          state: 'recorded',
          title: 'Spend Intent',
          summary: 'Wallet requested $25.00 for route_pay_sh_market_research_01 on base via x402.',
          actor: 'agent',
          source_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
          amount_usd: 25,
          chain: 'base',
          payment_rail: 'x402',
          provider_id: 'provider_pay_sh_lattice',
          route_id: 'route_pay_sh_market_research_01',
          service_id: 'service_market_research',
          references: [{ kind: 'reputation', id: 'provider:provider_pay_sh_lattice', summary: 'Lattice Research Relay is degraded with trust score 13.' }]
        }],
        signals: [{ id: 'policy_decision', label: 'Policy decision', value: 'block', summary: 'Wallet gate result produced by the spend policy layer.' }],
        risk_posture: {
          level: 'medium',
          summary: 'Medium wallet safety posture: behavior is compliant but still worth watching.',
          reasons: ['Watch-state feedback, warnings, or test-spend requirements keep the trail under active inspection.']
        },
        summary: {
          event_count: 8,
          recorded_count: 3,
          allowed_count: 0,
          blocked_count: 1,
          compliant_count: 2,
          non_compliant_count: 0,
          needs_review_count: 1,
          final_compliance_state: 'compliant',
          final_feedback_direction: 'watch',
          next_policy_action: 'none'
        }
      }]
    })
  });
  add('get', '/v1/hermes/wallet-audit-trail/{trail_id}', {
    tags: ['Hermes'],
    summary: 'Get Autonomous Wallet Audit Trail by id',
    description: 'Returns the deterministic wallet audit trail by id. Unknown trail ids return hermes_wallet_audit_trail_not_found.',
    parameters: [pathParam('trail_id', 'Hermes wallet audit trail identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesWalletAuditTrail' }, {
      id: 'hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      title: 'Autonomous Wallet Audit Trail',
      generated_at: '2026-07-03T00:00:00.000Z',
      thesis: 'Autonomous wallets need more than logs. They need audit trails with judgment.',
      source_check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      source_decision_id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      events: [{ id: 'wallet_audit_event_1', at: '2026-07-03T00:00:00.000Z', kind: 'spend_intent', state: 'recorded', title: 'Spend Intent', summary: 'Wallet requested $25.00 for route_pay_sh_market_research_01 on base via x402.', actor: 'agent', references: [{ kind: 'reputation', id: 'provider:provider_pay_sh_lattice', summary: 'Lattice Research Relay is degraded with trust score 13.' }] }],
      signals: [{ id: 'risk_posture', label: 'Risk posture', value: 'medium', summary: 'Medium wallet safety posture: behavior is compliant but still worth watching.' }],
      risk_posture: { level: 'medium', summary: 'Medium wallet safety posture: behavior is compliant but still worth watching.', reasons: ['Watch-state feedback, warnings, or test-spend requirements keep the trail under active inspection.'] },
      summary: { event_count: 8, recorded_count: 3, allowed_count: 0, blocked_count: 1, compliant_count: 2, non_compliant_count: 0, needs_review_count: 1, final_compliance_state: 'compliant', final_feedback_direction: 'watch', next_policy_action: 'none' }
    }, 'hermes_wallet_audit_trail_not_found')
  });
  add('get', '/v1/hermes/wallet-risk-score', {
    tags: ['Hermes'],
    summary: 'Get Wallet Risk Score',
    description: 'Returns a deterministic, stateless wallet risk score summary derived from the Autonomous Wallet Audit Trail. No live Hermes sidecar or persistence is required.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesWalletRiskScoreSummary' }, {
      generated_at: '2026-07-03T00:00:00.000Z',
      score_count: 1,
      scores: [{
        id: 'hermes_wallet_risk_score_hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_trail_id: 'hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        generated_at: '2026-07-03T00:00:00.000Z',
        risk_score: 75,
        safety_rating: 'watch',
        required_next_action: 'run_test_spend',
        summary: 'Wallet safety rating is watch at 75/100. Top risk: Policy blocked the spend. Next action: run_test_spend.',
        top_risks: [{ id: 'wallet_risk_policy_block', severity: 'high', label: 'Policy blocked the spend', detail: 'The wallet safety gate returned a block decision for the canonical spend intent.', source: 'policy' }],
        positive_controls: [{ id: 'wallet_control_complete_audit_trail', label: 'Complete audit trail', detail: 'All eight deterministic wallet safety events were present in order.', source: 'audit_trail' }],
        score_breakdown: {
          base_score: 50,
          audit_posture_adjustment: 5,
          compliance_adjustment: 20,
          policy_adjustment: -25,
          outcome_adjustment: 15,
          feedback_adjustment: 5,
          evidence_adjustment: 5,
          final_score: 75
        },
        inputs: {
          trail_id: 'hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
          event_count: 8,
          risk_posture_level: 'medium',
          policy_decision: 'block',
          compliance_state: 'compliant',
          next_policy_action: 'none',
          feedback_direction: 'watch'
        }
      }]
    })
  });
  add('get', '/v1/hermes/wallet-risk-score/{score_id}', {
    tags: ['Hermes'],
    summary: 'Get Wallet Risk Score by id',
    description: 'Returns the deterministic wallet risk score by id. Unknown score ids return hermes_wallet_risk_score_not_found.',
    parameters: [pathParam('score_id', 'Hermes wallet risk score identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesWalletRiskScore' }, {
      id: 'hermes_wallet_risk_score_hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      source_trail_id: 'hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      generated_at: '2026-07-03T00:00:00.000Z',
      risk_score: 75,
      safety_rating: 'watch',
      required_next_action: 'run_test_spend',
      summary: 'Wallet safety rating is watch at 75/100. Top risk: Policy blocked the spend. Next action: run_test_spend.',
      top_risks: [{ id: 'wallet_risk_policy_block', severity: 'high', label: 'Policy blocked the spend', detail: 'The wallet safety gate returned a block decision for the canonical spend intent.', source: 'policy' }],
      positive_controls: [{ id: 'wallet_control_complete_audit_trail', label: 'Complete audit trail', detail: 'All eight deterministic wallet safety events were present in order.', source: 'audit_trail' }],
      score_breakdown: {
        base_score: 50,
        audit_posture_adjustment: 5,
        compliance_adjustment: 20,
        policy_adjustment: -25,
        outcome_adjustment: 15,
        feedback_adjustment: 5,
        evidence_adjustment: 5,
        final_score: 75
      },
      inputs: {
        trail_id: 'hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        event_count: 8,
        risk_posture_level: 'medium',
        policy_decision: 'block',
        compliance_state: 'compliant',
        next_policy_action: 'none',
        feedback_direction: 'watch'
      }
    }, 'hermes_wallet_risk_score_not_found')
  });
  add('post', '/v1/hermes/wallet-safety/check', {
    tags: ['Hermes'],
    summary: 'Create Wallet Safety API Bundle',
    description: 'Returns one deterministic, stateless wallet safety bundle for a spend intent: pre-spend decision, policy check, policy receipt, reconciliation preview, audit trail, risk score, and final recommendation. Agents should not stitch safety together. They should ask once before spend.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/HermesWalletSafetyCheckInput' }, {
      route_id: 'route_pay_sh_market_research_01',
      provider_id: 'provider_pay_sh_lattice',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'x402',
      chain: 'base'
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesWalletSafetyCheckResult' }, {
      id: 'hermes_wallet_safety_check_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_default_policy',
      generated_at: '2026-07-03T00:00:00.000Z',
      input: { route_id: 'route_pay_sh_market_research_01', provider_id: 'provider_pay_sh_lattice', service_id: 'service_market_research', amount_usd: 25, payment_rail: 'x402', chain: 'base' },
      pre_spend_decision: { id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective', decision: 'do_not_spend' },
      spend_policy_check: { id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective', decision: 'block', allowed: false },
      policy_receipt: { receipt: { id: 'receipt_hermes_policy_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective' } },
      reconciliation_preview: { check_id: 'hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective', compliance_state: 'compliant' },
      wallet_audit_trail: { id: 'hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective', summary: { event_count: 8 } },
      wallet_risk_score: { id: 'hermes_wallet_risk_score_hermes_wallet_audit_trail_hermes_spend_policy_check_policy_infopunks_default_agent_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective', risk_score: 75, safety_rating: 'watch' },
      final_recommendation: {
        decision: 'block_spend',
        allowed: false,
        confidence: 0.49,
        reason: 'Pre-spend and policy checks require the spend to stay blocked.',
        required_action: 'block_spend',
        safety_rating: 'watch',
        risk_score: 75,
        top_risks: [{ id: 'wallet_risk_policy_block' }],
        positive_controls: [{ id: 'wallet_control_complete_audit_trail' }],
        references: [{ kind: 'pre_spend_decision', id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective', summary: 'Pre-spend decision reference.' }]
      },
      summary: {
        decision: 'block_spend',
        allowed: false,
        required_action: 'block_spend',
        safety_rating: 'watch',
        risk_score: 75,
        policy_decision: 'block',
        compliance_state: 'compliant',
        audit_event_count: 8,
        top_risk_count: 1,
        positive_control_count: 1
      }
    })
  });
  add('get', '/v1/hermes/wallet-safety/example', {
    tags: ['Hermes'],
    summary: 'Get Wallet Safety API Bundle example',
    description: 'Returns the deterministic example Wallet Safety API Bundle for the seeded spend intent. No live Hermes sidecar, persistence, or wallet mutation is required.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesWalletSafetyCheckResult' }, {
      id: 'hermes_wallet_safety_check_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_default_policy',
      final_recommendation: {
        decision: 'block_spend',
        allowed: false,
        required_action: 'block_spend',
        safety_rating: 'watch',
        risk_score: 75
      }
    })
  });
  add('get', '/v1/hermes/wallet-safety/integrations', {
    tags: ['Hermes'],
    summary: 'List Wallet Safety integration registry entries',
    description: 'Returns the deterministic, seeded Wallet Safety Integration Registry. This surface is stateless, read-only, mock-safe, and does not require live Hermes.',
    responses: envelopedResponses({ $ref: '#/components/schemas/WalletSafetyIntegrationRegistrySummary' }, {
      generated_at: '2026-07-03T00:00:00.000Z',
      integration_count: 4,
      ready_count: 2,
      testing_count: 0,
      needs_receipts_count: 1,
      watch_count: 1,
      not_ready_count: 0,
      integrations: [{ integration_id: 'agent_wallet_demo', readiness_state: 'ready', writes_integration_receipts: true }]
    })
  });
  add('get', '/v1/hermes/wallet-safety/integrations/{integration_id}/readiness', {
    tags: ['Hermes'],
    summary: 'Get Wallet Safety integration readiness report',
    description: 'Returns the deterministic readiness report for one seeded Wallet Safety integration. This surface is stateless, read-only, mock-safe, and does not require live Hermes.',
    parameters: [pathParam('integration_id', 'Wallet Safety integration identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/WalletSafetyIntegrationReadinessReport' }, {
      integration_id: 'agent_wallet_demo',
      generated_at: '2026-07-03T00:00:00.000Z',
      readiness_state: 'ready',
      readiness_score: 100,
      requirements: [{ id: 'wallet_safety_api_usage', label: 'Wallet Safety API usage', status: 'passed' }],
      proof_items: [{ id: 'wallet_safety_check_usage', label: 'Wallet Safety check usage', source: 'profile' }],
      missing_items: [],
      next_steps: ['This integration meets the seeded readiness requirements.']
    }, 'wallet_safety_integration_not_found')
  });
  add('get', '/v1/hermes/wallet-safety/integrations/{integration_id}', {
    tags: ['Hermes'],
    summary: 'Get Wallet Safety integration registry entry',
    description: 'Returns one deterministic Wallet Safety integration registry profile by integration_id. No persistence or live Hermes is required.',
    parameters: [pathParam('integration_id', 'Wallet Safety integration identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/WalletSafetyIntegrationProfile' }, {
      integration_id: 'agent_wallet_demo',
      name: 'Agent Wallet Demo',
      readiness_state: 'ready',
      supported_chains: ['base', 'solana']
    }, 'wallet_safety_integration_not_found')
  });
  add('get', '/v1/hermes/skill-pack/skills', {
    tags: ['Hermes'],
    summary: 'List Hermes Skill Pack skills',
    description: 'Returns every seeded skill from the Infopunks Hermes Skill Pack manifest.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      module: stringSchema(),
      count: integerSchema(),
      skills: arrayOf({ $ref: '#/components/schemas/HermesSkill' })
    }), { module: 'hermes-skill-pack', count: 6, skills: [{ id: 'pre-spend-route-check', title: 'Pre-Spend Route Check' }] })
  });
  add('get', '/v1/hermes/skill-pack/skills/{skill_id}', {
    tags: ['Hermes'],
    summary: 'Get Hermes Skill Pack skill',
    description: 'Returns one seeded Hermes skill by id.',
    parameters: [pathParam('skill_id', 'Hermes skill identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesSkill' }, {
      id: 'receipt-validator',
      title: 'Receipt Validator',
      linked_infopunks_primitives: ['receipts', 'proof checks', 'claims']
    }, 'hermes_skill_not_found')
  });
  add('get', '/v1/hermes/reputation-ledger', {
    tags: ['Hermes'],
    summary: 'Get Hermes Reputation Ledger',
    description: 'Aggregates deterministic promoted Hermes claim reputation impacts into provider, route, service, and unknown target reputation entries. This endpoint is stateless and does not require a live Hermes sidecar.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesReputationLedgerSummary' }, {
      generated_at: '2026-07-03T00:00:00.000Z',
      entry_count: 3,
      provider_count: 1,
      route_count: 1,
      service_count: 1,
      entries: [{ target_type: 'provider', target_id: 'provider_pay_sh_lattice', current_state: 'degraded', trust_score: 13 }]
    })
  });
  add('get', '/v1/hermes/reputation-ledger/providers', {
    tags: ['Hermes'],
    summary: 'List Hermes provider reputation entries',
    description: 'Returns Reputation Ledger entries where target_type is provider.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      count: integerSchema(),
      entries: arrayOf({ $ref: '#/components/schemas/HermesReputationLedgerEntry' })
    }), { count: 1, entries: [{ target_type: 'provider', target_id: 'provider_pay_sh_lattice', current_state: 'degraded' }] })
  });
  add('get', '/v1/hermes/reputation-ledger/routes', {
    tags: ['Hermes'],
    summary: 'List Hermes route reputation entries',
    description: 'Returns Reputation Ledger entries where target_type is route.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      count: integerSchema(),
      entries: arrayOf({ $ref: '#/components/schemas/HermesReputationLedgerEntry' })
    }), { count: 1, entries: [{ target_type: 'route', target_id: 'route_pay_sh_market_research_01', current_state: 'watchlist' }] })
  });
  add('post', '/v1/hermes/pre-spend-decision', {
    tags: ['Hermes'],
    summary: 'Create Hermes pre-spend decision',
    description: 'Returns a stateless, deterministic spend recommendation backed by matching provider, route, and service reputation ledger entries. This route never requires a live Hermes sidecar and does not mutate receipts, claims, routes, providers, or services.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/HermesPreSpendDecisionInput' }, {
      route_id: 'route_pay_sh_market_research_01',
      provider_id: 'provider_pay_sh_lattice',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'x402',
      chain: 'base'
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesPreSpendDecision' }, {
      id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      input: {
        route_id: 'route_pay_sh_market_research_01',
        provider_id: 'provider_pay_sh_lattice',
        service_id: 'service_market_research',
        amount_usd: 25,
        payment_rail: 'x402',
        chain: 'base'
      },
      decision: 'do_not_spend',
      confidence: 0.46,
      reason: 'Provider reputation is degraded in the ledger.',
      required_action: 'do_not_use_provider',
      risk_factors: [{ id: 'provider_degraded', severity: 'high', label: 'provider degraded', detail: 'Lattice Research Relay is degraded with trust score 13.', source: 'provider_reputation' }],
      reputation_inputs: [{ kind: 'reputation_entry', id: 'provider:provider_pay_sh_lattice', target_type: 'provider', target_id: 'provider_pay_sh_lattice', summary: 'Lattice Research Relay is degraded with trust score 13.' }],
      receipt_inputs: [{ kind: 'receipt', id: 'receipt_hermes_hermes_agentic_market_provider_risk_review', target_type: 'provider', target_id: 'provider_pay_sh_lattice', summary: 'Receipt receipt_hermes_hermes_agentic_market_provider_risk_review contributes evidence for provider:provider_pay_sh_lattice.' }],
      claim_inputs: [{ kind: 'claim', id: 'claim_hermes_promoted_hermes_agentic_market_provider_risk_review', target_type: 'provider', target_id: 'provider_pay_sh_lattice', summary: 'Reviewed claim claim_hermes_promoted_hermes_agentic_market_provider_risk_review contributes reputation judgment for provider:provider_pay_sh_lattice.' }],
      run_inputs: [{ kind: 'run', id: 'hermes_agentic_market_provider_risk_review', target_type: 'provider', target_id: 'provider_pay_sh_lattice', summary: 'Hermes run hermes_agentic_market_provider_risk_review contributed source evidence for provider:provider_pay_sh_lattice.' }],
      ledger_state: { provider_state: 'degraded', route_state: 'watchlist', service_state: 'watchlist', provider_score: 13, route_score: 38, service_score: 41 },
      generated_at: '2026-07-03T00:00:00.000Z'
    })
  });
  add('get', '/v1/hermes/pre-spend-decision/example', {
    tags: ['Hermes'],
    summary: 'Get Hermes pre-spend decision example',
    description: 'Returns one deterministic example pre-spend decision using seeded Hermes route, provider, and service identifiers.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesPreSpendDecision' }, {
      id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      decision: 'do_not_spend',
      confidence: 0.46,
      reason: 'Provider reputation is degraded in the ledger.',
      required_action: 'do_not_use_provider'
    })
  });
  add('post', '/v1/hermes/pre-spend-decision/{decision_id}/receipt', {
    tags: ['Hermes'],
    summary: 'Convert pre-spend decision to receipt',
    description: 'Converts a deterministic Hermes pre-spend decision into a receipt-shaped object. This route is stateless, deterministic, and does not persist receipts or mutate market memory.',
    parameters: [pathParam('decision_id', 'Hermes pre-spend decision identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesDecisionReceiptConversion' }, {
      decision_id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      receipt: {
        id: 'receipt_hermes_decision_hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source: 'pre_spend_decision',
        source_decision_id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        title: 'Pre-Spend Decision Receipt: do_not_spend',
        summary: 'Provider reputation is degraded in the ledger. Required action: do_not_use_provider.',
        decision: 'do_not_spend',
        required_action: 'do_not_use_provider',
        confidence: 0.46,
        receipt_kind: 'pre_spend_decision_receipt',
        created_at: '2026-07-03T00:00:00.000Z'
      },
      conversion: { status: 'converted', notes: ['Decision receipt conversion is deterministic and stateless.'] }
    }, 'hermes_pre_spend_decision_not_found')
  });
  add('post', '/v1/hermes/pre-spend-decision/{decision_id}/outcome', {
    tags: ['Hermes'],
    summary: 'Record pre-spend decision outcome',
    description: 'Creates a deterministic decision outcome and reputation feedback object for a known Hermes pre-spend decision. This route is stateless, deterministic, and does not mutate receipts, claims, or reputation ledger entries persistently.',
    parameters: [pathParam('decision_id', 'Hermes pre-spend decision identifier.')],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: objectSchema({
            outcome_state: { $ref: '#/components/schemas/HermesDecisionOutcomeState' },
            outcome_summary: stringSchema(),
            spend_happened: booleanSchema(),
            amount_usd: { type: 'number', minimum: 0 },
            observed_latency_ms: integerSchema(),
            error_code: stringSchema(),
            evidence_artifacts: arrayOf(objectSchema({
              id: stringSchema(),
              label: stringSchema(),
              kind: enumSchema(['url', 'api_response', 'log', 'screenshot', 'note', 'receipt']),
              uri: stringSchema(),
              summary: stringSchema()
            }))
          }),
          examples: {
            request: {
              value: {
                outcome_state: 'successful',
                outcome_summary: 'Provider completed the service within expected bounds.',
                spend_happened: true,
                amount_usd: 25,
                observed_latency_ms: 1800,
                evidence_artifacts: []
              }
            }
          }
        }
      }
    },
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesDecisionFeedbackResult' }, {
      decision_id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
      receipt: {
        id: 'receipt_hermes_decision_hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source: 'pre_spend_decision',
        decision: 'do_not_spend',
        required_action: 'do_not_use_provider',
        confidence: 0.46,
        receipt_kind: 'pre_spend_decision_receipt',
        created_at: '2026-07-03T00:00:00.000Z'
      },
      outcome: {
        id: 'outcome_hermes_decision_hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_blocked',
        source_decision_id: 'hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        source_decision_receipt_id: 'receipt_hermes_decision_hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective',
        outcome_state: 'blocked',
        outcome_summary: 'Spend stayed blocked after the do_not_spend recommendation, preserving caution instead of forcing execution.',
        spend_happened: false,
        amount_usd: 25,
        impact: {
          target_type: 'provider',
          target_id: 'provider_pay_sh_lattice',
          direction: 'positive',
          magnitude: 0.26,
          summary: 'The decision prevented risk for provider:provider_pay_sh_lattice and should reinforce future caution.',
          reputation_notes: ['decision_state=do_not_spend']
        },
        evidence_artifacts: [{ id: 'artifact_hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective_note', label: 'Mock outcome note', kind: 'note', uri: '/v1/hermes/pre-spend-decision/hermes_pre_spend_decision_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research_25_00_x402_base_no_agent_no_objective/outcome', summary: 'Deterministic mock outcome artifact generated because no external evidence artifact was supplied.' }],
        created_at: '2026-07-03T00:00:00.000Z'
      },
      feedback: { status: 'recorded', notes: ['Decision feedback is deterministic and stateless.'] },
      reputation_feedback: {
        target_type: 'provider',
        target_id: 'provider_pay_sh_lattice',
        direction: 'positive',
        magnitude: 0.26,
        summary: 'The decision prevented risk for provider:provider_pay_sh_lattice and should reinforce future caution.',
        reputation_notes: ['decision_state=do_not_spend']
      }
    }, 'hermes_pre_spend_decision_not_found')
  });
  add('get', '/v1/hermes/reputation-ledger/{target_type}/{target_id}', {
    tags: ['Hermes'],
    summary: 'Get Hermes reputation entry',
    description: 'Returns one Reputation Ledger entry by target type and target id. target_type accepts provider/providers, route/routes, service/services, and unknown.',
    parameters: [
      pathParam('target_type', 'Hermes reputation target type.'),
      pathParam('target_id', 'Hermes reputation target identifier.')
    ],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesReputationLedgerEntry' }, {
      target_type: 'provider',
      target_id: 'provider_pay_sh_lattice',
      label: 'Lattice Research Relay',
      current_state: 'degraded',
      trust_score: 13
    }, 'hermes_reputation_entry_not_found')
  });
  add('get', '/v1/hermes/runs', {
    tags: ['Hermes'],
    summary: 'List Hermes runs',
    description: 'Returns Hermes Agent investigations as Radar run memory with linked receipts, claims, loops, artifacts, decisions, and risk factors.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      module: stringSchema(),
      count: integerSchema(),
      runs: arrayOf({ $ref: '#/components/schemas/HermesRun' })
    }), { module: 'hermes-desk', count: 3, runs: [{ id: 'hermes_pay_sh_route_pre_spend_check', decision: 'caution' }] })
  });
  add('get', '/v1/hermes/runs/{run_id}', {
    tags: ['Hermes'],
    summary: 'Get Hermes run',
    description: 'Returns one Hermes investigation run by id.',
    parameters: [pathParam('run_id', 'Hermes run identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesRun' }, {
      id: 'hermes_pay_sh_route_pre_spend_check',
      title: 'Pay.sh Route Pre-Spend Check',
      decision: 'caution',
      linked_receipt_id: 'receipt_001',
      linked_claim_id: 'claim_001',
      linked_loop_id: 'loop_pre_spend_route'
    }, 'hermes_run_not_found')
  });
  add('post', '/v1/hermes/runs/{run_id}/receipt', {
    tags: ['Hermes'],
    summary: 'Convert Hermes run to receipt',
    description: 'Converts a seeded HermesRun into a ProofReceipt-compatible agent run receipt plus a claim candidate. This route is stateless and does not mutate existing receipts or claims.',
    parameters: [pathParam('run_id', 'Hermes run identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesRunReceiptConversion' }, {
      run_id: 'hermes_pay_sh_route_pre_spend_check',
      receipt: {
        id: 'receipt_hermes_hermes_pay_sh_route_pre_spend_check',
        decision: 'caution',
        evidence_count: 2,
        receipt_kind: 'agent_run_receipt',
        source: 'hermes'
      },
      claim_candidate: {
        id: 'claim_candidate_hermes_hermes_pay_sh_route_pre_spend_check',
        status: 'candidate',
        confidence: 82
      },
      conversion: { status: 'converted', notes: ['Generated claim candidate is not persisted and does not update market memory yet.'] }
    }, 'hermes_run_not_found')
  });
  add('get', '/v1/hermes/runs/{run_id}/receipt-preview', {
    tags: ['Hermes'],
    summary: 'Preview Hermes run receipt conversion',
    description: 'Returns the same stateless conversion as the POST route without implying creation.',
    parameters: [pathParam('run_id', 'Hermes run identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesRunReceiptConversion' }, {
      run_id: 'hermes_pay_sh_route_pre_spend_check',
      receipt: { id: 'receipt_hermes_hermes_pay_sh_route_pre_spend_check', decision: 'caution', evidence_count: 2 },
      claim_candidate: { id: 'claim_candidate_hermes_hermes_pay_sh_route_pre_spend_check', status: 'candidate' },
      conversion: { status: 'converted', notes: [] }
    }, 'hermes_run_not_found')
  });
  add('post', '/v1/hermes/runs/{run_id}/claim/promote', {
    tags: ['Hermes'],
    summary: 'Promote Hermes claim candidate',
    description: 'Promotes a Hermes-generated claim candidate into an Infopunks claim-shaped object with review state and reputation impact metadata. This route is deterministic, stateless, and does not mutate persistent claims or reputation records.',
    parameters: [pathParam('run_id', 'Hermes run identifier.')],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/HermesClaimPromotionRequest' },
          examples: { request: { value: { review_state: 'accepted' } } }
        }
      }
    },
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesClaimPromotionResult' }, {
      run_id: 'hermes_pay_sh_route_pre_spend_check',
      promoted_claim: {
        id: 'claim_hermes_promoted_hermes_pay_sh_route_pre_spend_check',
        review_state: 'needs_more_evidence',
        decision: 'caution',
        reputation_impact: { target_type: 'unknown', direction: 'watch', magnitude: 0.82 }
      },
      review: { state: 'needs_more_evidence', reviewer: 'infopunks_mock_reviewer' },
      conversion: { status: 'promoted', notes: ['Promotion is deterministic and stateless.'] }
    }, 'hermes_run_not_found')
  });
  add('get', '/v1/hermes/runs/{run_id}/claim/promotion-preview', {
    tags: ['Hermes'],
    summary: 'Preview Hermes claim promotion',
    description: 'Returns the same deterministic claim promotion result as the POST route without implying creation.',
    parameters: [pathParam('run_id', 'Hermes run identifier.')],
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesClaimPromotionResult' }, {
      run_id: 'hermes_pay_sh_route_pre_spend_check',
      promoted_claim: {
        id: 'claim_hermes_promoted_hermes_pay_sh_route_pre_spend_check',
        review_state: 'needs_more_evidence',
        decision: 'caution'
      },
      conversion: { status: 'promoted', notes: [] }
    }, 'hermes_run_not_found')
  });
  add('post', '/v1/hermes/pre-spend-run', {
    tags: ['Hermes'],
    summary: 'Create Hermes pre-spend run',
    description: 'Creates a HermesRun-shaped investigation for a route, provider, service, and spend context. The bridge attempts a live Hermes HTTP sidecar call only when HERMES_ENABLED=true and HERMES_MODE=http; otherwise or on failure it returns a mock-compatible fallback run.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/HermesPreSpendRunRequest' }, {
      route_id: 'route_pay_sh_market_research_01',
      provider_id: 'provider_pay_sh_lattice',
      service_id: 'service_market_research',
      spend_context: { budget_usd: 25, intent: 'buy_market_research' }
    }),
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesRun' }, {
      id: 'hermes_mock_pre_spend_route_pay_sh_market_research_01_provider_pay_sh_lattice_service_market_research',
      title: 'Mock Hermes Pre-Spend Run',
      decision: 'caution',
      state: 'completed',
      source: 'mock'
    })
  });
  add('get', '/v1/hermes/skills', {
    tags: ['Hermes'],
    summary: 'List Infopunks Hermes skill pack',
    description: 'Returns the Infopunks skill pack shape intended for Hermes Agent sidecar runs.',
    responses: envelopedResponses(objectSchema({
      generated_at: dateTimeSchema(),
      source: stringSchema(),
      module: stringSchema(),
      skills: arrayOf({ $ref: '#/components/schemas/HermesSkillSummary' })
    }), { module: 'hermes-desk', skills: [{ id: 'pre-spend-route-check', label: 'pre-spend route check' }] })
  });
  add('get', '/v1/hermes/health', {
    tags: ['Hermes'],
    summary: 'Get Hermes bridge health',
    description: 'Returns Hermes bridge configuration status and, when enabled, a non-fatal Hermes sidecar health check. The sidecar is optional and is not required for deploy, build, tests, or smoke checks.',
    responses: envelopedResponses({ $ref: '#/components/schemas/HermesHealth' }, {
      enabled: false,
      mode: 'mock',
      status: 'mock'
    })
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
    description: 'Returns seeded Narrative Asset Intelligence records for attention markets and narrative assets.',
    responses: envelopedResponses('NarrativeAssetListResponse', [{ slug: 'black-bull', ticker: 'ANSEM', signal_source: 'Ansem' }])
  });
  add('get', '/v1/attention-market-watch', {
    tags: ['Intelligence'],
    summary: 'List Attention Market Watch signals',
    description: 'Returns the public Attention Market Watch index for persona-backed markets, classifying attention source, control risk, coherence, receipts, fragmentation, and verdict.',
    responses: envelopedResponses('AttentionMarketWatchListResponse', {
      generated_at: '2026-07-01T09:00:00.000Z',
      count: 4,
      verdict_counts: {
        supportive_watch: 1,
        attention_arbitrage: 2,
        re_index_watch: 1
      },
      evolution_stages: [
        {
          id: 'persona_coin',
          label: 'Persona Coin',
          description: 'Ticker wrapped around a person, face, handle, or reputation engine.'
        },
        {
          id: 'attention_market',
          label: 'Attention Market',
          description: 'Attention becomes the asset being priced.'
        },
        {
          id: 'coordination_market_emerging',
          label: 'Coordination Market Emerging',
          description: 'Redistribution, holder growth, community media, and shared rituals begin carrying the signal.'
        }
      ],
      signals: [{
        slug: 'ansem',
        ticker: 'ANSEM',
        name: 'The Black Bull',
        category: 'persona_coin',
        evolution_verdict: 'supportive_watch',
        verdict_label: 'Supportive Watch',
        current_evolution_stage: 'coordination_market_emerging',
        current_evolution_label: 'Coordination Market Emerging',
        href: '/signals/black-bull'
      }]
    })
  });
  add('get', '/v1/attention-market-watch/intake/requirements', {
    tags: ['Intelligence'],
    summary: 'Get Attention Market Intake requirements',
    description: 'Returns the default evidence requirements, default risk facets, and public disclaimer for staged attention-market intake. Submission does not equal endorsement.',
    responses: envelopedResponses('AttentionMarketIntakeRequirementsResponse', {
      requirements: [
        'Identify attention source',
        'Identify token contract or market page',
        'Identify control points: supply, fees, liquidity, authority, social legitimacy',
        'Provide receipt links: on-chain actions, public commitments, wallet flows, product links, or community coordination',
        'Explain whether the asset unites attention or fragments it',
        'Explain why this is more than a ticker wrapped around a face'
      ],
      default_risk_facets: ['thin_evidence', 'high_reflexivity', 'power_concentration'],
      disclaimer: 'Submission staged for review. This is not an endorsement and is not yet persisted.'
    })
  });
  add('post', '/v1/attention-market-watch/intake', {
    tags: ['Intelligence'],
    summary: 'Stage an Attention Market intake submission',
    description: 'Stages a non-persistent attention-market submission for evidence review. Submission does not create a report, does not persist data, and is not an endorsement.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/AttentionMarketIntakeRequest' }, {
      ticker: 'SAFE',
      name: 'Safe Persona Object',
      chain: 'Solana',
      attention_source_type: 'influencer',
      attention_source_label: 'Example influencer cluster',
      submitter_handle: '@observer',
      why_it_matters: 'This attention-market object is entering the trenches and needs evidence review before classification.',
      evidence_links: ['/narratives/attention-market-watch']
    }),
    responses: envelopedResponses('AttentionMarketIntakeSubmissionResponse', {
      submission: {
        intake_id: 'am_intake_safe-safe-persona-object_1',
        submitted_at: '2026-06-30T18:00:00.000Z',
        status: 'staged',
        ticker: 'SAFE',
        name: 'Safe Persona Object',
        chain: 'Solana',
        attention_source_type: 'influencer',
        attention_source_label: 'Example influencer cluster',
        submitter_handle: '@observer',
        why_it_matters: 'This attention-market object is entering the trenches and needs evidence review before classification.',
        evidence_links: ['/narratives/attention-market-watch'],
        default_evidence_requirements: [
          'Identify attention source',
          'Identify token contract or market page',
          'Identify control points: supply, fees, liquidity, authority, social legitimacy',
          'Provide receipt links: on-chain actions, public commitments, wallet flows, product links, or community coordination',
          'Explain whether the asset unites attention or fragments it',
          'Explain why this is more than a ticker wrapped around a face'
        ],
        default_risk_facets: ['thin_evidence', 'high_reflexivity', 'power_concentration'],
        intake_note: 'Submission staged for review. This is not an endorsement and is not yet persisted.'
      }
    })
  });
  add('get', '/v1/attention-market-watch/{slug}', {
    tags: ['Intelligence'],
    summary: 'Get Attention Market Watch profile',
    description: 'Returns one Attention Market Watch classification profile by slug. Unknown slugs return attention_market_signal_not_found.',
    parameters: [pathParam('slug', 'Attention Market Watch profile slug.')],
    responses: envelopedResponses('AttentionMarketWatchDetailResponse', {
      signal: {
        slug: 'ansem',
        ticker: 'ANSEM',
        name: 'The Black Bull',
        category: 'persona_coin',
        evolution_verdict: 'supportive_watch',
        verdict_label: 'Supportive Watch',
        current_evolution_stage: 'coordination_market_emerging',
        current_evolution_label: 'Coordination Market Emerging',
        href: '/signals/black-bull'
      }
    }, 'attention_market_signal_not_found')
  });
  add('get', '/v1/signal-desk', {
    tags: ['Intelligence'],
    summary: 'Get Signal Desk index',
    description: 'Returns the derived Signal Desk catalog with featured report, dispatches, risk shifts, report cards, compact desk activity, and candidate signals queued for evidence review or promotion into reports.',
    responses: envelopedResponses('SignalDeskIndex', {
      generated_at: '2026-07-01T09:00:00.000Z',
      desk_status: 'live_watch',
      counts: {
        reports: 2,
        dispatches: 9,
        risk_shifts: 7,
        watched_signals: 2
      },
      candidate_signals: [{
        candidate_id: 'candidate_sol_persona_attention',
        name: 'Next attention market around a major Solana persona',
        chain: 'Solana',
        category: 'attention_market',
        submitted_by: 'desk',
        status: 'watching',
        priority: 'high',
        risk_level: 'medium',
        risk_facets: ['high_reflexivity', 'power_concentration', 'kol_dependency', 'live_watch'],
        summary: 'The desk is tracking whether a familiar Solana persona is compressing social attention into a new market object.',
        why_it_matters: 'Persona-led coordination can mint a market before durable ownership or utility becomes legible.',
        evidence_links: ['/narratives/attention-markets'],
        created_at: '2026-06-24T09:00:00.000Z',
        updated_at: '2026-06-29T00:00:00.000Z'
      }],
      candidate_counts: {
        total: 6,
        queued: 1,
        watching: 1,
        needs_evidence: 2,
        under_review: 1,
        promoted_to_report: 1
      },
      featured_report: {
        slug: 'black-bull',
        ticker: 'ANSEM',
        name: 'The Black Bull',
        category: 'Attention Market / Narrative Asset',
        thesis: "The Black Bull is no longer only a persona-backed attention object. Reported creator-fee redistribution, tracker-visible holder growth, and community-led media suggest an emerging coordination market, while KOL dependency, power concentration, and reflexivity remain material.",
        href: '/signals/black-bull',
        signal_strength: 92,
        myth_coherence: 88,
        reflexivity_risk: 86,
        sovereignty_score: 45,
        risk_facets: ['high_reflexivity', 'kol_dependency', 'power_concentration', 'unproven_sovereignty', 'live_watch'],
        desk_status: 'live_watch',
        latest_update_type: 'verdict_change',
        latest_update_at: '2026-07-01T09:00:00.000Z',
        update_count: 7
      },
      reports: [{
        slug: 'troll',
        ticker: 'TROLL',
        name: 'The Re-Indexed Archetype',
        category: 'Meme Archetype / Community Takeover / Re-indexed Internet Lore',
        thesis: 'TROLL is not a fresh meme trying to become culture. It is old internet culture being reactivated by the trenches as a Solana-native community asset. Its strength comes from archetype survival, community takeover energy, and tracker-visible holder surface that has remained legible across multiple rotations.',
        href: '/signals/troll',
        verdict_label: 'DURABLE RE-INDEX',
        verdict_state: 'durable_re_index',
        signal_strength: 90,
        myth_coherence: 93,
        reflexivity_risk: 78,
        sovereignty_score: 63,
        risk_facets: ['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration'],
        desk_status: 'live_watch',
        latest_update_type: 'verdict_change',
        latest_update_at: '2026-06-30T13:30:00.000Z',
        update_count: 2
      }],
      latest_dispatches: [{
        update_id: 'seu_black_bull_007',
        signal_slug: 'black-bull',
        signal_name: 'The Black Bull',
        ticker: 'ANSEM',
        update_type: 'verdict_change',
        readable_update_type: 'Verdict Change',
        timestamp: '2026-07-01T09:00:00.000Z',
        summary: 'Infopunks updates Black Bull from a pure persona attention market into Coordination Market Emerging as redistribution, holder growth, and community-led media become central to the signal.',
        analyst_note: 'The latest signal shift is structural. Ansem\'s low-key activity, reported creator-fee redistribution, holder-growth narrative, and community media suggest Black Bull is moving from persona-led attention into community coordination. The desk keeps SUPPORTIVE WATCH active while monitoring whether the flywheel can persist beyond short-term incentives and concentrated attention.',
        href: '/signals/black-bull/updates/seu_black_bull_007',
        og_image: '/og/signals/black-bull/updates/seu_black_bull_007.png',
        risk_facets: ['high_reflexivity', 'kol_dependency', 'power_concentration', 'unproven_sovereignty', 'live_watch'],
        previous_score: 88,
        new_score: 91,
        signal_delta: 3
      }],
      risk_shifts: [],
      desk_activity: []
    })
  });
  add('get', '/v1/signal-desk/candidates', {
    tags: ['Intelligence'],
    summary: 'List candidate signals',
    description: 'Returns the seeded candidate queue for the desk. Candidate signals are pre-report items waiting for evidence, review, rejection, or promotion.',
    responses: envelopedResponses('CandidateSignalListResponse', {
      count: 6,
      candidates: [{
        candidate_id: 'candidate_sol_persona_attention',
        name: 'Next attention market around a major Solana persona',
        chain: 'Solana',
        category: 'attention_market',
        submitted_by: 'desk',
        status: 'watching',
        priority: 'high',
        risk_level: 'medium',
        risk_facets: ['high_reflexivity', 'power_concentration', 'kol_dependency', 'live_watch'],
        summary: 'The desk is tracking whether a familiar Solana persona is compressing social attention into a new market object.',
        why_it_matters: 'Persona-led coordination can mint a market before durable ownership or utility becomes legible.',
        evidence_links: ['/narratives/attention-markets'],
        created_at: '2026-06-24T09:00:00.000Z',
        updated_at: '2026-06-29T00:00:00.000Z'
      }]
    })
  });
  add('get', '/v1/signal-desk/candidates/{candidateId}', {
    tags: ['Intelligence'],
    summary: 'Get candidate signal',
    description: 'Returns one candidate signal record by id. Unknown candidate ids return candidate_signal_not_found.',
    parameters: [pathParam('candidateId', 'Candidate signal identifier.')],
    responses: envelopedResponses('CandidateSignalDetailResponse', {
      candidate: {
        candidate_id: 'candidate_sol_persona_attention',
        name: 'Next attention market around a major Solana persona',
        chain: 'Solana',
        category: 'attention_market',
        submitted_by: 'desk',
        status: 'watching',
        priority: 'high',
        risk_level: 'medium',
        risk_facets: ['high_reflexivity', 'power_concentration', 'kol_dependency', 'live_watch'],
        summary: 'The desk is tracking whether a familiar Solana persona is compressing social attention into a new market object.',
        why_it_matters: 'Persona-led coordination can mint a market before durable ownership or utility becomes legible.',
        evidence_links: ['/narratives/attention-markets'],
        created_at: '2026-06-24T09:00:00.000Z',
        updated_at: '2026-06-29T00:00:00.000Z'
      }
    }, 'candidate_signal_not_found')
  });
  add('get', '/v1/signal-hunt', {
    tags: ['Intelligence'],
    summary: 'List Signal Hunt intake',
    description: 'Returns the public Signal Hunt board: fresh signals, review queue, verified signals, noise, and disputes. This is the cultural intake layer feeding Proof Feed, LoopLab, Evidence Ledger, provider reputation, and agent readiness.',
    responses: envelopedResponses('SignalHuntSummary', {
      generated_at: '2026-07-01T12:15:00.000Z',
      counts: {
        total: 5,
        fresh_signal: 1,
        under_review: 1,
        verified_signal: 1,
        noise: 1,
        disputed: 1
      },
      candidates: [{
        id: 'hunt_black_bull_coordination',
        title: 'Black Bull attention is mutating into community coordination',
        handle_or_source: '@ansem + community carry',
        category: 'attention_market',
        thesis: 'The signal is no longer only persona velocity. Redistribution mechanics and participant-made media are carrying the object into a broader coordination loop.',
        why_it_matters: 'Signal Hunt surfaces the intake before Narrative Intel hardens the frame.',
        evidence: ['Reported creator-fee redistribution summaries keep recirculating as trench proof.'],
        evidence_count: 3,
        signal_score: 92,
        velocity_score: 89,
        risk_score: 79,
        proof_state: 'validated',
        hunt_state: 'verified_signal',
        decision_state: 'signal',
        submitted_by: 'desk',
        submitted_at: '2026-07-01T09:00:00.000Z',
        updated_at: '2026-07-01T12:15:00.000Z',
        linked_check_ids: ['check_route_pay_sh_seed'],
        linked_loop_ids: ['loop_pre_spend_route'],
        linked_signal_ids: ['black-bull'],
        linked_route_ids: ['route_pay_sh_market_research_01'],
        tags: ['coordination', 'attention-market', 'community-carry']
      }]
    })
  });
  add('get', '/v1/signal-hunt/{signalId}', {
    tags: ['Intelligence'],
    summary: 'Get Signal Hunt detail',
    description: 'Returns one Signal Hunt item with thesis, why it matters, evidence list, linked proof checks, loops, signal items, routes, and current decision panel.',
    parameters: [pathParam('signalId', 'Signal Hunt identifier.')],
    responses: envelopedResponses('SignalHuntCandidate', {
      id: 'hunt_troll_reindex',
      title: 'TROLL is behaving like internet memory, not fresh meme novelty',
      handle_or_source: 'Community takeover / Solscan / Dexscreener',
      category: 'meme_archetype',
      thesis: 'The signal is survival.',
      why_it_matters: 'Signal Hunt should catch re-indexed culture before the market narrative pretends it appeared from nowhere.',
      evidence: ['The asset carries a long-circulation survival frame instead of a one-cycle novelty frame.'],
      evidence_count: 3,
      signal_score: 88,
      velocity_score: 74,
      risk_score: 67,
      proof_state: 'receipts_attached',
      hunt_state: 'under_review',
      decision_state: 'review',
      submitted_by: 'community',
      submitted_at: '2026-06-30T11:30:00.000Z',
      updated_at: '2026-07-01T08:40:00.000Z',
      linked_check_ids: ['check_provider_reliability_seed'],
      linked_loop_ids: [],
      linked_signal_ids: ['troll'],
      linked_route_ids: [],
      tags: ['reindex', 'meme', 'community-takeover']
    }, 'signal_hunt_not_found')
  });
  add('post', '/v1/signal-hunt/submit', {
    tags: ['Intelligence'],
    summary: 'Submit Signal Hunt intake',
    description: 'Stages a new public Signal Hunt candidate. This is cultural intake, not a financial promise.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/SignalHuntSubmissionInput' }, {
      title: 'Machine-wallet infra is becoming public culture instead of back-office plumbing',
      handle_or_source: 'Machine market stack / Signal Graph',
      category: 'agent_infra',
      thesis: 'Machine identity, wallet rails, and preflight policy are starting to compress into one memetic stack.',
      why_it_matters: 'Signal Hunt is the intake layer that lets culture-facing discovery attach to the serious machine-market and pre-spend stack before claims harden.',
      evidence: ['Machine market coverage has expanded into route risk, receipts, and first-safe planning.'],
      submitted_by: 'desk',
      tags: ['machine-markets', 'wallets']
    }),
    responses: envelopedResponses('SignalHuntCandidate', {
      id: 'hunt_newsignal',
      hunt_state: 'fresh_signal',
      proof_state: 'receipts_attached',
      decision_state: 'review'
    })
  });
  add('post', '/v1/signal-hunt/{signalId}/verify', {
    tags: ['Intelligence'],
    summary: 'Verify or reject Signal Hunt intake',
    description: 'Moves a Signal Hunt item toward verified signal, noise, dispute, or continued review while attaching linked proof or loop memory.',
    parameters: [pathParam('signalId', 'Signal Hunt identifier.')],
    requestBody: jsonRequest({ $ref: '#/components/schemas/SignalHuntVerifyInput' }, {
      verifier: 'desk',
      verdict: 'verified_signal',
      proof_state: 'validated',
      decision_note: 'Linked proof and loop memory now support promotion beyond intake chatter.',
      linked_check_ids: ['check_route_pay_sh_seed'],
      linked_loop_ids: ['loop_pre_spend_route'],
      linked_signal_ids: ['black-bull'],
      linked_route_ids: ['route_pay_sh_market_research_01']
    }),
    responses: envelopedResponses('SignalHuntCandidate', {
      id: 'hunt_black_bull_coordination',
      hunt_state: 'verified_signal',
      proof_state: 'validated',
      decision_state: 'signal'
    }, 'signal_hunt_not_found')
  });
  add('get', '/v1/unicorn-radar', {
    tags: ['Intelligence'],
    summary: 'Get Unicorn Radar summary',
    description: 'Returns the flagship low-cap Solana discovery surface with candidate counts, candidate cards, revenue receipts, and disclosure copy. Projects can buy evaluation, not conviction.',
    responses: envelopedResponses('UnicornRadarSummary', {
      title: 'Infopunks Unicorn Radar',
      tagline: 'Finding serious low-cap Solana projects before consensus does.',
      counts: { total: 10 },
      candidates: [{ id: 'ur_jotchua_money_dog', project: 'Jotchua', status: 'high_signal_lowcap' }]
    })
  });
  add('get', '/v1/unicorn-radar/candidates', {
    tags: ['Intelligence'],
    summary: 'List Unicorn Radar candidates',
    description: 'Returns production-shaped low-cap Solana candidate records, including shipping proof, attention quality, token survivability, risk flags, receipts, hunter attribution, paid evaluation disclosure, status, verdict, scores, and optional DexScreener market data enrichment.',
    responses: envelopedResponses('UnicornRadarCandidateList', {
      generated_at: '2026-07-06T08:30:00.000Z',
      count: 10,
      candidates: [{ id: 'ur_jotchua_money_dog', project: 'Jotchua', ticker: 'JOTCHUA', sector: 'Social / Attention Markets', chainId: 'solana', tokenAddress: 'BcHEaaTCvycPwwsJ9yQTXdHP9X2gCLkznDbZ8VySpump' }]
    })
  });
  add('get', '/v1/unicorn-radar/candidates/{candidateId}', {
    tags: ['Intelligence'],
    summary: 'Get Unicorn Radar candidate detail',
    description: 'Returns one Unicorn Radar candidate with full thesis, proof, scores, receipts, narrative links, graph node, hunter attribution, paid evaluation disclosure, Infopunks verdict, and optional DexScreener market data. Market data via DexScreener. Infopunks verdict is independent.',
    parameters: [pathParam('candidateId', 'Unicorn Radar candidate identifier.')],
    responses: envelopedResponses('UnicornRadarCandidate', {
      id: 'ur_ai_rig_complex',
      project: 'AI Rig Complex',
      ticker: 'ARC',
      status: 'watchlist',
      verdict: 'real_product_weak_attention',
      marketDataSource: 'dexscreener_official_api',
      dexScreenerData: {
        marketCap: 17500000,
        liquidityUsd: 654321.12,
        volume24h: 123456.78,
        priceChange24h: 18.5
      }
    }, 'unicorn_radar_candidate_not_found')
  });
  add('post', '/v1/unicorn-radar/submit', {
    tags: ['Intelligence'],
    summary: 'Submit a Unicorn Radar candidate',
    description: 'Stages a low-cap Solana candidate for review. Submission does not imply listing, conviction, or endorsement.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/UnicornRadarSubmissionInput' }, {
      project: 'New Solana Project',
      ticker: 'NEW',
      sector: 'AI',
      market_cap_range: '$2M-$5M',
      thesis: 'Shipping before consensus.',
      proof_links: ['https://example.com/demo'],
      submitter_handle: '@hunter'
    }),
    responses: envelopedResponses('UnicornRadarSubmissionResponse', {
      submission_id: 'urs_new-solana-project_20260706',
      status: 'staged_for_review',
      disclosure: 'Community submissions are intake only.'
    })
  });
  add('post', '/v1/unicorn-radar/request-evaluation', {
    tags: ['Intelligence'],
    summary: 'Request paid Unicorn Radar evaluation',
    description: 'Stages a paid evaluation request. Paid status is disclosed publicly if the project enters the Radar. Payment buys evaluation time, not conviction.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/UnicornRadarEvaluationRequestInput' }, {
      project: 'New Solana Project',
      ticker: 'NEW',
      sector: 'AI',
      contact: 'founder@example.com',
      notes: 'Requesting evaluation with receipts attached.'
    }),
    responses: envelopedResponses('UnicornRadarEvaluationRequestResponse', {
      request_id: 'ure_new-solana-project_20260706',
      status: 'evaluation_requested',
      doctrine: 'Projects can buy evaluation, not conviction.'
    })
  });
  add('post', '/v1/evaluation-request', {
    tags: ['Intelligence'],
    summary: 'Request an Infopunks evaluation',
    description: 'Creates a paid evaluation intake packet for Unicorn Radar and Revenue Receipts. Payment buys evaluation, not conviction. If no webhook intake is configured, the API returns a manual_delivery_required response with a copyable request packet instead of pretending the request was stored.',
    requestBody: jsonRequest({ $ref: '#/components/schemas/EvaluationRequestInput' }, {
      projectName: 'Example Project',
      ticker: 'EXMPL',
      chain: 'solana',
      contact: 'founder@example.com',
      upsideThesis: 'The product has a real onchain economy with retained users.',
      riskFlags: 'Concentration risk, new market, team anonymity.',
      requestedReviewType: 'unicorn_radar_evaluation',
      disclosureAcknowledged: true
    }),
    responses: {
      '200': {
        description: 'Manual delivery fallback when webhook intake is absent or unavailable.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/EvaluationRequestResponseEnvelope' },
            examples: {
              success: {
                value: {
                  data: {
                    request_id: 'er_20260706103000_a1b2c3',
                    status: 'manual_delivery_required',
                    disclosure_acknowledged: true
                  }
                }
              }
            }
          }
        }
      },
      '202': {
        description: 'Accepted after successful delivery to a configured webhook intake.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/EvaluationRequestResponseEnvelope' },
            examples: {
              success: {
                value: {
                  data: {
                    request_id: 'er_20260706103000_a1b2c3',
                    status: 'accepted',
                    disclosure_acknowledged: true
                  }
                }
              }
            }
          }
        }
      },
      '400': {
        description: 'Disclosure acknowledgement is required. Other validation failures return invalid_request.',
        content: {
          'application/json': {
            schema: {
              oneOf: [
                { $ref: '#/components/schemas/EvaluationRequestDisclosureError' },
                { $ref: '#/components/schemas/InvalidRequestError' }
              ]
            },
            examples: {
              disclosure_required: {
                value: {
                  code: 'DISCLOSURE_REQUIRED',
                  message: 'You must acknowledge that payment buys evaluation, not conviction.'
                }
              }
            }
          }
        }
      },
      default: errorResponse()
    }
  });
  add('get', '/v1/unicorn-radar/revenue-receipts', {
    tags: ['Intelligence'],
    summary: 'List Unicorn Radar revenue receipts',
    description: 'Compatibility route for legacy clients. Returns disclosed commercial receipts for paid evaluations and comped review records. Clients should use /v1/revenue-receipts.',
    deprecated: true,
    responses: envelopedResponses('UnicornRadarRevenueReceiptList', {
      generated_at: '2026-07-06T08:30:00.000Z',
      count: 3,
      receipts: [
        { id: 'rr_open_evaluation_slot' },
        { id: 'rr_template_001' },
        { id: 'rr_unicorn_radar_build' }
      ]
    })
  });
  add('get', '/v1/revenue-receipts', {
    tags: ['Intelligence'],
    summary: 'List public revenue receipts',
    description: 'Returns the public Infopunks revenue ledger. Open slots, templates, and internal build receipts may appear before real paid work exists.',
    responses: envelopedResponses('RevenueReceiptSummary', {
      title: 'Infopunks Revenue Receipts',
      tagline: 'No receipt, no trust.',
      receipts: [{ id: 'rr_open_evaluation_slot', receiptNumber: 'Open Slot', status: 'open_slot' }]
    })
  });
  add('get', '/v1/revenue-receipts/{receiptId}', {
    tags: ['Intelligence'],
    summary: 'Get public revenue receipt detail',
    description: 'Returns one public Infopunks revenue receipt with disclosure, independence statement, use-of-funds, and notes.',
    parameters: [pathParam('receiptId', 'Revenue receipt identifier.')],
    responses: envelopedResponses('RevenueReceipt', {
      id: 'rr_open_evaluation_slot',
      receiptNumber: 'Open Slot',
      title: 'Open Unicorn Radar Evaluation Slot',
      source: 'sponsored_radar_evaluation',
      clientName: 'Open',
      amount: 100,
      currency: 'USD',
      status: 'open_slot'
    }, 'revenue_receipt_not_found')
  });
  add('get', '/v1/narratives/{slug}', {
    tags: ['Intelligence'],
    summary: 'Get narrative asset',
    description: 'Returns one seeded narrative asset record by slug.',
    parameters: [pathParam('slug', 'Narrative asset slug.')],
    responses: envelopedResponses('NarrativeAssetResponse', { slug: 'black-bull', ticker: 'ANSEM', name: 'The Black Bull' }, 'narrative_not_found')
  });
  add('get', '/v1/signals', {
    tags: ['Intelligence'],
    summary: 'List signal surfaces',
    description: 'Returns seeded signal source and signal report surfaces for Narrative Asset Intelligence.',
    responses: envelopedResponses('NarrativeSignalSurfaceListResponse', [{ slug: 'ansem', type: 'signal_source' }, { slug: 'black-bull', type: 'signal_report' }])
  });
  add('get', '/v1/signals/{slug}', {
    tags: ['Intelligence'],
    summary: 'Get signal surface',
    description: 'Returns one seeded signal source or signal report surface by slug.',
    parameters: [pathParam('slug', 'Signal surface slug.')],
    responses: envelopedResponses('NarrativeSignalSurfaceResponse', {
      slug: 'black-bull',
      type: 'signal_report',
      signal_source: 'Ansem',
      current_evolution_stage: 'coordination_market_emerging',
      current_evolution_label: 'Coordination Market Emerging',
      movement_status: 'under_observation',
      movement_status_label: 'Movement Candidate Under Observation'
    }, 'signal_surface_not_found')
  });
  add('get', '/v1/signals/{slug}/updates', {
    tags: ['Intelligence'],
    summary: 'List signal evidence updates',
    description: 'Returns versioned evidence updates for a signal asset, newest first. Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.',
    parameters: [pathParam('slug', 'Signal surface slug.')],
    responses: envelopedResponses('SignalEvidenceUpdateListResponse', {
      signal_slug: 'black-bull',
      count: 7,
      updates: [{
        update_id: 'seu_black_bull_007',
        signal_slug: 'black-bull',
        timestamp: '2026-07-01T09:00:00.000Z',
        update_type: 'verdict_change',
        summary: 'Infopunks updates Black Bull from a pure persona attention market into Coordination Market Emerging as redistribution, holder growth, and community-led media become central to the signal.',
        evidence_links: ['https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers', '/signals/black-bull', '/narratives/attention-market-watch'],
        previous_score: 88,
        new_score: 91,
        analyst_note: 'The latest signal shift is structural. Ansem\'s low-key activity, reported creator-fee redistribution, holder-growth narrative, and community media suggest Black Bull is moving from persona-led attention into community coordination. The desk keeps SUPPORTIVE WATCH active while monitoring whether the flywheel can persist beyond short-term incentives and concentrated attention.'
      }]
    }, 'signal_surface_not_found')
  });
  add('get', '/v1/signals/{slug}/updates/{updateId}', {
    tags: ['Intelligence'],
    summary: 'Get signal evidence update',
    description: 'Returns one versioned evidence update for a signal asset by update id. Unknown signals return signal_surface_not_found. Unknown update ids return signal_update_not_found.',
    parameters: [
      pathParam('slug', 'Signal surface slug.'),
      pathParam('updateId', 'Signal evidence update identifier.')
    ],
    responses: {
      ...envelopedResponses('SignalEvidenceUpdateDetailResponse', {
        signal_slug: 'black-bull',
        update: {
          update_id: 'seu_black_bull_007',
          signal_slug: 'black-bull',
          timestamp: '2026-07-01T09:00:00.000Z',
          update_type: 'verdict_change',
          summary: 'Infopunks updates Black Bull from a pure persona attention market into Coordination Market Emerging as redistribution, holder growth, and community-led media become central to the signal.',
          evidence_links: ['https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers', '/signals/black-bull', '/narratives/attention-market-watch'],
          previous_score: 88,
          new_score: 91,
          analyst_note: 'The latest signal shift is structural. Ansem\'s low-key activity, reported creator-fee redistribution, holder-growth narrative, and community media suggest Black Bull is moving from persona-led attention into community coordination. The desk keeps SUPPORTIVE WATCH active while monitoring whether the flywheel can persist beyond short-term incentives and concentrated attention.'
        }
      }),
      '404': {
        description: 'Unknown signal or unknown signal update.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            examples: {
              signalNotFound: { value: { error: 'signal_surface_not_found' } },
              updateNotFound: { value: { error: 'signal_update_not_found' } }
            }
          }
        }
      }
    }
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
  add('get', '/v1/abundance', radarGet('Machine Economy', 'Get Abundance Desk', 'Abundance Desk frames Infopunks as the proof, receipt, and judgment layer for the machine-labor economy.', freeformObject(), { title: 'Abundance Desk', abundance_claims_feed: [{ claim_id: 'abd_claim_agent_paid_api_work', proof_state: 'receipts_present' }] }));
  add('get', '/v1/abundance/claims', radarGet('Machine Economy', 'List Abundance Desk claims', 'Returns seeded AI, robotics, autonomous wallet, productivity, and surplus claims with Infopunks proof and decision states.', freeformObject(), { count: 6, claims: [{ claim_id: 'abd_claim_uhi_machine_surplus', decision_state: 'unproven' }] }));
  add('get', '/v1/abundance/receipts', radarGet('Machine Economy', 'List machine work receipts', 'Returns seeded machine work receipt records for the Abundance Desk data type.', freeformObject(), { count: 3, receipts: [{ receipt_id: 'mwr_agent_translation_001', validation_state: 'receipts_present' }] }));
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

  // RH Chain is a public intelligence desk. Keep its schema separate from the
  // general Radar envelope because source provenance and data mode are part of
  // the contract consumers use to decide how much weight to give a result.
  const rhChain = (summary: string, description: string, payload: string, example: unknown, parameters?: unknown[], requestBody?: JsonSchema, errors?: Record<string, unknown>) => ({
    tags: ['RH Chain'],
    summary,
    description: `Public intelligence only — not endorsement or financial advice. ${description} Live data is cached context only and never overrides human-reviewed receipts.`,
    ...(parameters ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: rhChainResponses(payload, example, errors)
  });
  const rhExample = { generated_at: '2026-07-12T00:00:00.000Z', data_mode: 'seeded', disclaimer: 'Public intelligence only. Not endorsement or financial advice.' };
  add('get', '/v1/rh-chain', rhChain('Get RH Chain Signal Desk', 'Returns the complete chain pulse, meme watch, signals, risk wall, receipts, and review context.', 'RhChainDeskPayload', { ...rhExample, title: 'RH Chain Signal Desk', chain_pulse: { metrics: [] } }));
  add('get', '/v1/rh-chain/memes', rhChain('List RH Chain memes', 'Returns source-linked meme assets and their risk states.', 'RhChainMemesPayload', { ...rhExample, memes: [{ ticker: 'RH', contract: '0xexample', risk_state: 'source_required' }] }));
  add('get', '/v1/rh-chain/signals', rhChain('List RH Chain signals', 'Returns the public signal classifier and its evidence requirements.', 'RhChainSignalsPayload', { ...rhExample, signals: [{ label: 'fresh_signal', meaning: 'New source-linked observation.' }] }));
  add('get', '/v1/rh-chain/receipts', rhChain('List RH Chain receipts', 'Returns human-reviewed or source-linked public memory receipts.', 'RhChainReceiptsPayload', { ...rhExample, receipts: [{ receipt_id: 'rh-chain-seed-2026-07-09', timestamp: '2026-07-09T03:45:00.000Z' }] }));
  add('get', '/v1/rh-chain/4663-index', rhChain('Get 4663 Signal Index', 'Returns the non-tokenized attention and risk index with its scoring context.', 'RhChain4663IndexPayload', { ...rhExample, name: '4663 Signal Index', assets: [{ ticker: 'RH', signal_score: 54, classification: 'active_speculation' }] }));
  add('get', '/v1/rh-chain/campaigns/100-receipts', rhChain('Get 100 Receipts campaign', 'Returns manually reviewed campaign batches, exact-contract dossier routes, Daily Top 5 roles, evidence gaps, and pending outcome memory.', 'RhChain100ReceiptsCampaignPayload', { ...rhExample, campaign_id: 'rh_chain_100_tokens_100_receipts', title: '100 Tokens. 100 Receipts. One Public Memory.', batch: { batch_id: 'rh_100_receipts_day_001', reviewed_count: 5 }, assets: [{ ticker: 'CASHCAT', evidence_state: 'approved_signal' }] }));
  add('get', '/v1/rh-chain/today-on-4663', rhChain('Get Today on 4663', 'Returns a compact, read-only aggregation of the latest reviewed receipt, manual index memory, risk cues, and attention context. It fails soft to static manual memory when storage or automation reads are unavailable.', 'RhChainTodayOn4663Payload', { ...rhExample, title: 'Today on 4663', data_mode: 'manual', freshness_state: 'fresh', storage_status: 'available', cards: [{ id: 'top_signal', title: 'Top Signal', judgment_state: 'reviewed_memory' }] }));
  add('get', '/v1/rh-chain/daily-receipts', rhChain('List daily RH Chain receipts', 'Returns human-reviewed daily market memory; it is the authoritative reviewed record when live context conflicts.', 'RhChainDailyReceiptsPayload', { ...rhExample, title: 'Daily RH Chain Receipts', latest_receipt: { receipt_id: 'daily-rh-chain-2026-07-12', date: '2026-07-12' } }));
  add('get', '/v1/rh-chain/daily-receipts/{receipt_id}', rhChain('Get daily RH Chain receipt', 'Returns one human-reviewed daily receipt by id. Unknown receipt ids return rh_chain_daily_receipt_not_found.', 'RhChainDailyReceiptPayload', { ...rhExample, receipt_id: 'rh_daily_001', period: 'July 11 → July 12, 2026 UTC', headline: 'RH Chain receipt memory.' }, [pathParam('receipt_id', 'Daily receipt identifier.')], undefined, { '404': rhChainErrorResponse('rh_chain_daily_receipt_not_found') }));
  add('get', '/v1/rh-chain/meme-pulse', rhChain('Get RH Meme Pulse', 'Returns the current meme pulse with cached live context where available.', 'RhChainMemePulsePayload', { ...rhExample, title: 'RH Meme Pulse', snapshot: { flagship_signal: 'Source verification required.' } }));
  add('get', '/v1/rh-chain/launch-surfaces', rhChain('List launch and access surfaces', 'Returns manual launch-origin and access-surface context used for evidence review. Access context never implies legitimacy or safety.', 'RhChainLaunchSurfacesPayload', { ...rhExample, title: 'Launch Surface Watch', launch_surfaces: [{ id: 'noxa_fun', source_type: 'launchpad' }], access_surfaces: [{ access_surface_name: 'Backpack Wallet', source_status: 'source_required' }] }));
  add('get', '/v1/rh-chain/launchpad-observatory', rhChain('Get Launchpad Observatory', 'Returns manual post-NOXA launch-surface health, source-required claims, and risk memory. It is read-only and never provides launch or trading flows.', 'RhChainLaunchpadObservatoryPayload', { ...rhExample, title: 'RH Chain Launchpad Observatory', surfaces: [{ surface_id: 'noxa_fun', status: 'degraded', status_confidence: 'medium' }], claim_ledger: [{ claim_type: 'outage_claim', status: 'source_required' }] }));
  add('get', '/v1/rh-chain/live-snapshot', rhChain('Get cached live snapshot', 'Returns provider status and cached chain and meme context. Cache status and freshness must be checked before use.', 'RhChainLiveSnapshotPayload', { ...rhExample, title: 'RH Chain Live Snapshot', cache_status: 'fresh', live_snapshots_enabled: true }));
  add('get', '/v1/rh-chain/live-snapshot/token/{contract}', rhChain('Get cached token snapshot', 'Returns cached token pair and explorer context for one contract.', 'RhChainTokenSnapshotPayload', { ...rhExample, contract: '0xexample', cache_status: 'fresh' }, [pathParam('contract', 'Token contract address.')]));
  add('get', '/v1/rh-chain/tokens/{contract}/dossier', rhChain('Get token dossier', 'Returns reviewed memory, submissions, launch context, and non-authoritative cached external context for one contract.', 'RhChainTokenDossierPayload', { ...rhExample, contract: '0xexample', review_status: 'not_found', risk_state: 'source_required' }, [pathParam('contract', 'Token contract address.')]));
  add('get', '/v1/rh-chain/review-queue', rhChain('Get review queue', 'Returns the public manual review queue and review states. Queue inclusion is not a safety finding.', 'RhChainReviewQueuePayload', { ...rhExample, counts: { queued: 1 }, items: [{ review_id: 'rh-review-001', review_state: 'queued_for_manual_review' }] }));
  add('get', '/v1/rh-chain/clone-radar', rhChain('Get clone radar', 'Returns suspected duplicate, impersonator, liquidity, and deployer patterns that still require receipt review.', 'RhChainCloneRadarPayload', { ...rhExample, title: 'Clone & Impersonator Radar', active_warnings: [] }));
  add('get', '/v1/rh-chain/scouts', rhChain('List Signal Scouts', 'Returns consented public contributor attribution and Scout roles; private contact information is never returned.', 'RhChainScoutsPayload', { ...rhExample, title: 'Signal Scouts', scouts: [] }));
  add('get', '/v1/rh-chain/distribution-pack', rhChain('Get distribution pack', 'Returns public-intelligence share packets with their risk caveats.', 'RhChainDistributionPackPayload', { ...rhExample, title: 'RH Chain Distribution Pack', packets: [] }));
  add('get', '/v1/rh-chain/receipt-relay', rhChain('Get Receipt Relay export packets', 'Returns caveated, bot-friendly JSON and copy packets for public-memory artifacts. It never sends, schedules, or coordinates messages.', 'RhChainReceiptRelayPayload', { ...rhExample, title: 'RH Chain Receipt Relay', packets: [{ packet_id: 'daily-receipt-latest-x', surface: 'x', risk_disclaimer: 'Public intelligence only.' }] }));
  add('get', '/v1/rh-chain/signals/submissions', rhChain('List signal submissions', 'Returns sanitized community submissions. Submission is intake only, not endorsement or approval.', 'RhChainSubmissionsPayload', { ...rhExample, storage: { durable: false }, submissions: [] }));
  add('post', '/v1/rh-chain/signals/submit', rhChain('Submit RH Chain signal', 'Stages a source-linked signal for manual review. Exact non-placeholder contract identity, at least one receipt link or deployer note, and disclosure confirmation are required.', 'RhChainSubmissionResponse', { ...rhExample, submission: { submission_id: 'rh-chain-rh-20260712000000', review_status: 'queued_for_manual_review' } }, undefined, jsonRequest({ $ref: '#/components/schemas/RhChainSignalSubmissionRequest' }, { token_contract: '0x1111111111111111111111111111111111111111', ticker: 'RH', liquidity_link: 'https://example.com/pair', launch_source: 'uniswap_direct_pool', disclosure_confirmed: true }), { '400': rhChainErrorResponse('invalid_request'), '503': rhChainErrorResponse('rh_chain_submission_storage_not_configured') }));
  add('post', '/v1/rh-chain/scout/query', rhChain('Query Signal Scout', 'Searches public desk memory and review items; results are intelligence context, not a trading recommendation.', 'RhChainScoutQueryResponse', { ...rhExample, mode: 'token_context', answer: 'No reviewed receipt found.', citations: [] }, undefined, jsonRequest({ $ref: '#/components/schemas/RhChainScoutQueryRequest' }, { query: '0x1111111111111111111111111111111111111111', mode: 'token_context' }), { '400': rhChainErrorResponse('invalid_request') }));

  const reviewConsole = (summary: string, description: string, payload: string, example: unknown, parameters?: unknown[], requestBody?: JsonSchema) => ({
    tags: ['RH Chain Internal'],
    summary,
    description: `Fail-closed internal review surface. Dedicated reviewer bearer auth is required; the feature is disabled by default and never accepts provider writes. ${description}`,
    security: [{ bearerAuth: [] }],
    ...(parameters ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: {
      ...rhChainResponses(payload, example, {
        '400': rhChainErrorResponse('invalid_request'),
        '401': rhChainErrorResponse('review_admin_token_required'),
        '404': rhChainErrorResponse('not_found'),
        '409': rhChainErrorResponse('rh_chain_review_conflict')
      })
    }
  });
  add('get', '/internal/rh-chain/review-console/submissions', reviewConsole('List review-console submissions', 'Returns redacted review packets and storage mode. Private Scout contact data is never returned.', 'RhChainReviewConsoleListPayload', { submissions: [], storage: { adapter: 'postgres', durable: true } }));
  add('get', '/internal/rh-chain/review-console/submissions/{submissionId}', reviewConsole('Get a review-console submission', 'Returns one redacted review packet and its immutable audit trail.', 'RhChainReviewConsoleDetailPayload', { submission: { submission_id: 'rh-chain-example', review_status: 'queued_for_manual_review', audit_events: [] } }, [pathParam('submissionId', 'Signal Vault submission identifier.')]));
  add('patch', '/internal/rh-chain/review-console/submissions/{submissionId}', reviewConsole('Update a review-console submission', 'Uses last_seen_updated_at for optimistic concurrency and requires audit_note so every accepted review write appends an audit event.', 'RhChainReviewConsoleDetailPayload', { submission: { submission_id: 'rh-chain-example', review_status: 'under_receipt_check', audit_events: [{ action: 'review_updated' }] } }, [pathParam('submissionId', 'Signal Vault submission identifier.')], jsonRequest({ $ref: '#/components/schemas/RhChainReviewUpdateRequest' }, { review_status: 'under_receipt_check', audit_note: 'Started source inspection.', last_seen_updated_at: '2026-07-12T00:00:00.000Z' })));

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
      { name: 'Loops' },
      { name: 'Hermes' },
      { name: 'Machine Economy' },
      { name: 'Radar CSV Exports' },
      { name: 'RH Chain', description: 'Public RH Chain intelligence, source provenance, and reviewed receipt memory.' }
      , { name: 'RH Chain Internal', description: 'Fail-closed, bearer-gated manual review operations with optimistic concurrency and audit events.' }
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
  const hermesDecisionState = enumSchema(['trust', 'caution', 'do_not_use_yet', 'unproven', 'disputed']);
  const hermesRunState = enumSchema(['queued', 'running', 'completed', 'failed', 'blocked']);
  const hermesReputationTargetType = enumSchema(['provider', 'route', 'service', 'unknown']);
  const hermesReputationDirection = enumSchema(['positive', 'negative', 'neutral', 'watch']);
  const hermesReputationState = enumSchema(['trusted', 'watchlist', 'unproven', 'degraded', 'disputed']);
  const hermesArtifact = objectSchema({
    artifact_id: stringSchema(),
    label: stringSchema(),
    type: enumSchema(['receipt', 'claim', 'loop_run', 'risk_note', 'narrative_scan', 'skill_trace']),
    summary: stringSchema(),
    uri: stringSchema()
  }, ['artifact_id', 'label', 'type', 'summary', 'uri']);
  const hermesRunLifecycleEvent = objectSchema({
    id: stringSchema(),
    at: dateTimeSchema(),
    state: stringSchema(),
    label: stringSchema(),
    detail: stringSchema()
  }, ['id', 'at', 'state', 'label']);
  const hermesSkillSummary = objectSchema({
    id: stringSchema(),
    label: stringSchema(),
    purpose: stringSchema(),
    enabled: booleanSchema(),
    produces: arrayOf(enumSchema(['receipt', 'claim', 'loop_run', 'risk_note', 'narrative_signal']))
  }, ['id', 'label', 'purpose', 'enabled', 'produces']);
  const hermesSkillRule = objectSchema({
    id: stringSchema(),
    title: stringSchema(),
    description: stringSchema()
  }, ['id', 'title', 'description']);
  const hermesSkillOutputSchema = objectSchema({
    required_fields: arrayOf(stringSchema()),
    artifact_contract: arrayOf(stringSchema()),
    decision_states: arrayOf(hermesDecisionState),
    receipt_ready_fields: arrayOf(stringSchema())
  }, ['required_fields', 'artifact_contract', 'decision_states', 'receipt_ready_fields']);
  const hermesSkill = objectSchema({
    id: stringSchema(),
    title: stringSchema(),
    purpose: stringSchema(),
    when_to_use: arrayOf(stringSchema()),
    rules: arrayOf(hermesSkillRule),
    expected_outputs: hermesSkillOutputSchema,
    decision_mapping: objectSchema({
      trust: stringSchema(),
      caution: stringSchema(),
      do_not_use_yet: stringSchema(),
      unproven: stringSchema(),
      disputed: stringSchema()
    }),
    linked_infopunks_primitives: arrayOf(stringSchema())
  }, ['id', 'title', 'purpose', 'when_to_use', 'rules', 'expected_outputs', 'decision_mapping', 'linked_infopunks_primitives']);
  const hermesRunReceipt = objectSchema({
    id: stringSchema(),
    source_run_id: stringSchema(),
    title: stringSchema(),
    summary: stringSchema(),
    decision: hermesDecisionState,
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    artifacts: arrayOf(hermesArtifact),
    evidence_count: integerSchema(),
    created_at: dateTimeSchema(),
    receipt_kind: { const: 'agent_run_receipt' },
    source: { const: 'hermes' }
  }, ['id', 'source_run_id', 'title', 'summary', 'decision', 'confidence', 'artifacts', 'evidence_count', 'created_at', 'receipt_kind', 'source']);
  const hermesClaimCandidate = objectSchema({
    id: stringSchema(),
    source_receipt_id: stringSchema(),
    title: stringSchema(),
    claim: stringSchema(),
    status: { const: 'candidate' },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    evidence_summary: stringSchema(),
    risk_notes: arrayOf(stringSchema()),
    created_at: dateTimeSchema()
  }, ['id', 'source_receipt_id', 'title', 'claim', 'status', 'confidence', 'evidence_summary', 'risk_notes', 'created_at']);
  const hermesClaimReviewState = enumSchema(['candidate', 'accepted', 'needs_more_evidence', 'disputed', 'rejected']);
  const hermesReputationImpact = objectSchema({
    target_type: hermesReputationTargetType,
    target_id: stringSchema(),
    direction: hermesReputationDirection,
    magnitude: { type: 'number', minimum: 0, maximum: 1 },
    summary: stringSchema(),
    reputation_notes: arrayOf(stringSchema())
  }, ['target_type', 'direction', 'magnitude', 'summary', 'reputation_notes']);
  const hermesReputationLedgerEvent = objectSchema({
    id: stringSchema(),
    at: dateTimeSchema(),
    source_run_id: stringSchema(),
    source_receipt_id: stringSchema(),
    source_claim_id: stringSchema(),
    decision: hermesDecisionState,
    review_state: hermesClaimReviewState,
    direction: hermesReputationDirection,
    magnitude: { type: 'number', minimum: 0, maximum: 1 },
    summary: stringSchema(),
    notes: arrayOf(stringSchema())
  }, ['id', 'at', 'source_run_id', 'source_receipt_id', 'source_claim_id', 'decision', 'review_state', 'direction', 'magnitude', 'summary', 'notes']);
  const hermesReputationLedgerEntry = objectSchema({
    target_type: hermesReputationTargetType,
    target_id: stringSchema(),
    label: stringSchema(),
    current_state: hermesReputationState,
    trust_score: { type: 'number', minimum: 0, maximum: 100 },
    impact_total: { type: 'number' },
    positive_count: integerSchema(),
    negative_count: integerSchema(),
    watch_count: integerSchema(),
    neutral_count: integerSchema(),
    disputed_count: integerSchema(),
    latest_event_at: dateTimeSchema(),
    decision_history: arrayOf(hermesReputationLedgerEvent),
    source_claim_ids: arrayOf(stringSchema()),
    source_receipt_ids: arrayOf(stringSchema()),
    source_run_ids: arrayOf(stringSchema())
  }, ['target_type', 'label', 'current_state', 'trust_score', 'impact_total', 'positive_count', 'negative_count', 'watch_count', 'neutral_count', 'disputed_count', 'decision_history', 'source_claim_ids', 'source_receipt_ids', 'source_run_ids']);
  const hermesPromotedClaim = objectSchema({
    id: stringSchema(),
    source: { const: 'hermes_agent_run' },
    source_run_id: stringSchema(),
    source_receipt_id: stringSchema(),
    title: stringSchema(),
    claim: stringSchema(),
    review_state: hermesClaimReviewState,
    decision: hermesDecisionState,
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    evidence_summary: stringSchema(),
    evidence_count: integerSchema(),
    risk_notes: arrayOf(stringSchema()),
    reputation_impact: hermesReputationImpact,
    created_at: dateTimeSchema(),
    reviewed_at: dateTimeSchema()
  }, ['id', 'source', 'source_run_id', 'source_receipt_id', 'title', 'claim', 'review_state', 'decision', 'confidence', 'evidence_summary', 'evidence_count', 'risk_notes', 'reputation_impact', 'created_at', 'reviewed_at']);
  const hermesRun = objectSchema({
    id: stringSchema(),
    title: stringSchema(),
    objective: stringSchema(),
    state: hermesRunState,
    decision: hermesDecisionState,
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    summary: stringSchema(),
    risk_factors: arrayOf(stringSchema()),
    artifacts: arrayOf(hermesArtifact),
    linked_receipt_id: nullableString(),
    linked_claim_id: nullableString(),
    linked_loop_id: nullableString(),
    created_at: dateTimeSchema(),
    completed_at: { type: ['string', 'null'], format: 'date-time' },
    source: enumSchema(['mock', 'hermes_http', 'hermes_http_fallback']),
    fallback_reason: stringSchema(),
    lifecycle_events: arrayOf(hermesRunLifecycleEvent)
  }, ['id', 'title', 'objective', 'state', 'decision', 'confidence', 'summary', 'risk_factors', 'artifacts', 'linked_receipt_id', 'linked_claim_id', 'linked_loop_id', 'created_at', 'completed_at']);

  return {
    RhChainSource: objectSchema({
      source_name: stringSchema(), source_url: nullableString(), observed_at: dateTimeSchema(), updated_at: dateTimeSchema(),
      data_mode: enumSchema(['seeded', 'manual', 'community_submission', 'persisted', 'live_cached', 'unavailable', 'cached', 'live_future']),
      confidence_level: enumSchema(['low', 'medium', 'high']), note: nullableString(), caveat: nullableString()
    }, ['source_name', 'observed_at', 'updated_at', 'data_mode', 'confidence_level']),
    RhChainResponseMeta: objectSchema({
      source_policy: stringSchema(), record_count: { type: ['integer', 'null'], minimum: 0 }, provider_status: arrayOf(freeformObject()), live_indexing_enabled: { const: false }
    }, ['source_policy', 'record_count', 'provider_status', 'live_indexing_enabled']),
    RhChainResponseEnvelope: objectSchema({
      data: freeformObject(), meta: { $ref: '#/components/schemas/RhChainResponseMeta' }, sources: arrayOf({ $ref: '#/components/schemas/RhChainSource' }),
      generated_at: dateTimeSchema(), data_mode: enumSchema(['seeded', 'manual', 'community_submission', 'persisted', 'live_cached', 'unavailable', 'cached', 'live_future']), disclaimer: stringSchema()
    }, ['data', 'meta', 'sources', 'generated_at', 'data_mode', 'disclaimer']),
    RhChainErrorEnvelope: objectSchema({
      data: { type: 'null' }, error: stringSchema(), message: stringSchema(), issues: arrayOf(freeformObject()), meta: { $ref: '#/components/schemas/RhChainResponseMeta' }, sources: arrayOf({ $ref: '#/components/schemas/RhChainSource' }),
      generated_at: dateTimeSchema(), data_mode: enumSchema(['seeded', 'manual', 'community_submission', 'persisted', 'live_cached', 'unavailable', 'cached', 'live_future']), disclaimer: stringSchema()
    }, ['data', 'error', 'meta', 'sources', 'generated_at', 'data_mode', 'disclaimer']),
    RhChainSignalSubmissionRequest: objectSchema({
      token_contract: stringSchema(), ticker: stringSchema(), chain: stringSchema(), x_twitter_link: stringSchema(), website_link: stringSchema(), liquidity_link: stringSchema(), deployer_notes: stringSchema(), submitter_notes: stringSchema(),
      launch_source: enumSchema(['noxa_fun', 'flap_sh', 'trensh_today', 'bankr', 'tokeny_fun', 'vlad_fun', 'robindotmarket', '20lab_erc20', 'pump_fun_routed_rh_chain', 'uniswap_direct_pool', 'hardhat_foundry_custom', 'unknown_manual']), launch_surface_url: stringSchema(), pair_address: stringSchema(), deployer_address: stringSchema(),
      lp_status_claim: enumSchema(['unknown', 'locked_claimed', 'burned_claimed', 'unlocked', 'unavailable']), scout_handle: stringSchema(), scout_contact: stringSchema(), public_attribution_consent: booleanSchema(), disclosure_confirmed: { const: true }
    }, ['token_contract', 'ticker', 'disclosure_confirmed']),
    RhChainScoutQueryRequest: objectSchema({ query: stringSchema(), mode: enumSchema(['market_pulse', 'risk_memory', 'narrative_mutation', 'token_context', 'launch_context']) }, ['query']),
    RhChainDeskPayload: freeformObject(),
    RhChainMemesPayload: objectSchema({ generated_at: dateTimeSchema(), source_policy: stringSchema(), memes: arrayOf(freeformObject()) }, ['generated_at', 'memes']),
    RhChainSignalsPayload: objectSchema({ generated_at: dateTimeSchema(), source_policy: stringSchema(), signals: arrayOf(freeformObject()) }, ['generated_at', 'signals']),
    RhChainReceiptsPayload: objectSchema({ generated_at: dateTimeSchema(), receipts: arrayOf(freeformObject()) }, ['generated_at', 'receipts']),
    RhChain4663IndexPayload: objectSchema({ name: { const: '4663 Signal Index' }, generated_at: dateTimeSchema(), source_policy: stringSchema(), disclaimer: stringSchema(), assets: arrayOf(freeformObject()) }, ['name', 'generated_at', 'assets']),
    RhChain100ReceiptsCampaignPayload: objectSchema({ campaign_id: { const: 'rh_chain_100_tokens_100_receipts' }, title: { const: '100 Tokens. 100 Receipts. One Public Memory.' }, generated_at: dateTimeSchema(), data_mode: { const: 'manual' }, source_policy: stringSchema(), disclaimer: stringSchema(), batch: freeformObject(), assets: arrayOf(freeformObject()), daily_top_5: arrayOf(freeformObject()) }, ['campaign_id', 'title', 'generated_at', 'data_mode', 'batch', 'assets', 'daily_top_5']),
    RhChainTodayOn4663Payload: objectSchema({ title: { const: 'Today on 4663' }, generated_at: dateTimeSchema(), data_mode: enumSchema(['manual', 'manual_fallback']), freshness_state: enumSchema(['fresh', 'aging', 'stale', 'source_required']), storage_status: enumSchema(['available', 'unavailable']), caveats: arrayOf(stringSchema()), latest_receipt: freeformObject(), cards: arrayOf(freeformObject()) }, ['title', 'generated_at', 'data_mode', 'freshness_state', 'storage_status', 'caveats', 'latest_receipt', 'cards']),
    RhChainDailyReceiptsPayload: objectSchema({ title: { const: 'Daily RH Chain Receipts' }, generated_at: dateTimeSchema(), source_policy: stringSchema(), disclaimer: stringSchema(), latest_receipt: freeformObject(), receipts: arrayOf(freeformObject()) }, ['title', 'generated_at', 'latest_receipt', 'receipts']),
    RhChainDailyReceiptPayload: objectSchema({ receipt_id: stringSchema(), period: stringSchema(), headline: stringSchema(), top_signal: stringSchema(), biggest_risk: stringSchema(), strongest_narrative: stringSchema(), infopunks_verdict: stringSchema(), source_notes: stringSchema(), observed_at: dateTimeSchema(), data_mode: stringSchema(), confidence_level: stringSchema(), receipt_sections: arrayOf(freeformObject()), sources: arrayOf({ $ref: '#/components/schemas/RhChainSource' }) }, ['receipt_id', 'period', 'headline', 'top_signal', 'biggest_risk', 'strongest_narrative', 'infopunks_verdict', 'source_notes', 'observed_at', 'data_mode', 'confidence_level', 'receipt_sections']),
    RhChainMemePulsePayload: objectSchema({ title: { const: 'RH Meme Pulse' }, generated_at: dateTimeSchema(), disclaimer: stringSchema(), snapshot: freeformObject(), top_attention_assets: arrayOf(freeformObject()) }, ['title', 'generated_at', 'snapshot']),
    RhChainLaunchSurfacesPayload: objectSchema({ title: { const: 'Launch Surface Watch' }, generated_at: dateTimeSchema(), data_mode: stringSchema(), source_policy: stringSchema(), disclaimer: stringSchema(), launch_surfaces: arrayOf(freeformObject()), access_surfaces: arrayOf(freeformObject()) }, ['title', 'generated_at', 'data_mode', 'launch_surfaces', 'access_surfaces']),
    RhChainLaunchpadObservatoryPayload: objectSchema({ title: { const: 'RH Chain Launchpad Observatory' }, generated_at: dateTimeSchema(), data_mode: { const: 'manual' }, source_policy: stringSchema(), disclaimer: stringSchema(), surfaces: arrayOf(freeformObject()), claim_ledger: arrayOf(freeformObject()), post_noxa_stress_map: arrayOf(freeformObject()), risk_notes: arrayOf(freeformObject()) }, ['title', 'generated_at', 'data_mode', 'surfaces', 'claim_ledger', 'post_noxa_stress_map', 'risk_notes']),
    RhChainLiveSnapshotPayload: objectSchema({ title: { const: 'RH Chain Live Snapshot' }, generated_at: dateTimeSchema(), live_snapshots_enabled: booleanSchema(), judgment_policy: stringSchema(), cache_status: enumSchema(['fresh', 'stale', 'unavailable', 'disabled']), disclaimer: stringSchema() }, ['title', 'generated_at', 'live_snapshots_enabled', 'cache_status']),
    RhChainTokenSnapshotPayload: freeformObject(),
    RhChainTokenDossierPayload: objectSchema({ contract: stringSchema(), review_status: stringSchema(), risk_state: stringSchema(), data_mode: stringSchema(), generated_at: dateTimeSchema(), disclaimer: stringSchema(), memory: freeformObject(), external_context: freeformObject() }, ['contract', 'review_status', 'risk_state', 'data_mode', 'generated_at', 'memory', 'external_context']),
    RhChainReviewQueuePayload: objectSchema({ generated_at: dateTimeSchema(), source_policy: stringSchema(), disclaimer: stringSchema(), data_mode: stringSchema(), counts: freeformObject(), items: arrayOf(freeformObject()), grouped: freeformObject() }, ['generated_at', 'counts', 'items', 'grouped']),
    RhChainCloneRadarPayload: objectSchema({ title: { const: 'Clone & Impersonator Radar' }, generated_at: dateTimeSchema(), disclaimer: stringSchema(), active_warnings: arrayOf(freeformObject()), duplicate_ticker_watch: arrayOf(freeformObject()), liquidity_watch: arrayOf(freeformObject()) }, ['title', 'generated_at', 'active_warnings', 'duplicate_ticker_watch', 'liquidity_watch']),
    RhChainScoutsPayload: objectSchema({ title: { const: 'Signal Scouts' }, generated_at: dateTimeSchema(), disclaimer: stringSchema(), scouts: arrayOf(freeformObject()), roles: arrayOf(freeformObject()) }, ['title', 'generated_at', 'scouts', 'roles']),
    RhChainDistributionPackPayload: objectSchema({ title: { const: 'RH Chain Distribution Pack' }, generated_at: dateTimeSchema(), disclaimer: stringSchema(), packets: arrayOf(freeformObject()) }, ['title', 'generated_at', 'packets']),
    RhChainReceiptRelayPayload: objectSchema({ title: { const: 'RH Chain Receipt Relay' }, generated_at: dateTimeSchema(), data_mode: { const: 'manual' }, disclaimer: stringSchema(), packets: arrayOf(freeformObject()) }, ['title', 'generated_at', 'data_mode', 'packets']),
    RhChainSubmissionsPayload: objectSchema({ generated_at: dateTimeSchema(), data_mode: stringSchema(), source_policy: stringSchema(), storage: freeformObject(), submissions: arrayOf(freeformObject()) }, ['generated_at', 'data_mode', 'storage', 'submissions']),
    RhChainSubmissionResponse: objectSchema({ data_mode: stringSchema(), review_packet: freeformObject(), submission: freeformObject(), storage: freeformObject() }, ['data_mode', 'review_packet', 'submission', 'storage']),
    RhChainScoutQueryResponse: freeformObject(),
    RhChainReviewConsoleListPayload: objectSchema({ submissions: arrayOf(freeformObject()), storage: freeformObject() }, ['submissions', 'storage']),
    RhChainReviewConsoleDetailPayload: objectSchema({ submission: freeformObject() }, ['submission']),
    RhChainReviewUpdateRequest: objectSchema({ review_status: stringSchema(), reviewer_note: stringSchema(), evidence_summary: stringSchema(), missing_evidence: arrayOf(stringSchema()), risk_state: stringSchema(), signal_state: stringSchema(), infopunks_verdict: stringSchema(), audit_note: stringSchema(), last_seen_updated_at: dateTimeSchema() }, ['audit_note', 'last_seen_updated_at']),
    ErrorEnvelope: objectSchema({
      error: stringSchema(),
      message: stringSchema(),
      details: freeformObject()
    }),
    InvalidRequestError: objectSchema({
      error: enumSchema(['invalid_request']),
      issues: arrayOf(objectSchema({
        path: stringSchema(),
        message: stringSchema()
      }, ['path', 'message']))
    }, ['error', 'issues']),
    HermesArtifact: hermesArtifact,
    HermesRunLifecycleEvent: hermesRunLifecycleEvent,
    HermesSkillSummary: hermesSkillSummary,
    HermesSkillRule: hermesSkillRule,
    HermesSkillOutputSchema: hermesSkillOutputSchema,
    HermesSkill: hermesSkill,
    HermesSkillPack: objectSchema({
      id: stringSchema(),
      title: stringSchema(),
      summary: stringSchema(),
      tagline: stringSchema(),
      version: stringSchema(),
      doctrine_rules: arrayOf(hermesSkillRule),
      expected_output_schema: hermesSkillOutputSchema,
      decision_state_mapping: objectSchema({
        trust: stringSchema(),
        caution: stringSchema(),
        do_not_use_yet: stringSchema(),
        unproven: stringSchema(),
        disputed: stringSchema()
      }),
      linked_infopunks_primitives: arrayOf(stringSchema()),
      skills: arrayOf(hermesSkill)
    }, ['id', 'title', 'summary', 'tagline', 'version', 'doctrine_rules', 'expected_output_schema', 'decision_state_mapping', 'linked_infopunks_primitives', 'skills']),
    HermesMemoryLoopStageState: enumSchema(['complete', 'ready', 'watch', 'blocked', 'missing']),
    HermesMemoryLoopStage: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      primitive: enumSchema([
        'hermes_run',
        'agent_run_receipt',
        'claim_candidate',
        'reviewed_claim',
        'reputation_entry',
        'pre_spend_decision',
        'decision_receipt',
        'spend_outcome',
        'reputation_feedback'
      ]),
      state: { $ref: '#/components/schemas/HermesMemoryLoopStageState' },
      title: stringSchema(),
      summary: stringSchema(),
      source_id: stringSchema(),
      decision: stringSchema(),
      confidence: { type: 'number' },
      evidence_count: integerSchema(),
      target_type: stringSchema(),
      target_id: stringSchema(),
      metadata: freeformObject()
    }, ['id', 'label', 'primitive', 'state', 'title', 'summary']),
    HermesMemoryLoopEdge: objectSchema({
      from: stringSchema(),
      to: stringSchema(),
      label: stringSchema(),
      summary: stringSchema()
    }, ['from', 'to', 'label', 'summary']),
    HermesMemoryLoopSignal: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      value: { oneOf: [stringSchema(), { type: 'number' }] },
      summary: stringSchema()
    }, ['id', 'label', 'value', 'summary']),
    HermesMemoryLoop: objectSchema({
      id: stringSchema(),
      title: stringSchema(),
      thesis: stringSchema(),
      generated_at: dateTimeSchema(),
      source_run_id: stringSchema(),
      stages: arrayOf({ $ref: '#/components/schemas/HermesMemoryLoopStage' }),
      edges: arrayOf({ $ref: '#/components/schemas/HermesMemoryLoopEdge' }),
      signals: arrayOf({ $ref: '#/components/schemas/HermesMemoryLoopSignal' }),
      summary: objectSchema({
        stage_count: integerSchema(),
        complete_count: integerSchema(),
        watch_count: integerSchema(),
        blocked_count: integerSchema(),
        missing_count: integerSchema(),
        current_decision: stringSchema(),
        current_required_action: stringSchema(),
        reputation_state: stringSchema(),
        feedback_direction: stringSchema()
      }, ['stage_count', 'complete_count', 'watch_count', 'blocked_count', 'missing_count'])
    }, ['id', 'title', 'thesis', 'generated_at', 'source_run_id', 'stages', 'edges', 'signals', 'summary']),
    HermesMemoryLoopSummary: objectSchema({
      generated_at: dateTimeSchema(),
      loop_count: integerSchema(),
      loops: arrayOf({ $ref: '#/components/schemas/HermesMemoryLoop' })
    }, ['generated_at', 'loop_count', 'loops']),
    HermesWalletAuditEventKind: enumSchema(['spend_intent', 'pre_spend_decision', 'decision_receipt', 'policy_check', 'policy_receipt', 'wallet_outcome', 'reconciliation', 'feedback']),
    HermesWalletAuditEventState: enumSchema(['recorded', 'allowed', 'test_required', 'manual_review_required', 'blocked', 'compliant', 'partially_compliant', 'non_compliant', 'needs_review', 'unknown']),
    HermesWalletAuditReference: objectSchema({
      kind: enumSchema(['decision', 'decision_receipt', 'policy_check', 'policy_receipt', 'outcome', 'reconciliation', 'reputation', 'receipt', 'claim', 'run']),
      id: stringSchema(),
      summary: stringSchema()
    }, ['kind', 'id', 'summary']),
    HermesWalletAuditEvent: objectSchema({
      id: stringSchema(),
      at: dateTimeSchema(),
      kind: { $ref: '#/components/schemas/HermesWalletAuditEventKind' },
      state: { $ref: '#/components/schemas/HermesWalletAuditEventState' },
      title: stringSchema(),
      summary: stringSchema(),
      actor: enumSchema(['agent', 'infopunks', 'policy_engine', 'wallet', 'reconciliation_engine']),
      source_id: stringSchema(),
      decision: stringSchema(),
      required_action: stringSchema(),
      compliance_state: stringSchema(),
      amount_usd: { type: 'number', minimum: 0 },
      chain: stringSchema(),
      payment_rail: stringSchema(),
      provider_id: stringSchema(),
      route_id: stringSchema(),
      service_id: stringSchema(),
      references: arrayOf({ $ref: '#/components/schemas/HermesWalletAuditReference' }),
      metadata: freeformObject()
    }, ['id', 'at', 'kind', 'state', 'title', 'summary', 'actor', 'references']),
    HermesWalletAuditSignal: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      value: { oneOf: [stringSchema(), { type: 'number' }, booleanSchema()] },
      summary: stringSchema()
    }, ['id', 'label', 'value', 'summary']),
    HermesWalletAuditRiskPosture: objectSchema({
      level: enumSchema(['low', 'medium', 'high', 'critical']),
      summary: stringSchema(),
      reasons: arrayOf(stringSchema())
    }, ['level', 'summary', 'reasons']),
    HermesWalletAuditTrail: objectSchema({
      id: stringSchema(),
      title: stringSchema(),
      generated_at: dateTimeSchema(),
      thesis: stringSchema(),
      source_check_id: stringSchema(),
      source_decision_id: stringSchema(),
      events: arrayOf({ $ref: '#/components/schemas/HermesWalletAuditEvent' }),
      signals: arrayOf({ $ref: '#/components/schemas/HermesWalletAuditSignal' }),
      risk_posture: { $ref: '#/components/schemas/HermesWalletAuditRiskPosture' },
      summary: objectSchema({
        event_count: integerSchema(),
        recorded_count: integerSchema(),
        allowed_count: integerSchema(),
        blocked_count: integerSchema(),
        compliant_count: integerSchema(),
        non_compliant_count: integerSchema(),
        needs_review_count: integerSchema(),
        final_compliance_state: stringSchema(),
        final_feedback_direction: stringSchema(),
        next_policy_action: stringSchema()
      }, ['event_count', 'recorded_count', 'allowed_count', 'blocked_count', 'compliant_count', 'non_compliant_count', 'needs_review_count'])
    }, ['id', 'title', 'generated_at', 'thesis', 'source_check_id', 'source_decision_id', 'events', 'signals', 'risk_posture', 'summary']),
    HermesWalletAuditSummary: objectSchema({
      generated_at: dateTimeSchema(),
      trail_count: integerSchema(),
      trails: arrayOf({ $ref: '#/components/schemas/HermesWalletAuditTrail' })
    }, ['generated_at', 'trail_count', 'trails']),
    HermesWalletSafetyRating: enumSchema(['safe', 'watch', 'risky', 'blocked', 'unknown']),
    HermesWalletRequiredNextAction: enumSchema(['none', 'run_test_spend', 'manual_review_required', 'tighten_policy', 'block_provider', 'request_more_evidence', 'pause_wallet']),
    HermesWalletRiskFactor: objectSchema({
      id: stringSchema(),
      severity: enumSchema(['low', 'medium', 'high', 'critical']),
      label: stringSchema(),
      detail: stringSchema(),
      source: enumSchema(['audit_trail', 'policy', 'reconciliation', 'pre_spend_decision', 'reputation', 'outcome', 'unknown'])
    }, ['id', 'severity', 'label', 'detail', 'source']),
    HermesWalletPositiveControl: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      detail: stringSchema(),
      source: enumSchema(['audit_trail', 'policy', 'reconciliation', 'pre_spend_decision', 'reputation', 'outcome'])
    }, ['id', 'label', 'detail', 'source']),
    HermesWalletRiskScoreInput: objectSchema({
      trail_id: stringSchema()
    }),
    HermesWalletRiskScore: objectSchema({
      id: stringSchema(),
      source_trail_id: stringSchema(),
      generated_at: dateTimeSchema(),
      risk_score: integerSchema(),
      safety_rating: { $ref: '#/components/schemas/HermesWalletSafetyRating' },
      required_next_action: { $ref: '#/components/schemas/HermesWalletRequiredNextAction' },
      summary: stringSchema(),
      top_risks: arrayOf({ $ref: '#/components/schemas/HermesWalletRiskFactor' }),
      positive_controls: arrayOf({ $ref: '#/components/schemas/HermesWalletPositiveControl' }),
      score_breakdown: objectSchema({
        base_score: integerSchema(),
        audit_posture_adjustment: integerSchema(),
        compliance_adjustment: integerSchema(),
        policy_adjustment: integerSchema(),
        outcome_adjustment: integerSchema(),
        feedback_adjustment: integerSchema(),
        evidence_adjustment: integerSchema(),
        final_score: integerSchema()
      }, ['base_score', 'audit_posture_adjustment', 'compliance_adjustment', 'policy_adjustment', 'outcome_adjustment', 'feedback_adjustment', 'evidence_adjustment', 'final_score']),
      inputs: objectSchema({
        trail_id: stringSchema(),
        event_count: integerSchema(),
        risk_posture_level: stringSchema(),
        policy_decision: stringSchema(),
        compliance_state: stringSchema(),
        next_policy_action: stringSchema(),
        feedback_direction: stringSchema()
      }, ['trail_id', 'event_count'])
    }, ['id', 'source_trail_id', 'generated_at', 'risk_score', 'safety_rating', 'required_next_action', 'summary', 'top_risks', 'positive_controls', 'score_breakdown', 'inputs']),
    HermesWalletRiskScoreSummary: objectSchema({
      generated_at: dateTimeSchema(),
      score_count: integerSchema(),
      scores: arrayOf({ $ref: '#/components/schemas/HermesWalletRiskScore' })
    }, ['generated_at', 'score_count', 'scores']),
    HermesWalletSafetyDecision: enumSchema(['safe_to_spend', 'test_spend_required', 'manual_review_required', 'block_spend', 'insufficient_evidence']),
    HermesWalletSafetyReference: objectSchema({
      kind: enumSchema(['pre_spend_decision', 'spend_policy_check', 'policy_receipt', 'reconciliation', 'wallet_audit_trail', 'wallet_risk_score', 'receipt', 'claim', 'run', 'reputation']),
      id: stringSchema(),
      summary: stringSchema()
    }, ['kind', 'id', 'summary']),
    HermesWalletSafetyCheckInput: objectSchema({
      route_id: stringSchema(),
      provider_id: stringSchema(),
      service_id: stringSchema(),
      amount_usd: { type: 'number', minimum: 0 },
      payment_rail: stringSchema(),
      chain: stringSchema(),
      agent_type: stringSchema(),
      objective: stringSchema(),
      policy_id: stringSchema()
    }),
    HermesWalletFinalRecommendation: objectSchema({
      decision: { $ref: '#/components/schemas/HermesWalletSafetyDecision' },
      allowed: booleanSchema(),
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      reason: stringSchema(),
      required_action: enumSchema(['none', 'run_test_spend', 'manual_review_required', 'block_spend', 'request_more_evidence', 'pause_wallet']),
      safety_rating: { $ref: '#/components/schemas/HermesWalletSafetyRating' },
      risk_score: integerSchema(),
      top_risks: arrayOf(freeformObject()),
      positive_controls: arrayOf(freeformObject()),
      references: arrayOf({ $ref: '#/components/schemas/HermesWalletSafetyReference' })
    }, ['decision', 'allowed', 'confidence', 'reason', 'required_action', 'safety_rating', 'risk_score', 'top_risks', 'positive_controls', 'references']),
    HermesWalletSafetyCheckResult: objectSchema({
      id: stringSchema(),
      generated_at: dateTimeSchema(),
      input: { $ref: '#/components/schemas/HermesWalletSafetyCheckInput' },
      pre_spend_decision: { $ref: '#/components/schemas/HermesPreSpendDecision' },
      spend_policy_check: { $ref: '#/components/schemas/HermesSpendPolicyCheckResult' },
      policy_receipt: { $ref: '#/components/schemas/HermesPolicyDecisionReceiptConversion' },
      reconciliation_preview: { $ref: '#/components/schemas/HermesPolicyReconciliationResult' },
      wallet_audit_trail: { $ref: '#/components/schemas/HermesWalletAuditTrail' },
      wallet_risk_score: { $ref: '#/components/schemas/HermesWalletRiskScore' },
      final_recommendation: { $ref: '#/components/schemas/HermesWalletFinalRecommendation' },
      summary: objectSchema({
        decision: { $ref: '#/components/schemas/HermesWalletSafetyDecision' },
        allowed: booleanSchema(),
        required_action: stringSchema(),
        safety_rating: stringSchema(),
        risk_score: integerSchema(),
        policy_decision: stringSchema(),
        compliance_state: stringSchema(),
        audit_event_count: integerSchema(),
        top_risk_count: integerSchema(),
        positive_control_count: integerSchema()
      }, ['decision', 'allowed', 'required_action', 'safety_rating', 'risk_score', 'top_risk_count', 'positive_control_count'])
    }, ['id', 'generated_at', 'input', 'pre_spend_decision', 'spend_policy_check', 'policy_receipt', 'reconciliation_preview', 'wallet_audit_trail', 'wallet_risk_score', 'final_recommendation', 'summary']),
    HermesWalletSafetyBundleSummary: objectSchema({
      generated_at: dateTimeSchema(),
      bundle_count: integerSchema(),
      bundles: arrayOf({ $ref: '#/components/schemas/HermesWalletSafetyCheckResult' })
    }, ['generated_at', 'bundle_count', 'bundles']),
    HermesRunReceipt: hermesRunReceipt,
    HermesClaimCandidate: hermesClaimCandidate,
    HermesClaimReviewState: hermesClaimReviewState,
    HermesReputationTargetType: hermesReputationTargetType,
    HermesReputationState: hermesReputationState,
    HermesReputationDirection: hermesReputationDirection,
    HermesReputationImpact: hermesReputationImpact,
    HermesReputationLedgerEvent: hermesReputationLedgerEvent,
    HermesReputationLedgerEntry: hermesReputationLedgerEntry,
    HermesReputationLedgerSummary: objectSchema({
      generated_at: dateTimeSchema(),
      entry_count: integerSchema(),
      provider_count: integerSchema(),
      route_count: integerSchema(),
      service_count: integerSchema(),
      unknown_count: integerSchema(),
      trusted_count: integerSchema(),
      watchlist_count: integerSchema(),
      degraded_count: integerSchema(),
      disputed_count: integerSchema(),
      entries: arrayOf(hermesReputationLedgerEntry)
    }, ['generated_at', 'entry_count', 'provider_count', 'route_count', 'service_count', 'unknown_count', 'trusted_count', 'watchlist_count', 'degraded_count', 'disputed_count', 'entries']),
    HermesPreSpendDecisionState: enumSchema(['proceed', 'proceed_with_caution', 'test_spend_first', 'do_not_spend', 'insufficient_evidence']),
    HermesPreSpendRequiredAction: enumSchema(['none', 'run_small_test_spend', 'request_more_evidence', 'use_fallback_route', 'do_not_use_provider', 'manual_review_required']),
    HermesPreSpendRiskFactor: objectSchema({
      id: stringSchema(),
      severity: enumSchema(['low', 'medium', 'high']),
      label: stringSchema(),
      detail: stringSchema(),
      source: enumSchema(['provider_reputation', 'route_reputation', 'service_reputation', 'amount', 'evidence', 'unknown'])
    }, ['id', 'severity', 'label', 'detail', 'source']),
    HermesPreSpendDecisionInputReference: objectSchema({
      kind: enumSchema(['reputation_entry', 'receipt', 'claim', 'run']),
      id: stringSchema(),
      target_type: stringSchema(),
      target_id: stringSchema(),
      summary: stringSchema()
    }, ['kind', 'id', 'summary']),
    HermesPreSpendDecisionInput: objectSchema({
      route_id: stringSchema(),
      provider_id: stringSchema(),
      service_id: stringSchema(),
      amount_usd: { type: 'number', minimum: 0 },
      payment_rail: stringSchema(),
      chain: stringSchema(),
      agent_type: stringSchema(),
      objective: stringSchema()
    }),
    HermesSpendPolicyDecision: enumSchema(['allow', 'allow_with_test_spend', 'require_manual_review', 'block']),
    HermesSpendPolicy: objectSchema({
      id: stringSchema(),
      title: stringSchema(),
      summary: stringSchema(),
      max_amount_usd: { type: 'number', minimum: 0 },
      allowed_chains: arrayOf(stringSchema()),
      allowed_payment_rails: arrayOf(stringSchema()),
      blocked_providers: arrayOf(stringSchema()),
      require_test_spend_for_watchlist: booleanSchema(),
      manual_review_threshold_usd: { type: 'number', minimum: 0 },
      do_not_spend_on_disputed: booleanSchema(),
      created_at: dateTimeSchema()
    }, ['id', 'title', 'summary', 'max_amount_usd', 'allowed_chains', 'allowed_payment_rails', 'blocked_providers', 'require_test_spend_for_watchlist', 'manual_review_threshold_usd', 'do_not_spend_on_disputed', 'created_at']),
    HermesSpendPolicyCheckInput: objectSchema({
      route_id: stringSchema(),
      provider_id: stringSchema(),
      service_id: stringSchema(),
      amount_usd: { type: 'number', minimum: 0 },
      payment_rail: stringSchema(),
      chain: stringSchema(),
      agent_type: stringSchema(),
      objective: stringSchema(),
      policy_id: stringSchema()
    }),
    HermesSpendPolicyRule: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      description: stringSchema(),
      severity: enumSchema(['low', 'medium', 'high', 'critical'])
    }, ['id', 'label', 'description', 'severity']),
    HermesSpendPolicyViolation: objectSchema({
      id: stringSchema(),
      rule_id: stringSchema(),
      severity: enumSchema(['low', 'medium', 'high', 'critical']),
      label: stringSchema(),
      detail: stringSchema(),
      outcome: enumSchema(['warn', 'test_spend_required', 'manual_review_required', 'blocked'])
    }, ['id', 'rule_id', 'severity', 'label', 'detail', 'outcome']),
    HermesSpendPolicyReference: objectSchema({
      kind: enumSchema(['pre_spend_decision', 'reputation_entry', 'policy', 'receipt', 'claim', 'run']),
      id: stringSchema(),
      summary: stringSchema()
    }, ['kind', 'id', 'summary']),
    HermesPreSpendDecision: objectSchema({
      id: stringSchema(),
      input: { $ref: '#/components/schemas/HermesPreSpendDecisionInput' },
      decision: { $ref: '#/components/schemas/HermesPreSpendDecisionState' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      reason: stringSchema(),
      required_action: { $ref: '#/components/schemas/HermesPreSpendRequiredAction' },
      risk_factors: arrayOf({ $ref: '#/components/schemas/HermesPreSpendRiskFactor' }),
      reputation_inputs: arrayOf({ $ref: '#/components/schemas/HermesPreSpendDecisionInputReference' }),
      receipt_inputs: arrayOf({ $ref: '#/components/schemas/HermesPreSpendDecisionInputReference' }),
      claim_inputs: arrayOf({ $ref: '#/components/schemas/HermesPreSpendDecisionInputReference' }),
      run_inputs: arrayOf({ $ref: '#/components/schemas/HermesPreSpendDecisionInputReference' }),
      ledger_state: objectSchema({
        provider_state: stringSchema(),
        route_state: stringSchema(),
        service_state: stringSchema(),
        provider_score: integerSchema(),
        route_score: integerSchema(),
        service_score: integerSchema()
      }),
      generated_at: dateTimeSchema()
    }, ['id', 'input', 'decision', 'confidence', 'reason', 'required_action', 'risk_factors', 'reputation_inputs', 'receipt_inputs', 'claim_inputs', 'run_inputs', 'ledger_state', 'generated_at']),
    HermesSpendPolicyCheckResult: objectSchema({
      id: stringSchema(),
      policy: { $ref: '#/components/schemas/HermesSpendPolicy' },
      input: { $ref: '#/components/schemas/HermesSpendPolicyCheckInput' },
      decision: { $ref: '#/components/schemas/HermesSpendPolicyDecision' },
      allowed: booleanSchema(),
      reason: stringSchema(),
      required_action: enumSchema(['none', 'run_small_test_spend', 'manual_review_required', 'use_fallback_route', 'do_not_spend']),
      violations: arrayOf({ $ref: '#/components/schemas/HermesSpendPolicyViolation' }),
      warnings: arrayOf({ $ref: '#/components/schemas/HermesSpendPolicyViolation' }),
      pre_spend_decision: { $ref: '#/components/schemas/HermesPreSpendDecision' },
      references: arrayOf({ $ref: '#/components/schemas/HermesSpendPolicyReference' }),
      generated_at: dateTimeSchema()
    }, ['id', 'policy', 'input', 'decision', 'allowed', 'reason', 'required_action', 'violations', 'warnings', 'pre_spend_decision', 'references', 'generated_at']),
    HermesPolicyAuditTrailEvent: objectSchema({
      id: stringSchema(),
      at: dateTimeSchema(),
      label: stringSchema(),
      state: enumSchema(['policy_loaded', 'spend_intent_received', 'pre_spend_decision_checked', 'rules_evaluated', 'policy_decision_made', 'receipt_created']),
      summary: stringSchema()
    }, ['id', 'at', 'label', 'state', 'summary']),
    HermesPolicyAuditTrail: objectSchema({
      id: stringSchema(),
      source_check_id: stringSchema(),
      events: arrayOf({ $ref: '#/components/schemas/HermesPolicyAuditTrailEvent' })
    }, ['id', 'source_check_id', 'events']),
    HermesPolicyReceiptRiskSummary: objectSchema({
      risk_level: enumSchema(['low', 'medium', 'high', 'critical']),
      violation_count: integerSchema(),
      warning_count: integerSchema(),
      critical_count: integerSchema(),
      high_count: integerSchema(),
      summary: stringSchema()
    }, ['risk_level', 'violation_count', 'warning_count', 'critical_count', 'high_count', 'summary']),
    HermesPolicyDecisionReceipt: objectSchema({
      id: stringSchema(),
      source: { const: 'spend_policy_check' },
      source_check_id: stringSchema(),
      source_policy_id: stringSchema(),
      title: stringSchema(),
      summary: stringSchema(),
      receipt_kind: { const: 'spend_policy_decision_receipt' },
      policy_decision: { $ref: '#/components/schemas/HermesSpendPolicyDecision' },
      allowed: booleanSchema(),
      required_action: stringSchema(),
      reason: stringSchema(),
      input: { $ref: '#/components/schemas/HermesSpendPolicyCheckInput' },
      policy_snapshot: objectSchema({
        id: stringSchema(),
        title: stringSchema(),
        max_amount_usd: { type: 'number', minimum: 0 },
        allowed_chains: arrayOf(stringSchema()),
        allowed_payment_rails: arrayOf(stringSchema()),
        blocked_providers: arrayOf(stringSchema()),
        require_test_spend_for_watchlist: booleanSchema(),
        manual_review_threshold_usd: { type: 'number', minimum: 0 },
        do_not_spend_on_disputed: booleanSchema()
      }, ['id', 'title', 'max_amount_usd', 'allowed_chains', 'allowed_payment_rails', 'blocked_providers', 'require_test_spend_for_watchlist', 'manual_review_threshold_usd', 'do_not_spend_on_disputed']),
      violations: arrayOf({ $ref: '#/components/schemas/HermesSpendPolicyViolation' }),
      warnings: arrayOf({ $ref: '#/components/schemas/HermesSpendPolicyViolation' }),
      pre_spend_decision_id: stringSchema(),
      references: arrayOf({ $ref: '#/components/schemas/HermesSpendPolicyReference' }),
      audit_trail: { $ref: '#/components/schemas/HermesPolicyAuditTrail' },
      risk_summary: { $ref: '#/components/schemas/HermesPolicyReceiptRiskSummary' },
      created_at: dateTimeSchema()
    }, ['id', 'source', 'source_check_id', 'source_policy_id', 'title', 'summary', 'receipt_kind', 'policy_decision', 'allowed', 'required_action', 'reason', 'input', 'policy_snapshot', 'violations', 'warnings', 'references', 'audit_trail', 'risk_summary', 'created_at']),
    HermesPolicyDecisionReceiptConversion: objectSchema({
      check_id: stringSchema(),
      receipt: { $ref: '#/components/schemas/HermesPolicyDecisionReceipt' },
      conversion: objectSchema({
        status: enumSchema(['converted', 'already_converted', 'failed']),
        notes: arrayOf(stringSchema())
      }, ['status', 'notes'])
    }, ['check_id', 'receipt', 'conversion']),
    HermesPolicyOutcomeState: enumSchema(['spent', 'test_spend_completed', 'blocked_as_required', 'manual_review_completed', 'manual_review_missing', 'spend_attempt_blocked', 'spent_despite_block', 'failed', 'unknown']),
    HermesPolicyComplianceState: enumSchema(['compliant', 'partially_compliant', 'non_compliant', 'needs_review', 'unknown']),
    HermesPolicyOutcome: objectSchema({
      id: stringSchema(),
      source_check_id: stringSchema(),
      source_policy_receipt_id: stringSchema(),
      outcome_state: { $ref: '#/components/schemas/HermesPolicyOutcomeState' },
      outcome_summary: stringSchema(),
      spend_happened: booleanSchema(),
      amount_usd: { type: 'number', minimum: 0 },
      chain: stringSchema(),
      payment_rail: stringSchema(),
      provider_id: stringSchema(),
      route_id: stringSchema(),
      service_id: stringSchema(),
      observed_latency_ms: integerSchema(),
      error_code: stringSchema(),
      evidence_artifacts: arrayOf(objectSchema({
        id: stringSchema(),
        label: stringSchema(),
        kind: enumSchema(['url', 'api_response', 'log', 'screenshot', 'note', 'receipt']),
        uri: stringSchema(),
        summary: stringSchema()
      }, ['id', 'label', 'kind', 'uri', 'summary'])),
      created_at: dateTimeSchema()
    }, ['id', 'source_check_id', 'source_policy_receipt_id', 'outcome_state', 'outcome_summary', 'spend_happened', 'evidence_artifacts', 'created_at']),
    HermesPolicyReconciliationFinding: objectSchema({
      id: stringSchema(),
      severity: enumSchema(['low', 'medium', 'high', 'critical']),
      label: stringSchema(),
      detail: stringSchema(),
      expected: stringSchema(),
      observed: stringSchema()
    }, ['id', 'severity', 'label', 'detail', 'expected', 'observed']),
    HermesPolicyReconciliationImpact: objectSchema({
      target_type: enumSchema(['provider', 'route', 'service', 'policy', 'unknown']),
      target_id: stringSchema(),
      direction: enumSchema(['positive', 'negative', 'neutral', 'watch']),
      magnitude: { type: 'number', minimum: 0, maximum: 1 },
      summary: stringSchema(),
      reputation_notes: arrayOf(stringSchema())
    }, ['target_type', 'direction', 'magnitude', 'summary', 'reputation_notes']),
    HermesPolicyReconciliationFeedback: objectSchema({
      status: enumSchema(['recorded', 'preview', 'failed']),
      notes: arrayOf(stringSchema()),
      next_policy_action: enumSchema(['none', 'tighten_policy', 'loosen_policy', 'require_manual_review', 'block_provider', 'request_more_evidence'])
    }, ['status', 'notes', 'next_policy_action']),
    HermesPolicyReconciliationResult: objectSchema({
      check_id: stringSchema(),
      policy_receipt_id: stringSchema(),
      outcome: { $ref: '#/components/schemas/HermesPolicyOutcome' },
      compliance_state: { $ref: '#/components/schemas/HermesPolicyComplianceState' },
      findings: arrayOf({ $ref: '#/components/schemas/HermesPolicyReconciliationFinding' }),
      feedback: { $ref: '#/components/schemas/HermesPolicyReconciliationFeedback' },
      impact: { $ref: '#/components/schemas/HermesPolicyReconciliationImpact' },
      summary: stringSchema(),
      generated_at: dateTimeSchema()
    }, ['check_id', 'policy_receipt_id', 'outcome', 'compliance_state', 'findings', 'feedback', 'impact', 'summary', 'generated_at']),
    HermesDecisionOutcomeState: enumSchema(['successful', 'failed', 'partial', 'blocked', 'manual_review', 'unknown']),
    HermesDecisionOutcomeImpact: objectSchema({
      target_type: enumSchema(['provider', 'route', 'service', 'unknown']),
      target_id: stringSchema(),
      direction: enumSchema(['positive', 'negative', 'neutral', 'watch']),
      magnitude: { type: 'number', minimum: 0, maximum: 1 },
      summary: stringSchema(),
      reputation_notes: arrayOf(stringSchema())
    }, ['target_type', 'direction', 'magnitude', 'summary', 'reputation_notes']),
    HermesDecisionReceipt: objectSchema({
      id: stringSchema(),
      source: { const: 'pre_spend_decision' },
      source_decision_id: stringSchema(),
      title: stringSchema(),
      summary: stringSchema(),
      decision: { $ref: '#/components/schemas/HermesPreSpendDecisionState' },
      required_action: stringSchema(),
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      input: { $ref: '#/components/schemas/HermesPreSpendDecisionInput' },
      risk_factors: arrayOf({ $ref: '#/components/schemas/HermesPreSpendRiskFactor' }),
      reputation_inputs: arrayOf({ $ref: '#/components/schemas/HermesPreSpendDecisionInputReference' }),
      receipt_inputs: arrayOf({ $ref: '#/components/schemas/HermesPreSpendDecisionInputReference' }),
      claim_inputs: arrayOf({ $ref: '#/components/schemas/HermesPreSpendDecisionInputReference' }),
      run_inputs: arrayOf({ $ref: '#/components/schemas/HermesPreSpendDecisionInputReference' }),
      receipt_kind: { const: 'pre_spend_decision_receipt' },
      created_at: dateTimeSchema()
    }, ['id', 'source', 'source_decision_id', 'title', 'summary', 'decision', 'required_action', 'confidence', 'input', 'risk_factors', 'reputation_inputs', 'receipt_inputs', 'claim_inputs', 'run_inputs', 'receipt_kind', 'created_at']),
    HermesDecisionOutcome: objectSchema({
      id: stringSchema(),
      source_decision_id: stringSchema(),
      source_decision_receipt_id: stringSchema(),
      outcome_state: { $ref: '#/components/schemas/HermesDecisionOutcomeState' },
      outcome_summary: stringSchema(),
      spend_happened: booleanSchema(),
      amount_usd: { type: 'number', minimum: 0 },
      observed_latency_ms: integerSchema(),
      error_code: stringSchema(),
      evidence_artifacts: arrayOf(objectSchema({
        id: stringSchema(),
        label: stringSchema(),
        kind: enumSchema(['url', 'api_response', 'log', 'screenshot', 'note', 'receipt']),
        uri: stringSchema(),
        summary: stringSchema()
      }, ['id', 'label', 'kind', 'uri', 'summary'])),
      impact: { $ref: '#/components/schemas/HermesDecisionOutcomeImpact' },
      created_at: dateTimeSchema()
    }, ['id', 'source_decision_id', 'source_decision_receipt_id', 'outcome_state', 'outcome_summary', 'spend_happened', 'evidence_artifacts', 'impact', 'created_at']),
    HermesDecisionReceiptConversion: objectSchema({
      decision_id: stringSchema(),
      receipt: { $ref: '#/components/schemas/HermesDecisionReceipt' },
      conversion: objectSchema({
        status: enumSchema(['converted', 'already_converted', 'failed']),
        notes: arrayOf(stringSchema())
      }, ['status', 'notes'])
    }, ['decision_id', 'receipt', 'conversion']),
    HermesDecisionFeedbackResult: objectSchema({
      decision_id: stringSchema(),
      receipt: { $ref: '#/components/schemas/HermesDecisionReceipt' },
      outcome: { $ref: '#/components/schemas/HermesDecisionOutcome' },
      feedback: objectSchema({
        status: enumSchema(['recorded', 'preview', 'failed']),
        notes: arrayOf(stringSchema())
      }, ['status', 'notes']),
      reputation_feedback: { $ref: '#/components/schemas/HermesDecisionOutcomeImpact' }
    }, ['decision_id', 'receipt', 'outcome', 'feedback', 'reputation_feedback']),
    WalletSafetyIntegrationReadinessState: enumSchema(['ready', 'testing', 'needs_receipts', 'watch', 'not_ready']),
    WalletSafetyIntegrationRequirementStatus: enumSchema(['passed', 'missing', 'watch', 'not_applicable']),
    WalletSafetyIntegrationProofItemSource: enumSchema(['profile', 'receipt_pattern', 'policy', 'registry', 'manual']),
    WalletSafetyIntegrationProfile: objectSchema({
      integration_id: stringSchema(),
      name: stringSchema(),
      summary: stringSchema(),
      agent_type: enumSchema(['agent_wallet', 'route_guard', 'service_router', 'research_agent', 'payment_app', 'unknown']),
      supported_chains: arrayOf(stringSchema()),
      supported_payment_rails: arrayOf(stringSchema()),
      uses_wallet_safety_check: booleanSchema(),
      writes_integration_receipts: booleanSchema(),
      fail_closed_behavior: booleanSchema(),
      last_verified_at: dateTimeSchema(),
      readiness_state: { $ref: '#/components/schemas/WalletSafetyIntegrationReadinessState' },
      readiness_notes: arrayOf(stringSchema()),
      linked_routes: arrayOf(stringSchema()),
      linked_providers: arrayOf(stringSchema()),
      linked_services: arrayOf(stringSchema()),
      example_receipt_fields: arrayOf(stringSchema())
    }, ['integration_id', 'name', 'summary', 'agent_type', 'supported_chains', 'supported_payment_rails', 'uses_wallet_safety_check', 'writes_integration_receipts', 'fail_closed_behavior', 'last_verified_at', 'readiness_state', 'readiness_notes', 'example_receipt_fields']),
    WalletSafetyIntegrationRequirement: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      status: { $ref: '#/components/schemas/WalletSafetyIntegrationRequirementStatus' },
      summary: stringSchema()
    }, ['id', 'label', 'status', 'summary']),
    WalletSafetyIntegrationProofItem: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      summary: stringSchema(),
      source: { $ref: '#/components/schemas/WalletSafetyIntegrationProofItemSource' }
    }, ['id', 'label', 'summary', 'source']),
    WalletSafetyIntegrationRegistrySummary: objectSchema({
      generated_at: dateTimeSchema(),
      integration_count: integerSchema(),
      ready_count: integerSchema(),
      testing_count: integerSchema(),
      needs_receipts_count: integerSchema(),
      watch_count: integerSchema(),
      not_ready_count: integerSchema(),
      integrations: arrayOf({ $ref: '#/components/schemas/WalletSafetyIntegrationProfile' })
    }, ['generated_at', 'integration_count', 'ready_count', 'testing_count', 'needs_receipts_count', 'watch_count', 'not_ready_count', 'integrations']),
    WalletSafetyIntegrationReadinessReport: objectSchema({
      integration_id: stringSchema(),
      generated_at: dateTimeSchema(),
      profile: { $ref: '#/components/schemas/WalletSafetyIntegrationProfile' },
      readiness_state: { $ref: '#/components/schemas/WalletSafetyIntegrationReadinessState' },
      readiness_score: integerSchema(),
      requirements: arrayOf({ $ref: '#/components/schemas/WalletSafetyIntegrationRequirement' }),
      proof_items: arrayOf({ $ref: '#/components/schemas/WalletSafetyIntegrationProofItem' }),
      missing_items: arrayOf({ $ref: '#/components/schemas/WalletSafetyIntegrationRequirement' }),
      next_steps: arrayOf(stringSchema())
    }, ['integration_id', 'generated_at', 'profile', 'readiness_state', 'readiness_score', 'requirements', 'proof_items', 'missing_items', 'next_steps']),
    HermesPromotedClaim: hermesPromotedClaim,
    HermesClaimPromotionRequest: objectSchema({
      review_state: hermesClaimReviewState
    }),
    HermesClaimPromotionResult: objectSchema({
      run_id: stringSchema(),
      promoted_claim: hermesPromotedClaim,
      review: objectSchema({
        state: hermesClaimReviewState,
        reviewer: { const: 'infopunks_mock_reviewer' },
        notes: arrayOf(stringSchema())
      }, ['state', 'reviewer', 'notes']),
      conversion: objectSchema({
        status: enumSchema(['promoted', 'already_promoted', 'failed']),
        notes: arrayOf(stringSchema())
      }, ['status', 'notes'])
    }, ['run_id', 'promoted_claim', 'review', 'conversion']),
    HermesRunReceiptConversion: objectSchema({
      run_id: stringSchema(),
      receipt: hermesRunReceipt,
      claim_candidate: hermesClaimCandidate,
      conversion: objectSchema({
        status: enumSchema(['converted', 'already_converted', 'failed']),
        notes: arrayOf(stringSchema())
      }, ['status', 'notes'])
    }, ['run_id', 'receipt', 'claim_candidate', 'conversion']),
    HermesRun: hermesRun,
    HermesDeskSummary: objectSchema({
      generated_at: dateTimeSchema(),
      title: { const: 'Hermes Desk' },
      route: { const: '/hermes' },
      narrative_route: { const: '/narratives/hermes-desk' },
      hero_copy: stringSchema(),
      explanation: stringSchema(),
      source: stringSchema(),
      sidecar: objectSchema({
        enabled: booleanSchema(),
        mode: enumSchema(['mock', 'http']),
        base_url_configured: booleanSchema(),
        api_key_configured: booleanSchema(),
        live_http_allowed: booleanSchema(),
        status: enumSchema(['mock_ready', 'http_configured', 'disabled'])
      }),
      counts: freeformObject(),
      skills: arrayOf(hermesSkillSummary),
      runs: arrayOf(hermesRun)
    }),
    HermesPreSpendRunRequest: objectSchema({
      route_id: stringSchema(),
      provider_id: stringSchema(),
      service_id: stringSchema(),
      spend_context: freeformObject()
    }, ['route_id', 'provider_id', 'service_id']),
    HermesHealth: objectSchema({
      enabled: booleanSchema(),
      mode: enumSchema(['mock', 'http']),
      status: enumSchema(['mock', 'online', 'offline', 'error']),
      base_url: stringSchema(),
      checked_at: dateTimeSchema(),
      latency_ms: integerSchema(),
      error: stringSchema(),
      capabilities: arrayOf(stringSchema())
    }, ['enabled', 'mode', 'status', 'checked_at']),
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
    LoopRun: objectSchema({
      run_id: stringSchema(),
      started_at: dateTimeSchema(),
      completed_at: dateTimeSchema(),
      hypothesis: stringSchema(),
      action_taken: stringSchema(),
      evidence_artifacts: arrayOf(stringSchema()),
      score: { type: 'number', minimum: 0, maximum: 100 },
      failure_reason: { oneOf: [stringSchema(), { type: 'null' }] },
      proof_state: enumSchema(['verified', 'partial', 'failure_recorded', 'memory_recorded', 'unproven', 'disputed']),
      decision_state: enumSchema(['trust', 'caution', 'do_not_use_yet', 'unproven', 'disputed']),
      linked_check_id: stringSchema()
    }),
    Loop: objectSchema({
      id: stringSchema(),
      name: stringSchema(),
      objective: stringSchema(),
      hypothesis: stringSchema(),
      action_taken: stringSchema(),
      evidence_artifacts: arrayOf(stringSchema()),
      score: { type: 'number', minimum: 0, maximum: 100 },
      failure_reason: { oneOf: [stringSchema(), { type: 'null' }] },
      proof_state: enumSchema(['verified', 'partial', 'failure_recorded', 'memory_recorded', 'unproven', 'disputed']),
      decision_state: enumSchema(['trust', 'caution', 'do_not_use_yet', 'unproven', 'disputed']),
      linked_check_id: stringSchema()
    }),
    LoopDetail: objectSchema({
      id: stringSchema(),
      name: stringSchema(),
      objective: stringSchema(),
      hypothesis: stringSchema(),
      action_taken: stringSchema(),
      evidence_artifacts: arrayOf(stringSchema()),
      score: { type: 'number', minimum: 0, maximum: 100 },
      failure_reason: { oneOf: [stringSchema(), { type: 'null' }] },
      proof_state: enumSchema(['verified', 'partial', 'failure_recorded', 'memory_recorded', 'unproven', 'disputed']),
      decision_state: enumSchema(['trust', 'caution', 'do_not_use_yet', 'unproven', 'disputed']),
      linked_check_id: stringSchema(),
      runs: arrayOf({ $ref: '#/components/schemas/LoopRun' })
    }),
    LoopCheckInput: objectSchema({
      input: stringSchema(),
      linked_check_id: { oneOf: [stringSchema(), { type: 'null' }] }
    }),
    UnicornRadarSector: enumSchema(['AI', 'AI / Agent Rails', 'RWA', 'DeFi', 'DePIN', 'Consumer', 'Consumer / Social / Attention Markets', 'Gaming / Consumer', 'Agent Rails', 'Payment Infrastructure', 'Social / Attention Markets', 'Tokenized Apps']),
    UnicornRadarStatus: enumSchema(['unseen_signal', 'watchlist', 'high_signal_lowcap', 'consensus_forming', 'do_not_touch_yet', 'infopunks_missed_it', 'paid_evaluation']),
    UnicornRadarVerdict: enumSchema(['high_signal_early', 'interesting_needs_receipts', 'real_product_weak_attention', 'strong_attention_weak_proof', 'do_not_touch_yet', 'consensus_already_forming', 'missed_by_infopunks']),
    UnicornRadarScores: objectSchema({
      shipping_proof: integerSchema(),
      attention_quality: integerSchema(),
      token_survivability: integerSchema(),
      category_timing: integerSchema(),
      asymmetry_potential: integerSchema(),
      overall_signal_score: integerSchema(),
      risk_score: integerSchema()
    }, ['shipping_proof', 'attention_quality', 'token_survivability', 'category_timing', 'asymmetry_potential', 'overall_signal_score', 'risk_score']),
    UnicornRadarReceipt: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      type: enumSchema(['shipping', 'attention', 'token', 'risk', 'market', 'payment', 'note', 'LIVE_GAME_ROUTE']),
      source: stringSchema(),
      url: stringSchema(),
      note: stringSchema(),
      observed_at: dateTimeSchema()
    }, ['id', 'label', 'type', 'source', 'note', 'observed_at']),
    UnicornRadarHunterCredit: objectSchema({
      handle: stringSchema(),
      attribution: stringSchema(),
      submitted_at: dateTimeSchema(),
      source: enumSchema(['desk_seeded_sample', 'community', 'project', 'partner'])
    }, ['handle', 'attribution', 'submitted_at', 'source']),
    UnicornRadarPaidEvaluationDisclosure: objectSchema({
      is_paid: { type: 'boolean' },
      label: stringSchema(),
      note: stringSchema(),
      paid_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      receipt_id: { oneOf: [stringSchema(), { type: 'null' }] }
    }, ['is_paid', 'label', 'note']),
    UnicornRadarDexScreenerData: objectSchema({
      priceUsd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      marketCap: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      fdv: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      liquidityUsd: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      volume24h: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      txns24hBuys: { oneOf: [integerSchema(), { type: 'null' }] },
      txns24hSells: { oneOf: [integerSchema(), { type: 'null' }] },
      priceChange1h: { oneOf: [{ type: 'number' }, { type: 'null' }] },
      priceChange6h: { oneOf: [{ type: 'number' }, { type: 'null' }] },
      priceChange24h: { oneOf: [{ type: 'number' }, { type: 'null' }] },
      pairCreatedAt: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      dexId: { oneOf: [stringSchema(), { type: 'null' }] },
      boosts: { oneOf: [integerSchema(), { type: 'null' }] },
      paidOrders: { oneOf: [integerSchema(), { type: 'null' }] },
      rawUrl: { oneOf: [stringSchema(), { type: 'null' }] }
    }),
    UnicornRadarCandidate: objectSchema({
      id: stringSchema(),
      project: stringSchema(),
      ticker: stringSchema(),
      sector: { $ref: '#/components/schemas/UnicornRadarSector' },
      market_cap_range: stringSchema(),
      thesis: stringSchema(),
      displayVerdict: stringSchema(),
      what_it_actually_does: stringSchema(),
      proof_of_shipping: stringSchema(),
      attention_quality_note: stringSchema(),
      token_survivability_note: stringSchema(),
      risk_flags: arrayOf(stringSchema()),
      tags: arrayOf(stringSchema()),
      why_now: stringSchema(),
      receipts: arrayOf({ $ref: '#/components/schemas/UnicornRadarReceipt' }),
      linked_narratives: arrayOf(objectSchema({ label: stringSchema(), href: stringSchema() }, ['label', 'href'])),
      linked_graph_node: objectSchema({ id: stringSchema(), label: stringSchema(), href: stringSchema() }, ['id', 'label', 'href']),
      chainId: stringSchema(),
      tokenAddress: stringSchema(),
      pairAddress: stringSchema(),
      dexScreenerUrl: stringSchema(),
      marketDataSource: stringSchema(),
      marketDataUpdatedAt: dateTimeSchema(),
      dexScreenerData: { $ref: '#/components/schemas/UnicornRadarDexScreenerData' },
      hunter_credit: { $ref: '#/components/schemas/UnicornRadarHunterCredit' },
      paid_evaluation_disclosure: { $ref: '#/components/schemas/UnicornRadarPaidEvaluationDisclosure' },
      status: { $ref: '#/components/schemas/UnicornRadarStatus' },
      verdict: { $ref: '#/components/schemas/UnicornRadarVerdict' },
      scores: { $ref: '#/components/schemas/UnicornRadarScores' },
      updated_at: dateTimeSchema(),
      sample_disclosure: stringSchema()
    }, ['id', 'project', 'ticker', 'sector', 'market_cap_range', 'thesis', 'what_it_actually_does', 'proof_of_shipping', 'attention_quality_note', 'token_survivability_note', 'risk_flags', 'why_now', 'receipts', 'linked_narratives', 'linked_graph_node', 'hunter_credit', 'paid_evaluation_disclosure', 'status', 'verdict', 'scores', 'updated_at']),
    UnicornRadarRevenueReceipt: objectSchema({
      id: stringSchema(),
      candidate_id: { oneOf: [stringSchema(), { type: 'null' }] },
      project: stringSchema(),
      amount_usd: { type: 'number', minimum: 0 },
      service: enumSchema(['paid_evaluation', 'sponsored_receipt_review', 'research_retainer']),
      disclosure: stringSchema(),
      status: enumSchema(['paid', 'comped', 'pending']),
      paid_at: dateTimeSchema()
    }, ['id', 'candidate_id', 'project', 'amount_usd', 'service', 'disclosure', 'status', 'paid_at']),
    UnicornRadarSummary: objectSchema({
      generated_at: dateTimeSchema(),
      title: stringSchema(),
      tagline: stringSchema(),
      subline: stringSchema(),
      trust_line: stringSchema(),
      doctrine_line: stringSchema(),
      counts: freeformObject(),
      candidates: arrayOf({ $ref: '#/components/schemas/UnicornRadarCandidate' }),
      revenue_receipts: arrayOf({ $ref: '#/components/schemas/UnicornRadarRevenueReceipt' })
    }, ['generated_at', 'title', 'tagline', 'subline', 'trust_line', 'doctrine_line', 'counts', 'candidates', 'revenue_receipts']),
    UnicornRadarCandidateList: objectSchema({
      generated_at: dateTimeSchema(),
      count: integerSchema(),
      candidates: arrayOf({ $ref: '#/components/schemas/UnicornRadarCandidate' })
    }, ['generated_at', 'count', 'candidates']),
    UnicornRadarSubmissionInput: objectSchema({
      project: stringSchema(),
      ticker: stringSchema(),
      sector: { $ref: '#/components/schemas/UnicornRadarSector' },
      market_cap_range: stringSchema(),
      thesis: stringSchema(),
      what_it_actually_does: stringSchema(),
      proof_links: arrayOf(stringSchema()),
      submitter_handle: stringSchema(),
      notes: stringSchema()
    }, ['project', 'sector', 'thesis']),
    UnicornRadarSubmissionResponse: objectSchema({
      submission_id: stringSchema(),
      status: enumSchema(['staged_for_review']),
      candidate_preview: freeformObject(),
      default_requirements: arrayOf(stringSchema()),
      disclosure: stringSchema(),
      submitted_at: dateTimeSchema()
    }, ['submission_id', 'status', 'candidate_preview', 'default_requirements', 'disclosure', 'submitted_at']),
    UnicornRadarEvaluationRequestInput: objectSchema({
      project: stringSchema(),
      ticker: stringSchema(),
      sector: { $ref: '#/components/schemas/UnicornRadarSector' },
      contact: stringSchema(),
      requested_by: stringSchema(),
      budget_disclosure: stringSchema(),
      notes: stringSchema()
    }, ['project', 'contact']),
    UnicornRadarEvaluationRequestResponse: objectSchema({
      request_id: stringSchema(),
      status: enumSchema(['evaluation_requested']),
      project: stringSchema(),
      disclosure: stringSchema(),
      doctrine: stringSchema(),
      next_steps: arrayOf(stringSchema()),
      requested_at: dateTimeSchema()
    }, ['request_id', 'status', 'project', 'disclosure', 'doctrine', 'next_steps', 'requested_at']),
    EvaluationRequestReviewType: enumSchema(['unicorn_radar_evaluation', 'do_not_touch_risk_review', 'token_survivability_review', 'agent_readiness_review', 'narrative_positioning_review']),
    EvaluationRequestInput: objectSchema({
      projectName: stringSchema(),
      ticker: stringSchema(),
      chain: stringSchema(),
      tokenAddress: stringSchema(),
      website: stringSchema(),
      xAccount: stringSchema(),
      contact: stringSchema(),
      dexScreenerUrl: stringSchema(),
      solscanUrl: stringSchema(),
      marketCap: stringSchema(),
      liquidity: stringSchema(),
      holderCount: stringSchema(),
      top10HolderConcentration: stringSchema(),
      top25HolderConcentration: stringSchema(),
      supplyNotes: stringSchema(),
      launchStructure: stringSchema(),
      teamTreasuryWallets: stringSchema(),
      productReceipts: stringSchema(),
      marketplaceEconomyReceipts: stringSchema(),
      communityReceipts: stringSchema(),
      upsideThesis: stringSchema(),
      riskFlags: stringSchema(),
      whyNow: stringSchema(),
      requestedReviewType: { $ref: '#/components/schemas/EvaluationRequestReviewType' },
      paidEvaluationBudget: stringSchema(),
      disclosureAcknowledged: { type: 'boolean' }
    }),
    EvaluationRequest: objectSchema({
      id: stringSchema(),
      projectName: stringSchema(),
      ticker: stringSchema(),
      chain: stringSchema(),
      tokenAddress: { oneOf: [stringSchema(), { type: 'null' }] },
      website: { oneOf: [stringSchema(), { type: 'null' }] },
      xAccount: { oneOf: [stringSchema(), { type: 'null' }] },
      contact: stringSchema(),
      dexScreenerUrl: { oneOf: [stringSchema(), { type: 'null' }] },
      solscanUrl: { oneOf: [stringSchema(), { type: 'null' }] },
      marketCap: { oneOf: [stringSchema(), { type: 'null' }] },
      liquidity: { oneOf: [stringSchema(), { type: 'null' }] },
      holderCount: { oneOf: [stringSchema(), { type: 'null' }] },
      top10HolderConcentration: { oneOf: [stringSchema(), { type: 'null' }] },
      top25HolderConcentration: { oneOf: [stringSchema(), { type: 'null' }] },
      supplyNotes: { oneOf: [stringSchema(), { type: 'null' }] },
      launchStructure: { oneOf: [stringSchema(), { type: 'null' }] },
      teamTreasuryWallets: { oneOf: [stringSchema(), { type: 'null' }] },
      productReceipts: { oneOf: [stringSchema(), { type: 'null' }] },
      marketplaceEconomyReceipts: { oneOf: [stringSchema(), { type: 'null' }] },
      communityReceipts: { oneOf: [stringSchema(), { type: 'null' }] },
      upsideThesis: stringSchema(),
      riskFlags: stringSchema(),
      whyNow: { oneOf: [stringSchema(), { type: 'null' }] },
      requestedReviewType: { $ref: '#/components/schemas/EvaluationRequestReviewType' },
      paidEvaluationBudget: { oneOf: [stringSchema(), { type: 'null' }] },
      disclosureAcknowledged: { type: 'boolean', const: true },
      submittedAt: dateTimeSchema()
    }, ['id', 'projectName', 'ticker', 'chain', 'contact', 'upsideThesis', 'riskFlags', 'requestedReviewType', 'disclosureAcknowledged', 'submittedAt']),
    EvaluationRequestResponse: objectSchema({
      request_id: stringSchema(),
      status: enumSchema(['accepted', 'manual_delivery_required']),
      generated_at: dateTimeSchema(),
      disclosure_acknowledged: { type: 'boolean', const: true },
      revenue_receipt_policy: stringSchema(),
      next_steps: arrayOf(stringSchema()),
      request_packet: stringSchema(),
      evaluation_request: { $ref: '#/components/schemas/EvaluationRequest' }
    }, ['request_id', 'status', 'generated_at', 'disclosure_acknowledged', 'revenue_receipt_policy', 'next_steps', 'request_packet', 'evaluation_request']),
    EvaluationRequestResponseEnvelope: objectSchema({
      data: { $ref: '#/components/schemas/EvaluationRequestResponse' }
    }, ['data']),
    EvaluationRequestDisclosureError: objectSchema({
      code: enumSchema(['DISCLOSURE_REQUIRED']),
      message: stringSchema()
    }, ['code', 'message']),
    UnicornRadarRevenueReceiptList: objectSchema({
      generated_at: dateTimeSchema(),
      count: integerSchema(),
      receipts: arrayOf({ $ref: '#/components/schemas/UnicornRadarRevenueReceipt' })
    }, ['generated_at', 'count', 'receipts']),
    RevenueReceiptStatus: enumSchema(['open_slot', 'pending', 'completed', 'cancelled', 'refunded', 'disputed']),
    RevenueReceiptSource: enumSchema(['sponsored_radar_evaluation', 'signal_hunt_bounty', 'radar_listing', 'weekly_report', 'studio_work', 'api_access', 'internal_build']),
    RevenueReceiptUseOfFundsBucket: enumSchema(['product_treasury', 'hunter_rewards', 'community_ops', 'content_design_bounties']),
    RevenueReceiptUseOfFundsAllocation: objectSchema({
      bucket: { $ref: '#/components/schemas/RevenueReceiptUseOfFundsBucket' },
      percentage: { type: 'number', minimum: 0, maximum: 100 },
      amount_usd: { type: 'number', minimum: 0 }
    }, ['bucket', 'percentage', 'amount_usd']),
    RevenueReceiptUseOfFundsPolicy: objectSchema({
      bucket: { $ref: '#/components/schemas/RevenueReceiptUseOfFundsBucket' },
      percentage: { type: 'number', minimum: 0, maximum: 100 }
    }, ['bucket', 'percentage']),
    RevenueReceipt: objectSchema({
      id: stringSchema(),
      receiptNumber: stringSchema(),
      title: stringSchema(),
      source: { $ref: '#/components/schemas/RevenueReceiptSource' },
      clientName: stringSchema(),
      clientType: stringSchema(),
      amount: { type: 'number', minimum: 0 },
      currency: enumSchema(['USD']),
      status: { $ref: '#/components/schemas/RevenueReceiptStatus' },
      publishedAt: dateTimeSchema(),
      completedAt: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      relatedProduct: stringSchema(),
      relatedCandidateId: { oneOf: [stringSchema(), { type: 'null' }] },
      relatedCandidateUrl: { oneOf: [stringSchema(), { type: 'null' }] },
      disclosure: stringSchema(),
      verdictIndependenceStatement: stringSchema(),
      useOfFunds: arrayOf({ $ref: '#/components/schemas/RevenueReceiptUseOfFundsAllocation' }),
      hunterReward: { oneOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      txHash: { oneOf: [stringSchema(), { type: 'null' }] },
      paymentMethod: { oneOf: [stringSchema(), { type: 'null' }] },
      notes: arrayOf(stringSchema()),
      ogImageUrl: stringSchema()
    }, ['id', 'receiptNumber', 'title', 'source', 'clientName', 'clientType', 'amount', 'currency', 'status', 'publishedAt', 'completedAt', 'relatedProduct', 'relatedCandidateId', 'relatedCandidateUrl', 'disclosure', 'verdictIndependenceStatement', 'useOfFunds', 'hunterReward', 'txHash', 'paymentMethod', 'notes', 'ogImageUrl']),
    RevenueReceiptList: objectSchema({
      generated_at: dateTimeSchema(),
      count: integerSchema(),
      receipts: arrayOf({ $ref: '#/components/schemas/RevenueReceipt' })
    }, ['generated_at', 'count', 'receipts']),
    RevenueReceiptSummary: objectSchema({
      generated_at: dateTimeSchema(),
      title: stringSchema(),
      tagline: stringSchema(),
      subline: stringSchema(),
      trust_line: stringSchema(),
      warning_line: stringSchema(),
      use_of_funds_policy: arrayOf({ $ref: '#/components/schemas/RevenueReceiptUseOfFundsPolicy' }),
      receipts: arrayOf({ $ref: '#/components/schemas/RevenueReceipt' })
    }, ['generated_at', 'title', 'tagline', 'subline', 'trust_line', 'warning_line', 'use_of_funds_policy', 'receipts']),
    SignalHuntProofState: enumSchema(['unproven', 'receipts_attached', 'validated', 'challenged', 'rejected']),
    SignalHuntHuntState: enumSchema(['fresh_signal', 'under_review', 'verified_signal', 'noise', 'disputed']),
    SignalHuntDecisionState: enumSchema(['signal', 'noise', 'review']),
    SignalHuntCandidate: objectSchema({
      id: stringSchema(),
      title: stringSchema(),
      handle_or_source: stringSchema(),
      category: stringSchema(),
      thesis: stringSchema(),
      why_it_matters: stringSchema(),
      evidence: arrayOf(stringSchema()),
      evidence_count: integerSchema(),
      signal_score: integerSchema(),
      velocity_score: integerSchema(),
      risk_score: integerSchema(),
      proof_state: { $ref: '#/components/schemas/SignalHuntProofState' },
      hunt_state: { $ref: '#/components/schemas/SignalHuntHuntState' },
      decision_state: { $ref: '#/components/schemas/SignalHuntDecisionState' },
      submitted_by: stringSchema(),
      submitted_at: dateTimeSchema(),
      updated_at: dateTimeSchema(),
      linked_check_ids: arrayOf(stringSchema()),
      linked_loop_ids: arrayOf(stringSchema()),
      linked_signal_ids: arrayOf(stringSchema()),
      linked_route_ids: arrayOf(stringSchema()),
      tags: arrayOf(stringSchema())
    }),
    SignalHuntSummary: objectSchema({
      generated_at: dateTimeSchema(),
      counts: objectSchema({
        total: integerSchema(),
        fresh_signal: integerSchema(),
        under_review: integerSchema(),
        verified_signal: integerSchema(),
        noise: integerSchema(),
        disputed: integerSchema()
      }),
      candidates: arrayOf({ $ref: '#/components/schemas/SignalHuntCandidate' })
    }),
    SignalHuntSubmissionInput: objectSchema({
      title: stringSchema(),
      handle_or_source: stringSchema(),
      category: stringSchema(),
      thesis: stringSchema(),
      why_it_matters: stringSchema(),
      evidence: arrayOf(stringSchema()),
      submitted_by: stringSchema(),
      tags: arrayOf(stringSchema())
    }),
    SignalHuntVerifyInput: objectSchema({
      verifier: stringSchema(),
      verdict: enumSchema(['verified_signal', 'noise', 'disputed', 'under_review']),
      proof_state: enumSchema(['receipts_attached', 'validated', 'challenged', 'rejected']),
      decision_note: stringSchema(),
      linked_check_ids: arrayOf(stringSchema()),
      linked_loop_ids: arrayOf(stringSchema()),
      linked_signal_ids: arrayOf(stringSchema()),
      linked_route_ids: arrayOf(stringSchema())
    }),
    SignalGraphProofState: enumSchema(['unproven', 'validated', 'disputed', 'corrupted', 'compounding']),
    SignalNodeType: enumSchema(['claim', 'meme', 'agent', 'project', 'token', 'post', 'route', 'receipt', 'proof_check', 'loop_run', 'provider', 'service', 'narrative', 'category']),
    SignalEdgeType: enumSchema(['semantic_similarity', 'proof_link', 'citation', 'receipt', 'receipt_link', 'shared_wallet', 'repeated_narrative', 'contradiction', 'amplification', 'provider_category', 'narrative_category']),
    SignalGraphCluster: objectSchema({
      id: stringSchema(),
      label: stringSchema(),
      summary: stringSchema(),
      proof_state: { $ref: '#/components/schemas/SignalGraphProofState' },
      ripple_summary: stringSchema(),
      node_count: integerSchema(),
      edge_count: integerSchema(),
      updated_at: dateTimeSchema()
    }),
    SignalGraphNode: objectSchema({
      id: stringSchema(),
      type: { $ref: '#/components/schemas/SignalNodeType' },
      label: stringSchema(),
      summary: stringSchema(),
      cluster_id: stringSchema(),
      proof_state: { $ref: '#/components/schemas/SignalGraphProofState' },
      confidence_score: { type: 'number', minimum: 0, maximum: 100 },
      velocity_score: { type: 'number', minimum: 0, maximum: 100 },
      source_urls: arrayOf(stringSchema()),
      linked_receipt_ids: arrayOf(stringSchema()),
      linked_claim_ids: arrayOf(stringSchema()),
      linked_loop_ids: arrayOf(stringSchema()),
      linked_route_ids: arrayOf(stringSchema()),
      linked_provider_ids: arrayOf(stringSchema()),
      linked_service_ids: arrayOf(stringSchema()),
      created_at: dateTimeSchema(),
      updated_at: dateTimeSchema()
    }),
    SignalGraphEdge: objectSchema({
      id: stringSchema(),
      source_node_id: stringSchema(),
      target_node_id: stringSchema(),
      type: { $ref: '#/components/schemas/SignalEdgeType' },
      strength: { type: 'number', minimum: 0, maximum: 100 },
      explanation: stringSchema()
    }),
    SignalGraphRipple: objectSchema({
      id: stringSchema(),
      cluster_id: stringSchema(),
      title: stringSchema(),
      summary: stringSchema(),
      proof_state: { $ref: '#/components/schemas/SignalGraphProofState' },
      impact_score: { type: 'number', minimum: 0, maximum: 100 },
      changed_at: dateTimeSchema(),
      linked_node_ids: arrayOf(stringSchema())
    }),
    SignalGraphStats: objectSchema({
      node_count: integerSchema(),
      edge_count: integerSchema(),
      cluster_count: integerSchema(),
      validated_count: integerSchema(),
      disputed_count: integerSchema(),
      compounding_count: integerSchema(),
      last_updated_at: dateTimeSchema()
    }),
    SignalGraphEvidence: objectSchema({
      event_id: nullableString(),
      provider_id: nullableString(),
      endpoint_id: nullableString(),
      observed_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      catalog_generated_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      ingested_at: { oneOf: [dateTimeSchema(), { type: 'null' }] },
      source: nullableString(),
      derivation_reason: stringSchema(),
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      severity: enumSchema(['critical', 'warning', 'informational', 'unknown']),
      severity_reason: stringSchema(),
      severity_score: { type: 'number' },
      severity_window: stringSchema()
    }),
    SignalGraphResponse: objectSchema({
      tagline: stringSchema(),
      clusters: arrayOf({ $ref: '#/components/schemas/SignalGraphCluster' }),
      nodes: arrayOf({ $ref: '#/components/schemas/SignalGraphNode' }),
      edges: arrayOf({ $ref: '#/components/schemas/SignalGraphEdge' }),
      ripples: arrayOf({ $ref: '#/components/schemas/SignalGraphRipple' }),
      stats: { $ref: '#/components/schemas/SignalGraphStats' },
      evidence: { oneOf: [{ $ref: '#/components/schemas/SignalGraphEvidence' }, { type: 'null' }] }
    }),
    SignalGraphClusterDetail: objectSchema({
      cluster: { $ref: '#/components/schemas/SignalGraphCluster' },
      nodes: arrayOf({ $ref: '#/components/schemas/SignalGraphNode' }),
      edges: arrayOf({ $ref: '#/components/schemas/SignalGraphEdge' }),
      ripples: arrayOf({ $ref: '#/components/schemas/SignalGraphRipple' })
    }),
    SignalGraphNodeDetail: objectSchema({
      node: { $ref: '#/components/schemas/SignalGraphNode' },
      cluster: { $ref: '#/components/schemas/SignalGraphCluster' },
      connected_edges: arrayOf({ $ref: '#/components/schemas/SignalGraphEdge' }),
      related_nodes: arrayOf({ $ref: '#/components/schemas/SignalGraphNode' }),
      ripples: arrayOf({ $ref: '#/components/schemas/SignalGraphRipple' })
    }),
    SignalGraphCheckInput: objectSchema({
      label: stringSchema(),
      summary: stringSchema(),
      source_url: stringSchema(),
      cluster_id: stringSchema()
    }),
    SignalGraphEntityType: enumSchema(['receipt', 'claim', 'loop', 'route', 'provider', 'service']),
    SignalGraphSuggestedEdge: objectSchema({
      target_node_id: stringSchema(),
      type: { $ref: '#/components/schemas/SignalEdgeType' },
      strength: { type: 'number', minimum: 0, maximum: 100 },
      explanation: stringSchema()
    }),
    SignalGraphCheckResponse: objectSchema({
      generated_node_preview: { $ref: '#/components/schemas/SignalGraphNode' },
      suggested_proof_state: { $ref: '#/components/schemas/SignalGraphProofState' },
      confidence_score: { type: 'number', minimum: 0, maximum: 100 },
      suggested_edges: arrayOf({ $ref: '#/components/schemas/SignalGraphSuggestedEdge' }),
      explanation: stringSchema()
    }),
    SignalGraphEntityLookupResponse: objectSchema({
      entity_type: { $ref: '#/components/schemas/SignalGraphEntityType' },
      entity_id: stringSchema(),
      nodes: arrayOf({ $ref: '#/components/schemas/SignalGraphNode' })
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
    NarrativeEvidenceArtifact: objectSchema({
      label: stringSchema(),
      note: stringSchema(),
      href: stringSchema()
    }, ['label', 'note']),
    NarrativeRelatedRoute: objectSchema({
      label: stringSchema(),
      href: stringSchema()
    }, ['label', 'href']),
    NarrativeEvolutionStage: enumSchema(['persona_coin', 'attention_market', 'coordination_market_emerging', 'movement_candidate_under_observation']),
    AttentionMarketEvolutionStage: enumSchema(['persona_coin', 'attention_market', 'coordination_market_emerging', 'movement_candidate_under_observation', 'extraction_risk', 'cult_sludge']),
    AttentionMarketEvolutionStageDefinition: objectSchema({
      id: { $ref: '#/components/schemas/AttentionMarketEvolutionStage' },
      label: stringSchema(),
      description: stringSchema()
    }, ['id', 'label', 'description']),
    MovementStatus: enumSchema(['under_observation']),
    NarrativeAssetResponse: objectSchema({
      id: stringSchema(),
      slug: stringSchema(),
      ticker: stringSchema(),
      name: stringSchema(),
      chain: stringSchema(),
      category: stringSchema(),
      thesis: stringSchema(),
      signal_source: stringSchema(),
      attention_velocity_score: integerSchema(),
      myth_coherence_score: integerSchema(),
      centralization_risk_score: integerSchema(),
      reflexivity_risk_score: integerSchema(),
      kol_dependency_score: integerSchema(),
      trench_contagion_score: integerSchema(),
      sovereignty_score: integerSchema(),
      infopunk_verdict: stringSchema(),
      evidence_artifacts: arrayOf({ $ref: '#/components/schemas/NarrativeEvidenceArtifact' }),
      related_routes: arrayOf({ $ref: '#/components/schemas/NarrativeRelatedRoute' }),
      last_updated: dateTimeSchema(),
      evolution_path: arrayOf({ $ref: '#/components/schemas/NarrativeEvolutionStage' }),
      current_evolution_stage: { $ref: '#/components/schemas/NarrativeEvolutionStage' },
      current_evolution_label: stringSchema(),
      movement_status: { $ref: '#/components/schemas/MovementStatus' },
      movement_status_label: stringSchema()
    }),
    NarrativeAssetListResponse: arrayOf({ $ref: '#/components/schemas/NarrativeAssetResponse' }),
    AttentionMarketCategory: enumSchema(['persona_coin', 'influencer_attention', 'dev_attention', 'ai_agent_attention', 'community_archetype', 'streamer_signal', 'reply_gang', 'anonymous_cult']),
    AttentionSourceType: enumSchema(['influencer', 'dev', 'ai_agent', 'community_archetype', 'streamer', 'reply_gang', 'anonymous_cult']),
    AttentionMarketVerdict: enumSchema(['attention_arbitrage', 'extraction_risk', 'cult_sludge', 're_index_watch', 'movement_candidate', 'signal_market_candidate', 'supportive_watch']),
    AttentionSource: objectSchema({
      type: { $ref: '#/components/schemas/AttentionSourceType' },
      label: stringSchema(),
      summary: stringSchema()
    }, ['type', 'label', 'summary']),
    AttentionControlRisk: objectSchema({
      score: integerSchema(),
      summary: stringSchema(),
      factors: arrayOf(stringSchema())
    }, ['score', 'summary', 'factors']),
    AttentionScoreSummary: objectSchema({
      score: integerSchema(),
      summary: stringSchema()
    }, ['score', 'summary']),
    AttentionReceiptLayer: objectSchema({
      score: integerSchema(),
      summary: stringSchema(),
      evidence_links: arrayOf(stringSchema())
    }, ['score', 'summary', 'evidence_links']),
    AttentionMarketSignal: objectSchema({
      id: stringSchema(),
      slug: stringSchema(),
      ticker: stringSchema(),
      name: stringSchema(),
      category: { $ref: '#/components/schemas/AttentionMarketCategory' },
      attention_source: { $ref: '#/components/schemas/AttentionSource' },
      control_risk: { $ref: '#/components/schemas/AttentionControlRisk' },
      coherence_score: { $ref: '#/components/schemas/AttentionScoreSummary' },
      receipt_layer: { $ref: '#/components/schemas/AttentionReceiptLayer' },
      fragmentation_risk: { $ref: '#/components/schemas/AttentionScoreSummary' },
      evolution_verdict: { $ref: '#/components/schemas/AttentionMarketVerdict' },
      verdict_label: stringSchema(),
      verdict_copy: stringSchema(),
      current_evolution_stage: { $ref: '#/components/schemas/AttentionMarketEvolutionStage' },
      current_evolution_label: stringSchema(),
      risk_facets: arrayOf({ $ref: '#/components/schemas/SignalRiskFacet' }),
      related_signal_slug: stringSchema(),
      href: stringSchema(),
      updated_at: dateTimeSchema()
    }, ['id', 'slug', 'ticker', 'name', 'category', 'attention_source', 'control_risk', 'coherence_score', 'receipt_layer', 'fragmentation_risk', 'evolution_verdict', 'verdict_label', 'verdict_copy', 'risk_facets', 'href', 'updated_at']),
    AttentionMarketWatchListResponse: objectSchema({
      generated_at: dateTimeSchema(),
      count: integerSchema(),
      verdict_counts: {
        type: 'object',
        additionalProperties: integerSchema()
      },
      evolution_stages: arrayOf({ $ref: '#/components/schemas/AttentionMarketEvolutionStageDefinition' }),
      signals: arrayOf({ $ref: '#/components/schemas/AttentionMarketSignal' })
    }, ['generated_at', 'count', 'verdict_counts', 'evolution_stages', 'signals']),
    AttentionMarketWatchDetailResponse: objectSchema({
      signal: { $ref: '#/components/schemas/AttentionMarketSignal' }
    }, ['signal']),
    AttentionMarketIntakeStatus: enumSchema(['staged', 'needs_evidence', 'under_review', 'rejected', 'promoted_to_watch_profile']),
    AttentionMarketIntakeRequest: objectSchema({
      ticker: stringSchema(),
      name: stringSchema(),
      chain: stringSchema(),
      attention_source_type: enumSchema(['influencer', 'dev', 'ai_agent', 'community_archetype', 'streamer', 'reply_gang', 'anonymous_cult', 'unknown']),
      attention_source_label: stringSchema(),
      submitter_handle: stringSchema(),
      why_it_matters: stringSchema(),
      evidence_links: arrayOf(stringSchema())
    }, ['ticker', 'name', 'why_it_matters']),
    AttentionMarketIntakeSubmission: objectSchema({
      intake_id: stringSchema(),
      submitted_at: dateTimeSchema(),
      status: { $ref: '#/components/schemas/AttentionMarketIntakeStatus' },
      ticker: stringSchema(),
      name: stringSchema(),
      chain: stringSchema(),
      attention_source_type: enumSchema(['influencer', 'dev', 'ai_agent', 'community_archetype', 'streamer', 'reply_gang', 'anonymous_cult', 'unknown']),
      attention_source_label: stringSchema(),
      submitter_handle: stringSchema(),
      why_it_matters: stringSchema(),
      evidence_links: arrayOf(stringSchema()),
      default_evidence_requirements: arrayOf(stringSchema()),
      default_risk_facets: arrayOf({ $ref: '#/components/schemas/SignalRiskFacet' }),
      intake_note: stringSchema()
    }, ['intake_id', 'submitted_at', 'status', 'ticker', 'name', 'attention_source_type', 'why_it_matters', 'evidence_links', 'default_evidence_requirements', 'default_risk_facets', 'intake_note']),
    AttentionMarketIntakeSubmissionResponse: objectSchema({
      submission: { $ref: '#/components/schemas/AttentionMarketIntakeSubmission' }
    }, ['submission']),
    AttentionMarketIntakeRequirementsResponse: objectSchema({
      requirements: arrayOf(stringSchema()),
      default_risk_facets: arrayOf({ $ref: '#/components/schemas/SignalRiskFacet' }),
      disclaimer: stringSchema()
    }, ['requirements', 'default_risk_facets', 'disclaimer']),
    NarrativeSignalCard: objectSchema({
      id: stringSchema(),
      title: stringSchema(),
      score: { oneOf: [integerSchema(), stringSchema()] },
      short_explanation: stringSchema(),
      evidence_note: stringSchema(),
      decision_state: enumSchema(['strong_signal', 'supportive_watch', 'durable_re_index', 'watch_closely', 'concentrated_power', 'high_reflexivity', 'unproven', 'do_not_chase'])
    }),
    NarrativeSignalSection: objectSchema({
      id: stringSchema(),
      title: stringSchema(),
      body: stringSchema(),
      card_ids: arrayOf(stringSchema())
    }),
    NarrativeSignalSurfaceResponse: objectSchema({
      slug: stringSchema(),
      type: enumSchema(['signal_source', 'signal_report']),
      title: stringSchema(),
      subtitle: stringSchema(),
      thesis: stringSchema(),
      disclaimer: stringSchema(),
      signal_source: stringSchema(),
      asset_slug: { type: ['string', 'null'] },
      last_updated: dateTimeSchema(),
      infopunk_verdict: stringSchema(),
      verdict_label: stringSchema(),
      verdict_state: enumSchema(['strong_signal', 'supportive_watch', 'durable_re_index', 'watch_closely', 'concentrated_power', 'high_reflexivity', 'unproven', 'do_not_chase']),
      verdict_copy: stringSchema(),
      evolution_path: arrayOf({ $ref: '#/components/schemas/NarrativeEvolutionStage' }),
      current_evolution_stage: { $ref: '#/components/schemas/NarrativeEvolutionStage' },
      current_evolution_label: stringSchema(),
      movement_status: { $ref: '#/components/schemas/MovementStatus' },
      movement_status_label: stringSchema(),
      cards: arrayOf({ $ref: '#/components/schemas/NarrativeSignalCard' }),
      sections: arrayOf({ $ref: '#/components/schemas/NarrativeSignalSection' }),
      asset: { $ref: '#/components/schemas/NarrativeAssetResponse' }
    }),
    NarrativeSignalSurfaceListResponse: arrayOf(objectSchema({
      slug: stringSchema(),
      type: enumSchema(['signal_source', 'signal_report']),
      title: stringSchema(),
      subtitle: stringSchema(),
      thesis: stringSchema(),
      disclaimer: stringSchema(),
      signal_source: stringSchema(),
      asset_slug: { type: ['string', 'null'] },
      last_updated: dateTimeSchema(),
      evolution_path: arrayOf({ $ref: '#/components/schemas/NarrativeEvolutionStage' }),
      current_evolution_stage: { $ref: '#/components/schemas/NarrativeEvolutionStage' },
      current_evolution_label: stringSchema(),
      movement_status: { $ref: '#/components/schemas/MovementStatus' },
      movement_status_label: stringSchema()
    })),
    SignalDeskStatus: enumSchema(['live_watch', 'seeded_report', 'needs_review']),
    SignalRiskFacet: enumSchema(['high_reflexivity', 'power_concentration', 'unproven_sovereignty', 'kol_dependency', 'thin_evidence', 'narrative_fatigue', 'live_watch']),
    SignalDeskActivityType: enumSchema(['report_published', 'dispatch_published', 'risk_shift', 'verdict_change', 'metadata_updated', 'og_card_generated']),
    SignalEvidenceUpdateType: enumSchema(['attention_shift', 'holder_shift', 'myth_shift', 'risk_shift', 'verdict_change']),
    CandidateSignalCategory: enumSchema(['attention_market', 'meme_asset', 'agentic_narrative', 'depin_signal', 'kol_signal', 'market_myth', 'unknown']),
    CandidateSignalStatus: enumSchema(['queued', 'watching', 'needs_evidence', 'under_review', 'rejected', 'promoted_to_report']),
    CandidateSignalPriority: enumSchema(['low', 'medium', 'high']),
    CandidateSignalRiskLevel: enumSchema(['low', 'medium', 'high', 'unknown']),
    CandidateSignal: objectSchema({
      candidate_id: stringSchema(),
      name: stringSchema(),
      ticker: stringSchema(),
      chain: stringSchema(),
      category: { $ref: '#/components/schemas/CandidateSignalCategory' },
      submitted_by: enumSchema(['desk', 'community', 'system']),
      status: { $ref: '#/components/schemas/CandidateSignalStatus' },
      priority: { $ref: '#/components/schemas/CandidateSignalPriority' },
      risk_level: { $ref: '#/components/schemas/CandidateSignalRiskLevel' },
      risk_facets: arrayOf({ $ref: '#/components/schemas/SignalRiskFacet' }),
      summary: stringSchema(),
      why_it_matters: stringSchema(),
      evidence_links: arrayOf(stringSchema()),
      created_at: dateTimeSchema(),
      updated_at: dateTimeSchema()
    }, ['candidate_id', 'name', 'category', 'submitted_by', 'status', 'priority', 'risk_level', 'risk_facets', 'summary', 'why_it_matters', 'evidence_links', 'created_at', 'updated_at']),
    CandidateSignalListResponse: objectSchema({
      count: integerSchema(),
      candidates: arrayOf({ $ref: '#/components/schemas/CandidateSignal' })
    }, ['count', 'candidates']),
    CandidateSignalDetailResponse: objectSchema({
      candidate: { $ref: '#/components/schemas/CandidateSignal' }
    }, ['candidate']),
    SignalEvidenceUpdate: objectSchema({
      update_id: stringSchema(),
      signal_slug: stringSchema(),
      timestamp: dateTimeSchema(),
      update_type: { $ref: '#/components/schemas/SignalEvidenceUpdateType' },
      summary: stringSchema(),
      evidence_links: arrayOf(stringSchema()),
      previous_score: integerSchema(),
      new_score: integerSchema(),
      analyst_note: stringSchema()
    }, ['update_id', 'signal_slug', 'timestamp', 'update_type', 'summary', 'evidence_links', 'analyst_note']),
    SignalEvidenceUpdateListResponse: objectSchema({
      signal_slug: stringSchema(),
      count: integerSchema(),
      updates: arrayOf({ $ref: '#/components/schemas/SignalEvidenceUpdate' }),
      latest_update: { oneOf: [{ $ref: '#/components/schemas/SignalEvidenceUpdate' }, { type: 'null' }] },
      summary: stringSchema()
    }, ['signal_slug', 'count', 'updates', 'summary']),
    SignalEvidenceUpdateDetailResponse: objectSchema({
      signal_slug: stringSchema(),
      update: { $ref: '#/components/schemas/SignalEvidenceUpdate' }
    }, ['signal_slug', 'update']),
    SignalDeskReportCard: objectSchema({
      slug: stringSchema(),
      ticker: stringSchema(),
      name: stringSchema(),
      category: stringSchema(),
      thesis: stringSchema(),
      href: stringSchema(),
      verdict_label: stringSchema(),
      verdict_state: enumSchema(['strong_signal', 'supportive_watch', 'durable_re_index', 'watch_closely', 'concentrated_power', 'high_reflexivity', 'unproven', 'do_not_chase']),
      signal_strength: integerSchema(),
      myth_coherence: integerSchema(),
      reflexivity_risk: integerSchema(),
      sovereignty_score: integerSchema(),
      risk_facets: arrayOf({ $ref: '#/components/schemas/SignalRiskFacet' }),
      desk_status: { $ref: '#/components/schemas/SignalDeskStatus' },
      latest_update_type: { $ref: '#/components/schemas/SignalEvidenceUpdateType' },
      latest_update_at: dateTimeSchema(),
      update_count: integerSchema()
    }, ['slug', 'ticker', 'name', 'category', 'thesis', 'href', 'signal_strength', 'myth_coherence', 'reflexivity_risk', 'sovereignty_score', 'risk_facets', 'desk_status', 'update_count']),
    SignalDeskDispatchCard: objectSchema({
      update_id: stringSchema(),
      signal_slug: stringSchema(),
      signal_name: stringSchema(),
      ticker: stringSchema(),
      update_type: { $ref: '#/components/schemas/SignalEvidenceUpdateType' },
      readable_update_type: stringSchema(),
      timestamp: dateTimeSchema(),
      summary: stringSchema(),
      analyst_note: stringSchema(),
      href: stringSchema(),
      og_image: stringSchema(),
      risk_facets: arrayOf({ $ref: '#/components/schemas/SignalRiskFacet' }),
      previous_score: integerSchema(),
      new_score: integerSchema(),
      signal_delta: integerSchema()
    }, ['update_id', 'signal_slug', 'signal_name', 'ticker', 'update_type', 'readable_update_type', 'timestamp', 'summary', 'analyst_note', 'href', 'og_image', 'risk_facets']),
    SignalDeskActivityItem: objectSchema({
      id: stringSchema(),
      type: { $ref: '#/components/schemas/SignalDeskActivityType' },
      timestamp: dateTimeSchema(),
      title: stringSchema(),
      summary: stringSchema(),
      href: stringSchema()
    }, ['id', 'type', 'timestamp', 'title', 'summary', 'href']),
    SignalDeskIndex: objectSchema({
      generated_at: dateTimeSchema(),
      desk_status: { $ref: '#/components/schemas/SignalDeskStatus' },
      counts: objectSchema({
        reports: integerSchema(),
        dispatches: integerSchema(),
        risk_shifts: integerSchema(),
        watched_signals: integerSchema()
      }, ['reports', 'dispatches', 'risk_shifts', 'watched_signals']),
      candidate_signals: arrayOf({ $ref: '#/components/schemas/CandidateSignal' }),
      candidate_counts: objectSchema({
        total: integerSchema(),
        queued: integerSchema(),
        watching: integerSchema(),
        needs_evidence: integerSchema(),
        under_review: integerSchema(),
        promoted_to_report: integerSchema()
      }, ['total', 'queued', 'watching', 'needs_evidence', 'under_review', 'promoted_to_report']),
      featured_report: { oneOf: [{ $ref: '#/components/schemas/SignalDeskReportCard' }, { type: 'null' }] },
      reports: arrayOf({ $ref: '#/components/schemas/SignalDeskReportCard' }),
      latest_dispatches: arrayOf({ $ref: '#/components/schemas/SignalDeskDispatchCard' }),
      risk_shifts: arrayOf({ $ref: '#/components/schemas/SignalDeskDispatchCard' }),
      desk_activity: arrayOf({ $ref: '#/components/schemas/SignalDeskActivityItem' })
    }, ['generated_at', 'desk_status', 'counts', 'candidate_signals', 'candidate_counts', 'featured_report', 'reports', 'latest_dispatches', 'risk_shifts', 'desk_activity']),
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

function rhChainResponses(payload: string, example: unknown, errors?: Record<string, unknown>) {
  return {
    '200': {
      description: 'Successful public-intelligence response. `data_mode` and source timestamps describe freshness; cached live data never overrides human-reviewed receipts.',
      content: {
        'application/json': {
          schema: {
            allOf: [
              { $ref: '#/components/schemas/RhChainResponseEnvelope' },
              objectSchema({ data: { $ref: `#/components/schemas/${payload}` } }, ['data'])
            ]
          },
          examples: { success: { value: { data: example, meta: { source_policy: 'Public intelligence with source-linked provenance.', record_count: null, provider_status: [], live_indexing_enabled: false }, sources: [], generated_at: '2026-07-12T00:00:00.000Z', data_mode: 'seeded', disclaimer: 'Public intelligence only. Not endorsement or financial advice.' } } }
        }
      }
    },
    ...(errors ?? {}),
    default: rhChainErrorResponse()
  };
}

function rhChainErrorResponse(exampleError = 'bad_request') {
  return {
    description: 'Source-policy-preserving RH Chain error response.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/RhChainErrorEnvelope' },
        examples: { error: { value: { data: null, error: exampleError, meta: { source_policy: 'Public intelligence with source-linked provenance.', record_count: null, provider_status: [], live_indexing_enabled: false }, sources: [], generated_at: '2026-07-12T00:00:00.000Z', data_mode: 'seeded', disclaimer: 'Public intelligence only. Not endorsement or financial advice.' } } }
      }
    }
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
