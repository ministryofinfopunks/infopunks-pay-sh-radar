"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteRecommendationSchema = exports.RouteRecommendationRequestSchema = exports.SearchRequestSchema = exports.NarrativeClusterSchema = exports.SignalAssessmentSchema = exports.TrustAssessmentSchema = exports.MonitorRunSchema = exports.IngestionRunSchema = exports.EndpointSchema = exports.ProviderSchema = exports.PricingModelSchema = exports.InfopunksEventSchema = exports.EvidenceSchema = exports.EventTypeSchema = void 0;
const zod_1 = require("zod");
exports.EventTypeSchema = zod_1.z.enum([
    'pay_sh_catalog_provider_seen',
    'pay_sh_catalog_endpoint_seen',
    'pay_sh_catalog_manifest_seen',
    'pay_sh_catalog_schema_seen',
    'provider_metadata_observed',
    'pricing_observed',
    'endpoint_status_observed',
    'score_assessment_created',
    'manifest.updated',
    'endpoint.updated',
    'price.changed',
    'schema.changed',
    'endpoint.checked',
    'endpoint.recovered',
    'endpoint.degraded',
    'endpoint.failed'
]);
exports.EvidenceSchema = zod_1.z.object({
    eventId: zod_1.z.string(),
    eventType: exports.EventTypeSchema,
    source: zod_1.z.string(),
    observedAt: zod_1.z.string().datetime(),
    summary: zod_1.z.string(),
    value: zod_1.z.unknown().optional()
});
exports.InfopunksEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: exports.EventTypeSchema,
    source: zod_1.z.string(),
    entityType: zod_1.z.enum(['provider', 'endpoint', 'pricing_model', 'manifest', 'schema', 'trust_assessment', 'signal_assessment', 'narrative_cluster']),
    entityId: zod_1.z.string(),
    observedAt: zod_1.z.string().datetime(),
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())
});
exports.PricingModelSchema = zod_1.z.object({
    id: zod_1.z.string(),
    entityId: zod_1.z.string(),
    min: zod_1.z.number().nonnegative().nullable(),
    max: zod_1.z.number().nonnegative().nullable(),
    currency: zod_1.z.literal('USD').nullable(),
    unit: zod_1.z.string().nullable(),
    clarity: zod_1.z.enum(['clear', 'range', 'free', 'dynamic', 'unknown']),
    raw: zod_1.z.string(),
    evidence: zod_1.z.array(exports.EvidenceSchema)
});
exports.ProviderSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    slug: zod_1.z.string(),
    namespace: zod_1.z.string(),
    category: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    status: zod_1.z.enum(['free tier', 'metered', 'free', 'unknown']),
    endpointCount: zod_1.z.number().int().nonnegative(),
    tags: zod_1.z.array(zod_1.z.string()),
    schema: zod_1.z.unknown().nullable().optional(),
    source: zod_1.z.literal('pay.sh'),
    catalogUrl: zod_1.z.string().url(),
    firstSeenAt: zod_1.z.string().datetime(),
    lastSeenAt: zod_1.z.string().datetime(),
    pricing: exports.PricingModelSchema,
    evidence: zod_1.z.array(exports.EvidenceSchema)
});
exports.EndpointSchema = zod_1.z.object({
    id: zod_1.z.string(),
    providerId: zod_1.z.string(),
    name: zod_1.z.string(),
    path: zod_1.z.string().nullable(),
    method: zod_1.z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).nullable(),
    category: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    pricing: exports.PricingModelSchema,
    status: zod_1.z.enum(['available', 'degraded', 'unknown']),
    schema: zod_1.z.unknown().nullable().optional(),
    latencyMsP50: zod_1.z.number().int().positive().nullable(),
    firstSeenAt: zod_1.z.string().datetime(),
    lastSeenAt: zod_1.z.string().datetime(),
    evidence: zod_1.z.array(exports.EvidenceSchema)
});
exports.IngestionRunSchema = zod_1.z.object({
    id: zod_1.z.string(),
    startedAt: zod_1.z.string().datetime(),
    finishedAt: zod_1.z.string().datetime().nullable(),
    source: zod_1.z.string(),
    status: zod_1.z.enum(['running', 'succeeded', 'failed']),
    discoveredCount: zod_1.z.number().int().nonnegative(),
    changedCount: zod_1.z.number().int().nonnegative(),
    errorCount: zod_1.z.number().int().nonnegative(),
    error: zod_1.z.string().nullable()
});
exports.MonitorRunSchema = zod_1.z.object({
    id: zod_1.z.string(),
    startedAt: zod_1.z.string().datetime(),
    finishedAt: zod_1.z.string().datetime().nullable(),
    source: zod_1.z.string(),
    status: zod_1.z.enum(['running', 'succeeded', 'failed']),
    checkedCount: zod_1.z.number().int().nonnegative(),
    successCount: zod_1.z.number().int().nonnegative(),
    failedCount: zod_1.z.number().int().nonnegative(),
    skippedCount: zod_1.z.number().int().nonnegative(),
    errorCount: zod_1.z.number().int().nonnegative(),
    error: zod_1.z.string().nullable()
});
exports.TrustAssessmentSchema = zod_1.z.object({
    id: zod_1.z.string(),
    entityId: zod_1.z.string(),
    entityType: zod_1.z.enum(['provider', 'endpoint']),
    score: zod_1.z.number().min(0).max(100).nullable(),
    grade: zod_1.z.enum(['S', 'A', 'B', 'C', 'D', 'unknown']),
    components: zod_1.z.object({
        uptime: zod_1.z.number().min(0).max(100).nullable(),
        responseValidity: zod_1.z.number().min(0).max(100).nullable(),
        metadataQuality: zod_1.z.number().min(0).max(100).nullable(),
        pricingClarity: zod_1.z.number().min(0).max(100).nullable(),
        latency: zod_1.z.number().min(0).max(100).nullable(),
        receiptReliability: zod_1.z.number().min(0).max(100).nullable(),
        freshness: zod_1.z.number().min(0).max(100).nullable()
    }),
    evidence: zod_1.z.record(zod_1.z.string(), zod_1.z.array(exports.EvidenceSchema)),
    unknowns: zod_1.z.array(zod_1.z.string()),
    reasoning: zod_1.z.array(zod_1.z.string()),
    assessedAt: zod_1.z.string().datetime()
});
exports.SignalAssessmentSchema = zod_1.z.object({
    id: zod_1.z.string(),
    entityId: zod_1.z.string(),
    entityType: zod_1.z.enum(['provider', 'endpoint', 'narrative_cluster']),
    score: zod_1.z.number().min(0).max(100).nullable(),
    components: zod_1.z.object({
        ecosystemMomentum: zod_1.z.number().min(0).max(100).nullable(),
        categoryHeat: zod_1.z.number().min(0).max(100).nullable(),
        metadataChangeVelocity: zod_1.z.number().min(0).max(100).nullable(),
        socialVelocity: zod_1.z.number().min(0).max(100).nullable(),
        onchainLiquidityResonance: zod_1.z.number().min(0).max(100).nullable()
    }),
    narratives: zod_1.z.array(zod_1.z.string()),
    evidence: zod_1.z.record(zod_1.z.string(), zod_1.z.array(exports.EvidenceSchema)),
    unknowns: zod_1.z.array(zod_1.z.string()),
    reasoning: zod_1.z.array(zod_1.z.string()),
    assessedAt: zod_1.z.string().datetime()
});
exports.NarrativeClusterSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    heat: zod_1.z.number().min(0).max(100).nullable(),
    momentum: zod_1.z.number().min(0).max(100).nullable(),
    providerIds: zod_1.z.array(zod_1.z.string()),
    keywords: zod_1.z.array(zod_1.z.string()),
    summary: zod_1.z.string(),
    evidence: zod_1.z.array(exports.EvidenceSchema)
});
exports.SearchRequestSchema = zod_1.z.object({
    query: zod_1.z.string().min(1),
    category: zod_1.z.string().optional(),
    limit: zod_1.z.number().int().min(1).max(50).default(10)
});
exports.RouteRecommendationRequestSchema = zod_1.z.object({
    task: zod_1.z.string().min(1),
    category: zod_1.z.string().optional(),
    maxPrice: zod_1.z.number().nonnegative().optional(),
    trustThreshold: zod_1.z.number().min(0).max(100).default(70),
    latencySensitivity: zod_1.z.enum(['low', 'medium', 'high']).default('medium')
});
exports.RouteRecommendationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    task: zod_1.z.string(),
    bestProvider: exports.ProviderSchema.nullable(),
    fallbackProviders: zod_1.z.array(exports.ProviderSchema),
    reasoning: zod_1.z.array(zod_1.z.string()),
    estimatedCost: exports.PricingModelSchema.nullable(),
    trustAssessment: exports.TrustAssessmentSchema.nullable(),
    signalAssessment: exports.SignalAssessmentSchema.nullable(),
    evidence: zod_1.z.array(exports.EvidenceSchema),
    riskNotes: zod_1.z.array(zod_1.z.string()),
    createdAt: zod_1.z.string().datetime()
});
