import { InfopunksEvent, IngestionRun } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';
import { DataSourceState } from '../persistence/repository';
import { providerReachabilitySummary, providerRootHealthSummary } from './eventSummaryHelpers';
import { EcosystemInterpretation, interpretEcosystem } from './interpretationService';
import { analyzePropagation, PropagationAnalysis } from './propagationService';
import { classifyEventSeverity, classifyScoreChangeSeverity, compareSeverity, Severity } from '../engines/severityEngine';
import { resolveEventCatalogGeneratedAt, resolveEventIngestedAt, resolveEventObservedAt } from './eventTimestamp';

export type EventCategory = 'discovery' | 'trust' | 'monitoring' | 'pricing' | 'schema' | 'signal';
export type RollingWindow = '1h' | '24h' | '7d';

export type PulseSummary = {
  generatedAt: string;
  latest_event_at: string | null;
  latest_batch_event_count: number;
  ingest_interval_ms: number | null;
  latest_ingestion_run: LatestIngestionRun | null;
  counters: {
    providers: number;
    endpoints: number;
    events: number;
    narratives: number;
    unknownTelemetry: number;
  };
  eventGroups: Record<EventCategory, { count: number; recent: PulseEvent[] }>;
  timeline: PulseEvent[];
  trustDeltas: ScoreDelta[];
  signalDeltas: ScoreDelta[];
  recentDegradations: PulseEvent[];
  propagation: PropagationAnalysis;
  providerActivity: Record<RollingWindow, ProviderActivity[]>;
  signalSpikes: ScoreDelta[];
  interpretations: EcosystemInterpretation[];
  data_source: DataSourceState;
};

export type PulseSummaryOptions = {
  includePropagation?: boolean;
  includeInterpretations?: boolean;
  propagationFallback?: PropagationAnalysis;
  interpretationsFallback?: EcosystemInterpretation[];
};

export type LatestIngestionRun = {
  startedAt: string;
  finishedAt: string | null;
  status: IngestionRun['status'];
  discoveredCount: number;
  changedCount: number;
  emittedEvents: number;
  usedFixture: boolean;
  source: string;
};

export type PulseEvent = {
  id: string;
  event_id: string;
  type: InfopunksEvent['type'];
  category: EventCategory;
  source: string;
  entityType: InfopunksEvent['entityType'];
  entityId: string;
  providerId: string | null;
  provider_id: string | null;
  providerName: string | null;
  endpointId: string | null;
  endpoint_id: string | null;
  observedAt: string;
  observed_at: string;
  catalog_generated_at: string | null;
  ingested_at: string | null;
  derivation_reason: string;
  confidence: number;
  severity: Severity;
  severity_reason: string;
  severity_score?: number;
  severity_window?: string;
  summary: string;
  payload: InfopunksEvent['payload'];
  evidence: AuditReceipt;
};

export type ScoreDelta = {
  eventId: string;
  event_id: string;
  providerId: string;
  provider_id: string;
  endpointId: string | null;
  endpoint_id: string | null;
  providerName: string;
  score: number | null;
  previousScore: number | null;
  delta: number | null;
  observedAt: string;
  observed_at: string;
  catalog_generated_at: string | null;
  ingested_at: string | null;
  source: string;
  derivation_reason: string;
  confidence: number;
  direction: 'up' | 'down' | 'flat' | 'unknown';
  severity: Severity;
  severity_reason: string;
  severity_score?: number;
  severity_window?: string;
  evidence: AuditReceipt;
};

export type ProviderActivity = {
  providerId: string;
  provider_id: string;
  providerName: string;
  count: number;
  categories: Record<EventCategory, number>;
  lastObservedAt: string | null;
  observed_at: string | null;
  source: string;
  derivation_reason: string;
  confidence: number;
  severity: Severity;
  severity_reason: string;
  severity_score?: number;
  severity_window?: string;
  evidence: AuditReceipt;
};

