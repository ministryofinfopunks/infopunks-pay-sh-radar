import { createHash } from 'node:crypto';
import pg from 'pg';
import { normalizeBlockscoutAddress } from '../providers/blockscoutProvider';
import { resolvePostgresPool, RetryablePostgresSchema, type PostgresPoolSource } from '../persistence/retryablePostgresSchema';

/**
 * Reflexive Radar deliberately models observations, not CALL/RESOLUTION/PRINT
 * receipts.  The source data is append-only and every number retains units.
 */
export const REFLEXIVE_CHAIN_ID = 4663;
export const REFLEXIVE_METHOD_VERSION = 'rmm-v0.1.0';
export const PAIR_V5_ABI_SOURCE = 'PAIR production frontend + documentation, observed 2026-09-01';
/** Addresses are documentation candidates; PairV5OnchainVerifier verifies chain id and deployed bytecode before use. */
export const PAIR_V5_DEPLOYMENTS = {
  launchpad: '0x8660A7F019C7943b0b0A91B8E39AFf3b6DB6Ae62', locker: '0xeFcF476E8870fB3eb8680f039414fdcCE6C2a117', hook: '0x16D1560630Ce74af4478d9b8AD46548A092A2000',
  poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951', stateView: '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b'
} as const;
export type CanonicalStockAsset = { asset_id: string; ticker: string; name: string; chain_id: number; canonical_contract: string; status: string; current_multiplier: string; pending_multiplier: string | null; pending_multiplier_effective_at: string | null; trading_capabilities: Record<string, unknown> | null; logo: string | null; observed_at: string; fetched_at: string; provenance: string; first_party_asset: boolean };
export type PoolKey = { currency0: string; currency1: string; fee: number; tick_spacing: number; hooks: string };
export type PairBirthRecord = { birth_id: string; mission_pair_id: string; launch_group_id: string; chain_id: number; mission_contract: string; mission_symbol: string; quote_contract: string; quote_ticker: string; rh_asset_id: string; venue: 'PAIR'; venue_version: 'V5'; launchpad_proxy: string; launch_implementation: string | null; pool_key: PoolKey; pool_id: string; pool_manager: string; hook: string; fee: number; tickSpacing: number; launch_tx: string; launch_block: number; launch_timestamp: string; discovery_source: string; canonical_evidence: Evidence[]; birth_recorded_at: string; methodology_version: string; immutable: true };
export type LifecycleCheckpoint = { checkpoint_id: string; pair_id: string; checkpoint: 'T10M' | 'T1H' | 'T6H' | 'T24H' | 'D3' | 'D7' | 'D30'; target_at: string; state: 'PENDING' | 'OBSERVED' | 'MISSED' | 'UNAVAILABLE'; actual_observation_id: string | null; actual_observed_at: string | null; distance_ms: number | null; source_completeness: 'complete' | 'partial' | 'unavailable' };
export type PairVerification = { verification_status: 'CANDIDATE' | 'PARTIALLY_VERIFIED' | 'VERIFIED'; failure_reasons: VerificationFailure[]; verified_at: string | null; verification_block: number | null; observed_block: number | null; confirmed_block: number | null; launch_provenance_method: 'launchpad_registry_and_receipt' | null; launch_implementation_observed: string | null; pool_key: PoolKey | null; state_view_address: string | null; state_observed_block: number | null; state_observed_at: string | null; rpc_provider: string | null; sqrt_price_x96: string | null; tick: number | null; active_liquidity: string | null; position_verification_status: 'VERIFIED_LOCKER_POSITION' | 'POSITION_UNRESOLVED' | 'NOT_ATTEMPTED' };
export type VerificationFailure = 'PAIR_API_ONLY' | 'CHAIN_ID_MISMATCH' | 'NONCANONICAL_STOCK_TOKEN' | 'LAUNCHPAD_PROVENANCE_MISSING' | 'POOL_KEY_UNRESOLVED' | 'POOL_ID_MISMATCH' | 'POOL_NOT_INITIALIZED' | 'STATEVIEW_UNAVAILABLE' | 'HOOK_MISMATCH' | 'LAUNCH_TX_UNCONFIRMED' | 'POSITION_UNRESOLVED' | 'RPC_UNAVAILABLE';
export type MissionPair = { pair_id: string; launch_id: string; launch_group_id: string; chain_id: number; protocol: string; venue: string; pool_id: string; pool_address: string | null; mission_contract: string; mission_symbol: string; stock_asset_id: string; quote_contract: string; launched_at: string; launch_block: number | null; canonicality: 'verified' | 'rejected' | 'source_required'; first_party_asset: boolean; fee_policy: string | null; evidence: Evidence[]; verification: PairVerification };
export type Evidence = { source: string; href: string; observed_at: string; fetched_at: string; note: string; quality: 'onchain' | 'official_api' | 'indexed_context' | 'unavailable' };
export type PairObservation = { observation_id: string; pair_id: string; observed_at: string; fetched_at: string; observed_block: number | null; sqrt_price_x96: string | null; tick: number | null; active_liquidity: string | null; mission_stock_price: string | null; multiplier_context: string | null; mission_usd_price: number | null; stock_dex_usd_price: number | null; underlying_usd_price: number | null; underlying_observed_at: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; quote_inventory_raw: string | null; quote_inventory_share_equivalent: string | null; inventory_method: 'v4_position_reconstruction' | 'locked_position_accounting' | 'event_derived_position_accounting' | 'unavailable'; fresh: boolean; provenance: Evidence[]; immutable: true };
export type StockSupplyEvent = { event_id: string; asset_id: string; event_type: 'mint' | 'burn' | 'multiplier_change'; raw_token_amount: string | null; share_equivalent_amount: string | null; block: number | null; tx_hash: string | null; timestamp: string; before_supply_raw: string | null; after_supply_raw: string | null; provenance: Evidence };
export type ReflexivityEvent = { event_id: string; event_type: 'NEW_STOCK_PAIRED_MARKET' | 'QUOTE_ABSORPTION_MILESTONE' | 'STOCK_TOKEN_BASIS_EXCURSION' | 'STOCK_SUPPLY_MINT' | 'STOCK_SUPPLY_BURN' | 'SUPPLY_RESPONSE_AFTER_STRESS' | 'MISSION_ALPHA_BREAKOUT' | 'QUOTE_VOLUME_SHARE_MILESTONE' | 'D1_SURVIVAL' | 'D3_SURVIVAL' | 'D7_SURVIVAL'; subject_id: string; occurred_at: string; trigger_version: string; trigger: string; evidence_ids: string[] };
export type ThesisState = 'SUPPORTING' | 'MIXED' | 'AGAINST' | 'INSUFFICIENT_DATA';
export type ThesisEvidence = { hypothesis_id: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6'; state: ThesisState; rule_version: string; rationale: string; evidence_ids: string[]; observed_at: string };
export type ReflexiveSnapshot = { assets: CanonicalStockAsset[]; pairs: MissionPair[]; births: PairBirthRecord[]; lifecycle: LifecycleCheckpoint[]; observations: PairObservation[]; supply_events: StockSupplyEvent[]; events: ReflexivityEvent[]; thesis: ThesisEvidence[]; refreshed_at: string; cursor: string | null };

export interface ReflexiveStore { readonly adapter: 'memory' | 'postgres'; readonly durable: boolean; load(): Promise<ReflexiveSnapshot>; save(snapshot: ReflexiveSnapshot): Promise<void>; }
const emptySnapshot = (): ReflexiveSnapshot => ({ assets: [], pairs: [], births: [], lifecycle: [], observations: [], supply_events: [], events: [], thesis: defaultThesis(), refreshed_at: new Date(0).toISOString(), cursor: null });
export class InMemoryReflexiveStore implements ReflexiveStore { readonly adapter = 'memory' as const; readonly durable = false; private snapshot = emptySnapshot(); async load() { return structuredClone(this.snapshot); } async save(snapshot: ReflexiveSnapshot) { this.snapshot = structuredClone(snapshot); } }
export class PostgresReflexiveStore implements ReflexiveStore {
  readonly adapter = 'postgres' as const; readonly durable = true; private readonly pool: pg.Pool; private readonly ownsPool: boolean; private readonly schema = new RetryablePostgresSchema('rh_chain_reflexive_store');
  constructor(source: PostgresPoolSource) { const result = resolvePostgresPool(source); this.pool = result.pool; this.ownsPool = result.ownsPool; }
  async load() { await this.ensure(); const row = await this.pool.query<{ payload: ReflexiveSnapshot }>('select payload from rh_chain_reflexive_snapshots order by refreshed_at desc limit 1'); return row.rows[0]?.payload ?? emptySnapshot(); }
  async save(snapshot: ReflexiveSnapshot) { await this.ensure(); await this.pool.query('insert into rh_chain_reflexive_snapshots (snapshot_id, refreshed_at, payload) values ($1,$2,$3::jsonb)', [stableId('snapshot', snapshot.refreshed_at), snapshot.refreshed_at, JSON.stringify(snapshot)]); }
  async close() { if (this.ownsPool) await this.pool.end(); }
  private ensure() { return this.schema.ensure(this.pool, 'create table if not exists rh_chain_reflexive_snapshots (snapshot_id text primary key, refreshed_at timestamptz not null, payload jsonb not null); create index if not exists rh_chain_reflexive_snapshots_refreshed_at_idx on rh_chain_reflexive_snapshots (refreshed_at desc);'); }
}

type RobinhoodAsset = { id?: unknown; tokenSymbol?: unknown; tokenName?: unknown; deployments?: unknown; currentMultiplier?: unknown; pendingMultiplier?: unknown; pendingMultiplierEffectiveTime?: unknown; tradingCapabilities?: unknown; logoUrl?: unknown; status?: unknown };
export type PairDiscoveryCandidate = { protocol: string; venue: string; pool_id: string; pool_address?: string | null; mission_contract: string; mission_symbol: string; quote_contract: string; launched_at: string; launch_tx_hash?: string | null; launch_block?: number | null; launch_id?: string; hook?: string | null; fee_policy?: string | null; evidence: Evidence[]; onchain?: PairVerification; first_party_asset?: boolean };
export type ReflexiveProvider = { assets(): Promise<unknown>; discover?(assets: CanonicalStockAsset[], cursor: string | null): Promise<PairDiscoveryCandidate[]>; observations?(pairs: MissionPair[], assets: CanonicalStockAsset[]): Promise<PairObservation[]>; supplyEvents?(assets: CanonicalStockAsset[]): Promise<StockSupplyEvent[]> };

/** PAIR's index is discovery context. A candidate is emitted only after an independent
 * verifier accepts the V4 pool id/mission/quote relationship; API cards never qualify a pair. */
export class PairV5DiscoveryAdapter {
  constructor(private readonly options: { fetchImpl?: typeof fetch; baseUrl?: string; verifyPool: (input: PairDiscoveryCandidate) => Promise<boolean | PairVerification>; now?: () => Date }) {}
  async discover(assets: CanonicalStockAsset[]): Promise<PairDiscoveryCandidate[]> {
    const fetched = (this.options.now ?? (() => new Date()))().toISOString(); const response = await (this.options.fetchImpl ?? fetch)(`${(this.options.baseUrl ?? 'https://pair.fund').replace(/\/$/, '')}/api/tokens`);
    if (!response.ok) throw new Error(`pair_tokens_http_${response.status}`); const body = await response.json() as { items?: unknown[] }; const items = Array.isArray(body.items) ? body.items : []; const output: PairDiscoveryCandidate[] = [];
    for (const item of items) { if (!isRecord(item)) continue; const mission = string(item.address); const symbol = string(item.symbol); const launchedAt = unixToIso(item.launchedAt); const launchTx = string(item.launchTxHash); const pairs = Array.isArray(item.pairs) ? item.pairs : [];
      if (!mission || !symbol || !launchedAt) continue;
      for (const pair of pairs) { if (!isRecord(pair) || string(pair.ammVersion) !== 'V4_MULTI') continue; const quote = isRecord(pair.quoteToken) ? string(pair.quoteToken.address) : null; const poolId = string(pair.poolId); if (!quote || !poolId || !isCanonicalStockContract(assets, quote)) continue;
        const candidate: PairDiscoveryCandidate = { protocol: 'uniswap-v4', venue: 'PAIR', pool_id: poolId, pool_address: null, mission_contract: mission, mission_symbol: symbol, quote_contract: quote, launched_at: launchedAt, launch_id: string(item.launchTxHash) ?? undefined, launch_tx_hash: launchTx, hook: isRecord(pair) ? string(pair.hookAddress) : null, fee_policy: 'PAIR V5; fee semantics must be read from verified launch configuration.', evidence: [{ source: 'PAIR /api/tokens', href: 'https://pair.fund/api/tokens', observed_at: fetched, fetched_at: fetched, note: 'PAIR indexed discovery context; chain verification is required.', quality: 'indexed_context' }, ...(launchTx ? [{ source: 'PAIR launch transaction', href: `https://robinhoodchain.blockscout.com/tx/${launchTx}`, observed_at: fetched, fetched_at: fetched, note: 'Launch transaction reference supplied by discovery index.', quality: 'indexed_context' as const }] : [])] };
        const result = await this.options.verifyPool(candidate); if (!result) continue; candidate.onchain = typeof result === 'boolean' ? { verification_status: 'VERIFIED', failure_reasons: [], verified_at: fetched, verification_block: null, observed_block: null, confirmed_block: null, launch_provenance_method: 'launchpad_registry_and_receipt', launch_implementation_observed: null, pool_key: null, state_view_address: null, state_observed_block: null, state_observed_at: null, rpc_provider: 'adapter_verify_callback', sqrt_price_x96: null, tick: null, active_liquidity: null, position_verification_status: 'NOT_ATTEMPTED' } : result; output.push(candidate);
      }
    }
    return output;
  }
}

const launchpadAbi = [
  { type: 'function', name: 'getLaunchPoolCount', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getLaunchPool', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'quoteToken', type: 'address' }, { name: 'weightBps', type: 'uint16' }, { name: 'poolId', type: 'bytes32' }, { name: 'positionId', type: 'uint256' }, { name: 'initialProjectTokenAmount', type: 'uint256' }, { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' }, { name: 'quoteUsdAtLaunchE8', type: 'uint256' }, { name: 'quotePriceFeed', type: 'address' }, { name: 'quoteDecimals', type: 'uint8' }] }] }
] as const;
const stateViewAbi = [
  { type: 'function', name: 'getSlot0', stateMutability: 'view', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] },
  { type: 'function', name: 'getLiquidity', stateMutability: 'view', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ type: 'uint128' }] }
] as const;
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as `0x${string}`;

