import { z } from 'zod';
import {
  HumanValidationSubmissionSchema,
  PreSpendReceiptSchema,
  ProviderIntelligenceRecordSchema,
  RouteIntelligenceSchema,
  ServiceDossierSchema
} from '../schemas/entities';

export type SeedRouteIntelligence = z.infer<typeof RouteIntelligenceSchema>;
export type SeedProviderIntelligenceRecord = z.infer<typeof ProviderIntelligenceRecordSchema>;
export type SeedServiceDossier = z.infer<typeof ServiceDossierSchema>;
export type SeedPreSpendReceipt = z.infer<typeof PreSpendReceiptSchema>;
export type SeedHumanValidationSubmission = z.infer<typeof HumanValidationSubmissionSchema>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const seedRoutes = RouteIntelligenceSchema.array().parse([
  {
    route_id: 'route_pay_sh_market_research_01',
    provider_id: 'provider_pay_sh_lattice',
    service_id: 'service_market_research',
    endpoint: 'POST /market/research',
    payment_method: 'stablecoin',
    estimated_cost: '0.25 USDC',
    latency_ms_p50: 900,
    latency_ms_p95: 1600,
    success_rate: 0.91,
    last_tested_at: '2026-06-15T10:10:00.000Z',
    last_successful_run: '2026-06-14T09:40:00.000Z',
    last_failed_run: '2026-06-10T11:05:00.000Z',
    confidence_score: 82,
    risk_level: 'medium',
    known_blockers: ['occasional timeout under high load', 'output quality varies by prompt specificity'],
    receipt_references: ['receipt_001', 'receipt_002'],
    recommended_use_case: 'buy_market_research',
    avoid_conditions: ['strict sub-second latency required']
  },
  {
    route_id: 'route_pay_sh_market_research_03',
    provider_id: 'provider_pay_sh_oracle',
    service_id: 'service_market_research',
    endpoint: 'POST /research/brief',
    payment_method: 'stablecoin',
    estimated_cost: '0.31 USDC',
    latency_ms_p50: 780,
    latency_ms_p95: 1280,
    success_rate: 0.95,
    last_tested_at: '2026-06-15T11:20:00.000Z',
    last_successful_run: '2026-06-15T07:30:00.000Z',
    last_failed_run: '2026-06-01T07:30:00.000Z',
    confidence_score: 89,
    risk_level: 'low',
    known_blockers: [],
    receipt_references: ['receipt_003', 'receipt_004'],
    recommended_use_case: 'buy_market_research',
    avoid_conditions: ['budget cap below 0.30 USDC']
  },
  {
    route_id: 'route_pay_sh_token_quote_01',
    provider_id: 'provider_pay_sh_quartz',
    service_id: 'service_token_pricing',
    endpoint: 'GET /token/quote',
    payment_method: 'stablecoin',
    estimated_cost: '0.07 USDC',
    latency_ms_p50: 240,
    latency_ms_p95: 510,
    success_rate: 0.98,
    last_tested_at: '2026-06-16T04:00:00.000Z',
    last_successful_run: '2026-06-16T03:58:00.000Z',
    last_failed_run: '2026-05-29T04:01:00.000Z',
    confidence_score: 94,
    risk_level: 'low',
    known_blockers: [],
    receipt_references: ['receipt_005', 'receipt_006', 'receipt_007'],
    recommended_use_case: 'price_token_quote',
    avoid_conditions: ['unsupported settlement rail']
  },
  {
    route_id: 'route_pay_sh_receipt_parse_02',
    provider_id: 'provider_pay_sh_glass',
    service_id: 'service_receipt_parsing',
    endpoint: 'POST /receipt/parse',
    payment_method: 'stablecoin',
    estimated_cost: '0.12 USDC',
    latency_ms_p50: 620,
    latency_ms_p95: 1180,
    success_rate: 0.76,
    last_tested_at: '2026-05-22T08:00:00.000Z',
    last_successful_run: '2026-05-22T07:45:00.000Z',
    last_failed_run: '2026-06-11T08:10:00.000Z',
    confidence_score: 61,
    risk_level: 'medium',
    known_blockers: ['stale receipt evidence', 'layout-heavy PDFs may require manual review'],
    receipt_references: ['receipt_008', 'receipt_009'],
    recommended_use_case: 'extract_receipt_fields',
    avoid_conditions: ['business-critical reconciliation with no human fallback']
  },
  {
    route_id: 'route_pay_sh_compliance_scan_01',
    provider_id: 'provider_pay_sh_oracle',
    service_id: 'service_compliance_scan',
    endpoint: 'POST /compliance/scan',
    payment_method: 'stablecoin',
    estimated_cost: '1.80 USDC',
    latency_ms_p50: 1500,
    latency_ms_p95: 2800,
    success_rate: 0.89,
    last_tested_at: '2026-06-15T13:10:00.000Z',
    last_successful_run: '2026-06-15T13:00:00.000Z',
    last_failed_run: '2026-06-02T13:10:00.000Z',
    confidence_score: 78,
    risk_level: 'high',
    known_blockers: ['claim sensitivity requires policy review'],
    receipt_references: ['receipt_010'],
    recommended_use_case: 'run_compliance_scan',
    avoid_conditions: ['unapproved regulated claim submission']
  },
  {
    route_id: 'route_pay_sh_profile_scrape_09',
    provider_id: 'provider_x',
    service_id: 'service_private_profile_scrape',
    endpoint: 'POST /profile/scrape',
    payment_method: 'card',
    estimated_cost: '0.90 USDC',
    latency_ms_p50: 2200,
    latency_ms_p95: 4200,
    success_rate: 0.24,
    last_tested_at: '2026-06-12T02:10:00.000Z',
    last_successful_run: null,
    last_failed_run: '2026-06-12T02:10:00.000Z',
    confidence_score: 18,
    risk_level: 'critical',
    known_blockers: ['no recent successful receipt', 'provider dispute unresolved', 'settlement mismatch for stablecoin agents'],
    receipt_references: ['receipt_011'],
    recommended_use_case: 'scrape_private_profile',
    avoid_conditions: ['any autonomous spend']
  }
]);

