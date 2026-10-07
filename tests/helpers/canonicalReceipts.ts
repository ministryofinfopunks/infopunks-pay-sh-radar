import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { createReceiptAuthorityService, type ReceiptAppendStore } from '../../src/services/receiptAuthorityService';
import { createEvaluationService } from '../../src/services/evaluationService';

export const observationInput = (id = 'o1') => ({
  observation_id: id, subject_type: 'provider', subject_id: 'provider_test', intent_hash: hashCanonical({ intent: 'quote' }),
  source_type: 'live_catalog', source_id: 'catalog_run_1', observed_at: '2026-10-07T00:00:00Z', ingested_at: '2026-10-07T00:00:01Z',
  freshness_expires_at: '2026-10-08T00:00:00Z', evidence_state: 'sufficient' as const, evidence_refs: ['artifact://catalog_1'],
  provenance: { catalog_source: 'live' }, payload: { price: '0.01', available: true }
});
export const judgmentInput = (ids = ['o1']) => ({
  judgment_id: 'j1', subject_type: 'provider', subject_id: 'provider_test', intent_hash: observationInput().intent_hash,
  decision: 'proceed' as const, confidence: 90, reasons: ['fresh live evidence'], cited_observation_ids: ids,
  issued_at: '2026-10-07T00:00:02Z', valid_until: '2026-10-07T01:00:00Z', payment_required: false, payment_receipt_ref: null, charge: '0'
});
export const executionInput = () => ({
  execution_id: 'x1', judgment_id: 'j1', executed_at: '2026-10-07T00:00:03Z', settlement_rail: 'test', settlement_ref: 'settlement_1',
  request_hash: hashCanonical({ request: 'quote' }), response_hash: hashCanonical({ price: '0.01' }), payload_signature: null,
  latency_ms: 10, status: 'succeeded', cost_amount: '0.01', cost_asset: 'USDC', artifact_refs: ['artifact://execution_1']
});
export const evaluationInput = () => ({
  evaluation_id: 'e1', execution_id: 'x1', evaluated_at: '2026-10-07T00:00:04Z', outcome: 'confirmed' as const,
  reasons: ['output verified'], evidence_refs: ['artifact://evaluation_1']
});
export async function appendChain(store: ReceiptAppendStore) {
  const authority = createReceiptAuthorityService(store);
  const evaluations = createEvaluationService(store);
  const observation = await authority.appendObservation(observationInput());
  const judgment = await authority.appendJudgment(judgmentInput());
  const execution = await authority.appendExecution(executionInput());
  const evaluation = await evaluations.createEvaluation(evaluationInput());
  return { authority, observation, judgment, execution, evaluation };
}
