import { randomUUID } from 'node:crypto';
import { IntelligenceStore } from './intelligenceStore';
import { RouteRecommendationRequest, RouteRecommendation } from '../schemas/entities';
import { semanticSearch } from './searchService';

export function recommendRoute(input: RouteRecommendationRequest, store: IntelligenceStore): RouteRecommendation {
  const searchResults = semanticSearch({ query: input.task, category: input.category, limit: 50 }, store);
  const excludedProviders = searchResults
    .map((candidate) => {
      const reasons = exclusionReasons(candidate, input);
      return reasons.length ? { provider: candidate.provider, reasons } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const candidates = searchResults
    .filter(({ provider, trustAssessment }) => {
      const priceOk = input.maxPrice === undefined || provider.pricing.min === null || provider.pricing.min <= input.maxPrice;
      const trustOk = trustAssessment.score !== null && trustAssessment.score >= input.trustThreshold;
      return priceOk && trustOk;
    })
    .map((candidate) => {
      const latencyPenalty = input.latencySensitivity === 'high' && candidate.trustAssessment.components.latency === null ? 8 : 0;
      const pricePenalty = input.maxPrice && candidate.provider.pricing.min !== null ? (candidate.provider.pricing.min / Math.max(input.maxPrice, 0.0001)) * 10 : 0;
      const cheapestBoost = candidate.provider.pricing.min === null ? 0 : Math.max(0, 20 - candidate.provider.pricing.min * 100);
      const coordinationScore = coordinationScoreFor(candidate);
      const preferredBoost = input.preferredProviderId && candidate.provider.id === input.preferredProviderId ? 6 : 0;
      const trustWeight = input.preference === 'highest_trust' ? 0.72 : input.preference === 'cheapest' ? 0.28 : input.preference === 'highest_signal' ? 0.28 : 0.45;
      const signalWeight = input.preference === 'highest_signal' ? 0.72 : input.preference === 'highest_trust' ? 0.18 : input.preference === 'cheapest' ? 0.18 : 0.25;
      const priceWeight = input.preference === 'cheapest' ? 1.4 : input.preference === 'highest_trust' || input.preference === 'highest_signal' ? 0.35 : 0.75;
      const rank = candidate.relevance + (candidate.trustAssessment.score ?? 0) * trustWeight + (candidate.signalAssessment.score ?? 0) * signalWeight + coordinationScore * 0.12 + cheapestBoost * priceWeight + preferredBoost - latencyPenalty - pricePenalty;
      return { ...candidate, rank };
    })
    .sort((a, b) => b.rank - a.rank);

  const createdAt = new Date().toISOString();
  const best = candidates[0];
  const scoringInputs = {
    task: input.task,
    category: input.category ?? null,
    maxPrice: input.maxPrice ?? null,
    trustThreshold: input.trustThreshold,
    latencySensitivity: input.latencySensitivity,
    preference: input.preference,
    preferredProviderId: input.preferredProviderId ?? null,
    preferredProviderIncluded: Boolean(input.preferredProviderId),
    source: 'LIVE PAY.SH CATALOG' as const
  };
  if (!best) {
    const unknownTelemetry = Array.from(new Set(searchResults.flatMap((candidate) => [...candidate.trustAssessment.unknowns, ...candidate.signalAssessment.unknowns]))).sort();
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
      scoringInputs,
      excludedProviders,
      unknownTelemetry,
      rationale: ['No route matched constraints from the live Pay.sh catalog evidence.'],
      coordinationScore: null,
      selectedProviderNotRecommendedReason: selectedProviderReason(input.preferredProviderId, null, candidates, excludedProviders),
      preference: input.preference,
      createdAt
    };
  }

  const riskNotes = riskNotesFor(best, input.latencySensitivity);
  if (riskNotes.length === 0) riskNotes.push('No material deterministic routing risks detected from available V1 evidence.');
  const fallbackDetails = candidates.slice(1, 4).map((candidate) => ({
    provider: candidate.provider,
    trustAssessment: candidate.trustAssessment,
    signalAssessment: candidate.signalAssessment,
    relevance: candidate.relevance,
    rank: Math.round(candidate.rank * 100) / 100,
    riskNotes: riskNotesFor(candidate, input.latencySensitivity)
  }));
  const rationale = [
    `${best.provider.name} is the recommended route because it has the strongest catalog-derived score for the selected preference.`,
    `The ranking is trust/signal weighted and uses semantic relevance, price constraints, endpoint breadth, and coordination evidence from the live catalog.`
  ];
  const unknownTelemetry = Array.from(new Set([...best.trustAssessment.unknowns, ...best.signalAssessment.unknowns, ...riskNotes.filter((note) => /unknown|unavailable/i.test(note))])).sort();

  return {
    id: randomUUID(),
    task: input.task,
    bestProvider: best.provider,
    fallbackProviders: candidates.slice(1, 4).map((candidate) => candidate.provider),
    reasoning: [
      `${best.provider.name} ranked highest after semantic fit, evidence-backed trust, evidence-backed signal, price constraints, and latency-sensitivity penalties.`,
      `Trust ${best.trustAssessment.score}/100 and signal ${best.signalAssessment.score}/100 exceeded requested threshold ${input.trustThreshold}.`,
      'Pay.sh remains the provider, payment, and discovery substrate; Infopunks only returns a catalog-derived recommended route.'
    ],
    estimatedCost: best.provider.pricing,
    trustAssessment: best.trustAssessment,
    signalAssessment: best.signalAssessment,
    evidence: best.evidence,
    riskNotes,
    fallbackDetails,
    scoringInputs,
    excludedProviders,
    unknownTelemetry,
    rationale,
    coordinationScore: coordinationScoreFor(best),
    selectedProviderNotRecommendedReason: selectedProviderReason(input.preferredProviderId, best.provider.id, candidates, excludedProviders),
    preference: input.preference,
    createdAt
  };
}

function riskNotesFor(candidate: ReturnType<typeof semanticSearch>[number] & { rank: number }, latencySensitivity: RouteRecommendationRequest['latencySensitivity']) {
  const riskNotes = [];
  if (candidate.provider.pricing.clarity === 'range' || candidate.provider.pricing.clarity === 'dynamic') riskNotes.push('Price is a range or dynamic; request a Pay.sh quote before use.');
  if (candidate.trustAssessment.components.latency === null && latencySensitivity !== 'low') riskNotes.push('Latency is unknown because no timing events are ingested yet.');
  for (const unknown of candidate.trustAssessment.unknowns) riskNotes.push(`Trust component unavailable: ${unknown}.`);
  return riskNotes;
}

function coordinationScoreFor(candidate: ReturnType<typeof semanticSearch>[number]) {
  const endpointBreadth = Math.min(candidate.provider.endpointCount * 4, 28);
  const pricingClarity = candidate.provider.pricing.clarity === 'clear' || candidate.provider.pricing.clarity === 'free' ? 16 : candidate.provider.pricing.clarity === 'range' ? 10 : 5;
  const metering = candidate.provider.hasMetering || candidate.provider.status === 'metered' ? 12 : 0;
  const freeTier = candidate.provider.hasFreeTier || candidate.provider.status.includes('free') ? 6 : 0;
  const trust = (candidate.trustAssessment.score ?? 0) * 0.22;
  const signal = (candidate.signalAssessment.score ?? 0) * 0.16;
  return Math.round(Math.min(100, endpointBreadth + pricingClarity + metering + freeTier + trust + signal));
}

function exclusionReasons(candidate: ReturnType<typeof semanticSearch>[number], input: RouteRecommendationRequest) {
  const reasons = [];
  if (input.maxPrice !== undefined && candidate.provider.pricing.min !== null && candidate.provider.pricing.min > input.maxPrice) reasons.push(`minimum catalog price ${candidate.provider.pricing.min} exceeds max price ${input.maxPrice}`);
  if (candidate.trustAssessment.score === null) reasons.push('trust score is unknown');
  if (candidate.trustAssessment.score !== null && candidate.trustAssessment.score < input.trustThreshold) reasons.push(`trust score ${candidate.trustAssessment.score} is below minimum ${input.trustThreshold}`);
  return reasons;
}

function selectedProviderReason(preferredProviderId: string | undefined, bestProviderId: string | null, candidates: Array<ReturnType<typeof semanticSearch>[number] & { rank: number }>, excludedProviders: { provider: { id: string; name: string }; reasons: string[] }[]) {
  if (!preferredProviderId || preferredProviderId === bestProviderId) return null;
  const excluded = excludedProviders.find((item) => item.provider.id === preferredProviderId);
  if (excluded) return excluded.reasons.join('; ');
  const preferred = candidates.find((candidate) => candidate.provider.id === preferredProviderId);
  if (!preferred) return 'selected provider was outside the route candidate set for the task and category filter';
  const best = candidates[0];
  if (!best) return 'no provider met the route constraints';
  return `${best.provider.name} scored higher on the ${preferred.provider.id === preferredProviderId ? 'trust/signal weighted catalog-derived ranking' : 'selected route profile'}`;
}
