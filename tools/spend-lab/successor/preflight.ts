import { z } from 'zod';
import { hashCanonical } from '../../../src/services/receiptIntegrityService';
import { tasks, type Task } from './profiles';

export const preflightPolicy = Object.freeze({
  version: 'spend-lab.two-stage.v1',
  domain: 'LOCAL_SIMULATION_ONLY',
  maximum_provider_cost_units: 50,
  evidence_confidence_threshold: 80,
  material_exposure_units: 10,
  integrity_sensitive_families: Object.freeze([
    'cryptography',
    'decimal',
    'relational',
    'validation',
  ]),
  approved_judgment_fee_atomic: '10000',
  required_judgment_may_be_bypassed: false,
  incremental_assessment_value_model: 'NOT_CALIBRATED',
});
export type RiskCategory = 'routine' | 'higher_exposure' | 'integrity_sensitive';
export function riskCategory(task: Task): RiskCategory {
  if (preflightPolicy.integrity_sensitive_families.includes(task.family))
    return 'integrity_sensitive';
  return task.price_units + task.fee_units >= preflightPolicy.material_exposure_units
    ? 'higher_exposure'
    : 'routine';
}
const Snapshot = z
  .object({
    source: z.literal('spend-lab/local-preflight-fixture'),
    simulation: z.literal(true),
    real_spending_authorized: z.literal(false),
    task_hash: z.string(),
    provider_id: z.string(),
    known_provider: z.boolean(),
    profile: z.literal('spend-lab/provider-v2'),
    observed_at: z.string().datetime(),
    fresh_until: z.string().datetime(),
    evidence_sufficient: z.boolean(),
    confidence: z.number().finite().min(0).max(100),
    hard_veto: z.boolean(),
    price_units: z.number().finite().nonnegative(),
    fee_units: z.number().finite().nonnegative(),
  })
  .strict();
export type PreflightSnapshot = z.infer<typeof Snapshot>;
export type PreflightResult = {
  route: 'no_spend' | 'full_judgment_required';
  decision: 'do_not_spend' | 'insufficient_evidence' | null;
  reasons: string[];
  execution_authorized: false;
  risk_category: RiskCategory;
  snapshot_hash: string | null;
  policy_hash: string;
  elapsed_ms: number;
  incremental_assessment_value_units: null;
};
/** This is an explicitly simulated registry/probe snapshot, not external provider assurance. */
export function localPreflightSnapshot(task: Task, at: Date): PreflightSnapshot {
  const fixed = tasks.find((t) => t.id === task.id);
  return {
    source: 'spend-lab/local-preflight-fixture',
    simulation: true,
    real_spending_authorized: false,
    task_hash: hashCanonical(task),
    provider_id: 'spend-lab/' + task.implementation,
    known_provider: !!fixed && hashCanonical(fixed) === hashCanonical(task),
    profile: 'spend-lab/provider-v2',
    observed_at: at.toISOString(),
    fresh_until: new Date(at.getTime() + 120000).toISOString(),
    evidence_sufficient: task.probe.sufficient,
    confidence: task.probe.confidence,
    hard_veto: task.probe.veto,
    price_units: task.price_units,
    fee_units: task.fee_units,
  };
}
/** Deterministic no-spend gate only. Qualification is never execution or fee authorization. */
export function preflight(task: Task, raw: unknown, at: Date): PreflightResult {
  const started = performance.now(),
    parsed = Snapshot.safeParse(raw);
  const result = (
    route: PreflightResult['route'],
    decision: PreflightResult['decision'],
    reasons: string[],
  ): PreflightResult => ({
    route,
    decision,
    reasons,
    execution_authorized: false,
    risk_category: riskCategory(task),
    snapshot_hash: parsed.success ? hashCanonical(parsed.data) : null,
    policy_hash: hashCanonical(preflightPolicy),
    elapsed_ms: performance.now() - started,
    incremental_assessment_value_units: null,
  });
  const insufficient = (reason: string) => result('no_spend', 'insufficient_evidence', [reason]);
  if (!parsed.success || !Number.isFinite(at.getTime()))
    return insufficient('preflight_snapshot_invalid');
  const snapshot = parsed.data,
    fixed = tasks.find((t) => t.id === task.id);
  if (!fixed || hashCanonical(fixed) !== hashCanonical(task))
    return insufficient('preflight_provider_or_task_unqualified');
  if (
    snapshot.evidence_sufficient !== fixed.probe.sufficient ||
    snapshot.confidence !== fixed.probe.confidence ||
    snapshot.hard_veto !== fixed.probe.veto
  )
    return insufficient('preflight_probe_binding_invalid');
  if (
    snapshot.task_hash !== hashCanonical(task) ||
    snapshot.provider_id !== 'spend-lab/' + task.implementation ||
    !snapshot.known_provider
  )
    return insufficient('preflight_provider_or_task_unqualified');
  if (
    Date.parse(snapshot.observed_at) > at.getTime() ||
    Date.parse(snapshot.fresh_until) <= at.getTime() ||
    Date.parse(snapshot.fresh_until) <= Date.parse(snapshot.observed_at)
  )
    return insufficient('preflight_evidence_not_fresh');
  if (
    snapshot.price_units !== task.price_units ||
    snapshot.fee_units !== task.fee_units ||
    snapshot.price_units + snapshot.fee_units > preflightPolicy.maximum_provider_cost_units
  )
    return result('no_spend', 'do_not_spend', ['preflight_constraint_veto']);
  if (
    !snapshot.evidence_sufficient ||
    snapshot.confidence < preflightPolicy.evidence_confidence_threshold
  )
    return insufficient('preflight_evidence_insufficient');
  if (snapshot.hard_veto) return result('no_spend', 'do_not_spend', ['preflight_hard_veto']);
  // No calibrated incremental-value estimate or approved cheap-call bypass exists.
  // Every potential execution still requires the full verified canonical judgment and capability.
  return result('full_judgment_required', null, [
    'required_judgment_preserved',
    'incremental_assessment_value_unmeasured',
  ]);
}
