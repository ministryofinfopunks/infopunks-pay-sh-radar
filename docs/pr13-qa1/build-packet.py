"""Build human-readable review packet from recorded results; does not run or approve gates."""
import json,hashlib,collections,subprocess
from pathlib import Path
r=Path('/tmp/radar-pr13-qa1');o=r/'docs/pr13-qa1'
head='e1b7e7be2f14056c5aed61484b0fb1ba371be4a6';base='d3d0a445ec20e8c55170c2fc1f52aff220b2a851';source='f62f9cbabbe244682adf2cc17d9451f580a7ed1c'
def load(p):return json.loads((r/p).read_text())
def sha(p):return hashlib.sha256((r/p).read_bytes()).hexdigest()
def link(p,label=None):return '['+(label or Path(p).name)+']('+p+')'
def put(p,s): (r/p).write_text(s.strip()+'\n')
triage=load('docs/pr13-qa1/evidence-triage.json');full=load('docs/pr13-qa1/full-tests.json');checks=load('docs/pr13-qa1/checks.json')['checks'];browser=load('docs/pr13-qa1/browser-checks-first-pass.json')['checks']+load('docs/pr13-qa1/browser-checks.json')['checks'];extended=load('docs/pr13-qa1/extended-browser-checks.json')['checks'] if (o/'extended-browser-checks.json').exists() else []
summary=load('docs/pr13-qa1/unified-browser/summary.json');api=load('docs/pr13-qa1/journeys/results.json');privacy=load('docs/pr13-qa1/security-privacy-assessment.json')
route=load('docs/pr13-qa1/full-routes/summary.json') if (o/'full-routes/summary.json').exists() else None
completed_routes=load('docs/pr13-qa1/full-routes/chromium-qualification.json') if (o/'full-routes/chromium-qualification.json').exists() else []
actual_widths=sum(len(x.get('layouts',[])) for x in completed_routes)
route_status=(str(route['chromium'])+' Chromium routes attempted; '+str(sum('failure' not in x for x in completed_routes))+' completed / '+str(actual_widths)+' recorded width checks; '+str(len(route['failures']))+' pre-width failures') if route else 'Full Chromium sweep not completed; no result claimed'
webkit=load('docs/pr13-qa1/webkit-routes/summary.json') if (o/'webkit-routes/summary.json').exists() else None
webkit_status=(str(webkit['webkit'])+' WebKit representative routes / '+str(len(webkit['failures']))+' combined route failures') if webkit else 'WebKit cached-browser protocol failure: Page.overrideSetting / unknown PushAPIEnabled; newPage stalls, 0 WebKit routes completed; invocation stopped after 4m45s; no acceptance result claimed'
put('PR13-QA1-HANDOFF.md',f'''# PR13-QA1 handoff

**Recommendation: HOLD.** The packet is ready for independent acceptance review. Required visual, manual accessibility, security/migration and operational gates remain unqualified. No staging, merge or deployment authorization is granted.

Repository: [ministryofinfopunks/infopunks-pay-sh-radar](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/pull/13). Frozen PR source `{head}`; base `codex/radar-terminal-secure-integration` at `{base}`. Qualification branch `codex/radar-pr13-qualification`; qualified source/harness commit `{source}`. Later packet-only commits do not change qualified application bytes. Date: 2026-10-15, Asia/Colombo.

## What changed

The only source change after the frozen PR is one selector in `scripts/qualify-ui-int2-journeys.cjs`: scope the existing exact `Search` button locator to `.semantic-search-form`. The actual compiled page independently reproduces two unscoped matches and one scoped match; scoped search receives HTTP 200. Every other harness byte, assertion, timeout and security check is unchanged. The fixed harness SHA256 is `7603e67928d5faa97f791bdac2ecc5c1ad45a6d08409cf3469978c7c8bc425e1`, identical to the previously disclosed temporary adapter. [Regression proof](docs/pr13-qa1/search-selector-regression.json). All ten actual local API journeys pass.

PR #13 remains frozen and draft. GitHub metadata, all-file inventory, review submissions, review threads and PR-triggered workflow records were retrieved read-only. No review submissions/comments/threads or PR-triggered workflow runs were returned; an empty workflow list is not proof of general CI approval. Two commits comprise the PR: `7f44417fcad683a48397dad251f5d4245aa34643` (unification) and `{head}` (VR-01–04 corrections). Complete local diff inventory matches all 581 GitHub filenames. [Diff identity](docs/pr13-qa1/diff-summary.json).

## Qualification result

- {full['numPassedTests']:,} tests pass, {full['numFailedTests']} fail, {full['numPendingTests']} pending/skipped; PostgreSQL-backed, default test timeouts, two workers. Lint, typecheck, build, design and migration inventory pass.
- Four-route responsive run passes 28 widths. {route_status}. Broader browser qualification passes 33 route/view audits, eight reflow checks and the authenticated tenant matrix. Six actual Chrome 200%/400% zoom cases pass. These are local automated results.
- The immutable approved comparator reports zero changed pixels for homepage and Spend Terminal at both widths. Four Solana/Robinhood captures remain **REVIEW_REQUIRED**. No approved baseline was updated.
- Strict static audit still exits 2: 57 inherited findings, independently matched by file/rule/message, zero new/resolved. [Each disposition](docs/pr13-qa1/STATIC-FINDINGS.md) remains open for human assessment.
- Production dependency audit: zero findings. Full audit: one low development esbuild advisory; retained and conditionally nonblocking for compiled non-Windows staging, subject to security owner acceptance.

## Reviewability and evidence

[Gate matrix](PR13-QA1-GATE-MATRIX.md), [component/evidence index](PR13-QA1-EVIDENCE-INDEX.md), [validation commands and failures](PR13-QA1-VALIDATION.md), [exact 581-file inventory](docs/pr13-qa1/PR13-CHANGED-FILES.csv), [qualification-only inventory](docs/pr13-qa1/PR13-QA1-CHANGED-FILES.txt).

The PR contains 173,837,457 bytes across changed files, dominated by evidence: 7 runtime files, 12 tests/validation scripts, 371 qualification/governance records and 191 historical/superseded records. There are 72 identical-content groups, 221 member files and 149 duplicate copies beyond one per group. These classifications guide review order; they do not authorize deletion. Twenty committed text artifacts contain the local developer account and absolute filesystem paths; distribution/privacy assessment remains open. All original evidence and the unrelated untracked evidence archive/qualification directory remain intact.

All 722 final historical source hashes and final browser manifest source/script/artifact hashes reconcile with the frozen PR. The older pre-correction manifest differs in eight files and remains historical. A capture parent SHA alone is not final-source provenance. New QA results bind to `{source}` through [qualified source hashes](docs/pr13-qa1/qualified-source-manifest.json); all frozen changed artifacts have SHA256 and Git blob IDs in [the frozen manifest](docs/pr13-qa1/frozen-artifact-manifest.json). The packet manifest separately hashes the delivered review files and new outputs.

## Required next decisions

1. An independent visual reviewer accepts/rejects both changed pages at desktop/mobile, lower folds, and corrected VR-01–04, recording exact source, screenshot hashes, identity and date.
2. An accessibility specialist completes screen-reader, keyboard task and zoom/content review. The historical broad audit has 374 incomplete node occurrences; the expanded 12-audit run has **413**, including 10 target occurrences absent from its original baseline. Counts overlap and must not be added as unique defects. Neither an absent target nor zero axe violations resolves a finding. New broad run has {summary['axe_incomplete_node_count']} incomplete occurrences, also unqualified.
3. Independent security/privacy and migration reviewers assess tenant isolation, evidence distribution, existing base integration changes, operational migration/rollback/restore readiness and the dependency exception. No backend or migration delta in PR #13 removes these inherited obligations.
4. The authorized release owner decides whether to authorize restricted staging, with an explicit source, environment, disabled execution/payment scope, access limits, rollback/stop criteria and named operators. This task initiates none of it.

Evidence-to-Judgment UX remains deferred until integration and staging gates clear. Future work should reuse existing provenance and policy-bound recorded judgments/receipts, preserve Solana pre-spend and Robinhood claim-evidence purposes, and add no execution, trading, invented verdicts or unimplemented-live claims.
''')
put('PR13-QA1-GATE-MATRIX.md',f'''# PR13-QA1 gate matrix

**Overall HOLD.** Source `{head}` plus selector-only qualification commit `{source}`. Artifact hashes: [frozen](docs/pr13-qa1/frozen-artifact-manifest.json), [qualified source](docs/pr13-qa1/qualified-source-manifest.json), [packet](docs/pr13-qa1/PACKET-MANIFEST.json). PASS below means only the stated automated check; it never substitutes for independent acceptance.

| Gate | Acceptance / evidence | Qualification | Required reviewer / decision |
|---|---|---|---|
| Frozen PR identity | GitHub inventory equals Git diff, 581 files, two commits, exact base/head | PASS | Release owner must retain exact source when scheduling review |
| Homepage preservation | Source homepage/shell/tokens unchanged; new comparator zero changed pixels at 1440/390; historical controlled full/viewport images byte-identical | Automated PASS | Independent reviewer confirms preservation; existing homepage approvals are not new subpage approvals |
| Solana functionality | Original bindings unchanged; endpoint UI tests, full suite, real search journey, directory destinations/counts and existing interactions | Automated PASS | Independent acceptance of actual tasks; no live-catalog or paid execution qualification claimed |
| Robinhood functionality | Wrapper/request bindings retained; brief/analyst/receipt/contract tests; historical interaction records, new broad browser audit | Automated PASS within recorded fixtures | Independent task acceptance, especially analyst state changes and evidence continuity |
| VR-01 | Actual stale/aging/fresh/missing state plus original observation time shown before signals; stale explicitly Historical observation; narrative isolated | Tests PASS; visual HOLD | Independent visual/content reviewer accepts hero and Daily Pulse evidence at 1440/390 |
| VR-02 | Daily Receipt headline has intended hierarchy; all eight fields, date, manual state, observed time, source count, full link/share retained | Tests PASS; visual HOLD | Independent reviewer inspects full desktop receipt and native mobile clip plus ordinary viewport tiles |
| VR-03 | Solana coverage/source-state hierarchy; fixture badge prominent; exact zero/unknown/provenance retained; coverage never implies cleared route | Tests PASS; visual HOLD | Independent visual/content acceptance of source truth and separation from route judgment |
| VR-04 | Six directory cards show original exact counts plus surfaces; destinations and dimensions unchanged at eight historical widths | Tests and historical geometry PASS; visual HOLD | Independent reviewer confirms meaning, wrapping and legibility |
| Evidence provenance | 722 final source hashes and 449 final browser manifest entries reconcile; old eight-file mismatch explicitly historical; new result source `{source}` | PASS for hash binding | Hashes prove bytes, not factual truth or human approval; reviewer validates capture scope |
| Evidence privacy | All changed text/JSON triaged; 338 PNGs locally OCR-scanned, no high-confidence secret pattern; synthetic test URL matches adjudicated; metadata absent; local developer identity/path data present in 20 text artifacts | Limited automated/spot-check evidence; HOLD | Independent security/privacy owner must assess disclosure scope; no clean-secret certificate claimed |
| WebKit/browser coverage | WebKit reports unknown PushAPIEnabled protocol setting before a page is created; zero WebKit routes completed; independent diagnostic retained | Category 4; HOLD | Reproduce in a working supported browser environment; genuine browser acceptance remains required |
| Responsive behavior | Four relevant routes × 320/375/390/430/768/1024/1440; new full sweep: {route_status} | Recorded local checks only | Physical devices/virtual keyboards remain HOLD; cross-browser limitations in validation |
| Keyboard / reduced motion | Real menu Escape and disclosure journeys; broad focus/reduced-motion output; retained complete evidence | Automated PASS in recorded journeys | Manual complete task/focus-order review remains required |
| Native zoom | Six actual Chrome 200%/400% cases with metrics and interactions; no CSS zoom substitution | Automated PASS | Human checks readable and operable content; device/accessibility signoff separate |
| Automated accessibility | Zero violation nodes in recorded runs; original broad 374 and focused 413 incompletes retained; new broad {summary['axe_incomplete_node_count']} | Incomplete; HOLD | Accessibility specialist assesses targets, contrast uncertainty and unsupported ARIA; no automatic waiver |
| 57 strict findings | 13 native-select ownership, 17 noValidate, 27 textarea resizing; identical current/baseline file-rule-message multisets | FAIL exit 2; all category 4/open | Independent design/accessibility owner accepts documented exceptions or requires separately scoped fixes |
| Full route denial-path harness | Two proof URLs return identical base/candidate HTTP 401 JSON without specialized nav; full runner still demands nav | Category 2; failed qualification gate | Separately scoped harness correction or explicit acceptance-owner decision; no weakening of original checks here |
| Duplicate React keys | Five original expanded-Analyst duplicate-key warnings for unverified_contract_required, present before/after; risk of identity/omission on updates | Category 4; HOLD pending assessment | Engineering/acceptance owner must exercise filter/reorder/state updates and decide release impact |
| Dependency advisory | Zero production findings; one low dev esbuild advisory GHSA-g7r4-m6w7-qqqr | Category 3 conditional exception; unresolved | Security owner confirms compiled non-Windows staging and no exposed vulnerable development server; otherwise reassess |
| Tenant/security boundaries | Backend/security/schema/payment source unchanged; full DB suite, ten real journeys, new authenticated browser matrix, cross-tenant 404 and cleared prior private content | Local tests PASS; independent HOLD | Reviewer independent of implementation validates tenant/agent isolation, receipt authority, auth recovery and no credential exposure |
| Migration impact | Zero changes to migrations/package lock/backend; migration inventory and fresh disposable DB migration command pass | Delta PASS; operational HOLD | Independent migration owner reviews inherited base, data compatibility, rehearsal, backup/restore and rollback; no production migration run |
| CI | No PR-triggered workflow runs returned for frozen SHA; local results recorded independently | No CI approval inferred | Release owner verifies required exact-source CI or documents its absence before gate decision |
| Operational release | No financial execution, staging, merge, deployment, force push or backend authority change | HOLD | Explicit restricted-staging authorization required from release owner; distinct from visual/accessibility/security acceptance |

Finding classes: **1** new regression; **2** pre-existing release-blocking; **3** pre-existing nonblocking with explicit limited justification; **4** requires human assessment. [Finding register](docs/pr13-qa1/FINDINGS.md) includes every static finding and both accessibility records. An inherited finding remains unresolved until assessed. The previous Search ambiguity is class 2 for qualification and corrected only on the qualification branch. The full route harness still has two inherited private-proof denial-route failures and remains unqualified; no additional harness assertions were weakened.

A genuinely independent reviewer must not be the author of the refactor or this automated qualification report. Visual, manual accessibility, security/privacy and migration signoffs require accountable humans with appropriate expertise; this agent and its test outputs provide none of those approvals. Store reviewer identity, date, exact source/manifest hashes, scope, decision, limitations and follow-up conditions. Operational authorization is separately issued by the authorized release owner.
''')
# A compact mapping for every changed application file; exact full hashes remain machine-readable.
E='docs/ui-unification/visual-corrections';B=E+'/evidence';S='https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/blob/'+head+'/'
components=[
('src/web/radarApp.tsx','Solana hero/source/coverage, home-only labels','tests/radar-endpoint-intelligence.test.tsx',['after-solana-evidence-desktop.png','after-solana-evidence-mobile.png']),
('src/web/radarNetworks.tsx','Home-only directory count labels','tests/radar-endpoint-intelligence.test.tsx',['after-solana-directory-desktop.png','after-solana-directory-mobile.png']),
('src/web/radarSubpages.css','Scoped Solana layout, responsive controls and focus','tests/radar-subpage-presentation.test.tsx',['after-solana-desktop.png','after-solana-mobile.png']),
('src/web/rhChainSignalDeskPages.tsx','Home wrapper/context, preserved requests and narrative','tests/radar-subpage-presentation.test.tsx',['after-robinhood-desktop.png','after-robinhood-mobile.png']),
('src/web/rhChainSignalDeskV2.tsx','Market state, receipt hierarchy, shared labels/table regions','tests/radar-subpage-presentation.test.tsx',['after-robinhood-hero-status-desktop.png','receipt-native-after-mobile.png']),
('src/web/rhChainTerminal.css','Scoped Robinhood layout, receipt typography/focus/reflow','tests/radar-subpage-presentation.test.tsx',['after-robinhood-receipt-desktop.png','after-robinhood-mobile-viewport.png']),
('src/web/styles.css','403 legacy rule selector scopes; original declarations retained','scripts/verify-radar-subpage-boundary.cjs',['homepage-control-after-desktop.png','robinhood-narrative-control-after-desktop.png'])]
rows=[]
for file,role,test,shots in components:
 rows.append('| ['+file+']('+S+file+') | '+role+' | '+link(test)+'; [full suite](docs/pr13-qa1/full-tests.json) | '+' / '.join(link(B+'/'+p,p.replace('after-','')) for p in shots)+' |')
