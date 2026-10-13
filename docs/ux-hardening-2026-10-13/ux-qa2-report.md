# UX-QA2 acceptance review — HOLD

**Candidate: `3d4f846349f2ef02be11c349f57bbc598cf41435`. Recommendation: HOLD for integration and release.** The delivered regression suite passes, but additional acceptance probes reproduce incomplete search classification, malformed share recovery and receipt-denial focus. Scoped visual approvals and mandatory external review/device/accessibility gates remain open. The candidate is available for controlled remediation review; it is not fully accepted for integration.

This is fresh technical reinspection and reproducible automated acceptance evidence. The reviewing assistant also implemented the candidate. **It does not satisfy independent human UX, security or migration approval.** No independent approval is self-certified, no golden files are replaced, and no application changes, dependency changes, merge or deployment occurred during QA2. G1 remains inherited **PASS**; G2 remains **HOLD** until the scoped corrected Solana images receive human approval.

## 1. Exact candidate and suite reconciliation

| Evidence | Verified result |
|---|---|
| Delivery `3d4f846` | Full SHA `3d4f846349f2ef02be11c349f57bbc598cf41435`; branch `codex/radar-ux-hardening-ux01-13`; clean at review entry. |
| Frozen application/test source | `1e7114e8549497d592f324c55a4ecf67065dced4`. Delivery has identical `src`, `tests` and `migrations` Git trees. |
| Intervening measurement commit | `6bd0e7f181905ab2552081c42625a7e87ede59b0` changes only the performance harness, replacing the fake clock with Date-only control and native resource assertions. Delivery adds documentation/evidence. |
| Latest approved secure integration ref | `codex/radar-terminal-secure-integration` still resolves to `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`, an ancestor of delivery. Its qualified application baseline is `35f2e54a288311d1df0f8820dacb216c27175791`. |
| Secure baseline test totals | UI-INT2 summary: **2,047 pass / 0 fail / 0 pending**, 282 files, 567 Vitest-reported suites. Earlier R2's 2,045 total is historical and is not this baseline. |
| Delivered tests | 17 new UX acceptance cases + one search race/IME/clear case = **18 added**. Existing test changes provide required synthetic keys or reconcile safe UI copy/selectors. Server/auth/payment tests were not weakened or edited. |
| Original implementation run | 2,065 pass at `1e7114e`, which has the same delivered application/test trees. This verifies the original total but is not the new QA2 run. |
| Fresh QA2 delivered run | **2,065 pass / 0 fail / 0 pending**, 283 files, 568 Vitest-reported suites, run at the exact delivery SHA with disposable PostgreSQL. Summed per-file counts equal 2,065. |
| Additional QA2 acceptance probes | **8 cases: 1 pass / 7 fail / 0 pending**, in a separate explicit configuration. They do not change the delivered suite's count. The seven failures represent four finding groups, not seven independent product defects. |

[Delivery/tree/hash verification](evidence/qa2/delivery-verification.json), [fresh commands and exit codes](evidence/qa2/system/check-results.json), [full test summary](evidence/qa2/system/full-test-summary.json), [additional probe results](evidence/qa2/adversarial-results.json), and [reproduction instructions](evidence/qa2/reproduction.md) preserve the distinction. The original report's 13 functional PASS dispositions were verified as present, then independently challenged against source, registered criteria and fresh observations rather than accepted as proof.

## 2. UX-01–UX-13 acceptance matrix

PASS below means the specified bounded technical acceptance criteria were rechecked. It never grants independent human approval or overrides the global gates. HOLD means a reproduced acceptance gap or a scoped approval prerequisite remains. No item is BLOCKED from technical inspection. **6 PASS / 7 HOLD / 0 BLOCKED.**

