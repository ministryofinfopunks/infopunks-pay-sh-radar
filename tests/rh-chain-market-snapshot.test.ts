import { describe, expect, it } from 'vitest';
import type { RhChainDexScreenerIngestionSource, RhChainMarketSnapshot as DexSnapshot, RhChainPaidOrder } from '../src/providers/dexscreenerProvider';
import { InMemoryRhChainMarketSnapshotStore, PostgresRhChainMarketSnapshotStore, RhChainMarketSnapshotService, type RhChainMarketSnapshot } from '../src/services/rhChainMarketSnapshotService';
import type { RhChainLayerClassification } from '../src/services/rhChainMarketStructureService';
import { createApp } from '../src/api/app';

const contract = '0x1111111111111111111111111111111111111111';
const classification: RhChainLayerClassification = { contract, ticker: 'MEMORY', display_name: 'Memory', dexscreener_pair: 'https://dexscreener.com/robinhood/pair', primary_layer: 'meme', secondary_layers: ['distribution'], cross_layer_category: null, classification_reason: 'Reviewed exact-contract test context.', classification_source: 'manual_review', classification_confidence: 'high', evidence_state: 'reviewed', missing_evidence: [], caveat: null, reviewed_at: '2026-07-17T00:00:00.000Z', observed_at: '2026-07-17T00:00:00.000Z', data_mode: 'manual' };

function dex(pairAddress = 'canonical', liquidity = 100, volume = 100): DexSnapshot {
  return { provider: 'dexscreener', chainId: 'robinhood', capturedAt: '2026-07-17T00:00:00.000Z', tokenAddress: contract, pairAddress, dexId: 'dex', priceUsd: 1, liquidityUsd: liquidity, marketCap: 1_000, fdv: 2_000, volume: { h24: volume, h6: 50, h1: 10 }, txns: { h24: { buys: 8, sells: 4 }, h6: { buys: 4, sells: 2 } }, priceChange: { h1: 20, h6: 30, h24: 40 }, pairCreatedAt: '2026-07-01T00:00:00.000Z', activeBoosts: 0, paidOrders: [], dataMode: 'live_cached', sourceUrl: 'https://dexscreener.com/robinhood/canonical' };
}
function provider(overrides: Partial<RhChainDexScreenerIngestionSource> = {}): RhChainDexScreenerIngestionSource {
  const orders: RhChainPaidOrder[] = [{ type: 'tokenProfile', status: 'approved', paymentTimestamp: null, observed_at: '2026-07-17T00:00:00.000Z', source: 'dexscreener_paid_attention' }];
  return { getLatestTokenProfiles: async () => [], getLatestCommunityTakeovers: async () => [], getLatestAds: async () => [], getLatestBoosts: async () => [], getTopBoosts: async () => [], getPaidOrders: async () => orders, getTokenPairs: async () => [dex('secondary', 50, 900), dex('canonical', 100, 100)], getTokenBatch: async () => ({ [contract]: [dex('secondary', 50, 900), dex('canonical', 100, 100)] }), getPair: async () => dex(), ...overrides };
}
function snapshot(id: string, capturedAt: string, overrides: Partial<RhChainMarketSnapshot> = {}): RhChainMarketSnapshot {
  return { snapshot_id: id, captured_at: capturedAt, provider: 'dexscreener', chain_id: 'robinhood', token_address: contract, ticker: 'MEMORY', pair_address: 'canonical', dex_id: 'dex', price_usd: 1, liquidity_usd: 100, market_cap: 1_000, fdv: 2_000, volume_h24: 100, volume_h6: 50, volume_h1: 10, txns_h24_buys: 8, txns_h24_sells: 4, txns_h6_buys: 4, txns_h6_sells: 2, price_change_h24: 0, pair_created_at: null, active_boosts: 0, paid_order_types: [], paid_order_statuses: [], data_mode: 'live_cached', source_url: 'https://dexscreener.com/robinhood/canonical', ...overrides };
}
function service(store = new InMemoryRhChainMarketSnapshotStore(), source = provider()) { return new RhChainMarketSnapshotService({ store, provider: source, enabled: true, watchlist: () => [contract], classificationFor: (value) => value.toLowerCase() === contract ? classification : null, narrativePersistenceFor: () => 15, now: () => new Date('2026-07-17T03:00:00.000Z') }); }

