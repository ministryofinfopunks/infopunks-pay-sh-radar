import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { EvaluationReceipt, ExecutionReceipt, JudgmentReceipt } from '../schemas/receipts';
import { hashCanonical } from './receiptIntegrityService';

/** The first rubric is bound to the signed response commitment and the judged task. */
const TaskOutputV1 = z.object({ task_id: z.string().min(1).max(256), success: z.boolean(), complete: z.boolean() }).passthrough();
type Artifact = { encoding: 'base64'; bytes: string; source: 'signed_execution_response' };
export class EvaluationClassificationError extends Error {
  constructor(readonly code: string) { super(code); }
}
export function classifyTaskOutput(artifact: Artifact, execution: ExecutionReceipt, judgment: JudgmentReceipt,
  reviewer: string): { outcome: EvaluationReceipt['outcome']; classification: NonNullable<EvaluationReceipt['classification']> } {
  if (artifact.encoding !== 'base64' || artifact.source !== 'signed_execution_response' || !execution.verification ||
      execution.score_eligibility?.state !== 'qualifying' || execution.status === 'pending') throw new EvaluationClassificationError('artifact_source_unverified');
  const bytes = Buffer.from(artifact.bytes, 'base64');
  if (!bytes.length || bytes.length > 98304 || bytes.toString('base64') !== artifact.bytes) throw new EvaluationClassificationError('artifact_bytes_invalid');
  let output: z.infer<typeof TaskOutputV1>;
  try { output = TaskOutputV1.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
  catch { throw new EvaluationClassificationError('artifact_output_invalid'); }
  if (output.task_id !== judgment.subject_id || hashCanonical(output) !== execution.response_hash) throw new EvaluationClassificationError('artifact_response_commitment_mismatch');
  if ((!output.success && output.complete) || (execution.status === 'succeeded' && !output.success) ||
      (execution.status === 'failed' && output.success)) throw new EvaluationClassificationError('artifact_execution_conflict');
  const outcome = !output.success ? 'contradicted' : output.complete && execution.status === 'succeeded' ? 'confirmed' : 'weakened';
  return { outcome, classification: { version: 'task-output.v1', artifact_encoding: 'base64', artifact_bytes: artifact.bytes,
    artifact_sha256: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), source: artifact.source,
    response_hash: execution.response_hash, task_id: output.task_id, reviewer, challenge: 'public_receipt_replay' } };
}
export function verifyEvaluationClassification(evaluation: EvaluationReceipt, execution: ExecutionReceipt, judgment: JudgmentReceipt): boolean {
  if (!evaluation.classification || !evaluation.evaluator) return false;
  const c = evaluation.classification;
  try {
    const replay = classifyTaskOutput({ encoding: c.artifact_encoding, bytes: c.artifact_bytes, source: c.source }, execution, judgment, c.reviewer);
    return replay.outcome === evaluation.outcome && replay.classification.artifact_sha256 === c.artifact_sha256 &&
      replay.classification.response_hash === c.response_hash && replay.classification.task_id === c.task_id &&
      c.reviewer === evaluation.evaluator.id && c.challenge === replay.classification.challenge;
  } catch { return false; }
}
