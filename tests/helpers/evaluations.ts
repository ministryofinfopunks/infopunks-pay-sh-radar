import { createReceiptAuthorityService, type ReceiptAppendStore } from '../../src/services/receiptAuthorityService';
import { executionInput, judgmentInput, observationInput } from './canonicalReceipts';
export const evaluationRequest = { execution_receipt_id: 'x1', outcome: 'contradicted' as const, evidence_refs: ['artifact://failure'], reasons: ['output contradicted'],
  evaluator: { type: 'internal', id: 'canonical-admin' }, idempotency_key: 'economic-outcome-1' };
export async function executionChain(store: ReceiptAppendStore) {
  const authority = createReceiptAuthorityService(store);
  await authority.appendObservation(observationInput()); await authority.appendJudgment(judgmentInput());
  return authority.appendExecution(executionInput());
}
