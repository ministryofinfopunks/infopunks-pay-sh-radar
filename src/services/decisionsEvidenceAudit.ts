import { createHash } from 'node:crypto';
import type { JudgmentIssuerTrust } from '../security/judgmentIssuer';
import type { EvaluationReceipt, ExecutionReceipt, JudgmentReceipt, ObservationReceipt, ReceiptKind } from '../schemas/receipts';
import { assertReceiptAuthority, type ReceiptReader, type ReceiptRecord } from './receiptAuthorityService';
import { receiptSchemas, verifyReceiptIntegrity } from './receiptIntegrityService';

export const DECISIONS_EVIDENCE_AUDIT_VERSION = 'decisions-evidence-audit.v1';
export type HistoricalReceipts = Record<ReceiptKind, unknown[]>;
export type EvidenceVerification = { verified: boolean; evidence_refs: string[] };
export type HistoricalEvidenceVerifiers = {
  judgmentTrust?: JudgmentIssuerTrust;
  verifyExternalExecution?: (receipt: ExecutionReceipt) => Promise<EvidenceVerification>;
  verifyIndependentOutcome?: (receipt: EvaluationReceipt) => Promise<EvidenceVerification>;
};
export type ExecutionAuditState =
  | 'synthetic' | 'invalid_chain' | 'unverified_authority' | 'pending_evaluation' | 'unverified_execution'
  | 'unverified_outcome' | 'verified_complete';

type Parsed = { observation: ObservationReceipt[]; judgment: JudgmentReceipt[]; execution: ExecutionReceipt[]; evaluation: EvaluationReceipt[] };
const keys = ['observation', 'judgment', 'execution', 'evaluation'] as const;
const ids = { observation: 'observation_id', judgment: 'judgment_id', execution: 'execution_id', evaluation: 'evaluation_id' } as const;

function idHash(id: string) { return createHash('sha256').update(id).digest('hex'); }
function failureCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'authority_validation_failed';
}
function syntheticObservation(receipt: ObservationReceipt): boolean {
  const provenance = receipt.provenance;
  return provenance.fixture === true || provenance.synthetic === true || provenance.catalog_source === 'fixture' ||
    /^(test|fixture|synthetic)[_-]/i.test(receipt.source_type);
}

