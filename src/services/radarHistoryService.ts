import { InfopunksEvent } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';
import { buildRadarExportSnapshot, normalizeEndpointRecord } from './radarExportService';

type WindowName = '24h' | '48h' | '7d';
type TrendDirection = 'improving' | 'stable' | 'degrading' | 'unknown';
type HealthState = 'reachable' | 'healthy' | 'degraded' | 'failed' | 'unknown';

type Point<T = number | string | boolean | null> = { at: string; value: T };

type LastKnownGoodState = {
  last_seen_healthy_at: string | null;
  last_degraded_at: string | null;
  last_failed_at: string | null;
  current_health_state: HealthState;
  health_state_reason: string;
};

export type TrendContext = {
  trust_trend: TrendDirection;
  signal_trend: TrendDirection;
  degradation_trend: TrendDirection;
  trust_delta_24h: number | null;
  signal_delta_24h: number | null;
  latency_delta_24h: number | null;
  degradation_delta_24h: number | null;
  route_eligibility_changed: boolean | null;
  last_seen_healthy_at: string | null;
  warning: string | null;
};

export function normalizeHistoryWindow(value: unknown): WindowName {
  return value === '48h' || value === '7d' ? value : '24h';
}

export function buildProviderHistory(store: IntelligenceStore, providerId: string, windowName: WindowName = '24h') {
  const provider = store.providers.find((item) => item.id === providerId || item.slug === providerId) ?? null;
  const generatedAt = new Date().toISOString();
  if (!provider) return null;

  const anchor = historyAnchor(store);
  const start = anchor - windowMs(windowName);
  const providerEvents = providerRelatedEvents(store.events, provider.id).filter((event) => eventTime(event) >= start && eventTime(event) <= anchor);
  const trustScore = scoreSeries(providerEvents, 'trust_assessment', provider.id);
  const signalScore = scoreSeries(providerEvents, 'signal_assessment', provider.id);
  const reachability = reachabilitySeries(providerEvents, 'provider');
  const latency = latencySeries(providerEvents);
  const degradationEvents = providerEvents.filter(isDegradationEvent);
  const degradationCount = cumulativeEventSeries(degradationEvents);
  const metadataQuality = componentSeries(providerEvents, 'trust_assessment', provider.id, 'metadataQuality');
  const pricingClarity = componentSeries(providerEvents, 'trust_assessment', provider.id, 'pricingClarity');
  const sampleCount = uniqueSampleCount([trustScore, signalScore, reachability, latency, degradationCount, metadataQuality, pricingClarity]);
  const deltas = providerTrendDeltas(store, provider.id, anchor);
  const lastKnownGood = lastKnownGoodState(providerRelatedEvents(store.events, provider.id), 'provider');
  const historyAvailable = sampleCount >= 2;

  return {
    generated_at: generatedAt,
    window: windowName,
    sample_count: sampleCount,
    history_available: historyAvailable,
    reason: historyAvailable ? null : 'No historical snapshots available yet',
    series: {
      trust_score: trustScore,
      signal_score: signalScore,
      latency_ms: latency,
      reachability,
      degradation_count: degradationCount,
      metadata_quality: metadataQuality,
      pricing_clarity: pricingClarity
    },
    deltas,
    last_known_good: lastKnownGood,
    warnings: historyAvailable ? [] : ['history warming up']
  };
}

