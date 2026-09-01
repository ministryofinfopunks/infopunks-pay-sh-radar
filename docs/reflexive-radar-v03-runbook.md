# Reflexive Radar v0.3.1 accounting runbook

This run is deliberately bounded. It never writes CALL, RESOLUTION, PRINT, or Genesis data.

1. Set `DATABASE_URL` and `RH_CHAIN_RPC_URL` in the production runtime; do not place either value in this repository.
2. Verify the existing reviewer-admin authorization is configured before invoking the internal refresh route.
3. Confirm the endpoint reports chain ID `4663`.
4. Inspect the Robinhood RHJ canonical asset registry; a ticker is not enough—each quote must match the exact canonical contract.
5. Run bounded PAIR discovery. Keep PEAR/AAPL when still verified, one verified single-stock mission pair, and one verified multipool launch group. Do not select by performance.
6. Verify every candidate independently: launch provenance, PoolKey, PoolId, StateView slot state, and locked PositionManager NFT ownership.
7. Read PositionManager `getPositionLiquidity(tokenId)` and StateView `getPositionInfo(poolId, PositionManager, tickLower, tickUpper, bytes32(tokenId))` at the same explicit block. A mismatch is `POSITION_STATE_MISMATCH`; it must persist as evidence and cannot produce public inventory.
8. Persist the immutable Birth Record only for a verified PAIR market.
9. Persist immutable position-inventory observations only when `POSITIONMANAGER_CORE_MATCH` is true. The position numerator and Stock Token `totalSupply` must use the same block.
10. Inspect `/v1/4663/reflexive/stocks/:symbol`. Public aggregate status must be `ALIGNED`, `aggregation_scope` must be `TRACKED_PAIR_CANONICAL_LOCKED_POSITIONS`, and any stale, mismatched, duplicate, or unavailable observation must be listed as excluded. `INCOMPLETE` is not zero.
11. Inspect `/og/4663/reflexive/stock-money/:observationId.png` only for an aligned immutable aggregate. This card reports tracked PAIR locked inventory, never total ecosystem absorption or demand.
12. Inspect lifecycle targets. Missing D1/D3/D7 state remains pending or missed; do not backfill a historical current read without archive capability.
13. Do not enable a broader bootstrap until database writes, RPC reads, core-position cross-checks, same-block supply reads, registry freshness, duplicate detection, and block alignment are healthy.

Safe operator sequence (replace placeholders in the deployment secret manager, never in a shell history or this repository):

```sh
export DATABASE_URL='postgresql://…'
export RH_CHAIN_RPC_URL='https://…'
curl -fsS "$RH_CHAIN_RPC_URL" -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
curl -fsS -X POST https://radar.infopunks.fun/internal/4663/reflexive/refresh -H 'authorization: Bearer <reviewer-admin-token>'
curl -fsS https://radar.infopunks.fun/v1/4663/reflexive/stocks/AAPL
```

Run the protected `POST /internal/4663/reflexive/refresh` operation after the checks above. When production configuration is absent, this refresh may be used for read-only development verification only; it does not claim durable persistence.

The exact public inventory vocabulary is `TRACKED PAIR LOCKED INVENTORY` and `TRACKED PAIR LOCKED ABSORPTION`—equivalently, “% of Robinhood onchain AAPL Token supply.” It is not float absorption, total mission-market absorption, net quote demand, or a PoolManager balance.
