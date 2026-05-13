import {
  RadarPreflightRequest,
  RadarPreflightResponse,
  RadarComparisonRequest,
  RadarComparisonResponse,
  RadarSuperiorityReadiness,
  RadarBatchPreflightRequest,
  RadarBatchPreflightResponse,
  RadarBenchmarkReadiness
} from '../schemas/entities';
import { RadarPreflightRequestSchema } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';
import { buildRadarExportSnapshot, NormalizedEndpointRecord } from './radarExportService';
import { trendContextForProvider } from './radarHistoryService';
import { buildEndpointRiskAssessment, buildProviderRiskAssessment, RiskLevel } from './radarRiskService';

export function runRadarPreflight(input: RadarPreflightRequest, store: IntelligenceStore): RadarPreflightResponse {
  const snapshot = buildRadarExportSnapshot(store);
  const trustByProvider = new Map(store.trustAssessments.map((item) => [item.entityId, item.score]));
  const signalByProvider = new Map(store.signalAssessments.map((item) => [item.entityId, item.score]));
  const category = input.category?.trim() || null;
  const constraints = input.constraints ?? {};
  const allowRiskyRoutes = constraints.allow_risky_routes === true;
  const categoryCandidates = snapshot.endpoints.filter((endpoint) => !category || (endpoint.category ?? '').toLowerCase() === category.toLowerCase());

  const allCandidates = categoryCandidates.map((endpoint) => scoreCandidate(endpoint, trustByProvider.get(endpoint.provider_id) ?? null, signalByProvider.get(endpoint.provider_id) ?? null, constraints, store, allowRiskyRoutes));
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
    warnings: [
      ...(category ? [] : ['missing_category']),
      ...Array.from(new Set(allCandidates.flatMap((candidate) => candidate.risk_warnings ?? [])))
    ],
    superiority_evidence_available: executableInCategory
  };
}

export function runRadarPreflightBatch(input: RadarBatchPreflightRequest, store: IntelligenceStore): RadarBatchPreflightResponse {
  const generatedAt = new Date().toISOString();
  const results = input.queries.map((query, index) => {
    const parsed = RadarPreflightRequestSchema.safeParse(query);
    const queryId = parsed.success && parsed.data.id ? parsed.data.id : (query && typeof query === 'object' && typeof (query as Record<string, unknown>).id === 'string' ? ((query as Record<string, unknown>).id as string) : null);
    const id = queryId?.trim() || `query-${index + 1}`;
    if (!parsed.success) return { id, ok: false, warnings: [], error: 'malformed_query' };
    try {
      const result = runRadarPreflight(parsed.data, store);
      return {
        id,
        ok: true,
        recommended_route: result.recommended_route,
        accepted_candidates: result.accepted_candidates,
        rejected_candidates: result.rejected_candidates,
        warnings: result.warnings
      };
    } catch {
      return { id, ok: false, warnings: [], error: 'preflight_failed' };
    }
  });
  return {
    generated_at: generatedAt,
    source: 'infopunks-pay-sh-radar',
    count: results.length,
    results,
    warnings: []
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
        const providerRisk = buildProviderRiskAssessment(store, provider.provider_id);
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
          predictive_risk_level: providerRisk?.predictive_risk_level ?? 'unknown',
          predictive_risk_score: providerRisk?.predictive_risk_score ?? 50,
          recommended_action: providerRisk?.recommended_action ?? 'insufficient history',
          top_anomaly: providerRisk?.anomalies[0] ? {
            anomaly_type: providerRisk.anomalies[0].anomaly_type,
            severity: providerRisk.anomalies[0].severity,
            confidence: providerRisk.anomalies[0].confidence,
            explanation: providerRisk.anomalies[0].explanation,
            evidence: providerRisk.anomalies[0].evidence,
            detected_at: providerRisk.anomalies[0].detected_at
          } : null,
          route_recommendation: (routeEligible.length > 0 && provider.reachability_status === 'reachable' ? 'route_eligible' : 'not_recommended') as 'route_eligible' | 'not_recommended',
          rejection_reasons: routeEligible.length > 0 ? [] : collectTopReasons(endpoints)
        };
      });
    return { generated_at: new Date().toISOString(), mode, rows };
  }

  const rows = snapshot.endpoints
    .filter((endpoint) => ids.has(endpoint.endpoint_id))
    .map((endpoint) => {
      const endpointRisk = buildEndpointRiskAssessment(store, endpoint.endpoint_id);
      return {
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
      predictive_risk_level: endpointRisk?.predictive_risk_level ?? 'unknown',
      predictive_risk_score: endpointRisk?.predictive_risk_score ?? 50,
      recommended_action: endpointRisk?.recommended_action ?? 'insufficient history',
      top_anomaly: endpointRisk?.anomalies[0] ? {
        anomaly_type: endpointRisk.anomalies[0].anomaly_type,
        severity: endpointRisk.anomalies[0].severity,
        confidence: endpointRisk.anomalies[0].confidence,
        explanation: endpointRisk.anomalies[0].explanation,
        evidence: endpointRisk.anomalies[0].evidence,
        detected_at: endpointRisk.anomalies[0].detected_at
      } : null,
      route_recommendation: (endpoint.route_eligibility ? 'route_eligible' : 'not_recommended') as 'route_eligible' | 'not_recommended',
      rejection_reasons: endpoint.route_eligibility ? [] : endpoint.route_rejection_reasons
      };
    });

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