export function normalizePoolKey(mission: string, quote: string, fee: number, tickSpacing: number, hooks: string): PoolKey {
  const [currency0, currency1] = [normalizeBlockscoutAddress(mission), normalizeBlockscoutAddress(quote)].sort();
  return { currency0, currency1, fee, tick_spacing: tickSpacing, hooks: normalizeBlockscoutAddress(hooks) };
}
/** This is the deployed Uniswap V4 PoolKey hash: keccak256(abi.encode(PoolKey)); no custom formula. */
export async function deriveUniswapV4PoolId(key: PoolKey): Promise<`0x${string}`> {
  const { encodeAbiParameters, keccak256 } = await import('viem');
  return keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }], [key.currency0 as `0x${string}`, key.currency1 as `0x${string}`, key.fee, key.tick_spacing, key.hooks as `0x${string}`]));
}
export function missionPerStockFromSqrtPrice(sqrtPriceX96: bigint, missionIsCurrency0: boolean, missionDecimals: number, stockDecimals: number): string | null {
  if (sqrtPriceX96 <= 0n || !Number.isInteger(missionDecimals) || !Number.isInteger(stockDecimals) || missionDecimals < 0 || stockDecimals < 0) return null;
  // raw currency1/currency0 = (sqrtPriceX96 / 2^96)^2. Convert raw units to human units before orienting mission/stock.
  const root = Number(sqrtPriceX96) / Number(2n ** 96n); const c1PerC0 = root * root * 10 ** (missionDecimals - stockDecimals);
  const value = missionIsCurrency0 ? c1PerC0 : 1 / c1PerC0;
  return Number.isFinite(value) && value > 0 && value < Number.MAX_VALUE ? value.toString() : null;
}

