import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCanonicalTestDatabase, expectRollbackMigrationFailure } from '../helpers/canonicalPostgres';
import { observationInput, judgmentInput, executionInput, evaluationInput } from '../helpers/canonicalReceipts';
import { issuerFixture } from '../helpers/judgmentIssuer';
import { REVIEWER_PRIVATE_KEY, REVIEWER_REGISTRY, REVIEWER_TRUST, signedEvaluationAttestation } from '../helpers/evaluationReview';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { createEvaluationReviewerTrust, evaluationAttestationDigest, evaluationAttestationSigningBytes } from '../../src/security/evaluationReviewerTrust';
import type { EvaluationReviewerTrustRegistry } from '../../src/security/evaluationReviewerTrust';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService, verifyReceiptChain } from '../../src/services/receiptAuthorityService';
import { createEvaluationService } from '../../src/services/evaluationService';
import { sealReceipt } from '../../src/services/receiptIntegrityService';
import { createApp } from '../../src/api/app';
import { emptyIntelligenceStore } from '../../src/services/intelligenceStore';
import type { EvaluationReviewAttestation } from '../../src/schemas/evaluationReviewAttestation';
import type { EvaluationReceipt } from '../../src/schemas/receipts';

const url = process.env.CANONICAL_RECEIPT_TEST_URL;
const runtimeUrl = process.env.E1_A_RUNTIME_TEST_URL;
const migrations = readdirSync('migrations').filter(file => file.endsWith('.up.sql')).sort().map(file => file.slice(0, -7));
const now = () => new Date('2026-10-07T00:00:10Z');
const issuerConfig = { ...issuerFixture(), issuer: 'e1-a-disposable-test-issuer' };
const issuer = createJudgmentIssuer(issuerConfig);
const resign = (value: EvaluationReviewAttestation) => ({ ...value,
  signature: sign(null, evaluationAttestationSigningBytes(value), REVIEWER_PRIVATE_KEY.privateKey).toString('base64') });

