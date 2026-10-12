import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app';
afterEach(() => vi.unstubAllEnvs());
describe('canonical proof privacy boundary', () => {
  it('denies enumeration and raw history to anonymous/wrong-token callers before data lookup', async () => {
    vi.stubEnv('ADMIN_TOKEN', 'test-operator');
    const app = await createApp();
    try {
      for (const url of ['/v1/receipt-spine/tape', '/v1/receipt-spine/attempts', '/v1/receipt-spine/judgment/guess', '/v1/receipt-spine/judgment/guess/context', '/v1/receipt-spine/judgment/guess/verify', '/v1/receipt-spine/witness/a/b/c', '/v1/economics/revenue', '/v1/attribution', '/v1/decision-views/guess']) {
        for (const authorization of [undefined, 'Bearer wrong']) {
          const denied = await app.inject({ url, headers: authorization ? { authorization } : {} });
          expect(denied.statusCode, url).toBe(401);
          expect(denied.json()).toEqual({ error: 'proof_read_authorization_required' });
          expect(denied.headers['cache-control']).toBe('private, no-store');
        }
      }
      const allowed = await app.inject({ url: '/v1/receipt-spine/tape', headers: { authorization: 'Bearer test-operator' } });
      expect(allowed.statusCode).toBe(200); expect(allowed.headers['cache-control']).toBe('private, no-store');
      expect((await app.inject('/v1/routes')).statusCode).toBe(200);
      const check = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: { agent_id: 'public-agent', intent: 'quote', budget: 1, risk_tolerance: 'low', preferred_settlement: 'stablecoin', required_confidence: 80 } });
      expect(check.json()).toMatchObject({ decision: 'insufficient_evidence', execution_authorized: false, receipt: null });
      expect(check.headers['cache-control']).toBe('private, no-store');
    } finally { await app.close(); }
  });
  it('denies private reads when operator authentication is unconfigured', async () => {
    vi.stubEnv('ADMIN_TOKEN', ''); vi.stubEnv('INFOPUNKS_ADMIN_TOKEN', '');
    const app = await createApp();
    try { expect((await app.inject('/v1/receipt-spine/tape')).statusCode).toBe(401); } finally { await app.close(); }
  });
});

// Production fixture policy is tested independently of module import timing.
it('does not populate synthetic compatibility evidence in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const { createInMemoryPreSpendRepository } = await import('../../src/repositories/preSpendRepository');
  const repository = createInMemoryPreSpendRepository();
  expect(repository.listRoutes()).toEqual([]); expect(repository.listProviders()).toEqual([]);
  expect(repository.listReceipts()).toEqual([]); expect(repository.listClaims()).toEqual([]);
  expect(repository.listValidations()).toEqual([]);
});
