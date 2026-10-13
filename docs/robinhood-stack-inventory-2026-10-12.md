# Infopunks Radar: Robinhood stack inventory

Audited on 12 October 2026. This is an inventory of the current local build, not a certification that every feature is active in production. Read-only checks of `/readyz`, `/v1/4663/frontdoor`, `/v1/4663/pulse`, `/v1/4663/rotation`, `/v1/rh-chain/market`, and `/v1/4663/reflexive` returned HTTP 503 during this audit. No production settings or application source were changed.

## 1. Public entry and participation: //4663

| Capability | Purpose | Build entry |
| --- | --- | --- |
| Frontdoor | Current evidence, NOW, WATCH, OPEN LOOPS, source health and global Pulse context | `/4663` |
| RH Pulse / CALL | Signed category prediction, confidence, optional evidence digest, dated window and call receipt | `/4663/pulse` |
| Consensus | Counts and category distribution of accepted calls | `/4663/consensus/:windowId` |
| Resolution | Published deterministic outcome, canonical receipts and inclusion proofs | `/4663/resolution/:windowId` |
| Call receipt | Persisted signed call and sharing | `/4663/call/:receiptId` |
| Proof profiles | Resolved calls, accuracy, high-confidence accuracy, category evidence and streak | `/4663/proof/:id` |
| Today | Daily edition, prior outcome and signal context; API archive | `/4663/today` |
| Signals | Public signal feed and detail; submission, evidence and lifecycle tracking | `/4663/signals` |
| Receipts | Protocol CALL receipts and detail reads | `/4663/receipts` |
| PRINT | Source-bound market print, candidate generation, regime/layer read, completeness and frozen publication | `/4663/print/:printId` |
| MY 4663 | Local-first follows and private authenticated call/proof/changes overlays | Frontdoor and `/v1/4663/me/*` |
| Return habit | Changes since prior visit, followed changes, open-loop checkpoints and resolved-call return | Frontdoor |
| Evidence campaigns | Source-bound campaign entry, evidence, call, resolution and campaign history | `/4663/campaign/:campaignId` |
| Share objects / OG cards | Versioned evidence links, CALL/consensus/resolution sharing and rendered image cards | Share APIs and OG routes |
| Lenses / rotation read | API projections of intelligence categories and rotation context | `/v1/4663/lenses/:lens`, `/v1/4663/rotation` |

Normal frontdoor order in `src/web/frontdoor4663.tsx`: NOW → WATCH → OPEN LOOPS → CALL → PROOF, with return context and optional campaign entry above it. Global public state and personal state are deliberately separate.

## 2. Signal Desk: research, discovery and reviewed memory

