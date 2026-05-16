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
    policyNotes: z.array(z.string()).optional(),
    trustScore: z.number().nullable(),
    originalTrustScore: z.number().nullable().optional(),
    effectiveTrustScore: z.number().nullable().optional(),
    verifiedRoute: z.boolean().optional(),
    verificationSource: z.string().optional(),
    verificationStatus: z.string().optional(),
    verificationFqn: z.string().optional(),
    verificationOutputShape: z.string().optional(),
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

export const RadarPreflightConstraintsSchema = z.object({
  min_trust: z.number().min(0).max(100).optional(),
  prefer_reachable: z.boolean().optional(),
  require_pricing: z.boolean().optional(),
  max_price_usd: z.number().nonnegative().optional(),
  allow_failed: z.boolean().optional(),
  allow_risky_routes: z.boolean().optional()
}).optional();

export const RadarPreflightRequestSchema = z.object({
  intent: z.string().min(1),
  id: z.string().min(1).optional(),
  category: z.string().optional(),
  constraints: RadarPreflightConstraintsSchema
});

export const RadarBatchPreflightRequestSchema = z.object({
  queries: z.array(z.unknown()).min(1).max(25)
});

export const RadarRouteCandidateSchema = z.object({
  provider_id: z.string(),
  provider_name: z.string().nullable(),
  endpoint_id: z.string(),
  endpoint_name: z.string().nullable(),
  trust_score: z.number().nullable(),
  signal_score: z.number().nullable(),
  route_eligibility: z.boolean(),
  confidence: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  rejection_reasons: z.array(z.string()),
  mapping_status: z.enum(['complete', 'missing']),
  reachability_status: z.enum(['reachable', 'degraded', 'failed', 'unknown']),
  pricing_status: z.enum(['clear', 'missing']),
  last_seen_healthy: z.string().datetime().nullable().optional(),
  predictive_risk: z.object({
    predictive_risk_score: z.number().min(0).max(100),
    predictive_risk_level: z.enum(['low', 'watch', 'elevated', 'critical', 'unknown']),
    history_available: z.boolean(),
    sample_count: z.number().int().nonnegative(),
    explanation: z.string(),
    evidence: z.array(z.string()),
    warnings: z.array(z.string()),
    recommended_action: z.enum(['route normally', 'route with caution', 'required fallback route', 'not recommended for routing', 'insufficient history']),
    top_anomaly: z.object({
      anomaly_type: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      confidence: z.enum(['low', 'medium', 'high']),
      explanation: z.string(),
      evidence: z.array(z.string()).optional(),
      detected_at: z.string().datetime()
    }).nullable()
  }).optional(),
  trend_context: z.object({
    trust_trend: z.enum(['improving', 'stable', 'degrading', 'unknown']),
    signal_trend: z.enum(['improving', 'stable', 'degrading', 'unknown']),
    degradation_trend: z.enum(['improving', 'stable', 'degrading', 'unknown']),
    trust_delta_24h: z.number().nullable(),
    signal_delta_24h: z.number().nullable(),
    latency_delta_24h: z.number().nullable(),
    degradation_delta_24h: z.number().nullable(),
    route_eligibility_changed: z.boolean().nullable(),
    last_seen_healthy_at: z.string().datetime().nullable(),
    warning: z.string().nullable()
  }).optional()
});

export const RadarPreflightResponseSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  input: RadarPreflightRequestSchema,
  recommended_route: RadarRouteCandidateSchema.nullable(),
  accepted_candidates: z.array(RadarRouteCandidateSchema),
  rejected_candidates: z.array(RadarRouteCandidateSchema),
  warnings: z.array(z.string()),
  superiority_evidence_available: z.boolean()
});

export const RadarBatchPreflightResultSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  recommended_route: RadarRouteCandidateSchema.nullable().optional(),
  accepted_candidates: z.array(RadarRouteCandidateSchema).optional(),
  rejected_candidates: z.array(RadarRouteCandidateSchema).optional(),
  warnings: z.array(z.string()),
  error: z.string().optional()
});

export const RadarBatchPreflightResponseSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  count: z.number().int().nonnegative(),
  results: z.array(RadarBatchPreflightResultSchema),
  warnings: z.array(z.string())
});

export const RadarComparisonRequestSchema = z.object({
  mode: z.enum(['provider', 'endpoint']).default('provider'),
  ids: z.array(z.string().min(1)).min(2).max(3)
});

