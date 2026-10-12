/** Authorized synthetic fixtures in the isolated local QA database; never production. */
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import pg from 'pg';
import { PostgresCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository, judgmentRequestKey } from '../src/repositories/judgmentRequestRepository';
import { createJudgmentIssuer } from '../src/security/judgmentIssuer';
import { createReceiptAuthorityService } from '../src/services/receiptAuthorityService';
import { createEvaluationService } from '../src/services/evaluationService';
import { observationInput, judgmentInput, executionInput, qualifyingClassifiedExecution, evaluationInput, classifiedArtifact } from '../tests/helpers/canonicalReceipts';
const database = process.env.UI_INT2_FIXTURE_DATABASE_URL;
if (!database || new URL(database).hostname !== 'localhost' || new URL(database).pathname !== '/ui_int2_browser') throw Error('isolated_local_database_required');
const pair = generateKeyPairSync('ed25519');
const issuerConfig = existsSync('output/ui-int2/local-issuer.json') ? JSON.parse(readFileSync('output/ui-int2/local-issuer.json','utf8')) : { issuer: 'ui-int2-synthetic-local-only', activeKeyId: 'ui-int2-test', privateKeyPem: pair.privateKey.export({type:'pkcs8',format:'pem'}).toString(), keys:[{key_id:'ui-int2-test',public_key_pem:pair.publicKey.export({type:'spki',format:'pem'}).toString(),valid_from:'2026-01-01T00:00:00Z',valid_until:null,revoked:false}] };
writeFileSync('output/ui-int2/local-issuer.json', JSON.stringify(issuerConfig), {mode:0o600});
const pool = new pg.Pool({connectionString:database});const issuer=createJudgmentIssuer(issuerConfig);
const store = new PostgresCanonicalReceiptStore(pool,80,issuer);const authority=createReceiptAuthorityService(store,80,issuer);
async function seed() {
try {
 const owner={tenant_id:'tenant-a',agent_id:'radar-browser'};const key=judgmentRequestKey(owner.agent_id,'ui-int2-accepted-fixture',owner);const id='judgment_'+key.slice(7);const now=new Date();const expires=new Date(now.getTime()+3_600_000).toISOString();
 const observation = await store.get('observation','ui_int2_observation') as ReturnType<typeof observationInput> & {observation_id:string} | null ?? await authority.appendObservation({...observationInput('ui_int2_observation'),observed_at:now.toISOString(),ingested_at:now.toISOString(),freshness_expires_at:expires,provenance:{catalog_source:'live',classification:'SYNTHETIC_LOCAL_AUTHORIZED_FIXTURE'}});
 const judgment = await store.get('judgment',id) as Awaited<ReturnType<typeof authority.appendJudgment>> | null ?? await authority.appendJudgment({...judgmentInput([observation.observation_id]),judgment_id:id,issued_at:now.toISOString(),valid_until:expires,reasons:['Authorized synthetic test evidence; no real service or payment.']});
 const pending = await store.get('execution','ui_int2_pending_execution') as Awaited<ReturnType<typeof authority.appendExecution>> | null ?? await authority.appendExecution({...executionInput(),execution_id:'ui_int2_pending_execution',judgment_id:id,executed_at:now.toISOString(),status:'pending',cost_amount:'0'});
 const completed = await store.get('execution','ui_int2_completed_execution') as Awaited<ReturnType<typeof authority.appendExecution>> | null ?? await authority.appendExecution({...qualifyingClassifiedExecution(true),execution_id:'ui_int2_completed_execution',judgment_id:id,executed_at:now.toISOString()});
 const evaluation = await store.get('evaluation','ui_int2_evaluation') as ReturnType<typeof evaluationInput> | null ?? await createEvaluationService(store).createEvaluation({...evaluationInput(),evaluation_id:'ui_int2_evaluation',execution_id:completed.execution_id,evaluated_at:now.toISOString()},classifiedArtifact(true));
 const response={judgment_id:id,decision:judgment.decision,confidence:judgment.confidence,issued_at:judgment.issued_at,valid_until:judgment.valid_until,reasons:judgment.reasons,cited_observations:judgment.cited_observation_ids,cost:{amount:'0',asset:'USDC'},payment_required:false,receipt:judgment};
 const legacy={intent:'synthetic_local',decision:'approved' as const,recommended_route:null,confidence_score:90,risk_level:'low' as const,estimated_cost:null,last_successful_run:null,known_blockers:[],requires_human_approval:false,receipt_references:[],safer_alternatives:[],do_not_use:[],rationale:['SYNTHETIC_LOCAL_AUTHORIZED_FIXTURE']};
 await new PostgresJudgmentRequestRepository(pool).quote(key,{request_hash:key,state:'complete',response,legacy,subject_type:'provider',subject_id:'provider_test',intent_hash:judgment.intent_hash,challenge:{x402Version:2,resource:{url:'http://localhost:8812/v1/pre-spend/check',description:'Synthetic local fixture',mimeType:'application/json'},accepts:[]},owner});
 writeFileSync('docs/design-system/ui-int2/evidence/fixture-identifiers.json',JSON.stringify({classification:'SYNTHETIC_LOCAL_AUTHORIZED_FIXTURE',judgment:id,observation:observation.observation_id,pendingExecution:pending.execution_id,evaluation:evaluation.evaluation_id,issuerSignatureValid:issuer.verify(judgment)},null,2)+'\n');
} finally { await pool.end(); }

}
void seed().catch(error => { console.error(error.message); process.exitCode = 1; });
