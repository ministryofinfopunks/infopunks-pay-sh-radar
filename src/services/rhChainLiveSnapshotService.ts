import type { RhChainLaunchContext } from '../data/rhChain';
import type { RhChainMetricScope } from '../data/rhChain';
import type pg from 'pg';
import { z } from 'zod';
import { isRhChainIdentityContract } from './rhChainTruthGuards';
import { createRhChainSnapshotCache, type RhChainSnapshotCache } from './rhChainSnapshotCache';
import { createRequestDeadline, runWithinDeadline, type RequestDeadline } from './requestDeadline';
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
  chainMetrics(context?: RhChainProviderRequestContext): Promise<Omit<RhChainChainMetricsSnapshot, 'freshness'>>;
  memeCategory(context?: RhChainProviderRequestContext): Promise<Omit<RhChainMemeCategorySnapshot, 'freshness'>>;
  memePairs(context?: RhChainProviderRequestContext): Promise<RhChainMemePairContext[]>;
  tokenPair(contract: string, context?: RhChainProviderRequestContext): Promise<Omit<RhChainTokenPairSnapshot, 'contract' | 'freshness' | 'exact_contract_match' | 'chain_match_status'> & { observed_contract?: string | null; observed_chain_id?: string | null }>;
  explorer(contract: string, context?: RhChainProviderRequestContext): Promise<Omit<RhChainExplorerSnapshot, 'freshness' | 'exact_contract_match' | 'availability' | 'contract_exists' | 'contract_type'> & Partial<Pick<RhChainExplorerSnapshot, 'contract_exists' | 'contract_type'>> & { observed_contract?: string | null }>;
};
export type RhChainProviderRequestContext = { signal?: AbortSignal };
export type RhChainTokenSnapshotRequest = {
  deadline?: Pick<RequestDeadline, 'signal' | 'remainingMs'>;
  providerTimeoutMs?: number;
  cacheLookupTimeoutMs?: number;
};
export type RhChainLiveSnapshotLog = {
  event: 'rh_chain_live_token_operation';
  operation: 'cache_lookup' | 'provider' | 'cache_write' | 'stale_refresh' | 'negative_cache';
  provider: RhChainProviderSnapshot['provider_name'];
  duration_ms: number;
  outcome: 'fresh_cache' | 'stale_cache' | 'miss' | 'success' | 'timeout' | 'aborted' | 'error' | 'negative_cache_hit' | 'write_completed' | 'write_failed';
  retry_count: 0;
};
export type RhChainLiveSnapshotOptions = { enabled: boolean; timeoutMs: number; ttlSeconds?: number | null; maxStaleSeconds?: number; negativeCacheTtlSeconds?: number; cacheLookupTimeoutMs?: number; blockscoutUrl?: string | null; databaseUrl?: string | null; databasePool?: pg.Pool | null; cache?: RhChainSnapshotCache; now?: () => Date; providers?: Partial<RhChainLiveProviderClient>; log?: (entry: RhChainLiveSnapshotLog) => void };

