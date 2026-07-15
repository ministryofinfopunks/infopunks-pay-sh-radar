import type { RhChainLaunchContext } from '../data/rhChain';
import type { RhChainMetricScope } from '../data/rhChain';
import type pg from 'pg';
import { isRhChainIdentityContract } from './rhChainTruthGuards';
import { createRhChainSnapshotCache, type RhChainSnapshotCache } from './rhChainSnapshotCache';
export type RhChainSnapshotStatus = 'fresh' | 'stale' | 'unavailable' | 'disabled';
export type RhChainSnapshotFreshness = 'live_cached' | 'stale' | 'seeded' | 'manual' | 'unavailable';
export type RhChainProviderError = { code: 'provider_unavailable' | 'provider_timeout' | 'provider_http_error' | 'invalid_provider_payload' | 'invalid_source_timestamp' | 'provider_contract_mismatch' | 'provider_not_configured'; message: string };
export type RhChainCacheEntry<T> = { cache_key: string; value: T; fetched_at: string; expires_at: string; provider_name: string; status: RhChainSnapshotStatus; error_summary?: string };
export type RhChainProviderSnapshot = { provider_name: 'DefiLlama' | 'CoinGecko' | 'DexScreener' | 'Blockscout'; status: RhChainSnapshotStatus; fetched_at: string | null; expires_at: string | null; error_summary?: string; error?: RhChainProviderError };
export type RhChainProtocolMetric = {
  name: string;
  category: string;
  tvl_usd: number | null;
  value: number | 'source_required';
  scope: 'rh_chain' | 'global_or_unknown';
  metric_scope: RhChainMetricScope;
  display_note: string;
};
export type RhChainChainMetricsSnapshot = { tvl_usd: number | null; dex_volume_24h_usd: number | null; stablecoin_market_cap_usd: number | null; fees_24h_usd?: number | null; top_protocols?: RhChainProtocolMetric[]; protocol_count: number | null; source_timestamp: string | null; freshness: RhChainSnapshotFreshness };
export type RhChainMemeCategorySnapshot = { market_cap_usd: number | null; volume_24h_usd: number | null; top_assets: Array<{ name: string; symbol: string; market_cap_usd: number | null; volume_24h_usd: number | null }>; source_timestamp: string | null; freshness: RhChainSnapshotFreshness };
export type RhChainMemePairContext = { contract: string | null; chain_id: string | null; ticker: string; name: string; pair_address: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; source_timestamp: string | null };
export type RhChainTokenPairSnapshot = { contract: string; exact_contract_match: boolean; chain_match_status: 'chain_verified' | 'chain_unverified' | 'chain_mismatch'; pair_address: string | null; dex_url: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; fdv_usd: number | null; market_cap_usd: number | null; pair_created_at: string | null; source_timestamp: string | null; freshness: RhChainSnapshotFreshness };
export type RhChainExplorerSnapshot = { exact_contract_match: boolean; explorer_url: string | null; contract_exists: boolean | null; contract_verified: boolean | null; deployer_address: string | null; contract_type: string | null; availability: 'available' | 'unavailable'; source_timestamp: string | null; freshness: RhChainSnapshotFreshness };
export type RhChainLiveSnapshot = { title: 'RH Chain Live Snapshot'; generated_at: string; live_snapshots_enabled: boolean; judgment_policy: string; chain_metrics: RhChainChainMetricsSnapshot; meme_category: RhChainMemeCategorySnapshot; provider_statuses: RhChainProviderSnapshot[]; cache_status: RhChainSnapshotStatus; disclaimer: string };

