import type { EvaluationReceipt, ExecutionReceipt, JudgmentReceipt, ReceiptKind } from '../schemas/receipts';
import { verifyReceiptIntegrity } from './receiptIntegrityService';
import { verifyReceiptChain, type ReceiptAppendStore, type ReceiptRecord } from './receiptAuthorityService';
import { createDerivedScoreService } from './derivedScoreService';

/** Public, read-only inspection of persisted protocol history. */
export async function inspectReceiptChain(store: ReceiptAppendStore, id: string, threshold = 80) {
  const evaluation = await store.get('evaluation', id) as EvaluationReceipt | null;
  if (!evaluation) return null;
  const execution = await store.get('execution', evaluation.execution_id) as ExecutionReceipt | null;
  const judgment = execution ? await store.get('judgment', execution.judgment_id) as JudgmentReceipt | null : null;
  const records: { kind: ReceiptKind; id: string; receipt: ReceiptRecord | null }[] = [];
  for (const parent of judgment?.cited_observation_ids ?? []) records.push({ kind: 'observation', id: parent, receipt: await store.get('observation', parent) });
  records.push({ kind: 'judgment', id: execution?.judgment_id ?? 'missing', receipt: judgment },
    { kind: 'execution', id: evaluation.execution_id, receipt: execution }, { kind: 'evaluation', id, receipt: evaluation });
  const nodes = await Promise.all(records.map(async node => ({ ...node,
    hash_valid: Boolean(node.receipt && verifyReceiptIntegrity(node.kind, node.receipt)),
    ancestry_valid: Boolean(node.receipt && await verifyReceiptChain(node.kind, node.receipt, store, threshold)) })));
  const verified = nodes.every(node => node.hash_valid && node.ancestry_valid);
  const judgments = judgment ? (await store.list('judgment')).filter((r): r is JudgmentReceipt => 'decision' in r && r.subject_type === judgment.subject_type && r.subject_id === judgment.subject_id && r.intent_hash === judgment.intent_hash)
    .sort((a, b) => Date.parse(a.issued_at) - Date.parse(b.issued_at) || a.judgment_id.localeCompare(b.judgment_id)) : [];
  return { verified, nodes, evaluation_outcome: evaluation.outcome, evaluation_policy_version: evaluation.policy_version,
    projection: verified && judgment ? await createDerivedScoreService(store, threshold).project(judgment.subject_type, judgment.subject_id) : null,
    judgments: await Promise.all(judgments.map(async r => ({ judgment_id: r.judgment_id, decision: r.decision, confidence: r.confidence, reasons: r.reasons,
      issued_at: r.issued_at, cited_observation_ids: r.cited_observation_ids, verified: await verifyReceiptChain('judgment', r, store, threshold) }))) };
}
export type ReceiptChainInspection = NonNullable<Awaited<ReturnType<typeof inspectReceiptChain>>>;
