import type { HermesDecisionState, HermesRun } from '../data/hermesDesk';
import { convertHermesRunToReceipt } from './hermesReceiptConverter';

export type HermesClaimReviewState = 'candidate' | 'accepted' | 'needs_more_evidence' | 'disputed' | 'rejected';

export type HermesReputationImpact = {
  target_type: 'route' | 'provider' | 'service' | 'unknown';
  target_id?: string;
  direction: 'positive' | 'negative' | 'neutral' | 'watch';
  magnitude: number;
  summary: string;
  reputation_notes: string[];
};

export type HermesPromotedClaim = {
  id: string;
  source: 'hermes_agent_run';
  source_run_id: string;
  source_receipt_id: string;
  title: string;
  claim: string;
  review_state: HermesClaimReviewState;
  decision: HermesDecisionState;
  confidence: number;
  evidence_summary: string;
  evidence_count: number;
  risk_notes: string[];
  reputation_impact: HermesReputationImpact;
  created_at: string;
  reviewed_at: string;
};

export type HermesClaimPromotionResult = {
  run_id: string;
  promoted_claim: HermesPromotedClaim;
  review: {
    state: HermesClaimReviewState;
    reviewer: 'infopunks_mock_reviewer';
    notes: string[];
  };
  conversion: {
    status: 'promoted' | 'already_promoted' | 'failed';
    notes: string[];
  };
};

type TargetSelection = {
  target_type: HermesReputationImpact['target_type'];
  target_id?: string;
};

export function isHermesClaimReviewState(value: unknown): value is HermesClaimReviewState {
  return value === 'candidate' ||
    value === 'accepted' ||
    value === 'needs_more_evidence' ||
    value === 'disputed' ||
    value === 'rejected';
}

function slugifyRunId(runId: string): string {
  const slug = runId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'unknown_run';
}

