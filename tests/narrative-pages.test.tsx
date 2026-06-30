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
  thesis: "The Black Bull has moved beyond pure persona speculation into visible community coordination. Ansem's airdrop strengthens the trench-revival thesis and gives the narrative more distributed cultural surface area. KOL dependency remains high, but the latest evidence improves the desk's confidence that this is a serious Solana attention-market event, not a hollow meme artifact.",
  signal_source: 'Ansem',
  attention_velocity_score: 93,
  myth_coherence_score: 88,
  centralization_risk_score: 82,
  reflexivity_risk_score: 86,
  kol_dependency_score: 93,
  trench_contagion_score: 87,
  sovereignty_score: 45,
  infopunk_verdict: 'Infopunks supports the Black Bull as a serious Solana attention-market and trench-revival signal. Infopunks do not worship signal. Infopunks map signal. KOL dependency and power concentration remain material.',
  evidence_artifacts: [
    { label: 'Persona-linked order flow', note: 'Wallet watchers keep collapsing into one symbol map.' },
    { label: 'Airdrop coordination evidence', note: 'Ansem / the linked wallet reportedly airdropped 67.38M $ANSEM to 700+ wallets, while 49.89M $ANSEM reportedly clustered around 7 wallets.', href: 'https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers' }
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
    { id: 'signal-strength', title: 'Signal Strength', score: 92, short_explanation: 'Identity and meme compression are aligned.', evidence_note: 'Airdrop evidence strengthens the coordination case while leaving concentration risk visible.', decision_state: 'strong_signal' },
    { id: 'myth-coherence', title: 'Myth Coherence', score: 88, short_explanation: 'The story is easy to repeat.', evidence_note: 'Low-friction story transfer and visible distribution are helping.', decision_state: 'watch_closely' },
    { id: 'attention-velocity', title: 'Attention Velocity', score: 93, short_explanation: 'Attention is moving fast.', evidence_note: 'The latest airdrop evidence adds distribution surface area.', decision_state: 'strong_signal' },
    { id: 'holder-power-concentration', title: 'Holder / Power Concentration', score: 82, short_explanation: 'Power concentration remains material.', evidence_note: 'Consensus can be manufactured.', decision_state: 'concentrated_power' },
    { id: 'kol-dependency', title: 'KOL Dependency', score: 93, short_explanation: 'The asset depends on one amplifier cluster.', evidence_note: 'Dependency is high.', decision_state: 'concentrated_power' },
    { id: 'reflexivity-risk', title: 'Reflexivity Risk', score: 86, short_explanation: 'Narrative belief and price can loop hard.', evidence_note: 'The market can become a mirror.', decision_state: 'high_reflexivity' },
    { id: 'trench-contagion', title: 'Trench Contagion', score: 87, short_explanation: 'The airdrop strengthens trench-revival mechanics.', evidence_note: 'Crowding risk remains visible.', decision_state: 'watch_closely' },
    { id: 'sovereignty-score', title: 'Sovereignty Score', score: 45, short_explanation: 'Durable sovereignty remains developing.', evidence_note: 'Concentration and KOL dependency keep sovereignty unproven.', decision_state: 'unproven' },
    { id: 'infopunk-verdict', title: 'Infopunk Verdict', score: 'SUPPORTIVE WATCH', short_explanation: 'Infopunks stands behind the Black Bull as a serious coordination signal while preserving the risk anatomy.', evidence_note: 'Airdrop evidence strengthens the trench-revival thesis; KOL dependency and concentration risk remain explicit.', decision_state: 'supportive_watch' }
  ],
  sections: [
    { id: 'signal-source', title: 'Signal Source', body: 'Ansem matters here as a coordination source.', card_ids: ['signal-strength', 'kol-dependency'] },
    { id: 'attention-velocity', title: 'Attention Velocity', body: 'Attention can front-run formal diligence.', card_ids: ['attention-velocity', 'trench-contagion'] },
    { id: 'holder-power-concentration', title: 'Holder / Power Concentration', body: 'Narrative assets need concentration checks.', card_ids: ['holder-power-concentration', 'sovereignty-score'] },
    { id: 'meme-fitness', title: 'Meme Fitness', body: 'The myth is compact and portable.', card_ids: ['myth-coherence'] },
    { id: 'reflexivity-risk', title: 'Reflexivity Risk', body: 'Price can validate the story long enough to pull in weaker conviction flows.', card_ids: ['reflexivity-risk'] },
    { id: 'infopunk-verdict', title: 'Infopunk Verdict', body: 'Infopunks stands behind the Black Bull as a serious coordination signal while continuing to monitor dependency, concentration, and reflexivity risk. The latest airdrop evidence strengthens the case that this is not only an attention object, but a trench-revival event with real community surface area.', card_ids: ['infopunk-verdict'] }
  ],
  asset: narrativeAsset
};

