import { z } from 'zod';
import { ReceiptIdSchema as id, ReceiptHashSchema as hash, ReceiptTimeSchema as time } from './receipts/common';
export const ScoreProjectionSchema = z.object({
  subject_type: id, subject_id: id,
  score: z.number().finite(), policy_version: id,
  evaluation_count: z.number().int().nonnegative(),
  outcome_counts: z.object({ confirmed: z.number().int().nonnegative(), weakened: z.number().int().nonnegative(), contradicted: z.number().int().nonnegative() }).strict(),
  last_evaluated_at: time.nullable(), contributing_evaluation_ids: z.array(id), projection_hash: hash
}).strict();
export type ScoreProjection = z.infer<typeof ScoreProjectionSchema>;
