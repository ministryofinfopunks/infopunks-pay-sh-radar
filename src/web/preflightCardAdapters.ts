import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

export type PreflightCardState =
  | 'ALLOW'
  | 'REVIEW'
  | 'DENY'
  | 'NO_WINNER'
  | 'READY_FOR_INSPECTION'
  | 'PROOF_PLAN_READY'
  | 'CATALOG_ONLY'
  | 'NEEDS_EVIDENCE';

export type PreflightCardType = 'provider' | 'route' | 'benchmark' | 'artifact' | 'machine-service';

export type PreflightCardViewModel = {
  id: string;
  type: PreflightCardType;
  title: string;
  subtitle?: string;
  state: PreflightCardState;
  verdict: string;
  evidenceCount?: number;
  caveatCount?: number;
  latestArtifactId?: string;
  latestReceiptId?: string;
  trustScore?: number;
  signalScore?: number;
  benchmarkState?: string;
  readiness?: string;
  policyState?: string;
  guidance: string;
  canonicalPath: string;
  sourcePath?: string;
  tweetText: string;
  agentJson: Record<string, unknown>;
};

type ProviderIntelligenceResponse = {
  provider: {
    id: string;
    name: string;
    category: string;
    description?: string | null;
  };
  latest_trust_score: number | null;
  latest_signal_score: number | null;
  risk_level: string;
  recent_changes: Array<{ id: string }>;
  endpoint_count: number;
  endpoint_health: {
    healthy: number;
    degraded: number;
    failed: number;
    unknown: number;
    recent_failures: Array<{ id: string }>;
  };
  service_monitor: {
    status: 'reachable' | 'degraded' | 'failed' | 'unknown';
  };
  severity: 'critical' | 'warning' | 'informational' | 'unknown';
  severity_reason: string;
};

type RadarBenchmarkDetail = {
  benchmark_id: string;
  category: string;
  benchmark_intent: string;
  benchmark_recorded: boolean;
  winner_claimed: boolean;
  winner_status?: string;
  next_step: string;
  readiness_note: string;
  routes: Array<{
    provider_id: string;
    route_id: string;
    execution_status: 'verified' | 'proven';
    paid_execution_proven: boolean;
    comparison_notes: string;
  }>;
};

type RadarBenchmarkRegistry = {
  benchmarks: RadarBenchmarkDetail[];
};

type RadarBenchmarkHistory = {
  benchmark_id: string;
  entries: Array<{
    routes: Array<{
      route_id: string;
      provider_id: string;
      comparison_notes: string;
    }>;
  }>;
  artifact_count?: number;
  latest_artifact_id?: string;
  total_recorded_runs?: number;
  winner_claimed?: boolean;
  winner_status?: string;
};

type RadarRouteHistoryAggregate = {
  benchmark_id: string;
  label: string;
  route_count: number;
  artifact_count: number;
  winner_claimed: boolean;
  routes: Array<{
    route_id: string;
    provider_id: string;
    label: string;
    artifact_count: number;
    latest_artifact_id: string;
    latest_success_count: number | null;
    winner_status: string;
    winner_claimed: boolean;
    evidence_health: string;
    caveats: string[];
  }>;
};

type BenchmarkArtifact = {
  artifact_id: string;
  benchmark_id: string;
  generated_at: string;
  total_runs: number;
  winner_claimed: boolean;
  winner_status: string;
  routes: Array<{
    provider_id: string;
    route_id: string;
    execution_status: string;
    paid_execution_proven: boolean;
    comparison_notes: string;
  }>;
  notes: string;
};

type MachineMarketService = {
  id: string;
  name: string;
  provider: string;
  category: string;
  source_market: string;
  chain: string;
  status: string;
  description: string;
  evidence_health: string;
  evidence_stage: string;
  policy_risk: string;
  caveats: string[];
  rail_status: 'plan_eligible' | 'review_required' | 'proof_plan_selected' | 'not_recorded';
  route_surface_status: string;
};

type MachinePreflightReceipt = {
  receipt_id: string;
  receipt_type: 'machine_preflight' | 'machine_execution';
  selected_service_id: string | null;
  execution_service_id: string | null;
  decision: 'allow' | 'review' | 'deny';
  evidence_stage: string | null;
  execution_occurred: boolean;
  execution_status: string;
  caveats: string[];
  review_reasons: string[];
  violations: string[];
  created_at: string;
};

const API_BASE_URL = getApiBaseUrl();
const PUBLIC_HOST = 'https://radar.infopunks.fun';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  const body = await response.json() as { data: T };
  return body.data;
}

