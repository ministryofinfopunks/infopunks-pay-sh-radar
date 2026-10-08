import type { ReceiptAppendStore } from './receiptAuthorityService';
import { assertReceiptAuthority } from './receiptAuthorityService';
import type { JudgmentReceipt, ExecutionReceipt, EvaluationReceipt } from '../schemas/receipts';
import { hashCanonical } from './receiptIntegrityService';
/** Measurements of observed evaluated executions, never counterfactual claims about blocked actions. */
export function createReceiptAttributionService(store: ReceiptAppendStore) {
  return { async report() {
    const [judgments, executions, evaluations] = await Promise.all([store.list('judgment'), store.list('execution'), store.list('evaluation')]);
    for (const [kind, records] of [['judgment', judgments], ['execution', executions], ['evaluation', evaluations]] as const)
      for (const receipt of records) await assertReceiptAuthority(kind, receipt, store);
    const groups = new Map<string, { policy_version: string; issued: number; executions: number; evaluated: number; confirmed: number; weakened: number; contradicted: number; explicit_false_allow_labels: number }>();
    const periods = new Map<string, { policy_version: string; utc_day: string; evaluated: number; confirmed: number; weakened: number; contradicted: number }>();
    const rows = judgments.map(raw => {
      const j = raw as JudgmentReceipt;
      const linked = executions.filter(raw => (raw as ExecutionReceipt).judgment_id === j.judgment_id) as ExecutionReceipt[];
      const evals = evaluations.filter(raw => linked.some(x => x.execution_id === (raw as EvaluationReceipt).execution_id)) as EvaluationReceipt[];
      const g = groups.get(j.policy_version) ?? { policy_version: j.policy_version, issued: 0, executions: 0, evaluated: 0, confirmed: 0, weakened: 0, contradicted: 0, explicit_false_allow_labels: 0 };
      g.issued++; g.executions += linked.length; g.evaluated += evals.length;
      for (const e of evals) {
        g[e.outcome]++; if (e.outcome_labels?.includes('false_allow')) g.explicit_false_allow_labels++;
        const day = new Date(e.evaluated_at).toISOString().slice(0,10); const key = j.policy_version + ':' + day;
        const period = periods.get(key) ?? { policy_version: j.policy_version, utc_day: day, evaluated: 0, confirmed: 0, weakened: 0, contradicted: 0 };
        period.evaluated++; period[e.outcome]++; periods.set(key, period);
      }
      groups.set(j.policy_version, g);
      return { judgment_id: j.judgment_id, judgment_hash: j.receipt_hash, policy_version: j.policy_version,
        observation_ids: j.cited_observation_ids, decision: j.decision, issued_at: j.issued_at,
        execution_ids: linked.map(x => x.execution_id), evaluation_ids: evals.map(e => e.evaluation_id), outcomes: evals.map(e => e.outcome), evaluations: evals.map(e => ({ evaluation_id: e.evaluation_id, evaluated_at: e.evaluated_at, outcome: e.outcome, labels: e.outcome_labels ?? [] })),
        coverage: !linked.length ? 'no_execution_observed' : evals.length < linked.length ? 'execution_awaiting_evaluation' : 'evaluated' };
    }).sort((a,b) => a.judgment_id.localeCompare(b.judgment_id));
    const report = { version: 'receipt-attribution.v1', judgments: rows, policy_metrics: [...groups.values()].sort((a,b) => a.policy_version.localeCompare(b.policy_version)),
      outcome_timeline: [...periods.values()].sort((a,b) => a.utc_day.localeCompare(b.utc_day) || a.policy_version.localeCompare(b.policy_version)),
      false_block_rate: null, false_block_measurement: 'requires_independently_reviewed_counterfactual_evidence',
      drift_measurement: 'descriptive_policy_outcomes_no_causal_or_counterfactual_inference' };
    return { ...report, report_hash: hashCanonical(report) };
  } };
}
