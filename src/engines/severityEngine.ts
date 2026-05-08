import { InfopunksEvent, NarrativeCluster, Provider, SignalAssessment, TrustAssessment } from '../schemas/entities';
import { resolveEventObservedAt } from '../services/eventTimestamp';

export const severityLevels = ['critical', 'warning', 'informational', 'unknown'] as const;
export type Severity = typeof severityLevels[number];

export type SeverityMetadata = {
  severity: Severity;
  severity_reason: string;
  severity_score?: number;
  severity_window?: string;
};

const DEGRADED_WINDOW_MS = 60 * 60 * 1000;
const WARNING_DEGRADATION_COUNT = 2;
const CRITICAL_DEGRADATION_COUNT = 4;
const RAPID_TRUST_COLLAPSE_DELTA = -25;
const MODERATE_TRUST_DROP_DELTA = -10;
const HIGH_UNKNOWN_TELEMETRY_COUNT = 5;
const LATENCY_SPIKE_MS = 1000;

export function severityRank(severity: Severity) {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  if (severity === 'informational') return 2;
  return 3;
}

export function compareSeverity(a: SeverityMetadata, b: SeverityMetadata) {
  return severityRank(a.severity) - severityRank(b.severity) || (b.severity_score ?? 0) - (a.severity_score ?? 0);
}

export function classifyEventSeverity(event: InfopunksEvent, relatedEvents: InfopunksEvent[] = []): SeverityMetadata {
  const repeated = repeatedDegradationMetadata(event, relatedEvents);
  if (repeated) return repeated;

  if (event.type === 'provider.failed') {
    return { severity: 'critical', severity_reason: 'Provider service URL is unreachable from the safe metadata monitor.', severity_score: 100 };
  }
  if (event.type === 'provider.degraded') {
    if (typeof event.payload.status_code === 'number' && event.payload.status_code >= 400) {
      return { severity: 'warning', severity_reason: `Provider root health returned HTTP ${event.payload.status_code}.`, severity_score: 70 };
    }
    if (isLatencySpike(event.payload.response_time_ms)) return latencySpikeSeverity(event.payload.response_time_ms);
    return { severity: 'warning', severity_reason: 'Provider reachability degraded during safe metadata monitoring.', severity_score: 65 };
  }
  if (event.type === 'endpoint.failed') {
    return { severity: 'critical', severity_reason: 'Endpoint monitor check failed or returned invalid response evidence.', severity_score: 95 };
  }
  if (event.type === 'endpoint.degraded') {
    if (isLatencySpike(event.payload.response_time_ms)) return latencySpikeSeverity(event.payload.response_time_ms);
    return { severity: 'warning', severity_reason: 'Endpoint monitor check degraded on latency or response validity.', severity_score: 65 };
  }
  if (event.type === 'metadata.changed' && malformedCatalogPayload(event.payload)) {
    return { severity: 'critical', severity_reason: 'Catalog metadata diff includes malformed or corrupt fields.', severity_score: 90 };
  }
  if (event.type === 'provider_metadata_observed' && incompleteProviderMetadata(event.payload)) {
    return { severity: 'warning', severity_reason: 'Provider catalog metadata is incomplete.', severity_score: 55 };
  }
  if (event.type === 'pay_sh_catalog_endpoint_seen' && incompleteEndpointMetadata(event.payload)) {
    return { severity: 'warning', severity_reason: 'Endpoint catalog metadata is incomplete.', severity_score: 55 };
  }
  if (event.type === 'score_assessment_created') return classifyScoreChangeSeverity(event.entityType, numeric(event.payload.delta), unknownCount(event.payload.unknowns));
  if (event.type === 'catalog.ingested') return { severity: 'informational', severity_reason: 'Pay.sh catalog refresh completed.', severity_score: 10 };
  if (event.type === 'provider.discovered' || event.type === 'pay_sh_catalog_provider_seen') return { severity: 'informational', severity_reason: 'New or existing provider observed in catalog evidence.', severity_score: 20 };
  if (event.type === 'pay_sh_catalog_endpoint_seen') return { severity: 'informational', severity_reason: 'Endpoint observed in catalog evidence.', severity_score: 20 };
  if (event.type === 'provider.reachable' || event.type === 'provider.recovered' || event.type === 'endpoint.recovered') return { severity: 'informational', severity_reason: 'Healthy reachability state observed.', severity_score: 15 };
  if (event.type === 'provider.checked' && event.payload.success === true) return { severity: 'informational', severity_reason: 'Provider network reachability check succeeded.', severity_score: 15 };
  if (event.type === 'endpoint.checked' && event.payload.success === true) return { severity: 'informational', severity_reason: 'Endpoint health check succeeded.', severity_score: 15 };
  return { severity: 'unknown', severity_reason: 'No deterministic severity rule matched this event.', severity_score: 0 };
}

export function classifyScoreChangeSeverity(entityType: InfopunksEvent['entityType'], delta: number | null, unknowns = 0): SeverityMetadata {
  if (entityType === 'trust_assessment') {
    if (delta !== null && delta <= RAPID_TRUST_COLLAPSE_DELTA) {
      return { severity: 'critical', severity_reason: `Rapid trust collapse detected (${delta}).`, severity_score: Math.min(100, Math.abs(delta) * 3) };
    }
    if (delta !== null && delta <= MODERATE_TRUST_DROP_DELTA) {
      return { severity: 'warning', severity_reason: `Moderate trust drop detected (${delta}).`, severity_score: Math.min(80, Math.abs(delta) * 3) };
    }
  }
  if (unknowns >= HIGH_UNKNOWN_TELEMETRY_COUNT) {
    return { severity: 'warning', severity_reason: `Rising unknown telemetry detected (${unknowns} unknown fields).`, severity_score: Math.min(80, unknowns * 10) };
  }
  if (delta === null) return { severity: 'informational', severity_reason: 'Initial deterministic score assessment created.', severity_score: 10 };
  return { severity: 'informational', severity_reason: 'Score assessment changed without crossing severity thresholds.', severity_score: Math.min(40, Math.abs(delta)) };
}

