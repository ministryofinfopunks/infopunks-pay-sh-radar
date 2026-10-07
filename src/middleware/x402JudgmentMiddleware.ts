import { HTTPFacilitatorClient, x402ResourceServer, type FacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from '@x402/core/http';
import type { PaymentRequired, PaymentRequirements, SettleResponse } from '@x402/core/types';
export type JudgmentPaymentGateway = {
  requirements: PaymentRequirements[];
  challenge(): Promise<PaymentRequired>;
  verify(signature: string, requirements: PaymentRequirements): Promise<boolean>;
  settle(signature: string, requirements: PaymentRequirements): Promise<SettleResponse>;
};
export { encodePaymentRequiredHeader, encodePaymentResponseHeader };
/** Only Base USDC is installed. Solana is deliberately unsupported. */
export async function createX402JudgmentGateway(input: {
  facilitatorUrl: string; payTo: string; amount: string; resourceUrl: string;
  facilitator?: FacilitatorClient;
}): Promise<JudgmentPaymentGateway> {
  const server = new x402ResourceServer(input.facilitator ?? new HTTPFacilitatorClient({ url: input.facilitatorUrl }))
    .register('eip155:8453', new ExactEvmScheme());
  await server.initialize();
  if (!server.getSupportedKind(2, 'eip155:8453', 'exact')) throw new Error('x402_base_not_supported_by_facilitator');
  const requirements = await server.buildPaymentRequirements({
    scheme: 'exact', network: 'eip155:8453', payTo: input.payTo,
    price: input.amount, maxTimeoutSeconds: 120
  });
  if (!requirements.length || requirements.some(r => r.asset.toLowerCase() !== '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')) throw new Error('x402_base_usdc_required');
  return {
    requirements,
    challenge: () => server.createPaymentRequiredResponse(requirements, { url: input.resourceUrl, description: 'Canonical pre-spend judgment', mimeType: 'application/json' }),
    verify: async (signature, required) => (await server.verifyPayment(decodePaymentSignatureHeader(signature), required)).isValid,
    settle: (signature, required) => server.settlePayment(decodePaymentSignatureHeader(signature), required)
  };
}
