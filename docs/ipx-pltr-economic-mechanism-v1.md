# IPX/PLTR Economic Mechanism Specification v1

8 October 2026 · draft for technical, economic and legal review · `ipx-pltr.economics.v1`

**Status: proposed economic design. No launch authorization, approved fee schedule, deployed pool, verified reserve or operational flywheel is established by this document.**

The specification freezes the mechanisms sufficiently for comparison and review while leaving unknown quantities explicitly unapproved. It does not overwrite [IPX launch protocol v2](ipx-launch-protocol-v2.md). That document and the current contracts describe a distinct service-contribution purchase/burn implementation. Resolve the model choice before deploying financial code. The [causal-loop audit](ipx-causal-loop-audit-2026-10-08.md) and [Receipt Tape v1](receipt-tape-v1.md) define the prior intelligence gates.

## 1. Identity, scope and invariants

IPX is the proposed Robinhood Chain-native Infopunks asset on chain 4663, separate from legacy Solana `$INFOPUNKS`. IPX/PLTR is the intended market pair: IPX is the mission asset and PLTR the quote/capital anchor. Pairing conveys no PLTR backing, ownership or redemption right to IPX holders. Radar judgment authority comes from verified evidence and evaluations; neither IPX holdings nor pool participation can purchase a favorable decision.

Insufficient-evidence decisions remain free. Paid judgments charge for assessment, including unfavorable decisions. The token is not mandatory Radar payment, gas, a stock share, or a guarantee of investment or execution performance. No buyback, reserve growth, price floor, yield or liquidity outcome is promised.

The current `IPX.sol` artifact is a fixed-supply ERC-20 with 18 decimals and burn support, no owner, mint entrypoint, proxy, blacklist or transfer tax. Its constructor restricts deployment to 4663. These are source properties of an undeployed artifact, not proof of an onchain address or finalized allocation. Supply, six allocations, custody and vesting remain review inputs. Legacy recognition is not silently converted into economic entitlement.

## 2. Current implementation versus the original proposal

| Mechanism | Code evidence | Status |
| --- | --- | --- |
| Fixed-supply token and birth certificate | `contracts/src/IPX.sol` | Implemented artifact; deployment/allocation not verified |
| Genesis call distribution | `IPXGenesisCalls.sol`, `ipxGenesisService.ts` | Separate proposed v2 cohort; terms/funding/deployment unresolved |
| USDG paid judgments on 4663 | `economicRails.ts`, judgment middleware and accounting | Supported implementation; live facilitator and production evidence unverified |
| Positive USDG contribution → PLTR → IPX → burn | `IPXContributionVault.sol`, `ipxRevenueLedger.ts` | Implemented artifact and local tests; compatible live router/pools/custody unverified |
| Buy-side PLTR trading fee → retained reserve | No corresponding reserve/fee collector in reviewed package | Proposal only |
| Sell-side IPX trading fee → burn/permanent lock | Token has no transfer tax; no permanent lock contract in package | Proposal only |
| Executable PLTR market-hours | `ipxMarketHours.ts` | Calculation utility; live qualified quote pipeline not established |
| Public economic receipts | IPX launch/economy routes and migration 017 | Durable implementation artifacts; production deployment/completeness unverified |

The current vault holds USDG purchase budgets and uses PLTR as an intermediate swap asset. It does **not** accumulate a PLTR reserve. `burnBps` is a share of positive service contribution allocated to purchases; it is **not** a buy/sell trading fee. The vault spends that budget and burns all received IPX. The code's operations recipient receives `gross − purchaseBudget`, which includes both cost coverage and any retained net contribution.

Recommendation for review: keep the original reserve/levy model as optional **Model A**. Treat the existing service-contribution model as **Model B**, independently gated. Do not combine them or describe either as live. Launching a simple pair without custom levies can be considered separately after proof and eligibility gates; custom economics need not precede useful intelligence.

## 3. Model A — asymmetric trading fees and PLTR reserve

### 3.1 Venue-level behavior

