# //4663 production hardening

## SLOs and measurement

The initial targets are 99.9% front-door availability, warm-cache server p95 below 300ms, p99 below 800ms, mobile LCP below 2.5s, CLS below 0.1, and INP below 200ms. They are targets, not claimed results. `rh4663_frontdoor_request` emits measured server duration, frontdoor version, cache outcome, response state, source health, card count, and open-loop count. The reviewer-only `/internal/4663/frontdoor/metrics` endpoint exposes process-local request, percentile, cache-hit, partial-response, and source-failure counters.

Use `BASE_URL=https://staging.example REQUESTS=100 CONCURRENCY=10 npm run load:4663` against staging only. It performs GET requests only and profiles anonymous frontdoor, ETag revalidation, consumer landing, OG, and global Pulse reads. Add `PROFILES=private INCLUDE_PRIVATE=1` only to verify private overlay behavior with an authenticated test harness; the profile does not create calls or write data.

## Cache and degradation policy

`/v1/4663/frontdoor` is identity-free and uses ETag plus `public, max-age=15, s-maxage=15, stale-while-revalidate=45, stale-if-error=300`. It varies only on `Accept-Encoding`. Shared data is assembled from persisted/read-model sources; it never reads follow, wallet, draft CALL, balance, or portfolio state. `/v1/4663/me/*` remains `private, no-store` and is never a CDN candidate. Immutable share objects and OG images use long immutable caching; mutable share objects use short revalidation. Consumer landing HTML remains revalidated rather than shared as a personalized page.

Sources resolve independently. Census, Watch, Preflight, Pulse, and Signals report `HEALTHY`, `DEGRADED`, or `UNAVAILABLE` internally; the consumer sees a calm partial/degraded state and the actual observation freshness. A failed provider cannot promote an assertion to VERIFIED. The frontdoor uses a 15-second persisted-read-model cache, so it does not trigger Census refresh, Preflight, chain reconstruction, or external research calls per request. Existing provider timeout/retry/cache controls remain the circuit boundary for external integrations.

SSE is deliberately not enabled: the current 15-second ETag path gives a safe fallback and the present topology has no durable fan-out requirement. Add SSE only after a durable event transport is operationally justified.

## Durability, indexes, rollback

Production frontdoor versioning requires durable Postgres state and fails closed if it cannot persist. Change events, Census observations, Shadow observations, CALL/RESOLUTION receipts, and public proof read models use their existing durable stores when production Phase 2/Shadow capabilities are enabled. Required schema absence returns a controlled 503, not an ephemeral substitute. Query-backed indexes cover CALL `(window_id, created_at)`, receipt wallet/window lookup, resolution window linkage, latest Census observation, frontdoor version, and recent change events. They use `CREATE INDEX IF NOT EXISTS` and are additive.

Set `RH_4663_FRONTDOOR_HARDENING_ENABLED=false` for a safe HTTP-cache rollback; evidence assembly, versions, receipts, and migrations remain unchanged. Migrations are additive and no hardening path writes canonical evidence. Rollback therefore needs no data reversal.

## Deployment and security checklist

Production requires `DATABASE_URL`, `PORT`, `RH_CHAIN_REVIEW_ADMIN_TOKEN`, and `RH_4663_RESOLUTION_PRIVATE_KEY` for Phase 2; Shadow observations additionally require `RH_CHAIN_RPC_URL`. Configure `FRONTEND_ORIGIN`, `INFOPUNKS_ADMIN_TOKEN`, and public rate-limit settings. Run observation workers separately from web workers. Never expose any signing/private/admin value to the browser.

API responses set `X-Content-Type-Options: nosniff` and a strict referrer policy. CORS remains allowlisted. Public CALL payload and submit endpoints are rate-limited. Share routes validate internal canonical identifiers and render persisted, sanitized text only. CSP remains an HTML-shell concern until nonce support is introduced; adding an unsafe blanket policy would not improve protection.
