# RH read-only qualification

**Decision:** **NO ROUTE ACTIVATION.** Current work qualifies several public upstream sources as reachable during a direct, read-only source probe, but does not qualify an existing Radar route end-to-end as current, bounded, database-independent functionality. No source code, route allowlist, test, migration or production setting was changed. No application tests or database-availability simulation was run; the owner requested the activation and full qualification run remain a later authorization decision.

## Direct source observations

Probe timestamp: `2026-11-12T14:33:33Z` (UTC). Requests were direct HTTPS GETs except the two harmless JSON-RPC `eth_chainId` and `eth_blockNumber` reads. Each request used an 8–12 second client timeout. Captured excerpts below are actual responses, not fixtures. Provider response bodies were not substituted for application responses.

| Source | Result | Identity/data observed | Timestamp/freshness limit |
|---|---|---|---|
| Robinhood official mainnet JSON-RPC, `https://rpc.mainnet.chain.robinhood.com` | `eth_chainId`: HTTP 200, `0x1237`; `eth_blockNumber`: HTTP 200, `0x6b625bd` | Hex chain ID `0x1237` = decimal 4663. Both responses returned in 0.43s and 0.38s in this probe. | RPC response is current at fetch; no block timestamp was requested. Existing app has no public RH network-status route backed by these JSON-RPC calls. This is source identity evidence, not route qualification. |
| DefiLlama `https://api.llama.fi/v2/chains` | HTTP 200, 58,098 bytes, 1.25s | Matching row: `name=Robinhood Chain`, `chainId=4663`, `tvl=1053134842.0788045` (USD implied by provider contract/code). | No source observation timestamp in row. Value is a successful fetch-time provider response; do not call it timestamped current TVL. |
| DefiLlama `https://api.llama.fi/overview/fees/Robinhood?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true` | HTTP 200, 807,885 bytes, 1.75s | `chain=Robinhood Chain`, `total24h=1199862.53`; response includes `allChains` and protocol breakdown. | No source observation timestamp in response. Exact window boundary is not exposed in this response. Not a proven 24-hour current value for public display without freshness convention. |
| DexScreener `https://api.dexscreener.com/latest/dex/search?q=robinhood` | HTTP 200, 27,850 bytes, 0.45s | 30 total result pairs; Robinhood-tagged examples include pair `0x7f8271c1a7a6a434f33b0babc15bf2980a0dcb4196848b4f7e789a7fd73a5350`, base `0x008Df4b3E857D06c4603Aeb11F267ccD32ce2005`, `chainId=robinhood`, h24 volume `$5,530.28`, liquidity `$83,993.24`, 35 buys + 35 sells in the response. | Provider has no observation timestamp. `pairCreatedAt` is pair creation, not observation. Search is not guaranteed comprehensive; it is not a chain-wide DEX statistic. |
| DexScreener token-pairs `/token-pairs/v1/robinhood/0x008Df4b3E857D06c4603Aeb11F267ccD32ce2005` | HTTP 200, 1,362 bytes, 3.10s | One exact contract result; `chainId=robinhood`; h24 volume `$5,530.28`, h24 txns 35 buys / 35 sells. | No reliable source observation timestamp; direct response establishes the provider returned it during the probe only. |
| DexScreener orders `/orders/v1/robinhood/0x008Df4b3E857D06c4603Aeb11F267ccD32ce2005` and latest boosts `/token-boosts/latest/v1` | Both HTTP 200; 1,130 and 21,263 bytes; 1.37s and 0.49s | Orders object and boosts array returned. The orders payload contained old payment timestamps and the latest boosts response was mixed-chain, requiring exact `chainId=robinhood` filtering. | `paymentTimestamp` is order-event time; fetch time is not an observation timestamp. Boost list requires chain filtering. |
| DefiLlama `https://stablecoins.llama.fi/stablecoinchains` | HTTP 000 / DNS resolution timeout after 12.00s | No response. | Unverified/unavailable in this probe. |
| Blockscout `https://robinhoodchain.blockscout.com/api/v2/stats/charts/transactions` | HTTP 403, 5,569-byte response, 0.33s | Provider access denied/challenge response; no transaction series parsed. | No current transaction statistics qualified. |

