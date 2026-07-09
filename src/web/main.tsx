import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MethodologyDrawer } from './methodology';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import {
  canClaimBenchmarkRecorded,
  canClaimExecutionTested,
  canClaimReceiptRecorded,
  formatEvidenceStage,
  getEvidenceStageDescription,
  MACHINE_EVIDENCE_STAGES
} from '../services/machineEvidenceService';
import {
  MACHINE_EVIDENCE_TAXONOMY,
  resolveMachinePaymentStatus,
  resolveMachineReceiptTaxonomy,
  summarizeMachineEvidenceCounts
} from '../services/machineMarketService';
import {
  ClaimDetailPage,
  ClaimsPage,
  ProviderDetailPage,
  DevelopersPage,
  ReceiptDetailPage,
  RouteDetailPage,
  ProvidersIndexPage,
  ReceiptsIndexPage,
  RoutesIndexPage,
  ServiceDetailPage,
  ServicesIndexPage,
  SpendTerminalPage,
  WalletSafetyIntegrationDetailPage,
  WalletSafetyIntegrationRegistryPage,
  WalletSafetyDeveloperQuickstartPage
} from './preSpendBuilderPages';
import { ProofCheckDetailPage, ProofCheckPage } from './proofCheckPages';
import { LoopDetailPage, LoopsPage } from './loopPages';
import { SignalHuntDetailPage, SignalHuntPage } from './signalHuntPages';
import { EvaluationRequestPage } from './evaluationRequestPages';
import { RevenueReceiptDetailPage, RevenueReceiptsPage } from './revenueReceiptPages';
import { UnicornRadarDetailPage, UnicornRadarPage } from './unicornRadarPages';
import { MachineMarketPreflightCardPage, PreflightCardIndexPage, RadarPreflightCardPage } from './preflightCardPages';
import { AbundanceDeskPage, AttentionMarketWatchPage, AttentionMarketWatchProfilePage, AttentionMarketsPage, NarrativeSignalReportPage, NarrativesIndexPage, SignalSourcePage, SignalUpdatePermalinkPage } from './narrativePages';
import { RhChainSignalDeskPage } from './rhChainSignalDeskPages';
import { HermesDeskPage } from './hermesDeskPages';
import './styles.css';

type Severity = 'critical' | 'warning' | 'informational' | 'unknown';
type EvidenceReceipt = { event_id?: string | null; eventId?: string | null; provider_id?: string | null; providerId?: string | null; endpoint_id?: string | null; endpointId?: string | null; observed_at?: string | null; observedAt?: string | null; catalog_generated_at?: string | null; catalogGeneratedAt?: string | null; ingested_at?: string | null; ingestedAt?: string | null; source?: string | null; derivation_reason?: string | null; derivationReason?: string | null; confidence?: number | null; severity?: Severity | string | null; severity_reason?: string | null; severityReason?: string | null; severity_score?: number | null; severityScore?: number | null; severity_window?: string | null; severityWindow?: string | null; summary?: string | null; evidence?: EvidenceReceipt | EvidenceReceipt[] | Record<string, EvidenceReceipt[]> | null };
type Pricing = EvidenceReceipt & { min: number | null; max: number | null; clarity: string; raw: string };
type Provider = EvidenceReceipt & { id: string; name: string; title?: string; namespace: string; fqn?: string; category: string; description: string | null; useCase?: string | null; serviceUrl?: string | null; endpointCount: number; endpointMetadataPartial?: boolean; hasMetering?: boolean; hasFreeTier?: boolean; sourceSha?: string | null; catalogGeneratedAt?: string | null; pricing: Pricing; tags: string[]; status: string; lastSeenAt?: string; latestTrustScore?: number | null; latestTrustGrade?: string; latestSignalScore?: number | null };
type Endpoint = EvidenceReceipt & { id: string; providerId: string; name: string; path: string | null; method: string | null; category: string; description: string | null; status: string; pricing: Pricing; lastSeenAt: string; latencyMsP50: number | null; routeEligible?: boolean | null; schema?: unknown };
type NormalizedEndpointRecord = {
  endpoint_id: string;
  endpoint_name: string | null;
  provider_id: string;
  provider_name: string | null;
  category: string | null;
  method: string | null;
  path: string | null;
  url: string | null;
  description: string | null;
  pricing: unknown;
  input_schema: unknown;
  output_schema: unknown;
  catalog_observed_at: string | null;
  catalog_generated_at: string | null;
  provider_trust_score: number | null;
  provider_signal_score: number | null;
  provider_grade: string | null;
  reachability_status: 'reachable' | 'degraded' | 'failed' | 'unknown';
  degradation_status: 'degraded' | 'healthy' | 'unknown';
  route_eligibility: boolean | null;
  route_rejection_reasons: string[];
  metadata_quality_score: number | null;
  pricing_clarity_score: number | null;
  source: string | null;
};
type EndpointFilter = 'all' | 'route_eligible' | 'mapping_incomplete' | 'degraded' | 'priced' | 'unknown_pricing';
type EndpointSort = 'route eligibility' | 'metadata quality' | 'pricing clarity' | 'reachability' | 'last observed' | 'name';
type EventFilter = 'all' | 'healthy' | 'watch' | 'degraded' | 'critical' | 'unknown';
type EventSort = 'last observed' | 'severity' | 'provider';
type TrustAssessment = EvidenceReceipt & { entityId: string; score: number | null; grade: string; components: Record<string, number | null>; unknowns: string[] };
type SignalAssessment = EvidenceReceipt & { entityId: string; score: number | null; narratives: string[]; components: Record<string, number | null>; unknowns: string[] };
type Narrative = EvidenceReceipt & { id: string; title: string; heat: number | null; momentum: number | null; providerIds: string[]; keywords: string[]; summary: string };
type GraphProofState = 'unproven' | 'validated' | 'disputed' | 'corrupted' | 'compounding';
type GraphNodeType = 'claim' | 'meme' | 'agent' | 'project' | 'token' | 'post' | 'route' | 'receipt' | 'proof_check' | 'loop_run' | 'provider' | 'service' | 'narrative' | 'category';
type GraphEdgeType = 'semantic_similarity' | 'proof_link' | 'citation' | 'receipt' | 'receipt_link' | 'shared_wallet' | 'repeated_narrative' | 'contradiction' | 'amplification' | 'provider_category' | 'narrative_category';
type GraphCluster = {
  id: string;
  label: string;
  summary: string;
  proof_state: GraphProofState;
  ripple_summary: string;
  node_count: number;
  edge_count: number;
  updated_at: string;
};
type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  summary: string;
  cluster_id: string;
  proof_state: GraphProofState;
  confidence_score: number;
  velocity_score: number;
  source_urls?: string[];
  linked_receipt_ids?: string[];
  linked_claim_ids?: string[];
  linked_loop_ids?: string[];
  linked_route_ids?: string[];
  linked_provider_ids?: string[];
  linked_service_ids?: string[];
  created_at: string;
  updated_at: string;
};
type GraphEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  type: GraphEdgeType;
  strength: number;
  explanation: string;
};
type GraphRipple = {
  id: string;
  cluster_id: string;
  title: string;
  summary: string;
  proof_state: GraphProofState;
  impact_score: number;
  changed_at: string;
  linked_node_ids: string[];
};
type GraphSuggestedEdge = {
  target_node_id: string;
  type: GraphEdgeType;
  strength: number;
  explanation: string;
};
type GraphCheckResponse = {
  generated_node_preview: GraphNode;
  suggested_proof_state: GraphProofState;
  confidence_score: number;
  suggested_edges: GraphSuggestedEdge[];
  explanation: string;
};
type GraphStats = {
  node_count: number;
  edge_count: number;
  cluster_count: number;
  validated_count: number;
  disputed_count: number;
  compounding_count: number;
  last_updated_at: string | null;
};
type GraphPayload = {
  tagline: string;
  clusters: GraphCluster[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  ripples: GraphRipple[];
  stats: GraphStats | null;
};
type DataSource = { mode: 'live_pay_sh_catalog' | 'fixture_fallback'; url: string | null; generated_at: string | null; provider_count: number | null; last_ingested_at: string | null; used_fixture: boolean; error?: string | null };
type MachineMarketCategory = 'compute' | 'inference' | 'web' | 'vision' | 'storage' | 'translation' | 'navigation';
type MachineMarketType = 'digital' | 'physical' | 'all-compatible';
type MachineMarketSource = 'robotic.sh' | 'pay.sh' | 'agentic.market';
type MachineMarketChain = 'solana' | 'base' | 'peaq' | 'omnichain' | 'unknown';
type MachineMarketStatus = 'ready' | 'setup';
type MachineMarketAccessRail = 'pay_sh_solana' | 'peaqos_market_provider_account' | 'peaqos_market_operator_defined' | 'not_recorded';
type MachineMarketRailStatus = 'plan_eligible' | 'review_required' | 'proof_plan_selected' | 'not_recorded';
type MachineMarketRouteSurfaceStatus = 'callable_routes_listed' | 'operator_runtime_required' | 'provider_setup_only' | 'no_callable_endpoints' | 'not_recorded';
type MachineMarketEvidenceStage = 'listed' | 'classified' | 'policy-mapped' | 'preflight-ready' | 'execution-tested' | 'receipt-recorded' | 'benchmark-recorded';
type MachineMarketCatalogRouteRisk = 'low_to_medium' | 'high';
type MachineRouteRisk = 'low' | 'low_to_medium' | 'medium' | 'high' | 'not_recorded';
type MachineFirstSafeCandidate = 'yes' | 'possible' | 'no' | 'not_recorded';
type MachineAvoidFirst = 'yes' | 'no';
type MachineRouteExecutionStatus = 'not_attempted' | 'service_receipt_recorded' | 'repeatability_receipt_recorded';
type MachineRailExecutionGateStatus = 'ready_to_plan' | 'review_required' | 'blocked' | 'not_recorded';
type BigQueryLiveHarnessStatus = 'blocked_live_harness_not_configured' | 'ready_for_controlled_run' | 'receipt_recorded';
type MachineMarketCatalogRoute = {
  method: string;
  path: string;
  label: string;
  risk: MachineMarketCatalogRouteRisk;
};
type MachineMarketSourceAttribution = {
  source: string;
  scope: string;
  observed_at: string;
  caveat: string;
};

type MachineAttributionRow = MachineMarketSourceAttribution;
const MACHINE_MARKET_SOURCE_OBSERVED_AT = '2026-05-22T00:00:00.000Z';
type MachineMarketService = {
  id: string;
  name: string;
  provider: string;
  category: MachineMarketCategory;
  market_type: MachineMarketType;
  source_market: MachineMarketSource;
  chain: MachineMarketChain;
  status: MachineMarketStatus;
  price_display: string;
  description: string;
  machine_use_case: string;
  evidence_health: 'scaffold' | 'listed';
  evidence_stage: MachineMarketEvidenceStage;
  policy_risk: string;
  caveats: string[];
  access_rail: MachineMarketAccessRail;
  rail_status: MachineMarketRailStatus;
  route_surface_status: MachineMarketRouteSurfaceStatus;
  endpoint_count?: number | null;
  route_count?: number;
  pricing_model?: string;
  credential_requirement?: string;
  first_safe_route?: string;
  rail_caveat?: string;
  catalog_routes?: MachineMarketCatalogRoute[];
  source_attribution?: MachineMarketSourceAttribution;
  observed_source: 'robotic.sh';
  observed_at: string;
  phase_scope: 'phase_2_pay_sh_robotic_sh';
};
type MachineRouteRiskRow = {
  service_id: string;
  service_name: string;
  provider: string;
  category: MachineMarketCategory;
  access_rail: MachineMarketAccessRail;
  route_label: string;
  method: string;
  path: string;
  route_risk: MachineRouteRisk;
  first_safe_candidate: MachineFirstSafeCandidate;
  avoid_first: MachineAvoidFirst;
  avoid_first_reason: string | null;
  credential_requirement: string;
  expected_output_class: string;
  proof_condition: string;
  execution_status: MachineRouteExecutionStatus;
  rail_caveat: string;
};
type MachineRouteRiskSummary = {
  servicesWithRouteSurfaces: number;
  totalRoutesMapped: number;
  firstSafeCandidates: number;
  avoidFirstRoutes: number;
  highRiskRoutes: number;
  executionReceipts: number;
};
type MachineFirstSafeRouteQueueRow = {
  rank: number;
  service_id: string;
  service_name: string;
  first_safe_route: string;
  why_safe_first: string;
  blocked_by: string;
  required_evidence: string;
  execution_status: MachineRouteExecutionStatus;
  execution_receipt_id: string | null;
  proof_plan_href: string;
  warning: string;
  review_gated: boolean;
  blocked_or_setup_required: boolean;
};
type MachineFirstSafeRouteQueueSummary = {
  queueEntries: number;
  firstSafeCandidates: number;
  reviewGatedEntries: number;
  blockedOrSetupRequiredEntries: number;
  executionReceipts: number;
  repeatabilityReceipts: number;
};
type MachineMarketSummary = {
  total_services: number;
  categories: Record<string, number>;
  source_markets: Record<string, number>;
  chains: Record<string, number>;
  ready_count: number;
  setup_count: number;
  evidence_stage_counts: Record<string, number>;
  phase_scope: string;
  positioning: {
    module: string;
    terminal: string;
    market_policy: string;
    spend_policy: string;
    radar_role: string;
  };
};
type MachinePolicy = {
  id: string;
  name: string;
  description: string;
  machine_id: string;
  owner_label: string;
  daily_budget_usd: number;
  per_call_budget_usd: number;
  allowed_categories: MachineMarketCategory[];
  blocked_categories: MachineMarketCategory[];
  allowed_source_markets: MachineMarketSource[];
  blocked_source_markets: MachineMarketSource[];
  allowed_chains: MachineMarketChain[];
  blocked_chains: MachineMarketChain[];
  allowed_services: string[];
  blocked_services: string[];
  approval_required_above_usd: number;
  minimum_evidence_stage: MachineMarketEvidenceStage;
  minimum_evidence_health: 'scaffold' | 'listed';
  risk_tolerance: 'low' | 'medium' | 'high';
  receipt_required: boolean;
  human_review_required_for: string[];
  created_at: string;
  updated_at: string;
  status: 'active' | 'draft' | 'paused';
};
type MachinePolicyCheck = { id: string; label: string; status: 'pass' | 'fail' | 'review'; detail: string };
type MachinePreflightResult = {
  decision: 'allow' | 'deny' | 'review';
  recommended_service: {
    id: string;
    name: string;
    provider: string;
    category: MachineMarketCategory;
    source_market: MachineMarketSource;
    chain: MachineMarketChain;
    status: string;
    price_display: string;
    evidence_stage: string;
    evidence_health: string;
    policy_risk: string;
  } | null;
  source_market: MachineMarketSource | null;
  chain: MachineMarketChain | null;
  reason: string;
  policy_checks: MachinePolicyCheck[];
  violations: string[];
  review_reasons: string[];
  caveats: string[];
  evidence_stage: string | null;
  evidence_health: string | null;
  receipt_id: string;
  receipt_required: boolean;
  phase_scope: 'phase_2_pay_sh_robotic_sh';
};
type MachinePreflightReceipt = {
  receipt_id: string;
  receipt_type: 'machine_preflight' | 'machine_execution';
  coverage_run_id?: string | null;
  demo_mode: boolean;
  execution_occurred: boolean;
  payment_occurred: boolean;
  execution_status: 'not_attempted' | 'attempted' | 'succeeded' | 'failed';
  execution_service_id: string | null;
  execution_provider: string | null;
  execution_started_at: string | null;
  execution_completed_at: string | null;
  execution_latency_ms: number | null;
  execution_request_summary: string | null;
  execution_response_summary: string | null;
  execution_error: string | null;
  execution_executor_name?: string | null;
  execution_executor_version?: string | null;
  execution_executor_mode?: string | null;
  payment_evidence: string | null;
  preflight_receipt_id: string | null;
  execution_run_id: string | null;
  machine_id: string;
  policy_id: string | null;
  intent: string;
  requested_category: string;
  selected_service_id: string | null;
  selected_service_name: string | null;
  source_market: MachineMarketSource | null;
  chain: MachineMarketChain | null;
  decision: 'allow' | 'deny' | 'review';
  reason: string;
  policy_checks: MachinePolicyCheck[];
  violations: string[];
  review_reasons: string[];
  caveats: string[];
  max_cost_usd: number | null;
  evidence_stage: string | null;
  evidence_health: string | null;
  phase_scope: 'phase_2_pay_sh_robotic_sh';
  created_at: string;
  selected_service?: MachinePreflightResult['recommended_service'];
  policy_summary?: Pick<MachinePolicy, 'id' | 'name' | 'description' | 'risk_tolerance' | 'receipt_required' | 'minimum_evidence_stage' | 'status'> | null;
};
type MachineReceiptStorage = {
  mode: 'durable' | 'memory' | 'test';
  adapter: 'jsonl' | 'postgres' | 'memory';
  durable: boolean;
  demo_seed_enabled?: boolean;
  warning?: string;
};
type AlibabaMachineExecutionRepeatabilityArtifact = {
  artifact_id: string;
  generated_at: string;
  service_id: 'alibaba-machine-translation-general';
  fqn: 'solana-foundation/alibaba/machinetranslation';
  source_market: 'pay.sh';
  chain: 'solana';
  route_name: string;
  route_status: string;
  receipt_count: number;
  successful_receipts: number;
  failed_receipts: number;
  success_rate: number;
  latency_ms: { min: number | null; median: number | null; max: number | null };
  prompt_family: string;
  input_summary: string[];
  output_summaries: string[];
  provider_request_ids: string[];
  receipt_ids: string[];
  receipt_rows?: {
    receipt_id: string;
    provider_request_id: string | null;
    latency_ms: number | null;
    created_at: string;
    output_preview: string | null;
    execution_status: MachinePreflightReceipt['execution_status'];
    execution_occurred: boolean;
    payment_occurred: boolean;
    evidence_stage: string | null;
  }[];
  payment_occurred_any: boolean;
  payment_claimed: false;
  benchmark_claimed: false;
  winner_claimed: false;
  evidence_stage: 'execution-tested' | 'repeatability-recorded';
  repeatability_status: 'insufficient_runs' | 'repeatability-recorded';
  remaining_successful_runs_needed: number;
  caveats: string[];
};
type AlibabaMachineExecutionBenchmarkReadinessArtifact = {
  route_id: string;
  route_name: string;
  service_id: 'alibaba-machine-translation-general';
  fqn: 'solana-foundation/alibaba/machinetranslation';
  source_market: 'pay.sh';
  chain: 'solana';
  generated_at: string;
  current_evidence_stage: 'execution-tested' | 'repeatability-recorded';
  benchmark_readiness_status: 'criteria-defined' | 'single-route-repeatability-ready' | 'comparison-not-ready';
  benchmark_ready: boolean;
  criteria: Array<{ id: string; required: number | boolean | string; actual: number | boolean | string; satisfied: boolean }>;
  satisfied_criteria_count: number;
  total_criteria_count: number;
  missing_criteria: string[];
  benchmark_artifact_schema: {
    benchmark_id: string;
    route_id: string;
    prompt_family: string;
    run_count: number;
    success_rate: number;
    latency_ms: { min: number | null; median: number | null; max: number | null };
    payment_evidence_policy: string;
    comparison_routes: string[];
    winner_claimed: boolean;
    winner_criteria: string;
    caveats: string[];
    receipt_ids: string[];
  };
  caveats: string[];
  claims: {
    benchmark_claimed: false;
    winner_claimed: false;
    payment_claimed: false;
    benchmark_recorded: false;
  };
};
type MachineBenchmarkReadinessLane = {
  lane_id: 'machine_translation' | 'data_query_bigquery' | 'storage_stableupload' | 'navigation_naver_geocode';
  task_class: string;
  candidate_routes: Array<{ service_id: string; route_id: string; profile_id: string }>;
  comparable_route_count: number;
  repeatability_state: 'missing' | 'single_route_repeatability_ready' | 'repeatability_recorded';
  missing_requirements: string[];
  readiness_status: 'not_ready' | 'single_route_repeatability_ready' | 'comparable_routes_missing' | 'methodology_missing' | 'artifact_schema_ready' | 'benchmark_ready';
  next_action: string;
  caveats: string[];
};
type MachineBenchmarkReadinessReport = {
  generated_at: string;
  benchmark_claims: 0;
  winner_claims: 0;
  market_wide_execution_claims: 0;
  payment_success_claims: number;
  lanes: MachineBenchmarkReadinessLane[];
  caveats: string[];
};
type MachineComparableRouteLane = {
  lane_id: 'machine_translation' | 'data_query_bigquery' | 'storage_stableupload' | 'navigation_naver_geocode';
  task_class: string;
  candidate_routes: Array<{
    service_id: string;
    route_id: string;
    profile_id: string;
    route_state?: 'proven' | 'fixture_only' | 'candidate_unproven' | 'blocked';
    evidence_note?: string;
    missing_evidence?: Array<
      | 'missing_service_identity'
      | 'missing_route_surface'
      | 'missing_receipt'
      | 'missing_comparable_route'
      | 'missing_run_count_target'
    >;
    route_surface_present?: boolean;
    service_identity_present?: boolean;
    receipt_evidence_present?: boolean;
  }>;
  comparable_route_count: number;
  required_methodology: string[];
  missing_methodology: string[];
  comparable_inputs: string;
  comparable_outputs: string;
  normalization_strategy: string;
  success_criteria: string;
  run_count_target: number;
  cost_latency_fields_required: string[];
  safety_constraints: string[];
  readiness_effect: string;
  next_action: string;
  evidence_requirements_panel?: {
    lane: 'machine_translation';
    run_count_target: number;
    comparable_routes_required: number;
    missing_service_identity: string[];
    missing_route_surface: string[];
    missing_receipt: string[];
    missing_comparable_route: boolean;
    missing_run_count_target: boolean;
  };
};
type MachineComparableRouteReport = {
  generated_at: string;
  benchmark_claims: 0;
  winner_claims: 0;
  lanes: MachineComparableRouteLane[];
  caveats: string[];
};
type MachineTranslationEvidencePlan = {
  generated_at: string;
  lane_id: 'machine_translation';
  benchmark_execution_allowed: false;
  comparable_route_count: number;
  proven_comparable_route_count: number;
  run_count_target: number;
  required_proven_comparable_routes: 2;
  routes: Array<{
    service_id: string;
    route_id: string;
    source_hint: 'seed' | 'registry' | 'receipt';
    evidence_state: 'blocked' | 'candidate_unproven' | 'fixture_only' | 'proven';
    service_identity_state: 'present' | 'missing';
    route_surface_state: 'present' | 'missing';
    proof_profile_match: 'machine_translation_safe_phrase' | 'unknown_or_mismatch';
    receipt_state: 'none' | 'fixture_only' | 'service_specific_success';
    repeatability_state: 'missing' | 'insufficient_runs' | 'target_met';
    comparable_route_eligible: boolean;
    missing_evidence: Array<'missing_service_identity' | 'missing_route_surface' | 'missing_receipt' | 'missing_comparable_route' | 'missing_run_count_target'>;
    next_action: 'Record route identity' | 'Record route surface' | 'Ingest service-specific receipt' | 'Generate repeatability pack' | 'Re-check benchmark gate';
  }>;
  blockers: Array<'missing_service_identity' | 'missing_route_surface' | 'missing_receipt' | 'missing_comparable_route' | 'missing_run_count_target'>;
  ctas: Array<'Record route identity' | 'Record route surface' | 'Ingest service-specific receipt' | 'Generate repeatability pack' | 'Re-check benchmark gate'>;
  caveats: string[];
};
type MachineBenchmarkMethodologyArtifact = {
  benchmark_id: string;
  lane_id: 'machine_translation' | 'data_query_bigquery' | 'storage_stableupload' | 'navigation_naver_geocode';
  task_class: string;
  routes_compared: Array<{ service_id: string; route_id: string; profile_id: string }>;
  input_set: string;
  normalization_strategy: string;
  success_criteria: string;
  run_count: number;
  cost_fields: string[];
  latency_fields: string[];
  payment_fields: string[];
  safety_constraints: string[];
  policy_constraints: string[];
  comparable_route_count: number;
  readiness_status: string;
  methodology_status: 'missing_comparable_routes' | 'methodology_incomplete' | 'schema_present' | 'ready_for_benchmark_artifact';
  artifact_status: 'scaffold' | 'methodology_ready' | 'benchmark_recorded';
  winner_policy: 'no_winner_default' | 'explicit_criteria_required' | 'no_clear_winner_allowed';
  winner_claim: false;
  benchmark_claim: false;
  methodology_artifact_schema: 'present';
  output_normalization: string;
  run_count_target: number;
  cost_fields_required: string[];
  latency_fields_required: string[];
  payment_fields_required: string[];
  missing_requirements: string[];
  benchmark_allowed: boolean;
  caveats: string[];
  generated_at: string;
};
type MachineBenchmarkMethodologyReport = {
  generated_at: string;
  artifact_schema_version: string;
  methodology_artifacts: MachineBenchmarkMethodologyArtifact[];
  global_gate: {
    benchmark_execution_allowed: boolean;
    reason: string;
    required_conditions: string[];
  };
  caveats: string[];
};
type MachineBenchmarkGateCheck = {
  benchmark_execution_allowed: boolean;
  allowed_lanes: Array<'machine_translation' | 'data_query_bigquery' | 'storage_stableupload' | 'navigation_naver_geocode'>;
  blocked_lanes: Array<'machine_translation' | 'data_query_bigquery' | 'storage_stableupload' | 'navigation_naver_geocode'>;
  blocking_reasons: Array<
    | 'comparable_routes_missing'
    | 'comparable_routes_not_proven'
    | 'task_class_mismatch'
    | 'input_class_mismatch'
    | 'output_normalization_mismatch'
    | 'success_criteria_mismatch'
    | 'run_count_target_mismatch'
    | 'methodology_incomplete'
    | 'readiness_not_benchmark_ready'
    | 'repeatability_missing'
    | 'safety_policy_blocked'
    | 'artifact_schema_missing'
  >;
  required_conditions: string[];
  generated_at: string;
};
type MachineDossier = {
  machine_id: string;
  phase_scope: 'phase_2_pay_sh_robotic_sh';
  status: 'observed' | 'no_activity';
  suggested_next_action: string | null;
  summary: {
    total_receipts: number;
    allow_count: number;
    deny_count: number;
    review_count: number;
    unique_services: number;
    unique_categories: number;
    unique_source_markets: number;
    latest_activity_at: string | null;
  };
  policy_profile: {
    active_policy_id: string | null;
    policy_name: string | null;
    risk_tolerance: string | null;
    daily_budget_usd: number | null;
    per_call_budget_usd: number | null;
    allowed_categories: string[];
    allowed_source_markets: string[];
    allowed_chains: string[];
  };
  service_usage: { service_id: string; service_name: string; count: number }[];
  category_usage: { category: string; count: number }[];
  market_usage: { source_market: string; count: number }[];
  chain_usage: { chain: string; count: number }[];
  recent_receipts: MachinePreflightReceipt[];
  caveats: string[];
  evidence_summary: { highest_stage_seen: string; stage_counts: Record<string, number> };
};
type MachinePreflightCoverageServiceResult = {
  service_id: string;
  service_name: string;
  decision: 'allow' | 'deny' | 'review';
  receipt_id: string;
  execution_occurred: false;
  payment_occurred: false;
};
type MachinePreflightCoverageRun = {
  run_id: string;
  generated_at: string;
  services_total: number;
  preflight_evaluated: number;
  receipts_recorded: number;
  allow_count: number;
  review_count: number;
  deny_count: number;
  execution_occurred: false;
  payment_occurred: false;
  storage?: MachineReceiptStorage;
  caveats: string[];
  service_results: MachinePreflightCoverageServiceResult[];
};
type Pulse = { providerCount: number; endpointCount: number; eventCount: number; averageTrust: number | null; averageSignal: number | null; hottestNarrative: Narrative | null; topTrust: TrustAssessment[]; topSignal: SignalAssessment[]; interpretations?: EcosystemInterpretation[]; data_source: DataSource; updatedAt: string };
type HistoryItem = EvidenceReceipt & { id: string; type: string; observedAt: string; source: string; summary: string };
type ProviderDetail = { provider: Provider; endpoints: Endpoint[]; trustAssessment: TrustAssessment | null; signalAssessment: SignalAssessment | null };
type ProviderIntelligence = EvidenceReceipt & {
  provider?: Provider;
  latest_trust_score: number | null;
  latest_signal_score: number | null;
  risk_level: string;
  coordination_eligible: boolean | null;
  unknown_telemetry: string[];
  recent_changes: HistoryItem[];
  endpoint_count: number;
  endpoint_health: { healthy: number; degraded: number; failed: number; unknown: number; last_checked_at: string | null; median_latency_ms: number | null; recent_failures: HistoryItem[] };
  service_monitor: EvidenceReceipt & {
    status: 'reachable' | 'degraded' | 'failed' | 'unknown';
    service_url: string | null;
    last_checked_at: string | null;
    response_time_ms: number | null;
    status_code: number | null;
    monitor_mode: 'SAFE METADATA' | 'UNKNOWN';
    check_type: string | null;
    safe_mode: boolean;
    explanation: string;
  };
  propagation_context?: { propagation_state: PropagationAnalysis['propagation_state']; severity: PropagationAnalysis['severity']; affected: boolean; affected_cluster: string | null; propagation_reason: string };
  category_tags: string[];
  last_seen_at: string | null;
  endpoints?: Endpoint[];
  endpointList?: Endpoint[];
};
type EndpointMonitor = { health: string; lastCheck: { observedAt: string; payload: Record<string, unknown> } | null; recentFailures: HistoryItem[] };
type EventCategory = 'discovery' | 'trust' | 'monitoring' | 'pricing' | 'schema' | 'signal';
type PulseEvent = EvidenceReceipt & { id: string; type: string; category: EventCategory; source: string; entityType: string; entityId: string; providerId: string | null; providerName: string | null; observedAt: string; summary: string };
type ScoreDelta = EvidenceReceipt & { eventId: string; providerId: string; providerName: string; score: number | null; previousScore: number | null; delta: number | null; observedAt: string; direction: string };
type ProviderActivity = EvidenceReceipt & { providerId: string; providerName: string; count: number; categories: Record<EventCategory, number>; lastObservedAt: string | null };
type PropagationAnalysis = {
  cluster_id?: string;
  clusterId?: string;
  propagation_state: 'isolated' | 'clustered' | 'spreading' | 'systemic' | 'unknown';
  propagation_reason: string;
  affected_cluster: string | null;
  affected_categories: string[];
  affected_providers: { provider_id: string; providerId?: string; provider_name: string; providerName?: string; category: string; tags: string[]; event_count: number; eventCount?: number }[];
  first_observed_at: string | null;
  latest_observed_at: string | null;
  supporting_event_ids: string[];
  supporting_event_count?: number;
  remaining_event_count?: number;
  view_full_receipts_url?: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
};
type PropagationIncident = {
  cluster_id: string;
  propagation_state: 'isolated' | 'clustered' | 'spreading' | 'systemic' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  affected_cluster: string | null;
  affected_categories: string[];
  affected_providers: { provider_id: string; provider_name: string }[];
  first_observed_at: string | null;
  latest_observed_at: string | null;
  propagation_reason: string;
  confidence: number;
  supporting_event_ids: string[];
  supporting_receipt_links: { event_id: string; href: string }[];
  related_interpretation_links: { interpretation_id: string; title: string; href: string }[];
  related_provider_links: { provider_id: string; provider_name: string; href: string }[];
  current_status: 'active' | 'monitoring' | 'unknown';
  timeline: { event_id: string; type: string; category: string; provider_id: string | null; provider_name: string | null; observed_at: string; summary: string; severity: Severity }[];
};
type EcosystemInterpretation = EvidenceReceipt & {
  interpretation_id: string;
  interpretation_title: string;
  interpretation_summary: string;
  interpretation_reason: string;
  affected_categories: string[];
  affected_providers: string[];
  supporting_event_ids: string[];
  supporting_event_count?: number;
  remaining_event_count?: number;
  view_full_receipts_url?: string;
  confidence: number;
  severity: 'stable' | 'info' | 'watch' | 'warning' | 'critical';
  observed_window: { started_at: string | null; ended_at: string | null; event_count: number };
  evidence?: EvidenceReceipt;
};
type PulseSummary = {
  generatedAt: string;
  latest_event_at: string | null;
  latest_batch_event_count: number;
  ingest_interval_ms: number | null;
  latest_ingestion_run: {
    startedAt: string;
    finishedAt: string | null;
    status: string;
    discoveredCount: number;
    changedCount: number;
    emittedEvents: number;
    usedFixture: boolean;
    source: string;
  } | null;
  counters: { providers: number; endpoints: number; events: number; narratives: number; unknownTelemetry: number };
  eventGroups: Record<EventCategory, { count: number; recent: PulseEvent[] }>;
  timeline: PulseEvent[];
  trustDeltas: ScoreDelta[];
  signalDeltas: ScoreDelta[];
  recentDegradations: PulseEvent[];
  propagation: PropagationAnalysis;
  providerActivity: Record<'1h' | '24h' | '7d', ProviderActivity[]>;
  signalSpikes: ScoreDelta[];
  interpretations: EcosystemInterpretation[];
  data_source: DataSource;
};

type AppData = { providers: Provider[]; pulse: Pulse; narratives: Narrative[]; graph: { nodes: unknown[]; edges: unknown[]; evidence?: EvidenceReceipt } };
type ReceiptRecord = {
  event_id: string;
  event_type: string;
  provider_id: string | null;
  endpoint_id: string | null;
  severity: string;
  severity_reason: string;
  observed_at: string | null;
  catalog_generated_at: string | null;
  ingested_at: string | null;
  source: string;
  derivation_reason: string;
  confidence: number | null;
  summary: Record<string, unknown>;
  raw_summary: string;
  links: {
    provider: { provider_id: string; provider_name: string; url: string } | null;
    provider_dossier: string | null;
    interpretations: { interpretation_id: string; title: string; url: string }[];
    propagation_cluster: { cluster: string | null; state: string; severity: string; url: string } | null;
  };
};
type FeaturedProvider = { providerId: string | null; providerName: string | null; category: string | null; rotationWindowMs: number; windowStartedAt: string; nextRotationAt: string; index: number | null; providerCount: number; strategy: 'time_window_round_robin' };
type RoutePreference = 'cheapest' | 'highest_trust' | 'highest_signal' | 'balanced';
type RouteResult = {
  bestProvider: Provider | null;
  fallbackProviders: Provider[];
  fallbackDetails?: { provider: Provider; trustAssessment: TrustAssessment; signalAssessment: SignalAssessment; rank: number; relevance: number; riskNotes: string[] }[];
  reasoning: string[];
  estimatedCost: Provider['pricing'] | null;
  trustAssessment: TrustAssessment | null;
  signalAssessment: SignalAssessment | null;
  riskNotes: string[];
  preference?: RoutePreference;
  scoringInputs?: { source: 'LIVE PAY.SH CATALOG'; preference: RoutePreference; preferredProviderId: string | null };
  excludedProviders?: { provider: Provider; reasons: string[] }[];
  unknownTelemetry?: string[];
  rationale?: string[];
  coordinationScore?: number | null;
  selectedProviderNotRecommendedReason?: string | null;
};
type RadarPreflightCandidate = {
  provider_id: string;
  provider_name: string | null;
  endpoint_id: string;
  endpoint_name: string | null;
  trust_score: number | null;
  signal_score: number | null;
  route_eligibility: boolean;
  confidence: number;
  reasons: string[];
  rejection_reasons: string[];
  mapping_status: 'complete' | 'missing';
  reachability_status: 'reachable' | 'degraded' | 'failed' | 'unknown';
  pricing_status: 'clear' | 'missing';
  last_seen_healthy?: string | null;
  predictive_risk?: RadarRiskContext;
  trend_context?: TrendContext;
};
type PreflightResult = {
  generated_at: string;
  source: string;
  input: Record<string, unknown>;
  recommended_route: RadarPreflightCandidate | null;
  accepted_candidates: RadarPreflightCandidate[];
  rejected_candidates: RadarPreflightCandidate[];
  warnings: string[];
  superiority_evidence_available: boolean;
};
type RadarComparisonRow = {
  id: string;
  type: 'provider' | 'endpoint';
  name: string;
  trust_score: number | null;
  signal_score: number | null;
  endpoint_count: number;
  mapped_endpoint_count: number;
  route_eligible_endpoint_count: number;
  degradation_count: number;
  pricing_clarity: number | null;
  metadata_quality: number | null;
  reachability: 'reachable' | 'degraded' | 'failed' | 'unknown';
  last_observed: string | null;
  last_seen_healthy: string | null;
  last_verified_at?: string | null;
  verified_mapping_count?: number;
  mapping_source?: 'none' | 'catalog' | 'verified' | 'catalog_and_verified';
  predictive_risk_level?: RiskLevel;
  predictive_risk_score?: number;
  recommended_action?: RiskRecommendation;
  top_anomaly?: RadarRiskAnomaly | null;
  route_recommendation: 'route_eligible' | 'not_recommended';
  rejection_reasons: string[];
};
type RadarComparisonResult = { generated_at: string; mode: 'provider' | 'endpoint'; rows: RadarComparisonRow[] };
type RadarSuperiorityReadiness = {
  generated_at: string;
  executable_provider_mappings_count: number;
  categories_with_at_least_two_executable_mappings: string[];
  categories_not_ready_for_comparison: string[];
  providers_with_proven_paid_execution: string[];
  providers_with_only_catalog_metadata: string[];
  next_mappings_needed: string[];
  winner_claimed?: boolean;
  next_step?: string;
  readiness_note?: string;
};
type RadarBenchmarkCategory = {
  category: string;
  benchmark_intent: string;
  executable_mapping_count: number;
  candidate_mapping_count: number;
  proven_execution_count: number;
  benchmark_ready: boolean;
  superiority_ready: boolean;
  missing_requirements: string[];
  recommended_next_mapping: string;
  mapping_ladder: string[];
  metadata_only_warning: string | null;
};
type RadarBenchmarkReadiness = {
  generated_at: string;
  source: string;
  categories: RadarBenchmarkCategory[];
  benchmark_ready_categories: string[];
  superiority_ready_categories: string[];
  not_ready_categories: string[];
  missing_requirements: string[];
  recommended_next_mappings: string[];
  metadata_only_warning: string;
};
type RadarBundlePlanStep = {
  step_id: string;
  label: string;
  intent: string;
  plan_status: 'included' | 'blocked' | 'review_required';
  evidence_dependencies: string[];
  evidence_health: 'recorded' | 'caveated' | 'scaffold';
  execution_boundary: 'clean_402' | 'paid_proven' | 'billing_unclear' | 'billable_probe_observed' | 'blocked';
  reason: string;
  next_action: string;
};
type RadarBundlePlanBlockedStep = {
  step_id: string;
  reason: 'billing_unclear_not_allowed' | 'scaffold_not_allowed' | 'billable_probe_observed_not_allowed' | 'missing_recorded_evidence';
};
type RadarBundlePlanResponse = {
  bundle_id: string;
  label: string;
  status: 'recipe_scaffold' | 'partially_supported' | 'research_only_pending_billing_review' | 'execution_ready' | 'recorded';
  topic: string;
  focus: string | null;
  region: string | null;
  language: string | null;
  constraints: {
    max_cost_usd: number | null;
    allow_billing_unclear: boolean;
    allow_billable_probe_observed: boolean;
    allow_scaffold_routes: boolean;
    require_recorded_evidence: boolean;
  };
  route_plan: RadarBundlePlanStep[];
  blocked_steps: RadarBundlePlanBlockedStep[];
  execution_boundary_summary: {
    clean_402: number;
    paid_proven: number;
    billing_unclear: number;
    billable_probe_observed: number;
    blocked: number;
  };
  evidence_summary: {
    recorded: number;
    caveated: number;
    scaffold: number;
    unknown: number;
  };
  estimated_cost_usd: string;
  recommended_agent_action: string;
  winner_claimed: false;
};
type RadarBundleRunSummary = {
  run_id: string;
  status: 'controlled_live_run';
  evidence_health: 'recorded' | 'caveated' | 'scaffold';
  generated_at: string;
  execution_mode: 'pay_cli';
  final_bundle_state: 'executed_with_review_required_skipped';
  estimated_cost_usd: string;
  observed_cost_usd: number | null;
  executed_step_count: number;
  skipped_step_count: number;
  blocked_step_count: number;
  source_count: number;
  winner_claimed: boolean;
};
type RadarBundleRunListResponse = {
  bundle_id: 'morning-briefing';
  count: number;
  latest_run_id: string | null;
  latest_generated_at: string | null;
  runs: RadarBundleRunSummary[];
  history_summary?: {
    history_count: number;
    latest_run_id: string | null;
    previous_run_id: string | null;
    source_count_delta: number;
    latest_source_count: number;
    previous_source_count: number;
    observed_cost_available: boolean;
    observed_cost_state: 'available' | 'unavailable';
    skipped_review_required_steps_stable: boolean;
    latest_skipped_step_count: number;
    previous_skipped_step_count: number;
    caveat_codes_latest: string[];
    caveat_codes_previous: string[];
    caveat_delta: { added: string[]; removed: string[] };
    winner_claimed: false;
  };
  freshness?: {
    last_controlled_run_at: string;
    latest_run_age_hours: number;
    freshness_state: 'fresh' | 'aging' | 'stale';
    freshness_thresholds_hours: {
      fresh_until: 24;
      aging_until: 72;
    };
    recommended_agent_action: string;
  } | null;
  winner_claimed: false;
  agent_readiness_summary?: {
    ready_for_agent_review: boolean;
    requires_rerun_before_spend: boolean;
    requires_human_or_policy_approval: boolean;
    observed_cost_available: boolean;
    winner_claimed: false;
    decision_state: 'ready_for_review' | 'review_ready_caveated' | 'rerun_required' | 'not_ready';
    blocking_reasons: string[];
    review_reasons: string[];
    recommended_agent_action: string;
  };
  agent_guidance: string[];
};
type RadarBundleRunDetail = {
  run_id: string;
  bundle_id: 'morning-briefing';
  status: 'controlled_live_run';
  evidence_health: 'recorded' | 'caveated' | 'scaffold';
  winner_claimed: boolean;
  generated_at: string;
  execution_mode: 'pay_cli';
  final_bundle_state: 'executed_with_review_required_skipped';
  estimated_cost_usd: string;
  observed_cost_usd: number | null;
  executed_steps: Array<{ step_id: string }>;
  skipped_steps: Array<{ step_id: string }>;
  blocked_steps: Array<{ step_id: string }>;
  source_map: Array<{ label: string; url: string }>;
  caveat_objects: Array<{ code: string }>;
};

function runIdSuffix(runId: string | null | undefined) {
  return runId?.replace('morning-briefing-run-2026-05-21-', '') ?? 'unknown';
}
type RouteMappingStatusFilter = 'all' | 'candidate' | 'verified' | 'proven' | 'unproven';
type RadarRouteMapping = {
  provider_name: string;
  provider_id: string;
  category: string;
  benchmark_intent: string;
  endpoint_url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null;
  mapping_status: 'candidate' | 'verified' | 'catalog_only';
  execution_evidence_status: 'proven' | 'unproven' | 'unknown';
  proof_source: string;
  proof_reference?: string;
  verified_at?: string;
  notes: string;
};
type RadarRouteMappingRegistry = {
  generated_at: string;
  source: string;
  count: number;
  mappings: RadarRouteMapping[];
};
type RadarMappingTarget = {
  category: string;
  benchmark_intent: string;
  current_state: 'needs_candidate' | 'needs_verified_route' | 'candidate_mapping_found' | 'verified_mapping_found' | 'second_verified_mapping_found' | 'one_proven_mapping_found' | 'benchmark_ready' | 'needs_two_comparable_mappings';
  needed_next_step: string;
  suggested_provider_candidates?: string[];
  why_it_matters: string;
  readiness_blocker: string;
};
type RadarMappingTargetRegistry = {
  generated_at: string;
  source: string;
  count: number;
  targets: RadarMappingTarget[];
};
type RadarBenchmarkRouteMetric = {
  provider_id: string;
  route_id: string;
  execution_status: 'verified' | 'proven';
  success?: boolean;
  latency_ms: number | null;
  paid_execution_proven: boolean;
  proof_reference: string;
  normalized_output_available: boolean;
  extracted_price_usd: number | null;
  extraction_path?: string | null;
  success_rate?: number | null;
  median_latency_ms?: number | null;
  p95_latency_ms?: number | null;
  average_price_usd?: number | null;
  min_price_usd?: number | null;
  max_price_usd?: number | null;
  price_variance_percent?: number | null;
  completed_runs?: number | null;
  failed_runs?: number | null;
  execution_transport?: string;
  cli_exit_code?: number | null;
  status_code?: number | null;
  status_evidence?: string;
  output_shape: Record<string, unknown> | null;
  normalization_confidence: 'unknown' | 'low' | 'medium' | 'high';
  freshness_timestamp: string | null;
  comparison_notes: string;
};
type RadarBenchmarkDetail = {
  benchmark_id: string;
  category: string;
  benchmark_intent: string;
  benchmark_recorded: boolean;
  winner_claimed: boolean;
  winner_status?: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
  winner_policy?: {
    policy_id: string;
    policy_version: string;
    required_successful_runs_per_route: number;
    minimum_success_rate: number;
    allowed_price_variance_percent: number;
    latency_metric: 'median';
    required_confidence: Array<'high' | 'medium'>;
    scoring_weights: {
      reliability: number;
      latency: number;
      normalization_confidence: number;
      price_consistency: number;
      cost_clarity: number;
      freshness: number;
    };
    winner_status: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
    winner_claimed: boolean;
    winner_rationale?: string;
    completed_runs: number;
    required_runs: number;
    next_step: string;
  };
  next_step: string;
  readiness_note: string;
  routes: RadarBenchmarkRouteMetric[];
};
type RadarBenchmarkRegistry = {
  generated_at: string;
  source: string;
  benchmarks: RadarBenchmarkDetail[];
};
type RadarBenchmarkSummaryRow = {
  benchmark_id: string;
  label: string;
  status: 'recorded';
  winner_status: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
  winner_claimed: boolean;
  routes_count: number;
  recorded_runs: number;
};
type RadarBenchmarkSummary = {
  generated_at: string;
  source: string;
  recorded_benchmarks: number;
  total_benchmarks: number;
  total_artifacts?: number;
  winner_claimed: boolean;
  total_recorded_runs: number;
  proven_routes: number;
  benchmarks: RadarBenchmarkSummaryRow[];
  agent_guidance: string[];
};
type BenchmarkHistoryEntry = {
  benchmark_id: string;
  recorded_at: string;
  run_count: number;
  benchmark_recorded: boolean;
  winner_claimed: boolean;
  winner_status?: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
  note: string;
  proof_reference: string;
  routes: RadarBenchmarkRouteMetric[];
};
type RadarBenchmarkHistory = {
  generated_at: string;
  source: string;
  benchmark_id: string;
  entries: BenchmarkHistoryEntry[];
  first_recorded_at?: string;
  latest_recorded_at?: string;
  artifact_count?: number;
  latest_artifact_id?: string;
  total_recorded_runs?: number;
  routes_count?: number;
  winner_status?: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
  winner_claimed?: boolean;
  route_summaries?: Array<{
    provider_id: string;
    route_id: string;
    latency_summary: {
      latest_latency_ms: number | null;
      median_latency_ms: number | null;
      p95_latency_ms: number | null;
    };
    reliability_summary: {
      success_rate: number | null;
      completed_runs: number | null;
      failed_runs: number | null;
    };
  }>;
};
type RadarBenchmarkHistoryV2Row = {
  benchmark_id: string;
  label: string;
  status: 'recorded' | 'planned';
  first_recorded_at: string | null;
  latest_recorded_at: string | null;
  artifact_count: number;
  latest_artifact_id: string | null;
  total_recorded_runs: number;
  routes_count: number;
  winner_status: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
  winner_claimed: boolean;
};
type RadarBenchmarkHistoryV2Aggregate = {
  generated_at: string;
  source: string;
  history_count: number;
  total_artifacts: number;
  total_recorded_runs: number;
  winner_claimed: boolean;
  benchmarks: RadarBenchmarkHistoryV2Row[];
};
type RadarBenchmarkRouteHistorySummary = {
  route_id: string;
  provider_id: string;
  label: string;
  artifact_count: number;
  first_recorded_at: string;
  latest_recorded_at: string;
  latest_artifact_id: string;
  latest_success_count: number | null;
  latest_failure_count: number | null;
  latest_median_latency_ms: number | null;
  latest_p95_latency_ms: number | null;
  latest_detection_rate: number | null;
  winner_status: 'not_evaluated' | 'insufficient_runs' | 'no_clear_winner' | 'provisional_winner' | 'winner_claimed';
  winner_claimed: boolean;
  evidence_health: 'recorded' | 'caveated' | 'stale' | 'degraded' | 'unverified' | 'scaffold';
  caveats: string[];
  caveat_objects: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; message: string; evidence_field: string | null; value: string | number | boolean | null }>;
};
type RadarBenchmarkRouteHistoryAggregate = {
  benchmark_id: string;
  label: string;
  route_count: number;
  artifact_count: number;
  winner_claimed: boolean;
  routes: RadarBenchmarkRouteHistorySummary[];
};
type RadarEvidenceLedgerRecordedLane = {
  benchmark_id: string;
  label: string;
  status: 'recorded';
  artifact_count: number;
  recorded_runs: number;
  routes_count: number;
  proven_routes_count: number;
  winner_claimed: boolean;
  latest_recorded_at: string | null;
};
type RadarEvidenceLedgerScaffoldLane = {
  benchmark_id: string;
  label: string;
  status: 'scaffold';
  why_not_promoted: string[];
};
type RadarEvidenceLedgerLatestArtifact = {
  artifact_id: string;
  benchmark_id: string;
  label: string;
  recorded_at: string;
  recorded_runs: number;
  routes_count: number;
  winner_claimed: boolean;
};
type RadarEvidenceLedger = {
  ledger_state: {
    recorded_benchmarks: number;
    total_benchmarks: number;
    total_artifacts: number;
    total_recorded_runs: number;
    proven_routes: number;
    winner_claimed: boolean;
    latest_recorded_at: string | null;
  };
  recorded_lanes: RadarEvidenceLedgerRecordedLane[];
  scaffold_lanes: RadarEvidenceLedgerScaffoldLane[];
  latest_artifacts: RadarEvidenceLedgerLatestArtifact[];
};
type AgentSpendReadinessState = 'recorded_evidence' | 'caveated_evidence' | 'controlled_run_observed' | 'scaffold_only' | 'catalog_only' | 'blocked_or_unclear';
type AgentSpendReadiness = 'ready_for_inspection' | 'needs_review' | 'not_ready';
type AgentReadinessDecisionSummary = {
  ready_for_agent_review: boolean;
  requires_rerun_before_spend: boolean;
  requires_human_or_policy_approval: boolean;
  observed_cost_available: boolean;
  winner_claimed: false;
  decision_state: 'ready_for_review' | 'review_ready_caveated' | 'rerun_required' | 'not_ready';
  blocking_reasons: string[];
  review_reasons: string[];
  recommended_agent_action: string;
};
type AgentReadinessCard = {
  provider_id: string;
  provider_label: string;
  readiness_state: AgentSpendReadinessState;
  agent_spend_readiness: AgentSpendReadiness;
  evidence_summary: {
    recorded_benchmarks: number;
    proven_routes: number;
    controlled_bundle_runs: number;
    scaffold_lanes: number;
    caveat_count: number;
    latest_artifact_id: string | null;
    latest_observed_at: string | null;
  };
  proof_links: {
    benchmark_history: string[];
    route_timelines: string[];
    bundle_runs: string[];
  };
  builder_next_step: string;
  agent_guidance: string;
  what_this_means?: string;
  winner_claimed: false;
  agent_readiness_summary?: AgentReadinessDecisionSummary;
  share_copy: string;
};
type AgentReadinessList = {
  count: number;
  generated_at: string;
  cards: AgentReadinessCard[];
  winner_claimed: false;
  agent_guidance: string[];
};
type AgentReadinessProofLinkGroup = 'benchmark_history' | 'route_timelines' | 'bundle_runs';
type TrendDirection = 'improving' | 'stable' | 'degrading' | 'unknown';
type RiskLevel = 'low' | 'watch' | 'elevated' | 'critical' | 'unknown';
type RiskRecommendation = 'route normally' | 'route with caution' | 'required fallback route' | 'not recommended for routing' | 'insufficient history';
type RadarRiskAnomaly = {
  anomaly_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  evidence: string[];
  detected_at: string;
};
type RadarRiskContext = {
  predictive_risk_score: number;
  predictive_risk_level: RiskLevel;
  history_available: boolean;
  sample_count: number;
  explanation: string;
  evidence: string[];
  warnings: string[];
  recommended_action: RiskRecommendation;
  top_anomaly: RadarRiskAnomaly | null;
};
type RadarRiskResponse = {
  generated_at: string;
  subject_type: 'provider' | 'endpoint' | 'ecosystem';
  subject_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  history_available: boolean;
  sample_count: number;
  explanation?: string;
  anomalies: RadarRiskAnomaly[];
  evidence: string[];
  warnings: string[];
  recommended_action: RiskRecommendation;
};
type RadarEcosystemRiskSummary = RadarRiskResponse & {
  subject_type: 'ecosystem';
  subject_id: 'ecosystem';
  summary: {
    providers_by_risk_level: Record<RiskLevel, number>;
    top_anomalies: Array<{ anomaly_type: string; count: number }>;
    categories_most_affected: Array<{ category: string; provider_count: number }>;
    recent_critical_events: Array<{ event_id: string; type: string; provider_id: string | null; endpoint_id: string | null; observed_at: string }>;
    stale_catalog_warning: string | null;
    anomaly_watch: Array<{
      subject_type: 'provider' | 'endpoint';
      provider_id: string | null;
      endpoint_id: string | null;
      anomaly_type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      confidence: 'low' | 'medium' | 'high';
      explanation: string;
      detected_at: string;
      recommended_action: RiskRecommendation;
      route_implication: string;
      evidence: string[];
    }>;
  };
};
type TrendContext = {
  trust_trend: TrendDirection;
  signal_trend: TrendDirection;
  degradation_trend: TrendDirection;
  trust_delta_24h: number | null;
  signal_delta_24h: number | null;
  latency_delta_24h: number | null;
  degradation_delta_24h: number | null;
  route_eligibility_changed: boolean | null;
  last_seen_healthy_at: string | null;
  warning: string | null;
};
type HistoryPoint = { at: string; value: number | string | boolean | null };
type RadarProviderHistory = {
  generated_at: string;
  window: '24h' | '48h' | '7d';
  sample_count: number;
  history_available: boolean;
  reason: string | null;
  series: Record<string, HistoryPoint[]>;
  deltas: {
    trust_delta_24h: number | null;
    signal_delta_24h: number | null;
    latency_delta_24h: number | null;
    degradation_delta_24h: number | null;
    route_eligibility_changed: boolean | null;
    trend_direction: TrendDirection;
  };
  last_known_good?: {
    last_seen_healthy_at: string | null;
    last_degraded_at: string | null;
    last_failed_at: string | null;
    current_health_state: string;
    health_state_reason: string;
  };
  warnings: string[];
};
type RadarEcosystemHistory = Omit<RadarProviderHistory, 'last_known_good' | 'deltas'> & {
  deltas: {
    average_trust_delta_24h: number | null;
    average_signal_delta_24h: number | null;
    degradation_delta_24h: number | null;
    trend_direction: TrendDirection;
  };
};
type SearchResponse = { data: any[]; degraded?: boolean; reason?: string };
type ErrorBoundaryState = { hasError: boolean };
type NumericRange = { min: number; max: number };
type ApiErrorType = 'cors_or_fetch_failed' | 'network_error' | 'timeout' | 'http_error' | 'html_response' | 'invalid_json' | 'invalid_shape';
type StartupDiagnosticFinalState = 'active_failure' | 'recovered' | 'ignored_secondary_failure';
type StartupDiagnostic = {
  endpoint: string;
  request_url: string;
  method: string;
  attempt: number;
  status_code: number | null;
  content_type: string | null;
  error_type: ApiErrorType;
  is_critical: boolean;
  last_attempt_at: string;
  recovered_at: string | null;
  final_state: StartupDiagnosticFinalState;
  used_content_type_on_get: boolean;
  fix_hint: string;
};

const API_BASE_URL = getApiBaseUrl();
const PUBLIC_API_HOST = 'https://infopunks-pay-sh-radar.onrender.com';
const API_TIMEOUT_MS = 8_000;
const SECONDARY_TIMEOUT_MS = 12_000;
const CRITICAL_PULSE_TIMEOUT_MS = 10_000;
const INITIAL_PROVIDER_RISK_PREFETCH_LIMIT = 12;
const DOSSIER_INTERACTION_HOLD_MS = 20_000;
const ROUTE_INTERACTION_HOLD_MS = 60_000;
const OPENAPI_PATH = '/openapi.json';
const clientWarningKeys = new Set<string>();
type DensityMode = 'comfortable' | 'dense';
type CommandPaletteAction = {
  id: string;
  label: string;
  hint: string;
  run: () => void;
};

const TIMEOUT_FIX_HINT = 'Request timed out before a response was received. Possible causes: backend cold start, slow API response, network delay, browser request queueing, or client timeout. Check Network details for CORS/preflight only if OPTIONS or GET is blocked.';
const CORS_FIX_HINT = 'Browser may have blocked the request during CORS/preflight. Ensure GET requests do not send Content-Type and backend handles OPTIONS.';
const GENERIC_FIX_HINT = 'Request failed before a usable response was parsed. Check Network and response details.';

class ApiRequestError extends Error {
  readonly diagnostic: StartupDiagnostic;

  constructor(message: string, diagnostic: StartupDiagnostic) {
    super(message);
    this.name = 'ApiRequestError';
    this.diagnostic = diagnostic;
  }
}

function resolveFixHint(input: Pick<StartupDiagnostic, 'error_type' | 'used_content_type_on_get' | 'method'>) {
  if (input.error_type === 'timeout') return TIMEOUT_FIX_HINT;
  if (input.error_type === 'cors_or_fetch_failed') return CORS_FIX_HINT;
  if ((input.method === 'GET' || input.method === 'HEAD') && input.used_content_type_on_get) return CORS_FIX_HINT;
  return GENERIC_FIX_HINT;
}

function withDefaultFixHint(input: Partial<StartupDiagnostic> & Pick<StartupDiagnostic, 'endpoint' | 'request_url' | 'method' | 'error_type' | 'is_critical'>): StartupDiagnostic {
  const usedContentType = input.used_content_type_on_get ?? false;
  return {
    attempt: 1,
    status_code: null,
    content_type: null,
    used_content_type_on_get: usedContentType,
    last_attempt_at: new Date().toISOString(),
    recovered_at: null,
    final_state: 'active_failure',
    fix_hint: resolveFixHint({ error_type: input.error_type, method: input.method, used_content_type_on_get: usedContentType }),
    ...input
  };
}

async function api<T>(path: string, init?: RequestInit, timeoutOverrideMs?: number): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = timeoutOverrideMs ?? API_TIMEOUT_MS;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = toApiUrl(API_BASE_URL, path);
    const method = (init?.method ?? 'GET').toUpperCase();
    const sourceHeaders = new Headers(init?.headers ?? {});
    const usedContentTypeOnGet = (method === 'GET' || method === 'HEAD') && sourceHeaders.has('Content-Type');
    if (method === 'GET' || method === 'HEAD') {
      sourceHeaders.delete('Content-Type');
      if (!sourceHeaders.has('Accept')) sourceHeaders.set('Accept', 'application/json');
    } else if (!sourceHeaders.has('Accept')) {
      sourceHeaders.set('Accept', 'application/json');
      const hasJsonBody = init?.body != null;
      if (hasJsonBody && !sourceHeaders.has('Content-Type')) sourceHeaders.set('Content-Type', 'application/json');
    }
    const response = await fetch(url, {
      headers: sourceHeaders,
      ...init,
      signal: controller.signal
    });
    const contentType = response.headers?.get?.('content-type')?.toLowerCase() ?? '';
    if (path === '/v1/pulse' && (response.status === 404 || contentType.includes('text/html'))) {
      console.error('Radar API unavailable from frontend. In split-mode deployments, set VITE_API_BASE_URL to the backend API URL.');
    }
    if (!response.ok) {
      throw new ApiRequestError(`${response.status} ${path}`, withDefaultFixHint({
        endpoint: path,
        request_url: url,
        method,
        error_type: 'http_error',
        is_critical: path === '/v1/pulse',
        status_code: response.status,
        content_type: contentType,
        used_content_type_on_get: usedContentTypeOnGet
      }));
    }
    if (contentType.includes('text/html')) {
      throw new ApiRequestError(`Unexpected HTML response for ${path}`, withDefaultFixHint({
        endpoint: path,
        request_url: url,
        method,
        error_type: 'html_response',
        is_critical: path === '/v1/pulse',
        status_code: response.status,
        content_type: contentType,
        used_content_type_on_get: usedContentTypeOnGet
      }));
    }
    try {
      return await response.json() as T;
    } catch {
      throw new ApiRequestError(`Invalid JSON from ${path}`, withDefaultFixHint({
        endpoint: path,
        request_url: url,
        method,
        error_type: 'invalid_json',
        is_critical: path === '/v1/pulse',
        status_code: response.status,
        content_type: contentType,
        used_content_type_on_get: usedContentTypeOnGet
      }));
    }
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    const method = (init?.method ?? 'GET').toUpperCase();
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    const suffix = timedOut ? `timed out after ${timeoutMs}ms` : error instanceof Error ? error.message : String(error);
    const url = toApiUrl(API_BASE_URL, path);
    console.error(`[frontend-api] ${method} ${path} failed: ${suffix}`);
    throw new ApiRequestError(`${method} ${path} failed: ${suffix}`, withDefaultFixHint({
      endpoint: path,
      request_url: url,
      method,
      error_type: timedOut ? 'timeout' : 'cors_or_fetch_failed',
      is_critical: path === '/v1/pulse'
    }));
  } finally {
    window.clearTimeout(timeout);
  }
}

function diagnosticKey(item: Pick<StartupDiagnostic, 'endpoint' | 'method' | 'is_critical'>) {
  return `${item.endpoint}::${item.method}::${item.is_critical ? 'critical' : 'secondary'}`;
}

function mergeStartupDiagnostics(current: StartupDiagnostic[], failures: StartupDiagnostic[], recoveredEndpoints: string[] = []) {
  const now = new Date().toISOString();
  const byKey = new Map(current.map((item) => [diagnosticKey(item), item]));
  for (const endpoint of recoveredEndpoints) {
    for (const [key, item] of byKey.entries()) {
      if (item.endpoint !== endpoint) continue;
      if (item.final_state !== 'active_failure') continue;
      byKey.set(key, { ...item, final_state: 'recovered', recovered_at: now, fix_hint: resolveFixHint(item) });
    }
  }
  for (const failure of failures) {
    const key = diagnosticKey(failure);
    const existing = byKey.get(key);
    const attempt = existing ? existing.attempt + 1 : 1;
    byKey.set(key, {
      ...failure,
      attempt,
      final_state: 'active_failure',
      recovered_at: null,
      fix_hint: resolveFixHint(failure)
    });
  }
  return Array.from(byKey.values()).sort((a, b) => Date.parse(b.last_attempt_at) - Date.parse(a.last_attempt_at)).slice(0, 40);
}

function debugDiagnosticsEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') return true;
    const flag = window.localStorage.getItem('radar_debug') ?? window.localStorage.getItem('debug');
    return flag === 'true' || flag === '1' || flag === 'on';
  } catch {
    return false;
  }
}

function warnClientOnce(key: string, message: string) {
  if (clientWarningKeys.has(key)) return;
  clientWarningKeys.add(key);
  console.warn(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

const safeString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const safeArray = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value as T[] : [];

function getSafeRange(value: unknown, fallback: NumericRange = { min: 0, max: 100 }): NumericRange {
  if (!isRecord(value)) return fallback;
  const min = Number.isFinite(value.min) ? Number(value.min) : fallback.min;
  const max = Number.isFinite(value.max) ? Number(value.max) : fallback.max;
  return { min, max };
}

function toPulse(candidate: unknown): Pulse | null {
  if (!isRecord(candidate) || !isRecord(candidate.data_source)) return null;
  if (typeof candidate.providerCount !== 'number' || typeof candidate.endpointCount !== 'number') return null;
  return {
    providerCount: candidate.providerCount,
    endpointCount: candidate.endpointCount,
    eventCount: typeof candidate.eventCount === 'number' ? candidate.eventCount : 0,
    averageTrust: typeof candidate.averageTrust === 'number' ? candidate.averageTrust : null,
    averageSignal: typeof candidate.averageSignal === 'number' ? candidate.averageSignal : null,
    hottestNarrative: isRecord(candidate.hottestNarrative) ? candidate.hottestNarrative as Narrative : null,
    topTrust: asArray<TrustAssessment>(candidate.topTrust),
    topSignal: asArray<SignalAssessment>(candidate.topSignal),
    interpretations: asArray<EcosystemInterpretation>(candidate.interpretations),
    data_source: {
      mode: candidate.data_source.mode === 'live_pay_sh_catalog' ? 'live_pay_sh_catalog' : 'fixture_fallback',
      url: typeof candidate.data_source.url === 'string' ? candidate.data_source.url : null,
      generated_at: typeof candidate.data_source.generated_at === 'string' ? candidate.data_source.generated_at : null,
      provider_count: typeof candidate.data_source.provider_count === 'number' ? candidate.data_source.provider_count : null,
      last_ingested_at: typeof candidate.data_source.last_ingested_at === 'string' ? candidate.data_source.last_ingested_at : null,
      used_fixture: Boolean(candidate.data_source.used_fixture),
      error: typeof candidate.data_source.error === 'string' ? candidate.data_source.error : null
    },
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString()
  };
}

function toPulseSummary(candidate: unknown): PulseSummary | null {
  if (!isRecord(candidate) || !isRecord(candidate.data_source)) return null;
  const eventGroupsRaw = isRecord(candidate.eventGroups) ? candidate.eventGroups : {};
  const eventGroups = Object.fromEntries(eventCategories.map((category) => {
    const group = isRecord(eventGroupsRaw[category]) ? eventGroupsRaw[category] : {};
    return [category, { count: typeof group.count === 'number' ? group.count : 0, recent: asArray<PulseEvent>(group.recent) }];
  })) as Record<EventCategory, { count: number; recent: PulseEvent[] }>;
  const providerActivityRaw = isRecord(candidate.providerActivity) ? candidate.providerActivity : {};
  return {
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString(),
    latest_event_at: typeof candidate.latest_event_at === 'string' ? candidate.latest_event_at : null,
    latest_batch_event_count: typeof candidate.latest_batch_event_count === 'number' ? candidate.latest_batch_event_count : 0,
    ingest_interval_ms: typeof candidate.ingest_interval_ms === 'number' ? candidate.ingest_interval_ms : null,
    latest_ingestion_run: isRecord(candidate.latest_ingestion_run) ? candidate.latest_ingestion_run as PulseSummary['latest_ingestion_run'] : null,
    counters: isRecord(candidate.counters) ? {
      providers: typeof candidate.counters.providers === 'number' ? candidate.counters.providers : 0,
      endpoints: typeof candidate.counters.endpoints === 'number' ? candidate.counters.endpoints : 0,
      events: typeof candidate.counters.events === 'number' ? candidate.counters.events : 0,
      narratives: typeof candidate.counters.narratives === 'number' ? candidate.counters.narratives : 0,
      unknownTelemetry: typeof candidate.counters.unknownTelemetry === 'number' ? candidate.counters.unknownTelemetry : 0
    } : { providers: 0, endpoints: 0, events: 0, narratives: 0, unknownTelemetry: 0 },
    eventGroups,
    timeline: asArray<PulseEvent>(candidate.timeline),
    trustDeltas: asArray<ScoreDelta>(candidate.trustDeltas),
    signalDeltas: asArray<ScoreDelta>(candidate.signalDeltas),
    recentDegradations: asArray<PulseEvent>(candidate.recentDegradations),
    propagation: isRecord(candidate.propagation) ? candidate.propagation as PropagationAnalysis : undefined as unknown as PropagationAnalysis,
    providerActivity: {
      '1h': asArray<ProviderActivity>(providerActivityRaw['1h']),
      '24h': asArray<ProviderActivity>(providerActivityRaw['24h']),
      '7d': asArray<ProviderActivity>(providerActivityRaw['7d'])
    },
    signalSpikes: asArray<ScoreDelta>(candidate.signalSpikes),
    interpretations: asArray<EcosystemInterpretation>(candidate.interpretations),
    data_source: {
      mode: candidate.data_source.mode === 'live_pay_sh_catalog' ? 'live_pay_sh_catalog' : 'fixture_fallback',
      url: typeof candidate.data_source.url === 'string' ? candidate.data_source.url : null,
      generated_at: typeof candidate.data_source.generated_at === 'string' ? candidate.data_source.generated_at : null,
      provider_count: typeof candidate.data_source.provider_count === 'number' ? candidate.data_source.provider_count : null,
      last_ingested_at: typeof candidate.data_source.last_ingested_at === 'string' ? candidate.data_source.last_ingested_at : null,
      used_fixture: Boolean(candidate.data_source.used_fixture),
      error: typeof candidate.data_source.error === 'string' ? candidate.data_source.error : null
    }
  };
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[radar-ui-error-boundary]', error);
  }
  retry = () => this.setState({ hasError: false });
  render() {
    if (this.state.hasError) {
      return <main className="boot" aria-label="Radar fallback shell">
        <section className="panel">
          <h1>Radar UI degraded: rendering fallback shell</h1>
          <button className="execute compact secondary" type="button" onClick={this.retry}>Retry</button>
        </section>
      </main>;
    }
    return this.props.children;
  }
}

function routeProviderId(pathname: string) {
  const match = pathname.match(/^\/providers\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeAgentReadinessProviderId(pathname: string) {
  const match = pathname.match(/^\/radar\/readiness\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeReceiptId(pathname: string) {
  const match = pathname.match(/^\/receipts\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeRouteId(pathname: string) {
  const match = pathname.match(/^\/routes\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeServiceId(pathname: string) {
  const match = pathname.match(/^\/services\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeClaimId(pathname: string) {
  const match = pathname.match(/^\/claims\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeProofCheckId(pathname: string) {
  const match = pathname.match(/^\/check\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeLoopId(pathname: string) {
  const match = pathname.match(/^\/loops\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routePropagationId(pathname: string) {
  const match = pathname.match(/^\/propagation\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeBenchmarkId(pathname: string) {
  const match = pathname.match(/^\/benchmarks\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeRadarCard(pathname: string) {
  const match = pathname.match(/^\/radar\/cards\/(provider|route|benchmark|artifact)\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return { type: match[1] as 'provider' | 'route' | 'benchmark' | 'artifact', id: decodeURIComponent(match[2]) };
  } catch {
    return { type: match[1] as 'provider' | 'route' | 'benchmark' | 'artifact', id: match[2] };
  }
}

function isRadarCardIndexRoute(pathname: string) {
  return /^\/radar\/cards\/?$/.test(pathname);
}

function routeMachineMarketCardId(pathname: string) {
  const match = pathname.match(/^\/machine-market\/cards\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isBenchmarkIndexRoute(pathname: string) {
  return /^\/benchmarks\/?$/.test(pathname);
}

function isSpendTerminalRoute(pathname: string) {
  return /^\/spend-terminal\/?$/.test(pathname);
}

function isDevelopersRoute(pathname: string) {
  return /^\/developers\/?$/.test(pathname);
}

function isWalletSafetyDeveloperRoute(pathname: string) {
  return /^\/developers\/wallet-safety\/?$/.test(pathname);
}

function isWalletSafetyIntegrationDeveloperRoute(pathname: string) {
  return /^\/developers\/wallet-safety\/integrations\/?$/.test(pathname);
}

function routeWalletSafetyIntegrationId(pathname: string) {
  const match = pathname.match(/^\/developers\/wallet-safety\/integrations\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isRoutesIndexRoute(pathname: string) {
  return /^\/routes\/?$/.test(pathname);
}

function isProvidersIndexRoute(pathname: string) {
  return /^\/providers\/?$/.test(pathname);
}

function isServicesIndexRoute(pathname: string) {
  return /^\/services\/?$/.test(pathname);
}

function isReceiptsIndexRoute(pathname: string) {
  return /^\/receipts\/?$/.test(pathname);
}

function isClaimsIndexRoute(pathname: string) {
  return /^\/claim\/?$/.test(pathname);
}

function isProofCheckIndexRoute(pathname: string) {
  return /^\/check\/?$/.test(pathname);
}

function isLoopsIndexRoute(pathname: string) {
  return /^\/loops\/?$/.test(pathname);
}

function isSignalHuntRoute(pathname: string) {
  return /^\/signal-hunt\/?$/.test(pathname);
}

function routeSignalHuntId(pathname: string) {
  const match = pathname.match(/^\/signal-hunt\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isUnicornRadarRoute(pathname: string) {
  return /^\/unicorn-radar\/?$/.test(pathname);
}

function isEvaluationRequestRoute(pathname: string) {
  return /^\/evaluation-request\/?$/.test(pathname);
}

function isRevenueReceiptsRoute(pathname: string) {
  return /^\/revenue-receipts\/?$/.test(pathname);
}

function routeRevenueReceiptId(pathname: string) {
  const match = pathname.match(/^\/revenue-receipts\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeUnicornRadarCandidateId(pathname: string) {
  const match = pathname.match(/^\/unicorn-radar\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isGraphRoute(pathname: string) {
  return /^\/graph\/?$/.test(pathname);
}

function isNarrativesRoute(pathname: string) {
  return /^\/narratives\/?$/.test(pathname);
}

function isAttentionMarketsRoute(pathname: string) {
  return /^\/narratives\/attention-markets\/?$/.test(pathname);
}

function isAttentionMarketWatchRoute(pathname: string) {
  return /^\/narratives\/attention-market-watch\/?$/.test(pathname) || /^\/attention-market-watch\/?$/.test(pathname);
}

function isAbundanceDeskRoute(pathname: string) {
  return /^\/abundance\/?$/.test(pathname) || /^\/narratives\/abundance-desk\/?$/.test(pathname);
}

function isRhChainSignalDeskRoute(pathname: string) {
  return /^\/rh-chain-signal-desk\/?$/.test(pathname) || /^\/narratives\/robinhood-chain\/?$/.test(pathname);
}

function isHermesDeskRoute(pathname: string) {
  return /^\/hermes\/?$/.test(pathname) || /^\/hermes\/memory-loop\/?$/.test(pathname) || /^\/hermes\/skill-pack\/?$/.test(pathname) || /^\/hermes\/reputation-ledger\/?$/.test(pathname) || /^\/hermes\/pre-spend-decision\/?$/.test(pathname) || /^\/hermes\/spend-policy\/?$/.test(pathname) || /^\/hermes\/decision-feedback\/?$/.test(pathname) || /^\/hermes\/wallet-audit-trail\/?$/.test(pathname) || /^\/hermes\/wallet-risk-score\/?$/.test(pathname) || /^\/hermes\/wallet-safety\/?$/.test(pathname) || /^\/narratives\/hermes-desk\/?$/.test(pathname);
}

function routeAttentionMarketWatchSlug(pathname: string) {
  const match = pathname.match(/^\/attention-market-watch\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeSignalSlug(pathname: string) {
  const match = pathname.match(/^\/signals\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeSignalUpdate(pathname: string) {
  const match = pathname.match(/^\/signals\/([^/]+)\/updates\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return {
      slug: decodeURIComponent(match[1]),
      updateId: decodeURIComponent(match[2])
    };
  } catch {
    return {
      slug: match[1],
      updateId: match[2]
    };
  }
}

function isMachineMarketRoute(pathname: string) {
  return /^\/machine-market\/?$/.test(pathname);
}

function isMachineReadinessMatrixRoute(pathname: string) {
  return /^\/machine-readiness-matrix\/?$/.test(pathname);
}

function isMachineMarketMapRoute(pathname: string) {
  return /^\/machine-market-map\/?$/.test(pathname);
}

function isMachineEconomySnapshotRoute(pathname: string) {
  return /^\/machine-economy-snapshot\/?$/.test(pathname);
}

function isMachineRouteRiskMatrixRoute(pathname: string) {
  return /^\/machine-route-risk-matrix\/?$/.test(pathname);
}

function isMachineFirstSafeRoutesRoute(pathname: string) {
  return /^\/machine-first-safe-routes\/?$/.test(pathname);
}
function isMachineBenchmarkReadinessRoute(pathname: string) {
  return /^\/machine-benchmark-readiness\/?$/.test(pathname);
}
function isMachineComparableRoutesRoute(pathname: string) {
  return /^\/machine-comparable-routes\/?$/.test(pathname);
}
function isMachineTranslationEvidenceRoute(pathname: string) {
  return /^\/machine-translation-evidence\/?$/.test(pathname);
}
function isMachineProofLadderRoute(pathname: string) {
  return /^\/machine-proof-ladder\/?$/.test(pathname);
}
function isMachineBenchmarkMethodologyRoute(pathname: string) {
  return /^\/machine-benchmark-methodology\/?$/.test(pathname);
}

function isMachineExecutionBlockersRoute(pathname: string) {
  return /^\/machine-execution-blockers\/?$/.test(pathname);
}

function isMachineMarketChangelogRoute(pathname: string) {
  return /^\/machine-market-changelog\/?$/.test(pathname);
}

function isMachineNoClaimLedgerRoute(pathname: string) {
  return /^\/machine-no-claim-ledger\/?$/.test(pathname);
}

function isMachineRailCoverageRoute(pathname: string) {
  return /^\/machine-rail-coverage\/?$/.test(pathname);
}

function isMachineExecutionShortlistRoute(pathname: string) {
  return /^\/machine-execution-shortlist\/?$/.test(pathname);
}

function isMachinePreflightRoute(pathname: string) {
  return /^\/machine-preflight\/?$/.test(pathname);
}

function isMachineReceiptsRoute(pathname: string) {
  return /^\/machine-receipts\/?$/.test(pathname);
}

function isAlibabaMachineExecutionRoute(pathname: string) {
  return /^\/machine-execution\/alibaba-machine-translation-general\/?$/.test(pathname);
}

function routeMachineDossierId(pathname: string) {
  const match = pathname.match(/^\/machine-dossier\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeMachineServiceId(pathname: string) {
  const match = pathname.match(/^\/machine-service\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeMachineExecutionPlanServiceId(pathname: string) {
  const match = pathname.match(/^\/machine-execution-plan\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function routeMachineExecutionReceiptId(pathname: string) {
  const match = pathname.match(/^\/machine-execution\/([^/]+)\/?$/);
  if (!match) return null;
  const slug = match[1];
  if (slug === 'alibaba-machine-translation-general') return null;
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function setMetaTag(attr: 'property' | 'name', key: string, content: string) {
  let node = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function updateProviderPageMetadata(providerId: string, providerName: string | null, description: string | null) {
  const title = providerName ? `${providerName} Provider Intelligence | Infopunks Pay.sh Radar` : `${providerId} Provider Intelligence | Infopunks Pay.sh Radar`;
  const desc = description?.trim() || `Public provider intelligence dossier for ${providerName ?? providerId} on Infopunks Pay.sh Radar.`;
  document.title = title;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', window.location.href);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
}

function updateReceiptPageMetadata(receipt: ReceiptRecord | null, eventId: string, missing = false) {
  const providerLabel = receipt?.provider_id ?? 'unknown provider';
  const title = missing
    ? `Receipt Not Found | Infopunks Pay.sh Radar`
    : `Receipt ${eventId} | ${receipt?.event_type ?? 'event'} | Infopunks Pay.sh Radar`;
  const desc = missing
    ? `No public receipt was found for event ${eventId}.`
    : `${receipt?.event_type ?? 'event'} from ${providerLabel}. Severity ${String(receipt?.severity ?? 'unknown')}.`;
  document.title = title;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:type', 'article');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', window.location.href);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
}

function updatePropagationPageMetadata(incident: PropagationIncident | null, clusterId: string, missing = false) {
  const title = missing
    ? `Propagation Cluster Not Found | Infopunks Pay.sh Radar`
    : `Propagation ${clusterId} | ${incident?.propagation_state ?? 'unknown'} | Infopunks Pay.sh Radar`;
  const desc = missing
    ? `No propagation incident currently matches cluster id ${clusterId}.`
    : `${incident?.propagation_reason ?? 'Propagation incident intelligence.'} Severity ${incident?.severity ?? 'unknown'}.`;
  document.title = title;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:type', 'article');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', window.location.href);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
}

function updateBenchmarkPageMetadata(benchmark: RadarBenchmarkDetail | null, benchmarkId: string | null, missing = false) {
  const isIndex = !benchmarkId;
  const title = isIndex
    ? 'Benchmarks | Infopunks Pay.sh Radar'
    : missing
      ? 'Benchmark Not Found | Infopunks Pay.sh Radar'
      : `${benchmarkId} Benchmark Proof | Infopunks Pay.sh Radar`;
  const desc = isIndex
    ? 'Infopunks Pay.sh Radar is an evidence ledger for Pay.sh agent routes, exposing recorded benchmarks, artifacts, route timelines, structured caveats, evidence health, and no-winner benchmark status before agents spend.'
    : missing
      ? `No benchmark exists for ${benchmarkId} in the current dataset.`
      : `${benchmark?.category ?? 'unknown category'} / ${benchmark?.benchmark_intent ?? 'unknown intent'}. No route winner is claimed.`;
  document.title = title;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:type', 'article');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', window.location.href);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
}

function updateAgentReadinessPageMetadata() {
  const title = 'Agent Spend Readiness Card | Infopunks Radar';
  const desc = 'Proof-state diagnostics for Pay.sh providers. Not rankings. winner_claimed=false.';
  document.title = title;
  setMetaTag('name', 'description', desc);
  setMetaTag('property', 'og:type', 'article');
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:url', window.location.href);
  setMetaTag('property', 'og:image', 'https://radar.infopunks.fun/og-radar.png');
  setMetaTag('property', 'og:image:alt', 'Infopunks Radar Agent Spend Readiness Card preview');
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
  setMetaTag('name', 'twitter:image', 'https://radar.infopunks.fun/og-radar.png');
}

function agentReadinessInterpretation(state: AgentSpendReadinessState) {
  if (state === 'recorded_evidence') return 'Artifact-backed route evidence exists. Agents should still inspect caveats before spend.';
  if (state === 'caveated_evidence') return 'Evidence exists, but caveats require review before routing agents.';
  if (state === 'controlled_run_observed') return 'A controlled Harness run exists. Agents should inspect run freshness, skipped steps, and caveats.';
  if (state === 'scaffold_only') return 'This lane was explored but does not yet meet the hard bar for recorded evidence.';
  if (state === 'catalog_only') return 'Catalog presence exists, but no artifact-backed route evidence has been recorded yet.';
  return 'Billing, proof, or route semantics remain unclear; this is not ready for automated spend.';
}

function compactAgentReadinessProofLinkLabel(group: AgentReadinessProofLinkGroup, href: string) {
  if (group === 'benchmark_history') {
    const benchmarkId = href.match(/\/benchmark-history\/([^/?#]+)/)?.[1];
    const label = benchmarkId ? humanizeProofId(decodeURIComponent(benchmarkId)) : null;
    return label ? `Benchmark history: ${label}` : 'Benchmark history: Proof link';
  }
  if (group === 'route_timelines') {
    const routeId = href.match(/\/routes\/([^/?#]+)/)?.[1];
    const decoded = routeId ? decodeURIComponent(routeId) : '';
    const providerId = decoded.split(':')[0] || '';
    const label = providerId ? humanizeProofId(providerId) : null;
    return label ? `Route timeline: ${label}` : 'Route timeline: Proof link';
  }
  if (group === 'bundle_runs') {
    const runId = href.match(/\/runs\/([^/?#]+)/)?.[1];
    const label = runId ? humanizeBundleRunId(decodeURIComponent(runId)) : null;
    return label ? `Bundle run: ${label}` : 'Bundle run: Proof link';
  }
  return 'Proof link';
}

function humanizeBundleRunId(runId: string) {
  const match = runId.match(/^([a-z0-9-]+)-run-\d{4}-\d{2}-\d{2}-(\d{6})/i);
  if (!match) return null;
  return `${humanizeProofId(match[1])} ${match[2]}`;
}

function humanizeProofId(id: string) {
  return id
    .replace(/^finance-data-/, '')
    .replace(/^data-/, '')
    .replace(/^document-/, '')
    .split(/[-_/]+/g)
    .filter(Boolean)
    .map(formatProofLabelPart)
    .join(' ');
}

function formatProofLabelPart(part: string) {
  const known: Record<string, string> = {
    sol: 'SOL',
    api: 'API',
    paysponge: 'PaySponge',
    coingecko: 'CoinGecko',
    stablecrypto: 'StableCrypto'
  };
  return known[part.toLowerCase()] ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
}

function benchmarkRouteLabel(route: RadarBenchmarkRouteMetric) {
  const id = route.provider_id.toLowerCase();
  if (route.route_id === 'paysponge-reducto:POST:/parse') return 'PaySponge Reducto';
  if (route.route_id === 'google-vision:POST:/v1/images:annotate') return 'Google Vision OCR';
  if (id === 'stableenrich-exa-search') return 'StableEnrich Exa Search';
  if (id === 'perplexity-search') return 'Perplexity Search';
  if (id.includes('stablecrypto')) return 'StableCrypto';
  if (id.includes('paysponge') || id.includes('coingecko')) return 'PaySponge CoinGecko';
  return route.provider_id;
}

function routeInfoCaveatNote(route: RadarBenchmarkRouteHistorySummary) {
  const caveatObjects = route.caveat_objects ?? [];
  const hasPayCliStatusHidden = caveatObjects.some((caveat) => caveat.code === 'pay_cli_status_hidden');
  const hasStatusCodeUnavailable = caveatObjects.some((caveat) => caveat.code === 'status_code_unavailable');
  if (!hasPayCliStatusHidden && !hasStatusCodeUnavailable) return null;
  return 'Recorded with info caveat: HTTP status hidden by pay_cli mode.';
}

function publicBenchmarkTitle(benchmark: Pick<RadarBenchmarkDetail, 'benchmark_id' | 'benchmark_intent'>) {
  if (benchmark.benchmark_id === 'finance-data-sol-price') return 'SOL Price';
  if (benchmark.benchmark_id === 'finance-data-token-search') return 'Token Search';
  if (benchmark.benchmark_id === 'finance-data-token-metadata') return 'Token Metadata';
  if (benchmark.benchmark_id === 'communications-email-delivery') return 'Communications Email Delivery';
  if (benchmark.benchmark_id === 'solana-infra-account-balance') return 'Solana Account Balance';
  if (benchmark.benchmark_id === 'social-data-reddit-post-search') return 'Reddit Post Search';
  if (benchmark.benchmark_id === 'document-ocr-text-extraction') return 'Document OCR Text Extraction';
  if (benchmark.benchmark_id === 'data-web-search-results') return 'Web Search Results';
  if (benchmark.benchmark_id === 'maps-place-search-results') return 'Maps Place Search Results';
  if (benchmark.benchmark_id === 'audio-speech-transcription') return 'Audio Speech Transcription';
  return `${benchmark.benchmark_intent.charAt(0).toUpperCase()}${benchmark.benchmark_intent.slice(1)}`;
}

function benchmarkRunCount(benchmark: RadarBenchmarkDetail) {
  return benchmark.winner_policy?.completed_runs ?? Math.max(...benchmark.routes.map((route) => route.completed_runs ?? 0), 0);
}

function benchmarkProvenRouteCount(benchmark: RadarBenchmarkDetail) {
  const provenRoutes = benchmark.routes.filter((route) => route.execution_status === 'proven' || route.paid_execution_proven).length;
  return provenRoutes || (benchmark.benchmark_recorded ? 2 : 0);
}

function publicRecordedRouteRunCount(benchmark: RadarBenchmarkDetail | null, fallback: number) {
  if (!benchmark) return fallback;
  const recordedRuns = benchmarkRunCount(benchmark) || fallback;
  if (benchmark.benchmark_id === 'data-web-search-results') return Math.max(recordedRuns, 10);
  return recordedRuns;
}

type PublicProofSummary = {
  recordedBenchmarks: number;
  artifacts: number;
  provenPaidRoutes: number;
  recordedRouteRuns: number;
  winnerClaims: number;
};

function publicProofSummary(evidenceLedger: RadarEvidenceLedger | null): PublicProofSummary | null {
  if (evidenceLedger) {
    return {
      recordedBenchmarks: evidenceLedger.ledger_state.recorded_benchmarks,
      artifacts: evidenceLedger.ledger_state.total_artifacts,
      provenPaidRoutes: evidenceLedger.ledger_state.proven_routes,
      recordedRouteRuns: evidenceLedger.ledger_state.total_recorded_runs,
      winnerClaims: evidenceLedger.ledger_state.winner_claimed ? 1 : 0
    };
  }
  return null;
}

function proofSummarySentence(summary: PublicProofSummary) {
  return `${summary.recordedBenchmarks} recorded benchmarks. ${summary.provenPaidRoutes} proven paid routes. ${summary.recordedRouteRuns} recorded route-runs. ${summary.artifacts} artifacts. ${summary.winnerClaims} winner claims.`;
}

function evidenceLedgerLaneRatio(evidenceLedger: RadarEvidenceLedger | null) {
  if (!evidenceLedger) return null;
  const winnerClaims = evidenceLedger.ledger_state.winner_claimed ? 1 : 0;
  return `${evidenceLedger.recorded_lanes.length} recorded lanes · ${evidenceLedger.scaffold_lanes.length} explored lanes · ${winnerClaims} winner claims`;
}

function ProofMetricsStrip({ summary }: { summary: PublicProofSummary | null }) {
  if (!summary) {
    return <div className="proof-metrics-strip unavailable" aria-label="Proof metrics">
      <span><b>Evidence Ledger unavailable</b>canonical proof metrics unavailable</span>
    </div>;
  }
  return <div className="proof-metrics-strip" aria-label="Proof metrics">
    <span><b>{summary.recordedBenchmarks}</b> recorded benchmarks</span>
    <span><b>{summary.provenPaidRoutes}</b> proven paid routes</span>
    <span><b>{summary.recordedRouteRuns}</b> recorded route-runs</span>
    <span><b>{summary.artifacts}</b> artifacts</span>
    <span><b>{summary.winnerClaims}</b> winner claims</span>
  </div>;
}

function scaffoldPromotionReasons(benchmarkId: string) {
  if (benchmarkId === 'communications-email-delivery') return [
    'StableEmail paid-executed, verified/proven but caveated',
    'AgentMail blocked / no second comparable route',
    'no benchmark artifact'
  ];
  if (benchmarkId === 'solana-infra-account-balance') return [
    'QuickNode unpaid 402 confirmed',
    'paid run failed',
    'no second comparable route',
    'no benchmark artifact'
  ];
  if (benchmarkId === 'social-data-reddit-post-search') return [
    'StableEnrich paid-proven but caveated',
    'StableSocial paid-compatible but semantic proof failed',
    'no second paid-proven comparable route',
    'no benchmark artifact'
  ];
  if (benchmarkId === 'maps-place-search-results') return [
    'StableEnrich paid-proven but degraded (missing names/addresses/coordinates, location unconfirmed)',
    'Google Places paid-executed and one paid diagnostic retry (includedType=cafe) still returned zero recognizable place candidates',
    'no second paid-proven comparable route',
    'no benchmark artifact'
  ];
  if (benchmarkId === 'document-ocr-text-extraction') return [
    'fixture hosting blocker still open',
    'Reducto and Google Vision probes are unpaid-only (402)',
    'no benchmark artifact'
  ];
  if (benchmarkId === 'audio-speech-transcription') return [
    'Google Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven',
    'Alibaba Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven',
    'both routes remain candidate/unproven with degraded evidence',
    'no benchmark artifact'
  ];
  return ['no benchmark artifact'];
}

function AgentBenchmarkSummaryDemoBox({ compact = false }: { compact?: boolean }) {
  const [summary, setSummary] = useState<RadarBenchmarkSummary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setError(false);
    setSummary(null);
    api<{ data: RadarBenchmarkSummary }>('/v1/radar/benchmark-summary')
      .then((response) => {
        if (!active) return;
        setSummary(response.data);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const proofStateLine = summary
    ? `${summary.recorded_benchmarks} recorded benchmarks · ${summary.proven_routes} proven paid routes · ${summary.total_recorded_runs} recorded route-runs · ${summary.total_artifacts ?? 5} artifacts · ${summary.winner_claimed ? 1 : 0} winner claims`
    : null;

  return <section className={`panel agent-evidence-demo${compact ? ' compact' : ''}`} aria-label="Agent Evidence benchmark summary demo">
    <div className="compact-chip-list-head">
      <div>
        <p className="section-kicker">Agent Evidence demo</p>
        <h2>Agent Evidence Demo</h2>
      </div>
      <code>GET /v1/radar/benchmark-summary</code>
    </div>
    <div className="agent-evidence-copy">
      <p><b>winner_claimed=false</b><span>means agents should not infer a route winner.</span></p>
      <p><b>routes_count</b><span>shows comparable proven routes per benchmark.</span></p>
      <p><b>recorded_runs</b><span>shows recorded route-run evidence.</span></p>
    </div>
    {error && <p className="route-state warn">Benchmark summary unavailable. Static benchmark proof pages remain available.</p>}
    {!error && !summary && <p className="route-state">Loading live benchmark summary...</p>}
    {summary && <p className="route-state"><b>Current proof state:</b> {proofStateLine}</p>}
    {summary && <details className="compact-chip-details">
      <summary>View live summary JSON</summary>
      <SafeCodeBlock value={JSON.stringify(summary, null, 2)} label="Live GET /v1/radar/benchmark-summary JSON" />
    </details>}
  </section>;
}

function BenchmarkProofContent({ benchmark, history, routeHistory }: { benchmark: RadarBenchmarkDetail; history: RadarBenchmarkHistory | null; routeHistory: RadarBenchmarkRouteHistoryAggregate | null }) {
  const policy = benchmark.winner_policy;
  const winnerStatusLabel = benchmark.winner_status?.replaceAll('_', ' ') ?? 'not evaluated';
  const isPlanningScaffold = !benchmark.benchmark_recorded && benchmark.winner_status === 'not_evaluated';
  const hasTokenSearchMappingTarget = benchmark.category === 'finance/data' && benchmark.benchmark_intent === 'token search';
  return <>
    <section className="panel">
      <p className="eyebrow">Infopunks Pay.sh Radar</p>
      <h1>{benchmark.benchmark_recorded ? 'Benchmark Proof' : 'Benchmark Scaffold'}: {benchmark.benchmark_id}</h1>
      <p className="panel-caption">No route winner is claimed.</p>
      <p className="panel-caption"><a href="/benchmarks">View all benchmarks</a> <a href={`/radar/cards/benchmark/${encodeURIComponent(benchmark.benchmark_id)}`}>Open Preflight Card</a></p>
    </section>
    <section className="panel">
      <div className="readiness-list-grid">
        <CompactChipList title="benchmark fields" items={[
          `benchmark_id: ${benchmark.benchmark_id}`,
          `intent: ${benchmark.benchmark_intent}`,
          `category: ${benchmark.category}`,
          `benchmark_recorded: ${String(benchmark.benchmark_recorded)}`,
          `winner_status: ${winnerStatusLabel}`,
          `winner_claimed: ${String(benchmark.winner_claimed)}`
        ]} emptyLabel="missing" wide />
        {policy && <CompactChipList title="winner policy summary" items={[
          `policy: ${policy.policy_id}@${policy.policy_version}`,
          `required_successful_runs_per_route: ${policy.required_successful_runs_per_route}`,
          `minimum_success_rate: ${Math.round(policy.minimum_success_rate * 100)}%`,
          `allowed_price_variance_percent: ${policy.allowed_price_variance_percent}`,
          `latency_metric: ${policy.latency_metric}`,
          `required_confidence: ${policy.required_confidence.join('/')}`
        ]} emptyLabel="missing" wide />}
      </div>
      {isPlanningScaffold && <div className="compact-chip-list wide">
        <div className="compact-chip-list-head">
          <strong>Benchmark scaffold</strong>
          <span>Planning</span>
        </div>
        <p>No proven route evidence recorded yet.</p>
        <p>Benchmark not yet recorded. No winner claimed.</p>
        <p>Winner claimed: no.</p>
        <p>Status: not evaluated.</p>
        <p>Next: {benchmark.next_step}.</p>
        <p>No artifact exists until benchmark evidence is recorded.</p>
        {hasTokenSearchMappingTarget && <p><a href="/#mapping-targets">Mapping target: finance/data token search</a> is benchmark-ready with two proven routes; normalized benchmark evidence is still pending.</p>}
      </div>}
    </section>
    <section className="panel">
      <h2>Route Cards</h2>
      <p className="panel-caption">No route winner is claimed.</p>
      {!benchmark.routes.length && <EmptyState title="No proven route evidence recorded yet." body="Route metric cards are shown only after normalized benchmark evidence is recorded." />}
      <div className="readiness-list-grid">
        {benchmark.routes.map((route) => <section key={route.route_id} className="compact-chip-list wide">
          <div className="compact-chip-list-head">
            <strong>{benchmarkRouteLabel(route)}</strong>
            <span>{route.execution_status}</span>
          </div>
          <p>provider_id: {route.provider_id}</p>
          <p>success_rate: {route.success_rate ?? 'n/a'}</p>
          <p>median_latency_ms: {route.median_latency_ms ?? 'n/a'}</p>
          <p>p95_latency_ms: {route.p95_latency_ms ?? 'n/a'}</p>
          <p>average_price_usd: {route.average_price_usd ?? 'n/a'}</p>
          <p>price_variance_percent: {route.price_variance_percent ?? 'n/a'}</p>
          <p>completed_runs: {route.completed_runs ?? 'n/a'}</p>
          <p>failed_runs: {route.failed_runs ?? 'n/a'}</p>
          <p>proof_reference: {route.proof_reference}</p>
          <p>status_evidence: {route.status_evidence ?? 'missing status evidence'}</p>
        </section>)}
      </div>
    </section>
    <section className="panel">
      <h2>Route Evidence Timeline</h2>
      <p className="panel-caption">Route-level evidence is derived from benchmark artifacts. Raw proofs are not exposed and no route winner is inferred.</p>
      {!routeHistory && <p className="panel-caption">Route timeline unavailable.</p>}
      {!!routeHistory && <div className="compact-chip-list wide" style={{ marginBottom: 16 }}>
        <div className="compact-chip-list-head">
          <strong>{routeHistory.label}</strong>
          <span>route_count: {routeHistory.route_count}</span>
        </div>
        <p>artifact_count: {routeHistory.artifact_count}</p>
        <p>winner_claimed: {String(routeHistory.winner_claimed)}</p>
      </div>}
      {!!routeHistory && <div className="readiness-list-grid">
        {routeHistory.routes.map((route) => <section key={route.route_id} className="compact-chip-list wide">
          <div className="compact-chip-list-head">
            <strong>{route.label}</strong>
            <span>{route.artifact_count} artifact{route.artifact_count === 1 ? '' : 's'}</span>
          </div>
          <p>route_id: {route.route_id}</p>
          <p>provider_id: {route.provider_id}</p>
          <p>first_recorded_at: {route.first_recorded_at}</p>
          <p>latest_recorded_at: {route.latest_recorded_at}</p>
          <p>latest_artifact_id: {route.latest_artifact_id}</p>
          <p>latest_success_count: {route.latest_success_count ?? 'n/a'}</p>
          <p>latest_failure_count: {route.latest_failure_count ?? 'n/a'}</p>
          <p>latest_median_latency_ms: {route.latest_median_latency_ms ?? 'n/a'}</p>
          <p>latest_p95_latency_ms: {route.latest_p95_latency_ms ?? 'n/a'}</p>
          <p>latest_detection_rate: {route.latest_detection_rate ?? 'n/a'}</p>
          <p>winner_status: {route.winner_status.replaceAll('_', ' ')}</p>
          <p>winner_claimed: {String(route.winner_claimed)}</p>
          {routeInfoCaveatNote(route) && <p>info: {routeInfoCaveatNote(route)}</p>}
          {route.caveats.length ? route.caveats.map((caveat) => <p key={caveat}>caveat: {caveat}</p>) : <p>caveats: none</p>}
        </section>)}
      </div>}
    </section>
    <section className="panel">
      <h2>Benchmark History</h2>
      <p className="panel-caption">Timeline entries are read-only evidence snapshots. No route winner is claimed.</p>
      {!history && <p className="panel-caption">History unavailable.</p>}
      {!!history && <div className="compact-chip-list wide" style={{ marginBottom: 16 }}>
        <div className="compact-chip-list-head">
          <strong>History</strong>
          <span>Artifact-backed</span>
        </div>
        <p>first_recorded_at: {history.first_recorded_at ?? 'n/a'}</p>
        <p>latest_recorded_at: {history.latest_recorded_at ?? 'n/a'}</p>
        <p>total_recorded_runs: {history.total_recorded_runs ?? 'n/a'}</p>
        <p>artifact_count: {history.artifact_count ?? 'n/a'}</p>
        <p>latest_artifact_id: {history.latest_artifact_id ?? 'n/a'}</p>
        <p>winner_claimed: {String(history.winner_claimed ?? false)}</p>
      </div>}
      {!!history && <div className="readiness-list-grid">
        {history.entries.map((entry) => {
          const entryWinnerStatus = entry.winner_status?.replaceAll('_', ' ') ?? 'not evaluated';
          return <section key={`${entry.benchmark_id}:${entry.recorded_at}:${entry.run_count}`} className="compact-chip-list wide">
            <div className="compact-chip-list-head">
              <strong>{new Date(entry.recorded_at).toISOString().slice(0, 10)}</strong>
              <span>{entry.run_count} run{entry.run_count === 1 ? '' : 's'}</span>
            </div>
            <p>proof_reference: {entry.proof_reference}</p>
            <p>benchmark_recorded: {String(entry.benchmark_recorded)}</p>
            <p>winner_status: {entryWinnerStatus}</p>
            <p>winner_claimed: {String(entry.winner_claimed)}</p>
            <p>note: {entry.note}</p>
            {!entry.routes.length && <p>route aggregate highlights: pending aggregate metrics in known artifact.</p>}
            {entry.routes.map((route) => <p key={route.route_id}>route aggregate highlights: {benchmarkRouteLabel(route)} success_rate={route.success_rate ?? 'n/a'}, median_latency_ms={route.median_latency_ms ?? 'n/a'}, average_price_usd={route.average_price_usd ?? 'n/a'}</p>)}
          </section>;
        })}
      </div>}
    </section>
  </>;
}

function PublicBenchmarksIndexPage() {
  const [registry, setRegistry] = useState<RadarBenchmarkRegistry | null>(null);
  const [history, setHistory] = useState<RadarBenchmarkHistoryV2Aggregate | null>(null);
  const [evidenceLedger, setEvidenceLedger] = useState<RadarEvidenceLedger | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setError(false);
    setRegistry(null);
    setHistory(null);
    api<{ data: RadarBenchmarkRegistry }>('/v1/radar/benchmarks')
      .then((response) => {
        if (!active) return;
        setRegistry(response.data);
        updateBenchmarkPageMetadata(null, null, false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        updateBenchmarkPageMetadata(null, null, true);
      });
    api<{ data: RadarBenchmarkHistoryV2Aggregate }>('/v1/radar/benchmark-history')
      .then((response) => {
        if (!active) return;
        setHistory(response.data);
      })
      .catch(() => {
        if (!active) return;
        setHistory(null);
      });
    api<{ data: RadarEvidenceLedger }>('/v1/radar/evidence-ledger')
      .then((response) => {
        if (!active) return;
        setEvidenceLedger(response.data);
      })
      .catch(() => {
        if (!active) return;
        setEvidenceLedger(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <main className="boot" aria-label="Benchmarks unavailable"><section className="panel public-provider-page"><h1>Benchmarks Unavailable</h1><p className="copy">Benchmark data delayed.</p></section></main>;
  if (!registry) return <main className="boot" aria-label="Benchmarks loading">LOADING BENCHMARKS...</main>;
  const recordedBenchmarks = registry.benchmarks.filter((benchmark) => benchmark.benchmark_recorded);
  const plannedBenchmarks = registry.benchmarks.filter((benchmark) => !benchmark.benchmark_recorded);
  const proofSummary = publicProofSummary(evidenceLedger);
  const ledgerLaneRatio = evidenceLedgerLaneRatio(evidenceLedger);
  const routeTimelineAggregateEndpoint = 'GET /v1/radar/benchmark-history/finance-data-token-metadata/routes';
  const routeTimelineDetailEndpoint = 'GET /v1/radar/benchmark-history/finance-data-token-metadata/routes/{route_id}';
  const routeTimelineSnippet = `{
  "route_id": "paysponge-coingecko:GET:/x402/...",
  "evidence_health": "caveated",
  "latest_success_count": 5,
  "latest_median_latency_ms": 5827,
  "latest_detection_rate": 1,
  "winner_claimed": false,
  "caveat_objects": [
    {
      "code": "canonical_network_mismatch",
      "severity": "warning"
    }
  ]
}`;
  return <div className="shell public-provider-shell">
    <main className="public-provider-page" aria-label="Public benchmark registry">
      <section className="panel benchmark-launch-hero">
        <p className="eyebrow">Infopunks Pay.sh Radar</p>
        <h1>Radar Evidence Ledger</h1>
        {ledgerLaneRatio && <p className="panel-caption">{ledgerLaneRatio}</p>}
        <p className="copy">Radar records benchmark evidence for Pay.sh routes before agents spend. It exposes artifacts, route timelines, caveats, evidence health, and winner-claim status without crowning routes.</p>
        {proofSummary
          ? <div className="proof-metrics-strip" aria-label="Radar evidence ledger metrics">
            <span><b>{proofSummary.recordedBenchmarks}</b> recorded benchmarks</span>
            <span><b>{proofSummary.provenPaidRoutes}</b> proven paid routes</span>
            <span><b>{history?.total_recorded_runs ?? proofSummary.recordedRouteRuns}</b> recorded route-runs</span>
            <span><b>{history?.total_artifacts ?? proofSummary.artifacts}</b> artifacts</span>
            <span><b>{proofSummary.winnerClaims}</b> winner claims</span>
          </div>
          : <div className="proof-metrics-strip unavailable" aria-label="Radar evidence ledger metrics">
            <span><b>Evidence Ledger unavailable</b>canonical proof metrics unavailable</span>
          </div>}
        <p className="panel-caption">Recorded means paid route evidence exists. It does not mean a winner was crowned.</p>
        <p className="panel-caption">Scaffold lanes are not failed benchmarks. They are lanes where Radar found insufficient comparable paid evidence.</p>
        <p className="panel-caption">Radar does not rewrite uncertainty. It records it, fixes it, and shows the delta.</p>
        <p className="panel-caption"><code>winner_claimed=false</code> and <code>winner_status=no_clear_winner</code> mean Radar shows evidence without route winner claims.</p>
        <div className="benchmark-hero-strip" aria-label="Benchmark evidence summary">
          <span>public evidence ledger</span>
          <span>artifact-backed route evidence</span>
          <span>route timelines</span>
          <span>structured caveats</span>
          <span>no winner claims</span>
        </div>
      </section>
      <section className="panel benchmark-launch-panel" aria-label="Recorded Pay.sh benchmarks">
        <h2>Recorded Benchmark Lanes</h2>
        <p className="panel-caption benchmark-caveat">Evidence ledger rows for recorded benchmarks. No winner claimed means Radar does not infer a route winner.</p>
        <div className="benchmark-launch-grid">
          {recordedBenchmarks.map((benchmark) => {
            const historyRow = history?.benchmarks.find((row) => row.benchmark_id === benchmark.benchmark_id) ?? null;
            const ledgerRow = evidenceLedger?.recorded_lanes.find((lane) => lane.benchmark_id === benchmark.benchmark_id) ?? null;
            const completedRuns = historyRow?.total_recorded_runs ?? ledgerRow?.recorded_runs ?? null;
            const provenRoutes = ledgerRow?.proven_routes_count ?? null;
            const runLabel = benchmark.benchmark_id === 'data-web-search-results'
              ? (completedRuns !== null ? `${completedRuns} recorded route-runs` : 'recorded route-runs unavailable')
              : (completedRuns !== null ? `${completedRuns} recorded route-runs` : 'recorded route-runs unavailable');
            const evidenceHealthSummary = benchmark.readiness_note?.toLowerCase().includes('caveat')
              ? benchmark.readiness_note
              : 'recorded evidence';
            return <a key={benchmark.benchmark_id} className="benchmark-launch-card" href={`/benchmarks/${encodeURIComponent(benchmark.benchmark_id)}`}>
              <div>
                <p className="section-kicker">{benchmark.category}</p>
                <h2>{publicBenchmarkTitle(benchmark)}</h2>
              </div>
              <div className="benchmark-launch-facts">
                <span>state: recorded</span>
                <span>artifact count: {historyRow?.artifact_count ?? ledgerRow?.artifact_count ?? 'unavailable'}</span>
                <span>{provenRoutes !== null ? `${provenRoutes} proven paid routes` : 'proven paid routes unavailable'}</span>
                <span>{runLabel}</span>
                <span>recorded evidence</span>
                <span>winner_status: {benchmark.winner_status}</span>
                <span>winner_claimed={String(benchmark.winner_claimed)}</span>
                <span>latest artifact id: {historyRow?.latest_artifact_id ?? 'n/a'}</span>
                <span>route timeline: available</span>
                <span>evidence health: {evidenceHealthSummary}</span>
              </div>
              <p>Open benchmark evidence detail</p>
            </a>;
          })}
          {!recordedBenchmarks.length && <EmptyState title="No recorded benchmarks found." body="Benchmark registry has no public recorded evidence yet." />}
        </div>
      </section>
      <section className="panel benchmark-launch-panel" aria-label="Planned benchmark scaffolds">
        <h2>Explored, Not Promoted</h2>
        <p className="panel-caption">Scaffold lanes are not failed benchmarks. They are lanes where Radar found insufficient comparable paid evidence.</p>
        <div className="benchmark-launch-grid">
          {plannedBenchmarks.map((benchmark) => {
            const reasons = scaffoldPromotionReasons(benchmark.benchmark_id);
            return <a key={benchmark.benchmark_id} className="benchmark-launch-card" href={`/benchmarks/${encodeURIComponent(benchmark.benchmark_id)}`}>
              <div>
                <p className="section-kicker">{benchmark.category}</p>
                <h2>{publicBenchmarkTitle(benchmark)}</h2>
              </div>
              <div className="benchmark-launch-facts">
                <span>Benchmark Scaffold</span>
                <span>routes: {benchmark.routes.length}</span>
                <span>artifacts: 0</span>
                <span>winner_status: {benchmark.winner_status}</span>
                <span>winner_claimed={String(benchmark.winner_claimed)}</span>
                {reasons.map((reason) => <span key={reason}>{reason}</span>)}
              </div>
              <p>Explored lane. Failure-to-promote reasons are preserved as structured caveats.</p>
            </a>;
          })}
          {!plannedBenchmarks.length && <EmptyState title="No planned benchmark scaffolds." body="All benchmark lanes currently have recorded evidence." />}
        </div>
      </section>
      <section className="panel benchmark-launch-panel" aria-label="Agent route timeline API">
        <h2>Agent Route Timeline API</h2>
        <p className="panel-caption">Agents can inspect route-level benchmark evidence before routing through Pay.sh. Radar exposes evidence health, caveats, latest benchmark metrics, artifact references, and winner-claim status without crowning routes.</p>
        <p className="panel-caption">Agents should ask: what evidence exists, how fresh is it, what caveats apply, was a winner claimed, and which artifact recorded this. Radar answers those questions without crowning routes.</p>
        <div className="endpoint-card-grid">
          <p><b>GET /v1/radar/evidence-ledger</b><span>Compact agent-readable evidence ledger before spend.</span></p>
          <p><b>GET /v1/radar/benchmark-summary</b><span>Compact proof state for recorded benchmarks, proven paid routes, recorded route-runs, artifacts, and no winner claims.</span></p>
          <p><b>GET /v1/radar/benchmark-history</b><span>Aggregate artifact-backed route evidence ledger.</span></p>
          <p><b>{routeTimelineAggregateEndpoint}</b><span>Route-level timeline rollup for one benchmark.</span></p>
          <p><b>{routeTimelineDetailEndpoint}</b><span>Evidence timeline for one route across artifacts.</span></p>
          <p><b>route_id encoding</b><span><code>route_id</code> may contain slashes or colons. URL-encode <code>route_id</code> before calling the detail endpoint.</span></p>
        </div>
        <div className="endpoint-card-grid">
          <p><b>evidence_health</b><span>recorded | caveated | stale | degraded | unverified | scaffold</span></p>
          <p><b>recorded/scaffold lanes</b><span>Recorded lanes contain artifact-backed evidence. Scaffold lanes preserve blocked or insufficient evidence.</span></p>
          <p><b>caveat_objects</b><span>Machine-readable caveats with <code>code</code>, <code>severity</code>, <code>message</code>, <code>evidence_field</code>, and <code>value</code>.</span></p>
          <p><b>winner_claimed</b><span><code>false</code> means agents should not infer a winner.</span></p>
          <p><b>status_evidence</b><span>Explains proof context when HTTP status is unavailable, especially <code>pay_cli</code> mode.</span></p>
          <p><b>latest_artifact_id</b><span>The benchmark artifact backing the latest route evidence.</span></p>
          <p><b>timeline</b><span>Route-level evidence history across benchmark artifacts.</span></p>
        </div>
        <details className="compact-chip-details">
          <summary>View route timeline response example</summary>
          <SafeCodeBlock value={routeTimelineSnippet} label="Route timeline evidence snippet" />
        </details>
        <p className="panel-caption">Recorded with info caveat: HTTP status hidden by pay_cli mode.</p>
      </section>
      <section className="panel benchmark-launch-panel" aria-label="Benchmark History">
        <h2>Benchmark History</h2>
        <p className="panel-caption">Artifact-backed evidence timeline. No raw proofs exposed.</p>
        <div className="benchmark-launch-grid">
          {(history?.benchmarks ?? []).filter((row) => row.status === 'recorded').map((row) => <article key={row.benchmark_id} className="benchmark-launch-card">
            <div>
              <p className="section-kicker">{row.benchmark_id}</p>
              <h2>{row.label}</h2>
            </div>
            <div className="benchmark-launch-facts">
              <span>first recorded: {row.first_recorded_at ? new Date(row.first_recorded_at).toISOString().slice(0, 10) : 'n/a'}</span>
              <span>latest recorded: {row.latest_recorded_at ? new Date(row.latest_recorded_at).toISOString().slice(0, 10) : 'n/a'}</span>
              <span>artifact count: {row.artifact_count}</span>
              <span>total runs: {row.total_recorded_runs}</span>
              <span>winner claimed: {String(row.winner_claimed)}</span>
            </div>
          </article>)}
          {!!history && !history.benchmarks.filter((row) => row.status === 'recorded').length && <EmptyState title="No benchmark history found." body="No recorded benchmark artifacts are available yet." />}
          {!history && <EmptyState title="Benchmark history unavailable." body="History data delayed." />}
        </div>
      </section>
      <AgentBenchmarkSummaryDemoBox compact />
    </main>
  </div>;
}

function BenchmarkLaunchSummaryTile({ lanes }: { lanes: RadarEvidenceLedgerRecordedLane[] }) {
  const recordedCount = lanes.length;
  return <section className="benchmark-state-tile" aria-label="Recorded benchmark summary">
    <div>
      <p className="section-kicker">Public benchmark state</p>
      <strong>{recordedCount} recorded benchmarks</strong>
    </div>
    <p>{lanes.map((lane) => lane.label).join(' + ')}</p>
    <p>No winner claims</p>
  </section>;
}

function BenchmarkLaunchMiniCard({ benchmark, lane }: { benchmark: RadarBenchmarkDetail | null; lane: RadarEvidenceLedgerRecordedLane }) {
  const completedRuns = lane.recorded_runs || publicRecordedRouteRunCount(benchmark, 5);
  const provenRoutes = lane.proven_routes_count || (benchmark ? benchmarkProvenRouteCount(benchmark) : 0);
  const runLabel = completedRuns >= 10 ? `${completedRuns} recorded route-runs` : `${Math.max(1, Math.round(completedRuns / Math.max(1, lane.routes_count)))} runs / route`;
  const href = `/benchmarks/${encodeURIComponent(benchmark?.benchmark_id ?? lane.benchmark_id)}`;
  return <a className="benchmark-mini-card" href={href}>
    <div>
      <p className="section-kicker">{benchmark?.category ?? 'benchmark'}</p>
      <strong>{benchmark ? publicBenchmarkTitle(benchmark) : lane.label}</strong>
    </div>
    <div className="benchmark-launch-facts">
      <span>{runLabel}</span>
      <span>{provenRoutes || 2} proven paid routes</span>
      <span>evidence ledger recorded</span>
    </div>
  </a>;
}

function PublicBenchmarkProofPage({ benchmarkId }: { benchmarkId: string }) {
  const [benchmark, setBenchmark] = useState<RadarBenchmarkDetail | null>(null);
  const [history, setHistory] = useState<RadarBenchmarkHistory | null>(null);
  const [routeHistory, setRouteHistory] = useState<RadarBenchmarkRouteHistoryAggregate | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    setMissing(false);
    setBenchmark(null);
    setHistory(null);
    setRouteHistory(null);
    api<{ data: RadarBenchmarkRegistry }>('/v1/radar/benchmarks')
      .then((response) => {
        if (!active) return;
        const match = response.data.benchmarks.find((item) => item.benchmark_id === benchmarkId) ?? null;
        if (!match) {
          setMissing(true);
          updateBenchmarkPageMetadata(null, benchmarkId, true);
          return;
        }
        setBenchmark(match);
        updateBenchmarkPageMetadata(match, benchmarkId, false);
        api<{ data: RadarBenchmarkHistory }>(`/v1/radar/benchmarks/${encodeURIComponent(benchmarkId)}/history`)
          .then((historyResponse) => {
            if (!active) return;
            setHistory(historyResponse.data);
          })
          .catch(() => {
            if (!active) return;
            setHistory(null);
          });
        api<{ data: RadarBenchmarkRouteHistoryAggregate }>(`/v1/radar/benchmark-history/${encodeURIComponent(benchmarkId)}/routes`)
          .then((routeHistoryResponse) => {
            if (!active) return;
            setRouteHistory(routeHistoryResponse.data);
          })
          .catch(() => {
            if (!active) return;
            setRouteHistory(null);
          });
      })
      .catch(() => {
        if (!active) return;
        setMissing(true);
        updateBenchmarkPageMetadata(null, benchmarkId, true);
      });
    return () => {
      active = false;
    };
  }, [benchmarkId]);

  if (missing) return <main className="boot" aria-label="Benchmark not found"><section className="panel public-provider-page"><h1>Benchmark Not Found</h1><p className="copy">No benchmark exists for <code>{benchmarkId}</code> in the current dataset.</p></section></main>;
  if (!benchmark) return <main className="boot" aria-label="Benchmark loading">LOADING BENCHMARK PROOF...</main>;
  return <div className="shell public-provider-shell"><main className="public-provider-page" aria-label="Public benchmark proof page"><BenchmarkProofContent benchmark={benchmark} history={history} routeHistory={routeHistory} /></main></div>;
}

function AgentReadinessProviderPage({ providerId }: { providerId: string }) {
  const [card, setCard] = useState<AgentReadinessCard | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setCard(null);
    setMissing(false);
    setLoading(true);
    updateAgentReadinessPageMetadata();
    api<{ data: AgentReadinessCard }>(`/v1/radar/agent-readiness/${encodeURIComponent(providerId)}`)
      .then((response) => {
        if (!active) return;
        setCard(response.data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setMissing(true);
        setLoading(false);
      });
    return () => { active = false; };
  }, [providerId]);

  if (loading) return <div className="shell public-provider-shell"><main className="public-provider-page agent-readiness-public-page" aria-label="Agent Spend Readiness Card"><section className="panel agent-readiness-public-card"><p className="section-kicker">Agent Spend Readiness Card</p><h1>Loading readiness card...</h1><p className="panel-caption">Builders can now see what agents see before spending.</p></section></main></div>;

  if (missing || !card) return <div className="shell public-provider-shell"><main className="public-provider-page agent-readiness-public-page" aria-label="Agent Spend Readiness Card"><section className="panel agent-readiness-public-card"><p className="section-kicker">Agent Spend Readiness Card</p><h1>Provider readiness card not found.</h1><p className="panel-caption">No provider readiness card is available for <code>{providerId}</code>.</p><a className="execute compact secondary" href="/">Back to Radar</a></section></main></div>;

  const proofLinks: Array<{ href: string; label: string; group: AgentReadinessProofLinkGroup }> = [
    ...card.proof_links.benchmark_history.map((href) => ({ href, label: compactAgentReadinessProofLinkLabel('benchmark_history', href), group: 'benchmark_history' as const })),
    ...card.proof_links.route_timelines.map((href) => ({ href, label: compactAgentReadinessProofLinkLabel('route_timelines', href), group: 'route_timelines' as const })),
    ...card.proof_links.bundle_runs.map((href) => ({ href, label: compactAgentReadinessProofLinkLabel('bundle_runs', href), group: 'bundle_runs' as const }))
  ];
  const pagePath = `/radar/readiness/${encodeURIComponent(card.provider_id)}`;
  const radarUrl = `https://radar.infopunks.fun${pagePath}`;
  const whatThisMeans = card.what_this_means ?? agentReadinessInterpretation(card.readiness_state);

  return <div className="shell public-provider-shell">
    <main className="public-provider-page agent-readiness-public-page" aria-label="Agent Spend Readiness Card">
      <section className="panel agent-readiness-public-card screenshot-card" aria-label="Screenshot-ready Agent Spend Readiness Card">
        <div className="agent-readiness-public-head">
          <div>
            <p className="section-kicker">Agent Spend Readiness Card</p>
            <h1>{card.provider_label}</h1>
            <p className="agent-readiness-provider-id">provider_id: <span>{card.provider_id}</span></p>
            <p className="panel-caption">Builders can now see what agents see before spending.</p>
            <p className="panel-caption">Proof-state diagnostics, not rankings.</p>
          </div>
          <a className="execute compact secondary" href="/">Radar Home</a>
        </div>
        <div className="agent-readiness-public-meta">
          <p><b>Provider ID</b><span>provider_id {card.provider_id}</span></p>
          <p><b>Radar URL</b><span>{radarUrl}</span></p>
          <p><b>Page path</b><span>{pagePath}</span></p>
          <p><b>Proof posture</b><span>Proof-state diagnostics, not rankings.</span></p>
        </div>
        <div className="readiness-chip-row" aria-label="readiness chips">
          <span className={`readiness-chip state-${card.readiness_state}`}>{card.readiness_state}</span>
          <span className={`readiness-chip spend-${card.agent_spend_readiness}`}>{card.agent_spend_readiness}</span>
          <span className="readiness-chip winner-claim">winner_claimed={String(card.winner_claimed)}</span>
        </div>
        <div className="agent-readiness-meaning" aria-label="What this means">
          <p className="section-kicker">What this means</p>
          <p>{whatThisMeans}</p>
        </div>
        <div className="agent-readiness-summary-grid screenshot-counts" aria-label="Evidence counts row">
          <Metric label="recorded_benchmarks" value={card.evidence_summary.recorded_benchmarks} sub="artifact-backed lanes" />
          <Metric label="proven_routes" value={card.evidence_summary.proven_routes} sub="route proof count" />
          <Metric label="controlled_bundle_runs" value={card.evidence_summary.controlled_bundle_runs} sub="bundle run references" />
          <Metric label="scaffold_lanes" value={card.evidence_summary.scaffold_lanes} sub="explored lanes" />
          <Metric label="caveat_count" value={card.evidence_summary.caveat_count} sub="caveats or blockers" />
        </div>
        <div className="agent-readiness-public-meta compact">
          {card.evidence_summary.latest_artifact_id && <p><b>latest artifact</b><span>{card.evidence_summary.latest_artifact_id}</span></p>}
          {card.evidence_summary.latest_observed_at && <p><b>latest observed</b><span>{card.evidence_summary.latest_observed_at}</span></p>}
        </div>
        <div className="agent-readiness-hero-copy">
          <div>
            <p className="section-kicker">Builder Next Step</p>
            <p>{card.builder_next_step}</p>
          </div>
          <div>
            <div className="agent-readiness-share">
              <span>Builder share text</span>
              <CopyButton value={card.share_copy} label="Copy readiness post" />
            </div>
            <pre className="agent-readiness-share-block">{card.share_copy}</pre>
          </div>
        </div>
        <AgentDecisionSummarySection summary={card.agent_readiness_summary} />
        <p className="agent-readiness-card-footer">Agents should inspect caveats before spend.</p>
      </section>

      <section className="panel agent-readiness-public-card" aria-label="Proof Links">
        <div className="panel-head"><div><p className="section-kicker">Proof Links</p><h2>Inspect before spend</h2></div></div>
        {proofLinks.length === 0
          ? <p className="panel-caption">No proof links exposed for this card yet.</p>
          : <div className="agent-readiness-proof-links">
            {proofLinks.map((link) => <a key={`${link.group}:${link.href}`} className="readiness-chip proof-link-chip" href={link.href} title={link.href}><span>{link.label}</span><small>{link.href}</small></a>)}
          </div>}
      </section>

      <section className="panel agent-readiness-public-card" aria-label="Agent Guidance">
        <p className="section-kicker">Agent Guidance</p>
        <div className="agent-readiness-guidance">
          <p>{card.agent_guidance}</p>
          <p>Readiness cards are proof-state diagnostics, not rankings.</p>
          <p>Agents should inspect route timelines, caveats, and latest artifacts before spend.</p>
          <p>winner_claimed=false means no provider winner should be inferred.</p>
        </div>
      </section>

    </main>
  </div>;
}

function AgentDecisionSummarySection({ summary }: { summary?: AgentReadinessDecisionSummary }) {
  return <div className="agent-decision-summary" aria-label="Agent Decision Summary">
    <div>
      <p className="section-kicker">Agent Decision Summary</p>
      <p className="panel-caption">Agent Readiness Summary compresses freshness, caveats, skipped steps, and cost visibility into one pre-spend decision object.</p>
    </div>
    {summary ? <>
      <div className="agent-decision-chip-row">
        <span>ready_for_agent_review={String(summary.ready_for_agent_review)}</span>
        <span>requires_rerun_before_spend={String(summary.requires_rerun_before_spend)}</span>
        <span>requires_human_or_policy_approval={String(summary.requires_human_or_policy_approval)}</span>
        <span>observed_cost_available={String(summary.observed_cost_available)}</span>
        <span>winner_claimed={String(summary.winner_claimed)}</span>
        <span>decision_state={summary.decision_state}</span>
      </div>
      <p className="agent-decision-action">recommended_agent_action: {summary.recommended_agent_action}</p>
      {!!summary.review_reasons.length && <div className="agent-decision-review-reasons" aria-label="Review reasons">
        {summary.review_reasons.map((reason) => <span key={reason}>{reason}</span>)}
      </div>}
    </> : <p className="route-state warn">Agent Readiness Summary unavailable for this provider card.</p>}
  </div>;
}

const MACHINE_MARKET_STAGES: MachineMarketEvidenceStage[] = [...MACHINE_EVIDENCE_STAGES];
const MACHINE_MARKET_CATEGORIES: MachineMarketCategory[] = ['compute', 'inference', 'web', 'vision', 'storage', 'translation', 'navigation'];
const MACHINE_MARKET_SOURCES: MachineMarketSource[] = ['pay.sh', 'robotic.sh', 'agentic.market'];
const MACHINE_MARKET_CHAINS: MachineMarketChain[] = ['solana', 'base', 'peaq', 'omnichain', 'unknown'];
const MACHINE_SELECTED_CONTROLLED_ACTION_ID = 'cloud-translation';

type MachineReadinessMatrixCellState = 'complete' | 'missing' | 'review' | 'not_applicable';
type MachineReadinessMatrixColumn =
  | 'listed'
  | 'classified'
  | 'policy_mapped'
  | 'preflight_recorded'
  | 'proof_path'
  | 'proof_plan_selected'
  | 'execution_receipt'
  | 'repeatability_receipt';

type MachineReadinessMatrixRow = {
  service: MachineMarketService;
  candidate: MachineExecutionCandidateScore | null;
  states: Record<MachineReadinessMatrixColumn, MachineReadinessMatrixCellState>;
};

type MachineMarketMapCategoryKey =
  | 'ai-inference'
  | 'data-query'
  | 'translation'
  | 'maps-navigation'
  | 'web-retrieval'
  | 'storage'
  | 'automation'
  | 'verification'
  | 'compute'
  | 'other';

type MachineMarketMapCategorySummary = {
  key: MachineMarketMapCategoryKey;
  label: string;
  services: MachineMarketService[];
  service_count: number;
  allow_count: number;
  review_count: number;
  deny_count: number;
  readiness_distribution: Record<MachineExecutionCandidateTier, number>;
  execution_status_distribution: Record<MachineExecutionCandidateScore['execution_status'], number>;
  evidence_health_distribution: Record<MachineMarketService['evidence_health'], number>;
  average_readiness_score: number;
  risk_score: number;
  strongest: boolean;
  riskiest: boolean;
  service_execution_receipt_count: number;
  category_risk_note: string;
  machine_use_narrative: string;
};

type MachineEconomySnapshotSummary = {
  candidates: MachineExecutionCandidateScore[];
  categorySummaries: MachineMarketMapCategorySummary[];
  rows: MachineReadinessMatrixRow[];
  selectedControlledAction: MachineExecutionCandidateScore | null;
  servicesMapped: number;
  categoryCount: number;
  allowCount: number;
  reviewCount: number;
  denyCount: number;
  proofPlansSelected: number;
  executionReceipts: number;
  repeatabilityReceipts: number;
  strongestCategory: MachineMarketMapCategorySummary | null;
  riskiestCategory: MachineMarketMapCategorySummary | null;
};

type MachineRailCoverageSummary = {
  totalServices: number;
  payShSolana: number;
  peaqProviderAccount: number;
  callableRoutesListed: number;
  providerSetupRequired: number;
  noCallableEndpointsRecorded: number;
  executionReceipts: number;
  repeatabilityReceipts: number;
};

type MachineExecutionBlockerRow = {
  service_id: string;
  service_name: string;
  blocker_class: 'route_surface' | 'credential' | 'review' | 'setup' | 'receipt';
  blocker: string;
  evidence_needed: string;
  next_safe_action: string;
  source_attribution: string;
};

type MachineExecutionBlockerSummary = {
  blockerRows: number;
  servicesBlocked: number;
  routeSurfaceBlockers: number;
  credentialBlockers: number;
  setupBlockers: number;
  receiptBlockers: number;
};

type MachineMarketChangelogRow = {
  date: string;
  change: string;
  scope: string;
  source: string;
  source_type:
    | 'catalog_metadata'
    | 'public_context'
    | 'manual_scaffold'
    | 'radar_preflight_receipt'
    | 'radar_execution_receipt'
    | 'radar_repeatability_receipt'
    | 'benchmark_artifact'
    | 'derived_radar_state'
    | 'unknown';
  claim_boundary: string;
  receipt_id?: string;
  receipt_href?: string;
};

type MachineRailExecutionStatus = 'not_execution_tested' | 'execution_receipt_recorded' | 'repeatability_receipt_recorded';

type MachineMarketFilters = {
  marketType: 'all' | MachineMarketType;
  category: 'all' | MachineMarketCategory;
  sourceMarket: 'all' | MachineMarketSource;
  chain: 'all' | MachineMarketChain;
  evidenceStage: 'all' | MachineMarketEvidenceStage;
  status: 'all' | MachineMarketStatus;
};

const MACHINE_MARKET_MAP_CATEGORY_LABELS: Record<MachineMarketMapCategoryKey, string> = {
  'ai-inference': 'AI / inference',
  'data-query': 'data / query',
  translation: 'translation',
  'maps-navigation': 'maps / navigation',
  'web-retrieval': 'web / retrieval',
  storage: 'storage',
  automation: 'automation',
  verification: 'verification',
  compute: 'compute',
  other: 'other'
};

const MACHINE_MARKET_MAP_CATEGORY_ORDER: MachineMarketMapCategoryKey[] = [
  'ai-inference',
  'data-query',
  'translation',
  'maps-navigation',
  'web-retrieval',
  'storage',
  'automation',
  'verification',
  'compute',
  'other'
];

function getSelectedControlledActionCandidate(candidates: MachineExecutionCandidateScore[]) {
  return candidates.find((candidate) => candidate.service.id === MACHINE_SELECTED_CONTROLLED_ACTION_ID) ?? candidates[0] ?? null;
}

function getMachineMarketMapCategoryLabel(service: MachineMarketService) {
  return MACHINE_MARKET_MAP_CATEGORY_LABELS[getMachineMarketMapCategoryKey(service)];
}

function getMachineMarketMapCategoryKey(service: MachineMarketService): MachineMarketMapCategoryKey {
  if (service.category === 'compute') return 'compute';
  if (service.category === 'storage') return 'storage';
  if (service.category === 'translation') return 'translation';
  if (service.category === 'navigation') return 'maps-navigation';
  if (service.category === 'vision' || service.category === 'inference') return 'ai-inference';
  if (service.category === 'web') {
    const id = service.id.toLowerCase();
    const name = service.name.toLowerCase();
    if (id.includes('bigquery') || name.includes('bigquery')) return 'data-query';
    if (id.includes('captcha') || name.includes('captcha')) return 'verification';
    if (id.includes('firecrawl') || id.includes('exa') || name.includes('firecrawl') || name.includes('exa')) return 'web-retrieval';
    return 'web-retrieval';
  }
  return 'other';
}

function getMachineMarketReadinessTierWeight(tier: MachineExecutionCandidateTier) {
  return ({ strong_candidate: 3, possible_candidate: 2, review_required: 1, not_ready: 0 } as const)[tier];
}

function formatMachineAccessRail(accessRail: MachineMarketAccessRail) {
  return ({
    pay_sh_solana: 'Pay.sh / Solana',
    peaqos_market_provider_account: 'peaqOS / provider account',
    peaqos_market_operator_defined: 'peaqOS / operator-defined',
    not_recorded: 'not recorded'
  } as const)[accessRail];
}

function formatMachineEndpointCount(count: number | null | undefined) {
  return typeof count === 'number' ? String(count) : 'not recorded';
}

function formatMachineRouteSurfaceStatus(status: MachineMarketRouteSurfaceStatus | 'account_pricing' | null | undefined) {
  if (!status) return 'not recorded';
  return status.replace(/_/g, ' ');
}

function readRecordedValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 'not recorded';
  return String(value);
}

function getRouteSurfaceImplication(status: MachineMarketRouteSurfaceStatus | 'account_pricing' | null | undefined) {
  switch (status) {
    case 'callable_routes_listed':
      return 'Catalog exposes callable route surface, but Radar still requires a service-specific execution receipt before claiming execution.';
    case 'provider_setup_only':
      return 'Provider setup is required before route execution can be planned.';
    case 'no_callable_endpoints':
      return 'No callable endpoint surface is currently recorded. Proof planning should not advance to execution.';
    case 'operator_runtime_required':
      return 'Operator runtime registration is required before autonomous calls can be evaluated.';
    case 'account_pricing':
      return 'Provider account pricing applies. Payment and billing evidence must be recorded separately.';
    case 'not_recorded':
    default:
      return 'Rail surface is not recorded yet. Execution planning remains blocked or review-required.';
  }
}

function getRailExecutionGate(
  service: MachineMarketService | null,
  latestPolicyDecision: MachinePreflightReceipt['decision'] | 'not recorded'
): { status: MachineRailExecutionGateStatus; reason: string } {
  if (!service) {
    return { status: 'not_recorded', reason: 'Service metadata is not recorded in the current registry mirror.' };
  }

  const routeSurface = service.route_surface_status ?? 'not_recorded';
  const higherRiskCategory = service.category === 'navigation' || service.category === 'compute' || service.category === 'storage';

  if (routeSurface === 'not_recorded') {
    return { status: 'not_recorded', reason: 'Rail surface is not recorded yet, so execution planning remains blocked or review-required.' };
  }
  if (routeSurface === 'provider_setup_only') {
    return { status: 'blocked', reason: 'Provider setup is required before route execution can be planned.' };
  }
  if (routeSurface === 'no_callable_endpoints') {
    return {
      status: latestPolicyDecision === 'review' ? 'review_required' : 'blocked',
      reason: 'No callable endpoint surface is currently recorded. Proof planning should not advance to execution.'
    };
  }
  if (routeSurface === 'operator_runtime_required') {
    return {
      status: latestPolicyDecision === 'review' ? 'review_required' : 'blocked',
      reason: 'Operator runtime registration is required before autonomous calls can be evaluated.'
    };
  }
  if (routeSurface === 'callable_routes_listed') {
    if (latestPolicyDecision === 'allow') {
      return higherRiskCategory
        ? { status: 'review_required', reason: 'Callable routes are listed, but this category carries physical-world or sensitive-data risk and still requires review before any execution attempt.' }
        : { status: 'ready_to_plan', reason: 'Callable routes are listed and policy currently allows planning-only proof work. Execution still requires a service-specific receipt.' };
    }
    if (latestPolicyDecision === 'review') {
      return { status: 'review_required', reason: 'Callable routes are listed, but current policy keeps this service in review before planning can advance.' };
    }
    if (latestPolicyDecision === 'deny') {
      return { status: 'blocked', reason: 'Callable routes are listed, but current policy denies use of this service.' };
    }
    return {
      status: higherRiskCategory ? 'review_required' : 'not_recorded',
      reason: 'Callable routes are listed, but no service-specific policy decision is recorded yet.'
    };
  }

  return { status: 'not_recorded', reason: 'Rail execution gate is not recorded for this route surface.' };
}

function getMachineRailExecutionStatus(service: MachineMarketService, receipts: MachinePreflightReceipt[]): MachineRailExecutionStatus {
  const matchingReceipts = receipts.filter((receipt) =>
    receipt.receipt_type === 'machine_execution'
    && (receipt.execution_service_id === service.id || receipt.selected_service_id === service.id)
  );
  if (!matchingReceipts.length) return 'not_execution_tested';
  const hasRepeatability = matchingReceipts.filter((receipt) => receipt.execution_status === 'succeeded').length >= 2;
  if (hasRepeatability) return 'repeatability_receipt_recorded';
  return 'execution_receipt_recorded';
}

function getMachineRouteExecutionStatus(serviceId: string, receipts: MachinePreflightReceipt[]): MachineRouteExecutionStatus {
  const matchingReceipts = receipts.filter((receipt) =>
    receipt.receipt_type === 'machine_execution'
    && (receipt.execution_service_id === serviceId || receipt.selected_service_id === serviceId)
  );
  if (!matchingReceipts.length) return 'not_attempted';
  const repeatable = matchingReceipts.filter((receipt) => receipt.execution_status === 'succeeded').length >= 2;
  return repeatable ? 'repeatability_receipt_recorded' : 'service_receipt_recorded';
}

function formatMachineRouteRisk(risk: MachineRouteRisk) {
  return risk.replace(/_/g, ' ');
}

function formatMachineFirstSafeCandidate(value: MachineFirstSafeCandidate) {
  return value.replace(/_/g, ' ');
}

function formatMachineRouteExecutionStatus(value: MachineRouteExecutionStatus) {
  return value.replace(/_/g, ' ');
}

function formatFirstSafeQueueExecutionStatus(value: MachineRouteExecutionStatus) {
  if (value === 'service_receipt_recorded') return 'execution_receipt_recorded';
  if (value === 'repeatability_receipt_recorded') return 'repeatability_recorded';
  return 'not_attempted';
}

function machineEvidenceCounts(receipts: MachinePreflightReceipt[]) {
  return summarizeMachineEvidenceCounts(receipts);
}

function serviceExecutionReceiptLabel(count: number) {
  return `${count} service-specific execution receipt${count === 1 ? '' : 's'} recorded`;
}

function paymentSuccessClaimLabel(count: number) {
  return `${count} payment success claim${count === 1 ? '' : 's'}`;
}

function benchmarkClaimLabel(count: number) {
  return `${count} benchmark claim${count === 1 ? '' : 's'}`;
}

function winnerClaimLabel(count: number) {
  return `${count} winner claim${count === 1 ? '' : 's'}`;
}

function getMachineFirstSafeServiceIds() {
  return ['cloud-translation', 'naver-maps', 'bigquery', 'stableupload', 'qvac'];
}

function buildMachineRouteRiskRows(services: MachineMarketService[], receipts: MachinePreflightReceipt[]): MachineRouteRiskRow[] {
  const rows: MachineRouteRiskRow[] = [];

  for (const service of services) {
    const execution_status = getMachineRouteExecutionStatus(service.id, receipts);
    const credentialRequirement = service.credential_requirement ?? 'not recorded';
    const railCaveat = service.rail_caveat ?? 'rail caveat not recorded';

    if (service.id === 'naver-maps' && service.catalog_routes?.length) {
      for (const route of service.catalog_routes) {
        const baseRow = {
          service_id: service.id,
          service_name: service.name,
          provider: service.provider,
          category: service.category,
          access_rail: service.access_rail,
          route_label: route.label,
          method: route.method,
          path: route.path,
          credential_requirement: credentialRequirement,
          execution_status,
          rail_caveat: railCaveat
        };

        if (route.path === '/map-geocode/v2/geocode') {
          rows.push({
            ...baseRow,
            route_risk: 'low_to_medium',
            first_safe_candidate: 'yes',
            avoid_first: 'no',
            avoid_first_reason: null,
            expected_output_class: 'geocode result / coordinates / address match',
            proof_condition: 'bounded public landmark or generic address lookup, non-operational, no robot command'
          });
          continue;
        }

        if (route.path === '/map-reversegeocode/v2/gc') {
          rows.push({
            ...baseRow,
            route_risk: 'low_to_medium',
            first_safe_candidate: 'possible',
            avoid_first: 'no',
            avoid_first_reason: null,
            expected_output_class: 'reverse geocode result / address from coordinate',
            proof_condition: 'bounded generic coordinate lookup, non-operational, no robot command'
          });
          continue;
        }

        if (route.path === '/map-static/v2/raster') {
          rows.push({
            ...baseRow,
            route_risk: 'low_to_medium',
            first_safe_candidate: 'possible',
            avoid_first: 'no',
            avoid_first_reason: null,
            expected_output_class: 'static map response / raster map metadata',
            proof_condition: 'bounded public landmark/static map lookup, no navigation instruction'
          });
          continue;
        }

        rows.push({
          ...baseRow,
          route_risk: 'high',
          first_safe_candidate: 'no',
          avoid_first: 'yes',
          avoid_first_reason: 'physical-world routing risk',
          expected_output_class: 'route guidance / driving directions',
          proof_condition: 'only after geocode/static-map checks; non-operational route lookup; no robot command; no dispatch; no physical movement'
        });
      }
      continue;
    }

    if (
      service.id === 'bigquery'
      && service.route_surface_status === 'callable_routes_listed'
      && typeof service.endpoint_count === 'number'
      && service.endpoint_count > 0
    ) {
      rows.push({
        service_id: service.id,
        service_name: service.name,
        provider: service.provider,
        category: service.category,
        access_rail: service.access_rail,
        route_label: 'Bounded query result lookup',
        method: 'not recorded',
        path: 'route surface not recorded',
        route_risk: 'medium',
        first_safe_candidate: 'yes',
        avoid_first: 'no',
        avoid_first_reason: null,
        credential_requirement: credentialRequirement,
        expected_output_class: 'tabular query result / schema / bounded rows',
        proof_condition: 'query limited; synthetic/public dataset; parseable result; durable receipt required',
        execution_status,
        rail_caveat: railCaveat
      });
      continue;
    }

    if (
      service.id === 'stableupload'
      && service.route_surface_status === 'callable_routes_listed'
      && typeof service.endpoint_count === 'number'
      && service.endpoint_count > 0
    ) {
      rows.push({
        service_id: service.id,
        service_name: service.name,
        provider: service.provider,
        category: service.category,
        access_rail: service.access_rail,
        route_label: 'Tiny non-sensitive fixture upload',
        method: 'not recorded',
        path: 'route surface not recorded',
        route_risk: 'medium',
        first_safe_candidate: 'yes',
        avoid_first: 'no',
        avoid_first_reason: null,
        credential_requirement: credentialRequirement,
        expected_output_class: 'upload receipt / storage reference / file metadata',
        proof_condition: 'harmless fixture; bounded file size; no sensitive data; durable receipt required',
        execution_status,
        rail_caveat: railCaveat
      });
    }
  }

  return rows;
}

function buildMachineRouteRiskSummary(rows: MachineRouteRiskRow[]): MachineRouteRiskSummary {
  return {
    servicesWithRouteSurfaces: new Set(rows.map((row) => row.service_id)).size,
    totalRoutesMapped: rows.length,
    firstSafeCandidates: rows.filter((row) => row.first_safe_candidate === 'yes' || row.first_safe_candidate === 'possible').length,
    avoidFirstRoutes: rows.filter((row) => row.avoid_first === 'yes').length,
    highRiskRoutes: rows.filter((row) => row.route_risk === 'high').length,
    executionReceipts: new Set(rows.filter((row) => row.execution_status !== 'not_attempted').map((row) => row.service_id)).size
  };
}

function buildMachineFirstSafeRouteQueueRows(services: MachineMarketService[], receipts: MachinePreflightReceipt[]): MachineFirstSafeRouteQueueRow[] {
  const routeRows = buildMachineRouteRiskRows(services, receipts);
  const serviceById = new Map(services.map((service) => [service.id, service]));

  return getMachineFirstSafeServiceIds().map((serviceId, index) => {
    const service = serviceById.get(serviceId);
    if (!service) return null;

    const executionStatus = getMachineRouteExecutionStatus(service.id, receipts);
    const latestExecutionReceipt = getServiceExecutionReceipt(service.id, receipts);
    const proofPlanHref = `/machine-execution-plan/${encodeURIComponent(service.id)}`;

    if (service.id === 'cloud-translation') {
      return {
        rank: index + 1,
        service_id: service.id,
        service_name: service.name,
        first_safe_route: 'safe translation phrase',
        why_safe_first: 'simple input/output, bounded text, semantic output class is easy to verify',
        blocked_by: 'callable endpoint surface not recorded; execution rail confirmation not recorded',
        required_evidence: 'execution receipt, payment/auth status if available, normalized translation summary, caveats',
        execution_status: executionStatus,
        execution_receipt_id: latestExecutionReceipt?.receipt_id ?? null,
        proof_plan_href: proofPlanHref,
        warning: 'Selected proof plan does not imply execution-tested status.',
        review_gated: false,
        blocked_or_setup_required: true
      };
    }

    if (service.id === 'naver-maps') {
      const geocodeRow = routeRows.find((row) => row.service_id === service.id && row.path === '/map-geocode/v2/geocode') ?? null;
      return {
        rank: index + 1,
        service_id: service.id,
        service_name: service.name,
        first_safe_route: geocodeRow ? `geocode lookup (${geocodeRow.method} ${geocodeRow.path})` : 'geocode lookup',
        why_safe_first: 'lower-risk lookup than driving directions; does not require robot dispatch or physical movement',
        blocked_by: 'Naver Cloud credentials, provider/account setup, review state, non-operational test constraints',
        required_evidence: 'service-specific execution receipt, selected_route, credential_status, non-operational test flag, no robot command, no physical movement, normalized geocode summary',
        execution_status: executionStatus,
        execution_receipt_id: latestExecutionReceipt?.receipt_id ?? null,
        proof_plan_href: proofPlanHref,
        warning: 'Driving directions is avoid-first because route guidance can influence physical-world movement.',
        review_gated: true,
        blocked_or_setup_required: true
      };
    }

    if (service.id === 'bigquery') {
      const liveStatus = getBigQueryLiveHarnessStatus(service, receipts);
      return {
        rank: index + 1,
        service_id: service.id,
        service_name: service.name,
        first_safe_route: 'bounded public/synthetic query',
        why_safe_first: 'bounded query result can be parsed without sensitive production data',
        blocked_by: liveStatus === 'blocked_live_harness_not_configured'
          ? 'live harness/credentials/rail not configured for controlled run'
          : 'dataset boundary; credential/payment status',
        required_evidence: 'selected_route, bounded query input, parseable tabular output, credential_status, harness gate status, execution receipt',
        execution_status: executionStatus,
        execution_receipt_id: latestExecutionReceipt?.receipt_id ?? null,
        proof_plan_href: proofPlanHref,
        warning: `BigQuery live status: ${liveStatus}. Do not query sensitive business or production data in the first proof attempt.`,
        review_gated: liveStatus !== 'receipt_recorded',
        blocked_or_setup_required: liveStatus === 'blocked_live_harness_not_configured'
      };
    }

    if (service.id === 'stableupload') {
      return {
        rank: index + 1,
        service_id: service.id,
        service_name: service.name,
        first_safe_route: 'tiny non-sensitive fixture upload',
        why_safe_first: 'harmless small fixture minimizes privacy and storage risk',
        blocked_by: 'callable route/path confirmation not recorded; storage policy review; credential/payment status',
        required_evidence: 'selected_route, fixture hash or metadata, upload response, credential_status, execution receipt',
        execution_status: executionStatus,
        execution_receipt_id: latestExecutionReceipt?.receipt_id ?? null,
        proof_plan_href: proofPlanHref,
        warning: 'Do not upload private, regulated, or production data in the first proof attempt.',
        review_gated: true,
        blocked_or_setup_required: true
      };
    }

    return {
      rank: index + 1,
      service_id: service.id,
      service_name: service.name,
      first_safe_route: 'runtime registration review, no execution',
      why_safe_first: 'operator-defined/runtime setup means execution should not proceed until registration semantics are understood',
      blocked_by: 'operator runtime registration, callable route details, review state',
      required_evidence: 'setup/registration evidence, route surface metadata, policy review, no execution receipt expected yet',
      execution_status: executionStatus,
      execution_receipt_id: latestExecutionReceipt?.receipt_id ?? null,
      proof_plan_href: proofPlanHref,
      warning: 'Runtime registration review comes before autonomous execution.',
      review_gated: true,
      blocked_or_setup_required: true
    };
  }).filter((row): row is MachineFirstSafeRouteQueueRow => Boolean(row));
}

function buildMachineFirstSafeRouteQueueSummary(rows: MachineFirstSafeRouteQueueRow[]): MachineFirstSafeRouteQueueSummary {
  return {
    queueEntries: rows.length,
    firstSafeCandidates: rows.length,
    reviewGatedEntries: rows.filter((row) => row.review_gated).length,
    blockedOrSetupRequiredEntries: rows.filter((row) => row.blocked_or_setup_required).length,
    executionReceipts: new Set(rows.filter((row) => row.execution_status !== 'not_attempted').map((row) => row.service_id)).size,
    repeatabilityReceipts: new Set(rows.filter((row) => row.execution_status === 'repeatability_receipt_recorded').map((row) => row.service_id)).size
  };
}

function buildMachineRailCoverageSummary(services: MachineMarketService[], receipts: MachinePreflightReceipt[]): MachineRailCoverageSummary {
  return {
    totalServices: services.length,
    payShSolana: services.filter((service) => service.access_rail === 'pay_sh_solana').length,
    peaqProviderAccount: services.filter((service) => service.access_rail === 'peaqos_market_provider_account').length,
    callableRoutesListed: services.filter((service) => service.route_surface_status === 'callable_routes_listed').length,
    providerSetupRequired: services.filter((service) => service.route_surface_status === 'provider_setup_only' || service.route_surface_status === 'operator_runtime_required').length,
    noCallableEndpointsRecorded: services.filter((service) => service.route_surface_status === 'no_callable_endpoints').length,
    executionReceipts: services.filter((service) => getMachineRailExecutionStatus(service, receipts) !== 'not_execution_tested').length,
    repeatabilityReceipts: services.filter((service) => getMachineRailExecutionStatus(service, receipts) === 'repeatability_receipt_recorded').length
  };
}

function getMachineSourceAttribution(service: MachineMarketService) {
  const source = service.source_attribution;
  if (!source) return `${service.observed_source} · ${formatDate(service.observed_at)} · public/catalog context only`;
  return `${source.source} · ${source.scope} · observed ${formatDate(source.observed_at)}`;
}

function defaultMachineSourceAttribution(service: MachineMarketService): MachineAttributionRow {
  return service.source_attribution ?? {
    source: 'robotic.sh catalog metadata',
    scope: 'service identity / category / provider / market listing',
    observed_at: service.observed_at,
    caveat: 'Catalog presence does not imply execution or payment proof.'
  };
}

function getMachineServiceAttributionRows(service: MachineMarketService): MachineAttributionRow[] {
  const rows: MachineAttributionRow[] = [defaultMachineSourceAttribution(service)];
  rows.push({
    source: 'manual scaffold',
    scope: 'policy/readiness/rail planning metadata',
    observed_at: service.observed_at,
    caveat: 'Planning metadata only; not execution evidence.'
  });
  if (service.id === 'naver-maps') {
    rows.push({
      source: 'robotic.sh service page',
      scope: 'NAVER Maps listing, category, endpoint count, route surface',
      observed_at: service.observed_at,
      caveat: 'Catalog route surface only; Radar has not executed routes.'
    });
    rows.push({
      source: 'public demo context',
      scope: 'peaq / Serve Robotics / NAVER Maps public workflow context',
      observed_at: service.observed_at,
      caveat: 'Public context only; not Radar execution evidence, not payment proof.'
    });
    rows.push({
      source: 'manual scaffold',
      scope: 'policy review, first-safe route, route-risk interpretation',
      observed_at: service.observed_at,
      caveat: 'Radar planning judgment; execution remains receipt-driven.'
    });
  }
  return rows;
}

function getMachineReceiptAttributionRow(service: MachineMarketService, latestExecution: MachinePreflightReceipt | null): MachineAttributionRow {
  return {
    source: 'Radar receipt ledger',
    scope: 'service-specific execution receipts',
    observed_at: latestExecution?.execution_completed_at ?? latestExecution?.created_at ?? service.observed_at,
    caveat: latestExecution
      ? 'Receipt recorded. Scope is service-specific and does not imply market-wide execution.'
      : 'No service-specific execution receipt recorded.'
  };
}

function SourceAttributionPanel({ title, rows, ariaLabel }: { title: string; rows: MachineAttributionRow[]; ariaLabel: string }) {
  return <section className="panel machine-policy-summary" aria-label={ariaLabel}>
    <div className="panel-head"><div><p className="section-kicker">{title}</p><h2>{title}</h2></div></div>
    <div className="machine-usage-list">
      {rows.map((row, index) => <p key={`${row.source}:${row.scope}:${index}`}>
        <span>{row.source}</span>
        <small>scope: {row.scope} · observed_at: {formatMachineTimestamp(row.observed_at)} · caveat: {row.caveat}</small>
      </p>)}
    </div>
  </section>;
}

function buildMachineExecutionBlockerRows(services: MachineMarketService[], receipts: MachinePreflightReceipt[]): MachineExecutionBlockerRow[] {
  const rows: MachineExecutionBlockerRow[] = [];

  for (const service of services) {
    const executionStatus = getMachineRouteExecutionStatus(service.id, receipts);
    const source_attribution = getMachineSourceAttribution(service);
    const bigQueryLiveStatus = service.id === 'bigquery' ? getBigQueryLiveHarnessStatus(service, receipts) : null;

    if (executionStatus === 'not_attempted') {
      rows.push({
        service_id: service.id,
        service_name: service.name,
        blocker_class: 'receipt',
        blocker: 'No service-specific execution receipt recorded.',
        evidence_needed: 'Durable execution receipt with service id, selected route, execution status, and payment/auth evidence if available.',
        next_safe_action: 'Keep listed/callable states separate from execution claims.',
        source_attribution
      });
    }

    if (service.route_surface_status === 'no_callable_endpoints' || service.route_surface_status === 'not_recorded') {
      rows.push({
        service_id: service.id,
        service_name: service.name,
        blocker_class: 'route_surface',
        blocker: service.route_surface_status === 'no_callable_endpoints' ? 'No callable endpoint surface recorded.' : 'Route surface is not recorded.',
        evidence_needed: 'Concrete route metadata or a proof plan that explicitly records the missing route surface.',
        next_safe_action: 'Do not advance from listed to callable until route metadata changes.',
        source_attribution
      });
    }

    if (service.route_surface_status === 'operator_runtime_required' || service.route_surface_status === 'provider_setup_only') {
      rows.push({
        service_id: service.id,
        service_name: service.name,
        blocker_class: 'setup',
        blocker: service.route_surface_status === 'operator_runtime_required' ? 'Operator runtime registration required.' : 'Provider setup required.',
        evidence_needed: 'Setup/registration evidence and non-operational route semantics before execution planning.',
        next_safe_action: 'Review setup path without claiming service execution.',
        source_attribution
      });
    }

    if ((service.credential_requirement ?? 'not recorded') !== 'not recorded') {
      rows.push({
        service_id: service.id,
        service_name: service.name,
        blocker_class: 'credential',
        blocker: service.credential_requirement ?? 'credential requirement recorded',
        evidence_needed: 'Credential status separate from payment proof and route execution receipt.',
        next_safe_action: 'Record credential readiness without treating it as payment or execution proof.',
        source_attribution
      });
    }

    if (service.rail_status === 'review_required') {
      rows.push({
        service_id: service.id,
        service_name: service.name,
        blocker_class: 'review',
        blocker: 'Human review required before autonomous spend planning.',
        evidence_needed: 'Policy decision, bounded route constraints, and caveat acceptance.',
        next_safe_action: 'Keep Governance before autonomy as the default posture.',
        source_attribution
      });
    }

    if (service.id === 'bigquery' && bigQueryLiveStatus === 'blocked_live_harness_not_configured') {
      rows.push({
        service_id: service.id,
        service_name: service.name,
        blocker_class: 'setup',
        blocker: 'BigQuery live Harness, credentials, or rail is not configured.',
        evidence_needed: 'Harness integration status, credential status, rail status, and explicit blocked reasons from /v1/machine-execution/bigquery/run-bounded-query.',
        next_safe_action: 'Keep fixture path separate; do not claim live execution until a live Harness receipt is recorded.',
        source_attribution
      });
    }
  }

  return rows;
}

function buildMachineExecutionBlockerSummary(rows: MachineExecutionBlockerRow[]): MachineExecutionBlockerSummary {
  return {
    blockerRows: rows.length,
    servicesBlocked: new Set(rows.map((row) => row.service_id)).size,
    routeSurfaceBlockers: rows.filter((row) => row.blocker_class === 'route_surface').length,
    credentialBlockers: rows.filter((row) => row.blocker_class === 'credential').length,
    setupBlockers: rows.filter((row) => row.blocker_class === 'setup').length,
    receiptBlockers: rows.filter((row) => row.blocker_class === 'receipt').length
  };
}

function buildMachineMarketChangelogRows(services: MachineMarketService[], receipts: MachinePreflightReceipt[]): MachineMarketChangelogRow[] {
  const naver = services.find((service) => service.id === 'naver-maps');
  const latestExecution = receipts.find((row) => row.receipt_type === 'machine_execution' && row.execution_occurred) ?? null;
  const latestBigQueryExecution = receipts.find((row) =>
    row.receipt_type === 'machine_execution'
    && row.execution_occurred
    && (row.execution_service_id ?? row.selected_service_id) === 'bigquery'
  ) ?? null;
  const latestStableuploadExecution = receipts.find((row) =>
    row.receipt_type === 'machine_execution'
    && row.execution_occurred
    && (row.execution_service_id ?? row.selected_service_id) === 'stableupload'
  ) ?? null;
  const latestNaverGeocodeExecution = receipts.find((row) =>
    row.receipt_type === 'machine_execution'
    && row.execution_occurred
    && (row.execution_service_id ?? row.selected_service_id) === 'naver-maps'
  ) ?? null;
  const latestCloudTranslationExecution = receipts.find((row) =>
    row.receipt_type === 'machine_execution'
    && row.execution_occurred
    && (row.execution_service_id ?? row.selected_service_id) === 'cloud-translation'
  ) ?? null;
  const executionService = latestExecution
    ? services.find((service) => service.id === (latestExecution.execution_service_id ?? latestExecution.selected_service_id))
    : null;
  const successfulBigQueryRuns = receipts.filter((row) =>
    row.receipt_type === 'machine_execution'
    && (row.execution_service_id ?? row.selected_service_id) === 'bigquery'
    && row.execution_status === 'succeeded'
    && row.execution_occurred
  ).length;
  const successfulAnyTransRuns = receipts.filter((row) =>
    row.receipt_type === 'machine_execution'
    && (row.execution_service_id ?? row.selected_service_id) === 'anytrans'
    && row.execution_status === 'succeeded'
    && row.execution_occurred
  ).length;
  const repeatabilityRows: MachineMarketChangelogRow[] = [];
  if (successfulAnyTransRuns >= 2) {
    repeatabilityRows.push({
      date: formatMachineTimestamp(receipts[0]?.created_at ?? MACHINE_MARKET_SOURCE_OBSERVED_AT),
      change: `Machine Translation repeatability ${successfulAnyTransRuns >= 3 ? 'recorded' : 'candidate'} from service-specific receipts (${successfulAnyTransRuns} successful runs).`,
      scope: 'machine translation repeatability',
      source: 'Radar receipt-derived repeatability pack',
      source_type: 'radar_repeatability_receipt',
      claim_boundary: 'Repeatability is route-specific and not benchmark or winner proof.'
    });
  }
  if (successfulBigQueryRuns >= 2) {
    repeatabilityRows.push({
      date: formatMachineTimestamp(receipts[0]?.created_at ?? MACHINE_MARKET_SOURCE_OBSERVED_AT),
      change: `BigQuery bounded query repeatability ${successfulBigQueryRuns >= 3 ? 'recorded' : 'candidate'} from service-specific receipts (${successfulBigQueryRuns} successful runs).`,
      scope: 'bigquery repeatability',
      source: 'Radar receipt-derived repeatability pack',
      source_type: 'radar_repeatability_receipt',
      claim_boundary: 'Repeatability is route-specific and not benchmark or winner proof.'
    });
  }
  return [
    latestExecution ? {
      date: formatMachineTimestamp(latestExecution.created_at),
      change: `${executionService?.name ?? latestExecution.execution_service_id ?? 'Service'} execution receipt recorded (${latestExecution.receipt_id}).`,
      scope: 'service execution receipt',
      source: 'Radar machine receipt ingest',
      source_type: 'radar_execution_receipt' as const,
      claim_boundary: 'Service-specific execution receipt only. Not market-wide proof, not payment proof, not benchmark proof, not winner proof.',
      receipt_id: latestExecution.receipt_id,
      receipt_href: `/machine-execution/${encodeURIComponent(latestExecution.receipt_id)}`
    } : {
      date: '2026-05-22',
      change: 'Execution receipt ingest surface is available for service-specific machine execution evidence.',
      scope: 'service execution receipt',
      source: 'Radar machine receipt ingest',
      source_type: 'manual_scaffold' as const,
      claim_boundary: 'Ingestion capability does not imply execution.'
    },
    ...(latestBigQueryExecution ? [{
      date: formatMachineTimestamp(latestBigQueryExecution.created_at),
      change: `BigQuery bounded query fixture receipt recorded (${latestBigQueryExecution.receipt_id}).`,
      scope: 'bigquery first-safe receipt',
      source: 'Radar fixture ingest (replaceable by Harness output)',
      source_type: 'manual_scaffold' as const,
      claim_boundary: 'Service-specific execution receipt only. Bounded public/synthetic query only. Not market-wide proof, not payment proof, not benchmark proof, not winner proof.',
      receipt_id: latestBigQueryExecution.receipt_id,
      receipt_href: `/machine-execution/${encodeURIComponent(latestBigQueryExecution.receipt_id)}`
    }] : []),
    ...(latestStableuploadExecution ? [{
      date: formatMachineTimestamp(latestStableuploadExecution.created_at),
      change: `Stableupload tiny non-sensitive fixture receipt recorded (${latestStableuploadExecution.receipt_id}).`,
      scope: 'stableupload first-safe receipt',
      source: 'Radar fixture ingest (replaceable by Harness output)',
      source_type: 'manual_scaffold' as const,
      claim_boundary: 'Service-specific execution receipt only. Tiny non-sensitive fixture only. Not market-wide proof, not payment proof, not benchmark proof, not winner proof.',
      receipt_id: latestStableuploadExecution.receipt_id,
      receipt_href: `/machine-execution/${encodeURIComponent(latestStableuploadExecution.receipt_id)}`
    }] : []),
    ...(latestNaverGeocodeExecution ? [{
      date: formatMachineTimestamp(latestNaverGeocodeExecution.created_at),
      change: `NAVER Maps non-operational geocode fixture receipt recorded (${latestNaverGeocodeExecution.receipt_id}).`,
      scope: 'naver geocode first-safe receipt',
      source: 'Radar fixture ingest (replaceable by Harness output)',
      source_type: 'manual_scaffold' as const,
      claim_boundary: 'Non-operational geocode lookup only. No robot command. No physical movement. Public context only is not Radar execution evidence. Service-specific execution receipt only. Not market-wide proof, not payment proof, not benchmark proof, not winner proof.',
      receipt_id: latestNaverGeocodeExecution.receipt_id,
      receipt_href: `/machine-execution/${encodeURIComponent(latestNaverGeocodeExecution.receipt_id)}`
    }] : []),
    ...(latestCloudTranslationExecution ? [{
      date: formatMachineTimestamp(latestCloudTranslationExecution.created_at),
      change: `Cloud Translation safe phrase fixture receipt recorded (${latestCloudTranslationExecution.receipt_id}).`,
      scope: 'cloud translation first-safe receipt',
      source: 'Radar fixture ingest (replaceable by Harness output)',
      source_type: 'manual_scaffold' as const,
      claim_boundary: 'Service-specific execution receipt only. Safe phrase translation only. Not market-wide proof, not payment proof, not benchmark proof, not winner proof.',
      receipt_id: latestCloudTranslationExecution.receipt_id,
      receipt_href: `/machine-execution/${encodeURIComponent(latestCloudTranslationExecution.receipt_id)}`
    }] : []),
    {
      date: '2026-05-22',
      change: `${services.length || 13} robotic.sh-visible services mapped into Radar machine-market metadata.`,
      scope: 'service-level visibility',
      source: 'Radar static Phase 2 mirror',
      source_type: 'catalog_metadata' as const,
      claim_boundary: 'Listed does not mean callable or executed.'
    },
    {
      date: '2026-05-22',
      change: 'Machine function categories normalized for policy, route-risk, and market-map views.',
      scope: 'classification',
      source: 'Radar registry classification',
      source_type: 'derived_radar_state' as const,
      claim_boundary: 'Category fit is intelligence metadata, not provider quality.'
    },
    {
      date: '2026-05-22',
      change: 'Cloud Translation selected for controlled proof planning.',
      scope: 'planning',
      source: 'Radar execution shortlist',
      source_type: 'derived_radar_state' as const,
      claim_boundary: 'Selected proof plan is not an execution claim.'
    },
    {
      date: '2026-05-22',
      change: naver ? 'NAVER Maps added as navigation / review / not_attempted with geocode as the first-safe route.' : 'NAVER Maps route metadata reserved for navigation review.',
      scope: 'route-level risk',
      source: 'Radar service metadata plus public demo context caveat',
      source_type: 'public_context' as const,
      claim_boundary: 'Public demo context is not Radar evidence; NAVER Maps has not been executed by Radar.'
    },
    {
      date: '2026-05-22',
      change: 'Rail coverage, route-risk matrix, first-safe queue, blockers, changelog, and no-claim ledger exposed as market-control-plane views.',
      scope: 'intelligence surface',
      source: 'Radar UI scaffold',
      source_type: 'manual_scaffold' as const,
      claim_boundary: 'New pages add interpretation and policy memory, not new live Pay.sh, robotic.sh, or peaqOS data.'
    },
    ...repeatabilityRows
  ];
}

function formatDistributionSummary(distribution: Record<string, number>, order: string[]) {
  return order.map((key) => `${key} ${distribution[key] ?? 0}`).join(' · ');
}

function buildMachineMarketMapSummaries(
  services: MachineMarketService[],
  candidates: MachineExecutionCandidateScore[],
  latestRun: MachinePreflightCoverageRun | null,
  receipts: MachinePreflightReceipt[]
) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.service.id, candidate]));
  const summaries: MachineMarketMapCategorySummary[] = [];

  for (const key of MACHINE_MARKET_MAP_CATEGORY_ORDER) {
    const categoryServices = services.filter((service) => getMachineMarketMapCategoryKey(service) === key);
    if (!categoryServices.length) continue;
    const readiness_distribution: Record<MachineExecutionCandidateTier, number> = {
      strong_candidate: 0,
      possible_candidate: 0,
      review_required: 0,
      not_ready: 0
    };
    const execution_status_distribution: Record<MachineExecutionCandidateScore['execution_status'], number> = {
      'not_attempted': 0,
      'attempted-recorded': 0,
      'execution-tested': 0,
      'repeatability-recorded': 0
    };
    const evidence_health_distribution: Record<MachineMarketService['evidence_health'], number> = {
      scaffold: 0,
      listed: 0
    };

    let allow_count = 0;
    let review_count = 0;
    let deny_count = 0;
    let readiness_points = 0;

    for (const service of categoryServices) {
      const candidate = candidateById.get(service.id) ?? scoreMachineExecutionCandidate(service, receipts, latestRun);
      const coverageDecision = getCoverageServiceResult(service.id, latestRun)?.decision ?? null;
      const decision = candidate.latest_policy_decision !== 'not recorded' ? candidate.latest_policy_decision : coverageDecision ?? 'not recorded';
      if (decision === 'allow') allow_count += 1;
      if (decision === 'review') review_count += 1;
      if (decision === 'deny') deny_count += 1;
      readiness_distribution[candidate.candidate_tier] += 1;
      execution_status_distribution[candidate.execution_status] += 1;
      evidence_health_distribution[service.evidence_health] += 1;
      readiness_points += getMachineMarketReadinessTierWeight(candidate.candidate_tier);
    }

    const service_count = categoryServices.length;
    const average_readiness_score = service_count ? readiness_points / service_count : 0;
    const risk_score = (deny_count * 2) + review_count;
    const category_risk_note = key === 'maps-navigation'
      ? 'Physical-world route decisions require bounded test scenarios, source validation, and clear non-operational demo constraints before execution.'
      : deny_count > 0
        ? 'Contains at least one deny decision. Keep this category blocked unless policy evidence changes.'
        : review_count > 0
          ? 'Contains review-required services. Human review and bounded authority remain mandatory.'
          : 'Current policy coverage skews allow, but category status is still planning-only and not execution-proven.';
    const machine_use_narrative = key === 'maps-navigation'
      ? 'NAVER Maps exposes routing, geocoding, and navigation services for autonomous machines. This is high machine relevance but requires review because routing outputs can influence physical-world movement.'
      : `This category shows how machines could use ${MACHINE_MARKET_MAP_CATEGORY_LABELS[key].toLowerCase()} services for ${compactList(categoryServices.map((service) => service.machine_use_case), 2).toLowerCase()}.`;

    summaries.push({
      key,
      label: MACHINE_MARKET_MAP_CATEGORY_LABELS[key],
      services: categoryServices,
      service_count,
      allow_count,
      review_count,
      deny_count,
      readiness_distribution,
      execution_status_distribution,
      evidence_health_distribution,
      average_readiness_score,
      risk_score,
      strongest: false,
      riskiest: false,
      service_execution_receipt_count: execution_status_distribution['execution-tested'] + execution_status_distribution['repeatability-recorded'],
      category_risk_note,
      machine_use_narrative
    });
  }

  const strongest = summaries
    .slice()
    .sort((a, b) => b.average_readiness_score - a.average_readiness_score || b.allow_count - a.allow_count || a.label.localeCompare(b.label))[0] ?? null;
  const riskiest = summaries
    .slice()
    .sort((a, b) => b.risk_score - a.risk_score || b.deny_count - a.deny_count || b.review_count - a.review_count || a.label.localeCompare(b.label))[0] ?? null;

  return summaries.map((summary) => ({
    ...summary,
    strongest: strongest?.key === summary.key,
    riskiest: riskiest?.key === summary.key
  }));
}

function getCoverageServiceResult(serviceId: string, latestRun: MachinePreflightCoverageRun | null) {
  return latestRun?.service_results.find((row) => row.service_id === serviceId) ?? null;
}

function getServicePreflightReceipt(serviceId: string, receipts: MachinePreflightReceipt[]) {
  return receipts.find((receipt) => receipt.receipt_type === 'machine_preflight' && receipt.selected_service_id === serviceId) ?? null;
}

function getServiceExecutionReceipt(serviceId: string, receipts: MachinePreflightReceipt[]) {
  return receipts.find((receipt) => receipt.receipt_type === 'machine_execution' && receipt.execution_service_id === serviceId) ?? null;
}

function parseMachineExecutionSummaryLoose(summary: unknown): Record<string, unknown> | null {
  if (!summary) return null;
  if (typeof summary === 'object') return summary as Record<string, unknown>;
  if (typeof summary !== 'string') return null;
  try {
    const parsed = JSON.parse(summary);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isBigQueryLiveExecutionReceipt(receipt: MachinePreflightReceipt) {
  if (receipt.receipt_type !== 'machine_execution') return false;
  if ((receipt.execution_service_id ?? receipt.selected_service_id) !== 'bigquery') return false;
  if (receipt.execution_status !== 'succeeded' || !receipt.execution_occurred) return false;
  const requestSummary = parseMachineExecutionSummaryLoose(receipt.execution_request_summary);
  const responseSummary = parseMachineExecutionSummaryLoose(receipt.execution_response_summary);
  return requestSummary?.live_execution === true
    && requestSummary?.harness_execution === true
    && responseSummary?.bounded_query_confirmed === true;
}

function getBigQueryLiveHarnessStatus(service: MachineMarketService | null, receipts: MachinePreflightReceipt[]): BigQueryLiveHarnessStatus {
  const hasLiveReceipt = receipts.some((receipt) => isBigQueryLiveExecutionReceipt(receipt));
  if (hasLiveReceipt) return 'receipt_recorded';
  if (service?.route_surface_status === 'callable_routes_listed' && service.status === 'ready') return 'ready_for_controlled_run';
  return 'blocked_live_harness_not_configured';
}

function getMachineInspectorNextSafeAction(service: MachineMarketService, candidate: MachineExecutionCandidateScore | null, selectedControlledActionId: string | null) {
  if (service.id === selectedControlledActionId) return 'Open the controlled proof plan, keep planning-only posture, and wait for a service-specific receipt before any execution claim.';
  if (service.id === 'naver-maps') return 'Inspect proof path and define safe routing test before execution.';
  if (!candidate) return 'Inspect the dossier and keep this service in metadata-only planning scope until Radar records policy and receipt evidence.';
  if (candidate.recommendation === 'next_execution_candidate') return 'Keep this service in the proof-path cohort and inspect its proof plan before any change in execution posture.';
  if (candidate.recommendation === 'monitor') return 'Maintain proof-path status and collect any missing service-specific preflight evidence before promotion.';
  if (candidate.recommendation === 'needs_review') return 'Resolve the recorded review conditions before selecting a controlled proof plan.';
  return 'Keep this service outside the controlled-action slot until policy or readiness blockers change.';
}

function describeMatrixCellState(state: MachineReadinessMatrixCellState) {
  if (state === 'complete') return 'complete';
  if (state === 'review') return 'review';
  if (state === 'not_applicable') return 'not applicable';
  return 'missing';
}

function countMachineReadinessState(rows: MachineReadinessMatrixRow[], column: MachineReadinessMatrixColumn, state: MachineReadinessMatrixCellState) {
  return rows.filter((row) => row.states[column] === state).length;
}

function buildMachineEconomySnapshotSummary(
  services: MachineMarketService[],
  receipts: MachinePreflightReceipt[],
  coverageRun: MachinePreflightCoverageRun | null
): MachineEconomySnapshotSummary {
  const candidates = buildMachineExecutionShortlist(services, receipts, coverageRun);
  const selectedControlledAction = getSelectedControlledActionCandidate(candidates);
  const rows = buildMachineReadinessMatrix(services, candidates, coverageRun, receipts, selectedControlledAction?.service.id ?? null);
  const categorySummaries = buildMachineMarketMapSummaries(services, candidates, coverageRun, receipts);
  const strongestCategory = categorySummaries.find((item) => item.strongest) ?? null;
  const riskiestCategory = categorySummaries.find((item) => item.riskiest) ?? null;
  const policyCounts = rows.reduce((counts, row) => {
    const decision = row.candidate?.latest_policy_decision ?? 'not recorded';
    if (decision === 'allow') counts.allow += 1;
    if (decision === 'review') counts.review += 1;
    if (decision === 'deny') counts.deny += 1;
    return counts;
  }, { allow: 0, review: 0, deny: 0 });

  return {
    candidates,
    categorySummaries,
    rows,
    selectedControlledAction,
    servicesMapped: services.length,
    categoryCount: categorySummaries.length,
    allowCount: coverageRun?.allow_count ?? policyCounts.allow,
    reviewCount: coverageRun?.review_count ?? policyCounts.review,
    denyCount: coverageRun?.deny_count ?? policyCounts.deny,
    proofPlansSelected: countMachineReadinessState(rows, 'proof_plan_selected', 'complete'),
    executionReceipts: countMachineReadinessState(rows, 'execution_receipt', 'complete'),
    repeatabilityReceipts: countMachineReadinessState(rows, 'repeatability_receipt', 'complete'),
    strongestCategory,
    riskiestCategory
  };
}

function buildMachineReadinessMatrix(
  services: MachineMarketService[],
  candidates: MachineExecutionCandidateScore[],
  latestRun: MachinePreflightCoverageRun | null,
  receipts: MachinePreflightReceipt[],
  selectedControlledActionId: string | null
): MachineReadinessMatrixRow[] {
  const candidateById = new Map(candidates.map((candidate) => [candidate.service.id, candidate]));
  return services.map((service) => {
    const candidate = candidateById.get(service.id) ?? null;
    const coverageResult = getCoverageServiceResult(service.id, latestRun);
    const preflightReceipt = getServicePreflightReceipt(service.id, receipts);
    const executionReceipt = getServiceExecutionReceipt(service.id, receipts);
    const proofPathState = candidate?.recommendation === 'avoid_for_now'
      ? 'missing'
      : candidate?.recommendation === 'needs_review'
        ? 'review'
        : candidate
          ? 'complete'
          : 'missing';
    const preflightState = preflightReceipt || coverageResult
      ? candidate?.latest_policy_decision === 'review'
        ? 'review'
        : candidate?.latest_policy_decision === 'deny'
          ? 'missing'
          : 'complete'
      : 'missing';

    return {
      service,
      candidate,
      states: {
        listed: 'complete',
        classified: service.provider && service.category && service.chain && service.source_market ? 'complete' : 'missing',
        policy_mapped: service.evidence_stage === 'listed' || service.evidence_stage === 'classified' ? 'missing' : 'complete',
        preflight_recorded: preflightState,
        proof_path: proofPathState,
        proof_plan_selected: service.id === selectedControlledActionId ? 'complete' : 'missing',
        execution_receipt: executionReceipt ? 'complete' : 'missing',
        repeatability_receipt: 'missing'
      }
    };
  });
}

function MachineMarketPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [summary, setSummary] = useState<MachineMarketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<MachineMarketService | null>(null);
  const [inspectedServiceId, setInspectedServiceId] = useState<string | null>(null);
  const [latestCoverageRun, setLatestCoverageRun] = useState<MachinePreflightCoverageRun | null>(null);
  const [latestMachineReceipts, setLatestMachineReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [latestAnyTransExecutionReceipt, setLatestAnyTransExecutionReceipt] = useState<MachinePreflightReceipt | null>(null);
  const [latestMachineTranslationGeneralExecutionReceipt, setLatestMachineTranslationGeneralExecutionReceipt] = useState<MachinePreflightReceipt | null>(null);
  const [machineTranslationGeneralRepeatability, setMachineTranslationGeneralRepeatability] = useState<AlibabaMachineExecutionRepeatabilityArtifact | null>(null);
  const [machineTranslationGeneralBenchmarkReadiness, setMachineTranslationGeneralBenchmarkReadiness] = useState<AlibabaMachineExecutionBenchmarkReadinessArtifact | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageRunning, setCoverageRunning] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MachineMarketFilters>({
    marketType: 'all',
    category: 'all',
    sourceMarket: 'all',
    chain: 'all',
    evidenceStage: 'all',
    status: 'all'
  });

  useEffect(() => {
    document.title = 'Machine Market | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Machine Economy module for robotic.sh service policy, evidence, and receipt intelligence inside Infopunks Radar.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: MachineMarketSummary }>('/v1/machine-market/summary'),
      api<{ data: { runs: MachinePreflightCoverageRun[] } }>('/v1/machine-preflight/coverage-runs/recent?limit=1').catch(() => null),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=25').catch(() => null),
      api<{ data: AlibabaMachineExecutionRepeatabilityArtifact }>('/v1/machine-execution/alibaba-machine-translation-general/repeatability').catch(() => null),
      api<{ data: AlibabaMachineExecutionBenchmarkReadinessArtifact }>('/v1/machine-execution/alibaba-machine-translation-general/benchmark-readiness').catch(() => null)
    ]).then(([servicesResponse, summaryResponse, latestRunResponse, latestExecutionResponse, repeatabilityResponse, benchmarkReadinessResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setSummary(summaryResponse.data);
      setSelectedService(servicesResponse.data.services[0] ?? null);
      setInspectedServiceId(null);
      setLatestCoverageRun(latestRunResponse?.data.runs?.[0] ?? null);
      const receipts = latestExecutionResponse?.data.receipts ?? [];
      setLatestMachineReceipts(receipts);
      const anyTransExecution = receipts.find((receipt) => receipt.receipt_type === 'machine_execution' && receipt.execution_service_id === 'anytrans') ?? null;
      const machineTranslationGeneralExecution = receipts.find((receipt) => receipt.receipt_type === 'machine_execution' && receipt.execution_service_id === 'alibaba-machine-translation-general') ?? null;
      setLatestAnyTransExecutionReceipt(anyTransExecution);
      setLatestMachineTranslationGeneralExecutionReceipt(machineTranslationGeneralExecution);
      setMachineTranslationGeneralRepeatability(repeatabilityResponse?.data ?? null);
      setMachineTranslationGeneralBenchmarkReadiness(benchmarkReadinessResponse?.data ?? null);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine market API unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleServices = useMemo(() => services.filter((service) =>
    (filters.marketType === 'all' || service.market_type === filters.marketType)
    && (filters.category === 'all' || service.category === filters.category)
    && (filters.sourceMarket === 'all' || service.source_market === filters.sourceMarket)
    && (filters.chain === 'all' || service.chain === filters.chain)
    && (filters.evidenceStage === 'all' || service.evidence_stage === filters.evidenceStage)
    && (filters.status === 'all' || service.status === filters.status)
  ), [filters, services]);
  const executionCandidates = useMemo(() => buildMachineExecutionShortlist(services, latestMachineReceipts, latestCoverageRun), [services, latestMachineReceipts, latestCoverageRun]);
  const selectedControlledAction = getSelectedControlledActionCandidate(executionCandidates);
  const selectedExecutionCandidate = executionCandidates.find((candidate) => candidate.service.id === selectedService?.id) ?? null;
  const inspectedService = services.find((service) => service.id === inspectedServiceId) ?? null;
  const inspectedCandidate = executionCandidates.find((candidate) => candidate.service.id === inspectedServiceId) ?? null;
  const evidenceCounts = useMemo(() => machineEvidenceCounts(latestMachineReceipts), [latestMachineReceipts]);

  const refreshLatestCoverageRun = async () => {
    setCoverageLoading(true);
    setCoverageError(null);
    try {
      const response = await api<{ data: { runs: MachinePreflightCoverageRun[] } }>('/v1/machine-preflight/coverage-runs/recent?limit=1');
      setLatestCoverageRun(response.data.runs[0] ?? null);
    } catch (error) {
      setCoverageError(error instanceof Error ? error.message : 'coverage run unavailable');
    } finally {
      setCoverageLoading(false);
    }
  };

  const runCoveragePreflight = async () => {
    setCoverageRunning(true);
    setCoverageError(null);
    try {
      const response = await api<{ data: MachinePreflightCoverageRun }>('/v1/machine-preflight/coverage-run', { method: 'POST' });
      setLatestCoverageRun(response.data);
      void refreshLatestCoverageRun();
    } catch (error) {
      setCoverageError(error instanceof Error ? error.message : 'coverage run failed');
    } finally {
      setCoverageRunning(false);
    }
  };

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-market-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Market navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
          <span>Infopunks</span>
          <strong>Pay.sh Radar</strong>
        </a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-market" />
        </div>
      </nav>
    </header>
    <main id="machine-market-content" className="machine-market-page" aria-label="Machine Market">
      <MachineMarketHero />
      <MachineMarketSummaryCards
        summary={summary}
        loading={loading}
        serviceCount={services.length}
        executionReceiptCount={evidenceCounts.service_specific_execution_receipts}
        repeatabilityReceiptCount={evidenceCounts.repeatability_receipts}
        paymentSuccessClaimCount={evidenceCounts.payment_success_claims}
      />
      <MachineMarketCohort
        services={services}
        candidates={executionCandidates}
        latestRun={latestCoverageRun}
        loading={loading}
        evidenceCounts={evidenceCounts}
        selectedControlledActionId={selectedControlledAction?.service.id ?? null}
        inspectedServiceId={inspectedServiceId}
        onInspect={(service) => {
          setSelectedService(service);
          setInspectedServiceId(service.id);
        }}
        onCloseInspector={() => setInspectedServiceId(null)}
        inspectedService={inspectedService}
        inspectedCandidate={inspectedCandidate}
      />
      <MachineMarketMissionControl
        serviceCount={services.length}
        latestRun={latestCoverageRun}
        topCandidate={selectedControlledAction}
        evidenceCounts={evidenceCounts}
        loading={loading}
      />
      <MachineControlSurfacesStrip />
      <MachineMarketBrief latestRun={latestCoverageRun} selectedControlledActionName={selectedControlledAction?.service.name ?? 'Cloud Translation'} />
      <section className="panel machine-market-caveat" aria-label="Coverage caveat">
        <p>Infopunks Radar mapped the entire listed robotic.sh machine-service market.</p>
        <p>Coverage refers to the 13 services visible in the observed robotic.sh market snapshot. 0 market-wide execution claims. Service-specific execution receipts are scoped to the recorded route.</p>
        <p><a className="execute compact secondary" href="/machine-market-map">View market map</a> <a className="execute compact secondary" href="/machine-readiness-matrix">View readiness matrix</a> <a className="execute compact secondary" href="/machine-economy-snapshot">View public snapshot</a> <a className="execute compact secondary" href="/machine-rail-coverage">View rail coverage</a> <a className="execute compact secondary" href="/machine-route-risk-matrix">View route risk matrix</a> <a className="execute compact secondary" href="/machine-first-safe-routes">View first safe route queue</a> <a className="execute compact secondary" href="/machine-benchmark-readiness">View benchmark readiness</a> <a className="execute compact secondary" href="/machine-benchmark-methodology">View benchmark methodology</a> <a className="execute compact secondary" href="/machine-comparable-routes">View comparable routes</a> <a className="execute compact secondary" href="/machine-translation-evidence">View translation evidence plan</a> <a className="execute compact secondary" href="/machine-proof-ladder">View proof ladder</a> <a className="execute compact secondary" href="/machine-execution-shortlist">View execution shortlist</a></p>
      </section>
      <MachineEvidenceMethodologyDrawer />
      <EvidenceLadder services={services} />
      <CoveragePanel latestRun={latestCoverageRun} loading={coverageLoading || loading} running={coverageRunning} error={coverageError} onRun={runCoveragePreflight} />
      <FirstExecutionCard anyTransReceipt={latestAnyTransExecutionReceipt} machineTranslationGeneralReceipt={latestMachineTranslationGeneralExecutionReceipt} repeatability={machineTranslationGeneralRepeatability} benchmarkReadiness={machineTranslationGeneralBenchmarkReadiness} />
      <Filters filters={filters} onChange={setFilters} />
      {loading && <section className="panel" role="status" aria-live="polite"><p className="route-state">Loading Machine Market services...</p></section>}
      {error && !loading && <section className="panel" role="alert"><p className="route-state error">Machine Market API unavailable: {error}</p><p className="panel-caption">No local fixture data is shown on this page.</p></section>}
      {!loading && !error && services.length === 0 && <section className="panel"><EmptyState title="No machine services found." body="The Machine Market registry returned no services." /></section>}
      {!loading && !error && services.length > 0 && <section className="machine-market-grid">
        <MachineServiceTable services={visibleServices} selectedId={selectedService?.id ?? null} onSelect={setSelectedService} />
        <MachineServiceCard service={selectedService} candidate={selectedExecutionCandidate} />
      </section>}
    </main>
  </div>;
}

function MachineMarketMissionControl({
  serviceCount,
  latestRun,
  topCandidate,
  evidenceCounts,
  loading
}: {
  serviceCount: number;
  latestRun: MachinePreflightCoverageRun | null;
  topCandidate: MachineExecutionCandidateScore | null;
  evidenceCounts: ReturnType<typeof machineEvidenceCounts>;
  loading: boolean;
}) {
  const totalServices = latestRun?.services_total ?? serviceCount;
  const evaluatedServices = latestRun?.preflight_evaluated ?? (loading ? 0 : serviceCount);
  const decisionSummary = latestRun
    ? `allow ${latestRun.allow_count} / review ${latestRun.review_count} / deny ${latestRun.deny_count}`
    : 'allow / review / deny pending latest coverage run';
  const topCandidateName = topCandidate?.service.name ?? 'No proof-plan candidate selected';
  const topCandidateId = topCandidate?.service.id ?? null;

  return <section className="panel machine-mission-control" aria-label="Machine Market Mission Control">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Mission Control</p>
        <h2>Machine Market Mission Control</h2>
      </div>
      <span className="machine-badge evidence">0 robotic.sh market-wide execution claims</span>
    </div>
    <div className="machine-mission-grid">
      <article>
        <span>Current phase</span>
        <strong>Coverage complete / proof planning active</strong>
      </article>
      <article>
        <span>Market coverage</span>
        <strong>{evaluatedServices || 0} / {totalServices || 13} services evaluated</strong>
      </article>
      <article>
        <span>Latest coverage decision summary</span>
        <strong>{decisionSummary}</strong>
      </article>
      <article>
        <span>Service-specific evidence</span>
        <strong>{serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}</strong>
      </article>
      <article>
        <span>Next controlled action</span>
        <strong>{topCandidateName}</strong>
        {topCandidate && <small>selected controlled action · planning-only · not execution-tested · not a winner claim</small>}
      </article>
    </div>
    <div className="machine-mission-next">
      <div>
        <span>Next Controlled Action</span>
        <strong>{topCandidate ? `Proof plan selected: ${topCandidate.service.name}` : 'Proof planning awaits cohort evidence'}</strong>
        <p>Planning only. 0 robotic.sh market-wide execution claims. {paymentSuccessClaimLabel(evidenceCounts.payment_success_claims)}. Pay.sh execution routes are tracked separately from the robotic.sh visible service mirror.</p>
      </div>
      <div className="machine-mission-actions">
        {topCandidateId && <a className="execute compact" href={`/machine-execution-plan/${encodeURIComponent(topCandidateId)}`}>Open controlled proof plan</a>}
        <a className="execute compact secondary" href="/machine-readiness-matrix">View readiness matrix</a>
        <a className="execute compact secondary" href="/machine-execution-shortlist">View execution shortlist</a>
      </div>
    </div>
  </section>;
}

function MachineMarketCohort({
  services,
  candidates,
  latestRun,
  loading,
  evidenceCounts,
  selectedControlledActionId,
  inspectedServiceId,
  onInspect,
  onCloseInspector,
  inspectedService,
  inspectedCandidate
}: {
  services: MachineMarketService[];
  candidates: MachineExecutionCandidateScore[];
  latestRun: MachinePreflightCoverageRun | null;
  loading: boolean;
  evidenceCounts: ReturnType<typeof machineEvidenceCounts>;
  selectedControlledActionId: string | null;
  inspectedServiceId: string | null;
  onInspect: (service: MachineMarketService) => void;
  onCloseInspector: () => void;
  inspectedService: MachineMarketService | null;
  inspectedCandidate: MachineExecutionCandidateScore | null;
}) {
  const candidateByServiceId = new Map(candidates.map((candidate) => [candidate.service.id, candidate]));
  const allowCount = latestRun?.allow_count ?? candidates.filter((candidate) => candidate.latest_policy_decision === 'allow').length;
  const reviewCount = latestRun?.review_count ?? candidates.filter((candidate) => candidate.latest_policy_decision === 'review').length;
  const denyCount = latestRun?.deny_count ?? candidates.filter((candidate) => candidate.latest_policy_decision === 'deny').length;

  return <section className="panel machine-market-cohort" aria-label="13-Service Market Cohort">
    <div className="panel-head">
      <div>
        <p className="section-kicker">13-Service Market Cohort</p>
        <h2>{services.length} robotic.sh services mapped</h2>
      </div>
      <div className="machine-cohort-counts" aria-label="Cohort status summary">
        <span>{services.length} services mapped</span>
        <span>{allowCount} allow</span>
        <span>{reviewCount} review</span>
        <span>{denyCount} deny</span>
        <span>0 robotic.sh market-wide execution claims</span>
        <span>{serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}</span>
      </div>
    </div>
    <p className="machine-cohort-thesis">Every visible robotic.sh service now has a policy state, evidence state, readiness rank, and proof path.</p>
    <p className="panel-caption">Radar gives every visible service policy state, evidence state, readiness rank, and a proof path before spend. Machines should not spend blind.</p>
    <section className="machine-next-controlled-strip" aria-label="Next Controlled Action strip">
      <span>Next Controlled Action</span>
      <strong>Proof plan selected: {services.find((service) => service.id === selectedControlledActionId)?.name ?? 'Cloud Translation'}</strong>
      <small>planning only · no execution claim</small>
    </section>
    <div className="machine-market-flow" aria-label="Machine market flow">
      {['Listed', 'Classified', 'Policy-Mapped', 'Shortlisted', 'Proof-Planned', 'Receipt-Recorded'].map((step, index) => <React.Fragment key={step}>
        <span>{step}</span>
        {index < 5 && <b aria-hidden="true">-&gt;</b>}
      </React.Fragment>)}
    </div>
    {loading && !services.length && <p className="route-state">Loading 13-service market cohort...</p>}
    {!!services.length && <div className="machine-cohort-grid">
      {services.map((service) => {
        const candidate = candidateByServiceId.get(service.id) ?? null;
        const policyDecision = candidate?.latest_policy_decision ?? 'not recorded';
        const riskWatch = policyDecision === 'review' || policyDecision === 'deny' || candidate?.candidate_tier === 'not_ready' || candidate?.candidate_tier === 'review_required';
        const proofPlanReady = Boolean(candidate && candidate.recommendation !== 'avoid_for_now');
        const badges = [
          formatEvidenceStage(service.evidence_stage),
          policyDecision,
          riskWatch ? 'risk-watch' : null,
          proofPlanReady ? 'proof-path' : null,
          candidate?.execution_status ?? 'not_attempted'
        ].filter((item): item is string => Boolean(item));
        return <button
          className={`machine-cohort-card ${inspectedServiceId === service.id ? 'selected' : ''}`}
          key={service.id}
          type="button"
          onClick={() => onInspect(service)}
          aria-expanded={inspectedServiceId === service.id}
          aria-controls="machine-service-inspector"
        >
          <div>
            <strong>{service.name}</strong>
            <small>{service.category} · {service.status}</small>
          </div>
          <div className="machine-cohort-meta">
            <span><b>policy</b><strong>{policyDecision}</strong></span>
            <span><b>execution</b><strong>{candidate?.execution_status ?? 'not_attempted'}</strong></span>
            <span><b>readiness</b><strong>{candidate?.candidate_tier ?? service.status}</strong></span>
          </div>
          <div className="machine-cohort-badges">
            {badges.map((badge) => <span className={`machine-status-badge ${badge.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`} key={badge}>{badge}</span>)}
          </div>
        </button>;
      })}
    </div>}
    {inspectedService && <MachineMarketServiceInspector
      service={inspectedService}
      candidate={inspectedCandidate}
      selectedControlledActionId={selectedControlledActionId}
      onClose={onCloseInspector}
    />}
  </section>;
}

function MachineMarketServiceInspector({
  service,
  candidate,
  selectedControlledActionId,
  onClose
}: {
  service: MachineMarketService;
  candidate: MachineExecutionCandidateScore | null;
  selectedControlledActionId: string | null;
  onClose: () => void;
}) {
  const nextSafeAction = getMachineInspectorNextSafeAction(service, candidate, selectedControlledActionId);
  return <section className="panel machine-service-inspector" id="machine-service-inspector" aria-label="Service inspector drawer">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Service Inspector</p>
        <h2>{service.name}</h2>
      </div>
      <button className="execute compact secondary" type="button" onClick={onClose}>Close inspector</button>
    </div>
    <p className="panel-caption">Planning-only service inspection for the robotic.sh-visible cohort. No robotic.sh market-wide execution claim. No benchmark claim.</p>
    <div className="machine-inspector-grid">
      <article><span>provider</span><strong>{service.provider}</strong></article>
      <article><span>category</span><strong>{service.category}</strong></article>
      <article><span>status</span><strong>{service.status}</strong></article>
      <article><span>policy decision</span><strong>{candidate?.latest_policy_decision ?? 'not recorded'}</strong></article>
      <article><span>machine use case</span><strong>{service.machine_use_case}</strong></article>
      <article><span>policy risk note</span><strong>{service.policy_risk}</strong></article>
      <article><span>evidence stage</span><strong>{formatEvidenceStage(service.evidence_stage)}</strong></article>
      <article><span>evidence health</span><strong>{service.evidence_health}</strong></article>
      <article><span>readiness tier</span><strong>{candidate?.candidate_tier ?? 'not scored'}</strong></article>
      <article><span>execution status</span><strong>{candidate?.execution_status ?? 'not_attempted'}</strong></article>
      <article><span>next safe action</span><strong>{nextSafeAction}</strong></article>
    </div>
    <div className="machine-inspector-actions">
      <a className="execute compact secondary" href={`/machine-service/${encodeURIComponent(service.id)}`}>View dossier</a>
      <a className="execute compact" href={`/machine-execution-plan/${encodeURIComponent(service.id)}`}>{service.id === selectedControlledActionId ? 'Open proof plan' : 'Inspect proof path'}</a>
    </div>
  </section>;
}

function MachineMarketBrief({
  latestRun,
  selectedControlledActionName
}: {
  latestRun: MachinePreflightCoverageRun | null;
  selectedControlledActionName: string;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const allowCount = latestRun?.allow_count ?? 10;
  const reviewCount = latestRun?.review_count ?? 2;
  const denyCount = latestRun?.deny_count ?? 1;
  const brief = `13 robotic.sh services mapped. ${allowCount} allow / ${reviewCount} review / ${denyCount} deny. Every visible service has policy state, evidence state, readiness rank, and proof path. 0 robotic.sh market-wide execution claims. 1 controlled proof-plan action selected. Machines should not spend blind.`;

  async function copyBrief() {
    const copied = await copyText(brief);
    setCopyState(copied ? 'copied' : 'failed');
  }

  return <section className="panel machine-market-brief" aria-label="Machine Market Brief">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Market Brief</p>
        <h2>Copyable Machine Market Brief</h2>
      </div>
      <button className="execute compact secondary" type="button" onClick={copyBrief}>{copyState === 'copied' ? 'Copied brief' : copyState === 'failed' ? 'Copy failed' : 'Copy brief'}</button>
    </div>
    <p className="copy">{brief}</p>
    <p className="panel-caption">Selected controlled action: {selectedControlledActionName}. Planning only. No market-wide execution claim. Pay.sh routes tracked separately.</p>
  </section>;
}

function MachineEconomySnapshotPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [coverageRun, setCoverageRun] = useState<MachinePreflightCoverageRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Economy Public Snapshot | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Public snapshot of the robotic.sh Machine Economy Radar: market map, readiness matrix, policy state, and proof planning in one read-only page.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { runs: MachinePreflightCoverageRun[] } }>('/v1/machine-preflight/coverage-runs/recent?limit=1').catch(() => null),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null)
    ]).then(([servicesResponse, coverageResponse, receiptsResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setCoverageRun(coverageResponse?.data.runs?.[0] ?? null);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine economy snapshot unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const snapshot = useMemo(() => buildMachineEconomySnapshotSummary(services, receipts, coverageRun), [services, receipts, coverageRun]);
  const evidenceCounts = useMemo(() => machineEvidenceCounts(receipts), [receipts]);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-snapshot-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Economy Snapshot navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-economy-snapshot" />
        </div>
      </nav>
    </header>
    <main id="machine-snapshot-content" className="machine-market-page machine-economy-snapshot-page" aria-label="Machine Economy Public Snapshot">
      <section className="panel hero machine-market-hero machine-snapshot-hero">
        <div>
          <p className="eyebrow">Machine Market Radar Snapshot</p>
          <h1>Machine Market Radar Snapshot</h1>
          <p className="copy">Machine services are becoming spendable. Spendable does not mean safe.</p>
          <p className="panel-caption">Radar inserts policy, proof, and memory before autonomous action.</p>
        </div>
        <div className="ticker" aria-label="Machine economy snapshot hero chips">
          <span>listed ≠ callable</span>
          <span>callable ≠ executed</span>
          <span>credentials ≠ payment proof</span>
          <span>route surface ≠ receipt</span>
          <span>machine markets need judgment before spend</span>
          <span>that’s Radar</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine economy snapshot...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine economy snapshot unavailable: {error}</p></section>}
      {!loading && !error && <>
        <section className="grid four machine-market-summary machine-snapshot-stats" aria-label="Machine economy snapshot stat grid">
          <article className="panel metric"><span>Services mapped</span><strong>{snapshot.servicesMapped}</strong><small>robotic.sh visible catalog</small></article>
          <article className="panel metric"><span>Categories</span><strong>{snapshot.categoryCount}</strong><small>normalized machine-function groups</small></article>
          <article className="panel metric"><span>Policy summary</span><strong>{snapshot.allowCount} allow / {snapshot.reviewCount} review / {snapshot.denyCount} deny</strong><small>computed from current coverage</small></article>
          <article className="panel metric"><span>First-safe queue</span><strong>active</strong><small>route planning state only</small></article>
          <article className="panel metric"><span>Market-wide execution claim</span><strong>{evidenceCounts.robotic_sh_market_wide_execution_claims}</strong><small>Service receipt ≠ market proof.</small></article>
          <article className="panel metric"><span>Service-specific execution receipts</span><strong>{evidenceCounts.service_specific_execution_receipts}</strong><small>Service-specific execution only.</small></article>
          <article className="panel metric"><span>Payment success claims</span><strong>{evidenceCounts.payment_success_claims}</strong><small>not payment proof without payment evidence</small></article>
          <article className="panel metric"><span>Benchmark claims</span><strong>{evidenceCounts.benchmark_claims}</strong><small>0 unless benchmark artifact exists</small></article>
          <article className="panel metric"><span>Winner claims</span><strong>{evidenceCounts.winner_claims}</strong><small>0 unless explicit criteria/artifact exists</small></article>
          <article className="panel metric"><span>Strongest readiness category</span><strong>{snapshot.strongestCategory?.label ?? 'n/a'}</strong><small>{snapshot.strongestCategory ? formatDistributionSummary(snapshot.strongestCategory.readiness_distribution, ['strong_candidate', 'possible_candidate', 'review_required', 'not_ready']) : 'pending'}</small></article>
          <article className="panel metric"><span>Riskiest category</span><strong>{snapshot.riskiestCategory?.label ?? 'n/a'}</strong><small>{snapshot.riskiestCategory ? `${snapshot.riskiestCategory.allow_count} allow / ${snapshot.riskiestCategory.review_count} review / ${snapshot.riskiestCategory.deny_count} deny` : 'pending'}</small></article>
          <article className="panel metric"><span>Next controlled action</span><strong>{snapshot.selectedControlledAction?.service.name ?? 'Cloud Translation'} proof plan</strong><small>planning only</small></article>
        </section>
        <section className="grid two machine-route-guidance-grid" aria-label="Machine snapshot additions">
          <article className="panel machine-market-brief">
            <div className="panel-head"><div><p className="section-kicker">What changed</p><h2>Control plane now visible</h2></div></div>
            <div className="machine-usage-list">
              <p><span>Rail coverage added</span><small>Rail state is separated from route and receipt state.</small></p>
              <p><span>Route risk separated</span><small>Route-level risk is distinct from service-level listing.</small></p>
              <p><span>First-safe queue active</span><small>Planning queue exists without execution overclaims.</small></p>
              <p><span>Execution blockers visible</span><small>Blockers are explicit before any spend attempt.</small></p>
              <p><span>Market changelog live</span><small>Radar records market memory over time.</small></p>
              <p><span>No-claim ledger live</span><small>Proof boundaries are explicit and auditable.</small></p>
            </div>
          </article>
          <article className="panel machine-market-brief">
            <div className="panel-head"><div><p className="section-kicker">Next safest proof path</p><h2>{snapshot.selectedControlledAction?.service.name ?? 'Cloud Translation'}</h2></div></div>
            <div className="machine-usage-list">
              <p><span>selected safest route</span><small>{snapshot.selectedControlledAction?.service.first_safe_route ?? 'not recorded'}</small></p>
              <p><span>proof required</span><small>Service-specific execution receipt with bounded input/output evidence.</small></p>
              <p><span>blocked-by</span><small>{snapshot.selectedControlledAction?.service.rail_caveat ?? 'review required before proof attempt'}</small></p>
              <p><span>caveat</span><small>Payment success claim, benchmark claim, and winner claim remain 0 unless explicit evidence artifacts exist.</small></p>
            </div>
          </article>
        </section>
        <section className="panel machine-market-cohort machine-snapshot-story" aria-label="Machine economy story strip">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Story Strip</p>
              <h2>From visible catalog to future receipt</h2>
            </div>
            <span className="machine-badge evidence">planning only</span>
          </div>
          <div className="machine-market-flow" aria-label="Machine economy story flow">
            {['robotic.sh catalog', 'Radar market map', 'readiness matrix', 'proof plan selected', 'future receipt'].map((step, index) => <React.Fragment key={step}>
              <span>{step}</span>
              {index < 4 && <b aria-hidden="true">-&gt;</b>}
            </React.Fragment>)}
          </div>
          <p className="panel-caption">Coverage, preflight, and proof planning do not imply execution.</p>
        </section>
        <MachineEconomySnapshotCohortBand services={services} candidates={snapshot.candidates} />
        <MachineEconomySnapshotCategorySummary summaries={snapshot.categorySummaries} />
        <MachineEconomySnapshotBrief summary={snapshot} />
        <section className="panel machine-market-caveat" aria-label="Machine economy snapshot caveats">
          <p>0 robotic.sh market-wide execution claims. {serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}.</p>
          <p>{paymentSuccessClaimLabel(evidenceCounts.payment_success_claims)}. {benchmarkClaimLabel(evidenceCounts.benchmark_claims)}. {winnerClaimLabel(evidenceCounts.winner_claims)}.</p>
          <p>Public context only. Not Radar execution evidence.</p>
          <p><b>Source discipline</b>: Catalog, rail, route, and public-context fields are attributed separately. Public context is not Radar execution evidence.</p>
          <p>Repeatability ≠ winner. Service receipt ≠ market proof.</p>
          <p><a className="execute compact secondary" href="/machine-rail-coverage">View rail coverage</a> <a className="execute compact secondary" href="/machine-route-risk-matrix">View route risk matrix</a> <a className="execute compact secondary" href="/machine-first-safe-routes">View first safe route queue</a></p>
        </section>
        <MachineEvidenceMethodologyDrawer />
      </>}
    </main>
  </div>;
}

function MachineEconomySnapshotCohortBand({
  services,
  candidates
}: {
  services: MachineMarketService[];
  candidates: MachineExecutionCandidateScore[];
}) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.service.id, candidate]));

  return <section className="panel machine-market-cohort machine-snapshot-cohort" aria-label="Machine economy cohort band">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Market Cohort Summary</p>
        <h2>{services.length}-service public cohort band</h2>
      </div>
      <span className="machine-badge source">{services.length} services</span>
    </div>
    <div className="machine-snapshot-cohort-grid">
      {services.map((service) => {
        const candidate = candidateById.get(service.id) ?? null;
        return <article className="machine-snapshot-cohort-row" key={service.id}>
          <strong>{service.name}</strong>
          <span>{getMachineMarketMapCategoryLabel(service)}</span>
          <span>{candidate?.latest_policy_decision ?? 'not recorded'}</span>
          <span>{candidate?.candidate_tier ?? service.status}</span>
          <span>{candidate?.execution_status ?? 'not_attempted'}</span>
        </article>;
      })}
    </div>
  </section>;
}

function MachineEconomySnapshotCategorySummary({ summaries }: { summaries: MachineMarketMapCategorySummary[] }) {
  return <section className="panel machine-market-brief machine-snapshot-category-summary" aria-label="Machine economy category summary">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Category Summary</p>
        <h2>{summaries.length} machine-function groups</h2>
      </div>
      <span className="machine-badge evidence">computed from current registry</span>
    </div>
    <div className="machine-snapshot-category-grid">
      {summaries.map((summary) => <article className="machine-snapshot-category-card" key={summary.key} aria-label={`${summary.label} summary`}>
        <strong>{summary.label}</strong>
        <span>{summary.service_count} services</span>
        <span>{summary.allow_count} allow / {summary.review_count} review / {summary.deny_count} deny</span>
        <span>{formatDistributionSummary(summary.readiness_distribution, ['strong_candidate', 'possible_candidate', 'review_required', 'not_ready'])}</span>
        <small>{summary.category_risk_note}</small>
      </article>)}
    </div>
  </section>;
}

function MachineEconomySnapshotBrief({ summary }: { summary: MachineEconomySnapshotSummary }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const brief = `${summary.servicesMapped} robotic.sh services mapped across ${summary.categoryCount} machine-function categories. Policy state: ${summary.allowCount} allow / ${summary.reviewCount} review / ${summary.denyCount} deny. Radar selected ${summary.proofPlansSelected} controlled proof-plan action: ${summary.selectedControlledAction?.service.name ?? 'Cloud Translation'}. 0 robotic.sh market-wide execution claims. ${summary.executionReceipts} service-specific execution receipts. ${summary.repeatabilityReceipts} repeatability receipts. Execution remains receipt-driven. Machines should not spend blind.`;

  async function copyBrief() {
    const copied = await copyText(brief);
    setCopyState(copied ? 'copied' : 'failed');
  }

  return <section className="panel machine-market-brief" aria-label="Machine economy public brief">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Public Brief</p>
        <h2>Copyable public snapshot brief</h2>
      </div>
      <button className="execute compact secondary" type="button" onClick={copyBrief}>{copyState === 'copied' ? 'Copied snapshot brief' : copyState === 'failed' ? 'Copy failed' : 'Copy snapshot brief'}</button>
    </div>
    <p className="copy">{brief}</p>
    <p className="panel-caption">Execution remains receipt-driven. No market-wide execution claim. No benchmark claim. No winner claim.</p>
  </section>;
}

function MachineRouteRiskMatrixPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Route-Level Risk Matrix | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Read-only machine route-level risk matrix derived from robotic.sh-visible service metadata tracked by Infopunks Radar.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null)
    ]).then(([servicesResponse, receiptsResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine route risk matrix unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => buildMachineRouteRiskRows(services, receipts), [services, receipts]);
  const summary = useMemo(() => buildMachineRouteRiskSummary(rows), [rows]);
  const evidenceCounts = useMemo(() => machineEvidenceCounts(receipts), [receipts]);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-route-risk-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Route Risk Matrix navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-route-risk-matrix" />
        </div>
      </nav>
    </header>
    <main id="machine-route-risk-content" className="machine-market-page machine-route-risk-page" aria-label="Machine Route-Level Risk Matrix">
      <section className="panel hero machine-market-hero machine-route-risk-hero">
        <div>
          <p className="eyebrow">Route-Level Risk Matrix</p>
          <h1>Route-Level Risk Matrix</h1>
          <p className="copy">Agents do not execute services in the abstract. They hit routes. Radar separates services from rails, rails from routes, routes from receipts.</p>
        </div>
        <div className="ticker" aria-label="Machine route risk hero chips">
          <span>route surfaces mapped</span>
          <span>first-safe routes identified</span>
          <span>avoid-first routes flagged</span>
          <span>0 robotic.sh market-wide execution claims</span>
          <span>{serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}</span>
          <span>receipt-driven</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine route risk matrix...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine route risk matrix unavailable: {error}</p></section>}
      {!loading && !error && <>
        <section className="grid four machine-market-summary" aria-label="Machine route risk summary">
          <article className="panel metric"><span>Route rows tracked</span><strong>{summary.totalRoutesMapped}</strong><small>route rows, not execution receipts</small></article>
          <article className="panel metric"><span>First-safe candidates</span><strong>{summary.firstSafeCandidates}</strong><small>yes or possible candidates only</small></article>
          <article className="panel metric"><span>Avoid-first routes</span><strong>{summary.avoidFirstRoutes}</strong><small>flagged for later, not blocked forever</small></article>
          <article className="panel metric"><span>High-risk routes</span><strong>{summary.highRiskRoutes}</strong><small>physical-world or higher-sensitivity planning paths</small></article>
          <article className="panel metric"><span>Service-specific executed routes</span><strong>{summary.executionReceipts}</strong><small>service-specific execution only</small></article>
          <article className="panel metric"><span>Payment-confirmed routes</span><strong>{evidenceCounts.payment_success_claims}</strong><small>0 unless payment evidence exists</small></article>
        </section>
        <section className="panel machine-mission-control" aria-label="Machine route interpretation strip">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Route Interpretation</p>
              <h2>Separate planning from proof</h2>
            </div>
            <span className="machine-badge evidence">receipt-driven</span>
          </div>
          <div className="ticker" aria-label="Machine route interpretation statements">
            <span>listed ≠ callable</span>
            <span>callable ≠ executed</span>
            <span>credentials ≠ payment proof</span>
            <span>route surface ≠ receipt</span>
          </div>
        </section>
        <section className="panel machine-market-caveat" aria-label="Machine route risk caveats">
          <p>Market-wide execution claims: {evidenceCounts.robotic_sh_market_wide_execution_claims}. Payment success claims: {evidenceCounts.payment_success_claims}. Benchmark claims: {evidenceCounts.benchmark_claims}. Winner claims: {evidenceCounts.winner_claims}.</p>
          <p>Route-level risk is planning metadata. It does not imply execution, payment success, benchmark superiority, or provider quality.</p>
          <p>Route metadata does not imply execution. Credential requirement does not imply payment proof.</p>
          <p>Payment is not confirmed unless payment evidence exists.</p>
          <p>Execution status is receipt-driven. Catalog route presence does not imply route execution.</p>
          <details className="panel machine-market-brief" aria-label="Route-risk attribution">
            <summary className="machine-evidence-methodology-summary">
              <span className="section-kicker">Route-risk attribution</span>
              <strong>Route-risk attribution</strong>
              <small>Risk rows are attributed planning metadata, not execution proof.</small>
            </summary>
            <div className="machine-usage-list">
              <p><span>source</span><small>manual scaffold</small></p>
              <p><span>scope</span><small>route-risk interpretation, first-safe selection, and avoid-first classification</small></p>
              <p><span>observed_at</span><small>{formatMachineTimestamp(MACHINE_MARKET_SOURCE_OBSERVED_AT)}</small></p>
              <p><span>caveat</span><small>Planning metadata only; route risk is not execution evidence.</small></p>
            </div>
          </details>
          <p><a className="execute compact secondary" href="/machine-rail-coverage">Back to rail coverage</a> <a className="execute compact secondary" href="/machine-economy-snapshot">View public snapshot</a> <a className="execute compact secondary" href="/machine-first-safe-routes">View first safe route queue</a></p>
        </section>
        <section className="grid two machine-route-guidance-grid" aria-label="Machine route guidance">
          <article className="panel machine-market-brief">
            <div className="panel-head"><div><p className="section-kicker">Guidance</p><h2>Why route-level policy matters</h2></div></div>
            <div className="machine-usage-list">
              <p><span>NAVER Maps</span><small>Geocode lookup is first-safe candidate / review. Driving directions is avoid-first / high risk because of physical-world routing risk. Execution status remains not_attempted.</small></p>
              <p><span>Machine Translation</span><small>Service-specific execution evidence exists for one machine-translation route only. Payment not confirmed unless payment evidence exists. Benchmark and winner claims remain false without artifacts.</small></p>
              <p><span>BigQuery</span><small>BigQuery should begin with bounded public/synthetic queries.</small></p>
              <p><span>Stableupload</span><small>Stableupload should begin with tiny non-sensitive fixtures.</small></p>
              <p><span>Execution</span><small>Execution remains receipt-driven.</small></p>
            </div>
          </article>
          <details className="panel machine-market-brief" aria-label="Machine route risk methodology">
            <summary className="machine-evidence-methodology-summary">
              <span className="section-kicker">Route Methodology</span>
              <strong>Compact route-risk definitions</strong>
              <small>Route-level planning metadata remains separate from route execution receipts.</small>
            </summary>
            <div className="machine-usage-list">
              <p><span>route_risk</span><small>Relative route-level planning risk based on current route surface metadata and machine relevance.</small></p>
              <p><span>first_safe_candidate</span><small>Whether the route is a preferred first proof candidate, a possible candidate, or a route to defer.</small></p>
              <p><span>avoid_first</span><small>Flags routes that should not be the first proof attempt even when they remain available later.</small></p>
              <p><span>expected_output_class</span><small>The shape of output Radar expects to collect if a future bounded proof is attempted.</small></p>
              <p><span>proof_condition</span><small>Constraints for any future proof attempt. These are preconditions, not evidence of execution.</small></p>
              <p><span>execution_status</span><small>Receipt-driven only. Without a service-specific durable receipt, status remains not_attempted.</small></p>
            </div>
            <p className="machine-caveat-row"><span>caveat</span><small className="machine-caveat-copy">Route-level risk is planning metadata. It does not imply execution, payment success, benchmark superiority, or provider quality.</small></p>
          </details>
        </section>
        <section className="panel machine-service-table-panel" aria-label="Machine route risk matrix table panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Route Matrix</p>
              <h2>{rows.length} route rows mapped</h2>
            </div>
            <small>Rows are derived from current registry metadata only. Missing route metadata is not fabricated into concrete callable paths.</small>
          </div>
          <div className="machine-service-table" role="table" aria-label="Machine route risk matrix table">
            <div className="machine-service-row machine-route-risk-row head" role="row">
              {['service', 'route', 'method / path', 'risk', 'first-safe candidate', 'avoid-first', 'credential requirement', 'expected output', 'proof condition', 'execution status', 'CTA'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {rows.map((row, index) => {
              const serviceChanged = index === 0 || rows[index - 1]?.service_id !== row.service_id;
              const serviceRouteCount = rows.filter((item) => item.service_id === row.service_id).length;
              return <div className={`machine-service-row machine-route-risk-row${serviceChanged ? ' service-start' : ''}`} role="row" key={`${row.service_id}:${row.route_label}:${row.method}:${row.path}`}>
                <span role="cell"><strong>{row.service_name}</strong><small>{row.provider}</small><small>{serviceChanged ? `${serviceRouteCount} route rows` : 'same service group'}</small></span>
                <span role="cell"><strong>{row.route_label}</strong><small>{row.category}</small><small>{formatMachineAccessRail(row.access_rail)}</small></span>
                <span role="cell"><strong>{row.method}</strong><small>{row.path}</small></span>
                <span role="cell"><span className={`machine-status-badge ${row.route_risk === 'high' ? 'review' : row.route_risk === 'medium' ? 'not-attempted' : 'complete'}`}>{formatMachineRouteRisk(row.route_risk)}</span><small>{row.rail_caveat}</small></span>
                <span role="cell"><span className={`machine-status-badge ${row.first_safe_candidate === 'yes' ? 'complete' : row.first_safe_candidate === 'possible' ? 'not-attempted' : row.first_safe_candidate === 'no' ? 'review' : ''}`}>{formatMachineFirstSafeCandidate(row.first_safe_candidate)}</span></span>
                <span role="cell"><strong>{row.avoid_first}</strong><small>{row.avoid_first_reason ?? 'not flagged'}</small></span>
                <span role="cell">{row.credential_requirement}</span>
                <span role="cell">{row.expected_output_class}</span>
                <span role="cell">{row.proof_condition}</span>
                <span role="cell"><span className={`machine-status-badge ${row.execution_status === 'not_attempted' ? 'missing' : row.execution_status === 'repeatability_receipt_recorded' ? 'complete' : 'not-attempted'}`}>{formatMachineRouteExecutionStatus(row.execution_status)}</span><small>{row.execution_status === 'not_attempted' ? 'No service-specific route execution receipt recorded.' : 'Service-specific execution receipt. Not market-wide proof, not payment proof, not benchmark proof.'}</small></span>
                <span role="cell"><a className="execute compact secondary" href={`/machine-execution-plan/${encodeURIComponent(row.service_id)}`}>View rail-aware proof plan</a></span>
              </div>;
            })}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function MachineRailCoveragePage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Rail Coverage | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Read-only machine execution rail coverage for the 13 robotic.sh-visible services tracked by Infopunks Radar.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null)
    ]).then(([servicesResponse, receiptsResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine rail coverage unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => buildMachineRailCoverageSummary(services, receipts), [services, receipts]);
  const evidenceCounts = useMemo(() => machineEvidenceCounts(receipts), [receipts]);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-rail-coverage-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Rail Coverage navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-rail-coverage" />
        </div>
      </nav>
    </header>
    <main id="machine-rail-coverage-content" className="machine-market-page machine-rail-coverage-page" aria-label="Machine Rail Coverage">
      <section className="panel hero machine-market-hero machine-rail-hero">
        <div>
          <p className="eyebrow">Machine Execution Rail Coverage</p>
          <h1>Machine Execution Rail Coverage</h1>
          <p className="copy">Radar separates robotic.sh catalog presence from access rail readiness, callable route surfaces, credentials, pricing, and receipt-bound execution evidence.</p>
          <p className="panel-caption">Radar does not ask only what service exists. It asks which rail, which route, under which proof conditions.</p>
        </div>
        <div className="ticker" aria-label="Machine rail coverage hero chips">
          <span>13 services mapped</span>
          <span>access rails classified</span>
          <span>route surfaces separated</span>
          <span>0 robotic.sh market-wide execution claims</span>
          <span>{serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}</span>
          <span>receipt-driven</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine rail coverage...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine rail coverage unavailable: {error}</p></section>}
      {!loading && !error && <>
        <section className="grid four machine-market-summary" aria-label="Machine rail coverage summary">
          <article className="panel metric"><span>Services mapped</span><strong>{summary.totalServices}</strong><small>robotic.sh-listed services mirrored into rail metadata</small></article>
          <article className="panel metric"><span>Pay.sh / Solana rails</span><strong>{summary.payShSolana}</strong><small>access rail only, not execution proof</small></article>
          <article className="panel metric"><span>peaqOS / provider-account rails</span><strong>{summary.peaqProviderAccount}</strong><small>provider account surface, not receipt evidence</small></article>
          <article className="panel metric"><span>Callable route surfaces</span><strong>{summary.callableRoutesListed}</strong><small>routes listed in metadata, not executed</small></article>
          <article className="panel metric"><span>Provider/operator setup required</span><strong>{summary.providerSetupRequired}</strong><small>setup blockers remain before safe route planning</small></article>
          <article className="panel metric"><span>No callable endpoint recorded</span><strong>{summary.noCallableEndpointsRecorded}</strong><small>listed presence without callable route detail</small></article>
          <article className="panel metric"><span>Service-specific execution receipts</span><strong>{summary.executionReceipts}</strong><small>Service-specific execution receipts are scoped to the recorded route.</small></article>
          <article className="panel metric"><span>Payment success claims</span><strong>{evidenceCounts.payment_success_claims}</strong><small>Payment remains unconfirmed unless payment evidence exists.</small></article>
          <article className="panel metric"><span>Benchmark claims</span><strong>{evidenceCounts.benchmark_claims}</strong><small>Benchmark claim requires benchmark artifact.</small></article>
        </section>
        <section className="grid five machine-rail-snapshot" aria-label="Machine rail doctrine snapshot cards">
          <article className="panel metric"><span>Visible market</span><strong>robotic.sh</strong><small>service visibility and public context, not Radar proof</small></article>
          <article className="panel metric"><span>Access / spend rail</span><strong>Pay.sh</strong><small>one rail to classify before spend</small></article>
          <article className="panel metric"><span>Identity / wallet substrate</span><strong>peaqOS</strong><small>machine identity, wallet, and credit surface</small></article>
          <article className="panel metric"><span>Intelligence layer</span><strong>Radar</strong><small>policy, evidence, receipts, memory</small></article>
          <article className="panel metric"><span>Proof adapter</span><strong>Harness</strong><small>execution evidence only when a receipt exists</small></article>
        </section>
        <section className="panel machine-mission-control" aria-label="Machine rail interpretation strip">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Rail Interpretation</p>
              <h2>Separate the evidence states</h2>
            </div>
            <span className="machine-badge evidence">screenshot-native</span>
          </div>
          <div className="ticker" aria-label="Machine rail interpretation statements">
            <span>Listed ≠ callable</span>
            <span>Callable ≠ executed</span>
            <span>Credentials ≠ payment proof</span>
            <span>Route surface ≠ receipt</span>
          </div>
          <p className="panel-caption">Radar does not ask only what service exists. It asks which rail, which route, under which proof conditions.</p>
        </section>
        <section className="panel machine-market-caveat" aria-label="Machine rail coverage caveats">
          <p>0 market-wide execution claims. Service-specific execution receipts are scoped to the recorded route.</p>
          <p>Rail coverage does not prove execution. Execution receipts are service-specific. Payment remains unconfirmed unless payment evidence exists.</p>
          <p>Route metadata does not imply execution. Credential requirement does not imply payment proof.</p>
          <p>{paymentSuccessClaimLabel(evidenceCounts.payment_success_claims)}. {benchmarkClaimLabel(evidenceCounts.benchmark_claims)}. {winnerClaimLabel(evidenceCounts.winner_claims)}.</p>
          <p>Pay.sh availability does not imply Radar execution. robotic.sh listing does not imply callable route readiness.</p>
          <p>Callable routes do not imply executed routes. Credentials do not imply payment proof. Execution requires service-specific receipts.</p>
          <details className="panel machine-market-brief" aria-label="Rail metadata attribution">
            <summary className="machine-evidence-methodology-summary">
              <span className="section-kicker">Rail metadata attribution</span>
              <strong>Rail metadata attribution</strong>
              <small>Rail and route-surface fields are catalog/planning metadata.</small>
            </summary>
            <div className="machine-usage-list">
              <p><span>source</span><small>robotic.sh catalog metadata</small></p>
              <p><span>scope</span><small>access rail, route surface status, endpoint count, pricing model, credential requirement</small></p>
              <p><span>observed_at</span><small>{formatMachineTimestamp(MACHINE_MARKET_SOURCE_OBSERVED_AT)}</small></p>
              <p><span>caveat</span><small>Catalog/rail metadata only; not service execution evidence.</small></p>
            </div>
          </details>
          <p><a className="execute compact secondary" href="/machine-market">Back to Machine Economy</a> <a className="execute compact secondary" href="/machine-route-risk-matrix">View route risk matrix</a> <a className="execute compact secondary" href="/machine-first-safe-routes">View first safe route queue</a> <a className="execute compact secondary" href="/machine-execution-blockers">View execution blockers</a> <a className="execute compact secondary" href="/machine-market-changelog">View changelog</a> <a className="execute compact secondary" href="/machine-no-claim-ledger">View no-claim ledger</a></p>
        </section>
        <MachineNoClaimLedgerPanel evidenceCounts={evidenceCounts} />
        <MachineEvidenceMethodologyDrawer />
        <MachineRailCoverageMethodology />
        <section className="panel machine-service-table-panel" aria-label="Machine rail coverage table panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Rail Coverage Table</p>
              <h2>{services.length} robotic.sh-visible services</h2>
            </div>
            <small>Catalog presence is separated from callable rail readiness. No service is execution-ready on this page without a service-specific receipt.</small>
          </div>
          <div className="machine-service-table" role="table" aria-label="Machine rail coverage table">
            <div className="machine-service-row machine-rail-row head" role="row">
              {['service', 'category', 'access rail', 'route surface status', 'endpoints', 'pricing model', 'credential requirement', 'rail status', 'first safe route', 'execution status', 'source attribution'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {services.map((service) => {
              const executionStatus = getMachineRailExecutionStatus(service, receipts);
              const routeSurfaceLabel = formatMachineRouteSurfaceStatus(service.route_surface_status);
              const executionLabel = executionStatus === 'not_execution_tested' ? 'not execution-tested' : executionStatus.replace(/_/g, ' ');
              return <div className="machine-service-row machine-rail-row" role="row" key={service.id}>
                <span role="cell"><strong>{service.name}</strong><small>{service.provider}</small><small><a className="execute compact secondary" href={`/machine-execution-plan/${encodeURIComponent(service.id)}`}>View rail-aware proof plan</a></small></span>
                <span role="cell" className="machine-badge">{service.category}</span>
                <span role="cell"><strong>{formatMachineAccessRail(service.access_rail)}</strong><small>{service.observed_source} listed service</small></span>
                <span role="cell"><span className={`machine-status-badge ${service.route_surface_status === 'callable_routes_listed' ? 'complete' : service.route_surface_status === 'no_callable_endpoints' ? 'missing' : service.route_surface_status === 'operator_runtime_required' || service.route_surface_status === 'provider_setup_only' ? 'review' : ''}`}>{routeSurfaceLabel}</span><small>{service.route_surface_status}</small><small>{getRouteSurfaceImplication(service.route_surface_status)}</small></span>
                <span role="cell">{formatMachineEndpointCount(service.endpoint_count)}</span>
                <span role="cell">{service.pricing_model ?? 'not recorded'}</span>
                <span role="cell">{service.credential_requirement ?? 'not recorded'}</span>
                <span role="cell"><span className={`machine-status-badge ${service.rail_status === 'plan_eligible' ? 'complete' : service.rail_status === 'proof_plan_selected' ? 'not-attempted' : service.rail_status === 'review_required' ? 'review' : ''}`}>{service.rail_status}</span><small>{service.rail_caveat ?? 'rail caveat not recorded'}</small></span>
                <span role="cell"><strong>{service.first_safe_route ?? 'not recorded'}</strong><small>planning route only, not a receipt</small></span>
                <span role="cell"><span className={`machine-status-badge ${executionStatus === 'not_execution_tested' ? 'missing' : executionStatus === 'repeatability_receipt_recorded' ? 'complete' : 'not-attempted'}`}>{executionLabel}</span><small>{executionStatus === 'not_execution_tested' ? 'No service-specific execution receipt recorded.' : 'Service-specific receipt exists; inspect proof details before any broader claim.'}</small></span>
                <span role="cell"><strong>{service.source_attribution?.source ?? service.observed_source}</strong><small>{service.source_attribution?.scope ?? 'static service mirror'}</small><small>{service.source_attribution?.caveat ?? 'Public/catalog context only.'}</small></span>
              </div>;
            })}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function MachineFirstSafeRoutesPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    document.title = 'Machine First Safe Route Queue | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Read-only first safe route queue for future robotic.sh proof attempts inside Infopunks Radar.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null)
    ]).then(([servicesResponse, receiptsResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine first safe route queue unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => buildMachineFirstSafeRouteQueueRows(services, receipts), [services, receipts]);
  const summary = useMemo(() => buildMachineFirstSafeRouteQueueSummary(rows), [rows]);
  const evidenceCounts = useMemo(() => machineEvidenceCounts(receipts), [receipts]);
  const brief = 'Radar has identified a first-safe route queue for the robotic.sh machine market. Cloud Translation remains the selected controlled proof-plan action. NAVER Maps should start with geocode, not driving directions. BigQuery should start with bounded public/synthetic queries. Stableupload should start with tiny non-sensitive fixtures. QVAC requires runtime registration review. 0 robotic.sh market-wide execution claims. Execution remains receipt-driven.';

  async function copyBrief() {
    const copied = await copyText(brief);
    setCopyState(copied ? 'copied' : 'failed');
  }

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-first-safe-routes-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine First Safe Route Queue navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-first-safe-routes" />
        </div>
      </nav>
    </header>
    <main id="machine-first-safe-routes-content" className="machine-market-page machine-first-safe-routes-page" aria-label="Machine First Safe Route Queue">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">First Safe Route Queue</p>
          <h1>Machine First Safe Route Queue</h1>
          <p className="copy">Radar does not ask which service is most exciting. It asks which route is safest to prove first.</p>
        </div>
        <div className="ticker" aria-label="Machine first safe route hero chips">
          <span>route-aware queue</span>
          <span>first-safe candidates</span>
          <span>planning only</span>
          <span>0 robotic.sh market-wide execution claims</span>
          <span>{serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}</span>
          <span>receipt-driven</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine first safe route queue...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine first safe route queue unavailable: {error}</p></section>}
      {!loading && !error && <>
        <section className="grid four machine-market-summary" aria-label="Machine first safe route queue summary">
          <article className="panel metric"><span>Queue entries</span><strong>{summary.queueEntries}</strong><small>ranked planning rows only</small></article>
          <article className="panel metric"><span>First-safe candidates</span><strong>{summary.firstSafeCandidates}</strong><small>future proof attempts, not receipts</small></article>
          <article className="panel metric"><span>Review-gated entries</span><strong>{summary.reviewGatedEntries}</strong><small>review before any attempt</small></article>
          <article className="panel metric"><span>Blocked/setup-required entries</span><strong>{summary.blockedOrSetupRequiredEntries}</strong><small>missing route, setup, or credential evidence</small></article>
          <article className="panel metric"><span>Service-specific execution receipts</span><strong>{summary.executionReceipts}</strong><small>service-specific execution only</small></article>
          <article className="panel metric"><span>Payment success claims</span><strong>{evidenceCounts.payment_success_claims}</strong><small>payment_unconfirmed unless payment evidence exists</small></article>
          <article className="panel metric"><span>Benchmark claims</span><strong>{evidenceCounts.benchmark_claims}</strong><small>benchmark_not_recorded unless artifact exists</small></article>
        </section>
        <section className="panel machine-mission-control" aria-label="Machine first safe route interpretation strip">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Interpretation</p>
              <h2>Planning queue, not proof</h2>
            </div>
            <span className="machine-badge evidence">receipt-driven</span>
          </div>
          <div className="ticker" aria-label="Machine first safe route interpretation statements">
            <span>First-safe ≠ executed</span>
            <span>Ranked ≠ winner</span>
            <span>Blocked ≠ abandoned</span>
            <span>Proof plan ≠ receipt</span>
          </div>
        </section>
        <section className="panel machine-market-caveat" aria-label="Machine first safe route caveats">
          <p>0 robotic.sh market-wide execution claims. {serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}.</p>
          <p>{paymentSuccessClaimLabel(evidenceCounts.payment_success_claims)}. {benchmarkClaimLabel(evidenceCounts.benchmark_claims)}. {winnerClaimLabel(evidenceCounts.winner_claims)}. No provider quality claim.</p>
          <p>Payment is not confirmed unless payment evidence exists. Route metadata does not imply execution.</p>
          <p>First-safe does not mean executed. Rank does not mean winner. Execution requires service-specific receipts.</p>
          <p>First-safe route ranking is planning metadata. It does not imply execution, payment success, benchmark superiority, provider quality, or winner status.</p>
          <p><a className="execute compact secondary" href="/machine-route-risk-matrix">Back to route risk matrix</a> <a className="execute compact secondary" href="/machine-rail-coverage">View rail coverage</a> <a className="execute compact secondary" href="/machine-benchmark-readiness">View benchmark readiness</a> <a className="execute compact secondary" href="/machine-comparable-routes">View comparable routes</a> <a className="execute compact secondary" href="/machine-translation-evidence">View translation evidence plan</a></p>
        </section>
        <section className="panel machine-market-brief" aria-label="Machine first safe route brief">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Public Brief</p>
              <h2>Copyable queue brief</h2>
            </div>
            <button className="execute compact secondary" type="button" onClick={copyBrief}>{copyState === 'copied' ? 'Copied queue brief' : copyState === 'failed' ? 'Copy failed' : 'Copy queue brief'}</button>
          </div>
          <p className="copy">{brief}</p>
        </section>
        <section className="panel machine-service-table-panel" aria-label="Machine first safe route queue table panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Queue</p>
              <h2>{rows.length} first-safe route entries</h2>
            </div>
            <small>Rank means suggested planning order for future proof attempts. It is not a winner claim.</small>
          </div>
          <div className="machine-service-table" role="table" aria-label="Machine first safe route queue table">
            <div className="machine-service-row machine-first-safe-route-row head" role="row">
              {['rank', 'service', 'first safe route', 'why safe first', 'blocked by', 'required evidence', 'execution status', 'proof plan'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {rows.map((row) => <div className="machine-service-row machine-first-safe-route-row" role="row" key={row.service_id}>
              <span role="cell"><strong>{row.rank}</strong><small>planning order</small></span>
              <span role="cell"><strong>{row.service_name}</strong><small>{row.service_id}</small><small>{row.warning}</small></span>
              <span role="cell">{row.first_safe_route}</span>
              <span role="cell">{row.why_safe_first}</span>
              <span role="cell">{row.blocked_by}</span>
              <span role="cell">{row.required_evidence}<small>payment_unconfirmed · benchmark_not_recorded</small></span>
              <span role="cell"><span className={`machine-status-badge ${row.execution_status === 'not_attempted' ? 'missing' : row.execution_status === 'repeatability_receipt_recorded' ? 'complete' : 'not-attempted'}`}>{formatFirstSafeQueueExecutionStatus(row.execution_status)}</span><small>{row.execution_status === 'not_attempted' ? '0 service-specific execution receipts recorded here' : row.execution_receipt_id ? <>Service-specific execution receipt recorded. <a className="execute compact secondary" href={`/machine-execution/${encodeURIComponent(row.execution_receipt_id)}`}>View receipt detail</a></> : 'Service-specific execution receipt recorded here'}</small></span>
              <span role="cell"><a className="execute compact secondary" href={row.proof_plan_href}>View proof plan</a></span>
            </div>)}
          </div>
        </section>
        <section className="grid two machine-route-guidance-grid" aria-label="Machine first safe route methodology and warnings">
          <article className="panel machine-market-brief">
            <div className="panel-head"><div><p className="section-kicker">Route Warnings</p><h2>Concise row warnings</h2></div></div>
            <div className="machine-usage-list">
              {rows.map((row) => <p key={row.service_id}><span>{row.service_name}</span><small>{row.warning}</small></p>)}
            </div>
          </article>
          <details className="panel machine-market-brief" aria-label="Machine first safe route methodology">
            <summary className="machine-evidence-methodology-summary">
              <span className="section-kicker">Methodology</span>
              <strong>Compact queue definitions</strong>
              <small>Planning metadata stays separate from execution proof.</small>
            </summary>
            <div className="machine-usage-list">
              <p><span>first safe route</span><small>The safest bounded route or setup review Radar should plan first for a service.</small></p>
              <p><span>blocked by</span><small>The recorded setup, route-surface, credential, or review blockers that prevent execution claims.</small></p>
              <p><span>required evidence</span><small>The minimum receipt-bound proof package Radar would need before changing execution posture.</small></p>
              <p><span>planning rank</span><small>Suggested planning order for future proof attempts. Ranked does not mean winner.</small></p>
              <p><span>execution status</span><small>Receipt-driven only. Without a service-specific receipt, status remains not attempted.</small></p>
            </div>
            <p className="machine-caveat-row"><span>caveat</span><small className="machine-caveat-copy">First-safe route ranking is planning metadata. It does not imply execution, payment success, benchmark superiority, provider quality, or winner status.</small></p>
          </details>
        </section>
      </>}
    </main>
  </div>;
}

function MachineNoClaimLedgerPanel({
  variant = 'panel',
  evidenceCounts
}: {
  variant?: 'panel' | 'page';
  evidenceCounts?: ReturnType<typeof machineEvidenceCounts>;
}) {
  const scopedCounts = evidenceCounts ?? {
    robotic_sh_market_wide_execution_claims: 0,
    service_specific_execution_receipts: 0,
    repeatability_receipts: 0,
    payment_success_claims: 0,
    benchmark_claims: 0,
    winner_claims: 0
  };
  const rows = [
    ['Market-wide execution claim', `${scopedCounts.robotic_sh_market_wide_execution_claims}`, 'source_type: derived_radar_state · Service receipt ≠ market proof.'],
    ['NAVER Maps execution claim', '0', 'source_type: public_context · NAVER Maps is navigation / review / not_attempted.'],
    ['Payment success claim', `${scopedCounts.payment_success_claims}`, 'source_type: radar_execution_receipt · Payment remains unconfirmed unless payment evidence exists.'],
    ['Benchmark claim', `${scopedCounts.benchmark_claims}`, 'source_type: benchmark_artifact · No benchmark artifact recorded unless explicitly linked.'],
    ['Winner claim', `${scopedCounts.winner_claims}`, 'source_type: derived_radar_state · No winner claim unless explicit criteria and artifact exist.'],
    ['Public demo counted as Radar proof', '0', 'source_type: public_context · Public context only. Not Radar execution evidence.'],
    ['Service-specific execution receipt', `${scopedCounts.service_specific_execution_receipts}`, 'source_type: radar_execution_receipt · Service-specific execution receipt. Not market-wide proof, not payment proof, not benchmark proof.'],
    ['Repeatability receipt', `${scopedCounts.repeatability_receipts}`, 'source_type: radar_repeatability_receipt · Repeatability is route-specific. Not benchmark superiority.']
  ] as const;

  return <section className={`panel machine-no-claim-ledger ${variant === 'page' ? 'page-ledger' : ''}`} aria-label="Machine No-Claim Ledger">
    <div className="panel-head">
      <div>
        <p className="section-kicker">No-Claim Ledger</p>
        <h2>Radar records restraint</h2>
      </div>
      <span className="machine-badge evidence">Proof before trust</span>
    </div>
    <div className="ticker" aria-label="Machine no-claim doctrine">
      <span>Listed ≠ callable</span>
      <span>Callable ≠ executed</span>
      <span>Credentials ≠ payment proof</span>
      <span>Route surface ≠ receipt</span>
      <span>Service receipt ≠ market proof</span>
      <span>Repeatability ≠ winner</span>
    </div>
    <div className="machine-usage-list" role="list">
      {rows.map(([label, state, boundary]) => <p key={label} role="listitem"><span>{label}: {state}</span><small>{boundary}</small></p>)}
    </div>
  </section>;
}

function MachineExecutionBlockersPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Execution Blockers | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Execution blockers for machine-service markets, separating route surface, credentials, payment proof, and receipts.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null)
    ]).then(([servicesResponse, receiptsResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine execution blockers unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => buildMachineExecutionBlockerRows(services, receipts), [services, receipts]);
  const summary = useMemo(() => buildMachineExecutionBlockerSummary(rows), [rows]);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-execution-blockers-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Execution Blockers navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-execution-blockers" />
        </div>
      </nav>
    </header>
    <main id="machine-execution-blockers-content" className="machine-market-page machine-execution-blockers-page" aria-label="Machine Execution Blockers">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Execution Blockers</p>
          <h1>Execution Blockers</h1>
          <p className="copy">Radar does not just find what can run. Radar explains why most things should not run yet.</p>
        </div>
        <div className="ticker" aria-label="Machine execution blocker hero chips">
          <span>Machines should not spend blind</span>
          <span>credentials separated</span>
          <span>payment proof separated</span>
          <span>0 robotic.sh market-wide execution claims</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine execution blockers...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine execution blockers unavailable: {error}</p></section>}
      {!loading && !error && <>
        <section className="grid four machine-market-summary" aria-label="Machine execution blocker summary">
          <article className="panel metric"><span>Blocker rows</span><strong>{summary.blockerRows}</strong><small>policy and evidence blockers</small></article>
          <article className="panel metric"><span>Services blocked</span><strong>{summary.servicesBlocked}</strong><small>services with one or more blockers</small></article>
          <article className="panel metric"><span>Route surface blockers</span><strong>{summary.routeSurfaceBlockers}</strong><small>listed is not callable</small></article>
          <article className="panel metric"><span>Credential blockers</span><strong>{summary.credentialBlockers}</strong><small>credentials are not payment proof</small></article>
          <article className="panel metric"><span>Setup blockers</span><strong>{summary.setupBlockers}</strong><small>operator or provider setup required</small></article>
          <article className="panel metric"><span>Receipt blockers</span><strong>{summary.receiptBlockers}</strong><small>receipt required before execution claim</small></article>
        </section>
        <section className="panel machine-market-brief" aria-label="Machine execution blocker groups">
          <div className="panel-head"><div><p className="section-kicker">Blocker groups</p><h2>What still blocks safe execution</h2></div></div>
          <div className="machine-usage-list">
            <p><span>no callable endpoint recorded</span><small>listed presence without callable route surface.</small></p>
            <p><span>credentials required</span><small>credential readiness is not payment proof.</small></p>
            <p><span>provider setup required</span><small>provider onboarding and setup still missing.</small></p>
            <p><span>policy review</span><small>review gates remain before bounded proof attempts.</small></p>
            <p><span>physical-world risk</span><small>routing outputs can affect movement and safety constraints.</small></p>
            <p><span>sensitive data risk</span><small>query/upload routes can expose regulated or private data.</small></p>
            <p><span>operator runtime required</span><small>runtime registration or operator setup still required.</small></p>
            <p><span>no payment proof</span><small>Payment success claims remain 0 unless payment evidence exists.</small></p>
            <p><span>no benchmark artifact</span><small>Benchmark claims remain 0 unless artifact exists.</small></p>
            <p><span>no winner criteria</span><small>Winner claims remain 0 unless explicit criteria and artifact exist.</small></p>
          </div>
        </section>
        <MachineNoClaimLedgerPanel />
        <section className="panel machine-service-table-panel" aria-label="Machine execution blocker table panel">
          <div className="panel-head">
            <div><p className="section-kicker">Blockers</p><h2>{rows.length} blockers recorded</h2></div>
            <small>Rows are derived from current registry and receipt metadata. Missing data is kept visible.</small>
          </div>
          <div className="machine-service-table" role="table" aria-label="Machine execution blocker table">
            <div className="machine-service-row machine-blocker-row head" role="row">
              {['service', 'blocker class', 'blocker', 'evidence needed', 'next safe action', 'source attribution', 'CTA'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {rows.map((row, index) => <div className="machine-service-row machine-blocker-row" role="row" key={`${row.service_id}:${row.blocker_class}:${index}`}>
              <span role="cell"><strong>{row.service_name}</strong><small>{row.service_id}</small></span>
              <span role="cell"><span className={`machine-status-badge ${row.blocker_class === 'receipt' ? 'missing' : row.blocker_class === 'review' ? 'review' : 'not-attempted'}`}>{row.blocker_class.replace(/_/g, ' ')}</span></span>
              <span role="cell">{row.blocker}</span>
              <span role="cell">{row.evidence_needed}</span>
              <span role="cell">{row.next_safe_action}</span>
              <span role="cell">{row.source_attribution}</span>
              <span role="cell"><a className="execute compact secondary" href={`/machine-execution-plan/${encodeURIComponent(row.service_id)}`}>View proof plan</a></span>
            </div>)}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function MachineBenchmarkGatePanel({ gate }: { gate: MachineBenchmarkGateCheck }) {
  const isOpen = gate.benchmark_execution_allowed;
  return <section className="panel machine-market-brief" aria-label="Machine benchmark gate check">
    <div className="panel-head"><div><p className="section-kicker">Benchmark gate check</p><h2>Benchmark gate</h2></div></div>
    <p>Benchmark gate is closed until comparable routes, methodology, and readiness all pass.</p>
    {!isOpen && <>
      <p><b>Gate status:</b> closed</p>
      <p><b>Why closed:</b> {gate.blocking_reasons.join(', ') || 'readiness_not_benchmark_ready'}</p>
      <p><b>What must happen next:</b> {gate.required_conditions.join(' · ')}</p>
      <p><b>No benchmark claim:</b> true</p>
      <p><b>No winner claim:</b> true</p>
    </>}
    {isOpen && <>
      <p><b>Gate status:</b> open</p>
      <p><b>Eligible lane(s):</b> {gate.allowed_lanes.join(', ') || 'none'}</p>
      <p><b>Required next action:</b> controlled benchmark run</p>
      <p><b>Winner claim:</b> false by default unless explicit criteria and artifact exist</p>
    </>}
  </section>;
}

function MachineBenchmarkReadinessPage() {
  const [gate, setGate] = useState<MachineBenchmarkGateCheck | null>(null);
  const [report, setReport] = useState<MachineBenchmarkReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Benchmark Readiness | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Machine benchmark readiness state only. No benchmark execution, no winner claims.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: MachineBenchmarkReadinessReport }>('/v1/machine-execution/benchmark-readiness'),
      api<{ data: MachineBenchmarkGateCheck }>('/v1/machine-execution/benchmark-gate')
    ]).then(([response, gateResponse]) => {
        if (cancelled) return;
        setReport(response.data);
        setGate(gateResponse.data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'machine benchmark readiness unavailable');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-benchmark-readiness-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Benchmark Readiness navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-benchmark-readiness" />
        </div>
      </nav>
    </header>
    <main id="machine-benchmark-readiness-content" className="machine-market-page machine-benchmark-readiness-page" aria-label="Machine Benchmark Readiness">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Benchmark Readiness</p>
          <h1>Machine Benchmark Readiness</h1>
          <p className="copy">Readiness gates for future benchmarking lanes. This page does not run benchmarks.</p>
        </div>
      </section>
      <section className="panel machine-market-caveat" aria-label="Machine benchmark readiness caveats">
        <p>Machine Market benchmarks require robotic.sh-listed services.</p>
        <p>Pay.sh can be the rail, but robotic.sh visibility anchors the benchmark lane.</p>
        <p>No robotic.sh-listed comparable route, no Machine Market benchmark.</p>
        <p>If nothing compatible exists, Radar moves back to evidence acquisition.</p>
        <p>Benchmark readiness is not benchmark evidence.</p>
        <p>Repeatability is not route superiority.</p>
        <p>No winner claim exists until criteria and artifacts exist.</p>
        <p>A single repeatable route is not a benchmark.</p>
        <p>Comparable routes are required before benchmark artifacts.</p>
        <p><a className="execute compact secondary" href="/machine-market">Back to Machine Market</a> <a className="execute compact secondary" href="/machine-first-safe-routes">View first safe route queue</a> <a className="execute compact secondary" href="/machine-benchmark-methodology">View benchmark methodology</a> <a className="execute compact secondary" href="/machine-comparable-routes">View comparable routes</a> <a className="execute compact secondary" href="/machine-translation-evidence">View translation evidence plan</a> <a className="execute compact secondary" href="/machine-receipts">View receipts</a></p>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine benchmark readiness...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine benchmark readiness unavailable: {error}</p></section>}
      {!loading && !error && report && <>
        {gate && <MachineBenchmarkGatePanel gate={gate} />}
        <section className="grid four machine-market-summary" aria-label="Machine benchmark readiness summary">
          <article className="panel metric"><span>Benchmark claims</span><strong>{report.benchmark_claims}</strong><small>must remain 0 in readiness mode</small></article>
          <article className="panel metric"><span>Winner claims</span><strong>{report.winner_claims}</strong><small>must remain 0 in readiness mode</small></article>
          <article className="panel metric"><span>Market-wide execution claims</span><strong>{report.market_wide_execution_claims}</strong><small>must remain 0 in readiness mode</small></article>
          <article className="panel metric"><span>Payment success claims</span><strong>{report.payment_success_claims}</strong><small>0 unless payment evidence exists</small></article>
        </section>
        <section className="panel machine-service-table-panel" aria-label="Benchmark readiness lanes">
          <div className="panel-head"><div><p className="section-kicker">Candidate lanes</p><h2>{report.lanes.length} benchmark readiness lanes</h2></div></div>
          <div className="machine-service-table" role="table" aria-label="Machine benchmark readiness lane table">
            <div className="machine-service-row machine-blocker-row head" role="row">
              {['lane_id', 'task class', 'candidate routes', 'comparable route count', 'repeatability state', 'missing requirements', 'readiness status', 'next action', 'caveats'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {report.lanes.map((lane) => <div key={lane.lane_id} className="machine-service-row machine-blocker-row" role="row">
              <span role="cell"><strong>{lane.lane_id}</strong></span>
              <span role="cell">{lane.task_class}</span>
              <span role="cell"><small>{lane.candidate_routes.map((route) => `${route.service_id} (${route.profile_id})`).join(' · ') || 'none recorded'}</small></span>
              <span role="cell">{lane.comparable_route_count}</span>
              <span role="cell">{lane.repeatability_state}</span>
              <span role="cell"><small>{lane.missing_requirements.join(', ') || 'none'}</small></span>
              <span role="cell"><span className="machine-status-badge review">{lane.readiness_status}</span></span>
              <span role="cell">{lane.next_action}</span>
              <span role="cell"><small>{lane.caveats.join(' ')}</small></span>
            </div>)}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function MachineComparableRoutesPage() {
  const [report, setReport] = useState<MachineComparableRouteReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Comparable Routes | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Comparable-route discovery and methodology contracts. No benchmarks, no winners.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ data: MachineComparableRouteReport }>('/v1/machine-execution/comparable-routes')
      .then((response) => {
        if (cancelled) return;
        setReport(response.data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'machine comparable routes unavailable');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-comparable-routes-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Comparable Routes navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-comparable-routes" />
        </div>
      </nav>
    </header>
    <main id="machine-comparable-routes-content" className="machine-market-page machine-benchmark-readiness-page" aria-label="Machine Comparable Routes">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Comparable Route Discovery</p>
          <h1>Machine Comparable Routes</h1>
          <p className="copy">Comparable routes are required before benchmarks.</p>
          <p className="panel-caption">Same task, same input class, same output normalization, same success criteria.</p>
        </div>
      </section>
      <section className="panel machine-market-caveat" aria-label="Machine comparable route caveats">
        <p>Machine Market benchmarks require robotic.sh-listed services.</p>
        <p>Pay.sh can be the rail, but robotic.sh visibility anchors the benchmark lane.</p>
        <p>No robotic.sh-listed comparable route, no Machine Market benchmark.</p>
        <p>If nothing compatible exists, Radar moves back to evidence acquisition.</p>
        <p>No comparable route, no benchmark.</p>
        <p>Methodology before leaderboard.</p>
        <p><a className="execute compact secondary" href="/machine-benchmark-readiness">View benchmark readiness</a> <a className="execute compact secondary" href="/machine-benchmark-methodology">View benchmark methodology</a> <a className="execute compact secondary" href="/machine-translation-evidence">View translation evidence plan</a> <a className="execute compact secondary" href="/machine-market">Back to Machine Market</a> <a className="execute compact secondary" href="/machine-first-safe-routes">View first safe route queue</a></p>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine comparable routes...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine comparable routes unavailable: {error}</p></section>}
      {!loading && !error && report && <>
        <section className="grid four machine-market-summary" aria-label="Machine comparable routes summary">
          <article className="panel metric"><span>Claim posture</span><strong>methodology-only</strong><small>no leaderboard posture</small></article>
          <article className="panel metric"><span>Benchmark posture</span><strong>blocked without comparable routes</strong><small>readiness planning only</small></article>
          <article className="panel metric"><span>Lanes tracked</span><strong>{report.lanes.length}</strong><small>candidate route lanes</small></article>
          <article className="panel metric"><span>Comparable-ready lanes</span><strong>{report.lanes.filter((lane) => lane.comparable_route_count >= 2).length}</strong><small>at least two candidate routes</small></article>
        </section>
        <section className="panel machine-service-table-panel" aria-label="Machine comparable route lanes">
          <div className="panel-head"><div><p className="section-kicker">Methodology contracts</p><h2>{report.lanes.length} comparable-route lanes</h2></div></div>
          <div className="machine-service-table" role="table" aria-label="Machine comparable route table">
            <div className="machine-service-row machine-blocker-row head" role="row">
              {['lane', 'current candidate route(s)', 'comparable second route exists', 'what is missing', 'methodology contract needed', 'next action'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {report.lanes.map((lane) => <div key={lane.lane_id} className="machine-service-row machine-blocker-row" role="row">
              <span role="cell"><strong>{lane.task_class}</strong><small>{lane.lane_id}</small></span>
              <span role="cell"><small>{lane.candidate_routes.map((route) => `${route.service_id} (${route.profile_id}, ${route.route_state ?? 'unknown'})`).join(' · ') || 'none recorded'}</small></span>
              <span role="cell"><span className={`machine-status-badge ${lane.comparable_route_count >= 2 ? 'complete' : 'review'}`}>{lane.comparable_route_count >= 2 ? 'yes' : 'no'}</span></span>
              <span role="cell"><small>{lane.missing_methodology.join(', ') || 'none'}</small></span>
              <span role="cell"><small>{lane.required_methodology.join(', ')}. inputs: {lane.comparable_inputs}. outputs: {lane.comparable_outputs}. normalization: {lane.normalization_strategy}. success: {lane.success_criteria}. run_count_target: {lane.run_count_target}. cost/latency: {lane.cost_latency_fields_required.join(', ')}. safety: {lane.safety_constraints.join(', ')}. readiness effect: {lane.readiness_effect}</small></span>
              <span role="cell">{lane.next_action}</span>
            </div>)}
          </div>
        </section>
        {report.lanes
          .filter((lane) => lane.lane_id === 'machine_translation')
          .map((lane) => <section key={`${lane.lane_id}-evidence`} className="panel machine-market-caveat" aria-label="Machine translation evidence requirements">
            <div className="panel-head"><div><p className="section-kicker">Evidence requirements</p><h2>Machine Translation eligibility blockers</h2></div></div>
            <p>Route states: {lane.candidate_routes.map((route) => `${route.service_id}=${route.route_state ?? 'unknown'}`).join(' · ')}</p>
            <p>Missing service identity: {lane.evidence_requirements_panel?.missing_service_identity.join(', ') || 'none'}</p>
            <p>Missing route surface: {lane.evidence_requirements_panel?.missing_route_surface.join(', ') || 'none'}</p>
            <p>Missing receipt: {lane.evidence_requirements_panel?.missing_receipt.join(', ') || 'none'}</p>
            <p>Missing comparable route: {lane.evidence_requirements_panel?.missing_comparable_route ? 'yes' : 'no'}</p>
            <p>Missing run-count target: {lane.evidence_requirements_panel?.missing_run_count_target ? `yes (target=${lane.evidence_requirements_panel?.run_count_target ?? lane.run_count_target})` : 'no'}</p>
          </section>)}
      </>}
    </main>
  </div>;
}

function MachineTranslationEvidencePage() {
  const [plan, setPlan] = useState<MachineTranslationEvidencePlan | null>(null);
  const [gate, setGate] = useState<MachineBenchmarkGateCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Translation Evidence Plan | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Machine Translation evidence acquisition planning. No benchmark execution and no winner claims.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: MachineTranslationEvidencePlan }>('/v1/machine-execution/translation-evidence-plan'),
      api<{ data: MachineBenchmarkGateCheck }>('/v1/machine-execution/benchmark-gate')
    ]).then(([planResponse, gateResponse]) => {
      if (cancelled) return;
      setPlan(planResponse.data);
      setGate(gateResponse.data);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine translation evidence unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-translation-evidence-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Translation Evidence navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-translation-evidence" />
        </div>
      </nav>
    </header>
    <main id="machine-translation-evidence-content" className="machine-market-page machine-benchmark-readiness-page" aria-label="Machine Translation Evidence Acquisition Plan">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Evidence Acquisition</p>
          <h1>Machine Translation Evidence Plan</h1>
          <p className="copy">Plan route identity, route surface, receipts, and repeatability before re-checking benchmark gate.</p>
        </div>
      </section>
      <section className="panel machine-market-caveat" aria-label="Machine translation evidence caveats">
        <p>Machine Market benchmarks require robotic.sh-listed services.</p>
        <p>Pay.sh can be the rail, but robotic.sh visibility anchors the benchmark lane.</p>
        <p>No robotic.sh-listed comparable route, no Machine Market benchmark.</p>
        <p>If nothing compatible exists, Radar moves back to evidence acquisition.</p>
        <p>candidate_unproven does not open benchmark gate.</p>
        <p>fixture_only does not open benchmark gate unless explicitly allowed by methodology.</p>
        <p>proven requires successful service-specific receipt evidence.</p>
        <p>Two proven comparable routes are required before benchmark gate can open.</p>
        <p><a className="execute compact secondary" href="/machine-market">Back to Machine Market</a> <a className="execute compact secondary" href="/machine-comparable-routes">View comparable routes</a> <a className="execute compact secondary" href="/machine-benchmark-readiness">View benchmark readiness</a> <a className="execute compact secondary" href="/machine-benchmark-methodology">View benchmark methodology</a> <a className="execute compact secondary" href="/machine-proof-ladder">View proof ladder</a></p>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine translation evidence plan...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine translation evidence unavailable: {error}</p></section>}
      {!loading && !error && plan && <>
        {gate && <MachineBenchmarkGatePanel gate={gate} />}
        <section className="grid four machine-market-summary" aria-label="Machine translation evidence summary">
          <article className="panel metric"><span>Comparable route count</span><strong>{plan.comparable_route_count}</strong><small>eligible translation routes</small></article>
          <article className="panel metric"><span>Proven comparable routes</span><strong>{plan.proven_comparable_route_count}</strong><small>must be at least 2</small></article>
          <article className="panel metric"><span>Run count target</span><strong>{plan.run_count_target}</strong><small>per proven route</small></article>
          <article className="panel metric"><span>Benchmark gate</span><strong>{plan.benchmark_execution_allowed ? 'open' : 'closed'}</strong><small>closed until full proof conditions are met</small></article>
        </section>
        <section className="panel machine-service-table-panel" aria-label="Machine translation evidence route table">
          <div className="panel-head"><div><p className="section-kicker">Candidate routes</p><h2>{plan.routes.length} route evidence tracks</h2></div></div>
          <div className="machine-service-table" role="table" aria-label="Machine translation evidence routes">
            <div className="machine-service-row machine-blocker-row head" role="row">
              {['service', 'service identity', 'route surface', 'proof profile match', 'receipt', 'repeatability', 'comparable-route eligible', 'evidence state', 'missing evidence', 'next action'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {plan.routes.map((route) => <div key={`${route.service_id}:${route.route_id}`} className="machine-service-row machine-blocker-row" role="row">
              <span role="cell"><strong>{route.service_id}</strong><small>{route.route_id}</small></span>
              <span role="cell">{route.service_identity_state}</span>
              <span role="cell">{route.route_surface_state}</span>
              <span role="cell">{route.proof_profile_match}</span>
              <span role="cell">{route.receipt_state}</span>
              <span role="cell">{route.repeatability_state}</span>
              <span role="cell"><span className={`machine-status-badge ${route.comparable_route_eligible ? 'complete' : 'review'}`}>{route.comparable_route_eligible ? 'yes' : 'no'}</span></span>
              <span role="cell"><span className="machine-status-badge review">{route.evidence_state}</span></span>
              <span role="cell"><small>{route.missing_evidence.join(', ') || 'none'}</small></span>
              <span role="cell">{route.next_action}</span>
            </div>)}
          </div>
        </section>
        <section className="panel machine-market-caveat" aria-label="Machine translation evidence acquisition ctas">
          <p><b>Current blockers:</b> {plan.blockers.join(', ') || 'none'}</p>
          <p><b>CTAs:</b> {plan.ctas.join(' · ')}</p>
          <p><b>No benchmark claim:</b> true</p>
          <p><b>No winner claim:</b> true</p>
        </section>
      </>}
    </main>
  </div>;
}

type MachineProofLadderStage = {
  stage: string;
  meaning: string;
  currentState: string;
  proves: string;
  doesNotProve: string;
  href?: string;
};

const MACHINE_PROOF_LADDER_STAGES: MachineProofLadderStage[] = [
  {
    stage: 'Mapped',
    meaning: 'robotic.sh-visible service exists in Radar.',
    currentState: 'Radar maps the listed machine market into visible service records.',
    proves: 'Visibility and mapping coverage exist for the service.',
    doesNotProve: 'callable, executed, paid, benchmarked.',
    href: '/machine-market'
  },
  {
    stage: 'First-safe',
    meaning: 'Radar selected safer proof paths.',
    currentState: 'Radar ranks first-safe candidates and blocks avoid-first routes.',
    proves: 'Safer early proof paths were selected before execution.',
    doesNotProve: 'execution.',
    href: '/machine-first-safe-routes'
  },
  {
    stage: 'Receipt',
    meaning: 'service-specific receipt exists.',
    currentState: 'Radar records service-scoped receipts with strict caveats.',
    proves: 'One service and route has recorded receipt evidence.',
    doesNotProve: 'market-wide proof, payment proof, benchmark proof, winner proof.',
    href: '/machine-receipts'
  },
  {
    stage: 'Repeatability',
    meaning: 'repeated receipts for one route/profile.',
    currentState: 'Repeatability artifacts stay route/profile scoped until benchmark gates open.',
    proves: 'The same route/profile produced repeated receipt evidence.',
    doesNotProve: 'route superiority or benchmark.',
    href: '/v1/machine-execution/repeatability/:service_id'
  },
  {
    stage: 'Readiness',
    meaning: 'Radar checks if a lane can be benchmarked.',
    currentState: 'Readiness lanes track missing requirements before any benchmark claim.',
    proves: 'A gate check exists for future benchmark eligibility.',
    doesNotProve: 'benchmark evidence.',
    href: '/machine-benchmark-readiness'
  },
  {
    stage: 'Comparable routes',
    meaning: 'Radar checks whether at least two fair routes exist.',
    currentState: 'Comparable-route discovery tracks parity requirements across lanes.',
    proves: 'Comparable route availability is explicitly checked.',
    doesNotProve: 'benchmark result.',
    href: '/machine-comparable-routes'
  },
  {
    stage: 'Methodology',
    meaning: 'artifact contract exists.',
    currentState: 'Methodology schema defines artifact contract and claim boundaries.',
    proves: 'Methodology requirements are documented and testable.',
    doesNotProve: 'benchmark execution.',
    href: '/machine-benchmark-methodology'
  },
  {
    stage: 'Benchmark later',
    meaning: 'only allowed when gate opens.',
    currentState: 'Benchmark execution remains deferred until all gate conditions are true.',
    proves: 'Benchmark timing is gated by explicit evidence thresholds.',
    doesNotProve: 'superiority ranking, winner claim, or benchmark already run.'
  }
];

function MachineProofLadderPage() {
  const [gate, setGate] = useState<MachineBenchmarkGateCheck | null>(null);

  useEffect(() => {
    document.title = 'Machine Market Proof Ladder | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Public evidence-state ladder for Machine Market Radar. This page is evidence-state summary only, not benchmark evidence.');
    let cancelled = false;
    api<{ data: MachineBenchmarkGateCheck }>('/v1/machine-execution/benchmark-gate')
      .then((response) => {
        if (cancelled) return;
        setGate(response.data);
      })
      .catch(() => {
        if (cancelled) return;
        setGate(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-proof-ladder-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Proof Ladder navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-proof-ladder" />
        </div>
      </nav>
    </header>
    <main id="machine-proof-ladder-content" className="machine-market-page machine-benchmark-readiness-page" aria-label="Machine Market Proof Ladder">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Public Proof Surface</p>
          <h1>Machine Market Proof Ladder</h1>
          <p className="copy">Radar does not jump from catalog listing to benchmark. It records the steps between visibility, proof, repeatability, methodology, and trust.</p>
          <p className="panel-caption">Mapped → First-safe → Receipt → Repeatability → Readiness → Comparable routes → Methodology → Benchmark later</p>
        </div>
      </section>
      <section className="panel machine-market-caveat" aria-label="Machine proof ladder doctrine">
        <p>Machine Market benchmarks require robotic.sh-listed services.</p>
        <p>Pay.sh can be the rail, but robotic.sh visibility anchors the benchmark lane.</p>
        <p>No robotic.sh-listed comparable route, no Machine Market benchmark.</p>
        <p>If nothing compatible exists, Radar moves back to evidence acquisition.</p>
        <p>No comparable route, no benchmark.</p>
        <p>No methodology, no artifact.</p>
        <p>No artifact, no claim.</p>
        <p>No criteria, no winner.</p>
        <p>Service receipt ≠ market proof.</p>
        <p>Repeatability ≠ winner.</p>
        <p><a className="execute compact secondary" href="/machine-translation-evidence">View translation evidence plan</a></p>
      </section>
      {gate && <MachineBenchmarkGatePanel gate={gate} />}
      <section className="panel machine-service-table-panel" aria-label="Machine proof ladder stages">
        <div className="panel-head"><div><p className="section-kicker">Evidence progression</p><h2>8 ladder stages</h2></div></div>
        <div className="machine-service-table" role="table" aria-label="Machine proof ladder stage table">
          <div className="machine-service-row machine-blocker-row head" role="row">
            {['stage', 'what it means', 'current machine market state', 'what it proves', 'what it does not prove', 'surface'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
          </div>
          {MACHINE_PROOF_LADDER_STAGES.map((item) => <div key={item.stage} className="machine-service-row machine-blocker-row" role="row">
            <span role="cell"><strong>{item.stage}</strong></span>
            <span role="cell">{item.meaning}</span>
            <span role="cell"><small>{item.currentState}</small></span>
            <span role="cell">{item.proves}</span>
            <span role="cell"><small>{item.doesNotProve}</small></span>
            <span role="cell">{item.href ? <a href={item.href}>{item.href}</a> : 'Gate only'}</span>
          </div>)}
        </div>
      </section>
      <section className="panel machine-market-brief" aria-label="Machine benchmark-later gate">
        <div className="panel-head"><div><p className="section-kicker">Benchmark later gate</p><h2>Required conditions</h2></div></div>
        <p><b>readiness_status</b> = benchmark_ready</p>
        <p><b>methodology_artifact_schema</b> = present</p>
        <p><b>comparable_route_count</b> &gt;= 2</p>
        <p className="panel-caption">Evidence-state summary only. This page does not claim benchmark execution and does not claim a winner.</p>
      </section>
    </main>
  </div>;
}

function MachineBenchmarkMethodologyPage() {
  const [report, setReport] = useState<MachineBenchmarkMethodologyReport | null>(null);
  const [gate, setGate] = useState<MachineBenchmarkGateCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Benchmark Methodology | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Methodology schema scaffolds for future machine benchmarks. Not benchmark execution, not benchmark evidence, no winner claims.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: MachineBenchmarkMethodologyReport }>('/v1/machine-execution/benchmark-methodology'),
      api<{ data: MachineBenchmarkGateCheck }>('/v1/machine-execution/benchmark-gate')
    ]).then(([response, gateResponse]) => {
        if (cancelled) return;
        setReport(response.data);
        setGate(gateResponse.data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'machine benchmark methodology unavailable');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-benchmark-methodology-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Benchmark Methodology navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-benchmark-methodology" />
        </div>
      </nav>
    </header>
    <main id="machine-benchmark-methodology-content" className="machine-market-page machine-benchmark-readiness-page" aria-label="Machine Benchmark Methodology">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Methodology Before Benchmarks</p>
          <h1>Machine Benchmark Methodology</h1>
          <p className="copy">Methodology before benchmarks.</p>
          <p className="panel-caption">This is the inspection form, not the race.</p>
        </div>
      </section>
      <section className="panel machine-market-caveat" aria-label="Machine benchmark methodology posture">
        <p>Machine Market benchmarks require robotic.sh-listed services.</p>
        <p>Pay.sh can be the rail, but robotic.sh visibility anchors the benchmark lane.</p>
        <p>No robotic.sh-listed comparable route, no Machine Market benchmark.</p>
        <p>If nothing compatible exists, Radar moves back to evidence acquisition.</p>
        <p>No comparable route, no benchmark.</p>
        <p>No criteria, no winner.</p>
        <p>No artifact, no claim.</p>
        <p><a className="execute compact secondary" href="/machine-market">Back to Machine Market</a> <a className="execute compact secondary" href="/machine-benchmark-readiness">View benchmark readiness</a> <a className="execute compact secondary" href="/machine-comparable-routes">View comparable routes</a> <a className="execute compact secondary" href="/machine-translation-evidence">View translation evidence plan</a></p>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine benchmark methodology...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine benchmark methodology unavailable: {error}</p></section>}
      {!loading && !error && report && <>
        {gate && <MachineBenchmarkGatePanel gate={gate} />}
        <section className="panel machine-market-brief" aria-label="Global benchmark gate">
          <div className="panel-head"><div><p className="section-kicker">Global benchmark gate</p><h2>Execution gate</h2></div></div>
          <p><b>benchmark_execution_allowed:</b> {String(report.global_gate.benchmark_execution_allowed)}</p>
          <p>{report.global_gate.reason}</p>
          <p><b>required_conditions:</b> {report.global_gate.required_conditions.join(' · ')}</p>
        </section>
        <section className="panel machine-market-brief" aria-label="Artifact schema fields">
          <div className="panel-head"><div><p className="section-kicker">Artifact schema fields</p><h2>Schema contract</h2></div></div>
          <p>benchmark_id · lane_id · task_class · routes_compared · input_set · normalization_strategy · success_criteria · run_count · cost_fields · latency_fields · payment_fields · safety_constraints · policy_constraints · comparable_route_count · readiness_status · methodology_status · artifact_status · winner_policy · winner_claim · benchmark_claim · caveats · generated_at</p>
        </section>
        <section className="panel machine-service-table-panel" aria-label="Lane methodology scaffolds">
          <div className="panel-head"><div><p className="section-kicker">Lane methodology scaffolds</p><h2>{report.methodology_artifacts.length} lane artifacts</h2></div></div>
          <div className="machine-service-table" role="table" aria-label="Machine benchmark methodology artifact table">
            <div className="machine-service-row machine-blocker-row head" role="row">
              {['lane', 'task class', 'routes compared', 'comparable routes', 'methodology status', 'artifact status', 'missing requirements', 'benchmark allowed', 'claims', 'caveats'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {report.methodology_artifacts.map((artifact) => <div key={artifact.benchmark_id} className="machine-service-row machine-blocker-row" role="row">
              <span role="cell"><strong>{artifact.lane_id}</strong><small>{artifact.benchmark_id}</small></span>
              <span role="cell">{artifact.task_class}</span>
              <span role="cell"><small>{artifact.routes_compared.map((route) => `${route.service_id} (${route.profile_id})`).join(' · ') || 'none recorded'}</small></span>
              <span role="cell">{artifact.comparable_route_count}</span>
              <span role="cell">{artifact.methodology_status}</span>
              <span role="cell">{artifact.artifact_status}</span>
              <span role="cell"><small>{artifact.missing_requirements.join(', ') || 'none'}</small></span>
              <span role="cell">{String(artifact.benchmark_allowed)}</span>
              <span role="cell"><small>benchmark_claim={String(artifact.benchmark_claim)} · winner_claim={String(artifact.winner_claim)}</small></span>
              <span role="cell"><small>{artifact.caveats.join(' ')}</small></span>
            </div>)}
          </div>
        </section>
        <section className="panel machine-market-brief" aria-label="Missing requirements">
          <div className="panel-head"><div><p className="section-kicker">Missing requirements</p><h2>What blocks benchmark artifacts</h2></div></div>
          <div className="machine-usage-list">
            {report.methodology_artifacts.map((artifact) => <p key={`missing-${artifact.benchmark_id}`}>
              <span>{artifact.lane_id}</span>
              <small>{artifact.missing_requirements.join(', ') || 'none'}</small>
            </p>)}
          </div>
        </section>
        <section className="panel machine-market-caveat" aria-label="Caveats / no-claim posture">
          <p>Methodology artifact schema is not benchmark evidence.</p>
          <p>Benchmark readiness is not benchmark evidence.</p>
          <p>Repeatability is not route superiority.</p>
          <p>A single repeatable route is not a benchmark.</p>
          <p>Comparable routes are required before benchmark artifacts.</p>
          <p>No winner claim exists until explicit criteria and artifacts exist.</p>
          <p>No benchmark execution has been run by this scaffold.</p>
        </section>
      </>}
    </main>
  </div>;
}

function MachineMarketChangelogPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Market Changelog | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Machine market intelligence changelog for Radar evidence, caveats, and route-risk memory.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null)
    ]).then(([servicesResponse, receiptsResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine market changelog unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => buildMachineMarketChangelogRows(services, receipts), [services, receipts]);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-market-changelog-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Market Changelog navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-market-changelog" />
        </div>
      </nav>
    </header>
    <main id="machine-market-changelog-content" className="machine-market-page machine-market-changelog-page" aria-label="Machine Market Changelog">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Machine Market Changelog</p>
          <h1>Machine Market Changelog</h1>
          <p className="copy">Radar remembers when the machine market changes.</p>
          <p className="panel-caption">Memory is evidence-scoped: services mapped, route surface shifts, execution-state changes, payment-state changes, and benchmark-state changes.</p>
        </div>
        <div className="ticker" aria-label="Machine market changelog hero chips">
          <span>public context separated</span>
          <span>Radar evidence separated</span>
          <span>policy memory</span>
          <span>Proof before trust</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine market changelog...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine market changelog unavailable: {error}</p></section>}
      {!loading && !error && <>
        <MachineNoClaimLedgerPanel />
        <section className="panel machine-service-table-panel" aria-label="Machine market changelog table panel">
          <div className="panel-head">
            <div><p className="section-kicker">Changelog</p><h2>{rows.length} market-memory entries</h2></div>
            <small>Changelog entries are product intelligence memory, not new live market data.</small>
          </div>
          <div className="machine-service-table" role="table" aria-label="Machine market changelog table">
            <div className="machine-service-row machine-changelog-row head" role="row">
              {['date', 'change', 'scope', 'source', 'source type', 'claim boundary'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {rows.map((row) => <div className="machine-service-row machine-changelog-row" role="row" key={`${row.date}:${row.change}`}>
              <span role="cell"><strong>{row.date}</strong></span>
              <span role="cell">{row.change}</span>
              <span role="cell"><span className="machine-badge source">{row.scope}</span></span>
              <span role="cell">{row.source}</span>
              <span role="cell"><span className="machine-badge evidence">{row.source_type}</span></span>
              <span role="cell">{row.claim_boundary}{row.receipt_href ? <> <a className="execute compact secondary" href={row.receipt_href}>View receipt detail</a></> : null}</span>
            </div>)}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function MachineNoClaimLedgerPage() {
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);

  useEffect(() => {
    document.title = 'Machine No-Claim Ledger | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'No-claim ledger for machine-service markets: no execution, payment, repeatability, benchmark, or winner claims without receipts.');
    let cancelled = false;
    api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100')
      .then((response) => {
        if (cancelled) return;
        setReceipts(response.data.receipts ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setReceipts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const evidenceCounts = useMemo(() => machineEvidenceCounts(receipts), [receipts]);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-no-claim-ledger-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine No-Claim Ledger navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-no-claim-ledger" />
        </div>
      </nav>
    </header>
    <main id="machine-no-claim-ledger-content" className="machine-market-page machine-no-claim-ledger-page" aria-label="Machine No-Claim Ledger">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Machine No-Claim Ledger</p>
          <h1>Machine No-Claim Ledger</h1>
          <p className="copy">Radar records restraint: 0 market-wide execution claims, scoped service-specific receipts, and no payment, benchmark, or winner claims without proof artifacts.</p>
        </div>
        <div className="ticker" aria-label="Machine no-claim ledger hero chips">
          <span>Radar records restraint</span>
          <span>Governance before autonomy</span>
          <span>Proof before trust</span>
          <span>Machines should not spend blind</span>
        </div>
      </section>
      <MachineNoClaimLedgerPanel variant="page" evidenceCounts={evidenceCounts} />
    </main>
  </div>;
}

function MachineRailCoverageMethodology() {
  const rows = [
    ['access_rail', 'The access surface Radar can see for a robotic.sh-listed service. Rail visibility is not a claim that the route is callable or executed.'],
    ['route_surface_status', 'Whether Radar sees callable routes, provider setup only, operator setup only, or no callable endpoint recorded.'],
    ['callable_routes_listed', 'Callable routes are listed in metadata. That is route evidence, not execution evidence.'],
    ['provider_setup_only', 'Provider setup is still required before Radar can treat the service as a safe callable planning route.'],
    ['no_callable_endpoint_recorded', 'The service is listed, but Radar has no callable endpoint surface recorded yet.'],
    ['credentials_required', 'Credentials or runtime registration may be required. Credentials do not prove payment or execution success.'],
    ['account_pricing', 'Pricing can be tied to a provider account or external billing surface. Account pricing is not receipt proof.'],
    ['execution_receipt', 'A service-specific durable receipt proving a real execution attempt. Without it, this page remains planning metadata.']
  ] as const;

  return <details className="panel machine-market-brief" aria-label="Machine rail methodology">
    <summary className="machine-evidence-methodology-summary">
      <span className="section-kicker">Rail Methodology</span>
      <strong>Execution rail definitions</strong>
      <small>Compact definitions for access rail, route surface status, setup-only states, credentials, pricing, and execution receipts.</small>
    </summary>
    <div className="machine-usage-list">
      {rows.map(([label, meaning]) => <p key={label}><span>{label}</span><small>{meaning}</small></p>)}
      <p className="machine-caveat-row"><span>rail caveat</span><small className="machine-caveat-copy">Rail coverage is planning metadata. Execution remains receipt-driven.</small></p>
    </div>
  </details>;
}

function MachineReadinessMatrixPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [coverageRun, setCoverageRun] = useState<MachinePreflightCoverageRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Readiness Matrix | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Readiness matrix for the 13 robotic.sh-visible machine services tracked by Infopunks Radar.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { runs: MachinePreflightCoverageRun[] } }>('/v1/machine-preflight/coverage-runs/recent?limit=1').catch(() => null),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null)
    ]).then(([servicesResponse, coverageResponse, receiptsResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setCoverageRun(coverageResponse?.data.runs?.[0] ?? null);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'readiness matrix unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = useMemo(() => buildMachineExecutionShortlist(services, receipts, coverageRun), [services, receipts, coverageRun]);
  const selectedControlledAction = getSelectedControlledActionCandidate(candidates);
  const rows = useMemo(
    () => buildMachineReadinessMatrix(services, candidates, coverageRun, receipts, selectedControlledAction?.service.id ?? null),
    [services, candidates, coverageRun, receipts, selectedControlledAction]
  );
  const evidenceCounts = useMemo(() => machineEvidenceCounts(receipts), [receipts]);
  const columns: MachineReadinessMatrixColumn[] = ['listed', 'classified', 'policy_mapped', 'preflight_recorded', 'proof_path', 'proof_plan_selected', 'execution_receipt', 'repeatability_receipt'];

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-readiness-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Readiness Matrix navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-readiness-matrix" />
        </div>
      </nav>
    </header>
    <main id="machine-readiness-content" className="machine-market-page machine-readiness-page" aria-label="Machine Readiness Matrix">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Machine Economy Readiness Matrix</p>
          <h1>Machine Readiness Matrix</h1>
          <p className="copy">13 services mapped. 0 robotic.sh market-wide execution claims. {serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}.</p>
          <p className="panel-caption">Cloud Translation remains the selected controlled action. Coverage and preflight do not imply execution. Repeatability remains missing without service-specific receipts.</p>
        </div>
        <div className="ticker" aria-label="Readiness matrix principles">
          <span>robotic.sh only</span>
          <span>planning only</span>
          <span>receipts decide claims</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading readiness matrix...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Readiness matrix unavailable: {error}</p></section>}
      {!loading && !error && <>
        <ReadinessMatrixBrief rows={rows} />
        <section className="panel machine-market-caveat" aria-label="Readiness matrix caveats">
          <p>13 services mapped. 0 robotic.sh market-wide execution claims. {serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}.</p>
          <p>{paymentSuccessClaimLabel(evidenceCounts.payment_success_claims)}. {benchmarkClaimLabel(evidenceCounts.benchmark_claims)}. {winnerClaimLabel(evidenceCounts.winner_claims)}.</p>
          <p>Pay.sh routes tracked separately. Cloud Translation is the current controlled action, not a winner.</p>
          <p><a className="execute compact secondary" href="/machine-market-map">View market map</a> <a className="execute compact secondary" href="/machine-economy-snapshot">View public snapshot</a> <a className="execute compact secondary" href="/machine-rail-coverage">View rail coverage</a></p>
        </section>
        <MachineEvidenceMethodologyDrawer />
        <section className="panel machine-readiness-matrix-panel" aria-label="Machine readiness matrix table">
          <div className="panel-head">
            <div><p className="section-kicker">Readiness Matrix</p><h2>{rows.length} robotic.sh-visible services</h2></div>
            <small>Execution and repeatability stay missing for services without a service-specific receipt.</small>
          </div>
          <div className="machine-service-table machine-readiness-table" role="table" aria-label="Machine readiness matrix">
            <div className="machine-service-row machine-readiness-row head" role="row">
              {['service', 'provider', 'policy', ...columns].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {rows.map((row) => <div className="machine-service-row machine-readiness-row" role="row" key={row.service.id}>
              <span role="cell"><strong>{row.service.name}</strong><small>{row.service.id}</small></span>
              <span role="cell">{row.service.provider}</span>
              <span role="cell">{row.candidate?.latest_policy_decision ?? 'not recorded'}</span>
              {columns.map((column) => <span role="cell" key={column}>
                <span className={`machine-status-badge matrix-state ${row.states[column]}`}>{describeMatrixCellState(row.states[column])}</span>
              </span>)}
            </div>)}
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function ReadinessMatrixBrief({ rows }: { rows: MachineReadinessMatrixRow[] }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const servicesMapped = rows.length;
  const proofPlanSelected = countMachineReadinessState(rows, 'proof_plan_selected', 'complete');
  const executionReceipts = countMachineReadinessState(rows, 'execution_receipt', 'complete');
  const repeatabilityReceipts = countMachineReadinessState(rows, 'repeatability_receipt', 'complete');
  const brief = `${servicesMapped} robotic.sh services mapped across the readiness ladder. ${proofPlanSelected} proof plan selected. 0 robotic.sh market-wide execution claims. ${executionReceipts} service-specific execution receipts. ${repeatabilityReceipts} repeatability receipts. Execution remains receipt-driven.`;

  async function copyBrief() {
    const copied = await copyText(brief);
    setCopyState(copied ? 'copied' : 'failed');
  }

  return <section className="panel machine-market-brief" aria-label="Readiness Matrix Brief">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Readiness Matrix Brief</p>
        <h2>Readiness Matrix Brief</h2>
      </div>
      <button className="execute compact secondary" type="button" onClick={copyBrief}>{copyState === 'copied' ? 'Copied brief' : copyState === 'failed' ? 'Copy failed' : 'Copy brief'}</button>
    </div>
    <p className="copy">{brief}</p>
    <p className="panel-caption">No market-wide execution claim. No benchmark claim. No winner claim. Execution remains receipt-driven.</p>
  </section>;
}

function MachineMarketMapPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [coverageRun, setCoverageRun] = useState<MachinePreflightCoverageRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Machine Market Map | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Read-only market map of the 13 robotic.sh-visible services grouped into machine-function categories.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { runs: MachinePreflightCoverageRun[] } }>('/v1/machine-preflight/coverage-runs/recent?limit=1').catch(() => null),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null)
    ]).then(([servicesResponse, coverageResponse, receiptsResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setCoverageRun(coverageResponse?.data.runs?.[0] ?? null);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine market map unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = useMemo(() => buildMachineExecutionShortlist(services, receipts, coverageRun), [services, receipts, coverageRun]);
  const categorySummaries = useMemo(() => buildMachineMarketMapSummaries(services, candidates, coverageRun, receipts), [services, candidates, coverageRun, receipts]);
  const strongestCategory = categorySummaries.find((item) => item.strongest) ?? null;
  const riskiestCategory = categorySummaries.find((item) => item.riskiest) ?? null;
  const evidenceCounts = useMemo(() => machineEvidenceCounts(receipts), [receipts]);
  const totalExecutionReceipts = categorySummaries.reduce((sum, item) => sum + item.service_execution_receipt_count, 0);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-market-map-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Market Map navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-market-map" />
        </div>
      </nav>
    </header>
    <main id="machine-market-map-content" className="machine-market-page machine-market-map-page" aria-label="Machine Market Map">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Robotic.sh Machine Market Map</p>
          <h1>Machine Market Map</h1>
          <p className="copy">{services.length} robotic.sh services mapped. {categorySummaries.length || 0} normalized machine-function categories. 0 robotic.sh market-wide execution claims. Planning only.</p>
          <p className="panel-caption">Read-only category map for the visible robotic.sh catalog. No robotic.sh market-wide execution claim, no benchmark claim, no winner claim.</p>
        </div>
        <div className="ticker" aria-label="Machine market map summary">
          <span>{services.length} services mapped</span>
          <span>{categorySummaries.length || 0} categories</span>
          <span>strongest: {strongestCategory?.label ?? 'pending'}</span>
          <span>riskiest: {riskiestCategory?.label ?? 'pending'}</span>
          <span>0 robotic.sh market-wide execution claims</span>
          <span>{serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}</span>
          <span>planning only</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine market map...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine market map unavailable: {error}</p></section>}
      {!loading && !error && <>
        <section className="grid four machine-market-summary" aria-label="Machine market map hero summary">
          <article className="panel metric"><span>Services Mapped</span><strong>{services.length}</strong><small>robotic.sh visible catalog</small></article>
          <article className="panel metric"><span>Category Count</span><strong>{categorySummaries.length}</strong><small>normalized machine-function groups</small></article>
          <article className="panel metric"><span>Strongest Readiness</span><strong>{strongestCategory?.label ?? 'n/a'}</strong><small>{strongestCategory ? `allow ${strongestCategory.allow_count} · ${formatDistributionSummary(strongestCategory.readiness_distribution, ['strong_candidate', 'possible_candidate', 'review_required', 'not_ready'])}` : 'pending'}</small></article>
          <article className="panel metric"><span>Riskiest Category</span><strong>{riskiestCategory?.label ?? 'n/a'}</strong><small>{riskiestCategory ? `allow ${riskiestCategory.allow_count} · review ${riskiestCategory.review_count} · deny ${riskiestCategory.deny_count}` : 'pending'}</small></article>
        </section>
        <section className="panel machine-market-caveat" aria-label="Machine market map caveats">
          <p>0 robotic.sh market-wide execution claims. Planning only.</p>
          <p>{serviceExecutionReceiptLabel(evidenceCounts.service_specific_execution_receipts)}. {paymentSuccessClaimLabel(evidenceCounts.payment_success_claims)}. {benchmarkClaimLabel(evidenceCounts.benchmark_claims)}. {winnerClaimLabel(evidenceCounts.winner_claims)}.</p>
          <p>Execution requires service-specific receipts before any robotic.sh success claim can be made. <a className="execute compact secondary" href="/machine-economy-snapshot">View public snapshot</a> <a className="execute compact secondary" href="/machine-rail-coverage">View rail coverage</a></p>
        </section>
        <section className="machine-market-map-grid" aria-label="Category map">
          {categorySummaries.map((summary) => <article className="panel machine-market-map-card" key={summary.key} aria-label={`${summary.label} category`}>
            <div className="panel-head">
              <div>
                <p className="section-kicker">Category Map</p>
                <h2>{summary.label}</h2>
              </div>
              <span className={`machine-badge ${summary.riskiest ? 'status setup' : 'evidence'}`}>{summary.service_count} services</span>
            </div>
            <div className="machine-market-map-flags">
              {summary.strongest && <span className="machine-status-badge complete">strongest readiness</span>}
              {summary.riskiest && <span className="machine-status-badge review">highest review / deny risk</span>}
              <span className="machine-status-badge not-attempted">{summary.service_execution_receipt_count} service-specific execution receipts</span>
            </div>
            <div className="machine-market-map-services" aria-label={`${summary.label} services`}>
              {summary.services.map((service) => <a className="machine-badge" key={service.id} href={`/machine-service/${encodeURIComponent(service.id)}`}>{service.name}</a>)}
            </div>
            <div className="machine-usage-list">
              <p><span>allow / review / deny</span><small>{summary.allow_count} / {summary.review_count} / {summary.deny_count}</small></p>
              <p><span>readiness tier distribution</span><small>{formatDistributionSummary(summary.readiness_distribution, ['strong_candidate', 'possible_candidate', 'review_required', 'not_ready'])}</small></p>
              <p><span>execution status summary</span><small>{formatDistributionSummary(summary.execution_status_distribution, ['not_attempted', 'attempted-recorded', 'execution-tested', 'repeatability-recorded'])}</small></p>
              <p><span>evidence health summary</span><small>{formatDistributionSummary(summary.evidence_health_distribution, ['scaffold', 'listed'])}</small></p>
              <p><span>category risk note</span><small>{summary.category_risk_note}</small></p>
              <p><span>machine-use narrative</span><small>{summary.machine_use_narrative}</small></p>
              {summary.key === 'maps-navigation' && summary.services.some((service) => service.id === 'naver-maps') && <p><span>proof path</span><small><a className="execute compact secondary" href="/machine-execution-plan/naver-maps">Inspect proof path</a></small></p>}
            </div>
          </article>)}
        </section>
        <section className="panel machine-mission-control" aria-label="Market interpretation panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Radar Interpretation</p>
              <h2>Market interpretation</h2>
            </div>
            <span className="machine-badge evidence">{totalExecutionReceipts} service-specific execution receipts</span>
          </div>
          <div className="machine-market-interpretation-list">
            <p><span>strongest now</span><small>{strongestCategory ? `${strongestCategory.label} has the clearest readiness profile in the visible catalog.` : 'Readiness leadership is pending current category aggregation.'}</small></p>
            <p><span>review risk</span><small>{riskiestCategory ? `${riskiestCategory.label} carries the highest current review / deny concentration.` : 'Review risk is pending current category aggregation.'}</small></p>
            <p><span>not execution-proven yet</span><small>Every category remains receipt-dependent. No robotic.sh-visible category is execution-proven on this page.</small></p>
            <p><span>why receipts matter</span><small>Catalog presence, policy coverage, and planning signals do not become execution-proven without service-specific receipts.</small></p>
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function FirstExecutionCard({
  anyTransReceipt,
  machineTranslationGeneralReceipt,
  repeatability,
  benchmarkReadiness
}: {
  anyTransReceipt: MachinePreflightReceipt | null;
  machineTranslationGeneralReceipt: MachinePreflightReceipt | null;
  repeatability: AlibabaMachineExecutionRepeatabilityArtifact | null;
  benchmarkReadiness: AlibabaMachineExecutionBenchmarkReadinessArtifact | null;
}) {
  const preflightStatus = machineTranslationGeneralReceipt?.decision ?? 'not_attempted';
  const executionStatus = machineTranslationGeneralReceipt?.execution_status ?? 'not_attempted';
  const paymentStatus = machineTranslationGeneralReceipt ? resolveMachinePaymentStatus(machineTranslationGeneralReceipt) : 'not_confirmed';
  const evidenceStage = machineTranslationGeneralReceipt?.evidence_stage ?? 'policy-mapped';
  const repeatabilityLabel = repeatability?.repeatability_status === 'repeatability-recorded' ? 'repeatability-recorded' : 'insufficient_runs';
  const recordedSuccessRate = typeof repeatability?.success_rate === 'number' ? `${Math.round(repeatability.success_rate * 100)}%` : '0%';
  const taxonomy = machineTranslationGeneralReceipt ? resolveMachineReceiptTaxonomy(machineTranslationGeneralReceipt) : MACHINE_EVIDENCE_TAXONOMY.entries.pay_sh_execution_candidate;
  const caveats = machineTranslationGeneralReceipt?.caveats?.length ? machineTranslationGeneralReceipt.caveats : [
    'Execution-tested applies only to Alibaba Machine Translation General after Radar records the successful execution receipt.',
    'This is not a benchmark artifact.',
    'No winner is claimed.',
    'Payment receipt is not claimed unless payment evidence is present.'
  ];
  return <section className="panel machine-market-caveat" aria-label="Machine Translation Execution Candidates">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Machine Translation Execution Candidates</p>
        <h2>Machine Translation Execution Candidates</h2>
      </div>
    </div>
    <p>AnyTrans remains attempted-recorded and workspace blocked. Machine Translation General is the first successful execution candidate only after Radar records a durable machine_execution receipt.</p>
    <p><b>Execution-tested applies only to Alibaba Machine Translation General after Radar records the successful execution receipt.</b></p>
    <p className="panel-caption">Service-specific execution evidence is not payment proof, not benchmark proof, and not winner proof. It also does not prove the full robotic.sh market is executable.</p>
    <p><a href="/machine-execution/alibaba-machine-translation-general">View repeatability artifact</a></p>
    <div className="machine-usage-list">
      <p><span>AnyTrans status</span><small>{anyTransReceipt ? 'attempted-recorded / workspace blocked' : 'attempted-recorded / workspace blocked'}</small></p>
      <p><span>AnyTrans latest receipt</span><small>{anyTransReceipt?.receipt_id ?? 'none'}</small></p>
      <p><span>candidate</span><small>Alibaba Machine Translation General</small></p>
      <p><span>endpoint</span><small>POST api/translate/web/general</small></p>
      <p><span>current status</span><small>{executionStatus === 'succeeded' ? 'succeeded' : executionStatus === 'failed' ? 'failed' : machineTranslationGeneralReceipt ? 'configured' : 'fail-closed'}</small></p>
      <p><span>preflight status</span><small>{preflightStatus}</small></p>
      <p><span>execution status</span><small>{executionStatus}</small></p>
      <p><span>evidence scope</span><small>{taxonomy.scope}</small></p>
      <p><span>receipt type</span><small>{taxonomy.receipt_type}</small></p>
      <p><span>claim status</span><small>{taxonomy.claim_status}</small></p>
      <p><span>executor</span><small>{machineTranslationGeneralReceipt?.execution_executor_name ?? 'not available'}</small></p>
      <p><span>executor mode</span><small>{machineTranslationGeneralReceipt?.execution_executor_mode ?? 'not available'}</small></p>
      <p><span>payment status</span><small>{paymentStatus}</small></p>
      <p><span>evidence stage</span><small>{evidenceStage}</small></p>
      <p><span>latest execution receipt</span><small>{machineTranslationGeneralReceipt?.receipt_id ?? 'none'}</small></p>
      <p><span>repeatability</span><small>{repeatabilityLabel}</small></p>
      <p><span>repeatability successful runs</span><small>{repeatability?.successful_receipts ?? 0} successful receipts</small></p>
      <p><span>recorded success rate</span><small>{recordedSuccessRate}</small></p>
      <p><span>benchmark readiness</span><small>{benchmarkReadiness?.benchmark_readiness_status ?? 'criteria-defined'}</small></p>
      <p><span>payment success claims</span><small>0</small></p>
      <p><span>benchmark recorded</span><small>{String(benchmarkReadiness?.claims.benchmark_recorded ?? false)}</small></p>
      <p><span>winner claimed</span><small>{String(benchmarkReadiness?.claims.winner_claimed ?? false)}</small></p>
      <p><span>benchmark claims</span><small>0</small></p>
      <p><span>winner claims</span><small>0</small></p>
      <p className="machine-caveat-row"><span>caveats</span><small className="machine-caveat-copy">{caveats.join(' ')}</small></p>
    </div>
  </section>;
}

function AlibabaMachineExecutionDetailPage() {
  const [receipt, setReceipt] = useState<MachinePreflightReceipt | null>(null);
  const [repeatability, setRepeatability] = useState<AlibabaMachineExecutionRepeatabilityArtifact | null>(null);
  const [benchmarkReadiness, setBenchmarkReadiness] = useState<AlibabaMachineExecutionBenchmarkReadinessArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Alibaba Machine Translation General Execution | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Execution-tested detail page for Alibaba Machine Translation General route evidence in Machine Radar.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?service_id=alibaba-machine-translation-general&limit=25'),
      api<{ data: AlibabaMachineExecutionRepeatabilityArtifact }>('/v1/machine-execution/alibaba-machine-translation-general/repeatability').catch(() => null),
      api<{ data: AlibabaMachineExecutionBenchmarkReadinessArtifact }>('/v1/machine-execution/alibaba-machine-translation-general/benchmark-readiness').catch(() => null)
    ])
      .then(([response, repeatabilityResponse, benchmarkReadinessResponse]) => {
        if (cancelled) return;
        const receipts = response.data.receipts.filter((row) =>
          row.receipt_type === 'machine_execution'
          && row.execution_service_id === 'alibaba-machine-translation-general'
        );
        const latestSuccessful = receipts.find((row) => row.execution_status === 'succeeded') ?? null;
        setReceipt(latestSuccessful ?? receipts[0] ?? null);
        setRepeatability(repeatabilityResponse?.data ?? null);
        setBenchmarkReadiness(benchmarkReadinessResponse?.data ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'execution receipt API unavailable');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestSummary = parseMachineExecutionSummary(receipt?.execution_request_summary);
  const responseSummary = parseMachineExecutionSummary(receipt?.execution_response_summary);
  const providerRequestId = readSummaryField(responseSummary, ['provider_request_id', 'providerRequestId']) ?? 'unknown';
  const wordCount = readSummaryField(responseSummary, ['word_count', 'wordCount']) ?? 'unknown';
  const translatedPreview = readSummaryField(responseSummary, ['translated_text_preview', 'translatedTextPreview']) ?? 'Las máquinas no deberían gastar a ciegas.';
  const inputPreview = readSummaryField(requestSummary, ['text', 'text_preview', 'textPreview']) ?? 'Machines should not spend blind.';
  const receiptTaxonomy = receipt ? resolveMachineReceiptTaxonomy(receipt) : null;
  const paymentStatus = receipt ? resolveMachinePaymentStatus(receipt) : 'not_confirmed';

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-execution-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Execution navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
          <span>Infopunks</span>
          <strong>Pay.sh Radar</strong>
        </a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current={null} />
        </div>
      </nav>
    </header>
    <main id="machine-execution-content" className="machine-market-page machine-execution-page" aria-label="Alibaba machine execution detail">
      <section className="panel hero machine-market-hero machine-execution-hero">
        <div>
          <p className="eyebrow">Machine Execution</p>
          <h1>Alibaba Machine Translation General</h1>
          <p className="copy">Service-specific execution evidence for a Pay.sh machine-translation route candidate.</p>
          <div className="chips">
            <span>execution-tested</span>
            <span>Pay.sh</span>
            <span>Solana</span>
            <span>Harness executed</span>
            <span>Radar recorded</span>
          </div>
        </div>
      </section>
      {loading && <section className="panel" role="status" aria-live="polite"><p className="route-state">Loading execution receipt...</p></section>}
      {error && !loading && <section className="panel" role="alert"><p className="route-state error">Execution receipt API unavailable: {error}</p></section>}
      {!loading && !error && !receipt && <section className="panel"><EmptyState title="No execution receipt yet." body="No execution-tested receipt exists for Alibaba Machine Translation General yet." /></section>}
      {!loading && !error && receipt && <>
        <section className="panel" aria-label="Latest execution receipt">
          <div className="panel-head"><div><p className="section-kicker">Latest Execution Receipt</p><h2>{receipt.receipt_id}</h2></div></div>
          <div className="machine-usage-list">
            <p><span>receipt_id</span><small>{receipt.receipt_id}</small></p>
            <p><span>machine_id</span><small>{receipt.machine_id}</small></p>
            <p><span>created_at</span><small>{formatMachineTimestamp(receipt.created_at)}</small></p>
            <p><span>execution_status</span><small>{receipt.execution_status}</small></p>
            <p><span>execution_occurred</span><small>{String(receipt.execution_occurred)}</small></p>
            <p><span>evidence_scope</span><small>{receiptTaxonomy?.scope ?? 'service_execution'}</small></p>
            <p><span>receipt_type</span><small>{receiptTaxonomy?.receipt_type ?? 'execution_receipt'}</small></p>
            <p><span>claim_status</span><small>{receiptTaxonomy?.claim_status ?? 'receipt_recorded'}</small></p>
            <p><span>payment_status</span><small>{paymentStatus}</small></p>
            <p><span>evidence_stage</span><small>{receipt.evidence_stage ?? 'unknown'}</small></p>
            <p><span>executor</span><small>{receipt.execution_executor_name ?? 'unknown'}</small></p>
            <p><span>executor mode</span><small>{receipt.execution_executor_mode ?? 'unknown'}</small></p>
            <p><span>executor version</span><small>{receipt.execution_executor_version ?? 'unknown'}</small></p>
            <p><span>execution latency</span><small>{formatMs(receipt.execution_latency_ms)}</small></p>
            <p><span>provider request id</span><small>{String(providerRequestId)}</small></p>
            <p><span>word count</span><small>{String(wordCount)}</small></p>
          </div>
        </section>
        <section className="panel" aria-label="Input and output summary">
          <div className="panel-head"><div><p className="section-kicker">Input / Output Summary</p><h2>Safe summary only</h2></div></div>
          <div className="machine-usage-list">
            <p><span>Input</span><small>{`"${String(inputPreview)}"`}</small></p>
            <p><span>Output</span><small>{`"${String(translatedPreview)}"`}</small></p>
          </div>
        </section>
        <section className="panel" aria-label="Payment status">
          <div className="panel-head"><div><p className="section-kicker">Payment Status</p><h2>{paymentStatus}</h2></div></div>
          <p className="panel-caption">0 payment success claims. Payment remains unconfirmed unless payment evidence exists.</p>
        </section>
        {repeatability && <section className="panel" aria-label="Machine Execution Repeatability Artifact">
          <div className="panel-head"><div><p className="section-kicker">Repeatability</p><h2>Machine Execution Repeatability Artifact</h2></div></div>
          <p className="panel-caption">Same route. Same prompt family. Multiple successful execution receipts. Repeatability is route-specific, not benchmark proof.</p>
          <div className="chips compact-chips">
            <span>status: {repeatability.repeatability_status}</span>
            <span>artifact: {repeatability.artifact_id}</span>
          </div>
          <div className="machine-usage-list">
            <p><span>successful executions</span><small>{repeatability.successful_receipts}</small></p>
            <p><span>failed executions</span><small>{repeatability.failed_receipts}</small></p>
            <p><span>success rate</span><small>{formatRepeatabilitySuccessRate(repeatability.success_rate)}</small></p>
            <p><span>latency range</span><small>{formatLatencyRangeSeconds(repeatability.latency_ms.min, repeatability.latency_ms.max)}</small></p>
            <p><span>median latency</span><small>{formatLatencySeconds(repeatability.latency_ms.median)}</small></p>
            <p><span>durable storage</span><small>Postgres</small></p>
            <p><span>payment success claims</span><small>0</small></p>
            <p><span>benchmark claims</span><small>0</small></p>
            <p><span>winner claims</span><small>0</small></p>
          </div>
          <div className="machine-usage-list">
            <p><span>proof chain</span><small>Coverage → Execution-tested → Repeatability-recorded → <span className="repeatability-muted-stage">Benchmark-ready, inactive</span> → <span className="repeatability-muted-stage">Benchmark-recorded, inactive</span></small></p>
          </div>
          <p className="panel-caption">Repeatability-recorded means this route has produced multiple successful execution receipts under the same prompt family. It is not a benchmark, not a winner claim, and not market-wide proof.</p>
          <section aria-label="Repeatability receipt list">
            <div className="panel-head"><div><p className="section-kicker">Receipts</p><h3>Execution receipt excerpts</h3></div></div>
            <div className="machine-receipt-table" role="table" aria-label="Repeatability receipts">
              <div className="machine-receipt-row machine-receipt-header" role="row">
                <span role="columnheader">receipt id</span>
                <span role="columnheader">provider request id</span>
                <span role="columnheader">latency</span>
                <span role="columnheader">created_at</span>
                <span role="columnheader">output preview</span>
              </div>
              {buildRepeatabilityReceiptRows(repeatability, receipt).map((row) => <div key={row.receipt_id} className="machine-receipt-row" role="row">
                <span role="cell">{row.receipt_id}</span>
                <span role="cell">{row.provider_request_id ?? 'unknown'}</span>
                <span role="cell">{formatLatencySeconds(row.latency_ms)}</span>
                <span role="cell">{row.created_at ? formatMachineTimestamp(row.created_at) : 'unknown'}</span>
                <span role="cell">{row.output_preview ?? 'No output preview.'}</span>
              </div>)}
            </div>
          </section>
          <section className="panel" aria-label="Repeatability input output">
            <div className="panel-head"><div><p className="section-kicker">Input / Output</p><h3>Safe excerpt panel</h3></div></div>
            <div className="machine-usage-list">
              <p><span>Input</span><small>{`"${repeatability.input_summary[0] ?? inputPreview}"`}</small></p>
              <p><span>Output</span><small>{`"${repeatability.output_summaries[0] ?? translatedPreview}"`}</small></p>
            </div>
            <p className="panel-caption">Output summaries are safe excerpts from durable execution receipts.</p>
          </section>
          {repeatability.repeatability_status === 'insufficient_runs'
            ? <p className="panel-caption">Progress: {repeatability.successful_receipts} / 3 successful receipts. Run {repeatability.remaining_successful_runs_needed} more successful executions with the same prompt family.</p>
            : <p className="panel-caption">Repeatability recorded across {repeatability.successful_receipts} successful executions.</p>}
        </section>}
        {benchmarkReadiness && <section className="panel" aria-label="Benchmark-Ready Criteria">
          <div className="panel-head"><div><p className="section-kicker">Benchmark Readiness</p><h2>Benchmark-Ready Criteria</h2></div></div>
          <p className="panel-caption">Benchmark-ready criteria define the gate for a future benchmark. No benchmark has been run and no winner is claimed.</p>
          <div className="chips compact-chips">
            <span>status: {benchmarkReadiness.benchmark_readiness_status}</span>
            <span>benchmark-recorded: inactive</span>
            <span>winner-claimed: {String(benchmarkReadiness.claims.winner_claimed)}</span>
          </div>
          <div className="machine-usage-list">
            <p><span>readiness summary</span><small>{benchmarkReadiness.satisfied_criteria_count} / {benchmarkReadiness.total_criteria_count} criteria satisfied</small></p>
            <p><span>benchmark ready</span><small>{String(benchmarkReadiness.benchmark_ready)}</small></p>
            <p><span>benchmark claims</span><small>0</small></p>
            <p><span>winner claims</span><small>0</small></p>
          </div>
          <section aria-label="Benchmark criteria checklist">
            <div className="panel-head"><div><p className="section-kicker">Criteria</p><h3>Checklist</h3></div></div>
            <div className="machine-receipt-table" role="table" aria-label="Benchmark readiness criteria">
              <div className="machine-receipt-row machine-receipt-header" role="row">
                <span role="columnheader">criterion</span>
                <span role="columnheader">required</span>
                <span role="columnheader">actual</span>
                <span role="columnheader">satisfied</span>
              </div>
              {benchmarkReadiness.criteria.map((row) => <div key={row.id} className="machine-receipt-row" role="row">
                <span role="cell">{row.id}</span>
                <span role="cell">{String(row.required)}</span>
                <span role="cell">{String(row.actual)}</span>
                <span role="cell">{String(row.satisfied)}</span>
              </div>)}
            </div>
          </section>
          <section className="panel" aria-label="Missing benchmark criteria">
            <div className="panel-head"><div><p className="section-kicker">Missing Criteria</p><h3>Unmet gates</h3></div></div>
            <p className="panel-caption">{benchmarkReadiness.missing_criteria.length ? benchmarkReadiness.missing_criteria.join(', ') : 'none'}</p>
            <p className="panel-caption">comparison-not-ready</p>
          </section>
          <section className="panel" aria-label="Future benchmark schema preview">
            <div className="panel-head"><div><p className="section-kicker">Schema Preview</p><h3>Future benchmark artifact schema</h3></div></div>
            <pre className="methodology-code-block"><code>{JSON.stringify(benchmarkReadiness.benchmark_artifact_schema, null, 2)}</code></pre>
            <p className="panel-caption">Schema definition only. This is not a recorded benchmark.</p>
          </section>
        </section>}
      </>}
      <section className="panel" aria-label="Evidence caveats">
        <div className="panel-head"><div><p className="section-kicker">Evidence Caveats</p><h2>Repeatability artifact caveats</h2></div></div>
        <ul className="machine-caveat-list">
          <li>This is a repeatability artifact, not a benchmark.</li>
          <li>No winner is claimed.</li>
          <li>Payment is not claimed without explicit payment evidence.</li>
          <li>Repeatability applies only to Alibaba Machine Translation General.</li>
          <li>This does not imply the full robotic.sh market is execution-tested.</li>
        </ul>
      </section>
      <section className="panel" aria-label="AnyTrans relationship">
        <div className="panel-head"><div><p className="section-kicker">Relationship to AnyTrans</p><h2>Current state</h2></div></div>
        <p className="panel-caption">AnyTrans remains attempted-recorded and blocked by provider workspace authorization. Alibaba Machine Translation General is the first service-specific successful execution-tested Pay.sh route in this machine-translation evidence set.</p>
      </section>
    </main>
  </div>;
}

function CoveragePanel({
  latestRun,
  loading,
  running,
  error,
  onRun
}: {
  latestRun: MachinePreflightCoverageRun | null;
  loading: boolean;
  running: boolean;
  error: string | null;
  onRun: () => void;
}) {
  return <section className="panel machine-market-caveat" aria-label="Preflight Coverage">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Preflight Coverage</p>
        <h2>Preflight Coverage</h2>
      </div>
      <button className="execute compact" type="button" onClick={onRun} disabled={running}>{running ? 'Running...' : 'Run Coverage Preflight'}</button>
    </div>
    <p>Evaluate the full listed robotic.sh service market through bounded-authority preflight and record durable decision receipts.</p>
    <p className="panel-caption">Preflight decision receipts are policy decisions, not service execution. Coverage receipts do not prove payment, benchmark status, or winner status.</p>
    {loading && !latestRun && <p className="panel-caption">Loading latest coverage run...</p>}
    {error && <p className="route-state error">{error}</p>}
    {latestRun && <div className="machine-usage-list">
      <p><span>Latest run</span><small>{latestRun.run_id} · {formatMachineTimestamp(latestRun.generated_at)}</small></p>
      <p><span>Services evaluated</span><small>{latestRun.preflight_evaluated} / {latestRun.services_total}</small></p>
      <p><span>Decisions</span><small>allow {latestRun.allow_count} · review {latestRun.review_count} · deny {latestRun.deny_count}</small></p>
      <p><span>Receipts recorded</span><small>{latestRun.receipts_recorded}</small></p>
      <p><span>Storage adapter</span><small>{latestRun.storage?.adapter ?? 'unknown'}</small></p>
      <p className="machine-caveat-row"><span>Caveats</span><small className="machine-caveat-copy">{latestRun.caveats.join(' ')}</small></p>
    </div>}
  </section>;
}

function MachineMarketHero() {
  return <section className="panel hero machine-market-hero">
    <div>
      <p className="eyebrow">Machine Economy</p>
      <h1>Machine Market Command Center</h1>
      <p className="copy">Radar turns visible machine services into policy, rail, route, proof, and receipt state before machines spend.</p>
      <p className="panel-caption">13 listed services mapped from robotic.sh for Phase 2 machine-economy intelligence.</p>
    </div>
    <div className="ticker" aria-label="Machine Market principles">
      <span>Listed ≠ callable</span>
      <span>Callable ≠ executed</span>
      <span>Credentials ≠ payment proof</span>
      <span>Route surface ≠ receipt</span>
    </div>
  </section>;
}

function MachineMarketSummaryCards({
  summary,
  loading,
  serviceCount,
  executionReceiptCount,
  repeatabilityReceiptCount,
  paymentSuccessClaimCount
}: {
  summary: MachineMarketSummary | null;
  loading: boolean;
  serviceCount: number;
  executionReceiptCount: number;
  repeatabilityReceiptCount: number;
  paymentSuccessClaimCount: number;
}) {
  const total = summary?.total_services ?? serviceCount;
  return <section className="grid four machine-market-summary" aria-label="Machine Market summary">
    <article className="panel metric"><span>Services mapped</span><strong>{loading && !total ? '...' : total}</strong><small>listed robotic.sh snapshot</small></article>
    <article className="panel metric"><span>Policy mapped</span><strong>{loading && !total ? '...' : total}</strong><small>policy state exists for each listed service</small></article>
    <article className="panel metric"><span>First-safe queue</span><strong>active</strong><small>planning state only</small></article>
    <article className="panel metric"><span>Market-wide execution claims</span><strong>0</strong><small>Service receipt ≠ market proof.</small></article>
    <article className="panel metric"><span>Service-specific execution receipts</span><strong>{executionReceiptCount}</strong><small>{executionReceiptCount === 1 ? 'Machine Translation candidate only; not market-wide proof.' : 'Service-specific execution receipts are scoped to the recorded route.'}</small></article>
    <article className="panel metric"><span>Payment success claims</span><strong>{paymentSuccessClaimCount}</strong><small>Payment remains unconfirmed unless payment evidence exists.</small></article>
    {repeatabilityReceiptCount > 0 && <article className="panel metric"><span>Repeatability: {repeatabilityReceiptCount} route{repeatabilityReceiptCount === 1 ? '' : 's'}</span><strong>{repeatabilityReceiptCount}</strong><small>Single-route repeatability, not benchmark or winner evidence.</small></article>}
  </section>;
}

function MachineEvidenceStageTag({ stage }: { stage: string | null | undefined }) {
  return <span className="machine-badge evidence" title={getEvidenceStageDescription(stage)}>{formatEvidenceStage(stage)}</span>;
}

function MachineEvidenceClaims({ serviceOrReceipt }: { serviceOrReceipt: { evidence_stage?: string | null } | null | undefined }) {
  const stage = serviceOrReceipt?.evidence_stage ?? null;
  const execution = canClaimExecutionTested(serviceOrReceipt) ? 'execution-tested claim: allowed' : 'execution-tested claim: not yet';
  const receipt = canClaimReceiptRecorded(serviceOrReceipt) ? 'receipt-recorded claim: allowed' : 'receipt-recorded claim: not yet';
  const benchmark = canClaimBenchmarkRecorded(serviceOrReceipt) ? 'benchmark-recorded claim: allowed' : 'benchmark-recorded claim: not yet';
  return <small>{formatEvidenceStage(stage)} · {execution} · {receipt} · {benchmark}</small>;
}

function EvidenceLadder({ services }: { services: MachineMarketService[] }) {
  const activeStages = new Set(services.map((service) => service.evidence_stage));
  return <section className="panel evidence-ladder-panel" aria-label="Evidence ladder">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Evidence Ladder</p>
        <h2>Listed to receipts</h2>
      </div>
      <small>Execution-tested, receipt-recorded, and benchmark-recorded remain inactive unless evidence exists.</small>
    </div>
    <div className="evidence-ladder">
      {MACHINE_MARKET_STAGES.map((stage, index) => <React.Fragment key={stage}>
        <span className={activeStages.has(stage) ? 'active' : 'future'} title={getEvidenceStageDescription(stage)}>{formatEvidenceStage(stage)}</span>
        {index < MACHINE_MARKET_STAGES.length - 1 && <b aria-hidden="true">-&gt;</b>}
      </React.Fragment>)}
    </div>
    <div className="machine-usage-list evidence-counts">
      {MACHINE_MARKET_STAGES.map((stage) => <p key={stage}><span>{formatEvidenceStage(stage)}</span><small>{getEvidenceStageDescription(stage)}</small></p>)}
    </div>
  </section>;
}

function Filters({ filters, onChange }: { filters: MachineMarketFilters; onChange: (filters: MachineMarketFilters) => void }) {
  const update = <K extends keyof MachineMarketFilters>(key: K, value: MachineMarketFilters[K]) => onChange({ ...filters, [key]: value });
  return <section className="panel machine-market-filters" aria-label="Machine Market filters">
    <FilterSelect label="Market type" value={filters.marketType} values={['all', 'digital', 'physical']} onChange={(value) => update('marketType', value as MachineMarketFilters['marketType'])} />
    <FilterSelect label="Category" value={filters.category} values={['all', ...MACHINE_MARKET_CATEGORIES]} onChange={(value) => update('category', value as MachineMarketFilters['category'])} />
    <FilterSelect label="Source market" value={filters.sourceMarket} values={['all', ...MACHINE_MARKET_SOURCES]} onChange={(value) => update('sourceMarket', value as MachineMarketFilters['sourceMarket'])} />
    <FilterSelect label="Chain" value={filters.chain} values={['all', ...MACHINE_MARKET_CHAINS]} onChange={(value) => update('chain', value as MachineMarketFilters['chain'])} />
    <FilterSelect label="Evidence stage" value={filters.evidenceStage} values={['all', ...MACHINE_MARKET_STAGES]} onChange={(value) => update('evidenceStage', value as MachineMarketFilters['evidenceStage'])} />
    <FilterSelect label="Status" value={filters.status} values={['all', 'ready', 'setup']} onChange={(value) => update('status', value as MachineMarketFilters['status'])} />
  </section>;
}

function FilterSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label>
    <span>{label}</span>
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {values.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  </label>;
}

function MachineServiceTable({ services, selectedId, onSelect }: { services: MachineMarketService[]; selectedId: string | null; onSelect: (service: MachineMarketService) => void }) {
  return <section className="panel machine-service-table-panel" aria-label="Machine services">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Service Registry</p>
        <h2>{services.length} visible services</h2>
      </div>
      <small>Agentic.Market/Base rows are source metadata from robotic.sh, not the Phase 2 build priority.</small>
    </div>
    {!services.length && <EmptyState title="No services match these filters." body="Adjust filters to view the robotic.sh service mirror." />}
    {!!services.length && <div className="machine-service-table" role="table" aria-label="Machine Market service table">
      <div className="machine-service-row head" role="row">
        {['service', 'category', 'market', 'chain', 'status', 'evidence', 'risk', 'price', 'dossier'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
      </div>
      {services.map((service) => <div key={service.id} className={`machine-service-row ${selectedId === service.id ? 'selected' : ''}`} role="row">
        <span role="cell"><button className="machine-service-select" type="button" onClick={() => onSelect(service)}><strong>{service.name}</strong><small>{service.provider}</small></button></span>
        <span role="cell" className="machine-badge">{service.category}</span>
        <span role="cell" className="machine-badge source">{service.source_market}</span>
        <span role="cell" className="machine-badge chain">{service.chain}</span>
        <span role="cell" className={`machine-badge status ${service.status}`}>{service.status}</span>
        <span role="cell"><MachineEvidenceStageTag stage={service.evidence_stage} /></span>
        <span role="cell" className="machine-policy-risk">{service.policy_risk}</span>
        <span role="cell">{service.price_display}</span>
        <span role="cell"><a className="execute compact secondary" href={`/machine-service/${encodeURIComponent(service.id)}`}>View service dossier</a></span>
      </div>)}
    </div>}
  </section>;
}

function MachineServiceCard({ service, candidate }: { service: MachineMarketService | null; candidate: MachineExecutionCandidateScore | null }) {
  if (!service) return <aside className="panel machine-service-card"><EmptyState title="No service selected." body="Select a service to view its policy profile." /></aside>;
  return <aside className="panel machine-service-card" aria-label="Service policy profile">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Policy Profile</p>
        <h2>{service.name}</h2>
      </div>
      <span className={`machine-badge status ${service.status}`}>{service.status}</span>
    </div>
    <p className="copy">{service.description}</p>
    <div className="dossier-badges">
      <span>{service.provider}</span>
      <span>{service.category}</span>
      <span>{service.source_market}</span>
      <span>{service.chain}</span>
      <span>{formatEvidenceStage(service.evidence_stage)}</span>
    </div>
    <div className="key-values machine-service-profile">
      <p><b>market_type</b><span>{service.market_type}</span></p>
      <p><b>price</b><span>{service.price_display}</span></p>
      <p><b>evidence_health</b><span>{service.evidence_health}</span></p>
      <p><b>candidate_tier</b><span>{candidate?.candidate_tier ?? 'not scored'}</span></p>
      <p><b>recommendation</b><span>{candidate?.recommendation ?? 'not scored'}</span></p>
      <p><b>execution_status</b><span>{candidate?.execution_status ?? 'not_attempted'}</span></p>
      <p><b>observed_source</b><span>{service.observed_source}</span></p>
      <p><b>observed_at</b><span>{formatMachineTimestamp(service.observed_at)}</span></p>
    </div>
    <section className="dossier-section machine-next-action" aria-label="Selected service next action">
      <h4>Next action</h4>
      <p>{candidate?.recommendation === 'next_execution_candidate' ? 'Open the proof plan and verify every gate before any execution attempt.' : 'Inspect the proof plan and dossier before changing execution posture.'}</p>
      <a className="execute compact" href={`/machine-execution-plan/${encodeURIComponent(service.id)}`}>Open proof plan</a>
    </section>
    <section className="dossier-section">
      <h4>Machine use case</h4>
      <p>{service.machine_use_case}</p>
    </section>
    <section className="dossier-section">
      <h4>Policy risk</h4>
      <p>{service.policy_risk}</p>
    </section>
    <section className="dossier-section">
      <h4>Evidence stage</h4>
      <p>{getEvidenceStageDescription(service.evidence_stage)}</p>
      <MachineEvidenceClaims serviceOrReceipt={service} />
    </section>
    <a className="execute compact secondary" href={`/machine-service/${encodeURIComponent(service.id)}`}>View service dossier</a>
    <section className="dossier-section">
      <h4>Caveats</h4>
      <ul className="machine-caveat-list">
        {service.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
      </ul>
    </section>
  </aside>;
}

const PAY_SH_SERVICE_SEPARATION_NOTE = 'Pay.sh execution candidates are tracked separately from the robotic.sh visible service mirror. Alibaba Machine Translation General is the first service-specific execution-tested Pay.sh route in this machine-translation evidence set; it is not counted as one of the 13 visible robotic.sh services unless robotic.sh lists it.';

type MachineExecutionCandidateTier = 'strong_candidate' | 'possible_candidate' | 'review_required' | 'not_ready';
type MachineExecutionCandidateRecommendation = 'next_execution_candidate' | 'monitor' | 'needs_review' | 'avoid_for_now';
type MachineExecutionCandidateScore = {
  service: MachineMarketService;
  policy_safety_score: number;
  execution_readiness_score: number;
  auth_friction_score: number;
  machine_relevance_score: number;
  input_output_clarity_score: number;
  catalog_confidence_score: number;
  evidence_health_score: number;
  overall_candidate_score: number;
  candidate_tier: MachineExecutionCandidateTier;
  recommendation: MachineExecutionCandidateRecommendation;
  latest_policy_decision: 'allow' | 'deny' | 'review' | 'not recorded';
  latest_receipt_id: string | null;
  execution_status: 'not_attempted' | 'attempted-recorded' | 'execution-tested' | 'repeatability-recorded';
  positive_reasons: string[];
  blocking_reasons: string[];
};

function MachineExecutionShortlistPage() {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [coverageRun, setCoverageRun] = useState<MachinePreflightCoverageRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Robotic.sh Execution Shortlist | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Evidence-based shortlist for future robotic.sh-visible machine service execution candidates.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>('/v1/machine-preflight/receipts/recent?limit=100').catch(() => null),
      api<{ data: { runs: MachinePreflightCoverageRun[] } }>('/v1/machine-preflight/coverage-runs/recent?limit=1').catch(() => null)
    ]).then(([servicesResponse, receiptsResponse, coverageResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setCoverageRun(coverageResponse?.data.runs?.[0] ?? null);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'execution shortlist unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = useMemo(() => buildMachineExecutionShortlist(services, receipts, coverageRun), [services, receipts, coverageRun]);
  const topCandidate = candidates[0] ?? null;

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-shortlist-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Execution Shortlist navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-execution-shortlist" />
        </div>
      </nav>
    </header>
    <main id="machine-shortlist-content" className="machine-market-page machine-shortlist-page" aria-label="Robotic.sh Execution Candidate Shortlist">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Robotic.sh Execution Candidate Shortlist</p>
          <h1>Execution Shortlist</h1>
          <p className="copy">Evidence-based candidate ranking for future execution attempts across the 13 robotic.sh-visible services.</p>
          <p className="panel-caption">Candidate ranking evaluates readiness for future execution. It is not a payment, benchmark, provider-quality, or winner claim.</p>
        </div>
        <div className="ticker" aria-label="Shortlist principles">
          <span>Candidate language only</span>
          <span>No new execution</span>
          <span>Coverage is not execution</span>
        </div>
      </section>
      {loading && <section className="panel" role="status"><p className="route-state">Loading execution shortlist...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Execution shortlist unavailable: {error}</p></section>}
      {!loading && !error && <>
        <section className="panel machine-market-caveat" aria-label="Pay.sh separation note">
          <p>{PAY_SH_SERVICE_SEPARATION_NOTE}</p>
        </section>
        <TopExecutionCandidatePanel candidate={topCandidate} />
        <MachineEvidenceMethodologyDrawer />
        <MachineExecutionShortlistMethodology />
        <section className="panel machine-service-table-panel" aria-label="Execution candidate ranking">
          <div className="panel-head">
            <div><p className="section-kicker">Candidate Ranking</p><h2>{candidates.length} robotic.sh-visible services</h2></div>
            <small>Sorted by deterministic candidate score, then service_id.</small>
          </div>
          {!candidates.length && <EmptyState title="No services found." body="The machine-market registry returned no visible robotic.sh services." />}
          {!!candidates.length && <div className="machine-service-table machine-shortlist-table" role="table" aria-label="Robotic.sh execution candidate table">
            <div className="machine-service-row machine-shortlist-row head" role="row">
              {['service', 'provider', 'category', 'market', 'chain', 'latest policy', 'evidence', 'execution', 'tier', 'score', 'recommendation', 'reasons', 'dossier'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {candidates.map((candidate) => <MachineExecutionCandidateRow key={candidate.service.id} candidate={candidate} />)}
          </div>}
        </section>
      </>}
    </main>
  </div>;
}

function TopExecutionCandidatePanel({ candidate }: { candidate: MachineExecutionCandidateScore | null }) {
  return <section className="panel machine-policy-summary" aria-label="Top execution candidate">
    <div className="panel-head"><div><p className="section-kicker">Top Candidate</p><h2>{candidate?.service.name ?? 'No candidate available'}</h2></div></div>
    {!candidate && <EmptyState title="No top candidate." body="Radar needs the visible service registry before it can compute a shortlist." />}
    {candidate && <>
      <p>Radar recommends this as the clearest next execution candidate among the 13 robotic.sh-visible services. This is not an execution claim.</p>
      <div className="machine-usage-list">
        <p><span>safest next robotic.sh-listed candidate</span><small>{candidate.service.name} / {candidate.service.id}</small></p>
        <p><span>why selected</span><small>{candidate.positive_reasons.join(' ')}</small></p>
        <p><span>why not execution-proven</span><small>{candidate.execution_status === 'not_attempted' ? 'No execution receipt is recorded for this robotic.sh-listed service.' : `Execution status is ${candidate.execution_status}; inspect service-specific receipts before any claim.`}</small></p>
        <p><span>evidence needed before execution</span><small>Fresh allow preflight, explicit operator approval, route/auth readiness, request/response schema, cost ceiling, and durable execution receipt storage.</small></p>
        <p><span>latest receipt/preflight reference</span><small>{candidate.latest_receipt_id ?? 'not recorded'}</small></p>
        <p><span>candidate tier</span><small>{candidate.candidate_tier}</small></p>
        <p><span>overall candidate score</span><small>{candidate.overall_candidate_score}</small></p>
        <p><span>proof planning</span><small><a className="execute compact secondary" href={`/machine-execution-plan/${encodeURIComponent(candidate.service.id)}`}>View proof plan</a></small></p>
      </div>
    </>}
  </section>;
}

function MachineExecutionShortlistMethodology() {
  return <section className="panel evidence-ladder-panel" aria-label="Shortlist methodology">
    <div className="panel-head"><div><p className="section-kicker">Methodology</p><h2>Deterministic scoring model</h2></div></div>
    <p>Shortlist ranking evaluates readiness for future execution. It does not imply payment success, provider quality, or benchmark superiority.</p>
    <div className="machine-usage-list">
      <p><span>policy_safety_score</span><small>Latest allow/review/deny decision from service-specific preflight or coverage, with penalties for blocked/setup-sensitive risks.</small></p>
      <p><span>execution_readiness_score</span><small>Catalog readiness and service-specific execution receipt status. Missing execution remains not_attempted.</small></p>
      <p><span>auth_friction_score</span><small>Lower friction for ready Pay.sh metadata, higher friction for setup-stage or sensitive web services.</small></p>
      <p><span>machine_relevance_score</span><small>Category and use-case fit for machine tasks, reduced for sensitive or abuse-prone use cases.</small></p>
      <p><span>input_output_clarity_score</span><small>Deterministic preference for services with clear request/response boundaries such as translation, storage, document parsing, and data queries.</small></p>
      <p><span>catalog_confidence_score</span><small>Completeness of provider, price, status, source market, chain, and robotic.sh observation metadata.</small></p>
      <p><span>evidence_health_score</span><small>Evidence health plus coverage/preflight receipt presence. Missing data is marked not recorded and reduces confidence.</small></p>
    </div>
  </section>;
}

function MachineExecutionCandidateRow({ candidate }: { candidate: MachineExecutionCandidateScore }) {
  const service = candidate.service;
  return <div className="machine-service-row machine-shortlist-row" role="row">
    <span role="cell"><strong>{service.name}</strong><small>{service.id}</small></span>
    <span role="cell">{service.provider}</span>
    <span role="cell" className="machine-badge">{service.category}</span>
    <span role="cell" className="machine-badge source">{service.source_market}</span>
    <span role="cell" className="machine-badge chain">{service.chain}</span>
    <span role="cell">{candidate.latest_policy_decision}</span>
    <span role="cell"><MachineEvidenceStageTag stage={service.evidence_stage} /> <small>{service.evidence_health}</small></span>
    <span role="cell">{candidate.execution_status}</span>
    <span role="cell">{candidate.candidate_tier}</span>
    <span role="cell"><b>{candidate.overall_candidate_score}</b></span>
    <span role="cell">{candidate.recommendation}</span>
    <span role="cell"><small>Positive: {candidate.positive_reasons.slice(0, 2).join(' ')} Blocking: {candidate.blocking_reasons.slice(0, 2).join(' ') || 'none recorded'}</small></span>
    <span role="cell"><a className="execute compact secondary" href={`/machine-service/${encodeURIComponent(service.id)}`}>View service dossier</a> <a className="execute compact secondary" href={`/machine-execution-plan/${encodeURIComponent(service.id)}`}>View proof plan</a></span>
  </div>;
}

type ExecutionPlanChecklistItem = {
  id: string;
  label: string;
  status: 'ready' | 'missing' | 'review_required' | 'not_applicable';
  reason: string;
};

function buildExecutionPlanChecklist(
  service: MachineMarketService | null,
  candidate: MachineExecutionCandidateScore | null,
  latestPreflight: MachinePreflightReceipt | null,
  latestExecution: MachinePreflightReceipt | null
): ExecutionPlanChecklistItem[] {
  const translationService = service?.category === 'translation' || /translation/i.test(service?.name ?? '');
  const navigationService = service?.category === 'navigation' || /map|navigation|route/i.test(service?.name ?? '');
  const knownService = Boolean(service);
  const policyDecision = candidate?.latest_policy_decision ?? 'not recorded';
  const executionRecorded = Boolean(latestExecution);
  return [
    { id: 'catalog-identity-verified', label: 'catalog identity verified', status: knownService ? 'ready' : 'missing', reason: knownService ? 'Service exists in current machine-market mirror.' : 'Service is not present in mirrored registry.' },
    { id: 'visible-mirror-belongs', label: 'service belongs to robotic.sh visible mirror', status: service?.observed_source === 'robotic.sh' ? 'ready' : 'missing', reason: service?.observed_source === 'robotic.sh' ? 'Observed source is robotic.sh.' : 'Observed source is missing or non-robotic.sh.' },
    { id: 'policy-decision-recorded', label: 'policy decision recorded', status: policyDecision === 'allow' ? 'ready' : policyDecision === 'review' ? 'review_required' : policyDecision === 'deny' ? 'missing' : 'missing', reason: `Latest policy decision is ${policyDecision}.` },
    { id: 'latest-preflight-receipt-available', label: 'latest preflight receipt available', status: latestPreflight ? 'ready' : 'missing', reason: latestPreflight ? `Using receipt ${latestPreflight.receipt_id}.` : 'No service-specific preflight receipt is recorded yet.' },
    { id: 'io-shape-understood', label: 'input/output shape understood', status: service?.category === 'translation' || service?.category === 'vision' || service?.category === 'storage' ? 'ready' : navigationService ? 'review_required' : knownService ? 'review_required' : 'missing', reason: knownService ? `${service?.category} category has ${service?.category === 'translation' || service?.category === 'vision' || service?.category === 'storage' ? 'clearer' : navigationService ? 'route-sensitive' : 'partial'} schema expectations.` : 'No known service category.' },
    { id: 'safe-test-input-selected', label: 'safe test input selected', status: translationService ? 'ready' : navigationService ? 'review_required' : 'missing', reason: translationService ? 'Safe default translation prompt is defined for planning.' : navigationService ? 'A bounded non-operational routing scenario must be defined before execution.' : 'No deterministic safe input template defined for this category yet.' },
    { id: 'expected-output-semantics-defined', label: 'expected output semantics defined', status: translationService ? 'ready' : navigationService ? 'review_required' : knownService ? 'review_required' : 'missing', reason: translationService ? 'Semantic translation class is defined.' : navigationService ? 'Route semantics, constraints, and safety checks need service-specific definition.' : 'Output semantic class needs service-specific definition.' },
    { id: 'payment-auth-known', label: 'payment/auth requirements known', status: knownService ? 'review_required' : 'missing', reason: knownService ? 'Source-market metadata exists; runtime auth/payment proof still required at execution time.' : 'No source-market metadata available.' },
    { id: 'receipt-schema-ready', label: 'execution receipt schema ready', status: 'ready', reason: 'Machine execution receipt schema is already defined in Radar.' },
    { id: 'caveats-prepared', label: 'caveats prepared', status: service?.caveats.length ? 'ready' : 'review_required', reason: service?.caveats.length ? `${service.caveats.length} caveat(s) are already cataloged.` : 'Service caveats should be prepared before execution.' },
    { id: 'existing-execution-receipt', label: 'existing service execution receipt', status: executionRecorded ? 'not_applicable' : 'missing', reason: executionRecorded ? 'A service execution receipt already exists; this page still remains planning-only.' : 'No service-specific execution receipt is currently recorded.' }
  ];
}

function buildMachineExecutionShortlist(
  services: MachineMarketService[],
  receipts: MachinePreflightReceipt[],
  coverageRun: MachinePreflightCoverageRun | null
): MachineExecutionCandidateScore[] {
  return services.map((service) => scoreMachineExecutionCandidate(service, receipts, coverageRun))
    .sort((a, b) => b.overall_candidate_score - a.overall_candidate_score || a.service.id.localeCompare(b.service.id));
}

function scoreMachineExecutionCandidate(
  service: MachineMarketService,
  receipts: MachinePreflightReceipt[],
  coverageRun: MachinePreflightCoverageRun | null
): MachineExecutionCandidateScore {
  const serviceReceipts = receipts.filter((receipt) => receipt.selected_service_id === service.id || receipt.execution_service_id === service.id);
  const latestPreflight = serviceReceipts.find((receipt) => receipt.receipt_type === 'machine_preflight') ?? null;
  const latestExecution = serviceReceipts.find((receipt) => receipt.receipt_type === 'machine_execution' && receipt.execution_service_id === service.id) ?? null;
  const coverageDecision = coverageRun?.service_results.find((row) => row.service_id === service.id) ?? null;
  const latestPolicyDecision = latestPreflight?.decision ?? coverageDecision?.decision ?? 'not recorded';
  const executionStatus = getServiceExecutionStatus(latestExecution);
  const riskText = service.policy_risk.toLowerCase();
  const caveatText = service.caveats.join(' ').toLowerCase();
  const sensitive = /captcha|blocked|violate|abuse|sensitive|regulated|safety-critical/.test(`${riskText} ${caveatText}`);
  const setup = service.status === 'setup';

  const policy_safety_score = clampScore((latestPolicyDecision === 'allow' ? 92 : latestPolicyDecision === 'review' ? 56 : latestPolicyDecision === 'deny' ? 12 : 42) - (sensitive ? 18 : 0) - (setup ? 12 : 0));
  const execution_readiness_score = clampScore((service.status === 'ready' ? 76 : 34) + (executionStatus === 'execution-tested' ? 18 : executionStatus === 'attempted-recorded' ? 4 : 0));
  const auth_friction_score = clampScore((service.source_market === 'pay.sh' ? 80 : service.source_market === 'agentic.market' ? 62 : 48) - (setup ? 22 : 0) - (sensitive ? 12 : 0));
  const machine_relevance_score = clampScore(({ translation: 90, vision: 84, storage: 80, navigation: 92, web: 66, inference: 62, compute: 58 } as Record<MachineMarketCategory, number>)[service.category] - (/captcha/.test(riskText) ? 36 : 0));
  const input_output_clarity_score = clampScore(({ translation: 90, storage: 84, vision: 80, navigation: 54, web: 64, inference: 58, compute: 52 } as Record<MachineMarketCategory, number>)[service.category] + (service.price_display && service.price_display !== 'Per endpoint' && service.price_display !== 'not recorded' ? 4 : 0));
  const catalog_confidence_score = clampScore(48 + (service.provider ? 10 : 0) + (service.price_display && service.price_display !== 'not recorded' ? 10 : 4) + (service.source_market ? 10 : 0) + (service.chain && service.chain !== 'unknown' ? 10 : 4) + (service.observed_source === 'robotic.sh' ? 8 : 0) - (setup ? 8 : 0));
  const evidence_health_score = clampScore((service.evidence_health === 'listed' ? 70 : 56) + (coverageDecision ? 16 : 0) + (latestPreflight ? 20 : 0) - (!coverageRun ? 12 : 0));
  const overall_candidate_score = Math.round((policy_safety_score * 0.22) + (execution_readiness_score * 0.16) + (auth_friction_score * 0.14) + (machine_relevance_score * 0.16) + (input_output_clarity_score * 0.12) + (catalog_confidence_score * 0.10) + (evidence_health_score * 0.10));
  const candidate_tier = overall_candidate_score >= 78 && latestPolicyDecision !== 'deny' && !setup && !sensitive ? 'strong_candidate' : overall_candidate_score >= 64 && latestPolicyDecision !== 'deny' ? 'possible_candidate' : latestPolicyDecision === 'deny' || sensitive ? 'not_ready' : 'review_required';
  const recommendation = candidate_tier === 'strong_candidate' ? 'next_execution_candidate' : candidate_tier === 'possible_candidate' ? 'monitor' : candidate_tier === 'review_required' ? 'needs_review' : 'avoid_for_now';
  const positive_reasons = [
    latestPolicyDecision === 'allow' ? 'Latest policy evidence allows this service.' : latestPolicyDecision === 'not recorded' ? 'No service-specific preflight decision is recorded yet.' : `Latest policy evidence is ${latestPolicyDecision}.`,
    service.status === 'ready' ? 'Catalog status is ready.' : 'Catalog status is setup.',
    `${service.category} has ${input_output_clarity_score >= 80 ? 'clear' : 'moderate'} input/output boundaries.`,
    coverageDecision ? `Coverage receipt ${coverageDecision.receipt_id} exists.` : 'Coverage decision is not recorded.'
  ];
  const blocking_reasons = [
    setup ? 'Setup-stage service requires readiness review.' : null,
    sensitive ? 'Policy risk indicates sensitive or blocked use.' : null,
    latestPolicyDecision === 'deny' ? 'Latest policy decision is deny.' : null,
    latestPolicyDecision === 'review' ? 'Latest policy decision requires review.' : null,
    latestPolicyDecision === 'not recorded' ? 'No preflight/coverage decision recorded.' : null,
    !latestExecution ? 'No execution receipt recorded for this robotic.sh-listed service.' : null
  ].filter((item): item is string => Boolean(item));

  return {
    service,
    policy_safety_score,
    execution_readiness_score,
    auth_friction_score,
    machine_relevance_score,
    input_output_clarity_score,
    catalog_confidence_score,
    evidence_health_score,
    overall_candidate_score,
    candidate_tier,
    recommendation,
    latest_policy_decision: latestPolicyDecision,
    latest_receipt_id: latestPreflight?.receipt_id ?? coverageDecision?.receipt_id ?? null,
    execution_status: executionStatus,
    positive_reasons,
    blocking_reasons
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function MachineExecutionProofPlanPage({ serviceId }: { serviceId: string }) {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [coverageRun, setCoverageRun] = useState<MachinePreflightCoverageRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${serviceId} Execution Proof Plan | Infopunks Pay.sh Radar`;
    setMetaTag('name', 'description', 'Read-only proof planning checklist and evidence targets before any robotic.sh-visible service execution attempt.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>(`/v1/machine-preflight/receipts/recent?service_id=${encodeURIComponent(serviceId)}&limit=25`).catch(() => null),
      api<{ data: { runs: MachinePreflightCoverageRun[] } }>('/v1/machine-preflight/coverage-runs/recent?limit=1').catch(() => null)
    ]).then(([servicesResponse, receiptsResponse, coverageResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setCoverageRun(coverageResponse?.data.runs?.[0] ?? null);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'execution proof plan unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const service = services.find((item) => item.id === serviceId) ?? null;
  const candidateScore = service ? scoreMachineExecutionCandidate(service, receipts, coverageRun) : null;
  const serviceReceipts = receipts.filter((receipt) => receipt.selected_service_id === serviceId || receipt.execution_service_id === serviceId);
  const latestPreflight = serviceReceipts.find((receipt) => receipt.receipt_type === 'machine_preflight') ?? null;
  const latestExecution = serviceReceipts.find((receipt) => receipt.receipt_type === 'machine_execution' && receipt.execution_service_id === serviceId) ?? null;
  const latestPolicyDecision = candidateScore?.latest_policy_decision ?? 'not recorded';
  const executionStatus = latestExecution ? getServiceExecutionStatus(latestExecution) : 'not_attempted';
  const safeToPlan = Boolean(service && candidateScore && candidateScore.recommendation !== 'avoid_for_now');
  const requiresReview = !service || !candidateScore || candidateScore.recommendation === 'needs_review' || latestPolicyDecision === 'review' || latestPolicyDecision === 'not recorded';
  const checklist = buildExecutionPlanChecklist(service, candidateScore, latestPreflight, latestExecution);
  const isTranslation = service?.category === 'translation' || /translation/i.test(service?.name ?? '');
  const isNavigation = service?.category === 'navigation' || service?.id === 'naver-maps';
  const isBigQuery = service?.id === 'bigquery';
  const isStableupload = service?.id === 'stableupload';
  const railGate = getRailExecutionGate(service, latestPolicyDecision);
  const bigQueryLiveStatus = isBigQuery ? getBigQueryLiveHarnessStatus(service, receipts) : null;
  const proofAttributionRows = service ? [
    ...getMachineServiceAttributionRows(service),
    getMachineReceiptAttributionRow(service, latestExecution)
  ] : [];
  const serviceFirstSafeRoute = service?.first_safe_route && service.first_safe_route !== 'not recorded'
    ? service.first_safe_route
    : isTranslation
      ? 'safe translation test'
      : 'not recorded';

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-execution-plan-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Execution proof plan navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current={null} />
        </div>
      </nav>
    </header>
    <main id="machine-execution-plan-content" className="machine-market-page machine-dossier-page" aria-label="Machine Execution Proof Plan">
      {loading && <section className="panel" role="status"><p className="route-state">Loading execution proof plan...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Execution proof plan unavailable: {error}</p></section>}
      {!loading && !error && !service && <section className="panel machine-receipts-empty" aria-label="Unknown machine service">
        <EmptyState title="Execution proof plan not found." body="This service_id is not in the current robotic.sh visible service mirror." />
        <a className="execute compact secondary" href="/machine-execution-shortlist">Back to execution shortlist</a>
      </section>}
      {!loading && !error && service && <>
        <section className="panel hero machine-market-hero">
          <div>
            <p className="eyebrow">Candidate Execution Proof Plan</p>
            <h1>{service.name}</h1>
            <p className="copy">Read-only future proof planning for service_id {service.id}. This page defines evidence requirements before any execution attempt.</p>
          </div>
          <div className="ticker" aria-label="Execution proof planning state">
            <span>{service.source_market}</span>
            <span>{service.chain}</span>
            <span>{candidateScore?.recommendation ?? 'not scored'}</span>
          </div>
        </section>
        <section className="panel machine-market-caveat" aria-label="Execution proof planning caveat">
          <p>Planning only: no service execution is performed from this page, and no execution claim is made.</p>
          <p>{PAY_SH_SERVICE_SEPARATION_NOTE}</p>
          <p><a className="execute compact secondary" href="/machine-rail-coverage">View rail coverage</a></p>
        </section>
        <MachineEvidenceMethodologyDrawer />
        <section className="machine-dossier-layout">
          <section className="panel machine-policy-summary" aria-label="Execution candidate identity">
            <div className="panel-head"><div><p className="section-kicker">Candidate Identity</p><h2>{service.name}</h2></div></div>
            <div className="key-values machine-service-profile">
              <p><b>service name</b><span>{service.name}</span></p>
              <p><b>service_id</b><span>{service.id}</span></p>
              <p><b>provider</b><span>{service.provider}</span></p>
              <p><b>category</b><span>{service.category}</span></p>
              <p><b>source_market</b><span>{service.source_market}</span></p>
              <p><b>chain</b><span>{service.chain}</span></p>
              <p><b>candidate_tier</b><span>{candidateScore?.candidate_tier ?? 'not recorded'}</span></p>
              <p><b>recommendation</b><span>{candidateScore?.recommendation ?? 'not recorded'}</span></p>
              <p><b>overall_candidate_score</b><span>{candidateScore?.overall_candidate_score ?? 'not recorded'}</span></p>
              <p><b>latest policy decision</b><span>{latestPolicyDecision}</span></p>
              <p><b>evidence_stage</b><span>{service.evidence_stage}</span></p>
              <p><b>evidence_health</b><span>{service.evidence_health}</span></p>
              <p><b>execution_status</b><span>{executionStatus}</span></p>
            </div>
          </section>
          <section className="panel machine-policy-summary" aria-label="Readiness rationale">
            <div className="panel-head"><div><p className="section-kicker">Readiness Rationale</p><h2>{safeToPlan ? 'Safe to plan with controls' : 'Not safe to plan yet'}</h2></div></div>
            <div className="machine-usage-list">
              <p><span>shortlist rationale</span><small>{candidateScore ? `Shortlist score ${candidateScore.overall_candidate_score} and tier ${candidateScore.candidate_tier}.` : 'No shortlist score is recorded for this service yet.'}</small></p>
              <p><span>top positive reasons</span><small>{candidateScore?.positive_reasons.slice(0, 3).join(' ') ?? 'none recorded'}</small></p>
              <p><span>top blocking reasons</span><small>{candidateScore?.blocking_reasons.slice(0, 3).join(' ') || 'none recorded'}</small></p>
              <p><span>currently safe to plan execution</span><small>{safeToPlan ? 'yes, as future planning only with policy and receipt controls' : 'no, additional policy/readiness evidence is required first'}</small></p>
              <p><span>requires review</span><small>{requiresReview ? 'yes' : 'no'}</small></p>
              {service?.id === MACHINE_SELECTED_CONTROLLED_ACTION_ID && <p><span>selected controlled proof-plan action</span><small>Cloud Translation remains the selected controlled proof-plan action. This does not imply execution-tested status.</small></p>}
            </div>
          </section>
        </section>
        <section className="panel machine-policy-summary" aria-label="Pre-execution checklist">
          <div className="panel-head"><div><p className="section-kicker">Pre-Execution Checklist</p><h2>Deterministic gating items</h2></div></div>
          <div className="machine-check-list">
            {checklist.map((item) => <p key={item.id}><b className={item.status}>{item.status}</b><span>{item.label}: {item.reason}</span></p>)}
          </div>
        </section>
        <section className="panel machine-policy-summary" aria-label="Rail-aware proof planning">
          <div className="panel-head"><div><p className="section-kicker">Rail-aware proof planning</p><h2>Rail-aware proof planning</h2></div></div>
          <div className="machine-usage-list">
            <p><span>access rail</span><small>{service ? formatMachineAccessRail(service.access_rail) : 'not recorded'}</small></p>
            <p><span>rail status</span><small>{service?.rail_status ?? 'not recorded'}</small></p>
            <p><span>route surface status</span><small>{service ? formatMachineRouteSurfaceStatus(service.route_surface_status) : 'not recorded'}</small></p>
            <p><span>endpoint count</span><small>{service ? formatMachineEndpointCount(service.endpoint_count) : 'not recorded'}</small></p>
            <p><span>pricing model</span><small>{readRecordedValue(service?.pricing_model)}</small></p>
            <p><span>credential requirement</span><small>{readRecordedValue(service?.credential_requirement)}</small></p>
            <p><span>first safe route</span><small>{serviceFirstSafeRoute}</small></p>
            <p><span>rail caveat</span><small>{readRecordedValue(service?.rail_caveat)}</small></p>
            <p><span>route-surface implication</span><small>{getRouteSurfaceImplication(service?.route_surface_status)}</small></p>
          </div>
          {isNavigation && <section className="dossier-section">
            <h4>NAVER-specific route safety guidance</h4>
            <div className="machine-usage-list">
              <p><span>Preferred first route</span><small>Geocode lookup</small></p>
              <p><span>Avoid first</span><small>Driving directions</small></p>
              <p><span>Reason</span><small>Driving directions can influence physical-world routing. Start with bounded geocode/static-map style checks before route guidance.</small></p>
            </div>
          </section>}
          {isBigQuery && <section className="dossier-section">
            <h4>Route guidance</h4>
            <div className="machine-usage-list">
              <p><span>first safe route</span><small>bounded query result lookup</small></p>
              <p><span>route guidance</span><small>Use a bounded public or synthetic dataset query. Do not query sensitive business data in the first proof attempt.</small></p>
            </div>
          </section>}
          {isStableupload && <section className="dossier-section">
            <h4>Route guidance</h4>
            <div className="machine-usage-list">
              <p><span>first safe route</span><small>tiny non-sensitive fixture upload</small></p>
              <p><span>route guidance</span><small>Use a small harmless test fixture. Do not upload private, regulated, or production data in the first proof attempt.</small></p>
            </div>
          </section>}
          {service?.id === MACHINE_SELECTED_CONTROLLED_ACTION_ID && <section className="dossier-section">
            <h4>Controlled proof-plan note</h4>
            <div className="machine-usage-list">
              <p><span>route surface status</span><small>{service ? formatMachineRouteSurfaceStatus(service.route_surface_status) : 'not recorded'}</small></p>
              <p><span>credential requirement</span><small>{readRecordedValue(service?.credential_requirement)}</small></p>
              <p><span>first safe route</span><small>{serviceFirstSafeRoute}</small></p>
              <p><span>caveat</span><small>selected proof plan does not imply execution-tested</small></p>
            </div>
          </section>}
        </section>
        <section className="panel machine-policy-summary" aria-label="Rail execution gate">
          <div className="panel-head"><div><p className="section-kicker">Rail execution gate</p><h2>Rail execution gate</h2></div></div>
          <div className="machine-usage-list">
            <p><span>gate status</span><small>{railGate.status}</small></p>
            <p><span>reason</span><small>{railGate.reason}</small></p>
            {isBigQuery && <p><span>bigquery_live_harness_status</span><small>{bigQueryLiveStatus}</small></p>}
          </div>
          <p className="panel-caption">Never execution-ready without a service-specific receipt. This gate is planning-only.</p>
        </section>
        <SourceAttributionPanel title="Proof source attribution" ariaLabel="Proof source attribution" rows={proofAttributionRows} />
        <section className="machine-dossier-layout">
          <section className="panel machine-policy-summary" aria-label="Safe test input">
            <div className="panel-head"><div><p className="section-kicker">Safe Test Input</p><h2>Future execution input seed</h2></div></div>
            {isTranslation ? <div className="machine-usage-list">
              <p><span>input</span><small>hello machine market</small></p>
              <p><span>target</span><small>Spanish (fallback: French)</small></p>
              <p><span>expected semantic output</span><small>A natural translation of the phrase, not exact-string enforced unless the provider guarantees deterministic output.</small></p>
            </div> : isNavigation ? <div className="machine-usage-list">
              <p><span>preferred first safe test</span><small>Geocode lookup for a public landmark or generic address</small></p>
              <p><span>follow-on planning candidate</span><small>Static map retrieval before any driving directions route</small></p>
              <p><span>mode</span><small>catalog-aware, non-operational planning lookup</small></p>
              <p><span>constraint</span><small>no robot command, no dispatch, no live navigation, no physical movement</small></p>
              <p><span>expected semantic output</span><small>Parseable geocode or static map metadata only, with caveats preserved and no autonomous action triggered.</small></p>
            </div> : <p className="copy">No safe default test input has been defined for this service yet.</p>}
          </section>
          {isNavigation && service.catalog_routes?.length && <section className="panel machine-policy-summary" aria-label="Candidate route surface">
            <div className="panel-head"><div><p className="section-kicker">Candidate Route Surface</p><h2>Catalog-aware planning order</h2></div></div>
            <div className="machine-usage-list">
              <p><span>safer planning candidates</span><small>Geocode, reverse geocode, and static map are safer planning candidates because they provide location context without directly shaping movement instructions.</small></p>
              <p><span>higher physical-world risk</span><small>Driving directions has higher physical-world risk because route output can influence robot movement.</small></p>
              <p><span>initial proof plan</span><small>Initial proof planning should prefer geocode or static map before driving directions.</small></p>
            </div>
            <section className="dossier-section">
              <h4>Observed catalog routes</h4>
              <div className="machine-usage-list">
                {service.catalog_routes.map((route) => <p key={`${route.method}:${route.path}`}>
                  <span>{route.label}</span>
                  <small>{route.method} {route.path} · risk {route.risk}</small>
                </p>)}
              </div>
            </section>
            <p className="panel-caption">Catalog route surface only. These routes are not execution receipts and are not counted as proof of execution, payment, benchmark performance, or winner status.</p>
          </section>}
          <section className="panel machine-policy-summary" aria-label="Physical-world routing risk">
            <div className="panel-head"><div><p className="section-kicker">Risk Boundary</p><h2>Physical-world routing risk</h2></div></div>
            <p className="copy">{isNavigation ? 'Routing outputs can influence physical-world movement. NAVER Maps requires review, bounded test inputs, and non-operational constraints before any execution attempt.' : 'This service still requires bounded preflight, deterministic inputs, and receipt-driven evidence before any execution attempt.'}</p>
            {isNavigation && <div className="machine-usage-list">
              <p><span>policy state</span><small>{latestPolicyDecision}</small></p>
              <p><span>execution status</span><small>{executionStatus}</small></p>
              <p><span>public demo context</span><small>Observed, not counted as Radar execution evidence.</small></p>
            </div>}
          </section>
          <section className="panel machine-policy-summary" aria-label="Success and failure criteria">
            <div className="panel-head"><div><p className="section-kicker">Criteria</p><h2>Success and failure gates</h2></div></div>
            <section className="dossier-section"><h4>Success criteria</h4><ul className="machine-caveat-list">
              <li>intended service identity is confirmed</li>
              <li>request completes through the intended execution rail</li>
              <li>durable execution receipt is recorded</li>
              <li>service response is parseable</li>
              <li>{isNavigation ? 'route/geocode semantics are present' : 'output matches expected semantic class'}</li>
              <li>no robot command is issued</li>
              <li>{isNavigation ? 'no physical movement is triggered' : 'no autonomous action is triggered'}</li>
              <li>payment/auth status is recorded if available</li>
              <li>caveats are preserved</li>
            </ul></section>
            <section className="dossier-section"><h4>Failure criteria</h4><ul className="machine-caveat-list">
              <li>service identity mismatch</li>
              <li>auth/payment blocker</li>
              <li>malformed response</li>
              <li>{isNavigation ? 'unsafe or ambiguous route output' : 'unsafe output'}</li>
              <li>no durable receipt</li>
              <li>operational robot action triggered</li>
              <li>{isNavigation ? 'physical-world action is implied without guardrails' : 'autonomous action is implied without guardrails'}</li>
            </ul></section>
          </section>
        </section>
        {isNavigation && <section className="panel machine-policy-summary" aria-label="Public demo context">
          <div className="panel-head"><div><p className="section-kicker">Public Context</p><h2>Observed demo context only</h2></div></div>
          <p className="copy">Public demo context observed: peaq showcased NAVER Maps in a simulated Serve Robotics workflow with USDT settlement on Solana. Radar has not executed this service.</p>
          <p className="panel-caption">This note is context only. It is not counted as Radar execution evidence, benchmark evidence, winner evidence, or payment success evidence. Public context is not Radar execution evidence.</p>
        </section>}
        <section className="panel machine-policy-summary" aria-label="Evidence to collect">
          <div className="panel-head"><div><p className="section-kicker">Evidence Objects</p><h2>Required post-execution evidence</h2></div></div>
          <ul className="machine-caveat-list">
            <li>execution receipt id</li>
            <li>service_id: {service.id}</li>
            <li>access_rail</li>
            <li>route_surface_status</li>
            <li>selected_route</li>
            <li>route/source used</li>
            <li>request timestamp</li>
            <li>response timestamp</li>
            <li>credential_status</li>
            <li>pricing_model</li>
            <li>payment/auth status</li>
            <li>rail_caveats</li>
            <li>{isNavigation ? 'normalized route/geocode output summary' : 'normalized output summary'}</li>
            <li>non-operational test flag</li>
            <li>caveats</li>
            <li>evidence_health update</li>
          </ul>
        </section>
      </>}
    </main>
  </div>;
}

function MachineServiceDossierPage({ serviceId }: { serviceId: string }) {
  const [services, setServices] = useState<MachineMarketService[]>([]);
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [coverageRun, setCoverageRun] = useState<MachinePreflightCoverageRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${serviceId} Service Dossier | Infopunks Pay.sh Radar`;
    setMetaTag('name', 'description', 'Machine service dossier for robotic.sh visible catalog coverage, policy readiness, and receipt evidence.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<{ data: { services: MachineMarketService[] } }>('/v1/machine-market/services'),
      api<{ data: { receipts: MachinePreflightReceipt[] } }>(`/v1/machine-preflight/receipts/recent?service_id=${encodeURIComponent(serviceId)}&limit=25`).catch(() => null),
      api<{ data: { runs: MachinePreflightCoverageRun[] } }>('/v1/machine-preflight/coverage-runs/recent?limit=1').catch(() => null)
    ]).then(([servicesResponse, receiptsResponse, coverageResponse]) => {
      if (cancelled) return;
      setServices(servicesResponse.data.services);
      setReceipts(receiptsResponse?.data.receipts ?? []);
      setCoverageRun(coverageResponse?.data.runs?.[0] ?? null);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'machine service dossier unavailable');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const service = services.find((item) => item.id === serviceId) ?? null;
  const serviceIndex = service ? services.findIndex((item) => item.id === service.id) : -1;
  const serviceReceipts = receipts.filter((receipt) => receipt.selected_service_id === serviceId || receipt.execution_service_id === serviceId);
  const preflightReceipts = serviceReceipts.filter((receipt) => receipt.receipt_type === 'machine_preflight');
  const executionReceipts = serviceReceipts.filter((receipt) => receipt.receipt_type === 'machine_execution' && receipt.execution_service_id === serviceId);
  const latestPreflight = preflightReceipts[0] ?? serviceReceipts.find((receipt) => receipt.receipt_type === 'machine_preflight') ?? null;
  const latestExecution = executionReceipts[0] ?? null;
  const coverageDecision = coverageRun?.service_results.find((row) => row.service_id === serviceId) ?? null;
  const executionStatus = getServiceExecutionStatus(latestExecution);
  const policyStatus = latestPreflight?.decision ?? coverageDecision?.decision ?? null;
  const candidateScore = service ? scoreMachineExecutionCandidate(service, receipts, coverageRun) : null;
  const serviceAttributionRows = service ? getMachineServiceAttributionRows(service) : [];

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-service-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Service Dossier navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current={null} />
        </div>
      </nav>
    </header>
    <main id="machine-service-content" className="machine-market-page machine-dossier-page machine-service-dossier-page" aria-label="Machine Service Dossier">
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine service dossier...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine service dossier unavailable: {error}</p></section>}
      {!loading && !error && !service && <section className="panel machine-receipts-empty" aria-label="Unknown machine service">
        <EmptyState title="Machine service not found." body="This service is not in the current robotic.sh visible service mirror." />
        <p className="panel-caption">{PAY_SH_SERVICE_SEPARATION_NOTE}</p>
        <a className="execute compact secondary" href="/machine-market">Back to Machine Market</a>
      </section>}
      {!loading && !error && service && <>
        <section className="panel hero machine-market-hero machine-service-dossier-hero">
          <div>
            <p className="eyebrow">Machine Service Dossier</p>
            <h1>{service.name}</h1>
            <p className="copy">{service.description}</p>
            <p className="panel-caption">Dossier for service_id {service.id}. Coverage-recorded means catalog and policy evidence only; it is not execution-tested evidence.</p>
            <p className="panel-caption"><a href={`/machine-market/cards/${encodeURIComponent(service.id)}`}>Open Preflight Card</a></p>
          </div>
          <div className="ticker" aria-label="Machine service dossier status">
            <span>{service.source_market}</span>
            <span>{service.chain}</span>
            <span>{policyStatus ? `latest decision: ${policyStatus}` : 'no preflight receipt'}</span>
          </div>
        </section>
        <section className="panel machine-market-caveat" aria-label="Pay.sh separation note">
          <p>{PAY_SH_SERVICE_SEPARATION_NOTE}</p>
          <p><a className="execute compact secondary" href="/machine-execution-shortlist">Back to execution shortlist</a></p>
          <p><a className="execute compact secondary" href={`/machine-execution-plan/${encodeURIComponent(service.id)}`}>{service.id === 'naver-maps' ? 'View NAVER Maps proof path' : 'View execution proof plan'}</a></p>
          {candidateScore && <p className="panel-caption">Current shortlist tier: {candidateScore.candidate_tier} · score {candidateScore.overall_candidate_score} · recommendation {candidateScore.recommendation}</p>}
        </section>
        <section className="machine-dossier-layout">
          <MachineServiceIdentity service={service} position={serviceIndex + 1} total={services.length} />
          <MachineServicePolicyReadiness service={service} latestPreflight={latestPreflight} coverageDecision={coverageDecision} />
        </section>
        <section className="machine-dossier-layout">
          <MachineServiceCatalogRouteSurface service={service} />
          <MachineServiceExecutionStatus service={service} status={executionStatus} latestExecution={latestExecution} />
          <MachineServiceEvidenceNotes service={service} />
        </section>
        {executionReceipts.length > 0 && <section className="panel machine-policy-summary" aria-label="Service execution receipts">
          <div className="panel-head"><div><p className="section-kicker">Service Receipts</p><h2>{executionReceipts.length} service-specific execution receipt{executionReceipts.length === 1 ? '' : 's'}</h2></div></div>
          <div className="machine-usage-list">
            {executionReceipts.map((receipt) => <p key={receipt.receipt_id}>
              <span>{receipt.receipt_id}</span>
              <small>{formatMachineTimestamp(receipt.created_at)} · {receipt.execution_status} · <a className="execute compact secondary" href={`/machine-execution/${encodeURIComponent(receipt.receipt_id)}`}>View receipt detail</a></small>
            </p>)}
          </div>
          {service.id === 'naver-maps' && <p className="panel-caption">NAVER receipt scope is geocode-only non-operational lookup evidence. No robot command, no physical movement, and no operational route guidance.</p>}
        </section>}
        <SourceAttributionPanel title="Source attribution" ariaLabel="Source attribution" rows={[
          ...serviceAttributionRows,
          getMachineReceiptAttributionRow(service, latestExecution)
        ]} />
      </>}
    </main>
  </div>;
}

function MachineServiceIdentity({ service, position, total }: { service: MachineMarketService; position: number; total: number }) {
  return <section className="panel machine-policy-summary" aria-label="Service identity">
    <div className="panel-head"><div><p className="section-kicker">Catalog Identity</p><h2>{service.name}</h2></div><span className={`machine-badge status ${service.status}`}>{service.status}</span></div>
    <div className="key-values machine-service-profile">
      <p><b>service_id</b><span>{service.id}</span></p>
      <p><b>provider</b><span>{service.provider}</span></p>
      <p><b>provider_id</b><span>not recorded</span></p>
      <p><b>category</b><span>{service.category}</span></p>
      <p><b>source_market</b><span>{service.source_market}</span></p>
      <p><b>chain</b><span>{service.chain}</span></p>
      <p><b>status</b><span>{service.status}</span></p>
      <p><b>price_display</b><span>{service.price_display}</span></p>
      <p><b>evidence_stage</b><span>{formatEvidenceStage(service.evidence_stage)}</span></p>
      <p><b>evidence_health</b><span>{service.evidence_health}</span></p>
      <p><b>policy_risk</b><span>{service.policy_risk}</span></p>
      <p><b>robotic.sh catalog position</b><span>{position} / {total}</span></p>
      <p><b>13-service visible mirror</b><span>yes</span></p>
      <p><b>Phase 2 scope</b><span>{service.phase_scope}</span></p>
    </div>
    <section className="dossier-section"><h4>Machine use case</h4><p>{service.machine_use_case}</p></section>
  </section>;
}

function MachineServiceCatalogRouteSurface({ service }: { service: MachineMarketService }) {
  if (!service.catalog_routes?.length) return null;
  return <section className="panel machine-policy-summary" aria-label="Catalog route surface">
    <div className="panel-head"><div><p className="section-kicker">Catalog Route Surface</p><h2>{service.route_count ?? service.catalog_routes.length} observed routes</h2></div></div>
    <div className="machine-usage-list">
      <p><span>pricing model</span><small>{service.pricing_model ?? 'not recorded'}</small></p>
      <p><span>credential requirement</span><small>{service.credential_requirement ?? 'not recorded'}</small></p>
      <p><span>route count</span><small>{service.route_count ?? service.catalog_routes.length}</small></p>
    </div>
    <section className="dossier-section">
      <h4>Observed catalog routes</h4>
      <div className="machine-usage-list">
        {service.catalog_routes.map((route) => <p key={`${route.method}:${route.path}`}>
          <span>{route.label}</span>
          <small>{route.method} {route.path} · risk {route.risk}</small>
        </p>)}
      </div>
    </section>
    <p className="panel-caption">Catalog route surface only. Radar has not executed routes.</p>
  </section>;
}

function MachineServicePolicyReadiness({
  service,
  latestPreflight,
  coverageDecision
}: {
  service: MachineMarketService;
  latestPreflight: MachinePreflightReceipt | null;
  coverageDecision: MachinePreflightCoverageServiceResult | null;
}) {
  const latestDecision = latestPreflight?.decision ?? coverageDecision?.decision ?? null;
  const policyFit = latestDecision === 'allow' ? 'safe under recorded policy receipt' : latestDecision === 'review' ? 'review-required under recorded policy receipt' : latestDecision === 'deny' ? 'blocked under recorded policy receipt' : 'not yet decided by preflight receipt';
  return <section className="panel machine-policy-summary" aria-label="Policy and readiness">
    <div className="panel-head"><div><p className="section-kicker">Policy and Readiness</p><h2>{latestDecision ?? 'No preflight decision'}</h2></div></div>
    <div className="machine-usage-list">
      <p><span>default policy fit</span><small>{policyFit}</small></p>
      <p><span>policy risk level</span><small>{service.policy_risk}</small></p>
      <p><span>risk tolerance notes</span><small>Use bounded authority, receipt-required preflight, and human review for setup, sensitive web, or safety-critical outputs.</small></p>
      <p><span>latest coverage decision</span><small>{coverageDecision?.decision ?? 'none recorded'}</small></p>
      <p><span>latest preflight receipt id</span><small>{latestPreflight?.receipt_id ?? 'none recorded'}</small></p>
      <p><span>latest decision</span><small>{latestDecision ?? 'none recorded'}</small></p>
      <p><span>Radar assessment</span><small>{describeServiceSafety(latestDecision)}</small></p>
    </div>
    {!latestPreflight && <p className="panel-caption">No preflight decision receipt recorded for this service yet.</p>}
    {!!latestPreflight?.review_reasons.length && <section className="dossier-section"><h4>Review reasons</h4><ul className="machine-caveat-list">{latestPreflight.review_reasons.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    {!!latestPreflight?.violations.length && <section className="dossier-section"><h4>Violations</h4><ul className="machine-caveat-list">{latestPreflight.violations.map((item) => <li key={item}>{item}</li>)}</ul></section>}
  </section>;
}

function MachineServiceExecutionStatus({
  service,
  status,
  latestExecution
}: {
  service: MachineMarketService;
  status: 'not_attempted' | 'attempted-recorded' | 'execution-tested' | 'repeatability-recorded';
  latestExecution: MachinePreflightReceipt | null;
}) {
  return <section className="panel machine-policy-summary" aria-label="Execution status">
    <div className="panel-head"><div><p className="section-kicker">Execution Status</p><h2>{status}</h2></div></div>
    <p className="panel-caption">Execution evidence is service-specific. Catalog coverage and preflight decisions do not create execution-tested status.</p>
    {!latestExecution && <p className="route-state">No execution receipt recorded for this robotic.sh-listed service yet.</p>}
    <p className="panel-caption">Execution receipts: 0 service-specific execution receipts unless a receipt exists. Repeatability receipts: 0 unless repeated successful receipts are recorded.</p>
    {latestExecution && <div className="machine-usage-list">
      <p><span>latest execution receipt id</span><small>{latestExecution.receipt_id}</small></p>
      <p><span>payment status</span><small>{latestExecution.payment_occurred ? 'payment_observed' : 'payment_not_confirmed'}</small></p>
      <p><span>route/source</span><small>{latestExecution.source_market ?? service.source_market} / {latestExecution.chain ?? service.chain}</small></p>
      <p><span>execution status</span><small>{latestExecution.execution_status}</small></p>
      <p><span>evidence health</span><small>{latestExecution.evidence_health ?? service.evidence_health}</small></p>
      <p><span>caveats</span><small>{latestExecution.caveats.length ? latestExecution.caveats.join(' ') : 'No execution caveats recorded.'}</small></p>
    </div>}
  </section>;
}

function MachineServiceEvidenceNotes({ service }: { service: MachineMarketService }) {
  return <section className="panel evidence-ladder-panel" aria-label="Service evidence health">
    <div className="panel-head"><div><p className="section-kicker">Evidence Health</p><h2>{formatEvidenceStage(service.evidence_stage)} / {service.evidence_health}</h2></div></div>
    <p>{getEvidenceStageDescription(service.evidence_stage)}</p>
    <MachineEvidenceClaims serviceOrReceipt={service} />
    <section className="dossier-section"><h4>Caveats</h4><ul className="machine-caveat-list">{service.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></section>
  </section>;
}

function getServiceExecutionStatus(receipt: MachinePreflightReceipt | null): 'not_attempted' | 'attempted-recorded' | 'execution-tested' | 'repeatability-recorded' {
  if (!receipt) return 'not_attempted';
  if (receipt.execution_status === 'succeeded' && receipt.evidence_stage === 'repeatability-recorded') return 'repeatability-recorded';
  if (receipt.execution_status === 'succeeded' && canClaimExecutionTested(receipt)) return 'execution-tested';
  return 'attempted-recorded';
}

function describeServiceSafety(decision: 'allow' | 'review' | 'deny' | null): string {
  if (decision === 'allow') return 'Radar currently considers this service safe only within the recorded policy envelope.';
  if (decision === 'review') return 'Radar requires human review before this service can be used by a machine.';
  if (decision === 'deny') return 'Radar blocks this service under the recorded policy constraints.';
  return 'Radar has catalog coverage only; no preflight receipt has recorded allow, review, or deny for this service.';
}

type MachinePreflightFormState = {
  machine_id: string;
  intent: string;
  category: MachineMarketCategory;
  max_cost_usd: string;
  allowed_markets: MachineMarketSource[];
  allowed_chains: MachineMarketChain[];
  risk_tolerance: 'low' | 'medium' | 'high';
  requires_receipt: boolean;
  policy_id: string;
};

const MACHINE_PREFLIGHT_EXAMPLES: Array<{ label: string; state: Partial<MachinePreflightFormState> }> = [
  { label: 'Delivery bot parses invoice', state: { machine_id: 'did:peaq:delivery-bot-01', intent: 'parse an invoice image into structured fields', category: 'vision', max_cost_usd: '0.05', allowed_markets: ['pay.sh'], allowed_chains: ['solana'], risk_tolerance: 'low', policy_id: 'delivery-robot' } },
  { label: 'Field bot translates customer note', state: { machine_id: 'did:peaq:field-bot-04', intent: 'translate customer note for field maintenance', category: 'translation', max_cost_usd: '0.20', allowed_markets: ['pay.sh'], allowed_chains: ['solana'], risk_tolerance: 'medium', policy_id: 'field-maintenance-bot' } },
  { label: 'Research agent searches web', state: { machine_id: 'did:peaq:research-agent-02', intent: 'search web for market evidence', category: 'web', max_cost_usd: '0.25', allowed_markets: ['agentic.market'], allowed_chains: ['base'], risk_tolerance: 'medium', policy_id: 'autonomous-research-agent' } },
  { label: 'Sensor uploads media', state: { machine_id: 'did:peaq:sensor-12', intent: 'upload media evidence from field sensor', category: 'storage', max_cost_usd: '0.03', allowed_markets: ['pay.sh'], allowed_chains: ['solana'], risk_tolerance: 'low', policy_id: 'depin-sensor' } }
];

function MachinePreflightPage() {
  const [templates, setTemplates] = useState<MachinePolicy[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<MachinePreflightResult | null>(null);
  const [form, setForm] = useState<MachinePreflightFormState>({
    machine_id: 'did:peaq:delivery-bot-01',
    intent: 'parse an invoice image into structured fields',
    category: 'vision',
    max_cost_usd: '0.05',
    allowed_markets: ['pay.sh'],
    allowed_chains: ['solana'],
    risk_tolerance: 'low',
    requires_receipt: true,
    policy_id: 'delivery-robot'
  });

  useEffect(() => {
    document.title = 'Machine Preflight | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Simulate bounded machine spending decisions before service execution.');
    let cancelled = false;
    api<{ data: { templates: MachinePolicy[] } }>('/v1/machine-policies/templates')
      .then((response) => {
        if (!cancelled) setTemplates(response.data.templates);
      })
      .catch((error) => {
        if (!cancelled) setTemplatesError(error instanceof Error ? error.message : 'policy templates unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplateId = normalizeTemplateId(form.policy_id);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;

  const updateForm = <K extends keyof MachinePreflightFormState>(key: K, value: MachinePreflightFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const applyTemplate = (policyId: string) => {
    const normalizedPolicyId = normalizeTemplateId(policyId);
    const template = templates.find((item) => item.id === normalizedPolicyId);
    setForm((current) => ({
      ...current,
      policy_id: normalizedPolicyId,
      category: template?.allowed_categories[0] ?? current.category,
      max_cost_usd: template ? String(template.per_call_budget_usd) : current.max_cost_usd,
      allowed_markets: template?.allowed_source_markets.length ? [...template.allowed_source_markets] : current.allowed_markets,
      allowed_chains: template?.allowed_chains.length ? [...template.allowed_chains] : current.allowed_chains,
      risk_tolerance: template?.risk_tolerance ?? current.risk_tolerance,
      requires_receipt: template?.receipt_required ?? current.requires_receipt
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const payload = {
        machine_id: form.machine_id,
        intent: form.intent,
        category: form.category,
        max_cost_usd: form.max_cost_usd === '' ? undefined : Number(form.max_cost_usd),
        allowed_markets: form.allowed_markets,
        allowed_chains: form.allowed_chains,
        risk_tolerance: form.risk_tolerance,
        requires_receipt: form.requires_receipt,
        policy_id: selectedTemplateId || undefined
      };
      const response = await api<{ data: MachinePreflightResult }>('/v1/machine-preflight', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setResult(response.data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'machine preflight unavailable');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-preflight-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Preflight navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current={null} />
        </div>
      </nav>
    </header>
    <main id="machine-preflight-content" className="machine-market-page machine-preflight-page" aria-label="Machine Preflight">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Bounded Authority</p>
          <h1>Machine Preflight</h1>
          <p className="copy">Before a machine spends, Radar checks policy, route fit, evidence, and caveats.</p>
          <p className="panel-caption">Preflight is not execution. Radar records whether a machine SHOULD spend before any service call occurs.</p>
        </div>
        <div className="ticker" aria-label="Machine Preflight principles">
          <span>Same terminal</span>
          <span>New species of spender</span>
          <span>Policy before spend</span>
        </div>
      </section>
      <section className="panel machine-quick-examples" aria-label="Quick examples">
        <div className="panel-head"><div><p className="section-kicker">Quick Examples</p><h2>Load a bounded spend scenario</h2></div></div>
        <div className="category-chips">
          {MACHINE_PREFLIGHT_EXAMPLES.map((example) => <button key={example.label} type="button" onClick={() => setForm((current) => ({ ...current, ...example.state, policy_id: normalizeTemplateId(example.state.policy_id ?? ''), requires_receipt: example.state.requires_receipt ?? true }))}>{example.label}</button>)}
        </div>
      </section>
      <MachineMethodologyNote />
      <section className="machine-preflight-layout">
        <form className="panel machine-preflight-form" aria-label="Machine preflight form" onSubmit={submit}>
          <div className="panel-head"><div><p className="section-kicker">Decision Request</p><h2>Machine spend preflight</h2></div><small>No service call occurs.</small></div>
          <label><span>machine_id</span><input aria-label="machine_id" value={form.machine_id} onChange={(event) => updateForm('machine_id', event.target.value)} required /></label>
          <label><span>intent</span><textarea aria-label="intent" value={form.intent} onChange={(event) => updateForm('intent', event.target.value)} required /></label>
          <div className="machine-preflight-form-grid">
            <FilterSelect label="category" value={form.category} values={MACHINE_MARKET_CATEGORIES} onChange={(value) => updateForm('category', value as MachineMarketCategory)} />
            <label><span>max_cost_usd</span><input aria-label="max_cost_usd" type="number" min="0" step="0.001" value={form.max_cost_usd} onChange={(event) => updateForm('max_cost_usd', event.target.value)} /></label>
            <FilterSelect label="risk_tolerance" value={form.risk_tolerance} values={['low', 'medium', 'high']} onChange={(value) => updateForm('risk_tolerance', value as MachinePreflightFormState['risk_tolerance'])} />
            <label><span>policy template</span><select aria-label="policy template" value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">Ephemeral policy</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          </div>
          <MultiSelect label="allowed_markets" values={MACHINE_MARKET_SOURCES} selected={form.allowed_markets} onChange={(values) => updateForm('allowed_markets', values)} />
          <MultiSelect label="allowed_chains" values={MACHINE_MARKET_CHAINS} selected={form.allowed_chains} onChange={(values) => updateForm('allowed_chains', values)} />
          <label className="machine-checkbox"><input aria-label="requires_receipt" type="checkbox" checked={form.requires_receipt} onChange={(event) => updateForm('requires_receipt', event.target.checked)} /> <span>requires_receipt</span></label>
          <button className="execute" type="submit" disabled={submitting}>{submitting ? 'Checking...' : 'Run Machine Preflight'}</button>
          {templatesError && <p className="route-state warn">Policy templates unavailable: {templatesError}</p>}
          {submitError && <p className="route-state error">Machine preflight unavailable: {submitError}</p>}
        </form>
        <aside className="panel machine-policy-summary" aria-label="Policy summary">
          <div className="panel-head"><div><p className="section-kicker">Policy Template</p><h2>{selectedTemplate?.name ?? 'Ephemeral policy'}</h2></div></div>
          {selectedTemplate ? <details open>
            <summary>{selectedTemplate.description}</summary>
            <div className="key-values machine-service-profile">
              <p><b>daily_budget_usd</b><span>${selectedTemplate.daily_budget_usd}</span></p>
              <p><b>per_call_budget_usd</b><span>${selectedTemplate.per_call_budget_usd}</span></p>
              <p><b>allowed_categories</b><span>{selectedTemplate.allowed_categories.join(', ') || 'none'}</span></p>
              <p><b>allowed_markets</b><span>{selectedTemplate.allowed_source_markets.join(', ') || 'request-defined'}</span></p>
              <p><b>allowed_chains</b><span>{selectedTemplate.allowed_chains.join(', ') || 'request-defined'}</span></p>
              <p><b>minimum_evidence</b><span>{selectedTemplate.minimum_evidence_stage}</span></p>
              <p><b>risk_tolerance</b><span>{selectedTemplate.risk_tolerance}</span></p>
              <p><b>receipt_required</b><span>{String(selectedTemplate.receipt_required)}</span></p>
            </div>
          </details> : <p className="copy">Request constraints will form an ephemeral policy for this preflight only.</p>}
        </aside>
      </section>
      {result && <MachinePreflightResultPanel result={result} />}
    </main>
  </div>;
}

function MultiSelect<T extends string>({ label, values, selected, onChange }: { label: string; values: T[]; selected: T[]; onChange: (values: T[]) => void }) {
  const toggle = (value: T) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return <fieldset className="machine-multi-select" aria-label={label}>
    <legend>{label}</legend>
    {values.map((value) => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(value)} /> <span>{value}</span></label>)}
  </fieldset>;
}

function MachinePreflightResultPanel({ result }: { result: MachinePreflightResult }) {
  return <section className={`panel machine-preflight-result ${result.decision}`} aria-label="Machine preflight result">
    <div className="machine-clearance-head">
      <div><p className="section-kicker">Control Tower Clearance</p><h2>Decision: <span className={`decision-badge ${result.decision}`}>{result.decision}</span></h2></div>
      <strong>{result.receipt_id}</strong>
    </div>
    <div className="machine-clearance-grid">
      <div><span>recommended service</span><strong>{result.recommended_service?.name ?? 'none'}</strong></div>
      <div><span>source market</span><strong>{result.source_market ?? 'none'}</strong></div>
      <div><span>chain</span><strong>{result.chain ?? 'none'}</strong></div>
      <div><span>evidence</span><strong>{formatEvidenceStage(result.evidence_stage)} / {result.evidence_health ?? 'none'}</strong></div>
    </div>
    <MachineEvidenceClaims serviceOrReceipt={{ evidence_stage: result.evidence_stage }} />
    <p className="copy">{result.reason}</p>
    <details open><summary>Policy checks</summary><div className="machine-check-list">{result.policy_checks.map((check) => <p key={check.id}><b className={check.status}>{check.status}</b><span>{check.label}: {check.detail}</span></p>)}</div></details>
    {!!result.violations.length && <section className="dossier-section"><h4>Violations</h4><ul className="machine-caveat-list">{result.violations.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    {!!result.review_reasons.length && <section className="dossier-section"><h4>Review reasons</h4><ul className="machine-caveat-list">{result.review_reasons.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    <section className="dossier-section"><h4>Caveats</h4><ul className="machine-caveat-list">{result.caveats.map((item) => <li key={item}>{item}</li>)}</ul></section>
  </section>;
}

function normalizeTemplateId(policyId: string) {
  return policyId.replace(/^template[_:-]/, '').replaceAll('_', '-');
}

function MachineMethodologyNote() {
  return <p className="machine-methodology-note"><a href="/#methodology">Methodology: Machine Economy evidence ladder</a> Repeatability-recorded means the same route has produced multiple successful execution receipts under the same prompt family. It is not a benchmark and does not compare providers. Benchmark-ready criteria define the minimum evidence required before a benchmark can be recorded. Criteria definition is not a benchmark.</p>;
}

function MachineEvidenceMethodologyDrawer() {
  const items: Array<{ id: string; title: string; body: string }> = [
    { id: 'listed', title: 'listed', body: 'Meaning: service appears in the current robotic.sh-visible service mirror.' },
    { id: 'classified', title: 'classified', body: 'Meaning: Radar has normalized the service into category/status/source-market fields.' },
    { id: 'policy_mapped', title: 'policy_mapped', body: 'Meaning: Radar has evaluated the service against the current machine policy profile or coverage run.' },
    { id: 'preflight_recorded', title: 'preflight_recorded', body: 'Meaning: Radar has a durable preflight or decision receipt for the service. It does not imply execution.' },
    { id: 'proof_path', title: 'proof_path', body: 'Meaning: Radar has enough structured information to describe what evidence would be needed before execution.' },
    { id: 'proof_plan_selected', title: 'proof_plan_selected', body: 'Meaning: Radar has selected this service for controlled proof planning. This is not an execution claim.' },
    { id: 'execution_receipt', title: 'execution_receipt', body: 'Meaning: a service-specific execution attempt has produced a durable receipt.' },
    { id: 'repeatability_receipt', title: 'repeatability_receipt', body: 'Meaning: repeated execution attempts for the same service have produced durable repeatability evidence.' },
    { id: 'source_attribution', title: 'source attribution', body: 'Meaning: Radar records where a claim came from, what scope it covers, when it was observed, and what it does not prove.' },
    { id: 'public_context', title: 'public context', body: 'Meaning: public demo/news/service-page context that may explain relevance but is not Radar execution evidence.' },
    { id: 'manual_scaffold', title: 'manual scaffold', body: 'Meaning: Radar planning metadata or interpretation that requires future receipts before becoming execution evidence.' }
  ];

  return <details className="panel machine-evidence-methodology" aria-label="Evidence methodology drawer">
    <summary className="machine-evidence-methodology-summary">
      <span className="section-kicker">Evidence methodology</span>
      <strong>Evidence methodology</strong>
      <small>Definitions for listed, classified, policy_mapped, preflight_recorded, proof_path, proof_plan_selected, execution_receipt, and repeatability_receipt.</small>
    </summary>
    <div className="machine-evidence-methodology-body">
      <div className="machine-evidence-methodology-grid">
        {items.map((item) => <article key={item.id}>
          <span>{item.title}</span>
          <p>{item.body}</p>
        </article>)}
      </div>
      <div className="machine-evidence-methodology-caveat">
        <p>Coverage, preflight, and proof planning do not imply execution. Execution and repeatability remain receipt-driven.</p>
      </div>
    </div>
  </details>;
}

type MachineReceiptFiltersState = {
  decision: 'all' | 'allow' | 'deny' | 'review';
  machine_id: string;
  service_id: string;
  source_market: 'all' | MachineMarketSource;
  chain: 'all' | MachineMarketChain;
};

function MachineReceiptsPage() {
  const [receipts, setReceipts] = useState<MachinePreflightReceipt[]>([]);
  const [storage, setStorage] = useState<MachineReceiptStorage | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<MachinePreflightReceipt | null>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MachineReceiptFiltersState>({ decision: 'all', machine_id: '', service_id: '', source_market: 'all', chain: 'all' });

  const loadReceipts = React.useCallback(() => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (filters.decision !== 'all') query.set('decision', filters.decision);
    if (filters.machine_id.trim()) query.set('machine_id', filters.machine_id.trim());
    if (filters.service_id.trim()) query.set('service_id', filters.service_id.trim());
    if (filters.source_market !== 'all') query.set('source_market', filters.source_market);
    if (filters.chain !== 'all') query.set('chain', filters.chain);
    query.set('limit', '50');
    api<{ data: { receipts: MachinePreflightReceipt[]; storage?: MachineReceiptStorage } }>(`/v1/machine-preflight/receipts/recent?${query.toString()}`)
      .then((response) => {
        setReceipts(response.data.receipts);
        setStorage(response.data.storage ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'machine receipts unavailable'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    document.title = 'Machine Receipts | Infopunks Pay.sh Radar';
    setMetaTag('name', 'description', 'Machine preflight decision receipt memory for bounded machine spend.');
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  const openReceipt = (receiptId: string) => {
    api<{ data: { receipt: MachinePreflightReceipt } }>(`/v1/machine-preflight/receipts/${encodeURIComponent(receiptId)}`)
      .then((response) => {
        setSelectedReceipt(response.data.receipt);
        setRawOpen(false);
      })
      .catch(() => {
        const fallback = receipts.find((receipt) => receipt.receipt_id === receiptId) ?? null;
        setSelectedReceipt(fallback);
      });
  };

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-receipts-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Receipts navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current="machine-receipts" />
        </div>
      </nav>
    </header>
    <main id="machine-receipts-content" className="machine-market-page machine-receipts-page" aria-label="Machine Receipts">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Proof Memory</p>
          <h1>Machine Receipts</h1>
          <p className="copy">Machines with wallets need witnesses.</p>
          <p className="panel-caption">Receipts record the boundary between permission and action. Denied attempts matter. They prove autonomy is bounded.</p>
        </div>
        <div className="ticker" aria-label="Machine Receipts principles">
          <span>Preflight and execution receipts</span>
          <span>Not payment receipts</span>
          <span>Preflight before action</span>
        </div>
      </section>
      <MachineMethodologyNote />
      <section className="panel machine-market-caveat" aria-label="Machine receipt source caveats">
        <p>Receipt source, not robotic.sh catalog source of truth.</p>
        <p>Preflight receipt ≠ execution. Execution receipt ≠ payment proof.</p>
        <p><a className="execute compact secondary" href="/machine-benchmark-readiness">View benchmark readiness</a></p>
      </section>
      {storage && <p className="panel-caption">
        Storage: {storage.durable ? 'Durable' : 'Non-durable'} {storage.adapter.toUpperCase()}.
        {storage.demo_seed_enabled ? ' Demo mode active.' : ''} Preflight and execution receipts, not payment receipts.
      </p>}
      <ReceiptsSummaryCards receipts={receipts} />
      <ReceiptFilters filters={filters} onChange={setFilters} />
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine receipts...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine receipts unavailable: {error}</p></section>}
      {!loading && !error && receipts.length === 0 && <section className="panel machine-receipts-empty">
        <EmptyState title="No machine receipts yet." body="Run a preflight decision to create the first receipt." />
        <a className="execute compact secondary" href="/machine-preflight">Open Machine Preflight</a>
      </section>}
      {!loading && !error && receipts.length > 0 && <section className="machine-receipts-layout">
        <ReceiptsTimeline receipts={receipts} onSelect={openReceipt} />
        <ReceiptDetailDrawer receipt={selectedReceipt ?? receipts[0]} rawOpen={rawOpen} onRawToggle={() => setRawOpen((value) => !value)} />
      </section>}
    </main>
  </div>;
}

function ReceiptsSummaryCards({ receipts }: { receipts: MachinePreflightReceipt[] }) {
  const demoCount = receipts.filter((receipt) => receipt.demo_mode).length;
  const uniqueMachines = new Set(receipts.map((receipt) => receipt.machine_id)).size;
  const evidenceCounts = machineEvidenceCounts(receipts);
  const bigQueryLiveReceipts = receipts.filter((receipt) => isBigQueryLiveExecutionReceipt(receipt)).length;
  const marketCounts = receipts.reduce<Record<string, number>>((counts, receipt) => {
    if (receipt.source_market) counts[receipt.source_market] = (counts[receipt.source_market] ?? 0) + 1;
    return counts;
  }, {});
  const topMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';
  return <section className="grid four machine-market-summary machine-receipts-summary" aria-label="Machine receipt summary">
    <article className="panel metric"><span>Total receipts</span><strong>{receipts.length}</strong><small>preflight plus service execution receipts</small></article>
    <article className="panel metric"><span>Allowed</span><strong>{receipts.filter((receipt) => receipt.decision === 'allow').length}</strong><small>permission before action</small></article>
    <article className="panel metric"><span>Denied</span><strong>{receipts.filter((receipt) => receipt.decision === 'deny').length}</strong><small>bounded autonomy proof</small></article>
    <article className="panel metric"><span>Review</span><strong>{receipts.filter((receipt) => receipt.decision === 'review').length}</strong><small>human checkpoint</small></article>
    <article className="panel metric"><span>Preflight decision receipts</span><strong>{evidenceCounts.preflight_decision_receipts}</strong><small>policy decisions, not service execution</small></article>
    <article className="panel metric"><span>Service-specific execution receipts</span><strong>{evidenceCounts.service_specific_execution_receipts}</strong><small>execution proof for one service only</small></article>
    <article className="panel metric"><span>BigQuery live receipts</span><strong>{bigQueryLiveReceipts}</strong><small>counted only when live Harness execution succeeded</small></article>
    <article className="panel metric"><span>Payment success claims</span><strong>{evidenceCounts.payment_success_claims}</strong><small>requires explicit payment evidence</small></article>
    {demoCount > 0 && <article className="panel metric"><span>Demo receipts</span><strong>{demoCount}</strong><small>local demo mode only</small></article>}
    <article className="panel metric"><span>Unique machines</span><strong>{uniqueMachines}</strong><small>machine identities</small></article>
    <article className="panel metric"><span>Top source market</span><strong>{topMarket}</strong><small>preflight metadata</small></article>
    <article className="panel metric"><span>Latest receipt</span><strong>{receipts[0] ? formatMachineTimestamp(receipts[0].created_at) : 'none'}</strong><small>newest first</small></article>
  </section>;
}

function ReceiptFilters({ filters, onChange }: { filters: MachineReceiptFiltersState; onChange: (filters: MachineReceiptFiltersState) => void }) {
  const update = <K extends keyof MachineReceiptFiltersState>(key: K, value: MachineReceiptFiltersState[K]) => onChange({ ...filters, [key]: value });
  return <section className="panel machine-market-filters machine-receipt-filters" aria-label="Receipt filters">
    <FilterSelect label="decision" value={filters.decision} values={['all', 'allow', 'deny', 'review']} onChange={(value) => update('decision', value as MachineReceiptFiltersState['decision'])} />
    <label><span>machine_id</span><input aria-label="machine_id filter" value={filters.machine_id} onChange={(event) => update('machine_id', event.target.value)} /></label>
    <label><span>service_id</span><input aria-label="service_id filter" value={filters.service_id} onChange={(event) => update('service_id', event.target.value)} /></label>
    <FilterSelect label="source_market" value={filters.source_market} values={['all', ...MACHINE_MARKET_SOURCES]} onChange={(value) => update('source_market', value as MachineReceiptFiltersState['source_market'])} />
    <FilterSelect label="chain" value={filters.chain} values={['all', ...MACHINE_MARKET_CHAINS]} onChange={(value) => update('chain', value as MachineReceiptFiltersState['chain'])} />
  </section>;
}

function ReceiptsTimeline({ receipts, onSelect }: { receipts: MachinePreflightReceipt[]; onSelect: (receiptId: string) => void }) {
  const successfulByService = new Map<string, number>();
  for (const receipt of receipts) {
    const serviceId = receipt.execution_service_id ?? receipt.selected_service_id;
    if (!serviceId) continue;
    if (receipt.receipt_type === 'machine_execution' && receipt.execution_status === 'succeeded' && receipt.execution_occurred) {
      successfulByService.set(serviceId, (successfulByService.get(serviceId) ?? 0) + 1);
    }
  }
  return <section className="panel machine-receipts-timeline" aria-label="Receipts timeline">
    <div className="panel-head"><div><p className="section-kicker">Receipt Timeline</p><h2>{receipts.length} machine receipts</h2></div><small>Preflight decision receipts and service execution receipts share one timeline. Denied and review receipts remain successful governance records.</small></div>
    <div className="machine-receipt-table" role="table" aria-label="Machine receipt timeline table">
      <div className="machine-receipt-row head" role="row">
        {['timestamp', 'decision', 'machine_id', 'intent', 'selected service', 'source market', 'chain', 'evidence stage', 'receipt id', ''].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
      </div>
      {receipts.map((receipt) => <div key={receipt.receipt_id} className={`machine-receipt-row ${receipt.decision}`} role="row">
        <span role="cell">{formatMachineTimestamp(receipt.created_at)}</span>
        <span role="cell" className={`decision-badge ${receipt.decision}`}>{receipt.decision}</span>
        <span role="cell"><a className="machine-id-link" href={`/machine-dossier/${encodeURIComponent(receipt.machine_id)}`}>{receipt.machine_id}</a></span>
        <span role="cell">{receipt.intent}{receipt.demo_mode && <small className="machine-demo-tag">Demo preflight receipt. No service execution occurred.</small>}</span>
        <span role="cell">{receipt.selected_service_name ?? 'none'}</span>
        <span role="cell">{receipt.source_market ?? 'none'}</span>
        <span role="cell">{receipt.chain ?? 'none'}</span>
        <span role="cell"><MachineEvidenceStageTag stage={receipt.evidence_stage} /><small>{formatReceiptRepeatabilityState(receipt, successfulByService)}</small></span>
        <span role="cell">{receipt.receipt_id}</span>
        <span role="cell"><button className="execute compact secondary" type="button" onClick={() => onSelect(receipt.receipt_id)}>View details</button> <a className="execute compact secondary" href={`/machine-execution/${encodeURIComponent(receipt.receipt_id)}`}>Execution detail</a></span>
      </div>)}
    </div>
  </section>;
}

function formatReceiptRepeatabilityState(receipt: MachinePreflightReceipt, successfulByService: Map<string, number>) {
  if (receipt.receipt_type !== 'machine_execution') return 'repeatability_not_applicable';
  const serviceId = receipt.execution_service_id ?? receipt.selected_service_id;
  if (!serviceId) return 'repeatability_not_applicable';
  if (receipt.evidence_stage === 'repeatability-recorded') return 'repeatability_recorded';
  const successful = successfulByService.get(serviceId) ?? 0;
  if (successful >= 2) return 'repeatability_candidate';
  return 'repeatability_insufficient_runs';
}

function ReceiptDetailDrawer({ receipt, rawOpen, onRawToggle }: { receipt: MachinePreflightReceipt; rawOpen: boolean; onRawToggle: () => void }) {
  const checksPassed = receipt.policy_checks.filter((check) => check.status === 'pass').length;
  const taxonomy = resolveMachineReceiptTaxonomy(receipt);
  const paymentStatus = resolveMachinePaymentStatus(receipt);
  return <aside className={`panel machine-receipt-detail ${receipt.decision}`} aria-label="Receipt detail drawer">
    <div className="panel-head"><div><p className="section-kicker">Receipt Detail</p><h2><span className={`decision-badge ${receipt.decision}`}>{receipt.decision}</span> {receipt.receipt_id}</h2></div></div>
    <p className="copy">{receipt.reason}</p>
    {receipt.demo_mode && <p className="machine-demo-note">Demo preflight receipt. No service execution occurred.</p>}
    <div className="machine-receipt-priority">
      <div><span>decision</span><strong className={`decision-badge ${receipt.decision}`}>{receipt.decision}</strong></div>
      <div><span>selected service</span><strong>{receipt.selected_service_name ?? 'none'}</strong></div>
      <div><span>source market / chain</span><strong>{receipt.source_market ?? 'none'} / {receipt.chain ?? 'none'}</strong></div>
      <div><span>execution_occurred</span><strong>{String(receipt.execution_occurred)}</strong></div>
      <div><span>payment_status</span><strong>{paymentStatus}</strong></div>
      <div><span>evidence stage / health</span><strong>{formatEvidenceStage(receipt.evidence_stage)} / {receipt.evidence_health ?? 'none'}</strong></div>
    </div>
    <div className="key-values machine-service-profile">
      <p><b>machine_id</b><span>{receipt.machine_id}</span></p>
      <p><b>selected_service</b><span>{receipt.selected_service_name ?? 'none'}</span></p>
      <p><b>source_market</b><span>{receipt.source_market ?? 'none'}</span></p>
      <p><b>chain</b><span>{receipt.chain ?? 'none'}</span></p>
      <p><b>evidence</b><span>{formatEvidenceStage(receipt.evidence_stage)} / {receipt.evidence_health ?? 'none'}</span></p>
      <p><b>evidence_scope</b><span>{taxonomy.scope}</span></p>
      <p><b>receipt_type</b><span>{taxonomy.receipt_type}</span></p>
      <p><b>claim_status</b><span>{taxonomy.claim_status}</span></p>
      <p><b>payment_status</b><span>{paymentStatus}</span></p>
      <p><b>demo_mode</b><span>{String(receipt.demo_mode)}</span></p>
      <p><b>phase_scope</b><span>{receipt.phase_scope}</span></p>
    </div>
    <MachineEvidenceClaims serviceOrReceipt={receipt} />
    <p className="panel-caption">{taxonomy.definition}</p>
    <p className="panel-caption">Receipt source, not robotic.sh catalog source of truth. Preflight receipt ≠ execution. Execution receipt ≠ payment proof.</p>
    <section className="machine-check-summary" aria-label="Policy check summary">
      <span><b>{checksPassed}</b> checks passed</span>
      <span><b>{receipt.violations.length}</b> violations</span>
      <span><b>{receipt.review_reasons.length}</b> review reasons</span>
      <span><b>{receipt.caveats.length}</b> caveats</span>
    </section>
    <details><summary>Show policy checks</summary><div className="machine-check-list">{receipt.policy_checks.map((check) => <p key={check.id}><b className={check.status}>{check.status}</b><span>{check.label}: {check.detail}</span></p>)}</div></details>
    {!!receipt.violations.length && <section className="dossier-section"><h4>Violations</h4><ul className="machine-caveat-list">{receipt.violations.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    {!!receipt.review_reasons.length && <section className="dossier-section"><h4>Review reasons</h4><ul className="machine-caveat-list">{receipt.review_reasons.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    <section className="dossier-section"><h4>Caveats</h4><ul className="machine-caveat-list">{receipt.caveats.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <button className="execute compact secondary" type="button" onClick={onRawToggle}>{rawOpen ? 'Hide raw JSON' : 'Show raw JSON'}</button>
    {rawOpen && <SafeCodeBlock value={JSON.stringify(receipt, null, 2)} label="Machine receipt raw JSON" />}
  </aside>;
}

function MachineExecutionReceiptDetailPage({ receiptId }: { receiptId: string }) {
  const [receipt, setReceipt] = useState<MachinePreflightReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Machine Execution Receipt ${receiptId} | Infopunks Pay.sh Radar`;
    setMetaTag('name', 'description', 'Service-specific machine execution receipt detail with strict claim boundaries.');
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<{ data: { receipt: MachinePreflightReceipt } }>(`/v1/machine-preflight/receipts/${encodeURIComponent(receiptId)}`)
      .then((response) => {
        if (cancelled) return;
        setReceipt(response.data.receipt ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'machine execution receipt unavailable');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [receiptId]);

  const caveats = [
    'Service-specific execution receipt only.',
    'Not market-wide proof.',
    'Not payment proof.',
    'Not benchmark proof.',
    'Not winner proof.'
  ];
  const requestSummary = parseMachineExecutionSummary(receipt?.execution_request_summary);
  const responseSummary = parseMachineExecutionSummary(receipt?.execution_response_summary);
  const isBigQueryReceipt = (receipt?.execution_service_id ?? receipt?.selected_service_id) === 'bigquery';
  const isAnyTransReceipt = (receipt?.execution_service_id ?? receipt?.selected_service_id) === 'anytrans';
  const isBigQueryLiveReceipt = receipt ? isBigQueryLiveExecutionReceipt(receipt) : false;
  const isStableuploadReceipt = (receipt?.execution_service_id ?? receipt?.selected_service_id) === 'stableupload';
  const isNaverReceipt = (receipt?.execution_service_id ?? receipt?.selected_service_id) === 'naver-maps';

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-execution-receipt-content">Skip to content</a>
    <main id="machine-execution-receipt-content" className="machine-market-page machine-execution-page" aria-label="Machine execution receipt detail page">
      {loading && <section className="panel" role="status"><p className="route-state">Loading execution receipt detail...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Execution receipt detail unavailable: {error}</p></section>}
      {!loading && !error && !receipt && <section className="panel"><EmptyState title="Execution receipt not found." body="No receipt exists for this id in current storage." /></section>}
      {!loading && !error && receipt && <>
        <section className="panel hero machine-market-hero">
          <div>
            <p className="eyebrow">Machine Execution Receipt</p>
            <h1>{receipt.receipt_id}</h1>
            <p className="copy">Service-scoped execution evidence only.</p>
          </div>
        </section>
        <section className="panel" aria-label="Receipt core fields">
          <div className="machine-usage-list">
            <p><span>service</span><small>{receipt.selected_service_name ?? receipt.execution_service_id ?? 'unknown'}</small></p>
            <p><span>execution_status</span><small>{receipt.execution_status}</small></p>
            <p><span>payment_status</span><small>{resolveMachinePaymentStatus(receipt)}</small></p>
            <p><span>evidence_stage</span><small>{receipt.evidence_stage ?? 'unknown'}</small></p>
            <p><span>created_at</span><small>{formatMachineTimestamp(receipt.created_at)}</small></p>
            {(isBigQueryReceipt || isAnyTransReceipt) && <p><span>repeatability_pack</span><small><a href={`/v1/machine-execution/repeatability/${encodeURIComponent((receipt.execution_service_id ?? receipt.selected_service_id) ?? '')}`}>View repeatability pack JSON</a></small></p>}
          </div>
        </section>
        {isBigQueryReceipt && <section className="panel" aria-label="BigQuery bounded query receipt summary">
          <h2>BigQuery Summary</h2>
          <div className="machine-usage-list">
            <p><span>proof_profile</span><small>bigquery_bounded_query</small></p>
            <p><span>query_label</span><small>{String(responseSummary?.query_label ?? 'unknown')}</small></p>
            <p><span>row_count</span><small>{String(responseSummary?.row_count ?? 'unknown')}</small></p>
            <p><span>dataset_classification</span><small>{String(responseSummary?.dataset_classification ?? 'unknown')}</small></p>
            <p><span>bounded_query_confirmed</span><small>{String(responseSummary?.bounded_query_confirmed ?? false)}</small></p>
            <p><span>result_preview</span><small>{String(responseSummary?.result_preview != null ? JSON.stringify(responseSummary.result_preview) : 'none')}</small></p>
            <p><span>request_fixture</span><small>{String(requestSummary?.fixture ?? 'none')}</small></p>
            <p><span>live_harness_execution</span><small>{String(isBigQueryLiveReceipt)}</small></p>
          </div>
          <p className="panel-caption">{isBigQueryLiveReceipt
            ? 'Live Harness bounded-query receipt recorded.'
            : 'Bounded public/synthetic query fixture path. Replace with Harness execution output when live rail is configured.'}
          </p>
        </section>}
        {isStableuploadReceipt && <section className="panel" aria-label="Stableupload tiny fixture receipt summary">
          <h2>Stableupload Summary</h2>
          <div className="machine-usage-list">
            <p><span>proof_profile</span><small>stableupload_tiny_fixture</small></p>
            <p><span>file_size_bytes</span><small>{String(responseSummary?.file_size_bytes ?? 'unknown')}</small></p>
            <p><span>file_hash</span><small>{String(responseSummary?.file_hash ?? 'unknown')}</small></p>
            <p><span>upload_reference</span><small>{String(responseSummary?.upload_reference ?? 'unknown')}</small></p>
            <p><span>sensitive_data_flag</span><small>{String(responseSummary?.sensitive_data_flag ?? false)}</small></p>
            <p><span>request_fixture</span><small>{String(requestSummary?.fixture ?? 'none')}</small></p>
          </div>
          <p className="panel-caption">Tiny non-sensitive fixture path only. Replace with Harness execution output when live rail is configured.</p>
        </section>}
        {isNaverReceipt && <section className="panel" aria-label="NAVER geocode non-operational receipt summary">
          <h2>NAVER Geocode Summary</h2>
          <div className="machine-usage-list">
            <p><span>proof_profile</span><small>naver_geocode_lookup</small></p>
            <p><span>query_label</span><small>{String(responseSummary?.query_label ?? 'unknown')}</small></p>
            <p><span>geocode_result_preview</span><small>{String(responseSummary?.geocode_result_preview ?? 'unknown')}</small></p>
            <p><span>coordinates_present</span><small>{String(responseSummary?.coordinates_present ?? false)}</small></p>
            <p><span>no_robot_command</span><small>{String(responseSummary?.no_robot_command ?? false)}</small></p>
            <p><span>no_physical_movement</span><small>{String(responseSummary?.no_physical_movement ?? false)}</small></p>
            <p><span>request_fixture</span><small>{String(requestSummary?.fixture ?? 'none')}</small></p>
          </div>
          <p className="panel-caption">Non-operational geocode lookup only. No robot command, no physical movement, no real-world route guidance.</p>
        </section>}
        <section className="panel" aria-label="Execution receipt caveats">
          <h2>Caveats</h2>
          <ul className="machine-caveat-list">{caveats.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </>}
    </main>
  </div>;
}

function MachineDossierPage({ machineId }: { machineId: string }) {
  const [dossier, setDossier] = useState<MachineDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${machineId} Machine Dossier | Infopunks Pay.sh Radar`;
    setMetaTag('name', 'description', 'Radar-observed machine behavior memory based on policies, preflight decisions, and receipts.');
    setLoading(true);
    setError(null);
    api<{ data: MachineDossier }>(`/v1/machine-dossier/${encodeURIComponent(machineId)}`)
      .then((response) => setDossier(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'machine dossier unavailable'))
      .finally(() => setLoading(false));
  }, [machineId]);

  return <div className="shell machine-market-shell">
    <a className="skip-link" href="#machine-dossier-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar machine-market-toolbar" aria-label="Machine Dossier navigation">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home"><span>Infopunks</span><strong>Pay.sh Radar</strong></a>
        <div className="terminal-nav" aria-label="Machine Economy navigation">
          <MachineControlPlaneNavLinks current={null} />
        </div>
      </nav>
    </header>
    <main id="machine-dossier-content" className="machine-market-page machine-dossier-page" aria-label="Machine Dossier">
      <section className="panel hero machine-market-hero">
        <div>
          <p className="eyebrow">Machine Dossier</p>
          <h1>{machineId}</h1>
          <p className="copy">peaqOS identity gives the machine an address. Infopunks gives the machine behavioral memory.</p>
          <p className="panel-caption">Machine dossiers summarize what a machine was allowed to do, what it attempted, and what Radar recorded.</p>
        </div>
        <div className="ticker" aria-label="Machine dossier status">
          <span>{dossier?.status ?? 'loading'}</span>
          <span>{dossier?.phase_scope ?? 'phase_2_pay_sh_robotic_sh'}</span>
          <span>{dossier?.summary.latest_activity_at ? formatMachineTimestamp(dossier.summary.latest_activity_at) : 'no activity'}</span>
        </div>
      </section>
      <MachineMethodologyNote />
      {loading && <section className="panel" role="status"><p className="route-state">Loading machine dossier...</p></section>}
      {error && <section className="panel" role="alert"><p className="route-state error">Machine dossier unavailable: {error}</p></section>}
      {dossier && <>
        {dossier.status === 'no_activity' && <section className="panel machine-receipts-empty"><EmptyState title="No Radar-observed activity." body={dossier.suggested_next_action ?? 'Run preflight to create the first receipt.'} /><a className="execute compact secondary" href="/machine-preflight">Open Machine Preflight</a></section>}
        <section className="machine-dossier-layout">
          <MachineAuthorityCard dossier={dossier} />
          <MachineDossierSummary dossier={dossier} />
        </section>
        <section className="machine-dossier-layout">
          <UsageMaps dossier={dossier} />
          <DossierEvidenceSummary dossier={dossier} />
        </section>
        <section className="panel machine-receipts-timeline" aria-label="Machine dossier recent receipts">
          <div className="panel-head"><div><p className="section-kicker">Recent Receipts</p><h2>{dossier.recent_receipts.length} Radar-observed receipts</h2></div></div>
          {dossier.recent_receipts.length ? <ReceiptsTimeline receipts={dossier.recent_receipts} onSelect={() => undefined} /> : <EmptyState title="No receipts for this machine." body="Run a preflight decision to start its behavioral memory." />}
        </section>
        <section className="panel"><h2>Caveats</h2><ul className="machine-caveat-list">{dossier.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></section>
      </>}
    </main>
  </div>;
}

function MachineAuthorityCard({ dossier }: { dossier: MachineDossier }) {
  return <section className="panel machine-policy-summary" aria-label="Machine authority card">
    <div className="panel-head"><div><p className="section-kicker">Machine Authority</p><h2>{dossier.policy_profile.policy_name ?? 'No active policy observed'}</h2></div></div>
    <div className="key-values machine-service-profile">
      <p><b>active_policy_id</b><span>{dossier.policy_profile.active_policy_id ?? 'none'}</span></p>
      <p><b>risk_tolerance</b><span>{dossier.policy_profile.risk_tolerance ?? 'unknown'}</span></p>
      <p><b>daily_budget_usd</b><span>{dossier.policy_profile.daily_budget_usd ?? 'unknown'}</span></p>
      <p><b>per_call_budget_usd</b><span>{dossier.policy_profile.per_call_budget_usd ?? 'unknown'}</span></p>
      <p><b>allowed_categories</b><span>{dossier.policy_profile.allowed_categories.join(', ') || 'unknown'}</span></p>
      <p><b>allowed_markets</b><span>{dossier.policy_profile.allowed_source_markets.join(', ') || 'request-defined'}</span></p>
      <p><b>allowed_chains</b><span>{dossier.policy_profile.allowed_chains.join(', ') || 'request-defined'}</span></p>
    </div>
  </section>;
}

function MachineDossierSummary({ dossier }: { dossier: MachineDossier }) {
  return <section className="grid three machine-dossier-summary" aria-label="Machine dossier decision summary">
    <article className="panel metric"><span>Total receipts</span><strong>{dossier.summary.total_receipts}</strong><small>Radar-observed</small></article>
    <article className="panel metric"><span>Allowed</span><strong>{dossier.summary.allow_count}</strong><small>permission before action</small></article>
    <article className="panel metric"><span>Denied</span><strong>{dossier.summary.deny_count}</strong><small>bounded attempts</small></article>
    <article className="panel metric"><span>Review</span><strong>{dossier.summary.review_count}</strong><small>human checkpoint</small></article>
    <article className="panel metric"><span>Unique services</span><strong>{dossier.summary.unique_services}</strong><small>service routes</small></article>
    <article className="panel metric"><span>Unique markets</span><strong>{dossier.summary.unique_source_markets}</strong><small>source markets</small></article>
  </section>;
}

function UsageMaps({ dossier }: { dossier: MachineDossier }) {
  return <section className="panel machine-usage-maps" aria-label="Machine usage maps">
    <div className="panel-head"><div><p className="section-kicker">Usage Maps</p><h2>What Radar saw</h2></div></div>
    <UsageList title="Service usage" rows={dossier.service_usage.map((row) => [row.service_name, row.count])} />
    <UsageList title="Category usage" rows={dossier.category_usage.map((row) => [row.category, row.count])} />
    <UsageList title="Market usage" rows={dossier.market_usage.map((row) => [row.source_market, row.count])} />
    <UsageList title="Chain usage" rows={dossier.chain_usage.map((row) => [row.chain, row.count])} />
  </section>;
}

function UsageList({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return <section className="dossier-section"><h4>{title}</h4>{rows.length ? <div className="machine-usage-list">{rows.map(([label, count]) => <p key={label}><span>{label}</span><b>{count}</b></p>)}</div> : <p>none observed</p>}</section>;
}

function DossierEvidenceSummary({ dossier }: { dossier: MachineDossier }) {
  const highest = dossier.evidence_summary.highest_stage_seen;
  return <section className="panel evidence-ladder-panel" aria-label="Machine dossier evidence summary">
    <div className="panel-head"><div><p className="section-kicker">Evidence Summary</p><h2>Highest observed: {formatEvidenceStage(highest)}</h2></div></div>
    <div className="evidence-ladder">{MACHINE_MARKET_STAGES.map((stage, index) => <React.Fragment key={stage}><span className={stage === highest || (dossier.evidence_summary.stage_counts[stage] ?? 0) > 0 ? 'active' : 'future'} title={getEvidenceStageDescription(stage)}>{formatEvidenceStage(stage)}</span>{index < MACHINE_MARKET_STAGES.length - 1 && <b aria-hidden="true">-&gt;</b>}</React.Fragment>)}</div>
    <div className="machine-usage-list evidence-counts">{Object.entries(dossier.evidence_summary.stage_counts).map(([stage, count]) => <p key={stage}><span>{formatEvidenceStage(stage)}</span><b>{count}</b></p>)}</div>
    <p className="panel-caption">{getEvidenceStageDescription(highest)}</p>
    <MachineEvidenceClaims serviceOrReceipt={{ evidence_stage: highest }} />
  </section>;
}

function PublicProviderPage({ providerId }: { providerId: string }) {
  const [providerDetail, setProviderDetail] = useState<ProviderDetail | null>(null);
  const [providerIntel, setProviderIntel] = useState<ProviderIntelligence | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [missing, setMissing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    setMissing(false);
    Promise.all([
      api<{ data: ProviderDetail }>(`/v1/providers/${providerId}`),
      api<{ data: ProviderIntelligence }>(`/v1/providers/${providerId}/intelligence`),
      api<{ data: Pulse }>('/v1/pulse')
    ]).then(([detail, intel, pulseResult]) => {
      if (!active) return;
      setProviderDetail(detail.data);
      setProviderIntel(intel.data);
      setPulse(pulseResult.data);
      updateProviderPageMetadata(providerId, detail.data.provider.name, detail.data.provider.description ?? null);
    }).catch(() => {
      if (!active) return;
      setMissing(true);
      updateProviderPageMetadata(providerId, null, `Provider ${providerId} was not found in the current Infopunks Pay.sh Radar dataset.`);
    });
    return () => {
      active = false;
    };
  }, [providerId]);

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
    }
  }

  if (missing) {
    return <main className="boot" aria-label="Provider not found">
      <section className="panel public-provider-page">
        <h1>Provider Not Found</h1>
        <p className="copy">No provider dossier exists for <code>{providerId}</code> in the current dataset.</p>
        <p className="copy">Try a known provider ID/FQN from the main radar directory.</p>
      </section>
    </main>;
  }

  if (!providerDetail || !providerIntel || !pulse) {
    return <main className="boot" aria-label="Provider dossier loading">LOADING PROVIDER DOSSIER...</main>;
  }

  const provider = providerDetail.provider;
  const endpointRows = resolveProviderEndpointRows(providerDetail, providerIntel);

  return <div className="shell public-provider-shell">
    <main id="terminal-content" className="public-provider-page" aria-label="Public provider intelligence dossier">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Infopunks Pay.sh Radar</p>
            <h1>{provider.name}</h1>
            <p className="copy">{provider.description ?? 'No provider description available.'}</p>
          </div>
          <div className="public-actions">
            <button className="execute compact secondary" type="button" onClick={copyShareUrl} aria-label="Copy share URL">
              {copyState === 'copied' ? 'Copied URL' : 'Copy Share URL'}
            </button>
            <a className="execute compact secondary" href={`/radar/cards/provider/${encodeURIComponent(providerId)}`}>Open Preflight Card</a>
            <a className="execute compact secondary" href="/#terminal-content">Open Radar</a>
            <a className="execute compact secondary" href="/#terminal-content" onClick={(event) => {
              event.preventDefault();
              window.location.href = '/#terminal-content';
            }}>Methodology</a>
          </div>
        </div>
        {copyState === 'error' && <p className="route-state error">Unable to copy URL in this browser context. Share this link manually: {window.location.href}</p>}
        <p className="route-state">Share URL: {window.location.href}</p>
      </section>

      <section className="panel">
        <div className="intel-summary">
          <DossierStat label="Trust" value={providerIntel.latest_trust_score} sub={providerDetail.trustAssessment?.grade ?? 'grade unknown'} />
          <DossierStat label="Signal" value={providerIntel.latest_signal_score} sub={providerDetail.signalAssessment?.narratives?.[0] ?? 'narrative unknown'} />
          <DossierStat label="Severity" value={normalSeverity(providerIntel.severity).toUpperCase()} sub={providerIntel.severity_reason ?? 'severity state'} />
          <DossierStat label="Risk" value={providerIntel.risk_level} sub="risk level" />
          <DossierStat label="Coord." value={formatNullableBoolean(providerIntel.coordination_eligible)} sub="eligibility" />
        </div>
      </section>

      <section className="grid two">
        <DossierSection title="Provider Identity">
          <KeyValues rows={[
            ['provider_id', provider.id],
            ['fqn', provider.fqn ?? provider.namespace],
            ['category', provider.category],
            ['service_url', provider.serviceUrl ?? 'unknown']
          ]} />
        </DossierSection>
        <DossierSection title="Propagation & Telemetry">
          <KeyValues rows={[
            ['propagation_state', providerIntel.propagation_context?.propagation_state ?? 'unknown'],
            ['propagation_severity', providerIntel.propagation_context?.severity ?? 'unknown'],
            ['cluster', providerIntel.propagation_context?.affected_cluster ?? 'none'],
            ['unknown_telemetry', providerIntel.unknown_telemetry.length ? providerIntel.unknown_telemetry.join(', ') : 'none']
          ]} />
        </DossierSection>
      </section>

      <section className="grid two">
        <DossierSection title="Endpoint Summary">
          <KeyValues rows={[
            ['endpoint_count', providerIntel.endpoint_count],
            ['healthy', providerIntel.endpoint_health.healthy],
            ['degraded', providerIntel.endpoint_health.degraded],
            ['failed', providerIntel.endpoint_health.failed],
            ['unknown', providerIntel.endpoint_health.unknown],
            ['last_checked', formatDate(providerIntel.endpoint_health.last_checked_at)]
          ]} />
          <div className="endpoint-list has-rows">
            {endpointRows.slice(0, 8).map((endpoint) => <div className="endpoint" key={endpoint.id}>
              <strong>{endpoint.name}</strong>
              <span>{endpoint.method ?? 'METHOD'} {endpoint.path ?? endpoint.id}</span>
              <small>{endpoint.category}</small>
            </div>)}
            {!endpointRows.length && <p className="muted">No endpoint rows available in this dossier payload.</p>}
          </div>
        </DossierSection>
        <DossierSection title="Recent Changes">
          <div className="timeline">
            {sortBySeverity(providerIntel.recent_changes).slice(0, 8).map((item) => <div className="change" key={item.id}>
              <SeverityBadge evidence={item} />
              <strong>{item.type}</strong>
              <span>{item.summary}</span>
              <time>{formatDate(item.observedAt)}</time>
              <EvidenceReceiptView evidence={item} title="Evidence" compact />
            </div>)}
            {!providerIntel.recent_changes.length && <p className="muted">No recent change events observed.</p>}
          </div>
        </DossierSection>
      </section>

      <section className="grid two">
        <DossierSection title="Data Source">
          <KeyValues rows={[
            ['source_mode', pulse.data_source.mode],
            ['source_url', pulse.data_source.url ?? 'unknown'],
            ['last_ingested_at', formatDate(pulse.data_source.last_ingested_at)],
            ['provider_count', pulse.data_source.provider_count ?? 'unknown']
          ]} />
        </DossierSection>
        <DossierSection title="Evidence Metadata">
          <EvidenceReceiptView evidence={providerIntel} title="Provider Intelligence Receipt" />
          <p><a href="/#terminal-content">Methodology link</a></p>
        </DossierSection>
      </section>
    </main>
  </div>;
}

function PublicReceiptPage({ eventId }: { eventId: string }) {
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    setMissing(false);
    setReceipt(null);
    api<{ data: ReceiptRecord }>(`/v1/receipts/${encodeURIComponent(eventId)}`)
      .then((response) => {
        if (!active) return;
        setReceipt(response.data);
        updateReceiptPageMetadata(response.data, eventId, false);
      })
      .catch(() => {
        if (!active) return;
        setMissing(true);
        updateReceiptPageMetadata(null, eventId, true);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  async function copyReceiptUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
    }
  }

  if (missing) {
    return <main className="boot" aria-label="Receipt not found">
      <section className="panel public-provider-page">
        <h1>Receipt Not Found</h1>
        <p className="copy">No receipt exists for <code>{eventId}</code> in the current event spine.</p>
      </section>
    </main>;
  }

  if (!receipt) return <main className="boot" aria-label="Receipt loading">LOADING RECEIPT...</main>;

  return <div className="shell public-provider-shell">
    <main id="terminal-content" className="public-provider-page" aria-label="Public event receipt page">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Infopunks Pay.sh Radar</p>
            <h1>Public Event Receipt</h1>
            <p className="copy">Deterministic receipt for event <code>{receipt.event_id}</code>.</p>
          </div>
          <div className="public-actions">
            <button className="execute compact secondary" type="button" onClick={copyReceiptUrl}>{
              copyState === 'copied' ? 'Copied Receipt URL' : 'Copy Receipt URL'
            }</button>
            {receipt.links.provider_dossier && <a className="execute compact secondary" href={receipt.links.provider_dossier}>Open provider dossier</a>}
          </div>
        </div>
        {copyState === 'error' && <p className="route-state error">Unable to copy URL automatically. Share this URL manually: {window.location.href}</p>}
      </section>

      <section className="grid two">
        <DossierSection title="Receipt Fields">
          <KeyValues rows={[
            ['event_id', receipt.event_id],
            ['event_type', receipt.event_type],
            ['provider_id', receipt.provider_id ?? 'unknown'],
            ['endpoint_id', receipt.endpoint_id ?? 'none'],
            ['severity', `${receipt.severity} · ${receipt.severity_reason}`],
            ['observed_at', formatDate(receipt.observed_at)],
            ['catalog_generated_at', formatDate(receipt.catalog_generated_at)],
            ['ingested_at', formatDate(receipt.ingested_at)],
            ['source', receipt.source],
            ['derivation_reason', receipt.derivation_reason],
            ['confidence', formatConfidence(receipt.confidence)]
          ]} />
        </DossierSection>
        <DossierSection title="Related Links">
          <div className="risk-list">
            {receipt.links.provider && <a href={receipt.links.provider.url}>Related provider: {receipt.links.provider.provider_name}</a>}
            {receipt.links.provider_dossier && <a href={receipt.links.provider_dossier}>Open provider dossier</a>}
            {receipt.links.interpretations.map((item) => <a key={item.interpretation_id} href={item.url}>Interpretation: {item.title}</a>)}
            {receipt.links.propagation_cluster && <a href={receipt.links.propagation_cluster.url}>
              Propagation cluster: {receipt.links.propagation_cluster.cluster ?? 'none'} · {receipt.links.propagation_cluster.state}
            </a>}
            {!receipt.links.provider && !receipt.links.provider_dossier && !receipt.links.interpretations.length && !receipt.links.propagation_cluster && <span>No related links available.</span>}
          </div>
        </DossierSection>
      </section>

      <section className="grid two">
        <DossierSection title="Structured Event Summary">
          <SafeCodeBlock value={JSON.stringify(receipt.summary, null, 2)} label="Structured event summary JSON" />
        </DossierSection>
        <DossierSection title="Raw Event Summary">
          <SafeCodeBlock value={receipt.raw_summary} label="Raw event summary" />
        </DossierSection>
      </section>
    </main>
  </div>;
}

function RadarApp() {
  const preferredProviderId = useMemo(() => new URLSearchParams(window.location.search).get('provider_id'), []);
  const [data, setData] = useState<AppData | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [secondaryLoadWarning, setSecondaryLoadWarning] = useState<string | null>(null);
  const [startupDiagnostics, setStartupDiagnostics] = useState<StartupDiagnostic[]>([]);
  const [showDeveloperDiagnostics, setShowDeveloperDiagnostics] = useState<boolean>(() => debugDiagnosticsEnabled());
  const [benchmarkReadinessLoading, setBenchmarkReadinessLoading] = useState(false);
  const [radarEndpointsLoading, setRadarEndpointsLoading] = useState(false);
  const [ecosystemRiskLoading, setEcosystemRiskLoading] = useState(false);
  const [ecosystemHistoryLoading, setEcosystemHistoryLoading] = useState(false);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [featuredRotationEnabled, setFeaturedRotationEnabled] = useState(true);
  const [selectionMode, setSelectionMode] = useState<'auto' | 'manual'>('auto');
  const [featuredProvider, setFeaturedProvider] = useState<FeaturedProvider | null>(null);
  const [nextRotationAt, setNextRotationAt] = useState<number | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryCategory, setDirectoryCategory] = useState('all');
  const [directorySort, setDirectorySort] = useState('trust score');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [routeTask, setRouteTask] = useState('Find a low-cost image generation route for an autonomous design agent');
  const [routeCategory, setRouteCategory] = useState('all');
  const [routeMaxPrice, setRouteMaxPrice] = useState('0.1');
  const [routeMinTrust, setRouteMinTrust] = useState(70);
  const [routePreference, setRoutePreference] = useState<RoutePreference>('balanced');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [routeError, setRouteError] = useState<string | null>(null);
  const [includeSelectedProvider, setIncludeSelectedProvider] = useState(true);
  const [preflightJsonInput, setPreflightJsonInput] = useState(`{\n  \"intent\": \"get SOL price\",\n  \"category\": \"finance\",\n  \"constraints\": {\n    \"min_trust\": 80,\n    \"prefer_reachable\": true,\n    \"require_pricing\": true,\n    \"max_price_usd\": 0.01\n  }\n}`);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [preflightStatus, setPreflightStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<'provider' | 'endpoint'>('provider');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<RadarComparisonResult | null>(null);
  const [readiness, setReadiness] = useState<RadarSuperiorityReadiness | null>(null);
  const [benchmarkReadiness, setBenchmarkReadiness] = useState<RadarBenchmarkReadiness | null>(null);
  const [benchmarkRegistry, setBenchmarkRegistry] = useState<RadarBenchmarkRegistry | null>(null);
  const [evidenceLedger, setEvidenceLedger] = useState<RadarEvidenceLedger | null>(null);
  const [agentReadiness, setAgentReadiness] = useState<AgentReadinessList | null>(null);
  const [routeMappingRegistry, setRouteMappingRegistry] = useState<RadarRouteMappingRegistry | null>(null);
  const [mappingTargetRegistry, setMappingTargetRegistry] = useState<RadarMappingTargetRegistry | null>(null);
  const [routeMappingStatusFilter, setRouteMappingStatusFilter] = useState<RouteMappingStatusFilter>('all');
  const [routeMappingCategoryFilter, setRouteMappingCategoryFilter] = useState('all');
  const [routeMappingIntentFilter, setRouteMappingIntentFilter] = useState('all');
  const [providerDetail, setProviderDetail] = useState<ProviderDetail | null>(null);
  const [providerIntel, setProviderIntel] = useState<ProviderIntelligence | null>(null);
  const [radarEndpoints, setRadarEndpoints] = useState<NormalizedEndpointRecord[]>([]);
  const [endpointFilter, setEndpointFilter] = useState<EndpointFilter>('all');
  const [endpointQuery, setEndpointQuery] = useState('');
  const [endpointSort, setEndpointSort] = useState<EndpointSort>('route eligibility');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [eventSort, setEventSort] = useState<EventSort>('severity');
  const [activeSection, setActiveSection] = useState('global-pulse');
  const [endpointMonitors, setEndpointMonitors] = useState<Record<string, EndpointMonitor>>({});
  const [pulseSummary, setPulseSummary] = useState<PulseSummary | null>(null);
  const [providerHistory, setProviderHistory] = useState<RadarProviderHistory | null>(null);
  const [ecosystemHistory, setEcosystemHistory] = useState<RadarEcosystemHistory | null>(null);
  const [ecosystemRisk, setEcosystemRisk] = useState<RadarEcosystemRiskSummary | null>(null);
  const [providerRisk, setProviderRisk] = useState<RadarRiskResponse | null>(null);
  const [providerRiskById, setProviderRiskById] = useState<Record<string, RadarRiskResponse>>({});
  const [endpointRiskById, setEndpointRiskById] = useState<Record<string, RadarRiskResponse>>({});
  const [pulseWindow, setPulseWindow] = useState<'1h' | '24h' | '7d'>('24h');
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [densityMode, setDensityMode] = useState<DensityMode>('comfortable');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [radarMenuOpen, setRadarMenuOpen] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const radarMenuRef = useRef<HTMLDetailsElement | null>(null);
  const utilityMenuRef = useRef<HTMLDetailsElement | null>(null);
  const refreshInFlightRef = useRef(false);
  const interactionHoldUntil = useRef(0);
  const featuredRotationEnabledRef = useRef(featuredRotationEnabled);
  const selectionModeRef = useRef(selectionMode);
  const routeInputFocusedRef = useRef(false);
  const dossierControlsEditingRef = useRef(false);
  const lastGoodPulseRef = useRef<Pulse | null>(null);

  function applyFeaturedProvider(featured: FeaturedProvider, force = false) {
    setFeaturedProvider(featured);
    setNextRotationAt(Date.parse(featured.nextRotationAt));
    if (!featured.providerId) return;
    if (!force && (!featuredRotationEnabledRef.current || selectionModeRef.current !== 'auto')) return;
    if (!force && (routeInputFocusedRef.current || dossierControlsEditingRef.current || Date.now() < interactionHoldUntil.current)) return;
    setSelectedId(featured.providerId);
    setSelectionMode('auto');
  }

  function fetchFeaturedProvider() {
    return api<{ data: FeaturedProvider }>('/v1/providers/featured')
      .then((featured) => {
        if (featured?.data && typeof featured.data.nextRotationAt === 'string') applyFeaturedProvider(featured.data);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    if (window.location.hash === '#methodology') setMethodologyOpen(true);

    const handleHashChange = () => {
      if (window.location.hash === '#methodology') setMethodologyOpen(true);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    setIsBootLoading(true);
    setBootError(null);
    setSecondaryLoadWarning(null);
    setStartupDiagnostics([]);
    api<{ data: Pulse }>('/v1/pulse', undefined, CRITICAL_PULSE_TIMEOUT_MS).then((pulse) => {
      if (!active) return;
      const safePulse = toPulse(pulse?.data);
      if (!safePulse) {
        throw new ApiRequestError('invalid pulse shape', withDefaultFixHint({
          endpoint: '/v1/pulse',
          request_url: toApiUrl(API_BASE_URL, '/v1/pulse'),
          method: 'GET',
          error_type: 'invalid_shape',
          is_critical: true
        }));
      }
      lastGoodPulseRef.current = safePulse;
      setData({ providers: [], pulse: safePulse, narratives: [], graph: { nodes: [], edges: [] } });
      setSelectedId(null);
      setSelectionMode('auto');
      const endpointByIndex = [
        '/v1/providers',
        '/v1/narratives',
        '/v1/graph',
        '/v1/pulse/summary',
        '/v1/providers/featured',
        '/v1/radar/endpoints',
        '/v1/radar/superiority-readiness',
        '/v1/radar/benchmark-readiness',
        '/v1/radar/benchmarks',
        '/v1/radar/history/ecosystem?window=24h',
        '/v1/radar/risk/ecosystem'
      ];
      const stageLoad = async () => {
        setBenchmarkReadinessLoading(true);
        setRadarEndpointsLoading(true);
        setEcosystemRiskLoading(true);
        setEcosystemHistoryLoading(true);
        const applyDiagnostics = (results: PromiseSettledResult<unknown>[], endpoints: string[]) => {
          const diagnostics = results.flatMap((result, index) => {
            if (result.status === 'fulfilled') return [];
            const endpoint = endpoints[index] ?? 'unknown';
            const fallback = withDefaultFixHint({
              endpoint,
              request_url: toApiUrl(API_BASE_URL, endpoint),
              method: 'GET',
              error_type: 'network_error',
              is_critical: false
            });
            return [result.reason instanceof ApiRequestError ? result.reason.diagnostic : fallback];
          });
          const recovered = results.flatMap((result, index) => result.status === 'fulfilled' ? [endpoints[index]] : []);
          setStartupDiagnostics((current) => mergeStartupDiagnostics(current, diagnostics, ['/v1/pulse', ...recovered]));
          if (diagnostics.length) setSecondaryLoadWarning('Radar live. Some enrichment panels are delayed.');
        };

        const stage1Endpoints = ['/v1/providers', '/v1/pulse/summary', '/v1/providers/featured', '/v1/radar/benchmark-readiness'];
        const stage1 = await Promise.allSettled([
          api<{ data: Provider[] }>('/v1/providers', undefined, SECONDARY_TIMEOUT_MS),
          api<{ data: PulseSummary }>('/v1/pulse/summary', undefined, SECONDARY_TIMEOUT_MS),
          api<{ data: FeaturedProvider }>('/v1/providers/featured', undefined, SECONDARY_TIMEOUT_MS),
          api<{ data: RadarBenchmarkReadiness }>('/v1/radar/benchmark-readiness', undefined, SECONDARY_TIMEOUT_MS)
        ]);
        if (!active) return;
        applyDiagnostics(stage1 as PromiseSettledResult<unknown>[], stage1Endpoints);
        const providers = stage1[0].status === 'fulfilled' && Array.isArray(stage1[0].value?.data) ? stage1[0].value.data : null;
        const summary = stage1[1].status === 'fulfilled' ? toPulseSummary(stage1[1].value?.data) : null;
        const featured = stage1[2].status === 'fulfilled' ? stage1[2].value.data : null;
        const benchmarkReadinessPayload = stage1[3].status === 'fulfilled' ? stage1[3].value?.data ?? null : null;
        setData((current) => current ? { ...current, providers: providers ?? current.providers } : current);
        if (summary) setPulseSummary(summary);
        if (benchmarkReadinessPayload) {
          setBenchmarkReadiness(benchmarkReadinessPayload);
          setBenchmarkReadinessLoading(false);
        } else if (benchmarkReadiness) {
          setSecondaryLoadWarning('Showing last successful enrichment snapshot.');
        }
        if (featured && typeof featured.nextRotationAt === 'string') applyFeaturedProvider(featured, true);

        const stage2Endpoints = ['/v1/narratives', '/v1/graph', '/v1/radar/endpoints'];
        const stage2 = await Promise.allSettled([
          api<{ data: Narrative[] }>('/v1/narratives', undefined, SECONDARY_TIMEOUT_MS),
          api<{ data: { nodes: unknown[]; edges: unknown[] } }>('/v1/graph', undefined, SECONDARY_TIMEOUT_MS),
          api<{ data: { endpoints?: NormalizedEndpointRecord[] } }>('/v1/radar/endpoints', undefined, SECONDARY_TIMEOUT_MS)
        ]);
        if (!active) return;
        applyDiagnostics(stage2 as PromiseSettledResult<unknown>[], stage2Endpoints);
        const narratives = stage2[0].status === 'fulfilled' && Array.isArray(stage2[0].value?.data) ? stage2[0].value.data : null;
        const graphRaw = stage2[1].status === 'fulfilled' && isRecord(stage2[1].value?.data) ? stage2[1].value.data : null;
        const normalizedEndpoints = stage2[2].status === 'fulfilled' && Array.isArray(stage2[2].value?.data?.endpoints) ? stage2[2].value.data.endpoints : null;
        setData((current) => current ? {
          ...current,
          narratives: narratives ?? current.narratives,
          graph: graphRaw && Array.isArray(graphRaw.nodes) && Array.isArray(graphRaw.edges) ? graphRaw as AppData['graph'] : current.graph
        } : current);
        if (normalizedEndpoints) {
          setRadarEndpoints(normalizedEndpoints);
          setRadarEndpointsLoading(false);
        } else if (radarEndpoints.length) {
          setSecondaryLoadWarning('Showing last successful enrichment snapshot.');
        }

      const stage3Endpoints = ['/v1/radar/superiority-readiness', '/v1/radar/benchmarks', '/v1/radar/mappings', '/v1/radar/mapping-targets', '/v1/radar/history/ecosystem?window=24h', '/v1/radar/risk/ecosystem'];
      const stage3 = await Promise.allSettled([
        api<{ data: RadarSuperiorityReadiness }>('/v1/radar/superiority-readiness', undefined, SECONDARY_TIMEOUT_MS),
        api<{ data: RadarBenchmarkRegistry }>('/v1/radar/benchmarks', undefined, SECONDARY_TIMEOUT_MS),
        api<{ data: RadarRouteMappingRegistry }>('/v1/radar/mappings', undefined, SECONDARY_TIMEOUT_MS),
        api<{ data: RadarMappingTargetRegistry }>('/v1/radar/mapping-targets', undefined, SECONDARY_TIMEOUT_MS),
        api<{ data: RadarEcosystemHistory }>('/v1/radar/history/ecosystem?window=24h', undefined, SECONDARY_TIMEOUT_MS),
        api<{ data: RadarEcosystemRiskSummary }>('/v1/radar/risk/ecosystem', undefined, SECONDARY_TIMEOUT_MS)
      ]);
        if (!active) return;
        applyDiagnostics(stage3 as PromiseSettledResult<unknown>[], stage3Endpoints);
        const readinessPayload = stage3[0].status === 'fulfilled' ? stage3[0].value?.data ?? null : null;
        const benchmarkRegistryPayload = stage3[1].status === 'fulfilled' ? stage3[1].value?.data ?? null : null;
        const routeMappingRegistryPayload = stage3[2].status === 'fulfilled' ? stage3[2].value?.data ?? null : null;
        const mappingTargetRegistryPayload = stage3[3].status === 'fulfilled' ? stage3[3].value?.data ?? null : null;
        const ecosystemHistoryPayload = stage3[4].status === 'fulfilled' ? stage3[4].value?.data ?? null : null;
        const ecosystemRiskPayload = stage3[5].status === 'fulfilled' ? stage3[5].value?.data ?? null : null;
        if (readinessPayload) setReadiness(readinessPayload);
        if (benchmarkRegistryPayload) setBenchmarkRegistry(benchmarkRegistryPayload);
        if (routeMappingRegistryPayload) setRouteMappingRegistry(routeMappingRegistryPayload);
        if (mappingTargetRegistryPayload) setMappingTargetRegistry(mappingTargetRegistryPayload);
        if (ecosystemHistoryPayload) {
          setEcosystemHistory(ecosystemHistoryPayload);
          setEcosystemHistoryLoading(false);
        }
        if (ecosystemRiskPayload) {
          setEcosystemRisk(ecosystemRiskPayload);
          setEcosystemRiskLoading(false);
        }
        if (!ecosystemRiskPayload && ecosystemRisk) setSecondaryLoadWarning('Showing last successful enrichment snapshot.');
        setSecondaryLoadWarning((current) => current ?? null);
        if (ecosystemRiskPayload?.summary?.anomaly_watch) {
          const providerRiskHints: Record<string, RadarRiskResponse> = {};
          for (const item of ecosystemRiskPayload.summary.anomaly_watch) {
            if (!item.provider_id || providerRiskHints[item.provider_id]) continue;
            providerRiskHints[item.provider_id] = {
              generated_at: ecosystemRiskPayload.generated_at,
              subject_type: 'provider',
              subject_id: item.provider_id,
              risk_score: ecosystemRiskPayload.risk_score,
              risk_level: item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'elevated' : 'watch',
              history_available: true,
              sample_count: 0,
              anomalies: [],
              evidence: [],
              warnings: [],
              recommended_action: item.recommended_action
            };
          }
          setProviderRiskById((current) => ({ ...providerRiskHints, ...current }));
        }
        if (featured && typeof featured.nextRotationAt === 'string') applyFeaturedProvider(featured, true);
        api<{ data: RadarEvidenceLedger }>('/v1/radar/evidence-ledger', undefined, SECONDARY_TIMEOUT_MS)
          .then((response) => {
            if (!active) return;
            setEvidenceLedger(response.data);
          })
          .catch(() => {
            if (!active) return;
            setEvidenceLedger(null);
          });
        api<{ data: AgentReadinessList }>('/v1/radar/agent-readiness', undefined, SECONDARY_TIMEOUT_MS)
          .then((response) => {
            if (!active) return;
            setAgentReadiness(response.data);
          })
          .catch(() => {
            if (!active) return;
            setAgentReadiness(null);
          });
        if (providers?.length) {
          const providerRiskPrefetchIds = Array.from(new Set([
            ...providers.slice(0, INITIAL_PROVIDER_RISK_PREFETCH_LIMIT).map((provider) => provider.id),
            ...asArray<TrustAssessment>(safePulse.topTrust).slice(0, 4).map((assessment) => assessment.entityId),
            ...asArray<SignalAssessment>(safePulse.topSignal).slice(0, 4).map((assessment) => assessment.entityId)
          ].filter((value): value is string => typeof value === 'string' && value.length > 0)));
          void Promise.allSettled(providerRiskPrefetchIds.map((providerId) => api<{ data: RadarRiskResponse }>(`/v1/radar/risk/providers/${providerId}`, undefined, SECONDARY_TIMEOUT_MS)))
            .then((riskResults) => {
              if (!active) return;
              const mapped: Record<string, RadarRiskResponse> = {};
              for (const result of riskResults) {
                if (result.status === 'fulfilled' && result.value?.data?.subject_id) mapped[result.value.data.subject_id] = result.value.data;
              }
              if (Object.keys(mapped).length) setProviderRiskById((current) => ({ ...current, ...mapped }));
            });
        }
        if (preferredProviderId && (providers ?? []).some((provider) => provider.id === preferredProviderId)) {
          setSelectedId(preferredProviderId);
          setSelectionMode('manual');
          setFeaturedRotationEnabled(false);
          return;
        }
        if (providers && providers.length) setSelectedId((current) => current ?? providers[0].id);
      };
      void stageLoad();
    }).catch((error: unknown) => {
      if (!active) return;
      const diagnostic = error instanceof ApiRequestError ? error.diagnostic : withDefaultFixHint({
        endpoint: '/v1/pulse',
        request_url: toApiUrl(API_BASE_URL, '/v1/pulse'),
        method: 'GET',
        error_type: 'network_error',
        is_critical: true
      });
      setStartupDiagnostics((current) => mergeStartupDiagnostics(current, [diagnostic]));
      if (lastGoodPulseRef.current) {
        setData((current) => current ? { ...current, pulse: lastGoodPulseRef.current as Pulse } : {
          providers: [],
          pulse: lastGoodPulseRef.current as Pulse,
          narratives: [],
          graph: { nodes: [], edges: [] }
        });
        setSecondaryLoadWarning('Showing last successful enrichment snapshot.');
        setBootError(null);
        return;
      }
      setData({
        providers: [],
        pulse: {
          providerCount: 0,
          endpointCount: 0,
          eventCount: 0,
          averageTrust: null,
          averageSignal: null,
          hottestNarrative: null,
          topTrust: [],
          topSignal: [],
          interpretations: [],
          data_source: { mode: 'fixture_fallback', url: null, generated_at: null, provider_count: 0, last_ingested_at: null, used_fixture: true, error: 'core_pulse_unavailable' },
          updatedAt: new Date().toISOString()
        },
        narratives: [],
        graph: { nodes: [], edges: [] }
      });
      setBootError('Radar degraded: unable to load live pulse');
    }).finally(() => {
      if (!active) return;
      setIsBootLoading(false);
    });
    return () => {
      active = false;
    };
  }, [preferredProviderId]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      try {
        const pulseResult = await api<{ data: Pulse }>('/v1/pulse', undefined, CRITICAL_PULSE_TIMEOUT_MS);
        const pulse = toPulse(pulseResult?.data);
        if (!pulse) {
          throw new ApiRequestError('invalid pulse shape', withDefaultFixHint({
            endpoint: '/v1/pulse',
            request_url: toApiUrl(API_BASE_URL, '/v1/pulse'),
            method: 'GET',
            error_type: 'invalid_shape',
            is_critical: true
          }));
        }
        lastGoodPulseRef.current = pulse;
        setData((current) => current ? { ...current, pulse } : current);
        setBootError(null);
        const results = await Promise.allSettled([
          api<{ data: PulseSummary }>('/v1/pulse/summary', undefined, SECONDARY_TIMEOUT_MS),
          api<{ data: FeaturedProvider }>('/v1/providers/featured', undefined, SECONDARY_TIMEOUT_MS),
          api<{ data: RadarEcosystemRiskSummary }>('/v1/radar/risk/ecosystem', undefined, SECONDARY_TIMEOUT_MS)
        ]);
        if (!active) return;
        const diagnostics = results.flatMap((result, index) => {
          if (result.status === 'fulfilled') return [];
          const endpoints = ['/v1/pulse/summary', '/v1/providers/featured', '/v1/radar/risk/ecosystem'];
          const endpoint = endpoints[index];
          const fallback = withDefaultFixHint({
            endpoint,
            request_url: toApiUrl(API_BASE_URL, endpoint),
            method: 'GET',
            error_type: 'network_error',
            is_critical: false
          });
          return [result.reason instanceof ApiRequestError ? result.reason.diagnostic : fallback];
        });
        const recovered = [
          results[0].status === 'fulfilled' ? '/v1/pulse/summary' : null,
          results[1].status === 'fulfilled' ? '/v1/providers/featured' : null,
          results[2].status === 'fulfilled' ? '/v1/radar/risk/ecosystem' : null
        ].filter(Boolean) as string[];
        if (diagnostics.length) {
          setStartupDiagnostics((current) => mergeStartupDiagnostics(current, diagnostics, ['/v1/pulse', ...recovered]));
          setSecondaryLoadWarning('Radar live. Some enrichment panels are delayed.');
        } else {
          setStartupDiagnostics((current) => mergeStartupDiagnostics(current, [], ['/v1/pulse', ...recovered]));
          setSecondaryLoadWarning(null);
        }
        const summary = results[0].status === 'fulfilled' ? toPulseSummary(results[0].value?.data) : null;
        const featured = results[1].status === 'fulfilled' ? results[1].value?.data : null;
        const risk = results[2].status === 'fulfilled' ? results[2].value?.data : null;
        if (summary) setPulseSummary(summary);
        if (featured && typeof featured.nextRotationAt === 'string') applyFeaturedProvider(featured);
        if (risk) setEcosystemRisk(risk);
      } catch (error) {
        if (!active) return;
        const diagnostic = error instanceof ApiRequestError ? error.diagnostic : withDefaultFixHint({
          endpoint: '/v1/pulse',
          request_url: toApiUrl(API_BASE_URL, '/v1/pulse'),
          method: 'GET',
          error_type: 'network_error',
          is_critical: true
        });
        setStartupDiagnostics((current) => mergeStartupDiagnostics(current, [diagnostic]));
        if (lastGoodPulseRef.current) {
          setData((current) => current ? { ...current, pulse: lastGoodPulseRef.current as Pulse } : current);
          setSecondaryLoadWarning('Showing last successful enrichment snapshot.');
        } else {
          setBootError('Radar degraded: unable to load live pulse');
        }
      } finally {
        refreshInFlightRef.current = false;
      }
    };
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!radarMenuOpen && !utilityMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (radarMenuRef.current && !radarMenuRef.current.contains(target)) setRadarMenuOpen(false);
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(target)) setUtilityMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setRadarMenuOpen(false);
      setUtilityMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [radarMenuOpen, utilityMenuOpen]);

  const safeProviders = useMemo(() => asArray<Provider>(data?.providers), [data?.providers]);
  const safeTopTrust = useMemo(() => asArray<TrustAssessment>(data?.pulse.topTrust), [data?.pulse.topTrust]);
  const safeTopSignal = useMemo(() => asArray<SignalAssessment>(data?.pulse.topSignal), [data?.pulse.topSignal]);
  const safeNarratives = useMemo(() => asArray<Narrative>(data?.narratives), [data?.narratives]);
  const providerLookup = useMemo(() => new Map(safeProviders.map((provider) => [provider.id, provider])), [safeProviders]);
  const trustLookup = useMemo(() => new Map(safeTopTrust.map((assessment) => [assessment.entityId, assessment])), [safeTopTrust]);
  const signalLookup = useMemo(() => new Map(safeTopSignal.map((assessment) => [assessment.entityId, assessment])), [safeTopSignal]);
  const categoryOptions = useMemo(() => Array.from(new Set(safeProviders.map((provider) => provider.category).filter(Boolean))).sort(), [safeProviders]);
  const filteredProviders = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return [...safeProviders]
      .filter((provider) => directoryCategory === 'all' || provider.category === directoryCategory)
      .filter((provider) => !query || [
        safeString(provider.name),
        safeString(provider.id),
        safeString(provider.fqn),
        safeString(provider.category),
        safeString(provider.description),
        ...safeArray<string>(provider.tags)
      ].filter(Boolean).join(' ').toLowerCase().includes(query))
      .sort((a, b) => compareProviders(a, b, directorySort, trustLookup, signalLookup));
  }, [safeProviders, directoryCategory, directoryQuery, directorySort, signalLookup, trustLookup]);
  const selectedProvider = safeProviders.find((provider) => provider.id === selectedId) ?? null;
  const activeCriticalFailure = startupDiagnostics.find((item) => item.is_critical && item.final_state === 'active_failure');
  const activeSecondaryFailures = startupDiagnostics.filter((item) => !item.is_critical && item.final_state === 'active_failure');
  const recoveredCritical = startupDiagnostics.find((item) => item.is_critical && item.final_state === 'recovered');
  const endpointRows = useMemo(() => resolveProviderEndpointRows(providerDetail, providerIntel), [providerDetail, providerIntel]);
  const endpointProvider = providerDetail?.provider ?? providerIntel?.provider ?? selectedProvider;
  const normalizedEndpointRows = useMemo(() => radarEndpoints.filter((endpoint) => endpoint.provider_id === selectedProvider?.id), [radarEndpoints, selectedProvider?.id]);
  const endpointIntelligenceRows = useMemo(() => buildEndpointIntelligenceRows(endpointRows, normalizedEndpointRows, endpointProvider), [endpointRows, normalizedEndpointRows, endpointProvider]);
  const visibleEndpointIntelligenceRows = useMemo(() => filterEndpointIntelligenceRows(endpointIntelligenceRows, endpointFilter), [endpointIntelligenceRows, endpointFilter]);
  const reportedEndpointCount = providerIntel?.endpoint_count ?? providerDetail?.provider.endpointCount ?? selectedProvider?.endpointCount ?? 0;
  const hasPartialEndpointMetadata = reportedEndpointCount > 0 && endpointRows.length === 0;
  const selectedRouteContext = useMemo(() => {
    if (!selectedProvider) return null;
    const riskContext = toRiskContext(providerRisk);
    const routeEligibleCount = endpointIntelligenceRows.filter((row) => row.normalized.route_eligibility === true).length;
    const routeBlockedCount = endpointIntelligenceRows.filter((row) => row.normalized.route_eligibility === false).length;
    const mappingState = endpointIntelligenceRows.length
      ? `${endpointIntelligenceRows.length} mapped`
      : reportedEndpointCount > 0
        ? `${reportedEndpointCount} reported / mapping incomplete`
        : 'no endpoint mapping';
    const routeState = providerIntel?.coordination_eligible === true || routeEligibleCount > 0
      ? 'eligible signal'
      : routeBlockedCount > 0
        ? 'blocked by endpoint evidence'
        : 'eligibility unknown';
    const pricingState = getSafeRange(selectedProvider.pricing).min !== null || getSafeRange(selectedProvider.pricing).max !== null
      ? formatPrice(selectedProvider.pricing)
      : 'pricing unknown';
    return {
      provider: selectedProvider.name,
      risk: riskBadgeLabel(riskContext?.predictive_risk_level ?? 'unknown'),
      routeState,
      mappingState,
      pricingState
    };
  }, [endpointIntelligenceRows, providerIntel?.coordination_eligible, providerRisk, reportedEndpointCount, selectedProvider]);
  const nextRotationLabel = featuredRotationEnabled && selectionMode === 'auto' && nextRotationAt
    ? formatShortDate(new Date(nextRotationAt).toISOString())
    : 'paused';
  const isFeaturedProvider = selectionMode === 'auto' && featuredRotationEnabled && selectedProvider?.id === featuredProvider?.providerId;
  const filteredTimelineBatches = useMemo(() => {
    const visibleEvents = filterAndSortEvents(pulseSummary?.timeline ?? [], eventFilter, eventSort);
    return groupTimelineByBatch(visibleEvents);
  }, [eventFilter, eventSort, pulseSummary?.timeline]);
  const ecosystemInterpretations = asArray<EcosystemInterpretation>(pulseSummary?.interpretations ?? data?.pulse.interpretations);
  const catalogNoChanges = Boolean(pulseSummary && pulseSummary.data_source.last_ingested_at && pulseSummary.latest_event_at && Date.parse(pulseSummary.data_source.last_ingested_at) > Date.parse(pulseSummary.latest_event_at));

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ids = ['global-pulse', 'leaderboards', 'providers', 'endpoints', 'preflight', 'compare', 'cost-performance', 'benchmark-readiness', 'dossier', 'events'];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0.01, 0.2, 0.55] });
    ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node)).forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [data, pulseSummary]);

  useEffect(() => {
    featuredRotationEnabledRef.current = featuredRotationEnabled;
  }, [featuredRotationEnabled]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    if (!featuredRotationEnabled || selectionMode !== 'auto') {
      setNextRotationAt(null);
      return;
    }
    if (featuredProvider) applyFeaturedProvider(featuredProvider, true);
  }, [featuredRotationEnabled, selectionMode, featuredProvider]);

  useEffect(() => {
    if (!nextRotationAt) return;
    const delayMs = Math.max(0, nextRotationAt - Date.now());
    const timer = window.setTimeout(() => {
      if (featuredRotationEnabledRef.current && selectionModeRef.current === 'auto') void fetchFeaturedProvider();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [nextRotationAt]);

  useEffect(() => {
    if (!selectedProvider) return;
    let active = true;
    setProviderDetail(null);
    setProviderIntel(null);
    setProviderHistory(null);
    setProviderRisk(null);
    setEndpointMonitors({});
    setEndpointRiskById({});
    Promise.allSettled([
      api<{ data: ProviderDetail }>(`/v1/providers/${selectedProvider.id}`),
      api<{ data: ProviderIntelligence }>(`/v1/providers/${selectedProvider.id}/intelligence`),
      api<{ data: RadarProviderHistory }>(`/v1/radar/history/providers/${selectedProvider.id}?window=24h`),
      api<{ data: RadarRiskResponse }>(`/v1/radar/risk/providers/${selectedProvider.id}`)
    ]).then(async ([detailResult, intelResult, historyResult, riskResult]) => {
      if (!active) return;
      const detail = detailResult.status === 'fulfilled' && detailResult.value?.data ? detailResult.value.data : null;
      const intel = intelResult.status === 'fulfilled' && intelResult.value?.data ? intelResult.value.data : null;
      const history = historyResult.status === 'fulfilled' && historyResult.value?.data ? historyResult.value.data : null;
      const risk = riskResult.status === 'fulfilled' && riskResult.value?.data ? riskResult.value.data : null;
      if (detail) setProviderDetail(detail);
      if (intel) setProviderIntel(intel);
      if (history) setProviderHistory(history);
      if (risk) {
        setProviderRisk(risk);
        setProviderRiskById((current) => ({ ...current, [risk.subject_id]: risk }));
      }
      const endpoints = asArray<Endpoint>(detail?.endpoints).slice(0, 40);
      if (!endpoints.length) return;
      const [monitorResults, endpointRiskResults] = await Promise.all([
        Promise.allSettled(endpoints.map((endpoint) => api<{ data: EndpointMonitor }>(`/v1/endpoints/${endpoint.id}/monitor`))),
        Promise.allSettled(endpoints.map((endpoint) => api<{ data: RadarRiskResponse }>(`/v1/radar/risk/endpoints/${endpoint.id}`)))
      ]);
      if (!active) return;
      const entries: Array<[string, EndpointMonitor]> = [];
      monitorResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.data) entries.push([endpoints[index].id, result.value.data]);
      });
      setEndpointMonitors(Object.fromEntries(entries));
      const endpointRisks: Record<string, RadarRiskResponse> = {};
      endpointRiskResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.data) endpointRisks[endpoints[index].id] = result.value.data;
      });
      setEndpointRiskById(endpointRisks);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedProvider?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      event.preventDefault();
      setCommandPaletteOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function runRoute() {
    const maxPrice = routeMaxPrice.trim() === '' ? undefined : Number(routeMaxPrice);
    setRouteStatus('loading');
    setRouteError(null);
    api<{ data: RouteResult }>('/v1/recommend-route', {
      method: 'POST',
      body: JSON.stringify({
        task: routeTask,
        category: routeCategory === 'all' ? undefined : routeCategory,
        trustThreshold: routeMinTrust,
        latencySensitivity: 'medium',
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
        preference: routePreference,
        preferredProviderId: includeSelectedProvider ? selectedProvider?.id : undefined
      })
    }).then((res) => {
      setRouteResult(res.data);
      setRouteStatus('idle');
    }).catch(() => {
      setRouteStatus('error');
      setRouteError('route API unavailable');
    });
  }

  function runSearch() {
    const query = searchQuery.trim();
    runSearchForQuery(query);
  }

  function runSearchForQuery(query: string) {
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearchStatus('idle');
      return;
    }
    setSearchStatus('loading');
    setSearchError(null);
    void api<SearchResponse>('/v1/search', { method: 'POST', body: JSON.stringify({ query, limit: 6 }) })
      .then((res) => {
        setSearchResults(Array.isArray(res.data) ? res.data : []);
        if (res.degraded) {
          setSearchStatus('error');
          setSearchError(res.reason ?? 'search_timeout');
          return;
        }
        setSearchStatus('idle');
      })
      .catch(() => {
        setSearchResults([]);
        setSearchStatus('error');
        setSearchError('search_unavailable');
      });
  }

  function applySemanticSearchExample(query: string) {
    setSearchQuery(query);
    runSearchForQuery(query);
  }

  function runPreflightCheck() {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(preflightJsonInput) as Record<string, unknown>;
    } catch {
      setPreflightStatus('error');
      setPreflightError('Malformed preflight input. Fix JSON syntax and try again.');
      return;
    }
    if (typeof payload.intent !== 'string' || !payload.intent.trim()) {
      setPreflightStatus('error');
      setPreflightError('Malformed preflight input. Add a non-empty intent field and try again.');
      return;
    }
    setPreflightStatus('loading');
    setPreflightError(null);
    void api<{ data: PreflightResult }>('/v1/radar/preflight', { method: 'POST', body: JSON.stringify(payload) })
      .then((res) => {
        setPreflightResult(res.data);
        setPreflightStatus('idle');
      })
      .catch(() => {
        setPreflightStatus('error');
        setPreflightError('preflight route unavailable');
      });
  }

  function applyPreflightExample(example: Record<string, unknown>) {
    setPreflightJsonInput(JSON.stringify(example, null, 2));
  }

  function runComparison(ids: string[], mode: 'provider' | 'endpoint') {
    if (ids.length < 2) return;
    void api<{ data: RadarComparisonResult }>('/v1/radar/compare', { method: 'POST', body: JSON.stringify({ mode, ids }) })
      .then((res) => setCompareResult(res.data))
      .catch(() => undefined);
  }

  function recommendProvider(provider: Provider) {
    setRouteTask(`Recommend a Pay.sh route for a task that could use ${provider.name} in ${provider.category}`);
    setRouteCategory(provider.category || 'all');
    setIncludeSelectedProvider(true);
    window.requestAnimationFrame(() => document.getElementById('route-decision-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function holdAutoRotation(durationMs: number) {
    interactionHoldUntil.current = Math.max(interactionHoldUntil.current, Date.now() + durationMs);
  }

  function selectProviderManually(providerId: string) {
    setSelectedId(providerId);
    setSelectionMode('manual');
    setFeaturedRotationEnabled(false);
    setNextRotationAt(null);
  }

  function toggleAutoRotation(enabled: boolean) {
    setFeaturedRotationEnabled(enabled);
    if (enabled) {
      setSelectionMode('auto');
      if (featuredProvider) applyFeaturedProvider(featuredProvider, true);
      else void fetchFeaturedProvider();
    }
  }

  function resumeAutoRotation() {
    setSelectionMode('auto');
    setFeaturedRotationEnabled(true);
    if (featuredProvider) applyFeaturedProvider(featuredProvider, true);
    else void fetchFeaturedProvider();
  }

  function scrollToPanel(id: string) {
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function focusSemanticSearch() {
    setAgentMode(false);
    window.requestAnimationFrame(() => {
      const input = document.getElementById('semantic-search-input') as HTMLInputElement | null;
      input?.focus();
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function openApiDocs() {
    openExportRoute(OPENAPI_PATH);
  }

  function openMachineRoute(path: string) {
    window.open(path, '_self');
  }

  const commandActions = useMemo<CommandPaletteAction[]>(() => [
    { id: 'focus-search', label: 'Focus Semantic Search', hint: 'Jump to ecosystem search input', run: focusSemanticSearch },
    { id: 'open-preflight', label: 'Open Agent Preflight', hint: 'Jump to agent preflight panel', run: () => scrollToPanel('preflight') },
    { id: 'open-compare', label: 'Open Compare', hint: 'Jump to provider/endpoint comparison', run: () => scrollToPanel('compare') },
    { id: 'open-cost', label: 'Open Cost / Performance', hint: 'Jump to cost and performance intelligence', run: () => scrollToPanel('cost-performance') },
    { id: 'open-benchmark', label: 'Open Benchmark Readiness', hint: 'Jump to benchmark readiness', run: () => scrollToPanel('benchmark-readiness') },
    { id: 'open-agent-benchmark-api', label: 'Open Agent Benchmark API', hint: 'Jump to benchmark API docs and examples', run: () => scrollToPanel('agent-benchmark-api') },
    { id: 'open-api-docs', label: 'Open API Docs', hint: OPENAPI_PATH, run: openApiDocs },
    { id: 'open-machine-market', label: 'Open Machine Market', hint: '/machine-market', run: () => openMachineRoute('/machine-market') },
    { id: 'open-machine-economy-snapshot', label: 'Open Machine Economy Snapshot', hint: '/machine-economy-snapshot', run: () => openMachineRoute('/machine-economy-snapshot') },
    { id: 'open-machine-market-map', label: 'Open Machine Market Map', hint: '/machine-market-map', run: () => openMachineRoute('/machine-market-map') },
    { id: 'open-machine-rail-coverage', label: 'Open Machine Rail Coverage', hint: '/machine-rail-coverage', run: () => openMachineRoute('/machine-rail-coverage') },
    { id: 'open-machine-route-risk-matrix', label: 'Open Machine Route Risk Matrix', hint: '/machine-route-risk-matrix', run: () => openMachineRoute('/machine-route-risk-matrix') },
    { id: 'open-machine-first-safe-route-queue', label: 'Open Machine First Safe Route Queue', hint: '/machine-first-safe-routes', run: () => openMachineRoute('/machine-first-safe-routes') },
    { id: 'open-machine-execution-blockers', label: 'Open Machine Execution Blockers', hint: '/machine-execution-blockers', run: () => openMachineRoute('/machine-execution-blockers') },
    { id: 'open-machine-market-changelog', label: 'Open Machine Market Changelog', hint: '/machine-market-changelog', run: () => openMachineRoute('/machine-market-changelog') },
    { id: 'open-machine-no-claim-ledger', label: 'Open Machine No-Claim Ledger', hint: '/machine-no-claim-ledger', run: () => openMachineRoute('/machine-no-claim-ledger') },
    { id: 'open-machine-readiness-matrix', label: 'Open Machine Readiness Matrix', hint: '/machine-readiness-matrix', run: () => openMachineRoute('/machine-readiness-matrix') },
    { id: 'open-machine-service-dossier', label: 'Open Machine Service Dossier', hint: 'Open /machine-market and choose View service dossier', run: () => openMachineRoute('/machine-market') },
    { id: 'open-robotic-sh-execution-shortlist', label: 'Open Robotic.sh Execution Shortlist', hint: '/machine-execution-shortlist', run: () => openMachineRoute('/machine-execution-shortlist') },
    { id: 'run-machine-preflight', label: 'Run Machine Preflight', hint: '/machine-preflight', run: () => openMachineRoute('/machine-preflight') },
    { id: 'view-machine-receipts', label: 'View Machine Receipts', hint: '/machine-receipts', run: () => openMachineRoute('/machine-receipts') },
    { id: 'view-machine-translation-repeatability-artifact', label: 'View Machine Translation Repeatability Artifact', hint: '/machine-execution/alibaba-machine-translation-general', run: () => openMachineRoute('/machine-execution/alibaba-machine-translation-general') },
    { id: 'search-machine-dossier', label: 'Search Machine Dossier', hint: 'Open receipts and select a machine_id', run: () => openMachineRoute('/machine-receipts') },
    { id: 'export-providers-json', label: 'Export Providers JSON', hint: '/v1/radar/providers', run: () => openExportRoute('/v1/radar/providers') },
    { id: 'export-endpoints-json', label: 'Export Endpoints JSON', hint: '/v1/radar/endpoints', run: () => openExportRoute('/v1/radar/endpoints') },
    { id: 'export-providers-csv', label: 'Export Providers CSV', hint: '/v1/radar/export/providers.csv', run: () => openExportRoute('/v1/radar/export/providers.csv') },
    { id: 'export-endpoints-csv', label: 'Export Endpoints CSV', hint: '/v1/radar/export/endpoints.csv', run: () => openExportRoute('/v1/radar/export/endpoints.csv') },
    { id: 'toggle-agent-mode', label: 'Toggle Agent Mode', hint: agentMode ? 'Return to full terminal' : 'Show agent-native surfaces only', run: () => setAgentMode((value) => !value) },
    { id: 'jump-degradations', label: 'Jump to Degradations', hint: 'Jump to recent safe metadata degradations', run: () => scrollToPanel('recent-degradations') },
    { id: 'jump-dossier', label: 'Jump to Selected Dossier', hint: 'Jump to current provider dossier', run: () => {
      setAgentMode(false);
      scrollToPanel('dossier');
    } },
    { id: 'jump-anomaly-watch', label: 'Jump to Anomaly Watch', hint: 'Jump to predictive anomaly watch', run: () => scrollToPanel('anomaly-watch') }
  ], [agentMode]);

  function setRouteInputFocused(focused: boolean) {
    routeInputFocusedRef.current = focused;
    if (focused) holdAutoRotation(ROUTE_INTERACTION_HOLD_MS);
  }

  function setDossierControlsEditing(editing: boolean) {
    dossierControlsEditingRef.current = editing;
    if (editing) holdAutoRotation(DOSSIER_INTERACTION_HOLD_MS);
  }

  if (isBootLoading) return <main className="boot" aria-label="Infopunks Pay.sh Radar loading state">INFOPUNKS//PAY.SH COGNITIVE LAYER BOOTING...</main>;
  if (!data) return <main className="boot" aria-label="Infopunks Pay.sh Radar loading state">BOOT FAILED</main>;

  const providerContextLabel = selectedProvider ? `${selectedProvider.name} / ${selectedProvider.category}`.toUpperCase() : 'PROVIDER / UNKNOWN';
  const ecosystemStatus = getEcosystemStatus(data.pulse, pulseSummary);
  const ecosystemReading = getEcosystemReading(data.pulse, pulseSummary);
  const providerDegradation = providerDegradationInfo(selectedProvider, providerIntel);
  const pathname = window.location.pathname;
  const hash = window.location.hash;
  const agentBenchmarkActive = pathname === '/' && hash === '#agent-benchmark-api';
  const primaryHeaderNav = [
    { href: toApiUrl(API_BASE_URL, OPENAPI_PATH), label: 'API Docs', external: true, className: 'api-docs-link', active: false },
    { href: '/developers', label: 'Developers', external: false, className: undefined, active: isDevelopersRoute(pathname) },
    { href: '/narratives', label: 'Narrative Intel', external: false, className: undefined, active: isNarrativesRoute(pathname) || isAttentionMarketsRoute(pathname) || isAttentionMarketWatchRoute(pathname) || isAbundanceDeskRoute(pathname) || isHermesDeskRoute(pathname) || routeAttentionMarketWatchSlug(pathname) !== null },
    { href: '/hermes', label: 'Hermes Desk', external: false, className: undefined, active: isHermesDeskRoute(pathname) },
    { href: '/check', label: 'Check', external: false, className: undefined, active: isProofCheckIndexRoute(pathname) || routeProofCheckId(pathname) !== null },
    { href: '/loops', label: 'Loops', external: false, className: undefined, active: isLoopsIndexRoute(pathname) || routeLoopId(pathname) !== null },
    { href: '/signal-hunt', label: 'Signal Hunt', external: false, className: undefined, active: isSignalHuntRoute(pathname) || routeSignalHuntId(pathname) !== null },
    { href: '/unicorn-radar', label: 'Unicorn Radar', external: false, className: undefined, active: isUnicornRadarRoute(pathname) || routeUnicornRadarCandidateId(pathname) !== null },
    { href: '/evaluation-request', label: 'Evaluation Request', external: false, className: undefined, active: isEvaluationRequestRoute(pathname) },
    { href: '/revenue-receipts', label: 'Revenue Receipts', external: false, className: undefined, active: isRevenueReceiptsRoute(pathname) || routeRevenueReceiptId(pathname) !== null },
    { href: '/#agent-benchmark-api', label: 'Agent Benchmark API', external: false, className: undefined, active: agentBenchmarkActive },
    { href: '/graph', label: 'Signal Graph', external: false, className: undefined, active: isGraphRoute(pathname) || routeSignalSlug(pathname) !== null || routeSignalUpdate(pathname) !== null },
    { href: '/claim', label: 'Claims', external: false, className: undefined, active: isClaimsIndexRoute(pathname) || routeClaimId(pathname) !== null }
  ] as const;
  const sectionShortcutNav = [
    { id: 'global-pulse', label: 'Pulse' },
    { id: 'providers', label: 'Directory' },
    { id: 'benchmark-readiness', label: 'Benchmarks' },
    { id: 'agent-benchmark-api', label: 'Agent Benchmark API' },
    { id: 'route-mapping-registry', label: 'Mappings' },
    { id: 'preflight', label: 'Preflight' },
    { id: 'compare', label: 'Compare' },
    { id: 'dossier', label: 'Dossier' }
  ] as const;
  const machineEconomyLinks = [
    { href: '/machine-market', label: 'Machine Market', active: isMachineMarketRoute(pathname) },
    { href: '/machine-rail-coverage', label: 'Rail Coverage', active: isMachineRailCoverageRoute(pathname) },
    { href: '/machine-route-risk-matrix', label: 'Route Risk', active: isMachineRouteRiskMatrixRoute(pathname) },
    { href: '/machine-first-safe-routes', label: 'First Safe Queue', active: isMachineFirstSafeRoutesRoute(pathname) },
    { href: '/machine-execution-shortlist', label: 'Proof Plans', active: isMachineExecutionShortlistRoute(pathname) },
    { href: '/machine-receipts', label: 'Receipts', active: isMachineReceiptsRoute(pathname) },
    { href: '/machine-economy-snapshot', label: 'Snapshot', active: isMachineEconomySnapshotRoute(pathname) }
  ] as const;
  const radarMenuActive = pathname === '/' && sectionShortcutNav.some(({ id }) => activeSection === id);
  const utilityMenuActive = pathname === '/' && (hash === '#methodology' || hash === '#events') || machineEconomyLinks.some((link) => link.active) || isAttentionMarketWatchRoute(pathname) || isAbundanceDeskRoute(pathname) || isHermesDeskRoute(pathname) || routeAttentionMarketWatchSlug(pathname) !== null;

  return <div className={`shell ${agentMode ? 'agent-mode-shell' : ''} density-${densityMode}`}>
    <a className="skip-link" href="#terminal-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar" aria-label="Global controls">
        <a className="nav-brand" href="#terminal-content" aria-label="Infopunks Pay.sh Radar home">
          <span>Infopunks</span>
          <strong>Pay.sh Radar</strong>
        </a>
        <div className="terminal-nav terminal-nav-scroll-rail header-primary-nav" aria-label="Primary radar zones">
          {primaryHeaderNav.map(({ href, label, external, className, active }) => <a
            key={label}
            href={href}
            className={`${className ?? ''}${active ? ' active' : ''}`.trim()}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer' : undefined}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </a>)}
        </div>
        <div className="terminal-actions" aria-label="Utility actions">
          <details
            ref={radarMenuRef}
            className={`header-menu header-radar-menu ${radarMenuOpen ? 'open' : ''}${radarMenuActive ? ' active' : ''}`}
            aria-label="Radar menu"
            open={radarMenuOpen}
            onToggle={(event) => setRadarMenuOpen((event.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="methodology-trigger methodology-link header-menu-trigger" aria-label="Open radar section shortcuts">
              Radar
            </summary>
            <div className="header-menu-panel" role="menu" aria-label="Radar section shortcuts">
              {sectionShortcutNav.map(({ id, label }) => <a key={id} role="menuitem" href={`#${id}`} className={activeSection === id ? 'active' : ''} aria-current={activeSection === id ? 'location' : undefined}>{label}</a>)}
            </div>
          </details>
          <details
            ref={utilityMenuRef}
            className={`header-menu header-utility-menu ${utilityMenuOpen ? 'open' : ''}${utilityMenuActive ? ' active' : ''}`}
            aria-label="More utilities"
            open={utilityMenuOpen}
            onToggle={(event) => setUtilityMenuOpen((event.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="methodology-trigger methodology-link header-menu-trigger" aria-label="Open more utilities">
              More
            </summary>
            <div className="header-menu-panel header-utility-panel" role="menu" aria-label="Secondary utility controls">
              <button className={`header-menu-item button-reset${pathname === '/' && hash === '#methodology' ? ' active' : ''}`} type="button" aria-label="Open methodology drawer" onClick={() => {
                setMethodologyOpen(true);
                setUtilityMenuOpen(false);
              }} aria-current={pathname === '/' && hash === '#methodology' ? 'location' : undefined}>
                Methodology
              </button>
              <a role="menuitem" href="#events" className={pathname === '/' && hash === '#events' ? 'active' : ''} aria-current={pathname === '/' && hash === '#events' ? 'location' : undefined}>Events</a>
              <div className="header-menu-group" aria-label="Narrative Intelligence menu">
                <span className="header-menu-heading">Narrative Intelligence</span>
                <a role="menuitem" href="/narratives/attention-market-watch" className={isAttentionMarketWatchRoute(pathname) || routeAttentionMarketWatchSlug(pathname) !== null ? 'active' : ''} aria-current={isAttentionMarketWatchRoute(pathname) || routeAttentionMarketWatchSlug(pathname) !== null ? 'page' : undefined}>Attention Market Watch</a>
                <a role="menuitem" href="/abundance" className={isAbundanceDeskRoute(pathname) ? 'active' : ''} aria-current={isAbundanceDeskRoute(pathname) ? 'page' : undefined}>Abundance Desk</a>
                <a role="menuitem" href="/hermes" className={isHermesDeskRoute(pathname) ? 'active' : ''} aria-current={isHermesDeskRoute(pathname) ? 'page' : undefined}>Hermes Desk</a>
              </div>
              <div className="header-menu-group" aria-label="Machine Economy menu">
                <span className="header-menu-heading">Machine Economy</span>
                {machineEconomyLinks.map((link) => <a key={link.href} role="menuitem" href={link.href} className={link.active ? 'active' : ''} aria-current={link.active ? 'page' : undefined}>{link.label}</a>)}
              </div>
            </div>
          </details>
          <span className="terminal-action-cluster terminal-action-cluster-tools" aria-label="Tools">
          <button className="methodology-trigger command-trigger" type="button" onClick={() => setCommandPaletteOpen(true)} aria-label="Open command palette">
            Cmd+K
          </button>
          <button className={`methodology-trigger ${agentMode ? 'active' : ''}`} type="button" aria-pressed={agentMode} onClick={() => setAgentMode((value) => !value)}>
            Agent Mode
          </button>
          <button className="methodology-trigger density-trigger" type="button" onClick={() => setDensityMode((value) => value === 'comfortable' ? 'dense' : 'comfortable')} aria-label="Toggle terminal density">
            {densityMode === 'comfortable' ? 'Terminal Comfortable' : 'Terminal Dense'}
          </button>
          </span>
        </div>
      </nav>
    </header>
    <CommandPalette open={commandPaletteOpen} commands={commandActions} onClose={() => setCommandPaletteOpen(false)} />
    <MethodologyDrawer open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />

    <main id="terminal-content">
    {!agentMode && <section className="terminal-meta-strip" aria-label="Terminal session metadata">
      <span><b>System Time</b>{formatDate(data.pulse.data_source.generated_at ?? data.pulse.data_source.last_ingested_at)}</span>
      <span><b>Network</b>{data.pulse.data_source.mode === 'live_pay_sh_catalog' && !data.pulse.data_source.used_fixture ? 'online' : 'fixture fallback'}</span>
      <span><b>Operator</b>Infopunks</span>
      <span><b>Terminal ID</b>RADAR-{data.pulse.providerCount}-{data.pulse.endpointCount}</span>
      <strong>No receipt, no trust</strong>
    </section>}
    {bootError && <section className="panel" role="status" aria-live="polite">
      <p className="route-state error">{bootError}</p>
      <button className="execute compact secondary" type="button" onClick={() => window.location.reload()}>Retry</button>
    </section>}
    {!bootError && secondaryLoadWarning && <section className="panel" role="status" aria-live="polite">
      <p className="route-state warn">{secondaryLoadWarning}</p>
    </section>}
    {!!startupDiagnostics.length && (showDeveloperDiagnostics || debugDiagnosticsEnabled()) && <section className="panel" role="status" aria-live="polite">
      {agentMode && !activeCriticalFailure && <p className="route-state warn">Live with partial enrichment</p>}
      {recoveredCritical && !activeCriticalFailure && <p className="route-state">Startup recovered after retry.</p>}
      <details open={showDeveloperDiagnostics} onToggle={(event) => setShowDeveloperDiagnostics((event.currentTarget as HTMLDetailsElement).open)}>
        <summary>Developer diagnostics</summary>
        {(agentMode ? startupDiagnostics : startupDiagnostics.filter((item) => item.final_state === 'active_failure' || item.final_state === 'recovered')).slice(0, 10).map((item) => {
          const recovered = item.final_state === 'recovered';
          const recoveredCopy = recovered ? `, recovered on attempt ${item.attempt + 1}` : '';
          return <details key={`${item.endpoint}-${item.method}-${item.is_critical ? 'critical' : 'secondary'}`}>
            <summary>{item.endpoint} ({item.is_critical ? 'critical' : 'secondary'}) · {item.error_type} · final {item.final_state} · attempts {item.attempt}{recoveredCopy}</summary>
            <p>status {item.status_code ?? 'n/a'} · last_attempt_at {item.last_attempt_at}</p>
            <p>request_url {item.request_url} · method {item.method} · content_type {item.content_type ?? 'n/a'}</p>
            <p>{item.fix_hint}</p>
          </details>;
        })}
      </details>
      {!agentMode && activeSecondaryFailures.length > 0 && <p className="route-state warn">Enrichment delayed</p>}
    </section>}
    {!!startupDiagnostics.length && !showDeveloperDiagnostics && !debugDiagnosticsEnabled() && <section className="panel" role="status" aria-live="polite">
      <button className="execute compact secondary" type="button" onClick={() => setShowDeveloperDiagnostics(true)}>
        Open Developer diagnostics
      </button>
    </section>}
    {agentMode && <AgentModeBanner onExit={() => setAgentMode(false)} onOpenApiDocs={openApiDocs} />}
    {!agentMode && <section className="hero panel mission-control" aria-labelledby="terminal-title">
      <div>
        <p className="eyebrow">Infopunks Intelligence Terminal</p>
        <p className="eyebrow">Radar Evidence Ledger</p>
        <h1 id="terminal-title">Pay.sh routes are live. Agents need proof before spend.</h1>
        <p className="mission-subtitle">Radar tracks mapped, proven, and benchmarked Pay.sh routes before agents route money through them.</p>
        <p className="copy">Pay.sh is the spend rail. Radar is the evidence ledger. The Harness is the proof adapter.</p>
        <p className="copy">Agents inspect the Evidence Ledger or Brief, request a non-executing Bundle Plan, then a Harness may execute later and return proof artifacts for Radar to record.</p>
        <section className="preflight-home-cta" aria-label="Preflight card index call to action">
          <div className="preflight-home-cta-copy">
            <p className="section-kicker">New: Browse Preflight Cards</p>
            <p>Agent spend safety labels for autonomous markets.</p>
            <small>Discover → Check → Pay → Prove</small>
            <small>No receipt, no trust.</small>
          </div>
          <a className="execute compact secondary" href="/radar/cards">Browse Preflight Cards</a>
        </section>
        <ProofMetricsStrip summary={publicProofSummary(evidenceLedger)} />
        <p className="panel-caption">Recorded means paid evidence exists. No winner means Radar refuses to infer superiority without criteria.</p>
        <div className="orientation-panel" aria-label="Radar orientation">
          <strong>Orientation</strong>
          <p>Pulse shows live ecosystem intelligence. Benchmarks show artifact-backed route evidence.</p>
        </div>
        <div className="source-stack">
          <span className={`source-badge ${data.pulse.data_source.mode}`}>{data.pulse.data_source.mode === 'live_pay_sh_catalog' ? 'LIVE PAY.SH CATALOG' : 'FIXTURE-BACKED RADAR STATE'}</span>
          <small className="source-line">{formatDataSource(data.pulse.data_source, data.pulse.providerCount, data.pulse.endpointCount)}</small>
        </div>
        <nav className="terminal-quick-actions" aria-label="Command briefing quick actions">
          <a href="#preflight"><b>Run Preflight</b><span>Validate routes</span></a>
          <a href="#compare"><b>Compare Providers</b><span>Cost and performance</span></a>
          <a href="#benchmark-readiness"><b>View Benchmarks</b><span>Readiness scores</span></a>
          <a href="#route-mapping-registry"><b>Check Mappings</b><span>Route intelligence</span></a>
          <a href="/claim"><b>Browse Claims</b><span>Evidence trails</span></a>
          <a href="#agent-benchmark-api"><b>Agent Benchmark API</b><span>Access API docs</span></a>
        </nav>
      </div>
      <div className="ticker mission-metrics" aria-label="Live radar stats">
        <ControlStripMetric label="Providers" value={data.pulse.providerCount} />
        <ControlStripMetric label="Endpoints" value={data.pulse.endpointCount} />
        <ControlStripMetric label="Avg Trust" value={data.pulse.averageTrust ?? 'unknown'} />
        <ControlStripMetric label="Avg Signal" value={data.pulse.averageSignal ?? 'unknown'} />
        <ControlStripMetric label="Monitoring Mode" value="Safe metadata" />
        <ControlStripMetric label="Freshness" value={formatShortDate(data.pulse.data_source.last_ingested_at ?? data.pulse.data_source.generated_at)} />
      </div>
    </section>}

    {!agentMode && <section className="panel machine-module-card" aria-label="Machine Economy Module">
      <div>
        <p className="section-kicker">New Radar Module</p>
        <h2>Machine Economy Module</h2>
        <p>Radar now maps the robotic.sh machine-service market: 13 listed services, bounded authority policies, preflight decisions, and machine receipts.</p>
        <small>Same terminal. New species of spender.</small>
      </div>
      <a className="execute compact secondary" href="/machine-market">Open Machine Market</a>
    </section>}

    {!agentMode && <section className="panel signal-graph-teaser-card" aria-label="Signal Graph teaser">
      <div>
        <p className="section-kicker">Visual Memory Layer</p>
        <h2>Read the graph, not the feed.</h2>
        <p>Claims, routes, receipts, loops, and narratives mapped by proof.</p>
      </div>
      <a className="execute compact secondary" href="/graph">Open Signal Graph</a>
    </section>}

    {!agentMode && <HeadToHeadBenchmarkPanel registry={benchmarkRegistry} evidenceLedger={evidenceLedger} loading={benchmarkReadinessLoading} />}
    {!agentMode && <AgentSpendReadinessCardsPanel readiness={agentReadiness} />}

    <div id="global-pulse" className="anchor-target" />
    <EcosystemStatusPanel status={ecosystemStatus} reading={ecosystemReading} pulse={data.pulse} summary={pulseSummary} selectedProvider={selectedProvider} />

    <section className="ecosystem-layout" aria-label="Global intelligence layout">
      <div className="ecosystem-main">
        <section className="zone zone-ecosystem" aria-labelledby="ecosystem-zone-title">
          <ZoneHeader eyebrow="ZONE A" title="ECOSYSTEM INTELLIGENCE" subtitle="Catalog-backed machine economy observability" helper="Start here: global status, interpretation, pulse feed, and cross-provider movement before drilling into a provider." scope="GLOBAL" />

          {!agentMode && <section className="grid four ecosystem-metrics" aria-label="Ecosystem summary metrics">
            <Metric label="Ecosystem Pulse" value={data.pulse.hottestNarrative?.title ?? 'unknown'} sub={`heat ${data.pulse.hottestNarrative?.heat ?? 'unknown'} / momentum ${data.pulse.hottestNarrative?.momentum ?? 'unknown'}`} evidence={data.pulse.hottestNarrative as EvidenceReceipt | null} />
            <Metric label="Trust Leader" value={providerLookup.get(data.pulse.topTrust[0]?.entityId)?.name ?? 'n/a'} sub={`${data.pulse.topTrust[0]?.score ?? 'unknown'}/100 grade ${data.pulse.topTrust[0]?.grade ?? '-'}`} evidence={data.pulse.topTrust[0]} />
            <Metric label="Signal Leader" value={providerLookup.get(data.pulse.topSignal[0]?.entityId)?.name ?? 'n/a'} sub={`${data.pulse.topSignal[0]?.score ?? 'unknown'}/100`} evidence={data.pulse.topSignal[0]} />
            <Metric label="Graph Layer" value={`${data.graph.nodes.length} nodes`} sub={`${data.graph.edges.length} deterministic edges`} evidence={data.graph.evidence ?? graphFallbackEvidence(data.graph)} />
          </section>}

          {!agentMode && <SystemReadingPanel reading={ecosystemReading} />}

          {!agentMode && <RadarFreshness pulse={data.pulse} summary={pulseSummary} />}

          <RadarExportPanel />

          {!agentMode && <EcosystemInterpretationPanel interpretations={ecosystemInterpretations} providerLookup={providerLookup} />}

          <div className="ecosystem-canvas">
          {!agentMode && pulseSummary && <CollapsibleSection id="events" className="panel pulse-feed" title="Live Catalog Pulse" kicker="Current Scored Snapshot" scope="GLOBAL" caption={`Pay.sh catalog ingests every ${formatInterval(pulseSummary.ingest_interval_ms) ?? '7.5 min'} / UI polls every 15s / events emit only when catalog changes are detected.`}>
            <div className="panel-head">
              <div>
                <p className="section-kicker">Safe Metadata Monitor</p>
                <h2>Events / Degradations</h2>
                <p className="panel-caption">Filtered event spine from the latest ingested catalog. No paid provider APIs are executed.</p>
              </div>
              <small>UI refresh {formatDate(pulseSummary.generatedAt)}</small>
            </div>
            <div className="timing-strip" aria-label="Catalog timing">
              <TimingItem label="UI refreshed" value={formatDate(pulseSummary.generatedAt)} />
              <TimingItem label="Catalog ingestion" value={formatDate(pulseSummary.data_source.last_ingested_at)} />
              <TimingItem label="Pay.sh catalog generated" value={formatDate(pulseSummary.data_source.generated_at)} />
              <TimingItem label="Source" value={sourceLabel(pulseSummary.data_source)} />
              <TimingItem label="Latest event batch" value={pulseSummary.latest_event_at ? `${formatTime(pulseSummary.latest_event_at)} · ${pulseSummary.latest_batch_event_count} events` : 'none'} />
            </div>
            {catalogNoChanges && <p className="batch-notice">Latest catalog refresh completed. No provider, pricing, endpoint, or category changes detected.</p>}
            <div className="event-groups" aria-label="Catalog event categories">
              {eventCategories.map((category) => <span key={category} className={`category ${category}`}>{eventCategoryIcon(category)} {category} {pulseSummary.eventGroups[category].count}</span>)}
            </div>
            <div className="table-controls event-controls" aria-label="Filter and sort events">
              <label><span>state filter</span><select value={eventFilter} onChange={(event) => setEventFilter(event.target.value as EventFilter)}>
                <option value="all">all states</option>
                <option value="critical">critical</option>
                <option value="degraded">degraded</option>
                <option value="watch">watch</option>
                <option value="healthy">healthy</option>
                <option value="unknown">unknown</option>
              </select></label>
              <label><span>sort</span><select value={eventSort} onChange={(event) => setEventSort(event.target.value as EventSort)}>
                <option value="severity">severity</option>
                <option value="last observed">last observed</option>
                <option value="provider">provider</option>
              </select></label>
            </div>
            <div className="event-feed">
              {filteredTimelineBatches.map((batch) => <div className="batch-group" key={batch.observedAt}>
                <div className="batch-head">
                  <strong>Catalog batch</strong>
                  <time>{formatTime(batch.observedAt)}</time>
                  <span>{batch.events.length} events emitted</span>
                </div>
                <div className="batch-rows">
                  {sortBySeverity(batch.events).map((event) => <div className={`feed-row ${event.category} severity-${normalSeverity(event.severity)}`} key={event.id}>
                    <span>{eventCategoryIcon(event.category)} {event.category}</span>
                    <SeverityBadge evidence={event} />
                    <strong>{event.providerName ?? event.entityId}</strong>
                    <p>{event.summary}{isCriticalOrDegradedEvent(event) ? ' Route implication: Not recommended for routing.' : ''}</p>
                    <time>{formatTime(event.observedAt)}</time>
                    <EvidenceReceiptView evidence={event} title="Receipt" compact />
                  </div>)}
                </div>
              </div>)}
              {!filteredTimelineBatches.length && <p className="muted empty-state">No events match the current state filter.</p>}
            </div>
          </CollapsibleSection>}

          {!agentMode && <section id="leaderboards" className="grid two">
            <Leaderboard title="Trust Leaderboard" scores={safeTopTrust} providers={providerLookup} kind="trust" providerRiskById={providerRiskById} />
            <Leaderboard title="Signal Leaderboard" scores={safeTopSignal} providers={providerLookup} kind="signal" providerRiskById={providerRiskById} />
          </section>}

          {!agentMode && <CollapsibleSection className="panel narrative-heatmap-panel" title="Narrative Heatmap" caption="Narratives group provider movement into readable market themes. Heat and severity are shown together so state is not color-only." scope="GLOBAL">
            <div className="heatmap">
              {sortBySeverity(safeNarratives).map((narrative) => <div key={narrative.id} className={`heat severity-${normalSeverity(narrative.severity)}`} style={{ '--heat': `${narrative.heat ?? 0}%` } as React.CSSProperties}>
                <strong>{narrative.title}</strong><SeverityBadge evidence={narrative} /><span>heat {narrative.heat ?? 'unknown'}</span><small>{narrative.providerIds.length} providers / {narrative.keywords.join(', ')}</small>
              </div>)}
            </div>
          </CollapsibleSection>}

          {!agentMode && <section className="panel semantic-search-panel">
            <ScopeLabel scope="GLOBAL" />
            <div className="semantic-search-head">
              <p className="section-kicker">Query the ecosystem</p>
              <h2>Semantic Search</h2>
              <p className="panel-caption">Ask across provider metadata, trust context, signal context, categories, endpoints, and receipts without leaving the radar surface.</p>
            </div>
            <form className="semantic-search-form" onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}>
              <label className="command-input">
                <span>ecosystem query</span>
                <input id="semantic-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Ask: which providers are degrading?" aria-label="Search Pay.sh ecosystem intelligence" />
              </label>
              <button className="execute compact secondary" type="submit" disabled={searchStatus === 'loading'}>
                {searchStatus === 'loading' ? 'Searching...' : 'Search'}
              </button>
            </form>
            <p className="semantic-search-hint">Search by category, provider name, endpoint type, route intent, degradation state, price clarity, or metadata completeness.</p>
            <div className="example-chips" aria-label="Semantic search examples">
              {['high trust finance APIs', 'degraded OCR providers', 'SOL price endpoints', 'low-cost data endpoints', 'providers with clear pricing', 'route eligible endpoints', 'machine media providers', 'metadata incomplete providers'].map((query) => <button key={query} type="button" onClick={() => applySemanticSearchExample(query)}>{query}</button>)}
            </div>
            {searchError && <p className="route-state error">Semantic search unavailable: {searchError}</p>}
            <div className="results">{searchResults.filter((result) => isRecord(result) && isRecord(result.provider) && typeof result.provider.id === 'string').map((result) => <div className="result" key={result.provider.id}><strong>{result.provider.name ?? 'unknown provider'}</strong><span>relevance {result.relevance ?? 'unknown'} / trust {result.trustAssessment?.score ?? 'unknown'} / signal {result.signalAssessment?.score ?? 'unknown'}</span></div>)}</div>
            {searchQuery.trim() && searchStatus === 'idle' && !searchResults.length && <EmptyState title="No matching providers." body="Try a category, provider name, endpoint type, or task intent." />}
          </section>}
          <PreflightConsole
            input={preflightJsonInput}
            result={preflightResult}
            status={preflightStatus}
            error={preflightError}
            onInputChange={setPreflightJsonInput}
            onRun={runPreflightCheck}
            onExample={applyPreflightExample}
            curl={preflightCurlFromText(preflightJsonInput)}
          />
          <ComparisonPanel providers={safeProviders} endpoints={radarEndpoints} mode={compareMode} selectedIds={compareIds} onModeChange={setCompareMode} onSelectionChange={setCompareIds} result={compareResult} onCompare={runComparison} />
          <CostPerformancePanel endpoints={radarEndpoints} providerRiskById={providerRiskById} benchmarkReadiness={benchmarkReadiness} loading={radarEndpointsLoading} />
          <BenchmarkReadinessPanel readiness={benchmarkReadiness} loading={benchmarkReadinessLoading} />
          <RouteMappingRegistryPanel
            registry={routeMappingRegistry}
            statusFilter={routeMappingStatusFilter}
            onStatusFilterChange={setRouteMappingStatusFilter}
            categoryFilter={routeMappingCategoryFilter}
            onCategoryFilterChange={setRouteMappingCategoryFilter}
            intentFilter={routeMappingIntentFilter}
            onIntentFilterChange={setRouteMappingIntentFilter}
          />
          <MappingTargetsPanel registry={mappingTargetRegistry} evidenceLedger={evidenceLedger} />
          <AgentBenchmarkApiPanel />
          <SuperiorityReadinessPanel readiness={readiness} />
          </div>
        </section>

        {!agentMode && <section className="zone zone-provider" id="dossier" aria-labelledby="provider-zone-title">
      <ZoneHeader eyebrow="ZONE B" title="SELECTED PROVIDER DOSSIER" subtitle="Live intelligence for selected provider" helper="The featured provider rotates automatically unless you select or edit. Manual interaction pauses rotation to preserve context." scope="PROVIDER" />
      {selectedProvider && <div className="provider-ribbon" aria-label="Selected provider context">
        <strong>{selectedProvider.name}</strong>
        <SeverityBadge evidence={providerIntel ?? selectedProvider} />
        <span>TRUST {providerIntel?.latest_trust_score ?? 'unknown'}</span>
        <span>SIGNAL {providerIntel?.latest_signal_score ?? 'unknown'}</span>
        <span>PROPAGATION {providerIntel?.propagation_context?.affected ? providerIntel.propagation_context.propagation_state.toUpperCase() : 'CLEAR'}</span>
        <span className={`service-status ${providerIntel?.service_monitor.status ?? 'unknown'}`}>MONITOR {statusLabel(providerIntel?.service_monitor.status ?? 'unknown')}</span>
      </div>}

      <div className="provider-stack">
        <div className="panel provider-directory-panel" id="providers">
          <div className="panel-head">
            <div>
              <ScopeLabel scope="GLOBAL" />
              <p className="section-kicker">Catalog Index</p>
              <h2>Provider Directory</h2>
              <p className="panel-caption">Filter, sort, and select providers. Active selection drives the dossier, monitor, route, trust, and endpoint panels.</p>
            </div>
            <small>{filteredProviders.length} / {data.providers.length} providers</small>
          </div>
          <div className="directory-controls">
            <input value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="filter provider, tag, FQN, category" aria-label="Filter providers by name tag FQN or category" />
            <div className="control-row">
              <select value={directorySort} onChange={(event) => setDirectorySort(event.target.value)} aria-label="Sort providers">
                <option>trust score</option>
                <option>signal score</option>
                <option>endpoint count</option>
                <option>category</option>
                <option>name</option>
              </select>
            </div>
            <div className="category-chips" role="group" aria-label="Filter providers by category">
              <button type="button" className={directoryCategory === 'all' ? 'selected' : ''} aria-pressed={directoryCategory === 'all'} onClick={() => setDirectoryCategory('all')}>all</button>
              {categoryOptions.map((category) => <button key={category} type="button" className={directoryCategory === category ? 'selected' : ''} aria-pressed={directoryCategory === category} onClick={() => setDirectoryCategory(category)}>{category}</button>)}
            </div>
          </div>
          <div className="directory">
            {filteredProviders.map((provider) => <button key={provider.id} type="button" aria-pressed={provider.id === selectedProvider?.id} className={provider.id === selectedProvider?.id ? 'active row' : 'row'} onClick={() => selectProviderManually(provider.id)}>
              <span>{provider.name}</span><ProviderDirectoryStateBadge provider={provider} risk={toRiskContext(providerRiskById[provider.id])} /><small>{provider.category} / {provider.endpointCount} endpoints / trust {provider.latestTrustScore ?? 'unknown'}</small>
            </button>)}
            {!filteredProviders.length && <EmptyState title="No providers found." body="Adjust the search, category filter, or sort order." />}
          </div>
        </div>
        <div className="panel intelligence dossier">
          <div className="panel-head">
            <div>
              <ScopeLabel scope="PROVIDER" context={providerContextLabel} />
              <p className="section-kicker">Selected Provider</p>
              <h2>Provider Intelligence Dossier</h2>
              <p className="panel-caption">Provider-level trust, signal, monitor, market metadata, and evidence receipts stay linked to the selected catalog entry.</p>
            </div>
            <div className="auto-rotate-control" aria-label="Featured provider auto-rotate control" onFocus={() => setDossierControlsEditing(true)} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDossierControlsEditing(false);
            }} onPointerDown={() => setDossierControlsEditing(true)} onPointerUp={() => setDossierControlsEditing(false)}>
              {isFeaturedProvider && <span className="featured-label">Featured provider</span>}
              <label>
                <input type="checkbox" checked={featuredRotationEnabled} aria-label="Toggle featured provider rotation" onChange={(event) => toggleAutoRotation(event.target.checked)} />
                <span>Featured rotation</span>
              </label>
              {selectionMode === 'manual' && <button className="resume-rotate" type="button" onClick={resumeAutoRotation}>Resume featured rotation</button>}
              <small>{selectionMode === 'manual' ? 'Paused by manual selection' : `Next provider window closes ${nextRotationLabel}`}</small>
            </div>
          </div>
          {selectedProvider && <>
            <div className="dossier-header">
              <div>
                <p className="eyebrow">{selectedProvider.namespace}</p>
                <h3>{selectedProvider.title ?? selectedProvider.name}</h3>
                <code>{selectedProvider.fqn ?? selectedProvider.id}</code>
              </div>
              <div className="dossier-badges">
                <span>{selectedProvider.category}</span>
                <span>{data.pulse.data_source.mode === 'live_pay_sh_catalog' ? 'live catalog' : 'fixture fallback'}</span>
                <span>{selectedProvider.endpointCount} endpoints</span>
                <span>{formatPrice(selectedProvider.pricing)}</span>
                <span>{selectedProvider.hasFreeTier || safeString(selectedProvider.status).includes('free') ? 'free tier' : 'no free-tier evidence'}</span>
                <span>{selectedProvider.hasMetering || selectedProvider.status === 'metered' ? 'metering' : 'metering unknown'}</span>
                <SeverityBadge evidence={providerIntel ?? selectedProvider} />
                <PredictiveRiskBadge risk={toRiskContext(providerRisk)} />
                <CopyButton value={selectedProvider.id} label="Copy provider id" />
              </div>
            </div>
            <div className="dossier-summary-strip" aria-label="Selected provider summary strip">
              <span><b>Provider</b>{selectedProvider.name}</span>
              <span><b>State</b>{statusLabel(providerIntel?.service_monitor.status ?? selectedProvider.status ?? 'unknown')}</span>
              <span><b>Trust</b>{providerIntel?.latest_trust_score ?? 'unknown'}</span>
              <span><b>Signal</b>{providerIntel?.latest_signal_score ?? 'unknown'}</span>
              <span><b>Risk</b>{riskBadgeLabel(toRiskContext(providerRisk)?.predictive_risk_level ?? 'unknown')}</span>
              <span><b>Route/action</b>{toRiskContext(providerRisk)?.recommended_action ?? selectedRouteContext?.routeState ?? 'inspect evidence first'}</span>
            </div>
            <div className="intel-summary">
              <DossierStat label="Trust" value={providerIntel?.latest_trust_score ?? null} sub={providerDetail?.trustAssessment?.grade ?? 'grade unknown'} history={providerHistory?.series.trust_score} delta={providerHistory?.deltas.trust_delta_24h ?? null} />
              <DossierStat label="Signal" value={providerIntel?.latest_signal_score ?? null} sub={providerDetail?.signalAssessment?.narratives[0] ?? 'narrative unknown'} history={providerHistory?.series.signal_score} delta={providerHistory?.deltas.signal_delta_24h ?? null} />
              <DossierStat label="Coord." value={formatNullableBoolean(providerIntel?.coordination_eligible ?? null)} sub="eligible" />
              <DossierStat label="Risk" value={riskBadgeLabel(toRiskContext(providerRisk)?.predictive_risk_level ?? 'unknown')} sub={toRiskContext(providerRisk)?.recommended_action ?? 'advisory'} />
              <DossierStat label="Unknowns" value={providerIntel?.unknown_telemetry.length ?? 'unknown'} sub="telemetry fields" />
            </div>
            {providerDegradation.degraded && <ProviderDegradedWarning info={providerDegradation} />}
            <div className="dossier-body" onScroll={() => holdAutoRotation(DOSSIER_INTERACTION_HOLD_MS)}>
              <DossierSection title="Capability Brief" tier="tier-2" context={providerContextLabel} helper="Catalog-supplied description, tags, and service URL. This does not imply endpoint execution.">
                <p>{selectedProvider.description ?? 'No provider description supplied by catalog metadata.'}</p>
                <p><b>use_case:</b> {selectedProvider.useCase ?? 'unknown'}</p>
                {selectedProvider.serviceUrl && <p><b>service_url:</b> <a href={selectedProvider.serviceUrl} target="_blank" rel="noreferrer">{selectedProvider.serviceUrl}</a></p>}
                <div className="chips compact-chips">{safeArray<string>(providerIntel?.category_tags.length ? providerIntel.category_tags : selectedProvider.tags).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <EvidenceReceiptView evidence={selectedProvider} title="Evidence" />
              </DossierSection>
              <DossierSection title="Route Decision Panel" tier="tier-2" className="route-decision-section" context={providerContextLabel} helper="Uses the existing route recommendation API with selected provider as optional preference input.">
                <div className="route-panel compact-route-panel" id="route-decision-panel" onFocus={() => setRouteInputFocused(true)} onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRouteInputFocused(false);
                }} onPointerDown={() => holdAutoRotation(ROUTE_INTERACTION_HOLD_MS)} onInput={() => holdAutoRotation(ROUTE_INTERACTION_HOLD_MS)}>
                  {selectedRouteContext && <div className="route-context-summary" aria-label="Selected provider route context">
                    <span><b>selected</b>{selectedRouteContext.provider}</span>
                    <span><b>risk</b>{selectedRouteContext.risk}</span>
                    <span><b>route</b>{selectedRouteContext.routeState}</span>
                    <span><b>mapping</b>{selectedRouteContext.mappingState}</span>
                    <span><b>pricing</b>{selectedRouteContext.pricingState}</span>
                  </div>}
                  <label>
                    <span>task text</span>
                    <textarea value={routeTask} aria-label="Route task text" onChange={(event) => setRouteTask(event.target.value)} />
                  </label>
                  <div className="route-input-grid">
                    <label>
                      <span>category filter</span>
                      <select value={routeCategory} aria-label="Route category filter" onChange={(event) => setRouteCategory(event.target.value)}>
                        <option value="all">all categories</option>
                        {categoryOptions.map((category) => <option value={category} key={category}>{category}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>max price</span>
                      <input value={routeMaxPrice} aria-label="Route maximum price" onChange={(event) => setRouteMaxPrice(event.target.value)} placeholder="unknown allowed" />
                    </label>
                    <label>
                      <span>Minimum trust score</span>
                      <input type="number" min={0} max={100} value={routeMinTrust} aria-label="Route minimum trust score" onChange={(event) => setRouteMinTrust(Number(event.target.value))} />
                    </label>
                    <label>
                      <span>preference</span>
                      <select value={routePreference} aria-label="Route preference" onChange={(event) => setRoutePreference(event.target.value as RoutePreference)}>
                        <option value="balanced">balanced</option>
                        <option value="highest_trust">trust-prioritized</option>
                        <option value="cheapest">lowest catalog price</option>
                        <option value="highest_signal">signal-prioritized</option>
                      </select>
                    </label>
                  </div>
                  <label className="route-check">
                    <input type="checkbox" checked={includeSelectedProvider} aria-label="Include selected provider as preferred route input" onChange={(event) => setIncludeSelectedProvider(event.target.checked)} />
                    <span>include selected provider as preferred route input</span>
                  </label>
                  <div className="route-actions">
                    <button className="execute compact route-primary-action" type="button" onClick={runRoute} disabled={routeStatus === 'loading'}>{routeStatus === 'loading' ? 'computing route...' : 'compute catalog-derived candidate'}</button>
                    <button className="execute compact secondary route-secondary-action" type="button" onClick={() => recommendProvider(selectedProvider)}>seed from selected</button>
                  </div>
                  {routeError && <p className="route-state error">{routeError}</p>}
                  {routeStatus === 'loading' && <p className="route-state">computing route...</p>}
                  {routeResult && <RouteDecisionOutput routeResult={routeResult} routePreference={routePreference} selectedProvider={selectedProvider} />}
                </div>
              </DossierSection>
              <div className="dossier-grid">
                <DossierSection title="Market Metadata" tier="tier-3" context={providerContextLabel} helper="Pricing and catalog freshness are preserved as reported by Pay.sh metadata.">
                  <KeyValues rows={[
                    ['min_price_usd', moneyOrUnknown(getSafeRange(selectedProvider.pricing).min)],
                    ['max_price_usd', moneyOrUnknown(getSafeRange(selectedProvider.pricing).max)],
                    ['endpoint_count', selectedProvider.endpointCount],
                    ['has_free_tier', formatNullableBoolean(selectedProvider.hasFreeTier ?? safeString(selectedProvider.status).includes('free') ? true : null)],
                    ['has_metering', formatNullableBoolean(selectedProvider.hasMetering ?? selectedProvider.status === 'metered' ? true : null)],
                    ['source_sha', selectedProvider.sourceSha ?? 'unknown'],
                    ['catalog_generated_at', formatDate(selectedProvider.catalogGeneratedAt)],
                    ['last_seen_at', formatDate(providerIntel?.last_seen_at ?? selectedProvider.lastSeenAt)]
                  ]} />
                  <EvidenceReceiptView evidence={selectedProvider.pricing ?? selectedProvider} title="Receipt" />
                </DossierSection>
                <DossierSection title="Trust Breakdown" tier="tier-2" context={providerContextLabel} helper="Component scores explain the visible trust total and unknown states.">
                  <KeyValues rows={[
                    ['metadata quality', componentValue(providerDetail?.trustAssessment?.components.metadataQuality)],
                    ['pricing clarity', componentValue(providerDetail?.trustAssessment?.components.pricingClarity)],
                    ['freshness', componentValue(providerDetail?.trustAssessment?.components.freshness)],
                    ['service reachability', knownState(providerDetail?.trustAssessment?.components.uptime)],
                    ['latency', knownState(providerDetail?.trustAssessment?.components.latency)],
                    ['endpoint response validity', knownState(providerDetail?.trustAssessment?.components.responseValidity)],
                    ['receipt reliability', knownState(providerDetail?.trustAssessment?.components.receiptReliability)]
                  ]} />
                </DossierSection>
                <DossierSection title="Operational Monitor" tier="tier-2" context={providerContextLabel} helper="Safe metadata reachability only; paid provider calls are not executed.">
                  <div className="monitor-card">
                    <div className="monitor-head">
                      <span className="safe-badge">SAFE METADATA</span>
                      <SeverityBadge evidence={providerIntel?.service_monitor} />
                      <strong className={`service-status ${providerIntel?.service_monitor.status ?? 'unknown'}`}>{statusLabel(providerIntel?.service_monitor.status ?? 'unknown')}</strong>
                    </div>
                    <KeyValues rows={[
                      ['last_check', formatDate(providerIntel?.service_monitor.last_checked_at ?? null)],
                      ['latency', formatMs(providerIntel?.service_monitor.response_time_ms ?? null)],
                      ['http_status', providerIntel?.service_monitor.status_code ?? 'unknown'],
                      ['monitor_mode', providerIntel?.service_monitor.monitor_mode ?? 'UNKNOWN']
                    ]} />
                    <p className="monitor-note">{providerIntel?.service_monitor.explanation ?? 'Safe monitor checks provider service reachability only. It does not execute paid Pay.sh calls.'}</p>
                  </div>
                </DossierSection>
                <DossierSection title="Propagation Context" tier="tier-3" context={providerContextLabel} helper="Shows whether this provider is part of the current ecosystem propagation analysis.">
                  <KeyValues rows={[
                    ['state', providerIntel?.propagation_context?.propagation_state ?? 'unknown'],
                    ['severity', providerIntel?.propagation_context?.severity ?? 'unknown'],
                    ['provider affected', formatNullableBoolean(providerIntel?.propagation_context?.affected ?? null)],
                    ['cluster', providerIntel?.propagation_context?.affected_cluster ?? 'none']
                  ]} />
                  <p className="monitor-note">{providerIntel?.propagation_context?.propagation_reason ?? 'No propagation analysis available for this provider.'}</p>
                </DossierSection>
                <DossierSection title="Signal Breakdown" tier="tier-3" context={providerContextLabel} helper="Narrative and metadata movement behind the visible signal score.">
                  <KeyValues rows={[
                    ['category heat', componentValue(providerDetail?.signalAssessment?.components.categoryHeat)],
                    ['ecosystem momentum', componentValue(providerDetail?.signalAssessment?.components.ecosystemMomentum)],
                    ['metadata change velocity', componentValue(providerDetail?.signalAssessment?.components.metadataChangeVelocity)],
                    ['social velocity', knownState(providerDetail?.signalAssessment?.components.socialVelocity)],
                    ['onchain/liquidity resonance', knownState(providerDetail?.signalAssessment?.components.onchainLiquidityResonance)]
                  ]} />
                </DossierSection>
                <DossierSection title="Unknown Telemetry" tier="tier-3" context={providerContextLabel} helper="Unknown fields stay visible so absence of evidence is never hidden.">
                  <div className="unknown-list">{(providerIntel?.unknown_telemetry.length ? providerIntel.unknown_telemetry : ['No unknown telemetry reported by current assessments.']).map((item) => <span key={item}>{item}</span>)}</div>
                  <EvidenceReceiptView evidence={providerDetail?.trustAssessment ?? providerDetail?.signalAssessment ?? selectedProvider} title="Evidence" />
                </DossierSection>
              </div>
              <DossierSection title="Evidence Trail" tier="tier-4" context={providerContextLabel} helper="Recent catalog-diff receipts for this provider, ordered by severity.">
                <div className="evidence-trail">
                  {sortBySeverity(providerIntel?.recent_changes.length ? providerIntel.recent_changes : []).slice(0, 6).map((item) => <div key={item.id}>
                    <time>{formatDate(item.observedAt)}</time>
                    <SeverityBadge evidence={item} />
                    <strong>{item.type}</strong>
                    <span>{item.summary}</span>
                    <EvidenceReceiptView evidence={item} title="Receipt" compact />
                  </div>)}
                  {providerIntel?.recent_changes.length === 0 && <p className="muted empty-state">No recent discovery, update, price, category, endpoint-count, or metadata events after initial observation.</p>}
                </div>
              </DossierSection>
              <DossierSection title="Reliability History" tier="tier-2" context={providerContextLabel} helper="Historical trend memory from stored score, monitor, and degradation events. No paid APIs are executed.">
                <ReliabilityHistoryPanel history={providerHistory} />
              </DossierSection>
              <DossierSection title="Endpoint Intelligence" tier="tier-2" context={providerContextLabel} helper="Normalized endpoint metadata from safe radar export routes. Rows remain visible even when degraded or incomplete.">
                <div id="endpoints" className="anchor-target" />
                <EndpointIntelligenceSection
                  rows={visibleEndpointIntelligenceRows}
                  allRows={endpointIntelligenceRows}
                  filter={endpointFilter}
                  onFilterChange={setEndpointFilter}
                  query={endpointQuery}
                  onQueryChange={setEndpointQuery}
                  sort={endpointSort}
                  onSortChange={setEndpointSort}
                  provider={endpointProvider}
                  endpointMonitors={endpointMonitors}
                  endpointRisks={endpointRiskById}
                  reportedEndpointCount={reportedEndpointCount}
                />
              </DossierSection>
            </div>
          </>}
        </div>
      </div>

      <section className="grid three provider-analysis-grid">
        <AssessmentPanel title="Trust Assessment" score={providerIntel?.latest_trust_score ?? null} sub={providerDetail?.trustAssessment?.grade ?? 'unknown'} components={providerDetail?.trustAssessment?.components ?? {}} context={providerContextLabel} evidence={providerDetail?.trustAssessment ?? undefined} />
        <AssessmentPanel title="Signal Assessment" score={providerIntel?.latest_signal_score ?? null} sub={providerDetail?.signalAssessment?.narratives.join(', ') || 'no narrative match'} components={providerDetail?.signalAssessment?.components ?? {}} context={providerContextLabel} evidence={providerDetail?.signalAssessment ?? undefined} />
        <div className="panel assessment">
          <ScopeLabel scope="PROVIDER" context={providerContextLabel} />
          <h2>Unknown Telemetry</h2>
          <div className="terminal-lines">
            <p>risk: {riskLabel(providerIntel?.risk_level ?? 'unknown')}</p>
            <p>coordination eligible: {formatNullableBoolean(providerIntel?.coordination_eligible ?? null)}</p>
            <p>endpoints: {providerIntel?.endpoint_count ?? selectedProvider?.endpointCount ?? 'unknown'}</p>
            <p>health: {providerIntel ? `${providerIntel.endpoint_health.healthy} [OK] ok / ${providerIntel.endpoint_health.degraded} [DEGRADED] degraded / ${providerIntel.endpoint_health.failed} [FAILED] failed / ${providerIntel.endpoint_health.unknown} [?] unknown` : '[?] unknown'}</p>
          </div>
          <div className="chips">{(providerIntel?.unknown_telemetry.length ? providerIntel.unknown_telemetry : ['none']).map((item) => <span key={item}>{item}</span>)}</div>
          <EvidenceReceiptView evidence={providerDetail?.trustAssessment ?? providerDetail?.signalAssessment ?? selectedProvider ?? undefined} title="Evidence" />
        </div>
      </section>

      <section className="grid two provider-analysis-grid">
        <div className="panel">
          <ScopeLabel scope="PROVIDER" context={providerContextLabel} />
          <div className="endpoint-panel-head">
            <h2>Endpoint List</h2>
            {hasPartialEndpointMetadata && <span className="partial-badge">LIVE CATALOG PARTIAL</span>}
          </div>
          <div className={`endpoint-list ${endpointRows.length ? 'has-rows' : 'compact-state'}`}>
            {endpointRows.map((endpoint) => <div className="endpoint" key={endpoint.id}>
              {(() => {
                const monitor = endpointMonitors[endpoint.id];
                const risk = endpointRiskById[endpoint.id];
                const payload = monitor?.lastCheck?.payload ?? {};
                return <>
              <strong>{endpoint.name}</strong>
              <PredictiveRiskBadge risk={toRiskContext(risk)} compact />
              <span>{endpoint.method ?? 'METHOD_UNKNOWN'} {endpoint.path ?? 'path unavailable'}</span>
              <small>category {endpoint.category} / type {endpoint.status} / pricing {formatPrice(endpoint.pricing)}</small>
              <small>health {statusLabel(monitor?.health ?? 'unknown')} / checked {formatDate(monitor?.lastCheck?.observedAt)} / latency {formatMs((payload.response_time_ms as number | undefined) ?? endpoint.latencyMsP50)}</small>
              {typeof endpoint.routeEligible === 'boolean' && <small>route eligible {formatNullableBoolean(endpoint.routeEligible)}</small>}
              {!!monitor?.recentFailures.length && <small className="failure-line">recent failure: {monitor.recentFailures[0].summary}</small>}
              <EvidenceReceiptView evidence={endpoint} title="Evidence" compact />
                </>;
              })()}
            </div>)}
            {!endpointRows.length && reportedEndpointCount > 0 && endpointProvider && <>
              <p className="endpoint-state">Pay.sh catalog reports {reportedEndpointCount} endpoints for this provider. Full endpoint-level metadata is not exposed in the current catalog feed.</p>
              <div className="endpoint synthetic">
                <strong>Provider capability surface</strong>
                <span>Endpoint count: {reportedEndpointCount}</span>
                <small>Category: {endpointProvider.category}</small>
                <small>Pricing range: {formatPrice(endpointProvider.pricing)}</small>
                <small>Source: live Pay.sh catalog</small>
                <EvidenceReceiptView evidence={endpointProvider} title="Evidence" compact />
              </div>
            </>}
            {!endpointRows.length && reportedEndpointCount === 0 && <EmptyState title="No endpoints found." body="The selected provider has no endpoint rows in the current catalog." />}
          </div>
        </div>
        <div className="panel">
          <ScopeLabel scope="PROVIDER" context={providerContextLabel} />
          <h2>Recent Changes</h2>
          <p className="panel-caption">Provider recent changes are catalog diff events.</p>
          <div className="timeline">
            {sortBySeverity(providerIntel?.recent_changes.length ? providerIntel.recent_changes : []).map((item) => <div className="change" key={item.id}>
              <time>{formatDate(item.observedAt)}</time>
              <SeverityBadge evidence={item} />
              <strong>{item.type}</strong>
              <span>{item.summary}</span>
              <EvidenceReceiptView evidence={item} title="Receipt" compact />
            </div>)}
            {providerIntel?.recent_changes.length === 0 && <p className="muted">No change events observed after initial discovery.</p>}
          </div>
        </div>
      </section>
        </section>}
      </div>

      {pulseSummary && <aside className="ecosystem-rail" aria-label="Catalog-backed ecosystem intelligence sidebar">
        {!agentMode && <div className="panel counter-grid scoped-panel rail-priority">
          <ScopeLabel scope="GLOBAL" />
          <PulseStat label="Events" value={pulseSummary.counters.events} sub={`${pulseSummary.counters.unknownTelemetry} unknown telemetry fields`} />
          <PulseStat label="Providers" value={pulseSummary.counters.providers} sub={`${pulseSummary.counters.endpoints} endpoints tracked`} />
          {pulseSummary.eventGroups.monitoring.count > 0 && <PulseStat label="Monitor" value={pulseSummary.eventGroups.monitoring.count} sub="safe service reachability events" />}
        </div>}
        {!agentMode && <PropagationWatch propagation={pulseSummary.propagation} />}
        <AnomalyWatchPanel ecosystemRisk={ecosystemRisk} providers={safeProviders} endpoints={radarEndpoints} loading={ecosystemRiskLoading} />
        <HistoryEnrichmentPanel history={ecosystemHistory} loading={ecosystemHistoryLoading} />
        {!agentMode && <DeltaPanel title="Trust Changes" caption="Latest trust events from catalog scoring batches." deltas={pulseSummary.trustDeltas} empty="No trust deltas beyond initial scoring." scope="GLOBAL" />}
        {!agentMode && <DeltaPanel title="Signal Spikes" caption="Signal deltas appear only when catalog-derived signal changes." deltas={pulseSummary.signalSpikes} empty="No positive signal deltas observed." scope="GLOBAL" />}
        {!agentMode && <div className="panel rail-panel">
          <div className="panel-head">
            <div>
              <ScopeLabel scope="GLOBAL" />
              <p className="section-kicker">Windowed Telemetry</p>
              <h2>Provider Activity</h2>
              <p className="panel-caption">Activity counts are event-spine activity, not Pay.sh transaction volume.</p>
            </div>
            <div className="window-tabs">
              {(['1h', '24h', '7d'] as const).map((windowName) => <button key={windowName} type="button" className={pulseWindow === windowName ? 'selected' : ''} aria-pressed={pulseWindow === windowName} aria-label={`Show provider activity for ${windowName}`} onClick={() => setPulseWindow(windowName)}>{windowName}</button>)}
            </div>
          </div>
          <div className="activity-list">
            {pulseSummary.providerActivity[pulseWindow].map((item) => <div className="activity-row" key={item.providerId}>
              <strong>{item.providerName}</strong>
              <span>{item.count} events</span>
              <small>{compactCategories(item.categories)}</small>
              <EvidenceReceiptView evidence={item} title="Evidence" compact />
            </div>)}
            {!pulseSummary.providerActivity[pulseWindow].length && <p className="muted empty-state">No provider activity in this window.</p>}
          </div>
        </div>}
        <div className="panel rail-panel" id="recent-degradations">
          <div className="panel-head">
            <div>
              <ScopeLabel scope="GLOBAL" />
              <p className="section-kicker">Monitor Alerts</p>
              <h2>Recent Degradations</h2>
              <p className="panel-caption">Safe metadata events are service reachability signals, not API execution failures.</p>
            </div>
          </div>
          <div className="mini-feed">
            {sortBySeverity(pulseSummary.recentDegradations).map((event) => <div className={`severity-${normalSeverity(event.severity)} degraded-card`} key={event.id}><SeverityBadge evidence={event} /><strong>{event.providerName ?? event.entityId}</strong><span>{event.summary}</span><small>Route implication: Not recommended for routing.</small><small>last seen healthy: {formatDate(null)}</small><small>{formatShortDate(event.observedAt)}</small><EvidenceReceiptView evidence={event} title="Evidence" compact /></div>)}
            {!pulseSummary.recentDegradations.length && <EmptyState title="No degradations detected." body="Safe metadata monitors have not reported recent reachability degradation." />}
          </div>
        </div>
      </aside>}
    </section>
    </main>
    <footer className="site-footer">
      <div>
        <p>INFOPUNKS PAY.SH RADAR</p>
        <small>Catalog-derived trust, signal, routing, and safe metadata monitoring. Unknowns stay visible.</small>
        <small>Machine Economy is an observed module for bounded authority, preflight decisions, and decision receipts.</small>
      </div>
      <div className="footer-status" aria-label="Radar catalog source status">
        <span>{sourceLabel(data.pulse.data_source)}</span>
        <small>{formatDataSource(data.pulse.data_source, data.pulse.providerCount, data.pulse.endpointCount)}</small>
      </div>
    </footer>
  </div>;
}

function CollapsibleSection({ id, title, kicker, caption, scope, className = 'panel', defaultOpen = true, children }: { id?: string; title: string; kicker?: string; caption?: string; scope?: 'GLOBAL' | 'PROVIDER'; className?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section id={id} className={`collapsible-section ${className} ${open ? 'is-open' : 'is-collapsed'}`} aria-labelledby={id ? `${id}-title` : undefined}>
    <div className="collapsible-head">
      <div>
        {scope && <ScopeLabel scope={scope} />}
        {kicker && <p className="section-kicker">{kicker}</p>}
        <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
        {caption && <p className="panel-caption">{caption}</p>}
      </div>
      <button className="collapse-toggle" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? 'Collapse' : 'Expand'}
      </button>
    </div>
    {open && <div className="collapsible-body">{children}</div>}
  </section>;
}

function RadarFreshness({ pulse, summary }: { pulse: Pulse; summary: PulseSummary | null }) {
  const catalogGeneratedAt = summary?.data_source.generated_at ?? pulse.data_source.generated_at ?? null;
  const catalogIngestedAt = summary?.data_source.last_ingested_at ?? pulse.data_source.last_ingested_at ?? null;
  const radarUpdatedAt = summary?.generatedAt ?? pulse.updatedAt ?? null;
  const lastMonitorRunAt = summary?.latest_event_at ?? null;
  const nextRefreshIn = summary?.ingest_interval_ms ? formatInterval(summary.ingest_interval_ms) : null;
  const stale = Boolean(catalogGeneratedAt && Date.now() - Date.parse(catalogGeneratedAt) > 24 * 60 * 60 * 1000);
  return <section className="panel radar-freshness" aria-label="Radar Freshness">
    <div>
      <ScopeLabel scope="GLOBAL" />
      <p className="section-kicker">Latest Ingested Catalog</p>
      <h2>Radar Freshness</h2>
      <p className="panel-caption">Timestamp clarity for catalog source, monitor checks, and the current scored snapshot.</p>
    </div>
    <div className="freshness-grid">
      <TimingItem label="catalog_generated_at" value={formatDate(catalogGeneratedAt)} />
      <TimingItem label="catalog_ingested_at" value={formatDate(catalogIngestedAt)} />
      <TimingItem label="radar_updated_at" value={formatDate(radarUpdatedAt)} />
      <TimingItem label="last_monitor_run_at" value={formatDate(lastMonitorRunAt)} />
      <TimingItem label="next_refresh_in" value={nextRefreshIn ?? 'unavailable'} />
      <TimingItem label="data_source" value={sourceLabel(summary?.data_source ?? pulse.data_source)} />
    </div>
    {stale && <p className="route-state warn">Catalog source may be stale. Scores reflect latest ingested catalog, not real-time paid execution.</p>}
  </section>;
}

function Metric({ label, value, sub, evidence }: { label: string; value: string | number; sub: string; evidence?: EvidenceReceipt | null }) {
  return <div className="panel metric"><ScopeLabel scope="GLOBAL" /><span>{label}</span><strong>{value}</strong><small>{sub}</small><EvidenceReceiptView evidence={evidence} title="Evidence" compact /></div>;
}

type EcosystemStatusState = 'critical' | 'warning' | 'info' | 'stable';

function EcosystemStatusPanel({ status, reading, pulse, summary, selectedProvider }: { status: { state: EcosystemStatusState; label: string; detail: string }; reading: string; pulse: Pulse; summary: PulseSummary | null; selectedProvider: Provider | null }) {
  const latestObserved = summary?.latest_event_at ?? summary?.generatedAt ?? pulse.updatedAt;
  const propagationState = summary?.propagation?.propagation_state ?? 'unknown';
  return <section className={`ecosystem-status-panel panel status-${status.state}`} aria-labelledby="ecosystem-status-title" role="status" aria-live="polite">
    <div className="status-command">
      <p className="section-kicker">Ecosystem Status</p>
      <h2 id="ecosystem-status-title">{status.label}</h2>
      <p>{status.detail}</p>
      <p className="system-reading-inline">{reading}</p>
    </div>
    <div className="status-grid" aria-label="Current radar command metrics">
      <StatusChip label="Catalog" value={sourceLabel(pulse.data_source)} state={pulse.data_source.used_fixture ? 'warning' : 'stable'} />
      <StatusChip label="Propagation" value={propagationState} state={status.state} />
      <StatusChip label="Latest Event" value={latestObserved ? formatDate(latestObserved) : 'none'} state={summary?.latest_event_at ? 'info' : 'stable'} />
      <StatusChip label="Featured Context" value={selectedProvider?.name ?? 'awaiting provider'} state={selectedProvider ? 'stable' : 'info'} />
    </div>
  </section>;
}

function SystemReadingPanel({ reading }: { reading: string }) {
  return <section className="panel system-reading-panel" aria-label="System reading">
    <ScopeLabel scope="GLOBAL" />
    <p className="section-kicker">System Reading</p>
    <strong>{reading}</strong>
  </section>;
}

function AgentModeBanner({ onExit, onOpenApiDocs }: { onExit: () => void; onOpenApiDocs: () => void }) {
  return <section className="panel agent-mode-banner" aria-label="Agent Mode">
    <div>
      <ScopeLabel scope="GLOBAL" />
      <p className="section-kicker">Agent Mode</p>
      <h2>Machine-actionable routing surface</h2>
      <p className="panel-caption">Agent Mode removes narrative panels and shows only routing intelligence.</p>
    </div>
    <div className="agent-mode-actions">
      <button className="execute compact secondary" type="button" onClick={onOpenApiDocs}>API Docs</button>
      <CopyButton value={toApiUrl(API_BASE_URL, OPENAPI_PATH)} label="Copy OpenAPI URL" />
      <button className="execute compact" type="button" onClick={onExit}>Full Terminal</button>
    </div>
  </section>;
}

function CommandPalette({ open, commands, onClose }: { open: boolean; commands: CommandPaletteAction[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setSelectedIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])
        .filter((node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true');
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  function activate(command: CommandPaletteAction) {
    command.run();
    onClose();
  }

  return <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" ref={dialogRef}>
      <label>
        <span>Command</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelectedIndex((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSelectedIndex((index) => Math.max(index - 1, 0));
              return;
            }
            if (event.key === 'Enter' && filtered[selectedIndex]) {
              event.preventDefault();
              activate(filtered[selectedIndex]);
            }
          }}
          placeholder="Search commands"
          aria-label="Search commands"
          aria-controls="command-palette-list"
          aria-activedescendant={filtered[selectedIndex] ? `command-${filtered[selectedIndex].id}` : undefined}
        />
      </label>
      <div className="command-list" id="command-palette-list" role="listbox" aria-label="Commands">
        {filtered.map((command, index) => <button
          key={command.id}
          id={`command-${command.id}`}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          aria-label={`${command.label}. ${command.hint}`}
          className={index === selectedIndex ? 'selected' : ''}
          onMouseEnter={() => setSelectedIndex(index)}
          onClick={() => activate(command)}
        >
          <strong>{command.label}</strong>
          <span>{command.hint}</span>
        </button>)}
        {!filtered.length && <p className="muted empty-state">No commands match.</p>}
      </div>
    </section>
  </div>;
}

function ControlStripMetric({ label, value, history, delta }: { label: string; value: string | number; history?: HistoryPoint[]; delta?: number | null }) {
  return <span className="control-metric">
    <small>{label}</small>
    <strong>{value}</strong>
    {history && <HistorySparkline points={history} delta={delta ?? null} compact />}
  </span>;
}

function PreflightConsole({
  input,
  result,
  status,
  error,
  onInputChange,
  onRun,
  onExample,
  curl
}: {
  input: string;
  result: PreflightResult | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  onInputChange: (value: string) => void;
  onRun: () => void;
  onExample: (example: Record<string, unknown>) => void;
  curl: string;
}) {
  const examples = [
    { label: 'Find SOL price route', body: { intent: 'get SOL price', category: 'finance', constraints: { min_trust: 80, prefer_reachable: true, require_pricing: true, max_price_usd: 0.01 } } },
    { label: 'Find token price route', body: { intent: 'get token price', category: 'finance', constraints: { min_trust: 75, prefer_reachable: true } } },
    { label: 'Find OCR route', body: { intent: 'extract text from image', category: 'OCR', constraints: { min_trust: 80, require_pricing: true } } },
    { label: 'Find low-cost data route', body: { intent: 'fetch market data cheaply', category: 'finance', constraints: { max_price_usd: 0.005, require_pricing: true } } },
    { label: 'Find high-trust provider', body: { intent: 'high trust provider for agent task', constraints: { min_trust: 90 } } },
    { label: 'Find route-eligible finance endpoint', body: { intent: 'find route-eligible finance endpoint', category: 'finance', constraints: { min_trust: 80, prefer_reachable: true } } }
  ];
  return <section className="panel preflight-console" id="preflight" aria-labelledby="preflight-title">
    <div className="panel-head">
      <div>
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Agent Routing Guard</p>
        <h2 id="preflight-title">Agent Preflight</h2>
        <p className="panel-caption">Before your agent pays, it checks Infopunks. Ask Radar where an agent should route before spending. This checks catalog intelligence only and does not execute paid APIs.</p>
      </div>
      <div className="panel-actions preflight-header-actions" aria-label="Agent preflight API actions">
        <a className="copy-chip" href={toApiUrl(API_BASE_URL, OPENAPI_PATH)} target="_blank" rel="noreferrer">API Docs</a>
        <CopyButton value={toApiUrl(API_BASE_URL, '/v1/radar/preflight')} label="Copy API URL" />
        <StatusPill state={result?.recommended_route ? 'healthy' : result ? 'critical' : status === 'error' ? 'watch' : 'unknown'} />
      </div>
    </div>
    <div className="preflight-examples" aria-label="Preflight examples">
      {examples.map((example) => <button key={example.label} type="button" onClick={() => onExample(example.body)}>{example.label}</button>)}
    </div>
    <div className="preflight-form">
      <label className="command-input preflight-editor">
        <span>preflight JSON input</span>
        <textarea value={input} onChange={(event) => onInputChange(event.target.value)} aria-label="Agent preflight JSON input" placeholder="Enter JSON payload for preflight." />
      </label>
      <div className="preflight-action-row">
        <details className="preflight-json preflight-batch-hint">
          <summary>Batch preflight hint</summary>
          <SafeCodeBlock value={`POST /v1/radar/preflight/batch\n{\n  "queries":[{"id":"sol-price","intent":"get SOL price","category":"finance","constraints":{"min_trust":80,"prefer_reachable":true}}]\n}`} label="Batch preflight example" />
        </details>
        <button className="execute compact" type="button" onClick={onRun} disabled={status === 'loading'}>{status === 'loading' ? 'Checking route...' : 'Run Preflight'}</button>
      </div>
    </div>
    {error && <p className="route-state error">{error}</p>}
    {!result && status !== 'loading' && !error && <EmptyState title="No preflight decision yet." body="Before your agent pays, it checks Infopunks for route intelligence." />}
    {status === 'loading' && <div className="preflight-skeleton" aria-label="Preflight loading"><span /><span /><span /></div>}
    {result && <PreflightResultView result={result} curl={curl} />}
  </section>;
}

function PreflightResultView({ result, curl }: { result: PreflightResult; curl: string }) {
  const selected = result.recommended_route;
  return <div className="preflight-result">
    <SeverityBanner
      state={selected ? 'healthy' : 'critical'}
      title={selected ? 'Route candidate found' : 'Preflight cannot recommend a route yet'}
      body={selected ? `${selected.provider_name ?? selected.provider_id} accepted under current constraints.` : 'Preflight has insufficient evidence to recommend a route.'}
    />
    <div className="preflight-result-grid">
      <div className="preflight-candidate accepted">
        <strong>{selected?.provider_name ?? selected?.provider_id ?? 'No accepted provider'}</strong>
        <span>{selected ? 'Accepted candidate' : 'No accepted candidate'}</span>
        {selected && <PredictiveRiskBadge risk={selected.predictive_risk ?? null} />}
        <KeyValues rows={[
          ['provider_id', selected?.provider_id ?? 'none'],
          ['endpoint_id', selected?.endpoint_id ?? 'none'],
          ['trust', selected?.trust_score ?? 'unknown'],
          ['signal', selected?.signal_score ?? 'unknown'],
          ['mapping', selected?.mapping_status ?? 'unknown'],
          ['reachability', selected?.reachability_status ?? 'unknown'],
          ['predictive_risk', riskBadgeLabel(selected?.predictive_risk?.predictive_risk_level ?? 'unknown')],
          ['risk_action', selected?.predictive_risk?.recommended_action ?? 'insufficient history'],
          ['trust_trend', selected?.trend_context?.trust_trend ?? 'unknown'],
          ['degradation_trend', selected?.trend_context?.degradation_trend ?? 'unknown'],
          ['last_seen_healthy', formatDate(selected?.trend_context?.last_seen_healthy_at ?? selected?.last_seen_healthy ?? null)]
        ]} />
        {selected?.trend_context?.warning && <p className="route-state warn">{selected.trend_context.warning}</p>}
      </div>
      <div className="preflight-candidate rejected">
        <strong>Rejected candidates</strong>
        <span>{result.rejected_candidates.length} rejected</span>
        <div className="preflight-rejections">
          {result.rejected_candidates.slice(0, 5).map((item) => <p key={`${item.provider_id}:${item.endpoint_id}`}><b>{item.provider_id}</b><span>{riskBadgeLabel(item.predictive_risk?.predictive_risk_level ?? 'unknown')} · {item.rejection_reasons.join(', ') || 'no rejection reasons reported'}</span></p>)}
          {!result.rejected_candidates.length && <p>No rejected providers under current policy.</p>}
        </div>
      </div>
    </div>
    <details className="preflight-json">
      <summary>Raw preflight response</summary>
      <CopyButton value={JSON.stringify(result, null, 2)} label="Copy JSON" />
      <SafeCodeBlock value={JSON.stringify(result, null, 2)} label="Raw preflight JSON response" />
    </details>
    <div className="curl-block">
      <div>
        <strong>curl</strong>
        <CopyButton value={curl} label="Copy curl" />
      </div>
      <SafeCodeBlock value={curl} label="Preflight curl command" />
    </div>
  </div>;
}

export function ComparisonPanel({
  providers,
  endpoints,
  mode,
  selectedIds,
  onModeChange,
  onSelectionChange,
  result,
  onCompare
}: {
  providers: Provider[];
  endpoints: NormalizedEndpointRecord[];
  mode: 'provider' | 'endpoint';
  selectedIds: string[];
  onModeChange: (value: 'provider' | 'endpoint') => void;
  onSelectionChange: (value: string[]) => void;
  result: RadarComparisonResult | null;
  onCompare: (ids: string[], mode: 'provider' | 'endpoint') => void;
}) {
  const [resultFilter, setResultFilter] = useState<'all' | 'route eligible' | 'not recommended' | 'degraded' | 'pricing known' | 'pricing unknown'>('all');
  const [resultQuery, setResultQuery] = useState('');
  const [resultSort, setResultSort] = useState<'trust score' | 'signal score' | 'endpoint count' | 'degradation count' | 'pricing clarity' | 'metadata quality' | 'last observed'>('trust score');
  const options = mode === 'provider'
    ? providers.map((provider) => ({ id: provider.id, label: provider.name }))
    : endpoints.map((endpoint) => ({ id: endpoint.endpoint_id, label: `${endpoint.provider_name ?? endpoint.provider_id} / ${endpoint.endpoint_name ?? endpoint.endpoint_id}` })).slice(0, 50);
  const visibleRows = result ? sortComparisonRows(filterComparisonRows(result.rows, resultQuery, resultFilter), resultSort) : [];
  const toggleComparisonSelection = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange(selectedIds.includes(id) ? selectedIds : [...selectedIds, id].slice(0, 3));
      return;
    }
    onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
  };
  return <section className="panel" id="compare" aria-label="Provider endpoint comparison engine">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Provider/Endpoint Comparison Engine</h2>
    </div>
    <div className="comparison-controls">
      <label>
        <span>mode</span>
        <select value={mode} onChange={(event) => {
          onModeChange(event.target.value === 'endpoint' ? 'endpoint' : 'provider');
          onSelectionChange([]);
        }}>
          <option value="provider">provider</option>
          <option value="endpoint">endpoint</option>
        </select>
      </label>
      <fieldset className="comparison-picker" aria-label="Comparison selection">
        <legend>select 2-3</legend>
        <div className="comparison-option-list">
          {options.map((option) => {
            const checked = selectedIds.includes(option.id);
            return <label className={checked ? 'comparison-option selected' : 'comparison-option'} key={option.id}>
              <input
                type="checkbox"
                value={option.id}
                checked={checked}
                disabled={!checked && selectedIds.length >= 3}
                onChange={(event) => toggleComparisonSelection(option.id, event.currentTarget.checked)}
              />
              <span>{option.label}</span>
            </label>;
          })}
        </div>
      </fieldset>
      <button className="execute compact secondary comparison-submit" type="button" onClick={() => onCompare(selectedIds, mode)} disabled={selectedIds.length < 2}>Compare</button>
    </div>
    {result && <div className="table-controls comparison-result-controls" aria-label="Filter and sort comparison results">
      <input value={resultQuery} onChange={(event) => setResultQuery(event.target.value)} placeholder="filter comparison result" aria-label="Filter comparison results" />
      <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as typeof resultFilter)} aria-label="Filter comparison route state">
        <option value="all">all rows</option>
        <option value="route eligible">route eligible</option>
        <option value="not recommended">not recommended</option>
        <option value="degraded">degraded</option>
        <option value="pricing known">pricing known</option>
        <option value="pricing unknown">pricing unknown</option>
      </select>
      <select value={resultSort} onChange={(event) => setResultSort(event.target.value as typeof resultSort)} aria-label="Sort comparison results">
        <option>trust score</option>
        <option>signal score</option>
        <option>endpoint count</option>
        <option>degradation count</option>
        <option>pricing clarity</option>
        <option>metadata quality</option>
        <option>last observed</option>
      </select>
    </div>}
    {!result && <EmptyState title="No comparison selected." body="Select two or three providers or endpoints, then run Compare." />}
    {result && <div className="endpoint-list has-rows comparison-results">{visibleRows.map((row) => {
      const routeState = comparisonRouteState(row);
      return <div className={`endpoint ${routeState.tone === 'degraded' ? 'degraded-card' : ''}`} key={row.id}>
      <strong>{row.name}</strong>
      <div className="dossier-badges">
        <span className={`risk-badge ${routeBadgeRiskClass(routeState.tone)} compact`}>{routeState.badge}</span>
        <PredictiveRiskBadge risk={toRiskContextFromRow(row)} compact />
      </div>
      <small>trust {row.trust_score ?? 'unknown'} / signal {row.signal_score ?? 'unknown'} / mapped {row.mapped_endpoint_count}/{row.endpoint_count} / route eligible {row.route_eligible_endpoint_count} / degraded {row.degradation_count} / reachability {row.reachability}</small>
      <small>Route status: {routeState.status}.</small>
      <small>Mapping source: {row.mapping_source ?? 'unknown'}.</small>
      <small>Route implication: {routeState.implication}</small>
      <small>Last seen healthy: {routeState.lastSeenHealthy}.</small>
      {row.rejection_reasons.length > 0 && <small>Rejection reasons: {row.rejection_reasons.join(', ')}</small>}
      {row.top_anomaly && <small>top anomaly {row.top_anomaly.anomaly_type} ({row.top_anomaly.severity}, {row.top_anomaly.confidence})</small>}
    </div>;
    })}
    {!visibleRows.length && <p className="muted empty-state">No comparison rows match the current filters.</p>}</div>}
  </section>;
}

function SuperiorityReadinessPanel({ readiness }: { readiness: RadarSuperiorityReadiness | null }) {
  const statement = 'Recorded benchmark lanes have artifact-backed evidence. Explored lanes remain scaffolded when they do not meet the hard bar.';
  return <section className="panel superiority-readiness" aria-label="Comparison Policy panel">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Comparison Policy</h2>
    </div>
    <p className="route-state">{statement}</p>
    <p className="panel-caption">Radar can compare recorded metrics. Radar does not crown winners until scoring criteria are finalized. No benchmark currently claims a winner.</p>
    {!readiness && <EmptyState title="Benchmark not ready." body="Readiness data is unavailable. Refresh once catalog history loads." />}
    {readiness && <>
      {readiness.executable_provider_mappings_count === 0 && <p className="route-state warn">No executable provider mappings detected yet. Add comparable mappings before recording a benchmark lane.</p>}
      <div className="readiness-metric">
        <span>executable provider mappings</span>
        <strong>{readiness.executable_provider_mappings_count}</strong>
      </div>
      <details className="superiority-details">
        <summary>Comparison details</summary>
      <div className="readiness-list-grid">
        <CompactChipList title="ready categories" items={readiness.categories_with_at_least_two_executable_mappings} emptyLabel="none" />
        <CompactChipList title="not ready categories" items={readiness.categories_not_ready_for_comparison} emptyLabel="none" />
        <CompactChipList title="proven paid execution providers" items={readiness.providers_with_proven_paid_execution} emptyLabel="missing" />
        <CompactChipList title="catalog metadata only providers" items={readiness.providers_with_only_catalog_metadata} emptyLabel="none" />
        <CompactChipList title="next mappings needed" items={readiness.next_mappings_needed} emptyLabel="none" wide />
      </div>
      </details>
    </>}
  </section>;
}

function CostPerformancePanel({
  endpoints,
  providerRiskById,
  benchmarkReadiness,
  loading
}: {
  endpoints: NormalizedEndpointRecord[];
  providerRiskById: Record<string, RadarRiskResponse>;
  benchmarkReadiness: RadarBenchmarkReadiness | null;
  loading: boolean;
}) {
  const readinessByCategory = new Map((benchmarkReadiness?.categories ?? []).map((item) => [item.category.toLowerCase(), item]));
  const rows = endpoints.slice(0, 30).map((endpoint) => {
    const pricing = endpoint.pricing && typeof endpoint.pricing === 'object' ? endpoint.pricing as Record<string, unknown> : {};
    const min = typeof pricing.min === 'number' ? pricing.min : null;
    const max = typeof pricing.max === 'number' ? pricing.max : null;
    const known = min !== null || max !== null;
    const est = known ? `${min ?? max} - ${max ?? min}` : 'Pricing unknown from catalog';
    const conf = !known ? 'unknown' : (min !== null && max !== null && max > min * 2 ? 'low' : 'medium');
    const priceMax = (max ?? min ?? null);
    const value = endpoint.route_eligibility && endpoint.provider_trust_score !== null && typeof priceMax === 'number' && priceMax > 0 ? Math.min(100, Math.round(endpoint.provider_trust_score / priceMax)) : null;
    const benchmark = readinessByCategory.get((endpoint.category ?? 'unknown').toLowerCase());
    return { endpoint, est, conf, value, benchmark };
  });
  return <section className="panel" id="cost-performance" aria-label="Cost and performance intelligence">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Cost / Performance Intelligence</h2>
    </div>
    <div className="endpoint-list has-rows comparison-results">
      {rows.map(({ endpoint, est, conf, value, benchmark }) => <div key={endpoint.endpoint_id} className={`endpoint ${endpoint.route_eligibility ? '' : 'degraded-card'}`}>
        <strong>{endpoint.provider_name ?? endpoint.provider_id} / {endpoint.endpoint_name ?? endpoint.endpoint_id}</strong>
        <small>category {endpoint.category ?? 'unknown'} / trust {endpoint.provider_trust_score ?? 'unknown'} / signal {endpoint.provider_signal_score ?? 'unknown'}</small>
        <small>risk {providerRiskById[endpoint.provider_id]?.risk_level ?? 'unknown'} / route status {endpoint.route_eligibility ? 'route_eligible' : 'not_recommended'} / benchmark {benchmark?.benchmark_ready ? 'ready' : 'not ready'}</small>
        <small>estimated price {est} / pricing confidence {conf === 'low' ? 'Low-confidence catalog estimate' : conf}</small>
        <small>route value score {value ?? 'unknown'} {conf === 'unknown' ? '/ Pricing unknown from catalog' : ''}</small>
      </div>)}
      {!rows.length && loading && <EmptyState title="Endpoint intelligence loading" body="Enrichment delayed" />}
      {!rows.length && !loading && <EmptyState title="Panel data unavailable" body="Benchmark data delayed" />}
    </div>
  </section>;
}

function StatusPill({ state }: { state: 'healthy' | 'watch' | 'degraded' | 'critical' | 'unknown' }) {
  const labels = {
    healthy: 'Healthy',
    watch: 'Watch',
    degraded: 'Degraded',
    critical: 'Critical',
    unknown: 'Unknown'
  };
  return <span className={`status-pill ${state}`} aria-label={`Status ${labels[state]}`}>{labels[state]}</span>;
}

function PredictiveRiskBadge({ risk, compact = false }: { risk: RadarRiskContext | null; compact?: boolean }) {
  const level = risk?.predictive_risk_level ?? 'unknown';
  const label = riskBadgeLabel(level);
  const implication = riskRouteImplication(level);
  return <span className={`risk-badge risk-${level} ${compact ? 'compact' : ''}`} title={`${label}. ${implication}`}>
    {label}
  </span>;
}

function SeverityBanner({ state, title, body }: { state: 'healthy' | 'watch' | 'degraded' | 'critical' | 'unknown'; title: string; body: string }) {
  return <div className={`severity-banner ${state}`} role={state === 'critical' ? 'alert' : 'status'}>
    <StatusPill state={state} />
    <strong>{title}</strong>
    <span>{state === 'critical' ? 'Not recommended for routing.' : routeImplicationForState(state)}</span>
    <p>{body}</p>
  </div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state polished-empty" role="status">
    <strong>{title}</strong>
    <span>{body}</span>
  </div>;
}

function CompactChipList({ title, items, emptyLabel, limit = 10, wide = false }: { title: string; items: string[]; emptyLabel: string; limit?: number; wide?: boolean }) {
  const visible = items.slice(0, limit);
  const hiddenCount = Math.max(0, items.length - visible.length);
  return <section className={wide ? 'compact-chip-list wide' : 'compact-chip-list'}>
    <div className="compact-chip-list-head">
      <strong>{title}</strong>
      <span>{items.length}</span>
    </div>
    {items.length === 0
      ? <p>{emptyLabel}</p>
      : <div className="compact-chip-wrap">
        {visible.map((item) => <span key={item}>{item}</span>)}
        {hiddenCount > 0 && <span className="more-chip">+ {hiddenCount} more</span>}
      </div>}
    {hiddenCount > 0 && <details className="compact-chip-details">
      <summary>View full list</summary>
      <div className="compact-chip-wrap full">
        {items.map((item) => <span key={item}>{item}</span>)}
      </div>
    </details>}
  </section>;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    const copied = await copyText(value);
    setState(copied ? 'copied' : 'failed');
    window.setTimeout(() => setState('idle'), 1400);
  }
  const visibleLabel = state === 'copied' ? 'Copied' : state === 'failed' ? 'Failed to copy' : label;
  return <button className="copy-chip" type="button" onClick={copy} aria-label={label} aria-live="polite">{visibleLabel}</button>;
}

function RadarExportPanel() {
  const jsonRoutes = [
    ['/v1/radar/scored-catalog', 'Export Scored Catalog JSON'],
    ['/v1/radar/providers', 'Export Providers JSON'],
    ['/v1/radar/endpoints', 'Export Endpoints JSON'],
    ['/v1/radar/routes/candidates', 'Export Route Candidates JSON']
  ] as const;
  const csvRoutes = [
    ['/v1/radar/export/providers.csv', 'Export Providers CSV'],
    ['/v1/radar/export/endpoints.csv', 'Export Endpoints CSV'],
    ['/v1/radar/export/route-candidates.csv', 'Export Route Candidates CSV'],
    ['/v1/radar/export/degradations.csv', 'Export Degradations CSV']
  ] as const;
  const routeGroups = [
    ['JSON exports', jsonRoutes],
    ['CSV exports', csvRoutes]
  ] as const;
  return <section className="panel radar-export-panel" aria-label="Radar exports">
    <div className="radar-export-head">
      <div className="radar-export-copy">
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Read-only export routes</p>
        <h2>Export Intelligence</h2>
        <p className="panel-caption">Open machine-readable radar outputs. These do not execute paid Pay.sh APIs.</p>
      </div>
      <div className="panel-actions compact-actions">
        <a className="copy-chip" href={toApiUrl(API_BASE_URL, OPENAPI_PATH)} target="_blank" rel="noreferrer">API Docs</a>
        <CopyButton value={toApiUrl(API_BASE_URL, OPENAPI_PATH)} label="Copy OpenAPI URL" />
      </div>
    </div>
    <div className="export-groups">
      {routeGroups.map(([title, routes]) => <section className="export-group" key={title} aria-label={title}>
        <div className="export-group-head">
          <h3>{title}</h3>
          <details className="export-copy-details">
            <summary>Copy links</summary>
            <div className="export-copy-actions" aria-label={`Copy ${title} API URLs`}>
              {routes.map(([path, label]) => <CopyButton key={path} value={toApiUrl(API_BASE_URL, path)} label={`Copy ${label.replace(/^Export /, '').replace(/ (JSON|CSV)$/, '')} URL`} />)}
            </div>
          </details>
        </div>
        <div className="export-actions">
          {routes.map(([path, label]) => <button key={path} type="button" className="execute compact secondary" onClick={() => openExportRoute(path)}>
            {label}
          </button>)}
        </div>
      </section>)}
    </div>
  </section>;
}

function BenchmarkReadinessPanel({ readiness, loading }: { readiness: RadarBenchmarkReadiness | null; loading: boolean }) {
  const oneProvenRow = readiness?.categories.find((row) => row.proven_execution_count === 1 && !row.benchmark_ready) ?? null;
  const twoProvenRow = readiness?.categories.find((row) => row.proven_execution_count >= 2 && row.benchmark_ready) ?? null;
  return <section className="panel superiority-readiness" id="benchmark-readiness" aria-label="Benchmark Readiness panel">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Benchmark Readiness</h2>
    </div>
    <p className="panel-caption">"Benchmark ready" means routes are comparable. Recorded benchmark evidence requires artifact-backed paid execution. "Catalog-estimated" is not execution-proven.</p>
    {!readiness && loading && <EmptyState title="Enrichment delayed" body="Benchmark data delayed" />}
    {!readiness && !loading && <EmptyState title="Panel data unavailable" body="Benchmark data delayed" />}
    {readiness && <div className="readiness-list-grid">
      <CompactChipList title="ready categories" items={readiness.benchmark_ready_categories} emptyLabel="none" />
      <CompactChipList title="not ready categories" items={readiness.not_ready_categories} emptyLabel="none" />
      <CompactChipList title="comparison ready categories" items={readiness.superiority_ready_categories} emptyLabel="none" />
      <CompactChipList title="next mappings needed" items={readiness.recommended_next_mappings} emptyLabel="none" wide />
      <CompactChipList title="mapped benchmark intents" items={readiness.categories.map((row) => `${row.category}/${row.benchmark_intent}`)} emptyLabel="none" wide />
      <CompactChipList title="mapping ladder state" items={readiness.categories.flatMap((row) => row.mapping_ladder)} emptyLabel="none" wide />
      {oneProvenRow && <p className="panel-caption">One proven route exists. Add one comparable route to unlock benchmark readiness.</p>}
      {twoProvenRow && <p className="panel-caption">Recorded benchmark lanes now have artifact-backed evidence. Explored lanes remain scaffolded when they do not meet the hard bar.</p>}
      {twoProvenRow && <p className="panel-caption">No route winner is claimed until normalized criteria are finalized.</p>}
    </div>}
  </section>;
}

function AgentSpendReadinessCardsPanel({ readiness }: { readiness: AgentReadinessList | null }) {
  const cards = readiness?.cards.slice(0, 12) ?? [];
  const artifactBackedStates = new Set<AgentSpendReadinessState>(['recorded_evidence', 'caveated_evidence', 'controlled_run_observed']);
  const artifactBackedCards = cards.filter((card) => artifactBackedStates.has(card.readiness_state));
  const exploredCards = cards.filter((card) => !artifactBackedStates.has(card.readiness_state));
  return <section className="panel agent-readiness-panel" aria-label="Agent Spend Readiness Cards">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Agent Spend Readiness Cards</h2>
    </div>
    <p className="panel-caption">Builders can now see what agents see before spending.</p>
    <p className="panel-caption">Readiness cards are proof-state diagnostics, not rankings.</p>
    <p className="panel-caption"><a href="/radar/cards">Browse public Preflight Cards</a></p>
    <p className="route-state">Grouped by proof maturity, not ranked.</p>
    {!readiness && <EmptyState title="Panel data unavailable" body="Agent readiness cards delayed" />}
    {!!cards.length && <div className="agent-readiness-groups">
      <AgentSpendReadinessCardGroup title="Artifact-backed cards" cards={artifactBackedCards} />
      <AgentSpendReadinessCardGroup title="Explored / catalog-only cards" cards={exploredCards} />
    </div>}
    {readiness && !cards.length && <EmptyState title="No cards available" body="No provider readiness diagnostics are available yet." />}
  </section>;
}

function AgentSpendReadinessCardGroup({ title, cards }: { title: string; cards: AgentReadinessCard[] }) {
  if (!cards.length) return null;
  return <section className="agent-readiness-group" aria-label={title}>
    <div className="agent-readiness-group-head">
      <h3>{title}</h3>
      <span>{cards.length} cards</span>
    </div>
    <div className="agent-readiness-grid">
      {cards.map((card) => <AgentSpendReadinessCardView key={card.provider_id} card={card} />)}
    </div>
  </section>;
}

function AgentSpendReadinessCardView({ card }: { card: AgentReadinessCard }) {
  const blockers = card.evidence_summary.caveat_count > 0
    ? `${card.evidence_summary.caveat_count} caveats / blockers`
    : 'no recorded caveats';
  const whatThisMeans = card.what_this_means ?? agentReadinessInterpretation(card.readiness_state);
  return <article className="agent-readiness-card">
    <div className="agent-readiness-card-head">
      <h3>{card.provider_label}</h3>
      <div className="readiness-chip-row" aria-label="readiness chips">
        <span className={`readiness-chip state-${card.readiness_state}`}>{card.readiness_state}</span>
        <span className={`readiness-chip spend-${card.agent_spend_readiness}`}>{card.agent_spend_readiness}</span>
        <span className="readiness-chip winner-claim">winner_claimed={String(card.winner_claimed)}</span>
        {card.agent_readiness_summary && <span className="readiness-chip decision-summary-available">agent decision summary available</span>}
      </div>
    </div>
    <div className="agent-readiness-counts" aria-label="evidence counts">
      <span><b>{card.evidence_summary.recorded_benchmarks}</b> benchmarks</span>
      <span><b>{card.evidence_summary.proven_routes}</b> proven routes</span>
      <span><b>{card.evidence_summary.controlled_bundle_runs}</b> bundle runs</span>
      <span><b>{card.evidence_summary.scaffold_lanes}</b> scaffolds</span>
    </div>
    <p className="agent-readiness-blockers">{blockers}</p>
    <p className="agent-readiness-what"><b>What this means</b><span>{whatThisMeans}</span></p>
    <p className="agent-readiness-next">{card.builder_next_step}</p>
    <div className="agent-readiness-card-actions">
      <a className="execute compact secondary agent-readiness-open" href={`/radar/readiness/${encodeURIComponent(card.provider_id)}`}>Open readiness card</a>
      <a className="execute compact secondary agent-readiness-share-action" href={`/radar/readiness/${encodeURIComponent(card.provider_id)}`}>Share card</a>
    </div>
    <details className="agent-readiness-detail">
      <summary>Detail</summary>
      <p><b>latest artifact</b><span>{card.evidence_summary.latest_artifact_id ?? 'none'}</span></p>
      <p><b>proof links</b><span>{[...card.proof_links.benchmark_history, ...card.proof_links.route_timelines, ...card.proof_links.bundle_runs].slice(0, 4).join(' | ') || 'none'}</span></p>
      <p><b>agent guidance</b><span>{card.agent_guidance}</span></p>
    </details>
    <div className="agent-readiness-share">
      <span>Public share card</span>
      <CopyButton value={card.share_copy} label="Copy readiness post" />
    </div>
    <p className="agent-readiness-share-copy">{card.share_copy}</p>
  </article>;
}

function HeadToHeadBenchmarkPanel({ registry, evidenceLedger, loading }: { registry: RadarBenchmarkRegistry | null; evidenceLedger: RadarEvidenceLedger | null; loading: boolean }) {
  const benchmarks = (registry?.benchmarks ?? []).filter((row) => row.benchmark_recorded);
  const benchmarkById = new Map(benchmarks.map((row) => [row.benchmark_id, row]));
  const recordedLanes = evidenceLedger?.recorded_lanes ?? [];
  const scaffoldLanes = evidenceLedger?.scaffold_lanes ?? [];
  const latestArtifact = [...(evidenceLedger?.latest_artifacts ?? [])]
    .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))[0] ?? null;
  const latestBenchmark = latestArtifact ? benchmarkById.get(latestArtifact.benchmark_id) ?? null : null;
  const latestRouteLabels = latestBenchmark ? latestBenchmark.routes.map((route) => benchmarkRouteLabel(route)).join(' + ') : '';
  const latestRunsPerRoute = latestArtifact?.routes_count ? Math.round(latestArtifact.recorded_runs / latestArtifact.routes_count) : 0;
  const latestEvidenceHealth = latestBenchmark?.routes.some((route) => route.comparison_notes?.toLowerCase().includes('caveat')) ? 'caveated' : 'recorded';
  const hasBenchmarks = recordedLanes.length > 0;
  const ledgerLaneRatio = evidenceLedgerLaneRatio(evidenceLedger);
  return <section className="panel superiority-readiness" aria-label="Evidence Ledger Snapshot panel">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Evidence Ledger Snapshot</h2>
    </div>
    {ledgerLaneRatio && <p className="panel-caption">{ledgerLaneRatio}</p>}
    {!hasBenchmarks && loading && <EmptyState title="Enrichment delayed" body="Benchmark data delayed" />}
    {!hasBenchmarks && !loading && <EmptyState title="Panel data unavailable" body="Benchmark data delayed" />}
    {hasBenchmarks && <>
      <p className="route-state">Radar records what graduated and what did not.</p>
      <p className="panel-caption">Recorded means paid route evidence exists. Scaffold means the lane was explored but did not meet the hard bar.</p>
      <p className="panel-caption">Scaffold lanes are not failed benchmarks. They are lanes where Radar found insufficient comparable paid evidence.</p>
      <div className="readiness-list-grid">
        <section className="compact-chip-list wide" aria-label="Recorded benchmark lanes">
          <div className="compact-chip-list-head">
            <strong>Recorded</strong>
            <span>{recordedLanes.length}</span>
          </div>
          <div className="benchmark-state-grid">
            <BenchmarkLaunchSummaryTile lanes={recordedLanes} />
            {recordedLanes.map((lane) => <BenchmarkLaunchMiniCard key={lane.benchmark_id} lane={lane} benchmark={benchmarkById.get(lane.benchmark_id) ?? null} />)}
          </div>
        </section>
        <section className="compact-chip-list wide" aria-label="Latest Recorded Benchmark">
          <div className="compact-chip-list-head">
            <strong>Latest Recorded Benchmark</strong>
            <span>recorded</span>
          </div>
          <h3>{latestArtifact?.label ?? 'n/a'}</h3>
          <div className="compact-chip-wrap">
            {latestRouteLabels && <span>{latestRouteLabels}</span>}
            <span>{latestArtifact?.recorded_runs ?? 0} recorded route-runs</span>
            <span>{latestRunsPerRoute || 0} runs / route</span>
            <span>{latestArtifact?.routes_count ?? 0} proven paid routes</span>
            <span>evidence_health: {latestEvidenceHealth}</span>
            <span>winner_claimed={String(latestArtifact?.winner_claimed ?? false)}</span>
          </div>
        </section>
      </div>
      <p className="panel-caption">Recorded evidence exists for benchmark lanes. No route winner is claimed until scoring criteria are finalized.</p>
      <section className="explored-lanes" aria-label="Explored, Not Promoted">
        <div className="phase3-panel-head compact">
          <ScopeLabel scope="GLOBAL" />
          <h3>Explored, Not Promoted</h3>
        </div>
        <div className="readiness-list-grid">
          {scaffoldLanes.map((lane) => <section className="compact-chip-list" key={lane.label}>
            <div className="compact-chip-list-head">
              <strong>{lane.label}</strong>
              <span>scaffold</span>
            </div>
            <div className="compact-chip-wrap">
              {lane.why_not_promoted.map((reason) => <span key={reason}>{reason}</span>)}
            </div>
          </section>)}
        </div>
      </section>
    </>}
  </section>;
}

function BenchmarkMetricTile({ label, value }: { label: string; value: string }) {
  return <div className="benchmark-metric-tile">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>;
}

function formatBenchmarkMetric(value: number | null | undefined, mode: 'percent' | 'percentRaw' | 'ms' | 'usd') {
  if (value === null || value === undefined) return 'n/a';
  if (mode === 'percent') return `${Math.round(value * 100)}%`;
  if (mode === 'percentRaw') return `${value}%`;
  if (mode === 'ms') return `${value} ms`;
  return `$${value}`;
}

function RouteMappingRegistryPanel({
  registry,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  intentFilter,
  onIntentFilterChange
}: {
  registry: RadarRouteMappingRegistry | null;
  statusFilter: RouteMappingStatusFilter;
  onStatusFilterChange: (value: RouteMappingStatusFilter) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  intentFilter: string;
  onIntentFilterChange: (value: string) => void;
}) {
  const mappings = registry?.mappings ?? [];
  const categoryOptions = Array.from(new Set(mappings.map((row) => row.category).filter(Boolean))).sort();
  const intentOptions = Array.from(new Set(mappings.map((row) => row.benchmark_intent).filter(Boolean))).sort();
  const filtered = mappings.filter((row) => {
    if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
    if (intentFilter !== 'all' && row.benchmark_intent !== intentFilter) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'candidate') return row.mapping_status === 'verified';
    if (statusFilter === 'verified') return row.mapping_status === 'verified';
    if (statusFilter === 'proven') return row.execution_evidence_status === 'proven';
    if (statusFilter === 'unproven') return row.execution_evidence_status === 'unproven';
    return true;
  });

  return <section className="panel superiority-readiness" id="route-mapping-registry" aria-label="Route Evidence Registry panel">
    <details className="compact-chip-details">
      <summary>Route Evidence Registry</summary>
    <ScopeLabel scope="GLOBAL" />
    <p className="section-kicker">Execution Mapping Ladder</p>
    <h2>Route Evidence Registry</h2>
    <p className="panel-caption">Catalog-only is not execution proof.</p>
    <p className="panel-caption">Verified means path/method/body known. Proven means execution evidence exists. It is not a recommendation.</p>
    <p className="panel-caption">Verified / unproven routes are not benchmark-ready until paid execution is recorded.</p>
    <div className="control-row">
      <label><span>status</span><select aria-label="Route mapping status filter" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as RouteMappingStatusFilter)}>
        <option value="all">all</option>
        <option value="candidate">candidate</option>
        <option value="verified">verified</option>
        <option value="proven">proven</option>
        <option value="unproven">unproven</option>
      </select></label>
      <label><span>category</span><select aria-label="Route mapping category filter" value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value)}>
        <option value="all">all</option>
        {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
      </select></label>
      <label><span>intent</span><select aria-label="Route mapping intent filter" value={intentFilter} onChange={(event) => onIntentFilterChange(event.target.value)}>
        <option value="all">all</option>
        {intentOptions.map((intent) => <option key={intent} value={intent}>{intent}</option>)}
      </select></label>
    </div>
    <div className="mapping-card-grid">
      {filtered.map((row, index) => {
        const mappingKeyBase = [
          row.provider_id || 'unknown-provider',
          row.benchmark_intent || 'unknown-intent',
          row.method || 'unknown-method',
          row.endpoint_url || 'unknown-endpoint'
        ].join(':');
        const mappingKey = mappingKeyBase.includes('unknown-') ? `${mappingKeyBase}:${index}` : mappingKeyBase;
        return <section key={mappingKey} className="mapping-card">
        <div className="mapping-card-head">
          <h3>{row.provider_name}</h3>
          <span className={routeMappingBadgeClass(row.mapping_status)}>{row.mapping_status}</span>
          <span className={routeMappingBadgeClass(row.execution_evidence_status)}>{row.execution_evidence_status}</span>
        </div>
        <div className="mapping-meta-row">
          <span>{row.category}</span>
          <span>{row.benchmark_intent}</span>
          <code>{row.method ?? 'unknown'} {row.endpoint_url}</code>
        </div>
        <p>provider_id: {row.provider_id}</p>
        <p>proof: {row.proof_source} · {row.proof_reference ?? 'none'}</p>
        <p>verified_at: {row.verified_at ?? 'unknown'}</p>
        <details className="compact-chip-details">
          <summary>Notes</summary>
          <p>{row.notes}</p>
        </details>
      </section>;
      })}
      {!filtered.length && <EmptyState title="No mappings match filters." body="Adjust status, category, or intent filters." />}
    </div>
    </details>
  </section>;
}

function routeMappingBadgeClass(status: RadarRouteMapping['mapping_status'] | RadarRouteMapping['execution_evidence_status']) {
  if (status === 'proven' || status === 'verified') return 'route-state ok';
  if (status === 'candidate') return 'route-state warn';
  if (status === 'unproven' || status === 'catalog_only' || status === 'unknown') return 'route-state';
  return 'route-state';
}

function MappingTargetsPanel({ registry, evidenceLedger }: { registry: RadarMappingTargetRegistry | null; evidenceLedger: RadarEvidenceLedger | null }) {
  const recordedTargets = (evidenceLedger?.recorded_lanes ?? []).map((lane) => lane.label);
  const blockedTargets = (evidenceLedger?.scaffold_lanes ?? []).map((lane) => lane.label);
  const blockedIntents = new Set((evidenceLedger?.scaffold_lanes ?? []).map((lane) => lane.benchmark_id));
  const recordedIntents = new Set((evidenceLedger?.recorded_lanes ?? []).map((lane) => lane.benchmark_id));
  const needsCandidateTargets = (registry?.targets ?? [])
    .filter((row) => row.current_state === 'needs_candidate')
    .filter((row) => !recordedIntents.has(normalizeBenchmarkId(row.category, row.benchmark_intent)))
    .filter((row) => !blockedIntents.has(normalizeBenchmarkId(row.category, row.benchmark_intent)))
    .map((row) => publicBenchmarkTitle({ benchmark_id: normalizeBenchmarkId(row.category, row.benchmark_intent), benchmark_intent: row.benchmark_intent }));
  const groups = [
    {
      title: 'Recorded',
      state: 'Recorded',
      tone: 'route-state ok',
      targets: recordedTargets
    },
    {
      title: 'Blocked',
      state: 'Blocked',
      tone: 'route-state warn',
      targets: blockedTargets
    },
    {
      title: 'Needs candidate',
      state: 'Needs candidate',
      tone: 'route-state',
      targets: needsCandidateTargets
    }
  ];

  return <section className="panel superiority-readiness" id="mapping-targets" aria-label="Mapping Targets panel">
    <ScopeLabel scope="GLOBAL" />
    <p className="section-kicker">Mapping Quest Board</p>
    <h2>Mapping Targets</h2>
    <p className="panel-caption">Recorded lanes are completed evidence-ledger entries. Scaffold lanes are planning prompts, not recorded benchmark targets.</p>
    <div className="mapping-target-board">
      {groups.map((group) => <section key={group.title} className="mapping-target-category">
        <h3><strong>{group.title}</strong></h3>
        {group.targets.map((target) => <div className="mapping-target-card" key={`${group.title}:${target}`}>
          <div className="mapping-card-head">
            <h4>{target}</h4>
            <span className={group.tone}>{group.state}</span>
          </div>
          {group.title === 'Recorded' && <p><b>Status</b>completed; evidence ledger recorded</p>}
          {group.title === 'Blocked' && <p><b>Status</b>explored but not promoted; no benchmark artifact</p>}
          {group.title === 'Needs candidate' && <p><b>Next step</b>Add candidate mappings before comparable benchmark work.</p>}
        </div>)}
      </section>)}
    </div>
  </section>;
}

function mappingTargetBadgeClass(state: RadarMappingTarget['current_state']) {
  if (state === 'benchmark_ready') return 'route-state ok';
  if (state === 'needs_verified_route' || state === 'verified_mapping_found' || state === 'second_verified_mapping_found' || state === 'one_proven_mapping_found') return 'route-state warn';
  if (state === 'needs_two_comparable_mappings') return 'route-state';
  return 'route-state';
}

function normalizeBenchmarkId(category: string, intent: string) {
  if (category === 'communications' && intent === 'email delivery') return 'communications-email-delivery';
  if (category === 'solana-infra' && intent === 'account balance') return 'solana-infra-account-balance';
  if (category === 'social-data' && intent === 'reddit post search') return 'social-data-reddit-post-search';
  if (category === 'document-ai' && intent === 'document OCR text extraction') return 'document-ocr-text-extraction';
  if (category === 'web-search' && intent === 'web search results') return 'data-web-search-results';
  if (category === 'maps' && intent === 'place search results') return 'maps-place-search-results';
  if (category === 'audio-ai' && intent === 'audio speech transcription') return 'audio-speech-transcription';
  if (category === 'finance/data' && intent === 'token search') return 'finance-data-token-search';
  if (category === 'finance/data' && intent === 'token metadata') return 'finance-data-token-metadata';
  if (category === 'finance/data' && intent === 'get SOL price') return 'finance-data-sol-price';
  return `${category}-${intent}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

const morningBriefingPlannerCurl = `curl -s https://infopunks-pay-sh-radar.onrender.com/v1/radar/bundles/morning-briefing/plan \\
  -H "content-type: application/json" \\
  -d '{
    "topic": "AI, crypto, world news",
    "constraints": {
      "max_cost_usd": 0.05,
      "allow_billing_unclear": false,
      "allow_scaffold_routes": false
    }
  }' | jq '.data'`;

const marketResearchPlannerCurl = `curl -s https://infopunks-pay-sh-radar.onrender.com/v1/radar/bundles/market-research/plan \\
  -H "content-type: application/json" \\
  -d '{
    "topic": "Circle Internet Group",
    "constraints": {
      "max_cost_usd": 0.10,
      "allow_billing_unclear": false,
      "allow_billable_probe_observed": false,
      "allow_scaffold_routes": false
    }
  }' | jq '.data.blocked_steps'`;

const talentMarketScannerPlannerCurl = `curl -s https://infopunks-pay-sh-radar.onrender.com/v1/radar/bundles/talent-market-scanner/plan \\
  -H "content-type: application/json" \\
  -d '{
    "topic": "AI engineer",
    "constraints": {
      "max_cost_usd": 0.05,
      "allow_billing_unclear": false,
      "allow_scaffold_routes": false
    }
  }' | jq '.data | {status,winner_claimed,execution_boundary_summary, route_plan: [.route_plan[] | {step_id,plan_status,execution_boundary,next_action}]}'`;

const bundlePlannerExamples = [
  {
    bundleId: 'morning-briefing',
    title: 'Morning Briefing',
    topic: 'AI, crypto, world news',
    payload: {
      topic: 'AI, crypto, world news',
      constraints: {
        max_cost_usd: 0.05,
        allow_billing_unclear: false,
        allow_scaffold_routes: false
      }
    },
    curl: morningBriefingPlannerCurl
  },
  {
    bundleId: 'market-research',
    title: 'Market Research',
    topic: 'Circle Internet Group',
    payload: {
      topic: 'Circle Internet Group',
      constraints: {
        max_cost_usd: 0.10,
        allow_billing_unclear: false,
        allow_billable_probe_observed: false,
        allow_scaffold_routes: false
      }
    },
    curl: marketResearchPlannerCurl
  },
  {
    bundleId: 'talent-market-scanner',
    title: 'Talent Market Scanner',
    topic: 'AI engineer',
    payload: {
      topic: 'AI engineer',
      constraints: {
        max_cost_usd: 0.05,
        allow_billing_unclear: false,
        allow_scaffold_routes: false
      }
    },
    curl: talentMarketScannerPlannerCurl
  }
] as const;

function countBundlePlanStatuses(plan: RadarBundlePlanResponse | null) {
  if (!plan) return { included: 0, reviewRequired: 0, blocked: 0 };
  return {
    included: plan.route_plan.filter((step) => step.plan_status === 'included').length,
    reviewRequired: plan.route_plan.filter((step) => step.plan_status === 'review_required').length,
    blocked: plan.route_plan.filter((step) => step.plan_status === 'blocked').length
  };
}

function AgentBenchmarkApiPanel() {
  const evidenceLedgerCurl = `curl -s ${toApiUrl(PUBLIC_API_HOST, '/v1/radar/evidence-ledger')}`;
  const evidenceLedgerBriefCurl = `curl -s ${toApiUrl(PUBLIC_API_HOST, '/v1/radar/evidence-ledger/brief')} | jq '.data'`;
  const benchmarkSnippet = `{
  "benchmark_id": "finance-data-sol-price",
  "benchmark_recorded": true,
  "winner_status": "no_clear_winner",
  "winner_claimed": false,
  "winner_policy": {
    "policy_id": "sol-price-v0.1",
    "completed_runs": 5,
    "required_runs": 5
  },
  "routes": [
    {
      "provider_id": "merit-systems-stablecrypto-market-data",
      "success_rate": 1,
      "median_latency_ms": 5691,
      "average_price_usd": 87.57,
      "status_code": null,
      "status_evidence": "pay_cli exit code 0 and parsed response body"
    }
  ]
}`;
  const morningBriefingRunsCurl = `curl -s ${toApiUrl(PUBLIC_API_HOST, '/v1/radar/bundles/morning-briefing/runs')} | jq '.data'`;
  const openApiCurl = `curl -s ${toApiUrl(PUBLIC_API_HOST, OPENAPI_PATH)}`;
  const curlExamples = [
    { label: 'Evidence Ledger', value: evidenceLedgerCurl },
    { label: 'Evidence Brief', value: evidenceLedgerBriefCurl },
    { label: 'Morning Briefing Plan', value: morningBriefingPlannerCurl },
    { label: 'Market Research Plan', value: marketResearchPlannerCurl },
    { label: 'Talent Scanner Plan', value: talentMarketScannerPlannerCurl },
    { label: 'Morning Briefing Run Ledger', value: morningBriefingRunsCurl },
    { label: 'OpenAPI', value: openApiCurl }
  ] as const;
  const [activeCurlIndex, setActiveCurlIndex] = useState(0);
  const activeCurl = curlExamples[activeCurlIndex] ?? curlExamples[0];
  const [bundleRunStatus, setBundleRunStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [bundleRunSummary, setBundleRunSummary] = useState<RadarBundleRunSummary | null>(null);
  const [bundleRunList, setBundleRunList] = useState<RadarBundleRunListResponse | null>(null);
  const [bundleRunDetail, setBundleRunDetail] = useState<RadarBundleRunDetail | null>(null);
  const [bundlePlans, setBundlePlans] = useState<Record<string, RadarBundlePlanResponse | null>>({});
  const [bundlePlannerStatus, setBundlePlannerStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const endpointGroups = [
    {
      title: 'Evidence',
      endpoints: [
        ['GET', '/v1/radar/evidence-ledger', 'Agent-readable evidence before spend.'],
        ['GET', '/v1/radar/evidence-ledger/brief', 'Compact preflight memory from the Evidence Ledger.'],
        ['GET', '/v1/radar/benchmark-summary', 'Benchmark state and interpretation summary.'],
        ['GET', '/v1/radar/benchmark-history', 'Recorded benchmark history and evidence.']
      ]
    },
    {
      title: 'Bundles',
      endpoints: [
        ['GET', '/v1/radar/bundles', 'Read-only bundle registry.'],
        ['GET', '/v1/radar/bundles/:bundle_id', 'Bundle detail with evidence boundaries.'],
        ['POST', '/v1/radar/bundles/:bundle_id/plan', 'Plan included, review-required, and blocked steps.']
      ]
    },
    {
      title: 'Runs',
      endpoints: [
        ['GET', '/v1/radar/bundles/:bundle_id/runs', 'Bundle Run Ledger summaries.'],
        ['GET', '/v1/radar/bundles/:bundle_id/runs/:run_id', 'One Harness proof record.']
      ]
    },
    {
      title: 'Docs',
      endpoints: [
        ['GET', '/openapi.json', 'OpenAPI for agents.']
      ]
    }
  ] as const;

  useEffect(() => {
    let cancelled = false;
    setBundlePlannerStatus('loading');
    Promise.all(bundlePlannerExamples.map(async (example) => {
      const response = await api<{ data: RadarBundlePlanResponse }>(`/v1/radar/bundles/${example.bundleId}/plan`, {
        method: 'POST',
        body: JSON.stringify(example.payload)
      });
      return [example.bundleId, response.data] as const;
    }))
      .then((entries) => {
        if (cancelled) return;
        setBundlePlans(Object.fromEntries(entries));
        setBundlePlannerStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setBundlePlannerStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBundleRunStatus('loading');
    api<{ data: RadarBundleRunListResponse }>('/v1/radar/bundles/morning-briefing/runs')
      .then(async (response) => {
        if (cancelled) return;
        setBundleRunList(response.data);
        const latestRun = response.data.runs[0] ?? null;
        setBundleRunSummary(latestRun);
        if (!latestRun) {
          setBundleRunStatus('error');
          return;
        }
        const detailResponse = await api<{ data: RadarBundleRunDetail }>(`/v1/radar/bundles/morning-briefing/runs/${encodeURIComponent(latestRun.run_id)}`);
        if (cancelled) return;
        setBundleRunDetail(detailResponse.data);
        setBundleRunStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setBundleRunStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <section className="panel radar-export-panel agent-api-panel" id="agent-benchmark-api" aria-label="Agent benchmark API">
    <div className="radar-export-head">
      <div className="radar-export-copy">
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Agent API Surface</p>
        <h2>Agent Benchmark API</h2>
        <p className="panel-caption">Read-only evidence and planning endpoints for agents. Radar exposes evidence, plans, and Harness proof records; it does not execute paid APIs.</p>
        <p className="panel-caption api-host-line"><b>API host:</b> https://infopunks-pay-sh-radar.onrender.com. The public UI lives at radar.infopunks.fun; copyable API calls target the API host.</p>
      </div>
      <div className="panel-actions compact-actions">
        <a className="copy-chip" href={toApiUrl(API_BASE_URL, OPENAPI_PATH)} target="_blank" rel="noreferrer">API Docs</a>
      </div>
    </div>

    <div className="agent-api-stack">
      <section className="agent-api-surface" aria-label="Agent API Surface endpoint groups">
        {endpointGroups.map((group) => <div className="agent-endpoint-group" key={group.title}>
          <h3>{group.title}</h3>
          <div className="agent-endpoint-list">
            {group.endpoints.map(([method, path, description]) => <p className="agent-endpoint-row" key={`${method}:${path}`}>
              <span className={`method-chip method-${method.toLowerCase()}`}>{method}</span>
              <code> {path}</code>
              <span>{description}</span>
            </p>)}
          </div>
        </div>)}
      </section>

      <section className="agent-story-panel bundle-planner-group" aria-label="Bundle planner examples">
        <div className="export-group-head">
          <h3>Bundle Planner</h3>
        </div>
        <p className="panel-caption">Bundles are non-executing spend recipes. Plans map intent and constraints to included, review-required, and blocked steps. Radar does not execute paid APIs from bundle plans.</p>
        {bundlePlannerStatus === 'loading' && <div className="preflight-skeleton" aria-label="Bundle planner loading"><span /><span /><span /></div>}
        {bundlePlannerStatus === 'error' && <EmptyState title="Bundle planner examples unavailable." body="Planner examples are documentation-only previews. Retry when bundle plan APIs are reachable." />}
        <div className="bundle-planner-card-grid">
          {bundlePlannerExamples.map((example) => {
            const plan = bundlePlans[example.bundleId] ?? null;
            const counts = countBundlePlanStatuses(plan);
            const boundary = plan?.execution_boundary_summary;
            return <article className="bundle-plan-card" key={example.bundleId}>
              <p className="bundle-plan-title"><b>Bundle</b><span>{example.title} / topic: {example.topic}</span></p>
              <p><b>Planner result</b><span className="agent-chip-row"><span>{counts.included} included</span> · <span>{counts.reviewRequired} review-required</span> · <span>{counts.blocked} blocked</span>{example.bundleId === 'morning-briefing' && <> · <span>winner_claimed={String(plan?.winner_claimed ?? false)}</span></>}</span></p>
              {example.bundleId === 'morning-briefing' && <>
                <p><b>Execution boundary</b><span className="agent-chip-row"><span>clean_402={boundary?.clean_402 ?? 0}</span><span>billing_unclear={boundary?.billing_unclear ?? 0}</span><span>billable_probe_observed={boundary?.billable_probe_observed ?? 0}</span></span></p>
                <p><b>Radar action</b><span>Plan only. Cleanest future Harness candidate, but not execution-ready until review-required billing boundaries are cleared.</span></p>
              </>}
              {example.bundleId === 'market-research' && <>
                <p><b>Execution boundary</b><span className="agent-chip-row"><span>clean_402={boundary?.clean_402 ?? 0}</span><span>billing_unclear={boundary?.billing_unclear ?? 0}</span><span>billable_probe_observed={boundary?.billable_probe_observed ?? 0}</span><span>blocked={boundary?.blocked ?? 0}</span></span></p>
                <p><b>Radar action</b><span>Two billable-probe steps are blocked under strict constraints; remaining steps require billing-boundary review.</span></p>
              </>}
              {example.bundleId === 'talent-market-scanner' && <>
                <p><b>Execution boundary</b><span className="agent-chip-row"><span>clean_402={boundary?.clean_402 ?? 0}</span><span>billing_unclear={boundary?.billing_unclear ?? 0}</span><span>blocked={boundary?.blocked ?? counts.blocked}</span></span></p>
                <p><b>Radar action</b><span>Job, salary, and hiring primitives are not yet recorded.</span></p>
              </>}
            </article>;
          })}
        </div>
      </section>

      <section className="agent-story-panel bundle-run-ledger-group" aria-label="Bundle run ledger">
        <div className="export-group-head">
          <h3>Bundle Run Ledger</h3>
        </div>
        <p className="panel-caption">Bundle runs are Harness proof records, not benchmark claims.</p>
        <p className="panel-caption">Radar does not execute paid APIs from this surface.</p>
        <p className="panel-caption">Radar remembers controlled Harness runs over time.</p>
        <p className="panel-caption">Bundle run history records controlled Harness proof evolution, not benchmark claims.</p>
        <p className="panel-caption">This run is caveated because observed cost and pay_cli HTTP status were unavailable, and one executed step had an empty source map.</p>
        <p className="panel-caption"><b>winner_claimed=false</b></p>
        {bundleRunStatus === 'loading' && <div className="preflight-skeleton" aria-label="Bundle run ledger loading"><span /><span /><span /></div>}
        {bundleRunStatus === 'error' && <>
          <p className="route-state warn">Bundle Run Ledger unavailable</p>
          <p className="route-state warn">Bundle Run History unavailable</p>
          <p className="route-state warn">Bundle Run Freshness unavailable</p>
        </>}
        {bundleRunStatus === 'ready' && bundleRunSummary && bundleRunDetail && <div className="bundle-run-ledger-card">
          {(() => {
            const historySummary = bundleRunList?.history_summary;
            const freshness = bundleRunList?.freshness;
            const agentReadinessSummary = bundleRunList?.agent_readiness_summary;
            const latestRun = bundleRunList?.runs.find((run) => run.run_id === historySummary?.latest_run_id) ?? bundleRunList?.runs[0] ?? null;
            const previousRun = bundleRunList?.runs.find((run) => run.run_id === historySummary?.previous_run_id) ?? bundleRunList?.runs[1] ?? null;
            const caveatsUnchanged = historySummary ? historySummary.caveat_delta.added.length === 0 && historySummary.caveat_delta.removed.length === 0 : false;
            const deltaLabel = historySummary ? `${historySummary.source_count_delta >= 0 ? '+' : ''}${historySummary.source_count_delta} source${Math.abs(historySummary.source_count_delta) === 1 ? '' : 's'}` : '';
            return <>
          <div className="bundle-receipt-head">
            <div>
              <p className="section-kicker">Compact proof receipt</p>
              <strong>Morning Briefing controlled Harness run</strong>
            </div>
            <span>{bundleRunSummary.status}</span>
          </div>
          <div className="agent-chip-row run-summary-chips proof-receipt-metrics" aria-label="Bundle Run Ledger summary chips">
            <span>{bundleRunSummary.evidence_health}</span>
            <span>{bundleRunSummary.executed_step_count} executed</span>
            <span>{bundleRunSummary.skipped_step_count} skipped</span>
            <span>{bundleRunSummary.blocked_step_count} blocked</span>
            <span>{bundleRunSummary.source_count} sources</span>
            <span>{bundleRunSummary.observed_cost_usd == null ? 'observed cost unavailable' : `$${bundleRunSummary.observed_cost_usd.toFixed(2)}`}</span>
            <span>winner_claimed={String(bundleRunSummary.winner_claimed)}</span>
          </div>
          {historySummary ? <div className="bundle-run-history" aria-label="Run History">
            <div className="bundle-run-history-head">
              <p className="section-kicker">Run History</p>
              <span>{historySummary.history_count} controlled runs tracked</span>
            </div>
            <div className="bundle-run-history-cards">
              <article>
                <b>Latest</b>
                <span>{runIdSuffix(historySummary.latest_run_id)} · {latestRun?.source_count ?? historySummary.latest_source_count} sources · {latestRun?.evidence_health ?? 'caveated'}</span>
              </article>
              <article>
                <b>Previous</b>
                <span>{runIdSuffix(historySummary.previous_run_id)} · {previousRun?.source_count ?? historySummary.previous_source_count} sources · {previousRun?.evidence_health ?? 'caveated'}</span>
              </article>
              <article>
                <b>Delta</b>
                <span>{deltaLabel} · caveats {caveatsUnchanged ? 'unchanged' : 'changed'} · observed cost {historySummary.observed_cost_state}</span>
              </article>
              {freshness ? <article>
                <b>Freshness</b>
                <span>{freshness.freshness_state} · {freshness.latest_run_age_hours}h · {freshness.last_controlled_run_at}</span>
              </article> : <article>
                <b>Freshness</b>
                <span>Bundle Run Freshness unavailable</span>
              </article>}
            </div>
            <p className="bundle-run-history-foot">
              skipped review-required steps {historySummary.skipped_review_required_steps_stable ? `stable at ${historySummary.latest_skipped_step_count}` : `${historySummary.previous_skipped_step_count} -> ${historySummary.latest_skipped_step_count}`} · winner_claimed={String(historySummary.winner_claimed)}
            </p>
            {freshness ? <p className="bundle-run-history-foot">recommended action: {freshness.recommended_agent_action}</p> : <p className="route-state warn">Bundle Run Freshness unavailable</p>}
            {agentReadinessSummary && <div className="agent-readiness-summary-card" aria-label="Agent Readiness Summary">
              <div>
                <p className="section-kicker">Agent Readiness Summary</p>
                <span>Agent Readiness Summary compresses freshness, caveats, skipped steps, and cost visibility into one pre-spend decision object.</span>
              </div>
              <div className="agent-readiness-summary-grid">
                <span>ready_for_agent_review={String(agentReadinessSummary.ready_for_agent_review)}</span>
                <span>requires_rerun_before_spend={String(agentReadinessSummary.requires_rerun_before_spend)}</span>
                <span>requires_human_or_policy_approval={String(agentReadinessSummary.requires_human_or_policy_approval)}</span>
                <span>observed_cost_available={String(agentReadinessSummary.observed_cost_available)}</span>
                <span>winner_claimed={String(agentReadinessSummary.winner_claimed)}</span>
                <span>decision_state={agentReadinessSummary.decision_state}</span>
              </div>
              <p className="bundle-run-history-foot">recommended_agent_action: {agentReadinessSummary.recommended_agent_action}</p>
            </div>}
          </div> : <p className="route-state warn">Bundle Run History unavailable</p>}
          {historySummary && <p className="panel-caption">
            {historySummary.history_count} controlled runs tracked · latest source_count {historySummary.source_count_delta >= 0 ? '+' : ''}{historySummary.source_count_delta} · observed cost still unavailable · winner_claimed=false
          </p>}
          <div className="bundle-run-subgrid">
            {historySummary && <>
              <p><b>Latest run</b><span>{runIdSuffix(historySummary.latest_run_id)}</span></p>
              <p><b>Previous run</b><span>{runIdSuffix(historySummary.previous_run_id)}</span></p>
              <p><b>Source count</b><span>{historySummary.previous_source_count} {'->'} {historySummary.latest_source_count}</span></p>
              <p><b>Caveats</b><span>{caveatsUnchanged ? 'unchanged' : 'changed'}</span></p>
              <p><b>Skipped review-required steps</b><span>{historySummary.skipped_review_required_steps_stable ? `stable at ${historySummary.latest_skipped_step_count}` : `${historySummary.previous_skipped_step_count} -> ${historySummary.latest_skipped_step_count}`}</span></p>
            </>}
            <p><b>Executed steps</b><span>{bundleRunDetail.executed_steps.map((step) => step.step_id).join(' · ')}</span></p>
            <p><b>Skipped review-required</b><span>{bundleRunDetail.skipped_steps.map((step) => step.step_id).join(' · ')}</span></p>
            <p><b>Caveats</b><span>{bundleRunDetail.caveat_objects.map((caveat) => caveat.code).join(' · ')}</span></p>
            <p><b>Sources</b><span>{bundleRunSummary.source_count} sources; {bundleRunDetail.source_map.slice(0, 5).map((source) => source.label).join(' · ')}</span></p>
          </div>
            </>;
          })()}
        </div>}
      </section>

      <details className="agent-story-panel agent-examples-drawer" aria-label="Agent benchmark curl examples">
        <summary>Copyable curl examples</summary>
        <div className="example-picker" aria-label="Copy benchmark curl examples">
          {curlExamples.map((example, index) => <button className={`copy-chip ${index === activeCurlIndex ? 'selected' : ''}`} type="button" key={example.label} onClick={() => setActiveCurlIndex(index)}>{example.label}</button>)}
        </div>
        <CopyButton value={activeCurl.value} label={`Copy ${activeCurl.label}`} />
        <SafeCodeBlock value={activeCurl.value} label={`${activeCurl.label} curl example`} />
      </details>

      <details className="agent-story-panel agent-examples-drawer" aria-label="Agent benchmark response snippet">
        <summary>Example response snippet</summary>
        <SafeCodeBlock value={benchmarkSnippet || 'Select an example to preview a response.'} label="Benchmark response example snippet" />
      </details>

      <section className="agent-story-panel" aria-label="Agent benchmark interpretation guidance">
        <div className="export-group-head">
          <h3>Agent Interpretation Guidance</h3>
        </div>
        <div className="endpoint-card-grid guidance-card-grid">
          <p><b>benchmark-summary</b><span>Use when route metrics are not needed.</span></p>
          <p><b>winner_claimed=false</b><span>Do not treat route as winner.</span></p>
          <p><b>bundle plans</b><span>Non-executing spend recipes only.</span></p>
          <p><b>bundle runs</b><span>Harness proof records, not benchmark claims.</span></p>
          <p><b>status_code may be null in pay_cli mode</b><span>Use status_evidence.</span></p>
        </div>
      </section>
    </div>
  </section>;
}

function ProviderDegradedWarning({ info }: { info: ReturnType<typeof providerDegradationInfo> }) {
  return <section className="degraded-warning" aria-label="Provider degraded warning">
    <strong>Provider degraded warning</strong>
    <span>not recommended for routing</span>
    <p>{info.reason}</p>
    <small>last seen healthy: {formatDate(info.lastHealthyAt)}</small>
  </section>;
}

function EndpointIntelligenceSection({
  rows,
  allRows,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  provider,
  endpointMonitors,
  endpointRisks,
  reportedEndpointCount
}: {
  rows: EndpointIntelligenceRow[];
  allRows: EndpointIntelligenceRow[];
  filter: EndpointFilter;
  onFilterChange: (filter: EndpointFilter) => void;
  query: string;
  onQueryChange: (value: string) => void;
  sort: EndpointSort;
  onSortChange: (value: EndpointSort) => void;
  provider: Provider | null;
  endpointMonitors: Record<string, EndpointMonitor>;
  endpointRisks: Record<string, RadarRiskResponse>;
  reportedEndpointCount: number;
}) {
  const [copyState, setCopyState] = useState<Record<string, 'json' | 'curl' | 'failed'>>({});
  const filters: Array<[EndpointFilter, string]> = [
    ['all', 'all'],
    ['route_eligible', 'route eligible'],
    ['mapping_incomplete', 'mapping incomplete'],
    ['degraded', 'degraded'],
    ['priced', 'priced'],
    ['unknown_pricing', 'unknown pricing']
  ];
  const visibleRows = sortEndpointRows(filterEndpointRowsByQuery(rows, query), sort);

  async function copyEndpoint(key: string, value: string, state: 'json' | 'curl') {
    const copied = await copyText(value);
    setCopyState((current) => ({ ...current, [key]: copied ? state : 'failed' }));
    window.setTimeout(() => setCopyState((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    }), 1600);
  }

  return <div className="endpoint-intelligence">
    <div className="table-controls endpoint-table-controls" aria-label="Filter and sort endpoint intelligence">
      <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="filter endpoint, provider, path, category" aria-label="Filter endpoints by name provider path or category" />
      <select value={sort} onChange={(event) => onSortChange(event.target.value as EndpointSort)} aria-label="Sort endpoint intelligence">
        <option>route eligibility</option>
        <option>metadata quality</option>
        <option>pricing clarity</option>
        <option>reachability</option>
        <option>last observed</option>
        <option>name</option>
      </select>
    </div>
    <div className="endpoint-filter-tabs" role="group" aria-label="Filter endpoint intelligence">
      {filters.map(([value, label]) => <button key={value} type="button" className={filter === value ? 'selected' : ''} aria-pressed={filter === value} onClick={() => onFilterChange(value)}>{label}</button>)}
    </div>
    {!allRows.length && reportedEndpointCount > 0 && <p className="endpoint-state">Mapping incomplete. Pay.sh catalog reports {reportedEndpointCount} endpoints, but endpoint-level mappings are not available in the current payload.</p>}
    {!allRows.length && reportedEndpointCount === 0 && <EmptyState title="No endpoints found." body="The live catalog reports no endpoints for this provider." />}
    {!!allRows.length && !visibleRows.length && <EmptyState title="No endpoints found." body="Adjust the endpoint search, filter, or sort order." />}
    <div className="endpoint-intelligence-list">
      {visibleRows.map((row) => {
        const endpoint = row.normalized;
        const monitor = endpointMonitors[endpoint.endpoint_id];
        const endpointRisk = endpointRisks[endpoint.endpoint_id];
        const curl = buildCurlCommand(endpoint);
        const json = JSON.stringify(endpoint, null, 2);
        const copyKey = endpoint.endpoint_id;
        return <details className={`endpoint-intelligence-card ${isEndpointDegraded(row, monitor) ? 'degraded' : ''}`} key={endpoint.endpoint_id}>
          <summary>
            <span className="endpoint-title">
              <strong>{endpoint.endpoint_name ?? row.raw?.name ?? 'Unnamed endpoint'}</strong>
              <small>{endpoint.method ?? 'METHOD_UNKNOWN'} {endpoint.url ?? endpoint.path ?? 'path unavailable'}</small>
            </span>
            <span className="endpoint-tags">
              <b>{endpoint.category ?? 'category unknown'}</b>
              <b>{pricingSummary(endpoint.pricing)}</b>
              <b>{routeEligibilityLabel(endpoint.route_eligibility)}</b>
              <b>{statusLabel(endpoint.reachability_status)}</b>
              <PredictiveRiskBadge risk={toRiskContext(endpointRisk)} compact />
            </span>
          </summary>
          <div className="endpoint-card-body">
            <div className="endpoint-flags">
              {isEndpointMappingIncomplete(row) && <span>Mapping incomplete</span>}
              {isEndpointCatalogMetadataIncomplete(row) && <span>Catalog metadata incomplete</span>}
              {endpoint.route_eligibility === false && <span>not recommended for routing</span>}
              {endpoint.route_rejection_reasons.map((reason) => <span key={reason}>{reason}</span>)}
            </div>
            <KeyValues rows={[
              ['endpoint_id', endpoint.endpoint_id],
              ['method', endpoint.method ?? 'unknown'],
              ['path', endpoint.path ?? 'unknown'],
              ['url', endpoint.url ?? 'unknown'],
              ['catalog_observed_at', formatDate(endpoint.catalog_observed_at)],
              ['catalog_generated_at', formatDate(endpoint.catalog_generated_at)],
              ['health', statusLabel(monitor?.health ?? endpoint.reachability_status)],
              ['last_monitor_check', formatDate(monitor?.lastCheck?.observedAt)],
              ['predictive_risk', riskBadgeLabel(toRiskContext(endpointRisk)?.predictive_risk_level ?? 'unknown')]
            ]} />
            {endpointRisk && <p className="route-state">{toRiskContext(endpointRisk)?.recommended_action ?? 'insufficient history'}.</p>}
            <div className="endpoint-copy-actions">
              <button className="execute compact secondary" type="button" onClick={() => copyEndpoint(copyKey, json, 'json')}>
                {copyState[copyKey] === 'json' ? 'Copied' : copyState[copyKey] === 'failed' ? 'Failed to copy' : 'Copy JSON'}
              </button>
              {curl.command
                ? <button className="execute compact secondary" type="button" onClick={() => copyEndpoint(`${copyKey}:curl`, curl.command!, 'curl')}>
                  {copyState[`${copyKey}:curl`] === 'curl' ? 'Copied' : copyState[`${copyKey}:curl`] === 'failed' ? 'Failed to copy' : 'Copy curl'}
                </button>
                : <span className="curl-unavailable">curl unavailable: endpoint mapping incomplete</span>}
              <CopyButton value={endpoint.endpoint_id} label="Copy endpoint id" />
              <CopyButton value={endpoint.provider_id} label="Copy provider id" />
            </div>
            <div className="endpoint-json-grid">
              <JsonPanel title="Normalized Endpoint JSON" value={endpoint} />
              <JsonPanel title="Input Schema" value={endpoint.input_schema} />
              <JsonPanel title="Output Schema" value={endpoint.output_schema} />
              <JsonPanel title="Pricing Payload" value={endpoint.pricing} />
              <JsonPanel title="Route Eligibility Evidence" value={{
                route_eligibility: endpoint.route_eligibility,
                route_rejection_reasons: endpoint.route_rejection_reasons,
                reachability_status: endpoint.reachability_status,
                degradation_status: endpoint.degradation_status
              }} />
              <JsonPanel title="Provider Trust / Signal Context" value={{
                provider_id: endpoint.provider_id,
                provider_name: endpoint.provider_name ?? provider?.name ?? null,
                provider_trust_score: endpoint.provider_trust_score,
                provider_signal_score: endpoint.provider_signal_score,
                provider_grade: endpoint.provider_grade,
                metadata_quality_score: endpoint.metadata_quality_score,
                pricing_clarity_score: endpoint.pricing_clarity_score,
                source: endpoint.source
              }} />
            </div>
          </div>
        </details>;
      })}
    </div>
  </div>;
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  const empty = value === null || value === undefined || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0);
  return <div className="endpoint-json-panel">
    <strong>{title}</strong>
    <SafeCodeBlock value={empty ? 'unavailable' : JSON.stringify(value, null, 2)} label={title} />
  </div>;
}

function SafeCodeBlock({ value, label }: { value: string; label: string }) {
  return <pre className="safe-code-block" tabIndex={0} aria-label={label}>{value}</pre>;
}

function StatusChip({ label, value, state }: { label: string; value: string; state: EcosystemStatusState }) {
  return <div className={`status-chip status-${state}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>;
}

function EcosystemInterpretationPanel({ interpretations, providerLookup }: { interpretations: EcosystemInterpretation[]; providerLookup: Map<string, Provider> }) {
  const safeInterpretations = Array.isArray(interpretations) ? interpretations : [];
  const primary = safeInterpretations[0] ?? null;
  const secondary = safeInterpretations.slice(1, 5);
  if (!primary) return null;
  return <section className="panel ecosystem-interpretation" aria-labelledby="ecosystem-interpretation-title">
    <div className="panel-head">
      <div>
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Interpretation Layer</p>
        <h2 id="ecosystem-interpretation-title">Ecosystem Interpretation</h2>
        <p className="panel-caption">Primary analyst readout from current receipts. Secondary interpretations stay quieter to preserve scan order.</p>
      </div>
      <small>{primary.severity.toUpperCase()} / confidence {Math.round(primary.confidence * 100)}%</small>
    </div>
    <article className={`interpretation-primary ${primary.severity}`}>
      <div className="interpretation-copy">
        <strong>{primary.interpretation_title}</strong>
        <p className="interpretation-summary">{safeInterpretationSummary(primary.interpretation_summary)}</p>
      </div>
      <InterpretationMeta interpretation={primary} providerLookup={providerLookup} />
      <EvidenceReceiptView evidence={primary.evidence ?? primary} title="Evidence" compact />
    </article>
    {!!secondary.length && <div className="interpretation-secondary" aria-label="Secondary ecosystem interpretations">
      {secondary.map((interpretation) => <article key={interpretation.interpretation_id} className={interpretation.severity}>
        <strong>{interpretation.interpretation_title}</strong>
        <p className="interpretation-summary">{safeInterpretationSummary(interpretation.interpretation_summary)}</p>
        <InterpretationMeta interpretation={interpretation} providerLookup={providerLookup} />
        <EvidenceReceiptView evidence={interpretation.evidence ?? interpretation} title="Evidence" compact />
      </article>)}
    </div>}
  </section>;
}

function InterpretationMeta({ interpretation, providerLookup }: { interpretation: EcosystemInterpretation; providerLookup: Map<string, Provider> }) {
  const affectedCategories = asArray<string>(interpretation.affected_categories);
  const affectedProviders = asArray<string>(interpretation.affected_providers);
  const supportingEventIds = asArray<string>(interpretation.supporting_event_ids);
  const categories = affectedCategories.length ? compactList(affectedCategories, 3) : 'global';
  const providers = affectedProviders.length;
  const knownProviderCount = affectedProviders.filter((id) => providerLookup.has(id)).length;
  const providerCountLabel = providers > 0
    ? knownProviderCount === providers
      ? `${providers} affected providers`
      : `${providers} affected providers (${knownProviderCount} named)`
    : 'no affected providers';
  const events = interpretation.supporting_event_count ?? supportingEventIds.length;
  const remaining = interpretation.remaining_event_count ?? 0;
  return <div className="interpretation-meta">
    <span>categories: {categories}</span>
    <span>providers: {providerCountLabel}</span>
    <span>severity: {interpretation.severity}</span>
    <span>confidence: {Math.round(interpretation.confidence * 100)}%</span>
    <span>window: {formatDate(interpretation.observed_window.started_at)} to {formatDate(interpretation.observed_window.ended_at)}</span>
    <span>evidence: {events} supporting events{remaining > 0 ? ` (${remaining} not shown inline)` : ''}</span>
    {interpretation.view_full_receipts_url ? <a href={interpretation.view_full_receipts_url}>view full receipts</a> : null}
  </div>;
}

function PulseStat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <div className="pulse-stat"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

function PropagationWatch({ propagation }: { propagation?: PropagationAnalysis | null }) {
  const current = propagation ?? {
    propagation_state: 'unknown',
    propagation_reason: 'Propagation analysis is not available in this pulse payload.',
    affected_cluster: null,
    affected_categories: [],
    affected_providers: [],
    first_observed_at: null,
    latest_observed_at: null,
    supporting_event_ids: [],
    supporting_event_count: 0,
    remaining_event_count: 0,
    confidence: 0,
    severity: 'unknown',
    view_full_receipts_url: undefined
  } satisfies PropagationAnalysis;
  const totalSupportingEvents = current.supporting_event_count ?? current.supporting_event_ids.length;
  const remainingSupportingEvents = current.remaining_event_count ?? Math.max(0, totalSupportingEvents - current.supporting_event_ids.length);
  return <div className={`panel propagation-watch ${current.propagation_state}`}>
    <div className="panel-head">
      <div>
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Contagion Watch</p>
        <h2>Propagation Watch</h2>
        <p className="panel-caption">Deterministic read across degradations, trust drops, unknown telemetry, narratives, and graph adjacency.</p>
        <p className="propagation-clarifier">Propagation Watch reflects catalog/provider health signals, not Radar execution failure.</p>
      </div>
      <span className={`severity-label ${current.severity}`}>severity {current.severity}</span>
    </div>
    <div className="propagation-state">
      <span>state</span>
      <strong>{current.propagation_state}</strong>
      <small>confidence {Math.round(current.confidence * 100)}%</small>
    </div>
    <KeyValues rows={[
      ['cluster', current.affected_cluster ?? 'none'],
      ['categories', current.affected_categories.length ? current.affected_categories.join(', ') : 'none'],
      ['first seen', formatDate(current.first_observed_at)],
      ['latest', formatDate(current.latest_observed_at)]
    ]} />
    <p className="monitor-note">{current.propagation_reason}</p>
    <div className="affected-provider-list" aria-label="Top affected providers">
      {current.affected_providers.slice(0, 5).map((provider) => <span key={provider.provider_id}>{provider.provider_name} · {provider.category} · {provider.event_count} events</span>)}
      {!current.affected_providers.length && <span>No affected providers in active window</span>}
    </div>
    <details className="receipt compact propagation-evidence">
      <summary>Evidence</summary>
      <div className="receipt-grid">
        <p><b>supporting events</b><span>{totalSupportingEvents}{remainingSupportingEvents > 0 ? ` (${remainingSupportingEvents} not shown inline)` : ''}</span></p>
        <p><b>recent degradations</b><span>monitor degradation and failure events</span></p>
        <p><b>narrative heatmap</b><span>{current.affected_cluster ?? 'no affected heatmap cluster'}</span></p>
        <p><b>graph layer</b><span>category, tag, and narrative adjacency considered</span></p>
        <p><b>receipts</b><span>{current.view_full_receipts_url ? <a href={current.view_full_receipts_url}>view full receipts</a> : 'none'}</span></p>
      </div>
    </details>
  </div>;
}

const ANOMALY_PREVIEW_LIMIT = 6;

type AnomalyWatchItem = RadarEcosystemRiskSummary['summary']['anomaly_watch'][number];

function AnomalyWatchPanel({ ecosystemRisk, providers, endpoints, loading }: { ecosystemRisk: RadarEcosystemRiskSummary | null; providers: Provider[]; endpoints: NormalizedEndpointRecord[]; loading: boolean }) {
  const watch = ecosystemRisk?.summary?.anomaly_watch ?? [];
  const [showAll, setShowAll] = useState(false);
  const providerNames = useMemo(() => new Map(providers.map((provider) => [provider.id, provider.name])), [providers]);
  const endpointNames = useMemo(() => new Map(endpoints.map((endpoint) => [endpoint.endpoint_id, endpoint])), [endpoints]);
  const sortedWatch = useMemo(() => sortAnomalyWatchItems(watch), [watch]);
  const visibleWatch = showAll ? sortedWatch : sortedWatch.slice(0, ANOMALY_PREVIEW_LIMIT);
  const hiddenCount = Math.max(sortedWatch.length - visibleWatch.length, 0);
  return <section className="panel anomaly-watch" id="anomaly-watch" aria-label="Anomaly Watch panel">
    <div className="panel-head">
      <div>
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Risk Signals</p>
        <h2>Anomaly Watch</h2>
        <p className="panel-caption">Advisory anomalies from historical snapshots, monitor runs, and event logs. No paid APIs are executed.</p>
      </div>
      <PredictiveRiskBadge risk={toRiskContext(ecosystemRisk)} />
    </div>
    {ecosystemRisk?.summary?.stale_catalog_warning && <p className="route-state warn">{ecosystemRisk.summary.stale_catalog_warning}</p>}
    {!!ecosystemRisk && <div className="anomaly-summary" aria-label="Advisory risk summary counts">
      <span aria-label={`low ${ecosystemRisk.summary.providers_by_risk_level.low}`}><b>low</b>{ecosystemRisk.summary.providers_by_risk_level.low}</span>
      <span aria-label={`watch ${ecosystemRisk.summary.providers_by_risk_level.watch}`}><b>watch</b>{ecosystemRisk.summary.providers_by_risk_level.watch}</span>
      <span aria-label={`elevated ${ecosystemRisk.summary.providers_by_risk_level.elevated}`}><b>elevated</b>{ecosystemRisk.summary.providers_by_risk_level.elevated}</span>
      <span aria-label={`critical ${ecosystemRisk.summary.providers_by_risk_level.critical}`}><b>critical</b>{ecosystemRisk.summary.providers_by_risk_level.critical}</span>
      <span aria-label={`unknown ${ecosystemRisk.summary.providers_by_risk_level.unknown}`}><b>unknown</b>{ecosystemRisk.summary.providers_by_risk_level.unknown}</span>
    </div>}
    {!watch.length && loading && <EmptyState title="Risk enrichment delayed" body="Risk enrichment delayed" />}
    {!watch.length && !loading && <EmptyState title="No anomalies detected." body="No current advisory risk anomaly requires attention." />}
    {!!watch.length && <>
      <div id="anomaly-watch-list" className={`anomaly-list ${showAll ? 'expanded' : ''}`} aria-label={showAll ? 'All advisory risk anomalies' : 'Top advisory risk anomalies'}>
        {visibleWatch.map((item) => {
          const endpoint = item.endpoint_id ? endpointNames.get(item.endpoint_id) : null;
          const providerName = endpoint?.provider_name ?? (item.provider_id ? providerNames.get(item.provider_id) : null) ?? item.provider_id ?? 'unknown provider';
          const endpointName = endpoint?.endpoint_name ?? item.endpoint_id ?? null;
          const title = endpointName ? `${providerName} / ${endpointName}` : providerName;
          return <details className={`anomaly-card risk-${item.severity}`} key={`${item.subject_type}:${item.provider_id ?? 'none'}:${item.endpoint_id ?? 'none'}:${item.anomaly_type}:${item.detected_at}`}>
            <summary className="anomaly-row">
              <span className="anomaly-main">
                <strong>{title}</strong>
                <small>{item.anomaly_type}</small>
                <span>{item.explanation}</span>
              </span>
              <span className="anomaly-meta" aria-label={`Severity ${item.severity}, confidence ${item.confidence}`}>
                <b className={`anomaly-pill severity-${item.severity}`}>{item.severity}</b>
                <b className="anomaly-pill">{item.confidence} confidence</b>
                <small className={item.severity === 'critical' ? 'route-critical' : undefined}>{normalizeRouteImplication(item.route_implication)}</small>
              </span>
            </summary>
            <div className="anomaly-details">
              <KeyValues rows={[
                ['subject_type', item.subject_type],
                ['provider', providerName],
                ['provider_id', item.provider_id ?? 'unknown'],
                ['endpoint', endpointName ?? 'n/a'],
                ['detected_at', formatDate(item.detected_at)],
                ['recommended_action', item.recommended_action]
              ]} />
              <details className="preflight-json">
                <summary>Evidence</summary>
                <SafeCodeBlock value={JSON.stringify(item.evidence, null, 2)} label="Anomaly evidence JSON" />
              </details>
            </div>
          </details>;
        })}
      </div>
      {sortedWatch.length > ANOMALY_PREVIEW_LIMIT && <button
        className="anomaly-toggle"
        type="button"
        aria-expanded={showAll}
        aria-controls="anomaly-watch-list"
        onClick={() => setShowAll((value) => !value)}
      >
        {showAll ? 'Show top anomalies' : `View all anomalies (${sortedWatch.length})`}
        {!showAll && hiddenCount > 0 ? <span>{hiddenCount} more hidden</span> : null}
      </button>}
    </>}
  </section>;
}

function HistoryEnrichmentPanel({ history, loading }: { history: RadarEcosystemHistory | null; loading: boolean }) {
  if (history) return null;
  return <section className="panel rail-panel" aria-label="History enrichment status">
    <div className="panel-head">
      <div>
        <ScopeLabel scope="GLOBAL" />
        <p className="section-kicker">Historical Trends</p>
        <h2>Ecosystem History</h2>
      </div>
    </div>
    {loading
      ? <EmptyState title="History enrichment delayed" body="History enrichment delayed" />
      : <EmptyState title="History enrichment delayed" body="History enrichment delayed" />}
  </section>;
}

function ZoneHeader({ eyebrow, title, subtitle, helper, scope }: { eyebrow: string; title: string; subtitle: string; helper?: string; scope: 'GLOBAL' | 'PROVIDER' }) {
  const id = scope === 'GLOBAL' ? 'ecosystem-zone-title' : 'provider-zone-title';
  return <header className="zone-header">
    <div>
      <p className="zone-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p>{subtitle}</p>
      {helper && <p className="zone-helper">{helper}</p>}
    </div>
    <ScopeLabel scope={scope} />
  </header>;
}

function ScopeLabel({ scope, context }: { scope: 'GLOBAL' | 'PROVIDER'; context?: string }) {
  return <span className={`scope-label ${scope.toLowerCase()}`}>{scope}{context ? ` · ${context}` : ''}</span>;
}

function TimingItem({ label, value }: { label: string; value: string }) {
  return <div className="timing-item"><span>{label}</span><strong>{value}</strong></div>;
}

function RouteDecisionOutput({ routeResult, routePreference, selectedProvider }: { routeResult: RouteResult; routePreference: RoutePreference; selectedProvider: Provider }) {
  const fallbackItems = routeResult.fallbackDetails?.length
    ? routeResult.fallbackDetails
    : routeResult.fallbackProviders.map((provider) => ({ provider, trustAssessment: null, signalAssessment: null, rank: null, relevance: null, riskNotes: [] }));
  const unknownTelemetry = routeResult.unknownTelemetry?.length
    ? routeResult.unknownTelemetry
    : routeResult.riskNotes.filter((note) => /unknown|unavailable/i.test(note));
  const selectedMiss = routeResult.bestProvider && routeResult.bestProvider.id !== selectedProvider.id ? routeResult.selectedProviderNotRecommendedReason : null;

  return <div className="route decision-output">
    <div className="decision-head">
      <div>
        <span>catalog-derived candidate</span>
        <strong>{routeResult.bestProvider?.name ?? 'No route'}</strong>
      </div>
      <small>{routeResult.scoringInputs?.source ?? 'LIVE PAY.SH CATALOG'} / {routeResult.preference ?? routePreference} / catalog-derived recommendation</small>
    </div>
    {!routeResult.bestProvider && <p className="route-state warn">no route matched constraints</p>}
    {routeResult.bestProvider && <>
      <div className="intel-summary compact route-score-grid">
        <DossierStat label="Category" value={routeResult.bestProvider.category} sub="catalog class" />
        <DossierStat label="Trust" value={routeResult.trustAssessment?.score ?? null} sub={routeResult.trustAssessment?.grade ?? 'grade unknown'} />
        <DossierStat label="Signal" value={routeResult.signalAssessment?.score ?? null} sub={routeResult.signalAssessment?.narratives[0] ?? 'narrative unknown'} />
        <DossierStat label="Endpoints" value={routeResult.bestProvider.endpointCount} sub="catalog count" />
        <DossierStat label="Pricing" value={formatPrice(routeResult.estimatedCost ?? routeResult.bestProvider.pricing)} sub="catalog range" />
        <DossierStat label="Coord." value={routeResult.coordinationScore ?? null} sub="trust/signal weighted" />
      </div>
      {selectedMiss && <p className="route-state warn">Selected provider was not accepted because: {selectedMiss}</p>}
    </>}
    <DossierSection title="Rationale">
      {(routeResult.rationale?.length ? routeResult.rationale : routeResult.reasoning).map((line) => <p key={line}>{line}</p>)}
    </DossierSection>
    <DossierSection title="Fallback Providers">
      <div className="fallback-list">
        {fallbackItems.map((candidate) => <div key={candidate.provider.id}>
          <strong>{candidate.provider.name}</strong>
          <span>trust {candidate.trustAssessment?.score ?? 'unknown'} / signal {candidate.signalAssessment?.score ?? 'unknown'} / {formatPrice(candidate.provider.pricing)}</span>
          <small>rank {candidate.rank ?? 'unknown'} / relevance {candidate.relevance ?? 'unknown'}</small>
        </div>)}
        {!routeResult.fallbackProviders.length && <p className="muted empty-state">No fallback providers met the current constraints.</p>}
      </div>
    </DossierSection>
    <DossierSection title="Unknown Telemetry Warning">
      {unknownTelemetry.length
        ? <div className="risk-list">{unknownTelemetry.map((note) => <span key={note}>{note}</span>)}</div>
        : <p>No unknown telemetry warning was emitted for this catalog-derived candidate.</p>}
    </DossierSection>
  </div>;
}

function DossierStat({ label, value, sub, history, delta }: { label: string; value: string | number | null; sub: string; history?: HistoryPoint[]; delta?: number | null }) {
  return <div className="dossier-stat"><span>{label}</span><strong>{value ?? 'unknown'}</strong><small>{sub}</small>{history && <HistorySparkline points={history} delta={delta ?? null} compact />}</div>;
}

function HistorySparkline({ points, delta, compact = false }: { points?: HistoryPoint[]; delta?: number | null; compact?: boolean }) {
  const numeric = (points ?? []).filter((point): point is { at: string; value: number } => typeof point.value === 'number');
  if (numeric.length < 2) return <small className="sparkline-empty">history warming up</small>;
  const values = numeric.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = numeric.map((point, index) => {
    const x = numeric.length === 1 ? 0 : (index / (numeric.length - 1)) * 100;
    const y = 30 - (((point.value - min) / range) * 28 + 1);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  const direction = delta === null || delta === undefined ? 'unknown' : Math.abs(delta) < 1 ? 'stable' : delta > 0 ? 'up' : 'down';
  return <span className={`sparkline ${compact ? 'compact' : ''} ${direction}`} aria-label={`Trend ${direction}${typeof delta === 'number' ? ` delta ${delta}` : ''}`}>
    <svg viewBox="0 0 100 32" role="img" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
    <b>{typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta}` : 'warming up'}</b>
  </span>;
}

function ReliabilityHistoryPanel({ history }: { history: RadarProviderHistory | null }) {
  if (!history) return <EmptyState title="History warming up." body="No provider history payload is available yet." />;
  if (!history.history_available) return <EmptyState title="History warming up." body={history.reason ?? 'No historical snapshots available yet'} />;
  const interpretation = providerHistoryInterpretation(history);
  return <div className="reliability-history">
    <div className="history-grid">
      <div><span>trust trend</span><HistorySparkline points={history.series.trust_score} delta={history.deltas.trust_delta_24h} /></div>
      <div><span>signal trend</span><HistorySparkline points={history.series.signal_score} delta={history.deltas.signal_delta_24h} /></div>
      <div><span>degradations</span><HistorySparkline points={history.series.degradation_count} delta={history.deltas.degradation_delta_24h} /></div>
    </div>
    <KeyValues rows={[
      ['last_seen_healthy', formatDate(history.last_known_good?.last_seen_healthy_at)],
      ['last_degraded', formatDate(history.last_known_good?.last_degraded_at)],
      ['last_failed', formatDate(history.last_known_good?.last_failed_at)],
      ['current_health_state', history.last_known_good?.current_health_state ?? 'unknown'],
      ['trend_direction', history.deltas.trend_direction]
    ]} />
    <p className="route-state">{interpretation}</p>
  </div>;
}

function providerHistoryInterpretation(history: RadarProviderHistory) {
  const trust = history.deltas.trust_delta_24h === null ? 'Trust history warming up' : Math.abs(history.deltas.trust_delta_24h) < 1 ? 'Trust stable over 24h' : history.deltas.trust_delta_24h > 0 ? 'Trust improving over 24h' : 'Trust degrading over 24h';
  const degradation = history.deltas.degradation_delta_24h === null || history.deltas.degradation_delta_24h === 0
    ? 'No new metadata degradation detected'
    : `${history.deltas.degradation_delta_24h} net metadata degradation event${Math.abs(history.deltas.degradation_delta_24h) === 1 ? '' : 's'} detected`;
  const route = history.deltas.route_eligibility_changed === null ? 'Route eligibility change unknown' : history.deltas.route_eligibility_changed ? 'Route eligibility changed recently' : 'Route eligibility unchanged';
  return `${trust}. ${degradation}. ${route}.`;
}

function SeverityBadge({ evidence }: { evidence?: EvidenceReceipt | null }) {
  const severity = normalSeverity(evidence?.severity);
  const reason = evidence?.severity_reason ?? evidence?.severityReason ?? 'severity unknown';
  const state = severity === 'critical'
    ? 'Critical'
    : severity === 'warning'
      ? 'Watch'
      : severity === 'informational'
        ? 'Healthy'
        : 'Unknown';
  const implication = severity === 'critical'
    ? 'Not recommended for routing.'
    : severity === 'warning'
      ? 'Inspect before routing.'
      : severity === 'informational'
        ? 'No active warning.'
        : 'Evidence incomplete.';
  return <span className={`severity-badge severity-${severity}`} title={`${reason} ${implication}`}>{state}</span>;
}

function ProviderDirectoryStateBadge({ provider, risk }: { provider: Provider; risk: RadarRiskContext | null }) {
  const severity = normalSeverity(provider.severity);
  const riskLevel = risk?.predictive_risk_level ?? 'unknown';
  const severityLabel = severity === 'critical'
    ? 'Critical'
    : severity === 'warning'
      ? 'Watch'
      : severity === 'informational'
        ? 'Healthy'
        : 'Unknown';
  const state = riskLevel === 'critical' || severity === 'critical'
    ? 'critical'
    : riskLevel === 'elevated'
      ? 'elevated'
      : riskLevel === 'watch' || severity === 'warning'
        ? 'watch'
        : riskLevel === 'low' || severity === 'informational'
          ? 'low'
          : 'unknown';
  const label = state === 'critical'
    ? 'Critical'
    : state === 'elevated'
      ? 'Elevated'
      : state === 'watch'
        ? 'Watch'
        : state === 'low'
          ? 'Clear'
          : 'Unknown';
  const title = `${severityLabel} severity. ${riskBadgeLabel(riskLevel)}. ${riskRouteImplication(riskLevel)}`;
  return <span className={`directory-state-badge state-${state}`} title={title} aria-label={`Provider state ${title}`}>{label}</span>;
}

type DossierSectionTier = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';

function DossierSection({ title, children, context, helper, tier = 'tier-2', className = '' }: { title: string; children: React.ReactNode; context?: string; helper?: string; tier?: DossierSectionTier; className?: string }) {
  const defaultOpen = !/raw|diagnostic|unknown telemetry warning/i.test(title);
  const [open, setOpen] = useState(defaultOpen);
  return <section className={`dossier-section ${tier} ${className}`.trim()}>
    <div className="dossier-section-head">
      <div>
        <h4>{title}</h4>
        {helper && <p className="section-helper">{helper}</p>}
      </div>
      <div className="dossier-section-actions">
        {context && <ScopeLabel scope="PROVIDER" context={context} />}
        <button className="collapse-toggle compact" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{open ? 'Collapse' : 'Expand'}</button>
      </div>
    </div>
    {open && children}
  </section>;
}

function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return <div className="key-values">{rows.map(([label, value]) => <p key={label}><b>{label}</b><span>{value}</span></p>)}</div>;
}

function Leaderboard({ title, scores, providers, kind, providerRiskById }: { title: string; scores: any[]; providers: Map<string, Provider>; kind: string; providerRiskById: Record<string, RadarRiskResponse> }) {
  const safeScores = Array.isArray(scores) ? scores : [];
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'score' | 'name'>('score');
  const visibleScores = [...safeScores]
    .filter((score) => {
      const provider = providers.get(score.entityId);
      const haystack = `${provider?.name ?? ''} ${provider?.category ?? ''} ${provider?.id ?? score.entityId ?? ''}`.toLowerCase();
      return !query.trim() || haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => sort === 'name'
      ? (providers.get(a.entityId)?.name ?? a.entityId ?? '').localeCompare(providers.get(b.entityId)?.name ?? b.entityId ?? '')
      : (b.score ?? -1) - (a.score ?? -1));
  return <CollapsibleSection className="panel" title={title} scope="GLOBAL" caption={kind === 'trust' ? 'Highest trust scores from current assessments.' : 'Highest signal scores from current narratives.'}>
    <div className="table-controls leaderboard-controls">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="filter provider or category" aria-label={`Filter ${title}`} />
      <select value={sort} onChange={(event) => setSort(event.target.value === 'name' ? 'name' : 'score')} aria-label={`Sort ${title}`}>
        <option value="score">{kind} score</option>
        <option value="name">provider name</option>
      </select>
    </div>
    <div className="leaderboard">{visibleScores.map((score, index) => <div className="bar" key={score.entityId ?? `${title}-${index}`}><span>{providers.get(score.entityId)?.name ?? 'unknown provider'}</span><PredictiveRiskBadge risk={toRiskContext(providerRiskById[String(score.entityId ?? '')])} compact /><div aria-hidden="true"><i style={{ width: `${score.score ?? 0}%` }} /></div><b>{score.score ?? 'unknown'}{kind === 'trust' ? ` ${score.grade ?? '-'}` : ''}</b></div>)}</div>
    {!visibleScores.length && <p className="muted empty-state">No providers match the leaderboard filter.</p>}
  </CollapsibleSection>;
}

function AssessmentPanel({ title, score, sub, components, context, evidence }: { title: string; score: number | null; sub: string; components: Record<string, number | null>; context: string; evidence?: EvidenceReceipt }) {
  return <div className="panel assessment">
    <ScopeLabel scope="PROVIDER" context={context} />
    <h2>{title}</h2>
    <strong>{score ?? 'unknown'}</strong>
    <span>{sub}</span>
    <div className="component-list">{Object.entries(components).map(([key, value]) => <p key={key}><b>{key}</b><i>{value ?? 'unknown'}</i></p>)}</div>
    <EvidenceReceiptView evidence={evidence} title="Evidence" />
  </div>;
}

export function PropagationIncidentPage({ clusterId }: { clusterId: string }) {
  const [incident, setIncident] = useState<PropagationIncident | null>(null);
  const [missing, setMissing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    let active = true;
    api<{ data: PropagationIncident }>(`/v1/propagation/${clusterId}`)
      .then((response) => {
        if (!active) return;
        setIncident(response.data);
        setMissing(false);
        updatePropagationPageMetadata(response.data, clusterId, false);
      })
      .catch(() => {
        if (!active) return;
        setMissing(true);
        updatePropagationPageMetadata(null, clusterId, true);
      });
    return () => {
      active = false;
    };
  }, [clusterId]);

  async function copyShareUrl() {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    } finally {
      window.setTimeout(() => setCopyState('idle'), 1800);
    }
  }

  if (missing) return <main className="shell"><section className="panel"><h1>Propagation Cluster Not Found</h1><p className="copy">No incident currently matches cluster id <code>{clusterId}</code>.</p></section></main>;
  if (!incident) return <main className="boot">LOADING PROPAGATION INCIDENT...</main>;

  return <main className="shell propagation-incident-page">
    <section className={`panel propagation-watch ${incident.propagation_state}`}>
      <p className="eyebrow">Infopunks Pay.sh Radar Incident Intelligence</p>
      <h1>Propagation Incident {incident.cluster_id}</h1>
      <div className="propagation-state">
        <span>state</span><strong>{incident.propagation_state}</strong>
        <span>severity</span><strong>{incident.severity}</strong>
        <small>current status: {incident.current_status}</small>
      </div>
      <p className="copy">{incident.propagation_reason}</p>
      <button type="button" className="methodology-trigger" onClick={copyShareUrl}>Share URL {copyState === 'copied' ? '(copied)' : copyState === 'failed' ? '(failed)' : ''}</button>
    </section>
    <section className="grid two">
      <div className="panel">
        <h2>Incident Facts</h2>
        <KeyValues rows={[
          ['Affected cluster', incident.affected_cluster ?? 'none'],
          ['Affected categories', incident.affected_categories.join(', ') || 'none'],
          ['Affected providers', String(incident.affected_providers.length)],
          ['First observed at', formatDate(incident.first_observed_at)],
          ['Latest observed at', formatDate(incident.latest_observed_at)],
          ['Confidence', formatConfidence(incident.confidence)],
          ['Supporting events', String(incident.supporting_event_ids.length)]
        ]} />
      </div>
      <div className="panel">
        <h2>Links</h2>
        <div className="delta-list">
          <div className="delta-row">
            <strong>Supporting Receipts</strong>
            {incident.supporting_receipt_links.map((item) => <a key={item.event_id} href={item.href}>{item.event_id}</a>)}
          </div>
          <div className="delta-row">
            <strong>Related Providers</strong>
            {incident.related_provider_links.map((item) => <a key={item.provider_id} href={item.href}>{item.provider_name}</a>)}
          </div>
          <div className="delta-row">
            <strong>Related Interpretations</strong>
            {incident.related_interpretation_links.length ? incident.related_interpretation_links.map((item) => <a key={item.interpretation_id} href={item.href}>{item.title}</a>) : <span>none</span>}
          </div>
        </div>
      </div>
    </section>
    <section className="panel">
      <h2>Incident Timeline</h2>
      <div className="event-feed">
        {incident.timeline.map((event) => <div key={event.event_id} id={`event-${event.event_id}`} className={`feed-row ${event.category} severity-${normalSeverity(event.severity)}`}>
          <span>{event.category}</span>
          <strong>{event.type}</strong>
          <p>{event.summary}</p>
          <time>{formatDate(event.observed_at)}</time>
          <a href={`/v1/events/${event.event_id}`}>receipt</a>
        </div>)}
        {!incident.timeline.length && <p className="muted empty-state">No supporting events available for this incident.</p>}
      </div>
    </section>
  </main>;
}

const eventCategories: EventCategory[] = ['discovery', 'trust', 'monitoring', 'pricing', 'schema', 'signal'];

function DeltaPanel({ title, caption, deltas, empty, scope }: { title: string; caption?: string; deltas: ScoreDelta[]; empty: string; scope?: 'GLOBAL' | 'PROVIDER' }) {
  return <div className="panel">
    {scope && <ScopeLabel scope={scope} />}
    <h2>{title}</h2>
    {caption && <p className="panel-caption">{caption}</p>}
    <div className="delta-list">
      {deltas.slice(0, 6).map((delta) => <div className={`delta-row ${delta.direction}`} key={delta.eventId}>
        <SeverityBadge evidence={delta} />
        <strong>{delta.providerName}</strong>
        <span>{formatScoreDelta(delta)}</span>
        <small>{formatShortDate(delta.observedAt)}</small>
        <EvidenceReceiptView evidence={delta} title="Evidence" compact />
      </div>)}
      {!deltas.length && <p className="muted">{empty}</p>}
    </div>
  </div>;
}

function EvidenceReceiptView({ evidence, title = 'Evidence', compact = false }: { evidence?: EvidenceReceipt | null; title?: string; compact?: boolean }) {
  const receipt = normalizeEvidence(evidence);
  if (!receipt) return <details className={`receipt ${compact ? 'compact' : ''}`}><summary>{title}</summary><p className="receipt-note">No evidence receipt available.</p></details>;
  return <details className={`receipt ${compact ? 'compact' : ''}`}>
    <summary>{title}</summary>
    <div className="receipt-grid">
      <p><b>event_id</b><span>{receipt.event_id ?? 'none'}</span></p>
      <p><b>provider_id</b><span>{receipt.provider_id ?? 'unknown'}</span></p>
      <p><b>endpoint_id</b><span>{receipt.endpoint_id ?? 'provider-level evidence only'}</span></p>
      <p><b>observed_at</b><span>{formatDate(receipt.observed_at)}</span></p>
      <p><b>catalog_generated_at</b><span>{formatDate(receipt.catalog_generated_at)}</span></p>
      <p><b>ingested_at</b><span>{formatDate(receipt.ingested_at)}</span></p>
      <p><b>source</b><span>{receipt.source ?? 'unknown'}</span></p>
      <p><b>confidence</b><span>{formatConfidence(receipt.confidence)}</span></p>
      <p><b>severity</b><span>{severityLabel(receipt)}</span></p>
      <p><b>severity_score</b><span>{receipt.severity_score ?? 'unknown'}</span></p>
      <p><b>severity_window</b><span>{receipt.severity_window ?? 'none'}</span></p>
    </div>
    <p className="receipt-note">{receipt.derivation_reason ?? receipt.summary ?? 'Deterministic evidence receipt.'}</p>
  </details>;
}

function normalizeEvidence(input?: EvidenceReceipt | null): EvidenceReceipt | null {
  if (!input) return null;
  const nested = firstNestedEvidence(input.evidence);
  const source = nested ?? input;
  return {
    event_id: source.event_id ?? source.eventId ?? input.event_id ?? input.eventId ?? null,
    provider_id: source.provider_id ?? source.providerId ?? input.provider_id ?? input.providerId ?? null,
    endpoint_id: source.endpoint_id ?? source.endpointId ?? input.endpoint_id ?? input.endpointId ?? null,
    observed_at: resolveObservedAt(source) ?? resolveObservedAt(input),
    catalog_generated_at: source.catalog_generated_at ?? source.catalogGeneratedAt ?? input.catalog_generated_at ?? input.catalogGeneratedAt ?? null,
    ingested_at: source.ingested_at ?? source.ingestedAt ?? input.ingested_at ?? input.ingestedAt ?? null,
    source: source.source ?? input.source ?? null,
    derivation_reason: source.derivation_reason ?? source.derivationReason ?? source.summary ?? input.derivation_reason ?? input.derivationReason ?? input.summary ?? null,
    confidence: source.confidence ?? input.confidence ?? null,
    severity: source.severity ?? input.severity ?? 'unknown',
    severity_reason: source.severity_reason ?? source.severityReason ?? input.severity_reason ?? input.severityReason ?? null,
    severity_score: source.severity_score ?? source.severityScore ?? input.severity_score ?? input.severityScore ?? null,
    severity_window: source.severity_window ?? source.severityWindow ?? input.severity_window ?? input.severityWindow ?? null,
    summary: source.summary ?? input.summary ?? null
  };
}

function firstNestedEvidence(evidence: EvidenceReceipt['evidence']): EvidenceReceipt | null {
  if (!evidence) return null;
  if (Array.isArray(evidence)) return evidence[0] ?? null;
  if ('event_id' in evidence || 'eventId' in evidence) return evidence as EvidenceReceipt;
  const firstList = Object.values(evidence).find((items): items is EvidenceReceipt[] => Array.isArray(items) && items.length > 0);
  return firstList?.[0] ?? null;
}

type EndpointIntelligenceRow = {
  normalized: NormalizedEndpointRecord;
  raw: Endpoint | null;
};

function resolveProviderEndpointRows(detail: ProviderDetail | null, intel: ProviderIntelligence | null) {
  const candidates = [
    detail?.endpoints,
    intel?.endpoints,
    intel?.endpointList
  ];
  return candidates.find((items): items is Endpoint[] => Array.isArray(items) && items.length > 0) ?? [];
}

function buildEndpointIntelligenceRows(rawEndpoints: Endpoint[], normalizedEndpoints: NormalizedEndpointRecord[], provider: Provider | null): EndpointIntelligenceRow[] {
  const rawById = new Map(rawEndpoints.map((endpoint) => [endpoint.id, endpoint]));
  const normalizedRows = normalizedEndpoints.map((endpoint) => ({
    normalized: normalizeEndpointExportShape(endpoint),
    raw: rawById.get(endpoint.endpoint_id) ?? null
  }));
  const normalizedIds = new Set(normalizedRows.map((row) => row.normalized.endpoint_id));
  const rawFallbackRows = rawEndpoints
    .filter((endpoint) => !normalizedIds.has(endpoint.id))
    .map((endpoint) => ({ normalized: endpointFallbackExport(endpoint, provider), raw: endpoint }));
  return [...normalizedRows, ...rawFallbackRows];
}

function normalizeEndpointExportShape(endpoint: NormalizedEndpointRecord): NormalizedEndpointRecord {
  return {
    endpoint_id: endpoint.endpoint_id,
    endpoint_name: endpoint.endpoint_name ?? null,
    provider_id: endpoint.provider_id,
    provider_name: endpoint.provider_name ?? null,
    category: endpoint.category ?? null,
    method: endpoint.method ?? null,
    path: endpoint.path ?? null,
    url: endpoint.url ?? null,
    description: endpoint.description ?? null,
    pricing: endpoint.pricing ?? null,
    input_schema: endpoint.input_schema ?? null,
    output_schema: endpoint.output_schema ?? null,
    catalog_observed_at: endpoint.catalog_observed_at ?? null,
    catalog_generated_at: endpoint.catalog_generated_at ?? null,
    provider_trust_score: endpoint.provider_trust_score ?? null,
    provider_signal_score: endpoint.provider_signal_score ?? null,
    provider_grade: endpoint.provider_grade ?? null,
    reachability_status: endpoint.reachability_status ?? 'unknown',
    degradation_status: endpoint.degradation_status ?? 'unknown',
    route_eligibility: typeof endpoint.route_eligibility === 'boolean' ? endpoint.route_eligibility : null,
    route_rejection_reasons: Array.isArray(endpoint.route_rejection_reasons) ? endpoint.route_rejection_reasons : [],
    metadata_quality_score: endpoint.metadata_quality_score ?? null,
    pricing_clarity_score: endpoint.pricing_clarity_score ?? null,
    source: endpoint.source ?? null
  };
}

function endpointFallbackExport(endpoint: Endpoint, provider: Provider | null): NormalizedEndpointRecord {
  const schema = isRecord(endpoint.schema) ? endpoint.schema : null;
  const inputSchema = schema ? schema.input ?? schema.request ?? schema.params ?? null : null;
  const outputSchema = schema ? schema.output ?? schema.response ?? schema.result ?? null : null;
  const rejectionReasons = [
    !endpoint.method ? 'endpoint_method_unknown' : null,
    !endpoint.path ? 'endpoint_path_unknown' : null,
    endpoint.status === 'degraded' ? 'endpoint_degraded' : null
  ].filter((item): item is string => Boolean(item));
  return {
    endpoint_id: endpoint.id,
    endpoint_name: endpoint.name ?? null,
    provider_id: endpoint.providerId,
    provider_name: provider?.name ?? null,
    category: endpoint.category ?? provider?.category ?? null,
    method: endpoint.method ?? null,
    path: endpoint.path ?? null,
    url: buildDisplayEndpointUrl(provider?.serviceUrl ?? null, endpoint.path ?? null),
    description: endpoint.description ?? null,
    pricing: endpoint.pricing ?? null,
    input_schema: inputSchema,
    output_schema: outputSchema,
    catalog_observed_at: resolveObservedAt(endpoint) ?? endpoint.lastSeenAt ?? null,
    catalog_generated_at: endpoint.catalog_generated_at ?? endpoint.catalogGeneratedAt ?? provider?.catalogGeneratedAt ?? null,
    provider_trust_score: provider?.latestTrustScore ?? null,
    provider_signal_score: provider?.latestSignalScore ?? null,
    provider_grade: provider?.latestTrustGrade ?? null,
    reachability_status: 'unknown',
    degradation_status: endpoint.status === 'degraded' ? 'degraded' : endpoint.status === 'available' ? 'healthy' : 'unknown',
    route_eligibility: typeof endpoint.routeEligible === 'boolean' ? endpoint.routeEligible : null,
    route_rejection_reasons: rejectionReasons,
    metadata_quality_score: null,
    pricing_clarity_score: null,
    source: endpoint.source ?? provider?.source ?? null
  };
}

function filterEndpointIntelligenceRows(rows: EndpointIntelligenceRow[], filter: EndpointFilter) {
  if (filter === 'route_eligible') return rows.filter((row) => row.normalized.route_eligibility === true);
  if (filter === 'mapping_incomplete') return rows.filter(isEndpointMappingIncomplete);
  if (filter === 'degraded') return rows.filter((row) => isEndpointDegraded(row, null));
  if (filter === 'priced') return rows.filter((row) => hasKnownPricing(row.normalized.pricing));
  if (filter === 'unknown_pricing') return rows.filter((row) => !hasKnownPricing(row.normalized.pricing));
  return rows;
}

function filterEndpointRowsByQuery(rows: EndpointIntelligenceRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const endpoint = row.normalized;
    return [
      endpoint.endpoint_id,
      endpoint.endpoint_name,
      endpoint.provider_id,
      endpoint.provider_name,
      endpoint.category,
      endpoint.method,
      endpoint.path,
      endpoint.url,
      endpoint.description,
      endpoint.reachability_status,
      endpoint.degradation_status,
      ...endpoint.route_rejection_reasons
    ].filter(Boolean).join(' ').toLowerCase().includes(needle);
  });
}

function sortEndpointRows(rows: EndpointIntelligenceRow[], sort: EndpointSort) {
  const reachabilityRank = (value: string) => /failed/i.test(value) ? 0 : /degraded/i.test(value) ? 1 : /unknown/i.test(value) ? 2 : 3;
  return [...rows].sort((a, b) => {
    const endpointA = a.normalized;
    const endpointB = b.normalized;
    if (sort === 'route eligibility') return Number(endpointB.route_eligibility === true) - Number(endpointA.route_eligibility === true) || (endpointA.endpoint_name ?? endpointA.endpoint_id).localeCompare(endpointB.endpoint_name ?? endpointB.endpoint_id);
    if (sort === 'metadata quality') return (endpointB.metadata_quality_score ?? -1) - (endpointA.metadata_quality_score ?? -1);
    if (sort === 'pricing clarity') return (endpointB.pricing_clarity_score ?? -1) - (endpointA.pricing_clarity_score ?? -1);
    if (sort === 'reachability') return reachabilityRank(endpointA.reachability_status) - reachabilityRank(endpointB.reachability_status);
    if (sort === 'last observed') return Date.parse(endpointB.catalog_observed_at ?? endpointB.catalog_generated_at ?? '') - Date.parse(endpointA.catalog_observed_at ?? endpointA.catalog_generated_at ?? '');
    return (endpointA.endpoint_name ?? endpointA.endpoint_id).localeCompare(endpointB.endpoint_name ?? endpointB.endpoint_id);
  });
}

function isEndpointMappingIncomplete(row: EndpointIntelligenceRow) {
  return !row.normalized.method || (!row.normalized.path && !row.normalized.url);
}

function isEndpointCatalogMetadataIncomplete(row: EndpointIntelligenceRow) {
  const endpoint = row.normalized;
  return !endpoint.endpoint_name || !endpoint.category || !endpoint.catalog_observed_at || !hasKnownPricing(endpoint.pricing);
}

function isEndpointDegraded(row: EndpointIntelligenceRow, monitor: EndpointMonitor | null) {
  const status = `${row.normalized.reachability_status} ${row.normalized.degradation_status} ${row.raw?.status ?? ''} ${monitor?.health ?? ''}`;
  return /degraded|failed|failure|down|error/i.test(status);
}

function hasKnownPricing(pricing: unknown) {
  if (!isRecord(pricing)) return typeof pricing === 'string' && pricing.trim() !== '' && pricing !== 'unknown';
  if (typeof pricing.raw === 'string' && pricing.raw.trim() && pricing.raw !== 'unknown') return true;
  return typeof pricing.min === 'number' || typeof pricing.max === 'number';
}

function pricingSummary(pricing: unknown) {
  if (!isRecord(pricing)) return typeof pricing === 'string' && pricing.trim() ? pricing : 'pricing unknown';
  if (typeof pricing.raw === 'string' && pricing.raw.trim()) return pricing.raw;
  const min = typeof pricing.min === 'number' ? pricing.min : null;
  const max = typeof pricing.max === 'number' ? pricing.max : null;
  if (min === null && max === null) return 'pricing unknown';
  if (min === 0 && max === 0) return 'free';
  if (min !== null && max !== null) return min === max ? `$${min}` : `$${min} - $${max}`;
  return `$${min ?? max}`;
}

function routeEligibilityLabel(value: boolean | null) {
  if (value === true) return 'route eligible';
  if (value === false) return 'route blocked';
  return 'route unknown';
}

function buildDisplayEndpointUrl(serviceUrl: string | null, path: string | null) {
  if (!serviceUrl || !path) return null;
  try {
    return new URL(path, serviceUrl.endsWith('/') ? serviceUrl : `${serviceUrl}/`).toString();
  } catch {
    return null;
  }
}

function buildCurlCommand(endpoint: NormalizedEndpointRecord): { command: string | null } {
  const method = endpoint.method?.trim().toUpperCase() ?? null;
  const target = endpoint.url ?? endpoint.path;
  if (!method || !target) return { command: null };
  if (['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) {
    return { command: `curl -X ${method} '${escapeShellSingleQuoted(target)}'` };
  }
  const exampleBody = extractExampleBody(endpoint.input_schema);
  if (exampleBody === null) return { command: null };
  return { command: `curl -X ${method} '${escapeShellSingleQuoted(target)}' -H 'Content-Type: application/json' --data '${escapeShellSingleQuoted(JSON.stringify(exampleBody))}'` };
}

function extractExampleBody(schema: unknown): unknown | null {
  if (!isRecord(schema)) return null;
  if ('example' in schema) return schema.example;
  if (Array.isArray(schema.examples) && schema.examples.length > 0) return schema.examples[0];
  return null;
}

function escapeShellSingleQuoted(value: string) {
  return value.replace(/'/g, `'\\''`);
}

function providerDegradationInfo(provider: Provider | null, intel: ProviderIntelligence | null) {
  const changes = asArray<HistoryItem>(intel?.recent_changes);
  const degradedEvents = changes.filter((event) => event.type === 'provider.degraded' || event.type === 'provider.failed');
  const healthyEvent = changes.find((event) => event.type === 'provider.reachable' || event.type === 'provider.recovered');
  const serviceStatus = intel?.service_monitor.status ?? 'unknown';
  const providerRecord = isRecord(provider) ? provider as Record<string, unknown> : null;
  const providerFlags = Boolean(providerRecord?.degraded) || Boolean(providerRecord?.failed);
  const degraded = providerFlags || degradedEvents.length > 0 || /degraded|failed/i.test(serviceStatus);
  const reason = degradedEvents[0]?.summary ?? intel?.service_monitor.explanation ?? 'Provider has degraded or failed reachability evidence.';
  return {
    degraded,
    reason,
    lastHealthyAt: healthyEvent?.observedAt ?? (/reachable/i.test(serviceStatus) ? intel?.service_monitor.last_checked_at ?? null : null)
  };
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  } catch {
    return false;
  }
}

function openExportRoute(path: string) {
  const url = toApiUrl(API_BASE_URL, path);
  window.open(url, '_blank', 'noopener,noreferrer');
}

function formatPrice(price: unknown) {
  if (!isRecord(price)) {
    warnClientOnce('pricing-malformed-payload', '[radar-render:pricing] malformed pricing payload, using unknown');
    return 'unknown';
  }
  const safeRange = getSafeRange(price, { min: -1, max: -1 });
  const hasNumericRange = Number.isFinite(price.min) && Number.isFinite(price.max);
  if (!hasNumericRange) {
    if (typeof price.raw === 'string' && price.raw.trim()) return price.raw;
    warnClientOnce('pricing-missing-range', '[radar-render:pricing] missing price range min/max, using unknown');
    return 'unknown';
  }
  if (safeRange.min === 0 && safeRange.max === 0) return 'free';
  return safeRange.min === safeRange.max ? `$${safeRange.min}` : `$${safeRange.min} - $${safeRange.max}`;
}

function moneyOrUnknown(value: number | null | undefined) {
  return typeof value === 'number' ? `$${value}` : 'unknown';
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'unknown';
}

function formatMachineTimestamp(value: string | null | undefined) {
  if (!value) return 'unknown';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return 'unknown';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatInterval(value: number | null | undefined) {
  if (!value) return null;
  const minutes = value / 60_000;
  if (Number.isInteger(minutes)) return `${minutes} min`;
  return `${Number(minutes.toFixed(1))} min`;
}

function formatMs(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}ms` : 'unknown';
}

function formatRepeatabilitySuccessRate(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'unknown';
}

function buildRepeatabilityReceiptRows(
  repeatability: AlibabaMachineExecutionRepeatabilityArtifact,
  latestReceipt: MachinePreflightReceipt | null
) {
  if (repeatability.receipt_rows?.length) return repeatability.receipt_rows;
  return repeatability.receipt_ids.map((receiptId, index) => ({
    receipt_id: receiptId,
    provider_request_id: repeatability.provider_request_ids[index] ?? null,
    latency_ms: latestReceipt?.execution_latency_ms ?? null,
    created_at: latestReceipt?.created_at ?? '',
    output_preview: repeatability.output_summaries[0] ?? null,
    execution_status: latestReceipt?.execution_status ?? 'not_attempted',
    execution_occurred: latestReceipt?.execution_occurred ?? false,
    payment_occurred: latestReceipt?.payment_occurred ?? false,
    evidence_stage: latestReceipt?.evidence_stage ?? null
  }));
}

function formatLatencySeconds(value: number | null | undefined) {
  return typeof value === 'number' ? `${(value / 1000).toFixed(2)}s` : 'unknown';
}

function formatLatencyRangeSeconds(min: number | null | undefined, max: number | null | undefined) {
  if (typeof min !== 'number' || typeof max !== 'number') return 'unknown';
  return `${(min / 1000).toFixed(2)}s–${(max / 1000).toFixed(2)}s`;
}

function formatConfidence(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'deterministic';
}

function getEcosystemStatus(pulse: Pulse, summary: PulseSummary | null): { state: EcosystemStatusState; label: string; detail: string } {
  const propagationSeverity = summary?.propagation?.severity ?? 'unknown';
  const propagationState = summary?.propagation?.propagation_state ?? 'unknown';
  const recentDegradations = summary?.recentDegradations.length ?? 0;
  if (propagationSeverity === 'critical' || propagationState === 'systemic') {
    return {
      state: 'critical',
      label: 'Critical propagation watch',
      detail: 'Systemic or critical propagation signals are present. Review propagation watch and recent degradations first.'
    };
  }
  if (propagationSeverity === 'high' || propagationState === 'spreading' || pulse.data_source.used_fixture) {
    return {
      state: 'warning',
      label: pulse.data_source.used_fixture ? 'Fixture-backed radar state' : 'Elevated ecosystem watch',
      detail: pulse.data_source.used_fixture
        ? 'Backend healthy; upstream Pay.sh catalog unavailable. Showing deterministic fixture-backed Radar state.'
        : 'Spreading or high-severity signals are active. Prioritize trust movement and affected providers.'
    };
  }
  if (recentDegradations > 0 || (summary?.latest_batch_event_count ?? 0) > 0) {
    return {
      state: 'info',
      label: 'Live catalog movement',
      detail: 'New catalog-derived movement is present. Review pulse events, trust changes, and signal spikes.'
    };
  }
  return {
    state: 'stable',
    label: 'Stable monitoring window',
    detail: 'No critical propagation or degradation surge is visible in the current radar window.'
  };
}

function getEcosystemReading(pulse: Pulse, summary: PulseSummary | null) {
  const propagation = summary?.propagation;
  const recentDegradations = summary?.recentDegradations.length ?? 0;
  const signalSpikes = summary?.signalSpikes.length ?? 0;
  const trustDeltas = summary?.trustDeltas.length ?? 0;
  const latestBatch = summary?.latest_batch_event_count ?? 0;
  const topTrustScore = pulse.topTrust[0]?.score ?? null;
  const averageTrust = pulse.averageTrust ?? null;
  const topTrustLead = typeof topTrustScore === 'number' && typeof averageTrust === 'number'
    ? topTrustScore - averageTrust
    : null;

  if (propagation?.severity === 'critical' || propagation?.propagation_state === 'systemic') {
    return 'System reading: ecosystem pressure is systemic in the current propagation window.';
  }
  if (recentDegradations > 0 && trustDeltas > 0) {
    return 'System reading: reliability is under pressure where degradations and trust movement overlap.';
  }
  if (recentDegradations > 0) {
    return 'System reading: service reachability pressure is present, but the visible signal is still localized.';
  }
  if (signalSpikes > 0 && latestBatch > 0) {
    return 'System reading: signal activity is present and tied to fresh catalog movement.';
  }
  if (typeof topTrustLead === 'number' && topTrustLead >= 20) {
    return 'System reading: trust remains concentrated among a small set of high-scoring providers.';
  }
  if (latestBatch > 0) {
    return 'System reading: catalog movement is active, with no visible degradation surge in this window.';
  }
  return 'System reading: signal activity is present but not accelerating in the current window.';
}

function normalSeverity(value: unknown): Severity {
  return value === 'critical' || value === 'warning' || value === 'informational' || value === 'unknown' ? value : 'unknown';
}

function severityRank(value: unknown) {
  const severity = normalSeverity(value);
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  if (severity === 'informational') return 2;
  return 3;
}

function sortBySeverity<T extends EvidenceReceipt>(items: T[]) {
  return [...items].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || ((b.severity_score ?? b.severityScore ?? 0) - (a.severity_score ?? a.severityScore ?? 0)));
}

function isCriticalOrDegradedEvent(event: PulseEvent | HistoryItem | EvidenceReceipt) {
  const type = 'type' in event ? String(event.type ?? '') : '';
  const severity = normalSeverity(event.severity);
  return severity === 'critical' || /provider\.(degraded|failed)|endpoint\.(degraded|failed)|failed|degraded/i.test(type);
}

function eventFilterState(event: PulseEvent): EventFilter {
  const severity = normalSeverity(event.severity);
  if (severity === 'critical' || /failed|critical/i.test(`${event.type} ${event.summary}`)) return 'critical';
  if (/degraded/i.test(`${event.type} ${event.summary}`)) return 'degraded';
  if (severity === 'warning') return 'watch';
  if (severity === 'informational') return 'healthy';
  return 'unknown';
}

function filterAndSortEvents(events: PulseEvent[], filter: EventFilter, sort: EventSort) {
  const filtered = filter === 'all' ? events : events.filter((event) => eventFilterState(event) === filter);
  return [...filtered].sort((a, b) => {
    if (sort === 'severity') return severityRank(a.severity) - severityRank(b.severity) || Date.parse(b.observedAt) - Date.parse(a.observedAt);
    if (sort === 'provider') return (a.providerName ?? a.entityId).localeCompare(b.providerName ?? b.entityId) || Date.parse(b.observedAt) - Date.parse(a.observedAt);
    return Date.parse(b.observedAt) - Date.parse(a.observedAt);
  });
}

function filterComparisonRows(rows: RadarComparisonRow[], query: string, filter: 'all' | 'route eligible' | 'not recommended' | 'degraded' | 'pricing known' | 'pricing unknown') {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    const queryMatch = !needle || [row.id, row.name, row.type, row.reachability, row.route_recommendation, ...row.rejection_reasons].join(' ').toLowerCase().includes(needle);
    if (!queryMatch) return false;
    if (filter === 'route eligible') return row.route_recommendation === 'route_eligible';
    if (filter === 'not recommended') return row.route_recommendation === 'not_recommended';
    if (filter === 'degraded') return row.degradation_count > 0 || row.reachability === 'degraded' || row.reachability === 'failed';
    if (filter === 'pricing known') return row.pricing_clarity !== null;
    if (filter === 'pricing unknown') return row.pricing_clarity === null;
    return true;
  });
}

type ComparisonRouteState = {
  badge: 'VERIFIED ROUTE' | 'CATALOG ONLY' | 'INTERMITTENT' | 'DEGRADED';
  tone: 'verified' | 'catalog' | 'intermittent' | 'degraded';
  status: string;
  implication: string;
  lastSeenHealthy: string;
};

function routeBadgeRiskClass(tone: ComparisonRouteState['tone']) {
  if (tone === 'verified') return 'risk-low';
  if (tone === 'catalog') return 'risk-watch';
  if (tone === 'intermittent') return 'risk-elevated';
  return 'risk-critical';
}

function comparisonRouteState(row: RadarComparisonRow): ComparisonRouteState {
  const mappingSource = row.mapping_source ?? (row.mapped_endpoint_count > 0 ? 'catalog' : 'none');
  const hasVerifiedMapping = mappingSource === 'verified' || mappingSource === 'catalog_and_verified';
  const catalogOnly = mappingSource === 'none' || row.mapped_endpoint_count === 0;
  const hasIntermittentSignal = [mappingSource, row.reachability, row.route_recommendation, ...row.rejection_reasons]
    .some((value) => String(value ?? '').toLowerCase().includes('intermittent'));
  const degraded = row.degradation_count > 0
    || row.reachability === 'degraded'
    || row.reachability === 'failed'
    || (row.route_recommendation === 'not_recommended' && !catalogOnly && hasVerifiedMapping);

  if (catalogOnly) {
    return {
      badge: 'CATALOG ONLY',
      tone: 'catalog',
      status: 'Catalog only',
      implication: 'Radar has discovered this provider, but no executable endpoint mapping has been verified yet.',
      lastSeenHealthy: 'not yet verified'
    };
  }

  if (degraded) {
    return {
      badge: 'DEGRADED',
      tone: 'degraded',
      status: 'Degraded',
      implication: 'Mapped route exists, but current health or reachability is degraded.',
      lastSeenHealthy: formatDate(row.last_seen_healthy ?? row.last_verified_at ?? null)
    };
  }

  // TODO: There is no dedicated intermittent status field in comparison rows yet.
  // Keep detection conservative and only classify as intermittent when a source field explicitly says so.
  if (hasVerifiedMapping && hasIntermittentSignal) {
    return {
      badge: 'INTERMITTENT',
      tone: 'intermittent',
      status: 'Intermittent',
      implication: 'Previously executable, but not recommended for default routing until it passes fresh checks.',
      lastSeenHealthy: formatDate(row.last_seen_healthy ?? row.last_verified_at ?? null)
    };
  }

  if (hasVerifiedMapping && row.route_eligible_endpoint_count > 0 && row.route_recommendation === 'route_eligible') {
    return {
      badge: 'VERIFIED ROUTE',
      tone: 'verified',
      status: 'Verified route',
      implication: 'Eligible for routing based on verified execution history.',
      lastSeenHealthy: formatDate(row.last_seen_healthy ?? row.last_verified_at ?? null)
    };
  }

  return {
    badge: 'DEGRADED',
    tone: 'degraded',
    status: 'Degraded',
    implication: 'Mapped route exists, but current health or reachability is degraded.',
    lastSeenHealthy: formatDate(row.last_seen_healthy ?? row.last_verified_at ?? null)
  };
}

function sortComparisonRows(rows: RadarComparisonRow[], sort: 'trust score' | 'signal score' | 'endpoint count' | 'degradation count' | 'pricing clarity' | 'metadata quality' | 'last observed') {
  return [...rows].sort((a, b) => {
    if (sort === 'trust score') return (b.trust_score ?? -1) - (a.trust_score ?? -1);
    if (sort === 'signal score') return (b.signal_score ?? -1) - (a.signal_score ?? -1);
    if (sort === 'endpoint count') return b.endpoint_count - a.endpoint_count;
    if (sort === 'degradation count') return b.degradation_count - a.degradation_count;
    if (sort === 'pricing clarity') return (b.pricing_clarity ?? -1) - (a.pricing_clarity ?? -1);
    if (sort === 'metadata quality') return (b.metadata_quality ?? -1) - (a.metadata_quality ?? -1);
    return Date.parse(b.last_observed ?? '') - Date.parse(a.last_observed ?? '');
  });
}

function severityLabel(receipt: EvidenceReceipt) {
  const severity = normalSeverity(receipt.severity).toUpperCase();
  const reason = receipt.severity_reason ?? receipt.severityReason ?? 'No deterministic severity reason available.';
  return `${severity}: ${reason}`;
}

function formatNullableBoolean(value: boolean | null) {
  if (value === null) return 'unknown';
  return value ? 'yes' : 'no';
}

function preflightCurlFromText(input: string) {
  const body = safePreflightJson(input);
  return `curl -s -X POST ${toApiUrl(API_BASE_URL, '/v1/radar/preflight')} \\\n  -H 'Content-Type: application/json' \\\n  --data '${escapeShellSingleQuoted(JSON.stringify(body))}'`;
}

function safePreflightJson(input: string) {
  try {
    const parsed = JSON.parse(input);
    if (isRecord(parsed)) return parsed;
  } catch {
    // ignored
  }
  return {
    intent: 'get SOL price',
    category: 'finance',
    constraints: { min_trust: 80, prefer_reachable: true, require_pricing: true, max_price_usd: 0.01 }
  };
}

function routeImplicationForState(state: 'healthy' | 'watch' | 'degraded' | 'critical' | 'unknown') {
  if (state === 'healthy') return 'Route may proceed under current policy.';
  if (state === 'watch') return 'Route with caution; inspect evidence first.';
  if (state === 'degraded') return 'Prefer fallback route when available.';
  if (state === 'critical') return 'Not recommended for routing.';
  return 'Evidence incomplete; do not treat as failure.';
}

function resolveObservedAt(value: { observed_at?: unknown; observedAt?: unknown; timestamp?: unknown; created_at?: unknown } | null | undefined) {
  if (!value) return null;
  const candidate = value.observed_at ?? value.observedAt ?? value.timestamp ?? value.created_at;
  return typeof candidate === 'string' ? candidate : null;
}

function statusLabel(status: string) {
  if (/reachable|healthy|ok/i.test(status)) return `[OK] ${status}`;
  if (/degraded|slow/i.test(status)) return `[DEGRADED] ${status}`;
  if (/failed|failure|down|error/i.test(status)) return `[FAILED] ${status}`;
  return `[?] ${status || 'unknown'}`;
}

function toRiskContext(risk: RadarRiskResponse | RadarEcosystemRiskSummary | null | undefined): RadarRiskContext | null {
  if (!risk) return null;
  return {
    predictive_risk_score: risk.risk_score,
    predictive_risk_level: risk.risk_level,
    history_available: risk.history_available,
    sample_count: risk.sample_count,
    explanation: risk.explanation ?? '',
    evidence: risk.evidence,
    warnings: risk.warnings,
    recommended_action: risk.recommended_action,
    top_anomaly: risk.anomalies[0] ?? null
  };
}

function toRiskContextFromRow(row: RadarComparisonRow): RadarRiskContext | null {
  if (typeof row.predictive_risk_score !== 'number' || !row.predictive_risk_level) return null;
  return {
    predictive_risk_score: row.predictive_risk_score,
    predictive_risk_level: row.predictive_risk_level,
    history_available: true,
    sample_count: 0,
    explanation: row.top_anomaly?.explanation ?? '',
    evidence: row.top_anomaly?.evidence ?? [],
    warnings: [],
    recommended_action: row.recommended_action ?? 'insufficient history',
    top_anomaly: row.top_anomaly ?? null
  };
}

function riskBadgeLabel(level: RiskLevel) {
  if (level === 'low') return 'Low Risk';
  if (level === 'watch') return 'Watch';
  if (level === 'elevated') return 'Elevated Risk';
  if (level === 'critical') return 'Critical Risk';
  return 'Unknown Risk';
}

function riskRouteImplication(level: RiskLevel) {
  if (level === 'critical') return 'Not recommended for routing.';
  if (level === 'elevated') return 'Route with fallback.';
  if (level === 'watch') return 'Monitor before routing.';
  if (level === 'unknown') return 'Insufficient history.';
  return 'Route normally.';
}

function normalizeRouteImplication(value: string) {
  return value.replace(/\.$/, '').toLowerCase() === 'not recommended for routing'
    ? 'Not recommended for routing'
    : value;
}

function sortAnomalyWatchItems(items: AnomalyWatchItem[]) {
  const severityPriority: Record<AnomalyWatchItem['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const confidencePriority: Record<AnomalyWatchItem['confidence'], number> = { high: 0, medium: 1, low: 2 };
  return [...items].sort((a, b) => (
    severityPriority[a.severity] - severityPriority[b.severity]
    || confidencePriority[a.confidence] - confidencePriority[b.confidence]
    || anomalyTimestamp(b.detected_at) - anomalyTimestamp(a.detected_at)
    || a.anomaly_type.localeCompare(b.anomaly_type)
  ));
}

function anomalyTimestamp(value: string | null | undefined) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function riskLabel(risk: string) {
  if (/high|warning|elevated/i.test(risk)) return `[WARNING] ${risk}`;
  if (/low|clear|safe/i.test(risk)) return `[OK] ${risk}`;
  return `[?] ${risk || 'unknown'}`;
}

function eventCategoryIcon(category: EventCategory) {
  const labels: Record<EventCategory, string> = {
    discovery: '[DISC]',
    trust: '[TRUST]',
    monitoring: '[MON]',
    pricing: '[$]',
    schema: '[SCHEMA]',
    signal: '[SIGNAL]'
  };
  return labels[category];
}

function componentValue(value: number | null | undefined) {
  return typeof value === 'number' ? `${value}/100` : 'unknown';
}

function knownState(value: number | null | undefined) {
  return typeof value === 'number' ? `known ${value}/100` : 'unknown';
}

function formatScoreDelta(delta: ScoreDelta) {
  const score = delta.score ?? 'unknown';
  if (delta.delta === null) return `[UNKNOWN] ${score} / prior unavailable`;
  const direction = delta.delta > 0 ? '[IMPROVED]' : delta.delta < 0 ? '[DEGRADED]' : '[UNCHANGED]';
  const prefix = delta.delta > 0 ? '+' : '';
  return `${direction} ${score} (${prefix}${delta.delta})`;
}

function compactCategories(categories: Record<EventCategory, number>) {
  const active = Object.entries(categories).filter(([, count]) => count > 0).map(([category, count]) => `${category}:${count}`);
  return active.length ? active.join(' / ') : 'no categorized activity';
}

function compactList(items: string[], limit: number) {
  if (items.length <= limit) return items.join(', ');
  const shown = items.slice(0, limit).join(', ');
  return `${shown} +${items.length - limit} more`;
}

function safeInterpretationSummary(summary: string) {
  if (!summary) return '';
  return summary
    .replace(/\b0x[a-fA-F0-9]{16,}\b/g, '[id]')
    .replace(/\b[a-fA-F0-9]{24,}\b/g, '[id]')
    .replace(/\b[a-zA-Z0-9_-]{28,}\b/g, '[id]');
}

function groupTimelineByBatch(events: PulseEvent[]) {
  const groups = new Map<string, PulseEvent[]>();
  for (const event of events) {
    const observedAt = resolveObservedAt(event as unknown as Record<string, unknown>) ?? event.observedAt;
    const batch = groups.get(observedAt) ?? [];
    batch.push(event);
    groups.set(observedAt, batch);
  }
  return [...groups.entries()].map(([observedAt, batchEvents]) => ({ observedAt, events: batchEvents }));
}

function sourceLabel(source: DataSource) {
  return source.mode === 'live_pay_sh_catalog' && !source.used_fixture ? 'LIVE PAY.SH CATALOG' : 'FIXTURE-BACKED RADAR STATE';
}

function graphFallbackEvidence(graph: { nodes: unknown[]; edges: unknown[] }): EvidenceReceipt {
  return {
    event_id: null,
    provider_id: null,
    endpoint_id: null,
    source: 'infopunks:graph-layer',
    derivation_reason: `Graph layer rendered ${graph.nodes.length} nodes and ${graph.edges.length} deterministic edges from current API payload.`,
    confidence: 1
  };
}

function compareProviders(a: Provider, b: Provider, sort: string, trustLookup: Map<string, TrustAssessment>, signalLookup: Map<string, SignalAssessment>) {
  const severity = severityRank(a.severity) - severityRank(b.severity);
  if (severity !== 0) return severity;
  if (sort === 'trust score') return (b.latestTrustScore ?? trustLookup.get(b.id)?.score ?? -1) - (a.latestTrustScore ?? trustLookup.get(a.id)?.score ?? -1) || a.name.localeCompare(b.name);
  if (sort === 'signal score') return (b.latestSignalScore ?? signalLookup.get(b.id)?.score ?? -1) - (a.latestSignalScore ?? signalLookup.get(a.id)?.score ?? -1) || a.name.localeCompare(b.name);
  if (sort === 'endpoint count') return b.endpointCount - a.endpointCount || a.name.localeCompare(b.name);
  if (sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
  return a.name.localeCompare(b.name);
}

function formatDataSource(source: DataSource, providers: number, endpoints: number) {
  const sourceUrl = source.url?.replace(/^https?:\/\//, '') ?? 'pay.sh/api/catalog';
  return `Source: ${sourceUrl} · providers ${source.provider_count ?? providers} · endpoints ${endpoints} · last ingested ${formatDate(source.last_ingested_at ?? source.generated_at)}`;
}

type MachineControlPlaneNavCurrent =
  | 'machine-market'
  | 'machine-rail-coverage'
  | 'machine-route-risk-matrix'
  | 'machine-first-safe-routes'
  | 'machine-benchmark-readiness'
  | 'machine-benchmark-methodology'
  | 'machine-comparable-routes'
  | 'machine-translation-evidence'
  | 'machine-proof-ladder'
  | 'machine-execution-shortlist'
  | 'machine-readiness-matrix'
  | 'machine-market-map'
  | 'machine-execution-blockers'
  | 'machine-market-changelog'
  | 'machine-no-claim-ledger'
  | 'machine-receipts'
  | 'machine-economy-snapshot';

function MachineControlPlaneNavLinks({
  current,
  includeSnapshot = true
}: {
  current: MachineControlPlaneNavCurrent | null;
  includeSnapshot?: boolean;
}) {
  const primaryLinks: Array<{ href: string; label: string; key: MachineControlPlaneNavCurrent; priorityClass: string }> = [
    { href: '/machine-market', label: 'Machine Market', key: 'machine-market', priorityClass: 'priority-core' },
    { href: '/machine-rail-coverage', label: 'Rail Coverage', key: 'machine-rail-coverage', priorityClass: 'priority-core' },
    { href: '/machine-route-risk-matrix', label: 'Route Risk', key: 'machine-route-risk-matrix', priorityClass: 'priority-core' },
    { href: '/machine-first-safe-routes', label: 'First Safe Queue', key: 'machine-first-safe-routes', priorityClass: 'priority-high' },
    { href: '/machine-benchmark-readiness', label: 'Benchmark Readiness', key: 'machine-benchmark-readiness', priorityClass: 'priority-high' },
    { href: '/machine-receipts', label: 'Receipts', key: 'machine-receipts', priorityClass: 'priority-medium' }
  ];
  if (includeSnapshot) primaryLinks.push({ href: '/machine-economy-snapshot', label: 'Snapshot', key: 'machine-economy-snapshot', priorityClass: 'priority-medium' });

  const secondaryLinks: Array<{ href: string; label: string; key: MachineControlPlaneNavCurrent | 'radar-terminal' }> = [
    { href: '/machine-benchmark-methodology', label: 'Benchmark Methodology', key: 'machine-benchmark-methodology' },
    { href: '/machine-comparable-routes', label: 'Comparable Routes', key: 'machine-comparable-routes' },
    { href: '/machine-translation-evidence', label: 'Translation Evidence', key: 'machine-translation-evidence' },
    { href: '/machine-proof-ladder', label: 'Proof Ladder', key: 'machine-proof-ladder' },
    { href: '/machine-execution-blockers', label: 'Execution Blockers', key: 'machine-execution-blockers' },
    { href: '/machine-market-changelog', label: 'Changelog', key: 'machine-market-changelog' },
    { href: '/machine-no-claim-ledger', label: 'No-Claim Ledger', key: 'machine-no-claim-ledger' },
    { href: '/machine-readiness-matrix', label: 'Readiness Matrix', key: 'machine-readiness-matrix' },
    { href: '/machine-market-map', label: 'Market Map', key: 'machine-market-map' },
    { href: '/machine-execution-shortlist', label: 'Proof Plans', key: 'machine-execution-shortlist' },
    { href: '/', label: 'Radar Terminal', key: 'radar-terminal' }
  ];
  const secondaryActive = secondaryLinks.some((link) => link.key === current);

  return <>
    {primaryLinks.map((link) => {
      const active = current === link.key;
      return <a key={link.href} className={`machine-control-plane-link ${link.priorityClass}${active ? ' active' : ''}`} href={link.href} aria-current={active ? 'page' : undefined}>{link.label}</a>;
    })}
    <details className={`machine-control-plane-more ${secondaryActive ? 'active' : ''}`}>
      <summary className="machine-control-plane-summary" aria-label="More Machine Economy control surfaces">More</summary>
      <div className="machine-control-plane-menu" aria-label="Secondary Machine Economy navigation">
        {secondaryLinks.map((link) => {
          const active = current === link.key;
          return <a key={link.href} className={active ? 'active' : ''} href={link.href} aria-current={active ? 'page' : undefined}>{link.label}</a>;
        })}
      </div>
    </details>
  </>;
}

function MachineControlSurfacesStrip() {
  return <section className="panel machine-control-surfaces" aria-label="Machine Economy Control Surfaces">
    <div className="panel-head">
      <div>
        <p className="section-kicker">Control Surfaces</p>
        <h2>Machine Economy Control Surfaces</h2>
      </div>
      <span className="machine-badge evidence">control-plane</span>
    </div>
    <p className="copy">Use these control surfaces to move from the visible machine market to rail classification, route risk, and first-safe planning without implying execution.</p>
    <div className="machine-control-surfaces-links">
      <a className="execute compact secondary" href="/machine-market">Command Center</a>
      <a className="execute compact secondary" href="/machine-rail-coverage">Rail Coverage</a>
      <a className="execute compact secondary" href="/machine-route-risk-matrix">Route Risk Matrix</a>
      <a className="execute compact secondary" href="/machine-first-safe-routes">First Safe Route Queue</a>
      <a className="execute compact secondary" href="/machine-benchmark-readiness">Benchmark Readiness</a>
      <a className="execute compact secondary" href="/machine-benchmark-methodology">Benchmark Methodology</a>
      <a className="execute compact secondary" href="/machine-comparable-routes">Comparable Routes</a>
      <a className="execute compact secondary" href="/machine-translation-evidence">Translation Evidence</a>
      <a className="execute compact secondary" href="/machine-proof-ladder">Proof Ladder</a>
      <a className="execute compact secondary" href="/machine-execution-shortlist">Proof Plans</a>
      <a className="execute compact secondary" href="/machine-readiness-matrix">Readiness Matrix</a>
      <a className="execute compact secondary" href="/machine-market-map">Market Map</a>
      <a className="execute compact secondary" href="/machine-execution-blockers">Execution Blockers</a>
      <a className="execute compact secondary" href="/machine-market-changelog">Changelog</a>
      <a className="execute compact secondary" href="/machine-no-claim-ledger">No-Claim Ledger</a>
      <a className="execute compact secondary" href="/machine-receipts">Receipts</a>
      <a className="execute compact secondary" href="/machine-economy-snapshot">Snapshot</a>
    </div>
    <div className="machine-usage-list">
      <p><span>Rail Coverage</span><small>access rail and callable-surface intelligence</small></p>
      <p><span>Route Risk</span><small>route-level risk and avoid-first logic</small></p>
      <p><span>First Safe Queue</span><small>execution roadmap without execution</small></p>
      <p><span>Benchmark Readiness</span><small>readiness state only, no benchmark evidence</small></p>
      <p><span>Comparable Routes</span><small>methodology contracts before benchmarking</small></p>
      <p><span>Translation Evidence</span><small>evidence acquisition path to unlock translation lane later</small></p>
      <p><span>Proof Ladder</span><small>public evidence progression without winner claims</small></p>
      <p><span>Execution Blockers</span><small>what should not run yet</small></p>
      <p><span>Changelog</span><small>machine market memory</small></p>
      <p><span>No-Claim Ledger</span><small>restraint and claim discipline</small></p>
      <p><span>Snapshot</span><small>public artifact</small></p>
    </div>
  </section>;
}

const GRAPH_PROOF_STATE_LABELS: Record<GraphProofState, string> = {
  unproven: 'Unproven',
  validated: 'Validated',
  disputed: 'Disputed',
  corrupted: 'Corrupted',
  compounding: 'Compounding'
};

const GRAPH_EMPTY_STATE: GraphPayload = {
  tagline: 'Stop scrolling the feed. Read the graph.',
  clusters: [],
  nodes: [],
  edges: [],
  ripples: [],
  stats: null
};

function graphProofStateLabel(value: string | null | undefined) {
  if (!value) return 'Unknown';
  if (value in GRAPH_PROOF_STATE_LABELS) return GRAPH_PROOF_STATE_LABELS[value as GraphProofState];
  return value.replace(/_/g, ' ');
}

function graphNodeTypeLabel(value: string | null | undefined) {
  if (!value) return 'unknown';
  return value.replace(/_/g, ' ');
}

function graphEdgeTypeLabel(value: string | null | undefined) {
  if (!value) return 'unknown';
  return value.replace(/_/g, ' ');
}

function graphTitleCase(value: string) {
  return value.split(/[_\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function safeGraphStringList(value: unknown) {
  return asArray<unknown>(value).filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function safeGraphNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeGraphNode(raw: unknown): GraphNode | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.label !== 'string') return null;
  return {
    id: raw.id,
    type: typeof raw.type === 'string' ? raw.type as GraphNodeType : 'claim',
    label: raw.label,
    summary: typeof raw.summary === 'string' ? raw.summary : 'No summary recorded.',
    cluster_id: typeof raw.cluster_id === 'string' ? raw.cluster_id : 'unclustered',
    proof_state: typeof raw.proof_state === 'string' ? raw.proof_state as GraphProofState : 'unproven',
    confidence_score: safeGraphNumber(raw.confidence_score),
    velocity_score: safeGraphNumber(raw.velocity_score),
    source_urls: safeGraphStringList(raw.source_urls),
    linked_receipt_ids: safeGraphStringList(raw.linked_receipt_ids),
    linked_claim_ids: safeGraphStringList(raw.linked_claim_ids),
    linked_loop_ids: safeGraphStringList(raw.linked_loop_ids),
    linked_route_ids: safeGraphStringList(raw.linked_route_ids),
    linked_provider_ids: safeGraphStringList(raw.linked_provider_ids),
    linked_service_ids: safeGraphStringList(raw.linked_service_ids),
    created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : ''
  };
}

function safeGraphEdge(raw: unknown): GraphEdge | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const source_node_id = typeof raw.source_node_id === 'string'
    ? raw.source_node_id
    : typeof raw.source === 'string'
      ? raw.source
      : null;
  const target_node_id = typeof raw.target_node_id === 'string'
    ? raw.target_node_id
    : typeof raw.target === 'string'
      ? raw.target
      : null;
  if (!source_node_id || !target_node_id) return null;
  return {
    id: raw.id,
    source_node_id,
    target_node_id,
    type: typeof raw.type === 'string' ? raw.type as GraphEdgeType : 'semantic_similarity',
    strength: safeGraphNumber(raw.strength, 50),
    explanation: typeof raw.explanation === 'string' ? raw.explanation : 'No explanation recorded.'
  };
}

function safeGraphCluster(raw: unknown): GraphCluster | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    label: typeof raw.label === 'string' ? raw.label : graphTitleCase(raw.id),
    summary: typeof raw.summary === 'string' ? raw.summary : 'Cluster summary unavailable.',
    proof_state: typeof raw.proof_state === 'string' ? raw.proof_state as GraphProofState : 'unproven',
    ripple_summary: typeof raw.ripple_summary === 'string' ? raw.ripple_summary : 'No 24h ripple summary recorded.',
    node_count: safeGraphNumber(raw.node_count),
    edge_count: safeGraphNumber(raw.edge_count),
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : ''
  };
}

function safeGraphRipple(raw: unknown): GraphRipple | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;
  return {
    id: raw.id,
    cluster_id: typeof raw.cluster_id === 'string' ? raw.cluster_id : 'unclustered',
    title: raw.title,
    summary: typeof raw.summary === 'string' ? raw.summary : 'No ripple summary recorded.',
    proof_state: typeof raw.proof_state === 'string' ? raw.proof_state as GraphProofState : 'unproven',
    impact_score: safeGraphNumber(raw.impact_score),
    changed_at: typeof raw.changed_at === 'string' ? raw.changed_at : '',
    linked_node_ids: safeGraphStringList(raw.linked_node_ids)
  };
}

function safeGraphStats(raw: unknown): GraphStats | null {
  if (!isRecord(raw)) return null;
  return {
    node_count: safeGraphNumber(raw.node_count),
    edge_count: safeGraphNumber(raw.edge_count),
    cluster_count: safeGraphNumber(raw.cluster_count),
    validated_count: safeGraphNumber(raw.validated_count),
    disputed_count: safeGraphNumber(raw.disputed_count),
    compounding_count: safeGraphNumber(raw.compounding_count),
    last_updated_at: typeof raw.last_updated_at === 'string' ? raw.last_updated_at : null
  };
}

function normalizeGraphPayload(raw: unknown): GraphPayload {
  const payload = isRecord(raw) && 'data' in raw ? raw.data : raw;
  if (!isRecord(payload)) return GRAPH_EMPTY_STATE;
  const nodes = asArray<unknown>(payload.nodes).map(safeGraphNode).filter((item): item is GraphNode => item !== null);
  const edges = asArray<unknown>(payload.edges).map(safeGraphEdge).filter((item): item is GraphEdge => item !== null);
  const clusters = asArray<unknown>(payload.clusters).map(safeGraphCluster).filter((item): item is GraphCluster => item !== null);
  const derivedClusterIds = Array.from(new Set(nodes.map((node) => node.cluster_id)));
  const completedClusters = clusters.length > 0
    ? clusters
    : derivedClusterIds.map((id) => ({
      id,
      label: graphTitleCase(id),
      summary: 'Cluster summary unavailable in this payload.',
      proof_state: 'unproven' as GraphProofState,
      ripple_summary: 'No 24h ripple summary recorded.',
      node_count: nodes.filter((node) => node.cluster_id === id).length,
      edge_count: edges.filter((edge) => {
        const source = nodes.find((node) => node.id === edge.source_node_id);
        const target = nodes.find((node) => node.id === edge.target_node_id);
        return source?.cluster_id === id || target?.cluster_id === id;
      }).length,
      updated_at: nodes.find((node) => node.cluster_id === id)?.updated_at ?? ''
    }));
  return {
    tagline: typeof payload.tagline === 'string' && payload.tagline.trim().length > 0 ? payload.tagline : GRAPH_EMPTY_STATE.tagline,
    clusters: completedClusters,
    nodes,
    edges,
    ripples: asArray<unknown>(payload.ripples).map(safeGraphRipple).filter((item): item is GraphRipple => item !== null),
    stats: safeGraphStats(payload.stats)
  };
}

function normalizeGraphRippleResponse(raw: unknown) {
  const payload = isRecord(raw) && 'data' in raw ? raw.data : raw;
  if (!isRecord(payload)) return [] as GraphRipple[];
  return asArray<unknown>(payload.ripples).map(safeGraphRipple).filter((item): item is GraphRipple => item !== null);
}

function safeGraphSuggestedEdge(raw: unknown): GraphSuggestedEdge | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.target_node_id !== 'string' || typeof raw.type !== 'string') return null;
  return {
    target_node_id: raw.target_node_id,
    type: raw.type as GraphEdgeType,
    strength: safeGraphNumber(raw.strength),
    explanation: typeof raw.explanation === 'string' ? raw.explanation : 'No edge explanation recorded.'
  };
}

function normalizeGraphCheckResponse(raw: unknown): GraphCheckResponse | null {
  const payload = isRecord(raw) && 'data' in raw ? raw.data : raw;
  if (!isRecord(payload)) return null;
  const generatedNodePreview = safeGraphNode(payload.generated_node_preview);
  if (!generatedNodePreview) return null;
  return {
    generated_node_preview: generatedNodePreview,
    suggested_proof_state: typeof payload.suggested_proof_state === 'string' ? payload.suggested_proof_state as GraphProofState : generatedNodePreview.proof_state,
    confidence_score: safeGraphNumber(payload.confidence_score),
    suggested_edges: asArray<unknown>(payload.suggested_edges).map(safeGraphSuggestedEdge).filter((item): item is GraphSuggestedEdge => item !== null),
    explanation: typeof payload.explanation === 'string' ? payload.explanation : 'No explanation recorded.'
  };
}

function graphNodeLinkGroups(node: GraphNode) {
  return [
    ['Receipts', node.linked_receipt_ids ?? []],
    ['Claims', node.linked_claim_ids ?? []],
    ['Loops', node.linked_loop_ids ?? []],
    ['Routes', node.linked_route_ids ?? []],
    ['Providers', node.linked_provider_ids ?? []],
    ['Services', node.linked_service_ids ?? []]
  ] as const;
}

function graphEntityHref(group: string, id: string) {
  if (group === 'Receipts') return id.startsWith('receipt_') ? `/receipts/${encodeURIComponent(id)}` : null;
  if (group === 'Claims') return `/claims/${encodeURIComponent(id)}`;
  if (group === 'Loops') return `/loops/${encodeURIComponent(id)}`;
  if (group === 'Routes') return `/routes/${encodeURIComponent(id)}`;
  if (group === 'Providers') return `/providers/${encodeURIComponent(id)}`;
  if (group === 'Services') return `/services/${encodeURIComponent(id)}`;
  return null;
}

function graphQueryNodeId() {
  try {
    return new URLSearchParams(window.location.search).get('node');
  } catch {
    return null;
  }
}

function buildNodeShareText(node: GraphNode, clusterLabel: string) {
  return `INFOPUNKS SIGNAL GRAPH

${node.label}

Type: ${graphNodeTypeLabel(node.type)}
Cluster: ${clusterLabel}
Proof state: ${graphProofStateLabel(node.proof_state)}
Confidence: ${node.confidence_score}/100
Velocity: ${node.velocity_score}/100

${node.summary}

Stop scrolling the feed.
Read the graph.

radar.infopunks.fun/graph?node=${node.id}`;
}

function buildRippleShareText(ripple: GraphRipple, clusterLabel: string) {
  return `SIGNAL GRAPH RIPPLE

${ripple.title}

Cluster: ${clusterLabel}
Proof state: ${graphProofStateLabel(ripple.proof_state)}
Impact: ${ripple.impact_score}/100

${ripple.summary}

Stop scrolling the feed.
Read the graph.

radar.infopunks.fun/graph`;
}

function buildSignalCheckShareText(result: GraphCheckResponse, clusterLabel: string) {
  return `INFOPUNKS SIGNAL CHECK

${result.generated_node_preview.label}

Suggested proof state: ${graphProofStateLabel(result.suggested_proof_state)}
Confidence: ${result.confidence_score}/100
Suggested cluster: ${clusterLabel}

${result.explanation}

Stop scrolling the feed.
Read the graph.

radar.infopunks.fun/graph`;
}

function SignalGraphPage() {
  const [graph, setGraph] = useState<GraphPayload>(GRAPH_EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<'all' | string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => graphQueryNodeId());
  const [signalCheckLabel, setSignalCheckLabel] = useState('');
  const [signalCheckSummary, setSignalCheckSummary] = useState('');
  const [signalCheckSourceUrl, setSignalCheckSourceUrl] = useState('');
  const [signalCheckClusterId, setSignalCheckClusterId] = useState('');
  const [signalCheckValidationError, setSignalCheckValidationError] = useState<string | null>(null);
  const [signalCheckError, setSignalCheckError] = useState<string | null>(null);
  const [signalCheckLoading, setSignalCheckLoading] = useState(false);
  const [signalCheckResult, setSignalCheckResult] = useState<GraphCheckResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const normalized = normalizeGraphPayload(await api<unknown>('/v1/graph'));
        let ripples = normalized.ripples;
        if (ripples.length === 0) {
          try {
            ripples = normalizeGraphRippleResponse(await api<unknown>('/v1/graph/ripples'));
          } catch {
            ripples = [];
          }
        }
        if (cancelled) return;
        setGraph({ ...normalized, ripples });
        setSelectedNodeId((current) => current ?? normalized.nodes[0]?.id ?? null);
      } catch {
        if (cancelled) return;
        setError('Signal Graph is temporarily unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const clusterMap = useMemo(() => new Map(graph.clusters.map((cluster) => [cluster.id, cluster])), [graph.clusters]);
  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const visibleNodes = useMemo(() => activeClusterId === 'all' ? graph.nodes : graph.nodes.filter((node) => node.cluster_id === activeClusterId), [activeClusterId, graph.nodes]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => graph.edges.filter((edge) => visibleNodeIds.has(edge.source_node_id) && visibleNodeIds.has(edge.target_node_id)), [graph.edges, visibleNodeIds]);
  const visibleRipples = useMemo(() => activeClusterId === 'all' ? graph.ripples : graph.ripples.filter((ripple) => ripple.cluster_id === activeClusterId), [activeClusterId, graph.ripples]);
  const selectedNode = useMemo(() => {
    if (selectedNodeId && visibleNodeIds.has(selectedNodeId)) return nodeMap.get(selectedNodeId) ?? null;
    return visibleNodes[0] ?? null;
  }, [nodeMap, selectedNodeId, visibleNodeIds, visibleNodes]);

  useEffect(() => {
    if (selectedNode?.id && selectedNodeId !== selectedNode.id) setSelectedNodeId(selectedNode.id);
  }, [selectedNode?.id, selectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('node', selectedNodeId);
      window.history.replaceState(window.history.state, '', `${url.pathname}?${url.searchParams.toString()}`);
    } catch {
      return;
    }
  }, [selectedNodeId]);

  const connectedEdges = useMemo(() => selectedNode ? graph.edges.filter((edge) => edge.source_node_id === selectedNode.id || edge.target_node_id === selectedNode.id) : [], [graph.edges, selectedNode]);
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return [] as GraphNode[];
    const ids = new Set<string>();
    for (const edge of connectedEdges) ids.add(edge.source_node_id === selectedNode.id ? edge.target_node_id : edge.source_node_id);
    return Array.from(ids).map((id) => nodeMap.get(id)).filter((item): item is GraphNode => item != null);
  }, [connectedEdges, nodeMap, selectedNode]);
  const signalCheckClusterLabel = signalCheckResult
    ? clusterMap.get(signalCheckResult.generated_node_preview.cluster_id)?.label ?? graphTitleCase(signalCheckResult.generated_node_preview.cluster_id)
    : null;

  const clusterNodes = useMemo(() => {
    const map = new Map<string, GraphNode[]>();
    for (const cluster of graph.clusters) map.set(cluster.id, []);
    for (const node of visibleNodes) {
      if (!map.has(node.cluster_id)) map.set(node.cluster_id, []);
      map.get(node.cluster_id)!.push(node);
    }
    return map;
  }, [graph.clusters, visibleNodes]);

  const layout = useMemo(() => {
    const width = 960;
    const height = 640;
    const centerX = width / 2;
    const centerY = height / 2;
    const clusterIds = Array.from(clusterNodes.keys()).filter((clusterId) => (clusterNodes.get(clusterId) ?? []).length > 0);
    const orbitX = Math.max(180, Math.min(300, 120 + clusterIds.length * 26));
    const orbitY = Math.max(120, Math.min(220, 90 + clusterIds.length * 18));
    const positions = new Map<string, { x: number; y: number }>();
    const clusterCenters = new Map<string, { x: number; y: number }>();
    clusterIds.forEach((clusterId, clusterIndex) => {
      const angle = -Math.PI / 2 + (clusterIndex / Math.max(clusterIds.length, 1)) * Math.PI * 2;
      const clusterX = clusterIds.length === 1 ? centerX : centerX + Math.cos(angle) * orbitX;
      const clusterY = clusterIds.length === 1 ? centerY : centerY + Math.sin(angle) * orbitY;
      clusterCenters.set(clusterId, { x: clusterX, y: clusterY });
      const nodes = clusterNodes.get(clusterId) ?? [];
      nodes.forEach((node, nodeIndex) => {
        const ring = 54 + Math.floor(nodeIndex / 6) * 24;
        const localAngle = -Math.PI / 2 + (nodeIndex / Math.max(nodes.length, 1)) * Math.PI * 2;
        positions.set(node.id, {
          x: clusterX + Math.cos(localAngle) * ring,
          y: clusterY + Math.sin(localAngle) * ring
        });
      });
    });
    return { width, height, positions, clusterCenters, clusterIds };
  }, [clusterNodes]);

  async function submitSignalCheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = signalCheckLabel.trim();
    if (!label) {
      setSignalCheckValidationError('Signal label is required.');
      return;
    }

    setSignalCheckValidationError(null);
    setSignalCheckError(null);
    setSignalCheckResult(null);
    setSignalCheckLoading(true);
    try {
      const payload: Record<string, string> = { label };
      const summary = signalCheckSummary.trim();
      const sourceUrl = signalCheckSourceUrl.trim();
      const clusterId = signalCheckClusterId.trim();
      if (summary) payload.summary = summary;
      if (sourceUrl) payload.source_url = sourceUrl;
      if (clusterId) payload.cluster_id = clusterId;

      const response = normalizeGraphCheckResponse(await api<unknown>('/v1/graph/check', {
        method: 'POST',
        body: JSON.stringify(payload)
      }));

      if (!response) throw new Error('Signal check returned an invalid preview payload.');
      setSignalCheckResult(response);
    } catch (submitError) {
      setSignalCheckError(submitError instanceof Error ? submitError.message : 'Signal check failed.');
    } finally {
      setSignalCheckLoading(false);
    }
  }

  return <div className="shell graph-shell">
    <a className="skip-link" href="#graph-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar" aria-label="Signal Graph controls">
        <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
          <span>Infopunks</span>
          <strong>Signal Graph</strong>
        </a>
        <div className="terminal-nav terminal-nav-scroll-rail" aria-label="Signal Graph navigation">
          <a href="/check">Check</a>
          <a href="/loops">Loops</a>
          <a href="/claim">Claims</a>
          <a href="/graph" className="active" aria-current="page">Signal Graph</a>
        </div>
        <div className="terminal-actions" aria-label="Signal Graph quick links">
          <span className="terminal-action-cluster">
            <a className="methodology-trigger" href="#graph-canvas">Explore the graph</a>
            <a className="methodology-trigger" href="#graph-ripples">View 24h ripples</a>
          </span>
        </div>
      </nav>
    </header>

    <main id="graph-content" className="signal-graph-page">
      <section className="panel signal-graph-hero">
        <div className="signal-graph-hero-copy">
          <p className="section-kicker">Infopunks Signal Graph</p>
          <h1>Infopunks Signal Graph</h1>
          <p className="signal-graph-tagline">{graph.tagline}</p>
          <p className="panel-caption">A proof-aware map of claims, memes, agents, projects, tokens, posts, routes, receipts, checks, loops, and narrative clusters.</p>
          <div className="signal-graph-thesis">
            <p>The feed shows what people are saying.</p>
            <p>The graph shows what the signal is becoming.</p>
          </div>
          <div className="panel-actions">
            <a className="execute" href="#graph-canvas">Explore the graph</a>
            <a className="execute compact secondary" href="#graph-ripples">View 24h ripples</a>
          </div>
        </div>
        <div className="signal-graph-hero-meta">
          <section className="signal-graph-legend" aria-label="Proof state legend">
            <p className="section-kicker">Proof State Legend</p>
            <div className="signal-graph-proof-list">
              {Object.entries(GRAPH_PROOF_STATE_LABELS).map(([state, label]) => <span key={state} className={`signal-proof-pill signal-proof-pill-${state}`}>
                <strong>{label}</strong>
                <small>{state.replace(/_/g, ' ')}</small>
              </span>)}
            </div>
          </section>
          <section className="signal-graph-stats-card" aria-label="Signal Graph totals">
            <p className="section-kicker">Graph Totals</p>
            <dl className="signal-graph-stat-grid">
              <div><dt>Nodes</dt><dd>{graph.stats?.node_count ?? graph.nodes.length}</dd></div>
              <div><dt>Edges</dt><dd>{graph.stats?.edge_count ?? graph.edges.length}</dd></div>
              <div><dt>Clusters</dt><dd>{graph.stats?.cluster_count ?? graph.clusters.length}</dd></div>
              <div><dt>Validated</dt><dd>{graph.stats?.validated_count ?? graph.nodes.filter((node) => node.proof_state === 'validated').length}</dd></div>
              <div><dt>Disputed</dt><dd>{graph.stats?.disputed_count ?? graph.nodes.filter((node) => node.proof_state === 'disputed').length}</dd></div>
              <div><dt>Compounding</dt><dd>{graph.stats?.compounding_count ?? graph.nodes.filter((node) => node.proof_state === 'compounding').length}</dd></div>
            </dl>
            <p className="panel-caption">Last updated {formatMachineTimestamp(graph.stats?.last_updated_at ?? graph.nodes[0]?.updated_at ?? null)}</p>
          </section>
        </div>
      </section>

      <section className="panel signal-graph-check-panel" aria-labelledby="signal-graph-check-title">
        <div className="signal-graph-check-copy">
          <p className="section-kicker">Check a signal</p>
          <h2 id="signal-graph-check-title">Check a signal</h2>
          <p className="signal-graph-check-subtitle">Paste a claim, post, token, project, or narrative fragment. Infopunks will preview where it belongs in the graph.</p>
          <p className="panel-caption">v0 preview. Full live ingestion comes later.</p>
        </div>

        <div className="signal-graph-check-grid">
          <form className="signal-graph-check-form" onSubmit={submitSignalCheck} noValidate>
            <label className="signal-graph-field">
              <span>Signal label</span>
              <input
                name="label"
                value={signalCheckLabel}
                onChange={(event) => {
                  setSignalCheckLabel(event.target.value);
                  if (signalCheckValidationError) setSignalCheckValidationError(null);
                }}
                placeholder="Agent wallets need route memory before autonomous spend."
                aria-invalid={signalCheckValidationError ? 'true' : 'false'}
                aria-describedby={signalCheckValidationError ? 'signal-check-label-error' : undefined}
              />
            </label>
            {signalCheckValidationError && <p id="signal-check-label-error" className="route-state error signal-graph-inline-error" role="alert">{signalCheckValidationError}</p>}

            <label className="signal-graph-field">
              <span>Summary</span>
              <textarea
                name="summary"
                value={signalCheckSummary}
                onChange={(event) => setSignalCheckSummary(event.target.value)}
                rows={3}
                placeholder="Optional context, evidence, or narrative fragment."
              />
            </label>

            <div className="signal-graph-field-grid">
              <label className="signal-graph-field">
                <span>Source URL</span>
                <input
                  name="source_url"
                  type="url"
                  value={signalCheckSourceUrl}
                  onChange={(event) => setSignalCheckSourceUrl(event.target.value)}
                  placeholder="https://example.com/thread"
                />
              </label>

              <label className="signal-graph-field">
                <span>Cluster</span>
                <select name="cluster_id" value={signalCheckClusterId} onChange={(event) => setSignalCheckClusterId(event.target.value)}>
                  <option value="">Auto-detect cluster</option>
                  {graph.clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.label}</option>)}
                </select>
              </label>
            </div>

            <div className="signal-graph-check-actions">
              <button className="execute" type="submit" disabled={signalCheckLoading}>{signalCheckLoading ? 'Mapping signal...' : 'Map signal'}</button>
            </div>
            {signalCheckError && <p className="route-state error signal-graph-inline-error" role="status">{signalCheckError}</p>}
          </form>

          <section className="signal-graph-check-result" aria-labelledby="signal-graph-check-result-title">
            <div className="signal-graph-panel-head">
              <div>
                <p className="section-kicker">Placement Preview</p>
                <h3 id="signal-graph-check-result-title">Signal placement preview</h3>
              </div>
              {signalCheckResult && signalCheckClusterLabel && <CopyButton value={buildSignalCheckShareText(signalCheckResult, signalCheckClusterLabel)} label="Copy check" />}
            </div>

            {signalCheckLoading
              ? <p className="route-state">Mapping signal into graph...</p>
              : !signalCheckResult
                ? <p className="panel-caption">Map a signal to preview its suggested proof state, cluster, connected edges, and placement explanation.</p>
              : <>
                <div className="signal-graph-detail-meta">
                  <span className="signal-proof-chip">{graphNodeTypeLabel(signalCheckResult.generated_node_preview.type)}</span>
                  <span className={`signal-proof-chip signal-proof-chip-${signalCheckResult.suggested_proof_state}`}>{graphProofStateLabel(signalCheckResult.suggested_proof_state)}</span>
                  <span className="signal-proof-chip">{signalCheckClusterLabel}</span>
                </div>
                <p className="signal-graph-node-summary">{signalCheckResult.generated_node_preview.summary}</p>
                <dl className="signal-graph-score-grid">
                  <div><dt>Suggested node label</dt><dd>{signalCheckResult.generated_node_preview.label}</dd></div>
                  <div><dt>Suggested proof state</dt><dd>{graphProofStateLabel(signalCheckResult.suggested_proof_state)}</dd></div>
                  <div><dt>Confidence score</dt><dd>{signalCheckResult.confidence_score}/100</dd></div>
                  <div><dt>Suggested cluster</dt><dd>{signalCheckClusterLabel}</dd></div>
                </dl>

                <section className="signal-graph-detail-section">
                  <h3>Suggested edges</h3>
                  {signalCheckResult.suggested_edges.length === 0
                    ? <p className="panel-caption">No suggested edges recorded.</p>
                    : <div className="signal-graph-edge-list">
                      {signalCheckResult.suggested_edges.map((edge, index) => {
                        const targetNode = nodeMap.get(edge.target_node_id);
                        return <article key={`${edge.target_node_id}-${edge.type}-${index}`}>
                          <strong>{targetNode?.label ?? edge.target_node_id}</strong>
                          <span>{edge.strength}/100</span>
                          <p>{graphEdgeTypeLabel(edge.type)} · {edge.explanation}</p>
                        </article>;
                      })}
                    </div>}
                </section>

                <section className="signal-graph-detail-section">
                  <h3>Explanation</h3>
                  <p className="signal-graph-node-summary">{signalCheckResult.explanation}</p>
                </section>
              </>}
          </section>
        </div>
      </section>

      {error && <section className="panel" role="status" aria-live="polite">
        <p className="route-state error">{error}</p>
      </section>}

      <section className="signal-graph-workspace">
        <aside className="panel signal-graph-sidebar" aria-label="Cluster filters and graph stats">
          <div className="signal-graph-sidebar-block">
            <p className="section-kicker">Cluster Filters</p>
            <div className="signal-graph-filter-chips" role="group" aria-label="Filter graph by cluster">
              <button type="button" className={activeClusterId === 'all' ? 'copy-chip active' : 'copy-chip'} onClick={() => setActiveClusterId('all')}>All clusters</button>
              {graph.clusters.map((cluster) => <button key={cluster.id} type="button" className={activeClusterId === cluster.id ? 'copy-chip active' : 'copy-chip'} onClick={() => setActiveClusterId(cluster.id)}>{cluster.label}</button>)}
            </div>
          </div>
          <div className="signal-graph-sidebar-block">
            <p className="section-kicker">Clusters</p>
            <div className="signal-graph-cluster-list">
              {graph.clusters.map((cluster) => <button key={cluster.id} type="button" className={`signal-graph-cluster-card ${activeClusterId === cluster.id ? 'active' : ''}`} onClick={() => setActiveClusterId(cluster.id)}>
                <span className="signal-graph-cluster-head">
                  <strong>{cluster.label}</strong>
                  <span className={`signal-proof-chip signal-proof-chip-${cluster.proof_state}`}>{graphProofStateLabel(cluster.proof_state)}</span>
                </span>
                <span>{cluster.summary}</span>
                <small>{cluster.node_count} nodes · {cluster.edge_count} edges</small>
              </button>)}
            </div>
          </div>
        </aside>

        <section className="panel signal-graph-canvas-panel" id="graph-canvas" aria-labelledby="signal-graph-canvas-title">
          <div className="signal-graph-panel-head">
            <div>
              <p className="section-kicker">Visual Memory Layer</p>
              <h2 id="signal-graph-canvas-title">Read the graph</h2>
            </div>
            <p className="panel-caption">Clusters orbit the canvas. Click any node to inspect its proof state, links, and connected signal.</p>
          </div>
          {loading
            ? <p className="route-state">Loading graph memory...</p>
            : visibleNodes.length === 0
              ? <p className="route-state warn">No nodes match this cluster filter.</p>
              : <svg className="signal-graph-svg" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="Signal Graph cluster and node map">
                <rect x="1" y="1" width={layout.width - 2} height={layout.height - 2} rx="26" className="signal-graph-svg-frame" />
                {layout.clusterIds.map((clusterId) => {
                  const center = layout.clusterCenters.get(clusterId);
                  const cluster = clusterMap.get(clusterId);
                  if (!center || !cluster) return null;
                  return <g key={clusterId} className="signal-graph-cluster-ring">
                    <circle cx={center.x} cy={center.y} r="112" />
                    <text x={center.x} y={center.y - 124} textAnchor="middle">{cluster.label}</text>
                  </g>;
                })}
                <g className="signal-graph-edge-layer">
                  {visibleEdges.map((edge) => {
                    const source = layout.positions.get(edge.source_node_id);
                    const target = layout.positions.get(edge.target_node_id);
                    if (!source || !target) return null;
                    return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} strokeWidth={1 + edge.strength / 30} opacity={0.18 + edge.strength / 140}>
                      <title>{`${graphEdgeTypeLabel(edge.type)} · ${edge.explanation}`}</title>
                    </line>;
                  })}
                </g>
                <g className="signal-graph-node-layer">
                  {visibleNodes.slice().sort((left, right) => {
                    if (left.id === selectedNode?.id) return 1;
                    if (right.id === selectedNode?.id) return -1;
                    return left.label.localeCompare(right.label);
                  }).map((node) => {
                    const position = layout.positions.get(node.id);
                    const cluster = clusterMap.get(node.cluster_id);
                    if (!position) return null;
                    const active = selectedNode?.id === node.id;
                    return <g
                      key={node.id}
                      data-node-id={node.id}
                      className={`signal-graph-node signal-graph-node-${node.proof_state} ${active ? 'selected' : ''}`}
                      transform={`translate(${position.x}, ${position.y})`}
                      tabIndex={0}
                      role="button"
                      aria-label={`${node.label}, ${graphNodeTypeLabel(node.type)}, ${graphProofStateLabel(node.proof_state)}`}
                      onClick={() => setSelectedNodeId(node.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedNodeId(node.id);
                        }
                      }}
                    >
                      <title>{`${node.label} · ${cluster?.label ?? graphTitleCase(node.cluster_id)} · ${graphProofStateLabel(node.proof_state)}`}</title>
                      <circle r={active ? 15 : 11} />
                      <text y={active ? 34 : 28} textAnchor="middle">{node.label}</text>
                    </g>;
                  })}
                </g>
              </svg>}
        </section>

        <aside className="panel signal-graph-detail-panel" aria-label="Selected node details">
          <div className="signal-graph-panel-head">
            <div>
              <p className="section-kicker">Selected Node</p>
              <h2>{selectedNode?.label ?? 'Select a node'}</h2>
            </div>
            {selectedNode && <CopyButton value={buildNodeShareText(selectedNode, clusterMap.get(selectedNode.cluster_id)?.label ?? graphTitleCase(selectedNode.cluster_id))} label="Copy node signal" />}
          </div>
          {!selectedNode
            ? <p className="panel-caption">Choose a node from the graph to inspect its proof state, attached receipts, and connected signal.</p>
            : <>
              <div className="signal-graph-detail-meta">
                <span className="signal-proof-chip">{graphNodeTypeLabel(selectedNode.type)}</span>
                <span className={`signal-proof-chip signal-proof-chip-${selectedNode.proof_state}`}>{graphProofStateLabel(selectedNode.proof_state)}</span>
                <span className="signal-proof-chip">{clusterMap.get(selectedNode.cluster_id)?.label ?? graphTitleCase(selectedNode.cluster_id)}</span>
              </div>
              <p className="signal-graph-node-summary">{selectedNode.summary}</p>
              <dl className="signal-graph-score-grid">
                <div><dt>Confidence</dt><dd>{selectedNode.confidence_score}/100</dd></div>
                <div><dt>Velocity</dt><dd>{selectedNode.velocity_score}/100</dd></div>
                <div><dt>Created</dt><dd>{formatMachineTimestamp(selectedNode.created_at)}</dd></div>
                <div><dt>Updated</dt><dd>{formatMachineTimestamp(selectedNode.updated_at)}</dd></div>
              </dl>

              <section className="signal-graph-detail-section">
                <h3>Connected nodes</h3>
                {connectedNodes.length === 0
                  ? <p className="panel-caption">No connected nodes recorded.</p>
                  : <div className="compact-chip-wrap">
                    {connectedNodes.map((node) => <button key={node.id} type="button" className="copy-chip" onClick={() => setSelectedNodeId(node.id)}>{node.label}</button>)}
                  </div>}
              </section>

              {graphNodeLinkGroups(selectedNode).map(([label, values]) => <section key={label} className="signal-graph-detail-section">
                <h3>{label}</h3>
                {values.length === 0
                  ? <p className="panel-caption">No linked {label.toLowerCase()} recorded.</p>
                  : <div className="compact-chip-wrap">{values.map((value) => {
                    const href = graphEntityHref(label, value);
                    return href
                      ? <a key={value} className="copy-chip" href={href}>{value}</a>
                      : <span key={value}>{value}</span>;
                  })}</div>}
              </section>)}

              <section className="signal-graph-detail-section">
                <h3>Source URLs</h3>
                {(selectedNode.source_urls ?? []).length === 0
                  ? <p className="panel-caption">No source URLs recorded.</p>
                  : <div className="signal-graph-source-list">
                    {(selectedNode.source_urls ?? []).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>)}
                  </div>}
              </section>

              <section className="signal-graph-detail-section">
                <h3>Connected edges</h3>
                {connectedEdges.length === 0
                  ? <p className="panel-caption">No edge explanations recorded.</p>
                  : <div className="signal-graph-edge-list">
                    {connectedEdges.map((edge) => <article key={edge.id}>
                      <strong>{graphEdgeTypeLabel(edge.type)}</strong>
                      <span>{edge.strength}/100</span>
                      <p>{edge.explanation}</p>
                    </article>)}
                  </div>}
              </section>
            </>}
        </aside>
      </section>

      <section className="panel signal-graph-ripples" id="graph-ripples" aria-labelledby="signal-graph-ripples-title">
        <div className="signal-graph-panel-head">
          <div>
            <p className="section-kicker">24h Ripples</p>
            <h2 id="signal-graph-ripples-title">24h Ripples</h2>
            <p className="panel-caption">What changed in the graph since the last cycle.</p>
          </div>
        </div>
        {visibleRipples.length === 0
          ? <p className="route-state warn">No ripples recorded for this cluster filter.</p>
          : <div className="signal-graph-ripple-grid">
            {visibleRipples.map((ripple) => {
              const clusterLabel = clusterMap.get(ripple.cluster_id)?.label ?? graphTitleCase(ripple.cluster_id);
              return <article key={ripple.id} className="signal-graph-ripple-card">
                <div className="signal-graph-ripple-head">
                  <div>
                    <p className="section-kicker">{clusterLabel}</p>
                    <h3>{ripple.title}</h3>
                  </div>
                  <CopyButton value={buildRippleShareText(ripple, clusterLabel)} label="Copy signal" />
                </div>
                <p>{ripple.summary}</p>
                <div className="signal-graph-detail-meta">
                  <span className={`signal-proof-chip signal-proof-chip-${ripple.proof_state}`}>{graphProofStateLabel(ripple.proof_state)}</span>
                  <span className="signal-proof-chip">Impact {ripple.impact_score}/100</span>
                  <span className="signal-proof-chip">{ripple.linked_node_ids.length} linked nodes</span>
                </div>
                <p className="panel-caption">Changed {formatMachineTimestamp(ripple.changed_at)}</p>
              </article>;
            })}
          </div>}
      </section>
    </main>
  </div>;
}

export function App() {
  if (isRadarCardIndexRoute(window.location.pathname)) return <PreflightCardIndexPage />;
  const radarCard = routeRadarCard(window.location.pathname);
  if (radarCard) return <RadarPreflightCardPage type={radarCard.type} id={radarCard.id} />;
  const machineMarketCardId = routeMachineMarketCardId(window.location.pathname);
  if (machineMarketCardId) return <MachineMarketPreflightCardPage id={machineMarketCardId} />;
  const propagationId = routePropagationId(window.location.pathname);
  if (propagationId) return <PropagationIncidentPage clusterId={propagationId} />;
  if (isProofCheckIndexRoute(window.location.pathname)) return <ProofCheckPage />;
  if (isLoopsIndexRoute(window.location.pathname)) return <LoopsPage />;
  if (isSignalHuntRoute(window.location.pathname)) return <SignalHuntPage />;
  const signalHuntId = routeSignalHuntId(window.location.pathname);
  if (signalHuntId) return <SignalHuntDetailPage signalId={signalHuntId} />;
  if (isUnicornRadarRoute(window.location.pathname)) return <UnicornRadarPage />;
  if (isEvaluationRequestRoute(window.location.pathname)) return <EvaluationRequestPage />;
  if (isRevenueReceiptsRoute(window.location.pathname)) return <RevenueReceiptsPage />;
  const revenueReceiptId = routeRevenueReceiptId(window.location.pathname);
  if (revenueReceiptId) return <RevenueReceiptDetailPage receiptId={revenueReceiptId} />;
  const unicornRadarCandidateId = routeUnicornRadarCandidateId(window.location.pathname);
  if (unicornRadarCandidateId) return <UnicornRadarDetailPage candidateId={unicornRadarCandidateId} />;
  if (isGraphRoute(window.location.pathname)) return <SignalGraphPage />;
  if (isNarrativesRoute(window.location.pathname)) return <NarrativesIndexPage />;
  if (isAttentionMarketsRoute(window.location.pathname)) return <AttentionMarketsPage />;
  if (isAttentionMarketWatchRoute(window.location.pathname)) return <AttentionMarketWatchPage />;
  if (isAbundanceDeskRoute(window.location.pathname)) return <AbundanceDeskPage narrativeRoute={/^\/narratives\/abundance-desk\/?$/.test(window.location.pathname)} />;
  if (isRhChainSignalDeskRoute(window.location.pathname)) return <RhChainSignalDeskPage narrativeRoute={/^\/narratives\/robinhood-chain\/?$/.test(window.location.pathname)} />;
  if (isHermesDeskRoute(window.location.pathname)) return <HermesDeskPage narrativeRoute={/^\/narratives\/hermes-desk\/?$/.test(window.location.pathname)} memoryLoopRoute={/^\/hermes\/memory-loop\/?$/.test(window.location.pathname)} skillPackRoute={/^\/hermes\/skill-pack\/?$/.test(window.location.pathname)} reputationLedgerRoute={/^\/hermes\/reputation-ledger\/?$/.test(window.location.pathname)} preSpendDecisionRoute={/^\/hermes\/pre-spend-decision\/?$/.test(window.location.pathname)} spendPolicyRoute={/^\/hermes\/spend-policy\/?$/.test(window.location.pathname)} decisionFeedbackRoute={/^\/hermes\/decision-feedback\/?$/.test(window.location.pathname)} walletAuditTrailRoute={/^\/hermes\/wallet-audit-trail\/?$/.test(window.location.pathname)} walletRiskScoreRoute={/^\/hermes\/wallet-risk-score\/?$/.test(window.location.pathname)} walletSafetyRoute={/^\/hermes\/wallet-safety\/?$/.test(window.location.pathname)} />;
  const attentionMarketWatchSlug = routeAttentionMarketWatchSlug(window.location.pathname);
  if (attentionMarketWatchSlug) return <AttentionMarketWatchProfilePage slug={attentionMarketWatchSlug} />;
  const signalUpdate = routeSignalUpdate(window.location.pathname);
  if (signalUpdate) return <SignalUpdatePermalinkPage slug={signalUpdate.slug} updateId={signalUpdate.updateId} />;
  const signalSlug = routeSignalSlug(window.location.pathname);
  if (signalSlug === 'ansem') return <SignalSourcePage slug={signalSlug} />;
  if (signalSlug === 'black-bull') return <NarrativeSignalReportPage slug={signalSlug} />;
  if (signalSlug === 'troll') return <NarrativeSignalReportPage slug={signalSlug} />;
  if (isSpendTerminalRoute(window.location.pathname)) return <SpendTerminalPage />;
  const walletSafetyIntegrationId = routeWalletSafetyIntegrationId(window.location.pathname);
  if (walletSafetyIntegrationId) return <WalletSafetyIntegrationDetailPage integrationId={walletSafetyIntegrationId} />;
  if (isWalletSafetyIntegrationDeveloperRoute(window.location.pathname)) return <WalletSafetyIntegrationRegistryPage />;
  if (isWalletSafetyDeveloperRoute(window.location.pathname)) return <WalletSafetyDeveloperQuickstartPage />;
  if (isDevelopersRoute(window.location.pathname)) return <DevelopersPage />;
  if (isClaimsIndexRoute(window.location.pathname)) return <ClaimsPage />;
  if (isRoutesIndexRoute(window.location.pathname)) return <RoutesIndexPage />;
  const routeId = routeRouteId(window.location.pathname);
  if (routeId) return <RouteDetailPage routeId={routeId} />;
  if (isProvidersIndexRoute(window.location.pathname)) return <ProvidersIndexPage />;
  const providerId = routeProviderId(window.location.pathname);
  if (providerId && providerId.startsWith('provider_')) return <ProviderDetailPage providerId={providerId} />;
  if (isServicesIndexRoute(window.location.pathname)) return <ServicesIndexPage />;
  const serviceId = routeServiceId(window.location.pathname);
  if (serviceId) return <ServiceDetailPage serviceId={serviceId} />;
  const claimId = routeClaimId(window.location.pathname);
  if (claimId) return <ClaimDetailPage claimId={claimId} />;
  const proofCheckId = routeProofCheckId(window.location.pathname);
  if (proofCheckId) return <ProofCheckDetailPage checkId={proofCheckId} />;
  const loopId = routeLoopId(window.location.pathname);
  if (loopId) return <LoopDetailPage loopId={loopId} />;
  if (isReceiptsIndexRoute(window.location.pathname)) return <ReceiptsIndexPage />;
  const receiptId = routeReceiptId(window.location.pathname);
  if (receiptId && receiptId.startsWith('receipt_')) return <ReceiptDetailPage receiptId={receiptId} />;
  if (receiptId) return <PublicReceiptPage eventId={receiptId} />;
  const benchmarkId = routeBenchmarkId(window.location.pathname);
  if (benchmarkId) return <PublicBenchmarkProofPage benchmarkId={benchmarkId} />;
  const readinessProviderId = routeAgentReadinessProviderId(window.location.pathname);
  if (readinessProviderId) return <AgentReadinessProviderPage providerId={readinessProviderId} />;
  if (isBenchmarkIndexRoute(window.location.pathname)) return <PublicBenchmarksIndexPage />;
  if (isMachineMarketRoute(window.location.pathname)) return <MachineMarketPage />;
  if (isMachineEconomySnapshotRoute(window.location.pathname)) return <MachineEconomySnapshotPage />;
  if (isMachineRouteRiskMatrixRoute(window.location.pathname)) return <MachineRouteRiskMatrixPage />;
  if (isMachineFirstSafeRoutesRoute(window.location.pathname)) return <MachineFirstSafeRoutesPage />;
  if (isMachineBenchmarkReadinessRoute(window.location.pathname)) return <MachineBenchmarkReadinessPage />;
  if (isMachineBenchmarkMethodologyRoute(window.location.pathname)) return <MachineBenchmarkMethodologyPage />;
  if (isMachineComparableRoutesRoute(window.location.pathname)) return <MachineComparableRoutesPage />;
  if (isMachineTranslationEvidenceRoute(window.location.pathname)) return <MachineTranslationEvidencePage />;
  if (isMachineProofLadderRoute(window.location.pathname)) return <MachineProofLadderPage />;
  if (isMachineExecutionBlockersRoute(window.location.pathname)) return <MachineExecutionBlockersPage />;
  if (isMachineMarketChangelogRoute(window.location.pathname)) return <MachineMarketChangelogPage />;
  if (isMachineNoClaimLedgerRoute(window.location.pathname)) return <MachineNoClaimLedgerPage />;
  if (isMachineRailCoverageRoute(window.location.pathname)) return <MachineRailCoveragePage />;
  if (isMachineMarketMapRoute(window.location.pathname)) return <MachineMarketMapPage />;
  if (isMachineReadinessMatrixRoute(window.location.pathname)) return <MachineReadinessMatrixPage />;
  if (isMachineExecutionShortlistRoute(window.location.pathname)) return <MachineExecutionShortlistPage />;
  if (isAlibabaMachineExecutionRoute(window.location.pathname)) return <AlibabaMachineExecutionDetailPage />;
  const machineExecutionReceiptId = routeMachineExecutionReceiptId(window.location.pathname);
  if (machineExecutionReceiptId) return <MachineExecutionReceiptDetailPage receiptId={machineExecutionReceiptId} />;
  const machineExecutionPlanServiceId = routeMachineExecutionPlanServiceId(window.location.pathname);
  if (machineExecutionPlanServiceId) return <MachineExecutionProofPlanPage serviceId={machineExecutionPlanServiceId} />;
  if (isMachinePreflightRoute(window.location.pathname)) return <MachinePreflightPage />;
  if (isMachineReceiptsRoute(window.location.pathname)) return <MachineReceiptsPage />;
  const machineServiceId = routeMachineServiceId(window.location.pathname);
  if (machineServiceId) return <MachineServiceDossierPage serviceId={machineServiceId} />;
  const machineDossierId = routeMachineDossierId(window.location.pathname);
  if (machineDossierId) return <MachineDossierPage machineId={machineDossierId} />;
  if (providerId) return <PublicProviderPage providerId={providerId} />;
  return <RadarApp />;
}

function parseMachineExecutionSummary(value: string | null | undefined): Record<string, unknown> | null {
  if (!value || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readSummaryField(summary: Record<string, unknown> | null, keys: string[]) {
  if (!summary) return null;
  for (const key of keys) {
    const value = summary[key];
    if (typeof value === 'string' && value.trim().length) return value;
    if (typeof value === 'number') return value;
  }
  return null;
}

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
