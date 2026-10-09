# Frozen IPX candidate evidence — 9 October 2026

## Scope

- Candidate source: `eeee995e964240e6ef2c659f18c83875c140a221` (`codex/ipx-integration-candidate`), parent `d9065dc1682a22fc73c87b0d2a63bc4f0229e235`.
- The candidate source worktree was clean after removing its temporary dependency symlink. This evidence report and its run files are on a separate evidence branch and do not alter the candidate SHA.
- Toolchain: Node `v25.6.1`, npm `11.9.0`, PostgreSQL `14.20`, Foundry `1.5.1-stable`.
- No production mutations, transfers, deployments, migrations, key signing, or economic activation were performed.

## Implemented packages

A4 deterministically classifies evaluation outcomes from bounded raw `task-output.v1` bytes bound to execution identity and response hash. It preserves the artifact, byte hash, derived classification and reviewer challenge metadata in the immutable evaluation receipt. A submitted label alone does not qualify.

A5 adds server acceptance sequence and time, future-time quarantine, and frozen v2 decision-context projection boundaries. A6 exposes paginated O/J/X/E receipts with parent closure, free insufficiency attempts, a signed witness bundle, and an offline verifier. Migration `20261008_022_publication_boundaries` backfills server acceptance for existing receipts and adds monotone positions for free attempts and quarantines.

The final A6 repair makes each publication manifest carry three boundaries: `accepted_through`, `free_attempts_through`, and `quarantine_through`. All three are required to replay a complete view. Supplying only `accepted_through` creates a stable receipt-only view. Receipt, attempt and quarantine writers serialize their own position assignment; sequence gaps from idempotent conflicts are allowed and do not change old manifests. An unsequenced receipt fails closed from publication. Migration rollback refuses to discard published positions.

## Exact revision checks

| Check | Result | Evidence file |
| --- | --- | --- |
| Full app suite, with disposable PostgreSQL URLs | 268 test files passed; 1,895 passed, 1 skipped of 1,896 | `runs/ipx-eeee995-2026-10-09/full-suite.log.gz` |
| PostgreSQL resilience/failure matrix | 16 passed, 0 failed, 0 skipped | `runs/ipx-eeee995-2026-10-09/postgres-resilience.log` |
| Typecheck | PASS | `runs/ipx-eeee995-2026-10-09/ipx-eeee995-typecheck.log` |
| Lint | PASS | `runs/ipx-eeee995-2026-10-09/ipx-eeee995-lint.log` |
| Production build | PASS; large-chunk advisory emitted | `runs/ipx-eeee995-2026-10-09/ipx-eeee995-build.log` |
| Foundry contracts | 6 passed, 0 failed, 0 skipped | `runs/ipx-eeee995-2026-10-09/ipx-eeee995-foundry.log` |
| PostgreSQL migrations | All 22 up migrations applied; 46 tables | `runs/ipx-eeee995-2026-10-09/ipx-eeee995-migrations.log` |
| Migration 022 rollback guard | Rejected rollback with `published tape positions must not be discarded`; sequence column remained | `runs/ipx-eeee995-2026-10-09/ipx-eeee995-migration-down.log` |
| Backup/restore | Isolated schema dump restored; immutable attempt hash and sequence `1` present | `runs/ipx-eeee995-2026-10-09/ipx-eeee995-restore.log`, `ipx-eeee995-schema.dump` |
| Dependency audit | 11 total advisories; production-only 8 | `runs/ipx-eeee995-2026-10-09/ipx-eeee995-npm-audit*.json` |

The restore artifact is a local disposable PostgreSQL backup, not a production backup. The application-role permission check and production database restore remain unverified.

## Migration spot check

Before migration 022, an isolated schema held one legacy observation, one free attempt and one quarantined receipt. Migration 022 assigned one acceptance position and stable stream positions to all three; the reproducible command output is `runs/ipx-eeee995-2026-10-09/ipx-eeee995-backfill.log`. The full empty-schema migration run applied 22 up files in filename order and created 46 base tables. A separate dump/restore retained the free-attempt row, its digest and its publication position. All test schemas and the disposable restore database were dropped afterward.

## Independent replay review

A separate verification agent checked the exact `eeee995` source and migration 022. Its independent probe captured historical manifest hash `sha256:955c3c0b…`; after adding a later free attempt and quarantine row, replaying the three saved boundaries returned the same hash, while the current manifest advanced to `sha256:1e919fad…`. The reviewer reported no ordering defect: free-attempt and quarantine writers serialize position assignment; sequence gaps do not alter a saved maximum boundary; all three streams are filtered before page construction. This is an independent review note, not a cryptographic signature or external publication.

## Public availability observation

At `2026-10-09 04:51:43 UTC` (`10:21:43 Asia/Colombo`), read-only HTTPS requests to `/health`, `/status`, `/v1/ipx/launch`, and `/v1/ipx/economy/summary` returned HTTP 503 with `x-render-routing: suspend`. All four bodies had SHA-256 `e5805ccce9532a696c4103997ad9e6d34037dfac71e46dd615641cd7869b3956`. `/v1/radar/benchmark-summary` returned HTTP 429 during the same burst and its body hash is `4360661fdb0fc689b32a48e9fd150cfea05c4a34bdffe1fe47090b8a426d930d`; this does not establish its normal route response. Response headers and bodies are retained in the run directory.

The suspension header is consistent with a suspended Render route but does not identify who suspended it or why. No Render account, deployment logs, DB connectivity, deployed revision, or operator event access was available. The root cause is therefore not guessed.

## Security and source limits

`npm audit` counted 8 high, 2 moderate and 1 low advisory in the full dependency tree; production-only counted 7 high and 1 low. The production build has a chunk above 500 kB. Foundry used the preloaded ignored OpenZeppelin tree; repository setup pins upstream commit `c64a1edb67b6e3f4a15cca8909c9482ad33a02b0`, but a fresh upstream clone was unavailable, so this run does not independently verify the cached dependency's origin. These items require review before G4/G5.

## C1 verdict and limits

C1 passes for local reproducibility on the one frozen code SHA. It does not prove production version parity, role grants, healthy deployment, route availability, canonical live assets, or real settlement. The full suite included one skipped test; the separate resilience run covered 16 additional cases. The build and test logs, migration/restore artifacts and audit snapshots are checksummed in `runs/ipx-eeee995-2026-10-09/SHA256SUMS`.
