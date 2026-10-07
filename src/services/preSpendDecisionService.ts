import { z } from 'zod';
import {
  DecisionStateSchema,
  HumanValidationSubmissionSchema,
  PreSpendCheckRequestSchema,
  PreSpendCheckResponseSchema,
  PreSpendReceiptSchema,
  ProviderIntelligenceRecordSchema,
  RiskLevelSchema,
  RouteIntelligenceSchema,
  ServiceDossierSchema,
  ValidationStateSchema
} from '../schemas/entities';

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type DecisionState = z.infer<typeof DecisionStateSchema>;
export type ValidationState = z.infer<typeof ValidationStateSchema>;
export type RouteIntelligence = z.infer<typeof RouteIntelligenceSchema>;
export type ProviderIntelligenceRecord = z.infer<typeof ProviderIntelligenceRecordSchema>;
export type ServiceDossier = z.infer<typeof ServiceDossierSchema>;
export type PreSpendReceipt = z.infer<typeof PreSpendReceiptSchema>;
export type PreSpendCheckRequest = z.infer<typeof PreSpendCheckRequestSchema>;
export type PreSpendCheckResponse = z.infer<typeof PreSpendCheckResponseSchema>;
export type HumanValidationSubmission = z.infer<typeof HumanValidationSubmissionSchema>;

type DoNotUseWarning = PreSpendCheckResponse['do_not_use'][number];

export type DecisionContext = {
  route: RouteIntelligence;
  provider: ProviderIntelligenceRecord;
  service: ServiceDossier;
  receipts: PreSpendReceipt[];
};

type CandidateEvaluation = DecisionContext & {
  confidence_score: number;
  risk_level: RiskLevel;
  agent_readiness_score: number;
  rationale: string[];
  decision: DecisionState;
  requires_human_approval: boolean;
};

export type LinkedProofCheck = {
  check_id: string;
  decision_state: 'trust' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed';
  share_url: string;
  blockers: string[];
};

const NOW = () => new Date();
const DAY_MS = 24 * 60 * 60 * 1000;
const SENSITIVE_INTENT_PATTERN = /(claim|compliance|legal|medical|identity|intellectual[_ -]?property|ip[_ -]claim|ip[_ -]review)/i;
const DECISION_RANK: Record<DecisionState, number> = {
  approved: 0,
  approved_with_warning: 1,
  use_with_caution: 2,
  requires_human_approval: 3,
  do_not_use: 4
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ageInDays(iso: string | null) {
  if (!iso) return 999;
  return Math.max(0, Math.floor((NOW().getTime() - Date.parse(iso)) / DAY_MS));
}

type DecisionFacts = {
  latest_receipt_age_days: number;
  latest_success_age_days: number;
  successful_receipt_count: number;
  recent_successful_receipt_count: number;
  recent_human_validated_receipt_count: number;
  failed_receipt_count: number;
  repeated_failures: boolean;
  has_recent_successful_receipt: boolean;
  has_any_successful_receipt: boolean;
  stale_receipts: boolean;
  missing_validation: boolean;
  unresolved_disputes: boolean;
  has_known_blockers: boolean;
  settlement_mismatch: boolean;
  sensitive_intent: boolean;
  unknown_counterparty: boolean;
  required_confidence_met: boolean;
  budget_requires_human_approval: boolean;
  risk_tolerance_exceeded: boolean;
};

function summarizeDecisionFacts(request: PreSpendCheckRequest, context: DecisionContext, confidenceScore?: number, riskLevel?: RiskLevel): DecisionFacts {
  const { route, provider, receipts } = context;
  const latestReceipt = receipts.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0] ?? null;
  const successfulReceipts = receipts.filter((receipt) => receipt.status === 'succeeded');
  const recentSuccessfulReceipts = successfulReceipts.filter((receipt) => ageInDays(receipt.timestamp) <= 14);
  const recentHumanValidatedReceipts = receipts.filter((receipt) => receipt.validation_state === 'human_validated' && ageInDays(receipt.timestamp) <= 14);
  const latestSuccess = successfulReceipts.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0] ?? null;
  const hasKnownBlockers = route.known_blockers.length > 0;
  const unresolvedDisputes = provider.dispute_history.length > 0 || receipts.some((receipt) => receipt.validation_state === 'disputed' || receipt.validation_state === 'rejected');
  const staleReceipts = ageInDays(latestReceipt?.timestamp ?? null) > 14 || ageInDays(route.last_successful_run) > 14;
  const settlementMismatch = request.preferred_settlement !== route.payment_method;
  const sensitiveIntent = SENSITIVE_INTENT_PATTERN.test(request.intent);
  const unknownCounterparty = provider.agent_compatibility.length === 0;
  const budgetRequiresHumanApproval = request.budget >= 100;
  const resolvedRiskLevel = riskLevel ?? null;
  const resolvedConfidenceScore = confidenceScore ?? 0;
  const riskToleranceExceeded = resolvedRiskLevel === null
    ? false
    : (request.risk_tolerance === 'low' && (resolvedRiskLevel === 'medium' || resolvedRiskLevel === 'high' || resolvedRiskLevel === 'critical')) ||
      (request.risk_tolerance === 'medium' && resolvedRiskLevel === 'critical');

  return {
    latest_receipt_age_days: ageInDays(latestReceipt?.timestamp ?? null),
    latest_success_age_days: ageInDays(latestSuccess?.timestamp ?? null),
    successful_receipt_count: successfulReceipts.length,
    recent_successful_receipt_count: recentSuccessfulReceipts.length,
    recent_human_validated_receipt_count: recentHumanValidatedReceipts.length,
    failed_receipt_count: receipts.filter((receipt) => receipt.status !== 'succeeded').length,
    repeated_failures: receipts.filter((receipt) => receipt.status !== 'succeeded').length >= 2,
    has_recent_successful_receipt: recentSuccessfulReceipts.length > 0,
    has_any_successful_receipt: successfulReceipts.length > 0,
    stale_receipts: staleReceipts,
    missing_validation: recentHumanValidatedReceipts.length === 0 && provider.human_validation_status !== 'human_validated',
    unresolved_disputes: unresolvedDisputes,
    has_known_blockers: hasKnownBlockers,
    settlement_mismatch: settlementMismatch,
    sensitive_intent: sensitiveIntent,
    unknown_counterparty: unknownCounterparty,
    required_confidence_met: resolvedConfidenceScore >= request.required_confidence,
    budget_requires_human_approval: budgetRequiresHumanApproval,
    risk_tolerance_exceeded: riskToleranceExceeded
  };
}

