export type Rh4663CacheClass = 'PUBLIC_CACHEABLE' | 'PUBLIC_IMMUTABLE' | 'PRIVATE_NO_STORE' | 'ADMIN_NO_STORE';

/**
 * Auditable policy registry. Route handlers remain responsible for concrete
 * headers, but every 4663 surface has an explicit cache ownership class.
 */
export const RH4663_ROUTE_CACHE_MATRIX: ReadonlyArray<{ route: string; cache_class: Rh4663CacheClass; rationale: string }> = [
  { route: '/v1/4663/frontdoor', cache_class: 'PUBLIC_CACHEABLE', rationale: 'Identity-free read model with ETag and short SWR.' },
  { route: '/v1/4663/pulse', cache_class: 'PUBLIC_CACHEABLE', rationale: 'Global consensus only; no participant state.' },
  { route: '/v1/4663/share/:shareObjectId', cache_class: 'PUBLIC_CACHEABLE', rationale: 'Immutable snapshots are long cached; current snapshots revalidate.' },
  { route: '/v1/4663/me/*', cache_class: 'PRIVATE_NO_STORE', rationale: 'Wallet, follow, and local-first overlay projection.' },
  { route: '/v1/4663/pulse/receipts/:receiptId', cache_class: 'PUBLIC_IMMUTABLE', rationale: 'Canonical signed receipt.' },
  { route: '/v1/4663/receipts/:receiptId', cache_class: 'PUBLIC_IMMUTABLE', rationale: 'Canonical receipt/resolution read model.' },
  { route: '/og/4663/proof/:wallet.png', cache_class: 'PUBLIC_CACHEABLE', rationale: 'Current wallet profile; never immutable at a wallet-only URL.' },
  { route: '/og/4663/share/:shareObjectId.png', cache_class: 'PUBLIC_CACHEABLE', rationale: 'Snapshot class determines long immutable vs short cache.' },
  { route: '/internal/4663/*', cache_class: 'ADMIN_NO_STORE', rationale: 'Authenticated reviewer/operations surfaces.' }
] as const;

export function rh4663CacheClassForPath(path: string): Rh4663CacheClass {
  if (path.startsWith('/internal/4663/')) return 'ADMIN_NO_STORE';
  if (path.startsWith('/v1/4663/me/')) return 'PRIVATE_NO_STORE';
  if (/^\/v1\/4663\/(?:pulse\/)?receipts\//.test(path)) return 'PUBLIC_IMMUTABLE';
  if (path.startsWith('/og/4663/proof/')) return 'PUBLIC_CACHEABLE';
  return 'PUBLIC_CACHEABLE';
}
