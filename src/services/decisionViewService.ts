import { DecisionViewV1Schema, type DecisionViewV1 } from '../schemas/decisionView';
import { JudgmentReceiptSchema, ObservationReceiptSchema } from '../schemas/receipts';
import { DecisionContextSchema } from '../schemas/decisionContext';
import type { JudgmentIssuerTrust } from '../security/judgmentIssuer';
import { verifyReceiptChain, type ReceiptReader } from './receiptAuthorityService';
import { verifyDecisionContext } from './decisionContextService';

/** No generator/LLM participates in projection. The source of truth is the stored receipt. */
export function createDecisionViewService(reader: ReceiptReader, issuer: JudgmentIssuerTrust | null, threshold = 80) {
  return {
    async get(judgmentId: string, asOf: Date = new Date()): Promise<DecisionViewV1 | null> {
      const raw = await reader.get('judgment', judgmentId);
      if (!raw) return null;
      const parsed = JudgmentReceiptSchema.safeParse(raw);
      if (!parsed.success) throw new Error('canonical_judgment_invalid');
      const judgment = parsed.data;
      const observations = await Promise.all(judgment.cited_observation_ids.map(id => reader.get('observation', id)));
      const evidence = observations.map(row => ObservationReceiptSchema.safeParse(row));
      const validObservations = evidence.flatMap(row => row.success ? [row.data] : []);
      const missing = judgment.cited_observation_ids.filter((_id, index) => !evidence[index].success);
      const ancestryValid = await verifyReceiptChain('judgment', judgment, reader, threshold);
      let issuerValid = false;
      try { issuerValid = Boolean(issuer?.verify(judgment)); } catch { issuerValid = false; }
      const at = asOf.getTime();
      if (!Number.isFinite(at)) throw new Error('invalid_view_time');
      const withinWindow = Date.parse(judgment.issued_at) <= at && at < Date.parse(judgment.valid_until);
      const recordVerified = ancestryValid && issuerValid;
      let historyCommitment: DecisionViewV1['evidence']['history_commitment'];
      let contextVerified = judgment.schema_version === 'canonical-receipts.v1';
      if (judgment.schema_version === 'canonical-receipts.v1') {
        historyCommitment = { status: 'not_available_in_canonical_v1', hash: null };
      } else {
        const context = DecisionContextSchema.safeParse(await reader.getDecisionContext?.(judgment.judgment_id));
        contextVerified = recordVerified && context.success && context.data.context_hash === judgment.decision_context_hash
          && await verifyDecisionContext(context.data, judgment, reader);
        historyCommitment = context.success && contextVerified
          ? { status: 'committed_in_canonical_v2', hash: context.data.projection_boundary.evaluation_refs_hash }
          : { status: 'unavailable', hash: null };
      }
      const assessmentEligible = recordVerified && withinWindow && contextVerified
        && (judgment.decision === 'proceed' || judgment.decision === 'test_spend_first');
      const states = new Set(validObservations.map(row => row.evidence_state));
      const state = missing.length || states.size === 0 ? 'unavailable'
        : states.size > 1 ? 'mixed' : validObservations[0].evidence_state;
      return DecisionViewV1Schema.parse({
        schema_version: 'infopunks.decision-view.v1', generated_at: asOf.toISOString(),
        subject: { type: judgment.subject_type, id: judgment.subject_id, intent_hash: judgment.intent_hash },
        judgment: {
          id: judgment.judgment_id, decision: judgment.decision, confidence: judgment.confidence,
          reasons: judgment.reasons, receipt_hash: judgment.receipt_hash, policy_version: judgment.policy_version,
          issued_at: judgment.issued_at, valid_until: judgment.valid_until,
          assessment_charge: {
            required: judgment.payment_required, amount: judgment.charge, asset: judgment.payment?.asset ?? null
          }
        },
        evidence: {
          state, observations: validObservations.map(row => ({
            id: row.observation_id, receipt_hash: row.receipt_hash, state: row.evidence_state,
            source_type: row.source_type, observed_at: row.observed_at, freshness_expires_at: row.freshness_expires_at
          })), missing_observation_ids: missing,
          history_commitment: historyCommitment
        },
        verification: {
          ancestry_valid: ancestryValid, issuer_signature_valid: issuerValid, within_validity_window: withinWindow,
          assessment_eligible: assessmentEligible, record_verified: recordVerified
        },
        // Deliberately no approval/execution action. A judgment is NOT a capability.
        execution: { authorized: false, authority_requires: 'infopunks.execution-authorization.v1',
          permitted_ui_actions: ['inspect_receipt', 'copy_view'] },
        presentation: { catalog_version: 'decision-card.v1',
          components: ['decision_verdict', 'evidence_inspector', 'receipt_identity'] }
      });
    }
  };
}

export type DecisionViewService = ReturnType<typeof createDecisionViewService>;
