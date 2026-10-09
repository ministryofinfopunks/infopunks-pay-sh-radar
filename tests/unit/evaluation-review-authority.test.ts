import { describe, expect, it } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createReceiptAuthorityService, verifyReceiptChain, type ReceiptReader } from '../../src/services/receiptAuthorityService';
import { evaluationAttestationDigest } from '../../src/security/evaluationReviewerTrust';
import { evaluationInput, executionInput, judgmentInput, observationInput } from '../helpers/canonicalReceipts';
import { EVIDENCE_REFS, REVIEWER_TRUST, signedEvaluationAttestation } from '../helpers/evaluationReview';

async function readyStore() {
  const store = new MemoryCanonicalReceiptStore(80, undefined, REVIEWER_TRUST);
  const authority = createReceiptAuthorityService(store);
  await authority.appendObservation(observationInput());
  await authority.appendJudgment(judgmentInput());
  await authority.appendExecution(executionInput());
  return store;
}

describe('independent Evaluation reviewer authority', () => {
  it('accepts an authorized signed attestation and binds it into the unchanged receipt schema', async () => {
    const store = await readyStore();
    const attestation = signedEvaluationAttestation();
    const evaluation = await createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:05Z'), REVIEWER_TRUST)
      .acceptReviewed({ attestation }, 'canonical-admin');

    expect(evaluation).toMatchObject({
      execution_id: 'x1', outcome: 'confirmed', evidence_refs: EVIDENCE_REFS,
      policy_version: 'review-attested-evaluation.v1',
      evaluator: { type: 'independent_reviewer', id: 'reviewer-alice', verification: 'verified', signature_ref: evaluationAttestationDigest(attestation) }
    });
    expect(await store.getEvaluationReviewerAttestation(evaluation.evaluator!.signature_ref!)).toEqual(attestation);
    expect(await verifyReceiptChain('evaluation', evaluation, store)).toBe(true);
  });

  it('rejects missing operator authorization, untrusted reviewers, forged signatures, stale/future links, and unapproved rubrics', async () => {
    const store = await readyStore();
    const service = createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:05Z'), REVIEWER_TRUST);
    const valid = signedEvaluationAttestation();
    await expect(service.acceptReviewed({ attestation: valid })).rejects.toMatchObject({ code: 'evaluator_provenance_required' });
    await expect(service.acceptReviewed({ attestation: { ...valid, signature: Buffer.alloc(64, 1).toString('base64') } }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'evaluation_reviewer_signature_invalid' });
    await expect(service.acceptReviewed({ attestation: signedEvaluationAttestation({ reviewerId: 'untrusted-reviewer' }) }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'evaluation_reviewer_signature_invalid' });
    await expect(service.acceptReviewed({ attestation: signedEvaluationAttestation({ attestedAt: '2026-10-08T00:00:00.000Z' }) }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'evaluation_reviewer_attestation_time_invalid' });
    await expect(service.acceptReviewed({ attestation: signedEvaluationAttestation({ rubricSha256: 'sha256:' + 'a'.repeat(64) }) }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'evaluation_reviewer_signature_invalid' });
    expect(await store.list('evaluation')).toHaveLength(0);
  });

  it('checks the signed evidence digest, execution parent, and append-only nonce/conflict rules', async () => {
    const store = await readyStore();
    const service = createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:05Z'), REVIEWER_TRUST);
    const malformedDigest = signedEvaluationAttestation();
    const { sign } = await import('node:crypto');
    const { evaluationAttestationSigningBytes } = await import('../../src/security/evaluationReviewerTrust');
    const withWrongDigest = { ...malformedDigest, outcome_evidence_sha256: 'sha256:' + 'a'.repeat(64), signature: '' };
    withWrongDigest.signature = sign(null, evaluationAttestationSigningBytes(withWrongDigest), (await import('../helpers/evaluationReview')).REVIEWER_PRIVATE_KEY.privateKey).toString('base64');
    await expect(service.acceptReviewed({ attestation: withWrongDigest }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'evaluation_outcome_evidence_digest_invalid' });
    await expect(service.acceptReviewed({ attestation: signedEvaluationAttestation({ executionId: 'x-missing' }) }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'execution_not_found' });

    const accepted = await service.acceptReviewed({ attestation: signedEvaluationAttestation() }, 'canonical-admin');
    expect(await service.acceptReviewed({ attestation: signedEvaluationAttestation() }, 'canonical-admin')).toEqual(accepted);
    await expect(service.acceptReviewed({ attestation: signedEvaluationAttestation({ verdict: 'contradicted' }) }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'execution_already_evaluated' });
    await expect(service.acceptReviewed({ attestation: signedEvaluationAttestation({ verdict: 'contradicted', nonce: 'nonce-fedcba9876543210' }) }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'execution_already_evaluated' });
    const authority = createReceiptAuthorityService(store);
    await authority.appendObservation(observationInput('o2'));
    await authority.appendJudgment({ ...judgmentInput(['o2']), judgment_id: 'j2' });
    await authority.appendExecution({ ...executionInput(), execution_id: 'x2', judgment_id: 'j2', settlement_ref: 'settlement_2' });
    await expect(service.acceptReviewed({ attestation: signedEvaluationAttestation({ executionId: 'x2' }) }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'evaluation_reviewer_nonce_replayed' });
    expect(await store.list('evaluation')).toHaveLength(1);
  });

  it('replays the same accepted attestation deterministically and refuses a receipt without its sidecar', async () => {
    const store = await readyStore();
    const service = createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:05Z'), REVIEWER_TRUST);
    const attestation = signedEvaluationAttestation();
    const first = await service.acceptReviewed({ attestation }, 'canonical-admin');
    const replay = await createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:06Z'), REVIEWER_TRUST)
      .acceptReviewed({ attestation }, 'canonical-admin');
    expect(replay).toEqual(first);
    const noSidecar: ReceiptReader = {
      judgmentTrust: store.judgmentTrust,
      evaluationReviewerTrust: store.evaluationReviewerTrust,
      get: store.get.bind(store),
      getEvaluationReviewerAttestation: async () => null
    };
    expect(await verifyReceiptChain('evaluation', first, noSidecar)).toBe(false);
  });
});
