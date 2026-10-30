# Validation report

**Release state: HOLD.** Source baseline is `d3d0a445ec20e8c55170c2fc1f52aff220b2a851`; the isolated branch is `codex/radar-subpages-ui-unification`. Human approval, inherited security/migration/operational gates and deployment authorization are not supplied by automated checks.

## Environment and provenance

Node 24.21.0 matches the package engine. Dependencies match the unchanged package lock SHA256 `42cc2afd6cf52d6a3b30b0af1ec74f8d4126f0aa867135204c6e4f35e4044c00`. After interruption cleared temporary runtimes and the borrowed dependency checkout, the exact dependency tree was restored with `npm ci --offline --no-audit --no-fund`; no package or lockfile changed. All 704 frozen source hashes matched on resume. The final comfortable-density Copy-target adjustment changes only one stylesheet line; final snapshots identify the exact subsequent source.

PostgreSQL 16.15 qualification uses a newly initialized disposable localhost cluster and synthetic tenant/issuer fixtures. No production or pre-existing database was touched. Payments, financial execution, external distribution and live background jobs remain disabled in the qualification environment. Browser fixture snapshots are honest existing local API responses; no approval or evidence states are invented.

Raw command results, source manifests and snapshot metadata are in [validation/](validation/). [Final source integrity](validation/final-source-integrity.json) records the 704-file test/build snapshot against `source-hashes-final.json`, whose file SHA256 is `090372043ac151a3f037734787e0be9a0f2d7f7e1695503037862473072a9b61`. All runtime, configuration and test files still match. After capture, only the browser interaction driver gained a stronger computed-density assertion; the final eight-check browser run independently qualifies that exact driver and the unchanged application, with hashes in [final-browser-provenance.json](evidence/cyan-baseline/final-browser-provenance.json). The [final supplement](validation/FINAL-VALIDATION.md) and [cleanup/integrity record](validation/final-provenance-and-cleanup.json) retain this distinction. Earlier manifests and first-pass results remain history. The selected baseline passed **2,047 tests, zero failures or skips**, as recorded in [baseline/baseline-validation.md](baseline/baseline-validation.md). Earlier green-checkout tests are historical and excluded from this qualification.

## Commands and results

| Check | Result / evidence |
|---|---|
| `npm run lint` | PASS; [log](validation/lint.log) |
| `npm run typecheck` | PASS; [log](validation/typecheck.log) |
| `npm run build` | PASS, including final exact-source rebuild; existing large-chunk warning; [final command](validation/resumed-snapshot-build.json), [log](validation/resumed-snapshot-build.log) |
| `npm run check:design` | PASS, 130 router patterns unchanged; [log](validation/design.log) |
| `npm test -- --maxWorkers=2` with real test PostgreSQL URLs | **PASS on final source: 283 files / 2,051 tests / zero failures or skips**; 92.60s runner / 93.31s wall; [command](validation/full-tests-command.json), [summary](validation/full-test-summary.json), [raw log](validation/full-tests.log) |
| `node scripts/verify-radar-subpage-boundary.cjs` | PASS; 1,526 protected tracked files unchanged; all compared handlers, navigation, state and requests unchanged; all 295 legacy V2 style rules retain declarations and specificity on other routes |
| `browser-radar-ui-evidence.cjs after` | PASS, all three pages at 360/375/390/768/1024/1280/1440/1920px, zero document overflow or browser exceptions |
| `browser-radar-ui-interactions.cjs after` | PASS, 20 actual interaction checks and six reflow checks; full original href/control inventories retained |
| `browser-radar-ui-accessibility.cjs after` | PASS, 12 axe state/viewport audits, zero violation nodes; incomplete results remain reviewable |
| `browser-radar-ui-zoom.cjs after` | PASS, six actual native Chrome 200%/400% zoom cases in an isolated profile |
| `browser-radar-ui-homepage-control.cjs` | PASS, exact desktop/mobile full-page and viewport PNG equality plus measured geometry/type/color/text equality; separate RH narrative route also identical |
| Existing `qualify-ui-int2-routes.cjs` | PASS, four relevant routes / 28 viewport checks including 320/430px; [summary](validation/existing-routes/summary.json) |
| Existing `qualify-unified-radar-browser.mjs` | PASS, 33 route/view audits across 11 routes; zero HTTP, document overflow, axe or private-request failures; [summary](validation/existing-unified/summary.json) |
| Existing `qualify-ui-int2-journeys.cjs` | **As written: FAIL, pre-existing ambiguous Search selector.** Original failure retained in [real-journeys-original](validation/real-journeys-original/). A temporary selector-scoped copy passes all **10 real PostgreSQL/API journeys**, with unchanged assertions/timeouts; [adaptation](validation/journey-harness-adaptation.json), [passing results](validation/real-journeys/results.json). Repository harness remains unchanged. |
| Existing `compare-ui-int2-visuals.cjs` | **REVIEW_REQUIRED, exit 1:** the four intentionally changed Solana/RH desktop/mobile captures need human approval. Homepage and Spend Terminal have **exactly zero pixel difference** at both widths; receipts remain within the existing 0.5% threshold. No approved baseline is changed. [Results](validation/approved-visual-comparison/results.json) |
| Design document lint | PASS: zero errors, seven advisory orphan-token warnings because the document mirrors more runtime tokens than its two component examples reference; [raw output](validation/designmd-lint.json) |
| Premium project static audit, strict | **Pre-existing failure retained:** 57 findings before and after, zero new findings. These are project-wide native-control ownership/form policy gaps, not new runtime axe violations; [comparison](validation/premium-comparison.json) |
| `npm audit --omit=dev --json` | PASS, zero production advisories; [raw output](validation/npm-audit-production.json) |
| `npm audit --json` | **Existing low development advisory retained:** one indirect esbuild Windows development-server advisory, no moderate/high/critical findings; [raw output](validation/npm-audit-all.json). No dependency update is included in this UI task. |