const seedProviders = ProviderIntelligenceRecordSchema.array().parse([
  {
    provider_id: 'provider_pay_sh_lattice',
    name: 'Lattice Research Relay',
    service_categories: ['market_research'],
    reliability_score: 89,
    pricing_consistency: 'mostly consistent with rare surge pricing during load spikes',
    output_quality_notes: ['prompt-specific variability under vague requests', 'useful for broad market scans'],
    uptime_notes: ['steady during off-peak windows', 'minor timeout spikes during high load'],
    dispute_history: [],
    human_validation_status: 'human_validated',
    known_risks: ['broad prompts widen output variance'],
    agent_compatibility: ['research_agents', 'treasury_assistants'],
    route_coverage: 1,
    recent_receipt_count: 2
  },
  {
    provider_id: 'provider_pay_sh_oracle',
    name: 'Oracle Verification Fabric',
    service_categories: ['market_research', 'compliance'],
    reliability_score: 92,
    pricing_consistency: 'stable within observed range',
    output_quality_notes: ['repeatable structured summaries', 'strong validation notes'],
    uptime_notes: ['recent latency stable', 'low failure rate in current window'],
    dispute_history: [],
    human_validation_status: 'human_validated',
    known_risks: ['regulated claims still require policy review'],
    agent_compatibility: ['research_agents', 'compliance_agents', 'autonomous_wallets'],
    route_coverage: 2,
    recent_receipt_count: 3
  },
  {
    provider_id: 'provider_pay_sh_quartz',
    name: 'Quartz Route Index',
    service_categories: ['token_pricing'],
    reliability_score: 96,
    pricing_consistency: 'highly consistent',
    output_quality_notes: ['precise output shape', 'repeatable quote path'],
    uptime_notes: ['fast repeatable path observed', 'healthy current run cadence'],
    dispute_history: [],
    human_validation_status: 'human_validated',
    known_risks: [],
    agent_compatibility: ['trading_agents', 'autonomous_wallets', 'builder_test_agents'],
    route_coverage: 1,
    recent_receipt_count: 3
  },
  {
    provider_id: 'provider_pay_sh_glass',
    name: 'Glass Receipt Works',
    service_categories: ['receipt_parsing'],
    reliability_score: 68,
    pricing_consistency: 'consistent but stale evidence window',
    output_quality_notes: ['mixed performance on layout-heavy receipts', 'useful on clean flat receipts'],
    uptime_notes: ['service reachable', 'fresh proof missing'],
    dispute_history: ['one unresolved format-quality complaint'],
    human_validation_status: 'stale',
    known_risks: ['stale validation', 'mixed OCR reliability'],
    agent_compatibility: ['ops_agents', 'finance_backoffice_agents'],
    route_coverage: 1,
    recent_receipt_count: 2
  },
  {
    provider_id: 'provider_x',
    name: 'Provider X',
    service_categories: ['private_profile_scrape'],
    reliability_score: 21,
    pricing_consistency: 'unclear and unstable',
    output_quality_notes: ['invalid results reported'],
    uptime_notes: ['repeated failures recorded'],
    dispute_history: ['billing dispute unresolved', 'unsupported claim submitted by provider'],
    human_validation_status: 'disputed',
    known_risks: ['unknown counterparty behavior', 'settlement mismatch', 'unsupported claims'],
    agent_compatibility: [],
    route_coverage: 1,
    recent_receipt_count: 1
  }
]);

