import type {
  AttentionMarketEvolutionStage,
  AttentionMarketEvolutionStageDefinition,
  AttentionMarketIntakeRequest,
  AttentionMarketIntakeSubmission,
  AttentionMarketSignal,
  AttentionMarketVerdict,
  SignalRiskFacet
} from '../schemas/entities';

const UPDATED_AT = '2026-07-01T09:00:00.000Z';

function verdictLabel(verdict: AttentionMarketVerdict) {
  switch (verdict) {
    case 'attention_arbitrage':
      return 'Attention Arbitrage';
    case 'extraction_risk':
      return 'Extraction Risk';
    case 'cult_sludge':
      return 'Cult Sludge';
    case 're_index_watch':
      return 'Re-Index Watch';
    case 'movement_candidate':
      return 'Movement Candidate';
    case 'signal_market_candidate':
      return 'Signal Market Candidate';
    case 'supportive_watch':
      return 'Supportive Watch';
  }
}

export const ATTENTION_MARKET_EVOLUTION_STAGES: AttentionMarketEvolutionStageDefinition[] = [
  {
    id: 'persona_coin',
    label: 'Persona Coin',
    description: 'Ticker wrapped around a person, face, handle, or reputation engine.'
  },
  {
    id: 'attention_market',
    label: 'Attention Market',
    description: 'Attention becomes the asset being priced.'
  },
  {
    id: 'coordination_market_emerging',
    label: 'Coordination Market Emerging',
    description: 'Redistribution, holder growth, community media, and shared rituals begin carrying the signal.'
  },
  {
    id: 'movement_candidate_under_observation',
    label: 'Movement Candidate Under Observation',
    description: 'The community may be becoming durable, but the desk requires sustained receipts.'
  },
  {
    id: 'extraction_risk',
    label: 'Extraction Risk',
    description: 'Attention and liquidity appear to be captured faster than community structure forms.'
  },
  {
    id: 'cult_sludge',
    label: 'Cult Sludge',
    description: 'High emotion, low coherence, weak receipts, and factional noise.'
  }
];