export const RadarComparisonRowSchema = z.object({
  id: z.string(),
  type: z.enum(['provider', 'endpoint']),
  name: z.string(),
  trust_score: z.number().nullable(),
  signal_score: z.number().nullable(),
  endpoint_count: z.number().int().nonnegative(),
  mapped_endpoint_count: z.number().int().nonnegative(),
  route_eligible_endpoint_count: z.number().int().nonnegative(),
  degradation_count: z.number().int().nonnegative(),
  pricing_clarity: z.number().nullable(),
  metadata_quality: z.number().nullable(),
  reachability: z.enum(['reachable', 'degraded', 'failed', 'unknown']),
  last_observed: z.string().datetime().nullable(),
  last_seen_healthy: z.string().datetime().nullable(),
  last_verified_at: z.string().datetime().nullable().optional(),
  verified_mapping_count: z.number().int().nonnegative().optional(),
  mapping_source: z.enum(['none', 'catalog', 'verified', 'catalog_and_verified']).optional(),
  predictive_risk_level: z.enum(['low', 'watch', 'elevated', 'critical', 'unknown']).optional(),
  predictive_risk_score: z.number().min(0).max(100).optional(),
  recommended_action: z.enum(['route normally', 'route with caution', 'required fallback route', 'not recommended for routing', 'insufficient history']).optional(),
  top_anomaly: z.object({
    anomaly_type: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    confidence: z.enum(['low', 'medium', 'high']),
    explanation: z.string(),
    evidence: z.array(z.string()).optional(),
    detected_at: z.string().datetime()
  }).nullable().optional(),
  route_recommendation: z.enum(['route_eligible', 'not_recommended']),
  rejection_reasons: z.array(z.string())
});

export const RadarComparisonResponseSchema = z.object({
  generated_at: z.string().datetime(),
  mode: z.enum(['provider', 'endpoint']),
  rows: z.array(RadarComparisonRowSchema)
});

export const RadarSuperiorityReadinessSchema = z.object({
  generated_at: z.string().datetime(),
  executable_provider_mappings_count: z.number().int().nonnegative(),
  categories_with_at_least_two_executable_mappings: z.array(z.string()),
  categories_not_ready_for_comparison: z.array(z.string()),
  providers_with_proven_paid_execution: z.array(z.string()),
  providers_with_only_catalog_metadata: z.array(z.string()),
  next_mappings_needed: z.array(z.string()),
  winner_claimed: z.boolean().optional(),
  next_step: z.string().optional(),
  readiness_note: z.string().optional()
});

export const RadarBenchmarkCategorySchema = z.object({
  category: z.string(),
  benchmark_intent: z.string(),
  executable_mapping_count: z.number().int().nonnegative(),
  candidate_mapping_count: z.number().int().nonnegative(),
  proven_execution_count: z.number().int().nonnegative(),
  benchmark_ready: z.boolean(),
  superiority_ready: z.boolean(),
  missing_requirements: z.array(z.string()),
  recommended_next_mapping: z.string(),
  mapping_ladder: z.array(z.string()),
  metadata_only_warning: z.string().nullable()
});

export const RadarBenchmarkReadinessSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  categories: z.array(RadarBenchmarkCategorySchema),
  benchmark_ready_categories: z.array(z.string()),
  superiority_ready_categories: z.array(z.string()),
  not_ready_categories: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  recommended_next_mappings: z.array(z.string()),
  metadata_only_warning: z.string()
});

export const RadarBenchmarkRouteMetricSchema = z.object({
  provider_id: z.string(),
  route_id: z.string(),
  execution_status: z.enum(['verified', 'proven']),
  success: z.boolean().optional(),
  latency_ms: z.number().int().positive().nullable(),
  paid_execution_proven: z.boolean(),
  proof_reference: z.string(),
  normalized_output_available: z.boolean(),
  extracted_price_usd: z.number().nonnegative().nullable(),
  extraction_path: z.string().nullable().optional(),
  success_rate: z.number().min(0).max(1).nullable().optional(),
  median_latency_ms: z.number().int().positive().nullable().optional(),
  p95_latency_ms: z.number().int().positive().nullable().optional(),
  average_price_usd: z.number().nonnegative().nullable().optional(),
  min_price_usd: z.number().nonnegative().nullable().optional(),
  max_price_usd: z.number().nonnegative().nullable().optional(),
  price_variance_percent: z.number().nonnegative().nullable().optional(),
  completed_runs: z.number().int().nonnegative().nullable().optional(),
  failed_runs: z.number().int().nonnegative().nullable().optional(),
  execution_transport: z.string().optional(),
  cli_exit_code: z.number().int().nullable().optional(),
  status_code: z.number().int().nullable().optional(),
  status_evidence: z.string().optional(),
  output_shape: z.record(z.string(), z.unknown()).nullable(),
  normalization_confidence: z.enum(['unknown', 'low', 'medium', 'high']),
  freshness_timestamp: z.string().datetime().nullable(),
  comparison_notes: z.string()
});

