import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';
import { createEvaluationService } from '../../src/services/evaluationService';
import { executionInput, evaluationInput } from '../helpers/canonicalReceipts';
import { describe, expect, it } from 'vitest';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { createReceiptAuthorityService, verifyReceiptChain } from '../../src/services/receiptAuthorityService';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { createJudgmentService } from '../../src/services/judgmentService';
import { issuerFixture } from '../helpers/judgmentIssuer';
import { request, legacy, setupJudgment } from '../helpers/judgments';

describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('signed judgment PostgreSQL durability', () => {
  it('replays the original signature after rotation/reconstruction and recovers publication without charging again', async () => {
    const database = await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!, 'judgment_issuer', ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261007_014_derived_score_projection', '20261008_018_decision_context']);
    const pool = database.pool;
    try {
      const f = await setupJudgment(); const original = issuerFixture(); const next = issuerFixture('key-2');
      const issuer = createJudgmentIssuer(original);
      const store = new PostgresCanonicalReceiptStore(pool, 80, issuer);
      await store.append('observation', f.observation);
      const build = (signer = issuer) => {
        const restoredStore = new PostgresCanonicalReceiptStore(pool, 80, signer);
        return { store: restoredStore, service: createJudgmentService({ store: restoredStore,
          issuer: signer, journal: new PostgresJudgmentRequestRepository(pool), gateway: f.gateway,
          legacyCheck: () => legacy, observations: async () => [f.observation], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') }) };
      };
      const paid = await build().service.check(request, 'durable-signature', f.signature);
      expect(issuer.verify(paid.response.receipt!)).toBe(true);
      const rotated = createJudgmentIssuer({ ...next, keys: [...original.keys, ...next.keys] });
      const restarted = build(rotated);
      expect((await restarted.service.check(request, 'durable-signature', f.signature)).response.receipt).toEqual(paid.response.receipt);
      expect(await verifyReceiptChain('judgment', paid.response.receipt!, restarted.store)).toBe(true);
      // Lose publication acknowledgement, not the append-only receipt.
      await pool.query("update judgment_requests set state='settled', record=jsonb_set(record,'{state}','\"settled\"')");
      expect((await restarted.service.check(request, 'durable-signature', f.signature)).response.receipt).toEqual(paid.response.receipt);
      expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
      expect(await restarted.store.list('judgment')).toHaveLength(1);
      const authority = createReceiptAuthorityService(restarted.store, 80, rotated);
      await authority.appendExecution({ ...executionInput(), judgment_id: paid.response.judgment_id });
      await createEvaluationService(restarted.store).createEvaluation(evaluationInput());
      expect(await authority.replayEvaluation('e1')).toBe(true);
      expect((await authority.projectScore('provider', 'provider_test')).score).toBe(5);
      await expect(pool.query("update judgment_receipts set receipt = receipt - 'issuer_signature'")).rejects.toMatchObject({ code: '55000' });
    } finally { await database.close(); }
  });
});
