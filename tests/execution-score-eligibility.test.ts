import { expect, it } from 'vitest';
import { request, setupJudgment } from './helpers/judgments';
import { setupExecution } from './helpers/executions';
import { executionInput } from './helpers/canonicalReceipts';
import { evaluationRequest } from './helpers/evaluations';
import { createEvaluationService } from '../src/services/evaluationService';
import { createDerivedScoreService } from '../src/services/derivedScoreService';

it('keeps internal examples inspectable while excluding them from score authority', async () => {
  const f = await setupJudgment();
  const judgment = await f.service.check(request, 'j', f.signature);
  for (let index = 0; index < 20; index++) {
    const execution = await f.authority.appendExecution({ ...executionInput(), execution_id: `internal_${index}`, judgment_id: judgment.response.judgment_id });
    await createEvaluationService(f.store).submit({ ...evaluationRequest, execution_receipt_id: execution.execution_id, idempotency_key: `internal_${index}` }, 'canonical-admin');
  }
  expect(await f.store.list('execution')).toHaveLength(20);
  expect((await createDerivedScoreService(f.store).project('provider', 'provider_test')).score).toBe(0);
});

it('admits only finalized proof-gateway execution into the projection', async () => {
  const f = await setupExecution();
  const execution = await f.proofService.submit(f.proof);
  expect(execution.score_eligibility).toMatchObject({ state: 'qualifying', intake: 'external_proof_gateway.v1', proof_profile: 'base_usdc_external.v1' });
  await createEvaluationService(f.store, 80, () => new Date('2026-10-07T00:00:05Z'))
    .submit({ ...evaluationRequest, execution_receipt_id: execution.execution_id }, 'canonical-admin');
  expect((await createDerivedScoreService(f.store).project('provider', 'provider_test')).score).toBe(-15);
});
