import cors from '@fastify/cors';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { z } from 'zod';
import { createIntelligenceStore, defaultRepository, emptyIntelligenceStore, IntelligenceStore, runPayShIngestion, runPayShIngestionWithOptions } from '../services/intelligenceStore';
import { IntelligenceRepository } from '../persistence/repository';
import { recommendRoute } from '../services/routeService';
import { semanticSearch } from '../services/searchService';
import {
  PreflightRequestSchema,
  PreflightResponseSchema,
  RadarComparisonRequestSchema,
  RadarEcosystemRiskSummarySchema,
  RadarBatchPreflightRequestSchema,
  RadarBatchPreflightResponseSchema,
  RadarBenchmarkReadinessSchema,
  RadarBenchmarkSummarySchema,
  RadarBenchmarkListSchema,
  RadarBenchmarkDetailSchema,
  RadarBenchmarkHistorySchema,
  RadarBenchmarkHistoryAggregateSchema,
  RadarBenchmarkArtifactListSchema,
  RadarBenchmarkArtifactSchema,
  RadarPreflightRequestSchema,
  RadarPreflightResponseSchema,
  RadarRiskResponseSchema,
  RadarSuperiorityReadinessSchema,
  RouteRecommendationRequestSchema,
  SearchRequestSchema
} from '../schemas/entities';
import { endpointHistory, findEndpoint, findProvider, providerHistory, providerIntelligence } from '../services/providerIntelligenceService';
import { endpointMonitorSummary, isMonitorEnabled, monitorIntervalMs, monitorMaxProviders, monitorTimeoutMs, providerMonitorSummary, runMonitor } from '../services/endpointMonitorService';
import { loadRuntimeConfig } from '../config/env';
import { dataSourceState, PULSE_CAPS, pulseSummary } from '../services/pulseService';
import { featuredProviderRotation } from '../services/featuredProviderService';
import { classifyEventSeverity, classifyGraphSeverity, classifyNarrativeClusterSeverity, classifyProviderDossierSeverity } from '../engines/severityEngine';
import { analyzePropagation } from '../services/propagationService';
import { resolvePropagationIncident } from '../services/propagationIncidentService';
import { providerReachabilitySummary, providerRootHealthSummary } from '../services/eventSummaryHelpers';
import { runPreflight } from '../services/preflightService';
import { buildRadarExportSnapshot, safeJsonExport } from '../services/radarExportService';
import { buildBenchmarkReadiness, buildSuperiorityReadiness, runRadarComparison, runRadarPreflight, runRadarPreflightBatch } from '../services/radarRouteIntelligenceService';
import { buildRadarBenchmarkById, buildRadarBenchmarkHistoryAggregate, buildRadarBenchmarkHistoryById, buildRadarBenchmarks, buildRadarBenchmarkSummary, getBenchmarkArtifactMetadataById, listBenchmarkArtifactMetadata } from '../services/radarBenchmarkService';
import { buildEcosystemHistory, buildEndpointHistory, buildProviderHistory, normalizeHistoryWindow } from '../services/radarHistoryService';
import { buildEcosystemRiskSummary, buildEndpointRiskAssessment, buildProviderRiskAssessment } from '../services/radarRiskService';
import { createResponseCache } from '../services/responseCache';
import { DEFAULT_LIVE_CATALOG_URL } from '../ingestion/payShCatalogAdapter';
import { degradationsCsv, endpointsCsv, providersCsv, routeCandidatesCsv } from '../services/radarCsvService';
import { listRouteMappings } from '../services/providerEndpointMap';
import { listMappingTargets } from '../services/mappingTargetService';
import { createOpenApiSpec } from './openapi';

const IngestRequestSchema = z.object({ catalogUrl: z.string().url().optional() }).optional();
const MAX_INLINE_SUPPORTING_EVENT_IDS = 10;
const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://radar.infopunks.fun',
  'https://infopunks-pay-sh-radar-web.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]);
const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];
const CORS_MAX_AGE_SECONDS = 86_400;

