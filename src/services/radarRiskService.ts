import { InfopunksEvent } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';
import { buildRadarExportSnapshot } from './radarExportService';
import { buildEndpointHistory, buildProviderHistory } from './radarHistoryService';

export type RiskLevel = 'low' | 'watch' | 'elevated' | 'critical' | 'unknown';
export type RiskRecommendation = 'route normally' | 'route with caution' | 'required fallback route' | 'not recommended for routing' | 'insufficient history';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyConfidence = 'low' | 'medium' | 'high';
export type SubjectType = 'provider' | 'endpoint' | 'ecosystem';

export type AnomalyType =
  | 'sudden_trust_drop'
  | 'sudden_signal_spike'
  | 'repeated_degradation'
  | 'repeated_failed_metadata_check'
  | 'latency_spike'
  | 'route_eligibility_flip'
  | 'pricing_metadata_disappeared'
  | 'metadata_quality_decline'
  | 'catalog_metadata_churn'
  | 'stale_catalog_source'
  | 'critical_current_state';

export type RadarRiskAnomaly = {
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  confidence: AnomalyConfidence;
  explanation: string;
  evidence: string[];
  detected_at: string;
};

export type RiskAssessment = {
  generated_at: string;
  subject_type: 'provider' | 'endpoint';
  subject_id: string;
  predictive_risk_score: number;
  predictive_risk_level: RiskLevel;
  history_available: boolean;
  sample_count: number;
  explanation: string;
  evidence: string[];
  warnings: string[];
  anomalies: RadarRiskAnomaly[];
  recommended_action: RiskRecommendation;
};

