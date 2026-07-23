import { z } from 'zod';

export const RH_PULSE_METHODOLOGY_VERSION = 'rh_pulse_layer_flow_v1';
export const RH_PULSE_PRODUCT_TITLE = 'RH Pulse | Call the Rotation';
export const RH_PULSE_PRODUCT_DESCRIPTION = 'See the emerging connections between Memes, Agents and RWAs on Robinhood Chain. Call the next structural rotation and preserve the receipt.';
export const RH_PULSE_INDEPENDENCE_DISCLAIMER = 'Independent public-intelligence product built by Infopunks. Not affiliated with or endorsed by Robinhood Markets, Inc.';

export const RhPulseLayerSchema = z.enum(['memes', 'agents', 'rwas']);
export const RhPulseConnectionIdSchema = z.enum([
  'memes_to_agents',
  'memes_to_rwas',
  'agents_to_rwas'
]);
export const RhPulseEvidenceTypeSchema = z.enum([
  'verified',
  'activity_coupling',
  'narrative',
  'insufficient_evidence'
]);
export const RhPulseFreshnessSchema = z.enum(['live', 'delayed', 'stale', 'unavailable']);
export const RhPulseConfidenceSchema = z.enum(['high', 'medium', 'low', 'insufficient']);
export const RhPulseWindowStateSchema = z.enum(['preview', 'not_open', 'open', 'closed', 'resolving', 'resolved', 'cancelled']);

export const RhPulseSourceReferenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['reviewed_classification', 'persisted_snapshot', 'receipt', 'source_health']),
  label: z.string().min(1),
  href: z.string().min(1).nullable(),
  observed_at: z.string().datetime().nullable(),
  note: z.string().min(1)
}).strict();

export const RhPulseConnectionSnapshotSchema = z.object({
  id: RhPulseConnectionIdSchema,
  source_layer: RhPulseLayerSchema,
  target_layer: RhPulseLayerSchema,
  label: z.string().min(1),
  relative_strength: z.number().min(0).max(100).nullable(),
  recent_change: z.number().min(-100).max(100).nullable(),
  evidence_type: RhPulseEvidenceTypeSchema,
  confidence: RhPulseConfidenceSchema,
  freshness: RhPulseFreshnessSchema,
  explanation: z.string().min(1),
  supporting_observation_count: z.number().int().nonnegative(),
  observed_at: z.string().datetime(),
  methodology_version: z.literal(RH_PULSE_METHODOLOGY_VERSION),
  source_references: z.array(RhPulseSourceReferenceSchema),
  receipt_references: z.array(RhPulseSourceReferenceSchema),
  under_watch: z.boolean(),
  is_strongest_current_signal: z.boolean()
}).strict();

export const RhPulseLayerReadSchema = z.object({
  id: RhPulseLayerSchema,
  label: z.string().min(1),
  role: z.string().min(1),
  position: z.enum(['top', 'lower_left', 'lower_right'])
}).strict();

export const RhPulsePredictionWindowSchema = z.object({
  id: z.string().trim().min(1).max(128),
  sequence_number: z.number().int().positive().nullable(),
  state: RhPulseWindowStateSchema,
  label: z.string().min(1),
  duration_hours: z.number().positive(),
  opens_at: z.string().datetime().nullable(),
  closes_at: z.string().datetime().nullable(),
  call_submission_closes_at: z.string().datetime().nullable(),
  calls_enabled: z.boolean(),
  accepting_calls: z.boolean(),
  methodology_version: z.string().min(1),
  source_health: z.object({
    state: RhPulseFreshnessSchema,
    observed_at: z.string().datetime().nullable(),
    detail: z.string().min(1)
  }).strict(),
  notice: z.string().min(1)
}).strict();

export const RhPulseStructuralStatementSchema = z.object({
  id: z.enum(['memes', 'agents', 'agents_x_rwas', 'rwas']),
  label: z.string().min(1),
  state: z.string().min(1),
  confidence: RhPulseConfidenceSchema,
  freshness: RhPulseFreshnessSchema,
  detail: z.string().min(1).nullable()
}).strict();

export const RhPulseCallOptionIdSchema = z.enum([
  'agents_to_rwas',
  'memes_to_agents',
  'memes_to_rwas',
  'no_qualified_rotation'
]);

export const RhPulseCallOptionSchema = z.object({
  id: RhPulseCallOptionIdSchema,
  label: z.string().min(1),
  thesis: z.string().min(1),
  supporting_observations: z.array(z.string().min(1)).min(2).max(3),
  under_watch: z.boolean()
}).strict();

export const RhPulseStrongestSignalSchema = z.object({
  state: z.enum(['measurable', 'insufficient_evidence', 'tied']),
  connection_id: RhPulseConnectionIdSchema.nullable(),
  label: z.string().min(1),
  explanation: z.string().min(1)
}).strict();

export const RhPulseSourceHealthItemSchema = z.object({
  id: z.enum(['cross_layer_memory', 'market_snapshot_memory', 'chain_pulse_memory', 'meme_pulse_memory', 'launchpad_memory', 'receipt_memory']),
  label: z.string().min(1),
  freshness: RhPulseFreshnessSchema,
  observed_at: z.string().datetime().nullable(),
  detail: z.string().min(1)
}).strict();