export async function createApp(preloadedStore?: IntelligenceStore, repository: IntelligenceRepository = defaultRepository()) {
  const config = loadRuntimeConfig();
  const app = Fastify({ logger: false });
  const ROUTE_TIMEOUT_MS = 2_500;
  const SEARCH_ROUTE_TIMEOUT_MS = 3_000;
  const RADAR_BENCHMARKS_TTL_MS = 5 * 60 * 1000;
  const RADAR_ENDPOINTS_TTL_MS = 2 * 60 * 1000;
  const RADAR_ECOSYSTEM_RISK_TTL_MS = 2 * 60 * 1000;
  const RADAR_ECOSYSTEM_HISTORY_TTL_MS = 2 * 60 * 1000;
  const RADAR_ECOSYSTEM_RISK_TIMEOUT_MS = 1_200;
  const RADAR_ECOSYSTEM_HISTORY_TIMEOUT_MS = 1_200;
  const PROVIDER_LIST_MAX = 100;
  const responseCache = createResponseCache();
  const allowedOrigins = new Set(DEFAULT_ALLOWED_ORIGINS);
  if (config.frontendOrigin) allowedOrigins.add(config.frontendOrigin);
  await app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    maxAge: CORS_MAX_AGE_SECONDS,
    optionsSuccessStatus: 204,
    preflight: true,
    strictPreflight: true
  });
  app.addHook('onRequest', async (req, _reply) => {
    const startedAtMs = Date.now();
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onRequest', id: req.id, method: req.method, url: req.url }));
    console.log(JSON.stringify({ event: 'request_start', id: req.id, method: req.method, url: req.url, started_at: new Date(startedAtMs).toISOString() }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onRequest', id: req.id }));
  });
  app.addHook('onError', async (req, reply, error) => {
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onError', id: req.id, method: req.method, url: req.url }));
    console.log(JSON.stringify({ event: 'request_errored', id: req.id, method: req.method, url: req.url, status_code: reply.statusCode, error: error.message }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onError', id: req.id }));
  });
  app.addHook('onResponse', async (req, reply) => {
    console.log(JSON.stringify({ event: 'hook_enter', hook: 'onResponse', id: req.id, method: req.method, url: req.url }));
    console.log(JSON.stringify({ event: 'request_complete', id: req.id, method: req.method, url: req.url, status_code: reply.statusCode }));
    console.log(JSON.stringify({ event: 'hook_exit', hook: 'onResponse', id: req.id }));
  });
  const store = preloadedStore ?? emptyIntelligenceStore();
  const repositoryDbStatus = () => {
    if (!('getDbStatus' in repository)) return null;
    const getDbStatus = (repository as IntelligenceRepository & { getDbStatus?: () => 'ok' | 'degraded' | 'unavailable' }).getDbStatus;
    return typeof getDbStatus === 'function' ? getDbStatus() : null;
  };
  let bootstrapped = Boolean(preloadedStore);
  const liveBootstrapEnabled = process.env.PAYSH_BOOTSTRAP_ENABLED === 'true'
    || (process.env.PAYSH_BOOTSTRAP_ENABLED !== 'false' && process.env.NODE_ENV !== 'test');
  const liveCatalogUrl = config.payShCatalogUrl ?? DEFAULT_LIVE_CATALOG_URL;
  let startupLoadPromise: Promise<void> | null = null;
  let liveBootstrapPromise: Promise<void> | null = null;
  let cachedPropagation = analyzePropagation(store);
  let cachedInterpretations = pulseSummary(
    store,
    new Date().toISOString(),
    config.payShIngestIntervalMs,
    { includePropagation: false, includeInterpretations: true, propagationFallback: cachedPropagation }
  ).interpretations;
  let cachedPulseDashboard = buildPulseDashboard(store, cachedInterpretations, bootstrapped);

  if (!preloadedStore) {
    const bootstrapStartMs = Date.now();
    startupLoadPromise = createIntelligenceStore(repository)
      .then((loadedStore) => {
        copyStoreInto(store, loadedStore);
        bootstrapped = Boolean(loadedStore.providers.length > 0);
        logTiming('database_connect', bootstrapStartMs);
        logTiming('catalog_load', bootstrapStartMs);
        refreshBackgroundAnalytics();
      })
      .catch((error) => {
        logDbDegraded('startup_load', classifyBootstrapFailure(error), error);
        console.log(JSON.stringify({
          event: 'startup_load_failed',
          code: errorCode(error),
          message: errorMessage(error)
        }));
      });
    void ensureLiveBootstrap('startup');
  } else {
    refreshBackgroundAnalytics();
  }

  app.get('/health', async () => ({
    ok: true,
    service: 'infopunks-pay-sh-radar',
    role: 'Cognitive Coordination Layer above Pay.sh',
    persistence: config.databaseUrl ? 'postgres' : 'memory',
    persistence_mode: config.databaseUrl ? 'postgres' : 'memory',
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    ...(config.databaseUrl ? { dbStatus: repositoryDbStatus() ?? 'degraded' } : {}),
    ...(config.databaseUrl ? { db_status: repositoryDbStatus() ?? 'degraded' } : {}),
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: safeStoreEndpointCount(store)
  }));
  app.get('/openapi.json', async () => createOpenApiSpec(config.version));
  app.get('/status', async () => withRouteTimeout('/status', ROUTE_TIMEOUT_MS, () => ({
    ok: true,
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    dbMode: config.databaseUrl ? 'postgres' : 'memory',
    ...(config.databaseUrl ? { dbStatus: repositoryDbStatus() ?? 'degraded' } : {}),
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: safeStoreEndpointCount(store),
    catalog_status: catalogStatusFromDataSource(store.dataSource)
  }), () => ({
    ok: true,
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    dbMode: config.databaseUrl ? 'postgres' : 'memory',
    ...(config.databaseUrl ? { dbStatus: repositoryDbStatus() ?? 'degraded' } : {}),
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: safeStoreEndpointCount(store),
    catalog_status: 'warming_up'
  })));
  app.get('/version', async () => ({ service: 'infopunks-pay-sh-radar', version: config.version }));
  app.get('/v1/pulse', async () => {
    await ensureLiveBootstrap('route:/v1/pulse');
    return withRouteTimeout('/v1/pulse', ROUTE_TIMEOUT_MS, () => ({
      data: buildPulseDashboard(store, cachedInterpretations, bootstrapped || store.providers.length > 0)
    }), () => ({
      data: pulseWarmingUpFallback(store, bootstrapped, 'pulse_timeout')
    }));
  });
  app.get('/v1/pulse/summary', async () => withRouteTimeout('/v1/pulse/summary', ROUTE_TIMEOUT_MS, () => {
    const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
    const pulse = buildPulseDashboard(store, cachedInterpretations, bootstrapped || store.providers.length > 0);
    summary.data_source = { ...summary.data_source, mode: pulse.data_source.mode };
    return { data: compactPulseSummaryPayload(summary) };
  }, () => ({
    data: (() => {
      const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
      const pulse = buildPulseDashboard(store, cachedInterpretations, bootstrapped || store.providers.length > 0);
      summary.data_source = { ...summary.data_source, mode: pulse.data_source.mode };
      return compactPulseSummaryPayload(summary);
    })()
  })));
  app.get('/v1/propagation', async () => ({ data: compactPropagationSummary(cachedPropagation) }));
  app.get<{ Params: { cluster_id: string } }>('/v1/propagation/:cluster_id', async (req, reply) => {
    const incident = resolvePropagationIncident(store, req.params.cluster_id, new Date().toISOString(), cachedPropagation, cachedInterpretations);
    if (!incident) return reply.code(404).send({ error: 'propagation_cluster_not_found' });
    return { data: incident };
  });
  app.get<{ Params: { id: string } }>('/v1/events/:id', async (req, reply) => {
    const event = store.events.find((item) => item.id === req.params.id);
    if (!event) return reply.code(404).send({ error: 'event_not_found' });
    return {
      data: {
        ...event,
        summary: summarizeEvent(event),
        ...classifyEventSeverity(event, store.events)
      }
    };
  });
  app.get('/v1/events/recent', async () => ({ data: [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0, 100).map((event) => ({ ...event, ...classifyEventSeverity(event, store.events) })) }));
  app.get('/v1/providers', async () => {
    await ensureLiveBootstrap('route:/v1/providers');
    return withRouteTimeout('/v1/providers', ROUTE_TIMEOUT_MS, () => ({
      data: lightweightProviders(store, PROVIDER_LIST_MAX)
    }), () => ({
      data: lightweightProviders(store, 25)
    }));
  });
  app.get('/v1/providers/featured', async () => ({ data: featuredProviderRotation(store, config.featuredProviderRotationMs) }));
  app.get<{ Params: { id: string } }>('/v1/providers/:id', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: { provider, endpoints: store.endpoints.filter((item) => item.providerId === provider.id), trustAssessment: store.trustAssessments.find((item) => item.entityId === provider.id), signalAssessment: store.signalAssessments.find((item) => item.entityId === provider.id) } };
  });
  app.get<{ Params: { id: string } }>('/v1/providers/:id/history', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerHistory(store, provider) };
  });
  app.get<{ Params: { id: string } }>('/v1/providers/:id/intelligence', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerIntelligence(store, provider) };
  });
  app.get('/v1/endpoints', async () => ({ data: store.endpoints }));
  app.get('/v1/radar/scored-catalog', async () => {
    const snapshot = buildRadarExportSnapshot(store);
    return {
      data: safeJsonExport({
        generated_at: snapshot.generated_at,
        source: snapshot.source,
        counts: {
          providers: snapshot.providers.length,
          endpoints: snapshot.endpoints.length
        },
        providers: snapshot.providers,
        endpoints: snapshot.endpoints
      })
    };
  });
  app.get('/v1/radar/providers', async () => {
    const snapshot = buildRadarExportSnapshot(store);
    return {
      data: safeJsonExport({
        generated_at: snapshot.generated_at,
        source: snapshot.source,
        count: snapshot.providers.length,
        providers: snapshot.providers
      })
    };
  });
  app.get('/v1/radar/endpoints', async () => {
    const startedAtMs = Date.now();
    await ensureLiveBootstrap('route:/v1/radar/endpoints');
    const cached = await responseCache.getOrSet('radar:endpoints', RADAR_ENDPOINTS_TTL_MS, () => {
      const snapshot = buildRadarExportSnapshot(store);
      return {
        generated_at: snapshot.generated_at,
        source: snapshot.source,
        count: snapshot.endpoints.length,
        endpoint_metadata: endpointMetadataState(store),
        endpoints: snapshot.endpoints
      };
    });
    logRadarRouteTiming('/v1/radar/endpoints', Date.now() - startedAtMs, cached.metadata.hit, 'ok');
    return {
      data: safeJsonExport({
        generated_at: cached.value.generated_at,
        source: cached.value.source,
        count: cached.value.count,
        endpoint_metadata: cached.value.endpoint_metadata,
        endpoints: cached.value.endpoints
      })
    };
  });
  app.get('/v1/radar/routes/candidates', async () => {
    const snapshot = buildRadarExportSnapshot(store);
    return {
      data: safeJsonExport({
        generated_at: snapshot.generated_at,
        source: snapshot.source,
        count: snapshot.route_candidates.count,
        total_endpoints: snapshot.route_candidates.total_endpoints,
        grouped_by_category: snapshot.route_candidates.by_category,
        grouped_by_provider: snapshot.route_candidates.by_provider
      })
    };
  });
  app.get('/v1/radar/mappings', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      count: listRouteMappings().length,
      mappings: listRouteMappings()
    })
  }));
  app.get('/v1/radar/mapping-targets', async () => ({
    data: safeJsonExport({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      count: listMappingTargets().length,
      targets: listMappingTargets()
    })
  }));
  app.get('/v1/radar/export/providers.csv', async (_req, reply) => {
    reply.type('text/csv; charset=utf-8');
    return providersCsv(store);
  });
  app.get('/v1/radar/export/endpoints.csv', async (_req, reply) => {
    reply.type('text/csv; charset=utf-8');
    return endpointsCsv(store);
  });
  app.get('/v1/radar/export/route-candidates.csv', async (_req, reply) => {
    reply.type('text/csv; charset=utf-8');
    return routeCandidatesCsv(store);
  });
  app.get('/v1/radar/export/degradations.csv', async (_req, reply) => {
    reply.type('text/csv; charset=utf-8');
    return degradationsCsv(store);
  });
  app.get<{ Params: { provider_id: string }; Querystring: { window?: string } }>('/v1/radar/history/providers/:provider_id', async (req, reply) => {
    const history = buildProviderHistory(store, req.params.provider_id, normalizeHistoryWindow(req.query.window));
    if (!history) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: safeJsonExport(history) };
  });
  app.get<{ Params: { endpoint_id: string }; Querystring: { window?: string } }>('/v1/radar/history/endpoints/:endpoint_id', async (req, reply) => {
    const history = buildEndpointHistory(store, req.params.endpoint_id, normalizeHistoryWindow(req.query.window));
    if (!history) return reply.code(404).send({ error: 'endpoint_not_found' });
    return { data: safeJsonExport(history) };
  });
  app.get<{ Querystring: { window?: string } }>('/v1/radar/history/ecosystem', async (req) => {
    const startedAtMs = Date.now();
    const windowName = normalizeHistoryWindow(req.query.window);
    const cacheKey = `radar:history:ecosystem:${windowName}`;
    try {
      const cached = await responseCache.getOrSet(cacheKey, RADAR_ECOSYSTEM_HISTORY_TTL_MS, async () => withTimeout(
        () => buildEcosystemHistory(store, windowName),
        RADAR_ECOSYSTEM_HISTORY_TIMEOUT_MS,
        'ecosystem_history_timeout'
      ));
      logRadarRouteTiming('/v1/radar/history/ecosystem', Date.now() - startedAtMs, cached.metadata.hit, cached.metadata.stale ? 'stale_ok' : 'ok');
      return { data: safeJsonExport(cached.value) };
    } catch {
      const fallback = buildEcosystemHistory(store, windowName);
      fallback.history_available = false;
      fallback.reason = 'History enrichment is warming up.';
      fallback.warnings = Array.from(new Set([...fallback.warnings, 'history warming up']));
      logRadarRouteTiming('/v1/radar/history/ecosystem', Date.now() - startedAtMs, false, 'warming_up');
      return { data: safeJsonExport(fallback) };
    }
  });
  app.get<{ Params: { provider_id: string } }>('/v1/radar/risk/providers/:provider_id', async (req, reply) => {
    const risk = buildProviderRiskAssessment(store, req.params.provider_id);
    if (!risk) return reply.code(404).send({ error: 'provider_not_found' });
    return {
      data: safeJsonExport(RadarRiskResponseSchema.parse({
        generated_at: risk.generated_at,
        subject_type: risk.subject_type,
        subject_id: risk.subject_id,
        risk_score: risk.predictive_risk_score,
        risk_level: risk.predictive_risk_level,
        history_available: risk.history_available,
        sample_count: risk.sample_count,
        explanation: risk.explanation,
        anomalies: risk.anomalies,
        evidence: risk.evidence,
        warnings: risk.warnings,
        recommended_action: risk.recommended_action
      }))
    };
  });
  app.get<{ Params: { endpoint_id: string } }>('/v1/radar/risk/endpoints/:endpoint_id', async (req, reply) => {
    const risk = buildEndpointRiskAssessment(store, req.params.endpoint_id);
    if (!risk) return reply.code(404).send({ error: 'endpoint_not_found' });
    return {
      data: safeJsonExport(RadarRiskResponseSchema.parse({
        generated_at: risk.generated_at,
        subject_type: risk.subject_type,
        subject_id: risk.subject_id,
        risk_score: risk.predictive_risk_score,
        risk_level: risk.predictive_risk_level,
        history_available: risk.history_available,
        sample_count: risk.sample_count,
        explanation: risk.explanation,
        anomalies: risk.anomalies,
        evidence: risk.evidence,
        warnings: risk.warnings,
        recommended_action: risk.recommended_action
      }))
    };
  });
  app.get('/v1/radar/risk/ecosystem', async () => {
    const startedAtMs = Date.now();
    try {
      const cached = await responseCache.getOrSet('radar:risk:ecosystem', RADAR_ECOSYSTEM_RISK_TTL_MS, async () => {
        const risk = await withTimeout(() => buildEcosystemRiskSummary(store), RADAR_ECOSYSTEM_RISK_TIMEOUT_MS, 'ecosystem_risk_timeout');
        return RadarEcosystemRiskSummarySchema.parse({
          generated_at: risk.generated_at,
          subject_type: risk.subject_type,
          subject_id: risk.subject_id,
          risk_score: risk.risk_score,
          risk_level: risk.risk_level,
          history_available: risk.history_available,
          sample_count: risk.sample_count,
          anomalies: risk.anomalies,
          evidence: risk.evidence,
          warnings: risk.warnings,
          recommended_action: risk.recommended_action,
          summary: risk.summary
        });
      });
      logRadarRouteTiming('/v1/radar/risk/ecosystem', Date.now() - startedAtMs, cached.metadata.hit, cached.metadata.stale ? 'stale_ok' : 'ok');
      return { data: safeJsonExport(cached.value) };
    } catch {
      const fallback = RadarEcosystemRiskSummarySchema.parse({
        generated_at: new Date().toISOString(),
        subject_type: 'ecosystem',
        subject_id: 'ecosystem',
        risk_score: 50,
        risk_level: 'unknown',
        history_available: false,
        sample_count: 0,
        explanation: 'Risk enrichment is warming up.',
        anomalies: [],
        evidence: ['Risk enrichment is warming up.'],
        warnings: ['risk warming up'],
        recommended_action: 'insufficient history',
        summary: {
          providers_by_risk_level: { low: 0, watch: 0, elevated: 0, critical: 0, unknown: 0 },
          top_anomalies: [],
          categories_most_affected: [],
          recent_critical_events: [],
          stale_catalog_warning: null,
          anomaly_watch: []
        }
      });
      logRadarRouteTiming('/v1/radar/risk/ecosystem', Date.now() - startedAtMs, false, 'warming_up');
      return { data: safeJsonExport(fallback) };
    }
  });
  app.post('/v1/radar/preflight', async (req, reply) => handleParsed(req.body, RadarPreflightRequestSchema, (input) => ({
    data: safeJsonExport(RadarPreflightResponseSchema.parse(runRadarPreflight(input, store)))
  }), reply));
  app.post('/v1/radar/preflight/batch', async (req, reply) => handleParsed(req.body, RadarBatchPreflightRequestSchema, (input) => ({
    data: safeJsonExport(RadarBatchPreflightResponseSchema.parse(runRadarPreflightBatch(input, store)))
  }), reply));
  app.post('/v1/radar/compare', async (req, reply) => handleParsed(req.body, RadarComparisonRequestSchema, (input) => ({
    data: safeJsonExport(runRadarComparison(input, store))
  }), reply));
  app.get('/v1/radar/superiority-readiness', async () => ({
    data: safeJsonExport(RadarSuperiorityReadinessSchema.parse(buildSuperiorityReadiness(store)))
  }));
  app.get('/v1/radar/benchmark-readiness', async () => ({
    data: safeJsonExport(RadarBenchmarkReadinessSchema.parse(buildBenchmarkReadiness(store)))
  }));
  app.get('/v1/radar/benchmark-summary', async () => {
    const startedAtMs = Date.now();
    const cached = await responseCache.getOrSet('radar:benchmark-summary', RADAR_BENCHMARKS_TTL_MS, () => RadarBenchmarkSummarySchema.parse(buildRadarBenchmarkSummary()));
    logRadarRouteTiming('/v1/radar/benchmark-summary', Date.now() - startedAtMs, cached.metadata.hit, cached.metadata.stale ? 'stale_ok' : 'ok');
    return { data: safeJsonExport(cached.value) };
  });
  app.get('/v1/radar/benchmarks', async () => {
    const startedAtMs = Date.now();
    const cached = await responseCache.getOrSet('radar:benchmarks', RADAR_BENCHMARKS_TTL_MS, () => RadarBenchmarkListSchema.parse(buildRadarBenchmarks()));
    logRadarRouteTiming('/v1/radar/benchmarks', Date.now() - startedAtMs, cached.metadata.hit, cached.metadata.stale ? 'stale_ok' : 'ok');
    return { data: safeJsonExport(cached.value) };
  });
  app.get<{ Params: { benchmark_id: string } }>('/v1/radar/benchmarks/:benchmark_id', async (req, reply) => {
    const benchmark = buildRadarBenchmarkById(req.params.benchmark_id);
    if (!benchmark) return reply.code(404).send({ error: 'benchmark_not_found' });
    return {
      data: safeJsonExport(RadarBenchmarkDetailSchema.parse(benchmark))
    };
  });
  app.get<{ Params: { benchmark_id: string } }>('/v1/radar/benchmarks/:benchmark_id/history', async (req, reply) => {
    const history = buildRadarBenchmarkHistoryById(req.params.benchmark_id);
    if (!history) return reply.code(404).send({ error: 'benchmark_not_found' });
    return {
      data: safeJsonExport(RadarBenchmarkHistorySchema.parse(history))
    };
  });
  app.get('/v1/radar/benchmark-history', async () => ({
    data: safeJsonExport(RadarBenchmarkHistoryAggregateSchema.parse(buildRadarBenchmarkHistoryAggregate()))
  }));
  app.get('/v1/radar/benchmark-artifacts', async () => ({
    data: safeJsonExport(RadarBenchmarkArtifactListSchema.parse({
      generated_at: new Date().toISOString(),
      source: 'infopunks-pay-sh-radar',
      artifacts: listBenchmarkArtifactMetadata()
    }))
  }));
  app.get<{ Params: { artifact_id: string } }>('/v1/radar/benchmark-artifacts/:artifact_id', async (req, reply) => {
    const artifact = getBenchmarkArtifactMetadataById(req.params.artifact_id);
    if (!artifact) return reply.code(404).send({ error: 'benchmark_artifact_not_found' });
    return {
      data: safeJsonExport(RadarBenchmarkArtifactSchema.parse(artifact))
    };
  });
  app.get('/v1/monitor/runs/recent', async () => ({ data: [...(store.monitorRuns ?? [])].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 20).map(monitorRunResponse) }));
  app.get<{ Params: { id: string } }>('/v1/providers/:id/monitor', async (req, reply) => {
    const provider = findProvider(store, req.params.id);
    if (!provider) return reply.code(404).send({ error: 'provider_not_found' });
    return { data: providerMonitorSummary(store, provider) };
  });
  app.get<{ Params: { id: string } }>('/v1/endpoints/:id/monitor', async (req, reply) => {
    const endpoint = findEndpoint(store, req.params.id);
    if (!endpoint) return reply.code(404).send({ error: 'endpoint_not_found' });
    return { data: endpointMonitorSummary(store, endpoint) };
  });
  app.get<{ Params: { id: string } }>('/v1/endpoints/:id/history', async (req, reply) => {
    const endpoint = findEndpoint(store, req.params.id);
    if (!endpoint) return reply.code(404).send({ error: 'endpoint_not_found' });
    return { data: endpointHistory(store, endpoint) };
  });
  app.get<{ Params: { entity_id: string } }>('/v1/trust/:entity_id', async (req, reply) => {
    const trust = store.trustAssessments.find((item) => item.entityId === req.params.entity_id);
    if (!trust) return reply.code(404).send({ error: 'trust_assessment_not_found' });
    return { data: trust };
  });
  app.get<{ Params: { entity_id: string } }>('/v1/signal/:entity_id', async (req, reply) => {
    const signal = store.signalAssessments.find((item) => item.entityId === req.params.entity_id);
    if (!signal) return reply.code(404).send({ error: 'signal_assessment_not_found' });
    return { data: signal };
  });
  app.get('/v1/narratives', async () => ({ data: store.narratives }));
  app.post('/v1/search', async (req, reply) => handleParsed(req.body, SearchRequestSchema, async (input) => {
    const startedAtMs = Date.now();
    console.log(JSON.stringify({ event: 'route_timing_start', route: '/v1/search', started_at: new Date(startedAtMs).toISOString() }));
    try {
      const result = await withTimeout(() => semanticSearch(input, store), SEARCH_ROUTE_TIMEOUT_MS, 'search_timeout');
      console.log(JSON.stringify({ event: 'route_timing_end', route: '/v1/search', duration_ms: Date.now() - startedAtMs, timed_out: false }));
      return { data: result };
    } catch {
      console.log(JSON.stringify({ event: 'route_timing_end', route: '/v1/search', duration_ms: Date.now() - startedAtMs, timed_out: true }));
      return { data: [], degraded: true, reason: 'search_timeout' };
    }
  }, reply));
  app.post('/v1/recommend-route', async (req, reply) => handleParsed(req.body, RouteRecommendationRequestSchema, (input) => ({ data: recommendRoute(input, store) }), reply));
  app.post('/v1/preflight', async (req, reply) => handleParsed(req.body, PreflightRequestSchema, (input) => ({ data: runPreflight(input, store) }), reply));
  app.get('/v1/preflight/schema', async () => ({
    data: {
      request: z.toJSONSchema(PreflightRequestSchema),
      response: z.toJSONSchema(PreflightResponseSchema),
      example: {
        request: {
          intent: 'prepay route selection for settlement',
          category: 'Payments',
          constraints: { minTrustScore: 80, maxLatencyMs: 500, maxCostUsd: 0.05 },
          candidateProviders: ['alpha', 'beta']
        },
        response: {
          decision: 'route_approved',
          selectedProvider: 'alpha'
        }
      }
    }
  }));
  app.post('/v1/ingest/pay-sh', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    return handleParsed(req.body, IngestRequestSchema, async (input) => {
      const result = await runPayShIngestion(store, repository, input?.catalogUrl);
      refreshBackgroundAnalytics();
      return { data: { run: result.run, emittedEvents: result.events.length, usedFixture: result.usedFixture, liveFetchFailed: result.liveFetchFailed } };
    }, reply);
  });
  app.post('/v1/monitor/run', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization)) return reply.code(401).send({ error: 'admin_token_required' });
    const result = await runMonitor(store, repository, { timeoutMs: monitorTimeoutMs(), maxProviders: monitorMaxProviders() });
    refreshBackgroundAnalytics();
    return { data: { run: result.run, emittedEvents: result.events.length } };
  });
  app.get('/v1/graph', async () => ({ data: { nodes: graphNodes(store), edges: graphEdges(store), evidence: graphReceipt(store) } }));
  app.get<{ Params: { id: string } }>('/interpretations/:id', async (req, reply) => {
    const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
    const interpretation = summary.interpretations.find((item) => item.interpretation_id === req.params.id);
    if (!interpretation) return reply.code(404).type('text/html; charset=utf-8').send(renderInterpretationNotFoundPage(req, req.params.id, summary.generatedAt));
    return reply.type('text/html; charset=utf-8').send(renderInterpretationPage(req, interpretation, summary));
  });
  app.get<{ Params: { event_id: string } }>('/v1/receipts/:event_id', async (req, reply) => {
    const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
    const event = summary.timeline.find((item) => item.id === req.params.event_id || item.event_id === req.params.event_id);
    if (!event) return reply.code(404).send({ error: 'receipt_not_found' });

    const providerId = event.provider_id ?? event.providerId ?? null;
    const provider = providerId ? findProvider(store, providerId) : null;
    const propagation = cachedPropagation;
    const interpretations = summary.interpretations
      .filter((item) => item.supporting_event_ids.includes(event.id) || item.supporting_event_ids.includes(event.event_id ?? ''));

    return {
      data: {
        event_id: event.id,
        event_type: event.type,
        provider_id: providerId,
        endpoint_id: event.endpoint_id ?? event.endpointId ?? null,
        severity: event.severity ?? 'unknown',
        severity_reason: event.severity_reason ?? 'No deterministic severity reason available.',
        observed_at: event.observed_at ?? event.observedAt ?? null,
        catalog_generated_at: event.catalog_generated_at ?? null,
        ingested_at: event.ingested_at ?? null,
        source: event.source ?? 'unknown',
        derivation_reason: event.derivation_reason ?? 'Deterministic evidence event.',
        confidence: event.confidence ?? null,
        summary: {
          entity_type: event.entityType,
          entity_id: event.entityId,
          payload: event.payload
        },
        raw_summary: JSON.stringify(event.payload),
        links: {
          provider: provider ? { provider_id: provider.id, provider_name: provider.name, url: `/?provider_id=${encodeURIComponent(provider.id)}` } : null,
          provider_dossier: providerId ? `/?provider_id=${encodeURIComponent(providerId)}` : null,
          interpretations: interpretations.map((item) => ({ interpretation_id: item.interpretation_id, title: item.interpretation_title, url: `/#${item.interpretation_id}` })),
          propagation_cluster: propagation.supporting_event_ids.includes(event.id) || propagation.supporting_event_ids.includes(event.event_id ?? '')
            ? { cluster: propagation.affected_cluster, state: propagation.propagation_state, severity: propagation.severity, url: '/#propagation-watch' }
            : null
        }
      }
    };
  });
  const clientDistDir = resolve(process.cwd(), 'dist/client');
  const clientIndexPath = join(clientDistDir, 'index.html');
  if (existsSync(clientIndexPath)) {
    app.get('/*', async (req, reply) => {
      if (req.method !== 'GET') return reply.code(404).send({ error: 'not_found' });
      const urlPath = (req.raw.url ?? '/').split('?')[0] ?? '/';
      if (urlPath.startsWith('/v1/') || urlPath === '/health' || urlPath === '/version' || urlPath === '/status' || urlPath === '/openapi.json') {
        return reply.code(404).send({ error: 'not_found' });
      }
      const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const target = normalize(join(clientDistDir, relative));
      if (!target.startsWith(clientDistDir)) return reply.code(403).send({ error: 'forbidden' });
      try {
        const file = await stat(target);
        if (file.isFile()) {
          return reply.type(contentTypeFor(target)).send(createReadStream(target));
        }
      } catch {
        // fall through to SPA index
      }
      return reply.type('text/html; charset=utf-8').send(createReadStream(clientIndexPath));
    });
  }

  const intervalMs = config.ingestionEnabled ? (config.payShIngestIntervalMs ?? 0) : 0;
  if (intervalMs > 0) {
    const timer = setInterval(() => {
      void runPayShIngestion(store, repository)
        .then(() => refreshBackgroundAnalytics())
        .catch((error) => {
          logDbDegraded('ingestion_scheduler', classifyBootstrapFailure(error), error);
          console.log(JSON.stringify({
            event: 'ingestion_db_write_failed',
            stage: 'ingestion_scheduler',
            reason: classifyBootstrapFailure(error),
            code: errorCode(error),
            message: errorMessage(error)
          }));
          console.log(JSON.stringify({
            event: 'ingestion_job_failed',
            code: errorCode(error),
            message: errorMessage(error)
          }));
        });
    }, intervalMs);
    timer.unref();
    app.addHook('onClose', async () => {
      console.log(JSON.stringify({ event: 'hook_enter', hook: 'onClose', source: 'ingestion_timer' }));
      clearInterval(timer);
      console.log(JSON.stringify({ event: 'hook_exit', hook: 'onClose', source: 'ingestion_timer' }));
    });
  }
  if (isMonitorEnabled() && monitorIntervalMs() > 0) {
    const timer = setInterval(() => {
      void runMonitor(store, repository, { timeoutMs: monitorTimeoutMs(), maxProviders: monitorMaxProviders() })
        .then(() => refreshBackgroundAnalytics())
        .catch((error) => {
          logDbDegraded('monitor_scheduler', classifyBootstrapFailure(error), error);
          console.log(JSON.stringify({
            event: 'monitor_job_failed',
            code: errorCode(error),
            message: errorMessage(error)
          }));
        });
    }, monitorIntervalMs());
    timer.unref();
    app.addHook('onClose', async () => {
      console.log(JSON.stringify({ event: 'hook_enter', hook: 'onClose', source: 'monitor_timer' }));
      clearInterval(timer);
      console.log(JSON.stringify({ event: 'hook_exit', hook: 'onClose', source: 'monitor_timer' }));
    });
  }

  return app;

  function refreshBackgroundAnalytics() {
    setTimeout(() => {
      const generatedAt = new Date().toISOString();
      const propagationStartMs = Date.now();
      cachedPropagation = analyzePropagation(store, generatedAt);
      logTiming('propagation_build', propagationStartMs);
      const interpretationStartMs = Date.now();
      cachedInterpretations = pulseSummary(store, generatedAt, config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: true, propagationFallback: cachedPropagation }).interpretations;
      logTiming('interpretation_build', interpretationStartMs);
      cachedPulseDashboard = buildPulseDashboard(store, cachedInterpretations, bootstrapped, generatedAt);
      console.log(JSON.stringify({
        event: 'ingestion_state',
        catalogSource: config.payShCatalogSource,
        ingestionEnabled: config.ingestionEnabled,
        dbMode: config.databaseUrl ? 'postgres' : 'memory',
        providerCount: store.providers.length,
        endpointCount: store.endpoints.length,
        lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
        catalogStatus: catalogStatusFromDataSource(store.dataSource)
      }));
    }, 0);
  }

  async function ensureLiveBootstrap(reason: 'startup' | 'route:/v1/pulse' | 'route:/v1/providers' | 'route:/v1/radar/endpoints') {
    if (startupLoadPromise) await startupLoadPromise;
    if (isLiveBootstrapSatisfied(store)) {
      bootstrapped = true;
      return;
    }
    if (!liveBootstrapEnabled) {
      if (!store.dataSource || store.dataSource.error === null) {
        store.dataSource = {
          mode: 'fixture_fallback',
          url: liveCatalogUrl,
          generated_at: null,
          provider_count: store.providers.length,
          last_ingested_at: new Date().toISOString(),
          used_fixture: true,
          error: 'bootstrap_not_called'
        };
      }
      bootstrapped = store.providers.length > 0;
      return;
    }
    if (liveBootstrapPromise) {
      await liveBootstrapPromise;
      return;
    }

    liveBootstrapPromise = (async () => {
      console.log('[radar-bootstrap] starting live Pay.sh catalog bootstrap');
      let result: Awaited<ReturnType<typeof runPayShIngestionWithOptions>>;
      try {
        result = await runPayShIngestionWithOptions(store, repository, {
          catalogUrl: liveCatalogUrl,
          catalogSource: 'live',
          allowFixtureFallback: false
        });
      } catch (error) {
        const reason = classifyBootstrapFailure(error);
        logDbDegraded('live_bootstrap', reason, error);
        console.log(JSON.stringify({
          event: 'live_bootstrap_db_failure',
          reason,
          code: errorCode(error),
          message: errorMessage(error)
        }));
        throw new Error(reason);
      }
      const endpointCount = safeStoreEndpointCount(store);
      if (result.liveFetchFailed || !store.providers.length || store.dataSource?.mode !== 'live_pay_sh_catalog' || store.dataSource?.used_fixture) {
        const failureReason = store.dataSource?.error ?? 'pulse_state_inconsistent';
        throw new Error(failureReason);
      }
      bootstrapped = true;
      refreshBackgroundAnalytics();
      console.log(`[radar-bootstrap] live catalog bootstrap succeeded provider_count=${store.providers.length} endpoint_count=${endpointCount}`);
    })()
      .catch((error) => {
        const reasonLabel = error instanceof Error ? error.message : String(error);
        console.log(`[radar-bootstrap] live catalog bootstrap failed reason=${reasonLabel}`);
        bootstrapped = store.providers.length > 0;
        if (!store.providers.length) {
          store.dataSource = {
            mode: 'fixture_fallback',
            url: liveCatalogUrl,
            generated_at: null,
            provider_count: 0,
            last_ingested_at: new Date().toISOString(),
            used_fixture: true,
            error: store.dataSource?.error ?? reasonLabel
          };
        }
        refreshBackgroundAnalytics();
      })
      .finally(() => {
        liveBootstrapPromise = null;
      });

    await liveBootstrapPromise;
  }

  async function withRouteTimeout<T>(route: '/status' | '/v1/pulse' | '/v1/providers' | '/v1/pulse/summary', timeoutMs: number, work: () => T | Promise<T>, fallback: () => T): Promise<T> {
    const startedAtMs = Date.now();
    console.log(JSON.stringify({ event: 'route_timing_start', route, started_at: new Date(startedAtMs).toISOString() }));
    try {
      const result = await withTimeout(work, timeoutMs, 'route_timeout');
      console.log(JSON.stringify({ event: 'route_timing_end', route, duration_ms: Date.now() - startedAtMs, timed_out: false }));
      return result;
    } catch {
      console.log(JSON.stringify({ event: 'route_timing_end', route, duration_ms: Date.now() - startedAtMs, timed_out: true }));
      return fallback();
    }
  }
}

