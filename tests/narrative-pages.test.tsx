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

const narrativeAsset = {
  id: 'narrative_asset_black_bull',
  slug: 'black-bull',
  ticker: 'ANSEM',
  name: 'The Black Bull',
  chain: 'Solana',
  category: 'Attention Market / Narrative Asset',
  thesis: '$ANSEM is a live experiment in financialized attention, where persona, meme, wallet flows, and community belief become a tradable signal object.',
  signal_source: 'Ansem',
  attention_velocity_score: 91,
  myth_coherence_score: 84,
  centralization_risk_score: 78,
  reflexivity_risk_score: 88,
  kol_dependency_score: 93,
  trench_contagion_score: 81,
  sovereignty_score: 34,
  infopunk_verdict: 'Infopunks do not worship signal. Infopunks map signal.',
  evidence_artifacts: [
    { label: 'Persona-linked order flow', note: 'Wallet watchers keep collapsing into one symbol map.' }
  ],
  related_routes: [{ label: 'Black Bull Signal Report', href: '/signals/black-bull' }],
  last_updated: '2026-06-29T00:00:00.000Z'
};

const ansemSignal = {
  slug: 'ansem',
  type: 'signal_source',
  title: 'Ansem',
  subtitle: 'Signal source profile',
  thesis: 'Ansem operates here as a signal source.',
  disclaimer: 'This page maps a signal source. It is not financial advice and it is not a buy or sell call.',
  signal_source: 'Ansem',
  asset_slug: 'black-bull',
  last_updated: '2026-06-29T00:00:00.000Z',
  cards: [
    { id: 'signal-strength', title: 'Signal Strength', score: 89, short_explanation: 'Persona visibility and wallet attention are moving together.', evidence_note: 'Identity is routing attention.', decision_state: 'strong_signal' }
  ],
  sections: [
    { id: 'signal-source', title: 'Signal Source', body: 'Ansem is treated here as a signal node, not a recommendation engine.', card_ids: ['signal-strength'] }
  ],
  asset: narrativeAsset
};

const blackBullSignal = {
  slug: 'black-bull',
  type: 'signal_report',
  title: '$ANSEM / The Black Bull',
  subtitle: 'Narrative signal report',
  thesis: narrativeAsset.thesis,
  disclaimer: 'This report maps signal conditions around a narrative asset. It is not investment advice.',
  signal_source: 'Ansem',
  asset_slug: 'black-bull',
  last_updated: '2026-06-29T00:00:00.000Z',
  cards: [
    { id: 'signal-strength', title: 'Signal Strength', score: 89, short_explanation: 'Identity and meme compression are aligned.', evidence_note: 'Signal is legible before it is stable.', decision_state: 'strong_signal' },
    { id: 'myth-coherence', title: 'Myth Coherence', score: 84, short_explanation: 'The story is easy to repeat.', evidence_note: 'Low-friction story transfer is helping.', decision_state: 'watch_closely' },
    { id: 'attention-velocity', title: 'Attention Velocity', score: 91, short_explanation: 'Attention is moving fast.', evidence_note: 'Velocity can precede price action.', decision_state: 'strong_signal' },
    { id: 'holder-power-concentration', title: 'Holder / Power Concentration', score: 78, short_explanation: 'Power concentration remains material.', evidence_note: 'Consensus can be manufactured.', decision_state: 'concentrated_power' },
    { id: 'kol-dependency', title: 'KOL Dependency', score: 93, short_explanation: 'The asset depends on one amplifier cluster.', evidence_note: 'Dependency is high.', decision_state: 'concentrated_power' },
    { id: 'reflexivity-risk', title: 'Reflexivity Risk', score: 88, short_explanation: 'Narrative belief and price can loop hard.', evidence_note: 'The market can become a mirror.', decision_state: 'high_reflexivity' },
    { id: 'trench-contagion', title: 'Trench Contagion', score: 81, short_explanation: 'Copy-trade trench behavior can spread fast.', evidence_note: 'Crowding risk is visible.', decision_state: 'do_not_chase' },
    { id: 'sovereignty-score', title: 'Sovereignty Score', score: 34, short_explanation: 'Meaning is still borrowed.', evidence_note: 'Sovereignty remains thin.', decision_state: 'unproven' },
    { id: 'infopunk-verdict', title: 'Infopunk Verdict', score: 'MAP ONLY', short_explanation: 'Strong signal does not equal strong sovereignty.', evidence_note: 'Map signal. Do not chase it.', decision_state: 'do_not_chase' }
  ],
  sections: [
    { id: 'signal-source', title: 'Signal Source', body: 'Ansem matters here as a coordination source.', card_ids: ['signal-strength', 'kol-dependency'] },
    { id: 'attention-velocity', title: 'Attention Velocity', body: 'Attention can front-run formal diligence.', card_ids: ['attention-velocity', 'trench-contagion'] },
    { id: 'holder-power-concentration', title: 'Holder / Power Concentration', body: 'Narrative assets need concentration checks.', card_ids: ['holder-power-concentration', 'sovereignty-score'] },
    { id: 'meme-fitness', title: 'Meme Fitness', body: 'The myth is compact and portable.', card_ids: ['myth-coherence'] },
    { id: 'reflexivity-risk', title: 'Reflexivity Risk', body: 'Price can validate the story long enough to pull in weaker conviction flows.', card_ids: ['reflexivity-risk'] },
    { id: 'infopunk-verdict', title: 'Infopunk Verdict', body: 'Infopunks map the signal first.', card_ids: ['infopunk-verdict'] }
  ],
  asset: narrativeAsset
};

describe('narrative pages', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/narratives') return json([narrativeAsset]);
      if (path === '/v1/signals/ansem') return json(ansemSignal);
      if (path === '/v1/signals/black-bull') return json(blackBullSignal);
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  async function render(path: string) {
    window.history.pushState({}, '', path);
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('renders the narrative index and seeded copy', async () => {
    await render('/narratives');

    expect(container.textContent).toContain('Infopunks maps attention markets before they become consensus.');
    expect(container.textContent).toContain('Infopunks do not worship signal. Infopunks map signal.');
    expect(container.querySelector('a[href="/narratives"]')?.textContent).toContain('Narrative Intel');
    expect(container.textContent).toContain('ANSEM / The Black Bull');
  });

  it('renders the attention markets page', async () => {
    await render('/narratives/attention-markets');

    expect(container.textContent).toContain('personas can become liquidity');
    expect(container.textContent).toContain('memes can become coordination rails');
    expect(container.textContent).toContain('wallets can become myth objects');
    expect(container.textContent).toContain('attention velocity can precede price action');
    expect(container.textContent).toContain('narrative assets require sovereignty checks');
  });

  it('renders the Ansem signal source page without sounding like advice', async () => {
    await render('/signals/ansem');

    expect(container.textContent).toContain('Ansem');
    expect(container.textContent).toContain('This page maps a signal source. It is not financial advice');
    expect(container.textContent).toContain('Signal Source');
  });

  it('renders all narrative score cards on the Black Bull report', async () => {
    await render('/signals/black-bull');

    for (const label of [
      'Signal Source',
      'Attention Velocity',
      'Holder / Power Concentration',
      'Meme Fitness',
      'Reflexivity Risk',
      'Infopunk Verdict',
      'Signal Strength',
      'Myth Coherence',
      'KOL Dependency',
      'Trench Contagion',
      'Sovereignty Score'
    ]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.textContent).toContain('Holder / Power Concentration');
    expect(container.textContent).toContain('do_not_chase'.replaceAll('_', ' '));
  });
});
