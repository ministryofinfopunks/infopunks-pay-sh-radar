/**
 * The 4663 Front Door is a read model. It never writes, re-scores, or mutates
 * canonical Radar, Watch, Census, Pulse, or receipt objects.
 */
import pg from 'pg';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';

export const RH_4663_FRONTDOOR_STATE = 'RH_4663_FRONTDOOR_STATE' as const;
export type FrontdoorVersionDurability = 'PERSISTENT' | 'EPHEMERAL';

export type FrontdoorEvidenceState = 'VERIFIED' | 'MIXED' | 'WATCH' | 'UNRESOLVED' | 'BLOCK' | 'DEGRADE' | 'INSUFFICIENT_DATA';
export type FrontdoorSourceHealth = { status: 'available' | 'degraded' | 'unavailable'; observed_at: string | null; detail?: string };
export type FrontdoorSourceRef = { source_type: string; source_id: string; href: string; observed_at: string | null };
export type FrontdoorCard = {
  id: string; topic: string; headline: string; summary: string; primary_metric: string; delta: string | null;
  evidence_state: FrontdoorEvidenceState; freshness: string | null; source_type: string; source_ref: FrontdoorSourceRef;
  deep_link: string; priority_reason: string;
};
export const FRONTDOOR_OPEN_LOOP_STATES = ['OPEN', 'OBSERVING', 'VERIFYING', 'AWAITING_CHECKPOINT', 'PARTIALLY_RESOLVED', 'RESOLVED', 'FALSIFIED', 'BLOCKED_BY_DATA', 'STALE'] as const;
export type FrontdoorOpenLoopState = typeof FRONTDOOR_OPEN_LOOP_STATES[number];
export type OpenLoopProgress =
  | { type: 'COUNT'; numerator: number; denominator: number; label: string }
  | { type: 'TIME_TO_CHECKPOINT'; checkpoint_at: string; seconds_remaining: number | null; label: string }
  | { type: 'STATE_SEQUENCE'; current: string; sequence: string[]; label: string }
  | { type: 'NONE'; label: 'AWAITING EVIDENCE' };
export type OpenLoop = {
  loop_id: string; question: string; short_context: string; source_type: string; source_ref: FrontdoorSourceRef;
  state: FrontdoorOpenLoopState; opened_at: string; last_changed_at: string; expected_checkpoint_at: string | null;
  /** Compatibility alias retained for older consumers; Phase 5 uses expected_checkpoint_at. */
  expected_resolution_at: null; progress: OpenLoopProgress; current_evidence: string; next_evidence_needed: string;
  resolution_condition: string; falsification_condition: string | null; deep_link: string; priority_reason: string;
};
export const FRONTDOOR_CHANGE_TYPES = ['NEW', 'UPDATED', 'STATE_TRANSITION', 'CHECKPOINT_REACHED', 'RESOLVED', 'FALSIFIED', 'EVIDENCE_ADDED', 'COVERAGE_CHANGED', 'VERDICT_CHANGED'] as const;
export type FrontdoorChangeType = typeof FRONTDOOR_CHANGE_TYPES[number];
export type FrontdoorChangeEvent = {
  object_type: 'FRONTDOOR_CHANGE_EVENT'; event_id: string; frontdoor_version: number; occurred_at: string; source_type: string;
  source_ref: FrontdoorSourceRef; change_type: FrontdoorChangeType; headline: string; before: Record<string, unknown> | null;
  after: Record<string, unknown>; importance: number; deep_link: string; source_observed_at: string | null;
};
export type Rh4663FrontdoorState = {
  object_type: typeof RH_4663_FRONTDOOR_STATE; generated_at: string; freshness: { state: FrontdoorEvidenceState; source_observed_at: string | null };
  frontdoor_version: { object_type: 'FRONTDOOR_VERSION'; version: number; changed: string[]; generated_at: string };
  frontdoor_version_durability: FrontdoorVersionDurability;
  now_cards: FrontdoorCard[]; watch_cards: FrontdoorCard[]; open_loops: OpenLoop[]; change_events: FrontdoorChangeEvent[];
  current_call: { window_id: string; state: string; leading_rotation: string | null; total_calls: number; opens_at: string; closes_at: string; resolution_state?: string | null; resolved_category?: string | null; deep_link: string; source_ref: FrontdoorSourceRef };
  proof_summary: { total_calls: number; resolved_calls: null; note: string; deep_link: string; source_ref: FrontdoorSourceRef };
  system_status: { state: 'available' | 'partial' | 'degraded'; source_health: Record<'census' | 'watch' | 'preflight' | 'pulse' | 'signals', FrontdoorSourceHealth> };
  source_refs: FrontdoorSourceRef[];
};

type Census = { census_id: string; observed_at: string; verified_pair_count: number; distinct_verified_stock_tickers: number; verification_coverage: { percentage: number }; category_evidence: { breadth_state: string; persistence_state: string }; persistent_rmm_penetration: { status: string }; source_claims?: { claimed_pair_count: number; parsed_pair_count?: number }; pairs?: Array<{ verification_state?: string }> };
type WatchCase = { case_id: string; title: string; opened_at: string; updated_at: string; current_evidence_state: string; audit_priority: string; candidate_next_audit: string; open_evidence_gaps: string[]; falsification_notes: string[]; research_observations?: Array<{ status?: string; target_at?: string | null; h2b_verdict?: string; d7?: { timestamp?: string | null } | null; change?: Record<string, unknown> }> };
type Watch = { generated_at: string; cases: WatchCase[]; feed: Array<{ case_id: string; case_title: string; key_claim: string; why_it_matters: string; last_updated: string; evidence_status: string; radar_state: string; next_proof_needed: string }>; falsification_queue: WatchCase[] };
type Preflight = { observation_id: string; observation: { observed_at: string; freshness: string } | null; readiness: { status: string; missing_prerequisites: string[] }; verified_mission_markets: unknown[]; data_gaps: string[] };
type Pulse = { window: { window_id: string; opens_at: string; closes_at: string }; state?: string; consensus: { state: string; leading_rotation: string | null; total_calls: number }; resolution?: { state: string; resolved_category: string | null; published_at: string | null } | null };
type Signal = { signal_id: string; headline: string; summary: string; category: string; significance_score: number; published_at: string; proof_url: string };

