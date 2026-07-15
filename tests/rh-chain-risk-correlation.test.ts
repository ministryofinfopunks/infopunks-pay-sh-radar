import { describe, expect, it } from 'vitest';
import { getRhChainReviewQueue } from '../src/data/rhChain';
import { findRhChainRiskCorrelations } from '../src/services/rhChainRiskCorrelationService';

describe('RH Chain risk correlations', () => {
  it('returns cautious duplicate, deployer, liquidity, and evidence correlations without private data', () => {
    const seed = structuredClone(getRhChainReviewQueue().items[0]);
    const left = { ...seed, review_id: 'review-left', ticker: 'SAME', token_contract: '0xleft', links: { ...seed.links, liquidity: 'https://example.com/pair' }, missing_evidence: ['contract verification'], launch_context: { ...seed.launch_context!, deployer_address: '0xdeployer', launch_source: 'unknown_manual' as const, contract_verified: 'unknown' as const, lp_status: 'locked_claimed' as const } };
    const right = { ...seed, review_id: 'review-right', ticker: 'SAME', token_contract: '0xright', links: { ...seed.links, liquidity: 'https://example.com/pair' }, missing_evidence: ['contract verification'], launch_context: { ...seed.launch_context!, deployer_address: '0xdeployer', launch_source: 'unknown_manual' as const, contract_verified: 'unknown' as const, lp_status: 'locked_claimed' as const } };
    const correlations = findRhChainRiskCorrelations([left, right]);
    expect(correlations.map((item) => item.correlation_type)).toEqual(expect.arrayContaining(['duplicate_ticker_multiple_contracts', 'same_deployer_multiple_submissions', 'reused_liquidity_link', 'missing_contract_verification', 'repeated_lp_status_claim_without_evidence']));
    expect(correlations.every((item) => item.review_status === 'requires_review' && item.suspected_correlation.toLowerCase().includes('suspected'))).toBe(true);
    expect(JSON.stringify(correlations)).not.toContain('scout_contact');
    expect(JSON.stringify(correlations).toLowerCase()).not.toContain('scam');
  });

  it('never mutates source review status or records', () => {
    const items = structuredClone(getRhChainReviewQueue().items);
    const before = JSON.stringify(items);
    findRhChainRiskCorrelations(items);
    expect(JSON.stringify(items)).toBe(before);
    expect(items.map((item) => item.review_state)).toEqual(getRhChainReviewQueue().items.map((item) => item.review_state));
  });
});
