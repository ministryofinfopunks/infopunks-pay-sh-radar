import type { ExecuteProofRequest, BaseExecutionProfile } from '../schemas/executeProof';
import type { JudgmentReceipt } from '../schemas/receipts';

export const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
type Hex = `0x${string}`;
export type SettlementProofVerification = {
  verified: true; provenance: 'base_rpc_finalized_usdc_transfer'; network: 'eip155:8453';
  transaction_hash: string; block_hash: string; block_number: string; signer: string;
};
export interface SettlementProofVerifier {
  verify(proof: ExecuteProofRequest, parent: JudgmentReceipt, profile: BaseExecutionProfile): Promise<SettlementProofVerification>;
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
export function createBaseSettlementProofVerifier(client: BaseProofRpc): SettlementProofVerifier {
  return {
    async verify(proof, parent, profile) {
      const { parseAbi, parseEventLogs, parseUnits } = await import('viem');
      const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
      if (await client.getChainId() !== 8453) throw new Error('settlement_network_mismatch');
      const transaction = await client.getTransactionReceipt({ hash: proof.settlement.transaction_hash as Hex });
      if (transaction.status !== 'success' || transaction.transactionHash.toLowerCase() !== proof.settlement.transaction_hash.toLowerCase()) throw new Error('settlement_transaction_failed');
      const [block, finalized] = await Promise.all([
        client.getBlock({ blockNumber: transaction.blockNumber }), client.getBlock({ blockTag: 'finalized' })
      ]);
      if (block.hash !== transaction.blockHash || finalized.number === null || transaction.blockNumber > finalized.number) throw new Error('settlement_not_finalized');
      const settledAt = Number(block.timestamp) * 1000;
      if (settledAt < Date.parse(parent.issued_at) || settledAt > Date.parse(parent.valid_until) || settledAt > Date.parse(proof.executed_at)) throw new Error('settlement_outside_authorization_window');
      const transfers = parseEventLogs({ abi: transferAbi, logs: transaction.logs.filter(log => !log.removed && log.address.toLowerCase() === BASE_USDC && log.blockHash === transaction.blockHash && log.transactionHash?.toLowerCase() === transaction.transactionHash.toLowerCase()) });
      const total = transfers.filter(event => event.args.from.toLowerCase() === profile.signer.toLowerCase() && event.args.to.toLowerCase() === profile.pay_to.toLowerCase()).reduce((sum, event) => sum + event.args.value, 0n);
      if (total === 0n || total !== parseUnits(proof.cost.amount, 6)) throw new Error('settlement_transfer_mismatch');
      // The judgment purchase fee cannot stand in for the external execution purchase.
      if (parent.payment_receipt_ref?.toLowerCase() === transaction.transactionHash.toLowerCase()) throw new Error('judgment_fee_is_not_execution_settlement');
      return { verified: true, provenance: 'base_rpc_finalized_usdc_transfer', network: 'eip155:8453', transaction_hash: transaction.transactionHash.toLowerCase(),
        block_hash: transaction.blockHash, block_number: transaction.blockNumber.toString(), signer: profile.signer.toLowerCase() };
    }
  };
}
export async function baseProofClient(rpcUrl: string) {
  const [{ createPublicClient, http }, { base }] = await Promise.all([import('viem'), import('viem/chains')]);
  return createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 5000, retryCount: 0 }) });
}
