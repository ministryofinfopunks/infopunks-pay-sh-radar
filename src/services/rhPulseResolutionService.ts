import { randomUUID } from 'node:crypto';
import {
  RH_PULSE_INDEPENDENCE_DISCLAIMER,
  type RhPulseConfidence,
  type RhPulseFreshness
} from '../shared/rhPulse';
import {
  RH_PULSE_CALL_METHODOLOGY_VERSION,
  RhPulseAuditEventSchema,
  type RhPulseAuditEvent,
  type RhPulseCallOutcome,
  type RhPulseCallRecord,
  type RhPulseWindowRecord
} from '../shared/rhPulseCalls';
import {
  RH_PULSE_BASELINE_AFTER_MS,
  RH_PULSE_BASELINE_BEFORE_MS,
  RH_PULSE_CLOSING_AFTER_MS,
  RH_PULSE_CLOSING_BEFORE_MS,
  RH_PULSE_MIN_CROSS_LAYER_SCORE,
  RH_PULSE_MIN_DIRECTIONAL_LEAD,
  RH_PULSE_MIN_DIRECTIONAL_SCORE,
  RH_PULSE_RESOLUTION_METHODOLOGY_VERSION,
  RH_PULSE_RESOLUTION_RECEIPT_VERSION,
  RH_PULSE_RESOLUTION_WEIGHTS,
  RhPulseCandidateScoreSchema,
  RhPulsePublicResolutionListSchema,
  RhPulsePublicResolutionSchema,
  RhPulsePublicRotationReceiptSchema,
  RhPulseResolutionActionSchema,
  RhPulseResolutionCalculationSchema,
  RhPulseResolutionDraftRequestSchema,
  RhPulseResolutionInputManifestSchema,
  RhPulseResolutionPreviewSchema,
  RhPulseResolutionReadinessSchema,
  RhPulseResolutionRunRecordSchema,
  RhPulseRotationReceiptPayloadSchema,
  RhPulseRotationReceiptRecordSchema,
  type RhPulseCandidateScore,
  type RhPulseDirectionalOutcome,
  type RhPulsePublicResolution,
  type RhPulseResolutionCalculation,
  type RhPulseResolutionInputManifest,
  type RhPulseResolutionRunRecord,
  type RhPulseRotationReceiptPayload,
  type RhPulseRotationReceiptRecord
} from '../shared/rhPulseResolution';
import { DEFAULT_PULSE_PUBLIC_HOST, normalizePublicHostname } from '../shared/rhPulseRouting';
import {
  canonicalSha256,
  communityDistribution,
  publicWindowSummary,
  RH_PULSE_OUTCOME_LABELS
} from './rhPulseParticipationService';
import type {
  RhPulseResolutionPublicationArtifacts,
  RhPulseResolutionStore
} from './rhPulseResolutionStore';

const confidenceRank: Record<RhPulseConfidence, number> = {
  insufficient: 0,
  low: 1,
  medium: 2,
  high: 3
};

const freshnessRank: Record<RhPulseFreshness, number> = {
  unavailable: 0,
  stale: 1,
  delayed: 2,
  live: 3
};

const RH_PULSE_PUBLIC_METHODOLOGY_LIMITATIONS = [
  'Coverage is limited to the identified reviewed observations inside the approved baseline and closing tolerances.',
  'Scores are normalized structural signals, not dollar-flow estimates or proof of causality.'
] as const;

export class RhPulseResolutionError extends Error {
  constructor(
    readonly code:
      | 'window_not_found'
      | 'window_not_closed'
      | 'resolution_not_ready'
      | 'manifest_window_mismatch'
      | 'manifest_methodology_mismatch'
      | 'resolution_run_not_found'
      | 'resolution_invalid_transition'
      | 'resolution_blocked'
      | 'publication_conflict'
      | 'resolution_not_found'
      | 'rotation_receipt_not_found',
    readonly publicMessage: string
  ) {
    super(code);
  }
}

export type RhPulseResolutionServiceOptions = {
  store: RhPulseResolutionStore;
  publicHost?: string;
  now?: () => Date;
  id?: () => string;
};

export class RhPulseResolutionService {
  readonly store: RhPulseResolutionStore;
  readonly publicHost: string;
  private readonly now: () => Date;
  private readonly id: () => string;

  constructor(options: RhPulseResolutionServiceOptions) {
    this.store = options.store;
    this.publicHost = normalizePublicHostname(options.publicHost) ?? DEFAULT_PULSE_PUBLIC_HOST;
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? randomUUID;
  }

