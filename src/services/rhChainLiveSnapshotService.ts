import type { RhChainLaunchContext } from '../data/rhChain';
export type RhChainSnapshotStatus = 'fresh' | 'stale' | 'unavailable' | 'disabled';
export type RhChainSnapshotFreshness = 'live_cached' | 'seeded' | 'manual' | 'unavailable';
export type RhChainProviderError = { code: string; message: string };
export type RhChainCacheEntry<T> = { cache_key: string; value: T; fetched_at: string; expires_at: string; provider_name: string; status: RhChainSnapshotStatus; error_summary?: string };
export type RhChainProviderSnapshot = { provider_name: 'DefiLlama' | 'CoinGecko' | 'DexScreener' | 'Blockscout'; status: RhChainSnapshotStatus; fetched_at: string | null; expires_at: string | null; error_summary?: string };
export type RhChainChainMetricsSnapshot = { tvl_usd: number | null; dex_volume_24h_usd: number | null; stablecoin_market_cap_usd: number | null; protocol_count: number | null; source_timestamp: string | null; freshness: RhChainSnapshotFreshness };
export type RhChainMemeCategorySnapshot = { market_cap_usd: number | null; volume_24h_usd: number | null; top_assets: Array<{ name: string; symbol: string; market_cap_usd: number | null; volume_24h_usd: number | null }>; source_timestamp: string | null; freshness: RhChainSnapshotFreshness };
export type RhChainTokenPairSnapshot = { contract: string; pair_address: string | null; dex_url: string | null; liquidity_usd: number | null; volume_24h_usd: number | null; fdv_usd: number | null; market_cap_usd: number | null; pair_created_at: string | null; source_timestamp: string | null; freshness: RhChainSnapshotFreshness };
export type RhChainExplorerSnapshot = { explorer_url: string | null; contract_verified: boolean | null; deployer_address: string | null; source_timestamp: string | null; freshness: RhChainSnapshotFreshness };
export type RhChainLiveSnapshot = { title: 'RH Chain Live Snapshot'; generated_at: string; live_snapshots_enabled: boolean; judgment_policy: string; chain_metrics: RhChainChainMetricsSnapshot; meme_category: RhChainMemeCategorySnapshot; provider_statuses: RhChainProviderSnapshot[]; cache_status: RhChainSnapshotStatus; disclaimer: string };

export type RhChainLiveProviderClient = {
  chainMetrics(): Promise<Omit<RhChainChainMetricsSnapshot, 'freshness'>>;
  memeCategory(): Promise<Omit<RhChainMemeCategorySnapshot, 'freshness'>>;
  tokenPair(contract: string): Promise<Omit<RhChainTokenPairSnapshot, 'contract' | 'freshness'>>;
  explorer(contract: string): Promise<Omit<RhChainExplorerSnapshot, 'freshness'>>;
};
export type RhChainLiveSnapshotOptions = { enabled: boolean; timeoutMs: number; ttlSeconds?: number | null; blockscoutUrl?: string | null; now?: () => Date; providers?: Partial<RhChainLiveProviderClient> };

const DISCLAIMER = 'Live Snapshot data is external, cached, and informational. It is not an endorsement, listing, partnership, trading signal, or financial recommendation.';
const JUDGMENT_POLICY = 'External data gives context. Infopunks gives judgment. Receipts create memory. Live data never overrides human-reviewed receipts, manual verdicts, review states, or index decisions.';
const providerNames: RhChainProviderSnapshot['provider_name'][] = ['DefiLlama', 'CoinGecko', 'DexScreener', 'Blockscout'];
const emptyMetrics = (): RhChainChainMetricsSnapshot => ({ tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null, freshness: 'unavailable' });
const emptyCategory = (): RhChainMemeCategorySnapshot => ({ market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null, freshness: 'unavailable' });

export class RhChainLiveSnapshotService {
  private cache = new Map<string, RhChainCacheEntry<unknown>>();
  private readonly now: () => Date;
  private readonly clients: RhChainLiveProviderClient;
  constructor(private readonly options: RhChainLiveSnapshotOptions) {
    this.now = options.now ?? (() => new Date());
    this.clients = { ...createPublicClients(options), ...options.providers };
  }

