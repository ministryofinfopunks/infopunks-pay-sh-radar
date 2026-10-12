# Radar R2.1 accessibility review matrix

**Candidate source SHA:** `095b3b43365fb0bf890568b891074eceaeff74fe`
**Browser evidence:** [`browser/summary.json`](browser/summary.json), [`browser/results.json`](browser/results.json), and the accompanying zoom, keyboard, recovery, and authentication reports.
**Browser method:** Playwright/Chromium, 33 route and viewport combinations at desktop (1440), tablet (768), and mobile (390); eight additional 720/360 CSS reflow checks. The 720/360 checks approximate 200%/400% of a 1440 CSS-pixel viewport; they are not browser zoom UI automation.
**Axe outcome:** zero violations; 9,892 nodes in inconclusive checks. Inconclusive checks remain limitations and are not counted as passes.

| Area / interaction | Status | Evidence or limitation |
|---|---|---|
| Horizontal overflow at desktop, tablet and mobile | PASS | 33 route/viewport results; zero document or uncontained element overflow. |
| `/developers` code examples | PASS | Three bounded, labelled, focusable regions. Regions with long lines use `overflow-x:auto`; ArrowRight moved the focused region horizontally at both 720px and 360px. Short examples that fit remain unscrolled. |
| `.sr-only` geometry | PASS | Clipped 1×1 fixed geometry avoids affecting document width; CSS retains content rather than using `display:none` or `visibility:hidden`. Browser matrix reports no overflow. |
| Color contrast | LIMITATION | Axe had 7,362 inconclusive nodes. No complete manual foreground/background contrast inventory was performed; color contrast sign-off remains open. |
| ARIA attribute validity | PASS | Zero Axe violations across the route matrix; form error uses `role=alert`, result uses a polite live region, and page landmarks/labels were spot-checked. Axe inconclusive nodes remain covered by the contrast and AT limitations here. |
| Accessible names | PASS | Zero Axe violations; spend form and tenant-key input have accessible names, and navigation/action labels are present in the captured page matrix. |
| Keyboard navigation and focus order | LIMITATION | On the exact final candidate, the first eight global-navigation Tab stops had visible focus; code scroll ports were keyboard-operated. Full keyboard traversal of every dialog, filter, and interactive control was not completed. |
| Screen-reader announcements | LIMITATION | Live-region and alert semantics are present, but no human screen-reader session was run. |
| Reduced motion | LIMITATION | Browser emulated `prefers-reduced-motion: reduce`; the preference was active and document scroll behavior was `auto`. Not every animated component was individually inspected at runtime. |
| 200% and 400% zoom/reflow | PASS (CSS viewport equivalent) | All eight 720px/360px reflow routes retained content and operations without horizontal document overflow. Native browser zoom controls were not exercised. |
| Form errors and async Judgment states | PASS (tested states) | Explicit Check sent one request per run; free insufficient-evidence result, injected 503, and timeout showed recovery text/actions. Missing, invalid, and expired credential HTTP behavior is covered; a full native form-validation announcement audit remains open. |
| Auth-required private state on `/4663` | PASS | Anonymous `/4663` loaded successfully with zero private wallet, history, or reputation requests; public page remained available. |

## Sign-off

Automated reviewer: local Playwright and Axe run, Chromium version is recorded in the release report. No human screen-reader or complete contrast review is represented. Manual accessibility sign-off is **NOT COMPLETE** because contrast, assistive-technology, and complete keyboard-traversal limitations remain.
