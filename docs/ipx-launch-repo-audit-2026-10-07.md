# IPX launch repository audit

Audit date: 7 October 2026. Base commit: `55f05d6`. The shared working tree changed during this audit; results below describe the source inspected and checks as executed, not an immutable final snapshot.

## Finding

Radar has a substantial intelligence and provenance foundation. The proposed IPX economy is not implemented end to end. Signed CALLs, outcomes, canonical receipt ancestry, paid judgment code and PLTR inventory research exist; a sovereign IPX contract, token birth certificate, direct IPX/PLTR settlement, USDG accounting and revenue-funded burns do not have implementations in this checkout.

This is a repository audit, not a deployment or smart-contract security certification. No production database, private configuration, deployed contract, live payment, pool or external network availability was verified. “Implemented” below means source and local test evidence exist. Documentation and UI labels alone do not establish live capability. No application source was changed.

## Checklist mapped to source

| Requirement | Repository state | Evidence and remaining work |
| --- | --- | --- |
| Solana reflexive indexing | Partial foundation | `/solana`, Pay.sh catalog ingestion, monitoring, signal intake, evidence ledger and route/provider intelligence exist. `src/ingestion/payShCatalogAdapter.ts` ingests catalog events, not a Solana block/transaction stream. No dedicated Solana attention/market/social PRINT indexer with cursor, replay and finality handling was found. |
| Cross-venue audit / wash filtering | Partial, different scope | `rhChainCrossVenueAuditService.ts` reconciles PAIR/LONG stock inventory, duplicate identities, scope and observation blocks on 4663. It is not a Solana-to-Robinhood volume reconciliation engine or wash-trade classifier. |
| Solana identity → 4663 Genesis | Missing | CALL payloads require EVM addresses and signatures. No Solana signature verification, dual-wallet ownership proof or canonical identity claim mapping was found. |
| Sovereign IPX ERC-20 | Missing | No Solidity sources, contract build project or IPX deployment manifest found. Simulator IPX has `contract_address: null` and `deployable: false`. Supply, allocation, mint/admin controls and upgradeability cannot be audited yet. |
| Canonical IPX birth certificate | Missing | Existing market birth observations and Genesis policy hashes concern other objects. No IPX certificate combining chain, deployed contract, genesis block/time, Constitution SHA-256 and cohort commitment was found. |
| 4,663 Genesis calls | Implemented with material differences | Fixed UTC half-open days, EVM signature recovery, SHA-256 receipts, per-wallet/day uniqueness and transactionally assigned Genesis ordinals exist. Policy is first 4,663 **distinct wallets**, across windows, with **no economic entitlement**. CALL serialization is insertion-order JSON, not JCS. |
| IPX/PLTR settlement and pool | Research only | PLTR asset/pool verification, principal reconstruction, price/basis context and impact simulation exist. IPX/PLTR lab and shadow runs are hypothetical and cannot transact. No IPX swap, pool creation or liquidity provisioning implementation found. |
| USDG paid judgment checks | Different rail implemented | Paid canonical judgment code uses x402 V2 **Base USDC**, network `eip155:8453`. Configuration rejects other networks. Payment defaults off. No USDG/4663 payment gateway or execution proof profile found. |
| Service and revenue receipts | Partial | Paid judgments bind receipts to facilitator settlement; canonical observations/judgments/executions/evaluations have hash ancestry. Public Revenue Receipts read static templates/open slots/internal records, not the paid judgment journal. No deterministic USDG ServiceReceipt → RevenueReceipt linkage found. |
| Onchain contribution ledger | Missing | No automated gross revenue minus infrastructure/data/facilitator/refund ledger or onchain posting implementation found. Static use-of-funds percentages are a different policy. |
| Buy and burn | Missing | No contribution allocation executor, IPX market purchase, burn transaction or source-revenue-to-burn receipt chain found. |
| PLTR Market-Hours | Partial ingredients | Stock principal observations, quote persistence, lifecycle checkpoints and PLTR shadow history exist. No time integration of **executable** PLTR liquidity or implemented Attention → Mission → Retained PLTR economic conversion metric found. |
| No secondary token mechanisms | No IPX mechanisms found | No IPX staking, yield emissions, referral emissions or mandatory IPX gas implementation found. This is absence in source, not verification of a token contract. Public revenue examples include hunter rewards/bounties; determine their funding separately from token emissions. |
| PLTR quote, not backing | Needs explicit doctrine | Lab correctly says no token launched and no transaction executed. It also offers `PLTR_NATIVE`, `PLTR_ANCHOR` and `PLTR_RESERVE_ANCHOR` designs. No explicit quote-not-backing statement was found in the inspected lab implementation. Freeze the launch architecture and state that IPX confers no claim on PLTR holdings or shares. |
| Historical provenance moat | Strong foundation, mixed coverage | Signed CALL/RESOLUTION receipts, inclusion proofs, proof profiles and canonical parent-hash chains exist. Some attention content is curated/static; Reflexive Watch defaults to a seeded in-memory store. Not every UI metric derives from durable verified outcomes. |