export function buildBenchmarkReadiness(store: IntelligenceStore): RadarBenchmarkReadiness {
  const snapshot = buildRadarExportSnapshot(store);
  const providerIdsWithProof = new Set(
    store.events
      .filter((event) => event.payload && typeof event.payload === 'object' && (event.payload as Record<string, unknown>).proven_paid_execution === true)
      .map((event) => event.provider_id ?? (typeof event.payload.providerId === 'string' ? event.payload.providerId : null))
      .filter((id): id is string => Boolean(id))
  );
  const categories = new Map<string, NormalizedEndpointRecord[]>();
  for (const endpoint of snapshot.endpoints) {
    const category = (endpoint.category ?? 'unknown').toLowerCase();
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category)?.push(endpoint);
  }
  const rows = Array.from(categories.entries()).map(([category, endpoints]) => {
    const executable = endpoints.filter((item) => item.route_eligibility && Boolean(item.method) && Boolean(item.path));
    const executableProviders = new Set(executable.map((item) => item.provider_id));
    const pricingKnownCount = endpoints.filter((item) => pricingKnown(item.pricing)).length;
    const historyCount = endpoints.filter((item) => hasHistory(store, item.provider_id, item.endpoint_id)).length;
    const riskKnownCount = endpoints.filter((item) => buildEndpointRiskAssessment(store, item.endpoint_id)?.predictive_risk_level !== 'unknown').length;
    const benchmarkReady = executableProviders.size >= 2 && executable.length >= 2;
    const superiorityReady = benchmarkReady && Array.from(executableProviders).filter((providerId) => providerIdsWithProof.has(providerId)).length >= 2;
    const missing: string[] = [];
    if (executableProviders.size < 2) missing.push('need_at_least_two_executable_mappings');
    if (pricingKnownCount < 2) missing.push('pricing_unknown_for_comparison');
    if (!superiorityReady) missing.push('execution_evidence_missing_for_superiority');
    return {
      category,
      executable_mapping_count: executable.length,
      comparable_provider_count: executableProviders.size,
      pricing_known_count: pricingKnownCount,
      history_available_count: historyCount,
      risk_known_count: riskKnownCount,
      benchmark_ready: benchmarkReady,
      superiority_ready: superiorityReady,
      missing_requirements: missing,
      recommended_next_mapping: `${category}: +${Math.max(0, 2 - executableProviders.size)} executable mapping(s)`,
      metadata_only_warning: superiorityReady ? null : 'Catalog-estimated metadata is not execution-proven.'
    };
  }).sort((a, b) => a.category.localeCompare(b.category));
  return {
    generated_at: new Date().toISOString(),
    source: 'infopunks-pay-sh-radar',
    categories: rows,
    benchmark_ready_categories: rows.filter((row) => row.benchmark_ready).map((row) => row.category),
    superiority_ready_categories: rows.filter((row) => row.superiority_ready).map((row) => row.category),
    not_ready_categories: rows.filter((row) => !row.benchmark_ready).map((row) => row.category),
    missing_requirements: Array.from(new Set(rows.flatMap((row) => row.missing_requirements))),
    recommended_next_mappings: rows.map((row) => row.recommended_next_mapping),
    metadata_only_warning: 'Catalog-estimated is not execution-proven.'
  };
}

