/**
 * The 4663 Front Door is a read model. It never writes, re-scores, or mutates
 * canonical Radar, Watch, Census, Pulse, or receipt objects.
 */
import pg from 'pg';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';

export const RH_4663_FRONTDOOR_STATE = 'RH_4663_FRONTDOOR_STATE' as const;

export type FrontdoorEvidenceState = 'VERIFIED' | 'MIXED' | 'WATCH' | 'UNRESOLVED' | 'BLOCK' | 'DEGRADE' | 'INSUFFICIENT_DATA';
export type FrontdoorSourceHealth = { status: 'available' | 'degraded' | 'unavailable'; observed_at: string | null; detail?: string };
export type FrontdoorSourceRef = { source_type: string; source_id: string; href: string; observed_at: string | null };
export type FrontdoorCard = {
  id: string; topic: string; headline: string; summary: string; primary_metric: string; delta: string | null;
  evidence_state: FrontdoorEvidenceState; freshness: string | null; source_type: string; source_ref: FrontdoorSourceRef;
  deep_link: string; priority_reason: string;
};
export type OpenLoop = {
  loop_id: string; question: string; state: 'OPEN' | 'AWAITING_EVIDENCE' | 'WATCHING' | 'FALSIFICATION'; progress: string;
  opened_at: string; expected_resolution_at: string | null; current_evidence: string; next_evidence_needed: string; deep_link: string;
};
export type Rh4663FrontdoorState = {
  object_type: typeof RH_4663_FRONTDOOR_STATE; generated_at: string; freshness: { state: FrontdoorEvidenceState; source_observed_at: string | null };
  frontdoor_version: { object_type: 'FRONTDOOR_VERSION'; version: number; changed: string[]; generated_at: string };
  now_cards: FrontdoorCard[]; watch_cards: FrontdoorCard[]; open_loops: OpenLoop[];
  current_call: { window_id: string; state: string; leading_rotation: string | null; total_calls: number; opens_at: string; closes_at: string; deep_link: string; source_ref: FrontdoorSourceRef };
  proof_summary: { total_calls: number; resolved_calls: null; note: string; deep_link: string; source_ref: FrontdoorSourceRef };
  system_status: { state: 'available' | 'partial' | 'degraded'; source_health: Record<'census' | 'watch' | 'preflight' | 'pulse' | 'signals', FrontdoorSourceHealth> };
  source_refs: FrontdoorSourceRef[];
};

type Census = { census_id: string; observed_at: string; verified_pair_count: number; distinct_verified_stock_tickers: number; verification_coverage: { percentage: number }; category_evidence: { breadth_state: string; persistence_state: string }; persistent_rmm_penetration: { status: string } };
type WatchCase = { case_id: string; title: string; opened_at: string; updated_at: string; current_evidence_state: string; audit_priority: string; candidate_next_audit: string; open_evidence_gaps: string[]; falsification_notes: string[] };
type Watch = { generated_at: string; cases: WatchCase[]; feed: Array<{ case_id: string; case_title: string; key_claim: string; why_it_matters: string; last_updated: string; evidence_status: string; radar_state: string; next_proof_needed: string }>; falsification_queue: WatchCase[] };
type Preflight = { observation_id: string; observation: { observed_at: string; freshness: string } | null; readiness: { status: string; missing_prerequisites: string[] }; verified_mission_markets: unknown[]; data_gaps: string[] };
type Pulse = { window: { window_id: string; opens_at: string; closes_at: string }; consensus: { state: string; leading_rotation: string | null; total_calls: number } };
type Signal = { signal_id: string; headline: string; summary: string; category: string; significance_score: number; published_at: string; proof_url: string };

export type Rh4663FrontdoorDependencies = {
  census: () => Promise<Census | null>; watch: () => Promise<Watch>; preflight: () => Promise<Preflight | null>; pulse: () => Promise<Pulse>; signals: () => Promise<Signal[]>; now?: () => Date; ttl_ms?: number;
  version_store?: FrontdoorVersionStore;
};

