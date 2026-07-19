import { z } from 'zod';
import { createResponseCache, type CacheMetadata, type CachePolicy } from '../services/responseCache';

export const DEXSCREENER_RH_CHAIN_ID = 'robinhood' as const;
export const DEXSCREENER_MAX_BATCH_SIZE = 30;
export const DEXSCREENER_RAW_DATA_VERSION = 'dexscreener-v1' as const;

export type RhChainDexScreenerDataMode = 'live_cached' | 'unavailable' | 'disabled';
export type RhChainMarketFreshness = 'fresh' | 'stale';
export type RhChainCacheStatus = CacheMetadata['status'] | 'unavailable' | 'disabled';
export type RhChainTokenMetadata = { address: string; name: string | null; symbol: string | null; decimals: number | null };
export type RhChainMarketLink = { label: string | null; url: string };
export type RhChainMarketSocial = { type: string | null; url: string };
export type RhChainMarketSnapshot = {
  provider: 'dexscreener';
  chainId: typeof DEXSCREENER_RH_CHAIN_ID;
  capturedAt: string;
  tokenAddress: string;
  baseToken?: RhChainTokenMetadata;
  quoteToken?: RhChainTokenMetadata;
  quoteTokenAddress?: string | null;
  quoteTokenSymbol?: string | null;
  pairAddress: string | null;
  dexId: string | null;
  pairLabels?: string[];
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume: { h24: number | null; h6?: number | null; h1?: number | null };
  txns: { h24: { buys: number | null; sells: number | null }; h6?: { buys: number | null; sells: number | null } };
  priceChange: { h1: number | null; h6: number | null; h24: number | null };
  pairCreatedAt: string | null;
  activeBoosts: number;
  paidOrders: RhChainPaidOrder[];
  websites?: RhChainMarketLink[];
  socials?: RhChainMarketSocial[];
  providerTimestamp?: string | null;
  freshness?: RhChainMarketFreshness;
  rawDataVersion?: typeof DEXSCREENER_RAW_DATA_VERSION;
  cache?: { status: RhChainCacheStatus; provenance: string; generatedAt: string; ageMs: number };
  dataMode: RhChainDexScreenerDataMode;
  sourceUrl: string | null;
};

export type RhChainPaidOrder = {
  type: string | null;
  status: string | null;
  paymentTimestamp: string | null;
  observed_at: string;
  source: 'dexscreener_paid_attention';
};

export type RhChainBoostObservation = {
  tokenAddress: string;
  chainId: typeof DEXSCREENER_RH_CHAIN_ID;
  amount: number | null;
  totalAmount: number | null;
  observed_at: string;
  sourceUrl: string | null;
};

export type DexScreenerProviderHealth = {
  provider: 'dexscreener';
  enabled: boolean;
  healthy: boolean;
  degraded: boolean;
  disabled: boolean;
  state: 'enabled' | 'healthy' | 'degraded' | 'disabled';
  lastSuccess: string | null;
  lastFailure: string | null;
  latestLatencyMs: number | null;
  rollingFailureCount: number;
  activeCacheStatus: RhChainCacheStatus;
  currentFreshness: 'fresh' | 'stale' | 'unavailable' | 'disabled';
};

export type DexScreenerProviderOptions = {
  enabled: boolean;
  baseUrl?: string;
  chainId?: typeof DEXSCREENER_RH_CHAIN_ID;
  timeoutMs?: number;
  cacheTtlSeconds?: number;
  staleWhileRevalidateSeconds?: number;
  staleIfErrorSeconds?: number;
  maxStaleSeconds?: number;
  maxBatchSize?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  maxConcurrency?: number;
  maxPendingRequests?: number;
  rateLimitPerSecond?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  log?: (entry: Record<string, unknown>) => void;
};

export type DexScreenerProviderErrorCode = 'disabled' | 'invalid_request' | 'timeout' | 'rate_limited' | 'upstream' | 'network' | 'invalid_payload' | 'concurrency_limit';
export class DexScreenerProviderError extends Error {
  readonly name = 'DexScreenerProviderError';
  constructor(
    readonly code: DexScreenerProviderErrorCode,
    readonly operation: string,
    readonly retryable: boolean,
    readonly statusCode: number | null = null,
    readonly retryAfterMs: number | null = null,
    options?: { cause?: unknown }
  ) {
    super(`dexscreener_${code}`, options);
  }
}

