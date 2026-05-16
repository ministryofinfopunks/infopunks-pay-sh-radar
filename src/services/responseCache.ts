export type CacheMetadata = {
  hit: boolean;
  stale: boolean;
  generatedAt: string;
  ttlMs: number;
};

export type CacheResult<T> = {
  value: T;
  metadata: CacheMetadata;
};

type CacheEntry<T> = {
  value: T;
  createdAtMs: number;
};

export type ResponseCache = {
  getOrSet<T>(key: string, ttlMs: number, computeFn: () => Promise<T> | T): Promise<CacheResult<T>>;
};

export function createResponseCache(): ResponseCache {
  const cache = new Map<string, CacheEntry<unknown>>();

  async function getOrSet<T>(key: string, ttlMs: number, computeFn: () => Promise<T> | T): Promise<CacheResult<T>> {
    const now = Date.now();
    const existing = cache.get(key) as CacheEntry<T> | undefined;

    if (existing && now - existing.createdAtMs <= ttlMs) {
      return {
        value: existing.value,
        metadata: {
          hit: true,
          stale: false,
          generatedAt: new Date(existing.createdAtMs).toISOString(),
          ttlMs
        }
      };
    }

    try {
      const value = await computeFn();
      const createdAtMs = Date.now();
      cache.set(key, { value, createdAtMs });
      return {
        value,
        metadata: {
          hit: false,
          stale: false,
          generatedAt: new Date(createdAtMs).toISOString(),
          ttlMs
        }
      };
    } catch (error) {
      if (existing) {
        return {
          value: existing.value,
          metadata: {
            hit: true,
            stale: true,
            generatedAt: new Date(existing.createdAtMs).toISOString(),
            ttlMs
          }
        };
      }
      throw error;
    }
  }

  return { getOrSet };
}
