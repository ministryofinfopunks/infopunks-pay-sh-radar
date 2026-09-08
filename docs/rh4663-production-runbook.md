# //4663 production runbook

## SLO contract

| Surface | Target | Measured |
| --- | --- | --- |
| `GET /v1/4663/frontdoor` availability | 99.9% | Inspect deployment metrics; never infer from local tests. |
| Warm frontdoor server p95 / p99 | <300ms / <800ms | `rh4663_frontdoor_request` and internal metrics. |
| Mobile LCP / CLS / INP | <2.5s / <0.1 / <200ms | Browser/RUM instrumentation required; lab values are not field values. |
| Immutable OG cache-read p95 | <500ms | CDN/server load profile. |

## Cache and durability matrix

The executable matrix is `RH4663_ROUTE_CACHE_MATRIX` in `src/services/rh4663CachePolicy.ts`.

- `PUBLIC_CACHEABLE`: frontdoor, global pulse, mutable share/proof objects. Public frontdoor varies only on content encoding and has an ETag; it never varies by cookie, wallet, authentication, or local follow state.
- `PUBLIC_IMMUTABLE`: canonical receipt/proof/resolution artifacts and frozen share snapshots.
- `PRIVATE_NO_STORE`: `/v1/4663/me/*` and wallet-scoped overlays.
- `ADMIN_NO_STORE`: `/internal/4663/*`; reviewer authentication is required.

Wallet-only proof URLs are current profiles, not permanent historical snapshots: they use a short shared TTL and profile-version ETag. Immutable historical proof cards must use a frozen share object ID.

Production requires durable Postgres for frontdoor version/change events, Census and Shadow observations, CALL/RESOLUTION/Genesis receipts, frozen Radar observations, required frozen share/proof snapshots, and Phase 10.1 Product Intelligence primitives. Apply migration `20260908_010_rh4663_product_intelligence.up.sql` before enabling the observation window. Product Intelligence retains only 90 days of categorical/pseudonymous loop primitives; it is never read by public evidence or protocol paths. Missing required durability fails closed. Memory stores are development/test fallbacks only.

## Health and degradation

`/healthz` is liveness only. `/readyz` describes persistence readiness and should be monitored separately. Optional providers do not fail liveness.

Frontdoor sources publish `health_state`: `HEALTHY`, `STALE`, `DEGRADED`, or `UNAVAILABLE`, with current observation time, attempt/success time, source budget, and a safe failure class. Natural stale clocks are Pulse 10 minutes, Watch/Preflight 6 hours, and Census/Signals 24 hours. A stale observation is never presented as fresh. Each source read is capped at 250ms and all reads run in parallel; a timeout yields partial state rather than a request stall.

For a frontdoor issue, inspect `X-Frontdoor-Version`, ETag behavior, `rh4663_frontdoor_request`, and the authenticated `/internal/4663/frontdoor/metrics` response. Do not retry public reads to repair data. Diagnose/repair the owning worker or reviewer workflow.

## Workers, refreshes, and incidents

PLTR Shadow timers use a Postgres advisory lease in production, so replicas cannot concurrently observe/replay the same state. The worker remains status-only, uses frozen candidate hashes, and requires durable storage/RPC when enabled. If it reports an error, inspect the sanitized status, database readiness, and RPC configuration; do not change candidates or evidence policy as remediation.

Census refresh remains reviewer-initiated and durable. Public reads never call RHJ, chain reconstruction, Census refresh, Preflight, or research APIs. For an RHJ/RPC/provider outage, retain persisted evidence and allow source health to become stale/degraded.

CALL failure diagnosis: inspect rate-limit response, window state, canonical payload validation, signature binding, and duplicate-window result. Never replay a signed write blindly. Admin actions require review credentials and must never put tokens or secret material in client bundles/logs.

For OG/share failure, validate the internal share ID and persisted source object. OG rendering reads persisted/read-model state only; it must not call chain, refresh research, or fetch remote assets. A failed image does not invalidate the canonical deep link.

## Deployment and rollback

Required production configuration: `DATABASE_URL`, `PORT`, `RH_CHAIN_REVIEW_ADMIN_TOKEN`, `RH_4663_RESOLUTION_PRIVATE_KEY`, `RH_CHAIN_RPC_URL` when Shadow observations are enabled, `FRONTEND_ORIGIN`, admin settings, worker interval/capacity-sweep flags, public base/share host, and cache/telemetry settings. Never record values in this document or logs.

Run `npm run verify:runtime-config`, migration/readiness checks, the focused test suite, and the GET-only load profile before promotion. Roll back HTTP hardening with `RH_4663_FRONTDOOR_HARDENING_ENABLED=false`; it changes cache behavior only. No rollback drops data, changes receipts, or invalidates old deep links.

SSE is deliberately deferred. ETag revalidation is the portable default; a durable event fan-out layer is not yet justified. Product telemetry is best-effort and must not gate responses.

### Phase 10.1 incident-isolation and promotion gate

Treat a non-200 current production health response as an incident in the
currently deployed release. Do not apply `20260908_010` or deploy Phase 10.1
as a speculative repair: that would make the cause of a recovery ambiguous.

The required order is:

1. Restore the *current* deployed release. Confirm both `GET /healthz` and
   `GET /readyz` return HTTP 200 before changing the schema.
2. From an operator-controlled production migration environment, apply
   `20260908_010_rh4663_product_intelligence.up.sql` once. It is additive and
   the old application must remain healthy while the new table is unused.
3. Verify the migration ledger, the Product Intelligence table and indexes,
   database connectivity, unchanged canonical tables, and `GET /readyz` still
   returning HTTP 200. Check database monitoring for lock or latency impact.
4. Deploy the Phase 10.1 application. Verify readiness first, then the
   public frontdoor, private overlays, CALL configuration, immutable and
   mutable OG/share surfaces, and reviewer-authenticated Product Intelligence
   read. Its initial aggregate state may correctly be `INSUFFICIENT_DATA`.
5. Deliberately exercise the existing analytics-failure injection or an
   equivalent controlled failure. A dropped analytics write must not affect
   frontdoor, CALL, receipt, resolution, Proof, or Campaign behavior.

For an application rollback, roll back the application first. Do not run the
`010` down migration merely because the application was rolled back: it may
already contain valid analytics events, and leaving an additive unused table
is safer. Schema reversal requires an explicit operational decision accepting
the loss of those analytics events; canonical receipts and evidence are not
part of either decision.
