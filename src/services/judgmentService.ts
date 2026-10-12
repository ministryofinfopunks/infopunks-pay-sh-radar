import type { PltrPreflightState } from './rhChainPltrPreflightService';
import { normalizeRhMarketEvidence, serviceDiagnosticRequest } from './judgmentEvidenceAdapters';
import { ECONOMIC_RAILS, EconomicNetworkSchema } from '../security/economicRails';
import type { JudgmentIssuer } from '../security/judgmentIssuer';
import { z } from 'zod';
import { createDerivedScoreService } from './derivedScoreService';
import { decodePaymentSignatureHeader } from '@x402/core/http';
import { PreSpendCheckRequestSchema, PreSpendCheckResponseSchema, type PreSpendCheckResponse } from '../schemas/entities';
import type { ObservationReceipt, JudgmentReceipt } from '../schemas/receipts';
import { type CanonicalJudgmentResponse } from '../schemas/preSpend';
import { hashCanonical, canonicalSerialize } from './receiptIntegrityService';
import { assessFrozenDecision, sealDecisionContext } from './decisionContextService';
import { createReceiptAuthorityService, type ReceiptAppendStore } from './receiptAuthorityService';
import type { JudgmentRequestRepository, JudgmentRequestRecord } from '../repositories/judgmentRequestRepository';
import { encodePaymentRequiredHeader, encodePaymentResponseHeader, type JudgmentPaymentGateway } from '../middleware/x402JudgmentMiddleware';

