import { z } from 'zod';

const Digest = z.string().regex(/^[a-f0-9]{64}$/);
const Decision = z.enum(['proceed', 'test_spend_first', 'do_not_spend', 'insufficient_evidence']);
const EvidenceRef = z.object({ reference: z.string().min(1).max(512), content_sha256: Digest }).strict();
const Assessment = z.object({
  reviewer_id_sha256: Digest, assessed_at: z.string().datetime({ offset: true }),
  decision: Decision, evidence_sufficient: z.boolean(), evidence_refs: z.array(EvidenceRef).min(1),
  rationale: z.string().min(1).max(4000), blinded_from_policy_model_and_outcome: z.literal(true),
  independent_of_case_author: z.literal(true), immutable_assessment_ref: z.string().min(1)
}).strict();
const Consensus = z.object({ method: z.literal('consensus'), final_decision: Decision,
  resolved_at: z.string().datetime({ offset: true }), resolution_ref: z.string().min(1) }).strict();
const Adjudication = z.object({ method: z.literal('adjudicated'), final_decision: Decision,
  resolved_at: z.string().datetime({ offset: true }), adjudicator_id_sha256: Digest,
  rationale: z.string().min(1).max(4000), evidence_refs: z.array(EvidenceRef).min(1),
  resolution_ref: z.string().min(1) }).strict();
export const IndependentReviewRecordSchema = z.object({
  review_case_id: z.string().regex(/^review_[0-9]{3,}$/), stimulus_sha256: Digest,
  assessments: z.tuple([Assessment, Assessment]), resolution: z.discriminatedUnion('method', [Consensus, Adjudication])
}).strict().superRefine((record, context) => {
  const [first, second] = record.assessments;
  if (first.reviewer_id_sha256 === second.reviewer_id_sha256) context.addIssue({ code: 'custom', message: 'reviewers_must_differ' });
  if (record.resolution.method === 'consensus') {
    if (first.decision !== second.decision || record.resolution.final_decision !== first.decision) {
      context.addIssue({ code: 'custom', message: 'disagreement_requires_adjudication' });
    }
  } else if ([first.reviewer_id_sha256, second.reviewer_id_sha256].includes(record.resolution.adjudicator_id_sha256)) {
    context.addIssue({ code: 'custom', message: 'adjudicator_must_be_independent' });
  }
  if (Date.parse(record.resolution.resolved_at) < Math.max(...record.assessments.map(value => Date.parse(value.assessed_at)))) {
    context.addIssue({ code: 'custom', message: 'resolution_before_assessment' });
  }
});
export const IndependentReviewBundleSchema = z.object({
  schema_version: z.literal('decisions-independent-review.v1'),
  review_protocol_version: z.literal('decisions-independent-label-review.v1'),
  packet_sha256: Digest, reviewer_roster_attestation_sha256: Digest,
  records: z.array(IndependentReviewRecordSchema).min(1)
}).strict().superRefine((bundle, context) => {
  if (new Set(bundle.records.map(value => value.review_case_id)).size !== bundle.records.length) {
    context.addIssue({ code: 'custom', message: 'duplicate_review_case' });
  }
});
export type IndependentReviewBundle = z.infer<typeof IndependentReviewBundleSchema>;
