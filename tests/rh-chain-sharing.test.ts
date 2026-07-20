import { describe, expect, it } from 'vitest';
import { getRhChainDailyReceipts } from '../src/data/rhChain';
import { buildRhChainDailyReceiptShare, buildRhChainProjectClaimShare } from '../src/services/rhChainShareService';
import { getNarrativeMetadataForPath } from '../src/shared/narrativeMetadata';
import { renderRhChainShareOgImage } from '../src/shared/narrativeOg';
import { buildRhChainShareCopy, createRhChainShareObject, getRhChainDistributionEligibility, selectRhChainDistributionCandidates, serializeRhChainShareObject } from '../src/shared/rhChainSharing';

function published() {
  return createRhChainShareObject({
    object_type: 'project_intelligence_receipt', canonical_url: '/rh-chain-signal-desk/intelligence-receipts/rhir_test', public_title: 'Test Receipt',
    deterministic_headline: 'Evidence partially supports the public claim.', principal_finding: 'Two public observations are attached.', material_caveat: 'One source remains stale.',
    observation_window: '2026-07-01 to 2026-07-19', captured_at: '2026-07-19T00:00:00.000Z', freshness: 'stale', confidence: 'medium', methodology_version: 'test.v1',
    source_summary: 'Published public evidence only.', receipt_id: 'rhir_test', integrity_hash: 'sha256:0123456789abcdef0123456789abcdef', publication_state: 'published', supersession_state: 'current', correction_link: null, replacement_receipt_link: null,
    identity: { project_id: 'rhproj_test', project_name: 'Test Project', asset_name: null, exact_contract: '0x1111111111111111111111111111111111111111' }, evidence_state: 'partially_supported', project_says: null, not_financial_advice: true
  });
}

describe('RH Chain unified sharing', () => {
  it('serializes the typed public model deterministically with a canonical URL and NFA label', () => {
    const share = published();
    expect(serializeRhChainShareObject(share)).toBe(serializeRhChainShareObject(share));
    expect(share.canonical_url).toBe('https://radar.infopunks.fun/rh-chain-signal-desk/intelligence-receipts/rhir_test');
    expect(share.not_financial_advice).toBe(true);
    expect(share.observation_window).toContain('2026-07');
  });

  it('uses deterministic templates that carry evidence state, confidence, caveat, and link without investment language', () => {
    const copy = buildRhChainShareCopy(published());
    expect(copy).toContain('EVIDENCE STATE: PARTIALLY SUPPORTED');
    expect(copy).toContain('CONFIDENCE: MEDIUM');
    expect(copy).toContain('OPEN QUESTION: One source remains stale.');
    expect(copy).toContain('RECEIPT: rhir_test');
    expect(copy).toContain('Not financial advice.');
    expect(copy.toLowerCase()).not.toMatch(/\b(buy|sell|guaranteed|100x)\b/);
  });

  it('excludes unpublished and rejected material at model validation before cards or pack eligibility', () => {
    const unsafe = { ...published(), publication_state: 'provisional' as const };
    expect(() => createRhChainShareObject(unsafe)).toThrow(/only public published/i);
    expect(getRhChainDistributionEligibility({ ...published(), confidence: 'unavailable' })).toEqual(expect.objectContaining({ eligible: false, reason: 'source_or_confidence_required' }));
  });

  it('requires correction and replacement links for a superseded receipt while preserving the original canonical URL', () => {
    const original = published();
    const superseded = createRhChainShareObject({ ...original, publication_state: 'superseded', supersession_state: 'superseded', correction_link: original.canonical_url, replacement_receipt_link: 'https://radar.infopunks.fun/rh-chain-signal-desk/intelligence-receipts/rhir_replacement' });
    expect(buildRhChainShareCopy(superseded)).toContain('CORRECTION: This receipt is superseded');
    expect(getRhChainDistributionEligibility(superseded)).toEqual({ eligible: true, reason: null, requires_supersession_label: true });
    expect(selectRhChainDistributionCandidates([superseded])[0]?.requires_supersession_label).toBe(true);
  });

  it('keeps project assertions and Infopunks verdicts distinct', () => {
    const share = buildRhChainProjectClaimShare({ claim_id: 'rhclaim_test', claim_text: 'The project says the protocol is live.', claim_status: 'partially_supported', confidence: 'medium', effective_period: { start: null, end: null }, exact_contract_context: '0x1111111111111111111111111111111111111111', project_id: 'rhproj_test', project_name: 'Test Project', canonical_url: '/rh-chain-signal-desk/projects/rhproj_test', verdict: 'Partially supported', caveat: 'Independent confirmation remains incomplete.' });
    expect(share).toBeTruthy();
    expect(buildRhChainShareCopy(share!)).toContain('PROJECT SAYS: The project says the protocol is live.');
    expect(buildRhChainShareCopy(share!)).toContain('INFOPUNKS VERDICT: Partially supported');
  });

  it('uses only public fields for cards and project-receipt metadata', () => {
    const svg = renderRhChainShareOgImage(published());
    expect(svg).toContain('Evidence partially supports the public claim.');
    expect(svg).not.toContain('reviewer_notes');
    expect(getNarrativeMetadataForPath('/rh-chain-signal-desk/intelligence-receipts/rhir_test')).toEqual(expect.objectContaining({
      canonicalPath: '/rh-chain-signal-desk/intelligence-receipts/rhir_test',
      ogImageUrl: 'https://radar.infopunks.fun/og/rh-chain/share/rhir_test.png',
      twitterCard: 'summary_large_image'
    }));
  });

  it('keeps Distribution Pack candidate-only and admits the existing reviewer-published Daily Receipt', () => {
    const daily = buildRhChainDailyReceiptShare(getRhChainDailyReceipts().latest_receipt);
    expect(getRhChainDistributionEligibility(daily).eligible).toBe(true);
    expect(selectRhChainDistributionCandidates([daily])).toHaveLength(1);
  });
});
