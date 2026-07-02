// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function json(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

const signalHuntSummary = {
  generated_at: '2026-07-01T12:15:00.000Z',
  counts: { total: 5, fresh_signal: 1, under_review: 1, verified_signal: 1, noise: 1, disputed: 1 },
  candidates: [
    {
      id: 'hunt_black_bull_coordination',
      title: 'Black Bull attention is mutating into community coordination',
      handle_or_source: '@ansem + community carry',
      category: 'attention_market',
      thesis: 'The signal is no longer only persona velocity. Redistribution mechanics and participant-made media are carrying the object into a broader coordination loop.',
      why_it_matters: 'Signal Hunt surfaces the intake before Narrative Intel hardens the frame.',
      evidence: ['Reported creator-fee redistribution summaries keep recirculating as trench proof.'],
      evidence_count: 3,
      signal_score: 92,
      velocity_score: 89,
      risk_score: 79,
      proof_state: 'validated',
      hunt_state: 'verified_signal',
      decision_state: 'signal',
      submitted_by: 'desk',
      submitted_at: '2026-07-01T09:00:00.000Z',
      updated_at: '2026-07-01T12:15:00.000Z',
      linked_check_ids: ['check_route_pay_sh_seed'],
      linked_loop_ids: ['loop_pre_spend_route'],
      linked_signal_ids: ['black-bull'],
      linked_route_ids: ['route_pay_sh_market_research_01'],
      tags: ['coordination', 'attention-market']
    },
    {
      id: 'hunt_troll_reindex',
      title: 'TROLL is behaving like internet memory, not fresh meme novelty',
      handle_or_source: 'Community takeover / Solscan / Dexscreener',
      category: 'meme_archetype',
      thesis: 'The signal is survival.',
      why_it_matters: 'Signal Hunt should catch re-indexed culture before the market narrative pretends it appeared from nowhere.',
      evidence: ['The asset carries a long-circulation survival frame instead of a one-cycle novelty frame.'],
      evidence_count: 3,
      signal_score: 88,
      velocity_score: 74,
      risk_score: 67,
      proof_state: 'receipts_attached',
      hunt_state: 'under_review',
      decision_state: 'review',
      submitted_by: 'community',
      submitted_at: '2026-06-30T11:30:00.000Z',
      updated_at: '2026-07-01T08:40:00.000Z',
      linked_check_ids: ['check_provider_reliability_seed'],
      linked_loop_ids: [],
      linked_signal_ids: ['troll'],
      linked_route_ids: [],
      tags: ['reindex', 'meme']
    },
    {
      id: 'hunt_machine_wallet_desks',
      title: 'Machine-wallet infra is becoming public culture instead of back-office plumbing',
      handle_or_source: 'Machine market stack / Signal Graph',
      category: 'agent_infra',
      thesis: 'Machine identity, wallet rails, and preflight policy are starting to compress into one memetic stack.',
      why_it_matters: 'Signal Hunt is the intake layer that lets culture-facing discovery attach to the serious machine-market and pre-spend stack before claims harden.',
      evidence: ['Machine market coverage has expanded into route risk, receipts, and first-safe planning.'],
      evidence_count: 3,
      signal_score: 81,
      velocity_score: 71,
      risk_score: 58,
      proof_state: 'unproven',
      hunt_state: 'fresh_signal',
      decision_state: 'review',
      submitted_by: 'desk',
      submitted_at: '2026-06-29T15:20:00.000Z',
      updated_at: '2026-07-01T07:00:00.000Z',
      linked_check_ids: [],
      linked_loop_ids: ['loop_provider_trust'],
      linked_signal_ids: [],
      linked_route_ids: ['route_pay_sh_market_research_03'],
      tags: ['machine-markets']
    },
    {
      id: 'hunt_persona_copytrade_noise',
      title: 'Another persona ticker is recycling the same copy-trade myth',
      handle_or_source: '@reply_gang_monitor',
      category: 'attention_market',
      thesis: 'The object is reading like a thin persona wrapper with weak receipts and derivative copy.',
      why_it_matters: 'Signal Hunt needs an explicit noise lane so the public loop can see rejected intake, not only the winners.',
      evidence: ['Evidence is mostly screenshots of posts rather than durable proof.'],
      evidence_count: 3,
      signal_score: 34,
      velocity_score: 63,
      risk_score: 88,
      proof_state: 'rejected',
      hunt_state: 'noise',
      decision_state: 'noise',
      submitted_by: 'system',
      submitted_at: '2026-06-28T21:10:00.000Z',
      updated_at: '2026-06-30T06:40:00.000Z',
      linked_check_ids: [],
      linked_loop_ids: [],
      linked_signal_ids: [],
      linked_route_ids: [],
      tags: ['noise']
    },
    {
      id: 'hunt_disputed_provider_rep',
      title: 'Provider reputation thread is splitting between proof and vibes',
      handle_or_source: 'Provider Reputation / Proof Feed',
      category: 'provider_reputation',
      thesis: 'A provider-quality story is spreading faster than the receipts supporting it.',
      why_it_matters: 'Signal Hunt should connect culture-layer intake to provider reputation and evidence-led challenge flows.',
      evidence: ['Proof checks and dispute language are both increasing around the same subject.'],
      evidence_count: 3,
      signal_score: 61,
      velocity_score: 69,
      risk_score: 83,
      proof_state: 'challenged',
      hunt_state: 'disputed',
      decision_state: 'review',
      submitted_by: 'community',
      submitted_at: '2026-06-27T17:45:00.000Z',
      updated_at: '2026-07-01T05:30:00.000Z',
      linked_check_ids: ['check_provider_reliability_seed'],
      linked_loop_ids: ['loop_provider_trust'],
      linked_signal_ids: [],
      linked_route_ids: [],
      tags: ['challenged']
    }
  ]
};