export function buildEndpointHistory(store: IntelligenceStore, endpointId: string, windowName: WindowName = '24h') {
  const endpoint = store.endpoints.find((item) => item.id === endpointId) ?? null;
  const generatedAt = new Date().toISOString();
  if (!endpoint) return null;

  const anchor = historyAnchor(store);
  const start = anchor - windowMs(windowName);
  const endpointEvents = endpointRelatedEvents(store.events, endpoint.id).filter((event) => eventTime(event) >= start && eventTime(event) <= anchor);
  const provider = store.providers.find((item) => item.id === endpoint.providerId) ?? null;
  const trust = store.trustAssessments.find((item) => item.entityId === endpoint.providerId) ?? null;
  const signal = store.signalAssessments.find((item) => item.entityId === endpoint.providerId) ?? null;
  const current = normalizeEndpointRecord(endpoint, provider, trust, signal, store);
  const degradationState = reachabilitySeries(endpointEvents, 'endpoint');
  const pricingState = endpointPricingSeries(endpointEvents, current.pricing_clarity_score !== null || hasKnownPricing(current.pricing));
  const mappingCompleteness = endpointMappingSeries(endpointEvents, Boolean(current.method && current.path));
  const routeEligibility = endpointRouteEligibilitySeries(endpointEvents, current.route_eligibility);
  const sampleCount = uniqueSampleCount([degradationState, pricingState, mappingCompleteness, routeEligibility]);
  const deltas = endpointTrendDeltas(store, endpoint.id, anchor, current.route_eligibility);
  const lastKnownGood = lastKnownGoodState(endpointRelatedEvents(store.events, endpoint.id), 'endpoint');
  const historyAvailable = sampleCount >= 2;

  return {
    generated_at: generatedAt,
    window: windowName,
    sample_count: sampleCount,
    history_available: historyAvailable,
    reason: historyAvailable ? null : 'No historical snapshots available yet',
    series: {
      route_eligibility: routeEligibility,
      degradation_state: degradationState,
      pricing_state: pricingState,
      mapping_completeness: mappingCompleteness
    },
    deltas,
    last_known_good: lastKnownGood,
    warnings: historyAvailable ? [] : ['history warming up']
  };
}

export function buildEcosystemHistory(store: IntelligenceStore, windowName: WindowName = '24h') {
  const generatedAt = new Date().toISOString();
  const anchor = historyAnchor(store);
  const start = anchor - windowMs(windowName);
  const events = store.events.filter((event) => eventTime(event) >= start && eventTime(event) <= anchor);
  const trustByTime = averageScoreSeries(events, 'trust_assessment');
  const signalByTime = averageScoreSeries(events, 'signal_assessment');
  const degradationCount = cumulativeEventSeries(events.filter(isDegradationEvent));
  const sampleCount = uniqueSampleCount([trustByTime, signalByTime, degradationCount]);
  const historyAvailable = sampleCount >= 2;

  return {
    generated_at: generatedAt,
    window: windowName,
    sample_count: sampleCount,
    history_available: historyAvailable,
    reason: historyAvailable ? null : 'No historical snapshots available yet',
    series: {
      average_trust: trustByTime,
      average_signal: signalByTime,
      degradation_count: degradationCount
    },
    deltas: {
      average_trust_delta_24h: deltaBetweenFirstLast(trustByTime),
      average_signal_delta_24h: deltaBetweenFirstLast(signalByTime),
      degradation_delta_24h: degradationDelta(store.events, anchor, null, 'ecosystem'),
      trend_direction: trendDirectionFromParts(deltaBetweenFirstLast(trustByTime), deltaBetweenFirstLast(signalByTime), degradationDelta(store.events, anchor, null, 'ecosystem'))
    },
    warnings: historyAvailable ? [] : ['history warming up']
  };
}

export function providerTrendDeltas(store: IntelligenceStore, providerId: string, anchor = historyAnchor(store)) {
  const all = providerRelatedEvents(store.events, providerId);
  const recent = all.filter((event) => inRange(event, anchor - windowMs('24h'), anchor));
  const trust = scoreSeries(recent, 'trust_assessment', providerId);
  const signal = scoreSeries(recent, 'signal_assessment', providerId);
  const latency = latencySeries(recent);
  const degradationDelta24h = degradationDelta(store.events, anchor, providerId, 'provider');
  const trustDelta = deltaBetweenFirstLast(trust);
  const signalDelta = deltaBetweenFirstLast(signal);
  const latencyDelta = deltaBetweenFirstLast(latency);
  const trendDirection = trendDirectionFromParts(trustDelta, signalDelta, degradationDelta24h, latencyDelta);
  return {
    trust_delta_24h: trustDelta,
    signal_delta_24h: signalDelta,
    latency_delta_24h: latencyDelta,
    degradation_delta_24h: degradationDelta24h,
    route_eligibility_changed: null,
    trend_direction: trendDirection
  };
}