## What can be reused

1. **CALL and resolution memory:** `rh4663Service.ts` and `rh4663ResolutionService.ts` implement signed daily calls, deterministic outcomes, Merkle acceptance commitments, inclusion proofs, reputation history and optional commitment anchoring.
2. **Receipt authority:** `receiptIntegrityService.ts`, `receiptAuthorityService.ts`, `canonicalReceiptStore.ts` and migration 011 establish observation → judgment → execution → evaluation ancestry, integrity checks and append-only database protections. Evaluation code and a fixed scoring policy exist; older phase documents that say evaluation was not added are historical, not the complete current inventory.
3. **Paid judgment boundary:** `judgmentService.ts`, `x402JudgmentMiddleware.ts`, `judgmentRequestRepository.ts` and migration 012 provide challenge/verification/settlement, frozen quotes, idempotency and replay without another charge. Missing evidence produces a free `insufficient_evidence` result. Uncertain settlement remains pending reconciliation.
4. **External execution proof:** `executionProofService.ts` and migration 013 provide Base USDC proof validation and uniqueness protection. This records external execution; it is not an executor or a USDG/4663 adapter.
5. **PLTR research:** `rhChainReflexiveRadarService.ts`, `rhChainCrossVenueAuditService.ts`, `rhChainPltrPreflightService.ts` and IPX/PLTR simulator/shadow services supply canonical asset identity, verified pool primitives, observed stock principal and hypothetical capacity/risk analysis.
6. **Product surfaces:** Attention Market Watch, Signal Graph, LoopLab, Receipts, Claims, Routes, Providers and Pre-Spend Intelligence already exist. Their evidence authority differs: community/editorial intake is not canonical execution authorization.

Concurrent work also introduced uncommitted Ed25519 judgment issuer authentication (`src/security/judgmentIssuer.ts`, `docs/signed-judgment-permission.md`) and derived outcome-score projection (`src/services/derivedScoreService.ts`, migration 014). These strengthen the intended provenance design but were not fully audited or separately validated here. They do not supply an IPX contract, USDG settlement or treasury/burn automation. Include their final schema, trust-key configuration and migration requirements in the production gate once that work is finalized.

## Launch blockers, in dependency order

### P0 — Freeze the economic protocol

Resolve the decisions below before contract or receipt work. The proposed direct IPX/PLTR primitive, existing multi-rail lab candidates, distinct-wallet Genesis policy, and Base USDC payment implementation are materially different specifications. A functioning UI does not resolve them.

### P0 — Implement and verify the token and birth record

Create reviewed token source, fixed allocation/supply rules, deployment procedure and certificate schema. Bind the certificate to actual chain/contract/block evidence and the exact Constitution bytes. Define how a cohort that completes after deployment is committed without rewriting the original birth record. Nothing inspected establishes a deployed sovereign IPX token.

### P0 — Introduce JCS through a versioned protocol

`rh4663Service.ts:276` implements `serializeRh4663Canonical` as `JSON.stringify(value)`. CALL fields are emitted in a fixed insertion order, which differs from JCS lexical property ordering. Their hashes are deterministic for that builder, but do not meet the requested JCS format. The separate receipt-spine serializer sorts recursively; it is not used by CALL v1 and is not evidence of CALL JCS conformance.

Keep existing signed CALL bytes, hashes and verification rules intact. Add a separately versioned serializer/schema with interoperability vectors; define how old CALLs participate before publishing a new cohort commitment. Do not regenerate historical receipts under new serialization rules.

