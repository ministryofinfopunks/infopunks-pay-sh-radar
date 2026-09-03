/**
 * MY 4663 is deliberately a small private relevance projection.  It accepts
 * only stable, user-understandable subjects and derives references from the
 * public Front Door state; it neither stores market data nor changes it.
 */
import type { FrontdoorCard, FrontdoorChangeEvent, OpenLoop, Rh4663FrontdoorState } from './rh4663FrontdoorService';

export const MY_4663_FOLLOW = 'MY_4663_FOLLOW' as const;
export const MY_4663_FOLLOW_LIMIT = 50;
export const MY_4663_SUBJECT_TYPES = ['STOCK_TOKEN', 'MISSION_TOKEN', 'RMM_CASE', 'WATCH_CASE', 'OPEN_LOOP', 'RESEARCH_TOPIC'] as const;
export type My4663SubjectType = typeof MY_4663_SUBJECT_TYPES[number];
export type My4663FollowInput = { subject_type: My4663SubjectType; subject_id: string; created_at: string };
export type My4663Follow = My4663FollowInput & { object_type: typeof MY_4663_FOLLOW; follow_id: string; display_label: string; source_ref: { source_type: string; source_id: string; href: string; observed_at: string | null } | null };

const labels: Record<string, string> = {
  'STOCK_TOKEN:PLTR': 'PLTR', 'STOCK_TOKEN:NVDA': 'NVDA', 'RESEARCH_TOPIC:AI': 'AI/NVDA',
  'WATCH_CASE:AI_NVDA_CAPITAL_VS_FLOW': 'AI/NVDA', 'MISSION_TOKEN:RMM': 'RMM',
  'RMM_CASE:RH_STOCK_MEME_MAP_20260903': 'RMM', 'MISSION_TOKEN:IPX_PLTR_SHADOW': 'PLTR',
  'WATCH_CASE:BONER_HIMS_FLOAT_STRESS': 'HIMS/BONER'
};
const knownSubject = (type: My4663SubjectType, id: string) => {
  if ((type === 'STOCK_TOKEN' && ['PLTR', 'NVDA'].includes(id)) || (type === 'MISSION_TOKEN' && ['RMM', 'IPX_PLTR_SHADOW'].includes(id)) || (type === 'RMM_CASE' && id === 'RH_STOCK_MEME_MAP_20260903') || (type === 'WATCH_CASE' && ['AI_NVDA_CAPITAL_VS_FLOW', 'BONER_HIMS_FLOAT_STRESS'].includes(id)) || (type === 'RESEARCH_TOPIC' && id === 'AI') || (type === 'OPEN_LOOP' && /^loop:[A-Z0-9_:-]+$/.test(id))) return true;
  return false;
};

/** Safely normalizes localStorage/query input. Invalid/corrupt entries are dropped. */
export function normalizeMy4663Follows(value: unknown): My4663FollowInput[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, My4663FollowInput>();
  for (const raw of value.slice(0, MY_4663_FOLLOW_LIMIT * 2)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>; const type = item.subject_type; const id = typeof item.subject_id === 'string' ? item.subject_id.trim().toUpperCase() : '';
    const created = typeof item.created_at === 'string' && Number.isFinite(Date.parse(item.created_at)) ? item.created_at : new Date(0).toISOString();
    if (!MY_4663_SUBJECT_TYPES.includes(type as My4663SubjectType) || !id || id.length > 100 || !knownSubject(type as My4663SubjectType, id)) continue;
    const key = `${type}:${id}`; if (!unique.has(key)) unique.set(key, { subject_type: type as My4663SubjectType, subject_id: id, created_at: created });
    if (unique.size >= MY_4663_FOLLOW_LIMIT) break;
  }
  return [...unique.values()];
}

export function followId(follow: Pick<My4663FollowInput, 'subject_type' | 'subject_id'>) { return `${follow.subject_type}:${follow.subject_id}`; }

function subjectKeysForEvent(event: FrontdoorChangeEvent) {
  const keys = new Set<string>(); const add = (type: My4663SubjectType, id: string) => keys.add(`${type}:${id}`);
  if (event.source_type === 'IPX_PLTR_SHADOW' || event.source_type === 'PLTR_PREFLIGHT') { add('STOCK_TOKEN', 'PLTR'); add('MISSION_TOKEN', 'IPX_PLTR_SHADOW'); }
  if (event.source_type === 'AI_NVDA_CAPITAL_VS_FLOW') { add('STOCK_TOKEN', 'NVDA'); add('RESEARCH_TOPIC', 'AI'); add('WATCH_CASE', 'AI_NVDA_CAPITAL_VS_FLOW'); add('OPEN_LOOP', 'LOOP:AI_NVDA_CAPITAL_VS_FLOW'); }
  if (event.source_type === 'RMM_CATEGORY_CENSUS') { add('MISSION_TOKEN', 'RMM'); add('RMM_CASE', 'RH_STOCK_MEME_MAP_20260903'); }
  if (event.source_type === 'REFLEXIVE_WATCH') {
    const id = event.source_ref.source_id.replace(/^watch:/, '').toUpperCase();
    if (id === 'BONER_HIMS_FLOAT_STRESS') add('WATCH_CASE', id);
  }
  // Aggregate Watch and loop source events still carry their stable child IDs
  // in the semantic before/after fingerprint. Match only those explicit IDs.
  const after = event.after as { cards?: Array<{ source?: unknown }>; loops?: Array<{ loop_id?: unknown }> };
  for (const card of Array.isArray(after.cards) ? after.cards : []) {
    const id = typeof card.source === 'string' ? card.source.toUpperCase() : '';
    if (id === 'BONER_HIMS_FLOAT_STRESS' || id === 'AI_NVDA_CAPITAL_VS_FLOW') add('WATCH_CASE', id);
  }
  for (const loop of Array.isArray(after.loops) ? after.loops : []) if (typeof loop.loop_id === 'string') add('OPEN_LOOP', loop.loop_id.toUpperCase());
  return keys;
}

