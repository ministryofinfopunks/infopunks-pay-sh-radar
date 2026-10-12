# Radar R2.1 release-gate report

**Decision: HOLD for staging and public paid launch.** The locally tested source is frozen, but independent security/migration review and complete manual accessibility sign-off are still required. No production deployment, production payment, IPX operation, or live Judgment qualification was performed.

## Candidate identity

- Repository: `ministryofinfopunks/infopunks-pay-sh-radar`
- Draft PR: [#11 — Radar integration R2 security convergence](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/11)
- Branch: `codex/radar-release-integration-r2`
- Exact locally qualified application/source SHA: `00d847379a1530848a8789f33cc075bd0a25095e`
- PR #11's prior frozen R2 implementation `541d002e5c0e89386e81e12bb5a0980a53807116` and R2 evidence head `231f0535a979872761e067afca73566209705e26` remain in ancestry and were not rewritten. The R2.1 source changes are a narrow mobile wrapping fix and stronger browser qualification. Subsequent commits add CI/evidence only.
- The final GitHub check head is the PR's current head when reviewed. CI must be green for that exact head; the PR body records the final head and check links.

## Conflict and migration ledger

- Preserved PR #10's Universal Radar identity/navigation, Solana pre-spend flow, read-only Robinhood Chain intelligence, canonical receipt authority, and fail-closed boundaries.
- Preserved PR #7 strict paid-proof replay and PR #8 tenant-owned private access, one-call SDK, protected proof recovery, and reconciliation. The R2 source review packet covers ownership, ancestry, encoded paths, approval bounds, settlement, immutable authority, billing provenance, and RPC-only recovery.
- The browser run found a long provider scope badge extending past its mobile panel. It now wraps at widths up to 640px. The overflow checker now treats descendants of bounded scrollports as intentional scrolling content, with separate geometry and keyboard-scroll assertions for every code block.
- Anonymous `/4663` no longer requests private wallet/history/reputation resources; public read-only market pages remain available. The browser harness verifies this against actual HTTP requests.
- The 017/020 adoption defect was a constraint lookup by name without a `current_schema()` scope. The foreign-schema decoy regression now passes. Migration files, IDs, and checksums are unchanged from the qualified R2 implementation. Verified 017 adoption applies the remaining five migrations; verified 020 adoption applies 021 and 022. See [`migration-adoption.json`](system/migration-adoption.json) and the earlier [`integration-ledger.md`](../integration-ledger.md).

## Local qualification evidence

Exact application/source SHA `00d847379a1530848a8789f33cc075bd0a25095e` was qualified with Node `v24.21.0` and PostgreSQL `16.10` on disposable local databases.

- **Tests:** 2,045 passed; 0 failed; 0 pending; 566/566 test suites passed. Typecheck, lint, production build, migration inventory, and `git diff --check` passed. See [`full-test-summary.json`](system/full-test-summary.json), [`check-results.json`](system/check-results.json), and focused [`critical-regressions.json`](system/critical-regressions.json).
- **Migrations/recovery:** 22-migration clean apply, validation, repeat, concurrent runner, historical 017/020 adoption, checksum drift rejection, backup, restore, and durable receipt replay passed. Migration 022 was adopted after 020. No historical migration bytes or IDs changed.
- **Tenant and payment security:** actual browser HTTP returned owner 200 `assessed_free`, cross-tenant and wrong-agent 404, invalid/expired/missing credentials 401. The explicit Check issued one request; credentials were absent from URL and local storage. Failure and timeout flows offered safe retry and stated that no payment or wallet use occurred. Full PostgreSQL regressions cover private ancestry, original-proof replay, wrong-proof rejection, durable recovery, reconciliation, and no double settlement. Synthetic payment infrastructure only; no real payment was sent.
- **Browser/accessibility:** 33 route/viewport combinations, 8 reflow combinations, 0 HTTP failures, 0 document/uncontained overflow, 0 anonymous private-request failures, and 0 Axe violations. Axe also reported 7,362 inconclusive nodes; they remain limitations. The [`accessibility-review.md`](accessibility-review.md) records PASS/LIMITATION for each material interaction. Human screen-reader review, full color-contrast measurement, complete keyboard traversal, and native browser zoom remain open.
- **Linux/container:** Debian 12 Bookworm, Node 24.21.0, non-root `node` UID 1000, health endpoint 200. Local image was `linux/arm64`; the workflow additionally checks the GitHub Linux runner's image platform. Production mode was used for container liveness with payment/signing disabled and an invalid catalog endpoint with fixture fallback off. This does not qualify live Judgment issuance.
- **SBOM/dependencies:** CycloneDX container image SBOM (3,560 components), full npm SBOM (184 components), production npm SBOM (76 components), and Debian package inventory are in [`system/`](system/). Production dependency audit: 0 findings. Full development tree: one low-severity `esbuild` advisory, no moderate/high/critical findings; it is disclosed in [`audit-all.json`](system/audit-all.json).

## CI and independent review

The GitHub workflow checks the exact PR head, Node 24, PostgreSQL 16, full tests and migrations, two npm audit scopes and CycloneDX SBOMs, Debian Bookworm package inventory, non-root production-container startup, and Chromium browser/accessibility/tenant regressions. The browser workflow runs the compiled production build under a deterministic development runtime with static synthetic credentials and payments disabled. Production-mode Judgment issuance remains fail-closed without an independently managed signing issuer; no signing credential is placed in PR CI. The container-image SBOM action is pinned to an immutable commit and scans the locally built image using Syft.

One intermediate CI run on PR head `a82b256fa85b2e52e5ca47c14e41b5ed19e55bf2` failed before jobs started because the SBOM step was inserted at the wrong YAML level. The workflow structure was corrected and parsed locally. The corrected workflow passed both jobs on code/config head `6e2ea81a26b7734dff42f15b5402d460dd74f6e6` ([GitHub Actions run 38275100921](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/actions/runs/38275100921)). The final evidence commit changes documentation only and triggers one more run on that exact PR head; record that run and head in the PR description. The PR remains draft; automated results are not approval.

Independent security and migration reviews are **PENDING**. The reviewer packet is [`radar-r2-independent-review.md`](../../../../security/radar-r2-independent-review.md); required reviewers must assess the exact final head. Do not self-approve or treat this local report as external approval.

## Release blockers

1. Required independent security and migration reviews and PR approvals.
2. Complete human accessibility sign-off for contrast, screen-reader announcements, broad keyboard traversal, reduced-motion behavior across animated components, and native 200%/400% browser zoom.
3. Green reproducible GitHub CI checks on the exact final PR head, including container SBOM generation.
4. Separate operational authorization and verification before staging or paid launch.

**Staging: HOLD. Public paid launch: HOLD.** Keep PR #11 draft and unmerged until its required reviews and integration gates are satisfied.
