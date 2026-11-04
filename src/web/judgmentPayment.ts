import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { ECONOMIC_RAILS } from '../security/economicRails';
import type { CanonicalJudgmentResponse } from '../schemas/preSpend';

type Eip1193Provider = {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export type JudgmentPaymentQuote = {
  challenge: PaymentRequired;
  judgment: CanonicalJudgmentResponse;
  requirement: PaymentRequirements;
};

export function parseJudgmentPaymentQuote(
  paymentRequiredHeader: string | null,
  judgment: CanonicalJudgmentResponse,
  expectedResourceUrl: string
): JudgmentPaymentQuote {
  if (!paymentRequiredHeader || !judgment.payment_required || judgment.receipt ||
    judgment.decision === 'insufficient_evidence' || !judgment.cited_observations.length) {
    throw new Error('payment_challenge_unavailable');
  }
  let challenge: PaymentRequired;
  try { challenge = decodePaymentRequiredHeader(paymentRequiredHeader); }
  catch { throw new Error('payment_challenge_invalid'); }
  if (challenge.x402Version !== 2 || challenge.accepts.length !== 1 || challenge.resource.url !== expectedResourceUrl) {
    throw new Error('payment_challenge_not_supported');
  }
  const requirement = challenge.accepts[0];
  if (requirement.scheme !== 'exact' || requirement.network !== 'eip155:4663' ||
    !/^0x[a-fA-F0-9]{40}$/.test(requirement.payTo) || !/^[1-9][0-9]*$/.test(requirement.amount) ||
    !Number.isInteger(requirement.maxTimeoutSeconds) || requirement.maxTimeoutSeconds < 1 ||
    requirement.maxTimeoutSeconds > 600) {
    throw new Error('payment_challenge_not_supported');
  }
  const rail = ECONOMIC_RAILS[requirement.network as keyof typeof ECONOMIC_RAILS];
  if (!rail || requirement.asset.toLowerCase() !== rail.token || judgment.cost.asset !== rail.asset ||
    decimalToAtomic(judgment.cost.amount) !== requirement.amount ||
    requirement.extra?.name !== 'Global Dollar' || requirement.extra?.version !== '1' ||
    requirement.extra?.assetTransferMethod !== 'eip3009') {
    throw new Error('payment_challenge_mismatch');
  }
  return { challenge, judgment, requirement };
}

function decimalToAtomic(value: string) {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) return '';
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'))).toString();
}

export async function createBrowserPaymentSignature(quote: JudgmentPaymentQuote) {
  const provider = window.ethereum;
  if (!provider) throw new Error('wallet_unavailable');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!Array.isArray(accounts) || typeof accounts[0] !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(accounts[0])) {
    throw new Error('wallet_account_unavailable');
  }
  const account = accounts[0] as `0x${string}`;
  const chain = await provider.request({ method: 'eth_chainId' });
  const expectedChain = '0x' + Number(quote.requirement.network.split(':')[1]).toString(16);
  if (typeof chain !== 'string' || chain.toLowerCase() !== expectedChain.toLowerCase()) {
    throw new Error('wallet_network_mismatch');
  }

  const signer = {
    address: account,
    signTypedData: async (typedData: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }) => {
      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [account, JSON.stringify(typedData, (_key, value) => typeof value === 'bigint' ? value.toString() : value)]
      });
      if (typeof signature !== 'string' || !/^0x[a-fA-F0-9]{130}$/.test(signature)) throw new Error('wallet_signature_invalid');
      return signature as `0x${string}`;
    }
  };
  const payload = await new ExactEvmScheme(signer).createPaymentPayload(2, quote.requirement);
  return encodePaymentSignatureHeader({
    x402Version: 2,
    accepted: quote.requirement,
    payload: payload.payload,
    resource: quote.challenge.resource
  });
}

export function decodePaymentResponseHeader(value: string | null) {
  if (!value) throw new Error('payment_response_missing');
  try {
    const decoded = JSON.parse(atob(value)) as { success?: unknown; transaction?: unknown; network?: unknown };
    if (decoded.success !== true || typeof decoded.transaction !== 'string' || typeof decoded.network !== 'string') {
      throw new Error('payment_response_invalid');
    }
    return decoded as { success: true; transaction: string; network: string };
  } catch {
    throw new Error('payment_response_invalid');
  }
}
