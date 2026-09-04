import { afterEach, describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/api/app';
import { MemoryRepository } from '../src/persistence/repository';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { InMemoryRh4663Store, Rh4663Service, type Rh4663NormalizedEvent } from '../src/services/rh4663Service';
import { InMemoryRh4663ResolutionStore } from '../src/services/rh4663ResolutionService';
import { InMemoryRh4663PrintStore } from '../src/services/rh4663PrintGeneratorService';
import { RH_4663_PRINT_0830 } from '../src/services/rh4663PrintService';

const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
afterEach(() => { delete process.env.NODE_ENV; delete process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN; delete process.env.RH_4663_PHASE2_ENABLED; });

describe('Infopunks //4663 API', () => {
  it('fails soft when persisted 4663 observations are unavailable', async () => {
    process.env.NODE_ENV = 'test';
    class Unavailable4663Store extends InMemoryRh4663Store {
      override async listCalls(): Promise<never> { throw new Error('storage unavailable'); }
      override async genesisCount(): Promise<never> { throw new Error('storage unavailable'); }
      override async listSignals(): Promise<never> { throw new Error('storage unavailable'); }
      override async getToday(): Promise<never> { throw new Error('storage unavailable'); }
    }
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new Unavailable4663Store() });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/4663' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({ pulse: { storage_status: 'unavailable', consensus: { state: 'unavailable' } }, today: { provider_state: 'unavailable', storage_status: 'unavailable', confidence: 0 }, genesis: { storage_status: 'unavailable' }, signal_hunt: { count: 0 } });
      expect(JSON.stringify(response.json())).toContain('No missing live observation has been fabricated');
    } finally { await app.close(); }
  });

  it('serves the additive operating surface without changing existing RH or Solana contracts', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const overview = await app.inject({ method: 'GET', url: '/v1/4663' });
      expect(overview.statusCode).toBe(200);
      expect(overview.json().data).toEqual(expect.objectContaining({ identity: 'INFOPUNKS // 4663', thesis: 'WE WATCH THE FLOW.', rotation_snapshot: expect.any(Object), today: expect.any(Object), genesis: expect.any(Object) }));
      for (const legacy of ['/v1/rh-chain', '/v1/rh-chain/4663-index', '/v1/rh-chain/daily-receipts', '/v1/pulse']) expect((await app.inject({ method: 'GET', url: legacy })).statusCode).toBe(200);
    } finally { await app.close(); }
  });

  it('publishes the 0830 PRINT as sourced market-state evidence without calling Aug 30 the DEX-volume ATH', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/4663/prints/0830' });
      expect(response.statusCode).toBe(200);
      const print = response.json().data;
      expect(print).toMatchObject({ print_id: 'rh-print-2026-08-30', canonical_path: '/4663/print/2026-08-30', campaign_snapshot: true, receipt_kind: 'MARKET_STATE_EVIDENCE', regime: 'SPECULATIVE EXPANSION', call: { evidence_path: '/4663/print/2026-08-30', default_confidence: 74 } });
      expect(print.metrics).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'transactions', value: '5.52M', qualifier: 'ATH', window_start: '2026-08-30T00:00:00.000Z' }),
        expect.objectContaining({ id: 'utc_dex_volume', value: '$874.8M' }),
        expect.objectContaining({ id: 'calendar_day_ath', value: '~$920–944M', qualifier: 'AUG 25' }),
        expect.objectContaining({ id: 'pons_volume', value: '$445.98M', qualifier: '~51% of Aug 30 chain DEX volume' })
      ]));
      for (const metric of print.metrics) expect(metric).toEqual(expect.objectContaining({ source: expect.any(Object), observed_at: expect.any(String), window_start: expect.any(String), window_end: expect.any(String), methodology: expect.any(String), freshness: expect.any(String), confidence: expect.any(Number) }));
      expect((await app.inject({ method: 'GET', url: '/v1/4663/prints/latest' })).json().data.print_id).toBe('rh-print-2026-08-30');
      const candidate = await app.inject({ method: 'GET', url: '/v1/4663/print-candidate' }); expect(candidate.statusCode).toBe(200); expect(candidate.json().data.lifecycle).toBe('CANDIDATE'); expect(candidate.json().data.observations.some((item: { value: unknown }) => item.value === 0)).toBe(false);
      expect((await app.inject({ method: 'GET', url: '/v1/4663/prints/rh-print-2026-08-30/share' })).json().data.images.landscape).toContain('/og/4663/prints/');
      const image = await app.inject({ method: 'GET', url: '/og/4663/prints/rh-print-2026-08-30.png?format=portrait' }); expect(image.statusCode).toBe(200); expect(image.headers['content-type']).toContain('image/png');
    } finally { await app.close(); }
  });

  it('selects the latest frozen Print for /4663 while keeping the Aug 30 campaign object addressable', async () => {
    process.env.NODE_ENV = 'test'; const printStore = new InMemoryRh4663PrintStore();
    await printStore.freeze({ ...structuredClone(RH_4663_PRINT_0830), print_id: 'rh-print-2026-09-01', canonical_path: '/4663/print/2026-09-01', printed_at: '2026-09-02T00:00:00.000Z', status: 'frozen', campaign_snapshot: false, data_mode: 'verified_provider_snapshot' });
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store(), rh4663PrintStore: printStore });
    try {
      expect((await app.inject({ method: 'GET', url: '/v1/4663' })).json().data.latest_print.print_id).toBe('rh-print-2026-09-01');
      expect((await app.inject({ method: 'GET', url: '/v1/4663/prints/rh-print-2026-08-30' })).json().data.metrics.find((item: { id: string }) => item.id === 'utc_dex_volume').value).toBe('$874.8M');
    } finally { await app.close(); }
  });

  it('exposes only persisted final UTC-day observations and protects ingestion', async () => {
    process.env.NODE_ENV = 'test'; process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'phase2-review-token'; process.env.RH_4663_PHASE2_ENABLED = 'true';
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const observations = await app.inject({ method: 'GET', url: '/v1/4663/observations?date=2026-08-31' });
      expect(observations.statusCode).toBe(200); expect(observations.json().data).toMatchObject({ date: '2026-08-31', transactions: null, dex_volume: null, status: 'INCOMPLETE', warnings: expect.arrayContaining(['MISSING_FINAL_UTC_TRANSACTIONS', 'MISSING_FINAL_UTC_DEX_VOLUME']) });
      expect((await app.inject({ method: 'GET', url: '/v1/4663/observations?date=2026-02-30' })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/internal/4663/observations/utc-day/2026-08-31/refresh' })).statusCode).toBe(401);
      const guarded = await app.inject({ method: 'POST', url: '/internal/4663/observations/utc-day/2026-08-30/refresh', headers: { authorization: 'Bearer phase2-review-token', 'x-rh-chain-reviewer-id': 'ops-test' } });
      expect(guarded.statusCode).toBe(200); expect(guarded.json().data.status).toBe('INCOMPLETE');
    } finally { await app.close(); }
  });

  it('builds, verifies, stores, and re-reads an immutable protocol receipt', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const payload = { wallet: account.address, rotation: 'STOCK_TOKENS', confidence: 91 };
      const canonicalResponse = await app.inject({ method: 'POST', url: '/v1/4663/pulse/payload', payload });
      expect(canonicalResponse.statusCode).toBe(200);
      expect(canonicalResponse.json().data.payload).not.toHaveProperty('print_id');
      expect((await app.inject({ method: 'POST', url: '/v1/4663/pulse/payload', payload: { ...payload, print_id: 'rh-print-2026-08-30' } })).statusCode).toBe(400);
      const signature = await account.signMessage({ message: canonicalResponse.json().data.canonical_serialization });
      const created = await app.inject({ method: 'POST', url: '/v1/4663/pulse/calls', payload: { ...payload, signature } });
      expect(created.statusCode).toBe(201);
      expect(created.json().data).toMatchObject({ receipt_kind: 'PROTOCOL_RECEIPT', immutable: true, signature_verified: true, rotation: 'STOCK_TOKENS' });
      const receipt = await app.inject({ method: 'GET', url: `/v1/4663/receipts/${created.json().data.receipt_id}` });
      expect(receipt.json().data).toEqual(created.json().data);
      expect((await app.inject({ method: 'POST', url: '/v1/4663/pulse/calls', payload: { ...payload, signature } })).statusCode).toBe(409);
    } finally { await app.close(); }
  });

  it('accepts only allowlisted privacy-preserving campaign telemetry', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      expect((await app.inject({ method: 'POST', url: '/v1/4663/campaign/events', payload: { event: '4663_print_viewed', surface: 'print', print_id: 'rh-print-2026-08-30' } })).statusCode).toBe(202);
      expect((await app.inject({ method: 'POST', url: '/v1/4663/campaign/events', payload: { event: '4663_print_viewed', wallet: account.address } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/v1/4663/campaign/events', payload: { event: 'not_a_campaign_event' } })).statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it('validates confidence and preserves Signal Card semantics and attribution', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const invalid = await app.inject({ method: 'POST', url: '/v1/4663/pulse/payload', payload: { wallet: account.address, rotation: 'MEMES', confidence: 101 } });
      expect(invalid.statusCode).toBe(400);
      const submitted = await app.inject({ method: 'POST', url: '/v1/4663/signals', payload: { title: 'Liquidity route changed', category: 'liquidity', thesis: 'A cited pool route changed and should be watched.', submitter: '@origin', source_url: 'https://example.com/pool' } });
      expect(submitted.statusCode).toBe(201);
      expect(submitted.json().data).toMatchObject({ representation_kind: 'SIGNAL_CARD', original_submitter: '@origin', lifecycle_state: 'submitted', attribution_immutable: true });
      const evidence = await app.inject({ method: 'POST', url: `/v1/4663/signals/${submitted.json().data.signal_id}/evidence`, payload: { url: 'https://example.com/proof', label: 'Pool evidence' } });
      expect(evidence.json().data).toMatchObject({ original_submitter: '@origin', lifecycle_state: 'evidence_added' });
      const list = await app.inject({ method: 'GET', url: '/v1/4663/signals' });
      expect(list.json().data.guarantee_notice).toContain('not Evidence Receipts or Protocol Receipts');
    } finally { await app.close(); }
  });

  it('documents all public Phase 1 routes in OpenAPI', async () => {
    process.env.NODE_ENV = 'test'; const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: new InMemoryRh4663Store() });
    try {
      const paths = (await app.inject({ method: 'GET', url: '/openapi.json' })).json().paths;
      for (const path of ['/v1/4663', '/v1/4663/prints', '/v1/4663/prints/latest', '/v1/4663/prints/{printId}', '/v1/4663/prints/{printId}/share', '/v1/4663/print-candidate', '/v1/4663/observations', '/internal/4663/observations/utc-day/{date}/refresh', '/internal/4663/prints/{candidateId}/freeze', '/v1/4663/campaign/events', '/v1/4663/pulse', '/v1/4663/pulse/payload', '/v1/4663/pulse/calls', '/v1/4663/pulse/windows/{windowId}', '/v1/4663/pulse/windows/{windowId}/resolution', '/v1/4663/pulse/windows/{windowId}/share', '/v1/4663/pulse/receipts/{receiptId}/proof', '/v1/4663/pulse/receipts/{receiptId}/share', '/v1/4663/pulse/reputation/{wallet}', '/v1/4663/today', '/v1/4663/today/archive', '/v1/4663/signals', '/v1/4663/events', '/v1/4663/receipts']) expect(paths[path]).toBeDefined();
    } finally { await app.close(); }
  });

  it('protects, resolves, publishes, and publicly proves a closed window', async () => {
    process.env.NODE_ENV = 'test'; process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'phase2-review-token'; process.env.RH_4663_PHASE2_ENABLED = 'true';
    const store = new InMemoryRh4663Store(); const phase2 = new InMemoryRh4663ResolutionStore(); const seeded = new Rh4663Service(store, () => new Date('2026-08-12T12:00:00.000Z'));
    const input = { wallet: account.address, rotation: 'STOCK_TOKENS' as const, confidence: 91 }; const canonical = seeded.pulsePayload(input); const signature = await account.signMessage({ message: canonical.canonical_serialization }); const callReceipt = await seeded.call({ ...input, signature });
    const observation: Rh4663NormalizedEvent = { event_id: 'api-resolution-observation', detected_at: '2026-08-12T18:00:00.000Z', type: 'market.rotation.observed', subjects: [{ subject_type: 'market', subject_id: 'stock-token-flow' }], category: 'stock_token', metrics: {}, evidence: [], source_confidence: 90, anomaly_score: 0, significance_score: 80, lifecycle_state: 'confirmed', publication_state: 'public', source_status: 'fresh' }; await store.appendEvent(observation);
    await store.saveToday({ edition_id: 'today_4663_20260813_test', date: '2026-08-13', generated_at: '2026-08-13T12:00:00.000Z', top_events: [], category_flows: [], key_signal: 'Persisted test edition.', rh_pulse_consensus: null, evidence_references: [], confidence: 80, source_timestamps: [], provider_state: 'available', storage_status: 'memory', archive_path: '/v1/4663/today/2026-08-13', data_notice: 'Persisted test data.' });
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: store, rh4663ResolutionStore: phase2 });
    const windowId = encodeURIComponent('rh4663:2026-08-12'); const auth = { authorization: 'Bearer phase2-review-token', 'x-rh-chain-reviewer-id': 'ops-test' };
    try {
      expect((await app.inject({ method: 'POST', url: `/internal/4663/pulse/windows/${windowId}/resolve` })).statusCode).toBe(401);
      const resolved = await app.inject({ method: 'POST', url: `/internal/4663/pulse/windows/${windowId}/resolve`, headers: auth }); expect(resolved.statusCode).toBe(200); expect(resolved.json().data.resolution).toMatchObject({ state: 'resolved', resolved_category: 'STOCK_TOKENS' });
      const unpublished = await app.inject({ method: 'GET', url: `/v1/4663/pulse/windows/${windowId}/resolution` }); expect(unpublished.statusCode).toBe(404);
      const published = await app.inject({ method: 'POST', url: `/internal/4663/pulse/windows/${windowId}/publish`, headers: auth }); expect(published.statusCode).toBe(200); expect(published.json().data.receipts[0]).toMatchObject({ protocol_receipt_type: 'RESOLUTION', outcome: 'CORRECT' });
      const publicResolution = await app.inject({ method: 'GET', url: `/v1/4663/pulse/windows/${windowId}/resolution` }); expect(publicResolution.statusCode).toBe(200);
      const proof = await app.inject({ method: 'GET', url: `/v1/4663/pulse/receipts/${callReceipt.receipt_id}/proof` }); expect(proof.json().data.verified).toBe(true);
      const reputation = await app.inject({ method: 'GET', url: `/v1/4663/pulse/reputation/${account.address}` }); expect(reputation.json().data).toMatchObject({ calls: 1, resolved_calls: 1, correct_calls: 1, accuracy: 1, current_streak: 1 });
      const share = await app.inject({ method: 'GET', url: `/v1/4663/pulse/receipts/${callReceipt.receipt_id}/share` }); expect(share.json().data).toMatchObject({ object_type: 'resolved_correct_call', proof_url: `/4663/proof/${callReceipt.receipt_id}` });
      const windowShare = await app.inject({ method: 'GET', url: `/v1/4663/pulse/windows/${windowId}/share` }); expect(windowShare.json().data).toMatchObject({ object_type: 'window_result', consensus_category: 'STOCK_TOKENS', resolved_category: 'STOCK_TOKENS', consensus_correct: true });
      const today = await app.inject({ method: 'GET', url: '/v1/4663/today/2026-08-13' }); expect(today.json().data.rh_pulse.prior).toMatchObject({ consensus: { total_calls: 1, leading_rotation: 'STOCK_TOKENS' }, resolution: { resolved_category: 'STOCK_TOKENS', consensus_correct: true } });
      const image = await app.inject({ method: 'GET', url: `/og/4663/pulse/${callReceipt.receipt_id}.png?format=square` }); expect(image.statusCode).toBe(200); expect(image.headers['content-type']).toContain('image/png');
      const social = await app.inject({ method: 'GET', url: `/v1/4663/share/resolution_receipt:${encodeURIComponent(published.json().data.receipts[0].receipt_id)}` }); expect(social.statusCode).toBe(200); expect(social.json().data).toMatchObject({ share_type: 'RESOLUTION_RECEIPT', share_version: 'rh4663.share.v1', privacy_state: 'PUBLIC', immutability_state: 'IMMUTABLE' }); expect(social.headers['cache-control']).toContain('immutable');
      const socialImage = await app.inject({ method: 'GET', url: `/og/4663/resolution/${published.json().data.receipts[0].receipt_id}.png` }); expect(socialImage.statusCode).toBe(200); expect(socialImage.headers['cache-control']).toContain('immutable');
      expect((await app.inject({ method: 'POST', url: `/internal/4663/pulse/windows/${windowId}/publish`, headers: auth })).json().data.receipts).toEqual(published.json().data.receipts);
    } finally { await app.close(); }
  });
});
