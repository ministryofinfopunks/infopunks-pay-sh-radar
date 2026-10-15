# Baseline functionality and test inventory

Selected baseline: branch `codex/radar-subpages-ui-unification`, commit `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. User-selected canonical cyan integration baseline. Existing untracked `docs/qualification/`, `docs/ui-unification/` and browser scripts preserved. Entire tracked tree was archived before source edits; all checks run against that frozen archive, not the changing workspace. No application source has been changed by this validation worker.

## Actual route/component and visual-source map

- `/`: `src/web/main.tsx` renders `UniversalHomepage` from `src/web/homepage.tsx` within the shared `RadarAppShell`. Canonical headline is “Before your agent spends, check the evidence.”, with real working GET `/spend-terminal` subject form, an explicitly unrun Judgment Preview and shared lifecycle reference. Homepage code/CSS and shared shell/primitives must remain visually unchanged.
- `/solana` (optional trailing slash): lazy `radarApp.tsx` dispatcher renders `RadarApp landingContext="solana"`. Full existing terminal stays beneath `SolanaRadarHomepageHero` and `SolanaRadarDirectory`.
- `/rh-chain-signal-desk`: `RhChainSignalDeskPage` (`rhChainSignalDeskPages.tsx`) renders `RhChainSignalDeskV2`; narrative alias remains separate existing route behavior.
- Shared chrome `RadarAppShell` (`radarAppShell.tsx`) owns `ProductHeader`, `ProductFooter`, breadcrumb, `RadarSectionHeader`, skip target and optional network directory. Context prevents duplicate global chrome, preserving embedded workflow controls.
- Current protected Spend route is separate `spendTerminalPage.tsx` and `judgmentCheckClient.ts`; canonical authenticated receipt route `canonicalReceiptPage.tsx`. These must remain untouched by subpage visual changes.
- Canonical CSS ownership: `radarTokens.css` only; shared `radarDesignSystem.css`; homepage `homepage.css`; workflow `styles.css`. No competing root token definitions. Shared semantic primitives in `radarDesignSystem.tsx`; navigation data in `radarNavigationCatalog.ts`; keyboard menus/directory in `radarNetworks.tsx`.
- Client-rendered React, not server React hydration. Server HTML metadata/SEO and all route dispatch retained. `main.tsx` always wraps pages in shared shell, including separate Spend/Proof lazy boundaries.

## Canonical implementation values

| Role | Existing cyan source value |
| --- | --- |
| Canvas/panel/secondary surface | `#050b0c` / `#081113` / `#102024` |
| Bone text/muted text | `#f1f0e5` / `#a0c2d0` |
| Fine border | `#4e737d`, 1px |
| Action/Judgment | `#00eee4` / `#dc91ff` |
| Semantic success/warning/failure | `--ok: #9dffc2`, `--amber: #f6d06f`, `--red: #ff9393` |
| Families | `--font-ui` system sans; `--font-mono` SFMono/Menlo/Consolas |
| Content max/spacing/radius | 1560px; `.25,.5,.75,1,1.5,2,3rem` scale; `.25rem` controls/surfaces/panels |
| Shadows | `--shadow-surface: none`; menus use existing restrained floating shadow |
| Hero headline | homepage clamp `2rem,3.55vw,3.4375rem`, weight 800, line-height1.08, tracking-.055em |
| Homepage geometry | 16px exterior,14px shell gap; hero18px columns gap,16px12px20px interior; card12px gap/14px padding |
| Controls | homepage primary48px; shared primary touch44px; cyan focus ring |
| Motion | press120ms,menu160ms, reduced-motion handled in shared foundation |

Source evidence: `src/web/radarTokens.css`, `homepage.css`, `radarDesignSystem.css`, `radarDesignSystem.tsx`. No screenshot-derived token guesses.

## Current source/brief agreement

- Solana headline and CTAs exactly match selected source: **Proof before agent spend.**, **Check a Spend Route** → `/spend-terminal`, **Explore the Radar** → `#explore-solana-radar`.
- Existing hero supporting line says “Pay.sh is a spend rail. Radar is the evidence layer.” and includes `EvidenceScope kind="service"` advisory boundary.
- Source indexes are global navigation family metadata, not backend stages. Reuse existing formatter and avoid implying section numbers are proof stages.

## No-change list

All backend/server/services/data/store/contract code; app authority; execution/payment/proof/receipt claims; API methods/paths/payloads; fetch/retry/cache/polling behavior; URL routes/hashes/query strings; derived evidence/score/freshness selectors; wallet requirements; metadata/SEO; telemetry hooks; receipt provenance. Retain all accessible content and controls, including below screenshot content, disabled/loading/error/empty/unknown/fixture/stale states.

