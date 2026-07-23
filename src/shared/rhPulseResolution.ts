import { z } from 'zod';
import {
  RH_PULSE_INDEPENDENCE_DISCLAIMER,
  RhPulseConfidenceSchema,
  RhPulseFreshnessSchema
} from './rhPulse';
import {
  RH_PULSE_CALL_METHODOLOGY_VERSION,
  RhPulseCallOutcomeSchema,
  RhPulseCommunityDistributionSchema,
  RhPulsePublicWindowSummarySchema
} from './rhPulseCalls';

export const RH_PULSE_RESOLUTION_METHODOLOGY_VERSION = RH_PULSE_CALL_METHODOLOGY_VERSION;
export const RH_PULSE_RESOLUTION_RECEIPT_VERSION = '1.0';
export const RH_PULSE_RESOLUTION_MANIFEST_VERSION = '1.0';
export const RH_PULSE_BASELINE_BEFORE_MS = 15 * 60_000;
export const RH_PULSE_BASELINE_AFTER_MS = 5 * 60_000;
export const RH_PULSE_CLOSING_BEFORE_MS = 5 * 60_000;
export const RH_PULSE_CLOSING_AFTER_MS = 15 * 60_000;
export const RH_PULSE_MIN_DIRECTIONAL_SCORE = 60;
export const RH_PULSE_MIN_DIRECTIONAL_LEAD = 5;
export const RH_PULSE_MIN_CROSS_LAYER_SCORE = 55;
export const RH_PULSE_RESOLUTION_WEIGHTS = {
  cross_layer: 0.4,
  market_activity: 0.35,
  narrative_momentum: 0.25
} as const;

export const RhPulseDirectionalOutcomeSchema = z.enum([
  'agents_to_rwas',
  'memes_to_agents',
  'memes_to_rwas'
]);

export const RhPulseResolutionStatusSchema = z.enum([
  'not_ready',
  'ready',
  'calculating',
  'blocked',
  'draft',
  'approved',
  'published',
  'cancelled'
]);

export const RhPulseCandidateQualificationSchema = z.enum([
  'qualified',
  'below_threshold',
  'insufficient_cross_layer_evidence',
  'insufficient_confidence',
  'blocked_by_source_health'
]);

export const RhPulseNormalizationMethodSchema = z.enum([
  'reviewed_overlap_index_v1',
  'activity_acceleration_index_v1',
  'filtered_narrative_index_v1'
]);

export const RhPulseNormalizedSourceClassificationSchema = z.enum([
  'reviewed_cross_layer',
  'reviewed_market_activity',
  'filtered_narrative'
]);

export const RhPulseNormalizedMetricSchema = z.object({
  metric_id: z.string().trim().min(1).max(160),
  value: z.number().min(0).max(100),
  scale: z.literal('normalized_0_100'),
  unit: z.literal('index_points'),
  normalization_method: RhPulseNormalizationMethodSchema,
  baseline_window: z.string().trim().min(1).max(240),
  source_classification: RhPulseNormalizedSourceClassificationSchema,
  observed_at: z.string().datetime(),
  methodology_version: z.literal(RH_PULSE_RESOLUTION_METHODOLOGY_VERSION)
}).strict();

export const RhPulseResolutionObservationSchema = z.object({
  observation_id: z.string().trim().min(1).max(160),
  observed_at: z.string().datetime(),
  normalized_metric: RhPulseNormalizedMetricSchema.nullable(),
  confidence: RhPulseConfidenceSchema,
  freshness: RhPulseFreshnessSchema,
  reviewed: z.boolean(),
  source_references: z.array(z.string().trim().min(1).max(240)).min(1).max(30),
  explanation: z.string().trim().min(1).max(1_000)
}).strict().superRefine((observation, context) => {
  if (
    observation.normalized_metric
    && observation.normalized_metric.observed_at !== observation.observed_at
  ) {
    context.addIssue({
      code: 'custom',
      path: ['normalized_metric', 'observed_at'],
      message: 'normalized_metric_timestamp_must_match_observation'
    });
  }
});

export const RhPulseResolutionComponentWindowSchema = z.object({
  baseline: RhPulseResolutionObservationSchema,
  closing: RhPulseResolutionObservationSchema
}).strict();

