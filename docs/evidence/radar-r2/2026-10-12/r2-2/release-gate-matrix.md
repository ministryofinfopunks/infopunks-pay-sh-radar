# Radar R2.2 release gate matrix

**PR:** #11 `codex/radar-release-integration-r2` (must remain draft)
**Application source commit:** `ec93f8b696c19a6b30c8d9e1bb0732422f28aa90`
**Previously qualified source:** `095b3b43365fb0bf890568b891074eceaeff74fe`
**Previously verified PR head:** `4bcaf5731cdadf1d5229ab93faea3a90fa9b17de` (both existing checks succeeded there).
**Qualified R2.2 source/evidence head:** `7548e159fde584779b15250ffb3e5d932005d0b3`.

| Gate | State | Evidence / remaining requirement |
|---|---|---|
| Application source integrity | PASS on `7548e15`; evidence-only follow-up requires repeat CI | The only application source delta from `095b3b4` is `.market-pulse-method` color correction in `src/web/styles.css`. Node 24.21 / PostgreSQL 16 GitHub qualification and browser smoke passed on exact head `7548e159fde584779b15250ffb3e5d932005d0b3` in runs [38287706831](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/actions/runs/38287706831) and [38287711753](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/actions/runs/38287711753). Qualification reported 2,045/2,045 tests and 566/566 suites, 0 failed, 0 pending. This report amendment changes evidence only and must receive repeat CI on its resulting PR head. |
| Historical migration qualification | PASS in exact-head CI; independent approval pending | Qualification run 38287706831 passed the 22-migration inventory, clean apply, validation, repeat, backup/restore and replay commands. The established detailed 017/020 adoption and 022 compatibility evidence is preserved in `r2-1/`; no migration source changed in R2.2. Independent migration review is still pending. |
| Security / tenant isolation | PASS in exact-head CI; independent approval pending | The complete PostgreSQL qualification and browser-smoke passed on `7548e15`; prior detailed synthetic-browser and PostgreSQL evidence is in `r2-1/`. Review current source and exact PR head with the separate packet. No signing/payment/tenant secrets entered for this R2.2 browser inspection. |
| Browser / accessibility automation | PASS on `7548e15`; human assessment still HOLD | Both exact-head CI runs passed `qualification` and `browser-smoke`, including desktop/tablet/mobile, migration startup, tenant and container checks. Axe's 9,892 incomplete nodes are not passes. See the separate accessibility matrix for contrast, VoiceOver/NVDA, native zoom and keyboard limitations. |
| Human accessibility | HOLD | This agent measured representative computed contrast, observed the color correction, and inspected the accessibility tree. VoiceOver/NVDA, complete keyboard-only traversal, native 200%/400% browser zoom, full state contrast review and real mobile AT are not complete. See `accessibility-assessment.md`. |
| Independent security approval | HOLD | No independent reviewer/result/approval is recorded. Reviewer must record identity, independence, attack cases, exact PR head, findings and approval URL. |
| Independent migration approval | HOLD | No independent reviewer/result/approval is recorded. Reviewer must record identity, PostgreSQL version, exact PR head, historical 017/020 case results, findings and approval URL. |
| GitHub CI binding | PASS for head `7548e15`; rerun after report amendment | Workflow triggers on PR and checks out `pull_request.head.sha`; both workflow runs `38287706831` and `38287711753` succeeded on the exact SHA. This evidence amendment changes PR head, so the new final head must also pass both jobs before qualification is current. |
| GitHub enforced review policy | HOLD / NOT CONFIGURED | At review time PR #11 had no reviews, no review requests and empty `reviewDecision`. Repository rulesets API returned `[]`; branch-protection endpoint for base `codex/track-a-release-candidate` returned 404 (“Branch not protected”). Thus repository-side required checks/approval enforcement is not evidenced. Keep draft; do not merge. |
| Isolated staging | HOLD / NOT QUALIFIED | No Railway environment, PostgreSQL service, tenant credential or proxy has been provisioned/tested. See `railway-staging-readiness.md`. Authorization to begin staging: **HOLD** until independent reviews, human accessibility, final CI and operator isolation/rollback approval. |
| Public paid launch | HOLD / NOT QUALIFIED | No production secrets, signing key, live payment, x402 settlement, independent reconciliation, token operation or execution was activated or verified. A healthy container or mock settlement is not live settlement evidence. |

## Capability confirmation

Production mode installs `requireSigned: true` when no issuer is configured. Paid Judgment creation returns `503 judgment_signing_unavailable` when signing is required and issuer/key is unavailable. Payment configuration also requires signing capability and complete facilitator/resource/recipient/database bindings. Controlled staging rejects payment, machine execution, token/IPX activation and protected signing/facilitator bindings. Existing runtime and issuer tests cover invalid signing configuration and unavailable signing. Keep these defaults and tests unchanged; do not supply production keys to PR CI or staging.

## Final decisions

- **Code qualified:** PASS on source `ec93f8b` / evidence head `7548e15`; rerun CI after this evidence-only matrix amendment.
- **Independent approvals:** HOLD.
- **Staging-qualified:** NO.
- **Authorization to begin isolated staging:** **HOLD**.
- **Public paid-launch-qualified:** NO.
- **Public paid launch:** **HOLD**.

No merge, deployment, payment, IPX operation, or execution is authorized by this report.
