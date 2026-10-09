# Candidate and migration reconciliation

- Branch: `codex/track-a-release-candidate`
- Required starting SHA: `1b9a9ea4baa4b76b4c2898a4e3e691cdfc8030d8`
- Working tree was clean at qualification start.
- A0 evidence was committed separately on `codex/track-a-launch-baseline` as `5fae6d8c0ba42b4cf1b5e7919731f86b5cf63834`; its recorded observations were not edited. Other previously staged A1/A3 evidence was not included.
- Remote refs were fetched with prune; exact current remote heads are in `remote-heads.txt`.
- Candidate migration files: 001–021, each has an up/down pair. `npm run migrations:validate` checks exact ordered IDs, duplicate/missing/unexpected IDs, down counterparts and per-up-file SHA-256.
- An isolated disposable local PostgreSQL 14.20 database (`track_a_qual_20261009`) applied all 21 up migrations cleanly. Status tool reports 21 present, zero pending, 46 tables and 36 triggers. It infers applied state from expected schema objects; it is not a durable historical ledger and does not prove which migration runner applied them.
- A separate test schema exercises upgrade from 001–017 to 018–021. Legacy signed receipt hash/signature domain and CALL JSON bytes are asserted unchanged.
- No migration was reordered or down migration run against the disposable qualification database.
