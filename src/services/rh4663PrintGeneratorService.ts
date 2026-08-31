import pg from 'pg';
import { createHash } from 'node:crypto';
import { RetryablePostgresSchema, resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import type { Rh4663Print, Rh4663PrintDriver, Rh4663PrintLayerRead, Rh4663PrintMetric } from './rh4663PrintService';

export const RH_4663_PRINT_GENERATOR_VERSION = 'rh4663.print-generator.v1' as const;
export const RH_4663_PRINT_METHODOLOGY_VERSION = 'rh4663.print-methodology.v1' as const;

export type Rh4663ObservationWindow = 'UTC_CALENDAR_DAY' | 'ROLLING_24H' | 'LIVE_SNAPSHOT' | 'HISTORICAL_FINAL' | 'THIRD_PARTY_REPORTED' | 'ESTIMATE';
export type Rh4663ObservationFreshness = 'LIVE' | 'RECENT' | 'STALE' | 'HISTORICAL_FINAL' | 'UNAVAILABLE';
export type Rh4663PrintRegime = 'SPECULATIVE_EXPANSION' | 'RWA_EXPANSION' | 'STABLECOIN_EXPANSION' | 'BROAD_EXPANSION' | 'CONTRACTION' | 'MIXED' | 'INSUFFICIENT_EVIDENCE';
export type Rh4663PrintLayerState = 'VERY HOT' | 'HOT' | 'CONSTRUCTIVE' | 'NEUTRAL' | 'QUIET' | 'WEAK' | 'INSUFFICIENT DATA';

/** A provider/cache observation before any editorial memory is created. Null is never used as a disguised zero. */
export type Rh4663VerifiedObservation = {
  observation_id: string;
  chain_id: 4663;
  metric: string;
  value: number;
  unit: 'USD' | 'COUNT' | 'PERCENT' | 'MARKETS';
  provider: string;
  source_url: string;
  observed_at: string;
  fetched_at: string;
  window_start: string;
  window_end: string;
  window_type: Rh4663ObservationWindow;
  methodology: string;
  freshness: Rh4663ObservationFreshness;
  confidence: number;
  status: 'PROVISIONAL' | 'FINAL';
  notes?: string;
};

export type Rh4663PrintDisagreement = {
  metric: string;
  kind: 'DIFFERENT_WINDOW' | 'SOURCE_DISAGREEMENT';
  observation_ids: string[];
  note: string;
};

export type Rh4663PrintCandidate = {
  candidate_id: string;
  date: string;
  lifecycle: 'CANDIDATE' | 'READY';
  generated_at: string;
  generator_version: typeof RH_4663_PRINT_GENERATOR_VERSION;
  methodology_version: typeof RH_4663_PRINT_METHODOLOGY_VERSION;
  observations: Rh4663VerifiedObservation[];
  regime: Rh4663PrintRegime;
  regime_rules: string[];
  layer_read: Array<{ layer: Rh4663PrintLayerRead['layer']; state: Rh4663PrintLayerState; evidence_ids: string[]; explanation: string }>;
  completeness: { required: string[]; present: string[]; missing: string[]; ratio: number };
  freshness: Rh4663ObservationFreshness;
  warnings: string[];
  disagreements: Rh4663PrintDisagreement[];
  qualification_notes: string[];
  fingerprint: string;
};

export interface Rh4663PrintStore {
  readonly adapter: 'memory' | 'postgres';
  readonly durable: boolean;
  freeze(print: Rh4663Print): Promise<Rh4663Print>;
  get(printId: string): Promise<Rh4663Print | null>;
  list(limit?: number): Promise<Rh4663Print[]>;
}

export class InMemoryRh4663PrintStore implements Rh4663PrintStore {
  readonly adapter = 'memory' as const;
  readonly durable = false;
  private readonly prints = new Map<string, Rh4663Print>();
  async freeze(print: Rh4663Print) { if (this.prints.has(print.print_id)) throw new Rh4663PrintGeneratorError('print_already_frozen', 409); this.prints.set(print.print_id, structuredClone(print)); return structuredClone(print); }
  async get(printId: string) { const print = this.prints.get(printId); return print ? structuredClone(print) : null; }
  async list(limit = 100) { return [...this.prints.values()].sort((a, b) => b.canonical_path.localeCompare(a.canonical_path)).slice(0, limit).map((print) => structuredClone(print)); }
}

export class PostgresRh4663PrintStore implements Rh4663PrintStore {
  readonly adapter = 'postgres' as const;
  readonly durable = true;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private readonly schema = new RetryablePostgresSchema('rh_4663_frozen_print_store');
  constructor(source: PostgresPoolSource) { const resolved = resolvePostgresPool(source); this.pool = resolved.pool; this.ownsPool = resolved.ownsPool; }
  async freeze(print: Rh4663Print) { await this.ready(); try { await this.pool.query('insert into rh_4663_frozen_prints (print_id, canonical_path, frozen_at, payload) values ($1,$2,$3,$4::jsonb)', [print.print_id, print.canonical_path, print.printed_at, JSON.stringify(print)]); return structuredClone(print); } catch (error) { if ((error as { code?: string }).code === '23505') throw new Rh4663PrintGeneratorError('print_already_frozen', 409); throw error; } }
  async get(printId: string) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663Print }>('select payload from rh_4663_frozen_prints where print_id=$1', [printId]); return result.rows[0]?.payload ?? null; }
  async list(limit = 100) { await this.ready(); const result = await this.pool.query<{ payload: Rh4663Print }>('select payload from rh_4663_frozen_prints order by canonical_path desc limit $1', [limit]); return result.rows.map((row) => row.payload); }
  async close() { if (this.ownsPool) await this.pool.end(); }
  private ready() { return this.schema.ensure(this.pool, 'create table if not exists rh_4663_frozen_prints (print_id text primary key, canonical_path text not null unique, frozen_at timestamptz not null, payload jsonb not null); create index if not exists rh_4663_frozen_prints_path_idx on rh_4663_frozen_prints (canonical_path desc);'); }
}

