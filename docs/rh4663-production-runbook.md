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

## Railway parity and traffic migration

This pass prepares configuration only. A passing local build does not mean a
Railway deployment or database migration has occurred. Keep infrastructure
migration separate from application protocol/receipt-schema changes.

Use the existing Dockerfile (`npm run build`, `npm start`); Fastify listens on
`0.0.0.0` and the injected `PORT`. Railway consumes ordinary environment variables;
no Railway SDK, hard-coded hostname, or credential is required. Preserve all
existing feature flags, tokens, signing material, RPC URLs and origin settings.
`ADMIN_TOKEN` is supported; the existing `INFOPUNKS_ADMIN_TOKEN` alias remains
supported, with `ADMIN_TOKEN` taking precedence.

Required bindings (use Railway's actual PostgreSQL connection binding):

```text
NODE_ENV=production
PORT=<platform-assigned port>
DATABASE_URL=<Railway PostgreSQL URL>
PAYSH_CATALOG_SOURCE=live
PAY_SH_CATALOG_URL=https://pay.sh/api/catalog
PAYSH_ALLOW_FIXTURE_FALLBACK=false
PAY_SH_INGEST_INTERVAL_MS=300000
ADMIN_TOKEN=<existing admin token>
```

Unsafe production catalog/database configuration fails startup with
`INVALID_RUNTIME_CONFIGURATION` and variable names/codes, never secret values.
There is no local HTTP exception in production. Catalog fetch/parse/empty/stale
failures retain unavailable/degraded evidence and never substitute fixtures.
The catalog freshness budget is 10 minutes (generation time if supplied and
last ingestion time); keep the ingestion interval within that budget. Historical
machine-market policy metadata remains caveated metadata, never live catalog proof.

`/healthz` confirms process liveness only. `/readyz` returns HTTP 503 with
machine-readable `reasons` for database/schema failure, pending migrations,
unsafe production bindings, missing dependencies, fixture evidence, or catalog
failure/staleness. It reads the existing external-only migration signatures and
bootstrap schema; it never applies migrations. Monitor both endpoints and use
readiness as the promotion gate. Missing optional admin/reviewer settings can
leave public routes alive while production readiness remains blocked.

Operator procedure, in order:

1. Provision Railway PostgreSQL without changing existing production traffic.
2. Create and verify a recoverable source backup using the existing guarded
   production restoration procedure in `docs/render-production-runbook.md`.
   Restore/copy it to the separate empty target with the operator's established
   PostgreSQL backup tooling. Never drop, clean, reset, or overwrite the source.
   Rehearse restoration and compare canonical receipt counts/integrity. A live
   copy needs a controlled write freeze/final synchronization before cutover;
   never assume a snapshot captures later receipts.
3. From an operator-controlled checkout, run the existing migration status
   command against the target and apply only pending reviewed additive `.up.sql`
   files in order with `psql` and `ON_ERROR_STOP=1`, following the restoration
   runbook's per-migration checks. Do not replay applied migrations. Confirm
   `npm run rh-chain:migration-status -- --require-ready --environment=production`.
4. Deploy the same reviewed API commit and Dockerfile with the bindings above.
5. Check target `/healthz` and `/readyz`; both must return HTTP 200 before promotion.
6. Against the target run `SMOKE_BASE_URL=<target URL> npm run smoke:production`
   and the existing production verification/parity checks. Compare route status
   codes, response shapes, and public evidence to the current host. Do not enable
   optional smoke writes against production without a controlled rehearsal.
7. Verify existing canonical receipts re-read identically; use an authorized
   staging receipt flow and process restart to verify durable writes. Check any
   configured JSONL receipt storage separately: container-local files need
   durable storage or the existing PostgreSQL adapter. Do not alter receipt schema.
8. Verify `/v1/pulse` and `/health` report live Pay.sh provenance, no fixture use,
   fresh ingestion, and expected provider counts. Rehearse catalog/database
   outage in staging: liveness stays 200, readiness becomes 503, no fixtures appear.
9. Only after parity, durable receipts, and live evidence pass, finalize write
   synchronization and change traffic/DNS. Prevent duplicate worker execution;
   preserve existing advisory leases and worker settings.
10. Keep the original host and verified backup available for rollback. Revert
    traffic/application to the prior host/commit if gates fail. Reconcile any
    target-only writes before rollback; never discard receipts or run destructive
    down migrations as an application rollback. Record operator timestamps,
    target commit, backup identifier, parity results, and the actual cutover.

## Canonical receipt authority rollout (Phase 1)

After Phase 0 gates pass, follow [canonical receipt spine](canonical-receipt-spine.md) for the separate application authority change. Apply `20261007_011_canonical_receipt_spine.up.sql` using the external migration procedure before deploying this API version. Verify all five tables' immutability triggers and the application role's privileges. Test authenticated four-receipt append, read, restart/replay and evaluation-derived score. Public legacy intake cannot update reputation. Production deployment/data migration has not been performed by this configuration change.

For rollback, restore prior traffic/code and preserve the canonical tables and receipts. The down migration refuses populated receipt memory; do not delete receipts to bypass it. Historical legacy records are not automatically promoted into canonical authority.
