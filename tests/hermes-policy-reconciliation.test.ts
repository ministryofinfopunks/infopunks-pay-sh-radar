import { describe, expect, it } from 'vitest';
import {
  previewHermesPolicyReconciliation,
  reconcileHermesPolicyOutcome,
  type HermesPolicyOutcomeState
} from '../src/services/hermesPolicyReconciliation';
import type { HermesSpendPolicyCheckResult } from '../src/services/hermesSpendPolicy';
import { getHermesSpendPolicyExampleCheck, getDefaultHermesSpendPolicy, HERMES_SPEND_POLICY_EXAMPLE_INPUT } from '../src/services/hermesSpendPolicy';
import type { HermesPreSpendDecision } from '../src/services/hermesPreSpendDecision';

function decisionFixture(overrides: Partial<HermesPreSpendDecision> = {}): HermesPreSpendDecision {
  return {
    id: 'hermes_pre_spend_decision_fixture',
    input: { ...HERMES_SPEND_POLICY_EXAMPLE_INPUT },
    decision: 'proceed',
    confidence: 0.88,
    reason: 'Fixture decision.',
    required_action: 'none',
    risk_factors: [],
    reputation_inputs: [],
    receipt_inputs: [],
    claim_inputs: [],
    run_inputs: [],
    ledger_state: {
      provider_state: 'trusted',
      route_state: 'trusted',
      service_state: 'trusted',
      provider_score: 88,
      route_score: 88,
      service_score: 88
    },
    generated_at: '2026-07-03T00:00:00.000Z',
    ...overrides
  };
}

function checkFixture(overrides: Partial<HermesSpendPolicyCheckResult> = {}): HermesSpendPolicyCheckResult {
  const policy = overrides.policy ?? getDefaultHermesSpendPolicy();
  const input = { ...HERMES_SPEND_POLICY_EXAMPLE_INPUT, ...overrides.input };
  return {
    id: 'hermes_spend_policy_check_fixture',
    policy,
    input,
    decision: 'allow',
    allowed: true,
    reason: 'Fixture allow decision.',
    required_action: 'none',
    violations: [],
    warnings: [],
    pre_spend_decision: decisionFixture({ input, ...overrides.pre_spend_decision }),
    references: [],
    generated_at: '2026-07-03T00:00:00.000Z',
    ...overrides
  };
}

function reconcile(check: HermesSpendPolicyCheckResult, outcomeState?: HermesPolicyOutcomeState, extra: Record<string, unknown> = {}) {
  return reconcileHermesPolicyOutcome(check, outcomeState ? { outcome_state: outcomeState, ...extra } : extra);
}