const seedServices = ServiceDossierSchema.array().parse([
  {
    service_id: 'service_market_research',
    category: 'market_research',
    available_routes: ['route_pay_sh_market_research_01', 'route_pay_sh_market_research_03'],
    supported_inputs: ['query', 'topic', 'geo_scope'],
    observed_cost_range: { min: '0.25 USDC', max: '0.31 USDC' },
    observed_latency_range: { min_ms: 780, max_ms: 1600 },
    best_observed_route: 'route_pay_sh_market_research_03',
    cheapest_observed_route: 'route_pay_sh_market_research_01',
    safest_first_attempt: 'route_pay_sh_market_research_03',
    fastest_repeatable_route: 'route_pay_sh_market_research_03',
    known_blockers: ['prompt quality affects result quality'],
    evidence_artifacts: ['artifact_market_research_benchmark_001', 'artifact_market_research_claim_log_001'],
    benchmark_readiness: 'human_validated',
    pre_spend_recommendation: 'Use Oracle Verification Fabric first for verified pre-spend decisions. Lattice is acceptable with prompt discipline.'
  },
  {
    service_id: 'service_token_pricing',
    category: 'token_pricing',
    available_routes: ['route_pay_sh_token_quote_01'],
    supported_inputs: ['token_symbol', 'pair', 'chain'],
    observed_cost_range: { min: '0.07 USDC', max: '0.07 USDC' },
    observed_latency_range: { min_ms: 240, max_ms: 510 },
    best_observed_route: 'route_pay_sh_token_quote_01',
    cheapest_observed_route: 'route_pay_sh_token_quote_01',
    safest_first_attempt: 'route_pay_sh_token_quote_01',
    fastest_repeatable_route: 'route_pay_sh_token_quote_01',
    known_blockers: [],
    evidence_artifacts: ['artifact_token_quote_benchmark_001'],
    benchmark_readiness: 'human_validated',
    pre_spend_recommendation: 'Verified first-choice route for low-risk quote checks.'
  },
  {
    service_id: 'service_receipt_parsing',
    category: 'receipt_parsing',
    available_routes: ['route_pay_sh_receipt_parse_02'],
    supported_inputs: ['receipt_image', 'pdf', 'json_schema'],
    observed_cost_range: { min: '0.12 USDC', max: '0.12 USDC' },
    observed_latency_range: { min_ms: 620, max_ms: 1180 },
    best_observed_route: 'route_pay_sh_receipt_parse_02',
    cheapest_observed_route: 'route_pay_sh_receipt_parse_02',
    safest_first_attempt: 'route_pay_sh_receipt_parse_02',
    fastest_repeatable_route: 'route_pay_sh_receipt_parse_02',
    known_blockers: ['stale evidence window', 'layout-heavy documents remain mixed'],
    evidence_artifacts: ['artifact_receipt_parse_review_001'],
    benchmark_readiness: 'stale',
    pre_spend_recommendation: 'Use with caution until fresh human-validated receipts exist.'
  },
  {
    service_id: 'service_compliance_scan',
    category: 'compliance',
    available_routes: ['route_pay_sh_compliance_scan_01'],
    supported_inputs: ['entity_record', 'policy_bundle', 'risk_context'],
    observed_cost_range: { min: '1.80 USDC', max: '1.80 USDC' },
    observed_latency_range: { min_ms: 1500, max_ms: 2800 },
    best_observed_route: 'route_pay_sh_compliance_scan_01',
    cheapest_observed_route: 'route_pay_sh_compliance_scan_01',
    safest_first_attempt: 'route_pay_sh_compliance_scan_01',
    fastest_repeatable_route: 'route_pay_sh_compliance_scan_01',
    known_blockers: ['business-context sensitivity'],
    evidence_artifacts: ['artifact_compliance_policy_gate_001'],
    benchmark_readiness: 'machine_checked',
    pre_spend_recommendation: 'Technically viable route, but human approval should gate spend for sensitive claims.'
  },
  {
    service_id: 'service_private_profile_scrape',
    category: 'private_profile_scrape',
    available_routes: ['route_pay_sh_profile_scrape_09'],
    supported_inputs: ['profile_url'],
    observed_cost_range: { min: '0.90 USDC', max: '0.90 USDC' },
    observed_latency_range: { min_ms: 2200, max_ms: 4200 },
    best_observed_route: null,
    cheapest_observed_route: null,
    safest_first_attempt: null,
    fastest_repeatable_route: null,
    known_blockers: ['repeated failures', 'unresolved provider disputes'],
    evidence_artifacts: ['artifact_provider_x_dispute_001'],
    benchmark_readiness: 'disputed',
    pre_spend_recommendation: 'Do not use until fresh successful receipts and dispute resolution exist.'
  }
]);

