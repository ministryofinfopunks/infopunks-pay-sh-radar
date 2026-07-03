import { hermesDeskGeneratedAt, hermesRuns, type HermesDecisionState, type HermesRun, type HermesRunState } from '../data/hermesDesk';
import { convertHermesRunToReceipt } from './hermesReceiptConverter';
import { promoteHermesClaimCandidate, type HermesClaimReviewState } from './hermesClaimPromotion';
import {
  buildHermesReputationLedger,
  type HermesReputationLedgerEntry
} from './hermesReputationLedger';
import { createHermesPreSpendDecisionExample, type HermesPreSpendDecisionState } from './hermesPreSpendDecision';
import { createHermesDecisionReceipt, recordHermesDecisionOutcome, type HermesDecisionOutcomeState } from './hermesDecisionFeedback';

export type HermesMemoryLoopStageState = 'complete' | 'ready' | 'watch' | 'blocked' | 'missing';

export type HermesMemoryLoopStage = {
  id: string;
  label: string;
  primitive:
    | 'hermes_run'
    | 'agent_run_receipt'
    | 'claim_candidate'
    | 'reviewed_claim'
    | 'reputation_entry'
    | 'pre_spend_decision'
    | 'decision_receipt'
    | 'spend_outcome'
    | 'reputation_feedback';
  state: HermesMemoryLoopStageState;
  title: string;
  summary: string;
  source_id?: string;
  decision?: string;
  confidence?: number;
  evidence_count?: number;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
};

export type HermesMemoryLoopEdge = {
  from: string;
  to: string;
  label: string;
  summary: string;
};

export type HermesMemoryLoopSignal = {
  id: string;
  label: string;
  value: string | number;
  summary: string;
};

export type HermesMemoryLoop = {
  id: string;
  title: string;
  thesis: string;
  generated_at: string;
  source_run_id: string;
  stages: HermesMemoryLoopStage[];
  edges: HermesMemoryLoopEdge[];
  signals: HermesMemoryLoopSignal[];
  summary: {
    stage_count: number;
    complete_count: number;
    watch_count: number;
    blocked_count: number;
    missing_count: number;
    current_decision?: string;
    current_required_action?: string;
    reputation_state?: string;
    feedback_direction?: string;
  };
};

export type HermesMemoryLoopSummary = {
  generated_at: string;
  loop_count: number;
  loops: HermesMemoryLoop[];
};

const canonicalHermesRunId = 'hermes_pay_sh_route_pre_spend_check';

function canonicalRun(): HermesRun {
  const run = hermesRuns.find((item) => item.id === canonicalHermesRunId) ?? hermesRuns[0];
  if (!run) {
    throw new Error('hermes_memory_loop_seed_run_missing');
  }
  return run;
}

function isBlockingRunState(state: HermesRunState): boolean {
  return state === 'failed' || state === 'blocked';
}

function isWatchDecision(decision: HermesDecisionState | HermesPreSpendDecisionState): boolean {
  return decision === 'caution' || decision === 'unproven' || decision === 'proceed_with_caution' || decision === 'test_spend_first' || decision === 'insufficient_evidence';
}

function isBlockingDecision(decision: HermesDecisionState | HermesPreSpendDecisionState): boolean {
  return decision === 'do_not_use_yet' || decision === 'disputed' || decision === 'do_not_spend';
}

function stateFromRun(run: HermesRun): HermesMemoryLoopStageState {
  if (isBlockingRunState(run.state)) return 'blocked';
  if (run.decision === 'disputed' || run.decision === 'do_not_use_yet') return 'blocked';
  if (isWatchDecision(run.decision)) return 'watch';
  return run.artifacts.length > 0 ? 'complete' : 'missing';
}

function stateFromEvidence(evidenceCount: number, decision?: HermesDecisionState): HermesMemoryLoopStageState {
  if (decision && isBlockingDecision(decision)) return 'blocked';
  if (decision && isWatchDecision(decision)) return evidenceCount > 0 ? 'watch' : 'missing';
  return evidenceCount > 0 ? 'complete' : 'missing';
}

function stateFromReview(reviewState: HermesClaimReviewState, evidenceCount: number): HermesMemoryLoopStageState {
  if (reviewState === 'rejected' || reviewState === 'disputed') return 'blocked';
  if (reviewState === 'needs_more_evidence' || reviewState === 'candidate') return evidenceCount > 0 ? 'watch' : 'missing';
  return evidenceCount > 0 ? 'complete' : 'missing';
}

