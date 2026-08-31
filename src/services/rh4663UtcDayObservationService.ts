import pg from 'pg';
import { createHash } from 'node:crypto';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import { requestRhChainProviderJson } from './rhChainLiveSnapshotService';
import type { Rh4663ObservationFreshness, Rh4663VerifiedObservation } from './rh4663PrintGeneratorService';

export const RH_4663_UTC_DAY_OBSERVATION_VERSION = 'rh4663.utc-day-observation.v1' as const;
/** Indexers must be this far beyond midnight before a completed-day series point can become final. */
export const RH_4663_UTC_DAY_FINALITY_BUFFER_MS = 15 * 60_000;

export type Rh4663UtcDayStoredObservation = Rh4663VerifiedObservation & { date: string; revision: number; revision_of: string | null; source_metadata: Record<string, string | number | boolean | null>; created_at: string; finalized_at: string | null };
export type Rh4663UtcDayRefresh = { date: string; transactions: Rh4663UtcDayStoredObservation | null; dex_volume: Rh4663UtcDayStoredObservation | null; status: 'FINALIZED' | 'INCOMPLETE'; warnings: string[] };

export interface Rh4663UtcDayObservationStore {
  readonly adapter: 'memory' | 'postgres'; readonly durable: boolean;
  put(observation: Omit<Rh4663UtcDayStoredObservation, 'revision' | 'revision_of' | 'created_at'>): Promise<Rh4663UtcDayStoredObservation>;
  current(date: string): Promise<Rh4663UtcDayStoredObservation[]>;
  history(observationId: string): Promise<Rh4663UtcDayStoredObservation[]>;
}

export class InMemoryRh4663UtcDayObservationStore implements Rh4663UtcDayObservationStore {
  readonly adapter = 'memory' as const; readonly durable = false; private readonly rows = new Map<string, Rh4663UtcDayStoredObservation[]>();
  async put(input: Omit<Rh4663UtcDayStoredObservation, 'revision' | 'revision_of' | 'created_at'>) { const prior = this.rows.get(input.observation_id) ?? []; const content = stable(stripRevision(input)); const same = prior.find((item) => stable(stripRevision(item)) === content); if (same) return structuredClone(same); const next = { ...structuredClone(input), revision: prior.length + 1, revision_of: prior.at(-1)?.observation_id ?? null, created_at: input.finalized_at ?? input.fetched_at }; this.rows.set(input.observation_id, [...prior, next]); return structuredClone(next); }
  async current(date: string) { return [...this.rows.values()].flatMap((rows) => rows.at(-1) ?? []).filter((item) => item.date === date).map((item) => structuredClone(item)); }
  async history(id: string) { return (this.rows.get(id) ?? []).map((item) => structuredClone(item)); }
}

export class PostgresRh4663UtcDayObservationStore implements Rh4663UtcDayObservationStore {
  readonly adapter = 'postgres' as const; readonly durable = true; private readonly pool: pg.Pool; private readonly ownsPool: boolean; private readonly schema = new RetryablePostgresSchema('rh_4663_utc_day_observation_store');
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  async put(input: Omit<Rh4663UtcDayStoredObservation, 'revision' | 'revision_of' | 'created_at'>) { await this.ready(); const client = await this.pool.connect(); try { await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-utc-day:' || $1))", [input.observation_id]); const prior = await client.query<{ revision: number; payload: Rh4663UtcDayStoredObservation }>('select revision,payload from rh_4663_utc_day_observations where observation_id=$1 order by revision desc limit 1', [input.observation_id]); const same = prior.rows[0] && stable(stripRevision(prior.rows[0].payload)) === stable(stripRevision(input)); if (same) { await client.query('commit'); return prior.rows[0].payload; } const row: Rh4663UtcDayStoredObservation = { ...input, revision: (prior.rows[0]?.revision ?? 0) + 1, revision_of: prior.rows[0]?.payload.observation_id ?? null, created_at: input.finalized_at ?? input.fetched_at }; await client.query('insert into rh_4663_utc_day_observations (observation_id, revision, date, metric, created_at, payload) values ($1,$2,$3,$4,$5,$6::jsonb)', [row.observation_id, row.revision, row.date, row.metric, row.created_at, JSON.stringify(row)]); await client.query('commit'); return row; } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); } }
  async current(date: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663UtcDayStoredObservation }>('select distinct on (observation_id) payload from rh_4663_utc_day_observations where date=$1 order by observation_id,revision desc', [date]); return result.rows.map((row) => row.payload); }
  async history(id: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663UtcDayStoredObservation }>('select payload from rh_4663_utc_day_observations where observation_id=$1 order by revision', [id]); return result.rows.map((row) => row.payload); }
  async close() { if (this.ownsPool) await this.pool.end(); }
  private ready() { return this.schema.ensure(this.pool, 'create table if not exists rh_4663_utc_day_observations (observation_id text not null, revision integer not null, date date not null, metric text not null, created_at timestamptz not null, payload jsonb not null, primary key (observation_id, revision)); create index if not exists rh_4663_utc_day_observations_date_idx on rh_4663_utc_day_observations (date, observation_id, revision desc);'); }
}

