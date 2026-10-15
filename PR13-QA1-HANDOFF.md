# PR13-QA1 handoff

**Recommendation: HOLD.** The packet is ready for independent acceptance review. Required visual, manual accessibility, security/migration and operational gates remain unqualified. No staging, merge or deployment authorization is granted.

Repository: [ministryofinfopunks/infopunks-pay-sh-radar](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/13). Frozen PR source `e1b7e7be2f14056c5aed61484b0fb1ba371be4a6`; base `codex/radar-terminal-secure-integration` at `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. Qualification branch `codex/radar-pr13-qualification`; qualified source/harness commit `f62f9cbabbe244682adf2cc17d9451f580a7ed1c`. Later packet-only commits do not change qualified application bytes. Date: 2026-10-15, Asia/Colombo.

## What changed

The only source change after the frozen PR is one selector in `scripts/qualify-ui-int2-journeys.cjs`: scope the existing exact `Search` button locator to `.semantic-search-form`. The actual compiled page independently reproduces two unscoped matches and one scoped match; scoped search receives HTTP 200. Every other harness byte, assertion, timeout and security check is unchanged. The fixed harness SHA256 is `7603e67928d5faa97f791bdac2ecc5c1ad45a6d08409cf3469978c7c8bc425e1`, identical to the previously disclosed temporary adapter. [Regression proof](docs/pr13-qa1/search-selector-regression.json). All ten actual local API journeys pass.

PR #13 remains frozen and draft. GitHub metadata, all-file inventory, review submissions, review threads and PR-triggered workflow records were retrieved read-only. No review submissions/comments/threads or PR-triggered workflow runs were returned; an empty workflow list is not proof of general CI approval. Two commits comprise the PR: `7f44417fcad683a48397dad251f5d4245aa34643` (unification) and `e1b7e7be2f14056c5aed61484b0fb1ba371be4a6` (VR-01–04 corrections). Complete local diff inventory matches all 581 GitHub filenames. [Diff identity](docs/pr13-qa1/diff-summary.json).

## Qualification result

- 2,056 tests pass, 0 fail, 0 pending/skipped; PostgreSQL-backed, default test timeouts, two workers. Lint, typecheck, build, design and migration inventory pass.
- Four-route responsive run passes 28 widths. 139 Chromium routes attempted; 137 completed / 959 recorded width checks; 2 pre-width failures. Broader browser qualification passes 33 route/view audits, eight reflow checks and the authenticated tenant matrix. Six actual Chrome 200%/400% zoom cases pass. These are local automated results.
- The immutable approved comparator reports zero changed pixels for homepage and Spend Terminal at both widths. Four Solana/Robinhood captures remain **REVIEW_REQUIRED**. No approved baseline was updated.
- Strict static audit still exits 2: 57 inherited findings, independently matched by file/rule/message, zero new/resolved. [Each disposition](docs/pr13-qa1/STATIC-FINDINGS.md) remains open for human assessment.
- Production dependency audit: zero findings. Full audit: one low development esbuild advisory; retained and conditionally nonblocking for compiled non-Windows staging, subject to security owner acceptance.

## Reviewability and evidence

[Gate matrix](PR13-QA1-GATE-MATRIX.md), [component/evidence index](PR13-QA1-EVIDENCE-INDEX.md), [validation commands and failures](PR13-QA1-VALIDATION.md), [exact 581-file inventory](docs/pr13-qa1/PR13-CHANGED-FILES.csv), [qualification-only inventory](docs/pr13-qa1/PR13-QA1-CHANGED-FILES.txt).

The PR contains 173,837,457 bytes across changed files, dominated by evidence: 7 runtime files, 12 tests/validation scripts, 371 qualification/governance records and 191 historical/superseded records. There are 72 identical-content groups, 221 member files and 149 duplicate copies beyond one per group. These classifications guide review order; they do not authorize deletion. Twenty committed text artifacts contain the local developer account and absolute filesystem paths; distribution/privacy assessment remains open. All original evidence and the unrelated untracked evidence archive/qualification directory remain intact.

All 722 final historical source hashes and final browser manifest source/script/artifact hashes reconcile with the frozen PR. The older pre-correction manifest differs in eight files and remains historical. A capture parent SHA alone is not final-source provenance. New QA results bind to `f62f9cbabbe244682adf2cc17d9451f580a7ed1c` through [qualified source hashes](docs/pr13-qa1/qualified-source-manifest.json); all frozen changed artifacts have SHA256 and Git blob IDs in [the frozen manifest](docs/pr13-qa1/frozen-artifact-manifest.json). The packet manifest separately hashes the delivered review files and new outputs.

## Required next decisions

1. An independent visual reviewer accepts/rejects both changed pages at desktop/mobile, lower folds, and corrected VR-01–04, recording exact source, screenshot hashes, identity and date.
2. An accessibility specialist completes screen-reader, keyboard task and zoom/content review. The historical broad audit has 374 incomplete node occurrences; the expanded 12-audit run has **413**, including 10 target occurrences absent from its original baseline. Counts overlap and must not be added as unique defects. Neither an absent target nor zero axe violations resolves a finding. New broad run has 372 incomplete occurrences, also unqualified.
3. Independent security/privacy and migration reviewers assess tenant isolation, evidence distribution, existing base integration changes, operational migration/rollback/restore readiness and the dependency exception. No backend or migration delta in PR #13 removes these inherited obligations.
4. The authorized release owner decides whether to authorize restricted staging, with an explicit source, environment, disabled execution/payment scope, access limits, rollback/stop criteria and named operators. This task initiates none of it.

Evidence-to-Judgment UX remains deferred until integration and staging gates clear. Future work should reuse existing provenance and policy-bound recorded judgments/receipts, preserve Solana pre-spend and Robinhood claim-evidence purposes, and add no execution, trading, invented verdicts or unimplemented-live claims.
