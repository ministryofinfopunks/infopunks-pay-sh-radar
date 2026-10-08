import { describe, expect, it } from 'vitest';
import { MemoryCanonicalReceiptStore } from '../../src/persistence/canonicalReceiptStore';
import { createJudgmentIssuer } from '../../src/security/judgmentIssuer';
import { auditHistoricalReceipts, type HistoricalReceipts } from '../../src/services/decisionsEvidenceAudit';
import { createReceiptAuthorityService } from '../../src/services/receiptAuthorityService';
import { createEvaluationService } from '../../src/services/evaluationService';
import { sealReceipt } from '../../src/services/receiptIntegrityService';
import { evaluationInput, executionInput, judgmentInput, observationInput } from '../helpers/canonicalReceipts';
import { issuerFixture } from '../helpers/judgmentIssuer';

async function fixture(synthetic = false, verifiedClaim = false) {
  const issuer = createJudgmentIssuer(issuerFixture());
  const store = new MemoryCanonicalReceiptStore(80, issuer);
  const authority = createReceiptAuthorityService(store, 80, issuer);
  const observation = await authority.appendObservation({ ...observationInput(),
    ...(synthetic ? { provenance: { fixture: true } } : { source_type: 'reviewed_judgment_facts', provenance: { catalog_source: 'live' } }) });
  const judgment = await authority.appendJudgment(judgmentInput());
  const transaction = '0x' + 'a'.repeat(64);
  const execution = await authority.appendExecution({ ...executionInput(),
    ...(verifiedClaim ? {
      settlement_rail: 'base-usdc', settlement_ref: transaction,
      verification: { profile: 'base_usdc_external.v1' as const, submission_hash: observation.receipt_hash,
        settlement: { verified: true as const, provenance: 'base_rpc_finalized_usdc_transfer' as const,
          network: 'eip155:8453' as const, transaction_hash: transaction, block_hash: '0x' + 'b'.repeat(64),
          block_number: '100', signer: '0x' + '1'.repeat(40) },
        payload_hashes: 'externally_supplied_signed_claims' as const, status: 'externally_supplied_signed_claim' as const }
    } : {}) });
  const all = async (): Promise<HistoricalReceipts> => ({ observation: await store.list('observation'), judgment: await store.list('judgment'),
    execution: await store.list('execution'), evaluation: await store.list('evaluation') });
  return { issuer, store, observation, judgment, execution, all };
}

describe('Decisions historical evidence audit', () => {
  it('separates pending, unverified and synthetic executions without accepting receipt claims as external truth', async () => {
    const ready = await fixture();
    expect((await auditHistoricalReceipts(await ready.all(), { judgmentTrust: ready.issuer })).state_counts.pending_evaluation).toBe(1);
    await createEvaluationService(ready.store, 80, () => new Date('2026-10-07T00:00:04Z')).createEvaluation(evaluationInput());
    const unverified = await auditHistoricalReceipts(await ready.all(), { judgmentTrust: ready.issuer });
    expect(unverified.state_counts.unverified_execution).toBe(1);
    expect(unverified.state_counts.verified_complete).toBe(0);
    expect((await auditHistoricalReceipts(await ready.all())).state_counts.unverified_authority).toBe(1);
    const synthetic = await fixture(true);
    expect((await auditHistoricalReceipts(await synthetic.all(), { judgmentTrust: synthetic.issuer })).state_counts.synthetic).toBe(1);
  });

  it('requires separate positive execution and outcome verifiers even when a receipt claims settlement verification', async () => {
    const ready = await fixture(false, true);
    await createEvaluationService(ready.store, 80, () => new Date('2026-10-07T00:00:04Z')).createEvaluation(evaluationInput());
    const noCallbacks = await auditHistoricalReceipts(await ready.all(), { judgmentTrust: ready.issuer });
    expect(noCallbacks.state_counts.unverified_execution).toBe(1);
    const executionOnly = await auditHistoricalReceipts(await ready.all(), { judgmentTrust: ready.issuer,
      verifyExternalExecution: async () => ({ verified: true, evidence_refs: ['external://settlement'] }) });
    expect(executionOnly.state_counts.unverified_outcome).toBe(1);
    const both = await auditHistoricalReceipts(await ready.all(), { judgmentTrust: ready.issuer,
      verifyExternalExecution: async () => ({ verified: true, evidence_refs: ['external://settlement'] }),
      verifyIndependentOutcome: async () => ({ verified: true, evidence_refs: ['external://outcome'] }) });
    expect(both.state_counts.verified_complete).toBe(1);
  });

  it('rejects altered hashes and detects broken parent pointers', async () => {
    const ready = await fixture();
    const changed = await ready.all();
    changed.execution = [{ ...(changed.execution[0] as object), status: 'tampered' }];
    const integrity = await auditHistoricalReceipts(changed, { judgmentTrust: ready.issuer });
    expect(integrity.integrity_rejected_counts.execution).toBe(1);
    expect(integrity.executions).toHaveLength(0);
    const broken = await ready.all();
    broken.execution = [sealReceipt('execution', { ...(broken.execution[0] as object), parent_hash: 'sha256:' + '0'.repeat(64) })];
    const chain = await auditHistoricalReceipts(broken, { judgmentTrust: ready.issuer });
    expect(chain.state_counts.invalid_chain).toBe(1);
    expect(chain.executions[0].reason).toBe('parent_hash_mismatch');
  });
});