export function canonicalUrl(path: string) {
  return `${PUBLIC_HOST}${path}`;
}

export async function loadRadarPreflightCard(type: Exclude<PreflightCardType, 'machine-service'>, id: string): Promise<PreflightCardViewModel | null> {
  if (type === 'provider') return buildProviderCard(id);
  if (type === 'benchmark') return buildBenchmarkCard(id);
  if (type === 'artifact') return buildArtifactCard(id);
  return buildRouteCard(id);
}

export async function loadMachineServicePreflightCard(id: string): Promise<PreflightCardViewModel | null> {
  const servicesResponse = await api<{ count: number; services: MachineMarketService[] }>('/v1/machine-market/services');
  const service = servicesResponse.services.find((item) => item.id === id) ?? null;
  if (!service) return null;
  const receiptsResponse = await api<{ count: number; receipts: MachinePreflightReceipt[] }>(`/v1/machine-preflight/receipts/recent?service_id=${encodeURIComponent(id)}&limit=25`).catch(() => ({ count: 0, receipts: [] }));
  const receipts = receiptsResponse.receipts.filter((item) => item.selected_service_id === id || item.execution_service_id === id);
  const latestReceipt = receipts[0] ?? null;
  const executionReceipt = receipts.find((item) => item.receipt_type === 'machine_execution' && item.execution_service_id === id) ?? null;
  const caveatCount = uniqueCount([
    ...service.caveats,
    ...receipts.flatMap((item) => [...item.caveats, ...item.review_reasons, ...item.violations])
  ]);
  const state = deriveMachineServiceState(service, latestReceipt, executionReceipt);
  const verdict = machineServiceVerdict(service, state, latestReceipt, executionReceipt);
  const canonicalPath = `/machine-market/cards/${encodeURIComponent(id)}`;
  const readiness = service.evidence_stage;
  const policyState = latestReceipt?.decision ?? (service.rail_status === 'review_required' ? 'review' : service.rail_status === 'proof_plan_selected' ? 'proof_plan_selected' : undefined);
  const guidance = state === 'PROOF_PLAN_READY'
    ? 'planning only · no execution claim.'
    : executionReceipt
      ? 'Service-specific receipt exists. Inspect scope and caveats before spend.'
      : service.evidence_stage === 'policy-mapped'
        ? 'Visible market service with policy mapping only. Do not infer execution.'
        : 'No service-specific receipt recorded yet.';
  const tweetText = [
    'My agent checked Infopunks before spending.',
    `Machine route: ${service.name}`,
    `State: ${formatStateLabel(state)}`,
    executionReceipt ? 'Evidence: service receipt recorded' : 'Evidence: planning only',
    service.caveats.length ? 'Caveats: open' : 'Caveats: minimal',
    '',
    'machines should not spend blind',
    canonicalUrl(canonicalPath)
  ].join('\n');
  return {
    id,
    type: 'machine-service',
    title: service.name,
    subtitle: `${service.provider} · ${service.category}`,
    state,
    verdict,
    evidenceCount: receipts.length || 0,
    caveatCount,
    latestReceiptId: latestReceipt?.receipt_id ?? undefined,
    benchmarkState: executionReceipt ? 'execution-observed' : undefined,
    readiness,
    policyState,
    guidance,
    canonicalPath,
    sourcePath: `/machine-service/${encodeURIComponent(id)}`,
    tweetText,
    agentJson: {
      id,
      type: 'machine-service',
      state,
      verdict,
      canonicalPath,
      readiness,
      policyState,
      latestReceiptId: latestReceipt?.receipt_id ?? null,
      evidenceCount: receipts.length,
      caveatCount
    }
  };
}