export const attentionMarketSignals: AttentionMarketSignal[] = [
  {
    id: 'attention_market_signal_ansem',
    slug: 'ansem',
    ticker: 'ANSEM',
    name: 'The Black Bull',
    category: 'persona_coin',
    attention_source: {
      type: 'influencer',
      label: 'Influencer-linked attention evolving into coordination',
      summary: 'Persona-led attention is still visible, but recent redistribution mechanics and community activity suggest the signal is spreading beyond a pure persona core.'
    },
    control_risk: {
      score: 82,
      summary: 'Control risk remains elevated because attention routing and wallet concentration still cluster around a narrow set of actors, even as the community surface expands.',
      factors: [
        'KOL dependency remains material',
        'Concentration risk stays visible even after broader distribution',
        'Persona-led steering can still overpower independent community formation'
      ]
    },
    coherence_score: {
      score: 88,
      summary: 'The story is compact and coherent: persona becomes symbol, symbol becomes redistribution rail, and the community begins carrying the signal.'
    },
    receipt_layer: {
      score: 84,
      summary: 'Reported creator-fee redistribution, linked signal reporting, and tracker-visible holder expansion provide visible evidence, though they do not erase concentration or dependence risk.',
      evidence_links: [
        '/signals/black-bull',
        '/narratives/attention-market-watch'
      ]
    },
    fragmentation_risk: {
      score: 52,
      summary: 'The narrative remains more intact than derivative influencer coins, though fragmentation can still appear if the community flywheel stalls.'
    },
    evolution_verdict: 'supportive_watch',
    verdict_label: verdictLabel('supportive_watch'),
    verdict_copy: 'ANSEM is the first Attention Market Watch case where persona attention appears to be evolving into a coordination market through redistribution, holder growth, and community participation.',
    current_evolution_stage: 'coordination_market_emerging',
    current_evolution_label: 'Coordination Market Emerging',
    risk_facets: ['kol_dependency', 'power_concentration', 'high_reflexivity', 'live_watch'],
    related_signal_slug: 'black-bull',
    href: '/signals/black-bull',
    updated_at: UPDATED_AT
  },
  {
    id: 'attention_market_signal_tjr',
    slug: 'tjr',
    ticker: 'TJR',
    name: 'TJR',
    category: 'influencer_attention',
    attention_source: {
      type: 'influencer',
      label: 'Influencer-derived derivative attention',
      summary: 'The signal reads as a monitored persona-adjacent attention object rather than a fully evidenced movement.'
    },
    control_risk: {
      score: 79,
      summary: 'Derivative persona markets can be steered by a small number of wallets or amplification accounts before the community proves independent coherence.',
      factors: [
        'Evidence base is still light',
        'Derivative attention can outrun durable ownership',
        'Narrative can be highly dependent on repeat posting rather than receipts'
      ]
    },
    coherence_score: {
      score: 54,
      summary: 'The meme is understandable, but the current repo evidence does not yet show a deeper, defensible coherence layer.'
    },
    receipt_layer: {
      score: 24,
      summary: 'Evidence remains placeholder-level. The desk is tracking classification posture, not validating a durable movement yet.',
      evidence_links: [
        '/narratives/attention-market-watch',
        '/signals/black-bull'
      ]
    },
    fragmentation_risk: {
      score: 74,
      summary: 'The symbol can fragment quickly if the attention object stays derivative and no new receipt layer appears.'
    },
    evolution_verdict: 'attention_arbitrage',
    verdict_label: verdictLabel('attention_arbitrage'),
    verdict_copy: 'Monitored derivative signal. Evidence-light profile. This attention-market object is under review, not an endorsement.',
    current_evolution_stage: 'attention_market',
    current_evolution_label: 'Attention Market',
    risk_facets: ['thin_evidence', 'kol_dependency', 'high_reflexivity'],
    href: '/attention-market-watch/tjr',
    updated_at: UPDATED_AT
  },
  {
    id: 'attention_market_signal_luke',
    slug: 'luke',
    ticker: 'LUKE',
    name: 'LUKE',
    category: 'influencer_attention',
    attention_source: {
      type: 'influencer',
      label: 'Persona-backed attention surface',
      summary: 'This reads as a persona-backed attention surface under observation, not a verified market with a strong receipt base.'
    },
    control_risk: {
      score: 76,
      summary: 'Dependence on a recognizable source node is still stronger than any visible independent operating logic.',
      factors: [
        'Persona gravity appears stronger than community receipts',
        'Control may sit with a narrow social cluster',
        'Derivative narrative risk remains high'
      ]
    },
    coherence_score: {
      score: 49,
      summary: 'The desk can classify the object, but the current evidence set does not justify stronger claims about movement quality.'
    },
    receipt_layer: {
      score: 20,
      summary: 'Evidence required. The current watch profile is a classification placeholder until stronger receipts arrive.',
      evidence_links: [
        '/narratives/attention-market-watch'
      ]
    },
    fragmentation_risk: {
      score: 71,
      summary: 'Without a stronger receipt layer, the narrative can split into copycat attention pockets instead of one coherent signal.'
    },
    evolution_verdict: 'attention_arbitrage',
    verdict_label: verdictLabel('attention_arbitrage'),
    verdict_copy: 'Monitored derivative signal. Evidence-light profile. This attention-market object is classified for watch status, not an endorsement.',
    current_evolution_stage: 'attention_market',
    current_evolution_label: 'Attention Market',
    risk_facets: ['thin_evidence', 'kol_dependency'],
    href: '/attention-market-watch/luke',
    updated_at: UPDATED_AT
  },
  {
    id: 'attention_market_signal_superman',
    slug: 'superman',
    ticker: 'SUPERMAN',
    name: 'SUPERMAN',
    category: 'anonymous_cult',
    attention_source: {
      type: 'anonymous_cult',
      label: 'Anonymous cult attention',
      summary: 'This signal reads closer to a cultish attention cluster or copycat identity swarm than a well-evidenced persona market.'
    },
    control_risk: {
      score: 84,
      summary: 'Anonymous or semi-anonymous swarms can hide extraction posture behind apparent movement language.',
      factors: [
        'Anonymous coordination can obscure actual control',
        'Copycat cult behavior can imitate coherence',
        'Wallet extraction risk is hard to dismiss without receipts'
      ]
    },
    coherence_score: {
      score: 46,
      summary: 'The symbol may hold attention, but the current evidence base does not show a stable classification beyond watch status.'
    },
    receipt_layer: {
      score: 18,
      summary: 'Receipt density is too thin to treat this as a validated movement. Current evidence remains internal placeholder-level only.',
      evidence_links: [
        '/narratives/attention-market-watch'
      ]
    },
    fragmentation_risk: {
      score: 81,
      summary: 'Fragmentation and re-indexing risk stay high because the attention field can break into disconnected clones or extraction clusters.'
    },
    evolution_verdict: 're_index_watch',
    verdict_label: verdictLabel('re_index_watch'),
    verdict_copy: 'Evidence-light profile. This attention-market object is monitored, not endorsed. Watch whether it coheres into a durable signal or degrades into high-noise, low-receipt cult sludge risk.',
    current_evolution_stage: 'cult_sludge',
    current_evolution_label: 'Cult Sludge',
    risk_facets: ['thin_evidence', 'power_concentration', 'narrative_fatigue'],
    href: '/attention-market-watch/superman',
    updated_at: UPDATED_AT
  }
];