function validationScore(receipts: PreSpendReceipt[], provider: ProviderIntelligenceRecord, service: ServiceDossier) {
  const weights: Record<ValidationState, number> = {
    unvalidated: 25,
    machine_checked: 55,
    human_validated: 90,
    disputed: 20,
    rejected: 0,
    stale: 18
  };
  const receiptAverage = receipts.length
    ? receipts.reduce((sum, receipt) => sum + weights[receipt.validation_state], 0) / receipts.length
    : 0;
  return Math.round((receiptAverage * 0.65) + (weights[provider.human_validation_status] * 0.2) + (weights[service.benchmark_readiness] * 0.15));
}

export function calculateConfidenceScore(_context: DecisionContext) {
  // Legacy fields are historical metadata, not independently authored confidence.
  // Authoritative subject scores are replayed through receiptAuthorityService.
  return 0;
}

export function calculateRiskLevel(request: PreSpendCheckRequest, context: DecisionContext): RiskLevel {
  const { route } = context;
  const facts = summarizeDecisionFacts(request, context);
  let risk = 0;

  if (request.budget >= 100) risk += 25;
  else if (request.budget >= 40) risk += 12;
  else if (request.budget >= 15) risk += 6;

  risk += Math.round((1 - route.success_rate) * 30);
  if (facts.unresolved_disputes) risk += 22;
  if (facts.stale_receipts) risk += 12;
  if (facts.missing_validation) risk += 10;
  if (facts.settlement_mismatch) risk += 12;
  if (facts.sensitive_intent) risk += 18;
  if (facts.unknown_counterparty) risk += 10;
  if (facts.has_known_blockers) risk += 8;

  if (risk >= 68) return 'critical';
  if (risk >= 46) return 'high';
  if (risk >= 24) return 'medium';
  return 'low';
}

export function calculateAgentReadinessScore(_request: PreSpendCheckRequest, _context: DecisionContext) {
  // Legacy intake cannot author a readiness/confidence projection.
  return 0;
}

function decisionFromScores(request: PreSpendCheckRequest, candidate: Omit<CandidateEvaluation, 'decision' | 'requires_human_approval'>, facts: DecisionFacts) {
  if (!facts.has_recent_successful_receipt && ((facts.unresolved_disputes && !facts.has_any_successful_receipt) || facts.repeated_failures)) {
    return { decision: 'do_not_use' as const, requires_human_approval: false };
  }
  if (facts.budget_requires_human_approval || (facts.sensitive_intent && facts.has_recent_successful_receipt)) {
    return { decision: 'requires_human_approval' as const, requires_human_approval: true };
  }
  // Legacy receipts cannot grant autonomous approval. Canonical judgments own that authority.
  return { decision: 'use_with_caution' as const, requires_human_approval: false };
}

