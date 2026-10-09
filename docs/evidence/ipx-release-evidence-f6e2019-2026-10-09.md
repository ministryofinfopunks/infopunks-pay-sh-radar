# Frozen IPX candidate evidence — `f6e2019`

## Scope

- Frozen source commit: `f6e201963e0beaed0ec2bcc291fb07c04ca67b7b` on `codex/ipx-release-candidate-f6e2019`.
- Parent: `eeee995e964240e6ef2c659f18c83875c140a221`. This is a lockfile-only security update over the preceding fully tested candidate. Application and migration source files are unchanged from `eeee995`.
- The full suite below ran against the committed lockfile contents under Vitest 5.0.3. Typecheck, lint, build, Foundry, migration and restore checks were rerun against this revision.
- Toolchain: Node `v25.6.1`, npm `11.9.0`, PostgreSQL `14.20`, Foundry `1.5.1-stable`; locked test tools include Vitest `5.0.3`, Vite `8.3.4`, Fastify `5.12.5`.
- No production database, service, contract, key, facilitator, signer or funds were changed.

## Changes since `eeee995`

`npm audit fix` refreshed only `package-lock.json` (`runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-npm-audit-fix.log`). The previous 8 high, 2 moderate and 1 low advisory count fell to zero high, zero moderate and one low. The remaining low advisory is `esbuild`'s local development-server file read issue on Windows; it remains present in the production dependency graph because the current lock resolves `esbuild@0.27.7` through Vite/tsx. No high or moderate advisory remains in either the full or production-only audit.

Vitest 5 warns that Node `25.6.1` is outside its declared engine range (`^22.12.0 || ^24.0.0 || >=26.0.0`). The full run completed successfully on Node 25, but a run on a declared supported Node runtime is still needed for a strict toolchain parity result. Vite's build emits a config-loader compatibility warning and a large client chunk warning; the build succeeds.

## Exact revision checks

| Check | Result | Evidence file |
| --- | --- | --- |
| Full app suite with disposable PostgreSQL URLs | 268 files passed; 1,895 passed, 1 skipped of 1,896. The skip is the separately configured real PostgreSQL resilience test. | `runs/ipx-f6e2019-2026-10-09/full-suite.log.gz` |
| PostgreSQL resilience/failure matrix | 16 passed, 0 failed, 0 skipped with `POSTGRES_RESILIENCE_TEST_URL` set | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-postgres-resilience.log` |
| Typecheck | PASS | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-typecheck.log` |
| Lint | PASS | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-lint.log` |
| Production build | PASS; Vite compatibility/chunk warnings | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-build.log` |
| Foundry | 6 passed, 0 failed, 0 skipped | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-foundry.log` |
| PostgreSQL migrations | All 22 up migrations applied; 46 base tables | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-migrations.log` |
| Migration 022 legacy backfill | Existing receipt, free attempt and quarantine received stable positions | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-backfill.log` |
| Migration 022 rollback guard | Refused loss of published positions; sequence column remained | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-migration-down.log` |
| PostgreSQL backup/restore | Dump restored; immutable attempt digest and sequence `1` remained | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-restore.log`, `ipx-f6e2019-schema.dump` |
| Dependency audit | 1 low advisory; 0 high/moderate; same result with production-only audit | `runs/ipx-f6e2019-2026-10-09/ipx-f6e2019-npm-audit*.json` |

The PostgreSQL backup/restore artifact is local and disposable, not a production backup. The database-role permission check and production restore remain unverified.

## Publication manifest replay review

The separate verification agent independently checked `eeee995`, whose application source is unchanged in this lockfile-only successor. Its probe captured historical manifest `sha256:955c3c0b…`; after a later free attempt and quarantine row, replay using all three returned boundaries remained at the same hash while the latest manifest advanced to `sha256:1e919fad…`. The review found no ordering defect in the receipt, attempt or quarantine position streams. This note is independently reviewable but not cryptographically signed; an external transparency mirror remains outstanding.

## Current public availability

At `2026-10-09 05:08:36–05:08:47 UTC` (`10:38:36–10:38:47 Asia/Colombo`), sequential read-only requests to `/health`, `/status`, `/v1/ipx/launch`, `/v1/ipx/economy/summary`, and `/v1/radar/benchmark-summary` all returned HTTP 503 with `x-render-routing: suspend`. All five response bodies had SHA-256 `e5805ccce9532a696c4103997ad9e6d34037dfac71e46dd615641cd7869b3956`. The individual headers and bodies are preserved in the run bundle.

The response is consistent with a suspended Render route but does not reveal the reason or actor. Render operator logs, deployed revision, database state and billing/service events were unavailable; no root cause is guessed. The C2 recovery runbook is `ipx-c2-availability-and-recovery-2026-10-09.md`.

## C1 verdict and limits

C1 local application/build/migration checks pass on one exact source SHA. The declared-engine mismatch for Vitest 5 on Node 25 is an open parity caveat; repeat on Node 24 or 26 before promotion. A passing local test is not evidence of a healthy deployment, production database role, canonical live route, legal approval or economic activation. Foundry used a cached ignored OpenZeppelin source tree; the configured upstream pin was not freshly fetched, so this run does not independently prove that cache's origin.

The checksummed bundle is `runs/ipx-f6e2019-2026-10-09/SHA256SUMS`. Its checksum is included in the evidence manifest. The previous `eeee995` evidence report and checksums remain available for historical comparison and are not combined with this candidate's result counts.