| ID | QA2 | Fresh inspection and acceptance result | Remaining requirement |
|---|---|---|---|
| UX-01 | PASS | Spend's first-time guidance names operator-issued tenant/agent context and links `/developers`. Empty key prevents protected dispatch and focuses the key; actual invalid identity produces generic linked feedback and re-enabled key focus. Request-client/backend ownership and authorization remain unchanged. Fresh screenshots 02/03 and full UX/auth regressions support this bounded Spend result. | Global independent/device/AT gates still apply. Separate receipt-focus finding QA2-04 does not establish a failure of the registered Spend focus case. |
| UX-02 | HOLD | Initial/draft no longer report no results; generation guards prevent stale/cleared/unmounted responses from committing; IME/loading/valid empty/503/parse-error/retry regressions pass. However **HTTP 200 `{}`, `{data:{}}` and `{data:null}` all become successful “No matching providers.”** Fresh browser injection and three failed probes confirm it. | Validate the response envelope before classifying a successful empty result; distinguish invalid contract from legitimate `data:[]`, then regress. |
| UX-03 | HOLD | Direct unknown shares retain Robinhood shell/query context and owning recovery; the narrow router removes Solana fallback. Supported shared-object source/canonical links pass delivered tests. **Malformed percent encodings `%E0%A4%A` / `%FF` throw through `decodeURIComponent` and replace the task with global initialization recovery.** Two failed probes verify the missing local reader recovery. | Guard decoding/invalid IDs and supply owning-family recovery. In-app navigation blocked invalid URL bytes; no live-browser malformed-ID pass is claimed. No Solana redirect or cross-network private-data leak was observed. |
| UX-04 | HOLD | Missing public readers now provide safe language, task titles, GET retry and return links. Private 403/404 remain indistinguishable; malformed private payloads are not echoed; pending/missing states never authorize spend. **Successful malformed share `{data:{}}` is accepted as ready and crashes into the global error panel**, with no local reader return action. Receipt 401 focus also fails (QA2-04). | Validate public share data before rendering; retain truthful local unavailable/retry states. Correct receipt denial focus after controls re-enable. No backend security behavior change is requested by this review. |
| UX-05 | HOLD | Current required/range/step rules, finite numeric checks, persistent messages, described errors, first-invalid focus and retained values pass fresh delivered cases. No payment or automatic paid retry appears. | Spend's scoped guidance/reveal geometry differs from approved images. Explicit scoped visual approval and real keyboard/AT validation remain required. Functional criteria pass; acceptance is not visually approved. |
| UX-06 | HOLD | Source limits the spacing change to actual record tiles; reference tiles stay unchanged. Fresh mobile inspection shows distinct title/status/detail and truthful pending/missing stages. Homepage pixels remain identical. | Approve scoped actual-lifecycle/receipt spacing differences; do not change homepage or Solana goldens to accommodate them. |
| UX-07 | HOLD | Parsed returned fields alone populate the summary. Actual owned pending receipt inspection shows lineage/time/status/cost and a parent link; no ancestor record is automatically loaded or credential carried. JSON disclosure remains; no absent stage becomes verified. | Human review of scoped receipt summary/layout and manual evidence-inspection accessibility remain open. |
| UX-08 | PASS | Rechecked the exact catalog-match dossier link and unknown-subject contextual fallback in source and the fresh known/unknown tests. Reasons/confidence remain server supplied; no invented gap or test cap is added. Routes displays the retained subject with an authorization disclaimer. | Global review gates apply; no additional functional gap found in this registered criterion. |
| UX-09 | PASS | Fresh unit history/invalid-value tests pass. In-app inspection of service/risk URL state, native sort focus and reload retains the selected service/risk and subject; source preserves other parameters/hash and existing sort/cards. | Native popup visual capture/real-device behavior is not certified. |
| UX-10 | PASS | Rechecked heading-level props, shared-shell context and unchanged visual selectors. Delivered heading/landmark regressions and fresh browser route checks pass; registered missing tasks have titles. | Manual screen-reader landmark traversal remains a global gate. Global fallback for malformed share cases remains covered by UX-03/04 holds. |
| UX-11 | PASS | Narrow `/4663` family boundary preserves existing readers/Reflexive/PLTR; fresh identical-fixture replay confirms **62.02%** encoded JS/CSS reduction for the measured share route. Homepage/Spend split remains. | Broader Solana payload, field latency/INP and real mobile performance are not qualified. No generic faster-interaction claim. |
| UX-12 | HOLD | Shared key field is default masked, reveal state/name/association are accessible, keyboard activation tests pass, paste is not intercepted, and no URL/local/session storage is introduced. Mobile CSS input remains usable. | Explicit Spend/receipt visual approval and actual iOS/Android virtual-keyboard/reveal behavior remain mandatory; receipt permission-denial focus finding remains open. |
| UX-13 | PASS | Fresh private-proof shell uses `/receipts` Proof archive breadcrumb and matching context, retaining global navigation. Source tests and mobile screenshot observations agree. | Global independent review gates still apply. |

The original register/ledger remain intact. This matrix concerns the delivered candidate, not a revised implementation. [Machine-readable matrix](evidence/qa2/acceptance-matrix.json).

## 3. Reproduced findings and security-sensitive assessment

