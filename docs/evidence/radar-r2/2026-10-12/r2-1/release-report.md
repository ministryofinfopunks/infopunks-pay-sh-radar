# Radar R2.1 release-gate report

**Decision: HOLD for staging and public paid launch.** The exact candidate passed reproducible GitHub CI, but independent security/migration review and complete manual accessibility sign-off are still required. No production deployment, production payment, IPX operation, or live Judgment qualification was performed.

## Candidate identity

- Repository: `ministryofinfopunks/infopunks-pay-sh-radar`
- Draft PR: [#11 — Radar integration R2 security convergence](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/11)
- Branch: `codex/radar-release-integration-r2`
- Frozen R2 implementation preserved: `541d002e5c0e89386e81e12bb5a0980a53807116`; R2 evidence head preserved: `231f0535a979872761e067afca73566209705e26`.
- R2.1 application implementation qualified locally: `00d847379a1530848a8789f33cc075bd0a25095e`. Final candidate source, including the browser qualification harness: `095b3b43365fb0bf890568b891074eceaeff74fe`.
- The commits after `00d8473` update the browser qualification harness and evidence. No application architecture, migration, payment, or production runtime code changed after `00d8473`. The exact candidate `095b3b4` passed the full GitHub qualification below.

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
- **Browser/accessibility:** On exact candidate `095b3b4`, 33 route/viewport combinations and 8 reflow combinations had 0 HTTP failures, 0 document/uncontained overflow, 0 anonymous private-request failures, 0 Axe violations, and 9,892 Axe inconclusive nodes. All eight initial global-navigation Tab stops had visible focus; reduced-motion was active. The [`accessibility-review.md`](accessibility-review.md) records PASS/LIMITATION for each material interaction. Human screen-reader review, full color-contrast measurement, complete keyboard traversal, and native browser zoom remain open.
- **Linux/container:** Debian 12 Bookworm, Node 24.21.0, non-root `node` UID 1000, health endpoint 200. Local image was `linux/arm64`; the workflow additionally checks the GitHub Linux runner's image platform. Production mode was used for container liveness with payment/signing disabled and an invalid catalog endpoint with fixture fallback off. This does not qualify live Judgment issuance.
- **SBOM/dependencies:** CycloneDX container image SBOM (3,560 components), full npm SBOM (184 components), production npm SBOM (76 components), and Debian package inventory are in [`system/`](system/). Production dependency audit: 0 findings. Full development tree: one low-severity `esbuild` advisory, no moderate/high/critical findings; it is disclosed in [`audit-all.json`](system/audit-all.json).

## CI and independent review

The GitHub workflow checks the exact PR head, Node 24, PostgreSQL 16, full tests and migrations, two npm audit scopes and CycloneDX SBOMs, Debian Bookworm package inventory, non-root production-container startup, and Chromium browser/accessibility/tenant regressions. The browser workflow runs the compiled production build under a deterministic development runtime with static synthetic credentials and payments disabled. Production-mode Judgment issuance remains fail-closed without an independently managed signing issuer; no signing credential is placed in PR CI. The container-image SBOM action is pinned to an immutable commit and scans the locally built image using Syft.

The final candidate `095b3b43365fb0bf890568b891074eceaeff74fe` passed both GitHub Actions jobs in run [38280253989](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/actions/runs/38280253989). The PostgreSQL qualification records 2,045/2,045 tests, 566/566 suites, successful typecheck/lint/build, migration inventory, clean apply/repeat/adoption/restore, and dependency/container SBOM checks. Historical 017/020 adoption and checksum-drift rejection passed. The browser job passed on Linux Node 24 with PostgreSQL 16, non-root container startup, all 33 route/viewport cases, authenticated synthetic tenant HTTP checks, and reduced-motion/focus checks. Browser and system artifacts are attached to that workflow run. An earlier same-SHA run exposed a timing issue in the test harness before the skip-link was available; the final harness waits for the homepage's actual `radar-home-skip` link, and the successful exact-head run recorded one Tab per focus stop. The PR is still draft; automated results are not independent approval.

Independent security and migration reviews are **PENDING**. The reviewer packet is [`radar-r2-independent-review.md`](../../../../security/radar-r2-independent-review.md); required reviewers must assess the exact final head. Do not self-approve or treat this local report as external approval.

## Release blockers

1. Required independent security and migration reviews and PR approvals.
2. Complete human accessibility sign-off for contrast, screen-reader announcements, broad keyboard traversal, reduced-motion behavior across animated components, and native 200%/400% browser zoom.
3. Separate operational authorization and verification before staging or paid launch.

**Staging: HOLD. Public paid launch: HOLD.** Keep PR #11 draft and unmerged until its required reviews and integration gates are satisfied.
