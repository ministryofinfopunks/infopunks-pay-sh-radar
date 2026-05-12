import { z } from 'zod';

export const SeveritySchema = z.enum(['critical', 'warning', 'informational', 'unknown']);
export const SeverityMetadataSchema = z.object({
  severity: SeveritySchema,
  severity_reason: z.string(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional()
});

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
  'provider.checked',
  'provider.reachable',
  'provider.degraded',
  'provider.failed',
  'provider.recovered',
  'endpoint.checked',
  'endpoint.recovered',
  'endpoint.degraded',
  'endpoint.failed'
]);

export const EvidenceSchema = z.object({
  eventId: z.string(),
  event_id: z.string().optional(),
  eventType: EventTypeSchema,
  event_type: EventTypeSchema.optional(),
  providerId: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  endpointId: z.string().nullable().optional(),
  endpoint_id: z.string().nullable().optional(),
  source: z.string(),
  observedAt: z.string().datetime(),
  observed_at: z.string().datetime().optional(),
  catalogGeneratedAt: z.string().datetime().nullable().optional(),
  catalog_generated_at: z.string().datetime().nullable().optional(),
  ingestedAt: z.string().datetime().nullable().optional(),
  ingested_at: z.string().datetime().nullable().optional(),
  derivationReason: z.string().optional(),
  derivation_reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
  summary: z.string(),
  value: z.unknown().optional()
});

export const InfopunksEventSchema = z.object({
  id: z.string(),
  event_id: z.string().optional(),
  type: EventTypeSchema,
  source: z.string(),
  entityType: z.enum(['catalog', 'provider', 'endpoint', 'pricing_model', 'manifest', 'schema', 'trust_assessment', 'signal_assessment', 'narrative_cluster']),
  entityId: z.string(),
  provider_id: z.string().nullable().optional(),
  endpoint_id: z.string().nullable().optional(),
  observedAt: z.string().datetime(),
  observed_at: z.string().datetime().optional(),
  catalog_generated_at: z.string().datetime().nullable().optional(),
  ingested_at: z.string().datetime().nullable().optional(),
  derivation_reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
  payload: z.record(z.string(), z.unknown())
});

export const PricingModelSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  providerId: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  endpointId: z.string().nullable().optional(),
  endpoint_id: z.string().nullable().optional(),
  observedAt: z.string().datetime().nullable().optional(),
  observed_at: z.string().datetime().nullable().optional(),
  catalogGeneratedAt: z.string().datetime().nullable().optional(),
  catalog_generated_at: z.string().datetime().nullable().optional(),
  ingestedAt: z.string().datetime().nullable().optional(),
  ingested_at: z.string().datetime().nullable().optional(),
  source: z.string().optional(),
  derivationReason: z.string().optional(),
  derivation_reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
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
  providerId: z.string().optional(),
  provider_id: z.string().optional(),
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
  catalog_generated_at: z.string().datetime().nullable().optional(),
  ingestedAt: z.string().datetime().nullable().optional(),
  ingested_at: z.string().datetime().nullable().optional(),
  observedAt: z.string().datetime().nullable().optional(),
  observed_at: z.string().datetime().nullable().optional(),
  derivationReason: z.string().optional(),
  derivation_reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
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
  provider_id: z.string().optional(),
  endpointId: z.string().optional(),
  endpoint_id: z.string().optional(),
  name: z.string(),
  path: z.string().nullable(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).nullable(),
  category: z.string(),
  description: z.string().nullable(),
  pricing: PricingModelSchema,
  status: z.enum(['available', 'degraded', 'unknown']),
  schema: z.unknown().nullable().optional(),
  latencyMsP50: z.number().int().positive().nullable(),
  observedAt: z.string().datetime().nullable().optional(),
  observed_at: z.string().datetime().nullable().optional(),
  catalogGeneratedAt: z.string().datetime().nullable().optional(),
  catalog_generated_at: z.string().datetime().nullable().optional(),
  ingestedAt: z.string().datetime().nullable().optional(),
  ingested_at: z.string().datetime().nullable().optional(),
  source: z.string().optional(),
  derivationReason: z.string().optional(),
  derivation_reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
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
  error: z.string().nullable(),
  mode: z.enum(['disabled', 'safe_metadata', 'endpoint_health', 'paid_execution_probe']).optional(),
  reachableCount: z.number().int().nonnegative().optional(),
  degradedCount: z.number().int().nonnegative().optional(),
  skippedReasons: z.array(z.object({
    providerId: z.string(),
    serviceUrl: z.string().nullable(),
    reason: z.string()
  })).optional()
});

export const TrustAssessmentSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  providerId: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  endpointId: z.string().nullable().optional(),
  endpoint_id: z.string().nullable().optional(),
  entityType: z.enum(['provider', 'endpoint']),
  observedAt: z.string().datetime().nullable().optional(),
  observed_at: z.string().datetime().nullable().optional(),
  catalogGeneratedAt: z.string().datetime().nullable().optional(),
  catalog_generated_at: z.string().datetime().nullable().optional(),
  ingestedAt: z.string().datetime().nullable().optional(),
  ingested_at: z.string().datetime().nullable().optional(),
  source: z.string().optional(),
  derivationReason: z.string().optional(),
  derivation_reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
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
  providerId: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  endpointId: z.string().nullable().optional(),
  endpoint_id: z.string().nullable().optional(),
  entityType: z.enum(['provider', 'endpoint', 'narrative_cluster']),
  observedAt: z.string().datetime().nullable().optional(),
  observed_at: z.string().datetime().nullable().optional(),
  catalogGeneratedAt: z.string().datetime().nullable().optional(),
  catalog_generated_at: z.string().datetime().nullable().optional(),
  ingestedAt: z.string().datetime().nullable().optional(),
  ingested_at: z.string().datetime().nullable().optional(),
  source: z.string().optional(),
  derivationReason: z.string().optional(),
  derivation_reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
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
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
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
  trustThreshold: z.number().min(0).max(100).optional(),
  minTrustScore: z.number().min(0).max(100).optional(),
  latencySensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
  preference: z.enum(['cheapest', 'highest_trust', 'highest_signal', 'balanced']).default('balanced'),
  preferredProviderId: z.string().optional()
}).transform((input) => ({
  ...input,
  trustThreshold: input.trustThreshold ?? input.minTrustScore ?? 70
}));