| Capability | Purpose | Build entry |
| --- | --- | --- |
| Signal Desk | Brief/analyst overview, Today, receipt, movers, risk, meme and chain context | `/rh-chain-signal-desk` |
| Market Pulse | Tracked-token volume, liquidity, activity, market composition, concentration and interpretation | `/rh-chain-signal-desk/market` |
| Chain Pulse / Live Snapshot | Chain metrics, provider status and freshness | `/rh-chain-signal-desk/live-snapshot` and desk |
| Meme Pulse | Attention assets, meme context and evidence limitations | `/rh-chain-signal-desk/meme-pulse` |
| 4663 Signal Index / movers | Ranked attention assets and narrative/risk context | `/rh-chain-signal-desk/4663-index` |
| Today on 4663 | Compact top signal, biggest risk, latest receipt and attention move | Desk; `/v1/rh-chain/today-on-4663` |
| Market Structure | Reviewed layer classifications and observed market context | `/rh-chain-signal-desk/market-structure` |
| Cross-Layer | Exact-contract reviewed cross-layer classifications | `/rh-chain-signal-desk/market-structure/cross-layer` |
| Attention Quality | Persisted observation-history assessment, paid attention context and assessment receipts | `/rh-chain-signal-desk/market-structure/attention-quality` |
| Discovery Queue | Candidate discovery, watch, ignore and promotion actions | `/rh-chain-signal-desk/discovery-queue` |
| Token dossiers | Contract identity, market/explorer observations, reviewed memory and source requirements | `/rh-chain-signal-desk/tokens/:contract` |
| Onchain registry | Observed tokens, contract/deployer enrichment, holders, transfers and watchlist differences | `/v1/rh-chain/onchain/*` |
| Clone Radar / Risk Patterns | Clone/impersonation cues and recurring risk evidence | `/rh-chain-signal-desk/clone-radar`, `/rh-chain-signal-desk/risk-patterns` |
| Launchpad Observatory | Launch surface state, origin evidence, claims and risk context | `/rh-chain-signal-desk/launchpad-observatory` |
| Launch / Access Surface Watch | Launchpads, wallet/bridge/router/app context | `/rh-chain-signal-desk/launch-surfaces` |
| Scout | Contextual query interface: market, risk, narrative, token and launch modes | `/rh-chain-signal-desk/scout` |
| Scout Network | Contributor/scout intelligence context | `/rh-chain-signal-desk/scouts` |
| Submit / Signal Vault | Intake, evidence, persisted submissions and review states | `/rh-chain-signal-desk/submit` |
| Review Queue | Public review status and evidence requirements | `/rh-chain-signal-desk/review-queue` |
| Review Pipeline | Daily review, classification, watch, promotion, outcome check and daily draft actions | `/rh-chain-signal-desk/review-pipeline` |
| 100 Receipts | Reviewed campaign assets, dossier references and outcome-check context | `/rh-chain-signal-desk/100-receipts` |
| Daily Receipts | Published editorial market memory, detail, portable card and share copy | `/rh-chain-signal-desk/daily-receipts` |
| Project directory / claims | Project identities, claims, evidence, observations and reviewed receipts | `/rh-chain-signal-desk/projects`, `/projects/:id`, `/projects/claim` under the same desk prefix |
| Project Intelligence Receipts | Reviewed publication, integrity hashes, replacement and supersession links | `/rh-chain-signal-desk/intelligence-receipts/:receiptId` |
| Receipt Relay / Distribution Pack | Source-linked distribution content from published daily memory | Relay API and `/rh-chain-signal-desk/distribution-pack` |

Scout is currently a deterministic context interface over desk memory; its presence does not establish a general autonomous research agent. Launch and risk context includes manually curated material.

## 3. Reflexive Radar: stock-token and mission-market research

| Capability | Purpose | Build entry |
| --- | --- | --- |
| Reflexive Radar | Stock-token/mission-pair intelligence, evidence, supply/inventory and lifecycle context | `/4663/reflexive` |
| Pair dossiers | Canonical stock identity, launch provenance, pool/hook verification, inventory and checkpoints | `/4663/reflexive/pair/:id` |
| Stock dossiers | Stock-specific pair and supply context | `/4663/reflexive/stock/:symbol` |
| Reflexive Watch | Cross-venue cases, external claims, evidence comparisons and audit status | `/4663/reflexive/watch`, `/4663/reflexive/watch/:id` |
| Category Census | Broader mission-market category and pair coverage | `/4663/reflexive/census` |
| AI/NVDA audit | Dedicated LONG/Doppler capital-versus-flow audit and checkpoint context | Reflexive Watch and audit API |
| PLTR preflight | Canonical identity, supply, inventory coverage, market context, reference/session and basis evidence | PLTR stock dossier and preflight API |
| IPX/PLTR simulation lab | Hypothetical preflight scenarios, shadow candidates, replay, series and capacity sweeps | `/4663/reflexive/preflight/ipx-pltr` |
| Events / thesis | Persisted research events and explanatory thesis | Reflexive APIs |

Simulation/shadow results do not establish executed trades or production economic readiness. First-party IPX context must remain identifiable as such.

## 4. Operator and reviewer tools

