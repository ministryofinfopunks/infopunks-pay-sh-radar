import cors from '@fastify/cors';
import Fastify, { FastifyReply } from 'fastify';
import { z } from 'zod';
import { createIntelligenceStore, defaultRepository, IntelligenceStore, runPayShIngestion } from '../services/intelligenceStore';
import { IntelligenceRepository } from '../persistence/repository';
import { recommendRoute } from '../services/routeService';
import { semanticSearch } from '../services/searchService';
import { RouteRecommendationRequestSchema, SearchRequestSchema } from '../schemas/entities';
import { endpointHistory, findEndpoint, findProvider, providerHistory, providerIntelligence } from '../services/providerIntelligenceService';
import { endpointMonitorSummary, isMonitorEnabled, monitorIntervalMs, monitorTimeoutMs, runEndpointMonitor } from '../services/endpointMonitorService';
import { loadRuntimeConfig } from '../config/env';
import { dataSourceState, pulseSummary } from '../services/pulseService';

const IngestRequestSchema = z.object({ catalogUrl: z.string().url().optional() }).optional();

export async function createApp(preloadedStore?: IntelligenceStore, repository: IntelligenceRepository = defaultRepository()) {
  const config = loadRuntimeConfig();
  const app = Fastify({ logger: false });
  await app.register(cors, {
    origin: config.frontendOrigin
      ? (origin, callback) => callback(null, !origin || origin === config.frontendOrigin)
      : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
    preflight: true
  });
  const store = preloadedStore ?? await createIntelligenceStore(repository);

  app.get('/health', async () => ({ ok: true, service: 'infopunks-pay-sh-radar', role: 'Cognitive Coordination Layer above Pay.sh', persistence: config.databaseUrl ? 'postgres' : 'memory' }));
  app.get('/version', async () => ({ service: 'infopunks-pay-sh-radar', version: config.version }));
  app.get('/v1/pulse', async () => ({ data: pulse(store) }));
  app.get('/v1/pulse/summary', async () => ({ data: pulseSummary(store) }));
  app.get('/v1/events/recent', async () => ({ data: [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0, 100) }));
  app.get('/v1/providers', async () => ({ data: store.providers.map((provider) => {
    const trust = latestByAssessedAt(store.trustAssessments.filter((item) => item.entityId === provider.id));
    const signal = latestByAssessedAt(store.signalAssessments.filter((item) => item.entityId === provider.id));
    return {
      ...provider,
      latestTrustScore: trust?.score ?? null,
      latestTrustGrade: trust?.grade ?? 'unknown',
      latestSignalScore: signal?.score ?? null
    };
  }) }));
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
  app.get('/v1/monitor/runs/recent', async () => ({ data: [...(store.monitorRuns ?? [])].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 20) }));
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
  app.post('/v1/search', async (req, reply) => handleParsed(req.body, SearchRequestSchema, (input) => ({ data: semanticSearch(input, store) }), reply));
  app.post('/v1/recommend-route', async (req, reply) => handleParsed(req.body, RouteRecommendationRequestSchema, (input) => ({ data: recommendRoute(input, store) }), reply));
  app.post('/v1/ingest/pay-sh', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization, req.headers['x-infopunks-admin-token'])) return reply.code(401).send({ error: 'admin_token_required' });
    return handleParsed(req.body, IngestRequestSchema, async (input) => {
      const result = await runPayShIngestion(store, repository, input?.catalogUrl);
      return { data: { run: result.run, emittedEvents: result.events.length, usedFixture: result.usedFixture } };
    }, reply);
  });
  app.post('/v1/monitor/run', async (req, reply) => {
    if (!isAdmin(config.adminToken, req.headers.authorization, req.headers['x-infopunks-admin-token'])) return reply.code(401).send({ error: 'admin_token_required' });
    const result = await runEndpointMonitor(store, repository, { timeoutMs: monitorTimeoutMs() });
    return { data: { run: result.run, emittedEvents: result.events.length } };
  });
  app.get('/v1/graph', async () => ({ data: { nodes: graphNodes(store), edges: graphEdges(store) } }));

  const intervalMs = config.payShIngestIntervalMs ?? 0;
  if (intervalMs > 0) {
    const timer = setInterval(() => {
      void runPayShIngestion(store, repository).catch(() => undefined);
    }, intervalMs);
    timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }
  if (isMonitorEnabled() && monitorIntervalMs() > 0) {
    const timer = setInterval(() => {
      void runEndpointMonitor(store, repository, { timeoutMs: monitorTimeoutMs() }).catch(() => undefined);
    }, monitorIntervalMs());
    timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }

  return app;
}

function isAdmin(adminToken: string | null, authorization: string | undefined, headerToken: string | string[] | undefined) {
  const token = authorization?.replace(/^Bearer\s+/i, '') ?? (Array.isArray(headerToken) ? headerToken[0] : headerToken);
  return Boolean(adminToken && token === adminToken);
}

function pulse(store: IntelligenceStore) {
  const knownTrust = store.trustAssessments.map((item) => item.score).filter((score): score is number => score !== null);
  const knownSignal = store.signalAssessments.map((item) => item.score).filter((score): score is number => score !== null);
  return {
    providerCount: store.providers.length,
    endpointCount: store.providers.reduce((sum, provider) => sum + provider.endpointCount, 0),
    eventCount: store.events.length,
    averageTrust: avg(knownTrust),
    averageSignal: avg(knownSignal),
    hottestNarrative: store.narratives[0] ?? null,
    topTrust: [...store.trustAssessments].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5),
    topSignal: [...store.signalAssessments].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5),
    unknownTelemetry: {
      uptime: store.trustAssessments.filter((item) => item.components.uptime === null).length,
      latency: store.trustAssessments.filter((item) => item.components.latency === null).length,
      responseValidity: store.trustAssessments.filter((item) => item.components.responseValidity === null).length,
      receiptReliability: store.trustAssessments.filter((item) => item.components.receiptReliability === null).length,
      socialVelocity: store.signalAssessments.filter((item) => item.components.socialVelocity === null).length,
      onchainLiquidityResonance: store.signalAssessments.filter((item) => item.components.onchainLiquidityResonance === null).length
    },
    data_source: dataSourceState(store),
    updatedAt: new Date().toISOString()
  };
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function latestByAssessedAt<T extends { assessedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => Date.parse(b.assessedAt) - Date.parse(a.assessedAt))[0] ?? null;
}

function handleParsed<T>(body: unknown, schema: z.ZodSchema<T>, next: (input: T) => unknown, reply: FastifyReply) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
  return next(parsed.data);
}

function graphNodes(store: IntelligenceStore) {
  return [
    ...store.providers.map((provider) => ({ id: provider.id, type: 'provider', label: provider.name, category: provider.category })),
    ...store.narratives.map((narrative) => ({ id: narrative.id, type: 'narrative', label: narrative.title, heat: narrative.heat })),
    ...Array.from(new Set(store.providers.map((provider) => provider.category))).map((category) => ({ id: `category-${category}`, type: 'category', label: category }))
  ];
}

function graphEdges(store: IntelligenceStore) {
  return [
    ...store.providers.map((provider) => ({ source: provider.id, target: `category-${provider.category}`, type: 'listed_in', evidenceCount: provider.evidence.length })),
    ...store.narratives.flatMap((narrative) => narrative.providerIds.map((providerId) => ({ source: narrative.id, target: providerId, type: 'contains', evidenceCount: narrative.evidence.length })))
  ];
}
