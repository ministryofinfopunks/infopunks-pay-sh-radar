// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { RH_PULSE_INDEPENDENCE_DISCLAIMER } from '../src/shared/rhPulse';
import type { RhPulsePublicResolution } from '../src/shared/rhPulseResolution';
import { RhPulsePage } from '../src/web/rhPulse/RhPulsePage';
import { RhPulsePublicCallPage } from '../src/web/rhPulse/RhPulsePublicCallPage';

describe('RH Pulse published resolution UI', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    window.history.pushState({}, '', '/rh-pulse/resolutions/rhp_window_resolution_fixture');
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    document.body.classList.remove('rh-pulse-document');
    window.history.pushState({}, '', '/');
  });

  it('renders a mobile semantic comparison, immutable proof and post-publication community accuracy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(buildRhChainApiResponse(publicResolution())),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    await act(async () => {
      root = createRoot(container);
      root.render(<RhPulsePage route={{
        kind: 'resolution',
        id: 'rhp_window_resolution_fixture',
        canonicalPath: '/resolutions/rhp_window_resolution_fixture'
      }} />);
    });
    await vi.waitFor(() => expect(container.textContent).toContain('Memes → Agents'));
    const text = container.textContent ?? '';
    expect(text).toContain('RH PULSE ROTATION RECEIPT 012');
    expect(text).toContain('What moved');
    expect(text).toContain('What connected');
    expect(text).toContain('What proved it');
    expect(text).toContain('66.67% called the rotation.');
    expect(text).toContain('Correlation is not capital flow.');
    expect(text).toContain('sha256:');
    expect(container.querySelectorAll('meter')).toHaveLength(3);
    expect(container.querySelector('meter[aria-label*="Memes → Agents weighted score"]')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('.rh-pulse-resolution-support a')?.getAttribute('href'))
      .toContain('radar.infopunks.fun');
  });

  it.each([
    ['correct', 'I Called the Rotation', 'Correct call', 'Memes → Agents'],
    ['incorrect', 'Call Resolved', 'Incorrect call', 'Agents → RWAs']
  ] as const)('renders the %s public call state without altering the original call', async (state, heading, status, userCall) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(buildRhChainApiResponse(publicCall(state))),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    await act(async () => {
      root = createRoot(container);
      root.render(<RhPulsePublicCallPage
        callId="rhp_call_resolution_fixture"
        homeHref="/rh-pulse"
        methodologyHref="/rh-pulse/methodology"
      />);
    });
    await vi.waitFor(() => expect(container.textContent).toContain(heading));
    expect(container.textContent).toContain(status);
    expect(container.textContent).toContain(`Your call: ${userCall}`);
    expect(container.textContent).toContain('Published result: Memes → Agents');
    expect(container.textContent).toContain('The original prediction remains on the record.');
  });

  it('renders an honest blocked state without inventing a winner or community accuracy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(buildRhChainApiResponse(publicDelayedCall())),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    await act(async () => {
      root = createRoot(container);
      root.render(<RhPulsePublicCallPage
        callId="rhp_call_resolution_fixture"
        homeHref="/rh-pulse"
        methodologyHref="/rh-pulse/methodology"
      />);
    });
    await vi.waitFor(() => expect(container.textContent).toContain('Resolution delayed'));
    const text = container.textContent ?? '';
    expect(text).toContain('Critical closing observations are unavailable.');
    expect(text).toContain('No winner has been published');
    expect(text).not.toContain('Published result:');
    expect(text).not.toContain('Community accuracy');
  });
});

