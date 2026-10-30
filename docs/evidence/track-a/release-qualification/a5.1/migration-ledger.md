# A5.1 migration ledger qualification

## Implementation

`src/services/postgresMigrationRunner.ts` provides an operator-invoked PostgreSQL runner for the discovered migration inventory 001–021. It records immutable run history and immutable applied identity/checksum rows, serializes concurrent runners with a PostgreSQL advisory lock, runs each migration and its ledger update in one transaction, and emits a JSON report. Repeated application is idempotent. The runner rejects missing/gapped, reordered, modified, and unknown history; refuses an unledgered existing schema unless an explicit supported baseline is selected; and never runs `.down.sql` files.

Historical adoption is explicit and limited to verified baselines 017 and 020. Both baseline manifest hashes and schema signatures are checked before adopted rows are recorded. Adoption is not automatic. A failure rolls back that migration, records a failed attempt separately, and leaves the sequence resumable from the failed migration.

The migration command is compiled into the Docker runtime image, and the image includes `/app/migrations`. `npm run migrations:run` applies pending migrations; `npm run migrations:check` validates the inventory and current ledger without applying pending migrations. Both emit a machine-readable JSON report.

## PostgreSQL test results

The integration tests in `tests/integration/postgres-migration-runner.test.ts` cover first boot/repeat boot, two concurrent runners, refusal of unledgered adoption, supported 017 and 020 historical baselines, failed DDL rollback and retry, checksum drift, unknown history, and reordered history. All 7 passed against a disposable local PostgreSQL database.

A separate CLI first boot and repeat boot against disposable database `track_a5_20261009` completed with 21 applied identities, zero pending identities, and no extra history on repeat. The database is local and disposable; it is not staging or production.

## Known boundaries

Only baselines 017 and 020 are currently supported for historical adoption. Other starting schemas are refused pending an independently reviewed schema signature and immutable baseline manifest. Migration validation initializes the ledger metadata tables under the advisory lock if absent; it does not apply product migrations.
