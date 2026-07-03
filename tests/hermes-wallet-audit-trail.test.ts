import { describe, expect, it } from 'vitest';
import {
  buildHermesWalletAuditTrail,
  buildHermesWalletAuditTrailSummary
} from '../src/services/hermesWalletAuditTrail';

describe('Hermes wallet audit trail', () => {
  it('returns a deterministic trail', () => {
    expect(buildHermesWalletAuditTrail()).toEqual(buildHermesWalletAuditTrail());
  });

  it('includes exactly the eight required event kinds in order', () => {
    const trail = buildHermesWalletAuditTrail();

    expect(trail.events.map((event) => event.kind)).toEqual([
      'spend_intent',
      'pre_spend_decision',
      'decision_receipt',
      'policy_check',
      'policy_receipt',
      'wallet_outcome',
      'reconciliation',
      'feedback'
    ]);
  });

  it('ensures every event has the required display fields', () => {
    const trail = buildHermesWalletAuditTrail();

    for (const event of trail.events) {
      expect(event.id).toBeTruthy();
      expect(event.title).toBeTruthy();
      expect(event.state).toBeTruthy();
      expect(event.actor).toBeTruthy();
      expect(event.summary).toBeTruthy();
    }
  });

  it('builds a valid risk posture and expected signals', () => {
    const trail = buildHermesWalletAuditTrail();
    const signals = new Map(trail.signals.map((signal) => [signal.id, signal]));

    expect(['low', 'medium', 'high', 'critical']).toContain(trail.risk_posture.level);
    expect(trail.risk_posture.summary.length).toBeGreaterThan(0);
    expect(trail.risk_posture.reasons.length).toBeGreaterThan(0);
    expect(signals.get('spend_amount')?.value).toBe(25);
    expect(signals.get('chain')?.value).toBe('base');
    expect(signals.get('payment_rail')?.value).toBe('x402');
    expect(signals.get('policy_decision')?.value).toBe('block');
    expect(signals.get('outcome_state')?.value).toBe('blocked_as_required');
    expect(signals.get('compliance_state')?.value).toBe('compliant');
    expect(signals.get('next_policy_action')?.value).toBe('none');
  });

  it('includes decision receipt, policy receipt, and reconciliation references where applicable', () => {
    const trail = buildHermesWalletAuditTrail();
    const referenceKinds = trail.events.flatMap((event) => event.references.map((reference) => reference.kind));

    expect(referenceKinds).toContain('decision_receipt');
    expect(referenceKinds).toContain('policy_receipt');
    expect(referenceKinds).toContain('reconciliation');
  });

  it('keeps summary counts aligned with the events', () => {
    const trail = buildHermesWalletAuditTrail();

    expect(trail.summary.event_count).toBe(trail.events.length);
    expect(trail.summary.recorded_count).toBe(trail.events.filter((event) => event.state === 'recorded').length);
    expect(trail.summary.allowed_count).toBe(trail.events.filter((event) => event.state === 'allowed').length);
    expect(trail.summary.blocked_count).toBe(trail.events.filter((event) => event.state === 'blocked').length);
    expect(trail.summary.compliant_count).toBe(trail.events.filter((event) => event.state === 'compliant').length);
    expect(trail.summary.non_compliant_count).toBe(trail.events.filter((event) => event.state === 'non_compliant').length);
    expect(trail.summary.needs_review_count).toBe(trail.events.filter((event) => event.state === 'needs_review').length);
  });

  it('builds a stateless summary without live Hermes requirements', () => {
    const summary = buildHermesWalletAuditTrailSummary();

    expect(summary.trail_count).toBeGreaterThanOrEqual(1);
    expect(summary.trails[0]?.events).toHaveLength(8);
    expect(summary.trails[0]?.title).toBe('Autonomous Wallet Audit Trail');
  });
});
