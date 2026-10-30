# A5.1 validation results

## Source revision under test

Starting revision was `b25a063db886b667c81888576da9079fe30d5a6d` on `codex/track-a-release-candidate`. The release implementation SHA is `f27cc5cb461a897e2833bbf992d13654361bc76d`. The full PostgreSQL-backed suite, typecheck, lint, production build, migration application/replay check, and browser run were rerun against this SHA. This report is an evidence-only follow-up commit; it does not change application source.

## Checks

| Check | Result | Evidence / notes |
|---|---|---|
| Typecheck (`npm run typecheck`) | PASS | `tsc --noEmit` |
| Lint (`npm run lint`) | PASS | Repository lint command is `tsc --noEmit --pretty false`; no separate ESLint script is configured. |
| Full tests with PostgreSQL | PASS | 273 files; 1,905 passed; 1 skipped. Command: `CANONICAL_RECEIPT_TEST_URL=postgresql:///track_a5_20261009 ECONOMIC_ENGINE_TEST_URL=postgresql:///track_a5_20261009 npm test -- --maxWorkers=1 --testTimeout=30000`. |
| PostgreSQL migration runner | PASS | 7 integration cases passed; direct CLI first/repeat boot produced 21 history rows, zero pending; 017/020 supported baseline tests passed. See `migration-ledger.md` and `migration-report.json`. |
| Build | PASS with warning | `npm run build` completed. Vite reported the existing `radarApp` bundle exceeds 500 kB (1,285.93 kB minified); bundle splitting is a follow-up performance item. |
| Health/readiness local smoke | PASS / DEGRADED | `/healthz` returned live. `/readyz` returned `ok:true`, `status:degraded`, `persistence:memory` because this browser server used the development fixture catalog and no database. |
| Browser routes, desktop/mobile | PASS with known 409 | 10 routes × 2 viewports; 20 viewport captures plus two focused 409-state captures. No console errors, exceptions, failed requests, horizontal overflow, or unnamed interactive AX nodes. Reflexive audit returned expected 409 in both sizes because no local canonical asset refresh had run. |
| Security / paid path | PASS within local scope | No production signing credentials or funded wallets used. Payment, execution, IPX and token-operation flags were not activated. Full unit and security test suite passed. |
| Docker image build | NOT RUN | Docker Engine is not installed in this workspace; the compiled migration CLI and migration assets were included and verified through the local production build. |
| Live staging PostgreSQL / Railway | NOT RUN | Railway CLI/project access and staging credentials unavailable; no deployment performed. |
| Live Pay.sh catalog readiness | NOT RUN | Browser run was fixture-backed; approved staging catalog URL/credentials were not available. |
| Backup/restore and staging receipt replay | NOT RUN | Requires an isolated staging database and operator-approved backup configuration. |

## Skip disposition

The single skipped test was the optional real PostgreSQL backend-termination harness in `tests/postgres-resilience-failure-matrix.test.ts`. `POSTGRES_RESILIENCE_TEST_URL` was not supplied, so it intentionally skipped rather than terminating a backend in the shared local development database. This test can be run against a dedicated disposable PostgreSQL service when provisioned. Vitest also emitted its existing Node `--localstorage-file` path warnings during jsdom workers; they did not fail tests.

## Additional notes

The database named `track_a5_20261009` was a disposable local database used only for migration and test schemas. It is not staging or production. The existing synthetic causal replay suite ran as part of the 1,905 passing tests. No claim of externally verified learning improvement is made.