export function classifyProviderDossierSeverity(provider: Provider, trust: TrustAssessment | null, signal: SignalAssessment | null, events: InfopunksEvent[] = []): SeverityMetadata {
  const latestMonitor = [...events]
    .filter((event) => event.entityType === 'provider' && event.entityId === provider.id && (event.type === 'provider.failed' || event.type === 'provider.degraded' || event.type === 'provider.reachable'))
    .sort((a, b) => Date.parse(resolveEventObservedAt(b, b.observedAt) ?? b.observedAt) - Date.parse(resolveEventObservedAt(a, a.observedAt) ?? a.observedAt))[0];
  if (latestMonitor) return classifyEventSeverity(latestMonitor, events);
  if (provider.endpointMetadataPartial) return { severity: 'warning', severity_reason: 'Provider has incomplete endpoint metadata in the catalog feed.', severity_score: 55 };
  const unknowns = (trust?.unknowns.length ?? 0) + (signal?.unknowns.length ?? 0);
  if (unknowns >= HIGH_UNKNOWN_TELEMETRY_COUNT) return { severity: 'warning', severity_reason: `Provider dossier has ${unknowns} unknown telemetry fields.`, severity_score: Math.min(80, unknowns * 10) };
  return { severity: 'informational', severity_reason: 'Provider dossier has no active critical or warning severity signal.', severity_score: 10 };
}

export function classifyNarrativeClusterSeverity(cluster: NarrativeCluster): SeverityMetadata {
  if (cluster.heat === null || cluster.momentum === null) return { severity: 'unknown', severity_reason: 'Narrative cluster heat or momentum is unknown.', severity_score: 0 };
  if (cluster.heat >= 85 && cluster.momentum >= 85) return { severity: 'warning', severity_reason: 'Narrative cluster heat and momentum are elevated.', severity_score: 60 };
  return { severity: 'informational', severity_reason: 'Narrative cluster is currently informational ecosystem context.', severity_score: Math.round((cluster.heat + cluster.momentum) / 10) };
}

export function classifyGraphSeverity(kind: 'provider' | 'narrative' | 'category' | 'edge' | 'graph', metadata?: SeverityMetadata | null): SeverityMetadata {
  if (metadata) return metadata;
  return { severity: kind === 'graph' ? 'informational' : 'unknown', severity_reason: `${kind} graph element has no active severity signal.`, severity_score: kind === 'graph' ? 10 : 0 };
}

export function severityFromEvidence(value: unknown): SeverityMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isSeverity(record.severity) || typeof record.severity_reason !== 'string') return null;
  return {
    severity: record.severity,
    severity_reason: record.severity_reason,
    severity_score: typeof record.severity_score === 'number' ? record.severity_score : undefined,
    severity_window: typeof record.severity_window === 'string' ? record.severity_window : undefined
  };
}

function repeatedDegradationMetadata(event: InfopunksEvent, relatedEvents: InfopunksEvent[]): SeverityMetadata | null {
  if (event.type !== 'provider.degraded' && event.type !== 'endpoint.degraded') return null;
  const entityId = event.entityId;
  const entityType = event.entityType;
  const eventObservedAt = resolveEventObservedAt(event, event.observedAt) ?? event.observedAt;
  const threshold = Date.parse(eventObservedAt) - DEGRADED_WINDOW_MS;
  const count = relatedEvents.filter((candidate) => {
    const candidateObservedAt = resolveEventObservedAt(candidate, candidate.observedAt);
    if (!candidateObservedAt) return false;
    return candidate.entityType === entityType
      && candidate.entityId === entityId
      && candidate.type === event.type
      && Date.parse(candidateObservedAt) >= threshold
      && Date.parse(candidateObservedAt) <= Date.parse(eventObservedAt);
  }).length;
  if (count >= CRITICAL_DEGRADATION_COUNT) return { severity: 'critical', severity_reason: `${count} repeated degradations detected in the severity window.`, severity_score: 90, severity_window: '1h' };
  if (count >= WARNING_DEGRADATION_COUNT) return { severity: 'warning', severity_reason: `${count} repeated degradations detected in the severity window.`, severity_score: 70, severity_window: '1h' };
  return null;
}

function latencySpikeSeverity(value: unknown): SeverityMetadata {
  return { severity: 'warning', severity_reason: `Latency spike detected at ${value}ms.`, severity_score: 60, severity_window: 'single_check' };
}

function isLatencySpike(value: unknown) {
  return typeof value === 'number' && value > LATENCY_SPIKE_MS;
}

function incompleteProviderMetadata(payload: Record<string, unknown>) {
  return !payload.description || !payload.category || !payload.namespace || !payload.endpointCount;
}

function incompleteEndpointMetadata(payload: Record<string, unknown>) {
  return payload.path === null || payload.method === null || payload.path === undefined || payload.method === undefined;
}

function malformedCatalogPayload(payload: Record<string, unknown>) {
  const after = payload.after && typeof payload.after === 'object' ? payload.after as Record<string, unknown> : payload;
  return after.category === null || after.title === null || after.endpoint_count === null || after.endpointCount === null;
}

function unknownCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function numeric(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (severityLevels as readonly string[]).includes(value);
}
