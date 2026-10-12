# INFOPUNKS RADAR // DESIGN SYSTEM V1

Intelligence before action. Proof after execution.

## Canonical identity and audit

Baseline: dfe089b (clean main, 2026-10-12). Read `.agents/skills/apple-design/SKILL.md`: purpose, agency, familiarity, responsive hierarchy, direct feedback, readable typography, reduced motion, contrast and transparency preferences. Existing project guidance is AGENTS.md; no additional frontend engineering instructions were found.

The actual entry is `main.tsx` → lightweight `homepage.tsx`, with the remaining routes lazily dispatched by `radarApp.tsx`. The requested literal `[ 01 ] INFOPUNKS RADAR / TWO ECONOMIES` was absent in this baseline. Preserve the actual homepage's editorial manifesto, economic sequence, two economy cards, restrained green, monospaced metadata, system display typography, dark canvas and fine framing; restore indexed grammar without replacing the homepage. No new artwork or fonts.

## Architecture

The design system is part of `src/web`. One entry-level `RadarAppShell` owns global navigation, economy selection, indexed wayfinding, content boundary and footer. Existing route dispatch, permissions and requests remain authoritative. A shell context prevents repeated global navigation; workflow navigation, command palette and density controls remain available within their surface. The homepage stays independent of deep route imports.

`radarTokens.css` is canonical. Existing names are compatibility aliases, not an additional theme. Consolidate global root definitions here; specialized data visualizations may retain local geometry. `radarDesignSystem.css` defines shared framing, state primitives and responsive behavior. `styles.css` remains the existing workflow stylesheet; it must not gain new theme definitions. No dashboard framework or UI dependency.

## Visual constitution

- Canvas: near black; evidence panels: subdued dark green; typography: bone cream; muted text remains legible.
- Preserve #7effb0 brand green. Cyan identifies action/selection, purple identifies policy-relative Judgment, amber uncertainty/warning, red validation failure. Text and labels always accompany colors.
- Fine borders and aligned rows establish structure. Avoid glows, animated telemetry, gradients on controls, nested shadows and decorative charts.
- Use existing font roles: UI/display and mono for identifiers, timestamps and metadata. Body ≥ 1rem; secondary labels ≥ .75rem. Fluid display sizes, tight display tracking and comfortable body leading. Identifiers wrap; code and wide tables scroll locally.
- Use the existing rem spatial scale, control/surface/panel radii, motion and density aliases. Terminal panels use restrained .25rem corners; 44px primary touch controls.
- Layout maximum 1180px. One shared alignment edge. Split workflows on desktop; task → input → action → Judgment → evidence → lifecycle → supporting navigation on mobile.

## Indexed grammar

Indices identify navigation families, not backend stages or record counts. 01 Radar / Two Economies; 02 Solana / Pre-Spend Intelligence; 03 Routes / Service Intelligence; 04 Receipts / Proof Archive; 05 Providers / Provider Evidence; 06 Services / Service Dossiers; 07 Judgment / Policy and Claims; 08 LoopLab / Collective Memory; 09 Signals / Market Intelligence; 10 Machine Economy / Execution Evidence; 11 Robinhood Chain / Onchain Finance; 12 Reflexive Radar / Market Structure; 13 IPX PLTR / Research; 14 Developers / Integration Reference; 15 Hermes / Wallet Memory; 16 Evaluation / Commercial Evidence. Detail pages inherit family index and keep their specific existing title. `RadarSectionHeader` is the only formatter.

## Truth vocabulary and four receipts

`RadarStatus` distinguishes **verified evidence**, **Judgment**, **pending outcome**, **missing evidence**, **recorded**, **unavailable**, **validation failed** and **demonstration**. These are presentation categories, never backend verdicts. Render canonical ALLOW/DEGRADE/BLOCK and existing decisions verbatim. Provider verification never approves payment. Availability, freshness, publication, record existence and confidence never establish verification. A hash never establishes a service outcome.

`RadarReceiptLifecycle`: OBSERVATION → JUDGMENT → EXECUTION → EVALUATION. Each stage accepts explicit status, provenance and optional authorized record links. Unprovided stages say “No stage record supplied”; they never become completed through position or a preceding favorable Judgment. A conceptual lifecycle is explicitly marked “Architecture reference” and claims no records. Map backend facts in each consuming workflow, never infer them from rendered text. Historical evidence referenced by a new decision is not a new execution.

## Components and page template

Reuse navigation catalog/network selector/keyboard menus, `.panel`, `.execute`, form labels, existing evidence grids, receipt views, decision cards and table structures. Create only semantic or behavioral abstractions: shell, indexed header, status, lifecycle, evidence disclosures, async state, scrollable table. Keep existing specialized components rather than adding wrappers for every element.

New pages automatically inherit the shell through `main.tsx`. Supply route family metadata; use one h1 for the task, indexed h2 sections, `.panel` for evidence, `.execute` for actions. Use labeled native controls. `RadarAsyncState` handles loading, empty, error, unavailable and permission-denied with meaningful recovery. `RadarEvidenceRow` exposes provenance using native details/summary; blockers remain visible outside disclosures. `RadarDataTable` preserves every column in a labeled keyboard-focusable scroll region.

Correct: show “Judgment / ALLOW” next to an explicit pending execution. Incorrect: show a green verified badge because a provider is available. Correct: label sample records demonstration. Incorrect: fill missing receipts with placeholder hashes.

## Interaction and accessibility

WCAG 2.2 AA target. Visible focus; skip link; semantic landmarks and heading hierarchy; accessible labels; instant :active feedback; disabled states; live regions for request outcomes; retry actions where supported. Existing menus support arrows, Escape and restored trigger focus. Never lock input during transitions. No animation depicts unestablished verification or execution. Reduced motion removes movement; transparency and contrast preferences use solid surfaces. Touch actions require no hover. On mobile form text is at least 16px, numeric budgets use decimal keyboards and inputs remain in document flow for the virtual keyboard.

## Migration and release gates

A: record routes, foundations, components and baseline. B: shell/tokens/status/lifecycle. C: homepage/Solana/spend. D: intelligence/proof/operations. E: RH/reflexive/PLTR. F: existing typecheck, lint, tests, build, browser render, axe, keyboard, reduced motion, failure and mobile checks. Each boundary is a reviewable commit. No backend contract, authentication, ownership, payment authority or security gate changes. No deploy or merge.

Mobile qualification is release-blocking: evaluate every route family at 320/375/390/430/768/1024/1440, preserve complete evidence, eliminate page overflow and document real-device/virtual-keyboard limitations. Automated emulation is not device testing. Do not call the migration complete when critical mobile issues or an unqualified essential journey remain. See route inventory and qualification report for actual implementation/test status.