function subjectKeysForLoop(loop: OpenLoop) {
  const keys = new Set<string>([`OPEN_LOOP:${loop.loop_id.toUpperCase()}`]);
  if (loop.source_type === 'AI_NVDA_CAPITAL_VS_FLOW') ['STOCK_TOKEN:NVDA', 'RESEARCH_TOPIC:AI', 'WATCH_CASE:AI_NVDA_CAPITAL_VS_FLOW'].forEach((key) => keys.add(key));
  if (loop.source_type === 'IPX_PLTR_SHADOW') ['STOCK_TOKEN:PLTR', 'MISSION_TOKEN:IPX_PLTR_SHADOW'].forEach((key) => keys.add(key));
  if (loop.source_type === 'RMM_CATEGORY_CENSUS') ['MISSION_TOKEN:RMM', 'RMM_CASE:RH_STOCK_MEME_MAP_20260903'].forEach((key) => keys.add(key));
  return keys;
}
function subjectKeysForCard(card: FrontdoorCard) {
  const keys = new Set<string>();
  if (card.id.includes('pltr') || card.source_type === 'pltr_preflight') keys.add('STOCK_TOKEN:PLTR');
  if (card.id === 'rmm-census' || card.source_type === 'rmm_census') { keys.add('MISSION_TOKEN:RMM'); keys.add('RMM_CASE:RH_STOCK_MEME_MAP_20260903'); }
  if (card.id.includes('AI_NVDA') || card.source_ref.source_id === 'AI_NVDA_CAPITAL_VS_FLOW') ['STOCK_TOKEN:NVDA', 'RESEARCH_TOPIC:AI', 'WATCH_CASE:AI_NVDA_CAPITAL_VS_FLOW'].forEach((key) => keys.add(key));
  if (card.source_ref.source_id === 'BONER_HIMS_FLOAT_STRESS') keys.add('WATCH_CASE:BONER_HIMS_FLOAT_STRESS');
  return keys;
}
function refFor(follow: My4663FollowInput, state: Rh4663FrontdoorState) {
  const key = followId(follow);
  const card = [...state.now_cards, ...state.watch_cards].find((item) => subjectKeysForCard(item).has(key));
  if (card) return card.source_ref;
  const loop = state.open_loops.find((item) => subjectKeysForLoop(item).has(key));
  return loop?.source_ref ?? null;
}
function eventVersion(event: FrontdoorChangeEvent) { return event.frontdoor_version; }

export function buildMy4663State(state: Rh4663FrontdoorState, rawFollows: unknown, lastSeenEventId?: string | null) {
  const follows = normalizeMy4663Follows(rawFollows);
  const followKeys = new Set(follows.map(followId));
  const lastVersion = typeof lastSeenEventId === 'string' ? Number(lastSeenEventId.match(/^frontdoor-change:(\d+):/)?.[1] ?? 0) : 0;
  // A first view establishes a cursor but must not present historical public events as new.
  const hasCursor = Boolean(lastSeenEventId);
  const events = hasCursor ? state.change_events.filter((event) => eventVersion(event) > lastVersion) : [];
  const changed = follows.map((follow) => ({ follow, events: events.filter((event) => subjectKeysForEvent(event).has(followId(follow))) }))
    .filter((item) => item.events.length > 0)
    .map((item) => ({ ...toFollow(item.follow, state), event: item.events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0] }));
  const latestEventId = state.change_events.slice().sort((a, b) => b.frontdoor_version - a.frontdoor_version || b.event_id.localeCompare(a.event_id))[0]?.event_id ?? lastSeenEventId ?? null;
  return {
    object_type: 'MY_4663_STATE' as const, follows: follows.map((follow) => toFollow(follow, state)),
    changed_followed_subjects: changed.slice(0, 4),
    followed_open_loops: state.open_loops.filter((loop) => [...subjectKeysForLoop(loop)].some((key) => followKeys.has(key))).slice(0, 4),
    followed_now_items: state.now_cards.filter((card) => [...subjectKeysForCard(card)].some((key) => followKeys.has(key))).slice(0, 4),
    personal_call_state: null, personal_proof: null, last_seen_my4663_event_id: latestEventId,
    my_4663_version: `${state.frontdoor_version.version}:${latestEventId ?? 'none'}:${follows.map(followId).join(',')}`
  };
}
function toFollow(follow: My4663FollowInput, state: Rh4663FrontdoorState): My4663Follow {
  const id = followId(follow); return { object_type: MY_4663_FOLLOW, ...follow, follow_id: id, display_label: labels[id] ?? follow.subject_id.replace(/^LOOP:/, '').replaceAll('_', ' '), source_ref: refFor(follow, state) };
}