export class PairV5OnchainVerifier {
  private readonly client: Promise<any>;
  constructor(private readonly options: { rpcUrl: string; providerName: string; confirmations?: number; deployments?: typeof PAIR_V5_DEPLOYMENTS; now?: () => Date }) {
    const rpc = options.rpcUrl; this.client = import('viem').then(({ createPublicClient, defineChain, http }) => { const chain = defineChain({ id: REFLEXIVE_CHAIN_ID, name: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } }); return createPublicClient({ chain, transport: http(rpc, { timeout: 5_000, retryCount: 1, retryDelay: 250 }) }); });
  }
  async verify(candidate: PairDiscoveryCandidate, assets: CanonicalStockAsset[]): Promise<PairVerification> {
    const now = (this.options.now ?? (() => new Date()))().toISOString(); const deployments = this.options.deployments ?? PAIR_V5_DEPLOYMENTS; const failure: VerificationFailure[] = []; const client = await this.client;
    try {
      if (await client.getChainId() !== REFLEXIVE_CHAIN_ID) return this.failed(['CHAIN_ID_MISMATCH']);
      if (!isCanonicalStockContract(assets, candidate.quote_contract)) return this.failed(['NONCANONICAL_STOCK_TOKEN']);
      const required = [deployments.launchpad, deployments.poolManager, deployments.stateView, deployments.hook];
      const codes = await Promise.all(required.map((address) => client.getBytecode({ address: address as `0x${string}` })));
      if (codes.some((code) => !code || code === '0x')) return this.failed(['RPC_UNAVAILABLE']);
      if (candidate.hook && normalizeBlockscoutAddress(candidate.hook) !== normalizeBlockscoutAddress(deployments.hook)) return this.failed(['HOOK_MISMATCH']);
      if (!candidate.launch_tx_hash) return this.failed(['LAUNCHPAD_PROVENANCE_MISSING']);
      const receipt = await client.getTransactionReceipt({ hash: candidate.launch_tx_hash as `0x${string}` }); const transaction = await client.getTransaction({ hash: candidate.launch_tx_hash as `0x${string}` });
      if (receipt.status !== 'success' || !transaction.to || normalizeBlockscoutAddress(transaction.to) !== normalizeBlockscoutAddress(deployments.launchpad)) return this.failed(['LAUNCHPAD_PROVENANCE_MISSING']);
      const latest = await client.getBlockNumber(); const confirmations = this.options.confirmations ?? 3; if (latest < receipt.blockNumber + BigInt(confirmations)) return this.failed(['LAUNCH_TX_UNCONFIRMED']);
      const count = await client.readContract({ address: deployments.launchpad as `0x${string}`, abi: launchpadAbi, functionName: 'getLaunchPoolCount', args: [candidate.mission_contract as `0x${string}`] });
      let registry: { quoteToken: string; poolId: string; positionId: bigint } | null = null;
      for (let index = 0n; index < count; index++) { const pool = await client.readContract({ address: deployments.launchpad as `0x${string}`, abi: launchpadAbi, functionName: 'getLaunchPool', args: [candidate.mission_contract as `0x${string}`, index] }) as unknown as { quoteToken: string; poolId: string; positionId: bigint }; if (normalizeBlockscoutAddress(pool.quoteToken) === normalizeBlockscoutAddress(candidate.quote_contract) && pool.poolId.toLowerCase() === candidate.pool_id.toLowerCase()) { registry = pool; break; } }
      if (!registry) return this.failed(['LAUNCHPAD_PROVENANCE_MISSING']);
      const poolKey = normalizePoolKey(candidate.mission_contract, candidate.quote_contract, 10_000, 200, deployments.hook); const derived = await deriveUniswapV4PoolId(poolKey);
      if (derived.toLowerCase() !== candidate.pool_id.toLowerCase()) return this.failed(['POOL_ID_MISMATCH']);
      let slot0: readonly unknown[]; let liquidity: bigint;
      try { slot0 = await client.readContract({ address: deployments.stateView as `0x${string}`, abi: stateViewAbi, functionName: 'getSlot0', args: [derived] }) as unknown as readonly unknown[]; liquidity = await client.readContract({ address: deployments.stateView as `0x${string}`, abi: stateViewAbi, functionName: 'getLiquidity', args: [derived] }) as bigint; }
      catch { return this.failed(['STATEVIEW_UNAVAILABLE']); }
      if (BigInt(slot0[0] as bigint) === 0n) return this.failed(['POOL_NOT_INITIALIZED']);
      let implementation: string | null = null; try { const implementationStorage = await client.getStorageAt({ address: deployments.launchpad as `0x${string}`, slot: EIP1967_IMPLEMENTATION_SLOT, blockNumber: receipt.blockNumber }); implementation = implementationStorage && implementationStorage.length === 66 ? `0x${implementationStorage.slice(-40)}` : null; } catch { /* provider capability is evidence quality, not market identity */ }
      return { verification_status: 'VERIFIED', failure_reasons: failure, verified_at: now, verification_block: Number(latest), observed_block: Number(receipt.blockNumber), confirmed_block: Number(latest), launch_provenance_method: 'launchpad_registry_and_receipt', launch_implementation_observed: implementation, pool_key: poolKey, state_view_address: normalizeBlockscoutAddress(deployments.stateView), state_observed_block: Number(latest), state_observed_at: now, rpc_provider: this.options.providerName, sqrt_price_x96: String(slot0[0]), tick: Number(slot0[1]), active_liquidity: String(liquidity), position_verification_status: registry.positionId > 0n ? 'VERIFIED_LOCKER_POSITION' : 'POSITION_UNRESOLVED' };
    } catch { return this.failed(['RPC_UNAVAILABLE']); }
  }
  private failed(reasons: VerificationFailure[]): PairVerification { return { verification_status: reasons.includes('PAIR_API_ONLY') ? 'CANDIDATE' : 'PARTIALLY_VERIFIED', failure_reasons: reasons, verified_at: null, verification_block: null, observed_block: null, confirmed_block: null, launch_provenance_method: null, launch_implementation_observed: null, pool_key: null, state_view_address: null, state_observed_block: null, state_observed_at: null, rpc_provider: this.options.providerName, sqrt_price_x96: null, tick: null, active_liquidity: null, position_verification_status: 'NOT_ATTEMPTED' }; }
}

