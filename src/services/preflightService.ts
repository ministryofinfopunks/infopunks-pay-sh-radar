import { PreflightRequest, PreflightResponse, Provider } from '../schemas/entities';
import { DataSourceState } from '../persistence/repository';
import { IntelligenceStore } from './intelligenceStore';
import { dataSourceState } from './pulseService';

type Candidate = {
  provider: Provider;
  capabilities: CapabilityTag[];
  capabilityMatchScore: number;
  trustScore: number | null;
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
  | 'trending';

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

export function runPreflight(input: PreflightRequest, store: IntelligenceStore): PreflightResponse {
  const sourceState = dataSourceState(store);
  const generatedAt = new Date().toISOString();
  const byProvider = new Map(store.providers.map((provider) => [provider.id, provider]));
  const requested = input.candidateProviders?.map((id) => id.trim()).filter(Boolean);
  const baseProviders = requested?.length
    ? requested.map((id) => byProvider.get(id)).filter((provider): provider is Provider => Boolean(provider))
    : store.providers;
  const candidates = baseProviders.map((provider) => toCandidate(provider, store));
  const capabilityInference = requiredCapabilitiesForIntent(input.intent);
  const requiredCapabilities = capabilityInference.requiredCapabilities;
  const shouldMatchCapabilities = requiredCapabilities.length > 0;
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
    if (candidate.trustScore === null || candidate.trustScore < minTrustScore) reasons.push(`trust_score_below_min:${candidate.trustScore ?? 'unknown'}<${minTrustScore}`);
    if (candidate.degraded) reasons.push('active_degradation');
    if (maxLatencyMs !== null && (candidate.latencyMs === null || candidate.latencyMs > maxLatencyMs)) reasons.push(`latency_exceeds_max:${candidate.latencyMs ?? 'unknown'}>${maxLatencyMs}`);
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
    || compareNumbersDesc(a.signalScore, b.signalScore)
    || compareNumbersAsc(a.latencyMs, b.latencyMs)
    || compareNumbersDesc(a.trustScore, b.trustScore)
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
      trustScore: selected.trustScore,
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
  return {
    provider,
    capabilities: inferProviderCapabilities(provider, store),
    capabilityMatchScore: 0,
    trustScore: trust?.score ?? null,
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
  addIf('dex_pools', [/\bonchain\b/, /\bdex\b/, /\bpool\b/, /\bpools\b/, /\btrending\s*pools\b/, /\bgeckoterminal\b/]);
  addIf('trending', [/\btrending\b/, /\btrend(?:ing)?\b/, /\btop\b/, /\bhot\b/]);
  addIf('enrichment', [/\benrich(ment)?\b/, /\bverify\b/]);
  addIf('messaging', [/\bemail\b/, /\bmessage\b/, /\bsms\b/, /\bmail\b/]);
  addIf('media_generation', [/\bimage\b/, /\bvideo\b/, /\bgenerate\b/, /\bgeneration\b/, /\bmedia\b/]);
  addIf('search', [/\bsearch\b/, /\bresearch\b/, /\bfind\b/, /\bquery\b/]);
  addIf('analytics', [/\banalytics?\b/, /\binsight\b/, /\bmetrics?\b/]);
  addIf('storage', [/\bstorage\b/, /\bstore\b/, /\bobject\b/, /\bblob\b/]);
  addIf('compute', [/\bcompute\b/, /\bexecute\b/, /\brun\b/, /\bjob\b/]);
  addIf('ai_inference', [/\bai\b/, /\bllm\b/, /\binference\b/, /\bmodel\b/, /\banswer\b/, /\bgenerate text\b/]);

  return Array.from(inferred).sort();
}

function requiredCapabilitiesForIntent(intent: string): CapabilityInference {
  const text = safe(intent).toLowerCase();
  const hasAny = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

  const dexPoolsPatterns = [/\btrending\b/, /\bpools?\b/, /\bdex\b/, /\bonchain\b/, /\bgeckoterminal\b/, /\bsolana\s+dex\s+pools\b/];
  const marketDataVerbs = [/\bget\b/, /\bfetch\b/, /\bretrieve\b/, /\blookup\b/, /\blook up\b/, /\bcheck\b/];
  const marketDataObjects = [/\bmarket\b/, /\bprice\b/, /\btoken\b/, /\bquote\b/, /\bcrypto\b/, /\bcoingecko\b/];

  const paymentVerbs = [/\bsend\b/, /\bexecute\b/, /\bmake\b/, /\bprocess\b/, /\bsettle\b/, /\btransfer\b/, /\bpayout\b/, /\bpay\b/, /\bcheckout\b/];
  const paymentObjects = [/\bpayment\b/, /\bpayments\b/, /\bsettlement\b/, /\bpayout\b/, /\btransfer\b/, /\bcheckout\b/];
  const paymentPhrase = /\btoken payment\b/;

  const messagingPatterns = [/\bemail\b/, /\bmessage\b/, /\bsend email\b/];
  const mediaPatterns = [/\bgenerate\b.*\bimage\b/, /\bcreate\b.*\bimage\b/, /\bgenerate\b.*\bmedia\b/, /\bcreate\b.*\bmedia\b/, /\bimage\b/, /\bmedia\b/];
  const searchPatterns = [/\bsearch\b/, /\bresearch\b/, /\banswer\b/];

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

  if (hasAny(mediaPatterns)) {
    return {
      requiredCapabilities: ['media_generation'],
      capabilityInferenceReason: 'media_generation_intent_from_generate_image'
    };
  }

  if (hasAny(searchPatterns)) {
    return {
      requiredCapabilities: ['search', 'ai_inference'],
      capabilityInferenceReason: 'search_intent_from_search_research_answer'
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
