import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/app';

afterEach(() => vi.unstubAllEnvs());
async function application() {
  for (const [name, value] of Object.entries({ NODE_ENV: 'test', ADMIN_TOKEN: 'phase6-test-admin', DATABASE_URL: '', JUDGMENT_PAYMENT_ENABLED: 'false', INGESTION_ENABLED: 'false', PAYSH_BOOTSTRAP_ENABLED: 'false', MONITOR_ENABLED: 'false', IPX_PLTR_SHADOW_OBSERVATION_ENABLED: 'false' })) vi.stubEnv(name, value);
  const app = await createApp();
  await app.ready(); // Fastify refuses duplicate route/schema registrations during startup.
  return app;
}

describe('Phase 6 integrated route security', () => {
  it('keeps public chain/score inspection separate from authenticated receipt and accounting writers', async () => {
    const app = await application();
    try {
      expect(app.hasRoute({ method: 'POST', url: '/v1/pre-spend/check' })).toBe(true);
      expect(app.hasRoute({ method: 'POST', url: '/v1/decide' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/v1/receipt-spine/evaluation/:id/chain' })).toBe(true);
      for (const endpoint of ['/v1/evaluate', '/internal/receipt-spine/observation', '/internal/receipt-spine/judgment', '/internal/receipt-spine/execution', '/internal/receipt-spine/evaluation', '/internal/economics/costs']) {
        for (const headers of [{}, { authorization: 'Bearer wrong' }]) expect((await app.inject({ method: 'POST', url: endpoint, payload: {}, headers })).statusCode, endpoint).toBe(401);
      }
      const missing = await app.inject('/v1/receipt-spine/evaluation/missing/chain');
      expect(missing.statusCode).toBe(404);
      expect(missing.json().error).toBe('canonical_receipt_not_found');
      const score = await app.inject('/v1/score/phase6-public-subject');
      expect(score.statusCode).toBe(200);
      expect(score.json().data.score).toBe(0);
      expect(score.headers['payment-required']).toBeUndefined();
    } finally { await app.close(); }
  });

  it('never dispatches malformed private targets through a privileged fallback', async () => {
    const app = await application();
    try {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE'] as const) {
        for (const url of ['/internal/receipt-spine/%ZZ', '/internal/economics/%ZZ', '/v1/evaluate/%ZZ', '/v1/receipt-spine/evaluation/%ZZ/chain']) {
          const response = await app.inject({ method, url, ...(method === 'POST' ? { payload: {} } : {}) });
          expect(response.statusCode).toBeGreaterThanOrEqual(400);
          expect(response.body).not.toContain('phase6-test-admin');
        }
      }
    } finally { await app.close(); }
  });

  it('shares judgment alias limits and cannot reset them with a spoofed forwarded address', async () => {
    const app = await application();
    try {
      for (let index = 0; index < 30; index++) {
        const response = await app.inject({ method: 'POST', url: index % 2 ? '/v1/decide' : '/v1/pre-spend/check', payload: {}, headers: { 'x-forwarded-for': `192.0.2.${index + 1}` } });
        expect(response.statusCode).toBe(400);
      }
      const limited = await app.inject({ method: 'POST', url: '/v1/decide', payload: {} });
      expect(limited.statusCode).toBe(429);
      expect(limited.headers['retry-after']).toBeDefined();
      for (let index = 0; index < 20; index++) expect((await app.inject({ method: 'POST', url: '/v1/execute-proof', payload: {} })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/v1/execute-proof', payload: {} })).statusCode).toBe(429);
      expect((await app.inject('/v1/score/phase6-public-subject')).json().data.score).toBe(0);
    } finally { await app.close(); }
  });

  it('retains body bounds and rejects caller score/clock injection', async () => {
    const app = await application();
    try {
      for (const url of ['/v1/pre-spend/check', '/v1/decide', '/v1/execute-proof', '/v1/evaluate']) {
        expect((await app.inject({ method: 'POST', url, payload: { padding: 'x'.repeat(17_000) } })).statusCode).toBe(413);
      }
      const authored = await app.inject({ method: 'POST', url: '/v1/evaluate', headers: { authorization: 'Bearer phase6-test-admin' }, payload: { score_delta: 99 } });
      expect(authored.statusCode).toBe(400);
      expect(authored.json().error).toBe('score_delta_authoring_forbidden');
      expect((await app.inject({ method: 'POST', url: '/v1/decide', payload: { protocolNow: '2099-01-01', score_delta: 99 } })).statusCode).toBe(400);
    } finally { await app.close(); }
  });
});
