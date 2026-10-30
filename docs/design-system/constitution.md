# INFOPUNKS RADAR // CANONICAL CYAN TERMINAL V2

Intelligence before action. Proof after execution.

## Canonical identity and audit

UI-INT2 integration baseline: 2c2fe64db173c63048e70353ae926aa199792d1b (qualified secure R2). Cyan presentation donor: 1f3f9f99e81f78c9aa7e79d42c53e395f8e3040c. Earlier recovery began at dfe089b; that history does not authorize replacing current secure behavior. Read `.agents/skills/apple-design/SKILL.md`: purpose, agency, familiarity, responsive hierarchy, direct feedback, readable typography, reduced motion, contrast and transparency preferences. Existing project guidance is AGENTS.md; no additional frontend engineering instructions were found.

The approved supplied reference is `references/infopunks-radar-canonical-cyan-terminal.png`. It is authoritative. The green editorial homepage is retired. Recovery baseline is 068df23; approved cyan presentation and 74,906-byte Signal Lens asset are reused from 205e3c9 without its backend changes. Root cause and exact source-to-port mapping are in ui-int2/final-report.md; the historical recovery report remains in its source worktree.

## Architecture

The design system is part of `src/web`. One entry-level `RadarAppShell` owns global navigation, economy selection, indexed wayfinding, content boundary and footer. Existing route dispatch, permissions and requests remain authoritative. A shell context prevents repeated global navigation; workflow navigation, command palette and density controls remain available within their surface. The homepage stays independent of deep route imports.

`radarTokens.css` is canonical. Existing names are compatibility aliases, not an additional theme. Consolidate global root definitions here; specialized data visualizations may retain local geometry. `radarDesignSystem.css` defines shared framing, state primitives and responsive behavior. `styles.css` remains the existing workflow stylesheet; it must not gain new theme definitions. No dashboard framework or UI dependency.

## Visual constitution

- Canvas: near black; evidence panels: near-black cool surfaces; typography: bone cream; muted text remains legible.
- Use approved #050b0c canvas, #081113 panels, #f1f0e5 bone text, #a0c2d0 muted text, #4e737d terminal borders, #00eee4 cyan action/selection, #dc91ff policy-relative Judgment. Green is reserved for verified semantic success via --ok; amber pending/warning; red failure; neutral missing evidence. Text and labels always accompany colors.
- Fine borders and aligned rows establish structure. Avoid glows, animated telemetry, gradients on controls, nested shadows and decorative charts.
- Use existing font roles: UI/display and mono for identifiers, timestamps and metadata. Body ≥ 1rem; secondary labels ≥ .75rem. Fluid display sizes, tight display tracking and comfortable body leading. Identifiers wrap; code and wide tables scroll locally.
- Use the existing rem spatial scale, control/surface/panel radii, motion and density aliases. Terminal panels use restrained .25rem corners; 44px primary touch controls.
- Layout maximum 1560px. One shared alignment edge. Split workflows on desktop; task → input → action → Judgment → evidence → lifecycle → supporting navigation on mobile.

## Indexed grammar

Indices identify navigation families, not backend stages or record counts. 01 Radar / Two Economies; 02 Solana / Pre-Spend Intelligence; 03 Routes / Service Intelligence; 04 Receipts / Proof Archive; 05 Providers / Provider Evidence; 06 Services / Service Dossiers; 07 Judgment / Policy and Claims; 08 LoopLab / Collective Memory; 09 Signals / Market Intelligence; 10 Machine Economy / Execution Evidence; 11 Robinhood Chain / Onchain Finance; 12 Reflexive Radar / Market Structure; 13 IPX PLTR / Research; 14 Developers / Integration Reference; 15 Hermes / Wallet Memory; 16 Evaluation / Commercial Evidence. Detail pages inherit family index and keep their specific existing title. `RadarSectionHeader` is the only formatter.

## Truth vocabulary and four receipts

`RadarStatus` distinguishes **verified evidence**, **Judgment**, **pending outcome**, **missing evidence**, **recorded**, **verification not established**, **unavailable**, **validation failed** and **demonstration**. These are presentation categories, never backend verdicts. Render canonical ALLOW/DEGRADE/BLOCK and existing decisions verbatim. Provider verification never approves payment. Availability, freshness, publication, record existence and confidence never establish verification. A hash never establishes a service outcome.