### P0 — Close the payment → contribution → purchase → burn chain

Either explicitly ship the current Base USDC service first or build a verified USDG rail. Implement cost attribution, refunds, contribution calculation, allocation policy, purchase execution and deterministic burn receipts. Bind each step to original settlement identifiers and prevent duplicate spending across retries/restarts. Public revenue templates currently cannot substantiate protocol revenue or burns.

### P0 — Establish a real executable IPX/PLTR market

Choose venue/pool parameters, seed capital, LP custody and any lock/withdrawal rules. Verify canonical PLTR identity and actual pool transactions. Measure executable depth by trade size, direction and slippage; nominal stock inventory and modeled capacity alone do not prove execution. Current lab `ALLOW / DEGRADE / BLOCK` values are draft simulation verdicts, not paid judgment states or launch authorization.

### P1 — Complete evidence ingestion and production durability

Implement the Solana indexer, ownership mapping and cross-chain audit required by the thesis. Verify migrations 011–013 and existing 4663 tables under the application database role; run restart/replay, outage, backup/restore and pending-payment reconciliation checks. Observe configured workers and actual provider freshness. The launch checklist remains a gate, not evidence that deployment happened.

### P1 — Make provenance coverage visible

For each public metric expose source, observation time/block, method version, evidence links, storage state and whether it is observed, modeled or editorial. `attentionMarketWatch.ts` contains curated records. `rhChainReflexiveWatchService.ts` defaults to seeded in-memory claims/targets; the app constructs that service without a durable default store. Such writes can disappear on process restart and should not support claims of permanent historical memory.

Hashes prove integrity relative to a trusted record; they do not establish source truth. Public historical records can also be copied. The defensible moat is recognized canonical issuance, signed attribution, continuity, verified settlement and outcome history—not a claim that data cannot be copied.

## Decisions still required

| Decision | Existing constraint | Required resolution |
| --- | --- | --- |
| Launch boundary | Intelligence product exists; token economy is incomplete | Separate evidence-product launch acceptance from IPX economic launch acceptance. |
| Genesis membership | First 4,663 distinct EVM wallets, across UTC days; no entitlement | Define calls versus identities, start/end conditions, duplicate/Sybil policy, and whether participation has any token allocation. Preserve existing promises and records. |
| Constitution and certificate | Genesis eligibility policy hash exists; IPX Constitution artifact does not | Specify Constitution bytes/version, certificate authority, deployment-time fields and later cohort sealing. |
| Supply and allocations | Lab supply numbers are hypothetical inputs | Fix total supply/decimals, allocation amounts, vesting/custody, initial circulating supply, and mint/admin invariants. |
| Market architecture | Native, anchor and reserve-anchor models coexist | Select canonical IPX/PLTR market, permitted secondary execution rails and whether a separate reserve exists; reserve holdings must not imply backing/redemption rights. |
| Paid service rail and decisions | Base USDC; `proceed`, `test_spend_first`, `do_not_spend`, `insufficient_evidence` | Choose phased rail support and a mapping to requested `ALLOW / DEGRADE / BLOCK` without losing unknown/evidence failure states. Verify actual USDG and facilitator capabilities separately. |
| Contribution policy | Static 40/30/20/10 use-of-funds example | Define gross recognition, cost units/allocation, refunds, negative contribution, purchase percentage, cadence and policy authority. |
| Burn semantics | No executor | Choose supply-reducing contract burn versus transfer to an inaccessible address; specify receipts and how remaining supply is reported. |
| Solana identity | EVM-only CALL signer | Specify dual signatures, domain separation, replay protection, one-to-one mapping and revocation/dispute policy without token bridging. |
| PLTR Market-Hours | Inventory/quote history exists | Define slippage budget, buy/sell depth, units, sampling/integration, stale periods, inactive ranges and attribution. Do not infer causation from coincident attention and liquidity. |
| Outcome authority | Internal reviewed evaluation code exists | Define who verifies outcomes, challenge/correction handling, and which records may influence economic metrics. Community claims must not acquire authority merely through payment or IPX holdings. |

## Concrete correctness follow-ups