export type FrontdoorVersionRecord = { fingerprint: string; sources: Record<string, string>; version: number };
export interface FrontdoorVersionStore { advance(fingerprint: string, sources: Record<string, string>): Promise<{ version: number; changed: string[] }>; }
export class InMemoryFrontdoorVersionStore implements FrontdoorVersionStore {
  private current: FrontdoorVersionRecord | null = null;
  async advance(fingerprint: string, sources: Record<string, string>) {
    const prior = this.current;
    if (prior?.fingerprint === fingerprint) return { version: prior.version, changed: [] };
    const changed = Object.keys(sources).filter((key) => !prior || prior.sources[key] !== sources[key]);
    const next = { fingerprint, sources: structuredClone(sources), version: (prior?.version ?? 0) + 1 }; this.current = next;
    return { version: next.version, changed };
  }
}
/** Durable singleton counter for production; the in-memory store remains the local/test fallback. */
export class PostgresFrontdoorVersionStore implements FrontdoorVersionStore {
  private readonly pool: pg.Pool; private readonly fallback = new InMemoryFrontdoorVersionStore(); private initialized: Promise<void> | null = null;
  constructor(source: PostgresPoolSource) { this.pool = resolvePostgresPool(source).pool; }
  async advance(fingerprint: string, sources: Record<string, string>) {
    try {
      await this.ensure(); const client = await this.pool.connect();
      try {
        await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-frontdoor-version'))");
        const prior = await client.query<{ fingerprint: string; sources: Record<string, string>; version: number }>('select fingerprint, sources, version from rh4663_frontdoor_version where singleton = true for update');
        const row = prior.rows[0]; if (row?.fingerprint === fingerprint) { await client.query('commit'); return { version: Number(row.version), changed: [] }; }
        const changed = Object.keys(sources).filter((key) => !row || row.sources[key] !== sources[key]); const version = Number(row?.version ?? 0) + 1;
        await client.query('insert into rh4663_frontdoor_version (singleton, fingerprint, sources, version) values (true, $1, $2::jsonb, $3) on conflict (singleton) do update set fingerprint = excluded.fingerprint, sources = excluded.sources, version = excluded.version, updated_at = now()', [fingerprint, JSON.stringify(sources), version]); await client.query('commit'); return { version, changed };
      } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
    } catch { return this.fallback.advance(fingerprint, sources); }
  }
  private ensure() { if (!this.initialized) this.initialized = this.pool.query('create table if not exists rh4663_frontdoor_version (singleton boolean primary key default true check (singleton), fingerprint text not null, sources jsonb not null, version bigint not null, updated_at timestamptz not null default now())').then(() => undefined).catch((error) => { this.initialized = null; throw error; }); return this.initialized; }
}

export class Rh4663FrontdoorService {
  private cached: { expires_at: number; state: Rh4663FrontdoorState } | null = null;
  private readonly now: () => Date;
  private readonly ttlMs: number;
  private readonly versions: FrontdoorVersionStore; private readonly fallbackVersions = new InMemoryFrontdoorVersionStore();
  constructor(private readonly deps: Rh4663FrontdoorDependencies) { this.now = deps.now ?? (() => new Date()); this.ttlMs = deps.ttl_ms ?? 15_000; this.versions = deps.version_store ?? new InMemoryFrontdoorVersionStore(); }
  async read() {
    const at = this.now();
    if (this.cached && this.cached.expires_at > at.getTime()) return structuredClone(this.cached.state);
    const [census, watch, preflight, pulse, signals] = await Promise.allSettled([this.deps.census(), this.deps.watch(), this.deps.preflight(), this.deps.pulse(), this.deps.signals()]);
    const state = assembleFrontdoor({
      now: at,
      census: census.status === 'fulfilled' ? census.value : null,
      watch: watch.status === 'fulfilled' ? watch.value : null,
      preflight: preflight.status === 'fulfilled' ? preflight.value : null,
      pulse: pulse.status === 'fulfilled' ? pulse.value : null,
      signals: signals.status === 'fulfilled' ? signals.value : null,
      failures: { census: failure(census), watch: failure(watch), preflight: failure(preflight), pulse: failure(pulse), signals: failure(signals) }
    });
    const sources = semanticSources(state);
    const fingerprint = JSON.stringify(sources);
    const version = await this.versions.advance(fingerprint, sources).catch(() => this.fallbackVersions.advance(fingerprint, sources));
    state.frontdoor_version = { object_type: 'FRONTDOOR_VERSION', version: version.version, changed: version.changed, generated_at: at.toISOString() };
    this.cached = { expires_at: at.getTime() + this.ttlMs, state };
    return structuredClone(state);
  }
}

