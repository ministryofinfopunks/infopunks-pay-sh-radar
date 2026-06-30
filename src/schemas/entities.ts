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

export const NarrativeDecisionStateSchema = z.enum([
  'strong_signal',
  'supportive_watch',
  'watch_closely',
  'concentrated_power',
  'high_reflexivity',
  'unproven',
  'do_not_chase'
]);

export const NarrativeEvidenceArtifactSchema = z.object({
  label: z.string(),
  note: z.string(),
  href: z.string().optional()
});

export const NarrativeRelatedRouteSchema = z.object({
  label: z.string(),
  href: z.string()
});

export const NarrativeAssetSchema = z.object({
  id: z.string(),
  slug: z.string(),
  ticker: z.string(),
  name: z.string(),
  chain: z.string(),
  category: z.string(),
  thesis: z.string(),
  signal_source: z.string(),
  attention_velocity_score: z.number().min(0).max(100),
  myth_coherence_score: z.number().min(0).max(100),
  centralization_risk_score: z.number().min(0).max(100),
  reflexivity_risk_score: z.number().min(0).max(100),
  kol_dependency_score: z.number().min(0).max(100),
  trench_contagion_score: z.number().min(0).max(100),
  sovereignty_score: z.number().min(0).max(100),
  infopunk_verdict: z.string(),
  evidence_artifacts: z.array(NarrativeEvidenceArtifactSchema),
  related_routes: z.array(NarrativeRelatedRouteSchema),
  last_updated: z.string().datetime(),
  title: z.string(),
  heat: z.number().min(0).max(100),
  momentum: z.number().min(0).max(100),
  providerIds: z.array(z.string()),
  keywords: z.array(z.string()),
  summary: z.string(),
  risk_facets: z.array(z.lazy(() => SignalRiskFacetSchema)).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional(),
  evidence: z.array(EvidenceSchema).optional()
});

export const NarrativeSignalSurfaceTypeSchema = z.enum(['signal_source', 'signal_report']);

export const NarrativeSignalCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  score: z.union([z.number().min(0).max(100), z.string()]),
  short_explanation: z.string(),
  evidence_note: z.string(),
  decision_state: NarrativeDecisionStateSchema
});

export const NarrativeSignalSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  card_ids: z.array(z.string())
});

export const NarrativeSignalSurfaceSchema = z.object({
  slug: z.string(),
  type: NarrativeSignalSurfaceTypeSchema,
  title: z.string(),
  subtitle: z.string(),
  thesis: z.string(),
  disclaimer: z.string(),
  signal_source: z.string(),
  asset_slug: z.string().nullable(),
  last_updated: z.string().datetime(),
  cards: z.array(NarrativeSignalCardSchema),
  sections: z.array(NarrativeSignalSectionSchema),
  asset: NarrativeAssetSchema.optional()
});

export const SignalEvidenceUpdateTypeSchema = z.enum([
  'attention_shift',
  'holder_shift',
  'myth_shift',
  'risk_shift',
  'verdict_change'
]);

export const SignalEvidenceUpdateSchema = z.object({
  update_id: z.string(),
  signal_slug: z.string(),
  timestamp: z.string().datetime(),
  update_type: SignalEvidenceUpdateTypeSchema,
  summary: z.string(),
  evidence_links: z.array(z.string()),
  previous_score: z.number().min(0).max(100).optional(),
  new_score: z.number().min(0).max(100).optional(),
  analyst_note: z.string(),
  risk_facets: z.array(z.lazy(() => SignalRiskFacetSchema)).optional()
});

export const SignalDeskStatusSchema = z.enum(['live_watch', 'seeded_report', 'needs_review']);

export const SignalRiskFacetSchema = z.enum([
  'high_reflexivity',
  'power_concentration',
  'unproven_sovereignty',
  'kol_dependency',
  'thin_evidence',
  'narrative_fatigue',
  'live_watch'
]);

export const CandidateSignalCategorySchema = z.enum([
  'attention_market',
  'meme_asset',
  'agentic_narrative',
  'depin_signal',
  'kol_signal',
  'market_myth',
  'unknown'
]);

export const CandidateSignalSubmittedBySchema = z.enum(['desk', 'community', 'system']);

export const CandidateSignalStatusSchema = z.enum([
  'queued',
  'watching',
  'needs_evidence',
  'under_review',
  'rejected',
  'promoted_to_report'
]);

export const CandidateSignalPrioritySchema = z.enum(['low', 'medium', 'high']);

export const CandidateSignalRiskLevelSchema = z.enum(['low', 'medium', 'high', 'unknown']);

export const CandidateSignalSchema = z.object({
  candidate_id: z.string(),
  name: z.string(),
  ticker: z.string().optional(),
  chain: z.string().optional(),
  category: CandidateSignalCategorySchema,
  submitted_by: CandidateSignalSubmittedBySchema,
  status: CandidateSignalStatusSchema,
  priority: CandidateSignalPrioritySchema,
  risk_level: CandidateSignalRiskLevelSchema,
  risk_facets: z.array(SignalRiskFacetSchema),
  summary: z.string(),
  why_it_matters: z.string(),
  evidence_links: z.array(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const SignalDeskActivityTypeSchema = z.enum([
  'report_published',
  'dispatch_published',
  'risk_shift',
  'verdict_change',
  'candidate_promoted',
  'metadata_updated',
  'og_card_generated'
]);

export const SignalDeskReportCardSchema = z.object({
  slug: z.string(),
  ticker: z.string(),
  name: z.string(),
  category: z.string(),
  thesis: z.string(),
  href: z.string(),
  signal_strength: z.number().min(0).max(100),
  myth_coherence: z.number().min(0).max(100),
  reflexivity_risk: z.number().min(0).max(100),
  sovereignty_score: z.number().min(0).max(100),
  risk_facets: z.array(SignalRiskFacetSchema),
  desk_status: SignalDeskStatusSchema,
  latest_update_type: SignalEvidenceUpdateTypeSchema.optional(),
  latest_update_at: z.string().datetime().optional(),
  update_count: z.number().int().nonnegative()
});

export const SignalDeskDispatchCardSchema = z.object({
  update_id: z.string(),
  signal_slug: z.string(),
  signal_name: z.string(),
  ticker: z.string(),
  update_type: SignalEvidenceUpdateTypeSchema,
  readable_update_type: z.string(),
  timestamp: z.string().datetime(),
  summary: z.string(),
  analyst_note: z.string(),
  href: z.string(),
  og_image: z.string(),
  risk_facets: z.array(SignalRiskFacetSchema),
  previous_score: z.number().min(0).max(100).optional(),
  new_score: z.number().min(0).max(100).optional(),
  signal_delta: z.number().optional()
});

export const SignalDeskActivityItemSchema = z.object({
  id: z.string(),
  type: SignalDeskActivityTypeSchema,
  timestamp: z.string().datetime(),
  title: z.string(),
  summary: z.string(),
  href: z.string()
});

export const SignalDeskIndexSchema = z.object({
  generated_at: z.string().datetime(),
  desk_status: SignalDeskStatusSchema,
  counts: z.object({
    reports: z.number().int().nonnegative(),
    dispatches: z.number().int().nonnegative(),
    risk_shifts: z.number().int().nonnegative(),
    watched_signals: z.number().int().nonnegative()
  }),
  candidate_signals: z.array(CandidateSignalSchema),
  candidate_counts: z.object({
    total: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    watching: z.number().int().nonnegative(),
    needs_evidence: z.number().int().nonnegative(),
    under_review: z.number().int().nonnegative(),
    promoted_to_report: z.number().int().nonnegative()
  }),
  featured_report: SignalDeskReportCardSchema.nullable(),
  reports: z.array(SignalDeskReportCardSchema),
  latest_dispatches: z.array(SignalDeskDispatchCardSchema),
  risk_shifts: z.array(SignalDeskDispatchCardSchema),
  desk_activity: z.array(SignalDeskActivityItemSchema)
});

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10)
});

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const DecisionStateSchema = z.enum(['approved', 'approved_with_warning', 'use_with_caution', 'requires_human_approval', 'do_not_use']);
export const ValidationStateSchema = z.enum(['unvalidated', 'machine_checked', 'human_validated', 'disputed', 'rejected', 'stale']);
export const ClaimTargetTypeSchema = z.enum(['route', 'provider', 'service', 'receipt', 'counterparty', 'claim']);
export const ClaimStatusSchema = z.enum(['submitted', 'under_review', 'supported', 'challenged', 'rejected', 'resolved', 'stale']);
export const ClaimTypeSchema = z.enum(['reliability', 'cost', 'latency', 'output_quality', 'safety', 'dispute', 'blocker', 'benchmark', 'counterparty_risk']);
export const ProofClaimTypeSchema = z.enum([
  'agent_autonomy',
  'route_performance',
  'provider_reliability',
  'market_claim',
  'token_claim',
  'partnership_claim',
  'revenue_claim',
  'generic_claim'
]);
export const EvidenceStrengthSchema = z.enum(['strong', 'medium', 'weak', 'missing']);
export const ReceiptStrengthSchema = z.enum(['verified_receipts', 'partial_receipts', 'weak_receipts', 'no_receipts']);
export const ProofValidationStatusSchema = z.enum(['human_validated', 'community_pending', 'disputed', 'unvalidated']);
export const ProofRiskFlagSchema = z.enum([
  'hype_without_receipts',
  'autonomy_unproven',
  'weak_onchain_evidence',
  'no_human_validation',
  'unclear_provider_history',
  'narrative_over_evidence',
  'route_not_repeatable',
  'disputed_claim',
  'missing_source'
]);
export const ProofDecisionStateSchema = z.enum(['trust', 'caution', 'do_not_use_yet', 'unproven', 'disputed']);
export const LoopProofStateSchema = z.enum(['verified', 'partial', 'failure_recorded', 'memory_recorded', 'unproven', 'disputed']);
export const SignalNodeTypeSchema = z.enum(['claim', 'meme', 'agent', 'project', 'token', 'post', 'route', 'receipt', 'proof_check', 'loop_run', 'provider', 'service', 'narrative', 'category']);
export const SignalGraphProofStateSchema = z.enum(['unproven', 'validated', 'disputed', 'corrupted', 'compounding']);
export const SignalEdgeTypeSchema = z.enum(['semantic_similarity', 'proof_link', 'citation', 'receipt', 'receipt_link', 'shared_wallet', 'repeated_narrative', 'contradiction', 'amplification', 'provider_category', 'narrative_category']);

