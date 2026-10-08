import { ECONOMIC_RAILS, EconomicNetworkSchema } from '../security/economicRails';
import type { JudgmentIssuer } from '../security/judgmentIssuer';
import { z } from 'zod';
import { createDerivedScoreService } from './derivedScoreService';
import { decodePaymentSignatureHeader } from '@x402/core/http';
import { PreSpendCheckRequestSchema, type PreSpendCheckResponse } from '../schemas/entities';
import type { DecisionState } from './preSpendDecisionService';
import type { ObservationReceipt, JudgmentReceipt } from '../schemas/receipts';
import { JudgmentFactsSchema, type CanonicalDecision, type CanonicalJudgmentResponse } from '../schemas/preSpend';
import { hashCanonical, canonicalSerialize, verifyReceiptIntegrity } from './receiptIntegrityService';
import { createReceiptAuthorityService, type ReceiptAppendStore } from './receiptAuthorityService';
import type { JudgmentRequestRepository, JudgmentRequestRecord } from '../repositories/judgmentRequestRepository';
import { encodePaymentRequiredHeader, encodePaymentResponseHeader, type JudgmentPaymentGateway } from '../middleware/x402JudgmentMiddleware';
import type { JudgmentShadowSample } from './decisionsJudgmentShadow';

export class JudgmentError extends Error {
  constructor(readonly statusCode: number, readonly code: string) { super(code); }
}
/** Unknown/ambiguous legacy states never imply approval. Called only after evidence gates. */
export function adaptDecision(state: string, bounded: boolean, veto = false): CanonicalDecision {
  if (veto) return 'do_not_spend';
  const mapping: Record<DecisionState, CanonicalDecision> = {
    approved: 'proceed', approved_with_warning: bounded ? 'test_spend_first' : 'insufficient_evidence',
    use_with_caution: bounded ? 'test_spend_first' : 'insufficient_evidence',
    requires_human_approval: 'insufficient_evidence', do_not_use: 'do_not_spend'
  };
  return mapping[state as DecisionState] ?? 'insufficient_evidence';
}
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
  shadow?: (sample: JudgmentShadowSample) => Promise<void>;
};
export function createJudgmentService(options: JudgmentServiceOptions) {
  const now = options.now ?? (() => new Date());
  const authority = createReceiptAuthorityService(options.store, options.threshold, options.issuer);
  const scores = createDerivedScoreService(options.store, options.threshold);
  async function complete(key: string, record: JudgmentRequestRecord) {
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
      payment_receipt_ref: record.settlement!.transaction, charge: result.cost.amount, ...(payment ? { payment } : {})
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
        const facts = observations.map(o => JudgmentFactsSchema.safeParse(o.payload));
        const sufficient = observations.length > 0 && observations.every((o, i) =>
          verifyReceiptIntegrity('observation', o) && o.subject_id === subject && o.intent_hash === intentHash &&
          o.subject_type === observations[0].subject_type && o.evidence_state === 'sufficient' && o.evidence_refs.length > 0 &&
          o.source_type === 'reviewed_judgment_facts' && o.provenance.catalog_source === 'live' &&
          o.provenance.fixture !== true && Date.parse(o.ingested_at) <= at.getTime() &&
          o.freshness_expires_at !== null && Date.parse(o.freshness_expires_at) > at.getTime() && facts[i].success &&
          facts[i].data!.settlement === input.preferred_settlement && facts[i].data!.max_cost <= input.budget &&
          facts[i].data!.route_id === legacy.recommended_route);
        const policies = facts.flatMap(f => f.success ? [f.data] : []);
        const confidence = sufficient ? Math.min(...policies.map(f => f.confidence)) : 0;
        const veto = policies.some(f => f.deterministic_veto || f.decision_state === 'do_not_use');
        const bounded = sufficient && policies.every(f => f.bounded_test_allowed) && !legacy.requires_human_approval && legacy.known_blockers.length === 0;
        // The legacy engine deliberately cannot approve from community intake. Reviewed
        // policy facts may resolve caution, while its deterministic vetoes still win.
        const reviewedState = policies.length && policies.every(f => f.decision_state === policies[0].decision_state) ? policies[0].decision_state : 'unknown';
        const state = legacy.decision === 'use_with_caution' || legacy.decision === 'approved' ? reviewedState : legacy.decision;
        let decision = sufficient && (reviewedState !== 'unknown' || veto) ? adaptDecision(state, bounded, veto) : 'insufficient_evidence' as CanonicalDecision;
        if (legacy.decision === 'do_not_use' && reviewedState !== 'do_not_use' && !veto) decision = 'insufficient_evidence';
        if (decision === 'proceed' && (confidence < Math.max(options.threshold, input.required_confidence) || legacy.requires_human_approval || legacy.known_blockers.length > 0)) decision = 'insufficient_evidence';
        // Historical performance may veto spending only after the evidence gate passes.
        // Positive history never grants permission or fills missing evidence.
        const history = sufficient ? await scores.project(observations[0].subject_type, subject) : null;
        const historyReasons: string[] = [];
        if (history && history.score <= -10 && decision !== 'insufficient_evidence') {
          decision = 'do_not_spend';
          historyReasons.push('historical_execution_performance_degraded', 'derived_score_below_policy_threshold');
          if (history.outcome_counts.contradicted > 0) historyReasons.push('contradicted_evaluation_in_history');
        }
        const issued = at.toISOString();
        const valid = new Date(Math.min(at.getTime() + options.ttlMs, ...observations.filter(o => o.freshness_expires_at).map(o => Date.parse(o.freshness_expires_at!))));
        const response: CanonicalJudgmentResponse = {
          judgment_id: 'judgment_' + key.slice(7), decision, confidence, issued_at: issued,
          valid_until: valid.getTime() > at.getTime() ? valid.toISOString() : issued,
          reasons: sufficient ? [...policies.flatMap(f => f.reasons), ...historyReasons] : ['Required fresh, scoped, live evidence is missing.'],
          cited_observations: sufficient ? observations.map(o => o.observation_id) : [],
          cost: { amount: decision === 'insufficient_evidence' ? '0' : options.amount, asset: options.gateway?.asset ?? 'USDC' },
          payment_required: decision !== 'insufficient_evidence', receipt: null
        };
        // Shadow inference only sees reviewed, integrity-checked facts. Its result cannot
        // enter the policy, journal, settlement, or O/J/X/E authority path.
        if (sufficient && options.shadow) {
          const sample: JudgmentShadowSample = { request_hash: requestHash,
            observation_hashes: observations.map(o => o.receipt_hash), deterministic_decision: decision,
            facts: policies };
          try { void options.shadow(sample).catch(() => undefined); } catch { /* advisory only */ }
        }
        if (decision === 'insufficient_evidence') return { status: 200, headers: {}, response, legacy };
        if (options.store.judgmentTrust?.requireSigned && !options.issuer) throw new JudgmentError(503, 'judgment_signing_unavailable');
        if (options.issuer) { try { options.issuer.assertCanSign(issued, response.valid_until); } catch { throw new JudgmentError(503, 'judgment_signing_unavailable'); } }
        if (!options.gateway) throw new JudgmentError(503, 'judgment_payment_unavailable');
        record = await options.journal.quote(key, { request_hash: requestHash, state: 'quoted', response, legacy,
          subject_type: observations[0].subject_type, subject_id: subject, intent_hash: intentHash, challenge: await options.gateway.challenge() });
        if (record.request_hash !== requestHash) throw new JudgmentError(409, 'idempotency_conflict');
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
