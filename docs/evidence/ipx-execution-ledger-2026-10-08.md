# IPX critical-path execution ledger

Frozen integration target: pending. This ledger records evidence by commit and does not combine gate claims from different revisions.

| Workstream | Status | Commit SHA | Tests | Evidence | Blocker |
| --- | --- | --- | --- | --- | --- |
| A1 | Complete | `cdd2500` | Focused baseline suite | `ipx-baseline-2026-10-08.md` | Baseline was dirty before isolated capture |
| A2 | Complete | `1c06aa2` | Full suite and PostgreSQL durability | `ipx-a2-completion-2026-10-08.md` | Acceptance sequence deferred to A5 |
| A3 | Complete | `745c98c` | Focused eligibility/projection suite, typecheck, PostgreSQL durability | `ipx-a3-score-eligibility-2026-10-08.md` | Transaction log/attempt identity is unavailable in the current receipt model |
| A4 | Implemented, validation pending frozen integration | pending | Focused classification and PostgreSQL checks | `ipx-a4-a5-completion-2026-10-08.md` | Real output provenance and independent review remain G0 gates |
| A5 | Implemented, validation pending frozen integration | pending | Acceptance, replay and migration checks | `ipx-a4-a5-completion-2026-10-08.md` | Full frozen candidate and production role proof pending |
| A6 / G0 / G1 | Local proof package implemented; gates HOLD | pending | Witness, tape, free-attempt and disposable PostgreSQL tests | `ipx-a6-local-proof-2026-10-08.md` | Real bounded route, signer registry and public external artifacts required |
| B1–B4 | Parallel package | | | | Separate worktree |
| C1 | Delegated | | | | Read-only discovery |
| C2–C6 | Pending or operator gated | | | | Authorized infrastructure access required |
| D1–D5 | D1/D2 package at `b7d9601`; rest gated | | | | Economic selection/review required for activation |
| G2–G6 | Pending | | | | Approval, venue, legal/security and production evidence required |
