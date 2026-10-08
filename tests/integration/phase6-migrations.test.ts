import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';
import { executionChain } from '../helpers/evaluations';
import { evaluationInput, executionInput } from '../helpers/canonicalReceipts';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService, verifyReceiptChain } from '../../src/services/receiptAuthorityService';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createDerivedScoreService } from '../../src/services/derivedScoreService';
import { sealReceipt } from '../../src/services/receiptIntegrityService';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
const migrations = readdirSync('migrations').filter(f => f.endsWith('.up.sql')).sort().map(f => f.replace('.up.sql', ''));
const results: unknown[] = [];
async function catalog(pool: pg.Pool) {
  return {
    columns: (await pool.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema=current_schema() order by table_name,ordinal_position")).rows,
    constraints: (await pool.query("select c.relname,t.conname,t.contype,pg_get_constraintdef(t.oid) as definition from pg_constraint t join pg_class c on c.oid=t.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=current_schema() order by c.relname,t.conname")).rows,
    indexes: (await pool.query("select tablename,indexname,indexdef from pg_indexes where schemaname=current_schema() order by tablename,indexname")).rows.map(row => ({ ...row, indexdef: row.indexdef.replaceAll(/ON [a-z0-9_]+\./g, 'ON SCHEMA.') })),
    triggers: (await pool.query("select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=current_schema() and not t.tgisinternal order by c.relname,t.tgname")).rows.map(row => ({ ...row, definition: row.definition.replaceAll(/ON [a-z0-9_]+\./g, 'ON SCHEMA.') }))
  };
}
async function apply(pool: pg.Pool, names: string[]) {
  const client = await pool.connect();
  try { for (const name of names) await client.query(readFileSync(`migrations/${name}.up.sql`, 'utf8')); }
  finally { await client.query('rollback'); client.release(); }
}
let fresh: Awaited<ReturnType<typeof catalog>>;
describe.skipIf(!url)('Phase 6 unchanged migration compatibility', () => {
  it.each([0, 10, 14, 17])('installs/upgrades from migration %i without changing existing history', async baseline => {
    expect(migrations.map(name => Number(name.match(/_(\d+)_/)![1]))).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    const db = await createCanonicalTestDatabase(url!, 'phase6_migrations', migrations.slice(0, baseline));
    try {
      let historicalProjection: unknown;
      let historicalReceipts: unknown;
      if (baseline >= 10) await db.pool.query("insert into rh_chain_market_snapshots(snapshot_id,token_address,captured_at,payload) values('phase6-existing','0xexisting','2026-10-08T00:00:00Z','{\"historical\":true}')");
      if (baseline >= 14) {
        const store = new PostgresCanonicalReceiptStore(db.pool);
        await executionChain(store);
        await createEvaluationService(store).createEvaluation(evaluationInput());
        historicalProjection = await createDerivedScoreService(store).project('provider', 'provider_test');
        historicalReceipts = await Promise.all((['observation', 'judgment', 'execution', 'evaluation'] as const).map(kind => store.list(kind)));
      }
      await apply(db.pool, migrations.slice(baseline));
      const installed = await catalog(db.pool);
      if (baseline === 0) fresh = installed;
      else expect(installed).toEqual(fresh);
      if (baseline >= 10) expect((await db.pool.query("select payload from rh_chain_market_snapshots where snapshot_id='phase6-existing'")).rows).toEqual([{ payload: { historical: true } }]);
      const store = new PostgresCanonicalReceiptStore(db.pool);
      if (historicalProjection) {
        expect(await createDerivedScoreService(store).project('provider', 'provider_test')).toEqual(historicalProjection);
        expect(await Promise.all((['observation', 'judgment', 'execution', 'evaluation'] as const).map(kind => store.list(kind)))).toEqual(historicalReceipts);
      } else await executionChain(store);
      const authority = createReceiptAuthorityService(store);
      const execution = await authority.appendExecution({ ...executionInput(), execution_id: 'phase6-new-execution' });
      const evaluated = await createEvaluationService(store).createEvaluation({ ...evaluationInput(), evaluation_id: 'phase6-new-evaluation', execution_id: execution.execution_id });
      expect(await verifyReceiptChain('evaluation', evaluated, store)).toBe(true);
      const projection = await createDerivedScoreService(store).project('provider', 'provider_test');
      expect(await createDerivedScoreService(new PostgresCanonicalReceiptStore(db.pool)).project('provider', 'provider_test')).toEqual(projection);
      // Exercise the physical ancestry FK independently of application validation.
      const wrongParent = sealReceipt('execution', { ...execution, execution_id: 'invalid-parent', parent_hash: 'sha256:' + 'f'.repeat(64) });
      await expect(db.pool.query('insert into execution_receipts(execution_id,executed_at,receipt_hash,receipt,judgment_id,parent_hash) values($1,$2,$3,$4,$5,$6)', [wrongParent.execution_id, wrongParent.executed_at, wrongParent.receipt_hash, wrongParent, wrongParent.judgment_id, wrongParent.parent_hash])).rejects.toMatchObject({ code: '23503' });
      const wrongPolicy = sealReceipt('evaluation', { ...evaluated, evaluation_id: 'invalid-policy', score_delta: 99 });
      await expect(db.pool.query('insert into evaluation_receipts(evaluation_id,evaluated_at,receipt_hash,receipt,execution_id,parent_hash) values($1,$2,$3,$4,$5,$6)', [wrongPolicy.evaluation_id, wrongPolicy.evaluated_at, wrongPolicy.receipt_hash, wrongPolicy, wrongPolicy.execution_id, wrongPolicy.parent_hash])).rejects.toMatchObject({ code: '23514' });
      for (const table of ['observation_receipts', 'judgment_receipts', 'execution_receipts', 'evaluation_receipts']) {
        for (const operation of [`update ${table} set receipt=receipt`, `delete from ${table}`, `truncate ${table} cascade`]) await expect(db.pool.query(operation)).rejects.toMatchObject({ code: '55000' });
      }
      await apply(db.pool, migrations.slice(11, 15)); // 012–015 explicitly support repeat apply.
      expect(await catalog(db.pool)).toEqual(installed);
      // One-time migrations fail atomically if an external runner mistakenly repeats them.
      for (const number of [11, 16, 17]) {
        await expect(apply(db.pool, [migrations[number - 1]])).rejects.toThrow();
        expect(await catalog(db.pool)).toEqual(installed);
      }
      expect(await createDerivedScoreService(store).project('provider', 'provider_test')).toEqual(projection);
      results.push({ baseline, pending_applied: migrations.slice(baseline), schema_matches_fresh: true, historical_data_preserved: true, fk_and_policy_rejections: true, canonical_append_only: true, replay_and_projection: true, repeat_012_015_safe: true, repeat_011_016_017_atomic_refusal: true });
      mkdirSync('output/phase6a', { recursive: true });
      writeFileSync('output/phase6a/migration-compatibility.json', JSON.stringify({ classification: 'LOCAL', migrations, cases: results, external_runner_must_track_applied_migrations: true, production_migrations: false }, null, 2) + '\n');
    } finally { await db.close(); }
  });
});