export class Rh4663PrintGeneratorError extends Error { constructor(readonly code: string, readonly statusCode: number) { super(code); } }

export type Rh4663PrintGeneratorOptions = {
  observations: (date?: string) => Promise<{ observations: Rh4663VerifiedObservation[]; warnings?: string[] }>;
  store: Rh4663PrintStore;
  now?: () => Date;
  log?: (entry: Record<string, unknown>) => void;
};

export class Rh4663PrintGeneratorService {
  private readonly now: () => Date;
  private readonly log: (entry: Record<string, unknown>) => void;
  constructor(private readonly options: Rh4663PrintGeneratorOptions) { this.now = options.now ?? (() => new Date()); this.log = options.log ?? ((entry) => console.log(JSON.stringify(entry))); }

  async candidate(date?: string): Promise<Rh4663PrintCandidate> {
    const source = await this.options.observations(date);
    const generatedAt = this.now().toISOString();
    const candidateDate = date ?? source.observations.map((item) => item.window_end.slice(0, 10)).sort().at(-1) ?? generatedAt.slice(0, 10);
    const observations = source.observations.filter((item) => Number.isFinite(item.value)).sort((a, b) => a.observation_id.localeCompare(b.observation_id));
    const disagreements = detectDisagreements(observations);
    const required = ['transactions_utc_day', 'dex_volume_utc_day_usd'];
    const present = required.filter((metric) => observations.some((item) => item.metric === metric && item.freshness !== 'STALE'));
    const missing = required.filter((metric) => !present.includes(metric));
    const regime = classifyRegime(observations);
    const layers = classifyLayers(observations);
    const requiredGap = (metric: string) => metric === 'transactions_utc_day' ? 'MISSING_FINAL_UTC_TRANSACTIONS' : metric === 'dex_volume_utc_day_usd' ? 'MISSING_FINAL_UTC_DEX_VOLUME' : `MISSING_REQUIRED_OBSERVATION:${metric}`;
    const warnings = [...(source.warnings ?? []), ...missing.map(requiredGap), ...disagreements.filter((item) => item.kind === 'SOURCE_DISAGREEMENT').map((item) => `Provider disagreement requires review: ${item.metric}.`)];
    const lifecycle = missing.length === 0 && observations.every((item) => item.freshness !== 'STALE' && item.freshness !== 'UNAVAILABLE') && !disagreements.some((item) => item.kind === 'SOURCE_DISAGREEMENT') ? 'READY' as const : 'CANDIDATE' as const;
    const base = { candidate_id: `rh-print-candidate-${candidateDate}`, date: candidateDate, lifecycle, generated_at: generatedAt, generator_version: RH_4663_PRINT_GENERATOR_VERSION, methodology_version: RH_4663_PRINT_METHODOLOGY_VERSION, observations, regime, regime_rules: regimeRules(regime, observations), layer_read: layers, completeness: { required, present, missing, ratio: required.length ? present.length / required.length : 0 }, freshness: aggregateFreshness(observations), warnings, disagreements, qualification_notes: qualificationNotes(observations, disagreements) };
    const candidate = { ...base, fingerprint: fingerprint(base) };
    this.log({ event: 'rh4663_print_candidate_generated', candidate_id: candidate.candidate_id, lifecycle: candidate.lifecycle, observation_count: observations.length, missing: missing.length, disagreements: disagreements.length });
    if (candidate.lifecycle === 'CANDIDATE') this.log({ event: 'rh4663_print_candidate_incomplete', candidate_id: candidate.candidate_id, warnings: candidate.warnings });
    for (const disagreement of disagreements.filter((item) => item.kind === 'SOURCE_DISAGREEMENT')) this.log({ event: 'rh4663_print_provider_disagreement', candidate_id: candidate.candidate_id, metric: disagreement.metric, observation_ids: disagreement.observation_ids });
    return candidate;
  }

