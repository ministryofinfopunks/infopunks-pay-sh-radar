# RH historical findings

**Scope:** Repository history and checked-in evidence review for RH Chain (network ID 4663), performed 2026-11-12 UTC. No production, Render, database, DNS, deployment, or write operation was performed. This report does not infer conversation history that is not preserved in repository evidence.

## June–July 2026 implementation history

The first Robinhood Signal Desk implementation appears in commit `51fd5935` (2026-06-29, “Add living narrative signal desk”). It added `src/data/signalUpdates.ts`, `/v1/narratives*` and `/v1/signals*` projections, and tests. Those early narrative/signal projections were curated local data; they were not live chain reads.

RH-specific Signal Desk development follows in the July history: `6c15dd56` (2026-07-09, “Add RH Chain Signal Desk”), then `1621e4b1` (2026-07-16, Signal Desk 2.0 foundation), `0e785ea5` (brief and analyst modes), and `e4f9b520` (Signal Desk tests). The existence of a desk or a passing local test demonstrates implementation behavior, not a successful current upstream observation.

The first verified market-provider integration located in history is `cf9aca12` (2026-07-17, “Add RH Chain DEX Screener provider”). It adds `DexScreenerProvider`, `RhChainMarketDataService`, API routes, and tests. Its source is DexScreener, with `chainId` constrained to the provider's `robinhood` identifier. `bdc6b497` (2026-07-17, “Add RH Chain snapshot history and onchain registry”) adds Blockscout token enrichment and DEX snapshot history. `f8486e3b` adds RH 4663 market structure, while later July commits add discovery, review, attention and receipt workflows.

Repository code and tests show these historical capabilities:

- DexScreener token pair, boost, top boost and paid-order requests; exact token contract and Robinhood chain filtering; in-process response caching and bounded provider request/retry settings.
- Blockscout token/address/contract, transfer, holder, and token-list reads through its v2 API.
- DefiLlama chain TVL, chain-level fees and protocol-scoped context in the later `RhChainLiveSnapshotService`; a later version also parses stablecoin context.
- Market snapshot capture and historical reads, reviewed classification, project claims, receipts and other projections layered over local or PostgreSQL stores.

These were not all usable without PostgreSQL. `GET /v1/rh-chain/market/tokens/:contract` uses `RhChainMarketDataService`, whose configured `classificationFor` callback reads submissions from the RH submission store. The DEX provider itself is external and has an in-memory response cache, but the route's normal service graph adds database context. Snapshot history, reviewed classifications, project claims and receipts explicitly depend on their configured stores. Live snapshot cache may be PostgreSQL-backed when a pool or `DATABASE_URL` is supplied.

### RH persistence generations

The July legacy namespace is `rh_chain_*`. Checked-in migrations define:

- `20260719_001`: `rh_chain_market_snapshots` (provider/capture metadata and JSON payload).
- `20260719_002`: `rh_chain_reviewed_classifications` and `rh_chain_reviewed_classification_audit`.
- `20260719_003`: RH classification layer vocabulary/data migration.
- `20260719_004`: `rh_chain_attention_receipts`.
- `20260719_005`: `rh_chain_projects`, claims, evidence, observations, verdicts, intelligence receipts and project audit.
- `20260720_006`: `rh_chain_project_contract_relationships`.

The separate August //4663 protocol generation uses `rh_4663_*`, not a rename or replacement of the legacy tables. Migration `20260813_007` defines Genesis wallets, pulse calls, events, Today editions and signals. `20260813_008` defines pulse-window resolutions, resolution receipts and anchors. `20260814_009` adds observations, signal candidates/publications/distribution/corrections and provider health. Later migrations add `rh4663_product_intelligence_events` and further protocol features. Their records, freshness rules, authorization and durability semantics are distinct from `rh_chain_market_snapshots` and other legacy RH Chain stores.

## August investigations and reconciliation

### August 17

The checked-in `docs/phase3.1-production-audit-2026-08-17.md` records a production audit at `2026-08-17T06:13:03Z` and a **NO-GO before migration 009** decision. It documents `persistence=memory`, stale/degraded Today data, zero published Signals and zero provider requests on the public Signals read. It also says migrations and production persistence could not be database-verified; no database credential was available to that audit. This is evidence that some //4663 public views rendered in memory mode, not evidence of current external RH market reads or durable protocol operation.

