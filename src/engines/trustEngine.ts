import { Endpoint, Evidence, InfopunksEvent, Provider, TrustAssessment } from '../schemas/entities';
import { classifyProviderDossierSeverity } from './severityEngine';
import { resolveEventCatalogGeneratedAt, resolveEventIngestedAt, resolveEventObservedAt } from '../services/eventTimestamp';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const weights: Record<keyof TrustAssessment['components'], number> = {
  uptime: 0.18,
  responseValidity: 0.16,
  metadataQuality: 0.16,
  pricingClarity: 0.14,
  latency: 0.12,
  receiptReliability: 0.14,
  freshness: 0.1
};

function grade(score: number | null): TrustAssessment['grade'] {
  if (score === null) return 'unknown';
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

function weightedAvailableScore(components: TrustAssessment['components']) {
  let weighted = 0;
  let availableWeight = 0;
  for (const [key, value] of Object.entries(components) as [keyof TrustAssessment['components'], number | null][]) {
    if (value === null) continue;
    weighted += value * weights[key];
    availableWeight += weights[key];
  }
  return availableWeight === 0 ? null : clamp(weighted / availableWeight);
}

function metadataQuality(provider: Provider) {
  const description = provider.description ?? '';
  return clamp((description.length >= 120 ? 45 : description.length / 120 * 45) + Math.min(provider.tags.length, 5) * 8 + (provider.namespace.includes('/') ? 15 : 0));
}

function pricingClarity(provider: Provider) {
  return provider.pricing.clarity === 'clear' || provider.pricing.clarity === 'free' ? 96 : provider.pricing.clarity === 'range' ? 78 : provider.pricing.clarity === 'dynamic' ? 62 : 30;
}

function freshness(provider: Provider) {
  const ageMs = Date.now() - Date.parse(provider.lastSeenAt);
  return clamp(100 - ageMs / 86_400_000 * 8);
}

function evidenceFrom(event: InfopunksEvent, summary: string): Evidence {
  const observedAt = resolveEventObservedAt(event, null) ?? event.observedAt;
  const providerId = typeof event.payload.providerId === 'string' ? event.payload.providerId : event.entityType === 'provider' ? event.entityId : null;
  const endpointId = typeof event.payload.endpointId === 'string' ? event.payload.endpointId : event.entityType === 'endpoint' ? event.entityId : null;
  return {
    eventId: event.id,
    event_id: event.id,
    eventType: event.type,
    event_type: event.type,
    providerId,
    provider_id: providerId,
    endpointId,
    endpoint_id: endpointId,
    source: event.source,
    observedAt,
    observed_at: observedAt,
    catalogGeneratedAt: resolveEventCatalogGeneratedAt(event, typeof event.payload.catalog_generated_at === 'string' ? event.payload.catalog_generated_at : null),
    catalog_generated_at: resolveEventCatalogGeneratedAt(event, typeof event.payload.catalog_generated_at === 'string' ? event.payload.catalog_generated_at : null),
    ingestedAt: resolveEventIngestedAt(event, null),
    ingested_at: resolveEventIngestedAt(event, null),
    derivationReason: summary,
    derivation_reason: summary,
    confidence: event.source.includes('fixture') ? 0.8 : 1,
    summary,
    value: event.payload
  };
}

function endpointMonitorEvents(endpoints: Endpoint[], events: InfopunksEvent[]) {
  const endpointIds = new Set(endpoints.map((endpoint) => endpoint.id));
  return events
    .filter((event) => endpointIds.has(event.entityId) && event.entityType === 'endpoint' && isMonitorEvent(event.type))
    .sort((a, b) => Date.parse(resolveEventObservedAt(a, a.observedAt) ?? a.observedAt) - Date.parse(resolveEventObservedAt(b, b.observedAt) ?? b.observedAt));
}

function providerMonitorEvents(provider: Provider, events: InfopunksEvent[]) {
  return events
    .filter((event) => event.entityType === 'provider' && event.entityId === provider.id && isProviderMonitorEvent(event.type))
    .sort((a, b) => Date.parse(resolveEventObservedAt(a, a.observedAt) ?? a.observedAt) - Date.parse(resolveEventObservedAt(b, b.observedAt) ?? b.observedAt));
}

function isMonitorEvent(type: InfopunksEvent['type']) {
  return type === 'endpoint.checked' || type === 'endpoint.recovered' || type === 'endpoint.degraded' || type === 'endpoint.failed';
}

function isProviderMonitorEvent(type: InfopunksEvent['type']) {
  return type === 'provider.checked' || type === 'provider.reachable' || type === 'provider.recovered' || type === 'provider.degraded' || type === 'provider.failed';
}

function latestMonitorEventsByEndpoint(events: InfopunksEvent[]) {
  const latest = new Map<string, InfopunksEvent>();
  for (const event of events) latest.set(event.entityId, event);
  return [...latest.values()];
}

function uptimeScore(events: InfopunksEvent[]) {
  const latestEvents = latestMonitorEventsByEndpoint(events);
  if (!latestEvents.length) return null;
  const successes = latestEvents.filter((event) => event.payload.success === true).length;
  return clamp(successes / latestEvents.length * 100);
}

function serviceReachabilityScore(events: InfopunksEvent[]) {
  const latest = events[events.length - 1];
  if (!latest) return null;
  if (latest.payload.success !== true || latest.type === 'provider.failed') return 0;
  if (latest.type === 'provider.degraded' || latest.payload.status === 'degraded') return 65;
  return 100;
}

function responseValidityScore(events: InfopunksEvent[]) {
  const validationEvents = latestMonitorEventsByEndpoint(events).filter((event) => typeof event.payload.schema_validity === 'boolean');
  if (!validationEvents.length) return null;
  const valid = validationEvents.filter((event) => event.payload.schema_validity === true).length;
  return clamp(valid / validationEvents.length * 100);
}

function latencyScore(events: InfopunksEvent[]) {
  const successfulLatencies = latestMonitorEventsByEndpoint(events)
    .filter((event) => event.payload.success === true && typeof event.payload.response_time_ms === 'number')
    .map((event) => event.payload.response_time_ms as number);
  if (!successfulLatencies.length) return null;
  const p50 = successfulLatencies.sort((a, b) => a - b)[Math.floor((successfulLatencies.length - 1) / 2)];
  return clamp(100 - p50 / 10);
}

export function computeTrustAssessment(provider: Provider, endpoints: Endpoint[], events: InfopunksEvent[] = [], assessedAt = new Date().toISOString()): TrustAssessment {
  const metadataEvidence = provider.evidence.filter((item) => item.eventType === 'provider_metadata_observed' || item.eventType === 'pay_sh_catalog_provider_seen');
  const pricingEvidence = provider.pricing.evidence;
  const freshnessEvidence = provider.evidence.filter((item) => item.eventType === 'pay_sh_catalog_provider_seen');
  const monitorEvents = endpointMonitorEvents(endpoints, events);
  const serviceMonitorEvents = providerMonitorEvents(provider, events);
  const monitorEvidence = monitorEvents.map((event) => evidenceFrom(event, `Endpoint monitor ${event.type} with status ${event.payload.status_code ?? 'unknown'} in ${event.payload.response_time_ms ?? 'unknown'}ms.`));
  const serviceMonitorEvidence = serviceMonitorEvents.map((event) => evidenceFrom(event, `Safe metadata monitor ${event.type} with service status ${event.payload.status ?? 'unknown'} and HTTP ${event.payload.status_code ?? 'unknown'} in ${event.payload.response_time_ms ?? 'unknown'}ms.`));

  const components: TrustAssessment['components'] = {
    uptime: uptimeScore(monitorEvents) ?? serviceReachabilityScore(serviceMonitorEvents),
    responseValidity: responseValidityScore(monitorEvents),
    metadataQuality: metadataQuality(provider),
    pricingClarity: pricingClarity(provider),
    latency: latencyScore(monitorEvents) ?? latencyScore(serviceMonitorEvents),
    receiptReliability: null,
    freshness: freshness(provider)
  };

  const unknowns = Object.entries(components).filter(([, value]) => value === null).map(([key]) => key);
  const score = weightedAvailableScore(components);
  const evidence: Record<string, Evidence[]> = {
    uptime: [
      ...monitorEvidence.filter((item) => item.value && typeof (item.value as Record<string, unknown>).success === 'boolean'),
      ...serviceMonitorEvidence.filter((item) => item.value && (item.value as Record<string, unknown>).check_type === 'service_url_reachability')
    ],
    responseValidity: monitorEvidence.filter((item) => item.value && typeof (item.value as Record<string, unknown>).schema_validity === 'boolean'),
    metadataQuality: metadataEvidence,
    pricingClarity: pricingEvidence,
    latency: [
      ...monitorEvidence.filter((item) => item.value && typeof (item.value as Record<string, unknown>).response_time_ms === 'number'),
      ...serviceMonitorEvidence.filter((item) => item.value && typeof (item.value as Record<string, unknown>).response_time_ms === 'number')
    ],
    receiptReliability: [],
    freshness: freshnessEvidence
  };

  const severity = classifyProviderDossierSeverity(provider, { score, unknowns } as TrustAssessment, null, events);
  return {
    id: `trust-${provider.id}`,
    entityId: provider.id,
    providerId: provider.id,
    provider_id: provider.id,
    endpointId: null,
    endpoint_id: null,
    entityType: 'provider',
    observedAt: provider.lastSeenAt,
    observed_at: provider.lastSeenAt,
    catalogGeneratedAt: provider.catalogGeneratedAt ?? null,
    catalog_generated_at: provider.catalogGeneratedAt ?? null,
    ingestedAt: provider.lastSeenAt,
    ingested_at: provider.lastSeenAt,
    source: 'infopunks:deterministic-scoring',
    derivationReason: 'Trust score is derived from catalog evidence and monitor evidence using the existing deterministic formula.',
    derivation_reason: 'Trust score is derived from catalog evidence and monitor evidence using the existing deterministic formula.',
    confidence: (Object.keys(components).length - unknowns.length) / Object.keys(components).length,
    ...severity,
    score,
    grade: grade(score),
    components,
    evidence,
    unknowns,
    reasoning: [
      'Trust V1 is deterministic and only scores components with supporting events.',
      'Safe metadata monitor evidence only affects service reachability and latency; response validity, receipt reliability, and paid execution success remain unknown without endpoint or receipt evidence.',
      `Available evidence produced score ${score ?? 'unknown'} over ${Object.keys(components).length - unknowns.length} known components.`
    ],
    assessedAt
  };
}
