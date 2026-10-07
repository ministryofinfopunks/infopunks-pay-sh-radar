import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { setupExecution } from '../helpers/executions';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createExecutionProofService } from '../../src/services/executionProofService';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';

describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('durable execution proof authority', () => {
  it('replays after restart and blocks duplicate authorization/settlement at the database', async () => {
    const schema = 'execution_test_' + randomUUID().replaceAll('-', '');
    const pool = new pg.Pool({ connectionString: process.env.CANONICAL_RECEIPT_TEST_URL, options: `-c search_path=${schema}` });
    try {
      await pool.query(`create schema ${schema}`);
      for (const name of ['011_canonical_receipt_spine', '012_judgment_requests', '013_execution_proof_uniqueness']) await pool.query(readFileSync('migrations/20261007_' + name + '.up.sql', 'utf8'));
      const f = await setupExecution(); const store = new PostgresCanonicalReceiptStore(pool);
      await store.append('observation', f.observation); await store.append('judgment', f.parent);
      const service = () => createExecutionProofService({ store: new PostgresCanonicalReceiptStore(pool), threshold: 80, verifier: f.verifier });
      const first = await service().submit(f.proof);
      expect(await service().submit(f.proof)).toEqual(first);
      expect(await store.list('execution')).toHaveLength(1);
      expect((await createReceiptAuthorityService(store).projectScore('provider', 'provider_test')).score).toBe(0);
      await expect(service().submit(await f.sign({ ...f.proof, idempotency_key: 'other' }))).rejects.toMatchObject({ statusCode: 409 });
      await expect(pool.query("update execution_receipts set receipt_hash=receipt_hash")).rejects.toMatchObject({ code: '55000' });
      await expect(pool.query('delete from execution_receipts')).rejects.toMatchObject({ code: '55000' });
      await expect(pool.query('truncate execution_receipts cascade')).rejects.toMatchObject({ code: '55000' });
      await expect(pool.query(readFileSync('migrations/20261007_013_execution_proof_uniqueness.down.sql', 'utf8'))).rejects.toThrow('refusing to remove execution authority protections');
    } finally { await pool.end(); }
  });
});
