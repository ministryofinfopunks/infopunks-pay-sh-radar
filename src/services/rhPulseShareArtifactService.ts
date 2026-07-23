import {
  RH_PULSE_GENESIS_LIMIT,
  type RhPulseCallOutcome
} from '../shared/rhPulseCalls';
import {
  RH_PULSE_SHARE_ARTIFACT_SCHEMA_VERSION,
  RH_PULSE_SHARE_RENDERER_VERSION,
  RhPulseShareArtifactDataSchema,
  canonicalRhPulseOutcomeLabel,
  sanitizeRhPulseArtifactText,
  type RhPulseShareArtifactData,
  type RhPulseShareArtifactType,
  type RhPulseShareDimensions
} from '../shared/rhPulseShareArtifacts';
import { DEFAULT_PULSE_PUBLIC_HOST, normalizePublicHostname } from '../shared/rhPulseRouting';
import {
  canonicalSha256,
  RH_PULSE_OUTCOME_LABELS,
  type RhPulseParticipationService
} from './rhPulseParticipationService';
import {
  RhPulseResolutionError,
  type RhPulseResolutionService
} from './rhPulseResolutionService';

const OUTCOME_THESES: Record<RhPulseCallOutcome, string> = {
  agents_to_rwas: 'The agent layer becomes an economy, not only a market.',
  memes_to_agents: 'Meme liquidity rotates into agent coordination and new market formation.',
  memes_to_rwas: 'Speculative liquidity seeks reviewed tokenized-finance structure.',
  no_qualified_rotation: 'No directional connection clears the published evidence standard.'
};

export class RhPulseShareArtifactError extends Error {
  constructor(
    readonly code:
      | 'artifact_not_found'
      | 'artifact_source_unavailable'
      | 'artifact_unpublished',
    readonly publicMessage: string
  ) {
    super(code);
  }
}

export type RhPulseShareArtifactServiceOptions = {
  participation: Pick<RhPulseParticipationService, 'getPublicReceipt'>;
  resolution: Pick<
    RhPulseResolutionService,
    'getPublicResolution' | 'getPublicRotationReceipt' | 'getPublicDelayedResolution'
  >;
  publicHost?: string;
};

export class RhPulseShareArtifactService {
  readonly publicHost: string;

  constructor(private readonly options: RhPulseShareArtifactServiceOptions) {
    this.publicHost = normalizePublicHostname(options.publicHost) ?? DEFAULT_PULSE_PUBLIC_HOST;
  }

