# Canonical pre-spend judgments and x402 V2

`POST /v1/pre-spend/check` remains the boundary. Canonical fields are at the top level; `data` retains the original legacy response and adds `canonical_judgment`. The SDK continues to parse legacy responses and exports the canonical types. Legacy confidence, readiness and ALLOW/DEGRADE/BLOCK annotations are diagnostic, not authorization. Execution consumers must inspect the canonical receipt and its expiry.

## Decision adapter

After all evidence gates pass:

| Legacy policy state | Canonical mapping |
| --- | --- |
| approved | proceed, subject to confidence threshold and no veto |
| approved_with_warning | test_spend_first only with explicit bounded policy; otherwise insufficient_evidence |
| use_with_caution | test_spend_first only with explicit bounded policy; otherwise insufficient_evidence |
| requires_human_approval | insufficient_evidence |
| do_not_use | do_not_spend when sufficient reviewed negative evidence supports it |
| unknown | insufficient_evidence |

The deterministic legacy engine remains intact. Since Phase 1 intentionally prevents it from approving community intake, reviewed policy facts may resolve its caution state using the same existing vocabulary. Human-approval requirements, known blockers and deterministic vetoes cannot be bypassed. A legacy negative state with reviewed positive facts returns insufficient evidence rather than charging for an unsupported negative conclusion.

## Evidence and receipt contract

Only admin-reviewed `reviewed_judgment_facts` observations with live provenance are eligible. Their payload must validate against `JudgmentFactsSchema`. Identity, catalog, required proof (including required holder/activity coverage), intent and constraints must all be established; the observation scope binds the complete parsed request hash, subject and selected route. Confidence is the minimum across cited policies. Missing/fixture/stale/disputed/mismatched proof fails closed. Reviewed facts are not accepted in public check requests. No expensive on-demand ingestion or unrelated analytics runs here.

Every paid judgment has policy-configured issuance/expiry, bounded by the earliest cited observation expiry. `JUDGMENT_TTL_MS` defaults to 60 seconds. Expired receipts remain historical evidence and cannot authorize execution.

Insufficient evidence returns 200, `payment_required=false`, exact `cost.amount="0"` and `receipt=null`. No authoritative receipt is invented when there are no observation parents; the Phase 1 schema requires real parents. A stable diagnostic judgment ID is returned but is not an execution authorization.

## Payment protocol and deployment

Official x402 Foundation packages `@x402/core` and `@x402/evm` 2.28.0 supply the V2 payload codecs, resource server, exact EVM requirements and HTTP facilitator verification/settlement. See https://github.com/x402-foundation/x402. No proprietary payment verification or simulated production settlement is provided.

Base mainnet USDC (`eip155:8453`, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) is the only configured code path. Solana is explicitly unsupported. No live settlement rail has been verified in this workspace; integration tests use an explicit test facilitator. Payments default to disabled. Enabling requires PostgreSQL, migration `20261007_012_judgment_requests.up.sql`, facilitator URL, Base recipient and resource URL. Startup fetches facilitator capabilities and rejects unsupported Base V2 exact settlement. The operator must supply an operational facilitator; mainnet funding, credentials and live settlement were not inferred or simulated.

Unpaid sufficient requests return 402 and standard base64 `PAYMENT-REQUIRED`. The paid retry decodes `PAYMENT-SIGNATURE`, matches its accepted requirements, invokes official facilitator verification, reserves the payment, then settles. Only successful settlement publishes a paid JudgmentReceipt and `PAYMENT-RESPONSE`. The protected internal receipt writer rejects paid flags/references/charges; paid receipts cannot be imported through that route. Its existing reviewed free-judgment authority remains available. Signatures are neither stored nor logged; only canonical payment hashes are persisted.

## Idempotency and failure recovery

`Idempotency-Key` accepts a bounded stable string, scoped by agent. When omitted it is derived from the complete parsed request and returned in a response header. Same key/different request returns 409. Quotes freeze policy, observations, times and price. A durable compare-and-set admits one settlement attempt; a unique payment hash prevents reuse across keys. A unique settlement reference prevents one settlement from authoring two judgments. Receipt IDs and hashes remain stable on replay and after process restart.

Journal states are `quoted`, `settling`, `settled`, `complete`. An uncertain network/settlement failure stays `settling` and returns `payment_pending_reconciliation` on retries. It requires operational reconciliation; it never automatically resubmits a potentially successful settlement. A recorded `settled` result can recover receipt publication without charging again. Journal metadata must be protected with application DB privileges; it is operational mutable state, separate from append-only receipts.

## Limits and timing

Reuses the existing Fastify route limiter at 30 judgment requests/IP/minute, below public read limits. Body size is 16 KiB, payment header size 16 KiB, idempotency key at most 128 characters. Browser CORS permits and exposes the standard payment headers. `Server-Timing` measures route duration; structured `judgment_hot_path_timing` separates local processing from facilitator calls. PostgreSQL observation scope reads use a matching index and the latest materialized scoped policy. Historical snapshots are superseded; the latest negative/stale state is never skipped in search of an older approval. The service also supports validating multiple supplied policy observations, using their minimum confidence and earliest expiry. No judgment changes reputation.

Local timing samples are saved in `output/phase2-judgment-performance.json`. They measure the memory adapter with a test facilitator and do not establish a production PostgreSQL p95 or live network latency.
