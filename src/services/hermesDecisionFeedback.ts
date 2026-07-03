import { hermesDeskGeneratedAt } from '../data/hermesDesk';
import type {
  HermesPreSpendDecision,
  HermesPreSpendDecisionInput,
  HermesPreSpendDecisionInputReference,
  HermesPreSpendDecisionState,
  HermesPreSpendRiskFactor
} from './hermesPreSpendDecision';

export type HermesDecisionOutcomeState =
  | 'successful'
  | 'failed'
  | 'partial'
  | 'blocked'
  | 'manual_review'
  | 'unknown';

export type HermesDecisionOutcomeImpact = {
  target_type: 'provider' | 'route' | 'service' | 'unknown';
  target_id?: string;
  direction: 'positive' | 'negative' | 'neutral' | 'watch';
  magnitude: number;
  summary: string;
  reputation_notes: string[];
};

export type HermesDecisionReceipt = {
  id: string;
  source: 'pre_spend_decision';
  source_decision_id: string;
  title: string;
  summary: string;
  decision: HermesPreSpendDecisionState;
  required_action: string;
  confidence: number;
  input: HermesPreSpendDecisionInput;
  risk_factors: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high';
    label: string;
    detail: string;
    source: string;
  }>;
  reputation_inputs: HermesPreSpendDecisionInputReference[];
  receipt_inputs: HermesPreSpendDecisionInputReference[];
  claim_inputs: HermesPreSpendDecisionInputReference[];
  run_inputs: HermesPreSpendDecisionInputReference[];
  receipt_kind: 'pre_spend_decision_receipt';
  created_at: string;
};

export type HermesDecisionOutcome = {
  id: string;
  source_decision_id: string;
  source_decision_receipt_id: string;
  outcome_state: HermesDecisionOutcomeState;
  outcome_summary: string;
  spend_happened: boolean;
  amount_usd?: number;
  observed_latency_ms?: number;
  error_code?: string;
  evidence_artifacts: Array<{
    id: string;
    label: string;
    kind: 'url' | 'api_response' | 'log' | 'screenshot' | 'note' | 'receipt';
    uri: string;
    summary: string;
  }>;
  impact: HermesDecisionOutcomeImpact;
  created_at: string;
};

export type HermesDecisionReceiptConversion = {
  decision_id: string;
  receipt: HermesDecisionReceipt;
  conversion: {
    status: 'converted' | 'already_converted' | 'failed';
    notes: string[];
  };
};

export type HermesDecisionFeedbackResult = {
  decision_id: string;
  receipt: HermesDecisionReceipt;
  outcome: HermesDecisionOutcome;
  feedback: {
    status: 'recorded' | 'preview' | 'failed';
    notes: string[];
  };
  reputation_feedback: HermesDecisionOutcomeImpact;
};

export type HermesDecisionOutcomeInput = {
  outcome_state?: HermesDecisionOutcomeState;
  outcome_summary?: string;
  spend_happened?: boolean;
  amount_usd?: number;
  observed_latency_ms?: number;
  error_code?: string;
  evidence_artifacts?: Array<Partial<HermesDecisionOutcome['evidence_artifacts'][number]>>;
};

function decisionSlug(decisionId: string): string {
  return decisionId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown_decision';
}