  async inspectResolutionReadiness(windowId: string) {
    const window = await this.requireWindow(windowId);
    const inspectedAt = this.now();
    const reasons: string[] = [];
    let status: 'not_ready' | 'ready' | 'blocked' = 'ready';
    if (window.status === 'open' || window.status === 'not_open') {
      status = 'not_ready';
      reasons.push('The call window is not closed.');
    } else if (window.status === 'cancelled') {
      status = 'blocked';
      reasons.push('The call window was cancelled.');
    } else if (window.status === 'resolved') {
      status = 'not_ready';
      reasons.push('An immutable Rotation Receipt is already published for this window.');
    } else if (window.status !== 'closed') {
      status = 'not_ready';
      reasons.push(`Window status ${window.status} is not eligible for resolution.`);
    }
    if (inspectedAt.getTime() < Date.parse(window.call_submission_closes_at)) {
      status = 'not_ready';
      reasons.push('The call-submission deadline has not passed.');
    }
    if (window.source_health.state === 'stale' || window.source_health.state === 'unavailable') {
      reasons.push('Stored window source health is degraded; a preview must supply newer healthy identified observations.');
    }
    if (!reasons.length) reasons.push('Window state and server time permit a deterministic manifest review.');
    return RhPulseResolutionReadinessSchema.parse({
      status,
      window: publicWindowSummary(window, false, inspectedAt),
      can_preview: status === 'ready',
      can_create_draft: status === 'ready',
      reasons,
      inspected_at: inspectedAt.toISOString()
    });
  }

  async preview(windowId: string, input: unknown) {
    const startedAt = performance.now();
    const parsed = RhPulseResolutionDraftRequestSchema.parse(input);
    const window = await this.assertReadyWindow(windowId);
    this.assertManifestAuthority(window, parsed.manifest);
    const manifest = RhPulseResolutionInputManifestSchema.parse(parsed.manifest);
    const calculation = calculateRhPulseResolution(manifest);
    const inputManifestHash = resolutionManifestHash(manifest);
    await this.store.appendAudit(this.auditEvent('resolution_previewed', window.id, {
      input_manifest_hash: inputManifestHash,
      state: calculation.state,
      proposed_outcome: calculation.proposed_outcome,
      calculation_duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
      audit_note: parsed.audit_note
    }));
    return RhPulseResolutionPreviewSchema.parse({
      readiness: await this.inspectResolutionReadiness(window.id),
      input_manifest_hash: inputManifestHash,
      calculation,
      calculation_duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
      persisted: false
    });
  }

  async createResolutionDraft(windowId: string, input: unknown) {
    const parsed = RhPulseResolutionDraftRequestSchema.parse(input);
    const window = await this.assertReadyWindow(windowId);
    this.assertManifestAuthority(window, parsed.manifest);
    const manifest = RhPulseResolutionInputManifestSchema.parse(parsed.manifest);
    const inputManifestHash = resolutionManifestHash(manifest);
    const calculation = calculateRhPulseResolution(manifest);
    try {
      return await this.store.createRun(window.id, inputManifestHash, (runNumber) => {
        const createdAt = this.now().toISOString();
        const run = RhPulseResolutionRunRecordSchema.parse({
          id: `rhp_resolution_${this.id()}`,
          window_id: window.id,
          run_number: runNumber,
          status: calculation.state === 'unable_to_resolve' ? 'blocked' : 'draft',
          methodology_version: RH_PULSE_RESOLUTION_METHODOLOGY_VERSION,
          input_manifest: manifest,
          input_manifest_hash: inputManifestHash,
          candidate_scores: calculation.candidate_scores,
          proposed_outcome: calculation.proposed_outcome,
          confidence: calculation.confidence,
          evidence_summary: calculation.evidence_summary,
          limitations: calculation.limitations,
          blocked_reason: calculation.blocked_reason,
          outcome_explanation: calculation.outcome_explanation,
          created_at: createdAt,
          calculated_at: manifest.calculation_at,
          approved_at: null,
          approved_by: null,
          cancelled_at: null
        });
        const event = calculation.state === 'unable_to_resolve'
          ? 'resolution_blocked'
          : 'resolution_draft_created';
        return {
          run,
          audit: this.auditEvent(event, window.id, {
            run_id: run.id,
            run_number: run.run_number,
            input_manifest_hash: inputManifestHash,
            proposed_outcome: run.proposed_outcome,
            blocked_reason: run.blocked_reason,
            audit_note: parsed.audit_note
          }, createdAt)
        };
      });
    } catch (error) {
      if (isStoreError(error, 'window_not_closed')) {
        throw new RhPulseResolutionError('window_not_closed', 'Only a closed window can create a resolution draft.');
      }
      throw error;
    }
  }

  async listResolutionRuns(windowId: string) {
    await this.requireWindow(windowId);
    return {
      runs: await this.store.listRuns(windowId),
      storage: { adapter: this.store.adapter, durable: this.store.durable }
    };
  }

  async getResolutionRun(runId: string) {
    const run = await this.store.getRun(runId);
    if (!run) {
      throw new RhPulseResolutionError('resolution_run_not_found', 'The resolution run was not found.');
    }
    return run;
  }