The direct official network RPC source and network identity are supported by Robinhood's own [connection docs](https://docs.robinhood.com/chain/connecting/) and [wallet network settings](https://docs.robinhood.com/chain/add-network-to-wallet/). The 4663 ID was independently checked by the RPC response above. Web docs identify the public endpoint; the actual JSON-RPC bodies are recorded here.

### Source response excerpts

```json
{"jsonrpc":"2.0","id":1,"result":"0x1237"}
{"jsonrpc":"2.0","id":2,"result":"0x6b625bd"}
```

```json
{"name":"Robinhood Chain","chainId":4663,"tvl":1053134842.0788045}
```

```json
{"chainId":"robinhood","pairAddress":"0x7f8271c1a7a6a434f33b0babc15bf2980a0dcb4196848b4f7e789a7fd73a5350","baseToken":{"address":"0x008Df4b3E857D06c4603Aeb11F267ccD32ce2005","name":"Robinhood","symbol":"ROBINHOOD"},"volume":{"h24":5530.28},"liquidity":{"usd":83993.24},"txns":{"h24":{"buys":35,"sells":35}}
```

The DexScreener result is one asset/pair context, not an aggregate chain statistic. Do not add it to chain totals or describe the search response as an exhaustive market census.

## Existing route qualification

No existing route passes all requested gates at once:

- The RPC source can verify chain ID and head block, but the existing repository has no RH RPC-backed public network-status route. Adding one would be new route/service functionality, outside this existing-implementation qualification.
- DefiLlama live snapshot calls are real, but normal wiring creates `RhChainLiveSnapshotService` with `databasePool` and `databaseUrl`; its default cache therefore uses PostgreSQL and performs reads, schema ensure, and writes. It can be built with `InMemoryRhChainSnapshotCache`, but the frontdoor branch does not construct RH services or register RH routes. Also DefiLlama's timestamp is absent and the current snapshot mixes RH chain data with global CoinGecko meme-market data.
- The existing market token handler calls a DEX provider whose response cache is in-process and whose provider calls are bounded. In normal app wiring, however, `RhChainMarketDataService.classificationFor` reads the RH submission store. Its market response stamps local `capturedAt`/fetch times and has no authoritative provider observation timestamp. The route has no independent total request budget.
- The Blockscout-based daily transaction observation implementation accepts only date-matched provider chart rows whose provider tip passes a finality guard, then persists the final observation. Its public observations route reads the persistence store. This is an archive projection, not a no-write live read; current direct provider access returned HTTP 403.
- Existing `/v1/rh-chain/market/provider-status` performs a live DEX boost request but exposes provider/status context, not genuine network health or verified chain-wide statistics. Its no-DB property is service-local; the frontdoor app has no isolated RH service instance/allowlist for it.
- Provider/catalog reads `/v1/providers`, `/v1/endpoints`, `/v1/routes` are part of the normal store/catalog graph and remain blocked by frontdoor mode.

## Safe candidate and proposed isolated activation (not applied)

The closest existing implementation candidate is `GET /v1/rh-chain/market/tokens/:contract`, backed by `RhChainMarketDataService.getToken()` and `DexScreenerProvider`. It can use external DEX pair/order/boost endpoints, in-process cache only, and an implicit `review_required` classification when the optional `classificationFor` callback is omitted. The direct upstream paths succeeded above for the checked contract, but no application-route run or stale-timestamp contract has been demonstrated. Therefore it is **conditional, not PASS**, and no activation is justified yet.

If separately authorized, the smallest design to qualify would be a dedicated frontdoor-only construction of this existing service with:

1. `enabled` explicitly false unless the DEX provider feature is configured on; no database pool/URL, no `classificationFor`, no `knownTokenAddresses`, and no snapshot store.
2. Existing provider set to exact `robinhood`, explicit 2.5-second per-provider timeout, zero retries for predictable aggregate bound, low concurrency and no background refresh. The route accepts one validated contract and exact-match filtering remains mandatory.
3. Response provenance with provider fetch time distinct from source observation time (`null` where DexScreener supplies none), and no `fresh` assertion stronger than “provider response fetched at …; source observation time unavailable.” On provider timeout, non-200, malformed response or chain mismatch return an explicit unavailable/partial response; never substitute fixtures, zeroes or old cache as live.
4. Exact-path GET activation only. Keep `/v1/rh-chain/*`, `/v1/4663/*`, `/internal/*`, all mutation methods, snapshots, archive and protected paths default-deny. Add GET and non-GET isolation tests, including path encoding and trailing-slash variants.