const NumberishSchema = z.union([z.number().finite(), z.string()]).nullish();
const TokenSchema = z.object({ address: z.string().min(1), name: z.string().nullish(), symbol: z.string().nullish(), decimals: NumberishSchema }).passthrough();
const PairSchema = z.object({
  chainId: z.string().min(1), pairAddress: z.string().min(1), dexId: z.string().nullish(), url: z.string().nullish(),
  labels: z.array(z.string()).nullish(), baseToken: TokenSchema, quoteToken: TokenSchema.nullish(), priceUsd: NumberishSchema,
  liquidity: z.object({ usd: NumberishSchema }).passthrough().nullish(), marketCap: NumberishSchema, fdv: NumberishSchema,
  volume: z.record(z.string(), NumberishSchema).nullish(), txns: z.record(z.string(), z.object({ buys: NumberishSchema, sells: NumberishSchema }).passthrough()).nullish(),
  priceChange: z.record(z.string(), NumberishSchema).nullish(), pairCreatedAt: NumberishSchema,
  updatedAt: NumberishSchema, timestamp: NumberishSchema,
  info: z.object({ websites: z.array(z.object({ label: z.string().nullish(), url: z.string().min(1) }).passthrough()).nullish(), socials: z.array(z.object({ type: z.string().nullish(), url: z.string().min(1) }).passthrough()).nullish() }).passthrough().nullish()
}).passthrough();
const PairPayloadSchema = z.union([z.array(PairSchema), z.object({ pairs: z.array(PairSchema).nullish() }).passthrough()]);
const ProviderRecordSchema = z.record(z.string(), z.unknown());
const ListPayloadSchema = z.union([z.array(ProviderRecordSchema), z.object({ data: z.array(ProviderRecordSchema).nullish() }).passthrough()]);
const OrderPayloadSchema = z.union([z.array(ProviderRecordSchema), z.object({ orders: z.array(ProviderRecordSchema).nullish() }).passthrough()]);

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
};
const timestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
};
const normalizeAddress = (address: string) => address.trim().toLowerCase();

/** REST-only adapter. The narrow interface deliberately leaves room for a future streaming ingestion adapter. */
export interface RhChainDexScreenerIngestionSource {
  getLatestTokenProfiles(): Promise<unknown[]>;
  getLatestCommunityTakeovers(): Promise<unknown[]>;
  getLatestAds(): Promise<unknown[]>;
  getLatestBoosts(): Promise<RhChainBoostObservation[]>;
  getTopBoosts(): Promise<RhChainBoostObservation[]>;
  getPaidOrders(tokenAddress: string): Promise<RhChainPaidOrder[]>;
  getTokenPairs(tokenAddress: string): Promise<RhChainMarketSnapshot[]>;
  getTokenBatch(tokenAddresses: string[]): Promise<Record<string, RhChainMarketSnapshot[]>>;
  getPair(pairAddress: string): Promise<RhChainMarketSnapshot | null>;
  getHealth?(): DexScreenerProviderHealth;
}

export class DexScreenerProvider implements RhChainDexScreenerIngestionSource {
  readonly chainId: typeof DEXSCREENER_RH_CHAIN_ID;
  readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly cachePolicy: CachePolicy;
  private readonly maxBatchSize: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly random: () => number;
  private readonly log: (entry: Record<string, unknown>) => void;
  private readonly cache = createResponseCache();
  private readonly limiter: RequestLimiter;
  private readonly rateGate: RateGate;
  private lastSuccess: string | null = null;
  private lastFailure: string | null = null;
  private latestLatencyMs: number | null = null;
  private rollingFailureCount = 0;
  private activeCacheStatus: RhChainCacheStatus;

  constructor(options: DexScreenerProviderOptions) {
    this.enabled = options.enabled;
    this.chainId = options.chainId ?? DEXSCREENER_RH_CHAIN_ID;
    this.baseUrl = (options.baseUrl ?? 'https://api.dexscreener.com').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 2_500;
    const freshTtlMs = (options.cacheTtlSeconds ?? 120) * 1_000;
    this.cachePolicy = {
      freshTtlMs,
      staleWhileRevalidateMs: (options.staleWhileRevalidateSeconds ?? 30) * 1_000,
      staleIfErrorMs: (options.staleIfErrorSeconds ?? 300) * 1_000,
      maxStaleMs: (options.maxStaleSeconds ?? 900) * 1_000,
      provenance: 'dexscreener-memory-cache'
    };
    this.maxBatchSize = Math.min(DEXSCREENER_MAX_BATCH_SIZE, Math.max(1, options.maxBatchSize ?? DEXSCREENER_MAX_BATCH_SIZE));
    this.maxRetries = Math.min(5, Math.max(0, options.maxRetries ?? 2));
    this.retryBaseMs = Math.max(1, options.retryBaseMs ?? 100);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.random = options.random ?? Math.random;
    this.log = options.log ?? (() => undefined);
    this.limiter = new RequestLimiter(options.maxConcurrency ?? 4, options.maxPendingRequests ?? 100);
    this.rateGate = new RateGate(options.rateLimitPerSecond ?? 20, this.sleep);
    this.activeCacheStatus = options.enabled ? 'unavailable' : 'disabled';
  }

