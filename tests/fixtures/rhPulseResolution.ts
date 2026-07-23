import {
  RhPulseResolutionInputManifestSchema,
  type RhPulseDirectionalOutcome,
  type RhPulseResolutionInputManifest
} from '../../src/shared/rhPulseResolution';
import type { RhPulseWindowRecord } from '../../src/shared/rhPulseCalls';

const OUTCOMES: RhPulseDirectionalOutcome[] = [
  'agents_to_rwas',
  'memes_to_agents',
  'memes_to_rwas'
];

export const RESOLUTION_WINDOW = {
  id: 'rhp_window_resolution_fixture',
  sequence_number: 12,
  opens_at: '2026-07-23T12:00:00.000Z',
  closes_at: '2026-07-24T12:00:00.000Z',
  call_submission_closes_at: '2026-07-24T12:00:00.000Z'
} as const;

export function resolutionWindowRecord(
  overrides: Partial<RhPulseWindowRecord> = {}
): RhPulseWindowRecord {
  return {
    ...RESOLUTION_WINDOW,
    status: 'closed',
    methodology_version: 'rh-pulse-v1.0',
    source_health: {
      state: 'live',
      observed_at: RESOLUTION_WINDOW.closes_at,
      detail: 'Deterministic test-only reviewed observations.'
    },
    audit_metadata: { fixture: true },
    created_at: '2026-07-23T11:50:00.000Z',
    updated_at: '2026-07-24T12:00:01.000Z',
    closed_at: '2026-07-24T12:00:01.000Z',
    resolved_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    ...overrides
  };
}

export function resolutionManifest(options: {
  strong?: RhPulseDirectionalOutcome | null;
  tieWith?: RhPulseDirectionalOutcome | null;
  agentsRwaAttributed?: boolean;
  narrativeOnly?: RhPulseDirectionalOutcome | null;
} = {}, window: {
  id: string;
  sequence_number: number;
  opens_at: string;
  closes_at: string;
  call_submission_closes_at: string;
} = RESOLUTION_WINDOW): RhPulseResolutionInputManifest {
  const strong = options.strong ?? null;
  const tieWith = options.tieWith ?? null;
  const candidates = OUTCOMES.map((outcome) => {
    const isStrong = outcome === strong || outcome === tieWith;
    const narrativeOnly = outcome === options.narrativeOnly;
    return {
      outcome,
      cross_layer: {
        baseline: observation(`${outcome}_cross_baseline`, window.opens_at, 40, `${outcome} reviewed overlap baseline.`),
        closing: observation(
          `${outcome}_cross_closing`,
          window.closes_at,
          isStrong ? 55 : 42,
          `${outcome} reviewed cross-layer participation at close.`
        ),
        qualified_interaction_observed: isStrong,
        attributable_rwa_interaction: outcome !== 'agents_to_rwas'
          || (isStrong && options.agentsRwaAttributed !== false)
      },
      market_activity: {
        baseline: observation(`${outcome}_activity_baseline`, window.opens_at, 40, `${outcome} activity baseline.`),
        closing: observation(
          `${outcome}_activity_closing`,
          window.closes_at,
          isStrong ? 52 : 42,
          `${outcome} normalized activity at close.`
        )
      },
      narrative_momentum: {
        baseline: observation(`${outcome}_narrative_baseline`, window.opens_at, 40, `${outcome} narrative baseline.`),
        closing: observation(
          `${outcome}_narrative_closing`,
          window.closes_at,
          narrativeOnly ? 65 : isStrong ? 48 : 42,
          `${outcome} filtered narrative momentum at close.`
        )
      }
    };
  });
  return RhPulseResolutionInputManifestSchema.parse({
    manifest_version: '1.0',
    window: {
      id: window.id,
      sequence_number: window.sequence_number,
      opens_at: window.opens_at,
      closes_at: window.closes_at,
      call_submission_closes_at: window.call_submission_closes_at
    },
    methodology_version: 'rh-pulse-v1.0',
    candidates,
    source_health: [{
      source_id: 'fixture_reviewed_memory',
      state: 'live',
      critical: true,
      observed_at: window.closes_at,
      detail: 'Deterministic test-only source health.'
    }],
    evidence_classifications: [
      classification('memes', window.opens_at),
      classification('agents', window.opens_at),
      classification('rwas', window.opens_at),
      classification('cross_layer', window.opens_at)
    ],
    baseline_snapshot_ids: ['fixture_baseline_001'],
    closing_snapshot_ids: ['fixture_closing_001'],
    connection_snapshot_ids: ['fixture_connections_001'],
    market_snapshot_ids: ['fixture_market_001'],
    narrative_observation_ids: ['fixture_narrative_001'],
    calculation_at: window.closes_at
  });
}

function observation(id: string, observedAt: string, value: number, explanation: string) {
  return {
    observation_id: id,
    observed_at: observedAt,
    normalized_value: value,
    confidence: 'high' as const,
    freshness: 'live' as const,
    reviewed: true,
    source_references: [`https://radar.infopunks.fun/rh-chain-signal-desk?observation=${id}`],
    explanation
  };
}

function classification(
  layer: 'memes' | 'agents' | 'rwas' | 'cross_layer',
  effectiveAt: string
) {
  return {
    classification_id: `fixture_classification_${layer}`,
    status: 'approved' as const,
    layer,
    effective_at: effectiveAt,
    source_reference: `https://radar.infopunks.fun/rh-chain-signal-desk?classification=${layer}`
  };
}
