# Infopunks //4663 — Close the Loop production gate

Phase 2 is fail-closed in production. `RH_4663_PHASE2_ENABLED` defaults to `false`, application startup never applies migration `008`, and the Postgres resolution store returns `phase2_migration_not_applied` when its three tables are absent.

## Irreversible boundaries

`20260813_007_infopunks_4663_phase1` becomes operationally irreversible as soon as a real immutable CALL receipt or Genesis provenance row exists. Its down migration deliberately aborts instead of deleting history.

`20260813_008_infopunks_4663_close_the_loop` becomes operationally irreversible as soon as a resolution, RESOLUTION receipt, or anchor record exists. Disable Phase 2 and remediate forward; never delete protocol history to roll back application code.

Genesis v1 is global: one valid CALL per wallet per UTC window; at most one Genesis position per distinct wallet; the first 4,663 qualifying wallets receive ordinal provenance only. The frozen policy version and hash are returned by `/v1/4663/pulse`. It grants no economic entitlement.

## Required sequence

Run from the repository root. The `psql` steps require production database access and are intentionally not part of application startup.

```bash
git status --short
git log -1 --oneline
git push origin HEAD

# deploy the application with RH_4663_PHASE2_ENABLED=false
RADAR_VERIFY_BASE_URL=https://radar.infopunks.fun npm run verify:production
SMOKE_BASE_URL=https://radar.infopunks.fun npm run smoke:production

# verify the live schema before changing it
NODE_ENV=production npm run rh-chain:migration-status -- --environment=production

# apply Phase 1 only after the deployed code passes compatibility checks
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260813_007_infopunks_4663_phase1.up.sql
NODE_ENV=production npm run rh-chain:migration-status -- --environment=production

# live /4663 read-only smoke
curl --fail --silent --show-error https://radar.infopunks.fun/v1/4663
curl --fail --silent --show-error https://radar.infopunks.fun/v1/4663/pulse
curl --fail --silent --show-error https://radar.infopunks.fun/v1/rh-chain
curl --fail --silent --show-error https://radar.infopunks.fun/v1/pulse
curl --fail --silent --show-error https://radar.infopunks.fun/solana

# make one controlled wallet-signed CALL through the normal UI/API, then inspect it
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select receipt_id, wallet, window_id, payload->>'payload_hash' as payload_hash, payload->>'signature' as signature from rh_4663_pulse_calls order by created_at limit 1;"

# submit the same wallet/window a second time; expect HTTP 409 wallet_already_called_in_window
# verify the first persisted payload, hash, and signature are byte-for-byte unchanged

# apply Phase 2 only after Phase 1 persistence and compatibility are verified
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20260813_008_infopunks_4663_close_the_loop.up.sql
NODE_ENV=production npm run rh-chain:migration-status -- --environment=production --require-ready
```

Configure `RH_4663_RESOLUTION_PRIVATE_KEY`, `RH_4663_RESOLUTION_KEY_ID`, and the existing reviewer bearer token before enabling Phase 2. The resolution key signs canonical RESOLUTION receipts and must not be exposed to the client or logs.

Anchoring remains safely `not_submitted` unless all of `RH_4663_ANCHOR_RPC_URL`, `RH_4663_ANCHOR_CONTRACT`, and `RH_4663_ANCHOR_PRIVATE_KEY` are configured. The contract must implement:

```solidity
commitPulseWindow(bytes32 windowHash, bytes32 acceptanceRoot, uint256 receiptCount, uint64 committedAt)
```

Confirm the deployed contract and chain ID `4663` independently before configuring the adapter. A transaction hash is `submitted`, not `confirmed`; the adapter requires the configured confirmation depth.

The production commitment contract must reject a second, conflicting commitment for the same `windowHash`. The application also persists an atomic `submitting` claim before broadcast, but contract-level uniqueness is the final defense against duplicate transactions from independent deployments.

Enable `RH_4663_PHASE2_ENABLED=true`, deploy, then resolve a closed controlled window:

```bash
export WINDOW_ID='rh4663:YYYY-MM-DD'
export REVIEWER_ID='operations-reviewer-id'

curl --fail --silent --show-error -X POST \
  -H "Authorization: Bearer $RH_CHAIN_REVIEW_ADMIN_TOKEN" \
  -H "X-RH-Chain-Reviewer-Id: $REVIEWER_ID" \
  "https://radar.infopunks.fun/internal/4663/pulse/windows/$WINDOW_ID/resolve"

curl --fail --silent --show-error -X POST \
  -H "Authorization: Bearer $RH_CHAIN_REVIEW_ADMIN_TOKEN" \
  -H "X-RH-Chain-Reviewer-Id: $REVIEWER_ID" \
  "https://radar.infopunks.fun/internal/4663/pulse/windows/$WINDOW_ID/publish"

curl --fail --silent --show-error \
  "https://radar.infopunks.fun/v1/4663/pulse/windows/$WINDOW_ID"
curl --fail --silent --show-error \
  "https://radar.infopunks.fun/v1/4663/pulse/windows/$WINDOW_ID/resolution"
```

Before opening participation, verify one correct and one incorrect share rendering path in staging, inclusion-proof verification, signer recovery, no duplicate receipts after repeated resolve/publish, `submitted` versus `confirmed` anchor reporting, Today integration, 390 × 844 layout, and all existing RH Chain and Solana smoke surfaces.

No Day One data is seeded. The first production window, CALL, Genesis ordinal, acceptance root, anchor, RESOLUTION receipt, resolved consensus, and share results must come from real participation.