  async approveResolutionDraft(runId: string, input: unknown, approvedBy: string) {
    const parsed = RhPulseResolutionActionSchema.parse(input);
    try {
      const run = await this.store.approveRun(
        runId,
        this.now().toISOString(),
        approvedBy,
        (next, idempotent) => this.auditEvent('resolution_approved', next.window_id, {
          run_id: next.id,
          input_manifest_hash: next.input_manifest_hash,
          proposed_outcome: next.proposed_outcome,
          idempotent,
          audit_note: parsed.audit_note
        })
      );
      if (!run) throw new RhPulseResolutionError('resolution_run_not_found', 'The resolution run was not found.');
      return run;
    } catch (error) {
      if (isStoreError(error, 'invalid_transition')) {
        throw new RhPulseResolutionError(
          'resolution_invalid_transition',
          'Only a healthy draft may be approved. Blocked, cancelled and published runs cannot be approved.'
        );
      }
      throw error;
    }
  }

  async cancelResolutionRun(runId: string, input: unknown) {
    const parsed = RhPulseResolutionActionSchema.parse(input);
    try {
      const run = await this.store.cancelRun(
        runId,
        this.now().toISOString(),
        (next, idempotent) => this.auditEvent('resolution_cancelled', next.window_id, {
          run_id: next.id,
          input_manifest_hash: next.input_manifest_hash,
          idempotent,
          audit_note: parsed.audit_note
        })
      );
      if (!run) throw new RhPulseResolutionError('resolution_run_not_found', 'The resolution run was not found.');
      return run;
    } catch (error) {
      if (isStoreError(error, 'invalid_transition')) {
        throw new RhPulseResolutionError('resolution_invalid_transition', 'This resolution run can no longer be cancelled.');
      }
      throw error;
    }
  }

  async publishRotationReceipt(runId: string, input: unknown) {
    const parsed = RhPulseResolutionActionSchema.parse(input);
    const result = await this.store.publish({
      runId,
      build: (run, window, calls, publishedAt) => this.buildPublication(
        run,
        window,
        calls,
        publishedAt,
        parsed.audit_note
      )
    });
    if (!result.published) {
      if (result.code === 'run_not_found') {
        throw new RhPulseResolutionError('resolution_run_not_found', 'The resolution run was not found.');
      }
      if (result.code === 'run_not_approved') {
        throw new RhPulseResolutionError('resolution_invalid_transition', 'Publication requires a separately approved draft.');
      }
      if (result.code === 'window_not_closed') {
        throw new RhPulseResolutionError('window_not_closed', 'Publication requires a closed window past its call deadline.');
      }
      await this.store.appendAudit(this.auditEvent('resolution_publication_conflict', null, {
        run_id: runId,
        existing_receipt_id: result.receipt?.id ?? null,
        audit_note: parsed.audit_note
      }));
      throw new RhPulseResolutionError('publication_conflict', 'An immutable Rotation Receipt already exists for this window.');
    }
    return {
      run: result.run,
      receipt: result.receipt,
      public_resolution: await this.publicResolutionFrom(
        result.receipt,
        result.run,
        result.window
      ),
      idempotent: result.idempotent
    };
  }

  async listPublicResolutions() {
    const receipts = await this.store.listReceipts(100);
    const resolutions = await Promise.all(receipts.map(async (receipt) => {
      const [run, window] = await Promise.all([
        this.store.getRun(receipt.resolution_run_id),
        this.store.getWindow(receipt.window_id)
      ]);
      if (!run || !window || run.status !== 'published') return null;
      return this.publicResolutionFrom(receipt, run, window);
    }));
    return RhPulsePublicResolutionListSchema.parse({
      resolutions: resolutions.filter((item): item is RhPulsePublicResolution => item !== null),
      generated_at: this.now().toISOString()
    });
  }

  async getPublicResolution(windowId: string) {
    const receipt = await this.store.getReceiptForWindow(windowId);
    if (!receipt) throw new RhPulseResolutionError('resolution_not_found', 'No published RH Pulse resolution exists for this window.');
    const [run, window] = await Promise.all([
      this.store.getRun(receipt.resolution_run_id),
      this.store.getWindow(receipt.window_id)
    ]);
    if (!run || !window || run.status !== 'published') {
      throw new RhPulseResolutionError('resolution_not_found', 'No published RH Pulse resolution exists for this window.');
    }
    return this.publicResolutionFrom(receipt, run, window);
  }

  async getPublicRotationReceipt(receiptIdOrSlug: string) {
    const receipt = await this.store.getReceipt(receiptIdOrSlug);
    if (!receipt) {
      throw new RhPulseResolutionError('rotation_receipt_not_found', 'The immutable Rotation Receipt was not found.');
    }
    return RhPulsePublicRotationReceiptSchema.parse({
      receipt,
      immutable: true,
      public_resolution: await this.getPublicResolution(receipt.window_id),
      disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
    });
  }