async function buildProviderCard(id: string): Promise<PreflightCardViewModel | null> {
  const intel = await api<ProviderIntelligenceResponse>(`/v1/providers/${encodeURIComponent(id)}/intelligence`).catch(() => null);
  if (!intel) return null;
  const evidenceCount = intel.recent_changes.length + intel.endpoint_count;
  const caveatCount = intel.endpoint_health.degraded + intel.endpoint_health.failed + intel.endpoint_health.recent_failures.length;
  const state = deriveProviderState(intel);
  const canonicalPath = `/radar/cards/provider/${encodeURIComponent(id)}`;
  const verdict = providerVerdict(intel, state);
  const tweetText = [
    'My agent checked Infopunks before spending.',
    `Provider: ${intel.provider.name}`,
    `State: ${formatStateLabel(state)}`,
    evidenceCount ? 'Evidence: recorded' : 'Evidence: thin',
    caveatCount ? 'Caveats: open' : 'Caveats: minimal',
    '',
    'autonomous markets need receipts, not vibes',
    canonicalUrl(canonicalPath)
  ].join('\n');
  return {
    id,
    type: 'provider',
    title: intel.provider.name,
    subtitle: intel.provider.category,
    state,
    verdict,
    evidenceCount,
    caveatCount,
    trustScore: scoreOrUndefined(intel.latest_trust_score),
    signalScore: scoreOrUndefined(intel.latest_signal_score),
    readiness: intel.service_monitor.status,
    guidance: state === 'ALLOW'
      ? 'Provider has usable evidence, but agents should still inspect caveats before spend.'
      : state === 'REVIEW'
        ? 'Review route health and provider changes before using this provider.'
        : state === 'DENY'
          ? 'Provider has degraded or failed evidence. Avoid autonomous spend here.'
          : 'Provider remains catalog-visible but evidence is incomplete.',
    canonicalPath,
    sourcePath: `/providers/${encodeURIComponent(id)}`,
    tweetText,
    agentJson: {
      id,
      type: 'provider',
      state,
      verdict,
      canonicalPath,
      trustScore: intel.latest_trust_score,
      signalScore: intel.latest_signal_score,
      evidenceCount,
      caveatCount
    }
  };
}

async function buildBenchmarkCard(id: string): Promise<PreflightCardViewModel | null> {
  const [benchmark, history] = await Promise.all([
    api<RadarBenchmarkDetail>(`/v1/radar/benchmarks/${encodeURIComponent(id)}`).catch(() => null),
    api<RadarBenchmarkHistory>(`/v1/radar/benchmarks/${encodeURIComponent(id)}/history`).catch(() => null)
  ]);
  if (!benchmark) return null;
  const state = deriveBenchmarkState(benchmark);
  const evidenceCount = history?.total_recorded_runs ?? benchmark.routes.length;
  const caveatCount = benchmark.readiness_note ? 1 : 0;
  const canonicalPath = `/radar/cards/benchmark/${encodeURIComponent(id)}`;
  const verdict = benchmarkVerdict(benchmark, state);
  const tweetText = [
    'My agent checked Infopunks before spending.',
    `Route: ${benchmarkTitle(benchmark)}`,
    `State: ${formatStateLabel(state)}`,
    evidenceCount ? 'Evidence: recorded' : 'Evidence: pending',
    caveatCount ? 'Caveats: open' : 'Caveats: minimal',
    '',
    'autonomous markets need receipts, not vibes',
    canonicalUrl(canonicalPath)
  ].join('\n');
  return {
    id,
    type: 'benchmark',
    title: benchmarkTitle(benchmark),
    subtitle: benchmark.category,
    state,
    verdict,
    evidenceCount,
    caveatCount,
    latestArtifactId: history?.latest_artifact_id ?? undefined,
    benchmarkState: benchmark.winner_status ?? (benchmark.benchmark_recorded ? 'recorded' : 'scaffold'),
    readiness: benchmark.benchmark_recorded ? 'recorded' : 'needs evidence',
    guidance: benchmark.winner_claimed
      ? 'Benchmark evidence supports a winner claim. Inspect artifact details before routing.'
      : 'No winner claimed. Use the recorded evidence, not vibes, when choosing a route.',
    canonicalPath,
    sourcePath: `/benchmarks/${encodeURIComponent(id)}`,
    tweetText,
    agentJson: {
      id,
      type: 'benchmark',
      state,
      verdict,
      canonicalPath,
      benchmarkState: benchmark.winner_status ?? null,
      latestArtifactId: history?.latest_artifact_id ?? null,
      evidenceCount,
      caveatCount
    }
  };
}

