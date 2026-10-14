// Reproducible local-only qualification; never run against staging/production.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { resolve } from 'node:path';
import fixtures from '../tests/helpers/canonicalReceipts.ts';
const { observationInput, judgmentInput, qualifyingClassifiedExecution, evaluationInput, classifiedArtifact } = fixtures;
const require = createRequire(import.meta.url);
const pg = require('pg');
const { PostgresCanonicalReceiptStore } = require(resolve('dist/server/persistence/canonicalReceiptStore.js'));
const { createJudgmentIssuer } = require(resolve('dist/server/security/judgmentIssuer.js'));
const { createReceiptAuthorityService, verifyReceiptChain } = require(resolve('dist/server/services/receiptAuthorityService.js'));
const { createDerivedScoreService } = require(resolve('dist/server/services/derivedScoreService.js'));
const { createEvaluationService } = require(resolve('dist/server/services/evaluationService.js'));
const { createCausalTapeService } = require(resolve('dist/server/services/causalTapeService.js'));
const { PostgresJudgmentRequestRepository } = require(resolve('dist/server/repositories/judgmentRequestRepository.js'));
const { hashCanonical } = require(resolve('dist/server/services/receiptIntegrityService.js'));
const mode = process.argv[2], url = process.env.CANONICAL_RECEIPT_TEST_URL;
if (process.env.NODE_ENV !== 'test' || !url) throw new Error('local_test_environment_required');
const target = new URL(url);
if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.search || target.hash || !/^\/unified_radar_[a-f0-9]{12}_(migration|restore)$/.test(target.pathname)) throw new Error('disposable_local_target_required');
const out = resolve(process.env.RADAR_RECOVERY_OUTPUT_DIR || 'output/radar-v1/recovery');
mkdirSync(out, { recursive: true });
let signer;
if (mode === 'seed') {
  const pair = generateKeyPairSync('ed25519');
  const trust = { issuer: 'synthetic-local-recovery-only', keys: [{ key_id: 'local-recovery', public_key_pem: pair.publicKey.export({ type:'spki',format:'pem' }).toString(), valid_from:'2026-01-01T00:00:00Z',valid_until:null,revoked:false }] };
  writeFileSync(out+'/recovery-public-trust.json', JSON.stringify(trust,null,2)+'\n');
  signer = createJudgmentIssuer({ ...trust,activeKeyId:'local-recovery',privateKeyPem:pair.privateKey.export({ type:'pkcs8',format:'pem' }).toString() });
} else if (mode === 'verify' || mode === 'snapshot') signer = createJudgmentIssuer(JSON.parse(readFileSync(out+'/recovery-public-trust.json','utf8')));
else throw new Error('seed_snapshot_or_verify_required');
const pool = new pg.Pool({ connectionString:url,max:2 });
try {
  const store = new PostgresCanonicalReceiptStore(pool,80,signer);
  const authority = createReceiptAuthorityService(store,80,signer);
  if (mode === 'seed') {
    await authority.appendObservation(observationInput());
    await authority.appendJudgment(judgmentInput());
    await authority.appendExecution(qualifyingClassifiedExecution(true));
    await createEvaluationService(store).createEvaluation(evaluationInput(),classifiedArtifact(true));
  }
  const receipts = Object.fromEntries(await Promise.all(['observation','judgment','execution','evaluation'].map(async k=>[k,await store.list(k)])));
  const signature_valid = signer.verify(receipts.judgment[0]);
  const chain_valid = await verifyReceiptChain('evaluation',receipts.evaluation[0],store);
  const projection = await createDerivedScoreService(store).project('provider','provider_test');
  const tape = (await createCausalTapeService(store,new PostgresJudgmentRequestRepository(pool)).page({})).manifest;
  const record = { classification:'SYNTHETIC_LOCAL_ONLY',receipt_hash:hashCanonical(receipts),receipt_counts:Object.fromEntries(Object.entries(receipts).map(([k,v])=>[k,v.length])),signature_valid,chain_valid,projection,tape,ledger_rows:Number((await pool.query('select count(*) as n from infopunks_schema_migrations')).rows[0].n) };
  if (!signature_valid || !chain_valid || record.ledger_rows!==22) throw new Error('recovery_integrity_failed');
  if (mode==='seed' || mode==='snapshot') writeFileSync(out+'/recovery-before.json',JSON.stringify(record,null,2)+'\n');
  else {
    const before = JSON.parse(readFileSync(out+'/recovery-before.json','utf8'));
    if (hashCanonical(before)!==hashCanonical(record)) throw new Error('backup_restore_replay_mismatch');
    writeFileSync(out+'/recovery-after.json',JSON.stringify({...record,exact_replay_match:true},null,2)+'\n');
  }
  process.stdout.write(JSON.stringify({mode,signature_valid,chain_valid,receipt_hash:record.receipt_hash,projection_hash:projection.projection_hash,exact_replay_match:mode==='verify'})+'\n');
} finally { await pool.end(); }