  async resolutionStateForCall(call: RhPulseCallRecord) {
    const receipt = await this.store.getReceiptForWindow(call.window_id);
    if (receipt) {
      return {
        status: call.selected_outcome === receipt.winning_outcome ? 'correct' as const : 'incorrect' as const,
        winning_outcome: receipt.winning_outcome,
        winning_outcome_label: RH_PULSE_OUTCOME_LABELS[receipt.winning_outcome],
        confidence: receipt.receipt_payload.result.confidence,
        rotation_receipt_id: receipt.id,
        rotation_receipt_url: `https://${this.publicHost}/rotation-receipts/${encodeURIComponent(receipt.id)}`,
        published_at: receipt.published_at
      };
    }
    const latestRun = (await this.store.listRuns(call.window_id))[0] ?? null;
    if (latestRun?.status === 'blocked') {
      return {
        status: 'delayed' as const,
        window_status: 'closed' as const,
        blocked_reason: latestRun.blocked_reason
          ?? 'Critical resolution evidence is incomplete. No winner has been published.',
        retryable: true as const
      };
    }
    return null;
  }

  private async publicResolutionFrom(
    receipt: RhPulseRotationReceiptRecord,
    run: RhPulseResolutionRunRecord,
    window: RhPulseWindowRecord
  ) {
    return RhPulsePublicResolutionSchema.parse({
      window: publicWindowSummary(window, false, this.now()),
      outcome: receipt.winning_outcome,
      outcome_label: RH_PULSE_OUTCOME_LABELS[receipt.winning_outcome],
      confidence: run.confidence,
      winning_score: receipt.receipt_payload.result.winning_score,
      candidate_scores: run.candidate_scores,
      evidence_summary: run.evidence_summary,
      evidence: receipt.receipt_payload.evidence,
      limitations: run.limitations,
      supporting_evidence: publicSupportingEvidence(run.input_manifest),
      outcome_explanation: run.outcome_explanation,
      observation_period: {
        opens_at: window.opens_at,
        closes_at: window.closes_at
      },
      source_health: overallFreshness(run.input_manifest),
      community: receipt.receipt_payload.community,
      methodology_version: run.methodology_version,
      input_manifest_hash: run.input_manifest_hash,
      receipt_id: receipt.id,
      receipt_url: `https://${this.publicHost}/rotation-receipts/${encodeURIComponent(receipt.id)}`,
      receipt_hash: receipt.receipt_hash,
      published_at: receipt.published_at,
      disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
    });
  }

  private buildPublication(
    run: RhPulseResolutionRunRecord,
    window: RhPulseWindowRecord,
    calls: RhPulseCallRecord[],
    publishedAt: string,
    auditNote: string
  ): RhPulseResolutionPublicationArtifacts {
    if (!run.proposed_outcome) {
      throw new RhPulseResolutionError('resolution_blocked', 'Unable-to-resolve runs cannot publish a market result.');
    }
    const community = resolutionCommunityAccuracy(calls, run.proposed_outcome, publishedAt);
    const winningCandidate = run.proposed_outcome === 'no_qualified_rotation'
      ? highestCandidate(run.candidate_scores)
      : run.candidate_scores.find(({ outcome }) => outcome === run.proposed_outcome) ?? null;
    const evidence = receiptEvidence(run, winningCandidate);
    const payload = RhPulseRotationReceiptPayloadSchema.parse({
      receipt_type: 'rh_pulse_rotation',
      receipt_version: RH_PULSE_RESOLUTION_RECEIPT_VERSION,
      window: {
        id: window.id,
        sequence_number: window.sequence_number,
        opens_at: window.opens_at,
        closes_at: window.closes_at
      },
      result: {
        outcome: run.proposed_outcome,
        label: RH_PULSE_OUTCOME_LABELS[run.proposed_outcome],
        confidence: run.confidence,
        winning_score: run.proposed_outcome === 'no_qualified_rotation'
          ? null
          : winningCandidate?.weighted_score ?? null
      },
      candidates: run.candidate_scores.map((candidate) => ({
        outcome: candidate.outcome,
        cross_layer_score: candidate.cross_layer_score,
        market_activity_score: candidate.market_activity_score,
        narrative_momentum_score: candidate.narrative_momentum_score,
        weighted_score: candidate.weighted_score,
        qualification_status: candidate.qualification_status
      })),
      evidence,
      community,
      methodology_version: run.methodology_version,
      input_manifest_hash: run.input_manifest_hash,
      published_at: publishedAt
    });
    const suffix = canonicalSha256({
      run_id: run.id,
      input_manifest_hash: run.input_manifest_hash,
      published_at: publishedAt
    }).slice(-12);
    const receipt = RhPulseRotationReceiptRecordSchema.parse({
      id: `rhp_rotation_receipt_${this.id()}`,
      window_id: window.id,
      resolution_run_id: run.id,
      receipt_version: RH_PULSE_RESOLUTION_RECEIPT_VERSION,
      public_slug: `rotation-${String(window.sequence_number).padStart(3, '0')}-${suffix}`,
      winning_outcome: run.proposed_outcome,
      receipt_payload: payload,
      receipt_hash: canonicalSha256(payload),
      supersedes_receipt_id: null,
      published_at: publishedAt,
      created_at: publishedAt
    });
    return {
      receipt,
      auditEvents: [
        this.auditEvent('resolution_published', window.id, {
          run_id: run.id,
          receipt_id: receipt.id,
          winning_outcome: receipt.winning_outcome,
          input_manifest_hash: run.input_manifest_hash,
          community_total: community.total_verified_calls,
          correct_calls: community.correct_calls,
          audit_note: auditNote
        }, publishedAt),
        this.auditEvent('rotation_receipt_created', window.id, {
          run_id: run.id,
          receipt_id: receipt.id,
          receipt_hash: receipt.receipt_hash,
          public_slug: receipt.public_slug
        }, publishedAt)
      ]
    };
  }

