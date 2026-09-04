/**
 * Public, presentation-only projections of canonical //4663 evidence.
 *
 * This registry intentionally owns no source data.  It turns persisted/read
 * model data into safe social objects, so a share can never expose a draft,
 * follow, wallet balance, or other personalised state.
 */
import type { FrontdoorCard, FrontdoorChangeEvent, OpenLoop, Rh4663FrontdoorState } from './rh4663FrontdoorService';

export const RH_4663_SHARE_VERSION = 'rh4663.share.v1' as const;
export const RH_4663_SHARE_TYPES = [
  'NOW_FINDING', 'WATCH_CASE', 'OPEN_LOOP', 'CALL_RECEIPT', 'RESOLUTION_RECEIPT',
  'PROOF_PROFILE', 'RMM_CENSUS_OBSERVATION', 'RADAR_VERIFICATION',
  'RADAR_FALSIFICATION', 'AI_NVDA_CHECKPOINT', 'PLTR_SHADOW_OBSERVATION',
  'FRONTDOOR_CHANGE_EVENT'
] as const;
export type Rh4663ShareType = typeof RH_4663_SHARE_TYPES[number];
export type Rh4663ShareEvidenceState = 'VERIFIED' | 'MIXED' | 'WATCH' | 'UNRESOLVED' | 'BLOCK' | 'FALSIFIED' | 'INSUFFICIENT_DATA' | 'DEGRADE';
export type Rh4663ShareObject = {
  share_object_id: string;
  share_type: Rh4663ShareType;
  canonical_subject_id: string;
  title: string;
  primary_statement: string;
  secondary_statement: string | null;
  primary_metric: string | null;
  evidence_state: Rh4663ShareEvidenceState;
  observed_at: string | null;
  source_freshness: string | null;
  source_ref: { source_type: string; source_id: string; href: string; observed_at: string | null };
  deep_link: string;
  canonical_url: string;
  og_image_url: string;
  share_text: string;
  share_version: typeof RH_4663_SHARE_VERSION;
  immutability_state: 'IMMUTABLE' | 'VERSIONED_CURRENT';
  privacy_state: 'PUBLIC';
};

type Receipt = { receipt_id: string; created_at: string; window_id: string; rotation?: string; called_category?: string; resolved_category?: string; outcome?: 'CORRECT' | 'INCORRECT'; confidence: number; resolved_at?: string; publication_state?: string; immutable?: boolean };
type Profile = { wallet: string; display_name: string; calls: number; resolved: number; correct: number; accuracy: number | null; high_confidence_accuracy: number | null; profile_version: string };

export function buildRh4663FrontdoorShareObjects(state: Rh4663FrontdoorState, publicBaseUrl = 'https://radar.infopunks.fun'): Rh4663ShareObject[] {
  const now = state.now_cards.map((card) => fromCard('NOW_FINDING', card, publicBaseUrl));
  const watch = state.watch_cards.map((card) => fromCard('WATCH_CASE', card, publicBaseUrl));
  const loops = state.open_loops.map((loop) => fromLoop(loop, publicBaseUrl));
  const changes = state.change_events.map((event) => fromChange(event, publicBaseUrl));
  const census = state.now_cards.filter((card) => card.source_type === 'rmm_census').map((card) => fromCard('RMM_CENSUS_OBSERVATION', card, publicBaseUrl));
  const radar = state.now_cards.filter((card) => card.source_type === 'signal_card').map((card) => fromCard('RADAR_VERIFICATION', card, publicBaseUrl));
  const shadow = state.open_loops.filter((loop) => loop.source_type === 'IPX_PLTR_SHADOW').map((loop) => ({ ...fromLoop(loop, publicBaseUrl), share_type: 'PLTR_SHADOW_OBSERVATION' as const, immutability_state: 'IMMUTABLE' as const }));
  return [...now, ...watch, ...loops, ...changes, ...census, ...radar, ...shadow];
}

