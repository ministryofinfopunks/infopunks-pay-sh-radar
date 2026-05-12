import { createHash } from 'node:crypto';
import { normalizeJson } from '../persistence/jsonb';
import { Endpoint, Provider } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';

export type NormalizedEndpointRecord = {
  endpoint_id: string;
  endpoint_name: string | null;
  provider_id: string;
  provider_name: string | null;
  category: string | null;
  method: string | null;
  path: string | null;
  url: string | null;
  description: string | null;
  pricing: unknown;
  input_schema: unknown;
  output_schema: unknown;
  catalog_observed_at: string | null;
  catalog_generated_at: string | null;
  provider_trust_score: number | null;
  provider_signal_score: number | null;
  provider_grade: string | null;
  reachability_status: 'reachable' | 'degraded' | 'failed' | 'unknown';
  degradation_status: 'degraded' | 'healthy' | 'unknown';
  route_eligibility: boolean;
  route_rejection_reasons: string[];
  metadata_quality_score: number | null;
  pricing_clarity_score: number | null;
  source: string | null;
};

export function buildRadarExportSnapshot(store: IntelligenceStore) {
  const generatedAt = new Date().toISOString();
  const trustByProvider = new Map(store.trustAssessments.map((item) => [item.entityId, item]));
  const signalByProvider = new Map(store.signalAssessments.map((item) => [item.entityId, item]));
  const providerById = new Map(store.providers.map((provider) => [provider.id, provider]));

  const providers = store.providers.map((provider) => {
    const trust = trustByProvider.get(provider.id) ?? null;
    const signal = signalByProvider.get(provider.id) ?? null;
    const reachability = providerReachabilityStatus(store, provider.id);
    const degradation = providerDegradationStatus(provider, reachability);
    return {
      provider_id: provider.id,
      provider_name: provider.name,
      category: provider.category,
      catalog_observed_at: provider.observed_at ?? provider.observedAt ?? provider.lastSeenAt ?? null,
      catalog_generated_at: provider.catalog_generated_at ?? provider.catalogGeneratedAt ?? null,
      provider_trust_score: trust?.score ?? null,
      provider_signal_score: signal?.score ?? null,
      provider_grade: trust?.grade ?? 'unknown',
      reachability_status: reachability,
      degradation_status: degradation,
      metadata_quality_score: trust?.components.metadataQuality ?? null,
      pricing_clarity_score: trust?.components.pricingClarity ?? null,
      source: provider.source ?? null
    };
  });

  const endpoints = store.endpoints.map((endpoint) => normalizeEndpointRecord(endpoint, providerById.get(endpoint.providerId) ?? null, trustByProvider.get(endpoint.providerId) ?? null, signalByProvider.get(endpoint.providerId) ?? null, store));

  const routeCandidates = endpoints.filter((endpoint) => endpoint.route_eligibility);
  const groupedByCategory = groupBy(routeCandidates, (item) => item.category ?? 'unknown');
  const groupedByProvider = groupBy(routeCandidates, (item) => item.provider_id);

  return {
    generated_at: generatedAt,
    source: sourceMetadata(store),
    providers,
    endpoints,
    route_candidates: {
      by_category: groupedByCategory,
      by_provider: groupedByProvider,
      count: routeCandidates.length,
      total_endpoints: endpoints.length
    }
  };
}

export function normalizeEndpointRecord(
  endpoint: Endpoint,
  provider: Provider | null,
  trust: IntelligenceStore['trustAssessments'][number] | null,
  signal: IntelligenceStore['signalAssessments'][number] | null,
  store: IntelligenceStore
): NormalizedEndpointRecord {
  const methodPath = extractMethodPath(endpoint.method, endpoint.path);
  const endpointId = deriveEndpointId(endpoint, provider?.id ?? endpoint.providerId);
  const endpointSchema = normalizeSchema(endpoint.schema);
  const [inputSchema, outputSchema] = splitInputOutputSchema(endpointSchema);
  const reachability = providerReachabilityStatus(store, endpoint.providerId);
  const degradation = endpoint.status === 'degraded' || reachability === 'degraded' || reachability === 'failed' ? 'degraded' : endpoint.status === 'available' ? 'healthy' : 'unknown';
  const eligibility = deriveRouteEligibility({
    trustScore: trust?.score ?? null,
    providerGrade: trust?.grade ?? 'unknown',
    reachability,
    endpointStatus: endpoint.status,
    method: methodPath.method
  });

  return {
    endpoint_id: endpointId,
    endpoint_name: endpoint.name ?? null,
    provider_id: provider?.id ?? endpoint.providerId,
    provider_name: provider?.name ?? null,
    category: endpoint.category ?? provider?.category ?? null,
    method: methodPath.method,
    path: methodPath.path,
    url: buildEndpointUrl(provider?.serviceUrl ?? null, methodPath.path),
    description: endpoint.description ?? null,
    pricing: normalizePricing(endpoint.pricing),
    input_schema: inputSchema,
    output_schema: outputSchema,
    catalog_observed_at: endpoint.observed_at ?? endpoint.observedAt ?? endpoint.lastSeenAt ?? null,
    catalog_generated_at: endpoint.catalog_generated_at ?? endpoint.catalogGeneratedAt ?? provider?.catalog_generated_at ?? provider?.catalogGeneratedAt ?? null,
    provider_trust_score: trust?.score ?? null,
    provider_signal_score: signal?.score ?? null,
    provider_grade: trust?.grade ?? 'unknown',
    reachability_status: reachability,
    degradation_status: degradation,
    route_eligibility: eligibility.eligible,
    route_rejection_reasons: eligibility.reasons,
    metadata_quality_score: trust?.components.metadataQuality ?? null,
    pricing_clarity_score: trust?.components.pricingClarity ?? null,
    source: endpoint.source ?? provider?.source ?? null
  };
}

