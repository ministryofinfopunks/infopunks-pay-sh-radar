import pg from 'pg';
import type { RhChainDataFreshness, RhChainMetricScope, RhChainSource } from '../data/rhChain';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import type { RhChainProviderSnapshot, RhChainLiveSnapshot } from './rhChainLiveSnapshotService';
import type { RhChainFreshnessState } from './rhChainTruthGuards';

export type RhChainMetricsSnapshot = {
  snapshot_id: string;
  tvl: number | null;
  dex_volume_24h: number | null;
  stablecoin_market_cap: number | null;
  fees_24h: number | null;
  top_protocols: Array<{ name: string; category: string; tvl: number | null; value: number | 'source_required'; scope: 'rh_chain' | 'global_or_unknown'; metric_scope: RhChainMetricScope; display_note: string }>;
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
  async getLatest() { const snapshot = await this.store.latest(); return snapshot ? scopeSafeMetricsSnapshot(snapshot) : null; }

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
        top_protocols: (metrics.top_protocols ?? []).map((protocol) => scopeSafeProtocol(protocol)),
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
    const stored = await this.store.latest();
    const previous = stored ? scopeSafeMetricsSnapshot(stored) : null;
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
  return { snapshot_id: `rh-chain-metrics-fallback-${fetched_at.replace(/[^0-9]/g, '')}`, tvl: null, dex_volume_24h: null, stablecoin_market_cap: null, fees_24h: null, top_protocols: [], observed_at: fetched_at, fetched_at, provider_status, freshness_state: 'source_required', confidence_level: 'low', data_mode: 'manual', source_notes: ['No usable provider metrics are available. Manual desk context remains the fallback; no exact metric is inferred.', 'Provider context is informational and cannot change review, receipt, or index decisions.'] };
}

function scopeSafeProtocol(protocol: { name?: unknown; category?: unknown; tvl_usd?: unknown; tvl?: unknown; value?: unknown; scope?: unknown; metric_scope?: unknown; display_note?: unknown }): RhChainMetricsSnapshot['top_protocols'][number] {
  const explicitlyRhChain = protocol.scope === 'rh_chain' && protocol.metric_scope === 'rh_chain';
  const candidate = protocol.value === 'source_required' ? null : typeof protocol.value === 'number' ? protocol.value : typeof protocol.tvl_usd === 'number' ? protocol.tvl_usd : typeof protocol.tvl === 'number' ? protocol.tvl : null;
  const scopedValue = explicitlyRhChain && candidate !== null && Number.isFinite(candidate) ? candidate : null;
  if (scopedValue !== null) return { name: String(protocol.name ?? ''), category: String(protocol.category ?? 'protocol'), tvl: scopedValue, value: scopedValue, scope: 'rh_chain', metric_scope: 'rh_chain', display_note: typeof protocol.display_note === 'string' && protocol.display_note ? protocol.display_note : 'Provider explicitly scoped this protocol TVL to Robinhood Chain.' };
  return { name: String(protocol.name ?? ''), category: String(protocol.category ?? 'protocol'), tvl: null, value: 'source_required', scope: 'global_or_unknown', metric_scope: 'source_required', display_note: 'Chain-specific protocol TVL not verified.' };
}

export function scopeSafeMetricsSnapshot(snapshot: RhChainMetricsSnapshot): RhChainMetricsSnapshot {
  return { ...snapshot, top_protocols: (snapshot.top_protocols ?? []).map((protocol) => scopeSafeProtocol(protocol)) };
}

export function rhChainMetricsSnapshotSource(snapshot: RhChainMetricsSnapshot): RhChainSource {
  return { source_name: 'DefiLlama chain metrics snapshot', source_url: 'https://defillama.com', observed_at: snapshot.observed_at, updated_at: snapshot.fetched_at, data_mode: snapshot.data_mode, confidence_level: snapshot.confidence_level, note: snapshot.source_notes.join(' ') };
}