function readStringField(source: unknown, key: string): string | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function inferIdFromArtifacts(run: HermesRun, prefix: 'providers' | 'routes' | 'services'): string | undefined {
  const marker = `/${prefix}/`;
  const artifact = run.artifacts.find((item) => item.uri.includes(marker));
  if (!artifact) return undefined;
  const rawId = artifact.uri.split(marker)[1]?.split(/[/?#]/)[0];
  if (!rawId) return undefined;
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
}

function selectTarget(run: HermesRun): TargetSelection {
  const providerId = readStringField(run, 'provider_id') ?? inferIdFromArtifacts(run, 'providers');
  if (providerId) return { target_type: 'provider', target_id: providerId };

  const routeId = readStringField(run, 'route_id') ?? inferIdFromArtifacts(run, 'routes');
  if (routeId) return { target_type: 'route', target_id: routeId };

  const serviceId = readStringField(run, 'service_id') ?? inferIdFromArtifacts(run, 'services');
  if (serviceId) return { target_type: 'service', target_id: serviceId };

  return { target_type: 'unknown' };
}

function defaultReviewState(decision: HermesDecisionState): HermesClaimReviewState {
  if (decision === 'trust') return 'accepted';
  if (decision === 'caution') return 'needs_more_evidence';
  if (decision === 'do_not_use_yet') return 'rejected';
  if (decision === 'disputed') return 'disputed';
  return 'needs_more_evidence';
}

function reputationDirection(decision: HermesDecisionState, reviewState: HermesClaimReviewState): HermesReputationImpact['direction'] {
  if (reviewState === 'rejected') return 'negative';
  if (reviewState === 'needs_more_evidence') return 'watch';
  if (reviewState === 'disputed') return decision === 'do_not_use_yet' ? 'negative' : 'watch';
  if (decision === 'trust' && reviewState === 'accepted') return 'positive';
  if (decision === 'caution') return 'watch';
  if (decision === 'do_not_use_yet') return 'negative';
  if (decision === 'disputed') return 'watch';
  if (decision === 'unproven') return 'watch';
  return 'neutral';
}

function reputationSummary(direction: HermesReputationImpact['direction'], target: TargetSelection): string {
  const targetLabel = target.target_id ? `${target.target_type}:${target.target_id}` : target.target_type;
  if (direction === 'positive') return `Receipt-backed claim can improve trust memory for ${targetLabel}.`;
  if (direction === 'negative') return `Reviewed claim should reduce or block trust memory for ${targetLabel}.`;
  if (direction === 'watch') return `Reviewed claim keeps ${targetLabel} in watch state until stronger evidence arrives.`;
  return `Reviewed claim is recorded without changing trust memory for ${targetLabel}.`;
}

function buildReputationImpact(
  decision: HermesDecisionState,
  reviewState: HermesClaimReviewState,
  confidence: number,
  target: TargetSelection
): HermesReputationImpact {
  const direction = reputationDirection(decision, reviewState);
  const magnitude = Number((Math.max(0, Math.min(100, confidence)) / 100).toFixed(2));
  const reputationNotes = [
    `review_state=${reviewState}`,
    `source_decision=${decision}`,
    `confidence=${confidence}`,
    direction === 'positive'
      ? 'Accepted trust evidence can increase future route or provider confidence.'
      : direction === 'negative'
        ? 'Rejected or spend-blocking evidence should prevent automatic trust promotion.'
        : direction === 'watch'
          ? 'More receipt-backed evidence is required before reputation changes.'
          : 'No reputation movement should occur from this claim alone.'
  ];

  if (!target.target_id) {
    reputationNotes.push('No route_id, provider_id, or service_id target was available; impact stays detached from a known entity.');
  }

  return {
    ...target,
    direction,
    magnitude,
    summary: reputationSummary(direction, target),
    reputation_notes: reputationNotes
  };
}

export function promoteHermesClaimCandidate(
  run: HermesRun,
  requestedState?: HermesClaimReviewState
): HermesClaimPromotionResult {
  const receiptConversion = convertHermesRunToReceipt(run);
  const decision = receiptConversion.receipt.decision;
  const reviewState = isHermesClaimReviewState(requestedState) ? requestedState : defaultReviewState(decision);
  const runSlug = slugifyRunId(receiptConversion.run_id);
  const reviewedAt = receiptConversion.claim_candidate.created_at;
  const target = selectTarget(run);
  const reputationImpact = buildReputationImpact(decision, reviewState, receiptConversion.claim_candidate.confidence, target);
  const reviewNotes = [
    `Default review state for decision=${decision} is ${defaultReviewState(decision)}.`,
    requestedState && isHermesClaimReviewState(requestedState)
      ? `Requested review_state=${requestedState} was accepted.`
      : 'No valid review_state override was supplied; deterministic default review state was used.',
    `Reputation impact direction=${reputationImpact.direction}.`
  ];

  return {
    run_id: receiptConversion.run_id,
    promoted_claim: {
      id: `claim_hermes_promoted_${runSlug}`,
      source: 'hermes_agent_run',
      source_run_id: receiptConversion.run_id,
      source_receipt_id: receiptConversion.receipt.id,
      title: receiptConversion.claim_candidate.title,
      claim: receiptConversion.claim_candidate.claim,
      review_state: reviewState,
      decision,
      confidence: receiptConversion.claim_candidate.confidence,
      evidence_summary: receiptConversion.claim_candidate.evidence_summary,
      evidence_count: receiptConversion.receipt.evidence_count,
      risk_notes: [...receiptConversion.claim_candidate.risk_notes],
      reputation_impact: reputationImpact,
      created_at: receiptConversion.claim_candidate.created_at,
      reviewed_at: reviewedAt
    },
    review: {
      state: reviewState,
      reviewer: 'infopunks_mock_reviewer',
      notes: reviewNotes
    },
    conversion: {
      status: 'promoted',
      notes: [
        'Promoted Hermes claim candidate into an Infopunks claim-shaped object.',
        'Promotion is deterministic and stateless; no persistent claim or reputation record was mutated.'
      ]
    }
  };
}