const signalHuntDetail = {
  ...signalHuntSummary.candidates[0],
  evidence: [
    'Reported creator-fee redistribution summaries keep recirculating as trench proof.',
    'Holder-growth screenshots and participant-made media are now part of the public loop.',
    'Linked signal reports and watch pages already exist downstream in Narrative Intel.'
  ]
};

async function renderApp(container: HTMLElement) {
  const root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return root;
}

describe('signal hunt pages', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/signal-hunt') return json(signalHuntSummary);
      if (path === '/v1/signal-hunt/hunt_black_bull_coordination') return json(signalHuntDetail);
      if (path === '/v1/graph/entities/narrative/black-bull') return json({
        entity_type: 'narrative',
        entity_id: 'black-bull',
        nodes: [{
          id: 'node_black_bull',
          label: 'Black Bull coordination',
          cluster_id: 'narrative_intel',
          proof_state: 'validated',
          confidence_score: 92,
          velocity_score: 89
        }]
      });
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    root = null;
  });

  it('renders the Signal Hunt landing page and nav state', async () => {
    window.history.replaceState({}, '', '/signal-hunt');
    root = await renderApp(container);

    expect(container.textContent).toContain('Signal Hunt');
    expect(container.textContent).toContain('Find signal before it becomes consensus.');
    expect(container.textContent).toContain('Most timelines see noise. Infopunks hunt signal.');
    expect(container.textContent).toContain('Signal Hunt turns CT attention into reusable intelligence.');
    expect(container.textContent).toContain('Fresh Signals');
    expect(container.textContent).toContain('Under Review');
    expect(container.textContent).toContain('Verified Signals');
    expect(container.textContent).toContain('Noise / Rejected');
    expect(container.textContent).toContain('Find signal -> attach evidence -> verify receipts -> feed LoopLab -> update agent judgment');
    expect(container.textContent).toContain('How The Hunt Works');
    expect(container.textContent).toContain('Why this matters for agents');
    expect(container.textContent).toContain('Why this matters for CT');
    expect(container.textContent).toContain('Proof Trail');
    expect(container.textContent).toContain('Submit Signal');
    expect(container.textContent).toContain('Verify Signal');
    expect(container.querySelector('a[href="/signal-hunt"]')?.getAttribute('aria-current')).toBe('page');
    expect(Array.from(container.querySelectorAll('a[href="/signal-hunt/hunt_black_bull_coordination"]')).length).toBeGreaterThan(0);
  });

  it('renders the Signal Hunt detail page with linked proof and graph context', async () => {
    window.history.replaceState({}, '', '/signal-hunt/hunt_black_bull_coordination');
    root = await renderApp(container);

    expect(container.textContent).toContain('Black Bull attention is mutating into community coordination');
    expect(container.textContent).toContain('Decision panel');
    expect(container.textContent).toContain('Signal: receipts attached');
    expect(container.textContent).toContain('Evidence list');
    expect(container.textContent).toContain('Proof Feed checks');
    expect(container.textContent).toContain('LoopLab runs');
    expect(container.textContent).toContain('Turn signal into proof, memory, and judgment.');
    expect(container.textContent).toContain('Signal Graph context');
    expect(container.querySelector('a[href="/check/check_route_pay_sh_seed"]')?.textContent).toContain('check_route_pay_sh_seed');
    expect(container.querySelector('a[href="/loops/loop_pre_spend_route"]')?.textContent).toContain('loop_pre_spend_route');
    expect(container.querySelector('a[href="/signals/black-bull"]')?.textContent).toContain('black-bull');
    expect(Array.from(container.querySelectorAll('a[href="/spend-terminal"]')).some((node) => node.textContent?.includes('Open Pre-Spend Terminal'))).toBe(true);
  });
});
