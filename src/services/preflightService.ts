import { PreflightRequest, PreflightResponse, Provider } from '../schemas/entities';
import { DataSourceState } from '../persistence/repository';
import { IntelligenceStore } from './intelligenceStore';
import { dataSourceState } from './pulseService';

type Candidate = {
  provider: Provider;
  capabilities: CapabilityTag[];
  capabilityMatchScore: number;
  policyNotes: string[];
  verifiedRoute: boolean;
  verificationSource: string | null;
  verificationStatus: string | null;
  verificationFqn: string | null;
  verificationOutputShape: string | null;
  trustScore: number | null;
  effectiveTrustScore: number | null;
  signalScore: number | null;
  latencyMs: number | null;
  minCostUsd: number | null;
  degraded: boolean;
};

type CapabilityInference = {
  requiredCapabilities: CapabilityTag[];
  capabilityInferenceReason: string | null;
};

type CapabilityTag =
  | 'payment'
  | 'settlement'
  | 'market_data'
  | 'pricing'
  | 'enrichment'
  | 'messaging'
  | 'media_generation'
  | 'search'
  | 'analytics'
  | 'storage'
  | 'compute'
  | 'ai_inference'
  | 'dex_pools'
  | 'trending'
  | 'rpc'
  | 'blockchain'
  | 'solana'
  | 'onchain'
  | 'research'
  | 'web_search'
  | 'citations'
  | 'cited_answer'
  | 'answer'
  | 'live_research'
  | 'grounded_answer'
  | 'ai_ml'
  | 'research_answer'
  | 'vision'
  | 'image_labels'
  | 'image_analysis'
  | 'ocr'
  | 'text_detection'
  | 'safe_search'
  | 'logo_detection'
  | 'landmark_detection';

const DEFAULT_MIN_TRUST_SCORE = 70;
const MAX_REJECTED_PROVIDERS_IN_RESPONSE = 25;
const MAX_CONSIDERED_PROVIDERS_REJECTED_IN_RESPONSE = 10;
const PRE_FLIGHT_PRIORITY_ORDER = ['category_match', 'capability_match', 'min_trust_score', 'active_degradation', 'max_latency_ms', 'max_cost_usd', 'higher_signal_score', 'lower_latency_ms'];

const CATEGORY_ALIASES: Record<string, string[]> = {
  payments: ['payments', 'payment', 'finance', 'fintech', 'crypto', 'settlement'],
  data: ['data', 'analytics', 'enrichment'],
  ai: ['ai_ml', 'ai', 'llm', 'inference'],
  image: ['image', 'media', 'generation'],
  speech: ['speech', 'voice', 'audio']
};

const MARKET_DATA_CAPABILITIES: CapabilityTag[] = ['market_data', 'pricing'];
const MARKET_DATA_CATEGORY_BRIDGE = ['payments', 'payment', 'finance', 'fintech', 'crypto', 'data', 'analytics', 'enrichment'];
const DEX_TRENDING_CAPABILITIES: CapabilityTag[] = ['dex_pools', 'trending'];
const RPC_BLOCKCHAIN_SOLANA_CAPABILITIES: CapabilityTag[] = ['rpc', 'blockchain', 'solana'];
const RESEARCH_ANSWER_CAPABILITIES: CapabilityTag[] = ['research_answer', 'cited_answer', 'grounded_answer', 'web_search', 'citations', 'live_research', 'answer', 'search', 'ai_ml'];
const RESEARCH_ANSWER_REQUIRED_CAPABILITIES: CapabilityTag[] = ['research_answer', 'cited_answer', 'grounded_answer', 'web_search', 'citations', 'live_research'];
const PLACES_SEARCH_CAPABILITIES: CapabilityTag[] = ['search', 'enrichment'];
const VISION_ANALYSIS_CAPABILITIES: CapabilityTag[] = ['vision', 'image_labels', 'image_analysis', 'ocr', 'text_detection', 'safe_search', 'logo_detection', 'landmark_detection', 'ai_ml'];
const LATENCY_UNKNOWN_POLICY_NOTE = 'latency_unknown_allowed_for_specific_capability_match';
const VERIFIED_ROUTE_EFFECTIVE_TRUST_FLOOR_NOTE = 'harness_verified_route_effective_trust_floor';
const VERIFIED_ROUTE_EFFECTIVE_TRUST_FLOOR = 70;

type VerifiedRouteOverlay = {
  providerId: string;
  fqn: string;
  outputShape: string;
  status: 'verified_pay_cli_success';
  verificationSource: string;
  verifiedRoute: true;
};

const VERIFIED_ROUTE_OVERLAYS: VerifiedRouteOverlay[] = [{
  providerId: 'paysponge-perplexity',
  fqn: 'paysponge/perplexity',
  outputShape: 'research_answer',
  status: 'verified_pay_cli_success',
  verificationSource: 'infopunks-pay-sh-agent-harness',
  verifiedRoute: true
}];

