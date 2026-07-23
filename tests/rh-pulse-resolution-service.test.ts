import { describe, expect, it } from 'vitest';
import {
  calculateRhPulseResolution,
  resolutionCommunityAccuracy,
  resolutionManifestHash,
  RhPulseResolutionError,
  RhPulseResolutionService
} from '../src/services/rhPulseResolutionService';
import { InMemoryRhPulseResolutionStore } from '../src/services/rhPulseResolutionStore';
import { InMemoryRhPulseParticipationStore } from '../src/services/rhPulseParticipationStore';
import type { RhPulseCallRecord } from '../src/shared/rhPulseCalls';
import {
  RH_PULSE_RESOLUTION_WEIGHTS,
  RhPulseResolutionInputManifestSchema
} from '../src/shared/rhPulseResolution';
import {
  RESOLUTION_WINDOW,
  resolutionManifest,
  resolutionWindowRecord
} from './fixtures/rhPulseResolution';

describe('RH Pulse deterministic resolution calculation', () => {
  it.each([
    'agents_to_rwas',
    'memes_to_agents',
    'memes_to_rwas'
  ] as const)('qualifies %s under the common top-level weights', (outcome) => {
    const result = calculateRhPulseResolution(resolutionManifest({ strong: outcome }));
    expect(result).toMatchObject({
      state: 'resolved',
      proposed_outcome: outcome,
      confidence: 'high'
    });
    expect(result.candidate_scores.find((candidate) => candidate.outcome === outcome)).toMatchObject({
      cross_layer_score: 80,
      market_activity_score: 74,
      narrative_momentum_score: 66,
      weighted_score: 74.4,
      qualification_status: 'qualified'
    });
    expect(result.limitations).toContain(
      'Scores are normalized structural signals, not dollar-flow estimates or proof of causality.'
    );
    expect(RH_PULSE_RESOLUTION_WEIGHTS).toEqual({
      cross_layer: 0.4,
      market_activity: 0.35,
      narrative_momentum: 0.25
    });
  });

  it('gives Agents → RWAs no mathematical preference and requires attributable RWA interaction', () => {
    const attributed = calculateRhPulseResolution(resolutionManifest({ strong: 'agents_to_rwas' }));
    const unAttributed = calculateRhPulseResolution(resolutionManifest({
      strong: 'agents_to_rwas',
      agentsRwaAttributed: false
    }));
    const memeToAgents = calculateRhPulseResolution(resolutionManifest({ strong: 'memes_to_agents' }));
    expect(attributed.candidate_scores[0]?.weighted_score).toBe(
      memeToAgents.candidate_scores[1]?.weighted_score
    );
    expect(unAttributed.proposed_outcome).toBe('no_qualified_rotation');
    expect(unAttributed.candidate_scores[0]?.qualification_status).toBe('insufficient_cross_layer_evidence');
  });

  it('does not let narrative independently qualify a direction', () => {
    const result = calculateRhPulseResolution(resolutionManifest({ narrativeOnly: 'agents_to_rwas' }));
    expect(result.proposed_outcome).toBe('no_qualified_rotation');
    expect(result.candidate_scores[0]).toMatchObject({
      cross_layer_score: 54,
      narrative_momentum_score: 100,
      qualification_status: 'insufficient_cross_layer_evidence'
    });
  });

  it('returns No Qualified Rotation for complete healthy evidence below threshold or below the lead', () => {
    expect(calculateRhPulseResolution(resolutionManifest()).proposed_outcome)
      .toBe('no_qualified_rotation');
    const tie = calculateRhPulseResolution(resolutionManifest({
      strong: 'agents_to_rwas',
      tieWith: 'memes_to_agents'
    }));
    expect(tie).toMatchObject({
      state: 'resolved',
      proposed_outcome: 'no_qualified_rotation',
      blocked_reason: null
    });
    expect(tie.outcome_explanation).toContain('5-point lead');
  });

  it('keeps missing evidence null and distinguishes Unable to Resolve from No Qualified Rotation', () => {
    const manifest = structuredClone(resolutionManifest({ strong: 'memes_to_agents' }));
    manifest.candidates[1]!.market_activity.closing.normalized_value = null;
    const result = calculateRhPulseResolution(RhPulseResolutionInputManifestSchema.parse(manifest));
    expect(result).toMatchObject({
      state: 'unable_to_resolve',
      proposed_outcome: null
    });
    expect(result.candidate_scores[1]?.market_activity_score).toBeNull();
    expect(result.blocked_reason).toContain('incomplete');
  });

  it.each([
    ['stale critical source', (manifest: ReturnType<typeof resolutionManifest>) => {
      manifest.source_health[0]!.state = 'stale';
    }],
    ['missing closing tolerance', (manifest: ReturnType<typeof resolutionManifest>) => {
      manifest.candidates[0]!.cross_layer.closing.observed_at = '2026-07-24T13:00:00.000Z';
    }],
    ['low evidence confidence', (manifest: ReturnType<typeof resolutionManifest>) => {
      manifest.candidates[0]!.cross_layer.closing.confidence = 'low';
    }],
    ['unreviewed evidence', (manifest: ReturnType<typeof resolutionManifest>) => {
      manifest.candidates[0]!.cross_layer.closing.reviewed = false;
    }],
    ['observation after calculation', (manifest: ReturnType<typeof resolutionManifest>) => {
      manifest.candidates[0]!.cross_layer.closing.observed_at = '2026-07-24T12:00:01.000Z';
    }]
  ])('blocks publication for %s', (_label, mutate) => {
    const manifest = structuredClone(resolutionManifest({ strong: 'agents_to_rwas' }));
    mutate(manifest);
    const result = calculateRhPulseResolution(RhPulseResolutionInputManifestSchema.parse(manifest));
    expect(result.state).toBe('unable_to_resolve');
    expect(result.proposed_outcome).toBeNull();
  });

  it('hashes the canonical manifest independently of object insertion order', () => {
    const manifest = resolutionManifest({ strong: 'memes_to_rwas' });
    const reordered = Object.fromEntries(Object.entries(manifest).reverse());
    expect(resolutionManifestHash(manifest)).toBe(
      resolutionManifestHash(RhPulseResolutionInputManifestSchema.parse(reordered))
    );
    expect(resolutionManifestHash({
      ...manifest,
      calculation_at: '2026-07-24T12:05:01.000Z'
    })).not.toBe(resolutionManifestHash(manifest));
  });
});