export const PreflightConstraintsSchema = z.object({
  minTrustScore: z.number().min(0).max(100).optional(),
  maxLatencyMs: z.number().int().positive().optional(),
  maxCostUsd: z.number().nonnegative().optional()
}).optional();

export const PreflightRequestSchema = z.object({
  intent: z.string().min(1),
  category: z.string().optional(),
  constraints: PreflightConstraintsSchema,
  candidateProviders: z.array(z.string().min(1)).optional(),
  debug: z.boolean().optional()
});

export const PreflightDecisionSchema = z.enum(['route_approved', 'route_blocked']);
export const PreflightBlockReasonSchema = z.enum(['no_candidates', 'no_category_match', 'no_capability_match', 'all_candidates_rejected_by_policy']);

export const PreflightRejectionSchema = z.object({
  providerId: z.string(),
  reasons: z.array(z.string())
});

export const PreflightConsideredProviderRejectionSchema = z.object({
  providerId: z.string(),
  category: z.string(),
  capabilities: z.array(z.string()),
  reasons: z.array(z.string())
});

export const PreflightResponseSchema = z.object({
  decision: PreflightDecisionSchema,
  blockReason: PreflightBlockReasonSchema.nullable(),
  selectedProvider: z.string().nullable(),
  selectedProviderDetails: z.object({
    providerId: z.string(),
    name: z.string(),
    category: z.string(),
    capabilities: z.array(z.string()).optional(),
    capabilityMatchScore: z.number().int().nonnegative().optional(),
    trustScore: z.number().nullable(),
    signalScore: z.number().nullable(),
    latencyMs: z.number().nullable(),
    costUsd: z.number().nullable(),
    degradationFlag: z.boolean()
  }).nullable().optional(),
  capabilityMatch: z.boolean().optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  capabilityInferenceReason: z.string().nullable().optional(),
  rejectedProviders: z.array(PreflightRejectionSchema),
  rejectionSummary: z.object({
    totalRejectedCount: z.number().int().nonnegative(),
    categoryMismatchCount: z.number().int().nonnegative(),
    capabilityMismatchCount: z.number().int().nonnegative(),
    policyRejectedCount: z.number().int().nonnegative()
  }).optional(),
  consideredProvidersRejected: z.array(PreflightConsideredProviderRejectionSchema).optional(),
  rejectedProviderCount: z.number().int().nonnegative().optional(),
  rejectedProvidersTruncated: z.boolean().optional(),
  categoryMatch: z.boolean().optional(),
  fallbackCategoryUsed: z.boolean().optional(),
  candidateCount: z.number().int().nonnegative(),
  consideredProviderCount: z.number().int().nonnegative(),
  routingPolicy: z.object({
    intent: z.string(),
    category: z.string().nullable(),
    constraints: z.object({
      minTrustScore: z.number().min(0).max(100),
      maxLatencyMs: z.number().int().positive().nullable(),
      maxCostUsd: z.number().nonnegative().nullable()
    }),
    tieBreaker: z.literal('lower_latency_ms'),
    priorityOrder: z.array(z.string())
  }),
  generatedAt: z.string().datetime(),
  dataMode: z.enum(['live', 'cached', 'fallback']),
  source: z.object({
    mode: z.enum(['live_pay_sh_catalog', 'fixture_fallback']),
    url: z.string().nullable(),
    generatedAt: z.string().datetime().nullable(),
    lastIngestedAt: z.string().datetime().nullable(),
    providerCount: z.number().int().nonnegative(),
    usedFixture: z.boolean(),
    error: z.string().nullable()
  })
});

export const RouteCandidateSchema = z.object({
  provider: ProviderSchema,
  trustAssessment: TrustAssessmentSchema,
  signalAssessment: SignalAssessmentSchema,
  rank: z.number(),
  relevance: z.number(),
  riskNotes: z.array(z.string())
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
  fallbackDetails: z.array(RouteCandidateSchema).optional(),
  scoringInputs: z.object({
    task: z.string(),
    category: z.string().nullable(),
    maxPrice: z.number().nullable(),
    trustThreshold: z.number(),
    latencySensitivity: z.enum(['low', 'medium', 'high']),
    preference: z.enum(['cheapest', 'highest_trust', 'highest_signal', 'balanced']),
    preferredProviderId: z.string().nullable(),
    preferredProviderIncluded: z.boolean(),
    source: z.literal('LIVE PAY.SH CATALOG')
  }).optional(),
  excludedProviders: z.array(z.object({
    provider: ProviderSchema,
    reasons: z.array(z.string())
  })).optional(),
  unknownTelemetry: z.array(z.string()).optional(),
  rationale: z.array(z.string()).optional(),
  coordinationScore: z.number().nullable().optional(),
  selectedProviderNotRecommendedReason: z.string().nullable().optional(),
  preference: z.enum(['cheapest', 'highest_trust', 'highest_signal', 'balanced']).optional(),
  createdAt: z.string().datetime()
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type SeverityMetadata = z.infer<typeof SeverityMetadataSchema>;
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
export type PreflightRequest = z.infer<typeof PreflightRequestSchema>;
export type PreflightResponse = z.infer<typeof PreflightResponseSchema>;
