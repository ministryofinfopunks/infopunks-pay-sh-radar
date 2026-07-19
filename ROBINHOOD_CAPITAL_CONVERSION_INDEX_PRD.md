# Robinhood Capital Conversion Index

## Product Requirements Document

**Product:** Infopunks Radar  
**Instrument:** Robinhood Capital Conversion Index (RCCI)  
**Version:** 0.1  
**Status:** Proposed  
**Date:** July 19, 2026  

## 1. Product thesis

Robinhood Chain has more attention velocity than capital depth. The Robinhood Capital Conversion Index measures whether that attention is becoming retained, productive, and repeatable economic activity.

The index must answer one question:

> Is Robinhood Chain converting speculative attention into durable on-chain capital?

RCCI is not a chain-quality score, token ranking, price signal, or claim that Robinhood Chain is superior to Solana. Solana remains the benchmark market. Robinhood Chain is the frontier whose conversion process is still unresolved.

## 2. Product position

RCCI is a chain-level measurement system, distinct from the existing 4663 Signal Index.

| Surface | Unit of analysis | Primary question |
| --- | --- | --- |
| Attention Market Watch | Asset and attention event | What is attracting attention? |
| 4663 Signal Index | Individual asset | What is moving, and with what risk? |
| Market Structure | Reviewed market layer | What is Robinhood Chain becoming? |
| RCCI | Capital cohort and chain | Is attention converting into durable capital? |
| Signal Graph | Entity and capital relationship | Where is capital moving? |
| Receipts | Evidence object | What supports the claim? |
| Pre-Spend Intelligence | Decision context | What should an agent verify before acting? |

The public distinction should be simple:

> 4663 measures the signal. RCCI measures what survives the signal.

## 3. Problem

Headline DEX volume cannot distinguish durable economic formation from short-lived turnover. Current chain data can show that Robinhood Chain trades intensely relative to TVL, but it cannot yet answer whether:

- meme proceeds remain on-chain;
- traders become repeat users;
- users graduate from memes into stablecoins, RWAs, or lending;
- RWAs become collateral or enter composable strategies;
- reported agent activity is actually agent-controlled;
- volume is organic, incentivized, circular, or concentrated;
- liquidity survives after narrative attention fades.

Without this measurement, the market can mistake activity for conversion and narrative for adoption.

## 4. Goals

RCCI must:

1. Track capital from a qualifying attention event into retained and productive states.
2. Measure conversion over 7-day, 30-day, and 90-day windows.
3. Separate observed activity, attributed activity, and verified activity.
4. Distinguish user-triggered execution from verified agent-controlled execution.
5. Detect circular volume, incentives, sybil clusters, and liquidity concentration.
6. Compare Robinhood Chain with Solana using the same definitions.
7. Attach a receipt, source, timestamp, caveat, and confidence state to every public claim.
8. Make unknown data visibly unknown rather than converting it to zero.

## 5. Non-goals

RCCI must not:

- recommend a token, protocol, strategy, or chain;
- predict token prices or investment returns;
- rank individual meme assets;
- treat Robinhood's customer base as activated on-chain users;
- count reported agent numbers without wallet and execution evidence;
- treat gross DEX volume as organic economic activity;
- infer asset identity from a ticker;
- allow provider observations to promote a reviewed classification;
- use seeded or manual estimates as if they were live measured values;
- automatically approve a pre-spend decision.

## 6. Primary users and jobs

### Infopunks analysts

- Determine whether an attention spike produced retained capital.
- Investigate which wallets, assets, and protocols drove a score change.
- Publish evidence-backed market-structure receipts.

### Builders, issuers, and protocols

- Understand where users stop in the conversion funnel.
- Measure whether RWA, stablecoin, lending, and agent products receive durable flows.
- Compare conversion quality with a mature control market.

### Agents and capital allocators

- Check the quality and persistence of chain activity before spending.
- Inspect known blockers, confidence, and source coverage.
- Retrieve machine-readable conversion evidence without receiving an investment recommendation.

### Public market observers

- See whether attention is becoming infrastructure.
- Verify headline claims through receipts rather than trust unsupported numbers.

## 7. Core measurement model

### 7.1 Capital states

RCCI models capital parcels, not just wallet labels. Each attributable parcel can move through the following states:

