import { createHash } from 'node:crypto';
import pg from 'pg';
import type { RhChainDataFreshness } from '../data/rhChain';
import type { RhChainDexScreenerIngestionSource, RhChainMarketSnapshot as DexScreenerMarketSnapshot } from '../providers/dexscreenerProvider';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import { RhChainAttentionService, type RhChainAttentionState } from './rhChainAttentionService';
import type { RhChainLayerClassification } from './rhChainMarketStructureService';
import { mergeMarketAggregate, marketAggregateKey, RH_CHAIN_MARKET_RAW_RETENTION_MS, RH_CHAIN_MARKET_HOURLY_RETENTION_MS, type RhChainMarketAggregate, type RhChainMarketResolution } from './rhChainMarketHistory';

/** Durable, low-frequency memory of current DEX Screener observations; not a trading feed. */
export type RhChainMarketSnapshot = {
  snapshot_id: string;
  captured_at: string;
  provider: 'dexscreener';
  chain_id: 'robinhood';
  token_address: string;
  ticker: string | null;
  pair_address: string | null;
  dex_id: string | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  market_cap: number | null;
  fdv: number | null;
  volume_h24: number | null;
  volume_h6: number | null;
  volume_h1: number | null;
  txns_h24_buys: number | null;
  txns_h24_sells: number | null;
  txns_h6_buys: number | null;
  txns_h6_sells: number | null;
  price_change_h24: number | null;
  pair_created_at: string | null;
  active_boosts: number | null;
  paid_order_types: string[];
  paid_order_statuses: string[];
  base_token?: DexScreenerMarketSnapshot['baseToken'];
  quote_token?: DexScreenerMarketSnapshot['quoteToken'];
  pair_labels?: string[];
  price_change_h1?: number | null;
  price_change_h6?: number | null;
  provider_timestamp?: string | null;
  freshness_state?: 'fresh' | 'stale';
  raw_data_version?: string;
  cache_status?: string;
  cache_provenance?: string;
  websites?: DexScreenerMarketSnapshot['websites'];
  socials?: DexScreenerMarketSnapshot['socials'];
  data_mode: RhChainDataFreshness;
  source_url: string | null;
  collection_gaps?: string[];
  paid_attention_available?: boolean;
};

export interface RhChainMarketSnapshotStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  save(snapshot: RhChainMarketSnapshot): Promise<boolean | void>;
  list(contract: string, operation?: { timeoutMs?: number }): Promise<RhChainMarketSnapshot[]>;
  listObservedContracts?(limit: number): Promise<string[]>;
  listMany?(contracts: string[], since?: string): Promise<Record<string, RhChainMarketSnapshot[]>>;
  latestMany?(contracts: string[]): Promise<Record<string, RhChainMarketSnapshot | null>>;
  listAggregates?(contract: string, resolution: RhChainMarketResolution, since?: string): Promise<RhChainMarketAggregate[]>;
  editionInput?(date: string): Promise<{ observations: RhChainMarketSnapshot[]; aggregates: RhChainMarketAggregate[] }>;
  completedDays?(): Promise<string[]>;
  pruneHistory?(now: Date): Promise<void>;
  close?(): Promise<void>;
}

