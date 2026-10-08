import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app';
import { setupExecution } from '../helpers/executions';
import { observationInput } from '../helpers/canonicalReceipts';
import { sealReceipt } from '../../src/services/receiptIntegrityService';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('POST /v1/execute-proof', () => {
  it('is free, records verified proof and returns a stable canonical parent receipt', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'reviewer');
    vi.stubEnv('INGESTION_ENABLED', 'false');
    const f = await setupExecution();
    // Reviewed internal authority can publish free judgments; paid publication
    // must go through the already-tested payment boundary.
    const { payment: ignored, ...unpaid } = f.parent;
    const reviewedParent = sealReceipt('judgment', { ...unpaid, payment_required: false, payment_receipt_ref: null, charge: '0' });
    const submittedProof = await f.sign(f.proof, reviewedParent);
    const app = await createApp(undefined, undefined, { executionProofVerifier: f.verifier, judgmentGateway: f.gateway });
    try {
      const observation = f.observation;
      const obs = await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers: { authorization: 'Bearer reviewer' }, payload: {
        ...observationInput(), intent_hash: observation.intent_hash, source_type: observation.source_type, provenance: observation.provenance, payload: observation.payload
      } }); expect(obs.statusCode).toBe(200);
      const { schema_version: _v, policy_version: _p, proceed_confidence_threshold: _t, parent_hashes: _h, receipt_hash: _r, ...parent } = reviewedParent;
      const judgment = await app.inject({ method: 'POST', url: '/internal/receipt-spine/judgment', headers: { authorization: 'Bearer reviewer' }, payload: parent });
      expect(judgment.statusCode).toBe(200); expect(judgment.json().data.receipt_hash).toBe(reviewedParent.receipt_hash);
      const paidBefore = vi.mocked(f.facilitator.settle).mock.calls.length;
      const externalRequests = vi.spyOn(globalThis, 'fetch');
      const result = await app.inject({ method: 'POST', url: '/v1/execute-proof', payload: submittedProof });
      expect(result.statusCode).toBe(200); expect(result.headers['payment-required']).toBeUndefined(); expect(result.headers['payment-response']).toBeUndefined();
      expect(result.json().data.parent_hash).toBe(reviewedParent.receipt_hash);
      expect(result.json().data.verification.settlement.verified).toBe(true);
      const duplicate = await app.inject({ method: 'POST', url: '/v1/execute-proof', payload: submittedProof });
      expect(duplicate.json()).toEqual(result.json());
      const conflict = await app.inject({ method: 'POST', url: '/v1/execute-proof', payload: { ...submittedProof, latency_ms: 99 } }); expect(conflict.statusCode).toBe(409);
      expect(vi.mocked(f.facilitator.settle).mock.calls.length).toBe(paidBefore);
      expect(externalRequests).not.toHaveBeenCalled();
      expect((await app.inject('/v1/receipt-spine/scores/provider/provider_test')).json().data.score).toBe(0);
      // Public reads need no wallet or signature.
      expect((await app.inject('/v1/receipt-spine/execution/' + result.json().data.execution_id)).statusCode).toBe(200);
    } finally { await app.close(); }
  });
  it('rejects malformed free write requests and enforces the write rate limit', async () => {
    const app = await createApp();
    try {
      for (let i=0;i<20;i++) {
        const response = await app.inject({ method: 'POST', url: '/v1/execute-proof', payload: { request_hash: 'bad', raw_secret: 'not accepted' } });
        expect(response.statusCode).toBe(400); expect(response.headers['payment-required']).toBeUndefined();
      }
      expect((await app.inject({ method: 'POST', url: '/v1/execute-proof', payload: {} })).statusCode).toBe(429);
    } finally { await app.close(); }
  });
});