export type RhChainLiveProviderClient = {
  chainMetrics(): Promise<Omit<RhChainChainMetricsSnapshot, 'freshness'>>;
  memeCategory(): Promise<Omit<RhChainMemeCategorySnapshot, 'freshness'>>;
  memePairs(): Promise<RhChainMemePairContext[]>;
  tokenPair(contract: string): Promise<Omit<RhChainTokenPairSnapshot, 'contract' | 'freshness' | 'exact_contract_match' | 'chain_match_status'> & { observed_contract?: string | null; observed_chain_id?: string | null }>;
  explorer(contract: string): Promise<Omit<RhChainExplorerSnapshot, 'freshness' | 'exact_contract_match' | 'availability' | 'contract_exists' | 'contract_type'> & Partial<Pick<RhChainExplorerSnapshot, 'contract_exists' | 'contract_type'>> & { observed_contract?: string | null }>;
};
export type RhChainLiveSnapshotOptions = { enabled: boolean; timeoutMs: number; ttlSeconds?: number | null; blockscoutUrl?: string | null; databaseUrl?: string | null; databasePool?: pg.Pool | null; cache?: RhChainSnapshotCache; now?: () => Date; providers?: Partial<RhChainLiveProviderClient> };

const DISCLAIMER = 'Live Snapshot data is external, cached, and informational. It is not an endorsement, listing, partnership, trading signal, or financial recommendation.';
const JUDGMENT_POLICY = 'External data gives context. Infopunks gives judgment. Receipts create memory. Live data never overrides human-reviewed receipts, manual verdicts, review states, or index decisions.';
const providerNames: RhChainProviderSnapshot['provider_name'][] = ['DefiLlama', 'CoinGecko', 'DexScreener', 'Blockscout'];
const emptyMetrics = (): RhChainChainMetricsSnapshot => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, fees_24h_usd: null, top_protocols: [], protocol_count: null, source_timestamp: null, freshness: 'unavailable' });
const emptyCategory = (): RhChainMemeCategorySnapshot => ({ market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null, freshness: 'unavailable' });

export function normalizeRhChainContract(value: string): string { return value.trim().toLowerCase(); }
/** Provider identifiers are context only unless this returns true. */
export function isExactRhChainContractMatch(requested: string, observed: string | null | undefined): boolean { return Boolean(observed && normalizeRhChainContract(requested) === normalizeRhChainContract(observed)); }
export function validateRhChainSourceTimestamp(value: string | null | undefined, now = new Date()): string | null {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) || timestamp.getTime() > now.getTime() + 60_000 ? null : timestamp.toISOString();
}
export function normalizeRhChainProviderError(error: unknown): RhChainProviderError {
  const message = error instanceof Error ? error.message.slice(0, 160) : 'provider_unavailable';
  const code: RhChainProviderError['code'] = /timeout|abort/i.test(message) ? 'provider_timeout' : /http_\d+/.test(message) ? 'provider_http_error' : /timestamp/.test(message) ? 'invalid_source_timestamp' : /contract.*mismatch|pair_not_found/.test(message) ? 'provider_contract_mismatch' : /not_configured/.test(message) ? 'provider_not_configured' : 'provider_unavailable';
  return { code, message };
}

export class RhChainLiveSnapshotService {
  private readonly cache: RhChainSnapshotCache;
  private readonly now: () => Date;
  private readonly clients: RhChainLiveProviderClient;
  constructor(private readonly options: RhChainLiveSnapshotOptions) {
    this.now = options.now ?? (() => new Date());
    this.cache = options.cache ?? createRhChainSnapshotCache(options.databaseUrl, options.databasePool);
    this.clients = { ...createPublicClients(options), ...options.providers };
  }