export class InMemoryRhChainMarketSnapshotStore implements RhChainMarketSnapshotStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private readonly snapshots = new Map<string, RhChainMarketSnapshot[]>();
  private readonly aggregates = new Map<string, RhChainMarketAggregate>();
  private readonly seenIds = new Set<string>();
  async save(snapshot: RhChainMarketSnapshot) {
    const key = snapshot.token_address.toLowerCase();
    const retained = this.snapshots.get(key) ?? [];
    if (this.seenIds.has(snapshot.snapshot_id)) return false;
    const next = [...retained, structuredClone(snapshot)].sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at) || a.snapshot_id.localeCompare(b.snapshot_id));
    this.snapshots.set(key, next);
    this.seenIds.add(snapshot.snapshot_id);
    for (const resolution of ['hour', 'day'] as const) {
      const aggregateKey = marketAggregateKey(snapshot, resolution);
      this.aggregates.set(aggregateKey, mergeMarketAggregate(this.aggregates.get(aggregateKey) ?? null, snapshot, resolution));
    }
    return true;
  }
  async list(contract: string) { return structuredClone(this.snapshots.get(contract.toLowerCase()) ?? []); }
  async listObservedContracts(limit: number) { return [...this.snapshots].filter(([, rows]) => rows.length).map(([key]) => key).sort().slice(0, limit); }
  async listMany(contracts: string[], since?: string) { return Object.fromEntries(contracts.slice(0, 300).map((contract) => [contract.toLowerCase(), structuredClone((this.snapshots.get(contract.toLowerCase()) ?? []).filter((s, i, list) => !since || Date.parse(s.captured_at) >= Date.parse(since) || i === list.length - 1))])); }
  async latestMany(contracts: string[]) { return Object.fromEntries(contracts.slice(0, 300).map((contract) => [contract.toLowerCase(), structuredClone(this.snapshots.get(contract.toLowerCase())?.at(-1) ?? null)])); }
  async listAggregates(contract: string, resolution: RhChainMarketResolution, since?: string) {
    return structuredClone([...this.aggregates.values()].filter((item) => item.token_address === contract.toLowerCase() && item.resolution === resolution && (!since || item.bucket_end > since)).sort((a, b) => a.bucket_start.localeCompare(b.bucket_start) || (a.pair_address ?? '').localeCompare(b.pair_address ?? '')));
  }
  async editionInput(date: string) {
    const start = Date.parse(date + 'T00:00:00.000Z'), end = start + 86400000;
    return structuredClone({ observations: [...this.snapshots.values()].flat().filter(s => { const at = Date.parse(s.provider_timestamp ?? s.captured_at); return at >= start && at < end; }),
      aggregates: [...this.aggregates.values()].filter(a => a.resolution === 'day' && a.bucket_start.slice(0, 10) === date) });
  }
  async completedDays() { return [...new Set([...this.aggregates.values()].map(a => a.bucket_start.slice(0, 10)))].sort(); }
  async pruneHistory(now: Date) {
    const rawCutoff = now.getTime() - RH_CHAIN_MARKET_RAW_RETENTION_MS;
    for (const [contract, snapshots] of this.snapshots) this.snapshots.set(contract, snapshots.filter((snapshot) => Date.parse(snapshot.captured_at) >= rawCutoff));
    for (const [key, aggregate] of this.aggregates) if (aggregate.resolution === 'hour' && Date.parse(aggregate.bucket_end) <= now.getTime() - RH_CHAIN_MARKET_HOURLY_RETENTION_MS) this.aggregates.delete(key);
  }
}

