import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app';
import { emptyIntelligenceStore } from '../../src/services/intelligenceStore';
import { evaluationRequest } from '../helpers/evaluations';
import { observationInput, judgmentInput, executionInput } from '../helpers/canonicalReceipts';
import { FORBIDDEN_SCORE_FIELDS } from '../../src/schemas/evaluate';
import { ScoreProjectionSchema } from '../../src/schemas/scoreProjection';
import { createOpenApiSpec } from '../../src/api/openapi';
afterEach(() => vi.unstubAllEnvs());
it('exposes strict evaluation, authenticated provenance, idempotency, and free score reads', async () => {
  vi.stubEnv('ADMIN_TOKEN', 'test-phase4'); const app = await createApp(emptyIntelligenceStore());
  const headers = { authorization: 'Bearer test-phase4' };
  try {
    const baseline = await app.inject('/v1/score/provider_test');
    expect(baseline.statusCode).toBe(200); expect(baseline.headers['payment-required']).toBeUndefined();
    expect(baseline.json().data.score).toBe(0);
    expect((await app.inject({ method: 'POST', url: '/v1/evaluate', payload: evaluationRequest })).statusCode).toBe(401);
    for (const field of FORBIDDEN_SCORE_FIELDS) {
      for (const url of ['/v1/evaluate', '/internal/receipt-spine/evaluation']) {
        const response = await app.inject({ method: 'POST', url, headers, payload: { ...evaluationRequest, [field]: 15 } });
        expect(response.statusCode).toBe(400); expect(response.json().error).toBe('score_delta_authoring_forbidden');
      }
    }
    for (const [kind, payload] of [['observation', observationInput()], ['judgment', judgmentInput()], ['execution', executionInput()]] as const) {
      const response = await app.inject({ method: 'POST', url: '/internal/receipt-spine/' + kind, headers, payload });
      expect(response.statusCode, response.body).toBe(200);
    }
    expect((await app.inject({ method: 'POST', url: '/v1/evaluate', headers, payload: { ...evaluationRequest, evaluator: { type: 'external', id: 'trusted' } } })).statusCode).toBe(403);
    const written = await app.inject({ method: 'POST', url: '/v1/evaluate', headers, payload: evaluationRequest });
    expect(written.statusCode, written.body).toBe(200); expect(written.json().data.score_delta).toBe(-15);
    expect((await app.inject({ method: 'POST', url: '/v1/evaluate', headers, payload: evaluationRequest })).json()).toEqual(written.json());
    expect((await app.inject({ method: 'POST', url: '/v1/evaluate', headers, payload: { ...evaluationRequest, outcome: 'confirmed' } })).statusCode).toBe(409);
    const score = await app.inject('/v1/score/provider_test');
    expect(ScoreProjectionSchema.parse(score.json().data)).toMatchObject({ score: -15, evaluation_count: 1, outcome_counts: { confirmed: 0, weakened: 0, contradicted: 1 } });
    expect(score.headers['payment-required']).toBeUndefined();
    expect((await app.inject('/v1/score/provider_test?subject_type=route')).json().data.score).toBe(0);
  } finally { await app.close(); }
});
it('documents the strict evaluation and free score API', () => {
  const spec = createOpenApiSpec() as { paths: Record<string, { post?: { requestBody: { content: Record<string, { schema: Record<string, unknown> }> } }; get?: unknown }> };
  expect(spec.paths['/v1/evaluate'].post!.requestBody.content['application/json'].schema.additionalProperties).toBe(false);
  expect(spec.paths['/v1/score/{subject}'].get).toBeDefined();
});