export function runPreflight(input: PreflightRequest, store: IntelligenceStore): PreflightResponse {
  const sourceState = dataSourceState(store);
  const generatedAt = new Date().toISOString();
  const byProvider = new Map(store.providers.map((provider) => [provider.id, provider]));
  const requested = input.candidateProviders?.map((id) => id.trim()).filter(Boolean);
  const providerByAnyKey = buildProviderLookupByAnyKey(store.providers);
  const baseProviders = requested?.length
    ? requested
      .map((id) => byProvider.get(id) ?? providerByAnyKey.get(normalizeProviderLookupKey(id)) ?? null)
      .filter((provider): provider is Provider => Boolean(provider))
    : store.providers;
  const candidates = baseProviders.map((provider) => toCandidate(provider, store));
  const capabilityInference = requiredCapabilitiesForIntent(input.intent);
  const requiredCapabilities = capabilityInference.requiredCapabilities;
  const shouldMatchCapabilities = requiredCapabilities.length > 0;
  const isHighSpecificityDexTrendingIntent = isDexTrendingIntent(requiredCapabilities);
  const isResearchAnswerIntent = isResearchAnswerIntentCapabilities(requiredCapabilities);
  for (const candidate of candidates) {
    candidate.capabilityMatchScore = capabilityMatchScore(candidate.capabilities, requiredCapabilities);
  }

  const minTrustScore = input.constraints?.minTrustScore ?? DEFAULT_MIN_TRUST_SCORE;
  const maxLatencyMs = input.constraints?.maxLatencyMs ?? null;
  const maxCostUsd = input.constraints?.maxCostUsd ?? null;

  const categoryToken = normalizeCategory(input.category);
  const categoryAliases = categoryToken ? aliasesForCategory(categoryToken, requiredCapabilities) : null;

  const rejectedProviders: PreflightResponse['rejectedProviders'] = [];
  const consideredProvidersRejected: NonNullable<PreflightResponse['consideredProvidersRejected']> = [];
  const categoryMatchedCandidates: Candidate[] = [];
  const capabilityMatchedCandidates: Candidate[] = [];

  for (const candidate of candidates) {
    if (categoryAliases && !categoryAliases.has(normalizeCategory(candidate.provider.category))) {
      rejectedProviders.push({
        providerId: candidate.provider.id,
        reasons: [`category_mismatch:${normalizeCategory(candidate.provider.category)}!=${categoryToken}`]
      });
      continue;
    }
    categoryMatchedCandidates.push(candidate);
  }

  const categoryMatch = categoryAliases ? categoryMatchedCandidates.length > 0 : true;
  const capabilityRejectedByProvider = new Map<string, string[]>();
  for (const candidate of categoryMatchedCandidates) {
    if (isResearchAnswerIntent && isEmbeddingOnlyProviderForResearchAnswer(candidate)) {
      capabilityRejectedByProvider.set(candidate.provider.id, ['capability_mismatch:embedding_provider_without_research_answer']);
      continue;
    }
    if (isResearchAnswerIntent && isNonResearchSpecializedProviderForResearchAnswer(candidate)) {
      capabilityRejectedByProvider.set(candidate.provider.id, ['capability_mismatch:non_research_specialized_provider']);
      continue;
    }
    if (!shouldMatchCapabilities || hasAnyCapability(candidate.capabilities, requiredCapabilities)) {
      capabilityMatchedCandidates.push(candidate);
      continue;
    }
    const providerCapability = candidate.capabilities[0] ?? 'none';
    capabilityRejectedByProvider.set(candidate.provider.id, requiredCapabilities.map((required) => `capability_mismatch:${providerCapability}!=${required}`));
  }

  const capabilityMatch = shouldMatchCapabilities ? capabilityMatchedCandidates.length > 0 : true;
  if (shouldMatchCapabilities) {
    for (const [providerId, reasons] of capabilityRejectedByProvider) {
      rejectedProviders.push({ providerId, reasons });
      const candidate = categoryMatchedCandidates.find((item) => item.provider.id === providerId);
      if (candidate) {
        consideredProvidersRejected.push({
          providerId,
          category: candidate.provider.category,
          capabilities: candidate.capabilities,
          reasons
        });
      }
    }
  }
  const rejectedView = rejectedProvidersForResponse(rejectedProviders, Boolean(input.debug));
  const consideredRejectedView = consideredProvidersRejectedForResponse(consideredProvidersRejected, Boolean(input.debug));
  const rejectionSummary = buildRejectionSummary(rejectedProviders);

  if (candidates.length === 0) {
    return {
      decision: 'route_blocked',
      blockReason: 'no_candidates',
      selectedProvider: null,
      selectedProviderDetails: null,
      rejectedProviders: rejectedView.rejectedProviders,
      rejectionSummary,
      consideredProvidersRejected: consideredRejectedView,
      rejectedProviderCount: rejectedView.rejectedProviderCount,
      rejectedProvidersTruncated: rejectedView.rejectedProvidersTruncated,
      categoryMatch,
      capabilityMatch,
      requiredCapabilities,
      capabilityInferenceReason: capabilityInference.capabilityInferenceReason,
      fallbackCategoryUsed: false,
      candidateCount: candidates.length,
      consideredProviderCount: categoryMatchedCandidates.length,
      routingPolicy: {
        intent: input.intent,
        category: input.category ?? null,
        constraints: { minTrustScore, maxLatencyMs, maxCostUsd },
        tieBreaker: 'lower_latency_ms',
        priorityOrder: PRE_FLIGHT_PRIORITY_ORDER
      },
      generatedAt,
      dataMode: dataModeForSource(sourceState, store.providers.length),
      source: {
        mode: sourceState.mode,
        url: sourceState.url,
        generatedAt: sourceState.generated_at,
        lastIngestedAt: sourceState.last_ingested_at,
        providerCount: sourceState.provider_count ?? store.providers.length,
        usedFixture: sourceState.used_fixture,
        error: sourceState.error ?? null
      }
    };
  }

  if (!categoryMatch) {
    return {
      decision: 'route_blocked',
      blockReason: 'no_category_match',
      selectedProvider: null,
      selectedProviderDetails: null,
      rejectedProviders: rejectedView.rejectedProviders,
      rejectionSummary,
      consideredProvidersRejected: consideredRejectedView,
      rejectedProviderCount: rejectedView.rejectedProviderCount,
      rejectedProvidersTruncated: rejectedView.rejectedProvidersTruncated,
      categoryMatch: false,
      capabilityMatch,
      requiredCapabilities,
      capabilityInferenceReason: capabilityInference.capabilityInferenceReason,
      fallbackCategoryUsed: false,
      candidateCount: candidates.length,
      consideredProviderCount: categoryMatchedCandidates.length,
      routingPolicy: {
        intent: input.intent,
        category: input.category ?? null,
        constraints: { minTrustScore, maxLatencyMs, maxCostUsd },
        tieBreaker: 'lower_latency_ms',
        priorityOrder: PRE_FLIGHT_PRIORITY_ORDER
      },
      generatedAt,
      dataMode: dataModeForSource(sourceState, store.providers.length),
      source: {
        mode: sourceState.mode,
        url: sourceState.url,
        generatedAt: sourceState.generated_at,
        lastIngestedAt: sourceState.last_ingested_at,
        providerCount: sourceState.provider_count ?? store.providers.length,
        usedFixture: sourceState.used_fixture,
        error: sourceState.error ?? null
      }
    };
  }

  if (!capabilityMatch) {
    return {
      decision: 'route_blocked',
      blockReason: 'no_capability_match',
      selectedProvider: null,
      selectedProviderDetails: null,
      rejectedProviders: rejectedView.rejectedProviders,
      rejectionSummary,
      consideredProvidersRejected: consideredRejectedView,
      rejectedProviderCount: rejectedView.rejectedProviderCount,
      rejectedProvidersTruncated: rejectedView.rejectedProvidersTruncated,
      categoryMatch,
      capabilityMatch: false,
      requiredCapabilities,
      capabilityInferenceReason: capabilityInference.capabilityInferenceReason,
      fallbackCategoryUsed: false,
      candidateCount: candidates.length,
      consideredProviderCount: categoryMatchedCandidates.length,
      routingPolicy: {
        intent: input.intent,
        category: input.category ?? null,
        constraints: { minTrustScore, maxLatencyMs, maxCostUsd },
        tieBreaker: 'lower_latency_ms',
        priorityOrder: PRE_FLIGHT_PRIORITY_ORDER
      },
      generatedAt,
      dataMode: dataModeForSource(sourceState, store.providers.length),
      source: {
        mode: sourceState.mode,
        url: sourceState.url,
        generatedAt: sourceState.generated_at,
        lastIngestedAt: sourceState.last_ingested_at,
        providerCount: sourceState.provider_count ?? store.providers.length,
        usedFixture: sourceState.used_fixture,
        error: sourceState.error ?? null
      }
    };
  }

  const accepted: Candidate[] = [];
  for (const candidate of capabilityMatchedCandidates) {
    const reasons: string[] = [];
    if (candidate.effectiveTrustScore === null || candidate.effectiveTrustScore < minTrustScore) reasons.push(`trust_score_below_min:${candidate.effectiveTrustScore ?? 'unknown'}<${minTrustScore}`);
    if (candidate.degraded) reasons.push('active_degradation');
    if (maxLatencyMs !== null) {
      const allowsUnknownLatency = allowsUnknownLatencyForSpecificCapabilityMatch(candidate, requiredCapabilities);
      if (candidate.latencyMs === null) {
        if (allowsUnknownLatency) {
          candidate.policyNotes.push(LATENCY_UNKNOWN_POLICY_NOTE);
        } else {
          reasons.push(`latency_exceeds_max:${candidate.latencyMs ?? 'unknown'}>${maxLatencyMs}`);
        }
      } else if (candidate.latencyMs > maxLatencyMs) {
        reasons.push(`latency_exceeds_max:${candidate.latencyMs}>${maxLatencyMs}`);
      }
    }
    if (maxCostUsd !== null && (candidate.minCostUsd === null || candidate.minCostUsd > maxCostUsd)) reasons.push(`cost_exceeds_max:${candidate.minCostUsd ?? 'unknown'}>${maxCostUsd}`);
    if (reasons.length > 0) {
      rejectedProviders.push({ providerId: candidate.provider.id, reasons });
      consideredProvidersRejected.push({
        providerId: candidate.provider.id,
        category: candidate.provider.category,
        capabilities: candidate.capabilities,
        reasons
      });
    } else accepted.push(candidate);
  }

  accepted.sort((a, b) =>
    compareNumbersDesc(a.capabilityMatchScore, b.capabilityMatchScore)
    || (isResearchAnswerIntent
      ? (compareNumbersDesc(researchAnswerSpecificityScore(a), researchAnswerSpecificityScore(b))
        || compareNumbersDesc(a.signalScore, b.signalScore)
        || compareNumbersDesc(a.effectiveTrustScore, b.effectiveTrustScore)
        || compareNumbersAsc(a.latencyMs, b.latencyMs))
      : 0)
    || (isRpcIntent(requiredCapabilities)
      ? (compareNumbersDesc(rpcSpecificityScore(a), rpcSpecificityScore(b))
        || compareNumbersDesc(a.effectiveTrustScore, b.effectiveTrustScore)
        || compareNumbersAsc(a.latencyMs, b.latencyMs))
      : 0)
    || compareNumbersDesc(a.signalScore, b.signalScore)
    || (isHighSpecificityDexTrendingIntent
      ? (compareNumbersDesc(a.effectiveTrustScore, b.effectiveTrustScore) || compareNumbersAsc(a.latencyMs, b.latencyMs))
      : (compareNumbersAsc(a.latencyMs, b.latencyMs) || compareNumbersDesc(a.effectiveTrustScore, b.effectiveTrustScore)))
    || a.provider.id.localeCompare(b.provider.id));

  const selected = accepted[0] ?? null;
  if (selected) {
    for (const candidate of accepted) {
      if (candidate.provider.id === selected.provider.id) continue;
      consideredProvidersRejected.push({
        providerId: candidate.provider.id,
        category: candidate.provider.category,
        capabilities: candidate.capabilities,
        reasons: [`lower_capability_match_score:${candidate.capabilityMatchScore}<${selected.capabilityMatchScore}`]
      });
    }
  }
  const rejectedViewFinal = rejectedProvidersForResponse(rejectedProviders, Boolean(input.debug));
  const consideredRejectedViewFinal = consideredProvidersRejectedForResponse(consideredProvidersRejected, Boolean(input.debug));
  const rejectionSummaryFinal = buildRejectionSummary(rejectedProviders);
  return {
    decision: selected ? 'route_approved' : 'route_blocked',
    blockReason: selected ? null : 'all_candidates_rejected_by_policy',
    selectedProvider: selected?.provider.id ?? null,
    selectedProviderDetails: selected ? {
      providerId: selected.provider.id,
      name: selected.provider.name,
      category: selected.provider.category,
      capabilities: selected.capabilities,
      capabilityMatchScore: selected.capabilityMatchScore,
      policyNotes: selected.policyNotes.length > 0 ? selected.policyNotes : undefined,
      trustScore: selected.trustScore,
      originalTrustScore: selected.trustScore,
      effectiveTrustScore: selected.effectiveTrustScore,
      verifiedRoute: selected.verifiedRoute,
      verificationSource: selected.verificationSource ?? undefined,
      verificationStatus: selected.verificationStatus ?? undefined,
      verificationFqn: selected.verificationFqn ?? undefined,
      verificationOutputShape: selected.verificationOutputShape ?? undefined,
      signalScore: selected.signalScore,
      latencyMs: selected.latencyMs,
      costUsd: selected.minCostUsd,
      degradationFlag: selected.degraded
    } : null,
    rejectedProviders: rejectedViewFinal.rejectedProviders,
    rejectionSummary: rejectionSummaryFinal,
    consideredProvidersRejected: consideredRejectedViewFinal,
    rejectedProviderCount: rejectedViewFinal.rejectedProviderCount,
    rejectedProvidersTruncated: rejectedViewFinal.rejectedProvidersTruncated,
    categoryMatch,
    capabilityMatch,
    requiredCapabilities,
    capabilityInferenceReason: capabilityInference.capabilityInferenceReason,
    fallbackCategoryUsed: false,
    candidateCount: candidates.length,
    consideredProviderCount: categoryMatchedCandidates.length,
    routingPolicy: {
      intent: input.intent,
      category: input.category ?? null,
      constraints: { minTrustScore, maxLatencyMs, maxCostUsd },
      tieBreaker: 'lower_latency_ms',
      priorityOrder: PRE_FLIGHT_PRIORITY_ORDER
    },
    generatedAt,
    dataMode: dataModeForSource(sourceState, store.providers.length),
    source: {
      mode: sourceState.mode,
      url: sourceState.url,
      generatedAt: sourceState.generated_at,
      lastIngestedAt: sourceState.last_ingested_at,
      providerCount: sourceState.provider_count ?? store.providers.length,
      usedFixture: sourceState.used_fixture,
      error: sourceState.error ?? null
    }
  };
}

