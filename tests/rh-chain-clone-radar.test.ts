import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { assembleRhChainCloneRadar } from '../src/services/rhChainCloneRadarService';

describe('RH Chain Clone & Impersonator Radar', () => {
  it('returns cautious, typed suspected-risk entries', () => {
    const radar = assembleRhChainCloneRadar();
    expect(radar).toEqual(expect.objectContaining({ title: 'Clone & Impersonator Radar', active_warnings: expect.any(Array), liquidity_watch: expect.any(Array), vampire_copycat_watch: expect.any(Array), correlations: expect.any(Array) }));
    expect(radar.active_warnings).toEqual(expect.arrayContaining([expect.objectContaining({ suspicion_type: expect.any(String), confidence_level: expect.any(String), evidence_links: expect.any(Array) })]));
    expect(radar.risk_categories).toEqual(expect.arrayContaining([expect.objectContaining({ category: 'launchpad_displacement_risk' })]));
    expect(radar.risk_categories.map((category) => category.category)).toEqual(expect.arrayContaining(['vampire_copycat_risk', 'fake_relaunch_risk', 'duplicate_social_claim', 'liquidity_claim_unverified', 'creator_fee_claim_uncertain', 'front_end_dependency_risk', 'direct_uniswap_low_liquidity_risk']));
    expect(radar.vampire_copycat_watch).toEqual(expect.arrayContaining([expect.objectContaining({ risk_category: 'vampire_copycat_risk', review_status: 'requires_review', source_links: expect.any(Array), next_review_step: expect.any(String) })]));
  });

  it('uses non-defamatory risk language', () => {
    const text = JSON.stringify(assembleRhChainCloneRadar()).toLowerCase();
    expect(text).toContain('suspected');
    expect(text).toContain('requires review');
    expect(text).not.toContain('is a scam');
    expect(text).not.toContain('proven scam');
    expect(text).not.toContain('is fraud');
    expect(text).not.toContain('proven fraud');
  });

  it('does not mutate review records or leak non-public fields while deriving patterns', () => {
    const review = {
      review_id: 'private-pattern-check', review_state: 'queued_for_manual_review' as const, submitted_at: '2026-07-15T00:00:00.000Z', updated_at: '2026-07-15T00:00:00.000Z', ticker: 'COPY', token_contract: 'unverified_contract_required', chain: 'Robinhood Chain', source_type: 'manual' as const,
      links: { x: 'https://example.com/public', website: null, liquidity: null, explorer: null }, evidence_summary: 'Reported copycat pattern.', missing_evidence: ['canonical contract'], risk_state: 'source_required' as const, signal_state: 'fresh_signal' as const, infopunks_verdict: 'Requires review.', reviewer_note: 'No conclusion.', next_step: 'Check public contract evidence.', source: { source_name: 'public test source', observed_at: '2026-07-15T00:00:00.000Z', updated_at: '2026-07-15T00:00:00.000Z', data_mode: 'manual' as const, confidence_level: 'low' as const }, private_contact: 'do-not-leak@example.com'
    };
    const original = JSON.stringify(review);
    const radar = assembleRhChainCloneRadar([review]);
    expect(JSON.stringify(review)).toBe(original);
    expect(radar.vampire_copycat_watch.every((pattern) => pattern.review_status === 'requires_review')).toBe(true);
    expect(JSON.stringify(radar)).not.toContain('do-not-leak@example.com');
  });

  it('serves the public clone radar API with safety caveats', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/clone-radar' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ title: 'Clone & Impersonator Radar', doctrine: expect.stringContaining('External data') }), disclaimer: expect.stringContaining('not definitive misconduct') }));
    } finally { await app.close(); }
  });
});