Sketch of a future delta (illustrative, unapplied; constructor names/options must be checked during authorized implementation):

```diff
--- a/src/api/app.ts
+++ b/src/api/app.ts
@@ frontdoor-only branch
+const rhPublicMarketProvider = new DexScreenerProvider({
+  enabled: config.dexScreenerEnabled,
+  chainId: 'robinhood',
+  timeoutMs: Math.min(config.dexScreenerTimeoutMs, 2500),
+  maxRetries: 0,
+  maxConcurrency: 2,
+  baseUrl: config.dexScreenerBaseUrl
+});
+const rhPublicMarket = new RhChainMarketDataService({
+  provider: rhPublicMarketProvider,
+  enabled: config.dexScreenerEnabled
+}); // no DB callbacks, store, snapshot service or scheduler
+registerOneQualifiedRhMarketRead(app, rhPublicMarket);
--- a/src/api/frontdoorIsolation.ts
+++ b/src/api/frontdoorIsolation.ts
@@ exact allowlist
+allow only GET /v1/rh-chain/market/tokens/:validatedContract;
+leave every other RH/4663/internal path and non-GET method blocked
```

This is a proposal only. The current stop condition is met; implementation, app-level tests and activation remain for owner decision.

## Required qualification test matrix

No tests were run or added in this investigation. These are required tests before any future activation; tests must use injected providers/stores and assert behavior, never publish fixture values as a live response.

| Test | Required evidence / assertion |
|---|---|
| Genuine successful read | Inject or call actual DexScreener provider; assert exact requested token, upstream URL/provider provenance, provider fetch timestamp, response HTTP success, correct `chainId=robinhood`; keep actual source capture separate from deterministic unit fixtures. |
| Missing upstream source | Provider disabled/unconfigured returns unavailable; no static/demo fixture or fake zero metrics. |
| Timeout and upstream failure | Abort/timeout and HTTP 5xx become explicit unavailable/partial results inside one bounded total route budget. |
| Stale data | Old cache never receives a “live/fresh” label; source timestamp remains null when absent; if stale cache is permitted, response is explicitly stale and dated by cache fetch time. |
| Invalid response | Schema-invalid JSON is rejected; response contains no fabricated market values. |
| Incorrect chain identity | Provider result with chain ID other than `robinhood` or wrong token address is discarded and shown unavailable. |
| Database unavailable | With pool factory/store spies that throw if called and no DB URL, qualified route still responds from external provider; proves zero DB access. |
| No database writes | Spy on pool query/transaction and migration/schema ensure; all must remain at zero. |
| No worker/scheduler initialization | Spy RH automation, ingestion, monitor, cron, `setInterval`, and worker startup; all zero in frontdoor mode. |
| Protected routes stay blocked | Internal/reviewer/admin, claims, classifications, receipts, proof, settlement, snapshot capture, POST/PATCH/DELETE, `/v1/4663/*` and unknown RH paths remain blocked. |
| No fixture leakage | Poison fixture sources with unique markers and assert those markers never appear in enabled upstream response or failure response. |
| Route budget and identity contract | One validated contract only, maximum attempts and elapsed time bounded; validate returned payload chain/network against configured 4663/RH identity before responding. |

## Risks and reactivation dependencies

- Public RPC direct success does not create an existing safe Radar handler. A network-status route would be new scope.
- DexScreener only has pair-level market observations for discovered pairs; search is partial and provider timestamps are absent. Chain-wide totals and strict observation freshness remain unverified.
- Blockscout is unavailable from this qualification environment (403). Transaction stats cannot be qualified without provider access and a no-persistence projection that the current code does not expose.
- DefiLlama current values have no observation timestamp. Stablecoin endpoint was not reachable; do not infer current stablecoin statistics.
- The existing production-mode frontdoor candidate denies RH reads by design. A dedicated service instance and exact route gate need tests before activation. Never allow all `/v1/*` or all `/v1/rh-chain/*`.
- No PostgreSQL schema, migration state, snapshot persistence, ingestion cadence, automation flag, or production provider behavior was rechecked here.
- Existing RH chain status and market code can report stale, partial, memory, provider-down or source-required conditions; callers must preserve these states, not synthesize plausible numbers.
