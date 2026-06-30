import type { NarrativeAsset, NarrativeSignalSurface } from '../schemas/entities';

const LAST_UPDATED = '2026-06-30T09:30:00.000Z';

export const narrativeAssets: NarrativeAsset[] = [
  {
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
      {
        label: 'Persona-linked order flow',
        note: 'Wallet watchers and social propagation keep collapsing into one symbol map.'
      },
      {
        label: 'Myth compression',
        note: 'Ticker, persona, and meme identity remain unusually legible for an early narrative market.'
      },
      {
        label: 'Crowded trench reflex',
        note: 'Attention spikes can convert directly into copy-trade contagion before durable ownership forms.'
      },
      {
        label: 'Airdrop coordination evidence',
        note: 'Ansem / the linked wallet reportedly airdropped 67.38M $ANSEM to 700+ wallets, while 49.89M $ANSEM reportedly clustered around 7 wallets.',
        href: 'https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers'
      }
    ],
    related_routes: [
      { label: 'Narrative Intel', href: '/narratives' },
      { label: 'Attention Markets', href: '/narratives/attention-markets' },
      { label: 'Ansem Signal Source', href: '/signals/ansem' },
      { label: 'Black Bull Signal Report', href: '/signals/black-bull' }
    ],
    last_updated: LAST_UPDATED,
    title: 'Narrative Asset Intelligence',
    heat: 91,
    momentum: 84,
    providerIds: [],
    keywords: ['solana', 'attention market', 'kol', 'meme coin', 'persona liquidity'],
    summary: '$ANSEM compresses persona, meme, and wallet attention into a tradable narrative object.',
    severity: 'warning',
    severity_reason: 'Attention is strong, but concentration and reflexivity remain high.',
    severity_score: 78,
    severity_window: '7d',
    evidence: []
  }
];

const blackBull = narrativeAssets[0];

