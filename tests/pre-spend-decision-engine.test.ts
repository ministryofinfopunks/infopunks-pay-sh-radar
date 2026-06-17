import { describe, expect, it } from 'vitest';
import {
  calculateConfidenceScore,
  calculateRiskLevel,
  DecisionContext,
  makePreSpendDecision,
  PreSpendCheckRequest
} from '../src/services/preSpendDecisionService';

function buildContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    route: {
      route_id: 'route_fixture',
      provider_id: 'provider_fixture',
      service_id: 'service_fixture',
      endpoint: 'POST /fixture',
      payment_method: 'stablecoin',
      estimated_cost: '0.25 USDC',
      latency_ms_p50: 400,
      latency_ms_p95: 900,
      success_rate: 0.95,
      last_tested_at: '2026-06-15T00:00:00.000Z',
      last_successful_run: '2026-06-15T00:00:00.000Z',
      last_failed_run: '2026-06-01T00:00:00.000Z',
      confidence_score: 90,
      risk_level: 'low',
      known_blockers: [],
      receipt_references: ['receipt_fixture_1'],
      recommended_use_case: 'buy_market_research',
      avoid_conditions: []
    },
    provider: {
      provider_id: 'provider_fixture',
      name: 'Fixture Provider',
      service_categories: ['market_research'],
      reliability_score: 92,
      pricing_consistency: 'stable',
      output_quality_notes: ['repeatable structured summaries'],
      uptime_notes: ['healthy'],
      dispute_history: [],
      human_validation_status: 'human_validated',
      known_risks: [],
      agent_compatibility: ['research_agents'],
      route_coverage: 1,
      recent_receipt_count: 3
    },
    service: {
      service_id: 'service_fixture',
      category: 'market_research',
      available_routes: ['route_fixture'],
      supported_inputs: ['query', 'topic', 'geo_scope'],
      observed_cost_range: { min: '0.25 USDC', max: '0.30 USDC' },
      observed_latency_range: { min_ms: 350, max_ms: 900 },
      best_observed_route: 'route_fixture',
      cheapest_observed_route: 'route_fixture',
      safest_first_attempt: 'route_fixture',
      fastest_repeatable_route: 'route_fixture',
      known_blockers: [],
      evidence_artifacts: ['artifact_fixture'],
      benchmark_readiness: 'human_validated',
      pre_spend_recommendation: 'Use this route first.'
    },
    receipts: [
      {
        receipt_id: 'receipt_fixture_1',
        timestamp: '2026-06-15T00:00:00.000Z',
        agent_id: 'agent_fixture',
        route_id: 'route_fixture',
        provider_id: 'provider_fixture',
        service_id: 'service_fixture',
        task_type: 'buy_market_research',
        cost: '0.25 USDC',
        payment_method: 'stablecoin',
        latency_ms: 420,
        input_summary: 'query request',
        output_summary: 'structured result',
        status: 'succeeded',
        failure_reason: null,
        validation_state: 'human_validated',
        human_notes: ['useful high quality output'],
        confidence_delta: 5,
        evidence_artifact: 'artifact_fixture'
      }
    ],
    ...overrides
  };
}

function buildRequest(overrides: Partial<PreSpendCheckRequest> = {}): PreSpendCheckRequest {
  return {
    agent_id: 'agent_fixture',
    intent: 'buy_market_research',
    budget: 25,
    risk_tolerance: 'medium',
    preferred_settlement: 'stablecoin',
    required_confidence: 70,
    ...overrides
  };
}