The full-suite concurrency is bounded at two workers and the original test timeouts remain unchanged. Compiler tasks run separately. Existing React test-environment and Vite native-loader/bundle-size warnings are retained rather than treated as failures or hidden.

The original journey harness's exact `Search` button query matches both the semantic search submit and a legitimate provider-category control. Closing its browser while a response wait is pending initially masked that strict-mode error. The retained original run exposes the failure; the isolated temporary adapter scopes only that click to the existing `.semantic-search-form`. It does not modify application behavior, assertions or timeouts. Passing adapted journeys verify actual search HTTP 200, signed synthetic receipt inspection, cross-tenant HTTP 404, masked credentials, insufficient-evidence/no-execution behavior and mobile navigation. The as-written harness failure remains a HOLD item.

## Concrete preservation evidence

[Source-boundary results](validation/source-boundary.json) compare the complete existing event handlers, href/action/method/target attributes, state hooks and request calls in all four touched TSX sources. No existing navigation, handler or data-flow expression changes. Hashes cover the remaining protected sources, packages, production configuration and authority code. Added UI files contain no backend dependencies or financial execution.

Original browser inventories retain 215 Solana links and 250 controls, plus 86 Robinhood links and 28 controls. All original headings remain. Solana adds one evidence-panel heading; requested technical section metadata is intentional. Controls below the first viewport remain reachable and are captured in full pages and bounded mobile tiles.

The new tests cover null versus zero values, fixture fallback being visibly fixture-backed, original spend/explore destinations, six directory families, RH home/narrative isolation, and named keyboard-reachable Analyst tables with all ranked evidence. Existing tests retain comprehensive contract validation, error/mismatch/pending states, optional module failure states, receipt sharing, filters, preflight and route behavior.

## Accessibility, visual review and limits

The pre-existing mobile Analyst scroll-region keyboard failure is resolved. Proven provider-context clipping now wraps inside its existing Solana dossier. Comfortable-density Copy controls use a 44px minimum while Dense mode retains its existing compact behavior. The remaining target-size inventory is advisory: do not infer that every legacy secondary control is 44px. Intentional provider-list ellipsis retains its accessible name and full dossier context.

Main homepage and separate RH narrative route are pixel-stable under controlled comparisons. Initial GPU raster noise is retained and explained in [VISUAL-REVIEW.md](VISUAL-REVIEW.md), not approved as a homepage change. All historical human-approved references remain immutable. New subpage screenshots are review candidates.

The final browser procedure and all eight passing checks are documented in [BROWSER-VALIDATION.md](evidence/BROWSER-VALIDATION.md). Expanded Analyst diagnostics reproduce five identical pre-existing duplicate-key warnings on both sources, with zero new warning signatures or page exceptions. Brief contract inspection has zero warnings on either source; this does not establish a clean console across every existing state.

Actual automated Chromium/axe/native zoom checks do not replace human visual approval, manual screen readers, physical-device/virtual-keyboard testing, or production field-performance qualification. The existing broad unified browser audit includes 377 axe incomplete nodes for human assessment. Inherited static/security/release holds remain explicit.

The as-written approved-reference gate is intentionally not green: the requested subpage redesign changes their dimensions and layout, so those four candidates remain `REVIEW_REQUIRED`. Exact unchanged homepage and Spend Terminal results provide separate evidence that the shared architecture did not drift. Human approval is still required before merge under `AGENTS.md`; no automated baseline replacement is included.

## Review status

Implementation is prepared for review on the isolated UI branch. Any remaining failed or review-required gate is retained with its actual command/result and cannot be interpreted as release approval. Nothing is deployed, merged, pushed or automatically approved.

[Review-package integrity](validation/review-package-integrity.json) independently verifies the final browser source, all eight driver files and 106 recorded artifacts with zero mismatches, and records the single known QA-driver difference from the full-suite snapshot. Temporary browser previews are stopped; [cleanup evidence](evidence/browser-preview-cleanup.json) confirms their three owned ports have no remaining listeners. The disposable PostgreSQL/API cleanup is recorded separately in the validation supplement.