export const RhPulseSourceHealthSchema = z.object({
  overall: RhPulseFreshnessSchema,
  items: z.array(RhPulseSourceHealthItemSchema),
  caveats: z.array(z.string().min(1))
}).strict();

export const RhPulseMethodologySchema = z.object({
  version: z.literal(RH_PULSE_METHODOLOGY_VERSION),
  layer_definitions: z.record(RhPulseLayerSchema, z.string().min(1)),
  evidence_definitions: z.record(RhPulseEvidenceTypeSchema, z.string().min(1)),
  freshness_definitions: z.record(RhPulseFreshnessSchema, z.string().min(1)),
  confidence_definitions: z.record(RhPulseConfidenceSchema, z.string().min(1)),
  under_watch_policy: z.string().min(1),
  strength_policy: z.string().min(1),
  correlation_warning: z.string().min(1),
  disclaimer: z.literal(RH_PULSE_INDEPENDENCE_DISCLAIMER)
}).strict();

export const RhPulseProductIdentitySchema = z.object({
  id: z.literal('rh_pulse'),
  name: z.literal('RH Pulse'),
  feature: z.literal('Call the Rotation'),
  movement: z.literal('Infopunks'),
  canonical_url: z.string().url(),
  independent_product: z.literal(true)
}).strict();

export const RhPulseHeroSchema = z.object({
  eyebrow: z.literal('INFOPUNKS / RH PULSE'),
  question: z.literal('The agent economy is live. What does it become next?'),
  supporting_copy: z.literal('Memes brought liquidity. Agents brought coordination and new markets. RWAs remain the structural destination.'),
  cta_supporting_line: z.literal('See the connections. Call the next twenty-four hours.')
}).strict();

export const RhPulseReadModelSchema = z.object({
  product: RhPulseProductIdentitySchema,
  hero: RhPulseHeroSchema,
  current_window: RhPulsePredictionWindowSchema,
  layers: z.array(RhPulseLayerReadSchema).length(3),
  connections: z.array(RhPulseConnectionSnapshotSchema).length(3),
  strongest_current_signal: RhPulseStrongestSignalSchema,
  connection_under_watch: RhPulseConnectionIdSchema,
  structural_statements: z.array(RhPulseStructuralStatementSchema).length(4),
  call_options: z.array(RhPulseCallOptionSchema).length(4),
  calls_enabled: z.boolean(),
  methodology_version: z.literal(RH_PULSE_METHODOLOGY_VERSION),
  methodology: RhPulseMethodologySchema,
  source_health: RhPulseSourceHealthSchema,
  generated_at: z.string().datetime(),
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

export const RhPulseResponseSchema = responseSchema(RhPulseReadModelSchema);
export const RhPulseConnectionsPayloadSchema = z.object({
  connections: z.array(RhPulseConnectionSnapshotSchema).length(3),
  strongest_current_signal: RhPulseStrongestSignalSchema,
  connection_under_watch: RhPulseConnectionIdSchema,
  methodology_version: z.literal(RH_PULSE_METHODOLOGY_VERSION),
  generated_at: z.string().datetime()
}).strict();
export const RhPulseConnectionsResponseSchema = responseSchema(RhPulseConnectionsPayloadSchema);
export const RhPulseCurrentWindowPayloadSchema = RhPulsePredictionWindowSchema.extend({
  generated_at: z.string().datetime()
}).strict();
export const RhPulseMethodologyPayloadSchema = RhPulseMethodologySchema.extend({
  generated_at: z.string().datetime()
}).strict();
export const RhPulseSourceHealthPayloadSchema = RhPulseSourceHealthSchema.extend({
  generated_at: z.string().datetime()
}).strict();
export const RhPulseCurrentWindowResponseSchema = responseSchema(RhPulseCurrentWindowPayloadSchema);
export const RhPulseMethodologyResponseSchema = responseSchema(RhPulseMethodologyPayloadSchema);
export const RhPulseSourceHealthResponseSchema = responseSchema(RhPulseSourceHealthPayloadSchema);

export type RhPulseLayer = z.infer<typeof RhPulseLayerSchema>;
export type RhPulseConnectionId = z.infer<typeof RhPulseConnectionIdSchema>;
export type RhPulseEvidenceType = z.infer<typeof RhPulseEvidenceTypeSchema>;
export type RhPulseFreshness = z.infer<typeof RhPulseFreshnessSchema>;
export type RhPulseConfidence = z.infer<typeof RhPulseConfidenceSchema>;
export type RhPulseConnectionSnapshot = z.infer<typeof RhPulseConnectionSnapshotSchema>;
export type RhPulsePredictionWindow = z.infer<typeof RhPulsePredictionWindowSchema>;
export type RhPulseReadModel = z.infer<typeof RhPulseReadModelSchema>;
export type RhPulseMethodology = z.infer<typeof RhPulseMethodologySchema>;
export type RhPulseSourceHealth = z.infer<typeof RhPulseSourceHealthSchema>;