export function deriveEndpointId(endpoint: Partial<Endpoint>, providerId: string) {
  if (typeof endpoint.id === 'string' && endpoint.id.length > 0) return endpoint.id;
  const stable = JSON.stringify(normalizeJson({ providerId, name: endpoint.name ?? null, method: endpoint.method ?? null, path: endpoint.path ?? null }));
  return `ep-${createHash('sha256').update(stable).digest('hex').slice(0, 24)}`;
}

export function extractMethodPath(method: unknown, path: unknown) {
  const cleanPath = typeof path === 'string' ? path.trim() : null;
  const cleanMethod = typeof method === 'string' ? method.trim().toUpperCase() : null;

  if (cleanMethod && cleanPath) return { method: cleanMethod, path: cleanPath };
  if (cleanPath) {
    const match = cleanPath.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
    if (match) return { method: match[1].toUpperCase(), path: match[2].trim() };
    return { method: cleanMethod, path: cleanPath };
  }

  return { method: cleanMethod, path: null };
}

export function normalizePricing(pricing: unknown) {
  const normalized = normalizeJson(pricing);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) return normalized;
  const raw = normalized as Record<string, unknown>;
  return {
    min: asNumberOrNull(raw.min),
    max: asNumberOrNull(raw.max),
    currency: typeof raw.currency === 'string' ? raw.currency : null,
    unit: typeof raw.unit === 'string' ? raw.unit : null,
    clarity: typeof raw.clarity === 'string' ? raw.clarity : null,
    raw: typeof raw.raw === 'string' ? raw.raw : null,
    source: typeof raw.source === 'string' ? raw.source : null
  };
}

export function normalizeSchema(schema: unknown) {
  return normalizeJson(schema ?? null);
}

export function deriveRouteEligibility(input: {
  trustScore: number | null;
  providerGrade: string | null;
  reachability: 'reachable' | 'degraded' | 'failed' | 'unknown';
  endpointStatus: 'available' | 'degraded' | 'unknown';
  method: string | null;
}) {
  const reasons = deriveRouteRejectionReasons(input);
  return { eligible: reasons.length === 0, reasons };
}

export function deriveRouteRejectionReasons(input: {
  trustScore: number | null;
  providerGrade: string | null;
  reachability: 'reachable' | 'degraded' | 'failed' | 'unknown';
  endpointStatus: 'available' | 'degraded' | 'unknown';
  method: string | null;
}) {
  const reasons: string[] = [];
  if (input.trustScore === null) reasons.push('trust_score_unknown');
  if (typeof input.trustScore === 'number' && input.trustScore < 70) reasons.push('trust_score_below_threshold_70');
  if (input.providerGrade === 'D' || input.providerGrade === 'unknown') reasons.push('provider_grade_not_route_ready');
  if (input.reachability === 'failed') reasons.push('provider_unreachable');
  if (input.reachability === 'degraded') reasons.push('provider_degraded');
  if (input.endpointStatus === 'degraded') reasons.push('endpoint_degraded');
  if (!input.method) reasons.push('endpoint_method_unknown');
  return reasons;
}

export function safeJsonExport<T>(value: T): ReturnType<typeof normalizeJson> {
  return normalizeJson(value);
}

function providerReachabilityStatus(store: IntelligenceStore, providerId: string): 'reachable' | 'degraded' | 'failed' | 'unknown' {
  const latest = [...store.events]
    .filter((event) => event.provider_id === providerId || event.payload.providerId === providerId || (event.entityType === 'provider' && event.entityId === providerId))
    .filter((event) => event.type === 'provider.reachable' || event.type === 'provider.degraded' || event.type === 'provider.failed')
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];

  if (!latest) return 'unknown';
  if (latest.type === 'provider.reachable') return 'reachable';
  if (latest.type === 'provider.degraded') return 'degraded';
  if (latest.type === 'provider.failed') return 'failed';
  return 'unknown';
}

function providerDegradationStatus(provider: Provider, reachability: 'reachable' | 'degraded' | 'failed' | 'unknown'): 'degraded' | 'healthy' | 'unknown' {
  if (reachability === 'failed' || reachability === 'degraded') return 'degraded';
  if (provider.severity === 'warning' || provider.severity === 'critical') return 'degraded';
  if (reachability === 'reachable' || provider.severity === 'informational') return 'healthy';
  return 'unknown';
}

function splitInputOutputSchema(schema: unknown): [unknown, unknown] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [null, null];
  const shape = schema as Record<string, unknown>;
  return [
    shape.input ?? shape.request ?? shape.params ?? null,
    shape.output ?? shape.response ?? shape.result ?? null
  ];
}

function buildEndpointUrl(serviceUrl: string | null, path: string | null) {
  if (!serviceUrl) return null;
  if (!path) return serviceUrl;
  try {
    return new URL(path, serviceUrl.endsWith('/') ? serviceUrl : `${serviceUrl}/`).toString();
  } catch {
    return serviceUrl;
  }
}

function sourceMetadata(store: IntelligenceStore) {
  return {
    mode: store.dataSource?.mode ?? 'fixture_fallback',
    url: store.dataSource?.url ?? null,
    generated_at: store.dataSource?.generated_at ?? null,
    last_ingested_at: store.dataSource?.last_ingested_at ?? null,
    used_fixture: store.dataSource?.used_fixture ?? true,
    error: store.dataSource?.error ?? null
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  return grouped;
}

function asNumberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
