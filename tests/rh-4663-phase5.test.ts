import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { MemoryRepository } from '../src/persistence/repository';
import { InMemoryFrontdoorChangeEventStore, Rh4663FrontdoorService } from '../src/services/rh4663FrontdoorService';

const at = '2026-09-04T00:00:00.000Z';
function deps(overrides: Record<string, unknown> = {}) {
  return {
    census: async () => ({ census_id: 'rmm-1', observed_at: at, verified_pair_count: 2, distinct_verified_stock_tickers: 2, source_claims: { claimed_pair_count: 5, parsed_pair_count: 3 }, verification_coverage: { percentage: 40 }, category_evidence: { breadth_state: 'EARLY_MULTI_ASSET', persistence_state: 'PERSISTENCE_UNPROVEN' }, persistent_rmm_penetration: { status: 'PARTIAL' } }),
    watch: async () => ({ generated_at: at, cases: [{ case_id: 'AI_NVDA_CAPITAL_VS_FLOW', title: 'AI / NVDA', opened_at: at, updated_at: at, current_evidence_state: 'MIXED', audit_priority: 'HIGH', candidate_next_audit: 'Observe D7.', open_evidence_gaps: ['D7'], falsification_notes: [], research_observations: [{ status: 'PENDING', target_at: '2026-09-08T00:00:00.000Z', h2b_verdict: 'OBSERVING' }] }, { case_id: 'BONER_HIMS_FLOAT_STRESS', title: 'BONER / HIMS', opened_at: at, updated_at: at, current_evidence_state: 'NOT_REPRODUCIBLE', audit_priority: 'HIGH', candidate_next_audit: 'Attempt archive proof.', open_evidence_gaps: ['historical state'], falsification_notes: [] }], feed: [{ case_id: 'AI_NVDA_CAPITAL_VS_FLOW', case_title: 'AI / NVDA', key_claim: 'Capital persistence.', why_it_matters: 'D7 remains open.', last_updated: at, evidence_status: 'PARTIAL', radar_state: 'PARTIAL', next_proof_needed: 'Observe D7.' }], falsification_queue: [] }),
    preflight: async () => ({ observation_id: 'pltr-1', observation: { observed_at: at, freshness: 'fresh' }, readiness: { status: 'PARTIAL', missing_prerequisites: ['depth'] }, verified_mission_markets: [], data_gaps: [] }),
    shadow: async () => ({ ready_snapshot_count: 3, last_refresh_at: at, latest_ready_snapshot: { observation_id: 'shadow-3', observed_at: at }, evidence_window: { satisfied: false, minimum_ready_snapshots: 7 }, candidates: {} }),
    pulse: async () => ({ window: { window_id: 'rh4663:2026-09-04', opens_at: at, closes_at: '2026-09-05T00:00:00.000Z' }, state: 'open', consensus: { state: 'unavailable', leading_rotation: null, total_calls: 0 } }),
    signals: async () => [], now: () => new Date(at), ttl_ms: 0, ...overrides
  };
}

describe('4663 Phase 5 return primitives', () => {
  it('builds factual loops, uses explicit states, and caps active loops at four', async () => {
    const state = await new Rh4663FrontdoorService(deps()).read();
    expect(state.open_loops).toHaveLength(4);
    expect(state.open_loops.every((loop) => ['OPEN', 'OBSERVING', 'VERIFYING', 'AWAITING_CHECKPOINT', 'PARTIALLY_RESOLVED', 'BLOCKED_BY_DATA', 'STALE'].includes(loop.state))).toBe(true);
    const rmm = state.open_loops.find((loop) => loop.source_type === 'RMM_CATEGORY_CENSUS');
    expect(rmm?.progress).toMatchObject({ type: 'COUNT', numerator: 3, denominator: 5, label: '3 / 5 claims evaluated' });
    const ai = state.open_loops.find((loop) => loop.source_type === 'AI_NVDA_CAPITAL_VS_FLOW');
    expect(ai?.progress.type).toBe('TIME_TO_CHECKPOINT');
    expect(ai?.expected_checkpoint_at).toBe('2026-09-08T00:00:00.000Z');
    expect(state.open_loops.every((loop) => loop.expected_resolution_at === null)).toBe(true);
  });

  it('links meaningful changes to one monotonic version and ignores generated-at-only changes', async () => {
    let verified = 2; const events = new InMemoryFrontdoorChangeEventStore();
    const service = new Rh4663FrontdoorService(deps({ census: async () => ({ ...(await deps().census()), verified_pair_count: verified }) as any, change_event_store: events }));
    const first = await service.read(); const unchanged = await service.read();
    expect(unchanged.frontdoor_version.version).toBe(first.frontdoor_version.version);
    verified = 3; const changed = await service.read();
    expect(changed.frontdoor_version.version).toBe(first.frontdoor_version.version + 1);
    expect(changed.change_events.some((event) => event.frontdoor_version === changed.frontdoor_version.version && event.source_type === 'RMM_CATEGORY_CENSUS')).toBe(true);
    expect(changed.change_events.every((event) => event.frontdoor_version >= 1)).toBe(true);
  });

  it('keeps personal return changes private and separate from the public version', async () => {
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/4663/me/changes' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.json().data).toMatchObject({ authenticated: false, resolved_call: null, personal_events: [], pending_call: null });
    } finally { await app.close(); }
  });
});
