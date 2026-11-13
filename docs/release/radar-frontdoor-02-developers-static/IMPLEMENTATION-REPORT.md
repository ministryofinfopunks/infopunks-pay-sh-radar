# Radar Front Door 0.2 — Static Developers Implementation Report

**Implementation status:** independently accepted and requalified; final git recording is in progress. No deployment authorization was used.

## Repository identity

- Repository: `ministryofinfopunks/infopunks-pay-sh-radar`
- Remote: `https://github.com/ministryofinfopunks/infopunks-pay-sh-radar.git`
- Verified remote `main`: `7c8bb64a1f14c764bd17c8d0da68ddc25d815b56`
- Approved Front Door 0.1 merge SHA: `7c8bb64a1f14c764bd17c8d0da68ddc25d815b56`
- Ancestry: approved SHA is an ancestor of remote `main`; both SHAs are identical.
- Verification: `git fetch origin main`, `git ls-remote origin refs/heads/main`, `git show-ref --verify refs/remotes/origin/main`, and `git merge-base --is-ancestor 7c8bb64a1f14c764bd17c8d0da68ddc25d815b56 refs/remotes/origin/main`.
- Implementation branch: `codex/radar-frontdoor-02-developers-static`
- Worktree: `/Users/ahdilm/.codex/worktrees/radar-frontdoor-02-developers-static/Infopunks Pay.sh Intelligence Terminal`
- Exact starting/base SHA: `7c8bb64a1f14c764bd17c8d0da68ddc25d815b56`
- Final implementation SHA: pending independent review and commit decision.

The existing release worktree was found at `/Users/ahdilm/.codex/worktrees/radar-frontdoor-release-20261112/Infopunks Pay.sh Intelligence Terminal`, branch `codex/radar-frontdoor-release-20261112`, HEAD `c1ca2c29541cb441598f560f5962557e20785986`. Its HEAD was not treated as the deployed baseline. The protected preservation checkout remains on `codex/radar-local-preservation-20261030` at `ddf11675226f1ca05f384b7ee3069e347a867a1e`; it was not used for implementation or edited. The initial repository worktree was dirty before this mission.

The 0.1 review packet is present at `docs/release/radar-frontdoor-release-2026-11-12/REVIEW.md`, but its historical source section records a different earlier `origin/main` value (`243e7b…`). Current remote metadata independently verifies the approved merge SHA above. The separate 0.1 database incident investigation was read; it is historical source review, not current production evidence.

## Implementation

### New files

- `src/web/developersStaticPage.tsx` — isolated architecture guide with economic loop, four receipt stages, service boundaries, conceptual integration sequence and availability disclosure.
- `src/web/developersStatic.css` — local responsive cyan terminal styling using existing Radar CSS tokens.
- `docs/release/radar-frontdoor-02-developers-static/REVIEW-PACKET.md` — adversarial independent-review request and evidence index.
- Six Chromium captures in this directory: `developers-desktop-1440.png`, `developers-mobile-390.png`, `home-desktop-1440.png`, `home-mobile-390.png`, `economic-os-desktop-1440.png`, and `economic-os-mobile-390.png`.

### Modified files

- `src/api/app.ts` — permits only exact `/developers` and `/developers/` GET/HEAD paths through the existing front-door request guard and serves those paths as the existing static SPA shell. No other route or method was added to the allowlist.
- `src/web/main.tsx` — adds a lazy static Developers chunk selected only when the injected profile is `frontdoor-only` and the path is exactly `/developers` (optional trailing slash). The static page does not render `RadarAppShell` or `LazyRadarApp`.
- `tests/frontdoor-only-qualification.test.ts` — adds zero-call startup spies, exact static route checks, fail-closed route checks, and desktop/mobile Chromium/offline-external qualification.
- `tests/developers-profile-routing.test.tsx` — qualifies both profile selections through the real `main.tsx` `App` route, plus nested-path behavior.
- `tests/frontdoor-import-side-effects.test.ts` — installs probes before dynamically importing the application graph and records import-time network, timer and service-factory calls.

The full-stack Developers implementation in `src/web/preSpendBuilderPages.tsx` and its `/developers` route in `src/web/radarApp.tsx` were not modified. In full-stack mode, the profile remains `full-stack`, so the front-door-specific condition does not match and the original lazy `RadarApp` route remains selected. Existing Developers component tests continue to exercise its SDK, judgment outcomes, resource links and original behavior.

The server guard is the existing `RADAR_FRONTDOOR_ONLY` early-return branch in `createApp()`. The new document route is explicit and narrow; no broad activation switch or backend fallback was introduced. `src/api/app.ts` returns from the front-door branch before normal-mode database, repository, store, provider, worker and route construction.

## Content integrity

Architecture facts were checked against source and these documents:

