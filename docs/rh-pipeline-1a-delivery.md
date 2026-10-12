# RH-PIPELINE-1A — collection and durable observation memory

**Local candidate: PASS. Production activation and overall RH-PIPELINE-1 release: HOLD.**

This is the first of the four sequential implementation stages. Dynamic movers/Today (1B), automatic factual editions (1C), and frontdoor/browser integration (1D) are not implemented by this candidate.

## Frozen source and integration base

- Branch: `codex/rh-pipeline-1a`.
- Base: fetched `origin/main`, `dfe089bb71c6b4c52acdfb0e8e5b8cc331a13a2f`.
- Qualified code: `ced2bdeb5ddf4a8bb0514c3ae9962f52cbd42977`.
- Local qualification date: 13 October 2026.
- Existing local candidate branches were inventoried, not merged or assumed approved. Main contains 17 migration files; other active integration candidates reserve 018–022 and E1 reserves 023. This work adds `20261012_024_rh_market_observation_history`.
- The original checkout's local-only October 12 stack inventory remains unchanged.
- Exact branch SHAs, migration filenames and SQL hashes are in [migration-ledger.json](evidence/rh-pipeline-1a/migration-ledger.json).

## Result

The known-contract collector now has an independently controlled schedule. It starts once on application readiness, repeats at the configured interval, skips overlapping local ticks, and drains its current run on shutdown. Restart collects the current observation; it does not fabricate observations for missed time slots.

Collection reuses the existing RH automation store and adapters. The shared database pool needs at least two connections; one-connection configurations fail clearly rather than waiting on their own lock. The added `rh_market_snapshot_refresh` job records its run and coverage context without invoking signal publication. PostgreSQL session locks prevent another worker from starting the same collection job while the owner remains connected. The lock is not released by an expired TTL; connection loss fails the owning run and permits recovery. Insert identity and daily membership protect replay across restarts and raw retention.

Validation checks mainnet provider identity, exact EVM contract, base/quote attribution, pair identity, source URL, source/cache age and clock skew. Symbols never establish identity. Multiple pools are selected deterministically; conflicting measurements for one pair/time are withheld. Equivalent timestamp offsets and pair casing normalize to one identity.

Failed batches or writes cannot erase successful observations from other batches. Numeric missing/invalid values remain null with explicit gaps. The collector rejects stale input rather than advancing its timestamp. Public history reads report current age separately from the freshness recorded at capture.

Five-minute collection avoids paid-attention endpoints. Unobserved paid attention is null/unavailable and cannot establish organic attention or an Attention Quality score. The existing adapter now distinguishes the 300/minute pair lookup budget from the 60/minute paid/list budget; caching, bounded concurrency and retry/backoff remain in place.

## History and migration

- Raw observations: 48 hours; the 300-row deletion cap is removed.
- Hourly aggregates: 90 days.
- Daily aggregates: durable, independently identified per exact contract/pair/provider/UTC day.
- Aggregates preserve first/last samples, metric extrema with provenance, non-null coverage counts, version and replay membership. Rolling 24-hour volumes are not summed into daily volume or capital inflow.
- Daily aggregates are mutable observation summaries, not public immutable receipts. Freezing and additive corrections belong to 1C.
- Migration 024 atomically backfills retained legacy samples, then installs insert-triggered rollups. A duplicate raw insert does not increment an aggregate. Raw insertion and both aggregates commit or fail together.
- Collection fails closed when the external migration or its enabled trigger is missing. Readiness and migration inspection include the new schema/index/trigger signatures.
- Empty rollback/reapply was rehearsed. Populated rollback refuses to discard retained evidence; preserve the schema and remediate forward.
- Already-deleted legacy history cannot be reconstructed. The retention duration is a policy, not a claim of 90 days of observed production coverage.

## Qualification evidence

The final frozen source passed **1,912 tests across 262 files, with zero failures or skips**, plus typecheck, lint, server/client build and diff checks. See [qualification.json](evidence/rh-pipeline-1a/qualification.json) for counts and log commitments and [all test assertions](evidence/rh-pipeline-1a/full-test-assertions.json) for the per-test record. The validation environment is macOS, Node 25.6.1 and a disposable PostgreSQL 14.20 instance bound to localhost. No production database or provider credentials were used.

