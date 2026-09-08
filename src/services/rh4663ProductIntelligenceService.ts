/** Internal-only, privacy-minimised product analytics for //4663.
 * It consumes categorical telemetry and canonical receipt lifecycle notices;
 * it never participates in Radar, Preflight, CALL, RESOLUTION, or Proof. */
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { resolvePostgresPool, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';
import type { Rh4663CampaignEvent } from './rh4663CampaignTelemetry';

export const RH_4663_PRODUCT_INTELLIGENCE = 'RH_4663_PRODUCT_INTELLIGENCE' as const;
export const RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION = 'rh4663.product-intelligence.v1' as const;
export const RH_4663_PRODUCT_INTELLIGENCE_RETENTION_DAYS = 90;
export type ProductDataQuality = 'AVAILABLE' | 'PARTIAL' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE';
export type EntrySource = 'DIRECT' | 'NOW_SHARE' | 'WATCH_SHARE' | 'OPEN_LOOP_SHARE' | 'CALL_SHARE' | 'RESOLUTION_SHARE' | 'PROOF_SHARE' | 'CENSUS_SHARE' | 'RADAR_SHARE' | 'CAMPAIGN_SHARE' | 'UNKNOWN';
export type ProductEvent = {
  event_id: string; occurred_at: string; event: Rh4663CampaignEvent['event'] | 'valid_call_receipt' | 'canonical_resolution' | 'resolution_return';
  identity_key: string | null; entry_source: EntrySource; campaign_id: string | null; window_id: string | null;
  subject_id: string | null; share_object_id: string | null; receipt_id: string | null; call_receipt_id: string | null; methodology_version: typeof RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION;
};
export type Metric = { numerator: number | null; denominator: number | null; rate: number | null; coverage: ProductDataQuality; methodology_version: typeof RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION };
export type Rh4663ProductIntelligence = {
  object_type: typeof RH_4663_PRODUCT_INTELLIGENCE; window_start: string; window_end: string; methodology_version: typeof RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION; coverage: ProductDataQuality; data_quality: ProductDataQuality;
  storage: { adapter: 'memory' | 'postgres'; durable: boolean; event_retention_days: number };
  frontdoor_visitors: number | null; call_card_viewers: number | null; call_started: number; valid_call_receipts: number; call_conversion_rate: Metric;
  calls_resolved: number | null; resolution_return_users: number | null; resolution_return_rate: Metric; second_call_users: number | null; second_call_rate: Metric;
  open_loop_viewers: number; open_loop_followers: number; open_loop_return_users: number | null; open_loop_follow_return_rate: Metric;
  my4663_follow_creations: number; followed_change_views: number; followed_subject_return_rate: Metric;
  shares: number; share_landings: number; share_landing_rate: Metric; landing_evidence_opens: number; landing_call_starts: number;
  campaign_views: number; campaign_calls: number; campaign_receipts: number; campaign_resolution_returns: number;
  retention_windows: { D1: ProductDataQuality; D7: ProductDataQuality; D30: ProductDataQuality };
  cohorts: { first_valid_call_week: ProductDataQuality; first_visit_week: ProductDataQuality; campaign_vs_non_campaign: ProductDataQuality; anonymous_vs_connected: ProductDataQuality; genesis_vs_non_genesis: ProductDataQuality };
  notification_readiness: { state: 'INSUFFICIENT_EVIDENCE' | 'READY_FOR_NOTIFICATION_EXPERIMENT' | 'DO_NOT_ADD_NOTIFICATIONS'; conclusion: 'ORGANIC_RETURN_SIGNAL_PRESENT' | 'ORGANIC_RETURN_SIGNAL_WEAK' | 'INSUFFICIENT_DATA'; reason: string };
  limitations: string[];
};

export interface Rh4663ProductIntelligenceStore {
  readonly adapter: 'memory' | 'postgres'; readonly durable: boolean;
  append(event: ProductEvent): Promise<boolean>;
  list(input: { window_start: string; window_end: string; campaign_id?: string }): Promise<ProductEvent[]>;
}

/** Test/development fallback. Production uses the Postgres implementation. */
export class InMemoryRh4663ProductIntelligenceStore implements Rh4663ProductIntelligenceStore {
  readonly adapter = 'memory' as const; readonly durable = false;
  private readonly events = new Map<string, ProductEvent>();
  async append(event: ProductEvent) { if (this.events.has(event.event_id)) return false; this.events.set(event.event_id, copy(event)); return true; }
  async list(input: { window_start: string; window_end: string; campaign_id?: string }) { return [...this.events.values()].filter((item) => item.occurred_at >= input.window_start && item.occurred_at <= input.window_end && (!input.campaign_id || item.campaign_id === input.campaign_id)).map(copy); }
}

/** Stores only bounded categorical loop primitives. There are no raw event
 * payloads, wallet addresses, signatures, balances, holdings, or follow lists. */
export class PostgresRh4663ProductIntelligenceStore implements Rh4663ProductIntelligenceStore {
  readonly adapter = 'postgres' as const; readonly durable = true;
  private readonly pool: pg.Pool; private initialized: Promise<void> | null = null; private lastPrunedAt = 0;
  constructor(source: PostgresPoolSource) { this.pool = resolvePostgresPool(source).pool; }
  async append(event: ProductEvent) {
    await this.ensure();
    const result = await this.pool.query('insert into rh4663_product_intelligence_events (event_id, occurred_at, event_name, identity_key, entry_source, campaign_id, window_id, subject_id, share_object_id, receipt_id, call_receipt_id, methodology_version) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (event_id) do nothing returning event_id', [event.event_id, event.occurred_at, event.event, event.identity_key, event.entry_source, event.campaign_id, event.window_id, event.subject_id, event.share_object_id, event.receipt_id, event.call_receipt_id, event.methodology_version]);
    if (Date.now() - this.lastPrunedAt > 60 * 60_000) { this.lastPrunedAt = Date.now(); await this.pool.query(`delete from rh4663_product_intelligence_events where occurred_at < now() - interval '${RH_4663_PRODUCT_INTELLIGENCE_RETENTION_DAYS} days'`); }
    return result.rowCount === 1;
  }
  async list(input: { window_start: string; window_end: string; campaign_id?: string }) {
    await this.ensure();
    const result = await this.pool.query<ProductEvent>('select event_id, occurred_at, event_name as event, identity_key, entry_source, campaign_id, window_id, subject_id, share_object_id, receipt_id, call_receipt_id, methodology_version from rh4663_product_intelligence_events where occurred_at >= $1 and occurred_at <= $2 and ($3::text is null or campaign_id = $3) and methodology_version = $4 order by occurred_at asc, event_id asc', [input.window_start, input.window_end, input.campaign_id ?? null, RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION]);
    return result.rows.map((row) => ({ ...row, occurred_at: new Date(row.occurred_at).toISOString(), methodology_version: RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION }));
  }
  private ensure() {
    if (!this.initialized) this.initialized = this.pool.query("create table if not exists rh4663_product_intelligence_events (event_id text primary key, occurred_at timestamptz not null, event_name text not null, identity_key text null, entry_source text not null check (entry_source in ('DIRECT','NOW_SHARE','WATCH_SHARE','OPEN_LOOP_SHARE','CALL_SHARE','RESOLUTION_SHARE','PROOF_SHARE','CENSUS_SHARE','RADAR_SHARE','CAMPAIGN_SHARE','UNKNOWN')), campaign_id text null, window_id text null, subject_id text null, share_object_id text null, receipt_id text null, call_receipt_id text null, methodology_version text not null check (methodology_version = 'rh4663.product-intelligence.v1')); alter table rh4663_product_intelligence_events add column if not exists subject_id text null; alter table rh4663_product_intelligence_events add column if not exists share_object_id text null; create index if not exists rh4663_product_intelligence_events_window_idx on rh4663_product_intelligence_events (occurred_at asc); create index if not exists rh4663_product_intelligence_events_campaign_window_idx on rh4663_product_intelligence_events (campaign_id, occurred_at asc); create index if not exists rh4663_product_intelligence_events_call_idx on rh4663_product_intelligence_events (call_receipt_id, occurred_at asc);").then(() => undefined).catch((error) => { this.initialized = null; throw error; });
    return this.initialized;
  }
}

export class Rh4663ProductIntelligenceService {
  private readonly store: Rh4663ProductIntelligenceStore;
  private readonly now: () => Date;
  constructor(storeOrNow: Rh4663ProductIntelligenceStore | (() => Date) = new InMemoryRh4663ProductIntelligenceStore(), now: () => Date = () => new Date()) {
    this.store = typeof storeOrNow === 'function' ? new InMemoryRh4663ProductIntelligenceStore() : storeOrNow;
    this.now = typeof storeOrNow === 'function' ? storeOrNow : now;
  }
  /** Best effort only; malformed/duplicate analytics never throw into product paths. */
  async recordTelemetry(input: Rh4663CampaignEvent, metadata: { event_id?: string; occurred_at?: string; entry_source?: EntrySource } = {}) {
    const occurred_at = telemetryTime(metadata.occurred_at, this.now()) ?? this.now().toISOString();
    return this.store.append(event({ event_id: metadata.event_id && /^[a-zA-Z0-9:._-]{1,180}$/.test(metadata.event_id) ? metadata.event_id : `telemetry:${randomUUID()}`, occurred_at, event: input.event, identity_key: input.anonymous_session_id ? sessionPseudonym(input.anonymous_session_id) : null, entry_source: metadata.entry_source ?? entrySource(input), campaign_id: input.campaign_id ?? null, window_id: input.window_id ?? null, subject_id: input.subject_id ?? null, share_object_id: input.share_object_id ?? null, receipt_id: null, call_receipt_id: null }));
  }
  async recordCanonicalCall(receipt: { receipt_id: string; wallet: string; window_id: string; created_at: string; campaign_id?: string | null }) {
    return this.store.append(event({ event_id: `call:${receipt.receipt_id}`, occurred_at: validTime(receipt.created_at) ?? this.now().toISOString(), event: 'valid_call_receipt', identity_key: pseudonym(receipt.wallet), entry_source: 'UNKNOWN', campaign_id: receipt.campaign_id ?? null, window_id: receipt.window_id, subject_id: null, share_object_id: null, receipt_id: receipt.receipt_id, call_receipt_id: null }));
  }
  async recordCanonicalResolution(receipt: { receipt_id: string; call_receipt_id: string; wallet: string; window_id: string; created_at: string }) {
    return this.store.append(event({ event_id: `resolution:${receipt.receipt_id}`, occurred_at: validTime(receipt.created_at) ?? this.now().toISOString(), event: 'canonical_resolution', identity_key: pseudonym(receipt.wallet), entry_source: 'UNKNOWN', campaign_id: null, window_id: receipt.window_id, subject_id: null, share_object_id: null, receipt_id: receipt.receipt_id, call_receipt_id: receipt.call_receipt_id }));
  }
  async recordResolutionReturn(input: { wallet: string; call_receipt_id: string; resolution_receipt_id: string; occurred_at?: string }) {
    return this.store.append(event({ event_id: `resolution-return:${input.resolution_receipt_id}:${pseudonym(input.wallet)}`, occurred_at: validTime(input.occurred_at) ?? this.now().toISOString(), event: 'resolution_return', identity_key: pseudonym(input.wallet), entry_source: 'DIRECT', campaign_id: null, window_id: null, subject_id: null, share_object_id: null, receipt_id: input.resolution_receipt_id, call_receipt_id: input.call_receipt_id }));
  }
  async read(input: { window_start?: string; window_end?: string; campaign_id?: string } = {}): Promise<Rh4663ProductIntelligence> {
    const window_end = validTime(input.window_end) ?? this.now().toISOString(); const window_start = validTime(input.window_start) ?? new Date(Date.parse(window_end) - 30 * 86_400_000).toISOString();
    return project(await this.store.list({ window_start, window_end, campaign_id: input.campaign_id }), { window_start, window_end, storage: { adapter: this.store.adapter, durable: this.store.durable } });
  }
}

function project(events: ProductEvent[], input: { window_start: string; window_end: string; storage: { adapter: 'memory' | 'postgres'; durable: boolean } }): Rh4663ProductIntelligence {
  const count = (...names: ProductEvent['event'][]) => events.filter((item) => names.includes(item.event)).length;
  const calls = events.filter((item) => item.event === 'valid_call_receipt'); const resolutions = events.filter((item) => item.event === 'canonical_resolution'); const returns = events.filter((item) => item.event === 'resolution_return'); const callStarted = count('call_sign_started', '4663_call_started', 'campaign_call_started', 'social_landing_call_started'); const callCard = count('call_card_viewed');
  const frontdoor = count('frontdoor_return_visit', 'call_card_viewed', 'open_loop_viewed', 'my4663_viewed'); const openViews = count('open_loop_viewed'); const follows = count('follow_created'); const shares = count('share_native_completed', 'share_link_copied', '4663_call_share_completed', '4663_resolution_shared', 'campaign_shared'); const landings = count('social_landing_viewed');
  const identityCoverage = calls.length ? 'PARTIAL' as const : 'INSUFFICIENT_DATA' as const; const unavailable = metric(null, null, 'INSUFFICIENT_DATA'); const conversion = callCard ? metric(calls.length, callCard, calls.length ? 'PARTIAL' : 'INSUFFICIENT_DATA') : unavailable;
  const resolvedIdentities = new Set(resolutions.map((item) => item.identity_key).filter((item): item is string => Boolean(item)));
  const returnIdentities = new Set(returns.filter((item) => item.identity_key && resolutions.some((resolution) => resolution.call_receipt_id === item.call_receipt_id && resolution.identity_key === item.identity_key)).map((item) => item.identity_key!));
  const secondCallIdentities = new Set(calls.filter((call) => call.identity_key && returns.some((returned) => returned.identity_key === call.identity_key && Date.parse(call.occurred_at) > Date.parse(returned.occurred_at))).map((call) => call.identity_key!));
  const resolutionRate = resolvedIdentities.size ? metric(returnIdentities.size, resolvedIdentities.size, 'PARTIAL') : unavailable; const secondRate = returnIdentities.size ? metric(secondCallIdentities.size, returnIdentities.size, 'PARTIAL') : unavailable;
  const followEvents = events.filter((item) => (item.event === 'follow_created' || item.event === 'campaign_open_loop_followed') && item.identity_key && item.subject_id);
  const followKeys = new Set(followEvents.map(linkKey));
  const openLoopReturns = events.filter((item) => (item.event === 'followed_open_loop_viewed' || item.event === 'followed_subject_return') && item.identity_key && item.subject_id && followEvents.some((follow) => linkKey(follow) === linkKey(item) && Date.parse(item.occurred_at) > Date.parse(follow.occurred_at)));
  const openLoopReturnKeys = new Set(openLoopReturns.map(linkKey)); const openLoopRate = followKeys.size ? metric(openLoopReturnKeys.size, followKeys.size, 'PARTIAL') : unavailable;
  const followedChanges = events.filter((item) => item.event === 'followed_change_viewed' && item.identity_key && item.subject_id && followEvents.some((follow) => linkKey(follow) === linkKey(item) && Date.parse(item.occurred_at) > Date.parse(follow.occurred_at)));
  const followedChangeKeys = new Set(followedChanges.map(linkKey)); const followedChangeRate = followKeys.size ? metric(followedChangeKeys.size, followKeys.size, 'PARTIAL') : unavailable;
  const shareEvents = events.filter((item) => ['share_native_completed', 'share_link_copied', '4663_call_share_completed', '4663_resolution_shared', 'campaign_shared'].includes(item.event) && item.share_object_id);
  const sharedObjectIds = new Set(shareEvents.map((item) => item.share_object_id!)); const attributedLandings = events.filter((item) => item.event === 'social_landing_viewed' && item.share_object_id && sharedObjectIds.has(item.share_object_id));
  const shareLandingRate = shareEvents.length ? metric(attributedLandings.length, shareEvents.length, 'PARTIAL') : unavailable;
  return { object_type: RH_4663_PRODUCT_INTELLIGENCE, window_start: input.window_start, window_end: input.window_end, methodology_version: RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION, coverage: events.length ? identityCoverage : 'INSUFFICIENT_DATA', data_quality: events.length ? 'PARTIAL' : 'INSUFFICIENT_DATA', storage: { ...input.storage, event_retention_days: RH_4663_PRODUCT_INTELLIGENCE_RETENTION_DAYS }, frontdoor_visitors: frontdoor || null, call_card_viewers: callCard || null, call_started: callStarted, valid_call_receipts: calls.length, call_conversion_rate: conversion,
    calls_resolved: resolutions.length || null, resolution_return_users: resolvedIdentities.size ? returnIdentities.size : null, resolution_return_rate: resolutionRate, second_call_users: returnIdentities.size ? secondCallIdentities.size : null, second_call_rate: secondRate,
    open_loop_viewers: openViews, open_loop_followers: follows, open_loop_return_users: followKeys.size ? openLoopReturnKeys.size : null, open_loop_follow_return_rate: openLoopRate,
    my4663_follow_creations: follows, followed_change_views: count('followed_change_viewed'), followed_subject_return_rate: followedChangeRate,
    shares, share_landings: landings, share_landing_rate: shareLandingRate, landing_evidence_opens: count('social_landing_source_opened', 'campaign_evidence_opened'), landing_call_starts: count('social_landing_call_started'),
    campaign_views: count('campaign_viewed'), campaign_calls: count('campaign_call_started'), campaign_receipts: calls.filter((item) => item.campaign_id !== null).length, campaign_resolution_returns: count('campaign_resolution_return'),
    retention_windows: { D1: returns.length ? 'PARTIAL' : 'INSUFFICIENT_DATA', D7: returns.length ? 'PARTIAL' : 'INSUFFICIENT_DATA', D30: returns.length ? 'PARTIAL' : 'INSUFFICIENT_DATA' }, cohorts: { first_valid_call_week: identityCoverage, first_visit_week: 'INSUFFICIENT_DATA', campaign_vs_non_campaign: events.some((item) => item.campaign_id) ? 'PARTIAL' : 'INSUFFICIENT_DATA', anonymous_vs_connected: identityCoverage, genesis_vs_non_genesis: 'INSUFFICIENT_DATA' },
    notification_readiness: { state: resolutionRate.rate === null ? 'INSUFFICIENT_EVIDENCE' : 'DO_NOT_ADD_NOTIFICATIONS', conclusion: resolutionRate.rate === null ? 'INSUFFICIENT_DATA' : 'ORGANIC_RETURN_SIGNAL_WEAK', reason: resolutionRate.rate === null ? 'Resolution-return coverage is not yet sufficient for an advisory decision.' : 'Observed aggregates are advisory only; no notification experiment is enabled by this read model.' },
    limitations: ['Anonymous browser events are aggregate-only; no fingerprinting is used.', 'Only authenticated/private return reads can link a resolved receipt to a returning identity.', 'No unavailable denominator is rendered as 0%.', input.storage.durable ? `Only bounded categorical event primitives are retained for ${RH_4663_PRODUCT_INTELLIGENCE_RETENTION_DAYS} days.` : 'Events are process-local in this environment; no durable baseline is available.'] };
}
function event(value: Omit<ProductEvent, 'methodology_version'>): ProductEvent { return { ...value, methodology_version: RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION }; }
function metric(numerator: number | null, denominator: number | null, coverage: ProductDataQuality): Metric { return { numerator, denominator, rate: numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null, coverage, methodology_version: RH_4663_PRODUCT_INTELLIGENCE_METHODOLOGY_VERSION }; }
function entrySource(event: Rh4663CampaignEvent): EntrySource { if (event.entry_source) return event.entry_source; if (event.event === 'campaign_shared') return 'CAMPAIGN_SHARE'; const source = event.share_source; if (!source) return event.event.startsWith('social_landing') ? 'UNKNOWN' : 'DIRECT'; return ({ NOW: 'NOW_SHARE', WATCH: 'WATCH_SHARE', OPEN_LOOP: 'OPEN_LOOP_SHARE', CALL: 'CALL_SHARE', RESOLUTION: 'RESOLUTION_SHARE', PROOF: 'PROOF_SHARE', CENSUS: 'CENSUS_SHARE', RADAR: 'RADAR_SHARE', CAMPAIGN: 'CAMPAIGN_SHARE', SHADOW: 'UNKNOWN' } as const)[source]; }
function validTime(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function telemetryTime(value: string | undefined, now: Date) { const parsed = validTime(value); if (!parsed) return null; const skew = Date.parse(parsed) - now.getTime(); return skew <= 5 * 60_000 && skew >= -90 * 86_400_000 ? parsed : null; }
function pseudonym(wallet: string) { return `wallet:${createHash('sha256').update(`rh4663-product-v1:${wallet.toLowerCase()}`).digest('hex')}`; }
function sessionPseudonym(session: string) { return `session:${createHash('sha256').update(`rh4663-product-session-v1:${session}`).digest('hex')}`; }
function linkKey(event: Pick<ProductEvent, 'identity_key' | 'subject_id'>) { return `${event.identity_key}:${event.subject_id}`; }
function copy<T>(value: T): T { return structuredClone(value); }
