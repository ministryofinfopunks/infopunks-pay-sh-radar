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
    risk_facets: ['high_reflexivity', 'kol_dependency', 'power_concentration', 'unproven_sovereignty', 'live_watch'],
    severity: 'warning',
    severity_reason: 'Attention is strong, but concentration and reflexivity remain high.',
    severity_score: 78,
    severity_window: '7d',
    evidence: []
  },
  {
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
      {
        label: 'Solscan holder surface',
        note: 'Public tracker-visible holder surface shows 64,000+ wallets on Solscan. Infopunks treats this as a visible surface, not canonical proof of perfect distribution.',
        href: 'https://solscan.io/token/5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2'
      },
      {
        label: 'Community takeover profile',
        note: 'Community takeover framing remains central to the signal: the meme is being carried by a community-run structure rather than a single personality node.',
        href: 'https://dexscreener.com/solana/4w2cysotx6czaugmmwg13hdpy4qemg2czekyeqyk9ama'
      },
      {
        label: 'Legacy meme home',
        note: 'The project site anchors the archetype in familiar internet-native troll lore rather than newly invented story scaffolding.',
        href: 'https://trololol.io'
      },
      {
        label: 'Archetype survival',
        note: 'More than 435 days in circulation matters because the signal is survival, not novelty. Longevity strengthens the re-index thesis by showing the archetype can persist through multiple rotations.',
        href: 'https://solscan.io/token/5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2'
      }
    ],
    related_routes: [
      { label: 'Narrative Intel', href: '/narratives' },
      { label: 'Attention Markets', href: '/narratives/attention-markets' },
      { label: 'TROLL Signal Report', href: '/signals/troll' }
    ],
    last_updated: '2026-06-30T13:30:00.000Z',
    title: 'Narrative Asset Intelligence',
    heat: 90,
    momentum: 82,
    providerIds: [],
    keywords: ['solana', 'troll', 'community takeover', 'legacy meme', 'internet archetype', 're-indexed lore'],
    summary: '$TROLL reads as a durable re-indexed archetype: old internet culture reactivated by Solana trench memory with a visible 64,000+ holder surface.',
    risk_facets: ['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration'],
    severity: 'warning',
    severity_reason: 'The verdict is stronger, but concentration, reflexivity, and evidence quality still need active monitoring.',
    severity_score: 74,
    severity_window: '7d',
    evidence: []
  }
];