  async getLatestTokenProfiles() { return this.getList('/token-profiles/latest/v1'); }
  async getLatestCommunityTakeovers() { return this.getList('/community-takeovers/latest/v1'); }
  async getLatestAds() { return this.getList('/ads/latest/v1'); }
  async getLatestBoosts() { return this.getBoosts('/token-boosts/latest/v1'); }
  async getTopBoosts() { return this.getBoosts('/token-boosts/top/v1'); }

  getHealth(): DexScreenerProviderHealth {
    const disabled = !this.enabled;
    const degraded = !disabled && (this.rollingFailureCount > 0 || this.activeCacheStatus === 'stale_if_error' || this.activeCacheStatus === 'stale_while_revalidate');
    const healthy = !disabled && Boolean(this.lastSuccess) && !degraded;
    return {
      provider: 'dexscreener', enabled: this.enabled, healthy, degraded, disabled,
      state: disabled ? 'disabled' : degraded ? 'degraded' : healthy ? 'healthy' : 'enabled',
      lastSuccess: this.lastSuccess, lastFailure: this.lastFailure, latestLatencyMs: this.latestLatencyMs,
      rollingFailureCount: this.rollingFailureCount, activeCacheStatus: this.activeCacheStatus,
      currentFreshness: disabled ? 'disabled' : this.activeCacheStatus === 'fresh' || this.activeCacheStatus === 'miss' ? 'fresh' : this.activeCacheStatus === 'stale_if_error' || this.activeCacheStatus === 'stale_while_revalidate' ? 'stale' : 'unavailable'
    };
  }

  async getPaidOrders(tokenAddress: string): Promise<RhChainPaidOrder[]> {
    const address = this.requireAddress(tokenAddress);
    const { value } = await this.request(`orders:${address}`, `/orders/v1/${this.chainId}/${encodeURIComponent(address)}`, OrderPayloadSchema);
    const orders = Array.isArray(value) ? value : value.orders ?? [];
    return orders.map((order) => ({
      type: string(order.type) ?? string(order.orderType), status: string(order.status),
      paymentTimestamp: timestamp(order.paymentTimestamp) ?? timestamp(order.payment_timestamp) ?? timestamp(order.createdAt),
      observed_at: this.now().toISOString(), source: 'dexscreener_paid_attention'
    }));
  }

  async getTokenPairs(tokenAddress: string): Promise<RhChainMarketSnapshot[]> {
    const address = this.requireAddress(tokenAddress);
    const result = await this.request(`token-pairs:${address}`, `/token-pairs/v1/${this.chainId}/${encodeURIComponent(address)}`, PairPayloadSchema);
    return this.pairs(result.value, address, result.cache);
  }

  async getTokenBatch(tokenAddresses: string[]): Promise<Record<string, RhChainMarketSnapshot[]>> {
    const addresses = [...new Set(tokenAddresses.map((address) => this.requireAddress(address)))];
    const results: Record<string, RhChainMarketSnapshot[]> = {};
    for (let index = 0; index < addresses.length; index += this.maxBatchSize) {
      const batch = addresses.slice(index, index + this.maxBatchSize);
      const result = await this.request(`tokens:${batch.join(',')}`, `/tokens/v1/${this.chainId}/${batch.map(encodeURIComponent).join(',')}`, PairPayloadSchema);
      for (const address of batch) results[address] = this.pairs(result.value, address, result.cache);
    }
    return results;
  }

  async getPair(pairAddress: string): Promise<RhChainMarketSnapshot | null> {
    const address = this.requireAddress(pairAddress);
    const result = await this.request(`pair:${address}`, `/latest/dex/pairs/${this.chainId}/${encodeURIComponent(address)}`, PairPayloadSchema);
    const pairs = this.pairs(result.value, undefined, result.cache);
    return pairs.find((pair) => normalizeAddress(pair.pairAddress ?? '') === address) ?? pairs[0] ?? null;
  }

  private async getList(path: string): Promise<RecordValue[]> {
    const { value } = await this.request(path, path, ListPayloadSchema);
    return Array.isArray(value) ? value : value.data ?? [];
  }

