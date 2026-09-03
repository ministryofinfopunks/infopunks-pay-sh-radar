import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { MemoryRepository } from '../src/persistence/repository';
import { InMemoryRh4663Store, Rh4663Service } from '../src/services/rh4663Service';

const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

describe('Infopunks //4663 Phase 3 CALL overlay', () => {
  it('keeps anonymous and wallet-scoped state private while reusing the canonical CALL path', async () => {
    const priorNodeEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'test';
    const store = new InMemoryRh4663Store();
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: store });
    try {
      const anonymous = await app.inject({ method: 'GET', url: '/v1/4663/me/call' });
      expect(anonymous.statusCode).toBe(200);
      expect(anonymous.headers['cache-control']).toBe('private, no-store');
      expect(anonymous.json().data).toMatchObject({ authenticated: false, has_called: false, call_receipt_reference: null });

      const before = await app.inject({ method: 'GET', url: '/v1/4663/frontdoor' });
      const service = new Rh4663Service(store);
      const input = { wallet: account.address, rotation: 'STOCK_TOKENS' as const, confidence: 74 };
      const payload = service.pulsePayload(input);
      const signature = await account.signMessage({ message: payload.canonical_serialization });
      const submitted = await app.inject({ method: 'POST', url: '/v1/4663/pulse/calls', payload: { ...input, signature } });
      expect(submitted.statusCode).toBe(201);
      expect(submitted.json().data).toMatchObject({ protocol_receipt_type: 'CALL', immutable: true, rotation: 'STOCK_TOKENS', confidence: 74 });

      const mine = await app.inject({ method: 'GET', url: `/v1/4663/me/call?wallet=${account.address}` });
      expect(mine.statusCode).toBe(200);
      expect(mine.headers['cache-control']).toBe('private, no-store');
      expect(mine.json().data).toMatchObject({ authenticated: true, has_called: true, selection: 'STOCK_TOKENS', confidence: 74, resolution_state: 'UNRESOLVED' });
      expect(mine.json().data.call_receipt_reference).toBe(submitted.json().data.receipt_id);

      const after = await app.inject({ method: 'GET', url: '/v1/4663/frontdoor' });
      expect(after.headers['cache-control']).toContain('public');
      expect(after.json().data.frontdoor_version.version).toBe(before.json().data.frontdoor_version.version);
      expect(JSON.stringify(after.json().data)).not.toContain(submitted.json().data.receipt_id);
    } finally { await app.close(); if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv; }
  });
});