async function withTimeout<T>(work: () => T | Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(reason));
    }, timeoutMs);

    Promise.resolve()
      .then(work)
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

function logRadarRouteTiming(route: '/v1/radar/benchmark-summary' | '/v1/radar/benchmarks' | '/v1/radar/endpoints' | '/v1/radar/risk/ecosystem' | '/v1/radar/history/ecosystem', durationMs: number, cacheHit: boolean, status: 'ok' | 'stale_ok' | 'warming_up') {
  console.log(JSON.stringify({ event: 'radar_route_timing', route, duration_ms: durationMs, cache_hit: cacheHit, status }));
}

function contentTypeFor(path: string) {
  const ext = extname(path).toLowerCase();
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

function isAdmin(adminToken: string | null, authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return Boolean(adminToken && match?.[1] === adminToken);
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return String(error ?? '');
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : String(message ?? '');
}

function classifyBootstrapFailure(error: unknown): string {
  const code = errorCode(error);
  if (code === 'ECONNREFUSED') return 'db_connection_refused';
  const message = errorMessage(error).toLowerCase();
  if (message.includes('connection terminated unexpectedly')) return 'db_connection_terminated';
  if (message.includes('timeout')) return 'db_timeout';
  if (message.includes('pool') || message.includes('closed')) return 'db_pool_closed';
  return 'db_unavailable';
}

function logDbDegraded(stage: string, reason: string, error: unknown) {
  console.log(JSON.stringify({
    event: 'db_degraded',
    stage,
    reason,
    code: errorCode(error),
    message: errorMessage(error)
  }));
}

function monitorRunResponse(run: NonNullable<IntelligenceStore['monitorRuns']>[number]) {
  const mode = run.mode ?? (run.source.includes('safe-metadata') ? 'safe_metadata' : 'endpoint_health');
  const degradedCount = run.degradedCount ?? 0;
  const reachableCount = run.reachableCount ?? Math.max(0, run.successCount - degradedCount);
  return {
    ...run,
    mode,
    checked_count: run.checkedCount,
    reachable_count: reachableCount,
    degraded_count: degradedCount,
    failed_count: run.failedCount,
    skipped_count: run.skippedCount,
    started_at: run.startedAt,
    finished_at: run.finishedAt
  };
}

function buildPulseDashboard(store: IntelligenceStore, interpretations: unknown[], bootstrapped: boolean, generatedAt = new Date().toISOString()) {
  const knownTrust = store.trustAssessments.map((item) => item.score).filter((score): score is number => score !== null);
  const knownSignal = store.signalAssessments.map((item) => item.score).filter((score): score is number => score !== null);
  const dataSource = dataSourceState(store, generatedAt);
  const endpointCount = safeStoreEndpointCount(store);
  const endpointMetadata = endpointMetadataState(store);
  const effectiveBootstrapped = bootstrapped || store.providers.length > 0;
  return {
    providerCount: store.providers.length,
    endpointCount,
    eventCount: store.events.length,
    averageTrust: avg(knownTrust),
    averageSignal: avg(knownSignal),
    hottestNarrative: summarizeNarrative(store.narratives[0] ?? null),
    topTrust: [...store.trustAssessments].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5).map((item) => summarizeAssessment(item)),
    topSignal: [...store.signalAssessments].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5).map((item) => summarizeAssessment(item)),
    unknownTelemetry: {
      uptime: store.trustAssessments.filter((item) => item.components.uptime === null).length,
      latency: store.trustAssessments.filter((item) => item.components.latency === null).length,
      responseValidity: store.trustAssessments.filter((item) => item.components.responseValidity === null).length,
      receiptReliability: store.trustAssessments.filter((item) => item.components.receiptReliability === null).length,
      socialVelocity: store.signalAssessments.filter((item) => item.components.socialVelocity === null).length,
      onchainLiquidityResonance: store.signalAssessments.filter((item) => item.components.onchainLiquidityResonance === null).length
    },
    interpretations: compactInterpretationsSummary(interpretations as ReturnType<typeof pulseSummary>['interpretations']),
    data_source: dataSource,
    catalog_status: pulseCatalogStatusFromDataSource(dataSource, store.providers.length, effectiveBootstrapped),
    catalog_error: sanitizeCatalogError(dataSource.error ?? null),
    endpoint_metadata: endpointMetadata,
    updatedAt: generatedAt,
    bootstrapped: effectiveBootstrapped
  };
}