const DISCLAIMER = 'Live Snapshot data is external, cached, and informational. It is not an endorsement, listing, partnership, trading signal, or financial recommendation.';
const JUDGMENT_POLICY = 'External data gives context. Infopunks gives judgment. Receipts create memory. Live data never overrides human-reviewed receipts, manual verdicts, review states, or index decisions.';
const providerNames: RhChainProviderSnapshot['provider_name'][] = ['DefiLlama', 'CoinGecko', 'DexScreener', 'Blockscout'];
const DEFAULT_TOKEN_CACHE_LOOKUP_TIMEOUT_MS = 300;
const DEFAULT_TOKEN_MAX_STALE_SECONDS = 15 * 60;
const DEFAULT_TOKEN_NEGATIVE_CACHE_TTL_SECONDS = 20;
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
  private readonly tokenLoads = new Map<string, Promise<unknown>>();
  private readonly negativeTokenCache = new Map<string, { expiresAtMs: number; errorSummary: string }>();
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

  unavailableTokenSnapshot(contract: string, errorSummary = 'request_deadline_exhausted') {
    const unavailable = (provider_name: 'DexScreener' | 'Blockscout'): RhChainProviderSnapshot => ({
      provider_name, status: 'unavailable', fetched_at: null, expires_at: null, error_summary: errorSummary,
      error: normalizeRhChainProviderError(new Error(errorSummary))
    });
    return {
      contract, token_pair: null, explorer: null, launch_context: undefined, response_status: 'unavailable' as const, warnings: [`Live token context: ${errorSummary}`],
      provider_statuses: [this.idleProvider('DefiLlama'), this.idleProvider('CoinGecko'), unavailable('DexScreener'), unavailable('Blockscout')],
      cache_status: 'unavailable' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: this.options.enabled,
      judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER
    };
  }

  async getTokenSnapshot(contract: string, request: RhChainTokenSnapshotRequest = {}) {
    if (!isRhChainIdentityContract(contract)) return { contract, token_pair: null, explorer: null, provider_statuses: providerNames.map((name) => this.idleProvider(name)), cache_status: 'unavailable' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: this.options.enabled, source_required: true, judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER };
    if (!this.options.enabled) return { contract, token_pair: null, explorer: null, provider_statuses: providerNames.map((name) => this.disabledProvider(name)), cache_status: 'disabled' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: false, judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER };
    const ownedDeadline = request.deadline ? null : createRequestDeadline(Math.max(1, request.providerTimeoutMs ?? this.options.timeoutMs));
    const deadline = request.deadline ?? ownedDeadline!;
    const providerTimeoutMs = Math.max(1, request.providerTimeoutMs ?? this.options.timeoutMs);
    const cacheLookupTimeoutMs = Math.max(1, request.cacheLookupTimeoutMs ?? this.options.cacheLookupTimeoutMs ?? DEFAULT_TOKEN_CACHE_LOOKUP_TIMEOUT_MS);
    const [pair, explorer] = await Promise.all([
      this.cachedToken(`dexscreener:token:${contract.toLowerCase()}`, 'DexScreener', this.ttl(120), deadline, providerTimeoutMs, cacheLookupTimeoutMs, isValidTokenPairProviderValue, async (signal) => {
        const value = await this.clients.tokenPair(contract, { signal });
        return TokenPairProviderValueSchema.parse(value) as typeof value;
      }),
      this.cachedToken(`blockscout:token:${contract.toLowerCase()}`, 'Blockscout', this.ttl(600), deadline, providerTimeoutMs, cacheLookupTimeoutMs, isValidExplorerProviderValue, async (signal) => {
        const value = await this.clients.explorer(contract, { signal });
        return ExplorerProviderValueSchema.parse(value) as typeof value;
      })
    ]).finally(() => ownedDeadline?.dispose());
    const normalizedPair = pair.value ? normalizeRhChainTokenPair(contract, pair.value, pair.status, this.now()) : null;
    // A provider that explicitly names another network is not RH Chain context at all.
    const tokenPair = normalizedPair?.chain_match_status === 'chain_mismatch' ? null : normalizedPair;
    const explorerValue = explorer.value ? normalizeRhChainExplorer(contract, explorer.value, explorer.status, this.now()) : null;
    const responseStatus = tokenPair && explorerValue ? 'complete' as const : tokenPair || explorerValue ? 'partial' as const : 'unavailable' as const;
    const warnings = [pair.error_summary && `DexScreener: ${pair.error_summary}`, explorer.error_summary && `Blockscout: ${explorer.error_summary}`].filter((value): value is string => Boolean(value));
    return { contract, token_pair: tokenPair, explorer: explorerValue, launch_context: inferLaunchContext(tokenPair, explorerValue), response_status: responseStatus, warnings,
      provider_statuses: [this.idleProvider('DefiLlama'), this.idleProvider('CoinGecko'), this.providerStatus('DexScreener', pair), this.providerStatus('Blockscout', explorer)], cache_status: pair.status === 'fresh' || explorer.status === 'fresh' ? 'fresh' as const : pair.status === 'stale' || explorer.status === 'stale' ? 'stale' as const : 'unavailable' as const, generated_at: this.now().toISOString(), live_snapshots_enabled: true, judgment_policy: JUDGMENT_POLICY, disclaimer: DISCLAIMER };
  }

  async getMemePairContext() {
    if (!this.options.enabled) return { pairs: [] as RhChainMemePairContext[], provider_status: this.disabledProvider('DexScreener'), cache_status: 'disabled' as const, generated_at: this.now().toISOString() };
    const result = await this.cached('dexscreener:rh-chain-meme-pairs', 'DexScreener', this.ttl(120), () => this.clients.memePairs());
    return { pairs: result.value ?? [], provider_status: this.providerStatus('DexScreener', result), cache_status: result.status, generated_at: this.now().toISOString() };
  }

  private ttl(defaultSeconds: number) { return (this.options.ttlSeconds ?? defaultSeconds) * 1000; }
  private async cachedToken<T>(
    key: string,
    provider: RhChainProviderSnapshot['provider_name'],
    ttlMs: number,
    deadline: Pick<RequestDeadline, 'signal' | 'remainingMs'>,
    providerTimeoutMs: number,
    cacheLookupTimeoutMs: number,
    isValid: (value: unknown) => value is T,
    load: (signal: AbortSignal) => Promise<T>
  ): Promise<{ value: T | null; status: RhChainSnapshotStatus; entry: RhChainCacheEntry<T> | null; error_summary?: string }> {
    const cacheStartedAt = Date.now();
    const cached = await runWithinDeadline(deadline, cacheLookupTimeoutMs, () => this.cache.get<T>(key, { timeoutMs: cacheLookupTimeoutMs }));
    const cachedValue = cached.ok ? cached.value : null;
    const existing = cachedValue && isValid(cachedValue.value) ? cachedValue : null;
    if (cachedValue && !existing) void this.cache.delete(key).catch(() => undefined);
    const nowMs = this.now().getTime();
    const expiresAtMs = existing ? new Date(existing.expires_at).getTime() : 0;
    const cacheOutcome = existing && expiresAtMs > nowMs ? 'fresh_cache' : existing ? 'stale_cache' : 'miss';
    this.log({ event: 'rh_chain_live_token_operation', operation: 'cache_lookup', provider, duration_ms: Date.now() - cacheStartedAt, outcome: cacheOutcome, retry_count: 0 });
    if (existing && expiresAtMs > nowMs) return { value: existing.value, status: 'fresh', entry: existing };

    const maxStaleMs = (this.options.maxStaleSeconds ?? DEFAULT_TOKEN_MAX_STALE_SECONDS) * 1_000;
    if (existing && nowMs - expiresAtMs <= maxStaleMs) {
      this.refreshStaleToken(key, provider, ttlMs, providerTimeoutMs, load);
      return { value: existing.value, status: 'stale', entry: { ...existing, status: 'stale' }, error_summary: 'Serving stale cache while provider refresh is bounded in the background.' };
    }

    const negative = this.negativeTokenCache.get(key);
    if (negative && negative.expiresAtMs > nowMs) {
      this.log({ event: 'rh_chain_live_token_operation', operation: 'negative_cache', provider, duration_ms: 0, outcome: 'negative_cache_hit', retry_count: 0 });
      return { value: null, status: 'unavailable', entry: null, error_summary: negative.errorSummary };
    }
    if (negative) this.negativeTokenCache.delete(key);

    const providerStartedAt = Date.now();
    const loaded = await runWithinDeadline(deadline, providerTimeoutMs, (signal) => this.deduplicatedTokenLoad(key, () => load(signal)));
    if (!loaded.ok) {
      const errorSummary = loaded.reason === 'timeout' || loaded.reason === 'aborted' ? `${provider.toLowerCase()}_provider_timeout` : errorMessage(loaded.error);
      this.log({ event: 'rh_chain_live_token_operation', operation: 'provider', provider, duration_ms: Date.now() - providerStartedAt, outcome: loaded.reason, retry_count: 0 });
      if (isDeterministicNoData(errorSummary)) this.negativeTokenCache.set(key, { expiresAtMs: nowMs + (this.options.negativeCacheTtlSeconds ?? DEFAULT_TOKEN_NEGATIVE_CACHE_TTL_SECONDS) * 1_000, errorSummary });
      return { value: null, status: 'unavailable', entry: null, error_summary: errorSummary };
    }

    const fetched = this.now();
    const entry: RhChainCacheEntry<T> = { cache_key: key, value: loaded.value, fetched_at: fetched.toISOString(), expires_at: new Date(fetched.getTime() + ttlMs).toISOString(), provider_name: provider, status: 'fresh' };
    this.log({ event: 'rh_chain_live_token_operation', operation: 'provider', provider, duration_ms: Date.now() - providerStartedAt, outcome: 'success', retry_count: 0 });
    this.persistTokenCache(key, entry, ttlMs, cacheLookupTimeoutMs, provider);
    return { value: loaded.value, status: 'fresh', entry };
  }

  private deduplicatedTokenLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.tokenLoads.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const pending = Promise.resolve().then(load).finally(() => this.tokenLoads.delete(key));
    this.tokenLoads.set(key, pending);
    return pending;
  }

  private persistTokenCache<T>(key: string, entry: RhChainCacheEntry<T>, ttlMs: number, timeoutMs: number, provider: RhChainProviderSnapshot['provider_name']) {
    const startedAt = Date.now();
    void this.cache.set(key, entry, ttlMs, { timeoutMs }).then(
      () => this.log({ event: 'rh_chain_live_token_operation', operation: 'cache_write', provider, duration_ms: Date.now() - startedAt, outcome: 'write_completed', retry_count: 0 }),
      () => this.log({ event: 'rh_chain_live_token_operation', operation: 'cache_write', provider, duration_ms: Date.now() - startedAt, outcome: 'write_failed', retry_count: 0 })
    );
  }

  private refreshStaleToken<T>(key: string, provider: RhChainProviderSnapshot['provider_name'], ttlMs: number, timeoutMs: number, load: (signal: AbortSignal) => Promise<T>) {
    if (this.tokenLoads.has(key)) return;
    const deadline = createRequestDeadline(timeoutMs);
    const startedAt = Date.now();
    const refresh = runWithinDeadline(deadline, timeoutMs, (signal) => this.deduplicatedTokenLoad(key, () => load(signal))).then((result) => {
      if (!result.ok) {
        this.log({ event: 'rh_chain_live_token_operation', operation: 'stale_refresh', provider, duration_ms: Date.now() - startedAt, outcome: result.reason, retry_count: 0 });
        return;
      }
      const fetched = this.now();
      const entry: RhChainCacheEntry<T> = { cache_key: key, value: result.value, fetched_at: fetched.toISOString(), expires_at: new Date(fetched.getTime() + ttlMs).toISOString(), provider_name: provider, status: 'fresh' };
      this.persistTokenCache(key, entry, ttlMs, this.options.cacheLookupTimeoutMs ?? DEFAULT_TOKEN_CACHE_LOOKUP_TIMEOUT_MS, provider);
      this.log({ event: 'rh_chain_live_token_operation', operation: 'stale_refresh', provider, duration_ms: Date.now() - startedAt, outcome: 'success', retry_count: 0 });
    }).finally(() => deadline.dispose());
    void refresh.catch(() => undefined);
  }

  private log(entry: RhChainLiveSnapshotLog) { this.options.log?.(entry); }
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
  const request = async <T>(url: string, context?: RhChainProviderRequestContext) => requestJson<T>(url, options.timeoutMs, context?.signal);
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
    async tokenPair(contract, context) { const payload = await request<unknown>(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(contract)}`, context); const pairs = DexScreenerTokenPairsSchema.nullable().parse(payload) ?? []; const pair = pairs.find((item) => isExactRhChainContractMatch(contract, item.baseToken?.address) || isExactRhChainContractMatch(contract, item.quoteToken?.address)); if (!pair) throw new Error('provider_contract_mismatch'); const observed_contract = isExactRhChainContractMatch(contract, pair.baseToken?.address) ? pair.baseToken?.address : pair.quoteToken?.address; return { observed_contract, observed_chain_id: pair.chainId ?? null, pair_address: pair.pairAddress ?? null, dex_url: pair.url ?? null, liquidity_usd: pair.liquidity?.usd ?? null, volume_24h_usd: pair.volume?.h24 ?? null, fdv_usd: pair.fdv ?? null, market_cap_usd: pair.marketCap ?? null, pair_created_at: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null, source_timestamp: new Date().toISOString() }; },
    async explorer(contract, context) { if (!options.blockscoutUrl) throw new Error('blockscout_endpoint_not_configured'); const base = options.blockscoutUrl.replace(/\/$/, ''); const explorer_url = `${base}/address/${encodeURIComponent(contract)}`; const payload = BlockscoutAddressSchema.parse(await request<unknown>(`${base}/api/v2/addresses/${encodeURIComponent(contract)}`, context)); const creator = typeof payload.creator_address === 'string' ? payload.creator_address : payload.creator_address?.hash ?? null; return { observed_contract: payload.address ?? payload.hash ?? null, explorer_url, contract_exists: true, contract_verified: payload.smart_contract?.is_verified ?? payload.is_verified ?? null, deployer_address: creator, contract_type: payload.smart_contract?.contract_type ?? (payload.is_contract ? 'contract' : null), source_timestamp: new Date().toISOString() }; }
  };
}
function stablecoinValueForRobinhood(chainCirculating: Record<string, unknown> | undefined) {
  if (!chainCirculating) return 0;
  const match = Object.entries(chainCirculating).find(([chain]) => /robinhood/i.test(chain))?.[1];
  if (typeof match === 'number') return match;
  if (match && typeof match === 'object' && 'current' in match && typeof (match as { current?: unknown }).current === 'number') return (match as { current: number }).current;
  return 0;
}
const TokenPairProviderValueSchema = z.object({
  observed_contract: z.string().nullable().optional(), observed_chain_id: z.string().nullable().optional(), pair_address: z.string().nullable(), dex_url: z.string().nullable(),
  liquidity_usd: z.number().nullable(), volume_24h_usd: z.number().nullable(), fdv_usd: z.number().nullable(), market_cap_usd: z.number().nullable(),
  pair_created_at: z.string().nullable(), source_timestamp: z.string().nullable()
}).passthrough();
const ExplorerProviderValueSchema = z.object({
  observed_contract: z.string().nullable().optional(), explorer_url: z.string().nullable(), contract_exists: z.boolean().nullable().optional(), contract_verified: z.boolean().nullable(),
  deployer_address: z.string().nullable(), contract_type: z.string().nullable().optional(), source_timestamp: z.string().nullable()
}).passthrough();
function isValidTokenPairProviderValue(value: unknown): value is Awaited<ReturnType<RhChainLiveProviderClient['tokenPair']>> { return TokenPairProviderValueSchema.safeParse(value).success; }
function isValidExplorerProviderValue(value: unknown): value is Awaited<ReturnType<RhChainLiveProviderClient['explorer']>> { return ExplorerProviderValueSchema.safeParse(value).success; }

const DexScreenerTokenPairsSchema = z.array(z.object({
  chainId: z.string().optional(), pairAddress: z.string().optional(), url: z.string().optional(),
  baseToken: z.object({ address: z.string().optional() }).passthrough().optional(), quoteToken: z.object({ address: z.string().optional() }).passthrough().optional(),
  liquidity: z.object({ usd: z.number().nullable().optional() }).passthrough().optional(), volume: z.object({ h24: z.number().nullable().optional() }).passthrough().optional(),
  fdv: z.number().nullable().optional(), marketCap: z.number().nullable().optional(), pairCreatedAt: z.number().nullable().optional()
}).passthrough());
const BlockscoutAddressSchema = z.object({
  address: z.string().optional(), hash: z.string().optional(), is_contract: z.boolean().optional(), is_verified: z.boolean().optional(),
  creator_address: z.union([z.string(), z.object({ hash: z.string().optional() }).passthrough()]).nullable().optional(),
  smart_contract: z.object({ is_verified: z.boolean().optional(), contract_type: z.string().optional() }).passthrough().nullable().optional()
}).passthrough().refine((value) => Boolean(value.address || value.hash), 'invalid_blockscout_address_payload');

async function requestJson<T>(url: string, timeoutMs: number, parentSignal?: AbortSignal): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  const payload = await response.json() as T | { pairs?: T };
  return (payload && typeof payload === 'object' && 'pairs' in payload ? payload.pairs : payload) as T;
}
function isDeterministicNoData(message: string) { return /provider_contract_mismatch|provider_http_404|pair_not_found/.test(message); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 160) : 'provider_unavailable'; }