export function endpointTrendDeltas(store: IntelligenceStore, endpointId: string, anchor = historyAnchor(store), currentRouteEligibility: boolean | null = null) {
  const all = endpointRelatedEvents(store.events, endpointId);
  const recent = all.filter((event) => inRange(event, anchor - windowMs('24h'), anchor));
  const latency = latencySeries(recent);
  const degradationDelta24h = degradationDelta(store.events, anchor, endpointId, 'endpoint');
  const routeSeries = endpointRouteEligibilitySeries(recent, currentRouteEligibility);
  const firstRoute = routeSeries[0]?.value;
  const lastRoute = routeSeries.at(-1)?.value;
  const changed = typeof firstRoute === 'boolean' && typeof lastRoute === 'boolean' && firstRoute !== lastRoute ? true : routeSeries.length >= 2 ? false : null;
  return {
    trust_delta_24h: null,
    signal_delta_24h: null,
    latency_delta_24h: deltaBetweenFirstLast(latency),
    degradation_delta_24h: degradationDelta24h,
    route_eligibility_changed: changed,
    trend_direction: trendDirectionFromParts(null, null, degradationDelta24h, deltaBetweenFirstLast(latency))
  };
}

export function trendContextForProvider(store: IntelligenceStore, providerId: string): TrendContext {
  const deltas = providerTrendDeltas(store, providerId);
  const health = lastKnownGoodState(providerRelatedEvents(store.events, providerId), 'provider');
  const warning = deltas.trend_direction === 'degrading' && deltas.trust_delta_24h !== null && deltas.trust_delta_24h >= 0
    ? 'High current trust, but recent degradation trend detected.'
    : deltas.degradation_delta_24h !== null && deltas.degradation_delta_24h > 0
      ? 'Recent degradation trend detected.'
      : null;
  return {
    trust_trend: directionFromDelta(deltas.trust_delta_24h, false),
    signal_trend: directionFromDelta(deltas.signal_delta_24h, false),
    degradation_trend: directionFromDelta(deltas.degradation_delta_24h, true),
    trust_delta_24h: deltas.trust_delta_24h,
    signal_delta_24h: deltas.signal_delta_24h,
    latency_delta_24h: deltas.latency_delta_24h,
    degradation_delta_24h: deltas.degradation_delta_24h,
    route_eligibility_changed: deltas.route_eligibility_changed,
    last_seen_healthy_at: health.last_seen_healthy_at,
    warning
  };
}

function historyAnchor(store: IntelligenceStore) {
  const times = store.events.map((event) => eventTime(event)).filter(Number.isFinite);
  return times.length ? Math.max(...times) : Date.now();
}

