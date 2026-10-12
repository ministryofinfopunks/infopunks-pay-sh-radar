# Radar release integration ledger — 2026-10-12

## Candidate lineage

| Input | Exact revision | Relationship / decision |
|---|---|---|
| `codex/unified-radar` | `fefaa8e0dcdab26bc1370bbd507ad18e7e10cb42` | Integration starting point. Its parent is `d6112b5c8c56e75a8b33c238126a478277b3d0a1`; includes the unified UI, typed subject/policy/network boundary, private proof reads, route normalization and 022 publication boundary. |
| PR #7 `codex/pre-spend-launch-hardening` | `b3c9a94fb8b0ab0f8ad5e027ed45f63347f02c79`; implementation `b3c8ece9d1c76e2218d0eb119d2b880a4c671c1a` | Open PR, based on `codex/track-a-release-candidate` at `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`. Cherry-picked implementation and its source-validation report. |
| `codex/track-a-release-candidate` (local) | `62dbf6b28e75291e2a811ee8e9021b87c86e7afd` | Local UI successor, including PR #6; common ancestor with both inputs is `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`. This tip is not substituted for the Unified Radar starting point. |
| PR #6 `codex/intelligent-ui-v1-review` | `11bbaa4f39af9067758c33861073dcc5e0d28993` | Open and unmerged. Read-only Decision View branch; reviewed but not merged because its older public receipt projection does not supply the unified check/payment journey and its own contract leaves public tenant exposure as a deployment review item. |
| Phase 6B.1 staging preflight | `d0d6081cbb9e965571dda53d268c9cfddf35d6b2`; security code `17dc30745d326de38fc4e584c691643b142a13ae`; integration base `b640edfafc1e30e20309d0441e1153da3688faea` | Separate `main` lineage; merge base with Unified Radar is `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`. Reviewed as evidence only. Do not merge its migration history wholesale. |
| UI security follow-up | `d6112b5c8c56e75a8b33c238126a478277b3d0a1` | Already an ancestor of Unified Radar; preserves matched-route authorization through encoded URL variants and private proof-read cache controls. |
| Candidate branch base | `fefaa8e0dcdab26bc1370bbd507ad18e7e10cb42` | Isolated worktree `/Users/ahdilm/.codex/worktrees/radar-release-integration`; original branches/worktrees were left intact. |

PR #7 and Unified Radar share merge base `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`. The PR code change and source evidence were applied as commits (`b3c8ece…` and `b3c9a94…`) then reconciled with the newer Unified Radar behavior. The evidence from PR #7 describes that source branch only; it is not treated as qualification of this combined candidate.

## Conflict-resolution ledger

| Area | Resolution |
|---|---|
| `src/api/app.ts` | Retained private/no-store responses and authenticated operator gating for paid/signature-bearing requests. Enforced the same strict Zod request schema on both `/v1/pre-spend/check` and `/v1/decide`; kept typed domain validation and bounded rejection telemetry. Idempotency response headers are written only after Judgment returns successfully. |
| `src/services/judgmentService.ts` | Kept PR #7’s original decoded-payment hash proof on complete/settled replay, malformed decoded JSON rejection, strict request parsing and no-settlement recovery. Kept Unified Radar’s payment-stage telemetry, unique journal claim and explicit duplicate-prevention outcome. Ambiguous `settling` records remain pending reconciliation. |
| `src/api/openapi.ts` | Replaced the legacy hand-written request schema with the strict Zod-derived schema. Retained the subject/settlement network distinction, RH read-only abstention, and operator-authentication description; documented replay proof 401/403, private/no-store behavior and header bounds. |
| `tests/integration/pre-spend-payment.test.ts` | Combined proof-bound replay assertions for both aliases with the existing operator credential requirement. Tests include malformed, missing, alternate and original payment proofs and exactly one facilitator verification/settlement. |
| `package.json`, `package-lock.json` | Kept the Unified Radar lock and manifest, which already include the later patched Vite 8.3.4 dependency line and Node 24 project runtime. PR #7's lock changes were not transplanted over the newer dependency state. Re-audit the combined tree below. |
| PR #6 Decision View/UI | Not merged. Unified Radar has its own deterministic Spend Terminal and canonical judgment client. PR #6’s separate public projection predates the current private-read boundary and does not implement the needed authorized paid flow. No PR #6 migration is required. |

## Migration history review

- Selected history is the Unified Radar Track A lineage: migrations 001–021 inherited from `f6b5de6`, plus immutable source migration `20261008_022_publication_boundaries` from the unified staging successor. The candidate adds no migration.
- PR #7 and PR #6 add no migrations. No migration file is cherry-picked from either PR.
- Competing E1 branch `codex/e1-a-durability-qualification` contains `20261009_018_evaluation_reviewer_attestations`; selected Track A history contains `20261008_018_decision_context`. They share numeric prefix `018` but are distinct, competing histories. The E1 branch is excluded; no applied migration is renumbered or overwritten. The E1 branch also carries migration 023 and a separate Evaluation authority design, neither of which is adopted here.
- Phase 6B.1 is based on `main` and has its own earlier 013–017 sequence. It is not merged into the selected post-Track-A history.
- Verify all 22 selected migrations against disposable PostgreSQL using the migration inventory, first-apply, validate, repeat, ownership/constraint tests and backup/restore replay. Compare tracked migration source bytes and checksums before publishing this ledger’s final result.

## Authority and release constraints

The unified application remains the sole source for its canonical four-state Judgment. Legacy `data` diagnostics are not rendered as the authoritative verdict. A Judgment receipt records an assessment only; execution authorization remains separate. RH market inspection remains free, read-only, and abstains without a qualified action policy. Insufficient evidence remains free and receiptless.

The selected authorization model is operator-only for paid Judgment and private proof/receipt reads. There is no authenticated tenant identity or receipt-owner model on these branches. Therefore customer-specific tenant ownership, cross-tenant policy evaluation and public/private receipt projection are **not qualified**; do not enable public paid Judgment. No live payment, signing, execution, staging or production configuration is enabled by this integration.

The UI checks the canonical endpoint and never sends a payment signature or signs automatically. A 402 quote is shown as unpaid. A customer-authorized wallet/payment adapter and tenant identity are not yet present, so the full customer-facing authorize-with-limits/recover-after-timeout journey remains a release blocker rather than an inferred feature.

## Qualification record

This section is finalized only after the integration-source rerun. It must record exact source SHA, commands, counts, failures, skipped suites, migration/restore outcomes, audit results, browser evidence and external blockers. Source-tree qualification is separate from staging/production readiness.
