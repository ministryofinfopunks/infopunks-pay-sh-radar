import { createResponseCache } from '../services/responseCache';

export const DEXSCREENER_RH_CHAIN_ID = 'robinhood' as const;
export const DEXSCREENER_MAX_BATCH_SIZE = 30;

export type RhChainDexScreenerDataMode = 'live_cached' | 'unavailable' | 'disabled';
export type RhChainMarketSnapshot = {
  provider: 'dexscreener';
  chainId: typeof DEXSCREENER_RH_CHAIN_ID;
  capturedAt: string;
  tokenAddress: string;
  quoteTokenAddress?: string | null;
  quoteTokenSymbol?: string | null;
  pairAddress: string | null;
  dexId: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume: { h24: number | null };
  txns: { h24: { buys: number | null; sells: number | null } };
  priceChange: { h1: number | null; h6: number | null; h24: number | null };
  pairCreatedAt: string | null;
  activeBoosts: number;
  paidOrders: RhChainPaidOrder[];
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

export type DexScreenerProviderOptions = {
  enabled: boolean;
  baseUrl?: string;
  chainId?: typeof DEXSCREENER_RH_CHAIN_ID;
  timeoutMs?: number;
  cacheTtlSeconds?: number;
  maxBatchSize?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

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
}

export class DexScreenerProvider implements RhChainDexScreenerIngestionSource {
  readonly chainId: typeof DEXSCREENER_RH_CHAIN_ID;
  readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly maxBatchSize: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly cache = createResponseCache();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(options: DexScreenerProviderOptions) {
    this.enabled = options.enabled;
    this.chainId = options.chainId ?? DEXSCREENER_RH_CHAIN_ID;
    this.baseUrl = (options.baseUrl ?? 'https://api.dexscreener.com').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 2_500;
    this.ttlMs = (options.cacheTtlSeconds ?? 120) * 1_000;
    this.maxBatchSize = Math.min(DEXSCREENER_MAX_BATCH_SIZE, Math.max(1, options.maxBatchSize ?? DEXSCREENER_MAX_BATCH_SIZE));
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async getLatestTokenProfiles() { return this.getList('/token-profiles/latest/v1'); }
  async getLatestCommunityTakeovers() { return this.getList('/community-takeovers/latest/v1'); }
  async getLatestAds() { return this.getList('/ads/latest/v1'); }
  async getLatestBoosts() { return this.getBoosts('/token-boosts/latest/v1'); }
  async getTopBoosts() { return this.getBoosts('/token-boosts/top/v1'); }

  async getPaidOrders(tokenAddress: string): Promise<RhChainPaidOrder[]> {
    const address = this.requireAddress(tokenAddress);
    const payload = await this.request<unknown>(`orders:${address}`, `/orders/v1/${this.chainId}/${encodeURIComponent(address)}`);
    const orders = isRecord(payload) && Array.isArray(payload.orders) ? payload.orders : Array.isArray(payload) ? payload : [];
    return orders.filter(isRecord).map((order) => ({
      type: string(order.type) ?? string(order.orderType),
      status: string(order.status),
      paymentTimestamp: timestamp(order.paymentTimestamp) ?? timestamp(order.payment_timestamp) ?? timestamp(order.createdAt),
      observed_at: this.now().toISOString(),
      source: 'dexscreener_paid_attention'
    }));
  }

  async getTokenPairs(tokenAddress: string): Promise<RhChainMarketSnapshot[]> {
    const address = this.requireAddress(tokenAddress);
    const payload = await this.request<unknown>(`token-pairs:${address}`, `/token-pairs/v1/${this.chainId}/${encodeURIComponent(address)}`);
    return this.pairs(payload, address);
  }

  async getTokenBatch(tokenAddresses: string[]): Promise<Record<string, RhChainMarketSnapshot[]>> {
    const addresses = [...new Set(tokenAddresses.map((address) => this.requireAddress(address)))];
    const results: Record<string, RhChainMarketSnapshot[]> = {};
    for (let index = 0; index < addresses.length; index += this.maxBatchSize) {
      const batch = addresses.slice(index, index + this.maxBatchSize);
      try {
        const payload = await this.request<unknown>(`tokens:${batch.join(',')}`, `/tokens/v1/${this.chainId}/${batch.map(encodeURIComponent).join(',')}`);
        for (const address of batch) {
          // A token can be the base or quote side of a pool. Resolve only by its
          // exact address; a displayed ticker is intentionally never consulted.
          results[address] = this.pairs(payload, address);
        }
        for (const address of batch) results[address] ??= [];
      } catch {
        for (const address of batch) results[address] ??= [];
      }
    }
    return results;
  }

  async getPair(pairAddress: string): Promise<RhChainMarketSnapshot | null> {
    const address = this.requireAddress(pairAddress);
    const payload = await this.request<unknown>(`pair:${address}`, `/latest/dex/pairs/${this.chainId}/${encodeURIComponent(address)}`);
    const pairs = this.pairs(isRecord(payload) && Array.isArray(payload.pairs) ? payload.pairs : payload);
    return pairs.find((pair) => normalizeAddress(pair.pairAddress ?? '') === address) ?? pairs[0] ?? null;
  }

  private async getList(path: string): Promise<unknown[]> {
    const payload = await this.request<unknown>(path, path);
    return Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  }

  private async getBoosts(path: string): Promise<RhChainBoostObservation[]> {
    const rows = await this.getList(path);
    return rows.filter(isRecord).filter((row) => chainMatches(string(row.chainId) ?? string(row.chain), this.chainId)).map((row) => {
      return {
        tokenAddress: normalizeAddress(string(row.tokenAddress) ?? string(row.address) ?? ''),
        chainId: this.chainId,
        amount: number(row.amount),
        totalAmount: number(row.totalAmount) ?? number(row.total_amount),
        observed_at: this.now().toISOString(),
        sourceUrl: string(row.url)
      };
    }).filter((row) => Boolean(row.tokenAddress));
  }

  private pairs(payload: unknown, requestedTokenAddress?: string) {
    const rows = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.pairs) ? payload.pairs : [];
    return rows.filter(isRecord).map((pair) => this.normalizePair(pair, requestedTokenAddress)).filter((pair): pair is RhChainMarketSnapshot => Boolean(pair));
  }

  private normalizePair(pair: RecordValue, requestedTokenAddress?: string): RhChainMarketSnapshot | null {
    if (!chainMatches(string(pair.chainId), this.chainId)) return null;
    const baseToken = isRecord(pair.baseToken) ? pair.baseToken : {};
    const quoteToken = isRecord(pair.quoteToken) ? pair.quoteToken : {};
    const baseAddress = normalizeAddress(string(baseToken.address) ?? '');
    const quoteAddress = normalizeAddress(string(quoteToken.address) ?? '');
    const requested = requestedTokenAddress ? normalizeAddress(requestedTokenAddress) : null;
    if (requested && requested !== baseAddress && requested !== quoteAddress) return null;
    const tokenAddress = requested ?? baseAddress;
    if (!tokenAddress) return null;
    const liquidity = isRecord(pair.liquidity) ? pair.liquidity : {};
    const volume = isRecord(pair.volume) ? pair.volume : {};
    const txns = isRecord(pair.txns) && isRecord(pair.txns.h24) ? pair.txns.h24 : {};
    const priceChange = isRecord(pair.priceChange) ? pair.priceChange : {};
    return {
      provider: 'dexscreener', chainId: this.chainId, capturedAt: this.now().toISOString(), tokenAddress,
      quoteTokenAddress: requested === baseAddress ? quoteAddress || null : baseAddress || null,
      quoteTokenSymbol: requested === baseAddress ? string(quoteToken.symbol) : string(baseToken.symbol),
      pairAddress: string(pair.pairAddress), dexId: string(pair.dexId), priceUsd: number(pair.priceUsd),
      liquidityUsd: number(liquidity.usd), marketCap: number(pair.marketCap), fdv: number(pair.fdv),
      volume: { h24: number(volume.h24) }, txns: { h24: { buys: number(txns.buys), sells: number(txns.sells) } },
      priceChange: { h1: number(priceChange.h1), h6: number(priceChange.h6), h24: number(priceChange.h24) },
      pairCreatedAt: timestamp(pair.pairCreatedAt), activeBoosts: 0, paidOrders: [], dataMode: 'live_cached', sourceUrl: string(pair.url)
    };
  }

  private requireAddress(value: string) {
    const address = normalizeAddress(value);
    if (!address) throw new Error('exact_contract_required');
    return address;
  }

  private async request<T>(key: string, path: string): Promise<T> {
    if (!this.enabled) throw new Error('dexscreener_disabled');
    const cached = await this.cache.getOrSet(`dexscreener:${this.chainId}:${key}`, this.ttlMs, async () => {
      const existing = this.inFlight.get(key) as Promise<T> | undefined;
      if (existing) return existing;
      const request = (async () => {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs) });
        if (!response.ok) throw new Error(`dexscreener_http_${response.status}`);
        return response.json() as Promise<T>;
      })();
      this.inFlight.set(key, request);
      try { return await request; } finally { this.inFlight.delete(key); }
    });
    return cached.value as T;
  }
}

function chainMatches(value: string | null, expected: string) { return value === expected; }
