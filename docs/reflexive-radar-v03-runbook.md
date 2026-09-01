# Reflexive Radar v0.3 inventory refresh

Configure `DATABASE_URL`, `RH_CHAIN_RPC_URL`, and the existing reviewer-admin token. The RPC must support `eth_call` at a recent explicit block; archive state is only required for retrospective checkpoint reconstruction. If archive reads are unavailable, refresh prospectively and leave historical checkpoints unavailable rather than substituting current state.

Run the existing protected `POST /internal/4663/reflexive/refresh` operation. It synchronizes RHJ canonical assets, verifies PAIR markets, reads the PositionManager NFT, verifies locker ownership, reconstructs current principal with bigint TickMath/LiquidityAmounts-compatible arithmetic, reads the exact canonical stock-token `totalSupply` at the observation block, and persists immutable observations.

Inspect `/v1/4663/reflexive/pairs/:id` for `inventory.status`. Public inventory requires `AVAILABLE`, `scope: CANONICAL_LOCKED_POSITION`, and `method: VERIFIED_LOCKED_POSITION_RECONSTRUCTION_V1`. `UNAVAILABLE` is an intentional fail-closed state. Do not use a PoolManager ERC-20 balance, active pool liquidity, or a PAIR HTTP card as substitute evidence.