export type EcosystemRiskSummary = {
  generated_at: string;
  subject_type: 'ecosystem';
  subject_id: 'ecosystem';
  risk_score: number;
  risk_level: RiskLevel;
  history_available: boolean;
  sample_count: number;
  anomalies: RadarRiskAnomaly[];
  evidence: string[];
  warnings: string[];
  recommended_action: RiskRecommendation;
  summary: {
    providers_by_risk_level: Record<RiskLevel, number>;
    top_anomalies: Array<{ anomaly_type: AnomalyType; count: number }>;
    categories_most_affected: Array<{ category: string; provider_count: number }>;
    recent_critical_events: Array<{ event_id: string; type: string; provider_id: string | null; endpoint_id: string | null; observed_at: string }>;
    stale_catalog_warning: string | null;
    anomaly_watch: Array<{
      subject_type: 'provider' | 'endpoint';
      provider_id: string | null;
      endpoint_id: string | null;
      anomaly_type: AnomalyType;
      severity: AnomalySeverity;
      confidence: AnomalyConfidence;
      explanation: string;
      detected_at: string;
      recommended_action: RiskRecommendation;
      route_implication: string;
      evidence: string[];
    }>;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_SAMPLE_MIN = 2;

export function buildProviderRiskAssessment(store: IntelligenceStore, providerId: string): RiskAssessment | null {
  const generatedAt = new Date().toISOString();
  const snapshot = buildRadarExportSnapshot(store);
  const provider = snapshot.providers.find((row) => row.provider_id === providerId) ?? null;
  if (!provider) return null;

  const history = buildProviderHistory(store, providerId, '48h');
  const sampleCount = history?.sample_count ?? 0;
  const historyAvailable = history?.history_available ?? false;
  const anchor = historyAnchor(store);

  const providerEvents = providerRelatedEvents(store.events, providerId);
  const recent24hEvents = providerEvents.filter((event) => eventTime(event) >= anchor - DAY_MS);

  const anomalies: RadarRiskAnomaly[] = [];
  const warnings: string[] = [];
  const evidence: string[] = [];

  const criticalNow = provider.reachability_status === 'failed'
    || provider.reachability_status === 'degraded'
    || recent24hEvents.some((event) => event.type === 'provider.failed' || event.type === 'provider.degraded');
  if (criticalNow) {
    anomalies.push(createAnomaly('critical_current_state', 'critical', 'high', `Current provider state is ${provider.reachability_status}/${provider.degradation_status}.`, [
      `reachability_status=${provider.reachability_status}`,
      `degradation_status=${provider.degradation_status}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  if (historyAvailable && history) {
    const trustDelta = history.deltas.trust_delta_24h;
    if (typeof trustDelta === 'number' && trustDelta <= -10) {
      const drop = Math.abs(trustDelta);
      anomalies.push(createAnomaly('sudden_trust_drop', drop >= 20 ? 'high' : 'medium', drop >= 20 ? 'high' : 'medium', `Provider trust fell ${drop} points in 24h.`, [
        `trust_delta_24h=${trustDelta}`,
        `current_trust_score=${provider.provider_trust_score ?? 'unknown'}`
      ], generatedAt));
    }

    const signalDelta = history.deltas.signal_delta_24h;
    if (typeof signalDelta === 'number' && signalDelta >= 15) {
      anomalies.push(createAnomaly('sudden_signal_spike', signalDelta >= 25 ? 'high' : 'medium', signalDelta >= 25 ? 'high' : 'medium', `Provider signal rose ${signalDelta} points in 24h.`, [
        `signal_delta_24h=${signalDelta}`,
        `current_signal_score=${provider.provider_signal_score ?? 'unknown'}`
      ], generatedAt));
    }

    const latencyDelta = history.deltas.latency_delta_24h;
    if (typeof latencyDelta === 'number' && latencyDelta >= 200) {
      anomalies.push(createAnomaly('latency_spike', latencyDelta >= 400 ? 'high' : 'medium', 'medium', `Provider latency increased by ${Math.round(latencyDelta)}ms over 24h.`, [
        `latency_delta_24h=${Math.round(latencyDelta)}ms`
      ], generatedAt));
    }

    const metadataDelta = numberDelta(history.series.metadata_quality ?? []);
    if (typeof metadataDelta === 'number' && metadataDelta <= -10) {
      anomalies.push(createAnomaly('metadata_quality_decline', Math.abs(metadataDelta) >= 20 ? 'high' : 'medium', 'medium', `Metadata quality declined ${Math.abs(metadataDelta)} points over recent history.`, [
        `metadata_quality_delta=${metadataDelta}`
      ], generatedAt));
    }
  }

  const degradationCount = recent24hEvents.filter((event) => isDegradationEvent(event)).length;
  if (degradationCount >= 2) {
    anomalies.push(createAnomaly('repeated_degradation', degradationCount >= 3 ? 'high' : 'medium', degradationCount >= 3 ? 'high' : 'medium', `Detected ${degradationCount} degradation/failure events in the last 24h.`, [
      `degradation_events_24h=${degradationCount}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  const failedMetadataChecks = recent24hEvents.filter((event) => event.type === 'provider.failed' || (event.type === 'provider.checked' && event.payload.success === false)).length;
  if (failedMetadataChecks >= 2) {
    anomalies.push(createAnomaly('repeated_failed_metadata_check', failedMetadataChecks >= 3 ? 'high' : 'medium', failedMetadataChecks >= 3 ? 'high' : 'medium', `Detected ${failedMetadataChecks} failed metadata checks in the last 24h.`, [
      `failed_metadata_checks_24h=${failedMetadataChecks}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  const churnCount = recent24hEvents.filter((event) => isCatalogChurnEvent(event)).length;
  if (churnCount >= 4) {
    anomalies.push(createAnomaly('catalog_metadata_churn', churnCount >= 8 ? 'high' : 'medium', churnCount >= 8 ? 'high' : 'medium', `Catalog metadata changed ${churnCount} times in the last 24h.`, [
      `catalog_churn_events_24h=${churnCount}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  const priceDisappearances = recent24hEvents.filter((event) => event.type === 'price.changed' && isPriceDisappearedEvent(event)).length;
  if (priceDisappearances >= 1) {
    anomalies.push(createAnomaly('pricing_metadata_disappeared', priceDisappearances >= 2 ? 'high' : 'medium', 'medium', 'Pricing metadata moved from known to unknown in recent catalog updates.', [
      `pricing_disappearance_events_24h=${priceDisappearances}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  const endpointIds = snapshot.endpoints.filter((endpoint) => endpoint.provider_id === providerId).map((endpoint) => endpoint.endpoint_id);
  const routeFlips = endpointIds
    .map((endpointId) => buildEndpointHistory(store, endpointId, '48h'))
    .filter((item) => Boolean(item?.deltas.route_eligibility_changed)).length;
  if (routeFlips > 0) {
    anomalies.push(createAnomaly('route_eligibility_flip', 'high', routeFlips >= 2 ? 'high' : 'medium', `Route eligibility flipped for ${routeFlips} endpoint(s) in recent history.`, [
      `route_eligibility_flips=${routeFlips}`
    ], generatedAt));
  }

  const staleWarning = staleCatalogWarning(store, anchor);
  if (staleWarning) {
    anomalies.push(createAnomaly('stale_catalog_source', 'medium', 'high', staleWarning, [
      `catalog_generated_at=${store.dataSource?.generated_at ?? 'unknown'}`,
      `last_ingested_at=${store.dataSource?.last_ingested_at ?? 'unknown'}`,
      `source_mode=${store.dataSource?.mode ?? 'unknown'}`
    ], generatedAt));
  }

  if (!historyAvailable && !criticalNow) {
    warnings.push('insufficient_history');
    evidence.push('Insufficient history: fewer than two historical samples are available.');
    return {
      generated_at: generatedAt,
      subject_type: 'provider',
      subject_id: providerId,
      predictive_risk_score: 50,
      predictive_risk_level: 'unknown',
      history_available: false,
      sample_count: sampleCount,
      explanation: 'Predictive risk is unknown because there is insufficient history and no current critical evidence.',
      evidence,
      warnings,
      anomalies: [],
      recommended_action: 'insufficient history'
    };
  }

  const scored = scoreFromAnomalies(anomalies, criticalNow);
  evidence.push(...summarizeAnomalies(anomalies));

  return {
    generated_at: generatedAt,
    subject_type: 'provider',
    subject_id: providerId,
    predictive_risk_score: scored.score,
    predictive_risk_level: scored.level,
    history_available: historyAvailable,
    sample_count: sampleCount,
    explanation: buildExplanation(scored.level, historyAvailable, anomalies),
    evidence,
    warnings,
    anomalies,
    recommended_action: recommendationForLevel(scored.level, historyAvailable)
  };
}

export function buildEndpointRiskAssessment(store: IntelligenceStore, endpointId: string): RiskAssessment | null {
  const generatedAt = new Date().toISOString();
  const snapshot = buildRadarExportSnapshot(store);
  const endpoint = snapshot.endpoints.find((row) => row.endpoint_id === endpointId) ?? null;
  if (!endpoint) return null;

  const history = buildEndpointHistory(store, endpointId, '48h');
  const sampleCount = history?.sample_count ?? 0;
  const historyAvailable = history?.history_available ?? false;
  const anchor = historyAnchor(store);

  const endpointEvents = endpointRelatedEvents(store.events, endpointId);
  const recent24hEvents = endpointEvents.filter((event) => eventTime(event) >= anchor - DAY_MS);

  const anomalies: RadarRiskAnomaly[] = [];
  const warnings: string[] = [];
  const evidence: string[] = [];

  const criticalNow = endpoint.reachability_status === 'failed'
    || endpoint.reachability_status === 'degraded'
    || recent24hEvents.some((event) => event.type === 'endpoint.failed' || event.type === 'endpoint.degraded');
  if (criticalNow) {
    anomalies.push(createAnomaly('critical_current_state', 'critical', 'high', `Current endpoint state is ${endpoint.reachability_status}/${endpoint.degradation_status}.`, [
      `reachability_status=${endpoint.reachability_status}`,
      `degradation_status=${endpoint.degradation_status}`,
      `route_eligibility=${endpoint.route_eligibility}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  const degradationCount = recent24hEvents.filter((event) => isDegradationEvent(event)).length;
  if (degradationCount >= 2) {
    anomalies.push(createAnomaly('repeated_degradation', degradationCount >= 3 ? 'high' : 'medium', degradationCount >= 3 ? 'high' : 'medium', `Detected ${degradationCount} endpoint degradation/failure events in the last 24h.`, [
      `endpoint_degradation_events_24h=${degradationCount}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  const failedMetadataChecks = recent24hEvents.filter((event) => event.type === 'endpoint.failed' || (event.type === 'endpoint.checked' && event.payload.success === false)).length;
  if (failedMetadataChecks >= 2) {
    anomalies.push(createAnomaly('repeated_failed_metadata_check', failedMetadataChecks >= 3 ? 'high' : 'medium', failedMetadataChecks >= 3 ? 'high' : 'medium', `Detected ${failedMetadataChecks} failed endpoint checks in the last 24h.`, [
      `failed_endpoint_checks_24h=${failedMetadataChecks}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  if (historyAvailable && history) {
    if (history.deltas.route_eligibility_changed === true) {
      anomalies.push(createAnomaly('route_eligibility_flip', 'high', 'high', 'Endpoint route eligibility changed in recent history.', [
        `route_eligibility_changed=true`,
        `current_route_eligibility=${endpoint.route_eligibility}`
      ], generatedAt));
    }

    const latencyDelta = history.deltas.latency_delta_24h;
    if (typeof latencyDelta === 'number' && latencyDelta >= 200) {
      anomalies.push(createAnomaly('latency_spike', latencyDelta >= 400 ? 'high' : 'medium', 'medium', `Endpoint latency increased by ${Math.round(latencyDelta)}ms over 24h.`, [
        `latency_delta_24h=${Math.round(latencyDelta)}ms`
      ], generatedAt));
    }
  }

  const churnCount = recent24hEvents.filter((event) => isCatalogChurnEvent(event)).length;
  if (churnCount >= 4) {
    anomalies.push(createAnomaly('catalog_metadata_churn', churnCount >= 8 ? 'high' : 'medium', churnCount >= 8 ? 'high' : 'medium', `Endpoint metadata changed ${churnCount} times in the last 24h.`, [
      `endpoint_catalog_churn_events_24h=${churnCount}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  const priceDisappearances = recent24hEvents.filter((event) => event.type === 'price.changed' && isPriceDisappearedEvent(event)).length;
  if (priceDisappearances >= 1) {
    anomalies.push(createAnomaly('pricing_metadata_disappeared', priceDisappearances >= 2 ? 'high' : 'medium', 'medium', 'Endpoint pricing metadata moved from known to unknown in recent catalog updates.', [
      `endpoint_pricing_disappearance_events_24h=${priceDisappearances}`
    ], latestObservedAt(recent24hEvents) ?? generatedAt));
  }

  const staleWarning = staleCatalogWarning(store, anchor);
  if (staleWarning) {
    anomalies.push(createAnomaly('stale_catalog_source', 'medium', 'high', staleWarning, [
      `catalog_generated_at=${store.dataSource?.generated_at ?? 'unknown'}`,
      `last_ingested_at=${store.dataSource?.last_ingested_at ?? 'unknown'}`
    ], generatedAt));
  }

  if (!historyAvailable && !criticalNow) {
    warnings.push('insufficient_history');
    evidence.push('Insufficient history: fewer than two endpoint trend samples are available.');
    return {
      generated_at: generatedAt,
      subject_type: 'endpoint',
      subject_id: endpointId,
      predictive_risk_score: 50,
      predictive_risk_level: 'unknown',
      history_available: false,
      sample_count: sampleCount,
      explanation: 'Predictive risk is unknown because endpoint history is insufficient and no current critical evidence is present.',
      evidence,
      warnings,
      anomalies: [],
      recommended_action: 'insufficient history'
    };
  }

  const scored = scoreFromAnomalies(anomalies, criticalNow);
  evidence.push(...summarizeAnomalies(anomalies));

  return {
    generated_at: generatedAt,
    subject_type: 'endpoint',
    subject_id: endpointId,
    predictive_risk_score: scored.score,
    predictive_risk_level: scored.level,
    history_available: historyAvailable,
    sample_count: sampleCount,
    explanation: buildExplanation(scored.level, historyAvailable, anomalies),
    evidence,
    warnings,
    anomalies,
    recommended_action: recommendationForLevel(scored.level, historyAvailable)
  };
}

export function buildEcosystemRiskSummary(store: IntelligenceStore): EcosystemRiskSummary {
  const generatedAt = new Date().toISOString();
  const anchor = historyAnchor(store);
  const snapshot = buildRadarExportSnapshot(store);

  const providerRisks = snapshot.providers
    .map((provider) => buildProviderRiskAssessment(store, provider.provider_id))
    .filter((item): item is RiskAssessment => Boolean(item));

  const endpointRisks = snapshot.endpoints
    .slice(0, 200)
    .map((endpoint) => buildEndpointRiskAssessment(store, endpoint.endpoint_id))
    .filter((item): item is RiskAssessment => Boolean(item));

  const counts: Record<RiskLevel, number> = { low: 0, watch: 0, elevated: 0, critical: 0, unknown: 0 };
  for (const risk of providerRisks) counts[risk.predictive_risk_level] += 1;

  const anomalyCounts = new Map<AnomalyType, number>();
  for (const risk of providerRisks) {
    for (const anomalyItem of risk.anomalies) {
      anomalyCounts.set(anomalyItem.anomaly_type, (anomalyCounts.get(anomalyItem.anomaly_type) ?? 0) + 1);
    }
  }

  const topAnomalies = [...anomalyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([anomalyType, count]) => ({ anomaly_type: anomalyType, count }));

  const categoryCounts = new Map<string, number>();
  for (const provider of snapshot.providers) {
    const risk = providerRisks.find((item) => item.subject_id === provider.provider_id);
    if (!risk || (risk.predictive_risk_level !== 'watch' && risk.predictive_risk_level !== 'elevated' && risk.predictive_risk_level !== 'critical')) continue;
    categoryCounts.set(provider.category ?? 'unknown', (categoryCounts.get(provider.category ?? 'unknown') ?? 0) + 1);
  }
  const categoriesMostAffected = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, providerCount]) => ({ category, provider_count: providerCount }));

  const recentCriticalEvents = [...store.events]
    .filter((event) => isCriticalEvent(event) && eventTime(event) >= anchor - DAY_MS)
    .sort((a, b) => eventTime(b) - eventTime(a))
    .slice(0, 10)
    .map((event) => ({
      event_id: event.id,
      type: event.type,
      provider_id: providerIdForEvent(event),
      endpoint_id: endpointIdForEvent(event),
      observed_at: event.observed_at ?? event.observedAt
    }));

  const staleWarning = staleCatalogWarning(store, anchor);
  const summaryAnomalies: RadarRiskAnomaly[] = [];
  if (staleWarning) {
    summaryAnomalies.push(createAnomaly('stale_catalog_source', 'medium', 'high', staleWarning, [
      `catalog_generated_at=${store.dataSource?.generated_at ?? 'unknown'}`,
      `last_ingested_at=${store.dataSource?.last_ingested_at ?? 'unknown'}`,
      `source_mode=${store.dataSource?.mode ?? 'unknown'}`
    ], generatedAt));
  }
  if (counts.critical > 0) {
    summaryAnomalies.push(createAnomaly('critical_current_state', 'critical', 'high', `${counts.critical} provider(s) currently show critical predictive risk.`, [
      `critical_providers=${counts.critical}`
    ], generatedAt));
  }

  const anomalyWatch = [
    ...providerRisks.flatMap((risk) => risk.anomalies.map((anomaly) => ({
      subject_type: 'provider' as const,
      provider_id: risk.subject_id,
      endpoint_id: null,
      anomaly_type: anomaly.anomaly_type,
      severity: anomaly.severity,
      confidence: anomaly.confidence,
      explanation: anomaly.explanation,
      detected_at: anomaly.detected_at,
      recommended_action: risk.recommended_action,
      route_implication: routeImplicationForRecommendation(risk.recommended_action),
      evidence: anomaly.evidence
    }))),
    ...endpointRisks.flatMap((risk) => risk.anomalies.map((anomaly) => ({
      subject_type: 'endpoint' as const,
      provider_id: providerIdForEndpoint(snapshot.endpoints, risk.subject_id),
      endpoint_id: risk.subject_id,
      anomaly_type: anomaly.anomaly_type,
      severity: anomaly.severity,
      confidence: anomaly.confidence,
      explanation: anomaly.explanation,
      detected_at: anomaly.detected_at,
      recommended_action: risk.recommended_action,
      route_implication: routeImplicationForRecommendation(risk.recommended_action),
      evidence: anomaly.evidence
    })))
  ]
    .sort((a, b) => anomalyRank(a.severity) - anomalyRank(b.severity) || Date.parse(b.detected_at) - Date.parse(a.detected_at))
    .slice(0, 30);

  const averageScore = providerRisks.length
    ? Math.round(providerRisks.reduce((sum, item) => sum + item.predictive_risk_score, 0) / providerRisks.length)
    : 50;
  const maxLevel = maxRiskLevel(providerRisks.map((item) => item.predictive_risk_level));

  const historyAvailable = providerRisks.some((item) => item.history_available);
  const sampleCount = providerRisks.reduce((sum, item) => sum + item.sample_count, 0);

  const evidence = [
    `providers=${providerRisks.length}`,
    `critical=${counts.critical}`,
    `elevated=${counts.elevated}`,
    `watch=${counts.watch}`,
    `unknown=${counts.unknown}`
  ];
  if (topAnomalies.length) evidence.push(`top_anomaly=${topAnomalies[0].anomaly_type}:${topAnomalies[0].count}`);

  const warnings: string[] = [];
  if (counts.unknown > 0) warnings.push('some_providers_have_insufficient_history');
  if (staleWarning) warnings.push('catalog_source_stale');

  return {
    generated_at: generatedAt,
    subject_type: 'ecosystem',
    subject_id: 'ecosystem',
    risk_score: maxLevel === 'unknown' ? averageScore : clamp(averageScore),
    risk_level: maxLevel,
    history_available: historyAvailable,
    sample_count: sampleCount,
    anomalies: summaryAnomalies,
    evidence,
    warnings,
    recommended_action: recommendationForLevel(maxLevel, historyAvailable),
    summary: {
      providers_by_risk_level: counts,
      top_anomalies: topAnomalies,
      categories_most_affected: categoriesMostAffected,
      recent_critical_events: recentCriticalEvents,
      stale_catalog_warning: staleWarning,
      anomaly_watch: anomalyWatch
    }
  };
}

function createAnomaly(
  anomalyType: AnomalyType,
  severity: AnomalySeverity,
  confidence: AnomalyConfidence,
  explanation: string,
  evidence: string[],
  detectedAt: string
): RadarRiskAnomaly {
  return {
    anomaly_type: anomalyType,
    severity,
    confidence,
    explanation,
    evidence,
    detected_at: detectedAt
  };
}

function scoreFromAnomalies(anomalies: RadarRiskAnomaly[], criticalNow: boolean) {
  if (criticalNow || anomalies.some((item) => item.severity === 'critical' || item.anomaly_type === 'critical_current_state')) {
    return { score: 95, level: 'critical' as const };
  }
  let score = 10;
  for (const anomalyItem of anomalies) {
    score += anomalyWeight(anomalyItem.severity);
  }
  const clamped = clamp(score);
  return { score: clamped, level: levelForScore(clamped) };
}

function anomalyWeight(severity: AnomalySeverity) {
  if (severity === 'critical') return 50;
  if (severity === 'high') return 28;
  if (severity === 'medium') return 16;
  return 8;
}

function levelForScore(score: number): RiskLevel {
  if (score >= 85) return 'critical';
  if (score >= 60) return 'elevated';
  if (score >= 35) return 'watch';
  return 'low';
}

function recommendationForLevel(level: RiskLevel, historyAvailable: boolean): RiskRecommendation {
  if (!historyAvailable && level === 'unknown') return 'insufficient history';
  if (level === 'critical') return 'not recommended for routing';
  if (level === 'elevated') return 'required fallback route';
  if (level === 'watch') return 'route with caution';
  return 'route normally';
}

function routeImplicationForRecommendation(recommendation: RiskRecommendation) {
  if (recommendation === 'not recommended for routing') return 'Not recommended for routing.';
  if (recommendation === 'required fallback route') return 'Route with fallback.';
  if (recommendation === 'route with caution') return 'Monitor before routing.';
  if (recommendation === 'insufficient history') return 'Insufficient history; monitor before routing.';
  return 'Route normally.';
}

function buildExplanation(level: RiskLevel, historyAvailable: boolean, anomalies: RadarRiskAnomaly[]) {
  if (!historyAvailable && level === 'unknown') return 'Risk is unknown because history is insufficient and there is no current critical evidence.';
  if (!anomalies.length) return 'No predictive anomalies were detected in recent history.';
  const severe = anomalies.filter((item) => item.severity === 'critical' || item.severity === 'high').map((item) => item.anomaly_type);
  if (!severe.length) return `Advisory risk is ${level} due to recent heuristic anomalies: ${anomalies.map((item) => item.anomaly_type).join(', ')}.`;
  return `Advisory risk is ${level} due to ${severe.join(', ')} and related degradation indicators.`;
}

function summarizeAnomalies(anomalies: RadarRiskAnomaly[]) {
  return anomalies.map((item) => `${item.anomaly_type}:${item.severity}:${item.confidence}`);
}

function numberDelta(points: Array<{ value: number | string | boolean | null }>) {
  const numbers = points.map((item) => item.value).filter((item): item is number => typeof item === 'number');
  if (numbers.length < HISTORY_SAMPLE_MIN) return null;
  return numbers[numbers.length - 1] - numbers[0];
}

function staleCatalogWarning(store: IntelligenceStore, anchor: number): string | null {
  if (store.dataSource?.error) return 'Catalog source reports an error; freshness cannot be guaranteed.';
  const generatedAt = parseTime(store.dataSource?.generated_at ?? null);
  const ingestedAt = parseTime(store.dataSource?.last_ingested_at ?? null);
  const reference = Math.max(generatedAt || 0, ingestedAt || 0);
  if (!reference) return null;
  if (anchor - reference > DAY_MS) return 'Catalog source appears stale beyond the 24h freshness threshold.';
  return null;
}

function isDegradationEvent(event: InfopunksEvent) {
  return event.type === 'provider.degraded' || event.type === 'provider.failed' || event.type === 'endpoint.degraded' || event.type === 'endpoint.failed';
}

function isCriticalEvent(event: InfopunksEvent) {
  return isDegradationEvent(event) || event.severity === 'critical';
}

function isCatalogChurnEvent(event: InfopunksEvent) {
  return event.type === 'provider.updated'
    || event.type === 'metadata.changed'
    || event.type === 'endpoint.updated'
    || event.type === 'schema.changed'
    || event.type === 'manifest.updated'
    || event.type === 'price.changed'
    || event.type === 'category.changed'
    || event.type === 'endpoint_count.changed';
}

function isPriceDisappearedEvent(event: InfopunksEvent) {
  const before = stringifyPrice(event.payload.before);
  const after = stringifyPrice(event.payload.after);
  return before !== null && after === null;
}

function stringifyPrice(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const shape = value as Record<string, unknown>;
    if (typeof shape.raw === 'string' && shape.raw.trim()) return shape.raw.trim();
    if (typeof shape.min === 'number' || typeof shape.max === 'number') return `${shape.min ?? ''}-${shape.max ?? ''}`;
  }
  return null;
}

function providerRelatedEvents(events: InfopunksEvent[], providerId: string) {
  return events.filter((event) => providerIdForEvent(event) === providerId);
}

function endpointRelatedEvents(events: InfopunksEvent[], endpointId: string) {
  return events.filter((event) => endpointIdForEvent(event) === endpointId);
}

function providerIdForEvent(event: InfopunksEvent) {
  if (typeof event.provider_id === 'string') return event.provider_id;
  if (typeof event.payload.providerId === 'string') return event.payload.providerId;
  if (event.entityType === 'provider') return event.entityId;
  return null;
}

function endpointIdForEvent(event: InfopunksEvent) {
  if (typeof event.endpoint_id === 'string') return event.endpoint_id;
  if (typeof event.payload.endpointId === 'string') return event.payload.endpointId;
  if (event.entityType === 'endpoint') return event.entityId;
  return null;
}

function providerIdForEndpoint(endpoints: Array<{ endpoint_id: string; provider_id: string }>, endpointId: string) {
  return endpoints.find((endpoint) => endpoint.endpoint_id === endpointId)?.provider_id ?? null;
}

function historyAnchor(store: IntelligenceStore) {
  const eventTimes = store.events.map((event) => eventTime(event)).filter(Number.isFinite);
  const generatedAt = parseTime(store.dataSource?.generated_at ?? null);
  const ingestedAt = parseTime(store.dataSource?.last_ingested_at ?? null);
  const sourceTimes = [generatedAt, ingestedAt].filter(Number.isFinite);
  const allTimes = [...eventTimes, ...sourceTimes];
  return allTimes.length ? Math.max(...allTimes) : Date.now();
}

function eventTime(event: InfopunksEvent) {
  return parseTime(event.observed_at ?? event.observedAt);
}

function parseTime(value: string | null) {
  if (!value) return NaN;
  return Date.parse(value);
}

function latestObservedAt(events: InfopunksEvent[]) {
  const latest = [...events].sort((a, b) => eventTime(b) - eventTime(a))[0];
  return latest ? (latest.observed_at ?? latest.observedAt) : null;
}

function anomalyRank(severity: AnomalySeverity) {
  if (severity === 'critical') return 0;
  if (severity === 'high') return 1;
  if (severity === 'medium') return 2;
  return 3;
}

function maxRiskLevel(levels: RiskLevel[]): RiskLevel {
  if (levels.includes('critical')) return 'critical';
  if (levels.includes('elevated')) return 'elevated';
  if (levels.includes('watch')) return 'watch';
  if (levels.includes('low')) return 'low';
  return 'unknown';
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
