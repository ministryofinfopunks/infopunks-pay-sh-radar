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
  threshold: number; ttlMs: number; amount: string; gateway: JudgmentPaymentGateway | null;
  issuer?: JudgmentIssuer | null;
  now?: () => Date;
  onTiming?: (timing: { local_ms: number; payment_ms: number; total_ms: number }) => void;
};
export function createJudgmentService(options: JudgmentServiceOptions) {
  const now = options.now ?? (() => new Date());
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
  return {
    async check(raw: unknown, suppliedKey?: string, signature?: string): Promise<JudgmentCheckResult> {
      const started = performance.now();
      let paymentMs = 0;
      async function paymentCall<T>(run: () => Promise<T>) {
        const begin = performance.now();
        try { return await run(); } finally { paymentMs += performance.now() - begin; }
      }
      try {
      const input = PreSpendCheckRequestSchema.parse(raw);
      if (suppliedKey && !/^[A-Za-z0-9_.:-]{1,128}$/.test(suppliedKey)) throw new JudgmentError(400, 'invalid_idempotency_key');
      if (signature && signature.length > 16384) throw new JudgmentError(400, 'payment_signature_too_large');
      const requestHash = hashCanonical(input);
      const key = hashCanonical({ agent: input.agent_id, key: suppliedKey ?? requestHash });
      const priorFree = await options.journal.getFreeAttempt?.(key);
      if (priorFree) {
        if (priorFree.request_hash !== requestHash) throw new JudgmentError(409, 'idempotency_conflict');
        return { status: 200, headers: {}, response: priorFree.response, legacy: priorFree.legacy };
      }
      let record = await options.journal.get(key);
      if (record && record.request_hash !== requestHash) throw new JudgmentError(409, 'idempotency_conflict');
      if (record?.state === 'complete' || record?.state === 'settled') return await complete(key, record);
      if (record?.state === 'settling') throw new JudgmentError(409, 'payment_pending_reconciliation');
      if (!record) {
        const legacy = options.legacyCheck(input);
        const subject = input.subject_id ?? legacy.recommended_route ?? '';
        const intentHash = hashCanonical(input);
        const at = now();
        const observations = subject ? await options.observations(subject, intentHash) : [];
        const policy = { engine_version: 'pre-spend-decision.v2' as const, threshold: options.threshold,
          veto_threshold: -10 as const, ttl_ms: options.ttlMs, amount: options.amount,
          asset: options.gateway?.asset === 'USDG' ? 'USDG' as const : 'USDC' as const };
        const preliminary = assessFrozenDecision(input, legacy, observations, null, at, policy);
        const boundary = preliminary.decision === 'insufficient_evidence' ? null : await options.store.acceptanceBoundary?.();
        if (preliminary.decision !== 'insufficient_evidence' && !boundary) throw new JudgmentError(503, 'acceptance_boundary_unavailable');
        const history = preliminary.decision === 'insufficient_evidence' ? null : await scores.project(observations[0].subject_type, subject, boundary!.sequence);
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
      try { payment = decodePaymentSignatureHeader(signature); } catch { throw new JudgmentError(400, 'invalid_payment_signature'); }
      if (payment.x402Version !== 2) throw new JudgmentError(400, 'x402_v2_required');
      const requirement = record.challenge.accepts.find(r => canonicalSerialize(r) === canonicalSerialize(payment.accepted));
      if (!requirement) throw new JudgmentError(400, 'payment_requirements_mismatch');
      let verified = false;
      try { verified = await paymentCall(() => options.gateway!.verify(signature, requirement)); } catch { throw new JudgmentError(400, 'payment_verification_failed'); }
      if (!verified) throw new JudgmentError(400, 'invalid_payment_signature');
      if (Date.parse(record.response.valid_until) <= now().getTime()) throw new JudgmentError(409, 'judgment_quote_expired');
      if (options.store.judgmentTrust?.requireSigned && !options.issuer) throw new JudgmentError(503, 'judgment_signing_unavailable');
      if (options.issuer) { try { options.issuer.assertCanSign(record.response.issued_at, record.response.valid_until); } catch { throw new JudgmentError(503, 'judgment_signing_unavailable'); } }
      const paymentHash = hashCanonical(payment);
      if (!await options.journal.claim(key, paymentHash)) throw new JudgmentError(409, 'payment_already_claimed');
      record.state = 'settling'; record.payment_hash = paymentHash;
      // An ambiguous failure stays settling: a retry must never re-submit settlement.
      const settlement = await paymentCall(() => options.gateway!.settle(signature, requirement));
      if (!settlement.success || !settlement.transaction || settlement.network !== requirement.network) throw new JudgmentError(402, 'payment_settlement_failed');
      record.settlement = settlement; record.state = 'settled'; await options.journal.save(key, record);
      return await complete(key, record);
      } finally {
        const total = performance.now() - started;
        options.onTiming?.({ local_ms: Math.max(0, total - paymentMs), payment_ms: paymentMs, total_ms: total });
      }
    }
  };
}
