# Unified Radar terminal UI qualification

Browser/build/lint source: **6c2fd25ca3597cdb3f463373d260c6d15908ae69**, branch `codex/unified-radar`, 2026-10-12. Baseline: `fefaa8e` from the preceding unified product qualification. Local compiled API and Vite build at `http://127.0.0.1:8799`. Payment, execution and token activation remain disabled. API fixtures establish local UI behavior; they are not external verification or production operation.

## Reference and implementation

The user supplied a desktop terminal with its mobile counterpart: obsidian canvas, bone display text, pale blue technical copy, cyan actions, purple Judgment emphasis, framed evidence, a halftone punk portrait and a four-stage proof strip. The preceding landing had a charcoal/sage editorial layout with a circular signal lens. It implemented the product strategy but did not match this composition.

Implemented real React/HTML components rather than a flattened screenshot. `designTokens.css` is the product token authority; historical surface/color/radius/font variables in `styles.css` now alias it. Removed competing legacy definitions. `ProductHeader` shares brand, product destinations, active navigation and an Escape-dismissible mobile menu across the homepage, Spend Terminal, Solana, RH desk and 4663 research. Existing domain navigation, view settings and evidence semantics remain separate and usable. The existing lazy entry architecture is preserved.

The homepage follows the reference's hero/input/portrait/Judgment layout, proof protocol and three entry/principles cards. A generated decorative punk portrait is stored in `public/artwork/signal-punk.webp`; its encoded delivery size is 73 KB versus the 615 KB PNG draft. It is not evidence or an asset endorsement. Native SVG icons remain code components.

The pasted subject goes through a native, encoded GET form to `/spend-terminal?subject=…`. Users review intent, risk, budget and policy there before submitting the canonical check. The browser neither pays nor signs. Evidence rows expand into explanatory details. Primary and secondary actions retain distinct emphasis.

Intentional differences from the illustration: no wallet connection flow, made-up mainnet clock, block number, latency, provider verification, confidence percentage or execution receipt. The Judgment format preview is marked **NO CHECK RUN**, **AWAITING EVIDENCE**, **NOT CHECKED** and **NOT ISSUED**. RH remains read-only market intelligence; the landing links to **Inspect a Market**. The universal product constitution remains in the header, developer section and footer. Developer/API content extends below the reference's entry row.

## Captured evidence

| Surface | Desktop | Mobile |
|---|---|---|
| Universal landing | [Screenshot](terminal-ui/desktop-home.png) | [Screenshot](terminal-ui/mobile-home.png) |
| Solana Radar | [Screenshot](terminal-ui/desktop-solana.png) | [Screenshot](terminal-ui/mobile-solana.png) |
| RH market intelligence | [Screenshot](terminal-ui/desktop-rh-chain-signal-desk.png) | [Screenshot](terminal-ui/mobile-rh-chain-signal-desk.png) |
| 4663 research | [Screenshot](terminal-ui/desktop-4663.png) | [Screenshot](terminal-ui/mobile-4663.png) |
| Canonical Spend Terminal | [Screenshot](terminal-ui/desktop-spend-terminal.png) | [Screenshot](terminal-ui/mobile-spend-terminal.png) |
| Read-only market inspection | [Screenshot](terminal-ui/desktop-rh-chain-signal-desk-market.png) | [Screenshot](terminal-ui/mobile-rh-chain-signal-desk-market.png) |
| Preflight cards | [Screenshot](terminal-ui/desktop-radar-cards.png) | [Screenshot](terminal-ui/mobile-radar-cards.png) |
| Receipt inspection | [Screenshot](terminal-ui/desktop-receipts.png) | [Screenshot](terminal-ui/mobile-receipts.png) |
| Receipt detail | [Screenshot](terminal-ui/desktop-receipts-receipt_001.png) | [Screenshot](terminal-ui/mobile-receipts-receipt_001.png) |
| LoopLab | [Screenshot](terminal-ui/desktop-loops.png) | [Screenshot](terminal-ui/mobile-loops.png) |
| Developers | [Screenshot](terminal-ui/desktop-developers.png) | [Screenshot](terminal-ui/mobile-developers.png) |

Tablet screenshots are the corresponding `tablet-*` files. The homepage and terminal also have `compact-*` 320px screenshots. Comparison baseline: [prior homepage](unified-radar/browser/desktop-home.png) and [prior mobile](unified-radar/browser/mobile-home.png). Homepage and terminal captures cover the full document; other images cover the initial viewport while automated accessibility checks inspect the document.

