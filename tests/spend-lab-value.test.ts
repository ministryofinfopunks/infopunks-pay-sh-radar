import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  preflight,
  localPreflightSnapshot,
  preflightPolicy,
} from '../tools/spend-lab/successor/preflight';
import { tasks } from '../tools/spend-lab/successor/profiles';
import { runTwoStageExperiment } from '../tools/spend-lab/successor/two-stage';
import { hashCanonical } from '../src/services/receiptIntegrityService';

describe('two-stage local economic hypothesis', () => {
  const at = new Date('2026-10-18T00:00:00.000Z');
  it('retains required full judgment for a cheap qualified call without granting execution', () => {
    const task = tasks.find((t) => t.id === 'currency-minor')!;
    const result = preflight(task, localPreflightSnapshot(task, at), at);
    expect(result.route).toBe('full_judgment_required');
    expect(result.execution_authorized).toBe(false);
    expect(result.incremental_assessment_value_units).toBeNull();
    expect(preflightPolicy.required_judgment_may_be_bypassed).toBe(false);
  });
  it('stops an explicit hard veto before the paid stage', () => {
    const task = tasks.find((t) => t.id === 'csv-quoted')!;
    expect(preflight(task, localPreflightSnapshot(task, at), at)).toMatchObject({
      route: 'no_spend',
      decision: 'do_not_spend',
      execution_authorized: false,
      reasons: ['preflight_hard_veto'],
    });
  });
  it('does not convert insufficient evidence into paid permission', () => {
    const task = tasks.find((t) => t.id === 'dedup-addresses')!;
    expect(preflight(task, localPreflightSnapshot(task, at), at)).toMatchObject({
      route: 'no_spend',
      decision: 'insufficient_evidence',
      execution_authorized: false,
    });
  });
  it.each([
    'unknown-provider',
    'expired',
    'future',
    'cost-tamper',
    'evidence-tamper',
    'real-provenance',
    'profile-tamper',
  ])('fails closed on %s', (mode) => {
    const task = tasks[0],
      snapshot: any = localPreflightSnapshot(task, at);
    if (mode === 'unknown-provider') snapshot.known_provider = false;
    if (mode === 'expired') snapshot.fresh_until = at.toISOString();
    if (mode === 'future') snapshot.observed_at = new Date(at.getTime() + 1).toISOString();
    if (mode === 'cost-tamper') snapshot.price_units++;
    if (mode === 'evidence-tamper') snapshot.hard_veto = true;
    if (mode === 'real-provenance') snapshot.simulation = false;
    if (mode === 'profile-tamper') snapshot.profile = 'real-provider';
    expect(preflight(task, snapshot, at)).toMatchObject({
      route: 'no_spend',
      execution_authorized: false,
    });
  });
  it('rejects a forged registry entry even with matching caller-authored flags', () => {
    const task = { ...tasks[0], id: 'unregistered' },
      snapshot = localPreflightSnapshot(task, at);
    snapshot.known_provider = true;
    expect(preflight(task, snapshot, at).route).toBe('no_spend');
  });
  it('preregisters routing, measures per-task/risk net value and preserves negative evidence', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'spender-value-'));
    try {
      const output = join(directory, 'experiment'),
        summary = await runTwoStageExperiment(output);
      expect(summary.status).toBe('HOLD');
      expect(summary.economic_usefulness).toBe('NOT_ESTABLISHED');
      expect(summary.fixed_fee.fee_only_net_judgment_value_units).toBe(-33);
      expect(summary.two_stage.fee_only_net_judgment_value_units).toBe(-27);
      expect(summary.judgment_fee_savings_units).toBe(6);
      expect(summary.label_commitments_match).toBe(true);
      expect(summary.paired_baseline_outcomes_match).toBe(true);
      expect(summary.execution_decisions_match).toBe(true);
      expect(summary.decision_quality_improvement_established).toBe(false);
      expect(summary.fixed_fee.opportunity_lost_units).toBe(
        summary.two_stage.opportunity_lost_units,
      );
      expect(summary.fixed_fee.losses_prevented_units).toBe(
        summary.two_stage.losses_prevented_units,
      );
      expect(summary.fully_costed_improvement_units).toBeNull();
      expect(summary.incremental_full_assessment_value).toBeNull();
      expect(summary.phase).toBe('exploratory_previously_inspected_fixture_suite');
      const read = (name: string) => JSON.parse(readFileSync(join(output, name), 'utf8'));
      const registration = read('registration.json');
      expect(hashCanonical(registration)).toBe(summary.registration_hash);
      expect(registration.approved_cheap_call_execution_bypass).toBe(false);
      const value = read('two-stage-net-value.json'),
        metrics = read('two-stage/comparison-metrics.json');
      expect(value.rows).toHaveLength(20);
      expect(Object.keys(value.by_risk_category)).toHaveLength(3);
      expect(
        value.rows.reduce(
          (sum: number, row: any) => sum + row.fee_only_net_judgment_value_units,
          0,
        ),
      ).toBe(-27);
      expect(
        Object.values(value.by_risk_category).reduce(
          (sum: number, risk: any) => sum + risk.fee_only_net_judgment_value_units,
          0,
        ),
      ).toBe(-27);
      expect(value.incomplete_cost_categories).toContain('preflight_compute');
      expect(value.overall.fully_costed_net_judgment_value_units).toBeNull();
      expect(metrics.simulated_judgment_payments).toBe(11);
      for (const row of metrics.rows) {
        expect(row.preflight.execution_authorized).toBe(false);
        if (row.preflight.route === 'no_spend') {
          expect(row.radar_spend).toBe(false);
          expect(row.judgment_id).toBeNull();
          expect(row.judgment_fee_units).toBe(0);
        } else if (row.radar_spend) {
          expect(row.judgment_hash).toMatch(/^sha256:/);
          expect(row.decision_authority).toBe('canonical_judgment');
        }
      }
      expect(value.overall.outcome_variation_residual_units).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60000);
});
