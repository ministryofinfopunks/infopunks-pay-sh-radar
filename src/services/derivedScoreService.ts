import type { EvaluationReceipt, ExecutionReceipt, JudgmentReceipt, ReceiptKind } from '../schemas/receipts';
import type { ScoreProjection } from '../schemas/scoreProjection';
import { assertReceiptAuthority, ReceiptAuthorityError, type ReceiptAppendStore, type ReceiptRecord } from './receiptAuthorityService';
import { hashCanonical } from './receiptIntegrityService';

export const SCORE_PROJECTION_VERSION = 'derived-score.v1';
/** Preserve the existing zero baseline and unbounded sum. Cache is local to a single reconstruction. */
export function createDerivedScoreService(store: ReceiptAppendStore, threshold = 80) {
  return {
    async project(subjectType: string, subjectId: string): Promise<ScoreProjection> {
      const records = store.evaluationHistory ? await store.evaluationHistory(subjectType, subjectId) : await store.list('evaluation');
      const cache = new Map<string, ReceiptRecord>();
      const ids = { observation: 'observation_id', judgment: 'judgment_id', execution: 'execution_id', evaluation: 'evaluation_id' } as const;
      for (const receipt of records) {
        const kind = 'evaluation_id' in receipt ? 'evaluation' : 'execution_id' in receipt ? 'execution' : 'judgment_id' in receipt ? 'judgment' : 'observation';
        cache.set(kind + ':' + String((receipt as unknown as Record<string, unknown>)[ids[kind]]), receipt);
      }
      const reader = { judgmentTrust: store.judgmentTrust, async get(kind: ReceiptKind, id: string) {
        const key = kind + ':' + id;
        if (cache.has(key)) return cache.get(key)!;
        const receipt = await store.get(kind, id);
        if (receipt) cache.set(key, receipt);
        return receipt;
      } };
      const evaluations = records.filter((r): r is EvaluationReceipt => 'evaluation_id' in r)
        .sort((a, b) => Date.parse(a.evaluated_at) - Date.parse(b.evaluated_at) || (a.evaluation_id < b.evaluation_id ? -1 : a.evaluation_id > b.evaluation_id ? 1 : 0));
      const contributing: EvaluationReceipt[] = [];
      const seen = new Set<string>();
      for (const evaluation of evaluations) {
        await assertReceiptAuthority('evaluation', evaluation, reader, threshold);
        const execution = await reader.get('execution', evaluation.execution_id) as ExecutionReceipt;
        const judgment = await reader.get('judgment', execution.judgment_id) as JudgmentReceipt;
        if (judgment.subject_type !== subjectType || judgment.subject_id !== subjectId) continue;
        if (seen.has(evaluation.execution_id)) throw new ReceiptAuthorityError('duplicate_execution_evaluation');
        seen.add(evaluation.execution_id); contributing.push(evaluation);
      }
      const projection = {
        subject_type: subjectType, subject_id: subjectId, score: contributing.reduce((sum, r) => sum + r.score_delta, 0),
        policy_version: SCORE_PROJECTION_VERSION, evaluation_count: contributing.length,
        outcome_counts: { confirmed: contributing.filter(r => r.outcome === 'confirmed').length, weakened: contributing.filter(r => r.outcome === 'weakened').length, contradicted: contributing.filter(r => r.outcome === 'contradicted').length },
        last_evaluated_at: contributing.length ? new Date(contributing.at(-1)!.evaluated_at).toISOString() : null,
        contributing_evaluation_ids: contributing.map(r => r.evaluation_id)
      };
      return { ...projection, projection_hash: hashCanonical({ projection_version: SCORE_PROJECTION_VERSION, projection,
        receipts: contributing.map(r => ({ evaluation_id: r.evaluation_id, receipt_hash: r.receipt_hash, policy_version: r.policy_version })) }) };
    }
  };
}
