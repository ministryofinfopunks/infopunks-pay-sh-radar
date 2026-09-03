import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { MemoryRepository } from '../src/persistence/repository';
import { Rh4663FrontdoorService } from '../src/services/rh4663FrontdoorService';

const observedAt = '2026-09-03T12:00:00.000Z';
function dependencies(overrides: Partial<Record<'census' | 'watch' | 'preflight' | 'pulse' | 'signals', () => Promise<any>>> = {}) {
  return {
    census: overrides.census ?? (async () => ({ census_id: 'census-1', observed_at: observedAt, verified_pair_count: 19, distinct_verified_stock_tickers: 16, verification_coverage: { percentage: 100 }, category_evidence: { breadth_state: 'CROSS_CATEGORY', persistence_state: 'PERSISTENCE_UNPROVEN' }, persistent_rmm_penetration: { status: 'PARTIAL' } })),
    watch: overrides.watch ?? (async () => ({ generated_at: observedAt, cases: [{ case_id: 'AI_NVDA_CAPITAL_VS_FLOW', title: 'AI / NVDA', opened_at: observedAt, updated_at: observedAt, current_evidence_state: 'MIXED', audit_priority: 'HIGH', candidate_next_audit: 'Observe D7.', open_evidence_gaps: ['D7'], falsification_notes: [] }], feed: [{ case_id: 'AI_NVDA_CAPITAL_VS_FLOW', case_title: 'AI / NVDA', key_claim: 'Capital versus flow.', why_it_matters: 'Persistence remains open.', last_updated: observedAt, evidence_status: 'PARTIAL', radar_state: 'PARTIAL', next_proof_needed: 'Observe D7.' }], falsification_queue: [] })),
    preflight: overrides.preflight ?? (async () => ({ observation_id: 'pltr-1', observation: { observed_at: observedAt, freshness: 'fresh' }, readiness: { status: 'PARTIAL', missing_prerequisites: ['Direct depth unavailable.'] }, verified_mission_markets: [], data_gaps: [] })),
    pulse: overrides.pulse ?? (async () => ({ window: { window_id: 'rh4663:2026-09-03', opens_at: observedAt, closes_at: '2026-09-04T00:00:00.000Z' }, consensus: { state: 'available', leading_rotation: 'STOCK_TOKENS', total_calls: 4 } })),
    signals: overrides.signals ?? (async () => [{ signal_id: 'signal-1', headline: 'NVDA volume changed.', summary: 'Persisted evidence changed.', category: 'STOCK_TOKENS', significance_score: 80, published_at: observedAt, proof_url: '/4663/signals/signal-1' }]),
    now: () => new Date('2026-09-03T12:05:00.000Z'), ttl_ms: 15_000
  };
}

describe('4663 Front Door read model', () => {
  it('caps NOW, deterministically orders derived cards, and retains canonical provenance', async () => {
    const service = new Rh4663FrontdoorService(dependencies()); const first = await service.read(); const second = await service.read();
    expect(first.object_type).toBe('RH_4663_FRONTDOOR_STATE'); expect(first.now_cards).toHaveLength(3); expect(first.now_cards.length).toBeLessThanOrEqual(5);
    expect(first.now_cards.map((card) => card.id)).toEqual(second.now_cards.map((card) => card.id));
    for (const card of first.now_cards) expect(card).toEqual(expect.objectContaining({ source_ref: expect.objectContaining({ source_id: expect.any(String), href: expect.any(String) }), deep_link: expect.stringMatching(/^\//), priority_reason: expect.any(String) }));
    expect(first.now_cards[0].id).toBe('rmm-census'); expect(first.freshness.source_observed_at).toBe(observedAt);
  });

  it('keeps partial state and source health when a module fails', async () => {
    const service = new Rh4663FrontdoorService(dependencies({ census: async () => { throw new Error('census store down'); } })); const state = await service.read();
    expect(state.system_status.state).toBe('partial'); expect(state.system_status.source_health.census).toMatchObject({ status: 'unavailable', detail: 'census store down' });
    expect(state.now_cards.some((card) => card.id === 'pltr-preflight')).toBe(true);
    expect(state.open_loops.some((loop) => loop.question.includes('PLTR'))).toBe(true);
  });

  it('uses one cached, batched read and never invents resolution dates', async () => {
    let calls = 0; const census = async () => { calls += 1; return dependencies().census(); };
    const service = new Rh4663FrontdoorService(dependencies({ census })); const before = JSON.stringify(await dependencies().census()); await service.read(); await service.read();
    expect(calls).toBe(1); expect(JSON.stringify(await dependencies().census())).toBe(before);
    expect((await service.read()).open_loops.every((loop) => loop.expected_resolution_at === null)).toBe(true);
  });

  it('propagates stale source time instead of calling the newly generated read LIVE', async () => {
    const stale = '2026-09-02T00:00:00.000Z'; const service = new Rh4663FrontdoorService({ ...dependencies({ census: async () => ({ census_id: 'stale-census', observed_at: stale, verified_pair_count: 1, distinct_verified_stock_tickers: 1, verification_coverage: { percentage: 100 }, category_evidence: { breadth_state: 'ANECDOTAL', persistence_state: 'PERSISTENCE_UNPROVEN' }, persistent_rmm_penetration: { status: 'UNAVAILABLE' } }) }), now: () => new Date('2026-09-03T12:05:00.000Z') });
    const state = await service.read(); expect(state.now_cards.find((card) => card.id === 'rmm-census')?.freshness).toBe(stale); expect(state.system_status.source_health.census.status).toBe('degraded');
  });

  it('emits a monotonic FRONTDOOR_VERSION only when semantic source state changes', async () => {
    let calls = 4; const service = new Rh4663FrontdoorService({ ...dependencies({ pulse: async () => ({ window: { window_id: 'rh4663:2026-09-03', opens_at: observedAt, closes_at: '2026-09-04T00:00:00.000Z' }, consensus: { state: 'available', leading_rotation: 'STOCK_TOKENS', total_calls: calls } }) }), ttl_ms: 0 });
    const first = await service.read(); const unchanged = await service.read(); calls = 5; const changed = await service.read();
    expect(first.frontdoor_version).toMatchObject({ object_type: 'FRONTDOOR_VERSION', version: 1, changed: expect.arrayContaining(['RMM_CENSUS', 'AI_NVDA_CASE', 'PULSE']) });
    expect(unchanged.frontdoor_version).toMatchObject({ version: 1, changed: [] });
    expect(changed.frontdoor_version).toMatchObject({ version: 2, changed: ['PULSE'] });
  });

  it('sends a compact cacheable HTTP snapshot with ETag revalidation', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository());
    try {
      const first = await app.inject({ method: 'GET', url: '/v1/4663/frontdoor' });
      expect(first.statusCode).toBe(200); expect(first.headers.etag).toMatch(/^"frontdoor-\d+"$/); expect(first.headers['cache-control']).toContain('stale-while-revalidate');
      expect(first.json().data.object_type).toBe('RH_4663_FRONTDOOR_STATE');
      const cached = await app.inject({ method: 'GET', url: '/v1/4663/frontdoor', headers: { 'if-none-match': first.headers.etag! } }); expect(cached.statusCode).toBe(304);
    } finally { await app.close(); }
  });
});
