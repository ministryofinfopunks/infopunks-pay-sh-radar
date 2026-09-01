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
export type CanonicalStockAsset = { asset_id: string; ticker: string; name: string; chain_id: number; canonical_contract: string; status: string; current_multiplier: string; pending_multiplier: string | null; pending_multiplier_effective_at: string | null; trading_capabilities: Record<string, unknown> | null; logo: string | null; observed_at: string; fetched_at: string; provenance: string; first_party_asset: boolean };
export type MissionPair = { pair_id: string; launch_id: string; chain_id: number; protocol: string; venue: string; pool_id: string; pool_address: string | null; mission_contract: string; mission_symbol: string; stock_asset_id: string; quote_contract: string; launched_at: string; launch_block: number | null; canonicality: 'verified' | 'rejected' | 'source_required'; first_party_asset: boolean; fee_policy: string | null; evidence: Evidence[] };
export type Evidence = { source: string; href: string; observed_at: string; fetched_at: string; note: string; quality: 'onchain' | 'official_api' | 'indexed_context' | 'unavailable' };
export type PairObservation = { observation_id: string; pair_id: string; observed_at: string; fetched_at: string; mission_usd_price: number | null; stock_dex_usd_price: number | null; underlying_usd_price: number | null; underlying_observed_at: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; quote_inventory_raw: string | null; quote_inventory_share_equivalent: string | null; inventory_method: 'v4_position_reconstruction' | 'locked_position_accounting' | 'event_derived_position_accounting' | 'unavailable'; fresh: boolean; provenance: Evidence[]; immutable: true };
export type StockSupplyEvent = { event_id: string; asset_id: string; event_type: 'mint' | 'burn' | 'multiplier_change'; raw_token_amount: string | null; share_equivalent_amount: string | null; block: number | null; tx_hash: string | null; timestamp: string; before_supply_raw: string | null; after_supply_raw: string | null; provenance: Evidence };
export type ReflexivityEvent = { event_id: string; event_type: 'NEW_STOCK_PAIRED_MARKET' | 'QUOTE_ABSORPTION_MILESTONE' | 'STOCK_TOKEN_BASIS_EXCURSION' | 'STOCK_SUPPLY_MINT' | 'STOCK_SUPPLY_BURN' | 'SUPPLY_RESPONSE_AFTER_STRESS' | 'MISSION_ALPHA_BREAKOUT' | 'QUOTE_VOLUME_SHARE_MILESTONE' | 'D1_SURVIVAL' | 'D3_SURVIVAL' | 'D7_SURVIVAL'; subject_id: string; occurred_at: string; trigger_version: string; trigger: string; evidence_ids: string[] };
export type ThesisState = 'SUPPORTING' | 'MIXED' | 'AGAINST' | 'INSUFFICIENT_DATA';
export type ThesisEvidence = { hypothesis_id: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6'; state: ThesisState; rule_version: string; rationale: string; evidence_ids: string[]; observed_at: string };
export type ReflexiveSnapshot = { assets: CanonicalStockAsset[]; pairs: MissionPair[]; observations: PairObservation[]; supply_events: StockSupplyEvent[]; events: ReflexivityEvent[]; thesis: ThesisEvidence[]; refreshed_at: string; cursor: string | null };

export interface ReflexiveStore { readonly adapter: 'memory' | 'postgres'; readonly durable: boolean; load(): Promise<ReflexiveSnapshot>; save(snapshot: ReflexiveSnapshot): Promise<void>; }
const emptySnapshot = (): ReflexiveSnapshot => ({ assets: [], pairs: [], observations: [], supply_events: [], events: [], thesis: defaultThesis(), refreshed_at: new Date(0).toISOString(), cursor: null });
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
export type PairDiscoveryCandidate = { protocol: string; venue: string; pool_id: string; pool_address?: string | null; mission_contract: string; mission_symbol: string; quote_contract: string; launched_at: string; launch_block?: number | null; launch_id?: string; fee_policy?: string | null; evidence: Evidence[]; first_party_asset?: boolean };
export type ReflexiveProvider = { assets(): Promise<unknown>; discover?(assets: CanonicalStockAsset[], cursor: string | null): Promise<PairDiscoveryCandidate[]>; observations?(pairs: MissionPair[], assets: CanonicalStockAsset[]): Promise<PairObservation[]>; supplyEvents?(assets: CanonicalStockAsset[]): Promise<StockSupplyEvent[]> };

/** PAIR's index is discovery context. A candidate is emitted only after an independent
 * verifier accepts the V4 pool id/mission/quote relationship; API cards never qualify a pair. */
export class PairV5DiscoveryAdapter {
  constructor(private readonly options: { fetchImpl?: typeof fetch; baseUrl?: string; verifyPool: (input: { pool_id: string; mission_contract: string; quote_contract: string; launch_tx_hash: string | null }) => Promise<boolean>; now?: () => Date }) {}
  async discover(assets: CanonicalStockAsset[]): Promise<PairDiscoveryCandidate[]> {
    const fetched = (this.options.now ?? (() => new Date()))().toISOString(); const response = await (this.options.fetchImpl ?? fetch)(`${(this.options.baseUrl ?? 'https://pair.fund').replace(/\/$/, '')}/api/tokens`);
    if (!response.ok) throw new Error(`pair_tokens_http_${response.status}`); const body = await response.json() as { items?: unknown[] }; const items = Array.isArray(body.items) ? body.items : []; const output: PairDiscoveryCandidate[] = [];
    for (const item of items) { if (!isRecord(item)) continue; const mission = string(item.address); const symbol = string(item.symbol); const launchedAt = unixToIso(item.launchedAt); const launchTx = string(item.launchTxHash); const pairs = Array.isArray(item.pairs) ? item.pairs : [];
      if (!mission || !symbol || !launchedAt) continue;
      for (const pair of pairs) { if (!isRecord(pair) || string(pair.ammVersion) !== 'V4_MULTI') continue; const quote = isRecord(pair.quoteToken) ? string(pair.quoteToken.address) : null; const poolId = string(pair.poolId); if (!quote || !poolId || !isCanonicalStockContract(assets, quote)) continue;
        if (!await this.options.verifyPool({ pool_id: poolId, mission_contract: mission, quote_contract: quote, launch_tx_hash: launchTx })) continue;
        output.push({ protocol: 'uniswap-v4', venue: 'PAIR', pool_id: poolId, pool_address: null, mission_contract: mission, mission_symbol: symbol, quote_contract: quote, launched_at: launchedAt, launch_id: string(item.launchTxHash) ?? undefined, fee_policy: 'PAIR V5; fee semantics must be read from verified launch configuration.', evidence: [{ source: 'PAIR /api/tokens', href: 'https://pair.fund/api/tokens', observed_at: fetched, fetched_at: fetched, note: 'Discovery context reconciled through independent pool verifier.', quality: 'indexed_context' }, ...(launchTx ? [{ source: 'PAIR launch transaction', href: `https://robinhoodchain.blockscout.com/tx/${launchTx}`, observed_at: fetched, fetched_at: fetched, note: 'Launch transaction reference; pool identity is independently verified.', quality: 'onchain' as const }] : [])] });
      }
    }
    return output;
  }
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
    const snapshot: ReflexiveSnapshot = { assets, pairs, observations, supply_events: supplyEvents, events, thesis, refreshed_at: fetchedAt, cursor: prior.cursor };
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
function candidateToPair(candidate: PairDiscoveryCandidate, assets: CanonicalStockAsset[]): MissionPair | null { if (!isCanonicalStockContract(assets, candidate.quote_contract) || !isAddress(candidate.mission_contract) || !candidate.pool_id) return null; const asset = assets.find((item) => item.canonical_contract === normalizeBlockscoutAddress(candidate.quote_contract)); if (!asset) return null; const pool = candidate.pool_id.toLowerCase(); const launch = candidate.launch_id ?? stableId(candidate.protocol, pool, candidate.mission_contract, asset.canonical_contract, candidate.launched_at); return { pair_id: stableId(String(REFLEXIVE_CHAIN_ID), candidate.protocol, pool, candidate.mission_contract.toLowerCase(), asset.canonical_contract, candidate.venue, candidate.launched_at), launch_id: launch, chain_id: REFLEXIVE_CHAIN_ID, protocol: candidate.protocol, venue: candidate.venue, pool_id: pool, pool_address: candidate.pool_address ? normalizeBlockscoutAddress(candidate.pool_address) : null, mission_contract: normalizeBlockscoutAddress(candidate.mission_contract), mission_symbol: candidate.mission_symbol, stock_asset_id: asset.asset_id, quote_contract: asset.canonical_contract, launched_at: candidate.launched_at, launch_block: candidate.launch_block ?? null, canonicality: 'verified', first_party_asset: Boolean(candidate.first_party_asset), fee_policy: candidate.fee_policy ?? null, evidence: candidate.evidence }; }
function evaluateEvents(pairs: MissionPair[], observations: PairObservation[], supply: StockSupplyEvent[], prior: ReflexivityEvent[]) { const generated: ReflexivityEvent[] = []; for (const pair of pairs) { generated.push({ event_id: stableId('birth', pair.pair_id), event_type: 'NEW_STOCK_PAIRED_MARKET', subject_id: pair.pair_id, occurred_at: pair.launched_at, trigger_version: REFLEXIVE_METHOD_VERSION, trigger: 'verified canonical quote contract plus onchain-verifiable pool identity', evidence_ids: pair.evidence.map((item) => stableId(item.href, item.observed_at)) }); }
  for (const event of supply) generated.push({ event_id: stableId(event.event_type, event.event_id), event_type: event.event_type === 'mint' ? 'STOCK_SUPPLY_MINT' : event.event_type === 'burn' ? 'STOCK_SUPPLY_BURN' : 'SUPPLY_RESPONSE_AFTER_STRESS', subject_id: event.asset_id, occurred_at: event.timestamp, trigger_version: REFLEXIVE_METHOD_VERSION, trigger: `canonical Stock Token ${event.event_type} observation`, evidence_ids: [event.event_id] });
  return [...prior, ...generated].filter((item, index, list) => list.findIndex((other) => other.event_id === item.event_id) === index).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
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
