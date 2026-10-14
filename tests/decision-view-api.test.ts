import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createApp } from '../src/api/app';
import { dxFixture, dxInput, dxKey, dxOwner, otherKey } from './helpers/judgmentDx';
import { DecisionViewV1Schema } from '../src/schemas/decisionView';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('credential-bound read-only decision view API', () => {
  it('uses existing owner authority and never publishes private judgments anonymously', async () => {
    const f = await dxFixture();
    try {
      const result = await f.client().judge(dxInput, { idempotencyKey: 'private-view' });
      const url = '/v1/decision-views/' + result.judgment_id;
      expect((await f.app.inject(url)).statusCode).toBe(401);
      const denied = await f.app.inject({ url, headers: { authorization: 'Bearer ' + otherKey, 'x-tenant-id': dxOwner.tenant_id, 'x-agent-id': dxOwner.agent_id } });
      const missing = await f.app.inject({ url: '/v1/decision-views/judgment_' + 'f'.repeat(64), headers: { authorization: 'Bearer ' + otherKey } });
      expect(denied.statusCode).toBe(404); expect(denied.body).toBe(missing.body);
      const owned = await f.app.inject({ url, headers: { authorization: 'Bearer ' + dxKey } });
      expect(owned.statusCode, owned.body).toBe(200);
      expect(owned.headers['cache-control']).toBe('private, no-store');
      const view = DecisionViewV1Schema.parse(owned.json().data);
      expect(view.judgment.id).toBe(result.judgment_id);
      expect(view.execution.authorized).toBe(false);
      expect(owned.body).not.toContain('mock-proof-secret'); expect(owned.body).not.toContain('payload');
      const spec = (await f.app.inject('/openapi.json')).json();
      expect(spec.paths['/v1/decision-views/{id}'].get.security).toContainEqual({ JudgmentTenantKey: [] });
      // Missing signing capability cannot grant trusted assessment eligibility.
      expect(view.verification.assessment_eligible).toBe(false);
    } finally { await f.close(); }
  });

  it('rate-limits authenticated projection requests while retaining private cache policy', async () => {
    const f = await dxFixture();
    try {
      const result = await f.client().judge(dxInput, { idempotencyKey: 'view-limit' });
      const request = { url: '/v1/decision-views/' + result.judgment_id, headers: { authorization: 'Bearer ' + dxKey } };
      for (let index = 0; index < 60; index++) expect((await f.app.inject(request)).statusCode).toBe(200);
      const response = await f.app.inject(request);
      expect(response.statusCode).toBe(429); expect(response.headers['retry-after']).toBeTruthy();
      expect(response.headers['cache-control']).toBe('private, no-store');
    } finally { await f.close(); }
  });

  it('denies expired and same-tenant wrong-agent credentials and encoded selector spoofing', async () => {
    const f = await dxFixture();
    try {
      const result = await f.client().judge(dxInput, { idempotencyKey: 'owner-bound' });
      const wrongAgentKey = 'wrong_agent_' + 'c'.repeat(36);
      const expiredKey = 'expired_' + 'd'.repeat(36);
      const entries = [
        { ...dxOwner, key_sha256: createHash('sha256').update(dxKey).digest('hex') },
        { ...dxOwner, agent_id: 'different', key_sha256: createHash('sha256').update(wrongAgentKey).digest('hex') },
        { ...dxOwner, key_sha256: createHash('sha256').update(expiredKey).digest('hex'), expires_at: '2000-01-01T00:00:00Z' }
      ];
      vi.stubEnv('JUDGMENT_API_KEYS_JSON', JSON.stringify(entries)); await f.restart();
      const url = '/v1/decision-views/' + result.judgment_id;
      expect((await f.app.inject({ url, headers: { authorization: 'Bearer ' + wrongAgentKey } })).statusCode).toBe(404);
      expect((await f.app.inject({ url, headers: { authorization: 'Bearer ' + expiredKey } })).statusCode).toBe(401);
      for (const path of ['/v1/%64ecision-views/' + result.judgment_id, '/v1/decision-views/judgment%2F..%2F' + result.judgment_id]) {
        const response = await f.app.inject({ url: path, headers: { authorization: 'Bearer ' + wrongAgentKey } });
        expect([401, 404]).toContain(response.statusCode); expect(response.body).not.toContain(result.reasons[0]);
      }
    } finally { await f.close(); }
  });

  it('denies unbound observations and foreign evaluation ancestry before disclosing any root or context', async () => {
    const f = await dxFixture();
    try {
      const result = await f.client().judge(dxInput, { idempotencyKey: 'ancestry-bound' });
      const paths = ['/v1/decision-views/' + result.judgment_id, '/v1/receipt-spine/judgment/' + result.judgment_id,
        '/v1/receipt-spine/judgment/' + result.judgment_id + '/context', '/v1/receipt-spine/judgment/' + result.judgment_id + '/verify'];
      const originalContext = f.store.getDecisionContext!.bind(f.store);
      vi.spyOn(f.store, 'getDecisionContext').mockImplementation(async id => {
        const context = await originalContext(id);
        return context ? { ...context, evaluation_refs: [{ evaluation_id: 'private-foreign-evaluation', receipt_hash: 'sha256:' + 'e'.repeat(64), score_delta: -1 }] } : null;
      });
      for (const url of paths) {
        const response = await f.app.inject({ url, headers: { authorization: 'Bearer ' + dxKey } });
        expect(response.statusCode, response.body).toBe(404); expect(response.json()).toEqual({ error: 'private_receipt_not_found' });
        expect(response.body).not.toContain('private-foreign');
      }
      vi.restoreAllMocks();
      vi.spyOn(f.journal, 'ownsObservation').mockResolvedValue(false);
      for (const url of paths) expect((await f.app.inject({ url, headers: { authorization: 'Bearer ' + dxKey } })).statusCode).toBe(404);
    } finally { await f.close(); }
  });

  it('closes absent identity and sanitizes ownership repository failures', async () => {
    vi.stubEnv('JUDGMENT_API_KEYS_JSON', undefined as never); delete process.env.JUDGMENT_API_KEYS_JSON;
    const app = await createApp();
    try { expect((await app.inject('/v1/decision-views/guess')).statusCode).toBe(503); } finally { await app.close(); }
    const f = await dxFixture();
    try {
      const result = await f.client().judge(dxInput, { idempotencyKey: 'repo-error' });
      vi.spyOn(f.journal, 'get').mockRejectedValue(new Error('private database url and secret'));
      const response = await f.app.inject({ url: '/v1/decision-views/' + result.judgment_id, headers: { authorization: 'Bearer ' + dxKey } });
      expect(response.statusCode).toBe(503); expect(response.json()).toEqual({ error: 'private_receipt_unavailable' });
    } finally { await f.close(); }
  });
});