function toCandidate(provider: Provider, store: IntelligenceStore): Candidate {
  const trust = latestForProvider(store.trustAssessments, provider.id);
  const signal = latestForProvider(store.signalAssessments, provider.id);
  const providerEvents = store.events
    .filter((event) => event.entityType === 'provider' && event.entityId === provider.id && isProviderHealthEvent(event.type))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const latestHealth = providerEvents[0] ?? null;
  const latestLatency = latestNumericLatency(providerEvents);
  const degraded = latestHealth ? latestHealth.type === 'provider.degraded' || latestHealth.type === 'provider.failed' : false;
  const routeOverlay = verifiedRouteOverlayForProvider(provider);
  const baseTrustScore = trust?.score ?? null;
  const effectiveTrustScore = effectiveTrustScoreForProvider(baseTrustScore, routeOverlay, degraded);
  const policyNotes: string[] = [];
  if (baseTrustScore !== null && effectiveTrustScore !== null && effectiveTrustScore > baseTrustScore) {
    policyNotes.push(VERIFIED_ROUTE_EFFECTIVE_TRUST_FLOOR_NOTE);
  }
  return {
    provider,
    capabilities: inferProviderCapabilities(provider, store),
    capabilityMatchScore: 0,
    policyNotes,
    verifiedRoute: routeOverlay?.verifiedRoute ?? false,
    verificationSource: routeOverlay?.verificationSource ?? null,
    verificationStatus: routeOverlay?.status ?? null,
    verificationFqn: routeOverlay?.fqn ?? null,
    verificationOutputShape: routeOverlay?.outputShape ?? null,
    trustScore: baseTrustScore,
    effectiveTrustScore,
    signalScore: signal?.score ?? null,
    latencyMs: latestLatency,
    minCostUsd: provider.pricing.min,
    degraded
  };
}