export const RouteIntelligenceSchema = z.object({
  route_id: z.string(),
  provider_id: z.string(),
  service_id: z.string(),
  endpoint: z.string(),
  payment_method: z.string(),
  estimated_cost: z.string(),
  latency_ms_p50: z.number().int().nonnegative(),
  latency_ms_p95: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(1),
  last_tested_at: z.string().datetime(),
  last_successful_run: z.string().datetime().nullable(),
  last_failed_run: z.string().datetime().nullable(),
  confidence_score: z.number().min(0).max(100),
  risk_level: RiskLevelSchema,
  known_blockers: z.array(z.string()),
  receipt_references: z.array(z.string()),
  recommended_use_case: z.string(),
  avoid_conditions: z.array(z.string())
});

export const ProviderIntelligenceRecordSchema = z.object({
  provider_id: z.string(),
  name: z.string(),
  service_categories: z.array(z.string()),
  reliability_score: z.number().min(0).max(100),
  pricing_consistency: z.string(),
  output_quality_notes: z.array(z.string()),
  uptime_notes: z.array(z.string()),
  dispute_history: z.array(z.string()),
  human_validation_status: ValidationStateSchema,
  known_risks: z.array(z.string()),
  agent_compatibility: z.array(z.string()),
  route_coverage: z.number().int().nonnegative(),
  recent_receipt_count: z.number().int().nonnegative()
});

export const ServiceDossierSchema = z.object({
  service_id: z.string(),
  category: z.string(),
  available_routes: z.array(z.string()),
  supported_inputs: z.array(z.string()),
  observed_cost_range: z.object({
    min: z.string(),
    max: z.string()
  }),
  observed_latency_range: z.object({
    min_ms: z.number().int().nonnegative(),
    max_ms: z.number().int().nonnegative()
  }),
  best_observed_route: z.string().nullable(),
  cheapest_observed_route: z.string().nullable(),
  safest_first_attempt: z.string().nullable(),
  fastest_repeatable_route: z.string().nullable(),
  known_blockers: z.array(z.string()),
  evidence_artifacts: z.array(z.string()),
  benchmark_readiness: ValidationStateSchema,
  pre_spend_recommendation: z.string()
});

export const PreSpendReceiptSchema = z.object({
  receipt_id: z.string(),
  timestamp: z.string().datetime(),
  agent_id: z.string(),
  route_id: z.string(),
  provider_id: z.string(),
  service_id: z.string(),
  task_type: z.string(),
  cost: z.string(),
  payment_method: z.string(),
  latency_ms: z.number().int().nonnegative(),
  input_summary: z.string(),
  output_summary: z.string(),
  status: z.enum(['succeeded', 'failed', 'timed_out', 'partial']),
  failure_reason: z.string().nullable(),
  validation_state: ValidationStateSchema,
  human_notes: z.array(z.string()),
  confidence_delta: z.number().min(-100).max(100),
  evidence_artifact: z.string()
});

export const PreSpendMetricsSchema = z.object({
  verified_pre_spend_decisions: z.number().int().nonnegative(),
  routes_indexed: z.number().int().nonnegative(),
  providers_scored: z.number().int().nonnegative(),
  receipts_generated: z.number().int().nonnegative(),
  pre_spend_checks_completed: z.number().int().nonnegative(),
  human_validations_submitted: z.number().int().nonnegative(),
  failed_routes_avoided: z.number().int().nonnegative(),
  claims_challenged: z.number().int().nonnegative(),
  repeatable_routes_discovered: z.number().int().nonnegative(),
  agent_builders_using_the_api: z.number().int().nonnegative(),
  amount_of_spend_protected_or_intelligently_routed: z.string()
});

export const PreSpendCheckRequestSchema = z.object({
  agent_id: z.string().min(1),
  intent: z.string().min(1),
  budget: z.number().nonnegative(),
  risk_tolerance: RiskLevelSchema,
  preferred_settlement: z.string().min(1),
  required_confidence: z.number().min(0).max(100)
});

export const PreSpendCheckResponseSchema = z.object({
  intent: z.string(),
  decision: DecisionStateSchema,
  recommended_route: z.string().nullable(),
  confidence_score: z.number().min(0).max(100),
  risk_level: RiskLevelSchema,
  estimated_cost: z.string().nullable(),
  last_successful_run: z.string().datetime().nullable(),
  known_blockers: z.array(z.string()),
  requires_human_approval: z.boolean(),
  receipt_references: z.array(z.string()),
  safer_alternatives: z.array(z.string()),
  do_not_use: z.array(z.object({
    provider: z.string(),
    reason: z.string()
  })),
  rationale: z.array(z.string())
});

export const HumanValidationSubmissionSchema = z.object({
  target_type: z.enum(['route', 'provider', 'service', 'receipt']),
  target_id: z.string().min(1),
  validator_id: z.string().min(1),
  validation_state: ValidationStateSchema,
  output_quality_note: z.string().nullable().optional(),
  blocker_note: z.string().nullable().optional(),
  dispute_note: z.string().nullable().optional(),
  confidence_adjustment: z.number().int().min(-30).max(30).default(0),
  human_notes: z.string().nullable().optional()
});

export const ClaimSchema = z.object({
  claim_id: z.string(),
  created_at: z.string().datetime(),
  submitted_by: z.string().min(1),
  claim_type: ClaimTypeSchema,
  target_type: ClaimTargetTypeSchema,
  target_id: z.string().min(1),
  statement: z.string().min(1),
  evidence_receipt_ids: z.array(z.string()),
  evidence_artifact_uris: z.array(z.string()),
  status: ClaimStatusSchema,
  confidence_score: z.number().min(0).max(100),
  validation_state: ValidationStateSchema,
  challenge_count: z.number().int().nonnegative(),
  support_count: z.number().int().nonnegative(),
  human_notes: z.array(z.string())
});