async function buildArtifactCard(id: string): Promise<PreflightCardViewModel | null> {
  const artifact = await api<BenchmarkArtifact>(`/v1/radar/benchmark-artifacts/${encodeURIComponent(id)}`).catch(() => null);
  if (!artifact) return null;
  const state: PreflightCardState = artifact.winner_claimed ? 'READY_FOR_INSPECTION' : 'NO_WINNER';
  const verdict = artifact.winner_claimed
    ? 'Artifact recorded with explicit winner posture.'
    : 'Artifact recorded. No winner claimed.';
  const canonicalPath = `/radar/cards/artifact/${encodeURIComponent(id)}`;
  const tweetText = [
    'My agent checked Infopunks before spending.',
    `Artifact: ${artifact.artifact_id}`,
    `State: ${formatStateLabel(state)}`,
    artifact.total_runs ? 'Evidence: artifact recorded' : 'Evidence: thin artifact',
    'Caveats: inspect route notes',
    '',
    'autonomous markets need receipts, not vibes',
    canonicalUrl(canonicalPath)
  ].join('\n');
  return {
    id,
    type: 'artifact',
    title: artifact.artifact_id,
    subtitle: artifact.benchmark_id,
    state,
    verdict,
    evidenceCount: artifact.total_runs,
    caveatCount: artifact.notes ? 1 : 0,
    latestArtifactId: artifact.artifact_id,
    benchmarkState: artifact.winner_status,
    guidance: artifact.winner_claimed
      ? 'Artifact exists with an explicit winner posture. Agents should still inspect route-level evidence.'
      : 'Artifact exists, but no winner was claimed. Route comparison remains evidence-first.',
    canonicalPath,
    sourcePath: `/benchmarks/${encodeURIComponent(artifact.benchmark_id)}`,
    tweetText,
    agentJson: {
      id,
      type: 'artifact',
      state,
      verdict,
      canonicalPath,
      benchmarkState: artifact.winner_status,
      latestArtifactId: artifact.artifact_id,
      evidenceCount: artifact.total_runs,
      caveatCount: artifact.notes ? 1 : 0
    }
  };
}

async function buildRouteCard(id: string): Promise<PreflightCardViewModel | null> {
  const registry = await api<RadarBenchmarkRegistry>('/v1/radar/benchmarks').catch(() => null);
  if (!registry) return null;
  const benchmark = registry.benchmarks.find((item) => item.routes.some((route) => route.route_id === id)) ?? null;
  if (!benchmark) return null;
  const route = benchmark.routes.find((item) => item.route_id === id) ?? null;
  if (!route) return null;
  const routeHistory = await api<RadarRouteHistoryAggregate>(`/v1/radar/benchmark-history/${encodeURIComponent(benchmark.benchmark_id)}/routes`).catch(() => null);
  const routeHistoryRow = routeHistory?.routes.find((item) => item.route_id === id) ?? null;
  const state = deriveRadarRouteState(route, routeHistoryRow);
  const evidenceCount = routeHistoryRow?.latest_success_count ?? (route.paid_execution_proven ? 1 : 0);
  const caveatCount = routeHistoryRow?.caveats.length ?? 0;
  const canonicalPath = `/radar/cards/route/${encodeURIComponent(id)}`;
  const verdict = routeHistoryRow?.winner_claimed === false
    ? 'Comparable route evidence exists, but no winner is claimed.'
    : route.paid_execution_proven
      ? 'Route has paid execution proof recorded.'
      : 'Route remains visible, but proof is incomplete.';
  const tweetText = [
    'My agent checked Infopunks before spending.',
    `Route: ${routeHistoryRow?.label ?? id}`,
    `State: ${formatStateLabel(state)}`,
    evidenceCount ? 'Evidence: recorded' : 'Evidence: thin',
    caveatCount ? 'Caveats: open' : 'Caveats: minimal',
    '',
    'autonomous markets need receipts, not vibes',
    canonicalUrl(canonicalPath)
  ].join('\n');
  return {
    id,
    type: 'route',
    title: routeHistoryRow?.label ?? id,
    subtitle: `${benchmarkTitle(benchmark)} · ${route.provider_id}`,
    state,
    verdict,
    evidenceCount,
    caveatCount,
    latestArtifactId: routeHistoryRow?.latest_artifact_id ?? undefined,
    benchmarkState: routeHistoryRow?.winner_status ?? benchmark.winner_status,
    readiness: route.execution_status,
    guidance: state === 'READY_FOR_INSPECTION'
      ? 'Route evidence is recorded. Inspect caveats and freshness before spend.'
      : state === 'NO_WINNER'
        ? 'No winner is claimed for this route set. Compare proof, not vibes.'
        : 'No artifact recorded yet for this route. Treat as incomplete evidence.',
    canonicalPath,
    sourcePath: `/benchmarks/${encodeURIComponent(benchmark.benchmark_id)}`,
    tweetText,
    agentJson: {
      id,
      type: 'route',
      state,
      verdict,
      canonicalPath,
      latestArtifactId: routeHistoryRow?.latest_artifact_id ?? null,
      benchmarkState: routeHistoryRow?.winner_status ?? benchmark.winner_status ?? null,
      evidenceCount,
      caveatCount
    }
  };
}

