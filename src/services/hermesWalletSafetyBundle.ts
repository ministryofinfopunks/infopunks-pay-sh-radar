import { hermesDeskGeneratedAt } from '../data/hermesDesk';
import {
  createHermesPreSpendDecision,
  HERMES_PRE_SPEND_DECISION_EXAMPLE_INPUT,
  type HermesPreSpendDecisionInput
} from './hermesPreSpendDecision';
import { createHermesPolicyDecisionReceipt } from './hermesPolicyReceipt';
import { previewHermesPolicyReconciliation } from './hermesPolicyReconciliation';
import {
  checkHermesSpendPolicy,
  type HermesSpendPolicyCheckInput
} from './hermesSpendPolicy';
import { buildHermesWalletAuditTrail } from './hermesWalletAuditTrail';
import {
  buildHermesWalletRiskScore,
  type HermesWalletSafetyRating
} from './hermesWalletRiskScore';

export type HermesWalletSafetyDecision =
  | 'safe_to_spend'
  | 'test_spend_required'
  | 'manual_review_required'
  | 'block_spend'
  | 'insufficient_evidence';

export type HermesWalletSafetyCheckInput = HermesPreSpendDecisionInput & {
  policy_id?: string;
};

export type HermesWalletSafetyReference = {
  kind:
    | 'pre_spend_decision'
    | 'spend_policy_check'
    | 'policy_receipt'
    | 'reconciliation'
    | 'wallet_audit_trail'
    | 'wallet_risk_score'
    | 'receipt'
    | 'claim'
    | 'run'
    | 'reputation';
  id: string;
  summary: string;
};

export type HermesWalletFinalRecommendation = {
  decision: HermesWalletSafetyDecision;
  allowed: boolean;
  confidence: number;
  reason: string;
  required_action:
    | 'none'
    | 'run_test_spend'
    | 'manual_review_required'
    | 'block_spend'
    | 'request_more_evidence'
    | 'pause_wallet';
  safety_rating: HermesWalletSafetyRating;
  risk_score: number;
  top_risks: Array<any>;
  positive_controls: Array<any>;
  references: HermesWalletSafetyReference[];
};

export type HermesWalletSafetyCheckResult = {
  id: string;
  generated_at: string;
  input: HermesWalletSafetyCheckInput;
  pre_spend_decision: any;
  spend_policy_check: any;
  policy_receipt: any;
  reconciliation_preview: any;
  wallet_audit_trail: any;
  wallet_risk_score: any;
  final_recommendation: HermesWalletFinalRecommendation;
  summary: {
    decision: HermesWalletSafetyDecision;
    allowed: boolean;
    required_action: string;
    safety_rating: string;
    risk_score: number;
    policy_decision?: string;
    compliance_state?: string;
    audit_event_count?: number;
    top_risk_count: number;
    positive_control_count: number;
  };
};

export type HermesWalletSafetyBundleSummary = {
  generated_at: string;
  bundle_count: number;
  bundles: HermesWalletSafetyCheckResult[];
};

type RecommendationDraft = Pick<HermesWalletFinalRecommendation, 'decision' | 'allowed' | 'required_action'>;

function normalizeString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeInput(input: HermesWalletSafetyCheckInput): HermesWalletSafetyCheckInput {
  return {
    route_id: normalizeString(input.route_id),
    provider_id: normalizeString(input.provider_id),
    service_id: normalizeString(input.service_id),
    amount_usd: typeof input.amount_usd === 'number' && Number.isFinite(input.amount_usd) ? Number(input.amount_usd.toFixed(2)) : undefined,
    payment_rail: normalizeString(input.payment_rail),
    chain: normalizeString(input.chain),
    agent_type: normalizeString(input.agent_type),
    objective: normalizeString(input.objective),
    policy_id: normalizeString(input.policy_id)
  };
}

function stableId(input: HermesWalletSafetyCheckInput): string {
  const parts = [
    input.route_id ?? 'no_route',
    input.provider_id ?? 'no_provider',
    input.service_id ?? 'no_service',
    typeof input.amount_usd === 'number' ? input.amount_usd.toFixed(2) : 'no_amount',
    input.payment_rail ?? 'no_rail',
    input.chain ?? 'no_chain',
    input.agent_type ?? 'no_agent',
    input.objective ?? 'no_objective',
    input.policy_id ?? 'default_policy'
  ];
  return `hermes_wallet_safety_check_${parts.join('_').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

function clampUnit(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function createReference(kind: HermesWalletSafetyReference['kind'], id: string | undefined, summary: string): HermesWalletSafetyReference | null {
  if (!id) return null;
  return { kind, id, summary };
}

function dedupeReferences(references: HermesWalletSafetyReference[]): HermesWalletSafetyReference[] {
  const seen = new Set<string>();
  const output: HermesWalletSafetyReference[] = [];
  for (const reference of references) {
    const key = `${reference.kind}:${reference.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(reference);
  }
  return output;
}

