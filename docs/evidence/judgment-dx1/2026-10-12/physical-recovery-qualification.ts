// Local disposable-DB qualification only. Mock settlement and synthetic issuer keys; never use against a live DB.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { PostgresCanonicalReceiptStore } from '../../../../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository } from '../../../../src/repositories/judgmentRequestRepository';
import { createJudgmentService } from '../../../../src/services/judgmentService';
import { createReceiptAuthorityService } from '../../../../src/services/receiptAuthorityService';
import { createX402JudgmentGateway } from '../../../../src/middleware/x402JudgmentMiddleware';
import { createJudgmentIssuer } from '../../../../src/security/judgmentIssuer';
import { hashCanonical } from '../../../../src/services/receiptIntegrityService';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { request, facts, legacy } from '../../../../tests/helpers/judgmentFixtures';
import { observationInput } from '../../../../tests/helpers/canonicalReceipts';
import { issuerFixture } from '../../../../tests/helpers/judgmentIssuer';
async function main() {
  const prepare=process.argv[2]==='prepare';
  const pool=new pg.Pool({ connectionString:process.env.QUALIFICATION_DATABASE_URL });
  const file='/qualification/physical-snapshot.json';
  const snapshot=prepare ? { keys:issuerFixture(),receipt:null as unknown } : JSON.parse(readFileSync(file,'utf8'));
  const issuer=createJudgmentIssuer(snapshot.keys);
  const store=new PostgresCanonicalReceiptStore(pool,80,issuer);
  const journal=new PostgresJudgmentRequestRepository(pool);
  let settlements=0,verifications=0;
  const gateway=await createX402JudgmentGateway({ facilitatorUrl:'https://facilitator.invalid',payTo:'0x'+'2'.repeat(40),amount:'0.01',resourceUrl:'https://radar.infopunks.fun/v1/pre-spend/check',facilitator:{
    getSupported:async()=>({ kinds:[{ x402Version:2,scheme:'exact',network:'eip155:8453' }],extensions:[],signers:{} }),
    verify:async()=>{ verifications++; return { isValid:true,payer:'0x'+'1'.repeat(40) }; },
    settle:async()=>{ settlements++; return { success:true,transaction:'0x'+'a'.repeat(64),network:'eip155:8453',payer:'0x'+'1'.repeat(40) }; }
  } });
  const signature=encodePaymentSignatureHeader({ x402Version:2,accepted:gateway.requirements[0],payload:{ signature:'qualification-mock-only',authorization:{ from:'0x'+'1'.repeat(40),to:gateway.requirements[0].payTo,value:'10000',nonce:'0x'+'c'.repeat(64),validAfter:'1791331199',validBefore:'1791331300' } } });
  const authority=createReceiptAuthorityService(store,80,issuer);
  let observation;
  if(prepare) observation=await authority.appendObservation({ ...observationInput('physical-observation'),intent_hash:hashCanonical(request),source_type:'reviewed_judgment_facts',provenance:{ catalog_source:'live' },payload:facts });
  else observation=await store.get('observation','physical-observation');
  assert(observation);
  const service=createJudgmentService({ store,journal,gateway,issuer,legacyCheck:()=>legacy,observations:async()=>[observation as never],threshold:80,ttlMs:60000,amount:'0.01',now:()=>new Date(prepare?'2026-10-07T00:00:02Z':'2026-10-12T00:00:00Z') });
  const owner={ tenant_id:'physical-tenant',agent_id:request.agent_id };
  try {
    if(prepare) assert.equal((await service.check(request,'physical-job',undefined,owner)).status,402);
    const paid=await service.check(request,'physical-job',signature,owner);
    assert.equal(paid.status,200); assert(paid.response.receipt);
    assert.equal(issuer.verify(paid.response.receipt),true);
    if(prepare){ snapshot.receipt=paid.response.receipt; writeFileSync(file,JSON.stringify(snapshot),{ mode:0o600 }); }
    else assert.deepEqual(paid.response.receipt,snapshot.receipt);
    await assert.rejects(()=>service.check(request,'physical-job',undefined,owner),/paid_judgment_replay_proof_required/);
    assert.equal(settlements,prepare?1:0); assert.equal(verifications,prepare?1:0);
    console.log(JSON.stringify({ mode:process.argv[2],database:process.env.QUALIFICATION_DATABASE_LABEL,receipt_hash:paid.response.receipt.receipt_hash,issuer_verified:true,identical_historical_receipt:!prepare,missing_proof_rejected:true,settlements,verifications }));
  } finally { await pool.end(); }
}
main().catch(e=>{ console.error(e);process.exitCode=1; });
