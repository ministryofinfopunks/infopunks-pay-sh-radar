import { describe, expect, it } from 'vitest';
import {
  createHermesPreSpendDecisionExample,
  type HermesPreSpendDecision
} from '../src/services/hermesPreSpendDecision';
import {
  createHermesDecisionReceipt,
  recordHermesDecisionOutcome
} from '../src/services/hermesDecisionFeedback';

function decisionFixture(overrides: Partial<HermesPreSpendDecision> = {}): HermesPreSpendDecision {
  const base = createHermesPreSpendDecisionExample();
  return {
    ...base,
    ...overrides,
    input: {
      ...base.input,
      ...(overrides.input ?? {})
    }
  };
}

describe('Hermes decision feedback loop', () => {
  it('converts deterministic example decision into a receipt', () => {
    const decision = createHermesPreSpendDecisionExample();
    const conversion = createHermesDecisionReceipt(decision);

    expect(conversion.decision_id).toBe(decision.id);
    expect(conversion.receipt.source_decision_id).toBe(decision.id);
    expect(conversion.receipt.receipt_kind).toBe('pre_spend_decision_receipt');
  });

  it('uses a deterministic receipt id', () => {
    const decision = createHermesPreSpendDecisionExample();
    const first = createHermesDecisionReceipt(decision);
    const second = createHermesDecisionReceipt(decision);

    expect(first.receipt.id).toBe(second.receipt.id);
  });

  it('preserves inputs and evidence handles on receipt conversion', () => {
    const decision = createHermesPreSpendDecisionExample();
    const conversion = createHermesDecisionReceipt(decision);

    expect(conversion.receipt.input).toEqual(decision.input);
    expect(conversion.receipt.risk_factors).toEqual(decision.risk_factors);
    expect(conversion.receipt.reputation_inputs).toEqual(decision.reputation_inputs);
    expect(conversion.receipt.receipt_inputs).toEqual(decision.receipt_inputs);
    expect(conversion.receipt.claim_inputs).toEqual(decision.claim_inputs);
    expect(conversion.receipt.run_inputs).toEqual(decision.run_inputs);
  });

  it('defaults proceed decisions to successful outcomes', () => {
    const feedback = recordHermesDecisionOutcome(decisionFixture({ decision: 'proceed' }));

    expect(feedback.outcome.outcome_state).toBe('successful');
  });

  it('defaults do_not_spend to blocked with spend_happened false', () => {
    const feedback = recordHermesDecisionOutcome(decisionFixture({ decision: 'do_not_spend' }));

    expect(feedback.outcome.outcome_state).toBe('blocked');
    expect(feedback.outcome.spend_happened).toBe(false);
  });

  it('defaults insufficient_evidence to manual_review', () => {
    const feedback = recordHermesDecisionOutcome(decisionFixture({ decision: 'insufficient_evidence' }));

    expect(feedback.outcome.outcome_state).toBe('manual_review');
  });

  it('accepts valid outcome_state overrides', () => {
    const feedback = recordHermesDecisionOutcome(decisionFixture({ decision: 'proceed' }), {
      outcome_state: 'failed'
    });

    expect(feedback.outcome.outcome_state).toBe('failed');
  });

  it('falls back safely when outcome_state override is invalid', () => {
    const feedback = recordHermesDecisionOutcome(decisionFixture({ decision: 'proceed' }), {
      outcome_state: 'bad-state' as never
    });

    expect(feedback.outcome.outcome_state).toBe('successful');
  });

  it('creates positive impact for successful outcomes', () => {
    const feedback = recordHermesDecisionOutcome(decisionFixture({ decision: 'proceed' }), {
      outcome_state: 'successful'
    });

    expect(feedback.reputation_feedback.direction).toBe('positive');
  });

  it('creates negative impact for failed outcomes', () => {
    const feedback = recordHermesDecisionOutcome(decisionFixture({ decision: 'proceed' }), {
      outcome_state: 'failed'
    });

    expect(feedback.reputation_feedback.direction).toBe('negative');
  });

  it('creates watch impact for partial outcomes', () => {
    const feedback = recordHermesDecisionOutcome(decisionFixture({ decision: 'proceed_with_caution' }), {
      outcome_state: 'partial'
    });

    expect(feedback.reputation_feedback.direction).toBe('watch');
  });

  it('prefers provider target, then route, then service, then unknown', () => {
    const providerFeedback = recordHermesDecisionOutcome(decisionFixture({
      input: { provider_id: 'provider_x', route_id: 'route_x', service_id: 'service_x' }
    }));
    const routeFeedback = recordHermesDecisionOutcome(decisionFixture({
      input: { route_id: 'route_x', service_id: 'service_x', provider_id: undefined }
    }));
    const serviceFeedback = recordHermesDecisionOutcome(decisionFixture({
      input: { service_id: 'service_x', provider_id: undefined, route_id: undefined }
    }));
    const unknownFeedback = recordHermesDecisionOutcome(decisionFixture({
      input: { provider_id: undefined, route_id: undefined, service_id: undefined }
    }));

    expect(providerFeedback.reputation_feedback.target_type).toBe('provider');
    expect(routeFeedback.reputation_feedback.target_type).toBe('route');
    expect(serviceFeedback.reputation_feedback.target_type).toBe('service');
    expect(unknownFeedback.reputation_feedback.target_type).toBe('unknown');
  });

  it('clamps impact magnitude between 0 and 1', () => {
    const high = recordHermesDecisionOutcome(decisionFixture({
      confidence: 1,
      input: { amount_usd: 5000 }
    }), { outcome_state: 'successful' });
    const low = recordHermesDecisionOutcome(decisionFixture({
      confidence: 0,
      input: { amount_usd: 5 }
    }), { outcome_state: 'blocked' });

    expect(high.reputation_feedback.magnitude).toBeGreaterThanOrEqual(0);
    expect(high.reputation_feedback.magnitude).toBeLessThanOrEqual(1);
    expect(low.reputation_feedback.magnitude).toBeGreaterThanOrEqual(0);
    expect(low.reputation_feedback.magnitude).toBeLessThanOrEqual(1);
  });
});
