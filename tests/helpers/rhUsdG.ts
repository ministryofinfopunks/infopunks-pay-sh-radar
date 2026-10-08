import { vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseAbi, type Hex } from 'viem';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { issuerFixture } from './judgmentIssuer';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { ECONOMIC_RAILS } from '../../src/security/economicRails';
import { createX402JudgmentGateway } from '../../src/middleware/x402JudgmentMiddleware';
import { createReceiptAuthorityService, type ReceiptAppendStore } from '../../src/services/receiptAuthorityService';
import { createJudgmentService } from '../../src/services/judgmentService';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { MemoryJudgmentRequestRepository, type JudgmentRequestRepository } from '../../src/repositories/judgmentRequestRepository';
import { setupJudgment, request, legacy } from './judgments';
import { executionProfile, account } from './executions';
import type { BaseProofRpc } from '../../src/security/settlementProofVerifier';
export const merchant = '0x' + '2'.repeat(40);
export const billingTx = ('0x' + 'a'.repeat(64)) as Hex;
export const executionTx = ('0x' + 'b'.repeat(64)) as Hex;
export async function setupRhUsdG(injected?: { store: ReceiptAppendStore; journal: JudgmentRequestRepository; issuer: ReturnType<typeof createJudgmentIssuer> }) {
  const issuer = injected?.issuer ?? createJudgmentIssuer(issuerFixture());
  const store = injected?.store ?? new MemoryCanonicalReceiptStore(80, issuer);
  const journal = injected?.journal ?? new MemoryJudgmentRequestRepository();
  const profile = { ...executionProfile, profile: 'rh_usdg_external.v1' as const };
  const f = await setupJudgment({ asset: 'USDG', execution: profile });
  await store.append('observation', f.observation);
  vi.mocked(f.facilitator.getSupported).mockResolvedValue({ kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:4663' }], extensions: [], signers: {} });
  vi.mocked(f.facilitator.settle).mockResolvedValue({ success: true, transaction: billingTx, network: 'eip155:4663', payer: account.address });
  const gateway = await createX402JudgmentGateway({ network: 'eip155:4663', usdGDomain: { name: 'Global Dollar', version: '1' }, facilitator: f.facilitator, facilitatorUrl: 'https://test.invalid', payTo: merchant, amount: '0.01', resourceUrl: 'https://radar.infopunks.fun/v1/pre-spend/check' });
  const service = createJudgmentService({ issuer, store, journal, gateway, legacyCheck: () => legacy, observations: async () => [f.observation], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date('2026-10-07T00:00:02Z') });
  const signature = encodePaymentSignatureHeader({ x402Version: 2, accepted: gateway.requirements[0], payload: { signature: 'test-only', authorization: { nonce: 'test-only' } } });
  const rpc: BaseProofRpc = {
    getChainId: vi.fn(async () => 4663), getBlock: vi.fn(async () => ({ hash: ('0x'+'c'.repeat(64)) as Hex, number: 100n, timestamp: BigInt(Date.parse('2026-10-07T00:00:03Z')/1000) })),
    getTransactionReceipt: vi.fn(async ({ hash }) => {
      const blockHash = ('0x'+'c'.repeat(64)) as Hex;
      return { status: 'success' as const, transactionHash: hash, blockHash, blockNumber: 90n, logs: [{ address: ECONOMIC_RAILS['eip155:4663'].token, data: encodeAbiParameters([{ type: 'uint256' }], [hash === billingTx ? 10000n : 100000n]),
        topics: encodeEventTopics({ abi: parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']), eventName: 'Transfer', args: { from: account.address, to: (hash === billingTx ? merchant : profile.pay_to) as Hex } }) as [Hex, ...Hex[]],
        blockHash, blockNumber: 90n, transactionHash: hash, transactionIndex: 0, logIndex: 0, removed: false }] };
    })
  };
  return { issuer, store, journal, profile, rpc, signature, service, gateway, authority: createReceiptAuthorityService(store, 80, issuer), facilitator: f.facilitator, request };
}
