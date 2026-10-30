import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from '../helpers/canonicalPostgres';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createDerivedScoreService } from '../../src/services/derivedScoreService';
import { evaluationRequest, executionChain } from '../helpers/evaluations';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
async function isolated(run: (pool: pg.Pool) => Promise<void>) {
  const database = await createCanonicalTestDatabase(url!, 'phase4', ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261007_013_execution_proof_uniqueness', '20261007_014_derived_score_projection', '20261008_018_decision_context', '20261008_020_receipt_acceptance']);
  try { await run(database.pool); } finally { await database.close(); }
}
describe.skipIf(!url)('PostgreSQL derived performance memory', () => {
  it('persists policy, provenance, exact retry contribution and projection fingerprint across restart', async () => isolated(async pool => {
    const store = new PostgresCanonicalReceiptStore(pool); await executionChain(store);
    const service = createEvaluationService(store);
    const results = await Promise.all([service.submit(evaluationRequest, 'canonical-admin'), createEvaluationService(new PostgresCanonicalReceiptStore(pool)).submit(evaluationRequest, 'canonical-admin')]);
    expect(results[0]).toEqual(results[1]);
    const projection = await createDerivedScoreService(store).project('provider', 'provider_test');
    expect(projection).toMatchObject({ score: 0, evaluation_count: 0, contributing_evaluation_ids: [] });
    expect(await createDerivedScoreService(new PostgresCanonicalReceiptStore(pool)).project('provider', 'provider_test')).toEqual(projection);
    expect((await pool.query('select count(*)::int as count from evaluation_receipts')).rows[0].count).toBe(1);
    for (const sql of ['update evaluation_receipts set receipt=receipt', 'delete from evaluation_receipts', 'truncate evaluation_receipts']) {
      await expect(pool.query(sql)).rejects.toMatchObject({ code: '55000' });
    }
    await expectRollbackMigrationFailure(pool, '20261007_014_derived_score_projection');
    expect(await createDerivedScoreService(store).project('provider', 'provider_test')).toEqual(projection);
  }), 30000);

});