export const ClaimChallengeSchema = z.object({
  challenge_id: z.string(),
  claim_id: z.string().min(1),
  created_at: z.string().datetime(),
  challenged_by: z.string().min(1),
  reason: z.string().min(1),
  evidence_receipt_ids: z.array(z.string()),
  evidence_artifact_uris: z.array(z.string()),
  status: z.enum(['submitted', 'under_review', 'resolved', 'rejected']),
  human_notes: z.array(z.string())
});

export const ClaimCreateRequestSchema = z.object({
  submitted_by: z.string().min(1),
  claim_type: ClaimTypeSchema,
  target_type: ClaimTargetTypeSchema,
  target_id: z.string().min(1),
  statement: z.string().min(1),
  evidence_receipt_ids: z.array(z.string()).default([]),
  evidence_artifact_uris: z.array(z.string()).default([]),
  status: ClaimStatusSchema.default('submitted'),
  confidence_score: z.number().min(0).max(100).default(50),
  validation_state: ValidationStateSchema.default('unvalidated'),
  support_count: z.number().int().nonnegative().default(0),
  human_notes: z.array(z.string()).default([])
});

export const ClaimChallengeCreateRequestSchema = z.object({
  challenged_by: z.string().min(1),
  reason: z.string().min(1),
  evidence_receipt_ids: z.array(z.string()).default([]),
  evidence_artifact_uris: z.array(z.string()).default([]),
  status: z.enum(['submitted', 'under_review', 'resolved', 'rejected']).default('submitted'),
  human_notes: z.array(z.string()).default([])
});

export const ClaimDetailSchema = ClaimSchema.extend({
  challenges: z.array(ClaimChallengeSchema)
});

export const ProofCheckInputSchema = z.object({
  input: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  submittedBy: z.string().min(1).optional()
});

export const ProofCheckSchema = z.object({
  check_id: z.string(),
  created_at: z.string().datetime(),
  submitted_by: z.string().nullable(),
  source_url: z.string().url().nullable(),
  input: z.string(),
  claim: z.string(),
  claim_type: ProofClaimTypeSchema,
  claim_summary: z.string(),
  subject_label: z.string(),
  receipts_found: z.array(z.string()),
  evidence_artifacts: z.array(z.string()),
  evidence_strength: EvidenceStrengthSchema,
  receipt_strength: ReceiptStrengthSchema,
  validation_status: ProofValidationStatusSchema,
  risk_flags: z.array(ProofRiskFlagSchema),
  decision_state: ProofDecisionStateSchema,
  share_url: z.string(),
  share_text: z.string(),
  evidence_summary: z.string(),
  validation_summary: z.string(),
  decision_summary: z.string()
});

export const ProofCheckResultSchema = ProofCheckSchema.extend({
  headline: z.string(),
  public_cta: z.string()
});

export const LoopRunSchema = z.object({
  run_id: z.string(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  hypothesis: z.string(),
  action_taken: z.string(),
  evidence_artifacts: z.array(z.string()),
  score: z.number().min(0).max(100),
  failure_reason: z.string().nullable(),
  proof_state: LoopProofStateSchema,
  decision_state: ProofDecisionStateSchema,
  linked_check_id: z.string()
});

export const LoopSchema = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string(),
  hypothesis: z.string(),
  action_taken: z.string(),
  evidence_artifacts: z.array(z.string()),
  score: z.number().min(0).max(100),
  failure_reason: z.string().nullable(),
  proof_state: LoopProofStateSchema,
  decision_state: ProofDecisionStateSchema,
  linked_check_id: z.string()
});

export const LoopDetailSchema = LoopSchema.extend({
  runs: z.array(LoopRunSchema)
});

export const LoopCheckInputSchema = z.object({
  input: z.string().min(1),
  linked_check_id: z.string().optional()
});

export const SignalGraphClusterSchema = z.object({
  id: z.string(),
  label: z.string(),
  summary: z.string(),
  proof_state: SignalGraphProofStateSchema,
  ripple_summary: z.string(),
  node_count: z.number().int().nonnegative(),
  edge_count: z.number().int().nonnegative(),
  updated_at: z.string().datetime()
});

