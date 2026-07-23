import { z } from 'zod';
import {
  RH_PULSE_INDEPENDENCE_DISCLAIMER,
  RhPulseCallOptionIdSchema,
  RhPulseConfidenceSchema,
  RhPulseFreshnessSchema,
  RhPulsePredictionWindowSchema
} from './rhPulse';

export const RH_PULSE_CALL_METHODOLOGY_VERSION = 'rh-pulse-v1.0';
export const RH_PULSE_CHAIN_ID = 4663;
export const RH_PULSE_SIGNATURE_SCHEME = 'eip191';
export const RH_PULSE_GENESIS_LIMIT = 4_663;
export const RH_PULSE_RECEIPT_VERSION = '1.0';
export const RH_PULSE_TRUST_COPY = 'This signature records your prediction. It cannot move funds or approve transactions.';

export const RhPulseCallOutcomeSchema = RhPulseCallOptionIdSchema;
export const RhPulseDurableWindowStatusSchema = z.enum([
  'not_open',
  'open',
  'closed',
  'resolving',
  'resolved',
  'cancelled'
]);
export const RhPulseVerificationStatusSchema = z.literal('verified');
export const RhPulseAbuseStatusSchema = z.enum(['clear', 'review_required']);

export const RhPulseWindowSourceHealthSchema = z.object({
  state: RhPulseFreshnessSchema,
  observed_at: z.string().datetime().nullable(),
  detail: z.string().trim().min(1).max(1_000)
}).strict();

export const RhPulseWindowRecordSchema = z.object({
  id: z.string().trim().regex(/^rhp_window_[a-zA-Z0-9_-]{8,96}$/),
  sequence_number: z.number().int().positive(),
  opens_at: z.string().datetime(),
  closes_at: z.string().datetime(),
  call_submission_closes_at: z.string().datetime(),
  status: RhPulseDurableWindowStatusSchema,
  methodology_version: z.literal(RH_PULSE_CALL_METHODOLOGY_VERSION),
  source_health: RhPulseWindowSourceHealthSchema,
  audit_metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable(),
  resolved_at: z.string().datetime().nullable(),
  cancelled_at: z.string().datetime().nullable(),
  cancellation_reason: z.string().trim().min(1).max(1_000).nullable()
}).strict().superRefine((window, context) => {
  const opens = Date.parse(window.opens_at);
  const closes = Date.parse(window.closes_at);
  const submissionCloses = Date.parse(window.call_submission_closes_at);
  if (opens >= closes) context.addIssue({ code: 'custom', path: ['closes_at'], message: 'window_close_must_follow_open' });
  if (submissionCloses < opens || submissionCloses > closes) {
    context.addIssue({ code: 'custom', path: ['call_submission_closes_at'], message: 'submission_close_must_be_within_window' });
  }
});

export const RhPulsePublicWindowSummarySchema = RhPulsePredictionWindowSchema.pick({
  id: true,
  sequence_number: true,
  state: true,
  opens_at: true,
  closes_at: true,
  call_submission_closes_at: true,
  accepting_calls: true,
  methodology_version: true
}).strict();

export const RhPulseCallChallengeRequestSchema = z.object({
  wallet_address: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/, 'wallet_address_invalid'),
  selected_outcome: RhPulseCallOutcomeSchema
}).strict();

export const RhPulseCallChallengeRecordSchema = z.object({
  id: z.string().trim().regex(/^rhp_challenge_[a-zA-Z0-9_-]{8,128}$/),
  window_id: z.string().trim().min(1).max(128),
  wallet_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  selected_outcome: RhPulseCallOutcomeSchema,
  nonce_hash: z.string().regex(/^[a-f0-9]{64}$/),
  signed_message: z.string().min(1).max(4_096),
  domain: z.string().trim().min(1).max(253).regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  uri: z.string().url(),
  chain_id: z.literal(RH_PULSE_CHAIN_ID),
  methodology_version: z.literal(RH_PULSE_CALL_METHODOLOGY_VERSION),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  used_at: z.string().datetime().nullable(),
  created_at: z.string().datetime()
}).strict();

export const RhPulseCallChallengePayloadSchema = z.object({
  challenge_id: z.string().min(1),
  message: z.string().min(1),
  window: RhPulsePublicWindowSummarySchema,
  expires_at: z.string().datetime(),
  signature_scheme: z.literal(RH_PULSE_SIGNATURE_SCHEME),
  trust_copy: z.literal(RH_PULSE_TRUST_COPY)
}).strict();

export const RhPulseCallSubmissionRequestSchema = z.object({
  challenge_id: z.string().trim().min(1).max(180),
  signature: z.string().trim().regex(/^0x[0-9a-fA-F]+$/, 'signature_invalid').min(4).max(2_050)
}).strict();

