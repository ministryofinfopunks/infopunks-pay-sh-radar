import { InfopunksEvent, IngestionRun } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';
import { DataSourceState } from '../persistence/repository';

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
  providerActivity: Record<RollingWindow, ProviderActivity[]>;
  signalSpikes: ScoreDelta[];
  data_source: DataSourceState;
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
  type: InfopunksEvent['type'];
  category: EventCategory;
  source: string;
  entityType: InfopunksEvent['entityType'];
  entityId: string;
  providerId: string | null;
  providerName: string | null;
  observedAt: string;
  summary: string;
  payload: InfopunksEvent['payload'];
};

export type ScoreDelta = {
  eventId: string;
  providerId: string;
  providerName: string;
  score: number | null;
  previousScore: number | null;
  delta: number | null;
  observedAt: string;
  direction: 'up' | 'down' | 'flat' | 'unknown';
};

export type ProviderActivity = {
  providerId: string;
  providerName: string;
  count: number;
  categories: Record<EventCategory, number>;
  lastObservedAt: string | null;
};

const categories: EventCategory[] = ['discovery', 'trust', 'monitoring', 'pricing', 'schema', 'signal'];
const windows: Record<RollingWindow, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
};

export function pulseSummary(store: IntelligenceStore, generatedAt = new Date().toISOString(), ingestIntervalMs: number | null = null): PulseSummary {
  const orderedEvents = [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const providerNames = new Map(store.providers.map((provider) => [provider.id, provider.name]));
  const pulseEvents = orderedEvents.map((event) => toPulseEvent(event, providerNames));
  const eventGroups = Object.fromEntries(categories.map((category) => [category, { count: 0, recent: [] as PulseEvent[] }])) as PulseSummary['eventGroups'];
  const latestEventAt = pulseEvents[0]?.observedAt ?? null;
  const dataSource = dataSourceState(store, generatedAt);
  const latestRun = latestIngestionRun(store, dataSource);

  for (const event of pulseEvents) {
    const group = eventGroups[event.category];
    group.count += 1;
    if (group.recent.length < 20) group.recent.push(event);
  }

  const trustDeltas = scoreDeltas(pulseEvents, 'trust_assessment', providerNames).slice(0, 20);
  const signalDeltas = scoreDeltas(pulseEvents, 'signal_assessment', providerNames).slice(0, 20);

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
    timeline: pulseEvents.slice(0, 120),
    trustDeltas,
    signalDeltas,
    recentDegradations: pulseEvents.filter((event) => event.type === 'endpoint.degraded' || event.type === 'endpoint.failed' || event.type === 'provider.degraded' || event.type === 'provider.failed').slice(0, 20),
    providerActivity: providerActivity(pulseEvents, generatedAt),
    signalSpikes: signalDeltas.filter((delta) => (delta.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 10),
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

function toPulseEvent(event: InfopunksEvent, providerNames: Map<string, string>): PulseEvent {
  const providerId = providerIdForEvent(event);
  return {
    id: event.id,
    type: event.type,
    category: categoryForEvent(event),
    source: event.source,
    entityType: event.entityType,
    entityId: event.entityId,
    providerId,
    providerName: providerId ? providerNames.get(providerId) ?? providerId : null,
    observedAt: event.observedAt,
    summary: summaryForEvent(event),
    payload: event.payload
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

function scoreDeltas(events: PulseEvent[], entityType: 'trust_assessment' | 'signal_assessment', providerNames: Map<string, string>): ScoreDelta[] {
  return events
    .filter((event) => event.type === 'score_assessment_created' && event.entityType === entityType && event.providerId)
    .map((event): ScoreDelta => {
      const score = numberOrNull(event.payload.score);
      const previousScore = numberOrNull(event.payload.previousScore);
      const delta = numberOrNull(event.payload.delta);
      return {
        eventId: event.id,
        providerId: event.providerId!,
        providerName: providerNames.get(event.providerId!) ?? event.providerId!,
        score,
        previousScore,
        delta,
        observedAt: event.observedAt,
        direction: delta === null ? 'unknown' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
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
      providerName: event.providerName ?? event.providerId,
      count: 0,
      categories: Object.fromEntries(categories.map((category) => [category, 0])) as Record<EventCategory, number>,
      lastObservedAt: null
    };
    current.count += 1;
    current.categories[event.category] += 1;
    if (!current.lastObservedAt || Date.parse(event.observedAt) > Date.parse(current.lastObservedAt)) current.lastObservedAt = event.observedAt;
    activity.set(event.providerId, current);
  }
  return [...activity.values()].sort((a, b) => b.count - a.count || a.providerName.localeCompare(b.providerName)).slice(0, 12);
}

function unknownTelemetryCount(store: IntelligenceStore) {
  return store.trustAssessments.reduce((sum, assessment) => sum + assessment.unknowns.length, 0) + store.signalAssessments.reduce((sum, assessment) => sum + assessment.unknowns.length, 0);
}

function latestIngestionRun(store: IntelligenceStore, dataSource: DataSourceState): LatestIngestionRun | null {
  const run = [...(store.ingestionRuns ?? [])].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  if (!run) return null;
  const emittedEvents = store.events.filter((event) => event.observedAt === run.startedAt || event.observedAt === run.finishedAt).length;
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
  if (event.type === 'provider.checked') return `Service reachability checked with success ${event.payload.success ?? 'unknown'} and latency ${event.payload.response_time_ms ?? 'unknown'}ms.`;
  if (event.type === 'provider.reachable') return 'Service reachability is healthy from safe metadata monitoring.';
  if (event.type === 'provider.degraded') return `Service reachability degraded with latency ${event.payload.response_time_ms ?? 'unknown'}ms and HTTP ${event.payload.status_code ?? 'unknown'}.`;
  if (event.type === 'provider.failed') return `Service reachability failed with error ${event.payload.error_message ?? event.payload.status_code ?? 'unknown'}.`;
  if (event.type === 'provider.recovered') return 'Service reachability recovered after a prior failed or degraded safe metadata check.';
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