- Authenticated Review Console for Signal Vault submissions.
- Reviewed classification create/approve/reject/supersede and audit.
- Project-contract relationship verification/dispute/rejection/supersession.
- Source evidence attachment, status and supersession.
- Claim review, project observations and verdict approval/publication.
- Project Intelligence Receipt draft/approve/reject/publish/supersede.
- Attention Quality assessment and receipt publication/rejection.
- Daily Receipt drafting, including review-cycle, Market Structure and agentic Market Structure drafts; publication/rejection.
- Automation jobs, durable job locks, run history and risk-correlation drafts.
- PRINT candidate freeze and completed UTC-day observation refresh.
- Pulse window resolution, publication, methodology commitments and optional chain anchoring.
- Phase 3 observation ingestion, candidate review, corrections, distribution queue, backtest, metrics and activation read.
- Reflexive refresh, category census refresh, PLTR preflight refresh, claim/audit-target intake and shadow observation.
- Campaign create/schedule/activate/complete/cancel, readiness and protected rehearsal.
- Frontdoor metrics and Product Intelligence: resolution return, second call, open-loop returns, evidence-open attribution and notification advisory gate.

## 5. Data, automation and shared foundations

- DEX Screener: exact-contract pair data, price/volume/liquidity, boosts, paid orders and retained token history.
- Blockscout: token registry, contract/deployer evidence, holders, transfers and completed-day activity where available.
- DefiLlama: chain metric context and completed UTC-day DEX observations where available.
- CoinGecko: global meme category context; it must not be presented as RH-chain-only activity.
- Robinhood/RPC and venue sources: canonical stock-token identity, chain/pool/launch evidence and stock/mission-market research.
- Persistent Postgres stores, response caches, provider timeouts, stale/fallback states, freshness and provenance.
- Eight named automation jobs: Chain Pulse, Meme Pulse, launchpad refresh, token dossier enrichment, clone/risk correlation, daily receipt draft, freshness sweep, and 4663 intelligence refresh. Not every named job is scheduled by the ordinary timer block.
- Shared Radar pre-spend/preflight APIs and canonical receipt infrastructure exist beyond RH-specific namespaces. Their presence is not proof that every RH discovery is already wired into every agent decision.
- Distinct receipt families: editorial Daily Receipts, project Intelligence Receipts, Attention Quality receipts, PRINT evidence, signed CALL/RESOLUTION receipts, and shared Observation/Judgment/Execution/Evaluation receipts. These have different authority and should not be collapsed into one score.

## 6. Current activation and automation limits

The checked-in environment defaults leave live snapshots, DEX Screener, Blockscout, RH automation/history, reviewed-classification extensions, project-claim/receipt extensions, Phase 3 and campaign mode off unless configured. Phase 2 defaults off in production and requires durable storage, reviewer infrastructure and signing configuration. Runtime settings may differ; production was unavailable to this audit.

- 4663 movers still assemble a static index.
- Today on 4663 still uses manual/reviewed desk memory, including campaign context; the automation snapshot read is not used as the attention-card payload in the current endpoint.
- Daily Receipt automation generates unpublished drafts; public publishing is reviewer-driven.
- Chain/Meme client refresh exists; Today, index and receipt feeds are loaded initially rather than on that same interval.
- Chain metrics depend on provider coverage; the public snapshot adapter leaves DEX volume null rather than synthesizing it.
- Several launch, risk, campaign and Scout records remain curated or source-required.
- Availability of a route does not mean its provider, signing, publishing or anchoring dependencies are enabled.

## 7. Call the Rotation: positioning and resolution semantics

Keep CALL as a participation and return loop. Use `/4663` as the single RH entry, with current evidence first, access to research, and CALL after the evidence. Campaigns may emphasize a source-bound call while keeping normal research reachable.

Current CALL options are MEMES, STOCK_TOKENS, RWA_DEFI, STABLES and NO_QUALIFIED_ROTATION. A call records confidence and can include an evidence digest. The outcome is based on persisted, public, confirmed normalized events inside the window, filtered by source status and scored by category significance totals. The current thresholds require at least one qualified observation and significance total of 60. Fresh sources are primary; stale sources may be used only when primary evidence is empty. Ties use the published fixed option order; no qualifying category produces NO_QUALIFIED_ROTATION. The consensus does not determine the outcome.

This is not currently a winner selected by investment return or a comprehensive capital-flow measurement. Explain the methodology at the call point. Do not silently redefine it; changing the measured outcome needs a versioned methodology and corresponding evidence coverage.