function compactPulseSummaryPayload(summary: ReturnType<typeof pulseSummary>) {
  return {
    ...summary,
    propagation: compactPropagationSummary(summary.propagation),
    interpretations: compactInterpretationsSummary(summary.interpretations)
  };
}

function compactPropagationSummary(propagation: ReturnType<typeof pulseSummary>['propagation']) {
  const supporting_event_count = propagation.supporting_event_ids.length;
  const supporting_event_ids = propagation.supporting_event_ids.slice(0, MAX_INLINE_SUPPORTING_EVENT_IDS);
  return {
    ...propagation,
    supporting_event_ids,
    supporting_event_count,
    remaining_event_count: Math.max(0, supporting_event_count - supporting_event_ids.length),
    view_full_receipts_url: `/propagation/${encodeURIComponent(propagation.cluster_id)}`
  };
}

function compactInterpretationsSummary(interpretations: ReturnType<typeof pulseSummary>['interpretations']) {
  return interpretations.map((item) => {
    const supporting_event_count = item.supporting_event_ids.length;
    const supporting_event_ids = item.supporting_event_ids.slice(0, MAX_INLINE_SUPPORTING_EVENT_IDS);
    return {
      ...item,
      supporting_event_ids,
      supporting_event_count,
      remaining_event_count: Math.max(0, supporting_event_count - supporting_event_ids.length),
      view_full_receipts_url: `/interpretations/${encodeURIComponent(item.interpretation_id)}`
    };
  });
}

