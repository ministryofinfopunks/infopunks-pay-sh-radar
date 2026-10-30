import { describe, expect, it, vi } from 'vitest';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, decodePaymentSignatureHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
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
  it('does not treat a predictable agent id and request key as paid-receipt access', async () => {
    const f = await setupJudgment();
    const paid = await f.service.check(request, 'proof-bound', f.signature);
    await expect(f.service.check(request, 'proof-bound')).rejects.toThrow('paid_judgment_replay_proof_required');
    await expect(f.service.check(request, 'proof-bound', 'invalid')).rejects.toThrow('paid_judgment_replay_proof_invalid');
    expect((await f.service.check(request, 'proof-bound', f.signature)).response.receipt).toEqual(paid.response.receipt);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it('binds default-key and expired receipt replays to the canonical original proof', async () => {
    const f = await setupJudgment();
    const paid = await f.service.check(request, undefined, f.signature);
    f.setTime('2026-10-08T00:00:00Z');
    await expect(f.service.check(request)).rejects.toMatchObject({ statusCode: 401 });
    for (const proof of ['invalid', Buffer.from('null').toString('base64'), encodePaymentSignatureHeader({ x402Version: 2, accepted: f.gateway.requirements[0], payload: { signature: 'different' } })]) {
      await expect(f.service.check(request, undefined, proof)).rejects.toMatchObject({ statusCode: 403, code: 'paid_judgment_replay_proof_invalid' });
    }
    const original = decodePaymentSignatureHeader(f.signature);
    // JSON property order is not part of payment identity.
    const reordered = Buffer.from(JSON.stringify({ payload: original.payload, accepted: original.accepted, x402Version: original.x402Version })).toString('base64');
    expect((await f.service.check(request, undefined, reordered)).response.receipt).toEqual(paid.response.receipt);
    expect(f.facilitator.verify).toHaveBeenCalledTimes(1);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it('requires proof before recovering a settled payment whose receipt append failed', async () => {
    const f = await setupJudgment();
    const append = vi.spyOn(f.store, 'append').mockRejectedValueOnce(new Error('publication_failed'));
    await expect(f.service.check(request, 'recover', f.signature)).rejects.toThrow('publication_failed');
    expect(await f.store.list('judgment')).toHaveLength(0);
    await expect(f.service.check(request, 'recover')).rejects.toMatchObject({ statusCode: 401 });
    await expect(f.service.check(request, 'recover', 'invalid')).rejects.toMatchObject({ statusCode: 403 });
    expect(append).toHaveBeenCalledTimes(1);
    const recovered = await f.service.check(request, 'recover', f.signature);
    expect(recovered.status).toBe(200);
    expect(await f.store.list('judgment')).toHaveLength(1);
    expect(f.facilitator.verify).toHaveBeenCalledTimes(1);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it.each(['payment_hash', 'settlement'])('fails closed when a completed journal is missing %s', async (field) => {
    const f = await setupJudgment();
    await f.service.check(request, 'incomplete', f.signature);
    const key = hashCanonical({ agent: request.agent_id, key: 'incomplete' });
    const record = (await f.journal.get(key))!;
    if (field === 'payment_hash') delete record.payment_hash;
    else record.settlement = { ...record.settlement!, success: false };
    await f.journal.save(key, record);
    await expect(f.service.check(request, 'incomplete', f.signature)).rejects.toMatchObject({ statusCode: 403 });
    expect(f.facilitator.verify).toHaveBeenCalledTimes(1);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it.each([null, [], 42, { x402Version: 2 }])('rejects decoded malformed payment JSON %j before verification', async (payload) => {
    const f = await setupJudgment();
    const proof = Buffer.from(JSON.stringify(payload)).toString('base64');
    await expect(f.service.check(request, 'malformed-json', proof)).rejects.toMatchObject({ statusCode: 400 });
    expect(f.facilitator.verify).not.toHaveBeenCalled();
    expect(f.facilitator.settle).not.toHaveBeenCalled();
    expect(await f.store.list('judgment')).toHaveLength(0);
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