export type Rh4663FrontdoorDependencies = {
  census: () => Promise<Census | null>; watch: () => Promise<Watch>; preflight: () => Promise<Preflight | null>; pulse: () => Promise<Pulse>; signals: () => Promise<Signal[]>; now?: () => Date; ttl_ms?: number;
  version_store?: FrontdoorVersionStore;
  change_event_store?: FrontdoorChangeEventStore;
  shadow?: () => Promise<ShadowObservation | null>;
  require_durable_version?: boolean;
  /**
   * The public Pulse summary may contain live call counts, but a single
   * person's accepted CALL is private state. Production passes this switch so
   * the shared FRONTDOOR_VERSION only moves for global Pulse transitions.
   */
  ignore_personal_pulse_changes?: boolean;
};

export type FrontdoorVersionRecord = { fingerprint: string; sources: Record<string, string>; version: number };
export type ShadowObservation = { last_refresh_at?: string | null; latest_ready_snapshot?: { observation_id: string; observed_at: string | null } | null; ready_snapshot_count: number; evidence_window?: { satisfied: boolean; minimum_ready_snapshots: number; target_calendar_days?: readonly number[] }; candidates?: Record<string, { verdict: string | null; previous_verdict: string | null; ready_snapshot_count: number }>; next_action?: string };
export interface FrontdoorVersionStore {
  readonly durability: FrontdoorVersionDurability;
  advance(fingerprint: string, sources: Record<string, string>): Promise<{ version: number; changed: string[]; previous_sources?: Record<string, string> }>;
}
export interface FrontdoorChangeEventStore {
  append(events: FrontdoorChangeEvent[]): Promise<void>;
  recent(limit?: number): Promise<FrontdoorChangeEvent[]>;
}
export class InMemoryFrontdoorVersionStore implements FrontdoorVersionStore {
  private current: FrontdoorVersionRecord | null = null;
  readonly durability = 'EPHEMERAL' as const;
  async advance(fingerprint: string, sources: Record<string, string>) {
    const prior = this.current;
    if (prior?.fingerprint === fingerprint) return { version: prior.version, changed: [], previous_sources: prior.sources };
    const changed = Object.keys(sources).filter((key) => !prior || prior.sources[key] !== sources[key]);
    const next = { fingerprint, sources: structuredClone(sources), version: (prior?.version ?? 0) + 1 }; this.current = next;
    return { version: next.version, changed, previous_sources: prior?.sources };
  }
}
export class InMemoryFrontdoorChangeEventStore implements FrontdoorChangeEventStore {
  private events = new Map<string, FrontdoorChangeEvent>();
  async append(events: FrontdoorChangeEvent[]) { for (const event of events) this.events.set(event.event_id, structuredClone(event)); }
  async recent(limit = 60) { return [...this.events.values()].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.event_id.localeCompare(a.event_id)).slice(0, limit).map((item) => structuredClone(item)); }
}
/** Durable singleton counter for production; the in-memory store remains the local/test fallback. */
export class PostgresFrontdoorVersionStore implements FrontdoorVersionStore {
  private readonly pool: pg.Pool; private readonly fallback = new InMemoryFrontdoorVersionStore(); private readonly allowEphemeralFallback: boolean; private initialized: Promise<void> | null = null; private fallbackActive = false;
  constructor(source: PostgresPoolSource, options: { allow_ephemeral_fallback?: boolean } = {}) { this.pool = resolvePostgresPool(source).pool; this.allowEphemeralFallback = options.allow_ephemeral_fallback ?? true; }
  get durability(): FrontdoorVersionDurability { return this.fallbackActive ? 'EPHEMERAL' : 'PERSISTENT'; }
  async advance(fingerprint: string, sources: Record<string, string>) {
    if (this.fallbackActive) return this.fallback.advance(fingerprint, sources);
    try {
      await this.ensure(); const client = await this.pool.connect();
      try {
        await client.query('begin'); await client.query("select pg_advisory_xact_lock(hashtext('rh4663-frontdoor-version'))");
        const prior = await client.query<{ fingerprint: string; sources: Record<string, string>; version: number }>('select fingerprint, sources, version from rh4663_frontdoor_version where singleton = true for update');
        const row = prior.rows[0]; if (row?.fingerprint === fingerprint) { await client.query('commit'); return { version: Number(row.version), changed: [], previous_sources: row.sources }; }
        const changed = Object.keys(sources).filter((key) => !row || row.sources[key] !== sources[key]); const version = Number(row?.version ?? 0) + 1;
        await client.query('insert into rh4663_frontdoor_version (singleton, fingerprint, sources, version) values (true, $1, $2::jsonb, $3) on conflict (singleton) do update set fingerprint = excluded.fingerprint, sources = excluded.sources, version = excluded.version, updated_at = now()', [fingerprint, JSON.stringify(sources), version]); await client.query('commit'); return { version, changed, previous_sources: row?.sources };
      } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
    } catch (error) {
      if (!this.allowEphemeralFallback) throw error;
      this.fallbackActive = true;
      return this.fallback.advance(fingerprint, sources);
    }
  }
  private ensure() { if (!this.initialized) this.initialized = this.pool.query('create table if not exists rh4663_frontdoor_version (singleton boolean primary key default true check (singleton), fingerprint text not null, sources jsonb not null, version bigint not null, updated_at timestamptz not null default now())').then(() => undefined).catch((error) => { this.initialized = null; throw error; }); return this.initialized; }
}