export class PostgresRhChainMarketSnapshotStore implements RhChainMarketSnapshotStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private readonly schema = new RetryablePostgresSchema('rh_chain_market_snapshot_store');
  private readonly historySchema = new RetryablePostgresSchema('rh_chain_market_history');
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  async save(snapshot: RhChainMarketSnapshot) {
    await this.ready();
    await this.requireHistorySchema();
    const result = await this.pool.query(`insert into rh_chain_market_snapshots (snapshot_id, token_address, pair_address, provider, captured_at, provider_timestamp, raw_data_version, payload)
      select $1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7,$8::jsonb
      where not exists (select 1 from rh_chain_market_aggregates where token_address=$2 and pair_address=coalesce($3,'')
        and provider=$4 and resolution='day' and bucket_start=date_trunc('day',$5::timestamptz at time zone 'UTC') at time zone 'UTC'
        and payload->'snapshot_ids' ? $1)
      on conflict (snapshot_id) do nothing returning snapshot_id`, [snapshot.snapshot_id, snapshot.token_address.toLowerCase(), snapshot.pair_address?.toLowerCase() ?? null, snapshot.provider, snapshot.captured_at, snapshot.provider_timestamp ?? null, snapshot.raw_data_version ?? 'legacy-v1', JSON.stringify(snapshot)]);
    return result.rowCount === 1;
  }
  async list(contract: string, operation?: { timeoutMs?: number }) { await this.ready(); const result = await this.pool.query({ text: 'select payload from (select snapshot_id,captured_at,payload from rh_chain_market_snapshots where token_address=$1 order by captured_at desc,snapshot_id desc limit 4096) retained order by captured_at,snapshot_id', values: [contract.toLowerCase()], query_timeout: operation?.timeoutMs } as pg.QueryConfig & { query_timeout?: number }) as pg.QueryResult<{ payload: RhChainMarketSnapshot }>; return result.rows.map((row) => row.payload); }
  async listObservedContracts(limit: number) { await this.ready(); const rows = await this.pool.query<{ token_address: string }>('select distinct token_address from rh_chain_market_snapshots order by token_address limit $1', [Math.max(1, Math.min(301, Math.floor(limit)))]); return rows.rows.map((row) => row.token_address); }
  async listMany(contracts: string[], since?: string) {
    const normalized = [...new Set(contracts.map(normalize).filter(Boolean))].slice(0, 300);
    if (!normalized.length) return {};
    await this.ready();
    const result = await this.pool.query<{ token_address: string; payload: RhChainMarketSnapshot }>(`select token_address, payload from (
      select token_address, captured_at, payload, row_number() over (partition by token_address order by captured_at desc,snapshot_id desc) as retained_row
      from rh_chain_market_snapshots where token_address = any($1::text[])
    ) snapshots where retained_row <= 4096 and ($2::timestamptz is null or captured_at >= $2::timestamptz or retained_row=1) order by token_address, (payload->>'captured_at')::timestamptz asc, payload->>'snapshot_id'`, [normalized, since ?? null]);
    const grouped = Object.fromEntries(normalized.map((contract) => [contract, [] as RhChainMarketSnapshot[]]));
    for (const row of result.rows) grouped[row.token_address.toLowerCase()]?.push(row.payload);
    return grouped;
  }
  async latestMany(contracts: string[]) {
    const normalized = [...new Set(contracts.map(normalize).filter(Boolean))].slice(0, 300);
    if (!normalized.length) return {};
    await this.ready();
    const result = await this.pool.query<{ token_address: string; payload: RhChainMarketSnapshot }>('select distinct on (token_address) token_address, payload from rh_chain_market_snapshots where token_address = any($1::text[]) order by token_address, captured_at desc, snapshot_id desc', [normalized]);
    const latest = Object.fromEntries(normalized.map((contract) => [contract, null as RhChainMarketSnapshot | null]));
    for (const row of result.rows) latest[row.token_address.toLowerCase()] = row.payload;
    return latest;
  }
  async close() { if (this.ownsPool) await this.pool.end(); }
  async listAggregates(contract: string, resolution: RhChainMarketResolution, since?: string) {
    await this.requireHistorySchema();
    const result = await this.pool.query<{ payload: RhChainMarketAggregate }>(`select payload from rh_chain_market_aggregates where token_address=$1 and resolution=$2
      and ($3::timestamptz is null or bucket_start + case when resolution='hour' then interval '1 hour' else interval '1 day' end > $3)
      order by bucket_start,pair_address limit 10000`, [contract.toLowerCase(), resolution, since ?? null]);
    return result.rows.map((row) => row.payload);
  }
  async editionInput(date: string) {
    await this.requireHistorySchema();
    // One statement gives observations and historical coverage the same MVCC snapshot.
    const result = await this.pool.query<{ observations: RhChainMarketSnapshot[]; aggregates: RhChainMarketAggregate[] }>(`
      select coalesce((select jsonb_agg(payload order by snapshot_id) from rh_chain_market_snapshots
        where coalesce(provider_timestamp,captured_at) >= $1::date::timestamp at time zone 'UTC'
          and coalesce(provider_timestamp,captured_at) < ($1::date+1)::timestamp at time zone 'UTC'), '[]'::jsonb) as observations,
        coalesce((select jsonb_agg(payload order by token_address,pair_address) from rh_chain_market_aggregates
        where resolution='day' and bucket_start=$1::date::timestamp at time zone 'UTC'), '[]'::jsonb) as aggregates`, [date]);
    return result.rows[0];
  }
  async completedDays() {
    await this.requireHistorySchema();
    const result = await this.pool.query<{ date: string }>("select distinct to_char(bucket_start at time zone 'UTC','YYYY-MM-DD') as date from rh_chain_market_aggregates where resolution='day' order by date");
    return result.rows.map(r => r.date);
  }
  async pruneHistory(now: Date) {
    await this.requireHistorySchema();
    await this.pool.query(`delete from rh_chain_market_snapshots s where captured_at < $1::timestamptz
      and exists (select 1 from rh_chain_market_aggregates a where a.token_address=s.token_address
        and a.pair_address=coalesce(s.pair_address,'') and a.provider=s.provider and a.resolution='day'
        and a.bucket_start=date_trunc('day',s.captured_at at time zone 'UTC') at time zone 'UTC')`, [new Date(now.getTime() - RH_CHAIN_MARKET_RAW_RETENTION_MS).toISOString()]);
    await this.pool.query("delete from rh_chain_market_aggregates where resolution='hour' and bucket_start + interval '1 hour' <= $1::timestamptz", [new Date(now.getTime() - RH_CHAIN_MARKET_HOURLY_RETENTION_MS).toISOString()]);
  }
  private requireHistorySchema() {
    // External migration only. Missing/disabled atomic rollups must block collection, not silently lose history.
    return this.historySchema.ensure(this.pool, `do $$ begin
      if to_regclass('rh_chain_market_aggregates') is null or not exists
        (select 1 from pg_trigger where tgrelid='rh_chain_market_snapshots'::regclass
          and tgname='rh_chain_market_snapshot_rollup' and tgenabled in ('O','A'))
      then raise exception 'rh_market_history_migration_required'; end if; end $$;`);
  }
  private ready() { return this.schema.ensure(this.pool, `
    create table if not exists rh_chain_market_snapshots (snapshot_id text primary key, token_address text not null, pair_address text, provider text not null default 'dexscreener', captured_at timestamptz not null, provider_timestamp timestamptz, raw_data_version text not null default 'legacy-v1', payload jsonb not null);
    alter table rh_chain_market_snapshots add column if not exists pair_address text;
    alter table rh_chain_market_snapshots add column if not exists provider text not null default 'dexscreener';
    alter table rh_chain_market_snapshots add column if not exists provider_timestamp timestamptz;
    alter table rh_chain_market_snapshots add column if not exists raw_data_version text not null default 'legacy-v1';
    create index if not exists rh_chain_market_snapshots_token_captured_idx on rh_chain_market_snapshots (token_address, captured_at desc);
    create index if not exists rh_chain_market_snapshots_pair_captured_idx on rh_chain_market_snapshots (pair_address, captured_at desc) where pair_address is not null;
    create index if not exists rh_chain_market_snapshots_provider_captured_idx on rh_chain_market_snapshots (provider, captured_at desc);
    create index if not exists rh_chain_market_snapshots_captured_at_idx on rh_chain_market_snapshots (captured_at desc);
  `); }
}