const blackBull = narrativeAssets[0];
const troll = narrativeAssets[1];

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
        evidence_note: 'A small set of actors can distort the market\'s apparent consensus.',
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
  },
  {
    slug: 'troll',
    type: 'signal_report',
    title: '$TROLL / The Re-Indexed Archetype',
    subtitle: 'Narrative signal report',
    thesis: troll.thesis,
    disclaimer: 'This report maps signal conditions around a narrative asset. It is a narrative intelligence artifact, not a trading instruction.',
    signal_source: 'Community takeover + legacy internet meme archetype',
    asset_slug: 'troll',
    last_updated: troll.last_updated,
    cards: [
      {
        id: 'signal-strength',
        title: 'Signal Strength',
        score: 90,
        short_explanation: 'The signal comes from archetype survival plus community takeover structure, not from novelty.',
        evidence_note: 'More than 435 days in circulation and a 64,000+ tracker-visible holder surface give the re-index thesis durable evidence.',
        decision_state: 'strong_signal'
      },
      {
        id: 'meme-fitness',
        title: 'Meme Fitness',
        score: 96,
        short_explanation: 'The troll symbol is already installed in internet memory, so it travels without needing fresh lore education.',
        evidence_note: 'Legacy meme recognizability reduces explanation friction across internet-native communities.',
        decision_state: 'strong_signal'
      },
      {
        id: 'myth-coherence',
        title: 'Myth Coherence',
        score: troll.myth_coherence_score,
        short_explanation: 'The story is compact: old internet archetype, new chain, community-run reactivation.',
        evidence_note: 'The narrative does not depend on invention; it depends on recognizable survival and return.',
        decision_state: 'strong_signal'
      },
      {
        id: 'community-surface',
        title: 'Community Surface',
        score: 89,
        short_explanation: 'Community surface is visible across the takeover framing and the tracker-visible holder surface.',
        evidence_note: 'A 64,000+ holder surface strengthens the surface-area case, while concentration still requires monitoring.',
        decision_state: 'strong_signal'
      },
      {
        id: 'archetype-survival',
        title: 'Archetype Survival',
        score: 94,
        short_explanation: 'Longevity strengthens the re-index thesis because the symbol survived rotations, volatility, and trench regime changes.',
        evidence_note: 'The signal is survival, not novelty: more than 435 days in circulation materially changes the quality of the meme case.',
        decision_state: 'strong_signal'
      },
      {
        id: 'attention-velocity',
        title: 'Attention Velocity',
        score: troll.attention_velocity_score,
        short_explanation: 'Recognizable lore and trench memory keep attention moving, even though the case rests more on durability than speed.',
        evidence_note: 'Attention matters here, but it is secondary to the stronger evidence that the meme can persist through multiple cycles.',
        decision_state: 'watch_closely'
      },
      {
        id: 'trench-contagion',
        title: 'Trench Contagion',
        score: troll.trench_contagion_score,
        short_explanation: 'Legacy meme shorthand can spread fast in trench environments because the symbol is universally legible.',
        evidence_note: 'Contagion can accelerate precisely because the meme does not need a long onboarding curve.',
        decision_state: 'watch_closely'
      },
      {
        id: 'holder-power-concentration',
        title: 'Holder / Power Concentration',
        score: troll.centralization_risk_score,
        short_explanation: 'The holder surface is broad enough to matter, but concentration still needs monitoring before distribution claims get over-read.',
        evidence_note: 'The 64,000+ holder surface is tracker-visible and useful, but it is not perfect canonical truth about distribution quality.',
        decision_state: 'concentrated_power'
      },
      {
        id: 'reflexivity-risk',
        title: 'Reflexivity Risk',
        score: troll.reflexivity_risk_score,
        short_explanation: 'Legacy memes can reignite quickly, which means posting, price, and belief can start reinforcing each other before evidence deepens.',
        evidence_note: 'Track whether attention loops remain evidence-led or become self-justifying.',
        decision_state: 'high_reflexivity'
      },
      {
        id: 'sovereignty-score',
        title: 'Sovereignty Score',
        score: troll.sovereignty_score,
        short_explanation: 'Community takeover improves independence versus persona-led narratives and gives the asset a more durable ownership story.',
        evidence_note: 'Sovereignty is stronger than a persona-led meme, but it still depends on whether the community can defend the symbol through future rotations.',
        decision_state: 'watch_closely'
      },
      {
        id: 'infopunk-verdict',
        title: 'Infopunk Verdict',
        score: 'DURABLE RE-INDEX',
        short_explanation: 'Old internet culture reactivated by Solana trench memory.',
        evidence_note: 'The desk upgrades the verdict while keeping concentration, reflexivity, and evidence quality visible.',
        decision_state: 'durable_re_index'
      }
    ],
    sections: [
      {
        id: 'signal-source',
        title: 'Signal Source',
        body: 'TROLL\'s signal source is not one KOL. It is an old internet-native archetype plus community takeover structure.',
        card_ids: ['signal-strength']
      },
      {
        id: 'archetype-survival',
        title: 'Archetype Survival',
        body: 'The signal is survival, not novelty. TROLL has remained in circulation for more than 435 days, survived rotations and volatility, and kept enough continuity for the re-index thesis to strengthen over time.',
        card_ids: ['meme-fitness', 'myth-coherence', 'archetype-survival']
      },
      {
        id: 'holder-surface',
        title: 'Holder Surface',
        body: 'Public tracker and on-chain context show a 64,000+ holder surface. Infopunks treats that as a meaningful tracker-visible surface rather than perfect canonical truth, and continues to monitor concentration closely.',
        card_ids: ['community-surface', 'holder-power-concentration']
      },
      {
        id: 'community-takeover',
        title: 'Community Takeover',
        body: 'The community takeover framing remains important because it shifts the signal away from single-person dependency and toward trench-level cultural maintenance.',
        card_ids: ['community-surface', 'sovereignty-score']
      },
      {
        id: 'attention-velocity',
        title: 'Attention Velocity',
        body: 'TROLL has market visibility and recognizable lore, but the stronger case now comes from durability: attention is amplifying a meme that has already survived multiple regime changes.',
        card_ids: ['attention-velocity', 'trench-contagion']
      },
      {
        id: 'reflexivity-risk',
        title: 'Reflexivity Risk',
        body: 'Legacy memes can revive quickly, but attention loops can also overheat. Track whether price, posting, and belief become self-reinforcing without new evidence.',
        card_ids: ['reflexivity-risk', 'sovereignty-score']
      },
      {
        id: 'infopunk-verdict',
        title: 'Infopunk Verdict',
        body: troll.infopunk_verdict,
        card_ids: ['infopunk-verdict']
      }
    ],
    asset: troll
  }
];

function verdictFieldsForSurface(surface: NarrativeSignalSurface) {
  if (surface.type !== 'signal_report' || !surface.asset) return {};

  if (surface.slug === 'black-bull') {
    return {
      infopunk_verdict: surface.asset.infopunk_verdict,
      verdict_label: 'SUPPORTIVE WATCH',
      verdict_state: 'supportive_watch',
      verdict_copy: surface.asset.infopunk_verdict
    };
  }

  if (surface.slug === 'troll') {
    return {
      infopunk_verdict: surface.asset.infopunk_verdict,
      verdict_label: 'DURABLE RE-INDEX',
      verdict_state: 'durable_re_index',
      verdict_copy: surface.asset.infopunk_verdict
    };
  }

  const verdictCard = surface.cards.find((card) => card.id === 'infopunk-verdict');
  const verdictLabel = typeof verdictCard?.score === 'string' ? verdictCard.score : undefined;
  const verdictState = verdictCard?.decision_state;
  return {
    infopunk_verdict: surface.asset.infopunk_verdict,
    verdict_label: verdictLabel,
    verdict_state: verdictState,
    verdict_copy: surface.asset.infopunk_verdict
  };
}

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
    last_updated: item.last_updated,
    ...verdictFieldsForSurface(item)
  }));
}

export function getSignalSurfaceBySlug(slug: string) {
  const surface = signalSurfaces.find((item) => item.slug === slug);
  return surface ? { ...surface, ...verdictFieldsForSurface(surface) } : null;
}
