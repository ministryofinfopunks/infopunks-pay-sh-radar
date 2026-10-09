# IPX critical-path execution ledger

Evidence is recorded against its exact source commit. The frozen local integration revision is `eeee995e964240e6ef2c659f18c83875c140a221`. It is a clean source commit in `codex/ipx-integration-candidate`; the evidence package is committed separately and does not change the code under test. No result from `d9065dc` is used to pass the `eeee995` checks.

| Workstream | Status at frozen revision | Source commit | Evidence | Remaining blocker |
| --- | --- | --- | --- | --- |
| A1 | Complete | `cdd2500` | `ipx-baseline-2026-10-08.md` | Baseline limitations recorded there. |
| A2 | Complete | `1c06aa2` | `ipx-a2-completion-2026-10-08.md` | None for package scope. |
| A3 | Complete | `745c98c` | `ipx-a3-score-eligibility-2026-10-08.md` | Transaction attempt identity is a known model limitation. |
| A4 | Implemented and integrated | `37399ee` ancestor | `ipx-a4-a5-completion-2026-10-08.md` | Real task output and reviewer provenance still required for G0. |
| A5 | Implemented and integrated | `d9065dc` ancestor | `ipx-a4-a5-completion-2026-10-08.md` | Production application-role migration proof remains unavailable. |
| A6 | Implemented; manifest replay defect repaired | `eeee995` | `ipx-a6-local-proof-2026-10-08.md`, `ipx-release-evidence-eeee995-2026-10-09.md` | No real bounded route, external public mirror or measured improvement series. |
| B1–B4 | Local protocol work complete | `d768a80` ancestor | `ipx-b-protocol-completion-2026-10-08.md` | B3 finalized live settlement/cost evidence and B4 reviewed manifest/activation remain blocked. |
| C1 | PASS for local reproducibility at frozen revision | `eeee995` | `ipx-release-evidence-eeee995-2026-10-09.md` and checksummed run bundle | Production runtime and role parity cannot be inferred from local tests. |
| C2 | Read-only public diagnosis recorded | `eeee995` | `ipx-c2-availability-and-recovery-2026-10-09.md` | Render operator status, deploy events and suspension reason require authorized account access. |
| C3 | Local disposable migration, durability and restore rehearsal passed | `eeee995` | Run bundle and release evidence report | Staging clone and restricted production-role checks remain blocked. |
| C4–C6 | Not cleared | `eeee995` | Economic dependency register | Canonical asset/venue proof and separate operator approvals required; C6 is operator gated. |
| D1–D2 | Decision and scenario materials prepared | `b7d9601` ancestor | `ipx-d1-economic-decision-record-2026-10-08.md`, `ipx-d2-conservation-2026-10-08.md` | Written model selection, approved variables and independent arithmetic review required. |
| D3–D4 | Conditional, not activated | — | `ipx-economic-release-dependencies-2026-10-08.md` | Depend on approved model choice and external review. |
| D5 | Release dependency registered; publication/legal gate not passed | — | `ipx-economic-release-dependencies-2026-10-08.md` | Reviewed finalized ledger, asset evidence, legal scope and responsible authorities required. |
| G0–G6 | BLOCKED | `eeee995` | `ipx-gate-matrix-eeee995-2026-10-09.md` | See individual gate reasons; G6 cannot pass on mixed or synthetic evidence. |

## Exact-revision automated evidence

The full application suite passed at `eeee995`: 268 files, 1,895 passed, 1 skipped (1,896 total). `POSTGRES_RESILIENCE_TEST_URL` run: 16/16 passed. Typecheck, lint and production build passed. Foundry: 6/6 passed. All 22 up migrations applied in an isolated PostgreSQL 14.20 schema, producing 46 tables. A `pg_dump`/restore check retained an immutable free-attempt row and its publication sequence. The full log bundle, audit JSON, SQL outputs and restore dump have SHA-256 checksums under `runs/ipx-eeee995-2026-10-09/`.

One full-suite attempt used a disposable server on port 55465 that stopped accepting connections, yielding 12 PostgreSQL-backed file failures. The candidate was unchanged; the complete rerun against the local PostgreSQL 14.20 service on port 5432 passed. Only the successful exact-revision run is used as C1 evidence.

`npm audit` reported 11 advisories (8 high, 2 moderate, 1 low); production-only reported 8 (7 high, 1 low). The build emitted the existing large-chunk warning. The Foundry run used the locally cached, ignored OpenZeppelin source tree; a fresh fetch of the configured upstream pin was unavailable, so provenance of that external dependency is not independently established by this run.

No production database, service, route, contract, key, facilitator, signer or funds were changed. The live availability check is read-only. G0–G6 remain BLOCKED as detailed in the gate matrix.