  private async requireWindow(windowId: string) {
    const window = await this.store.getWindow(windowId);
    if (!window) throw new RhPulseResolutionError('window_not_found', 'The RH Pulse window was not found.');
    return window;
  }

  private async assertReadyWindow(windowId: string) {
    const window = await this.requireWindow(windowId);
    if (window.status !== 'closed' || this.now().getTime() < Date.parse(window.call_submission_closes_at)) {
      throw new RhPulseResolutionError(
        'window_not_closed',
        'Resolution requires a closed window after its call-submission deadline.'
      );
    }
    return window;
  }

  private assertManifestAuthority(window: RhPulseWindowRecord, manifest: RhPulseResolutionInputManifest) {
    if (
      manifest.window.id !== window.id
      || manifest.window.sequence_number !== window.sequence_number
      || manifest.window.opens_at !== window.opens_at
      || manifest.window.closes_at !== window.closes_at
      || manifest.window.call_submission_closes_at !== window.call_submission_closes_at
    ) {
      throw new RhPulseResolutionError('manifest_window_mismatch', 'The input manifest does not match the durable window authority.');
    }
    if (
      manifest.methodology_version !== window.methodology_version
      || manifest.methodology_version !== RH_PULSE_CALL_METHODOLOGY_VERSION
    ) {
      throw new RhPulseResolutionError('manifest_methodology_mismatch', 'The input manifest methodology does not match the durable window.');
    }
    if (Date.parse(manifest.calculation_at) > this.now().getTime()) {
      throw new RhPulseResolutionError(
        'resolution_not_ready',
        'The input manifest calculation timestamp cannot be in the future.'
      );
    }
  }

  private auditEvent(
    eventType: RhPulseAuditEvent['event_type'],
    windowId: string | null,
    payload: Record<string, unknown>,
    createdAt = this.now().toISOString()
  ) {
    return RhPulseAuditEventSchema.parse({
      id: `rhp_audit_${this.id()}`,
      event_type: eventType,
      window_id: windowId,
      challenge_id: null,
      call_id: null,
      wallet_hash: null,
      request_origin_hash: null,
      payload,
      created_at: createdAt
    });
  }
}

export function resolutionManifestHash(input: RhPulseResolutionInputManifest) {
  return canonicalSha256(RhPulseResolutionInputManifestSchema.parse(input));
}

