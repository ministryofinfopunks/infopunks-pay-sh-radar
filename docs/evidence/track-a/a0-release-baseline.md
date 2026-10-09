# Track A / Package A0 — frozen release baseline

**Decision: HOLD for production promotion and for any claim of a verified real-evidence learning loop.** The frozen checkout builds and passes the full local suite, but it does not establish a live, externally paid route, an independently reviewed outcome, a committed quote-time history snapshot, or a production deployment/database state. The browser/API gaps below are observed under credential-free local conditions: one reflexive audit call returns 409 (cause not established), and economic-memory APIs report unavailable without durable storage.

## Frozen checkout

| Item | Recorded value |
| --- | --- |
| Repository | `ministryofinfopunks/infopunks-pay-sh-radar` |
| Branch / worktree | `codex/track-a-launch-baseline` — `/Users/ahdilm/.codex/worktrees/track-a-launch-baseline` |
| Origin | `https://github.com/ministryofinfopunks/infopunks-pay-sh-radar.git` |
| Fetched `origin/main` SHA | `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f` |
| Validated `HEAD` SHA | `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f` |
| Node / npm | `v25.6.1` / `11.9.0` (package requires Node `>=20`) |
| Lockfile | `package-lock.json`, SHA-256 `9e9cfa70a4a439e96b4324ca4fbe28726d6883c25f68cbbcd187bf357fff203c` |
| Starting checkout | Main checkout was clean at the same SHA; no pre-existing edits were overwritten. |
| End-of-validation source | Same SHA; no tracked application source edits made. Deliverables are documentation and evidence only. |

The fetched remote SHA was recorded before creating the isolated worktree. `npm ci` used the committed lockfile; it reported 11 dependency advisories (1 low, 2 moderate, 8 high). No `npm audit fix` was run. See machine-readable results and retained logs in `docs/evidence/track-a/a0-test-results.json` and `output/track-a/a0/logs/`.

## Execution evidence

All listed commands ran in the isolated worktree. Full suite and the 15-file PostgreSQL subset used the same source SHA. A local Homebrew PostgreSQL 14.20 service was already available; A0 created a uniquely named disposable database `track_a_a0_20261009`, applied migrations in order, ran integration suites that created/dropped isolated schemas, and then dropped the disposable database. No production URL, private key, paid transaction, or production DB was accessed.

- `npm ci`: passed; lockfile install; 11 advisories reported.
- `npm run typecheck`: passed.
- `npm run lint`: passed (`tsc --noEmit --pretty false`).
- `npm test`: **251 files passed, 9 skipped; 1,855 tests passed, 19 skipped**. The skips are in the full run without DB URLs; database-backed suites were separately enabled below. Node emitted `--localstorage-file` warnings because that environment value was unset.
- `npm run build`: passed. Vite reports the existing 1.286 MB minified `radarApp` chunk above the 500 kB advisory threshold.
- PostgreSQL integration: **15 files, 33 tests passed, zero skipped**, with `CANONICAL_RECEIPT_TEST_URL` and `ECONOMIC_ENGINE_TEST_URL` pointing only to the disposable local database.
- Clean migration application: migration files `20260908_010` and `20261007_011` through `20261008_017` applied in order to an empty disposable database; all exited successfully. Separately, the complete ordered migration chain `001`–`017` also applied successfully to a second empty disposable database. Migration 010 emitted benign `already exists, skipping` notices for two columns within its own script. This verifies the ordered clean-schema application and the repository's dedicated migration/durability tests, not an operator's production ledger or every historical database version.
- `npm run smoke:backend` against `http://127.0.0.1:8787`: passed, including its graph-check POST.
- `npm run smoke:production` with `SMOKE_BASE_URL=http://127.0.0.1:8787`: passed. Its POST checks exercised only the local credential-free development process using in-memory/fixture data; they are not production evidence and did not pay a provider.
- Chromium browser QA: 20 captures (10 paths at desktop 1440×1000 and mobile 390×844), 18 document paths and OpenAPI JSON; details and response/error capture are in `a0-page-qa.md` and `output/track-a/a0/page-browser-results.json`.

The local app reported `persistence=memory`, DB degraded/unconfigured, `catalogSource=fixture`, 75 fixture providers, and no canonical receipt database. Any seeded loop cards shown in screenshots are UI fixture content only. No counts or outcomes from them qualify as real-evidence production results.

## Source comparison against F1–F7

The prior 8 October audit was authored against a moving worktree (`55f05d6…`) and explicitly called its validation non-frozen. This A0 independently checks the fetched frozen SHA. No F1–F7 finding is fully closed in the current source. F2, F6, and F7 are partially addressed by the external proof path/idempotency and individual receipt inspection primitives; F1, F3, F4, and F5 remain open. Exact owners, failing invariants, backward-compatible fixes, schema needs, and acceptance tests are in `a1-a3-remediation-map.md`. Existing strict receipt schemas, signed judgment support, external Base/RH proof verification, uniqueness guards for profiled proofs, and canonical evaluation-delta policy do not close the specific eligibility, frozen-history, reviewer-validation, or discovery invariants.

## Unverified production assumptions and dependencies

No production configuration, live catalog, provider execution, facilitator settlement, RPC finality, production signer registry, production database schema, deployment health, or source/artifact availability was inspected. The real experiment in `loop-001-experiment-spec.md` is a proposal with explicit gates, not a completed run. Launch remains HOLD until A1–A3 close their acceptance gates, production migration/readiness is independently operated, and the real O1→J1→X1→E1→J2 bundle passes independent replay and review.
