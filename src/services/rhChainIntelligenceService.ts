import {
  getRhChain4663Index,
  getRhChainDailyReceipts,
  getRhChainPayload,
  getRhChainReviewQueue,
  getRhChainReviewStateCounts,
  groupRhChainReviewItemsByState,
  listRhChainMemes,
  listRhChainReceipts,
  type RhChainDataFreshness,
  type RhChainReviewItem,
  type RhChainSource
} from '../data/rhChain';
import {
  createBlockscoutProvider,
  createCoinGeckoProvider,
  createDefiLlamaProvider,
  createDexScreenerProvider,
  createDuneProvider,
  createSocialSignalProvider,
  type RhChainProviderIdentity
} from './rhChainProviderAdapters';

export type RhChainApiResponseMeta = {
  source_policy: string;
  record_count: number | null;
  provider_status: RhChainProviderIdentity[];
  live_indexing_enabled: false;
};

export type RhChainApiResponse<T> = {
  data: T;
  meta: RhChainApiResponseMeta;
  sources: RhChainSource[];
  generated_at: string;
  data_mode: RhChainDataFreshness;
  disclaimer: string;
};

const RH_CHAIN_DISCLAIMER = 'Independent Infopunks intelligence surface. Not affiliated with, endorsed by, or partnered with Robinhood. No buy, sell, or listing recommendation.';

const providerStatus: RhChainProviderIdentity[] = [
  createDefiLlamaProvider(),
  createDexScreenerProvider(),
  createCoinGeckoProvider(),
  createBlockscoutProvider(),
  createDuneProvider(),
  createSocialSignalProvider()
].map(({ provider_name, data_mode, live_indexing_enabled }) => ({
  provider_name,
  data_mode,
  live_indexing_enabled
}));

export function assembleRhChainChainPulse() {
  return getRhChainPayload().chain_pulse;
}

export function assembleRhChainMemePulse() {
  return listRhChainMemes();
}

export function assembleRhChainReviewQueue(persistedItems: RhChainReviewItem[] = []) {
  const seedQueue = getRhChainReviewQueue();
  const items = [...seedQueue.items, ...persistedItems];
  return {
    ...seedQueue,
    generated_at: persistedItems.reduce((latest, item) => item.updated_at > latest ? item.updated_at : latest, seedQueue.generated_at),
    source_policy: 'Public review queue separates seeded/manual research from persisted community submissions. Submission is not endorsement; review is not financial advice; inclusion is not safety.',
    data_mode: persistedItems.some((item) => (item as { data_mode?: string }).data_mode === 'persisted') ? 'persisted' as const : persistedItems.length ? 'community_submission' as const : 'seeded' as const,
    persisted_submission_count: persistedItems.length,
    counts: getRhChainReviewStateCounts(items),
    items,
    grouped: groupRhChainReviewItemsByState(items)
  };
}

export function assembleRhChainReceipts() {
  return listRhChainReceipts();
}

export function assembleRhChain4663Index() {
  return getRhChain4663Index();
}

export function assembleRhChainDailyReceipts() {
  return getRhChainDailyReceipts();
}

export function assembleRhChainIntelligence() {
  const desk = getRhChainPayload();
  return {
    ...desk,
    provider_status: providerStatus,
    chain_pulse: assembleRhChainChainPulse(),
    meme_pulse: assembleRhChainMemePulse(),
    review_queue: assembleRhChainReviewQueue(),
    receipts: assembleRhChainReceipts(),
    signal_index_4663_detail: assembleRhChain4663Index(),
    daily_receipts: assembleRhChainDailyReceipts()
  };
}

export function buildRhChainApiResponse<T>(data: T): RhChainApiResponse<T> {
  const sources = collectRhChainSources(data);
  return {
    data,
    meta: {
      source_policy: sourcePolicyFor(data),
      record_count: recordCountFor(data),
      provider_status: providerStatus,
      live_indexing_enabled: false
    },
    sources,
    generated_at: generatedAtFor(data),
    data_mode: dataModeFor(data, sources),
    disclaimer: disclaimerFor(data)
  };
}

export function collectRhChainSources(value: unknown): RhChainSource[] {
  const seen = new Set<string>();
  const sources: RhChainSource[] = [];

  function visit(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.source_name === 'string' && typeof record.observed_at === 'string') {
      const source = record as RhChainSource;
      const key = `${source.source_name}|${source.source_url ?? ''}|${source.observed_at}|${source.updated_at}|${source.data_mode}|${source.confidence_level}`;
      if (!seen.has(key)) {
        seen.add(key);
        sources.push(source);
      }
    }
    Object.values(record).forEach(visit);
  }

  visit(value);
  return sources.sort((left, right) => left.source_name.localeCompare(right.source_name) || right.observed_at.localeCompare(left.observed_at));
}

function resolveRhChainDataMode(sources: RhChainSource[]): RhChainDataFreshness {
  if (!sources.length) return 'seeded';
  if (sources.some((source) => source.data_mode === 'live_future')) return 'live_future';
  if (sources.some((source) => source.data_mode === 'cached')) return 'cached';
  if (sources.some((source) => source.data_mode === 'persisted')) return 'persisted';
  if (sources.some((source) => source.data_mode === 'community_submission')) return 'community_submission';
  if (sources.some((source) => source.data_mode === 'manual')) return 'manual';
  return 'seeded';
}

function dataModeFor(data: unknown, sources: RhChainSource[]): RhChainDataFreshness {
  if (data && typeof data === 'object' && 'data_mode' in data) {
    const value = (data as { data_mode?: unknown }).data_mode;
    if (value === 'seeded' || value === 'manual' || value === 'community_submission' || value === 'persisted' || value === 'live_cached' || value === 'unavailable' || value === 'cached' || value === 'live_future') return value;
  }
  return resolveRhChainDataMode(sources);
}

function generatedAtFor(value: unknown) {
  if (value && typeof value === 'object' && typeof (value as { generated_at?: unknown }).generated_at === 'string') {
    return (value as { generated_at: string }).generated_at;
  }
  return getRhChainPayload().generated_at;
}

function sourcePolicyFor(value: unknown) {
  if (value && typeof value === 'object' && typeof (value as { source_policy?: unknown }).source_policy === 'string') {
    return (value as { source_policy: string }).source_policy;
  }
  return getRhChainPayload().source_policy;
}

function disclaimerFor(value: unknown) {
  if (value && typeof value === 'object' && typeof (value as { disclaimer?: unknown }).disclaimer === 'string') {
    return (value as { disclaimer: string }).disclaimer;
  }
  return RH_CHAIN_DISCLAIMER;
}

function recordCountFor(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items.length;
  if (Array.isArray(record.assets)) return record.assets.length;
  if (Array.isArray(record.receipts)) return record.receipts.length;
  if (Array.isArray(record.memes)) return record.memes.length;
  if (Array.isArray(record.risk_wall)) return record.risk_wall.length;
  return null;
}
