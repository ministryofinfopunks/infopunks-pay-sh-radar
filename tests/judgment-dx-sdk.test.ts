import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createEncryptedJudgmentSessionStore } from '../src/sdk/protectedSessionStore';
import { judgmentRequestKey } from '../src/repositories/judgmentRequestRepository';
import { dxFixture, dxInput, dxKey, dxOwner, otherKey } from './helpers/judgmentDx';
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('DX-1 deterministic SDK', () => {
  it('returns free insufficient evidence and never authorizes payment', async () => {
    const f = await dxFixture({ paid: false });
    try {
      const client = f.client();
      expect(await client.judge(dxInput, { idempotencyKey: 'free' })).toMatchObject({ state: 'INSUFFICIENT_EVIDENCE', cost: { amount: '0' }, receipt: null, presentation: { next_action: 'collect_evidence' } });
      expect(f.payment.authorize).not.toHaveBeenCalled(); expect(f.f.facilitator.settle).not.toHaveBeenCalled();
      expect(await client.resume('free')).toMatchObject({ decision: 'insufficient_evidence' });
    } finally { await f.close(); }
  });
  it('verifies receipt parents/context, exposes every paid transition and retains the proof privately', async () => {
    const f = await dxFixture();
    try {
      const client = f.client(); const result = await client.judge(dxInput, { idempotencyKey: 'paid' });
      expect(result.state).toBe('RECEIPT_VERIFIED'); expect(result.verification).toMatchObject({ integrity: true, issuer: 'unverified', execution_authorized: false });
      expect(f.events).toMatchObject([{ from: 'REQUESTED', to: 'PAYMENT_REQUIRED' }, { to: 'PAYMENT_AUTHORIZED' }, { to: 'PAYMENT_SUBMITTED' }, { to: 'SETTLED' }, { to: 'RECEIPT_VERIFIED' }]);
      expect((await client.resume('paid')).receipt).toEqual(result.receipt);
      expect(f.payment.authorize).toHaveBeenCalledTimes(1); expect(f.f.facilitator.verify).toHaveBeenCalledTimes(1); expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(f.events)).not.toContain('mock-proof-secret'); expect(JSON.stringify(f.events)).not.toContain(dxKey);
      expect(JSON.stringify(await f.journal.get(judgmentRequestKey(dxOwner.agent_id, 'paid', dxOwner)))).not.toContain('mock-proof-secret');
    } finally { await f.close(); }
  });
  it('coalesces identical calls and rejects concurrent/sequential conflicting key reuse', async () => {
    const f = await dxFixture();
    try {
      const client = f.client(); const first = client.judge(dxInput, { idempotencyKey: 'concurrent' }); const same = client.judge(dxInput, { idempotencyKey: 'concurrent' });
      await expect(client.judge({ ...dxInput, budget: 2 }, { idempotencyKey: 'concurrent' })).rejects.toMatchObject({ code: 'idempotency_conflict' });
      expect((await first).receipt).toEqual((await same).receipt);
      await expect(client.judge({ ...dxInput, budget: 2 }, { idempotencyKey: 'concurrent' })).rejects.toMatchObject({ code: 'idempotency_conflict' });
      expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
    } finally { await f.close(); }
  });
  it.each(['absent','exceeded','declined'])('requires explicit payment authorization: %s', async mode => {
    const f = await dxFixture();
    try {
      const payment = mode === 'absent' ? undefined : mode === 'exceeded' ? { ...f.payment, policy: { ...f.payment.policy, maxAmountAtomic: '1' } } : { ...f.payment, authorize: async () => null };
      await expect(f.client({ payment }).judge(dxInput)).rejects.toMatchObject({ state: 'PAYMENT_DECLINED' });
      expect(f.payment.authorize).not.toHaveBeenCalled(); expect(f.f.facilitator.settle).not.toHaveBeenCalled();
    } finally { await f.close(); }
  });
  it.each(['invalid-challenge','invalid-proof','unsupported-network','foreign-payee'])('rejects %s before settlement', async mode => {
    const f = await dxFixture();
    try {
      const fetch = async (...args: Parameters<typeof f.fetch>) => {
        const res = await f.fetch(...args); if (res.status !== 402) return res;
        const headers = new Headers(res.headers);
        if (mode === 'invalid-challenge') headers.set('payment-required','broken');
        if (mode === 'unsupported-network' || mode === 'foreign-payee') {
          const challenge = JSON.parse(Buffer.from(headers.get('payment-required')!,'base64').toString());
          if (mode === 'unsupported-network') challenge.accepts[0].network = 'solana:mainnet'; else challenge.accepts[0].payTo = '0x'+'f'.repeat(40);
          headers.set('payment-required',Buffer.from(JSON.stringify(challenge)).toString('base64'));
        }
        return new Response(await res.text(), { status: res.status, headers });
      };
      const payment = mode === 'invalid-proof' ? { ...f.payment, authorize: async () => 'invalid' } : f.payment;
      await expect(f.client({ fetch, payment }).judge(dxInput)).rejects.toMatchObject({ state: mode === 'foreign-payee' ? 'PAYMENT_DECLINED' : 'PAYMENT_VERIFICATION_FAILED' });
      expect(f.f.facilitator.settle).not.toHaveBeenCalled();
    } finally { await f.close(); }
  });
  it('recovers a timeout before payment submission with the same key', async () => {
    const f = await dxFixture();
    try {
      let drop = true; const client = f.client({ fetch: async (...args) => { const response = await f.fetch(...args); if (drop && args[1]?.method === 'POST') { drop = false; throw new Error('network'); } return response; } });
      await expect(client.judge(dxInput,{ idempotencyKey:'before' })).rejects.toMatchObject({ state:'SERVICE_UNAVAILABLE' });
      expect(f.f.facilitator.settle).not.toHaveBeenCalled(); expect((await client.resume('before')).state).toBe('RECEIPT_VERIFIED');
      expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
    } finally { await f.close(); }
  });
  it('recovers a lost settled response across SDK/server restart with encrypted proof storage', async () => {
    const f = await dxFixture(); const directory = await mkdtemp(join(tmpdir(),'radar-protected-')); const encryptionKey = randomBytes(32);
    try {
      const sessionStore = createEncryptedJudgmentSessionStore({ directory,encryptionKey });
      const client = f.client({ sessionStore, fetch: async (...args) => { const response = await f.fetch(...args); if (new Headers(args[1]?.headers).has('payment-signature')) throw new Error('response_lost'); return response; } });
      await expect(client.judge(dxInput,{ idempotencyKey:'after' })).rejects.toMatchObject({ state:'PAYMENT_PENDING_RECONCILIATION',code:'payment_status_unknown' });
      for (const file of await readdir(directory)) expect((await readFile(join(directory,file))).includes(Buffer.from('mock-proof-secret'))).toBe(false);
      await f.restart();
      expect((await f.client({ sessionStore:createEncryptedJudgmentSessionStore({ directory,encryptionKey }) }).resume('after')).state).toBe('RECEIPT_VERIFIED');
      expect(f.payment.authorize).toHaveBeenCalledTimes(1); expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
      await expect(f.client({ apiKey:otherKey, sessionStore }).resume('after')).rejects.toMatchObject({ state:'UNAUTHORIZED' });
    } finally { await f.close(); await rm(directory,{ recursive:true }); }
  });
  it('keeps an ambiguous settlement pending without retrying or exposing facilitator secrets', async () => {
    const f = await dxFixture();
    try {
      vi.mocked(f.f.facilitator.settle).mockRejectedValue(new Error('timeout mock-proof-secret'));
      const client = f.client(); const error = await client.judge(dxInput,{ idempotencyKey:'uncertain' }).catch(e => e);
      expect(error.state).toBe('PAYMENT_PENDING_RECONCILIATION'); expect(JSON.stringify(error)).not.toContain('mock-proof-secret');
      await expect(client.resume('uncertain')).rejects.toMatchObject({ code:'payment_pending_reconciliation' }); expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
    } finally { await f.close(); }
  });
  it('honors cancellation before a proof is submitted', async () => {
    const f = await dxFixture();
    try {
      const controller = new AbortController();
      const payment = { ...f.payment, authorize: async (input: Parameters<typeof f.payment.authorize>[0]) => { const proof = await f.payment.authorize(input); controller.abort(); return proof; } };
      await expect(f.client({ payment }).judge(dxInput,{ signal:controller.signal })).rejects.toMatchObject({ state:'CANCELLED' }); expect(f.f.facilitator.settle).not.toHaveBeenCalled();
    } finally { await f.close(); }
  });
  it('rejects expired quotes and tampered receipt integrity without repurchasing', async () => {
    const f = await dxFixture();
    try {
      const expiredFetch = async (...args: Parameters<typeof f.fetch>) => { const res = await f.fetch(...args); if (res.status !== 402) return res; const body = await res.json(); body.valid_until = new Date(0).toISOString(); return new Response(JSON.stringify(body),{ status:402,headers:res.headers }); };
      await expect(f.client({ fetch:expiredFetch }).judge(dxInput)).rejects.toMatchObject({ state:'QUOTE_EXPIRED',code:'judgment_quote_expired' });
      const tamperFetch = async (...args: Parameters<typeof f.fetch>) => { const res = await f.fetch(...args); if (res.status !== 200 || !new Headers(args[1]?.headers).has('payment-signature')) return res; const body = await res.json(); body.receipt.reasons=['tampered']; return new Response(JSON.stringify(body),{ status:200,headers:res.headers }); };
      await expect(f.client({ fetch:tamperFetch }).judge(dxInput)).rejects.toMatchObject({ state:'RECEIPT_VERIFICATION_FAILED' }); expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
    } finally { await f.close(); }
  });
  it('rejects forged agents, market shorthand and invalid credentials', async () => {
    const f = await dxFixture();
    try {
      await expect(f.client().judge({ ...dxInput,agent_id:'forged' })).rejects.toMatchObject({ state:'INVALID_REQUEST' });
      await expect(f.client().judge({ intent:'trade',budget:1,subject:'market:PLTR' })).rejects.toMatchObject({ state:'INVALID_REQUEST' });
      await expect(f.client({ apiKey:'invalid' }).judge(dxInput)).rejects.toMatchObject({ state:'UNAUTHORIZED' }); expect(f.f.facilitator.settle).not.toHaveBeenCalled();
    } finally { await f.close(); }
  });
});