export const RadarBenchmarkWinnerStatusSchema = z.enum([
  'not_evaluated',
  'insufficient_runs',
  'no_clear_winner',
  'provisional_winner',
  'winner_claimed'
]);

export const RadarBenchmarkWinnerPolicySchema = z.object({
  policy_id: z.string(),
  policy_version: z.string(),
  required_successful_runs_per_route: z.number().int().positive(),
  minimum_success_rate: z.number().min(0).max(1),
  allowed_price_variance_percent: z.number().nonnegative(),
  latency_metric: z.enum(['median']),
  required_confidence: z.array(z.enum(['high', 'medium'])).min(1),
  scoring_weights: z.object({
    reliability: z.number().min(0).max(1),
    latency: z.number().min(0).max(1),
    normalization_confidence: z.number().min(0).max(1),
    price_consistency: z.number().min(0).max(1),
    cost_clarity: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1)
  }),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  winner_claimed: z.boolean(),
  winner_rationale: z.string().optional(),
  completed_runs: z.number().int().nonnegative(),
  required_runs: z.number().int().positive(),
  next_step: z.string()
});

export const RadarBenchmarkDetailSchema = z.object({
  benchmark_id: z.string(),
  category: z.string(),
  benchmark_intent: z.string(),
  benchmark_recorded: z.boolean(),
  winner_claimed: z.boolean(),
  winner_status: RadarBenchmarkWinnerStatusSchema.optional(),
  winner_policy: RadarBenchmarkWinnerPolicySchema.optional(),
  next_step: z.string(),
  readiness_note: z.string(),
  routes: z.array(RadarBenchmarkRouteMetricSchema)
});

export const BenchmarkHistoryEntrySchema = z.object({
  benchmark_id: z.string(),
  recorded_at: z.string().datetime(),
  run_count: z.number().int().positive(),
  benchmark_recorded: z.boolean(),
  winner_claimed: z.boolean(),
  winner_status: RadarBenchmarkWinnerStatusSchema.optional(),
  note: z.string(),
  proof_reference: z.string(),
  routes: z.array(RadarBenchmarkRouteMetricSchema)
});

export const RadarBenchmarkHistorySchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  benchmark_id: z.string(),
  entries: z.array(BenchmarkHistoryEntrySchema)
});

export const RadarBenchmarkListSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  benchmarks: z.array(RadarBenchmarkDetailSchema)
});

export const RadarBenchmarkArtifactRouteSchema = z.object({
  provider_id: z.string(),
  route_id: z.string(),
  execution_status: z.enum(['verified', 'proven']),
  success: z.boolean(),
  latency_ms: z.number().int().positive().nullable(),
  paid_execution_proven: z.boolean(),
  proof_reference: z.string(),
  normalized_output_available: z.boolean(),
  extracted_price_usd: z.number().nonnegative().nullable(),
  extraction_path: z.string().nullable(),
  success_rate: z.number().min(0).max(1).nullable(),
  median_latency_ms: z.number().int().positive().nullable(),
  p95_latency_ms: z.number().int().positive().nullable(),
  average_price_usd: z.number().nonnegative().nullable(),
  min_price_usd: z.number().nonnegative().nullable(),
  max_price_usd: z.number().nonnegative().nullable(),
  price_variance_percent: z.number().nonnegative().nullable(),
  completed_runs: z.number().int().nonnegative().nullable(),
  failed_runs: z.number().int().nonnegative().nullable(),
  execution_transport: z.literal('pay_cli'),
  cli_exit_code: z.number().int().nullable(),
  status_code: z.number().int().nullable(),
  status_evidence: z.string(),
  normalization_confidence: z.enum(['unknown', 'low', 'medium', 'high']),
  freshness_timestamp: z.string().datetime().nullable(),
  comparison_notes: z.string()
});

export const RadarBenchmarkArtifactSchema = z.object({
  artifact_id: z.string(),
  benchmark_id: z.string(),
  generated_at: z.string().datetime(),
  source_repo: z.string().url(),
  artifact_path: z.string(),
  total_runs: z.number().int().nonnegative(),
  winner_claimed: z.boolean(),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  routes: z.array(RadarBenchmarkArtifactRouteSchema),
  aggregate_metrics: z.record(z.string(), z.unknown()),
  notes: z.string()
});

export const RadarBenchmarkArtifactListSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  artifacts: z.array(RadarBenchmarkArtifactSchema)
});