export function calculateRhPulseResolution(input: RhPulseResolutionInputManifest): RhPulseResolutionCalculation {
  const manifest = RhPulseResolutionInputManifestSchema.parse(input);
  const globalLimitations = manifestLimitations(manifest);
  const sourceBlocked = manifest.source_health.some(({ critical, state }) => (
    critical && (state === 'stale' || state === 'unavailable')
  ));
  const classificationBlocked = !hasRequiredClassificationCoverage(manifest);
  const scores = manifest.candidates.map((candidate) => {
    const limitations: string[] = [];
    const crossLayerScore = scoreComponent(candidate.cross_layer, 'cross-layer', manifest, limitations);
    const marketActivityScore = scoreComponent(candidate.market_activity, 'market activity', manifest, limitations);
    const narrativeMomentumScore = scoreComponent(candidate.narrative_momentum, 'narrative momentum', manifest, limitations);
    const confidence = candidateConfidence(candidate, manifest);
    const weightedScore = [crossLayerScore, marketActivityScore, narrativeMomentumScore].every((value) => value !== null)
      ? round2(
        crossLayerScore! * RH_PULSE_RESOLUTION_WEIGHTS.cross_layer
        + marketActivityScore! * RH_PULSE_RESOLUTION_WEIGHTS.market_activity
        + narrativeMomentumScore! * RH_PULSE_RESOLUTION_WEIGHTS.narrative_momentum
      )
      : null;
    const crossLayerQualified = candidate.cross_layer.qualified_interaction_observed
      && (candidate.outcome !== 'agents_to_rwas' || candidate.cross_layer.attributable_rwa_interaction);
    const qualificationStatus = sourceBlocked || classificationBlocked
      ? 'blocked_by_source_health'
      : crossLayerScore === null || !crossLayerQualified || crossLayerScore < RH_PULSE_MIN_CROSS_LAYER_SCORE
        ? 'insufficient_cross_layer_evidence'
        : confidenceRank[confidence] < confidenceRank.medium
          ? 'insufficient_confidence'
          : weightedScore !== null && weightedScore >= RH_PULSE_MIN_DIRECTIONAL_SCORE
            ? 'qualified'
            : 'below_threshold';
    return RhPulseCandidateScoreSchema.parse({
      outcome: candidate.outcome,
      cross_layer_score: crossLayerScore,
      market_activity_score: marketActivityScore,
      narrative_momentum_score: narrativeMomentumScore,
      weighted_score: weightedScore,
      qualification_status: qualificationStatus,
      confidence,
      evidence_summary: candidateEvidence(candidate),
      limitations
    });
  });

  const incomplete = scores.some((candidate) => (
    candidate.cross_layer_score === null
    || candidate.market_activity_score === null
    || candidate.narrative_momentum_score === null
    || candidate.weighted_score === null
  ));
  const overallConfidence = minimumConfidence(scores.map(({ confidence }) => confidence));
  const blockers = [
    ...globalLimitations,
    ...(sourceBlocked ? ['At least one critical source is stale or unavailable.'] : []),
    ...(classificationBlocked ? ['Approved reviewed-classification coverage is incomplete.'] : []),
    ...(incomplete ? ['At least one required baseline or closing component is incomplete.'] : []),
    ...(confidenceRank[overallConfidence] < confidenceRank.medium
      ? ['Overall evidence confidence is below Medium.']
      : [])
  ];
  if (blockers.length) {
    return RhPulseResolutionCalculationSchema.parse({
      state: 'unable_to_resolve',
      proposed_outcome: null,
      candidate_scores: scores,
      confidence: overallConfidence,
      evidence_summary: unique(scores.flatMap(({ evidence_summary }) => evidence_summary)),
      limitations: unique([
        ...blockers,
        ...scores.flatMap(({ limitations }) => limitations),
        ...RH_PULSE_PUBLIC_METHODOLOGY_LIMITATIONS
      ]),
      blocked_reason: blockers[0],
      outcome_explanation: 'Critical resolution inputs are incomplete or unhealthy. No market result is published.'
    });
  }

  const qualified = scores
    .filter((candidate) => candidate.qualification_status === 'qualified')
    .sort((left, right) => (right.weighted_score ?? -1) - (left.weighted_score ?? -1)
      || left.outcome.localeCompare(right.outcome));
  const allRanked = [...scores].sort((left, right) => (
    (right.weighted_score ?? -1) - (left.weighted_score ?? -1)
    || left.outcome.localeCompare(right.outcome)
  ));
  const leader = qualified[0] ?? null;
  const eligibleForSeparation = allRanked.filter(({ qualification_status }) => (
    qualification_status === 'qualified' || qualification_status === 'below_threshold'
  ));
  const secondScore = eligibleForSeparation
    .find(({ outcome }) => outcome !== leader?.outcome)?.weighted_score ?? null;
  const lead = leader?.weighted_score !== null && leader?.weighted_score !== undefined && secondScore !== null
    ? round2(leader.weighted_score - secondScore)
    : null;
  const directionalWinner = leader
    && leader.weighted_score !== null
    && leader.weighted_score >= RH_PULSE_MIN_DIRECTIONAL_SCORE
    && (lead === null || lead >= RH_PULSE_MIN_DIRECTIONAL_LEAD)
    ? leader
    : null;
  const proposedOutcome: RhPulseCallOutcome = directionalWinner?.outcome ?? 'no_qualified_rotation';
  const outcomeExplanation = directionalWinner
    ? lead === null
      ? `${RH_PULSE_OUTCOME_LABELS[directionalWinner.outcome]} qualified at ${formatScore(directionalWinner.weighted_score)} as the only evidence-eligible direction under the common 40/35/25 framework.`
      : `${RH_PULSE_OUTCOME_LABELS[directionalWinner.outcome]} qualified at ${formatScore(directionalWinner.weighted_score)} with a ${formatScore(lead)}-point lead under the common 40/35/25 framework.`
    : noQualifiedExplanation(allRanked, lead);
  return RhPulseResolutionCalculationSchema.parse({
    state: 'resolved',
    proposed_outcome: proposedOutcome,
    candidate_scores: scores,
    confidence: overallConfidence,
    evidence_summary: unique(scores.flatMap(({ evidence_summary }) => evidence_summary)),
    limitations: unique([
      ...scores.flatMap(({ limitations }) => limitations),
      ...RH_PULSE_PUBLIC_METHODOLOGY_LIMITATIONS
    ]),
    blocked_reason: null,
    outcome_explanation: outcomeExplanation
  });
}