  async getCallArtifact(callIdOrSlug: string) {
    let source: Awaited<ReturnType<RhPulseShareArtifactServiceOptions['participation']['getPublicReceipt']>>;
    try {
      source = await this.options.participation.getPublicReceipt(callIdOrSlug);
    } catch {
      throw new RhPulseShareArtifactError('artifact_not_found', 'No immutable signed-call artifact exists here.');
    }
    const { call, receipt } = source;
    const resolved = call.resolution?.status === 'correct' || call.resolution?.status === 'incorrect'
      ? call.resolution
      : null;
    const delayed = call.resolution?.status === 'delayed' ? call.resolution : null;
    const artifactType: RhPulseShareArtifactType = resolved
      ? resolved.status === 'correct' ? 'correct_call' : 'incorrect_call'
      : delayed
        ? 'resolution_delayed'
        : call.genesis.is_genesis
          ? 'genesis_signed_call'
          : 'signed_call';
    const sourceRecords: RhPulseShareArtifactData['source_records'] = [{
      kind: 'signed_call_receipt',
      id: receipt.id,
      hash: receipt.receipt_hash
    }];
    let publishedResolution: Awaited<ReturnType<RhPulseShareArtifactServiceOptions['resolution']['getPublicRotationReceipt']>> | null = null;
    if (resolved) {
      try {
        publishedResolution = await this.options.resolution.getPublicRotationReceipt(
          resolved.rotation_receipt_id
        );
      } catch {
        throw new RhPulseShareArtifactError(
          'artifact_source_unavailable',
          'The published Rotation Receipt is temporarily unavailable.'
        );
      }
      sourceRecords.push({
        kind: 'rotation_receipt',
        id: publishedResolution.receipt.id,
        hash: publishedResolution.receipt.receipt_hash
      });
    }
    let delayedResolution: Awaited<
      ReturnType<RhPulseShareArtifactServiceOptions['resolution']['getPublicDelayedResolution']>
    > | null = null;
    if (delayed) {
      try {
        delayedResolution = await this.options.resolution.getPublicDelayedResolution(call.window.id);
      } catch {
        throw new RhPulseShareArtifactError(
          'artifact_source_unavailable',
          'The durable blocked resolution state is temporarily unavailable.'
        );
      }
      sourceRecords.push({
        kind: 'blocked_resolution_run',
        id: delayedResolution.run_id,
        hash: delayedResolution.input_manifest_hash
      });
    }
    const publicNumber = String(call.public_call_number).padStart(4, '0');
    const resolution = publishedResolution?.public_resolution ?? null;
    const primaryLine = artifactType === 'genesis_signed_call'
      ? 'GENESIS CALL'
      : artifactType === 'signed_call'
        ? 'I’M CALLING THE ROTATION'
        : artifactType === 'correct_call'
          ? 'I CALLED THE ROTATION'
          : artifactType === 'incorrect_call'
            ? 'CALL RESOLVED'
            : 'RESOLUTION DELAYED';
    const summary = artifactType === 'incorrect_call'
      ? 'The original call remains on the record alongside the published winning rotation.'
      : artifactType === 'correct_call'
        ? `Call #${publicNumber} matched the immutable published Rotation Receipt.`
        : artifactType === 'resolution_delayed'
          ? `${delayedResolution?.blocked_reason ?? 'Critical closing observations remain unavailable.'} No winner has been published.`
          : OUTCOME_THESES[call.selected_outcome];
    const canonicalUrl = `https://${this.publicHost}/calls/${encodeURIComponent(call.call_id)}`;
    return this.parse({
      artifact_type: artifactType,
      source_records: sourceRecords,
      generated_at: resolution?.published_at
        ?? delayedResolution?.calculated_at
        ?? receipt.created_at,
      canonical_url: canonicalUrl,
      primary_line: primaryLine,
      call_outcome: call.selected_outcome,
      call_outcome_label: RH_PULSE_OUTCOME_LABELS[call.selected_outcome],
      winning_outcome: resolution?.outcome ?? null,
      winning_outcome_label: resolution?.outcome_label ?? null,
      summary,
      evidence_lines: resolution
        ? [
          ...resolution.evidence.what_connected.slice(0, 1),
          ...resolution.evidence.what_proved_it.slice(0, 2)
        ]
        : [
          `Strongest call-time signal: ${structuralSignalLabel(
            receipt.receipt_payload.structural_snapshot.strongest_current_signal
          )}.`,
          'Connection Under Watch: AGENTS ↔ RWAs.'
        ],
      public_call_number: call.public_call_number,
      genesis_rank: call.genesis.rank,
      window_sequence_number: call.window.sequence_number!,
      recorded_at: call.recorded_at,
      window_closes_at: call.window.closes_at!,
      published_at: resolution?.published_at ?? null,
      confidence: resolution?.confidence ?? null,
      community_correct_percentage: null,
      community_total_verified_calls: null,
      receipt_label: resolution
        ? `CALL #${publicNumber} · ROTATION RECEIPT ${String(resolution.window.sequence_number).padStart(3, '0')}`
        : call.genesis.is_genesis
          ? `GENESIS CALL #${publicNumber} / ${RH_PULSE_GENESIS_LIMIT}`
          : `SIGNED CALL RECEIPT #${publicNumber}`,
      receipt_hash: receipt.receipt_hash,
      methodology_version: call.methodology_version,
      image_alt: artifactType === 'incorrect_call'
        ? `RH Pulse resolved call ${publicNumber}: ${call.selected_outcome_label} was recorded and ${resolution?.outcome_label} won.`
        : artifactType === 'resolution_delayed'
          ? `RH Pulse call ${publicNumber} resolution delayed; no winner has been published.`
          : `${primaryLine}: ${call.selected_outcome_label}, RH Pulse call ${publicNumber}.`
    });
  }

