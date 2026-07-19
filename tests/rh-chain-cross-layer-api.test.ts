import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { InMemoryRhChainMarketSnapshotStore, type RhChainMarketSnapshot } from '../src/services/rhChainMarketSnapshotService';
import { InMemoryRhChainReviewedClassificationStore, RhChainReviewedClassificationService } from '../src/services/rhChainReviewedClassificationService';

// Keep the approved record safely in the past relative to the test runner so
// the API test exercises the active projection rather than future scheduling.
const NOW = '2026-07-18T12:00:00.000Z';
const INDEX_CONTRACT = '0x56910d4409f3a0c78c64dd8d0545ff0705389870';
const DURABLE_CONTRACT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const saved = { classifications: process.env.RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED, console: process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED, token: process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN, dex: process.env.DEXSCREENER_ENABLED };

afterEach(() => {
  for (const [name, value] of Object.entries({ RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED: saved.classifications, RH_CHAIN_REVIEW_CONSOLE_ENABLED: saved.console, RH_CHAIN_REVIEW_ADMIN_TOKEN: saved.token, DEXSCREENER_ENABLED: saved.dex })) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  vi.restoreAllMocks();
});

function enable() {
  process.env.RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED = 'true';
  process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true';
  process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'review-secret';
}

async function approvedStore(exactContract = DURABLE_CONTRACT, primary = 'agent', secondary = ['defi']) {
  const store = new InMemoryRhChainReviewedClassificationStore();
  const service = new RhChainReviewedClassificationService(store, { now: () => new Date(NOW) });
  await service.propose({ chain: 'robinhood', contract: exactContract, primary_layer: primary, secondary_layers: secondary, confidence: 'high', classification_evidence: [{ evidence_id: 'primary', kind: 'primary_source', source_name: 'Project documentation', source_url: 'https://example.com/source', summary: 'Exact-contract documentation supports both reviewed layers.', observed_at: NOW, content_hash: null }], review_status: 'proposed', source: 'internal_research', manual_override_reason: null, audit_note: 'Reviewed exact-contract proposal.' }, 'reviewer');
  await service.approve({ contract: exactContract }, { expected_version: 1, audit_note: 'Approved exact-contract evidence.' }, 'approver');
  return store;
}

function storedSnapshot(exactContract = DURABLE_CONTRACT): RhChainMarketSnapshot {
  return { snapshot_id: 'cross-layer-snapshot', captured_at: NOW, provider: 'dexscreener', chain_id: 'robinhood', token_address: exactContract, ticker: 'DURABLE', pair_address: '0xpair', dex_id: 'uniswap', price_usd: 1.25, liquidity_usd: 2_500, market_cap: 25_000, fdv: 30_000, volume_h24: 9_000, volume_h6: 3_000, volume_h1: 500, txns_h24_buys: 18, txns_h24_sells: 11, txns_h6_buys: 5, txns_h6_sells: 3, price_change_h24: 4, pair_created_at: '2026-07-01T00:00:00.000Z', active_boosts: 2, paid_order_types: ['tokenProfile'], paid_order_statuses: ['approved'], data_mode: 'live_cached', source_url: 'https://dexscreener.com/robinhood/pair', freshness_state: 'fresh', raw_data_version: 'dexscreener-v1', cache_status: 'fresh', cache_provenance: 'historical_snapshot' };
}

function provider() {
  return {
    getLatestTokenProfiles: vi.fn(async () => []), getLatestCommunityTakeovers: vi.fn(async () => []), getLatestAds: vi.fn(async () => []),
    getLatestBoosts: vi.fn(async () => []), getTopBoosts: vi.fn(async () => []), getPaidOrders: vi.fn(async () => []),
    getTokenPairs: vi.fn(async () => []), getTokenBatch: vi.fn(async () => ({})), getPair: vi.fn(async () => null)
  };
}

describe('RH Chain Cross-Layer API integration', () => {
  it('enhances the canonical endpoint additively without provider calls', async () => {
    enable(); process.env.DEXSCREENER_ENABLED = 'true';
    const reviewed = await approvedStore();
    const snapshots = new InMemoryRhChainMarketSnapshotStore(); await snapshots.save(storedSnapshot());
    const marketProvider = provider();
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainReviewedClassificationStore: reviewed, rhChainMarketSnapshotStore: snapshots, rhChainMarketDataOptions: { provider: marketProvider, enabled: true } });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/market-structure/cross-layer' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({ title: 'Cross-Layer Assets', integration_enabled: true, captured_at: expect.any(String), reviewed_project_count: expect.any(Number), provider_provenance: { external_requests_in_path: false }, classification_provenance: { exact_contract_only: true }, bounded_universe: expect.stringContaining('not complete Robinhood Chain accounting') });
      expect(response.json().data.entries).toEqual(expect.arrayContaining([expect.objectContaining({ contract: DURABLE_CONTRACT, category: 'agent_x_defi', market_data: expect.objectContaining({ available: true, liquidity_usd: 2_500 }) })]));
      const socialCard = await app.inject({ method: 'GET', url: '/og/rh-chain/cross-layer.png' });
      expect(socialCard.statusCode).toBe(200);
      expect(socialCard.headers['content-type']).toContain('image/png');
      expect(socialCard.rawPayload.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      for (const call of Object.values(marketProvider)) expect(call).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('keeps the disabled canonical response on the legacy Cross-Layer path', async () => {
    delete process.env.RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED;
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/market-structure/cross-layer' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({ title: 'Cross-Layer Assets', categories: expect.any(Array), observed_at: expect.any(String), caveats: expect.any(Array) });
      expect(response.json().data.integration_enabled).toBeUndefined();
      expect(response.json().data.entries.some((entry: { display_name: string }) => entry.display_name === 'GROKIUS')).toBe(true);
    } finally { await app.close(); }
  });

  it('exposes curated/durable disagreements only through an authenticated read-only internal route', async () => {
    enable();
    const reviewed = await approvedStore(INDEX_CONTRACT, 'agent', ['rwa']);
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainReviewedClassificationStore: reviewed });
    try {
      const path = '/internal/rh-chain/market-structure/cross-layer/conflicts';
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(401);
      const response = await app.inject({ method: 'GET', url: path, headers: { authorization: 'Bearer review-secret' } });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({ conflict_count: 1, conflicts: [expect.objectContaining({ contract: INDEX_CONTRACT, resolution: 'curated_memory_preserved' })], resolution_policy: expect.stringContaining('existing protected reviewed-classification operations') });
      expect(response.json().data).not.toHaveProperty('mutation');
    } finally { await app.close(); }
  });

  it('preserves Market Pulse, Live Snapshot, 4663, and Review Queue routes while enabled', async () => {
    enable(); const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainReviewedClassificationStore: await approvedStore() });
    try {
      for (const path of ['/v1/rh-chain/market', '/v1/rh-chain/live-snapshot', '/v1/rh-chain/4663-index', '/v1/rh-chain/review-queue', '/v1/rh-chain/market-structure']) {
        const response = await app.inject({ method: 'GET', url: path });
        expect(response.statusCode, path).toBe(200);
      }
    } finally { await app.close(); }
  });
});
