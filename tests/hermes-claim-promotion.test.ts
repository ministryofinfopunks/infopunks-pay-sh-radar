import { describe, expect, it } from 'vitest';
import type { HermesDecisionState, HermesRun } from '../src/data/hermesDesk';
import { promoteHermesClaimCandidate } from '../src/services/hermesClaimPromotion';

function runFixture(decision: HermesDecisionState, extra: Record<string, unknown> = {}): HermesRun {
  return {
    id: `hermes_${decision}_fixture`,
    title: `${decision} fixture`,
    objective: 'Review claim candidate promotion.',
    state: 'completed',
    decision,
    confidence: 80,
    summary: 'Hermes produced a deterministic claim candidate.',
    risk_factors: ['Risk note one.'],
    artifacts: [
      {
        artifact_id: `artifact_${decision}`,
        label: `${decision} artifact`,
        type: 'receipt',
        summary: 'Evidence artifact.',
        uri: '/receipts/receipt_001'
      }
    ],
    linked_receipt_id: null,
    linked_claim_id: null,
    linked_loop_id: null,
    created_at: '2026-07-03T00:00:00.000Z',
    completed_at: '2026-07-03T00:01:00.000Z',
    ...extra
  };
}

describe('Hermes claim promotion', () => {
  it('promotes trust runs to accepted claims with positive reputation impact', () => {
    const result = promoteHermesClaimCandidate(runFixture('trust', { provider_id: 'provider_alpha' }));

    expect(result.promoted_claim.review_state).toBe('accepted');
    expect(result.promoted_claim.decision).toBe('trust');
    expect(result.promoted_claim.reputation_impact).toEqual(expect.objectContaining({
      target_type: 'provider',
      target_id: 'provider_alpha',
      direction: 'positive',
      magnitude: 0.8
    }));
  });

  it('promotes caution runs to needs_more_evidence with watch reputation impact', () => {
    const result = promoteHermesClaimCandidate(runFixture('caution'));

    expect(result.promoted_claim.review_state).toBe('needs_more_evidence');
    expect(result.promoted_claim.reputation_impact.direction).toBe('watch');
  });

  it('promotes disputed runs to disputed review state', () => {
    const result = promoteHermesClaimCandidate(runFixture('disputed'));

    expect(result.promoted_claim.review_state).toBe('disputed');
    expect(result.review.state).toBe('disputed');
  });

  it('allows a valid requested review_state override', () => {
    const result = promoteHermesClaimCandidate(runFixture('caution'), 'accepted');

    expect(result.promoted_claim.review_state).toBe('accepted');
    expect(result.review.notes.join(' ')).toContain('Requested review_state=accepted was accepted');
  });

  it('falls back safely when review_state is missing or invalid', () => {
    const missing = promoteHermesClaimCandidate(runFixture('unproven'));
    const invalid = promoteHermesClaimCandidate(runFixture('unproven'), 'not_valid' as any);

    expect(missing.promoted_claim.review_state).toBe('needs_more_evidence');
    expect(invalid.promoted_claim.review_state).toBe('needs_more_evidence');
    expect(invalid.review.notes.join(' ')).toContain('No valid review_state override');
  });

  it('selects reputation targets by provider, route, service, then unknown', () => {
    expect(promoteHermesClaimCandidate(runFixture('trust', {
      provider_id: 'provider_preferred',
      route_id: 'route_secondary',
      service_id: 'service_third'
    })).promoted_claim.reputation_impact).toEqual(expect.objectContaining({
      target_type: 'provider',
      target_id: 'provider_preferred'
    }));

    expect(promoteHermesClaimCandidate(runFixture('trust', {
      route_id: 'route_preferred',
      service_id: 'service_secondary'
    })).promoted_claim.reputation_impact).toEqual(expect.objectContaining({
      target_type: 'route',
      target_id: 'route_preferred'
    }));

    expect(promoteHermesClaimCandidate(runFixture('trust', {
      service_id: 'service_preferred'
    })).promoted_claim.reputation_impact).toEqual(expect.objectContaining({
      target_type: 'service',
      target_id: 'service_preferred'
    }));

    expect(promoteHermesClaimCandidate(runFixture('trust')).promoted_claim.reputation_impact.target_type).toBe('unknown');
  });
});
