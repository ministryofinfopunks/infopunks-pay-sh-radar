import { describe, expect, it } from 'vitest';
import { deriveRhChainMarketMovers, RhChainMarketMoversService, RH_MARKET_MOVERS_VERSION } from '../src/services/rhChainMarketMoversService';
import { InMemoryRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { moverSamples, moverContract as contract, moverPair, moverNow } from './helpers/rhMoverObservations';

const now = new Date(moverNow);
describe('deterministic persisted Movers', () => {
  it('derives versioned components, factual deltas, persistence and source coverage without reviewed authority', () => {
    const result = deriveRhChainMarketMovers({ [contract]: moverSamples() }, now, [contract]);
    expect(result).toMatchObject({ state: 'available', calculation_version: RH_MARKET_MOVERS_VERSION, execution_authorized: false });
    expect(result.assets[0]).toMatchObject({ rank: 1, chain_id: 4663, token_contract: contract, pair_address: moverPair, lane: 'stock_token',
      observation_id: `${contract}:${moverPair}:12`, baseline_observation_id: `${contract}:${moverPair}:0`, coverage: { sample_count: 13, elapsed_ms: 3600000, state: 'complete' },
      metrics: { price_delta_pct: 10, volume_delta_pct: 300, transactions_delta_pct: 120 },
      score_components: { volume: 25, liquidity: 20, transactions: 20, price: 7.5 }, judgment_state: 'unreviewed_observation', freshness: { state: 'fresh', time_basis: 'provider_fetch' } });
    expect(result.assets[0]).not.toHaveProperty('classification'); expect(result.assets[0]).not.toHaveProperty('infopunks_verdict');
    expect(result.assets[0].significance_score).toBeLessThanOrEqual(100);
  });
  it('replays order, contract case, duplicate samples and timestamp offsets into the same ranking', () => {
    const samples = moverSamples(); const reference = deriveRhChainMarketMovers({ [contract]: samples }, now);
    const offsets = samples.map((s) => ({ ...s, captured_at: s.captured_at.replace('Z', '+00:00') }));
    const reordered = deriveRhChainMarketMovers({ [contract.toUpperCase()]: [...offsets.reverse(), ...offsets] }, now);
    expect(reordered.assets.map((s) => [s.token_contract, s.pair_address, s.significance_score, s.observation_ids])).toEqual(reference.assets.map((s) => [s.token_contract, s.pair_address, s.significance_score, s.observation_ids]));
  });
  it('keeps duplicate tickers distinct and resolves equal scores by exact contract', () => {
    const second = '0x' + '2'.repeat(40), secondPair = '0x' + 'b'.repeat(64);
    const result = deriveRhChainMarketMovers({ [second]: moverSamples(second, secondPair), [contract]: moverSamples() }, now);
    expect(result.assets.map((s) => s.token_contract)).toEqual([contract, second]); expect(result.assets.map((s) => s.ticker)).toEqual(['SAME', 'SAME']);
  });
  it('never mixes pool baselines or sums pool liquidity and selects the eligible pool deterministically', () => {
    const other = moverSamples(contract, '0x' + 'b'.repeat(64)); const result = deriveRhChainMarketMovers({ [contract]: [...other, ...moverSamples()] }, now);
    expect(result.assets).toHaveLength(1); expect(result.assets[0].pair_address).toBe(moverPair);
    expect(result.assets[0].metrics.liquidity_usd).toBe(22000); expect(result.assets[0].coverage.sample_count).toBe(13);
    expect(deriveRhChainMarketMovers({ [contract]: [...moverSamples().slice(0, 6), ...other.slice(6)] }, now).assets).toEqual([]);
  });
  it('rejects a duplicated pair claimed by two token contracts', () => {
    const second = '0x' + '2'.repeat(40);
    const result = deriveRhChainMarketMovers({ [contract]: moverSamples(), [second]: moverSamples(second, moverPair) }, now);
    expect(result.assets).toEqual([]); expect(result.research.every((r) => r.reasons.includes('PAIR_CONTRACT_COLLISION'))).toBe(true);
  });
  it.each([
    ['wrong chain', { chain_id: '46630' }, 'MAINNET_PROVIDER_IDENTITY_REQUIRED'],
    ['wrong provider', { provider: 'other' }, 'MAINNET_PROVIDER_IDENTITY_REQUIRED'],
    ['wrong base', { base_token: { address: '0x' + '2'.repeat(40) } }, 'EXACT_BASE_QUOTE_IDENTITY_REQUIRED'],
    ['wrong token', { token_address: '0x' + '2'.repeat(40) }, 'EXACT_BASE_QUOTE_IDENTITY_REQUIRED'],
    ['missing quote', { quote_token: undefined }, 'EXACT_BASE_QUOTE_IDENTITY_REQUIRED'],
    ['missing price', { price_usd: null }, 'METRIC_COVERAGE_INCOMPLETE'],
    ['missing transactions', { txns_h24_buys: null }, 'METRIC_COVERAGE_INCOMPLETE'],
    ['fractional transactions', { txns_h24_sells: 0.5 }, 'METRIC_COVERAGE_INCOMPLETE'],
    ['cached stale', { freshness_state: 'stale' }, 'STALE_OBSERVATION'],
    ['stale cache metadata', { cache_status: 'stale_fallback' }, 'STALE_OBSERVATION'],
    ['manual data', { data_mode: 'manual' }, 'SOURCED_PROVIDER_OBSERVATION_REQUIRED'],
    ['low liquidity', { liquidity_usd: 1 }, 'INSUFFICIENT_MARKET_ACTIVITY']
  ])('excludes %s with an explicit research reason', (_name, patch, reason) => {
    const samples = moverSamples(); Object.assign(samples[12], patch);
    const result = deriveRhChainMarketMovers({ [contract]: samples }, now);
    expect(result.assets).toEqual([]); expect(result.research[0].reasons).toContain(reason);
  });
  it('does not mark a stored observation fresh again after an outage or clock skew', () => {
    const samples = moverSamples();
    const stale = deriveRhChainMarketMovers({ [contract]: samples }, new Date(now.getTime() + 16 * 60000));
    expect(stale.assets).toEqual([]); expect(stale.research[0].freshness).toMatchObject({ state: 'stale', observed_at: moverNow });
    samples[12].provider_timestamp = '2026-10-13T15:02:00Z';
    expect(deriveRhChainMarketMovers({ [contract]: samples }, now).research[0].reasons).toContain('INVALID_OR_FUTURE_TIME');
  });
  it('rejects sparse coverage, missing baseline, zero baseline and nonfinite deltas', () => {
    const samples = moverSamples();
    for (const rows of [samples.slice(9), samples.filter((_, i) => i % 3 === 0), samples.slice(1).map((s) => ({ ...s, captured_at: new Date(Date.parse(s.captured_at) + 15 * 60000).toISOString() }))])
      expect(deriveRhChainMarketMovers({ [contract]: rows }, now).assets).toEqual([]);
    samples[0].volume_h1 = 0;
    expect(deriveRhChainMarketMovers({ [contract]: samples }, now).research[0].reasons).toContain('ZERO_BASELINE');
    samples[0].volume_h1 = 100; samples[0].price_usd = Number.MIN_VALUE; samples[12].price_usd = 1e300;
    expect(deriveRhChainMarketMovers({ [contract]: samples }, now).research[0].reasons).toContain('NONFINITE_DELTA');
  });
  it('withholds disagreements while deduplicating consistent same-time observations', () => {
    const samples = moverSamples(); const duplicated = { ...samples[12], snapshot_id: 'duplicate' };
    expect(deriveRhChainMarketMovers({ [contract]: [...samples, duplicated] }, now).assets[0].coverage.sample_count).toBe(13);
    duplicated.price_usd = 100;
    expect(deriveRhChainMarketMovers({ [contract]: [...samples, duplicated] }, now).research[0].reasons).toContain('PROVIDER_PAIR_DISAGREEMENT');
  });
  it('exposes finite declines as significance rather than expected return or capital flow', () => {
    const samples = moverSamples().map((s, i) => ({ ...s, price_usd: 4 - i / 10, liquidity_usd: 40000 - i * 1000 }));
    const row = deriveRhChainMarketMovers({ [contract]: samples }, now).assets[0];
    expect(row.metrics.price_delta_pct).toBeLessThan(0); expect(row.metrics.liquidity_delta_pct).toBeLessThan(0); expect(row.significance_score).toBeGreaterThan(0);
    expect(row).not.toHaveProperty('expected_return'); expect(row).not.toHaveProperty('capital_inflow');
  });
  it('keeps zero current volume observed and gives flat markets zero persistence', () => {
    const samples = moverSamples(); samples[12].volume_h1 = 0;
    expect(deriveRhChainMarketMovers({ [contract]: samples }, now).assets[0].metrics.rolling_volume_1h_usd).toBe(0);
    const flat = moverSamples().map((s) => ({ ...s, price_usd: 1, liquidity_usd: 10000, volume_h1: 100, txns_h24_buys: 10, txns_h24_sells: 10 }));
    expect(deriveRhChainMarketMovers({ [contract]: flat }, now).assets[0].metrics.persistence_ratio).toBe(0);
  });
  it('keeps source metadata public and does not leak arbitrary stored payload fields', () => {
    const samples = moverSamples(); Object.assign(samples[12], { tenant_id: 'private-tenant', wallet_balance: 'private-balance' });
    samples[12].source_url += '?credential=private-secret#secret';
    const output = JSON.stringify(deriveRhChainMarketMovers({ [contract]: samples }, now));
    expect(output).not.toMatch(/private-tenant|private-balance|private-secret/);
  });
  it('keeps projection identity stable while freshness age increases and changes it on eligibility expiry', () => {
    const input = { [contract]: moverSamples() };
    expect(deriveRhChainMarketMovers(input, new Date(now.getTime() + 60000)).projection_id).toBe(deriveRhChainMarketMovers(input, now).projection_id);
    expect(deriveRhChainMarketMovers(input, new Date(now.getTime() + 16 * 60000)).projection_id).not.toBe(deriveRhChainMarketMovers(input, now).projection_id);
  });
  it('reads persisted universe on each projection, reports storage failure and never fabricates pruned raw history', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore(); const service = new RhChainMarketMoversService(store, { now: () => now });
    expect((await service.read()).assets).toEqual([]); for (const sample of moverSamples()) await store.save(sample);
    expect((await service.read()).assets).toHaveLength(1);
    await store.pruneHistory(new Date(now.getTime() + 49 * 3600000));
    expect((await service.read()).assets).toEqual([]); expect(await store.listAggregates(contract, 'day')).toHaveLength(1);
    const failed = new RhChainMarketMoversService({ ...store, adapter: 'memory', durable: false, listObservedContracts: async () => { throw new Error('private-db-error'); }, list: () => store.list(contract), save: async () => {} }, { now: () => now });
    expect(await failed.read()).toMatchObject({ storage_status: 'unavailable', failures: ['OBSERVATION_STORAGE_UNAVAILABLE'], assets: [] });
  });
  it('does not qualify a capped universe without complete pair collision coverage', () => {
    const result = deriveRhChainMarketMovers({ [contract]: moverSamples() }, now, [], { universeTruncated: true });
    expect(result.assets).toEqual([]); expect(result.research[0].reasons).toContain('UNIVERSE_LIMIT_EXCEEDED');
  });
  it('requires a durable store for production and surfaces registry failure without inventing stock identity', async () => {
    const store = new InMemoryRhChainMarketSnapshotStore(); for (const sample of moverSamples()) await store.save(sample);
    expect(await new RhChainMarketMoversService(store, { now: () => now, requireDurable: true }).read()).toMatchObject({ assets: [], failures: ['DURABLE_MARKET_STORE_REQUIRED'], storage: { durable: false } });
    const result = await new RhChainMarketMoversService(store, { now: () => now, stockContracts: async () => { throw new Error('registry-secret'); } }).read();
    expect(result.source_health?.stock_registry).toBe('unavailable'); expect(result.assets[0].lane).toBe('market_discovery');
    expect(result.state).toBe('partial'); expect(JSON.stringify(result)).not.toContain('registry-secret');
  });
  it('coalesces differently cased contract keys and keeps the current observation inside its evidence manifest', () => {
    const samples = moverSamples(); samples.forEach((s) => { s.provider_timestamp = s.captured_at; });
    const repeated = { ...samples[12], captured_at: '2026-10-13T15:00:30Z', snapshot_id: 'later-fetch' };
    const result = deriveRhChainMarketMovers({ [contract]: samples, [contract.toUpperCase()]: [repeated] }, new Date('2026-10-13T15:00:30Z'));
    expect(result.assets).toHaveLength(1); expect(result.assets[0].coverage.sample_count).toBe(13);
    expect(result.assets[0].observation_ids).toContain(result.assets[0].observation_id);
  });
  it('isolates malformed contract attribution without withholding another healthy contract', () => {
    const malformed = moverSamples(); Object.assign(malformed[12], { token_address: null, base_token: { address: 42 } });
    const second = '0x' + '2'.repeat(40);
    const result = deriveRhChainMarketMovers({ [contract]: malformed, [second]: moverSamples(second, '0x' + 'b'.repeat(64)) }, now);
    expect(result.assets.map((row) => row.token_contract)).toEqual([second]);
    expect(result.research[0].reasons).toContain('EXACT_BASE_QUOTE_IDENTITY_REQUIRED');
  });
});
