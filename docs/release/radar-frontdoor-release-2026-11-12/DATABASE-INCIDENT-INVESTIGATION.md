# Database and startup incident record

**Scope:** evidence inventory for release review, 2026-11-12. This is a source and historical-record review, not a new production investigation. No Render, database, environment, deploy, or DNS operation was performed.

## Findings and confidence

### 1. November 4 missing `judgment_requests` relation and circuit opening — confirmed historical observation

The November 3 visitor qualification record describes PostgreSQL returning SQLSTATE `42P01` for `select record from judgment_requests where request_key=$1` because `public.judgment_requests` was absent. The application then counted the relation error toward the shared database failure threshold and opened the circuit. Its preceding PostgreSQL backend terminations are separate events; the record does not establish that they caused the missing relation. The later clone rehearsal found migration `20261007_012_judgment_requests.up.sql` absent and applied it to that clone only. That rehearsal does not establish the present production schema.

Evidence: `docs/reviews/visitor-qualification-2026-11-03.md`, including its November 4 addenda. No current database query was made for this release.

### 2. November 4–5 PostgreSQL SIGKILLs and snapshot writes — termination confirmed; cause unconfirmed

The historical Render support brief records PostgreSQL backend processes terminated by SIGKILL while snapshot JSONB insert statements were running. It inventories at least 8,063 snapshot rows, a maximum observed JSON row of 2,856,189 bytes, approximately 9,988 MB in the table and an approximately 11 GB table size. A separate local synthetic snapshot was 2,654,390 bytes; that is not a measured parameter from a killed production statement. The accompanying PR #35 record describes monitor persistence failures around a roughly 15-minute scheduler cadence and a November 5 application heap observation near 1.26 GB (about 1.76 GB total process memory).

The records establish timing/correlation between snapshot writes and observed database process termination. They do not identify the SIGKILL sender or prove that JSON size, memory pressure, a PostgreSQL defect, application workload, or a platform action caused termination. Historical runtime logs show an app pool max of 2, 2,500 ms connection timeout and 10,000 ms idle timeout, with no attached Render pooler and database `max_connections=103`. No pool wait/queue metrics establish that checkout contention caused the timeouts or backend kills. Broken checked-out clients were marked broken and released so `pg-pool` could discard them; the cited local resilience checks did not reproduce a pool lifecycle defect. None of these historical observations qualifies current pool behavior.

Evidence: `docs/reviews/render-postgres-sigkill-support-brief.md` and `docs/reviews/pr-35-release-recovery.md`. No current telemetry was retrieved.

### 3. November 7 catalog/analytics memory exhaustion — owner-provided report, not independently corroborated here

The owner reports that database connectivity recovered on November 7 and the application later exhausted memory during catalog/analytics initialization. The current main-based checkout did not contain matching November 7 platform logs or a contemporaneous incident record during this review. Treat the date and sequence as owner-provided historical context; exact process/RSS metrics, exception, and causal contribution from catalog, analytics, or a particular intelligence desk remain unverified. No evidence in this review singles out Robinhood Signal Desk as the root cause.

### 4. Current source-level startup costs — directly inspected

In normal mode, `createApp()` proceeds into database-backed repository/store construction, creates the configured database pool, starts `createIntelligenceStore(repository)` when no store is preloaded, and invokes `ensureLiveBootstrap('startup')` unless the existing bootstrap configuration suppresses it. The store-load completion calls `refreshBackgroundAnalytics()`.

Normal-mode background paths include Pay.sh ingestion and monitor interval jobs; RH Chain automation jobs and receipt-draft cron; optional IPX/PLTR shadow observation (which is invoked immediately and then on an interval); plus feature-specific 4663 and related workers. Bootstrap and route handlers can additionally hydrate the catalog or refresh analytics. These paths and their implementations remain in source.

When `RADAR_FRONTDOOR_ONLY=true`, `createApp()` returns before those normal-mode constructions and hooks. The front-door tests spy on `getDatabasePool` and observe zero calls; the service-status response reports `dbMode: not_initialized` and `persistence: not_initialized`. It does not report successful persistence.

## Historical milestones supplied for context

These milestones are not evidence of present production readiness:

- **August 17, 2026:** local Git history verifies commit `ec75c3891c5fe1df919e91f7ec88af27bb484a87`, “fix: make Radar resilient to PostgreSQL failures.” The reported public memory-mode snapshot of 74 providers and 718 endpoints with ingestion disabled was supplied by the owner; no contemporaneous public response was rechecked in this review.
- **August 18, 2026:** the owner reports migrations 002–006 applied and RH tables/indexes verified, followed by an approximately 44-minute PostgreSQL soak with `dbMode=postgres`, a healthy circuit, and pool max 2. This review did not re-query that historical database or logs.
- **August 31, 2026:** the owner reports the public surface continued to show fixture-backed or stale information. No current public-domain availability claim is made here.
- **September 2026:** the owner reports RHJ, PLTR preflight, clone/pool verification, holder data, and receipts in the broader RH system. This release does not qualify those paths.

## Investigation still required before full-stack activation

1. Obtain platform/database evidence for the SIGKILL actor and resource conditions around each timestamp; avoid inferring cause from SQL text correlation.
2. Verify the target database schema and migration ledger, including migration 012 and `judgment_requests`, using an approved read-only procedure; reconcile any schema drift before writes.
3. Measure snapshot payload size distribution and write frequency from source records; inspect monitor/snapshot retention and transaction patterns without deleting data.
4. Measure application heap/RSS and phase timing during catalog bootstrap, startup-store hydration, analytics generation, and each worker initialization. Compare the same workload with individual subsystems disabled only in an isolated qualification environment.
5. Capture pool acquisition, wait, timeout, retry/circuit and recovery-probe evidence. Historical pool max 2 does not qualify current pool behavior.
6. Exercise full-stack activation against an isolated, migration-verified database with provider/network/payment actions controlled. Confirm each worker's intended environment switches and persistence semantics before production activation.

**Conclusion:** Multiple failures were observed historically: a missing schema relation affected a judgment query and circuit state; PostgreSQL backends were separately killed during snapshot-write periods; and an owner-reported later application memory exhaustion followed database recovery. The available records do not establish one shared cause or implicate Signal Desk as the root cause.
