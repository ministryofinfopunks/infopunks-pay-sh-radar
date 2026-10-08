import { describe, expect, it, vi } from 'vitest';
import { setupExecution } from '../helpers/executions';
import { verifyReceiptIntegrity, sealReceipt } from '../../src/services/receiptIntegrityService';
import { createExecutionProofService } from '../../src/services/executionProofService';

describe('free canonical execution proof intake', () => {
  it('creates one append-only receipt with real signature checks, parent and zero score', async () => {
    const f = await setupExecution();
    const receipt = await f.proofService.submit(f.proof);
    expect(receipt.parent_hash).toBe(f.parent.receipt_hash); expect(receipt.judgment_id).toBe(f.parent.judgment_id);
    expect(receipt.verification?.settlement.verified).toBe(true);
    expect(receipt.verification?.payload_hashes).toBe('externally_supplied_signed_claims');
    expect(verifyReceiptIntegrity('execution', receipt)).toBe(true);
    expect(verifyReceiptIntegrity('execution', { ...receipt, cost_amount: '1' })).toBe(false);
    expect((await f.authority.projectScore('provider', 'provider_test')).score).toBe(0);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1); // Judgment purchase only.
  });
  it('replays identical proofs without verifying or charging again; conflicts return 409', async () => {
    const f = await setupExecution(); const first = await f.proofService.submit(f.proof);
    expect(await f.proofService.submit(f.proof)).toEqual(first); expect(f.rpc.getTransactionReceipt).toHaveBeenCalledTimes(1);
    await expect(f.proofService.submit({ ...f.proof, latency_ms: 20 })).rejects.toMatchObject({ statusCode: 409 });
    expect(await f.store.list('execution')).toHaveLength(1);
  });
  it('rejects missing judgment, execution after expiry and future execution', async () => {
    const f = await setupExecution();
    await expect(f.proofService.submit({ ...f.proof, judgment_id: 'missing' })).rejects.toThrow('judgment_not_found');
    await expect(f.proofService.submit({ ...f.proof, executed_at: f.parent.valid_until })).rejects.toThrow('execution_outside_judgment_window');
    await expect(f.proofService.submit({ ...f.proof, executed_at: '2026-10-07T00:00:06Z' })).rejects.toThrow('execution_outside_judgment_window');
  });
  it.each(['do_not_spend', 'insufficient_evidence'] as const)('rejects %s authorization', async decision => {
    const f = await setupExecution();
    const { payment: ignored, ...unpaid } = f.parent;
    const parent = sealReceipt('judgment', { ...unpaid, judgment_id: 'negative', decision, payment_required: false, payment_receipt_ref: null, charge: '0' });
    await f.store.append('judgment', parent);
    await expect(f.proofService.submit({ ...f.proof, judgment_id: parent.judgment_id })).rejects.toThrow('judgment_blocks_execution');
    expect(await f.store.list('execution')).toHaveLength(0);
  });
  it('rejects changed subject/parent context and invalid signatures', async () => {
    const f = await setupExecution();
    await expect(f.proofService.submit({ ...f.proof, response_hash: f.proof.request_hash })).rejects.toThrow('invalid_execution_payload_signature');
    await expect(f.proofService.submit({ ...f.proof, payload_signature: undefined })).rejects.toThrow('invalid_execution_payload_signature');
  });
  it('rejects an unrelated parent binding and tampered judgment integrity', async () => {
    const f = await setupExecution();
    const other = sealReceipt('judgment', { ...f.parent, judgment_id: 'other-parent' });
    await f.store.append('judgment', other);
    await expect(f.proofService.submit({ ...f.proof, judgment_id: other.judgment_id })).rejects.toThrow('invalid_execution_payload_signature');
    const get = f.store.get.bind(f.store);
    vi.spyOn(f.store, 'get').mockImplementation(async (kind, id) => {
      const receipt = await get(kind, id);
      return kind === 'judgment' && receipt ? { ...receipt, receipt_hash: 'sha256:'+'0'.repeat(64) } : receipt;
    });
    await expect(f.proofService.submit(f.proof)).rejects.toThrow('judgment_integrity_invalid');
  });
  it('does not accept the judgment purchase fee as proof of external execution', async () => {
    const f = await setupExecution();
    const other = sealReceipt('judgment', { ...f.parent, judgment_id: 'fee-substitution', payment_receipt_ref: f.proof.settlement.transaction_hash });
    await f.store.append('judgment', other);
    const proof = await f.sign({ ...f.proof, judgment_id: other.judgment_id }, other);
    await expect(f.proofService.submit(proof)).rejects.toThrow('invalid_settlement_proof');
  });
  it('rejects execution that exceeds policy or changes authorized request', async () => {
    const f = await setupExecution();
    await expect(f.proofService.submit({ ...f.proof, cost: { amount: '0.2', asset: 'USDC' } })).rejects.toThrow('execution_constraints_violated');
    await expect(f.proofService.submit({ ...f.proof, request_hash: f.proof.response_hash })).rejects.toThrow('execution_constraints_violated');
  });
  it('fails closed when verifier is absent or rejects settlement', async () => {
    const f = await setupExecution();
    const disabled = createExecutionProofService({ store: f.store, threshold: 80, verifier: null });
    await expect(disabled.submit(f.proof)).rejects.toThrow('settlement_proof_verifier_unavailable');
    vi.mocked(f.rpc.getTransactionReceipt).mockRejectedValue(new Error('not found'));
    await expect(f.proofService.submit(f.proof)).rejects.toThrow('invalid_settlement_proof');
    expect(await f.store.list('execution')).toHaveLength(0);
  });
  it('rejects a second execution for one judgment and serializes identical retries', async () => {
    const f = await setupExecution();
    const receipts = await Promise.all([f.proofService.submit(f.proof), f.proofService.submit(f.proof)]);
    expect(receipts[0]).toEqual(receipts[1]); expect(await f.store.list('execution')).toHaveLength(1);
    const other = await f.sign({ ...f.proof, idempotency_key: 'second-key' });
    await expect(f.proofService.submit(other)).rejects.toMatchObject({ statusCode: 409 });
  });
});
