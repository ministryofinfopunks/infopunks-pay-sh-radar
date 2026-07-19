import { describe, expect, it } from 'vitest';
import { InMemoryRhChainProjectClaimsStore, RhChainProjectClaimsService } from '../src/services/rhChainProjectClaimsService';

const contract = '0x1111111111111111111111111111111111111111';
function service() { let n = 0; return new RhChainProjectClaimsService(new InMemoryRhChainProjectClaimsStore(), () => new Date('2026-07-19T00:00:00.000Z'), () => `id${++n}`); }
function packet() { return { project_name: 'Courtroom', chain: 'robinhood', exact_contract: contract, contact: 'team@example.com', claim_category: 'product_live', claim_statement: 'The protocol is live.', supporting_evidence: ['https://example.com/docs'], disclosure_accepted: true, authority_to_submit_confirmed: true }; }

describe('RH Chain project claims', () => {
  it('requires exact contract and disclosure, then queues without becoming reviewed truth', async () => {
    const s = service();
    await expect(s.submit({ ...packet(), disclosure_accepted: false })).rejects.toThrow();
    const result = await s.submit(packet());
    expect(result.status).toBe('queued_for_review');
    const page = await s.list({}); const project = page.items[0];
    expect(project.identity.status).toBe('submitted');
    expect(project.project_submitted_claims[0].claim_status).toBe('queued');
    expect(project.project_submitted_claims[0].submitter_type).toBe('project');
    expect(project.published_verdicts).toEqual([]);
  });
  it('preserves project-submitted evidence labels and publishes only approved verdicts', async () => {
    const s = service(); await s.submit(packet()); const project = (await s.list({})).items[0];
    const claim = project.project_submitted_claims[0];
    const reviewed = await s.reviewClaim(project.project.project_id, claim.claim_id, { expected_version: 1, claim_status: 'partially_supported', confidence: 'medium', reason: 'Only submitted material is currently available.' }, 'reviewer');
    expect(reviewed.claim_status).toBe('partially_supported');
    const verdict = await s.createVerdict(project.project.project_id, { verdict_type: 'product_status', verdict_statement: 'Evidence partially supports the claim.', partially_supported_claim_ids: [claim.claim_id], confidence: 'medium', methodology_version: 'test_v1' }, 'reviewer');
    await expect(s.publishReceipt(project.project.project_id, verdict.verdict_id, { expected_version: 1, receipt_type: 'product_status' }, 'reviewer')).rejects.toThrow();
    const approved = await s.approveVerdict(project.project.project_id, verdict.verdict_id, 1, 'reviewer');
    const receipt = await s.publishReceipt(project.project.project_id, verdict.verdict_id, { expected_version: approved.version, receipt_type: 'product_status' }, 'reviewer');
    expect(receipt.integrity_hash).toMatch(/^sha256:/);
    expect(receipt.not_financial_advice).toBe(true);
    await expect(s.publishReceipt(project.project.project_id, verdict.verdict_id, { expected_version: approved.version, receipt_type: 'product_status' }, 'reviewer')).rejects.toThrow();
  });
});
