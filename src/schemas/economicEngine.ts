import { z } from 'zod';
import { ReceiptHashSchema as hash, ReceiptTimeSchema as time } from './receipts/common';

export const EngineId = z.string().regex(/^[A-Za-z0-9_.:/-]{1,256}$/);
export const AtomicAmountSchema = z.string().regex(/^(0|[1-9][0-9]{0,77})$/);
const uniqueIds = z.array(EngineId).max(64).refine(v => new Set(v).size === v.length, 'duplicate_id');
export const EconomicOperationSchema = z.object({
  profile_id: EngineId, chain_id: EngineId, asset_id: EngineId, asset_contract: EngineId, fee_asset_id: EngineId, decimals: z.number().int().min(0).max(18),
  payer: EngineId, recipient: EngineId, router: EngineId, method: EngineId,
  arguments_hash: hash, amount_atomic: AtomicAmountSchema, max_fee_atomic: AtomicAmountSchema,
  max_slippage_bps: z.number().int().min(0).max(10000)
}).strict().refine(op => op.asset_id === `${op.chain_id}/${op.asset_contract}` && op.fee_asset_id === op.asset_id, 'exact_asset_and_same_asset_fee_required');
export const EconomicCandidateSchema = z.object({
  id: EngineId.refine(v => !['abstain', '__proto__', 'constructor', 'prototype'].includes(v)),
  action: z.enum(['inspect', 'implement', 'verify', 'answer', 'execute_route']), handler_id: EngineId,
  description: z.string().min(1).max(2048), evidence_ids: uniqueIds,
  operation: EconomicOperationSchema.nullable()
}).strict().refine(c => c.action === 'execute_route' ? c.operation !== null : c.operation === null, 'operation_requires_execution_action');
export const EconomicPolicySchema = z.object({
  version: EngineId, principal_id: EngineId, delegate_id: EngineId, audience: EngineId,
  enabled: z.boolean(), manual_review_required: z.boolean(),
  allowed_handlers: uniqueIds, allowed_profiles: uniqueIds, allowed_chains: uniqueIds,
  allowed_assets: uniqueIds, allowed_payers: uniqueIds, allowed_recipients: uniqueIds, allowed_routers: uniqueIds,
  asset_decimals: z.record(EngineId, z.number().int().min(0).max(18)),
  revoked_candidate_ids: uniqueIds,
  max_amount_atomic: AtomicAmountSchema, max_fee_atomic: AtomicAmountSchema,
  budget_atomic: AtomicAmountSchema, bounded_test_amount_atomic: AtomicAmountSchema.nullable(),
  velocity_window_ms: z.number().int().min(1000).max(86400000), max_calls_per_window: z.number().int().min(1).max(10000),
  max_slippage_bps: z.number().int().min(0).max(10000),
  evidence_threshold: z.number().min(1).max(100), choice_confidence_threshold: z.number().min(0).max(1),
  choice_probability_threshold: z.number().min(0).max(1), ttl_ms: z.number().int().min(1000).max(3600000)
}).strict();
export const DecisionQuestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choice'), instructions: z.string().min(1).max(4096) }).strict(),
  z.object({ type: z.literal('score'), instructions: z.string().min(1).max(4096), criteria: z.array(z.string().min(1).max(2048)).min(2).max(10) }).strict(),
  z.object({ type: z.literal('noul'), instructions: z.string().min(1).max(4096), yes_threshold: z.number().min(0.5).max(1), no_threshold: z.number().min(0).max(0.5) }).strict()
]);
export const EconomicJobSchema = z.object({
  request_id: EngineId, principal_id: EngineId, subject_type: EngineId, subject_id: EngineId,
  role: z.enum(['interpret', 'select', 'evaluate']), intent_hash: hash, state: z.unknown(),
  model_id: z.string().regex(/^jev-[0-9]+\.[0-9]+\.[0-9]+$/),
  candidates: z.array(EconomicCandidateSchema).min(1).max(64).refine(v => new Set(v.map(c => c.id)).size === v.length, 'duplicate_candidate'),
  evidence_ids: uniqueIds, question: DecisionQuestionSchema, policy: EconomicPolicySchema
}).strict();
export type EconomicJob = z.infer<typeof EconomicJobSchema>;
export type EconomicPolicy = z.infer<typeof EconomicPolicySchema>;
export type EconomicCandidate = z.infer<typeof EconomicCandidateSchema>;
export type EconomicOperation = z.infer<typeof EconomicOperationSchema>;