export const SignalGraphNodeSchema = z.object({
  id: z.string(),
  type: SignalNodeTypeSchema,
  label: z.string(),
  summary: z.string(),
  cluster_id: z.string(),
  proof_state: SignalGraphProofStateSchema,
  confidence_score: z.number().min(0).max(100),
  velocity_score: z.number().min(0).max(100),
  source_urls: z.array(z.string().url()).optional(),
  linked_receipt_ids: z.array(z.string()).optional(),
  linked_claim_ids: z.array(z.string()).optional(),
  linked_loop_ids: z.array(z.string()).optional(),
  linked_route_ids: z.array(z.string()).optional(),
  linked_provider_ids: z.array(z.string()).optional(),
  linked_service_ids: z.array(z.string()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const SignalGraphEdgeSchema = z.object({
  id: z.string(),
  source_node_id: z.string(),
  target_node_id: z.string(),
  type: SignalEdgeTypeSchema,
  strength: z.number().min(0).max(100),
  explanation: z.string()
});

export const SignalGraphRippleSchema = z.object({
  id: z.string(),
  cluster_id: z.string(),
  title: z.string(),
  summary: z.string(),
  proof_state: SignalGraphProofStateSchema,
  impact_score: z.number().min(0).max(100),
  changed_at: z.string().datetime(),
  linked_node_ids: z.array(z.string())
});

export const SignalGraphStatsSchema = z.object({
  node_count: z.number().int().nonnegative(),
  edge_count: z.number().int().nonnegative(),
  cluster_count: z.number().int().nonnegative(),
  validated_count: z.number().int().nonnegative(),
  disputed_count: z.number().int().nonnegative(),
  compounding_count: z.number().int().nonnegative(),
  last_updated_at: z.string().datetime()
});

export const SignalGraphEvidenceSchema = z.object({
  event_id: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  endpoint_id: z.string().nullable().optional(),
  observed_at: z.string().datetime().nullable().optional(),
  catalog_generated_at: z.string().datetime().nullable().optional(),
  ingested_at: z.string().datetime().nullable().optional(),
  source: z.string().nullable().optional(),
  derivation_reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: SeveritySchema.optional(),
  severity_reason: z.string().optional(),
  severity_score: z.number().optional(),
  severity_window: z.string().optional()
});

export const SignalGraphResponseSchema = z.object({
  tagline: z.string(),
  clusters: z.array(SignalGraphClusterSchema),
  nodes: z.array(SignalGraphNodeSchema),
  edges: z.array(SignalGraphEdgeSchema),
  ripples: z.array(SignalGraphRippleSchema),
  stats: SignalGraphStatsSchema,
  evidence: SignalGraphEvidenceSchema.nullable().optional()
});

export const SignalGraphClusterDetailSchema = z.object({
  cluster: SignalGraphClusterSchema,
  nodes: z.array(SignalGraphNodeSchema),
  edges: z.array(SignalGraphEdgeSchema),
  ripples: z.array(SignalGraphRippleSchema)
});

export const SignalGraphNodeDetailSchema = z.object({
  node: SignalGraphNodeSchema,
  cluster: SignalGraphClusterSchema,
  connected_edges: z.array(SignalGraphEdgeSchema),
  related_nodes: z.array(SignalGraphNodeSchema),
  ripples: z.array(SignalGraphRippleSchema)
});

export const SignalGraphCheckInputSchema = z.object({
  label: z.string().min(1),
  summary: z.string().min(1).optional(),
  source_url: z.string().url().optional(),
  cluster_id: z.string().min(1).optional()
});

export const SignalGraphEntityTypeSchema = z.enum([
  'receipt',
  'claim',
  'loop',
  'route',
  'provider',
  'service'
]);

export const SignalGraphSuggestedEdgeSchema = z.object({
  target_node_id: z.string(),
  type: SignalEdgeTypeSchema,
  strength: z.number().min(0).max(100),
  explanation: z.string()
});

export const SignalGraphCheckResponseSchema = z.object({
  generated_node_preview: SignalGraphNodeSchema,
  suggested_proof_state: SignalGraphProofStateSchema,
  confidence_score: z.number().min(0).max(100),
  suggested_edges: z.array(SignalGraphSuggestedEdgeSchema),
  explanation: z.string()
});

export const SignalGraphEntityLookupResponseSchema = z.object({
  entity_type: SignalGraphEntityTypeSchema,
  entity_id: z.string().min(1),
  nodes: z.array(SignalGraphNodeSchema)
});

export const RouteTrustSummarySchema = z.object({
  receipt_freshness: z.string(),
  successful_receipt_count: z.number().int().nonnegative(),
  failure_patterns: z.array(z.string()),
  blocker_severity: z.enum(['none', 'low', 'medium', 'high']),
  provider_reliability: z.string(),
  human_validation: z.string(),
  summary: z.string()
});

export const ProviderTrustProfileSchema = z.object({
  safe_for_first_attempt: z.boolean(),
  better_for_repeatable_routes: z.boolean(),
  requires_human_approval: z.boolean(),
  not_recommended: z.boolean(),
  summary: z.string()
});

export const ServiceDecisionMapSchema = z.object({
  best_observed_route: z.string().nullable(),
  cheapest_route: z.string().nullable(),
  safest_first_attempt: z.string().nullable(),
  fastest_repeatable_route: z.string().nullable(),
  summary: z.string()
});

export const ReceiptImpactSchema = z.object({
  improves_route_confidence: z.boolean(),
  reduces_route_confidence: z.boolean(),
  freshness: z.enum(['fresh', 'stale']),
  human_validated: z.boolean(),
  should_affect_future_pre_spend_decisions: z.boolean(),
  summary: z.string()
});

export const RouteIntelligenceDetailSchema = z.object({
  route: RouteIntelligenceSchema,
  provider: ProviderIntelligenceRecordSchema.nullable(),
  service: ServiceDossierSchema.nullable(),
  receipts: z.array(PreSpendReceiptSchema),
  metrics: PreSpendMetricsSchema,
  validation_state: ValidationStateSchema.nullable(),
  decision_implications: z.array(z.string()),
  trust_summary: RouteTrustSummarySchema.nullable()
});

export const ProviderIntelligenceDetailSchema = z.object({
  provider: ProviderIntelligenceRecordSchema,
  routes: z.array(RouteIntelligenceSchema),
  services: z.array(ServiceDossierSchema),
  receipts: z.array(PreSpendReceiptSchema),
  metrics: PreSpendMetricsSchema,
  provider_level_warnings: z.array(z.string()),
  trust_profile: ProviderTrustProfileSchema
});

export const PreSpendProviderSummarySchema = ProviderIntelligenceRecordSchema.extend({
  linked_routes: z.array(z.string()),
  linked_receipts: z.array(z.string()),
  trust_profile: ProviderTrustProfileSchema
});

export const PreSpendProviderListResponseSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.string(),
  metrics: PreSpendMetricsSchema,
  providers: z.array(PreSpendProviderSummarySchema)
});

export const ServiceDossierDetailSchema = z.object({
  service: ServiceDossierSchema,
  routes: z.array(RouteIntelligenceSchema),
  receipts: z.array(PreSpendReceiptSchema),
  metrics: PreSpendMetricsSchema,
  best_route_decision_map: ServiceDecisionMapSchema
});

export const PreSpendReceiptDetailSchema = PreSpendReceiptSchema.extend({
  route: RouteIntelligenceSchema.nullable(),
  provider: ProviderIntelligenceRecordSchema.nullable(),
  service: ServiceDossierSchema.nullable(),
  impact: ReceiptImpactSchema
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

export const RadarBenchmarkRouteSummarySchema = z.object({
  provider_id: z.string(),
  route_id: z.string(),
  latency_summary: z.object({
    latest_latency_ms: z.number().int().positive().nullable(),
    median_latency_ms: z.number().int().positive().nullable(),
    p95_latency_ms: z.number().int().positive().nullable()
  }),
  reliability_summary: z.object({
    success_rate: z.number().min(0).max(1).nullable(),
    completed_runs: z.number().int().nonnegative().nullable(),
    failed_runs: z.number().int().nonnegative().nullable()
  })
});

export const RadarBenchmarkHistorySchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  benchmark_id: z.string(),
  entries: z.array(BenchmarkHistoryEntrySchema),
  first_recorded_at: z.string().datetime().optional(),
  latest_recorded_at: z.string().datetime().optional(),
  artifact_count: z.number().int().nonnegative().optional(),
  latest_artifact_id: z.string().optional(),
  total_recorded_runs: z.number().int().nonnegative().optional(),
  routes_count: z.number().int().nonnegative().optional(),
  winner_status: RadarBenchmarkWinnerStatusSchema.optional(),
  winner_claimed: z.boolean().optional(),
  route_summaries: z.array(RadarBenchmarkRouteSummarySchema).optional()
});

export const RadarBenchmarkHistoryAggregateSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  benchmarks: z.array(z.object({
    benchmark_id: z.string(),
    first_recorded_at: z.string().datetime(),
    latest_recorded_at: z.string().datetime(),
    artifact_count: z.number().int().nonnegative(),
    latest_artifact_id: z.string(),
    total_recorded_runs: z.number().int().nonnegative(),
    routes_count: z.number().int().nonnegative(),
    winner_status: RadarBenchmarkWinnerStatusSchema,
    winner_claimed: z.boolean(),
    route_summaries: z.array(RadarBenchmarkRouteSummarySchema)
  }))
});

export const RadarBenchmarkHistoryV2ArtifactSchema = z.object({
  artifact_id: z.string(),
  recorded_at: z.string().datetime(),
  recorded_runs: z.number().int().nonnegative(),
  routes_count: z.number().int().nonnegative(),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  winner_claimed: z.boolean()
});

export const RadarBenchmarkHistoryV2RowSchema = z.object({
  benchmark_id: z.string(),
  label: z.string(),
  status: z.enum(['recorded', 'planned']),
  first_recorded_at: z.string().datetime().nullable(),
  latest_recorded_at: z.string().datetime().nullable(),
  artifact_count: z.number().int().nonnegative(),
  latest_artifact_id: z.string().nullable(),
  total_recorded_runs: z.number().int().nonnegative(),
  routes_count: z.number().int().nonnegative(),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  winner_claimed: z.boolean()
});

export const RadarBenchmarkHistoryV2AggregateSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  history_count: z.number().int().nonnegative(),
  total_artifacts: z.number().int().nonnegative(),
  total_recorded_runs: z.number().int().nonnegative(),
  winner_claimed: z.boolean(),
  benchmarks: z.array(RadarBenchmarkHistoryV2RowSchema)
});

export const RadarBenchmarkHistoryV2DetailSchema = z.object({
  benchmark_id: z.string(),
  label: z.string(),
  status: z.enum(['recorded', 'planned']),
  first_recorded_at: z.string().datetime().nullable(),
  latest_recorded_at: z.string().datetime().nullable(),
  artifact_count: z.number().int().nonnegative(),
  artifacts: z.array(RadarBenchmarkHistoryV2ArtifactSchema),
  total_recorded_runs: z.number().int().nonnegative(),
  routes_count: z.number().int().nonnegative(),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  winner_claimed: z.boolean()
});

export const RadarEvidenceCaveatCodeSchema = z.enum([
  'status_code_unavailable',
  'pay_cli_status_hidden',
  'canonical_network_mismatch',
  'canonical_address_mismatch',
  'canonical_decimals_mismatch',
  'metadata_semantics_partial',
  'non_metadata_payload',
  'price_only_response',
  'pool_only_response',
  'search_only_response',
  'balance_only_response',
  'allowance_only_response',
  'route_not_found',
  'payment_required_confirmed_only',
  'paid_payload_unobserved'
]);

export const RadarEvidenceCaveatSchema = z.object({
  code: RadarEvidenceCaveatCodeSchema,
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  evidence_field: z.string().nullable(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()])
});

