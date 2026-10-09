# IPX release qualification addendum — `f6e2019`

Date: 2026-10-09. Source candidate: `f6e201963e0beaed0ec2bcc291fb07c04ca67b7b`, branch `codex/ipx-release-candidate-f6e2019`. The candidate worktree remained unchanged. This qualification addendum is on a separate evidence branch; it does not alter the candidate source SHA.

## Node 24 qualification

Node `v24.21.0` was obtained from the local npm cache with `npm exec --yes --package=node@24.21.0`. The candidate lockfile was installed in the isolated candidate worktree using `npm exec --yes --package=node@24.21.0 -- npm ci --ignore-scripts --no-audit --no-fund`; this added only ignored `node_modules` and did not change tracked files. The following exact commands then ran from the candidate root:

```sh
npm exec --yes --package=node@24.21.0 -- sh -c 'node --version && npm test'
npm exec --yes --package=node@24.21.0 -- sh -c 'node --version && npm run typecheck'
npm exec --yes --package=node@24.21.0 -- sh -c 'node --version && npm run lint'
npm exec --yes --package=node@24.21.0 -- sh -c 'node --version && npm run build'
npm exec --yes --package=node@24.21.0 -- sh -c 'node --version && POSTGRES_RESILIENCE_TEST_URL=postgresql://ahdilm@localhost:5432/ipx_node24_resilience_20261009 npm run test:postgres-resilience'
```

Results: the first no-database full run reported `257` files passed/`11` skipped and `1,874` passed/`22` skipped. For full qualification, created disposable local database `ipx_node24_full_20261009`, supplied it through `CANONICAL_RECEIPT_TEST_URL`, `ECONOMIC_ENGINE_TEST_URL`, and `POSTGRES_RESILIENCE_TEST_URL`, and reran: **268 files passed; 1,896 tests passed, 0 failed, 0 skipped**. The exact command was:

```sh
createdb ipx_node24_full_20261009
npm exec --yes --package=node@24.21.0 -- sh -c 'node --version && CANONICAL_RECEIPT_TEST_URL=postgresql://ahdilm@localhost:5432/ipx_node24_full_20261009 ECONOMIC_ENGINE_TEST_URL=postgresql://ahdilm@localhost:5432/ipx_node24_full_20261009 POSTGRES_RESILIENCE_TEST_URL=postgresql://ahdilm@localhost:5432/ipx_node24_full_20261009 npm test'
dropdb ipx_node24_full_20261009
```

Typecheck, lint, and production build passed. Build warnings remain for Vite config-loader compatibility and the 1.6 MB application chunk. The separate PostgreSQL resilience/failure matrix and readiness suite passed `41/41` tests using disposable local database `ipx_node24_resilience_20261009`, which was dropped after use. No production database was contacted. Logs are in `runs/ipx-f6e2019-node24-2026-10-09/`; `SHA256SUMS` there binds the log bytes. The earlier full lockfile/audit/migration/restore/Foundry bundle remains separately available under `runs/ipx-f6e2019-2026-10-09/` and was checksum-verified from its own directory.

Node 24 closes the Vitest declared-engine mismatch for this candidate. Node 26 was not separately run; Node 24 is the requested supported-runtime qualification. The older Node 25 evidence is not combined with Node 24 counts.

## Render read-only diagnosis and precise recovery request

At `2026-10-09T08:57:42Z–08:57:44Z`, an independent read-only check of `https://radar.infopunks.fun/healthz`, `/readyz`, `/health`, and `https://infopunks-pay-sh-radar.onrender.com/healthz` returned HTTP 503 with `x-render-routing: suspend`; response body SHA-256 was `e5805ccce9532a696c4103997ad9e6d34037dfac71e46dd615641cd7869b3956`. `/v1/ipx/launch` was challenged with HTTP 429 and is not used as service evidence. `render.yaml` identifies service `infopunks-pay-sh-radar`, Dockerfile runtime, public domain `radar.infopunks.fun`, port `10000`, health path `/healthz`.

No Render service ID, operator logs, suspension reason/actor, billing event, deploy SHA, environment state, or attached database identity was available. **Approval request to the service owner/operator:** grant an authorized operator access to the named service and capture its service ID and suspension state/reason, event and billing/limit history, latest build/startup logs, configured/deployed SHA, environment variable names and set/unset states (never values), database identity and latest backup identifier. After diagnosis, request explicit approval to resume this service, or separately to manually deploy one specifically reviewed SHA. No resume, restart, deploy, secret change, or database action has been attempted. Until the cause is known and the owner approves the named operation, C2/G5 remain blocked.

