import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodePaymentSignatureHeader, decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { createApp } from '../../src/api/app';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { request, facts, setupJudgment } from '../helpers/judgments';
import { observationInput } from '../helpers/canonicalReceipts';

afterEach(() => vi.unstubAllEnvs());
describe('pre-spend HTTP payment lifecycle', () => {
  it.each(['/v1/pre-spend/check', '/v1/decide'])('issues a V2 challenge and proof-bound receipt replay at %s', async (url) => {
    vi.stubEnv('ADMIN_TOKEN', 'reviewer');
    const f = await setupJudgment(); const app = await createApp(undefined, undefined, { judgmentGateway: f.gateway });
    const input = { ...request, intent: 'buy_market_research', subject_id: 'route_pay_sh_market_research_03', required_confidence: 80 };
    try {
      const diagnostic = await app.inject({ method: 'POST', url, payload: input, headers: { authorization: 'Bearer reviewer' } });
      const route = diagnostic.json().data.recommended_route;
      const at = new Date();
      const seed = await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers: { authorization: 'Bearer reviewer' }, payload: {
        ...observationInput(), subject_type: 'route', subject_id: input.subject_id, intent_hash: hashCanonical(input), source_type: 'reviewed_judgment_facts',
        observed_at: at.toISOString(), ingested_at: at.toISOString(), freshness_expires_at: new Date(at.getTime() + 120000).toISOString(),
        provenance: { catalog_source: 'live' }, payload: { ...facts, route_id: route }
      } });
      expect(seed.statusCode).toBe(200);
      const unpaid = await app.inject({ method: 'POST', url, payload: input, headers: { authorization: 'Bearer reviewer', 'idempotency-key': 'paid' } });
      expect(unpaid.statusCode).toBe(402);
      const challenge = decodePaymentRequiredHeader(String(unpaid.headers['payment-required']));
      const signature = encodePaymentSignatureHeader({ x402Version: 2, accepted: challenge.accepts[0], payload: { signature: 'test-only' } });
      const invalid = await app.inject({ method: 'POST', url, payload: input, headers: { authorization: 'Bearer reviewer', 'idempotency-key': 'paid', 'payment-signature': 'invalid' } });
      expect(invalid.statusCode).toBe(400);
      for (const payload of [null, { x402Version: 2 }]) {
        const malformed = await app.inject({ method: 'POST', url, payload: input, headers: { authorization: 'Bearer reviewer', 'idempotency-key': 'paid', 'payment-signature': Buffer.from(JSON.stringify(payload)).toString('base64') } });
        expect(malformed.statusCode).toBe(400);
        expect(malformed.json().error).toBe('invalid_payment_signature');
        expect(malformed.headers['idempotency-key']).toBeUndefined();
      }
      expect(f.facilitator.verify).not.toHaveBeenCalled();
      expect(f.facilitator.settle).not.toHaveBeenCalled();
      const paid = await app.inject({ method: 'POST', url, payload: input, headers: { authorization: 'Bearer reviewer', 'idempotency-key': 'paid', 'payment-signature': signature } });
      expect(paid.statusCode).toBe(200); expect(decodePaymentResponseHeader(String(paid.headers['payment-response'])).success).toBe(true);
      expect(paid.headers['cache-control']).toBe('private, no-store');
      expect(paid.json().receipt).toMatchObject({ decision: 'proceed', payment_required: true });
      const withoutProof = await app.inject({ method: 'POST', url, payload: input, headers: { authorization: 'Bearer reviewer', 'idempotency-key': 'paid' } });
      expect(withoutProof.statusCode).toBe(401);
      expect(withoutProof.json().error).toBe('paid_judgment_replay_proof_required');
      expect(withoutProof.json().receipt).toBeUndefined();
      const otherProof = encodePaymentSignatureHeader({ x402Version: 2, accepted: challenge.accepts[0], payload: { signature: 'different' } });
      const withOtherProof = await app.inject({ method: 'POST', url, payload: input, headers: { authorization: 'Bearer reviewer', 'idempotency-key': 'paid', 'payment-signature': otherProof } });
      expect(withOtherProof.statusCode).toBe(403);
      expect(withOtherProof.json().error).toBe('paid_judgment_replay_proof_invalid');
      expect(withOtherProof.json().receipt).toBeUndefined();
      expect(withOtherProof.headers['payment-response']).toBeUndefined();
      const replay = await app.inject({ method: 'POST', url, payload: input, headers: { authorization: 'Bearer reviewer', 'idempotency-key': 'paid', 'payment-signature': signature } });
      expect(replay.statusCode).toBe(200);
      expect(f.facilitator.verify).toHaveBeenCalledTimes(1);
      expect(replay.json().receipt.receipt_hash).toBe(paid.json().receipt.receipt_hash); expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
      expect((await app.inject({ url: '/v1/receipt-spine/scores/route/' + input.subject_id, headers: { authorization: 'Bearer reviewer' } })).json().data.score).toBe(0);
    } finally { await app.close(); }
  });
});

it('cannot import a paid judgment through the internal receipt writer', async () => {
  vi.stubEnv('ADMIN_TOKEN', 'reviewer');
  const f = await setupJudgment();
  const parent = (await f.service.check(request, 'verified', f.signature)).response.receipt!;
  const { schema_version: _v, policy_version: _p, proceed_confidence_threshold: _t, parent_hashes: _h, receipt_hash: _r, payment: _billing, ...input } = parent;
  const app = await createApp();
  try {
    const result = await app.inject({ method: 'POST', url: '/internal/receipt-spine/judgment', headers: { authorization: 'Bearer reviewer' }, payload: input });
    expect(result.statusCode).toBe(400); expect(result.json().error).toBe('paid_judgments_require_verified_payment_boundary');
  } finally { await app.close(); }
});
