import { z } from 'zod';
import { ReceiptHashSchema, ReceiptIdSchema, ReceiptTimeSchema } from './receipts/common';

const ContentHash = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const EvidenceHash = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const EvaluationReviewAttestationSchema = z.object({
  schema_version: z.literal('evaluation-review-attestation.v1'),
  reviewer_id: ReceiptIdSchema,
  reviewer_key_id: ReceiptIdSchema,
  trust_registry_sha256: ReceiptHashSchema,
  execution_receipt_id: ReceiptIdSchema,
  rubric_sha256: ContentHash,
  evidence_refs: z.array(EvidenceHash).min(1).max(32),
  outcome_evidence_sha256: ContentHash,
  verdict: z.enum(['confirmed', 'weakened', 'contradicted']),
  attested_at: ReceiptTimeSchema,
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/)
}).strict().superRefine((value, context) => {
  if (new Set(value.evidence_refs).size !== value.evidence_refs.length) {
    context.addIssue({ code: 'custom', path: ['evidence_refs'], message: 'duplicate_evidence_digest' });
  }
  if (JSON.stringify(value.evidence_refs) !== JSON.stringify([...value.evidence_refs].sort())) {
    context.addIssue({ code: 'custom', path: ['evidence_refs'], message: 'evidence_digests_must_be_sorted' });
  }
});

export const VerifiedEvaluationSubmissionSchema = z.object({
  attestation: EvaluationReviewAttestationSchema
}).strict();

export type EvaluationReviewAttestation = z.infer<typeof EvaluationReviewAttestationSchema>;
export type VerifiedEvaluationSubmission = z.infer<typeof VerifiedEvaluationSubmissionSchema>;
