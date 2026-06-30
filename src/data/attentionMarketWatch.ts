import type { AttentionMarketSignal, AttentionMarketVerdict } from '../schemas/entities';

const UPDATED_AT = '2026-06-30T15:00:00.000Z';

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

export const attentionMarketSignals: AttentionMarketSignal[] = [
  {
    id: 'attention_market_signal_ansem',
    slug: 'ansem',
    ticker: 'ANSEM',
    name: 'The Black Bull',
    category: 'persona_coin',
    attention_source: {
      type: 'influencer',
      label: 'Influencer-linked attention',
      summary: 'Persona-led attention is visible, legible, and tied to public coordination events rather than purely anonymous churn.'
    },
    control_risk: {
      score: 82,
      summary: 'Control risk remains elevated because attention routing and wallet concentration still cluster around a narrow set of actors.',
      factors: [
        'KOL dependency remains material',
        'Concentration risk stays visible even after broader distribution',
        'Persona-led steering can still overpower independent community formation'
      ]
    },
    coherence_score: {
      score: 88,
      summary: 'The story is compact and coherent: persona becomes symbol, symbol becomes coordination rail, and receipts remain visible.'
    },
    receipt_layer: {
      score: 78,
      summary: 'Airdrop receipts and linked signal reporting provide visible evidence, though they do not erase concentration or dependence risk.',
      evidence_links: [
        '/signals/black-bull',
        '/narratives/attention-markets'
      ]
    },
    fragmentation_risk: {
      score: 57,
      summary: 'The narrative is still intact, but fragmentation can appear quickly if the source node cools or copycat flows dilute the symbol.'
    },
    evolution_verdict: 'supportive_watch',
    verdict_label: verdictLabel('supportive_watch'),
    verdict_copy: 'Visible airdrop receipts and coordination evidence make this more than a hollow attention loop, but dependence and concentration stay explicit.',
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
    verdict_copy: 'Monitored derivative signal. Current posture: attention object first, evidence object second.',
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
    verdict_copy: 'Evidence-light watch profile. This remains a classification object, not a thesis endorsement.',
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
    verdict_copy: 'Watch for whether this re-indexes into something coherent or dissolves into derivative cult sludge.',
    risk_facets: ['thin_evidence', 'power_concentration', 'narrative_fatigue'],
    href: '/attention-market-watch/superman',
    updated_at: UPDATED_AT
  }
];

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
    signals
  };
}