The full repository run enables `CANONICAL_RECEIPT_TEST_URL`, `ECONOMIC_ENGINE_TEST_URL`, and `POSTGRES_RESILIENCE_TEST_URL` against that disposable database. It uses one worker and 30-second test/hook timeouts on the shared host. These timeouts are test harness settings, not achieved service latency.

The new coverage includes wrong-chain and quote-direction rejection, stale/cache/source age, clock skew, symbol collisions, sparse and invalid values, multiple pools, source disagreement, paid-attention gaps, partial batches, concurrent writers, cache replay, application restart, scheduler overlap/error recovery, public/private separation, UTC midnight, reverse-order replay, external migration enforcement, legacy backfill, all-migration apply, rollback, trigger loss, raw/aggregate atomicity, session lock contention and worker connection loss, and one-/two-connection pool behavior.

The retention fixture inserted 601 five-minute samples plus one older observation. After the 48-hour cutoff, 577 raw samples remained; daily counts were 1, 288, 288 and 25. Replay of a compacted sample created no additional count. These are controlled fixtures, not live market observations.

[API examples](evidence/rh-pipeline-1a/api-examples.json) show an empty public history read, one exact-contract fixture capture, idempotent replay with zero new writes, and a subsequent source-linked read. The file explicitly marks all values as fixtures. No synthetic value is represented as a live market number.

Typecheck, lint, server/client build and diff checks are required and recorded in the qualification summary. Full browser/device qualification is reserved for 1D; this candidate changes no frontend source and does not claim browser release readiness.

## Activation and rollback

Defaults remain off. The independent scheduler switch is `RH_CHAIN_MARKET_SCHEDULER_ENABLED=false`.

For a separately approved environment, first apply migration 024 through the external runner, verify its ledger and trigger, and configure durable PostgreSQL with a pool of at least two connections plus the existing DEX Screener/known-contract provider path. Then enable history and ingestion (or their existing automation equivalent) before enabling the scheduler:

```text
RH_CHAIN_MARKET_HISTORY_ENABLED=true
RH_CHAIN_MARKET_INGESTION_ENABLED=true
RH_CHAIN_MARKET_SCHEDULER_ENABLED=true
RH_CHAIN_MARKET_SNAPSHOT_INTERVAL_MS=300000
```

This is a future configuration example, not a change applied to production. Intervals below one minute clamp to one minute; the default is five minutes.

Pause this collector by setting only `RH_CHAIN_MARKET_SCHEDULER_ENABLED=false`. Retained observations stay readable and other RH jobs retain their existing controls. Avoid rollback migration after history exists. No Phase 2/3 proof marker, auto-publication flag, trading permission or paid-service activation was changed.

## Authority and release limits

CALL/RESOLUTION, Genesis, cryptographic proof, IPX economics and canonical receipt/judgment authority have no changed implementation files. Observations do not approve a project, publish an editorial verdict, change reputation or grant spending permission. Existing Phase 2/3 publication gates remain intact.

Production activation is HOLD under the execution directive. Production dependency readiness, provisioned RPC/cluster budgets, real observation coverage, Linux deployment validation, signed proof-chain artifacts and the remaining 1B–1D public path still require their own evidence. The earlier production HTTP 503 audit is not requalified by local tests.

## Exact code-file inventory

The qualified code commit contains:

1. `.env.example`
2. `src/api/app.ts`
3. `src/config/env.ts`
4. `src/providers/dexscreenerProvider.ts`
5. `src/services/rhChainAttentionQualityService.ts`
6. `src/services/rhChainAutomationService.ts`
7. `src/services/rhChainMarketHistory.ts`
8. `src/services/rhChainMarketScheduler.ts`
9. `src/services/rhChainMarketSnapshotService.ts`
10. `src/services/rhChainMarketStructureService.ts`
11. `src/services/rhChainProductionReadiness.ts`
12. `migrations/20261012_024_rh_market_observation_history.up.sql`
13. `migrations/20261012_024_rh_market_observation_history.down.sql`
14. `tests/helpers/rhMarketObservations.ts`
15. `tests/rh-market-collection.test.ts`
16. `tests/rh-market-history-postgres.test.ts`
17. `tests/rh-chain-automation.test.ts`
18. `tests/rh-chain-market-snapshot.test.ts`
19. `tests/rh-chain-production-readiness.test.ts`

This delivery document and the four evidence JSON files are a separate documentation commit following the qualified code commit. No GitHub PR, push, merge, deployment or public activation was performed.