export const RhPulseResolutionCandidateInputSchema = z.object({
  outcome: RhPulseDirectionalOutcomeSchema,
  cross_layer: RhPulseResolutionComponentWindowSchema.extend({
    qualified_interaction_observed: z.boolean(),
    attributable_rwa_interaction: z.boolean()
  }).strict(),
  market_activity: RhPulseResolutionComponentWindowSchema,
  narrative_momentum: RhPulseResolutionComponentWindowSchema
}).strict();

export const RhPulseResolutionSourceHealthObservationSchema = z.object({
  source_id: z.string().trim().min(1).max(160),
  state: RhPulseFreshnessSchema,
  critical: z.boolean(),
  observed_at: z.string().datetime().nullable(),
  detail: z.string().trim().min(1).max(1_000)
}).strict();

export const RhPulseResolutionEvidenceClassificationSchema = z.object({
  classification_id: z.string().trim().min(1).max(160),
  status: z.enum(['approved', 'source_required', 'disputed', 'superseded']),
  layer: z.enum(['memes', 'agents', 'rwas', 'cross_layer']),
  effective_at: z.string().datetime(),
  source_reference: z.string().trim().min(1).max(240)
}).strict();

export const RhPulseResolutionInputManifestSchema = z.object({
  manifest_version: z.literal(RH_PULSE_RESOLUTION_MANIFEST_VERSION),
  window: z.object({
    id: z.string().trim().min(1).max(128),
    sequence_number: z.number().int().positive(),
    opens_at: z.string().datetime(),
    closes_at: z.string().datetime(),
    call_submission_closes_at: z.string().datetime()
  }).strict(),
  methodology_version: z.literal(RH_PULSE_RESOLUTION_METHODOLOGY_VERSION),
  candidates: z.array(RhPulseResolutionCandidateInputSchema).length(3),
  source_health: z.array(RhPulseResolutionSourceHealthObservationSchema).min(1).max(50),
  evidence_classifications: z.array(RhPulseResolutionEvidenceClassificationSchema).max(200),
  baseline_snapshot_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  closing_snapshot_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  connection_snapshot_ids: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  market_snapshot_ids: z.array(z.string().trim().min(1).max(160)).max(200),
  narrative_observation_ids: z.array(z.string().trim().min(1).max(160)).max(200),
  calculation_at: z.string().datetime()
}).strict().superRefine((manifest, context) => {
  const outcomes = manifest.candidates.map(({ outcome }) => outcome);
  for (const required of RhPulseDirectionalOutcomeSchema.options) {
    if (outcomes.filter((outcome) => outcome === required).length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['candidates'],
        message: `candidate_${required}_must_appear_exactly_once`
      });
    }
  }
});

export const RhPulseCandidateScoreSchema = z.object({
  outcome: RhPulseDirectionalOutcomeSchema,
  cross_layer_score: z.number().min(0).max(100).nullable(),
  market_activity_score: z.number().min(0).max(100).nullable(),
  narrative_momentum_score: z.number().min(0).max(100).nullable(),
  weighted_score: z.number().min(0).max(100).nullable(),
  qualification_status: RhPulseCandidateQualificationSchema,
  confidence: RhPulseConfidenceSchema,
  evidence_summary: z.array(z.string().trim().min(1).max(1_000)).max(20),
  limitations: z.array(z.string().trim().min(1).max(1_000)).max(20)
}).strict();

export const RhPulseResolutionCalculationSchema = z.object({
  state: z.enum(['resolved', 'unable_to_resolve']),
  proposed_outcome: RhPulseCallOutcomeSchema.nullable(),
  candidate_scores: z.array(RhPulseCandidateScoreSchema).length(3),
  confidence: RhPulseConfidenceSchema,
  evidence_summary: z.array(z.string().trim().min(1).max(1_000)).max(50),
  limitations: z.array(z.string().trim().min(1).max(1_000)).max(50),
  blocked_reason: z.string().trim().min(1).max(1_000).nullable(),
  outcome_explanation: z.string().trim().min(1).max(2_000)
}).strict().superRefine((calculation, context) => {
  if (calculation.state === 'unable_to_resolve' && calculation.proposed_outcome !== null) {
    context.addIssue({ code: 'custom', path: ['proposed_outcome'], message: 'blocked_resolution_has_no_outcome' });
  }
  if (calculation.state === 'resolved' && calculation.proposed_outcome === null) {
    context.addIssue({ code: 'custom', path: ['proposed_outcome'], message: 'resolved_calculation_requires_outcome' });
  }
});

