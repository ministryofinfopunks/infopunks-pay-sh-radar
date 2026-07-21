import { createHash } from 'node:crypto';
import pg from 'pg';
import type { RhChainDataFreshness } from '../data/rhChain';
import type { RhChainDexScreenerIngestionSource, RhChainMarketSnapshot as DexScreenerMarketSnapshot } from '../providers/dexscreenerProvider';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import { RhChainAttentionService, type RhChainAttentionState } from './rhChainAttentionService';
import type { RhChainLayerClassification } from './rhChainMarketStructureService';

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
  active_boosts: number;
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
};

export interface RhChainMarketSnapshotStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  save(snapshot: RhChainMarketSnapshot): Promise<void>;
  list(contract: string, operation?: { timeoutMs?: number }): Promise<RhChainMarketSnapshot[]>;
  listMany?(contracts: string[]): Promise<Record<string, RhChainMarketSnapshot[]>>;
  latestMany?(contracts: string[]): Promise<Record<string, RhChainMarketSnapshot | null>>;
  close?(): Promise<void>;
}

export class InMemoryRhChainMarketSnapshotStore implements RhChainMarketSnapshotStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private readonly snapshots = new Map<string, RhChainMarketSnapshot[]>();
  async save(snapshot: RhChainMarketSnapshot) {
    const key = snapshot.token_address.toLowerCase();
    const retained = (this.snapshots.get(key) ?? []).filter((item) => item.snapshot_id !== snapshot.snapshot_id);
    const next = [...retained, structuredClone(snapshot)].sort((a, b) => a.captured_at.localeCompare(b.captured_at)).slice(-300);
    this.snapshots.set(key, next);
  }
  async list(contract: string) { return structuredClone(this.snapshots.get(contract.toLowerCase()) ?? []); }
  async listMany(contracts: string[]) { return Object.fromEntries(contracts.slice(0, 300).map((contract) => [contract.toLowerCase(), structuredClone(this.snapshots.get(contract.toLowerCase()) ?? [])])); }
  async latestMany(contracts: string[]) { return Object.fromEntries(contracts.slice(0, 300).map((contract) => [contract.toLowerCase(), structuredClone(this.snapshots.get(contract.toLowerCase())?.at(-1) ?? null)])); }
}

export class PostgresRhChainMarketSnapshotStore implements RhChainMarketSnapshotStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private readonly schema = new RetryablePostgresSchema('rh_chain_market_snapshot_store');
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  async save(snapshot: RhChainMarketSnapshot) {
    await this.ready();
    await this.pool.query(`insert into rh_chain_market_snapshots (snapshot_id, token_address, pair_address, provider, captured_at, provider_timestamp, raw_data_version, payload)
      values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict (snapshot_id) do nothing`, [snapshot.snapshot_id, snapshot.token_address.toLowerCase(), snapshot.pair_address?.toLowerCase() ?? null, snapshot.provider, snapshot.captured_at, snapshot.provider_timestamp ?? null, snapshot.raw_data_version ?? 'legacy-v1', JSON.stringify(snapshot)]);
    await this.pool.query("delete from rh_chain_market_snapshots where snapshot_id in (select snapshot_id from (select snapshot_id, row_number() over (partition by token_address order by captured_at desc) as row_number, captured_at from rh_chain_market_snapshots) retained where retained.captured_at < now() - interval '30 days' or retained.row_number > 300)");
  }
  async list(contract: string, operation?: { timeoutMs?: number }) { await this.ready(); const result = await this.pool.query({ text: 'select payload from rh_chain_market_snapshots where token_address=$1 order by captured_at asc limit 300', values: [contract.toLowerCase()], query_timeout: operation?.timeoutMs } as pg.QueryConfig & { query_timeout?: number }) as pg.QueryResult<{ payload: RhChainMarketSnapshot }>; return result.rows.map((row) => row.payload); }
  async listMany(contracts: string[]) {
    const normalized = [...new Set(contracts.map(normalize).filter(Boolean))].slice(0, 300);
    if (!normalized.length) return {};
    await this.ready();
    const result = await this.pool.query<{ token_address: string; payload: RhChainMarketSnapshot }>(`select token_address, payload from (
      select token_address, payload, row_number() over (partition by token_address order by captured_at desc) as retained_row
      from rh_chain_market_snapshots where token_address = any($1::text[])
    ) snapshots where retained_row <= 300 order by token_address, (payload->>'captured_at')::timestamptz asc`, [normalized]);
    const grouped = Object.fromEntries(normalized.map((contract) => [contract, [] as RhChainMarketSnapshot[]]));
    for (const row of result.rows) grouped[row.token_address.toLowerCase()]?.push(row.payload);
    return grouped;
  }
  async latestMany(contracts: string[]) {
    const normalized = [...new Set(contracts.map(normalize).filter(Boolean))].slice(0, 300);
    if (!normalized.length) return {};
    await this.ready();
    const result = await this.pool.query<{ token_address: string; payload: RhChainMarketSnapshot }>('select distinct on (token_address) token_address, payload from rh_chain_market_snapshots where token_address = any($1::text[]) order by token_address, captured_at desc', [normalized]);
    const latest = Object.fromEntries(normalized.map((contract) => [contract, null as RhChainMarketSnapshot | null]));
    for (const row of result.rows) latest[row.token_address.toLowerCase()] = row.payload;
    return latest;
  }
  async close() { if (this.ownsPool) await this.pool.end(); }
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

