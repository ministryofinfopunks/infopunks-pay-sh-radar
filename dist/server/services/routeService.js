"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendRoute = recommendRoute;
const node_crypto_1 = require("node:crypto");
const searchService_1 = require("./searchService");
function recommendRoute(input, store) {
    const candidates = (0, searchService_1.semanticSearch)({ query: input.task, category: input.category, limit: 50 }, store)
        .filter(({ provider, trustAssessment }) => {
        const priceOk = input.maxPrice === undefined || provider.pricing.min === null || provider.pricing.min <= input.maxPrice;
        const trustOk = trustAssessment.score !== null && trustAssessment.score >= input.trustThreshold;
        return priceOk && trustOk;
    })
        .map((candidate) => {
        const latencyPenalty = input.latencySensitivity === 'high' && candidate.trustAssessment.components.latency === null ? 8 : 0;
        const pricePenalty = input.maxPrice && candidate.provider.pricing.min !== null ? (candidate.provider.pricing.min / Math.max(input.maxPrice, 0.0001)) * 10 : 0;
        const rank = candidate.relevance + (candidate.trustAssessment.score ?? 0) * 0.45 + (candidate.signalAssessment.score ?? 0) * 0.25 - latencyPenalty - pricePenalty;
        return { ...candidate, rank };
    })
        .sort((a, b) => b.rank - a.rank);
    const createdAt = new Date().toISOString();
    const best = candidates[0];
    if (!best) {
        return {
            id: (0, node_crypto_1.randomUUID)(),
            task: input.task,
            bestProvider: null,
            fallbackProviders: [],
            reasoning: ['No provider met the semantic, category, price, and trust constraints using available evidence.'],
            estimatedCost: null,
            trustAssessment: null,
            signalAssessment: null,
            evidence: [],
            riskNotes: ['Relax trustThreshold, category, or maxPrice to expand the route set. Unknown telemetry is not guessed.'],
            createdAt
        };
    }
    const riskNotes = [];
    if (best.provider.pricing.clarity === 'range' || best.provider.pricing.clarity === 'dynamic')
        riskNotes.push('Price is a range or dynamic; request a Pay.sh quote before execution.');
    if (best.trustAssessment.components.latency === null && input.latencySensitivity !== 'low')
        riskNotes.push('Latency is unknown because no timing events are ingested yet.');
    for (const unknown of best.trustAssessment.unknowns)
        riskNotes.push(`Trust component unavailable: ${unknown}.`);
    if (riskNotes.length === 0)
        riskNotes.push('No material deterministic routing risks detected from available V1 evidence.');
    return {
        id: (0, node_crypto_1.randomUUID)(),
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
        createdAt
    };
}
