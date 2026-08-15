import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { MemoryRepository } from '../src/persistence/repository';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { InMemoryRh4663Store } from '../src/services/rh4663Service';
import { InMemoryRh4663IntelligenceStore } from '../src/services/rh4663IntelligenceService';

const phase3Vars = ['NODE_ENV', 'RH_CHAIN_REVIEW_ADMIN_TOKEN', 'RH_4663_PHASE3_ENABLED', 'RH_4663_PHASE3_INGESTION_ENABLED', 'RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED', 'RH_4663_PHASE3_PUBLICATION_ENABLED', 'RH_4663_AUTO_PUBLICATION_ENABLED', 'RH_4663_PHASE3_SHADOW_MODE'] as const;
afterEach(() => { for (const key of phase3Vars) delete process.env[key]; });

function observation(provider: string, providerObservationId: string) {
  return { provider, provider_observation_id: providerObservationId, source_type: provider === 'dexscreener' ? 'dex_market' : 'chain_explorer', observed_at: '2026-08-14T15:42:00.000Z', category: 'STOCK_TOKENS', subject: { subject_type: 'token_contract', subject_id: '0x1111111111111111111111111111111111111111', label: 'NVDA' }, metric: 'volume_24h_usd', previous_value: 100_000, current_value: 284_000, units: 'USD', provider_reference: `${provider}:reference`, source_url: `https://example.com/${provider}`, confidence: 90, freshness: 'fresh', event_type: 'VOLUME_SPIKE', baseline: { mean: 90_000, standard_deviation: 20_000, sample_size: 30, window: '30 snapshots' }, dimensions: { velocity_percent: 100, persistence_windows: 4, subject_importance: 80 } };
}

