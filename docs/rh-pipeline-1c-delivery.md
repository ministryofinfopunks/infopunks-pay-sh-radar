# RH-PIPELINE-1C — completed UTC-day factual editions

**Code and local PostgreSQL integration: PASS. Staging and production: HOLD.** This is a separately frozen local qualification scope, not certification by an external reviewer.

## Qualified source and ancestry

Independent 1C source: `f5713126b340faba437dfd0df34a375a46844d9b`, retained in the attached detached qualification worktree. Feature commit: `210e9757dbe604c6f45849ab6e2f0bc12271e0d9`. Parent release baseline: `c6fe7a2ec68d6821af0ead2a69acc7833fe142fe`, whose qualified code is Category `f128d4fa70076cee513745efaad7b0fd120fa9c4` / `955dd214301f38dabf5b050ac9ae2d2b36559eea`, descending from qualified 1B `59aa25bd28a6e001fa52fbfa8f13eea2e3d04eac` through `7effafb37f3f8aebd529ad13e90d87222189ba05`. Baseline passed before dependent implementation.

Final combined source `d6ee38f45f512957f53a8a27d30cbdf3cf337c9c` includes 1D's compact published-edition projection and a portable canonical JSON key serializer that avoids host locale dependence. It separately passes all 2,012 combined cases. Full changed-file lists and migration SHA-256 ledger are in `evidence/rh-pipeline-1c/qualification.json` and `evidence/rh-pipeline-1d/candidate-ledger.json`.

## Result and authority boundaries

`AUTOMATED_OBSERVATION_RECEIPT` records chain 4663, unique UTC day, explicit completed `[00:00, next 00:00)` window, exact contracts and pools, source/evidence identities, observed versus collected timestamps and timestamp basis, metric samples, deterministic endpoint changes, retained history references, coverage gaps, schema/calculation versions, SHA-256 content commitment, frozen publication state and additive correction references. Execution authorization is always false.

The service reuses the qualified market history and UTC-day observations. It adds no collection provider, market scoring authority, reviewed judgment, reputation mutation or spending authority. Missing metrics are null. Rolling volume/transaction endpoint changes are not daily sums, capital flow or investment returns. Collection-day aggregates do not prove observation-day raw history; pruned/raw-unavailable data carries explicit gaps and cannot manufacture a delta. Corporate-action history, RWA mechanism evidence and verified stable supply remain explicit unsupported inputs.

Stable day IDs, a unique canonical-day index, unique day/content commitments, transaction locks and atomic inserts prevent concurrent workers or retries from producing a second canonical edition. Canonical reruns return the frozen edition before rereading late data. Corrections require an existing same-day parent plus a reason; they append rather than rewrite. Conflicting exact pair/contract/quote identities are rejected, while duplicate symbols retain exact identity. Testnet 46630 never enters mainnet editions.

The scheduler catches up completed retained days and yesterday on startup, then retries every five minutes through the existing lifecycle. Scheduler errors abort that attempt and are retried. No current unfinished UTC day is finalized. Raw evidence replay is synthetic in this qualification; live provider backfill remains staging work.

## Migrations, gates and rollback

Migration `20261013_025_rh_automated_observation_receipts` adds receipt and publication-ledger tables, indexes, parent references and UPDATE/DELETE immutability triggers. The service fails closed when the receipt immutability guard is missing or disabled. All 19 migrations were applied in the frozen 1C PostgreSQL qualification; final integration has 20 including 1D migration 026. Exact migration hashes are in the ledger.

Defaults remain `RH_OBSERVATION_SCHEDULER_ENABLED=false`, `RH_OBSERVATION_PUBLICATION_ENABLED=false`, `RH_OBSERVATION_PRODUCTION_AUTHORIZATION=null`. Scheduling requires durable history/database configuration. Public publication independently requires durable storage, the explicit publication flag and an authorization reference. The configuration reference is an operational gate, not an approval system: operators must separately obtain and retain production authorization. It has not been supplied or enabled here.

Public `GET /v1/4663/daily-observations/:date` exposes published editions only, with commitment ETag and short shared caching. Internal finalization remains protected and private/no-store. The synthetic preview manually marks an isolated memory fixture as published with `SYNTHETIC_VISUAL_FIXTURE_ONLY`; this cannot activate automated public publication. Divergent published correction tips yield no selected summary, rather than an arbitrary winner.

Rollback first disables scheduler/publication flags and returns application code to the integrated baseline. Preserve finalized rows and use forward repair. The down migration refuses populated immutable state; it is tested only for empty schemas. Never delete historical editions to roll back. Reviewer Daily Receipts, RH Pulse CALL/RESOLUTION, canonical Radar judgments and IPX economics remain outside this contract.

## Qualification evidence

Frozen 1C full suite: **2,006 passed, zero failed, zero skipped across 274 files**, with explicit local PostgreSQL URLs for canonical receipts, economics and resilience. Typecheck, lint and server/client builds PASS. See `frozen-tests.json`, `full-suite.log`, `typecheck.log`, `lint.log`, `build.log` in `evidence/rh-pipeline-1c/`. PostgreSQL 14 was a disposable loopback-only cluster; test schemas are isolated and cleaned up.

Cases cover twelve concurrent finalizers, atomic write failure, process/service restart, scheduler failure/retry, same-day correction concurrency, frozen replay under late evidence, source outage, null metrics, timestamp proxies, pruned history, contradictory identities, testnet exclusion, immutable hashes/guards, rollback refusal and public/private caches. `frozen-synthetic-editions.json` contains the frozen sample receipts and corrections; `synthetic-editions.json` contains combined-source replay evidence.

Earlier runs are retained honestly: `initial-integration.json` has one obsolete migration-count assertion failure, fixed in source; `resource-contention-full-suite.json` records inherited timeout failures under concurrent compiler/test load. The complete frozen-source rerun above passes without source changes. Final-source serializer/projection behavior is covered by the separately passing combined suite.

Local qualification supports further release review only. Missing RWA/Stock Token evidence blocks dependent backing/reference/corporate-action judgments, not supported fact-only records. Real provider collection, production PostgreSQL migration rehearsal, historical provider replay, outage recovery/SLO evidence and explicit publication authorization remain unfulfilled staging/activation gates. Nothing was pushed, remotely merged, deployed or enabled.
