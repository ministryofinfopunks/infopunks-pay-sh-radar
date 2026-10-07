import { z } from 'zod';
import { ReceiptIdSchema as id, ReceiptHashSchema as hash, ReceiptTimeSchema as time, ReceiptMoneySchema, ReceiptVersionSchema } from './common';
export const JudgmentReceiptSchema = z.object({
  schema_version: ReceiptVersionSchema,
  judgment_id: id, subject_type: id, subject_id: id, intent_hash: hash,
  decision: z.enum(['proceed', 'test_spend_first', 'do_not_spend', 'insufficient_evidence']),
  proceed_confidence_threshold: z.number().finite().min(1).max(100),
  confidence: z.number().finite().min(0).max(100), reasons: z.array(id).min(1),
  cited_observation_ids: z.array(id).min(1).refine((ids) => new Set(ids).size === ids.length, 'duplicate_observation'),
  issued_at: time, valid_until: time, payment_required: z.boolean(),
  payment_receipt_ref: id.nullable(), charge: ReceiptMoneySchema,
  policy_version: id, parent_hashes: z.array(hash).min(1), receipt_hash: hash
}).strict().superRefine((value, context) => {
  if (Date.parse(value.valid_until) <= Date.parse(value.issued_at)) context.addIssue({ code: 'custom', message: 'invalid_judgment_window' });
  if (value.parent_hashes.length !== value.cited_observation_ids.length) context.addIssue({ code: 'custom', message: 'parent_hash_count_mismatch' });
  if (value.decision === 'insufficient_evidence' && (value.payment_required || value.payment_receipt_ref !== null || Number(value.charge) !== 0)) context.addIssue({ code: 'custom', message: 'insufficient_evidence_must_be_free' });
  if (!value.payment_required && Number(value.charge) !== 0) context.addIssue({ code: 'custom', message: 'unpaid_judgment_must_be_free' });
});
export type JudgmentReceipt = z.infer<typeof JudgmentReceiptSchema>;