export function normalizeShareEquivalent(raw: string | number, multiplier: string | number): string { const result = Number(raw) * Number(multiplier); return Number.isFinite(result) ? String(result) : '0'; }
export function missionAlpha(missionStart: number, missionEnd: number, underlyingStart: number, underlyingEnd: number): number | null { if ([missionStart, missionEnd, underlyingStart, underlyingEnd].some((n) => !Number.isFinite(n) || n <= 0)) return null; return (missionEnd / missionStart) / (underlyingEnd / underlyingStart) - 1; }
export function stockTokenBasis(dexPrice: number | null, rawUnderlyingPrice: number | null, multiplier: string | number, dexAt: string | null, referenceAt: string | null, maxSkewMs = 120_000): number | null { if (!dexPrice || !rawUnderlyingPrice || !dexAt || !referenceAt || !Number.isFinite(Number(multiplier))) return null; if (Math.abs(Date.parse(dexAt) - Date.parse(referenceAt)) > maxSkewMs) return null; const tokenReference = rawUnderlyingPrice / Number(multiplier); return tokenReference > 0 ? dexPrice / tokenReference - 1 : null; }
export function isCanonicalStockContract(assets: readonly CanonicalStockAsset[], contract: string): boolean { const normalized = normalizeBlockscoutAddress(contract); return assets.some((asset) => asset.chain_id === REFLEXIVE_CHAIN_ID && asset.canonical_contract === normalized && asset.status === 'ASSET_STATUS_ACTIVE'); }
/** V4 singleton balances are intentionally never accepted as pool inventory. */
export function quoteInventory(raw: string | null, multiplier: string, method: PairObservation['inventory_method']) { return method === 'unavailable' || raw === null ? { raw: null, share_equivalent: null, method: 'unavailable' as const } : { raw, share_equivalent: normalizeShareEquivalent(raw, multiplier), method }; }
export function stableId(...parts: string[]) { return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32); }

