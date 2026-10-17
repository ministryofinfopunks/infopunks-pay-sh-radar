import { riskCategory } from './preflight';
import { tasks } from './profiles';
import type { runBenchmark } from './benchmark';
export type BenchmarkMetrics = Awaited<ReturnType<typeof runBenchmark>>;
export function netJudgmentValue(metrics: BenchmarkMetrics) {
  const rows = metrics.rows.map((row) => {
    const task = tasks.find((t) => t.id === row.task_id);
    if (!task) throw new Error('net_value_task_unknown');
    const noSpend = row.baseline_spend === true && row.radar_spend === false;
    const baselineNet = Number(row.baseline_net_units),
      cost = Number(row.judgment_fee_units);
    const lossesPrevented = noSpend ? Math.max(0, -baselineNet) : 0;
    const opportunityLost = noSpend ? Math.max(0, baselineNet) : 0;
    const feeOnly = lossesPrevented - opportunityLost - cost;
    const paired = Number(row.radar_net_units) - baselineNet;
    return {
      task_id: task.id,
      family: task.family,
      risk_category: riskCategory(task),
      losses_prevented_units: lossesPrevented,
      opportunity_lost_units: opportunityLost,
      known_judgment_fee_units: cost,
      fee_only_net_judgment_value_units: feeOnly,
      fully_costed_net_judgment_value_units: null,
      paired_net_difference_units: paired,
      outcome_variation_residual_units: paired - feeOnly,
      correct_abstention: row.radar_correct_abstention === true,
      false_block: row.false_block === true,
      preflight_latency_ms:
        (row.preflight as { elapsed_ms: number } | undefined)?.elapsed_ms ?? null,
      total_latency_ms: Number(row.radar_total_latency_ms),
    };
  });
  const summarize = (subset: typeof rows) => ({
    task_count: subset.length,
    losses_prevented_units: subset.reduce((s, r) => s + r.losses_prevented_units, 0),
    opportunity_lost_units: subset.reduce((s, r) => s + r.opportunity_lost_units, 0),
    known_judgment_fee_units: subset.reduce((s, r) => s + r.known_judgment_fee_units, 0),
    fee_only_net_judgment_value_units: subset.reduce(
      (s, r) => s + r.fee_only_net_judgment_value_units,
      0,
    ),
    fully_costed_net_judgment_value_units: null,
    outcome_variation_residual_units: subset.reduce(
      (s, r) => s + r.outcome_variation_residual_units,
      0,
    ),
    correct_abstentions: subset.filter((r) => r.correct_abstention).length,
    false_blocks: subset.filter((r) => r.false_block).length,
    total_latency_ms: subset.reduce((s, r) => s + r.total_latency_ms, 0),
  });
  return {
    version: 'spend-lab.net-judgment-value.v1',
    status: 'HOLD',
    unit: 'toy_utility_unit_not_currency',
    definition: 'Losses Prevented - Opportunity Lost - Judgment Cost',
    measurement_scope:
      'independent_local_task_oracle_authored_utility_assumptions_not_market_evidence',
    incomplete_cost_categories: [
      'preflight_compute',
      'inference',
      'verification',
      'reconciliation',
      'infrastructure',
      'latency_opportunity_cost',
    ],
    decision_hash: metrics.decisions_hash,
    label_commitment: metrics.label_commitment,
    overall: summarize(rows),
    by_risk_category: Object.fromEntries(
      [...new Set(rows.map((r) => r.risk_category))]
        .sort()
        .map((risk) => [risk, summarize(rows.filter((r) => r.risk_category === risk))]),
    ),
    rows,
  };
}