1. **Attention capital:** capital exposed to a reviewed meme or attention asset.
2. **Realized proceeds:** net proceeds produced by disposing of that asset.
3. **Retained capital:** proceeds that remain on Robinhood Chain in an eligible non-meme state.
4. **Stable capital:** retained proceeds held in a reviewed stablecoin.
5. **RWA capital:** retained proceeds allocated to a reviewed real-world asset.
6. **Productive capital:** stablecoin or RWA capital used in reviewed lending, collateral, or liquidity contracts.
7. **Agent-controlled capital:** productive capital moved under a verified agent policy.
8. **Exited capital:** capital bridged away, transferred to an excluded entity, or otherwise no longer attributable on-chain.
9. **Unknown:** capital whose identity, destination, or lineage cannot be established with sufficient confidence.

Capital may not be counted in two mutually exclusive states at the same timestamp. Repeated transfers of the same parcel must not increase converted capital.

### 7.2 Qualified cohort

The default cohort trigger is a qualifying disposal of a reviewed meme or attention asset on Robinhood Chain.

A wallet enters a cohort only when all of the following are true:

- the asset is identified by exact contract and has a reviewed layer classification;
- net disposal proceeds equal at least **$100**, configurable by methodology version;
- the wallet has at least two economically independent transactions;
- the wallet is not a router, bridge, exchange, protocol treasury, deployer/team wallet, known MEV actor, or high-confidence sybil/bot cluster;
- USD pricing is available at the event timestamp with acceptable confidence.

For version 0.1, the system must call the amount **realized sale proceeds**, not profit. A true profit claim requires defensible cost basis across the wallet's complete acquisition history.

### 7.3 Capital attribution

The lineage engine must:

- allocate downstream balances proportionally when proceeds are commingled;
- cap attributed downstream value at the original realized proceeds;
- account for fees, slippage, and bridge exits;
- mark lineage as unknown when confidence drops below the published threshold;
- detect circular paths and avoid recounting the same capital;
- preserve every attribution decision in an auditable event trail.

## 8. Headline index

The primary public instrument is **RCCI-30**, supported by:

- **RCCI-7:** early conversion signal, always labeled provisional;
- **RCCI-30:** primary operating index;
- **RCCI-90:** durability confirmation, available only after a cohort matures.

The score ranges from 0 to 100:

`RCCI = sum(component score × component weight) / 100`

All component scores range from 0 to 100. The score is rounded to one decimal place. Calculations retain full precision.

### 8.1 Components

| Component | Weight | Required raw measurement |
| --- | ---: | --- |
| On-chain proceeds retention | 15 | Share of qualified proceeds held in eligible non-meme capital states at the end of the window |
| Wallet graduation | 15 | Share of qualified wallets allocating at least 10% of attributed proceeds or $100, whichever is greater, into a reviewed RWA and retaining or using it for at least 7 days |
| Productive capital utilization | 15 | Share of eligible retained stablecoin and RWA capital used in reviewed lending, collateral, or eligible RWA/stablecoin liquidity positions for at least 7 continuous days |
| Stablecoin persistence | 10 | Share of attributed stablecoin capital remaining on-chain after the applicable attention drawdown and through the end of the window |
| Repeat-wallet activity | 10 | Share of qualified wallets performing economically distinct activity in at least 3 separate weeks during a 30-day window |
| Verified agent execution | 10 | Geometric mean of verified-agent share of productive transactions and verified-agent share of productive USD value |
| Cross-layer capital velocity | 10 | Combination of non-circular conversion breadth and time from realized proceeds to the first qualifying stablecoin, RWA, or productive-capital transition |
| Organic flow quality | 10 | Eligible economic activity after wash, sybil, self-transfer, MEV, known incentive, and circular-flow adjustments |
| Liquidity resilience | 5 | Capital-weighted executable liquidity retained by destination assets and protocols after attention fades |

### 8.2 Normalization

Raw rates must remain visible beside component scores. A score must never be the only public representation of a component.

Each component is normalized through published, versioned floor and target anchors. Between anchors, scoring is linear. Values beyond a target are capped at 100; adverse metrics use an inverted scale.

Before public launch, Infopunks must:

1. backfill at least 90 days or all available Robinhood Chain history if shorter;
2. compute the same raw measures for Solana;
3. publish proposed anchors and their sensitivity analysis;
4. freeze anchors as a named methodology version;
5. prohibit silent retroactive changes.

Percentile-only scoring is not permitted because it can hide absolute deterioration behind relative rank.

### 8.3 Interpretation bands

| Score | State | Meaning |
| ---: | --- | --- |
| 0–24.9 | Attention only | Activity is not producing meaningful retained capital |
| 25–44.9 | Capital parking | Some proceeds remain, but conversion is fragile or narrow |
| 45–64.9 | Conversion forming | Multiple downstream behaviors are visible but not yet durable |
| 65–79.9 | Durable conversion | Retention, graduation, and productive use persist across cohorts |
| 80–100 | Compounding economy | Durable capital circulates productively with broad, organic participation |

