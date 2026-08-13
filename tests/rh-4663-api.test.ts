import { afterEach, describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/api/app';
import { MemoryRepository } from '../src/persistence/repository';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { InMemoryRh4663Store } from '../src/services/rh4663Service';

const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
afterEach(() => { delete process.env.NODE_ENV; });

describe('Infopunks //4663 API', () => {
  it('fails soft when persisted 4663 observations are unavailable', async () => {
    process.env.NODE_ENV = 'test';
    class Unavailable4663Store extends InMemoryRh4663Store {
      override async listCalls(): Promise<never> { throw new Error('storage unavailable'); }
      override async genesisCount(): Promise<never> { throw new Error('storage unavailable'); }
      override async listSignals(): Promise<never> { throw new Error('storage unavailable'); }
      override async getToday(): Promise<never> { throw new Error('storage unavailable'); }
    }
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new Unavailable4663Store() });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/4663' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({ pulse: { storage_status: 'unavailable', consensus: { state: 'unavailable' } }, today: { provider_state: 'unavailable', storage_status: 'unavailable', confidence: 0 }, genesis: { storage_status: 'unavailable' }, signal_hunt: { count: 0 } });
      expect(JSON.stringify(response.json())).toContain('No missing live observation has been fabricated');
    } finally { await app.close(); }
  });

  it('serves the additive operating surface without changing existing RH or Solana contracts', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const overview = await app.inject({ method: 'GET', url: '/v1/4663' });
      expect(overview.statusCode).toBe(200);
      expect(overview.json().data).toEqual(expect.objectContaining({ identity: 'INFOPUNKS // 4663', thesis: 'WE WATCH THE FLOW.', rotation_snapshot: expect.any(Object), today: expect.any(Object), genesis: expect.any(Object) }));
      for (const legacy of ['/v1/rh-chain', '/v1/rh-chain/4663-index', '/v1/rh-chain/daily-receipts', '/v1/pulse']) expect((await app.inject({ method: 'GET', url: legacy })).statusCode).toBe(200);
    } finally { await app.close(); }
  });

  it('builds, verifies, stores, and re-reads an immutable protocol receipt', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const payload = { wallet: account.address, rotation: 'STOCK_TOKENS', confidence: 91 };
      const canonicalResponse = await app.inject({ method: 'POST', url: '/v1/4663/pulse/payload', payload });
      expect(canonicalResponse.statusCode).toBe(200);
      const signature = await account.signMessage({ message: canonicalResponse.json().data.canonical_serialization });
      const created = await app.inject({ method: 'POST', url: '/v1/4663/pulse/calls', payload: { ...payload, signature } });
      expect(created.statusCode).toBe(201);
      expect(created.json().data).toMatchObject({ receipt_kind: 'PROTOCOL_RECEIPT', immutable: true, signature_verified: true, rotation: 'STOCK_TOKENS' });
      const receipt = await app.inject({ method: 'GET', url: `/v1/4663/receipts/${created.json().data.receipt_id}` });
      expect(receipt.json().data).toEqual(created.json().data);
      expect((await app.inject({ method: 'POST', url: '/v1/4663/pulse/calls', payload: { ...payload, signature } })).statusCode).toBe(409);
    } finally { await app.close(); }
  });

  it('validates confidence and preserves Signal Card semantics and attribution', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const invalid = await app.inject({ method: 'POST', url: '/v1/4663/pulse/payload', payload: { wallet: account.address, rotation: 'MEMES', confidence: 101 } });
      expect(invalid.statusCode).toBe(400);
      const submitted = await app.inject({ method: 'POST', url: '/v1/4663/signals', payload: { title: 'Liquidity route changed', category: 'liquidity', thesis: 'A cited pool route changed and should be watched.', submitter: '@origin', source_url: 'https://example.com/pool' } });
      expect(submitted.statusCode).toBe(201);
      expect(submitted.json().data).toMatchObject({ representation_kind: 'SIGNAL_CARD', original_submitter: '@origin', lifecycle_state: 'submitted', attribution_immutable: true });
      const evidence = await app.inject({ method: 'POST', url: `/v1/4663/signals/${submitted.json().data.signal_id}/evidence`, payload: { url: 'https://example.com/proof', label: 'Pool evidence' } });
      expect(evidence.json().data).toMatchObject({ original_submitter: '@origin', lifecycle_state: 'evidence_added' });
      const list = await app.inject({ method: 'GET', url: '/v1/4663/signals' });
      expect(list.json().data.guarantee_notice).toContain('not Evidence Receipts or Protocol Receipts');
    } finally { await app.close(); }
  });

  it('documents all public Phase 1 routes in OpenAPI', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const paths = (await app.inject({ method: 'GET', url: '/openapi.json' })).json().paths;
      for (const path of ['/v1/4663', '/v1/4663/pulse', '/v1/4663/pulse/payload', '/v1/4663/pulse/calls', '/v1/4663/today', '/v1/4663/today/archive', '/v1/4663/signals', '/v1/4663/events', '/v1/4663/receipts']) expect(paths[path]).toBeDefined();
    } finally { await app.close(); }
  });
});
