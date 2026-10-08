import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from '../helpers/canonicalPostgres';
import { describe, expect, it } from 'vitest';
import { setupExecution } from '../helpers/executions';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createExecutionProofService } from '../../src/services/executionProofService';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';

describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('durable execution proof authority', () => {
  it('replays after restart and blocks duplicate authorization/settlement at the database', async () => {
    const database = await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!, 'execution_proof', ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261007_013_execution_proof_uniqueness', '20261008_018_decision_context']);
    const pool = database.pool;
    try {
      const f = await setupExecution(); const store = new PostgresCanonicalReceiptStore(pool);
      await store.append('observation', f.observation);
      await store.appendDecisionContext((await f.store.getDecisionContext(f.parent.judgment_id))!);
      await store.append('judgment', f.parent);
      const service = () => createExecutionProofService({ store: new PostgresCanonicalReceiptStore(pool), threshold: 80, verifier: f.verifier });
      const first = await service().submit(f.proof);
      expect(await service().submit(f.proof)).toEqual(first);
      expect(await store.list('execution')).toHaveLength(1);
      expect((await createReceiptAuthorityService(store).projectScore('provider', 'provider_test')).score).toBe(0);
      await expect(service().submit(await f.sign({ ...f.proof, idempotency_key: 'other' }))).rejects.toMatchObject({ statusCode: 409 });
      await expect(pool.query("update execution_receipts set receipt_hash=receipt_hash")).rejects.toMatchObject({ code: '55000' });
      await expect(pool.query('delete from execution_receipts')).rejects.toMatchObject({ code: '55000' });
      await expect(pool.query('truncate execution_receipts cascade')).rejects.toMatchObject({ code: '55000' });
      await expectRollbackMigrationFailure(pool, '20261007_013_execution_proof_uniqueness', 'refusing to remove execution authority protections');
    } finally { await database.close(); }
  });
});