function pulseDashboardResponse(cachedPulseDashboard: ReturnType<typeof buildPulseDashboard> | null, store: IntelligenceStore) {
  if (cachedPulseDashboard) return cachedPulseDashboard;
  return pulseWarmingUpFallback(store, false, 'pulse_cache_missing');
}

function pulseWarmingUpFallback(store: IntelligenceStore, bootstrapped: boolean, error: string) {
  const dataSource = dataSourceState(store);
  const endpointCount = safeStoreEndpointCount(store);
  const endpointMetadata = endpointMetadataState(store);
  const effectiveBootstrapped = bootstrapped || store.providers.length > 0;
  const status = pulseCatalogStatusFromDataSource(dataSource, store.providers.length, effectiveBootstrapped);
  const catalogError = dataSource.mode === 'live_pay_sh_catalog' ? null : sanitizeCatalogError(error);
  return {
    providerCount: store.providers.length,
    endpointCount,
    eventCount: store.events.length,
    averageTrust: null,
    averageSignal: null,
    hottestNarrative: null,
    topTrust: [],
    topSignal: [],
    unknownTelemetry: {
      uptime: 0,
      latency: 0,
      responseValidity: 0,
      receiptReliability: 0,
      socialVelocity: 0,
      onchainLiquidityResonance: 0
    },
    interpretations: [],
    data_source: dataSource,
    catalog_status: status,
    catalog_error: catalogError,
    endpoint_metadata: endpointMetadata,
    updatedAt: new Date().toISOString(),
    bootstrapped: effectiveBootstrapped,
    warming_up: status === 'warming_up'
  };
}

