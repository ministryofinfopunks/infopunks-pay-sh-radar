import { describe, expect, it } from 'vitest';
import { createHermesPolicyDecisionReceipt } from '../src/services/hermesPolicyReceipt';
import { checkHermesSpendPolicy, getHermesSpendPolicyExampleCheck, type HermesSpendPolicyCheckResult } from '../src/services/hermesSpendPolicy';

function cleanAllowCheck(): HermesSpendPolicyCheckResult {
  const check = getHermesSpendPolicyExampleCheck();
  return {
    ...check,
    id: `${check.id}_clean_allow`,
    decision: 'allow',
    allowed: true,
    required_action: 'none',
    reason: 'Spend intent stays within policy boundaries.',
    violations: [],
    warnings: []
  };
}

describe('Hermes policy decision receipts', () => {
  it('converts the deterministic example check into a receipt', () => {
    const check = getHermesSpendPolicyExampleCheck();
    const conversion = createHermesPolicyDecisionReceipt(check);

    expect(conversion.check_id).toBe(check.id);
    expect(conversion.receipt.source_check_id).toBe(check.id);
    expect(conversion.receipt.receipt_kind).toBe('spend_policy_decision_receipt');
  });

  it('uses a deterministic receipt id', () => {
    const check = getHermesSpendPolicyExampleCheck();

    expect(createHermesPolicyDecisionReceipt(check).receipt.id).toBe(
      createHermesPolicyDecisionReceipt(check).receipt.id
    );
    expect(createHermesPolicyDecisionReceipt(check).receipt.id).toBe(`receipt_hermes_policy_${check.id}`);
  });

  it('preserves input, policy snapshot, violations, warnings, and references', () => {
    const check = getHermesSpendPolicyExampleCheck();
    const conversion = createHermesPolicyDecisionReceipt(check);

    expect(conversion.receipt.input).toEqual(expect.objectContaining({
      route_id: check.input.route_id,
      provider_id: check.input.provider_id,
      service_id: check.input.service_id,
      amount_usd: check.input.amount_usd,
      payment_rail: check.input.payment_rail,
      chain: check.input.chain
    }));
    expect(conversion.receipt.policy_snapshot.id).toBe(check.policy.id);
    expect(conversion.receipt.violations).toEqual(check.violations);
    expect(conversion.receipt.warnings).toEqual(check.warnings);
    expect(conversion.receipt.references).toEqual(check.references);
  });

  it('includes all required audit trail events in order', () => {
    const events = createHermesPolicyDecisionReceipt(getHermesSpendPolicyExampleCheck()).receipt.audit_trail.events;

    expect(events.map((event) => event.state)).toEqual([
      'policy_loaded',
      'spend_intent_received',
      'pre_spend_decision_checked',
      'rules_evaluated',
      'policy_decision_made',
      'receipt_created'
    ]);
  });

  it('reports low risk for allow with no violations', () => {
    const conversion = createHermesPolicyDecisionReceipt(cleanAllowCheck());

    expect(conversion.receipt.risk_summary).toEqual(expect.objectContaining({
      risk_level: 'low',
      violation_count: 0,
      warning_count: 0
    }));
  });

  it('reports medium risk for allow_with_test_spend', () => {
    const clean = cleanAllowCheck();
    const conversion = createHermesPolicyDecisionReceipt({
      ...clean,
      decision: 'allow_with_test_spend',
      required_action: 'run_small_test_spend',
      warnings: [{
        id: 'policy_warning_fixture_test_spend',
        rule_id: 'policy_rule_watchlist_test_spend',
        severity: 'medium',
        label: 'Watchlist requires test spend',
        detail: 'Fixture warning requires a small test spend.',
        outcome: 'test_spend_required'
      }]
    });

    expect(conversion.receipt.policy_decision).toBe('allow_with_test_spend');
    expect(conversion.receipt.risk_summary.risk_level).toBe('medium');
  });

  it('reports high risk for require_manual_review', () => {
    const conversion = createHermesPolicyDecisionReceipt(checkHermesSpendPolicy({
      route_id: 'route_pay_sh_market_research_03',
      provider_id: 'provider_pay_sh_oracle',
      service_id: 'service_market_research',
      amount_usd: 300,
      payment_rail: 'x402',
      chain: 'base'
    }));

    expect(conversion.receipt.policy_decision).toBe('require_manual_review');
    expect(conversion.receipt.risk_summary.risk_level).toBe('high');
  });

  it('reports critical risk for block', () => {
    const conversion = createHermesPolicyDecisionReceipt(checkHermesSpendPolicy({
      route_id: 'route_pay_sh_market_research_03',
      provider_id: 'provider_pay_sh_oracle',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'x402',
      chain: 'ethereum'
    }));

    expect(conversion.receipt.policy_decision).toBe('block');
    expect(conversion.receipt.risk_summary.risk_level).toBe('critical');
  });

  it('adds a clean-pass conversion note when there are no violations or warnings', () => {
    const conversion = createHermesPolicyDecisionReceipt(cleanAllowCheck());

    expect(conversion.conversion.notes).toContain('Policy check passed without violations.');
  });

  it('adds an audit evidence note for blocked decisions', () => {
    const conversion = createHermesPolicyDecisionReceipt(checkHermesSpendPolicy({
      route_id: 'route_pay_sh_market_research_03',
      provider_id: 'provider_pay_sh_oracle',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'wire',
      chain: 'base'
    }));

    expect(conversion.receipt.policy_decision).toBe('block');
    expect(conversion.conversion.notes).toContain('Blocked policy decisions are retained as audit evidence.');
  });
});
