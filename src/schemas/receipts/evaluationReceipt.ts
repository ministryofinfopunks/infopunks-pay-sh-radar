import { z } from 'zod';
import { EvaluatorProvenanceSchema } from '../evaluate';
import { ReceiptIdSchema as id, ReceiptHashSchema as hash, ReceiptTimeSchema as time, ReceiptVersionSchema } from './common';
export const EvaluationReceiptSchema = z.object({
  schema_version: ReceiptVersionSchema,
  evaluation_id: id, execution_id: id, evaluated_at: time,
  outcome: z.enum(['confirmed', 'weakened', 'contradicted']),
  proposed_outcome: z.enum(['confirmed', 'weakened', 'contradicted']).optional(),
  reasons: z.array(id).min(1), evidence_refs: z.array(id).min(1), policy_version: id,
  evaluator: EvaluatorProvenanceSchema.optional(),
  request_hash: hash.optional(), outcome_labels: z.array(id).optional(),
  classification: z.object({ version: z.literal('task-output.v1'), artifact_encoding: z.literal('base64'), artifact_bytes: z.string().min(1).max(131072),
    artifact_sha256: hash, source: z.literal('signed_execution_response'), response_hash: hash,
    task_id: id, reviewer: id, challenge: z.literal('public_receipt_replay') }).strict().optional(),
  score_delta: z.number().finite().min(-100).max(100), parent_hash: hash, receipt_hash: hash
}).strict();
export type EvaluationReceipt = z.infer<typeof EvaluationReceiptSchema>;
