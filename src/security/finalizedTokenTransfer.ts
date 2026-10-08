import { ECONOMIC_RAILS, type EconomicNetwork } from './economicRails';
import type { BaseProofRpc } from './settlementProofVerifier';
export async function verifyFinalizedTokenTransfer(client: BaseProofRpc, input: {
  network: EconomicNetwork; transaction: string; payer: string; payTo: string; amountAtomic: string;
  notBefore?: string; before?: string;
}) {
  const { parseAbi, parseEventLogs } = await import('viem');
  const transferAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
  const rail = ECONOMIC_RAILS[input.network];
  if (await client.getChainId() !== rail.chainId) throw new Error('settlement_network_mismatch');
  const receipt = await client.getTransactionReceipt({ hash: input.transaction as `0x${string}` });
  if (receipt.status !== 'success' || receipt.transactionHash.toLowerCase() !== input.transaction.toLowerCase()) throw new Error('settlement_transaction_failed');
  const [block, finalized] = await Promise.all([client.getBlock({ blockNumber: receipt.blockNumber }), client.getBlock({ blockTag: 'finalized' })]);
  if (!block.hash || block.hash.toLowerCase() !== receipt.blockHash.toLowerCase() || finalized.number === null || receipt.blockNumber > finalized.number) throw new Error('settlement_not_finalized');
  const timestamp = Number(block.timestamp) * 1000;
  if ((input.notBefore && timestamp < Date.parse(input.notBefore)) || (input.before && timestamp >= Date.parse(input.before))) throw new Error('settlement_outside_authorization_window');
  const logs = receipt.logs.filter(log => !log.removed && log.address.toLowerCase() === rail.token
    && log.blockHash?.toLowerCase() === receipt.blockHash.toLowerCase() && log.blockNumber === receipt.blockNumber
    && log.transactionHash?.toLowerCase() === receipt.transactionHash.toLowerCase());
  if (logs.some(log => log.logIndex === null) || new Set(logs.map(log => log.logIndex)).size !== logs.length) throw new Error('settlement_logs_ambiguous');
  const transfers = parseEventLogs({ abi: transferAbi, logs });
  const amount = transfers.filter(event => event.args.from.toLowerCase() === input.payer.toLowerCase() && event.args.to.toLowerCase() === input.payTo.toLowerCase()).reduce((sum, event) => sum + event.args.value, 0n);
  if (amount <= 0n || amount !== BigInt(input.amountAtomic)) throw new Error('settlement_transfer_mismatch');
  return { transaction_hash: receipt.transactionHash.toLowerCase(), block_hash: receipt.blockHash, block_number: receipt.blockNumber.toString(), settled_at: new Date(timestamp).toISOString() };
}
