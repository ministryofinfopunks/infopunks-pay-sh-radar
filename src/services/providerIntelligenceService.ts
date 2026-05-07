import { Endpoint, InfopunksEvent, Provider, SignalAssessment, TrustAssessment } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';

export type HistoryItem = {
  id: string;
  type: InfopunksEvent['type'];
  source: string;
  observedAt: string;
  summary: string;
  payload: InfopunksEvent['payload'];
};

export type ProviderIntelligenceSummary = {
  provider: Provider;
  latest_trust_score: number | null;
  latest_signal_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'unknown';
  coordination_eligible: boolean | null;
  unknown_telemetry: string[];
  recent_changes: HistoryItem[];
  endpoint_count: number;
  endpoint_health: {
    healthy: number;
    degraded: number;
    failed: number;
    unknown: number;
    last_checked_at: string | null;
    median_latency_ms: number | null;
    recent_failures: HistoryItem[];
  };
  category_tags: string[];
  last_seen_at: string | null;
  trust_assessment: TrustAssessment | null;
  signal_assessment: SignalAssessment | null;
};

export function findProvider(store: IntelligenceStore, id: string) {
  return store.providers.find((provider) => provider.id === id || provider.slug === id) ?? null;
}

export function findEndpoint(store: IntelligenceStore, id: string) {
  return store.endpoints.find((endpoint) => endpoint.id === id) ?? null;
}

export function providerHistory(store: IntelligenceStore, provider: Provider): HistoryItem[] {
  return sortHistory(store.events.filter((event) => isProviderEvent(event, provider.id)).map(historyItem));
}

export function endpointHistory(store: IntelligenceStore, endpoint: Endpoint): HistoryItem[] {
  return sortHistory(store.events.filter((event) => isEndpointEvent(event, endpoint.id)).map(historyItem));
}

export function providerIntelligence(store: IntelligenceStore, provider: Provider): ProviderIntelligenceSummary {
  const trust = latestAssessment(store.trustAssessments.filter((assessment) => assessment.entityId === provider.id));
  const signal = latestAssessment(store.signalAssessments.filter((assessment) => assessment.entityId === provider.id));
  const recentChanges = providerHistory(store, provider).filter((item) => isChangeType(item.type)).slice(0, 10);
  const riskLevel = riskLevelFromTrust(trust?.score ?? null);
  const endpointHealth = providerEndpointHealth(store, provider.id);

  return {
    provider,
    latest_trust_score: trust?.score ?? null,
    latest_signal_score: signal?.score ?? null,
    risk_level: riskLevel,
    coordination_eligible: coordinationEligible(riskLevel, trust?.score ?? null),
    unknown_telemetry: Array.from(new Set([...(trust?.unknowns ?? []), ...(signal?.unknowns ?? [])])).sort(),
    recent_changes: recentChanges,
    endpoint_count: provider.endpointCount,
    endpoint_health: endpointHealth,
    category_tags: Array.from(new Set([provider.category, ...provider.tags, ...(signal?.narratives ?? [])])).filter(Boolean).sort(),
    last_seen_at: provider.lastSeenAt ?? null,
    trust_assessment: trust ?? null,
    signal_assessment: signal ?? null
  };
}

function historyItem(event: InfopunksEvent): HistoryItem {
  return {
    id: event.id,
    type: event.type,
    source: event.source,
    observedAt: event.observedAt,
    summary: summaryForEvent(event),
    payload: event.payload
  };
}

function sortHistory(items: HistoryItem[]) {
  return items.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
}

function latestAssessment<T extends { assessedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => Date.parse(b.assessedAt) - Date.parse(a.assessedAt))[0] ?? null;
}

function isProviderEvent(event: InfopunksEvent, providerId: string) {
  if (event.entityType === 'provider' && event.entityId === providerId) return true;
  if (event.payload.providerId !== providerId) return false;
  if (event.entityType === 'manifest') return true;
  if (event.entityType === 'pricing_model' && event.payload.endpointId === undefined) return true;
  if (event.entityType === 'schema' && event.payload.endpointId === undefined) return true;
  return false;
}

function isEndpointEvent(event: InfopunksEvent, endpointId: string) {
  if (event.entityType === 'endpoint' && event.entityId === endpointId) return true;
  return event.payload.endpointId === endpointId;
}

function isChangeType(type: InfopunksEvent['type']) {
  return type === 'provider.updated' || type === 'metadata.changed' || type === 'category.changed' || type === 'endpoint_count.changed' || type === 'manifest.updated' || type === 'endpoint.updated' || type === 'price.changed' || type === 'schema.changed' || type === 'endpoint.degraded' || type === 'endpoint.failed' || type === 'endpoint.recovered';
}

