import { afterEach, describe, expect, it, vi } from 'vitest';
import * as preSpendDecision from '../src/services/hermesPreSpendDecision';
import {
  checkHermesSpendPolicy,
  HERMES_SPEND_POLICY_EXAMPLE_INPUT,
  listHermesSpendPolicies,
  type HermesSpendPolicyCheckInput
} from '../src/services/hermesSpendPolicy';
import type { HermesPreSpendDecision } from '../src/services/hermesPreSpendDecision';

function decisionFixture(overrides: Partial<HermesPreSpendDecision> = {}): HermesPreSpendDecision {
  return {
    id: 'hermes_pre_spend_decision_fixture',
    input: {
      route_id: 'route_pay_sh_market_research_01',
      provider_id: 'provider_pay_sh_lattice',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'x402',
      chain: 'base'
    },
    decision: 'proceed',
    confidence: 0.88,
    reason: 'Provider and route evidence is strong enough.',
    required_action: 'none',
    risk_factors: [],
    reputation_inputs: [{
      kind: 'reputation_entry',
      id: 'provider:provider_pay_sh_lattice',
      target_type: 'provider',
      target_id: 'provider_pay_sh_lattice',
      summary: 'Provider is trusted.'
    }],
    receipt_inputs: [{
      kind: 'receipt',
      id: 'receipt_123',
      target_type: 'provider',
      target_id: 'provider_pay_sh_lattice',
      summary: 'Receipt contributed evidence.'
    }],
    claim_inputs: [{
      kind: 'claim',
      id: 'claim_123',
      target_type: 'provider',
      target_id: 'provider_pay_sh_lattice',
      summary: 'Claim contributed judgment.'
    }],
    run_inputs: [{
      kind: 'run',
      id: 'run_123',
      target_type: 'provider',
      target_id: 'provider_pay_sh_lattice',
      summary: 'Run contributed evidence.'
    }],
    ledger_state: {
      provider_state: 'trusted',
      route_state: 'trusted',
      service_state: 'trusted',
      provider_score: 90,
      route_score: 88,
      service_score: 84
    },
    generated_at: '2026-07-03T00:00:00.000Z',
    ...overrides
  };
}

function withDecision(decision: HermesPreSpendDecision) {
  vi.spyOn(preSpendDecision, 'createHermesPreSpendDecision').mockReturnValue(decision);
}