Product hierarchy: fresh evidence → deeper research / preflight → optional signed CALL → receipt → published resolution → personal proof / return. CALL complements the pre-spend intelligence thesis; it does not by itself perform execution authorization or replace market evidence.

## Source files

- `src/web/radarApp.tsx`: UI route registration.
- `src/web/radarNavigationCatalog.ts`: Signal Desk navigation.
- `src/api/app.ts`: route registration and service wiring.
- `src/web/frontdoor4663.tsx`: normal frontdoor and CALL/private overlay.
- `src/services/rh4663Service.ts`: protocol and intelligence vocabulary.
- `src/services/rh4663ResolutionService.ts`: CALL resolution and proof methodology.
- `src/services/rhChainTodayOn4663Service.ts`: desk Today composition.
- `src/services/rhChainDailyReceiptDraftService.ts`: draft and published editorial feed.
- `src/services/rhChainAutomationService.ts`: automation jobs and durability.
- `src/config/env.ts`: defaults and activation dependencies.
- `docs/rh4663-frontdoor-contract.md`: global/personal state separation.
- `docs/rh4663-launch-checklist.md`: operational readiness and observation gates.

## API declarations

The following section is generated from literal RH route registrations in the local build. It is an implementation inventory; reviewer authentication, feature flags and runtime availability still apply.

214 literal method/path registrations across the four RH namespaces. OG image and shared Radar routes are additional.

### /v1/rh-chain — 67 registrations

| Method | Path |
| --- | --- |
| GET | `/v1/rh-chain/classifications` |
| GET | `/v1/rh-chain/projects` |
| GET | `/v1/rh-chain/projects/:project_id` |
| GET | `/v1/rh-chain/projects/:project_id/claims` |
| GET | `/v1/rh-chain/projects/:project_id/observations` |
| GET | `/v1/rh-chain/projects/:project_id/receipts` |
| GET | `/v1/rh-chain/intelligence-receipts` |
| GET | `/v1/rh-chain/intelligence-receipts/:receipt_id` |
| POST | `/v1/rh-chain/projects/claims` |
| GET | `/v1/rh-chain` |
| GET | `/v1/rh-chain/memes` |
| GET | `/v1/rh-chain/signals` |
| GET | `/v1/rh-chain/4663-index` |
| GET | `/v1/rh-chain/campaigns/100-receipts` |
| GET | `/v1/rh-chain/today-on-4663` |
| GET | `/v1/rh-chain/daily-receipts` |
| GET | `/v1/rh-chain/daily-receipts/:receipt_id` |
| GET | `/v1/rh-chain/meme-pulse` |
| GET | `/v1/rh-chain/launch-surfaces` |
| GET | `/v1/rh-chain/launchpad-observatory` |
| POST | `/v1/rh-chain/scout/query` |
| GET | `/v1/rh-chain/live-snapshot` |
| GET | `/v1/rh-chain/live-snapshot/token/:contract` |
| GET | `/v1/rh-chain/market/provider-status` |
| GET | `/v1/rh-chain/onchain/provider-status` |
| GET | `/v1/rh-chain/onchain/tokens` |
| GET | `/v1/rh-chain/onchain/tokens/:contract` |
| GET | `/v1/rh-chain/onchain/tokens/:contract/transfers` |
| GET | `/v1/rh-chain/onchain/tokens/:contract/holders` |
| GET | `/v1/rh-chain/onchain/watchlist-diff` |
| GET | `/v1/rh-chain/market/tokens` |
| GET | `/v1/rh-chain/market/tokens/:contract` |
| GET | `/v1/rh-chain/market/boosts` |
| GET | `/v1/rh-chain/market/attention` |
| POST | `/v1/rh-chain/market/snapshots/capture` |
| GET | `/v1/rh-chain/market/snapshots/:contract` |
| GET | `/v1/rh-chain/market/attention-quality/:contract` |
| GET | `/v1/rh-chain/market` |
| GET | `/v1/rh-chain/market-structure` |
| GET | `/v1/rh-chain/market-structure/cross-layer` |
| GET | `/v1/rh-chain/market-structure/attention-quality` |
| GET | `/v1/rh-chain/attention-quality/receipts/:receipt_id` |
| GET | `/v1/rh-chain/discovery-queue` |
| POST | `/v1/rh-chain/discovery-queue/refresh` |
| POST | `/v1/rh-chain/discovery-queue/:contract/promote` |
| POST | `/v1/rh-chain/discovery-queue/:contract/ignore` |
| POST | `/v1/rh-chain/discovery-queue/:contract/watch` |
| GET | `/v1/rh-chain/review-pipeline` |
| POST | `/v1/rh-chain/review-pipeline/start-daily-review` |
| POST | `/v1/rh-chain/review-pipeline/:contract/classify` |
| POST | `/v1/rh-chain/review-pipeline/:contract/promote-to-market-structure` |
| POST | `/v1/rh-chain/review-pipeline/:contract/promote-to-100-receipts` |
| POST | `/v1/rh-chain/review-pipeline/:contract/add-to-daily-draft` |
| POST | `/v1/rh-chain/review-pipeline/:contract/set-outcome-check` |
| POST | `/v1/rh-chain/review-pipeline/:contract/watch` |
| POST | `/v1/rh-chain/review-pipeline/:contract/source-required` |
| POST | `/v1/rh-chain/review-pipeline/:contract/ignore-duplicate` |
| GET | `/v1/rh-chain/review-pipeline/daily-summary` |
| GET | `/v1/rh-chain/tokens/:contract/dossier` |
| GET | `/v1/rh-chain/review-queue` |
| GET | `/v1/rh-chain/clone-radar` |
| GET | `/v1/rh-chain/scouts` |
| GET | `/v1/rh-chain/distribution-pack` |
| GET | `/v1/rh-chain/receipt-relay` |
| GET | `/v1/rh-chain/signals/submissions` |
| POST | `/v1/rh-chain/signals/submit` |
| GET | `/v1/rh-chain/receipts` |

