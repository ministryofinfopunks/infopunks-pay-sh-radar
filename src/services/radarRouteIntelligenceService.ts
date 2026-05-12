import { RadarPreflightRequest, RadarPreflightResponse, RadarComparisonRequest, RadarComparisonResponse, RadarSuperiorityReadiness } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';
import { buildRadarExportSnapshot, NormalizedEndpointRecord } from './radarExportService';

export function runRadarPreflight(input: RadarPreflightRequest, store: IntelligenceStore): RadarPreflightResponse {
  const snapshot = buildRadarExportSnapshot(store);
  const trustByProvider = new Map(store.trustAssessments.map((item) => [item.entityId, item.score]));
  const signalByProvider = new Map(store.signalAssessments.map((item) => [item.entityId, item.score]));
  const category = input.category?.trim() || null;
  const constraints = input.constraints ?? {};
  const categoryCandidates = snapshot.endpoints.filter((endpoint) => !category || (endpoint.category ?? '').toLowerCase() === category.toLowerCase());

  const allCandidates = categoryCandidates.map((endpoint) => scoreCandidate(endpoint, trustByProvider.get(endpoint.provider_id) ?? null, signalByProvider.get(endpoint.provider_id) ?? null, constraints));
  allCandidates.sort((a, b) => b.confidence - a.confidence);

  const accepted = allCandidates.filter((candidate) => candidate.route_eligibility);
  const rejected = allCandidates.filter((candidate) => !candidate.route_eligibility);
  const recommended = accepted[0] ?? null;

  const readiness = buildSuperiorityReadiness(store);
  const executableInCategory = category
    ? readiness.categories_with_at_least_two_executable_mappings.includes(category)
    : false;

  return {
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    input,
    recommended_route: recommended,
    accepted_candidates: accepted,
    rejected_candidates: rejected,
    warnings: category ? [] : ['missing_category'],
    superiority_evidence_available: executableInCategory
  };
}

export function runRadarComparison(input: RadarComparisonRequest, store: IntelligenceStore): RadarComparisonResponse {
  const snapshot = buildRadarExportSnapshot(store);
  const ids = new Set(input.ids);
  const mode = input.mode;

  if (mode === 'provider') {
    const rows = snapshot.providers
      .filter((provider) => ids.has(provider.provider_id))
      .map((provider) => {
        const endpoints = snapshot.endpoints.filter((endpoint) => endpoint.provider_id === provider.provider_id);
        const mapped = endpoints.filter((endpoint) => Boolean(endpoint.method) && Boolean(endpoint.path));
        const routeEligible = endpoints.filter((endpoint) => endpoint.route_eligibility);
        const degraded = endpoints.filter((endpoint) => endpoint.degradation_status === 'degraded' || endpoint.reachability_status !== 'reachable');
        return {
          id: provider.provider_id,
          type: 'provider' as const,
          name: provider.provider_name ?? provider.provider_id,
          trust_score: provider.provider_trust_score,
          signal_score: provider.provider_signal_score,
          endpoint_count: endpoints.length,
          mapped_endpoint_count: mapped.length,
          route_eligible_endpoint_count: routeEligible.length,
          degradation_count: degraded.length,
          pricing_clarity: provider.pricing_clarity_score,
          metadata_quality: provider.metadata_quality_score,
          reachability: provider.reachability_status,
          last_observed: provider.catalog_observed_at,
          last_seen_healthy: lastSeenHealthy(store, provider.provider_id),
          route_recommendation: (routeEligible.length > 0 && provider.reachability_status === 'reachable' ? 'route_eligible' : 'not_recommended') as 'route_eligible' | 'not_recommended',
          rejection_reasons: routeEligible.length > 0 ? [] : collectTopReasons(endpoints)
        };
      });
    return { generated_at: new Date().toISOString(), mode, rows };
  }

  const rows = snapshot.endpoints
    .filter((endpoint) => ids.has(endpoint.endpoint_id))
    .map((endpoint) => ({
      id: endpoint.endpoint_id,
      type: 'endpoint' as const,
      name: endpoint.endpoint_name ?? endpoint.endpoint_id,
      trust_score: endpoint.provider_trust_score,
      signal_score: endpoint.provider_signal_score,
      endpoint_count: 1,
      mapped_endpoint_count: Boolean(endpoint.method) && Boolean(endpoint.path) ? 1 : 0,
      route_eligible_endpoint_count: endpoint.route_eligibility ? 1 : 0,
      degradation_count: endpoint.degradation_status === 'degraded' ? 1 : 0,
      pricing_clarity: endpoint.pricing_clarity_score,
      metadata_quality: endpoint.metadata_quality_score,
      reachability: endpoint.reachability_status,
      last_observed: endpoint.catalog_observed_at,
      last_seen_healthy: lastSeenHealthy(store, endpoint.provider_id),
      route_recommendation: (endpoint.route_eligibility ? 'route_eligible' : 'not_recommended') as 'route_eligible' | 'not_recommended',
      rejection_reasons: endpoint.route_eligibility ? [] : endpoint.route_rejection_reasons
    }));

  return { generated_at: new Date().toISOString(), mode, rows };
}

