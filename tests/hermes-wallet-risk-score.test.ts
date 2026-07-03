import { describe, expect, it } from 'vitest';
import {
  buildHermesWalletRiskScore,
  buildHermesWalletRiskScoreSummary
} from '../src/services/hermesWalletRiskScore';

describe('Hermes wallet risk score', () => {
  it('returns a deterministic score', () => {
    expect(buildHermesWalletRiskScore()).toEqual(buildHermesWalletRiskScore());
  });

  it('clamps the score between 0 and 100', () => {
    const score = buildHermesWalletRiskScore();

    expect(score.risk_score).toBeGreaterThanOrEqual(0);
    expect(score.risk_score).toBeLessThanOrEqual(100);
  });

  it('maps the safety rating from the final score', () => {
    const score = buildHermesWalletRiskScore();

    if (score.risk_score >= 80) expect(score.safety_rating).toBe('safe');
    else if (score.risk_score >= 55) expect(score.safety_rating).toBe('watch');
    else if (score.risk_score >= 30) expect(score.safety_rating).toBe('risky');
    else expect(score.safety_rating).toBe('blocked');
  });

  it('maps the required next action from the rating and risks', () => {
    const score = buildHermesWalletRiskScore();

    expect(['none', 'run_test_spend', 'manual_review_required', 'tighten_policy', 'block_provider', 'request_more_evidence', 'pause_wallet']).toContain(score.required_next_action);
  });

  it('generates top risks from audit, reconciliation, and policy signals', () => {
    const score = buildHermesWalletRiskScore();

    expect(score.top_risks.length).toBeGreaterThan(0);
    expect(score.top_risks.map((risk) => risk.source)).toEqual(expect.arrayContaining(['policy']));
  });

  it('includes positive controls for the complete audit trail and receipt chain', () => {
    const score = buildHermesWalletRiskScore();
    const controlIds = score.positive_controls.map((control) => control.id);

    expect(controlIds).toContain('wallet_control_complete_audit_trail');
    expect(controlIds).toContain('wallet_control_policy_receipt');
    expect(controlIds).toContain('wallet_control_reconciliation');
  });

  it('keeps the breakdown final score aligned with risk_score', () => {
    const score = buildHermesWalletRiskScore();

    expect(score.score_breakdown.final_score).toBe(score.risk_score);
  });

  it('returns a safe unknown-trail fallback without live Hermes', () => {
    const score = buildHermesWalletRiskScore({ trail_id: 'not-real' });

    expect(score.safety_rating).toBe('unknown');
    expect(score.required_next_action).toBe('request_more_evidence');
    expect(score.source_trail_id).toBe('not-real');
  });

  it('builds a stateless summary', () => {
    const summary = buildHermesWalletRiskScoreSummary();

    expect(summary.score_count).toBeGreaterThanOrEqual(1);
    expect(summary.scores[0]?.id).toBeTruthy();
  });
});