export type AuditReceipt = {
  event_id: string | null;
  provider_id: string | null;
  endpoint_id: string | null;
  observed_at: string | null;
  catalog_generated_at: string | null;
  ingested_at: string | null;
  source: string;
  derivation_reason: string;
  confidence: number;
  severity?: Severity;
  severity_reason?: string;
  severity_score?: number;
  severity_window?: string;
};

const categories: EventCategory[] = ['discovery', 'trust', 'monitoring', 'pricing', 'schema', 'signal'];
export const PULSE_CAPS = {
  maxPulseRows: 50,
  maxTrustChanges: 10,
  maxSignalChanges: 10,
  maxProviderActivityRows: 10,
  maxDegradationRows: 10,
  maxEvidenceIdsInline: 10
} as const;
const windows: Record<RollingWindow, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
};

export function pulseSummary(
  store: IntelligenceStore,
  generatedAt = new Date().toISOString(),
  ingestIntervalMs: number | null = null,
  options: PulseSummaryOptions = {}
): PulseSummary {
  const includePropagation = options.includePropagation ?? true;
  const includeInterpretations = options.includeInterpretations ?? true;
  const orderedEvents = [...store.events].sort((a, b) => Date.parse(resolveEventObservedAt(b, b.observedAt) ?? b.observedAt) - Date.parse(resolveEventObservedAt(a, a.observedAt) ?? a.observedAt));
  const providerNames = new Map(store.providers.map((provider) => [provider.id, provider.name]));
  const pulseEvents = orderedEvents.map((event) => toPulseEvent(event, providerNames, store.events));
  const eventGroups = Object.fromEntries(categories.map((category) => [category, { count: 0, recent: [] as PulseEvent[] }])) as PulseSummary['eventGroups'];
  const latestEventAt = pulseEvents[0]?.observedAt ?? null;
  const dataSource = dataSourceState(store, generatedAt);
  const latestRun = latestIngestionRun(store, dataSource);

  for (const event of pulseEvents) {
    const group = eventGroups[event.category];
    group.count += 1;
    if (group.recent.length < PULSE_CAPS.maxPulseRows) group.recent.push(event);
  }

  const trustDeltas = scoreDeltas(pulseEvents, 'trust_assessment', providerNames).slice(0, PULSE_CAPS.maxTrustChanges);
  const signalDeltas = scoreDeltas(pulseEvents, 'signal_assessment', providerNames).slice(0, PULSE_CAPS.maxSignalChanges);
  const recentDegradations = pulseEvents.filter((event) => event.type === 'endpoint.degraded' || event.type === 'endpoint.failed' || event.type === 'provider.degraded' || event.type === 'provider.failed').sort(compareSeverity).slice(0, PULSE_CAPS.maxDegradationRows);
  const signalSpikes = signalDeltas.filter((delta) => (delta.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, PULSE_CAPS.maxSignalChanges);
  const propagation = includePropagation
    ? analyzePropagation(store, generatedAt)
    : options.propagationFallback ?? {
      cluster_id: 'prop-unknown',
      clusterId: 'prop-unknown',
      propagation_state: 'unknown',
      propagation_reason: 'Propagation analysis is computed asynchronously.',
      affected_cluster: null,
      affected_categories: [],
      affected_providers: [],
      first_observed_at: null,
      latest_observed_at: null,
      supporting_event_ids: [],
      confidence: 0,
      severity: 'unknown'
    };

  return {
    generatedAt,
    latest_event_at: latestEventAt,
    latest_batch_event_count: latestEventAt ? pulseEvents.filter((event) => event.observedAt === latestEventAt).length : 0,
    ingest_interval_ms: ingestIntervalMs,
    latest_ingestion_run: latestRun,
    counters: {
      providers: store.providers.length,
      endpoints: providerEndpointCount(store),
      events: store.events.length,
      narratives: store.narratives.length,
      unknownTelemetry: unknownTelemetryCount(store)
    },
    eventGroups,
    timeline: pulseEvents.slice(0, PULSE_CAPS.maxPulseRows),
    trustDeltas,
    signalDeltas,
    recentDegradations,
    propagation,
    providerActivity: providerActivity(pulseEvents, generatedAt),
    signalSpikes,
    interpretations: includeInterpretations
      ? interpretEcosystem({ store, events: pulseEvents, trustDeltas, signalDeltas, recentDegradations, generatedAt })
      : (options.interpretationsFallback ?? []),
    data_source: dataSource
  };
}

function providerEndpointCount(store: IntelligenceStore) {
  return store.providers.reduce((sum, provider) => sum + provider.endpointCount, 0);
}

export function dataSourceState(store: IntelligenceStore, generatedAt = new Date().toISOString()): DataSourceState {
  return store.dataSource ?? {
    mode: 'fixture_fallback',
    url: null,
    generated_at: null,
    provider_count: store.providers.length,
    last_ingested_at: store.ingestionRuns[0]?.finishedAt ?? generatedAt,
    used_fixture: true,
    error: null
  };
}

function toPulseEvent(event: InfopunksEvent, providerNames: Map<string, string>, relatedEvents: InfopunksEvent[]): PulseEvent {
  const observedAt = resolveEventObservedAt(event, null) ?? event.observedAt;
  const providerId = providerIdForEvent(event);
  const endpointId = endpointIdForEvent(event);
  const summary = summaryForEvent(event);
  const evidence = receiptFromEvent(event, providerId, endpointId, summary);
  const severity = classifyEventSeverity(event, relatedEvents);
  return {
    id: event.id,
    event_id: event.id,
    type: event.type,
    category: categoryForEvent(event),
    source: event.source,
    entityType: event.entityType,
    entityId: event.entityId,
    providerId,
    provider_id: providerId,
    providerName: providerId ? providerNames.get(providerId) ?? providerId : null,
    endpointId,
    endpoint_id: endpointId,
    observedAt,
    observed_at: observedAt,
    catalog_generated_at: evidence.catalog_generated_at,
    ingested_at: evidence.ingested_at,
    derivation_reason: evidence.derivation_reason,
    confidence: evidence.confidence,
    ...severity,
    summary,
    payload: event.payload,
    evidence
  };
}

function categoryForEvent(event: InfopunksEvent): EventCategory {
  if (event.type === 'score_assessment_created') return event.entityType === 'signal_assessment' ? 'signal' : 'trust';
  if (event.type === 'pricing_observed' || event.type === 'price.changed') return 'pricing';
  if (event.type === 'pay_sh_catalog_schema_seen' || event.type === 'schema.changed') return 'schema';
  if (event.type === 'endpoint.checked' || event.type === 'endpoint.recovered' || event.type === 'endpoint.degraded' || event.type === 'endpoint.failed' || event.type === 'provider.checked' || event.type === 'provider.reachable' || event.type === 'provider.recovered' || event.type === 'provider.degraded' || event.type === 'provider.failed' || event.type === 'endpoint_status_observed') return 'monitoring';
  return 'discovery';
}

function providerIdForEvent(event: InfopunksEvent) {
  if (typeof event.payload.providerId === 'string') return event.payload.providerId;
  if (typeof event.payload.entityId === 'string') return event.payload.entityId;
  if (event.entityType === 'provider') return event.entityId;
  return null;
}

function endpointIdForEvent(event: InfopunksEvent) {
  if (typeof event.payload.endpointId === 'string') return event.payload.endpointId;
  if (event.entityType === 'endpoint') return event.entityId;
  return null;
}

function scoreDeltas(events: PulseEvent[], entityType: 'trust_assessment' | 'signal_assessment', providerNames: Map<string, string>): ScoreDelta[] {
  return events
    .filter((event) => event.type === 'score_assessment_created' && event.entityType === entityType && event.providerId)
    .map((event): ScoreDelta => {
      const score = numberOrNull(event.payload.score);
      const previousScore = numberOrNull(event.payload.previousScore);
      const delta = numberOrNull(event.payload.delta);
      return {
        eventId: event.id,
        event_id: event.id,
        providerId: event.providerId!,
        provider_id: event.providerId!,
        endpointId: event.endpointId,
        endpoint_id: event.endpointId,
        providerName: providerNames.get(event.providerId!) ?? event.providerId!,
        score,
        previousScore,
        delta,
        observedAt: event.observedAt,
        observed_at: event.observedAt,
        catalog_generated_at: event.catalog_generated_at,
        ingested_at: event.ingested_at,
        source: event.source,
        derivation_reason: event.derivation_reason,
        confidence: event.confidence,
        direction: delta === null ? 'unknown' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
        ...classifyScoreChangeSeverity(event.entityType, delta, Array.isArray(event.payload.unknowns) ? event.payload.unknowns.length : 0),
        evidence: event.evidence
      };
    });
}

function providerActivity(events: PulseEvent[], generatedAt: string): Record<RollingWindow, ProviderActivity[]> {
  const now = Date.parse(generatedAt);
  return Object.fromEntries(Object.entries(windows).map(([name, duration]) => [name, providerActivityForWindow(events, now - duration)])) as Record<RollingWindow, ProviderActivity[]>;
}

function providerActivityForWindow(events: PulseEvent[], thresholdMs: number) {
  const activity = new Map<string, ProviderActivity>();
  for (const event of events) {
    if (!event.providerId || Date.parse(event.observedAt) < thresholdMs) continue;
    const current = activity.get(event.providerId) ?? {
      providerId: event.providerId,
      provider_id: event.providerId,
      providerName: event.providerName ?? event.providerId,
      count: 0,
      categories: Object.fromEntries(categories.map((category) => [category, 0])) as Record<EventCategory, number>,
      lastObservedAt: null,
      observed_at: null,
      source: event.source,
      derivation_reason: 'Provider activity is a deterministic count of event-spine observations in this time window.',
      confidence: 1,
      severity: event.severity,
      severity_reason: event.severity_reason,
      severity_score: event.severity_score,
      severity_window: event.severity_window,
      evidence: event.evidence
    };
    current.count += 1;
    current.categories[event.category] += 1;
    if (!current.lastObservedAt || Date.parse(event.observedAt) > Date.parse(current.lastObservedAt)) current.lastObservedAt = event.observedAt;
    if (!current.observed_at || Date.parse(event.observedAt) > Date.parse(current.observed_at)) {
      current.observed_at = event.observedAt;
      current.source = event.source;
      current.evidence = event.evidence;
    }
    if (compareSeverity(event, current) < 0) {
      current.severity = event.severity;
      current.severity_reason = event.severity_reason;
      current.severity_score = event.severity_score;
      current.severity_window = event.severity_window;
    }
    activity.set(event.providerId, current);
  }
  return [...activity.values()].sort((a, b) => compareSeverity(a, b) || b.count - a.count || a.providerName.localeCompare(b.providerName)).slice(0, PULSE_CAPS.maxProviderActivityRows);
}

function unknownTelemetryCount(store: IntelligenceStore) {
  return store.trustAssessments.reduce((sum, assessment) => sum + assessment.unknowns.length, 0) + store.signalAssessments.reduce((sum, assessment) => sum + assessment.unknowns.length, 0);
}

function latestIngestionRun(store: IntelligenceStore, dataSource: DataSourceState): LatestIngestionRun | null {
  const run = [...(store.ingestionRuns ?? [])].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  if (!run) return null;
  const emittedEvents = store.events.filter((event) => {
    const observedAt = resolveEventObservedAt(event, event.observedAt);
    return observedAt === run.startedAt || observedAt === run.finishedAt;
  }).length;
  return {
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    status: run.status,
    discoveredCount: run.discoveredCount,
    changedCount: run.changedCount,
    emittedEvents,
    usedFixture: dataSource.used_fixture,
    source: run.source
  };
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function receiptFromEvent(event: InfopunksEvent, providerId: string | null, endpointId: string | null, derivationReason: string): AuditReceipt {
  const observedAt = resolveEventObservedAt(event, null);
  return {
    event_id: event.id,
    provider_id: providerId,
    endpoint_id: endpointId,
    observed_at: observedAt,
    catalog_generated_at: resolveEventCatalogGeneratedAt(event, typeof event.payload.catalog_generated_at === 'string' ? event.payload.catalog_generated_at : null),
    ingested_at: resolveEventIngestedAt(event, null),
    source: event.source,
    derivation_reason: event.derivation_reason ?? derivationReason,
    confidence: typeof event.confidence === 'number' ? event.confidence : event.source.includes('fixture') ? 0.8 : 1,
    severity: event.severity,
    severity_reason: event.severity_reason,
    severity_score: event.severity_score,
    severity_window: event.severity_window
  };
}

function summaryForEvent(event: InfopunksEvent) {
  if (event.type === 'score_assessment_created') {
    const score = event.payload.score ?? 'unknown';
    const previousScore = event.payload.previousScore ?? 'none';
    const delta = event.payload.delta ?? 'unknown';
    return `${event.entityType.replace('_assessment', '')} score ${score}; previous ${previousScore}; delta ${delta}.`;
  }
  if (event.type === 'endpoint.checked') return `Endpoint checked with success ${event.payload.success ?? 'unknown'} and latency ${event.payload.response_time_ms ?? 'unknown'}ms.`;
  if (event.type === 'endpoint.degraded') return `Endpoint degraded with latency ${event.payload.response_time_ms ?? 'unknown'}ms and status ${event.payload.status_code ?? 'unknown'}.`;
  if (event.type === 'endpoint.failed') return `Endpoint failed with error ${event.payload.error ?? event.payload.status_code ?? 'unknown'}.`;
  if (event.type === 'endpoint.recovered') return 'Endpoint recovered after a prior failed or degraded monitor event.';
  if (event.type === 'provider.checked') return providerReachabilitySummary(event);
  if (event.type === 'provider.reachable') return providerRootHealthSummary(event, 'healthy');
  if (event.type === 'provider.degraded') return providerRootHealthSummary(event, 'degraded');
  if (event.type === 'provider.failed') return providerReachabilitySummary(event);
  if (event.type === 'provider.recovered') return providerRootHealthSummary(event, 'recovered');
  if (event.type === 'price.changed') return 'Pricing changed relative to the prior catalog evidence.';
  if (event.type === 'provider.updated') return 'Provider metadata changed relative to the prior catalog evidence.';
  if (event.type === 'provider.discovered') return 'Provider discovered in the Pay.sh catalog.';
  if (event.type === 'provider.removed_from_catalog') return 'Provider removed from the live Pay.sh catalog.';
  if (event.type === 'category.changed') return 'Provider category changed relative to the prior catalog evidence.';
  if (event.type === 'endpoint_count.changed') return 'Provider endpoint count changed relative to the prior catalog evidence.';
  if (event.type === 'metadata.changed') return 'Provider metadata fingerprint changed relative to the prior catalog evidence.';
  if (event.type === 'catalog.ingested') return `Pay.sh catalog ingested in ${event.payload.mode ?? 'unknown'} mode.`;
  if (event.type === 'schema.changed') return 'Schema changed relative to the prior catalog evidence.';
  if (event.type === 'manifest.updated') return 'Provider manifest changed relative to prior catalog evidence.';
  if (event.type === 'endpoint.updated') return 'Endpoint metadata changed relative to prior catalog evidence.';
  if (event.type === 'pricing_observed') return `Pricing observed as ${event.payload.raw ?? 'unknown'}.`;
  if (event.type === 'pay_sh_catalog_provider_seen') return 'Provider observed in the Pay.sh catalog.';
  if (event.type === 'pay_sh_catalog_endpoint_seen') return 'Endpoint observed in the Pay.sh catalog.';
  if (event.type === 'pay_sh_catalog_manifest_seen') return 'Manifest observed in the Pay.sh catalog.';
  if (event.type === 'pay_sh_catalog_schema_seen') return 'Schema observed in the Pay.sh catalog.';
  if (event.type === 'provider_metadata_observed') return 'Provider metadata observed in the Pay.sh catalog.';
  return event.type;
}
