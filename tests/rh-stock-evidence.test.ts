import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { RhChainStockEvidenceService, qualifiedStockAssets, STOCK_REGISTRY_PROVENANCE } from '../src/services/rhChainStockEvidenceService';
import { InMemoryReflexiveStore, ReflexiveRadarService, deriveUniswapV4PoolId, type CanonicalStockAsset } from '../src/services/rhChainReflexiveRadarService';
import { buildPltrPreflightState, pltrBasis, verifyPltrV4Market, type PltrMarketContext } from '../src/services/rhChainPltrPreflightService';
import { InMemoryRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { marketContract, marketSample } from './helpers/rhMarketObservations';
import { marketProvider } from './helpers/rhMarketObservations';
import { InMemoryRhChainAutomationStore } from '../src/services/rhChainAutomationService';

const at = '2026-10-13T15:00:00.000Z'; // Open regular US session; fixtures only.
const contract = marketContract;
const secondContract = '0x' + '2'.repeat(40);
const asset = (): CanonicalStockAsset => ({ asset_id: 'pltr-fixture', ticker: 'PLTR', name: 'Fixture PLTR', chain_id: 4663,
  canonical_contract: contract, status: 'ASSET_STATUS_ACTIVE', current_multiplier: '2', pending_multiplier: null,
  pending_multiplier_effective_at: null, multiplier_evidence: { current_present: true, pending_present: true, effective_time_present: true },
  trading_capabilities: { wallet_secret: 'private-wallet-state' }, logo: null, observed_at: at, fetched_at: at,
  provenance: STOCK_REGISTRY_PROVENANCE, first_party_asset: false });

async function fixture() {
  const store = new InMemoryReflexiveStore(); const snapshot = await store.load(); const stock = asset();
  const key = { currency0: contract, currency1: secondContract, fee: 500, tick_spacing: 10, hooks: '0x' + '0'.repeat(40) };
  const poolId = await deriveUniswapV4PoolId(key);
  const verified = await verifyPltrV4Market({ chain_id: 4663, canonical_pltr_contract: contract, base_contract: contract,
    quote_contract: secondContract, relationship: 'DIRECT_PRICE_DISCOVERY', pool_key: key, reported_pool_id: poolId,
    state: { sqrt_price_x96: String(2n ** 96n), tick: 0, active_liquidity: '10000', observed_block: 123, observed_at: at, state_view: contract } });
  const pool: PltrMarketContext = { pool_id: poolId, pool_address: null, venue: 'uniswap', dex_version: 'V4', base_contract: contract,
    quote_contract: secondContract, base_symbol: 'PLTR', quote_symbol: 'QUOTE', relationship: 'DIRECT_PRICE_DISCOVERY',
    quote_direction_verified: true, verification_state: verified.status, liquidity_usd: 1000000, volume_24h_usd: 50000,
    transaction_count: 10, observed_at: at, source: 'fixture', freshness: 'fresh', pool_state: null,
    depth_primitive: verified.depth_primitive, price_usd: '50', price_source: 'VERIFIED_DIRECT_PLTR_PRICE_V1' };
  const basis = pltrBasis({ dex_price_usd: 50, underlying_price_usd: 100, multiplier: '2', dex_observed_at: at, reference_observed_at: at, session: 'OPEN' });
  const state = buildPltrPreflightState({ asset: stock, supply: { total_supply_raw: '100000000000000000000', total_supply_units: '100',
    share_equivalent_supply: '200', observed_block: 123, observed_at: at, source: 'https://private-rpc.invalid/?key=secret', freshness: 'fresh' },
    pairs: [], inventory: [], events: [], markets: [pool], now: new Date(at), basis,
    underlying_reference: { symbol: 'PLTR', bid: 99, ask: 101, midpoint: 100, generated_at: at, fetched_at: at,
      freshness: 'fresh', session: 'OPEN', source: 'RHJ_PRICES', methodology: 'RHJ_RAW_UNDERLYING_MIDPOINT_V1' } })!;
  snapshot.assets = [stock]; snapshot.pltr_preflight_states = [state]; snapshot.refreshed_at = at; await store.save(snapshot);
  const markets = new InMemoryRhChainMarketSnapshotStore();
  await markets.save(marketSample('stock-market-fixture', at, { base_token: { address: contract, symbol: 'PLTR', name: 'Fixture PLTR', decimals: 18 }, price_usd: 50 }));
  let now = new Date(at);
  const service = new RhChainStockEvidenceService({ snapshot: () => store.load(), markets: (contracts) => markets.latestMany(contracts), now: () => now });
  return { store, snapshot, markets, service, state, poolId, advance: (ms: number) => { now = new Date(Date.parse(at) + ms); } };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Stock Token evidence coverage', () => {
  it('reuses matching persisted inputs for one exact simulation route without granting authority', async () => {
    const f = await fixture(); const result = await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId);
    expect(result).toMatchObject({ execution_authorized: false, corporate_actions: { current_multiplier: '2', full_history_available: false },
      market_context: { snapshot_id: 'stock-market-fixture', scope: 'ONE_SELECTED_PROVIDER_POOL', executable_capacity_verified: false },
      issuer_reference: { midpoint: 100 }, onchain_supply: { observed_block: 123 }, route_evidence: { coverage: 'INPUTS_PRESENT', live_quote_available: false, basis: { basis_bps: 0 } },
      coverage: { full_product_coverage: 'INCOMPLETE' } });
    expect(JSON.stringify(result)).not.toMatch(/wallet_secret|private-wallet-state|private-rpc|key=secret/);
    expect(await f.store.load()).toEqual(f.snapshot);
  });
  it('separates equal symbols on different contracts and rejects ambiguous or testnet identities', async () => {
    const a = asset(), b = { ...a, asset_id: 'other', canonical_contract: secondContract };
    expect(qualifiedStockAssets([b, a]).map((row) => row.asset_id)).toEqual(['pltr-fixture', 'other']);
    expect(qualifiedStockAssets([a, { ...b, canonical_contract: contract.toUpperCase() }])).toEqual([]);
    expect(qualifiedStockAssets([a, { ...b, asset_id: a.asset_id }])).toEqual([]);
    expect(qualifiedStockAssets([{ ...a, chain_id: 46630 }, { ...b, provenance: 'third-party claim' }])).toEqual([]);
  });
  it('reports missing reference and RWA registries instead of extending PLTR evidence to another asset', async () => {
    const f = await fixture(); f.snapshot.assets.push({ ...asset(), asset_id: 'nvda', ticker: 'NVDA', canonical_contract: secondContract });
    await f.store.save(f.snapshot);
    const result = await f.service.evidence(secondContract, 'pltr_uniswap_v4_simulation', f.poolId);
    expect(result).toMatchObject({ issuer_reference: null, onchain_supply: null, route_evidence: { coverage: 'UNSUPPORTED' } });
    expect((await f.service.universe()).rwa_coverage.status).toBe('UNAVAILABLE');
  });
  it('never converts a legacy default multiplier into observed corporate-action metadata', async () => {
    const f = await fixture(); delete f.snapshot.assets[0].multiplier_evidence; await f.store.save(f.snapshot);
    expect(await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId)).toMatchObject({ corporate_actions: { current_multiplier: null, metadata_complete: false }, route_evidence: { coverage: 'INCOMPLETE', basis: null } });
    const newStore = new InMemoryReflexiveStore(); const refreshed = await new ReflexiveRadarService(newStore, { assets: async () => [{ id: 'stock', tokenSymbol: 'PLTR', deployments: [{ chainId: 4663, contractAddress: contract }] }] }, () => new Date(at)).refresh();
    expect(refreshed.assets[0]).toMatchObject({ current_multiplier: '1', multiplier_evidence: { current_present: false, pending_present: false, effective_time_present: false } });
  });
  it.each(['0', '-1', 'NaN', '1e4'])('withholds basis for invalid multiplier %s', async (value) => {
    const f = await fixture(); f.snapshot.assets[0].current_multiplier = value; await f.store.save(f.snapshot);
    expect((await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId))?.route_evidence.basis).toBeNull();
  });
  it('withholds normalized basis across a pending corporate action', async () => {
    const f = await fixture(); f.snapshot.assets[0].pending_multiplier = '4'; await f.store.save(f.snapshot);
    const result = await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId);
    expect(result?.corporate_actions.adjustment_pending).toBe(true);
    expect(result?.route_evidence.basis).toBeNull();
    expect(result?.coverage.missing_inputs).toContain('CORPORATE_ACTION_PENDING');
  });
  it('recomputes freshness after time passes without re-fetching or changing stored timestamps', async () => {
    const f = await fixture(); f.advance(16 * 60_000);
    const result = await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId);
    expect(result).toMatchObject({ market_context: { observed_at: at, freshness: { state: 'stale' } }, issuer_reference: { freshness: { state: 'stale' } },
      onchain_supply: null, route_evidence: { coverage: 'INCOMPLETE', basis: null } });
    expect(await f.store.load()).toEqual(f.snapshot);
  });
  it('rejects future-clock and mixed-contract market records', async () => {
    const f = await fixture(); await f.markets.save(marketSample('future', '2026-10-13T15:02:00.000Z', { base_token: { address: contract, name: null, symbol: null, decimals: 18 } }));
    expect((await f.service.evidence(contract))?.market_context?.freshness.state).toBe('unavailable');
    await f.markets.save(marketSample('wrong-base', '2026-10-13T15:03:00.000Z', { base_token: { address: secondContract, name: null, symbol: 'PLTR', decimals: 18 } }));
    expect((await f.service.evidence(contract))?.market_context).toBeNull();
  });
  it('does not count provider pool liquidity as fresh verified route depth', async () => {
    const f = await fixture(); f.snapshot.pltr_preflight_states[0].direct_markets[0].depth_primitive = null; await f.store.save(f.snapshot);
    expect((await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId))?.route_evidence).toMatchObject({ coverage: 'INCOMPLETE', basis: null,
      missing_inputs: expect.arrayContaining(['VERIFIED_FRESH_ROUTE_DEPTH_REQUIRED']) });
  });
  it('requires verified route-price provenance instead of a provider price beside verified depth', async () => {
    const f = await fixture(); f.snapshot.pltr_preflight_states[0].direct_markets[0].price_source = null; await f.store.save(f.snapshot);
    const result = await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId);
    expect(result?.route_evidence.basis).toBeNull(); expect(result?.route_evidence.missing_inputs).toContain('VERIFIED_ROUTE_PRICE_REQUIRED');
  });
  it('re-verifies the pool key instead of trusting a stored VERIFIED label', async () => {
    const f = await fixture(); f.snapshot.pltr_preflight_states[0].direct_markets[0].depth_primitive!.pool_key.fee = 3000; await f.store.save(f.snapshot);
    expect((await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId))?.route_evidence.coverage).toBe('INCOMPLETE');
  });
  it('degrades malformed route depth to missing evidence and preserves observed zero liquidity', async () => {
    const f = await fixture(); f.snapshot.pltr_preflight_states[0].direct_markets[0].depth_primitive!.sqrt_price_x96 = 'bad'; await f.store.save(f.snapshot);
    await f.markets.save(marketSample('zero', at, { base_token: { address: contract, symbol: 'PLTR', name: null, decimals: 18 },
      liquidity_usd: 0, txns_h24_buys: null, txns_h24_sells: null, source_url: 'https://dexscreener.com/robinhood/pool?token=private#secret' }));
    const result = await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId);
    expect(result?.route_evidence.coverage).toBe('INCOMPLETE');
    expect(result?.market_context).toMatchObject({ liquidity_usd: 0, indexed_transactions_24h: null, time_basis: 'PROVIDER_FETCH', source_url: 'https://dexscreener.com/robinhood/pool' });
    expect(result?.coverage.inputs.indexed_liquidity).toBe(true);
  });
  it('does not borrow an older valid reference when the newest persisted observation disagrees', async () => {
    const f = await fixture(); const newer = structuredClone(f.state); newer.observation_id = 'newer-invalid';
    newer.canonical_identity.fetched_at = '2026-10-13T15:00:30.000Z'; newer.underlying_reference!.midpoint = 500;
    f.snapshot.pltr_preflight_states.push(newer); await f.store.save(f.snapshot);
    const result = await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId);
    expect(result?.issuer_reference).toBeNull(); expect(result?.route_evidence.basis).toBeNull();
    expect(result?.coverage.inputs.issuer_reference).toBe(false);
  });
  it('withholds basis for skewed references and closed sessions', async () => {
    const f = await fixture(); f.snapshot.pltr_preflight_states[0].underlying_reference!.generated_at = '2026-10-13T14:55:00.000Z'; await f.store.save(f.snapshot);
    expect((await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId))?.route_evidence.basis).toBeNull();
    f.snapshot.pltr_preflight_states[0].underlying_reference!.generated_at = at;
    f.snapshot.pltr_preflight_states[0].underlying_reference!.session = 'CLOSED'; await f.store.save(f.snapshot);
    expect((await f.service.evidence(contract, 'pltr_uniswap_v4_simulation', f.poolId))?.route_evidence.basis).toBeNull();
  });
});