- **Anchor confirmation binding:** `rh4663ResolutionService.ts:291` confirms transaction success and depth but does not itself verify destination bytecode, emitted commitment or stored root against the submitted commitment. Before relying on an onchain anchor for launch provenance, verify chain/contract identity and exact commitment inclusion. A successful receipt alone can represent a call to the wrong address.
- **PLTR burn recency:** `buildPltrPreflightState` in `rhChainPltrPreflightService.ts:97` calculates `time_since_last_burn_ms` using the mint list when burns exist. This can report the wrong timestamp, or a nonfinite value when only burns exist. Correct and cover before using it as live supply-risk evidence.
- **Market session classification:** `underlyingPltrSession` in `rhChainPltrPreflightService.ts:38`, plus the price-fetch adapter in `src/api/app.ts`, use fixed UTC hours and weekends. They do not implement a dated exchange calendar, daylight-saving changes, holidays or early closes. Treat session output as provisional until calendar handling is implemented if it gates executable-depth assessments.

## Validation performed

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: **233 test files passed, 2 skipped; 1,731 tests passed, 9 skipped**.
- `npm run build`: passed; Vite reports large browser chunks, a performance follow-up rather than proof of economic launch readiness.
- PostgreSQL receipt-spine, payment-journal and execution-proof durability suites are gated by `CANONICAL_RECEIPT_TEST_URL`; database-gated checks were skipped in this run. Existing validation documents report prior local database/fixture work; that was not independently reproduced here.
- No live facilitator settlement, USDG availability, 4663 contract/pool, production migration status, oracle freshness or production service-level behavior was tested.
- Final status showed concurrent edits to receipt, judgment, evaluation, configuration and API source plus new issuer/projection files and migration 014. Those edits were left untouched. Passing checks must not be presented as validation of all final uncommitted changes; rerun appropriate checks after the other work settles.

## Recommended next deliverable

Freeze a short IPX launch protocol covering Genesis semantics, token allocation, Constitution/certificate, payment rail, canonical market and contribution/burn policy. Then implement in dependency order: token/certificate → identity and cohort commitments → actual payment/accounting → market execution and burn receipts → executable Market-Hours and economic dashboard. In parallel with implementation, preserve the existing evidence product and prove its production durability; do not claim the economic flywheel is operational from simulation results.

## Primary source index

Source paths below are relative to this repository.

- Genesis and receipt bytes: `src/services/rh4663Service.ts:9`, `:250`, `:263`, `:363`, `:416`.
- Resolution, Merkle proofs and anchoring: `src/services/rh4663ResolutionService.ts:278`.
- Canonical ancestry and storage: `src/services/receiptAuthorityService.ts`, `src/services/receiptIntegrityService.ts`, `src/persistence/canonicalReceiptStore.ts`, migration `20261007_011`.
- Payment boundary: `src/services/judgmentService.ts`, `src/middleware/x402JudgmentMiddleware.ts`, `src/repositories/judgmentRequestRepository.ts`, `src/config/env.ts:171`, `:262`, `src/api/app.ts:4438`, migration `20261007_012`.
- Execution and evaluation: `src/services/executionProofService.ts`, `src/services/evaluationService.ts`, `src/services/evaluationScorePolicy.ts`, migration `20261007_013`.
- Public revenue examples: `src/data/revenueReceipts.ts:5`, `src/services/revenueReceiptService.ts:24`.
- Market research: `src/services/rhChainReflexiveRadarService.ts`, `src/services/rhChainCrossVenueAuditService.ts`, `src/services/rhChainPltrPreflightService.ts`, `src/services/ipxPltrPreflightSimulatorService.ts:9`, `src/services/ipxPltrShadowLabService.ts`, `src/services/ipxPltrShadowObservationService.ts`.
- UI and history qualifications: `src/web/ipxPltrPreflightLabPage.tsx:44`, `src/data/attentionMarketWatch.ts:65`, `src/services/rhChainReflexiveWatchService.ts:185`, `src/api/app.ts:817`, `src/services/rh4663ProductIntelligenceService.ts`.
- Existing gates and prior validation: `docs/rh4663-launch-checklist.md`, `docs/canonical-receipt-spine.md`, `docs/phases2-3-validation.md`, `docs/autonomous-economic-judgment-spec.md` (explicitly a proposed future specification).
