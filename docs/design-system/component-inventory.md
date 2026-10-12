# Component inventory and future-page guide

| Role | Existing implementation | Migration |
| --- | --- | --- |
| Application shell | Independent page `.shell` wrappers | `RadarAppShell` owns global chrome above dispatch; existing wrappers now own workflow content only |
| Primary/economy navigation | `RadarProductNavigation`, `RadarHeaderIdentity`, `RadarNetworkSelector`, `PopupMenu`, `radarNavigationCatalog` | Reused; context suppresses repeated global nav and preserves local command/density controls. Native keyboard menus retained |
| Page/section identity | `.eyebrow`, `.section-kicker`, page h1 | `radarPageIdentity` plus `RadarSectionHeader`; stable family indices, specific page titles preserved |
| Panel/button/input/search | `.panel`, `.execute`, native labeled controls and existing search | Consolidated framing, focused/pressed/disabled states and mobile sizing through canonical tokens; no redundant wrapper components |
| Tabs | Existing tab/filter buttons and local navigation | Existing behavior preserved; focus/target sizing standardized. A replacement tab abstraction was not added |
| Tables | Existing role tables, record grids, `DetailTable`, observatory/reflexive wrappers | Columns retained; scroll regions and code samples now keyboard focusable; native `RadarDataTable` available for new tables |
| Status | Existing domain badges and `EvidenceBadge` | `RadarStatus` enforces separate presentation categories. Fresh/available/published no longer imply verified in //4663. Existing backend/domain vocabulary remains visible |
| Judgment | Existing pre-spend result, monitor decision, proof cards | Canonical verdict shown separately from outcomes; missing canonical verdict no longer defaults to DEGRADE; new requests clear previous result |
| Receipt/evidence | Existing `EvidenceReceiptView`, `ReceiptDetailPage`, `ProofReceiptCard`, linked IDs | Reused; `RadarEvidenceRow` provides provenance disclosure; receipt inspection distinguishes recorded attempt from evaluation |
| Lifecycle | Inconsistent/implicit relationships | `RadarReceiptLifecycle`: explicit records in spend/receipt detail; labeled architecture reference in homepage, Solana, LoopLab, proof and shared protocol disclosure |
| Async states | LoadingShell, empty-state, route-state, silent collection catches | `RadarAsyncState`; builder indexes distinguish loading/empty/failure with retry, details show errors/permission denial instead of indefinite loading |
| Specialist interfaces | RH suite, //4663, Reflexive, PLTR and Hermes components | Retained capabilities and workflow navigation; specialist token names alias canonical tokens; contrast/scroll/graph semantics fixed |

Deprecated: global root theme definitions in styles.css and rh4663.css; repeated global navigation in route content; fictional completion inferred from prior lifecycle stages; verification inferred from availability. Existing domain components are not removed merely for naming consistency.

## Build the next page

1. Read constitution.md and AGENTS.md. Register the real route using existing dispatch conventions; preserve machine endpoints and access controls.
2. Add a family match to `radarPageIdentity.ts` when needed and a discoverable destination in `radarNavigationCatalog.ts`. The entry attaches the shell automatically. Do not create another global header/footer/theme.
3. Render one task h1, shared indexed section headings, `.panel` and `.execute`, labeled native forms and the existing mono/UI roles. Use rem spacing. Preserve specialized density.
4. Use `RadarStatus` with explicit backend facts. For each lifecycle stage supply `{ state, detail, recordId?, href? }`. Record links must be authorized by the existing API. Absent stages remain missing. Reference diagrams must set `reference`.
5. Keep material blockers visible. Disclose supporting detail using `RadarEvidenceRow`. Preserve every table field; use a labeled focusable scroll region or `RadarDataTable` for new native tables.
6. Handle loading, empty, failed, unavailable and permission states. Loading is never an empty successful response. Display demonstration data explicitly.
7. Run `npm run inventory:design`, extend route samples/journey checks, then `npm run check:design`, typecheck, lint, tests, build and browser checks. All required mobile widths must pass before qualification.

## Reproduce browser qualification

Start the local development server and Vite on 5178 (or set RADAR_UI_BASE_URL); fixtures stay labeled. Install isolated **test-only** tools in a disposable directory and point RADAR_UI_TEST_RUNTIME at it:

```sh
npm install --prefix /tmp/radar-ui-qualification playwright@1.64.0 @axe-core/playwright@4.13.0 randexp@0.5.3
/tmp/radar-ui-qualification/node_modules/.bin/playwright install chromium
RADAR_UI_BROWSERS=chromium npm run test:ui
npm run test:ui:journeys
```

The scripts record per-route results, viewport overflow, navigation checks, axe violations, errors and screenshots. Override RADAR_UI_ROUTES and RADAR_UI_RUN_LABEL for a targeted follow-up after a scoped fix. WebKit is additionally attempted when RADAR_UI_BROWSERS includes webkit; it did not open a page on the current frozen macOS runtime. Browser emulation does not certify real Safari/iOS, Android Chrome, VoiceOver/TalkBack or virtual keyboard behavior.
