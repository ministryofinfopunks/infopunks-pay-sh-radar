# RH-chain spend preflight v1

`POST /v1/rh-chain/preflight` assembles the existing Reflexive registry, verified
PAIR V5 pools, locked-position accounting, Clone Radar review memory, Blockscout
and Attention Quality into one deterministic policy result. It does not execute
a transaction. `/v1/radar/preflight` retains its service/provider-route meaning.

```json
{
  "subject": {
    "kind": "contract",
    "chain_id": 4663,
    "address": "0x1111111111111111111111111111111111111111"
  },
  "action": { "kind": "swap", "amount_usd": 250 }
}
```

The address above is illustrative. Use an exact token contract. For a pool, use
`subject.kind: "pool"` and a 20-byte pool address or 32-byte V4 PoolId. Contract
requests with multiple tracked markets require an explicit `pool` property.
Unknown architectures or pools return a blocked decision rather than guessed
verification. A pool request assesses its tracked mission token and canonical
stock quote. Contract requests assess the specified token in the selected market.

Successful responses use `{ "data": ... }` and include `decision`, reason codes,
identity, scoped liquidity/lock status, holder concentration, activity integrity,
source failures, policy thresholds, and a receipt URL. Malformed input returns
400, rate-limited requests 429, and receipt-storage failures 503. A source outage
can produce a blocked receipt if receipt storage remains available.

`GET /v1/rh-chain/assets/PLTR` resolves RHJ chain-4663 identity and attaches
review-memory lookalikes. It distinguishes `VERIFIED_CANONICAL`, stale identity,
inactive assets, ambiguous deployments, unavailable registry and absent ticker.
Canonical identity alone does not establish spend eligibility.

## Policy and scope

- Pool/quote/position evidence must be no older than 15 minutes. Missing,
  malformed, or future timestamps fail the freshness check.
- Pool verification must already be independently verified. Locked-position
  identity, core-state proof and inventory must reference the same position and
  block. Lock status applies only to that tracked position, not every LP.
- Holder concentration uses integer raw balances divided by raw total supply.
  No LP, contract, treasury, or burn-address exclusions are guessed. A complete
  first page requires holder-count and total-supply reconciliation. Otherwise
  percentages are sample lower bounds and spend is blocked. This deliberately
  limits v1 to distributions that fit the provider page; larger distributions
  need a paginated, block-consistent collector before they can pass this gate.
- Top-ten ownership at 50% blocks; at 25% it degrades. These are conservative
  versioned policy thresholds, not calibrated predictions or investment advice.
- Spend/observed-liquidity ratios at 10% block and at 1% degrade. The ratio is a
  coarse policy check, not an executable quote or slippage calculation.
- Measurable Attention Quality below 35 blocks and below 55 degrades. Missing
  persistence evidence degrades. It must match the selected pool and contract.
- Clone warnings remain review cues. They block pending review without asserting
  misconduct. No warning does not mean exhaustive clone detection.

## Activity integrity

Activity v1 is explicitly `SAMPLE_ONLY` or `UNAVAILABLE`, never a wash score.
It uses exact-contract transfer logs in the last 24 hours, rejects undated or
future records, excludes mint/burn events, and deduplicates transaction/log IDs.

| Field | Definition |
| --- | --- |
| wallet_concentration | Largest wallet endpoint count / all transfer endpoints |
| counterparty_concentration | Largest unordered address-pair count / sample transfers |
| round_trip_intensity | Fraction of sample transfers whose reverse direction also appears; does not imply matched value or an economic round trip |
| burstiness | Largest UTC-hour transfer count / sample transfers |
| organic_persistence | Existing measurable Attention Quality score, not a new wash estimate |
| promotion_dependence | Existing boost/order components with original caveats and direction |
| volume_to_liquidity | Selected market's reported 24h volume / observed liquidity |

**V1 withholds `CLEAR` because complete swap-level activity coverage is absent.**
Its strongest result is `SIZE_SMALL`, meaning policy degradation; it supplies no
calculated safe size. `DO_NOT_SPEND` takes precedence over every degradation.
`CLEAR` is reserved for a future methodology with sufficient activity evidence.
Blockscout may return cached records under its configured TTL. Collection time
does not establish an on-chain observation block or synchronized supply snapshot.

## Receipts and deployment

Both operations produce append-only machine receipts. Retrieve the exact result
and evidence at `GET /v1/rh-chain/preflight/receipts/:id`. These use the existing
SHA-256/versioned-receipt approach in a separate machine-record namespace; they
do not publish or bypass approval of human-reviewed project claims.

To verify a receipt, remove only `receipt_id` and `integrity_hash`, recursively
sort object keys in code-point order, preserve array order, serialize compact
JSON, and hash UTF-8 bytes with SHA-256. The digest must equal both the suffix of
`receipt_id` and the suffix of `integrity_hash`. The hash binds the policy result
to the evidence; it does not authenticate upstream truth. Re-evaluation creates
a new receipt, leaving old evidence unchanged.

PostgreSQL uses `rh_chain_spend_receipts` with insert-on-conflict-do-nothing.
The migration is `20260917_011_rh_chain_spend_receipts.up.sql`; runtime follows
the repository's retryable schema-initialization pattern. Memory fallback
explicitly returns `receipt_durable: false` and loses records on restart.
Production requires the configured RH-chain PostgreSQL store for durable memory.

The public root and `/health` returned HTTP 503 with “This service has been
suspended” during the 2026-09-17 check. Hosting must be restored separately;
these local changes are not a deployment or launch-live claim.

Remaining launch work: full holder pagination with consistent observation
blocks, attributable swap/activity coverage, a compact wallet-facing UI, x402
metering if required, and any Chainlink reference-price integration. These are
not represented as completed by the preflight response.
