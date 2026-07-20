import { describe, expect, it } from 'vitest';
import { InMemoryRhChainProjectClaimsStore, RhChainProjectClaimsService } from '../src/services/rhChainProjectClaimsService';

const primary = '0x1111111111111111111111111111111111111111';
const secondary = '0x2222222222222222222222222222222222222222';
const third = '0x3333333333333333333333333333333333333333';

function service() { let sequence = 0; return new RhChainProjectClaimsService(new InMemoryRhChainProjectClaimsStore(), () => new Date('2026-07-20T00:00:00.000Z'), () => `workflow-${++sequence}`); }
function submission(exactContract = primary, name = 'First project') { return { project_name: name, exact_contract: exactContract, contact: 'team@example.com', claim_category: 'product_live', claim_statement: 'The product is live.', supporting_evidence: ['https://example.com/docs'], disclosure_accepted: true, authority_to_submit_confirmed: true }; }
async function project(subject: RhChainProjectClaimsService, exactContract = primary, name = 'First project') { await subject.submit(submission(exactContract, name)); return (await subject.list({})).items.find((item) => item.project.primary_contract === exactContract)!; }

describe('RH Chain reviewer workflow hardening', () => {
  it('links and verifies a normalized primary contract, records audit history, and blocks duplicate active primary relationships', async () => {
    const subject = service(); const item = await project(subject); const projectId = item.project.project_id;
    const relationship = await subject.linkContract(projectId, { expected_version: 1, exact_contract: `0x${primary.slice(2).toUpperCase()}`, relationship_type: 'primary', evidence_references: [] }, 'desk');
    expect(relationship.exact_contract).toBe(primary);
    const verified = await subject.verifyContract(projectId, relationship.relationship_id, { expected_version: 1, evidence_references: [], reason: 'Explorer and project documentation match.' }, 'desk');
    expect(verified.verification_state).toBe('verified');
    await expect(subject.linkContract(projectId, { expected_version: 3, exact_contract: secondary, relationship_type: 'primary', evidence_references: [] }, 'desk')).rejects.toThrow('rh_chain_multiple_active_primary_contracts');
    expect((await subject.relationshipAudit(projectId, relationship.relationship_id)).map((item) => item.action)).toEqual(['contract_relationship_linked', 'contract_relationship_verified']);
  });

  it('blocks cross-project collisions and only permits rejected contracts through a new reviewed transition', async () => {
    const subject = service(); const first = await project(subject); const firstId = first.project.project_id;
    const relationship = await subject.linkContract(firstId, { expected_version: 1, exact_contract: secondary, relationship_type: 'token', evidence_references: [] }, 'desk');
    const other = await project(subject, third, 'Second project'); const otherId = other.project.project_id;
    await expect(subject.linkContract(otherId, { expected_version: 1, exact_contract: secondary, relationship_type: 'token', evidence_references: [] }, 'desk')).rejects.toThrow('rh_chain_contract_project_collision');
    const rejected = await subject.rejectContract(firstId, relationship.relationship_id, { expected_version: 1, reason: 'The submitted token address is unrelated.' }, 'desk');
    await expect(subject.verifyContract(firstId, rejected.relationship_id, { expected_version: rejected.version, evidence_references: [], reason: 'Cannot revive rejection.' }, 'desk')).rejects.toThrow('rh_chain_contract_invalid_transition');
    const replacement = await subject.linkContract(firstId, { expected_version: 3, exact_contract: secondary, relationship_type: 'token', evidence_references: [] }, 'desk');
    expect(replacement.verification_state).toBe('reviewed');
  });

  it('attaches reviewer evidence without changing submitted provenance or leaking private notes', async () => {
    const subject = service(); const item = await project(subject); const projectId = item.project.project_id; const claim = item.project_submitted_claims[0];
    const evidence = await subject.attachEvidence(projectId, { expected_version: claim.version, target_type: 'claim', target_id: claim.claim_id, source_class: 'independent_public_source', evidence_type: 'documentation', url: 'https://independent.example/evidence', evidence_statement: 'Independent documentation names the exact contract.', observed_at: '2026-07-20T00:00:00.000Z', fetched_at: '2026-07-20T00:00:00.000Z', freshness: 'fresh', confidence: 'high', public_summary: 'Independent documentation identifies the exact contract.', private_reviewer_notes: 'Contacted the source owner privately.', evidence_status: 'accessible' }, 'desk');
    expect(evidence.source_class).toBe('independent_public_source');
    const publicProject = await subject.project(projectId);
    expect(publicProject.public_evidence).toEqual(expect.arrayContaining([expect.objectContaining({ evidence_id: evidence.evidence_id, public_summary: 'Independent documentation identifies the exact contract.' })]));
    expect(JSON.stringify(publicProject)).not.toContain('Contacted the source owner privately.');
    expect((await subject.internalProject(projectId)).evidence.find((item) => item.evidence_id === evidence.evidence_id)?.reviewer_notes).toContain('privately');
    await expect(subject.attachEvidence(projectId, { expected_version: 2, target_type: 'claim', target_id: claim.claim_id, source_class: 'independent_public_source', evidence_type: 'bad', url: 'javascript:alert(1)', evidence_statement: 'Bad scheme', freshness: 'fresh', public_summary: 'Bad scheme.' }, 'desk')).rejects.toThrow();
  });

  it('does not let disputed evidence silently become corroborated and preserves supersession', async () => {
    const subject = service(); const item = await project(subject); const projectId = item.project.project_id; const claim = item.project_submitted_claims[0];
    const evidence = await subject.attachEvidence(projectId, { expected_version: 1, target_type: 'claim', target_id: claim.claim_id, source_class: 'onchain_observation', evidence_type: 'transaction', transaction_hash: '0xabc', evidence_statement: 'Exact transaction observed.', freshness: 'stale', public_summary: 'An exact transaction was observed.', evidence_status: 'disputed' }, 'desk');
    await expect(subject.transitionEvidence(projectId, evidence.evidence_id, { expected_version: 1, evidence_status: 'corroborated', reason: 'Cannot skip dispute review.' }, 'desk')).rejects.toThrow('rh_chain_evidence_invalid_transition');
    const replacement = await subject.attachEvidence(projectId, { expected_version: 2, target_type: 'claim', target_id: claim.claim_id, source_class: 'onchain_observation', evidence_type: 'transaction', transaction_hash: '0xdef', evidence_statement: 'Replacement exact transaction observed.', freshness: 'fresh', public_summary: 'Replacement transaction observed.', evidence_status: 'corroborated' }, 'desk');
    const superseded = await subject.supersedeEvidence(projectId, evidence.evidence_id, { expected_version: 1, replacement_evidence_id: replacement.evidence_id, reason: 'A fresher receipt replaced it.' }, 'desk');
    expect(superseded.evidence_status).toBe('superseded');
  });

  it('rejects verdict and receipt drafts permanently while retaining them privately', async () => {
    const subject = service(); const item = await project(subject); const projectId = item.project.project_id;
    const rejectedVerdict = await subject.createVerdict(projectId, { verdict_type: 'product_status', verdict_statement: 'Draft verdict.', confidence: 'low', methodology_version: 'reviewer-v1' }, 'desk');
    const verdictRejection = await subject.rejectVerdict(projectId, rejectedVerdict.verdict_id, { expected_version: 1, rejection_reason: 'Evidence is incomplete.' }, 'desk');
    await expect(subject.approveVerdict(projectId, verdictRejection.verdict_id, verdictRejection.version, 'desk')).rejects.toThrow('rh_chain_verdict_invalid_transition');
    const approvedVerdict = await subject.createVerdict(projectId, { verdict_type: 'product_status', verdict_statement: 'Second draft verdict.', confidence: 'medium', methodology_version: 'reviewer-v1' }, 'desk');
    const approved = await subject.approveVerdict(projectId, approvedVerdict.verdict_id, 1, 'desk');
    const receiptDraft = await subject.createReceiptDraft(projectId, approvedVerdict.verdict_id, { expected_version: approved.version, receipt_type: 'product_status' }, 'desk');
    const receiptRejection = await subject.rejectReceiptDraft(projectId, receiptDraft.receipt_id, { expected_version: 1, rejection_reason: 'A receipt needs stronger sourcing.' }, 'desk');
    await expect(subject.publishReceiptDraft(projectId, receiptRejection.receipt_id, { expected_version: receiptRejection.version }, 'desk')).rejects.toThrow('rh_chain_receipt_invalid_transition');
    const internal = await subject.internalProject(projectId);
    expect(internal.verdicts).toEqual(expect.arrayContaining([expect.objectContaining({ verdict_id: rejectedVerdict.verdict_id, verdict_state: 'rejected' })]));
    expect(internal.receipts).toEqual(expect.arrayContaining([expect.objectContaining({ receipt_id: receiptDraft.receipt_id, reviewer_publication_state: 'rejected' })]));
  });
});
