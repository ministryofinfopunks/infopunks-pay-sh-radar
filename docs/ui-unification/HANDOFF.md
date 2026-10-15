# One Radar. Two economies. One design system.

**Release state: HOLD. No deployment or merge authorized.**

This branch contains a bounded presentation refactor of `/solana` and `/rh-chain-signal-desk`. Review it against the user-selected cyan integration baseline **`d3d0a445ec20e8c55170c2fc1f52aff220b2a851`**, not the retired green `main` checkout. Branch: **`codex/radar-subpages-ui-unification`**. Existing integration security, migration and operational holds remain in force.

## Implementation

Solana now uses a compact split hero with the original headline, copy, advisory scope and CTAs. Its supporting panel displays real provider/endpoint counts, unknown or zero scores, source mode and freshness from the existing pulse state. Fixture-backed data remains explicitly fixture-backed. All six directory families use consistent bordered cards. Current evidence, benchmark, preflight, machine economy, graph, ledger and deeper terminal modules remain present with the same controls and data. A proven pre-existing provider-context clipping defect now wraps its full text within the Solana dossier.

Robinhood Chain retains its complete observation workflow. The hero/checker and Today summary, Daily Pulse, complete Daily Receipt, movers, risk, Meme Pulse, launch routes, review queue, chain pulse, Analyst details and methodology adopt the cyan terminal's typography, borders, compact spacing and responsive grids. Raw scores, caveats, stale states, sources and receipt controls remain intact. Analyst tables now have named, keyboard-focusable scroll regions. Its separate narrative route retains its original appearance.

No backend, endpoint, payload, polling, caching, proof rule, tenant boundary, payment behavior, authority, package, lockfile or production configuration was changed. No wallet or financial execution mechanism was added.

## Design-system mapping

| Canonical homepage pattern | Solana equivalent | Robinhood equivalent |
|---|---|---|
| `RadarAppShell`, `ProductHeader`, `ProductFooter` | Existing inherited shell/navigation | Existing inherited shell/navigation |
| `radarTokens.css` canvas/panel/text/action/border/font/radius aliases | Both hero columns, directory, evidence and terminal panels | Hero, Today, receipt, cards, tables and controls |
| `.terminal-panel`, `.terminal-panel-heading`, `.terminal-state` | Source-bound coverage/status panel | Today evidence rows and structured receipt framing |
| Monospaced editorial hero | Original “Proof before agent spend.” | Original “Know what is moving. Know what is real.” |
| `RadarSectionHeader` | Directory `[03]`, evidence `[04]`; existing route `[02]` | Pulse `[12]`, receipt `[13]`, movers `[14]`; existing route `[11]` |
| Fine bordered card grid / protocol cells | Six unchanged product families | Pulse, movers, risk, Meme Pulse and review cards |
| Cyan primary / outlined secondary / terminal input | Original spend/explore and deeper controls | Original contract checker, mode/filter/share controls |
| Provenance and explicit unavailable states | Fixture/unknown/source/freshness remain visible | Stale/risk/source-required/review states remain literal |

The homepage component, stylesheet, shared shell, shared design components and canonical tokens are unchanged. No competing root palette or component library was introduced. See [DESIGN.md](../../DESIGN.md) for exact runtime ownership and [AUDIT.md](AUDIT.md) for the source inventory and baseline history.

## Changed-file inventory

| File | Reason |
|---|---|
| `src/web/radarApp.tsx` | Scoped Solana page class, source-bound hero evidence, shared evidence label; imports the scoped adapters |
| `src/web/radarNetworks.tsx` | Optional terminal label for the existing directory; route catalog and destinations unchanged |
| `src/web/radarSubpages.css` | Scoped Solana hierarchy, evidence, directory, deeper module framing, focus and responsive wrapping |
| `src/web/rhChainSignalDeskPages.tsx` | Enables the home-only presentation variant without changing fetching or route dispatch |
| `src/web/rhChainSignalDeskV2.tsx` | Requested home section labels and accessible native table scroll regions |
| `src/web/rhChainTerminal.css` | Complete home-scoped cyan presentation for existing RH modules and states |
| `src/web/styles.css` | Adds only a zero-specificity exclusion to the 295 legacy V2 rules; declarations and other-route specificity remain unchanged |
| `tests/radar-endpoint-intelligence.test.tsx` | Null/zero/fallback truthfulness and original CTA/directory coverage |
| `tests/radar-subpage-presentation.test.tsx` | Home/narrative isolation and complete keyboard-reachable Analyst tables |
| `DESIGN.md` | Mirrors the existing canonical source and component mapping; no runtime token changes |
| `scripts/browser-radar-ui-*.cjs` | Repeatable screenshots, interactions, accessibility, native zoom, section and unchanged-page comparisons |
| `scripts/verify-radar-subpage-boundary.cjs` | Read-only source, handler, navigation, state/request and legacy-style preservation evidence |
| `docs/ui-unification/` | Baseline, validation logs, screenshots, regression matrix and review handoff |