const seedReceipts = PreSpendReceiptSchema.array().parse([
  { receipt_id: 'receipt_001', timestamp: '2026-06-14T09:40:00.000Z', agent_id: 'agent_001', route_id: 'route_pay_sh_market_research_01', provider_id: 'provider_pay_sh_lattice', service_id: 'service_market_research', task_type: 'buy_market_research', cost: '0.25 USDC', payment_method: 'stablecoin', latency_ms: 980, input_summary: 'market_research prompt with topic and timeframe', output_summary: 'structured brief returned', status: 'succeeded', failure_reason: null, validation_state: 'human_validated', human_notes: ['useful baseline summary'], confidence_delta: 4, evidence_artifact: 'artifact_market_research_run_001' },
  { receipt_id: 'receipt_002', timestamp: '2026-06-13T11:05:00.000Z', agent_id: 'agent_002', route_id: 'route_pay_sh_market_research_01', provider_id: 'provider_pay_sh_lattice', service_id: 'service_market_research', task_type: 'buy_market_research', cost: '0.25 USDC', payment_method: 'stablecoin', latency_ms: 1180, input_summary: 'market_research prompt during load spike', output_summary: 'brief returned with variable depth', status: 'succeeded', failure_reason: null, validation_state: 'machine_checked', human_notes: ['output quality varies by prompt specificity'], confidence_delta: -1, evidence_artifact: 'artifact_market_research_run_002' },
  { receipt_id: 'receipt_003', timestamp: '2026-06-15T07:30:00.000Z', agent_id: 'agent_001', route_id: 'route_pay_sh_market_research_03', provider_id: 'provider_pay_sh_oracle', service_id: 'service_market_research', task_type: 'buy_market_research', cost: '0.31 USDC', payment_method: 'stablecoin', latency_ms: 810, input_summary: 'market research brief request', output_summary: 'validated structured research brief', status: 'succeeded', failure_reason: null, validation_state: 'human_validated', human_notes: ['high quality output'], confidence_delta: 7, evidence_artifact: 'artifact_market_research_run_003' },
  { receipt_id: 'receipt_004', timestamp: '2026-06-13T07:30:00.000Z', agent_id: 'agent_009', route_id: 'route_pay_sh_market_research_03', provider_id: 'provider_pay_sh_oracle', service_id: 'service_market_research', task_type: 'buy_market_research', cost: '0.31 USDC', payment_method: 'stablecoin', latency_ms: 860, input_summary: 'competitor scan request', output_summary: 'repeatable brief returned', status: 'succeeded', failure_reason: null, validation_state: 'human_validated', human_notes: ['repeatable structure'], confidence_delta: 5, evidence_artifact: 'artifact_market_research_run_004' },
  { receipt_id: 'receipt_005', timestamp: '2026-06-16T03:58:00.000Z', agent_id: 'agent_010', route_id: 'route_pay_sh_token_quote_01', provider_id: 'provider_pay_sh_quartz', service_id: 'service_token_pricing', task_type: 'price_token_quote', cost: '0.07 USDC', payment_method: 'stablecoin', latency_ms: 240, input_summary: 'SOL/USDC quote request', output_summary: 'bounded quote JSON', status: 'succeeded', failure_reason: null, validation_state: 'human_validated', human_notes: ['precise output'], confidence_delta: 6, evidence_artifact: 'artifact_token_quote_run_001' },
  { receipt_id: 'receipt_006', timestamp: '2026-06-15T03:58:00.000Z', agent_id: 'agent_010', route_id: 'route_pay_sh_token_quote_01', provider_id: 'provider_pay_sh_quartz', service_id: 'service_token_pricing', task_type: 'price_token_quote', cost: '0.07 USDC', payment_method: 'stablecoin', latency_ms: 250, input_summary: 'BONK/USDC quote request', output_summary: 'bounded quote JSON', status: 'succeeded', failure_reason: null, validation_state: 'human_validated', human_notes: ['clean schema'], confidence_delta: 4, evidence_artifact: 'artifact_token_quote_run_002' },
  { receipt_id: 'receipt_007', timestamp: '2026-06-11T03:58:00.000Z', agent_id: 'agent_011', route_id: 'route_pay_sh_token_quote_01', provider_id: 'provider_pay_sh_quartz', service_id: 'service_token_pricing', task_type: 'price_token_quote', cost: '0.07 USDC', payment_method: 'stablecoin', latency_ms: 290, input_summary: 'ETH/USDC quote request', output_summary: 'quote JSON', status: 'succeeded', failure_reason: null, validation_state: 'machine_checked', human_notes: [], confidence_delta: 2, evidence_artifact: 'artifact_token_quote_run_003' },
  { receipt_id: 'receipt_008', timestamp: '2026-05-22T07:45:00.000Z', agent_id: 'agent_004', route_id: 'route_pay_sh_receipt_parse_02', provider_id: 'provider_pay_sh_glass', service_id: 'service_receipt_parsing', task_type: 'extract_receipt_fields', cost: '0.12 USDC', payment_method: 'stablecoin', latency_ms: 740, input_summary: 'flat retail receipt pdf', output_summary: 'fields extracted with mild cleanup', status: 'succeeded', failure_reason: null, validation_state: 'stale', human_notes: ['useful but stale'], confidence_delta: -4, evidence_artifact: 'artifact_receipt_parse_run_001' },
  { receipt_id: 'receipt_009', timestamp: '2026-06-11T08:10:00.000Z', agent_id: 'agent_004', route_id: 'route_pay_sh_receipt_parse_02', provider_id: 'provider_pay_sh_glass', service_id: 'service_receipt_parsing', task_type: 'extract_receipt_fields', cost: '0.12 USDC', payment_method: 'stablecoin', latency_ms: 1260, input_summary: 'layout-heavy invoice pdf', output_summary: 'schema mismatch detected', status: 'failed', failure_reason: 'table layout unsupported', validation_state: 'machine_checked', human_notes: ['manual review needed'], confidence_delta: -9, evidence_artifact: 'artifact_receipt_parse_run_002' },
  { receipt_id: 'receipt_010', timestamp: '2026-06-15T13:00:00.000Z', agent_id: 'agent_015', route_id: 'route_pay_sh_compliance_scan_01', provider_id: 'provider_pay_sh_oracle', service_id: 'service_compliance_scan', task_type: 'run_compliance_scan', cost: '1.80 USDC', payment_method: 'stablecoin', latency_ms: 1680, input_summary: 'regulated counterpart scan request', output_summary: 'policy scan returned with flags', status: 'succeeded', failure_reason: null, validation_state: 'machine_checked', human_notes: ['claim-sensitive context'], confidence_delta: 3, evidence_artifact: 'artifact_compliance_run_001' },
  { receipt_id: 'receipt_011', timestamp: '2026-06-12T02:10:00.000Z', agent_id: 'agent_099', route_id: 'route_pay_sh_profile_scrape_09', provider_id: 'provider_x', service_id: 'service_private_profile_scrape', task_type: 'scrape_private_profile', cost: '0.90 USDC', payment_method: 'card', latency_ms: 3900, input_summary: 'private profile scrape request', output_summary: 'provider returned unsupported claim', status: 'failed', failure_reason: 'no recent successful receipt', validation_state: 'disputed', human_notes: ['invalid output', 'bad provider behavior'], confidence_delta: -18, evidence_artifact: 'artifact_provider_x_dispute_001' }
]);

