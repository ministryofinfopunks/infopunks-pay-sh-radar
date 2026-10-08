import { z } from 'zod';
import { ExecutionAuthorizationSchema, EconomicOperationSchema, AtomicAmountSchema, EngineId, type ExecutionAuthorization,
  type EconomicOperation, type EconomicPolicy } from '../schemas/economicEngine';
import { hashCanonical } from './receiptIntegrityService';
import { assertReceiptAuthority, createReceiptAuthorityService } from './receiptAuthorityService';
import type { ObservationReceipt, JudgmentReceipt, ExecutionReceipt } from '../schemas/receipts';
import { ReceiptHashSchema } from '../schemas/receipts/common';
import { EconomicEngineError, type EconomicJudgmentEngine, type DecisionAttempt, type SpendReservation, type ExecutorOutcome } from './economicJudgmentEngine';
import { judgeEconomicDecision } from './judge';

const OutcomeSchema = z.object({ finalized: z.literal(true), settlement_ref: EngineId, response_hash: ReceiptHashSchema,
  status: z.enum(['succeeded', 'failed', 'partial']), amount_atomic: AtomicAmountSchema, fee_atomic: AtomicAmountSchema,
  artifact_refs: z.array(z.string().min(1).max(256)).min(1).max(64) }).strict();