export function buildSuperiorityReadiness(store: IntelligenceStore): RadarSuperiorityReadiness {
  const snapshot = buildRadarExportSnapshot(store);
  const executable = snapshot.endpoints.filter((endpoint) => endpoint.route_eligibility && Boolean(endpoint.method) && Boolean(endpoint.path));
  const byCategory = new Map<string, Set<string>>();
  for (const endpoint of executable) {
    const category = endpoint.category ?? 'unknown';
    if (!byCategory.has(category)) byCategory.set(category, new Set());
    byCategory.get(category)?.add(endpoint.provider_id);
  }

  const categoriesReady: string[] = [];
  const categoriesNotReady: string[] = [];
  for (const provider of snapshot.providers) {
    const category = provider.category ?? 'unknown';
    const providers = byCategory.get(category) ?? new Set<string>();
    if (providers.size >= 2) {
      if (!categoriesReady.includes(category)) categoriesReady.push(category);
    } else if (!categoriesNotReady.includes(category)) {
      categoriesNotReady.push(category);
    }
  }

  const providersWithProof = Array.from(new Set(
    store.events
      .filter((event) => event.payload && typeof event.payload === 'object' && (event.payload as Record<string, unknown>).proven_paid_execution === true)
      .map((event) => event.provider_id ?? (typeof event.payload.providerId === 'string' ? event.payload.providerId : null))
      .filter((id): id is string => Boolean(id))
  ));

  const providersCatalogOnly = snapshot.providers
    .map((provider) => provider.provider_id)
    .filter((id) => !providersWithProof.includes(id));

  return {
    generated_at: new Date().toISOString(),
    executable_provider_mappings_count: executable.length,
    categories_with_at_least_two_executable_mappings: categoriesReady.sort(),
    categories_not_ready_for_comparison: categoriesNotReady.sort(),
    providers_with_proven_paid_execution: providersWithProof,
    providers_with_only_catalog_metadata: providersCatalogOnly,
    next_mappings_needed: buildNextMappingsNeeded(snapshot.endpoints)
  };
}