  async getLiveSnapshot(): Promise<RhChainLiveSnapshot> {
    if (!this.options.enabled) return this.disabledSnapshot();
    const [metrics, category] = await Promise.all([this.cached('defillama:chain-metrics', 'DefiLlama', this.ttl(300), () => this.clients.chainMetrics()), this.cached('coingecko:meme-category', 'CoinGecko', this.ttl(300), () => this.clients.memeCategory())]);
    return { title: 'RH Chain Live Snapshot', generated_at: this.now().toISOString(), live_snapshots_enabled: true, judgment_policy: JUDGMENT_POLICY,
      chain_metrics: metrics.value ? normalizeRhChainChainMetrics(metrics.value, metrics.status, this.now()) : emptyMetrics(),
      meme_category: category.value ? normalizeRhChainMemeCategory(category.value, category.status, this.now()) : emptyCategory(),
      provider_statuses: [this.providerStatus('DefiLlama', metrics), this.providerStatus('CoinGecko', category), this.idleProvider('DexScreener'), this.idleProvider('Blockscout')],
      cache_status: metrics.status === 'fresh' || category.status === 'fresh' ? 'fresh' : metrics.status === 'stale' || category.status === 'stale' ? 'stale' : 'unavailable', disclaimer: DISCLAIMER };
  }

  async getTokenSnapshot(contract: string) {
    if (!isRhChainIdentityContract(contract)) return { contract, token_pair: null, explorer: null, provider_statuses: providerNames.map((name) => this.idleProvider(name)), cache_status: 'unavailable' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: this.options.enabled, source_required: true, judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER };
    if (!this.options.enabled) return { contract, token_pair: null, explorer: null, provider_statuses: providerNames.map((name) => this.disabledProvider(name)), cache_status: 'disabled' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: false, judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER };
    const [pair, explorer] = await Promise.all([this.cached(`dexscreener:token:${contract.toLowerCase()}`, 'DexScreener', this.ttl(120), () => this.clients.tokenPair(contract)), this.cached(`blockscout:token:${contract.toLowerCase()}`, 'Blockscout', this.ttl(600), () => this.clients.explorer(contract))]);
    const normalizedPair = pair.value ? normalizeRhChainTokenPair(contract, pair.value, pair.status, this.now()) : null;
    // A provider that explicitly names another network is not RH Chain context at all.
    const tokenPair = normalizedPair?.chain_match_status === 'chain_mismatch' ? null : normalizedPair;
    const explorerValue = explorer.value ? normalizeRhChainExplorer(contract, explorer.value, explorer.status, this.now()) : null;
    return { contract, token_pair: tokenPair, explorer: explorerValue, launch_context: inferLaunchContext(tokenPair, explorerValue),
      provider_statuses: [this.idleProvider('DefiLlama'), this.idleProvider('CoinGecko'), this.providerStatus('DexScreener', pair), this.providerStatus('Blockscout', explorer)], cache_status: pair.status === 'fresh' || explorer.status === 'fresh' ? 'fresh' as const : pair.status === 'stale' || explorer.status === 'stale' ? 'stale' as const : 'unavailable' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: true, judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER };
  }

  async getMemePairContext() {
    if (!this.options.enabled) return { pairs: [] as RhChainMemePairContext[], provider_status: this.disabledProvider('DexScreener'), cache_status: 'disabled' as const, generated_at: this.now().toISOString() };
    const result = await this.cached('dexscreener:rh-chain-meme-pairs', 'DexScreener', this.ttl(120), () => this.clients.memePairs());
    return { pairs: result.value ?? [], provider_status: this.providerStatus('DexScreener', result), cache_status: result.status, generated_at: this.now().toISOString() };
  }

