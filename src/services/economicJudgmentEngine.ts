import { hashCanonical } from './receiptIntegrityService';
import { createReceiptAuthorityService, assertReceiptAuthority, type ReceiptAppendStore } from './receiptAuthorityService';
import type { JudgmentIssuer } from '../security/judgmentIssuer';
import type { JudgmentReceipt, ObservationReceipt } from '../schemas/receipts';
import { EconomicJobSchema, JevWitnessSchema, type EconomicJob, type EconomicPolicy, type DecisionEnvelope, type ExecutionAuthorization,
  type JevWitness, type EconomicOperation } from '../schemas/economicEngine';
import type { ExecutionAuthorizationIssuer } from '../security/executionAuthorization';
import type { EconomicEngineStore } from '../persistence/economicEngineStore';
import { buildDecisionEnvelope, requestJevWitness, type JevProvider } from './jevWitness';
import { judgeEconomicDecision, type JudgeResult } from './judge';

export class EconomicEngineError extends Error {
  constructor(readonly code: string, readonly statusCode = 409) { super(code); }
}
export interface DecisionAttempt {
  attempt_id: string; request_hash: string; principal_id: string; job: EconomicJob; envelope: DecisionEnvelope;
  created_at: string; status: 'evaluating' | 'assessed' | 'complete'; witness: JevWitness | null; result: JudgeResult | null;
  judgment: JudgmentReceipt | null; authorization: ExecutionAuthorization | null; reservation_id: string | null;
  assessed_at: string | null; valid_until: string | null; shadow: boolean;
}
export interface SpendReservation {
  reservation_id: string; attempt_id: string; principal_id: string; asset_id: string; profile_id: string;
  amount_atomic: string; actual_amount_atomic: string | null; created_at: string; expires_at: string;
  state: 'reserved' | 'authorized' | 'submitted' | 'finalized' | 'released';
}
export interface EconomicExecutor {
  profile_id: string;
  /** Mutable chain, oracle, recipient and transfer restrictions are checked here. */
  preflight(operation: EconomicOperation, authorization: ExecutionAuthorization, signal?: AbortSignal): Promise<boolean>;
  /** The adapter must enforce capability constraints at its actual side-effect boundary.
   * Never retry blindly: authorization_id is the rail's durable idempotency key. */
  execute(operation: EconomicOperation, authorization: ExecutionAuthorization, signal?: AbortSignal): Promise<ExecutorOutcome>;
  /** Independently query finalized settlement and task artifacts, including after a crash. */
  verify(operation: EconomicOperation, authorization: ExecutionAuthorization, outcome: ExecutorOutcome, signal?: AbortSignal): Promise<boolean>;
  reconcile?(operation: EconomicOperation, authorization: ExecutionAuthorization, signal?: AbortSignal): Promise<ExecutorOutcome | null>;
}
export interface ExecutorOutcome {
  finalized: true; settlement_ref: string; response_hash: string; status: 'succeeded' | 'failed' | 'partial';
  amount_atomic: string; fee_atomic: string; artifact_refs: string[];
}
export type EconomicEngineOptions = {
  store: EconomicEngineStore; receipts: ReceiptAppendStore; threshold: number; judgmentIssuer?: JudgmentIssuer | null;
  authorizationIssuer: ExecutionAuthorizationIssuer | null; provider: JevProvider | null; executors: EconomicExecutor[];
  currentPolicy(principal: string): Promise<EconomicPolicy | null>;
  shadow: boolean; allowAuthorizations: boolean; now?: () => Date; inferenceTimeoutMs?: number;
  executorTimeoutMs?: number;
  /** Host code may bypass inference for a prequalified unambiguous operation. */
  deterministicSelect?: (job: EconomicJob, observations: ObservationReceipt[]) => Promise<{ candidate_id: string; rule_id: string } | null>;
};
export function createEconomicJudgmentEngine(options: EconomicEngineOptions) {
  const now = options.now ?? (() => new Date());
  const profiles = new Map(options.executors.map(e => [e.profile_id, e]));
  if (profiles.size !== options.executors.length) throw new Error('duplicate_execution_profile');
  const authority = createReceiptAuthorityService(options.receipts, options.threshold, options.judgmentIssuer);
  async function resume(attempt: DecisionAttempt): Promise<DecisionAttempt> {
    if (attempt.status === 'complete') return attempt;
    if (attempt.status === 'evaluating' || !attempt.result || !attempt.assessed_at || !attempt.valid_until) throw new EconomicEngineError('decision_pending_reconciliation');
    const { result, job } = attempt;
    const assessedAt = attempt.assessed_at, validUntil = attempt.valid_until;
    let judgment: JudgmentReceipt | null = null;
    if (!attempt.shadow && result.evidence_ids.length && result.verdict !== 'UNPROVEN' && Date.parse(validUntil) > Date.parse(assessedAt)) {
      judgment = await authority.appendJudgment({ judgment_id: 'economic_judgment_' + attempt.attempt_id.slice(8),
        subject_type: job.subject_type, subject_id: job.subject_id, intent_hash: job.intent_hash, decision: result.decision,
        confidence: result.confidence, reasons: result.rules, cited_observation_ids: result.evidence_ids,
        issued_at: assessedAt, valid_until: validUntil, payment_required: false, payment_receipt_ref: null, charge: '0' });
    }
    const issuancePolicy = await options.currentPolicy(job.principal_id);
    return options.store.transaction(async tx => {
      const persisted = (await tx.get<DecisionAttempt>('attempt', attempt.attempt_id))!;
      if (persisted.status === 'complete') return persisted;
      let authorization: ExecutionAuthorization | null = null;
      if (attempt.reservation_id && judgment && result.candidate?.operation) {
        const reservation = await tx.get<SpendReservation>('reservation', attempt.reservation_id);
        const policy = issuancePolicy;
        if (!reservation || reservation.state !== 'reserved') throw new EconomicEngineError('reservation_invalid');
        if (!options.allowAuthorizations || !options.authorizationIssuer || !profiles.has(result.candidate.operation.profile_id)
          || await tx.get('revocation', 'profile/' + result.candidate.operation.profile_id)
          || !policy?.enabled || hashCanonical(policy) !== attempt.envelope.policy_hash || Date.parse(validUntil) <= now().getTime()) {
          reservation.state = 'released'; await tx.put('reservation', reservation.reservation_id, reservation);
        } else {
          authorization = options.authorizationIssuer.issue({ version: 'infopunks.execution-authorization.v1',
            authorization_id: 'authorization_' + attempt.attempt_id.slice(8), nonce: attempt.attempt_id,
            judgment_id: judgment.judgment_id, judgment_hash: judgment.receipt_hash, envelope_hash: hashCanonical(attempt.envelope),
            witness_hash: hashCanonical(attempt.witness), principal_id: job.principal_id, delegate_id: policy.delegate_id,
            audience: policy.audience, candidate_id: result.candidate.id, policy_hash: attempt.envelope.policy_hash,
            reservation_id: reservation.reservation_id, operation: result.candidate.operation,
            issued_at: assessedAt, valid_until: validUntil });
          await tx.put('authorization', authorization.payload.authorization_id, authorization);
          reservation.state = 'authorized'; await tx.put('reservation', reservation.reservation_id, reservation);
        }
      }
      persisted.judgment = judgment; persisted.authorization = authorization; persisted.status = 'complete';
      await tx.put('attempt', persisted.attempt_id, persisted);
      return persisted;
    });
  }
  return {
    options, profiles,
    async decide(raw: unknown, authenticatedPrincipal: string): Promise<DecisionAttempt> {
      const parsed = EconomicJobSchema.safeParse(raw);
      if (!parsed.success) throw new EconomicEngineError('invalid_economic_job', 400);
      const job = parsed.data;
      if (job.principal_id !== authenticatedPrincipal || job.policy.principal_id !== authenticatedPrincipal) throw new EconomicEngineError('principal_scope_denied', 403);
      if (job.policy.evidence_threshold < options.threshold) throw new EconomicEngineError('configured_evidence_threshold_required', 400);
      // Canonical round-trip also rejects undefined, non-JSON, and oversized states.
      const envelope = buildDecisionEnvelope(job, now()), requestHash = hashCanonical(job);
      const attemptId = 'attempt_' + hashCanonical({ principal: authenticatedPrincipal, request: job.request_id }).slice(7);
      const initial = await options.store.transaction(async tx => {
        const prior = await tx.get<DecisionAttempt>('attempt', attemptId);
        if (prior) {
          if (prior.request_hash !== requestHash) throw new EconomicEngineError('decision_idempotency_conflict');
          return { prior, created: false };
        }
        const priorState: DecisionAttempt = { attempt_id: attemptId, request_hash: requestHash, principal_id: authenticatedPrincipal,
          job, envelope, created_at: now().toISOString(), status: 'evaluating', witness: null, result: null,
          judgment: null, authorization: null, reservation_id: null, assessed_at: null, valid_until: null, shadow: options.shadow };
        await tx.put('attempt', attemptId, priorState);
        return { prior: priorState, created: true };
      });
      if (!initial.created) return resume(initial.prior);
      const observations = (await options.receipts.list('observation')) as ObservationReceipt[];
      const deterministic = options.deterministicSelect ? await options.deterministicSelect(structuredClone(job), structuredClone(observations)) : null;
      if (options.provider && !deterministic) await options.store.transaction(async tx => {
        await tx.put('cost', 'inference_attempt_' + attemptId, { entry_id: 'inference_attempt_' + attemptId, attempt_id: attemptId,
          at: initial.prior.created_at, asset_id: 'USD', category: 'inference', amount_atomic: null, settlement_ref: null, provenance: 'unknown', resolves_entry_id: null });
      });
      const witness = deterministic ? JevWitnessSchema.parse({ source: 'deterministic', envelope_hash: hashCanonical(envelope),
        provider_response_hash: null, returned_model_id: 'host-deterministic.v1',
        answer: { kind: 'deterministic', ...deterministic }, received_at: now().toISOString(), evidence_ids: envelope.evidence_ids, usage: null })
        : await requestJevWitness(job, envelope, options.provider, now, options.inferenceTimeoutMs);
      const assessedAt = now();
      let result = judgeEconomicDecision({ job, envelope, witness, observations, authenticatedPrincipal,
        enabledProfiles: [...profiles.keys()], now: assessedAt });
      const currentPolicy = await options.currentPolicy(job.principal_id);
      if (!currentPolicy || hashCanonical(currentPolicy) !== envelope.policy_hash) result = { ...result, verdict: 'UNPROVEN',
        decision: 'insufficient_evidence', rules: ['host_policy_binding_missing'], evidence_ids: [], confidence: 0, dissent: witness.answer.kind === 'choice' };
      const relevant = observations.filter(o => result.evidence_ids.includes(o.observation_id));
      const validUntil = new Date(Math.min(Date.parse(envelope.expires_at), ...relevant.map(o => Date.parse(o.freshness_expires_at!)))).toISOString();
      const assessed = await options.store.transaction(async tx => {
        const attempt = (await tx.get<DecisionAttempt>('attempt', attemptId))!;
        const op = result.candidate?.operation;
        if (op && await tx.get('revocation', 'profile/' + op.profile_id)) result = { ...result, verdict: 'BLOCK', decision: 'do_not_spend', rules: ['execution_profile_revoked'], dissent: true };
        if (!options.shadow && options.allowAuthorizations && op && ['ALLOW', 'DEGRADE'].includes(result.verdict)) {
          const reservations = await tx.list<SpendReservation>('reservation');
          for (const r of reservations) {
            if (['reserved', 'authorized'].includes(r.state) && Date.parse(r.expires_at) <= assessedAt.getTime()) {
              r.state = 'released'; await tx.put('reservation', r.reservation_id, r);
            }
          }
          const scope = reservations.filter(r => r.principal_id === job.principal_id && r.asset_id === op.asset_id && r.state !== 'released');
          const amount = BigInt(op.amount_atomic) + BigInt(op.max_fee_atomic);
          const spent = scope.reduce((sum, r) => sum + BigInt(r.actual_amount_atomic ?? r.amount_atomic), 0n);
          const recent = reservations.filter(r => r.principal_id === job.principal_id && r.state !== 'released'
            && Date.parse(r.created_at) > assessedAt.getTime() - job.policy.velocity_window_ms);
          if (spent + amount > BigInt(job.policy.budget_atomic) || recent.length >= job.policy.max_calls_per_window) {
            result = { ...result, verdict: 'BLOCK', decision: 'do_not_spend', rules: [spent + amount > BigInt(job.policy.budget_atomic) ? 'aggregate_budget_exceeded' : 'velocity_limit_exceeded'], dissent: true };
          } else {
            const reservation: SpendReservation = { reservation_id: 'reservation_' + attemptId.slice(8), attempt_id: attemptId,
              principal_id: job.principal_id, asset_id: op.asset_id, profile_id: op.profile_id, amount_atomic: amount.toString(), actual_amount_atomic: null,
              created_at: assessedAt.toISOString(), expires_at: validUntil, state: 'reserved' };
            await tx.put('reservation', reservation.reservation_id, reservation); attempt.reservation_id = reservation.reservation_id;
          }
        }
        attempt.witness = witness; attempt.result = result; attempt.assessed_at = assessedAt.toISOString(); attempt.valid_until = validUntil; attempt.status = 'assessed';
        await tx.put('attempt', attemptId, attempt);
        return attempt;
      });
      return resume(assessed);
    },
    async getAttempt(id: string) { return options.store.transaction(tx => tx.get<DecisionAttempt>('attempt', id)); },
    async recoverAssessment(id: string) {
      const attempt = await options.store.transaction(tx => tx.get<DecisionAttempt>('attempt', id));
      if (!attempt) throw new EconomicEngineError('attempt_not_found', 404);
      return resume(attempt);
    },
    async verifyAssessment(id: string) {
      const receipt = await options.receipts.get('judgment', id) as JudgmentReceipt | null;
      if (!receipt) return false;
      try { await assertReceiptAuthority('judgment', receipt, options.receipts, options.threshold); return true; } catch { return false; }
    }
  };
}
export type EconomicJudgmentEngine = ReturnType<typeof createEconomicJudgmentEngine>;
