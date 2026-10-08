import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerEconomicEngineRoutes } from '../src/api/economicEngineRoutes';
import { economicFixture } from './helpers/economicEngine';
import { createApp } from '../src/api/app';
import { request } from './helpers/judgments';

describe('economic engine host API', () => {
  it('requires host authentication and separates assessment from signed execution', async () => {
    const f = await economicFixture(), app = Fastify();
    try {
      await registerEconomicEngineRoutes(app, { receipts: f.receipts, threshold: 80, judgmentIssuer: f.judgmentIssuer, pool: null, isProduction: false, adminToken: 'host-token' }, { ...f.options, enabled: true });
      const unauthorized = await app.inject({ method: 'POST', url: '/internal/economic-engine/decide', payload: f.job });
      expect(unauthorized.statusCode).toBe(401); expect(f.provider.evaluate).not.toHaveBeenCalled();
      const assessed = await app.inject({ method: 'POST', url: '/internal/economic-engine/decide', headers: { authorization: 'Bearer host-token' }, payload: f.job });
      expect(assessed.statusCode).toBe(200); const attempt = assessed.json().data;
      expect(attempt.judgment.decision).toBe('proceed'); expect(attempt.authorization.payload.version).toBe('infopunks.execution-authorization.v1');
      const executed = await app.inject({ method: 'POST', url: '/internal/economic-engine/execute', headers: { authorization: 'Bearer host-token' },
        payload: { authorization: attempt.authorization, operation: f.job.candidates[0].operation, delegate_id: 'delegate-1', audience: 'executor-1' } });
      expect(executed.statusCode).toBe(200); expect(executed.json().data.state).toBe('finalized');
      const keys = await app.inject('/v1/execution-authorization/keys');
      expect(keys.json().data.domain).toBe('infopunks.execution-authorization.v1'); expect(keys.body).not.toContain('PRIVATE KEY');
    } finally { await app.close(); }
  });
  it('does not mount host write endpoints when disabled', async () => {
    const f = await economicFixture(), app = Fastify();
    try { await registerEconomicEngineRoutes(app, { receipts: f.receipts, threshold: 80, pool: null, isProduction: false, adminToken: 'host' }, { enabled: false });
      expect((await app.inject({ method: 'POST', url: '/internal/economic-engine/decide', payload: f.job })).statusCode).toBe(404);
    } finally { await app.close(); }
  });
  it('refuses non-durable production authorization and incomplete executor configuration', async () => {
    const f = await economicFixture(), app = Fastify();
    await expect(registerEconomicEngineRoutes(app, { receipts: f.receipts, threshold: 80, pool: null, isProduction: true, adminToken: 'host' }, { ...f.options, enabled: true })).rejects.toThrow('economic_engine_authorization_configuration_incomplete');
    await app.close();
  });
  it('exposes a compatible paid assessment facade without granting execution authority', async () => {
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('PAYSH_CATALOG_SOURCE', 'fixture'); vi.stubEnv('INGESTION_ENABLED', 'false');
    const app = await createApp();
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/decide', headers: { 'idempotency-key': 'facade' }, payload: request });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ decision: 'insufficient_evidence', cost: { amount: '0' }, execution_authorization: null, execution_authorized: false });
      const injected = await app.inject({ method: 'POST', url: '/v1/decide', payload: { ...request, candidates: [{ id: 'evil' }], authorization: true } });
      // No host decisions/policies/capabilities are accepted from the public facade.
      expect(injected.statusCode).toBe(400);
    } finally { await app.close(); vi.unstubAllEnvs(); }
  });
});
