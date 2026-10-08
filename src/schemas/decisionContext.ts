import { z } from 'zod';
import { PreSpendCheckRequestSchema, PreSpendCheckResponseSchema } from './entities';
import { ScoreProjectionSchema } from './scoreProjection';
import { ReceiptHashSchema, ReceiptIdSchema, ReceiptTimeSchema } from './receipts/common';
import { CanonicalDecisionSchema } from './preSpend';

const hash = ReceiptHashSchema;
const id = ReceiptIdSchema;
export const DecisionContextSchema = z.object({
  version: z.literal('pre-spend-decision-context.v1'),
  assessment_id: id,
  request: PreSpendCheckRequestSchema,
  request_hash: hash,
  subject_type: id,
  subject_id: id,
  intent_hash: hash,
  assessed_at: ReceiptTimeSchema,
  observation_refs: z.array(z.object({ observation_id: id, receipt_hash: hash }).strict()).min(1),
  evaluation_refs: z.array(z.object({ evaluation_id: id, receipt_hash: hash, score_delta: z.number().finite() }).strict()),
  projection_boundary: z.object({ kind: z.literal('committed_evaluation_set.v1'), evaluation_refs_hash: hash,
    quote_assessed_at: ReceiptTimeSchema }).strict(),
  score_projection: ScoreProjectionSchema,
  legacy: PreSpendCheckResponseSchema,
  legacy_hash: hash,
  policy: z.object({ engine_version: z.literal('pre-spend-decision.v2'), threshold: z.number().min(1).max(100),
    veto_threshold: z.literal(-10), ttl_ms: z.number().int().positive(), amount: z.string(), asset: z.enum(['USDC', 'USDG']) }).strict(),
  policy_hash: hash,
  output: z.object({ decision: CanonicalDecisionSchema, confidence: z.number().min(0).max(100),
    reasons: z.array(z.string()).min(1), valid_until: ReceiptTimeSchema }).strict(),
  context_hash: hash
}).strict();
export type DecisionContext = z.infer<typeof DecisionContextSchema>;