describe('Hermes policy outcome reconciliation', () => {
  it('preview reconciliation returns deterministic result for example check', () => {
    const first = previewHermesPolicyReconciliation(getHermesSpendPolicyExampleCheck());
    const second = previewHermesPolicyReconciliation(getHermesSpendPolicyExampleCheck());

    expect(first).toEqual(second);
    expect(first.feedback.status).toBe('preview');
  });

  it('allow + spent returns compliant', () => {
    expect(reconcile(checkFixture({ decision: 'allow', allowed: true }), 'spent').compliance_state).toBe('compliant');
  });

  it('allow_with_test_spend + test_spend_completed returns compliant', () => {
    expect(reconcile(checkFixture({
      decision: 'allow_with_test_spend',
      allowed: true,
      required_action: 'run_small_test_spend'
    }), 'test_spend_completed').compliance_state).toBe('compliant');
  });

  it('require_manual_review + manual_review_completed returns compliant', () => {
    expect(reconcile(checkFixture({
      decision: 'require_manual_review',
      allowed: false,
      required_action: 'manual_review_required'
    }), 'manual_review_completed').compliance_state).toBe('compliant');
  });

  it('require_manual_review + manual_review_missing returns non_compliant', () => {
    expect(reconcile(checkFixture({
      decision: 'require_manual_review',
      allowed: false,
      required_action: 'manual_review_required'
    }), 'manual_review_missing').compliance_state).toBe('non_compliant');
  });

  it('block + blocked_as_required returns compliant', () => {
    expect(reconcile(checkFixture({
      decision: 'block',
      allowed: false,
      required_action: 'do_not_spend'
    }), 'blocked_as_required').compliance_state).toBe('compliant');
  });

  it('block + spent_despite_block returns non_compliant and critical finding', () => {
    const result = reconcile(checkFixture({
      decision: 'block',
      allowed: false,
      required_action: 'do_not_spend'
    }), 'spent_despite_block');

    expect(result.compliance_state).toBe('non_compliant');
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Spent despite block', severity: 'critical' })
    ]));
  });

  it('invalid outcome_state safely falls back', () => {
    const result = reconcileHermesPolicyOutcome(checkFixture({ decision: 'allow' }), { outcome_state: 'not_real' as HermesPolicyOutcomeState });
    expect(result.outcome.outcome_state).toBe('spent');
  });

  it('unsupported observed chain creates finding', () => {
    const result = reconcile(checkFixture({ decision: 'allow' }), 'spent', { chain: 'ethereum' });
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Unsupported chain observed' })]));
  });

  it('unsupported observed payment rail creates finding', () => {
    const result = reconcile(checkFixture({ decision: 'allow' }), 'spent', { payment_rail: 'wire' });
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Unsupported payment rail observed' })]));
  });

  it('amount above policy max creates finding', () => {
    const result = reconcile(checkFixture({ decision: 'allow' }), 'spent', { amount_usd: 999 });
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Amount greater than policy max' })]));
  });

  it('failed outcome creates needs_review', () => {
    expect(reconcile(checkFixture({ decision: 'require_manual_review', allowed: false }), 'failed').compliance_state).toBe('needs_review');
  });

  it('impact magnitude stays between 0 and 1', () => {
    const result = reconcile(checkFixture({ decision: 'block', allowed: false }), 'spent_despite_block', { amount_usd: 5000 });
    expect(result.impact.magnitude).toBeGreaterThanOrEqual(0);
    expect(result.impact.magnitude).toBeLessThanOrEqual(1);
  });

  it('target selection prefers provider_id, then route_id, then service_id, then policy', () => {
    expect(reconcile(checkFixture({
      input: { route_id: 'route_1', provider_id: 'provider_1', service_id: 'service_1' }
    }), 'spent').impact).toEqual(expect.objectContaining({ target_type: 'provider', target_id: 'provider_1' }));

    expect(reconcile(checkFixture({
      input: { route_id: 'route_1', provider_id: undefined, service_id: 'service_1' }
    }), 'spent').impact).toEqual(expect.objectContaining({ target_type: 'route', target_id: 'route_1' }));

    expect(reconcile(checkFixture({
      input: { route_id: undefined, provider_id: undefined, service_id: 'service_1' }
    }), 'spent').impact).toEqual(expect.objectContaining({ target_type: 'service', target_id: 'service_1' }));

    expect(reconcile(checkFixture({
      input: { route_id: undefined, provider_id: undefined, service_id: undefined }
    }), 'spent').impact).toEqual(expect.objectContaining({ target_type: 'policy', target_id: getDefaultHermesSpendPolicy().id }));
  });

  it('feedback next_policy_action is deterministic', () => {
    expect(reconcile(checkFixture({ decision: 'block', allowed: false }), 'spent_despite_block').feedback.next_policy_action).toBe('block_provider');
    expect(reconcile(checkFixture({ decision: 'require_manual_review', allowed: false }), 'manual_review_missing').feedback.next_policy_action).toBe('require_manual_review');
    expect(reconcile(checkFixture({
      decision: 'allow_with_test_spend',
      allowed: true,
      required_action: 'run_small_test_spend',
      input: { ...HERMES_SPEND_POLICY_EXAMPLE_INPUT, amount_usd: 100 }
    }), 'spent', { amount_usd: 100 }).feedback.next_policy_action).toBe('tighten_policy');
    expect(reconcile(checkFixture({ decision: 'allow', allowed: true }), 'failed').feedback.next_policy_action).toBe('request_more_evidence');
  });
});