  async freeze(candidate: Rh4663PrintCandidate, expectedFingerprint: string): Promise<Rh4663Print> {
    if (candidate.lifecycle !== 'READY') throw new Rh4663PrintGeneratorError('print_candidate_not_ready', 409);
    if (candidate.fingerprint !== expectedFingerprint) throw new Rh4663PrintGeneratorError('print_candidate_changed', 409);
    const print = frozenPrint(candidate, this.now().toISOString());
    const saved = await this.options.store.freeze(print);
    this.log({ event: 'rh4663_print_frozen', print_id: saved.print_id, candidate_id: candidate.candidate_id, observation_count: candidate.observations.length });
    return saved;
  }

  async get(printId: string) { return this.options.store.get(printId); }
  async list(limit?: number) { return this.options.store.list(limit); }
  async latest() { return (await this.list(1))[0] ?? null; }
}

function classifyRegime(observations: Rh4663VerifiedObservation[]): Rh4663PrintRegime {
  const byMetric = metricMap(observations); const memeShare = byMetric.get('meme_dex_share_percent')?.value; const rwaShare = byMetric.get('rwa_dex_share_percent')?.value;
  if (observations.length < 2) return 'INSUFFICIENT_EVIDENCE';
  if (memeShare !== undefined && memeShare >= 50 && byMetric.has('dex_volume_utc_day_usd')) return 'SPECULATIVE_EXPANSION';
  if (rwaShare !== undefined && rwaShare >= 50 && byMetric.has('dex_volume_utc_day_usd')) return 'RWA_EXPANSION';
  if (byMetric.has('stablecoin_market_cap_usd') && byMetric.has('tvl_usd') && byMetric.has('dex_volume_utc_day_usd')) return 'BROAD_EXPANSION';
  return 'MIXED';
}

function regimeRules(regime: Rh4663PrintRegime, observations: Rh4663VerifiedObservation[]) {
  const values = metricMap(observations);
  if (regime === 'SPECULATIVE_EXPANSION') return ['meme_dex_share_percent >= 50', 'dex_volume_utc_day_usd verified'];
  if (regime === 'RWA_EXPANSION') return ['rwa_dex_share_percent >= 50', 'dex_volume_utc_day_usd verified'];
  if (regime === 'BROAD_EXPANSION') return ['tvl_usd verified', 'stablecoin_market_cap_usd verified', 'dex_volume_utc_day_usd verified'];
  if (regime === 'INSUFFICIENT_EVIDENCE') return ['fewer than two verified observations'];
  return [`${values.size} verified observations; no dominance rule satisfied`];
}