export const RhPulseCallRecordSchema = z.object({
  id: z.string().trim().regex(/^rhp_call_[a-zA-Z0-9_-]{8,128}$/),
  public_call_number: z.number().int().positive(),
  window_id: z.string().trim().min(1).max(128),
  wallet_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  selected_outcome: RhPulseCallOutcomeSchema,
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  signed_message_hash: z.string().regex(/^[a-f0-9]{64}$/),
  recorded_at: z.string().datetime(),
  verification_status: RhPulseVerificationStatusSchema,
  abuse_status: RhPulseAbuseStatusSchema,
  genesis_rank: z.number().int().min(1).max(RH_PULSE_GENESIS_LIMIT).nullable(),
  public_slug: z.string().regex(/^call-[0-9]{6}-[a-z0-9]{8,32}$/),
  methodology_version: z.literal(RH_PULSE_CALL_METHODOLOGY_VERSION),
  created_at: z.string().datetime()
}).strict();

export const RhPulseReceiptStructuralSnapshotSchema = z.object({
  strongest_current_signal: z.string().min(1).nullable(),
  connection_under_watch: z.literal('agents_to_rwas'),
  generated_at: z.string().datetime(),
  source_health: RhPulseFreshnessSchema
}).strict();

export const RhPulseCallReceiptPayloadSchema = z.object({
  receipt_type: z.literal('rh_pulse_signed_call'),
  receipt_version: z.literal(RH_PULSE_RECEIPT_VERSION),
  call_id: z.string().min(1),
  public_call_number: z.number().int().positive(),
  genesis_rank: z.number().int().positive().nullable(),
  window: z.object({
    id: z.string().min(1),
    sequence_number: z.number().int().positive(),
    opens_at: z.string().datetime(),
    closes_at: z.string().datetime()
  }).strict(),
  wallet: z.object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    display_address: z.string().regex(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/)
  }).strict(),
  selected_outcome: RhPulseCallOutcomeSchema,
  selected_outcome_label: z.string().min(1),
  recorded_at: z.string().datetime(),
  methodology_version: z.literal(RH_PULSE_CALL_METHODOLOGY_VERSION),
  signature_scheme: z.literal(RH_PULSE_SIGNATURE_SCHEME),
  verification_status: RhPulseVerificationStatusSchema,
  structural_snapshot: RhPulseReceiptStructuralSnapshotSchema
}).strict();

export const RhPulseCallReceiptRecordSchema = z.object({
  id: z.string().trim().regex(/^rhp_receipt_[a-zA-Z0-9_-]{8,128}$/),
  call_id: z.string().min(1),
  receipt_version: z.literal(RH_PULSE_RECEIPT_VERSION),
  public_slug: z.string().regex(/^receipt-[0-9]{6}-[a-z0-9]{8,32}$/),
  receipt_payload: RhPulseCallReceiptPayloadSchema,
  receipt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  supersedes_receipt_id: z.string().min(1).nullable(),
  created_at: z.string().datetime()
}).strict();

export const RhPulseCommunityOutcomeSchema = z.object({
  outcome: RhPulseCallOutcomeSchema,
  count: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100)
}).strict();

export const RhPulseCommunityDistributionSchema = z.object({
  total_verified_calls: z.number().int().nonnegative(),
  outcomes: z.array(RhPulseCommunityOutcomeSchema).length(4),
  observed_at: z.string().datetime()
}).strict();

export const RhPulseResolvedPublicCallResolutionSchema = z.object({
  status: z.enum(['correct', 'incorrect']),
  winning_outcome: RhPulseCallOutcomeSchema,
  winning_outcome_label: z.string().min(1),
  confidence: RhPulseConfidenceSchema,
  rotation_receipt_id: z.string().min(1),
  rotation_receipt_url: z.string().min(1),
  published_at: z.string().datetime()
}).strict();

export const RhPulseDelayedPublicCallResolutionSchema = z.object({
  status: z.literal('delayed'),
  window_status: z.literal('closed'),
  blocked_reason: z.string().trim().min(1).max(1_000),
  retryable: z.literal(true)
}).strict();

export const RhPulsePublicCallResolutionSchema = z.discriminatedUnion('status', [
  RhPulseResolvedPublicCallResolutionSchema,
  RhPulseDelayedPublicCallResolutionSchema
]);

export const RhPulsePublicCallSchema = z.object({
  call_id: z.string().min(1),
  public_call_number: z.number().int().positive(),
  public_slug: z.string().min(1),
  wallet_display: z.string().regex(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/),
  selected_outcome: RhPulseCallOutcomeSchema,
  selected_outcome_label: z.string().min(1),
  recorded_at: z.string().datetime(),
  window: RhPulsePublicWindowSummarySchema,
  verification_status: RhPulseVerificationStatusSchema,
  genesis: z.object({
    is_genesis: z.boolean(),
    rank: z.number().int().positive().nullable(),
    limit: z.literal(RH_PULSE_GENESIS_LIMIT),
    label: z.string().min(1).nullable()
  }).strict(),
  receipt_url: z.string().min(1),
  public_url: z.string().min(1),
  resolution_status: z.enum(['unresolved', 'correct', 'incorrect']),
  resolution: RhPulsePublicCallResolutionSchema.nullable(),
  methodology_version: z.literal(RH_PULSE_CALL_METHODOLOGY_VERSION)
}).strict();

