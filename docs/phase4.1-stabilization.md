# Phase 4.1 stabilization evidence

No evaluation architecture or production performance code changed for this phase. EvaluationService remains the authoritative emitter. Unsupported external evaluator signatures fail closed; internal authenticated provenance is used for local proof.

## Changes

PostgreSQL tests own UUID schemas and release migration clients. Failed rollback migrations use a pinned client and explicitly roll back before release. Receipt-spine tests initialize their own history rather than depending on execution order. Default five-second test timeouts are preserved.

The version-change test uses a fixed diagnostic performance clock: measured source latency otherwise changes its semantic health fingerprint even when underlying fixtures are unchanged. No Robinhood/IPX production functionality was modified.

The benchmark is separate from Vitest so full-suite CPU/database contention does not become a performance assertion. Run `CANONICAL_RECEIPT_TEST_URL=<local disposable database> npx tsx scripts/benchmark-derived-score.ts`. It rejects nonlocal databases and competing test/compiler processes. Each path uses 30 warmups and 300 samples, with 100 historical evaluations. Fresh paid judgments include PostgreSQL observation lookup, receipt verification, projection, policy, journal, and canonical receipt persistence. The official x402 gateway uses a deterministic local facilitator; service timing excludes verification/settlement latency. No external economic proof is claimed.

## Original failures

All five suites passed individually before fixes. Three PostgreSQL failures were five-second timeouts during concurrent full-suite activity. The economic fixture failed observation-after-ingestion validation during concurrent fixture edits and was already corrected by its owning work before this phase. The version-change assertion was reproducibly nondeterministic when diagnostic source latency varied; only its test clock was stabilized. Prior type/build failures were concurrent settlement edits, already corrected without changes from this phase. The prior 216.72 ms judgment p95 was not reproduced in isolation.

## Database and migration

Validation uses local PostgreSQL 14.20 in the disposable infopunks_phase41_test database, with individually owned schemas. Migration validation applies 001 through 014 from clean storage, checks indexes, exercises empty rollback/reapply and populated rollback refusal, then replays a complete contradicted chain and its -15 projection. Migration 014 is not deployed to production.

Actual read queries are captured and EXPLAIN ANALYZE results are saved in output/phase4.1/query-plans.json. The verified projection join was under one millisecond in the pilot; point lookups used their existing indexes, with sequential scans appropriate for tiny observation tables. No speculative indexes or projection cache were added.

## Reproducible final gate

Run typecheck, lint, full tests with four workers, build, and diff-check in that order. Configure CANONICAL_RECEIPT_TEST_URL, ECONOMIC_ENGINE_TEST_URL, and POSTGRES_RESILIENCE_TEST_URL for the disposable local database. Run the controlled benchmark separately afterward. Evidence is saved in output/phase4.1; final-gate.json records status, counts, checkout fingerprints and competing-workload observations. Any changing source invalidates the gate.

Production limitations: unsupported external evaluator signatures; local validation does not prove production migration deployment, external settlement, or performance at larger receipt histories. Phase 5 and Railway deployment are outside this phase.

## Completion result

Phase 4.1 stabilization gate: FAIL. Three serialized runs passed typecheck, lint, full tests, build and diff-check, with no competing compiler/test processes recorded. The latest run passed 1,864 tests with zero failures and zero skips, but source fingerprints changed during every run. Latest contention files were src/api/ipxLaunchRoutes.ts and migrations/20261008_016_ipx_launch.up.sql / .down.sql. These edits belong to the active Build IPX Launch Infrastructure chat and were preserved. A run against one unchanged checkout is still required before Phase 5. See output/phase4.1/completion-report.json for the final controlled benchmark, audit, test evidence and gate fingerprints. No production optimization or deployment occurred.