- `docs/canonical-receipt-spine.md`
- `docs/autonomous-economic-judgment-spec.md` (clearly marked proposed where applicable)
- `docs/economic-engine-implementation.md`
- `docs/phase2-canonical-judgments.md`
- `docs/phase3-execution-proof.md`
- `src/schemas/receipts/{observationReceipt,judgmentReceipt,executionReceipt,evaluationReceipt}.ts`
- `src/services/{judgmentService,receiptAuthorityService,executionProofService,evaluationService,economicExecutionGate}.ts`
- `src/api/app.ts`, `src/config/env.ts`, `src/web/main.tsx`, `src/web/radarApp.tsx`, and `src/web/preSpendBuilderPages.tsx`

The page explains observation → judgment → execution → evaluation ancestry; judgment as assessment rather than execution authority; separate host/rail enforcement; and score projection from qualifying evaluations. It identifies Pay.sh as a spend rail and execution systems as the actors that execute. The economic operating loop is presented as architecture, not a claim that every stage or rail is enabled.

Deliberately excluded: executable API calls, SDK snippets, live OpenAPI links, operational endpoint claims, live provider/status claims, synthetic telemetry, invented integration guarantees, claims that Radar executes payments, and claims that unsupported Solana or Robinhood execution profiles are currently operational. The guide states that live API access, OpenAPI, live checks and protected endpoints are unavailable in this front-door profile.

The referenced `docs/design-system/constitution.md` and `ui-int2/baselines.md` were not present in the verified base tree. Existing `src/web/radarTokens.css`, `src/web/radarDesignSystem.css`, and 0.1 screenshots were inspected and used for the visual language. No replacement design-system documents were created.

## Independence evidence

### Startup spies

`npm test -- tests/frontdoor-only-qualification.test.ts` passed **1 file / 10 tests**. On front-door `createApp()` startup, spies reported **zero calls** to:

- database pool construction (`getDatabasePool`);
- repository construction (`defaultRepository`);
- store hydration (`createIntelligenceStore`);
- Pay.sh ingestion and catalog bootstrap (`runPayShIngestion`, `runPayShIngestionWithOptions`);
- provider construction (`DexScreenerProvider`, `BlockscoutProvider`) and outbound `fetch`;
- RH 4663 provider-client factory (`createRh4663UtcDayProviders`), Pair V5 verifier/discovery adapter, Long Doppler verifier, and stock supply indexer construction;
- monitor execution (`runMonitor`);
- interval creation (`setInterval`);
- RH automation, daily receipt-draft and IPX shadow-observation construction.

The front-door `/status` response remains explicit: database and persistence are not initialized, catalog is not started, and provider counts are null.

After the initial review, `tests/frontdoor-import-side-effects.test.ts` added separate probes before dynamically importing `src/api/app.ts` and its graph. It records **zero** calls to network fetch, `setInterval`, `setTimeout`, `setImmediate`, database/repository/store/catalog factories, monitor, DexScreener/Blockscout constructors, the RH 4663 provider-client factory, Pair V5 verifier/discovery adapter, Long Doppler verifier, stock supply indexer, RH automation, receipt drafts and IPX shadow observation during module import. `tests/developers-profile-routing.test.tsx` renders the real `App` and lazy route modules with each operating profile: `/developers` selects the original full-stack Developers page under `full-stack` and the static guide under `frontdoor-only`.

### Route and browser qualification

- `GET /developers` and `GET /developers/`: 200 static SPA shell.
- `/developers/wallet-safety`, `/developers/unapproved`, `POST /developers`, `/openapi.json`, `/v1/pre-spend/check`, protected/admin/private proof paths, payment/execution/settlement routes, unknown API paths and mutation methods: 503 with `Retry-After: 300` under the existing front-door response boundary.
- Existing health/readiness/version/status semantics and all nine Economic OS deep links were exercised by the same suite. Readiness remains 503 with `frontdoor_only`; protected API handlers are not reached.
- Chromium qualification covered 1440×900 and 390×844 viewports, direct navigation, refresh, homepage navigation, all four receipt headings, all document sections, and local JS/CSS assets.
- The browser context aborted all external-origin requests. The observed external request list, failed request list, page errors and console errors were all empty. The page made no `/v1/*` or `/openapi.json` request, and did not fetch the `radarApp` chunk. No polling or API activity was observed during the `networkidle` checks.
- Screenshots are retained in this directory. Existing homepage captures were visually compared with the approved 0.1 desktop screenshot; they match. The suite also re-exercised the nine Economic OS routes on desktop/mobile and the curated archive routes.

### Full-stack Developers preservation

- Existing `tests/pre-spend-builder-pages.test.tsx` passed and still verifies the full-stack Developers page and Wallet Safety routes.
- Route selection is source-visible: only the exact front-door profile/path selects the new component; otherwise `main.tsx` selects the original lazy full-stack app.
- Existing app, homepage, Economic OS, archive, health and protected-route tests passed in the focused and full-suite runs, except the two unrelated failures listed below.