These labels describe observed market structure. They do not describe safety or expected return.

## 9. Score status, confidence, and unknown data

Every index snapshot must expose two separate fields:

- **score status:** unavailable, provisional, or confirmed;
- **evidence confidence:** low, medium, or high.

Unknown is not zero.

### Confirmed score requirements

A confirmed RCCI score requires:

- all nine components to be computable;
- at least 90% of qualified USD flow covered by reviewed asset and protocol classifications;
- at least 95% successful ingestion coverage for required chain events;
- a minimum cohort of 100 qualified wallets and $50,000 in qualified proceeds;
- no unresolved critical data-quality incident;
- a generated methodology receipt.

### Provisional score requirements

A provisional score may be shown when at least seven components and 80% of total component weight are available. Missing components must produce a visible score interval:

- lower bound treats missing components as 0;
- upper bound treats missing components as 100;
- no midpoint may be presented as the headline score.

If the minimum cohort is not reached, RCCI must show raw observations and `score_status: unavailable`.

## 10. Agent verification standard

Agent narrative must remain separate from agent activity.

### Level A — verified agent execution

Requires all of the following:

- exact wallet, smart-account, or executor-contract mapping;
- a source-backed controller or operator identity;
- evidence of a pre-authorized policy, schedule, strategy, or capital limit;
- an on-chain transaction trace tied to that execution path;
- sufficient logs or attestations to distinguish automated execution from an ordinary user-signed transaction;
- a receipt that another analyst can reproduce.

Only Level A activity enters the Verified Agent Execution component.

### Level B — attributed agent activity

The wallet or product is officially described as agentic, but autonomous execution cannot be fully reproduced. Display separately; do not include in the agent component.

### Level C — claimed or suspected agent activity

Behavioral resemblance, social claims, or secondary reporting without operational evidence. Treat as investigation context only.

RCCI must report agent transaction count, unique verified agent wallets, USD value, repeated strategy count, and concentration. A single high-volume agent may not be presented as broad agent adoption.

## 11. Organic activity and manipulation controls

The index must identify or discount:

- self-swaps and same-controller transfers;
- repeated circular routes returning capital to the origin cluster;
- wash-trading clusters;
- known router and aggregator internal hops;
- MEV and arbitrage loops that do not change beneficial ownership;
- liquidity mining and explicit trading incentives;
- airdrop farming and sybil clusters;
- deployer, team, and treasury activity;
- duplicated DEX volume reported through overlapping sources;
- transactions whose USD price confidence is below threshold.

Each exclusion must include a rule ID, reason, affected value, confidence, and methodology version. Analysts must be able to inspect and challenge exclusions.

## 12. Solana benchmark

Solana is the control group and commercial proving ground.

The benchmark must:

- use the same cohort, capital-state, attribution, and exclusion definitions;
- show raw rates before normalized scores;
- expose data-coverage differences between chains;
- compare RCCI-7, RCCI-30, and RCCI-90 only when both cohorts are mature;
- avoid a winner label when confidence or coverage is not comparable;
- keep Solana values outside the Robinhood RCCI formula.

Required comparison views:

- retention rate by chain;
- wallet graduation rate by chain;
- productive utilization by chain;
- stablecoin persistence by chain;
- verified agent execution by chain;
- organic flow quality by chain;
- liquidity resilience by chain;
- conversion funnel and time-to-conversion by chain.

## 13. User experience requirements

### 13.1 Index overview

The primary page should live at `/rh-chain-signal-desk/capital-conversion` and show:

- RCCI-30 score or score interval;
- 7-day and 30-day change;
- score status, evidence confidence, methodology version, and observation time;
- all nine component scores and raw rates;
- the largest positive and negative contributor;
- a concentration warning when one protocol supplies more than 50% of eligible activity;
- a direct link to the latest methodology receipt.

The first screen must include the sentence:

> Attention is not conversion. RCCI measures what stays, graduates, and becomes productive.

### 13.2 Conversion funnel

Show capital and wallet counts across:

`Meme proceeds → retained on-chain → stablecoins → RWAs → productive strategies → verified agent execution`

Users must be able to switch between USD capital, wallet count, and conversion percentage, and between 7-day, 30-day, and 90-day cohorts.

### 13.3 Cohort explorer

Users must be able to filter by:

- trigger asset or exact contract;
- cohort start and end date;
- destination asset, protocol, or market layer;
- wallet classification;
- agent evidence level;
- organic versus adjusted activity;
- conversion window;
- evidence confidence.