The endpoints explicitly recorded as working/rendering in that audit are `/4663` (page), `/v1/4663` overview, `/v1/4663/signals`, `/v1/4663/receipts`, `/v1/4663/pulse`, `/v1/4663/today`, and Pulse share PNG requests. The audit labels Today data stale/degraded and reports zero receipts/calls and no published Signals. These results qualify page/route availability at that audit time, not genuine live market data. June/July Git commits and tests show implemented routes, but repository evidence reviewed here does not establish that those earlier RH market endpoints succeeded against production upstreams at that time.

Git independently verifies commit `ec75c3891c5fe1df919e91f7ec88af27bb484a87`, timestamped `2026-08-17T23:33:49+05:30`, “fix: make Radar resilient to PostgreSQL failures.” It adds database failure handling and tests. That commit establishes a resilience code change; it does not establish a current RH public read path that avoids the normal app/database initialization graph.

### August 30–31

The local commit history has no August 30 RH investigation report. August 31 commits `c61799b2`, `5a247436`, and `0b2361e8` add a print-to-pulse campaign, print generator, and verified UTC-day observation service. The UTC-day service fetches a dated transaction row from Blockscout's transaction chart and a dated DEX-volume row from DefiLlama, checks date/finality conditions, then persists finalized observations through its store. Its public `/v1/4663/observations?date=...` handler reads the store; it does not perform a live upstream read. Provider collection/finalization is not a persistence-free GET.

`src/services/rh4663PrintService.ts` contains an August 30 historical campaign print with externally attributed values including 5.52M transactions and $874.8M UTC-day DEX volume. Its print-generator tests explicitly say the Aug 30 campaign object is frozen irrespective of later provider-shaped input. Separately, the UTC-day test uses a synthetic provider fixture of 5,521,213 transactions and $874.8M volume, while the API test asserts `/v1/4663/observations?date=2026-08-31` is `INCOMPLETE` with both observations null. These fixture values are test inputs only; they do not establish actual source output or successful finalization on Aug 31. The campaign print is dated, source-attributed historical/reporting evidence, not live data. Do not reuse it as current market statistics.

The later source-audit document `docs/reviews/rh-freshness-integration-2026-11-04.md` provides additional reconciliation: it records read-only external checks for DefiLlama, DexScreener, CoinGecko and Blockscout, identifies absent provider timestamps, and distinguishes cache fetch times from source observation times. It reports Blockscout HTTP 403 locally, CoinGecko 404 for the earlier global meme category, no evidence of a recent scheduled successful refresh, and zero RH market snapshot rows in the inspected database evidence. Those are dated historical findings, not present-time health guarantees.

## Historical failure modes and fixes evidenced in source

- Database failure resilience was added in the August 17 commit. It mitigates app behavior under PostgreSQL failures but does not remove data-path database dependencies.
- The DefiLlama source contract does not reliably supply a chain-level observation timestamp. The current code deliberately uses `source_timestamp: null`; a local fetch time must not be represented as the provider's observation time.
- The older stablecoin parser was documented as failing against nested `current.peggedUSD`; the November 4 review says it was corrected to the aggregate `totalCirculatingUSD.peggedUSD`. Current direct qualification was unable to reach the stablecoin endpoint due DNS timeout, so that correction is not freshly requalified here.
- The initial CoinGecko category source returned HTTP 404 in the November 4 record. A later commit changed the category ID to `meme-token`, but this remains global meme-market context, not Robinhood-chain-specific market data.
- Blockscout local access returned HTTP 403 in the November 4 record; the current direct transaction-chart request also returned 403.
- DEX pair/capture timestamps are local fetch/capture times where the provider has no observation timestamp. Pair creation time is not a market observation timestamp.
- Migration `20260813_007` down migration refuses rollback when immutable protocol data exists; `20260813_008` similarly protects resolution and anchor history. No migration was run as part of this review.

## Evidence boundary

Historical provider responses, public production health, migration state and operator-reported settings are only claimed where a repository record supports them. Current upstream response evidence is separately recorded in `RH-READ-ONLY-QUALIFICATION.md`. No current application route was enabled or invoked as a live-read qualification.
