import pg from 'pg';
import type { RhChainCacheEntry, RhChainSnapshotStatus } from './rhChainLiveSnapshotService';

export type RhChainSnapshotCacheStatus = { status: RhChainSnapshotStatus | 'miss'; expires_at: string | null; fetched_at: string | null; durable: boolean };

/** Shared boundary for external context snapshots. Values never contain review or index decisions. */
export interface RhChainSnapshotCache {
  get<T>(key: string): Promise<RhChainCacheEntry<T> | null>;
  set<T>(key: string, value: RhChainCacheEntry<T>, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  getStatus(key: string): Promise<RhChainSnapshotCacheStatus>;
}

export class InMemoryRhChainSnapshotCache implements RhChainSnapshotCache {
  private readonly entries = new Map<string, RhChainCacheEntry<unknown>>();
  async get<T>(key: string) { return (this.entries.get(key) as RhChainCacheEntry<T> | undefined) ?? null; }
  async set<T>(key: string, value: RhChainCacheEntry<T>, _ttlMs: number) { this.entries.set(key, value); }
  async delete(key: string) { this.entries.delete(key); }
  async getStatus(key: string): Promise<RhChainSnapshotCacheStatus> { const entry = this.entries.get(key); return entry ? { status: new Date(entry.expires_at).getTime() > Date.now() ? entry.status : 'stale', expires_at: entry.expires_at, fetched_at: entry.fetched_at, durable: false } : { status: 'miss', expires_at: null, fetched_at: null, durable: false }; }
}

/** Safe fallback when durable infrastructure is unavailable. It intentionally does not imply durability. */
export class PlaceholderDurableRhChainSnapshotCache extends InMemoryRhChainSnapshotCache {}

export class PostgresRhChainSnapshotCache implements RhChainSnapshotCache {
  private readonly pool: pg.Pool;
  private schemaReady: Promise<void> | null = null;
  constructor(connectionString: string) { this.pool = new pg.Pool({ connectionString }); }
  async get<T>(key: string) { await this.ensureSchema(); const result = await this.pool.query('select entry from rh_chain_snapshot_cache where cache_key = $1', [key]); return (result.rows[0]?.entry as RhChainCacheEntry<T> | undefined) ?? null; }
  async set<T>(key: string, value: RhChainCacheEntry<T>, _ttlMs: number) { await this.ensureSchema(); await this.pool.query('insert into rh_chain_snapshot_cache (cache_key, entry, expires_at) values ($1, $2::jsonb, $3) on conflict (cache_key) do update set entry = excluded.entry, expires_at = excluded.expires_at', [key, JSON.stringify(value), value.expires_at]); }
  async delete(key: string) { await this.ensureSchema(); await this.pool.query('delete from rh_chain_snapshot_cache where cache_key = $1', [key]); }
  async getStatus(key: string): Promise<RhChainSnapshotCacheStatus> { const entry = await this.get<unknown>(key); return entry ? { status: new Date(entry.expires_at).getTime() > Date.now() ? entry.status : 'stale', expires_at: entry.expires_at, fetched_at: entry.fetched_at, durable: true } : { status: 'miss', expires_at: null, fetched_at: null, durable: true }; }
  private ensureSchema() { this.schemaReady ??= this.pool.query('create table if not exists rh_chain_snapshot_cache (cache_key text primary key, entry jsonb not null, expires_at timestamptz not null)').then(() => undefined); return this.schemaReady; }
}

export function createRhChainSnapshotCache(databaseUrl?: string | null): RhChainSnapshotCache {
  return databaseUrl ? new PostgresRhChainSnapshotCache(databaseUrl) : new PlaceholderDurableRhChainSnapshotCache();
}