function summarizeNarrative(item: IntelligenceStore['narratives'][number] | null) {
  if (!item) return null;
  return {
    id: item.id,
    title: item.title,
    heat: item.heat ?? null,
    momentum: item.momentum ?? null,
    providerIds: [],
    keywords: [],
    summary: item.summary
  };
}

function summarizeAssessment(item: IntelligenceStore['trustAssessments'][number] | IntelligenceStore['signalAssessments'][number]) {
  const evidenceEventIds = Object.values(item.evidence).flat().map((entry) => entry.eventId).slice(0, PULSE_CAPS.maxEvidenceIdsInline);
  return {
    entityId: item.entityId,
    score: item.score,
    grade: 'grade' in item ? item.grade : undefined,
    narratives: 'narratives' in item ? item.narratives.slice(0, 5) : undefined,
    evidenceEventIds
  };
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function lightweightProviders(store: IntelligenceStore, maxItems: number) {
  const trustByProvider = latestAssessmentsByProvider(store.trustAssessments);
  const signalByProvider = latestAssessmentsByProvider(store.signalAssessments);
  const endpointCountZero = safeStoreEndpointCount(store) === 0;
  return store.providers.slice(0, maxItems).map((provider) => {
    const trust = trustByProvider.get(provider.id) ?? null;
    const signal = signalByProvider.get(provider.id) ?? null;
    const severity = classifyProviderDossierSeverity(provider, trust, signal, store.events);
    return {
      id: provider.id,
      provider_id: provider.id,
      fqn: provider.fqn ?? provider.namespace ?? null,
      name: provider.name,
      category: provider.category,
      observed_at: provider.observed_at ?? provider.observedAt ?? provider.lastSeenAt ?? null,
      ingested_at: provider.ingested_at ?? provider.ingestedAt ?? provider.lastSeenAt ?? null,
      catalog_generated_at: provider.catalog_generated_at ?? provider.catalogGeneratedAt ?? null,
      trust: {
        score: trust?.score ?? null,
        grade: trust?.grade ?? 'unknown'
      },
      signal: {
        score: signal?.score ?? null
      },
      severity: severity.severity,
      risk: severity.severity_reason,
      endpointCount: safeProviderEndpointCount(provider),
      endpointMetadata: {
        available: endpointCountZero ? false : !provider.endpointMetadataPartial,
        reason: endpointCountZero ? 'endpoint_count_zero_or_missing' : provider.endpointMetadataPartial ? 'partial_from_live_catalog' : null
      }
    };
  });
}

function latestAssessmentsByProvider<T extends { entityId: string; assessedAt: string }>(items: T[]) {
  const byProvider = new Map<string, T>();
  for (const item of items) {
    const existing = byProvider.get(item.entityId);
    if (!existing || Date.parse(item.assessedAt) > Date.parse(existing.assessedAt)) byProvider.set(item.entityId, item);
  }
  return byProvider;
}

function safeProviderEndpointCount(provider: IntelligenceStore['providers'][number]) {
  return typeof provider.endpointCount === 'number' && Number.isFinite(provider.endpointCount) ? Math.max(0, provider.endpointCount) : 0;
}

function safeStoreEndpointCount(store: IntelligenceStore) {
  return store.providers.reduce((sum, provider) => sum + safeProviderEndpointCount(provider), 0);
}

function copyStoreInto(target: IntelligenceStore, source: IntelligenceStore) {
  target.events = source.events;
  target.providers = source.providers;
  target.endpoints = source.endpoints;
  target.trustAssessments = source.trustAssessments;
  target.signalAssessments = source.signalAssessments;
  target.narratives = source.narratives;
  target.ingestionRuns = source.ingestionRuns;
  target.monitorRuns = source.monitorRuns;
  target.dataSource = source.dataSource;
}

function logTiming(stage: string, startedAtMs: number) {
  console.log(JSON.stringify({ event: 'timing', stage, duration_ms: Date.now() - startedAtMs }));
}

function catalogStatusFromDataSource(dataSource: IntelligenceStore['dataSource']) {
  if (!dataSource) return 'warming_up';
  if (dataSource.mode === 'live_pay_sh_catalog' && dataSource.error) return 'live_fetch_failed';
  if (dataSource.mode === 'live_pay_sh_catalog') return 'live_ok';
  if (dataSource.used_fixture) return 'fixture_fallback';
  return 'unknown';
}

function pulseCatalogStatusFromDataSource(dataSource: ReturnType<typeof dataSourceState>, providerCount: number, bootstrapped: boolean) {
  if (dataSource.mode === 'live_pay_sh_catalog' && !dataSource.error) return 'live';
  if (providerCount > 0) return 'ready';
  if (dataSource.mode === 'live_pay_sh_catalog' && dataSource.error) return 'live_fetch_failed';
  if (dataSource.used_fixture) return 'fixture_fallback';
  return bootstrapped ? 'ready' : 'warming_up';
}

function endpointMetadataState(store: IntelligenceStore) {
  if (store.endpoints.length > 0) {
    return {
      available: true,
      mode: 'full',
      reason: null
    };
  }
  if (store.providers.length > 0) {
    return {
      available: false,
      mode: 'provider_level_counts_only',
      reason: 'live_pay_sh_catalog_does_not_include_endpoint_detail'
    };
  }
  return {
    available: false,
    mode: 'unavailable',
    reason: 'endpoint_count_zero_or_missing'
  };
}

function isLiveBootstrapSatisfied(store: IntelligenceStore) {
  return store.providers.length > 0
    && store.dataSource?.mode === 'live_pay_sh_catalog'
    && store.dataSource?.used_fixture === false;
}

function sanitizeCatalogError(value: string | null) {
  if (!value) return null;
  return value.slice(0, 240);
}

function handleParsed<T>(body: unknown, schema: z.ZodSchema<T>, next: (input: T) => unknown, reply: FastifyReply) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
  return next(parsed.data);
}

