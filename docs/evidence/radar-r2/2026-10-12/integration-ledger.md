# Radar integration R2 evidence

Date: 2026-10-12 (Asia/Colombo)

## Frozen source identity and lineage

- Implementation SHA: `541d002e5c0e89386e81e12bb5a0980a53807116` (`codex/radar-release-integration-r2`). This SHA is frozen before this evidence-only commit.
- PR #10 qualified foundation: `2559c69d0bccdec2e5ceac80a2e929026d45829c`; its branch evidence head was `eb1069690c477ea1b01bcdd23b7381becf9a6ca9`.
- PR #8 implementation reviewed and ported: `9d02a6cf45772a65b82e27b559a068ed1a4875f8`; its currently fetched branch head is `d27c739f8a37b3a3c9280346a6bb5c0e08577e05`.
- PR #9 failed experiment: `40d925308cc80c4c104d260c58571417a4924629`; no PR #9 commits were promoted. Its migration failure was reproduced as a regression.
- PR #7 strict paid-proof replay controls are retained through the PR #10 qualified foundation.
- The R2 candidate starts at the qualified PR #10 implementation and ports selected PR #8 behavior in small integrations. PR #8 and PR #9 tip commits are not ancestors of R2; original branches and evidence remain intact.
- Existing PRs remain drafts and have no independent approvals recorded. R2 is also a draft pending review.

## Conflict-resolution ledger

- Kept PR #10's Universal Radar identity/navigation, Solana pre-spend flow, read-only Robinhood Chain intelligence, fail-closed evidence gates, OpenAPI contract, and canonical receipt authority.
- Added PR #8 tenant-bound Judgment credentials, paid request/replay/history scoping, private receipt and ancestry reads, tenant-owned decision contexts, and scoped Execution/Evaluation reads. Caller-supplied agent IDs, wallet addresses, receipt IDs, and idempotency keys do not establish ownership; missing identity, unowned legacy records, invalid/expired credentials, and encoded-path ambiguity remain denied.
- Added the one-call SDK and explicit bounded payment authorization (amount, asset, network, recipient), protected original-proof storage/recovery, cancellation/timeout states, durable replay, and independent reconciliation with compare-and-set. Reconciliation does not silently re-settle. Browser Check does not initiate payment by default.
- Preserved canonical Observation → Judgment → Execution → Evaluation authority and immutable receipt ancestry. Judgment cannot directly authorize execution; execution authorization remains false without its separate authority.
- Migration defect: the 017/020 adoption check looked up a constraint by name without constraining its namespace. A same-named constraint in another schema could cause `historical_baseline_schema_mismatch` for the legitimate historical baseline. The check now scopes the lookup to `current_schema()`. A regression creates a foreign-schema decoy and proves the current-schema 003 vocabulary and 020 adoption. Migration IDs, SQL bytes, historical ledger data, assertions, and checksums were not rewritten.
- PR #9's migration failure informed this regression only; PR #9's integration source was not used.

## Source qualification

Exact candidate SHA `541d002e5c0e89386e81e12bb5a0980a53807116`:

- 566/566 test suites passed; 2,045/2,045 tests passed; 0 failed; 0 pending/skipped in the full qualification run.
- Typecheck, lint, production build, and `git diff --check` passed. Build reports the existing large Vite chunk warning.
- Full suite includes PostgreSQL migration-runner tests for clean install/repeat, concurrent runners, verified 017 and 020 baseline adoption, drift rejection, and modified-baseline rejection; canonical Judgment and causal receipt regressions; tenant/private-read adversarial tests; SDK recovery/reconciliation and original-proof replay/no-double-settlement tests.
- The 22-migration inventory, clean apply, validation, and repeat run passed. A restored disposable PostgreSQL backup was replayed and matched exactly (`exact_replay_match=true`) with signed Observation/Judgment/Execution/Evaluation ancestry.
- Historical pre-fix `historical_baseline_schema_mismatch` was reproduced for 017 and 020. With the schema-qualified fix, verified 017 adoption applies/validates the remaining chain; verified 020 adoption applies 021–022. All tracked migration checksums and IDs remain unchanged.
- Disposable PostgreSQL qualification used PostgreSQL 16.15. Product Linux runtime used Node 24.21.0; the host shell used Node 25.6.1 and was not used as the product runtime.

Raw test and migration logs are in `system/`; browser output and screenshots are in `browser/`.

## Tenant, payment, and receipt security

The full PostgreSQL-backed suite exercises anonymous access, credential-bound same-tenant access, cross-tenant and wrong-agent denial, invalid and expired credential denial, encoded paths, historical unowned records, legacy wallet-selector denial, private receipt/ancestry scoping, paid-proof replay mismatch rejection, original-proof recovery, cancellation/timeout recovery, concurrent durable replay, and reconciliation compare-and-set. It verifies one settlement on successful replay and no duplicate settlement. The disposable PostgreSQL SDK/reconciliation tests cover process-restart recovery and concurrent fresh repositories.

Independent human security review and required PR approvals remain outstanding. These local tests are not represented as external review or live qualified Judgment evidence.

## Linux, browser, dependency evidence

- Exact candidate container image: `sha256:97dd5963ed9118d520127fc023750889ee7d961bee45907d4c30f9e21b3db98b`, `linux/arm64`, runs as non-root `node` UID 1000 on Debian GNU/Linux 12 (Bookworm), Node 24.21.0.
- PostgreSQL 16.15 was healthy before the container started; all 22 migrations were applied before startup. The app health endpoint reported healthy PostgreSQL persistence and durable receipt storage.
- Container image and npm application CycloneDX SBOMs plus Debian package inventory are under `security/`.
- Production dependency audit: 0 vulnerabilities. Full dependency tree: 1 low dev-only esbuild advisory (`0.27.3`–`0.28.0`, fix available); no production dependency finding. This is disclosed and not silently changed after qualification.
- Browser run against the exact SHA: 33 route/viewport checks (11 routes each at desktop, tablet, and mobile); all page loads returned HTTP 200; axe reported zero violations. Axe also returned incomplete items for manual review, including color-contrast checks.
- Browser qualification surfaced three overflow-detector reports: tablet `/developers` and mobile `/developers` code elements, plus a mobile `/rh-chain-signal-desk/market` visually hidden paragraph. It also observed 12 HTTP 503 responses and corresponding console errors for private `/v1/4663/me/*` calls without identity configuration. These fail-closed responses are expected for this anonymous fixture environment, but authenticated desktop/mobile 4663 workflows were not exercised. These browser findings remain qualification blockers rather than being counted as clean.

## Independent review and release decision

Independent security review, independent review of migration adoption/replay evidence, and required PR approvals are outstanding. No upstream draft has been merged. Remote CI/branch-protection review and a follow-up browser run with a tenant identity are still required. Resolve/triage the reported viewport overflow and complete the automated accessibility tool's incomplete/manual checks before staging qualification.

**Staging and public paid launch: HOLD.** This is a local integration candidate only. No deployment, production payment activation, IPX operation, or live Judgment qualification was performed or is claimed.
