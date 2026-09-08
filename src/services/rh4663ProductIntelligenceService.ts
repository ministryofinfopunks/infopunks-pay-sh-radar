/** Internal-only, privacy-minimised product analytics for //4663.
 * It consumes categorical telemetry and canonical receipt lifecycle notices;
 * it never participates in Radar, Preflight, CALL, RESOLUTION, or Proof. */
import { createHash } from 'node:crypto';
import type { Rh4663CampaignEvent } from './rh4663CampaignTelemetry';

export const RH_4663_PRODUCT_INTELLIGENCE = 'RH_4663_PRODUCT_INTELLIGENCE' as const;
export type ProductDataQuality = 'AVAILABLE' | 'PARTIAL' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE';
export type EntrySource = 'DIRECT' | 'NOW_SHARE' | 'WATCH_SHARE' | 'OPEN_LOOP_SHARE' | 'CALL_SHARE' | 'RESOLUTION_SHARE' | 'PROOF_SHARE' | 'CENSUS_SHARE' | 'RADAR_SHARE' | 'CAMPAIGN_SHARE' | 'UNKNOWN';
export type ProductEvent = { event_id: string; occurred_at: string; event: Rh4663CampaignEvent['event'] | 'valid_call_receipt' | 'canonical_resolution' | 'resolution_return'; identity_key: string | null; entry_source: EntrySource; campaign_id: string | null; window_id: string | null; receipt_id: string | null; call_receipt_id: string | null };
export type Metric = { numerator: number | null; denominator: number | null; rate: number | null; coverage: ProductDataQuality; methodology_version: 'rh4663.product-intelligence.v1' };
export type Rh4663ProductIntelligence = {
  object_type: typeof RH_4663_PRODUCT_INTELLIGENCE; window_start: string; window_end: string; methodology_version: 'rh4663.product-intelligence.v1'; coverage: ProductDataQuality; data_quality: ProductDataQuality;
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

export class Rh4663ProductIntelligenceService {
  private readonly events = new Map<string, ProductEvent>();
  private truncated = false;
  // This is an operational baseline, not an event warehouse. Bounded memory
  // guarantees analytics cannot become a frontdoor resource dependency.
  private static readonly MAX_EVENTS = 50_000;
  constructor(private readonly now: () => Date = () => new Date()) {}
  /** Best effort only; malformed/duplicate analytics never throw into product paths. */
  recordTelemetry(input: Rh4663CampaignEvent, metadata: { event_id?: string; occurred_at?: string; entry_source?: EntrySource } = {}) {
    const occurred_at = telemetryTime(metadata.occurred_at, this.now()) ?? this.now().toISOString(); const event_id = metadata.event_id && /^[a-zA-Z0-9:._-]{1,180}$/.test(metadata.event_id) ? metadata.event_id : `telemetry:${input.event}:${occurred_at}:${this.events.size}`;
    if (this.events.has(event_id)) return false;
    this.remember({ event_id, occurred_at, event: input.event, identity_key: null, entry_source: metadata.entry_source ?? entrySource(input), campaign_id: input.campaign_id ?? null, window_id: input.window_id ?? null, receipt_id: null, call_receipt_id: null }); return true;
  }
  recordCanonicalCall(receipt: { receipt_id: string; wallet: string; window_id: string; created_at: string; campaign_id?: string | null }) {
    const event_id = `call:${receipt.receipt_id}`; if (this.events.has(event_id)) return false;
    this.remember({ event_id, occurred_at: validTime(receipt.created_at) ?? this.now().toISOString(), event: 'valid_call_receipt', identity_key: pseudonym(receipt.wallet), entry_source: 'UNKNOWN', campaign_id: receipt.campaign_id ?? null, window_id: receipt.window_id, receipt_id: receipt.receipt_id, call_receipt_id: null }); return true;
  }
  recordCanonicalResolution(receipt: { receipt_id: string; call_receipt_id: string; wallet: string; window_id: string; created_at: string }) {
    const event_id = `resolution:${receipt.receipt_id}`; if (this.events.has(event_id)) return false;
    this.remember({ event_id, occurred_at: validTime(receipt.created_at) ?? this.now().toISOString(), event: 'canonical_resolution', identity_key: pseudonym(receipt.wallet), entry_source: 'UNKNOWN', campaign_id: null, window_id: receipt.window_id, receipt_id: receipt.receipt_id, call_receipt_id: receipt.call_receipt_id }); return true;
  }
  recordResolutionReturn(input: { wallet: string; call_receipt_id: string; resolution_receipt_id: string; occurred_at?: string }) {
    const at = validTime(input.occurred_at) ?? this.now().toISOString(); const event_id = `resolution-return:${input.resolution_receipt_id}:${pseudonym(input.wallet)}`; if (this.events.has(event_id)) return false;
    this.remember({ event_id, occurred_at: at, event: 'resolution_return', identity_key: pseudonym(input.wallet), entry_source: 'DIRECT', campaign_id: null, window_id: null, receipt_id: input.resolution_receipt_id, call_receipt_id: input.call_receipt_id }); return true;
  }
  read(input: { window_start?: string; window_end?: string; campaign_id?: string } = {}): Rh4663ProductIntelligence {
    const window_end = validTime(input.window_end) ?? this.now().toISOString(); const window_start = validTime(input.window_start) ?? new Date(Date.parse(window_end) - 30 * 86_400_000).toISOString();
    const events = [...this.events.values()].filter((item) => item.occurred_at >= window_start && item.occurred_at <= window_end && (!input.campaign_id || item.campaign_id === input.campaign_id)); const count = (...names: ProductEvent['event'][]) => events.filter((item) => names.includes(item.event)).length;
    const calls = events.filter((item) => item.event === 'valid_call_receipt'); const resolutions = events.filter((item) => item.event === 'canonical_resolution'); const returns = events.filter((item) => item.event === 'resolution_return'); const callStarted = count('call_sign_started', '4663_call_started', 'campaign_call_started', 'social_landing_call_started'); const callCard = count('call_card_viewed');
    const frontdoor = count('frontdoor_return_visit', 'call_card_viewed', 'open_loop_viewed', 'my4663_viewed'); const openViews = count('open_loop_viewed'); const follows = count('follow_created'); const shares = count('share_native_completed', 'share_link_copied', '4663_call_share_completed', '4663_resolution_shared', 'campaign_shared'); const landings = count('social_landing_viewed');
    const identityCoverage = calls.length ? 'PARTIAL' as const : 'INSUFFICIENT_DATA' as const;
    const unavailable = metric(null, null, 'INSUFFICIENT_DATA');
    const conversion = callCard ? metric(calls.length, callCard, calls.length ? 'PARTIAL' : 'INSUFFICIENT_DATA') : unavailable;
    const resolvedIdentities = new Set(resolutions.map((item) => item.identity_key).filter((item): item is string => Boolean(item)));
    const returnIdentities = new Set(returns.filter((item) => item.identity_key && resolutions.some((resolution) => resolution.call_receipt_id === item.call_receipt_id && resolution.identity_key === item.identity_key)).map((item) => item.identity_key!));
    const secondCallIdentities = new Set(calls.filter((call) => call.identity_key && returns.some((returned) => returned.identity_key === call.identity_key && Date.parse(call.occurred_at) > Date.parse(returned.occurred_at))).map((call) => call.identity_key!));
    const resolutionRate = resolvedIdentities.size ? metric(returnIdentities.size, resolvedIdentities.size, 'PARTIAL') : unavailable;
    const secondRate = returnIdentities.size ? metric(secondCallIdentities.size, returnIdentities.size, 'PARTIAL') : unavailable;
    return { object_type: RH_4663_PRODUCT_INTELLIGENCE, window_start, window_end, methodology_version: 'rh4663.product-intelligence.v1', coverage: events.length ? identityCoverage : 'INSUFFICIENT_DATA', data_quality: events.length ? 'PARTIAL' : 'INSUFFICIENT_DATA', frontdoor_visitors: frontdoor || null, call_card_viewers: callCard || null, call_started: callStarted, valid_call_receipts: calls.length, call_conversion_rate: conversion,
      calls_resolved: resolutions.length || null, resolution_return_users: resolvedIdentities.size ? returnIdentities.size : null, resolution_return_rate: resolutionRate, second_call_users: returnIdentities.size ? secondCallIdentities.size : null, second_call_rate: secondRate,
      open_loop_viewers: openViews, open_loop_followers: follows, open_loop_return_users: null, open_loop_follow_return_rate: unavailable,
      my4663_follow_creations: follows, followed_change_views: count('followed_change_viewed'), followed_subject_return_rate: unavailable,
      shares, share_landings: landings, share_landing_rate: shares ? metric(landings, shares, 'PARTIAL') : unavailable, landing_evidence_opens: count('social_landing_source_opened', 'campaign_evidence_opened'), landing_call_starts: count('social_landing_call_started'),
      campaign_views: count('campaign_viewed'), campaign_calls: count('campaign_call_started'), campaign_receipts: calls.filter((item) => item.campaign_id !== null).length, campaign_resolution_returns: count('campaign_resolution_return'),
      retention_windows: { D1: returns.length ? 'PARTIAL' : 'INSUFFICIENT_DATA', D7: returns.length ? 'PARTIAL' : 'INSUFFICIENT_DATA', D30: returns.length ? 'PARTIAL' : 'INSUFFICIENT_DATA' },
      cohorts: { first_valid_call_week: identityCoverage, first_visit_week: 'INSUFFICIENT_DATA', campaign_vs_non_campaign: events.some((item) => item.campaign_id) ? 'PARTIAL' : 'INSUFFICIENT_DATA', anonymous_vs_connected: identityCoverage, genesis_vs_non_genesis: 'INSUFFICIENT_DATA' },
      notification_readiness: { state: resolutionRate.rate === null ? 'INSUFFICIENT_EVIDENCE' : 'DO_NOT_ADD_NOTIFICATIONS', conclusion: resolutionRate.rate === null ? 'INSUFFICIENT_DATA' : 'ORGANIC_RETURN_SIGNAL_WEAK', reason: resolutionRate.rate === null ? 'Resolution-return coverage is not yet sufficient for an advisory decision.' : 'Observed aggregates are advisory only; no notification experiment is enabled by this read model.' },
      limitations: ['Anonymous browser events are aggregate-only; no fingerprinting is used.', 'Only authenticated/private return reads can link a resolved receipt to a returning identity.', 'No unavailable denominator is rendered as 0%.', 'Events are retained only in this bounded process baseline; deploy durable aggregate storage before relying on production history.', ...(this.truncated ? ['The bounded baseline evicted older events; coverage is partial.'] : [])] };
  }
  private remember(event: ProductEvent) {
    this.events.set(event.event_id, event);
    while (this.events.size > Rh4663ProductIntelligenceService.MAX_EVENTS) { this.events.delete(this.events.keys().next().value!); this.truncated = true; }
  }
}
function metric(numerator: number | null, denominator: number | null, coverage: ProductDataQuality): Metric { return { numerator, denominator, rate: numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null, coverage, methodology_version: 'rh4663.product-intelligence.v1' }; }
function entrySource(event: Rh4663CampaignEvent): EntrySource { if (event.entry_source) return event.entry_source; if (event.event === 'campaign_shared') return 'CAMPAIGN_SHARE'; const source = event.share_source; if (!source) return event.event.startsWith('social_landing') ? 'UNKNOWN' : 'DIRECT'; return ({ NOW: 'NOW_SHARE', WATCH: 'WATCH_SHARE', OPEN_LOOP: 'OPEN_LOOP_SHARE', CALL: 'CALL_SHARE', RESOLUTION: 'RESOLUTION_SHARE', PROOF: 'PROOF_SHARE', CENSUS: 'CENSUS_SHARE', RADAR: 'RADAR_SHARE', CAMPAIGN: 'CAMPAIGN_SHARE', SHADOW: 'UNKNOWN' } as const)[source]; }
function validTime(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function telemetryTime(value: string | undefined, now: Date) { const parsed = validTime(value); if (!parsed) return null; const skew = Date.parse(parsed) - now.getTime(); return skew <= 5 * 60_000 && skew >= -90 * 86_400_000 ? parsed : null; }
function pseudonym(wallet: string) { return `wallet:${createHash('sha256').update(`rh4663-product-v1:${wallet.toLowerCase()}`).digest('hex')}`; }
