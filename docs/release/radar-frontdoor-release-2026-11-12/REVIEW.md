# Radar Front Door Release Candidate Review

**Disposition: PARTIAL — Radar Front-End Live 0.1 is owner accepted for release packaging; current/live Radar intelligence and production remain HOLD pending independent release review and separate production authorization.**

## Source and preservation

- Verified `origin/main`: `243e7b0127f86c6c8aff0be144976e53b6f750bd` (matches the expected SHA).
- Release branch: `codex/radar-frontdoor-release-20261112`.
- Release branch was verified at base `243e7b0127f86c6c8aff0be144976e53b6f750bd` before packaging. The release commit SHA is recorded in the PR and packaging results.
- Source UI: `/Users/ahdilm/Documents/Codex/2026-10-20/infopunks-unified-app-ui-int-01/implementation`, source identity `sha256:45ba171c40471475d9106ff1dcf94662aef4cfb53910033347fc175d4bf21c78`.
- The owner has accepted Radar Front-End Live 0.1. That acceptance covers the public operating profile, not advanced Radar readiness or production deployment. The preservation checkout at `/Users/ahdilm/Documents/Infopunks Pay.sh Intelligence Terminal` was not changed by this work.

## Changed-file manifest

### Production and UI source

- `src/config/env.ts` — adds strict `RADAR_FRONTDOOR_ONLY` parsing to runtime configuration; skips the database/catalog production schema only in that explicit mode. Other runtime/security parsing remains active.
- `src/api/app.ts` — early front-door-only app branch, strict GET/HEAD public allowlist, 503 boundary, health/readiness/version/status handlers, static SPA/artwork serving, traversal guard, and WebP MIME mapping. Returns before database pools, repositories, catalog hydration, and background work are constructed. Existing normal-mode route handlers remain in their original full-stack registration path.
- `src/api/curatedReadRoutes.ts` — front-door-only registration for existing in-memory narrative, signal, attention-market and abundance read models, with stale archive classification and source timestamps. No live provider or RH market data is synthesized.
- `src/web/homepage.tsx` — restores the candidate homepage component and static judgment preview; adds a concise front-door label that live checks are unavailable. Initial render makes no API request.
- `src/web/main.tsx` — mounts the nine Economic OS paths through the unified shell; for the injected front-door profile, mounts only explicitly allowlisted archive pages instead of the full Radar app bootstrap.
- `src/web/frontdoorBasicPages.tsx` — reuses existing narrative, attention-market, Signal Desk and abundance screens with an explicit archive/stale/unavailable notice.
- `src/web/narrativePages.tsx` — in front-door mode only, replaces “Live Watch” labels/copy with “Archived Watch” and archive language; the full-stack text and page behavior remain unchanged.
- `index.html` — identifies the normal full-stack operating profile; the front-door server changes this response metadata only in front-door mode.
- `src/web/productPrimitives.tsx` — marks all Economic OS screens as the current Economic OS navigation item.
- `src/web/radarAppShell.tsx` — shared Economic OS shell context and breadcrumbs for all nine screens; front-door archive routes use unified Radar wayfinding without inheriting a false Solana context.
- `src/web/radarNavigationCatalog.ts` — restores the candidate’s Economic OS navigation label.
- `src/web/radarPageIdentity.ts` — identifies Economic OS routes with the candidate’s shared section heading.
- `src/web/economicOSPage.tsx` — nine read-only screens and shared screen navigation.
- `src/web/economicOS.css` — candidate terminal styling and responsive layout.
- `src/web/economicEvidence.json` — retained historical/local/simulated evidence with pending review states.
- `src/web/economicProof.js` and `src/web/economicProof.d.ts` — rendered proof presentation and its type declaration.
- `public/artwork/economic-signal-punk.webp` — candidate artwork. Existing `public/artwork/signal-punk.webp` is served by the corrected allowlist; it was already present on main.
- `package.json` and `package-lock.json` — add Playwright as a development dependency for real-browser qualification.

### Qualification and review evidence