export class ReflexiveRadarService {
  constructor(private readonly store: ReflexiveStore, private readonly provider: ReflexiveProvider, private readonly now = () => new Date()) {}
  async refresh() {
    const prior = await this.store.load(); const fetchedAt = this.now().toISOString(); const assets = normalizeAssets(await this.provider.assets(), fetchedAt);
    const candidates = await this.provider.discover?.(assets, prior.cursor) ?? [];
    const pairs = dedupePairs([...prior.pairs, ...candidates.map((candidate) => candidateToPair(candidate, assets)).filter((pair): pair is MissionPair => Boolean(pair))]);
    const newlyObserved = await this.provider.observations?.(pairs, assets) ?? [];
    // Observation ids include timestamp; previously published market state is never overwritten.
    const observations = dedupeObservations([...prior.observations, ...newlyObserved]);
    const supplyEvents = dedupeSupplyEvents([...prior.supply_events, ...await this.provider.supplyEvents?.(assets) ?? []]);
    const events = evaluateEvents(pairs, observations, supplyEvents, prior.events);
    const thesis = evaluateThesis(pairs, observations, events, fetchedAt);
    const births = [...prior.births, ...pairs.filter((pair) => pair.verification.verification_status === 'VERIFIED' && !prior.births.some((birth) => birth.mission_pair_id === pair.pair_id)).map((pair) => birthRecord(pair, assets, fetchedAt))];
    const lifecycle = updateLifecycle([...prior.lifecycle], pairs, observations, fetchedAt);
    const snapshot: ReflexiveSnapshot = { assets, pairs, births, lifecycle, observations, supply_events: supplyEvents, events, thesis, refreshed_at: fetchedAt, cursor: prior.cursor };
    await this.store.save(snapshot); return snapshot;
  }
  async snapshot() { return this.store.load(); }
  async pair(pairId: string) { return (await this.store.load()).pairs.find((pair) => pair.pair_id === pairId) ?? null; }
  async stock(ticker: string) { const snapshot = await this.store.load(); const asset = snapshot.assets.find((item) => item.ticker.toUpperCase() === ticker.toUpperCase()); if (!asset) return null; const pairs = snapshot.pairs.filter((pair) => pair.stock_asset_id === asset.asset_id); return { asset, pairs, observations: snapshot.observations.filter((item) => pairs.some((pair) => pair.pair_id === item.pair_id)), supply_events: snapshot.supply_events.filter((item) => item.asset_id === asset.asset_id), net_quote_demand: 'NOT_YET_ATTRIBUTABLE' as const }; }
}