export type RhChainMarketSnapshotServiceOptions = {
  store: RhChainMarketSnapshotStore;
  provider: RhChainDexScreenerIngestionSource;
  enabled: boolean;
  storageEnabled?: boolean;
  watchlist: () => Promise<string[]> | string[];
  classificationFor?: (contract: string) => RhChainLayerClassification | null;
  narrativePersistenceFor?: (contract: string) => number | null;
  now?: () => Date;
};

export class RhChainMarketSnapshotService {
  private readonly now: () => Date;
  private readonly attention: RhChainAttentionService;
  constructor(private readonly options: RhChainMarketSnapshotServiceOptions) { this.now = options.now ?? (() => new Date()); this.attention = new RhChainAttentionService(this.now); }

  async captureKnownWatchlistSnapshot() {
    if (!this.options.enabled) return { captured: [] as RhChainMarketSnapshot[], status: 'disabled' as const, caveats: ['Snapshot capture is disabled. Reviewed classifications and receipts remain unchanged.'] };
    const contracts = [...new Set((await this.options.watchlist()).map(normalize).filter(Boolean))];
    try {
      const [batches, boosts] = await Promise.all([mapWithConcurrency(chunk(contracts, 30), 4, (batch) => this.options.provider.getTokenBatch(batch)), this.options.provider.getLatestBoosts()]);
      const batch = Object.assign({}, ...batches);
      const captured = await mapWithConcurrency(contracts, 4, async (contract) => {
        const pair = canonical(batch[contract] ?? []);
        if (!pair) return null;
        const orders = await this.safeOrders(contract);
        const activeBoosts = boosts.filter((boost) => boost.tokenAddress === contract).reduce((total, boost) => total + (boost.amount ?? 0), 0);
        const snapshot = this.normalize(contract, pair, activeBoosts, orders);
        if (this.options.storageEnabled !== false) await this.options.store.save(snapshot);
        return snapshot;
      });
      const normalized = captured.filter((snapshot): snapshot is RhChainMarketSnapshot => Boolean(snapshot));
      return { captured: normalized, status: 'captured' as const, storage: this.storageStatus(normalized.length), caveats: ['Snapshots are low-frequency provider observations, not recommendations or reviewed judgment.'] };
    } catch { return { captured: [] as RhChainMarketSnapshot[], status: 'unavailable' as const, caveats: ['DEX Screener is unavailable; no snapshot was inferred or written.'] }; }
  }

