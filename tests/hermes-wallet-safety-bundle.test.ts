import { afterEach, describe, expect, it, vi } from 'vitest';
import * as preSpendDecisionService from '../src/services/hermesPreSpendDecision';
import * as spendPolicyService from '../src/services/hermesSpendPolicy';
import {
  createHermesWalletSafetyCheck,
  getHermesWalletSafetyExampleCheck,
  type HermesWalletSafetyCheckInput
} from '../src/services/hermesWalletSafetyBundle';

const seededInput: HermesWalletSafetyCheckInput = {
  route_id: 'route_pay_sh_market_research_01',
  provider_id: 'provider_pay_sh_lattice',
  service_id: 'service_market_research',
  amount_usd: 25,
  payment_rail: 'x402',
  chain: 'base'
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Hermes Wallet Safety API Bundle', () => {
  it('returns a deterministic bundled result for seeded input', () => {
    expect(createHermesWalletSafetyCheck(seededInput)).toEqual(createHermesWalletSafetyCheck(seededInput));
  });

  it('includes every bundled primitive and the final recommendation', () => {
    const result = createHermesWalletSafetyCheck(seededInput);

    expect(result.pre_spend_decision).toBeTruthy();
    expect(result.spend_policy_check).toBeTruthy();
    expect(result.policy_receipt).toBeTruthy();
    expect(result.reconciliation_preview).toBeTruthy();
    expect(result.wallet_audit_trail).toBeTruthy();
    expect(result.wallet_risk_score).toBeTruthy();
    expect(result.final_recommendation).toBeTruthy();
  });

  it('blocks when the policy check blocks', () => {
    const result = createHermesWalletSafetyCheck({ ...seededInput, chain: 'ethereum' });

    expect(result.spend_policy_check.decision).toBe('block');
    expect(result.final_recommendation).toEqual(expect.objectContaining({
      decision: 'block_spend',
      allowed: false,
      required_action: 'block_spend'
    }));
  });

  it('requires manual review when policy requires manual review', () => {
    const result = createHermesWalletSafetyCheck({
      amount_usd: 300,
      payment_rail: 'x402',
      chain: 'base'
    });

    expect(result.spend_policy_check.decision).toBe('require_manual_review');
    expect(result.final_recommendation).toEqual(expect.objectContaining({
      decision: 'manual_review_required',
      allowed: false,
      required_action: 'manual_review_required'
    }));
  });

  it('requires test spend when policy says allow_with_test_spend', () => {
    const result = createHermesWalletSafetyCheck({
      route_id: 'route_pay_sh_market_research_01',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'x402',
      chain: 'base'
    });

    expect(result.spend_policy_check.decision).toBe('allow_with_test_spend');
    expect(result.final_recommendation).toEqual(expect.objectContaining({
      decision: 'test_spend_required',
      allowed: true,
      required_action: 'run_test_spend'
    }));
  });

  it('handles insufficient evidence when policy does not already escalate harder', () => {
    const insufficientDecision = preSpendDecisionService.createHermesPreSpendDecision({
      provider_id: 'provider_unknown',
      route_id: 'route_unknown',
      service_id: 'service_unknown'
    });
    const allowedPolicyCheck = spendPolicyService.checkHermesSpendPolicy({
      route_id: 'route_pay_sh_market_research_01',
      service_id: 'service_market_research',
      amount_usd: 25,
      payment_rail: 'x402',
      chain: 'base'
    });

    vi.spyOn(preSpendDecisionService, 'createHermesPreSpendDecision').mockReturnValue(insufficientDecision);
    vi.spyOn(spendPolicyService, 'checkHermesSpendPolicy').mockReturnValue({
      ...allowedPolicyCheck,
      decision: 'allow',
      allowed: true,
      required_action: 'none',
      violations: [],
      warnings: [],
      pre_spend_decision: insufficientDecision
    });

    const result = createHermesWalletSafetyCheck({
      provider_id: 'provider_unknown',
      route_id: 'route_unknown',
      service_id: 'service_unknown'
    });

    expect(result.pre_spend_decision.decision).toBe('insufficient_evidence');
    expect(result.final_recommendation).toEqual(expect.objectContaining({
      decision: 'insufficient_evidence',
      allowed: false,
      required_action: 'request_more_evidence'
    }));
  });

  it('keeps confidence between 0 and 1', () => {
    const result = createHermesWalletSafetyCheck(seededInput);

    expect(result.final_recommendation.confidence).toBeGreaterThanOrEqual(0);
    expect(result.final_recommendation.confidence).toBeLessThanOrEqual(1);
  });

  it('references key bundled primitives', () => {
    const result = createHermesWalletSafetyCheck(seededInput);
    const kinds = result.final_recommendation.references.map((reference) => reference.kind);

    expect(kinds).toEqual(expect.arrayContaining([
      'pre_spend_decision',
      'spend_policy_check',
      'policy_receipt',
      'reconciliation',
      'wallet_audit_trail',
      'wallet_risk_score'
    ]));
  });

  it('returns a deterministic example check', () => {
    expect(getHermesWalletSafetyExampleCheck()).toEqual(getHermesWalletSafetyExampleCheck());
  });
});