function normalizeAssets(payload: unknown, fetchedAt: string): CanonicalStockAsset[] {
  const rows = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.assets) ? payload.assets : [];
  return rows.flatMap((value) => { const item = value as RobinhoodAsset; const id = string(item.id); const ticker = string(item.tokenSymbol); const deployments = Array.isArray(item.deployments) ? item.deployments : []; if (!id || !ticker) return []; return deployments.flatMap((deployment) => { const row = deployment as Record<string, unknown>; const chain = Number(row.chainId); const contract = string(row.contractAddress); if (chain !== REFLEXIVE_CHAIN_ID || !isAddress(contract)) return []; return [{ asset_id: id.toLowerCase(), ticker: ticker.toUpperCase(), name: string(item.tokenName) ?? ticker, chain_id: chain, canonical_contract: normalizeBlockscoutAddress(contract), status: string(item.status) ?? 'ASSET_STATUS_UNSPECIFIED', current_multiplier: string(item.currentMultiplier) ?? '1', pending_multiplier: string(item.pendingMultiplier), pending_multiplier_effective_at: string(item.pendingMultiplierEffectiveTime), trading_capabilities: isRecord(item.tradingCapabilities) ? item.tradingCapabilities : null, logo: string(item.logoUrl), observed_at: fetchedAt, fetched_at: fetchedAt, provenance: 'Robinhood RHJ /assets + chain 4663 deployment', first_party_asset: false }]; }); });
}
function candidateToPair(candidate: PairDiscoveryCandidate, assets: CanonicalStockAsset[]): MissionPair | null { if (!isCanonicalStockContract(assets, candidate.quote_contract) || !isAddress(candidate.mission_contract) || !candidate.pool_id || candidate.onchain?.verification_status !== 'VERIFIED') return null; const asset = assets.find((item) => item.canonical_contract === normalizeBlockscoutAddress(candidate.quote_contract)); if (!asset) return null; const pool = candidate.pool_id.toLowerCase(); const launch = candidate.launch_id ?? stableId(candidate.protocol, pool, candidate.mission_contract, asset.canonical_contract, candidate.launched_at); return { pair_id: stableId(String(REFLEXIVE_CHAIN_ID), candidate.protocol, pool, candidate.mission_contract.toLowerCase(), asset.canonical_contract, candidate.venue, candidate.launched_at), launch_id: launch, launch_group_id: stableId('launch-group', candidate.mission_contract.toLowerCase(), candidate.launch_tx_hash ?? launch), chain_id: REFLEXIVE_CHAIN_ID, protocol: candidate.protocol, venue: candidate.venue, pool_id: pool, pool_address: candidate.pool_address ? normalizeBlockscoutAddress(candidate.pool_address) : null, mission_contract: normalizeBlockscoutAddress(candidate.mission_contract), mission_symbol: candidate.mission_symbol, stock_asset_id: asset.asset_id, quote_contract: asset.canonical_contract, launched_at: candidate.launched_at, launch_block: candidate.onchain.observed_block ?? candidate.launch_block ?? null, canonicality: 'verified', first_party_asset: Boolean(candidate.first_party_asset), fee_policy: candidate.fee_policy ?? null, evidence: candidate.evidence, verification: candidate.onchain }; }
function evaluateEvents(pairs: MissionPair[], observations: PairObservation[], supply: StockSupplyEvent[], prior: ReflexivityEvent[]) { const generated: ReflexivityEvent[] = []; for (const pair of pairs) { generated.push({ event_id: stableId('birth', pair.pair_id), event_type: 'NEW_STOCK_PAIRED_MARKET', subject_id: pair.pair_id, occurred_at: pair.launched_at, trigger_version: REFLEXIVE_METHOD_VERSION, trigger: 'verified canonical quote contract plus onchain-verifiable pool identity', evidence_ids: pair.evidence.map((item) => stableId(item.href, item.observed_at)) }); }
  for (const event of supply) generated.push({ event_id: stableId(event.event_type, event.event_id), event_type: event.event_type === 'mint' ? 'STOCK_SUPPLY_MINT' : event.event_type === 'burn' ? 'STOCK_SUPPLY_BURN' : 'SUPPLY_RESPONSE_AFTER_STRESS', subject_id: event.asset_id, occurred_at: event.timestamp, trigger_version: REFLEXIVE_METHOD_VERSION, trigger: `canonical Stock Token ${event.event_type} observation`, evidence_ids: [event.event_id] });
  return [...prior, ...generated].filter((item, index, list) => list.findIndex((other) => other.event_id === item.event_id) === index).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
function birthRecord(pair: MissionPair, assets: CanonicalStockAsset[], recordedAt: string): PairBirthRecord {
  const asset = assets.find((item) => item.asset_id === pair.stock_asset_id); const verification = pair.verification; if (!asset || !verification.pool_key || !verification.observed_block || !pair.launch_id) throw new Error('verified_birth_identity_incomplete');
  return { birth_id: stableId('birth-record', pair.pair_id), mission_pair_id: pair.pair_id, launch_group_id: pair.launch_group_id, chain_id: pair.chain_id, mission_contract: pair.mission_contract, mission_symbol: pair.mission_symbol, quote_contract: pair.quote_contract, quote_ticker: asset.ticker, rh_asset_id: asset.asset_id, venue: 'PAIR', venue_version: 'V5', launchpad_proxy: PAIR_V5_DEPLOYMENTS.launchpad.toLowerCase(), launch_implementation: verification.launch_implementation_observed, pool_key: verification.pool_key, pool_id: pair.pool_id, pool_manager: PAIR_V5_DEPLOYMENTS.poolManager.toLowerCase(), hook: verification.pool_key.hooks, fee: verification.pool_key.fee, tickSpacing: verification.pool_key.tick_spacing, launch_tx: pair.launch_id, launch_block: verification.observed_block, launch_timestamp: pair.launched_at, discovery_source: 'PAIR /api/tokens → independent onchain verification', canonical_evidence: pair.evidence, birth_recorded_at: recordedAt, methodology_version: REFLEXIVE_METHOD_VERSION, immutable: true };
}
const checkpointOffsets: Array<[LifecycleCheckpoint['checkpoint'], number]> = [['T10M', 10 * 60_000], ['T1H', 60 * 60_000], ['T6H', 6 * 60 * 60_000], ['T24H', 24 * 60 * 60_000], ['D3', 3 * 24 * 60 * 60_000], ['D7', 7 * 24 * 60 * 60_000], ['D30', 30 * 24 * 60 * 60_000]];
function updateLifecycle(existing: LifecycleCheckpoint[], pairs: MissionPair[], observations: PairObservation[], now: string) {
  const nowMs = Date.parse(now); const output = [...existing]; for (const pair of pairs) for (const [checkpoint, offset] of checkpointOffsets) { const id = stableId('checkpoint', pair.pair_id, checkpoint); if (output.some((item) => item.checkpoint_id === id)) continue; const target = Date.parse(pair.launched_at) + offset; const tolerance = checkpoint === 'T10M' ? 3 * 60_000 : Math.min(60 * 60_000, Math.round(offset * .1)); const candidate = observations.filter((item) => item.pair_id === pair.pair_id).map((item) => ({ item, distance: Math.abs(Date.parse(item.observed_at) - target) })).filter((item) => item.distance <= tolerance).sort((a, b) => a.distance - b.distance)[0]; const state: LifecycleCheckpoint['state'] = candidate ? 'OBSERVED' : nowMs > target + tolerance ? 'MISSED' : 'PENDING'; output.push({ checkpoint_id: id, pair_id: pair.pair_id, checkpoint, target_at: new Date(target).toISOString(), state, actual_observation_id: candidate?.item.observation_id ?? null, actual_observed_at: candidate?.item.observed_at ?? null, distance_ms: candidate?.distance ?? null, source_completeness: candidate ? 'partial' : 'unavailable' }); }
  return output;
}
function evaluateThesis(pairs: MissionPair[], observations: PairObservation[], events: ReflexivityEvent[], at: string): ThesisEvidence[] { const active = pairs.filter((pair) => pair.canonicality === 'verified').length; const complete = observations.filter((observation) => observation.fresh && observation.volume_24h_usd !== null).length; const state: ThesisState = active && complete ? 'SUPPORTING' : active ? 'MIXED' : 'INSUFFICIENT_DATA'; const h1: ThesisEvidence = { hypothesis_id: 'H1', state, rule_version: REFLEXIVE_METHOD_VERSION, rationale: active ? `${active} verified Stock-quoted market(s); volume completeness is ${complete}/${active}.` : 'No verified stock-paired market has been persisted.', evidence_ids: events.filter((event) => event.event_type === 'NEW_STOCK_PAIRED_MARKET').map((event) => event.event_id), observed_at: at }; return [h1, { hypothesis_id: 'H2', state: observations.some((item) => item.inventory_method !== 'unavailable') ? 'MIXED' : 'INSUFFICIENT_DATA', rule_version: REFLEXIVE_METHOD_VERSION, rationale: 'Persistent pool-specific inventory requires a defensible per-pool method; PoolManager balances are excluded.', evidence_ids: [], observed_at: at }, ...['H3', 'H4', 'H5', 'H6'].map((hypothesis_id) => ({ hypothesis_id: hypothesis_id as ThesisEvidence['hypothesis_id'], state: 'INSUFFICIENT_DATA' as ThesisState, rule_version: REFLEXIVE_METHOD_VERSION, rationale: hypothesis_id === 'H6' ? 'No defensible matched non-stock control cohort yet.' : 'Lifecycle evidence is not yet sufficient for a deterministic state.', evidence_ids: [], observed_at: at }))]; }
function defaultThesis(): ThesisEvidence[] { return evaluateThesis([], [], [], new Date(0).toISOString()); }
function dedupePairs(items: MissionPair[]) { return items.filter((item, index, list) => list.findIndex((other) => other.pair_id === item.pair_id) === index); }
function dedupeObservations(items: PairObservation[]) { return items.filter((item, index, list) => list.findIndex((other) => other.observation_id === item.observation_id) === index); }
function dedupeSupplyEvents(items: StockSupplyEvent[]) { return items.filter((item, index, list) => list.findIndex((other) => other.event_id === item.event_id) === index); }
function string(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isAddress(value: string | null): value is string { return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value)); }
function unixToIso(value: unknown) { const seconds = Number(value); return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1_000).toISOString() : null; }