export type RhChainAttentionQualityHistory = {
  contract: string;
  latest_snapshot_at: string | null;
  snapshot_count: number;
  paid_attention_context: { active_boosts: number; paid_order_types: string[]; paid_order_statuses: string[] } | null;
  state: RhChainAttentionState;
  score: number | null;
  components: { organic_trader_retention: number | null; liquidity_retention: number | null; post_boost_volume_retention: number | null; narrative_persistence: number | null; evidence_quality: number | null; contract_deployer_clarity: number | null; };
  caveats: string[];
};

export type RhChainMarketCaptureResult = {
  captured: RhChainMarketSnapshot[];
  status: 'disabled' | 'captured' | 'partial' | 'unavailable';
  storage: { enabled: boolean; adapter: 'memory' | 'postgres'; durable: boolean; written: number };
  requested_contracts: number;
  failures: Array<{ contract: string | null; reason: string }>;
  caveats: string[];
};

export type RhChainMarketSnapshotServiceOptions = {
  store: RhChainMarketSnapshotStore;
  provider: RhChainDexScreenerIngestionSource;
  enabled: boolean;
  storageEnabled?: boolean;
  watchlist: () => Promise<string[]> | string[];
  classificationFor?: (contract: string) => RhChainLayerClassification | null;
  narrativePersistenceFor?: (contract: string) => number | null;
  now?: () => Date;
  maxObservationAgeMs?: number;
  maxContracts?: number;
};

export class RhChainMarketSnapshotService {
  private readonly now: () => Date;
  private readonly attention: RhChainAttentionService;
  constructor(private readonly options: RhChainMarketSnapshotServiceOptions) { this.now = options.now ?? (() => new Date()); this.attention = new RhChainAttentionService(this.now); }

  private captureInFlight: Promise<RhChainMarketCaptureResult> | null = null;
  get storageDurable() { return this.options.store.durable && this.options.storageEnabled !== false; }

