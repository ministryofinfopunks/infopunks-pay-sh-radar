# RH USDG settlement, receipts, attribution and revenue

This milestone extends the existing official x402 exact EVM gateway and execution-proof intake to Robinhood Chain USDG. It adds finalized settlement-backed revenue, append-only recorded costs and reconstructable attribution. It preserves Base USDC, canonical decisions and historical signed receipts.

## Verified identities

Robinhood's [network documentation](https://docs.robinhood.com/chain/add-network-to-wallet/) identifies mainnet as chain ID **4663**. Its [canonical token registry](https://docs.robinhood.com/chain/contracts/) identifies USDG at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. [Paxos' contract repository](https://github.com/paxosglobal/usdg-contract) documents EIP-3009 delegated transfers.

Read-only mainnet RPC checks during implementation confirmed chain ID 4663, token name `Global Dollar`, symbol `USDG`, six decimals and a domain separator matching version `1` on this chain/contract. Startup repeats the identity/domain checks for enabled RH billing; a mismatch fails closed. This is token metadata verification, not a successful live payment or facilitator capability proof.

## Configure and deploy

- `JUDGMENT_NETWORK=eip155:4663` selects RH USDG billing. Omitting it retains Base USDC.
- `JUDGMENT_RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com/` supplies read-only identity, execution and revenue verification.
- `JUDGMENT_PRICE=0.01` sets the judgment price in the selected stablecoin. The old `JUDGMENT_PRICE_USDC` remains a compatibility fallback.
- Configure the existing `JUDGMENT_FACILITATOR_URL`, `JUDGMENT_PAY_TO`, `JUDGMENT_RESOURCE_URL`, signing keys and PostgreSQL before setting `JUDGMENT_PAYMENT_ENABLED=true`.

The official x402 server must find facilitator-advertised V2 `exact` support for `eip155:4663`; it rejects unsupported facilitators. EIP-712 name/version metadata comes from the validated canonical USDG deployment. No wallet private key or payment broadcasting implementation is added to Radar; the facilitator performs the authorized settlement.

Apply `20261008_016_rh_usdg_accounting.up.sql` through the existing external migration workflow after canonical receipts, judgment requests and execution-proof uniqueness migrations. The migration broadens single-use execution constraints to RH and adds append-only revenue/cost tables. Startup inspects RH index predicates, not merely index names. Use an application role without table-owner/superuser privileges. Code/traffic rollback must retain these durable records.

## Billing versus execution

A paid JudgmentReceipt now commits to `payment.network`, `asset`, canonical `token`, `amount_atomic`, merchant `pay_to`, nullable facilitator-reported `payer` and `verification=facilitator_attested`. Its content hash and issuer signature cover this metadata. Insufficient evidence stays free. Internal receipt intake cannot import payment descriptors or paid judgments. Historical receipts lacking this metadata replay unchanged and cannot silently become recognized revenue.

`PAYMENT-RESPONSE` means the configured facilitator attested to payment settlement. It does not claim Ethereum finality. Robinhood distinguishes [soft confirmation, batch posting and Ethereum finality](https://docs.robinhood.com/chain/transaction-finality/). This implementation recognizes revenue only when the configured RPC's `finalized` block covers the transfer; RPC correctness remains part of the operator's trust boundary.

RH external execution requires reviewed `execution.profile=rh_usdg_external.v1`, the exact provider request hash, authorized payer/signer and provider recipient. Submit `rh-usdg` or `x402-rh` with `cost.asset=USDG` to `/v1/execute-proof`. The complete payload requires an EIP-191 signer signature. Chain verification checks the network, successful transaction, canonical block hash, finalized coverage, canonical token, exact sender/recipient/amount and transfer time inside the judgment window. Removed, mismatched and duplicated logs cannot inflate payment. A judgment-fee transaction cannot stand in for the separate provider execution purchase. Hashes/status remain signed execution claims, not independent proof of output correctness.

Finality may arrive after a short judgment window ends. Execution evidence can be submitted later, but the actual transfer and executed-at claims must fall within that original window. An expired receipt never authorizes a new action.

## Real revenue and costs

`POST /internal/economics/reconcile/:judgmentId` requires the canonical admin bearer token. It matches the signed paid judgment against the completed durable payment journal and configured merchant, then independently verifies the finalized token transfer. A pending-finality payment returns `409 settlement_pending_finality` without recording revenue. Other verification/storage failures cannot manufacture recognized revenue. Reconciliation never broadcasts or repeats payment; repeating it yields one identical revenue receipt.

`POST /internal/economics/costs` records admin-attested infrastructure/reviewer/operations costs using integer atomic units and nonempty evidence references. Include a stable `cost_id`, network/asset, `amount_atomic`, nullable `judgment_id`, `incurred_at` and `evidence_refs`. Conflicting reuse of an ID is rejected. Evidence references must not contain credentials or private invoice data; the ledger is public. Cost entries are operator attestations, not automatically verified vendor invoices.

`GET /v1/economics/revenue` exposes the real ledger and separate per-asset totals. Templates are excluded. Gross revenue minus **recorded** costs is labeled accordingly: cost coverage is partial and distributable surplus remains null. USDG and USDC are not converted or combined into an assumed dollar balance. Reserve sufficiency, refunds, treasury allocations, buybacks and burns are not inferred or automated.

The Revenue Receipts page displays this ledger above illustrative work templates and allocations. Reconciliation is currently an explicit operator action; no background finality worker is enabled. Operators must reconcile completed payments once finalized.

## Attribution

`GET /v1/attribution` reconstructs each Observation → Judgment → Execution → Evaluation chain, validates ancestry and exposes missing execution/evaluation coverage. It returns policy-version outcome counts, UTC daily evaluation counts and a deterministic report hash. `false_allow` counts come only from explicit reviewed evaluation labels; failed execution alone is not automatically a false allow. False-block rate stays null because blocking an action prevents an ordinary execution/evaluation chain; independently reviewed counterfactual evidence is required. Outcome trends are descriptive measurements, not causal proof of drift.

## Validation and launch limits

Local tests use an explicitly mocked facilitator and disposable PostgreSQL schemas to exercise RH challenges, signed billing metadata, exact finalized transfers, wrong-chain/token rejection, full receipt attribution, immutable revenue/cost storage and replay without another charge. Read-only mainnet metadata verification does not establish live x402 settlement, production migrations, backups, RPC finality correctness or deployed signing-key configuration.

Before paid RH traffic, verify the selected facilitator supports RH USDG, perform an authorized live payment with a funded payer, verify its signed judgment, wait for finality, reconcile revenue and verify restart/replay. No funded wallet transaction or production deployment is performed in this workspace task.
