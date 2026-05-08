import { InfopunksEvent, NarrativeCluster, Provider } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';
import { createHash } from 'node:crypto';
import { resolveEventObservedAt } from './eventTimestamp';

export type PropagationState = 'isolated' | 'clustered' | 'spreading' | 'systemic' | 'unknown';
export type PropagationSeverity = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export type PropagationProvider = {
  provider_id: string;
  providerId: string;
  provider_name: string;
  providerName: string;
  category: string;
  tags: string[];
  event_count: number;
  eventCount: number;
};

export type PropagationAnalysis = {
  cluster_id: string;
  clusterId: string;
  propagation_state: PropagationState;
  propagation_reason: string;
  affected_cluster: string | null;
  affected_categories: string[];
  affected_providers: PropagationProvider[];
  first_observed_at: string | null;
  latest_observed_at: string | null;
  supporting_event_ids: string[];
  confidence: number;
  severity: PropagationSeverity;
};

type ImpactEvent = {
  event: InfopunksEvent;
  provider: Provider;
  impact: 'degradation' | 'failure' | 'trust_drop' | 'unknown_telemetry';
};

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEGRADED_TYPES = new Set<InfopunksEvent['type']>(['provider.degraded', 'endpoint.degraded']);
const FAILED_TYPES = new Set<InfopunksEvent['type']>(['provider.failed', 'endpoint.failed']);

export function analyzePropagation(store: IntelligenceStore, generatedAt = new Date().toISOString(), windowMs = DEFAULT_WINDOW_MS): PropagationAnalysis {
  const threshold = Date.parse(generatedAt) - windowMs;
  const providerLookup = new Map(store.providers.map((provider) => [provider.id, provider]));
  const impacts = store.events
    .filter((event) => {
      const observedAt = resolveEventObservedAt(event, null);
      return observedAt ? Date.parse(observedAt) >= threshold : false;
    })
    .map((event) => impactEvent(event, providerLookup))
    .filter((event): event is ImpactEvent => Boolean(event));

  const byProvider = new Map<string, ImpactEvent[]>();
  for (const impact of impacts) {
    const list = byProvider.get(impact.provider.id) ?? [];
    list.push(impact);
    byProvider.set(impact.provider.id, list);
  }

  if (byProvider.size === 0 && isCatalogDesync(store)) return catalogDesyncAnalysis(store);
  if (byProvider.size === 0) return unknownAnalysis();

  const affectedProviders = [...byProvider.entries()]
    .map(([providerId, providerEvents]) => {
      const provider = providerEvents[0].provider;
      return {
        provider_id: providerId,
        providerId,
        provider_name: provider.name,
        providerName: provider.name,
        category: provider.category,
        tags: [...provider.tags].sort(),
        event_count: providerEvents.length,
        eventCount: providerEvents.length
      };
    })
    .sort((a, b) => b.event_count - a.event_count || a.provider_name.localeCompare(b.provider_name));

  const affectedIds = new Set(affectedProviders.map((provider) => provider.provider_id));
  const affectedCategories = [...new Set(affectedProviders.map((provider) => provider.category).filter(Boolean))].sort();
  const affectedCluster = strongestAffectedCluster(store.narratives, affectedIds);
  const supportingEventIds = [...new Set(impacts.map((impact) => impact.event.id))].sort();
  const observedTimes = impacts.map((impact) => resolveEventObservedAt(impact.event, null)).filter((value): value is string => Boolean(value)).sort();
  const providerCount = affectedProviders.length;
  const related = relatedProviderCount(store.providers, affectedIds, affectedCategories, affectedCluster);
  const catalogDesync = isCatalogDesync(store);
  const failureCount = impacts.filter((impact) => impact.impact === 'failure').length;
  const broadFailures = failureCount >= 4 && affectedCategories.length >= Math.min(3, providerCount);
  const multiCategoryDegradation = providerCount >= 4 && affectedCategories.length >= 3;
  const adjacentCategories = affectedCategories.length >= 2 && related >= 4;

  let propagationState: PropagationState;
  if (catalogDesync || broadFailures || (multiCategoryDegradation && related < providerCount)) propagationState = 'systemic';
  else if (providerCount === 1) propagationState = 'isolated';
  else if (providerCount >= 4 || adjacentCategories) propagationState = 'spreading';
  else if (providerCount >= 2 && providerCount <= 3 && related >= providerCount) propagationState = 'clustered';
  else propagationState = 'unknown';

  const severity = severityFor(propagationState, providerCount, affectedCategories.length, failureCount, catalogDesync);
  const confidence = confidenceFor(impacts, affectedCategories.length, affectedCluster, store.providers.length);
  const clusterId = deterministicPropagationClusterId({
    propagation_state: propagationState,
    severity,
    affected_cluster: affectedCluster?.title ?? null,
    affected_categories: affectedCategories,
    affected_providers: affectedProviders.map((provider) => provider.provider_id),
    first_observed_at: observedTimes[0] ?? null,
    latest_observed_at: observedTimes[observedTimes.length - 1] ?? null,
    supporting_event_ids: supportingEventIds
  });

  return {
    cluster_id: clusterId,
    clusterId,
    propagation_state: propagationState,
    propagation_reason: reasonFor(propagationState, providerCount, affectedCategories, affectedCluster, failureCount, catalogDesync),
    affected_cluster: affectedCluster?.title ?? null,
    affected_categories: affectedCategories,
    affected_providers: affectedProviders,
    first_observed_at: observedTimes[0] ?? null,
    latest_observed_at: observedTimes[observedTimes.length - 1] ?? null,
    supporting_event_ids: supportingEventIds,
    confidence,
    severity
  };
}