function graphNodes(store: IntelligenceStore) {
  return [
    ...store.providers.map((provider) => ({ id: provider.id, type: 'provider', label: provider.name, category: provider.category, provider_id: provider.id, observed_at: provider.lastSeenAt, catalog_generated_at: provider.catalogGeneratedAt ?? null, ingested_at: provider.ingestedAt ?? provider.lastSeenAt, source: provider.source, derivation_reason: 'Graph provider node is derived from provider catalog membership.', confidence: provider.confidence ?? 1, ...classifyProviderDossierSeverity(provider, store.trustAssessments.find((item) => item.entityId === provider.id) ?? null, store.signalAssessments.find((item) => item.entityId === provider.id) ?? null, store.events), evidence: provider.evidence[0] ?? null })),
    ...store.narratives.map((narrative) => ({ id: narrative.id, type: 'narrative', label: narrative.title, heat: narrative.heat, provider_id: null, endpoint_id: null, observed_at: narrative.evidence[0]?.observedAt ?? null, catalog_generated_at: narrative.evidence[0]?.catalogGeneratedAt ?? null, ingested_at: narrative.evidence[0]?.ingestedAt ?? null, source: narrative.evidence[0]?.source ?? 'infopunks:deterministic-scoring', derivation_reason: 'Graph narrative node is derived from deterministic narrative clustering.', confidence: narrative.evidence.length ? 1 : 0.5, ...classifyNarrativeClusterSeverity(narrative), evidence: narrative.evidence[0] ?? null })),
    ...Array.from(new Set(store.providers.map((provider) => provider.category))).map((category) => ({ id: `category-${category}`, type: 'category', label: category, provider_id: null, endpoint_id: null, observed_at: latestProviderTimestamp(store, category), catalog_generated_at: latestCatalogGeneratedAt(store, category), ingested_at: latestProviderTimestamp(store, category), source: 'pay.sh', derivation_reason: 'Graph category node is derived from provider catalog categories.', confidence: 1, ...classifyGraphSeverity('category') }))
  ];
}

function graphEdges(store: IntelligenceStore) {
  return [
    ...store.providers.map((provider) => ({ source: provider.id, target: `category-${provider.category}`, type: 'listed_in', provider_id: provider.id, endpoint_id: null, observed_at: provider.lastSeenAt, catalog_generated_at: provider.catalogGeneratedAt ?? null, ingested_at: provider.ingestedAt ?? provider.lastSeenAt, derivation_reason: 'Graph edge is derived from provider category metadata.', confidence: provider.confidence ?? 1, ...classifyGraphSeverity('edge'), evidenceCount: provider.evidence.length, evidence: provider.evidence[0] ?? null })),
    ...store.narratives.flatMap((narrative) => narrative.providerIds.map((providerId) => ({ source: narrative.id, target: providerId, type: 'contains', provider_id: providerId, endpoint_id: null, observed_at: narrative.evidence[0]?.observedAt ?? null, catalog_generated_at: narrative.evidence[0]?.catalogGeneratedAt ?? null, ingested_at: narrative.evidence[0]?.ingestedAt ?? null, derivation_reason: 'Graph edge is derived from narrative keyword membership.', confidence: narrative.evidence.length ? 1 : 0.5, ...classifyNarrativeClusterSeverity(narrative), evidenceCount: narrative.evidence.length, evidence: narrative.evidence[0] ?? null })))
  ];
}