export const RhPulseResolutionRunRecordSchema = z.object({
  id: z.string().trim().regex(/^rhp_resolution_[a-zA-Z0-9_-]{8,128}$/),
  window_id: z.string().trim().min(1).max(128),
  run_number: z.number().int().positive(),
  status: RhPulseResolutionStatusSchema,
  methodology_version: z.literal(RH_PULSE_RESOLUTION_METHODOLOGY_VERSION),
  input_manifest: RhPulseResolutionInputManifestSchema,
  input_manifest_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  candidate_scores: z.array(RhPulseCandidateScoreSchema).length(3),
  proposed_outcome: RhPulseCallOutcomeSchema.nullable(),
  confidence: RhPulseConfidenceSchema,
  evidence_summary: z.array(z.string().trim().min(1).max(1_000)).max(50),
  limitations: z.array(z.string().trim().min(1).max(1_000)).max(50),
  blocked_reason: z.string().trim().min(1).max(1_000).nullable(),
  outcome_explanation: z.string().trim().min(1).max(2_000),
  created_at: z.string().datetime(),
  calculated_at: z.string().datetime(),
  approved_at: z.string().datetime().nullable(),
  approved_by: z.string().trim().min(1).max(160).nullable(),
  cancelled_at: z.string().datetime().nullable()
}).strict();

export const RhPulseResolutionCommunityAccuracySchema = z.object({
  total_verified_calls: z.number().int().nonnegative(),
  correct_calls: z.number().int().nonnegative(),
  incorrect_calls: z.number().int().nonnegative(),
  correct_percentage: z.number().min(0).max(100),
  distribution: RhPulseCommunityDistributionSchema
}).strict();

export const RhPulseRotationReceiptPayloadSchema = z.object({
  receipt_type: z.literal('rh_pulse_rotation'),
  receipt_version: z.literal(RH_PULSE_RESOLUTION_RECEIPT_VERSION),
  window: z.object({
    id: z.string().min(1),
    sequence_number: z.number().int().positive(),
    opens_at: z.string().datetime(),
    closes_at: z.string().datetime()
  }).strict(),
  result: z.object({
    outcome: RhPulseCallOutcomeSchema,
    label: z.string().min(1),
    confidence: RhPulseConfidenceSchema,
    winning_score: z.number().min(0).max(100).nullable()
  }).strict(),
  candidates: z.array(RhPulseCandidateScoreSchema.pick({
    outcome: true,
    cross_layer_score: true,
    market_activity_score: true,
    narrative_momentum_score: true,
    weighted_score: true,
    qualification_status: true
  }).strict()).length(3),
  evidence: z.object({
    what_moved: z.array(z.string().min(1)).max(30),
    what_connected: z.array(z.string().min(1)).max(30),
    what_proved_it: z.array(z.string().min(1)).max(30),
    limitations: z.array(z.string().min(1)).max(50)
  }).strict(),
  community: RhPulseResolutionCommunityAccuracySchema,
  methodology_version: z.literal(RH_PULSE_RESOLUTION_METHODOLOGY_VERSION),
  input_manifest_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  published_at: z.string().datetime()
}).strict();

export const RhPulseRotationReceiptRecordSchema = z.object({
  id: z.string().trim().regex(/^rhp_rotation_receipt_[a-zA-Z0-9_-]{8,128}$/),
  window_id: z.string().trim().min(1).max(128),
  resolution_run_id: z.string().trim().min(1).max(160),
  receipt_version: z.literal(RH_PULSE_RESOLUTION_RECEIPT_VERSION),
  public_slug: z.string().regex(/^rotation-[0-9]{3,12}-[a-z0-9]{8,32}$/),
  winning_outcome: RhPulseCallOutcomeSchema,
  receipt_payload: RhPulseRotationReceiptPayloadSchema,
  receipt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  supersedes_receipt_id: z.string().min(1).nullable(),
  published_at: z.string().datetime(),
  created_at: z.string().datetime()
}).strict();

export const RhPulseResolutionReadinessSchema = z.object({
  status: z.enum(['not_ready', 'ready', 'blocked']),
  window: RhPulsePublicWindowSummarySchema,
  can_preview: z.boolean(),
  can_create_draft: z.boolean(),
  reasons: z.array(z.string().min(1)).max(30),
  inspected_at: z.string().datetime()
}).strict();

export const RhPulseResolutionPreviewSchema = z.object({
  readiness: RhPulseResolutionReadinessSchema,
  input_manifest_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  calculation: RhPulseResolutionCalculationSchema,
  calculation_duration_ms: z.number().int().nonnegative(),
  persisted: z.literal(false)
}).strict();