  private ttl(defaultSeconds: number) { return (this.options.ttlSeconds ?? defaultSeconds) * 1000; }
  private async cached<T>(key: string, provider: RhChainProviderSnapshot['provider_name'], ttlMs: number, load: () => Promise<T>): Promise<{ value: T | null; status: RhChainSnapshotStatus; entry: RhChainCacheEntry<T> | null; error_summary?: string }> {
    // Cache durability is an optimization boundary; an unavailable DB must not make a read-only provider request fail.
    let existing: RhChainCacheEntry<T> | null = null;
    try { existing = await this.cache.get<T>(key); } catch { existing = null; }
    const now = this.now().getTime();
    if (existing && new Date(existing.expires_at).getTime() > now) return { value: existing.value, status: 'fresh', entry: existing };
    try {
      const value = await load(); const fetched = this.now();
      const entry: RhChainCacheEntry<T> = { cache_key: key, value, fetched_at: fetched.toISOString(), expires_at: new Date(fetched.getTime() + ttlMs).toISOString(), provider_name: provider, status: 'fresh' };
      try { await this.cache.set(key, entry, ttlMs); } catch { /* provider context remains available without a durable cache */ }
      return { value, status: 'fresh', entry };
    } catch (error) {
      const providerError = normalizeRhChainProviderError(error);
      if (existing) return { value: existing.value, status: 'stale', entry: { ...existing, status: 'stale', error_summary: providerError.message }, error_summary: providerError.message };
      return { value: null, status: 'unavailable', entry: null, error_summary: providerError.message };
    }
  }
  private providerStatus(name: RhChainProviderSnapshot['provider_name'], result: { status: RhChainSnapshotStatus; entry: RhChainCacheEntry<unknown> | null; error_summary?: string }) { const summary = result.entry?.error_summary ?? result.error_summary; return { provider_name: name, status: result.status, fetched_at: result.entry?.fetched_at ?? null, expires_at: result.entry?.expires_at ?? null, ...(summary ? { error_summary: summary, error: normalizeRhChainProviderError(new Error(summary)) } : {}) }; }
  private idleProvider(name: RhChainProviderSnapshot['provider_name']): RhChainProviderSnapshot { return { provider_name: name, status: 'unavailable', fetched_at: null, expires_at: null, error_summary: 'No snapshot requested for this provider.' }; }
  private disabledProvider(name: RhChainProviderSnapshot['provider_name']): RhChainProviderSnapshot { return { provider_name: name, status: 'disabled', fetched_at: null, expires_at: null, error_summary: 'Live snapshots are disabled.' }; }
  private disabledSnapshot(): RhChainLiveSnapshot { return { title: 'RH Chain Live Snapshot', generated_at: this.now().toISOString(), live_snapshots_enabled: false, judgment_policy: JUDGMENT_POLICY, chain_metrics: { ...emptyMetrics(), freshness: 'seeded' }, meme_category: { ...emptyCategory(), freshness: 'seeded' }, provider_statuses: providerNames.map((name) => this.disabledProvider(name)), cache_status: 'disabled', disclaimer: DISCLAIMER }; }
}

function snapshotFreshness(status: RhChainSnapshotStatus): RhChainSnapshotFreshness { return status === 'fresh' ? 'live_cached' : status === 'stale' ? 'stale' : 'unavailable'; }
function finiteNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
export function normalizeRhChainChainMetrics(value: Omit<RhChainChainMetricsSnapshot, 'freshness'>, status: RhChainSnapshotStatus, now: Date): RhChainChainMetricsSnapshot {
  return { tvl_usd: finiteNumber(value.tvl_usd), dex_volume_24h_usd: finiteNumber(value.dex_volume_24h_usd), stablecoin_market_cap_usd: finiteNumber(value.stablecoin_market_cap_usd), fees_24h_usd: finiteNumber(value.fees_24h_usd), top_protocols: (value.top_protocols ?? []).map(normalizeRhChainProtocolMetric).filter((protocol) => protocol.name), protocol_count: finiteNumber(value.protocol_count), source_timestamp: validateRhChainSourceTimestamp(value.source_timestamp, now), freshness: snapshotFreshness(status) };
}

