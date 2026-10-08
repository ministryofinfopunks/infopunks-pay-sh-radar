import { createCanonicalTestDatabase } from './helpers/canonicalPostgres';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { PostgresCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService } from '../src/services/receiptAuthorityService';
import { createEvaluationService } from '../src/services/evaluationService';
import { inspectRhChainMigrationLedger } from '../src/services/rhChainProductionReadiness';
import { sealReceipt } from '../src/services/receiptIntegrityService';
import { appendChain, observationInput, judgmentInput, executionInput, evaluationInput } from './helpers/canonicalReceipts';

afterEach(() => vi.unstubAllEnvs());
describe('receipt spine API integration', () => {
  it('binds internal evaluation writes to EvaluationService, not ReceiptAuthorityService', () => {
    const source = readFileSync('src/api/app.ts', 'utf8');
    expect(source).toContain("['evaluation', z.object(EvaluationReceiptSchema.shape).strict().omit({ schema_version: true, policy_version: true, score_delta: true, parent_hash: true, receipt_hash: true, evaluator: true, request_hash: true, classification: true, proposed_outcome: true }), evaluationService.createEvaluation]");
    expect(source).not.toContain('receiptAuthority.appendEvaluation');
  });
  it('authenticates canonical authority, appends the four levels, and retains legacy read APIs', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'test-receipt-authority');
    const app = await createApp(emptyIntelligenceStore());
    try {
      const headers = { authorization: 'Bearer test-receipt-authority' };
      const url = '/internal/receipt-spine/observation';
      expect((await app.inject({ method: 'POST', url, payload: observationInput() })).statusCode).toBe(401);
      const inputs = { observation: observationInput(), judgment: judgmentInput(), execution: executionInput(), evaluation: evaluationInput() };
      for (const kind of ['observation', 'judgment', 'execution', 'evaluation'] as const) {
        const written = await app.inject({ method: 'POST', url: `/internal/receipt-spine/${kind}`, headers, payload: inputs[kind] });
        expect(written.statusCode, written.body).toBe(200);
        expect(written.headers['cache-control']).toBe('private, no-store');
        const data = written.json().data;
        const read = await app.inject({ method: 'GET', url: `/v1/receipt-spine/${kind}/${Object.values(inputs[kind])[0]}` });
        expect(read.statusCode).toBe(200); expect(read.json().data).toEqual(data);
      }
      expect((await app.inject('/v1/receipt-spine/scores/provider/provider_test')).json().data).toEqual({ subject_type: 'provider', subject_id: 'provider_test', score: 0, authority: 'EvaluationReceipt' });
      expect((await app.inject('/v1/receipts')).statusCode).toBe(200);
      expect((await app.inject('/v1/claims')).statusCode).toBe(200);
      expect((await app.inject('/v1/checks')).statusCode).toBe(200);
      expect((await app.inject('/v1/loops')).statusCode).toBe(200);
    } finally { await app.close(); }
  });
  it('rejects client-authored deltas and missing ancestry without writing', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'test-receipt-authority');
    const app = await createApp(emptyIntelligenceStore());
    try {
      const headers = { authorization: 'Bearer test-receipt-authority' };
      for (const [kind, payload, error] of [
        ['observation', { ...observationInput(), score_delta: 99 }, 'invalid_canonical_receipt'],
        ['judgment', judgmentInput(), 'observation_not_found'],
        ['execution', executionInput(), 'judgment_not_found'],
        ['evaluation', evaluationInput(), 'execution_not_found']
      ] as const) {
        const response = await app.inject({ method: 'POST', url: `/internal/receipt-spine/${kind}`, headers, payload });
        expect(response.statusCode, response.body).toBe(400); expect(response.json()).toEqual({ error });
      }
      for (const field of ['score_delta', 'scoreDelta', 'confidence_delta', 'confidenceDelta']) {
        const response = await app.inject({ method: 'POST', url: '/internal/receipt-spine/evaluation', headers, payload: { ...evaluationInput(), [field]: 99 } });
        expect(response.statusCode, response.body).toBe(400);
        expect(response.json()).toEqual({ error: 'score_delta_authoring_forbidden' });
      }
      expect((await app.inject('/v1/receipt-spine/scores/provider/provider_test')).json().data.score).toBe(0);
    } finally { await app.close(); }
  });
});

