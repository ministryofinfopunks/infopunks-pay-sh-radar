import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createApp } from '../src/api/app';
import { createJudgmentIdentity } from '../src/security/judgmentIdentity';
import { judgmentAccessPolicy } from '../src/security/judgmentAccessPolicy';
import { dxFixture, dxInput, dxKey, otherKey } from './helpers/judgmentDx';
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('judgment identity and private access', () => {
  it.each(['/v1/4663/me','/v1/4663/me/call','/v1/4663/me/proof','/v1/4663/me/changes','/v1/4663/proof/:wallet','/v1/4663/pulse/reputation/:wallet','/og/4663/proof/:wallet.png','/4663/proof/wallet'])('closes production wallet-selector history %s without a trusted wallet ownership model',path=>{
    expect(judgmentAccessPolicy(path,'GET',true)).toBe('operator');
    expect(judgmentAccessPolicy(path,'GET',false)).toBe('public');
  });
  it('closes private routes if identity/tenant authority is not configured', async () => {
    vi.stubEnv('JUDGMENT_API_KEYS_JSON', undefined as never);
    delete process.env.JUDGMENT_API_KEYS_JSON;
    const app = await createApp();
    try { for (const url of ['/v1/receipt-spine/judgment/guess', '/v1/receipt-spine/judgment/guess/context', '/v1/receipt-spine/attempts', '/v1/receipt-spine/tape', '/v1/economics/revenue', '/v1/attribution','/v1/judgments/history']) {
      const res = await app.inject(url); expect(res.statusCode).toBe(503); expect(res.json()).toEqual({ error:'judgment_identity_unavailable' });
    } } finally { await app.close(); }
  });
  it('permits only credential-bound owner reads and prevents cross-tenant/request history disclosure', async () => {
    const f = await dxFixture();
    try {
      const result = await f.client().judge(dxInput,{ idempotencyKey:'owned' });
      const paths = ['/v1/receipt-spine/judgment/'+result.judgment_id, '/v1/receipt-spine/judgment/'+result.judgment_id+'/context', '/v1/receipt-spine/judgment/'+result.judgment_id+'/verify', '/v1/receipt-spine/observation/'+result.cited_observations[0]];
      for (const url of paths) {
        expect((await f.app.inject(url)).statusCode).toBe(401);
        expect((await f.app.inject({ url,headers:{ authorization:'Bearer '+otherKey } })).statusCode).toBe(404);
        const owned = await f.app.inject({ url,headers:{ authorization:'Bearer '+dxKey } }); expect(owned.statusCode,owned.body).toBe(200); expect(owned.headers['cache-control']).toBe('private, no-store');
      }
      const state = await f.app.inject({ url:'/v1/judgments/requests/owned',headers:{ authorization:'Bearer '+dxKey } });
      expect(state.json().data).toMatchObject({ state:'complete' }); expect(state.body).not.toContain('payment_receipt_ref'); expect(state.body).not.toContain('mock-proof-secret');
      expect((await f.app.inject({ url:'/v1/judgments/requests/owned',headers:{ authorization:'Bearer '+otherKey } })).statusCode).toBe(404);
      expect((await f.app.inject({ url:'/v1/judgments/history',headers:{ authorization:'Bearer '+otherKey } })).json().data.paid).toEqual([]);
      for (const url of ['/v1/receipt-spine/tape','/v1/receipt-spine/attempts','/v1/economics/revenue','/v1/attribution']) expect((await f.app.inject({ url,headers:{ authorization:'Bearer '+dxKey } })).statusCode).toBe(404);
      const noProof = await f.app.inject({ method:'POST',url:'/v1/pre-spend/check',payload:dxInput,headers:{ authorization:'Bearer '+dxKey,'idempotency-key':'owned' } }); expect(noProof.statusCode).toBe(401);
      const forged = await f.app.inject({ method:'POST',url:'/v1/pre-spend/check',payload:{ ...dxInput,agent_id:'other' },headers:{ authorization:'Bearer '+dxKey } }); expect(forged.statusCode).toBe(403);
      const wrongBody = await f.app.inject({ method:'POST',url:'/v1/pre-spend/check',payload:{ ...dxInput,budget:2 },headers:{ authorization:'Bearer '+dxKey,'idempotency-key':'owned' } }); expect(wrongBody.statusCode).toBe(409);
    } finally { await f.close(); }
  });
  it('validates identity configuration without printing keys and refuses duplicate credentials', () => {
    const digest = createHash('sha256').update(dxKey).digest('hex');
    const entry = { tenant_id:'a',agent_id:'agent',key_sha256:digest };
    const identity = createJudgmentIdentity(JSON.stringify([entry]));
    expect(identity.authenticate('Bearer '+dxKey)).toEqual({ tenant_id:'a',agent_id:'agent' }); expect(identity.authenticate('Bearer '+otherKey)).toBeNull();
    expect(() => createJudgmentIdentity(JSON.stringify([entry,entry]))).toThrow('invalid_judgment_identity_configuration');
    expect(() => createJudgmentIdentity('secret malformed')).toThrow('invalid_judgment_identity_configuration');
  });
});
