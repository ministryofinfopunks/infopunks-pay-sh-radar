import { ECONOMIC_RAILS } from '../security/economicRails';
import { ExecuteProofRequestSchema, EvmExecutionProfileSchema, type ExecuteProofRequest } from '../schemas/executeProof';
import type { ExecutionReceipt, JudgmentReceipt, ObservationReceipt } from '../schemas/receipts';
import { JudgmentFactsSchema } from '../schemas/preSpend';
import { createReceiptAuthorityService, assertReceiptAuthority, type ReceiptAppendStore } from './receiptAuthorityService';
import { hashCanonical } from './receiptIntegrityService';
import { verifyExecutionPayloadSignature } from '../security/payloadSignatureVerifier';
import type { SettlementProofVerifier } from '../security/settlementProofVerifier';
export class ExecutionProofError extends Error {
  constructor(readonly statusCode: number, readonly code: string) { super(code); }
}
export function createExecutionProofService(options: { store: ReceiptAppendStore; threshold: number; verifier: SettlementProofVerifier | null; rhVerifier?: SettlementProofVerifier | null; now?: () => Date }) {
  const authority = createReceiptAuthorityService(options.store, options.threshold);
  const now = options.now ?? (() => new Date());
  return {
    async submit(raw: unknown): Promise<ExecutionReceipt> {
      const parsed = ExecuteProofRequestSchema.safeParse(raw);
      if (!parsed.success) throw new ExecutionProofError(400, 'invalid_execution_proof');
      // HTTP bodies are JSON; normalize absent optional properties for internal callers too.
      const proof: ExecuteProofRequest = JSON.parse(JSON.stringify(parsed.data));
      const submissionHash = hashCanonical(proof);
      const executionId = 'execution_' + hashCanonical(proof.idempotency_key).slice(7);
      const existing = await options.store.get('execution', executionId) as ExecutionReceipt | null;
      if (existing) {
        if (existing.verification?.submission_hash !== submissionHash) throw new ExecutionProofError(409, 'execution_idempotency_conflict');
        try { await assertReceiptAuthority('execution', existing, options.store, options.threshold); } catch { throw new ExecutionProofError(400, 'execution_receipt_integrity_invalid'); }
        return existing;
      }
      const parent = await options.store.get('judgment', proof.judgment_id) as JudgmentReceipt | null;
      if (!parent) throw new ExecutionProofError(404, 'judgment_not_found');
      try { await assertReceiptAuthority('judgment', parent, options.store, options.threshold); } catch { throw new ExecutionProofError(400, 'judgment_integrity_invalid'); }
      if (options.store.judgmentTrust?.requireSigned && !options.store.judgmentTrust.verify(parent)) throw new ExecutionProofError(403, 'signed_judgment_required');
      if (parent.decision !== 'proceed' && parent.decision !== 'test_spend_first') throw new ExecutionProofError(403, 'judgment_blocks_execution');
      const executed = Date.parse(proof.executed_at);
      if (executed < Date.parse(parent.issued_at) || executed >= Date.parse(parent.valid_until) || executed > now().getTime()) throw new ExecutionProofError(400, 'execution_outside_judgment_window');
      const observations = await Promise.all(parent.cited_observation_ids.map(id => options.store.get('observation', id) as Promise<ObservationReceipt | null>));
      const facts = observations.map(o => JudgmentFactsSchema.safeParse(o?.payload));
      if (!facts.length || facts.some(f => !f.success)) throw new ExecutionProofError(400, 'execution_constraints_missing');
      const policies = facts.map(f => f.data!);
      const profiles = policies.map(f => EvmExecutionProfileSchema.safeParse(f.execution));
      if (profiles.some(p => !p.success)) throw new ExecutionProofError(400, 'execution_proof_profile_unsupported');
      const profile = profiles[0].data!;
      const { parseUnits } = await import('viem');
      if (profiles.some(p => hashCanonical(p.data) !== hashCanonical(profile))) throw new ExecutionProofError(400, 'execution_proof_profile_ambiguous');
      if (proof.request_hash !== profile.request_hash || policies.some(p => parseUnits(proof.cost.amount, 6) > BigInt(Math.floor(p.max_cost * 1e6)) || p.asset !== proof.cost.asset)) throw new ExecutionProofError(400, 'execution_constraints_violated');
      if (parent.decision === 'test_spend_first' && policies.some(p => !p.bounded_test_allowed)) throw new ExecutionProofError(400, 'bounded_execution_policy_missing');
      if (!await verifyExecutionPayloadSignature(proof, parent, profile.signer)) throw new ExecutionProofError(401, 'invalid_execution_payload_signature');
      const network = profile.profile === 'rh_usdg_external.v1' ? 'eip155:4663' : 'eip155:8453';
      const rail = ECONOMIC_RAILS[network];
      if (proof.cost.asset !== rail.asset || (network === 'eip155:4663' ? !['rh-usdg', 'x402-rh'].includes(proof.settlement.rail) : !['base-usdc', 'x402-base', 'pay.sh-base'].includes(proof.settlement.rail))) throw new ExecutionProofError(400, 'execution_network_mismatch');
      const verifier = network === 'eip155:4663' ? options.rhVerifier : options.verifier;
      if (!verifier) throw new ExecutionProofError(503, 'settlement_proof_verifier_unavailable');
      let settlement;
      try { settlement = await verifier.verify(proof, parent, profile); } catch { throw new ExecutionProofError(400, 'invalid_settlement_proof'); }
      if (settlement.verified !== true || settlement.network !== network || settlement.provenance !== rail.provenance || settlement.transaction_hash.toLowerCase() !== proof.settlement.transaction_hash.toLowerCase() || settlement.signer.toLowerCase() !== profile.signer.toLowerCase()) throw new ExecutionProofError(400, 'invalid_settlement_proof');
      const input = {
        execution_id: executionId, judgment_id: parent.judgment_id, executed_at: proof.executed_at,
        settlement_rail: rail.rail, settlement_ref: settlement.transaction_hash.toLowerCase(), request_hash: proof.request_hash, response_hash: proof.response_hash,
        payload_signature: proof.payload_signature!, latency_ms: proof.latency_ms, status: proof.status, cost_amount: proof.cost.amount, cost_asset: proof.cost.asset,
        artifact_refs: proof.artifact_refs ?? [], verification: {
          profile: profile.profile, submission_hash: submissionHash,
          settlement, payload_hashes: 'externally_supplied_signed_claims' as const, status: 'externally_supplied_signed_claim' as const
        }, score_eligibility: { state: 'qualifying' as const, intake: 'external_proof_gateway.v1' as const,
          proof_profile: profile.profile, reason: 'finalized_settlement_and_payload_verified' }
      };
      try { return await authority.appendExecution(input); }
      catch (error) {
        const raced = await options.store.get('execution', executionId) as ExecutionReceipt | null;
        if (raced?.verification?.submission_hash === submissionHash) { await assertReceiptAuthority('execution', raced, options.store, options.threshold); return raced; }
        if ((error as { code?: string }).code === 'execution_authorization_already_used' || (error as {code?: string}).code === 'receipt_unique_conflict') throw new ExecutionProofError(409, 'execution_authorization_already_used');
        throw error;
      }
    }
  };
}