const seedValidations = HumanValidationSubmissionSchema.array().parse([
  { target_type: 'receipt', target_id: 'receipt_003', validator_id: 'validator_001', validation_state: 'human_validated', output_quality_note: 'structured and directly usable', confidence_adjustment: 6, human_notes: 'Verified pre-spend decision quality.' },
  { target_type: 'provider', target_id: 'provider_x', validator_id: 'validator_002', validation_state: 'disputed', dispute_note: 'unsupported claims observed', blocker_note: 'no safe autonomous route', confidence_adjustment: -12, human_notes: 'No receipt, no trust.' },
  { target_type: 'route', target_id: 'route_pay_sh_receipt_parse_02', validator_id: 'validator_003', validation_state: 'stale', output_quality_note: 'usable on clean receipts only', confidence_adjustment: -4, human_notes: 'Fresh proof needed.' }
]);

export type PreSpendSeedState = {
  routes: SeedRouteIntelligence[];
  providers: SeedProviderIntelligenceRecord[];
  services: SeedServiceDossier[];
  receipts: SeedPreSpendReceipt[];
  validations: SeedHumanValidationSubmission[];
  metrics: {
    pre_spend_checks_completed: number;
    human_validations_submitted: number;
    failed_routes_avoided: number;
  };
};

export function createPreSpendSeedState(): PreSpendSeedState {
  return {
    routes: clone(seedRoutes),
    providers: clone(seedProviders),
    services: clone(seedServices),
    receipts: clone(seedReceipts),
    validations: clone(seedValidations),
    metrics: {
      pre_spend_checks_completed: 0,
      human_validations_submitted: seedValidations.length,
      failed_routes_avoided: 0
    }
  };
}
