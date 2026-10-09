# A5.1 qualification decision: HOLD for staging deployment

## Locally qualified

- Candidate source branch is `codex/track-a-release-candidate`, based on expected starting SHA `b25a063db886b667c81888576da9079fe30d5a6d`.
- PostgreSQL migration runner covers 001–021, explicit historical adoption, checksums, concurrency, failure/retry, immutable history and JSON reporting.
- Full repository suite passed with disposable local PostgreSQL: 273 test files; 1,904 passed; 1 skipped. Typecheck, lint and production build results are recorded in the final validation report.
- New UI states expose the local canonical refresh gap and correctly distinguish catalog price from route estimate.
- Desktop/mobile browser evidence exists for all ten requested routes.

## Deployment gate

HOLD until an operator provides Railway staging project/environment access, creates the isolated private PostgreSQL service, supplies staging-only credentials and live catalog URL, approves the candidate revision and migration runner, configures backup retention/alerts, deploys the candidate, and verifies `/healthz`, `/readyz`, live catalog freshness, migration JSON report, backup restore and receipt replay. The local browser run's fixture catalog and empty in-memory asset registry do not satisfy these staging checks.

No production infrastructure, DNS, production migrations, live funded transactions, signing keys, payment activation, IPX operations, token authority or financial-contract authority were accessed or changed. No statistical or real-world Level 3 learning claim is made.
