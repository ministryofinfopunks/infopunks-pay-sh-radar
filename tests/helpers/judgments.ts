import { vi } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { MemoryJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';
import { createJudgmentService } from '../../src/services/judgmentService';
import { createX402JudgmentGateway } from '../../src/middleware/x402JudgmentMiddleware';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import type { FacilitatorClient } from '@x402/core/server';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { observationInput } from './canonicalReceipts';

import { request, facts, legacy } from './judgmentFixtures';
export { request, facts, legacy } from './judgmentFixtures';
export async function setupJudgment(overrides: Record<string, unknown> = {}, observationOverrides: Record<string, unknown> = {}, legacyOverrides: Partial<typeof legacy> = {}) {
  const store = new MemoryCanonicalReceiptStore(); const journal = new MemoryJudgmentRequestRepository();
  let clock = new Date('2026-10-07T00:00:02Z');
  const facilitator: FacilitatorClient = {
    getSupported: vi.fn(async () => ({ kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:8453' as const }], extensions: [], signers: {} })),
    verify: vi.fn(async () => ({ isValid: true, payer: '0x' + '1'.repeat(40) })),
    settle: vi.fn(async () => ({ success: true, transaction: '0x' + 'a'.repeat(64), network: 'eip155:8453' as const, payer: '0x' + '1'.repeat(40) }))
  };
  const gateway = await createX402JudgmentGateway({ facilitator, facilitatorUrl: 'https://facilitator.invalid', payTo: '0x' + '2'.repeat(40), amount: '0.01', resourceUrl: 'https://radar.infopunks.fun/v1/pre-spend/check' });
  const authority = createReceiptAuthorityService(store);
  const observation = await authority.appendObservation({ ...observationInput(), intent_hash: hashCanonical(request), source_type: 'reviewed_judgment_facts', provenance: { catalog_source: 'live' }, payload: { ...facts, ...overrides }, ...observationOverrides });
  const service = createJudgmentService({ store, journal, gateway, legacyCheck: () => ({ ...legacy, ...legacyOverrides }),
    observations: async () => [observation], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => clock });
  const signature = encodePaymentSignatureHeader({ x402Version: 2, accepted: gateway.requirements[0], payload: { signature: 'test-only', authorization: { nonce: 'test-only' } } });
  return { store, journal, service, gateway, authority, facilitator, observation, signature, setTime: (at: string) => { clock = new Date(at); } };
}