function mapNestedReferenceKind(kind: string): HermesWalletSafetyReference['kind'] | null {
  if (kind === 'receipt') return 'receipt';
  if (kind === 'claim') return 'claim';
  if (kind === 'run') return 'run';
  if (kind === 'reputation_entry' || kind === 'reputation') return 'reputation';
  return null;
}

function collectReferences(
  preSpendDecision: any,
  spendPolicyCheck: any,
  policyReceipt: any,
  reconciliationPreview: any,
  walletAuditTrail: any,
  walletRiskScore: any
): HermesWalletSafetyReference[] {
  const references: Array<HermesWalletSafetyReference | null> = [
    createReference('pre_spend_decision', preSpendDecision?.id, `${preSpendDecision?.decision ?? 'unknown'}: ${preSpendDecision?.reason ?? 'No pre-spend reason available.'}`),
    createReference('spend_policy_check', spendPolicyCheck?.id, `${spendPolicyCheck?.decision ?? 'unknown'}: ${spendPolicyCheck?.reason ?? 'No policy reason available.'}`),
    createReference('policy_receipt', policyReceipt?.receipt?.id, policyReceipt?.receipt?.summary ?? 'Policy decision receipt.'),
    createReference('reconciliation', reconciliationPreview?.check_id, reconciliationPreview?.summary ?? 'Policy reconciliation preview.'),
    createReference('wallet_audit_trail', walletAuditTrail?.id, walletAuditTrail?.risk_posture?.summary ?? 'Wallet audit trail.'),
    createReference('wallet_risk_score', walletRiskScore?.id, walletRiskScore?.summary ?? 'Wallet risk score.')
  ];

  for (const item of [
    ...(preSpendDecision?.receipt_inputs ?? []),
    ...(preSpendDecision?.claim_inputs ?? []),
    ...(preSpendDecision?.run_inputs ?? []),
    ...(preSpendDecision?.reputation_inputs ?? []),
    ...(spendPolicyCheck?.references ?? []),
    ...(policyReceipt?.receipt?.references ?? []),
    ...((walletAuditTrail?.events ?? []).flatMap((event: any) => event.references ?? []))
  ]) {
    const kind = mapNestedReferenceKind(String(item.kind ?? ''));
    if (!kind || !item.id) continue;
    references.push(createReference(kind, String(item.id), String(item.summary ?? `${kind} reference ${item.id}.`)));
  }

  return dedupeReferences(references.filter((item): item is HermesWalletSafetyReference => Boolean(item)));
}

function recommendationDraft(preSpendDecision: any, spendPolicyCheck: any, walletRiskScore: any): RecommendationDraft {
  if (spendPolicyCheck?.decision === 'block') {
    return { decision: 'block_spend', allowed: false, required_action: 'block_spend' };
  }
  if (walletRiskScore?.safety_rating === 'blocked') {
    return { decision: 'block_spend', allowed: false, required_action: 'pause_wallet' };
  }
  if (spendPolicyCheck?.decision === 'require_manual_review') {
    return { decision: 'manual_review_required', allowed: false, required_action: 'manual_review_required' };
  }
  if (preSpendDecision?.decision === 'insufficient_evidence') {
    return { decision: 'insufficient_evidence', allowed: false, required_action: 'request_more_evidence' };
  }
  if (spendPolicyCheck?.decision === 'allow_with_test_spend') {
    return { decision: 'test_spend_required', allowed: true, required_action: 'run_test_spend' };
  }
  if (walletRiskScore?.safety_rating === 'risky') {
    return { decision: 'manual_review_required', allowed: false, required_action: 'manual_review_required' };
  }
  if (walletRiskScore?.safety_rating === 'watch') {
    return { decision: 'test_spend_required', allowed: true, required_action: 'run_test_spend' };
  }
  if (spendPolicyCheck?.decision === 'allow' && walletRiskScore?.safety_rating === 'safe') {
    return { decision: 'safe_to_spend', allowed: true, required_action: 'none' };
  }
  return { decision: 'manual_review_required', allowed: false, required_action: 'manual_review_required' };
}

