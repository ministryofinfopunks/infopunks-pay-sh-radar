# IPX launch protocol v2

8 October 2026. Protocol invariants below are fixed for this implementation. Economic quantities and deployment addresses remain pending the user's terms and verified deployment. No example amount is a launch allocation.

## Genesis and historical memory

The historical first-4,663-wallet Genesis registry and CALL v1 receipts keep their original policy, bytes, signatures and hashes. They are not rewritten to add token promises.

A separate `ipx.genesis.call.v2` cohort admits 4,663 verified signed calls from 4,663 distinct EVM wallets, with one economically entitled call per wallet across the cohort. Daily windows remain fixed UTC half-open intervals; the overall campaign has separately configured opening and closing times. This one-call-per-wallet rule is an implementation choice that prevents one wallet taking several economic slots; it does not solve Sybil resistance.

The policy commits all six allocation recipients, cohort sealer, accountant, operations recipient, router and route fees; verified deployment must match them at one finalized block. V2 signs RFC 8785 JCS JSON containing chain ID 4663, token/distributor addresses, Constitution hash, complete launch-policy hash, signer, judgment, confidence, evidence digest and window boundaries. Economic entitlement is a fixed IPX allocation, not yield, PLTR backing or a stock ownership/redemption claim. Entitlement equals the call bucket divided by 4,663; integer remainder goes to the final ordinal. The distribution contract is fully funded from fixed supply, cannot mint and seals one root only. Admission ordinals are assigned transactionally in acceptance order. A complete cohort is reverified before its SHA-256 entitlement commitment is prepared.

The Genesis wallet allocation is a separate explicit policy input. This implementation does not silently attach it to legacy recognition records; its claim terms and recipients must be agreed before deployment. Existing v1 recognition alone continues to grant no economic entitlement.

Solana identity association requires both the EVM and Solana wallets to sign the same expiring, nonce-bearing JCS identity message. Mapping is one-to-one within the policy, append-only, and moves no circulating tokens.

## Token and birth record

IPX is a fixed-supply ERC-20 native to 4663 with 18 decimals. Constructor allocations sum exactly to initial supply: Genesis wallets, Genesis calls, treasury, liquidity, ecosystem and burned. Initial burned allocation reduces actual total supply. There is no public mint function, owner transfer control, blacklist, tax, proxy, staking, referral emission or mandatory IPX gas mechanism.

The token records immutable Constitution SHA-256, allocation hash, chain/deployment event, genesis block number, timestamp and initial supply. Cohort sealing is a separate later event and cannot replace those birth fields. After sealing, `IPXGenesisCertificate` binds the original birth metadata and allocation hash to the canonical distributor and cohort root. The sealer remains a trusted cohort authority; the certificate does not independently prove human uniqueness. The allocation hash is SHA-256 of Solidity ABI-encoded recipient and amount arrays; it is not represented as a JCS hash. Deployed bytecode, constructor arguments and certificate events must be independently checked against reviewed build artifacts.

## Payment, contribution and burn

New paid judgments use canonical USDG on 4663. Existing Base paid receipts remain readable/replayable. A configured facilitator must advertise x402 V2 exact support for 4663. The server verifies canonical USDG name, symbol, decimals and EIP-712 domain separator; an unsupported rail fails closed. A paid assessment never guarantees approval.

Service and revenue receipts derive from the existing signed judgment/payment journal and finalized merchant transfer verifier. Contribution is gross USDG minus evidenced infrastructure, data, facilitator and refund costs. Arithmetic uses atomic integer amounts. Negative contribution is retained in the offchain receipt; its purchase budget is zero. Purchases receive a configured basis-point portion of positive contribution.

The onchain contribution vault has immutable accountant, operations recipient, USDG, IPX, PLTR, router, route fees and burn ratio. It explicitly trusts the accountant's cost attribution. Balance checks prevent reserving unfunded revenue; source-receipt hashes cannot be reused. The implemented executor adapter uses an exact-input USDG → PLTR → IPX route through a configured router implementing the specified V3-style interface. This is an adapter implementation, not evidence that a compatible router or those pools are deployed. Venue selection and actual pool creation remain deployment gates.

Execution requires a positive minimum IPX output and a short deadline. Failed swaps revert state; successful received IPX is burned through the token's supply-reducing burn. Allowances are cleared. Burn receipts require finalized ancestry and the configured minimum confirmation depth, then bind vault events and IPX transfers to zero back through purchase/contribution/revenue/service ancestry to the original USDG transaction. Successful RPC simulation alone cannot create those receipts.

## Market evidence

PLTR is a quote asset, not backing. Executable PLTR Market-Hours integrates the smaller of measured buy/sell PLTR depth at a fixed slippage budget. Samples must agree on pool, PLTR identity, chain and slippage. Coverage stops at expiry or the maximum permitted sampling gap; unavailable periods are reported as gaps. Nominal liquidity, inventory and raw volume cannot substitute for executable quotes.

The Solana adapter captures targeted finalized transaction telemetry with durable pagination, duplicate protection and missing-history failure. It does not label raw transactions as verified DEX volume, social PRINTs or wash-trading verdicts. Those require configured addresses, semantic decoders, reviewed social sources and cross-venue identity/time/price normalization.

## Unresolved economic inputs

The following are required, not inferred from lab examples: total supply; all six allocation amounts and custody/vesting recipients; wallet-cohort claim terms; buy/burn basis points; campaign dates; canonical PLTR contract; deployed token/distributor/vault addresses; cohort sealer/accountant/operations authorities; venue/router/pools/fees; reviewed slippage/minimum-output policy; Solana watch addresses and social source adapters.

Until those inputs and deployed evidence exist, the launch endpoint reports awaiting configuration and economic CALL acceptance remains disabled. No funds were spent, contracts deployed, public campaign activated, or production schema migrated by this implementation.

Sources: [Robinhood network details](https://docs.robinhood.com/chain/add-network-to-wallet/), [canonical token contracts](https://docs.robinhood.com/chain/contracts/), [JCS specification](https://www.rfc-editor.org/rfc/rfc8785), [Nasdaq 2026 calendar](https://www.nasdaqtrader.com/Trader.aspx?id=Calendar).