  private async getBoosts(path: string): Promise<RhChainBoostObservation[]> {
    const rows = await this.getList(path);
    return rows.filter((row) => chainMatches(string(row.chainId) ?? string(row.chain), this.chainId)).map((row) => ({
      tokenAddress: normalizeAddress(string(row.tokenAddress) ?? string(row.address) ?? ''), chainId: this.chainId,
      amount: number(row.amount), totalAmount: number(row.totalAmount) ?? number(row.total_amount), observed_at: this.now().toISOString(), sourceUrl: string(row.url)
    })).filter((row) => Boolean(row.tokenAddress));
  }

  private pairs(payload: z.infer<typeof PairPayloadSchema>, requestedTokenAddress?: string, cache?: CacheMetadata) {
    const rows = Array.isArray(payload) ? payload : payload.pairs ?? [];
    return rows.map((pair) => this.normalizePair(pair, requestedTokenAddress, cache)).filter((pair): pair is RhChainMarketSnapshot => Boolean(pair));
  }

  private normalizePair(pair: z.infer<typeof PairSchema>, requestedTokenAddress?: string, cache?: CacheMetadata): RhChainMarketSnapshot | null {
    if (!chainMatches(pair.chainId, this.chainId)) return null;
    const baseAddress = normalizeAddress(pair.baseToken.address);
    const quoteAddress = normalizeAddress(pair.quoteToken?.address ?? '');
    const requested = requestedTokenAddress ? normalizeAddress(requestedTokenAddress) : null;
    if (requested && requested !== baseAddress && requested !== quoteAddress) return null;
    const tokenAddress = requested ?? baseAddress;
    if (!tokenAddress) return null;
    const capturedAt = cache?.generatedAt ?? this.now().toISOString();
    const freshness: RhChainMarketFreshness = cache?.stale ? 'stale' : 'fresh';
    return {
      provider: 'dexscreener', chainId: this.chainId, capturedAt, tokenAddress,
      baseToken: normalizeToken(pair.baseToken), quoteToken: normalizeToken(pair.quoteToken),
      quoteTokenAddress: requested === baseAddress ? quoteAddress || null : baseAddress || null,
      quoteTokenSymbol: requested === baseAddress ? string(pair.quoteToken?.symbol) : string(pair.baseToken.symbol),
      pairAddress: string(pair.pairAddress), dexId: string(pair.dexId), pairLabels: pair.labels ?? [], priceUsd: number(pair.priceUsd),
      liquidityUsd: number(pair.liquidity?.usd), marketCap: number(pair.marketCap), fdv: number(pair.fdv),
      volume: { h24: number(pair.volume?.h24), h6: number(pair.volume?.h6), h1: number(pair.volume?.h1) },
      txns: { h24: { buys: number(pair.txns?.h24?.buys), sells: number(pair.txns?.h24?.sells) }, h6: { buys: number(pair.txns?.h6?.buys), sells: number(pair.txns?.h6?.sells) } },
      priceChange: { h1: number(pair.priceChange?.h1), h6: number(pair.priceChange?.h6), h24: number(pair.priceChange?.h24) },
      pairCreatedAt: timestamp(pair.pairCreatedAt), activeBoosts: 0, paidOrders: [],
      websites: (pair.info?.websites ?? []).map((item) => ({ label: string(item.label), url: item.url })),
      socials: (pair.info?.socials ?? []).map((item) => ({ type: string(item.type), url: item.url })),
      providerTimestamp: timestamp(pair.updatedAt) ?? timestamp(pair.timestamp), freshness, rawDataVersion: DEXSCREENER_RAW_DATA_VERSION,
      cache: cache ? { status: cache.status, provenance: cache.provenance, generatedAt: cache.generatedAt, ageMs: cache.ageMs } : { status: 'miss', provenance: 'dexscreener-memory-cache', generatedAt: capturedAt, ageMs: 0 },
      dataMode: 'live_cached', sourceUrl: string(pair.url)
    };
  }

  private requireAddress(value: string) {
    const address = normalizeAddress(value);
    if (!address) throw new DexScreenerProviderError('invalid_request', 'address', false);
    return address;
  }