function providerEndpointHealth(store: IntelligenceStore, providerId: string): ProviderIntelligenceSummary['endpoint_health'] {
  const endpoints = store.endpoints.filter((endpoint) => endpoint.providerId === providerId);
  const provider = store.providers.find((item) => item.id === providerId);
  const latestChecks = endpoints.map((endpoint) => latestEndpointEvent(store, endpoint.id)).filter((event): event is InfopunksEvent => Boolean(event));
  const latencies = latestChecks
    .filter((event) => event.payload.success === true && typeof event.payload.response_time_ms === 'number')
    .map((event) => event.payload.response_time_ms as number)
    .sort((a, b) => a - b);
  const counts = { healthy: 0, degraded: 0, failed: 0, unknown: 0 };
  for (const endpoint of endpoints) {
    const latest = latestEndpointEvent(store, endpoint.id);
    if (!latest) counts.unknown += 1;
    else if (latest.payload.success !== true) counts.failed += 1;
    else if (latest.type === 'endpoint.degraded' || latest.payload.schema_validity === false) counts.degraded += 1;
    else counts.healthy += 1;
  }
  if (provider && provider.endpointMetadataPartial && provider.endpointCount > endpoints.length) counts.unknown += provider.endpointCount - endpoints.length;
  const failures = sortHistory(store.events.filter((event) => event.payload.providerId === providerId && event.type === 'endpoint.failed').map(historyItem)).slice(0, 5);
  const lastCheckedAt = latestChecks.map((event) => event.observedAt).sort().reverse()[0] ?? null;
  return {
    ...counts,
    last_checked_at: lastCheckedAt,
    median_latency_ms: latencies.length ? Math.round(latencies[Math.floor((latencies.length - 1) / 2)]) : null,
    recent_failures: failures
  };
}

function latestEndpointEvent(store: IntelligenceStore, endpointId: string) {
  return store.events
    .filter((event) => event.entityType === 'endpoint' && event.entityId === endpointId && isMonitorEvent(event.type))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || eventPriority(b.type) - eventPriority(a.type))[0] ?? null;
}

function isMonitorEvent(type: InfopunksEvent['type']) {
  return type === 'endpoint.checked' || type === 'endpoint.recovered' || type === 'endpoint.degraded' || type === 'endpoint.failed';
}

function eventPriority(type: InfopunksEvent['type']) {
  if (type === 'endpoint.failed') return 4;
  if (type === 'endpoint.degraded') return 3;
  if (type === 'endpoint.recovered') return 2;
  if (type === 'endpoint.checked') return 1;
  return 0;
}

function riskLevelFromTrust(score: number | null): ProviderIntelligenceSummary['risk_level'] {
  if (score === null) return 'unknown';
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  return 'high';
}

function coordinationEligible(riskLevel: ProviderIntelligenceSummary['risk_level'], trustScore: number | null) {
  if (trustScore === null || riskLevel === 'unknown') return null;
  return trustScore >= 70 && riskLevel !== 'high';
}

function summaryForEvent(event: InfopunksEvent) {
  switch (event.type) {
    case 'pay_sh_catalog_provider_seen':
      return 'Provider discovered in Pay.sh catalog.';
    case 'pay_sh_catalog_endpoint_seen':
      return 'Endpoint discovered in Pay.sh catalog.';
    case 'pay_sh_catalog_manifest_seen':
      return 'Provider manifest observed.';
    case 'pay_sh_catalog_schema_seen':
      return 'Schema observed from Pay.sh catalog.';
    case 'provider_metadata_observed':
      return 'Provider metadata observed.';
    case 'pricing_observed':
      return 'Pricing observed from Pay.sh catalog.';
    case 'endpoint_status_observed':
      return 'Endpoint status observed.';
    case 'score_assessment_created':
      return 'Score assessment created.';
    case 'provider.discovered':
      return 'Provider discovered in live Pay.sh catalog.';
    case 'provider.updated':
      return 'Provider metadata changed.';
    case 'provider.removed_from_catalog':
      return 'Provider removed from the live Pay.sh catalog.';
    case 'category.changed':
      return 'Provider category changed.';
    case 'endpoint_count.changed':
      return 'Provider endpoint count changed.';
    case 'metadata.changed':
      return 'Provider metadata changed.';
    case 'catalog.ingested':
      return 'Pay.sh catalog ingested.';
    case 'manifest.updated':
      return 'Provider manifest changed.';
    case 'endpoint.updated':
      return 'Endpoint metadata changed.';
    case 'price.changed':
      return 'Pricing changed.';
    case 'schema.changed':
      return 'Schema changed.';
    case 'endpoint.checked':
      return `Endpoint checked with status ${event.payload.status_code ?? 'unknown'} and latency ${event.payload.response_time_ms ?? 'unknown'}ms.`;
    case 'endpoint.recovered':
      return 'Endpoint recovered after prior failed or degraded monitor evidence.';
    case 'endpoint.degraded':
      return 'Endpoint degraded based on monitor latency or response validity evidence.';
    case 'endpoint.failed':
      return `Endpoint monitor failed: ${event.payload.error_message ?? `HTTP ${event.payload.status_code ?? 'unknown'}`}.`;
  }
}