Existing untracked `docs/qualification/` belongs to prior work and is excluded from this commit. Historical green-checkout reports remain in `baseline/current-main/`; its superseded temporary screenshots were lost when the interrupted session's temporary environment was cleared. They are not qualification evidence for this branch. All selected cyan before/after evidence is retained here.

## Regression matrix

| Behavior / state | Preservation evidence |
|---|---|
| Global and local navigation; all original destinations | Browser href inventories and source-boundary comparison; 215 Solana and 86 RH original links retained |
| Solana hero CTAs / six directory families | Browser navigation and focused null/zero/fixture tests |
| Terminal controls, density, Agent Mode, command palette | Actual keyboard/pointer interaction checks; state/handler bodies unchanged |
| Search, provider sorting/filtering, route registry | Actual local API/browser interactions; existing frontend tests |
| Preflight validation, example input and error handling | Existing frontend tests and actual browser checks |
| Benchmarks, evidence ledger, monitoring and deeper modules | Full heading/control inventories, lower-fold captures, existing domain/UI tests |
| RH Brief/Analyst and Meme Pulse filters/search/table | Actual interactions, complete-column assertions and keyboard-focusable table tests |
| Contract input, validation, pending, result/error/mismatch states | Existing RH tests plus real local read-only browser GET; no synthetic approval state |
| Daily Receipt, source details, clipboard/share dismissal | Actual clipboard, Escape/outside-dismiss/source disclosure checks; original content and hrefs preserved |
| Scores, freshness, provenance and unavailable/stale states | Original selectors/requests and labels unchanged; fixture snapshots and source-boundary evidence |
| Loading, empty and optional module failure states | Existing relevant UI suite, explicit unchanged hooks/requests and DOM states |
| Auth, tenant ownership, receipt authority and payment rules | 1,526 protected tracked files unchanged; complete PostgreSQL-backed regression suite |
| Homepage stability / separate RH narrative route | Controlled exact desktop/mobile PNG comparisons and computed geometry/type/color/text checks |
| Responsiveness and keyboard access | Width matrix, native 200%/400% Chrome zoom, focus/interaction checks, automated accessibility audits |

## Validation and evidence

The authoritative baseline is [baseline/baseline-validation.md](baseline/baseline-validation.md): lint, typecheck, build, design guard and **2,047 PostgreSQL-backed tests pass with zero skips**. The initial main-checkout failures are historical and do not qualify this branch.

Final command results, retained failures, static policy findings and browser evidence are recorded in [VALIDATION.md](VALIDATION.md). Before/after screenshots and controlled unchanged-page comparisons are indexed in [VISUAL-REVIEW.md](VISUAL-REVIEW.md). Source hashes identify the exact tested application bytes even though documentation and the final review commit are produced afterward.

The final frozen source passes **2,051 tests with zero skips**, build, lint, typecheck and the design guard. The final browser run passes all eight check groups, including all requested widths, actual interactions, native zoom and automated accessibility. The complete changed-file manifest is [CHANGED-FILES.txt](CHANGED-FILES.txt).

## Review and remaining release gates

Review the actual homepage, Solana and Signal Desk side by side using the screenshot index, then open the three local routes. Inspect the full mobile page and Analyst tables, not just the hero. The existing human-approved references were never overwritten or automatically approved. Changed subpage captures require human visual review.

Use `git diff d3d0a445ec20e8c55170c2fc1f52aff220b2a851..HEAD` to review this isolated commit. The original journey harness still fails on an ambiguous Search selector; its temporary selector-scoped copy passes all ten actual API journeys. The existing strict project audit retains 57 findings with zero new findings, and the dependency audit retains one low development-only advisory. These results and the pre-existing Analyst duplicate-key warnings are preserved in the validation report. They are not silently converted to passing gates.

Automated Chromium, axe and native browser zoom are actual checks, but do not constitute manual screen-reader, physical-device, virtual-keyboard or human accessibility testing. Automated axe incomplete results remain visible for review. Existing independent security/migration/operational holds and production field-performance requirements are outside this UI task. No merge, deployment or release permission follows from this handoff.