function inferProviderCapabilities(provider: Provider, store: IntelligenceStore): CapabilityTag[] {
  const endpointTokens = store.endpoints
    .filter((endpoint) => endpoint.providerId === provider.id)
    .map((endpoint) => `${safe(endpoint.name)} ${safe(endpoint.path)} ${safe(endpoint.description)} ${safe(endpoint.category)}`);
  const searchable = `${safe(provider.id)} ${safe(provider.name)} ${safe(provider.category)} ${safe(provider.description)} ${provider.tags.map(safe).join(' ')} ${endpointTokens.join(' ')}`.toLowerCase();
  const inferred = new Set<CapabilityTag>();

  const addIf = (capability: CapabilityTag, patterns: RegExp[]) => {
    if (patterns.some((pattern) => pattern.test(searchable))) inferred.add(capability);
  };

  addIf('payment', [/\bpayout\b/, /\btransfer\b/, /\bcheckout\b/, /\bpay(able|ing)?\b/]);
  addIf('settlement', [/\bsettle(ment|ments|d|s)?\b/, /\bpayout\b/]);
  addIf('market_data', [/\bmarket\b/, /\btoken\b/, /\bcoingecko\b/, /\bquote\b/, /\bexchange\s*rate\b/, /\bprice\s*feed\b/]);
  addIf('pricing', [/\bprice\b/, /\bpricing\b/, /\bquote\b/, /\brate\b/, /\bcoingecko\b/]);
  const stableCryptoDexTerms = [/\bdex\b/, /\bpool\b/, /\bpools\b/, /\bgeckoterminal\b/, /\bonchain\s+pools\b/];
  if (provider.id === 'stablecrypto' || safe(provider.name).toLowerCase() === 'stablecrypto') {
    addIf('dex_pools', stableCryptoDexTerms);
  } else {
    addIf('dex_pools', [/\bonchain\b/, /\bdex\b/, /\bpool\b/, /\bpools\b/, /\btrending\s*pools\b/, /\bgeckoterminal\b/]);
  }
  addIf('trending', [/\btrending\b/, /\btrend(?:ing)?\b/, /\btop\b/, /\bhot\b/]);
  addIf('enrichment', [/\benrich(ment)?\b/, /\bverify\b/]);
  addIf('messaging', [/\bemail\b/, /\bmessage\b/, /\bsms\b/, /\bmail\b/]);
  addIf('media_generation', [/\bimage\b/, /\bvideo\b/, /\bgenerate\b/, /\bgeneration\b/, /\bmedia\b/]);
  addIf('search', [/\bsearch\b/, /\bfind\b/, /\bquery\b/]);
  addIf('ai_ml', [/\bai\b/, /\bml\b/, /\bllm\b/, /\bmodel\b/, /\binference\b/]);
  addIf('analytics', [/\banalytics?\b/, /\binsight\b/, /\bmetrics?\b/]);
  addIf('storage', [/\bstorage\b/, /\bstore\b/, /\bobject\b/, /\bblob\b/]);
  addIf('compute', [/\bcompute\b/, /\bexecute\b/, /\brun\b/, /\bjob\b/]);
  addIf('ai_inference', [/\bai\b/, /\bllm\b/, /\binference\b/, /\bmodel\b/, /\bgenerate text\b/]);
  addIf('rpc', [/\brpc\b/, /\bjson[\s-]?rpc\b/]);
  addIf('blockchain', [/\bblockchain\b/, /\bon-?chain\b/, /\bsolana\b/, /\bethereum\b/, /\bmainnet\b/, /\bnode\b/]);
  addIf('onchain', [/\bon-?chain\b/, /\bonchain\b/, /\bstate\b/]);
  addIf('solana', [/\bsolana\b/, /\bsolana-mainnet\b/]);
  addIf('vision', [/\bvision\b/, /\bimage\b/]);
  addIf('image_labels', [/\blabel(?:s|ing)?\b/, /\bimage labels?\b/]);
  addIf('image_analysis', [/\banalysis\b/, /\bclassif(?:y|ication)\b/, /\bdetect\b/]);
  addIf('ocr', [/\bocr\b/, /\boptical character recognition\b/]);
  addIf('text_detection', [/\btext detection\b/, /\bread text\b/, /\bextract text\b/]);
  addIf('safe_search', [/\bsafe search\b/, /\bmoderation\b/, /\bunsafe content\b/]);
  addIf('logo_detection', [/\blogo\b/]);
  addIf('landmark_detection', [/\blandmark\b/]);

  if (provider.id === 'quicknode-rpc') {
    inferred.add('rpc');
    inferred.add('blockchain');
    inferred.add('compute');
    inferred.add('onchain');
    inferred.add('solana');
  }

  if (isPerplexityProvider(provider)) {
    for (const capability of RESEARCH_ANSWER_CAPABILITIES) inferred.add(capability);
    inferred.add('research');
    inferred.add('search');
    inferred.add('ai_inference');
    inferred.add('web_search');
    inferred.add('citations');
    inferred.add('cited_answer');
    inferred.add('grounded_answer');
    inferred.add('research_answer');
    inferred.add('live_research');
    inferred.add('answer');
    inferred.add('ai_ml');
  }

  if (isGoogleVisionProvider(provider)) {
    for (const capability of VISION_ANALYSIS_CAPABILITIES) inferred.add(capability);
    inferred.delete('web_search');
    inferred.delete('citations');
    inferred.delete('research_answer');
    inferred.delete('grounded_answer');
    inferred.delete('cited_answer');
    inferred.delete('live_research');
    inferred.delete('research');
    inferred.delete('answer');
  }

  return Array.from(inferred).sort();
}

