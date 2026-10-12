# Track A local qualification evidence

Implementation/source freeze: `f061ab4f3cda984e17e62cedb961fe2cbd752075`. Evidence-only files and deployment review templates follow without changing the tested application, tests, lockfile, Dockerfile or migration bytes. `check-results.json` records exact commands, exit codes and durations. Text logs have trailing whitespace normalized for review; JSON reports retain the tool output. A final branch-tip verification certificate, if present in `output/frozen-verification`, identifies the immutable reviewable candidate SHA separately.

| Required gate | Result | Evidence |
|---|---|---|
| Typecheck | PASS | `logs/typecheck.txt` |
| Lint | PASS | `logs/lint.txt`; repository lint is TypeScript checking, no separate ESLint configuration |
| Production build | PASS with warning | `logs/build.txt`; patched Vite emits a 2,399.60 kB minified Radar chunk (402.65 kB gzip), above the existing 500 kB warning threshold. Final browser/container performance remains unmeasured. |
| Complete tests | PASS; **274 files, 1,951 tests, zero skips/failures** | `logs/full-tests.txt`, `full-tests.json` |
| Dedicated durability/replay/negative authorization/resilience | PASS; **26 files, 154 tests, zero skips/failures** | `logs/durability-replay-negative.txt`, `durability-replay-negative.json` |
| PostgreSQL durability | PASS within disposable local scope | Canonical receipts, payment journal with mocked facilitator, execution-proof uniqueness, economic-engine memory, signed issuer reload, accepted-history, v2 context/witness replay, legacy v1/017 upgrades and runner tests all executed. No production financial deployment. |
| Migration 001–021 validation | PASS; all original up/down bytes unchanged | `migration-checksums.json`; historical 017/020 adoption, drift/unknown-history refusal, failed-DDL retry, concurrency, immutability, signed legacy receipt preservation tested. |
| Additive migration 022 | PASS | Complete 001–022 CLI apply/check/repeat: 22 applied, 22 history rows, zero pending/errors; `migration-first.json`, `migration-validate.json`, `migration-repeat.json`. Readiness checks new publication indexes. |
| Dependency audit | Production PASS, 0 findings; all-dependencies 1 low dev-only finding | `audit-production.json`, `audit-all.json` and final `logs/audit-*.txt`. All-dependency audit exits 1 for esbuild Windows development-server file read, GHSA-g7r4-m6w7-qqqr. Linux staging runs compiled API, no Vite/tsx server. No high/critical waiver or forced incompatible override. |
| Replay and backup/restore | PASS; synthetic local chain only | `recovery-before.json`, `recovery-after.json`, `recovery-commands.json`: pg_dump/pg_restore into a fresh local DB, identical canonical receipt digest, valid issuer signature/ancestry, identical complete score projection/hash and v2 tape manifest, 22 ledger rows. No private key exported. |
| Negative authorization | PASS | `tests/security/controlled-staging.test.ts`, production health tests, execution-proof and score-authority suites; correct/wrong/absent admin cannot open staging mutations, unsigned production Evaluation rejected, unreviewed contributing history rejected before new payment/receipt, prior receipt replay retained. |
| Fixture/stale/missing DB/unsupported intent | PASS for code boundaries | Existing env/production readiness tests reject fixture fallback, stale or unavailable catalog and DB; canonical judgment evidence matrix abstains on invalid intent/evidence. Controlled staging test checks unsupported intent, no payment challenge, same-key replay/conflict, shared rate limit and absent PR #6 endpoint. No live staging catalog was queried. |
| Frozen evidence | PASS | `preserved-frozen-evidence.json`: 73 prior evidence/artifact files byte-identical. Historical conclusions are not silently rewritten or reused as new-SHA proof. |
| Whitespace/diff | PASS | `logs/diff-check.txt`; no source changes after source freeze |
| Linux Docker image / Railway / staging database / live catalog / ongoing alerts | NOT RUN; HOLD | No Docker engine or approved staging bindings supplied. No deployment/provisioning/production access attempted. |

Runtime: downloaded official Node **24.21.0**, npm 11.9.0 on macOS arm64; PostgreSQL **14.20** Homebrew. Docker build/runtime now specify `node:24.21.0-slim`; local node parity is not Linux/container parity. Three purpose-created local DBs contain no production data; the resilience termination harness used its own disposable database and had no skips. Full tests ran with one worker and a 30-second test timeout; no competing compilation/build load.

Vitest JSON reports nested describe suites separately (552/52 suite units); terminal file totals are 274/26. All test totals match. The first recovery helper import failed before DB writes because TypeScript fixtures compile as CommonJS; the corrected helper and final recovery succeeded. The full production audit is clean; the development audit finding is explicitly retained as a limitation.

No local result establishes staging, real settlement, independently reviewed outcome truth, causal improvement or production readiness. See `release-manifest.json` for exact HOLD blockers and independent feature gates, and `railway-staging-runbook.md` for rollout/rollback steps.
