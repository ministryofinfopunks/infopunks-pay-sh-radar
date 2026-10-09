import { describe, expect, it } from 'vitest';
import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from '../helpers/canonicalPostgres';
import { createReceiptAuthorityService, verifyReceiptChain } from '../../src/services/receiptAuthorityService';
import { createEvaluationService } from '../../src/services/evaluationService';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { evaluationAttestationDigest } from '../../src/security/evaluationReviewerTrust';
import { REVIEWER_TRUST, signedEvaluationAttestation } from '../helpers/evaluationReview';
import { observationInput, judgmentInput, executionInput } from '../helpers/canonicalReceipts';

const testUrl = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!testUrl)('reviewer-attested Evaluation PostgreSQL durability', () => {
  it('persists the immutable attestation sidecar, binds Evaluation, and replays after service recreation', async () => {
    const database = await createCanonicalTestDatabase(testUrl!, 'evaluation_review', [
      '20261007_011_canonical_receipt_spine', '20261007_014_derived_score_projection', '20261009_018_evaluation_reviewer_attestations'
    ]);
    try {
      const store = new PostgresCanonicalReceiptStore(database.pool, 80, undefined, REVIEWER_TRUST);
      const authority = createReceiptAuthorityService(store);
      await authority.appendObservation(observationInput());
      await authority.appendJudgment(judgmentInput());
      const execution = await authority.appendExecution(executionInput());
      const attestation = signedEvaluationAttestation();
      const evaluation = await createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:05Z'), REVIEWER_TRUST)
        .acceptReviewed({ attestation }, 'canonical-admin');

      const restartedStore = new PostgresCanonicalReceiptStore(database.pool, 80, undefined, REVIEWER_TRUST);
      const retainedAttestation = await restartedStore.getEvaluationReviewerAttestation(evaluationAttestationDigest(attestation));
      expect(retainedAttestation).toEqual(attestation);
      expect(await verifyReceiptChain('evaluation', evaluation, restartedStore)).toBe(true);
      expect(await createEvaluationService(restartedStore, 80, () => new Date('2026-10-07T00:00:06Z'), REVIEWER_TRUST)
        .acceptReviewed({ attestation }, 'canonical-admin')).toEqual(evaluation);

      await expect(database.pool.query('update evaluation_reviewer_attestations set reviewer_id=$1 where attestation_hash=$2', ['changed', evaluationAttestationDigest(attestation)]))
        .rejects.toThrow('canonical_receipt_immutable');
      await expect(database.pool.query('delete from evaluation_reviewer_attestations where attestation_hash=$1', [evaluationAttestationDigest(attestation)]))
        .rejects.toThrow('canonical_receipt_immutable');
      await expect(database.pool.query('delete from evaluation_receipts where evaluation_id=$1', [evaluation.evaluation_id]))
        .rejects.toThrow('canonical_receipt_immutable');
      await expectRollbackMigrationFailure(database.pool, '20261009_018_evaluation_reviewer_attestations', 'cannot_remove_accepted_evaluation_attestations');
      expect(await restartedStore.get('execution', execution.execution_id)).toEqual(execution);
      expect(await restartedStore.get('evaluation', evaluation.evaluation_id)).toEqual(evaluation);
    } finally { await database.close(); }
  });
});