At `2026-10-09T09:16:26Z`, sequential direct GETs were also captured to `runs/ipx-f6e2019-readonly-2026-10-09/`. `/healthz`, `/readyz`, `/health`, and the Render-hostname `/healthz` each returned 503 with the same suspended body SHA above; `/v1/ipx/launch` returned 429 and is excluded as challenge/rate-limit evidence. Raw response headers and bodies plus the response metadata are included and checksummed.

The exact request form was read-only `curl --connect-timeout 10 --max-time 20 -sS -D <name>.headers -o <name>.body -w 'http_code=%{http_code} time_total=%{time_total}\n' <url>` for those five URLs, followed by `shasum -a 256 <name>.body`.

## A6 public witness and manifest publication package

The candidate implements `GET /v1/receipt-spine/tape`, `GET /v1/receipt-spine/attempts`, and `GET /v1/receipt-spine/witness/:j1/:evaluation/:j2`; the offline verifier is `scripts/verify-ipx-causal-witness.ts`. A6's append-only manifest carries `accepted_through`, `free_attempts_through`, and `quarantine_through`; preserve all three when paging/replaying a published snapshot. The bounded verifier supports one designated contributing evaluation and fails closed for wider graphs.

Current Render suspension prevents obtaining a fresh public bundle. The locally generated witness test uses synthetic fixtures, a generated test key, and mocked settlement; it is **not real causal evidence** and is not submitted as a public witness. The eligible publication packet is prepared to contain (1) the raw public witness response and retrieval time/URL, (2) receipt and parent closure, raw executor output bytes and digest, J1/J2 contexts, acceptance positions and signer registry, (3) the same-input-minus-E counterfactual, (4) offline verifier output, (5) a three-boundary tape manifest and full page hashes, (6) external transparency-log inclusion/consistency proof and independent witness signature review, and (7) final packet SHA-256. Do not publish until actual eligible route data exists and the owner approves publication. Current verified real-route/revision/improvement counts remain zero; no synthetic test is relabeled.

## Robinhood Chain 4663 asset and venue qualification

Authoritative Robinhood network docs specify chain ID `4663`, RPC `https://rpc.mainnet.chain.robinhood.com/`, and the Robinhood Blockscout explorer. Robinhood's published contract list names USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` and WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`. Its read-only Stock Token API returned canonical PLTR `0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A`, 18 decimals, multiplier `1`, no pending multiplier; captured `2026-10-09T08:59:29Z`, response SHA-256 `f8c058b28cd8697494ff1c40574014492953fc4594b622601dcf66e6fc1944df`.

Uniswap's official 4663 deployment page lists v4 PoolManager `0x8366a39cc670b4001a1121b8f6a443a643e40951`, Quoter `0x8dc178efb8111bb0973dd9d722ebeff267c98f94`, StateView `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b`, and Universal Router 2.1.2 `0x204FAca1764B154221e35c0d20aBb3c525710498`. These verify published contract identities and integration support, not live deployed bytecode, a PLTR/USDG pool, liquidity, or a quote.

The repo's proposed PLTR/USDG pool row is fixture data (`sqrt_price_x96=1`, active liquidity `1`, old block `52,406,504`) and cannot qualify as live pool evidence. RPC and Blockscout read requests returned HTTP 403 in the available environment, preventing chain ID/code/state/log/quote checks. The only facilitator endpoint returning 200 self-advertised `exact-permit2-v2` for `eip155:4663`/USDG; that does not prove compatibility with this candidate's standard exact/EIP-3009 path. A second advertised endpoint returned 403. No payment was submitted.

To finish G3 when read access is available, at one named block verify `eth_chainId=0x1237`, token metadata, PoolManager bytecode and the pool's `Initialize` event; reconstruct the PoolKey and pool ID; read StateView `slot0`/liquidity; execute `eth_call` to the published Quoter for bounded exact-input swaps USDG→PLTR and PLTR→USDG; preserve block number/hash/time, calldata/return values, gas and depth/slippage; then independently check the configured facilitator's scheme/asset/chain and staged verify/settle behavior with no production funds. G3 remains blocked on those observations and independent facilitator/security approval.

