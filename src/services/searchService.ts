import { IntelligenceStore } from './intelligenceStore';
import { SearchRequest } from '../schemas/entities';

function tokenize(text: string) {
  return new Set(text.toLowerCase().split(/[^a-z0-9/.-]+/).filter(Boolean));
}

function lexicalScore(queryTokens: Set<string>, text: string) {
  const target = tokenize(text);
  let score = 0;
  for (const token of queryTokens) {
    if (target.has(token)) score += 4;
    else if ([...target].some((candidate) => candidate.includes(token) || token.includes(candidate))) score += 1.5;
  }
  return score;
}

export function semanticSearch(input: SearchRequest, store: IntelligenceStore) {
  const queryTokens = tokenize(input.query);
  return store.providers
    .filter((provider) => !input.category || provider.category.toLowerCase() === input.category?.toLowerCase())
    .map((provider) => {
      const trustAssessment = store.trustAssessments.find((item) => item.entityId === provider.id)!;
      const signalAssessment = store.signalAssessments.find((item) => item.entityId === provider.id)!;
      const haystack = `${provider.name} ${provider.namespace} ${provider.category} ${provider.description ?? ''} ${provider.tags.join(' ')}`;
      const relevance = lexicalScore(queryTokens, haystack) + (trustAssessment.score ?? 0) * 0.015 + (signalAssessment.score ?? 0) * 0.02;
      return { provider, trustAssessment, signalAssessment, relevance: Math.round(relevance * 100) / 100, evidence: [...provider.evidence, ...trustAssessment.evidence.metadataQuality, ...signalAssessment.evidence.ecosystemMomentum] };
    })
    .filter((result) => result.relevance > 1)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, input.limit);
}
