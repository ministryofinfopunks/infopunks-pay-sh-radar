import { expect, it, describe } from 'vitest';
import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createDerivedScoreService } from '../../src/services/derivedScoreService';
import { observationInput, judgmentInput, qualifyingClassifiedExecution, classifiedArtifact } from '../helpers/canonicalReceipts';
import { evaluationRequest } from '../helpers/evaluations';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!url)('A5 PostgreSQL acceptance replay', () => {
  it('keeps a committed boundary stable across restart and rejects future issuer time', async () => {
    const db = await createCanonicalTestDatabase(url!, 'acceptance', ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests',
      '20261007_013_execution_proof_uniqueness', '20261007_014_derived_score_projection', '20261008_018_decision_context',
      '20261008_019_execution_score_eligibility', '20261008_020_receipt_acceptance',
      '20261008_021_free_assessment_attempts', '20261008_022_publication_boundaries']);
    try {
      const store = new PostgresCanonicalReceiptStore(db.pool);
      const authority = createReceiptAuthorityService(store);
      await authority.appendObservation(observationInput());
      await authority.appendJudgment(judgmentInput());
      await authority.appendExecution(qualifyingClassifiedExecution(false));
      const before = await store.acceptanceBoundary();
      const evaluation = await createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:04Z'))
        .submit({ ...evaluationRequest, output_artifact: classifiedArtifact(false) }, 'canonical-admin');
      const restored = new PostgresCanonicalReceiptStore(db.pool);
      expect((await restored.getAcceptance('evaluation', evaluation.evaluation_id))!.sequence).toBeGreaterThan(before.sequence);
      expect((await createDerivedScoreService(restored).project('provider', 'provider_test', before.sequence)).score).toBe(0);
      expect((await createDerivedScoreService(restored).project('provider', 'provider_test')).score).toBe(-15);
      await expect(createEvaluationService(restored, 80, () => new Date('2999-01-01T00:00:00Z'))
        .submit({ ...evaluationRequest, idempotency_key: 'future', output_artifact: classifiedArtifact(false) }, 'canonical-admin'))
        .rejects.toMatchObject({ code: 'evaluation_future_timestamp_quarantined' });
      expect((await db.pool.query('select count(*)::int as count from canonical_receipt_quarantine')).rows[0].count).toBe(1);
      expect((await restored.listQuarantine()).map(item => item.publication_sequence)).toEqual([1]);
    } finally { await db.close(); }
  });
});