### 13.4 Signal Graph integration

Signal Graph must represent reviewed capital transitions as directed edges. Edge detail must show attributed USD value, wallet count, time-to-transition, circularity adjustment, sources, and receipt IDs.

### 13.5 Receipt view

Every score snapshot must create a permanent receipt containing:

- calculation time and observation window;
- methodology and classifier versions;
- source inventory and freshness;
- component inputs, raw rates, normalized scores, and weights;
- inclusion and exclusion totals;
- concentration and manipulation warnings;
- missing evidence;
- benchmark comparability state;
- correction history.

### 13.6 Alerts

The product must support alerts for:

- RCCI-30 moving by at least 5 points;
- stablecoin persistence falling by at least 15% relative to the previous mature cohort;
- wallet graduation reaching a new 90-day high;
- productive utilization falling while DEX volume rises;
- verified agent activity becoming materially concentrated;
- organic flow quality dropping below its published floor;
- one protocol exceeding 70% of eligible volume or liquidity;
- a published score becoming provisional because source coverage degraded.

## 14. Functional requirements

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-01 | P0 | Ingest blocks, transactions, logs, traces, token transfers, swaps, bridge events, and protocol events with reorg-safe checkpoints |
| FR-02 | P0 | Maintain exact-contract registries for assets, protocols, bridges, routers, exchanges, RWAs, incentives, and excluded entities |
| FR-03 | P0 | Reuse review-gated Market Structure classifications; provider data may propose but never approve a classification |
| FR-04 | P0 | Build qualified cohorts and preserve the trigger, eligibility decision, and exclusion reason for each wallet |
| FR-05 | P0 | Trace capital lineage without double-counting and expose attribution confidence |
| FR-06 | P0 | Compute all raw metrics, component scores, score status, evidence confidence, and score intervals deterministically |
| FR-07 | P0 | Generate immutable RCCI snapshots and receipt payloads |
| FR-08 | P0 | Expose overview, components, funnel, cohorts, methodology, and receipts through a read-only public API |
| FR-09 | P0 | Render the index overview, conversion funnel, confidence states, source caveats, and methodology receipt in Radar |
| FR-10 | P0 | Keep unknown, zero, unavailable, and not-applicable states distinct in storage, API responses, and UI |
| FR-11 | P1 | Compute the Solana benchmark with the same methodology and a comparability gate |
| FR-12 | P1 | Add Signal Graph edges and drill-downs for capital transitions |
| FR-13 | P1 | Add threshold and anomaly alerts with linked evidence |
| FR-14 | P1 | Support analyst challenges, corrections, and superseding receipts without deleting history |
| FR-15 | P2 | Expose RCCI context to Pre-Spend Intelligence as non-decisive evidence with caveats |

## 15. Data requirements

### Required sources

- Robinhood Chain blocks, receipts, logs, and traces;
- canonical DEX swap and liquidity events;
- bridge deposits and withdrawals;
- ERC-20 transfers and balances;
- reviewed token and protocol classifications;
- stablecoin and RWA issuer/contract registries;
- lending, collateral, LP, and redemption events;
- incentive schedules and reward distributions;
- price observations with source and timestamp;
- verified agent account, policy, and execution receipts;
- Solana-equivalent decoded events for the benchmark.

### Freshness

- Chain events: ingest within 5 minutes under normal operation.
- Provisional component data: refresh hourly.
- Official RCCI snapshots: compute daily after the UTC day closes.
- Corrections: publish a superseding receipt; never silently overwrite a historical snapshot.

### Minimum stored entities

- `capital_cohort`
- `cohort_wallet`
- `capital_transition`
- `entity_classification`
- `agent_attribution`
- `activity_exclusion`
- `component_observation`
- `index_snapshot`
- `methodology_version`
- `evidence_receipt`

## 16. Public API requirements

Minimum endpoints:

- `GET /v1/rh-chain/capital-conversion`
- `GET /v1/rh-chain/capital-conversion/components`
- `GET /v1/rh-chain/capital-conversion/funnel`
- `GET /v1/rh-chain/capital-conversion/cohorts`
- `GET /v1/rh-chain/capital-conversion/receipts/:receipt_id`
- `GET /v1/rh-chain/capital-conversion/methodology`
- `GET /v1/rh-chain/capital-conversion/benchmark/solana`

The overview response must include:

- chain and observation window;
- RCCI-7, RCCI-30, and RCCI-90 values or intervals;
- score status and evidence confidence;
- component raw values, scores, weights, sources, and caveats;
- coverage, cohort size, concentration, and exclusion totals;
- methodology version and receipt ID;
- benchmark comparability state;
- `not_financial_advice: true`.