- `tests/frontdoor-only-qualification.test.ts` — production configuration, pool spy, real HTTP isolation, artwork/static delivery, and desktop/mobile browser/deep-link coverage.
- `tests/homepage-performance.test.tsx` — updates homepage regression expectations for the restored candidate and verifies no automatic live-data request or claim.
- `tests/economic-os-navigation.test.tsx` — updates the pre-existing route regression from the superseded one-screen prototype to the restored nine-screen Economic OS component and its terminal navigation label.
- `docs/release/radar-frontdoor-release-2026-11-12/REVIEW.md` — this review packet.
- `docs/release/radar-frontdoor-release-2026-11-12/home-desktop-1440.png`
- `docs/release/radar-frontdoor-release-2026-11-12/home-mobile-390.png`
- `docs/release/radar-frontdoor-release-2026-11-12/economic-os-desktop-1440.png`
- `docs/release/radar-frontdoor-release-2026-11-12/economic-os-mobile-390.png`
- `docs/release/radar-frontdoor-release-2026-11-12/archive-narratives-1440.png`
- `docs/release/radar-frontdoor-release-2026-11-12/archive-narratives-390.png`
- `docs/qualification/RH-READ-ONLY-QUALIFICATION.md` — separate source-provenance and dependency assessment; no new live RH route was activated.
- `docs/qualification/RH-READ-DEPENDENCY-MATRIX.md` and `docs/qualification/RH-HISTORICAL-FINDINGS.md` — read-path dependency inventory and historical observation record.

No other source files were imported. Existing Solana, RH Chain, Pay.sh ingestion, simulator, pre-spend, receipt, evidence, migrations, and repository implementations remain in the main-based tree.

## HTTP boundary and startup evidence

| Request group | Expected result | Qualification result |
|---|---:|---|
| `GET /` and allowlisted frontend assets (JS/CSS, icons, manifest, social image and artwork) | 200 | Pass; exact static allowlist, WebP and manifest MIME types, traversal aliases rejected |
| `GET /artwork/signal-punk.webp`, `GET /artwork/economic-signal-punk.webp` | 200, `image/webp` | Pass |
| Nine exact `/economic-os/{overview,launch,constitution,research,radar,orders,delivery,receipts,activity}` paths, with optional trailing slash | 200 SPA entry | Pass; direct navigation and refresh verified in Chromium at 1440px and 390px |
| `GET /healthz` | 200 with existing response security headers | Pass |
| `GET /readyz` | 503 degraded, persistence unavailable | Pass |
| `GET /version` | 200 | Pass |
| `GET /status` | 200; `frontdoor_only`, no DB initialized, persistence not initialized, catalog not started, counts null | Pass |
| Curated existing archive reads: `/v1/narratives*`, `/v1/signals*`, `/v1/attention-market-watch*` (GET only), `/v1/signal-desk*`, `/v1/abundance*` | 200 with `X-Radar-Data-Class: curated-archive`, `X-Radar-Data-Freshness: stale`, source timestamp | Pass; only listed static in-memory projections are permitted |
| Live pulse/provider/catalog/RH market reads, all unknown `/v1/*`, query/encoded/trailing-slash variants, payment, execution, settlement and pre-spend | 503 with `Retry-After: 300` | Pass |
| Archive HTML pages: narratives, attention-market, named attention profiles, named narrative signal pages, abundance | 200 SPA entry; direct navigation and refresh | Pass; desktop and mobile Chromium, no page/console errors or failed API calls |
| Admin, reviewer, private proof, internal diagnostics, unsupported methods including `OPTIONS`, traversal aliases, and unsupported health variants | 503 | Pass |
| Registered probe handler behind the hook | Never invoked | Pass; invocation spy remained zero |

