import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService } from '../src/services/receiptAuthorityService';
import { createEvaluationService } from '../src/services/evaluationService';
import { receiptSchemas, sealReceipt } from '../src/services/receiptIntegrityService';
import { createObservationReceiptRepository } from '../src/repositories/observationReceiptRepository';
import { createJudgmentReceiptRepository } from '../src/repositories/judgmentReceiptRepository';
import { createExecutionReceiptRepository } from '../src/repositories/executionReceiptRepository';
import { createEvaluationReceiptRepository } from '../src/repositories/evaluationReceiptRepository';
import { appendChain, observationInput, judgmentInput, executionInput, evaluationInput } from './helpers/canonicalReceipts';

describe('canonical receipt authority', () => {
  it('keeps bare administrative evaluations inspectable but outside score authority', async () => {
    const store = new MemoryCanonicalReceiptStore(); const service = createReceiptAuthorityService(store);
    const evaluations = createEvaluationService(store);
    const score = async () => (await service.projectScore('provider', 'provider_test')).score;
    await service.appendObservation(observationInput()); expect(await score()).toBe(0);
    await service.appendJudgment(judgmentInput()); expect(await score()).toBe(0);
    await service.appendExecution(executionInput()); expect(await score()).toBe(0);
    await evaluations.createEvaluation(evaluationInput()); expect(await score()).toBe(0);
    expect((await service.projectScore('provider', 'other')).score).toBe(0);
  });
  it('does not expose evaluation creation or score policy from receipt authority', () => {
    const service = createReceiptAuthorityService(new MemoryCanonicalReceiptStore()) as Record<string, unknown>;
    expect(service.appendEvaluation).toBeUndefined();
    const source = readFileSync('src/services/receiptAuthorityService.ts', 'utf8');
    expect(source).not.toContain('scoreDeltaForOutcome');
    expect(source).not.toContain('confirmed: 5');
    expect(source).not.toContain('weakened: -2');
    expect(source).not.toContain('contradicted: -5');
  });
  it.each(['observation', 'judgment', 'execution'] as const)('%s strictly rejects score fields', async (kind) => {
    const chain = await appendChain(new MemoryCanonicalReceiptStore());
    for (const field of ['score_delta', 'scoreDelta', 'confidence_delta', 'confidenceDelta', 'trust_score']) {
      expect(receiptSchemas[kind].safeParse({ ...chain[kind], [field]: 5 }).success).toBe(false);
    }
  });
  it('rejects arbitrary evaluation deltas even with a valid hash', async () => {
    const store = new MemoryCanonicalReceiptStore(); const { evaluation } = await appendChain(store);
    await expect(store.append('evaluation', sealReceipt('evaluation', { ...evaluation, evaluation_id: 'forged', score_delta: 99 }))).rejects.toThrow('evaluation_policy_delta_invalid');
  });
  it('requires real parents at every level', async () => {
    const service = createReceiptAuthorityService(new MemoryCanonicalReceiptStore());
    const evaluations = createEvaluationService(new MemoryCanonicalReceiptStore());
    await expect(service.appendJudgment(judgmentInput())).rejects.toThrow('observation_not_found');
    await expect(service.appendExecution(executionInput())).rejects.toThrow('judgment_not_found');
    await expect(evaluations.createEvaluation(evaluationInput())).rejects.toThrow('execution_not_found');
  });
  it.each([
    [{ subject_id: 'other' }, 'observation_scope_mismatch'],
    [{ intent_hash: executionInput().request_hash }, 'observation_scope_mismatch'],
    [{ evidence_state: 'disputed' as const }, 'sufficient_evidence_required'],
    [{ evidence_state: 'stale' as const }, 'sufficient_evidence_required'],
    [{ evidence_refs: [] }, 'sufficient_evidence_required'],
    [{ freshness_expires_at: '2026-10-07T00:00:01Z' }, 'fresh_evidence_required'],
    [{ freshness_expires_at: null }, 'fresh_evidence_required'],
    [{ ingested_at: '2026-10-07T00:00:10Z' }, 'observation_after_judgment']
  ])('blocks proceed when observation is invalid: %j', async (change, error) => {
    const service = createReceiptAuthorityService(new MemoryCanonicalReceiptStore());
    await service.appendObservation({ ...observationInput(), ...change });
    await expect(service.appendJudgment(judgmentInput())).rejects.toThrow(error);
  });
  it('enforces configured confidence threshold and commits it for historical replay', async () => {
    const store = new MemoryCanonicalReceiptStore(95); const service = createReceiptAuthorityService(store, 95);
    await service.appendObservation(observationInput());
    await expect(service.appendJudgment(judgmentInput())).rejects.toThrow('confidence_threshold_not_met');
    const judgment = await service.appendJudgment({ ...judgmentInput(), confidence: 95 });
    expect(judgment.proceed_confidence_threshold).toBe(95);
  });
  it('keeps insufficient evidence distinct and free and blocks its execution', async () => {
    const service = createReceiptAuthorityService(new MemoryCanonicalReceiptStore());
    await service.appendObservation({ ...observationInput(), evidence_state: 'insufficient', evidence_refs: [] });
    await expect(service.appendJudgment(judgmentInput())).rejects.toThrow('insufficient_evidence_decision_required');
    const input = { ...judgmentInput(), decision: 'insufficient_evidence' as const, confidence: 0 };
    await expect(service.appendJudgment({ ...input, payment_required: true, charge: '0.01' })).rejects.toThrow();
    const judgment = await service.appendJudgment(input);
    expect(judgment.decision).toBe('insufficient_evidence'); expect(judgment.charge).toBe('0');
    await expect(service.appendExecution(executionInput())).rejects.toThrow('judgment_blocks_execution');
  });
  it('supports multiple observations, idempotency, and rejects conflicting IDs or repeated evaluations', async () => {
    const store = new MemoryCanonicalReceiptStore(); const service = createReceiptAuthorityService(store);
    const evaluations = createEvaluationService(store);
    const observation = await service.appendObservation(observationInput());
    expect(await service.appendObservation(observationInput())).toEqual(observation);
    await expect(service.appendObservation({ ...observationInput(), payload: { changed: true } })).rejects.toThrow('receipt_id_conflict');
    await service.appendObservation(observationInput('o2'));
    const judgment = await service.appendJudgment(judgmentInput(['o1', 'o2'])); expect(judgment.parent_hashes).toHaveLength(2);
    await service.appendExecution(executionInput()); await evaluations.createEvaluation(evaluationInput());
    await expect(evaluations.createEvaluation({ ...evaluationInput(), evaluation_id: 'e2' })).rejects.toThrow('execution_already_evaluated');
    await expect(service.appendExecution({ ...executionInput(), execution_id: 'x2', executed_at: '2026-10-08T00:00:00Z' })).rejects.toThrow('execution_outside_judgment_window');
  });
  it('exposes only append/read repository interfaces and returns isolated copies', async () => {
    const store = new MemoryCanonicalReceiptStore(); const { observation } = await appendChain(store);
    for (const create of [createObservationReceiptRepository, createJudgmentReceiptRepository, createExecutionReceiptRepository, createEvaluationReceiptRepository]) {
      expect(Object.keys(create(store)).sort()).toEqual(['append', 'get', 'list']);
    }
    observation.evidence_refs.push('forged');
    const read = await store.get('observation', 'o1');
    expect(read).not.toEqual(observation);
    if (read && 'evidence_refs' in read) read.evidence_refs.push('changed read');
    expect(await store.get('observation', 'o1')).not.toEqual(read);
  });
});