export type Rh4663UtcDayProviderResult = { value: number; observed_at: string; source_url: string; source_metadata: Record<string, string | number | boolean | null>; provider_tip_at: string; methodology: string };
export type Rh4663UtcDayProviders = { transactions(date: string): Promise<Rh4663UtcDayProviderResult>; dexVolume(date: string): Promise<Rh4663UtcDayProviderResult> };
export type Rh4663UtcDayObservationOptions = { store: Rh4663UtcDayObservationStore; providers: Rh4663UtcDayProviders; now?: () => Date; finalityBufferMs?: number; log?: (entry: Record<string, unknown>) => void };

export class Rh4663UtcDayObservationService {
  private readonly now: () => Date; private readonly finalityBufferMs: number; private readonly log: (entry: Record<string, unknown>) => void;
  constructor(private readonly options: Rh4663UtcDayObservationOptions) { this.now = options.now ?? (() => new Date()); this.finalityBufferMs = options.finalityBufferMs ?? RH_4663_UTC_DAY_FINALITY_BUFFER_MS; this.log = options.log ?? ((entry) => console.log(JSON.stringify(entry))); }
  async refresh(date: string): Promise<Rh4663UtcDayRefresh> {
    assertCompletedDate(date, this.now()); this.log({ event: 'rh4663_utc_day_ingest_started', date }); const warnings: string[] = [];
    const [transactions, dex] = await Promise.all([this.finalize(date, 'transactions_utc_day', 'COUNT', 'Blockscout', () => this.options.providers.transactions(date), 'rh4663:transactions'), this.finalize(date, 'dex_volume_utc_day_usd', 'USD', 'DefiLlama', () => this.options.providers.dexVolume(date), 'rh4663:dex_volume_usd')]);
    for (const result of [transactions, dex]) if (result.warning) warnings.push(result.warning);
    const response = { date, transactions: transactions.observation, dex_volume: dex.observation, status: transactions.observation && dex.observation ? 'FINALIZED' as const : 'INCOMPLETE' as const, warnings };
    if (response.status === 'INCOMPLETE') this.log({ event: 'rh4663_utc_day_incomplete', date, warnings }); return response;
  }
  async observations(date: string): Promise<Rh4663VerifiedObservation[]> { return (await this.options.store.current(date)).map((item) => ({ observation_id: item.observation_id, chain_id: item.chain_id, metric: item.metric, value: item.value, unit: item.unit, provider: item.provider, source_url: item.source_url, observed_at: item.observed_at, fetched_at: item.fetched_at, window_start: item.window_start, window_end: item.window_end, window_type: item.window_type, methodology: item.methodology, freshness: item.freshness, confidence: item.confidence, status: item.status, notes: item.notes })); }
  private async finalize(date: string, metric: 'transactions_utc_day' | 'dex_volume_utc_day_usd', unit: 'COUNT' | 'USD', provider: string, load: () => Promise<Rh4663UtcDayProviderResult>, idPrefix: string) {
    try { const raw = await load(); const end = utcBounds(date).end; if (new Date(raw.provider_tip_at).getTime() < new Date(end).getTime() + this.finalityBufferMs) { this.log({ event: 'rh4663_provider_index_lag', date, metric, provider_tip_at: raw.provider_tip_at, required_after: new Date(new Date(end).getTime() + this.finalityBufferMs).toISOString() }); return { observation: null, warning: `${metric}: provider index has not passed the finality guard.` }; }
      if (!Number.isFinite(raw.value) || raw.value < 0) return { observation: null, warning: `${metric}: provider returned an invalid value.` };
      const bounds = utcBounds(date); const base = { observation_id: `${idPrefix}:${date}:${provider.toLowerCase()}:${RH_4663_UTC_DAY_OBSERVATION_VERSION}`, chain_id: 4663 as const, date, metric, value: raw.value, unit, provider, source_url: raw.source_url, observed_at: raw.observed_at, fetched_at: this.now().toISOString(), window_start: bounds.start, window_end: bounds.end, window_type: 'UTC_CALENDAR_DAY' as const, methodology: raw.methodology, freshness: 'HISTORICAL_FINAL' as Rh4663ObservationFreshness, confidence: 90, status: 'FINAL' as const, source_metadata: raw.source_metadata, finalized_at: this.now().toISOString() };
      const prior = await this.options.store.history(base.observation_id); const saved = await this.options.store.put(base); if (prior.length && saved.revision > prior.at(-1)!.revision) this.log({ event: 'rh4663_observation_revision_detected', date, metric, observation_id: saved.observation_id, revision: saved.revision }); this.log({ event: metric === 'transactions_utc_day' ? 'rh4663_transaction_observation_finalized' : 'rh4663_dex_observation_finalized', date, observation_id: saved.observation_id, value: saved.value, revision: saved.revision }); return { observation: saved, warning: null };
    } catch (error) { return { observation: null, warning: `${metric}: ${error instanceof Error ? error.message.slice(0, 160) : 'provider_unavailable'}` }; }
  }
}