**QA2-01 — P1, UX-02:** `src/web/radarApp.tsx:9649` converts any non-array `data` to `[]`, then sets `success`. The empty state therefore asserts a search outcome that an invalid response never established. Three supplementary tests fail the expected contract-error behavior; screenshot 12 captures the injected HTTP 200 `{}` result. Legitimate empty arrays must continue to mean no matching providers.

**QA2-02 — P2, UX-03:** `src/web/rh4663Pages.tsx:75` decodes share IDs without handling invalid encodings. The actual error boundary catches the URI error, so this is not a claimed blank document or security bypass. The task becomes “INITIALIZATION DELAYED” with generic Retry/Reload instead of owning reader recovery. The two component/error-boundary probes establish this behavior; in-app navigation to invalid bytes was blocked before application inspection.

**QA2-03 — P1, UX-04:** `src/web/rh4663Pages.tsx:45` trusts any truthy `body.data`; SocialLanding later calls string/object members without validation. HTTP 200 `{data:{}}` causes a render error. A fresh controlled preview serves unchanged client bytes with only that response injected; screenshot 09 shows the global initialization panel. The Robinhood shell stays visible and no verified evidence/spend permission is created, but task-specific unavailable-evidence recovery fails.

**QA2-04 — P2, permission recovery / UX-04 and UX-12:** `src/web/canonicalReceiptPage.tsx:38` tries to focus the key while `busy` still disables it; line 39 subsequently re-enables it without a corrective focus effect. Actual synthetic 401 inspection leaves `document.activeElement` on `BODY`; the linked generic error and `aria-invalid` are present. Both the browser observation and delayed-response test reproduce the focus failure. Spend's separate re-enable effect succeeds. This is an accessibility/recovery defect, not evidence of weaker authorization or disclosure.

All **292 tracked non-web source/migration files** match the secure baseline. Backend API contracts, SQL, receipt authority, payment boundaries, evaluation authority, authentication and tenant ownership implementations are unchanged. Manifest/lockfile are unchanged. Review of client diff confirms private request Authorization, no-store/redirect handling and parsed receipt gates remain; source-bound public GET recovery cannot create paid receipts or authorization. Fresh actual browser/API results retain 401 for absent/invalid/expired identity and 404 for other tenant or wrong agent, without credential URL/storage exposure. No cross-network restricted data leak was observed in the covered cases; exhaustive independent security approval is still required.

## 4. Fresh regression execution

Full exact-candidate typecheck, lint, build, migration inventory, **2,065 tests**, production audit, 22-migration apply/check/repeat, synthetic signing/ancestry recovery seed/backup/restore/replay and diff check pass. All-dependency audit remains HOLD for the inherited low development `esbuild` advisory; dependency files were not changed. Full-suite disposable databases were removed after success. Existing warnings about the large universal research chunk remain.

The separate eight acceptance cases deliberately assert the desired recovery/error behavior; **1 passed and 7 failed**. They must remain failures until repaired; they are not rewritten to bless the broken behavior. The same results reproduce from the preserved explicit replay configuration, outside the candidate's default test discovery. Existing tests pass while these probes fail because delivered coverage tests syntactically malformed JSON, normal 404s and default masking, but misses invalid successful search/share envelopes, malformed ID decoding and delayed private-401 focus.

Fresh broader browser qualification: **33 route/viewport checks, three CSS viewport sizes, zero HTTP/private-request/overflow/axe failures**. Its passing summary covers its specified cases; it does not override the new failures. The implementation's older 980-check route sweep remains labeled implementation evidence; QA2 did not rerun that full sweep. [Fresh browser summary](evidence/qa2/browser/summary.json).

## 5. Screenshot comparison and design gates

All ten frozen hashes still match approved files. Fresh comparison: **6 tolerance PASS / 4 REVIEW_REQUIRED**, with **zero differing pixels** for desktop/mobile homepage and Robinhood desk. These approvals remain unchanged. Desktop receipts and mobile Solana fit the historical tolerance; the latter is not an approval of its known tall-image raster defect.

| Scoped candidate | Assessment |
|---|---|
| Spend desktop/mobile | Added operator guidance and reveal control preserve the cyan terminal but change form height/geometry. Both require explicit scoped approval. |
| Receipts mobile / actual lifecycle | Stage spacing and returned-field inspection improve readability; mobile approved screenshot dimensions differ. Requires scoped approval. Desktop receipts remains within tolerance. |
| Solana desktop | Known corrected-raster/timing G2 comparison remains unresolved. The two corrected Solana images require human approval. No baseline replacement or G2 closure. |
| Routes | Fresh mobile inspection preserves shared shell/cards and shows the new subject-context sentence plus restored filters. No frozen Routes golden exists in this ten-image set; scoped visual review is still needed. |
| Providers | No provider-page component change is introduced. Fresh mobile inspection retains the same shell/cards/typography; no claim of pixel equality to an unprovided golden. |

