import { describe, expect, it } from 'vitest';
import { canonicalSerialize, computeReceiptHash, hashCanonical, sealReceipt, verifyReceiptIntegrity } from '../src/services/receiptIntegrityService';
import { verifyReceiptChain } from '../src/services/receiptAuthorityService';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { appendChain } from './helpers/canonicalReceipts';

describe('canonical receipt integrity', () => {
  it('recursively canonicalizes object keys while preserving array order', () => {
    expect(hashCanonical({ b: { z: 1, a: 2 }, a: [1, 2] })).toBe(hashCanonical({ a: [1, 2], b: { a: 2, z: 1 } }));
    expect(hashCanonical([1, 2])).not.toBe(hashCanonical([2, 1]));
    expect(canonicalSerialize({ z: 0, a: '雪' })).toBe('{"a":"雪","z":0}');
  });
  it.each([undefined, NaN, Infinity, new Date(), [, 1]])('rejects non-JSON values: %s', (value) => {
    expect(() => canonicalSerialize(value)).toThrow('non_canonical_json');
  });
  it('rejects cycles', () => {
    const value: Record<string, unknown> = {}; value.self = value;
    expect(() => canonicalSerialize(value)).toThrow('non_canonical_json');
  });
  it('commits payload, schema, policy, and all parent hashes', async () => {
    const { observation, judgment } = await appendChain(new MemoryCanonicalReceiptStore());
    expect(verifyReceiptIntegrity('observation', observation)).toBe(true);
    for (const change of [{ payload: { price: '9' } }, { provenance: { changed: true } }, { schema_version: 'other' }]) {
      expect(computeReceiptHash('observation', { ...observation, ...change })).not.toBe(observation.receipt_hash);
    }
    for (const change of [{ reasons: ['different'] }, { policy_version: 'other' }, { parent_hashes: [hashCanonical('fake')] }]) {
      expect(computeReceiptHash('judgment', { ...judgment, ...change })).not.toBe(judgment.receipt_hash);
    }
    expect(verifyReceiptIntegrity('observation', sealReceipt('observation', { ...observation, payload: { changed: true } }))).toBe(false);
  });
  it('rejects parent-hash tampering even if the child is resealed', async () => {
    const store = new MemoryCanonicalReceiptStore();
    const { execution, evaluation } = await appendChain(store);
    expect(await verifyReceiptChain('execution', sealReceipt('execution', { ...execution, parent_hash: hashCanonical('forged') }), store)).toBe(false);
    expect(await verifyReceiptChain('evaluation', sealReceipt('evaluation', { ...evaluation, parent_hash: hashCanonical('forged') }), store)).toBe(false);
  });
  it('replays every level of a stored chain', async () => {
    const store = new MemoryCanonicalReceiptStore();
    const chain = await appendChain(store);
    for (const kind of ['observation', 'judgment', 'execution', 'evaluation'] as const) {
      expect(await verifyReceiptChain(kind, chain[kind], store)).toBe(true);
    }
    expect(await chain.authority.replayEvaluation('e1')).toBe(true);
    expect(await chain.authority.replayEvaluation('missing')).toBe(false);
  });
});