export const signalSurfaces: NarrativeSignalSurface[] = [
  {
    slug: 'ansem',
    type: 'signal_source',
    title: 'Ansem',
    subtitle: 'Signal source profile',
    thesis: 'Ansem operates here as a signal source. The question is not whether the persona is right. The question is how fast that persona can coordinate belief, wallets, and meme transmission.',
    disclaimer: 'This page maps a signal source. It is not financial advice and it is not a buy or sell call.',
    signal_source: 'Ansem',
    asset_slug: 'black-bull',
    last_updated: LAST_UPDATED,
    cards: [
      {
        id: 'signal-strength',
        title: 'Signal Strength',
        score: 92,
        short_explanation: 'Persona visibility, memetic clarity, and wallet attention are moving in sync.',
        evidence_note: 'Attention is reaching the asset through identity before fundamentals.',
        decision_state: 'strong_signal'
      },
      {
        id: 'kol-dependency',
        title: 'KOL Dependency',
        score: blackBull.kol_dependency_score,
        short_explanation: 'Narrative persistence is heavily linked to one amplifier cluster.',
        evidence_note: 'If the source attention cools, liquidity reflex can cool with it.',
        decision_state: 'concentrated_power'
      },
      {
        id: 'sovereignty-score',
        title: 'Sovereignty Score',
        score: blackBull.sovereignty_score,
        short_explanation: 'The market still depends on borrowed identity, not independent mission gravity.',
        evidence_note: 'Sovereignty remains thin relative to narrative intensity.',
        decision_state: 'unproven'
      }
    ],
    sections: [
      {
        id: 'signal-source',
        title: 'Signal Source',
        body: 'Ansem is treated here as an originating signal node for social coordination, not as an oracle. Infopunks maps how persona-driven flows can become tradable attention markets.',
        card_ids: ['signal-strength', 'kol-dependency', 'sovereignty-score']
      }
    ],
    asset: blackBull
  },
  {
    slug: 'black-bull',
    type: 'signal_report',
    title: '$ANSEM / The Black Bull',
    subtitle: 'Narrative signal report',
    thesis: blackBull.thesis,
    disclaimer: 'This report maps signal conditions around a narrative asset. It is not investment advice.',
    signal_source: 'Ansem',
    asset_slug: 'black-bull',
    last_updated: LAST_UPDATED,
    cards: [
      {
        id: 'signal-strength',
        title: 'Signal Strength',
        score: 92,
        short_explanation: 'Identity, meme compression, wallet attention, and visible airdrop coordination now register as a serious live signal object.',
        evidence_note: 'Airdrop evidence strengthens the coordination case while leaving concentration risk visible.',
        decision_state: 'strong_signal'
      },
      {
        id: 'myth-coherence',
        title: 'Myth Coherence',
        score: blackBull.myth_coherence_score,
        short_explanation: 'The story is easy to repeat: persona becomes symbol, symbol becomes coordination rail, airdrop becomes trench surface area.',
        evidence_note: 'Low-friction story transfer and visible distribution are helping the asset spread.',
        decision_state: 'watch_closely'
      },
      {
        id: 'attention-velocity',
        title: 'Attention Velocity',
        score: blackBull.attention_velocity_score,
        short_explanation: 'Attention is moving faster than conventional diligence cycles and now has stronger community-coordination evidence.',
        evidence_note: 'Velocity is leading perception; the latest airdrop evidence adds distribution surface area.',
        decision_state: 'strong_signal'
      },
      {
        id: 'holder-power-concentration',
        title: 'Holder / Power Concentration',
        score: blackBull.centralization_risk_score,
        short_explanation: 'Power concentration remains material across wallets and narrative steering.',
        evidence_note: 'A small set of actors can distort the market’s apparent consensus.',
        decision_state: 'concentrated_power'
      },
      {
        id: 'kol-dependency',
        title: 'KOL Dependency',
        score: blackBull.kol_dependency_score,
        short_explanation: 'The asset depends heavily on one reputation engine and adjacent amplification bands.',
        evidence_note: 'Dependency risk is higher than organic sovereignty.',
        decision_state: 'concentrated_power'
      },
      {
        id: 'reflexivity-risk',
        title: 'Reflexivity Risk',
        score: blackBull.reflexivity_risk_score,
        short_explanation: 'Narrative belief, price movement, and more belief can loop aggressively here.',
        evidence_note: 'The market can become a mirror before it becomes a thesis.',
        decision_state: 'high_reflexivity'
      },
      {
        id: 'trench-contagion',
        title: 'Trench Contagion',
        score: blackBull.trench_contagion_score,
        short_explanation: 'The airdrop strengthens trench-revival mechanics by giving the narrative more wallets and cultural surface area.',
        evidence_note: 'Crowding risk remains visible because reflexive attention can still outrun durable ownership.',
        decision_state: 'watch_closely'
      },
      {
        id: 'sovereignty-score',
        title: 'Sovereignty Score',
        score: blackBull.sovereignty_score,
        short_explanation: 'The airdrop improves independent community surface area, but durable sovereignty remains developing.',
        evidence_note: 'Concentration and KOL dependency keep sovereignty unproven despite a higher coordination score.',
        decision_state: 'unproven'
      },
      {
        id: 'infopunk-verdict',
        title: 'Infopunk Verdict',
        score: 'SUPPORTIVE WATCH',
        short_explanation: 'Infopunks stands behind the Black Bull as a serious coordination signal while preserving the risk anatomy.',
        evidence_note: 'Airdrop evidence strengthens the trench-revival thesis; KOL dependency and concentration risk remain explicit.',
        decision_state: 'supportive_watch'
      }
    ],
    sections: [
      {
        id: 'signal-source',
        title: 'Signal Source',
        body: 'Ansem matters here as a coordination source, not as a recommendation engine. Persona can route attention into a market faster than fundamentals can catch up.',
        card_ids: ['signal-strength', 'kol-dependency']
      },
      {
        id: 'attention-velocity',
        title: 'Attention Velocity',
        body: 'When social compression, wallet watchers, and trench chatter converge, attention velocity can front-run formal price discovery.',
        card_ids: ['attention-velocity', 'trench-contagion']
      },
      {
        id: 'holder-power-concentration',
        title: 'Holder / Power Concentration',
        body: 'Narrative assets need concentration checks because wallet clusters and steering accounts can manufacture the feeling of broad consensus.',
        card_ids: ['holder-power-concentration', 'sovereignty-score']
      },
      {
        id: 'meme-fitness',
        title: 'Meme Fitness',
        body: 'The tighter the myth, the faster the market coordinates. This one is compact, memorable, and legible to trenches.',
        card_ids: ['myth-coherence']
      },
      {
        id: 'reflexivity-risk',
        title: 'Reflexivity Risk',
        body: 'Attention assets can become self-referential quickly. Price can validate the story long enough to pull in weaker conviction flows.',
        card_ids: ['reflexivity-risk']
      },
      {
        id: 'infopunk-verdict',
        title: 'Infopunk Verdict',
        body: 'Infopunks stands behind the Black Bull as a serious coordination signal while continuing to monitor dependency, concentration, and reflexivity risk. The latest airdrop evidence strengthens the case that this is not only an attention object, but a trench-revival event with real community surface area.',
        card_ids: ['infopunk-verdict']
      }
    ],
    asset: blackBull
  }
];

export function listNarrativeAssets() {
  return narrativeAssets;
}

export function getNarrativeAssetBySlug(slug: string) {
  return narrativeAssets.find((item) => item.slug === slug) ?? null;
}

export function listSignalSurfaces() {
  return signalSurfaces.map((item) => ({
    slug: item.slug,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle,
    thesis: item.thesis,
    disclaimer: item.disclaimer,
    signal_source: item.signal_source,
    asset_slug: item.asset_slug,
    last_updated: item.last_updated
  }));
}

export function getSignalSurfaceBySlug(slug: string) {
  return signalSurfaces.find((item) => item.slug === slug) ?? null;
}