describe('RH Chain market snapshot history', () => {
  it('captures and normalizes canonical DEX Screener batch observations', async () => {
    const snapshots = new InMemoryRhChainMarketSnapshotStore();
    const result = await service(snapshots).captureKnownWatchlistSnapshot();
    expect(result.status).toBe('captured');
    expect(result.captured[0]).toMatchObject({ token_address: contract, ticker: 'MEMORY', pair_address: 'canonical', liquidity_usd: 100, volume_h6: 50, txns_h6_buys: 4, paid_order_types: ['tokenProfile'] });
    expect((await snapshots.list(contract))).toHaveLength(1);
  });

  it('deduplicates repeated observations by deterministic snapshot identity in memory', async () => {
    const snapshots = new InMemoryRhChainMarketSnapshotStore();
    const capture = service(snapshots);
    const first = await capture.captureKnownWatchlistSnapshot();
    const second = await capture.captureKnownWatchlistSnapshot();
    expect(first.captured[0].snapshot_id).toBe(second.captured[0].snapshot_id);
    expect(await snapshots.list(contract)).toHaveLength(1);
  });

  it('can ingest without writing when historical storage is independently disabled', async () => {
    const snapshots = new InMemoryRhChainMarketSnapshotStore();
    const capture = new RhChainMarketSnapshotService({ store: snapshots, provider: provider(), enabled: true, storageEnabled: false, watchlist: () => [contract] });
    const result = await capture.captureKnownWatchlistSnapshot();
    expect(result).toMatchObject({ status: 'captured', storage: { enabled: false, adapter: 'memory', durable: false, written: 0 } });
    expect(await snapshots.list(contract)).toEqual([]);
  });

  it('uses conflict-safe Postgres writes and creates pair/provider/captured indexes', async () => {
    const statements: string[] = [];
    const pool = { query: async (sql: string) => { statements.push(sql); return { rows: [], rowCount: 0 }; }, end: async () => undefined };
    const store = new PostgresRhChainMarketSnapshotStore(pool as any);
    await store.save(snapshot('stable-id', '2026-07-17T00:00:00.000Z'));
    await store.save(snapshot('stable-id', '2026-07-17T00:00:00.000Z'));
    expect(statements.filter((sql) => sql.includes('on conflict (snapshot_id) do nothing'))).toHaveLength(2);
    expect(statements.join(' ')).toMatch(/pair_captured_idx/);
    expect(statements.join(' ')).toMatch(/provider_captured_idx/);
    expect(statements.join(' ')).toMatch(/captured_at_idx/);
  });

  it('fails soft when the public provider is unavailable', async () => {
    const broken = provider({ getTokenBatch: async () => { throw new Error('down'); } });
    const result = await service(new InMemoryRhChainMarketSnapshotStore(), broken).captureKnownWatchlistSnapshot();
    expect(result).toMatchObject({ status: 'unavailable', captured: [] });
  });

  it('splits known-watchlist DEX Screener batch requests at 30 contracts', async () => {
    const contracts = Array.from({ length: 31 }, (_, index) => `0x${String(index + 1).padStart(40, '0')}`);
    const batches: string[][] = [];
    const source = provider({ getTokenBatch: async (batch) => { batches.push(batch); return Object.fromEntries(batch.map((address) => [address, [dex()]])); } });
    const snapshots = new RhChainMarketSnapshotService({ store: new InMemoryRhChainMarketSnapshotStore(), provider: source, enabled: true, watchlist: () => contracts });
    await snapshots.captureKnownWatchlistSnapshot();
    expect(batches.map((batch) => batch.length)).toEqual([30, 1]);
  });

  it('returns insufficient_history before three snapshots exist', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore(); await store.save(snapshot('one', '2026-07-17T00:00:00.000Z')); await store.save(snapshot('two', '2026-07-17T01:00:00.000Z'));
    expect((await service(store).summarizeAttentionHistory(contract)).state).toBe('insufficient_history');
    expect((await service(store).summarizeAttentionHistory(contract)).score).toBeNull();
  });

  it('detects paid attention when no after-window exists', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore(); await store.save(snapshot('one', '2026-07-17T00:00:00.000Z')); await store.save(snapshot('two', '2026-07-17T01:00:00.000Z')); await store.save(snapshot('three', '2026-07-17T02:00:00.000Z', { active_boosts: 5, paid_order_types: ['tokenProfile'] }));
    expect((await service(store).summarizeAttentionHistory(contract)).state).toBe('paid_attention_detected');
  });

  it('recognizes retained post-boost liquidity without using price as the deciding input', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore(); await store.save(snapshot('one', '2026-07-17T00:00:00.000Z')); await store.save(snapshot('two', '2026-07-17T01:00:00.000Z', { active_boosts: 5, paid_order_types: ['tokenProfile'] })); await store.save(snapshot('three', '2026-07-17T02:00:00.000Z', { liquidity_usd: 80, volume_h24: 90, txns_h24_buys: 7, txns_h24_sells: 4, price_usd: 0.1 }));
    const result = await service(store).summarizeAttentionHistory(contract);
    expect(result.state).toBe('boosted_but_retaining');
    expect(result.score).toBe(100);
  });

  it('flags liquidity decay and does not call a price-only pump organic persistence', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore(); await store.save(snapshot('one', '2026-07-17T00:00:00.000Z')); await store.save(snapshot('two', '2026-07-17T01:00:00.000Z')); await store.save(snapshot('three', '2026-07-17T02:00:00.000Z', { liquidity_usd: 20, volume_h24: 10, txns_h24_buys: 1, txns_h24_sells: 0, price_usd: 1_000_000 }));
    const result = await service(store).summarizeAttentionHistory(contract);
    expect(result.state).toBe('liquidity_decay');
    expect(result.state).not.toBe('organic_persistence');
  });

  it('keeps reviewed classification separate from provider history and avoids hype language', async () => {
    const result = await service().captureKnownWatchlistSnapshot();
    expect(result.captured[0].ticker).toBe('MEMORY');
    expect(result.caveats.join(' ')).not.toMatch(/buy now|sell now|ape|100x|raid/i);
  });

  it('keeps public history reads available while capture remains disabled by default', async () => {
    const app = await createApp();
    try {
      expect((await app.inject({ method: 'GET', url: `/v1/rh-chain/market/snapshots/${contract}` })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: `/v1/rh-chain/market/attention-quality/${contract}` })).json().data).toMatchObject({ state: 'source_required', score: null });
      expect((await app.inject({ method: 'POST', url: '/v1/rh-chain/market/snapshots/capture' })).statusCode).toBe(503);
    } finally { await app.close(); }
  });

  it('keeps the capture API available with ingestion enabled while reporting disabled historical writes', async () => {
    const previous = process.env.INFOPUNKS_ADMIN_TOKEN;
    process.env.INFOPUNKS_ADMIN_TOKEN = 'market-test-token';
    const app = await createApp(undefined, undefined, { rhChainMarketDataOptions: { enabled: true, provider: provider() }, rhChainTokenRegistryOptions: { enabled: false }, rhChainMarketSnapshotOptions: { enabled: true, storageEnabled: false } });
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/rh-chain/market/snapshots/capture', headers: { authorization: 'Bearer market-test-token' } });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({ status: 'captured', storage: { enabled: false, adapter: 'memory', durable: false, written: 0 } }));
    } finally {
      await app.close();
      if (previous === undefined) delete process.env.INFOPUNKS_ADMIN_TOKEN;
      else process.env.INFOPUNKS_ADMIN_TOKEN = previous;
    }
  });
});