With `NODE_ENV=production`, `RADAR_FRONTDOOR_ONLY=true`, no database URL, and no catalog settings, config loads and `createApp()` starts. Spies on the pool factory, `createIntelligenceStore`, Pay.sh ingestion, monitor runner and `setInterval` record zero calls. The early-return branch is before database pool creation, database-backed stores, live catalog bootstrap, analytics refresh, ingestion/monitor scheduling, RH Chain database automation construction, and IPX shadow worker execution. `/status` reports `dbMode: not_initialized`, `persistence: not_initialized`, null provider/endpoint counts, and `catalog_status: not_started`; it does not assert successful persistence. Malformed flag values and malformed unrelated judgment signing configuration are rejected, while explicitly disabling the flag retains normal production database/catalog requirements.

The homepage no longer requests `/v1/pulse` at initial render. The browser saw no `/v1` requests, no page errors, and no console errors. The homepage labels live checks unavailable and its judgment preview says no check or execution has occurred. Submitting its route form targets `/spend-terminal`, which is deliberately blocked by the front-door boundary with 503.

The selected public Radar read pages call only the listed curated projections. Browser checks exercised `/narratives`, `/narratives/attention-markets`, `/narratives/attention-market-watch`, `/attention-market-watch/ansem`, `/signals/black-bull`, and `/abundance` at desktop and mobile widths, including refresh. Their common notice says the source material is dated through July 2026 and that live feeds, submissions, and consequential actions are unavailable. Response headers repeat the stale classification and original source timestamp. The front door does not activate provider/catalog reads, `/v1/pulse`, RH Chain reads, snapshots, or any write route. POST intake is still 503 before its handler.

## Two separate release assessments

### FRONT DOOR RELEASE

- **Public experience:** homepage, approved artwork, nine Economic OS routes, and selected existing archive pages render with direct URL refresh. Desktop/mobile browser checks saw no page or console errors.
- **Basic Radar reads:** selected narrative, Signal Desk, attention-market and abundance projections are reusable without DB/network work, but their underlying records are dated in June/July 2026. They are exposed as stale archive data only, never as current live intelligence. All page API calls in the exercised journeys returned without server errors.
- **Unavailable:** live provider/catalog, pulse, RH market intelligence, database-backed projections, submissions, payments, execution, settlement and other writes remain unavailable. `/status` is explicit about this mode.
- **Database independence:** pool construction and store hydration/worker spies are zero in front-door startup; details below.
- **Production status:** unverified and not deployed. This packet makes no public-domain availability claim.

### FULL-STACK PRESERVATION

- Source implementations and route registration for Solana, RH Chain, Signal Desk, Pay.sh, x402/pre-spend, providers, ingestion, simulator, receipts, evidence, settlement, analytics, monitoring and schedulers remain in the main-based source tree. Migrations and repositories are not changed or removed.
- The normal `createApp()` registration path retains its original handlers and initialization path. The front-door branch returns before those initializers and is selected only by the strict `RADAR_FRONTDOOR_ONLY=true` configuration; setting it false returns to normal production qualification.
- Temporarily bypassed startup paths: database pool/store repositories and hydration; live Pay.sh catalog bootstrap; initial/background analytics; ingestion and monitor interval work; RH Chain automation and receipt-draft scheduling; immediate/periodic IPX/PLTR shadow observation; normal full API route registration. Exact call sites remain in `src/api/app.ts` and feature config in `src/config/env.ts`.
- Reactivation requires `RADAR_FRONTDOOR_ONLY=false`, valid production security/catalog/database configuration, a verified reachable database with required migrations (including `judgment_requests`), separately qualified catalog bootstrap, and isolated qualification of each worker/scheduler and its resource profile. No broad full-stack readiness claim is made.
- Current fresh provider and RH intelligence reads were not qualified and remain blocked in this release mode. Static records are archival and stale.

### Existing API and service architecture inventory