/** Pure, read-only audit. Receipt hashes and ancestry are checked; claims of external truth require separate verifiers. */
export async function auditHistoricalReceipts(raw: HistoricalReceipts, verifiers: HistoricalEvidenceVerifiers = {}) {
  const parsed = { observation: [], judgment: [], execution: [], evaluation: [] } as Parsed;
  const rejected: Record<ReceiptKind, number> = { observation: 0, judgment: 0, execution: 0, evaluation: 0 };
  const duplicateIds: Record<ReceiptKind, number> = { observation: 0, judgment: 0, execution: 0, evaluation: 0 };
  for (const kind of keys) {
    const seen = new Set<string>();
    for (const value of raw[kind]) {
      const result = receiptSchemas[kind].safeParse(value);
      if (!result.success || !verifyReceiptIntegrity(kind, result.data)) { rejected[kind]++; continue; }
      const id = String((result.data as unknown as Record<string, unknown>)[ids[kind]]);
      if (seen.has(id)) { duplicateIds[kind]++; continue; }
      seen.add(id);
      (parsed[kind] as ReceiptRecord[]).push(result.data as ReceiptRecord);
    }
  }
  const lookup = Object.fromEntries(keys.map(kind => [kind, new Map(parsed[kind].map(value => [String((value as unknown as Record<string, unknown>)[ids[kind]]), value]))])) as {
    [K in ReceiptKind]: Map<string, Parsed[K][number]>
  };
  const reader: ReceiptReader = {
    judgmentTrust: verifiers.judgmentTrust,
    get: async (kind, id) => (lookup[kind] as Map<string, ReceiptRecord>).get(id) ?? null
  };
  const evaluationsByExecution = new Map<string, EvaluationReceipt[]>();
  for (const evaluation of parsed.evaluation) {
    const list = evaluationsByExecution.get(evaluation.execution_id) ?? [];
    list.push(evaluation);
    evaluationsByExecution.set(evaluation.execution_id, list);
  }
  const executions: Array<{ execution_id_sha256: string; receipt_hash: string; state: ExecutionAuditState; reason: string;
    judgment_id_sha256: string; evaluation_id_sha256: string | null; observation_count: number }> = [];
  for (const execution of parsed.execution) {
    const judgment = lookup.judgment.get(execution.judgment_id);
    const observations = judgment?.cited_observation_ids.map(id => lookup.observation.get(id)) ?? [];
    const evaluations = evaluationsByExecution.get(execution.execution_id) ?? [];
    const record = { execution_id_sha256: idHash(execution.execution_id), receipt_hash: execution.receipt_hash,
      judgment_id_sha256: idHash(execution.judgment_id), evaluation_id_sha256: evaluations[0] ? idHash(evaluations[0].evaluation_id) : null,
      observation_count: observations.length };
    const add = (state: ExecutionAuditState, reason: string) => executions.push({ ...record, state, reason });
    if (!judgment || observations.some(value => !value) || evaluations.length > 1) { add('invalid_chain', 'missing_parent_or_duplicate_evaluation'); continue; }
    if (observations.some(value => syntheticObservation(value!))) { add('synthetic', 'synthetic_observation_provenance'); continue; }
    if (!verifiers.judgmentTrust || !judgment.issuer_signature) { add('unverified_authority', 'issuer_authentication_unverified'); continue; }
    try { await assertReceiptAuthority('execution', execution, reader, judgment.proceed_confidence_threshold); }
    catch (error) { add('invalid_chain', failureCode(error)); continue; }
    if (!evaluations.length) { add('pending_evaluation', 'evaluation_missing'); continue; }
    const evaluation = evaluations[0];
    try { await assertReceiptAuthority('evaluation', evaluation, reader, judgment.proceed_confidence_threshold); }
    catch (error) { add('invalid_chain', failureCode(error)); continue; }
    if (!execution.verification || !verifiers.verifyExternalExecution) { add('unverified_execution', 'independent_execution_proof_missing'); continue; }
    const executionProof = await verifiers.verifyExternalExecution(execution);
    if (!executionProof.verified || !executionProof.evidence_refs.length) { add('unverified_execution', 'independent_execution_proof_failed'); continue; }
    if (!verifiers.verifyIndependentOutcome) { add('unverified_outcome', 'independent_outcome_evidence_missing'); continue; }
    const outcomeProof = await verifiers.verifyIndependentOutcome(evaluation);
    if (!outcomeProof.verified || !outcomeProof.evidence_refs.length) { add('unverified_outcome', 'independent_outcome_evidence_failed'); continue; }
    add('verified_complete', 'independent_execution_and_outcome_verified');
  }
  const stateCounts = Object.fromEntries((['synthetic', 'invalid_chain', 'unverified_authority', 'pending_evaluation', 'unverified_execution', 'unverified_outcome', 'verified_complete'] as const)
    .map(state => [state, executions.filter(value => value.state === state).length]));
  return {
    schema_version: DECISIONS_EVIDENCE_AUDIT_VERSION,
    source_receipt_counts: Object.fromEntries(keys.map(kind => [kind, raw[kind].length])),
    integrity_valid_counts: Object.fromEntries(keys.map(kind => [kind, parsed[kind].length])),
    integrity_rejected_counts: rejected, duplicate_id_counts: duplicateIds,
    orphan_evaluations: parsed.evaluation.filter(value => !lookup.execution.has(value.execution_id)).length,
    executions, state_counts: stateCounts,
    limitations: [
      'Receipt integrity and causal authority do not independently prove settlement or outcome truth.',
      'A receipt claim of verified settlement is not an external proof recheck.',
      'Verified completion requires trusted issuer keys and independent execution and outcome verifiers.'
    ]
  };
}
