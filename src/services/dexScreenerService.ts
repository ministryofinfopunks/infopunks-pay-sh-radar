import type { UnicornRadarCandidate } from '../schemas/entities';
import { createResponseCache } from './responseCache';

const DEX_SCREENER_BASE_URL = 'https://api.dexscreener.com';
const DEX_SCREENER_CACHE_TTL_MS = 90_000;
const DEX_SCREENER_TIMEOUT_MS = 4_000;
const DEX_SCREENER_BATCH_SIZE = 30;
const DEX_SCREENER_MARKET_DATA_SOURCE = 'dexscreener_official_api';

type DexScreenerPair = {
  chainId: string;
  pairAddress: string | null;
  url: string | null;
  dexId: string | null;
  baseTokenAddress: string | null;
  quoteTokenAddress: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  txns24hBuys: number | null;
  txns24hSells: number | null;
  priceChange1h: number | null;
  priceChange6h: number | null;
  priceChange24h: number | null;
  pairCreatedAt: string | null;
};

type DexScreenerSearchResponse = {
  pairs?: unknown[];
};

type DexScreenerTokenPairsResponse = unknown[];

type DexScreenerOrdersResponse = {
  orders?: unknown[];
  boosts?: unknown[];
};

type DexScreenerCandidateMarketData = NonNullable<UnicornRadarCandidate['dexScreenerData']>;

