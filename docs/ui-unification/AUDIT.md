# Radar subpage UI unification — baseline audit

## Baseline and scope

- Repository: `ministryofinfopunks/infopunks-pay-sh-radar`.
- Initial checkout: `main`, `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`.
- Isolated task branch: `codex/radar-subpages-ui-unification`.
- User-confirmed implementation baseline: `codex/radar-terminal-secure-integration`, `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. The task branch was moved to that existing source before any application edits.
- Pre-existing untracked `docs/qualification/` is preserved, excluded from this task.
- React client rendering; Vite; native CSS; TypeScript; Vitest/jsdom.
- Routes: `/`, `/solana`, `/rh-chain-signal-desk`.
- No deployment, release/default-branch merge, production configuration, backend, authority, payment, proof or database changes are authorized.

## Important source discrepancy

The initial checkout's `src/web/homepage.tsx` renders the green editorial “After attention, intelligence.” page. The supplied canonical screenshot instead shows the cyan “Before your agent spends, check the evidence.” terminal.

The user explicitly confirmed the cyan screenshot as the visual reference, then selected the existing cyan branch as the implementation baseline. Its actual implementation is `codex/radar-terminal-secure-integration`, `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`, also retained by `codex/radar-ui-int3-qualification`, `7cfe031d17b99ade423b912d4ff1470c18fcac71`. Those branches contain substantial existing application/security changes absent from initial main. The isolated task branch starts from the selected existing integration source; no backend work is imported as a new UI change. Review against `d3d0a445`, not the retired main checkout.

## Source and component map

| Role | Initial checkout source | Cyan reference source |
|---|---|---|
| Route entry / lazy boundaries | `src/web/main.tsx` | Same path plus `RadarAppShell` |
| Homepage | `src/web/homepage.tsx`, `homepage.css` | Same paths, `HomepageSpendCheck`, Judgment Preview |
| Canonical tokens | Scoped `--home-*` in `homepage.css` | `src/web/radarTokens.css` |
| Shared structure | `radarNetworks.tsx`, native `.panel` / `.execute` | `radarAppShell.tsx`, `radarDesignSystem.tsx` / `.css`, product header |
| Solana | `radarApp.tsx`, `RadarApp` with `landingContext="solana"` | Same component, existing advisory scope and revised CTAs |
| Solana directory | `radarNetworks.tsx`, `radarNavigationCatalog.ts` | Same sources |
| RH wrapper / fetching | `rhChainSignalDeskPages.tsx` | Same path |
| RH home / interaction state | `rhChainSignalDeskV2.tsx` | Same path |
| Domain selection / status | `rhChainSignalDeskSelectors.ts`, `rhChainUi.tsx` | Same paths |
| Legacy workflow styles | `styles.css` | Same path, tokens consolidated to canonical file |

## Exact source token comparison

Values below are read from implementation, not estimated from screenshots.

| Pattern | Initial main homepage | Confirmed cyan implementation |
|---|---|---|
| Canvas | `#020403` | `#050b0c` |
| Panel | `#06100b` | `#081113` |
| Raised | `#08150e` | `#102024` |
| Main text | `#e6ffef` | `#f1f0e5` |
| Secondary text | `#8ea498` | `#a0c2d0` |
| Action | `#7effb0` | `#00eee4` |
| Policy judgment | Not present in initial home | `#dc91ff` |
| Border | `rgba(126,255,176,.18)` | `#4e737d`, soft `#253d43` |
| Width | `1180px` | `1560px` |
| Gutters | `20px`, mobile `14px` | `16px`, mobile `10px` |
| Panel corners / shadow | Square / none | `.25rem` / none |
| Headings | System sans | System monospace |
| Hero headline | `clamp(58px,8vw,112px)`, `.86` leading | `clamp(2rem,3.55vw,3.4375rem)`, `1.08` leading |
| Section rhythm | `88px` editorial spacing | `14px` framed rhythm, mobile `12px` |
| Focus | `2px #f6d06f` | `2px` cyan, `4px` offset |
| Primary control | `44px` | `48px`, mobile `44px` |
| Breakpoints | `820px`, `520px` | `1024px`, `680px` |

## Preservation contract

Keep handlers, data fetching/caching/polling, validation, request payloads, selectors, source labels, identifiers, original timestamps, raw unknown/stale/not-verified states, links, SEO, analytics, keyboard behavior and below-fold content. No optimistic evidence substitutions.

Solana retains six directory families and their existing routes; terminal mode/density/command controls; benchmark, evidence ledger, machine economy, graph, provider/endpoint/catalog filters, search, exports, preflight, route registry/comparison, cost/performance, monitoring, anomaly/disclosure and developer modules. Exact baseline interactions and link inventories are in `baseline/functionality-inventory.md` and browser inventories.

Robinhood retains Brief/Analyst; contract checking; Today observations; receipt content/provenance/share; movers/scores/caveats; risk; meme filters/search/table; launch routes; review queue; chain pulse; analyst disclosures; methodology. It remains an observation/advisory environment.

## Initial validation evidence

`npm run lint`, `npm run typecheck`, `npm run build` pass. The initial full Vitest run had contention timeouts and sandbox socket restrictions. Unchanged tests passed after bounded worker/environment retries: 1,855 passed, 19 existing skips, zero persistent failures. Original failures and retries are retained in the baseline report.

Real Chromium baseline: desktop/mobile captures of all three routes, all 24 width checks pass (360/375/390/768/1024/1280/1440/1920); 20 interaction checks and six zoom-equivalent reflow checks pass. Native browser UI zoom, physical devices and manual screen-reader testing are not claimed. Existing subpage touch-target/focus shortfalls are recorded by the browser audit.

These initial results describe the superseded main checkout only. Historical reports remain in `baseline/current-main/`. Superseded screenshots were outside the review commit in temporary storage and were lost when that environment was cleared after interruption. They do not qualify the selected cyan source; the authoritative cyan before/after evidence remains in the repository.

## Selected cyan baseline

The entire selected source was archived before edits. Node 24.21.0 and an exact-lockfile-matched existing dependency tree were reused without package changes. Lint, typecheck, build and `check:design` pass. The full PostgreSQL-backed baseline passes **282 files / 2,047 tests, zero failures or skips**. Plain-text logs, command/exit results, complete test assertion JSON, source hashes and control inventory are retained under `baseline/`. The original temporary archive was cleared during interruption and can be reconstructed from its exact Git commit. Final validation retains its own complete logs.

The selected source uses `RadarAppShell`, `ProductHeader`, `ProductFooter`, `radarTokens.css`, `radarDesignSystem.css` and `RadarSectionHeader`. Solana's actual CTAs are now the brief's `Check a Spend Route` → `/spend-terminal` and `Explore the Radar` → `#explore-solana-radar`; these remain intact. Baseline screenshots and real fixture API snapshots are in `evidence/cyan-baseline/`.

Browser baseline was refreshed against this exact source. Actual Chrome UI zoom at 200% and 400% uses an isolated temporary profile; it is distinct from the earlier viewport-reflow equivalents. Final qualification and limits are recorded in the handoff and validation reports.