Public endpoints are read-only. Classification approval, agent verification, and methodology changes remain controlled review operations.

## 17. Methodology governance

- Every formula, threshold, weight, exclusion rule, and registry version must be public.
- Methodology changes require a new semantic version and a change receipt.
- Historical scores must retain their original methodology version.
- If a new version is backfilled, both original and restated series must remain accessible.
- Manual classifications require reviewer identity internally, evidence links, timestamp, and audit history.
- Provider observations remain context only and cannot write directly to reviewed memory.
- A public claim must degrade to `source_required` when its receipt or coverage requirement is no longer satisfied.

## 18. Non-functional requirements

### Determinism

The same source snapshot and methodology version must produce the same result.

### Auditability

An analyst must be able to trace any headline number to component inputs, included transitions, exclusions, source observations, and review decisions.

### Reliability

- No duplicate capital attribution across mutually exclusive states.
- Reorg handling must preserve a correction log.
- Failed source ingestion must degrade confidence and freshness visibly.
- The index must not publish a confirmed score during a critical incident.

### Performance

- Overview API: p95 response below 500 ms from a computed snapshot.
- Cohort explorer: p95 response below 2 seconds for a 90-day query.
- Daily computation: complete before 01:00 UTC under normal load.

### Privacy

RCCI uses public chain and public-source evidence. Public views must present wallet-level data only when necessary for a receipt, agent verification, or manipulation finding. Routine cohort views should use aggregates and clusters.

## 19. Success criteria

### Measurement integrity

- At least 95% required chain-event ingestion coverage.
- At least 90% reviewed classification coverage by qualified USD flow.
- Less than 1% unexplained duplicate attributed capital in reconciliation tests.
- 100% of agent activity in the headline component meets Level A evidence.
- 100% of headline values link to a methodology receipt.
- A second analyst can reproduce a sampled daily score from its receipt.

### Product utility

An analyst can answer the following in under two minutes:

1. How much meme-derived capital remained after 30 days?
2. How many wallets graduated into RWAs?
3. How much graduated capital became productive?
4. How much activity was verified agent execution?
5. How much displayed volume was excluded or discounted, and why?

### Strategic proof

RCCI succeeds when Infopunks can show, with receipts, whether Robinhood Chain is moving from attention-driven activity to retained, composable, and agent-controlled capital—and can demonstrate that the same instrument works on Solana.

## 20. Release plan

### Phase 0 — Measurement ledger

- Freeze taxonomy and cohort rules.
- Create reviewed asset, protocol, RWA, stablecoin, exclusion, and agent registries.
- Backfill Robinhood Chain data.
- Publish raw conversion metrics internally with no composite score.

### Phase 1 — RCCI beta

- Ship all nine component pipelines.
- Publish RCCI-7 and RCCI-30 as provisional where required.
- Add the funnel, cohort explorer, methodology view, and receipts.
- Run manipulation and capital-reconciliation reviews.
- Run the equivalent Solana measures internally to calibrate anchors and test comparability; do not publish a winner label.

### Phase 2 — Public RCCI

- Satisfy confirmed-score coverage gates.
- Freeze methodology version 1.0.
- Publish RCCI-30 and matured RCCI-90.
- Add alerts and distribution-ready receipt cards.

### Phase 3 — Solana control group

- Run the identical measurement system on Solana.
- Publish comparability coverage and raw-rate comparisons.
- Integrate benchmark evidence into Radar and Pre-Spend Intelligence.

## 21. Launch acceptance criteria

RCCI is ready for a public confirmed score only when:

- all P0 requirements pass automated and analyst review;
- all nine components have published formulas and anchors;
- the minimum cohort and coverage gates are satisfied;
- capital lineage reconciliation passes;
- agent claims satisfy the Level A standard;
- organic activity exclusions are inspectable;
- a permanent receipt is generated for the score;
- the UI never presents unknown as zero;
- the 4663 Signal Index and RCCI are visibly described as different instruments;
- the page states that RCCI is public intelligence, not financial advice or a chain endorsement.

## 22. Canonical product language

**Primary line**

> Attention is not conversion. RCCI measures what stays, graduates, and becomes productive.

**Market thesis**

> Robinhood Chain is the frontier. Solana is the benchmark. RCCI measures the bridge between them.

**Evidence doctrine**

> The market repeats agent numbers. Infopunks verifies what those agents actually did.

**Disclaimer**

> RCCI is an evidence-backed market-structure index. It is not a tokenized product, chain endorsement, safety rating, price target, or financial recommendation.
