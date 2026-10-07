import type { Hex } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { ExecuteProofRequestSchema } from '../../src/schemas/executeProof';
import { setupExecution } from '../helpers/executions';

describe('execution proof validation and settlement security', () => {
  it.each(['bad', 'a'.repeat(64), 'sha256:'+'z'.repeat(64)])('rejects malformed hash %s', async value => {
    const f = await setupExecution(); expect(ExecuteProofRequestSchema.safeParse({ ...f.proof, request_hash: value }).success).toBe(false);
  });
  it('rejects raw payloads, oversized references and unsupported settlement rails', async () => {
    const f = await setupExecution();
    for (const change of [{ raw_payload: 'secret' }, { artifact_refs: Array(33).fill('a') }, { artifact_refs: ['a'.repeat(257)] }, { settlement: { rail: 'solana', transaction_hash: f.proof.settlement.transaction_hash } }, { settlement: { rail: 'x402-base', receipt_ref: 'caller-claim' } }]) expect(ExecuteProofRequestSchema.safeParse({ ...f.proof, ...change }).success).toBe(false);
  });
  it.each(['failed', 'wrong_network', 'wrong_recipient', 'wrong_sender', 'wrong_token', 'wrong_amount', 'not_finalized', 'reorg', 'outside_window'] as const)('rejects %s settlement proof', async failure => {
    const f = await setupExecution(); const transaction = await f.rpc.getTransactionReceipt({ hash: f.proof.settlement.transaction_hash as `0x${string}` });
    if (failure === 'failed') vi.mocked(f.rpc.getTransactionReceipt).mockResolvedValue({ ...transaction, status: 'reverted' });
    if (failure === 'wrong_network') vi.mocked(f.rpc.getChainId).mockResolvedValue(1);
    if (failure === 'wrong_recipient') vi.mocked(f.rpc.getTransactionReceipt).mockResolvedValue({ ...transaction, logs: [{ ...transaction.logs[0], topics: [transaction.logs[0].topics[0]!, transaction.logs[0].topics[1]!, ('0x'+'0'.repeat(64)) as Hex] }] });
    if (failure === 'wrong_sender') vi.mocked(f.rpc.getTransactionReceipt).mockResolvedValue({ ...transaction, logs: [{ ...transaction.logs[0], topics: [transaction.logs[0].topics[0]!, ('0x'+'0'.repeat(64)) as Hex, transaction.logs[0].topics[2]!] }] });
    if (failure === 'wrong_token') vi.mocked(f.rpc.getTransactionReceipt).mockResolvedValue({ ...transaction, logs: [{ ...transaction.logs[0], address: ('0x'+'4'.repeat(40)) as Hex }] });
    if (failure === 'wrong_amount') vi.mocked(f.rpc.getTransactionReceipt).mockResolvedValue({ ...transaction, logs: [{ ...transaction.logs[0], data: ('0x'+'0'.repeat(63)+'1') as Hex }] });
    if (failure === 'not_finalized') vi.mocked(f.rpc.getBlock).mockResolvedValue({ hash: transaction.blockHash, number: 89n, timestamp: BigInt(Date.parse('2026-10-07T00:00:03Z')/1000) });
    if (failure === 'reorg') vi.mocked(f.rpc.getBlock).mockResolvedValue({ hash: ('0x'+'e'.repeat(64)) as Hex, number: 100n, timestamp: BigInt(Date.parse('2026-10-07T00:00:03Z')/1000) });
    if (failure === 'outside_window') vi.mocked(f.rpc.getBlock).mockResolvedValue({ hash: transaction.blockHash, number: 100n, timestamp: BigInt(Date.parse('2026-10-07T00:00:01Z')/1000) });
    await expect(f.proofService.submit(f.proof)).rejects.toThrow('invalid_settlement_proof'); expect(await f.store.list('execution')).toHaveLength(0);
  });
});