function windowMs(windowName: WindowName) {
  if (windowName === '7d') return 7 * 24 * 60 * 60 * 1000;
  if (windowName === '48h') return 48 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function eventTime(event: InfopunksEvent) {
  return Date.parse(event.observed_at ?? event.observedAt);
}

function inRange(event: InfopunksEvent, start: number, end: number) {
  const time = eventTime(event);
  return time >= start && time <= end;
}

function providerRelatedEvents(events: InfopunksEvent[], providerId: string) {
  return events.filter((event) => event.provider_id === providerId || event.entityId === providerId || event.payload.providerId === providerId || event.payload.entityId === providerId);
}

function endpointRelatedEvents(events: InfopunksEvent[], endpointId: string) {
  return events.filter((event) => event.endpoint_id === endpointId || event.entityId === endpointId || event.payload.endpointId === endpointId);
}

function scoreSeries(events: InfopunksEvent[], entityType: 'trust_assessment' | 'signal_assessment', providerId: string): Point<number>[] {
  return dedupePoints(events
    .filter((event) => event.type === 'score_assessment_created' && event.entityType === entityType && (event.provider_id === providerId || event.payload.providerId === providerId || event.payload.entityId === providerId))
    .map((event) => ({ at: event.observed_at ?? event.observedAt, value: typeof event.payload.score === 'number' ? event.payload.score : null }))
    .filter((point): point is Point<number> => typeof point.value === 'number'));
}

function componentSeries(events: InfopunksEvent[], entityType: 'trust_assessment' | 'signal_assessment', providerId: string, component: string): Point<number>[] {
  return dedupePoints(events
    .filter((event) => event.type === 'score_assessment_created' && event.entityType === entityType && (event.provider_id === providerId || event.payload.providerId === providerId || event.payload.entityId === providerId))
    .map((event) => {
      const components = event.payload.components;
      const value = components && typeof components === 'object' && !Array.isArray(components) ? (components as Record<string, unknown>)[component] : null;
      return { at: event.observed_at ?? event.observedAt, value: typeof value === 'number' ? value : null };
    })
    .filter((point): point is Point<number> => typeof point.value === 'number'));
}

function averageScoreSeries(events: InfopunksEvent[], entityType: 'trust_assessment' | 'signal_assessment'): Point<number>[] {
  const groups = new Map<string, number[]>();
  for (const event of events) {
    if (event.type !== 'score_assessment_created' || event.entityType !== entityType || typeof event.payload.score !== 'number') continue;
    const at = event.observed_at ?? event.observedAt;
    const current = groups.get(at) ?? [];
    current.push(event.payload.score);
    groups.set(at, current);
  }
  return [...groups.entries()]
    .map(([at, values]) => ({ at, value: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function latencySeries(events: InfopunksEvent[]): Point<number>[] {
  return dedupePoints(events
    .map((event) => ({ at: event.observed_at ?? event.observedAt, value: typeof event.payload.response_time_ms === 'number' ? event.payload.response_time_ms : null }))
    .filter((point): point is Point<number> => typeof point.value === 'number'));
}

function reachabilitySeries(events: InfopunksEvent[], scope: 'provider' | 'endpoint'): Point<string>[] {
  const prefix = scope === 'provider' ? 'provider.' : 'endpoint.';
  return dedupePoints(events
    .filter((event) => event.type === `${prefix}reachable` || event.type === `${prefix}recovered` || event.type === `${prefix}degraded` || event.type === `${prefix}failed` || event.type === `${prefix}checked`)
    .map((event) => ({ at: event.observed_at ?? event.observedAt, value: healthValue(event) })));
}

function endpointPricingSeries(events: InfopunksEvent[], currentKnown: boolean): Point<boolean>[] {
  const points = events
    .filter((event) => event.type === 'pricing_observed' || event.type === 'price.changed' || event.type === 'endpoint.updated')
    .map((event) => ({ at: event.observed_at ?? event.observedAt, value: pricingKnownFromPayload(event.payload) }));
  return points.length ? dedupePoints(points) : currentKnown ? [] : [];
}

function endpointMappingSeries(events: InfopunksEvent[], currentComplete: boolean): Point<boolean>[] {
  const points = events
    .filter((event) => event.type === 'endpoint.updated' || event.type === 'pay_sh_catalog_endpoint_seen')
    .map((event) => ({ at: event.observed_at ?? event.observedAt, value: mappingCompleteFromPayload(event.payload) }));
  return points.length ? dedupePoints(points) : currentComplete ? [] : [];
}

function endpointRouteEligibilitySeries(events: InfopunksEvent[], currentEligible: boolean | null): Point<boolean>[] {
  const points = events
    .filter((event) => event.type === 'endpoint.recovered' || event.type === 'endpoint.degraded' || event.type === 'endpoint.failed' || event.type === 'endpoint.updated')
    .map((event) => ({ at: event.observed_at ?? event.observedAt, value: routeEligibleFromEvent(event) }));
  return points.length ? dedupePoints(points) : typeof currentEligible === 'boolean' ? [] : [];
}

function cumulativeEventSeries(events: InfopunksEvent[]): Point<number>[] {
  return [...events]
    .sort((a, b) => eventTime(a) - eventTime(b))
    .map((event, index) => ({ at: event.observed_at ?? event.observedAt, value: index + 1 }));
}

function degradationDelta(events: InfopunksEvent[], anchor: number, id: string | null, scope: 'provider' | 'endpoint' | 'ecosystem') {
  const currentStart = anchor - windowMs('24h');
  const previousStart = anchor - (2 * windowMs('24h'));
  const relevant = events.filter((event) => {
    if (!isDegradationEvent(event)) return false;
    if (scope === 'ecosystem') return true;
    if (scope === 'provider') return id !== null && (event.provider_id === id || event.entityId === id || event.payload.providerId === id);
    return id !== null && (event.endpoint_id === id || event.entityId === id || event.payload.endpointId === id);
  });
  const current = relevant.filter((event) => inRange(event, currentStart, anchor)).length;
  const previous = relevant.filter((event) => inRange(event, previousStart, currentStart)).length;
  if (current + previous === 0) return null;
  return current - previous;
}

function lastKnownGoodState(events: InfopunksEvent[], scope: 'provider' | 'endpoint'): LastKnownGoodState {
  const relevant = events.filter((event) => scope === 'provider' ? event.type.startsWith('provider.') : event.type.startsWith('endpoint.'));
  const sorted = [...relevant].sort((a, b) => eventTime(b) - eventTime(a));
  const latest = sorted[0] ?? null;
  const healthy = sorted.find((event) => event.type.endsWith('.reachable') || event.type.endsWith('.recovered') || (event.type.endsWith('.checked') && event.payload.success === true));
  const degraded = sorted.find((event) => event.type.endsWith('.degraded'));
  const failed = sorted.find((event) => event.type.endsWith('.failed') || (event.type.endsWith('.checked') && event.payload.success === false));
  return {
    last_seen_healthy_at: healthy ? healthy.observed_at ?? healthy.observedAt : null,
    last_degraded_at: degraded ? degraded.observed_at ?? degraded.observedAt : null,
    last_failed_at: failed ? failed.observed_at ?? failed.observedAt : null,
    current_health_state: latest ? healthValue(latest) : 'unknown',
    health_state_reason: latest ? `Derived from ${latest.type} at ${latest.observed_at ?? latest.observedAt}` : 'No monitor or degradation events available yet'
  };
}

function healthValue(event: InfopunksEvent): HealthState {
  if (event.type.endsWith('.reachable') || event.type.endsWith('.recovered')) return event.type.startsWith('endpoint.') ? 'healthy' : 'reachable';
  if (event.type.endsWith('.degraded')) return 'degraded';
  if (event.type.endsWith('.failed')) return 'failed';
  if (event.payload.success === true) return event.type.startsWith('endpoint.') ? 'healthy' : 'reachable';
  if (event.payload.success === false) return 'failed';
  if (typeof event.payload.status === 'string' && /degraded/i.test(event.payload.status)) return 'degraded';
  return 'unknown';
}

function isDegradationEvent(event: InfopunksEvent) {
  return event.type === 'provider.degraded' || event.type === 'provider.failed' || event.type === 'endpoint.degraded' || event.type === 'endpoint.failed';
}

function deltaBetweenFirstLast(points: Point<number>[]) {
  if (points.length < 2) return null;
  return Math.round((points[points.length - 1].value - points[0].value) * 100) / 100;
}

function trendDirectionFromParts(trustDelta: number | null, signalDelta: number | null, degradationDelta24h: number | null, latencyDelta?: number | null): TrendDirection {
  if (degradationDelta24h !== null && degradationDelta24h > 0) return 'degrading';
  if (latencyDelta !== null && latencyDelta !== undefined && latencyDelta > 100) return 'degrading';
  const scoreDeltas = [trustDelta, signalDelta].filter((value): value is number => typeof value === 'number');
  if (!scoreDeltas.length) return 'unknown';
  const total = scoreDeltas.reduce((sum, value) => sum + value, 0);
  if (total >= 3) return 'improving';
  if (total <= -3) return 'degrading';
  return 'stable';
}

function directionFromDelta(delta: number | null, inverse: boolean): TrendDirection {
  if (delta === null) return 'unknown';
  if (Math.abs(delta) < 1) return 'stable';
  if (inverse) return delta > 0 ? 'degrading' : 'improving';
  return delta > 0 ? 'improving' : 'degrading';
}

function uniqueSampleCount(series: Array<Point<unknown>[]>) {
  return new Set(series.flat().map((point) => point.at)).size;
}

function dedupePoints<T>(points: Point<T>[]): Point<T>[] {
  const byAt = new Map<string, Point<T>>();
  for (const point of points.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) byAt.set(point.at, point);
  return [...byAt.values()];
}

function pricingKnownFromPayload(payload: Record<string, unknown>) {
  const pricing = payload.pricing;
  if (pricing && typeof pricing === 'object' && !Array.isArray(pricing)) return hasKnownPricing(pricing);
  return typeof payload.min === 'number' || typeof payload.max === 'number' || typeof payload.price === 'string';
}

function mappingCompleteFromPayload(payload: Record<string, unknown>) {
  return typeof payload.method === 'string' && typeof payload.path === 'string';
}

function routeEligibleFromEvent(event: InfopunksEvent) {
  if (event.type === 'endpoint.recovered') return true;
  if (event.type === 'endpoint.degraded' || event.type === 'endpoint.failed') return false;
  return mappingCompleteFromPayload(event.payload) && pricingKnownFromPayload(event.payload);
}

function hasKnownPricing(pricing: unknown) {
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) return false;
  const shape = pricing as Record<string, unknown>;
  return typeof shape.raw === 'string' && shape.raw.trim().length > 0 || typeof shape.min === 'number' || typeof shape.max === 'number';
}