function assembleFrontdoor(input: { now: Date; census: Census | null; watch: Watch | null; preflight: Preflight | null; pulse: Pulse | null; signals: Signal[] | null; failures: Record<'census' | 'watch' | 'preflight' | 'pulse' | 'signals', string | null> }): Rh4663FrontdoorState {
  const censusRef = input.census && ref('rmm_census', input.census.census_id, '/v1/4663/reflexive/census', input.census.observed_at);
  const preflightRef = input.preflight && ref('pltr_preflight', input.preflight.observation_id, `/v1/4663/reflexive/stocks/PLTR/preflight?observation_id=${encodeURIComponent(input.preflight.observation_id)}`, input.preflight.observation?.observed_at ?? null);
  const pulseRef = input.pulse && ref('pulse_window', input.pulse.window.window_id, `/v1/4663/pulse/windows/${encodeURIComponent(input.pulse.window.window_id)}`, input.pulse.window.opens_at);
  const watchObservedAt = input.watch?.cases.map((item) => item.updated_at).sort().at(-1) ?? null;
  const watchRef = input.watch && ref('reflexive_watch', `watch:${watchObservedAt ?? 'unavailable'}`, '/v1/4663/reflexive/watch', watchObservedAt);
  const signalRefs = (input.signals ?? []).map((signal) => ref('signal_card', signal.signal_id, signal.proof_url, signal.published_at));
  const health = {
    census: sourceHealth(input.census?.observed_at ?? null, input.failures.census, input.now), watch: sourceHealth(watchObservedAt, input.failures.watch, input.now), preflight: sourceHealth(input.preflight?.observation?.observed_at ?? null, input.failures.preflight, input.now), pulse: sourceHealth(input.pulse?.window.opens_at ?? null, input.failures.pulse, input.now), signals: sourceHealth((input.signals ?? []).map((item) => item.published_at).sort().at(-1) ?? null, input.failures.signals, input.now)
  };
  const candidates: Array<FrontdoorCard & { rank: readonly number[] }> = [];
  if (input.census && censusRef) candidates.push({ id: 'rmm-census', topic: 'RMM SPREADING', headline: `${input.census.verified_pair_count} stock-paired markets are verified.`, summary: `${input.census.distinct_verified_stock_tickers} canonical Stock Tokens have deterministic direct-market evidence. Breadth is not persistence.`, primary_metric: `${input.census.verified_pair_count} verified pairs`, delta: `${input.census.distinct_verified_stock_tickers} canonical tokens`, evidence_state: input.census.verification_coverage.percentage >= 100 ? 'VERIFIED' : 'MIXED', freshness: input.census.observed_at, source_type: censusRef.source_type, source_ref: censusRef, deep_link: '/4663/reflexive/census', priority_reason: 'Fresh persisted census with deterministic quote-direction verification; breadth is material but persistence remains separate.', rank: [freshnessRank(input.census.observed_at, input.now), 90, evidenceRank(input.census.verification_coverage.percentage >= 100 ? 'VERIFIED' : 'MIXED'), 2] });
  if (input.preflight && preflightRef) candidates.push({ id: 'pltr-preflight', topic: 'PLTR PREFLIGHT', headline: `PLTR is ${display(input.preflight.readiness.status)} for preflight.`, summary: input.preflight.readiness.missing_prerequisites.length ? input.preflight.readiness.missing_prerequisites[0] : 'The persisted state has the required evidence closure.', primary_metric: `${input.preflight.verified_mission_markets.length} verified mission markets`, delta: input.preflight.readiness.missing_prerequisites.length ? `${input.preflight.readiness.missing_prerequisites.length} gaps` : 'evidence closure', evidence_state: preflightState(input.preflight.readiness.status), freshness: input.preflight.observation?.observed_at ?? null, source_type: preflightRef.source_type, source_ref: preflightRef, deep_link: '/4663/reflexive/preflight/ipx-pltr', priority_reason: 'Persisted PLTR preflight state is a high-importance readiness boundary; it is never a launch recommendation.', rank: [freshnessRank(input.preflight.observation?.observed_at ?? null, input.now), 86, evidenceRank(preflightState(input.preflight.readiness.status)), 1] });
  for (const signal of input.signals ?? []) {
    const sourceRef = ref('signal_card', signal.signal_id, signal.proof_url, signal.published_at);
    candidates.push({ id: `signal:${signal.signal_id}`, topic: display(signal.category), headline: signal.headline, summary: signal.summary, primary_metric: `${signal.significance_score} significance`, delta: null, evidence_state: 'VERIFIED', freshness: signal.published_at, source_type: sourceRef.source_type, source_ref: sourceRef, deep_link: signal.proof_url, priority_reason: 'Published Signal Card with persisted evidence; ordered by explicit significance after freshness, never upside or engagement.', rank: [freshnessRank(signal.published_at, input.now), signal.significance_score, evidenceRank('VERIFIED'), 0] });
  }
  const nowCards = candidates.sort(compareCards).slice(0, 5).map(({ rank: _rank, ...card }) => card);
  const watchCards = watchCardsFrom(input.watch, watchRef).slice(0, 4);
  const openLoops = openLoopsFrom(input.census, censusRef, input.watch, watchRef, input.preflight, preflightRef).slice(0, 4);
  const refs = [censusRef, watchRef, preflightRef, pulseRef, ...signalRefs].filter((item): item is FrontdoorSourceRef => Boolean(item));
  const observed = refs.map((item) => item.observed_at).filter((item): item is string => Boolean(item)).sort().at(-1) ?? null;
  const unavailable = Object.values(health).filter((item) => item.status === 'unavailable').length;
  const degraded = Object.values(health).filter((item) => item.status === 'degraded').length;
  const system = unavailable || degraded ? (refs.length ? 'partial' : 'degraded') : 'available';
  const defaultPulse = { window: { window_id: 'unavailable', opens_at: input.now.toISOString(), closes_at: input.now.toISOString() }, consensus: { state: 'unavailable', leading_rotation: null, total_calls: 0 } };
  const current = input.pulse ?? defaultPulse;
  const callRef = pulseRef ?? ref('pulse_window', current.window.window_id, '/4663/pulse', null);
  return { object_type: RH_4663_FRONTDOOR_STATE, generated_at: input.now.toISOString(), freshness: { state: unavailable ? 'DEGRADE' : freshnessState(observed, input.now), source_observed_at: observed }, frontdoor_version: { object_type: 'FRONTDOOR_VERSION', version: 0, changed: [], generated_at: input.now.toISOString() }, now_cards: nowCards, watch_cards: watchCards, open_loops: openLoops, current_call: { window_id: current.window.window_id, state: current.consensus.state, leading_rotation: current.consensus.leading_rotation, total_calls: current.consensus.total_calls, opens_at: current.window.opens_at, closes_at: current.window.closes_at, deep_link: '/4663/pulse', source_ref: callRef }, proof_summary: { total_calls: current.consensus.total_calls, resolved_calls: null, note: 'Personal proof is available after a signed CALL; this read model does not infer a wallet record.', deep_link: '/4663/receipts', source_ref: callRef }, system_status: { state: system, source_health: health }, source_refs: refs };
}