function check(input: HermesSpendPolicyCheckInput = HERMES_SPEND_POLICY_EXAMPLE_INPUT) {
  return checkHermesSpendPolicy(input);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Hermes spend policy layer', () => {
  it('allows a seeded intent when the pre-spend decision proceeds cleanly', () => {
    withDecision(decisionFixture());

    const result = check();

    expect(result.decision).toBe('allow');
    expect(result.allowed).toBe(true);
  });

  it('triggers manual review when amount is above the policy max', () => {
    withDecision(decisionFixture());

    const result = check({ ...HERMES_SPEND_POLICY_EXAMPLE_INPUT, amount_usd: 300 });

    expect(result.decision).toBe('require_manual_review');
    expect(result.violations.map((item) => item.rule_id)).toContain('policy_rule_max_amount');
  });

  it('requires manual review when amount is above the manual review threshold', () => {
    withDecision(decisionFixture());

    const result = check({ ...HERMES_SPEND_POLICY_EXAMPLE_INPUT, amount_usd: 1000 });

    expect(result.decision).toBe('require_manual_review');
    expect(result.allowed).toBe(false);
    expect(result.required_action).toBe('manual_review_required');
  });

  it('blocks unsupported chains', () => {
    withDecision(decisionFixture());

    const result = check({ ...HERMES_SPEND_POLICY_EXAMPLE_INPUT, chain: 'ethereum' });

    expect(result.decision).toBe('block');
    expect(result.required_action).toBe('do_not_spend');
  });

  it('blocks unsupported payment rails', () => {
    withDecision(decisionFixture());

    const result = check({ ...HERMES_SPEND_POLICY_EXAMPLE_INPUT, payment_rail: 'wire' });

    expect(result.decision).toBe('block');
    expect(result.required_action).toBe('do_not_spend');
  });

  it('blocks providers listed in blocked_providers', () => {
    withDecision(decisionFixture({
      input: {
        ...decisionFixture().input,
        provider_id: 'provider_pay_sh_blackhole'
      }
    }));

    const strictPolicy = listHermesSpendPolicies()[1];
    const result = check({
      ...HERMES_SPEND_POLICY_EXAMPLE_INPUT,
      provider_id: 'provider_pay_sh_blackhole',
      policy_id: strictPolicy.id
    });

    expect(result.decision).toBe('block');
    expect(result.violations.map((item) => item.rule_id)).toContain('policy_rule_blocked_provider');
  });

  it('blocks when the pre-spend decision says do_not_spend', () => {
    withDecision(decisionFixture({
      decision: 'do_not_spend',
      reason: 'Provider reputation is degraded in the ledger.',
      required_action: 'do_not_use_provider',
      ledger_state: {
        provider_state: 'degraded',
        route_state: 'watchlist',
        service_state: 'watchlist',
        provider_score: 13,
        route_score: 38,
        service_score: 41
      }
    }));

    const result = check();

    expect(result.decision).toBe('block');
    expect(result.allowed).toBe(false);
  });

  it('requires manual review for insufficient evidence', () => {
    withDecision(decisionFixture({
      decision: 'insufficient_evidence',
      reason: 'No matching provider, route, or service reputation entries were found in the ledger.',
      required_action: 'request_more_evidence',
      ledger_state: {}
    }));

    const result = check();

    expect(result.decision).toBe('require_manual_review');
    expect(result.allowed).toBe(false);
  });

  it('returns allow_with_test_spend for watchlist targets when test spend is required', () => {
    withDecision(decisionFixture({
      decision: 'proceed_with_caution',
      required_action: 'run_small_test_spend',
      risk_factors: [{
        id: 'provider_watchlist',
        severity: 'medium',
        label: 'Provider on watchlist',
        detail: 'Provider is on the watchlist.',
        source: 'provider_reputation'
      }],
      ledger_state: {
        provider_state: 'watchlist',
        route_state: 'trusted',
        service_state: 'trusted',
        provider_score: 61,
        route_score: 88,
        service_score: 84
      }
    }));

    const result = check();

    expect(result.decision).toBe('allow_with_test_spend');
    expect(result.allowed).toBe(true);
    expect(result.required_action).toBe('run_small_test_spend');
  });

  it('obeys decision priority block over manual review and test spend', () => {
    withDecision(decisionFixture({
      decision: 'do_not_spend',
      required_action: 'do_not_use_provider',
      reason: 'Stop.',
      ledger_state: {
        provider_state: 'degraded',
        route_state: 'watchlist',
        service_state: 'watchlist',
        provider_score: 10,
        route_score: 38,
        service_score: 41
      }
    }));

    const result = check({ ...HERMES_SPEND_POLICY_EXAMPLE_INPUT, amount_usd: 1000, chain: 'ethereum' });

    expect(result.decision).toBe('block');
    expect(result.required_action).toBe('do_not_spend');
  });

  it('includes policy and pre-spend decision references', () => {
    withDecision(decisionFixture());

    const result = check();

    expect(result.references.map((item) => item.kind)).toEqual(expect.arrayContaining(['policy', 'pre_spend_decision']));
  });

  it('keeps allowed aligned with the final decision', () => {
    const spy = vi.spyOn(preSpendDecision, 'createHermesPreSpendDecision');
    spy.mockReturnValueOnce(decisionFixture({ decision: 'test_spend_first', required_action: 'run_small_test_spend' }));
    expect(check().allowed).toBe(true);

    spy.mockReturnValueOnce(decisionFixture({ decision: 'insufficient_evidence', required_action: 'request_more_evidence' }));
    expect(check().allowed).toBe(false);
  });
});