/** Production clients: Blockscout's daily transaction chart and DefiLlama's daily DEX chart. No block crawling. */
export function createRh4663UtcDayProviders(options: { blockscoutUrl: string | null; timeoutMs: number }): Rh4663UtcDayProviders {
  const blockscoutBase = options.blockscoutUrl?.replace(/\/$/, '') ?? null;
  return {
    async transactions(date) { if (!blockscoutBase) throw new Error('blockscout_endpoint_not_configured'); const payload = await requestRhChainProviderJson<unknown>(`${blockscoutBase}/api/v2/stats/charts/transactions`, options.timeoutMs); const row = dailyRow(payload, date, ['tx_count', 'transactions_count', 'count', 'value']); const tip = latestTimestamp(payload) ?? throwMissing('blockscout_tip_timestamp_missing'); return { value: row.value, observed_at: row.timestamp, source_url: `${blockscoutBase}/api/v2/stats/charts/transactions`, source_metadata: { series: 'Blockscout transactions stats chart', date }, provider_tip_at: tip, methodology: 'Blockscout pre-aggregated daily transaction chart. The provider row is accepted only when its date resolves exactly to the requested UTC calendar day and the indexer tip passes the finality guard.' }; },
    async dexVolume(date) { const url = 'https://api.llama.fi/overview/dexs/Robinhood?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume'; const payload = await requestRhChainProviderJson<unknown>(url, options.timeoutMs); const row = dailyRow(payload, date, ['dailyVolume', 'volume', 'value']); const tip = latestTimestamp(payload) ?? throwMissing('defillama_tip_timestamp_missing'); return { value: row.value, observed_at: row.timestamp, source_url: url, source_metadata: { series: 'DefiLlama overview/dexs/Robinhood totalDataChart (dailyVolume)', date }, provider_tip_at: tip, methodology: 'DefiLlama dailyVolume historical chain series. A row is accepted only when its Unix timestamp resolves exactly to the requested UTC date; rolling 24-hour fields are ignored.' }; }
  };
}

function dailyRow(payload: unknown, date: string, fields: string[]) { const rows = extractRows(payload); const row = rows.find((item) => timestampDate(item.timestamp) === date); if (!row) throw new Error('historical_series_row_missing'); const value = fields.map((field) => itemNumber(row.raw, field)).find((item): item is number => item !== null); if (value === undefined) throw new Error('historical_series_value_missing'); return { value, timestamp: row.timestamp }; }
function extractRows(payload: unknown): Array<{ timestamp: string; raw: Record<string, unknown> }> { const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}; const candidates = [root.chart, root.chart_data, root.totalDataChart, root.data, root.items].flatMap((item) => Array.isArray(item) ? item : []); return candidates.flatMap((raw) => { if (Array.isArray(raw) && typeof raw[0] === 'number') { const date = new Date(raw[0] * 1000); return Number.isNaN(date.getTime()) ? [] : [{ timestamp: date.toISOString(), raw: { value: raw[1] } }]; } if (!raw || typeof raw !== 'object') return []; const object = raw as Record<string, unknown>; const timestamp = object.date ?? object.timestamp ?? object.time; const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : typeof timestamp === 'string' ? new Date(timestamp) : null; return date && !Number.isNaN(date.getTime()) ? [{ timestamp: date.toISOString(), raw: object }] : []; }); }
function latestTimestamp(payload: unknown) { return extractRows(payload).map((item) => item.timestamp).sort().at(-1) ?? null; }
function itemNumber(value: Record<string, unknown>, key: string) { const item = value[key]; return typeof item === 'number' && Number.isFinite(item) ? item : typeof item === 'string' && item.trim() && Number.isFinite(Number(item)) ? Number(item) : null; }
function timestampDate(value: string) { return value.slice(0, 10); }
function utcBounds(date: string) { return { start: `${date}T00:00:00.000Z`, end: new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 86_400_000).toISOString() }; }
function assertCompletedDate(date: string, now: Date) { if (!isValidRh4663UtcDate(date)) throw new Rh4663UtcDayObservationError('invalid_utc_date', 400); if (new Date(utcBounds(date).end).getTime() > now.getTime()) throw new Rh4663UtcDayObservationError('utc_day_not_completed', 409); }
export function isValidRh4663UtcDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date; }
function throwMissing(code: string): never { throw new Error(code); }
function stable(value: unknown) { return JSON.stringify(value); }
/** Fetch/finalization timestamps describe ingestion, not a changed upstream fact. */
function stripRevision(value: Rh4663UtcDayStoredObservation | Omit<Rh4663UtcDayStoredObservation, 'revision' | 'revision_of' | 'created_at'>) { const { revision: _revision, revision_of: _revisionOf, created_at: _createdAt, fetched_at: _fetchedAt, finalized_at: _finalizedAt, ...rest } = value as Rh4663UtcDayStoredObservation; return rest; }
export class Rh4663UtcDayObservationError extends Error { constructor(readonly code: string, readonly statusCode: number) { super(code); } }
