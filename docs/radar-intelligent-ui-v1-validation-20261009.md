# Radar Intelligent UI v1 validation and hardening report

Date: 2026-10-09 (Asia/Colombo)

## Qualification verdict

**PASS for the Intelligent UI v1 merge gate**, subject to normal human diff review. The full migration chain, PostgreSQL persistence suites, actual persisted Decision View HTTP read, application checks, and production build passed. **Overall IPX production release remains HOLD** under its separate economic-proof and production gates.

## Frozen checkout identity

- Repository: `ministryofinfopunks/infopunks-pay-sh-radar`
- Branch: `codex/track-a-release-candidate`
- HEAD: `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`
- Dirty-tree fingerprint: `sha256:936d13da41373fc941de4503ce5582ff07a272223558c1ce713e5df75c41dab4`
- Fingerprint input: sorted names plus SHA-256 file contents for the 17 modified/untracked files, excluding this report; each record is `path NUL content-hash newline`. This identifies the dirty tree and is not a Git commit SHA.
- At the end of the original qualification pass, no staged changes, commits, pushes, deployments, resets, cleans, stashes, rebases, or cherry-picks had been made. Subsequent merge-review actions are recorded below.

## Change isolation

The Intelligent UI and this qualification added or changed:

- `src/api/app.ts`, `src/api/openapi.ts`, `src/api/decisionViewRoutes.ts`
- `src/schemas/decisionView.ts`, `src/services/decisionViewService.ts`
- `src/web/radarApp.tsx`, `src/web/intelligentDecision.css`, `src/web/intelligentDecisionPage.tsx`
- `tests/decision-view-api.test.ts`, `tests/decision-view.test.ts`, `tests/intelligent-decision-page.test.tsx`
- `tests/integration/causal-context-durability.test.ts`, `tests/receipt-spine.test.ts`
- `docs/radar-intelligent-ui-v1.md`, this report

Preserved unrelated pre-existing work: `src/web/homepage.css`, `src/web/styles.css`, and `docs/radar-ui-polish-roadmap.md`. No lockfile or tracked build output changed. The judgment-payment durability suite generated the ignored local evidence file `output/phase2-judgment-postgres-performance.json`; it was left intact.

## Disposable PostgreSQL and migrations

- Server: PostgreSQL `14.20 (Homebrew)` at `127.0.0.1:55439`, database `radar_iui_qualification`, isolated local cluster at `/tmp/radar-iui-pg.QahOfZ/data`.
- Before migration, the target database was empty: zero public tables. No production or shared-staging credentials were configured or used.
- `npm run migrations:run`: **passed**, applied all 21 migrations in order, `20260719_001` through `20261008_021`; no failures or repository errors.
- `npm run migrations:check`: **passed**, zero pending migrations and no checksum drift.
- Post-run ledger query: 21 applied rows; latest is `20261008_021`.
- The PostgreSQL migration tests additionally passed fresh install/idempotency, verified upgrades from baselines 017 and 020, unledgered-schema refusal, concurrent migration runners, checksum drift detection, failed-DDL rollback/retry, and unknown/reordered ledger rejection.
- The legacy upgrade integration passed with the signed v1 judgment, receipt hash, issuer signature, and legacy payload unchanged after migrations 018–021.
- The repository does not identify the production PostgreSQL major version. Local PG14.20 qualification therefore does not establish production-version parity.

## Commands and results

Runtime: Node `v25.6.1`, npm `11.9.0`, Vitest `4.1.5`. Node 24/26 were not installed. No lockfile regeneration or dependency changes were made.

| Command | Result |
| --- | --- |
| `npm run migrations:run` against the disposable database | 21 migrations applied; pass |
| `npm run migrations:check` against the disposable database | 21 verified, none pending; pass |
| `CANONICAL_RECEIPT_TEST_URL=... npx vitest run tests/receipt-spine.test.ts tests/integration/causal-context-durability.test.ts tests/integration/acceptance-history-durability.test.ts tests/integration/judgment-payment-durability.test.ts tests/integration/judgment-issuer-durability.test.ts tests/integration/legacy-receipt-upgrade.test.ts tests/integration/postgres-migration-runner.test.ts tests/integration/migration-014.test.ts` | 8 files, 23 passed |
| `CANONICAL_RECEIPT_TEST_URL=... npx vitest run tests/integration/derived-score-projection.test.ts tests/integration/execution-proof-durability.test.ts tests/integration/free-assessment-attempts-durability.test.ts tests/integration/rh-usdg-accounting-durability.test.ts` | 4 files, 4 passed |
| `npx vitest run tests/decision-view.test.ts tests/decision-view-api.test.ts tests/intelligent-decision-page.test.tsx tests/openapi.test.ts` | 4 files, 19 passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 262 files passed, 14 skipped; 1,891 passed, 31 skipped |
| `npm run test:postgres-resilience` | 3 files passed; 40 passed, 1 skipped |
| `npm run build` | Passed; Vite reports `radarApp` at 1,303.46 kB minified / 250.65 kB gzip |
| `git diff --check` | Passed |

The full `npm test` run did not set database URLs; database-gated cases were skipped there and relevant canonical suites were run separately against the disposable database. `ECONOMIC_ENGINE_TEST_URL` was not set, so `tests/integration/economic-engine-durability.test.ts` was not run. The separate IPX launch/revenue PostgreSQL suites were outside this Intelligent UI qualification. Vitest also emitted Node warnings for an invalid `--localstorage-file` path; these did not fail tests. No real payment settlement was used: payment/idempotency integrations use mocked facilitators.

