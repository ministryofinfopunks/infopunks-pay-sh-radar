import cors from '@fastify/cors';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { z } from 'zod';
import { createIntelligenceStore, defaultRepository, emptyIntelligenceStore, IntelligenceStore, runPayShIngestion } from '../services/intelligenceStore';
import { IntelligenceRepository } from '../persistence/repository';
import { recommendRoute } from '../services/routeService';
import { semanticSearch } from '../services/searchService';
import { RouteRecommendationRequestSchema, SearchRequestSchema } from '../schemas/entities';
import { endpointHistory, findEndpoint, findProvider, providerHistory, providerIntelligence } from '../services/providerIntelligenceService';
import { endpointMonitorSummary, isMonitorEnabled, monitorIntervalMs, monitorMaxProviders, monitorTimeoutMs, providerMonitorSummary, runMonitor } from '../services/endpointMonitorService';
import { loadRuntimeConfig } from '../config/env';
import { dataSourceState, PULSE_CAPS, pulseSummary } from '../services/pulseService';
import { featuredProviderRotation } from '../services/featuredProviderService';
import { classifyEventSeverity, classifyGraphSeverity, classifyNarrativeClusterSeverity, classifyProviderDossierSeverity } from '../engines/severityEngine';
import { analyzePropagation } from '../services/propagationService';
import { resolvePropagationIncident } from '../services/propagationIncidentService';
import { providerReachabilitySummary, providerRootHealthSummary } from '../services/eventSummaryHelpers';

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
  const PROVIDER_LIST_MAX = 100;
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
  let bootstrapped = Boolean(preloadedStore);
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
    void createIntelligenceStore(repository)
      .then((loadedStore) => {
        copyStoreInto(store, loadedStore);
        bootstrapped = true;
        logTiming('database_connect', bootstrapStartMs);
        logTiming('catalog_load', bootstrapStartMs);
        refreshBackgroundAnalytics();
      })
      .catch(() => undefined);
  } else {
    refreshBackgroundAnalytics();
  }

  app.get('/health', async () => ({
    ok: true,
    service: 'infopunks-pay-sh-radar',
    role: 'Cognitive Coordination Layer above Pay.sh',
    persistence: config.databaseUrl ? 'postgres' : 'memory',
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: store.endpoints.length
  }));
  app.get('/status', async () => withRouteTimeout('/status', ROUTE_TIMEOUT_MS, () => ({
    ok: true,
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    dbMode: config.databaseUrl ? 'postgres' : 'memory',
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: safeStoreEndpointCount(store),
    catalog_status: catalogStatusFromDataSource(store.dataSource)
  }), () => ({
    ok: true,
    catalogSource: config.payShCatalogSource,
    ingestionEnabled: config.ingestionEnabled,
    dbMode: config.databaseUrl ? 'postgres' : 'memory',
    lastIngestedAt: store.dataSource?.last_ingested_at ?? null,
    providerCount: store.providers.length,
    endpointCount: safeStoreEndpointCount(store),
    catalog_status: 'warming_up'
  })));
  app.get('/version', async () => ({ service: 'infopunks-pay-sh-radar', version: config.version }));
  app.get('/v1/pulse', async () => withRouteTimeout('/v1/pulse', ROUTE_TIMEOUT_MS, () => ({
    data: pulseDashboardResponse(cachedPulseDashboard, store)
  }), () => ({
    data: pulseWarmingUpFallback(store, bootstrapped, 'pulse_timeout')
  })));
  app.get('/v1/pulse/summary', async () => withRouteTimeout('/v1/pulse/summary', ROUTE_TIMEOUT_MS, () => {
    const summary = pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations });
    return { data: compactPulseSummaryPayload(summary) };
  }, () => ({
    data: compactPulseSummaryPayload(pulseSummary(store, new Date().toISOString(), config.payShIngestIntervalMs, { includePropagation: false, includeInterpretations: false, propagationFallback: cachedPropagation, interpretationsFallback: cachedInterpretations }))
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
  app.get('/v1/providers', async () => withRouteTimeout('/v1/providers', ROUTE_TIMEOUT_MS, () => ({
    data: lightweightProviders(store, PROVIDER_LIST_MAX)
  }), () => ({
    data: lightweightProviders(store, 25)
  })));
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
      if (urlPath.startsWith('/v1/') || urlPath === '/health' || urlPath === '/version') {
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
      void runPayShIngestion(store, repository).then(() => refreshBackgroundAnalytics()).catch(() => undefined);
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
      void runMonitor(store, repository, { timeoutMs: monitorTimeoutMs(), maxProviders: monitorMaxProviders() }).then(() => refreshBackgroundAnalytics()).catch(() => undefined);
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
  const endpointCount = safeStoreEndpointCount(store);
  const endpointMetadataAvailable = endpointCount > 0;
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
    data_source: dataSourceState(store),
    catalog_status: catalogStatusFromDataSource(store.dataSource),
    catalog_error: sanitizeCatalogError(store.dataSource?.error ?? null),
    endpoint_metadata: {
      available: endpointMetadataAvailable,
      mode: endpointMetadataAvailable ? 'full' : 'unavailable',
      reason: endpointMetadataAvailable ? null : 'endpoint_count_zero_or_missing'
    },
    updatedAt: generatedAt,
    bootstrapped
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
  const endpointCount = safeStoreEndpointCount(store);
  return {
    providerCount: store.providers.length,
    endpointCount,
    eventCount: store.events.length,
    averageTrust: null,
    averageSignal: null,
    hottestNarrative: null,
    topTrust: [],
    topSignal: [],
    unknownTelemetry: {},
    interpretations: [],
    data_source: dataSourceState(store),
    catalog_status: 'warming_up',
    catalog_error: sanitizeCatalogError(error),
    endpoint_metadata: {
      available: endpointCount > 0,
      mode: endpointCount > 0 ? 'full' : 'unavailable',
      reason: endpointCount > 0 ? null : 'endpoint_count_zero_or_missing'
    },
    updatedAt: new Date().toISOString(),
    bootstrapped,
    warming_up: true
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
