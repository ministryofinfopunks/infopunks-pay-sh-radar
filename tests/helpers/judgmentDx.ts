import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { createApp } from '../../src/api/app';
import { createInfopunksClient, type CreateInfopunksClientOptions } from '../../src/sdk';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { MemoryJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import type { ReceiptAppendStore } from '../../src/services/receiptAuthorityService';
import type { JudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { request, facts, setupJudgment } from './judgments';
import { observationInput } from './canonicalReceipts';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
export const dxKey = 'dx1_' + 'a'.repeat(44);
export const otherKey = 'dx1_' + 'b'.repeat(44);
export const dxOwner = { tenant_id: 'tenant-a', agent_id: 'agent' };
export const testTenantKey = 'r2-test-tenant-key-that-is-not-secret-0001';
export function configureTestTenant() {
  vi.stubEnv('JUDGMENT_API_KEYS_JSON', JSON.stringify([{ tenant_id: 'test-tenant', agent_id: 'agent',
    key_sha256: createHash('sha256').update(testTenantKey).digest('hex') }]));
  return testTenantKey;
}
export const dxInput = { ...request, intent: 'buy_market_research', subject_id: 'route_pay_sh_market_research_03' };
export async function dxFixture(options: { store?: ReceiptAppendStore; journal?: JudgmentRequestRepository; paid?: boolean } = {}) {
  vi.stubEnv('ADMIN_TOKEN', 'reviewer');
  vi.stubEnv('JUDGMENT_API_KEYS_JSON', JSON.stringify([
    { ...dxOwner, key_sha256: createHash('sha256').update(dxKey).digest('hex') },
    { tenant_id: 'tenant-b', agent_id: 'agent', key_sha256: createHash('sha256').update(otherKey).digest('hex') }
  ]));
  const f = await setupJudgment();
  const store = options.store ?? new MemoryCanonicalReceiptStore();
  const journal = options.journal ?? new MemoryJudgmentRequestRepository();
  let app = await createApp(undefined, undefined, { judgmentGateway: f.gateway, judgmentReceiptStore: store, judgmentRequestJournal: journal });
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const injected = await app.inject({ method: (init?.method ?? 'GET') as 'POST' | 'GET', url: url.pathname, headers: Object.fromEntries(new Headers(init?.headers)), payload: init?.body as string | undefined });
    return new Response(injected.body, { status: injected.statusCode, headers: Object.fromEntries(Object.entries(injected.headers).filter(([,v]) => typeof v === 'string')) as Record<string,string> });
  };
  if (options.paid !== false) {
    const free = await app.inject({ method: 'POST', url: '/v1/pre-spend/check', payload: dxInput, headers: { authorization: 'Bearer ' + dxKey, 'idempotency-key': 'seed-diagnostic' } });
    if (free.statusCode !== 200) throw new Error(`seed Judgment failed (${free.statusCode}): ${free.body}`);
    const now = new Date();
    const seed = await app.inject({ method: 'POST', url: '/internal/receipt-spine/observation', headers: { authorization: 'Bearer reviewer' }, payload: {
      ...observationInput(), subject_type: 'route', subject_id: dxInput.subject_id, intent_hash: hashCanonical(dxInput), source_type: 'reviewed_judgment_facts',
      observed_at: now.toISOString(), ingested_at: now.toISOString(), freshness_expires_at: new Date(now.getTime() + 120_000).toISOString(),
      payload: { ...facts, route_id: free.json().data.recommended_route }, provenance: { catalog_source: 'live' }
    } });
    if (seed.statusCode !== 200) throw new Error(seed.body);
  }
  const events: unknown[] = [];
  const payment = { policy: { network: 'eip155:8453' as const, asset: 'USDC' as const, payTo: f.gateway.requirements[0].payTo, maxAmountAtomic: '10000' },
    authorize: vi.fn(async ({ challenge }: { challenge: { accepts: unknown[] } }) => encodePaymentSignatureHeader({ x402Version: 2, accepted: challenge.accepts[0] as never, payload: { signature: 'mock-proof-secret', authorization: {
      from: '0x' + '1'.repeat(40), to: f.gateway.requirements[0].payTo, value: '10000', nonce: '0x' + 'c'.repeat(64),
      validAfter: String(Math.floor(Date.now()/1000)-60), validBefore: String(Math.floor(Date.now()/1000)+120)
    } } })) };
  const client = (extra: Partial<CreateInfopunksClientOptions> = {}) => createInfopunksClient({ apiKey: dxKey, fetch, payment, onTransition: e => events.push(e), ...extra });
  return { f, store, journal, fetch, payment, events, client, get app() { return app; },
    restart: async () => { await app.close(); app = await createApp(undefined, undefined, { judgmentGateway: f.gateway, judgmentReceiptStore: store, judgmentRequestJournal: journal }); },
    close: async () => app.close() };
}