export const RadarEvidenceHealthSchema = z.enum([
  'recorded',
  'caveated',
  'stale',
  'degraded',
  'unverified',
  'scaffold'
]);

export const RadarBenchmarkRouteHistorySummarySchema = z.object({
  route_id: z.string(),
  provider_id: z.string(),
  label: z.string(),
  artifact_count: z.number().int().nonnegative(),
  first_recorded_at: z.string().datetime(),
  latest_recorded_at: z.string().datetime(),
  latest_artifact_id: z.string(),
  latest_success_count: z.number().int().nonnegative().nullable(),
  latest_failure_count: z.number().int().nonnegative().nullable(),
  latest_median_latency_ms: z.number().int().positive().nullable(),
  latest_p95_latency_ms: z.number().int().positive().nullable(),
  latest_detection_rate: z.number().min(0).max(1).nullable(),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  winner_claimed: z.boolean(),
  evidence_health: RadarEvidenceHealthSchema,
  caveats: z.array(z.string()),
  caveat_objects: z.array(RadarEvidenceCaveatSchema)
});

export const RadarBenchmarkRouteHistoryAggregateSchema = z.object({
  benchmark_id: z.string(),
  label: z.string(),
  route_count: z.number().int().nonnegative(),
  artifact_count: z.number().int().nonnegative(),
  winner_claimed: z.boolean(),
  routes: z.array(RadarBenchmarkRouteHistorySummarySchema)
});

export const RadarBenchmarkRouteHistoryTimelineEntrySchema = z.object({
  artifact_id: z.string(),
  recorded_at: z.string().datetime(),
  success_count: z.number().int().nonnegative().nullable(),
  failure_count: z.number().int().nonnegative().nullable(),
  median_latency_ms: z.number().int().positive().nullable(),
  p95_latency_ms: z.number().int().positive().nullable(),
  status_code: z.number().int().nullable(),
  status_evidence: z.string(),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  winner_claimed: z.boolean(),
  evidence_health: RadarEvidenceHealthSchema,
  metrics: z.record(z.string(), z.number().nullable()),
  caveats: z.array(z.string()),
  caveat_objects: z.array(RadarEvidenceCaveatSchema)
});

export const RadarBenchmarkRouteHistoryDetailSchema = z.object({
  benchmark_id: z.string(),
  route_id: z.string(),
  provider_id: z.string(),
  label: z.string(),
  artifact_count: z.number().int().nonnegative(),
  winner_claimed: z.boolean(),
  evidence_health: RadarEvidenceHealthSchema,
  timeline: z.array(RadarBenchmarkRouteHistoryTimelineEntrySchema)
});

export const RadarBenchmarkListSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  benchmarks: z.array(RadarBenchmarkDetailSchema)
});

export const RadarBenchmarkSummaryRowSchema = z.object({
  benchmark_id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: z.literal('recorded'),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  winner_claimed: z.boolean(),
  routes_count: z.number().int().nonnegative(),
  recorded_runs: z.number().int().nonnegative()
});

export const RadarBenchmarkSummarySchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  latest_recorded_at: z.string().datetime().nullable(),
  total_artifacts: z.number().int().nonnegative(),
  recorded_benchmarks: z.number().int().nonnegative(),
  total_benchmarks: z.number().int().nonnegative(),
  winner_claimed: z.boolean(),
  total_recorded_runs: z.number().int().nonnegative(),
  proven_routes: z.number().int().nonnegative(),
  benchmarks: z.array(RadarBenchmarkSummaryRowSchema),
  agent_guidance: z.array(z.string())
});

export const RadarEvidenceLedgerRecordedLaneSchema = z.object({
  benchmark_id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: z.literal('recorded'),
  artifact_count: z.number().int().nonnegative(),
  recorded_runs: z.number().int().nonnegative(),
  routes_count: z.number().int().nonnegative(),
  proven_routes_count: z.number().int().nonnegative().optional(),
  winner_status: RadarBenchmarkWinnerStatusSchema,
  winner_claimed: z.boolean(),
  latest_artifact_id: z.string().nullable(),
  latest_recorded_at: z.string().datetime().nullable(),
  evidence_health_summary: z.object({
    recorded: z.number().int().nonnegative(),
    caveated: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative(),
    degraded: z.number().int().nonnegative(),
    unverified: z.number().int().nonnegative(),
    scaffold: z.number().int().nonnegative()
  }).optional(),
  routes_endpoint: z.string()
});

export const RadarEvidenceLedgerScaffoldLaneSchema = z.object({
  benchmark_id: z.string(),
  label: z.string(),
  status: z.literal('scaffold'),
  promotion_status: z.enum(['blocked', 'pending']),
  why_not_promoted: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  known_evidence: z.array(z.string()).optional()
});

export const RadarEvidenceLedgerLatestArtifactSchema = z.object({
  artifact_id: z.string(),
  benchmark_id: z.string(),
  label: z.string(),
  recorded_at: z.string().datetime(),
  recorded_runs: z.number().int().nonnegative(),
  routes_count: z.number().int().nonnegative(),
  winner_claimed: z.boolean(),
  winner_status: RadarBenchmarkWinnerStatusSchema
});

export const RadarEvidenceLedgerRouteEntrypointSchema = z.object({
  benchmark_id: z.string(),
  routes_endpoint: z.string(),
  route_detail_note: z.string()
});

export const RadarEvidenceLedgerBriefRecordedLaneSchema = z.object({
  benchmark_id: z.string(),
  label: z.string(),
  latest_artifact_id: z.string().nullable(),
  latest_artifact_recorded_runs: z.number().int().nonnegative(),
  total_recorded_runs: z.number().int().nonnegative(),
  recorded_runs: z.number().int().nonnegative(),
  routes_count: z.number().int().nonnegative(),
  winner_claimed: z.boolean(),
  winner_status: RadarBenchmarkWinnerStatusSchema
});

export const RadarEvidenceLedgerBriefScaffoldLaneSchema = z.object({
  benchmark_id: z.string(),
  label: z.string(),
  reason: z.string(),
  next_step: z.string()
});

const RadarEvidenceLedgerStateSchema = z.object({
  recorded_benchmarks: z.number().int().nonnegative(),
  total_benchmarks: z.number().int().nonnegative(),
  total_artifacts: z.number().int().nonnegative(),
  total_recorded_runs: z.number().int().nonnegative(),
  proven_routes: z.number().int().nonnegative(),
  winner_claimed: z.boolean(),
  latest_recorded_at: z.string().datetime().nullable()
});

const RadarEvidenceLedgerBriefStateSchema = RadarEvidenceLedgerStateSchema.extend({
  scaffold_lanes: z.number().int().nonnegative()
});

export const RadarEvidenceLedgerSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  ledger_state: RadarEvidenceLedgerStateSchema,
  doctrine: z.object({
    spend_rail: z.literal('Pay.sh'),
    evidence_ledger: z.literal('Radar'),
    proof_adapter: z.literal('Agent Harness'),
    summary: z.string()
  }),
  agent_guidance: z.array(z.string()),
  recorded_lanes: z.array(RadarEvidenceLedgerRecordedLaneSchema),
  scaffold_lanes: z.array(RadarEvidenceLedgerScaffoldLaneSchema),
  latest_artifacts: z.array(RadarEvidenceLedgerLatestArtifactSchema),
  route_timeline_entrypoints: z.array(RadarEvidenceLedgerRouteEntrypointSchema),
  caveat_summary: z.object({
    policy: z.string(),
    common_codes: z.array(z.string())
  })
});

export const RadarEvidenceLedgerBriefSchema = z.object({
  ledger_state: RadarEvidenceLedgerBriefStateSchema,
  recorded_lanes: z.array(RadarEvidenceLedgerBriefRecordedLaneSchema),
  scaffold_lanes: z.array(RadarEvidenceLedgerBriefScaffoldLaneSchema),
  recommended_agent_action: z.string(),
  agent_guidance: z.array(z.string()),
  winner_claimed: z.boolean()
});

