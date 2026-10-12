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

## Combined-revision qualification

The qualification runner and browser harness tested source revision `2559c69d0bccdec2e5ceac80a2e929026d45829c`. The final candidate commit adds this report and source-bound evidence only; `src/`, `tests/`, `migrations/`, package files and qualification scripts are unchanged from the tested revision. The full check inventory, raw logs, browser captures and hashes are in [the candidate evidence packet](radar-release-integration/2026-10-12/README.md).

| Gate | Result |
|---|---|
| Typecheck / lint / build | PASS on Node 24.21.0. |
| Complete PostgreSQL-backed suite | PASS: 277 files, 1,997 tests, 0 failures, 0 pending/skips. Fresh disposable local databases; mock facilitators only. |
| Integration regressions | PASS for paid replay through both POST aliases, strict malformed requests/payment, stable replay after restart/publication failure, idempotent concurrent requests, ambiguous settlement lockout, canonical UI verdict despite legacy diagnostic `ALLOW`, encoded private-path handling, frozen context replay, RH read-only abstention, unsupported policy/network, and free insufficient evidence. |
| Cross-tenant private-read isolation | **NOT QUALIFIED.** Tests deny anonymous and wrong-operator tokens before lookup, but the codebase has no tenant identity/owner model, so a real cross-tenant case cannot be expressed or tested. |
| Migration history | PASS locally: 22 selected migrations applied, validated and repeated. SHA-256 comparison against `f6b5de6` found 42 original files unchanged and only the two 022 direction files added. No migration renumbering or edit. Competing E1 `018` remains excluded. |
| PostgreSQL restore/replay | PASS on disposable localhost PostgreSQL 14.20: backup restored into a separate database; signed receipt, ancestry, score projection, causal manifest and 22-row ledger matched exactly. Fixtures were synthetic local only. |
| Dependency audits | Production tree: 0 vulnerabilities. Complete tree: 1 low severity `esbuild` advisory for its Windows development server; no moderate/high/critical issue. See raw audit JSON and package source. |
| Browser / accessibility | PASS: compiled candidate in fixture-only mode, 11 routes × 3 viewports (33 HTTP 200 views), 0 axe violations, 0 console errors, 0 horizontal overflows, 0 broken audited fragments. Injected 503 and timeout both expose retry. Browser evidence uses Playwright 1.62.1, Chrome 154.0.8037.98 and axe-core 4.14.0. |
| Linux runtime / image | **NOT RUN.** Host is macOS; Docker CLI exists but no daemon socket was available. Exact Linux image/runtime/SBOM/container scan remains a staging gate. |
| Staging / production | NOT RUN. No staging or production connection, payment, signing, execution, migration or deployment operation occurred. |

The first full-suite attempt found a missing test-only operator credential in the malformed-header probe. The API correctly rejected that probe with 401 before parsing the header. After the probe used the configured test operator, the focused suite passed 74/74 and the complete rerun passed 1,997/1,997.

## Payment and user journey review

The combined code preserves PR #7's full decoded-proof replay binding, but paid use remains operator-authenticated. The Spend Terminal displays canonical free abstention and an unpaid 402 quote, never sends payment/signature headers, and retries a timed-out request with its stable key. The SDK has no tenant-bound authorization or payment adapter that can authorize a quote within a caller's explicit limit, retain the original proof for safe receipt recovery, or verify the resulting receipt. The UI also does not yet provide state-specific next actions for every unsupported/expired/pending/provider-unavailable error. These are **implementation blockers**, not staging-only assumptions. Do not weaken the operator gate to hide them.

## Staging checklist (not executed)

1. Resolve and security-review a tenant identity, owner-scoped receipt access, approved public-proof projection and cross-tenant negative-test contract. Do not permit customer paid access before this exists.
2. Add a payment authorization adapter that enforces a caller-specified fee ceiling and asset/network, stores the original proof securely for same-key recovery, and never submits a second settlement after an ambiguous response. Keep live paid configuration disabled until separately approved.
3. Build the exact candidate in Linux with the pinned Node 24 runtime; record immutable image digest, non-root runtime, SBOM and image/OS/application scans. Host macOS build does not clear this gate.
4. Use an approved isolated staging environment with private PostgreSQL, separate migration/runtime roles, restricted origin/ingress and staging-only credentials. Verify the applied migration IDs/checksums match this 22-migration history; do not combine either competing 018 lineage.
5. Verify approved catalog freshness, provider outage behavior, edge-wide limits, private/no-store responses, authenticated owner access, RH market abstention and canonical receipt verification. Keep Evaluation, execution, publication and payment activation closed unless independently qualified.
6. Rehearse backup/restore into a new staging database, pending-settlement reconciliation, alerts, ownership and rollback while preserving append-only receipt history. No destructive down migration or payment resubmission.

## Verdict

**HOLD** as a release candidate for any customer-facing paid Judgment or staging deployment. The combined source has strong local qualification evidence, but tenant/owner authorization, cross-tenant tests, a safe explicit-limit payment adapter, state-specific user recovery guidance and Linux runtime evidence are still missing. Do not enable live paid Judgment or deploy production infrastructure.
