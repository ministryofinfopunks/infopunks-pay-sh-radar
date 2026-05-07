import { Endpoint, Evidence, InfopunksEvent, Provider, TrustAssessment } from '../schemas/entities';

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
  return { eventId: event.id, eventType: event.type, source: event.source, observedAt: event.observedAt, summary, value: event.payload };
}

function endpointMonitorEvents(endpoints: Endpoint[], events: InfopunksEvent[]) {
  const endpointIds = new Set(endpoints.map((endpoint) => endpoint.id));
  return events
    .filter((event) => endpointIds.has(event.entityId) && event.entityType === 'endpoint' && isMonitorEvent(event.type))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
}

function isMonitorEvent(type: InfopunksEvent['type']) {
  return type === 'endpoint.checked' || type === 'endpoint.recovered' || type === 'endpoint.degraded' || type === 'endpoint.failed';
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
  const monitorEvidence = monitorEvents.map((event) => evidenceFrom(event, `Endpoint monitor ${event.type} with status ${event.payload.status_code ?? 'unknown'} in ${event.payload.response_time_ms ?? 'unknown'}ms.`));

  const components: TrustAssessment['components'] = {
    uptime: uptimeScore(monitorEvents),
    responseValidity: responseValidityScore(monitorEvents),
    metadataQuality: metadataQuality(provider),
    pricingClarity: pricingClarity(provider),
    latency: latencyScore(monitorEvents),
    receiptReliability: null,
    freshness: freshness(provider)
  };

  const unknowns = Object.entries(components).filter(([, value]) => value === null).map(([key]) => key);
  const score = weightedAvailableScore(components);
  const evidence: Record<string, Evidence[]> = {
    uptime: monitorEvidence.filter((item) => item.value && typeof (item.value as Record<string, unknown>).success === 'boolean'),
    responseValidity: monitorEvidence.filter((item) => item.value && typeof (item.value as Record<string, unknown>).schema_validity === 'boolean'),
    metadataQuality: metadataEvidence,
    pricingClarity: pricingEvidence,
    latency: monitorEvidence.filter((item) => item.value && typeof (item.value as Record<string, unknown>).response_time_ms === 'number'),
    receiptReliability: [],
    freshness: freshnessEvidence
  };

  return {
    id: `trust-${provider.id}`,
    entityId: provider.id,
    entityType: 'provider',
    score,
    grade: grade(score),
    components,
    evidence,
    unknowns,
    reasoning: [
      'Trust V1 is deterministic and only scores components with supporting events.',
      'Uptime, response validity, and latency use endpoint monitor evidence when available; receipt reliability remains null until Pay.sh receipt events are ingested.',
      `Available evidence produced score ${score ?? 'unknown'} over ${Object.keys(components).length - unknowns.length} known components.`
    ],
    assessedAt
  };
}