function normalizeRhChainProtocolMetric(protocol: Partial<RhChainProtocolMetric>): RhChainProtocolMetric {
  const explicitlyRhChain = protocol.scope === 'rh_chain' && protocol.metric_scope === 'rh_chain';
  const scopedValue = explicitlyRhChain ? finiteNumber(protocol.value === 'source_required' ? null : protocol.value) ?? finiteNumber(protocol.tvl_usd) : null;
  if (scopedValue !== null) return { name: String(protocol.name ?? ''), category: String(protocol.category ?? 'protocol'), tvl_usd: scopedValue, value: scopedValue, scope: 'rh_chain', metric_scope: 'rh_chain', display_note: protocol.display_note || 'Provider explicitly scoped this protocol TVL to Robinhood Chain.' };
  return { name: String(protocol.name ?? ''), category: String(protocol.category ?? 'protocol'), tvl_usd: null, value: 'source_required', scope: 'global_or_unknown', metric_scope: 'source_required', display_note: 'Chain-specific protocol TVL not verified.' };
}
export function normalizeRhChainMemeCategory(value: Omit<RhChainMemeCategorySnapshot, 'freshness'>, status: RhChainSnapshotStatus, now: Date): RhChainMemeCategorySnapshot {
  return { market_cap_usd: finiteNumber(value.market_cap_usd), volume_24h_usd: finiteNumber(value.volume_24h_usd), top_assets: value.top_assets.map((asset) => ({ name: String(asset.name ?? ''), symbol: String(asset.symbol ?? '').toUpperCase(), market_cap_usd: finiteNumber(asset.market_cap_usd), volume_24h_usd: finiteNumber(asset.volume_24h_usd) })).filter((asset) => asset.name && asset.symbol), source_timestamp: validateRhChainSourceTimestamp(value.source_timestamp, now), freshness: snapshotFreshness(status) };
}
export function normalizeRhChainTokenPair(contract: string, value: Awaited<ReturnType<RhChainLiveProviderClient['tokenPair']>>, status: RhChainSnapshotStatus, now: Date): RhChainTokenPairSnapshot {
  return { contract, exact_contract_match: isExactRhChainContractMatch(contract, value.observed_contract), chain_match_status: rhChainDexChainStatus(value.observed_chain_id), pair_address: value.pair_address ?? null, dex_url: value.dex_url ?? null, liquidity_usd: finiteNumber(value.liquidity_usd), volume_24h_usd: finiteNumber(value.volume_24h_usd), fdv_usd: finiteNumber(value.fdv_usd), market_cap_usd: finiteNumber(value.market_cap_usd), pair_created_at: validateRhChainSourceTimestamp(value.pair_created_at, now), source_timestamp: validateRhChainSourceTimestamp(value.source_timestamp, now), freshness: snapshotFreshness(status) };
}
export function normalizeRhChainExplorer(contract: string, value: Awaited<ReturnType<RhChainLiveProviderClient['explorer']>>, status: RhChainSnapshotStatus, now: Date): RhChainExplorerSnapshot {
  return { exact_contract_match: isExactRhChainContractMatch(contract, value.observed_contract), explorer_url: value.explorer_url ?? null, contract_exists: value.contract_exists ?? null, contract_verified: value.contract_verified ?? null, deployer_address: value.deployer_address ?? null, contract_type: value.contract_type ?? null, availability: 'available', source_timestamp: validateRhChainSourceTimestamp(value.source_timestamp, now), freshness: snapshotFreshness(status) };
}

export function rhChainDexChainStatus(chainId: string | null | undefined): RhChainTokenPairSnapshot['chain_match_status'] {
  if (!chainId?.trim()) return 'chain_unverified';
  return /^(robinhood|rhchain|rh-chain|rhc)$/i.test(chainId.trim()) ? 'chain_verified' : 'chain_mismatch';
}

function inferLaunchContext(pair: RhChainTokenPairSnapshot | null, explorer: RhChainExplorerSnapshot | null): RhChainLaunchContext | undefined {
  if (!pair && !explorer) return undefined;
  const observed_at = pair?.source_timestamp ?? explorer?.source_timestamp ?? new Date().toISOString();
  const pairIdentityMatch = pair?.exact_contract_match && pair.chain_match_status === 'chain_verified';
  return { launch_source: 'unknown_manual', launch_source_type: 'unknown_manual', launch_surface_url: pairIdentityMatch ? pair.dex_url : null, contract_verified: explorer?.exact_contract_match ? explorer.contract_verified ?? 'unknown' : 'unknown', liquidity_route: pairIdentityMatch && pair?.dex_url ? 'provider-observed DEX route' : null, pair_address: pairIdentityMatch ? pair?.pair_address ?? null : null, lp_status: 'unknown', deployer_address: explorer?.exact_contract_match ? explorer.deployer_address : null, creator_address: null, deployer_observed_at: explorer?.exact_contract_match && explorer.deployer_address ? observed_at : null, source_notes: 'Provider context is not identity proof unless the provider returned the exact requested contract and DexScreener chain match. Launch surface remains unknown without a human-reviewed receipt.', evidence_links: [], confidence_level: 'low', data_mode: 'cached', observed_at, updated_at: observed_at };
}