/** Durable bounded memory of meaningful public changes. It never stores CALL or wallet state. */
export class PostgresFrontdoorChangeEventStore implements FrontdoorChangeEventStore {
  private readonly pool: pg.Pool; private initialized: Promise<void> | null = null;
  constructor(source: PostgresPoolSource) { this.pool = resolvePostgresPool(source).pool; }
  async append(events: FrontdoorChangeEvent[]) {
    if (!events.length) return;
    await this.ensure(); const client = await this.pool.connect();
    try { await client.query('begin'); for (const event of events) await client.query('insert into rh4663_frontdoor_change_events (event_id, frontdoor_version, occurred_at, source_type, source_ref, change_type, headline, before_value, after_value, importance, deep_link, source_observed_at) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12) on conflict (event_id) do nothing', [event.event_id, event.frontdoor_version, event.occurred_at, event.source_type, JSON.stringify(event.source_ref), event.change_type, event.headline, JSON.stringify(event.before), JSON.stringify(event.after), event.importance, event.deep_link, event.source_observed_at]); await client.query("delete from rh4663_frontdoor_change_events where occurred_at < now() - interval '30 days'"); await client.query('commit'); }
    catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
  }
  async recent(limit = 60) { await this.ensure(); const result = await this.pool.query<FrontdoorChangeEvent>('select event_id, frontdoor_version, occurred_at, source_type, source_ref, change_type, headline, before_value as before, after_value as after, importance, deep_link, source_observed_at from rh4663_frontdoor_change_events order by occurred_at desc, event_id desc limit $1', [Math.min(200, Math.max(1, limit))]); return result.rows.map((row) => ({ ...row, object_type: 'FRONTDOOR_CHANGE_EVENT' as const })); }
  private ensure() { if (!this.initialized) this.initialized = this.pool.query('create table if not exists rh4663_frontdoor_change_events (event_id text primary key, frontdoor_version bigint not null, occurred_at timestamptz not null, source_type text not null, source_ref jsonb not null, change_type text not null, headline text not null, before_value jsonb, after_value jsonb not null, importance integer not null, deep_link text not null, source_observed_at timestamptz); create index if not exists rh4663_frontdoor_change_events_version_idx on rh4663_frontdoor_change_events (frontdoor_version desc); create index if not exists rh4663_frontdoor_change_events_occurred_idx on rh4663_frontdoor_change_events (occurred_at desc)').then(() => undefined).catch((error) => { this.initialized = null; throw error; }); return this.initialized; }
}

export class Rh4663FrontdoorService {
  private cached: { expires_at: number; state: Rh4663FrontdoorState } | null = null;
  private readonly now: () => Date;
  private readonly ttlMs: number;
  private readonly versions: FrontdoorVersionStore;
  private readonly requireDurableVersion: boolean;
  private readonly changeEvents: FrontdoorChangeEventStore;
  constructor(private readonly deps: Rh4663FrontdoorDependencies) { this.now = deps.now ?? (() => new Date()); this.ttlMs = deps.ttl_ms ?? 15_000; this.versions = deps.version_store ?? new InMemoryFrontdoorVersionStore(); this.changeEvents = deps.change_event_store ?? new InMemoryFrontdoorChangeEventStore(); this.requireDurableVersion = deps.require_durable_version ?? false; }
  async read() {
    const at = this.now();
    if (this.cached && this.cached.expires_at > at.getTime()) return structuredClone(this.cached.state);
    if (this.requireDurableVersion && this.versions.durability !== 'PERSISTENT') throw new Rh4663FrontdoorError('frontdoor_version_durability_required', 503);
    const [census, watch, preflight, pulse, signals, shadow] = await Promise.allSettled([this.deps.census(), this.deps.watch(), this.deps.preflight(), this.deps.pulse(), this.deps.signals(), this.deps.shadow?.() ?? Promise.resolve(null)]);
    const state = assembleFrontdoor({
      now: at,
      census: census.status === 'fulfilled' ? census.value : null,
      watch: watch.status === 'fulfilled' ? watch.value : null,
      preflight: preflight.status === 'fulfilled' ? preflight.value : null,
      pulse: pulse.status === 'fulfilled' ? pulse.value : null,
      signals: signals.status === 'fulfilled' ? signals.value : null,
      shadow: shadow.status === 'fulfilled' ? shadow.value : null,
      failures: { census: failure(census), watch: failure(watch), preflight: failure(preflight), pulse: failure(pulse), signals: failure(signals) }
    });
    const sources = semanticSources(state, this.deps.ignore_personal_pulse_changes ?? false);
    const fingerprint = JSON.stringify(sources);
    let version: { version: number; changed: string[]; previous_sources?: Record<string, string> };
    try {
      version = await this.versions.advance(fingerprint, sources);
    } catch (error) {
      if (this.requireDurableVersion) throw new Rh4663FrontdoorError('frontdoor_version_durability_required', 503);
      throw error;
    }
    if (this.requireDurableVersion && this.versions.durability !== 'PERSISTENT') throw new Rh4663FrontdoorError('frontdoor_version_durability_required', 503);
    state.frontdoor_version = { object_type: 'FRONTDOOR_VERSION', version: version.version, changed: version.changed, generated_at: at.toISOString() };
    state.frontdoor_version_durability = this.versions.durability;
    try {
      if (version.changed.length) await this.changeEvents.append(buildChangeEvents(version.version, version.previous_sources, semanticSources(state, this.deps.ignore_personal_pulse_changes ?? false), state, at));
      state.change_events = await this.changeEvents.recent();
    } catch {
      // Change history is a return-habit enhancement; it must never take down NOW/WATCH/LOOPS.
      state.change_events = [];
    }
    this.cached = { expires_at: at.getTime() + this.ttlMs, state };
    return structuredClone(state);
  }
}