export function buildRh4663CallShareObject(receipt: Receipt, publicBaseUrl = 'https://radar.infopunks.fun'): Rh4663ShareObject {
  const resolved = Boolean(receipt.resolved_category || receipt.outcome);
  const type: Rh4663ShareType = resolved ? 'RESOLUTION_RECEIPT' : 'CALL_RECEIPT';
  const route = resolved ? 'resolution' : 'call';
  const called = display(receipt.called_category ?? receipt.rotation ?? 'Unknown');
  const actual = receipt.resolved_category ? display(receipt.resolved_category) : null;
  const primary = resolved ? `CALLED: ${called}. OUTCOME: ${actual ?? 'UNRESOLVED'}.` : `CALL: ${called}.`;
  const secondary = resolved ? `RESULT: ${receipt.outcome ?? 'UNRESOLVED'} · CONFIDENCE: ${receipt.confidence}%` : `${receipt.confidence}% confidence for the canonical observation window.`;
  return object({ type, id: receipt.receipt_id, subject: receipt.receipt_id, title: resolved ? '//4663 RESOLUTION' : '//4663 CALL', primary, secondary, metric: `${receipt.confidence}% CONFIDENCE`, state: resolved ? (receipt.outcome === 'CORRECT' ? 'VERIFIED' : 'FALSIFIED') : 'UNRESOLVED', observedAt: receipt.resolved_at ?? receipt.created_at, freshness: 'IMMUTABLE RECEIPT', source: { source_type: 'protocol_receipt', source_id: receipt.receipt_id, href: `/v1/4663/receipts/${encodeURIComponent(receipt.receipt_id)}`, observed_at: receipt.resolved_at ?? receipt.created_at }, deepLink: `/4663/${route}/${encodeURIComponent(receipt.receipt_id)}`, ogPath: `/og/4663/${route}/${encodeURIComponent(receipt.receipt_id)}.png`, immutable: true, publicBaseUrl });
}

export function buildRh4663ProofProfileShareObject(profile: Profile, publicBaseUrl = 'https://radar.infopunks.fun'): Rh4663ShareObject {
  const accuracy = profile.accuracy === null ? 'INSUFFICIENT DATA' : `${Math.round(profile.accuracy * 100)}% ACCURACY`;
  return object({ type: 'PROOF_PROFILE', id: profile.wallet.toLowerCase(), subject: profile.wallet.toLowerCase(), title: '//4663 PROOF', primary: `${profile.resolved} RESOLVED CALLS. ${profile.correct} CORRECT.`, secondary: profile.high_confidence_accuracy === null ? 'High-confidence sample is not yet meaningful.' : `${Math.round(profile.high_confidence_accuracy * 100)}% HIGH-CONFIDENCE ACCURACY.`, metric: accuracy, state: profile.accuracy === null ? 'INSUFFICIENT_DATA' : 'VERIFIED', observedAt: null, freshness: profile.profile_version, source: { source_type: 'proof_profile', source_id: profile.wallet.toLowerCase(), href: `/v1/4663/proof/${encodeURIComponent(profile.wallet)}`, observed_at: null }, deepLink: `/4663/proof/${encodeURIComponent(profile.wallet)}`, ogPath: `/og/4663/proof/${encodeURIComponent(profile.wallet)}.png`, immutable: true, publicBaseUrl });
}

export function findRh4663ShareObject(objects: readonly Rh4663ShareObject[], id: string) { return objects.find((item) => item.share_object_id === id) ?? null; }

function fromCard(type: Extract<Rh4663ShareType, 'NOW_FINDING' | 'WATCH_CASE' | 'RMM_CENSUS_OBSERVATION' | 'RADAR_VERIFICATION'>, card: FrontdoorCard, publicBaseUrl: string): Rh4663ShareObject {
  return object({ type, id: card.id, subject: card.source_ref.source_id, title: `${type === 'WATCH_CASE' ? 'WATCH' : type === 'RMM_CENSUS_OBSERVATION' ? 'RMM CATEGORY CENSUS' : type === 'RADAR_VERIFICATION' ? 'RADAR VERIFICATION' : 'NOW'} / ${card.topic}`, primary: card.headline, secondary: card.summary, metric: card.primary_metric || null, state: card.evidence_state, observedAt: card.source_ref.observed_at, freshness: card.freshness, source: card.source_ref, deepLink: card.deep_link, ogPath: `/og/4663/${type === 'WATCH_CASE' ? 'watch' : type === 'RMM_CENSUS_OBSERVATION' ? 'census' : type === 'RADAR_VERIFICATION' ? 'radar' : 'now'}/${encodeURIComponent(card.id)}.png`, immutable: type !== 'NOW_FINDING' && type !== 'WATCH_CASE', publicBaseUrl });
}

