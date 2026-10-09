# Test and skip disposition

Initial full PostgreSQL-backed run: 269 files / 1,893 tests passed; one existing `judgment-payment-durability` test exceeded Vitest's default 5-second timeout under concurrent load. No tests were skipped. This result is recorded as a timeout, not suppressed.

Repeat with `--testTimeout=30000`: **270 files passed, 1,894 tests passed, zero failed, zero skipped**. Environment variables `CANONICAL_RECEIPT_TEST_URL`, `ECONOMIC_ENGINE_TEST_URL`, and `POSTGRES_RESILIENCE_TEST_URL` all pointed only to disposable local PostgreSQL 14.20 database `track_a_qual_20261009`. Mock/test facilitator only; no live settlement.

`npm run typecheck`, `npm run lint`, `npm run migrations:validate`, migration status with `DATABASE_URL` (21 applied, zero pending), and `npm run build` completed successfully before the final documentation commit. Build emitted a Vite warning that the `radarApp` JavaScript chunk is about 1.29 MB minified. These commands are repeated against the final frozen SHA; results are recorded in the final qualification report.

Browser screenshots were captured from the local candidate build for six routes at desktop and mobile sizes. Chrome console shows a pricing-data fallback warning; Chrome headless GPU mailbox noise also appears in some logs. No automated accessibility, performance, visual-diff, or per-request network suite is installed. Railway deployment, actual staging live-catalog freshness, external settlement/task proof, independently reviewed external Evaluation, physical backup/restore, and operational rollback rehearsal are not run and remain gates.