export class Rh4663FrontdoorError extends Error {
  constructor(readonly code: string, readonly statusCode: number) { super(code); }
}

function assembleFrontdoor(input: { now: Date; census: Census | null; watch: Watch | null; preflight: Preflight | null; pulse: Pulse | null; signals: Signal[] | null; shadow: ShadowObservation | null; failures: Record<'census' | 'watch' | 'preflight' | 'pulse' | 'signals', string | null> }): Rh4663FrontdoorState {
  const censusRef = input.census && ref('rmm_census', input.census.census_id, '/v1/4663/reflexive/census', input.census.observed_at);
  const preflightRef = input.preflight && ref('pltr_preflight', input.preflight.observation_id, `/v1/4663/reflexive/stocks/PLTR/preflight?observation_id=${encodeURIComponent(input.preflight.observation_id)}`, input.preflight.observation?.observed_at ?? null);
  const pulseRef = input.pulse && ref('pulse_window', input.pulse.window.window_id, `/v1/4663/pulse/windows/${encodeURIComponent(input.pulse.window.window_id)}`, input.pulse.window.opens_at);
  const watchObservedAt = input.watch?.cases.map((item) => item.updated_at).sort().at(-1) ?? null;
  const watchRef = input.watch && ref('reflexive_watch', `watch:${watchObservedAt ?? 'unavailable'}`, '/v1/4663/reflexive/watch', watchObservedAt);
  const shadowRef = input.shadow && ref('pltr_shadow', input.shadow.latest_ready_snapshot?.observation_id ?? 'shadow-status', '/v1/4663/reflexive/preflight/ipx-pltr/shadow/status', input.shadow.latest_ready_snapshot?.observed_at ?? input.shadow.last_refresh_at ?? null);
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
  const openLoops = rankOpenLoops(openLoopsFrom(input.census, censusRef, input.watch, watchRef, input.preflight, preflightRef, input.pulse, pulseRef, input.shadow, input.now), input.now).filter((loop) => !['RESOLVED', 'FALSIFIED'].includes(loop.state)).slice(0, 4);
  const refs = [censusRef, watchRef, preflightRef, shadowRef, pulseRef, ...signalRefs].filter((item): item is FrontdoorSourceRef => Boolean(item));
  const observed = refs.map((item) => item.observed_at).filter((item): item is string => Boolean(item)).sort().at(-1) ?? null;
  const unavailable = Object.values(health).filter((item) => item.status === 'unavailable').length;
  const degraded = Object.values(health).filter((item) => item.status === 'degraded').length;
  const system = unavailable || degraded ? (refs.length ? 'partial' : 'degraded') : 'available';
  const defaultPulse: Pulse = { window: { window_id: 'unavailable', opens_at: input.now.toISOString(), closes_at: input.now.toISOString() }, state: 'unavailable', consensus: { state: 'unavailable', leading_rotation: null, total_calls: 0 }, resolution: null };
  const current = input.pulse ?? defaultPulse;
  const callRef = pulseRef ?? ref('pulse_window', current.window.window_id, '/4663/pulse', null);
  return { object_type: RH_4663_FRONTDOOR_STATE, generated_at: input.now.toISOString(), freshness: { state: unavailable ? 'DEGRADE' : freshnessState(observed, input.now), source_observed_at: observed }, frontdoor_version: { object_type: 'FRONTDOOR_VERSION', version: 0, changed: [], generated_at: input.now.toISOString() }, frontdoor_version_durability: 'EPHEMERAL', now_cards: nowCards, watch_cards: watchCards, open_loops: openLoops, change_events: [], current_call: { window_id: current.window.window_id, state: current.state ?? current.consensus.state, leading_rotation: current.consensus.leading_rotation, total_calls: current.consensus.total_calls, opens_at: current.window.opens_at, closes_at: current.window.closes_at, resolution_state: current.resolution?.state ?? null, resolved_category: current.resolution?.resolved_category ?? null, deep_link: '/4663/pulse', source_ref: callRef }, proof_summary: { total_calls: current.consensus.total_calls, resolved_calls: null, note: 'Personal proof is available after a signed CALL; this read model does not infer a wallet record.', deep_link: '/4663/receipts', source_ref: callRef }, system_status: { state: system, source_health: health }, source_refs: refs };
}

