import { ECONOMIC_RAILS, type EconomicNetwork } from './economicRails';
import { verifyFinalizedTokenTransfer } from './finalizedTokenTransfer';
import type { ExecuteProofRequest, EvmExecutionProfile } from '../schemas/executeProof';
import type { JudgmentReceipt } from '../schemas/receipts';

export const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
type Hex = `0x${string}`;
export type SettlementProofVerification = {
  verified: true; provenance: 'base_rpc_finalized_usdc_transfer' | 'rh_rpc_finalized_usdg_transfer'; network: EconomicNetwork;
  transaction_hash: string; block_hash: string; block_number: string; signer: string;
};
export interface SettlementProofVerifier {
  verify(proof: ExecuteProofRequest, parent: JudgmentReceipt, profile: EvmExecutionProfile): Promise<SettlementProofVerification>;
}
export type BaseProofRpc = {
  getChainId(): Promise<number>;
  getTransactionReceipt(input: { hash: Hex }): Promise<{
    status: 'success' | 'reverted'; transactionHash: Hex; blockHash: Hex; blockNumber: bigint;
    logs: Array<{ address: Hex; data: Hex; topics: [] | [Hex, ...Hex[]]; removed: boolean;
      blockHash: Hex | null; blockNumber: bigint | null; transactionHash: Hex | null;
      transactionIndex: number | null; logIndex: number | null }>;
  }>;
  getBlock(input: { blockNumber: bigint } | { blockTag: 'finalized' }): Promise<{ hash: Hex | null; number: bigint | null; timestamp: bigint }>;
};
/** Read-only chain verification. No wallet, write client, purchase or settlement call. */
export function createEvmSettlementProofVerifier(client: BaseProofRpc, network: EconomicNetwork): SettlementProofVerifier {
  return { async verify(proof, parent, profile) {
    const { parseUnits } = await import('viem');
    const rail = ECONOMIC_RAILS[network];
    if (profile.profile !== rail.profile || proof.cost.asset !== rail.asset ||
      (network === 'eip155:4663' ? !['rh-usdg', 'x402-rh'].includes(proof.settlement.rail) : !['base-usdc', 'x402-base', 'pay.sh-base'].includes(proof.settlement.rail))) throw new Error('settlement_network_mismatch');
    const transfer = await verifyFinalizedTokenTransfer(client, { network, transaction: proof.settlement.transaction_hash,
      payer: profile.signer, payTo: profile.pay_to, amountAtomic: parseUnits(proof.cost.amount, 6).toString(), notBefore: parent.issued_at, before: parent.valid_until });
    if (Date.parse(transfer.settled_at) > Date.parse(proof.executed_at)) throw new Error('settlement_outside_authorization_window');
    if (parent.payment_receipt_ref?.toLowerCase() === transfer.transaction_hash) throw new Error('judgment_fee_is_not_execution_settlement');
    return { verified: true, provenance: rail.provenance, network, transaction_hash: transfer.transaction_hash,
      block_hash: transfer.block_hash, block_number: transfer.block_number, signer: profile.signer.toLowerCase() };
  } };
}
export const createBaseSettlementProofVerifier = (client: BaseProofRpc) => createEvmSettlementProofVerifier(client, 'eip155:8453');
export const createRhSettlementProofVerifier = (client: BaseProofRpc) => createEvmSettlementProofVerifier(client, 'eip155:4663');
export async function rhProofClient(rpcUrl: string) {
  const { createPublicClient, http, defineChain } = await import('viem');
  return createPublicClient({ chain: defineChain({ id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } }), transport: http(rpcUrl, { timeout: 5000, retryCount: 0 }) });
}
export async function verifyUsdGMetadata(rpcUrl: string) {
  const { parseAbi, hashDomain } = await import('viem');
  const client = await rhProofClient(rpcUrl);
  if (await client.getChainId() !== 4663) throw new Error('rh_usdg_rpc_network_mismatch');
  const address = ECONOMIC_RAILS['eip155:4663'].token;
  const abi = parseAbi(['function name() view returns (string)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function DOMAIN_SEPARATOR() view returns (bytes32)']);
  const [name, symbol, decimals, separator] = await Promise.all([
    client.readContract({ address, abi, functionName: 'name' }), client.readContract({ address, abi, functionName: 'symbol' }),
    client.readContract({ address, abi, functionName: 'decimals' }), client.readContract({ address, abi, functionName: 'DOMAIN_SEPARATOR' })
  ]);
  const version = '1';
  const expected = hashDomain({ domain: { name, version, chainId: 4663n, verifyingContract: address }, types: { EIP712Domain: [
    { name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }
  ] } });
  if (name !== 'Global Dollar' || symbol !== 'USDG' || decimals !== 6 || separator.toLowerCase() !== expected.toLowerCase()) throw new Error('rh_usdg_metadata_mismatch');
  return { name, version };
}
export async function baseProofClient(rpcUrl: string) {
  const [{ createPublicClient, http }, { base }] = await Promise.all([import('viem'), import('viem/chains')]);
  return createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 5000, retryCount: 0 }) });
}