export const AgentSpendReadinessStateSchema = z.enum([
  'recorded_evidence',
  'caveated_evidence',
  'controlled_run_observed',
  'scaffold_only',
  'catalog_only',
  'blocked_or_unclear'
]);

export const AgentSpendReadinessSchema = z.enum([
  'ready_for_inspection',
  'needs_review',
  'not_ready'
]);

export const BundleRunAgentReadinessSummarySchema = z.object({
  ready_for_agent_review: z.boolean(),
  requires_rerun_before_spend: z.boolean(),
  requires_human_or_policy_approval: z.boolean(),
  observed_cost_available: z.boolean(),
  winner_claimed: z.literal(false),
  decision_state: z.enum(['ready_for_review', 'review_ready_caveated', 'rerun_required', 'not_ready']),
  blocking_reasons: z.array(z.enum(['freshness_stale', 'winner_claimed_true'])),
  review_reasons: z.array(z.enum(['billing_unclear_steps_skipped', 'observed_cost_unavailable', 'status_code_unavailable', 'source_map_empty'])),
  recommended_agent_action: z.string()
});

export const AgentSpendReadinessCardSchema = z.object({
  provider_id: z.string(),
  provider_label: z.string(),
  readiness_state: AgentSpendReadinessStateSchema,
  agent_spend_readiness: AgentSpendReadinessSchema,
  evidence_summary: z.object({
    recorded_benchmarks: z.number().int().nonnegative(),
    proven_routes: z.number().int().nonnegative(),
    controlled_bundle_runs: z.number().int().nonnegative(),
    scaffold_lanes: z.number().int().nonnegative(),
    caveat_count: z.number().int().nonnegative(),
    latest_artifact_id: z.string().nullable(),
    latest_observed_at: z.string().datetime().nullable()
  }),
  proof_links: z.object({
    benchmark_history: z.array(z.string()),
    route_timelines: z.array(z.string()),
    bundle_runs: z.array(z.string())
  }),
  builder_next_step: z.string(),
  agent_guidance: z.string(),
  what_this_means: z.string().min(1),
  winner_claimed: z.literal(false),
  agent_readiness_summary: BundleRunAgentReadinessSummarySchema.optional(),
  share_copy: z.string()
});

export const AgentSpendReadinessListSchema = z.object({
  count: z.number().int().nonnegative(),
  generated_at: z.string().datetime(),
  cards: z.array(AgentSpendReadinessCardSchema),
  winner_claimed: z.literal(false),
  agent_guidance: z.array(z.string())
});

export const RadarBundleStatusSchema = z.enum([
  'recipe_scaffold',
  'partially_supported',
  'research_only_pending_billing_review',
  'execution_ready',
  'recorded'
]);

export const RadarBundleExecutionBoundarySchema = z.enum([
  'clean_402',
  'paid_proven',
  'billing_unclear',
  'billable_probe_observed',
  'blocked'
]);

export const RadarBundleStepEvidenceHealthSchema = z.enum(['recorded', 'caveated', 'scaffold']);

export const RadarBundleStepSchema = z.object({
  step_id: z.string(),
  label: z.string(),
  intent: z.string(),
  candidate_routes: z.array(z.string()),
  evidence_dependencies: z.array(z.string()),
  evidence_health: RadarBundleStepEvidenceHealthSchema,
  execution_boundary: RadarBundleExecutionBoundarySchema,
  known_caveats: z.array(z.string())
});

export const RadarBundleEvidenceReferenceSchema = z.object({
  benchmark_id: z.string(),
  lane_status: z.enum(['recorded', 'scaffold', 'unknown'])
});

export const RadarBundleSchema = z.object({
  bundle_id: z.string(),
  label: z.string(),
  status: RadarBundleStatusSchema,
  summary: z.string(),
  input_schema: z.record(z.string(), z.unknown()),
  output_shape: z.record(z.string(), z.unknown()),
  steps: z.array(RadarBundleStepSchema),
  evidence_dependencies: z.array(z.string()),
  evidence_references: z.array(RadarBundleEvidenceReferenceSchema),
  estimated_cost_usd: z.string(),
  known_caveats: z.array(z.string()),
  winner_claimed: z.boolean(),
  recommended_agent_action: z.string()
});

export const RadarBundleListSchema = z.object({
  generated_at: z.string().datetime(),
  source: z.literal('infopunks-pay-sh-radar'),
  count: z.number().int().nonnegative(),
  bundles: z.array(RadarBundleSchema)
});

export const RadarBundlePlanConstraintsSchema = z.object({
  max_cost_usd: z.number().nonnegative().nullable().optional(),
  allow_billing_unclear: z.boolean().optional(),
  allow_billable_probe_observed: z.boolean().optional(),
  allow_scaffold_routes: z.boolean().optional(),
  require_recorded_evidence: z.boolean().optional()
});

export const RadarBundlePlanRequestSchema = z.object({
  topic: z.string(),
  focus: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  constraints: RadarBundlePlanConstraintsSchema.optional()
});

export const RadarBundlePlanStepStatusSchema = z.enum(['included', 'blocked', 'review_required']);

export const RadarBundlePlanBlockedReasonSchema = z.enum([
  'billing_unclear_not_allowed',
  'scaffold_not_allowed',
  'billable_probe_observed_not_allowed',
  'missing_recorded_evidence'
]);

export const RadarBundlePlanStepSchema = z.object({
  step_id: z.string(),
  label: z.string(),
  intent: z.string(),
  plan_status: RadarBundlePlanStepStatusSchema,
  evidence_dependencies: z.array(z.string()),
  evidence_health: RadarBundleStepEvidenceHealthSchema,
  execution_boundary: RadarBundleExecutionBoundarySchema,
  reason: z.string(),
  next_action: z.string()
});

export const RadarBundlePlanBlockedStepSchema = z.object({
  step_id: z.string(),
  reason: RadarBundlePlanBlockedReasonSchema
});

export const RadarBundlePlanResponseSchema = z.object({
  bundle_id: z.string(),
  label: z.string(),
  status: RadarBundleStatusSchema,
  topic: z.string(),
  focus: z.string().nullable(),
  region: z.string().nullable(),
  language: z.string().nullable(),
  constraints: z.object({
    max_cost_usd: z.number().nonnegative().nullable(),
    allow_billing_unclear: z.boolean(),
    allow_billable_probe_observed: z.boolean(),
    allow_scaffold_routes: z.boolean(),
    require_recorded_evidence: z.boolean()
  }),
  route_plan: z.array(RadarBundlePlanStepSchema),
  blocked_steps: z.array(RadarBundlePlanBlockedStepSchema),
  execution_boundary_summary: z.object({
    clean_402: z.number().int().nonnegative(),
    paid_proven: z.number().int().nonnegative(),
    billing_unclear: z.number().int().nonnegative(),
    billable_probe_observed: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative()
  }),
  evidence_summary: z.object({
    recorded: z.number().int().nonnegative(),
    caveated: z.number().int().nonnegative(),
    scaffold: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative()
  }),
  estimated_cost_usd: z.string(),
  recommended_agent_action: z.string(),
  winner_claimed: z.literal(false)
});

export const BundleRunStatusSchema = z.enum(['controlled_live_run']);

export const BundleRunExecutionModeSchema = z.enum(['pay_cli']);

export const BundleRunFinalStateSchema = z.enum(['executed_with_review_required_skipped']);

export const BundleRunStepExecutionSchema = z.object({
  step_id: z.string(),
  execution_boundary: RadarBundleExecutionBoundarySchema,
  success: z.boolean(),
  status_code: z.number().int().nullable(),
  status_evidence: z.string(),
  observed_cost_usd: z.number().nonnegative().nullable(),
  normalized_output_preview: z.record(z.string(), z.unknown()),
  source_count: z.number().int().nonnegative()
});

export const BundleRunSkippedStepSchema = z.object({
  step_id: z.string(),
  plan_status: z.literal('review_required'),
  execution_boundary: RadarBundleExecutionBoundarySchema,
  reason: z.string()
});