function semanticSources(state: Rh4663FrontdoorState, ignorePersonalPulseChanges = false) {
  const loops = state.open_loops.map(loopFingerprint);
  return {
    RMM_CENSUS: JSON.stringify({ cards: state.now_cards.filter((card) => card.source_type === 'rmm_census').map(cardFingerprint), loops: loops.filter((loop) => loop.deep_link === '/4663/reflexive/census') }),
    WATCH_CASES: JSON.stringify(state.watch_cards.map(cardFingerprint)),
    AI_NVDA_CASE: JSON.stringify({ cards: state.watch_cards.filter((card) => card.id.includes('AI_NVDA')).map(cardFingerprint), loops: loops.filter((loop) => loop.loop_id.includes('AI_NVDA')) }),
    PLTR_PREFLIGHT: JSON.stringify({ cards: state.now_cards.filter((card) => card.id.includes('pltr')).map(cardFingerprint), loops: loops.filter((loop) => loop.deep_link === '/4663/reflexive/preflight/ipx-pltr') }),
    PLTR_SHADOW: JSON.stringify(loops.filter((loop) => loop.source_type === 'IPX_PLTR_SHADOW')),
    SIGNALS: JSON.stringify(state.now_cards.filter((card) => card.source_type === 'signal_card').map(cardFingerprint)),
    PULSE: JSON.stringify(ignorePersonalPulseChanges
      ? { window_id: state.current_call.window_id, opens_at: state.current_call.opens_at, closes_at: state.current_call.closes_at, state: state.current_call.state, resolution_state: state.current_call.resolution_state, resolved_category: state.current_call.resolved_category }
      : { current_call: state.current_call, proof_summary: state.proof_summary }),
    SYSTEM: JSON.stringify(state.system_status.source_health)
  };
}
function cardFingerprint(card: FrontdoorCard) { return { id: card.id, topic: card.topic, headline: card.headline, summary: card.summary, primary_metric: card.primary_metric, delta: card.delta, evidence_state: card.evidence_state, freshness: card.freshness, source: card.source_ref.source_id, deep_link: card.deep_link }; }
function loopFingerprint(loop: OpenLoop) { return { loop_id: loop.loop_id, question: loop.question, source_type: loop.source_type, state: loop.state, progress: loop.progress, opened_at: loop.opened_at, expected_checkpoint_at: loop.expected_checkpoint_at, current_evidence: loop.current_evidence, next_evidence_needed: loop.next_evidence_needed, deep_link: loop.deep_link }; }

function countProgress(numerator: number, denominator: number, noun: string): OpenLoopProgress { return { type: 'COUNT', numerator: Math.max(0, numerator), denominator: Math.max(0, denominator), label: `${Math.max(0, numerator)} / ${Math.max(0, denominator)} ${noun}` }; }
function timeProgress(checkpointAt: string, now: Date, label: string): OpenLoopProgress { const checkpoint = Date.parse(checkpointAt); const remaining = Number.isFinite(checkpoint) ? Math.round((checkpoint - now.getTime()) / 1000) : null; return { type: 'TIME_TO_CHECKPOINT', checkpoint_at: checkpointAt, seconds_remaining: remaining === null ? null : Math.max(0, remaining), label: remaining !== null && remaining > 0 ? `${label} IN ${formatDuration(remaining)}` : `${label} REACHED` }; }
function stateProgress(current: string, sequence: string[], label: string): OpenLoopProgress { return { type: 'STATE_SEQUENCE', current, sequence, label: `${label}: ${current}` }; }
function formatDuration(seconds: number) { const days = Math.floor(seconds / 86_400); const hours = Math.floor((seconds % 86_400) / 3_600); return days ? `${days}D` : `${hours}H`; }
function mapLoopState(value: string): FrontdoorOpenLoopState { if (value === 'FALSIFIED') return 'FALSIFIED'; if (value === 'VERIFIED' || value === 'PARTIALLY_VERIFIED') return 'PARTIALLY_RESOLVED'; if (value === 'NOT_REPRODUCIBLE' || value === 'INSUFFICIENT_DATA') return 'BLOCKED_BY_DATA'; if (value === 'VERIFYING') return 'VERIFYING'; return 'OBSERVING'; }
function loopRank(loop: OpenLoop, now: Date): readonly number[] {
  const importance: Record<string, number> = { AI_NVDA_CAPITAL_VS_FLOW: 100, RMM_CATEGORY_CENSUS: 96, IPX_PLTR_SHADOW: 92, BONER_HIMS_FLOAT_STRESS: 90, PULSE: 86 };
  const unresolved = ['OPEN', 'OBSERVING', 'VERIFYING', 'AWAITING_CHECKPOINT', 'BLOCKED_BY_DATA', 'STALE'].includes(loop.state) ? 1 : 0;
  const checkpoint = loop.expected_checkpoint_at ? Date.parse(loop.expected_checkpoint_at) : NaN; const proximity = Number.isFinite(checkpoint) && checkpoint >= now.getTime() ? Math.max(0, 30 - Math.floor((checkpoint - now.getTime()) / 86_400_000)) : 0;
  const evidence = loop.state === 'FALSIFIED' ? 4 : loop.state === 'PARTIALLY_RESOLVED' ? 3 : loop.state === 'VERIFYING' ? 2 : loop.state === 'BLOCKED_BY_DATA' ? 1 : 0;
  return [unresolved, importance[loop.source_type] ?? 50, loop.state === 'FALSIFIED' ? 100 : 0, proximity, evidence, freshnessRank(loop.last_changed_at, now)];
}
function rankOpenLoops(loops: OpenLoop[], now: Date) { return [...loops].sort((a, b) => compareCards({ id: a.loop_id, rank: loopRank(a, now) }, { id: b.loop_id, rank: loopRank(b, now) })); }