function createPublicClients(options: RhChainLiveSnapshotOptions): RhChainLiveProviderClient {
  const request = async <T>(url: string) => requestJson<T>(url, options.timeoutMs);
  return {
    async chainMetrics() {
      const [chains, stablecoins, fees, protocols] = await Promise.all([
        request<Array<{ name?: string; tvl?: number; gecko_id?: string }>>('https://api.llama.fi/v2/chains'),
        request<{ peggedAssets?: Array<{ chainCirculating?: Record<string, unknown> }> }>('https://stablecoins.llama.fi/stablecoins?includePrices=true').catch(() => null),
        request<{ total24h?: number }>('https://api.llama.fi/overview/fees/Robinhood?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true').catch(() => null),
        request<Array<{ name?: string; category?: string; tvl?: number; chainTvls?: Record<string, number> }>>('https://api.llama.fi/protocols').catch(() => null)
      ]);
      const chain = chains.find((row) => /robinhood/i.test(row.name ?? ''));
      const stablecoin_market_cap_usd = stablecoins?.peggedAssets?.reduce((total, asset) => total + stablecoinValueForRobinhood(asset.chainCirculating), 0) ?? null;
      const top_protocols = (protocols ?? []).map((protocol) => {
        const chainEntry = Object.entries(protocol.chainTvls ?? {}).find(([name]) => /^(robinhood|robinhood chain)$/i.test(name.trim()));
        const chainTvl = finiteNumber(chainEntry?.[1]);
        return chainTvl === null ? null : { name: protocol.name ?? 'Unnamed protocol', category: protocol.category ?? 'protocol', tvl_usd: chainTvl, value: chainTvl, scope: 'rh_chain' as const, metric_scope: 'rh_chain' as const, display_note: 'Provider explicitly scoped this protocol TVL to Robinhood Chain.' };
      }).filter((protocol): protocol is NonNullable<typeof protocol> => protocol !== null).sort((left, right) => right.value - left.value).slice(0, 5);
      // These endpoints do not provide a reliable chain-level observation timestamp.
      // Keep it null so the pulse labels the fetch timestamp rather than inventing one.
      return { tvl_usd: finiteNumber(chain?.tvl), dex_volume_24h_usd: null, stablecoin_market_cap_usd: stablecoin_market_cap_usd && stablecoin_market_cap_usd > 0 ? stablecoin_market_cap_usd : null, fees_24h_usd: finiteNumber(fees?.total24h), top_protocols, protocol_count: top_protocols.length || null, source_timestamp: null };
    },
    async memeCategory() { const assets = await request<Array<{ name: string; symbol: string; market_cap?: number; total_volume?: number; last_updated?: string }>>('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=memes&order=market_cap_desc&per_page=10&page=1'); return { market_cap_usd: assets.reduce((sum, asset) => sum + (asset.market_cap ?? 0), 0), volume_24h_usd: assets.reduce((sum, asset) => sum + (asset.total_volume ?? 0), 0), top_assets: assets.map((asset) => ({ name: asset.name, symbol: asset.symbol.toUpperCase(), market_cap_usd: asset.market_cap ?? null, volume_24h_usd: asset.total_volume ?? null })), source_timestamp: assets[0]?.last_updated ?? new Date().toISOString() }; },
    async memePairs() {
      const pairs = await request<Array<{ chainId?: string; pairAddress?: string; baseToken?: { address?: string; symbol?: string; name?: string }; liquidity?: { usd?: number }; volume?: { h24?: number } }>>('https://api.dexscreener.com/latest/dex/search?q=robinhood');
      return pairs.filter((pair) => /^(robinhood|rhchain|rh-chain|rhc)$/i.test(pair.chainId ?? '')).slice(0, 10).map((pair) => ({ contract: pair.baseToken?.address ?? null, chain_id: pair.chainId ?? null, ticker: pair.baseToken?.symbol?.toUpperCase() ?? 'UNKNOWN', name: pair.baseToken?.name ?? pair.baseToken?.symbol ?? 'Unknown asset', pair_address: pair.pairAddress ?? null, liquidity_usd: finiteNumber(pair.liquidity?.usd), volume_24h_usd: finiteNumber(pair.volume?.h24), source_timestamp: null }));
    },
    async tokenPair(contract) { const pairs = await request<Array<{ chainId?: string; pairAddress?: string; url?: string; baseToken?: { address?: string }; quoteToken?: { address?: string }; liquidity?: { usd?: number }; volume?: { h24?: number }; fdv?: number; marketCap?: number; pairCreatedAt?: number }>>(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(contract)}`); const pair = pairs.find((item) => isExactRhChainContractMatch(contract, item.baseToken?.address) || isExactRhChainContractMatch(contract, item.quoteToken?.address)); if (!pair) throw new Error('provider_contract_mismatch'); const observed_contract = isExactRhChainContractMatch(contract, pair.baseToken?.address) ? pair.baseToken?.address : pair.quoteToken?.address; return { observed_contract, observed_chain_id: pair.chainId ?? null, pair_address: pair.pairAddress ?? null, dex_url: pair.url ?? null, liquidity_usd: pair.liquidity?.usd ?? null, volume_24h_usd: pair.volume?.h24 ?? null, fdv_usd: pair.fdv ?? null, market_cap_usd: pair.marketCap ?? null, pair_created_at: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null, source_timestamp: new Date().toISOString() }; },
    async explorer(contract) { if (!options.blockscoutUrl) throw new Error('blockscout_endpoint_not_configured'); const base = options.blockscoutUrl.replace(/\/$/, ''); const explorer_url = `${base}/address/${encodeURIComponent(contract)}`; const payload = await request<{ address?: string; is_contract?: boolean; is_verified?: boolean; creator_address?: { hash?: string } | string; smart_contract?: { is_verified?: boolean; contract_type?: string } }>(`${base}/api/v2/addresses/${encodeURIComponent(contract)}`); const creator = typeof payload.creator_address === 'string' ? payload.creator_address : payload.creator_address?.hash ?? null; return { observed_contract: payload.address ?? null, explorer_url, contract_exists: true, contract_verified: payload.smart_contract?.is_verified ?? payload.is_verified ?? null, deployer_address: creator, contract_type: payload.smart_contract?.contract_type ?? (payload.is_contract ? 'contract' : null), source_timestamp: new Date().toISOString() }; }
  };
}
function stablecoinValueForRobinhood(chainCirculating: Record<string, unknown> | undefined) {
  if (!chainCirculating) return 0;
  const match = Object.entries(chainCirculating).find(([chain]) => /robinhood/i.test(chain))?.[1];
  if (typeof match === 'number') return match;
  if (match && typeof match === 'object' && 'current' in match && typeof (match as { current?: unknown }).current === 'number') return (match as { current: number }).current;
  return 0;
}
async function requestJson<T>(url: string, timeoutMs: number): Promise<T> { const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) }); if (!response.ok) throw new Error(`provider_http_${response.status}`); const payload = await response.json() as T | { pairs?: T }; return (payload && typeof payload === 'object' && 'pairs' in payload ? payload.pairs : payload) as T; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 160) : 'provider_unavailable'; }