// Dedicated disposable PostgreSQL only. Each run creates its own schema; no shared data is removed.
const testUrl = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!testUrl)('receipt spine PostgreSQL durability', () => {
  let database: Awaited<ReturnType<typeof createCanonicalTestDatabase>>;
  let pool: pg.Pool; let store: PostgresCanonicalReceiptStore;
  beforeEach(async () => {
    database = await createCanonicalTestDatabase(testUrl!, 'receipt_test', ['20261007_011_canonical_receipt_spine', '20261007_014_derived_score_projection', '20261008_018_decision_context', '20261008_020_receipt_acceptance']);
    pool = database.pool; store = new PostgresCanonicalReceiptStore(pool);
  });
  afterEach(async () => { await database?.close(); });
  it('persists multiple observation parents and replays after repository reconstruction', async () => {
    const service = createReceiptAuthorityService(store);
    const evaluations = createEvaluationService(store);
    await service.appendObservation(observationInput()); await service.appendObservation(observationInput('o2'));
    await service.appendJudgment(judgmentInput(['o1', 'o2'])); await service.appendExecution(executionInput()); await evaluations.createEvaluation(evaluationInput());
    expect((await pool.query('select * from judgment_observations where judgment_id=$1', ['j1'])).rows).toHaveLength(2);
    const restarted = createReceiptAuthorityService(new PostgresCanonicalReceiptStore(pool));
    expect(await restarted.replayEvaluation('e1')).toBe(true);
    expect((await restarted.projectScore('provider', 'provider_test')).score).toBe(0);
    expect(await evaluations.createEvaluation(evaluationInput())).toEqual(await store.get('evaluation', 'e1'));
  });
  it('recognizes the migrated schema and enabled immutability guards in readiness', async () => {
    const ledger = await inspectRhChainMigrationLedger(pool);
    expect(ledger.migrations.find((migration) => migration.id === '20261007_011')).toMatchObject({ state: 'applied', missing_tables: [], missing_indexes: [], missing_checks: [] });
  });
  it('rejects duplicate evaluation authority and mismatched parent hashes', async () => {
    await appendChain(store);
    const service = createReceiptAuthorityService(store);
    const evaluations = createEvaluationService(store);
    await expect(evaluations.createEvaluation({ ...evaluationInput(), evaluation_id: 'e2' })).rejects.toThrow('execution_already_evaluated');
    const receipt = await store.get('execution', 'x1');
    expect(receipt).toBeTruthy();
    if (receipt && 'judgment_id' in receipt) {
      await expect(store.append('execution', sealReceipt('execution', { ...receipt, execution_id: 'bad', parent_hash: 'sha256:' + '0'.repeat(64) }))).rejects.toThrow('parent_hash_mismatch');
    }
  });
  it('blocks UPDATE, DELETE, and TRUNCATE at database level for all five tables', async () => {
    await appendChain(store);
    for (const table of ['observation_receipts', 'judgment_receipts', 'execution_receipts', 'evaluation_receipts', 'judgment_observations']) {
      const column = table === 'judgment_observations' ? 'judgment_id' : 'receipt_hash';
      for (const sql of [`update ${table} set ${column}=${column}`, `delete from ${table}`, `truncate ${table} cascade`]) {
        await expect(pool.query(sql)).rejects.toMatchObject({ code: '55000' });
      }
    }
    expect(await createReceiptAuthorityService(store).replayEvaluation('e1')).toBe(true);
  });
  it('enforces execution/evaluation foreign keys even against direct SQL inserts', async () => {
    for (const [table, id, parentId, time] of [
      ['execution_receipts', 'execution_id', 'judgment_id', 'executed_at'],
      ['evaluation_receipts', 'evaluation_id', 'execution_id', 'evaluated_at']
    ]) {
      const body = { [id]: 'missing_parent', [parentId]: 'missing', [time]: '2026-10-07T00:00:10Z', parent_hash: 'sha256:' + '0'.repeat(64), receipt_hash: 'sha256:' + '1'.repeat(64), schema_version: 'canonical-receipts.v1', policy_version: 'receipt-authority.v1', outcome: 'confirmed', score_delta: 5 };
      if (table === 'execution_receipts') delete (body as Record<string, unknown>).score_delta;
      await expect(pool.query(`insert into ${table} (${id},${parentId},parent_hash,${time},receipt_hash,receipt) values ($1,$2,$3,$4,$5,$6)`, ['missing_parent', 'missing', body.parent_hash, body[time], body.receipt_hash, body])).rejects.toMatchObject({ code: '23503' });
    }
  });
  it('rejects a judgment with nonexistent observation membership on transaction commit', async () => {
    await appendChain(store);
    const original = await store.get('judgment', 'j1');
    const body = { ...original, judgment_id: 'missing_observation', cited_observation_ids: ['missing'], parent_hashes: ['sha256:' + '0'.repeat(64)] };
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('insert into judgment_receipts (judgment_id,subject_type,subject_id,issued_at,receipt_hash,receipt) values ($1,$2,$3,$4,$5,$6)', ['missing_observation', 'provider', 'provider_test', '2026-10-07T00:00:02Z', 'sha256:' + '2'.repeat(64), { ...body, receipt_hash: 'sha256:' + '2'.repeat(64) }]);
      await expect(client.query('insert into judgment_observations (judgment_id,observation_id) values ($1,$2)', ['missing_observation', 'missing'])).rejects.toMatchObject({ code: '23503' });
    } finally { await client.query('rollback'); client.release(); }
  });
});
