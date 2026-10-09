# IPX critical-path execution ledger

Evidence is recorded against its exact source commit. The current frozen local integration candidate is `f6e201963e0beaed0ec2bcc291fb07c04ca67b7b` on `codex/ipx-release-candidate-f6e2019`. The previous `eeee995` evidence remains in the run archive as the pre-security-update candidate; no checks from that SHA are used to claim checks passed on `f6e2019`.

| Workstream | Status at current frozen revision | Source commit | Evidence | Remaining blocker |
| --- | --- | --- | --- | --- |
| A1 | Complete | `cdd2500` | `ipx-baseline-2026-10-08.md` | Baseline limitations recorded there. |
| A2 | Complete | `1c06aa2` | `ipx-a2-completion-2026-10-08.md` | None for package scope. |
| A3 | Complete | `745c98c` | `ipx-a3-score-eligibility-2026-10-08.md` | Transaction attempt identity remains a model limitation. |
| A4 | Implemented and integrated | `37399ee` ancestor | `ipx-a4-a5-completion-2026-10-08.md` | Real task output and reviewer provenance required for G0. |
| A5 | Implemented and integrated | `d9065dc` ancestor | `ipx-a4-a5-completion-2026-10-08.md` | Production application-role migration proof unavailable. |
| A6 | Implemented; publication replay defect repaired | `eeee995` ancestor | `ipx-a6-local-proof-2026-10-08.md`; `ipx-release-evidence-f6e2019-2026-10-09.md` | No real bounded route, public external mirror or measured improvement series. |
| B1–B4 | Local protocol work complete | `c279830` | `ipx-b-protocol-completion-2026-10-08.md` | B3 live transfer/cost evidence and B4 approved manifest blocked. |
| C1 | PASS for local exact-revision reproducibility, with runtime caveat | `48969fb` + `f6e2019` | `ipx-release-evidence-f6e2019-2026-10-09.md` and checksummed run bundle | Node 25 is outside Vitest 5's declared engine range; production parity unknown. |
| C2 | Read-only suspended-route observation and recovery runbook | `48969fb` + `f6e2019` | `ipx-c2-availability-and-recovery-2026-10-09.md` | Render operator status, deploy events and suspension reason require authorized account access. |
| C3 | Local disposable migration, durability and restore rehearsal passed | `f6e2019` | Run bundle and release evidence report | Staging clone and restricted production-role checks remain blocked. |
| C4–C6 | Not cleared | `f6e2019` | `ipx-economic-release-dependencies-2026-10-08.md` | Canonical asset/venue proof and separate operator approvals required; C6 is gated. |
| D1–D2 | Decision and scenario materials prepared | `80c04c6` | `ipx-d1-economic-decision-record-2026-10-08.md`, `ipx-d2-conservation-2026-10-08.md` | Written model selection, approved variables and independent arithmetic review required. |
| D3–D4 | Conditional, not activated | — | Economic dependency register | Require approved model choice and external review. |
| D5 | Registered as a release dependency, not passed | — | Economic dependency register | Requires independently verifiable finalized ledger, legal scope and authorities. |
| G0–G6 | BLOCKED | `f6e2019` | `ipx-gate-matrix-f6e2019-2026-10-09.md` | See individual gate reasons; no mixed or synthetic evidence clears G6. |

No production database, service, route, contract, key, facilitator, signer or funds were changed. G0–G6 remain BLOCKED as detailed in the current candidate matrix.
