import { describe, expect, it } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createEvaluationService } from '../../src/services/evaluationService';
import { createReceiptAuthorityService, verifyReceiptChain, type ReceiptAppendStore } from '../../src/services/receiptAuthorityService';
import { FORBIDDEN_SCORE_FIELDS } from '../../src/schemas/evaluate';
import { sealReceipt } from '../../src/services/receiptIntegrityService';
import { evaluationInput, executionInput, judgmentInput, observationInput } from '../helpers/canonicalReceipts';

import { evaluationRequest, executionChain } from '../helpers/evaluations';
describe('canonical evaluation writer', () => {
  it('seals a complete replayable graph and stores policy and evaluator provenance', async () => {
    const store = new MemoryCanonicalReceiptStore(); const execution = await executionChain(store);
    const service = createEvaluationService(store, 80, () => new Date('2026-10-07T00:00:04Z'));
    const receipt = await service.submit(evaluationRequest, 'canonical-admin');
    expect(receipt).toMatchObject({ score_delta: -15, policy_version: 'score-policy.v1', parent_hash: execution.receipt_hash, evaluator: { type: 'internal', id: 'canonical-admin', verification: 'internal' } });
    expect(await verifyReceiptChain('evaluation', receipt, store)).toBe(true);
    expect(await verifyReceiptChain('evaluation', { ...receipt, outcome: 'confirmed' }, store)).toBe(false);
    const original = await store.get('evaluation', receipt.evaluation_id);
    await expect(store.append('evaluation', sealReceipt('evaluation', { ...receipt, reasons: ['correction'] }))).rejects.toThrow('receipt_id_conflict');
    expect(await store.get('evaluation', receipt.evaluation_id)).toEqual(original);
  });
  it('identical canonical receipt inputs and policy yield identical receipt material', async () => {
    const first = new MemoryCanonicalReceiptStore(); const second = new MemoryCanonicalReceiptStore();
    await executionChain(first); await executionChain(second);
    expect(await createEvaluationService(first).createEvaluation(evaluationInput())).toEqual(await createEvaluationService(second).createEvaluation(evaluationInput()));
  });
  it('requires verified evidence and rejects self-authored provenance on a sealed receipt', async () => {
    const store = new MemoryCanonicalReceiptStore(); await executionChain(store);
    const service = createEvaluationService(store);
    await expect(service.submit({ ...evaluationRequest, evidence_refs: [] }, 'canonical-admin')).rejects.toThrow('invalid_evaluation_request');
    const evaluation = await service.createEvaluation(evaluationInput());
    await expect(store.append('evaluation', sealReceipt('evaluation', { ...evaluation, evaluation_id: 'fake_verified', evaluator: { type: 'external', id: 'trusted', verification: 'verified' } }))).rejects.toThrow('evaluator_provenance_required');
  });
  it.each(['execution', 'judgment', 'observation'] as const)('missing %s ancestry cannot produce a contribution', async kind => {
    const backing = new MemoryCanonicalReceiptStore(); await executionChain(backing);
    const store: ReceiptAppendStore = { list: backing.list.bind(backing), append: backing.append.bind(backing), get: async (k, id) => k === kind ? null : backing.get(k, id) };
    await expect(createEvaluationService(store).createEvaluation(evaluationInput())).rejects.toThrow(kind + '_not_found');
    expect(await backing.list('evaluation')).toHaveLength(0);
  });
  it('replays concurrent retries once and rejects changed canonical content', async () => {
    const store = new MemoryCanonicalReceiptStore(); await executionChain(store);
    const services = [createEvaluationService(store), createEvaluationService(store)];
    const receipts = await Promise.all(services.map(s => s.submit(evaluationRequest, 'canonical-admin')));
    expect(receipts[0]).toEqual(receipts[1]); expect(await store.list('evaluation')).toHaveLength(1);
    expect(await createEvaluationService(store).submit(evaluationRequest, 'canonical-admin')).toEqual(receipts[0]);
    for (const change of [{ outcome: 'confirmed' }, { reasons: ['different'] }, { evidence_refs: ['other'] }, { outcome_labels: ['new'] }]) {
      await expect(services[0].submit({ ...evaluationRequest, ...change }, 'canonical-admin')).rejects.toMatchObject({ statusCode: 409, code: 'idempotency_conflict' });
    }
  });
  it.each(FORBIDDEN_SCORE_FIELDS)('rejects caller-authored %s even for admin', async field => {
    await expect(createEvaluationService(new MemoryCanonicalReceiptStore()).submit({ ...evaluationRequest, [field]: 10 }, 'canonical-admin')).rejects.toThrow('score_delta_authoring_forbidden');
  });
  it.each([undefined, { type: 'internal', id: 'trusted' }, { type: 'external', id: 'trusted', signature: 'pretend' }, { type: 'internal', id: 'canonical-admin', signature: 'pretend' }])('fails closed on unsupported evaluator provenance: %j', async evaluator => {
    const service = createEvaluationService(new MemoryCanonicalReceiptStore());
    await expect(service.submit({ ...evaluationRequest, evaluator }, 'canonical-admin')).rejects.toThrow();
  });
  it('requires authenticated provenance and real execution', async () => {
    const service = createEvaluationService(new MemoryCanonicalReceiptStore());
    await expect(service.submit(evaluationRequest)).rejects.toThrow('evaluator_provenance_required');
    await expect(service.submit(evaluationRequest, 'canonical-admin')).rejects.toThrow('execution_not_found');
  });
  it.each(['execution', 'judgment', 'observation'] as const)('fails on corrupted %s ancestry', async kind => {
    const backing = new MemoryCanonicalReceiptStore(); await executionChain(backing);
    const store: ReceiptAppendStore = { list: backing.list.bind(backing), append: backing.append.bind(backing), get: async (k, id) => {
      const receipt = await backing.get(k, id);
      return receipt && k === kind ? { ...receipt, receipt_hash: 'sha256:' + '0'.repeat(64) } : receipt;
    } };
    await expect(createEvaluationService(store).createEvaluation(evaluationInput())).rejects.toThrow('receipt_integrity_invalid');
    expect(await backing.list('evaluation')).toHaveLength(0);
  });
});
