import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from '../helpers/canonicalPostgres';
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PostgresJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';
import { createJudgmentService } from '../../src/services/judgmentService';
import { verifyDecisionContext } from '../../src/services/decisionContextService';
import { request, legacy, setupJudgment } from '../helpers/judgments';

describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('durable judgment payment journal', () => {
  it('reconstructs after restart, recovers settled receipts and refuses uncertain retries', async () => {
    const database = await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!, 'judgment_payment', ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261008_018_decision_context']);
    const pool = database.pool;
    try {
      const f = await setupJudgment(); const store = new PostgresCanonicalReceiptStore(pool);
      await store.append('observation', f.observation);
      const service = () => createJudgmentService({ store: new PostgresCanonicalReceiptStore(pool), journal: new PostgresJudgmentRequestRepository(pool), gateway: f.gateway,
        legacyCheck: () => legacy, observations: async () => [f.observation], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') });
      const quoted = await service().check(request, 'durable'); expect(quoted.status).toBe(402);
      const frozen = await store.getDecisionContext(quoted.response.judgment_id);
      expect(frozen?.context_hash).toBe(quoted.response.decision_context_hash);
      const paid = await service().check(request, 'durable', f.signature);
      expect(paid.response.receipt?.schema_version).toBe('canonical-receipts.v2');
      expect(await verifyDecisionContext(frozen!, paid.response.receipt!, new PostgresCanonicalReceiptStore(pool))).toBe(true);
      const replay = await service().check(request, 'durable', f.signature);
      expect(replay.response.receipt).toEqual(paid.response.receipt); expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
      expect(await store.list('judgment')).toHaveLength(1);
      // Simulate loss of final publication acknowledgement after settlement was persisted.
      await pool.query("update judgment_requests set state='settled',record=jsonb_set(record,'{state}','\"settled\"')");
      expect((await service().check(request, 'durable', f.signature)).response.receipt).toEqual(paid.response.receipt);
      expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
      expect((await createReceiptAuthorityService(store).projectScore('provider', 'provider_test')).score).toBe(0);
      const freeService = createJudgmentService({ store, journal: new PostgresJudgmentRequestRepository(pool), gateway: f.gateway, legacyCheck: () => legacy, observations: async () => [], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') });
      const measure = async (run: () => Promise<unknown>) => {
        const samples: number[] = [];
        for (let i=0;i<100;i++) { const started = performance.now(); await run(); samples.push(performance.now()-started); }
        samples.sort((a,b)=>a-b); return { samples: 100, p50_ms: samples[49], p95_ms: samples[94], max_ms: samples[99] };
      };
      mkdirSync('output', { recursive: true });
      writeFileSync('output/phase2-judgment-postgres-performance.json', JSON.stringify({ adapter: 'local_postgres', external_payment: 'mocked', insufficient: await measure(() => freeService.check(request, 'free')), paid_replay: await measure(() => service().check(request, 'durable', f.signature)) }, null, 2));
      const journal = new PostgresJudgmentRequestRepository(pool);
      const record = (await journal.get((await pool.query('select request_key from judgment_requests')).rows[0].request_key))!;
      await journal.quote('pending', { ...record, state: 'quoted' }); expect(await journal.claim('pending', 'sha256:'+'b'.repeat(64))).toBe(true);
      expect((await new PostgresJudgmentRequestRepository(pool).get('pending'))?.state).toBe('settling');
      await journal.quote('other', { ...record, state: 'quoted' }); expect(await journal.claim('other', 'sha256:'+'b'.repeat(64))).toBe(false);
      await expect(pool.query('update decision_contexts set context=context')).rejects.toMatchObject({ code: '55000' });
      await expectRollbackMigrationFailure(pool, '20261008_018_decision_context', 'refusing to remove decision context history');
      await expectRollbackMigrationFailure(pool, '20261007_012_judgment_requests', 'refusing to remove nonempty payment journal');
    } finally { await database.close(); }
  });
});
