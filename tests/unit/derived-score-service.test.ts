import { describe, expect, it } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createDerivedScoreService } from '../../src/services/derivedScoreService';
import { appendChain } from '../helpers/canonicalReceipts';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createReceiptAuthorityService, type ReceiptAppendStore } from '../../src/services/receiptAuthorityService';
import { evaluationInput, judgmentInput, observationInput, qualifyingExecutionInput } from '../helpers/canonicalReceipts';

describe('receipt-derived projection', () => {
  it('has deterministic zero baseline, no provider dependency, counts, IDs and reproducible fingerprint', async () => {
    const store = new MemoryCanonicalReceiptStore(); const scores = createDerivedScoreService(store);
    const empty = await scores.project('provider', 'provider_test');
    expect(empty).toMatchObject({ score: 0, evaluation_count: 0, last_evaluated_at: null, contributing_evaluation_ids: [], outcome_counts: { confirmed: 0, weakened: 0, contradicted: 0 } });
    expect(await scores.project('provider', 'provider_test')).toEqual(empty);
    const { evaluation } = await appendChain(store);
    const first = await scores.project('provider', 'provider_test');
    expect(first).toMatchObject({ score: 5, evaluation_count: 1, contributing_evaluation_ids: [evaluation.evaluation_id], outcome_counts: { confirmed: 1, weakened: 0, contradicted: 0 } });
    await createEvaluationService(store).createEvaluation(evaluationInput());
    expect(await createDerivedScoreService(store).project('provider', 'provider_test')).toEqual(first);
    expect((await scores.project('provider', 'other')).score).toBe(0);
  });
  it('causally removes the -15 contribution when isolated backing history omits that receipt', async () => {
    const backing = new MemoryCanonicalReceiptStore(); const authority = createReceiptAuthorityService(backing);
    await authority.appendObservation(observationInput()); await authority.appendJudgment(judgmentInput()); await authority.appendExecution(qualifyingExecutionInput());
    const evaluation = await createEvaluationService(backing).createEvaluation({ ...evaluationInput(), outcome: 'contradicted' });
    let hidden = false;
    const isolated: ReceiptAppendStore = {
      get: (kind, id) => hidden && kind === 'evaluation' ? Promise.resolve(null) : backing.get(kind, id),
      list: kind => hidden && kind === 'evaluation' ? Promise.resolve([]) : backing.list(kind),
      append: (kind, receipt) => backing.append(kind, receipt)
    };
    const scores = createDerivedScoreService(isolated);
    const initial = await scores.project('provider', 'provider_test');
    expect(initial.score).toBe(-15); expect(initial.contributing_evaluation_ids).toEqual([evaluation.evaluation_id]);
    hidden = true;
    const removed = await createDerivedScoreService(isolated).project('provider', 'provider_test');
    expect(removed.score).toBe(0); expect(removed.evaluation_count).toBe(0); expect(removed.projection_hash).not.toBe(initial.projection_hash);
  });
  it('rejects tampered evaluation history rather than producing a score', async () => {
    const backing = new MemoryCanonicalReceiptStore(); await appendChain(backing);
    const store = { get: backing.get.bind(backing), append: backing.append.bind(backing), list: async (kind: Parameters<typeof backing.list>[0]) =>
      (await backing.list(kind)).map(r => kind === 'evaluation' ? { ...r, score_delta: 99 } : r) };
    await expect(createDerivedScoreService(store).project('provider', 'provider_test')).rejects.toThrow('receipt_integrity_invalid');
  });
});
