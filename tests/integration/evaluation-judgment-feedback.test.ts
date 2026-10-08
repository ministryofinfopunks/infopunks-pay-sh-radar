import { encodePaymentSignatureHeader } from '@x402/core/http';
import { expect, it } from 'vitest';
import { request, setupJudgment } from '../helpers/judgments';
import { executionInput, qualifyingExecutionInput } from '../helpers/canonicalReceipts';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createDerivedScoreService } from '../../src/services/derivedScoreService';
import { evaluationRequest } from '../helpers/evaluations';

it('durable contradicted execution causes a subsequent judgment to veto without manually forcing it', async () => {
  const { store, authority, service, signature, setTime, gateway, facilitator } = await setupJudgment();
  const first = await service.check(request, 'first', signature);
  expect(first.response.decision).toBe('proceed');
  expect(first.response.receipt).not.toBeNull();
  const execution = await authority.appendExecution({ ...qualifyingExecutionInput(), judgment_id: first.response.judgment_id });
  setTime('2026-10-07T00:00:05Z');
  await createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:04Z')).submit({ ...evaluationRequest, execution_receipt_id: execution.execution_id }, 'canonical-admin');
  expect((await createDerivedScoreService(store).project('provider', 'provider_test')).score).toBe(-15);
  const secondSignature = encodePaymentSignatureHeader({ x402Version: 2, accepted: gateway.requirements[0], payload: { signature: 'second-test-only', authorization: { nonce: 'second-test-only' } } });
  facilitator.settle = async () => ({ success: true, transaction: '0x' + 'b'.repeat(64), network: 'eip155:8453', payer: '0x' + '1'.repeat(40) });
  const second = await service.check(request, 'second', secondSignature);
  expect(second.response.decision).toBe('do_not_spend');
  expect(second.response.reasons).toEqual(expect.arrayContaining(['historical_execution_performance_degraded', 'derived_score_below_policy_threshold', 'contradicted_evaluation_in_history']));
});

it.each([{ evidence_state: 'stale' }, { evidence_state: 'insufficient', evidence_refs: [] }, { freshness_expires_at: '2026-10-07T00:00:01Z' }])('positive history never bypasses invalid current evidence %j and remains free', async observationOverrides => {
  const ready = await setupJudgment();
  const first = await ready.service.check(request, 'history', ready.signature);
  await ready.authority.appendExecution({ ...executionInput(), judgment_id: first.response.judgment_id });
  const evaluations = createEvaluationService(ready.store, 80, () => new Date('2026-10-07T00:00:04Z'));
  for (let i = 0; i < 20; i++) {
    const execution_id = 'positive_' + i;
    await ready.authority.appendExecution({ ...executionInput(), execution_id, settlement_ref: `settlement_${i}`, judgment_id: first.response.judgment_id });
    await evaluations.submit({ ...evaluationRequest, execution_receipt_id: execution_id, outcome: 'confirmed', idempotency_key: execution_id }, 'canonical-admin');
  }
  expect((await createDerivedScoreService(ready.store).project('provider', 'provider_test')).score).toBe(0);
  // Same evaluated history with a newer observation representing the current failing evidence gate.
  const { createJudgmentService } = await import('../../src/services/judgmentService');
  const { schema_version, payload_hash, receipt_hash, ...current } = ready.observation;
  const observation = await ready.authority.appendObservation({ ...current, observation_id: 'latest', ...observationOverrides } as typeof current);
  const service = createJudgmentService({ store: ready.store, journal: ready.journal, gateway: ready.gateway, legacyCheck: () => first.legacy,
    observations: async () => [observation!], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:05Z') });
  const second = await service.check(request, 'invalid-current');
  expect(second.status).toBe(200); expect(second.response.decision).toBe('insufficient_evidence');
  expect(second.response.payment_required).toBe(false); expect(second.response.cost.amount).toBe('0');
});