Collect fees at a reviewed pool/hook or explicitly disclosed venue execution boundary, rather than adding a blanket token transfer tax. “Buy” means IPX is the output and canonical PLTR is the input; “sell” means IPX is the input and PLTR the output. Token ordering must be determined by contract identity and swap direction, not ticker text or currency0 position.

This is a **venue-specific** rule. An alternate pool or direct transfer may not pay it. Do not claim an ecosystem-wide fee unless separately implemented and verified. Exact-input and exact-output swaps, multihop routers, aggregator paths, flash interactions, liquidity operations and rounding all require explicit design. Normal LP/protocol fees and the proposed IPX levy must be shown separately with the total executable quote.

Uniswap v4 exposes pool-specific swap hooks and custom accounting; a hook is part of pool identity and cannot be retrofitted onto an existing pool. This establishes a possible architecture, not deployment/support on the intended venue. [Official hook documentation](https://developers.uniswap.org/docs/protocols/v4/concepts/hooks).

### 3.2 Review formulas

All quantities are atomic integers with verified decimals. Percentages below are variables, **not selected rates**. Let `D = 10,000`, buy levy `b`, sell levy `s`, reserve share `r`, sell burn share `u`, and sell lock share `l` be integer basis points.

For a gross exact-input buy with PLTR amount `Q`:

```text
buy_fee_pltr     = floor(Q × b / D)
pltr_swap_input  = Q − buy_fee_pltr
reserve_credit  = floor(buy_fee_pltr × r / D)
other_fee_credit = buy_fee_pltr − reserve_credit
```

The configured policy must name the recipient and purpose of every non-reserve unit, including rounding residue. PLTR left in LP inventory is not a segregated reserve credit. Report reserve credit only after finalized custody transfer and event/balance reconciliation.

For a gross exact-input sell with IPX amount `I`:

```text
sell_fee_ipx    = floor(I × s / D)
ipx_swap_input = I − sell_fee_ipx
ipx_burn       = floor(sell_fee_ipx × u / D)
ipx_lock       = floor(sell_fee_ipx × l / D)
ipx_other      = sell_fee_ipx − ipx_burn − ipx_lock
```

Require `0 <= b,s,r,u,l <= D` and `u + l <= D`. Any `ipx_other` destination must be explicit; a policy may allocate all of it to the lock contract as declared rounding residue. Zero levies are permitted for a no-custom-fee policy. Fee checks and transfers must be atomic with swap accounting; failure reverts the trade rather than silently bypassing an advertised levy.

These formulas are an accounting contract for exact-input trades, not a complete AMM implementation. Exact-output needs a reviewed fee-inclusive inversion and ceiling rules that deliver the user's specified output without hidden charges. Do not enable it using the exact-input formulas unchanged.

### 3.3 Reserve meaning and control

Define the Intelligence Reserve as **segregated, non-redeemable PLTR inventory with disclosed custody rules**. IPX holders acquire no beneficial interest, redemption claim, dividend right or guaranteed price support by this specification. “Non-redeemable” concerns holder rights; it does not by itself prevent an administrator from spending the reserve.

Before Model A approval, select exactly one policy:

| Reserve policy | Required disclosures and enforcement |
| --- | --- |
| Permanently retained PLTR | Reviewed custody contract with no discretionary transfer/approval/delegatecall/upgrade path; residual issuer/token restrictions disclosed; no later spending promise |
| Controlled protocol reserve | Named legal owner and administrators, spending purposes and limits, signer threshold, timelock, pause/recovery powers and public movement receipts; never called permanently locked |

There is no default approved owner or reserve-policy choice. Publish wallet/contract identities, source code/bytecode, permissions and custody agreement. Multisig control is not permanent locking. LP shares and PLTR exposed to positions, loans or approvals are disclosed separately from unencumbered inventory.

Reserve accounting, per asset contract:

```text
closing_pltr = opening_pltr + finalized_fee_credits
             + explicitly_approved_other_credits − disclosed_debits
```

Reconcile at a pinned finalized block with direct balance evidence. Publish liabilities, encumbrances, unexplained differences and all movements. Fiat valuation is supplemental, with price source/time and uncertainty; reserve value is not IPX net asset value or backing. A PLTR token may be restricted/frozen by its own rules; a protocol's locked custody cannot remove those external risks.

### 3.4 Burn and permanent lock

Burn means an actual reduction in token `totalSupply`, verified from canonical IPX events/state. Transfer to an inaccessible nonzero address is not reported as supply burn. Permanent lock means IPX remains in total supply but is held in a reviewed contract without recovery, approval, upgrade or other withdrawal escape. Audit all such paths, not merely a long unlock date.

Publish supply categories without overlap: genesis allocation burned, later supply-reducing burns, unburned total supply, permanently locked IPX, time-locked/vested allocations, treasury, LP inventory and other holdings. A token burned out of a previously counted lock is removed from locked inventory before counting the burn. “Circulating supply” needs a separate versioned methodology; subtracting all treasury or LP balances is not automatically valid.

Model A requires new reviewed financial code and integration tests. Existing ERC-20 burn support alone does not implement this model.

## 4. Model B — implemented service-contribution candidate

For one finalized USDG judgment-revenue source on 4663:

```text
G = finalized gross USDG received
C = evidenced infra + data + facilitator + refunds
N = G − C                              (signed, may be negative)
B = floor(max(N, 0) × contribution_bps / 10,000)
```

`B` is a USDG purchase budget. Negative contribution remains visible offchain; the purchase budget is zero. Unknown/incomplete costs must block authorization of distributable contribution. The current cost schema requires amounts and evidence refs but does not independently prove each expense or its completeness. Implement a reviewed accounting procedure, explicit zero-cost attestations, invoices/settlements and periods before production.

The current immutable vault requires funded USDG balance, an authenticated accountant, unique revenue hash, positive output minimum and a deadline no more than 15 minutes away. It executes a V3-style exact-input `USDG → PLTR → IPX` path through the configured router, checks received IPX, clears approval and calls supply-reducing burn. Failed swaps revert reservation state. It does not create pools or validate a price oracle on its own; source USDG revenue proof and cost attribution remain trusted offchain accountant duties.

The ledger maps `SERVICE → REVENUE → CONTRIBUTION → PURCHASE → BURN`, binding finalized merchant transfer, source transaction and receipt hashes. Burn intake checks a finalized vault event and IPX transfer to zero. This accounting graph is distinct from O/J/X/E and cannot change reputation. One source fee cannot fund both the Model B purchase budget and a Model A reserve credit unless a separately approved allocation proves conservation and prevents double attribution.

Production Model B additions required: receipt-to-vault funding reconciliation; all-cost coverage; approved refund liability/holdback policy; actual canonical router/pool verification; manipulation-resistant min-output and slippage rules; transaction simulation plus finality verification; failed/pending execution reporting; independent accountant review and conflict policy. A per-receipt accountant-controlled budget does not establish permissionless economic truth.

Refunds after burn cannot reverse that burn. Define a disclosed holdback/settlement window and responsibility for later refunds before spending net contribution; the current immutable vault does not introduce such a holdback automatically. Never suppress a late refund or loss to preserve a positive contribution number.

## 5. Asset, venue and market verification

Robinhood's current official network table identifies mainnet as 4663, testnet as 46630 and ETH as the native currency. [Network details](https://docs.robinhood.com/chain/add-network-to-wallet/). The official contract page lists canonical USDG as `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` and supplies stock-token identities through its live registry. [Token contracts](https://docs.robinhood.com/chain/contracts/).

The static page fetched in this review did not expose the live PLTR registry row. Repository PLTR literals are therefore **candidates, not newly verified canonical addresses**. Before any deployment, pin the PLTR registry result at a finalized block, verify exact chain/address/bytecode/decimals and relevant transfer/router eligibility, and archive that evidence. A matching ticker is insufficient. This source review does not establish any legal rights attached to a stock token.

Pool verification requires exact currencies, protocol/version, factory or PoolManager, pool address/ID/key, fee configuration, hook/router address and code hash, LP ownership/withdrawal powers, and finalized initialize/deploy evidence. A V3-style router interface cannot be presumed compatible with a v4 pool. Check actual signed/executable quotes in both directions at declared sizes, total fees, slippage and permitted recipients. Simulated lab liquidity or a nominal TVL figure is not live market depth.

Trading hours, token-transfer restrictions, oracle availability and venue behavior must be verified from the actual instrument and live adapters. Do not infer that exchange hours govern every token transfer, or that token tradability means a fresh underlying quote exists. Fail closed on unavailable or contradictory instrument/venue evidence.

## 6. Public economic ledger

Use an economic namespace separate from Receipt Tape learning counts. Publish immutable raw receipts and full parent closure, with pinned-block reconciliation and pagination beyond the current 500-row list limit. Proposed Model A kinds are `TRADE_FEE`, `RESERVE_CREDIT`, `RESERVE_MOVEMENT`, `SUPPLY_BURN`, `PERMANENT_LOCK` and `BALANCE_RECONCILIATION`; these are not implemented by naming them here. Preserve Model B's existing kinds and hashing format.

Every economic receipt must commit: model/policy hash; chain and asset contract/decimals; source transaction and log indices; pool/router/hook identity; atomic amounts; custody source/destination; parent hash; finalized block number/hash; accepted time/sequence; verification method and reviewer where applicable. Include costs, losses, pending settlements, rejected/replayed sources, failed swaps, refund liabilities and coverage gaps.

Minimum public figures:

- Verified segregated PLTR reserve units, encumbered units, unexplained reconciliation difference and pinned block; `null` while unconfigured/unverified.
- Actual genesis and later burned IPX, unburned total supply, verified permanent lock balances, methodology version and finalized evidence.
- Gross/known-cost/net USDG contribution, cost coverage, holdbacks, reserved/unspent purchase budgets and finalized burn amounts.
- Executable IPX/PLTR quote depth in both directions at specified size/slippage, quote age and missing coverage. Keep this independent from reserve balance.
- Current approved policy, operator permissions, deployments, audit artifacts and any paused/failed gate.

Publishing a computed hash does not prove complete source coverage. Signed snapshot manifests, independently witnessed roots and source-to-ledger reconciliation are required for credible recurring reporting. Separate amount budgets from executed purchases and actual burns; never count a contribution receipt as burned IPX.

## 7. Economic validation before rate selection

Do not choose fees by analogy to Artificial Inu or maximize visible reserve/burn growth. Use real venue parameters to model fee-inclusive execution and whether the market remains usable.

Required scenario matrix: shallow and deeper liquidity; normal/low activity; large one-sided flows; repeated buys/sells; alternate-route fee avoidance; MEV/sandwich attempts; stale oracle/closed-market quotes; token freeze/recipient restriction; USDG disruption; gas spikes; accounting loss and late refunds; router failure; LP withdrawal; accountant/signing outage. Publish assumptions and distinguish measured observations from scenarios.

For Model A, measure effective round-trip cost, executable depth, price impact, arbitrage/alternate-pool migration, net reserve inflow, burn/lock amount and LP outcomes. For Model B, measure unit contribution after all relevant costs, refund coverage, execution fees/gas/slippage and whether purchase budget is consumed without impairing operating runway. No market price appreciation assumption may be required for solvency.

Conservation invariants:

1. Finalized fee debits equal credits plus explicitly assigned rounding, per asset; never sum PLTR, USDG and IPX as one unit.
2. No duplicate source transaction/log funds more than its actual amount.
3. Reserved purchases plus liabilities never exceed accessible funded assets.
4. Reported burn equals canonical supply reduction; reported lock equals qualifying held balance.
5. Failed transactions create no reserve/burn credit; unknown states remain pending until reconciled.
6. Unknown cost or verification fields cannot be coerced to zero to authorize allocation.

Rate and liquidity thresholds remain **TBD**. Approval requires a public configuration table with values, measured rationale, acceptable operating limits and review signatures. Passing local contract tests does not satisfy these economic checks.

## 8. Ownership, administration and legal review

Assign a legal owner/custodian for each reserve/operating wallet and an accountable operator for each authority. Review issuer/stock-token terms, transfer eligibility and jurisdictional distribution/marketing requirements against the exact intended participants, venue, contracts and reserve rights. No jurisdiction-specific legal conclusion is made here.

Disclose accountants, reserve controllers, operations recipients, cohort sealers, signer sets, upgrade/timelock/pause powers and incident/refund obligations. Current vault accountant/router/operations fields are immutable: changing them requires a reviewed replacement and explicit migration policy, not an assumed admin rotation. The token artifact itself supplies no holder governance system. Governance is therefore an unresolved design choice, not a community ownership claim.

Independent financial-contract review must cover swaps, custom fees, rounding, custody/locks, bypass paths, funds segregation, replay protection, recipient restrictions, MEV, oracle trust, refund accounting and failure recovery. Legal sign-off must identify what was reviewed, by whom, for which jurisdictions and policy hash; a generic disclaimer cannot substitute for it.

## 9. Approval register and launch gates

| Required decision | Current status |
| --- | --- |
| Model A, Model B, neither, or separately reviewed hybrid | Unapproved; explicit choice required |
| Total supply, six allocations, vesting/custody, cohort terms | TBD; code parameters are not approved economics |
| Canonical PLTR, IPX deployment, venue/pools/router/hook | Requires finalized registry/deployment verification |
| Buy/sell levy, reserve share, burn/lock share | TBD for A |
| Contribution ratio, full-cost/refund/holdback rules | TBD for B; artifact requires explicit constructor value |
| Reserve ownership and permanently retained versus controlled custody | Unresolved for A |
| Permanent lock design, treasury rights, administrative controls | Unresolved |
| Initial liquidity, LP owner/lock/withdrawal rights, execution limits | TBD |
| Legal scope and independent financial audit | Required, not evidenced here |
| Production migration, secrets, monitoring and complete reporting | Unverified |

Gate sequence:

| Gate | Objective evidence needed | Current verdict |
| --- | --- | --- |
| G0 — causal intelligence | One real O/J/X/E/J chain, committed history, independently replayed causal witness; no score contamination | Not established |
| G1 — public proof | Tape export, failed-outcome visibility, snapshot coverage, dedupe, public verification and separate improvement status | Not established |
| G2 — approved economics | Chosen model, signed policy hash, all values/custody/rights and funding conservation; no proposal/deployment ambiguity | Not established |
| G3 — asset and venue | Canonical instrument/eligibility, bytecode/constructor/pool/router proof and funded bidirectional executable market | Not established |
| G4 — security and legal | Independent reviews, resolved material findings, jurisdiction/participant scope and incident/refund policy | Not established |
| G5 — operations | Production migrations and typecheck, keys/custody, restart/reconciliation drills, public monitoring/coverage | Not established; local checks are partial |
| G6 — economic launch | G0–G5 approved against one exact deployment/policy; bounded launch limits and accountable release authorization | HOLD |

No calendar launch deadline is inferred. A mascot, reserve dashboard or locally passing burn test cannot clear G0. One causal revision clears only its scoped technical proof; it does not prove economic sustainability or judgment improvement.

## 10. Public language

Approved strategic direction, contingent on verified facts: **“The Ledger Remembers.”** **“No Receipt. No Trust.”** **“Before an agent spends, it checks Infopunks.”**

Permitted factual statements must identify their evidence: “This evaluated task changed the next judgment”; “This finalized transaction burned this amount”; “This contract holds this PLTR balance at this block.” Avoid “PLTR-backed IPX,” “guaranteed buybacks,” “reserve floor,” “holders own the reserve,” “every trade pays,” “intelligence improved” or “permanent lock” unless the exact claim is independently established and cleared for use.

The Punk makes the evidence loop culturally legible. Public economic graphics must distinguish planned allocation, funded budget, attempted purchase, finalized burn and retained reserve. Keep Genesis 4663 as identity without suggesting that recognition alone grants financial rights.