function buildChangeEvents(version: number, beforeSources: Record<string, string> | undefined, afterSources: Record<string, string>, state: Rh4663FrontdoorState, occurredAt: Date): FrontdoorChangeEvent[] {
  return Object.keys(afterSources).filter((key) => !beforeSources || beforeSources[key] !== afterSources[key]).map((key) => {
    const descriptor = changeDescriptor(key, state); const before = parseObject(beforeSources?.[key]); const after = parseObject(afterSources[key]) ?? {};
    const changeType = before === null ? 'NEW' : changeTypeFor(key, before, after, state);
    return { object_type: 'FRONTDOOR_CHANGE_EVENT' as const, event_id: `frontdoor-change:${version}:${key}`, frontdoor_version: version, occurred_at: occurredAt.toISOString(), source_type: descriptor.source_type, source_ref: descriptor.source_ref, change_type: changeType, headline: descriptor.headline, before, after, importance: descriptor.importance, deep_link: descriptor.deep_link, source_observed_at: descriptor.source_ref.observed_at };
  });
}
function parseObject(value: string | undefined): Record<string, unknown> | null { if (!value) return null; try { const parsed = JSON.parse(value) as unknown; return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null; } catch { return null; } }
function changeTypeFor(key: string, before: Record<string, unknown>, after: Record<string, unknown>, state: Rh4663FrontdoorState): FrontdoorChangeType { if (key === 'PULSE' && (after.current_call as Record<string, unknown> | undefined)?.resolution_state && (after.current_call as Record<string, unknown> | undefined)?.resolution_state !== (before.current_call as Record<string, unknown> | undefined)?.resolution_state) return 'RESOLVED'; if (key === 'RMM_CENSUS' && Array.isArray(before.loops) && (!Array.isArray(after.loops) || after.loops.length === 0)) return 'RESOLVED'; const aiFalsified = state.open_loops.some((loop) => loop.source_type === 'AI_NVDA_CAPITAL_VS_FLOW' && loop.state === 'FALSIFIED') || state.watch_cards.some((card) => card.id.includes('AI_NVDA') && card.topic === 'FALSIFICATION'); if ((key === 'WATCH_CASES' && state.watch_cards.some((card) => card.topic === 'FALSIFICATION')) || (key === 'AI_NVDA_CASE' && aiFalsified)) return 'FALSIFIED'; if (key === 'AI_NVDA_CASE' && after.loops && before.loops && JSON.stringify(after.loops).includes('FALSIFIED') && !JSON.stringify(before.loops).includes('FALSIFIED')) return 'FALSIFIED'; if (key === 'RMM_CENSUS') return 'COVERAGE_CHANGED'; if (key === 'PLTR_SHADOW') return 'EVIDENCE_ADDED'; if (key === 'WATCH_CASES' || key === 'AI_NVDA_CASE') return 'STATE_TRANSITION'; return 'UPDATED'; }
function changeDescriptor(key: string, state: Rh4663FrontdoorState): { source_type: string; source_ref: FrontdoorSourceRef; headline: string; importance: number; deep_link: string } {
  const find = (type: string, href: string) => state.source_refs.find((item) => item.source_type === type) ?? ref(type, key, href, null);
  if (key === 'RMM_CENSUS') return { source_type: 'RMM_CATEGORY_CENSUS', source_ref: find('rmm_census', '/v1/4663/reflexive/census'), headline: 'RMM Census updated', importance: 96, deep_link: '/4663/reflexive/census' };
  if (key === 'AI_NVDA_CASE') return { source_type: 'AI_NVDA_CAPITAL_VS_FLOW', source_ref: find('reflexive_watch', '/v1/4663/reflexive/watch/AI_NVDA_CAPITAL_VS_FLOW'), headline: 'AI/NVDA state changed', importance: 100, deep_link: '/4663/reflexive/watch/AI_NVDA_CAPITAL_VS_FLOW' };
  if (key === 'PLTR_SHADOW') return { source_type: 'IPX_PLTR_SHADOW', source_ref: find('pltr_shadow', '/v1/4663/reflexive/preflight/ipx-pltr/shadow/status'), headline: 'PLTR Shadow Observation updated', importance: 92, deep_link: '/4663/reflexive/preflight/ipx-pltr/shadow/status' };
  if (key === 'PULSE') return { source_type: 'PULSE', source_ref: find('pulse_window', '/4663/pulse'), headline: state.current_call.resolution_state ? 'Pulse resolved' : 'Pulse window changed', importance: 86, deep_link: '/4663/pulse' };
  if (key === 'WATCH_CASES') return { source_type: 'REFLEXIVE_WATCH', source_ref: find('reflexive_watch', '/v1/4663/reflexive/watch'), headline: 'Watch case state changed', importance: 90, deep_link: '/4663/reflexive/watch' };
  if (key === 'SIGNALS') return { source_type: 'SIGNAL_CARD', source_ref: find('signal_card', '/4663/signals'), headline: 'New signal evidence added', importance: 70, deep_link: '/4663/signals' };
  return { source_type: 'FRONTDOOR', source_ref: ref('frontdoor', 'system', '/4663', null), headline: 'Frontdoor coverage changed', importance: 40, deep_link: '/4663' };
}