function stateFromReputation(entry?: HermesReputationLedgerEntry): HermesMemoryLoopStageState {
  if (!entry) return 'missing';
  if (entry.current_state === 'degraded' || entry.current_state === 'disputed') return 'blocked';
  if (entry.current_state === 'watchlist' || entry.current_state === 'unproven') return 'watch';
  return entry.decision_history.length > 0 ? 'complete' : 'missing';
}

function stateFromDecision(decision: HermesPreSpendDecisionState): HermesMemoryLoopStageState {
  if (decision === 'do_not_spend') return 'blocked';
  if (isWatchDecision(decision)) return 'watch';
  return 'ready';
}

function stateFromOutcome(outcomeState: HermesDecisionOutcomeState): HermesMemoryLoopStageState {
  if (outcomeState === 'failed' || outcomeState === 'blocked') return 'blocked';
  if (outcomeState === 'partial' || outcomeState === 'manual_review' || outcomeState === 'unknown') return 'watch';
  return 'complete';
}

function stateFromFeedback(direction: string): HermesMemoryLoopStageState {
  if (direction === 'negative') return 'blocked';
  if (direction === 'watch' || direction === 'neutral') return 'watch';
  return 'complete';
}

function matchingReputationEntry(entries: HermesReputationLedgerEntry[], targetType?: string, targetId?: string): HermesReputationLedgerEntry | undefined {
  if (!targetType || !targetId) return undefined;
  return entries.find((entry) => entry.target_type === targetType && entry.target_id === targetId);
}

function countsFor(stages: HermesMemoryLoopStage[]) {
  return {
    complete_count: stages.filter((stage) => stage.state === 'complete' || stage.state === 'ready').length,
    watch_count: stages.filter((stage) => stage.state === 'watch').length,
    blocked_count: stages.filter((stage) => stage.state === 'blocked').length,
    missing_count: stages.filter((stage) => stage.state === 'missing').length
  };
}