export const BundleRunBlockedStepSchema = z.object({
  step_id: z.string(),
  plan_status: z.literal('blocked').optional(),
  execution_boundary: RadarBundleExecutionBoundarySchema.optional(),
  reason: z.string()
});

export const BundleRunSourceMapItemSchema = z.object({
  label: z.string(),
  url: z.string().url()
});

export const BundleRunCaveatObjectSchema = z.object({
  code: z.enum(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty']),
  severity: z.enum(['warning']),
  affects_core_semantics: z.boolean(),
  detail: z.string()
});

export const BundleRunSummarySchema = z.object({
  run_id: z.string(),
  status: BundleRunStatusSchema,
  evidence_health: z.literal('caveated'),
  generated_at: z.string().datetime(),
  execution_mode: BundleRunExecutionModeSchema,
  final_bundle_state: BundleRunFinalStateSchema,
  estimated_cost_usd: z.string(),
  observed_cost_usd: z.number().nonnegative().nullable(),
  executed_step_count: z.number().int().nonnegative(),
  skipped_step_count: z.number().int().nonnegative(),
  blocked_step_count: z.number().int().nonnegative(),
  source_count: z.number().int().nonnegative(),
  winner_claimed: z.literal(false)
});

export const BundleRunHistorySummarySchema = z.object({
  history_count: z.number().int().nonnegative(),
  latest_run_id: z.string().nullable(),
  previous_run_id: z.string().nullable(),
  source_count_delta: z.number().int(),
  latest_source_count: z.number().int().nonnegative(),
  previous_source_count: z.number().int().nonnegative(),
  observed_cost_available: z.boolean(),
  observed_cost_state: z.enum(['available', 'unavailable']),
  skipped_review_required_steps_stable: z.boolean(),
  latest_skipped_step_count: z.number().int().nonnegative(),
  previous_skipped_step_count: z.number().int().nonnegative(),
  caveat_codes_latest: z.array(z.enum(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'])),
  caveat_codes_previous: z.array(z.enum(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'])),
  caveat_delta: z.object({
    added: z.array(z.enum(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty'])),
    removed: z.array(z.enum(['status_code_unavailable', 'observed_cost_unavailable', 'source_map_empty']))
  }),
  winner_claimed: z.literal(false)
});

export const BundleRunFreshnessSchema = z.object({
  last_controlled_run_at: z.string().datetime(),
  latest_run_age_hours: z.number().nonnegative(),
  freshness_state: z.enum(['fresh', 'aging', 'stale']),
  freshness_thresholds_hours: z.object({
    fresh_until: z.literal(24),
    aging_until: z.literal(72)
  }),
  recommended_agent_action: z.string()
}).nullable();

export const BundleRunDetailSchema = z.object({
  run_id: z.string(),
  bundle_id: z.literal('morning-briefing'),
  status: BundleRunStatusSchema,
  evidence_health: z.literal('caveated'),
  winner_claimed: z.literal(false),
  generated_at: z.string().datetime(),
  execution_mode: BundleRunExecutionModeSchema,
  live_execution_enabled: z.literal(true),
  final_bundle_state: BundleRunFinalStateSchema,
  estimated_cost_usd: z.string(),
  observed_cost_usd: z.number().nonnegative().nullable(),
  radar_plan_endpoint: z.string().url(),
  canonical_request: z.object({
    topic: z.string(),
    constraints: z.object({
      max_cost_usd: z.number().nonnegative(),
      allow_billing_unclear: z.boolean(),
      allow_scaffold_routes: z.boolean()
    })
  }),
  route_plan_summary: z.object({
    total: z.number().int().nonnegative(),
    included: z.number().int().nonnegative(),
    review_required: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    clean_402: z.number().int().nonnegative(),
    paid_proven: z.number().int().nonnegative(),
    billing_unclear: z.number().int().nonnegative(),
    billable_probe_observed: z.number().int().nonnegative()
  }),
  executed_steps: z.array(BundleRunStepExecutionSchema),
  skipped_steps: z.array(BundleRunSkippedStepSchema),
  blocked_steps: z.array(BundleRunBlockedStepSchema),
  source_map: z.array(BundleRunSourceMapItemSchema),
  caveat_objects: z.array(BundleRunCaveatObjectSchema),
  recommended_next_action: z.string()
});

export const BundleRunListResponseSchema = z.object({
  bundle_id: z.literal('morning-briefing'),
  count: z.number().int().nonnegative(),
  latest_run_id: z.string().nullable(),
  latest_generated_at: z.string().datetime().nullable(),
  runs: z.array(BundleRunSummarySchema),
  history_summary: BundleRunHistorySummarySchema,
  freshness: BundleRunFreshnessSchema,
  winner_claimed: z.literal(false),
  agent_readiness_summary: BundleRunAgentReadinessSummarySchema,
  agent_guidance: z.array(z.string())
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
export type NarrativeDecisionState = z.infer<typeof NarrativeDecisionStateSchema>;
export type NarrativeEvidenceArtifact = z.infer<typeof NarrativeEvidenceArtifactSchema>;
export type NarrativeRelatedRoute = z.infer<typeof NarrativeRelatedRouteSchema>;
export type NarrativeAsset = z.infer<typeof NarrativeAssetSchema>;
export type NarrativeSignalSurfaceType = z.infer<typeof NarrativeSignalSurfaceTypeSchema>;
export type NarrativeSignalCard = z.infer<typeof NarrativeSignalCardSchema>;
export type NarrativeSignalSection = z.infer<typeof NarrativeSignalSectionSchema>;
export type NarrativeSignalSurface = z.infer<typeof NarrativeSignalSurfaceSchema>;
export type SignalEvidenceUpdateType = z.infer<typeof SignalEvidenceUpdateTypeSchema>;
export type SignalEvidenceUpdate = z.infer<typeof SignalEvidenceUpdateSchema>;
export type SignalDeskStatus = z.infer<typeof SignalDeskStatusSchema>;
export type SignalRiskFacet = z.infer<typeof SignalRiskFacetSchema>;
export type CandidateSignalCategory = z.infer<typeof CandidateSignalCategorySchema>;
export type CandidateSignalSubmittedBy = z.infer<typeof CandidateSignalSubmittedBySchema>;
export type CandidateSignalStatus = z.infer<typeof CandidateSignalStatusSchema>;
export type CandidateSignalPriority = z.infer<typeof CandidateSignalPrioritySchema>;
export type CandidateSignalRiskLevel = z.infer<typeof CandidateSignalRiskLevelSchema>;
export type CandidateSignal = z.infer<typeof CandidateSignalSchema>;
export type SignalDeskActivityType = z.infer<typeof SignalDeskActivityTypeSchema>;
export type SignalDeskReportCard = z.infer<typeof SignalDeskReportCardSchema>;
export type SignalDeskDispatchCard = z.infer<typeof SignalDeskDispatchCardSchema>;
export type SignalDeskActivityItem = z.infer<typeof SignalDeskActivityItemSchema>;
export type SignalDeskIndex = z.infer<typeof SignalDeskIndexSchema>;
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
export type RadarBenchmarkHistoryAggregate = z.infer<typeof RadarBenchmarkHistoryAggregateSchema>;
export type RadarBenchmarkHistoryV2Row = z.infer<typeof RadarBenchmarkHistoryV2RowSchema>;
export type RadarBenchmarkHistoryV2Aggregate = z.infer<typeof RadarBenchmarkHistoryV2AggregateSchema>;
export type RadarBenchmarkHistoryV2Detail = z.infer<typeof RadarBenchmarkHistoryV2DetailSchema>;
export type RadarBenchmarkRouteHistoryAggregate = z.infer<typeof RadarBenchmarkRouteHistoryAggregateSchema>;
export type RadarBenchmarkRouteHistoryDetail = z.infer<typeof RadarBenchmarkRouteHistoryDetailSchema>;
export type RadarEvidenceCaveat = z.infer<typeof RadarEvidenceCaveatSchema>;
export type RadarBenchmarkList = z.infer<typeof RadarBenchmarkListSchema>;
export type RadarBenchmarkSummary = z.infer<typeof RadarBenchmarkSummarySchema>;
export type RadarEvidenceLedger = z.infer<typeof RadarEvidenceLedgerSchema>;
export type RadarEvidenceLedgerBrief = z.infer<typeof RadarEvidenceLedgerBriefSchema>;
export type AgentSpendReadinessState = z.infer<typeof AgentSpendReadinessStateSchema>;
export type AgentSpendReadiness = z.infer<typeof AgentSpendReadinessSchema>;
export type AgentSpendReadinessCard = z.infer<typeof AgentSpendReadinessCardSchema>;
export type AgentSpendReadinessList = z.infer<typeof AgentSpendReadinessListSchema>;
export type RadarBenchmarkWinnerStatus = z.infer<typeof RadarBenchmarkWinnerStatusSchema>;
export type RadarBenchmarkArtifact = z.infer<typeof RadarBenchmarkArtifactSchema>;
export type RadarBenchmarkArtifactList = z.infer<typeof RadarBenchmarkArtifactListSchema>;
export type RadarRiskAnomaly = z.infer<typeof RadarRiskAnomalySchema>;
export type RadarRiskResponse = z.infer<typeof RadarRiskResponseSchema>;
export type RadarEcosystemRiskSummary = z.infer<typeof RadarEcosystemRiskSummarySchema>;
export type RadarBundleStatus = z.infer<typeof RadarBundleStatusSchema>;
export type RadarBundleExecutionBoundary = z.infer<typeof RadarBundleExecutionBoundarySchema>;
export type RadarBundleStepEvidenceHealth = z.infer<typeof RadarBundleStepEvidenceHealthSchema>;
export type RadarBundleStep = z.infer<typeof RadarBundleStepSchema>;
export type RadarBundleEvidenceReference = z.infer<typeof RadarBundleEvidenceReferenceSchema>;
export type RadarBundle = z.infer<typeof RadarBundleSchema>;
export type RadarBundleList = z.infer<typeof RadarBundleListSchema>;
export type RadarBundlePlanConstraints = z.infer<typeof RadarBundlePlanConstraintsSchema>;
export type RadarBundlePlanRequest = z.infer<typeof RadarBundlePlanRequestSchema>;
export type RadarBundlePlanStepStatus = z.infer<typeof RadarBundlePlanStepStatusSchema>;
export type RadarBundlePlanBlockedReason = z.infer<typeof RadarBundlePlanBlockedReasonSchema>;
export type RadarBundlePlanStep = z.infer<typeof RadarBundlePlanStepSchema>;
export type RadarBundlePlanBlockedStep = z.infer<typeof RadarBundlePlanBlockedStepSchema>;
export type RadarBundlePlanResponse = z.infer<typeof RadarBundlePlanResponseSchema>;
export type BundleRunStatus = z.infer<typeof BundleRunStatusSchema>;
export type BundleRunExecutionMode = z.infer<typeof BundleRunExecutionModeSchema>;
export type BundleRunFinalState = z.infer<typeof BundleRunFinalStateSchema>;
export type RadarBundleRunStepExecution = z.infer<typeof BundleRunStepExecutionSchema>;
export type RadarBundleRunSkippedStep = z.infer<typeof BundleRunSkippedStepSchema>;
export type RadarBundleRunBlockedStep = z.infer<typeof BundleRunBlockedStepSchema>;
export type RadarBundleRunSourceMapItem = z.infer<typeof BundleRunSourceMapItemSchema>;
export type RadarBundleRunCaveatObject = z.infer<typeof BundleRunCaveatObjectSchema>;
export type RadarBundleRunSummary = z.infer<typeof BundleRunSummarySchema>;
export type RadarBundleRunHistorySummary = z.infer<typeof BundleRunHistorySummarySchema>;
export type RadarBundleRunDetail = z.infer<typeof BundleRunDetailSchema>;
export type RadarBundleRunListResponse = z.infer<typeof BundleRunListResponseSchema>;
export type PreSpendReceipt = z.infer<typeof PreSpendReceiptSchema>;
export type PreSpendMetrics = z.infer<typeof PreSpendMetricsSchema>;
export type PreSpendCheckRequest = z.infer<typeof PreSpendCheckRequestSchema>;
export type PreSpendCheckResponse = z.infer<typeof PreSpendCheckResponseSchema>;
export type HumanValidationSubmission = z.infer<typeof HumanValidationSubmissionSchema>;
export type ClaimTargetType = z.infer<typeof ClaimTargetTypeSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type ClaimType = z.infer<typeof ClaimTypeSchema>;
export type ProofClaimType = z.infer<typeof ProofClaimTypeSchema>;
export type EvidenceStrength = z.infer<typeof EvidenceStrengthSchema>;
export type ReceiptStrength = z.infer<typeof ReceiptStrengthSchema>;
export type ProofValidationStatus = z.infer<typeof ProofValidationStatusSchema>;
export type ProofRiskFlag = z.infer<typeof ProofRiskFlagSchema>;
export type ProofDecisionState = z.infer<typeof ProofDecisionStateSchema>;
export type LoopProofState = z.infer<typeof LoopProofStateSchema>;
export type SignalNodeType = z.infer<typeof SignalNodeTypeSchema>;
export type SignalGraphProofState = z.infer<typeof SignalGraphProofStateSchema>;
export type SignalEdgeType = z.infer<typeof SignalEdgeTypeSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type ClaimChallenge = z.infer<typeof ClaimChallengeSchema>;
export type ClaimCreateRequest = z.infer<typeof ClaimCreateRequestSchema>;
export type ClaimChallengeCreateRequest = z.infer<typeof ClaimChallengeCreateRequestSchema>;
export type ClaimDetail = z.infer<typeof ClaimDetailSchema>;
export type ProofCheckInput = z.infer<typeof ProofCheckInputSchema>;
export type ProofCheck = z.infer<typeof ProofCheckSchema>;
export type ProofCheckResult = z.infer<typeof ProofCheckResultSchema>;
export type LoopRun = z.infer<typeof LoopRunSchema>;
export type Loop = z.infer<typeof LoopSchema>;
export type LoopDetail = z.infer<typeof LoopDetailSchema>;
export type LoopCheckInput = z.infer<typeof LoopCheckInputSchema>;
export type SignalGraphCluster = z.infer<typeof SignalGraphClusterSchema>;
export type SignalGraphNode = z.infer<typeof SignalGraphNodeSchema>;
export type SignalGraphEdge = z.infer<typeof SignalGraphEdgeSchema>;
export type SignalGraphRipple = z.infer<typeof SignalGraphRippleSchema>;
export type SignalGraphStats = z.infer<typeof SignalGraphStatsSchema>;
export type SignalGraphEvidence = z.infer<typeof SignalGraphEvidenceSchema>;
export type SignalGraphResponse = z.infer<typeof SignalGraphResponseSchema>;
export type SignalGraphClusterDetail = z.infer<typeof SignalGraphClusterDetailSchema>;
export type SignalGraphNodeDetail = z.infer<typeof SignalGraphNodeDetailSchema>;
export type SignalGraphCheckInput = z.infer<typeof SignalGraphCheckInputSchema>;
export type SignalGraphEntityType = z.infer<typeof SignalGraphEntityTypeSchema>;
export type SignalGraphSuggestedEdge = z.infer<typeof SignalGraphSuggestedEdgeSchema>;
export type SignalGraphCheckResponse = z.infer<typeof SignalGraphCheckResponseSchema>;
export type SignalGraphEntityLookupResponse = z.infer<typeof SignalGraphEntityLookupResponseSchema>;
export type RouteIntelligenceDetail = z.infer<typeof RouteIntelligenceDetailSchema>;
export type ProviderIntelligenceDetail = z.infer<typeof ProviderIntelligenceDetailSchema>;
export type PreSpendProviderSummary = z.infer<typeof PreSpendProviderSummarySchema>;
export type PreSpendProviderListResponse = z.infer<typeof PreSpendProviderListResponseSchema>;
export type ServiceDossierDetail = z.infer<typeof ServiceDossierDetailSchema>;
export type PreSpendReceiptDetail = z.infer<typeof PreSpendReceiptDetailSchema>;
