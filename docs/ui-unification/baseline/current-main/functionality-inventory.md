# Baseline functionality and test inventory

Baseline supplied by parent: branch `main`, commit `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`. Existing untracked `docs/qualification/` preserved. No application source has been changed by this validation worker.

## Actual route/component map

- `/`: `src/web/main.tsx` renders `UniversalHomepage` from `src/web/homepage.tsx` directly, imports `homepage.css` and defers all deep route code to the lazy `radarApp` boundary. This is the current canonical homepage, not `UniversalRadarHomepageHero` inside radarApp.
- `/solana` (optional trailing slash): default route dispatcher in `src/web/radarApp.tsx` renders `RadarApp landingContext="solana"`. Full data-rich terminal; `styles.css` imported by radarApp. Hero is `SolanaRadarHomepageHero`, directory is shared `SolanaRadarDirectory` from `radarNetworks.tsx` using `radarNavigationCatalog.ts`.
- `/rh-chain-signal-desk` (optional trailing slash): `RhChainSignalDeskPage` in `rhChainSignalDeskPages.tsx` renders `RhChainSignalDeskV2`. Aliased narrative route `/narratives/robinhood-chain` also uses this content. Other RH Chain suite routes are separate components and must retain their existing behavior.
- Shared product navigation/menu/view settings: `radarNetworks.tsx`, catalog: `radarNavigationCatalog.ts`.
- Client-rendered React roots, no server React hydration. Server supplies route HTML metadata, canonical and OG tags; preserve route dispatch and metadata.

## Source truth mismatches against brief

- Existing Solana hero CTAs are **Open Radar** → `#global-pulse` and **Run Preflight** → `#preflight`. The brief calls them Check a Spend Route / Explore the Radar. Existing working labels/targets take priority and should remain.
- Homepage RH primary entry points now include `/4663` in addition to Signal Desk `/rh-chain-signal-desk`; these are separate existing product environments/routes and neither must be silently relabeled or repointed.

## No-change list

All backend/server/services/data/store/contract code; app authority; execution/payment/proof/receipt claims; API methods/paths/payloads; fetch/retry/cache/polling behavior; URL routes/hashes/query strings; derived evidence/score/freshness selectors; wallet requirements; metadata/SEO; telemetry hooks; receipt provenance. Retain all accessible content and controls, including below screenshot content, disabled/loading/error/empty/unknown/fixture/stale states.

## Solana preservation checklist

- Skip link `#terminal-content`; shared brand/home, network selector, primary and Explore/mobile grouped navigation, all six catalog groups, all actual hrefs. Directory intentionally renders featured items; full catalog remains available through Explore/mobile menus.
- Header command palette with Command/Ctrl+K, keyboard list selection; View menu Agent Mode and Comfortable Density checkboxes; focus restoration/Escape and outside close behavior.
- Hero exact title/copy, Open Radar `#global-pulse`, Run Preflight `#preflight`, Pay.sh evidence doctrine.
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

Package scripts: `npm run lint` (`tsc --noEmit --pretty false`), `npm run typecheck` (`tsc --noEmit`), `npm run build` (server TypeScript compile + asset copy + Vite client build), `npm test` (Vitest). No distinct ESLint command. Vite config default node environment; frontend tests opt into jsdom, manually use React act/createRoot. Browser runner/E2E config is not present in repository. Production smoke/load/deploy scripts excluded from this task.

Relevant existing coverage:

- `tests/rh-chain-pages.test.tsx`: Brief order, exact/malformed contract, loading/chain mismatch/no-pair/provider unavailable, degraded queue isolation, stale/source policy, Analyst toggle without URL change, receipt-share clipboard and Escape focus, receipt/market/index/suite deep routes/fallback.
- `tests/rh-chain-signal-desk-selectors.test.ts`: deterministic Today/movers/risk/review/chain selection, explicit source-required/empty/future timestamp guards.
- `tests/radar-network-navigation.test.tsx`: actual routes, six product groups/catalog consistency/all menu destinations, featured directory scope, compact/mobile menus, keyboard arrows/Escape/focus restoration/outside close, View setting behavior.
- `tests/radar-navigation-responsive.test.ts`: existing CSS contracts for menus/touch targets/directory containment (source text assertions; does not substitute actual browser).
- `tests/radar-endpoint-intelligence.test.tsx`: preflight, evidence ledger unavailable/real ratios, semantic query/empty states, local provider/endpoint filters, disclosures, copy JSON, export, readiness/mapping filters/advisory risk/anomaly/failure states.
- `tests/frontend-evidence.test.tsx`, `tests/web-accessibility.test.tsx`: partial data and landmarks/accessibly named control semantics.
- `tests/homepage-performance.test.tsx`: lightweight homepage boundary, failed/never-resolving pulse, navigation targets/touch CSS, existing //4663 connection.
- `tests/render-spa-routing.test.ts`: server HTML/JSON route boundaries/caching/title/description/canonical/OG behavior.
- Extensive domain/unit/API/integration proof/payment/receipt tests in full Vitest suite.

## Evidence files

Source bytes before edits preserved under `source/`, SHA-256 map `source-snapshot.json`. Baseline command output/exit files: `lint.log`/`lint.exit`, `typecheck.log`/`typecheck.exit`, `build.log`/`build.exit`, `test.log`/`test.exit`, machine-readable `tests.json`.