export function deriveCostPerformanceFields(endpoint: NormalizedEndpointRecord) {
  const normalized = normalizePricingForValue(endpoint.pricing);
  const min = normalized.min;
  const max = normalized.max;
  const known = typeof min === 'number' || typeof max === 'number';
  const estimateMin = min ?? max ?? null;
  const estimateMax = max ?? min ?? null;
  const spread = typeof estimateMin === 'number' && typeof estimateMax === 'number' ? Math.abs(estimateMax - estimateMin) : null;
  const confidence = !known
    ? 'unknown'
    : spread !== null && spread > 0.5 * Math.max(estimateMax ?? 0, 0.0001)
      ? 'low'
      : normalized.clarity === 'clear'
        ? 'high'
        : 'medium';
  const trustPerDollar = endpoint.provider_trust_score !== null && typeof estimateMax === 'number' && estimateMax > 0 ? round2(endpoint.provider_trust_score / estimateMax) : null;
  const signalPerDollar = endpoint.provider_signal_score !== null && typeof estimateMax === 'number' && estimateMax > 0 ? round2(endpoint.provider_signal_score / estimateMax) : null;
  const routeValueScore = endpoint.route_eligibility && confidence !== 'unknown' && typeof trustPerDollar === 'number' && typeof signalPerDollar === 'number'
    ? Math.max(0, Math.min(100, Math.round((Math.min(100, trustPerDollar) * 0.55) + (Math.min(100, signalPerDollar) * 0.45))))
    : null;
  return {
    pricing_known: known,
    estimated_min_price: estimateMin,
    estimated_max_price: estimateMax,
    pricing_unit: normalized.unit ?? null,
    pricing_source: 'catalog_estimated',
    pricing_confidence: confidence as 'unknown' | 'low' | 'medium' | 'high',
    price_description: normalized.raw ?? (known ? 'Catalog-estimated pricing' : 'Pricing unknown from catalog'),
    trust_per_estimated_dollar: trustPerDollar,
    signal_per_estimated_dollar: signalPerDollar,
    route_value_score: routeValueScore,
    value_score_reason: !known
      ? 'pricing_unknown'
      : !endpoint.route_eligibility
        ? 'route_not_eligible'
        : confidence === 'low'
          ? 'low_confidence_catalog_estimate'
          : 'catalog_estimated'
  };
}

