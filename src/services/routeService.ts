import { randomUUID } from 'node:crypto';
import { IntelligenceStore } from './intelligenceStore';
import { RouteRecommendationRequest, RouteRecommendation } from '../schemas/entities';
import { semanticSearch } from './searchService';

export function recommendRoute(input: RouteRecommendationRequest, store: IntelligenceStore): RouteRecommendation {
  const candidates = semanticSearch({ query: input.task, category: input.category, limit: 50 }, store)
    .filter(({ provider, trustAssessment }) => {
      const priceOk = input.maxPrice === undefined || provider.pricing.min === null || provider.pricing.min <= input.maxPrice;
      const trustOk = trustAssessment.score !== null && trustAssessment.score >= input.trustThreshold;
      return priceOk && trustOk;
    })
    .map((candidate) => {
      const latencyPenalty = input.latencySensitivity === 'high' && candidate.trustAssessment.components.latency === null ? 8 : 0;
      const pricePenalty = input.maxPrice && candidate.provider.pricing.min !== null ? (candidate.provider.pricing.min / Math.max(input.maxPrice, 0.0001)) * 10 : 0;
      const cheapestBoost = candidate.provider.pricing.min === null ? 0 : Math.max(0, 20 - candidate.provider.pricing.min * 100);
      const trustWeight = input.preference === 'highest_trust' ? 0.72 : input.preference === 'cheapest' ? 0.28 : 0.45;
      const signalWeight = input.preference === 'highest_trust' ? 0.18 : input.preference === 'cheapest' ? 0.18 : 0.25;
      const priceWeight = input.preference === 'cheapest' ? 1.4 : input.preference === 'highest_trust' ? 0.35 : 0.75;
      const rank = candidate.relevance + (candidate.trustAssessment.score ?? 0) * trustWeight + (candidate.signalAssessment.score ?? 0) * signalWeight + cheapestBoost * priceWeight - latencyPenalty - pricePenalty;
      return { ...candidate, rank };
    })
    .sort((a, b) => b.rank - a.rank);

  const createdAt = new Date().toISOString();
  const best = candidates[0];
  if (!best) {
    return {
      id: randomUUID(),
      task: input.task,
      bestProvider: null,
      fallbackProviders: [],
      reasoning: ['No provider met the semantic, category, price, and trust constraints using available evidence.'],
      estimatedCost: null,
      trustAssessment: null,
      signalAssessment: null,
      evidence: [],
      riskNotes: ['Relax trustThreshold, category, or maxPrice to expand the route set. Unknown telemetry is not guessed.'],
      fallbackDetails: [],
      preference: input.preference,
      createdAt
    };
  }

  const riskNotes = riskNotesFor(best, input.latencySensitivity);
  if (riskNotes.length === 0) riskNotes.push('No material deterministic routing risks detected from available V1 evidence.');

  return {
    id: randomUUID(),
    task: input.task,
    bestProvider: best.provider,
    fallbackProviders: candidates.slice(1, 4).map((candidate) => candidate.provider),
    reasoning: [
      `${best.provider.name} ranked highest after semantic fit, evidence-backed trust, evidence-backed signal, price constraints, and latency-sensitivity penalties.`,
      `Trust ${best.trustAssessment.score}/100 and signal ${best.signalAssessment.score}/100 exceeded requested threshold ${input.trustThreshold}.`,
      'Pay.sh remains the payment and execution substrate; Infopunks only recommends the route.'
    ],
    estimatedCost: best.provider.pricing,
    trustAssessment: best.trustAssessment,
    signalAssessment: best.signalAssessment,
    evidence: best.evidence,
    riskNotes,
    fallbackDetails: candidates.slice(1, 4).map((candidate) => ({
      provider: candidate.provider,
      trustAssessment: candidate.trustAssessment,
      signalAssessment: candidate.signalAssessment,
      relevance: candidate.relevance,
      rank: Math.round(candidate.rank * 100) / 100,
      riskNotes: riskNotesFor(candidate, input.latencySensitivity)
    })),
    preference: input.preference,
    createdAt
  };
}

function riskNotesFor(candidate: ReturnType<typeof semanticSearch>[number] & { rank: number }, latencySensitivity: RouteRecommendationRequest['latencySensitivity']) {
  const riskNotes = [];
  if (candidate.provider.pricing.clarity === 'range' || candidate.provider.pricing.clarity === 'dynamic') riskNotes.push('Price is a range or dynamic; request a Pay.sh quote before execution.');
  if (candidate.trustAssessment.components.latency === null && latencySensitivity !== 'low') riskNotes.push('Latency is unknown because no timing events are ingested yet.');
  for (const unknown of candidate.trustAssessment.unknowns) riskNotes.push(`Trust component unavailable: ${unknown}.`);
  return riskNotes;
}
