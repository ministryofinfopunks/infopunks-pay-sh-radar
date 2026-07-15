import pg from 'pg';
import type { RhChainDataFreshness, RhChainSource } from '../data/rhChain';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import type { RhChainProviderSnapshot, RhChainLiveSnapshot } from './rhChainLiveSnapshotService';
import type { RhChainFreshnessState } from './rhChainTruthGuards';

export type RhChainMetricsSnapshot = {
  snapshot_id: string;
  tvl: number | null;
  dex_volume_24h: number | null;
  stablecoin_market_cap: number | null;
  fees_24h: number | null;
  top_protocols: Array<{ name: string; category: string; tvl: number | null }>;
  observed_at: string;
  fetched_at: string;
  provider_status: RhChainProviderSnapshot[];
  freshness_state: RhChainFreshnessState;
  confidence_level: 'low' | 'medium' | 'high';
  data_mode: RhChainDataFreshness;
  source_notes: string[];
};

export interface RhChainMetricsSnapshotStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  save(snapshot: RhChainMetricsSnapshot): Promise<void>;
  latest(): Promise<RhChainMetricsSnapshot | null>;
  close?(): Promise<void>;
}

export class InMemoryRhChainMetricsSnapshotStore implements RhChainMetricsSnapshotStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private latestSnapshot: RhChainMetricsSnapshot | null = null;
  async save(snapshot: RhChainMetricsSnapshot) { this.latestSnapshot = structuredClone(snapshot); }
  async latest() { return this.latestSnapshot ? structuredClone(this.latestSnapshot) : null; }
}

export class PostgresRhChainMetricsSnapshotStore implements RhChainMetricsSnapshotStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private readonly schema = new RetryablePostgresSchema('rh_chain_metrics_snapshot_store');
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  async save(snapshot: RhChainMetricsSnapshot) {
    await this.ensureSchema();
    await this.pool.query('insert into rh_chain_metrics_snapshots (snapshot_id, observed_at, fetched_at, payload) values ($1,$2,$3,$4::jsonb)', [snapshot.snapshot_id, snapshot.observed_at, snapshot.fetched_at, JSON.stringify(snapshot)]);
    await this.pool.query("delete from rh_chain_metrics_snapshots where snapshot_id in (select snapshot_id from (select snapshot_id, row_number() over (order by fetched_at desc) as row_number, fetched_at from rh_chain_metrics_snapshots) retained where retained.fetched_at < now() - interval '7 days' or retained.row_number > 300)");
  }
  async latest() {
    await this.ensureSchema();
    const result = await this.pool.query<{ payload: RhChainMetricsSnapshot }>('select payload from rh_chain_metrics_snapshots order by fetched_at desc limit 1');
    return result.rows[0]?.payload ?? null;
  }
  async close() { if (this.ownsPool) await this.pool.end(); }
  private ensureSchema() {
    return this.schema.ensure(this.pool, 'create table if not exists rh_chain_metrics_snapshots (snapshot_id text primary key, observed_at timestamptz not null, fetched_at timestamptz not null, payload jsonb not null); create index if not exists rh_chain_metrics_snapshots_fetched_at_idx on rh_chain_metrics_snapshots (fetched_at desc);');
  }
}

export class RhChainChainPulseService {
  private readonly now: () => Date;
  constructor(private readonly store: RhChainMetricsSnapshotStore, now?: () => Date) { this.now = now ?? (() => new Date()); }
  async getLatest() { return this.store.latest(); }

  /** Saves numeric context only when DefiLlama returns it; otherwise preserves prior context as visibly stale. */
  async refresh(live: RhChainLiveSnapshot) {
    const fetched_at = this.now().toISOString();
    const defi = live.provider_statuses.find((provider) => provider.provider_name === 'DefiLlama');
    const metrics = live.chain_metrics;
    const hasProviderMetrics = defi?.status === 'fresh' && [metrics.tvl_usd, metrics.dex_volume_24h_usd, metrics.stablecoin_market_cap_usd, metrics.fees_24h_usd].some((value) => typeof value === 'number');
    if (hasProviderMetrics) {
      const snapshot: RhChainMetricsSnapshot = {
        snapshot_id: `rh-chain-metrics-${fetched_at.replace(/[^0-9]/g, '')}-${Math.random().toString(36).slice(2, 8)}`,
        tvl: metrics.tvl_usd,
        dex_volume_24h: metrics.dex_volume_24h_usd,
        stablecoin_market_cap: metrics.stablecoin_market_cap_usd,
        fees_24h: metrics.fees_24h_usd ?? null,
        top_protocols: (metrics.top_protocols ?? []).map((protocol) => ({ name: protocol.name, category: protocol.category, tvl: protocol.tvl_usd })),
        observed_at: metrics.source_timestamp ?? fetched_at,
        fetched_at,
        provider_status: live.provider_statuses,
        freshness_state: 'fresh',
        confidence_level: metrics.source_timestamp ? 'medium' : 'low',
        data_mode: 'cached',
        source_notes: [metrics.source_timestamp ? 'DefiLlama provider context was source-stamped at the provider timestamp.' : 'DefiLlama returned context without a provider timestamp; fetched timestamp is shown instead.', 'Provider context is informational and cannot change review, receipt, or index decisions.']
      };
      await this.store.save(snapshot);
      return snapshot;
    }
    const previous = await this.store.latest();
    if (previous) {
      const stale: RhChainMetricsSnapshot = { ...previous, snapshot_id: `rh-chain-metrics-stale-${fetched_at.replace(/[^0-9]/g, '')}`, fetched_at, provider_status: live.provider_statuses, freshness_state: 'stale', confidence_level: 'low', data_mode: previous.data_mode === 'manual' ? 'manual' : 'cached', source_notes: [...previous.source_notes, 'Latest provider refresh was unavailable; values are preserved as stale context and require source review.'] };
      await this.store.save(stale);
      return stale;
    }
    const fallback = manualFallback(fetched_at, live.provider_statuses);
    await this.store.save(fallback);
    return fallback;
  }
}

function manualFallback(fetched_at: string, provider_status: RhChainProviderSnapshot[]): RhChainMetricsSnapshot {
  return { snapshot_id: `rh-chain-metrics-fallback-${fetched_at.replace(/[^0-9]/g, '')}`, tvl: null, dex_volume_24h: null, stablecoin_market_cap: null, fees_24h: null, top_protocols: [], observed_at: fetched_at, fetched_at, provider_status, freshness_state: 'source_required', confidence_level: 'low', data_mode: 'manual', source_notes: ['No usable provider metrics are available. Manual desk context remains the fallback; no exact metric is inferred.'] };
}

export function rhChainMetricsSnapshotSource(snapshot: RhChainMetricsSnapshot): RhChainSource {
  return { source_name: 'DefiLlama chain metrics snapshot', source_url: 'https://defillama.com', observed_at: snapshot.observed_at, updated_at: snapshot.fetched_at, data_mode: snapshot.data_mode, confidence_level: snapshot.confidence_level, note: snapshot.source_notes.join(' ') };
}
