# Robinhood Chain market-memory production rollout

This is an operational gate, not a public product. Application startup never applies migrations. Keep every RH Chain public feature flag `false` until its checklist is complete.

## Required migrations

Apply, in this exact order, through the normal staging/production migration job:

1. `20260719_001_rh_chain_market_snapshot_memory.up.sql`
2. `20260719_002_rh_chain_reviewed_classifications.up.sql`
3. `20260719_003_rh_chain_classification_layer_vocabulary.up.sql`
4. `20260719_004_rh_chain_attention_quality_receipts.up.sql`
5. `20260719_005_rh_chain_project_claims.up.sql`
6. `20260720_006_rh_chain_reviewer_workflow.up.sql`

Verify without applying anything:

```bash
npm run rh-chain:migration-status -- --environment=staging --require-ready
npm run rh-chain:migration-status -- --environment=production --require-ready
```

The command emits schema signatures and migration IDs only. It never prints `DATABASE_URL`, applies DDL, or starts the application.

## Rollout sequence

1. Deploy code with every RH Chain feature flag false.
2. Apply the required migrations in staging, then verify the migration-status command and authenticated `/internal/rh-chain/operational-readiness` endpoint.
3. Configure Review Console authentication and enable only `RH_CHAIN_REVIEW_CONSOLE_ENABLED=true`.
4. Seed reviewed exact-contract classifications; inspect reviewer audit records and classification conflicts.
5. Enable market ingestion and persisted history; wait for fresh snapshots and verify zero provider requests on persisted read paths.
6. Enable Attention Quality V2 and confirm receipt drafting/rejection behavior.
7. Enable Project Claims. Submit a test claim and verify it remains `queued_for_review` with no public endorsement.
8. Enable Project Directory only after the Project Claims queue, evidence redaction, and identity workflow pass review.
9. Create, approve, publish, and supersede one pilot Intelligence Receipt. Confirm both receipt URLs remain public while private notes remain absent.
10. Enable Intelligence Receipts, monitor readiness, failed-auth attempts, stale data, conflict count, queue depth, and receipt publication audit events.

## Rollback

Use flags first; do not run destructive down migrations during an incident.

1. Set the affected public flag to `false` and redeploy.
2. Retain Review Console access for investigation unless its credentials are suspected.
3. Preserve published/superseded receipts and audit records.
4. Record the readiness blocker and remediate forward. Only consider a migration down-file after its explicit unsafe-rollback checks pass and no active/published records depend on it.

## Render environment matrix

| System | Required variables | Safe default | Dependency |
| --- | --- | --- | --- |
| Live Snapshot token lookup | `RH_CHAIN_LIVE_SNAPSHOTS_ENABLED`, `RH_CHAIN_PROVIDER_TIMEOUT_MS`, optional `RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS`, `RH_CHAIN_BLOCKSCOUT_URL` | live flag `false`; route timeout `3800ms` (bounded to `4000ms`) | external context only; provider and durable-cache work is deadline bounded |
| Market Memory | `DATABASE_URL`, `RH_CHAIN_MARKET_INGESTION_ENABLED`, `RH_CHAIN_MARKET_HISTORY_ENABLED`, `DEXSCREENER_ENABLED` | all flags `false` | migration `001` |
| Reviewed Classifications | `DATABASE_URL`, `RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED` | `false` | migrations `002`, `003`; reviewer workflow recommended |
| Attention Quality V2 | `DATABASE_URL`, `RH_CHAIN_MARKET_HISTORY_ENABLED`, `RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED` | `false` | migrations `001`, `004` |
| Project Claims | `DATABASE_URL`, `RH_CHAIN_PROJECT_CLAIMS_ENABLED`, `RH_CHAIN_REVIEW_CONSOLE_ENABLED`, `RH_CHAIN_REVIEW_ADMIN_TOKEN` | `false` | migrations `005`, `006` |
| Intelligence Receipts | Project Claims variables plus `RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED` | `false` | migrations `005`, `006`; reviewer auth |
| Project Directory | Project Claims variables plus `RH_CHAIN_PROJECT_DIRECTORY_ENABLED` | `false` | migrations `005`, `006`; Project Claims enabled |
| Review Console | `RH_CHAIN_REVIEW_CONSOLE_ENABLED`, `RH_CHAIN_REVIEW_ADMIN_TOKEN` | `false` | dedicated bearer token; never expose it to clients |

`DATABASE_URL`, `RH_CHAIN_REVIEW_ADMIN_TOKEN`, and `INFOPUNKS_ADMIN_TOKEN` are Render secrets. Do not place values in this document, source, logs, screenshots, or client-side variables.

The Live Snapshot token route has a 3.8-second internal SLO budget so the public five-second smoke deadline retains proxy and serialization headroom. Keep `RH_CHAIN_LIVE_TOKEN_ROUTE_TIMEOUT_MS` unset for the production-safe default. Explicit values above 4 seconds fail configuration validation. Provider, cache, Market Memory, and reviewed-context failures return typed partial or unavailable context; they never become zero or fabricated token data.

## Deployment checklist

- [ ] Migration-status exits zero with `--require-ready`.
- [ ] Operational readiness reports database/tables/indexes ready and no critical blocker for the intended flag.
- [ ] Reviewer bearer auth rejects missing and invalid credentials.
- [ ] Snapshot freshness is fresh or the rollout is explicitly paused.
- [ ] Classification conflicts and stale-data state have an owner.
- [ ] Queue-only intake, public redaction, receipt immutability, and supersession are smoke-tested.
- [ ] Feature flags are enabled one at a time with post-deploy monitoring.