function deriveProviderState(intel: ProviderIntelligenceResponse): PreflightCardState {
  if (intel.service_monitor.status === 'failed' || intel.severity === 'critical') return 'DENY';
  if (intel.service_monitor.status === 'degraded' || intel.severity === 'warning') return 'REVIEW';
  if ((intel.latest_trust_score ?? 0) >= 75 && intel.recent_changes.length > 0) return 'ALLOW';
  if (intel.endpoint_count > 0) return 'CATALOG_ONLY';
  return 'NEEDS_EVIDENCE';
}

function providerVerdict(intel: ProviderIntelligenceResponse, state: PreflightCardState) {
  if (state === 'ALLOW') return 'Provider has usable monitoring and intelligence evidence.';
  if (state === 'REVIEW') return 'Provider is visible, but active caveats require review.';
  if (state === 'DENY') return 'Provider evidence indicates degraded or failed spend posture.';
  if (state === 'CATALOG_ONLY') return 'Provider is catalog-visible without enough proof to trust spend.';
  return 'Provider needs more evidence before agents should rely on it.';
}

function deriveBenchmarkState(benchmark: RadarBenchmarkDetail): PreflightCardState {
  if (benchmark.winner_claimed === false) return 'NO_WINNER';
  if (benchmark.benchmark_recorded) return 'READY_FOR_INSPECTION';
  if (benchmark.routes.length > 0) return 'CATALOG_ONLY';
  return 'NEEDS_EVIDENCE';
}

function benchmarkVerdict(benchmark: RadarBenchmarkDetail, state: PreflightCardState) {
  if (state === 'NO_WINNER') return 'Benchmark evidence exists, but no route winner is claimed.';
  if (state === 'READY_FOR_INSPECTION') return 'Benchmark artifact is recorded and ready for inspection.';
  if (state === 'CATALOG_ONLY') return 'Comparable route candidates exist, but benchmark proof is incomplete.';
  return benchmark.next_step || 'No artifact recorded yet.';
}

function deriveRadarRouteState(route: RadarBenchmarkDetail['routes'][number], history: RadarRouteHistoryAggregate['routes'][number] | null): PreflightCardState {
  if (history?.winner_claimed === false) return 'NO_WINNER';
  if (history?.artifact_count || route.paid_execution_proven) return 'READY_FOR_INSPECTION';
  if (route.execution_status === 'verified') return 'CATALOG_ONLY';
  return 'NEEDS_EVIDENCE';
}

function deriveMachineServiceState(service: MachineMarketService, latestReceipt: MachinePreflightReceipt | null, executionReceipt: MachinePreflightReceipt | null): PreflightCardState {
  if (latestReceipt?.decision === 'deny') return 'DENY';
  if (latestReceipt?.decision === 'review') return executionReceipt ? 'REVIEW' : 'PROOF_PLAN_READY';
  if (latestReceipt?.decision === 'allow' && executionReceipt) return 'ALLOW';
  if (service.rail_status === 'proof_plan_selected' || service.evidence_stage === 'preflight-ready') return 'PROOF_PLAN_READY';
  if (service.rail_status === 'review_required') return 'REVIEW';
  if (service.evidence_stage === 'policy-mapped' || service.evidence_stage === 'listed' || service.evidence_stage === 'classified') return 'CATALOG_ONLY';
  return 'NEEDS_EVIDENCE';
}

function machineServiceVerdict(service: MachineMarketService, state: PreflightCardState, latestReceipt: MachinePreflightReceipt | null, executionReceipt: MachinePreflightReceipt | null) {
  if (state === 'ALLOW') return 'Machine service has a recorded allow posture with service-specific evidence.';
  if (state === 'PROOF_PLAN_READY') return 'Proof plan is ready. Planning only · no execution claim.';
  if (state === 'REVIEW') return latestReceipt?.decision === 'review'
    ? 'Machine route requires review before spend.'
    : 'Service is visible, but proof and policy posture are incomplete.';
  if (state === 'DENY') return 'Recorded policy posture denies spend on this service.';
  if (state === 'CATALOG_ONLY') return executionReceipt
    ? 'Service-specific evidence exists, but policy posture is still conservative.'
    : 'Service is catalog-visible only. No execution proof is claimed.';
  return `No artifact or receipt recorded yet for ${service.name}.`;
}

function benchmarkTitle(benchmark: RadarBenchmarkDetail) {
  return benchmark.benchmark_intent
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueCount(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim().length > 0))).length;
}

function scoreOrUndefined(value: number | null | undefined) {
  return typeof value === 'number' ? value : undefined;
}

export function formatStateLabel(state: PreflightCardState) {
  return state.replaceAll('_', ' ');
}
