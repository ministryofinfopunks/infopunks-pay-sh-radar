import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerIpxLaunchRoutes } from '../src/api/ipxLaunchRoutes';
import { createOpenApiSpec } from '../src/api/openapi';
afterEach(() => vi.unstubAllEnvs());
describe('IPX launch API activation gates', () => {
  async function app() {
    vi.stubEnv('IPX_LAUNCH_POLICY_PATH', '');
    const api = Fastify();
    await registerIpxLaunchRoutes(api, { pool: null, rpc: null, payTo: null, adminToken: 'reviewer-secret', reconcile: async () => { throw new Error('must not reconcile while disabled'); } });
    return api;
  }
  it('reports absent launch terms honestly and refuses economic acceptance', async () => {
    const api = await app();
    try {
      const status = (await api.inject({ method: 'GET', url: '/v1/ipx/launch' })).json().data;
      expect(status).toMatchObject({ state: 'AWAITING_ALLOCATION_AND_DEPLOYMENT', policy_hash: null, call_limit: 4663, distinct_wallet_limit: 4663, quote_is_backing: false, economic_flywheel_operational: false });
      expect((await api.inject({ method: 'POST', url: '/v1/ipx/genesis/payload', payload: {} })).statusCode).toBe(503);
      expect((await api.inject({ method: 'GET', url: '/v1/ipx/economy/summary' })).statusCode).toBe(503);
      expect((await api.inject({ method: 'GET', url: '/ipx/economy' })).headers['cache-control']).toBe('no-store');
    } finally { await api.close(); }
  });
  it('protects all evidence and accounting writes even while the launch is disabled', async () => {
    const api = await app();
    try {
      for (const route of ['evidence/solana/scan','economy/revenue','economy/contribution','economy/burn-proof']) {
        expect((await api.inject({ method: 'POST', url: '/internal/ipx/' + route, payload: {} })).statusCode).toBe(401);
        const response = await api.inject({ method: 'POST', url: '/internal/ipx/' + route, headers: { authorization: 'Bearer reviewer-secret' }, payload: {} });
        expect(response.statusCode).toBe(503);
        expect(response.body).not.toContain('reviewer-secret');
      }
      expect((await api.inject({ method: 'GET', url: '/internal/ipx/genesis/commitment' })).statusCode).toBe(401);
    } finally { await api.close(); }
  });
  it('publishes additive versioned endpoints in discovery', () => {
    const spec = createOpenApiSpec() as { paths: Record<string, unknown> };
    for (const route of ['/v1/ipx/launch','/v1/ipx/genesis/payload','/v1/ipx/genesis/calls','/v1/ipx/genesis/identity-mapping','/v1/ipx/economy/summary','/internal/ipx/economy/burn-proof']) expect(spec.paths[route]).toBeDefined();
  });
});