describe('Infopunks //4663 Phase 3 API', () => {
  it('runs the protected evidence-to-publication chain and exposes proof, lens, archive, correction, share, and Today surfaces', async () => {
    process.env.NODE_ENV = 'test'; process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'phase3-review'; process.env.RH_4663_PHASE3_ENABLED = 'true'; process.env.RH_4663_PHASE3_INGESTION_ENABLED = 'true'; process.env.RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED = 'true'; process.env.RH_4663_PHASE3_PUBLICATION_ENABLED = 'true'; process.env.RH_4663_PHASE3_SHADOW_MODE = 'false';
    const intelligence = new InMemoryRh4663IntelligenceStore(); const events = new InMemoryRh4663Store(); const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: events, rh4663IntelligenceStore: intelligence }); const auth = { authorization: 'Bearer phase3-review', 'x-rh-chain-reviewer-id': 'reviewer-1' };
    try {
      expect((await app.inject({ method: 'POST', url: '/internal/4663/intelligence/observations', payload: observation('dexscreener', 'nvda-volume-1') })).statusCode).toBe(401);
      const first = await app.inject({ method: 'POST', url: '/internal/4663/intelligence/observations', headers: auth, payload: observation('dexscreener', 'nvda-volume-1') }); expect(first.statusCode).toBe(201); expect(first.json().data).toMatchObject({ observation_created: true, candidate: { publication_state: 'held' } });
      const second = await app.inject({ method: 'POST', url: '/internal/4663/intelligence/observations', headers: auth, payload: observation('blockscout', 'nvda-volume-2') }); expect(second.statusCode).toBe(201); expect(second.json().data).toMatchObject({ event_deduplicated: true, candidate: { publication_state: 'auto_publishable' } });
      const candidateId = second.json().data.candidate.candidate_id;
      const unpublished = await app.inject({ method: 'GET', url: '/v1/4663/signals' }); expect(unpublished.json().data.signals).toHaveLength(0);
      const publish = await app.inject({ method: 'POST', url: `/internal/4663/intelligence/candidates/${candidateId}/action`, headers: auth, payload: { action: 'publish', note: 'Evidence and numeric comparison verified.' } }); expect(publish.statusCode).toBe(200); const signal = publish.json().data.signal; expect(signal).toMatchObject({ representation_kind: 'SIGNAL_CARD', immutable: true, category: 'STOCK_TOKENS', source_count: 2 });
      const list = await app.inject({ method: 'GET', url: '/v1/4663/signals?category=STOCK_TOKENS&subject=0x1111111111111111111111111111111111111111&publication_state=published' }); expect(list.statusCode).toBe(200); expect(list.json().data).toMatchObject({ provider_requests_in_path: 0, signals: [expect.objectContaining({ signal_id: signal.signal_id })] });
      expect((await app.inject({ method: 'GET', url: '/v1/4663/signals?publication_state=review_required' })).statusCode).toBe(400);
      const detail = await app.inject({ method: 'GET', url: `/v1/4663/signals/${signal.signal_id}` }); expect(detail.json().data).toMatchObject({ publication_hash: signal.publication_hash, correction_state: 'ORIGINAL', corrections: [] });
      const evidence = await app.inject({ method: 'GET', url: `/v1/4663/signals/${signal.signal_id}/evidence` }); expect(evidence.json().data.evidence).toHaveLength(2); expect(evidence.json().data.traceability).toContain('persisted evidence');
      const eventsResponse = await app.inject({ method: 'GET', url: '/v1/4663/events' }); expect(eventsResponse.json().data.events).toEqual([expect.objectContaining({ lifecycle_state: 'published', publication_state: 'public' })]);
      const lens = await app.inject({ method: 'GET', url: '/v1/4663/lenses/stock_tokens' }); expect(lens.json().data).toMatchObject({ lens: 'STOCK_TOKENS', signal_count: 1, provider_requests_in_path: 0 });
      const rotation = await app.inject({ method: 'GET', url: '/v1/4663/rotation' }); expect(rotation.json().data).toMatchObject({ object_type: 'LIVE_ROTATION_SIGNAL', protocol_resolution: false });
      const today = await app.inject({ method: 'GET', url: '/v1/4663/today' }); expect(today.statusCode).toBe(200); expect(today.json().data.intelligence_signal_ids).toContain(signal.signal_id); expect(today.json().data.top_events[0].title).toBe(signal.headline);
      const correction = await app.inject({ method: 'POST', url: `/internal/4663/intelligence/signals/${signal.signal_id}/corrections`, headers: auth, payload: { correction_type: 'UPDATED_EVIDENCE', note: 'Provider corrected the observation window.' } }); expect(correction.statusCode).toBe(200);
      const distribution = await app.inject({ method: 'POST', url: `/internal/4663/intelligence/signals/${signal.signal_id}/distribution`, headers: auth }); expect(distribution.statusCode).toBe(503); expect(distribution.json()).toMatchObject({ error: 'external_distribution_disabled' });
      const corrected = await app.inject({ method: 'GET', url: `/v1/4663/signals/${signal.signal_id}` }); expect(corrected.json().data).toMatchObject({ publication_hash: signal.publication_hash, correction_state: 'UPDATED_EVIDENCE' }); expect(corrected.json().data.corrections).toHaveLength(1);
      for (const format of ['landscape', 'square', 'portrait']) { const image = await app.inject({ method: 'GET', url: `/og/4663/signals/${signal.signal_id}.png?format=${format}` }); expect(image.statusCode).toBe(200); expect(image.headers['content-type']).toContain('image/png'); }
    } finally { await app.close(); }
  });

  it('keeps backtests private and documents all Phase 3 public and protected surfaces', async () => {
    process.env.NODE_ENV = 'test'; process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'phase3-review'; process.env.RH_4663_PHASE3_ENABLED = 'true'; process.env.RH_4663_PHASE3_INGESTION_ENABLED = 'true'; process.env.RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED = 'true';
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store(), rh4663IntelligenceStore: new InMemoryRh4663IntelligenceStore() }); const auth = { authorization: 'Bearer phase3-review', 'x-rh-chain-reviewer-id': 'reviewer-1' };
    try {
      await app.inject({ method: 'POST', url: '/internal/4663/intelligence/observations', headers: auth, payload: observation('dexscreener', 'backtest-1') });
      const before = (await app.inject({ method: 'GET', url: '/v1/4663/signals' })).json().data.signals;
      const backtest = await app.inject({ method: 'POST', url: '/internal/4663/intelligence/backtest', headers: auth, payload: {} }); expect(backtest.json().data).toMatchObject({ mode: 'backtest', public_writes: 0, observation_count: 1, results: [expect.objectContaining({ heuristic_version: 'infopunks.rh4663.heuristics.v1' })] });
      expect((await app.inject({ method: 'GET', url: '/v1/4663/signals' })).json().data.signals).toEqual(before);
      const paths = (await app.inject({ method: 'GET', url: '/openapi.json' })).json().paths;
      for (const path of ['/v1/4663/signals/{signalId}', '/v1/4663/signals/{signalId}/evidence', '/v1/4663/lenses/{lens}', '/v1/4663/rotation', '/internal/4663/intelligence/run', '/internal/4663/intelligence/observations', '/internal/4663/intelligence/candidates', '/internal/4663/intelligence/candidates/{candidateId}/action', '/internal/4663/intelligence/signals/{signalId}/corrections', '/internal/4663/intelligence/signals/{signalId}/distribution', '/internal/4663/intelligence/backtest', '/internal/4663/intelligence/metrics', '/internal/4663/intelligence/activation']) expect(paths[path]).toBeDefined();
    } finally { await app.close(); }
  });
});
