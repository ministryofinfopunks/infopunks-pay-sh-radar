# Radar release integration qualification evidence

Tested application/source revision: `2559c69d0bccdec2e5ceac80a2e929026d45829c`. The final frozen candidate adds only this evidence packet and its release ledger after qualification; source, tests, migrations, package manifest, and qualification scripts are unchanged from the tested revision.

- `system/check-results.json` records all local qualification commands and exit codes.
- `system/full-test-summary.json` records the complete PostgreSQL-backed test suite.
- `system/migration-first.json`, `migration-check.json`, and `migration-repeat.json` record 22-migration fresh/repeat behavior.
- `system/recovery-before.json` and `recovery-after.json` record synthetic local backup/restore and exact replay verification.
- `system/audit-production.json` and `audit-all.json` record dependency audit results.
- `browser/` contains the 33-view browser/accessibility run, screenshots, navigation audit, keyboard/reduced-motion evidence, and injected failure-recovery cases. The browser environment is recorded in `browser-environment.json`.
- `migration-source-checksums.json` binds every selected migration file to its SHA-256 and shows 42 baseline files unchanged plus the two 022 files added.
- `logs/` contains the raw command outputs, including the full test report.
- `manifest.json` binds the size and SHA-256 of every file in this packet.

All PostgreSQL and payment tests used disposable localhost databases and mock facilitators. No staging or production environment, live settlement, signing secret, or execution endpoint was used. Linux image qualification is blocked because Docker Desktop's daemon was unavailable on this host.
