import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { createInMemoryPreSpendRepository } from '../src/repositories/preSpendRepository';
import { createPreSpendIntelligenceService } from '../src/services/preSpendIntelligenceService';

const legacyReceipt = {
  agent_id: 'agent_test', route_id: 'route_pay_sh_token_quote_01', provider_id: 'provider_pay_sh_quartz', service_id: 'service_token_pricing', task_type: 'price_token_quote',
  cost: '0.07 USDC', payment_method: 'stablecoin', latency_ms: 20, input_summary: 'quote request', output_summary: 'quote response', status: 'succeeded', failure_reason: null,
  validation_state: 'machine_checked', human_notes: [], confidence_delta: 0, evidence_artifact: 'artifact_quote_test'
};
const claim = {
  submitted_by: 'community', claim_type: 'blocker', target_type: 'route', target_id: 'route_pay_sh_token_quote_01', statement: 'new receipt supplied',
  evidence_receipt_ids: ['receipt_001'], evidence_artifact_uris: ['artifact://quote'], status: 'submitted', confidence_score: 100, validation_state: 'machine_checked', support_count: 0, human_notes: []
};
afterEach(() => vi.unstubAllEnvs());
describe('legacy write authority lockdown', () => {
  it.each([-100, 1, 100])('rejects nonzero legacy confidence_delta %s before intake', async (delta) => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const before = (await app.inject('/v1/receipts')).json().data.receipts.length;
      const response = await app.inject({ method: 'POST', url: '/v1/receipts', payload: { ...legacyReceipt, confidence_delta: delta } });
      expect(response.statusCode).toBe(400); expect(response.json()).toEqual({ error: 'legacy_score_mutation_forbidden' });
      expect((await app.inject('/v1/receipts')).json().data.receipts).toHaveLength(before);
      expect((await app.inject('/v1/receipt-spine/scores/provider/provider_pay_sh_quartz')).json().data.score).toBe(0);
    } finally { await app.close(); }
  });
  it('preserves public receipt, claim, challenge, validation, Proof Check, and Loop Check intake with zero reputation authority', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const receipt = await app.inject({ method: 'POST', url: '/v1/receipts', payload: legacyReceipt });
      expect(receipt.statusCode).toBe(200); expect(receipt.json().data.confidence_delta).toBe(0);
      const createdClaim = await app.inject({ method: 'POST', url: '/v1/claims', payload: claim });
      expect(createdClaim.statusCode).toBe(200);
      const challenge = await app.inject({ method: 'POST', url: `/v1/claims/${createdClaim.json().data.claim_id}/challenges`, payload: { challenged_by: 'community', reason: 'counter evidence', evidence_receipt_ids: [], evidence_artifact_uris: [], status: 'submitted', human_notes: [] } });
      expect(challenge.statusCode).toBe(200);
      for (const [url, payload] of [
        ['/v1/validation/submit', { target_type: 'receipt', target_id: receipt.json().data.receipt_id, validator_id: 'community', validation_state: 'human_validated', output_quality_note: 'great', blocker_note: null, dispute_note: null, confidence_adjustment: 30, human_notes: 'approved' }],
        ['/v1/check', { input: 'Provider reliability validated verified.' }],
        ['/v1/loops/check', { input: 'Pre-spend provider trust route loop' }]
      ] as const) {
        const response = await app.inject({ method: 'POST', url, payload });
        expect(response.statusCode, response.body).toBe(200);
        expect((await app.inject('/v1/receipt-spine/scores/provider/provider_pay_sh_quartz')).json().data.score).toBe(0);
      }
      expect((await app.inject('/v1/receipts')).json().data.receipts.find((r: typeof legacyReceipt & { receipt_id: string }) => r.receipt_id === receipt.json().data.receipt_id)).toEqual(receipt.json().data);
    } finally { await app.close(); }
  });
  it('cannot mutate route/provider/service projections through legacy repositories', () => {
    const repository = createInMemoryPreSpendRepository();
    const before = structuredClone({ routes: repository.listRoutes(), providers: repository.listProviders(), services: repository.listServices() });
    const receipt = repository.createReceipt(legacyReceipt as Parameters<typeof repository.createReceipt>[0]);
    for (const [type, id] of [['receipt', receipt.receipt_id], ['provider', 'provider_pay_sh_quartz'], ['route', 'route_pay_sh_token_quote_01'], ['service', 'service_token_pricing']] as const) {
      repository.submitValidation({ target_type: type, target_id: id, validator_id: 'validator', validation_state: 'human_validated', output_quality_note: 'validated', blocker_note: null, dispute_note: null, confidence_adjustment: 30, human_notes: 'arbitrary reputation' });
    }
    expect({ routes: repository.listRoutes(), providers: repository.listProviders(), services: repository.listServices() }).toEqual(before);
    expect(repository.getReceipt(receipt.receipt_id)).toEqual(receipt);
    const service = createPreSpendIntelligenceService(repository);
    expect(service.getReceiptDetail(receipt.receipt_id)?.impact.should_affect_future_pre_spend_decisions).toBe(false);
  });
});
