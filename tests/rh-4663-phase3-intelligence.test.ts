import { describe, expect, it, vi } from 'vitest';
import { InMemoryRh4663Store, Rh4663Service } from '../src/services/rh4663Service';
import {
  InMemoryRh4663IntelligenceStore,
  Rh4663IntelligenceService,
  rankPublishedSignalsForToday,
  type Rh4663IntelligenceOptions,
  type Rh4663RawObservationInput
} from '../src/services/rh4663IntelligenceService';

const fixed = new Date('2026-08-14T15:42:00.000Z');
const subject = { subject_type: 'token_contract', subject_id: '0x1111111111111111111111111111111111111111', label: 'CASHCAT' };
const base: Rh4663RawObservationInput = {
  provider: 'dexscreener', provider_observation_id: 'dex:cashcat:volume:1', source_type: 'dex_market', observed_at: fixed.toISOString(),
  category: 'MEMES', subject, metric: 'volume_24h_usd', previous_value: 100_000, current_value: 284_000, units: 'USD',
  provider_reference: 'pair-cashcat', source_url: 'https://example.com/dex/cashcat', confidence: 88, freshness: 'fresh', event_type: 'VOLUME_SPIKE',
  baseline: { mean: 90_000, standard_deviation: 20_000, sample_size: 30, window: '30 snapshots' }, dimensions: { persistence_windows: 4, velocity_percent: 92, subject_importance: 70 }
};

function service(overrides: Partial<Rh4663IntelligenceOptions> = {}) {
  const events = new InMemoryRh4663Store(); const intelligence = new InMemoryRh4663IntelligenceStore();
  const options: Rh4663IntelligenceOptions = { enabled: true, ingestion_enabled: true, candidate_generation_enabled: true, publication_enabled: true, auto_publication_enabled: false, external_distribution_enabled: false, shadow_mode: false, is_production: false, phase2_production_proof_verified: false, now: () => fixed, ...overrides };
  return { events, intelligence, engine: new Rh4663IntelligenceService(events, intelligence, options) };
}

