import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodePaymentSignatureHeader, decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { createApp } from '../../src/api/app';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { request, facts, setupJudgment } from '../helpers/judgments';
import { observationInput } from '../helpers/canonicalReceipts';

afterEach(() => vi.unstubAllEnvs());
describe('pre-spend HTTP payment lifecycle', () => {
  it('issues a V2 challenge then persists one receipt after verified settlement', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'reviewer');
    const f = await setupJudgment(); const app = await createApp(undefined, undefined, { judgmentGateway: f.gateway });
    const input = { ...request, intent: 'buy_market_research', subject_id: 'route_pay_sh_market_research_03', required_confidence: 80 };
    try {
      const diagnostic = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input });
      const route = diagnostic.json().data.recommended_route;
      const at = new Date();
      const seed = await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers: { authorization: 'Bearer reviewer' }, payload: {
        ...observationInput(), subject_type: 'route', subject_id: input.subject_id, intent_hash: hashCanonical(input), source_type: 'reviewed_judgment_facts',
        observed_at: at.toISOString(), ingested_at: at.toISOString(), freshness_expires_at: new Date(at.getTime() + 120000).toISOString(),
        provenance: { catalog_source: 'live' }, payload: { ...facts, route_id: route }
      } });
      expect(seed.statusCode).toBe(200);
      const unpaid = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { 'idempotency-key': 'paid' } });
      expect(unpaid.statusCode).toBe(402);
      const challenge = decodePaymentRequiredHeader(String(unpaid.headers['payment-required']));
      const signature = encodePaymentSignatureHeader({ x402Version: 2, accepted: challenge.accepts[0], payload: { signature: 'test-only' } });
      const invalid = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { 'idempotency-key': 'paid', 'payment-signature': 'invalid' } });
      expect(invalid.statusCode).toBe(400);
      const paid = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { 'idempotency-key': 'paid', 'payment-signature': signature } });
      expect(paid.statusCode).toBe(200); expect(decodePaymentResponseHeader(String(paid.headers['payment-response'])).success).toBe(true);
      expect(paid.json().receipt).toMatchObject({ decision: 'proceed', payment_required: true });
      const replay = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: input, headers: { 'idempotency-key': 'paid', 'payment-signature': signature } });
      expect(replay.json().receipt.receipt_hash).toBe(paid.json().receipt.receipt_hash); expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
      expect((await app.inject('/v1/receipt-spine/scores/route/' + input.subject_id)).json().data.score).toBe(0);
    } finally { await app.close(); }
  });
});

it('cannot import a paid judgment through the internal receipt writer', async () => {
  vi.stubEnv('ADMIN_TOKEN', 'reviewer');
  const f = await setupJudgment();
  const parent = (await f.service.check(request, 'verified', f.signature)).response.receipt!;
  const { schema_version: _v, policy_version: _p, proceed_confidence_threshold: _t, parent_hashes: _h, receipt_hash: _r, ...input } = parent;
  const app = await createApp();
  try {
    const result = await app.inject({ method: 'POST', url: '/internal/receipt-spine/judgment', headers: { authorization: 'Bearer reviewer' }, payload: input });
    expect(result.statusCode).toBe(400); expect(result.json().error).toBe('paid_judgments_require_verified_payment_boundary');
  } finally { await app.close(); }
});