[Fresh pixel results](evidence/qa2/visuals/results.json) and [screenshot observations](evidence/qa2/ui/observations.md) support the scoped review. UI failures on the controlled preview are explicitly labeled injected responses. Screenshots of a partially visible state were rejected rather than used as proof of the absent error/result. Screenshot comparison is not independent approval.

## 6. Accessibility findings and mandatory limits

Fresh browser automation reports zero axe violations and **382 incomplete node checks**. Eight representative keyboard focus steps show indicators; code-region scrolling, Escape dismissal, reduced-motion checks and eight CSS-width reflow cases pass. Fresh 200% root-text tests cover ten route/width pairs without document overflow. These are CSS scaling/reflow checks, not native browser-zoom qualification or screen-reader announcement validation.

In-app desktop/mobile CSS inspection confirms Spend's corrective focus and described alerts. Receipt 401 focus fails as QA2-04; visible safe feedback alone is insufficient recovery. Pending evidence remains pending, missing ancestors remain missing, source disclosure remains available, and owning archive navigation is understandable. Native sort expansion was observed in the accessibility tree; web screenshots do not certify the OS popup.

The strict static scan still has **55 findings** (15 other validation-owner, 13 native-select-owner, 27 textarea-resize), matching inherited unresolved scope. It is HOLD, not a clean accessibility verdict. No out-of-scope form redesign was performed.

**Mandatory separate HOLD gates:** actual iOS/Android devices and virtual keyboards, native zoom/device text settings, VoiceOver/TalkBack/NVDA traversal and announcements, incomplete-axe adjudication, and independent manual accessibility review. No device, AT or manual accessibility qualification is claimed by these automated/UI observations.

## 7. Performance reproduction

Fresh Chrome 155.0.8059.40 replay uses the unchanged fixture hash `2ffc4fc34c0e2c901ea06b3b5fc3d021cc0eca95577b6a03b0c7fad13a9f47c1`, fixed Date and native Performance APIs, fresh routed contexts, blocked external requests and recorded public/non-executing responses. Four routes × two widths × three paired before/after repetitions = **48 samples**. The preserved harness differs from delivery only in its output destination.

| Route | Encoded JS/CSS bytes, before → after | Change |
|---|---|---|
| `/` | 83,394 → 83,706 | +0.37% |
| `/spend-terminal` | 109,447 → 111,369 | +1.76% |
| `/solana` | 489,757 → 493,034 | +0.67% |
| `/4663/share/qualification-missing-record` | 489,757 → 186,033 | **−62.02%**, reproduced at both widths in all paired payload samples |

Fresh share-route median lab LCP is 472→368ms at 390px and 468→372ms at 1440px. The baseline renders the wrong universal/Solana destination, so this is a corrected-journey comparison with different content. Other routes vary by several milliseconds; local shared-host repetition does not establish field/interaction speed or INP. **No faster-interaction claim is approved.** Native resource-byte assertions pass; the old fake-clock preliminary data is not reused. [Fresh samples](evidence/qa2/performance-final.json) and [summary](evidence/qa2/performance-summary.json).

## 8. Remaining blockers

**HOLD.** Repair and regress QA2-01 through QA2-04 on a separately reviewable candidate, preserving fail-closed/auth/payment behavior and frozen design. Do not expand this review into a redesign or change backend contracts. Have the independent reviewer adjudicate whether the malformed-ID/global-recovery behavior meets the intended route-specific requirement; the unresolved evidence must not be called PASS in the meantime.

Obtain the required scoped Spend/receipt/Routes visual review and the two corrected Solana G2 image approvals. Complete mandatory real-device/virtual-keyboard, manual accessibility and external independent UX/security/migration review. Unchanged migration/backend diffs and green automated regressions support that review; they do not substitute for its sign-off. Keep the inherited development advisory/static findings and broad Solana/field-performance limitations explicit.

## 9. Formal integration recommendation

This candidate may be reviewed for **controlled remediation**, but is **not complete or independently accepted for integration**. G1 is preserved PASS; G2, integration and release remain HOLD. No merge or deployment authorization follows from this report.
