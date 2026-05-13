import { InfopunksEvent } from '../schemas/entities';
import { buildRadarExportSnapshot } from './radarExportService';
import { IntelligenceStore } from './intelligenceStore';
import { buildEndpointRiskAssessment, buildProviderRiskAssessment } from './radarRiskService';
import { deriveCostPerformanceFields } from './radarRouteIntelligenceService';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/[",\n]/.test(normalized)) return `"${normalized.replace(/"/g, '""')}"`;
  return normalized;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.map(csvEscape).join(',');
  const body = rows.map((row) => headers.map((key) => csvEscape(row[key])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}

export function providersCsv(store: IntelligenceStore) {
  const snapshot = buildRadarExportSnapshot(store);
  const headers = [
    'generated_at', 'source', 'provider_id', 'provider_name', 'category', 'trust_score', 'signal_score', 'risk_level', 'risk_score',
    'endpoint_count', 'route_eligible_endpoint_count', 'degradation_count', 'pricing_clarity', 'metadata_quality', 'reachability_status',
    'last_seen_healthy_at', 'last_degraded_at', 'last_failed_at'
  ];
  const rows = snapshot.providers.map((provider) => {
    const endpoints = snapshot.endpoints.filter((item) => item.provider_id === provider.provider_id);
    const risk = buildProviderRiskAssessment(store, provider.provider_id);
    return {
      generated_at: snapshot.generated_at,
      source: 'infopunks-pay-sh-radar',
      provider_id: provider.provider_id,
      provider_name: provider.provider_name,
      category: provider.category,
      trust_score: provider.provider_trust_score,
      signal_score: provider.provider_signal_score,
      risk_level: risk?.predictive_risk_level ?? 'unknown',
      risk_score: risk?.predictive_risk_score ?? null,
      endpoint_count: endpoints.length,
      route_eligible_endpoint_count: endpoints.filter((item) => item.route_eligibility).length,
      degradation_count: endpoints.filter((item) => item.degradation_status === 'degraded').length,
      pricing_clarity: provider.pricing_clarity_score,
      metadata_quality: provider.metadata_quality_score,
      reachability_status: provider.reachability_status,
      last_seen_healthy_at: lastEventAt(store.events, provider.provider_id, ['provider.reachable', 'provider.recovered']),
      last_degraded_at: lastEventAt(store.events, provider.provider_id, ['provider.degraded', 'endpoint.degraded']),
      last_failed_at: lastEventAt(store.events, provider.provider_id, ['provider.failed', 'endpoint.failed'])
    };
  });
  return toCsv(headers, rows);
}

export function endpointsCsv(store: IntelligenceStore) {
  const snapshot = buildRadarExportSnapshot(store);
  const headers = [
    'generated_at', 'source', 'endpoint_id', 'endpoint_name', 'provider_id', 'provider_name', 'category', 'method', 'path_or_url',
    'route_eligibility', 'mapping_status', 'pricing_status', 'estimated_min_price', 'estimated_max_price', 'pricing_unit', 'pricing_confidence',
    'trust_score', 'signal_score', 'risk_level', 'recommended_action'
  ];
  const rows = snapshot.endpoints.map((endpoint) => {
    const risk = buildEndpointRiskAssessment(store, endpoint.endpoint_id);
    const perf = deriveCostPerformanceFields(endpoint);
    return {
      generated_at: snapshot.generated_at,
      source: 'infopunks-pay-sh-radar',
      endpoint_id: endpoint.endpoint_id,
      endpoint_name: endpoint.endpoint_name,
      provider_id: endpoint.provider_id,
      provider_name: endpoint.provider_name,
      category: endpoint.category,
      method: endpoint.method,
      path_or_url: endpoint.path ?? endpoint.url,
      route_eligibility: endpoint.route_eligibility,
      mapping_status: endpoint.method && endpoint.path ? 'complete' : 'missing',
      pricing_status: perf.pricing_known ? 'known' : 'unknown',
      estimated_min_price: perf.estimated_min_price,
      estimated_max_price: perf.estimated_max_price,
      pricing_unit: perf.pricing_unit,
      pricing_confidence: perf.pricing_confidence,
      trust_score: endpoint.provider_trust_score,
      signal_score: endpoint.provider_signal_score,
      risk_level: risk?.predictive_risk_level ?? 'unknown',
      recommended_action: risk?.recommended_action ?? 'insufficient history'
    };
  });
  return toCsv(headers, rows);
}

export function routeCandidatesCsv(store: IntelligenceStore) {
  const snapshot = buildRadarExportSnapshot(store);
  const headers = [
    'generated_at', 'source', 'provider_id', 'provider_name', 'endpoint_id', 'endpoint_name', 'category', 'route_eligibility', 'reachability_status',
    'risk_level', 'pricing_known', 'estimated_min_price', 'estimated_max_price', 'pricing_confidence', 'route_value_score', 'value_score_reason', 'catalog_estimated'
  ];
  const rows = snapshot.endpoints.map((endpoint) => {
    const risk = buildEndpointRiskAssessment(store, endpoint.endpoint_id);
    const perf = deriveCostPerformanceFields(endpoint);
    return {
      generated_at: snapshot.generated_at,
      source: 'infopunks-pay-sh-radar',
      provider_id: endpoint.provider_id,
      provider_name: endpoint.provider_name,
      endpoint_id: endpoint.endpoint_id,
      endpoint_name: endpoint.endpoint_name,
      category: endpoint.category,
      route_eligibility: endpoint.route_eligibility,
      reachability_status: endpoint.reachability_status,
      risk_level: risk?.predictive_risk_level ?? 'unknown',
      pricing_known: perf.pricing_known,
      estimated_min_price: perf.estimated_min_price,
      estimated_max_price: perf.estimated_max_price,
      pricing_confidence: perf.pricing_confidence,
      route_value_score: perf.route_value_score,
      value_score_reason: perf.value_score_reason,
      catalog_estimated: true
    };
  });
  return toCsv(headers, rows);
}

export function degradationsCsv(store: IntelligenceStore) {
  const snapshot = buildRadarExportSnapshot(store);
  const events = [...store.events]
    .filter((event) => event.type === 'provider.degraded' || event.type === 'provider.failed' || event.type === 'endpoint.degraded' || event.type === 'endpoint.failed')
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const headers = ['generated_at', 'source', 'event_id', 'type', 'provider_id', 'provider_name', 'endpoint_id', 'observed_at', 'severity', 'summary'];
  const providerById = new Map(snapshot.providers.map((item) => [item.provider_id, item.provider_name]));
  const rows = events.map((event) => ({
    generated_at: snapshot.generated_at,
    source: 'infopunks-pay-sh-radar',
    event_id: event.id,
    type: event.type,
    provider_id: event.provider_id ?? null,
    provider_name: event.provider_id ? providerById.get(event.provider_id) ?? null : null,
    endpoint_id: event.endpoint_id ?? null,
    observed_at: event.observed_at ?? event.observedAt,
    severity: event.severity ?? 'unknown',
    summary: typeof event.payload?.summary === 'string' ? event.payload.summary : null
  }));
  return toCsv(headers, rows);
}

function lastEventAt(events: InfopunksEvent[], providerId: string, types: string[]) {
  return events
    .filter((event) => (event.provider_id === providerId || event.entityId === providerId || event.payload.providerId === providerId) && types.includes(event.type))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]?.observedAt ?? null;
}
