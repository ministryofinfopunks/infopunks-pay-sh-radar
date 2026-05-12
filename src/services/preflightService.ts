import { PreflightRequest, PreflightResponse, Provider } from '../schemas/entities';
import { DataSourceState } from '../persistence/repository';
import { IntelligenceStore } from './intelligenceStore';
import { dataSourceState } from './pulseService';

type Candidate = {
  provider: Provider;
  capabilities: CapabilityTag[];
  trustScore: number | null;
  signalScore: number | null;
  latencyMs: number | null;
  minCostUsd: number | null;
  degraded: boolean;
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
  | 'ai_inference';

const DEFAULT_MIN_TRUST_SCORE = 70;
const MAX_REJECTED_PROVIDERS_IN_RESPONSE = 25;
const PRE_FLIGHT_PRIORITY_ORDER = ['category_match', 'capability_match', 'min_trust_score', 'active_degradation', 'max_latency_ms', 'max_cost_usd', 'higher_signal_score', 'lower_latency_ms'];

const CATEGORY_ALIASES: Record<string, string[]> = {
  payments: ['payments', 'payment', 'finance', 'fintech', 'crypto', 'settlement'],
  data: ['data', 'analytics', 'enrichment'],
  ai: ['ai_ml', 'ai', 'llm', 'inference'],
  image: ['image', 'media', 'generation'],
  speech: ['speech', 'voice', 'audio']
};

export function runPreflight(input: PreflightRequest, store: IntelligenceStore): PreflightResponse {
  const sourceState = dataSourceState(store);
  const generatedAt = new Date().toISOString();
  const byProvider = new Map(store.providers.map((provider) => [provider.id, provider]));
  const requested = input.candidateProviders?.map((id) => id.trim()).filter(Boolean);
  const baseProviders = requested?.length
    ? requested.map((id) => byProvider.get(id)).filter((provider): provider is Provider => Boolean(provider))
    : store.providers;
  const candidates = baseProviders.map((provider) => toCandidate(provider, store));
  const requiredCapabilities = requiredCapabilitiesForIntent(input.intent);
  const shouldMatchCapabilities = requiredCapabilities.length > 0;

  const minTrustScore = input.constraints?.minTrustScore ?? DEFAULT_MIN_TRUST_SCORE;
  const maxLatencyMs = input.constraints?.maxLatencyMs ?? null;
  const maxCostUsd = input.constraints?.maxCostUsd ?? null;

  const categoryToken = normalizeCategory(input.category);
  const categoryAliases = categoryToken ? aliasesForCategory(categoryToken) : null;

  const rejectedProviders: PreflightResponse['rejectedProviders'] = [];
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
    for (const [providerId, reasons] of capabilityRejectedByProvider) rejectedProviders.push({ providerId, reasons });
  }
  const rejectedView = rejectedProvidersForResponse(rejectedProviders, Boolean(input.debug));

  if (candidates.length === 0) {
    return {
      decision: 'route_blocked',
      blockReason: 'no_candidates',
      selectedProvider: null,
      selectedProviderDetails: null,
      rejectedProviders: rejectedView.rejectedProviders,
      rejectedProviderCount: rejectedView.rejectedProviderCount,
      rejectedProvidersTruncated: rejectedView.rejectedProvidersTruncated,
      categoryMatch,
      capabilityMatch,
      requiredCapabilities,
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
      rejectedProviderCount: rejectedView.rejectedProviderCount,
      rejectedProvidersTruncated: rejectedView.rejectedProvidersTruncated,
      categoryMatch: false,
      capabilityMatch,
      requiredCapabilities,
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
      rejectedProviderCount: rejectedView.rejectedProviderCount,
      rejectedProvidersTruncated: rejectedView.rejectedProvidersTruncated,
      categoryMatch,
      capabilityMatch: false,
      requiredCapabilities,
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
    if (reasons.length > 0) rejectedProviders.push({ providerId: candidate.provider.id, reasons });
    else accepted.push(candidate);
  }

  accepted.sort((a, b) =>
    compareNumbersDesc(a.signalScore, b.signalScore)
    || compareNumbersAsc(a.latencyMs, b.latencyMs)
    || compareNumbersDesc(a.trustScore, b.trustScore)
    || a.provider.id.localeCompare(b.provider.id));

  const selected = accepted[0] ?? null;
  const rejectedViewFinal = rejectedProvidersForResponse(rejectedProviders, Boolean(input.debug));
  return {
    decision: selected ? 'route_approved' : 'route_blocked',
    blockReason: selected ? null : 'all_candidates_rejected_by_policy',
    selectedProvider: selected?.provider.id ?? null,
    selectedProviderDetails: selected ? {
      providerId: selected.provider.id,
      name: selected.provider.name,
      category: selected.provider.category,
      capabilities: selected.capabilities,
      trustScore: selected.trustScore,
      signalScore: selected.signalScore,
      latencyMs: selected.latencyMs,
      costUsd: selected.minCostUsd,
      degradationFlag: selected.degraded
    } : null,
    rejectedProviders: rejectedViewFinal.rejectedProviders,
    rejectedProviderCount: rejectedViewFinal.rejectedProviderCount,
    rejectedProvidersTruncated: rejectedViewFinal.rejectedProvidersTruncated,
    categoryMatch,
    capabilityMatch,
    requiredCapabilities,
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

  addIf('payment', [/\bpay(ment|ments|out|able|ing)?\b/, /\btransfer\b/, /\bcheckout\b/, /\bfinance\b/, /\bfintech\b/]);
  addIf('settlement', [/\bsettle(ment|ments|d|s)?\b/, /\bpayout\b/]);
  addIf('market_data', [/\bmarket\b/, /\btoken\b/, /\bcoingecko\b/, /\bquote\b/, /\bexchange\s*rate\b/, /\bprice\s*feed\b/]);
  addIf('pricing', [/\bprice\b/, /\bpricing\b/, /\bquote\b/, /\brate\b/]);
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

function requiredCapabilitiesForIntent(intent: string): CapabilityTag[] {
  const text = safe(intent).toLowerCase();
  const required = new Set<CapabilityTag>();
  if (/\bpayout\b|\bpay\b|\btransfer\b|\bsettle\b|\bsettlement\b|\bpayment\b|\bpayments\b/.test(text)) {
    required.add('payment');
    required.add('settlement');
  }
  if (/\bprice\b|\bmarket\b|\btoken\b|\bcoingecko\b|\bquote\b/.test(text)) {
    required.add('market_data');
    required.add('pricing');
  }
  if (/\bemail\b|\bmessage\b|\bsend email\b/.test(text)) required.add('messaging');
  if (/\bimage\b|\bgenerate image\b/.test(text)) required.add('media_generation');
  if (/\bsearch\b|\bresearch\b|\banswer\b/.test(text)) {
    required.add('search');
    required.add('ai_inference');
  }
  return Array.from(required);
}

function hasAnyCapability(providerCapabilities: CapabilityTag[], requiredCapabilities: CapabilityTag[]) {
  if (requiredCapabilities.length === 0) return true;
  return requiredCapabilities.every((capability) => providerCapabilities.includes(capability));
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

function aliasesForCategory(requestedCategory: string) {
  if (CATEGORY_ALIASES[requestedCategory]) return new Set(CATEGORY_ALIASES[requestedCategory]);
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.includes(requestedCategory)) return new Set(CATEGORY_ALIASES[canonical]);
  }
  return new Set([requestedCategory]);
}