### /v1/4663 — 61 registrations

| Method | Path |
| --- | --- |
| GET | `/v1/4663/frontdoor` |
| GET | `/v1/4663/share/:shareObjectId` |
| GET | `/v1/4663/me/call` |
| GET | `/v1/4663/me/proof` |
| GET | `/v1/4663/me/changes` |
| GET | `/v1/4663/me` |
| GET | `/v1/4663` |
| GET | `/v1/4663/prints` |
| GET | `/v1/4663/prints/latest` |
| GET | `/v1/4663/prints/:printId` |
| GET | `/v1/4663/prints/:printId/share` |
| GET | `/v1/4663/print-candidate` |
| GET | `/v1/4663/observations` |
| POST | `/v1/4663/campaign/events` |
| GET | `/v1/4663/pulse` |
| POST | `/v1/4663/pulse/payload` |
| POST | `/v1/4663/pulse/calls` |
| GET | `/v1/4663/pulse/windows/:windowId` |
| GET | `/v1/4663/pulse/windows/:windowId/resolution` |
| GET | `/v1/4663/pulse/receipts/:receiptId/proof` |
| GET | `/v1/4663/pulse/receipts/:receiptId/share` |
| GET | `/v1/4663/pulse/windows/:windowId/share` |
| GET | `/v1/4663/pulse/reputation/:wallet` |
| GET | `/v1/4663/proof/:wallet` |
| GET | `/v1/4663/campaigns/:campaignId` |
| GET | `/v1/4663/today` |
| GET | `/v1/4663/today/archive` |
| GET | `/v1/4663/today/:date` |
| GET | `/v1/4663/signals` |
| POST | `/v1/4663/signals` |
| POST | `/v1/4663/signals/:signalId/evidence` |
| GET | `/v1/4663/signals/:signalId` |
| GET | `/v1/4663/signals/:signalId/evidence` |
| GET | `/v1/4663/lenses/:lens` |
| GET | `/v1/4663/rotation` |
| GET | `/v1/4663/reflexive` |
| GET | `/v1/4663/reflexive/watch` |
| GET | `/v1/4663/reflexive/census` |
| GET | `/v1/4663/reflexive/census/pairs` |
| GET | `/v1/4663/reflexive/census/stocks/:symbol` |
| GET | `/v1/4663/reflexive/watch/cases` |
| GET | `/v1/4663/reflexive/watch/cases/:id` |
| GET | `/v1/4663/reflexive/watch/claims` |
| GET | `/v1/4663/reflexive/pairs` |
| GET | `/v1/4663/reflexive/pairs/:id` |
| GET | `/v1/4663/reflexive/stocks/:symbol` |
| GET | `/v1/4663/reflexive/stocks/PLTR/preflight` |
| POST | `/v1/4663/reflexive/preflight/ipx-pltr/simulate` |
| GET | `/v1/4663/reflexive/preflight/ipx-pltr/simulations/:id` |
| GET | `/v1/4663/reflexive/preflight/ipx-pltr/shadow/candidates` |
| GET | `/v1/4663/reflexive/preflight/ipx-pltr/shadow/status` |
| POST | `/v1/4663/reflexive/preflight/ipx-pltr/shadow/replay` |
| GET | `/v1/4663/reflexive/preflight/ipx-pltr/shadow/series/:configuration_hash` |
| POST | `/v1/4663/reflexive/preflight/ipx-pltr/capacity-sweeps` |
| GET | `/v1/4663/reflexive/preflight/ipx-pltr/capacity-sweeps/:id` |
| GET | `/v1/4663/reflexive/events` |
| GET | `/v1/4663/reflexive/thesis` |
| GET | `/v1/4663/reflexive/audits/long-ai-nvda` |
| GET | `/v1/4663/events` |
| GET | `/v1/4663/receipts` |
| GET | `/v1/4663/receipts/:receiptId` |