export const ATTENTION_MARKET_DEFAULT_EVIDENCE_REQUIREMENTS = [
  'Identify attention source',
  'Identify token contract or market page',
  'Identify control points: supply, fees, liquidity, authority, social legitimacy',
  'Provide receipt links: on-chain actions, public commitments, wallet flows, product links, or community coordination',
  'Explain whether the asset unites attention or fragments it',
  'Explain why this is more than a ticker wrapped around a face'
] as const;

export const ATTENTION_MARKET_DEFAULT_RISK_FACETS: SignalRiskFacet[] = [
  'thin_evidence',
  'high_reflexivity',
  'power_concentration'
];

export const ATTENTION_MARKET_INTAKE_DISCLAIMER = 'Submission staged for review. This is not an endorsement and is not yet persisted.';

export function listAttentionMarketSignals() {
  return attentionMarketSignals.slice();
}

export function getAttentionMarketSignalBySlug(slug: string) {
  return attentionMarketSignals.find((signal) => signal.slug === slug) ?? null;
}

export function getAttentionMarketWatchIndex() {
  const signals = listAttentionMarketSignals();
  const verdict_counts = Object.fromEntries(
    signals.reduce((map, signal) => {
      map.set(signal.evolution_verdict, (map.get(signal.evolution_verdict) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  );

  return {
    generated_at: signals.map((signal) => signal.updated_at).sort((left, right) => right.localeCompare(left))[0] ?? UPDATED_AT,
    count: signals.length,
    verdict_counts,
    evolution_stages: ATTENTION_MARKET_EVOLUTION_STAGES,
    signals
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'attention-object';
}

export function getAttentionMarketIntakeRequirements() {
  return {
    requirements: [...ATTENTION_MARKET_DEFAULT_EVIDENCE_REQUIREMENTS],
    default_risk_facets: [...ATTENTION_MARKET_DEFAULT_RISK_FACETS],
    disclaimer: ATTENTION_MARKET_INTAKE_DISCLAIMER
  };
}

export function createAttentionMarketIntakeSubmission(input: AttentionMarketIntakeRequest): AttentionMarketIntakeSubmission {
  const evidence_links = (input.evidence_links ?? []).map((link) => link.trim()).filter(Boolean);
  const status = evidence_links.length > 0 ? 'staged' : 'needs_evidence';
  const submitted_at = new Date().toISOString();
  const ticker = input.ticker.trim().toUpperCase();
  const name = input.name.trim();
  const slug = slugify(`${ticker}-${name}`);
  const intake_id = `am_intake_${slug}_${evidence_links.length || '0'}`;

  return {
    intake_id,
    submitted_at,
    status,
    ticker,
    name,
    chain: input.chain?.trim() || undefined,
    attention_source_type: input.attention_source_type ?? 'unknown',
    attention_source_label: input.attention_source_label?.trim() || undefined,
    submitter_handle: input.submitter_handle?.trim() || undefined,
    why_it_matters: input.why_it_matters.trim(),
    evidence_links,
    default_evidence_requirements: [...ATTENTION_MARKET_DEFAULT_EVIDENCE_REQUIREMENTS],
    default_risk_facets: [...ATTENTION_MARKET_DEFAULT_RISK_FACETS],
    intake_note: 'Submission staged for review. This is not an endorsement and is not yet persisted.'
  };
}
