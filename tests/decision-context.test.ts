import { describe, expect, it } from 'vitest';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { setupJudgment, request } from './helpers/judgments';
import { qualifyingExecutionInput } from './helpers/canonicalReceipts';
import { evaluationRequest } from './helpers/evaluations';
import { createEvaluationService } from '../src/services/evaluationService';
import { verifyDecisionContext } from '../src/services/decisionContextService';
import { verifyReceiptIntegrity } from '../src/services/receiptIntegrityService';

describe('paid v2 decision context', () => {
  it('freezes absent history at first quote, preserves same-key retries and detects a changed or missing dependency', async () => {
    const f = await setupJudgment();
    const quote = await f.service.check(request, 'frozen');
    expect(quote.status).toBe(402);
    const context = await f.store.getDecisionContext(quote.response.judgment_id);
    expect(context?.evaluation_refs).toEqual([]);
    expect(context?.score_projection.score).toBe(0);
    expect(context?.context_hash).toBe(quote.response.decision_context_hash);
    const repeat = await f.service.check(request, 'frozen');
    expect(repeat.response).toEqual(quote.response);
    await expect(f.service.check({ ...request, budget: request.budget + 1 }, 'frozen'))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
    const paid = await f.service.check(request, 'frozen', f.signature);
    const judgment = paid.response.receipt!;
    expect(judgment.schema_version).toBe('canonical-receipts.v2');
    expect(judgment.decision_context_hash).toBe(context?.context_hash);
    expect(verifyReceiptIntegrity('judgment', judgment)).toBe(true);
    expect(await verifyDecisionContext(context!, judgment, f.store)).toBe(true);
    expect((await f.service.check(request, 'frozen', f.signature)).response.receipt).toEqual(judgment);
    expect(await verifyDecisionContext({ ...context!, legacy_hash: 'sha256:' + '0'.repeat(64) }, judgment, f.store)).toBe(false);
    const missing = { ...f.store, judgmentTrust: f.store.judgmentTrust,
      get: async (kind: Parameters<typeof f.store.get>[0], id: string) => kind === 'observation' ? null : f.store.get(kind, id) };
    expect(await verifyDecisionContext(context!, judgment, missing)).toBe(false);
    const changed = { ...f.store, judgmentTrust: f.store.judgmentTrust,
      get: async (kind: Parameters<typeof f.store.get>[0], id: string) => {
        const found = await f.store.get(kind, id);
        return kind === 'observation' && found && 'payload' in found ? { ...found, payload: { changed: true } } : found;
      } };
    expect(await verifyDecisionContext(context!, judgment, changed)).toBe(false);
  });

  it('commits the contributing evaluation, score and fresh assessment to J2', async () => {
    const f = await setupJudgment();
    const first = await f.service.check(request, 'j1', f.signature);
    const execution = await f.authority.appendExecution({ ...qualifyingExecutionInput(), judgment_id: first.response.judgment_id });
    const evaluation = await createEvaluationService(f.store, 80, () => new Date('2026-10-07T00:00:04Z'))
      .submit({ ...evaluationRequest, execution_receipt_id: execution.execution_id }, 'canonical-admin');
    f.setTime('2026-10-07T00:00:05Z');
    const quote = await f.service.check(request, 'j2');
    const context = await f.store.getDecisionContext(quote.response.judgment_id);
    expect(context?.evaluation_refs).toEqual([{ evaluation_id: evaluation.evaluation_id,
      receipt_hash: evaluation.receipt_hash, score_delta: -15 }]);
    expect(context?.score_projection.score).toBe(-15);
    expect(quote.response.decision).toBe('do_not_spend');
    f.facilitator.settle = async () => ({ success: true, transaction: '0x' + 'b'.repeat(64), network: 'eip155:8453', payer: '0x' + '1'.repeat(40) });
    const signature = encodePaymentSignatureHeader({ x402Version: 2, accepted: f.gateway.requirements[0],
      payload: { signature: 'j2-test', authorization: { nonce: 'j2-test' } } });
    const second = await f.service.check(request, 'j2', signature);
    expect(await verifyDecisionContext(context!, second.response.receipt!, f.store)).toBe(true);
    expect((await f.service.check(request, 'j1', f.signature)).response.receipt).toEqual(first.response.receipt);
    expect(await verifyDecisionContext({ ...context!, evaluation_refs: [{ ...context!.evaluation_refs[0], receipt_hash: 'sha256:' + 'f'.repeat(64) }] }, second.response.receipt!, f.store)).toBe(false);
  });
});
