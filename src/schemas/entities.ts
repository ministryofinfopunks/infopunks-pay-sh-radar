import { z } from 'zod';

export const EventTypeSchema = z.enum([
  'catalog.ingested',
  'provider.discovered',
  'provider.updated',
  'provider.removed_from_catalog',
  'category.changed',
  'endpoint_count.changed',
  'metadata.changed',
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

export const EvidenceSchema = z.object({
  eventId: z.string(),
  eventType: EventTypeSchema,
  source: z.string(),
  observedAt: z.string().datetime(),
  summary: z.string(),
  value: z.unknown().optional()
});

export const InfopunksEventSchema = z.object({
  id: z.string(),
  type: EventTypeSchema,
  source: z.string(),
  entityType: z.enum(['catalog', 'provider', 'endpoint', 'pricing_model', 'manifest', 'schema', 'trust_assessment', 'signal_assessment', 'narrative_cluster']),
  entityId: z.string(),
  observedAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown())
});

export const PricingModelSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  min: z.number().nonnegative().nullable(),
  max: z.number().nonnegative().nullable(),
  currency: z.literal('USD').nullable(),
  unit: z.string().nullable(),
  clarity: z.enum(['clear', 'range', 'free', 'dynamic', 'unknown']),
  raw: z.string(),
  evidence: z.array(EvidenceSchema)
});

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().optional(),
  fqn: z.string().optional(),
  slug: z.string(),
  namespace: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  useCase: z.string().nullable().optional(),
  serviceUrl: z.string().url().nullable().optional(),
  status: z.enum(['free tier', 'metered', 'free', 'unknown']),
  endpointCount: z.number().int().nonnegative(),
  endpointMetadataPartial: z.boolean().optional(),
  hasMetering: z.boolean().optional(),
  hasFreeTier: z.boolean().optional(),
  sourceSha: z.string().nullable().optional(),
  catalogGeneratedAt: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()),
  schema: z.unknown().nullable().optional(),
  source: z.literal('pay.sh'),
  catalogUrl: z.string().url(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  pricing: PricingModelSchema,
  evidence: z.array(EvidenceSchema)
});

export const EndpointSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  name: z.string(),
  path: z.string().nullable(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).nullable(),
  category: z.string(),
  description: z.string().nullable(),
  pricing: PricingModelSchema,
  status: z.enum(['available', 'degraded', 'unknown']),
  schema: z.unknown().nullable().optional(),
  latencyMsP50: z.number().int().positive().nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  evidence: z.array(EvidenceSchema)
});

export const IngestionRunSchema = z.object({
  id: z.string(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  source: z.string(),
  status: z.enum(['running', 'succeeded', 'failed']),
  discoveredCount: z.number().int().nonnegative(),
  changedCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  error: z.string().nullable()
});

export const MonitorRunSchema = z.object({
  id: z.string(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  source: z.string(),
  status: z.enum(['running', 'succeeded', 'failed']),
  checkedCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  error: z.string().nullable()
});

export const TrustAssessmentSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  entityType: z.enum(['provider', 'endpoint']),
  score: z.number().min(0).max(100).nullable(),
  grade: z.enum(['S', 'A', 'B', 'C', 'D', 'unknown']),
  components: z.object({
    uptime: z.number().min(0).max(100).nullable(),
    responseValidity: z.number().min(0).max(100).nullable(),
    metadataQuality: z.number().min(0).max(100).nullable(),
    pricingClarity: z.number().min(0).max(100).nullable(),
    latency: z.number().min(0).max(100).nullable(),
    receiptReliability: z.number().min(0).max(100).nullable(),
    freshness: z.number().min(0).max(100).nullable()
  }),
  evidence: z.record(z.string(), z.array(EvidenceSchema)),
  unknowns: z.array(z.string()),
  reasoning: z.array(z.string()),
  assessedAt: z.string().datetime()
});

export const SignalAssessmentSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  entityType: z.enum(['provider', 'endpoint', 'narrative_cluster']),
  score: z.number().min(0).max(100).nullable(),
  components: z.object({
    ecosystemMomentum: z.number().min(0).max(100).nullable(),
    categoryHeat: z.number().min(0).max(100).nullable(),
    metadataChangeVelocity: z.number().min(0).max(100).nullable(),
    socialVelocity: z.number().min(0).max(100).nullable(),
    onchainLiquidityResonance: z.number().min(0).max(100).nullable()
  }),
  narratives: z.array(z.string()),
  evidence: z.record(z.string(), z.array(EvidenceSchema)),
  unknowns: z.array(z.string()),
  reasoning: z.array(z.string()),
  assessedAt: z.string().datetime()
});

export const NarrativeClusterSchema = z.object({
  id: z.string(),
  title: z.string(),
  heat: z.number().min(0).max(100).nullable(),
  momentum: z.number().min(0).max(100).nullable(),
  providerIds: z.array(z.string()),
  keywords: z.array(z.string()),
  summary: z.string(),
  evidence: z.array(EvidenceSchema)
});

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10)
});

export const RouteRecommendationRequestSchema = z.object({
  task: z.string().min(1),
  category: z.string().optional(),
  maxPrice: z.number().nonnegative().optional(),
  trustThreshold: z.number().min(0).max(100).default(70),
  latencySensitivity: z.enum(['low', 'medium', 'high']).default('medium')
});

export const RouteRecommendationSchema = z.object({
  id: z.string(),
  task: z.string(),
  bestProvider: ProviderSchema.nullable(),
  fallbackProviders: z.array(ProviderSchema),
  reasoning: z.array(z.string()),
  estimatedCost: PricingModelSchema.nullable(),
  trustAssessment: TrustAssessmentSchema.nullable(),
  signalAssessment: SignalAssessmentSchema.nullable(),
  evidence: z.array(EvidenceSchema),
  riskNotes: z.array(z.string()),
  createdAt: z.string().datetime()
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type InfopunksEvent = z.infer<typeof InfopunksEventSchema>;
export type PricingModel = z.infer<typeof PricingModelSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;
export type IngestionRun = z.infer<typeof IngestionRunSchema>;
export type MonitorRun = z.infer<typeof MonitorRunSchema>;
export type TrustAssessment = z.infer<typeof TrustAssessmentSchema>;
export type SignalAssessment = z.infer<typeof SignalAssessmentSchema>;
export type NarrativeCluster = z.infer<typeof NarrativeClusterSchema>;
export type RouteRecommendation = z.infer<typeof RouteRecommendationSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type RouteRecommendationRequest = z.infer<typeof RouteRecommendationRequestSchema>;