describe('pre-spend decision engine', () => {
  it('has a fixture for approved', () => {
    const result = makePreSpendDecision(buildRequest(), [buildContext()]);
    expect(result.decision).toBe('approved');
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('has a fixture for approved_with_warning', () => {
    const result = makePreSpendDecision(buildRequest(), [
      buildContext({
        route: {
          ...buildContext().route,
          known_blockers: ['occasional timeout under load']
        }
      })
    ]);
    expect(result.decision).toBe('approved_with_warning');
    expect(result.rationale.join(' ')).toContain('Known blockers');
  });

  it('has a fixture for use_with_caution', () => {
    const staleReceipt = {
      ...buildContext().receipts[0],
      timestamp: '2026-05-10T00:00:00.000Z',
      validation_state: 'stale' as const
    };
    const result = makePreSpendDecision(buildRequest({ required_confidence: 85 }), [
      buildContext({
        route: {
          ...buildContext().route,
          last_successful_run: '2026-05-10T00:00:00.000Z'
        },
        provider: {
          ...buildContext().provider,
          human_validation_status: 'stale'
        },
        receipts: [staleReceipt]
      })
    ]);
    expect(result.decision).toBe('use_with_caution');
    expect(result.rationale.join(' ')).toContain('Stale receipts reduce confidence.');
  });

  it('has a fixture for requires_human_approval', () => {
    const result = makePreSpendDecision(buildRequest({ budget: 250 }), [buildContext()]);
    expect(result.decision).toBe('requires_human_approval');
    expect(result.requires_human_approval).toBe(true);
    expect(result.rationale.join(' ')).toContain('Budget 250 requires human approval.');
  });

  it('has a fixture for do_not_use', () => {
    const result = makePreSpendDecision(buildRequest(), [
      buildContext({
        route: {
          ...buildContext().route,
          known_blockers: ['no recent successful receipt']
        },
        provider: {
          ...buildContext().provider,
          dispute_history: ['billing dispute unresolved'],
          human_validation_status: 'disputed',
          agent_compatibility: []
        },
        receipts: [{
          ...buildContext().receipts[0],
          timestamp: '2026-04-01T00:00:00.000Z',
          status: 'failed',
          failure_reason: 'provider failure',
          validation_state: 'disputed'
        }]
      })
    ]);
    expect(result.decision).toBe('do_not_use');
    expect(result.rationale.join(' ')).toContain('No receipt, no trust');
  });

  it('stale receipts reduce confidence', () => {
    const fresh = calculateConfidenceScore(buildContext());
    const stale = calculateConfidenceScore(buildContext({
      route: {
        ...buildContext().route,
        last_successful_run: '2026-05-01T00:00:00.000Z'
      },
      receipts: [{
        ...buildContext().receipts[0],
        timestamp: '2026-05-01T00:00:00.000Z',
        validation_state: 'stale'
      }]
    }));
    expect(stale).toBeLessThan(fresh);
  });

  it('recent human validation increases confidence', () => {
    const machineChecked = calculateConfidenceScore(buildContext({
      provider: {
        ...buildContext().provider,
        human_validation_status: 'machine_checked'
      },
      service: {
        ...buildContext().service,
        benchmark_readiness: 'machine_checked'
      },
      receipts: [{
        ...buildContext().receipts[0],
        validation_state: 'machine_checked',
        human_notes: []
      }]
    }));
    const humanValidated = calculateConfidenceScore(buildContext());
    expect(humanValidated).toBeGreaterThan(machineChecked);
  });

  it('unresolved disputes increase risk', () => {
    const baseRisk = calculateRiskLevel(buildRequest(), buildContext());
    const disputedRisk = calculateRiskLevel(buildRequest(), buildContext({
      provider: {
        ...buildContext().provider,
        dispute_history: ['open dispute']
      },
      receipts: [{
        ...buildContext().receipts[0],
        validation_state: 'disputed'
      }]
    }));
    const order = ['low', 'medium', 'high', 'critical'];
    expect(order.indexOf(disputedRisk)).toBeGreaterThan(order.indexOf(baseRisk));
  });

  it('required confidence affects the decision', () => {
    const context = buildContext({
      route: {
        ...buildContext().route,
        success_rate: 0.86,
        known_blockers: ['occasional timeout under load']
      },
      provider: {
        ...buildContext().provider,
        reliability_score: 74,
        human_validation_status: 'machine_checked'
      },
      service: {
        ...buildContext().service,
        benchmark_readiness: 'machine_checked'
      },
      receipts: [{
        ...buildContext().receipts[0],
        validation_state: 'machine_checked',
        human_notes: ['useful output']
      }]
    });
    const permissive = makePreSpendDecision(buildRequest({ required_confidence: 60 }), [context]);
    const strict = makePreSpendDecision(buildRequest({ required_confidence: 95 }), [context]);
    expect(permissive.decision).toBe('approved_with_warning');
    expect(strict.decision).toBe('use_with_caution');
  });

  it('risk tolerance affects the decision', () => {
    const riskyContext = buildContext({
      route: {
        ...buildContext().route,
        success_rate: 0.72,
        known_blockers: ['latency spike risk']
      },
      provider: {
        ...buildContext().provider,
        dispute_history: ['resolved complaint']
      }
    });
    const highTolerance = makePreSpendDecision(buildRequest({ risk_tolerance: 'high' }), [riskyContext]);
    const lowTolerance = makePreSpendDecision(buildRequest({ risk_tolerance: 'low' }), [riskyContext]);
    expect(highTolerance.decision).toBe('approved_with_warning');
    expect(['requires_human_approval', 'use_with_caution', 'do_not_use']).toContain(lowTolerance.decision);
    expect(lowTolerance.decision).not.toBe('approved');
  });

  it('no recent successful receipt usually avoids silent approval', () => {
    const result = makePreSpendDecision(buildRequest(), [
      buildContext({
        route: {
          ...buildContext().route,
          known_blockers: ['fresh evidence missing'],
          last_successful_run: '2026-04-01T00:00:00.000Z'
        },
        receipts: [{
          ...buildContext().receipts[0],
          timestamp: '2026-04-01T00:00:00.000Z',
          validation_state: 'stale'
        }]
      })
    ]);
    expect(['do_not_use', 'use_with_caution']).toContain(result.decision);
  });
});
