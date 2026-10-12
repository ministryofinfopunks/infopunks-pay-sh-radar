# Track A commit integration ledger — 2026-10-11

Repository: ministryofinfopunks/infopunks-pay-sh-radar. One isolated local branch: `codex/track-a-staging-rc-20261011`. Base: `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`. `inspected-heads.json` captures freshly fetched remote tips and the distinct local E1 authority tips. Human authorization covers preparation and local security integration, not external activation. No independent feature approval is inferred from a branch name or passing test.

## Incorporated before this release

| Original / integrated commit | Change | Disposition |
|---|---|---|
| `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f` | Main baseline; canonical receipt spine, economic/IPX/accounting code | Ancestor of base. Existing financial code is retained inert; no financial deployment or activation. |
| `1c06aa2` → `03eac1d` | Paid judgment committed decision context v2 | Already incorporated. |
| `745c98c` → `1e607a1` | External verified execution score eligibility | Already incorporated. |
| `c56ca7e` → `5e298be` | Receipt score fixture matches eligibility policy | Already incorporated. |
| `37399ee` → `68c2148` | Classified artifacts and accepted-history boundary | Already incorporated. |
| `094826f` → `bd0dd80` | Bounded causal tape and signed witness replay | Already incorporated; publication stream defect repaired below. |
| `1b9a9ea`, `58b7a3c`, `b25a063`, `f27cc5c`, `f6b5de6` | Track A ledger, durability evidence, full 001–021 inventory, checksummed migration runner, UI truthfulness fixes and A5.1 evidence | Already incorporated. Preserve existing evidence; it qualifies its original SHA, not this new candidate. |

## Missing security work integrated here

| Source | Candidate commit | Scope and review boundary |
|---|---|---|
| `17dc30745d326de38fc4e584c691643b142a13ae` | `8cb38ba` | Reviewed Phase 6B.1 compatible dependency advisory remediation. Retain Track A migration scripts in package.json. |
| `dea57e07fde19c50d616fa996e873c1d7b2167d9` | `40a6a02` | Quarantine future issuer timestamps for every receipt kind; expose quarantine to replay. Preserve stronger existing classified-execution score test. |
| `d9065dc1682a22fc73c87b0d2a63bc4f0229e235` | `f270956` | Payment-only startup schema preflight; degraded read-only startup remains possible, readiness still fails safely. |
| `eeee995e964240e6ef2c659f18c83875c140a221` | `db5df81` | Port only canonical tape, receipt/journal, OpenAPI, migration 022 and regression changes. Exclude source commit's IPX evidence edit. Extend inventory/readiness/test expectations to 022. |
| Release security hardening | `f061ab4f3cda984e17e62cedb961fe2cbd752075` | Constant-time shared admin/reviewer comparison; production legacy writes require admin; production Evaluation writes and score routes fail closed pending E1 review. New production judgments reject contributing unreviewed history; previously issued commitments replay unchanged. Controlled staging denies all mutations except bounded pre-spend/decide free journals, rejects payment headers and activation settings. Pin Docker/runtime Node 24.21.0 and exclude secrets/build outputs from Docker context. |

The additive 022 migration is required for stable free-attempt/quarantine publication positions and historical receipt acceptance backfill. All 42 historical up/down files for 001–021 are byte-identical. The 73 original frozen evidence/artifact files are byte-identical; see their checksums. No original receipt bytes, signatures or prior context hashes are rewritten. Migration 022 and this security profile still require candidate review before any operator executes staging DDL.

## Conflicts and independently gated work

| Branch / commit | Finding | Disposition |
|---|---|---|
| Phase 6 integration `b640edfafc1e30e20309d0441e1153da3688faea` | Contrary to the old frozen report, **not ancestral to main and not incorporated**. Main lacks its 16-file inspector/Phase 5 harness change. `git merge-base --is-ancestor` exits 1; direct diff confirms missing files. | Do not silently merge its new public chain inspector, UI, injected clock or proof harness. Existing canonical service replay/durability tests are retained and rerun. This reporting correction does not overwrite frozen evidence. |
| Phase 6B.1 `d0d6081cbb9e965571dda53d268c9cfddf35d6b2` | Its parent dependency fix was missing from Track A. Its earlier 17-migration and browser/runtime conclusions do not qualify this candidate. | Dependency fix integrated; historical preflight report remains branch evidence only. |
| `dea57e0` score test overlap | Incoming test expected bare admin Evaluation to contribute zero; base already tests a qualifying classified execution contributing +5. | Keep base test unchanged, retain existing negative eligibility coverage; conflict resolved without weakening policy. |
| E1 independent/durability `b9597fc0388d5f08ea1a611b50e12fcab7102fd9` | Candidate reviewer-attestation authority, not approved activation. Its `20261009_018` migration collides with Track A's existing `20261008_018`; full branch also inherits model shadow code and overlaps app/config/services/OpenAPI/tests. | Excluded. Do not renumber or rewrite applied 018. A later separately reviewed E1 release needs a fresh migration number, immutable reviewer/rubric snapshots, sidecar replay and PostgreSQL qualification. Evaluation/reputation production authority stays closed here. |
| E1 freeze `3e3cd831875ddaf8951e0cc35f5cd11abe4d3a5c`; local readiness `30a005bdde5d52bc9fb805106bd2985c87aa108e`; remote readiness `32bcf68104d70e478706bb8fff92c91c4b2308b9` | Real evidence, independent reviewers, archived rubric/cohort and provider-run gates remain unfulfilled. Local readiness has extra provider-preflight work beyond the remote tip. | Excluded, independently gated. No provider calls or synthetic evidence promotion. |
| Decisions ancestry `1088a6c`, `c1b3c4f`, `40423cd`, `6174a07`, `13da61b`, `3a93867`, `a52a6b4`, `32bcf68`, `30a005b`, `3e3cd83` | Optional model shadow adapter; synthetic corpus; runner and reports; no approved independent causal result. Public remote corpus/benchmark tips `b8ea7cc`/`ee32dbf` differ from cherry-picked E1 lineage. | No model feature integrated. `OPENAI_DECISIONS_SHADOW_ENABLED=false`, provider secrets absent. Model output cannot authorize spend or Evaluation. |
| Intelligent UI PR #6 `11bbaa4f39af9067758c33861073dcc5e0d28993` | GitHub snapshot: OPEN, DRAFT, unmerged; base f6b5de6; no reviews/comments. Public Decision View has no tenant isolation; exposure gate explicitly open. Overlaps app/OpenAPI/receipt tests and UI. | Entire PR excluded, no merge, no new Decision View route. Requires public-data policy approval or authenticated authorization in a separate review. |
| IPX `d03bf51`, `c279830`/`d768a80`; economics/conservation branches | Identity/Genesis/treasury and financial changes are independently gated. The newer `f6e2019` dependency tree is an alternate financial candidate, not this release's baseline. | Excluded. Use narrowly ported canonical fixes and Phase 6B.1 dependency lock only. No IPX/PLTR operations changed. |

No GitHub push, PR creation, merge, deployment, production credentials, paid provider requests or transaction broadcast occurred. The user's original dirty checkout is untouched; all release work is in the attached worktree.