export const RadarRiskAnomalySchema = z.object({
  anomaly_type: z.enum([
    'sudden_trust_drop',
    'sudden_signal_spike',
    'repeated_degradation',
    'repeated_failed_metadata_check',
    'latency_spike',
    'route_eligibility_flip',
    'pricing_metadata_disappeared',
    'metadata_quality_decline',
    'catalog_metadata_churn',
    'stale_catalog_source',
    'critical_current_state'
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.enum(['low', 'medium', 'high']),
  explanation: z.string(),
  evidence: z.array(z.string()),
  detected_at: z.string().datetime()
});

export const RadarRiskResponseSchema = z.object({
  generated_at: z.string().datetime(),
  subject_type: z.enum(['provider', 'endpoint', 'ecosystem']),
  subject_id: z.string(),
  risk_score: z.number().min(0).max(100),
  risk_level: z.enum(['low', 'watch', 'elevated', 'critical', 'unknown']),
  history_available: z.boolean(),
  sample_count: z.number().int().nonnegative(),
  explanation: z.string().optional(),
  anomalies: z.array(RadarRiskAnomalySchema),
  evidence: z.array(z.string()),
  warnings: z.array(z.string()),
  recommended_action: z.enum(['route normally', 'route with caution', 'required fallback route', 'not recommended for routing', 'insufficient history'])
});

export const RadarEcosystemRiskSummarySchema = RadarRiskResponseSchema.extend({
  subject_type: z.literal('ecosystem'),
  subject_id: z.literal('ecosystem'),
  summary: z.object({
    providers_by_risk_level: z.object({
      low: z.number().int().nonnegative(),
      watch: z.number().int().nonnegative(),
      elevated: z.number().int().nonnegative(),
      critical: z.number().int().nonnegative(),
      unknown: z.number().int().nonnegative()
    }),
    top_anomalies: z.array(z.object({
      anomaly_type: RadarRiskAnomalySchema.shape.anomaly_type,
      count: z.number().int().nonnegative()
    })),
    categories_most_affected: z.array(z.object({
      category: z.string(),
      provider_count: z.number().int().nonnegative()
    })),
    recent_critical_events: z.array(z.object({
      event_id: z.string(),
      type: EventTypeSchema,
      provider_id: z.string().nullable(),
      endpoint_id: z.string().nullable(),
      observed_at: z.string().datetime()
    })),
    stale_catalog_warning: z.string().nullable(),
    anomaly_watch: z.array(z.object({
      subject_type: z.enum(['provider', 'endpoint']),
      provider_id: z.string().nullable(),
      endpoint_id: z.string().nullable(),
      anomaly_type: RadarRiskAnomalySchema.shape.anomaly_type,
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      confidence: z.enum(['low', 'medium', 'high']),
      explanation: z.string(),
      detected_at: z.string().datetime(),
      recommended_action: z.enum(['route normally', 'route with caution', 'required fallback route', 'not recommended for routing', 'insufficient history']),
      route_implication: z.string(),
      evidence: z.array(z.string())
    }))
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
export type RadarPreflightRequest = z.infer<typeof RadarPreflightRequestSchema>;
export type RadarPreflightResponse = z.infer<typeof RadarPreflightResponseSchema>;
export type RadarBatchPreflightRequest = z.infer<typeof RadarBatchPreflightRequestSchema>;
export type RadarBatchPreflightResponse = z.infer<typeof RadarBatchPreflightResponseSchema>;
export type RadarComparisonRequest = z.infer<typeof RadarComparisonRequestSchema>;
export type RadarComparisonResponse = z.infer<typeof RadarComparisonResponseSchema>;
export type RadarSuperiorityReadiness = z.infer<typeof RadarSuperiorityReadinessSchema>;
export type RadarBenchmarkReadiness = z.infer<typeof RadarBenchmarkReadinessSchema>;
export type RadarBenchmarkRouteMetric = z.infer<typeof RadarBenchmarkRouteMetricSchema>;
export type RadarBenchmarkDetail = z.infer<typeof RadarBenchmarkDetailSchema>;
export type BenchmarkHistoryEntry = z.infer<typeof BenchmarkHistoryEntrySchema>;
export type RadarBenchmarkHistory = z.infer<typeof RadarBenchmarkHistorySchema>;
export type RadarBenchmarkList = z.infer<typeof RadarBenchmarkListSchema>;
export type RadarBenchmarkWinnerStatus = z.infer<typeof RadarBenchmarkWinnerStatusSchema>;
export type RadarBenchmarkArtifact = z.infer<typeof RadarBenchmarkArtifactSchema>;
export type RadarBenchmarkArtifactList = z.infer<typeof RadarBenchmarkArtifactListSchema>;
export type RadarRiskAnomaly = z.infer<typeof RadarRiskAnomalySchema>;
export type RadarRiskResponse = z.infer<typeof RadarRiskResponseSchema>;
export type RadarEcosystemRiskSummary = z.infer<typeof RadarEcosystemRiskSummarySchema>;
