# RH category intelligence — local integration candidate

Stored movements now feed `/4663` NOW, WATCH and OPEN LOOPS through a single category projection. Stock Tokens, RWA/DeFi, Memes and Stables are first-class lanes; unclassified market discovery remains accessible. Observation input coverage never grants reviewed judgment, reputation, receipt publication or trading authority.

## Qualification

| Verdict | Result |
| --- | --- |
| Code qualification | PASS |
| Local integration | PASS |
| Staging authorization | HOLD — not authorized by this task |
| Production activation | HOLD — no deployment or production proof |
| Complete specialized Stock/RWA/Stable evidence product | HOLD — missing collectors and reference evidence |

**Base:** `7effafb37f3f8aebd529ad13e90d87222189ba05` (`codex/rh-pipeline-1b-integration`). **Frozen qualified source:** `955dd214301f38dabf5b050ac9ae2d2b36559eea` (`codex/rh-category-intelligence`). The separate integration worktree preserves main, 1A, Stock/RWA and 1B refs and checkouts. No merge, push, deployment, production configuration change, publishing activation or public automation occurred.

Dependency chain: approved main `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f` → 1A `270cccdb439ee6929d5dab4c778061c1e1b8581f` → Stock/RWA `0aad6b22b1d3514cf57225501cb8dbed02622237` → integrated 1B `7effafb37f3f8aebd529ad13e90d87222189ba05` → this frozen source. [Qualification evidence](evidence/rh-category-intelligence/qualification.json) contains the exact 16-file changed inventory, all 18 migration hashes and unchanged authority-file checks.

## Category behavior and limits

- Stock Token identity comes from the persisted official registry. Category inputs check issuer registry, session, adjusted same-pair reference, full corporate-action history and issuer terms. Existing reference coverage is principally PLTR; full corporate-action history and issuer terms are absent. The financial score is withheld.
- RWA/DeFi identity comes only from exact-contract reviewed category records. Mechanism evidence, asset/protocol references and constraints are not yet collected. Narrative candidates without completed review remain discovery. Scores are withheld.
- Memes require reviewed exact identity and explicit paid-attention coverage across every sample in the same-pair window. Missing coverage and contradictory duplicates withhold the score. With complete inputs, version `meme-market-activity-v1` uses liquidity 30%, rolling volume 30%, transaction activity 25%, category-specific persistence 10%, paid-coverage completeness 5%. Price and promotion size earn no points, directly or through persistence. This is a descriptive, locally qualified calculation, not an organic-demand classification or investment prediction.
- Stables are a visible category with explicit empty coverage. No verified stable issuer/peg/reserve/redemption adapter is connected; the current production adapter does not assign stable identities or calculate stable scores.
- General discovery retains the existing broad market-activity methodology. Scores are versioned and cannot be compared across categories. Neither rolling volume nor price change is presented as capital inflow or investment return.

`GET /v1/4663/market/categories` reads the same stored observations as `/v1/rh-chain/market/movers`. The Front Door consumes that projection, derives factual cards and coverage checkpoints, and keeps CALL and proof semantics unchanged. Every finding retains exact token/pair, observation IDs, timestamps, metric coverage, source and investigation links. No new collector, publisher or judgment dependency was introduced.

Browser reads revalidate anonymously with ETag every 15 seconds while visible, pause on hidden tabs, coalesce requests, and keep original evidence timestamps on failure. Expired observations leave current category views. Semantic versioning excludes request latency and health-check attempt times. Production still requires a persistent Front Door version counter; ephemeral local versions can collide across process restarts and are not production proof.

## Validation and provenance

**1,997 tests passed across 272 test files; zero failures or skips.** Nineteen new tests cover category evidence, scoring replay, price/promotion independence, ambiguous identity, missing paid coverage, stale/testnet data, anonymous reads, unchanged CALL/proof, browser refresh and PostgreSQL restart/replay. Original 1A, Stock/RWA, Movers/Today, Pulse, Reflexive Radar and judgment tests passed in the combined suite. Typecheck, lint and server/client builds passed. The existing client bundle-size warning remains.

All 18 inherited up migrations were exercised by the PostgreSQL tests. No migration or schema change was added. PostgreSQL qualification used a disposable local PostgreSQL 14 cluster and isolated schemas, not staging or production.

[API and persisted observation examples](evidence/rh-category-intelligence/api-examples.json) are **synthetic fixtures only**: 39 persisted five-minute observations across three exact contracts, 13 samples per qualifying window. Stock and meme scores were withheld; general discovery remained populated. Provider fetches were disabled and made to throw. Example category read: 34.72 ms; warm Front Door read: 0.79 ms. These are single local measurements, not production latency or coverage claims.

Browser checks used desktop 1280px and mobile 390px, with no horizontal overflow. Native disclosure expanded by Enter, with a visible 3px focus outline. Source and evidence links, five category lanes, incomplete/empty coverage and the existing Movers route were checked. Component tests cover loading, unavailable, expired, offline/304 and hidden-tab states. The strict static audit covers the two new shared market-intelligence UI owners, not the whole legacy application; its findings and the DESIGN.md lint are saved with the evidence. Temporary preview tabs were closed and viewport overrides reset.

## Deployment and rollback

No new feature flag was introduced. Existing `RH_CHAIN_AUTOMATION_ENABLED`, `RH_CHAIN_MARKET_INGESTION_ENABLED`, `RH_CHAIN_MARKET_HISTORY_ENABLED` and `RH_CHAIN_MARKET_SCHEDULER_ENABLED` remain unchanged. Reviewed-classification and Phase 2/3 production-proof gates remain intact. Do not enable flags based on this local result.

Rollback means restoring the prior 1B code at `7effafb37f3f8aebd529ad13e90d87222189ba05`; no schema rollback is needed. Preserve the durable Front Door counter and market history. The next specialized product work is collecting verified issuer terms/corporate actions, non-stock RWA mechanisms and stable reference/redemption evidence, plus deliberate paid-attention collection. This candidate does not demonstrate paid preflight adoption, decision accuracy, execution success or attributable fee revenue.