  async getResolutionArtifact(windowId: string) {
    try {
      const resolution = await this.options.resolution.getPublicResolution(windowId);
      return this.fromPublishedResolution(resolution);
    } catch (error) {
      if (!(error instanceof RhPulseResolutionError) || error.code !== 'resolution_not_found') {
        throw new RhPulseShareArtifactError(
          'artifact_source_unavailable',
          'The RH Pulse result artifact is temporarily unavailable.'
        );
      }
    }
    try {
      const delayed = await this.options.resolution.getPublicDelayedResolution(windowId);
      return this.parse({
        artifact_type: 'resolution_delayed',
        source_records: [{
          kind: 'blocked_resolution_run',
          id: delayed.run_id,
          hash: delayed.input_manifest_hash
        }],
        generated_at: delayed.calculated_at,
        canonical_url: `https://${this.publicHost}/resolutions/${encodeURIComponent(delayed.window.id)}`,
        primary_line: 'RESOLUTION DELAYED',
        call_outcome: null,
        call_outcome_label: null,
        winning_outcome: null,
        winning_outcome_label: null,
        summary: `${delayed.blocked_reason} No winner has been published.`,
        evidence_lines: [
          'Critical evidence remains below the publication standard.',
          'No call is marked correct or incorrect.'
        ],
        public_call_number: null,
        genesis_rank: null,
        window_sequence_number: delayed.window.sequence_number!,
        recorded_at: null,
        window_closes_at: delayed.window.closes_at!,
        published_at: null,
        confidence: null,
        community_correct_percentage: null,
        community_total_verified_calls: null,
        receipt_label: `WINDOW ${String(delayed.window.sequence_number).padStart(3, '0')} · PUBLIC BLOCKED STATE`,
        receipt_hash: delayed.input_manifest_hash,
        methodology_version: delayed.methodology_version,
        image_alt: `RH Pulse window ${delayed.window.sequence_number} resolution delayed; no winner has been published.`
      });
    } catch {
      throw new RhPulseShareArtifactError(
        'artifact_unpublished',
        'No published or public delayed RH Pulse result exists here.'
      );
    }
  }

  async getRotationReceiptArtifact(receiptIdOrSlug: string) {
    try {
      const source = await this.options.resolution.getPublicRotationReceipt(receiptIdOrSlug);
      return this.fromPublishedResolution(source.public_resolution);
    } catch {
      throw new RhPulseShareArtifactError(
        'artifact_unpublished',
        'No published Rotation Receipt artifact exists here.'
      );
    }
  }

