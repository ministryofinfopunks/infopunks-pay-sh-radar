import { ECONOMIC_RAILS, type EconomicNetwork } from '../security/economicRails';
import { HTTPFacilitatorClient, x402ResourceServer, type FacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from '@x402/core/http';
import type { PaymentRequired, PaymentRequirements, SettleResponse } from '@x402/core/types';
export type JudgmentPaymentGateway = {
  asset?: 'USDC' | 'USDG';
  requirements: PaymentRequirements[];
  challenge(): Promise<PaymentRequired>;
  verify(signature: string, requirements: PaymentRequirements): Promise<boolean>;
  settle(signature: string, requirements: PaymentRequirements): Promise<SettleResponse>;
};
export { encodePaymentRequiredHeader, encodePaymentResponseHeader };
/** Official x402 exact EVM schemes; Robinhood USDG requires validated token metadata. */
export async function createX402JudgmentGateway(input: {
  facilitatorUrl: string; payTo: string; amount: string; resourceUrl: string;
  facilitator?: FacilitatorClient;
  network?: EconomicNetwork; usdGDomain?: { name: string; version: string };
}): Promise<JudgmentPaymentGateway> {
  const { parseUnits } = await import('viem');
  const network = input.network ?? 'eip155:8453';
  const rail = ECONOMIC_RAILS[network];
  if (!rail) throw new Error('unsupported_judgment_network');
  if (network === 'eip155:4663' && (!input.usdGDomain || input.usdGDomain.name !== 'Global Dollar' || input.usdGDomain.version !== '1')) throw new Error('verified_usdg_domain_required');
  const scheme = new ExactEvmScheme();
  if (network === 'eip155:4663') scheme.registerMoneyParser(async amount => ({ amount: parseUnits(String(amount), 6).toString(), asset: rail.token, extra: { name: input.usdGDomain!.name, version: input.usdGDomain!.version, assetTransferMethod: 'eip3009' } }));
  const server = new x402ResourceServer(input.facilitator ?? new HTTPFacilitatorClient({ url: input.facilitatorUrl }))
    .register(network, scheme);
  await server.initialize();
  if (!server.getSupportedKind(2, network, 'exact')) throw new Error(network === 'eip155:8453' ? 'x402_base_not_supported_by_facilitator' : 'x402_rh_not_supported_by_facilitator');
  const requirements = await server.buildPaymentRequirements({
    scheme: 'exact', network, payTo: input.payTo,
    price: input.amount, maxTimeoutSeconds: 120
  });
  if (!requirements.length || requirements.some(r => r.asset.toLowerCase() !== rail.token || r.network !== network || r.amount !== parseUnits(input.amount, 6).toString())) throw new Error('x402_canonical_asset_required');
  return {
    asset: rail.asset, requirements,
    challenge: () => server.createPaymentRequiredResponse(requirements, { url: input.resourceUrl, description: 'Canonical pre-spend judgment', mimeType: 'application/json' }),
    verify: async (signature, required) => (await server.verifyPayment(decodePaymentSignatureHeader(signature), required)).isValid,
    settle: (signature, required) => server.settlePayment(decodePaymentSignatureHeader(signature), required)
  };
}
