import assert from 'node:assert/strict';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { encodePaymentSignatureHeader, decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { createApp } from '../../src/api/app';
import { createCanonicalTestDatabase } from '../../tests/helpers/canonicalPostgres';
import { request as baseRequest, facts } from '../../tests/helpers/judgmentFixtures';
import { issuerFixture } from '../../tests/helpers/judgmentIssuer';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { createX402JudgmentGateway } from '../../src/middleware/x402JudgmentMiddleware';
import { baseProofClient, createBaseSettlementProofVerifier } from '../../src/security/settlementProofVerifier';
import { executionProofSigningMessage } from '../../src/security/payloadSignatureVerifier';
import { hashCanonical, verifyReceiptIntegrity } from '../../src/services/receiptIntegrityService';
import { verifyReceiptChain } from '../../src/services/receiptAuthorityService';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createDerivedScoreService } from '../../src/services/derivedScoreService';
import { localInfrastructure, recipient } from './localInfrastructure';
import type { ExecuteProofRequest } from '../../src/schemas/executeProof';
import type { JudgmentReceipt, ReceiptKind } from '../../src/schemas/receipts';

const request = { ...baseRequest, subject_id: 'provider_pay_sh_quartz', intent: 'price_token_quote' };

export async function runClosedLoop(connectionString: string, save = false) {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname), 'local database required');
  const database = await createCanonicalTestDatabase(connectionString, 'phase5', readdirSync('migrations').filter(f => f.endsWith('.up.sql')).sort().map(f => f.replace('.up.sql', '')));
  const infra = await localInfrastructure();
  const priorEnv = { ...process.env };
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  let clock = new Date('2026-10-08T00:00:02Z');
  const issuer = issuerFixture('phase5-local');
  const trust = createJudgmentIssuer(issuer);
  const sequence: unknown[] = [];
  const negatives: unknown[] = [];
  try {
    const dbUrl = new URL(connectionString); dbUrl.searchParams.set('options', `-c search_path=${database.schema}`);
    Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: dbUrl.href, ADMIN_TOKEN: 'phase5-local-admin', JUDGMENT_PAYMENT_ENABLED: 'false',
      JUDGMENT_ISSUER: issuer.issuer, JUDGMENT_ISSUER_KEYS_JSON: JSON.stringify(issuer.keys), JUDGMENT_SIGNING_KEY_ID: issuer.activeKeyId, JUDGMENT_SIGNING_PRIVATE_KEY: issuer.privateKeyPem,
      INGESTION_ENABLED: 'false', MONITOR_ENABLED: 'false', PAYSH_BOOTSTRAP_ENABLED: 'false', MACHINE_DEMO_SEED: 'false', IPX_PLTR_SHADOW_OBSERVATION_ENABLED: 'false' });
    const gateway = await createX402JudgmentGateway({ facilitatorUrl: infra.url, payTo: recipient, amount: '0.01', resourceUrl: 'http://127.0.0.1/v1/pre-spend/check' });
    const start = async () => {
      app = await createApp(undefined, undefined, { judgmentGateway: gateway, protocolNow: () => clock,
        executionProofVerifier: createBaseSettlementProofVerifier(await baseProofClient(infra.url + '/rpc')) });
      return app.listen({ host: '127.0.0.1', port: 0 });
    };
    let base = await start();
    const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
      const response = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const json = await response.json();
      const redact = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (key, v) => /signature/i.test(key) ? '[REDACTED]' : v));
      sequence.push({ method, url, request: redact(body ?? null), request_headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, /authorization|payment-signature/i.test(k) ? '[REDACTED]' : v])),
        status: response.status, response: redact(json), response_headers: Object.fromEntries([...response.headers].filter(([k]) => /payment|idempotency|server-timing/.test(k))) });
      return { status: response.status, body: json, headers: response.headers };
    };
    const admin = { authorization: 'Bearer phase5-local-admin' };
    const store = new PostgresCanonicalReceiptStore(database.pool, 80, trust);
    const state = async () => ({ receipts: await Promise.all((['observation', 'judgment', 'execution', 'evaluation'] as ReceiptKind[]).map(async kind => ({ kind, records: await store.list(kind) }))), score: await createDerivedScoreService(store).project('provider', request.subject_id) });
    const rejected = async (name: string, method: string, url: string, body: unknown, headers: Record<string, string>, status: number) => {
      const before = await state(); const response = await call(method, url, body, headers);
      assert.equal(response.status, status, name + ': ' + JSON.stringify(response.body)); assert.deepEqual(await state(), before, name + ' changed authoritative state');
      negatives.push({ name, status, error: response.body.error ?? null, authoritative_state_unchanged: true }); return response;
    };
    const providerRequestHash = hashCanonical({ provider_request: 'quote' });
    const observe = async (id: string, extra: Record<string, unknown> = {}) => {
      const at = new Date(clock.getTime() - 1000).toISOString();
      const response = await call('POST', '/internal/receipt-spine/observation', { observation_id: id, subject_type: 'provider', subject_id: request.subject_id,
        intent_hash: hashCanonical(request), source_type: 'reviewed_judgment_facts', source_id: 'phase5-local-review', observed_at: at, ingested_at: at,
        freshness_expires_at: new Date(clock.getTime() + 3600000).toISOString(), evidence_state: 'sufficient', evidence_refs: ['local://phase5/catalog'],
        provenance: { catalog_source: 'live', evidence_classification: 'LOCAL', source_adapter: 'deterministic_loopback' }, payload: { ...facts, route_id: 'route_pay_sh_token_quote_01',
          execution: { profile: 'base_usdc_external.v1', request_hash: providerRequestHash, pay_to: recipient, signer: infra.signer } }, ...extra }, admin);
      assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body.data;
    };
    const publicKeysResponse = await call('GET', '/v1/judgment-issuer/keys');
    assert.equal(publicKeysResponse.status, 200);
    const publicJudgmentIssuerKeys = publicKeysResponse.body.data;
    const publicTrust = createJudgmentIssuer({ issuer: publicJudgmentIssuerKeys.issuer, keys: publicJudgmentIssuerKeys.keys });
    const scoreBefore = (await call('GET', '/v1/score/' + request.subject_id)).body.data;
    await observe('phase5-observation-first');
    const challenge = await rejected('Missing x402 payment', 'POST', '/v1/pre-spend/check', request, { 'idempotency-key': 'phase5-first' }, 402);
    assert.deepEqual(decodePaymentRequiredHeader(challenge.headers.get('payment-required')!).accepts, gateway.requirements);
    const payment = encodePaymentSignatureHeader(await infra.payment(gateway.requirements[0], 'first'));
    await rejected('Invalid payment', 'POST', '/v1/pre-spend/check', request, { 'idempotency-key': 'phase5-first', 'payment-signature': 'invalid' }, 400);
    const invalidCrypto = await infra.payment(gateway.requirements[0], 'bad-crypto'); invalidCrypto.payload.signature = ('0x' + '0'.repeat(130)) as `0x${string}`;
    await rejected('Invalid payment signature', 'POST', '/v1/pre-spend/check', request, { 'idempotency-key': 'phase5-first', 'payment-signature': encodePaymentSignatureHeader(invalidCrypto) }, 400);
    const firstResponse = await call('POST', '/v1/pre-spend/check', request, { 'idempotency-key': 'phase5-first', 'payment-signature': payment });
    assert.equal(firstResponse.status, 200, JSON.stringify(firstResponse.body));
    const first: JudgmentReceipt = firstResponse.body.receipt; assert.equal(first.decision, 'proceed');
    assert.equal(trust.verify(first), true); assert.equal(publicTrust.verify(first), true);
    assert.equal(decodePaymentResponseHeader(firstResponse.headers.get('payment-response')!).success, true);
    await rejected('Duplicate payment replay', 'POST', '/v1/pre-spend/check', request, { 'idempotency-key': 'phase5-replay', 'payment-signature': payment }, 409);
    await rejected('Judgment idempotency conflict', 'POST', '/v1/pre-spend/check', { ...request, budget: 2 }, { 'idempotency-key': 'phase5-first', 'payment-signature': payment }, 409);
    const settlementRequest = { timestamp: Date.parse('2026-10-08T00:00:03Z') / 1000, reference: 'phase5-external' };
    const settlement = await (await fetch(infra.url + '/external-settle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(settlementRequest) })).json();
    sequence.push({ method: 'POST', url: 'LOCAL_ADAPTER/external-settle', request: settlementRequest, status: 200, response: settlement });
    clock = new Date('2026-10-08T00:00:04Z');
    const proof: ExecuteProofRequest = { judgment_id: first.judgment_id, settlement: { rail: 'base-usdc', transaction_hash: settlement.transaction },
      request_hash: providerRequestHash, response_hash: hashCanonical({ output: 'contradicted_quote' }), latency_ms: 12, status: 'succeeded', cost: { amount: '0.1', asset: 'USDC' },
      artifact_refs: ['local://phase5/contradicted-output'], executed_at: '2026-10-08T00:00:03Z', idempotency_key: 'phase5-execute' };
    const sign = async (input: ExecuteProofRequest, parent = first) => ({ ...input, payload_signature: await infra.sign(executionProofSigningMessage(input, parent)) });
    await rejected('Invalid execution proof', 'POST', '/v1/execute-proof', { ...proof, payload_signature: '0x' + '0'.repeat(130) }, {}, 401);
    await rejected('Execution signed against corrupted parent hash', 'POST', '/v1/execute-proof', await sign(proof, { ...first, receipt_hash: 'sha256:' + 'f'.repeat(64) }), {}, 401);
    await rejected('Execution signed against substituted subject', 'POST', '/v1/execute-proof', await sign(proof, { ...first, subject_id: 'different-provider' }), {}, 401);
    await rejected('Incorrect settlement reference', 'POST', '/v1/execute-proof', await sign({ ...proof, settlement: { rail: 'base-usdc', transaction_hash: '0x' + 'f'.repeat(64) } }), {}, 400);
    await rejected('Corrupted parent receipt hash', 'POST', '/internal/receipt-spine/execution', { ...proof, parent_hash: 'sha256:' + 'f'.repeat(64) }, admin, 400);
    await rejected('Cross-subject receipt substitution', 'POST', '/internal/receipt-spine/judgment', {
      judgment_id: 'substitution', subject_type: 'provider', subject_id: 'different-provider', intent_hash: first.intent_hash, decision: 'proceed', confidence: 90,
      reasons: ['substituted'], cited_observation_ids: first.cited_observation_ids, issued_at: first.issued_at, valid_until: first.valid_until,
      payment_required: false, payment_receipt_ref: null, charge: '0' }, admin, 400);
    const signed = await sign(proof);
    const executed = await call('POST', '/v1/execute-proof', signed); assert.equal(executed.status, 200, JSON.stringify(executed.body));
    const execution = executed.body.data;
    assert.equal(execution.parent_hash, first.receipt_hash); assert.notEqual(execution.settlement_ref, first.payment_receipt_ref);
    const executionReplay = await call('POST', '/v1/execute-proof', signed); assert.deepEqual(executionReplay.body.data, execution);
    await rejected('Execution idempotency conflict', 'POST', '/v1/execute-proof', await sign({ ...proof, response_hash: hashCanonical('conflict') }), {}, 409);
    await rejected('Duplicate execution authorization', 'POST', '/v1/execute-proof', await sign({ ...proof, idempotency_key: 'duplicate-execution' }), {}, 409);
    const evaluationRequest = { execution_receipt_id: execution.execution_id, outcome: 'contradicted', evidence_refs: ['local://phase5/contradicted-output'], reasons: ['Quote contradicts independently reviewed expected output.'],
      evaluator: { type: 'internal', id: 'canonical-admin' }, idempotency_key: 'phase5-evaluate' };
    await rejected('Caller-authored score delta', 'POST', '/v1/evaluate', { ...evaluationRequest, score_delta: 99 }, admin, 400);
    await rejected('Unsupported evaluator signature', 'POST', '/v1/evaluate', { ...evaluationRequest, evaluator: { ...evaluationRequest.evaluator, signature: 'unsupported' } }, admin, 403);
    await rejected('Unauthenticated evaluator', 'POST', '/v1/evaluate', evaluationRequest, {}, 401);
    clock = new Date('2026-10-08T00:00:05Z');
    const evaluated = await call('POST', '/v1/evaluate', evaluationRequest, admin); assert.equal(evaluated.status, 200, JSON.stringify(evaluated.body));
    const evaluation = evaluated.body.data; assert.equal(evaluation.score_delta, -15); assert.equal(evaluation.policy_version, 'score-policy.v1');
    assert.deepEqual((await call('POST', '/v1/evaluate', evaluationRequest, admin)).body.data, evaluation);
    await rejected('Duplicate evaluation', 'POST', '/v1/evaluate', { ...evaluationRequest, idempotency_key: 'second-evaluation' }, admin, 409);
    await rejected('Evaluation idempotency conflict', 'POST', '/v1/evaluate', { ...evaluationRequest, outcome: 'confirmed' }, admin, 409);
    await rejected('Legacy reputation write', 'POST', '/v1/receipts', { confidence_delta: 15 }, {}, 400);
    const scoreAfter = (await call('GET', '/v1/score/' + request.subject_id)).body.data; assert.equal(scoreAfter.score, -15);
    clock = new Date('2026-10-08T00:00:06Z'); await observe('phase5-observation-second');
    const second = await call('POST', '/v1/pre-spend/check', request, { 'idempotency-key': 'phase5-second', 'payment-signature': encodePaymentSignatureHeader(await infra.payment(gateway.requirements[0], 'second')) });
    assert.equal(second.status, 200, JSON.stringify(second.body)); assert.equal(second.body.decision, 'do_not_spend'); assert.equal(second.body.receipt.confidence, 90); assert.equal(trust.verify(second.body.receipt), true); assert.equal(publicTrust.verify(second.body.receipt), true);
    assert.ok(second.body.reasons.includes('derived_score_below_policy_threshold'));
    for (const evidenceState of ['stale', 'insufficient']) {
      clock = new Date(clock.getTime() + 1000); await observe('phase5-' + evidenceState, { evidence_state: evidenceState, ...(evidenceState === 'insufficient' ? { evidence_refs: [] } : {}) });
      const blocked = await rejected(evidenceState + ' evidence stays free', 'POST', '/v1/pre-spend/check', request, { 'idempotency-key': 'phase5-' + evidenceState, 'payment-signature': payment }, 200);
      assert.equal(blocked.body.decision, 'insufficient_evidence'); assert.equal(blocked.body.payment_required, false); assert.equal(blocked.body.cost.amount, '0'); assert.equal(blocked.body.receipt, null);
    }
    const chain = (await call('GET', `/v1/receipt-spine/evaluation/${evaluation.evaluation_id}/chain`)).body.data;
    assert.equal(chain.verified, true); assert.equal(chain.nodes.length, 4);
    const replay = [];
    for (const node of chain.nodes) { assert.equal(verifyReceiptIntegrity(node.kind, node.receipt), true); assert.equal(await verifyReceiptChain(node.kind, node.receipt, store), true); replay.push({ kind: node.kind, id: node.id, hash: node.receipt.receipt_hash, verified: true }); }
    assert.deepEqual(await createDerivedScoreService(new PostgresCanonicalReceiptStore(database.pool, 80, trust)).project('provider', request.subject_id), scoreAfter);
    // Restart the HTTP application and read the persisted chain/projection again.
    await app!.close(); base = await start();
    assert.deepEqual((await call('GET', '/v1/score/' + request.subject_id)).body.data, scoreAfter);
    assert.equal((await call('GET', `/v1/receipt-spine/evaluation/${evaluation.evaluation_id}/chain`)).body.data.verified, true);
    for (const table of ['observation_receipts', 'judgment_receipts', 'execution_receipts', 'evaluation_receipts']) {
      for (const sql of [`update ${table} set receipt=receipt`, `delete from ${table}`, `truncate ${table}`]) await assert.rejects(database.pool.query(sql), (e: any) => ['55000', '0A000'].includes(e.code));
    }
    assert.equal(infra.events.filter((event: any) => event.boundary === 'settle' && event.success).length, 2);
    const result = { classification: 'LOCAL', public_judgment_issuer_keys: publicJudgmentIssuerKeys, database: 'isolated PostgreSQL schema; migrations 001–017 in local disposable database', fixed_clock: true,
      payment: { gateway: 'official x402 V2 exact EVM / HTTPFacilitatorClient', verification: 'EIP-712 TransferWithAuthorization signatures verified by loopback facilitator', settlement: 'deterministic local ledger; no blockchain broadcast', deployment_billing_configuration: 'unchanged; injected Base gateway exercises supported protocol boundary' },
      settlement: { ...settlement, verification: 'production finalized USDC Transfer verifier through viem HTTP JSON-RPC', limitation: 'RPC chain and transfer are deterministic fixtures; not testnet or live Pay.sh' },
      score_before: scoreBefore, score_after: scoreAfter, first_judgment: first, second_judgment: second.body.receipt, evaluation, chain, replay,
      negatives, request_response_sequence: sequence, infrastructure_events: infra.events, restart_replay: true, append_only_guards: true };
    if (save) { mkdirSync('output/phase5', { recursive: true }); writeFileSync('output/phase5/scenario.json', JSON.stringify(result, null, 2) + '\n'); }
    return result;
  } finally {
    await app?.close(); await infra.close(); await database.close();
    for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key]; Object.assign(process.env, priorEnv);
  }
}
