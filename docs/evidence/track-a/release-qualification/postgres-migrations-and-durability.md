# PostgreSQL migration and durability results

Environment: local PostgreSQL 14.20 only; database was created specifically for this qualification and is disposable. No production/staging database was accessed.

- Clean path 001–021: passed.
- Upgrade path 001–017 then 018–021: covered by `tests/integration/legacy-receipt-upgrade.test.ts`; legacy canonical signed receipt bytes/hash and historical CALL payload are preserved.
- Migration inventory negative tests: missing, duplicate, reordered sequence and missing down migration cases.
- Migration status readiness assertions cover 001–021 schema tables, indexes, constraints and triggers; `--require-ready` rejects invalid repository inventory and incomplete database schema.
- PostgreSQL-backed receipt payment durability, decision context, acceptance boundary, score projection, evaluation, resilience and canonical receipt tests run in the full suite; final results recorded in `test-results.md`.
- Status limitation: repository does not yet persist an authoritative applied-migration ledger/checksum table. Schema readiness is inferred from database objects and cannot detect all historical ordering/manual mutation. Operator-controlled staging migration ledger remains a gate.
- Backup/restore equivalence against an actual PostgreSQL physical/logical backup has not been performed; application restart/reconstruction and schema-isolated replay are the local durability evidence.
