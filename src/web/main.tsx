import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MethodologyDrawer } from './methodology';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
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
type DataSource = { mode: 'live_pay_sh_catalog' | 'fixture_fallback'; url: string | null; generated_at: string | null; provider_count: number | null; last_ingested_at: string | null; used_fixture: boolean; error?: string | null };
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
  next_step: string;
  readiness_note: string;
  routes: RadarBenchmarkRouteMetric[];
};
type RadarBenchmarkRegistry = {
  generated_at: string;
  source: string;
  benchmarks: RadarBenchmarkDetail[];
};
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
const API_TIMEOUT_MS = 8_000;
const CRITICAL_PULSE_TIMEOUT_MS = 10_000;
const DOSSIER_INTERACTION_HOLD_MS = 20_000;
const ROUTE_INTERACTION_HOLD_MS = 60_000;
const OPENAPI_PATH = '/openapi.json';
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

function routeReceiptId(pathname: string) {
  const match = pathname.match(/^\/receipts\/([^/]+)\/?$/);
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
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [featuredRotationEnabled, setFeaturedRotationEnabled] = useState(true);
  const [selectionMode, setSelectionMode] = useState<'auto' | 'manual'>('auto');
  const [featuredProvider, setFeaturedProvider] = useState<FeaturedProvider | null>(null);
  const [nextRotationAt, setNextRotationAt] = useState<number | null>(null);
  const [rotationNow, setRotationNow] = useState(() => Date.now());
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
      void Promise.allSettled([
        api<{ data: Provider[] }>('/v1/providers'),
        api<{ data: Narrative[] }>('/v1/narratives'),
        api<{ data: { nodes: unknown[]; edges: unknown[] } }>('/v1/graph'),
        api<{ data: PulseSummary }>('/v1/pulse/summary'),
        api<{ data: FeaturedProvider }>('/v1/providers/featured'),
        api<{ data: { endpoints?: NormalizedEndpointRecord[] } }>('/v1/radar/endpoints'),
        api<{ data: RadarSuperiorityReadiness }>('/v1/radar/superiority-readiness'),
        api<{ data: RadarBenchmarkReadiness }>('/v1/radar/benchmark-readiness'),
        api<{ data: RadarBenchmarkRegistry }>('/v1/radar/benchmarks'),
        api<{ data: RadarEcosystemHistory }>('/v1/radar/history/ecosystem?window=24h'),
        api<{ data: RadarEcosystemRiskSummary }>('/v1/radar/risk/ecosystem')
      ]).then((results) => {
        if (!active) return;
        const diagnostics = results.flatMap((result, index) => {
          if (result.status === 'fulfilled') return [];
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
          const endpoint = endpointByIndex[index] ?? 'unknown';
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
          results[0].status === 'fulfilled' ? '/v1/providers' : null,
          results[1].status === 'fulfilled' ? '/v1/narratives' : null,
          results[2].status === 'fulfilled' ? '/v1/graph' : null,
          results[3].status === 'fulfilled' ? '/v1/pulse/summary' : null,
          results[4].status === 'fulfilled' ? '/v1/providers/featured' : null,
          results[5].status === 'fulfilled' ? '/v1/radar/endpoints' : null,
          results[6].status === 'fulfilled' ? '/v1/radar/superiority-readiness' : null,
          results[7].status === 'fulfilled' ? '/v1/radar/benchmark-readiness' : null,
          results[8].status === 'fulfilled' ? '/v1/radar/benchmarks' : null,
          results[9].status === 'fulfilled' ? '/v1/radar/history/ecosystem?window=24h' : null,
          results[10].status === 'fulfilled' ? '/v1/radar/risk/ecosystem' : null
        ].filter(Boolean) as string[];
        if (diagnostics.length) {
          setStartupDiagnostics((current) => mergeStartupDiagnostics(current, diagnostics, ['/v1/pulse', ...recovered]));
          setSecondaryLoadWarning('Radar live. Some enrichment panels failed to load.');
        } else {
          setStartupDiagnostics((current) => mergeStartupDiagnostics(current, [], ['/v1/pulse', ...recovered]));
          setSecondaryLoadWarning(null);
        }
        const providers = results[0].status === 'fulfilled' && Array.isArray(results[0].value?.data) ? results[0].value.data : null;
        const narratives = results[1].status === 'fulfilled' && Array.isArray(results[1].value?.data) ? results[1].value.data : null;
        const graphRaw = results[2].status === 'fulfilled' && isRecord(results[2].value?.data) ? results[2].value.data : null;
        const summary = results[3].status === 'fulfilled' ? toPulseSummary(results[3].value?.data) : null;
        const featured = results[4].status === 'fulfilled' ? results[4].value.data : null;
        const normalizedEndpoints = results[5].status === 'fulfilled' && Array.isArray(results[5].value?.data?.endpoints) ? results[5].value.data.endpoints : null;
        const readinessPayload = results[6].status === 'fulfilled' ? results[6].value?.data ?? null : null;
        const benchmarkReadinessPayload = results[7].status === 'fulfilled' ? results[7].value?.data ?? null : null;
        const benchmarkRegistryPayload = results[8].status === 'fulfilled' ? results[8].value?.data ?? null : null;
        const ecosystemHistoryPayload = results[9].status === 'fulfilled' ? results[9].value?.data ?? null : null;
        const ecosystemRiskPayload = results[10].status === 'fulfilled' ? results[10].value?.data ?? null : null;
        setData((current) => current ? {
          ...current,
          providers: providers ?? current.providers,
          narratives: narratives ?? current.narratives,
          graph: graphRaw && Array.isArray(graphRaw.nodes) && Array.isArray(graphRaw.edges) ? graphRaw as AppData['graph'] : current.graph
        } : current);
        if (summary) setPulseSummary(summary);
        if (normalizedEndpoints) setRadarEndpoints(normalizedEndpoints);
        if (readinessPayload) setReadiness(readinessPayload);
        if (benchmarkReadinessPayload) setBenchmarkReadiness(benchmarkReadinessPayload);
        if (benchmarkRegistryPayload) setBenchmarkRegistry(benchmarkRegistryPayload);
        if (ecosystemHistoryPayload) setEcosystemHistory(ecosystemHistoryPayload);
        if (ecosystemRiskPayload) setEcosystemRisk(ecosystemRiskPayload);
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
        if (providers?.length) {
          void Promise.allSettled(providers.slice(0, 120).map((provider) => api<{ data: RadarRiskResponse }>(`/v1/radar/risk/providers/${provider.id}`)))
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
      });
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
        setSecondaryLoadWarning('Radar stale: showing last successful live data.');
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
          api<{ data: PulseSummary }>('/v1/pulse/summary'),
          api<{ data: FeaturedProvider }>('/v1/providers/featured'),
          api<{ data: RadarEcosystemRiskSummary }>('/v1/radar/risk/ecosystem')
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
          setSecondaryLoadWarning('Radar live. Some enrichment panels failed to load.');
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
          setSecondaryLoadWarning('Radar stale: showing last successful live data.');
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
  const nextRotationLabel = featuredRotationEnabled && selectionMode === 'auto' && nextRotationAt ? formatRotationCountdown(nextRotationAt - rotationNow) : 'paused';
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
    const timer = window.setInterval(() => {
      const now = Date.now();
      setRotationNow(now);
      if (featuredRotationEnabledRef.current && selectionModeRef.current === 'auto' && nextRotationAt && now >= nextRotationAt) {
        void fetchFeaturedProvider();
      }
    }, 1_000);
    return () => window.clearInterval(timer);
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

  const commandActions = useMemo<CommandPaletteAction[]>(() => [
    { id: 'focus-search', label: 'Focus Semantic Search', hint: 'Jump to ecosystem search input', run: focusSemanticSearch },
    { id: 'open-preflight', label: 'Open Agent Preflight', hint: 'Jump to agent preflight panel', run: () => scrollToPanel('preflight') },
    { id: 'open-compare', label: 'Open Compare', hint: 'Jump to provider/endpoint comparison', run: () => scrollToPanel('compare') },
    { id: 'open-cost', label: 'Open Cost / Performance', hint: 'Jump to cost and performance intelligence', run: () => scrollToPanel('cost-performance') },
    { id: 'open-benchmark', label: 'Open Benchmark Readiness', hint: 'Jump to benchmark readiness', run: () => scrollToPanel('benchmark-readiness') },
    { id: 'open-api-docs', label: 'Open API Docs', hint: OPENAPI_PATH, run: openApiDocs },
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

  return <div className={`shell ${agentMode ? 'agent-mode-shell' : ''} density-${densityMode}`}>
    <a className="skip-link" href="#terminal-content">Skip to content</a>
    <header className="site-header">
      <nav className="global-toolbar" aria-label="Global controls">
        <a className="nav-brand" href="#terminal-content" aria-label="Infopunks Pay.sh Radar home">
          <span>Infopunks</span>
          <strong>Pay.sh Radar</strong>
        </a>
        <div className="terminal-nav" aria-label="Radar zones">
          {[
            ['global-pulse', 'Global Pulse'],
            ['leaderboards', 'Leaderboards'],
            ['providers', 'Directory'],
            ['endpoints', 'Endpoints'],
            ['preflight', 'Preflight'],
            ['compare', 'Compare'],
            ['dossier', 'Dossier'],
            ['events', 'Events']
          ].map(([id, label]) => <a key={id} href={`#${id}`} className={activeSection === id ? 'active' : ''} aria-current={activeSection === id ? 'location' : undefined}>{label}</a>)}
        </div>
        <div className="terminal-actions" aria-label="Utility actions">
          <button className="methodology-trigger command-trigger" type="button" onClick={() => setCommandPaletteOpen(true)} aria-label="Open command palette">
            Cmd+K
          </button>
          <a className="methodology-trigger api-docs-link" href={toApiUrl(API_BASE_URL, OPENAPI_PATH)} target="_blank" rel="noreferrer">
            API Docs
          </a>
          <button className={`methodology-trigger ${agentMode ? 'active' : ''}`} type="button" aria-pressed={agentMode} onClick={() => setAgentMode((value) => !value)}>
            Agent Mode
          </button>
          <button className="methodology-trigger density-trigger" type="button" onClick={() => setDensityMode((value) => value === 'comfortable' ? 'dense' : 'comfortable')} aria-label="Toggle terminal density">
            {densityMode === 'comfortable' ? 'Terminal Comfortable' : 'Terminal Dense'}
          </button>
          <button className="methodology-trigger methodology-link" type="button" onClick={() => setMethodologyOpen(true)} aria-label="Open methodology drawer">
            Methodology
          </button>
        </div>
      </nav>
    </header>
    <CommandPalette open={commandPaletteOpen} commands={commandActions} onClose={() => setCommandPaletteOpen(false)} />
    <MethodologyDrawer open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />

    <main id="terminal-content">
    {bootError && <section className="panel" role="status" aria-live="polite">
      <p className="route-state error">{bootError}</p>
      <button className="execute compact secondary" type="button" onClick={() => window.location.reload()}>Retry</button>
    </section>}
    {!bootError && secondaryLoadWarning && <section className="panel" role="status" aria-live="polite">
      <p className="route-state warn">{secondaryLoadWarning}</p>
    </section>}
    {!!startupDiagnostics.length && <section className="panel" role="status" aria-live="polite">
      {agentMode && !activeCriticalFailure && <p className="route-state warn">Live with partial enrichment</p>}
      {recoveredCritical && !activeCriticalFailure && <p className="route-state">Startup recovered after retry.</p>}
      <details>
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
      {!agentMode && activeSecondaryFailures.length > 0 && <p className="route-state warn">Radar live. Some enrichment panels failed to load.</p>}
    </section>}
    {agentMode && <AgentModeBanner onExit={() => setAgentMode(false)} onOpenApiDocs={openApiDocs} />}
    {!agentMode && <section className="hero panel mission-control" aria-labelledby="terminal-title">
      <div>
        <p className="eyebrow">Infopunks Intelligence Terminal</p>
        <h1 id="terminal-title">Cognitive Coordination Layer for the Pay.sh agent economy.</h1>
        <p className="mission-subtitle">Routing intelligence for the Pay.sh agent economy.</p>
        <p className="copy">Pay.sh lets agents pay. Infopunks tells them who to trust before they do.</p>
        <div className="source-stack">
          <span className={`source-badge ${data.pulse.data_source.mode}`}>{data.pulse.data_source.mode === 'live_pay_sh_catalog' ? 'LIVE PAY.SH CATALOG' : 'FIXTURE FALLBACK'}</span>
          <small className="source-line">{formatDataSource(data.pulse.data_source, data.pulse.providerCount, data.pulse.endpointCount)}</small>
        </div>
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

    <div id="global-pulse" className="anchor-target" />
    <EcosystemStatusPanel status={ecosystemStatus} reading={ecosystemReading} pulse={data.pulse} summary={pulseSummary} selectedProvider={selectedProvider} />

    <section className="ecosystem-layout" aria-label="Global intelligence layout">
      <div className="ecosystem-main">
        <section className="zone zone-ecosystem" aria-labelledby="ecosystem-zone-title">
          <ZoneHeader eyebrow="ZONE A" title="ECOSYSTEM INTELLIGENCE" subtitle="Realtime machine economy observability" helper="Start here: global status, interpretation, pulse feed, and cross-provider movement before drilling into a provider." scope="GLOBAL" />

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
          <CostPerformancePanel endpoints={radarEndpoints} providerRiskById={providerRiskById} benchmarkReadiness={benchmarkReadiness} />
          <BenchmarkReadinessPanel readiness={benchmarkReadiness} />
          <HeadToHeadBenchmarkPanel registry={benchmarkRegistry} />
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
              <small>{selectionMode === 'manual' ? 'Paused by manual selection' : `Next provider in ${nextRotationLabel}`}</small>
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
                        <option value="highest_trust">highest trust</option>
                        <option value="cheapest">cheapest</option>
                        <option value="highest_signal">highest signal</option>
                      </select>
                    </label>
                  </div>
                  <label className="route-check">
                    <input type="checkbox" checked={includeSelectedProvider} aria-label="Include selected provider as preferred route input" onChange={(event) => setIncludeSelectedProvider(event.target.checked)} />
                    <span>include selected provider as preferred route input</span>
                  </label>
                  <div className="route-actions">
                    <button className="execute compact route-primary-action" type="button" onClick={runRoute} disabled={routeStatus === 'loading'}>{routeStatus === 'loading' ? 'computing route...' : 'compute recommended route'}</button>
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

      {pulseSummary && <aside className="ecosystem-rail" aria-label="Realtime ecosystem intelligence sidebar">
        {!agentMode && <div className="panel counter-grid scoped-panel rail-priority">
          <ScopeLabel scope="GLOBAL" />
          <PulseStat label="Events" value={pulseSummary.counters.events} sub={`${pulseSummary.counters.unknownTelemetry} unknown telemetry fields`} />
          <PulseStat label="Providers" value={pulseSummary.counters.providers} sub={`${pulseSummary.counters.endpoints} endpoints tracked`} />
          {pulseSummary.eventGroups.monitoring.count > 0 && <PulseStat label="Monitor" value={pulseSummary.eventGroups.monitoring.count} sub="safe service reachability events" />}
        </div>}
        {!agentMode && <PropagationWatch propagation={pulseSummary.propagation} />}
        <AnomalyWatchPanel ecosystemRisk={ecosystemRisk} providers={safeProviders} endpoints={radarEndpoints} />
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
        <p className="panel-caption">Ask Radar where an agent should route before spending. This checks catalog intelligence only and does not execute paid APIs.</p>
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
    {!result && status !== 'loading' && !error && <EmptyState title="No preflight decision yet." body="Ask Radar where an agent should route before spending." />}
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
  const statement = !readiness || readiness.executable_provider_mappings_count <= 1
    ? 'Repeatability evidence available. Superiority evidence not yet available.'
    : readiness.categories_with_at_least_two_executable_mappings.length
      ? 'Two proven executable routes exist. Head-to-head benchmark comparison can begin.'
      : 'Superiority evidence not yet available.';
  return <section className="panel superiority-readiness" aria-label="Superiority Proof Readiness panel">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Superiority Proof Readiness</h2>
    </div>
    <p className="route-state">{statement}</p>
    <p className="panel-caption">Superiority readiness requires at least two proven executable mappings for the same benchmark intent.</p>
    {readiness && <p className="panel-caption">No route winner is claimed until normalized metrics are recorded.</p>}
    {!readiness && <EmptyState title="Benchmark not ready." body="Readiness data is unavailable. Refresh once catalog history loads." />}
    {readiness && <>
      {readiness.executable_provider_mappings_count === 0 && <p className="route-state warn">No executable provider mappings detected yet. Add comparable mappings before claiming superiority.</p>}
      <div className="readiness-metric">
        <span>executable provider mappings</span>
        <strong>{readiness.executable_provider_mappings_count}</strong>
      </div>
      <details className="superiority-details">
        <summary>Superiority Proof Details</summary>
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
  benchmarkReadiness
}: {
  endpoints: NormalizedEndpointRecord[];
  providerRiskById: Record<string, RadarRiskResponse>;
  benchmarkReadiness: RadarBenchmarkReadiness | null;
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
      {!rows.length && <EmptyState title="Pricing unknown." body="No endpoint cost records are available yet. Load endpoint exports or check catalog freshness." />}
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

function BenchmarkReadinessPanel({ readiness }: { readiness: RadarBenchmarkReadiness | null }) {
  const oneProvenRow = readiness?.categories.find((row) => row.proven_execution_count === 1 && !row.benchmark_ready) ?? null;
  const twoProvenRow = readiness?.categories.find((row) => row.proven_execution_count >= 2 && row.benchmark_ready) ?? null;
  return <section className="panel superiority-readiness" id="benchmark-readiness" aria-label="Benchmark Readiness panel">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Benchmark Readiness</h2>
    </div>
    <p className="panel-caption">"Benchmark ready" means routes are comparable. "Superiority ready" requires stronger execution evidence. "Catalog-estimated" is not execution-proven.</p>
    {!readiness && <EmptyState title="Benchmark not ready." body="Readiness data is unavailable. Refresh once catalog history loads." />}
    {readiness && <div className="readiness-list-grid">
      <CompactChipList title="ready categories" items={readiness.benchmark_ready_categories} emptyLabel="none" />
      <CompactChipList title="not ready categories" items={readiness.not_ready_categories} emptyLabel="none" />
      <CompactChipList title="superiority ready categories" items={readiness.superiority_ready_categories} emptyLabel="none" />
      <CompactChipList title="next mappings needed" items={readiness.recommended_next_mappings} emptyLabel="none" wide />
      <CompactChipList title="mapped benchmark intents" items={readiness.categories.map((row) => `${row.category}/${row.benchmark_intent}`)} emptyLabel="none" wide />
      <CompactChipList title="mapping ladder state" items={readiness.categories.flatMap((row) => row.mapping_ladder)} emptyLabel="none" wide />
      {oneProvenRow && <p className="panel-caption">One proven route exists. Add one comparable route to unlock benchmark readiness.</p>}
      {twoProvenRow && <p className="panel-caption">Two proven executable routes exist. Benchmark comparison can begin.</p>}
      {twoProvenRow && <p className="panel-caption">No route winner is claimed until normalized head-to-head metrics are recorded.</p>}
    </div>}
  </section>;
}

function HeadToHeadBenchmarkPanel({ registry }: { registry: RadarBenchmarkRegistry | null }) {
  const benchmark = registry?.benchmarks.find((row) => row.benchmark_id === 'finance-data-sol-price') ?? null;
  return <section className="panel superiority-readiness" aria-label="Head-to-Head Benchmark panel">
    <div className="phase3-panel-head">
      <ScopeLabel scope="GLOBAL" />
      <h2>Head-to-Head Benchmark</h2>
    </div>
    {!benchmark && <EmptyState title="Benchmark pending." body="Head-to-head benchmark data is unavailable." />}
    {benchmark && <>
      <p className="panel-caption">{benchmark.category}/{benchmark.benchmark_intent}</p>
      <p className="panel-caption">Two proven executable routes exist. Head-to-head benchmark comparison can begin.</p>
      <p className="panel-caption">{benchmark.benchmark_recorded ? 'Live benchmark recorded.' : 'Output shapes shown are schema examples. Normalized prices are pending.'}</p>
      <p className="panel-caption">No route winner is claimed.</p>
      <p className="panel-caption">HTTP status was not exposed by pay_cli; success is supported by CLI exit code 0 and parsed response body.</p>
      {benchmark.benchmark_recorded && <p className="panel-caption">Price difference recorded. No winner claimed.</p>}
      {!benchmark.benchmark_recorded && <p className="route-state warn">Metrics pending. Next step: {benchmark.next_step}.</p>}
      <div className="readiness-list-grid">
        <CompactChipList title="proven routes" items={benchmark.routes.map((route) => route.provider_id)} emptyLabel="missing" />
        <CompactChipList title="proof references" items={benchmark.routes.map((route) => route.proof_reference)} emptyLabel="missing" wide />
        <CompactChipList title="normalization state" items={benchmark.routes.map((route) => `${route.provider_id}: ${route.normalized_output_available ? 'normalized' : 'metrics pending'}`)} emptyLabel="missing" wide />
        <CompactChipList title="status evidence" items={benchmark.routes.map((route) => `${route.provider_id}: ${route.status_evidence ?? 'missing status evidence'}`)} emptyLabel="missing" wide />
      </div>
    </>}
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

function AnomalyWatchPanel({ ecosystemRisk, providers, endpoints }: { ecosystemRisk: RadarEcosystemRiskSummary | null; providers: Provider[]; endpoints: NormalizedEndpointRecord[] }) {
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
        <p className="section-kicker">Predictive Risk</p>
        <h2>Anomaly Watch</h2>
        <p className="panel-caption">Advisory anomalies from historical snapshots, monitor runs, and event logs. No paid APIs are executed.</p>
      </div>
      <PredictiveRiskBadge risk={toRiskContext(ecosystemRisk)} />
    </div>
    {ecosystemRisk?.summary?.stale_catalog_warning && <p className="route-state warn">{ecosystemRisk.summary.stale_catalog_warning}</p>}
    {!!ecosystemRisk && <div className="anomaly-summary" aria-label="Predictive risk summary counts">
      <span aria-label={`low ${ecosystemRisk.summary.providers_by_risk_level.low}`}><b>low</b>{ecosystemRisk.summary.providers_by_risk_level.low}</span>
      <span aria-label={`watch ${ecosystemRisk.summary.providers_by_risk_level.watch}`}><b>watch</b>{ecosystemRisk.summary.providers_by_risk_level.watch}</span>
      <span aria-label={`elevated ${ecosystemRisk.summary.providers_by_risk_level.elevated}`}><b>elevated</b>{ecosystemRisk.summary.providers_by_risk_level.elevated}</span>
      <span aria-label={`critical ${ecosystemRisk.summary.providers_by_risk_level.critical}`}><b>critical</b>{ecosystemRisk.summary.providers_by_risk_level.critical}</span>
      <span aria-label={`unknown ${ecosystemRisk.summary.providers_by_risk_level.unknown}`}><b>unknown</b>{ecosystemRisk.summary.providers_by_risk_level.unknown}</span>
    </div>}
    {!watch.length && <EmptyState title="No anomalies detected." body="No current predictive-risk anomaly requires attention." />}
    {!!watch.length && <>
      <div id="anomaly-watch-list" className={`anomaly-list ${showAll ? 'expanded' : ''}`} aria-label={showAll ? 'All predictive risk anomalies' : 'Top predictive risk anomalies'}>
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
        <span>recommended route</span>
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
      {selectedMiss && <p className="route-state warn">Selected provider was not top route because: {selectedMiss}</p>}
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
        : <p>No unknown telemetry warning was emitted for this recommended route.</p>}
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
    console.warn('[radar-render:pricing] malformed pricing payload, using unknown');
    return 'unknown';
  }
  const safeRange = getSafeRange(price, { min: -1, max: -1 });
  const hasNumericRange = Number.isFinite(price.min) && Number.isFinite(price.max);
  if (!hasNumericRange) {
    if (typeof price.raw === 'string' && price.raw.trim()) return price.raw;
    console.warn('[radar-render:pricing] missing price range min/max, using unknown');
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
      label: pulse.data_source.used_fixture ? 'Fallback data mode' : 'Elevated ecosystem watch',
      detail: pulse.data_source.used_fixture
        ? 'Live catalog was unavailable, so the radar is preserving the visible fixture fallback state.'
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

function formatRotationCountdown(valueMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
  return source.mode === 'live_pay_sh_catalog' && !source.used_fixture ? 'LIVE PAY.SH CATALOG' : 'FIXTURE FALLBACK';
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

export function App() {
  const propagationId = routePropagationId(window.location.pathname);
  if (propagationId) return <PropagationIncidentPage clusterId={propagationId} />;
  const receiptId = routeReceiptId(window.location.pathname);
  if (receiptId) return <PublicReceiptPage eventId={receiptId} />;
  const providerId = routeProviderId(window.location.pathname);
  if (providerId) return <PublicProviderPage providerId={providerId} />;
  return <RadarApp />;
}

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<AppErrorBoundary><App /></AppErrorBoundary>);