  captureKnownWatchlistSnapshot(options: { includePaidAttention?: boolean } = {}): Promise<RhChainMarketCaptureResult> {
    if (this.captureInFlight) return this.captureInFlight;
    this.captureInFlight = this.collectKnownWatchlist(options).finally(() => { this.captureInFlight = null; });
    return this.captureInFlight;
  }
  private async collectKnownWatchlist(options: { includePaidAttention?: boolean }): Promise<RhChainMarketCaptureResult> {
    const failures: RhChainMarketCaptureResult['failures'] = [];
    const captured: RhChainMarketSnapshot[] = [];
    let written = 0;
    const result = (status: RhChainMarketCaptureResult['status'], requested = 0): RhChainMarketCaptureResult => ({
      captured, status, storage: this.storageStatus(written), requested_contracts: requested, failures,
      caveats: ['Stored market samples are provider observations, not reviewed judgments. Observation age is never reset by a cache read.']
    });
    if (!this.options.enabled) return result('disabled');
    let contracts: string[];
    try { contracts = [...new Set((await this.options.watchlist()).map(normalize))].sort(); }
    catch { failures.push({ contract: null, reason: 'watchlist_unavailable' }); return result('unavailable'); }
    const requested = contracts.length;
    const valid = contracts.filter((contract) => {
      if (isContract(contract)) return true;
      failures.push({ contract, reason: 'invalid_contract' }); return false;
    });
    contracts = valid.slice(0, this.options.maxContracts ?? 300);
    for (const contract of valid.slice(contracts.length)) failures.push({ contract, reason: 'collection_capacity_exceeded' });
    const includeAttention = options.includePaidAttention !== false;
    const boosts = includeAttention ? await this.safeBoosts() : null;
    const batchResults = await mapWithConcurrency(chunk(contracts, 30), 4, async (batch) => {
      try { return await this.options.provider.getTokenBatch(batch); }
      catch { for (const contract of batch) failures.push({ contract, reason: 'provider_batch_unavailable' }); return {}; }
    });
    const pairsByContract = Object.assign({}, ...batchResults) as Record<string, DexScreenerMarketSnapshot[]>;
    await mapWithConcurrency(contracts, 4, async (contract) => {
      const candidates = pairsByContract[contract] ?? [];
      const eligible = candidates.filter((pair) => !this.rejectionReason(contract, pair));
      const selection = canonicalSelection(eligible);
      const pair = selection.pair;
      if (selection.disagreement) failures.push({ contract, reason: 'provider_pair_disagreement' });
      if (!pair) {
        if (!failures.some((failure) => failure.contract === contract)) failures.push({ contract, reason: candidates.length ? this.rejectionReason(contract, candidates[0]) ?? 'source_required' : 'source_required' });
        return;
      }
      const orders = includeAttention ? await this.safeOrders(contract) : null;
      const activeBoosts = boosts?.filter((boost) => boost.chainId === 'robinhood' && normalize(boost.tokenAddress) === contract).reduce((total, boost) => total + Math.max(0, boost.amount ?? 0), 0) ?? 0;
      const snapshot = this.normalize(contract, pair, activeBoosts, orders ?? []);
      snapshot.paid_attention_available = boosts !== null && orders !== null;
      if (!snapshot.paid_attention_available) { snapshot.active_boosts = null; snapshot.collection_gaps!.push('paid_attention_not_observed'); }
      try {
        if (this.options.storageEnabled !== false) {
          const inserted = await this.options.store.save(snapshot);
          written += Number(inserted !== false);
        }
        captured.push(snapshot);
      } catch { failures.push({ contract, reason: 'observation_storage_unavailable' }); }
    });
    try { if (this.options.storageEnabled !== false) await this.options.store.pruneHistory?.(this.now()); }
    catch { failures.push({ contract: null, reason: 'retention_failed' }); }
    captured.sort((left, right) => left.token_address.localeCompare(right.token_address));
    failures.sort((left, right) => (left.contract ?? '').localeCompare(right.contract ?? '') || left.reason.localeCompare(right.reason));
    return result(failures.length ? (captured.length ? 'partial' : 'unavailable') : 'captured', requested);
  }

  async captureTokenSnapshot(contract: string) {
    const token = normalize(contract);
    if (!isContract(token) || !this.options.enabled) return { snapshot: null, status: 'disabled' as const, caveats: ['Snapshot capture is disabled or a valid exact contract was not supplied.'] };
    try {
      const pairs = await this.options.provider.getTokenPairs(token);
      const pair = canonical(pairs.filter((candidate) => !this.rejectionReason(token, candidate)));
      if (!pair) return { snapshot: null, status: 'source_required' as const, caveats: ['No fresh mainnet market observation is available for this exact base contract.'] };
      const [boosts, orders] = await Promise.all([this.safeBoosts(), this.safeOrders(token)]);
      const activeBoosts = boosts?.filter((boost) => boost.chainId === 'robinhood' && normalize(boost.tokenAddress) === token).reduce((total, boost) => total + Math.max(0, boost.amount ?? 0), 0) ?? 0;
      const snapshot = this.normalize(token, pair, activeBoosts, orders ?? []);
      snapshot.paid_attention_available = boosts !== null && orders !== null;
      if (!snapshot.paid_attention_available) { snapshot.active_boosts = null; snapshot.collection_gaps!.push('paid_attention_not_observed'); }
      const written = this.options.storageEnabled !== false ? Number((await this.options.store.save(snapshot)) !== false) : 0;
      return { snapshot, status: 'captured' as const, storage: this.storageStatus(written), caveats: ['Observation capture cannot change reviewed classification or receipt status.'] };
    } catch { return { snapshot: null, status: 'unavailable' as const, caveats: ['Observation capture failed; no current value is inferred.'] }; }
  }