## Verification

- Typecheck, lint and production build pass on Node 24.21.0. Lint remains the repository's TypeScript check, not an independent ESLint check.
- **62 frontend test files / 365 tests passed** on `acb799467bddabf36f1ef90d65302fb851c2f54f`; the final follow-up only adjusted the mobile brand subtitle CSS. **Five focused frontend files / 60 tests passed** on the final source, with two workers and a 15-second harness timeout. Earlier runs under concurrent host/browser load hit five-second test timeouts; old assertions for the replaced branding were updated to the requested identity. No business-policy assertions or the actual twelve-second request timeout were weakened.
- **35 browser views**: 11 routes at 1440×1000, 768×1024 and 390×844; landing and terminal additionally at 320×800. All HTTP 200. **Zero automated axe WCAG 2/2.1/2.2 AA violations, console errors, horizontal overflow or failed requests.** Manual screenshot review covered the landing, mobile landing, terminal and both network entries. Automated results are not a complete human accessibility certification.
- Five shared destinations remain available in the mobile menus on the landing, Solana, RH desk and 4663. Escape closes each menu; homepage focus returns to the trigger. Skip-link focus is visible; reduced motion disables smooth scrolling. Desktop evidence rows remain at least 36px; mobile rows and menu controls use 44px targets.
- Evidence detail expansion works. The subject `solana:mainnet:service_route:route/a?b=c&d=1` survives the route handoff exactly. A real local POST returned **insufficient_evidence**, confidence 0, fee 0, no paid receipt, execution not authorized and outcome not verified. No success or verified execution was injected.
- Zero initial homepage API requests across all four sizes. The desktop portrait uses a responsive picture source; narrow/mobile layouts omit its download and its decorative principles backdrop. Mobile body, evidence and API text use at least 12px for legibility. API calls begin in the lazy domain/check experience.
- Fixed the contrast defect on `.market-pulse-method`, stale legacy theme overrides, duplicate product-brand rendering, an incorrect RH active-navigation mapping, competing Solana CTA emphasis and a full-page screenshot focus artifact.

[Machine-readable browser results](terminal-ui/results.json) include source SHA, per-view errors, requests, accessibility findings, menu checks, focus, expanded evidence and the actual abstention result. Reproduce with `scripts/qualify-terminal-ui.mjs`; provide `RADAR_QA_PLAYWRIGHT`, `RADAR_QA_AXE` and optionally `RADAR_QA_CHROMIUM` for locally installed QA tools. Tooling was reused outside runtime dependencies. No dependency or migration was introduced.

## Measured landing performance

Single local Chromium Lighthouse runs after test/browser jobs finished; simulated mobile throttling. These are lab measurements, not field Core Web Vitals or proposed production SLOs.

| View | Performance | Accessibility | Best practices | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| desktop | 100 | 100 | 100 | 445.96 ms | 568.94 ms | 0 ms | 0 |
| mobile | 97 | 100 | 100 | 2106.33 ms | 2258.33 ms | 6 ms | 0 |

The first mobile run measured performance 94 / accessibility 100 / best practices 96, with LCP 2,771.41ms. It identified small text and unnecessary artwork fetching. Increased mobile body/evidence/API text to 12px, retained a compact brand subtitle, used a responsive portrait source and omitted the decorative mobile backdrop. Final browser resource logs confirm **zero artwork requests** on mobile and 320px layouts. Host/load variation also influences single-run timings; no production speed improvement is inferred. Desktop portrait remains 73KB WebP. [Before mobile](terminal-ui/lighthouse-mobile-before.json), [final mobile](terminal-ui/lighthouse-mobile.json), [final desktop](terminal-ui/lighthouse-desktop.json), [summary](terminal-ui/performance-summary.json).

## Limits and release status

**Local UI qualification passes. Production/staging release remains HOLD**, as documented in [system qualification](unified-radar-system-qualification.md). No backend authority, rail, policy, database, signing key, infrastructure or production configuration was changed by this UI follow-up. The preceding backend qualification is historical evidence, not a claim that its full suite was rerun on this UI SHA.

The older Radar research bundle still produces a size warning: 1,531.44 KB minified / 303.50 KB gzip, separate from the landing's 211.83 KB / 67.10 KB entry. Existing research detail layouts remain denser than the universal front door. Local fixture screenshots do not qualify live feeds, paid issuance or real-market outcomes. The reference's exact fictional result cannot be reproduced as a genuine result without accepted evidence.
