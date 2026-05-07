import { Evidence, NarrativeCluster, Provider, SignalAssessment } from '../schemas/entities';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const weights: Record<keyof SignalAssessment['components'], number> = {
  ecosystemMomentum: 0.28,
  categoryHeat: 0.28,
  metadataChangeVelocity: 0.16,
  socialVelocity: 0.14,
  onchainLiquidityResonance: 0.14
};
const narrativeKeywords: Record<string, string[]> = {
  'agent cognition': ['llm', 'embeddings', 'multimodal', 'knowledge-graph', 'search', 'fact-check'],
  'machine media': ['image', 'video', 'generation', 'media', 'models'],
  'data exhaust': ['enrichment', 'scraping', 'people', 'company', 'property', 'data'],
  'coordination rails': ['email', 'voice', 'webrtc', 'messaging', 'hosting', 'storage']
};

function weightedAvailableScore(components: SignalAssessment['components']) {
  let weighted = 0;
  let availableWeight = 0;
  for (const [key, value] of Object.entries(components) as [keyof SignalAssessment['components'], number | null][]) {
    if (value === null) continue;
    weighted += value * weights[key];
    availableWeight += weights[key];
  }
  return availableWeight === 0 ? null : clamp(weighted / availableWeight);
}

export function narrativesForProvider(provider: Provider): string[] {
  const body = `${provider.description ?? ''} ${provider.tags.join(' ')}`.toLowerCase();
  return Object.entries(narrativeKeywords)
    .filter(([, keywords]) => keywords.some((keyword) => body.includes(keyword)))
    .map(([name]) => name);
}

export function computeSignalAssessment(provider: Provider, allProviders: Provider[], assessedAt = new Date().toISOString()): SignalAssessment {
  const categoryProviders = allProviders.filter((item) => item.category === provider.category);
  const categorySizes = allProviders.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});
  const maxCategorySize = Math.max(...Object.values(categorySizes), 1);
  const maxEndpoints = Math.max(...allProviders.map((item) => item.endpointCount), 1);
  const ecosystemMomentum = clamp(provider.endpointCount / maxEndpoints * 100);
  const categoryHeat = clamp(categoryProviders.length / maxCategorySize * 100);
  const metadataEvidence = provider.evidence.filter((item) => item.eventType === 'provider_metadata_observed' || item.eventType === 'pay_sh_catalog_provider_seen');
  const components: SignalAssessment['components'] = {
    ecosystemMomentum,
    categoryHeat,
    metadataChangeVelocity: null,
    socialVelocity: null,
    onchainLiquidityResonance: null
  };
  const unknowns = Object.entries(components).filter(([, value]) => value === null).map(([key]) => key);
  const narratives = narrativesForProvider(provider);
  const score = weightedAvailableScore(components);
  const evidence: Record<string, Evidence[]> = {
    ecosystemMomentum: metadataEvidence,
    categoryHeat: metadataEvidence,
    metadataChangeVelocity: [],
    socialVelocity: [],
    onchainLiquidityResonance: []
  };

  return {
    id: `signal-${provider.id}`,
    entityId: provider.id,
    entityType: 'provider',
    score,
    components,
    narratives,
    evidence,
    unknowns,
    reasoning: [
      'Signal V1 is deterministic and only scores event-supported ecosystem/catalog momentum.',
      'Metadata-change velocity, social velocity, and onchain/liquidity resonance remain null until those event streams are ingested.',
      `${provider.name} maps to narratives: ${narratives.length ? narratives.join(', ') : 'none'}.`
    ],
    assessedAt
  };
}

export function buildNarrativeClusters(providers: Provider[], signals: SignalAssessment[]): NarrativeCluster[] {
  return Object.entries(narrativeKeywords).map(([title, keywords]) => {
    const memberIds = providers.filter((provider) => signals.find((signal) => signal.entityId === provider.id)?.narratives.includes(title)).map((provider) => provider.id);
    const memberSignals = signals.filter((signal) => memberIds.includes(signal.entityId));
    const knownScores = memberSignals.map((signal) => signal.score).filter((score): score is number => score !== null);
    const heat = knownScores.length ? clamp(knownScores.reduce((sum, score) => sum + score, 0) / knownScores.length) : null;
    const momentumValues = memberSignals.map((signal) => signal.components.ecosystemMomentum).filter((score): score is number => score !== null);
    const momentum = momentumValues.length ? clamp(momentumValues.reduce((sum, score) => sum + score, 0) / momentumValues.length) : null;
    const evidence = providers.filter((provider) => memberIds.includes(provider.id)).flatMap((provider) => provider.evidence).filter((item) => item.eventType === 'provider_metadata_observed');
    return { id: title.replaceAll(' ', '-'), title, heat, momentum, providerIds: memberIds, keywords, summary: `${title} cluster tracks Pay.sh providers matching catalog metadata keywords.`, evidence };
  }).sort((a, b) => (b.heat ?? -1) - (a.heat ?? -1));
}