export function resolutionCommunityAccuracy(
  calls: RhPulseCallRecord[],
  outcome: RhPulseCallOutcome,
  observedAt: string
) {
  const distribution = communityDistribution(calls, observedAt);
  const outcomeRow = distribution.outcomes.find((item) => item.outcome === outcome)!;
  return {
    total_verified_calls: distribution.total_verified_calls,
    correct_calls: outcomeRow.count,
    incorrect_calls: distribution.total_verified_calls - outcomeRow.count,
    correct_percentage: outcomeRow.percentage,
    distribution
  };
}

function scoreComponent(
  component: {
    baseline: RhPulseResolutionInputManifest['candidates'][number]['market_activity']['baseline'];
    closing: RhPulseResolutionInputManifest['candidates'][number]['market_activity']['closing'];
  },
  label: string,
  manifest: RhPulseResolutionInputManifest,
  limitations: string[]
) {
  const baselineWithin = within(
    component.baseline.observed_at,
    Date.parse(manifest.window.opens_at) - RH_PULSE_BASELINE_BEFORE_MS,
    Date.parse(manifest.window.opens_at) + RH_PULSE_BASELINE_AFTER_MS
  );
  const closingWithin = within(
    component.closing.observed_at,
    Date.parse(manifest.window.closes_at) - RH_PULSE_CLOSING_BEFORE_MS,
    Date.parse(manifest.window.closes_at) + RH_PULSE_CLOSING_AFTER_MS
  );
  if (!baselineWithin) limitations.push(`${label} baseline observation is outside the approved tolerance.`);
  if (!closingWithin) limitations.push(`${label} closing observation is outside the approved tolerance.`);
  if (!component.baseline.reviewed || !component.closing.reviewed) {
    limitations.push(`${label} includes an unreviewed observation.`);
  }
  if (
    component.baseline.normalized_value === null
    || component.closing.normalized_value === null
  ) {
    limitations.push(`${label} is unknown; missing evidence remains null.`);
  }
  if (
    freshnessRank[component.baseline.freshness] < freshnessRank.delayed
    || freshnessRank[component.closing.freshness] < freshnessRank.delayed
  ) {
    limitations.push(`${label} includes stale or unavailable evidence.`);
  }
  if (
    !baselineWithin
    || !closingWithin
    || !component.baseline.reviewed
    || !component.closing.reviewed
    || component.baseline.normalized_value === null
    || component.closing.normalized_value === null
    || freshnessRank[component.baseline.freshness] < freshnessRank.delayed
    || freshnessRank[component.closing.freshness] < freshnessRank.delayed
  ) return null;
  const delta = component.closing.normalized_value - component.baseline.normalized_value;
  return round2(clamp(50 + 2 * delta, 0, 100));
}

function candidateConfidence(
  candidate: RhPulseResolutionInputManifest['candidates'][number],
  manifest: RhPulseResolutionInputManifest
) {
  const observations = [
    candidate.cross_layer.baseline,
    candidate.cross_layer.closing,
    candidate.market_activity.baseline,
    candidate.market_activity.closing,
    candidate.narrative_momentum.baseline,
    candidate.narrative_momentum.closing
  ];
  let confidence = minimumConfidence(observations.map((observation) => (
    observation.reviewed ? observation.confidence : 'insufficient'
  )));
  if (
    manifest.source_health.some(({ critical, state }) => critical && state === 'delayed')
    && confidence === 'high'
  ) confidence = 'medium';
  return confidence;
}

function manifestLimitations(manifest: RhPulseResolutionInputManifest) {
  const limitations: string[] = [];
  const calculatedAt = Date.parse(manifest.calculation_at);
  if (!manifest.baseline_snapshot_ids.length) limitations.push('Baseline snapshot inventory is empty.');
  if (!manifest.closing_snapshot_ids.length) limitations.push('Closing snapshot inventory is empty.');
  if (!manifest.connection_snapshot_ids.length) limitations.push('Connection snapshot inventory is empty.');
  if (calculatedAt < Date.parse(manifest.window.closes_at)) {
    limitations.push('Calculation timestamp precedes the window close.');
  }
  const observations = manifest.candidates.flatMap((candidate) => [
    candidate.cross_layer.baseline,
    candidate.cross_layer.closing,
    candidate.market_activity.baseline,
    candidate.market_activity.closing,
    candidate.narrative_momentum.baseline,
    candidate.narrative_momentum.closing
  ]);
  if (observations.some(({ observed_at }) => Date.parse(observed_at) > calculatedAt)) {
    limitations.push('An identified observation occurs after the calculation timestamp.');
  }
  if (manifest.source_health.some(({ observed_at }) => (
    observed_at !== null && Date.parse(observed_at) > calculatedAt
  ))) {
    limitations.push('A source-health observation occurs after the calculation timestamp.');
  }
  if (manifest.evidence_classifications.some(({ effective_at }) => Date.parse(effective_at) > calculatedAt)) {
    limitations.push('A reviewed classification became effective after the calculation timestamp.');
  }
  return limitations;
}