function semanticSources(state: Rh4663FrontdoorState) {
  const loops = state.open_loops.map(loopFingerprint);
  return {
    RMM_CENSUS: JSON.stringify({ cards: state.now_cards.filter((card) => card.source_type === 'rmm_census').map(cardFingerprint), loops: loops.filter((loop) => loop.deep_link === '/4663/reflexive/census') }),
    WATCH_CASES: JSON.stringify(state.watch_cards.map(cardFingerprint)),
    AI_NVDA_CASE: JSON.stringify({ cards: state.watch_cards.filter((card) => card.id.includes('AI_NVDA')).map(cardFingerprint), loops: loops.filter((loop) => loop.loop_id.includes('AI_NVDA')) }),
    PLTR_PREFLIGHT: JSON.stringify({ cards: state.now_cards.filter((card) => card.id.includes('pltr')).map(cardFingerprint), loops: loops.filter((loop) => loop.deep_link === '/4663/reflexive/preflight/ipx-pltr') }),
    SIGNALS: JSON.stringify(state.now_cards.filter((card) => card.source_type === 'signal_card').map(cardFingerprint)),
    PULSE: JSON.stringify({ current_call: state.current_call, proof_summary: state.proof_summary }),
    SYSTEM: JSON.stringify(state.system_status.source_health)
  };
}
function cardFingerprint(card: FrontdoorCard) { return { id: card.id, topic: card.topic, headline: card.headline, summary: card.summary, primary_metric: card.primary_metric, delta: card.delta, evidence_state: card.evidence_state, freshness: card.freshness, source: card.source_ref.source_id, deep_link: card.deep_link }; }
function loopFingerprint(loop: OpenLoop) { return { loop_id: loop.loop_id, question: loop.question, state: loop.state, progress: loop.progress, opened_at: loop.opened_at, expected_resolution_at: loop.expected_resolution_at, current_evidence: loop.current_evidence, next_evidence_needed: loop.next_evidence_needed, deep_link: loop.deep_link }; }

