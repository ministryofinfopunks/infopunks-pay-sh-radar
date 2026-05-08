import { IntelligenceStore } from './intelligenceStore';
import { SearchRequest } from '../schemas/entities';

const MAX_SEARCH_PROVIDERS = 100;
const MAX_SEARCH_RESULTS = 10;

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
  const trustByProvider = new Map(store.trustAssessments.map((item) => [item.entityId, item]));
  const signalByProvider = new Map(store.signalAssessments.map((item) => [item.entityId, item]));
  const maxResults = Math.min(input.limit, MAX_SEARCH_RESULTS);
  return store.providers
    .slice(0, MAX_SEARCH_PROVIDERS)
    .filter((provider) => !input.category || provider.category.toLowerCase() === input.category?.toLowerCase())
    .map((provider) => {
      const trustAssessment = trustByProvider.get(provider.id);
      const signalAssessment = signalByProvider.get(provider.id);
      if (!trustAssessment || !signalAssessment) return null;
      const haystack = `${provider.name} ${provider.namespace} ${provider.category} ${provider.description ?? ''} ${provider.tags.join(' ')}`;
      const lexical = lexicalScore(queryTokens, haystack);
      const relevance = lexical + (trustAssessment.score ?? 0) * 0.015 + (signalAssessment.score ?? 0) * 0.02;
      return {
        provider,
        trustAssessment,
        signalAssessment,
        relevance: Math.round(relevance * 100) / 100,
        lexical,
        evidence: trustAssessment.evidence.metadataQuality.slice(0, 1)
      };
    })
    .filter((result): result is NonNullable<typeof result> => result !== null)
    .filter((result) => result.lexical > 0 && result.relevance > 1)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxResults)
    .map(({ lexical: _lexical, ...result }) => result);
}
