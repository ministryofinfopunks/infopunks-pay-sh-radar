import {
  createRhChainSource,
  getRhChain4663Index,
  getRhChainDailyReceipts,
  getRhChainLaunchSurfaces,
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
import type { RhChainMetricsSnapshot } from './rhChainChainPulseService';
import { rhChainMetricsSnapshotSource } from './rhChainChainPulseService';
import {
  createBlockscoutProvider,
  createCoinGeckoProvider,
  createDefiLlamaProvider,
  createDexScreenerProvider,
  createDuneProvider,
  createSocialSignalProvider,
  type RhChainProviderIdentity
} from './rhChainProviderAdapters';
export { assembleRhChainMemePulseScreen } from './rhChainMemePulseService';

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

export type RhChainApiErrorResponse = RhChainApiResponse<null> & {
  error: string;
  message?: string;
  issues?: unknown[];
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

export function assembleRhChainChainPulse(snapshot?: RhChainMetricsSnapshot | null) {
  const fallback = getRhChainPayload().chain_pulse;
  if (!snapshot) return fallback;
  const source = rhChainMetricsSnapshotSource(snapshot);
  const metric = (id: string, label: string, value: number | null, note: string) => ({
    id,
    label,
    value: typeof value === 'number' ? formatUsd(value) : 'source required',
    state: snapshot.freshness_state === 'fresh' && typeof value === 'number' ? 'watching' as const : 'source_pending' as const,
    note: typeof value === 'number' ? note : 'No provider value is displayed without a source-stamped snapshot.',
    source
  });
  const top_protocols = snapshot.top_protocols.length
    ? snapshot.top_protocols.map((protocol) => ({ name: protocol.name, category: protocol.category, status: snapshot.freshness_state === 'fresh' ? 'context observed' : 'stale context', note: typeof protocol.tvl === 'number' ? `Provider-reported TVL context: ${formatUsd(protocol.tvl)}. Context only; not an endorsement.` : 'Provider-listed protocol context; exact TVL was not supplied.', source }))
    : fallback.top_protocols.map((protocol) => ({ ...protocol, source: snapshot.freshness_state === 'source_required' ? createRhChainSource({ source_name: 'RH Chain manual fallback', source_url: null, observed_at: snapshot.observed_at, updated_at: snapshot.fetched_at, data_mode: 'manual', confidence_level: 'low', note: snapshot.source_notes.join(' ') }) : source }));
  return {
    metrics: [
      metric('tvl', 'TVL', snapshot.tvl, 'DefiLlama TVL context.'),
      metric('dex_volume', 'DEX volume (24h)', snapshot.dex_volume_24h, 'DefiLlama DEX-volume context.'),
      metric('stablecoin_liquidity', 'Stablecoin market cap', snapshot.stablecoin_market_cap, 'DefiLlama stablecoin context, when available.'),
      metric('fees_24h', 'Fees (24h)', snapshot.fees_24h, 'DefiLlama fee context, when available.'),
      ...fallback.metrics.filter((item) => ['stock_token_activity', 'attention_velocity'].includes(item.id))
    ],
    top_protocols,
    bridge_notes: fallback.bridge_notes,
    observed_at: snapshot.observed_at,
    fetched_at: snapshot.fetched_at,
    freshness_state: snapshot.freshness_state,
    confidence_level: snapshot.confidence_level,
    data_mode: snapshot.data_mode,
    source_notes: snapshot.source_notes
  };
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

export function assembleRhChainLaunchSurfaces() { return getRhChainLaunchSurfaces(); }

export function assembleRhChainIntelligence(snapshot?: RhChainMetricsSnapshot | null) {
  const desk = getRhChainPayload();
  return {
    ...desk,
    ...(snapshot ? { generated_at: snapshot.fetched_at, last_updated: snapshot.fetched_at } : {}),
    provider_status: providerStatus,
    chain_pulse: assembleRhChainChainPulse(snapshot),
    meme_pulse: assembleRhChainMemePulse(),
    review_queue: assembleRhChainReviewQueue(),
    receipts: assembleRhChainReceipts(),
    signal_index_4663_detail: assembleRhChain4663Index(),
    daily_receipts: assembleRhChainDailyReceipts()
  };
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
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

/** Keeps RH Chain failures machine-readable without dropping provenance policy. */
export function buildRhChainApiErrorResponse(error: string, details: { message?: string; issues?: unknown[] } = {}): RhChainApiErrorResponse {
  return {
    ...buildRhChainApiResponse(null),
    error,
    ...details
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
