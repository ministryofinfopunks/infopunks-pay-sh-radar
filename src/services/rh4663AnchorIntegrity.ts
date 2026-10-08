import { createRequire } from 'node:module';
import { join } from 'node:path';
type Hex = `0x${string}`;
// viem supplies a CJS runtime entry; keep these existing synchronous helpers
// compatible with the server's Node16/CommonJS build.
const { encodeFunctionData, parseAbi } = createRequire(join(process.cwd(), 'package.json'))('viem') as typeof import('viem', { with: { 'resolution-mode': 'import' } });
import { createHash } from 'node:crypto';
export const pulseCommitAbi = parseAbi([
  'function commitPulseWindow(bytes32 windowHash, bytes32 acceptanceRoot, uint256 receiptCount, uint64 committedAt)',
  'function commitments(bytes32 windowHash) view returns (bytes32 root, uint256 count, uint64 committedAt)',
  'event PulseWindowCommitted(bytes32 indexed windowHash, bytes32 acceptanceRoot, uint256 receiptCount, uint64 committedAt)'
]);
export type AnchorExpectation = { window_id: string; acceptance_root: Hex; receipt_count: number; commitment_timestamp: string };
export function expectedAnchorCalldata(expected: AnchorExpectation): Hex {
  const windowHash = `0x${createHash('sha256').update(expected.window_id).digest('hex')}` as Hex;
  return encodeFunctionData({ abi: pulseCommitAbi, functionName: 'commitPulseWindow', args: [windowHash, expected.acceptance_root, BigInt(expected.receipt_count), BigInt(Math.floor(Date.parse(expected.commitment_timestamp) / 1000))] });
}
export function validateAnchorBinding(input: { chainId: number; contract: Hex; code: Hex | undefined; to: Hex | null; receiptTo: Hex | null; calldata: Hex; value: bigint; expected: AnchorExpectation; canonicalBlockHash: Hex; receiptBlockHash: Hex }): string | null {
  if (input.chainId !== 4663) return 'anchor_chain_mismatch';
  if (!input.code || input.code === '0x') return 'anchor_contract_code_missing';
  if (input.to?.toLowerCase() !== input.contract.toLowerCase() || input.receiptTo?.toLowerCase() !== input.contract.toLowerCase()) return 'anchor_destination_mismatch';
  if (input.value !== 0n || input.calldata.toLowerCase() !== expectedAnchorCalldata(input.expected).toLowerCase()) return 'anchor_commitment_mismatch';
  if (input.canonicalBlockHash.toLowerCase() !== input.receiptBlockHash.toLowerCase()) return 'anchor_block_reorg';
  return null;
}