function watchCardsFrom(watch: Watch | null, watchRef: FrontdoorSourceRef | null) {
  if (!watch || !watchRef) return [];
  const falsified = new Set(watch.falsification_queue.map((item) => item.case_id));
  return watch.feed.map((item) => ({ id: `watch:${item.case_id}`, topic: falsified.has(item.case_id) ? 'FALSIFICATION' : 'DEVELOPING', headline: item.case_title, summary: item.why_it_matters || item.key_claim, primary_metric: item.radar_state, delta: null, evidence_state: watchState(item.radar_state, item.evidence_status), freshness: item.last_updated, source_type: watchRef.source_type, source_ref: { ...watchRef, source_id: item.case_id, href: `/v1/4663/reflexive/watch/cases/${encodeURIComponent(item.case_id)}`, observed_at: item.last_updated }, deep_link: `/4663/reflexive/watch/${encodeURIComponent(item.case_id)}`, priority_reason: falsified.has(item.case_id) ? 'Falsification evidence is surfaced before confirmation.' : 'Developing Watch case with an explicit next proof requirement.' })).sort((a, b) => b.freshness.localeCompare(a.freshness) || a.id.localeCompare(b.id));
}

function openLoopsFrom(census: Census | null, censusRef: FrontdoorSourceRef | null, watch: Watch | null, watchRef: FrontdoorSourceRef | null, preflight: Preflight | null, preflightRef: FrontdoorSourceRef | null, pulse: Pulse | null, pulseRef: FrontdoorSourceRef | null, shadow: ShadowObservation | null, now: Date): OpenLoop[] {
  const loops: OpenLoop[] = [];
  const make = (input: Omit<OpenLoop, 'expected_resolution_at'>): OpenLoop => ({ ...input, expected_resolution_at: null });
  const ai = watch?.cases.find((candidate) => /AI.*NVDA|NVDA.*AI/i.test(candidate.case_id + candidate.title));
  if (ai && watchRef) {
    const audit = ai.research_observations?.[0]; const observed = audit?.status === 'OBSERVED'; const falsified = audit?.h2b_verdict === 'FALSIFYING_EVIDENCE' || ai.current_evidence_state === 'FALSIFIED'; const checkpoint = audit?.target_at ?? null;
    loops.push(make({ loop_id: `loop:${ai.case_id}`, question: 'Will NVDA remain AI\'s capital anchor through the D7 checkpoint?', short_context: 'AI/NVDA capital persistence is tested against same-block inventory, supply, and quote topology.', source_type: 'AI_NVDA_CAPITAL_VS_FLOW', source_ref: { ...watchRef, source_id: ai.case_id, href: `/v1/4663/reflexive/watch/cases/${encodeURIComponent(ai.case_id)}`, observed_at: ai.updated_at }, state: falsified ? 'FALSIFIED' : observed ? 'PARTIALLY_RESOLVED' : checkpoint && Date.parse(checkpoint) <= now.getTime() ? 'VERIFYING' : checkpoint ? 'AWAITING_CHECKPOINT' : 'OBSERVING', opened_at: ai.opened_at, last_changed_at: ai.updated_at, expected_checkpoint_at: checkpoint, progress: checkpoint ? timeProgress(checkpoint, now, 'D7 CHECKPOINT') : stateProgress(ai.current_evidence_state, ['OBSERVING', 'VERIFYING', 'D7'], 'AI/NVDA'), current_evidence: audit?.h2b_verdict ?? ai.current_evidence_state, next_evidence_needed: ai.candidate_next_audit, resolution_condition: 'D7 aligned evidence shows retained NVDA capital under the frozen audit policy.', falsification_condition: 'Aligned D7 evidence crosses the precommitted capital-retention and stock-share falsification band.', deep_link: `/4663/reflexive/watch/${encodeURIComponent(ai.case_id)}`, priority_reason: 'High-importance cross-market persistence question with explicit falsification criteria.' }));
  }
  if (census && censusRef) {
    const denominator = census.source_claims?.claimed_pair_count ?? Math.max(census.verified_pair_count, 1); const evaluated = census.source_claims?.parsed_pair_count ?? census.pairs?.length ?? census.verified_pair_count; const state: FrontdoorOpenLoopState = census.verified_pair_count >= denominator ? 'RESOLVED' : evaluated >= denominator ? 'VERIFYING' : 'OPEN';
    loops.push(make({ loop_id: `loop:${census.census_id}`, question: 'How many claimed direct Stock Token narrative markets can Radar independently verify?', short_context: 'RMM breadth remains separate from persistence; a claimed pair is not a verified market.', source_type: 'RMM_CATEGORY_CENSUS', source_ref: censusRef, state, opened_at: census.observed_at, last_changed_at: census.observed_at, expected_checkpoint_at: null, progress: countProgress(evaluated, denominator, 'claims evaluated'), current_evidence: `${census.verified_pair_count} verified direct pairs; ${census.category_evidence.breadth_state}.`, next_evidence_needed: 'Resolve remaining claimed pair identities and quote direction.', resolution_condition: 'The claimed direct-market denominator has been independently evaluated with deterministic quote direction.', falsification_condition: 'A claimed market cannot be reproduced under the census methodology.', deep_link: '/4663/reflexive/census', priority_reason: 'High-importance coverage question with direct falsification value and a defined claim denominator.' }));
  }
  const boner = watch?.cases.find((candidate) => /BONER.*HIMS|HIMS.*BONER/i.test(candidate.case_id + candidate.title));
  if (boner && watchRef) loops.push(make({ loop_id: `loop:${boner.case_id}`, question: 'Can the historical HIMS absorption claim be independently reproduced?', short_context: 'The historical claim remains an audit target until exact pool and same-timestamp supply evidence exists.', source_type: 'BONER_HIMS_FLOAT_STRESS', source_ref: { ...watchRef, source_id: boner.case_id, href: `/v1/4663/reflexive/watch/cases/${encodeURIComponent(boner.case_id)}`, observed_at: boner.updated_at }, state: boner.current_evidence_state === 'FALSIFIED' ? 'FALSIFIED' : boner.current_evidence_state === 'NOT_REPRODUCIBLE' ? 'BLOCKED_BY_DATA' : mapLoopState(boner.current_evidence_state), opened_at: boner.opened_at, last_changed_at: boner.updated_at, expected_checkpoint_at: null, progress: { type: 'NONE', label: 'AWAITING EVIDENCE' }, current_evidence: boner.current_evidence_state, next_evidence_needed: boner.candidate_next_audit, resolution_condition: 'Exact historical pool state and same-timestamp HIMS totalSupply reproduce the claim.', falsification_condition: 'The exact historical state or claim cannot be reproduced.', deep_link: `/4663/reflexive/watch/${encodeURIComponent(boner.case_id)}`, priority_reason: 'High falsification value; historical evidence gaps are explicit.' }));
  if (shadow && preflightRef) {
    const minimum = shadow.evidence_window?.minimum_ready_snapshots ?? 7; const ready = shadow.ready_snapshot_count; const falsified = Object.values(shadow.candidates ?? {}).some((item) => item.verdict === 'BLOCK' || item.verdict === 'FALSIFYING_EVIDENCE');
    loops.push(make({ loop_id: 'loop:IPX_PLTR_SHADOW', question: 'Can unchanged IPX/PLTR candidate architectures improve as the PLTR economy matures?', short_context: 'Pinned candidate architectures are replayed against READY PLTR snapshots in Shadow Observation mode.', source_type: 'IPX_PLTR_SHADOW', source_ref: { ...preflightRef, source_id: shadow.latest_ready_snapshot?.observation_id ?? 'shadow-status', href: '/v1/4663/reflexive/preflight/ipx-pltr/shadow/status', observed_at: shadow.latest_ready_snapshot?.observed_at ?? shadow.last_refresh_at ?? null }, state: falsified ? 'FALSIFIED' : shadow.evidence_window?.satisfied ? 'PARTIALLY_RESOLVED' : ready ? 'OBSERVING' : 'BLOCKED_BY_DATA', opened_at: shadow.latest_ready_snapshot?.observed_at ?? preflightRef.observed_at ?? now.toISOString(), last_changed_at: shadow.last_refresh_at ?? preflightRef.observed_at ?? now.toISOString(), expected_checkpoint_at: null, progress: countProgress(ready, minimum, 'READY snapshots'), current_evidence: `${ready} READY snapshots; ${shadow.next_action ?? 'OBSERVE'}.`, next_evidence_needed: `${Math.max(0, minimum - ready)} more READY snapshots across the shadow evidence window.`, resolution_condition: 'The minimum READY snapshot and calendar-day evidence policy is satisfied with observable candidate transitions.', falsification_condition: 'A pinned candidate produces a falsifying or blocked research verdict under the unchanged architecture.', deep_link: '/4663/reflexive/preflight/ipx-pltr/shadow/status', priority_reason: 'Research-only longitudinal evidence can falsify architecture assumptions without authorizing launch.' }));
  }
  if (pulse && pulseRef) {
    const resolved = pulse.resolution?.state === 'published' || pulse.resolution?.state === 'resolved'; const checkpoint = pulse.window.closes_at; loops.push(make({ loop_id: `loop:${pulse.window.window_id}`, question: 'What will dominate the next canonical 24h Robinhood Chain observation window?', short_context: 'Pulse resolves against the published deterministic observation window.', source_type: 'PULSE', source_ref: pulseRef, state: resolved ? 'RESOLVED' : Date.parse(checkpoint) <= now.getTime() ? 'VERIFYING' : 'AWAITING_CHECKPOINT', opened_at: pulse.window.opens_at, last_changed_at: pulse.resolution?.published_at ?? pulse.window.opens_at, expected_checkpoint_at: checkpoint, progress: timeProgress(checkpoint, now, 'PULSE CHECKPOINT'), current_evidence: resolved ? `Resolved: ${pulse.resolution?.resolved_category ?? 'NO_QUALIFIED_ROTATION'}.` : `${pulse.state ?? pulse.consensus.state}.`, next_evidence_needed: resolved ? 'Historical resolution is available.' : 'The canonical 24h observation window must close and resolve.', resolution_condition: 'The canonical Pulse resolution is published for this window.', falsification_condition: null, deep_link: `/4663/pulse/windows/${encodeURIComponent(pulse.window.window_id)}`, priority_reason: 'Known checkpoint and deterministic resolution make this a concrete return point.' }));
  }
  if (preflight && preflightRef && !shadow) loops.push(make({ loop_id: `loop:pltr-preflight:${preflight.observation_id}`, question: 'Can unchanged IPX/PLTR candidate architectures improve as the PLTR economy matures?', short_context: 'Shadow Observation status is not available; the PLTR preflight remains the source boundary.', source_type: 'IPX_PLTR_SHADOW', source_ref: preflightRef, state: 'BLOCKED_BY_DATA', opened_at: preflight.observation?.observed_at ?? preflightRef.observed_at ?? now.toISOString(), last_changed_at: preflight.observation?.observed_at ?? now.toISOString(), expected_checkpoint_at: null, progress: { type: 'NONE', label: 'AWAITING EVIDENCE' }, current_evidence: `${preflight.verified_mission_markets.length} verified mission markets in preflight.`, next_evidence_needed: 'A persisted Shadow Observation status.', resolution_condition: 'Shadow evidence is available and meets its minimum policy.', falsification_condition: null, deep_link: '/4663/reflexive/preflight/ipx-pltr/shadow/status', priority_reason: 'Shadow source failure is isolated and made visible.' }));
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
