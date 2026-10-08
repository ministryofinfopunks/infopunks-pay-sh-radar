import { z } from 'zod';
import { ReceiptIdSchema, ReceiptHashSchema } from './receipts/common';

export const EvaluateRequestSchema = z.object({
  execution_receipt_id: ReceiptIdSchema,
  outcome: z.enum(['confirmed', 'weakened', 'contradicted']),
  evidence_refs: z.array(ReceiptIdSchema).min(1).max(32).optional(),
  reasons: z.array(ReceiptIdSchema).min(1).max(20).optional(),
  outcome_labels: z.array(ReceiptIdSchema).max(20).optional(),
  evaluator: z.object({ type: ReceiptIdSchema, id: ReceiptIdSchema, signature: z.string().min(1).max(4096).optional() }).strict(),
  idempotency_key: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/)
}).strict();
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;
export const EvaluatorProvenanceSchema = z.object({
  type: ReceiptIdSchema, id: ReceiptIdSchema,
  verification: z.enum(['verified', 'unverified', 'internal']),
  signature_ref: ReceiptHashSchema.optional()
}).strict();

export const FORBIDDEN_SCORE_FIELDS = ['score_delta', 'scoreDelta', 'confidence_delta', 'confidenceDelta', 'trust_delta', 'trustDelta', 'reputation_delta', 'reputationDelta'] as const;
export const hasAuthoredScore = (raw: unknown) => Boolean(raw && typeof raw === 'object' && FORBIDDEN_SCORE_FIELDS.some(field => field in raw));