const blackBullUpdates = {
  signal_slug: 'black-bull',
  count: 6,
  latest_update: {
    update_id: 'seu_black_bull_006',
    signal_slug: 'black-bull',
    timestamp: '2026-06-30T09:30:00.000Z',
    update_type: 'verdict_change',
    summary: "Ansem's reported 67.38M $ANSEM airdrop to 700+ wallets strengthens the Black Bull's community-coordination signal and upgrades the desk verdict to Supportive Watch.",
    evidence_links: ['https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers', '/signals/black-bull'],
    previous_score: 80,
    new_score: 88,
    analyst_note: "The airdrop improves the trench-revival thesis by expanding the narrative's community surface area. Concentration risk remains material because a large portion of distributed tokens reportedly clustered around a small number of wallets, so KOL dependency and power concentration stay elevated."
  },
  summary: "Evidence update summary: Ansem's reported 67.38M $ANSEM airdrop to 700+ wallets strengthens the Black Bull's community-coordination signal and upgrades the desk verdict to Supportive Watch. Score movement: 80 -> 88. Latest signal shift: verdict_change. Reflexivity monitoring remains active. Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.",
  updates: [
    {
      update_id: 'seu_black_bull_006',
      signal_slug: 'black-bull',
      timestamp: '2026-06-30T09:30:00.000Z',
      update_type: 'verdict_change',
      summary: "Ansem's reported 67.38M $ANSEM airdrop to 700+ wallets strengthens the Black Bull's community-coordination signal and upgrades the desk verdict to Supportive Watch.",
      evidence_links: ['https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers', '/signals/black-bull'],
      previous_score: 80,
      new_score: 88,
      analyst_note: "The airdrop improves the trench-revival thesis by expanding the narrative's community surface area. Concentration risk remains material because a large portion of distributed tokens reportedly clustered around a small number of wallets, so KOL dependency and power concentration stay elevated."
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

const trollAsset = {
  id: 'narrative_asset_troll',
  slug: 'troll',
  ticker: 'TROLL',
  name: 'The Re-Indexed Archetype',
  chain: 'Solana',
  category: 'Meme Archetype / Community Takeover / Re-indexed Internet Lore',
  thesis: 'TROLL is not a fresh meme trying to become culture. It is old internet culture being reactivated by the trenches as a Solana-native community asset. Its strength comes from archetype survival, community takeover energy, and tracker-visible holder surface that has remained legible across multiple rotations.',
  signal_source: 'Community takeover + legacy internet meme archetype',
  attention_velocity_score: 82,
  myth_coherence_score: 93,
  centralization_risk_score: 72,
  reflexivity_risk_score: 78,
  kol_dependency_score: 0,
  trench_contagion_score: 86,
  sovereignty_score: 63,
  infopunk_verdict: 'Infopunks upgrades $TROLL to Durable Re-index. The signal is not novelty. The signal is survival. TROLL has lived through multiple market rotations, attention collapses, revivals, and trench regime changes. A meme that remains in circulation for more than 435 days and still carries a 64,000+ holder surface is no longer just a temporary joke. It becomes internet memory with a market wrapper. TROLL is not a fresh meme trying to become culture. TROLL is old internet culture being reactivated by the trenches.',
  evidence_artifacts: [
    { label: 'Solscan holder surface', note: 'Public tracker-visible holder surface shows 64,000+ wallets on Solscan. Infopunks treats this as a visible surface, not canonical proof of perfect distribution.', href: 'https://solscan.io/token/5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2' },
    { label: 'Community takeover profile', note: 'Community takeover framing remains central to the signal: the meme is being carried by a community-run structure rather than a single personality node.', href: 'https://dexscreener.com/solana/4w2cysotx6czaugmmwg13hdpy4qemg2czekyeqyk9ama' }
  ],
  related_routes: [{ label: 'TROLL Signal Report', href: '/signals/troll' }],
  last_updated: '2026-06-30T13:30:00.000Z'
};

const trollSignal = {
  slug: 'troll',
  type: 'signal_report',
  title: '$TROLL / The Re-Indexed Archetype',
  subtitle: 'Narrative signal report',
  thesis: trollAsset.thesis,
  disclaimer: 'This report maps signal conditions around a narrative asset. It is a narrative intelligence artifact, not a trading instruction.',
  signal_source: 'Community takeover + legacy internet meme archetype',
  asset_slug: 'troll',
  last_updated: '2026-06-30T13:30:00.000Z',
  verdict_label: 'DURABLE RE-INDEX',
  verdict_state: 'durable_re_index',
  verdict_copy: trollAsset.infopunk_verdict,
  cards: [
    { id: 'signal-strength', title: 'Signal Strength', score: 90, short_explanation: 'The signal comes from archetype survival plus community takeover structure, not from novelty.', evidence_note: 'More than 435 days in circulation and a 64,000+ tracker-visible holder surface give the re-index thesis durable evidence.', decision_state: 'strong_signal' },
    { id: 'meme-fitness', title: 'Meme Fitness', score: 96, short_explanation: 'The troll symbol is already installed in internet memory.', evidence_note: 'Legacy meme recognizability reduces explanation friction.', decision_state: 'strong_signal' },
    { id: 'myth-coherence', title: 'Myth Coherence', score: 93, short_explanation: 'The story is compact: old internet archetype, new chain, community-run reactivation.', evidence_note: 'The narrative depends on recognizable survival and return.', decision_state: 'strong_signal' },
    { id: 'community-surface', title: 'Community Surface', score: 89, short_explanation: 'Community surface is visible across the takeover framing and the tracker-visible holder surface.', evidence_note: 'A 64,000+ holder surface strengthens the surface-area case, while concentration still requires monitoring.', decision_state: 'strong_signal' },
    { id: 'archetype-survival', title: 'Archetype Survival', score: 94, short_explanation: 'Longevity strengthens the re-index thesis because the symbol survived rotations, volatility, and trench regime changes.', evidence_note: 'The signal is survival, not novelty: more than 435 days in circulation materially changes the quality of the meme case.', decision_state: 'strong_signal' },
    { id: 'attention-velocity', title: 'Attention Velocity', score: 82, short_explanation: 'Recognizable lore and trench memory keep attention moving, even though the case rests more on durability than speed.', evidence_note: 'Attention matters here, but it is secondary to the stronger evidence that the meme can persist through multiple cycles.', decision_state: 'watch_closely' },
    { id: 'trench-contagion', title: 'Trench Contagion', score: 86, short_explanation: 'Legacy meme shorthand can spread fast in trench environments.', evidence_note: 'The meme does not need a long onboarding curve.', decision_state: 'watch_closely' },
    { id: 'holder-power-concentration', title: 'Holder / Power Concentration', score: 72, short_explanation: 'The holder surface is broad enough to matter, but concentration still needs monitoring before distribution claims get over-read.', evidence_note: 'The 64,000+ holder surface is tracker-visible and useful, but it is not perfect canonical truth about distribution quality.', decision_state: 'concentrated_power' },
    { id: 'reflexivity-risk', title: 'Reflexivity Risk', score: 78, short_explanation: 'Legacy memes can reignite quickly and start reinforcing themselves.', evidence_note: 'Track whether attention loops remain evidence-led.', decision_state: 'high_reflexivity' },
    { id: 'sovereignty-score', title: 'Sovereignty Score', score: 63, short_explanation: 'Community takeover improves independence versus persona-led narratives and gives the asset a more durable ownership story.', evidence_note: 'Sovereignty is stronger than a persona-led meme, but it still depends on whether the community can defend the symbol through future rotations.', decision_state: 'watch_closely' },
    { id: 'infopunk-verdict', title: 'Infopunk Verdict', score: 'DURABLE RE-INDEX', short_explanation: 'Old internet culture reactivated by Solana trench memory.', evidence_note: 'The desk upgrades the verdict while keeping concentration, reflexivity, and evidence quality visible.', decision_state: 'durable_re_index' }
  ],
  sections: [
    { id: 'signal-source', title: 'Signal Source', body: 'TROLL\'s signal source is not one KOL. It is an old internet-native archetype plus community takeover structure.', card_ids: ['signal-strength'] },
    { id: 'archetype-survival', title: 'Archetype Survival', body: 'The signal is survival, not novelty. TROLL has remained in circulation for more than 435 days, survived rotations and volatility, and kept enough continuity for the re-index thesis to strengthen over time.', card_ids: ['meme-fitness', 'myth-coherence', 'archetype-survival'] },
    { id: 'holder-surface', title: 'Holder Surface', body: 'Public tracker and on-chain context show a 64,000+ holder surface. Infopunks treats that as a meaningful tracker-visible surface rather than perfect canonical truth, and continues to monitor concentration closely.', card_ids: ['community-surface', 'holder-power-concentration'] },
    { id: 'community-takeover', title: 'Community Takeover', body: 'The community takeover framing remains important because it shifts the signal away from single-person dependency and toward trench-level cultural maintenance.', card_ids: ['community-surface', 'sovereignty-score'] },
    { id: 'attention-velocity', title: 'Attention Velocity', body: 'TROLL has market visibility and recognizable lore, but the stronger case now comes from durability: attention is amplifying a meme that has already survived multiple regime changes.', card_ids: ['attention-velocity', 'trench-contagion'] },
    { id: 'reflexivity-risk', title: 'Reflexivity Risk', body: 'Legacy memes can revive quickly, but attention loops can also overheat. Track whether price, posting, and belief become self-reinforcing without new evidence.', card_ids: ['reflexivity-risk', 'sovereignty-score'] },
    { id: 'infopunk-verdict', title: 'Infopunk Verdict', body: trollAsset.infopunk_verdict, card_ids: ['infopunk-verdict'] }
  ],
  asset: trollAsset
};

const trollPreviousUpdate = {
  update_id: 'seu_troll_001',
  signal_slug: 'troll',
  timestamp: '2026-06-30T12:00:00.000Z',
  update_type: 'verdict_change',
  summary: 'Infopunks opens $TROLL as the second re-indexed signal report, classifying it as a legacy internet archetype entering Solana-native community takeover form.',
  evidence_links: ['https://dexscreener.com/solana/4w2cysotx6czaugmmwg13hdpy4qemg2czekyeqyk9ama', '/signals/troll'],
  new_score: 86,
  analyst_note: 'TROLL\'s signal is not novelty. The signal is resurrection. The meme already exists in internet memory; the desk is now watching whether community takeover structure, liquidity, holder surface, and trench attention can turn that legacy archetype into a durable Solana-native narrative asset.',
  risk_facets: ['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration']
} as const;

const trollLatestUpdate = {
  update_id: 'seu_troll_002',
  signal_slug: 'troll',
  timestamp: '2026-06-30T13:30:00.000Z',
  update_type: 'verdict_change',
  summary: 'Infopunks upgrades $TROLL to Durable Re-index after reclassifying its long circulation, 64,000+ holder surface, and legacy internet archetype survival as stronger evidence.',
  evidence_links: ['https://solscan.io/token/5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2', '/signals/troll'],
  previous_score: 86,
  new_score: 90,
  analyst_note: 'TROLL\'s signal is not novelty. The signal is survival. More than 435 days in circulation and a 64,000+ holder surface suggest the meme has persisted through multiple rotations instead of relying only on fresh attention. The desk upgrades the verdict while continuing to monitor concentration, reflexivity, and evidence quality.',
  risk_facets: ['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration']
} as const;

const trollUpdates = {
  signal_slug: 'troll',
  count: 2,
  latest_update: trollLatestUpdate,
  summary: 'Evidence update summary: Infopunks upgrades $TROLL to Durable Re-index after reclassifying its long circulation, 64,000+ holder surface, and legacy internet archetype survival as stronger evidence. Score movement: 86 -> 90. Latest signal shift: verdict_change. Reflexivity monitoring remains active. Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.',
  updates: [trollLatestUpdate, trollPreviousUpdate]
};

const trollUpdateDetail = {
  signal_slug: 'troll',
  update: trollUpdates.latest_update
};

const signalDesk = {
  generated_at: '2026-06-30T13:30:00.000Z',
  desk_status: 'live_watch',
  counts: {
    reports: 2,
    dispatches: 8,
    risk_shifts: 6,
    watched_signals: 2
  },
  candidate_signals: [
    {
      candidate_id: 'candidate_troll_reindex',
      name: 'The Re-Indexed Archetype',
      ticker: 'TROLL',
      chain: 'Solana',
      category: 'meme_asset',
      submitted_by: 'desk',
      status: 'promoted_to_report',
      priority: 'high',
      risk_level: 'medium',
      risk_facets: ['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration'],
      summary: 'Candidate promoted to report: $TROLL / The Re-Indexed Archetype.',
      why_it_matters: 'Legacy internet lore can re-enter the market as a community takeover signal without depending on a single persona source.',
      evidence_links: ['https://solscan.io/token/5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2', '/signals/troll'],
      created_at: '2026-06-30T11:30:00.000Z',
      updated_at: '2026-06-30T13:30:00.000Z'
    },
    {
      candidate_id: 'candidate_sol_persona_attention',
      name: 'Next attention market around a major Solana persona',
      chain: 'Solana',
      category: 'attention_market',
      submitted_by: 'desk',
      status: 'watching',
      priority: 'high',
      risk_level: 'medium',
      risk_facets: ['high_reflexivity', 'power_concentration', 'kol_dependency', 'live_watch'],
      summary: 'The desk is tracking whether a familiar Solana persona is compressing social attention into a new market object.',
      why_it_matters: 'Persona-led coordination can mint a market before durable ownership or utility becomes legible.',
      evidence_links: ['/narratives/attention-markets'],
      created_at: '2026-06-24T09:00:00.000Z',
      updated_at: '2026-06-29T00:00:00.000Z'
    },
    {
      candidate_id: 'candidate_agentic_meme_repeat_mentions',
      name: 'Agentic meme asset gaining repeat mentions',
      category: 'agentic_narrative',
      submitted_by: 'system',
      status: 'needs_evidence',
      priority: 'medium',
      risk_level: 'unknown',
      risk_facets: ['thin_evidence', 'narrative_fatigue'],
      summary: 'Repeat mentions suggest an agentic meme frame may be forming, but current evidence is still too thin for a mapped report.',
      why_it_matters: 'Repeated framing can signal that a meme is turning into a coordination rail instead of a one-cycle joke.',
      evidence_links: [],
      created_at: '2026-06-25T12:30:00.000Z',
      updated_at: '2026-06-29T00:00:00.000Z'
    }
  ],
  candidate_counts: {
    total: 3,
    queued: 0,
    watching: 1,
    needs_evidence: 1,
    under_review: 0,
    promoted_to_report: 1
  },
  featured_report: {
    slug: 'black-bull',
    ticker: 'ANSEM',
    name: 'The Black Bull',
    category: 'Attention Market / Narrative Asset',
    thesis: narrativeAsset.thesis,
    href: '/signals/black-bull',
    signal_strength: 92,
    myth_coherence: 88,
    reflexivity_risk: 86,
    sovereignty_score: 45,
    risk_facets: ['high_reflexivity', 'kol_dependency', 'power_concentration', 'unproven_sovereignty', 'live_watch'],
    desk_status: 'live_watch',
    latest_update_type: 'verdict_change',
    latest_update_at: '2026-06-30T09:30:00.000Z',
    update_count: 6
  },
  reports: [{
    slug: 'troll',
    ticker: 'TROLL',
    name: 'The Re-Indexed Archetype',
    category: 'Meme Archetype / Community Takeover / Re-indexed Internet Lore',
    thesis: trollAsset.thesis,
    href: '/signals/troll',
    verdict_label: 'DURABLE RE-INDEX',
    verdict_state: 'durable_re_index',
    signal_strength: 90,
    myth_coherence: 93,
    reflexivity_risk: 78,
    sovereignty_score: 63,
    risk_facets: ['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration'],
    desk_status: 'live_watch',
    latest_update_type: 'verdict_change',
    latest_update_at: '2026-06-30T13:30:00.000Z',
    update_count: 2
  }, {
    slug: 'black-bull',
    ticker: 'ANSEM',
    name: 'The Black Bull',
    category: 'Attention Market / Narrative Asset',
    thesis: narrativeAsset.thesis,
    href: '/signals/black-bull',
    signal_strength: 92,
    myth_coherence: 88,
    reflexivity_risk: 86,
    sovereignty_score: 45,
    risk_facets: ['high_reflexivity', 'kol_dependency', 'power_concentration', 'unproven_sovereignty', 'live_watch'],
    desk_status: 'live_watch',
    latest_update_type: 'verdict_change',
    latest_update_at: '2026-06-30T09:30:00.000Z',
    update_count: 6
  }],
  latest_dispatches: [
    {
      update_id: 'seu_troll_002',
      signal_slug: 'troll',
      signal_name: 'The Re-Indexed Archetype',
      ticker: 'TROLL',
      update_type: 'verdict_change',
      readable_update_type: 'Verdict Change',
      timestamp: '2026-06-30T13:30:00.000Z',
      summary: trollUpdates.latest_update.summary,
      analyst_note: trollUpdates.latest_update.analyst_note,
      href: '/signals/troll/updates/seu_troll_002',
      og_image: '/og/signals/troll/updates/seu_troll_002.png',
      risk_facets: ['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration'],
      previous_score: 86,
      new_score: 90,
      signal_delta: 4
    },
    ...blackBullUpdates.updates.map((update) => ({
      update_id: update.update_id,
      signal_slug: update.signal_slug,
      signal_name: 'The Black Bull',
      ticker: 'ANSEM',
      update_type: update.update_type,
      readable_update_type: update.update_type === 'verdict_change' ? 'Verdict Change' : 'Risk Shift',
      timestamp: update.timestamp,
      summary: update.summary,
      analyst_note: update.analyst_note,
      href: `/signals/${update.signal_slug}/updates/${update.update_id}`,
      og_image: `/og/signals/${update.signal_slug}/updates/${update.update_id}.png`,
      risk_facets: update.update_type === 'verdict_change'
        ? ['unproven_sovereignty', 'power_concentration', 'kol_dependency', 'live_watch']
        : ['high_reflexivity', 'live_watch'],
      previous_score: update.previous_score,
      new_score: update.new_score,
      signal_delta: typeof update.previous_score === 'number' && typeof update.new_score === 'number' ? update.new_score - update.previous_score : undefined
    }))
  ],
  risk_shifts: blackBullUpdates.updates.map((update) => ({
    update_id: update.update_id,
    signal_slug: update.signal_slug,
    signal_name: 'The Black Bull',
    ticker: 'ANSEM',
    update_type: update.update_type,
    readable_update_type: update.update_type === 'verdict_change' ? 'Verdict Change' : 'Risk Shift',
    timestamp: update.timestamp,
    summary: update.summary,
    analyst_note: update.analyst_note,
    href: `/signals/${update.signal_slug}/updates/${update.update_id}`,
    og_image: `/og/signals/${update.signal_slug}/updates/${update.update_id}.png`,
    risk_facets: update.update_type === 'verdict_change'
      ? ['unproven_sovereignty', 'power_concentration', 'kol_dependency', 'live_watch']
      : update.update_type === 'holder_shift'
        ? ['power_concentration', 'live_watch']
        : ['high_reflexivity', 'live_watch'],
    previous_score: update.previous_score,
    new_score: update.new_score,
    signal_delta: typeof update.previous_score === 'number' && typeof update.new_score === 'number' ? update.new_score - update.previous_score : undefined
  })),
  desk_activity: [
    {
      id: 'candidate_promoted_candidate_troll_reindex',
      type: 'candidate_promoted',
      timestamp: '2026-06-30T13:30:00.000Z',
      title: 'Candidate promoted to report: $TROLL / The Re-Indexed Archetype',
      summary: 'Candidate promoted to report: $TROLL / The Re-Indexed Archetype.',
      href: '/signals/troll'
    },
    {
      id: 'verdict_change_seu_troll_002',
      type: 'verdict_change',
      timestamp: '2026-06-30T13:30:00.000Z',
      title: 'Verdict changed for TROLL',
      summary: trollLatestUpdate.summary,
      href: '/signals/troll/updates/seu_troll_002'
    },
    {
      id: 'dispatch_published_seu_black_bull_006',
      type: 'dispatch_published',
      timestamp: '2026-06-30T09:30:00.000Z',
      title: 'Verdict Change published for ANSEM',
      summary: blackBullUpdates.latest_update.summary,
      href: '/signals/black-bull/updates/seu_black_bull_006'
    }
  ]
};

describe('narrative pages', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = pathOf(input);
      if (path === '/v1/signal-desk') return json(signalDesk);
      if (path === '/v1/signals/ansem') return json(ansemSignal);
      if (path === '/v1/signals/black-bull') return json(blackBullSignal);
      if (path === '/v1/signals/troll') return json(trollSignal);
      if (path === '/v1/signals/black-bull/updates') return json(blackBullUpdates);
      if (path === '/v1/signals/black-bull/updates/seu_black_bull_006') return json(blackBullUpdateDetail);
      if (path === '/v1/signals/troll/updates') return json(trollUpdates);
      if (path === '/v1/signals/troll/updates/seu_troll_002') return json(trollUpdateDetail);
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

    expect(container.textContent).toContain('Signal reports, evidence updates, and sovereignty checks for narratives that become markets.');
    expect(container.textContent).toContain('Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.');
    expect(container.textContent).toContain('Desk status');
    expect(container.textContent).toContain('Live Watch');
    expect(container.textContent).toContain('Latest Desk Dispatches');
    expect(container.textContent).toContain('Risk Shifts');
    expect(container.textContent).toContain('Reports Catalog');
    expect(container.textContent).toContain('Desk Activity Timeline');
    expect(container.textContent).toContain('ANSEM / The Black Bull');
    expect(container.textContent).toContain('TROLL / The Re-Indexed Archetype');
    expect(container.textContent).toContain('DURABLE RE-INDEX');
    expect(container.textContent).toContain('Signal Strength');
    expect(container.textContent).toContain('Myth Coherence');
    expect(container.textContent).toContain('Reflexivity Risk');
    expect(container.textContent).toContain('Sovereignty Score');
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull"]')).some((node) => node.textContent?.includes('Open Signal Report'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives/attention-markets"]')).some((node) => node.textContent?.includes('Read Attention Markets Thesis'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull/updates/seu_black_bull_006"]')).some((node) => node.textContent?.includes('Open Dispatch'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/signals/ansem"]')).some((node) => node.textContent?.includes('Ansem Signal Source'))).toBe(true);
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
    expect(container.textContent).toContain('Candidate Signals');
    expect(container.textContent).toContain('Submit Narrative for Desk Review');
    expect(container.textContent).toContain('Mapped reports show what the desk has already processed. Candidate signals show what the desk is watching next.');
    expect(container.textContent).toContain('Submitting a narrative does not create a buy call. It adds a candidate for evidence review.');
    expect(container.textContent).toContain('Next attention market around a major Solana persona');
    expect(container.textContent).toContain('Agentic meme asset gaining repeat mentions');
    expect(container.textContent).toContain('Candidate promoted to report: $TROLL / The Re-Indexed Archetype.');
    expect(container.textContent).toContain('Infopunks upgrades $TROLL to Durable Re-index');
    expect(container.querySelector('input[aria-label="Search reports and dispatches"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Update Type Filter"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Risk Facet Filter"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Signal Status Filter"]')).not.toBeNull();
    expect(container.textContent).toContain('High Reflexivity');
    expect(container.textContent).toContain('KOL Dependency');
    expect(container.textContent).toContain('Thin Evidence');
  });

  it('filters visible results by risk facet', async () => {
    await render('/narratives');

    const riskFacet = container.querySelector('select[aria-label="Risk Facet Filter"]') as HTMLSelectElement;

    await act(async () => {
      riskFacet.value = 'kol_dependency';
      riskFacet.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('The Black Bull');
    expect(container.textContent).not.toContain('Agentic meme asset gaining repeat mentions');
  });

  it('filters dispatches by update type and search', async () => {
    await render('/narratives');

    const updateType = container.querySelector('select[aria-label="Update Type Filter"]') as HTMLSelectElement;
    const search = container.querySelector('input[aria-label="Search reports and dispatches"]') as HTMLInputElement;

    await act(async () => {
      updateType.value = 'verdict_change';
      updateType.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Infopunks upgrades $TROLL to Durable Re-index');
    expect(container.textContent).toContain("Ansem's reported 67.38M $ANSEM airdrop");

    await act(async () => {
      search.value = 'durable re-index';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('The Re-Indexed Archetype');
    expect(container.textContent).not.toContain('The Black Bull report published');
  });

  it('renders risk facet chips on report, dispatch, and candidate cards', async () => {
    await render('/narratives');

    expect(container.textContent).toContain('High Reflexivity');
    expect(container.textContent).toContain('Power Concentration');
    expect(container.textContent).toContain('Unproven Sovereignty');
    expect(container.textContent).toContain('KOL Dependency');
    expect(container.textContent).toContain('Thin Evidence');
  });

  it('stages intake confirmation without claiming persistence', async () => {
    await render('/narratives');

    const name = container.querySelector('input[aria-label="Narrative name"]') as HTMLInputElement;
    const why = container.querySelector('textarea[aria-label="Why it matters"]') as HTMLTextAreaElement;
    const evidence = container.querySelector('textarea[aria-label="Evidence links"]') as HTMLTextAreaElement;
    const form = container.querySelector('form.narrative-intake-form') as HTMLFormElement;

    await act(async () => {
      name.value = 'AI wallet coordination narrative';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      name.dispatchEvent(new Event('change', { bubbles: true }));
      why.value = 'The desk should review whether coordination copy is turning into an investable narrative surface.';
      why.dispatchEvent(new Event('input', { bubbles: true }));
      why.dispatchEvent(new Event('change', { bubbles: true }));
      evidence.value = 'https://example.com/evidence';
      evidence.dispatchEvent(new Event('input', { bubbles: true }));
      evidence.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Submission staged. Connect intake persistence to make this live.');
    expect(container.textContent).not.toContain('stored');
    expect(container.textContent).not.toContain('saved permanently');
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
    expect(container.textContent).toContain("Ansem's reported 67.38M $ANSEM airdrop to 700+ wallets strengthens the Black Bull's community-coordination signal and upgrades the desk verdict to Supportive Watch.");
    expect(container.textContent).toContain('Supportive Watch');
    expect(container.textContent).toContain('community-coordination signal');
    expect(container.textContent).toContain('Airdrop coordination evidence');
    expect(Array.from(container.querySelectorAll('a[href="https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers"]')).some((node) => node.textContent?.includes('Open artifact') || node.textContent?.includes('Evidence'))).toBe(true);
    expect(container.textContent).toContain('Signal Delta');
    expect(container.textContent).toContain('80 → 88 (+8)');
    expect(container.querySelector('a[href="#living-evidence-feed"]')?.textContent).toContain('Open Living Evidence Feed');
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull/updates/seu_black_bull_006"]')).some((node) => node.textContent?.includes('Open Dispatch'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/signals/ansem"]')).some((node) => node.textContent?.includes('Ansem Signal Source'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives/attention-markets"]')).some((node) => node.textContent?.includes('Attention Markets Thesis'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives"]')).some((node) => node.textContent?.includes('Narrative Intel Index'))).toBe(true);
    expect(container.textContent).toContain('Holder / Power Concentration');
    expect(container.textContent).toContain('KOL Dependency');
    expect(container.textContent).toContain('Power Concentration');
    expect(container.textContent).toContain("Ansem's airdrop turns $ANSEM from a pure attention object into a visible trench-coordination event. Infopunks marks it Supportive Watch.");
    const verdictText = container.querySelector('section[aria-label="Infopunk Verdict"]')?.textContent ?? '';
    expect(verdictText).not.toMatch(/\bbuy\b|\bsell\b/i);
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
    await render('/signals/black-bull/updates/seu_black_bull_006');

    expect(container.textContent).toContain('Versioned Evidence Update');
    expect(container.textContent).toContain('ANSEM / The Black Bull');
    expect(container.textContent).toContain('Verdict Change');
    expect(container.textContent).toContain('Timestamp: 2026-06-30 09:30');
    expect(container.textContent).toContain("Ansem's reported 67.38M $ANSEM airdrop to 700+ wallets strengthens the Black Bull's community-coordination signal and upgrades the desk verdict to Supportive Watch.");
    expect(Array.from(container.querySelectorAll('a[href="https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers"]')).length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Analyst note:');
    expect(container.textContent).toContain('Signal Delta');
    expect(container.textContent).toContain('80 → 88 (+8)');
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
    expect(metaContent('meta[property="og:image"]')).toBe('https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_006.png');
    expect(metaContent('meta[name="twitter:image"]')).toBe('https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_006.png');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://radar.infopunks.fun/signals/black-bull/updates/seu_black_bull_006');
  });

  it('renders the TROLL report and dispatch routes', async () => {
    await render('/signals/troll');

    expect(container.textContent).toContain('$TROLL / The Re-Indexed Archetype');
    expect(container.textContent).toContain('DURABLE RE-INDEX');
    expect(container.textContent).toContain('Community Takeover');
    expect(container.textContent).toContain('Archetype Survival');
    expect(container.textContent).toContain('Meme Fitness');
    expect(container.textContent).toContain('Holder / Power Concentration');
    expect(container.textContent).toContain('The signal is not novelty. The signal is survival.');
    expect(container.textContent).toContain('64,000+ holder surface');
    expect(container.textContent).toContain('more than 435 days');
    expect(metaContent('meta[property="og:title"]')).toBe('Infopunks Signal Report: $TROLL / The Re-Indexed Archetype');
    expect(metaContent('meta[property="og:image"]')).toBe('https://radar.infopunks.fun/og/signals/troll.png');

    await render('/signals/troll/updates/seu_troll_002');

    expect(container.textContent).toContain('Desk Dispatch');
    expect(container.textContent).toContain('$TROLL / The Re-Indexed Archetype');
    expect(container.textContent).toContain('Verdict Change');
    expect(container.textContent).toContain('DURABLE RE-INDEX');
    expect(container.textContent).toContain('86 → 90 (+4)');
    expect(container.textContent).toContain('https://solscan.io/token/5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2');
    expect(document.title).toBe('Infopunks Desk Dispatch: Durable Re-index');
    expect(metaContent('meta[property="og:title"]')).toBe('Infopunks Desk Dispatch: Durable Re-index');
    expect(metaContent('meta[property="og:image"]')).toBe('https://radar.infopunks.fun/og/signals/troll/updates/seu_troll_002.png');
  });

  it('renders a clean not-found state for unknown signal update permalinks', async () => {
    await render('/signals/black-bull/updates/missing-update');

    expect(container.textContent).toContain('Signal update not found.');
    expect(Array.from(container.querySelectorAll('a[href="/signals/black-bull"]')).some((node) => node.textContent?.includes('Back to signal'))).toBe(true);
    expect(Array.from(container.querySelectorAll('a[href="/narratives"]')).some((node) => node.textContent?.includes('Back to narratives'))).toBe(true);
  });
});