function watchCardsFrom(watch: Watch | null, watchRef: FrontdoorSourceRef | null) {
  if (!watch || !watchRef) return [];
  const falsified = new Set(watch.falsification_queue.map((item) => item.case_id));
  return watch.feed.map((item) => ({ id: `watch:${item.case_id}`, topic: falsified.has(item.case_id) ? 'FALSIFICATION' : 'DEVELOPING', headline: item.case_title, summary: item.why_it_matters || item.key_claim, primary_metric: item.radar_state, delta: null, evidence_state: watchState(item.radar_state, item.evidence_status), freshness: item.last_updated, source_type: watchRef.source_type, source_ref: { ...watchRef, source_id: item.case_id, href: `/v1/4663/reflexive/watch/cases/${encodeURIComponent(item.case_id)}`, observed_at: item.last_updated }, deep_link: `/4663/reflexive/watch/${encodeURIComponent(item.case_id)}`, priority_reason: falsified.has(item.case_id) ? 'Falsification evidence is surfaced before confirmation.' : 'Developing Watch case with an explicit next proof requirement.' })).sort((a, b) => b.freshness.localeCompare(a.freshness) || a.id.localeCompare(b.id));
}

function openLoopsFrom(census: Census | null, censusRef: FrontdoorSourceRef | null, watch: Watch | null, watchRef: FrontdoorSourceRef | null, preflight: Preflight | null, preflightRef: FrontdoorSourceRef | null): OpenLoop[] {
  const loops: OpenLoop[] = [];
  if (watch && watchRef) for (const item of watch.cases.filter((candidate) => /AI.*NVDA|NVDA.*AI/i.test(candidate.case_id + candidate.title)).slice(0, 1)) loops.push({ loop_id: `loop:${item.case_id}`, question: 'Will AI/NVDA retain NVDA capital through D7?', state: 'AWAITING_EVIDENCE', progress: item.current_evidence_state, opened_at: item.opened_at, expected_resolution_at: null, current_evidence: item.current_evidence_state, next_evidence_needed: item.candidate_next_audit, deep_link: `/4663/reflexive/watch/${encodeURIComponent(item.case_id)}` });
  if (census && censusRef) loops.push({ loop_id: `loop:${census.census_id}`, question: 'Are stock-paired markets actually spreading?', state: census.persistent_rmm_penetration.status === 'AVAILABLE' ? 'WATCHING' : 'AWAITING_EVIDENCE', progress: census.category_evidence.breadth_state, opened_at: census.observed_at, expected_resolution_at: null, current_evidence: `${census.verified_pair_count} verified direct pairs; ${census.category_evidence.persistence_state}.`, next_evidence_needed: 'Observed D7 persistence for verified direct pairs.', deep_link: '/4663/reflexive/census' });
  if (preflight && preflightRef) loops.push({ loop_id: `loop:${preflight.observation_id}`, question: 'Is PLTR deep enough for an Infopunks market?', state: preflight.readiness.status === 'READY_FOR_SIMULATION' ? 'WATCHING' : 'AWAITING_EVIDENCE', progress: preflight.readiness.status, opened_at: preflight.observation?.observed_at ?? preflightRef.observed_at ?? new Date(0).toISOString(), expected_resolution_at: null, current_evidence: `${preflight.verified_mission_markets.length} verified mission markets.`, next_evidence_needed: preflight.readiness.missing_prerequisites[0] ?? 'A new persisted preflight observation.', deep_link: '/4663/reflexive/preflight/ipx-pltr' });
  return loops;
}

