import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
afterEach(() => vi.unstubAllEnvs());
it('protects accounting writes and serves actual empty settlement totals instead of template revenue', async () => {
  vi.stubEnv('ADMIN_TOKEN', 'test-accounting-admin');
  const app = await createApp(emptyIntelligenceStore());
  try {
    const empty = await app.inject('/v1/economics/revenue');
    expect(empty.statusCode).toBe(200); expect(empty.json().data).toMatchObject({ templates_included: false, revenues: [], costs: [] });
    expect((await app.inject({ method: 'POST', url: '/internal/economics/reconcile/missing' })).statusCode).toBe(401);
    const cost = { cost_id: 'api-rpc', network: 'eip155:4663', asset: 'USDG', amount_atomic: '2000', category: 'infrastructure', judgment_id: null, incurred_at: '2026-10-08T00:00:00Z', evidence_refs: ['artifact://invoice'] };
    expect((await app.inject({ method: 'POST', url: '/internal/economics/costs', payload: cost })).statusCode).toBe(401);
    const headers = { authorization: 'Bearer test-accounting-admin' };
    const write = await app.inject({ method: 'POST', url: '/internal/economics/costs', headers, payload: cost });
    expect(write.statusCode, write.body).toBe(200); expect(write.headers['cache-control']).toBe('private, no-store');
    expect((await app.inject({ method: 'POST', url: '/internal/economics/costs', headers, payload: cost })).json()).toEqual(write.json());
    expect((await app.inject({ method: 'POST', url: '/internal/economics/costs', headers, payload: { ...cost, amount_atomic: '1' } })).statusCode).toBe(400);
    const ledger = (await app.inject('/v1/economics/revenue')).json().data;
    expect(ledger.totals[1]).toMatchObject({ revenue_atomic: '0', recorded_costs_atomic: '2000', distributable_surplus_atomic: null });
    expect((await app.inject('/v1/attribution')).json().data).toMatchObject({ judgments: [], false_block_rate: null });
    expect((await app.inject('/v1/revenue-receipts')).statusCode).toBe(200);
  } finally { await app.close(); }
});
