# Qualification evidence and assessment

## Current-run results

| Check | Result | Evidence / meaning |
|---|---|---|
| Named candidate/source attribution | PASS, local | `d3d0a445…`; running preview/API cwd is the integration checkout; no application/test/migration/dependency delta against qualified `35f2e54…`. |
| Customer route sweep | PASS for captured width/state only | 138 samples cover all 129 customer router patterns; 390px document overflow 0. Internal console excluded. [JSON](evidence/route-sweep.json). |
| Representative responsive checks | PASS for geometry/identity only | 12 surfaces × 7 widths = 84 checks, no document overflow, one product header/footer, cyan action token. [JSON](evidence/responsive.json). |
| Mobile menu | PASS, observed local browser | Open, Escape-close, focus restored to `Open navigation` button. [Screenshot](evidence/12-mobile-navigation.jpg). |
| Tenant-aware Spend / receipt observations | PASS for observed synthetic boundaries | Real local free insufficient response; pending Execution; Evaluation record; cross-tenant denial clears prior record. No live payment, execution or verified service outcome asserted. |
| Existing design guard | PASS | `npm run check:design`: 130 patterns, no workflow root tokens. |
| Focused regression | PASS | `npx vitest run tests/spend-terminal-canonical.test.tsx tests/ui-int2-receipt-inspection.test.tsx tests/radar-navigation-responsive.test.ts tests/homepage-performance.test.tsx tests/radar-delayed-malformed-range.test.tsx`: **5 files, 19 passed, 0 failed**. These are unit/jsdom/source guards, not full browser or axe qualification. |
| Premium strict static audit | HOLD | Exit 2; 57 findings: 17 form validation-owner, 13 native-select ownership, 27 textarea resizing. [Report](evidence/premium-static-audit.json). These are static contract findings, not 57 WCAG failures. The generated untracked scanner report was moved out of the integration checkout; source stayed unchanged. |
| Frozen/current comparison | HOLD | Ten inspected viewport pairs, same crop geometry. JPEG/current vs PNG/frozen plus dynamic data/capture differences prevent pixel PASS. [Design QA](design-qa.md). |
| New full suite / build / typecheck | PENDING APPROVAL | Not rerun as post-change qualification; no application implementation has occurred. Full suite and build are mandatory after authorized changes. |
| New axe / AT conformance | HOLD | Current DOM/error/focus review does not certify WCAG2.2 AA. No new axe sweep or screen-reader sign-off is claimed. |

## Accessibility results

Observed strengths: labeled controls, masked credentials, semantic buttons/links, visible focus, live insufficient-evidence result, generic private denial, native disclosures and restored menu focus.

Observed corrective needs: Spend key errors are not programmatically associated with the key; native budget validation is not app-owned; lifecycle status grouping is visually unclear; task heading/landmark ownership differs across legacy routes. Neither screenshots nor generic static findings establish AA conformance or precise failure of every related criterion.

The inherited candidate qualification reports zero WCAG-tagged axe violations for its route sweep, plus inconclusive checks requiring human review. That is historical evidence, not a new result from this audit. Automated AA checks must be repeated on the authorized final implementation, with violations, incomplete nodes, manual contrast, full keyboard traversal and status announcements recorded separately.

## Browser/mobile qualification

The current audit uses the Codex in-app Chromium surface on macOS with CSS viewport overrides. It is not mobile-device emulation, iOS Safari, Android Chrome, physical touch or virtual-keyboard testing. Native browser zoom, VoiceOver, TalkBack, reduced-motion/high-contrast states and supported browser engines remain to be run after approval. The inherited WebKit trial hung; no Safari pass can be inferred.

The route sweep captures initial and naturally degraded states. It does not certify all visible evidence is operable inside local overflow, every select popup, every detail record or every form completion. Test-spend, deterministic denial, pending Evaluation and controlled full outage/retry remain explicit journey qualification gaps.

## Performance comparison

Current-run direct measurement: compiled research JS **1,562,518 raw / 310,646 gzip bytes**; research CSS **406,690 / 67,244**. Entry JS **233,449 / 70,888**. [All current chunks](evidence/current-bundles.json). These are build-file bytes, not actual transfer sizes, runtime timings or INP.

The following is the **frozen prior Lighthouse laboratory comparison**, read from the candidate's `docs/design-system/ui-int2/evidence/performance/summary.json`; it was not rerun or produced by this audit:

| Prior case | Secure target LCP | Approved candidate LCP | Candidate TBT / CLS |
|---|---:|---:|---|
| Homepage mobile | 1509ms | 1508ms | 0ms / 0 |
| Homepage desktop | 365ms | 489ms | 0ms / 0 |
| Spend mobile | 1958ms | 2153ms | 0ms / 0 |

Those measurements used Lighthouse 13.5/Chrome154, one sample per case. They contextualize the approved candidate, not a new UX-hardening speed result. No before/after implementation comparison exists yet. Google good thresholds are LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at field p75; [official guidance](https://web.dev/articles/vitals). TBT does not certify INP. New repeated deep-route lab measurements and field p75/INP remain HOLD.

## Deliverable status

Independent audit, prioritized register, nine-journey review and component plan: delivered. Current-route evidence, responsive geometry, focused tests, static accessibility findings and frozen comparison inputs: delivered with stated limits. Implementation evidence, full visual regression, new axe results, cross-browser/device qualification and post-change performance comparison: **pending user approval and execution**.

**Final assessment: HOLD.** Local scope/source preservation passes; substantive UX corrections and qualification are outstanding. Figr is BLOCKED by disconnection. Positive test-spend/denial fixtures, real-device/AT access and field telemetry remain unqualified. This assessment authorizes no merge, deployment, paid action or release-readiness claim.