function fromLoop(loop: OpenLoop, publicBaseUrl: string): Rh4663ShareObject {
  const isFalsified = loop.state === 'FALSIFIED';
  const type: Rh4663ShareType = isFalsified ? 'RADAR_FALSIFICATION' : loop.source_type === 'AI_NVDA_CAPITAL_VS_FLOW' ? 'AI_NVDA_CHECKPOINT' : 'OPEN_LOOP';
  const state: Rh4663ShareEvidenceState = isFalsified ? 'FALSIFIED' : loop.state === 'BLOCKED_BY_DATA' ? 'BLOCK' : loop.state === 'RESOLVED' || loop.state === 'PARTIALLY_RESOLVED' ? 'MIXED' : 'UNRESOLVED';
  const checkpoint = loop.expected_checkpoint_at ? `CHECKPOINT: ${new Date(loop.expected_checkpoint_at).toISOString().slice(0, 10)}` : loop.progress.label;
  const ogKind = type === 'RADAR_FALSIFICATION' ? 'falsification' : type === 'AI_NVDA_CHECKPOINT' ? 'ai-nvda' : 'loop';
  return object({ type, id: loop.loop_id, subject: loop.source_ref.source_id, title: isFalsified ? 'RADAR FALSIFIED' : type === 'AI_NVDA_CHECKPOINT' ? 'AI/NVDA CHECKPOINT' : 'OPEN QUESTION', primary: loop.question, secondary: `${loop.short_context} Current evidence: ${loop.current_evidence}`, metric: checkpoint, state, observedAt: loop.last_changed_at, freshness: loop.state, source: loop.source_ref, deepLink: loop.deep_link, ogPath: `/og/4663/${ogKind}/${encodeURIComponent(loop.loop_id)}.png`, immutable: isFalsified || loop.state === 'RESOLVED', publicBaseUrl });
}

function fromChange(event: FrontdoorChangeEvent, publicBaseUrl: string): Rh4663ShareObject {
  return object({ type: 'FRONTDOOR_CHANGE_EVENT', id: event.event_id, subject: event.source_ref.source_id, title: '//4663 CHANGE', primary: event.headline, secondary: `${event.change_type.replaceAll('_', ' ')} · CANONICAL FRONT DOOR VERSION ${event.frontdoor_version}`, metric: null, state: event.change_type === 'FALSIFIED' ? 'FALSIFIED' : 'VERIFIED', observedAt: event.source_observed_at ?? event.occurred_at, freshness: 'VERSIONED CANONICAL STATE', source: event.source_ref, deepLink: event.deep_link, ogPath: `/og/4663/change/${encodeURIComponent(event.event_id)}.png`, immutable: true, publicBaseUrl });
}

function object(input: { type: Rh4663ShareType; id: string; subject: string; title: string; primary: string; secondary: string | null; metric: string | null; state: string; observedAt: string | null; freshness: string | null; source: { source_type: string; source_id: string; href: string; observed_at: string | null }; deepLink: string; ogPath: string; immutable: boolean; publicBaseUrl: string }): Rh4663ShareObject {
  const deepLink = internalPath(input.deepLink);
  const base = input.publicBaseUrl.replace(/\/$/, '');
  const primary = text(input.primary, 230); const secondary = input.secondary ? text(input.secondary, 260) : null;
  const state = normalizeState(input.state);
  const shareObjectId = `${input.type.toLowerCase()}:${safeId(input.id)}`;
  const canonical = `${base}${deepLink}`;
  const shareText = text(`${primary}\n\n${state} · //4663\n${canonical}`, 280);
  return { share_object_id: shareObjectId, share_type: input.type, canonical_subject_id: safeId(input.subject), title: text(input.title, 100), primary_statement: primary, secondary_statement: secondary, primary_metric: input.metric ? text(input.metric, 100) : null, evidence_state: state, observed_at: iso(input.observedAt), source_freshness: input.freshness ? text(input.freshness, 80) : null, source_ref: { source_type: safeId(input.source.source_type), source_id: safeId(input.source.source_id), href: safeSourceHref(input.source.href), observed_at: iso(input.source.observed_at) }, deep_link: deepLink, canonical_url: canonical, og_image_url: `${base}${internalPath(input.ogPath)}`, share_text: shareText, share_version: RH_4663_SHARE_VERSION, immutability_state: input.immutable ? 'IMMUTABLE' : 'VERSIONED_CURRENT', privacy_state: 'PUBLIC' };
}

function normalizeState(value: string): Rh4663ShareEvidenceState { const state = value.toUpperCase().replaceAll(' ', '_'); if (state === 'BLOCKED_BY_DATA') return 'BLOCK'; if (state === 'PARTIALLY_RESOLVED' || state === 'RESOLVED') return 'MIXED'; return (['VERIFIED', 'MIXED', 'WATCH', 'UNRESOLVED', 'BLOCK', 'FALSIFIED', 'INSUFFICIENT_DATA', 'DEGRADE'] as const).includes(state as Rh4663ShareEvidenceState) ? state as Rh4663ShareEvidenceState : 'INSUFFICIENT_DATA'; }
function internalPath(value: string) { return /^\/(?:4663|v1\/4663|og\/4663)(?:\/|$)/.test(value) ? value : '/4663'; }
function safeSourceHref(value: string) { return /^(?:\/|https:\/\/)/.test(value) ? value : '/4663'; }
function safeId(value: string) { return text(value.replace(/[^a-zA-Z0-9:._-]/g, '-'), 180) || 'unknown'; }
function text(value: string, max: number) { return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function iso(value: string | null) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function display(value: string) { return text(value.replaceAll('_', ' '), 80).toUpperCase(); }