  private rejectionReason(contract: string, pair: DexScreenerMarketSnapshot): string | null {
    if (pair.chainId !== 'robinhood' || pair.provider !== 'dexscreener') return 'chain_or_provider_mismatch';
    if (normalize(pair.tokenAddress) !== contract || (pair.baseToken && normalize(pair.baseToken.address) !== contract)) return 'contract_or_quote_direction_mismatch';
    if (!pair.pairAddress?.trim()) return 'pair_identity_missing';
    if (pair.dataMode !== 'live_cached' || pair.freshness === 'stale' || pair.cache?.status.includes('stale')) return 'stale_observation';
    const fetched = Date.parse(pair.capturedAt);
    const observed = pair.providerTimestamp ? Date.parse(pair.providerTimestamp) : fetched;
    const now = this.now().getTime();
    if (!Number.isFinite(fetched) || !Number.isFinite(observed) || fetched > now + 60_000 || observed > now + 60_000 || observed > fetched + 60_000) return 'invalid_observation_time';
    if (now - Math.min(fetched, observed) > (this.options.maxObservationAgeMs ?? 15 * 60_000)) return 'stale_observation';
    if (!pair.sourceUrl || !/^https?:\/\//i.test(pair.sourceUrl)) return 'source_url_missing';
    if (![pair.priceUsd, pair.liquidityUsd, pair.volume.h24, pair.txns.h24.buys, pair.txns.h24.sells].some((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) return 'no_measured_market_values';
    return null;
  }
  async listAggregates(contract: string, resolution: RhChainMarketResolution, since?: string) {
    return this.options.store.listAggregates?.(normalize(contract), resolution, since) ?? [];
  }
  readFreshness(snapshot: RhChainMarketSnapshot | null) {
    const timestamp = snapshot?.provider_timestamp ?? snapshot?.captured_at ?? null;
    const age = timestamp ? this.now().getTime() - Date.parse(timestamp) : null;
    const invalid = age === null || !Number.isFinite(age) || age < -60_000;
    return {
      state: invalid ? 'unavailable' as const : snapshot?.freshness_state === 'stale' || age > (this.options.maxObservationAgeMs ?? 15 * 60_000) ? 'stale' as const : 'fresh' as const,
      observed_at: timestamp, time_basis: snapshot?.provider_timestamp ? 'provider_observation' : 'provider_fetch', age_ms: invalid ? null : Math.max(0, age)
    };
  }

  async listSnapshots(contract: string, operation?: { timeoutMs?: number }) { return this.options.store.list(normalize(contract), operation); }
  async listSnapshotsForContracts(contracts: string[]) {
    const normalized = [...new Set(contracts.map(normalize).filter(Boolean))].slice(0, 300);
    if (this.options.store.listMany) return this.options.store.listMany(normalized);
    const entries = await mapWithConcurrency(normalized, 6, async (contract) => [contract, await this.options.store.list(contract)] as const);
    return Object.fromEntries(entries);
  }
  async getLatestSnapshotsForContracts(contracts: string[]) {
    const normalized = [...new Set(contracts.map(normalize).filter(Boolean))].slice(0, 300);
    if (this.options.store.latestMany) return this.options.store.latestMany(normalized);
    const histories = await this.listSnapshotsForContracts(normalized);
    return Object.fromEntries(normalized.map((contract) => [contract, histories[contract]?.at(-1) ?? null]));
  }
  async getLatestSnapshot(contract: string) { return (await this.listSnapshots(contract)).at(-1) ?? null; }
  async getSnapshotWindow(contract: string, window: string | number) {
    const duration = typeof window === 'number' ? window : parseWindow(window);
    const cutoff = this.now().getTime() - duration;
    return (await this.listSnapshots(contract)).filter((snapshot) => Date.parse(snapshot.captured_at) >= cutoff);
  }
  async summarizeAttentionHistory(contract: string): Promise<RhChainAttentionQualityHistory> {
    const snapshots = await this.listSnapshots(contract);
    const latest = snapshots.at(-1) ?? null;
    if (!snapshots.length) return { contract: normalize(contract), latest_snapshot_at: null, snapshot_count: 0, paid_attention_context: null, state: 'source_required', score: null, components: emptyComponents(), caveats: ['No stored snapshot exists for this exact contract.'] };
    if (snapshots.some((snapshot) => snapshot.paid_attention_available === false || snapshot.active_boosts === null)) return { contract: normalize(contract), latest_snapshot_at: latest?.captured_at ?? null, snapshot_count: snapshots.length, paid_attention_context: null, state: 'source_required', score: null, components: emptyComponents(), caveats: ['Paid attention was not observed for every sample; no organic/paid classification is inferred.'] };
    const assessment = this.attention.assessSnapshotHistory(snapshots.map((snapshot) => ({ captured_at: snapshot.captured_at, liquidity_usd: snapshot.liquidity_usd, volume_h24: snapshot.volume_h24, txns_h24_buys: snapshot.txns_h24_buys, txns_h24_sells: snapshot.txns_h24_sells, active_boosts: snapshot.active_boosts!, paid_order_types: snapshot.paid_order_types })));
    const components = qualityComponents(snapshots, this.options.classificationFor?.(normalize(contract)) ?? null, this.options.narrativePersistenceFor?.(normalize(contract)) ?? null);
    const score = assessment.attention_state === 'insufficient_history' || assessment.attention_state === 'paid_attention_detected' || Object.values(components).some((value) => value === null) ? null : Object.values(components).reduce<number>((total, value) => total + (value ?? 0), 0);
    return { contract: normalize(contract), latest_snapshot_at: latest?.captured_at ?? null, snapshot_count: snapshots.length, paid_attention_context: latest ? { active_boosts: latest.active_boosts!, paid_order_types: latest.paid_order_types, paid_order_statuses: latest.paid_order_statuses } : null, state: score === null && assessment.attention_state === 'organic_persistence' && Object.values(components).some((value) => value === null) ? 'source_required' : assessment.attention_state, score, components, caveats: [...assessment.caveats, 'Attention quality is descriptive context, not a trading recommendation, safety finding, endorsement, or classification change.'] };
  }
  async summarizeKnownWatchlistAttention() {
    const contracts = [...new Set((await this.options.watchlist()).map(normalize).filter(Boolean))];
    return Promise.all(contracts.map((contract) => this.summarizeAttentionHistory(contract)));
  }

  private async safeOrders(contract: string) { try { return await this.options.provider.getPaidOrders(contract); } catch { return null; } }
  private async safeBoosts() { try { return await this.options.provider.getLatestBoosts(); } catch { return null; } }
  private normalize(contract: string, pair: DexScreenerMarketSnapshot, activeBoosts: number, orders: Awaited<ReturnType<RhChainDexScreenerIngestionSource['getPaidOrders']>>): RhChainMarketSnapshot {
    const classification = this.options.classificationFor?.(contract) ?? null;
    const capturedAt = new Date(pair.capturedAt).toISOString();
    const providerAt = pair.providerTimestamp ? new Date(pair.providerTimestamp).toISOString() : null;
    const snapshotId = snapshotIdentity(contract, pair.pairAddress?.toLowerCase() ?? null, providerAt ?? capturedAt, pair.rawDataVersion ?? 'legacy-v1');
    const collection_gaps: string[] = providerAt ? [] : ['provider_timestamp_missing'];
    const numeric = (name: string, value: number | null | undefined, signed = false) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || (!signed && value < 0) || (name.startsWith('txns_') && !Number.isInteger(value))) { collection_gaps.push(name); return null; }
      return value;
    };
    return { collection_gaps, snapshot_id: snapshotId, captured_at: capturedAt, provider: 'dexscreener', chain_id: 'robinhood', token_address: contract, ticker: classification?.ticker ?? null, pair_address: pair.pairAddress?.toLowerCase() ?? null, dex_id: pair.dexId, price_usd: numeric('price_usd', pair.priceUsd), liquidity_usd: numeric('liquidity_usd', pair.liquidityUsd), market_cap: numeric('market_cap', pair.marketCap), fdv: numeric('fdv', pair.fdv), volume_h24: numeric('volume_h24', pair.volume.h24), volume_h6: numeric('volume_h6', pair.volume.h6 ?? null), volume_h1: numeric('volume_h1', pair.volume.h1 ?? null), txns_h24_buys: numeric('txns_h24_buys', pair.txns.h24.buys), txns_h24_sells: numeric('txns_h24_sells', pair.txns.h24.sells), txns_h6_buys: numeric('txns_h6_buys', pair.txns.h6?.buys ?? null), txns_h6_sells: numeric('txns_h6_sells', pair.txns.h6?.sells ?? null), price_change_h24: numeric('price_change_h24', pair.priceChange.h24, true), price_change_h6: numeric('price_change_h6', pair.priceChange.h6, true), price_change_h1: numeric('price_change_h1', pair.priceChange.h1, true), pair_created_at: pair.pairCreatedAt, active_boosts: activeBoosts, paid_order_types: orders.map((order) => order.type).filter((type): type is string => Boolean(type)), paid_order_statuses: orders.map((order) => order.status).filter((status): status is string => Boolean(status)), base_token: pair.baseToken, quote_token: pair.quoteToken, pair_labels: pair.pairLabels ?? [], websites: pair.websites ?? [], socials: pair.socials ?? [], provider_timestamp: providerAt, freshness_state: pair.freshness ?? 'fresh', raw_data_version: pair.rawDataVersion ?? 'legacy-v1', cache_status: pair.cache?.status ?? 'unavailable', cache_provenance: pair.cache?.provenance ?? 'provider', data_mode: pair.dataMode === 'live_cached' ? 'live_cached' : 'unavailable', source_url: pair.sourceUrl };
  }
  private storageStatus(written: number) { return { enabled: this.options.storageEnabled !== false, adapter: this.options.store.adapter, durable: this.options.store.durable, written: this.options.storageEnabled === false ? 0 : written }; }
}

function canonicalSelection(pairs: DexScreenerMarketSnapshot[]) {
  const grouped = new Map<string, DexScreenerMarketSnapshot[]>();
  for (const pair of pairs) {
    const key = pair.pairAddress!.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), pair]);
  }
  let disagreement = false;
  const eligible: DexScreenerMarketSnapshot[] = [];
  for (const group of grouped.values()) {
    group.sort((left, right) => Date.parse(right.providerTimestamp ?? right.capturedAt) - Date.parse(left.providerTimestamp ?? left.capturedAt));
    const latest = group[0];
    const identity = latest.providerTimestamp ?? latest.capturedAt;
    const signature = (pair: DexScreenerMarketSnapshot) => JSON.stringify([pair.priceUsd, pair.liquidityUsd, pair.marketCap, pair.fdv, pair.volume.h24, pair.volume.h6, pair.volume.h1, pair.txns.h24.buys, pair.txns.h24.sells, pair.txns.h6?.buys, pair.txns.h6?.sells, pair.priceChange.h24, pair.priceChange.h6, pair.priceChange.h1]);
    if (group.some((pair) => (pair.providerTimestamp ?? pair.capturedAt) === identity && signature(pair) !== signature(latest))) { disagreement = true; continue; }
    eligible.push(latest);
  }
  eligible.sort((left, right) => nonnegative(right.liquidityUsd) - nonnegative(left.liquidityUsd) || nonnegative(right.volume.h24) - nonnegative(left.volume.h24) || left.pairAddress!.toLowerCase().localeCompare(right.pairAddress!.toLowerCase()));
  return { pair: eligible[0] ?? null, disagreement };
}
function canonical(pairs: DexScreenerMarketSnapshot[]) { return canonicalSelection(pairs).pair; }
function nonnegative(value: number | null) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : -1; }
function isContract(value: string) { return /^0x[a-f0-9]{40}$/.test(value); }
function chunk<T>(values: T[], size: number) { const batches: T[][] = []; for (let index = 0; index < values.length; index += size) batches.push(values.slice(index, index + size)); return batches; }
async function mapWithConcurrency<T, U>(values: T[], concurrency: number, task: (value: T) => Promise<U>): Promise<U[]> {
  const results = new Array<U>(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) { const index = next; next += 1; results[index] = await task(values[index]); }
  }));
  return results;
}
function snapshotIdentity(contract: string, pair: string | null, observedAt: string, version: string) { return `rhms_${createHash('sha256').update(['dexscreener', 'robinhood', contract, pair ?? 'no-pair', observedAt, version].join('|')).digest('hex').slice(0, 32)}`; }
function normalize(contract: string) { return contract.trim().toLowerCase(); }
function parseWindow(value: string) { const match = value.match(/^(\d+)(h|d)$/); if (!match) return 24 * 60 * 60 * 1000; return Number(match[1]) * (match[2] === 'd' ? 24 : 1) * 60 * 60 * 1000; }
function emptyComponents() { return { organic_trader_retention: null, liquidity_retention: null, post_boost_volume_retention: null, narrative_persistence: null, evidence_quality: null, contract_deployer_clarity: null }; }
function qualityComponents(snapshots: RhChainMarketSnapshot[], classification: RhChainLayerClassification | null, narrativePersistence: number | null) {
  if (snapshots.length < 3) return emptyComponents();
  const [before, during, after] = snapshots.slice(-3);
  return { organic_trader_retention: retains(traders(after), traders(before), 0.7) ? 25 : 0, liquidity_retention: retains(after.liquidity_usd, before.liquidity_usd, 0.65) ? 25 : 0, post_boost_volume_retention: retains(after.volume_h24, during.volume_h24, 0.5) ? 20 : 0, narrative_persistence: narrativePersistence === 15 ? 15 : null, evidence_quality: classification?.classification_source === 'manual_review' ? 10 : null, contract_deployer_clarity: classification?.classification_source === 'manual_review' ? 5 : null };
}
function traders(snapshot: RhChainMarketSnapshot) { return snapshot.txns_h24_buys === null && snapshot.txns_h24_sells === null ? null : (snapshot.txns_h24_buys ?? 0) + (snapshot.txns_h24_sells ?? 0); }
function retains(after: number | null, before: number | null, threshold: number) { return after !== null && before !== null && before > 0 && after >= before * threshold; }