function requiredCapabilitiesForIntent(intent: string): CapabilityInference {
  const text = safe(intent).toLowerCase();
  const hasAny = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));
  const hasAll = (patterns: RegExp[]) => patterns.every((pattern) => pattern.test(text));

  const dexPoolsPatterns = [/\btrending\b/, /\bpools?\b/, /\bdex\b/, /\bonchain\b/, /\bgeckoterminal\b/, /\bsolana\s+dex\s+pools\b/];
  const marketDataVerbs = [/\bget\b/, /\bfetch\b/, /\bretrieve\b/, /\blookup\b/, /\blook up\b/, /\bcheck\b/];
  const marketDataObjects = [/\bmarket\b/, /\bprice\b/, /\btoken\b/, /\bquote\b/, /\bcrypto\b/, /\bcoingecko\b/];

  const paymentVerbs = [/\bsend\b/, /\bexecute\b/, /\bmake\b/, /\bprocess\b/, /\bsettle\b/, /\btransfer\b/, /\bpayout\b/, /\bpay\b/, /\bcheckout\b/];
  const paymentObjects = [/\bpayment\b/, /\bpayments\b/, /\bsettlement\b/, /\bpayout\b/, /\btransfer\b/, /\bcheckout\b/];
  const paymentPhrase = /\btoken payment\b/;

  const messagingPatterns = [/\bemail\b/, /\bmessage\b/, /\bsend email\b/];
  const mediaPatterns = [/\bgenerate\b.*\bimage\b/, /\bcreate\b.*\bimage\b/, /\bgenerate\b.*\bmedia\b/, /\bcreate\b.*\bmedia\b/, /\bimage\b/, /\bmedia\b/];
  const visionPatterns = [/\bimage labels?\b/, /\bvision\b/, /\bimage analysis\b/, /\btext detection\b/, /\bocr\b/, /\blogo detection\b/, /\blandmark detection\b/];
  const searchPatterns = [/\bsearch\b/, /\bresearch\b/, /\banswer\b/];
  const researchAnswerIntentPatterns = [/\bresearch\b/, /\blatest\b/, /\bcurrent\b/, /\brecent\b/, /\bcitations?\b/, /\bcited\b/, /\bgrounded\b/, /\banswer\b/];
  const placesSearchPatterns = [/\bplaces?\b/, /\bnearby\b/, /\blocation\b/, /\bmaps?\b/, /\baddress\b/, /\bpoi\b/];
  const rpcIntentPatterns = [/\brpc\b/, /\bblockchain\s+rpc\b/, /\bon-?chain\s+state\b/, /\bjson[\s-]?rpc\b/, /\bgetbalance\b/, /\bgethealth\b/];
  const solanaMainnetPatterns = [/\bsolana\s+mainnet\b/, /\bsolana-mainnet\b/];

  if (hasAny(rpcIntentPatterns) || hasAll([/\bsolana\b/, /\bmainnet\b/]) || hasAny(solanaMainnetPatterns)) {
    return {
      requiredCapabilities: ['rpc', 'blockchain', 'solana', 'onchain', 'compute'],
      capabilityInferenceReason: 'rpc_intent_from_blockchain_rpc'
    };
  }

  if (hasAny(dexPoolsPatterns)) {
    return {
      requiredCapabilities: ['dex_pools', 'trending', 'market_data'],
      capabilityInferenceReason: 'dex_pools_intent_from_trending_pools'
    };
  }

  if (hasAny(marketDataVerbs) && hasAny(marketDataObjects)) {
    return {
      requiredCapabilities: ['market_data', 'pricing'],
      capabilityInferenceReason: 'market_data_intent_from_get_market_data'
    };
  }

  if ((hasAny(paymentVerbs) && hasAny(paymentObjects)) || paymentPhrase.test(text)) {
    return {
      requiredCapabilities: ['payment', 'settlement'],
      capabilityInferenceReason: 'payment_intent_from_execute_payment'
    };
  }

  if (hasAny(messagingPatterns)) {
    return {
      requiredCapabilities: ['messaging'],
      capabilityInferenceReason: 'messaging_intent_from_send_email'
    };
  }

  if (hasAny(visionPatterns) && !/\bgenerate\b|\bcreate\b/.test(text)) {
    return {
      requiredCapabilities: ['vision', 'image_labels', 'image_analysis'],
      capabilityInferenceReason: 'vision_intent_from_image_analysis'
    };
  }

  if (hasAny(mediaPatterns)) {
    return {
      requiredCapabilities: ['media_generation'],
      capabilityInferenceReason: 'media_generation_intent_from_generate_image'
    };
  }

  if (hasAny(placesSearchPatterns) && hasAny([/\bsearch\b/, /\bfind\b/, /\blookup\b/])) {
    return {
      requiredCapabilities: PLACES_SEARCH_CAPABILITIES,
      capabilityInferenceReason: 'places_search_intent_from_location_query'
    };
  }

  if (hasAny(searchPatterns) && hasAny(researchAnswerIntentPatterns)) {
    return {
      requiredCapabilities: RESEARCH_ANSWER_REQUIRED_CAPABILITIES,
      capabilityInferenceReason: 'research_answer_intent_from_search_research_answer'
    };
  }

  if (hasAny(searchPatterns)) {
    return {
      requiredCapabilities: ['search', 'ai_inference'],
      capabilityInferenceReason: 'search_intent_from_search_query'
    };
  }

  return { requiredCapabilities: [], capabilityInferenceReason: null };
}

