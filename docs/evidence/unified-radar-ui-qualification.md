# Unified Radar UI qualification

Exact source: **d6112b5c8c56e75a8b33c238126a478277b3d0a1**. Date: 2026-10-12 (Asia/Colombo). Application: compiled API/static Vite build on `127.0.0.1:8799`, development API fixtures, ingestion/monitor/payment/execution/economic/publication activation disabled. No screenshot or local test establishes production operation or externally verified outcomes.

Automated browser evidence: [results](unified-radar/browser/results.json), [navigation audit](unified-radar/browser/navigation-audit.json), [keyboard/reduced motion](unified-radar/browser/keyboard-reduced-motion.json), [failure recovery](unified-radar/browser/failure-recovery.json). Browser: installed Chrome for Testing via bundled Playwright; axe-core 4.10.3 with WCAG 2 A/AA, 2.1 AA and 2.2 AA tags. Lighthouse 12.8.2 is a local lab measurement. Automated zero findings is not a full WCAG certification or an Apple-level design certification.

## Route and viewport evidence

Desktop 1440×1000, tablet 768×1024, mobile 390×844. Each route loads the real application and captures console, network, DOM, overflow and accessibility state. The terminal submits a real local canonical free check. No success response or canonical receipt is mocked for screenshots.

| Route | Purpose / actual behavior | Desktop screenshot | Mobile screenshot |
|---|---|---|---|
| `/` | Exact unified constitution, advisory CTA, inspection CTA, lifecycle and developer example; no landing data fetch/live badge | [Home](unified-radar/browser/desktop-home.png) | [Home](unified-radar/browser/mobile-home.png) |
| `/solana` | Shared product navigation, service evidence context, canonical terminal CTA and retained diagnostic directory | [Solana](unified-radar/browser/desktop-solana.png) | [Solana](unified-radar/browser/mobile-solana.png) |
| `/4663` | Radar research identity and shared links; exact proof states and safe unknown freshness | [4663](unified-radar/browser/desktop-4663.png) | [4663](unified-radar/browser/mobile-4663.png) |
| `/rh-chain-signal-desk` | RH evidence research, shared chain navigation; reviewed/read-only semantics preserved | [RH desk](unified-radar/browser/desktop-rh-chain-signal-desk.png) | [RH desk](unified-radar/browser/mobile-rh-chain-signal-desk.png) |
| `/spend-terminal` | Canonical insufficient_evidence, confidence 0, fee 0, no receipt, execution not authorized/outcome not verified | [Canonical check](unified-radar/browser/desktop-spend-terminal.png) | [Canonical check](unified-radar/browser/mobile-spend-terminal.png) |
| `/rh-chain-signal-desk/market` | Explicit read-only scope; existence differs from suitability; data/source gaps remain visible | [Market](unified-radar/browser/desktop-rh-chain-signal-desk-market.png) | [Market](unified-radar/browser/mobile-rh-chain-signal-desk-market.png) |
| `/radar/cards` | Diagnostic public preflight cards; optional providers checked against catalog before detail probing | [Cards](unified-radar/browser/desktop-radar-cards.png) | [Cards](unified-radar/browser/mobile-radar-cards.png) |
| `/receipts` | Legacy diagnostic evidence in local fixture mode; synthetic seeds disabled in production | [Receipt index](unified-radar/browser/desktop-receipts.png) | [Receipt index](unified-radar/browser/mobile-receipts.png) |
| `/receipts/receipt_001` | Clearly local fixture detail; no claim of a live canonical paid receipt | [Receipt detail](unified-radar/browser/desktop-receipts-receipt_001.png) | [Receipt detail](unified-radar/browser/mobile-receipts-receipt_001.png) |
| `/loops` | Existing research/proof links, no new execution authority | [LoopLab](unified-radar/browser/desktop-loops.png) | [LoopLab](unified-radar/browser/mobile-loops.png) |
| `/developers` | Canonical four-state vocabulary, safe SDK example, independent rails, protected proof and readable keyboard-accessible code | [Developers](unified-radar/browser/desktop-developers.png) | [Developers](unified-radar/browser/mobile-developers.png) |

Tablet images use matching `tablet-*.png` names in the same directory. Homepage and terminal screenshots capture full content; other captures inspect the initial viewport and the automated DOM/axe audit covers the full document.

