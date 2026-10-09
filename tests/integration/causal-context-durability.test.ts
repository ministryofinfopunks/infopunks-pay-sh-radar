import { generateKeyPairSync } from 'node:crypto';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { describe, expect, it } from 'vitest';
import { createCanonicalTestDatabase } from '../helpers/canonicalPostgres';
import { setupJudgment, request, legacy } from '../helpers/judgments';
import { qualifyingClassifiedExecution, classifiedArtifact } from '../helpers/canonicalReceipts';
import { evaluationRequest } from '../helpers/evaluations';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { PostgresCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { PostgresJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { createJudgmentService } from '../../src/services/judgmentService';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';
import { createCausalWitnessService } from '../../src/services/causalWitnessService';
import { verifyCausalWitnessOffline } from '../../src/services/causalWitnessOfflineVerifier';
import { verifyDecisionContext } from '../../src/services/decisionContextService';
import pg from 'pg';
import Fastify from 'fastify';
import { registerDecisionViewRoutes } from '../../src/api/decisionViewRoutes';
import { createDecisionViewService } from '../../src/services/decisionViewService';

describe.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('durable causal decision replay', () => {
  it('reloads signed J2 context and independently replays the fixed-input evaluation counterfactual', async () => {
    const database = await createCanonicalTestDatabase(process.env.CANONICAL_RECEIPT_TEST_URL!, 'causal_context', [
      '20261007_011_canonical_receipt_spine', '20261007_012_judgment_requests', '20261007_013_execution_proof_uniqueness',
      '20261007_014_derived_score_projection', '20261008_018_decision_context',
      '20261008_019_execution_score_eligibility', '20261008_020_receipt_acceptance', '20261008_021_free_assessment_attempts'
    ]);
    try {
      const pair = generateKeyPairSync('ed25519');
      const issuer = createJudgmentIssuer({ issuer: 'fixture-issuer', keys: [{ key_id: 'fixture',
        public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        valid_from: '2026-01-01T00:00:00Z', valid_until: '2027-01-01T00:00:00Z', revoked: false }], activeKeyId: 'fixture',
        privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() });
      const f = await setupJudgment({}, {}, {}, issuer);
      const store = new PostgresCanonicalReceiptStore(database.pool, 80, issuer);
      await store.append('observation', f.observation);
      let now = '2026-10-07T00:00:02Z';
      const service = () => createJudgmentService({ store: new PostgresCanonicalReceiptStore(database.pool, 80, issuer),
        journal: new PostgresJudgmentRequestRepository(database.pool), gateway: f.gateway, issuer,
        legacyCheck: () => legacy, observations: async () => [f.observation], threshold: 80, ttlMs: 60_000,
        amount: '0.01', now: () => new Date(now) });
      const j1 = await service().check(request, 'causal-j1', f.signature);
      const execution = await createReceiptAuthorityService(store, 80, issuer)
        .appendExecution({ ...qualifyingClassifiedExecution(false), judgment_id: j1.response.judgment_id });
      const evaluation = await createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:04Z'))
        .submit({ ...evaluationRequest, execution_receipt_id: execution.execution_id, output_artifact: classifiedArtifact(false) }, 'canonical-admin');
      now = '2026-10-07T00:00:05Z';
      f.facilitator.settle = async () => ({ success: true, transaction: '0x' + 'b'.repeat(64), network: 'eip155:8453', payer: '0x' + '1'.repeat(40) });
      const signature = encodePaymentSignatureHeader({ x402Version: 2, accepted: f.gateway.requirements[0],
        payload: { signature: 'second-causal', authorization: { nonce: 'second-causal' } } });
      const j2 = await service().check(request, 'causal-j2', signature);
      expect(j2.response.receipt?.decision).toBe('do_not_spend');
      const restored = new PostgresCanonicalReceiptStore(database.pool, 80, issuer);
      const context = await restored.getDecisionContext(j2.response.judgment_id);
      expect(context?.evaluation_refs.map(ref => ref.evaluation_id)).toEqual([evaluation.evaluation_id]);
      expect(await verifyDecisionContext(context!, j2.response.receipt!, restored)).toBe(true);
      const witness = await createCausalWitnessService(restored, issuer).build(j1.response.judgment_id, evaluation.evaluation_id, j2.response.judgment_id);
      expect(witness.context2.context_hash).toBe(context?.context_hash);
      expect(witness.counterfactual.output.decision).toBe('proceed');
      expect(witness.counterfactual.category_changed).toBe(true);
      expect(witness.real_route_verified).toBe(false);
      expect(witness.improvement_measured).toBe(false);
      expect((await verifyCausalWitnessOffline(witness)).valid).toBe(true);
      expect(await createCausalWitnessService(restored, issuer).verify(witness)).toBe(true);
      // Reconnect through a fresh pool, then exercise the real HTTP projection against committed records.
      const reconnectedPool = new pg.Pool({ connectionString: process.env.CANONICAL_RECEIPT_TEST_URL,
        options: `-c search_path=${database.schema}` });
      const reconnectedStore = new PostgresCanonicalReceiptStore(reconnectedPool, 80, issuer);
      const api = Fastify();
      try {
        registerDecisionViewRoutes(api, createDecisionViewService(reconnectedStore, issuer), {
          consume: () => ({ allowed: true, retryAfterMs: 0 })
        });
        const response = await api.inject(`/v1/decision-views/${j2.response.judgment_id}`);
        expect(response.statusCode).toBe(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.json().data.judgment.decision).toBe('do_not_spend');
        expect(response.json().data.verification).toMatchObject({ ancestry_valid: true,
          issuer_signature_valid: true, record_verified: true });
        expect(response.json().data.evidence.history_commitment).toEqual({
          status: 'committed_in_canonical_v2', hash: context?.projection_boundary.evaluation_refs_hash
        });
        expect(response.json().data.execution.authorized).toBe(false);
        expect(response.body).not.toContain('catalog_source');
        expect((await api.inject('/v1/decision-views/unknown')).statusCode).toBe(404);
      } finally {
        await api.close();
        await reconnectedPool.end();
      }
      const incompletePool = new pg.Pool({ connectionString: process.env.CANONICAL_RECEIPT_TEST_URL,
        options: '-c search_path=decision_view_missing_schema' });
      const unavailableApi = Fastify();
      try {
        registerDecisionViewRoutes(unavailableApi,
          createDecisionViewService(new PostgresCanonicalReceiptStore(incompletePool, 80, issuer), issuer), {
            consume: () => ({ allowed: true, retryAfterMs: 0 })
          });
        const response = await unavailableApi.inject(`/v1/decision-views/${j2.response.judgment_id}`);
        expect(response.statusCode).toBe(503);
        expect(response.headers['cache-control']).toBe('no-store');
      } finally {
        await unavailableApi.close();
        await incompletePool.end();
      }
      const offlineUrl = new URL(process.env.CANONICAL_RECEIPT_TEST_URL!);
      offlineUrl.port = '1';
      const offlinePool = new pg.Pool({ connectionString: offlineUrl.toString(),
        connectionTimeoutMillis: 100, max: 1 });
      const offlineApi = Fastify();
      try {
        registerDecisionViewRoutes(offlineApi,
          createDecisionViewService(new PostgresCanonicalReceiptStore(offlinePool, 80, issuer), issuer), {
            consume: () => ({ allowed: true, retryAfterMs: 0 })
          });
        const response = await offlineApi.inject(`/v1/decision-views/${j2.response.judgment_id}`);
        expect(response.statusCode).toBe(503);
        expect(response.headers['cache-control']).toBe('no-store');
      } finally {
        await offlineApi.close();
        await offlinePool.end();
      }
    } finally { await database.close(); }
  });
});