`RadarReceiptLifecycle`: OBSERVATION → JUDGMENT → EXECUTION → EVALUATION. Each stage accepts explicit status, provenance and optional authorized record links. Unprovided stages say “No stage record supplied”; they never become completed through position or a preceding favorable Judgment. A conceptual lifecycle is explicitly marked “Architecture reference” and claims no records. Map backend facts in each consuming workflow, never infer them from rendered text. Historical evidence referenced by a new decision is not a new execution.

## Components and page template

Reuse navigation catalog/network selector/keyboard menus, `.panel`, `.execute`, form labels, existing evidence grids, receipt views, decision cards and table structures. Create only semantic or behavioral abstractions: shell, indexed header, status, lifecycle, evidence disclosures, async state, scrollable table. Keep existing specialized components rather than adding wrappers for every element.

New pages automatically inherit the shell through `main.tsx`. Supply route family metadata; use one h1 for the task, indexed h2 sections, `.panel` for evidence, `.execute` for actions. Use labeled native controls. `RadarAsyncState` handles loading, empty, error, unavailable and permission-denied with meaningful recovery. `RadarEvidenceRow` exposes provenance using native details/summary; blockers remain visible outside disclosures. `RadarDataTable` preserves every column in a labeled keyboard-focusable scroll region.

Correct: show “Judgment / ALLOW” next to an explicit pending execution. Incorrect: show a green verified badge because a provider is available. Correct: label sample records demonstration. Incorrect: fill missing receipts with placeholder hashes.

## Interaction and accessibility

WCAG 2.2 AA target. Visible focus; skip link; semantic landmarks and heading hierarchy; accessible labels; instant :active feedback; disabled states; live regions for request outcomes; retry actions where supported. Existing menus support arrows, Escape and restored trigger focus. Never lock input during transitions. No animation depicts unestablished verification or execution. Reduced motion removes movement; transparency and contrast preferences use solid surfaces. Touch actions require no hover. On mobile form text is at least 16px, numeric budgets use decimal keyboards and inputs remain in document flow for the virtual keyboard.

## Migration and release gates

A: record routes, foundations, components and baseline. B: shell/tokens/status/lifecycle. C: homepage/Solana/spend. D: intelligence/proof/operations. E: RH/reflexive/PLTR. F: existing typecheck, lint, tests, build, browser render, axe, keyboard, reduced motion, failure and mobile checks. Each boundary is a reviewable commit. No backend contract, authentication, ownership, payment authority or security gate changes. No deploy or merge.

Mobile qualification is release-blocking: evaluate every route family at 320/375/390/430/768/1024/1440, preserve complete evidence, eliminate page overflow and document real-device/virtual-keyboard limitations. Automated emulation is not device testing. Do not call the migration complete when critical mobile issues or an unqualified essential journey remain. See route inventory and ui-int2/final-report.md for current implementation/test status.

## Mandatory identity governance

One entry-level RadarAppShell owns ProductHeader (RADAR, SOLANA, ROBINHOOD CHAIN, ECONOMIC OS, PROOF, DEVELOPERS), indexed route framing and ProductFooter. Existing network directories remain beneath it as progressive disclosure; no copied global headers. Every router entry inherits the shell; tables, panels and forms retain their appropriate layouts. RadarReceiptLifecycle serves the homepage and all receipt workflows. No second root token file; new work uses radarTokens.css. Green-named compatibility aliases resolve to cyan actions, never verification.

Run check:design, typecheck, build, the full PostgreSQL-backed suite, scripts/qualify-ui-int2-routes.cjs, scripts/qualify-unified-radar-browser.mjs, scripts/qualify-ui-int2-journeys.cjs and scripts/compare-ui-int2-visuals.cjs. External QA dependencies and local server configuration are documented in ui-int2/final-report.md. New route patterns require regenerated inventory and coverage. Screenshots produced by tests are candidates: human approval of checkpoint 1 (homepage) and checkpoint 2 (remaining routes) is required before merge. Never automatically update visual baselines or merge/deploy. Missing device, evidence, field performance or accessibility verification is HOLD, not PASS.

Official guidance: https://developer.apple.com/design/human-interface-guidelines/accessibility ; https://developer.apple.com/design/human-interface-guidelines/layout ; https://web.dev/articles/vitals ; https://web.dev/learn/accessibility/ . Web Vitals must report field p75 separately from labs; Lighthouse TBT cannot certify INP.