function recommendationConfidence(preSpendDecision: any, spendPolicyCheck: any, walletAuditTrail: any, walletRiskScore: any): number {
  let confidence = typeof preSpendDecision?.confidence === 'number' ? preSpendDecision.confidence : 0.35;

  if (walletRiskScore?.safety_rating === 'blocked') confidence -= 0.25;
  else if (walletRiskScore?.safety_rating === 'risky') confidence -= 0.18;
  else if (walletRiskScore?.safety_rating === 'watch') confidence -= 0.08;
  else if (walletRiskScore?.safety_rating === 'unknown') confidence -= 0.2;

  confidence -= (spendPolicyCheck?.violations?.length ?? 0) * 0.08;
  confidence -= (spendPolicyCheck?.warnings?.length ?? 0) * 0.04;

  if ((walletAuditTrail?.summary?.event_count ?? 0) >= 8) confidence += 0.05;
  if ((walletRiskScore?.positive_controls?.length ?? 0) >= 3) confidence += 0.05;

  return clampUnit(confidence);
}

function recommendationReason(
  draft: RecommendationDraft,
  preSpendDecision: any,
  spendPolicyCheck: any,
  walletRiskScore: any
): string {
  return [
    `Pre-spend: ${preSpendDecision?.reason ?? 'No pre-spend reason available.'}`,
    `Policy: ${spendPolicyCheck?.reason ?? 'No policy reason available.'}`,
    `Risk score: ${walletRiskScore?.summary ?? 'No wallet risk score summary available.'}`,
    `Required action: ${draft.required_action}.`
  ].join(' ');
}

function createFinalRecommendation(
  preSpendDecision: any,
  spendPolicyCheck: any,
  walletAuditTrail: any,
  walletRiskScore: any,
  references: HermesWalletSafetyReference[]
): HermesWalletFinalRecommendation {
  const draft = recommendationDraft(preSpendDecision, spendPolicyCheck, walletRiskScore);
  return {
    ...draft,
    confidence: recommendationConfidence(preSpendDecision, spendPolicyCheck, walletAuditTrail, walletRiskScore),
    reason: recommendationReason(draft, preSpendDecision, spendPolicyCheck, walletRiskScore),
    safety_rating: walletRiskScore?.safety_rating ?? 'unknown',
    risk_score: typeof walletRiskScore?.risk_score === 'number' ? walletRiskScore.risk_score : 0,
    top_risks: walletRiskScore?.top_risks ?? [],
    positive_controls: walletRiskScore?.positive_controls ?? [],
    references
  };
}

export function createHermesWalletSafetyCheck(input: HermesWalletSafetyCheckInput): HermesWalletSafetyCheckResult {
  const normalizedInput = normalizeInput(input);
  const preSpendDecision = createHermesPreSpendDecision(normalizedInput);
  const spendPolicyCheck = checkHermesSpendPolicy(normalizedInput as HermesSpendPolicyCheckInput);
  const policyReceipt = createHermesPolicyDecisionReceipt(spendPolicyCheck);
  const reconciliationPreview = previewHermesPolicyReconciliation(spendPolicyCheck);
  // TODO: Future live mode should stitch the wallet audit trail directly from the supplied spend intent and generated check IDs.
  const walletAuditTrail = buildHermesWalletAuditTrail();
  // TODO: Future live mode should score the wallet from the spend-intent-specific audit trail instead of the canonical seeded trail.
  const walletRiskScore = buildHermesWalletRiskScore();
  const references = collectReferences(
    preSpendDecision,
    spendPolicyCheck,
    policyReceipt,
    reconciliationPreview,
    walletAuditTrail,
    walletRiskScore
  );
  const finalRecommendation = createFinalRecommendation(
    preSpendDecision,
    spendPolicyCheck,
    walletAuditTrail,
    walletRiskScore,
    references
  );

  return {
    id: stableId(normalizedInput),
    generated_at: spendPolicyCheck.generated_at ?? hermesDeskGeneratedAt,
    input: normalizedInput,
    pre_spend_decision: preSpendDecision,
    spend_policy_check: spendPolicyCheck,
    policy_receipt: policyReceipt,
    reconciliation_preview: reconciliationPreview,
    wallet_audit_trail: walletAuditTrail,
    wallet_risk_score: walletRiskScore,
    final_recommendation: finalRecommendation,
    summary: {
      decision: finalRecommendation.decision,
      allowed: finalRecommendation.allowed,
      required_action: finalRecommendation.required_action,
      safety_rating: finalRecommendation.safety_rating,
      risk_score: finalRecommendation.risk_score,
      policy_decision: spendPolicyCheck.decision,
      compliance_state: reconciliationPreview.compliance_state,
      audit_event_count: walletAuditTrail.summary?.event_count,
      top_risk_count: finalRecommendation.top_risks.length,
      positive_control_count: finalRecommendation.positive_controls.length
    }
  };
}

export function getHermesWalletSafetyExampleCheck(): HermesWalletSafetyCheckResult {
  return createHermesWalletSafetyCheck(HERMES_PRE_SPEND_DECISION_EXAMPLE_INPUT);
}
