# Radar Release Integration R1 — candidate evidence

Date: 2026-10-12 (Asia/Colombo)

## Source identities and ancestry

| Source | Ref | Exact SHA | State |
|---|---|---|---|
| PR #7 `codex/pre-spend-launch-hardening` | `origin/codex/pre-spend-launch-hardening` | `b3c9a94fb8b0ab0f8ad5e027ed45f63347f02c79` | Draft, open; no review objects, CI checks, or comments recorded at inspection |
| PR #8 `codex/judgment-dx1` | `origin/codex/judgment-dx1` | `d27c739f8a37b3a3c9280346a6bb5c0e08577e05` | Draft, open; based on PR #7; no review objects, CI checks, or comments recorded at inspection |
| PR #7 base | `codex/track-a-release-candidate` | `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79` | Shared source base |
| Locally qualified Radar | `codex/unified-radar` | `fefaa8e0dcdab26bc1370bbd507ad18e7e10cb42` | Has separately preserved local dirty UI changes and evidence |

PR #7 is an ancestor of PR #8. The integration worktree started at `fefaa8e0dcdab26bc1370bbd507ad18e7e10cb42`; PR #7 was merged into that line, then PR #8 is being merged as the current in-progress merge. The source branches and original unified-radar checkout were not rewritten. The unified-radar local changes and their evidence were copied into the isolated worktree; the original checkout remains preserved.

## Conflict ledger

| Area | Competing changes | Integration decision | Remaining evidence needed |
|---|---|---|---|
| Product identity and navigation | Unified Radar surface vs PR #7/#8 Judgment-first endpoints and documentation | Keep Universal Radar navigation and the unified product identity. Solana remains the canonical pre-spend journey; Robinhood Chain remains read-only market intelligence. | Desktop/mobile end-to-end against the final candidate SHA |
| Paid request validation and replay | PR #7 strict request parsing, identity binding, exact x402 proof replay vs PR #8 payment workflow and SDK | Retain strict parsing and payment proof matching. Preserve fail-closed request binding, idempotency, quote, settlement, and receipt checks. | Full replay/recovery suite and independent security review against final SHA |
| Tenant privacy and receipts | Existing global operator-only receipt reads vs PR #8 owner-scoped private access | Canonical receipt reads are delegated to owner/operator authorization. Owned receipt ancestry and context must be accessible to the owning tenant; tapes, attempts, scores, witnesses and unowned history remain operator-only. | Resolve remaining owner-access assertions and rerun tenant-isolation regressions |
| Payment durability and reconciliation | Existing settlement path vs PR #8 independent reconciliation and one-call SDK | Keep independent reconciliation as required evidence; do not treat facilitator settlement alone as independently confirmed. SDK recovery must reuse the same request and never issue another payment. | PostgreSQL-backed retry, ambiguity, restart and independent reconciliation evidence on final SHA |
| Authority and causal ordering | Existing receipt authority vs PR #8 SDK and private presentation additions | Preserve Observation → Judgment → Execution → Evaluation as canonical authority. The SDK returns `execution_authorized: false`; no execution authority is implied by payment or a valid receipt. | Complete exact-SHA causal replay and authority regressions |
| Schema and migrations | PR #7 adds paid-pre-spend persistence behavior; PR #8 stores tenant/payment/reconciliation details in existing JSONB records | Neither PR #7 nor PR #8 changes migration files. PR #8 relies on existing schema fields and migration history through 022; no compatibility migration was added. Startup checks are fail-closed for required columns. | Repair and reproduce historical 017/020 baseline adoption; qualify upgrade/replay on supported PostgreSQL version |
| Runtime and packaging | Unified Radar runtime vs PR #8 digest-pinned Node 24 image and package exports/dependencies | Keep the pinned Node 24 runtime and merged package exports/dependencies. Do not infer Linux qualification from a local macOS run. | Linux image build/startup and health qualification on exact SHA |

## Security and review status

- Both upstream pull requests remain drafts. Neither had an independent approval or recorded CI checks at inspection. No missing approval or draft gate was bypassed.
- No independent reviewer has approved the combined candidate. The candidate must not be called independently security-reviewed or release-qualified.
- The combined code keeps tenant identity server-owned, keeps request/payment evidence private, uses strict paid proof replay, and leaves execution authorization false. The authorization integration has unresolved regressions noted below.
- Repository branch-protection lookup returned no configured rule for the examined base. This does not waive the user's explicit requirement to retain draft status and obtain independent review.
- Production payment enablement, deployment, IPX operations, and live Judgment qualification were not performed.

## Commands and evidence

Environment: local macOS host, Node `v25.6.0` (package requires Node `>=24.21 <25`), local PostgreSQL `14.20`; target Linux container runtime unavailable because the Docker daemon/socket is absent. Browser automation dependencies Playwright and axe-core are absent. Existing unified-radar screenshots are from the source checkout and are not exact-candidate E2E evidence.

- `npm ci` — passed; npm reported one low-severity dependency advisory.
- `npm run typecheck` — passed after integration edits.
- `npm run migrations:validate` — passed; 22 migration entries validated.
- `git diff --cached --check` — passed at integration review.
- Full `CANONICAL_RECEIPT_TEST_URL=postgresql:///radar_r1_test npm test` — failed: 281 test files, 249 passed, 31 failed, 1 skipped; 2,046 tests, 1,995 passed, 49 failed, 2 skipped. The run included timeout failures under the default parallel load and functional failures; it is not a qualification pass.
- Serial focused run for pre-spend, Judgment, SDK, privacy, PostgreSQL, replay, and migration suites — failed: 9 files, 4 passed, 5 failed; 68 tests, 53 passed, 15 failed.
- Follow-up serial SDK/privacy/PostgreSQL subset after fixing the earlier global receipt-read gate — SDK and PostgreSQL DX suites passed; owner-access suite still failed two assertions (expected identity-unavailable 503 but got 401, and expected cross-tenant 404 but got 401).
- Migration runner upgrade tests — failed for both pinned 017 and 020 baselines with `historical_baseline_schema_mismatch`. The runner failed closed; the evidence does not support claiming a compatible upgrade/replay path.
- Linux container build/startup — not run: Docker daemon unavailable.
- Desktop/mobile browser E2E — not run against this candidate: Playwright and axe-core are unavailable. Existing screenshots belong to the source branch and cannot qualify this SHA.

## Release blockers and decision

1. Draft PR #7 and #8 have no independent approvals or CI qualification.
2. The combined full suite is failing; owner authorization assertions remain unresolved.
3. PostgreSQL historical upgrade/adoption at baselines 017 and 020 fails closed.
4. Linux runtime and exact-SHA desktop/mobile workflows have not been qualified.
5. No independent security review of the combined candidate exists.

**Staging decision: HOLD.** Do not promote this candidate to staging or production. Keep paid production payments disabled and IPX operations inactive. Do not claim a live qualified Judgment. Reopen qualification only after the blockers above are resolved and evidence is generated from the frozen combined SHA.