export const DecisionEnvelopeSchema = z.object({
  version: z.literal('infopunks.decision.v1'), request_id: EngineId, principal_id: EngineId,
  role: z.enum(['interpret', 'select', 'evaluate']), intent_hash: hash, state_hash: hash,
  menu_hash: hash, policy_hash: hash, rubric_hash: hash, model_id: z.string(), expires_at: time,
  candidates: z.array(EconomicCandidateSchema), evidence_ids: uniqueIds
}).strict();
export type DecisionEnvelope = z.infer<typeof DecisionEnvelopeSchema>;
const probabilities = z.record(z.string(), z.number().finite().min(0).max(1));
export const SuggestedAnswerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('deterministic'), candidate_id: EngineId, rule_id: EngineId }).strict(),
  z.object({ kind: z.literal('choice'), candidate_id: z.string(), probabilities, confidence: z.number().min(0).max(1) }).strict(),
  z.object({ kind: z.literal('score'), value: z.number().finite(), rubric_hash: hash, probabilities, confidence: z.number().min(0).max(1) }).strict(),
  z.object({ kind: z.literal('noul'), probability_yes: z.number().min(0).max(1) }).strict(),
  z.object({ kind: z.literal('abstain'), reason_code: EngineId }).strict()
]);
export const JevWitnessSchema = z.object({
  source: z.enum(['jev', 'deterministic']),
  envelope_hash: hash, provider_response_hash: hash.nullable(), returned_model_id: z.string(),
  answer: SuggestedAnswerSchema, received_at: time, evidence_ids: uniqueIds,
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict().nullable()
}).strict();
export type JevWitness = z.infer<typeof JevWitnessSchema>;

/** Produced by reviewed adapters, never accepted at the public decision endpoint. */
export const EconomicEvidenceFactsSchema = z.object({
  version: z.literal('infopunks.economic-evidence.v1'), candidate_hash: hash,
  authenticity: z.literal('verified'), completeness: z.literal('complete'), finality: z.literal('finalized'),
  confidence: z.number().min(0).max(100), deterministic_veto: z.boolean(),
  bounded_test_required: z.boolean(), policy_hash: hash
}).strict();
export const ExecutionAuthorizationPayloadSchema = z.object({
  version: z.literal('infopunks.execution-authorization.v1'), authorization_id: EngineId, nonce: EngineId,
  judgment_id: EngineId, judgment_hash: hash, envelope_hash: hash, witness_hash: hash,
  principal_id: EngineId, delegate_id: EngineId, audience: EngineId, candidate_id: EngineId,
  policy_hash: hash, reservation_id: EngineId, operation: EconomicOperationSchema,
  issued_at: time, valid_until: time, issuer: EngineId, key_id: EngineId
}).strict().refine(v => Date.parse(v.valid_until) > Date.parse(v.issued_at), 'invalid_authorization_window');
export const ExecutionAuthorizationSchema = z.object({
  payload: ExecutionAuthorizationPayloadSchema, payload_hash: hash,
  algorithm: z.literal('Ed25519'), signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/)
}).strict();
export type ExecutionAuthorization = z.infer<typeof ExecutionAuthorizationSchema>;
export type ExecutionAuthorizationPayload = z.infer<typeof ExecutionAuthorizationPayloadSchema>;

export const HarnessEventSchema = z.object({
  version: z.literal('infopunks.harness-event.v1'), event_id: EngineId, trace_id: EngineId, run_id: EngineId,
  step_id: EngineId, sequence: z.number().int().nonnegative(), parent_step_id: EngineId.nullable(),
  principal_id: EngineId, event_type: z.enum(['intent', 'tool_started', 'tool_finished', 'error', 'outcome']), at: time,
  source_harness: EngineId, adapter_version: EngineId, intent_hash: hash, tool_id: EngineId.nullable(),
  arguments_hash: hash.nullable(), evidence_ids: uniqueIds, artifact_hashes: z.array(hash).max(64),
  error_code: EngineId.nullable(), latency_ms: z.number().finite().nonnegative().nullable(),
  attempt_id: EngineId.nullable(), authorization_id: EngineId.nullable(), execution_id: EngineId.nullable()
}).strict();
export const DecisionCostEntrySchema = z.object({
  entry_id: EngineId, attempt_id: EngineId, at: time, asset_id: EngineId,
  category: z.enum(['settled_fee', 'refund', 'inference', 'verification', 'payment_fee', 'gas', 'reconciliation']),
  amount_atomic: AtomicAmountSchema.nullable(), settlement_ref: EngineId.nullable(),
  provenance: z.enum(['verified_settlement', 'provider_invoice', 'measured_internal', 'unknown']),
  resolves_entry_id: EngineId.nullable().default(null)
}).strict().refine(v => v.category !== 'settled_fee' || (v.provenance === 'verified_settlement' && v.settlement_ref !== null && v.amount_atomic !== null), 'settled_revenue_requires_proof');
export type DecisionCostEntry = z.infer<typeof DecisionCostEntrySchema>;