function impactEvent(event: InfopunksEvent, providerLookup: Map<string, Provider>): ImpactEvent | null {
  const providerId = providerIdForEvent(event);
  const provider = providerId ? providerLookup.get(providerId) : null;
  if (!provider) return null;
  if (DEGRADED_TYPES.has(event.type)) return { event, provider, impact: 'degradation' };
  if (FAILED_TYPES.has(event.type)) return { event, provider, impact: 'failure' };
  if (event.type === 'score_assessment_created' && event.entityType === 'trust_assessment' && trustDrop(event)) return { event, provider, impact: 'trust_drop' };
  if (event.type === 'score_assessment_created' && event.entityType === 'trust_assessment' && unknownTelemetryIncrease(event)) return { event, provider, impact: 'unknown_telemetry' };
  return null;
}

function providerIdForEvent(event: InfopunksEvent) {
  if (typeof event.payload.providerId === 'string') return event.payload.providerId;
  if (typeof event.payload.entityId === 'string') return event.payload.entityId;
  if (event.provider_id) return event.provider_id;
  if (event.entityType === 'provider') return event.entityId;
  return null;
}

function trustDrop(event: InfopunksEvent) {
  const delta = typeof event.payload.delta === 'number' ? event.payload.delta : null;
  return delta !== null && delta < 0;
}

function unknownTelemetryIncrease(event: InfopunksEvent) {
  const unknowns = event.payload.unknowns;
  return Array.isArray(unknowns) && unknowns.length > 0 && event.payload.previousScore !== null;
}

