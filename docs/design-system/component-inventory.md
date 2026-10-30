# Canonical components / V2 update

Current owners: RadarAppShell; ProductHeader / ProductWayfinding / ProductFooter; RadarSectionHeader; RadarStatus; RadarReceiptLifecycle; RadarEvidenceRow; RadarAsyncState; RadarDataTable. TerminalIcon and the approved Signal Lens asset are reused. radarTokens.css owns all global and legacy Robinhood palette aliases. main.tsx lazy-loads the current secure SpendTerminalPage independently of the research dispatcher. CanonicalReceiptPage is a separate read-only, tenant-authenticated inspector using the current receipt-spine contract.

The inventory below describes the inherited baseline; the active V2 constitution and ui-int2/final-report.md supersede its older identity assumptions and qualification claims.

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
| Async states | LoadingShell, empty-state, route-state, silent collection catches | `RadarAsyncState` is available; current secure Spend Terminal and canonical receipt inspector announce loading/errors and allow retry. Existing research collection behaviors are retained from the qualified target; shared framing alone does not qualify their unavailable-data behavior |
| Specialist interfaces | RH suite, //4663, Reflexive, PLTR and Hermes components | Retained capabilities and workflow navigation; specialist token names alias canonical tokens; contrast/scroll/graph semantics fixed |

Deprecated: global root theme definitions in styles.css and rh4663.css; repeated global navigation in route content; fictional completion inferred from prior lifecycle stages; verification inferred from availability. Existing domain components are not removed merely for naming consistency.

## Build the next page

1. Read constitution.md and AGENTS.md. Register the real route using existing dispatch conventions; preserve machine endpoints and access controls.
2. Add a family match to `radarPageIdentity.ts` when needed and a discoverable destination in `radarNavigationCatalog.ts`. The entry attaches the shell automatically. Do not create another global header/footer/theme.
3. Render one task h1, shared indexed section headings, `.panel` and `.execute`, labeled native forms and the existing mono/UI roles. Use rem spacing. Preserve specialized density.
4. Use `RadarStatus` with explicit backend facts. For each lifecycle stage supply `{ state, detail, recordId?, href? }`. Record links must be authorized by the existing API. Absent stages remain missing. Reference diagrams must set `reference`.
5. Keep material blockers visible. Disclose supporting detail using `RadarEvidenceRow`. Preserve every table field; use a labeled focusable scroll region or `RadarDataTable` for new native tables.
6. Handle loading, empty, failed, unavailable and permission states. Loading is never an empty successful response. Display demonstration data explicitly.
7. Run `node scripts/radar-design-inventory.mjs`, extend route samples/journey checks, then `npm run check:design`, typecheck, lint, tests, build and browser checks. All required mobile widths must pass before qualification.

## Reproduce UI-INT2 qualification

Use Node 24.21, the lockfile dependencies (Playwright 1.64 and axe-core 4.14), disposable PostgreSQL 16, and the documented synthetic-only server in ui-int2/final-report.md. `npm run test:ui` covers the AST-discovered routes at seven widths; `npm run test:ui:journeys` exercises actual local API states. `npm run test:ui:visuals` compares with explicit approved references and never updates them. randexp and pngjs are test-only external packages in RADAR_UI_TEST_RUNTIME (default /tmp/radar-ui-int2-qa); Lighthouse is also external. No QA package is added to production dependencies.

WebKit startup failed in this environment. Chromium emulation and CSS text/reflow checks do not certify iOS Safari, Android Chrome, VoiceOver, TalkBack, a physical virtual keyboard or native browser zoom. Those gates remain HOLD.
