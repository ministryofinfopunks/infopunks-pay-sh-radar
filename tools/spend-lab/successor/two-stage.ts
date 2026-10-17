import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashCanonical } from '../../../src/services/receiptIntegrityService';
import { runBenchmark } from './benchmark';
import { netJudgmentValue } from './net-judgment-value';
import { preflight, localPreflightSnapshot, preflightPolicy, riskCategory } from './preflight';
import { tasks } from './profiles';
const save = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
export async function runTwoStageExperiment(directory: string) {
  if (existsSync(directory)) throw new Error('fresh_output_directory_required');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Register task strata, inputs and routing before either arm requests judgment or reveals labels.
  const at = new Date(),
    snapshots = tasks.map((task) => ({
      task_id: task.id,
      risk_category: riskCategory(task),
      snapshot: localPreflightSnapshot(task, at),
    }));
  const registration = {
    version: 'spend-lab.two-stage-registration.v1',
    status: 'HOLD',
    phase: 'exploratory_previously_inspected_fixture_suite',
    policy: preflightPolicy,
    policy_hash: hashCanonical(preflightPolicy),
    input_snapshot_hash: hashCanonical(snapshots),
    snapshots,
    real_spending_authorized: false,
    minimum_judgment_fee_atomic: '10000',
    approved_cheap_call_execution_bypass: false,
    commercial_value: 'NOT_ESTABLISHED',
    incremental_full_assessment_value: 'NOT_MEASURED',
  };
  save(join(directory, 'registration.json'), registration);
  const control = await runBenchmark(join(directory, 'fixed-fee'));
  const byId = new Map(snapshots.map((s) => [s.task_id, s.snapshot]));
  const treatment = await runBenchmark(join(directory, 'two-stage'), {
    preflight: (task) => preflight(task, byId.get(task.id), new Date()),
  });
  const fixedValue = netJudgmentValue(control),
    twoStageValue = netJudgmentValue(treatment);
  save(join(directory, 'fixed-fee-net-value.json'), fixedValue);
  save(join(directory, 'two-stage-net-value.json'), twoStageValue);
  const feeSavings =
    fixedValue.overall.known_judgment_fee_units - twoStageValue.overall.known_judgment_fee_units;
  const summary = {
    version: 'spend-lab.two-stage-comparison.v1',
    status: 'HOLD',
    real_spending_authorized: false,
    registration_hash: hashCanonical(registration),
    economic_usefulness: 'NOT_ESTABLISHED',
    phase: registration.phase,
    label_commitments_match: control.label_commitment === treatment.label_commitment,
    paired_baseline_outcomes_match: control.rows.every(
      (row, i) => row.baseline_net_units === treatment.rows[i].baseline_net_units,
    ),
    execution_decisions_match: control.rows.every(
      (row, i) => row.radar_spend === treatment.rows[i].radar_spend,
    ),
    decision_quality_improvement_established: false,
    unique_tasks: tasks.length,
    repetitions_count_as_diversity: false,
    fixed_fee: fixedValue.overall,
    two_stage: twoStageValue.overall,
    judgment_fee_savings_units: feeSavings,
    fee_only_improvement_units:
      twoStageValue.overall.fee_only_net_judgment_value_units -
      fixedValue.overall.fee_only_net_judgment_value_units,
    maximum_extra_preflight_cost_per_request_before_fee_savings_exhausted_units:
      feeSavings / tasks.length,
    fully_costed_improvement_units: null,
    incremental_full_assessment_value: null,
    warning:
      'Fees and utilities are local assumptions; missing costs are not zero. No new independent commercial evidence or bypass approval.',
    risk_categories: twoStageValue.by_risk_category,
  };
  save(join(directory, 'two-stage-summary.json'), summary);
  return summary;
}
