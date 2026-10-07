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
  it('limits judgment writes more strictly than public reads', async () => {
    const app = await createApp();
    try {
      for (let i = 0; i < 30; i++) expect((await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: request })).statusCode).toBe(429);
      expect((await app.inject('/v1/routes')).statusCode).toBe(200);
    } finally { await app.close(); }
  });
});