function classifyLayers(observations: Rh4663VerifiedObservation[]): Rh4663PrintCandidate['layer_read'] {
  const values = metricMap(observations); const layer = (name: Rh4663PrintLayerRead['layer'], state: Rh4663PrintLayerState, metrics: string[], explanation: string) => ({ layer: name, state, evidence_ids: metrics.flatMap((metric) => observations.filter((item) => item.metric === metric).map((item) => item.observation_id)), explanation });
  const memeShare = values.get('meme_dex_share_percent')?.value;
  return [
    layer('MEMES', memeShare !== undefined && memeShare >= 50 ? 'VERY HOT' : values.has('meme_volume_24h_usd') ? 'HOT' : 'INSUFFICIENT DATA', ['meme_dex_share_percent', 'meme_volume_24h_usd'], memeShare !== undefined ? 'Measured against the selected DEX window.' : 'No verified meme share of chain DEX activity is available.'),
    layer('INFRASTRUCTURE', values.has('perp_market_count') ? 'CONSTRUCTIVE' : 'INSUFFICIENT DATA', ['perp_market_count'], values.has('perp_market_count') ? 'Verified market-availability observation.' : 'No reliable infrastructure observation was supplied.'),
    layer('RWA / STOCK TOKENS', values.get('rwa_dex_share_percent')?.value !== undefined ? 'HOT' : 'INSUFFICIENT DATA', ['rwa_dex_share_percent'], values.has('rwa_dex_share_percent') ? 'Measured against the selected DEX window.' : 'No verified RWA or stock-token share is available.'),
    layer('AGENTS', 'INSUFFICIENT DATA', [], 'General chain activity is not treated as agent activity.'),
    layer('STABLECOINS / TVL', values.has('stablecoin_market_cap_usd') || values.has('tvl_usd') ? 'CONSTRUCTIVE' : 'INSUFFICIENT DATA', ['stablecoin_market_cap_usd', 'tvl_usd'], values.has('stablecoin_market_cap_usd') || values.has('tvl_usd') ? 'Verified capital-base context is available.' : 'No verified stablecoin or TVL observation is available.')
  ];
}

function detectDisagreements(observations: Rh4663VerifiedObservation[]): Rh4663PrintDisagreement[] {
  const groups = new Map<string, Rh4663VerifiedObservation[]>();
  for (const item of observations) groups.set(item.metric, [...(groups.get(item.metric) ?? []), item]);
  const disagreements: Rh4663PrintDisagreement[] = [];
  for (const [metric, values] of groups.entries()) {
    if (values.length < 2) continue;
    const windows = new Set(values.map((item) => `${item.window_type}:${item.window_start}:${item.window_end}`));
    if (windows.size > 1) { disagreements.push({ metric, kind: 'DIFFERENT_WINDOW', observation_ids: values.map((item) => item.observation_id), note: 'Observations have different declared windows and are not treated as a direct contradiction.' }); continue; }
    const min = Math.min(...values.map((item) => item.value)); const max = Math.max(...values.map((item) => item.value));
    if (min > 0 && (max - min) / min > 0.05) disagreements.push({ metric, kind: 'SOURCE_DISAGREEMENT', observation_ids: values.map((item) => item.observation_id), note: 'Same metric and window differ by more than 5%; review is required.' });
  }
  return disagreements;
}

