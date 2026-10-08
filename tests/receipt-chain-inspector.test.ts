import { expect, it } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { appendChain } from './helpers/canonicalReceipts';
import { inspectReceiptChain } from '../src/services/receiptChainInspector';
import { sealReceipt } from '../src/services/receiptIntegrityService';

it('inspects verified ancestry and EvaluationReceipt-only projection', async () => {
  const store = new MemoryCanonicalReceiptStore(); const chain = await appendChain(store);
  const result = await inspectReceiptChain(store, chain.evaluation.evaluation_id);
  expect(result?.verified).toBe(true); expect(result?.nodes.map(n => n.kind)).toEqual(['observation', 'judgment', 'execution', 'evaluation']);
  expect(result?.projection?.contributing_evaluation_ids).toEqual([chain.evaluation.evaluation_id]);
});
it.each(['hash', 'parent', 'subject', 'missing'])('fails closed on persisted %s corruption and withholds projection', async mode => {
  const store = new MemoryCanonicalReceiptStore(); const chain = await appendChain(store);
  const reader = { ...store, append: store.append.bind(store), list: store.list.bind(store), get: async (kind: Parameters<typeof store.get>[0], id: string) => {
    const receipt = await store.get(kind, id);
    if (kind !== 'judgment' || !receipt) return receipt;
    if (mode === 'missing') return null;
    if (mode === 'hash') return { ...chain.judgment, receipt_hash: 'sha256:' + 'f'.repeat(64) };
    return sealReceipt('judgment', { ...chain.judgment, ...(mode === 'parent' ? { parent_hashes: ['sha256:' + 'f'.repeat(64)] } : { subject_id: 'different-provider' }) });
  } };
  const result = await inspectReceiptChain(reader, chain.evaluation.evaluation_id);
  expect(result?.verified).toBe(false); expect(result?.projection).toBeNull();
});
it('returns absence for an unknown evaluation', async () => {
  expect(await inspectReceiptChain(new MemoryCanonicalReceiptStore(), 'absent')).toBeNull();
});
