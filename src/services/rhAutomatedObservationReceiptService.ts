import { createHash } from 'node:crypto';
import type pg from 'pg';
import { RH_CHAIN_MARKET_METRICS, type RhChainMarketAggregate } from './rhChainMarketHistory';
import type { RhChainMarketSnapshot, RhChainMarketSnapshotStore } from './rhChainMarketSnapshotService';
import type { Rh4663UtcDayObservationStore, Rh4663UtcDayStoredObservation } from './rh4663UtcDayObservationService';

export const AUTOMATED_OBSERVATION_SCHEMA = 'rh-automated-observation-v1';
export const AUTOMATED_OBSERVATION_CALCULATION = 'same-pair-observed-endpoints-v1';
export function canonicalObservationJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalObservationJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonicalObservationJson(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function observationCommitment(value: unknown) { return createHash('sha256').update(canonicalObservationJson(value)).digest('hex'); }
export type AutomatedObservationReceipt = {
  object_type: 'AUTOMATED_OBSERVATION_RECEIPT'; edition_id: string; utc_day: string; chain_id: 4663;
  window: { start: string; end: string; interval: '[start,end)'; timezone: 'UTC' };
  schema_version: string; calculation_version: string; covered_contracts: string[];
  markets: Array<{ contract: string; pair: string; observed_start: string; observed_end: string;
    metrics: Record<string, { first: number | null; last: number | null; delta: number | null; delta_pct: number | null; covered_samples: number }>;
    evidence: Array<{ observation_id: string; source_id: string; source_url: string; observed_at: string; collected_at: string; time_basis: 'PROVIDER_OBSERVATION' | 'COLLECTION_PROXY'; metrics: Record<string, number | null> }>;
    coverage: { samples: number; largest_gap_ms: number; start_gap_ms: number; end_gap_ms: number; missing: string[] } }>;
  chain_metrics: Array<{ metric: string; value: number | null; observation: Rh4663UtcDayStoredObservation | null }>;
  historical_coverage: { collection_day_aggregates: Array<{ reference: string; sample_count: number; observation_ids: string[]; window_start: string; window_end: string }>;
    missing: string[]; excluded_observation_ids: string[] };
  publication_state: 'FINALIZED_PRIVATE'; correction: { supersedes: string | null; reason: string | null };
  content_hash: string; commitment_algorithm: 'SHA-256'; execution_authorized: false;
};
export type AutomatedPublication = { edition_id: string; publication_state: 'PUBLISHED'; authorization_ref: string; published_at: string };
export interface AutomatedObservationStore {
  readonly durable: boolean;
  finalize(receipt: AutomatedObservationReceipt): Promise<AutomatedObservationReceipt>;
  history(day: string): Promise<AutomatedObservationReceipt[]>;
  publish(id: string, authorization: string): Promise<AutomatedPublication>;
  published(day: string): Promise<Array<{ receipt: AutomatedObservationReceipt; publication: AutomatedPublication }>>;
}
export class InMemoryAutomatedObservationStore implements AutomatedObservationStore {
  readonly durable = false;
  private rows = new Map<string, AutomatedObservationReceipt>();
  private publications = new Map<string, AutomatedPublication>();
  async finalize(receipt: AutomatedObservationReceipt) {
    verifyReceipt(receipt);
    const prior = [...this.rows.values()].find(r => r.utc_day === receipt.utc_day && (r.content_hash === receipt.content_hash || (!r.correction.supersedes && !receipt.correction.supersedes)));
    if (prior) return structuredClone(prior);
    if (receipt.correction.supersedes && this.rows.get(receipt.correction.supersedes)?.utc_day !== receipt.utc_day) throw new Error('same_day_supersession_required');
    this.rows.set(receipt.edition_id, structuredClone(receipt)); return structuredClone(receipt);
  }
  async history(day: string) { return structuredClone([...this.rows.values()].filter(r => r.utc_day === day).sort((a, b) => a.edition_id.localeCompare(b.edition_id))); }
  async publish(id: string, authorization: string) { if (!authorization.trim() || !this.rows.has(id)) throw new Error('publication_authorization_required'); const row = this.publications.get(id) ?? { edition_id: id, publication_state: 'PUBLISHED' as const, authorization_ref: authorization, published_at: new Date().toISOString() }; this.publications.set(id, row); return structuredClone(row); }
  async published(day: string) { return (await this.history(day)).flatMap(receipt => { const publication = this.publications.get(receipt.edition_id); return publication ? [{ receipt, publication: structuredClone(publication) }] : []; }); }
}
export class PostgresAutomatedObservationStore implements AutomatedObservationStore {
  readonly durable = true;
  constructor(private readonly pool: pg.Pool) {}
  async finalize(receipt: AutomatedObservationReceipt) {
    verifyReceipt(receipt); const c = await this.pool.connect();
    try {
      await c.query('begin'); await c.query("select pg_advisory_xact_lock(hashtext(current_schema() || ':rh-observation:' || $1))", [receipt.utc_day]);
      const prior = await c.query<{ payload: AutomatedObservationReceipt }>(`select payload from rh_automated_observation_receipts where utc_day=$1 and (content_hash=$2 or (supersedes is null and $3::text is null)) order by edition_id limit 1`, [receipt.utc_day, receipt.content_hash, receipt.correction.supersedes]);
      if (prior.rows[0]) { await c.query('commit'); return prior.rows[0].payload; }
      if (receipt.correction.supersedes) {
        const parent = await c.query('select 1 from rh_automated_observation_receipts where edition_id=$1 and utc_day=$2', [receipt.correction.supersedes, receipt.utc_day]);
        if (!parent.rowCount) throw new Error('same_day_supersession_required');
      }
      await c.query('insert into rh_automated_observation_receipts(edition_id,utc_day,content_hash,supersedes,payload) values($1,$2,$3,$4,$5)', [receipt.edition_id, receipt.utc_day, receipt.content_hash, receipt.correction.supersedes, receipt]);
      await c.query('commit'); return receipt;
    } catch (error) { await c.query('rollback'); throw error; } finally { c.release(); }
  }
  async history(day: string) { const r = await this.pool.query<{ payload: AutomatedObservationReceipt }>('select payload from rh_automated_observation_receipts where utc_day=$1 order by edition_id', [day]); return r.rows.map(r => r.payload); }
  async publish(id: string, authorization: string) {
    if (!authorization.trim()) throw new Error('publication_authorization_required');
    await this.pool.query('insert into rh_automated_observation_publications(edition_id,authorization_ref) values($1,$2) on conflict(edition_id) do nothing', [id, authorization]);
    const r = await this.pool.query('select edition_id,authorization_ref,published_at from rh_automated_observation_publications where edition_id=$1', [id]);
    return { ...r.rows[0], publication_state: 'PUBLISHED' as const, published_at: r.rows[0].published_at.toISOString() };
  }
  async published(day: string) {
    const r = await this.pool.query<{ payload: AutomatedObservationReceipt; authorization_ref: string; published_at: Date }>('select r.payload,p.authorization_ref,p.published_at from rh_automated_observation_receipts r join rh_automated_observation_publications p using(edition_id) where utc_day=$1 order by r.edition_id', [day]);
    return r.rows.map(r => ({ receipt: r.payload, publication: { edition_id: r.payload.edition_id, publication_state: 'PUBLISHED' as const, authorization_ref: r.authorization_ref, published_at: r.published_at.toISOString() } }));
  }
}
function verifyReceipt(receipt: AutomatedObservationReceipt) {
  const { content_hash, commitment_algorithm: _algorithm, ...body } = receipt;
  if (observationCommitment(body) !== content_hash) throw new Error('observation_commitment_mismatch');
}
export function completedObservationDay(day: string, now: Date) {
  const start = Date.parse(day + 'T00:00:00.000Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== day) throw new Error('invalid_utc_date');
  if (start + 86400000 > now.getTime()) throw new Error('utc_day_not_completed');
  return { start, end: start + 86400000 };
}
const address = (s: string | undefined | null) => typeof s === 'string' && /^0x[0-9a-f]{40}$/i.test(s) && !/^0x0{40}$/i.test(s);
function eligible(s: RhChainMarketSnapshot, start: number, end: number, now: number) {
  const observed = Date.parse(s.provider_timestamp ?? s.captured_at), collected = Date.parse(s.captured_at);
  return s.provider === 'dexscreener' && s.chain_id === 'robinhood' && address(s.token_address) && address(s.quote_token?.address)
    && s.base_token?.address.toLowerCase() === s.token_address.toLowerCase() && /^0x[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(s.pair_address ?? '')
    && typeof s.source_url === 'string' && s.source_url.startsWith('https://dexscreener.com/robinhood/')
    && observed >= start && observed < end && collected <= now && observed <= collected + 60000 && Number.isFinite(collected);
}
function marketRows(observations: RhChainMarketSnapshot[], start: number, end: number, now: number) {
  const excluded = new Set<string>(); const groups = new Map<string, RhChainMarketSnapshot[]>(); const pairContracts = new Map<string, Set<string>>();
  for (const s of observations) {
    if (!eligible(s, start, end, now)) { excluded.add(s.snapshot_id); continue; }
    const pair = s.pair_address!.toLowerCase(), contract = s.token_address.toLowerCase();
    const contracts = pairContracts.get(pair) ?? new Set<string>(); contracts.add(contract); pairContracts.set(pair, contracts);
    const key = contract + ':' + pair; groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const markets: AutomatedObservationReceipt['markets'] = [];
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (pairContracts.get(group[0].pair_address!.toLowerCase())!.size > 1) { group.forEach(s => excluded.add(s.snapshot_id)); continue; }
    const times = new Map<string, RhChainMarketSnapshot[]>();
    for (const s of group) { const at = new Date(s.provider_timestamp ?? s.captured_at).toISOString(); times.set(at, [...(times.get(at) ?? []), s]); }
    const missing = new Set<string>(); const samples: RhChainMarketSnapshot[] = [];
    for (const rows of times.values()) {
      // Duplicate source/time observations are equivalent only when all recorded metrics agree.
      const sig = (s: RhChainMarketSnapshot) => canonicalObservationJson(RH_CHAIN_MARKET_METRICS.map(m => s[m] ?? null));
      if (new Set(rows.map(sig)).size > 1) { missing.add('CONTRADICTORY_DUPLICATE'); rows.forEach(s => excluded.add(s.snapshot_id)); continue; }
      samples.push(rows.sort((a, b) => a.snapshot_id.localeCompare(b.snapshot_id))[0]);
    }
    samples.sort((a, b) => Date.parse(a.provider_timestamp ?? a.captured_at) - Date.parse(b.provider_timestamp ?? b.captured_at) || a.snapshot_id.localeCompare(b.snapshot_id));
    if (!samples.length) continue;
    const evidence = samples.map(s => ({ observation_id: s.snapshot_id, source_id: 'dexscreener:robinhood:' + s.pair_address!.toLowerCase(), source_url: s.source_url!, observed_at: new Date(s.provider_timestamp ?? s.captured_at).toISOString(), collected_at: new Date(s.captured_at).toISOString(), time_basis: s.provider_timestamp ? 'PROVIDER_OBSERVATION' as const : 'COLLECTION_PROXY' as const,
      metrics: Object.fromEntries(RH_CHAIN_MARKET_METRICS.map(m => [m, typeof s[m] === 'number' && Number.isFinite(s[m]) ? s[m] : null])) }));
    const first = evidence[0], last = evidence.at(-1)!;
    const startGap = Date.parse(first.observed_at) - start, endGap = end - Date.parse(last.observed_at);
    const largestGap = Math.max(0, ...evidence.slice(1).map((r, i) => Date.parse(r.observed_at) - Date.parse(evidence[i].observed_at)));
    if (startGap > 1200000 || endGap > 1200000 || largestGap > 1200000) missing.add('INCOMPLETE_DAY_SAMPLING');
    if (evidence.some(r => r.time_basis === 'COLLECTION_PROXY')) missing.add('PROVIDER_OBSERVATION_TIME_UNAVAILABLE');
    const metrics = Object.fromEntries(RH_CHAIN_MARKET_METRICS.map(m => {
      const count = evidence.filter(r => r.metrics[m] !== null).length, a = first.metrics[m], b = last.metrics[m];
      if (count !== evidence.length) missing.add('METRIC_UNAVAILABLE:' + m);
      const canChange = evidence.length > 1 && count === evidence.length && !missing.has('CONTRADICTORY_DUPLICATE');
      return [m, { first: a, last: b, delta: canChange ? b! - a! : null, delta_pct: canChange && a !== 0 ? (b! / a! - 1) * 100 : null, covered_samples: count }];
    }));
    markets.push({ contract: key.split(':')[0], pair: group[0].pair_address!.toLowerCase(), observed_start: first.observed_at, observed_end: last.observed_at, metrics, evidence, coverage: { samples: samples.length, largest_gap_ms: largestGap, start_gap_ms: startGap, end_gap_ms: endGap, missing: [...missing].sort() } });
  }
  return { markets, excluded: [...excluded].sort() };
}
export class RhAutomatedObservationReceiptService {
  private readonly now: () => Date;
  constructor(private readonly deps: { store: AutomatedObservationStore; market: RhChainMarketSnapshotStore; days: Rh4663UtcDayObservationStore;
    now?: () => Date; requireDurable?: boolean; publicationEnabled?: boolean; productionAuthorization?: string | null }) { this.now = deps.now ?? (() => new Date()); }
  async finalize(day: string, correction?: { supersedes: string; reason: string }) {
    const now = this.now(), { start, end } = completedObservationDay(day, now);
    if (this.deps.requireDurable && (!this.deps.store.durable || !this.deps.market.durable || !this.deps.days.durable)) throw new Error('durable_observation_infrastructure_required');
    // A scheduler retry returns the frozen canonical edition before loading changed inputs.
    if (!correction) { const prior = (await this.deps.store.history(day)).find(r => !r.correction.supersedes); if (prior) { await this.publishIfEnabled(prior); return prior; } }
    if (correction && !correction.reason.trim()) throw new Error('correction_reason_required');
    if (!this.deps.market.editionInput) throw new Error('edition_history_capability_required');
    // A failed store read aborts; it must never freeze an apparent empty day.
    const [input, dayObservations] = await Promise.all([this.deps.market.editionInput(day), this.deps.days.current(day)]);
    const { markets, excluded } = marketRows(input.observations, start, end, now.getTime());
    const gaps = ['CORPORATE_ACTION_HISTORY_UNAVAILABLE', 'RWA_MECHANISM_EVIDENCE_UNAVAILABLE', 'VERIFIED_STABLE_SUPPLY_UNAVAILABLE'];
    if (!markets.length) gaps.push('NO_ELIGIBLE_MARKET_OBSERVATIONS');
    const chainMetrics = ['transactions_utc_day', 'dex_volume_utc_day_usd'].map(metric => {
      const matches = dayObservations.filter(o => o.chain_id === 4663 && o.metric === metric && o.status === 'FINAL' && o.window_type === 'UTC_CALENDAR_DAY'
        && Date.parse(o.window_start) === start && Date.parse(o.window_end) === end && Number.isFinite(o.value) && o.value >= 0
        && Number.isFinite(Date.parse(o.observed_at)) && Date.parse(o.fetched_at) <= now.getTime());
      const observation = matches.length === 1 ? matches[0] : null;
      if (!observation) gaps.push('FINAL_METRIC_UNAVAILABLE:' + metric);
      return { metric, value: observation?.value ?? null, observation };
    });
    const aggregates = input.aggregates.slice().sort((a, b) => (a.token_address + a.pair_address + a.bucket_start).localeCompare(b.token_address + b.pair_address + b.bucket_start)).filter(a => a.chain_id === 'robinhood' && a.provider === 'dexscreener');
    const retained = new Set(input.observations.map(o => o.snapshot_id));
    if (aggregates.some(a => a.snapshot_ids.some(id => !retained.has(id)))) gaps.push('RAW_SERIES_UNAVAILABLE_OR_OUTSIDE_OBSERVATION_DAY');
    const content = {
      object_type: 'AUTOMATED_OBSERVATION_RECEIPT' as const,
      edition_id: correction ? `rh-observation:4663:${day}:correction:${observationCommitment({ markets, chainMetrics, aggregates, correction })}` : `rh-observation:4663:${day}`,
      utc_day: day, chain_id: 4663 as const, window: { start: new Date(start).toISOString(), end: new Date(end).toISOString(), interval: '[start,end)' as const, timezone: 'UTC' as const },
      schema_version: AUTOMATED_OBSERVATION_SCHEMA, calculation_version: AUTOMATED_OBSERVATION_CALCULATION,
      covered_contracts: [...new Set(markets.map(m => m.contract))].sort(), markets, chain_metrics: chainMetrics,
      historical_coverage: { collection_day_aggregates: aggregates.map(a => ({ reference: `rh-market-history:${a.token_address}:${a.pair_address}:${a.bucket_start}`, sample_count: a.sample_count, observation_ids: [...a.snapshot_ids].sort(), window_start: a.bucket_start, window_end: a.bucket_end })).sort((a, b) => a.reference.localeCompare(b.reference)), missing: gaps.sort(), excluded_observation_ids: excluded },
      publication_state: 'FINALIZED_PRIVATE' as const, correction: { supersedes: correction?.supersedes ?? null, reason: correction?.reason ?? null }, execution_authorized: false as const
    };
    const receipt: AutomatedObservationReceipt = { ...content, content_hash: observationCommitment(content), commitment_algorithm: 'SHA-256' };
    const saved = await this.deps.store.finalize(receipt); await this.publishIfEnabled(saved); return saved;
  }
  private async publishIfEnabled(receipt: AutomatedObservationReceipt) {
    if (!this.deps.publicationEnabled) return;
    if (!this.deps.productionAuthorization?.trim() || !this.deps.store.durable) throw new Error('automatic_publication_authorization_required');
    await this.deps.store.publish(receipt.edition_id, this.deps.productionAuthorization);
  }
  async runCompletedDays() {
    const today = this.now().toISOString().slice(0, 10), yesterday = new Date(this.now().getTime() - 86400000).toISOString().slice(0, 10);
    if (!this.deps.market.completedDays) throw new Error('edition_history_capability_required');
    const dates = [...new Set([...(await this.deps.market.completedDays()), yesterday])].filter(d => d < today).sort();
    const receipts: AutomatedObservationReceipt[] = [];
    for (const date of dates) receipts.push(await this.finalize(date));
    return receipts;
  }
}