export const RhPulseResolutionDraftRequestSchema = z.object({
  manifest: RhPulseResolutionInputManifestSchema,
  audit_note: z.string().trim().min(1).max(1_000)
}).strict();

export const RhPulseResolutionActionSchema = z.object({
  audit_note: z.string().trim().min(1).max(1_000)
}).strict();

export const RhPulsePublicResolutionSchema = z.object({
  window: RhPulsePublicWindowSummarySchema,
  outcome: RhPulseCallOutcomeSchema,
  outcome_label: z.string().min(1),
  confidence: RhPulseConfidenceSchema,
  winning_score: z.number().min(0).max(100).nullable(),
  candidate_scores: z.array(RhPulseCandidateScoreSchema).length(3),
  evidence_summary: z.array(z.string().min(1)).max(50),
  evidence: RhPulseRotationReceiptPayloadSchema.shape.evidence,
  limitations: z.array(z.string().min(1)).max(50),
  supporting_evidence: z.array(z.object({
    reference: z.string().min(1).max(240),
    url: z.string().url().nullable()
  }).strict()).max(100),
  outcome_explanation: z.string().min(1),
  observation_period: z.object({
    opens_at: z.string().datetime(),
    closes_at: z.string().datetime()
  }).strict(),
  source_health: RhPulseFreshnessSchema,
  community: RhPulseResolutionCommunityAccuracySchema,
  methodology_version: z.literal(RH_PULSE_RESOLUTION_METHODOLOGY_VERSION),
  input_manifest_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  receipt_id: z.string().min(1),
  receipt_url: z.string().min(1),
  receipt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  published_at: z.string().datetime(),
  disclaimer: z.literal(RH_PULSE_INDEPENDENCE_DISCLAIMER)
}).strict();

export const RhPulsePublicResolutionListSchema = z.object({
  resolutions: z.array(RhPulsePublicResolutionSchema).max(100),
  generated_at: z.string().datetime()
}).strict();

export const RhPulsePublicRotationReceiptSchema = z.object({
  receipt: RhPulseRotationReceiptRecordSchema,
  immutable: z.literal(true),
  public_resolution: RhPulsePublicResolutionSchema,
  disclaimer: z.literal(RH_PULSE_INDEPENDENCE_DISCLAIMER)
}).strict();

const RhChainEnvelopeMetaSchema = z.object({
  source_policy: z.string(),
  record_count: z.number().int().nonnegative().nullable(),
  provider_status: z.array(z.unknown()),
  live_indexing_enabled: z.literal(false)
}).passthrough();

function responseSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    data,
    meta: RhChainEnvelopeMetaSchema,
    sources: z.array(z.unknown()),
    generated_at: z.string().datetime(),
    data_mode: z.string(),
    disclaimer: z.string()
  }).strict();
}

export const RhPulseResolutionListResponseSchema = responseSchema(RhPulsePublicResolutionListSchema);
export const RhPulseResolutionResponseSchema = responseSchema(RhPulsePublicResolutionSchema);
export const RhPulseRotationReceiptResponseSchema = responseSchema(RhPulsePublicRotationReceiptSchema);

export type RhPulseDirectionalOutcome = z.infer<typeof RhPulseDirectionalOutcomeSchema>;
export type RhPulseResolutionStatus = z.infer<typeof RhPulseResolutionStatusSchema>;
export type RhPulseNormalizedMetric = z.infer<typeof RhPulseNormalizedMetricSchema>;
export type RhPulseResolutionInputManifest = z.infer<typeof RhPulseResolutionInputManifestSchema>;
export type RhPulseCandidateScore = z.infer<typeof RhPulseCandidateScoreSchema>;
export type RhPulseResolutionCalculation = z.infer<typeof RhPulseResolutionCalculationSchema>;
export type RhPulseResolutionRunRecord = z.infer<typeof RhPulseResolutionRunRecordSchema>;
export type RhPulseResolutionCommunityAccuracy = z.infer<typeof RhPulseResolutionCommunityAccuracySchema>;
export type RhPulseRotationReceiptPayload = z.infer<typeof RhPulseRotationReceiptPayloadSchema>;
export type RhPulseRotationReceiptRecord = z.infer<typeof RhPulseRotationReceiptRecordSchema>;
export type RhPulseResolutionReadiness = z.infer<typeof RhPulseResolutionReadinessSchema>;
export type RhPulsePublicResolution = z.infer<typeof RhPulsePublicResolutionSchema>;
