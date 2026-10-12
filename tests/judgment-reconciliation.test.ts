import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { encodeEventTopics, parseAbi, encodeAbiParameters, parseAbiParameters } from 'viem';
import { setupJudgment, request } from './helpers/judgments';
import { judgmentRequestKey } from '../src/repositories/judgmentRequestRepository';
import { createJudgmentReconciliationService } from '../src/services/judgmentReconciliationService';
import type { BaseProofRpc } from '../src/security/settlementProofVerifier';
import { ECONOMIC_RAILS } from '../src/security/economicRails';
afterEach(() => vi.restoreAllMocks());
import { reconciliationFixture } from './helpers/judgmentReconciliation';
describe('independent ambiguous payment reconciliation',()=>{
  it('requires finalized matching transfer and exact authorization nonce, preserves the hash and never re-settles',async()=>{
    const f=await reconciliationFixture(); const reconcile=createJudgmentReconciliationService(f.journal,{ 'eip155:8453':f.rpc });
    expect(await reconcile.reconcile(f.record.response.judgment_id,{ transaction_hash:f.hash })).toMatchObject({ state:'settled',changed:true });
    const record=(await f.journal.get(f.key))!; expect(record.payment_hash).toBe(f.record.payment_hash); expect(record.reconciliation).toMatchObject({ verification:'rpc_finalized_eip3009_transfer',payment_hash:f.record.payment_hash });
    await expect(f.service.check(request,'ambiguous')).rejects.toMatchObject({ statusCode:401 });
    expect((await f.service.check(request,'ambiguous',f.signature)).status).toBe(200);
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1); expect(f.facilitator.verify).toHaveBeenCalledTimes(1);
    expect(await reconcile.reconcile(f.record.response.judgment_id,{ transaction_hash:f.hash })).toMatchObject({ changed:false });
    expect(JSON.stringify(record)).not.toContain('opaque-secret');
  });
  it.each(['rpc-failure','wrong-chain','reverted','unfinalized','missing-nonce','wrong-amount','wrong-nonce'])('keeps %s pending without clearing a hash or publishing a receipt',async mode=>{
    const f=await reconciliationFixture();
    if(mode==='rpc-failure') vi.mocked(f.rpc.getTransactionReceipt).mockRejectedValue(new Error('rpc unavailable'));
    if(mode==='wrong-chain') vi.mocked(f.rpc.getChainId).mockResolvedValue(4663);
    const receipt=await f.rpc.getTransactionReceipt({ hash:f.hash }).catch(()=>null);
    if(receipt){
      if(mode==='reverted') receipt.status='reverted';
      if(mode==='missing-nonce') receipt.logs=receipt.logs.slice(0,1);
      if(mode==='wrong-amount') receipt.logs[0].data=encodeAbiParameters(parseAbiParameters('uint256'),[9999n]);
      if(mode==='wrong-nonce') receipt.logs[1].topics[2]=('0x'+'f'.repeat(64)) as `0x${string}`;
      vi.mocked(f.rpc.getTransactionReceipt).mockResolvedValue(receipt);
    }
    if(mode==='unfinalized') vi.mocked(f.rpc.getBlock).mockImplementation(async input=>({ hash:('0x'+'b'.repeat(64)) as `0x${string}`,number:'blockTag' in input?0n:1n,timestamp:1791331203n }));
    await expect(createJudgmentReconciliationService(f.journal,{ 'eip155:8453':f.rpc }).reconcile(f.record.response.judgment_id,{ transaction_hash:f.hash })).rejects.toMatchObject({ code:'settlement_not_independently_confirmed' });
    const record=await f.journal.get(f.key); expect(record).toMatchObject({ state:'settling',payment_hash:f.record.payment_hash }); expect(await f.store.list('judgment')).toHaveLength(0); expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
  it('admits only one concurrent confirmation and rejects conflicting transaction hints',async()=>{
    const f=await reconciliationFixture(); const reconcile=createJudgmentReconciliationService(f.journal,{ 'eip155:8453':f.rpc });
    const results=await Promise.all([reconcile.reconcile(f.record.response.judgment_id,{ transaction_hash:f.hash }),reconcile.reconcile(f.record.response.judgment_id,{ transaction_hash:f.hash })]);
    expect(results.filter(r=>r.changed)).toHaveLength(1);
    await expect(reconcile.reconcile(f.record.response.judgment_id,{ transaction_hash:'0x'+'d'.repeat(64) })).rejects.toMatchObject({ code:'reconciliation_conflict' });
    expect(f.facilitator.settle).toHaveBeenCalledTimes(1);
  });
});
