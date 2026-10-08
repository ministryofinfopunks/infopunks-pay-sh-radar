import { expect, it } from 'vitest';
import { expectedAnchorCalldata, validateAnchorBinding, type AnchorExpectation } from '../src/services/rh4663AnchorIntegrity';
const expected: AnchorExpectation = { window_id: 'rh4663:2026-10-08', acceptance_root: `0x${'1'.repeat(64)}`, receipt_count: 3, commitment_timestamp: '2026-10-09T00:00:00Z' };
const address = `0x${'2'.repeat(40)}` as const;
const block = `0x${'3'.repeat(64)}` as const;
const valid = () => ({ chainId: 4663, contract: address, code: '0x6000' as const, to: address, receiptTo: address, calldata: expectedAnchorCalldata(expected), value: 0n, expected, canonicalBlockHash: block, receiptBlockHash: block });
it('binds an anchor to the exact chain, deployed destination, calldata and canonical block', () => {
  expect(validateAnchorBinding(valid())).toBeNull();
  expect(validateAnchorBinding({ ...valid(), chainId: 8453 })).toBe('anchor_chain_mismatch');
  expect(validateAnchorBinding({ ...valid(), code: '0x' })).toBe('anchor_contract_code_missing');
  expect(validateAnchorBinding({ ...valid(), receiptTo: null })).toBe('anchor_destination_mismatch');
  expect(validateAnchorBinding({ ...valid(), calldata: expectedAnchorCalldata({ ...expected, receipt_count: 4 }) })).toBe('anchor_commitment_mismatch');
  expect(validateAnchorBinding({ ...valid(), value: 1n })).toBe('anchor_commitment_mismatch');
  expect(validateAnchorBinding({ ...valid(), canonicalBlockHash: `0x${'4'.repeat(64)}` })).toBe('anchor_block_reorg');
});