  async getLiveSnapshot(): Promise<RhChainLiveSnapshot> {
    if (!this.options.enabled) return this.disabledSnapshot();
    const [metrics, category] = await Promise.all([this.cached('defillama:chain-metrics', 'DefiLlama', this.ttl(300), () => this.clients.chainMetrics()), this.cached('coingecko:meme-category', 'CoinGecko', this.ttl(300), () => this.clients.memeCategory())]);
    return { title: 'RH Chain Live Snapshot', generated_at: this.now().toISOString(), live_snapshots_enabled: true, judgment_policy: JUDGMENT_POLICY,
      chain_metrics: metrics.value ? { ...metrics.value, freshness: metrics.status === 'fresh' ? 'live_cached' : 'unavailable' } : emptyMetrics(),
      meme_category: category.value ? { ...category.value, freshness: category.status === 'fresh' ? 'live_cached' : 'unavailable' } : emptyCategory(),
      provider_statuses: [this.providerStatus('DefiLlama', metrics), this.providerStatus('CoinGecko', category), this.idleProvider('DexScreener'), this.idleProvider('Blockscout')],
      cache_status: metrics.status === 'fresh' || category.status === 'fresh' ? 'fresh' : 'unavailable', disclaimer: DISCLAIMER };
  }

  async getTokenSnapshot(contract: string) {
    if (!this.options.enabled) return { contract, token_pair: null, explorer: null, provider_statuses: providerNames.map((name) => this.disabledProvider(name)), cache_status: 'disabled' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: false, judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER };
    const [pair, explorer] = await Promise.all([this.cached(`dexscreener:token:${contract.toLowerCase()}`, 'DexScreener', this.ttl(120), () => this.clients.tokenPair(contract)), this.cached(`blockscout:token:${contract.toLowerCase()}`, 'Blockscout', this.ttl(600), () => this.clients.explorer(contract))]);
    const tokenPair = pair.value ? { contract, ...pair.value, freshness: pair.status === 'fresh' ? 'live_cached' as const : 'unavailable' as const } : null;
    const explorerValue = explorer.value ? { ...explorer.value, freshness: explorer.status === 'fresh' ? 'live_cached' as const : 'unavailable' as const } : null;
    return { contract, token_pair: tokenPair, explorer: explorerValue, launch_context: inferLaunchContext(tokenPair, explorerValue),
      provider_statuses: [this.idleProvider('DefiLlama'), this.idleProvider('CoinGecko'), this.providerStatus('DexScreener', pair), this.providerStatus('Blockscout', explorer)], cache_status: pair.status === 'fresh' || explorer.status === 'fresh' ? 'fresh' as const : 'unavailable' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: true, judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER };
  }

  private ttl(defaultSeconds: number) { return (this.options.ttlSeconds ?? defaultSeconds) * 1000; }
  private async cached<T>(key: string, provider: RhChainProviderSnapshot['provider_name'], ttlMs: number, load: () => Promise<T>): Promise<{ value: T | null; status: RhChainSnapshotStatus; entry: RhChainCacheEntry<T> | null; error_summary?: string }> {
    const existing = this.cache.get(key) as RhChainCacheEntry<T> | undefined;
    const now = this.now().getTime();
    if (existing && new Date(existing.expires_at).getTime() > now) return { value: existing.value, status: 'fresh', entry: existing };
    try {
      const value = await load(); const fetched = this.now();
      const entry: RhChainCacheEntry<T> = { cache_key: key, value, fetched_at: fetched.toISOString(), expires_at: new Date(fetched.getTime() + ttlMs).toISOString(), provider_name: provider, status: 'fresh' };
      this.cache.set(key, entry); return { value, status: 'fresh', entry };
    } catch (error) {
      if (existing) return { value: existing.value, status: 'stale', entry: { ...existing, status: 'stale', error_summary: errorMessage(error) }, error_summary: errorMessage(error) };
      return { value: null, status: 'unavailable', entry: null, error_summary: errorMessage(error) };
    }
  }
  private providerStatus(name: RhChainProviderSnapshot['provider_name'], result: { status: RhChainSnapshotStatus; entry: RhChainCacheEntry<unknown> | null; error_summary?: string }) { return { provider_name: name, status: result.status, fetched_at: result.entry?.fetched_at ?? null, expires_at: result.entry?.expires_at ?? null, error_summary: result.entry?.error_summary ?? result.error_summary }; }
  private idleProvider(name: RhChainProviderSnapshot['provider_name']): RhChainProviderSnapshot { return { provider_name: name, status: 'unavailable', fetched_at: null, expires_at: null, error_summary: 'No snapshot requested for this provider.' }; }
  private disabledProvider(name: RhChainProviderSnapshot['provider_name']): RhChainProviderSnapshot { return { provider_name: name, status: 'disabled', fetched_at: null, expires_at: null, error_summary: 'Live snapshots are disabled.' }; }
  private disabledSnapshot(): RhChainLiveSnapshot { return { title: 'RH Chain Live Snapshot', generated_at: this.now().toISOString(), live_snapshots_enabled: false, judgment_policy: JUDGMENT_POLICY, chain_metrics: { ...emptyMetrics(), freshness: 'seeded' }, meme_category: { ...emptyCategory(), freshness: 'seeded' }, provider_statuses: providerNames.map((name) => this.disabledProvider(name)), cache_status: 'disabled', disclaimer: DISCLAIMER }; }
}

