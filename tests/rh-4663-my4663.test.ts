import { describe, expect, it } from 'vitest';
import { buildMy4663State, MY_4663_FOLLOW_LIMIT, normalizeMy4663Follows } from '../src/services/rh4663My4663Service';
import type { Rh4663FrontdoorState } from '../src/services/rh4663FrontdoorService';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { MemoryRepository } from '../src/persistence/repository';

const at = '2026-09-04T00:00:00.000Z';
const ref = { source_type: 'fixture', source_id: 'fixture', href: '/4663', observed_at: at };
function state(events: Rh4663FrontdoorState['change_events']): Rh4663FrontdoorState {
  return {
    object_type: 'RH_4663_FRONTDOOR_STATE', generated_at: at, freshness: { state: 'VERIFIED', source_observed_at: at }, frontdoor_version: { object_type: 'FRONTDOOR_VERSION', version: 3, changed: ['PLTR_SHADOW'], generated_at: at }, frontdoor_version_durability: 'EPHEMERAL',
    now_cards: [{ id: 'pltr-preflight', topic: 'PLTR', headline: 'PLTR ready', summary: '', primary_metric: '1', delta: null, evidence_state: 'MIXED', freshness: at, source_type: 'pltr_preflight', source_ref: ref, deep_link: '/4663/reflexive/preflight/ipx-pltr', priority_reason: '' }],
    watch_cards: [], open_loops: [{ loop_id: 'loop:AI_NVDA_CAPITAL_VS_FLOW', question: 'AI/NVDA?', short_context: '', source_type: 'AI_NVDA_CAPITAL_VS_FLOW', source_ref: ref, state: 'AWAITING_CHECKPOINT', opened_at: at, last_changed_at: at, expected_checkpoint_at: null, expected_resolution_at: null, progress: { type: 'NONE', label: 'AWAITING EVIDENCE' }, current_evidence: '', next_evidence_needed: '', resolution_condition: '', falsification_condition: null, deep_link: '/4663/reflexive/watch/AI_NVDA_CAPITAL_VS_FLOW', priority_reason: '' }],
    change_events: events, current_call: { window_id: 'w', state: 'open', leading_rotation: null, total_calls: 0, opens_at: at, closes_at: at, deep_link: '/4663/pulse', source_ref: ref }, proof_summary: { total_calls: 0, resolved_calls: null, note: '', deep_link: '/4663/receipts', source_ref: ref }, system_status: { state: 'available', source_health: { census: { status: 'available', observed_at: at }, watch: { status: 'available', observed_at: at }, preflight: { status: 'available', observed_at: at }, pulse: { status: 'available', observed_at: at }, signals: { status: 'available', observed_at: at } } }, source_refs: [ref]
  };
}
function event(source_type: string, id: string, version = 2) { return { object_type: 'FRONTDOOR_CHANGE_EVENT' as const, event_id: `frontdoor-change:${version}:${source_type}`, frontdoor_version: version, occurred_at: at, source_type, source_ref: { ...ref, source_id: id }, change_type: 'UPDATED' as const, headline: `${source_type} changed`, before: null, after: {}, importance: 1, deep_link: '/4663', source_observed_at: at }; }

describe('MY 4663 relevance projection', () => {
  it('normalizes anonymous follows, removes duplicates/corruption, and caps state', () => {
    const follows = normalizeMy4663Follows([{ subject_type: 'STOCK_TOKEN', subject_id: 'pltr', created_at: at }, { subject_type: 'STOCK_TOKEN', subject_id: 'PLTR', created_at: at }, { subject_type: 'STOCK_TOKEN', subject_id: 'UNKNOWN', created_at: at }, null]);
    expect(follows).toEqual([{ subject_type: 'STOCK_TOKEN', subject_id: 'PLTR', created_at: at }]);
    expect(normalizeMy4663Follows(Array.from({ length: MY_4663_FOLLOW_LIMIT + 10 }, () => ({ subject_type: 'STOCK_TOKEN', subject_id: 'PLTR', created_at: at }))).length).toBeLessThanOrEqual(MY_4663_FOLLOW_LIMIT);
  });

  it('maps only deterministic PLTR, AI/NVDA, and RMM public changes to follows', () => {
    const view = buildMy4663State(state([event('IPX_PLTR_SHADOW', 'shadow'), event('AI_NVDA_CAPITAL_VS_FLOW', 'AI_NVDA_CAPITAL_VS_FLOW'), event('RMM_CATEGORY_CENSUS', 'rmm'), event('SIGNAL_CARD', 'unrelated')]), [
      { subject_type: 'STOCK_TOKEN', subject_id: 'PLTR', created_at: at }, { subject_type: 'WATCH_CASE', subject_id: 'AI_NVDA_CAPITAL_VS_FLOW', created_at: at }, { subject_type: 'MISSION_TOKEN', subject_id: 'RMM', created_at: at }
    ], 'frontdoor-change:1:seed');
    expect(view.changed_followed_subjects.map((item) => item.display_label)).toEqual(expect.arrayContaining(['PLTR', 'AI/NVDA', 'RMM']));
    expect(view.changed_followed_subjects).toHaveLength(3);
  });

  it('establishes a separate personal cursor without marking historical events as followed changes', () => {
    const view = buildMy4663State(state([event('IPX_PLTR_SHADOW', 'shadow')]), [{ subject_type: 'STOCK_TOKEN', subject_id: 'PLTR', created_at: at }]);
    expect(view.changed_followed_subjects).toEqual([]);
    expect(view.last_seen_my4663_event_id).toBe('frontdoor-change:2:IPX_PLTR_SHADOW');
    expect(view.followed_now_items).toHaveLength(1);
  });

  it('keeps the read endpoint private while the public frontdoor stays identity and follow agnostic', async () => {
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository());
    try {
      const follows = encodeURIComponent(JSON.stringify([{ subject_type: 'STOCK_TOKEN', subject_id: 'PLTR', created_at: at }]));
      const mine = await app.inject({ method: 'GET', url: `/v1/4663/me?follows=${follows}` });
      const publicState = await app.inject({ method: 'GET', url: '/v1/4663/frontdoor', headers: { cookie: 'private-follows=PLTR' } });
      expect(mine.statusCode).toBe(200); expect(mine.headers['cache-control']).toBe('private, no-store'); expect(mine.json().data.follows[0]).toMatchObject({ subject_type: 'STOCK_TOKEN', subject_id: 'PLTR' });
      expect(publicState.statusCode).toBe(200); expect(publicState.headers['cache-control']).toContain('public'); expect(JSON.stringify(publicState.json().data)).not.toContain('MY_4663_FOLLOW');
    } finally { await app.close(); }
  });
});
