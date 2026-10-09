import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app';
import { emptyIntelligenceStore } from '../../src/services/intelligenceStore';
import { evaluationRequest } from '../helpers/evaluations';
import { observationInput, judgmentInput, executionInput } from '../helpers/canonicalReceipts';
import { FORBIDDEN_SCORE_FIELDS } from '../../src/schemas/evaluate';
import { ScoreProjectionSchema } from '../../src/schemas/scoreProjection';
import { createOpenApiSpec } from '../../src/api/openapi';
import { REVIEWER_REGISTRY, signedEvaluationAttestation } from '../helpers/evaluationReview';
import { EvaluationReceiptSchema } from '../../src/schemas/receipts';
afterEach(() => vi.unstubAllEnvs());

it('requires operator auth plus reviewer attestation and keeps E1 reputation projection disabled', async () => {
  vi.stubEnv('ADMIN_TOKEN', 'test-phase4');
  vi.stubEnv('EVALUATION_REVIEWER_TRUST_JSON', JSON.stringify(REVIEWER_REGISTRY));
  vi.stubEnv('EVALUATION_REPUTATION_PROJECTION_ENABLED', 'false');
  const app = await createApp(emptyIntelligenceStore());
  const headers = { authorization: 'Bearer test-phase4' };
  try {
    expect((await app.inject('/v1/score/provider_test')).statusCode).toBe(503);
    expect((await app.inject('/v1/receipt-spine/scores/provider/provider_test')).statusCode).toBe(503);
    expect((await app.inject({ method: 'POST', url: '/v1/evaluate', payload: evaluationRequest })).statusCode).toBe(401);
    for (const field of FORBIDDEN_SCORE_FIELDS) {
      for (const url of ['/v1/evaluate', '/internal/receipt-spine/evaluation']) {
        const response = await app.inject({ method: 'POST', url, headers, payload: { attestation: signedEvaluationAttestation(), [field]: 15 } });
        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('score_delta_authoring_forbidden');
      }
    }
    for (const [kind, payload] of [['observation', observationInput()], ['judgment', judgmentInput()], ['execution', executionInput()]] as const) {
      const response = await app.inject({ method: 'POST', url: '/internal/receipt-spine/' + kind, headers, payload });
      expect(response.statusCode, response.body).toBe(200);
    }

    expect((await app.inject({ method: 'POST', url: '/v1/evaluate', headers, payload: evaluationRequest })).statusCode).toBe(400);
    const submission = { attestation: signedEvaluationAttestation() };
    const written = await app.inject({ method: 'POST', url: '/v1/evaluate', headers, payload: submission });
    expect(written.statusCode, written.body).toBe(200);
    const receipt = EvaluationReceiptSchema.parse(written.json().data);
    expect(receipt.evaluator?.verification).toBe('verified');
    expect(receipt.evaluator?.signature_ref).toMatch(/^sha256:[a-f0-9]{64}$/);

    const replay = await app.inject({ method: 'POST', url: '/internal/receipt-spine/evaluation', headers, payload: submission });
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json().data).toEqual(receipt);
    expect((await app.inject('/v1/score/provider_test')).statusCode).toBe(503);
    expect((await app.inject('/v1/receipt-spine/scores/provider/provider_test')).statusCode).toBe(503);

    const forged = { attestation: { ...submission.attestation, verdict: 'contradicted' } };
    expect((await app.inject({ method: 'POST', url: '/v1/evaluate', headers, payload: forged })).statusCode).toBe(403);
    const conflict = { attestation: signedEvaluationAttestation({ verdict: 'contradicted', nonce: 'nonce-conflict987654321' }) };
    expect((await app.inject({ method: 'POST', url: '/v1/evaluate', headers, payload: conflict })).statusCode).toBe(409);
  } finally { await app.close(); }
});

it('documents the strict signed-review evaluation API and disabled-capable score reads', () => {
  const spec = createOpenApiSpec() as { paths: Record<string, { post?: { requestBody: { content: Record<string, { schema: Record<string, unknown> }> } }; get?: unknown }> };
  const evaluateSchema = spec.paths['/v1/evaluate'].post!.requestBody.content['application/json'].schema;
  expect(evaluateSchema.additionalProperties).toBe(false);
  expect((evaluateSchema.properties as Record<string, unknown>).attestation).toBeDefined();
  expect(spec.paths['/v1/score/{subject}'].get).toBeDefined();
});