function aggregateFreshness(observations: Rh4663VerifiedObservation[]): Rh4663ObservationFreshness { if (!observations.length) return 'UNAVAILABLE'; if (observations.some((item) => item.freshness === 'UNAVAILABLE')) return 'UNAVAILABLE'; if (observations.some((item) => item.freshness === 'STALE')) return 'STALE'; if (observations.every((item) => item.freshness === 'HISTORICAL_FINAL')) return 'HISTORICAL_FINAL'; if (observations.some((item) => item.freshness === 'LIVE')) return 'LIVE'; return 'RECENT'; }
function qualificationNotes(observations: Rh4663VerifiedObservation[], disagreements: Rh4663PrintDisagreement[]) { return [...new Set([...observations.filter((item) => item.window_type !== 'UTC_CALENDAR_DAY').map((item) => `${item.metric} uses ${item.window_type}; it is not a UTC calendar-day value.`), ...disagreements.map((item) => item.note)])]; }
function metricMap(observations: Rh4663VerifiedObservation[]) { return new Map(observations.map((item) => [item.metric, item])); }
function fingerprint(value: unknown) { return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
function format(value: number, unit: Rh4663VerifiedObservation['unit']) { if (unit === 'USD') return `$${value >= 1e9 ? (value / 1e9).toFixed(2) : value >= 1e6 ? (value / 1e6).toFixed(2) : value.toFixed(0)}${value >= 1e9 ? 'B' : value >= 1e6 ? 'M' : ''}`; if (unit === 'COUNT') return value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : String(Math.round(value)); return String(value); }
function printMetric(item: Rh4663VerifiedObservation): Rh4663PrintMetric { return { id: item.metric, label: item.metric.replaceAll('_', ' ').toUpperCase(), value: format(item.value, item.unit), unit: item.unit, source: { label: item.provider, href: item.source_url }, window_type: item.window_type === 'UTC_CALENDAR_DAY' ? 'utc_calendar_day' : item.window_type === 'ROLLING_24H' ? 'rolling_24h' : 'historical_reported_range', observed_at: item.observed_at, window_start: item.window_start, window_end: item.window_end, methodology: item.methodology, freshness: item.freshness === 'HISTORICAL_FINAL' ? 'reported' : item.freshness === 'LIVE' ? 'observed' : 'derived', confidence: item.confidence }; }
function frozenPrint(candidate: Rh4663PrintCandidate, frozenAt: string): Rh4663Print {
  const id = `rh-print-${candidate.date}`; const drivers: Rh4663PrintDriver[] = candidate.layer_read.map((item) => ({ category: item.layer === 'INFRASTRUCTURE' ? 'INFRA' : item.layer === 'RWA / STOCK TOKENS' ? 'RWA' : item.layer === 'STABLECOINS / TVL' ? 'STABLES' : item.layer, direction: item.state === 'VERY HOT' ? '↑↑↑' : item.state === 'HOT' || item.state === 'CONSTRUCTIVE' ? '↑' : '→', detail: item.explanation }));
  return { print_id: id, canonical_path: `/4663/print/${candidate.date}`, printed_at: frozenAt, status: 'frozen', receipt_kind: 'MARKET_STATE_EVIDENCE', campaign_snapshot: false, data_mode: 'verified_provider_snapshot', title: `${candidate.regime.replaceAll('_', ' ')} / ROBINHOOD CHAIN`, regime: candidate.regime.replaceAll('_', ' '), methodology_notice: `Frozen from ${candidate.observations.length} accepted observations under ${candidate.methodology_version}.`, correction_notice: candidate.qualification_notes.join(' '), metrics: candidate.observations.map(printMetric), drivers, layer_read: candidate.layer_read.map((item) => ({ layer: item.layer, state: item.state === 'INSUFFICIENT DATA' ? 'BACKGROUND' : item.state === 'VERY HOT' ? 'VERY HOT' : item.state === 'CONSTRUCTIVE' ? 'CONSTRUCTIVE' : 'QUIETER THIS WINDOW', direction: item.state === 'VERY HOT' ? '↑↑↑' : item.state === 'CONSTRUCTIVE' ? '↑' : '→', explanation: item.explanation, evidence_ids: item.evidence_ids })), evidence_references: candidate.observations.map((item) => ({ id: item.observation_id, label: `${item.provider} / ${item.metric}`, href: item.source_url, note: `${item.window_type}; ${item.methodology}` })), campaign_copy: { primary: 'LIVE DATA CHANGES.', secondary: 'MARKET MEMORY DOES NOT.', call_to_action: 'WHAT OWNS THE NEXT 24 HOURS?', receipt_line: 'EVERYONE HAS AN OPINION. INFOPUNKS HAS THE RECEIPT.' }, share: { landscape: `/og/4663/prints/${id}.png`, square: `/og/4663/prints/${id}.png?format=square`, portrait: `/og/4663/prints/${id}.png?format=portrait` }, interpretation: `${candidate.regime.replaceAll('_', ' ')} was selected by deterministic, inspectable rules.`, call: { question: 'Which category wins the next observation window?', evidence_path: `/4663/print/${candidate.date}`, default_confidence: 70 }, frozen_memory: { created_at: candidate.generated_at, frozen_at: frozenAt, generator_version: candidate.generator_version, methodology_version: candidate.methodology_version, accepted_observations: candidate.observations.map((item) => structuredClone(item)), qualification_notes: [...candidate.qualification_notes] } };
}