put('PR13-QA1-EVIDENCE-INDEX.md',f'''# PR13-QA1 evidence index

Storage identity is frozen PR `{head}`, base `{base}`. New QA source is `{source}`. A storage commit and a capture source are different facts. All linked original evidence is preserved; historical source labels are not promoted to current PASS.

## Exact inventories and hashes

- [581-path name/status inventory](docs/pr13-qa1/PR13-CHANGED-FILES.txt), [classified CSV](docs/pr13-qa1/PR13-CHANGED-FILES.csv), [all changed artifact SHA256/Git blob IDs](docs/pr13-qa1/frozen-artifact-manifest.json), [complete diff hash and commit list](docs/pr13-qa1/diff-summary.json).
- [Original source manifest](docs/pr13-qa1/frozen-source-manifest.json), [qualified source manifest](docs/pr13-qa1/qualified-source-manifest.json), [new packet artifact manifest](docs/pr13-qa1/PACKET-MANIFEST.json).
- Final original source manifest SHA256: `{sha(E+'/source-hashes.json')}`; final browser provenance SHA256: `{sha(B+'/final-browser-provenance.json')}`. [Independent reconciliation](docs/pr13-qa1/provenance-reconciliation.json): 722 source entries and 449 browser source/driver/artifact entries match. Supplementary native receipt is included in the 581-artifact manifest.

## Application-to-proof map

Every application row below also binds to the final original [source manifest]({E}/source-hashes.json), [browser provenance]({B}/final-browser-provenance.json), [preservation comparison]({B}/comparison-results.json), [focused corrections]({B}/after-corrections-results.json) and the new qualified-source/full-test manifests.

| Changed application file | Review scope | Tests / checks | Final original screenshots |
|---|---|---|---|
'''+ '\n'.join(rows)+f'''

Homepage remains outside the change set: source `src/web/homepage.tsx`, `homepage.css`, shared shell/tokens and entry router are unchanged. [Original control equality]({B}/homepage-control-results.json) and [new approved comparator](docs/pr13-qa1/visual-comparison/results.json) are distinct checks; the new comparator updates no approval.

## Corrected visual acceptance references

| Item | Before / after proof | Supporting records |
|---|---|---|
| VR-01 | [Hero before]({B}/before-robinhood-hero-status-desktop.png) / [after]({B}/after-robinhood-hero-status-desktop.png); [mobile after]({B}/after-robinhood-hero-status-mobile.png); [Daily Pulse after]({B}/after-robinhood-pulse-mobile.png) | Actual source-state tests; original timestamps preserved |
| VR-02 | [Desktop before]({B}/before-robinhood-receipt-desktop.png) / [after]({B}/after-robinhood-receipt-desktop.png); [complete mobile before]({B}/receipt-native-before-mobile.png) / [after]({B}/receipt-native-after-mobile.png) | [Native capture provenance]({B}/receipt-native-capture.json); ordinary [top]({B}/after-robinhood-mobile-tile-rh-v2-receipt-1.png) / [bottom]({B}/after-robinhood-mobile-tile-rh-v2-receipt-2.png) |
| VR-03 | [Panel before]({B}/before-solana-evidence-desktop.png) / [after]({B}/after-solana-evidence-desktop.png); [mobile after]({B}/after-solana-evidence-mobile.png) | Source-mode/unknown/zero tests and explicit coverage disclaimer |
| VR-04 | [Directory before]({B}/before-solana-directory-mobile.png) / [after]({B}/after-solana-directory-mobile.png) | [All-width count geometry]({B}/directory-count-geometry.json); exact six counts/destinations |

These are **review candidates**. VR-05/06 remain recommendations outside this task. The full original [visual review]({E}/VISUAL-REVIEW.md) indexes both widths and narrative controls.

## Review order and retention classification

| Group | Treatment |
|---|---|
| 7 runtime files | Review all diffs using component map; no backend authority, homepage, migration or dependency changes |
| 12 tests/validation scripts | Ten added browser/boundary scripts and two test files. Compare assertions and harness scope; QA1 adds only the separate selector commit |
| 371 qualification/governance files | Keep source/boundary/command/failure/provenance and final before/after comparisons needed to qualify this refactor |
| 191 superseded/historical files | Earlier cyan captures, failed attempts, first passes and retired-main records. Retain for audit; final corrections supersede their acceptance role |
| 547 files flagged for security/privacy inspection | Overlapping flag, not an extra file category. JSON/log/text and 338 PNGs triaged; [assessment](docs/pr13-qa1/security-privacy-assessment.json), [OCR records](docs/pr13-qa1/screenshot-text-scan.json) |
| Exact duplicate evidence | 72 groups, 149 extra copies. [Per-path groups](docs/pr13-qa1/evidence-triage.json); no deletion proposed as an automatic action |

`baseline/current-main/` documents the retired main, not the selected integration source. `baseline/` establishes the selected cyan source; `evidence/cyan-baseline/` and `validation/` document initial unification and the temporary adapter. `visual-corrections/` documents reviewed parent `7f44417f` → frozen final source. Earlier mismatched manifests remain historical. The new ten-journey evidence supersedes the temporary adapter as qualification proof without erasing either failed or passing original attempts.

[GitHub metadata](docs/pr13-qa1/github-0.json), [comments](docs/pr13-qa1/github-1.json), [all filenames](docs/pr13-qa1/github-2.json), [reviews](docs/pr13-qa1/github-reviews.json), [review threads](docs/pr13-qa1/github-threads.json), [workflow snapshot](docs/pr13-qa1/github-workflows.json) were read-only retrievals. No external comment, review or approval was posted.
''')
# All raw commands and outputs are linked rather than paraphrased as universal passes.
cmdrows=[]
cross=load('docs/pr13-qa1/cross-browser-checks.json')['checks'] if (o/'cross-browser-checks.json').exists() else []
for c in checks+browser+extended+cross:
 code=c['exit_code'];name=c['name'];cmd=' '.join(c['command']);cmdrows.append('| '+name+' | `'+cmd.replace('|','\\|')+'` | '+str(code)+' | '+link('docs/pr13-qa1/'+c['log'])+' |')
