import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryRhChainMarketSnapshotStore, RhChainMarketSnapshotService } from '../src/services/rhChainMarketSnapshotService';
import { InMemoryRhChainAutomationStore, RhChainAutomationService } from '../src/services/rhChainAutomationService';
import { RhChainLiveSnapshotService } from '../src/services/rhChainLiveSnapshotService';
import { InMemoryRhChainSubmissionStore } from '../src/services/rhChainSignalVault';
import { startRhChainMarketScheduler } from '../src/services/rhChainMarketScheduler';
import { loadRuntimeConfig } from '../src/config/env';
import { createApp } from '../src/api/app';
import { marketContract as contract, marketTime, marketPair, marketProvider, marketSample } from './helpers/rhMarketObservations';

afterEach(() => vi.useRealTimers());
function collector(provider = marketProvider(), contracts = [contract], store = new InMemoryRhChainMarketSnapshotStore()) {
  return new RhChainMarketSnapshotService({ store, provider, enabled: true, watchlist: () => contracts, now: () => new Date(marketTime) });
}

describe('RH-PIPELINE-1A collection boundaries', () => {
  it('keeps collection and publication off in the default runtime configuration', () => {
    const config = loadRuntimeConfig({});
    expect(config.rhChainMarketIngestionEnabled).toBe(false);
    expect(config.rhChainMarketHistoryEnabled).toBe(false);
    expect(config.rhChainMarketSchedulerEnabled).toBe(false);
    expect(config.rhChainMarketSnapshotIntervalMs).toBe(300000);
    expect(config.rh4663Phase3AutoPublicationEnabled).toBe(false);
    expect(loadRuntimeConfig({ RH_CHAIN_MARKET_SNAPSHOT_INTERVAL_MS: '1' }).rhChainMarketSnapshotIntervalMs).toBe(60000);
  });
  it('isolates a failed batch without discarding the other 30 durable observations', async () => {
    const contracts = Array.from({ length: 31 }, (_, index) => '0x' + String(index + 1).padStart(40, '0'));
    const source = marketProvider();
    const result = await collector(marketProvider({ getTokenBatch: async (batch) => {
      if (batch.length === 1) throw new Error('upstream failed');
      return source.getTokenBatch(batch);
    } }), contracts).captureKnownWatchlistSnapshot();
    expect(result).toMatchObject({ status: 'partial', requested_contracts: 31, storage: { written: 30 } });
    expect(result.failures).toEqual([{ contract: contracts[30], reason: 'provider_batch_unavailable' }]);
  });
  it.each([
    ['wrong chain', { chainId: '46630' }, 'chain_or_provider_mismatch'],
    ['wrong token', { tokenAddress: '0x' + '2'.repeat(40) }, 'contract_or_quote_direction_mismatch'],
    ['quote-only token price', { baseToken: { address: '0x' + '2'.repeat(40), name: null, symbol: null, decimals: 18 } }, 'contract_or_quote_direction_mismatch'],
    ['stale cache', { freshness: 'stale' }, 'stale_observation'],
    ['old cache timestamp', { capturedAt: '2026-10-11T23:00:00.000Z' }, 'stale_observation'],
    ['old provider timestamp', { providerTimestamp: '2026-10-11T23:00:00.000Z' }, 'stale_observation'],
    ['future timestamp', { capturedAt: '2026-10-12T00:07:00.000Z' }, 'invalid_observation_time'],
    ['invalid timestamp', { capturedAt: 'bad' }, 'invalid_observation_time'],
    ['missing pair', { pairAddress: null }, 'pair_identity_missing'],
    ['missing source', { sourceUrl: null }, 'source_url_missing']
  ])('rejects %s without replacing previous stored evidence', async (_name, override, reason) => {
    const store = new InMemoryRhChainMarketSnapshotStore();
    await store.save(marketSample('prior', '2026-10-12T00:00:00.000Z'));
    const result = await collector(marketProvider({ getTokenBatch: async () => ({ [contract]: [marketPair(override as any)] }) }), [contract], store).captureKnownWatchlistSnapshot();
    expect(result).toMatchObject({ status: 'unavailable', storage: { written: 0 }, failures: [{ reason }] });
    expect((await store.latestMany([contract]))[contract]?.snapshot_id).toBe('prior');
  });
  it('does not confuse equal symbols on different exact contracts', async () => {
    const second = '0x' + '2'.repeat(40);
    const result = await collector(marketProvider(), [contract, second]).captureKnownWatchlistSnapshot();
    expect(result.captured.map((sample) => sample.token_address)).toEqual([contract, second]);
    expect(new Set(result.captured.map((sample) => sample.snapshot_id)).size).toBe(2);
  });
  it('preserves missing and invalid metrics as null with coverage gaps', async () => {
    const result = await collector(marketProvider({ getTokenBatch: async () => ({ [contract]: [marketPair({ priceUsd: NaN, liquidityUsd: -1, marketCap: Infinity, txns: { h24: { buys: 0.5, sells: 0 } } })] }) })).captureKnownWatchlistSnapshot();
    expect(result.captured[0]).toMatchObject({ price_usd: null, liquidity_usd: null, market_cap: null, txns_h24_buys: null, txns_h24_sells: 0 });
    expect(result.captured[0].collection_gaps).toEqual(expect.arrayContaining(['price_usd', 'liquidity_usd', 'market_cap', 'txns_h24_buys']));
  });
  it('does not turn a failed paid-attention lookup into a claim of organic attention', async () => {
    const capture = collector(marketProvider({ getPaidOrders: async () => { throw new Error('orders failed'); } }));
    const result = await capture.captureKnownWatchlistSnapshot();
    expect(result.status).toBe('captured');
    expect(result.captured[0].paid_attention_available).toBe(false);
    expect(result.captured[0].active_boosts).toBeNull();
    expect(await capture.summarizeAttentionHistory(contract)).toMatchObject({ state: 'source_required', score: null, paid_attention_context: null });
  });
  it('keeps numeric scheduled collection independent of paid/list endpoint calls', async () => {
    const source = marketProvider({ getPaidOrders: vi.fn(), getLatestBoosts: vi.fn() });
    expect((await collector(source).captureKnownWatchlistSnapshot({ includePaidAttention: false })).captured).toHaveLength(1);
    expect(source.getPaidOrders).not.toHaveBeenCalled();
    expect(source.getLatestBoosts).not.toHaveBeenCalled();
  });
  it('deduplicates cached observations and reports actual inserted rows', async () => {
    const capture = collector();
    const first = await capture.captureKnownWatchlistSnapshot();
    const second = await capture.captureKnownWatchlistSnapshot();
    expect(first.storage.written).toBe(1);
    expect(second.storage.written).toBe(0);
    expect(second.captured[0].captured_at).toBe(marketTime);
  });
  it('normalizes equivalent timestamp offsets and pair casing to one observation identity', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore();
    const source = marketProvider({ getTokenBatch: async () => ({ [contract]: [marketPair({ capturedAt: '2026-10-12T05:35:00+05:30', pairAddress: '0x' + 'A'.repeat(40) })] }) });
    await collector(source, [contract], store).captureKnownWatchlistSnapshot();
    const replay = await collector(marketProvider(), [contract], store).captureKnownWatchlistSnapshot();
    expect(replay.storage.written).toBe(0);
    expect(replay.captured[0].captured_at).toBe(marketTime);
  });
  it('uses pool identity to break liquidity/volume ties deterministically', async () => {
    const a = marketPair({ pairAddress: 'a' }); const b = marketPair({ pairAddress: 'b' });
    const selected = async (pairs: typeof a[]) => (await collector(marketProvider({ getTokenBatch: async () => ({ [contract]: pairs }) })).captureKnownWatchlistSnapshot()).captured[0].pair_address;
    expect(await selected([a, b, a])).toBe('a');
    expect(await selected([b, a])).toBe('a');
  });
  it('withholds conflicting observations for the same pair and source time', async () => {
    const source = marketProvider({ getTokenBatch: async () => ({ [contract]: [marketPair(), marketPair({ priceUsd: 100 })] }) });
    const result = await collector(source).captureKnownWatchlistSnapshot();
    expect(result).toMatchObject({ status: 'unavailable', storage: { written: 0 }, failures: [{ reason: 'provider_pair_disagreement' }] });
  });
  it('rejects malformed watchlist identities and explicitly reports capacity limits', async () => {
    const capture = new RhChainMarketSnapshotService({ store: new InMemoryRhChainMarketSnapshotStore(), provider: marketProvider(), enabled: true, watchlist: () => ['SAME', contract, '0x' + '2'.repeat(40)], maxContracts: 1, now: () => new Date(marketTime) });
    const result = await capture.captureKnownWatchlistSnapshot();
    expect(result.captured).toHaveLength(1);
    expect(result.failures.map((item) => item.reason)).toEqual(expect.arrayContaining(['invalid_contract', 'collection_capacity_exceeded']));
  });
  it('coalesces overlapping collection requests on one service', async () => {
    let release!: () => void;
    const source = marketProvider();
    const batch = vi.fn(async (contracts: string[]) => { await new Promise<void>((resolve) => { release = resolve; }); return source.getTokenBatch(contracts); });
    const capture = collector(marketProvider({ getTokenBatch: batch }));
    const a = capture.captureKnownWatchlistSnapshot({ includePaidAttention: false });
    const b = capture.captureKnownWatchlistSnapshot({ includePaidAttention: false });
    await vi.waitFor(() => expect(batch).toHaveBeenCalledTimes(1));
    release(); expect(await a).toEqual(await b);
  });
  it('keeps public observation reads independent of providers, wallet identity and capture permission', async () => {
    const source = marketProvider({ getTokenBatch: vi.fn() });
    const store = new InMemoryRhChainMarketSnapshotStore();
    await store.save(marketSample('public'));
    const app = await createApp(undefined, undefined, { rhChainMarketSnapshotStore: store, rhChainMarketSnapshotOptions: { enabled: false }, rhChainMarketDataOptions: { enabled: false, provider: source } });
    try {
      const read = await app.inject({ url: '/v1/rh-chain/market/snapshots/' + contract, headers: { authorization: 'Bearer private-wallet-token', cookie: 'wallet=secret' } });
      expect(read.statusCode).toBe(200);
      expect(JSON.stringify(read.json())).not.toMatch(/private-wallet-token|wallet=secret/);
      expect(read.json().data.freshness.state).toBe('stale');
      expect(source.getTokenBatch).not.toHaveBeenCalled();
      expect((await app.inject({ method: 'POST', url: '/v1/rh-chain/market/snapshots/capture' })).statusCode).toBe(503);
    } finally { await app.close(); }
  });
});