| Existing route/service family | Source/dependency shape | Front-door decision |
|---|---|---|
| `/healthz`, `/readyz`, `/version`, runtime diagnostics | Process health/version and config/persistence readiness projections | `/healthz`, `/version`, and explicit front-door `/status` available; `/readyz` returns 503 because persistence is not initialized. Other diagnostics stay closed. |
| `/v1/pulse`, `/v1/providers`, `/v1/endpoints`, `/v1/routes`, `/v1/graph`, `/v1/radar/*` | Uses the startup intelligence store; provider/endpoints and pulse paths may hydrate PostgreSQL/catalog and trigger bootstrap or analytics | Unavailable. No store is constructed in front-door mode. |
| `/v1/narratives*`, `/v1/signals*`, `/v1/attention-market-watch*`, `/v1/signal-desk*`, `/v1/abundance*` | Existing bounded in-memory source modules; selected GET handlers have no database, external-network, mutation, or worker call in the handler/data path | Only exact reviewed static GET projections are available, marked stale/archive with original timestamps. POST intake and all other methods stay unavailable. |
| `/v1/rh-chain*`, `/v1/4663*`, `/og/rh-chain*`, `/internal/rh-chain*`, `/internal/4663*` | Mix of database snapshot/history stores, external provider/RPC reads, caching, and some GET handlers that refresh, scan, or persist | Unavailable; no RH read was found and qualified as bounded, current, side-effect-free without normal startup dependencies. |
| `/v1/pre-spend*`, judgment, payment/x402, machine execution, receipts/evidence/settlement, proof and verification families | Policy evaluation, authentication, external payment/signing, durable receipt/evidence stores, settlement or consequential actions | Unavailable in this release mode, including GETs where storage or authorization semantics were not separately qualified. |
| Pay.sh catalog, ingestion, simulator, Hermes, signal-hunt, analytics, monitor and scheduler routes | Catalog bootstrap, in-memory/database stores, background jobs, providers, webhook or execution paths; GET semantics vary by handler | Not activated wholesale. Only the named curated projections above are exposed; other routes fail closed. |
| `/admin*`, `/reviewer*`, `/private*`, `/internal*`, protected proof paths and unknown paths | Privileged, tenant-sensitive, internal or not inventoried as safe | Unavailable; unknown paths cannot fall through to the full app in this profile. |

The route decision is based on existing handler/data call paths, not HTTP verb alone. In particular, RH “GET” handlers were not assumed safe: startup-backed stores, live refreshes, snapshots, RPC/provider work, and persistence side effects prevent their activation without separate qualification.

## Prior incident evidence and historical milestones

See [the separate database/startup incident record](DATABASE-INCIDENT-INVESTIGATION.md). It distinguishes the November 4 missing `judgment_requests` relation/circuit event from November 4–5 PostgreSQL backend SIGKILLs during snapshot insert periods and from the owner-reported November 7 catalog/analytics memory exhaustion. No available evidence establishes Signal Desk as root cause. The investigation record separates confirmed historical observations from owner-reported milestones and open hypotheses.

The August 17 resilience commit is verified in local Git history. The reported August 17 memory-mode count (74 providers/718 endpoints, ingestion disabled), August 18 migrations/44-minute soak, August 31 stale public surface, and September RHJ/PLTR/holder/receipt milestones are supplied historical context only, not evidence of current readiness.

## UI comparison

The desktop and mobile captures match the candidate’s cyan terminal layout, shared header, artwork, hierarchy, and responsive composition. The homepage includes one front-door availability sentence absent from the source screenshot so the disabled live-check state is explicit. The Economic OS screens retain the candidate’s release-hold and pending-research labels; owner acceptance of the 0.1 operating profile does not represent acceptance of pending research content. The selected existing Narrative Intelligence screen keeps its original layout and client-side filters; front-door-only copy marks it archival and renames the stale “Live Watch” status to “Archived Watch.”

| Local capture | Candidate reference |
|---|---|
| `home-desktop-1440.png` | `implementation/screenshots/desktop/radar.png` |
| `home-mobile-390.png` | `implementation/screenshots/mobile/radar.png` |
| `economic-os-desktop-1440.png` | `implementation/screenshots/desktop/economic-os-overview.png` |
| `economic-os-mobile-390.png` | `implementation/screenshots/mobile/economic-os-overview.png` |
| `archive-narratives-1440.png`, `archive-narratives-390.png` | Existing Narrative Intelligence page, desktop and mobile, with archive notice |

## Checks

