import { PreflightRequest, PreflightResponse, Provider } from '../schemas/entities';
import { DataSourceState } from '../persistence/repository';
import { IntelligenceStore } from './intelligenceStore';
import { dataSourceState } from './pulseService';

type Candidate = {
  provider: Provider;
  trustScore: number | null;
  signalScore: number | null;
  latencyMs: number | null;
  minCostUsd: number | null;
  degraded: boolean;
};

const DEFAULT_MIN_TRUST_SCORE = 70;

export function runPreflight(input: PreflightRequest, store: IntelligenceStore): PreflightResponse {
  const sourceState = dataSourceState(store);
  const generatedAt = new Date().toISOString();
  const byProvider = new Map(store.providers.map((provider) => [provider.id, provider]));
  const requested = input.candidateProviders?.map((id) => id.trim()).filter(Boolean);
  const baseProviders = requested?.length
    ? requested.map((id) => byProvider.get(id)).filter((provider): provider is Provider => Boolean(provider))
    : store.providers;
  const candidates = baseProviders.map((provider) => toCandidate(provider, store));

  const minTrustScore = input.constraints?.minTrustScore ?? DEFAULT_MIN_TRUST_SCORE;
  const maxLatencyMs = input.constraints?.maxLatencyMs ?? null;
  const maxCostUsd = input.constraints?.maxCostUsd ?? null;

  const rejectedProviders: PreflightResponse['rejectedProviders'] = [];
  const accepted: Candidate[] = [];
  for (const candidate of candidates) {
    const reasons: string[] = [];
    if (candidate.trustScore === null || candidate.trustScore < minTrustScore) reasons.push(`trust_score_below_min:${candidate.trustScore ?? 'unknown'}<${minTrustScore}`);
    if (candidate.degraded) reasons.push('active_degradation');
    if (maxLatencyMs !== null && (candidate.latencyMs === null || candidate.latencyMs > maxLatencyMs)) reasons.push(`latency_exceeds_max:${candidate.latencyMs ?? 'unknown'}>${maxLatencyMs}`);
    if (maxCostUsd !== null && (candidate.minCostUsd === null || candidate.minCostUsd > maxCostUsd)) reasons.push(`cost_exceeds_max:${candidate.minCostUsd ?? 'unknown'}>${maxCostUsd}`);
    if (reasons.length > 0) rejectedProviders.push({ providerId: candidate.provider.id, reasons });
    else accepted.push(candidate);
  }

  accepted.sort((a, b) =>
    compareNumbersDesc(a.signalScore, b.signalScore)
    || compareNumbersAsc(a.latencyMs, b.latencyMs)
    || compareNumbersDesc(a.trustScore, b.trustScore)
    || a.provider.id.localeCompare(b.provider.id));

  const selected = accepted[0] ?? null;
  return {
    decision: selected ? 'route_approved' : 'route_blocked',
    selectedProvider: selected?.provider.id ?? null,
    rejectedProviders,
    candidateCount: candidates.length,
    routingPolicy: {
      intent: input.intent,
      category: input.category ?? null,
      constraints: { minTrustScore, maxLatencyMs, maxCostUsd },
      tieBreaker: 'lower_latency_ms',
      priorityOrder: ['min_trust_score', 'active_degradation', 'max_latency_ms', 'max_cost_usd', 'higher_signal_score', 'lower_latency_ms']
    },
    generatedAt,
    dataMode: dataModeForSource(sourceState, store.providers.length),
    source: {
      mode: sourceState.mode,
      url: sourceState.url,
      generatedAt: sourceState.generated_at,
      lastIngestedAt: sourceState.last_ingested_at,
      providerCount: sourceState.provider_count ?? store.providers.length,
      usedFixture: sourceState.used_fixture,
      error: sourceState.error ?? null
    }
  };
}

function toCandidate(provider: Provider, store: IntelligenceStore): Candidate {
  const trust = latestForProvider(store.trustAssessments, provider.id);
  const signal = latestForProvider(store.signalAssessments, provider.id);
  const providerEvents = store.events
    .filter((event) => event.entityType === 'provider' && event.entityId === provider.id && isProviderHealthEvent(event.type))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const latestHealth = providerEvents[0] ?? null;
  const latestLatency = latestNumericLatency(providerEvents);
  const degraded = latestHealth ? latestHealth.type === 'provider.degraded' || latestHealth.type === 'provider.failed' : false;
  return {
    provider,
    trustScore: trust?.score ?? null,
    signalScore: signal?.score ?? null,
    latencyMs: latestLatency,
    minCostUsd: provider.pricing.min,
    degraded
  };
}

function latestForProvider<T extends { entityId: string; assessedAt: string }>(items: T[], providerId: string) {
  return items
    .filter((item) => item.entityId === providerId)
    .sort((a, b) => Date.parse(b.assessedAt) - Date.parse(a.assessedAt))[0] ?? null;
}

function latestNumericLatency(events: IntelligenceStore['events']) {
  for (const event of events) {
    const value = event.payload.response_time_ms;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function isProviderHealthEvent(type: IntelligenceStore['events'][number]['type']) {
  return type === 'provider.checked' || type === 'provider.reachable' || type === 'provider.recovered' || type === 'provider.degraded' || type === 'provider.failed';
}

function dataModeForSource(sourceState: DataSourceState, providerCount: number): PreflightResponse['dataMode'] {
  if (sourceState.mode === 'live_pay_sh_catalog' && !sourceState.error) return 'live';
  if (providerCount > 0 && !sourceState.error) return 'cached';
  return 'fallback';
}

function compareNumbersDesc(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareNumbersAsc(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
