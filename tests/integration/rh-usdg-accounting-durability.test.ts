import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { setupRhUsdG, merchant } from '../helpers/rhUsdG';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { issuerFixture } from '../helpers/judgmentIssuer';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { PostgresEconomicAccountingStore } from '../../src/persistence/economicAccountingStore';
import { createEconomicAccountingService } from '../../src/services/economicAccountingService';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createReceiptAttributionService } from '../../src/services/receiptAttributionService';
import { executionInput, evaluationInput } from '../helpers/canonicalReceipts';

describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('RH USDG accounting PostgreSQL durability', () => {
  it('reconstructs finalized revenue, costs and attribution and blocks destructive writes', async () => {
    const schema = 'rh_economics_' + randomUUID().replaceAll('-', '');
    const pool = new pg.Pool({ connectionString: process.env.CANONICAL_RECEIPT_TEST_URL, options: `-c search_path=${schema}` });
    try {
      await pool.query(`create schema ${schema}`);
      for (const name of ['20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261007_013_execution_proof_uniqueness', '20261007_014_derived_score_projection', '20261008_016_rh_usdg_accounting']) await pool.query(readFileSync(`migrations/${name}.up.sql`, 'utf8'));
      const issuer = createJudgmentIssuer(issuerFixture());
      const receipts = new PostgresCanonicalReceiptStore(pool, 80, issuer); const journal = new PostgresJudgmentRequestRepository(pool);
      const f = await setupRhUsdG({ store: receipts, journal, issuer }); const paid = await f.service.check(f.request, 'durable-rh', f.signature);
      const accounting = () => createEconomicAccountingService({ store: new PostgresEconomicAccountingStore(pool), receipts: new PostgresCanonicalReceiptStore(pool, 80, issuer), journal: new PostgresJudgmentRequestRepository(pool), clients: { 'eip155:4663': f.rpc }, merchant });
      const revenue = await accounting().reconcile(paid.response.judgment_id);
      const cost = { cost_id: 'reviewer-fee', network: 'eip155:4663', asset: 'USDG', amount_atomic: '2500', category: 'reviewers', judgment_id: paid.response.judgment_id, incurred_at: '2026-10-07T00:00:03Z', evidence_refs: ['artifact://reviewer-invoice'] };
      await accounting().recordCost(cost); await accounting().recordCost(cost);
      expect(await accounting().reconcile(paid.response.judgment_id)).toEqual(revenue);
      expect((await accounting().ledger()).totals[1]).toMatchObject({ revenue_atomic: '10000', recorded_costs_atomic: '2500', net_after_recorded_costs_atomic: '7500', distributable_surplus_atomic: null });
      const authority = createReceiptAuthorityService(receipts, 80, issuer);
      await authority.appendExecution({ ...executionInput(), judgment_id: paid.response.judgment_id });
      await createEvaluationService(receipts).createEvaluation(evaluationInput());
      expect((await createReceiptAttributionService(new PostgresCanonicalReceiptStore(pool, 80, issuer)).report()).judgments[0].coverage).toBe('evaluated');
      expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
      for (const table of ['settled_judgment_revenue', 'recorded_protocol_costs']) {
        for (const sql of [`update ${table} set record=record`, `delete from ${table}`, `truncate ${table}`]) await expect(pool.query(sql)).rejects.toMatchObject({ code: '55000' });
      }
      await expect(accounting().recordCost({ ...cost, amount_atomic: '1' })).rejects.toThrow('accounting_id_conflict');
      await expect(pool.query(readFileSync('migrations/20261008_016_rh_usdg_accounting.down.sql', 'utf8'))).rejects.toThrow('retain append-only');
    } finally { await pool.end(); }
  });
});