## Persistence and API evidence

- PostgreSQL durability covered append-only receipt behavior, duplicate IDs and concurrent duplicate writes, broken parent hashes, foreign-key ancestry, partial rollback, immutable context/history, historical context replay/offline verification, late-ingested and future-dated evidence boundaries, quote/retry idempotency, and signed v2 issuer persistence.
- A new focused integration assertion reconnects with a fresh pool after commit and requests `GET /v1/decision-views/:id` through the actual route registrar against the PostgreSQL-backed store. It verifies a persisted v2 `do_not_spend` judgment, ancestry and trusted issuer verification, committed evaluation-reference hash, `Cache-Control: no-store`, redaction, and `execution.authorized: false`.
- The same HTTP route fails closed with 503/no-store for an incomplete schema and an unreachable database. Missing IDs return 404.
- All four canonical outcomes (`proceed`, `test_spend_first`, `do_not_spend`, `insufficient_evidence`) remain distinct in projection tests. Additional cases cover valid, unsigned, forged, revoked, expired, missing, malformed, tampered, bad-policy, missing-ancestry, and corrupted judgments/contexts. Unavailable v1 historical binding and missing v2 context are disclosed rather than fabricated.
- The read endpoint is intentionally public, consistent with the existing public receipt read model: known IDs can be read without tenant credentials; unknown IDs return 404. Thus the endpoint does not provide tenant isolation and reveals record existence to a caller who guesses or obtains an ID. Its response is a reviewed safe projection without raw observation payloads/provenance, private policy data, bearer tokens, or wallet secrets. Keep this public-read and ID-enumeration exposure in the production threat review; if tenant confidentiality is required, authenticated authorization must precede deployment.
- The per-IP limiter and 429/no-store behavior pass API tests. The production limiter is process-local and relies on correct proxy/IP configuration; edge/shared limiting remains a production hardening item.
- Browser state, renderer data, and attempted response-field changes cannot create execution capability. `execution.authorized` is schema-literal false; neither `proceed`, assessment eligibility, receipt validity, nor payment grants execution. The UI has no signing, approval, payment, or execution action. Legacy diagnostic preflight cards remain clearly separate from canonical judgments.

## Remaining risks and independent holds

- PostgreSQL production major is unknown; qualification used local PG14.20.
- Node 24/26 qualification was unavailable; validation ran on Node 25.6.1.
- Full-suite skips include database-gated tests; economic-engine durability and IPX launch/revenue database suites were not part of this feature gate. No real settlement, production signing configuration, or production infrastructure was exercised.
- Public record lookup, ID enumeration, process-local rate limiting, and trusted-proxy settings need explicit production review.
- The oversized `radarApp` bundle warning is a separate performance issue; it is not changed by this validation.
- The causal-loop audit and overall IPX production/economic-proof gates remain independent and open.

## Decisions and next action

**PASS — Intelligent UI v1 merge gate.** The validated dirty-tree revision is ready for human merge review; no merge was performed.

**HOLD — overall IPX production release.** The separate production, economic-proof, PostgreSQL-version, and exposure reviews remain open.

Smallest next action: review this exact dirty-tree diff against `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`, including the preserved CSS/roadmap changes, then open the merge review. Keep the oversized `radarApp` chunk warning as a separate performance follow-up.

## Merge-review follow-up (2026-10-09)

The branch, HEAD, and fingerprint above were verified before review edits. The review found that the initial v2 projection checked only that the stored `context_hash` field matched the signed judgment; it did not run `verifyDecisionContext`. A context object with an altered evaluation-reference projection hash could therefore have been displayed as committed. The feature branch now calls the canonical replay verifier and reports v2 history as unavailable (and the assessment as ineligible) when replay fails. A regression test alters the projection hash while retaining the old context hash and confirms fail-closed behavior.

The isolated feature-only review commit is `11bbaa4f39af9067758c33861073dcc5e0d28993`, based directly on `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`. It contains 14 files and excludes the unrelated CSS, roadmap, and this validation report. Its revalidation passed: 16 focused files / 46 tests; typecheck; lint; full suite (262 files passed, 14 skipped; 1,891 passed, 31 skipped); resilience suite (40 passed, 1 skipped); production build; and `git diff --check`. Build still warns about the 1,303.52 kB minified `radarApp` chunk. Database-gated tests were exercised separately as recorded above; economic-engine durability and the IPX launch/revenue DB suites remain outside this feature qualification.

The reviewed release-candidate baseline was published separately as `codex/track-a-release-candidate` at `f6b5de64e96da4e5bacbfba39f6cdf6940d2aa79`; the feature branch was pushed at the commit above. Draft PR: https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/6, targeting the release-candidate branch. The PR remains draft.

**Security disposition:** public Decision View access has no tenant isolation, and unknown IDs return 404, exposing record existence to callers who guess or obtain an ID. Require a reviewed public-data policy or authenticated access before production exposure. Keep merging blocked if merge can automatically expose the endpoint before that gate is satisfied. The overall IPX production decision remains **HOLD**.

Post-review dirty-tree fingerprint for the original checkout, using the same 17-file algorithm and excluding this report: `sha256:5c1f27eee599017ec1b7026f96a0b8d7f53861781a050209ba8c84e7127d8aca`. Unrelated CSS and roadmap files remain in that checkout and were not copied to the PR branch.
