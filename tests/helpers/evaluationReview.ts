import { generateKeyPairSync, sign } from 'node:crypto';
import { createEvaluationReviewerTrust, evaluationAttestationSigningBytes, evaluationOutcomeEvidenceDigest } from '../../src/security/evaluationReviewerTrust';
import type { EvaluationReviewAttestation } from '../../src/schemas/evaluationReviewAttestation';
import { hashCanonical } from '../../src/services/receiptIntegrityService';

export const REVIEWER_ID = 'reviewer-alice';
export const REVIEWER_KEY_ID = 'ed25519-2026-01';
export const RUBRIC_SHA256 = hashCanonical({ rubric: 'e1-outcome-rubric.v1', pass: 'predeclared independent inspection' });
export const EVIDENCE_REFS = [hashCanonical({ artifact: 'provider-result-bytes' }), hashCanonical({ artifact: 'settlement-proof-bytes' })].sort();
export const REVIEWER_PRIVATE_KEY = generateKeyPairSync('ed25519');

export const REVIEWER_REGISTRY = {
  schema_version: 'evaluation-reviewer-trust.v1' as const,
  accepted_rubric_sha256s: [RUBRIC_SHA256],
  reviewers: [{
    reviewer_id: REVIEWER_ID,
    keys: [{ key_id: REVIEWER_KEY_ID, public_key_pem: REVIEWER_PRIVATE_KEY.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      valid_from: '2026-01-01T00:00:00.000Z', valid_until: null, revoked: false }]
  }]
};
export const REVIEWER_TRUST = createEvaluationReviewerTrust(REVIEWER_REGISTRY);

export function signedEvaluationAttestation(input: {
  executionId?: string; verdict?: EvaluationReviewAttestation['verdict']; nonce?: string; attestedAt?: string;
  rubricSha256?: string; evidenceRefs?: string[]; reviewerId?: string; reviewerKeyId?: string;
  trustRegistrySha256?: string; privateKey?: typeof REVIEWER_PRIVATE_KEY.privateKey;
} = {}): EvaluationReviewAttestation {
  const executionId = input.executionId ?? 'x1';
  const rubricSha256 = input.rubricSha256 ?? RUBRIC_SHA256;
  const evidenceRefs = [...(input.evidenceRefs ?? EVIDENCE_REFS)].sort();
  const unsigned = {
    schema_version: 'evaluation-review-attestation.v1' as const,
    reviewer_id: input.reviewerId ?? REVIEWER_ID,
    reviewer_key_id: input.reviewerKeyId ?? REVIEWER_KEY_ID,
    trust_registry_sha256: input.trustRegistrySha256 ?? REVIEWER_TRUST.registrySha256,
    execution_receipt_id: executionId,
    rubric_sha256: rubricSha256,
    evidence_refs: evidenceRefs,
    outcome_evidence_sha256: evaluationOutcomeEvidenceDigest({ execution_receipt_id: executionId, rubric_sha256: rubricSha256, evidence_refs: evidenceRefs }),
    verdict: input.verdict ?? 'confirmed',
    attested_at: input.attestedAt ?? '2026-10-07T00:00:04.000Z',
    nonce: input.nonce ?? 'nonce-0123456789abcdef',
    signature: ''
  } as EvaluationReviewAttestation;
  const signature = sign(null, evaluationAttestationSigningBytes(unsigned), input.privateKey ?? REVIEWER_PRIVATE_KEY.privateKey).toString('base64');
  return { ...unsigned, signature };
}