function graphReceipt(store: IntelligenceStore) {
  const latestEvent = [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0] ?? null;
  return {
    event_id: latestEvent?.id ?? null,
    provider_id: null,
    endpoint_id: null,
    observed_at: latestEvent?.observedAt ?? null,
    catalog_generated_at: store.dataSource?.generated_at ?? null,
    ingested_at: store.dataSource?.last_ingested_at ?? null,
    source: store.dataSource?.mode ?? 'fixture_fallback',
    derivation_reason: 'Graph layer is built deterministically from provider, category, and narrative records.',
    confidence: store.events.length ? 1 : 0.5,
    ...classifyGraphSeverity('graph')
  };
}

function latestProviderTimestamp(store: IntelligenceStore, category: string) {
  return store.providers.filter((provider) => provider.category === category).map((provider) => provider.lastSeenAt).sort().reverse()[0] ?? null;
}

function latestCatalogGeneratedAt(store: IntelligenceStore, category: string) {
  return store.providers.filter((provider) => provider.category === category).map((provider) => provider.catalogGeneratedAt).filter((value): value is string => Boolean(value)).sort().reverse()[0] ?? null;
}

function summarizeEvent(event: IntelligenceStore['events'][number]) {
  if (event.type === 'provider.checked') return providerReachabilitySummary(event);
  if (event.type === 'provider.reachable') return providerRootHealthSummary(event, 'healthy');
  if (event.type === 'provider.degraded') return providerRootHealthSummary(event, 'degraded');
  if (event.type === 'provider.failed') return providerRootHealthSummary(event, 'failed');
  if (event.type === 'provider.recovered') return providerRootHealthSummary(event, 'recovered');
  return typeof event.payload.summary === 'string' ? event.payload.summary : `${event.type} observed.`;
}

function renderInterpretationPage(req: FastifyRequest, interpretation: ReturnType<typeof pulseSummary>['interpretations'][number], summary: ReturnType<typeof pulseSummary>) {
  const title = `${interpretation.interpretation_title} | Infopunks Pay.sh Radar`;
  const description = interpretation.interpretation_summary;
  const url = absoluteUrl(req, `/interpretations/${interpretation.interpretation_id}`);
  const dataSourceLabel = summary.data_source.mode === 'live_pay_sh_catalog' ? 'live_pay_sh_catalog' : 'fixture_fallback';
  const propagationRelevant = isPropagationRelevant(interpretation, summary.propagation);
  const whyThisMatters = whyThisMattersSummary(interpretation);
  const receiptLinks = interpretation.supporting_event_ids.map((eventId) => ({ eventId, href: `/v1/events/${eventId}` }));
  const receiptSource = interpretation.evidence?.source ?? 'infopunks:interpretation-layer';
  const methodologyHref = '/#methodology';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #101418; }
    main { max-width: 860px; margin: 2.5rem auto; padding: 0 1rem; }
    .card { background: #fff; border: 1px solid #dde3ea; border-radius: 14px; padding: 1rem 1.2rem; margin-top: 1rem; }
    .meta { color: #3e4c59; font-size: 0.95rem; }
    .pill { display: inline-block; margin-right: 0.5rem; border-radius: 999px; padding: 0.15rem 0.55rem; border: 1px solid #c6d2df; font-size: 0.8rem; background: #f0f5fa; }
    ul { margin: 0.45rem 0 0 1.2rem; }
    h1, h2 { margin: 0; }
    h2 { font-size: 1.05rem; margin-bottom: 0.35rem; }
    button { border: 1px solid #c6d2df; background: #fff; border-radius: 8px; padding: 0.45rem 0.7rem; cursor: pointer; }
    a { color: #0043aa; }
  </style>
</head>
<body>
  <main>
    <p class="meta">Public Interpretation Artifact</p>
    <h1>${escapeHtml(interpretation.interpretation_title)}</h1>
    <p>${escapeHtml(interpretation.interpretation_summary)}</p>
    <div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.8rem;">
      <span class="pill">severity: ${escapeHtml(interpretation.severity)}</span>
      <span class="pill">confidence: ${escapeHtml(String(interpretation.confidence))}</span>
      <span class="pill">window: ${escapeHtml(interpretation.observed_window.started_at ?? 'n/a')} to ${escapeHtml(interpretation.observed_window.ended_at ?? 'n/a')}</span>
    </div>
    <button id="copy-share-url" type="button">Copy/Share URL</button>
    <span id="copy-state" class="meta" style="margin-left:0.5rem;"></span>

    <section class="card">
      <h2>Why this matters</h2>
      <p>${escapeHtml(whyThisMatters)}</p>
    </section>

    <section class="card">
      <h2>Evidence and Context</h2>
      <p><strong>Reason:</strong> ${escapeHtml(interpretation.interpretation_reason)}</p>
      <p><strong>Affected categories:</strong> ${interpretation.affected_categories.length ? interpretation.affected_categories.map(escapeHtml).join(', ') : 'none detected'}</p>
      <p><strong>Affected providers:</strong> ${interpretation.affected_providers.length ? interpretation.affected_providers.map(escapeHtml).join(', ') : 'none detected'}</p>
      <p><strong>Supporting event IDs:</strong> ${interpretation.supporting_event_ids.length ? interpretation.supporting_event_ids.map(escapeHtml).join(', ') : 'none'}</p>
      <p><strong>Supporting receipt links:</strong></p>
      <ul>
        ${receiptLinks.length
    ? receiptLinks.map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.eventId)}</a></li>`).join('')
    : '<li>none</li>'}
      </ul>
      <p><strong>Evidence source:</strong> ${escapeHtml(receiptSource)}</p>
      ${propagationRelevant
    ? `<p><strong>Propagation context:</strong> ${escapeHtml(summary.propagation.propagation_state)} (${escapeHtml(summary.propagation.severity)}). ${escapeHtml(summary.propagation.propagation_reason)}</p>`
    : ''}
      <p><a href="${escapeHtml(methodologyHref)}">Methodology</a></p>
      <p class="meta"><strong>Data source:</strong> ${escapeHtml(dataSourceLabel)} | <strong>Last updated:</strong> ${escapeHtml(summary.generatedAt)}</p>
    </section>
  </main>
  <script>
    (function () {
      var button = document.getElementById('copy-share-url');
      var state = document.getElementById('copy-state');
      if (!button) return;
      button.addEventListener('click', function () {
        var shareUrl = window.location.href;
        var done = function (ok) { if (state) state.textContent = ok ? 'Copied.' : 'Copy failed.'; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () { done(true); }).catch(function () { done(false); });
        } else {
          done(false);
        }
      });
    })();
  </script>
</body>
</html>`;
}

function renderInterpretationNotFoundPage(req: FastifyRequest, interpretationId: string, generatedAt: string) {
  const title = 'Interpretation Not Found | Infopunks Pay.sh Radar';
  const description = `No interpretation exists for id ${interpretationId}.`;
  const url = absoluteUrl(req, `/interpretations/${interpretationId}`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2rem;">
  <h1>Interpretation Not Found</h1>
  <p>No deterministic interpretation exists for <code>${escapeHtml(interpretationId)}</code>.</p>
  <p>Last checked: ${escapeHtml(generatedAt)}</p>
</body>
</html>`;
}

function whyThisMattersSummary(interpretation: ReturnType<typeof pulseSummary>['interpretations'][number]) {
  if (interpretation.severity === 'critical' || interpretation.severity === 'warning') return 'Operational risk is elevated across observed providers, so route selection and trust assumptions may need immediate review.';
  if (interpretation.severity === 'watch') return 'This pattern indicates meaningful movement that could expand, so teams should monitor for spread or recurrence before treating conditions as normal.';
  if (interpretation.severity === 'info') return 'The pattern is informative for prioritization and category focus, but it does not currently indicate broad reliability degradation.';
  return 'Current evidence indicates no broad ecosystem degradation pattern above deterministic thresholds.';
}

function isPropagationRelevant(interpretation: ReturnType<typeof pulseSummary>['interpretations'][number], propagation: ReturnType<typeof pulseSummary>['propagation']) {
  if (propagation.propagation_state === 'unknown') return false;
  if (interpretation.supporting_event_ids.some((id) => propagation.supporting_event_ids.includes(id))) return true;
  const affected = new Set(interpretation.affected_providers);
  return propagation.affected_providers.some((provider) => affected.has(provider.provider_id));
}

function absoluteUrl(req: FastifyRequest, pathname: string) {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost';
  const protocol = req.headers['x-forwarded-proto'] ?? 'http';
  return `${protocol}://${host}${pathname}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
