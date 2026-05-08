import { classifyEventSeverity } from '../engines/severityEngine';
import { InfopunksEvent } from '../schemas/entities';
import { analyzePropagation } from './propagationService';
import { pulseSummary } from './pulseService';
import { IntelligenceStore } from './intelligenceStore';

type IncidentTimelineItem = {
  event_id: string;
  type: InfopunksEvent['type'];
  category: string;
  provider_id: string | null;
  provider_name: string | null;
  observed_at: string;
  summary: string;
  severity: string;
  receipt_link: string;
};

export type PropagationIncident = {
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
  timeline: IncidentTimelineItem[];
};

export function resolvePropagationIncident(
  store: IntelligenceStore,
  clusterId: string,
  generatedAt = new Date().toISOString(),
  analysisOverride = analyzePropagation(store, generatedAt),
  interpretationsOverride?: ReturnType<typeof pulseSummary>['interpretations']
): PropagationIncident | null {
  const analysis = analysisOverride;
  if (analysis.cluster_id !== clusterId) return null;

  const providerNames = new Map(store.providers.map((provider) => [provider.id, provider.name]));
  const eventsById = new Map(store.events.map((event) => [event.id, event]));
  const timeline = analysis.supporting_event_ids
    .map((eventId) => eventsById.get(eventId))
    .filter((event): event is InfopunksEvent => Boolean(event))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
    .map((event) => {
      const providerId = providerIdForEvent(event);
      return {
        event_id: event.id,
        type: event.type,
        category: categoryForEvent(event),
        provider_id: providerId,
        provider_name: providerId ? providerNames.get(providerId) ?? providerId : null,
        observed_at: event.observedAt,
        summary: summaryForIncidentEvent(event),
        severity: classifyEventSeverity(event, store.events).severity,
        receipt_link: `/v1/events/${event.id}`
      };
    });

  const summary = pulseSummary(
    store,
    generatedAt,
    null,
    {
      includePropagation: false,
      includeInterpretations: false,
      propagationFallback: analysis,
      interpretationsFallback: interpretationsOverride ?? []
    }
  );
  const affectedProviderIds = new Set(analysis.affected_providers.map((provider) => provider.provider_id));
  const interpretationLinks = summary.interpretations
    .filter((item) => item.supporting_event_ids.some((id) => analysis.supporting_event_ids.includes(id))
      || item.affected_providers.some((providerId) => affectedProviderIds.has(providerId)))
    .slice(0, 8)
    .map((item) => ({
      interpretation_id: item.interpretation_id,
      title: item.interpretation_title,
      href: `/v1/pulse/summary#interpretation-${item.interpretation_id}`
    }));

  const latestObservedAt = analysis.latest_observed_at ? Date.parse(analysis.latest_observed_at) : null;
  const currentObservedAt = Date.parse(generatedAt);
  const currentStatus = !latestObservedAt
    ? 'unknown'
    : currentObservedAt - latestObservedAt <= 60 * 60 * 1000
      ? 'active'
      : 'monitoring';

  return {
    cluster_id: analysis.cluster_id,
    propagation_state: analysis.propagation_state,
    severity: analysis.severity,
    affected_cluster: analysis.affected_cluster,
    affected_categories: analysis.affected_categories,
    affected_providers: analysis.affected_providers.map((provider) => ({ provider_id: provider.provider_id, provider_name: provider.provider_name })),
    first_observed_at: analysis.first_observed_at,
    latest_observed_at: analysis.latest_observed_at,
    propagation_reason: analysis.propagation_reason,
    confidence: analysis.confidence,
    supporting_event_ids: analysis.supporting_event_ids,
    supporting_receipt_links: analysis.supporting_event_ids.map((eventId) => ({ event_id: eventId, href: `/v1/events/${eventId}` })),
    related_interpretation_links: interpretationLinks,
    related_provider_links: analysis.affected_providers.map((provider) => ({ provider_id: provider.provider_id, provider_name: provider.provider_name, href: `/v1/providers/${provider.provider_id}` })),
    current_status: currentStatus,
    timeline
  };
}

function providerIdForEvent(event: InfopunksEvent) {
  if (typeof event.payload.providerId === 'string') return event.payload.providerId;
  if (typeof event.payload.entityId === 'string') return event.payload.entityId;
  if (event.provider_id) return event.provider_id;
  if (event.entityType === 'provider') return event.entityId;
  return null;
}

function categoryForEvent(event: InfopunksEvent) {
  if (event.type === 'score_assessment_created') return event.entityType === 'signal_assessment' ? 'signal' : 'trust';
  if (event.type === 'pricing_observed' || event.type === 'price.changed') return 'pricing';
  if (event.type === 'pay_sh_catalog_schema_seen' || event.type === 'schema.changed') return 'schema';
  if (event.type === 'endpoint.checked' || event.type === 'endpoint.recovered' || event.type === 'endpoint.degraded' || event.type === 'endpoint.failed' || event.type === 'provider.checked' || event.type === 'provider.reachable' || event.type === 'provider.recovered' || event.type === 'provider.degraded' || event.type === 'provider.failed' || event.type === 'endpoint_status_observed') return 'monitoring';
  return 'discovery';
}

function summaryForIncidentEvent(event: InfopunksEvent) {
  if (typeof event.payload.summary === 'string') return event.payload.summary;
  if (event.type === 'provider.degraded' || event.type === 'endpoint.degraded') return 'Service appears degraded from monitoring evidence.';
  if (event.type === 'provider.failed' || event.type === 'endpoint.failed') return 'Service appears unreachable from monitoring evidence.';
  if (event.type === 'score_assessment_created' && event.entityType === 'trust_assessment') return 'Trust score change contributed to propagation classification.';
  return 'Event contributed to current propagation classification.';
}
