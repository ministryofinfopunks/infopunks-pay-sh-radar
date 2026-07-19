export type CacheMetadata = {
  hit: boolean;
  stale: boolean;
  generatedAt: string;
  ttlMs: number;
  ageMs: number;
  status: 'miss' | 'fresh' | 'stale_while_revalidate' | 'stale_if_error';
  provenance: string;
};

export type CacheResult<T> = {
  value: T;
  metadata: CacheMetadata;
};

type CacheEntry<T> = {
  value: T;
  createdAtMs: number;
};

export type CachePolicy = {
  freshTtlMs: number;
  staleWhileRevalidateMs?: number;
  staleIfErrorMs?: number;
  maxStaleMs?: number;
  provenance?: string;
};

export type ResponseCache = {
  getOrSet<T>(key: string, policy: number | CachePolicy, computeFn: () => Promise<T> | T): Promise<CacheResult<T>>;
};

export function createResponseCache(options: { now?: () => number } = {}): ResponseCache {
  const cache = new Map<string, CacheEntry<unknown>>();
  const refreshes = new Map<string, Promise<unknown>>();
  const now = options.now ?? Date.now;

  async function getOrSet<T>(key: string, input: number | CachePolicy, computeFn: () => Promise<T> | T): Promise<CacheResult<T>> {
    const policy = normalizePolicy(input);
    const checkedAtMs = now();
    const existing = cache.get(key) as CacheEntry<T> | undefined;
    const ageMs = existing ? Math.max(0, checkedAtMs - existing.createdAtMs) : 0;

    if (existing && ageMs <= policy.freshTtlMs) {
      return {
        value: existing.value,
        metadata: metadata(existing, policy, ageMs, 'fresh')
      };
    }

    if (existing && ageMs <= Math.min(policy.maxStaleMs, policy.freshTtlMs + policy.staleWhileRevalidateMs)) {
      if (!refreshes.has(key)) {
        const refresh = computeAndStore(key, computeFn);
        void refresh.catch(() => undefined);
      }
      return { value: existing.value, metadata: metadata(existing, policy, ageMs, 'stale_while_revalidate') };
    }

    try {
      const value = await computeAndStore(key, computeFn);
      const createdAtMs = (cache.get(key) as CacheEntry<T>).createdAtMs;
      return {
        value,
        metadata: metadata({ value, createdAtMs }, policy, 0, 'miss')
      };
    } catch (error) {
      if (existing && ageMs <= Math.min(policy.maxStaleMs, policy.freshTtlMs + policy.staleIfErrorMs)) {
        return {
          value: existing.value,
          metadata: metadata(existing, policy, ageMs, 'stale_if_error')
        };
      }
      throw error;
    }
  }

  function computeAndStore<T>(key: string, computeFn: () => Promise<T> | T): Promise<T> {
    const existing = refreshes.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const computation = Promise.resolve(computeFn()).then((value) => {
      cache.set(key, { value, createdAtMs: now() });
      return value;
    }).finally(() => refreshes.delete(key));
    refreshes.set(key, computation);
    return computation;
  }

  return { getOrSet };
}

function normalizePolicy(input: number | CachePolicy): Required<CachePolicy> {
  if (typeof input === 'number') {
    return { freshTtlMs: input, staleWhileRevalidateMs: 0, staleIfErrorMs: Number.POSITIVE_INFINITY, maxStaleMs: Number.POSITIVE_INFINITY, provenance: 'memory' };
  }
  return {
    freshTtlMs: Math.max(0, input.freshTtlMs),
    staleWhileRevalidateMs: Math.max(0, input.staleWhileRevalidateMs ?? 0),
    staleIfErrorMs: Math.max(0, input.staleIfErrorMs ?? 0),
    maxStaleMs: Math.max(0, input.maxStaleMs ?? 0),
    provenance: input.provenance ?? 'memory'
  };
}

function metadata<T>(entry: CacheEntry<T>, policy: Required<CachePolicy>, ageMs: number, status: CacheMetadata['status']): CacheMetadata {
  return {
    hit: status !== 'miss',
    stale: status === 'stale_while_revalidate' || status === 'stale_if_error',
    generatedAt: new Date(entry.createdAtMs).toISOString(),
    ttlMs: policy.freshTtlMs,
    ageMs,
    status,
    provenance: policy.provenance
  };
}