  private fromPublishedResolution(
    resolution: Awaited<ReturnType<RhPulseShareArtifactServiceOptions['resolution']['getPublicResolution']>>
  ) {
    const artifactType: RhPulseShareArtifactType = resolution.outcome === 'no_qualified_rotation'
      ? 'no_qualified_rotation'
      : 'rotation_result';
    return this.parse({
      artifact_type: artifactType,
      source_records: [{
        kind: 'rotation_receipt',
        id: resolution.receipt_id,
        hash: resolution.receipt_hash
      }],
      generated_at: resolution.published_at,
      canonical_url: `https://${this.publicHost}/resolutions/${encodeURIComponent(resolution.window.id)}`,
      primary_line: artifactType === 'no_qualified_rotation'
        ? 'NO QUALIFIED ROTATION'
        : 'WINNING ROTATION',
      call_outcome: null,
      call_outcome_label: null,
      winning_outcome: resolution.outcome,
      winning_outcome_label: resolution.outcome_label,
      summary: resolution.outcome_explanation,
      evidence_lines: [
        ...resolution.evidence.what_connected.slice(0, 1),
        ...resolution.evidence.what_proved_it.slice(0, 2)
      ],
      public_call_number: null,
      genesis_rank: null,
      window_sequence_number: resolution.window.sequence_number!,
      recorded_at: null,
      window_closes_at: resolution.window.closes_at!,
      published_at: resolution.published_at,
      confidence: resolution.confidence,
      community_correct_percentage: resolution.community.total_verified_calls
        ? resolution.community.correct_percentage
        : null,
      community_total_verified_calls: resolution.community.total_verified_calls,
      receipt_label: `ROTATION RECEIPT ${String(resolution.window.sequence_number).padStart(3, '0')}`,
      receipt_hash: resolution.receipt_hash,
      methodology_version: resolution.methodology_version,
      image_alt: artifactType === 'no_qualified_rotation'
        ? `RH Pulse Rotation Receipt ${resolution.window.sequence_number}: No Qualified Rotation, ${resolution.confidence} confidence.`
        : `RH Pulse Rotation Receipt ${resolution.window.sequence_number}: ${resolution.outcome_label} won with ${resolution.confidence} confidence.`
    });
  }

  private parse(
    input: Omit<
      RhPulseShareArtifactData,
      'artifact_schema_version' | 'renderer_version' | 'source_identity_hash'
    >
  ) {
    const sourceRecords = input.source_records.map((record) => ({
      ...record,
      id: sanitizeRhPulseArtifactText(record.id, 180)
    }));
    return RhPulseShareArtifactDataSchema.parse({
      ...input,
      artifact_schema_version: RH_PULSE_SHARE_ARTIFACT_SCHEMA_VERSION,
      renderer_version: RH_PULSE_SHARE_RENDERER_VERSION,
      source_records: sourceRecords,
      source_identity_hash: canonicalSha256({
        artifact_type: input.artifact_type,
        canonical_url: input.canonical_url,
        source_records: sourceRecords
      }),
      primary_line: sanitizeRhPulseArtifactText(input.primary_line, 80),
      call_outcome_label: input.call_outcome_label
        ? sanitizeRhPulseArtifactText(input.call_outcome_label, 80)
        : null,
      winning_outcome_label: input.winning_outcome_label
        ? sanitizeRhPulseArtifactText(input.winning_outcome_label, 80)
        : null,
      summary: sanitizeRhPulseArtifactText(input.summary, 360),
      evidence_lines: input.evidence_lines
        .map((line) => sanitizeRhPulseArtifactText(line, 240))
        .filter(Boolean)
        .slice(0, 3),
      receipt_label: sanitizeRhPulseArtifactText(input.receipt_label, 80),
      image_alt: sanitizeRhPulseArtifactText(input.image_alt, 240)
    });
  }
}

export function rhPulseShareArtifactEtag(
  artifact: RhPulseShareArtifactData,
  dimensions: RhPulseShareDimensions,
  format: 'svg' | 'png'
) {
  return `"${canonicalSha256({
    source_identity_hash: artifact.source_identity_hash,
    artifact_type: artifact.artifact_type,
    renderer_version: artifact.renderer_version,
    dimensions,
    format
  }).slice('sha256:'.length)}"`;
}

function structuralSignalLabel(value: string | null) {
  if (
    value === 'agents_to_rwas'
    || value === 'memes_to_agents'
    || value === 'memes_to_rwas'
    || value === 'no_qualified_rotation'
  ) {
    return canonicalRhPulseOutcomeLabel(value);
  }
  return 'INSUFFICIENT EVIDENCE';
}