export class JudgmentError extends Error {
  constructor(readonly statusCode: number, readonly code: string) { super(code); }
}
export { adaptDecision } from './decisionContextService';
export const judgmentExpired = (receipt: JudgmentReceipt, at = new Date()) => Date.parse(receipt.valid_until) <= at.getTime();
export type JudgmentCheckResult = { status: number; headers: Record<string, string>; response: CanonicalJudgmentResponse; legacy: PreSpendCheckResponse };
export type JudgmentServiceOptions = {
  store: ReceiptAppendStore; journal: JudgmentRequestRepository;
  legacyCheck(input: z.infer<typeof PreSpendCheckRequestSchema>): PreSpendCheckResponse;
  observations(subject: string, intentHash: string): Promise<ObservationReceipt[]>;
  marketEvidence?(input: z.infer<typeof PreSpendCheckRequestSchema>): Promise<PltrPreflightState | null>;
  threshold: number; ttlMs: number; amount: string; gateway: JudgmentPaymentGateway | null;
  issuer?: JudgmentIssuer | null;
  /** Existing receipts replay unchanged; new production decisions cannot consume unreviewed history. */
  requireIndependentEvaluationReview?: boolean;
  onPaymentEvent?(event: 'challenge' | 'verified' | 'settled' | 'duplicate_prevented'): void;
  onEvidence?(freshness: { observations: number; fresh: number; stale: number }): void;
  now?: () => Date;
  onTiming?: (timing: { local_ms: number; payment_ms: number; total_ms: number }) => void;
};
export function createJudgmentService(options: JudgmentServiceOptions) {
  const now = options.now ?? (() => new Date());
  function paymentEvent(stage: 'challenge' | 'verified' | 'settled' | 'duplicate_prevented') {
    try { options.onPaymentEvent?.(stage); } catch { /* Telemetry cannot interrupt settlement journaling. */ }
  }
  const authority = createReceiptAuthorityService(options.store, options.threshold, options.issuer);
  const scores = createDerivedScoreService(options.store, options.threshold);
  async function complete(key: string, record: JudgmentRequestRecord) {
    if (record.decision_context) {
      if (!options.store.appendDecisionContext || record.response.decision_context_hash !== record.decision_context.context_hash)
        throw new JudgmentError(503, 'decision_context_unavailable');
      await options.store.appendDecisionContext(record.decision_context);
    }
    const result = record.response;
    const existing = await options.store.get('judgment', result.judgment_id) as JudgmentReceipt | null;
    const requirement = record.challenge.accepts.find(r => r.network === record.settlement!.network);
    const network = EconomicNetworkSchema.parse(record.settlement!.network);
    const rail = ECONOMIC_RAILS[network];
    if (!requirement || requirement.asset.toLowerCase() !== rail.token || result.cost.asset !== rail.asset) throw new JudgmentError(409, 'settlement_asset_mismatch');
    // Legacy receipts replay unchanged; new receipts commit the exact billing rail.
    const payment = existing ? existing.payment : { network, asset: rail.asset, token: rail.token, amount_atomic: requirement.amount, pay_to: requirement.payTo, payer: record.settlement!.payer ?? null, verification: 'facilitator_attested' as const };
    const receipt = await authority.appendJudgment({
      judgment_id: result.judgment_id, subject_type: record.subject_type, subject_id: record.subject_id,
      intent_hash: record.intent_hash, decision: result.decision, confidence: result.confidence,
      reasons: result.reasons, cited_observation_ids: result.cited_observations,
      issued_at: result.issued_at, valid_until: result.valid_until, payment_required: true,
      payment_receipt_ref: record.settlement!.transaction, charge: result.cost.amount, ...(payment ? { payment } : {}),
      ...(record.decision_context ? { decision_context_hash: record.decision_context.context_hash } : {})
    });
    record.response.receipt = receipt; record.state = 'complete'; await options.journal.save(key, record);
    return { status: 200, headers: { 'PAYMENT-RESPONSE': encodePaymentResponseHeader(record.settlement!) }, response: record.response, legacy: record.legacy };
  }
  // A caller-controlled agent_id / idempotency key is not authorization to read a paid receipt.
  // Replays must present the exact payment proof previously verified before settlement.
  // This does not re-settle or invoke the facilitator, preserving recovery after HTTP timeouts.
  function assertPaidReplayProof(record: JudgmentRequestRecord, signature?: string) {
    if (!signature) throw new JudgmentError(401, 'paid_judgment_replay_proof_required');
    try {
      const payment = decodePaymentSignatureHeader(signature);
      if (payment?.x402Version !== 2 || !record.payment_hash || hashCanonical(payment) !== record.payment_hash ||
        !record.settlement?.success || !record.settlement.transaction) throw new Error('invalid_replay_proof');
    } catch { throw new JudgmentError(403, 'paid_judgment_replay_proof_invalid'); }
  }
  // A caller-controlled agent_id / idempotency key is not authorization to read a paid receipt.
  // Replays must present the exact payment proof previously verified before settlement.
  function assertPaidReplayProof(record: JudgmentRequestRecord, signature?: string) {
    if (!signature) throw new JudgmentError(401, 'paid_judgment_replay_proof_required');
    try {
      const payment = decodePaymentSignatureHeader(signature);
      if (payment?.x402Version !== 2 || !record.payment_hash || hashCanonical(payment) !== record.payment_hash ||
        !record.settlement?.success || !record.settlement.transaction) throw new Error('invalid_replay_proof');
    } catch { throw new JudgmentError(403, 'paid_judgment_replay_proof_invalid'); }
  }
  return {
    async check(raw: unknown, suppliedKey?: string, signature?: string): Promise<JudgmentCheckResult> {
      const started = performance.now();
      let paymentMs = 0;
      async function paymentCall<T>(run: () => Promise<T>) {
        const begin = performance.now();
        try { return await run(); } finally { paymentMs += performance.now() - begin; }
      }
      try {
      // Do not silently discard an unsupported chain, policy or settlement selector.
      const input = PreSpendCheckRequestSchema.strict().parse(raw);
      if (suppliedKey !== undefined && !/^[A-Za-z0-9_.:-]{1,128}$/.test(suppliedKey)) throw new JudgmentError(400, 'invalid_idempotency_key');
      if (signature !== undefined && (signature.length === 0 || signature.length > 16384)) throw new JudgmentError(400, 'invalid_payment_signature_length');
      const requestHash = hashCanonical(input);
      const key = hashCanonical({ agent: input.agent_id, key: suppliedKey ?? requestHash });
      const priorFree = await options.journal.getFreeAttempt?.(key);
      if (priorFree) {
        if (priorFree.request_hash !== requestHash) throw new JudgmentError(409, 'idempotency_conflict');
        return { status: 200, headers: {}, response: priorFree.response, legacy: priorFree.legacy };
      }
      let record = await options.journal.get(key);
      if (record && record.request_hash !== requestHash) throw new JudgmentError(409, 'idempotency_conflict');
      if (record?.state === 'complete' || record?.state === 'settled') {
        assertPaidReplayProof(record, signature);
        return await complete(key, record);
      }
      if (record?.state === 'settling') throw new JudgmentError(409, 'payment_pending_reconciliation');
      if (!record) {
        const legacy = options.legacyCheck(serviceDiagnosticRequest(input));
        const subject = input.subject_id ?? legacy.recommended_route ?? '';
        const intentHash = hashCanonical(input);
        const at = now();
        const observations = subject ? await options.observations(subject, intentHash) : [];
        const fresh = observations.filter(o => o.freshness_expires_at && Date.parse(o.freshness_expires_at) > at.getTime()).length;
        try { options.onEvidence?.({ observations: observations.length, fresh, stale: observations.length - fresh }); } catch { /* Telemetry is not decision authority. */ }
        const policy = { engine_version: 'pre-spend-decision.v2' as const, threshold: options.threshold,
          veto_threshold: -10 as const, ttl_ms: options.ttlMs, amount: options.amount,
          asset: options.gateway?.asset === 'USDG' ? 'USDG' as const : 'USDC' as const };
        const railMismatch = input.judgment_context && input.judgment_context.settlement_network !== options.gateway?.requirements[0]?.network;
        const market = input.judgment_context?.policy.id === 'rh.market-inspection'
          ? normalizeRhMarketEvidence(input.judgment_context, await options.marketEvidence?.(input).catch(() => null) ?? null, at) : null;
        const preliminary = market
          ? { decision: 'insufficient_evidence' as const, confidence: 0, reasons: [...market.blockers, ...(railMismatch ? ['requested_settlement_network_unavailable'] : [])], valid_until: at.toISOString() }
          : railMismatch
          ? { decision: 'insufficient_evidence' as const, confidence: 0, reasons: ['requested_settlement_network_unavailable'], valid_until: at.toISOString() }
          : assessFrozenDecision(input, legacy, observations, null, at, policy);
        const boundary = preliminary.decision === 'insufficient_evidence' ? null : await options.store.acceptanceBoundary?.();
        if (preliminary.decision !== 'insufficient_evidence' && !boundary) throw new JudgmentError(503, 'acceptance_boundary_unavailable');
        const history = preliminary.decision === 'insufficient_evidence' ? null : await scores.project(observations[0].subject_type, subject, boundary!.sequence);
        if (options.requireIndependentEvaluationReview && history?.contributing_evaluation_ids.length)
          throw new JudgmentError(503, 'independent_evaluation_history_review_unavailable');
        const output = history ? assessFrozenDecision(input, legacy, observations, history, at, policy) : preliminary;
        const response: CanonicalJudgmentResponse = {
          judgment_id: 'judgment_' + key.slice(7), decision: output.decision, confidence: output.confidence, issued_at: at.toISOString(),
          valid_until: output.valid_until, reasons: output.reasons,
          cited_observations: output.decision === 'insufficient_evidence' ? [] : observations.map(o => o.observation_id),
          cost: { amount: output.decision === 'insufficient_evidence' ? '0' : options.amount, asset: policy.asset },
          payment_required: output.decision !== 'insufficient_evidence', receipt: null
        };
        if (output.decision === 'insufficient_evidence') {
          const attempt = await options.journal.recordFreeAttempt?.({ request_key: key, request_hash: requestHash,
            assessed_at: response.issued_at, response, legacy });
          return { status: 200, headers: {}, response: attempt?.response ?? response, legacy };
        }
        if (options.store.judgmentTrust?.requireSigned && !options.issuer) throw new JudgmentError(503, 'judgment_signing_unavailable');
        if (options.issuer) { try { options.issuer.assertCanSign(response.issued_at, response.valid_until); } catch { throw new JudgmentError(503, 'judgment_signing_unavailable'); } }
        if (!options.gateway) throw new JudgmentError(503, 'judgment_payment_unavailable');
        if (!history || !options.store.appendDecisionContext) throw new JudgmentError(503, 'decision_context_unavailable');
        const evaluationRefs = await Promise.all(history.contributing_evaluation_ids.map(async evaluationId => {
          const evaluation = await options.store.get('evaluation', evaluationId);
          if (!evaluation || !('evaluation_id' in evaluation)) throw new JudgmentError(503, 'decision_context_dependency_missing');
          return { evaluation_id: evaluation.evaluation_id, receipt_hash: evaluation.receipt_hash, score_delta: evaluation.score_delta };
        }));
        const frozenLegacy = PreSpendCheckResponseSchema.parse(legacy);
        const context = sealDecisionContext({ version: 'pre-spend-decision-context.v2', assessment_id: response.judgment_id,
          request: input, request_hash: requestHash, subject_type: observations[0].subject_type, subject_id: subject,
          intent_hash: intentHash, assessed_at: response.issued_at,
          observation_refs: observations.map(o => ({ observation_id: o.observation_id, receipt_hash: o.receipt_hash })),
          evaluation_refs: evaluationRefs, projection_boundary: { kind: 'accepted_sequence.v2', accepted_sequence: boundary!.sequence,
            accepted_at: boundary!.accepted_at, evaluation_refs_hash: hashCanonical(evaluationRefs), quote_assessed_at: response.issued_at },
          score_projection: history, legacy: frozenLegacy, legacy_hash: hashCanonical(frozenLegacy),
          policy, policy_hash: hashCanonical(policy), output });
        response.decision_context_hash = context.context_hash;
        paymentEvent('challenge');
        record = await options.journal.quote(key, { request_hash: requestHash, state: 'quoted', response, legacy,
          subject_type: observations[0].subject_type, subject_id: subject, intent_hash: intentHash,
          decision_context: context, challenge: await options.gateway.challenge() });
        if (record.request_hash !== requestHash) throw new JudgmentError(409, 'idempotency_conflict');
      }
      if (record.decision_context) {
        if (!options.store.appendDecisionContext || record.response.decision_context_hash !== record.decision_context.context_hash)
          throw new JudgmentError(503, 'decision_context_unavailable');
        await options.store.appendDecisionContext(record.decision_context);
      }
      if (Date.parse(record.response.valid_until) <= now().getTime()) throw new JudgmentError(409, 'judgment_quote_expired');
      if (!signature) return { status: 402, headers: { 'PAYMENT-REQUIRED': encodePaymentRequiredHeader(record.challenge) }, response: record.response, legacy: record.legacy };
      if (!options.gateway) throw new JudgmentError(503, 'judgment_payment_unavailable');
      let payment;
      let paymentHash: string;
      let accepted: string;
      try {
        payment = decodePaymentSignatureHeader(signature);
        // The official header decoder parses JSON; it does not validate its shape.
        if (!payment || typeof payment !== 'object' || Array.isArray(payment)) throw new Error('invalid_payment_payload');
        if (payment.x402Version !== 2) throw new JudgmentError(400, 'x402_v2_required');
        accepted = canonicalSerialize(payment.accepted);
        paymentHash = hashCanonical(payment);
      } catch (error) {
        if (error instanceof JudgmentError) throw error;
        throw new JudgmentError(400, 'invalid_payment_signature');
      }
      const requirement = record.challenge.accepts.find(r => canonicalSerialize(r) === accepted);
      if (!requirement) throw new JudgmentError(400, 'payment_requirements_mismatch');
      let verified = false;
      try { verified = await paymentCall(() => options.gateway!.verify(signature, requirement)); } catch { throw new JudgmentError(400, 'payment_verification_failed'); }
      if (!verified) throw new JudgmentError(400, 'invalid_payment_signature');
      if (Date.parse(record.response.valid_until) <= now().getTime()) throw new JudgmentError(409, 'judgment_quote_expired');
      if (options.store.judgmentTrust?.requireSigned && !options.issuer) throw new JudgmentError(503, 'judgment_signing_unavailable');
      if (options.issuer) { try { options.issuer.assertCanSign(record.response.issued_at, record.response.valid_until); } catch { throw new JudgmentError(503, 'judgment_signing_unavailable'); } }
      const paymentHash = hashCanonical(payment);
      paymentEvent('verified');
      if (!await options.journal.claim(key, paymentHash)) {
        paymentEvent('duplicate_prevented');
        throw new JudgmentError(409, 'payment_already_claimed');
      }
      record.state = 'settling'; record.payment_hash = paymentHash;
      // An ambiguous failure stays settling: a retry must never re-submit settlement.
      const settlement = await paymentCall(() => options.gateway!.settle(signature, requirement));
      if (!settlement.success || !settlement.transaction || settlement.network !== requirement.network) throw new JudgmentError(402, 'payment_settlement_failed');
      paymentEvent('settled');
      record.settlement = settlement; record.state = 'settled'; await options.journal.save(key, record);
      return await complete(key, record);
      } finally {
        const total = performance.now() - started;
        options.onTiming?.({ local_ms: Math.max(0, total - paymentMs), payment_ms: paymentMs, total_ms: total });
      }
    }
  };
}
