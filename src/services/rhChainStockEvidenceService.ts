import type { CanonicalStockAsset, ReflexiveSnapshot } from './rhChainReflexiveRadarService';
import type { RhChainMarketSnapshot } from './rhChainMarketSnapshotService';
import { pltrBasis, underlyingPltrSession, verifyPltrV4Market } from './rhChainPltrPreflightService';

export const STOCK_EVIDENCE_VERSION = 'stock-token-evidence-v1';
export const STOCK_REGISTRY_PROVENANCE = 'Robinhood RHJ /assets + chain 4663 deployment';
export type StockEvidenceRoute = 'market_context' | 'pltr_uniswap_v4_simulation';
const address = (value: string) => /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const multiplierValid = (value: string) => /^\d+(\.\d+)?$/.test(value) && positive(Number(value));
const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/** Registry membership is evidence of identity, never a safety or spending verdict. */
export function qualifiedStockAssets(assets: CanonicalStockAsset[]) {
  return assets.filter((asset) => asset.chain_id === 4663 && address(asset.canonical_contract)
    && asset.provenance === STOCK_REGISTRY_PROVENANCE && asset.status === 'ASSET_STATUS_ACTIVE'
    && assets.filter((other) => same(other.canonical_contract, asset.canonical_contract)).length === 1
    && assets.filter((other) => other.asset_id === asset.asset_id).length === 1)
    .sort((a, b) => a.canonical_contract.toLowerCase().localeCompare(b.canonical_contract.toLowerCase()));
}

function publicDexSource(value: string | null | undefined) {
  try { const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || url.hostname !== 'dexscreener.com' || !url.pathname.startsWith('/robinhood/') || url.username || url.password) return null;
    url.search = ''; url.hash = ''; return url.toString();
  } catch { return null; }
}

function age(at: string | null | undefined, now: Date, max: number) {
  const elapsed = at ? now.getTime() - Date.parse(at) : NaN;
  return { observed_at: at ?? null, age_ms: Number.isFinite(elapsed) && elapsed >= -60_000 ? Math.max(0, elapsed) : null,
    state: !Number.isFinite(elapsed) || elapsed < -60_000 ? 'unavailable' : elapsed > max ? 'stale' : 'fresh' } as const;
}

/** A public allowlist projection. It only reads persisted observations; no provider, wallet, payment or authority dependencies. */
export class RhChainStockEvidenceService {
  constructor(private readonly options: {
    snapshot: () => Promise<ReflexiveSnapshot>;
    markets: (contracts: string[]) => Promise<Record<string, RhChainMarketSnapshot | null>>;
    now?: () => Date;
  }) {}

  async universe() {
    const snapshot = await this.options.snapshot();
    const assets = qualifiedStockAssets(snapshot.assets);
    const now = (this.options.now ?? (() => new Date()))();
    return { object_type: 'STOCK_TOKEN_EVIDENCE_UNIVERSE', methodology_version: STOCK_EVIDENCE_VERSION, chain_id: 4663,
      registry: { snapshot_refreshed_at: snapshot.refreshed_at, freshness: age(assets.length ? assets.map((asset) => asset.fetched_at).sort()[0] : null, now, 15 * 60_000), source_url: 'https://api.robinhood.com/rhj/assets',
        accepted_count: assets.length, excluded_count: snapshot.assets.length - assets.length },
      assets: assets.map((asset) => ({ asset_id: asset.asset_id, contract: asset.canonical_contract.toLowerCase(), ticker: asset.ticker,
        freshness: age(asset.observed_at, now, 15 * 60_000), evidence_url: `/v1/4663/stock-tokens/${asset.canonical_contract.toLowerCase()}/evidence` })),
      rwa_coverage: { status: 'UNAVAILABLE', reason: 'NON_STOCK_RWA_REGISTRIES_AND_ISSUER_TERMS_NOT_COLLECTED' }, execution_authorized: false };
  }

