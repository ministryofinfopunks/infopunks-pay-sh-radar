import { vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeAbiParameters, encodeEventTopics, parseAbi, type Hex } from 'viem';
import { setupJudgment, request } from './judgments';
import { hashCanonical } from '../../src/services/receiptIntegrityService';
import { createExecutionProofService } from '../../src/services/executionProofService';
import { BASE_USDC, createBaseSettlementProofVerifier, type BaseProofRpc } from '../../src/security/settlementProofVerifier';
import { executionProofSigningMessage } from '../../src/security/payloadSignatureVerifier';
import type { ExecuteProofRequest } from '../../src/schemas/executeProof';
import type { JudgmentReceipt } from '../../src/schemas/receipts';
export const account = privateKeyToAccount(('0x'+'11'.repeat(32)) as Hex);
export const executionProfile = { profile: 'base_usdc_external.v1', request_hash: hashCanonical({ provider_request: 'quote' }), pay_to: '0x'+'3'.repeat(40), signer: account.address };
const hash = ('0x'+'b'.repeat(64)) as Hex;
const blockHash = ('0x'+'c'.repeat(64)) as Hex;
export async function setupExecution(policy: Record<string, unknown> = {}) {
  const f = await setupJudgment({ execution: executionProfile, ...policy });
  const parent = (await f.service.check(request, 'authorized', f.signature)).response.receipt!;
  const proof: ExecuteProofRequest = { judgment_id: parent.judgment_id, settlement: { rail: 'x402-base', transaction_hash: hash },
    request_hash: executionProfile.request_hash, response_hash: hashCanonical({ quote: 'result' }), latency_ms: 10, status: 'succeeded',
    cost: { amount: '0.1', asset: 'USDC' }, artifact_refs: ['artifact://quote'], executed_at: '2026-10-07T00:00:04Z', idempotency_key: 'execution-one' };
  const rpc: BaseProofRpc = {
    getChainId: vi.fn(async () => 8453),
    getBlock: vi.fn(async () => ({ hash: blockHash, number: 100n, timestamp: BigInt(Date.parse('2026-10-07T00:00:03Z')/1000) })),
    getTransactionReceipt: vi.fn(async () => ({ status: 'success' as const, transactionHash: hash, blockHash, blockNumber: 90n,
      logs: [{ address: BASE_USDC as Hex, data: encodeAbiParameters([{ type: 'uint256' }], [100000n]),
        topics: encodeEventTopics({ abi: parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']), eventName: 'Transfer', args: { from: account.address, to: executionProfile.pay_to as Hex } }) as [Hex, ...Hex[]],
        blockHash, blockNumber: 90n, transactionHash: hash, transactionIndex: 0, logIndex: 0, removed: false
      }] }))
  };
  const verifier = createBaseSettlementProofVerifier(rpc);
  const service = createExecutionProofService({ store: f.store, threshold: 80, verifier, now: () => new Date('2026-10-07T00:00:05Z') });
  const sign = async (payload: ExecuteProofRequest, judgment: JudgmentReceipt = parent) => ({ ...payload,
    payload_signature: await account.signMessage({ message: executionProofSigningMessage(payload, judgment) }) });
  return { ...f, parent, proof: await sign(proof), rpc, verifier, proofService: service, sign };
}
