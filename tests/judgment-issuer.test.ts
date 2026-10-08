import { issuerFixture } from './helpers/judgmentIssuer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJudgmentIssuer, judgmentIssuerFromEnv } from '../src/security/judgmentIssuer';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService, verifyReceiptChain } from '../src/services/receiptAuthorityService';
import { computeReceiptHash, sealReceipt } from '../src/services/receiptIntegrityService';
import { observationInput, judgmentInput, executionInput } from './helpers/canonicalReceipts';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { createJudgmentService } from '../src/services/judgmentService';
import { setupJudgment, request, legacy } from './helpers/judgments';
import { MemoryJudgmentRequestRepository } from '../src/repositories/judgmentRequestRepository';
import { loadRuntimeConfig, verifyRuntimeConfiguration } from '../src/config/env';

afterEach(() => vi.unstubAllEnvs());
describe('judgment issuer authentication', () => {
  it('authenticates content and issuer identity independently of the payment signature', async () => {
    const issuer = createJudgmentIssuer(issuerFixture());
    const store = new MemoryCanonicalReceiptStore(80, issuer);
    const authority = createReceiptAuthorityService(store, 80, issuer);
    await authority.appendObservation(observationInput());
    const receipt = await authority.appendJudgment(judgmentInput());
    expect(issuer.verify(receipt)).toBe(true);
    expect(computeReceiptHash('judgment', receipt)).toBe(receipt.receipt_hash);
    expect(await verifyReceiptChain('judgment', receipt, store)).toBe(true);
    expect(issuer.verify(sealReceipt('judgment', { ...receipt, decision: 'do_not_spend' }))).toBe(false);
    for (const field of ['issuer', 'key_id', 'signature'] as const) {
      const tampered = structuredClone(receipt);
      tampered.issuer_signature![field] = field === 'signature' ? 'A'.repeat(86) + '==' : 'untrusted';
      expect(issuer.verify(tampered)).toBe(false);
      expect(await verifyReceiptChain('judgment', tampered, store)).toBe(false);
    }
    const unsigned = { ...receipt }; delete unsigned.issuer_signature;
    expect(issuer.verify(unsigned)).toBe(false);
    await expect(store.append('judgment', unsigned)).rejects.toThrow('signed_judgment_required');
    expect(await authority.appendExecution(executionInput())).toHaveProperty('parent_hash', receipt.receipt_hash);
  });
  it('retains signatures and parent hashes on rotation/replay; rejects revocation and issuance outside key windows', async () => {
    const first = issuerFixture(); const next = issuerFixture('key-2');
    const oldIssuer = createJudgmentIssuer(first);
    const rotated = createJudgmentIssuer({ ...next, keys: [...first.keys, ...next.keys] });
    const store = new MemoryCanonicalReceiptStore(80, rotated);
    const authority = createReceiptAuthorityService(store, 80, oldIssuer);
    await authority.appendObservation(observationInput());
    const receipt = await authority.appendJudgment(judgmentInput());
    expect(rotated.verify(receipt)).toBe(true);
    expect(await createReceiptAuthorityService(store, 80, rotated).appendJudgment(judgmentInput())).toEqual(receipt);
    const revoked = createJudgmentIssuer({ issuer: first.issuer, keys: [{ ...first.keys[0], revoked: true }] });
    expect(revoked.verify(receipt)).toBe(false);
    const narrow = createJudgmentIssuer({ ...first, keys: [{ ...first.keys[0], valid_until: '2026-10-07T00:00:30Z' }] });
    expect(narrow.verify(receipt)).toBe(false);
    expect(() => narrow.sign(receipt)).toThrow('judgment_signing_window_invalid');
    expect(() => narrow.assertCanSign('2026-10-07T00:00:30Z')).toThrow('judgment_signing_unavailable');
    await expect(createReceiptAuthorityService(store, 80, rotated).appendJudgment({ ...judgmentInput(), reasons: ['changed'] })).rejects.toThrow('receipt_id_conflict');
  });
  it('fails before payment if signing is missing or cannot cover the judgment window', async () => {
    const f = await setupJudgment(); const issuer = createJudgmentIssuer(issuerFixture());
    const store = new MemoryCanonicalReceiptStore(80, issuer); await store.append('observation', f.observation);
    const build = (signer?: typeof issuer) => createJudgmentService({ store, journal: new MemoryJudgmentRequestRepository(), gateway: f.gateway,
      issuer: signer, legacyCheck: () => legacy, observations: async () => [f.observation], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') });
    await expect(build().check(request, 'missing', f.signature)).rejects.toThrow('judgment_signing_unavailable');
    const expired = issuerFixture(); expired.keys[0].valid_until = '2026-10-07T00:00:30Z';
    await expect(build(createJudgmentIssuer(expired)).check(request, 'short', f.signature)).rejects.toThrow('judgment_signing_unavailable');
    const paid = await build(issuer).check(request, 'paid', f.signature);
    expect(issuer.verify(paid.response.receipt!)).toBe(true);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it('rejects unsigned historical execution when signed permission is required', async () => {
    const store = new MemoryCanonicalReceiptStore(); const authority = createReceiptAuthorityService(store);
    await authority.appendObservation(observationInput()); await authority.appendJudgment(judgmentInput());
    Object.defineProperty(store, 'judgmentTrust', { value: createJudgmentIssuer(issuerFixture()) });
    await expect(authority.appendExecution(executionInput())).rejects.toThrow('signed_judgment_required');
  });
  it('validates configuration without exposing secrets', () => {
    const f = issuerFixture(); const other = issuerFixture();
    expect(() => createJudgmentIssuer({ ...f, privateKeyPem: other.privateKeyPem })).toThrow('invalid_judgment_signing_configuration');
    expect(() => createJudgmentIssuer({ ...f, keys: [{ ...f.keys[0], public_key_pem: f.privateKeyPem }] })).toThrow('invalid_judgment_signing_configuration');
    expect(() => createJudgmentIssuer({ ...f, keys: [...f.keys, ...f.keys] })).toThrow('invalid_judgment_signing_configuration');
    expect(() => judgmentIssuerFromEnv({ JUDGMENT_SIGNING_PRIVATE_KEY: 'secret' }, true)).toThrow('invalid_judgment_signing_configuration');
    const result = verifyRuntimeConfiguration({ JUDGMENT_SIGNING_PRIVATE_KEY: 'secret' });
    expect(result.status).toBe('invalid'); expect(JSON.stringify(result)).not.toContain('secret');
    const prod = { NODE_ENV: 'production', PORT: '8787', DATABASE_URL: 'postgres://localhost/radar', PAYSH_CATALOG_SOURCE: 'live', PAY_SH_CATALOG_URL: 'https://pay.sh/catalog', PAYSH_ALLOW_FIXTURE_FALLBACK: 'false', JUDGMENT_PAYMENT_ENABLED: 'true' };
    expect(() => loadRuntimeConfig(prod)).toThrow('production_judgment_signing_required');
  });
  it('publishes only public keys and distinguishes historical verification from current permission', async () => {
    const f = issuerFixture();
    vi.stubEnv('ADMIN_TOKEN', 'test-authority');
    vi.stubEnv('JUDGMENT_ISSUER', f.issuer); vi.stubEnv('JUDGMENT_ISSUER_KEYS_JSON', JSON.stringify(f.keys));
    vi.stubEnv('JUDGMENT_SIGNING_KEY_ID', f.activeKeyId); vi.stubEnv('JUDGMENT_SIGNING_PRIVATE_KEY', f.privateKeyPem);
    const app = await createApp(emptyIntelligenceStore());
    try {
      const keys = await app.inject('/v1/judgment-issuer/keys'); expect(keys.statusCode).toBe(200);
      expect(keys.body).not.toContain('PRIVATE KEY'); expect(keys.json().data.keys).toEqual(f.keys);
      const headers = { authorization: 'Bearer test-authority' };
      await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers, payload: observationInput() });
      const write = await app.inject({ method: 'POST', url: '/internal/receipt-spine/judgment', headers, payload: judgmentInput() });
      expect(write.statusCode, write.body).toBe(200); expect(write.json().data.issuer_signature.key_id).toBe('key-1');
      const spoof = await app.inject({ method: 'POST', url: '/internal/receipt-spine/judgment', headers, payload: { ...judgmentInput(), issuer_signature: write.json().data.issuer_signature } });
      expect(spoof.statusCode).toBe(400);
      const checked = await app.inject('/v1/receipt-spine/judgment/j1/verify');
      expect(checked.json().data).toMatchObject({ ancestry_valid: true, issuer_signature_valid: true, within_validity_window: false, execution_authorized: false });
    } finally { await app.close(); }
  });
});