Final outcome: **33 route/viewport views; zero automated accessibility violations, console exceptions/errors, horizontal overflows or broken audited fragments.** All 11 document routes returned HTTP 200. The link inventory contains 981 rows, with unvisited destinations explicitly distinguished. Server-failure and twelve-second timeout scenarios expose a usable Retry check.

## Before/after and defect resolution

The preserved baseline `docs/evidence/track-a/release-qualification/a5.1/screenshots/desktop-home.png` and `mobile-home.png` bind to their original candidate. They are comparison context, not current-SHA verification.

| Before | After / verification |
|---|---|
| Category manifesto and competing Genesis/RH Pulse/IPX footer | One Radar identity, exact hero, two purpose-led cards, proof lifecycle and one footer |
| Pulse HTTP 200 displayed as live operational intelligence | No landing status fetch or operational badge; scoped advisory/inspection labels |
| Terminal shows legacy approval and legacy diagnostic receipt as canonical | Canonical response governs display; unissued quote and free abstention remain separate; execution always unavailable |
| Unbounded terminal request and retry ambiguity | Twelve-second abort, same input/key retry, no automatic payment, valid alerts/recovery, no stale result retained on edit |
| UNVERIFIED substring could become VERIFIED; future timestamp could be LIVE | Exact VERIFIED matching; publication/availability/freshness do not prove truth; future/invalid timestamps show unknown |
| `/4663` had separate product chrome | Radar identity and shared Radar/Solana/RH/Proof/Developers navigation retained alongside research sections |
| Legacy console links referenced removed root anchors | Console destinations use `/solana#…`; root proof/economies and methodology dialog retain their correct targets |
| RH low-contrast secondary text, invalid score ARIA and nonfocusable scroll areas | Contrast increased, labeled score has semantic role, code/scroll regions keyboard focusable |
| Duplicate Solana chips produced React key errors | Lists deduplicated before presentation |
| Optional provider alias caused a 404 probe; fonts required external network | Catalog presence checked; system font fallbacks eliminate external font dependency |

Focus indicators, semantic landmarks/form labels, 44px shared navigation targets, native keyboard form controls and reduced-motion scroll behavior were checked. All essential landing text remains on mobile; the decorative Signal Lens is omitted on small screens. No private proof is surfaced to make the demonstration work. Unauthenticated canonical reads, including encoded matched routes, return uniform 401 before data lookup, separately covered in backend tests.

The complete navigation JSON inventories links from every audited desktop route, checks fragment destinations in audited documents and distinguishes unvisited deep routes/external destinations. It does not infer a working transaction capability from an anchor. Network/console evidence records actual responses; expected missing evidence remains an empty/degraded state, not a fabricated success.

Failure scenarios are deliberately labeled **INJECTED_LOCAL_FAILURE_ONLY**: a 503 response and an unanswered check request. Both expose a useful alert and re-enable Retry check; the subject query deep link survives. A synthetic success or receipt was not injected.

## Performance and remaining limits

Lighthouse desktop/mobile JSON and final measurement summary are linked in the evidence directory. Final Lighthouse lab results: desktop performance/accessibility/best-practices **100/100/100**, FCP/LCP **448 ms**, CLS **0**, TBT **0 ms**; mobile **97/100/100**, FCP/LCP **2,019 ms**, CLS **0**, TBT **0 ms**. Use the JSON throttling/environment details when comparing runs. These are lab results, not field Web Vitals. The landing retains an isolated React entry; the terminal has its own lazy chunk and no initial metrics query. Heavy Radar/RH bundles are not loaded by the universal landing.

The legacy Radar JS/CSS bundle still exceeds the default Vite chunk warning threshold, and the Solana diagnostic surface remains dense. There is no staging-device/network/capacity qualification or external-data performance guarantee. Browser checks cover these routes/three viewport sizes, not every deep page or every assistive technology. Independent tenant-safe canonical proof publication and live market/trading capabilities remain unavailable. Production approval remains HOLD under the system qualification packet.

Final minified build: landing entry 203.83 kB (64.52 kB gzip), Spend Terminal 87.38 kB (24.13 kB gzip), Radar 1,531.44 kB (303.51 kB gzip), legacy Radar CSS 418.85 kB (74.63 kB gzip). The inherited baseline reported a 2,399.60 kB Radar chunk; chunk allocation changed, so this is a bundle-structure comparison, not a claim of equivalent-network speedup. No initial landing API request or terminal metrics fetch was introduced.