### /internal/rh-chain — 55 registrations

| Method | Path |
| --- | --- |
| GET | `/internal/rh-chain/classifications` |
| GET | `/internal/rh-chain/classifications/:contract` |
| POST | `/internal/rh-chain/classifications` |
| POST | `/internal/rh-chain/classifications/:contract/approve` |
| POST | `/internal/rh-chain/classifications/:contract/reject` |
| POST | `/internal/rh-chain/classifications/:contract/supersede` |
| GET | `/internal/rh-chain/classifications/:contract/audit` |
| GET | `/internal/rh-chain/market-structure/cross-layer/conflicts` |
| GET | `/internal/rh-chain/operational-readiness` |
| GET | `/internal/rh-chain/projects` |
| GET | `/internal/rh-chain/projects/:project_id` |
| GET | `/internal/rh-chain/projects/:project_id/contracts` |
| POST | `/internal/rh-chain/projects/:project_id/contracts` |
| POST | `/internal/rh-chain/projects/:project_id/contracts/:relationship_id/verify` |
| POST | `/internal/rh-chain/projects/:project_id/contracts/:relationship_id/dispute` |
| POST | `/internal/rh-chain/projects/:project_id/contracts/:relationship_id/reject` |
| POST | `/internal/rh-chain/projects/:project_id/contracts/:relationship_id/supersede` |
| GET | `/internal/rh-chain/projects/:project_id/contracts/:relationship_id/audit` |
| POST | `/internal/rh-chain/projects/:project_id/evidence` |
| POST | `/internal/rh-chain/projects/:project_id/contracts/:relationship_id/evidence` |
| POST | `/internal/rh-chain/projects/:project_id/claims/:claim_id/evidence` |
| POST | `/internal/rh-chain/projects/:project_id/observations/:observation_id/evidence` |
| POST | `/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/evidence` |
| POST | `/internal/rh-chain/projects/:project_id/intelligence-receipts/:receipt_id/evidence` |
| POST | `/internal/rh-chain/projects/:project_id/evidence/:evidence_id/status` |
| POST | `/internal/rh-chain/projects/:project_id/evidence/:evidence_id/supersede` |
| POST | `/internal/rh-chain/projects/:project_id/claims/:claim_id/review` |
| POST | `/internal/rh-chain/projects/:project_id/observations` |
| POST | `/internal/rh-chain/projects/:project_id/verdicts` |
| POST | `/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/approve` |
| POST | `/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/reject` |
| POST | `/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/publish` |
| POST | `/internal/rh-chain/projects/:project_id/verdicts/:verdict_id/receipt-drafts` |
| POST | `/internal/rh-chain/projects/:project_id/intelligence-receipts/:receipt_id/approve` |
| POST | `/internal/rh-chain/projects/:project_id/intelligence-receipts/:receipt_id/reject` |
| POST | `/internal/rh-chain/projects/:project_id/intelligence-receipts/:receipt_id/publish` |
| POST | `/internal/rh-chain/intelligence-receipts/:receipt_id/supersede` |
| GET | `/internal/rh-chain/attention-quality/assessments` |
| GET | `/internal/rh-chain/attention-quality/assessments/:contract` |
| POST | `/internal/rh-chain/attention-quality/assessments/:contract/receipts` |
| POST | `/internal/rh-chain/attention-quality/receipts/:receipt_id/publish` |
| POST | `/internal/rh-chain/attention-quality/receipts/:receipt_id/reject` |
| GET | `/internal/rh-chain/review-console/submissions` |
| GET | `/internal/rh-chain/review-console/submissions/:submissionId` |
| PATCH | `/internal/rh-chain/review-console/submissions/:submissionId` |
| GET | `/internal/rh-chain/jobs` |
| POST | `/internal/rh-chain/jobs/:job_name/run` |
| GET | `/internal/rh-chain/daily-receipt-drafts` |
| POST | `/internal/rh-chain/review-cycle-receipt-drafts` |
| POST | `/internal/rh-chain/market-structure-receipt-drafts` |
| POST | `/internal/rh-chain/agentic-market-structure-receipt-drafts` |
| GET | `/internal/rh-chain/risk-correlations` |
| GET | `/internal/rh-chain/daily-receipt-drafts/:draft_id` |
| POST | `/internal/rh-chain/daily-receipt-drafts/:draft_id/publish` |
| POST | `/internal/rh-chain/daily-receipt-drafts/:draft_id/reject` |

