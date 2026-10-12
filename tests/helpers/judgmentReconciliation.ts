import { expect, vi } from 'vitest';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { encodeEventTopics, parseAbi, encodeAbiParameters, parseAbiParameters } from 'viem';
import { setupJudgment, request } from './judgments';
import { judgmentRequestKey } from '../../src/repositories/judgmentRequestRepository';
import { createJudgmentReconciliationService } from '../../src/services/judgmentReconciliationService';
import type { BaseProofRpc } from '../../src/security/settlementProofVerifier';
import { ECONOMIC_RAILS } from '../../src/security/economicRails';
export async function reconciliationFixture() {
  const f = await setupJudgment();
  const payer = ('0x'+'1'.repeat(40)) as `0x${string}`; const to = f.gateway.requirements[0].payTo as `0x${string}`;
  const nonce = ('0x'+'c'.repeat(64)) as `0x${string}`; const hash = ('0x'+'a'.repeat(64)) as `0x${string}`; const block = ('0x'+'b'.repeat(64)) as `0x${string}`;
  const abi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)','event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)']);
  const base = { address:ECONOMIC_RAILS['eip155:8453'].token, removed:false, blockHash:block, blockNumber:1n, transactionHash:hash, transactionIndex:0 };
  const transfer = { ...base,logIndex:0,topics:encodeEventTopics({ abi,eventName:'Transfer',args:{ from:payer,to } }),data:encodeAbiParameters(parseAbiParameters('uint256'),[10000n]) };
  const used = { ...base,logIndex:1,topics:encodeEventTopics({ abi,eventName:'AuthorizationUsed',args:{ authorizer:payer,nonce } }),data:'0x' as `0x${string}` };
  const rpc: BaseProofRpc = { getChainId:vi.fn(async()=>8453), getTransactionReceipt:vi.fn(async()=>({ status:'success' as const,transactionHash:hash,blockHash:block,blockNumber:1n,logs:[transfer,used] as never })), getBlock:vi.fn(async()=>({ hash:block,number:1n,timestamp:1791331203n })) };
  const signature = encodePaymentSignatureHeader({ x402Version:2,accepted:f.gateway.requirements[0],payload:{ signature:'opaque-secret',authorization:{ from:payer,to,value:'10000',nonce,validAfter:'1791331199',validBefore:'1791331300' } } });
  vi.mocked(f.facilitator.settle).mockRejectedValue(new Error('ambiguous'));
  await expect(f.service.check(request,'ambiguous',signature)).rejects.toThrow('ambiguous');
  const key = judgmentRequestKey(request.agent_id,'ambiguous'); const record = (await f.journal.get(key))!;
  return { ...f,rpc,signature,key,record,hash,transfer,used };
}
