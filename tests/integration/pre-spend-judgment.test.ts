import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app';
import { createInfopunksPreSpendClient } from '../../src/sdk';
import { request } from '../helpers/judgments';

afterEach(() => vi.unstubAllEnvs());
describe('canonical pre-spend HTTP and SDK boundary', () => {
  it('returns free insufficient evidence and preserves the SDK envelope', async () => {
    const app = await createApp();
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request });
      expect(response.statusCode).toBe(200); expect(response.headers['payment-required']).toBeUndefined();
      expect(response.json()).toMatchObject({ decision: 'insufficient_evidence', payment_required: false, cost: { amount: '0' }, receipt: null });
      const client = createInfopunksPreSpendClient({ baseUrl: 'https://radar.invalid', fetch: async (_url, init) => {
        const injected = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', headers: { 'content-type': 'application/json' }, payload: String(init!.body) });
        return new Response(injected.body, { status: injected.statusCode });
      } });
      const sdk = await client.checkPreSpend(request);
      expect(sdk.decision).toBe(response.json().data.decision);
      expect(sdk.canonical_judgment?.decision).toBe('insufficient_evidence');
    } finally { await app.close(); }
  });
  it('rejects unimplemented chain and settlement selectors instead of silently stripping them', async () => {
    const app = await createApp();
    try {
      for (const url of ['/v1/pre-spend/check', '/v1/decide']) {
        for (const unknown of [{ subject_network: 'eip155:4663' }, { settlement_network: 'solana:mainnet' }, { policy_id: 'unsupported' }]) {
          const response = await app.inject({ method: 'POST', url, payload: { ...request, ...unknown } });
          expect(response.statusCode).toBe(400);
          expect(response.json().error).toBe('invalid_pre_spend_check_request');
        }
      }
    } finally { await app.close(); }
  });
  it('rejects invalid caller-controlled headers before echoing the key', async () => {
    const app = await createApp();
    try {
      for (const url of ['/v1/pre-spend/check', '/v1/decide']) {
        for (const key of ['', 'unsafe*key', 'a'.repeat(129)]) {
          const response = await app.inject({ method: 'POST', url, payload: request, headers: { 'idempotency-key': key } });
          expect(response.statusCode).toBe(400);
          expect(response.json().error).toBe('invalid_idempotency_key');
          expect(response.headers['idempotency-key']).toBeUndefined();
          expect(response.headers['cache-control']).toBe('private, no-store');
        }
        for (const proof of ['', 'a'.repeat(16385)]) {
          const response = await app.inject({ method: 'POST', url, payload: request, headers: { 'idempotency-key': 'valid', 'payment-signature': proof } });
          expect(response.statusCode).toBe(400);
          expect(response.json().error).toBe('invalid_payment_signature_length');
          expect(response.headers['idempotency-key']).toBeUndefined();
        }
        const valid = await app.inject({ method: 'POST', url, payload: request, headers: { 'idempotency-key': 'A'.repeat(128) } });
        expect(valid.statusCode).toBe(200);
        expect(valid.headers['idempotency-key']).toBe('A'.repeat(128));
      }
    } finally { await app.close(); }
  });
  it('limits judgment writes more strictly than public reads', async () => {
    const app = await createApp();
    try {
      for (let i = 0; i < 30; i++) expect((await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request })).statusCode).toBe(429);
      expect((await app.inject('/v1/routes')).statusCode).toBe(200);
    } finally { await app.close(); }
  });
});
