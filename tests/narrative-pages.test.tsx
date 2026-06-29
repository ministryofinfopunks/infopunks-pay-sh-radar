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

function metaContent(selector: string) {
  return document.head.querySelector(selector)?.getAttribute('content');
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

const blackBullUpdates = {
  signal_slug: 'black-bull',
  count: 5,
  latest_update: {
    update_id: 'seu_black_bull_005',
    signal_slug: 'black-bull',
    timestamp: '2026-06-28T18:20:00.000Z',
    update_type: 'verdict_change',
    summary: 'Infopunks classifies ANSEM / The Black Bull as a high-signal but high-reflexivity narrative asset.',
    evidence_links: ['/signals/black-bull', '/narratives/attention-markets'],
    previous_score: 74,
    new_score: 80,
    analyst_note: 'The report remains non-directional. This is not a buy/sell call. It is a signal map.'
  },
  summary: 'Evidence update summary: Infopunks classifies ANSEM / The Black Bull as a high-signal but high-reflexivity narrative asset. Score movement: 74 -> 80. Latest signal shift: verdict_change. Reflexivity monitoring remains active. Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.',
  updates: [
    {
      update_id: 'seu_black_bull_005',
      signal_slug: 'black-bull',
      timestamp: '2026-06-28T18:20:00.000Z',
      update_type: 'verdict_change',
      summary: 'Infopunks classifies ANSEM / The Black Bull as a high-signal but high-reflexivity narrative asset.',
      evidence_links: ['/signals/black-bull', '/narratives/attention-markets'],
      previous_score: 74,
      new_score: 80,
      analyst_note: 'The report remains non-directional. This is not a buy/sell call. It is a signal map.'
    },
    {
      update_id: 'seu_black_bull_004',
      signal_slug: 'black-bull',
      timestamp: '2026-06-27T14:45:00.000Z',
      update_type: 'risk_shift',
      summary: 'Reflexivity risk increased as the asset became more dependent on attention loops between price, posting, and belief.',
      evidence_links: ['/signals/black-bull'],
      previous_score: 71,
      new_score: 82,
      analyst_note: 'High reflexivity is not automatically bearish, but it means the loop requires active monitoring.'
    }
  ]
};

const blackBullUpdateDetail = {
  signal_slug: 'black-bull',
  update: blackBullUpdates.latest_update
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
      if (path === '/v1/signals/black-bull/updates') return json(blackBullUpdates);
      if (path === '/v1/signals/black-bull/updates/seu_black_bull_005') return json(blackBullUpdateDetail);
      if (path === '/v1/signals/ansem/updates') return json({ signal_slug: 'ansem', count: 0, latest_update: null, summary: 'Evidence update summary: no evidence updates yet.', updates: [] });
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
    expect(container.textContent).toContain('First Narrative Asset Intelligence Report');
    expect(container.textContent).toContain('$ANSEM / The Black Bull');
    expect(container.textContent).toContain('A live signal report on what happens when persona, attention, myth, wallet flows, and market reflexivity become one tradable object.');
    expect(container.textContent).toContain('Signal Strength');
    expect(container.textContent).toContain('Myth Coherence');
    expect(container.textContent).toContain('Reflexivity Risk');
    expect(container.textContent).toContain('Sovereignty Status');
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull"]')).some((node) => node.textContent?.includes('Open Signal Report'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives/attention-markets"]')).some((node) => node.textContent?.includes('Read Attention Markets Thesis'))).toBe(true);
    expect(container.querySelector('a[href="/narratives"]')?.textContent).toContain('Narrative Intel');
    expect(container.textContent).toContain('ANSEM / The Black Bull');
    expect(document.title).toBe('Infopunks Narrative Asset Intelligence');
    expect(metaContent('meta[name="description"]')).toBe('Signal reports, evidence updates, and sovereignty checks for narratives that become markets.');
    expect(metaContent('meta[property="og:title"]')).toBe('Infopunks Narrative Asset Intelligence');
    expect(metaContent('meta[property="og:description"]')).toBe('Signal reports, evidence updates, and sovereignty checks for narratives that become markets.');
    expect(metaContent('meta[name="twitter:title"]')).toBe('Infopunks Narrative Asset Intelligence');
    expect(metaContent('meta[name="twitter:description"]')).toBe('Signal reports, evidence updates, and sovereignty checks for narratives that become markets.');
    expect(metaContent('meta[property="og:image"]')).toBe('https://radar.infopunks.fun/og/narratives.png');
    expect(metaContent('meta[name="twitter:image"]')).toBe('https://radar.infopunks.fun/og/narratives.png');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://radar.infopunks.fun/narratives');
  });

  it('renders the attention markets page', async () => {
    await render('/narratives/attention-markets');

    expect(container.textContent).toContain('personas can become liquidity');
    expect(container.textContent).toContain('memes can become coordination rails');
    expect(container.textContent).toContain('wallets can become myth objects');
    expect(container.textContent).toContain('attention velocity can precede price action');
    expect(container.textContent).toContain('narrative assets require sovereignty checks');
    expect(container.textContent).toContain('Narrative Asset Intelligence Method');
    expect(container.textContent).toContain('Detect Narrative Asset');
    expect(container.textContent).toContain('Publish Versioned Evidence Updates');
  });

  it('renders the Ansem signal source page without sounding like advice', async () => {
    await render('/signals/ansem');

    expect(container.textContent).toContain('Ansem');
    expect(container.textContent).toContain('This page maps a signal source. It is not financial advice');
    expect(container.textContent).toContain('Signal Source');
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull"]')).some((node) => node.textContent?.includes('Black Bull Signal Report'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives/attention-markets"]')).some((node) => node.textContent?.includes('Attention Markets Thesis'))).toBe(true);
  });

  it('renders the living intelligence desk elements on the Black Bull report', async () => {
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
    expect(container.textContent).toContain('Living Evidence Feed');
    expect(container.textContent).toContain('Latest Desk Update');
    expect(container.textContent).toContain('Report Freshness');
    expect(container.textContent).toContain('Live Watch');
    expect(container.textContent).toContain('Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.');
    expect(container.textContent).toContain('Reports are not final. Signals mutate.');
    expect(container.textContent).toContain('Share Lines');
    expect(container.textContent).toContain('Do Not Worship Signal');
    expect(container.textContent).toContain('Narrative Asset Intelligence Method');
    expect(container.textContent).toContain("Solana is entering the attention-market era. Personas become liquidity. Memes become coordination rails.");
    expect(container.textContent).toContain('High signal does not mean low risk.');
    expect(container.textContent).toContain('Infopunks classifies ANSEM / The Black Bull as a high-signal but high-reflexivity narrative asset.');
    expect(container.textContent).toContain('Signal Delta');
    expect(container.textContent).toContain('74 → 80 (+6)');
    expect(container.querySelector('a[href="#living-evidence-feed"]')?.textContent).toContain('Open Living Evidence Feed');
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull/updates/seu_black_bull_005"]')).some((node) => node.textContent?.includes('Open Dispatch'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/signals/ansem"]')).some((node) => node.textContent?.includes('Ansem Signal Source'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives/attention-markets"]')).some((node) => node.textContent?.includes('Attention Markets Thesis'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives"]')).some((node) => node.textContent?.includes('Narrative Intel Index'))).toBe(true);
    expect(container.textContent).toContain('Holder / Power Concentration');
    expect(container.textContent).toContain('do_not_chase'.replaceAll('_', ' '));
    expect(document.title).toBe('Infopunks Signal Report: $ANSEM / The Black Bull');
    expect(metaContent('meta[name="description"]')).toBe('A living Narrative Asset Intelligence report on financialized attention, myth, power concentration, and reflexivity risk.');
    expect(metaContent('meta[property="og:title"]')).toBe('Infopunks Signal Report: $ANSEM / The Black Bull');
    expect(metaContent('meta[property="og:description"]')).toBe('A living Narrative Asset Intelligence report on financialized attention, myth, power concentration, and reflexivity risk.');
    expect(metaContent('meta[name="twitter:title"]')).toBe('Infopunks Signal Report: $ANSEM / The Black Bull');
    expect(metaContent('meta[name="twitter:description"]')).toBe('A living Narrative Asset Intelligence report on financialized attention, myth, power concentration, and reflexivity risk.');
    expect(metaContent('meta[property="og:image"]')).toBe('https://radar.infopunks.fun/og/signals/black-bull.png');
    expect(metaContent('meta[name="twitter:image"]')).toBe('https://radar.infopunks.fun/og/signals/black-bull.png');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://radar.infopunks.fun/signals/black-bull');
  });

  it('renders the signal update permalink as a standalone dispatch artifact', async () => {
    await render('/signals/black-bull/updates/seu_black_bull_005');

    expect(container.textContent).toContain('Versioned Evidence Update');
    expect(container.textContent).toContain('ANSEM / The Black Bull');
    expect(container.textContent).toContain('Verdict Change');
    expect(container.textContent).toContain('Timestamp: 2026-06-28 18:20');
    expect(container.textContent).toContain('Infopunks classifies ANSEM / The Black Bull as a high-signal but high-reflexivity narrative asset.');
    expect(container.textContent).toContain('Analyst note:');
    expect(container.textContent).toContain('Signal Delta');
    expect(container.textContent).toContain('74 → 80 (+6)');
    expect(container.textContent).toContain('Desk Dispatch');
    expect(container.textContent).toContain('Infopunks Signal Update: Verdict Change detected for ANSEM / The Black Bull. Reports are not final. Signals mutate.');
    expect(container.querySelector('button[aria-label="Copy Desk Dispatch"]')).not.toBeNull();
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull"]')).some((node) => node.textContent?.includes('Back to signal'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives/attention-markets"]')).some((node) => node.textContent?.includes('Attention Markets'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives"]')).some((node) => node.textContent?.includes('Narratives'))).toBe(true);
    expect(document.title).toBe('Infopunks Desk Dispatch: Verdict Change');
    expect(metaContent('meta[name="description"]')).toBe('ANSEM / The Black Bull signal update. Reports are not final. Signals mutate.');
    expect(metaContent('meta[property="og:title"]')).toBe('Infopunks Desk Dispatch: Verdict Change');
    expect(metaContent('meta[property="og:description"]')).toBe('ANSEM / The Black Bull signal update. Reports are not final. Signals mutate.');
    expect(metaContent('meta[name="twitter:title"]')).toBe('Infopunks Desk Dispatch: Verdict Change');
    expect(metaContent('meta[name="twitter:description"]')).toBe('ANSEM / The Black Bull signal update. Reports are not final. Signals mutate.');
    expect(metaContent('meta[property="og:image"]')).toBe('https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_005.png');
    expect(metaContent('meta[name="twitter:image"]')).toBe('https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_005.png');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://radar.infopunks.fun/signals/black-bull/updates/seu_black_bull_005');
  });

  it('renders a clean not-found state for unknown signal update permalinks', async () => {
    await render('/signals/black-bull/updates/missing-update');

    expect(container.textContent).toContain('Signal update not found.');
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull"]')).some((node) => node.textContent?.includes('Back to signal'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives"]')).some((node) => node.textContent?.includes('Back to narratives'))).toBe(true);
  });
});