const cache = createResponseCache();
const inFlight = new Map<string, Promise<unknown>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readInteger(value: unknown): number | null {
  const parsed = readNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function timestampToIso(value: unknown): string | null {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return null;
}

function withAbortSignal(timeoutMs = DEX_SCREENER_TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function fetchJson<T>(cacheKey: string, pathname: string): Promise<T> {
  const cached = await cache.getOrSet(cacheKey, DEX_SCREENER_CACHE_TTL_MS, async () => {
    const existing = inFlight.get(cacheKey) as Promise<T> | undefined;
    if (existing) return existing;

    const request = (async () => {
      const response = await fetch(`${DEX_SCREENER_BASE_URL}${pathname}`, {
        headers: { Accept: 'application/json' },
        signal: withAbortSignal()
      });
      if (!response.ok) throw new Error(`dexscreener_${response.status}`);
      return response.json() as Promise<T>;
    })();

    inFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      inFlight.delete(cacheKey);
    }
  });

  return cached.value;
}

function parsePair(raw: unknown): DexScreenerPair | null {
  if (!isRecord(raw)) return null;
  const txns = isRecord(raw.txns) ? raw.txns : null;
  const txns24h = txns && isRecord(txns.h24) ? txns.h24 : null;
  const volume = isRecord(raw.volume) ? raw.volume : null;
  const priceChange = isRecord(raw.priceChange) ? raw.priceChange : null;
  const liquidity = isRecord(raw.liquidity) ? raw.liquidity : null;
  const baseToken = isRecord(raw.baseToken) ? raw.baseToken : null;
  const quoteToken = isRecord(raw.quoteToken) ? raw.quoteToken : null;

  return {
    chainId: readString(raw.chainId) ?? 'unknown',
    pairAddress: readString(raw.pairAddress),
    url: readString(raw.url),
    dexId: readString(raw.dexId),
    baseTokenAddress: readString(baseToken?.address),
    quoteTokenAddress: readString(quoteToken?.address),
    priceUsd: readNumber(raw.priceUsd),
    marketCap: readNumber(raw.marketCap),
    fdv: readNumber(raw.fdv),
    liquidityUsd: readNumber(liquidity?.usd),
    volume24h: readNumber(volume?.h24),
    txns24hBuys: readInteger(txns24h?.buys),
    txns24hSells: readInteger(txns24h?.sells),
    priceChange1h: readNumber(priceChange?.h1),
    priceChange6h: readNumber(priceChange?.h6),
    priceChange24h: readNumber(priceChange?.h24),
    pairCreatedAt: timestampToIso(raw.pairCreatedAt)
  };
}

function bestPair(pairs: DexScreenerPair[]): DexScreenerPair | null {
  return [...pairs].sort((left, right) => {
    const liquidityDelta = (right.liquidityUsd ?? -1) - (left.liquidityUsd ?? -1);
    if (liquidityDelta !== 0) return liquidityDelta;
    const volumeDelta = (right.volume24h ?? -1) - (left.volume24h ?? -1);
    if (volumeDelta !== 0) return volumeDelta;
    const createdDelta = Date.parse(right.pairCreatedAt ?? '') - Date.parse(left.pairCreatedAt ?? '');
    return Number.isNaN(createdDelta) ? 0 : createdDelta;
  })[0] ?? null;
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function fetchDexScreenerOrders(chainId: string, tokenAddress: string): Promise<{ boosts: number; paidOrders: number }> {
  try {
    const payload = await fetchJson<DexScreenerOrdersResponse>(
      `dexscreener:orders:${chainId}:${tokenAddress.toLowerCase()}`,
      `/orders/v1/${encodeURIComponent(chainId)}/${encodeURIComponent(tokenAddress)}`
    );
    return {
      boosts: Array.isArray(payload.boosts) ? payload.boosts.length : 0,
      paidOrders: Array.isArray(payload.orders) ? payload.orders.length : 0
    };
  } catch {
    return { boosts: 0, paidOrders: 0 };
  }
}

export async function fetchDexScreenerTokenPairs(chainId: string, tokenAddress: string): Promise<DexScreenerPair[]> {
  const payload = await fetchJson<DexScreenerTokenPairsResponse>(
    `dexscreener:token-pairs:${chainId}:${tokenAddress.toLowerCase()}`,
    `/token-pairs/v1/${encodeURIComponent(chainId)}/${encodeURIComponent(tokenAddress)}`
  );
  return Array.isArray(payload) ? payload.map(parsePair).filter((pair): pair is DexScreenerPair => Boolean(pair)) : [];
}

export async function fetchDexScreenerTokenBatch(chainId: string, tokenAddresses: string[]): Promise<Record<string, DexScreenerPair[]>> {
  const cleaned = [...new Set(tokenAddresses.map((item) => item.trim()).filter(Boolean))];
  const grouped: Record<string, DexScreenerPair[]> = {};

  await Promise.all(chunk(cleaned, DEX_SCREENER_BATCH_SIZE).map(async (batch) => {
    const payload = await fetchJson<DexScreenerTokenPairsResponse>(
      `dexscreener:token-batch:${chainId}:${batch.map((item) => item.toLowerCase()).join(',')}`,
      `/tokens/v1/${encodeURIComponent(chainId)}/${batch.map((item) => encodeURIComponent(item)).join(',')}`
    );
    const parsed = Array.isArray(payload) ? payload.map(parsePair).filter((pair): pair is DexScreenerPair => Boolean(pair)) : [];
    for (const pair of parsed) {
      const baseTokenAddress = pair.baseTokenAddress?.toLowerCase();
      if (!baseTokenAddress) continue;
      grouped[baseTokenAddress] ??= [];
      grouped[baseTokenAddress].push(pair);
    }
  }));

  return grouped;
}

export async function searchDexScreenerPairs(query: string): Promise<DexScreenerPair[]> {
  const cleaned = query.trim();
  if (!cleaned) return [];
  const payload = await fetchJson<DexScreenerSearchResponse>(
    `dexscreener:search:${cleaned.toLowerCase()}`,
    `/latest/dex/search?q=${encodeURIComponent(cleaned)}`
  );
  return Array.isArray(payload.pairs) ? payload.pairs.map(parsePair).filter((pair): pair is DexScreenerPair => Boolean(pair)) : [];
}

function buildMarketData(pair: DexScreenerPair, orders: { boosts: number; paidOrders: number }): DexScreenerCandidateMarketData {
  return {
    priceUsd: pair.priceUsd,
    marketCap: pair.marketCap,
    fdv: pair.fdv,
    liquidityUsd: pair.liquidityUsd,
    volume24h: pair.volume24h,
    txns24hBuys: pair.txns24hBuys,
    txns24hSells: pair.txns24hSells,
    priceChange1h: pair.priceChange1h,
    priceChange6h: pair.priceChange6h,
    priceChange24h: pair.priceChange24h,
    pairCreatedAt: pair.pairCreatedAt,
    dexId: pair.dexId,
    boosts: orders.boosts,
    paidOrders: orders.paidOrders,
    rawUrl: pair.url
  };
}

function withDexScreenerData(candidate: UnicornRadarCandidate, pair: DexScreenerPair, orders: { boosts: number; paidOrders: number }): UnicornRadarCandidate {
  return {
    ...candidate,
    chainId: candidate.chainId ?? pair.chainId,
    pairAddress: pair.pairAddress ?? candidate.pairAddress,
    dexScreenerUrl: pair.url ?? candidate.dexScreenerUrl,
    marketDataSource: DEX_SCREENER_MARKET_DATA_SOURCE,
    marketDataUpdatedAt: new Date().toISOString(),
    dexScreenerData: buildMarketData(pair, orders)
  };
}

export async function enrichUnicornCandidate(candidate: UnicornRadarCandidate): Promise<UnicornRadarCandidate> {
  if (!candidate.chainId || !candidate.tokenAddress || candidate.verificationStatus !== 'verified_live_market') return candidate;

  try {
    const pairs = await fetchDexScreenerTokenPairs(candidate.chainId, candidate.tokenAddress);
    const pair = bestPair(pairs);
    if (!pair) return candidate;
    const orders = await fetchDexScreenerOrders(candidate.chainId, candidate.tokenAddress);
    return withDexScreenerData(candidate, pair, orders);
  } catch {
    return candidate;
  }
}

export async function enrichUnicornCandidates(candidates: UnicornRadarCandidate[]): Promise<UnicornRadarCandidate[]> {
  const output = [...candidates];
  const byChain = new Map<string, Array<{ index: number; candidate: UnicornRadarCandidate }>>();

  for (const [index, candidate] of output.entries()) {
    if (!candidate.chainId || !candidate.tokenAddress || candidate.verificationStatus !== 'verified_live_market') continue;
    const key = candidate.chainId;
    const existing = byChain.get(key) ?? [];
    existing.push({ index, candidate });
    byChain.set(key, existing);
  }

  await Promise.all([...byChain.entries()].map(async ([chainId, entries]) => {
    try {
      const batch = await fetchDexScreenerTokenBatch(chainId, entries.map((entry) => entry.candidate.tokenAddress!));
      await Promise.all(entries.map(async ({ index, candidate }) => {
        const pairs = batch[candidate.tokenAddress!.toLowerCase()] ?? [];
        const pair = bestPair(pairs);
        if (!pair) return;
        const orders = await fetchDexScreenerOrders(chainId, candidate.tokenAddress!);
        output[index] = withDexScreenerData(candidate, pair, orders);
      }));
    } catch {
      // Fail open. Unicorn Radar must render without market enrichment.
    }
  }));

  return output;
}
