import { expect, it } from 'vitest';
import { setupJudgment, request } from './helpers/judgments';
import { classifiedArtifact, qualifyingClassifiedExecution } from './helpers/canonicalReceipts';
import { evaluationRequest } from './helpers/evaluations';
import { createEvaluationService } from '../src/services/evaluationService';
import { verifyDecisionContext } from '../src/services/decisionContextService';
import { createDerivedScoreService } from '../src/services/derivedScoreService';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService } from '../src/services/receiptAuthorityService';
import { observationInput } from './helpers/canonicalReceipts';

it('freezes J1 before a late backdated E and lets a fresh assessment see E', async () => {
  const f = await setupJudgment();
  const first = await f.service.check(request, 'first', f.signature);
  const j1 = first.response.receipt!;
  const before = await f.store.getDecisionContext(j1.judgment_id);
  expect(before?.version).toBe('pre-spend-decision-context.v2');
  expect(before?.projection_boundary.kind).toBe('accepted_sequence.v2');
  expect(before?.evaluation_refs).toEqual([]);
  const execution = await f.authority.appendExecution({ ...qualifyingClassifiedExecution(false), judgment_id: j1.judgment_id });
  const evaluation = await createEvaluationService(f.store, 80, () => new Date('2026-10-07T00:00:04Z'))
    .submit({ ...evaluationRequest, execution_receipt_id: execution.execution_id, output_artifact: classifiedArtifact(false) }, 'canonical-admin');
  const accepted = await f.store.getAcceptance('evaluation', evaluation.evaluation_id);
  expect(accepted!.sequence).toBeGreaterThan(before!.projection_boundary.accepted_sequence!);
  expect(await verifyDecisionContext(before!, j1, f.store)).toBe(true);
  expect((await f.service.check(request, 'first', f.signature)).response.receipt).toEqual(j1);
  f.setTime('2026-10-07T00:00:05Z');
  const second = await f.service.check(request, 'second');
  const after = await f.store.getDecisionContext(second.response.judgment_id);
  expect(after?.score_projection.score).toBe(-15);
  expect(after?.evaluation_refs.map(r => r.evaluation_id)).toEqual([evaluation.evaluation_id]);
  expect(second.response.decision).toBe('do_not_spend');
  expect((await createDerivedScoreService(f.store).project('provider', 'provider_test', before!.projection_boundary.accepted_sequence)).score).toBe(0);
});

it('rejects future-dated evaluation before acceptance', async () => {
  const f = await setupJudgment();
  const first = await f.service.check(request, 'future', f.signature);
  const execution = await f.authority.appendExecution({ ...qualifyingClassifiedExecution(false), judgment_id: first.response.judgment_id });
  const boundary = await f.store.acceptanceBoundary();
  await expect(createEvaluationService(f.store, 80, () => new Date('2999-01-01T00:00:00Z'))
    .submit({ ...evaluationRequest, execution_receipt_id: execution.execution_id, output_artifact: classifiedArtifact(false) }, 'canonical-admin'))
    .rejects.toMatchObject({ code: 'evaluation_future_timestamp_quarantined' });
  expect(await f.store.acceptanceBoundary()).toMatchObject({ sequence: boundary.sequence });
});

it('quarantines future observation issuer time without accepting the receipt', async () => {
  const store = new MemoryCanonicalReceiptStore();
  const authority = createReceiptAuthorityService(store);
  await expect(authority.appendObservation({ ...observationInput(), observed_at: '2999-01-01T00:00:00Z',
    ingested_at: '2999-01-01T00:00:01Z' })).rejects.toMatchObject({ code: 'observation_future_timestamp_quarantined' });
  expect(await store.list('observation')).toEqual([]);
  expect(await store.listQuarantine()).toMatchObject([{ receipt_kind: 'observation', reason: 'future_issuer_timestamp' }]);
});