  async evidence(contract: string, route: StockEvidenceRoute = 'market_context', poolId?: string) {
    const snapshot = await this.options.snapshot();
    const asset = qualifiedStockAssets(snapshot.assets).find((item) => same(item.canonical_contract, contract));
    if (!asset) return null;
    const now = (this.options.now ?? (() => new Date()))();
    const normalized = asset.canonical_contract.toLowerCase();
    const registryAge = age(asset.observed_at, now, 15 * 60_000);
    const registryFresh = registryAge.state === 'fresh' && age(asset.fetched_at, now, 15 * 60_000).state === 'fresh';
    const corporateComplete = asset.multiplier_evidence?.current_present === true && asset.multiplier_evidence.pending_present
      && asset.multiplier_evidence.effective_time_present && multiplierValid(asset.current_multiplier);
    const adjustmentPending = asset.pending_multiplier !== null || asset.pending_multiplier_effective_at !== null;
    const stored = (await this.options.markets([normalized]))[normalized] ?? null;
    const marketIdentity = stored?.data_mode === 'live_cached' && stored.chain_id === 'robinhood' && stored.provider === 'dexscreener' && same(stored.token_address, normalized)
      && Boolean(stored.base_token?.address && same(stored.base_token.address, normalized)) && Boolean(stored.pair_address && publicDexSource(stored.source_url));
    const market = marketIdentity ? stored : null;
    const marketAge = age(market?.provider_timestamp ?? market?.captured_at, now, 15 * 60_000);
    const marketFresh = marketAge.state === 'fresh' && age(market?.captured_at, now, 15 * 60_000).state === 'fresh'
      && !market?.cache_status?.includes('stale') && market?.freshness_state !== 'stale' && market?.data_mode === 'live_cached';
    // Select the latest matching observation deterministically; never fall back from an invalid new record to an old healthy record.
    const states = snapshot.pltr_preflight_states.filter((state) => state.canonical_identity.asset_id === asset.asset_id
      && same(state.canonical_identity.canonical_contract, normalized));
    const state = asset.ticker === 'PLTR' ? states.slice().sort((a, b) =>
      Date.parse(b.canonical_identity.fetched_at) - Date.parse(a.canonical_identity.fetched_at) || b.observation_id.localeCompare(a.observation_id))[0] ?? null : null;
    const stateIdentity = Boolean(state && state.canonical_identity.ticker === asset.ticker
      && state.canonical_identity.current_multiplier === asset.current_multiplier
      && state.canonical_identity.pending_multiplier === asset.pending_multiplier
      && state.canonical_identity.pending_multiplier_effective_at === asset.pending_multiplier_effective_at);
    const reference = stateIdentity ? state?.underlying_reference ?? null : null;
    const referenceAge = age(reference?.generated_at, now, 15 * 60_000);
    const referenceValid = Boolean(reference && reference.symbol === 'PLTR' && reference.source === 'RHJ_PRICES'
      && reference.methodology === 'RHJ_RAW_UNDERLYING_MIDPOINT_V1' && positive(reference.bid) && positive(reference.ask)
      && reference.ask >= reference.bid && positive(reference.midpoint)
      && Math.abs(reference.midpoint - (reference.bid + reference.ask) / 2) <= 1e-8 * reference.midpoint);
    const referenceFresh = referenceValid && referenceAge.state === 'fresh' && age(reference?.fetched_at, now, 15 * 60_000).state === 'fresh'
      && reference?.freshness === 'fresh';
    const supply = stateIdentity ? state?.observation ?? null : null;
    const supplyFresh = Boolean(supply && /^\d+$/.test(supply.total_supply_raw) && /^\d+(\.\d+)?$/.test(supply.total_supply_units) && nonnegative(Number(supply.total_supply_units))
      && Number.isSafeInteger(supply.observed_block) && supply.observed_block >= 0 && supply.source
      && supply.freshness === 'fresh' && age(supply.observed_at, now, 15 * 60_000).state === 'fresh');
    const gaps = [!registryFresh ? 'REGISTRY_STALE_OR_UNAVAILABLE' : null,
      !corporateComplete ? 'MULTIPLIER_METADATA_INCOMPLETE' : null, adjustmentPending ? 'CORPORATE_ACTION_PENDING' : null,
      !market ? 'EXACT_CONTRACT_MARKET_UNAVAILABLE' : !marketFresh ? 'MARKET_STALE_OR_UNAVAILABLE' : null,
      !positive(market?.price_usd) ? 'DEX_PRICE_UNAVAILABLE' : null, !nonnegative(market?.liquidity_usd) ? 'LIQUIDITY_UNAVAILABLE' : null,
      !referenceFresh ? 'ISSUER_REFERENCE_UNAVAILABLE_OR_STALE' : null, !supplyFresh ? 'ONCHAIN_SUPPLY_UNAVAILABLE_OR_STALE' : null,
      'ISSUER_TERMS_AND_FULL_CORPORATE_ACTION_HISTORY_NOT_COLLECTED'].filter((item): item is string => item !== null);
    const pool = stateIdentity ? state?.direct_markets.find((item) => poolId && same(item.pool_id, poolId)) ?? null : null;
    const depth = pool?.depth_primitive ?? null;
    let verification = null;
    try { verification = pool && depth ? await verifyPltrV4Market({ chain_id: 4663, canonical_pltr_contract: normalized, base_contract: pool.base_contract, quote_contract: pool.quote_contract, relationship: pool.relationship, pool_key: depth.pool_key, reported_pool_id: pool.pool_id, state: depth }) : null; } catch { /* Malformed persisted depth remains missing evidence. */ }
    const poolFresh = Boolean(verification?.status === 'VERIFIED' && pool && pool.relationship === 'DIRECT_PRICE_DISCOVERY' && pool.verification_state === 'VERIFIED'
      && (same(pool.base_contract, normalized) || same(pool.quote_contract, normalized)) && pool.freshness === 'fresh'
      && age(pool.observed_at, now, 15 * 60_000).state === 'fresh' && depth && same(depth.pool_id, pool.pool_id)
      && depth.initialized && /^\d+$/.test(depth.active_liquidity) && BigInt(depth.active_liquidity) > 0n
      && /^\d+$/.test(depth.sqrt_price_x96) && BigInt(depth.sqrt_price_x96) > 0n
      && Number.isSafeInteger(depth.observed_block) && depth.observed_block >= 0
      && age(depth.observed_at, now, 15 * 60_000).state === 'fresh');
    const session = underlyingPltrSession(now);
    const basisAllowed = registryFresh && corporateComplete && !adjustmentPending && referenceFresh && poolFresh
      && session === 'OPEN' && reference?.session === 'OPEN' && pool?.price_source === 'VERIFIED_DIRECT_PLTR_PRICE_V1' && positive(Number(pool?.price_usd)) && positive(reference!.midpoint / Number(asset.current_multiplier));
    const basis = basisAllowed ? pltrBasis({ dex_price_usd: Number(pool!.price_usd), underlying_price_usd: reference!.midpoint,
      multiplier: asset.current_multiplier, dex_observed_at: pool!.observed_at, reference_observed_at: reference!.generated_at, session }) : null;
    const routeGaps = route === 'market_context' ? [] : [
      asset.ticker !== 'PLTR' ? 'ROUTE_NOT_SUPPORTED_FOR_ASSET' : null, !poolId ? 'EXACT_POOL_REQUIRED' : null,
      !poolFresh ? 'VERIFIED_FRESH_ROUTE_DEPTH_REQUIRED' : null,
      pool?.price_source !== 'VERIFIED_DIRECT_PLTR_PRICE_V1' ? 'VERIFIED_ROUTE_PRICE_REQUIRED' : null, !referenceFresh ? 'FRESH_REFERENCE_REQUIRED' : null,
      !supplyFresh ? 'FRESH_ONCHAIN_SUPPLY_REQUIRED' : supply && BigInt(supply.total_supply_raw) === 0n ? 'NONZERO_ONCHAIN_SUPPLY_REQUIRED' : null, !registryFresh ? 'FRESH_REGISTRY_REQUIRED' : null,
      !corporateComplete || adjustmentPending ? 'CORPORATE_ACTION_EVIDENCE_REQUIRED' : null,
      !basis || basis.status !== 'AVAILABLE' ? 'OPEN_SESSION_ALIGNED_ROUTE_BASIS_REQUIRED' : null,
      state?.readiness.status !== 'READY_FOR_SIMULATION' ? 'EXISTING_SIMULATION_PREREQUISITES_INCOMPLETE' : null
    ].filter((item): item is string => item !== null);
    const inputs = { registry: registryFresh, multiplier_metadata: registryFresh && corporateComplete && !adjustmentPending,
      issuer_reference: referenceFresh, onchain_supply: supplyFresh, indexed_dex_price: marketFresh && positive(market?.price_usd),
      indexed_liquidity: marketFresh && nonnegative(market?.liquidity_usd), issuer_terms: false, full_corporate_action_history: false };
    return { object_type: 'STOCK_TOKEN_EVIDENCE', methodology_version: STOCK_EVIDENCE_VERSION, evaluated_at: now.toISOString(), chain_id: 4663,
      identity: { asset_id: asset.asset_id, ticker: asset.ticker, name: asset.name, contract: normalized, status: asset.status,
        registry_source_url: 'https://api.robinhood.com/rhj/assets', observed_at: asset.observed_at, fetched_at: asset.fetched_at, freshness: registryAge },
      corporate_actions: { scope: 'ISSUER_MULTIPLIER_METADATA_ONLY', current_multiplier: corporateComplete ? asset.current_multiplier : null,
        pending_multiplier: asset.pending_multiplier, effective_at: asset.pending_multiplier_effective_at,
        metadata_complete: corporateComplete, adjustment_pending: adjustmentPending, full_history_available: false },
      market_context: market ? { snapshot_id: market.snapshot_id, pair_id: market.pair_address, source_url: publicDexSource(market.source_url),
        observed_at: market.provider_timestamp ?? market.captured_at, fetched_at: market.captured_at,
        time_basis: market.provider_timestamp ? 'PROVIDER_OBSERVATION' : 'PROVIDER_FETCH', freshness: { ...marketAge, state: marketFresh ? 'fresh' : marketAge.state === 'unavailable' ? 'unavailable' : 'stale' },
        price_usd: positive(market.price_usd) ? market.price_usd : null, liquidity_usd: nonnegative(market.liquidity_usd) ? market.liquidity_usd : null,
        rolling_volume_24h_usd: nonnegative(market.volume_h24) ? market.volume_h24 : null,
        indexed_transactions_24h: Number.isSafeInteger(market.txns_h24_buys) && Number.isSafeInteger(market.txns_h24_sells)
          && nonnegative(market.txns_h24_buys) && nonnegative(market.txns_h24_sells) ? market.txns_h24_buys + market.txns_h24_sells : null,
        scope: 'ONE_SELECTED_PROVIDER_POOL', executable_capacity_verified: false } : null,
      issuer_reference: referenceValid && reference ? { symbol: reference.symbol, bid: reference.bid, ask: reference.ask, midpoint: reference.midpoint,
        generated_at: reference.generated_at, fetched_at: reference.fetched_at, source_url: 'https://api.robinhood.com/rhj/prices/PLTR',
        freshness: { ...referenceAge, state: referenceFresh ? 'fresh' : 'stale' }, underlying_session_at_observation: reference.session,
        current_session: session, methodology: reference.methodology } : null,
      onchain_supply: supplyFresh && supply ? { observation_id: state!.observation_id, total_supply_raw: supply.total_supply_raw,
        total_supply_units: supply.total_supply_units, observed_block: supply.observed_block, observed_at: supply.observed_at, source: 'PERSISTED_RPC_OBSERVATION', source_url: `https://robinhoodchain.blockscout.com/block/${supply.observed_block}` } : null,
      route_evidence: { route_id: route, pool_id: poolId ?? null, observation_id: stateIdentity ? state?.observation_id ?? null : null,
        coverage: route === 'market_context' ? 'NOT_REQUESTED' : asset.ticker !== 'PLTR' ? 'UNSUPPORTED' : routeGaps.length ? 'INCOMPLETE' : 'INPUTS_PRESENT',
        missing_inputs: routeGaps, basis: basis?.status === 'AVAILABLE' ? basis : null,
        existing_preflight_url: asset.ticker === 'PLTR' ? '/v1/4663/reflexive/stocks/PLTR/preflight' : null,
        live_quote_available: false, execution_authorized: false },
      coverage: { inputs, fresh_input_count: Object.values(inputs).filter(Boolean).length, required_input_count: Object.keys(inputs).length, missing_inputs: gaps, full_product_coverage: 'INCOMPLETE' }, execution_authorized: false };
  }
}
