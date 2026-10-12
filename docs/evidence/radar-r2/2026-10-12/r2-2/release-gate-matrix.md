# Radar R2.2 release gate matrix

**PR:** #11 `codex/radar-release-integration-r2` (must remain draft)
**Application source commit:** `ec93f8b696c19a6b30c8d9e1bb0732422f28aa90`
**Previously qualified source:** `095b3b43365fb0bf890568b891074eceaeff74fe`
**Previously verified PR head:** `4bcaf5731cdadf1d5229ab93faea3a90fa9b17de` (both existing checks succeeded there).
**Final PR head:** Record the pushed evidence-follow-up head and its GitHub check run before calling code qualification complete.

| Gate | State | Evidence / remaining requirement |
|---|---|---|
| Application source integrity | HOLD pending final CI | Only source delta from `095b3b4` is `.market-pulse-method` text color correction in `src/web/styles.css`. `npm run lint`, `npm run build`, `git diff --check`, and focused issuer/controlled-staging tests (49/49) passed locally under unsupported Node `v25.6.1`; final candidate must qualify in Node 24.21 / PostgreSQL 16 GitHub CI. |
| Historical migration qualification | PASS on predecessor; final-head recheck pending | Prior exact-source evidence `095b3b4` records 22 migrations, clean install, 017/020 adoption, 022, concurrent runners, checksum drift rejection, repeat, backup/restore and replay. No migration source changed in R2.2. Independent migration review is still pending. |
| Security / tenant isolation | PASS in prior automated CI; independent approval pending | Prior exact-source synthetic-browser and PostgreSQL evidence is in `r2-1/`; review current source and exact PR head with the separate packet. No signing/payment/tenant secrets entered for this R2.2 browser inspection. |
| Browser / accessibility automation | PASS on prior source; final-head recheck pending | Prior CI at `4bcaf57` passed `qualification` and `browser-smoke`. R2.2 found and corrected a market small-text contrast defect. CI must run on the final pushed head. Axe's 9,892 incomplete nodes are not passes. |
| Human accessibility | HOLD | This agent measured representative computed contrast, observed the color correction, and inspected the accessibility tree. VoiceOver/NVDA, complete keyboard-only traversal, native 200%/400% browser zoom, full state contrast review and real mobile AT are not complete. See `accessibility-assessment.md`. |
| Independent security approval | HOLD | No independent reviewer/result/approval is recorded. Reviewer must record identity, independence, attack cases, exact PR head, findings and approval URL. |
| Independent migration approval | HOLD | No independent reviewer/result/approval is recorded. Reviewer must record identity, PostgreSQL version, exact PR head, historical 017/020 case results, findings and approval URL. |
| GitHub CI binding | PARTIAL / FINAL HEAD REQUIRED | Workflow triggers on PR and checks out `pull_request.head.sha`; workflow names are `qualification` and `browser-smoke`. On the previously observed head `4bcaf57`, both jobs succeeded in runs `38281136164` and `38281140510`. Do not reuse those statuses for `ec93f8b` or the final documentation head. |
| GitHub enforced review policy | HOLD / NOT CONFIGURED | At review time PR #11 had no reviews, no review requests and empty `reviewDecision`. Repository rulesets API returned `[]`; branch-protection endpoint for base `codex/track-a-release-candidate` returned 404 (“Branch not protected”). Thus repository-side required checks/approval enforcement is not evidenced. Keep draft; do not merge. |
| Isolated staging | HOLD / NOT QUALIFIED | No Railway environment, PostgreSQL service, tenant credential or proxy has been provisioned/tested. See `railway-staging-readiness.md`. Authorization to begin staging: **HOLD** until independent reviews, human accessibility, final CI and operator isolation/rollback approval. |
| Public paid launch | HOLD / NOT QUALIFIED | No production secrets, signing key, live payment, x402 settlement, independent reconciliation, token operation or execution was activated or verified. A healthy container or mock settlement is not live settlement evidence. |

## Capability confirmation

Production mode installs `requireSigned: true` when no issuer is configured. Paid Judgment creation returns `503 judgment_signing_unavailable` when signing is required and issuer/key is unavailable. Payment configuration also requires signing capability and complete facilitator/resource/recipient/database bindings. Controlled staging rejects payment, machine execution, token/IPX activation and protected signing/facilitator bindings. Existing runtime and issuer tests cover invalid signing configuration and unavailable signing. Keep these defaults and tests unchanged; do not supply production keys to PR CI or staging.

## Final decisions

- **Code qualified:** PENDING final-head Node 24/PostgreSQL 16 CI; previous baseline `095b3b4` qualified, R2.2 added one contrast-only CSS source change.
- **Independent approvals:** HOLD.
- **Staging-qualified:** NO.
- **Authorization to begin isolated staging:** **HOLD**.
- **Public paid-launch-qualified:** NO.
- **Public paid launch:** **HOLD**.

No merge, deployment, payment, IPX operation, or execution is authorized by this report.
