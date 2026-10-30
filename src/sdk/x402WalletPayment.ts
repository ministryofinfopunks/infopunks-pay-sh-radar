import type { ClientEvmSigner } from '@x402/evm';
import type { JudgmentPaymentAdapter } from './judgmentClient';
import { ECONOMIC_RAILS } from '../security/economicRails';

/** Signs EIP-3009 with the official x402 client after caller approval. No token approvals or transaction writes. */
export function createX402WalletPayment(options: {
  signer: ClientEvmSigner;
  policy: JudgmentPaymentAdapter['policy'];
  approve: (context: Parameters<JudgmentPaymentAdapter['authorize']>[0]) => Promise<boolean>;
}): JudgmentPaymentAdapter {
  const policy = structuredClone(options.policy);
  return { policy, async authorize(context) {
    const requirement = context.challenge.accepts[0];
    if (!requirement || context.challenge.accepts.length !== 1 || requirement.network !== policy.network ||
      requirement.asset.toLowerCase() !== ECONOMIC_RAILS[policy.network].token || requirement.payTo.toLowerCase() !== policy.payTo.toLowerCase() ||
      !/^[1-9][0-9]*$/.test(policy.maxAmountAtomic) || BigInt(requirement.amount) > BigInt(policy.maxAmountAtomic) ||
      (requirement.extra?.assetTransferMethod !== undefined && requirement.extra.assetTransferMethod !== 'eip3009') || context.signal?.aborted) return null;
    if (!await options.approve({ ...context, challenge: structuredClone(context.challenge), judgment: structuredClone(context.judgment) }) || context.signal?.aborted) return null;
    const [{ ExactEvmScheme }, { encodePaymentSignatureHeader }] = await Promise.all([import('@x402/evm/exact/client'), import('@x402/core/http')]);
    const signed = await new ExactEvmScheme(options.signer).createPaymentPayload(2, requirement);
    if (context.signal?.aborted) return null;
    return encodePaymentSignatureHeader({ x402Version: 2, accepted: requirement, payload: signed.payload, resource: context.challenge.resource });
  } };
}