function scoreCandidate(endpoint: NormalizedEndpointRecord, trustScore: number | null, signalScore: number | null, constraints: RadarPreflightRequest['constraints']) {
  const rejection: string[] = [];
  const reasons: string[] = [];
  const pricing = parsePricing(endpoint.pricing);
  const mappingComplete = Boolean(endpoint.method) && Boolean(endpoint.path);
  const pricingKnown = pricing !== null;
  const reachable = endpoint.reachability_status === 'reachable';

  if (!mappingComplete) rejection.push('mapping_incomplete');
  if (endpoint.reachability_status === 'failed') rejection.push('provider_failed_not_recommended_for_routing');
  if (endpoint.reachability_status === 'degraded') rejection.push('provider_degraded_not_recommended_for_routing');
  if (endpoint.degradation_status === 'degraded') rejection.push('critical_degradation_not_recommended_for_routing');

  if (typeof constraints?.min_trust === 'number' && typeof trustScore === 'number' && trustScore < constraints.min_trust) rejection.push('trust_below_min_trust');
  if (typeof constraints?.min_trust === 'number' && trustScore === null) rejection.push('trust_missing');
  if (constraints?.require_pricing && !pricingKnown) rejection.push('pricing_missing');
  if (typeof constraints?.max_price_usd === 'number' && pricingKnown && pricing > constraints.max_price_usd) rejection.push('price_above_max_price_usd');
  if (constraints?.prefer_reachable && !reachable) rejection.push('not_reachable_under_preference');

  if (trustScore !== null) reasons.push(`trust=${trustScore}`);
  if (signalScore !== null) reasons.push(`signal=${signalScore}`);
  reasons.push(mappingComplete ? 'mapping_complete' : 'mapping_incomplete');
  reasons.push(pricingKnown ? 'pricing_clear' : 'pricing_unknown');
  reasons.push(`reachability=${endpoint.reachability_status}`);

  const trustWeight = trustScore ?? 0;
  const signalWeight = signalScore ?? 0;
  const mappingWeight = mappingComplete ? 100 : 0;
  const reachabilityWeight = endpoint.reachability_status === 'reachable' ? 100 : endpoint.reachability_status === 'degraded' ? 30 : 0;
  const pricingWeight = pricingKnown ? 100 : 40;
  const confidenceRaw = Math.round((trustWeight * 0.3) + (signalWeight * 0.25) + (mappingWeight * 0.2) + (reachabilityWeight * 0.15) + (pricingWeight * 0.1));

  return {
    provider_id: endpoint.provider_id,
    provider_name: endpoint.provider_name,
    endpoint_id: endpoint.endpoint_id,
    endpoint_name: endpoint.endpoint_name,
    trust_score: trustScore,
    signal_score: signalScore,
    route_eligibility: rejection.length === 0,
    confidence: Math.max(0, Math.min(100, confidenceRaw)),
    reasons,
    rejection_reasons: rejection.length ? rejection : [],
    mapping_status: mappingComplete ? 'complete' as const : 'missing' as const,
    reachability_status: endpoint.reachability_status,
    pricing_status: pricingKnown ? 'clear' as const : 'missing' as const,
    last_seen_healthy: lastSeenHealthyForEndpoint(endpoint)
  };
}

function parsePricing(pricing: unknown): number | null {
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) return null;
  const shape = pricing as Record<string, unknown>;
  const min = typeof shape.min === 'number' ? shape.min : null;
  const max = typeof shape.max === 'number' ? shape.max : null;
  return min ?? max;
}

function lastSeenHealthy(store: IntelligenceStore, providerId: string): string | null {
  const event = [...store.events]
    .filter((item) => (item.provider_id === providerId || item.entityId === providerId || item.payload.providerId === providerId) && (item.type === 'provider.reachable' || item.type === 'provider.recovered'))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
  return event?.observedAt ?? null;
}

function lastSeenHealthyForEndpoint(_endpoint: NormalizedEndpointRecord): string | null {
  return null;
}

function collectTopReasons(endpoints: NormalizedEndpointRecord[]) {
  const reasons = endpoints.flatMap((endpoint) => endpoint.route_rejection_reasons);
  return Array.from(new Set(reasons)).slice(0, 5);
}

function buildNextMappingsNeeded(endpoints: NormalizedEndpointRecord[]) {
  const byCategory = new Map<string, Set<string>>();
  for (const endpoint of endpoints) {
    const category = endpoint.category ?? 'unknown';
    const set = byCategory.get(category) ?? new Set<string>();
    if (endpoint.method && endpoint.path && endpoint.route_eligibility) set.add(endpoint.provider_id);
    byCategory.set(category, set);
  }
  const needed: string[] = [];
  for (const [category, providers] of byCategory.entries()) {
    if (providers.size < 2) needed.push(`${category}: +${2 - providers.size} executable mapping(s)`);
  }
  return needed.sort();
}