describe('collection scheduling and authority', () => {
  it('starts the opt-in application schedule and replays idempotently across application restarts', async () => {
    const keys = ['RH_CHAIN_MARKET_SCHEDULER_ENABLED', 'RH_CHAIN_MARKET_INGESTION_ENABLED', 'RH_CHAIN_MARKET_HISTORY_ENABLED'];
    const saved = keys.map((key) => process.env[key]);
    for (const key of keys) process.env[key] = 'true';
    const snapshots = new InMemoryRhChainMarketSnapshotStore();
    const runs = new InMemoryRhChainAutomationStore();
    const options = {
      rhChainMarketSnapshotStore: snapshots, rhChainAutomationStore: runs,
      rhChainMarketSnapshotOptions: { now: () => new Date(marketTime) },
      rhChainMarketDataOptions: { enabled: true, provider: marketProvider() },
      rhChainTokenRegistryOptions: { enabled: false }
    };
    let app: Awaited<ReturnType<typeof createApp>> | null = null;
    try {
      app = await createApp(undefined, undefined, options); await app.ready();
      await vi.waitFor(async () => expect((await runs.listRuns()).filter((run) => run.job_name === 'rh_market_snapshot_refresh' && run.status === 'success')).toHaveLength(1), { timeout: 10000 });
      const first = (await runs.listRuns()).find((run) => run.job_name === 'rh_market_snapshot_refresh')!;
      expect(first.records_observed).toBeGreaterThan(0);
      expect(first.records_updated).toBe(first.records_observed);
      await app.close(); app = null;
      app = await createApp(undefined, undefined, options); await app.ready();
      await vi.waitFor(async () => expect((await runs.listRuns()).filter((run) => run.job_name === 'rh_market_snapshot_refresh' && run.status === 'success')).toHaveLength(2), { timeout: 10000 });
      expect((await runs.listRuns()).filter((run) => run.records_updated === 0)).toHaveLength(1);
    } finally {
      await app?.close();
      keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
    }
  });
  it('starts once, skips overlaps, recovers after failure, and stops cleanly', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const run = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; })).mockRejectedValueOnce(new Error('provider failed')).mockResolvedValue(undefined);
    const onError = vi.fn();
    const scheduler = startRhChainMarketScheduler(run, 300000, onError);
    await vi.advanceTimersByTimeAsync(0); expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600000); expect(run).toHaveBeenCalledTimes(1);
    release(); await vi.advanceTimersByTimeAsync(300000);
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(300000); expect(run).toHaveBeenCalledTimes(3);
    await scheduler.stop();
    await vi.advanceTimersByTimeAsync(600000); expect(run).toHaveBeenCalledTimes(3);
  });
  it('records collection-only runs without touching the intelligence/publication callback', async () => {
    const capture = collector();
    const intelligence = vi.fn();
    const jobs = new RhChainAutomationService({
      enabled: true, enabledJobs: ['rh_market_snapshot_refresh'], isProduction: false,
      instanceId: 'collector', lockTtlMs: 1, store: new InMemoryRhChainAutomationStore(),
      snapshots: new RhChainLiveSnapshotService({ enabled: false, timeoutMs: 1 }),
      submissions: new InMemoryRhChainSubmissionStore(), rh4663IntelligenceRun: intelligence,
      marketSnapshotCapture: () => capture.captureKnownWatchlistSnapshot({ includePaidAttention: false })
    });
    expect(await jobs.run('rh_market_snapshot_refresh')).toMatchObject({ status: 'success', records_observed: 1, records_updated: 1 });
    expect(await jobs.run('rh_4663_intelligence_refresh')).toMatchObject({ status: 'skipped' });
    expect(intelligence).not.toHaveBeenCalled();
  });
});