function hasRequiredClassificationCoverage(manifest: RhPulseResolutionInputManifest) {
  const approved = manifest.evidence_classifications.filter(({ status }) => status === 'approved');
  return ['memes', 'agents', 'rwas', 'cross_layer'].every((layer) => (
    approved.some((classification) => classification.layer === layer)
  ));
}

function candidateEvidence(candidate: RhPulseResolutionInputManifest['candidates'][number]) {
  return unique([
    candidate.cross_layer.closing.explanation,
    candidate.market_activity.closing.explanation,
    candidate.narrative_momentum.closing.explanation
  ]);
}

function noQualifiedExplanation(scores: RhPulseCandidateScore[], lead: number | null) {
  const strongest = scores[0];
  if (!strongest || strongest.weighted_score === null) {
    return 'Required evidence was healthy, but no directional connection produced a qualifying score.';
  }
  if (strongest.weighted_score < RH_PULSE_MIN_DIRECTIONAL_SCORE) {
    return `${RH_PULSE_OUTCOME_LABELS[strongest.outcome]} showed the strongest measured activity at ${formatScore(strongest.weighted_score)}, but remained below the ${RH_PULSE_MIN_DIRECTIONAL_SCORE}-point qualification threshold.`;
  }
  return `${RH_PULSE_OUTCOME_LABELS[strongest.outcome]} did not establish the required ${RH_PULSE_MIN_DIRECTIONAL_LEAD}-point lead${lead === null ? '' : `; the measured lead was ${formatScore(lead)}`}. Activity occurred, but no directional rotation qualified.`;
}

function receiptEvidence(
  run: RhPulseResolutionRunRecord,
  winningCandidate: RhPulseCandidateScore | null
): RhPulseRotationReceiptPayload['evidence'] {
  const candidateInput = winningCandidate
    ? run.input_manifest.candidates.find(({ outcome }) => outcome === winningCandidate.outcome) ?? null
    : null;
  if (run.proposed_outcome === 'no_qualified_rotation') {
    return {
      what_moved: winningCandidate?.evidence_summary.slice(1, 2) ?? ['Reviewed in-layer activity changed across the window.'],
      what_connected: ['No directional connection cleared both the cross-layer evidence and separation thresholds.'],
      what_proved_it: unique(run.candidate_scores.flatMap(({ evidence_summary }) => evidence_summary)).slice(0, 12),
      limitations: run.limitations
    };
  }
  return {
    what_moved: candidateInput ? [candidateInput.market_activity.closing.explanation] : run.evidence_summary.slice(0, 1),
    what_connected: candidateInput ? [candidateInput.cross_layer.closing.explanation] : run.evidence_summary.slice(0, 1),
    what_proved_it: candidateInput ? unique([
      candidateInput.cross_layer.closing.explanation,
      candidateInput.market_activity.closing.explanation,
      candidateInput.narrative_momentum.closing.explanation
    ]) : run.evidence_summary,
    limitations: run.limitations
  };
}

function highestCandidate(scores: RhPulseCandidateScore[]) {
  return [...scores].sort((left, right) => (
    (right.weighted_score ?? -1) - (left.weighted_score ?? -1)
    || left.outcome.localeCompare(right.outcome)
  ))[0] ?? null;
}

function overallFreshness(manifest: RhPulseResolutionInputManifest): RhPulseFreshness {
  return [...manifest.source_health]
    .sort((left, right) => freshnessRank[left.state] - freshnessRank[right.state])[0]?.state ?? 'unavailable';
}

function publicSupportingEvidence(manifest: RhPulseResolutionInputManifest) {
  const references = [
    ...manifest.candidates.flatMap((candidate) => [
      ...candidate.cross_layer.baseline.source_references,
      ...candidate.cross_layer.closing.source_references,
      ...candidate.market_activity.baseline.source_references,
      ...candidate.market_activity.closing.source_references,
      ...candidate.narrative_momentum.baseline.source_references,
      ...candidate.narrative_momentum.closing.source_references
    ]),
    ...manifest.evidence_classifications.map(({ source_reference }) => source_reference)
  ];
  return [...new Set(references)].slice(0, 100).map((reference) => ({
    reference,
    url: safePublicEvidenceUrl(reference)
  }));
}

function safePublicEvidenceUrl(reference: string) {
  try {
    const parsed = new URL(reference);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function minimumConfidence(values: RhPulseConfidence[]): RhPulseConfidence {
  return [...values].sort((left, right) => confidenceRank[left] - confidenceRank[right])[0] ?? 'insufficient';
}

function within(value: string, minimum: number, maximum: number) {
  const time = Date.parse(value);
  return time >= minimum && time <= maximum;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatScore(value: number | null) {
  return value === null ? 'unavailable' : value.toFixed(2).replace(/\.?0+$/, '');
}

function isStoreError(error: unknown, code: string) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === code);
}