function scoreCandidate(
  endpoint: NormalizedEndpointRecord,
  trustScore: number | null,
  signalScore: number | null,
  constraints: RadarPreflightRequest['constraints'],
  store: IntelligenceStore,
  allowRiskyRoutes: boolean
) {
  const rejection: string[] = [];
  const reasons: string[] = [];
  const riskWarnings: string[] = [];
  const pricing = parsePricing(endpoint.pricing);
  const mappingComplete = Boolean(endpoint.method) && Boolean(endpoint.path);
  const pricingKnown = pricing !== null;
  const reachable = endpoint.reachability_status === 'reachable';
  const predictiveRisk = buildEndpointRiskAssessment(store, endpoint.endpoint_id);

  if (!mappingComplete) rejection.push('mapping_incomplete');
  if (endpoint.reachability_status === 'failed') rejection.push('provider_failed_not_recommended_for_routing');
  if (endpoint.reachability_status === 'degraded') rejection.push('provider_degraded_not_recommended_for_routing');
  if (endpoint.degradation_status === 'degraded') rejection.push('critical_degradation_not_recommended_for_routing');

  if (typeof constraints?.min_trust === 'number' && typeof trustScore === 'number' && trustScore < constraints.min_trust) rejection.push('trust_below_min_trust');
  if (typeof constraints?.min_trust === 'number' && trustScore === null) rejection.push('trust_missing');
  if (constraints?.require_pricing && !pricingKnown) rejection.push('pricing_missing');
  if (typeof constraints?.max_price_usd === 'number' && pricingKnown && pricing > constraints.max_price_usd) rejection.push('price_above_max_price_usd');
  if (constraints?.prefer_reachable && !reachable) rejection.push('not_reachable_under_preference');
  const trendContext = trendContextForProvider(store, endpoint.provider_id);

  if (predictiveRisk) {
    if (predictiveRisk.predictive_risk_level === 'critical') {
      if (!allowRiskyRoutes) rejection.push('critical_predictive_risk_not_recommended_for_routing');
      else riskWarnings.push('critical_predictive_risk_allowed_by_override');
    } else if (predictiveRisk.predictive_risk_level === 'elevated') {
      riskWarnings.push('elevated_predictive_risk_route_with_fallback');
    } else if (predictiveRisk.predictive_risk_level === 'watch') {
      riskWarnings.push('watch_predictive_risk_monitor_before_routing');
    } else if (predictiveRisk.predictive_risk_level === 'unknown') {
      riskWarnings.push('unknown_predictive_risk_insufficient_history');
    }
  }

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
  const riskPenalty = riskConfidencePenalty(predictiveRisk?.predictive_risk_level ?? 'unknown');
  const confidence = Math.max(0, Math.min(100, confidenceRaw - riskPenalty));

  return {
    provider_id: endpoint.provider_id,
    provider_name: endpoint.provider_name,
    endpoint_id: endpoint.endpoint_id,
    endpoint_name: endpoint.endpoint_name,
    trust_score: trustScore,
    signal_score: signalScore,
    route_eligibility: rejection.length === 0,
    confidence,
    reasons,
    rejection_reasons: rejection.length ? rejection : [],
    mapping_status: mappingComplete ? 'complete' as const : 'missing' as const,
    reachability_status: endpoint.reachability_status,
    pricing_status: pricingKnown ? 'clear' as const : 'missing' as const,
    predictive_risk: predictiveRisk ? {
      predictive_risk_score: predictiveRisk.predictive_risk_score,
      predictive_risk_level: predictiveRisk.predictive_risk_level,
      history_available: predictiveRisk.history_available,
      sample_count: predictiveRisk.sample_count,
      explanation: predictiveRisk.explanation,
      evidence: predictiveRisk.evidence.slice(0, 6),
      warnings: predictiveRisk.warnings,
      recommended_action: predictiveRisk.recommended_action,
      top_anomaly: predictiveRisk.anomalies[0] ? {
        anomaly_type: predictiveRisk.anomalies[0].anomaly_type,
        severity: predictiveRisk.anomalies[0].severity,
        confidence: predictiveRisk.anomalies[0].confidence,
        explanation: predictiveRisk.anomalies[0].explanation,
        evidence: predictiveRisk.anomalies[0].evidence,
        detected_at: predictiveRisk.anomalies[0].detected_at
      } : null
    } : undefined,
    risk_warnings: riskWarnings,
    last_seen_healthy: trendContext.last_seen_healthy_at ?? lastSeenHealthyForEndpoint(endpoint),
    trend_context: trendContext
  };
}

function parsePricing(pricing: unknown): number | null {
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) return null;
  const shape = pricing as Record<string, unknown>;
  const min = typeof shape.min === 'number' ? shape.min : null;
  const max = typeof shape.max === 'number' ? shape.max : null;
  return min ?? max;
}

function riskConfidencePenalty(level: RiskLevel) {
  if (level === 'critical') return 30;
  if (level === 'elevated') return 16;
  if (level === 'watch') return 8;
  return 0;
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

function pricingKnown(pricing: unknown) {
  const parsed = normalizePricingForValue(pricing);
  return typeof parsed.min === 'number' || typeof parsed.max === 'number';
}

function hasHistory(store: IntelligenceStore, providerId: string, endpointId: string) {
  return store.events.some((event) => event.provider_id === providerId || event.endpoint_id === endpointId || event.entityId === providerId || event.entityId === endpointId);
}

function normalizePricingForValue(pricing: unknown) {
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) return { min: null as number | null, max: null as number | null, unit: null as string | null, raw: null as string | null, clarity: null as string | null };
  const shape = pricing as Record<string, unknown>;
  return {
    min: typeof shape.min === 'number' && Number.isFinite(shape.min) ? shape.min : null,
    max: typeof shape.max === 'number' && Number.isFinite(shape.max) ? shape.max : null,
    unit: typeof shape.unit === 'string' ? shape.unit : null,
    raw: typeof shape.raw === 'string' ? shape.raw : null,
    clarity: typeof shape.clarity === 'string' ? shape.clarity : null
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