### /internal/4663 — 31 registrations

| Method | Path |
| --- | --- |
| POST | `/internal/4663/prints/:candidateId/freeze` |
| GET | `/internal/4663/product-intelligence` |
| GET | `/internal/4663/campaigns/:campaignId/readiness` |
| POST | `/internal/4663/campaign-rehearsal/preview` |
| GET | `/internal/4663/campaigns` |
| POST | `/internal/4663/campaigns` |
| POST | `/internal/4663/campaigns/:campaignId/schedule` |
| POST | `/internal/4663/campaigns/:campaignId/activate` |
| POST | `/internal/4663/campaigns/:campaignId/complete` |
| POST | `/internal/4663/campaigns/:campaignId/cancel` |
| GET | `/internal/4663/frontdoor/metrics` |
| POST | `/internal/4663/observations/utc-day/:date/refresh` |
| POST | `/internal/4663/pulse/windows/:windowId/resolve` |
| POST | `/internal/4663/pulse/windows/:windowId/publish` |
| GET | `/internal/4663/pulse/metrics` |
| POST | `/internal/4663/reflexive/watch/claims` |
| POST | `/internal/4663/reflexive/watch/audit-targets` |
| POST | `/internal/4663/reflexive/preflight/ipx-pltr/shadow/observe` |
| POST | `/internal/4663/reflexive/refresh` |
| POST | `/internal/4663/reflexive/census/refresh` |
| POST | `/internal/4663/reflexive/stocks/PLTR/preflight/refresh` |
| POST | `/internal/4663/signals/:signalId/transition` |
| POST | `/internal/4663/intelligence/run` |
| POST | `/internal/4663/intelligence/observations` |
| GET | `/internal/4663/intelligence/candidates` |
| POST | `/internal/4663/intelligence/candidates/:candidateId/action` |
| POST | `/internal/4663/intelligence/signals/:signalId/corrections` |
| POST | `/internal/4663/intelligence/signals/:signalId/distribution` |
| POST | `/internal/4663/intelligence/backtest` |
| GET | `/internal/4663/intelligence/metrics` |
| GET | `/internal/4663/intelligence/activation` |
