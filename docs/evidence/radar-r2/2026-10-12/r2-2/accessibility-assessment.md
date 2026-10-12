# Radar R2.2 accessibility assessment

**Candidate source:** `ec93f8b696c19a6b30c8d9e1bb0732422f28aa90`
**Previous UI source:** `095b3b43365fb0bf890568b891074eceaeff74fe`
**Assessment environment:** Chrome/Playwright browser session on the local compiled candidate at `http://127.0.0.1:18899`; Node `v25.6.1`, development fixture catalog, in-memory persistence, payments/signing/execution disabled. This runtime is outside the supported Node 24 range and is not release qualification.
**Assessment type:** Agent-performed browser inspection and computed-style contrast sampling. It is not an independent human accessibility sign-off.

## Contrast measurements

Text colors were read from rendered elements; semi-transparent foreground/background colors were alpha-composited against their rendered ancestor surfaces. Normal text was checked against 4.5:1 and large text against 3:1. The scan is a representative rendered-text sample, not an exhaustive inventory of all routes, hover/focus/disabled states, images, charts, or color pairs.

| Route | Sampled visible text items | Lowest measured ratio | Result / note |
|---|---:|---:|---|
| `/` | 57 | 8.69:1 | Sample PASS |
| `/developers` | 128 | 7.26:1 | Active text sample PASS. Disabled `Check` control at empty credentials is intentionally unavailable and has subdued opacity; WCAG's inactive-control contrast exception applies, but its label remains a visual usability limitation to review. |
| `/spend-terminal` | 38 | 8.69:1 | Sample PASS; no tenant credential was entered. |
| `/rh-chain-signal-desk/market` | 95 | 6.53:1 after correction | Sample PASS after changing `.market-pulse-method` from `#63766b` to `#91a298`. The old computed pair was approximately 4.0:1 on the translucent market panel; corrected pair is approximately 7.23:1 with the panel composited over `#050806`. |
| `/4663` | 91 | 6.77:1 | Sample PASS; no private request or credential was used. |

These numbers are observations from the specified local fixture runtime. The assessor script does not fully resolve text over background images, all pseudo-elements, gradients, element opacity, browser forced-colors, or every interactive state. It does not replace a formal contrast audit.

## Interaction and assistive-technology matrix

| Material interaction / criterion | Status | Evidence and limitation |
|---|---|---|
| Semantic landmarks and names | PASS (spot check) | Rendered accessibility tree exposed banner, product navigation, main, named regions, labeled actions and form fields on homepage and Developers. Existing exact-source CI Axe run on `095b3b4` reported 0 violations and 9,892 incomplete nodes; rerun is required on the final follow-up head. |
| Color contrast | PASS for sampled pairs; LIMITATION for complete coverage | Measured routes and ratios above. One real small-text contrast issue was corrected. Disabled `Check` legibility and complete state/route inventory remain open. |
| Keyboard navigation / focus order | LIMITATION | Existing browser qualification recorded visible focus for the first eight global navigation stops, code-block keyboard scrolling, and all 33 route/viewport checks. This turn did not complete a keyboard-only traversal of every control, menu, dialog, filter and form on the exact final commit. A human keyboard review remains required. |
| Screen-reader announcements | LIMITATION / NOT TESTED | Chrome accessibility tree inspection is not VoiceOver or NVDA. Native macOS VoiceOver and NVDA were not run. Announcements for skip navigation, menu state, form validation, async result, failure/recovery and focus changes need a human AT reviewer. |
| Reduced motion | LIMITATION | Previous exact-source CI evidence on `095b3b4` emulated `prefers-reduced-motion` and observed scroll behavior. Not every animated component was manually inspected on the new source. |
| Native browser zoom at 200% and 400% | NOT TESTED | Prior CI used 720px/360px equivalent viewport widths; that is reflow evidence, not native browser zoom. Test browser zoom controls and verify no lost content or operation. |
| Form errors and async Judgment states | PASS in existing automated evidence; LIMITATION for AT | Previous compiled-browser evidence covered one explicit Check request, insufficient-evidence, injected service failure, timeout recovery, and credential HTTP outcomes. No tenant credential was entered in this local visual review; no real payment was made. Human announcement/focus review remains open. |
| Touch / real mobile assistive technology | NOT TESTED | Desktop browser viewport checks are not iOS Safari, Android Chrome, VoiceOver, or TalkBack device testing. |
| Motion, status, and color-only meaning | LIMITATION | Existing automated checks are retained; a full manual state-by-state check that status is not communicated by color alone is pending. |

## Disposition

Accessibility is **HOLD**, not signed off. The scoped market-label contrast defect is corrected, but the requested human assessment is not complete without VoiceOver or NVDA, full keyboard traversal, native 200%/400% zoom and independent review of remaining limitations. Do not interpret Axe's zero violations or this computed-style sample as WCAG 2.2 AA certification.