describe('Public Stock Token evidence API', () => {
  it('includes persisted official stock identities in the opt-in scheduled collector without enabling publication', async () => {
    for (const key of ['RH_CHAIN_MARKET_SCHEDULER_ENABLED', 'RH_CHAIN_MARKET_INGESTION_ENABLED', 'RH_CHAIN_MARKET_HISTORY_ENABLED']) vi.stubEnv(key, 'true');
    const f = await fixture(); const runs = new InMemoryRhChainAutomationStore(); const source = marketProvider();
    const batch = vi.fn(source.getTokenBatch); source.getTokenBatch = batch;
    const app = await createApp(undefined, undefined, { reflexiveStore: f.store, rhChainMarketSnapshotStore: f.markets,
      rhChainAutomationStore: runs, rhChainMarketSnapshotOptions: { now: () => new Date('2026-10-12T00:05:00.000Z') },
      rhChainMarketDataOptions: { enabled: true, provider: source }, rhChainTokenRegistryOptions: { enabled: false } });
    try { await app.ready(); await vi.waitFor(async () => expect((await runs.listRuns()).some((run) => run.job_name === 'rh_market_snapshot_refresh' && run.status === 'success')).toBe(true));
      expect(batch.mock.calls.flatMap((call) => call[0])).toContain(contract);
      expect(await f.store.load()).toEqual(f.snapshot);
    } finally { await app.close(); }
  });
  it('reads only persisted public evidence, validates route scope and keeps wallet state out', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(at)); const f = await fixture();
    const network = vi.fn(async () => { throw new Error('public read attempted network'); }); vi.stubGlobal('fetch', network);
    const app = await createApp(undefined, undefined, { reflexiveStore: f.store, rhChainMarketSnapshotStore: f.markets });
    try {
      const plain = await app.inject(`/v1/4663/stock-tokens/${contract}/evidence`);
      const privateCaller = await app.inject({ url: `/v1/4663/stock-tokens/${contract}/evidence`, headers: { authorization: 'Bearer private-tenant', cookie: 'wallet=private-wallet' } });
      expect(plain.statusCode).toBe(200); expect(privateCaller.json()).toEqual(plain.json());
      expect(plain.headers['cache-control']).toBe('no-store'); expect(network).not.toHaveBeenCalled();
      expect((await app.inject(`/v1/4663/stock-tokens/${contract}/evidence?route=pltr_uniswap_v4_simulation&pool_id=${f.poolId}`)).json().data.route_evidence.coverage).toBe('INPUTS_PRESENT');
      for (const suffix of ['?wallet=private-wallet', '?route=execute', '?route=pltr_uniswap_v4_simulation', `?pool_id=${f.poolId}`])
        expect((await app.inject(`/v1/4663/stock-tokens/${contract}/evidence${suffix}`)).statusCode).toBe(400);
      expect((await app.inject('/v1/4663/stock-tokens/PLTR/evidence')).statusCode).toBe(400);
      expect((await app.inject(`/v1/4663/stock-tokens/${secondContract}/evidence`)).statusCode).toBe(404);
      expect((await app.inject('/v1/4663/stock-tokens')).json().data.assets).toHaveLength(1);
      const spec = (await app.inject('/openapi.json')).json(); expect(spec.paths['/v1/4663/stock-tokens/{contract}/evidence'].get).toBeTruthy();
      expect(network).not.toHaveBeenCalled(); expect(await f.store.load()).toEqual(f.snapshot);
    } finally { await app.close(); }
  });
  it('fails closed on storage failure without exposing the error or attempting provider recovery', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    const app = await createApp(undefined, undefined, { reflexiveStore: { adapter: 'memory', durable: false, save: async () => {}, load: async () => { throw new Error('tenant-secret'); } } });
    try { const response = await app.inject('/v1/4663/stock-tokens'); expect(response.statusCode).toBe(503);
      expect(response.body).not.toContain('tenant-secret'); expect(network).not.toHaveBeenCalled(); }
    finally { await app.close(); }
  });
});
