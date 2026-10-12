import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { judgmentInput, observationInput } from './helpers/canonicalReceipts';
import { issuerFixture } from './helpers/judgmentIssuer';

afterEach(() => vi.unstubAllEnvs());

describe('read-only decision view API', () => {
  it('serves only a verified canonical projection; never a signing or execution interface', async () => {
    const fixture = issuerFixture();
    vi.stubEnv('ADMIN_TOKEN', 'decision-ui-test');
    vi.stubEnv('JUDGMENT_ISSUER', fixture.issuer);
    vi.stubEnv('JUDGMENT_ISSUER_KEYS_JSON', JSON.stringify(fixture.keys));
    vi.stubEnv('JUDGMENT_SIGNING_KEY_ID', fixture.activeKeyId);
    vi.stubEnv('JUDGMENT_SIGNING_PRIVATE_KEY', fixture.privateKeyPem);
    const app = await createApp(emptyIntelligenceStore());
    try {
      const headers = { authorization: 'Bearer decision-ui-test' };
      const observation = await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers, payload: observationInput() });
      expect(observation.statusCode, observation.body).toBe(200);
      const judgment = await app.inject({ method: 'POST', url: '/internal/receipt-spine/judgment', headers, payload: judgmentInput() });
      expect(judgment.statusCode, judgment.body).toBe(200);
      const view = await app.inject('/v1/decision-views/j1');
      expect(view.statusCode, view.body).toBe(200);
      expect(view.headers['cache-control']).toBe('no-store');
      expect(view.json().data.judgment.decision).toBe('proceed');
      expect(view.json().data.verification.record_verified).toBe(true);
      expect(view.json().data.verification.assessment_eligible).toBe(false); // historical record at current time
      expect(view.json().data.execution).toMatchObject({ authorized: false });
      expect(view.body).not.toContain('catalog_source');
      expect(view.body).not.toContain('PRIVATE KEY');
      expect((await app.inject('/v1/decision-views/not-real')).statusCode).toBe(404);
      expect((await app.inject(`/v1/decision-views/${'x'.repeat(257)}`)).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: '/v1/decision-views/j1', payload: {} })).statusCode).toBe(404);
      const spec = (await app.inject('/openapi.json')).json();
      expect(spec.paths['/v1/decision-views/{id}']?.get.responses['200']).toBeTruthy();
    } finally { await app.close(); }
  });

  it('limits public decision-view ancestry reads per client IP', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      for (let index = 0; index < 60; index += 1) {
        expect((await app.inject(`/v1/decision-views/missing-${index}`)).statusCode).toBe(404);
      }
      const limited = await app.inject('/v1/decision-views/after-limit');
      expect(limited.statusCode).toBe(429);
      expect(limited.headers['retry-after']).toBeTruthy();
      expect(limited.headers['cache-control']).toBe('no-store');
    } finally { await app.close(); }
  });
});