## Solana preservation checklist

- Skip link `#terminal-content`; shared brand/home, network selector, primary and Explore/mobile grouped navigation, all six catalog groups, all actual hrefs. Directory intentionally renders featured items; full catalog remains available through Explore/mobile menus.
- Header command palette with Command/Ctrl+K, keyboard list selection; View menu Agent Mode and Comfortable Density checkboxes; focus restoration/Escape and outside close behavior.
- Hero exact title/copy, Check a Spend Route `/spend-terminal`, Explore the Radar `#explore-solana-radar`, Pay.sh evidence doctrine and existing EvidenceScope advisory boundary.
- Terminal metadata: generated/ingestion timestamps, online vs fixture fallback, operator and terminal ID; boot loading and initialization delayed states; retry reload; partial-enrichment warnings and opt-in Developer diagnostics/disclosures.
- Current evidence state: Preflight Cards `/radar/cards`; evidence-led proof metrics and limitations; provider/endpoint counts, average trust/signal unknown fallbacks; Safe metadata; source/freshness/mode and FIXTURE-BACKED RADAR STATE; preflight anchor.
- Secondary actions `#compare`, `#benchmark-readiness`, `#route-mapping-registry`, `/claim`, `#agent-benchmark-api`.
- Machine Economy `/machine-market`; Signal Graph `/graph`; head-to-head benchmarks, Agent Spend Readiness cards and Evidence Ledger data.
- Global pulse/status/system reading/freshness/export/interpretation/leaderboards/narrative heat; Live Catalog Pulse disclosure, state filter `all/critical/degraded/watch/healthy/unknown`, sort `severity/last observed/provider`, event categories, evidence receipts, empty results and no-change messages.
- Semantic Search input/submit, loading/error/empty behavior, eight existing query examples and results.
- Agent Preflight JSON textarea/examples, batch hint/raw response disclosure, advisory action, API docs/copy controls and loading/error/evidence state.
- Provider/endpoint comparison mode and selections; comparison submit/results; Cost Performance and benchmark readiness; Route Mapping Registry status/category/intent filters; Mapping Targets planning-only descriptions; benchmark API and Superiority Readiness full-detail disclosures.
- Provider directory local query, sort, category tabs, selected rows; featured rotation checkbox/resume; manual selection/edit pause; provider dossier sections, selected provider context, service URL, trust/signal/propagation/monitor and unknown telemetry.
- Catalog-derived route category/maximum price/minimum trust/preference; selected-provider inclusion, compute route, seed selected provider, route result/evidence/limitations.
- Endpoint intelligence query/filter/details/copy JSON; endpoint list and partial catalog metadata fallbacks; provider assessments/history/recent changes evidence.
- Ecosystem rail counters/Propagation Watch/Anomaly Watch/history/deltas; Provider Activity `1h/24h/7d` windows; recent degradations and all evidence disclosure controls.
- Footer source and catalog state; all original landmarks/headings/status semantics.

## Robinhood Signal Desk preservation checklist

- Skip `#rh-chain-content`, shared suite navigation/network selector/deep links; page metadata/canonical/OG behavior.
- Original top-level desk APIs: `/v1/rh-chain`, `/review-queue`, `/4663-index`, `/daily-receipts`, `/meme-pulse`, `/today-on-4663`, `/launch-surfaces`, `/live-snapshot`, `/market/provider-status`, `/onchain/provider-status` under `/v1/rh-chain`; 60-second desk/meme refresh only. Preserve all module-specific failures, source policy and diagnostics.
- Brief/Analyst state toggle (`aria-pressed`, no URL change), title and copy, summary market state/top signal/risk/latest receipt/open reviews/observed/source count, source-policy disclosure, independent/read-only/advisory limitation.
- Contract checker label and input, trim/address validation, malformed input clears result, error-clear on edit, disabled/loading submit, `/v1/rh-chain/live-snapshot/token/{encodedContract}` request; polite announcement and alert; exact context/chain/source/liquidity/deployer/verified status/risk fields; conditional dossier/latest receipt/pair/explorer source links.
- Daily Pulse four cards with existing verdicts, classifications, observation times, source counts, statuses and deep hrefs; stale remains stale.
- Daily Receipt complete headline/date/status/freshness, four intelligence statements, liquidity/deployer/spillover/migration secondary notes, timestamp/source count/full receipt link. Share Receipt popover; on-demand receipt-relay API; Copy X post/permanent URL, share card, distribution pack, Telegram/Discord disabled/loading fallback; explicit-action caveat; clipboard feedback; Escape restoration/outside close.
- What Is Moving ranks/ticker/name/signal score/classification/verdict/risk/freshness, original score provenance; exact contract dossier vs index fallback; Share clipboard button and feedback; full index link and empty state.
- Risk Radar three instruments, severities/counters/descriptions/timestamps/evidence/deep links; absence is not safety.
- Meme Pulse `all/reviewed/auto-observed/risk` filters, query ticker/contract, Cards/Analyst Table views, force table in Analyst, original result semantics, copy contract disabled when unavailable, dossier/submit links, stale/source-required status and empty fallback.
- Launch/access route flow, incomplete/source-required states, risks and timestamp; Launch Surface Watch deep link.
- Review Queue cards, roles/evidence completeness/missing evidence/risk/next step/times/review deep links and empty state.
- Chain Pulse six genuine metrics, protocol/bridge context/timestamp and Live Snapshot link.
- Analyst Evidence Machinery: full ranked 4663 index/scoring/source policy, complete meme provenance, full reviewer notes, protocol/provider context, receipt sources/caveats, classifier/raw-risk evidence; all native details and source links.
- Methodology four principles and `/methodology`, `/rh-chain-signal-desk/daily-receipts`, `/rh-chain-signal-desk/distribution-pack`, `/v1/rh-chain`; opt-in technical source policy with generation metadata; original advisory footer.

