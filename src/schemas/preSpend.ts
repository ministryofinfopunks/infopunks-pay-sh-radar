import { z } from 'zod';
import { JudgmentReceiptSchema } from './receipts';
import { EvmExecutionProfileSchema } from './executeProof';
export const CanonicalDecisionSchema = z.enum(['proceed', 'test_spend_first', 'do_not_spend', 'insufficient_evidence']);
export type CanonicalDecision = z.infer<typeof CanonicalDecisionSchema>;
/** Reviewed materialized policy facts, never accepted from a public check request. */
export const JudgmentFactsSchema = z.object({
  catalog_live: z.literal(true), identity_resolved: z.literal(true),
  required_proof_complete: z.literal(true), intent_satisfied: z.literal(true),
  constraints_satisfied: z.literal(true), confidence: z.number().min(0).max(100),
  route_id: z.string().min(1),
  execution: EvmExecutionProfileSchema.optional(),
  decision_state: z.enum(['approved', 'approved_with_warning', 'use_with_caution', 'requires_human_approval', 'do_not_use']),
  deterministic_veto: z.boolean(), bounded_test_allowed: z.boolean(),
  max_cost: z.number().finite().nonnegative(), asset: z.enum(['USDC', 'USDG']),
  settlement: z.string().min(1), reasons: z.array(z.string().min(1).max(256)).min(1).max(20)
}).strict();
export const CanonicalJudgmentResponseSchema = z.object({
  judgment_id: z.string(), decision: CanonicalDecisionSchema, confidence: z.number(),
  issued_at: z.string().datetime(), valid_until: z.string().datetime(),
  reasons: z.array(z.string()), cited_observations: z.array(z.string()),
  cost: z.object({ amount: z.string(), asset: z.string() }), payment_required: z.boolean(),
  receipt: JudgmentReceiptSchema.nullable()
});
export type CanonicalJudgmentResponse = z.infer<typeof CanonicalJudgmentResponseSchema>;
