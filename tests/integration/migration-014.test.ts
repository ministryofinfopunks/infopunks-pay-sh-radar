import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from '../helpers/canonicalPostgres';
import { executionChain, evaluationRequest } from '../helpers/evaluations';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createDerivedScoreService } from '../../src/services/derivedScoreService';
import { verifyReceiptChain } from '../../src/services/receiptAuthorityService';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!url)('migration 014 clean schema validation', () => {
  it('applies all fourteen migrations, preserves indexes through empty rollback/reapply and refuses history loss', async () => {
    const migrations = readdirSync('migrations').filter(name => name.endsWith('.up.sql') && Number(name.match(/_(\d+)_/)?.[1]) <= 14).sort().map(name => name.replace('.up.sql',''));
    expect(migrations).toHaveLength(14);
    const database = await createCanonicalTestDatabase(url!, 'migration014', migrations);
    const pool = database.pool;
    try {
      const indexes = async () => (await pool.query('select tablename,indexname,indexdef from pg_indexes where schemaname=current_schema() order by indexname')).rows;
      const before = await indexes();
      for (const name of ['observation_receipts_subject_idx', 'judgment_receipts_subject_idx', 'execution_receipts_judgment_idx', 'evaluation_receipts_execution_idx',
        'observation_receipts_pkey', 'judgment_receipts_pkey', 'execution_receipts_pkey', 'evaluation_receipts_pkey', 'judgment_requests_pkey',
        'observation_receipts_receipt_hash_key', 'judgment_receipts_receipt_hash_key', 'execution_receipts_receipt_hash_key', 'evaluation_receipts_receipt_hash_key',
        'evaluation_receipts_execution_id_key', 'observation_receipts_judgment_scope_idx']) {
        expect(before.some(index => index.indexname === name), name).toBe(true);
      }
      const policy = async () => (await pool.query("select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='evaluation_receipts'::regclass and conname='evaluation_score_policy_valid'")).rows;
      expect(await policy()).toHaveLength(1);
      const client = await pool.connect();
      try {
        await client.query(readFileSync('migrations/20261007_014_derived_score_projection.down.sql','utf8'));
        expect(await policy()).toHaveLength(0);
        await client.query(readFileSync('migrations/20261007_014_derived_score_projection.up.sql','utf8'));
      } finally { await client.query('rollback'); client.release(); }
      expect(await policy()).toHaveLength(1); expect(await indexes()).toEqual(before);
      for (const migration of ['20261008_018_decision_context', '20261008_020_receipt_acceptance'])
        await pool.query(readFileSync(`migrations/${migration}.up.sql`, 'utf8'));
      const store = new PostgresCanonicalReceiptStore(pool); const scores = createDerivedScoreService(store);
      expect((await scores.project('provider','provider_test')).score).toBe(0);
      await executionChain(store);
      const evaluation = await createEvaluationService(store,80,() => new Date('2026-10-07T00:00:04Z')).submit(evaluationRequest,'canonical-admin');
      expect(await verifyReceiptChain('evaluation',evaluation,store)).toBe(true);
      const projection = await scores.project('provider','provider_test');
      expect(projection.score).toBe(0); // Bare administrative labels are inspectable but nonqualifying.
      await expectRollbackMigrationFailure(pool,'20261007_014_derived_score_projection');
      expect(await scores.project('provider','provider_test')).toEqual(projection);
      mkdirSync('output/phase4.1',{recursive:true});
      writeFileSync('output/phase4.1/migration-014.json',JSON.stringify({ fresh_apply:true, migrations, empty_rollback:true, reapply:true,
        populated_rollback_refused:true, complete_chain_replayed:true, projection, indexes:before, production_deployed:false },null,2)+'\n');
    } finally { await database.close(); }
  });
});