  private async request<S extends z.ZodType>(key: string, path: string, schema: S): Promise<{ value: z.infer<S>; cache: CacheMetadata }> {
    if (!this.enabled) throw new DexScreenerProviderError('disabled', key, false);
    const startedAt = Date.now();
    try {
      const cached = await this.cache.getOrSet(`dexscreener:${this.chainId}:${key}`, this.cachePolicy, async () => {
        try {
          const payload = await this.limiter.run(key, () => this.fetchWithRetry(key, path));
          const parsed = schema.safeParse(payload);
          if (!parsed.success) throw new DexScreenerProviderError('invalid_payload', key, false, null, null, { cause: parsed.error });
          this.lastSuccess = this.now().toISOString();
          this.rollingFailureCount = 0;
          return parsed.data;
        } catch (error) {
          this.lastFailure = this.now().toISOString();
          this.rollingFailureCount = Math.min(1_000, this.rollingFailureCount + 1);
          throw error;
        }
      });
      this.latestLatencyMs = Date.now() - startedAt;
      this.activeCacheStatus = cached.metadata.status;
      return { value: cached.value as z.infer<S>, cache: cached.metadata };
    } catch (error) {
      this.latestLatencyMs = Date.now() - startedAt;
      this.activeCacheStatus = 'unavailable';
      throw asProviderError(error, key);
    }
  }

  private async fetchWithRetry(operation: string, path: string): Promise<unknown> {
    let lastError: DexScreenerProviderError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (attempt > 0 && lastError) await this.sleep(this.retryDelay(attempt - 1, lastError.retryAfterMs));
      try {
        await this.rateGate.wait();
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs) });
        if (!response.ok) {
          const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'), this.now());
          const retryable = response.status === 429 || response.status >= 500;
          throw new DexScreenerProviderError(response.status === 429 ? 'rate_limited' : response.status >= 500 ? 'upstream' : 'invalid_request', operation, retryable, response.status, retryAfterMs);
        }
        return await response.json() as unknown;
      } catch (error) {
        lastError = asProviderError(error, operation);
        if (!lastError.retryable || attempt >= this.maxRetries) {
          this.log({ event: 'dexscreener_request_failed', operation, code: lastError.code, status_code: lastError.statusCode, attempts: attempt + 1, retryable: lastError.retryable });
          throw lastError;
        }
        this.log({ event: 'dexscreener_request_retry', operation, code: lastError.code, status_code: lastError.statusCode, attempt: attempt + 1, retry_after_ms: lastError.retryAfterMs });
      }
    }
    throw lastError ?? new DexScreenerProviderError('network', operation, true);
  }

  private retryDelay(attempt: number, retryAfterMs: number | null) {
    const exponential = this.retryBaseMs * 2 ** attempt;
    const jitter = Math.floor(exponential * 0.25 * this.random());
    return Math.min(10_000, Math.max(retryAfterMs ?? 0, exponential + jitter));
  }
}

class RequestLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  private readonly maximum: number;
  private readonly maxPending: number;
  constructor(maximum: number, maxPending: number) { this.maximum = Math.max(1, maximum); this.maxPending = Math.max(1, maxPending); }
  async run<T>(operation: string, task: () => Promise<T>): Promise<T> {
    if (this.active >= this.maximum) {
      if (this.waiting.length >= this.maxPending) throw new DexScreenerProviderError('concurrency_limit', operation, true);
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try { return await task(); }
    finally { this.active -= 1; this.waiting.shift()?.(); }
  }
}

class RateGate {
  private nextStartAt = 0;
  private tail = Promise.resolve();
  private readonly intervalMs: number;
  constructor(ratePerSecond: number, private readonly sleep: (delayMs: number) => Promise<void>) { this.intervalMs = Math.ceil(1_000 / Math.max(1, ratePerSecond)); }
  async wait() {
    const turn = this.tail.then(async () => {
      const waitMs = Math.max(0, this.nextStartAt - Date.now());
      if (waitMs) await this.sleep(waitMs);
      this.nextStartAt = Date.now() + this.intervalMs;
    });
    this.tail = turn.catch(() => undefined);
    await turn;
  }
}

function normalizeToken(token: z.infer<typeof TokenSchema> | null | undefined): RhChainTokenMetadata {
  return { address: normalizeAddress(token?.address ?? ''), name: string(token?.name), symbol: string(token?.symbol), decimals: number(token?.decimals) };
}
function chainMatches(value: string | null, expected: string) { return value === expected; }
function parseRetryAfter(value: string | null, now: Date) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now.getTime());
}
function asProviderError(error: unknown, operation: string) {
  if (error instanceof DexScreenerProviderError) return error;
  if (error instanceof DOMException && error.name === 'TimeoutError') return new DexScreenerProviderError('timeout', operation, true, null, null, { cause: error });
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return new DexScreenerProviderError('timeout', operation, true, null, null, { cause: error });
  return new DexScreenerProviderError('network', operation, true, null, null, { cause: error });
}