describe('RH Pulse resolution lifecycle', () => {
  it('keeps previews non-public, requires separate approval and publishes one immutable result', async () => {
    const harness = await lifecycleHarness();
    const input = { manifest: resolutionManifest({ strong: 'memes_to_agents' }), audit_note: 'Test reviewed evidence.' };
    const preview = await harness.service.preview(RESOLUTION_WINDOW.id, input);
    expect(preview.persisted).toBe(false);
    expect((await harness.service.listResolutionRuns(RESOLUTION_WINDOW.id)).runs).toHaveLength(0);

    const draft = await harness.service.createResolutionDraft(RESOLUTION_WINDOW.id, input);
    expect(draft).toMatchObject({ idempotent: false, run: { status: 'draft' } });
    await expect(harness.service.publishRotationReceipt(draft.run.id, { audit_note: 'Too early.' }))
      .rejects.toMatchObject({ code: 'resolution_invalid_transition' });

    const approved = await harness.service.approveResolutionDraft(
      draft.run.id,
      { audit_note: 'Independent review complete.' },
      'reviewer-fixture'
    );
    expect(approved.status).toBe('approved');
    const publication = await harness.service.publishRotationReceipt(
      draft.run.id,
      { audit_note: 'Publish reviewed Rotation Receipt.' }
    );
    expect(publication).toMatchObject({
      idempotent: false,
      run: { status: 'published' },
      receipt: { winning_outcome: 'memes_to_agents' },
      public_resolution: {
        outcome: 'memes_to_agents',
        community: { total_verified_calls: 0, correct_calls: 0 }
      }
    });
    expect(publication.receipt.receipt_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect((await harness.service.publishRotationReceipt(
      draft.run.id,
      { audit_note: 'Idempotent operator retry.' }
    )).idempotent).toBe(true);
    expect((await harness.service.listPublicResolutions()).resolutions).toHaveLength(1);
  });

  it('does not resolve an open window and does not publish blocked or cancelled runs', async () => {
    const open = await lifecycleHarness('open');
    await expect(open.service.preview(RESOLUTION_WINDOW.id, {
      manifest: resolutionManifest(),
      audit_note: 'Must fail.'
    })).rejects.toBeInstanceOf(RhPulseResolutionError);

    const blocked = await lifecycleHarness();
    const manifest = structuredClone(resolutionManifest({ strong: 'agents_to_rwas' }));
    manifest.source_health[0]!.state = 'unavailable';
    const draft = await blocked.service.createResolutionDraft(RESOLUTION_WINDOW.id, {
      manifest,
      audit_note: 'Critical source unavailable.'
    });
    expect(draft.run).toMatchObject({
      status: 'blocked',
      proposed_outcome: null
    });
    await expect(blocked.service.approveResolutionDraft(
      draft.run.id,
      { audit_note: 'Cannot approve.' },
      'reviewer-fixture'
    )).rejects.toMatchObject({ code: 'resolution_invalid_transition' });
    expect(await blocked.service.resolutionStateForCall(callRecord(1, 'no_qualified_rotation')))
      .toMatchObject({
        status: 'delayed',
        window_status: 'closed',
        retryable: true,
        blocked_reason: expect.stringContaining('source')
      });

    const cancelled = await lifecycleHarness();
    const cancellable = await cancelled.service.createResolutionDraft(RESOLUTION_WINDOW.id, {
      manifest: resolutionManifest({ strong: 'memes_to_rwas' }),
      audit_note: 'Create cancellable reviewed draft.'
    });
    expect((await cancelled.service.cancelResolutionRun(
      cancellable.run.id,
      { audit_note: 'Cancel before publication.' }
    )).status).toBe('cancelled');
    await expect(cancelled.service.publishRotationReceipt(
      cancellable.run.id,
      { audit_note: 'Cancelled drafts cannot publish.' }
    )).rejects.toMatchObject({ code: 'resolution_invalid_transition' });
  });
});

describe('RH Pulse community accuracy', () => {
  it('uses verified one-wallet call records without balance or volume weighting', () => {
    const calls = [
      callRecord(1, 'agents_to_rwas'),
      callRecord(2, 'memes_to_agents'),
      callRecord(3, 'memes_to_agents')
    ];
    expect(resolutionCommunityAccuracy(
      calls,
      'memes_to_agents',
      '2026-07-24T12:10:00.000Z'
    )).toMatchObject({
      total_verified_calls: 3,
      correct_calls: 2,
      incorrect_calls: 1,
      correct_percentage: 66.67
    });
  });
});

async function lifecycleHarness(status: 'closed' | 'open' = 'closed') {
  const participation = new InMemoryRhPulseParticipationStore({ initialWindowSequence: 11 });
  await participation.createWindow(
    () => resolutionWindowRecord({
      status,
      closed_at: status === 'closed' ? '2026-07-24T12:00:01.000Z' : null
    }),
    (window) => ({
      id: 'rhp_audit_fixture_window_created',
      event_type: 'window_created',
      window_id: window.id,
      challenge_id: null,
      call_id: null,
      wallet_hash: null,
      request_origin_hash: null,
      payload: { fixture: true },
      created_at: '2026-07-23T11:50:00.000Z'
    })
  );
  let id = 0;
  const now = () => new Date('2026-07-24T12:10:00.000Z');
  const store = new InMemoryRhPulseResolutionStore(participation, { now });
  const service = new RhPulseResolutionService({
    store,
    now,
    id: () => `fixture_${String(++id).padStart(8, '0')}`
  });
  return { participation, store, service };
}

function callRecord(number: number, outcome: RhPulseCallRecord['selected_outcome']): RhPulseCallRecord {
  const suffix = String(number).padStart(8, '0');
  return {
    id: `rhp_call_${suffix}`,
    public_call_number: number,
    window_id: RESOLUTION_WINDOW.id,
    wallet_address: `0x${String(number).padStart(40, '0')}`,
    selected_outcome: outcome,
    signature: `0x${'11'.repeat(65)}`,
    signed_message_hash: `sha256:${'1'.repeat(64)}`,
    recorded_at: '2026-07-23T13:00:00.000Z',
    verification_status: 'verified',
    abuse_status: 'clear',
    genesis_rank: number,
    public_slug: `call-${String(number).padStart(6, '0')}-${suffix}`,
    methodology_version: 'rh-pulse-v1.0',
    created_at: '2026-07-23T13:00:00.000Z'
  };
}
