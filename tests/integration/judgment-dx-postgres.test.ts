import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { issuerFixture } from '../helpers/judgmentIssuer';
import { dxFixture,dxInput,dxOwner } from '../helpers/judgmentDx';
import { createMemoryJudgmentSessionStore } from '../../src/sdk';
import { judgmentRequestKey } from '../../src/repositories/judgmentRequestRepository';
import { reconciliationFixture } from '../helpers/judgmentReconciliation';
import { createJudgmentReconciliationService } from '../../src/services/judgmentReconciliationService';
afterEach(()=>{ vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('DX-1 SDK and reconciliation on disposable PostgreSQL',()=>{
  it('runs real HTTP/SDK, verifies a pinned issuer, and recovers after server/client restart with one settlement',async()=>{
    const db=await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!,'dx1_sdk',['20261007_011_canonical_receipt_spine','20261007_012_judgment_requests','20261008_018_decision_context','20261008_020_receipt_acceptance','20261008_021_free_assessment_attempts']);
    const keys=issuerFixture(); const issuer=createJudgmentIssuer(keys);
    vi.stubEnv('JUDGMENT_ISSUER',keys.issuer); vi.stubEnv('JUDGMENT_ISSUER_KEYS_JSON',JSON.stringify(keys.keys)); vi.stubEnv('JUDGMENT_SIGNING_KEY_ID',keys.activeKeyId); vi.stubEnv('JUDGMENT_SIGNING_PRIVATE_KEY',keys.privateKeyPem);
    const journal=new PostgresJudgmentRequestRepository(db.pool); const store=new PostgresCanonicalReceiptStore(db.pool,80,issuer);
    const f=await dxFixture({ store,journal }); const sessionStore=createMemoryJudgmentSessionStore();
    try {
      let origin=await f.app.listen({ port:0,host:'127.0.0.1' });
      const wireFetch: typeof f.fetch=(input,init)=>globalThis.fetch(origin+new URL(String(input)).pathname,init);
      const client=f.client({ sessionStore,trustedIssuer:keys,fetch:async(...args)=>{ const result=await wireFetch(...args); if(new Headers(args[1]?.headers).has('payment-signature')) throw new Error('connection_lost_after_commit'); return result; } });
      await expect(client.judge(dxInput,{ idempotencyKey:'pg-restart' })).rejects.toMatchObject({ state:'PAYMENT_PENDING_RECONCILIATION' });
      expect((await new PostgresJudgmentRequestRepository(db.pool).get(judgmentRequestKey(dxOwner.agent_id,'pg-restart',dxOwner)))?.state).toBe('complete');
      await f.restart(); origin=await f.app.listen({ port:0,host:'127.0.0.1' });
      const receipt=await f.client({ sessionStore,trustedIssuer:keys,fetch:wireFetch }).resume('pg-restart');
      expect(receipt.verification).toMatchObject({ integrity:true,issuer:'verified' }); expect(issuer.verify(receipt.receipt!)).toBe(true);
      expect(await new PostgresCanonicalReceiptStore(db.pool,80,issuer).get('judgment',receipt.judgment_id)).toEqual(receipt.receipt);
      expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1); expect(f.f.facilitator.verify).toHaveBeenCalledTimes(1);
      await db.pool.query("update judgment_requests set state='settled',record=jsonb_set(record,'{state}','\"settled\"') where request_key=$1",[judgmentRequestKey(dxOwner.agent_id,'pg-restart',dxOwner)]);
      expect((await f.client({ sessionStore,trustedIssuer:keys,fetch:wireFetch }).resume('pg-restart')).receipt).toEqual(receipt.receipt);
      expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
    } finally { await f.close(); await db.close(); }
  });
  it('persists finalized reconciliation with a compare-and-set across concurrent fresh repositories',async()=>{
    const db=await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!,'dx1_reconcile',['20261007_011_canonical_receipt_spine','20261007_012_judgment_requests']);
    try {
      const f=await reconciliationFixture(); const journal=new PostgresJudgmentRequestRepository(db.pool);
      await journal.quote(f.key,{ ...f.record,state:'quoted' }); expect(await journal.claim(f.key,f.record.payment_hash!,f.record.payment_authorization)).toBe(true);
      const run=()=>createJudgmentReconciliationService(new PostgresJudgmentRequestRepository(db.pool),{ 'eip155:8453':f.rpc }).reconcile(f.record.response.judgment_id,{ transaction_hash:f.hash });
      const results=await Promise.all([run(),run()]); expect(results.filter(r=>r.changed)).toHaveLength(1);
      expect(await new PostgresJudgmentRequestRepository(db.pool).get(f.key)).toMatchObject({ state:'settled',payment_hash:f.record.payment_hash,reconciliation:{ verification:'rpc_finalized_eip3009_transfer' } });
      expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
    } finally { await db.close(); }
  });
});