function hasAnyCapability(providerCapabilities: CapabilityTag[], requiredCapabilities: CapabilityTag[]) {
  if (requiredCapabilities.length === 0) return true;
  return requiredCapabilities.some((capability) => providerCapabilities.includes(capability));
}

function capabilityMatchScore(providerCapabilities: CapabilityTag[], requiredCapabilities: CapabilityTag[]) {
  if (requiredCapabilities.length === 0) return 0;
  return requiredCapabilities.filter((capability) => providerCapabilities.includes(capability)).length;
}

function rejectedProvidersForResponse(
  rejectedProviders: PreflightResponse['rejectedProviders'],
  debug: boolean
) {
  if (debug) {
    return {
      rejectedProviders,
      rejectedProviderCount: rejectedProviders.length,
      rejectedProvidersTruncated: false
    };
  }
  return {
    rejectedProviders: rejectedProviders.slice(0, MAX_REJECTED_PROVIDERS_IN_RESPONSE),
    rejectedProviderCount: rejectedProviders.length,
    rejectedProvidersTruncated: rejectedProviders.length > MAX_REJECTED_PROVIDERS_IN_RESPONSE
  };
}

function consideredProvidersRejectedForResponse(
  consideredProvidersRejected: NonNullable<PreflightResponse['consideredProvidersRejected']>,
  debug: boolean
) {
  if (debug) return consideredProvidersRejected;
  return consideredProvidersRejected.slice(0, MAX_CONSIDERED_PROVIDERS_REJECTED_IN_RESPONSE);
}

