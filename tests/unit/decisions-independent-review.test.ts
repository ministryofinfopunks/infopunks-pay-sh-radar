import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { freezeReviewBundle } from '../../scripts/freeze-decisions-independent-review';
import { IndependentReviewBundleSchema } from '../../src/schemas/decisionsIndependentReview';

const packet = JSON.stringify({ schema_version: 'decisions-blinded-review-packet.v1', cases: [{
  review_case_id: 'review_001', stimulus_sha256: 'a'.repeat(64), source_class: 'synthetic_fixture'
}] });
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const first = { reviewer_id_sha256: '1'.repeat(64), assessed_at: '2026-10-09T00:00:00Z', decision: 'do_not_spend',
  evidence_sufficient: true, evidence_refs: [{ reference: 'artifact://proof-1', content_sha256: 'b'.repeat(64) }],
  rationale: 'Reviewed facts contain a veto.', blinded_from_policy_model_and_outcome: true,
  independent_of_case_author: true, immutable_assessment_ref: 'review://one' };
const second = { ...first, reviewer_id_sha256: '2'.repeat(64), immutable_assessment_ref: 'review://two' };
const record = { review_case_id: 'review_001', stimulus_sha256: 'a'.repeat(64), assessments: [first, second],
  resolution: { method: 'consensus', final_decision: 'do_not_spend', resolved_at: '2026-10-09T00:00:01Z', resolution_ref: 'review://resolution' } };
const bundle = { schema_version: 'decisions-independent-review.v1', review_protocol_version: 'decisions-independent-label-review.v1',
  packet_sha256: digest(packet), reviewer_roster_attestation_sha256: 'c'.repeat(64), records: [record] };

it('validates two distinct blinded assessments and freezes only a pending-identity synthetic bundle', () => {
  const frozen = freezeReviewBundle(packet, JSON.stringify(bundle));
  expect(frozen.source_class).toBe('synthetic_fixture');
  expect(frozen.status).toBe('structure_validated_external_identity_pending');
  expect(frozen.case_count).toBe(1);
  expect(() => freezeReviewBundle(packet, JSON.stringify({ ...bundle, packet_sha256: '0'.repeat(64) }))).toThrow('review_packet_mismatch');
});

it('requires independent reviewers and adjudication of disagreements', () => {
  expect(IndependentReviewBundleSchema.safeParse({ ...bundle, records: [{ ...record,
    assessments: [first, { ...first, immutable_assessment_ref: 'review://two' }] }] }).success).toBe(false);
  expect(IndependentReviewBundleSchema.safeParse({ ...bundle, records: [{ ...record,
    assessments: [first, { ...second, decision: 'proceed' }] }] }).success).toBe(false);
  expect(IndependentReviewBundleSchema.safeParse({ ...bundle, records: [{ ...record,
    assessments: [first, { ...second, decision: 'proceed' }], resolution: { method: 'adjudicated', final_decision: 'do_not_spend',
      resolved_at: '2026-10-09T00:00:01Z', adjudicator_id_sha256: '3'.repeat(64), rationale: 'Veto evidence controls.',
      evidence_refs: [{ reference: 'artifact://proof-1', content_sha256: 'b'.repeat(64) }], resolution_ref: 'review://adjudication' } }] }).success).toBe(true);
});