function clampUnit(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function normalizeArtifacts(
  decision: HermesPreSpendDecision,
  artifacts: HermesDecisionOutcomeInput['evidence_artifacts']
): HermesDecisionOutcome['evidence_artifacts'] {
  if (Array.isArray(artifacts) && artifacts.length) {
    return artifacts.map((artifact, index) => ({
      id: typeof artifact.id === 'string' && artifact.id.trim().length ? artifact.id : `artifact_${decisionSlug(decision.id)}_${index + 1}`,
      label: typeof artifact.label === 'string' && artifact.label.trim().length ? artifact.label : `Evidence artifact ${index + 1}`,
      kind: artifact.kind ?? 'note',
      uri: typeof artifact.uri === 'string' && artifact.uri.trim().length ? artifact.uri : `/v1/hermes/pre-spend-decision/${encodeURIComponent(decision.id)}/outcome`,
      summary: typeof artifact.summary === 'string' && artifact.summary.trim().length ? artifact.summary : 'Outcome evidence artifact.'
    }));
  }

  return [{
    id: `artifact_${decisionSlug(decision.id)}_note`,
    label: 'Mock outcome note',
    kind: 'note',
    uri: `/v1/hermes/pre-spend-decision/${encodeURIComponent(decision.id)}/outcome`,
    summary: 'Deterministic mock outcome artifact generated because no external evidence artifact was supplied.'
  }];
}

function defaultOutcomeState(decisionState: HermesPreSpendDecisionState): HermesDecisionOutcomeState {
  if (decisionState === 'proceed') return 'successful';
  if (decisionState === 'proceed_with_caution') return 'partial';
  if (decisionState === 'test_spend_first') return 'partial';
  if (decisionState === 'do_not_spend') return 'blocked';
  return 'manual_review';
}

function isOutcomeState(value: unknown): value is HermesDecisionOutcomeState {
  return value === 'successful' ||
    value === 'failed' ||
    value === 'partial' ||
    value === 'blocked' ||
    value === 'manual_review' ||
    value === 'unknown';
}

function targetForDecision(decision: HermesPreSpendDecision): Pick<HermesDecisionOutcomeImpact, 'target_type' | 'target_id'> {
  if (decision.input.provider_id) return { target_type: 'provider', target_id: decision.input.provider_id };
  if (decision.input.route_id) return { target_type: 'route', target_id: decision.input.route_id };
  if (decision.input.service_id) return { target_type: 'service', target_id: decision.input.service_id };
  return { target_type: 'unknown' };
}

function impactDirection(decision: HermesPreSpendDecision, outcomeState: HermesDecisionOutcomeState): HermesDecisionOutcomeImpact['direction'] {
  if (outcomeState === 'failed') return 'negative';
  if (outcomeState === 'partial') return 'watch';
  if (outcomeState === 'manual_review') return 'watch';
  if (outcomeState === 'unknown') return 'neutral';
  if (outcomeState === 'blocked') return decision.decision === 'do_not_spend' ? 'positive' : 'neutral';
  return 'positive';
}

function impactMagnitude(decision: HermesPreSpendDecision, outcome: Pick<HermesDecisionOutcome, 'outcome_state' | 'amount_usd'>): number {
  let magnitude = decision.confidence;
  if (typeof outcome.amount_usd === 'number' && outcome.amount_usd >= 100) magnitude += 0.05;
  if (typeof outcome.amount_usd === 'number' && outcome.amount_usd >= 1000) magnitude += 0.1;
  if (outcome.outcome_state === 'partial' || outcome.outcome_state === 'manual_review') magnitude -= 0.15;
  if (outcome.outcome_state === 'blocked' || outcome.outcome_state === 'unknown') magnitude -= 0.2;
  return clampUnit(magnitude);
}

function impactSummary(
  direction: HermesDecisionOutcomeImpact['direction'],
  decision: HermesPreSpendDecision,
  outcomeState: HermesDecisionOutcomeState,
  target: Pick<HermesDecisionOutcomeImpact, 'target_type' | 'target_id'>
): string {
  const targetLabel = target.target_id ? `${target.target_type}:${target.target_id}` : target.target_type;
  if (direction === 'positive' && outcomeState === 'blocked') {
    return `The decision prevented risk for ${targetLabel} and should reinforce future caution.`;
  }
  if (direction === 'positive') return `The recorded outcome supports future trust for ${targetLabel}.`;
  if (direction === 'negative') return `The recorded outcome should reduce confidence in ${targetLabel}.`;
  if (direction === 'watch') return `The recorded outcome keeps ${targetLabel} on watch until stronger evidence arrives.`;
  return `The recorded outcome adds neutral memory for ${targetLabel}.`;
}

function buildImpact(
  decision: HermesPreSpendDecision,
  outcome: Pick<HermesDecisionOutcome, 'outcome_state' | 'amount_usd' | 'spend_happened'>
): HermesDecisionOutcomeImpact {
  const target = targetForDecision(decision);
  const direction = impactDirection(decision, outcome.outcome_state);
  const magnitude = impactMagnitude(decision, outcome);

  return {
    ...target,
    direction,
    magnitude,
    summary: impactSummary(direction, decision, outcome.outcome_state, target),
    reputation_notes: [
      `decision_state=${decision.decision}`,
      `required_action=${decision.required_action}`,
      `outcome_state=${outcome.outcome_state}`,
      `spend_happened=${String(outcome.spend_happened)}`,
      `decision_confidence=${decision.confidence}`,
      direction === 'positive'
        ? 'Outcome supports future spend confidence.'
        : direction === 'negative'
          ? 'Outcome should reduce future spend confidence.'
          : direction === 'watch'
            ? 'Outcome requires additional evidence before future trust movement.'
            : 'Outcome records context without strong trust movement.'
    ]
  };
}

function defaultSpendHappened(decision: HermesPreSpendDecision): boolean {
  return decision.decision !== 'do_not_spend' && decision.decision !== 'insufficient_evidence';
}

function defaultOutcomeSummary(decision: HermesPreSpendDecision, outcomeState: HermesDecisionOutcomeState): string {
  if (outcomeState === 'successful') return `Spend outcome matched the ${decision.decision} recommendation within expected bounds.`;
  if (outcomeState === 'failed') return `Spend outcome failed after the ${decision.decision} recommendation and should feed back into reputation.`;
  if (outcomeState === 'partial') return `Spend outcome was partial after the ${decision.decision} recommendation and needs watch-state follow-up.`;
  if (outcomeState === 'blocked') return `Spend stayed blocked after the ${decision.decision} recommendation, preserving caution instead of forcing execution.`;
  if (outcomeState === 'manual_review') return `Decision remained in manual review because evidence stayed incomplete after the recommendation.`;
  return `Outcome remains unknown after the ${decision.decision} recommendation.`;
}

function copyRiskFactors(riskFactors: HermesPreSpendRiskFactor[]): HermesDecisionReceipt['risk_factors'] {
  return riskFactors.map((risk) => ({ ...risk }));
}

export function createHermesDecisionReceipt(decision: HermesPreSpendDecision): HermesDecisionReceiptConversion {
  const notes: string[] = ['Decision receipt conversion is deterministic and stateless.'];
  const evidenceInputCount = decision.reputation_inputs.length + decision.receipt_inputs.length + decision.claim_inputs.length + decision.run_inputs.length;
  if (evidenceInputCount === 0) notes.push('Decision has limited supporting evidence.');

  return {
    decision_id: decision.id,
    receipt: {
      id: `receipt_hermes_decision_${decisionSlug(decision.id)}`,
      source: 'pre_spend_decision',
      source_decision_id: decision.id,
      title: `Pre-Spend Decision Receipt: ${decision.decision}`,
      summary: `${decision.reason} Required action: ${decision.required_action}.`,
      decision: decision.decision,
      required_action: decision.required_action,
      confidence: decision.confidence,
      input: { ...decision.input },
      risk_factors: copyRiskFactors(decision.risk_factors),
      reputation_inputs: [...decision.reputation_inputs],
      receipt_inputs: [...decision.receipt_inputs],
      claim_inputs: [...decision.claim_inputs],
      run_inputs: [...decision.run_inputs],
      receipt_kind: 'pre_spend_decision_receipt',
      created_at: decision.generated_at ?? hermesDeskGeneratedAt
    },
    conversion: {
      status: 'converted',
      notes
    }
  };
}

export function recordHermesDecisionOutcome(
  decision: HermesPreSpendDecision,
  outcomeInput: HermesDecisionOutcomeInput = {}
): HermesDecisionFeedbackResult {
  const conversion = createHermesDecisionReceipt(decision);
  const outcomeState = isOutcomeState(outcomeInput.outcome_state) ? outcomeInput.outcome_state : defaultOutcomeState(decision.decision);
  const spendHappened = typeof outcomeInput.spend_happened === 'boolean' ? outcomeInput.spend_happened : defaultSpendHappened(decision);
  const amountUsd = typeof outcomeInput.amount_usd === 'number'
    ? Number(outcomeInput.amount_usd.toFixed(2))
    : typeof decision.input.amount_usd === 'number'
      ? decision.input.amount_usd
      : undefined;

  const outcomeBase = {
    outcome_state: outcomeState,
    amount_usd: amountUsd,
    spend_happened: spendHappened
  } satisfies Pick<HermesDecisionOutcome, 'outcome_state' | 'amount_usd' | 'spend_happened'>;

  const outcome: HermesDecisionOutcome = {
    id: `outcome_hermes_decision_${decisionSlug(decision.id)}_${outcomeState}`,
    source_decision_id: decision.id,
    source_decision_receipt_id: conversion.receipt.id,
    outcome_state: outcomeState,
    outcome_summary: typeof outcomeInput.outcome_summary === 'string' && outcomeInput.outcome_summary.trim().length
      ? outcomeInput.outcome_summary.trim()
      : defaultOutcomeSummary(decision, outcomeState),
    spend_happened: spendHappened,
    amount_usd: amountUsd,
    observed_latency_ms: typeof outcomeInput.observed_latency_ms === 'number' ? Math.max(0, Math.round(outcomeInput.observed_latency_ms)) : undefined,
    error_code: typeof outcomeInput.error_code === 'string' && outcomeInput.error_code.trim().length ? outcomeInput.error_code.trim() : undefined,
    evidence_artifacts: normalizeArtifacts(decision, outcomeInput.evidence_artifacts),
    impact: buildImpact(decision, outcomeBase),
    created_at: decision.generated_at ?? hermesDeskGeneratedAt
  };

  return {
    decision_id: decision.id,
    receipt: conversion.receipt,
    outcome,
    feedback: {
      status: 'recorded',
      notes: [
        'Decision feedback is deterministic and stateless.',
        'No persistent reputation, receipt, or claim record was mutated.'
      ]
    },
    reputation_feedback: outcome.impact
  };
}