## Regression evidence

- `npm run build`: passed; Vite reports the existing large-chunk advisory for the separate ~1.41 MB `radarApp` chunk. The new static Developers assets are separate lazy chunks (~11.44 KB JS, ~8.89 KB CSS before gzip).
- `npm run typecheck -- --pretty false`: passed.
- `npm test -- tests/frontdoor-only-qualification.test.ts`: passed, 1 file / 10 tests.
- `npm test -- tests/frontdoor-import-side-effects.test.ts tests/developers-profile-routing.test.tsx`: passed, 2 files / 4 tests.
- Requalified focused route and preservation run: `npm test -- tests/frontdoor-only-qualification.test.ts tests/frontdoor-import-side-effects.test.ts tests/developers-profile-routing.test.tsx tests/pre-spend-builder-pages.test.tsx tests/render-spa-routing.test.ts tests/homepage-performance.test.tsx tests/economic-os-navigation.test.tsx tests/radar-network-navigation.test.tsx tests/radar-navigation-responsive.test.ts`; passed, 9 files / 64 tests.
- Final full `npm test`: **260 files passed, 11 skipped, 2 failed**; **1,907 tests passed, 32 skipped, 2 failed** (1,941 total). The skipped cases are PostgreSQL-backed durability/qualification tests gated on separately configured local test databases; those services were not started for this task.
- The two full-suite failures persist in unchanged files and are outside this feature: `tests/ingestion-run-persistence.test.ts` fails because its test pool has no `connect()` function; `tests/postgres-resilience.test.ts` observes the mocked client `release()` twice where its assertion expects once. Neither failure was modified or repaired as part of this scoped implementation.
- `git diff --check`: passed before report/evidence additions; will be rerun for final review state.

## Independent review

- Reviewer: separate Codex agent `/root/independent_review` (read-only review; no edits).
- Review scope: baseline SHA/ancestry; original full-stack route preservation; both profile selections; import-time/startup effects; provider/database/worker independence; browser network/offline boundary; OpenAPI/protected routes; content claims; unrelated regressions; validity of qualification evidence.
- Initial verdict: **ACCEPTED WITH CONDITIONS**.
- Independently verified: remote `main` and worktree base were the stated SHA; the exact front-door route remained narrow and fail-closed; the full-stack component/source was unchanged; browser evidence showed local responsive rendering with external requests blocked, no API/OpenAPI call, and no `radarApp` chunk request; the reviewer found no route regression or unintended source changes.
- Conditions raised:
  1. Execution-stage copy implied all Execution receipts contain settlement verification, although the schema makes the `verification` object optional.
  2. Existing full-stack Developers tests rendered `RadarApp` directly and did not exercise `main.tsx` in full-stack mode to prove route selection.
  3. Startup spies were installed after importing `app.ts`; add pre-import side-effect instrumentation or a documented independent import-side-effect audit.
- Second-review finding: `createRh4663UtcDayProviders` at `src/api/app.ts:1036` and the post-boundary Pair V5 verifier/discovery, Long Doppler verifier and stock supply indexer constructors were not initially included in provider-construction probes. These are distinct from DexScreener/Blockscout and are not covered by global `fetch`. This finding was recorded before remediation.
- Remediation: corrected the Execution receipt language to state verification is included only when a supported proof profile verified settlement; added full-stack/front-door `main.tsx` profile-selection tests; added probes active before application module import; added startup and pre-import probes for all provider-client constructions identified by the reviewer.
- Final second-review verdict: **ACCEPTED**. The separate reviewer independently rechecked the corrected claims, both real profile selections, import-time probes including the RH 4663/reflexive provider clients, final file scope and whitespace checks. No review conditions remain.
- Requalification after remediation: focused 9-file / 64-test run passed; build, TypeScript, full `npm test` and `git diff --check` were rerun. The focused gates pass; the two unrelated full-suite failures remain. The initial `ACCEPTED WITH CONDITIONS` verdict and its findings remain recorded above; all were remediated and the second review accepted the final implementation.

## Git state

- Final implementation SHA: `9d6108a61d494647dc18645d09897e2c119215e3`.
- Branch: `codex/radar-frontdoor-02-developers-static`, created from the verified remote `main` SHA above.
- Changed files: `src/api/app.ts`, `src/web/main.tsx`, `tests/frontdoor-only-qualification.test.ts`, `tests/developers-profile-routing.test.tsx`, `tests/frontdoor-import-side-effects.test.ts`, `src/web/developersStaticPage.tsx`, `src/web/developersStatic.css`, this report, review packet, and six screenshot artifacts.
- Worktree cleanliness: clean after implementation commit and this report closeout.
- Branch pushed: no.

## Production boundary

- No deployment performed.
- No production configuration changed.
- No PostgreSQL operation performed.
- No provider activated.
- No worker or background service started.
- No RH activation performed.
- No payment, wallet, settlement or execution operation performed.