export const RhPulseCallSubmissionPayloadSchema = z.object({
  call: RhPulsePublicCallSchema,
  receipt: RhPulseCallReceiptRecordSchema,
  community_distribution: RhPulseCommunityDistributionSchema,
  distribution_observed_at: z.string().datetime(),
  disclaimer: z.literal(RH_PULSE_INDEPENDENCE_DISCLAIMER)
}).strict();

export const RhPulsePublicCallPayloadSchema = z.object({
  call: RhPulsePublicCallSchema,
  structural_snapshot: RhPulseReceiptStructuralSnapshotSchema,
  receipt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  disclaimer: z.literal(RH_PULSE_INDEPENDENCE_DISCLAIMER)
}).strict();

export const RhPulsePublicReceiptPayloadSchema = z.object({
  receipt: RhPulseCallReceiptRecordSchema,
  call: RhPulsePublicCallSchema,
  immutable: z.literal(true),
  disclaimer: z.literal(RH_PULSE_INDEPENDENCE_DISCLAIMER)
}).strict();

export const RhPulseInternalCreateWindowSchema = z.object({
  opens_at: z.string().datetime(),
  closes_at: z.string().datetime(),
  call_submission_closes_at: z.string().datetime(),
  methodology_version: z.literal(RH_PULSE_CALL_METHODOLOGY_VERSION),
  source_health: RhPulseWindowSourceHealthSchema,
  audit_note: z.string().trim().min(1).max(1_000)
}).strict();

export const RhPulseInternalWindowActionSchema = z.object({
  audit_note: z.string().trim().min(1).max(1_000)
}).strict();

export const RhPulseInternalWindowCancelSchema = RhPulseInternalWindowActionSchema.extend({
  cancellation_reason: z.string().trim().min(1).max(1_000)
}).strict();

export const RhPulseInternalWindowListSchema = z.object({
  windows: z.array(RhPulseWindowRecordSchema),
  storage: z.object({
    adapter: z.enum(['memory', 'postgres']),
    durable: z.boolean()
  }).strict()
}).strict();

export const RhPulseAuditEventTypeSchema = z.enum([
  'challenge_created',
  'challenge_rejected',
  'signature_verified',
  'signature_rejected',
  'call_accepted',
  'duplicate_call_rejected',
  'receipt_created',
  'window_created',
  'window_opened',
  'window_closed',
  'window_cancelled',
  'abuse_check_triggered',
  'resolution_previewed',
  'resolution_blocked',
  'resolution_draft_created',
  'resolution_approved',
  'resolution_cancelled',
  'resolution_published',
  'resolution_publication_conflict',
  'rotation_receipt_created',
  'resolution_transaction_rolled_back'
]);

export const RhPulseAuditEventSchema = z.object({
  id: z.string().min(1),
  event_type: RhPulseAuditEventTypeSchema,
  window_id: z.string().min(1).nullable(),
  challenge_id: z.string().min(1).nullable(),
  call_id: z.string().min(1).nullable(),
  wallet_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  request_origin_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  payload: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime()
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

export const RhPulseCallChallengeResponseSchema = responseSchema(RhPulseCallChallengePayloadSchema);
export const RhPulseCallSubmissionResponseSchema = responseSchema(RhPulseCallSubmissionPayloadSchema);
export const RhPulsePublicCallResponseSchema = responseSchema(RhPulsePublicCallPayloadSchema);
export const RhPulsePublicReceiptResponseSchema = responseSchema(RhPulsePublicReceiptPayloadSchema);

export type RhPulseCallOutcome = z.infer<typeof RhPulseCallOutcomeSchema>;
export type RhPulseDurableWindowStatus = z.infer<typeof RhPulseDurableWindowStatusSchema>;
export type RhPulseWindowRecord = z.infer<typeof RhPulseWindowRecordSchema>;
export type RhPulseCallChallengeRecord = z.infer<typeof RhPulseCallChallengeRecordSchema>;
export type RhPulseCallRecord = z.infer<typeof RhPulseCallRecordSchema>;
export type RhPulseCallReceiptPayload = z.infer<typeof RhPulseCallReceiptPayloadSchema>;
export type RhPulseCallReceiptRecord = z.infer<typeof RhPulseCallReceiptRecordSchema>;
export type RhPulseCommunityDistribution = z.infer<typeof RhPulseCommunityDistributionSchema>;
export type RhPulsePublicCall = z.infer<typeof RhPulsePublicCallSchema>;
export type RhPulsePublicCallResolution = z.infer<typeof RhPulsePublicCallResolutionSchema>;
export type RhPulseAuditEvent = z.infer<typeof RhPulseAuditEventSchema>;