// Deliberately independent JSON/hash implementation for archived evidence verification.
function encode(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(encode).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + encode((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
const digest = (value: unknown) => 'sha256:' + createHash('sha256').update(encode(value)).digest('hex');

describe.skipIf(!url)('E1-A disposable PostgreSQL authority qualification', () => {
  let database: Awaited<ReturnType<typeof createCanonicalTestDatabase>>;
  let store: PostgresCanonicalReceiptStore;
  let serial = 0;
  beforeAll(async () => {
    database = await createCanonicalTestDatabase(url!, 'e1_a', migrations);
    store = new PostgresCanonicalReceiptStore(database.pool, 80, issuer, REVIEWER_TRUST);
    const role = (await database.pool.query('select rolsuper from pg_roles where rolname=current_user')).rows[0];
    expect(role.rolsuper, 'Qualification must run as a test-only non-superuser').toBe(false);
    if (runtimeUrl) await database.pool.query(`grant usage on schema ${database.schema} to e1a_runtime`);
  });
  afterEach(() => vi.unstubAllEnvs());
  // The disposable-cluster runner retains this test schema for a real server
  // restart/replay. It destroys the entire owned cluster at the end of the run.
  afterAll(async () => {
    if (process.env.E1_A_ARTIFACT_DIR) await database?.pool.end();
    else await database?.close();
  });
  async function ready() {
    const id = 'qa_' + (++serial);
    const authority = createReceiptAuthorityService(store, 80, issuer);
    const observation = await authority.appendObservation(observationInput(id + '_o'));
    const judgment = await authority.appendJudgment({ ...judgmentInput([observation.observation_id]), judgment_id: id + '_j' });
    const execution = await authority.appendExecution({ ...executionInput(), execution_id: id + '_x', judgment_id: judgment.judgment_id, settlement_ref: id + '_synthetic_settlement' });
    const attestation = signedEvaluationAttestation({ executionId: execution.execution_id, nonce: 'nonce_qualification_' + id });
    return { observation, judgment, execution, attestation };
  }
  const service = () => createEvaluationService(store, 80, now, REVIEWER_TRUST);
  async function count(executionId: string) {
    return Number((await database.pool.query('select count(*) from evaluation_receipts where execution_id=$1', [executionId])).rows[0].count);
  }

  it('accepts a trusted signed review and refuses unsigned or unauthenticated admission', async () => {
    const r = await ready();
    await expect(service().acceptReviewed({ attestation: r.attestation })).rejects.toMatchObject({ code: 'evaluator_provenance_required' });
    await expect(service().acceptReviewed({ attestation: { ...r.attestation, signature: undefined } }, 'canonical-admin')).rejects.toMatchObject({ code: 'invalid_evaluation_reviewer_attestation' });
    const accepted = await service().acceptReviewed({ attestation: r.attestation }, 'canonical-admin');
    expect(await verifyReceiptChain('evaluation', accepted, store)).toBe(true);
    expect(await count(r.execution.execution_id)).toBe(1);
  });

  it.each(['outcome_evidence_sha256', 'rubric_sha256', 'execution_receipt_id', 'attested_at', 'verdict'] as const)('rejects altered signed %s in PostgreSQL admission', async field => {
    const r = await ready();
    const values = { outcome_evidence_sha256: 'sha256:' + 'a'.repeat(64), rubric_sha256: 'sha256:' + 'b'.repeat(64), execution_receipt_id: 'missing-execution', attested_at: '2026-10-07T00:00:09Z', verdict: 'contradicted' };
    const altered = { ...r.attestation, [field]: values[field] };
    await expect(service().acceptReviewed({ attestation: altered }, 'canonical-admin')).rejects.toMatchObject({ code: 'evaluation_reviewer_signature_invalid' });
    expect(await count(r.execution.execution_id)).toBe(0);
  });

  it.each(['digest', 'rubric', 'execution', 'before-execution', 'future', 'reviewer', 'key'] as const)('rejects authentic reviewer signatures with invalid %s', async field => {
    const r = await ready();
    const replacement: Partial<EvaluationReviewAttestation> = {
      digest: { outcome_evidence_sha256: 'sha256:' + 'f'.repeat(64) }, rubric: { rubric_sha256: 'sha256:' + 'f'.repeat(64) },
      execution: { execution_receipt_id: 'absent' }, 'before-execution': { attested_at: '2026-10-07T00:00:02Z' },
      future: { attested_at: '2026-10-08T00:00:00Z' }, reviewer: { reviewer_id: 'untrusted' }, key: { reviewer_key_id: 'unknown-key' }
    }[field];
    await expect(service().acceptReviewed({ attestation: resign({ ...r.attestation, ...replacement }) }, 'canonical-admin')).rejects.toThrow();
    expect(await count(r.execution.execution_id)).toBe(0);
  });

  it.each(['revoked', 'before-validity', 'at-expiry', 'historically-valid'] as const)('enforces reviewer key %s', async mode => {
    const r = await ready();
    const registry: EvaluationReviewerTrustRegistry = structuredClone(REVIEWER_REGISTRY);
    const key = registry.reviewers[0].keys[0];
    key.revoked = mode === 'revoked';
    key.valid_from = mode === 'before-validity' ? '2026-10-07T00:00:05Z' : '2026-10-07T00:00:00Z';
    key.valid_until = mode === 'at-expiry' ? '2026-10-07T00:00:04Z' : '2026-10-07T00:00:08Z';
    const trust = createEvaluationReviewerTrust(registry);
    const variantStore = new PostgresCanonicalReceiptStore(database.pool, 80, issuer, trust);
    const attestation = resign({ ...r.attestation, trust_registry_sha256: trust.registrySha256 });
    const result = createEvaluationService(variantStore, 80, now, trust).acceptReviewed({ attestation }, 'canonical-admin');
    if (mode === 'historically-valid') {
      const accepted = await result;
      expect(await verifyReceiptChain('evaluation', accepted, variantStore)).toBe(true);
    } else {
      await expect(result).rejects.toMatchObject({ code: 'evaluation_reviewer_signature_invalid' });
      expect(await count(r.execution.execution_id)).toBe(0);
    }
  });

  it('rejects an unregistered reviewer identity sharing a colon-concatenated key identity', async () => {
    const r = await ready();
    const registry = structuredClone(REVIEWER_REGISTRY);
    registry.reviewers[0].reviewer_id = 'reviewer:alice';
    registry.reviewers[0].keys[0].key_id = 'test';
    const trust = createEvaluationReviewerTrust(registry);
    const variantStore = new PostgresCanonicalReceiptStore(database.pool, 80, issuer, trust);
    const spoofed = resign({ ...r.attestation, reviewer_id: 'reviewer', reviewer_key_id: 'alice:test', trust_registry_sha256: trust.registrySha256 });
    await expect(createEvaluationService(variantStore, 80, now, trust).acceptReviewed({ attestation: spoofed }, 'canonical-admin'))
      .rejects.toMatchObject({ code: 'evaluation_reviewer_signature_invalid' });
  });

  it('requires public keys in reviewer trust configuration', () => {
    const registry = structuredClone(REVIEWER_REGISTRY);
    registry.reviewers[0].keys[0].public_key_pem = REVIEWER_PRIVATE_KEY.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(() => createEvaluationReviewerTrust(registry)).toThrow('invalid_evaluation_reviewer_trust_configuration');
  });

  it('reuses the exact receipt for concurrent identical submissions and rejects nonce reuse', async () => {
    const r = await ready();
    const results = await Promise.all(Array.from({ length: 12 }, () => service().acceptReviewed({ attestation: r.attestation }, 'canonical-admin')));
    expect(results.every(receipt => encode(receipt) === encode(results[0]))).toBe(true);
    expect(await count(r.execution.execution_id)).toBe(1);
    const other = await ready();
    const reused = resign({ ...other.attestation, nonce: r.attestation.nonce });
    await expect(service().acceptReviewed({ attestation: reused }, 'canonical-admin')).rejects.toMatchObject({ code: 'evaluation_reviewer_nonce_replayed', statusCode: 409 });
    expect(await count(other.execution.execution_id)).toBe(0);
  });

  it('accepts exactly one outcome under concurrent conflicting reviewer verdicts', async () => {
    const r = await ready();
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => service().acceptReviewed({ attestation: resign({ ...r.attestation,
      verdict: index % 2 ? 'contradicted' : 'confirmed', nonce: r.attestation.nonce + '_' + index }) }, 'canonical-admin')));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected').every(result => result.status === 'rejected' && result.reason.statusCode === 409)).toBe(true);
    expect(await count(r.execution.execution_id)).toBe(1);
    expect(Number((await database.pool.query('select count(*) from evaluation_reviewer_attestations where execution_id=$1', [r.execution.execution_id])).rows[0].count)).toBe(1);
  });

  it('prevents a historical policy from laundering an unsigned verified provenance claim', async () => {
    const r = await ready();
    const receipt = sealReceipt('evaluation', { ...evaluationInput(), evaluation_id: 'unsigned_verified', execution_id: r.execution.execution_id,
      schema_version: 'canonical-receipts.v1', policy_version: 'receipt-authority.v1', score_delta: 5,
      parent_hash: r.execution.receipt_hash, evaluator: { type: 'independent_reviewer', id: 'untrusted', verification: 'verified' } }) as EvaluationReceipt;
    await expect(store.append('evaluation', receipt)).rejects.toThrow();
    expect(await verifyReceiptChain('evaluation', receipt, store)).toBe(false);
  });

  it('rejects resealed receipt timestamps that differ from the signed review time', async () => {
    const r = await ready();
    const accepted = await service().acceptReviewed({ attestation: r.attestation }, 'canonical-admin');
    const changed = sealReceipt('evaluation', { ...accepted, evaluated_at: '2026-10-07T00:00:09Z' });
    expect(await verifyReceiptChain('evaluation', changed, store)).toBe(false);
  });

  it('rejects a signed review made before execution even through the direct store append path', async () => {
    const r = await ready();
    const attestation = resign({ ...r.attestation, attested_at: '2026-10-07T00:00:02Z' });
    await store.appendEvaluationReviewerAttestation(attestation);
    const receipt = sealReceipt('evaluation', { ...evaluationInput(), evaluation_id: 'pre_execution_review', execution_id: r.execution.execution_id,
      evaluated_at: '2026-10-07T00:00:04Z', evidence_refs: attestation.evidence_refs, schema_version: 'canonical-receipts.v1',
      policy_version: 'review-attested-evaluation.v1', score_delta: 5, parent_hash: r.execution.receipt_hash,
      evaluator: { type: 'independent_reviewer', id: attestation.reviewer_id, verification: 'verified', signature_ref: evaluationAttestationDigest(attestation) } }) as EvaluationReceipt;
    await expect(store.append('evaluation', receipt)).rejects.toThrow();
  });

  it('enforces verified-policy and timestamp binding constraints against direct SQL inserts', async () => {
    const r = await ready();
    const base = { ...evaluationInput(), execution_id: r.execution.execution_id, schema_version: 'canonical-receipts.v1', parent_hash: r.execution.receipt_hash };
    const legacy = sealReceipt('evaluation', { ...base, evaluation_id: 'sql_unsigned_verified', policy_version: 'receipt-authority.v1', score_delta: 5,
      evaluator: { type: 'independent_reviewer', id: 'untrusted', verification: 'verified' } });
    const insert = async (receipt: typeof legacy) => database.pool.query('insert into evaluation_receipts(evaluation_id,execution_id,evaluated_at,receipt_hash,parent_hash,receipt) values($1,$2,$3,$4,$5,$6)',
      [receipt.evaluation_id, receipt.execution_id, receipt.evaluated_at, receipt.receipt_hash, receipt.parent_hash, JSON.stringify(receipt)]);
    await expect(insert(legacy)).rejects.toMatchObject({ code: '23514' });
    await store.appendEvaluationReviewerAttestation(r.attestation);
    const mismatched = sealReceipt('evaluation', { ...base, evaluation_id: 'sql_altered_review_time', evaluated_at: '2026-10-07T00:00:09Z', evidence_refs: r.attestation.evidence_refs,
      policy_version: 'review-attested-evaluation.v1', score_delta: 5,
      evaluator: { type: 'independent_reviewer', id: r.attestation.reviewer_id, verification: 'verified', signature_ref: evaluationAttestationDigest(r.attestation) } });
    await expect(insert(mismatched)).rejects.toMatchObject({ code: '23514' });
    expect(await count(r.execution.execution_id)).toBe(0);
  });

  it('rejects SQL NULL bypasses in the attestation sidecar constraints', async () => {
    const r = await ready();
    const { signature: ignored, ...unsigned } = r.attestation;
    await expect(database.pool.query('insert into evaluation_reviewer_attestations(attestation_hash,execution_id,reviewer_id,reviewer_key_id,nonce,rubric_sha256,outcome_evidence_sha256,verdict,attested_at,attestation) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [evaluationAttestationDigest(r.attestation), r.execution.execution_id, r.attestation.reviewer_id, r.attestation.reviewer_key_id, r.attestation.nonce,
        r.attestation.rubric_sha256, r.attestation.outcome_evidence_sha256, r.attestation.verdict, r.attestation.attested_at, JSON.stringify(unsigned)]))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('recovers an interrupted sidecar-to-receipt write with the identical signed submission', async () => {
    const r = await ready();
    const fault = { judgmentTrust: issuer, evaluationReviewerTrust: REVIEWER_TRUST,
      get: store.get.bind(store), list: store.list.bind(store), getEvaluationReviewerAttestation: store.getEvaluationReviewerAttestation.bind(store),
      appendEvaluationReviewerAttestation: store.appendEvaluationReviewerAttestation.bind(store),
      append: async () => { throw new Error('test_injected_receipt_write_failure'); } };
    await expect(createEvaluationService(fault, 80, now, REVIEWER_TRUST).acceptReviewed({ attestation: r.attestation }, 'canonical-admin'))
      .rejects.toThrow('test_injected_receipt_write_failure');
    expect(await count(r.execution.execution_id)).toBe(0);
    const accepted = await service().acceptReviewed({ attestation: r.attestation }, 'canonical-admin');
    expect(await verifyReceiptChain('evaluation', accepted, store)).toBe(true);
    expect(await count(r.execution.execution_id)).toBe(1);
  });

  it('retains sidecars after connection teardown, independently verifies hashes/signatures and rejects mutation', async () => {
    const r = await ready();
    const original = new pg.Pool({ connectionString: url, options: '-c search_path=' + database.schema });
    const originalStore = new PostgresCanonicalReceiptStore(original, 80, issuer, REVIEWER_TRUST);
    const accepted = await createEvaluationService(originalStore, 80, now, REVIEWER_TRUST).acceptReviewed({ attestation: r.attestation }, 'canonical-admin');
    await original.end();
    const reconnect = new pg.Pool({ connectionString: url, options: '-c search_path=' + database.schema });
    try {
      const restored = new PostgresCanonicalReceiptStore(reconnect, 80, issuer, REVIEWER_TRUST);
      const receipts = await Promise.all([restored.get('observation', r.observation.observation_id), restored.get('judgment', r.judgment.judgment_id), restored.get('execution', r.execution.execution_id), restored.get('evaluation', accepted.evaluation_id)]);
      const sidecar = await restored.getEvaluationReviewerAttestation(accepted.evaluator!.signature_ref!);
      expect(sidecar).toEqual(r.attestation);
      expect(await createEvaluationService(restored, 80, now, REVIEWER_TRUST).acceptReviewed({ attestation: r.attestation }, 'canonical-admin')).toEqual(accepted);
      const checks: Record<string, boolean> = {};
      for (const [index, kind] of ['observation', 'judgment', 'execution', 'evaluation'].entries()) {
        const { receipt_hash, ...payload } = receipts[index] as unknown as Record<string, unknown>;
        if (kind === 'judgment') delete payload.issuer_signature;
        checks[kind + '_content_hash'] = receipt_hash === digest({ kind, payload });
      }
      const { signature, ...payload } = sidecar!;
      checks.reviewer_signature = verify(null, Buffer.from(encode({ domain: 'infopunks.evaluation-review-attestation.v1', algorithm: 'Ed25519', attestation: payload })), createPublicKey(REVIEWER_REGISTRY.reviewers[0].keys[0].public_key_pem), Buffer.from(signature, 'base64'));
      checks.sidecar_digest = accepted.evaluator!.signature_ref === digest(sidecar);
      checks.registry_digest = sidecar!.trust_registry_sha256 === digest(REVIEWER_REGISTRY);
      checks.reviewer_identity = sidecar!.reviewer_id === REVIEWER_REGISTRY.reviewers[0].reviewer_id && sidecar!.reviewer_key_id === REVIEWER_REGISTRY.reviewers[0].keys[0].key_id;
      checks.parent_links = r.judgment.parent_hashes[0] === r.observation.receipt_hash && r.execution.parent_hash === r.judgment.receipt_hash && accepted.parent_hash === r.execution.receipt_hash;
      checks.observation_payload_hash = r.observation.payload_hash === digest(r.observation.payload);
      checks.outcome_manifest_digest = sidecar!.outcome_evidence_sha256 === digest({ schema_version: 'evaluation-outcome-evidence.v1', execution_receipt_id: sidecar!.execution_receipt_id, rubric_sha256: sidecar!.rubric_sha256, evidence_refs: sidecar!.evidence_refs });
      const issuerSignature = r.judgment.issuer_signature!;
      checks.judgment_signature = verify(null, Buffer.from(encode({ domain: 'infopunks.judgment-issuer.v1', algorithm: 'Ed25519', issuer: issuerSignature.issuer, key_id: issuerSignature.key_id, receipt_hash: r.judgment.receipt_hash })), createPublicKey(issuerConfig.keys[0].public_key_pem), Buffer.from(issuerSignature.signature, 'base64'));
      expect(Object.values(checks).every(Boolean)).toBe(true);
      expect(await verifyReceiptChain('evaluation', accepted, restored)).toBe(true);
      if (process.env.E1_A_ARTIFACT_DIR) {
        mkdirSync(process.env.E1_A_ARTIFACT_DIR, { recursive: true });
        writeFileSync(join(process.env.E1_A_ARTIFACT_DIR, 'synthetic-durability-bundle.json'), JSON.stringify({ schema_version: 'e1-a-synthetic-durability-bundle.v1', evidence_class: 'synthetic test fixtures; no provider delivery or genuine outcome proof', test_schema: database.schema, receipts, attestation: sidecar, reviewer_registry: REVIEWER_REGISTRY, reviewer_registry_sha256: REVIEWER_TRUST.registrySha256, judgment_public_keys: issuer.publicKeys(), checks }, null, 2) + '\n');
      }
    } finally { await reconnect.end(); }
    for (const table of ['evaluation_receipts', 'evaluation_reviewer_attestations']) {
      for (const sql of [`update ${table} set receipt_hash=receipt_hash`, `delete from ${table}`, `truncate ${table} cascade`]) {
        const actual = table === 'evaluation_reviewer_attestations' ? sql.replaceAll('receipt_hash', 'attestation_hash') : sql;
        await expect(database.pool.query(actual)).rejects.toMatchObject({ code: '55000' });
      }
    }
    await expectRollbackMigrationFailure(database.pool, '20261009_018_evaluation_reviewer_attestations', 'cannot_remove_accepted_evaluation_attestations');
    await expectRollbackMigrationFailure(database.pool, '20261011_023_evaluation_review_guardrails', 'cannot_weaken_accepted_evaluation_authority');
  });

  it('authenticates both HTTP acceptance paths against PostgreSQL and disables all staging score routes without writes', async () => {
    const r = await ready();
    // A raw SQL writer is outside HTTP trust. The DB checks field binding, while
    // Ed25519 trust remains application authority; a forged row must fail replay
    // and must never be returned by the public API as an accepted Evaluation.
    const poison = await ready();
    const forged = { ...poison.attestation, signature: Buffer.alloc(64).toString('base64') };
    await store.appendEvaluationReviewerAttestation(forged);
    const poisonedReceipt = sealReceipt('evaluation', { ...evaluationInput(), evaluation_id: 'raw_sql_forgery', execution_id: poison.execution.execution_id,
      evidence_refs: forged.evidence_refs, schema_version: 'canonical-receipts.v1', policy_version: 'review-attested-evaluation.v1', score_delta: 5,
      parent_hash: poison.execution.receipt_hash, evaluator: { type: 'independent_reviewer', id: forged.reviewer_id, verification: 'verified', signature_ref: evaluationAttestationDigest(forged) } }) as EvaluationReceipt;
    await database.pool.query('insert into evaluation_receipts(evaluation_id,execution_id,evaluated_at,receipt_hash,parent_hash,receipt) values($1,$2,$3,$4,$5,$6)',
      [poisonedReceipt.evaluation_id, poisonedReceipt.execution_id, poisonedReceipt.evaluated_at, poisonedReceipt.receipt_hash, poisonedReceipt.parent_hash, JSON.stringify(poisonedReceipt)]);
    expect(await verifyReceiptChain('evaluation', poisonedReceipt, store)).toBe(false);
    const schemaUrl = new URL(runtimeUrl ?? url!); schemaUrl.searchParams.set('options', '-c search_path=' + database.schema);
    for (const [name, value] of Object.entries({ DATABASE_URL: schemaUrl.toString(), ADMIN_TOKEN: 'e1-a-test-operator', EVALUATION_REVIEWER_TRUST_JSON: JSON.stringify(REVIEWER_REGISTRY),
      EVALUATION_REPUTATION_PROJECTION_ENABLED: 'false', OPENAI_DECISIONS_SHADOW_ENABLED: 'false', INGESTION_ENABLED: 'false', MONITOR_ENABLED: 'false', JUDGMENT_RH_RPC_URL: '',
      JUDGMENT_ISSUER: issuerConfig.issuer, JUDGMENT_ISSUER_KEYS_JSON: JSON.stringify(issuerConfig.keys), JUDGMENT_PAYMENT_ENABLED: 'false' })) vi.stubEnv(name, value);
    const snapshot = async () => {
      const tables = (await database.pool.query('select tablename from pg_tables where schemaname=$1', [database.schema])).rows.map(row => row.tablename as string).sort();
      const state: Record<string, string> = {};
      for (const table of tables) if (!['evaluation_receipts', 'evaluation_reviewer_attestations'].includes(table)) {
        const rows = (await database.pool.query(`select row_to_json(t) as row from ${table} t`)).rows.map(row => encode(row.row)).sort();
        state[table] = digest(rows);
      }
      return state;
    };
    const before = await snapshot();
    const app = await createApp(emptyIntelligenceStore());
    try {
      const headers = { authorization: 'Bearer e1-a-test-operator' };
      const forgedRead = await app.inject('/v1/receipt-spine/evaluation/raw_sql_forgery');
      expect(forgedRead.statusCode).toBe(409);
      expect(forgedRead.json().error).toBe('evaluation_receipt_authority_invalid');
      for (const endpoint of ['/v1/evaluate', '/internal/receipt-spine/evaluation']) {
        expect((await app.inject({ method: 'POST', url: endpoint, payload: { attestation: r.attestation } })).statusCode).toBe(401);
        expect((await app.inject({ method: 'POST', url: endpoint, headers, payload: { ...evaluationInput(), evaluator: { verification: 'verified' } } })).statusCode).toBe(400);
        expect((await app.inject({ method: 'POST', url: endpoint, headers, payload: { attestation: { ...r.attestation, verdict: 'contradicted' } } })).statusCode).toBe(403);
        const accepted = await app.inject({ method: 'POST', url: endpoint, headers, payload: { attestation: r.attestation } });
        expect(accepted.statusCode, accepted.body).toBe(200);
        expect(await verifyReceiptChain('evaluation', accepted.json().data, store)).toBe(true);
      }
      for (const endpoint of ['/v1/score/provider_test', '/v1/receipt-spine/scores/provider/provider_test']) {
        const response = await app.inject(endpoint);
        expect(response.statusCode).toBe(503);
        expect(response.json().error).toBe('evaluation_reputation_projection_disabled');
      }
      expect(await count(r.execution.execution_id)).toBe(1);
      expect(await snapshot()).toEqual(before);
    } finally { await app.close(); }
  });

  it.skipIf(!runtimeUrl)('denies runtime DDL and destructive writes while allowing the reviewed append flow', async () => {
    const r = await ready();
    const pool = new pg.Pool({ connectionString: runtimeUrl, options: '-c search_path=' + database.schema });
    try {
      const runtimeStore = new PostgresCanonicalReceiptStore(pool, 80, issuer, REVIEWER_TRUST);
      const accepted = await createEvaluationService(runtimeStore, 80, now, REVIEWER_TRUST).acceptReviewed({ attestation: r.attestation }, 'canonical-admin');
      expect(await verifyReceiptChain('evaluation', accepted, runtimeStore)).toBe(true);
      for (const sql of ['drop table evaluation_reviewer_attestations', 'alter table evaluation_reviewer_attestations disable trigger all',
        'update evaluation_reviewer_attestations set verdict=verdict', 'delete from evaluation_reviewer_attestations', 'truncate evaluation_reviewer_attestations']) {
        await expect(pool.query(sql)).rejects.toMatchObject({ code: '42501' });
      }
    } finally { await pool.end(); }
  });

  it.each(['reviewer-first', 'track-a-first'] as const)('tests DDL coexistence with pinned Track A migrations in %s order without merging code', async order => {
    const shared = migrations.filter(file => Number(file.split('_')[1]) <= 17);
    const db = await createCanonicalTestDatabase(url!, 'e1_a_compatibility', shared);
    const client = await db.pool.connect();
    try {
      const trackA = 'f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79';
      const extra = execFileSync('git', ['ls-tree', '-r', '--name-only', trackA, '--', 'migrations'], { encoding: 'utf8' }).trim().split('\n')
        .filter(file => file.endsWith('.up.sql') && Number(file.split('_')[1]) >= 18).sort();
      const reviewerSql = [18, 23].map(number => migrations.find(file => Number(file.split('_')[1]) === number)!)
        .map(file => readFileSync('migrations/' + file + '.up.sql', 'utf8'));
      const trackSql = extra.map(file => execFileSync('git', ['show', trackA + ':' + file], { encoding: 'utf8' }));
      for (const sql of order === 'reviewer-first' ? [...reviewerSql, ...trackSql] : [...trackSql, ...reviewerSql]) await client.query(sql);
      const tables = (await client.query("select tablename from pg_tables where schemaname=current_schema() and tablename in ('evaluation_reviewer_attestations','decision_contexts','canonical_receipt_acceptances')")).rows;
      expect(tables).toHaveLength(3);
    } finally { await client.query('rollback'); client.release(); await db.close(); }
  });
});