export function buildHermesMemoryLoop(sourceRun: HermesRun = canonicalRun()): HermesMemoryLoop {
  const receiptConversion = convertHermesRunToReceipt(sourceRun);
  const promotion = promoteHermesClaimCandidate(sourceRun);
  const claim = promotion.promoted_claim;
  const ledger = buildHermesReputationLedger();
  const reputationEntry = matchingReputationEntry(
    ledger.entries,
    claim.reputation_impact.target_type,
    claim.reputation_impact.target_id
  );
  const decision = createHermesPreSpendDecisionExample();
  const decisionReceipt = createHermesDecisionReceipt(decision);
  const feedback = recordHermesDecisionOutcome(decision);
  const stageIds = {
    run: 'memory_stage_run',
    receipt: 'memory_stage_receipt',
    claim: 'memory_stage_claim',
    review: 'memory_stage_review',
    reputation: 'memory_stage_reputation',
    decision: 'memory_stage_decision',
    outcome: 'memory_stage_outcome',
    feedback: 'memory_stage_feedback'
  };

  const stages: HermesMemoryLoopStage[] = [
    {
      id: stageIds.run,
      label: 'Run',
      primitive: 'hermes_run',
      state: stateFromRun(sourceRun),
      title: sourceRun.title,
      summary: sourceRun.summary,
      source_id: sourceRun.id,
      decision: sourceRun.decision,
      confidence: sourceRun.confidence,
      evidence_count: sourceRun.artifacts.length,
      target_type: sourceRun.provider_id ? 'provider' : sourceRun.route_id ? 'route' : sourceRun.service_id ? 'service' : undefined,
      target_id: sourceRun.provider_id ?? sourceRun.route_id ?? sourceRun.service_id,
      metadata: {
        objective: sourceRun.objective,
        state: sourceRun.state,
        created_at: sourceRun.created_at,
        completed_at: sourceRun.completed_at,
        artifact_ids: sourceRun.artifacts.map((artifact) => artifact.artifact_id)
      }
    },
    {
      id: stageIds.receipt,
      label: 'Receipt',
      primitive: 'agent_run_receipt',
      state: stateFromEvidence(receiptConversion.receipt.evidence_count, receiptConversion.receipt.decision),
      title: receiptConversion.receipt.title,
      summary: receiptConversion.receipt.summary,
      source_id: receiptConversion.receipt.id,
      decision: receiptConversion.receipt.decision,
      confidence: receiptConversion.receipt.confidence,
      evidence_count: receiptConversion.receipt.evidence_count,
      metadata: {
        source_run_id: receiptConversion.receipt.source_run_id,
        receipt_kind: receiptConversion.receipt.receipt_kind,
        conversion_status: receiptConversion.conversion.status
      }
    },
    {
      id: stageIds.claim,
      label: 'Claim',
      primitive: 'claim_candidate',
      state: stateFromEvidence(receiptConversion.receipt.evidence_count, receiptConversion.receipt.decision),
      title: receiptConversion.claim_candidate.title,
      summary: receiptConversion.claim_candidate.claim,
      source_id: receiptConversion.claim_candidate.id,
      decision: receiptConversion.receipt.decision,
      confidence: receiptConversion.claim_candidate.confidence,
      evidence_count: receiptConversion.receipt.evidence_count,
      metadata: {
        source_receipt_id: receiptConversion.claim_candidate.source_receipt_id,
        status: receiptConversion.claim_candidate.status,
        evidence_summary: receiptConversion.claim_candidate.evidence_summary
      }
    },
    {
      id: stageIds.review,
      label: 'Review',
      primitive: 'reviewed_claim',
      state: stateFromReview(claim.review_state, claim.evidence_count),
      title: claim.title,
      summary: claim.claim,
      source_id: claim.id,
      decision: claim.review_state,
      confidence: claim.confidence,
      evidence_count: claim.evidence_count,
      target_type: claim.reputation_impact.target_type,
      target_id: claim.reputation_impact.target_id,
      metadata: {
        reviewer: promotion.review.reviewer,
        source_receipt_id: claim.source_receipt_id,
        impact_direction: claim.reputation_impact.direction,
        impact_magnitude: claim.reputation_impact.magnitude
      }
    },
    {
      id: stageIds.reputation,
      label: 'Reputation',
      primitive: 'reputation_entry',
      state: stateFromReputation(reputationEntry),
      title: reputationEntry?.label ?? `${claim.reputation_impact.target_type}:${claim.reputation_impact.target_id ?? 'unknown'}`,
      summary: reputationEntry
        ? `${reputationEntry.label} is ${reputationEntry.current_state} with trust score ${reputationEntry.trust_score}.`
        : claim.reputation_impact.summary,
      source_id: reputationEntry ? `${reputationEntry.target_type}:${reputationEntry.target_id ?? 'unknown'}` : undefined,
      decision: reputationEntry?.current_state,
      confidence: reputationEntry?.trust_score,
      evidence_count: reputationEntry?.decision_history.length ?? 0,
      target_type: reputationEntry?.target_type ?? claim.reputation_impact.target_type,
      target_id: reputationEntry?.target_id ?? claim.reputation_impact.target_id,
      metadata: {
        source_claim_ids: reputationEntry?.source_claim_ids ?? [claim.id],
        source_receipt_ids: reputationEntry?.source_receipt_ids ?? [claim.source_receipt_id],
        source_run_ids: reputationEntry?.source_run_ids ?? [claim.source_run_id],
        impact_total: reputationEntry?.impact_total
      }
    },
    {
      id: stageIds.decision,
      label: 'Decision',
      primitive: 'pre_spend_decision',
      state: stateFromDecision(decision.decision),
      title: 'Pre-Spend Decision',
      summary: decision.reason,
      source_id: decision.id,
      decision: decision.decision,
      confidence: decision.confidence,
      evidence_count: decision.reputation_inputs.length + decision.receipt_inputs.length + decision.claim_inputs.length + decision.run_inputs.length,
      target_type: decision.input.provider_id ? 'provider' : decision.input.route_id ? 'route' : decision.input.service_id ? 'service' : undefined,
      target_id: decision.input.provider_id ?? decision.input.route_id ?? decision.input.service_id,
      metadata: {
        required_action: decision.required_action,
        decision_receipt_id: decisionReceipt.receipt.id,
        risk_factor_ids: decision.risk_factors.map((risk) => risk.id),
        ledger_state: decision.ledger_state
      }
    },
    {
      id: stageIds.outcome,
      label: 'Outcome',
      primitive: 'spend_outcome',
      state: stateFromOutcome(feedback.outcome.outcome_state),
      title: 'Spend Outcome',
      summary: feedback.outcome.outcome_summary,
      source_id: feedback.outcome.id,
      decision: feedback.outcome.outcome_state,
      confidence: feedback.outcome.impact.magnitude,
      evidence_count: feedback.outcome.evidence_artifacts.length,
      target_type: feedback.outcome.impact.target_type,
      target_id: feedback.outcome.impact.target_id,
      metadata: {
        source_decision_id: feedback.outcome.source_decision_id,
        source_decision_receipt_id: feedback.outcome.source_decision_receipt_id,
        spend_happened: feedback.outcome.spend_happened,
        amount_usd: feedback.outcome.amount_usd
      }
    },
    {
      id: stageIds.feedback,
      label: 'Feedback',
      primitive: 'reputation_feedback',
      state: stateFromFeedback(feedback.reputation_feedback.direction),
      title: 'Reputation Feedback',
      summary: feedback.reputation_feedback.summary,
      source_id: feedback.outcome.id,
      decision: feedback.reputation_feedback.direction,
      confidence: feedback.reputation_feedback.magnitude,
      evidence_count: feedback.reputation_feedback.reputation_notes.length,
      target_type: feedback.reputation_feedback.target_type,
      target_id: feedback.reputation_feedback.target_id,
      metadata: {
        notes: feedback.reputation_feedback.reputation_notes,
        feedback_status: feedback.feedback.status
      }
    }
  ];

  const edges: HermesMemoryLoopEdge[] = [
    { from: stageIds.run, to: stageIds.receipt, label: 'run_to_receipt', summary: 'The Hermes run is converted into a receipt-shaped proof artifact.' },
    { from: stageIds.receipt, to: stageIds.claim, label: 'receipt_to_claim', summary: 'The receipt produces a claim candidate without updating reputation yet.' },
    { from: stageIds.claim, to: stageIds.review, label: 'claim_to_review', summary: 'The claim candidate is reviewed into bounded trust language.' },
    { from: stageIds.review, to: stageIds.reputation, label: 'review_to_reputation', summary: 'The reviewed claim contributes target-specific reputation impact.' },
    { from: stageIds.reputation, to: stageIds.decision, label: 'reputation_to_decision', summary: 'The pre-spend engine reads reputation before money moves.' },
    { from: stageIds.decision, to: stageIds.outcome, label: 'decision_to_outcome', summary: 'The decision creates a receipt and the resulting spend outcome is recorded.' },
    { from: stageIds.outcome, to: stageIds.feedback, label: 'outcome_to_feedback', summary: 'The outcome produces feedback for future reputation and decisions.' }
  ];

  const signals: HermesMemoryLoopSignal[] = [
    { id: 'source_run', label: 'Source run', value: sourceRun.id, summary: 'Canonical seeded Hermes run used to anchor the memory loop.' },
    { id: 'evidence_count', label: 'Evidence count', value: receiptConversion.receipt.evidence_count, summary: 'Hermes artifacts attached to the agent run receipt.' },
    { id: 'claim_review_state', label: 'Claim review state', value: claim.review_state, summary: 'Review state applied before reputation can move.' },
    { id: 'reputation_state', label: 'Reputation state', value: reputationEntry?.current_state ?? 'missing', summary: 'Current ledger state for the reviewed claim target.' },
    { id: 'pre_spend_decision', label: 'Pre-spend decision', value: decision.decision, summary: 'Decision returned before the next agent spend.' },
    { id: 'required_action', label: 'Required action', value: decision.required_action, summary: 'Action the agent should take before money moves.' },
    { id: 'outcome_state', label: 'Outcome state', value: feedback.outcome.outcome_state, summary: 'Recorded result after the decision recommendation.' },
    { id: 'feedback_direction', label: 'Feedback direction', value: feedback.reputation_feedback.direction, summary: 'Direction of feedback that can affect future reputation.' }
  ];

  const stateCounts = countsFor(stages);

  return {
    id: `hermes_memory_loop_${sourceRun.id}`,
    title: 'Agent Memory Loop',
    thesis: 'Agents do not need chat history. Agents need memory that changes future action.',
    generated_at: hermesDeskGeneratedAt,
    source_run_id: sourceRun.id,
    stages,
    edges,
    signals,
    summary: {
      stage_count: stages.length,
      ...stateCounts,
      current_decision: decision.decision,
      current_required_action: decision.required_action,
      reputation_state: reputationEntry?.current_state,
      feedback_direction: feedback.reputation_feedback.direction
    }
  };
}

export function buildHermesMemoryLoopSummary(): HermesMemoryLoopSummary {
  const loop = buildHermesMemoryLoop();
  return {
    generated_at: loop.generated_at,
    loop_count: 1,
    loops: [loop]
  };
}