function inferLaunchContext(pair: RhChainTokenPairSnapshot | null, explorer: RhChainExplorerSnapshot | null): RhChainLaunchContext | undefined {
  if (!pair && !explorer) return undefined;
  const observed_at = pair?.source_timestamp ?? explorer?.source_timestamp ?? new Date().toISOString();
  return { launch_source: 'unknown_manual', launch_source_type: 'unknown_manual', launch_surface_url: pair?.dex_url ?? null, contract_verified: explorer?.contract_verified ?? 'unknown', liquidity_route: pair?.dex_url ? 'provider-observed DEX route' : null, pair_address: pair?.pair_address ?? null, lp_status: 'unknown', deployer_address: explorer?.deployer_address ?? null, creator_address: null, deployer_observed_at: explorer?.deployer_address ? observed_at : null, source_notes: 'Provider-observed pair/explorer context only. Launch surface remains unknown without a human-reviewed receipt.', evidence_links: [], confidence_level: 'low', data_mode: 'cached', observed_at, updated_at: observed_at };
}

function createPublicClients(options: RhChainLiveSnapshotOptions): RhChainLiveProviderClient {
  const request = async <T>(url: string) => requestJson<T>(url, options.timeoutMs);
  return {
    async chainMetrics() { const chains = await request<Array<{ name?: string; tvl?: number; gecko_id?: string }>>('https://api.llama.fi/v2/chains'); const chain = chains.find((row) => /robinhood/i.test(row.name ?? '')); return { tvl_usd: chain?.tvl ?? null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: new Date().toISOString() }; },
    async memeCategory() { const assets = await request<Array<{ name: string; symbol: string; market_cap?: number; total_volume?: number; last_updated?: string }>>('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=memes&order=market_cap_desc&per_page=10&page=1'); return { market_cap_usd: assets.reduce((sum, asset) => sum + (asset.market_cap ?? 0), 0), volume_24h_usd: assets.reduce((sum, asset) => sum + (asset.total_volume ?? 0), 0), top_assets: assets.map((asset) => ({ name: asset.name, symbol: asset.symbol.toUpperCase(), market_cap_usd: asset.market_cap ?? null, volume_24h_usd: asset.total_volume ?? null })), source_timestamp: assets[0]?.last_updated ?? new Date().toISOString() }; },
    async tokenPair(contract) { const pairs = await request<Array<{ pairAddress?: string; url?: string; liquidity?: { usd?: number }; volume?: { h24?: number }; fdv?: number; marketCap?: number; pairCreatedAt?: number }>>(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(contract)}`); const pair = pairs[0]; if (!pair) throw new Error('token_pair_not_found'); return { pair_address: pair.pairAddress ?? null, dex_url: pair.url ?? null, liquidity_usd: pair.liquidity?.usd ?? null, volume_24h_usd: pair.volume?.h24 ?? null, fdv_usd: pair.fdv ?? null, market_cap_usd: pair.marketCap ?? null, pair_created_at: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null, source_timestamp: new Date().toISOString() }; },
    async explorer(contract) { if (!options.blockscoutUrl) throw new Error('blockscout_endpoint_not_configured'); return { explorer_url: `${options.blockscoutUrl.replace(/\/$/, '')}/address/${encodeURIComponent(contract)}`, contract_verified: null, deployer_address: null, source_timestamp: new Date().toISOString() }; }
  };
}
async function requestJson<T>(url: string, timeoutMs: number): Promise<T> { const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) }); if (!response.ok) throw new Error(`provider_http_${response.status}`); const payload = await response.json() as T | { pairs?: T }; return (payload && typeof payload === 'object' && 'pairs' in payload ? payload.pairs : payload) as T; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 160) : 'provider_unavailable'; }