function buildRejectionSummary(rejectedProviders: PreflightResponse['rejectedProviders']) {
  let categoryMismatchCount = 0;
  let capabilityMismatchCount = 0;
  let policyRejectedCount = 0;
  for (const item of rejectedProviders) {
    const hasCategoryMismatch = item.reasons.some((reason) => reason.startsWith('category_mismatch:'));
    const hasCapabilityMismatch = item.reasons.some((reason) => reason.startsWith('capability_mismatch:'));
    if (hasCategoryMismatch) {
      categoryMismatchCount += 1;
      continue;
    }
    if (hasCapabilityMismatch) {
      capabilityMismatchCount += 1;
      continue;
    }
    policyRejectedCount += 1;
  }
  return {
    totalRejectedCount: rejectedProviders.length,
    categoryMismatchCount,
    capabilityMismatchCount,
    policyRejectedCount
  };
}

function safe(value: string | null | undefined) {
  return (value ?? '').trim();
}

function latestForProvider<T extends { entityId: string; assessedAt: string }>(items: T[], providerId: string) {
  return items
    .filter((item) => item.entityId === providerId)
    .sort((a, b) => Date.parse(b.assessedAt) - Date.parse(a.assessedAt))[0] ?? null;
}

function latestNumericLatency(events: IntelligenceStore['events']) {
  for (const event of events) {
    const value = event.payload.response_time_ms;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function isProviderHealthEvent(type: IntelligenceStore['events'][number]['type']) {
  return type === 'provider.checked' || type === 'provider.reachable' || type === 'provider.recovered' || type === 'provider.degraded' || type === 'provider.failed';
}

function dataModeForSource(sourceState: DataSourceState, providerCount: number): PreflightResponse['dataMode'] {
  if (sourceState.mode === 'live_pay_sh_catalog' && !sourceState.error) return 'live';
  if (providerCount > 0 && !sourceState.error) return 'cached';
  return 'fallback';
}

function compareNumbersDesc(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareNumbersAsc(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function normalizeCategory(value: string | undefined | null) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function aliasesForCategory(requestedCategory: string, requiredCapabilities: CapabilityTag[]) {
  if (hasAnyCapability(requiredCapabilities, MARKET_DATA_CAPABILITIES) && MARKET_DATA_CATEGORY_BRIDGE.includes(requestedCategory)) {
    return new Set(MARKET_DATA_CATEGORY_BRIDGE);
  }
  if (CATEGORY_ALIASES[requestedCategory]) return new Set(CATEGORY_ALIASES[requestedCategory]);
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.includes(requestedCategory)) return new Set(CATEGORY_ALIASES[canonical]);
  }
  return new Set([requestedCategory]);
}

function isDexTrendingIntent(requiredCapabilities: CapabilityTag[]) {
  return DEX_TRENDING_CAPABILITIES.some((capability) => requiredCapabilities.includes(capability));
}

function buildProviderLookupByAnyKey(providers: Provider[]) {
  const lookup = new Map<string, Provider>();
  for (const provider of providers) {
    for (const key of providerLookupKeys(provider)) {
      if (!lookup.has(key)) lookup.set(key, provider);
    }
  }
  return lookup;
}

function providerLookupKeys(provider: Provider) {
  const raw = [provider.id, provider.slug, provider.name, provider.fqn, provider.namespace, provider.serviceUrl ?? null];
  return Array.from(new Set(raw.map((item) => normalizeProviderLookupKey(item)).filter(Boolean)));
}

function normalizeProviderLookupKey(value: string | null | undefined) {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function isPerplexityProvider(provider: Provider) {
  const searchable = `${safe(provider.id)} ${safe(provider.slug)} ${safe(provider.name)} ${safe(provider.namespace)} ${safe(provider.fqn)} ${safe(provider.serviceUrl)}`.toLowerCase();
  return searchable.includes('perplexity')
    || searchable.includes('paysponge-perplexity')
    || searchable.includes('paysponge/perplexity')
    || searchable.includes('pplx');
}

function isGoogleVisionProvider(provider: Provider) {
  const keys = providerLookupKeys(provider);
  const searchable = `${safe(provider.id)} ${safe(provider.name)} ${safe(provider.namespace)} ${safe(provider.fqn)} ${safe(provider.serviceUrl)}`.toLowerCase();
  return keys.includes('solana-foundation-google-vision')
    || searchable.includes('google vision')
    || searchable.includes('/vision')
    || searchable.includes('vision.googleapis.com');
}

function isResearchAnswerIntentCapabilities(requiredCapabilities: CapabilityTag[]) {
  return requiredCapabilities.some((capability) => RESEARCH_ANSWER_REQUIRED_CAPABILITIES.includes(capability));
}

function isEmbeddingOnlyProviderForResearchAnswer(candidate: Candidate) {
  const searchable = `${safe(candidate.provider.id)} ${safe(candidate.provider.name)} ${safe(candidate.provider.namespace)} ${safe(candidate.provider.description)} ${candidate.provider.tags.join(' ')}`.toLowerCase();
  const embeddingLike = /\bembeddings?\b|\bvector\b/.test(searchable);
  if (!embeddingLike) return false;
  return !RESEARCH_ANSWER_REQUIRED_CAPABILITIES.some((capability) => candidate.capabilities.includes(capability));
}

function isNonResearchSpecializedProviderForResearchAnswer(candidate: Candidate) {
  const searchable = `${safe(candidate.provider.id)} ${safe(candidate.provider.name)} ${safe(candidate.provider.namespace)} ${safe(candidate.provider.description)} ${candidate.provider.tags.join(' ')}`.toLowerCase();
  const specialized = /\bvision\b|\bimage\b|\bembeddings?\b|\bvector\b|\bcaptcha\b|\bdocument(?:\s+parse|\s+parser|\s+processing)?\b|\bocr\b/.test(searchable);
  if (!specialized) return false;
  return !RESEARCH_ANSWER_REQUIRED_CAPABILITIES.some((capability) => candidate.capabilities.includes(capability));
}

function isRpcIntent(requiredCapabilities: CapabilityTag[]) {
  return RPC_BLOCKCHAIN_SOLANA_CAPABILITIES.every((capability) => requiredCapabilities.includes(capability));
}

function rpcSpecificityScore(candidate: Candidate) {
  let score = 0;
  if (candidate.capabilities.includes('rpc')) score += 1;
  if (candidate.capabilities.includes('blockchain')) score += 1;
  if (candidate.capabilities.includes('solana')) score += 1;
  return score;
}

function allowsUnknownLatencyForSpecificCapabilityMatch(candidate: Candidate, requiredCapabilities: CapabilityTag[]) {
  if (isDexTrendingIntent(requiredCapabilities)) {
    if (candidate.capabilityMatchScore < 2) return false;
    return DEX_TRENDING_CAPABILITIES.some((capability) => candidate.capabilities.includes(capability));
  }
  if (isRpcIntent(requiredCapabilities)) {
    if (candidate.capabilityMatchScore < 3) return false;
    return RPC_BLOCKCHAIN_SOLANA_CAPABILITIES.every((capability) => candidate.capabilities.includes(capability));
  }
  if (isResearchAnswerIntentCapabilities(requiredCapabilities)) {
    if (candidate.capabilityMatchScore < 4) return false;
    return ['research_answer', 'web_search', 'citations'].every((capability) => candidate.capabilities.includes(capability as CapabilityTag));
  }
  return false;
}

function researchAnswerSpecificityScore(candidate: Candidate) {
  let score = 0;
  if (candidate.capabilities.includes('research_answer')) score += 5;
  if (candidate.capabilities.includes('cited_answer')) score += 4;
  if (candidate.capabilities.includes('grounded_answer')) score += 4;
  if (candidate.capabilities.includes('web_search')) score += 3;
  if (candidate.capabilities.includes('citations')) score += 3;
  if (candidate.capabilities.includes('live_research')) score += 2;
  if (candidate.capabilities.includes('answer')) score += 1;
  if (candidate.capabilities.includes('search')) score += 1;
  if (isEmbeddingOnlyProviderForResearchAnswer(candidate)) score -= 10;
  if (isNonResearchSpecializedProviderForResearchAnswer(candidate)) score -= 10;
  return score;
}

function verifiedRouteOverlayForProvider(provider: Provider) {
  const keys = providerLookupKeys(provider);
  return VERIFIED_ROUTE_OVERLAYS.find((overlay) =>
    keys.includes(normalizeProviderLookupKey(overlay.providerId))
    || keys.includes(normalizeProviderLookupKey(overlay.fqn))
  ) ?? null;
}

function effectiveTrustScoreForProvider(
  trustScore: number | null,
  overlay: VerifiedRouteOverlay | null,
  degraded: boolean
) {
  if (trustScore === null) return null;
  if (!overlay) return trustScore;
  if (degraded) return trustScore;
  if (!overlay.verifiedRoute || overlay.status !== 'verified_pay_cli_success') return trustScore;
  return Math.max(trustScore, VERIFIED_ROUTE_EFFECTIVE_TRUST_FLOOR);
}
