import { describe, expect, it } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService, verifyReceiptChain } from '../src/services/receiptAuthorityService';
import { createEvaluationService } from '../src/services/evaluationService';
import { createDerivedScoreService } from '../src/services/derivedScoreService';
import { hashCanonical } from '../src/services/receiptIntegrityService';
import { judgmentInput, observationInput, qualifyingExecutionInput } from './helpers/canonicalReceipts';

const output = { task_id: 'provider_test', success: true, complete: true, detail: 'observed output' };
const artifact = (value: unknown) => ({ encoding: 'base64' as const, bytes: Buffer.from(JSON.stringify(value)).toString('base64'), source: 'signed_execution_response' as const });
async function setup(response = output, qualifying = true) {
  const store = new MemoryCanonicalReceiptStore();
  const authority = createReceiptAuthorityService(store);
  await authority.appendObservation(observationInput());
  await authority.appendJudgment(judgmentInput());
  const { score_eligibility: _ignored, ...unqualified } = qualifyingExecutionInput();
  const execution = qualifying ? qualifyingExecutionInput() : unqualified;
  await authority.appendExecution({ ...execution, response_hash: hashCanonical(response) });
  return { store, service: createEvaluationService(store), score: createDerivedScoreService(store) };
}
const request = (value: unknown = output) => ({ execution_receipt_id: 'x1', outcome: 'confirmed' as const,
  evidence_refs: ['artifact://signed-output'], evaluator: { type: 'internal', id: 'canonical-admin' },
  idempotency_key: 'classified-1', output_artifact: artifact(value) });

describe('A4 deterministic classification', () => {
  it('scores a replayable output bound to signed response and task', async () => {
    const { store, service, score } = await setup();
    const evaluation = await service.submit(request(), 'canonical-admin');
    expect(evaluation.classification?.artifact_sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(await verifyReceiptChain('evaluation', evaluation, store)).toBe(true);
    expect((await score.project('provider', 'provider_test')).score).toBe(5);
    const tampered = { ...evaluation, classification: { ...evaluation.classification!, artifact_bytes: artifact({ ...output, detail: 'changed' }).bytes } };
    expect(await verifyReceiptChain('evaluation', tampered, store)).toBe(false);
  });
  it('keeps a bare admin label and a synthetic/nonqualifying parent out of score', async () => {
    const bare = await setup();
    const { output_artifact: _ignored, ...bareRequest } = request();
    await bare.service.submit(bareRequest, 'canonical-admin');
    expect((await bare.score.project('provider', 'provider_test')).score).toBe(0);
    const synthetic = await setup(output, false);
    await expect(synthetic.service.submit(request(), 'canonical-admin')).rejects.toMatchObject({ code: 'artifact_source_unverified' });
  });
  it('rejects fabricated bytes, wrong task, malformed output and conflicting proposal', async () => {
    const { service } = await setup();
    await expect(service.submit(request({ ...output, detail: 'fabricated' }), 'canonical-admin')).rejects.toMatchObject({ code: 'artifact_response_commitment_mismatch' });
    await expect(service.submit(request({ ...output, task_id: 'other' }), 'canonical-admin')).rejects.toMatchObject({ code: 'artifact_response_commitment_mismatch' });
    await expect(service.submit({ ...request(), output_artifact: artifact('unstructured') }, 'canonical-admin')).rejects.toMatchObject({ code: 'artifact_output_invalid' });
    await expect(service.submit({ ...request(), outcome: 'contradicted' }, 'canonical-admin')).rejects.toMatchObject({ code: 'outcome_proposal_conflict' });
    await expect(service.submit({ ...request(), evaluator: { type: 'internal', id: 'canonical-admin', signature: 'unsupported' } }, 'canonical-admin')).rejects.toMatchObject({ code: 'evaluator_provenance_required' });
  });
});