function parseEstimatedCost(cost: string | null) {
  if (!cost) return Number.POSITIVE_INFINITY;
  const match = cost.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function buildRationale(request: PreSpendCheckRequest, candidate: CandidateEvaluation) {
  const facts = summarizeDecisionFacts(request, candidate, candidate.confidence_score, candidate.risk_level);
  const rationale: string[] = [];
  rationale.push(`Confidence score is ${candidate.confidence_score} against required confidence ${request.required_confidence}.`);
  rationale.push(`Risk level is ${candidate.risk_level} with risk tolerance ${request.risk_tolerance}.`);
  rationale.push(facts.has_recent_successful_receipt
    ? `Recent successful receipts exist (${facts.recent_successful_receipt_count} within 14 days).`
    : 'No recent successful receipt exists.');
  if (facts.recent_human_validated_receipt_count > 0) rationale.push(`Legacy human validation is intake only (${facts.recent_human_validated_receipt_count} recent validations).`);
  if (facts.stale_receipts) rationale.push('Stale receipts remain non-authoritative evidence.');
  if (facts.unresolved_disputes) rationale.push('Unresolved disputes increase risk.');
  if (facts.has_known_blockers) rationale.push(`Known blockers prevent silent approval: ${candidate.route.known_blockers.join('; ')}.`);
  if (facts.budget_requires_human_approval) rationale.push(`Budget ${request.budget} requires human approval.`);
  else if (candidate.requires_human_approval) rationale.push('Human approval is required because policy sensitivity or risk exceeds tolerance.');
  if (candidate.decision === 'do_not_use') rationale.push('No receipt, no trust: evidence is insufficient for autonomous spend.');
  return rationale;
}

export function makePreSpendDecision(
  request: PreSpendCheckRequest,
  candidates: DecisionContext[],
  linkedProofCheck: LinkedProofCheck | null = null
): PreSpendCheckResponse {
  const evaluated = candidates.map((context) => {
    const confidence_score = calculateConfidenceScore(context);
    const risk_level = calculateRiskLevel(request, context);
    const agent_readiness_score = calculateAgentReadinessScore(request, context);
    const facts = summarizeDecisionFacts(request, context, confidence_score, risk_level);
    const partial = {
      ...context,
      confidence_score,
      risk_level,
      agent_readiness_score,
      rationale: [] as string[],
      decision: 'do_not_use' as DecisionState,
      requires_human_approval: false
    };
    const decisionState = decisionFromScores(request, partial, facts);
    const candidate: CandidateEvaluation = {
      ...partial,
      ...decisionState
    };
    candidate.rationale = buildRationale(request, candidate);
    return candidate;
  }).sort((a, b) => {
    if (DECISION_RANK[a.decision] !== DECISION_RANK[b.decision]) return DECISION_RANK[a.decision] - DECISION_RANK[b.decision];
    if (b.confidence_score !== a.confidence_score) return b.confidence_score - a.confidence_score;
    return b.agent_readiness_score - a.agent_readiness_score;
  });

  const eligibleForCostSelection = evaluated.filter((candidate) =>
    candidate.confidence_score >= request.required_confidence &&
    (candidate.decision === 'approved' || candidate.decision === 'approved_with_warning')
  );
  const recommended = eligibleForCostSelection.length
    ? eligibleForCostSelection.sort((a, b) => {
        const confidenceDelta = b.confidence_score - a.confidence_score;
        if (Math.abs(confidenceDelta) > 10) return confidenceDelta;
        return parseEstimatedCost(a.route.estimated_cost) - parseEstimatedCost(b.route.estimated_cost);
      })[0]
    : evaluated[0];
  const safer_alternatives = evaluated
    .filter((candidate) => candidate.route.route_id !== recommended.route.route_id && candidate.decision !== 'do_not_use')
    .filter((candidate) => candidate.risk_level === 'low' || candidate.confidence_score > recommended.confidence_score - 10)
    .slice(0, 3)
    .map((candidate) => candidate.route.route_id);
  const do_not_use: DoNotUseWarning[] = evaluated
    .filter((candidate) => candidate.decision === 'do_not_use')
    .map((candidate) => ({
      provider: candidate.provider.provider_id,
      reason: candidate.rationale[candidate.rationale.length - 1] ?? 'insufficient evidence'
    }));

  const proofBlocksAutonomousApproval = Boolean(linkedProofCheck && linkedProofCheck.decision_state !== 'trust');
  const linkedDecision = proofBlocksAutonomousApproval && (recommended.decision === 'approved' || recommended.decision === 'approved_with_warning')
    ? 'requires_human_approval' as const
    : recommended.decision;
  const linkedRationale = linkedProofCheck
    ? [
        `Linked Proof Check ${linkedProofCheck.check_id} is ${linkedProofCheck.decision_state}.`,
        ...(proofBlocksAutonomousApproval ? ['Autonomous approval is blocked until the linked proof state is stronger.'] : []),
        ...linkedProofCheck.blockers.map((blocker) => `Proof blocker: ${blocker}`)
      ]
    : [];

  return {
    subject: request.subject_id ?? null,
    intent: request.intent,
    preferred_settlement: request.preferred_settlement,
    required_confidence: request.required_confidence,
    decision: linkedDecision,
    recommended_route: recommended.route.route_id,
    confidence_score: recommended.confidence_score,
    risk_level: recommended.risk_level,
    estimated_cost: recommended.route.estimated_cost,
    last_successful_run: recommended.route.last_successful_run,
    known_blockers: [...recommended.route.known_blockers, ...(linkedProofCheck?.blockers ?? [])],
    requires_human_approval: linkedDecision === 'requires_human_approval' || recommended.requires_human_approval,
    receipt_references: recommended.route.receipt_references,
    linked_check_id: linkedProofCheck?.check_id ?? request.linked_check_id ?? null,
    proof_check_reference: linkedProofCheck?.share_url ?? null,
    safer_alternatives,
    do_not_use,
    rationale: [...recommended.rationale, ...linkedRationale]
  };
}