function strongestAffectedCluster(narratives: NarrativeCluster[], affectedIds: Set<string>) {
  return [...narratives]
    .map((narrative) => ({
      narrative,
      overlap: narrative.providerIds.filter((providerId) => affectedIds.has(providerId)).length
    }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || (b.narrative.heat ?? 0) - (a.narrative.heat ?? 0) || a.narrative.title.localeCompare(b.narrative.title))[0]?.narrative ?? null;
}

function relatedProviderCount(providers: Provider[], affectedIds: Set<string>, affectedCategories: string[], affectedCluster: NarrativeCluster | null) {
  const affected = providers.filter((provider) => affectedIds.has(provider.id));
  if (affected.length <= 1) return affected.length;
  const categoryBuckets = new Map<string, number>();
  for (const provider of affected) categoryBuckets.set(provider.category, (categoryBuckets.get(provider.category) ?? 0) + 1);
  const maxCategoryOverlap = Math.max(0, ...affectedCategories.map((category) => categoryBuckets.get(category) ?? 0));
  const clusterCount = affectedCluster?.providerIds.filter((providerId) => affectedIds.has(providerId)).length ?? 0;
  const tagBuckets = new Map<string, number>();
  for (const provider of affected) {
    for (const tag of provider.tags) tagBuckets.set(tag.toLowerCase(), (tagBuckets.get(tag.toLowerCase()) ?? 0) + 1);
  }
  const maxTagOverlap = Math.max(0, ...tagBuckets.values());
  return Math.max(maxCategoryOverlap, clusterCount, maxTagOverlap);
}

function isCatalogDesync(store: IntelligenceStore) {
  return Boolean(store.dataSource?.error || store.dataSource?.used_fixture === true && store.dataSource.mode === 'fixture_fallback');
}

function severityFor(state: PropagationState, providerCount: number, categoryCount: number, failureCount: number, catalogDesync: boolean): PropagationSeverity {
  if (state === 'unknown') return 'unknown';
  if (state === 'systemic' || catalogDesync) return 'critical';
  if (state === 'spreading' || failureCount >= 4 || categoryCount >= 3) return 'high';
  if (state === 'clustered') return 'medium';
  return providerCount > 0 ? 'low' : 'unknown';
}

function confidenceFor(impacts: ImpactEvent[], categoryCount: number, affectedCluster: NarrativeCluster | null, providerTotal: number) {
  if (!impacts.length) return 0.25;
  const eventFactor = Math.min(0.3, impacts.length * 0.04);
  const relationFactor = categoryCount > 1 || affectedCluster ? 0.15 : 0;
  const coverageFactor = providerTotal > 0 ? Math.min(0.2, new Set(impacts.map((impact) => impact.provider.id)).size / providerTotal) : 0;
  return roundConfidence(Math.min(0.95, 0.45 + eventFactor + relationFactor + coverageFactor));
}

function reasonFor(state: PropagationState, providerCount: number, categories: string[], cluster: NarrativeCluster | null, failureCount: number, catalogDesync: boolean) {
  if (state === 'unknown') return 'Insufficient recent degradation, trust-drop, failure, or unknown-telemetry evidence in the active window.';
  if (catalogDesync) return 'Catalog source is in fallback or error state, so propagation is treated as systemic catalog desync risk.';
  if (state === 'isolated') return 'One provider shows recent instability evidence inside the active window.';
  if (state === 'clustered') return `Two to three related providers are affected in ${cluster?.title ?? categories[0] ?? 'one cluster'}.`;
  if (state === 'spreading') return `Four or more related providers, or adjacent categories, show instability evidence across ${categories.join(', ') || 'multiple categories'}.`;
  if (failureCount >= 4) return 'Broad provider failures are visible across unrelated categories in the active window.';
  return `Multi-category degradation spans ${categories.join(', ') || 'several categories'} in the active window.`;
}

function unknownAnalysis(): PropagationAnalysis {
  const clusterId = deterministicPropagationClusterId({
    propagation_state: 'unknown',
    severity: 'unknown',
    affected_cluster: null,
    affected_categories: [],
    affected_providers: [],
    first_observed_at: null,
    latest_observed_at: null,
    supporting_event_ids: []
  });
  return {
    cluster_id: clusterId,
    clusterId,
    propagation_state: 'unknown',
    propagation_reason: 'Insufficient recent degradation, trust-drop, failure, or unknown-telemetry evidence in the active window.',
    affected_cluster: null,
    affected_categories: [],
    affected_providers: [],
    first_observed_at: null,
    latest_observed_at: null,
    supporting_event_ids: [],
    confidence: 0.25,
    severity: 'unknown'
  };
}

function catalogDesyncAnalysis(store: IntelligenceStore): PropagationAnalysis {
  const observedAt = store.dataSource?.last_ingested_at ?? store.dataSource?.generated_at ?? null;
  const clusterId = deterministicPropagationClusterId({
    propagation_state: 'systemic',
    severity: 'critical',
    affected_cluster: null,
    affected_categories: [],
    affected_providers: [],
    first_observed_at: observedAt,
    latest_observed_at: observedAt,
    supporting_event_ids: []
  });
  return {
    cluster_id: clusterId,
    clusterId,
    propagation_state: 'systemic',
    propagation_reason: 'Catalog source is in fallback or error state, so propagation is treated as systemic catalog desync risk.',
    affected_cluster: null,
    affected_categories: [],
    affected_providers: [],
    first_observed_at: observedAt,
    latest_observed_at: observedAt,
    supporting_event_ids: [],
    confidence: 0.65,
    severity: 'critical'
  };
}

function roundConfidence(value: number) {
  return Math.round(value * 100) / 100;
}

type ClusterIdInput = {
  propagation_state: PropagationState;
  severity: PropagationSeverity;
  affected_cluster: string | null;
  affected_categories: string[];
  affected_providers: string[];
  first_observed_at: string | null;
  latest_observed_at: string | null;
  supporting_event_ids: string[];
};

export function deterministicPropagationClusterId(input: ClusterIdInput) {
  const canonical = JSON.stringify({
    propagation_state: input.propagation_state,
    severity: input.severity,
    affected_cluster: input.affected_cluster,
    affected_categories: [...input.affected_categories].sort(),
    affected_providers: [...input.affected_providers].sort(),
    first_observed_at: input.first_observed_at,
    latest_observed_at: input.latest_observed_at,
    supporting_event_ids: [...input.supporting_event_ids].sort()
  });
  const digest = createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  return `prop-${digest}`;
}