put('PR13-QA1-VALIDATION.md',f'''# PR13-QA1 validation

Qualified source/harness `{source}` directly descends from frozen PR `{head}`. Node **v24.21.0** matches the engine; [runtime identity](docs/pr13-qa1/runtime.json) includes executable SHA256. Fresh PostgreSQL **16.15** listens only on `127.0.0.1:55441`; synthetic DBs are `pr13_qa1`, `pr13_qa1_resilience` and `ui_int2_browser`. No production data or financial execution. The browser app uses final compiled source on `127.0.0.1:8819`, payments/execution/jobs disabled; generated local issuer private material stays outside committed review evidence.

## Recorded commands

[Core command records](docs/pr13-qa1/checks.json), [supplemental commands](docs/pr13-qa1/supplemental-commands.json), [browser first pass](docs/pr13-qa1/browser-checks-first-pass.json), [browser corrected environment](docs/pr13-qa1/browser-checks.json), [extended browser records](docs/pr13-qa1/extended-browser-checks.json) preserve exact argument arrays, environment overrides, elapsed seconds, exit codes and raw output. Browser captures run in a separate archived checkout so fixed output paths cannot overwrite original evidence or approved references. No assertion or timeout was changed.

| Check | Command | Exit | Complete output |
|---|---|---|---|
'''+ '\n'.join(cmdrows)+f'''

## Outcomes and failure interpretation

- Full Vitest: **{full['numPassedTests']:,} passed / {full['numFailedTests']} failed / {full['numPendingTests']} pending**, 283 files; default test timeouts and two workers. [Complete assertion JSON](docs/pr13-qa1/full-tests.json). Build retains native-loader/large-chunk and existing deprecation warnings in raw output.
- The actual-page [focused regression](docs/pr13-qa1/search-selector-regression.json) reproduces the original strict-mode ambiguity, checks the single scoped match, receives HTTP 200 and proves all other harness bytes unchanged. The corrected original harness passes **10/10 journeys**, including receipt ownership, cross-tenant 404, prior private content clearing, password masking, absent URL/storage credentials, anonymous RH private-request avoidance and Escape menu dismissal.
- Responsive selected run: **4 routes / 28 width cases**, zero failures in the selected scope; full sweep: **{route_status}**. The full runner exits 1 on two private-proof URLs whose HTTP 401 denial responses contain no `.radar-specialized-nav`. [Matched baseline probe](docs/pr13-qa1/proof-route-probe.json) reproduces the same responses against the base frontend and unchanged API with matched synthetic identity configuration. This is an inherited harness coverage defect, not an established new application regression. The summary field `viewport_checks=973` is nominal (139×7); only 959 layout records actually exist. The two failed routes never reach their width loop. [Selected summary](docs/pr13-qa1/routes/summary.json); [full summary](docs/pr13-qa1/full-routes/summary.json). Generated route inventory has 139 concrete cases from 130 unchanged patterns, compared with 137 previous examples. Inventory size is not a new route-feature count.
- Broader browser: **33 route/view audits, 8 reflow checks, no HTTP/overflow/axe/private-request failures**; actual authenticated tenant/agent/expired/missing/invalid credential matrix also passes. [Summary](docs/pr13-qa1/unified-browser/summary.json), [tenant matrix](docs/pr13-qa1/unified-browser/authenticated-tenant-browser.json), [keyboard/reduced motion](docs/pr13-qa1/unified-browser/keyboard-reduced-motion.json).
- [Native zoom](docs/pr13-qa1/native-zoom/after-native-zoom-results.json): six actual Chrome 200%/400% cases pass. [Focused axe](docs/pr13-qa1/accessibility/after-accessibility-results.json): 12 expanded/default audits, zero violation nodes, incompletes retained. New broad audit has {summary['axe_incomplete_node_count']} incomplete occurrences, not resolved accessibility findings.
- Approved comparator **exit 1 / REVIEW_REQUIRED**: four changed Solana/RH desktop/mobile images. Homepage and Spend Terminal: zero changed pixels both widths. Receipts: below existing 0.005 threshold. [Results](docs/pr13-qa1/visual-comparison/results.json). No reference or tolerance was changed.
- Preservation checker **exit 1**, exclusively because the intentionally corrected journey script differs from its original protected-source manifest. All other protected files, original TSX interaction/navigation/state/request bindings and 295 legacy CSS rules remain equal. [Original failure](docs/pr13-qa1/boundary.json) and [supplemental reconciliation](docs/pr13-qa1/boundary-reconciliation.json). The checker was not patched or waived.
- Strict static audit **exit 2**, all 57 findings remain. [Current output](docs/pr13-qa1/static-audit.json), [independent zero-new/zero-resolved comparison](docs/pr13-qa1/static-comparison.json).
- `npm audit --omit=dev --json` exits 0, zero production findings. Full audit exits 1, one low esbuild development advisory. The [GitHub-reviewed advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) limits the issue to a Windows development server; the package remains vulnerable and unchanged. A compiled non-Windows staging exception requires security owner confirmation.

## Retained environment failures and recovery

`npm ls --depth=0` exits 1 against the linked dependency tree, reporting latest-spec/symlink packages invalid/extraneous. [Direct integrity verification](docs/pr13-qa1/dependency-integrity.json) independently matches **185 installed package versions** to the frozen lock with zero mismatches; platform-optional absent packages are listed. Package/lock files are unchanged. This listing failure is retained, not reported as PASS.

Initial QA launcher used unsupported `MONITOR_MODE=off` and exited before readiness. It was corrected to the existing supported `disabled` value without any application edit; [first startup error](docs/pr13-qa1/logs/server-first-attempt.log). Initial route check failed because ephemeral `randexp` was missing. [Exact recovery command](docs/pr13-qa1/qa-tools-command.json) installs cached `randexp@0.5.3`/`pngjs@7.0.0` offline into an isolated QA runtime, with scripts disabled and no app dependency edits. Rerun passes. Initial broad browser run omitted its synthetic tenant key and timed out waiting for the authenticated insufficient-evidence result. It was rerun with the original supported tenant/other-tenant/wrong-agent/expired-key environment; assertions and timeouts remained unchanged. Failed logs and partial results remain under `unified-browser-first-pass/`. The baseline comparison launcher also initially passed options in the store argument position; it was corrected locally to the original three-argument `createApp` API. A first anonymous baseline probe returned 503 with identity unconfigured versus candidate 401; matching the synthetic identity configuration reproduced identical 401 denials. Both setup failures are retained in logs; neither changed application source or the original test harness.

Local Apple Vision accurate OCR scans all 338 original committed screenshots (identical hashes reuse results), no failures. The 22 matches are credential labels; no provider-token/private-key/email pattern matched. [Text/JSON triage](docs/pr13-qa1/evidence-triage.json), [OCR records](docs/pr13-qa1/screenshot-text-scan.json), [privacy limits](docs/pr13-qa1/security-privacy-assessment.json). Identifying local developer username/absolute paths occur in 20 committed text artifacts; [per-file privacy triage](docs/pr13-qa1/personal-information-triage.json). These checks do not certify absence of sensitive data.

## Checks not qualified

No human visual approval, manual screen-reader testing, physical-device/virtual-keyboard tests, field Web Vitals, independent security/migration signoff, restricted staging, production migration rehearsal or production data test was performed. WebKit launches successfully; the route run is separately recorded: **{webkit_status}**. [Recorded termination](docs/pr13-qa1/webkit-route-termination.json) and [partial Chromium output](docs/pr13-qa1/webkit-routes/chromium-qualification.json). Availability alone is not acceptance. No Firefox acceptance run or cross-browser approval is claimed. The independent 45-second WebKit diagnostic also stalls after context creation, before a page exists; [diagnostic](docs/pr13-qa1/webkit-diagnostic.json). This browser/environment qualification remains blocked; no Safari/device acceptance is inferred. Missing manual/device/operational gates remain HOLD. Original browser correction/interaction/control evidence is retained and hash-verified, not silently recaptured over approved screenshots.

Only QA1-owned local services are stopped after checks; [browser cleanup](docs/pr13-qa1/browser-cleanup.json), [extended cleanup](docs/pr13-qa1/extended-browser-cleanup.json), [final preservation and cleanup](docs/pr13-qa1/final-integrity.json). Existing preview services and unrelated databases remain untouched. Each new artifact is hashed in [the packet manifest](docs/pr13-qa1/PACKET-MANIFEST.json).
''')
put('docs/pr13-qa1/FINDINGS.md',f'''# Finding register

All classifications are scoped to PR13-QA1; unresolved inherited findings are not accepted merely because they predate this PR. No unrelated fixes were made.

| ID / finding | Class | Disposition / justification | Evidence |
|---|---|---|---|
| HARNESS-01 ambiguous Search | 2: Pre-existing and qualification-blocking | Corrected only in `{source}`; original assertions/timeouts/security remain. Frozen PR retains original script. Locally verified, not a review approval. | search-selector-regression.json; journeys/results.json |
| STATIC-01 through STATIC-57 | 4: Human assessment | All remain unresolved. Thirteen select ownership decisions, seventeen native form-validation decisions, twenty-seven textarea-resize decisions. A rule match alone does not prove a usability defect; per-finding decisions required. Strict gate still fails. All 57 five-line source contexts also match the exact base ([proof](static-baseline-lines.json)). | [All 57 rows](STATIC-FINDINGS.md); static-findings.json; static-comparison.json |
| AXE-BROAD | 4: Human assessment | Historical 374 node occurrences across 33 route/view audits are aggregate counts, without per-node targets in that report. Reviewability limitation preserved. New broad run has {summary['axe_incomplete_node_count']}, not an automatic resolution of two. | accessibility-incomplete.json; ../../docs/ui-unification/visual-corrections/existing-unified/results.json |
| AXE-FOCUSED | 4: Human assessment | 413 expanded/default node occurrences have targets; original baseline had 469. Ten unmatched candidate occurrences require assessment (all Solana contrast uncertainty); 66 absent occurrences are not proven resolved. Counts overlap broad audits. Zero violations does not settle incompletes. | accessibility-incomplete.json; axe-before-after.json; ../../docs/ui-unification/visual-corrections/evidence/after-accessibility-results.json |
| HARNESS-02 proof denial routes | 2: Pre-existing and qualification-blocking | Full sweep expects specialized nav on two anonymous HTTP 401 denial responses. Exact base/candidate probe matches; retain failed full gate. Separate scoped harness correction or owner decision required; not fixed as unrelated work. Nominal 973 widths are only 959 observed records. | full-routes/summary.json; proof-route-probe.json |
| REACT-KEY-01 through 05 | 4: Human assessment | Five before/after expanded-Analyst warnings repeat unverified_contract_required. React identity collisions can omit/duplicate evidence on updates. No sufficient state-transition proof to grant nonblocking status. No key fix in this task. | ../../docs/ui-unification/evidence/cyan-baseline/analyst-console-diagnostics.json; src/web/rhChainSignalDeskV2.tsx AnalystIndexTable |
| DEP-01 esbuild | 3: Pre-existing and conditionally nonblocking | Low development advisory remains. Scope-specific rationale: current local macOS and proposed compiled non-Windows runtime do not use the affected Windows esbuild development server. Production audit zero; security owner must confirm deployment topology and accept exception. Windows developer serving requires separate correction. | logs/audit-all.log; logs/audit-production.log; [advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) |
| VISUAL-01 through 04 | 4: Human assessment | Four intentional redesigned-page captures differ from approved references. New review artifacts, not an established unintended regression. Independent acceptance required; baseline never replaced. | visual-comparison/results.json |
| A11Y-MANUAL / DEVICE | 4: Human assessment | Screen-reader, complete keyboard tasks, physical devices and virtual keyboards remain unqualified. These missing qualification gates block release. | PR13-QA1-GATE-MATRIX.md |
| SECURITY / PRIVACY / MIGRATION | 4: Human assessment | Tests and no delta cannot settle inherited base security/operational readiness. All original committed text and PNGs triaged with limitations; independent signoff pending. | security-privacy-assessment.json; qualified-source-manifest.json |
| OPS-AUTHORIZATION | 4: Human assessment | Required staging authorization absent. Release-blocking until explicit decision; no automatic authorization from any PASS. | PR13-QA1-GATE-MATRIX.md |
| BROWSER-WEBKIT | 4: Human/environment assessment | Browser launches and context creation succeeds but newPage stalls; the original runner reports Page.overrideSetting unknown PushAPIEnabled, indicating cached-browser/protocol incompatibility. Original route run stopped after 4m45s with zero WebKit routes complete; no timeout/assertion edit and no cross-browser PASS. Independent diagnostic confirms stall. | webkit-route-termination.json; webkit-diagnostic.json |
| ENV-NPM-LS | 3: Nonblocking local tooling limitation | Listing exits 1 for linked/latest packages, but every 185 installed version independently matches lock. No ignored dependency drift. | dependency-integrity.json; logs/dependencies.log |
| QA1 setup attempts | Environment setup failures, not application regressions | Unsupported launcher mode, absent external QA helper and missing synthetic browser key corrected only in local setup. Failures and reruns retained. | PR13-QA1-VALIDATION.md |

No new application regression was established by the completed local checks; this is not proof of no regression. Category 4 items explicitly require humans to decide whether a pre-existing issue is blocking, nonblocking under a documented exception, or a new regression. An unqualified mandatory gate keeps the overall recommendation HOLD.
''')
print('Four packet documents and finding register generated')
