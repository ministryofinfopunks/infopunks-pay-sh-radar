import { z } from 'zod';
import { EvaluatorProvenanceSchema } from '../evaluate';
import { ReceiptIdSchema as id, ReceiptHashSchema as hash, ReceiptTimeSchema as time, ReceiptVersionSchema } from './common';
export const EvaluationReceiptSchema = z.object({
  schema_version: ReceiptVersionSchema,
  evaluation_id: id, execution_id: id, evaluated_at: time,
  outcome: z.enum(['confirmed', 'weakened', 'contradicted']),
  reasons: z.array(id).min(1), evidence_refs: z.array(id).min(1), policy_version: id,
  evaluator: EvaluatorProvenanceSchema.optional(),
  request_hash: hash.optional(), outcome_labels: z.array(id).optional(),
  score_delta: z.number().finite().min(-100).max(100), parent_hash: hash, receipt_hash: hash
}).strict();
export type EvaluationReceipt = z.infer<typeof EvaluationReceiptSchema>;
