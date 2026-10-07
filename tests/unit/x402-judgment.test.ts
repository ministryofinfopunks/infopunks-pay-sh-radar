import { describe, expect, it, vi } from 'vitest';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { request, setupJudgment } from '../helpers/judgments';
import { createX402JudgmentGateway } from '../../src/middleware/x402JudgmentMiddleware';

describe('x402 V2 judgment payment', () => {
  it('challenges, verifies, settles and replays one authoritative receipt', async () => {
    const f = await setupJudgment();
    const challenge = await f.service.check(request, 'same'); expect(challenge.status).toBe(402);
    expect(decodePaymentRequiredHeader(challenge.headers['PAYMENT-REQUIRED']!).x402Version).toBe(2);
    expect(await f.store.list('judgment')).toHaveLength(0);
    const paid = await f.service.check(request, 'same', f.signature); expect(paid.status).toBe(200);
    expect(decodePaymentResponseHeader(paid.headers['PAYMENT-RESPONSE']!).success).toBe(true);
    const replay = await f.service.check(request, 'same', f.signature);
    expect(replay.response.receipt).toEqual(paid.response.receipt);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1); expect(await f.store.list('judgment')).toHaveLength(1);
  });
  it('rejects invalid signatures without settlement or persistence', async () => {
    const f = await setupJudgment(); vi.mocked(f.facilitator.verify).mockResolvedValue({ isValid: false, invalidReason: 'invalid_signature' });
    await expect(f.service.check(request, 'invalid', f.signature)).rejects.toThrow('invalid_payment_signature');
    expect(f.facilitator.settle).not.toHaveBeenCalled(); expect(await f.store.list('judgment')).toHaveLength(0);
    await expect(f.service.check(request, 'invalid', 'malformed')).rejects.toThrow('invalid_payment_signature');
  });
  it('serializes concurrent paid requests', async () => {
    const f = await setupJudgment(); await f.service.check(request, 'concurrent');
    const results = await Promise.allSettled([f.service.check(request, 'concurrent', f.signature), f.service.check(request, 'concurrent', f.signature)]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true); expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
    expect(await f.store.list('judgment')).toHaveLength(1);
  });
  it('rejects conflicting idempotency and expired unpaid quotes', async () => {
    const f = await setupJudgment(); await f.service.check(request, 'conflict');
    await expect(f.service.check({ ...request, budget: 2 }, 'conflict')).rejects.toThrow('idempotency_conflict');
    f.setTime('2026-10-08T00:00:00Z');
    await expect(f.service.check(request, 'conflict', f.signature)).rejects.toThrow('judgment_quote_expired');
    expect(f.facilitator.settle).not.toHaveBeenCalled();
  });
  it('blocks recharging after ambiguous settlement failure', async () => {
    const f = await setupJudgment(); vi.mocked(f.facilitator.settle).mockRejectedValue(new Error('network timeout'));
    await expect(f.service.check(request, 'pending', f.signature)).rejects.toThrow('network timeout');
    await expect(f.service.check(request, 'pending', f.signature)).rejects.toThrow('payment_pending_reconciliation');
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1); expect(await f.store.list('judgment')).toHaveLength(0);
  });
  it('fails initialization for unsupported Base facilitator', async () => {
    const f = await setupJudgment(); vi.mocked(f.facilitator.getSupported).mockResolvedValue({ kinds: [], extensions: [], signers: {} });
    await expect(createX402JudgmentGateway({ facilitator: f.facilitator, facilitatorUrl: 'https://example.invalid', payTo: '0x'+'2'.repeat(40), amount: '0.01', resourceUrl: 'https://example.invalid/check' })).rejects.toThrow();
  });
});