- `npm run build`: exit 0. Vite reports an existing large-chunk advisory for the ~1.41 MB `radarApp` chunk; it does not fail the build.
- `npx tsc --noEmit --pretty false`: exit 0.
- `npx vitest run tests/frontdoor-only-qualification.test.ts --testTimeout=30000`: exit 0, 9 tests passed.
- Relevant regressions (`homepage-performance`, `production-degraded-features`, `health-readiness`, `env`, `radar-network-navigation`, `radar-navigation-responsive`, `economic-os-navigation`, narrative/abundance pages and APIs, Signal Desk selectors, and `rh-4663-proof-profile-ui`): exit 0, 14 files / 122 tests passed.
- `git diff --check`: exit 0.

### Qualification issues found and resolved

- An initial browser run used an older generated `dist/client` bundle and timed out after 30 seconds waiting for the new `Data availability` note. Rebuilding the production bundle resolved the test setup mismatch; the final fresh-build browser suite passes.
- The first stale-copy assertion found “Live Watch” remaining in risk-facet chips after the main status headings had been changed. The shared facet label now maps to “Archived Watch” only when the front-door profile meta is present; the final desktop/mobile page assertions pass with no “Live Watch” text on the tested archive index.
- An initial `OPTIONS /v1/__frontdoor_probe` probe received Fastify CORS's strict-preflight HTTP 400 before the isolation hook. The front-door method/path hook now runs before CORS registration; the final matrix returns 503 before the protected probe handler.
- The existing Economic OS navigation regression targeted the superseded `/economic-os/overview` prototype. Its first run had two failures: `.economic-os-overview h1` was absent, and it expected “Economic OS” while the approved shared navigation renders “ECONOMIC OS.” That directly relevant test now asserts the restored `EconomicOSPage`, read-only/release-hold label, and actual navigation label. It passes. No RH Chain fixture test was changed.

### RH Chain TypeScript fixture comparison

The clean-main file `tests/rh-4663-proof-profile-ui.test.tsx` has Git blob `c9012328026a4e94f944f498bd8af7a1def77b05`, exactly the blob at the verified main base. It passes in the relevant regression set and the full TypeScript check. The preservation checkout has an uncommitted edit to this file (working-tree blob `ac40f3632426f1a680d25f585619c622825dccb8`) that adds fixtures and a typed profile presentation; that dirty edit was not imported or repaired here. Thus the previously observed fixture error is not present on clean main and is attributable to the excluded working-tree edit, not this release candidate or main divergence.

## Render plan (not applied)

The observed Render service is `infopunks-pay-sh-radar` (`srv-d7u6kjhkh4rs738hjbgg`), suspended, tracking `main`, with auto-deploy off. Its current HTTP health-check path was blank. When separately authorized, prepare the service with:

- `NODE_ENV=production`
- `RADAR_FRONTDOOR_ONLY=true`
- Render-provided `PORT` (currently exposed as port 10000)
- HTTP health check `/healthz`
- Auto-deploy remains off

Do not use `/readyz` for the HTTP health check; this mode intentionally reports not-ready while static serving is alive. This local qualification did not change Render, database, environment, deployment, or DNS settings. Release packaging may push the feature branch and open/merge its PR as directed; Render changes, service resume, and deployment remain subject to their separate authorization boundary. Pushing does not deploy while auto-deploy is off.

## Rollback and risks

- Local rollback target: verified main SHA `243e7b0127f86c6c8aff0be144976e53b6f750bd`.
- Production rollback target, if later released: the prior Render deployment currently associated with `243e7b0`; no deployment action is authorized in this checkpoint.
- Release risk: Economic OS content includes a pending research draft. Backend actions intentionally return 503; the homepage form cannot execute a check in front-door-only mode.
- Candidate source systems and implementations remain preserved and the mode is configuration-reversible by setting `RADAR_FRONTDOOR_ONLY=false` in a future approved full-runtime release.

**Decision:** Radar Front-End Live 0.1 is owner accepted and locally qualified for release packaging. Production remains **HOLD** pending release review, merged-SHA and Render-settings review, and explicit authorization to resume and manually deploy.
