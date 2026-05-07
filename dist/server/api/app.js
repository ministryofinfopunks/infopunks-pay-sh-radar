"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("@fastify/cors"));
const fastify_1 = __importDefault(require("fastify"));
const zod_1 = require("zod");
const intelligenceStore_1 = require("../services/intelligenceStore");
const routeService_1 = require("../services/routeService");
const searchService_1 = require("../services/searchService");
const entities_1 = require("../schemas/entities");
const providerIntelligenceService_1 = require("../services/providerIntelligenceService");
const endpointMonitorService_1 = require("../services/endpointMonitorService");
const env_1 = require("../config/env");
const IngestRequestSchema = zod_1.z.object({ catalogUrl: zod_1.z.string().url().optional() }).optional();
async function createApp(preloadedStore, repository = (0, intelligenceStore_1.defaultRepository)()) {
    const config = (0, env_1.loadRuntimeConfig)();
    const app = (0, fastify_1.default)({ logger: false });
    await app.register(cors_1.default, {
        origin: config.frontendOrigin
            ? (origin, callback) => callback(null, !origin || origin === config.frontendOrigin)
            : true
    });
    const store = preloadedStore ?? await (0, intelligenceStore_1.createIntelligenceStore)(repository);
    app.get('/health', async () => ({ ok: true, service: 'infopunks-pay-sh-radar', role: 'Cognitive Coordination Layer above Pay.sh', persistence: config.databaseUrl ? 'postgres' : 'memory' }));
    app.get('/version', async () => ({ service: 'infopunks-pay-sh-radar', version: config.version }));
    app.get('/v1/pulse', async () => ({ data: pulse(store) }));
    app.get('/v1/events/recent', async () => ({ data: [...store.events].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0, 100) }));
    app.get('/v1/providers', async () => ({ data: store.providers }));
    app.get('/v1/providers/:id', async (req, reply) => {
        const provider = (0, providerIntelligenceService_1.findProvider)(store, req.params.id);
        if (!provider)
            return reply.code(404).send({ error: 'provider_not_found' });
        return { data: { provider, endpoints: store.endpoints.filter((item) => item.providerId === provider.id), trustAssessment: store.trustAssessments.find((item) => item.entityId === provider.id), signalAssessment: store.signalAssessments.find((item) => item.entityId === provider.id) } };
    });
    app.get('/v1/providers/:id/history', async (req, reply) => {
        const provider = (0, providerIntelligenceService_1.findProvider)(store, req.params.id);
        if (!provider)
            return reply.code(404).send({ error: 'provider_not_found' });
        return { data: (0, providerIntelligenceService_1.providerHistory)(store, provider) };
    });
    app.get('/v1/providers/:id/intelligence', async (req, reply) => {
        const provider = (0, providerIntelligenceService_1.findProvider)(store, req.params.id);
        if (!provider)
            return reply.code(404).send({ error: 'provider_not_found' });
        return { data: (0, providerIntelligenceService_1.providerIntelligence)(store, provider) };
    });
    app.get('/v1/endpoints', async () => ({ data: store.endpoints }));
    app.get('/v1/monitor/runs/recent', async () => ({ data: [...(store.monitorRuns ?? [])].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 20) }));
    app.get('/v1/endpoints/:id/monitor', async (req, reply) => {
        const endpoint = (0, providerIntelligenceService_1.findEndpoint)(store, req.params.id);
        if (!endpoint)
            return reply.code(404).send({ error: 'endpoint_not_found' });
        return { data: (0, endpointMonitorService_1.endpointMonitorSummary)(store, endpoint) };
    });
    app.get('/v1/endpoints/:id/history', async (req, reply) => {
        const endpoint = (0, providerIntelligenceService_1.findEndpoint)(store, req.params.id);
        if (!endpoint)
            return reply.code(404).send({ error: 'endpoint_not_found' });
        return { data: (0, providerIntelligenceService_1.endpointHistory)(store, endpoint) };
    });
    app.get('/v1/trust/:entity_id', async (req, reply) => {
        const trust = store.trustAssessments.find((item) => item.entityId === req.params.entity_id);
        if (!trust)
            return reply.code(404).send({ error: 'trust_assessment_not_found' });
        return { data: trust };
    });
    app.get('/v1/signal/:entity_id', async (req, reply) => {
        const signal = store.signalAssessments.find((item) => item.entityId === req.params.entity_id);
        if (!signal)
            return reply.code(404).send({ error: 'signal_assessment_not_found' });
        return { data: signal };
    });
    app.get('/v1/narratives', async () => ({ data: store.narratives }));
    app.post('/v1/search', async (req, reply) => handleParsed(req.body, entities_1.SearchRequestSchema, (input) => ({ data: (0, searchService_1.semanticSearch)(input, store) }), reply));
    app.post('/v1/recommend-route', async (req, reply) => handleParsed(req.body, entities_1.RouteRecommendationRequestSchema, (input) => ({ data: (0, routeService_1.recommendRoute)(input, store) }), reply));
    app.post('/v1/ingest/pay-sh', async (req, reply) => {
        if (!isAdmin(config.adminToken, req.headers.authorization, req.headers['x-infopunks-admin-token']))
            return reply.code(401).send({ error: 'admin_token_required' });
        return handleParsed(req.body, IngestRequestSchema, async (input) => {
            const result = await (0, intelligenceStore_1.runPayShIngestion)(store, repository, input?.catalogUrl);
            return { data: { run: result.run, emittedEvents: result.events.length, usedFixture: result.usedFixture } };
        }, reply);
    });
    app.post('/v1/monitor/run', async (req, reply) => {
        if (!isAdmin(config.adminToken, req.headers.authorization, req.headers['x-infopunks-admin-token']))
            return reply.code(401).send({ error: 'admin_token_required' });
        const result = await (0, endpointMonitorService_1.runEndpointMonitor)(store, repository, { timeoutMs: (0, endpointMonitorService_1.monitorTimeoutMs)() });
        return { data: { run: result.run, emittedEvents: result.events.length } };
    });
    app.get('/v1/graph', async () => ({ data: { nodes: graphNodes(store), edges: graphEdges(store) } }));
    const intervalMs = config.payShIngestIntervalMs ?? 0;
    if (intervalMs > 0) {
        const timer = setInterval(() => {
            void (0, intelligenceStore_1.runPayShIngestion)(store, repository).catch(() => undefined);
        }, intervalMs);
        timer.unref();
        app.addHook('onClose', async () => clearInterval(timer));
    }
    if ((0, endpointMonitorService_1.isMonitorEnabled)() && (0, endpointMonitorService_1.monitorIntervalMs)() > 0) {
        const timer = setInterval(() => {
            void (0, endpointMonitorService_1.runEndpointMonitor)(store, repository, { timeoutMs: (0, endpointMonitorService_1.monitorTimeoutMs)() }).catch(() => undefined);
        }, (0, endpointMonitorService_1.monitorIntervalMs)());
        timer.unref();
        app.addHook('onClose', async () => clearInterval(timer));
    }
    return app;
}
function isAdmin(adminToken, authorization, headerToken) {
    const token = authorization?.replace(/^Bearer\s+/i, '') ?? (Array.isArray(headerToken) ? headerToken[0] : headerToken);
    return Boolean(adminToken && token === adminToken);
}
function pulse(store) {
    const knownTrust = store.trustAssessments.map((item) => item.score).filter((score) => score !== null);
    const knownSignal = store.signalAssessments.map((item) => item.score).filter((score) => score !== null);
    return {
        providerCount: store.providers.length,
        endpointCount: store.endpoints.length,
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
        updatedAt: new Date().toISOString()
    };
}
function avg(values) {
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}
function handleParsed(body, schema, next, reply) {
    const parsed = schema.safeParse(body);
    if (!parsed.success)
        return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
    return next(parsed.data);
}
function graphNodes(store) {
    return [
        ...store.providers.map((provider) => ({ id: provider.id, type: 'provider', label: provider.name, category: provider.category })),
        ...store.narratives.map((narrative) => ({ id: narrative.id, type: 'narrative', label: narrative.title, heat: narrative.heat })),
        ...Array.from(new Set(store.providers.map((provider) => provider.category))).map((category) => ({ id: `category-${category}`, type: 'category', label: category }))
    ];
}
function graphEdges(store) {
    return [
        ...store.providers.map((provider) => ({ source: provider.id, target: `category-${provider.category}`, type: 'listed_in', evidenceCount: provider.evidence.length })),
        ...store.narratives.flatMap((narrative) => narrative.providerIds.map((providerId) => ({ source: narrative.id, target: providerId, type: 'contains', evidenceCount: narrative.evidence.length })))
    ];
}
