import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { issuerFixture } from '../helpers/judgmentIssuer';
import { dxFixture, dxInput, dxKey, otherKey } from '../helpers/judgmentDx';
import { DecisionViewV1Schema } from '../../src/schemas/decisionView';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('private Decision View on disposable PostgreSQL', () => {
  it('retains owner-bound read access and proof recovery across restart without a second settlement', async () => {
    const db = await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!, 'decision_owner', [
      '20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests',
      '20261008_018_decision_context', '20261008_020_receipt_acceptance', '20261008_021_free_assessment_attempts'
    ]);
    const keys = issuerFixture(); const issuer = createJudgmentIssuer(keys);
    vi.stubEnv('JUDGMENT_ISSUER', keys.issuer); vi.stubEnv('JUDGMENT_ISSUER_KEYS_JSON', JSON.stringify(keys.keys));
    vi.stubEnv('JUDGMENT_SIGNING_KEY_ID', keys.activeKeyId); vi.stubEnv('JUDGMENT_SIGNING_PRIVATE_KEY', keys.privateKeyPem);
    const journal = new PostgresJudgmentRequestRepository(db.pool);
    const store = new PostgresCanonicalReceiptStore(db.pool, 80, issuer);
    const f = await dxFixture({ journal, store });
    try {
      const result = await f.client().judge(dxInput, { idempotencyKey: 'private-pg' });
      const url = '/v1/decision-views/' + result.judgment_id;
      for (const restart of [false, true]) {
        if (restart) await f.restart();
        const view = await f.app.inject({ url, headers: { authorization: 'Bearer ' + dxKey } });
        expect(view.statusCode, view.body).toBe(200);
        expect(view.headers['cache-control']).toBe('private, no-store');
        expect(DecisionViewV1Schema.parse(view.json().data).verification.record_verified).toBe(true);
        expect(view.json().data.execution.authorized).toBe(false);
        for (const path of [url, '/v1/receipt-spine/judgment/' + result.judgment_id + '/context',
          '/v1/receipt-spine/observation/' + result.cited_observations[0]]) {
          expect((await f.app.inject(path)).statusCode).toBe(401);
          expect((await f.app.inject({ url: path, headers: { authorization: 'Bearer ' + otherKey } })).statusCode).toBe(404);
        }
        const noOriginalProof = await f.app.inject({ method: 'POST', url: '/v1/pre-spend/check',
          payload: dxInput, headers: { authorization: 'Bearer ' + dxKey, 'idempotency-key': 'private-pg' } });
        expect(noOriginalProof.statusCode).toBe(401);
      }
      // Reproduce a pre-remediation ambiguous historical journal in this
      // disposable schema; neither tenant may read the shared private evidence.
      const rows = await db.pool.query('select record from judgment_requests limit 1');
      const historical = { ...rows.rows[0].record, owner: { tenant_id: 'tenant-b', agent_id: 'agent' } };
      await db.pool.query('insert into judgment_requests(request_key,request_hash,state,record) values($1,$2,$3,$4)',
        ['synthetic-legacy-ambiguous', historical.request_hash, historical.state, historical]);
      for (const path of [url, '/v1/receipt-spine/judgment/' + result.judgment_id + '/context',
        '/v1/receipt-spine/observation/' + result.cited_observations[0]]) {
        for (const key of [dxKey, otherKey]) {
          const denied = await f.app.inject({ url: path, headers: { authorization: 'Bearer ' + key } });
          expect(denied.statusCode).toBe(404); expect(denied.json()).toEqual({ error: 'private_receipt_not_found' });
        }
      }
      expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
      expect(f.f.facilitator.verify).toHaveBeenCalledTimes(1);
    } finally { await f.close(); await db.close(); }
  });
});