function ref(source_type: string, source_id: string, href: string, observed_at: string | null): FrontdoorSourceRef { return { source_type, source_id, href, observed_at }; }
function failure(result: PromiseSettledResult<unknown>) { return result.status === 'rejected' ? (result.reason instanceof Error ? result.reason.message : 'source_unavailable') : null; }
function sourceHealth(observed_at: string | null, issue: string | null, now: Date): FrontdoorSourceHealth { if (issue) return { status: 'unavailable', observed_at, detail: issue }; if (!observed_at) return { status: 'degraded', observed_at: null, detail: 'No persisted observation is available.' }; return freshnessState(observed_at, now) === 'DEGRADE' ? { status: 'degraded', observed_at, detail: 'Latest persisted observation is stale.' } : { status: 'available', observed_at }; }
function freshnessState(value: string | null, now: Date): FrontdoorEvidenceState { if (!value || !Number.isFinite(Date.parse(value))) return 'INSUFFICIENT_DATA'; const age = Math.max(0, now.getTime() - Date.parse(value)); return age > 6 * 3_600_000 ? 'DEGRADE' : age > 15 * 60_000 ? 'MIXED' : 'VERIFIED'; }
function freshnessRank(value: string | null, now: Date) { const at = value ? Date.parse(value) : NaN; if (!Number.isFinite(at)) return 0; const age = Math.max(0, now.getTime() - at); return age < 15 * 60_000 ? 3 : age < 6 * 3_600_000 ? 2 : 1; }
function evidenceRank(state: FrontdoorEvidenceState) { return state === 'VERIFIED' ? 3 : state === 'MIXED' ? 2 : state === 'WATCH' ? 1 : 0; }
function compareCards(a: { rank: readonly number[]; id: string }, b: { rank: readonly number[]; id: string }) { for (let index = 0; index < Math.max(a.rank.length, b.rank.length); index += 1) { const difference = (b.rank[index] ?? 0) - (a.rank[index] ?? 0); if (difference) return difference; } return a.id.localeCompare(b.id); }
function display(value: string) { return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function preflightState(value: string): FrontdoorEvidenceState { return value === 'READY_FOR_SIMULATION' ? 'VERIFIED' : value === 'PARTIAL' ? 'MIXED' : value === 'NOT_READY' ? 'BLOCK' : 'INSUFFICIENT_DATA'; }
function watchState(radar: string, evidence: string): FrontdoorEvidenceState { return radar === 'VERIFIED' ? 'VERIFIED' : radar === 'PARTIAL' ? 'MIXED' : evidence.includes('UNRESOLVED') ? 'UNRESOLVED' : 'WATCH'; }
