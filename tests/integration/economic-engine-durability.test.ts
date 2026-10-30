import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { economicFixture } from '../helpers/economicEngine';
import { PostgresEconomicEngineStore } from '../../src/persistence/economicEngineStore';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createEconomicJudgmentEngine } from '../../src/services/economicJudgmentEngine';
import { createEconomicExecutionGate } from '../../src/services/economicExecutionGate';

describe.skipIf(!process.env.ECONOMIC_ENGINE_TEST_URL)('economic engine PostgreSQL durability', () => {
  it('serializes two instances, recovers receipt publication, and rejects mutations and populated rollback', async () => {
    const schema = 'engine_test_' + randomUUID().replaceAll('-', '');
    const pool = new pg.Pool({ connectionString: process.env.ECONOMIC_ENGINE_TEST_URL, options: `-c search_path=${schema}`, max: 4 });
    try {
      await pool.query(`create schema ${schema}`);
      for (const migration of ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261007_013_execution_proof_uniqueness', '20261007_014_derived_score_projection', '20261007_015_economic_judgment_engine', '20261008_018_decision_context', '20261008_020_receipt_acceptance']) {
        await pool.query(readFileSync(`migrations/${migration}.up.sql`, 'utf8'));
      }
      const f = await economicFixture({}, job => { job.policy.budget_atomic = '11000'; });
      const receipts = new PostgresCanonicalReceiptStore(pool, 80, f.judgmentIssuer);
      await receipts.append('observation', f.observation);
      const options = { ...f.options, receipts, store: new PostgresEconomicEngineStore(pool) };
      const first = createEconomicJudgmentEngine(options), second = createEconomicJudgmentEngine({ ...options, store: new PostgresEconomicEngineStore(pool) });
      const attempts = await Promise.all([first.decide(f.job, 'agent-1'), second.decide({ ...f.job, request_id: 'second' }, 'agent-1')]);
      expect(attempts.filter(a => a.authorization)).toHaveLength(1);
      const winner = attempts.find(a => a.authorization)!;
      expect(await second.decide(winner.job, 'agent-1')).toEqual(winner);
      const execution = await createEconomicExecutionGate(second).execute(winner.authorization, winner.job.candidates[0].operation!, 'delegate-1', 'executor-1');
      expect(execution.state).toBe('finalized');
      expect((await createEconomicExecutionGate(first).execute(winner.authorization, winner.job.candidates[0].operation!, 'delegate-1', 'executor-1')).receipt).toEqual(execution.receipt);
      expect(f.executor.execute).toHaveBeenCalledTimes(1);
      await expect(pool.query("update economic_engine_records set record='{}' where kind='authorization'")).rejects.toMatchObject({ code: '55000' });
      await expect(pool.query("delete from economic_engine_records where kind='attempt'")).rejects.toMatchObject({ code: '55000' });
      await expect(pool.query(readFileSync('migrations/20261007_015_economic_judgment_engine.down.sql', 'utf8'))).rejects.toThrow('refusing to remove populated');
    } finally { await pool.end(); }
  }, 30000);
});