## Existing validation infrastructure

Package scripts: `npm run lint` (`tsc --noEmit --pretty false`), `npm run typecheck` (`tsc --noEmit`), `npm run build` (server TypeScript compile + asset copy + Vite client build), `npm test` (Vitest). No distinct ESLint command. `npm run check:design` enforces canonical cyan palette, single token ownership, shared shell, truthful homepage preview and 130 route patterns. Existing `test:ui`, `test:ui:journeys`, `test:ui:visuals` browser scripts and Playwright1.64.0/axe4.14.0 are present. Vite defaults tests to node; component tests opt into jsdom. Production smoke/load/deploy excluded. Existing full regression baseline requires Node24.21 and disposable PostgreSQL16 with CANONICAL_RECEIPT_TEST_URL, ECONOMIC_ENGINE_TEST_URL and POSTGRES_RESILIENCE_TEST_URL to run durability/migration/termination coverage without skips.

Relevant existing coverage:

- `tests/rh-chain-pages.test.tsx`: Brief order, exact/malformed contract, loading/chain mismatch/no-pair/provider unavailable, degraded queue isolation, stale/source policy, Analyst toggle without URL change, receipt-share clipboard and Escape focus, receipt/market/index/suite deep routes/fallback.
- `tests/rh-chain-signal-desk-selectors.test.ts`: deterministic Today/movers/risk/review/chain selection, explicit source-required/empty/future timestamp guards.
- `tests/radar-network-navigation.test.tsx`: actual routes, six product groups/catalog consistency/all menu destinations, featured directory scope, compact/mobile menus, keyboard arrows/Escape/focus restoration/outside close, View setting behavior.
- `tests/radar-endpoint-intelligence.test.tsx`: preflight, evidence ledger unavailable/real ratios, semantic query/empty states, local provider/endpoint filters, disclosures, copy JSON, export, readiness/mapping filters/advisory risk/anomaly/failure states.
- `tests/frontend-evidence.test.tsx`, `tests/web-accessibility.test.tsx`: partial data and landmarks/accessibly named control semantics.
- `tests/homepage-performance.test.tsx`: current lightweight canonical homepage, protected lazy boundaries and no deep-route import regression.
- `tests/render-spa-routing.test.ts`: server HTML/JSON route boundaries/caching/title/description/canonical/OG behavior.
- Extensive domain/unit/API/integration proof/payment/receipt tests in full Vitest suite.

## Evidence files

The exact baseline was archived before edits; its temporary archive was later cleared during interruption. Retained evidence: SHA256 map for all 1,532 tracked files in `source-hashes.json`; plain-text runtime/static/frontend/full logs under `logs/`; static command/exit results in `logs/static-results.json`; frontend/full assertion results in `logs/frontend-tests.json` and `logs/full-tests.json`; commands/timing in `logs/test-results.json`; combined runtime/validation summary in `baseline-validation-summary.json`. Reconstruct source with `git archive d3d0a445ec20e8c55170c2fc1f52aff220b2a851`. Dependencies were reused only after exact lockfile SHA equality; no tracked dependency or production configuration changed. Final validation after runtime restoration has its own complete logs and manifests.
