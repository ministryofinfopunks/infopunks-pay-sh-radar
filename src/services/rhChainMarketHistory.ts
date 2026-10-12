import type { RhChainMarketSnapshot } from './rhChainMarketSnapshotService';

export const RH_CHAIN_MARKET_HISTORY_VERSION = 'rh-market-history-v1' as const;
export const RH_CHAIN_MARKET_RAW_RETENTION_MS = 48 * 60 * 60_000;
export const RH_CHAIN_MARKET_HOURLY_RETENTION_MS = 90 * 24 * 60 * 60_000;
export const RH_CHAIN_MARKET_METRICS = [
  'price_usd', 'liquidity_usd', 'market_cap', 'fdv', 'volume_h24', 'volume_h6', 'volume_h1',
  'txns_h24_buys', 'txns_h24_sells', 'txns_h6_buys', 'txns_h6_sells',
  'price_change_h24', 'price_change_h6', 'price_change_h1'
] as const;
export type RhChainMarketMetric = typeof RH_CHAIN_MARKET_METRICS[number];
export type RhChainMarketResolution = 'hour' | 'day';
type MetricEvidence = { snapshot_id: string; captured_at: string; provider_timestamp: string | null; source_url: string | null; value: number };
export type RhChainMarketAggregate = {
  version: typeof RH_CHAIN_MARKET_HISTORY_VERSION;
  resolution: RhChainMarketResolution;
  bucket_start: string;
  bucket_end: string;
  token_address: string;
  pair_address: string | null;
  provider: 'dexscreener';
  chain_id: 'robinhood';
  sample_count: number;
  snapshot_ids: string[];
  first_snapshot: RhChainMarketSnapshot;
  last_snapshot: RhChainMarketSnapshot;
  metrics: Record<RhChainMarketMetric, { covered_samples: number; min: MetricEvidence | null; max: MetricEvidence | null }>;
};

export function marketBucket(timestamp: string, resolution: RhChainMarketResolution) {
  const duration = resolution === 'hour' ? 60 * 60_000 : 24 * 60 * 60_000;
  const start = Math.floor(Date.parse(timestamp) / duration) * duration;
  return { bucket_start: new Date(start).toISOString(), bucket_end: new Date(start + duration).toISOString() };
}
export function marketAggregateKey(snapshot: RhChainMarketSnapshot, resolution: RhChainMarketResolution) {
  return JSON.stringify([snapshot.token_address.toLowerCase(), snapshot.pair_address?.toLowerCase() ?? '', snapshot.provider, resolution, marketBucket(snapshot.captured_at, resolution).bucket_start]);
}
function compare(left: Pick<RhChainMarketSnapshot, 'captured_at' | 'snapshot_id'>, right: Pick<RhChainMarketSnapshot, 'captured_at' | 'snapshot_id'>) {
  return Date.parse(left.captured_at) - Date.parse(right.captured_at) || left.snapshot_id.localeCompare(right.snapshot_id);
}

/** A bucket contains observed samples, not summed rolling volume or inferred capital flow. */
export function mergeMarketAggregate(previous: RhChainMarketAggregate | null, snapshot: RhChainMarketSnapshot, resolution: RhChainMarketResolution): RhChainMarketAggregate {
  if (previous?.snapshot_ids.includes(snapshot.snapshot_id)) return previous;
  const metrics = Object.fromEntries(RH_CHAIN_MARKET_METRICS.map((metric) => {
    const old = previous?.metrics[metric] ?? { covered_samples: 0, min: null, max: null };
    const value = snapshot[metric];
    if (typeof value !== 'number' || !Number.isFinite(value)) return [metric, old];
    const evidence: MetricEvidence = { snapshot_id: snapshot.snapshot_id, captured_at: snapshot.captured_at, provider_timestamp: snapshot.provider_timestamp ?? null, source_url: snapshot.source_url, value };
    const prefer = (candidate: MetricEvidence | null, direction: 'min' | 'max') => !candidate
      || (direction === 'min' ? value < candidate.value : value > candidate.value)
      || (value === candidate.value && compare(evidence, candidate) < 0);
    return [metric, { covered_samples: old.covered_samples + 1, min: prefer(old.min, 'min') ? evidence : old.min, max: prefer(old.max, 'max') ? evidence : old.max }];
  })) as RhChainMarketAggregate['metrics'];
  return {
    version: RH_CHAIN_MARKET_HISTORY_VERSION, resolution, ...marketBucket(snapshot.captured_at, resolution),
    token_address: snapshot.token_address.toLowerCase(), pair_address: snapshot.pair_address?.toLowerCase() ?? null,
    provider: snapshot.provider, chain_id: snapshot.chain_id, sample_count: (previous?.sample_count ?? 0) + 1,
    snapshot_ids: [...(previous?.snapshot_ids ?? []), snapshot.snapshot_id].sort(),
    first_snapshot: !previous || compare(snapshot, previous.first_snapshot) < 0 ? structuredClone(snapshot) : previous.first_snapshot,
    last_snapshot: !previous || compare(snapshot, previous.last_snapshot) > 0 ? structuredClone(snapshot) : previous.last_snapshot,
    metrics
  };
}
