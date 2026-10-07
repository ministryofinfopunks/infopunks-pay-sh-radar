import { vi } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { MemoryJudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';
import { createJudgmentService } from '../../src/services/judgmentService';
import { createX402JudgmentGateway } from '../../src/middleware/x402JudgmentMiddleware';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import type { FacilitatorClient } from '@x402/core/server';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { PreSpendCheckResponseSchema } from '../../src/schemas/entities';
import { observationInput } from './canonicalReceipts';

export const request = { agent_id: 'agent', intent: 'quote', budget: 1, risk_tolerance: 'low' as const, preferred_settlement: 'stablecoin', required_confidence: 80, subject_id: 'provider_test' };
export const facts = { catalog_live: true, identity_resolved: true, required_proof_complete: true, intent_satisfied: true, constraints_satisfied: true,
  confidence: 90, deterministic_veto: false, bounded_test_allowed: false, max_cost: 0.1, asset: 'USDC', settlement: 'stablecoin',
  route_id: 'route_test', decision_state: 'approved', reasons: ['Reviewed scoped proof supports the requested action.'] };
export const legacy = PreSpendCheckResponseSchema.parse({ intent: 'quote', decision: 'use_with_caution', recommended_route: 'route_test', confidence_score: 0, risk_level: 'low', estimated_cost: '0.1 USDC', last_successful_run: null, known_blockers: [], requires_human_approval: false, receipt_references: [], safer_alternatives: [], do_not_use: [], rationale: ['Legacy intake cannot authorize.'] });
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