  async captureTokenSnapshot(contract: string) {
    const token = normalize(contract);
    if (!token || !this.options.enabled) return { snapshot: null, status: 'disabled' as const, caveats: ['Snapshot capture is disabled or an exact contract was not supplied.'] };
    try {
      const [pairs, boosts, orders] = await Promise.all([this.options.provider.getTokenPairs(token), this.options.provider.getLatestBoosts(), this.safeOrders(token)]);
      const pair = canonical(pairs);
      if (!pair) return { snapshot: null, status: 'source_required' as const, caveats: ['No RH Chain pair observation is available for this exact contract.'] };
      const activeBoosts = boosts.filter((boost) => boost.tokenAddress === token).reduce((total, boost) => total + (boost.amount ?? 0), 0);
      const snapshot = this.normalize(token, pair, activeBoosts, orders);
      if (this.options.storageEnabled !== false) await this.options.store.save(snapshot);
      return { snapshot, status: 'captured' as const, storage: this.storageStatus(1), caveats: ['Snapshot capture stores context only and cannot change reviewed classification or receipt status.'] };
    } catch { return { snapshot: null, status: 'unavailable' as const, caveats: ['Provider unavailable; no snapshot was inferred or written.'] }; }
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
    const assessment = this.attention.assessSnapshotHistory(snapshots.map((snapshot) => ({ captured_at: snapshot.captured_at, liquidity_usd: snapshot.liquidity_usd, volume_h24: snapshot.volume_h24, txns_h24_buys: snapshot.txns_h24_buys, txns_h24_sells: snapshot.txns_h24_sells, active_boosts: snapshot.active_boosts, paid_order_types: snapshot.paid_order_types })));
    const components = qualityComponents(snapshots, this.options.classificationFor?.(normalize(contract)) ?? null, this.options.narrativePersistenceFor?.(normalize(contract)) ?? null);
    const score = assessment.attention_state === 'insufficient_history' || assessment.attention_state === 'paid_attention_detected' || Object.values(components).some((value) => value === null) ? null : Object.values(components).reduce<number>((total, value) => total + (value ?? 0), 0);
    return { contract: normalize(contract), latest_snapshot_at: latest?.captured_at ?? null, snapshot_count: snapshots.length, paid_attention_context: latest ? { active_boosts: latest.active_boosts, paid_order_types: latest.paid_order_types, paid_order_statuses: latest.paid_order_statuses } : null, state: score === null && assessment.attention_state === 'organic_persistence' && Object.values(components).some((value) => value === null) ? 'source_required' : assessment.attention_state, score, components, caveats: [...assessment.caveats, 'Attention quality is descriptive context, not a trading recommendation, safety finding, endorsement, or classification change.'] };
  }
  async summarizeKnownWatchlistAttention() {
    const contracts = [...new Set((await this.options.watchlist()).map(normalize).filter(Boolean))];
    return Promise.all(contracts.map((contract) => this.summarizeAttentionHistory(contract)));
  }

  private async safeOrders(contract: string) { try { return await this.options.provider.getPaidOrders(contract); } catch { return []; } }
  private normalize(contract: string, pair: DexScreenerMarketSnapshot, activeBoosts: number, orders: Awaited<ReturnType<RhChainDexScreenerIngestionSource['getPaidOrders']>>): RhChainMarketSnapshot {
    const classification = this.options.classificationFor?.(contract) ?? null;
    const capturedAt = pair.capturedAt || this.now().toISOString();
    const snapshotId = snapshotIdentity(contract, pair.pairAddress, pair.providerTimestamp ?? capturedAt, pair.rawDataVersion ?? 'legacy-v1');
    return { snapshot_id: snapshotId, captured_at: capturedAt, provider: 'dexscreener', chain_id: 'robinhood', token_address: contract, ticker: classification?.ticker ?? null, pair_address: pair.pairAddress, dex_id: pair.dexId, price_usd: pair.priceUsd, liquidity_usd: pair.liquidityUsd, market_cap: pair.marketCap, fdv: pair.fdv, volume_h24: pair.volume.h24, volume_h6: pair.volume.h6 ?? null, volume_h1: pair.volume.h1 ?? null, txns_h24_buys: pair.txns.h24.buys, txns_h24_sells: pair.txns.h24.sells, txns_h6_buys: pair.txns.h6?.buys ?? null, txns_h6_sells: pair.txns.h6?.sells ?? null, price_change_h24: pair.priceChange.h24, price_change_h6: pair.priceChange.h6, price_change_h1: pair.priceChange.h1, pair_created_at: pair.pairCreatedAt, active_boosts: activeBoosts, paid_order_types: orders.map((order) => order.type).filter((type): type is string => Boolean(type)), paid_order_statuses: orders.map((order) => order.status).filter((status): status is string => Boolean(status)), base_token: pair.baseToken, quote_token: pair.quoteToken, pair_labels: pair.pairLabels ?? [], websites: pair.websites ?? [], socials: pair.socials ?? [], provider_timestamp: pair.providerTimestamp ?? null, freshness_state: pair.freshness ?? 'fresh', raw_data_version: pair.rawDataVersion ?? 'legacy-v1', cache_status: pair.cache?.status ?? 'unavailable', cache_provenance: pair.cache?.provenance ?? 'provider', data_mode: pair.dataMode === 'live_cached' ? 'live_cached' : 'unavailable', source_url: pair.sourceUrl };
  }
  private storageStatus(written: number) { return { enabled: this.options.storageEnabled !== false, adapter: this.options.store.adapter, durable: this.options.store.durable, written: this.options.storageEnabled === false ? 0 : written }; }
}

function canonical(pairs: DexScreenerMarketSnapshot[]) { return [...pairs].sort((left, right) => (right.liquidityUsd ?? -1) - (left.liquidityUsd ?? -1) || (right.volume.h24 ?? -1) - (left.volume.h24 ?? -1))[0] ?? null; }
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
