# PR #35 release and recovery note

This note records the release boundary for monitor delta persistence. It does not authorize a production configuration change, migration, deployment, or monitor run.

## Effective monitor behavior

`INGESTION_ENABLED=false` and `RH_CHAIN_AUTOMATION_ENABLED=false` do not disable the monitor. In the production service configuration, `MONITOR_ENABLED`, `MONITOR_MODE`, and `MONITOR_INTERVAL_MS` are configured (the runtime-config log intentionally redacts their values). Repeated `monitor_job_failed` entries on 2026-11-04 and 2026-11-05 are spaced about 900 seconds apart, demonstrating an active 15-minute scheduler. The latest durable monitor row is a successful `safe_metadata` run finished at 2026-07-18 11:22:43 UTC; later scheduled attempts failed persistence.

Source defaults are `MONITOR_ENABLED=false`, `MONITOR_MODE=disabled`, and `MONITOR_INTERVAL_MS=900000` when the interval is absent. The last persisted mode was `safe_metadata`; the exact live mode setting is not exposed in the redacted configuration record.

After deployment and application readiness, the configured scheduler can call `runMonitor` at its next interval tick and commit a delta. There is no monitor invocation in startup itself. The admin-only `POST /v1/monitor/run` route can cause a delta immediately. Neither ingestion nor RH automation switches gate either path. The write transaction records monitor events/run/state changes and the current full-snapshot checkpoint ID; it does not insert an `intelligence_snapshots` row.

## Ordering and restart qualification

The transaction advisory lock serializes full-snapshot and delta transactions. Qualification found that advancing a checkpoint while retagging only the last folded run dropped earlier folded deltas from the next replay window when the caller held a stale in-memory snapshot. The writer now retags every folded monitor run to the new checkpoint. This preserves the replay chain across repeated checkpoint folds.

The PostgreSQL 18.6 integration test now covers a stale full snapshot overlapping a newer delta, two successive checkpoints, several deltas in one checkpoint, restart restoration, and exactly-once event/run/evidence assertions. Another integration case executes the previous loader's actual query/result contract. Before a full checkpoint includes a delta, that loader reads only `intelligence_snapshots.snapshot` and does not read the corresponding `monitor_runs.state_delta` or linked events. The rows remain in PostgreSQL, but the previous application does not expose them in its in-memory state.

Assessment freshness is calculated at the recorded monitor completion time. The monitor does not change the provider's catalog `lastSeenAt`; a Jan 1 observation assessed by a Jan 10 run remains nine days old and scores freshness 28 under the current formula. On restart, replay uses the persisted run completion time rather than the restart clock, so an old run does not acquire a newer assessment timestamp.

## Rollback boundary

The previous application is not a lossless runtime rollback after delta commits: it ignores uncheckpointed delta rows. A code rollback can leave their database rows intact, but the old application loads the last full snapshot and will not show those monitor updates. Do not claim schema additivity makes the rollback lossless, and do not force a full snapshot checkpoint as a rollback shortcut.

Record-preserving emergency procedure, if separately authorized:

1. Disable the independent monitor scheduler (`MONITOR_ENABLED=false` and `MONITOR_MODE=disabled`) on the new application, then wait for the in-flight store job to drain. Verify no monitor owner remains active and record the latest full snapshot ID.
2. Take a bounded logical backup of `monitor_runs` rows with non-null `state_delta` for that checkpoint and their linked `infopunks_events` rows. Preserve the existing schema and rows; do not delete locks or data.
3. If old code must be started, keep the monitor disabled and do not run ingestion, manual jobs, or any snapshot writer. The old service will present the older full snapshot while it runs; monitor deltas remain durable but hidden from its state.
4. Confirm the latest full snapshot ID did not change during the rollback window. If it changed, stop: automatic replay linkage is no longer qualified and the backup requires a separately reviewed restore/replay procedure.
5. Restore the delta-capable application and verify it rehydrates the saved checkpoint's deltas. Do not resume monitoring until the records, run IDs, and evidence counts match the backup.

If temporary loss of monitor updates in the old application's view is unacceptable, do not roll back to the previous application. Keep the delta-capable application and stop its monitor scheduler while a forward fix is prepared. A rollback that both shows every delta in old code and avoids a full checkpoint needs a compatibility backport; that behavior is not present in the previous release.

## Startup DDL and bounded deployment stop plan

Read-only production catalog inspection on 2026-11-05 found the new columns and indexes absent. `infopunks_events` has about 70,235 estimated rows, a 1.26 GB heap, 59 MB of indexes, and 1.76 GB total relation size. `monitor_runs` has about 2,467 estimated rows and 110 MB total size. The queried historical snapshot table is about 11 GB total; PR #35 does not alter or index it.

At startup, `ensureSchema()` adds nullable columns without defaults, then runs ordinary (non-concurrent) `CREATE INDEX IF NOT EXISTS` statements. The nullable column additions are metadata-only on supported PostgreSQL versions but require brief `ACCESS EXCLUSIVE` locks and can wait behind existing transactions. The event index needs a table scan over the large event heap; ordinary index creation permits reads but blocks writes to that table for its duration. The run index has the same locking pattern on the smaller run table. Startup executes this schema bootstrap before the application finishes loading persisted state, so a lock wait or index build can delay readiness and contend with the still-running old instance.

Before any separately authorized deployment, record database connectivity/circuit health, active transactions and locks, relation sizes, free disk, current snapshot ID, and the existing readiness/startup baseline. Because the independent monitor is currently active, do not attempt the rollout while it is writing. A separate authorization is required to disable and drain that scheduler before startup DDL. Keep ingestion and RH switches false and auto-deploy off.

During an approved rollout, stop if the new instance is not ready within five minutes, an existing instance loses readiness, a DDL lock wait exceeds 30 seconds, the database circuit degrades, or any unexpected snapshot write occurs. Preserve the blocker PID/query and deployment logs. Do not repeatedly redeploy or kill a backend. Keep the last healthy instance serving only if Render has not terminated it; otherwise stop the operation and use the record-preserving recovery procedure above. Do not describe this as a PostgreSQL SIGKILL fix.
