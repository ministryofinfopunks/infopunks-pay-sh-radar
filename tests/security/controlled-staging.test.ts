import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app';
import { loadRuntimeConfig } from '../../src/config/env';
import { STAGING_ABSENT_BINDINGS, STAGING_DISABLED_FLAGS } from '../../src/config/controlledStaging';
import { request, setupJudgment, legacy } from '../helpers/judgments';
import { createJudgmentService } from '../../src/services/judgmentService';
import { createEvaluationService } from '../../src/services/evaluationService';
import { classifiedArtifact, qualifyingClassifiedExecution } from '../helpers/canonicalReceipts';
import { evaluationRequest } from '../helpers/evaluations';
import { configureTestTenant, testTenantKey } from '../helpers/judgmentDx';

afterEach(() => vi.unstubAllEnvs());
describe('controlled staging authority boundary', () => {
  it.each(STAGING_DISABLED_FLAGS)('rejects activation of %s before startup', name => {
    expect(() => loadRuntimeConfig({ NODE_ENV: 'test', RADAR_CONTROLLED_STAGING: 'true', [name]: 'true' }))
      .toThrow(name + ': controlled_staging_capability_forbidden');
  });
  it.each(STAGING_ABSENT_BINDINGS)('rejects authority binding %s without leaking its value', name => {
    expect(() => loadRuntimeConfig({ NODE_ENV: 'test', RADAR_CONTROLLED_STAGING: 'true', [name]: 'test-sensitive-value' }))
      .toThrow(name + ': controlled_staging_binding_forbidden');
  });
  it('blocks public, admin and unknown mutations before body parsing and rejects payment headers', async () => {
    vi.stubEnv('RADAR_CONTROLLED_STAGING', 'true'); vi.stubEnv('ADMIN_TOKEN', 'staging-test-only');
    configureTestTenant();
    const app = await createApp();
    try {
      for (const url of ['/v1/receipts', '/v1/validation/submit', '/v1/evaluate', '/v1/execute-proof',
        '/internal/receipt-spine/observation', '/internal/receipt-spine/judgment', '/internal/receipt-spine/execution',
        '/internal/receipt-spine/evaluation', '/v1/claims', '/v1/ingest/pay-sh', '/unknown-write']) {
        for (const authorization of [undefined, 'Bearer wrong', 'Bearer staging-test-only']) {
          const response = await app.inject({ method: 'POST', url, payload: { score_delta: 100 }, headers: authorization ? { authorization } : {} });
          expect(response.statusCode, url).toBe(403);
          expect(response.json().error).toBe('controlled_staging_write_disabled');
        }
      }
      const denied = await app.inject({ method: 'POST', url: '/v1/decide', payload: request, headers: { 'payment-signature': 'pretend' } });
      expect(denied.statusCode).toBe(403);
      for (const url of ['/v1/score/provider_test', '/v1/receipt-spine/scores/provider/provider_test']) {
        expect((await app.inject({ url, headers: { authorization: 'Bearer staging-test-only' } })).statusCode).toBe(503);
      }
      expect((await app.inject('/v1/routes')).statusCode).toBe(200);
      expect((await app.inject('/v1/decision-views/nonexistent')).statusCode).toBe(401);
      expect((await app.inject({ url: '/v1/decision-views/nonexistent', headers: { authorization: 'Bearer staging-test-only' } })).statusCode).toBe(404);
      const headers = { authorization: 'Bearer ' + testTenantKey, 'idempotency-key': 'staging-free' };
      const first = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request, headers });
      const retry = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request, headers });
      expect(first.statusCode).toBe(200); expect(retry.json()).toEqual(first.json());
      expect(first.json()).toMatchObject({ decision: 'insufficient_evidence', payment_required: false, receipt: null, cost: { amount: '0' } });
      expect(first.headers['payment-required']).toBeUndefined();
      const conflict = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: { ...request, intent: 'unsupported-new-intent' }, headers });
      expect(conflict.statusCode).toBe(409);
      const unsupported = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: { ...request, intent: 'unsupported-new-intent' }, headers: { authorization: 'Bearer ' + testTenantKey } });
      expect(unsupported.json()).toMatchObject({ decision: 'insufficient_evidence', payment_required: false, receipt: null });
      for (let n = 0; n < 27; n++) await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request, headers: { authorization: 'Bearer ' + testTenantKey } });
      expect((await app.inject({ method: 'POST', url: '/v1/decide', payload: request, headers: { authorization: 'Bearer ' + testTenantKey } })).statusCode).toBe(429);
    } finally { await app.close(); }
  });
  it('refuses unreviewed classified history before challenge, settlement or new judgment', async () => {
    const f = await setupJudgment();
    const j1 = await f.service.check(request, 'history-j1', f.signature);
    const x = await f.authority.appendExecution({ ...qualifyingClassifiedExecution(false), judgment_id: j1.response.judgment_id });
    await createEvaluationService(f.store, 80, () => new Date('2026-10-07T00:00:04Z')).submit({ ...evaluationRequest,
      execution_receipt_id: x.execution_id, output_artifact: classifiedArtifact(false) }, 'canonical-admin');
    const service = createJudgmentService({ store: f.store, journal: f.journal, gateway: f.gateway,
      legacyCheck: () => legacy, observations: async () => [f.observation], threshold: 80, ttlMs: 60000,
      amount: '0.01', now: () => new Date('2026-10-07T00:00:05Z'), requireIndependentEvaluationReview: true });
    await expect(service.check(request, 'history-j2', f.signature)).rejects.toMatchObject({ statusCode: 503, code: 'independent_evaluation_history_review_unavailable' });
    expect(await f.store.list('judgment')).toHaveLength(1);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
    // Previously issued receipts and commitments still replay byte for byte.
    expect((await service.check(request, 'history-j1', f.signature)).response.receipt).toEqual(j1.response.receipt);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
});
