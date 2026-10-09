import { z } from 'zod';
import { CanonicalDecisionSchema } from './preSpend';
import { ReceiptHashSchema, ReceiptIdSchema, ReceiptTimeSchema } from './receipts/common';

/** Read-only public projection of a stored assessment. Never an execution token. */
export const DecisionViewV1Schema = z.object({
  schema_version: z.literal('infopunks.decision-view.v1'),
  generated_at: ReceiptTimeSchema,
  subject: z.object({ type: ReceiptIdSchema, id: ReceiptIdSchema, intent_hash: ReceiptHashSchema }).strict(),
  judgment: z.object({
    id: ReceiptIdSchema, decision: CanonicalDecisionSchema, confidence: z.number().min(0).max(100),
    reasons: z.array(z.string()), receipt_hash: ReceiptHashSchema, policy_version: ReceiptIdSchema,
    issued_at: ReceiptTimeSchema, valid_until: ReceiptTimeSchema,
    assessment_charge: z.object({ required: z.boolean(), amount: z.string(), asset: z.enum(['USDC', 'USDG']).nullable() }).strict()
  }).strict(),
  evidence: z.object({
    state: z.enum(['sufficient', 'insufficient', 'stale', 'disputed', 'mixed', 'unavailable']),
    observations: z.array(z.object({
      id: ReceiptIdSchema, receipt_hash: ReceiptHashSchema, state: z.enum(['sufficient', 'insufficient', 'stale', 'disputed']),
      source_type: ReceiptIdSchema, observed_at: ReceiptTimeSchema, freshness_expires_at: ReceiptTimeSchema.nullable()
    }).strict()),
    missing_observation_ids: z.array(ReceiptIdSchema),
    history_commitment: z.discriminatedUnion('status', [
      z.object({ status: z.literal('not_available_in_canonical_v1'), hash: z.null() }).strict(),
      z.object({ status: z.literal('committed_in_canonical_v2'), hash: ReceiptHashSchema }).strict(),
      z.object({ status: z.literal('unavailable'), hash: z.null() }).strict()
    ])
  }).strict(),
  verification: z.object({
    ancestry_valid: z.boolean(), issuer_signature_valid: z.boolean(), within_validity_window: z.boolean(),
    assessment_eligible: z.boolean(), record_verified: z.boolean()
  }).strict(),
  execution: z.object({
    authorized: z.literal(false), authority_requires: z.literal('infopunks.execution-authorization.v1'),
    permitted_ui_actions: z.tuple([z.literal('inspect_receipt'), z.literal('copy_view')])
  }).strict(),
  presentation: z.object({
    catalog_version: z.literal('decision-card.v1'),
    components: z.tuple([z.literal('decision_verdict'), z.literal('evidence_inspector'), z.literal('receipt_identity')])
  }).strict()
}).strict().superRefine((view, context) => {
  const trustedRecord = view.verification.ancestry_valid && view.verification.issuer_signature_valid;
  if (view.verification.record_verified !== trustedRecord) {
    context.addIssue({ code: 'custom', path: ['verification', 'record_verified'], message: 'record_verification_mismatch' });
  }
  const eligibleDecision = view.judgment.decision === 'proceed' || view.judgment.decision === 'test_spend_first';
  const historyAvailable = view.evidence.history_commitment.status !== 'unavailable';
  const eligibleAssessment = trustedRecord && view.verification.within_validity_window && eligibleDecision && historyAvailable;
  if (view.verification.assessment_eligible !== eligibleAssessment) {
    context.addIssue({ code: 'custom', path: ['verification', 'assessment_eligible'], message: 'assessment_eligibility_mismatch' });
  }
});

export type DecisionViewV1 = z.infer<typeof DecisionViewV1Schema>;