Primary source references: [Robinhood network configuration](https://docs.robinhood.com/chain/add-network-to-wallet/), [Robinhood contract list](https://docs.robinhood.com/chain/contracts/), [Robinhood Stock Token API](https://docs.robinhood.com/chain/stock-token-apis/), [Uniswap v4 deployments](https://developers.uniswap.org/docs/protocols/v4/deployments), [Uniswap supported chains](https://developers.uniswap.org/docs/trading/swapping-api/supported-chains).

## Independent review packets (not approvals)

All reviewers must cite source SHA `f6e201963e0beaed0ec2bcc291fb07c04ca67b7b`, and later bind their conclusions to the owner-selected policy hash and an identified deployment/finalized block. Current evidence manifest has `policy_hash=null` and `deployment_id=null`. No independent review is represented as complete.

- **Security / smart-contract reviewer:** inspect exact source/build and deployed bytecode; accountant authority and token/router trust; pool quote, slippage, deadline, allowance, reentrancy and rounding; burn/lock/custody and upgrade escape; receipt authentication, replay and idempotency; migrations and app DB role; route auth, secrets, dependency SBOM and reproducible build provenance. Deliver dated signed findings, threat model, role roster, tests, bytecode/source match, advisory disposition and closure evidence.
- **Accounting reviewer/controller:** reconcile unique finalized USDG source receipts to service revenue, costs, refunds/chargebacks, holdbacks/liabilities, purchases, PLTR/IPX units and canonical burns at one as-of block/cursor. Check supporting cost documents and reviewer authority; prove conservation and no double allocation across A/B/hybrid. Deliver opening/closing balances, journal/receipt lineage, exception report, reviewed assumptions and signed reconciliation. Current D2 scenarios are hypothetical; no operating cost or live ledger proof exists.
- **Legal counsel:** determine jurisdictions, participant/geographic scope, token/service/revenue/burn/reserve characterization, consumer/refund duties, AML/sanctions/tax/accounting allocation, custody/control and signer powers, enforceability, privacy/retention and D5 marketing disclosures. Deliver dated signed memo that identifies chosen policy hash and permitted deployment, approved terms/disclosures and named approval authority. Model and scope are unselected.

## D1/D2 owner decision packet

Owner must explicitly select **Model A**, **Model B**, **neither**, or a fully specified **hybrid**. No default is implied.

| Choice | Economic path | Exact owner decisions needed before implementation/activation |
| --- | --- | --- |
| A | Venue buy levy credited to a PLTR reserve; venue sell levy funds IPX burn/lock | Select compatible venue and covered pools/paths; exact levy BPS and recipients; bypass treatment; reserve owner, signer/debit rights and lock design; supply/allocation/claim terms; legal scope and incident authority. |
| B | Positive USDG service contribution funds a PLTR purchase and IPX burn | Contribution BPS; cost/refund/holdback ordering; USDG source and custody; quote/slippage/size limits; facilitator and router; approved accountancy basis; purchase/burn cadence and limits. |
| Neither | Ship/operate intelligence product without activating a token economy | Explicitly approve non-economic scope and prohibit reserve, backing, burn, or trade-fee claims absent later approval. |
| Hybrid | A/B combined under separately allocated atomic flows | Define source-level split so each USDG unit is assigned once; all A/B terms above; reconcile shared costs and prove no duplicate contribution/burn/reserve credit. |

For the chosen option, the owner must sign policy version/hash, assets/chain/deployment, exact rates and recipients, total supply and six allocation rights, all-cost/refund/holdback treatment, custody/legal owner, signer/debit/upgrade/incident powers, measurement method and operating limits. The selection does not itself authorize deployment or movement of funds. D3 depends on a reviewed A selection; D4 on a reviewed B selection; D5 on a source-complete public ledger plus accounting/legal/security closure.

## Dependencies and final determination

The release dependency register explicitly retains B3/B4, C6, and D5. B3 still lacks finalized live USDG settlement, reviewed cost evidence and dedupe/retry proof. B4 lacks a complete externally verifiable issuance manifest and finalized deployed getters/bytecode. C6 remains gated on B approval, verified deployment and separately approved bounded real paid-route testing. D5 is blocked on owner model/policy, reconciled source-complete ledger, legal disclosure scope and public roots.

G0/G1 remain blocked on real causal route, external witness/tape publication and observed improvement. G2 lacks signed economic policy. G3 lacks live pool/quote/facilitator verification. G4 lacks independent security/accounting/legal conclusions. G5 lacks Render cause and approved recovery, deployment identity, restricted DB-role proof and staging/recovery approval. Therefore **G6 is BLOCKED**; there is no single policy/deployment-qualified G0–G5 set.

No production action, service resume, contract deployment, production signing, real transfer, economic activation, or public release was performed.