describe('Infopunks //4663 Phase 3 intelligence engine', () => {
  it('persists, normalizes, scores, assembles evidence, and creates an inspectable candidate deterministically', async () => {
    const { engine, intelligence } = service(); const first = await engine.ingest(base);
    expect(first).toMatchObject({ observation_created: true, event_deduplicated: false, state: 'candidate' });
    expect(first.event).toMatchObject({ event_type: 'VOLUME_SPIKE', intelligence_category: 'MEMES', heuristic_version: 'infopunks.rh4663.heuristics.v1', freshness_state: 'fresh', lifecycle_state: 'normalized' });
    expect(first.event?.significance_score).toBeGreaterThanOrEqual(70); expect(first.event?.anomaly_score).toBe(100);
    expect(first.event?.score_components).toEqual(expect.objectContaining({ magnitude: expect.any(Number), cross_provider_confirmation: 35, source_quality: 88 }));
    expect(first.candidate).toMatchObject({ signal_type: 'VOLUME_SPIKE', risk_class: 'low', publication_state: 'held', heuristic_version: 'infopunks.rh4663.heuristics.v1' });
    expect(first.candidate?.headline).toContain('+184%'); expect(first.candidate?.summary).toContain('284,000 USD');
    expect(first.candidate?.summary).not.toContain('999'); expect((await intelligence.listObservations()).length).toBe(1);
    const replay = await engine.ingest(base); expect(replay.observation_created).toBe(false); expect((await intelligence.listCandidates()).length).toBe(1);
  });

  it('merges the same provider-independent event across sources and auto-publishes it exactly once when enabled', async () => {
    const { engine, intelligence, events } = service({ auto_publication_enabled: true });
    const first = await engine.ingest(base); expect(first.candidate?.publication_state).toBe('held');
    const confirmed = await engine.ingest({ ...base, provider: 'blockscout', provider_observation_id: 'block:cashcat:volume:1', source_type: 'chain_explorer', provider_reference: 'block-100', source_url: 'https://example.com/block/100', confidence: 91 });
    expect(confirmed.event_deduplicated).toBe(true); expect(confirmed.event?.evidence).toHaveLength(2); expect(confirmed.event?.source_ids).toEqual(['blockscout', 'dexscreener']);
    expect(confirmed.candidate?.publication_state).toBe('auto_publishable'); expect(confirmed.publication).toMatchObject({ representation_kind: 'SIGNAL_CARD', immutable: true, source_count: 2, distribution_state: 'not_queued' });
    expect(confirmed.publication?.semantics).toContain('not an Evidence Receipt or Protocol Receipt');
    const publication = confirmed.publication!; publication.headline = 'mutated outside'; expect((await intelligence.getPublication(publication.signal_id))?.headline).not.toBe('mutated outside');
    expect((await intelligence.listPublications()).length).toBe(1); expect((await events.getEvent(confirmed.event!.event_id))?.lifecycle_state).toBe('published');
  });

  it('keeps production publication fail-closed until explicit Phase 2 production proof is verified', async () => {
    const { engine } = service({ is_production: true, phase2_production_proof_verified: false, auto_publication_enabled: true });
    await engine.ingest(base); const result = await engine.ingest({ ...base, provider: 'blockscout', provider_observation_id: 'block:proof-gate', source_type: 'chain_explorer', provider_reference: 'block-101', source_url: 'https://example.com/block/101' });
    expect(result.candidate?.publication_state).toBe('auto_publishable'); expect(result.publication).toBeNull(); expect(engine.activation()).toMatchObject({ publication_enabled: false, auto_publication_enabled: false, fail_closed: true, phase2_production_proof_verified: false });
    await expect(engine.publish(result.candidate!.candidate_id, 'reviewer')).rejects.toMatchObject({ code: 'phase2_production_proof_required' });
  });

  it('separates anomaly from significance and never upgrades unusual behavior into malicious language', async () => {
    const { engine } = service(); const result = await engine.ingest({ ...base, provider_observation_id: 'wallet:concentration:1', category: 'WALLET', metric: 'wallet_concentration_percent', previous_value: 12, current_value: 18, units: 'percent', event_type: 'WALLET_CONCENTRATION_CHANGE', baseline: { mean: 12, standard_deviation: 1, sample_size: 20, window: '20 snapshots' } });
    expect(result.event?.anomaly_score).toBe(100); expect(result.candidate?.risk_class).toBe('medium'); expect(result.candidate?.publication_state).toBe('review_required');
    expect(`${result.candidate?.headline} ${result.candidate?.summary}`).toContain('UNUSUAL WALLET CONCENTRATION'); expect(`${result.candidate?.headline} ${result.candidate?.summary}`).not.toMatch(/scam|fraud|malicious/i);
    const insufficient = await engine.ingest({ ...base, provider_observation_id: 'wallet:small-baseline', observed_at: '2026-08-14T16:42:00.000Z', metric: 'holder_count', previous_value: 100, current_value: 110, event_type: 'HOLDER_CHANGE', baseline: { mean: 100, standard_deviation: 2, sample_size: 4, window: '4 snapshots' } });
    expect(insufficient.event?.anomaly_score).toBe(0); expect(insufficient.event?.anomaly_basis).toBe('insufficient_history_no_anomaly_inference');
  });

  it('holds stale or insufficient evidence and sanitizes provider strings before public copy', async () => {
    const { engine } = service(); const stale = await engine.ingest({ ...base, provider_observation_id: 'stale:1', freshness: 'stale', source_url: '/v1/4663/evidence/stale', dimensions: { ...base.dimensions, invented_number: 999 } });
    expect(stale.candidate?.publication_state).toBe('held'); expect(stale.candidate?.policy_reasons).toContain('evidence_not_fresh'); expect(stale.candidate?.summary).not.toContain('999');
    await expect(engine.ingest({ ...base, provider_observation_id: 'bad-url', source_url: 'javascript:alert(1)' })).rejects.toBeDefined();
  });

  it('forces accusation-like and security claims through stronger evidence and existing reviewer authorization', async () => {
    const { engine } = service(); const risky = { ...base, metric: 'contract_risk_score', previous_value: 10, current_value: 95, category: 'SECURITY' as const, event_type: 'CONTRACT_RISK' as const, baseline: { mean: 10, standard_deviation: 5, sample_size: 20, window: '20 snapshots' }, dimensions: { velocity_percent: 100, persistence_windows: 5, subject_importance: 90, untrusted_provider_text: 'SCAM rug malicious contract' } };
    const one = await engine.ingest({ ...risky, provider_observation_id: 'risk:one' }); expect(one.candidate).toMatchObject({ risk_class: 'high', publication_state: 'review_required', headline: 'CONTRACT BEHAVIOR REQUIRES REVIEW' });
    expect(one.candidate?.summary).toContain('No malicious cause is asserted'); await expect(engine.publish(one.candidate!.candidate_id, null)).rejects.toMatchObject({ code: 'reviewer_authorization_required' });
    await engine.ingest({ ...risky, provider: 'blockscout', source_type: 'chain_explorer', provider_observation_id: 'risk:two', source_url: 'https://example.com/risk/two' });
    const three = await engine.ingest({ ...risky, provider: 'reviewed_memory', source_type: 'reviewed_evidence', provider_observation_id: 'risk:three', source_url: 'https://example.com/risk/three' });
    const published = await engine.publish(three.candidate!.candidate_id, 'reviewer-1'); expect('risk_class' in published).toBe(false); expect(published.headline).toBe('CONTRACT BEHAVIOR REQUIRES REVIEW');
  });

  it('preserves Signal Hunt finder attribution through confirmed community normalization', async () => {
    const { engine, events } = service(); const hunt = new Rh4663Service(events, () => fixed);
    const submitted = await hunt.submitSignal({ title: 'Culture wallets are rotating', category: 'nft_culture', thesis: 'Two cited communities show a new mint activity pattern.', submitter: '@first_finder', source_url: 'https://example.com/community/source' });
    await hunt.transitionSignal(submitted.signal_id, { state: 'watching', note: 'Entered evidence watch.' }, 'reviewer-1');
    await hunt.addSignalEvidence(submitted.signal_id, { url: 'https://example.com/community/evidence', label: 'Mint evidence' }, 'reviewer-1');
    const confirmed = await hunt.transitionSignal(submitted.signal_id, { state: 'confirmed', note: 'Community evidence confirmed.' }, 'reviewer-1');
    const results = await engine.ingestCommunitySignal(confirmed); const candidate = results.find((result) => result.candidate)?.candidate;
    expect(candidate).toMatchObject({ signal_type: 'COMMUNITY_SIGNAL', risk_class: 'medium', publication_state: 'review_required', finder_attribution: { submitted_by: '@first_finder', submitted_at: fixed.toISOString(), first_seen_at: fixed.toISOString(), evidence_added_at: fixed.toISOString(), confirmed_at: fixed.toISOString() } });
  });

  it('appends corrections without mutating original publication history', async () => {
    const { engine, intelligence } = service(); await engine.ingest(base); const ready = await engine.ingest({ ...base, provider: 'blockscout', source_type: 'chain_explorer', provider_observation_id: 'correction:confirm', provider_reference: 'block-102', source_url: 'https://example.com/block/102' }); const published = await engine.publish(ready.candidate!.candidate_id, 'reviewer-1');
    const originalHash = published.publication_hash; await engine.correct(published.signal_id, { correction_type: 'UPDATED_EVIDENCE', note: 'Provider corrected the comparison window.', evidence: [] }, 'reviewer-1');
    const detail = await engine.publicSignal(published.signal_id); expect(detail).toMatchObject({ publication_hash: originalHash, correction_state: 'UPDATED_EVIDENCE' }); expect(detail?.corrections).toHaveLength(1); expect((await intelligence.getPublication(published.signal_id))?.summary).toBe(published.summary);
  });

  it('replays historical observations deterministically with zero public writes', async () => {
    const { engine, intelligence } = service(); await engine.ingest(base); const before = await intelligence.listPublications(); const first = await engine.backtest(); const second = await engine.backtest(); expect(first).toEqual(second); expect(first).toMatchObject({ mode: 'backtest', public_writes: 0, observation_count: 1, heuristic_version: 'infopunks.rh4663.heuristics.v1' }); expect(await intelligence.listPublications()).toEqual(before);
  });

  it('isolates provider timeout failures and records degraded health without crashing the run', async () => {
    const { engine, intelligence } = service(); const healthy = vi.fn().mockResolvedValue([base]); const result = await engine.runProviders([{ name: 'slow', enabled: true, timeout_ms: 5, max_retries: 1, collect: () => new Promise(() => {}) }, { name: 'healthy', enabled: true, timeout_ms: 100, max_retries: 0, collect: healthy }]);
    expect(result.state).toBe('complete'); expect(result.providers).toEqual(expect.arrayContaining([expect.objectContaining({ provider: 'slow', state: 'degraded', error_code: 'provider_timeout' }), expect.objectContaining({ provider: 'healthy', state: 'healthy' })])); expect(healthy).toHaveBeenCalledOnce(); expect(await intelligence.listProviderHealth()).toEqual(expect.arrayContaining([expect.objectContaining({ provider: 'slow', state: 'degraded', consecutive_failures: 1 })]));
  });

  it('ranks Today with category diversity before repeated noisy subjects', () => {
    const make = (id: string, category: 'MEMES' | 'STOCK_TOKENS' | 'RWA_DEFI', score: number) => ({ signal_id: id, category, significance_score: score, anomaly_score: 0, source_count: 2, published_at: fixed.toISOString() }) as never;
    const ranked = rankPublishedSignalsForToday([make('meme-1', 'MEMES', 99), make('meme-2', 'MEMES', 98), make('stock-1', 'STOCK_TOKENS', 80), make('rwa-1', 'RWA_DEFI', 70)], 3);
    expect(ranked.map((signal) => signal.category)).toEqual(['MEMES', 'STOCK_TOKENS', 'RWA_DEFI']);
  });

  it('serves all required lenses from the same immutable publication store', async () => {
    const { engine } = service(); for (const category of ['MEMES', 'STOCK_TOKENS', 'RWA_DEFI', 'STABLES', 'CULTURE_NFT'] as const) expect(await engine.lens(category)).toMatchObject({ lens: category, source: 'shared_normalized_4663_event_system', provider_requests_in_path: 0 }); const rotation = await engine.rotation(); expect(rotation).toMatchObject({ object_type: 'LIVE_ROTATION_SIGNAL', protocol_resolution: false, leader: null });
  });
});
