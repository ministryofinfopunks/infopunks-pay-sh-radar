import { describe, expect, it } from 'vitest';
import { createInMemoryProofCheckRepository } from '../src/repositories/proofCheckRepository';
import { createProofCheckService } from '../src/services/proofCheckService';

describe('proof check service', () => {
  it('produces do_not_use_yet for autonomy claims without receipts or validation', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'Autonomous agent can route and settle everything now.' });

    expect(result.decision_state).toBe('do_not_use_yet');
    expect(result.risk_flags).toContain('autonomy_unproven');
  });

  it('produces caution for route claims with partial receipts and no human validation', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'Pay.sh route latency and performance claim for market intelligence.' });

    expect(result.decision_state).toBe('caution');
    expect(result.receipt_strength).toBe('partial_receipts');
  });

  it('produces trust for provider reliability claims with validated language', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'Provider reliability validated and verified across receipt parsing runs.' });

    expect(result.decision_state).toBe('trust');
    expect(result.validation_status).toBe('human_validated');
  });

  it('produces disputed when the input contains a conflicting partnership claim', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'Partnership claim has conflicting screenshots and an open dispute.' });

    expect(result.decision_state).toBe('disputed');
    expect(result.validation_status).toBe('disputed');
  });

  it('produces unproven for a generic low-evidence claim', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'This project is the future.' });

    expect(result.decision_state).toBe('unproven');
    expect(result.receipt_strength).toBe('no_receipts');
  });

  it('keeps the MONITOR market narrative deterministic and cautious', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({
      claim: '$MONITOR is a live global-situation intelligence product paired with tokenized PLTR',
      claim_type: 'market_narrative',
      subject: {
        ticker: 'MONITOR',
        name: 'The Situation',
        chain: 'robinhood',
        contract: '0x1a911bb954dAA9CB38513423075bE74450351e18',
        pair: '0xcfa7bb34e23a7022c3de3e1618e1ff29cde8f16a76c341eca19d16f928968a3d',
        site: 'https://www.monitorsituation.xyz/',
        x: 'https://x.com/monitoringmeme'
      },
      receipts: [
        { type: 'onchain_pair', url: 'https://dexscreener.com/robinhood/0xcfa7bb34e23a7022c3de3e1618e1ff29cde8f16a76c341eca19d16f928968a3d' },
        { type: 'public_site', url: 'https://www.monitorsituation.xyz/' },
        { type: 'social', url: 'https://x.com/monitoringmeme' }
      ],
      missing_receipts: ['audit', 'team_dox', 'utility_commitment', 'paid_route_benchmark']
    });

    expect(result.check_id).toBe('check_monitor');
    expect(result.subject_id).toBe('subject_monitor');
    expect(result.subject?.subject_id).toBe('subject_monitor');
    expect(result.receipts_found).toHaveLength(3);
    expect(result.missing_receipts).toEqual(['audit', 'team_dox', 'utility_commitment', 'paid_route_benchmark']);
    expect(result.evidence_strength).toBe('weak');
    expect(result.validation_status).toBe('unvalidated');
    expect(result.decision_state).toBe('caution');
    expect(result.risk_flags).toEqual(['narrative_over_evidence', 'no_human_validation', 'weak_onchain_evidence', 'route_not_repeatable']);
    expect(result.share_url).toBe('/check/monitor');
  });
});