it('does not let observers or wallet callbacks mutate the checked spending authority',async()=>{
  const f=await dxFixture();
  try {
    const payment={ ...f.payment,authorize:async(input: Parameters<typeof f.payment.authorize>[0])=>{
      (input.challenge.accepts[0] as { amount:string }).amount='999999999'; return f.payment.authorize(input);
    } };
    await expect(f.client({ payment,onAssessment:r=>{ r.cost.amount='999999999'; } }).judge(dxInput)).rejects.toMatchObject({ state:'PAYMENT_VERIFICATION_FAILED',code:'invalid_authorized_proof' });
    expect(f.f.facilitator.settle).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('replays an expired historical receipt without renewing its authority or charging again',async()=>{
  const f=await dxFixture();
  try {
    const client=f.client(); const result=await client.judge(dxInput,{ idempotencyKey:'historical' });
    vi.useFakeTimers({ toFake:['Date'] }); vi.setSystemTime(new Date(Date.now()+180_000));
    const historical=await client.resume('historical');
    expect(historical.receipt).toEqual(result.receipt); expect(historical.verification).toMatchObject({ historical:true,execution_authorized:false });
    expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); await f.close(); }
});

it('preserves a failed settlement claim and refuses a cancellation or retry that could charge twice',async()=>{
  const f=await dxFixture();
  try {
    vi.mocked(f.f.facilitator.settle).mockResolvedValue({ success:false,errorReason:'rejected',network:'eip155:8453',transaction:'' });
    const client=f.client();
    await expect(client.judge(dxInput,{ idempotencyKey:'failed-settlement' })).rejects.toMatchObject({ state:'PAYMENT_VERIFICATION_FAILED' });
    await expect(client.resume('failed-settlement')).rejects.toMatchObject({ state:'PAYMENT_PENDING_RECONCILIATION' });
    expect(await f.journal.get(judgmentRequestKey(dxOwner.agent_id,'failed-settlement',dxOwner))).toMatchObject({ state:'settling' });
    expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});

it('supports the three-field developer call and keeps unqualified token-market policy free',async()=>{
  const f=await dxFixture({ paid:false });
  try {
    expect(await f.client().judge({ intent:'buy market research',budget:0.20,subject:'route:market-research' })).toMatchObject({ decision:'insufficient_evidence',payment_required:false });
    expect(f.f.facilitator.settle).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('rejects an assessment for a different request before asking the wallet to authorize',async()=>{
  const f=await dxFixture();
  try {
    const fetch=async(...args: Parameters<typeof f.fetch>)=>{ const response=await f.fetch(...args); if(response.status!==402)return response; const body=await response.json(); body.judgment_id='judgment_'+'f'.repeat(64); return new Response(JSON.stringify(body),{ status:402,headers:response.headers }); };
    await expect(f.client({ fetch }).judge(dxInput)).rejects.toMatchObject({ state:'RECEIPT_VERIFICATION_FAILED',code:'assessment_request_binding_mismatch' });
    expect(f.payment.authorize).not.toHaveBeenCalled(); expect(f.f.facilitator.settle).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('recovers an independently confirmed ambiguous payment without inventing facilitator settlement attestation',async()=>{
  const f=await dxFixture();
  try {
    vi.mocked(f.f.facilitator.settle).mockRejectedValue(new Error('settlement response lost'));
    const client=f.client(); await expect(client.judge(dxInput,{ idempotencyKey:'rpc-recover' })).rejects.toMatchObject({ state:'PAYMENT_PENDING_RECONCILIATION' });
    const { reconciliationFixture }=await import('./helpers/judgmentReconciliation');
    const { createJudgmentReconciliationService }=await import('../src/services/judgmentReconciliationService');
    const chain=await reconciliationFixture();
    vi.mocked(chain.rpc.getBlock).mockResolvedValue({ hash:('0x'+'b'.repeat(64)) as `0x${string}`,number:1n,timestamp:BigInt(Math.ceil(Date.now()/1000)+1) });
    const record=(await f.journal.get(judgmentRequestKey(dxOwner.agent_id,'rpc-recover',dxOwner)))!;
    await createJudgmentReconciliationService(f.journal,{ 'eip155:8453':chain.rpc }).reconcile(record.response.judgment_id,{ transaction_hash:chain.hash });
    const recovered=await client.resume('rpc-recover');
    expect(recovered.state).toBe('RECEIPT_VERIFIED'); expect(recovered.receipt?.payment).toBeUndefined();
    expect(recovered.paymentConfirmation).toMatchObject({ version:'judgment-payment-confirmation.v1',authoritative:false,provenance:'rpc_finalized_eip3009_transfer' });
    expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1); expect(f.f.facilitator.verify).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});

it('hides x402 proof construction behind an explicitly approved standard EVM signer',async()=>{
  const f=await dxFixture();
  try {
    const { createX402WalletPayment }=await import('../src/sdk');
    const signTypedData=vi.fn(async()=>('0x'+'a'.repeat(130)) as `0x${string}`);
    const approve=vi.fn(async()=>true);
    const payment=createX402WalletPayment({ signer:{ address:('0x'+'1'.repeat(40)) as `0x${string}`,signTypedData },policy:f.payment.policy,approve });
    expect((await f.client({ payment }).judge(dxInput)).state).toBe('RECEIPT_VERIFIED');
    expect(approve).toHaveBeenCalledTimes(1); expect(signTypedData).toHaveBeenCalledTimes(1); expect(f.f.facilitator.settle).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});

it('does not ask the standard signer to sign a declined fee',async()=>{
  const f=await dxFixture();
  try {
    const { createX402WalletPayment }=await import('../src/sdk'); const signTypedData=vi.fn(async()=>('0x'+'a'.repeat(130)) as `0x${string}`);
    const payment=createX402WalletPayment({ signer:{ address:('0x'+'1'.repeat(40)) as `0x${string}`,signTypedData },policy:f.payment.policy,approve:async()=>false });
    await expect(f.client({ payment }).judge(dxInput)).rejects.toMatchObject({ state:'PAYMENT_DECLINED' }); expect(signTypedData).not.toHaveBeenCalled(); expect(f.f.facilitator.settle).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
