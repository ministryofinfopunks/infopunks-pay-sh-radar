# Frozen SHA validation

- Branch: `codex/track-a-release-candidate`
- Tested SHA: `58b7a3cba57abacaf7b5f4e80b3bd553396a8788`
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run migrations:validate`: PASS; ordered migrations 001–021, all reversible, checksums recorded
- `rh-chain-migration-status.ts` with disposable local PostgreSQL: PASS; 21 applied, zero pending, repository inventory valid
- `npm run build`: PASS; Vite warns `radarApp` chunk ~1.29 MB minified
- Full PostgreSQL-backed suite with `--testTimeout=30000`: PASS, 270 files, 1,894 tests, zero skipped
- First full-suite attempt with default timeout had one 5-second payment durability timeout under load; the repeated suite passed. No test was excluded.
- Screenshots and available console evidence: `screenshots/` and `logs/browser-console-summary.txt`.

This validation used only the disposable local PostgreSQL database, test facilitators, and local browser. It does not clear the Railway staging, external evidence, accessibility/performance, network capture, backup/restore, or rollback gates in `final-decision.md`.