function publicResolution(): RhPulsePublicResolution {
  const outcomes = ['agents_to_rwas', 'memes_to_agents', 'memes_to_rwas'] as const;
  return {
    window: {
      id: 'rhp_window_resolution_fixture',
      sequence_number: 12,
      state: 'resolved',
      opens_at: '2026-07-23T12:00:00.000Z',
      closes_at: '2026-07-24T12:00:00.000Z',
      call_submission_closes_at: '2026-07-24T12:00:00.000Z',
      accepting_calls: false,
      methodology_version: 'rh-pulse-v1.0'
    },
    outcome: 'memes_to_agents',
    outcome_label: 'Memes → Agents',
    confidence: 'medium',
    winning_score: 74.4,
    candidate_scores: outcomes.map((outcome, index) => ({
      outcome,
      cross_layer_score: index === 1 ? 80 : 54,
      market_activity_score: index === 1 ? 74 : 54,
      narrative_momentum_score: index === 1 ? 66 : 54,
      weighted_score: index === 1 ? 74.4 : 54,
      qualification_status: index === 1 ? 'qualified' as const : 'insufficient_cross_layer_evidence' as const,
      confidence: 'medium' as const,
      evidence_summary: [`${outcome} public evidence.`],
      limitations: []
    })),
    evidence_summary: ['Reviewed meme-active cohorts entered qualified agent markets.'],
    evidence: {
      what_moved: ['Reviewed agent-market activity accelerated.'],
      what_connected: ['Meme-active cohorts entered qualified agent markets.'],
      what_proved_it: ['Reviewed participant overlap expanded.'],
      limitations: ['The observation set is bounded and does not represent all chain activity.']
    },
    limitations: ['The observation set is bounded and does not represent all chain activity.'],
    supporting_evidence: [{
      reference: 'https://radar.infopunks.fun/rh-chain-signal-desk?observation=fixture',
      url: 'https://radar.infopunks.fun/rh-chain-signal-desk?observation=fixture'
    }],
    outcome_explanation: 'Memes → Agents qualified under the common evidence framework.',
    observation_period: {
      opens_at: '2026-07-23T12:00:00.000Z',
      closes_at: '2026-07-24T12:00:00.000Z'
    },
    source_health: 'live',
    community: {
      total_verified_calls: 3,
      correct_calls: 2,
      incorrect_calls: 1,
      correct_percentage: 66.67,
      distribution: {
        total_verified_calls: 3,
        outcomes: [
          { outcome: 'agents_to_rwas', count: 1, percentage: 33.33 },
          { outcome: 'memes_to_agents', count: 2, percentage: 66.67 },
          { outcome: 'memes_to_rwas', count: 0, percentage: 0 },
          { outcome: 'no_qualified_rotation', count: 0, percentage: 0 }
        ],
        observed_at: '2026-07-24T12:10:00.000Z'
      }
    },
    methodology_version: 'rh-pulse-v1.0',
    input_manifest_hash: `sha256:${'1'.repeat(64)}`,
    receipt_id: 'rhp_rotation_receipt_resolution_fixture',
    receipt_url: 'https://pulse.infopunks.fun/rotation-receipts/rhp_rotation_receipt_resolution_fixture',
    receipt_hash: `sha256:${'2'.repeat(64)}`,
    published_at: '2026-07-24T12:10:00.000Z',
    disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
  };
}

function publicCall(status: 'correct' | 'incorrect') {
  const selectedOutcome = status === 'correct' ? 'memes_to_agents' : 'agents_to_rwas';
  const selectedOutcomeLabel = status === 'correct' ? 'Memes → Agents' : 'Agents → RWAs';
  return {
    call: {
      call_id: 'rhp_call_resolution_fixture',
      public_call_number: 482,
      public_slug: 'call-000482-resolutionfixture',
      wallet_display: '0x1234…5678',
      selected_outcome: selectedOutcome,
      selected_outcome_label: selectedOutcomeLabel,
      recorded_at: '2026-07-23T13:00:00.000Z',
      window: publicResolution().window,
      verification_status: 'verified',
      genesis: {
        is_genesis: true,
        rank: 482,
        limit: 4663,
        label: 'GENESIS CALL #0482 / 4663'
      },
      receipt_url: 'https://pulse.infopunks.fun/calls/rhp_call_resolution_fixture#receipt',
      public_url: 'https://pulse.infopunks.fun/calls/rhp_call_resolution_fixture',
      resolution_status: status,
      resolution: {
        status,
        winning_outcome: 'memes_to_agents',
        winning_outcome_label: 'Memes → Agents',
        confidence: 'medium',
        rotation_receipt_id: 'rhp_rotation_receipt_resolution_fixture',
        rotation_receipt_url: 'https://pulse.infopunks.fun/rotation-receipts/rhp_rotation_receipt_resolution_fixture',
        published_at: '2026-07-24T12:10:00.000Z'
      },
      methodology_version: 'rh-pulse-v1.0'
    },
    structural_snapshot: {
      strongest_current_signal: 'memes_to_agents',
      connection_under_watch: 'agents_to_rwas',
      generated_at: '2026-07-23T12:55:00.000Z',
      source_health: 'delayed'
    },
    receipt_hash: `sha256:${'3'.repeat(64)}`,
    disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
  };
}

function publicDelayedCall() {
  const payload = publicCall('incorrect');
  return {
    ...payload,
    call: {
      ...payload.call,
      resolution_status: 'unresolved',
      resolution: {
        status: 'delayed',
        window_status: 'closed',
        blocked_reason: 'Critical closing observations are unavailable.',
        retryable: true
      }
    }
  };
}