export interface EconomicExecutionRecord {
  execution_id: string; authorization_id: string; principal_id: string; profile_id: string; chain_id: string;
  operation_hash: string; submitted_at: string; state: 'submitted' | 'verified' | 'finalized';
  outcome: ExecutorOutcome | null; receipt: ExecutionReceipt | null; latency_ms: number;
}
const decimal = (amount: string, decimals: number) => {
  const padded = amount.padStart(decimals + 1, '0');
  return decimals ? padded.slice(0, -decimals) + '.' + padded.slice(-decimals) : padded;
};
export function createEconomicExecutionGate(engine: EconomicJudgmentEngine) {
  const { options, profiles } = engine;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.executorTimeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('invalid_executor_timeout');
  async function bounded<T>(work: (signal: AbortSignal) => Promise<T>) {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new EconomicEngineError('execution_provider_timeout', 503)); }, timeoutMs);
    })]); } finally { clearTimeout(timer); }
  }
  const authority = createReceiptAuthorityService(options.receipts, options.threshold, options.judgmentIssuer);
  async function binding(raw: unknown, operation: EconomicOperation, delegate: string, audience: string) {
    const parsed = ExecutionAuthorizationSchema.safeParse(raw);
    if (!parsed.success || !EconomicOperationSchema.safeParse(operation).success) throw new EconomicEngineError('invalid_execution_capability', 400);
    const auth = parsed.data, p = auth.payload;
    if (!options.allowAuthorizations || options.shadow || !options.authorizationIssuer?.verify(auth, now())) throw new EconomicEngineError('execution_capability_invalid', 403);
    if (p.delegate_id !== delegate || p.audience !== audience || hashCanonical(operation) !== hashCanonical(p.operation)) throw new EconomicEngineError('execution_capability_scope_denied', 403);
    const policy = await options.currentPolicy(p.principal_id);
    if (!policy?.enabled || hashCanonical(policy) !== p.policy_hash) throw new EconomicEngineError('execution_policy_revoked', 403);
    if (!profiles.has(p.operation.profile_id)) throw new EconomicEngineError('execution_profile_disabled', 503);
    const stored = await options.store.transaction(async tx => {
      if (await tx.get('revocation', p.authorization_id) || await tx.get('revocation', 'profile/' + p.operation.profile_id)) throw new EconomicEngineError('execution_capability_revoked', 403);
      return tx.get<ExecutionAuthorization>('authorization', p.authorization_id);
    });
    if (!stored || hashCanonical(stored) !== hashCanonical(auth)) throw new EconomicEngineError('execution_capability_not_issued', 403);
    const judgment = await options.receipts.get('judgment', p.judgment_id) as JudgmentReceipt | null;
    if (!judgment || judgment.receipt_hash !== p.judgment_hash) throw new EconomicEngineError('execution_assessment_missing', 403);
    await assertReceiptAuthority('judgment', judgment, options.receipts, options.threshold);
    if (!['proceed', 'test_spend_first'].includes(judgment.decision) || Date.parse(p.issued_at) < Date.parse(judgment.issued_at)
      || Date.parse(p.valid_until) > Date.parse(judgment.valid_until)) throw new EconomicEngineError('assessment_blocks_execution', 403);
    return { auth, policy };
  }
  async function finish(auth: ExecutionAuthorization, record: EconomicExecutionRecord): Promise<EconomicExecutionRecord> {
    if (!record.outcome) throw new EconomicEngineError('execution_pending_reconciliation');
    const p = auth.payload;
    const receipt = await authority.appendExecution({ execution_id: record.execution_id, judgment_id: p.judgment_id,
      executed_at: record.submitted_at, settlement_rail: p.operation.profile_id, settlement_ref: record.outcome.settlement_ref,
      request_hash: p.operation.arguments_hash, response_hash: record.outcome.response_hash, payload_signature: auth.signature,
      latency_ms: record.latency_ms, status: record.outcome.status,
      execution_authorization: { version: 'infopunks.execution-authorization.v1', authorization_id: p.authorization_id, payload_hash: auth.payload_hash },
      cost_amount: decimal(record.outcome.amount_atomic, p.operation.decimals), cost_asset: p.operation.asset_id,
      artifact_refs: record.outcome.artifact_refs });
    return options.store.transaction(async tx => {
      const current = (await tx.get<EconomicExecutionRecord>('execution', record.execution_id))!;
      if (current.state === 'finalized') return current;
      const reservation = await tx.get<SpendReservation>('reservation', p.reservation_id);
      if (!reservation || reservation.state !== 'submitted') throw new EconomicEngineError('execution_reservation_invalid');
      reservation.state = 'finalized'; reservation.actual_amount_atomic = (BigInt(record.outcome!.amount_atomic) + BigInt(record.outcome!.fee_atomic)).toString();
      await tx.put('reservation', reservation.reservation_id, reservation);
      current.state = 'finalized'; current.receipt = receipt; await tx.put('execution', current.execution_id, current);
      return current;
    });
  }
  async function verifyOutcome(auth: ExecutionAuthorization, record: EconomicExecutionRecord, raw: ExecutorOutcome): Promise<EconomicExecutionRecord> {
    const parsed = OutcomeSchema.safeParse(raw), executor = profiles.get(auth.payload.operation.profile_id);
    if (!parsed.success || !executor) throw new EconomicEngineError('execution_outcome_unverified');
    const outcome = parsed.data;
    if (BigInt(outcome.amount_atomic) > BigInt(auth.payload.operation.amount_atomic) || BigInt(outcome.fee_atomic) > BigInt(auth.payload.operation.max_fee_atomic)
      || !await bounded(signal => executor.verify(auth.payload.operation, auth, outcome, signal))) throw new EconomicEngineError('execution_outcome_unverified');
    const verified = await options.store.transaction(async tx => {
      const current = (await tx.get<EconomicExecutionRecord>('execution', record.execution_id))!;
      if (current.state !== 'submitted') {
        if (hashCanonical(current.outcome) !== hashCanonical(outcome)) throw new EconomicEngineError('execution_outcome_conflict');
        return current;
      }
      const duplicate = (await tx.list<EconomicExecutionRecord>('execution')).some(other => other.execution_id !== record.execution_id
        && other.chain_id === record.chain_id && other.outcome?.settlement_ref === outcome.settlement_ref);
      if (duplicate) throw new EconomicEngineError('execution_settlement_reused');
      current.outcome = outcome; current.state = 'verified';
      await tx.put('execution', current.execution_id, current);
      return current;
    });
    return finish(auth, verified);
  }
  return {
    async execute(raw: unknown, operation: EconomicOperation, delegate: string, audience: string) {
      const { auth } = await binding(raw, operation, delegate, audience);
      const p = auth.payload, executor = profiles.get(operation.profile_id)!;
      const executionId = 'economic_execution_' + p.authorization_id.slice(14);
      const existing = await options.store.transaction(tx => tx.get<EconomicExecutionRecord>('execution', executionId));
      if (existing) {
        if (existing.operation_hash !== hashCanonical(operation) || existing.authorization_id !== p.authorization_id) throw new EconomicEngineError('execution_idempotency_conflict');
        if (existing.state === 'finalized') return existing;
        if (existing.state === 'verified') return finish(auth, existing);
        throw new EconomicEngineError('execution_pending_reconciliation');
      }
      if (!await bounded(signal => executor.preflight(operation, auth, signal))) throw new EconomicEngineError('execution_live_constraints_failed', 403);
      // Refresh after preflight: expiry, revocation, and newer negative observations win.
      await binding(auth, operation, delegate, audience);
      const observations = await options.receipts.list('observation') as ObservationReceipt[];
      const policy = await options.currentPolicy(p.principal_id);
      if (!policy) throw new EconomicEngineError('execution_policy_revoked', 403);
      const submitted = await options.store.transaction(async tx => {
        const raced = await tx.get<EconomicExecutionRecord>('execution', executionId);
        if (raced) throw new EconomicEngineError('execution_already_claimed');
        if (await tx.get('revocation', p.authorization_id) || await tx.get('revocation', 'profile/' + operation.profile_id)) throw new EconomicEngineError('execution_capability_revoked', 403);
        if (!options.authorizationIssuer!.verify(auth, now()) || hashCanonical(policy) !== p.policy_hash) throw new EconomicEngineError('execution_capability_expired', 403);
        const reservation = await tx.get<SpendReservation>('reservation', p.reservation_id);
        if (!reservation || reservation.state !== 'authorized' || reservation.principal_id !== p.principal_id
          || Date.parse(reservation.expires_at) <= now().getTime()) throw new EconomicEngineError('execution_reservation_invalid');
        const attempt = await tx.get<DecisionAttempt>('attempt', reservation.attempt_id);
        if (!attempt?.witness || hashCanonical(attempt.envelope) !== p.envelope_hash || hashCanonical(attempt.witness) !== p.witness_hash) throw new EconomicEngineError('execution_attempt_binding_invalid');
        const verdict = judgeEconomicDecision({ job: attempt.job, envelope: attempt.envelope, witness: attempt.witness,
          observations, authenticatedPrincipal: p.principal_id, enabledProfiles: [...profiles.keys()], now: now() });
        if (!['ALLOW', 'DEGRADE'].includes(verdict.verdict) || verdict.candidate?.id !== p.candidate_id) throw new EconomicEngineError('execution_evidence_no_longer_qualified', 403);
        const record: EconomicExecutionRecord = { execution_id: executionId, authorization_id: p.authorization_id, principal_id: p.principal_id,
          profile_id: operation.profile_id, chain_id: operation.chain_id, operation_hash: hashCanonical(operation), submitted_at: now().toISOString(),
          state: 'submitted', outcome: null, receipt: null, latency_ms: 0 };
        reservation.state = 'submitted'; await tx.put('reservation', reservation.reservation_id, reservation);
        await tx.put('execution', executionId, record);
        return record;
      });
      const started = performance.now();
      let outcome: ExecutorOutcome;
      try { outcome = await bounded(signal => executor.execute(operation, auth, signal)); }
      catch { throw new EconomicEngineError('execution_pending_reconciliation'); }
      submitted.latency_ms = performance.now() - started;
      await options.store.transaction(async tx => {
        const current = (await tx.get<EconomicExecutionRecord>('execution', executionId))!;
        if (current.state === 'submitted') { current.latency_ms = submitted.latency_ms; await tx.put('execution', executionId, current); }
      });
      return verifyOutcome(auth, submitted, outcome);
    },
    async reconcile(authorizationId: string) {
      const auth = await options.store.transaction(tx => tx.get<ExecutionAuthorization>('authorization', authorizationId));
      if (!auth) throw new EconomicEngineError('authorization_not_found', 404);
      const record = await options.store.transaction(tx => tx.get<EconomicExecutionRecord>('execution', 'economic_execution_' + authorizationId.slice(14)));
      if (!record) throw new EconomicEngineError('execution_not_submitted', 404);
      if (record.state === 'finalized') return record;
      // Historical reconciliation does not submit an expired/revoked capability again.
      if (record.state === 'verified') return finish(auth, record);
      const executor = profiles.get(auth.payload.operation.profile_id);
      if (!executor?.reconcile) throw new EconomicEngineError('execution_reconciliation_unavailable', 503);
      const outcome = await bounded(signal => executor.reconcile!(auth.payload.operation, auth, signal));
      if (!outcome) throw new EconomicEngineError('execution_pending_reconciliation');
      return verifyOutcome(auth, record, outcome);
    },
    async inspect(id: string) { return options.store.transaction(tx => tx.get<EconomicExecutionRecord>('execution', id)); },
    async revoke(input: { authorization_id?: string; profile_id?: string; reason: string }) {
      if (Boolean(input.authorization_id) === Boolean(input.profile_id)) throw new EconomicEngineError('invalid_revocation_scope', 400);
      return options.store.transaction(async tx => {
        const id = input.authorization_id ?? 'profile/' + input.profile_id;
        const existing = await tx.get('revocation', id);
        if (existing) return existing;
        const capability = input.authorization_id ? await tx.get<ExecutionAuthorization>('authorization', input.authorization_id) : null;
        if (input.authorization_id && !capability) throw new EconomicEngineError('authorization_not_found', 404);
        const revocation = { id, revoked_at: now().toISOString(), reason: input.reason };
        await tx.put('revocation', id, revocation);
        for (const r of await tx.list<SpendReservation>('reservation')) {
          if ((capability ? r.reservation_id === capability.payload.reservation_id : r.profile_id === input.profile_id)
            && ['reserved', 'authorized'].includes(r.state)) { r.state = 'released'; await tx.put('reservation', r.reservation_id, r); }
        }
        return revocation;
      });
    }
  };
}
